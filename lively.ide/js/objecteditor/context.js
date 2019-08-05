/*global System*/
import { RuntimeSourceDescriptor } from "lively.classes/source-descriptors.js";
import { withSuperclasses, isClass } from "lively.classes/util.js";
import { module } from "lively.modules/index.js";
import { string, Path, obj } from "lively.lang";
import ClassTreeData from "./classTree.js";
import { subscribe, unsubscribe } from "lively.notifications/index.js";
import L2LClient from "lively.2lively/client.js";
import { l2lInterfaceFor, localInterface } from "lively-system-interface";
import ObjectPackage, { isObjectClass, addScript } from "lively.classes/object-classes.js";

import semver from 'semver';
import { adoptObject } from "lively.classes/runtime.js";
import { chooseUnusedImports } from "../import-helper.js";
import { deserialize } from "lively.serializer2";
import { stringifyFunctionWithoutToplevelRecorder } from "lively.source-transform";

export default class ObjectEditorContext {
 
  static async for(target, editor, evalEnvironment) {
    return await new this().selectTarget(target, editor, evalEnvironment);
  }

  get isRemote() { return !!this.remoteContextId }

  get selectedModule() {
    return module(this.evalEnvironment.targetModule);
  }

  isRemoteHandle(id) {
    return obj.isString(id) && id.startsWith('lively://lively.next-object-editor/');
  }

  async selectTarget(target, editor, evalEnvironment = false) {
    if (!this.onModuleChangeHandler && this.interfaceToEditor) {
      this.onModuleChangeHandler = async (evt) => {
        const newClassSource = await this.onModuleChanged(evt)
        if (newClassSource) this.withEditorDo((ed) =>
           ed.reactToModuleChange(newClassSource), {
             newClassSource
           });
      };
      // FIXME: subscribe to module change events ...
      // but how to disconnect?
      subscribe("lively.modules/modulechanged", this.onModuleChangeHandler);
      subscribe("lively.modules/moduleloaded", this.onModuleChangeHandler);
    }
    if (evalEnvironment && this.isRemoteHandle(target)) {
      this.connectToContext(target, editor, evalEnvironment);
      return this;
    }
    if (evalEnvironment && typeof target === 'string') {
      await this.selectRemoteTarget({
        code: target, editor, evalEnvironment
      });
      return this;
    }
    await this.selectLocalTarget(target, editor);
    return this;
  }
  
  async refresh() {
    this.classTreeData = new ClassTreeData(this.target.constructor);
    // never really used....
    this.evalEnvironment = {
      context: this.target,
      systemInterface: localInterface,
      targetModule: this.sourceDescriptorFor(this.target.constructor).module.id,
      format: "esm"
    };
  }

  async connectToContext(id, editor, evalEnvironment) {
     this.remoteContextId = this.target = id;
     this.evalEnvironment = {
      context: `System.get('@lively-env').objectEditContexts["${this.remoteContextId}"].target`,
      systemInterface: evalEnvironment.systemInterface,
      format: "esm"
    };
    this.evalEnvironment.targetModule = await this.withContextDo(ctx => ctx.selectedModule.id);
    if (editor)
       Object.assign(editor.editorPlugin.evalEnvironment, this.evalEnvironment);
    this.selectedClassName = await this.withContextDo(ctx => ctx.selectedClassName);
  }
  
  async selectLocalTarget(target, editor = false /* if in browser */) {
    this.target = target;
    this.selectedClass = null;
    this.selectedMethod = null;
    await this.refresh()
    if (editor)
      Object.assign(editor.editorPlugin.evalEnvironment, this.evalEnvironment);
    await this.selectClass(target.constructor.name);
    return this;
  }

  async selectRemoteTarget({code, evalEnvironment, editor}) {
    // setup a bidirectional l2l connection
    let peerId = L2LClient.default().id;
    let res = await evalEnvironment.systemInterface.runEval(`
       const { default: ObjectEditorContext} = await System.import("lively.ide/js/objecteditor/context.js");
       const t = (() => ${code})();
       const ctx = await ObjectEditorContext.for(t);
       const id = await ctx.connectToEditor("${peerId}", "${editor.id}");
       const targetModule = ctx.selectedModule.id;
       const res =  {targetModule, id};
       res;
    `, evalEnvironment);
    if (res.isError) {
      throw Error(res);
    }
    this.remoteContextId = this.target = res.value.id;
    this.evalEnvironment = {
      context: `System.get('@lively-env').objectEditContexts["${this.remoteContextId}"].target`,
      systemInterface: evalEnvironment.systemInterface,
      targetModule: res.value.targetModule,
      format: "esm"
    };
    this.selectedClassName = await this.withContextDo(ctx => ctx.selectedClassName);
    if (editor)
      Object.assign(editor.editorPlugin.evalEnvironment, this.evalEnvironment);
  }

  dispose() {
    // automatically clean the recorder??
    this.withContextDo(() => {
      if (!System.get('@system-env').node) return;
      // has to be done in the nodejs environments, to prevent memory leaking
      delete System.get('@lively-env').objectEditContexts[this.id];
      unsubscribe("lively.modules/modulechanged", this.onModuleChangeHandler);
      unsubscribe("lively.modules/moduleloaded", this.onModuleChangeHandler);  
    });
  }

  connectToEditor(peerId, editorId) {
    this.id = `lively://lively.next-object-editor/${editorId}`;
    if (!System.get('@lively-env').objectEditContexts) System.get('@lively-env').objectEditContexts = {};
    this.interfaceToEditor = l2lInterfaceFor(peerId, L2LClient.default());
    this.editorId = editorId;
    System.get('@lively-env').objectEditContexts[this.id] = this;
    return this.id;
  }  

  stringifySource(source, varMapping = {}) {
    const varDeclarations = obj.keys(varMapping)
                               .map(k => `const ${k} = ${JSON.stringify(varMapping[k])};`)
                               .join('\n');
    source = source === 'string' ? source : stringifyFunctionWithoutToplevelRecorder(source);
    return '(() => {' + varDeclarations + '\n return (' + source + ')(this) })()'
  }

  async withEditorDo(source, varMapping) {
    source = this.wrapSource(this.stringifySource(source, varMapping));
    let res = await this.interfaceToEditor.runEval(source, {
      context: `$world.getMorphWithId("${this.editorId}")`,
      targetModule: "lively.ide/js/objecteditor/index.js",
      ackTimeout: 30*1000
    });
    if (res.isError) {
      throw Error(res.value)
    }
    res = res.value;
    if (!obj.isArray(res) && obj.isObject(res)) return deserialize(res);
    return res;
  }

  wrapSource(source) {
    return `
          let { serialize } = await System.import('lively.serializer2');
          let __eval_res__ = await ${source};
          if (!obj.isArray(__eval_res__) && obj.isObject(__eval_res__))
            __eval_res__ = serialize(__eval_res__);
          __eval_res__;
        `;
  }

  async withContextDo(source, varMapping = {}) {
    // if we are local and the source is a plain function, just evaluate as is
    if (!this.remoteContextId && obj.isFunction(source)) {
      return await source(this);
    }
    source = this.stringifySource(source, varMapping);
    let evalStr = this.wrapSource(source),
        context = this.remoteContextId ? `System.get('@lively-env').objectEditContexts["${this.remoteContextId}"]` : this,
        res = await this.evalEnvironment.systemInterface.runEval(evalStr,{
           targetModule: "lively.ide/js/objecteditor/context.js",
           ackTimeout: 30*1000,
           context
        });
    if (res.isError) {
      throw Error(res.value)
    }
    res = res.value;
    if (!obj.isArray(res) && obj.isObject(res)) return deserialize(res);
    return res;
  }
  
  sourceDescriptorFor(klass) { return RuntimeSourceDescriptor.for(klass); }

  classChainOfTarget() {
    return withSuperclasses(this.target.constructor);
  }

  async addModuleChangeWarning() {
    if (this.isSaving) return;
    const newClassSource = await this.sourceDescriptorFor(this.selectedClass).source;
    this.moduleChangeWarning = this.selectedModule.id;
    this.sourceHash = string.hashCode(newClassSource);
  }

  async onModuleChanged(evt) {
    if (this.isSaving) return;

    var m = module(evt.module),
        {selectedModule, selectedClass} = this;

    if (!selectedModule || selectedModule.id !== m.id)
      return;

    return await this.sourceDescriptorFor(selectedClass).source;
  }

  onModuleLoaded(evt) {
    this.onModuleChanged(evt);
  }

  async getTitle() {
    let title = "", {
      selectedClass,
      selectedMethod,
      selectedModule
    } = this;
        
    if (selectedClass) {
      title += ` - ${selectedClass.name}`;
      if (isObjectClass(selectedClass)) {
        let p = selectedClass[Symbol.for("lively-module-meta")].package;
        if (p && p.version) title += "@" + p.version;
      }
      if (selectedMethod) title += `>>${selectedMethod.name}`;
    } else if (selectedModule) {
      title += ` - ${selectedModule.shortName()}`;
    }
    return title;
  }
  
  async selectClass(className) {
    this.selectedClassName = await this.withContextDo(() => {
      let klass = this.classChainOfTarget().find(ea => ea.name === className);
      this.selectedMethod = null;
      this.selectedClass = klass;
      return klass.name;
    }, { className });
  }

  updatePackageConfig(sourceChanged) {
    if (isObjectClass(this.selectedClass) && sourceChanged) {
       var system = this.evalEnvironment.systemInterface,
           descr = this.sourceDescriptorFor(this.selectedClass),
           pkg = descr.module.package(),
           packageConfig = {...pkg.config, version: semver.inc(pkg.version, "prerelease", true)},
           mod = system.getModule(pkg.url + "/package.json");
       system.packageConfChange(JSON.stringify(packageConfig, null, 2), mod.id);
     }    
  }

  async forkPackage(forkedName) {
    let t = this.target,
        klass = t.constructor,
        nextClass = withSuperclasses(klass)[1],
        {package: {name: packageName}} = klass[Symbol.for("lively-module-meta")],
        pkg = ObjectPackage.lookupPackageForObject(t),
        {baseURL, System} = pkg,
        forkedPackage = await pkg.fork(forkedName, {baseURL, System});
    await adoptObject(t, forkedPackage.objectClass);
    return forkedPackage.objectClass.name;
  }

  async addNewMethod() {
    return await addScript(this.target, "function() {}", "newMethod");
  }

  async selectMethod(className, methodSpec) {
    let methodNode = await this.withContextDo(async () => {
      let klass = this.classChainOfTarget().find(ea => ea.name === className);

      if (klass && !methodSpec && isClass(klass.owner)) {
        methodSpec = klass;
        klass = klass.owner;
      }
  
      this.selectedMethod = methodSpec;
  
      let methodNode = await this._sourceDescriptor_of_class_findMethodNode(
        klass, methodSpec.name, methodSpec.kind, methodSpec.static);
   
      return methodNode;
    }, {
      className, methodSpec
    });
    if (methodNode) this.selectedMethodName = methodSpec.name;
    return methodNode;
  }
  
  async removeUnusedImports(toRemove) {
    try {
      var m = this.selectedModule,
          origSource = await m.source(),
          toRemove = await chooseUnusedImports(origSource);

      if (!toRemove || !toRemove.changes || !toRemove.changes.length) {
        return { statusMessage: "Nothing to remove" };
      }

      await m.removeImports(toRemove.removedImports);
      return { statusMessage: "Imports removed" };
    } catch (e) {
      origSource && await m.changeSource(origSource);
      return { statusMessage: e.toString() }
    }
  }

  async _sourceDescriptor_of_class_findMethodNode(klass, methodName, methodKind, isClassMethod = false, ast) {
    let descr = this.sourceDescriptorFor(klass),
        parsed = ast || await descr.ast,
        methods = Path("body.body").get(parsed),
        method = methods.find(({kind, static: itIsClassMethod, key: {name}}) => {
          if (name !== methodName || itIsClassMethod !== isClassMethod)
            return false;
          if (!methodKind || (methodKind !== "get" && methodKind !== "set"))
            return true;
          return methodKind === kind;
        });
    return method;
  }
  
}
