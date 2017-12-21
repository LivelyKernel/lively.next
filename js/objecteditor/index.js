/*global System,localStorage*/
import { arr, obj, t, Path, string, fun, promise } from "lively.lang";
import { Icon, Morph, HorizontalLayout, GridLayout, config } from "lively.morphic";
import { pt, Color } from "lively.graphics";
import JavaScriptEditorPlugin from "../editor-plugin.js";
import { withSuperclasses, lexicalClassMembers, isClass } from "lively.classes/util.js";
import { TreeData, Tree } from "lively.components";
import { connect } from "lively.bindings";
import { RuntimeSourceDescriptor } from "lively.classes/source-descriptors.js";
import ObjectPackage, { addScript, isObjectClass } from "lively.classes/object-classes.js";
import { chooseUnusedImports, interactivlyFixUndeclaredVariables, interactivelyChooseImports } from "../import-helper.js";
import { module, getPackage, semver } from "lively.modules";
import { parse } from "lively.ast";
import { interactivelySavePart } from "lively.morphic/partsbin.js";

import { LinearGradient } from "lively.graphics/index.js";
import { adoptObject } from "lively.classes/runtime.js";
import { InteractiveMorphSelector } from "lively.halos/morph.js";
import { interactivelyFreezePart } from "lively.freezer/part.js";


// var oe = ObjectEditor.open({target: this})

// var tree = oe.get("classTree");
// tree.treeData = new ClassTreeData(this.constructor);
// var td = oe.get("classTree").treeData
// oe.remove()

// td.getChildren(td.root)
// td.collapse(td.getChildren(td.root)[0], false)
// tree.update()
// td.isCollapsed(td.getChildren(td.root)[2])
// tree.onNodeCollapseChanged(td.root)

// var x = new ClassTreeData(this.constructor)
// x.getChildren(x.root)
// x.getChildren(x.getChildren(x.root)[1])

// tree.selection = x.getChildren(x.root)[2]

class ClassTreeData extends TreeData {

  constructor(target) {
    super({
      target,
      name: "root",
      isRoot: true,
      isCollapsed: false
    });
  }

  display(node) {
    if (!node) return "empty";

    if (node.isRoot)
      return node.target.name || node.target.id || "root object";

    // class
    if (isClass(node.target))
      return node.target.name;

    // method

    return node.name || "no name";
  }

  isLeaf(node) { if (!node) return true; return !node.isRoot && !isClass(node.target); }
  isCollapsed(node) { return !node || node.isCollapsed; }
  collapse(node, bool) { node && (node.isCollapsed = bool); }

  getChildren(node) {
    if (!node) return [];
    // if (node.isCollapsed) return [];

    if (node.isRoot) {
      if (node.children) return node.children;
      var classes = arr.without(withSuperclasses(node.target), Object).reverse();
      return node.children = classes.map(klass => ({target: klass, isCollapsed: true}));
    }

    if (isClass(node.target)) {
      try {
        return node.children
          || (node.children = lexicalClassMembers(node.target).map(ea => {
            var {static: _static, name, kind} = ea;
            var prefix = "";
            if (_static) prefix += "static ";
            if (kind === "get") prefix += "get ";
            if (kind === "set") prefix += "set ";
            return {name: prefix + name, target: ea};
          }));
      } catch (e) { $world.showError(e); return node.children = []; }
    }

    return [];
  }

}


export class ObjectEditor extends Morph {

  static async open(options = {}) {
    let {
      title,
      target,
      className: selectedClass,
      methodName: selectedMethod,
      textPosition,
      scroll,
      classTreeScroll,
      backend
    } = options;

    var ed = new this(obj.dissoc(options, "title", "class", "method")),
        winOpts = {name: "ObjectEditor window", title: options.title || "ObjectEditor"},
        win = (await ed.openInWindow(winOpts)).activate();
    await win.whenRendered();
    if (target) ed.browse({
      title,
      target,
      selectedClass,
      selectedMethod,
      textPosition,
      scroll,
      classTreeScroll,
      backend
    });
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

      state: {
        serialize: false,
        initialize() {
          this.state = {
            isSaving: false,
            target: null,
            selectedClass: null,
            selectedMethod: null
          };
        }
      },

      backend: {
        after: ["editorPlugin"], derived: true,
        get() { return this.editorPlugin.evalEnvironment.remote || "local"; },
        set(remote) { this.editorPlugin.evalEnvironment.remote = remote; }
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
        after: ["submorphs"],
        set(obj) { this.selectTarget(obj); }
      },

      selectedModule: {
        derived: true, readOnly: true, after: ["target"],
        get() {
          var mid = this.editorPlugin.evalEnvironment.targetModule;
          return mid ? module(mid) : null;
        }
      },

      selectedClass: {
        derived: true, readOnly: true, after: ["state"],
        get() { return this.state.selectedClass; }
      },

      selectedMethod: {
        derived: true, readOnly: true, after: ["state"],
        get() { return this.state.selectedMethod; }
      }

    };

  }

  constructor(props) {
    super({...props, submorphs: this.build()});
    this.reset();
    this.ui.forkPackageButton.disable();
  }

  get ui() {
    return {
      freezeButton:        this.getSubmorphNamed("freezeMorphButton"),
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
    l.row(0).fixed = 28;
    l.row(2).fixed = 30;
    // var oe = ObjectEditor.open({target: this})

    // l.col(2).fixed = 100; l.row(0).paddingTop = 1; l.row(0).paddingBottom = 1;

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
      freezeButton
    } = this.ui;

    connect(inspectObjectButton, "fire", this, "execCommand", {converter: () => "open object inspector for target"});
    connect(publishButton, "fire", this, "execCommand", {converter: () => "publish target to PartsBin"});
    connect(chooseTargetButton, "fire", this, "execCommand", {converter: () => "choose target"});
    connect(freezeButton, 'fire', this, 'execCommand', {converter: () => "freeze target"});

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
      backend,
      selectedClass,
      selectedMethod,
      target
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

    // save essential state
    snapshot.props._serializedState = {
      verbatim: true,
      value: {
        selectedClass: selectedClass ? selectedClass.name : null,
        selectedMethod: selectedMethod ? selectedMethod.name : null,
        textPosition: sourceEditor.cursorPosition,
        scroll: sourceEditor.scroll,
        classTreeScroll: classTree.scroll,
        backend
      }
    };

  }

  async onLoad() {
    this.reset();
    if (this._serializedState) {
      var s = this._serializedState;
      delete this._serializedState;
      await this.browse(s);
    }
  }

  rebuild() {
    let spec = this.browseSpec();
    this.submorphs = this.build();
    this.reset();
    this.browse(spec);
  }

  build() {
    var listStyle = {
          // borderWidth: 1, borderColor: Color.gray,
          fontSize: 14, fontFamily: "Helvetica Neue, Arial, sans-serif"
        },

        textStyle = {
          borderLeft: {width: 1, color: Color.gray},
          borderRight: {width: 1, color: Color.gray},
          borderBottom: {width: 1, color: Color.gray},
          lineWrapping: "by-chars",
          type: "text",
          ...config.codeEditor.defaultStyle,
        },

        topBtnStyle = {
          type: "button",
          fill: new LinearGradient({
            stops: [
              {offset: 0, color: Color.white},
              {offset: 1, color: new Color.rgb(236,240,241)}]}),
          border: {color: Color.gray, style: "solid", radius: 5},
          nativeCursor: "pointer",
          extent: pt(26,24),
        },

        btnStyle = {
          type: "button",
          fill: Color.white,
          border: {color: Color.lightGray, style: "solid", radius: 5},
          nativeCursor: "pointer",
          extent: pt(26,24),
        };

    return [
      {name: "objectCommands",
        fill: Color.transparent, reactsToPointer: false,
        layout: new HorizontalLayout({direction: "centered", spacing: 2, autoResize: false}),
        submorphs: [
          {...topBtnStyle, name: "inspectObjectButton", fontSize: 14, label: Icon.textAttribute("gears"), tooltip: "open object inspector"},
          {...topBtnStyle, name: "publishButton", fontSize: 14, label: Icon.textAttribute("cloud-upload"), tooltip: "publish object to PartsBin"},
          {...topBtnStyle, name: "chooseTargetButton", fontSize: 14, label: Icon.textAttribute("crosshairs"), tooltip: "select another target"},
          {...topBtnStyle, name: "freezeMorphButton", fontSize: 14, label: Icon.textAttribute("snowflake-o"), tooltip: "export a static version of target"}
        ]},

      {type: Tree, name: "classTree", treeData: new ClassTreeData(null),
        ...listStyle,
        borderTop: {width: 1, color: Color.gray},
        borderBottom: {width: 1, color: Color.gray}},

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
        borderLeft: {width: 1, color: Color.gray},
        borderRight: {width: 1, color: Color.gray},
        layout: new GridLayout({
          rows: [0, {paddingTop: 2, paddingBottom: 2}],
          columns: [
            1, {paddingRight: 1, fixed: 30},
            2, {paddingLeft: 1, fixed: 30},
            4, {paddingRight: 2, fixed: 74}
          ],
          grid: [[null, "saveButton", "runMethodButton", null, "toggleImportsButton"]]}),
        submorphs: [
          {...btnStyle, name: "saveButton", fontSize: 18, label: Icon.makeLabel("save"), tooltip: "save"},
          {...btnStyle, name: "runMethodButton", fontSize: 18, label: Icon.makeLabel("play-circle-o"), tooltip: "execute selected method"},
          {...btnStyle, name: "toggleImportsButton", label: "imports", tooltip: "toggle showing imports", isLayoutable: false, bottomRight: pt(1000, 50)}
        ]},

      new ImportController({name: "importController"})
    ];
  }

  isShowingImports() { return this.get("importsList").width > 10; }

  toggleShowingImports(timeout = 300/*ms*/) {
    var expandedWidth = Math.min(300, Math.max(200, this.get("importsList").listItemContainer.width)),
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

  async systemInterface() {
    var livelySystem = await System.import("lively-system-interface"),
        remote = this.backend;
    return !remote || remote === "local" ?
      livelySystem.localInterface :
      livelySystem.serverInterfaceFor(remote);
  }

  sourceDescriptorFor(klass) { return RuntimeSourceDescriptor.for(klass); }

  classChainOfTarget() {
    return withSuperclasses(this.target.constructor);
  }

  selectTarget(t) {
    this.setProperty("target", t);
    this.state.selectedClass = null;
    this.state.selectedMethod = null;
    this.ui.classTree.treeData = new ClassTreeData(t.constructor);

    Object.assign(this.editorPlugin.evalEnvironment, {
      context: this.target,
      format: "esm"
    });

    return this.selectClass(t.constructor);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // update
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  async refresh(keepCursor = false) {
    var {
          state: {selectedClass, selectedMethod},
          ui: {sourceEditor: ed, classTree: tree}
        } = this,
        oldPos = ed.cursorPosition;

    await tree.maintainViewStateWhile(
      () => this.selectTarget(this.target),
      node => node.target ?
        node.target.name
                  + node.target.kind
                  + (node.target.owner ? `.${node.target.owner.name}` : "") :
        node.name);

    if (selectedClass && selectedMethod && !tree.selectedNode) {
      // method rename, old selectedMethod does no longer exist
      await this.selectClass(selectedClass);
    }

    if (keepCursor) ed.cursorPosition = oldPos;
  }

  async updateKnownGlobals() {
    let declaredNames = [],
        klass = this.selectedClass;

    if (klass) {
      let descr = this.sourceDescriptorFor(klass);
      ({declaredNames} = await descr.declaredAndUndeclaredNames);
    }
    Object.assign(this.editorPlugin.evalEnvironment, {knownGlobals: declaredNames});
    this.editorPlugin.highlight();
  }

  async updateSource(source, targetModule = "lively://object-editor/" + this.id) {
    let ed = this.get("sourceEditor"),
        system = await this.systemInterface(),
        format = (await system.moduleFormat(targetModule)) || "esm";
    if (ed.textString != source)
      ed.textString = source;
    Object.assign(this.editorPlugin.evalEnvironment, {targetModule, format});
    this.state.sourceHash = string.hashCode(source);
    this.indicateNoUnsavedChanges();
    this.state.moduleChangeWarning = null;
  }

  indicateUnsavedChanges() {
    Object.assign(this.ui.sourceEditor, {border: {width: 1, color: Color.red}});
  }

  indicateNoUnsavedChanges() {
    Object.assign(this.ui.sourceEditor, {border: {width: 1, color: Color.gray}});
  }

  hasUnsavedChanges() {
    return this.state.sourceHash !== string.hashCode(this.ui.sourceEditor.textString);
  }

  updateUnsavedChangeIndicatorDebounced() {
    fun.debounceNamed(this.id + "-updateUnsavedChangeIndicatorDebounced", 20,
      () => this.updateUnsavedChangeIndicator())();
  }

  updateUnsavedChangeIndicator() {
    this[this.hasUnsavedChanges() ? "indicateUnsavedChanges" : "indicateNoUnsavedChanges"]();
  }


  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // system events
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  async onModuleChanged(evt) {
    if (this.state.isSaving) return;

    var m = module(evt.module),
        {selectedModule, selectedClass} = this,
        ed = this.get("sourceEditor");

    if (!selectedModule || selectedModule.id !== m.id)
      return;

    if (this.hasUnsavedChanges()) {
      var newClassSource = await this.sourceDescriptorFor(selectedClass).source;
      if (string.hashCode(ed.textString) !== string.hashCode(newClassSource)) {
        this.addModuleChangeWarning(m.id);
        this.state.sourceHash = string.hashCode(newClassSource);
        return;
      }
    }

    await this.refresh(true);
  }

  onModuleLoaded(evt) {
    this.onModuleChanged(evt);
  }

  addModuleChangeWarning(mid) {
    this.state.moduleChangeWarning = mid;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // classes and method ui
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  async browse(spec) {
    let {
      target,
      selectedClass,
      selectedMethod,
      textPosition,
      scroll,
      classTreeScroll,
      backend
    } = spec;

    if (backend !== this.backend) this.backend = backend;

    if (target) await this.selectTarget(this.target);

    if (selectedMethod && !selectedClass) selectedClass = this.target.constructor;
    if (selectedClass && selectedMethod) await this.selectMethod(selectedClass, selectedMethod, false);
    else if (selectedClass) await this.selectClass(selectedClass);

    var {classTree, sourceEditor} = this.ui;
    if (scroll) sourceEditor.scroll = scroll;
    if (textPosition) sourceEditor.cursorPosition = textPosition;
    if (classTreeScroll) classTree.scroll = classTreeScroll;

    return this;
  }

  browseSpec(complete = true) {
    let {
      target,
      selectedClass,
      selectedMethod,
      backend,
      ui: {
        classTree: {scroll: classTreeScroll},
        sourceEditor: {scroll, cursorPosition: textPosition}
      }
    } = this;

    return {
      target,
      selectedClass,
      selectedMethod,
      backend,
      ...complete ? {scroll, textPosition, classTreeScroll} : {}
    };
  }

  onClassTreeSelection(node) {
    if (!node) { return; }

    if (isClass(node.target)) {
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
        null;

    let items = [];

    if (klass) {
      items.push({command: "open browse snippet", target: this});
    }

    if (this.target.constructor === klass) {
      let adoptByItems = [];
      klass.name !== "Morph" && adoptByItems.push({alias: "by superclass", command: "adopt by superclass", target: this});
      adoptByItems.push({alias: "by custom class...", command: "adopt by another class", target: this});
      items.push(["adopt by...", adoptByItems]);
    }

    return this.world().openWorldMenu(evt, items);
  }

  async selectClass(klass) {
    let tree = this.ui.classTree;

    if (typeof klass === "string") {
      klass = this.classChainOfTarget().find(ea => ea.name === klass);
    }

    if (!tree.selectedNode || tree.selectedNode.target !== klass) {
      let node = tree.nodes.find(ea => !ea.isRoot && ea.target === klass);
      tree.selectedNode = node;
    }

    let descr = this.sourceDescriptorFor(klass);
    await this.updateSource(await descr.source, descr.module.id);

    this.state.selectedMethod = null;
    this.state.selectedClass = klass;

    this.ui.importController.module = descr.module;
    await this.updateKnownGlobals();

    if (isObjectClass(klass)) this.ui.forkPackageButton.enable();
    else this.ui.forkPackageButton.disable();

    this.updateTitle();
  }

  async selectMethod(klass, methodSpec, highlight = true, putCursorInBody = false) {
    if (typeof methodSpec === "string") methodSpec = {name: methodSpec};
    if (typeof klass === "string") klass = this.classChainOfTarget().find(ea => ea.name === klass);

    if (klass && !methodSpec && isClass(klass.owner)) {
      methodSpec = klass;
      klass = klass.owner;
    }

    var tree = this.ui.classTree;
    if (this.state.selectedClass !== klass || !tree.selectedNode)
      await this.selectClass(klass);

    await tree.uncollapse(tree.selectedNode);
    if (!tree.selectedNode || tree.selectedNode.target !== methodSpec) {
      var node = tree.nodes.find(ea => ea.target.owner === klass && ea.target.name === methodSpec.name);
      tree.selectedNode = node;
      tree.scrollSelectionIntoView();
    }

    let method = await this._sourceDescriptor_of_class_findMethodNode(
      klass, methodSpec.name, methodSpec.kind, methodSpec.static);

    this.state.selectedMethod = methodSpec;

    this.updateTitle();

    if (!method) {
      this.setStatusMessage(`Cannot find method ${methodSpec.name}`);
      return;
    }


    var ed = this.get("sourceEditor"),
        cursorPos = ed.indexToPosition(putCursorInBody ?
          method.value.body.start+1 : method.key.start);
    ed.cursorPosition = cursorPos;
    this.world() && await ed.whenRendered();
    ed.scrollCursorIntoView();

    var methodRange = {
      start: ed.indexToPosition(method.start),
      end: ed.indexToPosition(method.end)
    };
    ed.centerRange(methodRange);
    if (highlight) {
      ed.flash(methodRange, {id: "method", time: 1000, fill: Color.rgb(200,235,255)});
      // ed.alignRowAtTop(undefined, pt(0, -20))
    }
  }

  updateTitle() {
    let win = this.getWindow();
    if (!win) return;
    let title = "ObjectEditor";
    let {
      selectedClass,
      selectedMethod,
      selectedModule
    } = this;


    let p = getPackage(selectedClass[Symbol.for("lively-module-meta")].package.name);


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

    win.title = title;
    win.relayoutWindowControls();
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // command support
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  async doSave() {
    let {
      selectedModule, selectedClass, selectedMethod,
      ui: {sourceEditor}, state} = this;

    if (!selectedClass) {
      return {success: false, reason: "No class selected"};
    }

    // Ask user what to do with undeclared variables. If this gets canceled we
    // abort the save
    if (config.objectEditor.fixUndeclaredVarsOnSave) {
      let fixed = await this.execCommand("[javascript] fix undeclared variables");
      if (!fixed) return {success: false, reason: "Save canceled"};
    }

    let descr = this.sourceDescriptorFor(selectedClass),
        content = sourceEditor.textString,
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

    // moduleChangeWarning is set when this browser gets notified that the
    // current module was changed elsewhere (onModuleChanged) and it also has
    // unsaved changes
    let {sourceHash, moduleChangeWarning} = state,
        sourceChanged = sourceHash !== string.hashCode(content);
    if (sourceChanged && moduleChangeWarning === selectedModule.id) {
      var really = await this.world().confirm(
        `The module ${selectedModule.id} you are trying to save changed elsewhere!\nOverwrite those changes?`);
      if (!really) return {success: false, reason: "Save canceled"};
      state.moduleChangeWarning = null;
    }

    this.backupSourceInLocalStorage(content);

    state.isSaving = true;
    try {
      await descr.changeSource(content);
      await sourceEditor.saveExcursion(async () => {
        await this.refresh();
        await this.updateSource(sourceEditor.textString, selectedModule.id);
      });
      if (isObjectClass(selectedClass) && sourceChanged) {
        var pkg = descr.module.package(),
            packageConfig = {...pkg.config, version: semver.inc(pkg.version, "prerelease", true)},
            system = await this.editorPlugin.systemInterface(),
            mod = system.getModule(pkg.url + "/package.json");
        system.packageConfChange(JSON.stringify(packageConfig, null, 2), mod.id);
      }
      return {success: true};
    } finally { this.state.isSaving = false; }
  }

  backupSourceInLocalStorage(source) {
    var store = JSON.parse(localStorage.getItem("oe helper") || "{\"saves\": []}");
    if (store.saves.some(ea => typeof ea === "string" ? ea === source : ea.source === source)) return;
    if (store.saves.length > 100) store.saves = store.saves.slice(40, 100);
    store.saves.push({source, time: Date.now()});
    localStorage.setItem("oe helper", JSON.stringify(store));
  }

  async interactivelyAddObjectPackageAndMethod() {
    try {
      // let input = await this.world().prompt("Enter method name",
      //                   {historyId: "object-editor-method-name-hist"});
      // if (!input) return;
      let t = this.target,
          pkg = ObjectPackage.lookupPackageForObject(t);

      if (!pkg) {
        let objPkgName = await this.world().prompt(
          `No object package exists yet for object ${t}.\n`
        + "Enter a name for a new package:", {
            historyId: "object-package-name-hist",
            input: string.capitalize(t.name).replace(/\s+(.)/g, (_, match) => match.toUpperCase())
          });

        if (!objPkgName) { this.setStatusMessage("Canceled"); return; }
        pkg = ObjectPackage.withId(objPkgName);
        await pkg.adoptObject(t);
      }

      let {methodName} = await addScript(t, "function() {}", "newMethod");
      await this.refresh();
      await this.selectMethod(t.constructor, {name: methodName}, true, true);
      this.focus();
    } catch (e) {
      this.showError(e);
    }
  }

  async interactivelyRemoveMethodOrClass() {
    let {selectedMethod, selectedClass} = this;
    if (selectedMethod) return this.interactivelyRemoveMethod();
    if (selectedClass) return this.interactivelyAdoptBySuperclass();
  }

  async interactivelyCreateObjectPackage() {
    try {
      let input = await this.world().prompt(`Creating an package definition for ${this.target}.\nPlease enter a name for the package:`,
        {historyId: "object-package-creation-name-hist"});
      // if (!input) return;
      // let input = "newMethod",
      //     {methodName} = await addScript(this.target, "function() {}", input);
      // await this.refresh();
      // await this.selectMethod(this.target.constructor, {name: methodName}, true, true);
      // this.focus();
    } catch (e) {
      this.showError(e);
    }
  }

  async interactivelyAdoptByClass() {
    let system = this.editorPlugin.systemInterface();
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
      let klasses = obj.values(realModule.recorder).filter(ea =>
        isClass(ea) && !imports.includes(ea.name) && withSuperclasses(ea).includes(Morph));

      for (let klass of klasses) {
        items.push({isListItem: true, string: `${shortName} ${klass.name}`, value: {module: mod, klass}});
      }

    }

    let {selected: [klassAndModule]} = await $world.filterableListPrompt(
      "From which class should the target object inherit?", items, {requester: this});

    if (!klassAndModule) return;

    let target = this.target;
    adoptObject(target, klassAndModule.klass);
    this.refresh();
  }

  async interactivelyAdoptBySuperclass() {
    let {target: t} = this,
        klass = t.constructor;
    if (klass === Morph) return;
    let nextClass = withSuperclasses(t.constructor)[1],
        {package: {name: packageName}} = klass[Symbol.for("lively-module-meta")],
        really = await this.world().confirm(`Do you really want to make ${t} an instance of `
                                            + `${nextClass.name} and remove class ${klass.name} `
                                            + `and its package ${packageName}?`);
    if (!really) return;
    adoptObject(t, nextClass);
    this.refresh();
  }

  async interactivelyRemoveMethod() {
    let { selectedMethod, selectedClass } = this.state;
    if (!selectedMethod) return;
    let parsed = this.editorPlugin.parse().body[0],
        methodNode = await this._sourceDescriptor_of_class_findMethodNode(
          selectedClass, selectedMethod.name, selectedMethod.kind, selectedMethod.static, parsed);

    if (!methodNode) {
      this.showError(`Cannot find AST node for method ${selectedMethod.name}`);
      return;
    }

    var really = await this.world().confirm(
      `Really remove method ${selectedMethod.name}?`);
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
    let t = this.target,
        klass = t.constructor,
        nextClass = withSuperclasses(klass)[1],
        {package: {name: packageName}} = klass[Symbol.for("lively-module-meta")],
        forkedName = await this.world().prompt("Enter a name for the forked class and its package", {
          requester: this,
          input: klass.name + "Fork",
          historyId: "lively.morphic-object-editor-fork-names",
          useLastInput: false
        });

    if (!forkedName) return;

    let pkg = ObjectPackage.lookupPackageForObject(t),
        {baseURL, System} = pkg,
        forkedPackage = await pkg.fork(forkedName, {baseURL, System});
    await adoptObject(t, forkedPackage.objectClass);
    await this.browse({target: t, selectedClass: forkedPackage.objectClass});

  }

  async interactivlyFixUndeclaredVariables() {
    try {
      let {state: {selectedClass, selectedMethod}, ui: {sourceEditor}} = this;
      if (!selectedClass) {
        this.showError(new Error("No class selected"));
        return null;
      }

      let descr = this.sourceDescriptorFor(selectedClass),
          m = descr.module,
          origSource = descr.moduleSource;

      this.state.isSaving = true;

      return await interactivlyFixUndeclaredVariables(sourceEditor, {
        requester: sourceEditor,
        sourceUpdater: async (type, arg) => {
          if (type === "import") await m.addImports(arg);
          else if (type === "global") await m.addGlobalDeclaration(arg);
          else throw new Error(`Cannot handle fixUndeclaredVar type ${type}`);
          descr.resetIfChanged();
          await this.ui.importController.updateImports();
          await this.updateKnownGlobals();
        },
        sourceRetriever: () => descr._modifiedSource(sourceEditor.textString).moduleSource,
        highlightUndeclared: undeclaredVar => {
          // start,end index into module source, compensate
          let {start: varStart, end: varEnd} = undeclaredVar,
              {sourceLocation: {start: classStart, end: classEnd}} = descr;
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
      origSource && await m.changeSource(origSource);
      this.showError(e);
      return null;
    } finally {
      this.state.isSaving = false;
      await this.ui.importController.updateImports();
      await this.updateKnownGlobals();
      this.ui.sourceEditor.focus();
    }
  }

  async interactivelyAddImport() {
    let {
      selectedClass, selectedMethod, selectedModule, state,
      ui: {importController, sourceEditor},
      editorPlugin
    } = this;

    try {
      if (!selectedClass) {
        this.showError(new Error("No class selected"));
        return;
      }

      var system = await editorPlugin.systemInterface(),
          choices = await interactivelyChooseImports(system);
      if (!choices) return null;

      // FIXME move this into system interface!
      var origSource = await selectedModule.source();

      state.isSaving = true;
      await selectedModule.addImports(choices);

      let insertions = choices.map(({local, exported}) =>
        exported === "default" ? local : exported);
      sourceEditor.insertTextAndSelect(
        insertions.join("\n"),
        sourceEditor.cursorPosition);

    } catch (e) {
      origSource && await selectedModule.changeSource(origSource);
      this.showError(e);
    } finally {
      state.isSaving = false;
      await importController.updateImports();
      await this.updateKnownGlobals();
      sourceEditor.focus();
    }
  }

  async interactivelyRemoveImport() {
    try {
      var sels = this.get("importsList").selections;
      if (!sels || !sels.length) return;
      var really = await this.world().confirm(
        "Really remove imports \n" + arr.pluck(sels, "local").join("\n") + "?");
      if (!really) return;
      var m = this.selectedModule;
      var origSource = await m.source();
      await m.removeImports(sels);
      this.get("importsList").selection = null;
    }
    catch (e) {
      origSource && await m.changeSource(origSource);
      this.showError(e);
    }
    finally {
      await this.get("importController").updateImports();
      await this.updateKnownGlobals();
      this.get("sourceEditor").focus();
    }
  }

  async interactivelyRemoveUnusedImports() {
    try {
      var m = this.selectedModule,
          origSource = await m.source(),
          toRemove = await chooseUnusedImports(await m.source());

      if (!toRemove || !toRemove.changes || !toRemove.changes.length) {
        this.setStatusMessage("Nothing to remove");
        return;
      }

      await m.removeImports(toRemove.removedImports);
      this.setStatusMessage("Imports removed");
    } catch (e) {
      origSource && await m.changeSource(origSource);
      this.showError(e);
    }
    finally {
      await this.get("importController").updateImports();
      await this.updateKnownGlobals();
      this.get("sourceEditor").focus();
    }
  }

  async interactivelyRunSelectedMethod(opts = {}) {
    var { selectedMethod } = this.state,
        {silent = false} = opts;

    if (!selectedMethod) {
      !silent && this.setStatusMessage("no message selected");
      return;
    }

    if (typeof this.target[selectedMethod.name] !== "function") {
      !silent && this.setStatusMessage(`${selectedMethod.name} is not a method of ${this.target}`);
      return;
    }

    try {
      var result = await this.target[selectedMethod.name]();
      if (!silent) {
        var msg = `Running ${selectedMethod.name}`;
        if (typeof result !== "undefined") msg += `, returns ${result}`;
        this.setStatusMessage(msg);
      }
    } catch (e) { !silent && this.showError(e); }
  }

  browseSnippetForSelection() {
    // produces a string that, when evaluated, will open the browser at the
    // same location it is at now
    let c = this.selectedClass,
        m = this.selectedMethod,
        mod = this.selectedModule,
        t = this.target;

    let codeSnip = "$world.execCommand(\"open object editor\", {";
    codeSnip += `target: ${t.generateReferenceExpression()}`;
    if (c) codeSnip += `, selectedClass: "${c.name}"`;
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
        exec: ed => { var m = ed.get("classTree"); m.show(); m.focus(); return true; }
      },

      {
        name: "focus code editor",
        exec: ed => { var m = ed.get("sourceEditor"); m.show(); m.focus(); return true; }
      },

      {
        name: "refresh",
        exec: async ed => {
          var klass = ed.state.selectedClass;
          if (klass) {
            var descr = ed.sourceDescriptorFor(klass);
            descr.module.reset();
            descr.reset();
          }
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

          var tree = ed.getSubmorphNamed("classTree"),
              td = tree.treeData,
              classNodes = td.getChildren(td.root).slice(),
              items = arr.flatmap(classNodes.reverse(), node => {
                var klass = node.target,
                    methods = td.getChildren(node);

                return [{
                  isListItem: true,
                  string: klass.name,
                  value: {node, selector: "selectClass"}
                }].concat(
                  methods.map(ea => {
                    return {
                      isListItem: true,
                      label: [
                        `${klass.name}`, {
                          fontSize: "80%",
                          textStyleClasses: ["v-center-text"],
                          paddingRight: "10px"
                        },
                        `${ea.name}`, null
                      ],
                      value: {node: ea, selector: "selectMethod"}
                    };
                  })
                );
              });

          var {selected: [choice]} = await ed.world().filterableListPrompt(
            "select class or method", items,
            {historyId: "lively.morphic-object-editor-jump-def-hist"});

          if (choice) {
            await ed[choice.selector](choice.node.target);
            ed.getSubmorphNamed("sourceEditor").focus();
            tree.scrollSelectionIntoView();
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
          var klass = opts.klass || this.state.selectedClass;
          if (!klass) { ed.setStatusMessage("No class specified"); return true; }
          var descr = ed.sourceDescriptorFor(klass);
          return ed.world().execCommand("open browser",
            {moduleName: descr.module.id, codeEntity: {name: klass.name}});
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
            let frozenFileString = await interactivelyFreezePart(ed.target, {notifications: false, loadingIndicator: true});
            this.world().serveFileAsDownload(frozenFileString, {fileName: ed.target.name + ".js", type: 'application/javascript'});
          } catch(e) {
            if (e === "canceled") this.setStatusMessage("canceled");
            else this.showError(e);
          }
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
            var [selected] = await $world.execCommand("select morph", {justReturn: true});
            if (selected) ed.target = selected;
          } else {
            let selected = await InteractiveMorphSelector.selectMorph(ed.world());
            if (selected) ed.target = selected;
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

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  async _sourceDescriptor_of_class_findMethodNode(klass, methodName, methodKind, isClassMethod = false, ast) {
    let descr = RuntimeSourceDescriptor.for(klass),
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


// new ImportController().openInWorld()
class ImportController extends Morph {

  static get properties() {
    return {
      extent: {defaultValue: pt(300,600)},

      module: {
        get() {
          let id = this.getProperty("module");
          return id ? module(id) : null;
        },
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
    connect(this, "module", this, "updateImports");
    connect(this.getSubmorphNamed("openButton"), "fire", this, "execCommand", {
      converter: () => "open selected module in system browser"});
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
          fontSize: 10,
          fill: Color.white,
          border: {color: Color.lightGray, style: "solid", radius: 5},
          nativeCursor: "pointer",
          extent: pt(26,24),
        };

    this.submorphs = [
      {...listStyle, name: "importsList", multiSelect: true, borderBottom: {width: 1, color: Color.gray}},
      {name: "buttons", layout: new HorizontalLayout({direction: "centered", spacing: 2}),
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
    let {module} = this;
    if (!module) {
      this.getSubmorphNamed("importsList").items = [];
      return;
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
          fromModule = System.decanonicalize(fromModule, this.module.id);
        return this.world().execCommand("open browser",
          {moduleName: fromModule, codeEntity: local});
      }
    }];
  }

}
