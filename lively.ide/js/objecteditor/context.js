/* global System */
import semver from 'semver';
import { RuntimeSourceDescriptor } from 'lively.classes/source-descriptors.js';
import { withSuperclasses, isClass } from 'lively.classes/util.js';
import { isObjectClass, interactivelyForkPackage, addScript } from 'lively.classes/object-classes.js';
import { string, num, promise, Path, obj } from 'lively.lang';
import { subscribe, unsubscribe } from 'lively.notifications';
import L2LClient from 'lively.2lively/client.js';
import { l2lInterfaceFor, localInterface } from 'lively-system-interface';
import { deserialize, getClassName } from 'lively.serializer2';
import { stringifyFunctionWithoutToplevelRecorder } from 'lively.source-transform';
import * as modules from 'lively.modules';
const { module } = modules;

import ClassTreeData from './classTree.js';
import { chooseUnusedImports } from '../import-helper.js';

export default class ObjectEditorContext {
  static async for (target, editor, evalEnvironment) {
    return await new this().selectTarget(target, editor, evalEnvironment);
  }

  get isRemote () { return !!this.remoteContextId; }

  get selectedModule () {
    return module(this.evalEnvironment.targetModule);
  }

  isRemoteHandle (id) {
    return obj.isString(id) && id.startsWith('lively://lively.next-object-editor/');
  }

  async selectTarget (target, editor, evalEnvironment = false) {
    if (!this.onModuleChangeHandler && this.interfaceToEditor) {
      this.onModuleChangeHandler = async (evt) => {
        const newClassSource = await this.onModuleChanged(evt);
        if (newClassSource) {
          this.withEditorDo((ed) =>
            ed.reactToModuleChange(newClassSource), {
            newClassSource
          });
        }
      };
      // FIXME: subscribe to module change events ...
      // but how to disconnect?
      subscribe('lively.modules/modulechanged', this.onModuleChangeHandler);
      subscribe('lively.modules/moduleloaded', this.onModuleChangeHandler);
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

  async refresh (expandAll) {
    this.classTreeData = new ClassTreeData(this.target.constructor);
    if (expandAll) {
      // uncollapse the tree completely
      await this.classTreeData.uncollapseAll((node) => this.classTreeData.getChildren(node) && node.isRoot);
    }
    // never really used....
    this.evalEnvironment = {
      context: this.target,
      systemInterface: localInterface,
      targetModule: this.sourceDescriptorFor(this.target.constructor).module.id,
      format: 'esm'
    };
  }

  async connectToContext (id, editor, evalEnvironment) {
    this.remoteContextId = this.target = id;
    this.evalEnvironment = {
      context: `System.get('@lively-env').objectEditContexts["${this.remoteContextId}"].target`,
      systemInterface: evalEnvironment.systemInterface,
      format: 'esm'
    };
    this.evalEnvironment.targetModule = await this.withContextDo(ctx => ctx.selectedModule.id);
    if (editor) { Object.assign(editor.editorPlugin.evalEnvironment, this.evalEnvironment); }
    this.selectedClassName = await this.withContextDo(ctx => ctx.selectedClassName);
  }

  async selectLocalTarget (target, editor = false /* if in browser */) {
    this.target = target;
    this.selectedClass = null;
    this.selectedMethod = null;
    await this.refresh(!editor);
    if (editor) { Object.assign(editor.editorPlugin.evalEnvironment, this.evalEnvironment); }
    await this.selectClass(getClassName(target));
    return this;
  }

  async selectRemoteTarget ({ code, evalEnvironment, editor }) {
    // setup a bidirectional l2l connection
    const peerId = L2LClient.default().id;
    const res = await evalEnvironment.systemInterface.runEval(`
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
      format: 'esm'
    };
    this.selectedClassName = await this.withContextDo(ctx => ctx.selectedClassName);
    if (editor) { Object.assign(editor.editorPlugin.evalEnvironment, this.evalEnvironment); }
  }

  dispose () {
    // automatically clean the recorder??
    this.withContextDo(() => {
      if (!System.get('@system-env').node) return;
      // has to be done in the nodejs environments, to prevent memory leaking
      delete System.get('@lively-env').objectEditContexts[this.id];
      unsubscribe('lively.modules/modulechanged', this.onModuleChangeHandler);
      unsubscribe('lively.modules/moduleloaded', this.onModuleChangeHandler);
    });
  }

  connectToEditor (peerId, editorId) {
    this.id = `lively://lively.next-object-editor/${editorId}`;
    if (!System.get('@lively-env').objectEditContexts) System.get('@lively-env').objectEditContexts = {};
    this.interfaceToEditor = l2lInterfaceFor(peerId, L2LClient.default());
    this.editorId = editorId;
    System.get('@lively-env').objectEditContexts[this.id] = this;
    return this.id;
  }

  stringifySource (source, varMapping = {}) {
    const varDeclarations = obj.keys(varMapping)
      .map(k => `const ${k} = ${JSON.stringify(varMapping[k])};`)
      .join('\n');
    source = source === 'string' ? source : stringifyFunctionWithoutToplevelRecorder(source);
    return '(() => {' + varDeclarations + '\n return (' + source + ')(this) })()';
  }

  async withEditorDo (source, varMapping) {
    source = this.wrapSource(this.stringifySource(source, varMapping));
    let res = await this.interfaceToEditor.runEval(source, {
      context: `$world.getMorphWithId("${this.editorId}")`,
      targetModule: 'lively.ide/js/objecteditor/index.js',
      ackTimeout: 30 * 1000
    });
    if (res.isError) {
      throw Error(res.value);
    }
    res = res.value;
    if (!obj.isArray(res) && obj.isObject(res)) return deserialize(res);
    return res;
  }

  wrapSource (source) {
    return `
          let { serialize } = await System.import('lively.serializer2');
          let __eval_res__ = await ${source};
          if (!obj.isArray(__eval_res__) && obj.isObject(__eval_res__))
            __eval_res__ = serialize(__eval_res__);
          __eval_res__;
        `;
  }

  async withContextDo (source, varMapping = {}) {
    // if we are local and the source is a plain function, just evaluate as is
    if (!this.remoteContextId && obj.isFunction(source)) {
      return await source(this);
    }
    if (this._evalInProgress) await promise.waitFor(5000, () => !this._evalInProgress);
    this._evalInProgress = true;
    source = this.stringifySource(source, varMapping);
    const evalStr = this.wrapSource(source);
    const context = this.remoteContextId ? `System.get('@lively-env').objectEditContexts["${this.remoteContextId}"]` : this;
    let res = await this.evalEnvironment.systemInterface.runEval(evalStr, {
      targetModule: 'lively.ide/js/objecteditor/context.js',
      ackTimeout: 30 * 1000,
      context
    });
    if (res.isError) {
      throw Error(res.value);
    }
    res = res.value;
    this._evalInProgress = false;
    if (!obj.isArray(res) && obj.isObject(res)) return deserialize(res);
    return res;
  }

  sourceDescriptorFor (klass) { return RuntimeSourceDescriptor.for(klass); }

  classChainOfTarget () {
    return withSuperclasses(this.target.constructor);
  }

  async addModuleChangeWarning () {
    if (this.isSaving) return;
    const newClassSource = await this.sourceDescriptorFor(this.selectedClass).source;
    this.moduleChangeWarning = this.selectedModule.id;
    this.sourceHash = string.hashCode(newClassSource);
  }

  async onModuleChanged (evt) {
    if (this.isSaving) return;

    const m = module(evt.module);
    const { selectedModule, selectedClass } = this;

    if (!selectedModule || selectedModule.id !== m.id) { return; }

    return await this.sourceDescriptorFor(selectedClass).source;
  }

  onModuleLoaded (evt) {
    this.onModuleChanged(evt);
  }

  async getTitle () {
    let title = ''; const {
      selectedClass,
      selectedMethod,
      selectedModule
    } = this;

    if (selectedClass) {
      title += ` - ${selectedClass[Symbol.for('__LivelyClassName__')]}`;
      if (isObjectClass(selectedClass)) {
        const p = selectedClass[Symbol.for('lively-module-meta')].package;
        if (p && p.version) title += '@' + p.version;
      }
      if (selectedMethod) title += `>>${selectedMethod.name}`;
    } else if (selectedModule) {
      title += ` - ${selectedModule.shortName()}`;
    }
    return title;
  }

  async selectClass (className) {
    // what if classes names are the same, but located in different modules?
    this.selectedClassName = await this.withContextDo(() => {
      const klass = this.classChainOfTarget().find(ea => ea[Symbol.for('__LivelyClassName__')] === className);
      this.selectedMethod = null;
      this.selectedClass = klass;
      return klass[Symbol.for('__LivelyClassName__')];
    }, { className });
  }

  updatePackageConfig (sourceChanged) {
    if (isObjectClass(this.selectedClass) && sourceChanged) {
      const system = this.evalEnvironment.systemInterface;
      const descr = this.sourceDescriptorFor(this.selectedClass);
      const pkg = descr.module.package();
      const packageConfig = { ...pkg.config, version: semver.inc(pkg.version, 'prerelease', true) };
      const mod = system.getModule(pkg.url + '/package.json');
      system.packageConfChange(JSON.stringify(packageConfig, null, 2), mod.id);
    }
  }

  async forkPackage (forkedName) {
    return await interactivelyForkPackage(this.target, forkedName);
  }

  async addNewMethod () {
    return await addScript(this.target, 'function() {}', 'newMethod');
  }

  async selectMethod (className, methodSpec) {
    const methodNode = await this.withContextDo(async () => {
      let klass = this.classChainOfTarget().find(ea => ea[Symbol.for('__LivelyClassName__')] === className);

      if (klass && !methodSpec && isClass(klass.owner)) {
        methodSpec = klass;
        klass = klass.owner;
      }

      this.selectedMethod = methodSpec;

      const methodNode = await this._sourceDescriptor_of_class_findMethodNode(
        klass, methodSpec.name, methodSpec.kind, methodSpec.static);

      return methodNode;
    }, {
      className, methodSpec
    });
    if (methodNode) this.selectedMethodName = methodSpec.name;
    return methodNode;
  }

  async removeUnusedImports (toRemove) {
    try {
      var m = this.selectedModule;
      var origSource = await m.source();
      var toRemove = await chooseUnusedImports(origSource);

      if (!toRemove || !toRemove.changes || !toRemove.changes.length) {
        return { statusMessage: 'Nothing to remove' };
      }

      await m.removeImports(toRemove.removedImports);
      return { statusMessage: 'Imports removed' };
    } catch (e) {
      origSource && await m.changeSource(origSource);
      return { statusMessage: e.toString() };
    }
  }

  async getMethodAtCursorPos (className, methodSpec, cursorIndex) {
    return await this.withContextDo(() => {
      const klass = this.classChainOfTarget().find(ea => ea[Symbol.for('__LivelyClassName__')] === className);
      return this._sourceDescriptor_of_class_findMethodNode(klass, cursorIndex);
    }, { cursorIndex });
  }

  async _sourceDescriptor_of_class_findMethodNode (klass, methodNameOrIndex, methodKind, isClassMethod = false, ast) {
    const descr = this.sourceDescriptorFor(klass);
    const parsed = ast || await descr.ast;
    const methods = Path('body.body').get(parsed);
    const method = methods.find(({ kind, static: itIsClassMethod, key: { name }, value: { body: { start, end } } }) => {
      if (obj.isNumber(methodNameOrIndex)) return num.between(methodNameOrIndex, start, end);
      if (name !== methodNameOrIndex || itIsClassMethod !== isClassMethod) { return false; }
      if (!methodKind || (methodKind !== 'get' && methodKind !== 'set')) { return true; }
      return methodKind === kind;
    });
    return method;
  }
}
