/*global System, localStorage*/
import { arr, obj, t, Path, string, fun, promise } from "lively.lang";
import { Icon, ProportionalLayout, StyleSheet, Morph, HorizontalLayout, GridLayout, config } from "lively.morphic";
import { pt, Color } from "lively.graphics";
import JavaScriptEditorPlugin from "../editor-plugin.js";
import { withSuperclasses, isClass } from "lively.classes/util.js";
import { Tree, LoadingIndicator } from "lively.components";
import { connect } from "lively.bindings";
import { RuntimeSourceDescriptor } from "lively.classes/source-descriptors.js";
import ObjectPackage, { isObjectClass } from "lively.classes/object-classes.js";
import { chooseUnusedImports, interactivlyFixUndeclaredVariables, interactivelyChooseImports } from "../import-helper.js";
import { module } from "lively.modules";
import { parse } from "lively.ast";
import { interactivelySavePart } from "lively.morphic/partsbin.js";
import * as livelySystem from 'lively-system-interface';

import { adoptObject } from "lively.classes/runtime.js";
import { InteractiveMorphSelector } from "lively.halos";
import ClassTreeData from './classTree.js';
import ObjectEditorContext from "./context.js";
import DarkTheme from "../../themes/dark.js";
import DefaultTheme from "../../themes/default.js";
import { stringifyFunctionWithoutToplevelRecorder } from "lively.source-transform";
import { interactivelyFreezePart, displayFrozenPartsFor } from "lively.freezer";

export class ObjectEditor extends Morph {

  static async open(options = {}) {
    let {
      title,
      target,
      className,
      methodName,
      textPosition,
      scroll,
      classTreeScroll,
      evalEnvironment,
      loadingIndicator
    } = options;

    var ed = new this(obj.dissoc(options, "title", "class", "method", "target", "evalEnvironment")),
        winOpts = {name: "ObjectEditor window", title: options.title || "ObjectEditor"},
        win = (await ed.openInWindow(winOpts)).activate();
    await win.whenRendered();
    if (target) {
      if (loadingIndicator) loadingIndicator.label = 'Connecting to target';
      await ed.browse({
        title,
        target,
        className,
        methodName,
        textPosition,
        scroll,
        classTreeScroll,
        evalEnvironment
      });
    }
    return win;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // initializing
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  static get properties() {

    return {
      extent: {defaultValue: pt(800, 500)},
      fill: {defaultValue: Color.transparent},
      reactsToPointer: {defaultValue: false},
      name: {defaultValue: "object-editor"},
      clipMode: {defaultValue: 'hidden'},

      context: {},

      styleSheets: {
        initialize() {
          this.styleSheets = new StyleSheet({
          ".listing": {
            // borderWidth: 1, borderColor: Color.gray,
            fontSize: 14, fontFamily: "Helvetica Neue, Arial, sans-serif"
          },
          ".Text": {
            borderLeft: {width: 1, color: Color.gray},
            borderRight: {width: 1, color: Color.gray},
            borderBottom: {width: 1, color: Color.gray},
          },
          ".Button.plain": {
            extent: pt(26,24),
            fontSize: 14
          },
  
          ".Button.flat": {
            fill: Color.white,
            border: {color: Color.lightGray, style: "solid", radius: 5},
            nativeCursor: "pointer",
            extent: pt(26,24),
            fontSize: 14
          },
           "[name=sourceEditor]": {
             lineWrapping: "by-chars",
             ...config.codeEditor.defaultStyle,
           },
           "[name=classTree]": {
             borderRight: {width: 0},
             borderTop: {width: 1, color: Color.gray},
             borderBottom: {width: 1, color: Color.gray}
           },
           "[name=objectCommands]": {
             fill: Color.transparent
           },
           "[name=classAndMethodControls]": {
             fill: Color.transparent
           },
           "[name=importController]": {
             fill: Color.transparent
           },
            "[name=sourceEditorControls]": {
             fill: Color.transparent,
             borderLeft: {width: 1, color: Color.gray},
             borderRight: {width: 1, color: Color.gray},
           }
          });
        }
      },

      editorPlugin: {
        readOnly: true, derived: true, after: ["submorphs"],
        get() {
          let ed = this.get("sourceEditor"),
              p = ed.pluginFind(p => p.isEditorPlugin);
          if (!p) p = ed.addPlugin(new JavaScriptEditorPlugin(config.codeEditor.defaultTheme));
          return p;
        }
      },

      target: {
        get() { 
          return this.context.target
        }
      }

    };

  }

  constructor(props) {
    super({...props, submorphs: this.build()});
    this.reset();
    this.ui.forkPackageButton.disable();
  }

  get ui() {
    return this._ui = this._ui || {
      addImportButton:     this.getSubmorphNamed("addImportButton"),
      addButton:           this.getSubmorphNamed("addButton"),
      removeButton:        this.getSubmorphNamed("removeButton"),
      classTree:           this.getSubmorphNamed("classTree"),
      chooseTargetButton:  this.getSubmorphNamed("chooseTargetButton"),
      cleanupButton:       this.getSubmorphNamed("cleanupButton"),
      importController:    this.getSubmorphNamed("importController"),
      importsList:         this.getSubmorphNamed("importsList"),
      inspectObjectButton: this.getSubmorphNamed("inspectObjectButton"),
      openInBrowserButton: this.getSubmorphNamed("openInBrowserButton"),
      publishButton:       this.getSubmorphNamed("publishButton"),
      removeImportButton:  this.getSubmorphNamed("removeImportButton"),
      forkPackageButton:   this.getSubmorphNamed("forkPackageButton"),
      runMethodButton:     this.getSubmorphNamed("runMethodButton"),
      saveButton:          this.getSubmorphNamed("saveButton"),
      sourceEditor:        this.getSubmorphNamed("sourceEditor"),
      toggleImportsButton: this.getSubmorphNamed("toggleImportsButton"),
      classAndMethodControls: this.getSubmorphNamed("classAndMethodControls"),
      freezeTargetButton: this.getSubmorphNamed('freezeTargetButton'),
      showFrozenPartsButton: this.getSubmorphNamed('showFrozenPartsButton')
    };
  }

  reset() {
    // this.rebuild()
    var l = this.layout = new GridLayout({
      grid: [
        ["objectCommands", "objectCommands", "objectCommands"],
        ["classTree", "sourceEditor", "importController"],
        ["classAndMethodControls", "sourceEditorControls", "importController"],
      ]});
    l.col(0).fixed = 180;
    l.col(2).fixed = 1;
    l.col(2).width = 0;
    l.row(0).fixed = 28;
    l.row(2).fixed = 30;

    let {
      addImportButton,
      addButton,
      removeButton,
      chooseTargetButton,
      classTree,
      cleanupButton,
      inspectObjectButton,
      openInBrowserButton,
      publishButton,
      removeImportButton,
      forkPackageButton,
      runMethodButton,
      saveButton,
      sourceEditor,
      toggleImportsButton,
      classAndMethodControls,
      freezeTargetButton,
      showFrozenPartsButton
    } = this.ui;

    sourceEditor.addCommands([{
      name: "[javascript] fix undeclared variables",
      exec: () => this.interactivlyFixUndeclaredVariables()
    },{
      name: "[javascript] inject import",
      exec: () => this.interactivelyAddImport()
    },{
      name: "[javascript] remove unused imports",
      exec: () => this.interactivelyRemoveUnusedImports()
    }]);

    connect(freezeTargetButton, 'fire', this, 'execCommand', {converter: () => 'freeze target'});
    connect(showFrozenPartsButton, 'fire', this, 'execCommand', {converter: () => 'show frozen parts'});
    
    connect(inspectObjectButton, "fire", this, "execCommand", {converter: () => "open object inspector for target"});
    connect(publishButton, "fire", this, "execCommand", {converter: () => "publish target to PartsBin"});
    connect(chooseTargetButton, "fire", this, "execCommand", {converter: () => "choose target"});

    connect(classTree, "selectedNode", this, "onClassTreeSelection");

    connect(addButton, "fire", this, "interactivelyAddObjectPackageAndMethod");
    connect(removeButton, "fire", this, "execCommand", {converter: () => "remove method or class"});
    connect(forkPackageButton, "fire", this, "interactivelyForkPackage");
    connect(openInBrowserButton, "fire", this, "execCommand",
      {updater: function($upd) { $upd("open class in system browser", {klass: this.targetObj.selectedClass}); }});

    connect(addImportButton, "fire", this, "interactivelyAddImport");
    connect(removeImportButton, "fire", this, "interactivelyRemoveImport");
    connect(cleanupButton, "fire", this, "execCommand", {converter: () => "[javascript] removed unused imports"});

    connect(saveButton, "fire", this, "execCommand", {converter: () => "save source"});
    connect(runMethodButton, "fire", this, "execCommand", {converter: () => "run selected method"});

    connect(toggleImportsButton, "fire", this, "toggleShowingImports");
    connect(sourceEditor, "textChange", this, "updateUnsavedChangeIndicatorDebounced");

    connect(classTree, "contextMenuRequested", this, "contextMenuForClassTree");

    this.applyLayoutIfNeeded();

    [inspectObjectButton, publishButton, chooseTargetButton,
      removeButton,addButton,forkPackageButton, openInBrowserButton
    ].forEach(ea => ea.extent = pt(26,24));
  }

  __additionally_serialize__(snapshot, objRef, pool, addFn) {
    super.__additionally_serialize__(snapshot, objRef, pool, addFn);

    var {
      ui: {sourceEditor, importsList, classTree},
      context: { selectedClassName: className, selectedMethodName: methodName },
      editorPlugin: { evalEnvironment }
    } = this;

    // remove unncessary state
    var ref = pool.ref(sourceEditor),
        props = ref.currentSnapshot.props;
    if (props.textAndAttributes) props.textAndAttributes.value = [];
    if (props.attributeConnections) props.attributeConnections.value = [];
    if (props.plugins) props.plugins.value = [];
    if (props.anchors) props.anchors.value =
      props.anchors.value.filter(ea => ea.id.startsWith("selection-"));
    if (props.savedMarks) props.savedMarks.value = [];

    var ref = pool.ref(classTree);
    if (ref.currentSnapshot.props.selectedNode)
      ref.currentSnapshot.props.selectedNode.value = null;
    var ref = pool.ref(classTree.nodeItemContainer);
    if (ref.currentSnapshot.props.submorphs)
      ref.currentSnapshot.props.submorphs.value = [];
    var ref = pool.ref(classTree.treeData);
    if (ref.currentSnapshot.props.root) {
      ref.currentSnapshot.props.root.value = {};
      ref.currentSnapshot.props.root.verbatim = true;
    }

    var ref = pool.ref(importsList);
    ref.currentSnapshot.props.items.value = [];
    if (ref.currentSnapshot.props.selection)
      ref.currentSnapshot.props.selection.value = null;

    evalEnvironment.backend = evalEnvironment.systemInterface.coreInterface.url || 'local';
    // save essential state
    snapshot.props._serializedState = {
      verbatim: true,
      value: {
        className,
        methodName,
        textPosition: sourceEditor.cursorPosition,
        scroll: sourceEditor.scroll,
        classTreeScroll: classTree.scroll,
        evalEnvironment: obj.dissoc(evalEnvironment, ['context', 'systemInterface'])
      }
    };

  }

  async onWindowClose() {
    let proceed = true;
    if (await this.hasUnsavedChanges()) proceed = await this.warnForUnsavedChanges();
    if (proceed) this.context.dispose();
    else return false;
  }

  async onLoad() {
    this.reset();
    if (this._serializedState) {
      var s = this._serializedState;
      s.evalEnvironment.systemInterface = s.evalEnvironment.backend == 'local' ? 
        livelySystem.localInterface : livelySystem.serverInterfaceFor(s.evalEnvironment.backend); 
      delete this._serializedState;
      await this.browse({ target: this.target, ...s});
    }
  }

  rebuild() {
    let spec = this.browseSpec();
    this.submorphs = this.build();
    this.reset();
    this.browse(spec);
  }

  build() {

    const topBtnStyle = { type: 'Button', styleClasses: ['plain'] },
          btnStyle = { type: 'Button', styleClasses: ['plain'] },
          listStyle = { styleClasses: ['listing'] },
          textStyle = { type: 'Text' },
          wrapperStyle = {
            reactsToPointer: false,
            fill: Color.transparent,
            extent: pt(100, 30),
            clipMode: 'hidden',
          }

    return [
      {
        name: "objectCommands",
        reactsToPointer: false,
        width: 401,
        layout: new ProportionalLayout({
          submorphSettings: [
            ['target controls', { x: 'scale', y: 'fixed' }],
            ['freezer controls', { x: 'move', y: 'fixed' }],
          ]
        }),
        submorphs: [
          {
            ...wrapperStyle,
            layout: new HorizontalLayout({direction: "centered", spacing: 2, autoResize: false}),
            name: 'target controls',
            topCenter: pt(200,0),
            submorphs:[
              {...topBtnStyle, name: "inspectObjectButton", label: Icon.textAttribute("gears"), tooltip: "open object inspector"},
              {...topBtnStyle, name: "publishButton", label: Icon.textAttribute("cloud-upload"), tooltip: "publish object to PartsBin"},
              {...topBtnStyle, name: "chooseTargetButton", label: Icon.textAttribute("crosshairs"), tooltip: "select another target"}
            ]
          },
          {
            ...wrapperStyle,
            name: 'freezer controls',
            layout: new HorizontalLayout({direction: "rightToLeft", spacing: 2, autoResize: false}),
            right: 400,
            submorphs:[
              {...topBtnStyle, name: "freezeTargetButton", label: Icon.textAttribute("snowflake-o"), tooltip: "publish target"},
              {...topBtnStyle, name: "showFrozenPartsButton", label: Icon.textAttribute("sellsy"), tooltip: "show published parts"}
            ]
          }
        ]},

      { type: Tree, name: "classTree", treeData: new ClassTreeData(null), ...listStyle },

      {name: "classAndMethodControls",
        width: 100,
        layout: new HorizontalLayout({direction: "centered", spacing: 2, autoResize: false}), submorphs: [
          {...btnStyle, name: "addButton", label: Icon.textAttribute("plus"), tooltip: "add a new method"},
          {...btnStyle, name: "removeButton", label: Icon.textAttribute("minus"), tooltip: "remove a method or class"},
          {...btnStyle, name: "forkPackageButton", label: Icon.textAttribute("code-fork"), tooltip: "fork package"},
          {...btnStyle, name: "openInBrowserButton", label: Icon.textAttribute("external-link"), tooltip: "open selected class in system browser"},
        ]},

      {name: "sourceEditor", ...textStyle},

      {name: "sourceEditorControls",
        layout: new GridLayout({
          reactToSubmorphAnimations: true,
          rows: [0, {paddingTop: 2, paddingBottom: 3}],
          columns: [
            1, {paddingRight: 1, fixed: 30},
            2, {paddingLeft: 1, fixed: 30},
            4, {paddingRight: 4, fixed: 74}
          ],
          grid: [[null, "saveButton", "runMethodButton", null, "toggleImportsButton"]]}),
        submorphs: [
          {...btnStyle, name: "saveButton", label: Icon.makeLabel("save"), tooltip: "save"},
          {...btnStyle, name: "runMethodButton", label: Icon.makeLabel("play-circle-o"), tooltip: "execute selected method"},
          {...btnStyle, name: "toggleImportsButton", label: "imports", tooltip: "toggle showing imports"}
        ]},

      new ImportController({name: "importController" })
    ];
  }

  isShowingImports() { return this.get("importsList").width > 10; }

  toggleShowingImports(timeout = 300/*ms*/) {
    var expandedWidth = Math.min(300, Math.max(200, this.ui.importsList.listItemContainer.width)),
        enable = !this.isShowingImports(),
        newWidth = enable ? expandedWidth : -expandedWidth,
        column = this.layout.grid.col(2);
    this.layout.disable();
    column.width += newWidth;
    column.before.width -= newWidth;
    this.layout.enable(timeout ? {duration: timeout} : null);
    (enable ? this.ui.importsList : this.ui.sourceEditor).focus();
    return promise.delay(timeout);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // accessing
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  get isObjectEditor() { return true; }

  get systemInterface() {
    return this.editorPlugin.evalEnvironment.systemInterface;
  }

  sourceDescriptorFor(klass) { return RuntimeSourceDescriptor.for(klass); }

  classChainOfTarget() {
    return withSuperclasses(this.target.constructor);
  }

  async toggleWindowStyle(animated = true) {
    let duration = 300, theme, styleClasses, window = this.getWindow();
    if ((await this.editorPlugin.runEval("System.get('@system-env').node")).value) {
      styleClasses = [...arr.without(window.styleClasses, 'local'), 'node'];
      theme = DarkTheme.instance;
    } else {
      styleClasses = ['local', ...arr.without(window.styleClasses, 'node')];
      theme = DefaultTheme.instance;
    }
    this.editorPlugin.theme = theme;
    if (animated) {
      window.animate({ duration, styleClasses });
      this.ui.sourceEditor.animate({
        fill: theme.background, duration
      });
    } else {
      window.styleClasses = styleClasses;
    }
    this.ui.sourceEditor.textString = this.ui.sourceEditor.textString; 
    this.editorPlugin.highlight();
  }

  async selectTarget(target, evalEnvironment) {
    this.context = await ObjectEditorContext.for(target, this, evalEnvironment);
    if (await this.withContextDo(ctx => !ctx.target.isMorph)) this.ui.publishButton.disable();
    else this.ui.publishButton.enable();
    if (await this.withContextDo(ctx => !ctx.target.constructor[Symbol.for("lively-module-meta")].package.name))
       this.ui.openInBrowserButton.disable();
    else this.ui.openInBrowserButton.enable();
    this.ui.classTree.treeData = await this.withContextDo(ctx => ctx.classTreeData);
    await this.selectClass(this.context.selectedClassName);
    // toggle the node style
    this.toggleWindowStyle();
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // update
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  async withContextDo(fn, varMapping) {
    return await this.context.withContextDo(fn, varMapping);
  }

  async update({className, treeData}, keepCursor = false) {
    let {
          ui: {sourceEditor: ed, classTree: tree}
        } = this,
        oldPos = ed.cursorPosition;
    
    await tree.maintainViewStateWhile(
      () => tree.treeData = treeData,
      node => node.isClass ? node.target : node.name);

    if (className && !tree.selectedNode) await this.selectClass(className);

    if (keepCursor) ed.cursorPosition = oldPos;
  }

  async refresh(keepCursor = false) {
    let data = await this.withContextDo(async (ctx) => {
      let res = {
        className: ctx.selectedClass && ctx.selectedClass.name,
        methodName: ctx.selectedMethod && ctx.selectedMethod.name
      };
      await ctx.refresh();
      res.treeData = ctx.classTreeData;
      return res;
    });

    await this.update(data, keepCursor);
  }

  async updateKnownGlobals() {
    const declaredNames = await this.withContextDo(async (ctx) => {
      let declaredNames = [],
          klass = ctx.selectedClass;
    
      if (klass) {
        let descr = ctx.sourceDescriptorFor(klass);
        ({declaredNames} = await descr.declaredAndUndeclaredNames);
      }

      Object.assign(ctx.evalEnvironment, {knownGlobals: declaredNames});
    
      return declaredNames;
    });
    // keep both evaluation environments in sync
    Object.assign(this.editorPlugin.evalEnvironment, {knownGlobals: declaredNames});
    this.editorPlugin.highlight();
  }

  async updateSource(source, targetModule = "lively://object-editor/" + this.id) {
    let ed = this.ui.sourceEditor,
        format = await this.withContextDo(async (ctx) => {
          let { systemInterface: system }  = ctx.evalEnvironment,
              format = (await system.moduleFormat(targetModule)) || "esm";
          Object.assign(ctx.evalEnvironment, {targetModule, format});
          return format;
        }, {
          targetModule
        });
    if (ed.textString != source)
      ed.textString = source;
    Object.assign(this.editorPlugin.evalEnvironment, {targetModule, format});
    const hashCode = string.hashCode(source);
    await this.withContextDo((ctx) => {
       ctx.moduleChangeWarning = null;
       ctx.sourceHash = hashCode;
    }, { hashCode });
    await this.clearLocalProperties();
    this.indicateNoUnsavedChanges();
  }

  async clearLocalProperties() {
    await this.withContextDo((ctx) => {
      let { properties } = ctx.target.propertiesAndPropertySettings();
      for (let prop in properties) {
        if (ctx.target.hasOwnProperty(prop)) {
          if (ctx.target[prop] && ctx.target[prop].isConnectionWrapper) continue;
          if (ctx.hasOwnProperty("$$" + prop)) delete ctx.target[prop];
        }
      }
    })
  }

  indicateUnsavedChanges() {
    Object.assign(this.ui.sourceEditor, {border: {width: 1, color: Color.red}});
  }

  indicateNoUnsavedChanges() {
    Object.assign(this.ui.sourceEditor, {border: {width: 1, color: Color.gray}});
  }

  async hasUnsavedChanges() {
    return (await this.withContextDo(ctx => ctx.sourceHash)) !== string.hashCode(this.ui.sourceEditor.textString);
  }

  updateUnsavedChangeIndicatorDebounced() {
    fun.debounceNamed(this.id + "-updateUnsavedChangeIndicatorDebounced", 20,
      () => this.updateUnsavedChangeIndicator())();
  }

  async updateUnsavedChangeIndicator() {
    this[(await this.hasUnsavedChanges()) ? "indicateUnsavedChanges" : "indicateNoUnsavedChanges"]();
  }


  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // system events
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // this moves completely into the context

  async reactToModuleChange(newClassSource) {
    const ed = this.ui.sourceEditor;
    if (await this.hasUnsavedChanges()) {
      if (string.hashCode(ed.textString) !== string.hashCode(newClassSource)) {
        await this.withContextDo((ctx) => ctx.addModuleChangeWarning());
        return;
      }
    }
    await this.refresh(true);
  }

  async onModuleChanged(evt) {
    if (!this.context || this.context.isRemote) return;
    let newClassSource = await this.context.onModuleChanged(evt);
    if (newClassSource) this.reactToModuleChange(newClassSource)
  }

  onModuleLoaded(evt) {
    this.onModuleChanged(evt);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // classes and method ui
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  async browse(spec) {
    let {
      target, // can be string
      className,
      methodName,
      textPosition,
      scroll,
      classTreeScroll,
      evalEnvironment
    } = spec;

    if (target) await this.selectTarget(target, evalEnvironment);

    if (!className) className = await this.withContextDo((ctx) => {
      return ctx.selectedClass.name
    })
    if (className && methodName) await this.selectMethod(className, methodName, false);
    else if (className) await this.selectClass(className);

    var {classTree, sourceEditor} = this.ui;
    if (scroll) sourceEditor.scroll = scroll;
    if (textPosition) sourceEditor.cursorPosition = textPosition;
    if (classTreeScroll) classTree.scroll = classTreeScroll;

    return this;
  }

  async browseSpec(complete = true) {
    let {
      ui: {
        classTree: {scroll: classTreeScroll},
        sourceEditor: {scroll, cursorPosition: textPosition}
      }
    } = this,
      { className, methodName } = await this.withContextDo(ctx => {
        let className = ctx.selectedClass && ctx.selectedClass.name,
            methodName = ctx.selectedMethod && ctx.selectedMethod.name;
        return { className, methodName }
      });

    return {
      target: this.context.target,
      className,
      methodName,
      evalEnvironment: this.context.evalEnvironment,
      ...complete ? {scroll, textPosition, classTreeScroll} : {}
    };
  }

  onClassTreeSelection(node) {
    if (!node) { return; }

    if (obj.isString(node.target) || isClass(node.target)) {
      this.selectClass(node.target);
      return;
    }

    let tree = this.ui.classTree,
        parentNode = tree.treeData.parentNode(node),
        isClick = !!Path("env.eventDispatcher.eventState.clickedOnMorph").get(this);
    this.selectMethod(parentNode.target, node.target, isClick);
  }

  contextMenuForClassTree({node, evt}) {
    evt.stop();
    if (!node || !node.target) return;
    let klass = isClass(node.target) ? node.target :
      node.target.owner && isClass(node.target.owner) ? node.target.owner :
        obj.isString(node.target) ? node.target : null;

    let items = [];

    if (klass) {
      items.push({command: "open browse snippet", target: this});
    }

    if (obj.isString(klass) ? this.context.selectedClassName === klass : this.context.selectedClass === klass) {
      let adoptByItems = [];
      klass.name !== "Morph" && adoptByItems.push({alias: "by superclass", command: "adopt by superclass", target: this});
      adoptByItems.push({alias: "by custom class...", command: "adopt by another class", target: this});
      items.push(["adopt by...", adoptByItems]);
    }

    return this.world().openWorldMenu(evt, items);
  }

  async selectClass(klass) {
    if (this._updatingTree) return;
    let tree = this.ui.classTree;
    let className = typeof klass === 'string' ? klass : klass.name;
    if (this.context.selectedClassName != className) {
      if (tree.selectedNode && await this.hasUnsavedChanges() && this.ui.sourceEditor.textString) {
        let proceed = await this.warnForUnsavedChanges();
        if (!proceed) {
          let node = tree.nodes.find(ea => !ea.isRoot && ea.isClass && ea.klass.name === this.context.selectedClassName);
          this._updatingTree = true;
          tree.selectedNode = node;
          this._updatingTree = false;
          return;
        }
      }
      await this.context.selectClass(className);    
    }
    if (await this.withContextDo((ctx) => isObjectClass(ctx.selectedClass)))
      this.ui.forkPackageButton.enable();
    else this.ui.forkPackageButton.disable(); 
    // fetch data from context
    let descr = await this.withContextDo((ctx) => {
      const descr = ctx.sourceDescriptorFor(ctx.selectedClass);
      return {
        source: descr.source,
        moduleId: descr.module.id,
      }
    })

    await this.updateSource(await descr.source, descr.moduleId);
    await this.updateKnownGlobals();
    await this.updateTitle();
    await this.ui.importController.setModule(descr.moduleId)
    
    if (!tree.selectedNode || tree.selectedNode.target !== klass) {
      let node = tree.nodes.find(ea => !ea.isRoot && ea.isClass && ea.name === klass);
      tree.selectedNode = node;
    }
  }

  async selectMethod(klass, methodSpec, highlight = true, putCursorInBody = false) { 
    const className = klass.name || klass;
    if (!methodSpec.name) methodSpec = {name: methodSpec};
    const methodNode = await this.context.selectMethod(className, methodSpec);
    
    if (!methodNode) {
      this.setStatusMessage(`Cannot find method ${methodSpec.name}`);
      return;
    }

    await this.updateTitle();

    var tree = this.ui.classTree,
        differentClassSelected = await this.withContextDo(ctx => 
           ctx.selectedClass.name !== className, { className });
    if (differentClassSelected || !tree.selectedNode)
      await this.selectClass(klass);
    
    await tree.uncollapse(tree.selectedNode);
    if (!tree.selectedNode || tree.selectedNode.target !== methodSpec) {
      var node = tree.nodes.find(ea => 
         !ea.isClass && 
         !ea.isRoot &&
         ea.target.owner === klass && 
         ea.target.name === methodSpec.name);
      tree.selectedNode = node;
      tree.scrollSelectionIntoView();
    }

    var ed = this.ui.sourceEditor,
        cursorPos = ed.indexToPosition(putCursorInBody ?
          methodNode.value.body.start+1 : methodNode.key.start);
    ed.cursorPosition = cursorPos;
    ed.scrollCursorIntoView();

    var methodRange = {
      start: ed.indexToPosition(methodNode.start),
      end: ed.indexToPosition(methodNode.end)
    };
    ed.centerRange(methodRange);
    if (highlight) {
      ed.flash(methodRange, {id: "method", time: 1000, fill: ed.selectionColor || Color.blue.withA(.2)});
    }
    this.selectedMethodName = methodSpec.name;
  }

  async updateTitle() {
    let win = this.getWindow();
    if (!win) return;
    let title = "ObjectEditor";
    title += await this.withContextDo((ctx) => ctx.getTitle());
    let url = this.systemInterface.coreInterface.url;
    title += url ? ` [${url}]` : '';
    win.title = title;
    win.relayoutWindowControls();
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // command support
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  async doSave() {
    let {ui: {sourceEditor}} = this;
    if (await this.withContextDo((ctx) => !ctx.selectedClass))
       return {success: false, reason: "No class selected"};

    // Ask user what to do with undeclared variables. If this gets canceled we
    // abort the save
    if (config.objectEditor.fixUndeclaredVarsOnSave) {
      let fixed = await this.execCommand("[javascript] fix undeclared variables");
      if (!fixed) return {success: false, reason: "Save canceled"};
    }

    let content = sourceEditor.textString;
    content = await this.withContextDo((ctx) => {
      let {
        selectedModule, selectedClass, selectedMethod,
      } = ctx;
  
      let descr = this.sourceDescriptorFor(selectedClass),
          parsed = parse(content);
  
      // ensure that the source is a class declaration
      if (parsed.body.length !== 1 || parsed.body[0].type !== "ClassDeclaration") {
        return {
          success: false,
          reason: `Code is expected to contain the class definition of ${selectedClass}, aborting save.`
        };
      }
  
      // we do not support renaming classes by changing the source (yet?)
      let classDecl = parsed.body[0],
          className = content.slice(classDecl.id.start, classDecl.id.end);
      if (className !== selectedClass.name) {
        content = content.slice(0, classDecl.id.start) + selectedClass.name + content.slice(classDecl.id.end);
      }
      return content;
    }, {
      content
    });

    const editorSourceHash = string.hashCode(content),
          {sourceChanged, outsideChangeWarning, selectedModuleId} = await this.withContextDo((ctx) => {
      // moduleChangeWarning is set when the context gets notified that the
      // current module was changed elsewhere (onModuleChanged) and it also has
      // unsaved changes
      let {sourceHash, moduleChangeWarning, selectedModule} = ctx,
          sourceChanged = sourceHash !== editorSourceHash
      return {
        selectedModuleId: selectedModule.id,
        sourceChanged, 
        outsideChangeWarning: moduleChangeWarning === selectedModule.id}
    }, {
      editorSourceHash
    });

    if (sourceChanged && outsideChangeWarning) {
      var really = await this.world().confirm(
        ["Simultaneous Change Warning\n", {},
        `The module ${selectedModuleId} you are trying to save changed elsewhere!\nOverwrite those changes?`, {
          fontSize: 16, fontWeight: 'normal'
        }], { requester: this});
      if (!really) return {success: false, reason: "Save canceled"};
      await this.withContextDo(ctx => ctx.moduleChangeWarning = null)
    }

    this.backupSourceInLocalStorage(content);

     try {
        await this.withContextDo(async (ctx) => {
           ctx.isSaving = true;
           await this.sourceDescriptorFor(ctx.selectedClass).changeSource(content);
        }, {content})
       await sourceEditor.saveExcursion(async () => {
         await this.refresh();
       });
       await this.withContextDo((ctx) => {
         ctx.updatePackageConfig(sourceChanged);   
       }, { sourceChanged });
      return {success: true};
     } finally { 
       await this.withContextDo(ctx => ctx.isSaving = false);
       this.updateSource(content, selectedModuleId);
     }
 
  }

  backupSourceInLocalStorage(source) {
    var store = JSON.parse(localStorage.getItem("oe helper") || "{\"saves\": []}");
    if (store.saves.some(ea => typeof ea === "string" ? ea === source : ea.source === source)) return;
    if (store.saves.length > 100) store.saves = store.saves.slice(40, 100);
    store.saves.push({source, time: Date.now()});
    localStorage.setItem("oe helper", JSON.stringify(store));
  }

  async interactivelyAddObjectPackageAndMethod() {
    let objPkgName, className, methodName, stringifiedTarget;
    try {
      ({ objPkgName, className, stringifiedTarget } = await this.withContextDo((ctx) => {
        const pkg = ObjectPackage.lookupPackageForObject(ctx.target);
        return { 
          objPkgName: pkg && pkg.id,
          className: ctx.target.constructor.name, 
          stringifiedTarget: ctx.target.toString() }
      }));
      
      if (!objPkgName) {
        objPkgName = await this.world().prompt(
          ['New Object Package\n', {},
           `No object package exists yet for object `, { fontSize: 16, fontWeight: 'normal'},
           stringifiedTarget, { fontSize: 16, fontStyle: 'italic', fontWeight: 'normal'},
          "\nEnter a name for a new package:", { fontSize: 16, fontWeight: 'normal'}], {
            historyId: "object-package-name-hist",
            requester: this,
            input: string.capitalize(className).replace(/\s+(.)/g, (_, match) => match.toUpperCase())
          });

        if (!objPkgName) { this.setStatusMessage("Canceled"); return; }
        await this.withContextDo(async (ctx) => {
           const pkg = ObjectPackage.withId(objPkgName);
           await pkg.adoptObject(ctx.target);
        }, {objPkgName});
      }
      ({ className, methodName} = await this.withContextDo(async ctx => {
        const {methodName} = await ctx.addNewMethod();
        return {
          methodName, className: ctx.target.constructor.name
        }
      }));
      await this.refresh();
      await this.selectMethod(className, methodName, true, true);
      this.focus();
    } catch (e) {
      this.showError(e);
    }
  }

  async interactivelyRemoveMethodOrClass() {
    let {selectedMethod, selectedClass} = await this.withContextDo(ctx => ({
      selectedMethod: ctx.selectedMethod.name,
      selectedClass: ctx.selectedClass.name
    }));
    if (selectedMethod) return this.interactivelyRemoveMethod();
    if (selectedClass) return this.interactivelyAdoptBySuperclass();
  }

  async interactivelyAdoptByClass() {
    let items = await this.withContextDo(async (ctx) => {
      let { systemInterface: system } = ctx.evalEnvironment;
      let modules = await system.getModules();
      let items = [];
      for (let mod of modules) {
        // mod = modules[0]
        let pkg = await system.getPackageForModule(mod.name),
            shortName = pkg ? pkg.name + "/" + system.shortModuleName(mod.name, pkg)
              : mod.name;
  
  
        let realModule = module(mod.name);
        if (realModule.format() !== "esm" && realModule.format() !== "register")
          continue;
  
        let imports = (await realModule.imports()).map(ea => ea.local);
        const { Morph } = ctx.target.isMorph ? await System.import('lively.morphic') : {};
        let klassDefs = (await realModule.scope()).classDecls.map(klass => klass.id.name);
        let klasses = obj.values(realModule.recorder).filter(ea =>
          isClass(ea) && !imports.includes(ea.name) && klassDefs.includes(ea.name) &&
          (ctx.target.isMorph ? withSuperclasses(ea).includes(Morph) : true));
  
        for (let klass of klasses) {
          items.push({
            isListItem: true, string: `${shortName} ${klass.name}`, 
            value: {moduleName: mod.name, className: klass.name}});
        }
      }
      return items;
    });

    let {selected: [klassAndModule]} = await $world.filterableListPrompt(
      "From which class should the target object inherit?", items, {requester: this});

    if (!klassAndModule) return;

    await this.withContextDo((ctx) => {
      const { moduleName, className } = klassAndModule,
             klass = module(moduleName).recorder[className];
      adoptObject(ctx.target, klass);
    }, {
      klassAndModule
    })
    this.refresh();
    this.selectClass(klassAndModule.className);
  }

  async interactivelyAdoptBySuperclass() {
    const {nextClassName, className, targetName, moduleMeta, nextModuleMeta} = await this.withContextDo((ctx) => {
      let {target: t} = ctx,
           klass = t.constructor;
      if (klass === Morph) return {}; // this is a weird exception but makes sense in general
      let nextClass = withSuperclasses(klass)[1];
      return {
        moduleMeta: klass[Symbol.for("lively-module-meta")],
        nextModuleMeta: nextClass[Symbol.for("lively-module-meta")],
        nextClassName: nextClass.name,
        className: klass.name, targetName: t.name
      }  
    });
    let generateDoit = (meta, entity) => ({
      textDecoration: 'underline',
      doit: {code: `$world.execCommand("open browser", {moduleName: "${meta.package.name + '/' + meta.pathInPackage}", codeEntity: "${entity}"})`}
    });
    if (nextClassName) {
      let normalStyle = {fontWeight: 'normal', fontSize: 16};
      let highlightStyle = {fontWeight: 'normal', fontStyle: 'italic', fontSize: 16};
      const really = await this.world().confirm([
        'Class Hierarchy Change\n', {},
        `Do you really want to make `, normalStyle, 
        `"${targetName}"`, highlightStyle,
        ` an instance of `, normalStyle,
        nextClassName, {...highlightStyle, ...generateDoit(nextModuleMeta, nextClassName)},
        ' and remove class ', normalStyle, 
        className, {...highlightStyle, ...generateDoit(moduleMeta, className)}, 
        ` and its package `, normalStyle,
        moduleMeta.package.name, highlightStyle, ' ?', normalStyle], { requester: this });
      if (!really) return;
      await this.withContextDo((ctx) => {
         adoptObject(ctx.target, withSuperclasses(ctx.target.constructor)[1]);
      });
      this.refresh(); 
      this.selectClass(nextClassName);
    }
  }

  async interactivelyRemoveMethod() {
    if (await this.withContextDo(ctx => !ctx.selectedMethod)) return;
    let parsed = this.editorPlugin.parse().body[0];
    let {methodNode, selectedMethodName} = await this.withContextDo(async (ctx) => {
      let { selectedMethod, selectedClass } = ctx;
      return {
        selectedMethodName: selectedMethod.name,
        methodNode: await ctx._sourceDescriptor_of_class_findMethodNode(
            selectedClass, selectedMethod.name, selectedMethod.kind, selectedMethod.static, parsed)
      };
    }, { parsed });

    if (!selectedMethodName) return; 

    if (!methodNode) {
      this.showError(`Cannot find AST node for method ${selectedMethodName}`);
      return;
    }

    var really = await this.world().confirm(
      `Really remove method ${selectedMethodName}?`);
    if (!really) return;

    let ed = this.ui.sourceEditor,
        range = {start: ed.indexToPosition(methodNode.start), end: ed.indexToPosition(methodNode.end)};
    if (!ed.textInRange({start: {column: 0, row: range.start.row}, end: range.start}).trim()) {
      range.start = ed.lineRange(range.start.row-1).end;
    }
    ed.replace(range, "");

    await this.doSave();
  }

  async interactivelyForkPackage() {
    let forkedName = await this.world().prompt([
      "New Forked Package\n", {},
      "Please enter a name for the forked class and its package:", {
        fontSize: 16, fontWeight: 'normal'}], {
          requester: this,
          input: await this.withContextDo(ctx => ctx.target.constructor.name) + "Fork",
          historyId: "lively.morphic-object-editor-fork-names",
          useLastInput: false
        });
    if (!forkedName) return;
    let newClassName = await this.withContextDo(async (ctx) => {
      await ctx.forkPackage(forkedName);
    }, { forkedName });
    await this.browse({target: this.context.target, selectedClass: newClassName });

  }

  async interactivlyFixUndeclaredVariables() {
    let moduleId, origSource, content;
    try {
      let { ui: {sourceEditor}} = this;
      if (!await this.withContextDo(ctx => ctx.selectedClass && ctx.selectedClass.name)) {
        this.showError(new Error("No class selected"));
        return null;
      }

      content = sourceEditor.textString;
      ({ moduleId, origSource } = await this.withContextDo((ctx) => {
        const {selectedClass, selectedMethod} = ctx;
        let descr = ctx.sourceDescriptorFor(selectedClass),
            m = descr.module,
            origSource = descr.moduleSource;

        ctx.isSaving = true;
        return { moduleId: m.id, origSource }
      }));

      return await interactivlyFixUndeclaredVariables(sourceEditor, {
        requester: sourceEditor,
        sourceUpdater: async (type, arg) => {
          await this.withContextDo(async (ctx) => {
            const descr = ctx.sourceDescriptorFor(ctx.selectedClass),
                  m = descr.module;
            if (type === "import") await m.addImports(arg);
            else if (type === "global") await m.addGlobalDeclaration(arg);
            else throw new Error(`Cannot handle fixUndeclaredVar type ${type}`);
            descr.resetIfChanged();
          }, { type, arg })
          await this.ui.importController.updateImports();
          await this.updateKnownGlobals();
        },
        sourceRetriever: async () => this.withContextDo((ctx) => {
          const descr = ctx.sourceDescriptorFor(ctx.selectedClass);
          return descr._modifiedSource(content).moduleSource
        }, {
          content: sourceEditor.textString
        }),
        highlightUndeclared: async undeclaredVar => {
          // start,end index into module source, compensate
          let {start: varStart, end: varEnd} = undeclaredVar,
              { classStart, classEnd } = await this.withContextDo((ctx) => {
                const descr = ctx.sourceDescriptorFor(ctx.selectedClass),
                      {sourceLocation: {start: classStart, end: classEnd}} = descr;
                return { classStart, classEnd }
              });
          if (varStart < classStart || varEnd > classEnd) return;
          varStart -= classStart;
          varEnd -= classStart;
          let range = {
            start: sourceEditor.indexToPosition(varStart),
            end: sourceEditor.indexToPosition(varEnd)};
          sourceEditor.selection = range;
          sourceEditor.centerRange(range);
        }
      });

    } catch (e) {
      await this.withContextDo(async () => 
         origSource && await module(moduleId).changeSource(origSource), {
            moduleId, origSource
         });
      this.showError(e);
      return null;
    } finally {
      await this.withContextDo(ctx => ctx.isSaving = false)
      await this.ui.importController.updateImports();
      await this.updateKnownGlobals();
      this.ui.sourceEditor.focus();
    }
  }

  async interactivelyAddImport() {
    let origSource, {
      ui: {importController, sourceEditor},
      editorPlugin
    } = this;

    try {
      
      if (await this.withContextDo(ctx => !ctx.selectedClass)) {
        this.showError(new Error("No class selected"));
        return;
      }

      var system = await editorPlugin.systemInterface(),
          choices = await interactivelyChooseImports(system, { requester: this });
      if (!choices) return null;

      // FIXME move this into system interface!
      origSource = await this.withContextDo(async (ctx) => {
        const origSource = await ctx.selectedModule.source();
        ctx.isSaving = true;
        await ctx.selectedModule.addImports(choices);
        return origSource;
      }, {
        choices
      })

      let insertions = choices.map(({local, exported}) =>
        exported === "default" ? local : exported);
      sourceEditor.insertTextAndSelect(
        insertions.join("\n"),
        sourceEditor.cursorPosition);

    } catch (e) {
      await this.withContextDo(async (ctx) => 
         origSource && await ctx.selectedModule.changeSource(origSource), {
        origSource  
      })
      this.showError(e);
    } finally {
      await importController.updateImports();
      await this.updateKnownGlobals();
      await this.withContextDo(async (ctx) => {
         ctx.isSaving = false
      });
      sourceEditor.focus();
    }
  }

  async interactivelyRemoveImport() {
    var sels = this.ui.importsList.selections;
    if (!sels || !sels.length) return;
    var really = await this.world().confirm([
      "Really remove these imports?\n", {},
      arr.pluck(sels, "local").join("\n"), { fontWeight: 'normal', fontSize: 16}]);
    if (!really) return;
    const error = await this.withContextDo(async (ctx) => {
      try {
        var m = ctx.selectedModule;
        var origSource = await m.source();
        await m.removeImports(sels); 
        return false;
      } catch(e) {
        origSource && await m.changeSource(origSource);
        return e;
      }
    }, { sels });
    this.ui.importsList.selection = null;
    if (error) this.showError(error);
    await this.ui.importController.updateImports();
    await this.updateKnownGlobals();
    this.ui.sourceEditor.focus();
  }

  async interactivelyRemoveUnusedImports() {
    try {
      const origSource = await this.withContextDo(async ctx => {
             return await ctx.selectedModule.source();
           }),
           toRemove = await chooseUnusedImports(origSource, { requester: this });

      if (!toRemove || !toRemove.changes || !toRemove.changes.length) {
        this.setStatusMessage("Nothing to remove");
        return;
      }

      await this.withContextDo((ctx) => {
        ctx.selectedModule.removeImports(toRemove.removedImports)
      }, { toRemove });
      this.setStatusMessage("Imports removed");
    } catch (e) {
      origSource && await this.withContextDo(ctx => 
        ctx.selectedModule.changeSource(origSource), {
        origSource
      });
      this.setStatusMessage(e.toString());
      return;
    }
    await this.ui.importController.updateImports();
    await this.updateKnownGlobals();
    this.ui.sourceEditor.focus();
  }

  async interactivelyRunSelectedMethod(opts = {}) {
    const { statusMessage } = await this.withContextDo(async (ctx) => {
      var selectedMethod = ctx.selectedMethod;

      if (!selectedMethod) {
        return { statusMessage: "no message selected" };
      }
  
      if (typeof ctx.target[selectedMethod.name] !== "function") {
        return { statusMessage: `${selectedMethod.name} is not a method of ${this.target}` };
      }
  
      try {
        var result = await ctx.target[selectedMethod.name]();
        var msg = `Running ${selectedMethod.name}`;
        if (typeof result !== "undefined") msg += `, returns ${result}`;
        return { statusMessage: msg }
      } catch (e) { 
        return { statusMessage: e.toString()}
      }
    });
    if (statusMessage && !opts.silent) this.setStatusMessage(statusMessage);
  }

  async browseClass(klass) {
    let className, moduleName;
    if (klass) {
       ({ name: className, module: {id: moduleName} } = this.context.sourceDescriptorFor(klass));
    } else {
      ({ className, moduleName } = await this.withContextDo(ctx => {
        if (!ctx.selectedClass) return {};
        const desc = ctx.sourceDescriptorFor(ctx.selectedClass);
        return {
          className: desc.name,
          moduleName: desc.module.id
        }
      }));
    }
    if (moduleName && className)
      return this.world().execCommand("open browser",
        {moduleName, codeEntity: {name: className}, systemInterface: this.systemInterface});
    this.setStatusMessage("No class specified"); return true;

  }

  browseSnippetForSelection() {
    // produces a string that, when evaluated, will open the browser at the
    // same location it is at now
    let c = this.context.selectedClassName,
        m = this.selectedMethod,
        mod = this.selectedModule,
        t = this.target;

    let codeSnip = "$world.execCommand(\"open object editor\", {";
    codeSnip += `target: ${t.generateReferenceExpression()}`;
    if (c) codeSnip += `, selectedClass: "${c}"`;
    if (m && c) codeSnip += `, selectedMethod: "${m.name}"`;
    codeSnip += "});";

    return codeSnip;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // events
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  focus() {
    let {importsList, sourceEditor} = this.ui;
    (this.isShowingImports() ? importsList : sourceEditor).focus();
  }

  async warnForUnsavedChanges() {
    return await this.world().confirm(['Before you Continue\n', {},
          `Unsaved changes to this class will be discarded. Are you sure you want to proceed?`, {
          fontWeight: 'normal',
          fontSize: 16
        }], { requester: this });
  }

  get keybindings() {
    return [
      {keys: "F1", command: "focus class tree"},
      {keys: "F2", command: "focus code editor"},
      {keys: "F3", command: "toggle showing imports"},
      {keys: {mac: "Command-S", win: "Ctrl-S"}, command: "save source"},
      {keys: {mac: "Command-Shift-=", win: "Ctrl-Shift-="}, command: "add method"},
      {keys: {mac: "Command-Shift--", win: "Ctrl-Shift--"}, command: "remove method or class"},
      {keys: "Ctrl-Shift-R", command: "run selected method"},
      {keys: "Alt-R", command: "refresh"},
      {keys: {win: "Ctrl-B", mac: "Meta-B"}, command: "open class in system browser"},
      {keys: "Alt-Shift-T", command: "choose target"},
      {keys: "Alt-J", command: "jump to definition"},
      {keys: "Ctrl-C I", command: "[javascript] inject import"},
      {keys: "Ctrl-C C I", command: "[javascript] fix undeclared variables"},
    ].concat(super.keybindings);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // interactive commands
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  get commands() {
    return [

      {
        name: "focus class tree",
        exec: ed => { var m = ed.ui.classTree; m.show(); m.focus(); return true; }
      },

      {
        name: "focus code editor",
        exec: ed => { var m = ed.ui.sourceEditor; m.show(); m.focus(); return true; }
      },

      {
        name: "refresh",
        exec: async ed => {
          await ed.withContextDo(ctx => {
            var klass = ctx.selectedClass;
            if (klass) {
              var descr = ctx.sourceDescriptorFor(klass);
              descr.module.reset();
              descr.reset();
            }  
          })
          await ed.refresh(true);
          ed.setStatusMessage("reloaded");
          return true;
        }
      },

      {
        name: "[javascript] inject import",
        exec: async ed => { await ed.interactivelyAddImport(); return true; }
      },

      {
        name: "[javascript] fix undeclared variables",
        exec: async ed => ed.interactivlyFixUndeclaredVariables()
      },

      {
        name: "[javascript] removed unused imports",
        exec: async ed => { await ed.interactivelyRemoveUnusedImports(); return true; }
      },

      {
        name: "toggle showing imports",
        exec: async ed => { await ed.toggleShowingImports(); return true; }
      },

      {
        name: "add method",
        exec: async ed => { await ed.interactivelyAddObjectPackageAndMethod(); return true; }
      },

      {
        name: "remove method or class",
        exec: async ed => { await ed.interactivelyRemoveMethodOrClass(); return true; }
      },

      {
        name: "adopt by superclass",
        exec: async ed => { await ed.interactivelyAdoptBySuperclass(); return true; }
      },

      {
        name: "adopt by another class",
        exec: async ed => { await ed.interactivelyAdoptByClass(); return true; }
      },

      {
        name: "run selected method",
        exec: async ed => { await ed.interactivelyRunSelectedMethod(); return true; }
      },

      {
        name: "jump to definition",
        exec: async ed => {

          var tree = ed.ui.classTree,
              td = tree.treeData,
              classNodes = td.getChildren(td.root).slice(),
              items = arr.flatmap(classNodes.reverse(), node => {
                var klass = node.target,
                    methods = td.getChildren(node);

                return [{
                  isListItem: true,
                  string: klass,
                  value: {node, selector: "selectClass", klass}
                }].concat(
                  methods.map(ea => {
                    return {
                      isListItem: true,
                      label: [
                        `${klass}`, {
                          fontSize: "80%",
                          textStyleClasses: ["v-center-text"],
                          paddingRight: "10px"
                        },
                        `${ea.name}`, null
                      ],
                      value: {node: ea, selector: "selectMethod", klass}
                    };
                  })
                );
              });

          var {selected: [choice]} = await ed.world().filterableListPrompt(
            "select class or method", items,
            {
              historyId: "lively.morphic-object-editor-jump-def-hist",
              requester: ed
            });

          if (choice) {
            await ed[choice.selector](choice.klass, choice.node.target);
            ed.ui.sourceEditor.focus();
            tree.scrollSelectionIntoView();
            if (choice.selector == 'selectClass') ed.ui.sourceEditor.scroll = pt(0,0);
          }
          return true;
        }
      },

      {
        name: "save source",
        exec: async ed => {
          try {
            let {success, reason} = await ed.doSave();
            ed.setStatusMessage(success ? "saved" : reason, success ? Color.green : null);
          } catch (e) { ed.showError(e); }
          return true;
        }
      },

      {
        name: "open class in system browser",
        exec: async (ed, opts = {klass: null}) => {
          return ed.browseClass(opts.klass);
        }
      },

      {
        name: "open object inspector for target",
        exec: async ed => {
          return ed.world().execCommand("open object inspector", {target: ed.target});
        }
      },

      {
        name: 'freeze target',
        exec: async ed => {
          try {
            await interactivelyFreezePart(ed.target, ed);
          } catch(e) {
            if (e === "canceled") this.setStatusMessage("canceled");
            else this.showError(e);
          }
        }
      },

      {
        name: 'show frozen parts',
        exec: async ed => {
          await displayFrozenPartsFor($world.getCurrentUser(), ed);
        }
      },

      {
        name: "publish target to PartsBin",
        exec: async ed => {
          try {
            let commit = await interactivelySavePart(ed.target, {notifications: false, loadingIndicator: true});
            this.setStatusMessage(
              commit ?
                `Published ${this.target} as ${commit.name}` :
                `Failed to publish part ${ed.target}`,
              commit ? Color.green : Color.red);
          } catch (e) {
            if (e === "canceled") this.setStatusMessage("canceled");
            else this.showError(e);
          }
        }
      },

      {
        name: "choose target",
        exec: async ed => {
          /*global inspect*/
          if (ed.env.eventDispatcher.isKeyPressed("Shift")) {
            // support remote morph selection
            if (ed.context.isRemote) {
               ed._loadingIndicator = LoadingIndicator.open('Connecting to Remote...');
               await ed.withContextDo(async ctx => {
                  // REMOTE START
                  if (!ctx.target.isMorph) return;
                  let selectionFn = async (title, items, opts) => {
                     // ensure the tiems are ids
                     let editorCallback = stringifyFunctionWithoutToplevelRecorder(async ed => {
                       // LOCAL START
                       ed._loadingIndicator.remove();
                       let res = await ed.world().filterableListPrompt(title, items, opts);
                       ed._loadingIndicator = LoadingIndicator.open('Switching Target...');
                       return res;
                       // LOCAL END
                     })
                     let res = await ctx.withEditorDo(editorCallback, {
                       items: items.map(item => { item.value = item.value.id; return item; }),
                       title,
                       opts
                     }); // insert stringified params
                     let { selected, action } = res;
                     selected = selected.map(id => $world.getMorphWithId(id));
                     return { selected, action };
                  };
                  let [selected] = await $world.execCommand("select morph", {
                    selectionFn,
                    justReturn: true,
                    root: [ctx.target, ...ctx.target.ownerChain()].find(m => m.owner.isWorld)
                  });
                  if (selected) {
                    await ctx.selectTarget(selected);
                  }
                  // REMOTE END
               });
               await ed.refresh();
               ed._loadingIndicator.remove();
               return;
            }
            let [selected] = await $world.execCommand("select morph", {
              justReturn: true, 
              root: [ed.target, ...ed.target.ownerChain()].find(m => m.owner.isWorld)
            });
            if (selected) ed.selectTarget(selected);
          } else {
            let selected = await InteractiveMorphSelector.selectMorph(ed.world());
            if (selected) ed.selectTarget(selected);
          }

          ed.focus();
          return ed.target;
        }
      },

      {
        name: "open browse snippet",
        exec: oe =>
          oe.world().execCommand("open workspace",
            {content: oe.browseSnippetForSelection(), language: "javascript"})
      }
    ];
  }
}

class ImportController extends Morph {

  static get properties() {
    return {
      extent: {defaultValue: pt(300,600)},
      systemInterface: {
        get() {
          return this.get('object-editor').systemInterface;
        }
      },
      module: {
        set(moduleOrId) {
          var id = !moduleOrId ? null : typeof moduleOrId === "string" ? moduleOrId : moduleOrId.id;
          this.setProperty("module", id);
        }
      }
    };
  }

  constructor(props) {
    super(props);
    this.build();
    connect(this.get('openButton'), "fire", this, "execCommand", {
      converter: () => "open selected module in system browser"});
  }

  async setModule(moduleId) {
    this.module = moduleId;
    await this.updateImports();
  }

  build() {
    var listStyle = {
          borderWidthTop: 1, borderWidthBottom: 1,
          borderColor: Color.gray,
          fontSize: 14, fontFamily: "Helvetica Neue, Arial, sans-serif",
          type: "list"
        },

        btnStyle = {
          type: "button",
          extent: pt(26,24),
        };

    this.submorphs = [
      {...listStyle, name: "importsList", multiSelect: true, borderBottom: {width: 1, color: Color.gray}},
      {name: "buttons", fill: Color.transparent, layout: new HorizontalLayout({direction: "centered", spacing: 2}),
        submorphs: [
          {...btnStyle, name: "addImportButton", label: Icon.makeLabel("plus"), tooltip: "add new import"},
          {...btnStyle, name: "removeImportButton", label: Icon.makeLabel("minus"), tooltip: "remove selected import(s)"},
          {...btnStyle, name: "cleanupButton", label: "cleanup", tooltip: "remove unused imports"},
          {...btnStyle, name: "openButton", label: "open", tooltip: "open selected module"}
        ]},
    ];

    this.layout = new GridLayout({
      grid: [
        ["importsList"],
        ["buttons"]
      ]});
    this.layout.row(1).fixed = 30;
    this.applyLayoutIfNeeded();

    // FIXME
    [this.get("openButton"),
      this.get("cleanupButton"),
      this.get("removeImportButton"),
      this.get("addImportButton")].forEach(btn => btn.extent = btnStyle.extent);
  }

  async updateImports() {
    // this needs to be done within the context, since there
    // currently is no remote tracking of module objects
    let items = await this.get('object-editor').withContextDo(async (ctx) => {
      let module = await ctx.selectedModule;
      if (!module) {
        return [];
      }

      let imports = await module.imports(),
          items = imports.map(ea => {
            var label = [];
            var alias = ea.local !== ea.imported && ea.imported !== "default" ? ea.local : null;
            if (alias) label.push(`${ea.imported} as `, {});
            label.push(alias || ea.local || "??????", {fontWeight: "bold"});
            label.push(` from ${ea.fromModule}`);
            return {isListItem: true, value: ea, label};
          });
       return items;
    }); 

    this.getSubmorphNamed("importsList").items = items;
  }

  get keybindings() {
    return [
      {keys: "Enter", command: "open selected module in system browser"}
    ].concat(super.keybindings);
  }

  get commands() {
    return [{
      name: "open selected module in system browser",
      exec: async importController => {
        let importSpec = this.getSubmorphNamed("importsList").selection;
        if (!importSpec) {
          this.setStatusMessage("no module selected");
          return null;
        }
        let {fromModule, local} = importSpec || {};
        if (fromModule.startsWith("."))
          fromModule = System.decanonicalize(fromModule, this.module);
        return this.world().execCommand("open browser",
          {moduleName: fromModule, codeEntity: local});
      }
    }];
  }

}
