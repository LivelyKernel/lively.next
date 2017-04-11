import { arr, t, Path, string, fun } from "lively.lang";
import { Morph, HorizontalLayout, GridLayout, config } from "lively.morphic";
import { pt, Color } from "lively.graphics";
import { JavaScriptEditorPlugin } from "../editor-plugin.js";
import { withSuperclasses, lexicalClassMembers, isClass } from "lively.classes/util.js";
import { Icon } from "lively.morphic/components/icons.js";
import { TreeData, Tree } from "lively.morphic/components/tree.js";
import { connect } from "lively.bindings";
import { RuntimeSourceDescriptor } from "lively.classes/source-descriptors.js";
import ObjectPackage, { addScript, isObjectClass, isObjectClassFor } from "lively.classes/object-classes.js";
import { chooseUnusedImports, interactivelyChooseImports } from "../import-helper.js";
import { module } from "lively.modules";
import { interactivelySaveObjectToPartsBinFolder } from "../../../partsbin.js";
import { emit } from "lively.notifications/index.js";
import { LinearGradient } from "lively.graphics/index.js";
import { adoptObject } from "lively.classes/runtime.js";


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
      return node.target.name || node.target.id || "root object"

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
      return node.children = classes.map(klass => ({target: klass, isCollapsed: true}))
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
    var ed = new this(options),
        winOpts = {name: "ObjectEditor window", title: options.title || "ObjectEditor"},
        win = (await ed.openInWindow(winOpts)).activate();
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
          }
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
        after: ["editorPlugin", "state"], after: ["submorphs"],
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

    }

  }

  constructor(props) {
    super({...props, submorphs: this.build()});
    this.reset();
    this.ui.forkPackageButton.disable();
  }

  get ui() {
    return {
      addImportButton:     this.getSubmorphNamed("addImportButton"),
      addMethodButton:     this.getSubmorphNamed("addMethodButton"),
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
    }
  }

  reset() {
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
      addMethodButton,
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
      toggleImportsButton
    } = this.ui;

    connect(inspectObjectButton, "fire", this, "execCommand", {converter: () => "open object inspector for target"});
    connect(publishButton, "fire", this, "execCommand", {converter: () => "publish target to PartsBin"});
    connect(chooseTargetButton, "fire", this, "execCommand", {converter: () => "choose target"});

    connect(classTree, "selection", this, "onClassTreeSelection");
    connect(addMethodButton, "fire", this, "interactivelyAddMethod");
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
    connect(sourceEditor, "doSave", this, "execCommand", {converter: () => "save source"});

    connect(classTree, "contextMenuRequested", this, "contextMenuForClassTree");
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
    var ref = pool.ref(sourceEditor);
    ref.currentSnapshot.props.textAndAttributes.value = [];
    ref.currentSnapshot.props.attributeConnections.value = [];
    ref.currentSnapshot.props.plugins.value = [];
    ref.currentSnapshot.props.anchors.value =
      ref.currentSnapshot.props.anchors.value.filter(({id}) =>
        id.startsWith("selection-"));
    ref.currentSnapshot.props.savedMarks.value = [];

    var ref = pool.ref(classTree);
    if (ref.currentSnapshot.props.selection)
      ref.currentSnapshot.props.selection.value = null;
    var ref = pool.ref(classTree.nodeItemContainer);
    ref.currentSnapshot.props.submorphs.value = [];
    var ref = pool.ref(classTree.treeData);
    ref.currentSnapshot.props.root.value = {};
    ref.currentSnapshot.props.root.verbatim = true;

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
    }

  }

  async onLoad() {
    this.reset();

    if (this._serializedState) {
      var s = this._serializedState;
      delete this._serializedState;
      await this.browse(s);
    }
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
          lineWrapping: true,
          type: "text",
          ...config.codeEditor.defaultStyle,
        },

        topBtnStyle = {
          type: "button",
          activeStyle: {
            fill: new LinearGradient({stops: [
               {offset: 0, color: Color.white},
               {offset: 1, color: new Color.rgb(236,240,241)}
            ]}),
            border: {color: Color.gray, style: "solid", radius: 5},
            nativeCursor: "pointer"
          },
          extent: pt(26,24),
        },

        btnStyle = {
          type: "button",
          activeStyle: {
            fill: Color.white,
            border: {color: Color.lightGray, style: "solid", radius: 5},
            nativeCursor: "pointer"
          },
          extent: pt(26,24),
        };

    return [
      {name: "objectCommands",
       fill: Color.transparent, reactsToPointer: false,
       layout: new HorizontalLayout({direction: "centered", spacing: 2}),
       submorphs: [
         {...topBtnStyle, name: "inspectObjectButton", fontSize: 18, label: Icon.makeLabel("gears"), tooltip: "open object inspector"},
         {...topBtnStyle, name: "publishButton", fontSize: 18, label: Icon.makeLabel("cloud-upload"), tooltip: "publish object to PartsBin"},
         {...topBtnStyle, name: "chooseTargetButton", fontSize: 18, label: Icon.makeLabel("crosshairs"), tooltip: "select another target"},
       ]},

      {type: Tree, name: "classTree", treeData: new ClassTreeData(null),
       borderTop: {width: 1, color: Color.gray},
       borderBottom: {width: 1, color: Color.gray}},

      {name: "classAndMethodControls",
       layout: new HorizontalLayout({direction: "centered", spacing: 2}), submorphs: [
         {...btnStyle, name: "addMethodButton", label: Icon.makeLabel("plus"), tooltip: "add a new method"},
         {...btnStyle, name: "forkPackageButton", fontSize: 14, label: Icon.makeLabel("code-fork"), tooltip: "fork package"},
         {...btnStyle, name: "openInBrowserButton", fontSize: 14, label: Icon.makeLabel("external-link"), tooltip: "open selected class in system browser"},
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
          grid: [[null, 'saveButton', 'runMethodButton', null, 'toggleImportsButton']]}),
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
    var expandedWidth = Math.min(300, Math.max(150, this.get("importsList").listItemContainer.width)),
        enable = !this.isShowingImports(),
        newWidth = enable ? expandedWidth : -expandedWidth,
        column = this.layout.grid.col(2)
    this.layout.disable();
    column.width += newWidth;
    column.before.width -= newWidth;
    this.layout.enable(timeout ? {duration: timeout} : null);
    (enable ? this.ui.importsList : this.ui.sourceEditor).focus();
    return lively.lang.promise.delay(timeout);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // accessing
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  get isObjectEditor() { return true }

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

    if (selectedClass && selectedMethod && !tree.selection) {
      // method rename, old selectedMethod does no longer exist
      await this.selectClass(selectedClass);
    }

    if (keepCursor) ed.cursorPosition = oldPos;
  }

  async updateKnownGlobals() {
    var declaredNames = [], klass = this.state.selectedClass;
    if (klass) {
      var descr = this.sourceDescriptorFor(klass);
      ({declaredNames} = await descr.declaredAndUndeclaredNames);
    }
    Object.assign(this.editorPlugin.evalEnvironment, {
      knownGlobals: declaredNames,
    });
    this.editorPlugin.highlight();
  }

  async updateSource(source, targetModule = "lively://object-editor/" + this.id) {
    // targetModule = ed.evalEnvironment.targetModule

    let ed = this.get("sourceEditor"),
        system = await this.systemInterface(),
        format = (await system.moduleFormat(targetModule)) || "esm";
        // [_, ext] = moduleId.match(/\.([^\.]+)$/) || [];
// await lively.modules.module(targetModule).reset()
// await lively.modules.module(targetModule).source()
// await system.moduleRead(targetModule)

    if (ed.textString != source)
      ed.textString = source;
    Object.assign(this.editorPlugin.evalEnvironment, {targetModule, format});
    this.state.sourceHash = string.hashCode(source);
    this.indicateNoUnsavedChanges();
    this.state.moduleChangeWarning = null;
  }

  indicateUnsavedChanges() {
    Object.assign(this.get("sourceEditor"), {
      border: {width: 1, color: Color.red}
    })
  }

  indicateNoUnsavedChanges() {
    Object.assign(this.get("sourceEditor"), {
      border: {width: 1, color: Color.gray},
    });
  }

  hasUnsavedChanges() {
    return this.state.sourceHash !== string.hashCode(this.get("sourceEditor").textString);
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

    if (selectedClass && selectedMethod) await this.selectMethod(selectedClass, selectedMethod, false);
    else if (selectedClass) await this.selectClass(selectedClass);

    var {classTree, sourceEditor} = this.ui
    if (scroll) sourceEditor.scroll = scroll;
    if (textPosition) sourceEditor.cursorPosition = textPosition;
    if (classTreeScroll) classTree.scroll = classTreeScroll;

    return this;
  }

  onClassTreeSelection(node) {
    if (!node) { return; }

    if (isClass(node.target)) {
      this.selectClass(node.target);
      return;
    }

    let tree = this.ui.classTree,
        parentNode = tree.treeData.parentNode(node),
        isClick = !!this.env.eventDispatcher.eventState.clickedOnMorph;
    this.selectMethod(parentNode.target, node.target, isClick);
  }

  contextMenuForClassTree({nodeMorph, evt}) {
    evt.stop();
    let node = nodeMorph && nodeMorph.myNode;
    if (!node || !node.target) return;
    let klass = isClass(node.target) ? node.target :
      node.target.owner && isClass(node.target.owner) ? node.target.owner :
        null;

    let items = [], t = this.target;
    if (klass) {
      // FIXME!!!!
      if (t.constructor === klass && klass.name !== "Morph") {
        items.push([`remove ${klass.name}`, async () => {
          let nextClass = withSuperclasses(t.constructor)[1],
              {package: {name: packageName}} = klass[Symbol.for("lively-module-meta")],
              really = await $world.confirm(`Do you really want to make ${t} an instance of ${nextClass.name} and remove class ${klass.name} and its package ${packageName}?`)
          if (!really) return;
          adoptObject(t, nextClass);
          this.refresh();
        }]);
      
      }
    }

    return this.world().openWorldMenu(evt, items);
  }

  async selectClass(klass) {
    let tree = this.ui.classTree;

    if (typeof klass === "string") {
      klass = this.classChainOfTarget().find(ea => ea.name === klass);
    }

    if (!tree.selection || tree.selection.target !== klass) {
      let node = tree.nodes.find(ea => !ea.isRoot && ea.target === klass);
      tree.selection = node;
    }

    let descr = this.sourceDescriptorFor(klass);
    await this.updateSource(await descr.source, descr.module.id);

    this.state.selectedMethod = null;
    this.state.selectedClass = klass;

    this.ui.importController.module = descr.module;
    await this.updateKnownGlobals();

    if (isObjectClass(klass)) this.ui.forkPackageButton.enable();
    else this.ui.forkPackageButton.disable();
  }

  async selectMethod(klass, methodSpec, highlight = true, putCursorInBody = false) {
    if (typeof methodSpec === "string") methodSpec = {name: methodSpec};

    if (klass && !methodSpec && isClass(klass.owner)) {
      methodSpec = klass;
      klass = klass.owner
    }

    var tree = this.get("classTree");
    if (this.state.selectedClass !== klass || !tree.selection)
      await this.selectClass(klass);

    await tree.uncollapse(tree.selection);
    if (!tree.selection || tree.selection.target !== methodSpec) {
      var node = tree.nodes.find(ea => ea.target.owner === klass && ea.target.name === methodSpec.name);
      tree.selection = node;
      tree.scrollSelectionIntoView();
    }

    let descr = RuntimeSourceDescriptor.for(klass),
        parsed = await descr.ast,
        methods = Path("body.body").get(parsed),
        method = methods.find(({kind, key: {name}}) => {
          if (name !== methodSpec.name) return false;
          if (!methodSpec.kind || (methodSpec.kind !== "get" && methodSpec.kind !== "set"))
            return true;
          return methodSpec.kind === kind;
        });

    this.state.selectedMethod = methodSpec;

    if (!method) {
      this.setStatusMessage(`Cannot find method ${methodSpec.name}`);
      return;
    }

    var ed = this.get("sourceEditor"),
        cursorPos = ed.indexToPosition(putCursorInBody ?
          method.value.body.start+1 : method.key.start)
    ed.cursorPosition = cursorPos;
    this.world() && await ed.whenRendered();
    ed.scrollCursorIntoView();

    if (highlight) {
      var methodRange = {
        start: ed.indexToPosition(method.start),
        end: ed.indexToPosition(method.end)
      }
      ed.flash(methodRange, {id: 'method', time: 1000, fill: Color.rgb(200,235,255)});
      ed.centerRange(methodRange);
      // ed.alignRowAtTop(undefined, pt(0, -20))
    }
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // command support
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  async doSave() {
    let {selectedModule, selectedClass, selectedMethod} = this;

    if (!selectedClass) throw new Error("No class selected");

    let editor = this.get("sourceEditor"),
        descr = this.sourceDescriptorFor(selectedClass),
        content = editor.textString,
        parsed = lively.ast.parse(content);

    // ensure that the source is a class declaration
    if (parsed.body.length !== 1 || parsed.body[0].type !== "ClassDeclaration") {
      let err = new Error(`Code is expected to contain the class definition of ${selectedClass}, aborting save.`);
      this.showError(err);
      return;
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
    if (this.state.sourceHash !== string.hashCode(content)
     && this.state.moduleChangeWarning && this.state.moduleChangeWarning === selectedModule.id) {
      var really = await this.world().confirm(
        `The module ${selectedModule.id} you are trying to save changed elsewhere!\nOverwrite those changes?`);
      if (!really) {
        this.setStatusMessage("Save canceled");
        return;
      }
      this.state.moduleChangeWarning = null;
    }


var store = JSON.parse(localStorage["oe helper"] || '{"saves": []}')
store.saves.push(editor.textString);
if (store.saves.length > 300) store.saves = store.saves.slice(-300)
localStorage["oe helper"] = JSON.stringify(store);

    this.state.isSaving = true;
    try {
      await descr.changeSource(content);
      await editor.saveExcursion(async () => {
        await this.refresh();
        await this.updateSource(editor.textString, this.selectedModule.id);
        // if (selectedMethod) await this.selectMethod(selectedClass, selectedMethod, false);
        // else await this.selectClass(selectedClass);
      });
    } finally { this.state.isSaving = false; }
  }

  async interactivelyAddMethod() {
    try {
      // let input = await this.world().prompt("Enter method name",
      //                   {historyId: "object-editor-method-name-hist"});
      // if (!input) return;
      let t = this.target,
          pkg = ObjectPackage.lookupPackageForObject(t);

      if (!pkg) {
        let objPkgName = await this.world()
          .prompt(
            `No object package exists yet for object ${t}.\n` +
              `Enter a name for a new package:`,
            {
              historyId: "object-package-name-hist",
              input: string.capitalize(t.name).replace(/\s/g, "-")
            }
          );
        if (!objPkgName) {
          this.setStatusMessage("Canceled");
          return;
        }
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

  async interactivelyRemoveMethod() {
    this.setStatusMessage("Not yet implemented")
  }

  async interactivelyForkPackage() {
  }

  async interactivelyAddImport() {
    try {
      var {selectedClass, selectedMethod} = this.state;
      if (!selectedClass) {
        this.showError(new Error("No class selected"));
        return;
      }

      var system = await this.editorPlugin.systemInterface(),
          choices = await interactivelyChooseImports(system);
      if (!choices) return null;

      // FIXME move this into system interface!
      var m = this.selectedModule,
          origSource = await m.source();

      this.state.isSaving = true;
      await m.addImports(choices);

    } catch (e) {
      origSource && await m.changeSource(origSource);
      this.showError(e);
    } finally {
      this.state.isSaving = false;
      await this.get("importController").updateImports();
      await this.updateKnownGlobals();
      this.get("sourceEditor").focus();
    }
  }

  async interactivelyRemoveImport() {
    try {
      var sels = this.get("importsList").selections;
      if (!sels || !sels.length) return;
      var really = await this.world().confirm(
        "Really remove imports \n" + arr.pluck(sels, "local").join("\n") + "?")
      if (!really) return;
      var m = this.selectedModule;
      var origSource = await m.source()
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

  async interactivelyRunSelectedMethod() {
    var { selectedMethod } = this.state;
    if (!selectedMethod) {
      this.setStatusMessage("no message selected");
      return;
    }

    if (typeof this.target[selectedMethod.name] !== "function") {
      this.setStatusMessage(`${selectedMethod.name} is not a method of ${this.target}`);
      return;
    }

    try {
      var result = await this.target[selectedMethod.name]();
      var msg = `Running ${selectedMethod.name}`;
      if (typeof result !== "undefined") msg += `, returns ${result}`;
      this.setStatusMessage(msg);
    } catch (e) {
      this.showError(e);
    }
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
      {keys: {mac: "Command-Shift--", win: "Ctrl-Shift--"}, command: "remove method"},
      {keys: "Ctrl-Shift-R", command: "run selected method"},
      {keys: "Alt-R", command: "refresh"},
      {keys: {win: "Ctrl-B", mac: "Meta-B"}, command: "open class in system browser"},
      {keys: "Alt-Shift-T", command: "choose target"},
      {keys: "Alt-J", command: "jump to definition"},
      {keys: "Ctrl-C I", command: "[javascript] inject import"},
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
        name: "[javascript] removed unused imports",
        exec: async ed => { await ed.interactivelyRemoveUnusedImports(); return true; }
      },

      {
        name: "toggle showing imports",
        exec: async ed => { await ed.toggleShowingImports(); return true; }
      },

      {
        name: "add method",
        exec: async ed => { await ed.interactivelyAddMethod(); return true; }
      },

      {
        name: "remove method",
        exec: async ed => { await ed.interactivelyRemoveMethod(); return true; }
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
              items = lively.lang.arr.flatmap(classNodes.reverse(), node => {
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
                        `${klass.name} `, {fontSize: 10},
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
            await ed.doSave();
            ed.setStatusMessage("saved", Color.green);
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
        name: "publish target to PartsBin",
        exec: async ed => {
          try {
            let {partName, url} = await interactivelySaveObjectToPartsBinFolder(ed.target);
            emit("lively.partsbin/partpublished", {partName, url});
            this.setStatusMessage(`Published ${this.target} as ${partName}`, Color.green);
          } catch (e) {
            if (e === "canceled") this.setStatusMessage("canceled");
            else this.showError(e);
          }
        }
      },

      {
        name: "choose target",
        exec: async ed => {
          var [selected] = await $world.execCommand("select morph", {justReturn: true});
          if (selected) ed.target = selected;
          return true;
        }
      }
    ];
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
          return id ? lively.modules.module(id) : null;
        },
        set(moduleOrId) {
          var id = !moduleOrId ? null : typeof moduleOrId === "string" ? moduleOrId : moduleOrId.id;
          this.setProperty("module", id);
        }
      }
    }
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
          activeStyle: {
            fill: Color.white,
            border: {color: Color.lightGray, style: "solid", radius: 5},
            nativeCursor: "pointer"
          },
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
    ]

    this.layout = new GridLayout({
      grid: [
        ["importsList"],
        ["buttons"]
      ]});
    this.layout.row(1).fixed = 30;
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
          return {isListItem: true, value: ea, label}
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
        return this.world().execCommand("open browser",
          {moduleName: fromModule, codeEntity: {name: local}});
      }
    }]
  }

}
