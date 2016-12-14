import { Color, pt, Rectangle } from "lively.graphics";
import { arr, promise, string } from "lively.lang";
import { connect, disconnect, noUpdate } from "lively.bindings";
import { Window, morph, show, Label, HorizontalLayout, GridLayout, config } from "lively.morphic";
import { DropDownList } from "lively.morphic/list.js";
import InputLine from "lively.morphic/text/input-line.js";
import { JSONEditorPlugin } from "lively.morphic/ide/json/editor-plugin.js";
import { HorizontalResizer } from "lively.morphic/resizers.js";
import { Icon } from "lively.morphic/icons.js";
import { JavaScriptEditorPlugin } from "../editor-plugin.js";
import EvalBackendChooser from "../eval-backend-ui.js";

import browserCommands from "./commands.js";
import { Tree, TreeData } from "lively.morphic/tree.js"

import "mocha-es6/index.js";


// -=-=-=-=-=-
// Browser UI
// -=-=-=-=-=-

import { findDecls } from "lively.ast/lib/code-categorizer.js";
import { testsFromSource } from "../../test-runner.js";

class CodeDefTreeData extends TreeData {

  constructor(defs) {
    // defs come from lively.ast.categorizer.findDecls()
    defs.forEach(ea => ea.children && (ea.isCollapsed = true))
    super({
      name: "root",
      isCollapsed: false,
      children: defs.filter(ea => !ea.parent)
    });
  }

  display(node) { return String(node.name) }
  isLeaf(node) { return !node.children }
  isCollapsed(node) { return node.isCollapsed; }
  collapse(node, bool) { node.isCollapsed = bool; }
  getChildren(node) {
    return this.isLeaf(node) ?
      null : this.isCollapsed(node) ?
        [] : node.children;
  }
}

export default class Browser extends Window {

  static async browse(
    packageName, moduleName,
    textPosition = {row: 0, column: 0},
    browserOrProps = {}, optBackend
  ) {
    var browser = browserOrProps instanceof Browser ? browserOrProps : new this(browserOrProps);
    if (!browser.world())
      browser.openInWorldNearHand();
    await browser.whenRendered();
    if (packageName) await browser.selectPackageNamed(packageName);
    if (packageName && moduleName) await browser.selectModuleNamed(moduleName);
    if (textPosition) {
      var text = browser.get("sourceEditor");
      text.cursorPosition = textPosition;
      text.centerRow(textPosition.row);
    }
    if (optBackend) browser.backend = optBackend;
    return browser;
  }


  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // initialization
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  constructor(props = {}) {
    super({
      name: "browser",
      extent: pt(700,600),
      ...props
    });
    this._inLayout = true;
    this.targetMorph = this.build();
    this.state = {
      packageUpdateInProgress: null,
      moduleUpdateInProgress: null,
      history: {left: [], right: [], navigationInProgress: null}
    };
    this.onLoad();
  }

  reset() {
    connect(this, 'extent', this, 'relayout');

    var {
      moduleList, packageList, sourceEditor,
      searchButton,
      addModuleButton,
      addPackageButton,
      browseHistoryButton,
      browseModulesButton,
      historyBackwardButton,
      historyForwardButton,
      removeModuleButton,
      removePackageButton,
      runTestsButton
    } = this.ui;

    connect(searchButton,          'fire', this, 'execCommand', {converter: () => "open code search"});
    connect(historyBackwardButton, 'fire', this, 'execCommand', {converter: () => "browser history backward"});
    connect(historyForwardButton,  'fire', this, 'execCommand', {converter: () => "browser history forward"});
    connect(browseHistoryButton,   'fire', this, 'execCommand', {converter: () => "browser history browse"});
    connect(browseModulesButton,   'fire', this, 'execCommand', {converter: () => "choose and browse package resources"});
    connect(addPackageButton,      'fire', this, 'execCommand', {converter: () => "add package"});
    connect(removePackageButton,   'fire', this, 'execCommand', {converter: () => "remove package"});
    connect(addModuleButton,       'fire', this, 'execCommand', {converter: () => "load or add module"});
    connect(removeModuleButton,    'fire', this, 'execCommand', {converter: () => "remove module"});
    connect(runTestsButton,        'fire', this, 'execCommand', {converter: () => "run all tests in module"});

    connect(packageList, "selection", this, "onPackageSelected");
    connect(moduleList, 'selection', this, 'onModuleSelected');

    moduleList.selection = null;
    packageList.selection = null;
    packageList.items = [];
    moduleList.items = [];
    sourceEditor.textString = "";

    this._inLayout = false;
  }

  async onLoad() {
    this.reset();
    this.reloadPackages();
  }

  build() {
    var style = {
          // borderWidth: 1, borderColor: Color.gray,
          fontSize: 14, fontFamily: "Helvetica Neue, Arial, sans-serif"
        },
        textStyle = {
          borderWidth: 1, borderColor: Color.gray,
          type: "text",
          ...config.codeEditor.defaultStyle,
          plugins: [new JavaScriptEditorPlugin(config.codeEditor.defaultTheme)]
        },

        btnStyle = {
          type: "button",
          fontSize: 10,
          activeStyle: {
            fill: Color.white,
            border: {color: Color.lightGray, style: "solid", radius: 5},
            nativeCursor: "pointer"
          },
          extent: pt(20,18),
        },

        bounds = this.targetMorphBounds(),

        [
          browserCommandsBounds,
          packageListBounds,
          moduleListBounds,
          codeEntityTreeBounds,
          packageCommandBoxBounds,
          moduleCommandBoxBounds,
          resizerBounds,
          sourceEditorBounds
        ] = bounds.extent().extentAsRectangle().divide([
          new Rectangle(0,   0,    1,   0.04),
          new Rectangle(0,   0.04, 0.3, 0.39),
          new Rectangle(0.3, 0.04, 0.3, 0.39),
          new Rectangle(0.6, 0.04, 0.4, 0.39),
          new Rectangle(0,   0.43, 0.5, 0.04),
          new Rectangle(0.5, 0.43, 0.5, 0.04),
          new Rectangle(0,   0.47, 1,   0.01),
          new Rectangle(0,   0.48, 1,   0.52)]),

        container = morph({
          ...style,
          bounds,
          submorphs: [

            {name: "packageList", bounds: packageListBounds, type: "list", ...style,
             borderRight: {color: Color.gray, width: 1},
             borderBottom: {color: Color.gray, width: 1},
             borderTop: {color: Color.gray, width: 1}},

            {name: "moduleList", bounds: moduleListBounds, type: "list", ...style,
             borderRight: {color: Color.gray, width: 1},
             borderBottom: {color: Color.gray, width: 1},
             borderTop: {color: Color.gray, width: 1}},

            new Tree({name: "codeEntityTree", treeData: new CodeDefTreeData([]),
             bounds: codeEntityTreeBounds, ...style,
             borderBottom: {color: Color.gray, width: 1},
             borderTop: {color: Color.gray, width: 1}}),
            // {name: "codeEntityList", bounds: codeEntityListBounds, type: "list", ...style,
            //  borderBottom: {color: Color.gray, width: 1},
            //  borderTop: {color: Color.gray, width: 1}},

            {name: "packageCommands", bounds: packageCommandBoxBounds,
             borderRight: {color: Color.gray, width: 1},
             layout: new HorizontalLayout({spacing: 2, autoResize: false}),
             submorphs: [
              {...btnStyle, name: "addPackageButton", label: Icon.makeLabel("plus"), tooltip: "add package"},
              {...btnStyle, name: "removePackageButton", label: Icon.makeLabel("minus"), tooltip: "remove package"}]},

            {name: "moduleCommands", bounds: moduleCommandBoxBounds,
             layout: new HorizontalLayout({spacing: 2, autoResize: false}),
              submorphs: [
               {...btnStyle, name: "addModuleButton", label: Icon.makeLabel("plus"), tooltip: "add module"},
               {...btnStyle, name: "removeModuleButton", label: Icon.makeLabel("minus"), tooltip: "remove package"},
               {...btnStyle, name: "runTestsButton", label: "run tests", tooltip: "run tests", visible: false}
             ]},

            new HorizontalResizer({name: "hresizer", bounds: resizerBounds}),

            {name: "sourceEditor", bounds: sourceEditorBounds, ...textStyle, doSave: () => { this.save(); }},

            {name: "browserCommands", bounds: browserCommandsBounds,
             layout: new GridLayout({grid:[["commands", null, "eval backend list"]]}),
             fill: Color.white, borderTop: {color: Color.gray, width: 1}, draggable: false,
             submorphs: [
               {name: "commands", layout: new HorizontalLayout({spacing: 2, autoResize: false}),
                fill: Color.transparent,
                submorphs: [
                 {...btnStyle, name: "searchButton", label: Icon.makeLabel("search"), tooltip: "code search"},
                 {...btnStyle, name: "browseModulesButton", label: Icon.makeLabel("navicon"), tooltip: "list all modules"},
                 {...btnStyle, name: "historyBackwardButton", label: Icon.makeLabel("step-backward"), tooltip: "back in browse history"},
                 {...btnStyle, name: "browseHistoryButton", label: Icon.makeLabel("history"), tooltip: "show browse history"},
                 {...btnStyle, name: "historyForwardButton", label: Icon.makeLabel("step-forward"), tooltip: "forward in browse history"},
                 ]},
                EvalBackendChooser.default.ensureEvalBackendDropdown(this, "local")]}
          ]
        });


    var browserCommands = container.get("browserCommands"),
        hresizer =        container.get("hresizer"),
        packageList =     container.get("packageList"),
        packageCommands = container.get("packageCommands"),
        moduleList =      container.get("moduleList"),
        moduleCommands =  container.get("moduleCommands"),
        codeEntityTree =  container.get("codeEntityTree"),
        sourceEditor =    container.get("sourceEditor");

    const l = browserCommands.layout;
    l.col(2).fixed = 100; l.row(0).paddingTop = 1; l.row(0).paddingBottom = 1;

    hresizer.addScalingAbove(packageList);
    hresizer.addScalingAbove(moduleList);
    hresizer.addScalingAbove(codeEntityTree);
    hresizer.addFixed(packageCommands);
    hresizer.addFixed(moduleCommands);
    hresizer.addScalingBelow(sourceEditor);

    return container;
  }


  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // layouting
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  relayout() {
    if (this._inLayout) return;

    this._inLayout = true;

    var {
      container,
      packageList,
      moduleList,
      codeEntityTree,
      browserCommands,
      packageCommands,
      moduleCommands,
      sourceEditor,
      hresizer
    } = this.ui;

    var listEditorRatio = packageList.height / (container.height - hresizer.height);

    try {
      container.setBounds(this.targetMorphBounds());

      [packageList, packageCommands, moduleList, moduleCommands, codeEntityTree]
        .forEach(ea => ea.width = container.width/3);
      [packageCommands, moduleCommands]
        .forEach(ea => ea.height = hresizer.top-packageList.bottom);

      moduleCommands.left = moduleList.left = packageList.right;
      codeEntityTree.left = moduleList.right;
      sourceEditor.height = container.height - hresizer.bottom;
      browserCommands.width = sourceEditor.width = hresizer.width = container.width;
    } finally { this._inLayout = false; }
  }


  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // accessing
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  get isBrowser() { return true; }

  get editorPlugin() { return this.get("sourceEditor").pluginFind(p => p.isEditorPlugin); }

  get ui() {
    return {
      container:             this.targetMorph,
      addModuleButton:       this.getSubmorphNamed("addModuleButton"),
      addPackageButton:      this.getSubmorphNamed("addPackageButton"),
      browseHistoryButton:   this.getSubmorphNamed("browseHistoryButton"),
      browseModulesButton:   this.getSubmorphNamed("browseModulesButton"),
      browserCommands:       this.getSubmorphNamed("browserCommands"),
      codeEntityTree:        this.getSubmorphNamed("codeEntityTree"),
      historyBackwardButton: this.getSubmorphNamed("historyBackwardButton"),
      historyForwardButton:  this.getSubmorphNamed("historyForwardButton"),
      hresizer:              this.getSubmorphNamed("hresizer"),
      moduleCommands:        this.getSubmorphNamed("moduleCommands"),
      moduleList:            this.getSubmorphNamed("moduleList"),
      packageCommands:       this.getSubmorphNamed("packageCommands"),
      packageList:           this.getSubmorphNamed("packageList"),
      removeModuleButton:    this.getSubmorphNamed("removeModuleButton"),
      removePackageButton:   this.getSubmorphNamed("removePackageButton"),
      runTestsButton:        this.getSubmorphNamed("runTestsButton"),
      searchButton:          this.getSubmorphNamed("searchButton"),
      sourceEditor:          this.getSubmorphNamed("sourceEditor"),
      evalBackendList:       this.getSubmorphNamed("eval backend list")
    }
  }

  get selectedModule() { return this.get("moduleList").selection; }
  set selectedModule(m) {
    var mlist = this.get("moduleList");
    if (!m) mlist.selection = null;
    else this.selectModuleNamed(typeof m === "string" ? m : m.name || m.id);
  }

  get selectedPackage() { return this.get("packageList").selection; }
  set selectedPackage(p) {
    if (!p) this.get("packageList").selection = null;
    else this.selectPackageNamed(typeof p === "string" ? p : p.url || p.address);
  }


  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // system interface
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  get backend() { return this.editorPlugin.evalEnvironment.remote || "local"; }
  set backend(remote) {
    this.editorPlugin.evalEnvironment.remote = remote;
  }
  setEvalBackend(newRemote) {
    var oldRemote = this.backend;
    if (newRemote !== oldRemote) {
      this.backend = newRemote;
      this.reset();
      this.reloadPackages();
    }
  }

  async systemInterface() {
    var livelySystem = await System.import("lively-system-interface"),
        remote = this.backend;
    return !remote || remote === "local" ?
      livelySystem.localInterface :
      livelySystem.serverInterfaceFor(remote);
  }

  async packageResources(p) {
    // await this.packageResources(this.selectedPackage)
    try {
      return (await (await this.systemInterface()).resourcesOfPackage(p.address))
        .filter(({name}) => name.endsWith(".js") || name.endsWith(".json"));
    } catch (e) { this.showError(e); return []; }
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // browser actions
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  whenPackageUpdated() { return this.state.packageUpdateInProgress || Promise.resolve(); }
  whenModuleUpdated() { return this.state.moduleUpdateInProgress || Promise.resolve(); }

  async reloadPackages() {
    var packages = await (await this.systemInterface()).getPackages();
    this.get("packageList").items = packages.map(p => ({isListItem: true, string: p.name, value: p}));
  }

  async selectPackageNamed(pName) {
    var list = this.get("packageList"),
        p = list.selection = list.values.find(({address, name}) =>
          address === pName || name === pName);
    await this.whenPackageUpdated();
    return p;
  }

  async onPackageSelected(p) {
    if (!this.state.packageUpdateInProgress) {
      var deferred = promise.deferred();
      this.state.packageUpdateInProgress = deferred.promise;
    }

    try {
      if (!p) {
        this.get("moduleList").items = [];
        this.get("sourceEditor").textString = "";
        this.title = "browser";
      } else {
        this.title = "browser - " + p.name;
        this.get("packageList").scrollSelectionIntoView();
        this.get("moduleList").selection = null;
        await this.updateModuleList(p);
      }

    } finally {
      if (deferred) {
        this.state.packageUpdateInProgress = null;
        deferred.resolve(p);
      }
    }
  }

  async selectModuleNamed(mName) {
    var list = this.get("moduleList"),
        m = list.selection = list.values.find(({nameInPackage, name}) =>
          mName === name || mName === nameInPackage);
    await this.whenModuleUpdated();
    return m;
  }

  async searchForModuleAndSelect(moduleURI) {
    // moduleURI = System.decanonicalize("lively.vm")
    // var x= await (that.getWindow().searchForModuleAndSelect(System.decanonicalize("lively.vm")));

    var {selectedModule, selectedPackage} = this;
    if (selectedModule && selectedModule.name === moduleURI)
      return selectedModule;

    var system = await this.systemInterface(),
        mods = await system.getModules(),
        m = mods.find(({name}) => name === moduleURI),
        p = m && await system.getPackageForModule(m.name);

    if (!p) return null;
    await this.selectPackageNamed(p.address);
    await this.selectModuleNamed(m.name);
    return this.selectedModule;
  }

  async onModuleSelected(m) {

    var pack = this.get("packageList").selection;

    if (!m) {
      this.get("sourceEditor").textString = "";
      this.title = "browser - " + (pack && pack.name || "");
      this.updateCodeEntities(null);
      return;
    }

    if (!pack) {
      this.showError(new Error("Browser>>onModuleSelected called but no package selected!" + m));
      return
    }

    if (!this.state.moduleUpdateInProgress) {
      var deferred = promise.deferred()
      this.state.moduleUpdateInProgress = deferred.promise;
    }

    try {
      var system = await this.systemInterface();

      if (!m.isLoaded && m.name.endsWith(".js")) {
        var err;
        try { await system.importModule(m.name); }
        catch(e) { err = e; }

        if (err) this.showError(err);

        var p = await system.getPackage(pack.address),
            isLoadedNow = p.modules.map(ea => ea.name).includes(m.name);

        if (isLoadedNow) {
          Object.assign(pack, p);
          m.isLoaded = true;
          // await this.selectPackageNamed(pack.address);
          await this.updateModuleList();
          this.state.moduleUpdateInProgress = null;
          await this.selectModuleNamed(m.name);
          m = this.selectedModule;
          if (deferred)
            this.state.moduleUpdateInProgress = deferred.promise;
          return;
        }
      }

      this.get("moduleList").scrollSelectionIntoView();
      this.title = "browser - " + pack.name + "/" + m.nameInPackage;
      var source = await system.moduleRead(m.name);
      this.get("sourceEditor").textString = source;
      this.get("sourceEditor").cursorPosition = {row: 0, column: 0}

      await this.prepareCodeEditorForModule(m);

      this.historyRecord();

      await this.updateCodeEntities(m);
      await this.updateTestUI(m);

    } finally {
      if (deferred) {
        this.state.moduleUpdateInProgress = null;
        deferred.resolve(m);
      }
    }
  }

  async prepareCodeEditorForModule(module) {
    var system = await this.systemInterface(),
        format = (await system.moduleFormat(module.name)) || "esm",
        [_, ext] = module.name.match(/\.([^\.]+)$/) || [];
    // FIXME we already have such "mode" switching code in the text editor...
    // combine these?!
    var Mode = JavaScriptEditorPlugin;
    switch (ext) {
      case 'js': /*default*/break;
      case 'json': Mode = JSONEditorPlugin; break;
    }

    // switch text mode
    if (this.editorPlugin.constructor !== Mode) {
      var env = this.editorPlugin.evalEnvironment;
      this.get("sourceEditor").removePlugin(this.editorPlugin);
      this.get("sourceEditor").addPlugin(new Mode(config.codeEditor.defaultTheme));
      Object.assign(this.editorPlugin.evalEnvironment, env);
      this.editorPlugin.highlight();
    }

    Object.assign(this.editorPlugin.evalEnvironment, {
      targetModule: module.name,
      context: this.get("sourceEditor"),
      format
    });

  }

  async updateModuleList(p = this.selectedPackage) {
    if (!p) return;
    var mods = await this.packageResources(p);

    this.get("moduleList").items = mods
      .sort((a, b) => {
        if (a.isLoaded && !b.isLoaded) return -1;
        if (!a.isLoaded && b.isLoaded) return 1;
        if (a.nameInPackage.toLowerCase() < b.nameInPackage.toLowerCase()) return -1;
        if (a.nameInPackage.toLowerCase() == b.nameInPackage.toLowerCase()) return 0;
        return 1
      })
      .map(m => ({string: m.nameInPackage + (m.isLoaded ? "" : " [not loaded]"), value: m, isListItem: true}));

    await this.get("moduleList").whenRendered();
  }

  updateCodeEntities(mod) {
    var {codeEntityTree} = this.ui;

    if (!mod) { codeEntityTree.treeData = new CodeDefTreeData([]); return; }

    var decls = findDecls(lively.ast.parse(this.get("sourceEditor").textString));

    codeEntityTree.treeData = new CodeDefTreeData(decls);
  }

  updateTestUI(mod) {
    var { runTestsButton, sourceEditor } = this.ui,
        hasTests = false;
    if (this.editorPlugin.isJSEditorPlugin) {
      var ast = this.editorPlugin.getNavigator().ensureAST(sourceEditor),
          tests = testsFromSource(ast || sourceEditor.textString);
      hasTests = tests && tests.length;
    }

    runTestsButton.visible = hasTests;
  }

  async save() {
    var module = this.get("moduleList").selection;
    if (!module) return show("Cannot save, no module selected");

    var content = this.get("sourceEditor").textString,
        system = await this.systemInterface();

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // FIXME!!!!!! redundant with module load / prepare "mode" code!
    var format = (await system.moduleFormat(module.name)) || "esm",
        [_, ext] = module.name.match(/\.([^\.]+)$/) || [];
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-


    try {
      // deal with non-js code, this needs to be cleaned up as well!
      if (ext !== "js") {
        await system.coreInterface.resourceWrite(module.name, content);
        if (arr.last(module.name.split("/")) === "package.json") {
          await system.packageConfChange(content, module.name);
          this.setStatusMessage("updated package config", Color.green);
        }

      // js save
      } else {
        if (module.isLoaded) { // is loaded in runtime
          await system.interactivelyChangeModule(
            module.name, content, {targetModule: module.name, doEval: true});
        } else await system.coreInterface.resourceWrite(module.name, content);
      }

    } catch(err) { return this.showError(err); }

    this.setStatusMessage("saved " + module.nameInPackage, Color.green);
  }


  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // history
  // -=-=-=-=-

  async historyBackward() {
    if (this.state.history.left.length < 2) return;
    var current = this.state.history.left.pop(),
        before = arr.last(this.state.history.left);

    this.state.history.right.unshift(current);
    var {scroll, cursor} = this.historyGetLocation();
    current.scroll = scroll; current.cursor = cursor;

    try {
      await this.historySetLocation(before);
    } catch (e) {
      this.state.history.left.push(before);
      this.state.history.right.unshift();
      throw e;
    }
  }


  async historyForward() {
    var current = arr.last(this.state.history.left),
        next = this.state.history.right.shift();
    if (!next) return;
    this.state.history.left.push(next);

    if (current) {
      var {scroll, cursor} = this.historyGetLocation();
      current.scroll = scroll; current.cursor = cursor;
    }

    try {
      await this.historySetLocation(next);
    } catch (e) {
      this.state.history.left.pop();
      this.state.history.right.unshift(next);
      throw e;
    }
  }

  historyGetLocation() {
    var ed = this.get("sourceEditor");
    return {
      package: this.selectedPackage,
      module: this.selectedModule,
      // codeEntity: this.get("codeStructureList").selection,
      cursor: ed.cursorPosition,
      scroll: ed.scroll
    }
  }

  historyRecord(addToRight = false) {
    if (this.state.history.navigationInProgress) return;

    this.state.history.right.length = 0;

    var loc = this.historyGetLocation(), last;
    if (addToRight) {
      while ((last = this.state.history.right[0])
          && last.module && loc.module
          && (last.module.name === loc.module.name)) {
        this.state.history.right.shift();
      }
      this.state.history.right.unshift(loc);
    } else {
      while ((last = arr.last(this.state.history.left))
          && last.module && loc.module
          && (last.module.name === loc.module.name)) {
        this.state.history.left.pop();
      }
      this.state.history.left.push(loc);
    }
  }


  historyReset() {
    this.state.history.left = [];
    this.state.history.right = [];
    this.state.history.navigationInProgress = null;
  }


  async historySetLocation(loc) {
    // var codeEntities = this.get("codeStructureList"),

    if (!loc) return;

    var hstate = this.state.history;

    if (hstate.navigationInProgress) {
      await hstate.navigationInProgress;
      this.historySetLocation(loc);
      return;
    }

    var {promise: navPromise, resolve} = promise.deferred();

    hstate.navigationInProgress = navPromise;

    try {
      var ed = this.get("sourceEditor");
      // var loc = hstate.left[0]

      await this.whenPackageUpdated();
      await this.whenModuleUpdated();
      if (!this.selectedPackage || loc.package.address !== this.selectedPackage.address)
        await this.selectPackageNamed(loc.package.address);
      if (!this.selectedModule || loc.module.name !== this.selectedModule.name)
        await this.selectModuleNamed(loc.module.name);

      ed.cursorPosition = loc.cursor;
      ed.scroll = loc.scroll;
      ed.scrollCursorIntoView();
    } finally {
      hstate.navigationInProgress = null;
      resolve();
    }
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // events
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  focus() { this.get("sourceEditor").focus(); }

  get keybindings() {
    return [
      {keys: "Alt-Up", command: "focus list with selection"},
      {keys: "F1", command: "focus package list"},
      {keys: "F2", command: "focus module list"},
      {keys: "F3", command: "focus code entities"},
      {keys: "F4|Alt-Down", command: "focus source editor"},
      {keys: "Alt-R", command: "reload module"},
      {keys: "Alt-L", command: "load or add module"},
      {keys: "Ctrl-C Ctrl-T", command: "run all tests in module"},
      {keys: "Ctrl-C T", command: "run tests at point"},
      {keys: "Ctrl-C B E F", command: "run setup code of tests (before and beforeEach)"},
      {keys: "Ctrl-C A F T", command: "run teardown code of tests (after and afterEach)"},
      {keys: "Alt-P", command: "browser history backward"},
      {keys: "Alt-N", command: "browser history forward"},
      {keys: "Alt-H", command: "browser history browse"},
      {keys: "Meta-Shift-L b a c k e n d", command: "activate eval backend dropdown list"}
    ].concat(super.keybindings);
  }

  get commands() {
    return browserCommands(this)
      .concat(EvalBackendChooser.default.activateEvalBackendCommand(this));
  }

  menuItems() {
    return [
      ["test", () => {}]
    ]
  }
}
