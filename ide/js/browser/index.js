import { Color, LinearGradient, pt, Rectangle } from "lively.graphics";
import { arr, obj, fun, promise, string } from "lively.lang";
import { connect, disconnect, noUpdate } from "lively.bindings";
import { morph, show, Label, HorizontalLayout, GridLayout,
         DropDownList, config, Window } from "lively.morphic";
import InputLine from "../../../text/input-line.js";
import JSONEditorPlugin from "lively.morphic/ide/json/editor-plugin.js";
import { HorizontalResizer } from "lively.morphic/components/resizers.js";
import { Icon } from "lively.morphic/components/icons.js";
import JavaScriptEditorPlugin from "../editor-plugin.js";
import EvalBackendChooser from "../eval-backend-ui.js";
import browserCommands from "./commands.js";
import { Tree, TreeData } from "lively.morphic/components/tree.js"

import "mocha-es6/index.js";


// -=-=-=-=-=-
// Browser UI
// -=-=-=-=-=-

import { findDecls } from "lively.ast/lib/code-categorizer.js";
import { testsFromSource } from "../../test-runner.js";
import { module } from "lively.modules/index.js";

class CodeDefTreeData extends TreeData {

  constructor(defs) {
    // defs come from lively.ast.categorizer.findDecls()
    this.defs = defs;
    defs.forEach(ea => ea.children && (ea.isCollapsed = true))
    super({
      name: "root",
      isCollapsed: false,
      children: defs.filter(ea => !ea.parent)
    });
  }

  display(node) {
    var string = String(node.name);
    if (node.type === "class-instance-getter") string = "get " + string;
    if (node.type === "class-instance-setter") string = "set " + string;
    return string;
  }
  isLeaf(node) { return !node.children }
  isCollapsed(node) { return node.isCollapsed; }
  collapse(node, bool) { node.isCollapsed = bool; }
  getChildren(node) {
    return this.isLeaf(node) ?
      null : this.isCollapsed(node) ?
        [] : node.children;
  }
}

// Browser.browse({moduleName: "lively.morphic/morph.js", codeEntity: {name: "Morph"}});
export default class Browser extends Window {

  static async browse(browseSpec = {}, browserOrProps = {}, optSystemInterface) {
    // browse spec:
    // packageName, moduleName, codeEntity, scroll, textPosition like {row: 0, column: 0}
    var browser = browserOrProps instanceof Browser ?
      browserOrProps : new this(browserOrProps);
    if (!browser.world()) browser.openInWorldNearHand();
    return browser.browse(browseSpec, optSystemInterface);
  }

  static get properties() {
  
    return {
      systemInterface: {
        derived: true, readOnly: true, after: ["editorPlugin"],
        get() { return this.editorPlugin.systemInterface(); },
        set(systemInterface) {
          this.editorPlugin.setSystemInterface(systemInterface);
        }
      },

      editorPlugin: {
        after: ["submorphs"], readOnly: true, derived: true,
        get() { return this.get("sourceEditor").pluginFind(p => p.isEditorPlugin); }
      }
    }
  
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
    this.targetMorph = this.build();
    this.onLoad();
  }

  reset() {
    this._inLayout = true;

    connect(this, 'extent', this, 'relayout');

    var {
      moduleList, sourceEditor,
      searchButton,
      addModuleButton,
      addPackageButton,
      browseHistoryButton,
      browseModulesButton,
      historyBackwardButton,
      historyForwardButton,
      removeModuleButton,
      removePackageButton,
      runTestsInModuleButton,
      runTestsInPackageButton,
      codeEntityJumpButton,
      codeEntityTree
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
    connect(runTestsInModuleButton,'fire', this, 'execCommand', {converter: () => "run all tests in module"});
    connect(runTestsInPackageButton,'fire', this, 'execCommand', {converter: () => "run all tests in package"});
    connect(codeEntityJumpButton,   'fire', this, 'execCommand', {converter: () => "jump to codeentity"});

    connect(moduleList, 'selection', this, 'onModuleSelected');
    connect(codeEntityTree, 'selection', this, 'onCodeEntitySelected');

    connect(sourceEditor, "textChange", this, "updateUnsavedChangeIndicatorDebounced");

    moduleList.selection = null;
    moduleList.items = [];
    sourceEditor.textString = "";

    this._inLayout = false;
  }

  __additionally_serialize__(snapshot, objRef, pool, addFn) {
    super.__additionally_serialize__(snapshot, objRef, pool, addFn);

    // remove unncessary stuff
    // FIXME offer option in object ref or pool or removeFn to automate this stuff!
    var ref = pool.ref(this.ui.moduleList);
    ref.currentSnapshot.props.items.value = [];
    if (ref.currentSnapshot.props.selection)
      ref.currentSnapshot.props.selection.value = null;

    var ref = pool.ref(this.ui.codeEntityTree);
    if (ref.currentSnapshot.props.selection)
      ref.currentSnapshot.props.selection.value = null;

    var ref = pool.ref(this.ui.codeEntityTree.nodeItemContainer);
    ref.currentSnapshot.props.submorphs.value = [];

    var ref = pool.ref(this.ui.codeEntityTree.treeData);
    ref.currentSnapshot.props.defs.value = [];
    ref.currentSnapshot.props.root.value = {};
    ref.currentSnapshot.props.root.verbatim = true;

    var ref = pool.ref(this.ui.sourceEditor);
    ref.currentSnapshot.props.textAndAttributes.value = [];
    ref.currentSnapshot.props.attributeConnections.value = [];
    ref.currentSnapshot.props.plugins.value = [];
    ref.currentSnapshot.props.anchors.value =
      ref.currentSnapshot.props.anchors.value.filter(({id}) =>
        id.startsWith("selection-"));
    ref.currentSnapshot.props.savedMarks.value = [];

    // remember browse state
    var {
      ui: {sourceEditor, codeEntityTree, codeEntityTree, moduleList},
      selectedPackage,
      selectedModule,
      selectedCodeEntity
    } = this;

    snapshot.props._serializedState = {
      verbatim: true,
      value: {
        packageName: selectedPackage ? selectedPackage.name : null,
        moduleName: selectedModule ? selectedModule.nameInPackage : null,
        codeEntity: selectedCodeEntity ? selectedCodeEntity.name : null,
        textPosition: sourceEditor.textPosition,
        scroll: sourceEditor.scroll,
        codeEntityTreeScroll: codeEntityTree.scroll,
        moduleListScroll: moduleList.scroll,
      }
    }
  }

  async onLoad() {
    this.state = {
      packageUpdateInProgress: null,
      moduleUpdateInProgress: null,
      selectedPackage: null,
      sourceHash: null,
      moduleChangeWarning: null,
      isSaving: false,
      history: {left: [], right: [], navigationInProgress: null}
    };
    this.reset();
    var ed = this.ui.sourceEditor
    if (!ed.plugins.length)
      ed.addPlugin(new JavaScriptEditorPlugin(config.codeEditor.defaultTheme));

    if (this._serializedState) {
      var s = this._serializedState;
      delete this._serializedState;
      await this.browse(s);
    }
  }

  build() {
    // this.relayout();
    // this.removeAllMorphs(); this.targetMorph = this.build();

    this._inLayout = true;

    this.targetMorph && this.targetMorph.remove();

    let style = {
          // borderWidth: 1, borderColor: Color.gray,
          fontSize: 14, fontFamily: "Helvetica Neue, Arial, sans-serif"
        },
        textStyle = {
          borderWidth: 1, borderColor: Color.gray,
          lineWrapping: true,
          type: "text",
          ...config.codeEditor.defaultStyle
        },

        btnStyle = {
          type: "button",
          fontSize: 10,
          activeStyle: {
            fill: new LinearGradient({stops: [
               {offset: 0, color: Color.white},
               {offset: 1, color: new Color.rgb(236,240,241)}
            ]}),
            border: {color: Color.gray, style: "solid", radius: 5},
            nativeCursor: "pointer"
          },
          extent: pt(20,18),
        },

        btnDarkStyle = {
          type: "button",
          fontSize: 10,
          activeStyle: {
            fill: Color.black.withA(.5),
            fontColor: Color.white,
            border: {width: 0, radius: 5},
            nativeCursor: "pointer"
          },
          extent: pt(20,18),
        },

        bounds = this.targetMorphBounds(),

        [
          browserCommandsBounds,
          moduleListBounds,
          codeEntityTreeBounds,
          moduleCommandBoxBounds,
          codeEntityCommandBoxBounds,
          resizerBounds,
          metaInfoBounds,
          sourceEditorBounds
        ] = bounds.extent().extentAsRectangle().divide([
          new Rectangle(0,   0,    1,   0.04),
          new Rectangle(0,   0.04, 0.5, 0.34),
          new Rectangle(0.5, 0.04, 0.5, 0.34),
          new Rectangle(0,   0.34, 0.5, 0.04),
          new Rectangle(0.5, 0.34, 0.5, 0.04),
          new Rectangle(0,   0.38,  1,   0.01),
          new Rectangle(0,   0.39,  1,   0.03),
          new Rectangle(0,   0.42, 1,   0.57)]),

        container = morph({
          ...style,
          fill: Color.transparent,
          reactsToPointer: false,
          bounds,
          submorphs: [

            {name: "moduleList", bounds: moduleListBounds, type: "list", ...style,
             borderRight: {color: Color.gray, width: 1}},

            new Tree({name: "codeEntityTree", treeData: new CodeDefTreeData([]),
             bounds: codeEntityTreeBounds, ...style}),

            {name: "moduleCommands", bounds: moduleCommandBoxBounds,
             layout: new HorizontalLayout({spacing: 2, autoResize: false, direction: "rightToLeft"}),
             borderRight: {color: Color.gray, width: 1}, 
             fill: Color.transparent,
              submorphs: [
               {...btnDarkStyle, name: "addModuleButton", label: Icon.makeLabel("plus"), tooltip: "add module"},
               {...btnDarkStyle, name: "removeModuleButton", label: Icon.makeLabel("minus"), tooltip: "remove package"},
               {...btnDarkStyle, name: "runTestsInModuleButton", label: "run tests", tooltip: "run tests", visible: false}
             ]},

             {name: "codeEntityCommands", bounds: codeEntityCommandBoxBounds,
              layout: new HorizontalLayout({spacing: 2, autoResize: false, direction: "rightToLeft"}),
              fill: Color.transparent,
              submorphs: [
               {...btnDarkStyle, name: "codeEntityJumpButton", label: Icon.makeLabel("search"), tooltip: "search for code entity"},
             ]},

            new HorizontalResizer({name: "hresizer", bounds: resizerBounds}),

            {
              name: "metaInfoText",
              bounds: metaInfoBounds,
              ...textStyle,
              fontSize: config.codeEditor.defaultStyle.fontSize - 2,
              clipMode: "hidden",
              borderWidth: 0,
              readOnly: false
            },
            {name: "sourceEditor", bounds: sourceEditorBounds, ...textStyle},

            {name: "browserCommands", bounds: browserCommandsBounds,
             layout: new GridLayout({grid:[["commands", null, "eval backend list"]]}),
             fill: Color.transparent,
             reactsToPointer: false,
             borderBottom: {color: Color.gray, width: 1},
             submorphs: [
               {name: "commands", layout: new HorizontalLayout({spacing: 2, autoResize: false}),
                fill: Color.transparent,
                submorphs: [
                 {...btnStyle, name: "historyBackwardButton", label: Icon.makeLabel("step-backward"), tooltip: "back in browse history"},
                 {...btnStyle, name: "browseHistoryButton", label: Icon.makeLabel("history"), tooltip: "show browse history"},
                 {...btnStyle, name: "historyForwardButton", label: Icon.makeLabel("step-forward"), tooltip: "forward in browse history"},

                 {extent: pt(10,18), fill: Color.transparent},

                 {...btnStyle, name: "searchButton", label: Icon.makeLabel("search"), tooltip: "code search"},
                 {...btnStyle, name: "browseModulesButton", label: Icon.makeLabel("navicon"), tooltip: "list all modules"},

                 {extent: pt(10,18), fill: Color.transparent},

                 {...btnStyle, name: "addPackageButton", label: Icon.makeLabel("plus"), tooltip: "add package"},
                 {...btnStyle, name: "removePackageButton", label: Icon.makeLabel("minus"), tooltip: "remove package"},
                 {...btnStyle, name: "runTestsInPackageButton", label: "run tests", tooltip: "run tests"}

                 ]},
                EvalBackendChooser.default.ensureEvalBackendDropdown(this, "local")]}
          ]
        });


    let browserCommands =    container.getSubmorphNamed("browserCommands"),
        hresizer =           container.getSubmorphNamed("hresizer"),
        moduleList =         container.getSubmorphNamed("moduleList"),
        moduleCommands =     container.getSubmorphNamed("moduleCommands"),
        codeEntityCommands = container.getSubmorphNamed("codeEntityCommands"),
        codeEntityTree =     container.getSubmorphNamed("codeEntityTree"),
        sourceEditor =       container.getSubmorphNamed("sourceEditor"),
        metaInfoText =       container.getSubmorphNamed("metaInfoText"),
        l =                  browserCommands.layout;
    l.col(2).fixed = 100; l.row(0).paddingTop = 1; l.row(0).paddingBottom = 1;

    hresizer.addScalingAbove(moduleList);
    hresizer.addScalingAbove(codeEntityTree);
    hresizer.addFixed(moduleCommands);
    hresizer.addFixed(codeEntityCommands);
    hresizer.addFixed(metaInfoText);
    hresizer.addScalingBelow(sourceEditor);

    this._inLayout = false;

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
      moduleList,
      codeEntityTree,
      browserCommands,
      moduleCommands,
      codeEntityCommands,
      metaInfoText,
      sourceEditor,
      hresizer,
      evalBackendList
    } = this.ui;

    var listEditorRatio = moduleList.height / (container.height - hresizer.height);

    try {
      container.setBounds(this.targetMorphBounds());

      [moduleList, moduleCommands, codeEntityTree, codeEntityCommands]
        .forEach(ea => ea.width = container.width/2);
      [moduleCommands, codeEntityCommands]
        .forEach(ea => ea.height = hresizer.top-moduleList.bottom);

      codeEntityCommands.left = codeEntityTree.left = moduleList.right;
      browserCommands.layout.col(2).width = evalBackendList.width;
      browserCommands.width = hresizer.width = container.width;
      metaInfoText.top = hresizer.bottom + 1;
      metaInfoText.width = browserCommands.width + 1;
      sourceEditor.setBounds(
        new Rectangle(
          0, metaInfoText.bottom,
          metaInfoText.width - sourceEditor.borderWidth,
          container.height - metaInfoText.bottom - sourceEditor.borderWidth));
    } finally { this._inLayout = false; }
  }


  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // accessing
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  get isBrowser() { return true; }

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
      codeEntityCommands:    this.getSubmorphNamed("codeEntityCommands"),
      moduleList:            this.getSubmorphNamed("moduleList"),
      removeModuleButton:    this.getSubmorphNamed("removeModuleButton"),
      removePackageButton:   this.getSubmorphNamed("removePackageButton"),
      runTestsInPackageButton:this.getSubmorphNamed("runTestsInPackageButton"),
      runTestsInModuleButton:this.getSubmorphNamed("runTestsInModuleButton"),
      codeEntityJumpButton:  this.getSubmorphNamed("codeEntityJumpButton"),
      searchButton:          this.getSubmorphNamed("searchButton"),
      metaInfoText:          this.getSubmorphNamed("metaInfoText"),
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

  get selectedPackage() { return this.state.selectedPackage; }
  set selectedPackage(p) {
    this.selectPackageNamed(!p ? null : typeof p === "string" ? p : p.url || p.address);
  }

  get selectedCodeEntity() { return  this.ui.codeEntityTree.selection; }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // source changes
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  updateSource(source, cursorPos) {
    var ed = this.get("sourceEditor")
    if (ed.textString != source) ed.textString = source;
    this.state.sourceHash = string.hashCode(source);
    this.indicateNoUnsavedChanges();
    this.state.moduleChangeWarning = null;
    if (cursorPos) ed.cursorPosition = cursorPos;
  }

  indicateUnsavedChanges() {
    Object.assign(this.get("sourceEditor"),
      {border: {width: 2, color: Color.red}});
  }

  indicateNoUnsavedChanges() {
    Object.assign(this.get("sourceEditor"),
      {border: {width: 2, color: Color.gray}});
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
  // system interface
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  async setEvalBackend(newRemote) {
    newRemote = newRemote || "local";
    var oldSystemInterface = this.systemInterface,
        pckg = this.selectedPackage.name,
        mod = this.selectedModule.nameInPackage;
    if (newRemote !== oldSystemInterface.name) {
      this.editorPlugin.setSystemInterfaceNamed(newRemote);
      this.reset();
      await this.selectPackageNamed(pckg);
      await this.selectModuleNamed(mod);
      this.relayout();
    }
  }

  async packageResources(p) {
    // await this.packageResources(this.selectedPackage)
    try {
      return (await this.systemInterface.resourcesOfPackage(p.address))
        .filter(({url}) => url.endsWith(".js") || url.endsWith(".json"))
        .map((ea) => { ea.name = ea.url; return ea; });
    } catch (e) { this.showError(e); return []; }
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // browser actions
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  async browse(browseSpec = {}, optSystemInterface) {
    // browse spec:
    // packageName, moduleName, codeEntity, scroll, textPosition like {row: 0, column: 0}

    let {
      packageName,
      moduleName,
      textPosition,
      codeEntity,
      scroll,
      codeEntityTreeScroll,
      moduleListScroll,
      systemInterface
    } = browseSpec,
      {sourceEditor, codeEntityTree, moduleList} = this.ui;

    if (this.world()) await this.whenRendered();

    if (optSystemInterface || systemInterface)
      this.systemInterface = optSystemInterface || systemInterface;

    if (packageName) {
      await this.selectPackageNamed(packageName);
      if (moduleName) await this.selectModuleNamed(moduleName);

    } else if (moduleName) {
      let system = this.systemInterface,
          m = await system.getModule(moduleName);
      if (m) {
        moduleName = m.id;
        let p = await system.getPackageForModule(m.id);
        await this.selectPackageNamed(p.url);
        await this.selectModuleNamed(moduleName);
      }
    }

    if (codeEntity) {
      await this.selectCodeEntity(codeEntity);
    }

    if (textPosition) {
      if (this.world()) await sourceEditor.whenRendered();
      sourceEditor.cursorPosition = textPosition;
      sourceEditor.centerRow(textPosition.row);
    }

    if (scroll) {
      if (this.world()) await sourceEditor.whenRendered();
      sourceEditor.scroll = scroll;
    }

    if (moduleListScroll) moduleList.scroll = moduleListScroll;
    if (codeEntityTreeScroll) codeEntityTree.scroll = codeEntityTreeScroll;

    return this;
  }

  whenPackageUpdated() { return this.state.packageUpdateInProgress || Promise.resolve(); }
  whenModuleUpdated() { return this.state.moduleUpdateInProgress || Promise.resolve(); }

  async selectPackageNamed(pName) {
    let p = await this.systemInterface.getPackage(pName);
    this.onPackageSelected(p);
    await this.whenPackageUpdated();
    return p;
  }

  async onPackageSelected(p) {
    this.state.selectedPackage = p;
    if (!this.state.packageUpdateInProgress) {
      var deferred = promise.deferred();
      this.state.packageUpdateInProgress = deferred.promise;
    }

    try {
      let {moduleList} = this.ui;
      if (!p) {
        moduleList.items = [];
        this.updateSource("");
        this.title = "browser";
      } else {
        this.title = "browser - " + p.name;
        moduleList.selection = null;
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
    let list = this.ui.moduleList,
        m = list.selection = list.values.find(({nameInPackage, name}) =>
          mName === name || mName === nameInPackage);

    if (!m) {
      let system = this.systemInterface,
          p = this.state.selectedPackage,
          url, nameInPackage;

      if (await system.doesModuleExist(mName)) {
        if (p && !mName.startsWith(p.url)) {
          nameInPackage = mName;
          url = p.url + "/" + mName;
        } else url = nameInPackage = mName;

      } else if (p && await system.doesModuleExist(p.url + "/" + mName, true)) {
        url = p.url + "/" + mName;
        nameInPackage = mName;
      }

      if (url) {
        let isLoaded = await system.isModuleLoaded(url, true),
            item = {
              isListItem: true,
              string: nameInPackage,
              value: {
                isLoaded, name: url, nameInPackage, url,
                package: p ? p.url : null,
              }
            }
        list.addItem(item);
        m = list.selection = item.value;
      }
    }

    await this.whenModuleUpdated();
    return m;
  }

  async searchForModuleAndSelect(moduleURI) {
    // moduleURI = System.decanonicalize("lively.vm")
    // var x= await (that.getWindow().searchForModuleAndSelect(System.decanonicalize("lively.vm")));

    var {selectedModule, selectedPackage} = this;
    if (selectedModule && selectedModule.name === moduleURI)
      return selectedModule;

    var system = this.systemInterface,
        mods = await system.getModules(),
        m = mods.find(({name}) => name === moduleURI),
        p = m && await system.getPackageForModule(m.name);

    if (!p) return null;
    await this.selectPackageNamed(p.address);
    await this.selectModuleNamed(m.name);
    return this.selectedModule;
  }

  async onModuleSelected(m) {
    let pack = this.state.selectedPackage;
    this.state.moduleChangeWarning = null;

    if (!m) {
      this.updateSource("");
      this.title = "browser - " + (pack && pack.name || "");
      this.updateCodeEntities(null);
      this.ui.metaInfoText.textString = "";
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
      var system = this.systemInterface;

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
      this.title = `browser - [${pack.name}] ${m.nameInPackage}`;
      var source = await system.moduleRead(m.name);
      this.updateSource(source, {row: 0, column: 0});

      await this.prepareCodeEditorForModule(m);

      this.historyRecord();

      await this.updateCodeEntities(m);
      await this.updateTestUI(m);

      this.ui.metaInfoText.textString = `[${pack.name}] ${m.nameInPackage} (${pack.url})`;
      this.ui.metaInfoText.textAndAttributes = [
        `[${pack.name}]`,
        {
          nativeCursor: "pointer",
          textDecoration: "underline",
          doit: {code: `$world.execCommand("open file browser", {location: "${pack.url}"})`}
        },
        " ", null,
        m.nameInPackage, {}
      ];

    } finally {
      if (deferred) {
        this.state.moduleUpdateInProgress = null;
        deferred.resolve(m);
      }
    }
  }

  async prepareCodeEditorForModule(module) {
    var system = this.systemInterface,
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

  async onCodeEntitySelected(entity) {
    if (!entity) return;
    var { sourceEditor } = this.ui,
        start = sourceEditor.indexToPosition(entity.node.start),
        end = sourceEditor.indexToPosition(entity.node.end)
    sourceEditor.cursorPosition = start;
    sourceEditor.flash({start, end}, {id: 'codeentity', time: 1000, fill: Color.rgb(200,235,255)});
    if (this.world()) await sourceEditor.whenRendered();
    sourceEditor.centerRange({start, end});
  }

  findCodeEntity({name, type, parent}) {
    var parentDef = parent ? this.findCodeEntity(parent) : null;
    var defs = this.ui.codeEntityTree.treeData.defs;
    if (!defs) return null;
    return defs.find(def => {
      if (parentDef && def.parent !== parentDef) return false;
      if (def.name !== name) return false;
      if (!type || def.type === type) return true;
      if (type === "method" && def.type.includes("method")) return true;
      return false;
    });
  }

  async selectCodeEntity(spec) {
    var {codeEntityTree} = this.ui, td = codeEntityTree.treeData,
        def = this.findCodeEntity(spec),
        path = []; while (def) { path.unshift(def); def = def.parent; };
    await codeEntityTree.selectPath(path);
    codeEntityTree.centerSelection();
    return def
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-


  async updateModuleList(p = this.selectedPackage) {
    if (!p) return;
    let mods = await this.packageResources(p);

    this.ui.moduleList.items = mods.sort((a, b) => {
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
    let {editorPlugin, ui: {codeEntityTree}} = this;

    if (!mod || !editorPlugin || !editorPlugin.isJSEditorPlugin) {
      codeEntityTree.treeData = new CodeDefTreeData([]);
      return;
    }

    let parsed = editorPlugin.getNavigator().ensureAST(editorPlugin.textMorph),
        decls = findDecls(parsed);
    codeEntityTree.treeData = new CodeDefTreeData(decls);
  }

  updateTestUI(mod) {
    var { runTestsInModuleButton, sourceEditor, moduleCommands } = this.ui,
        hasTests = false;
    if (this.editorPlugin.isJSEditorPlugin) {
      var ast = this.editorPlugin.getNavigator().ensureAST(sourceEditor),
          tests = testsFromSource(ast || sourceEditor.textString);
      hasTests = tests && tests.length;
    }

    runTestsInModuleButton.visible = runTestsInModuleButton.isLayoutable = hasTests;
    moduleCommands.layout.apply();
  }

  async save() {
    let {ui: {moduleList, sourceEditor}, state} = this,
        module = this.ui.moduleList.selection;

    if (!module) return this.setStatusMessage("Cannot save, no module selected", Color.red);

    let content = this.ui.sourceEditor.textString,
        system = this.systemInterface;

    // moduleChangeWarning is set when this browser gets notified that the
    // current module was changed elsewhere (onModuleChanged) and it also has
    // unsaved changes
    if (state.sourceHash !== string.hashCode(content)
     && state.moduleChangeWarning && state.moduleChangeWarning === module.name) {
      let really = await this.world().confirm(
        `The module ${module.name} you are trying to save changed elsewhere!\nOverwrite those changes?`);
      if (!really) {
        this.setStatusMessage("Save canceled");
        return;
      }
      state.moduleChangeWarning = null;
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // FIXME!!!!!! redundant with module load / prepare "mode" code!
    let format = (await system.moduleFormat(module.name)) || "esm",
        [_, ext] = module.name.match(/\.([^\.]+)$/) || [];
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    state.isSaving = true;
    try {
      // deal with non-js code, this needs to be cleaned up as well!
      if (ext !== "js") {
        if (module.nameInPackage === "package.json") {
          await system.packageConfChange(content, module.name);
          this.setStatusMessage("updated package config", Color.green);

        } else {
          await system.coreInterface.resourceWrite(module.name, content);
          this.setStatusMessage(`saved ${module.nameInPackage}`, Color.green);
        }

      // js save
      } else {
        if (module.isLoaded) { // is loaded in runtime
          await system.interactivelyChangeModule(
            module.name, content, {targetModule: module.name, doEval: true});
        } else await system.coreInterface.resourceWrite(module.name, content);
      }

      this.updateSource(content);
      await this.updateCodeEntities(module);
      await this.updateTestUI(module);

    }
    catch(err) { return this.showError(err); }
    finally { this.state.isSaving = false; }

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
    var ed = this.ui.sourceEditor;
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
  // system events
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  async onModuleChanged(evt) {
    if (this.state.isSaving) return;

    var m = module(evt.module),
        {selectedModule, selectedPackage} = this;

    if (!selectedPackage || m.package().address !== selectedPackage.address)
      return;

    var mInList = this.get("moduleList").values.find(ea => ea.url === m.id);
    if (selectedModule && selectedModule.url === m.id && mInList) {
      if (this.hasUnsavedChanges()) {
        this.addModuleChangeWarning(m.id);
        this.state.sourceHash = string.hashCode(await m.source());
      } else await this.get("sourceEditor").saveExcursion(() => this.onModuleSelected(mInList));

    }
  }

  async onModuleLoaded(evt) {
    if (this.state.isSaving) return;

    var m = module(evt.module),
        {selectedModule, selectedPackage} = this;

    if (!selectedPackage || m.package().address !== selectedPackage.address)
      return;

    // add new module to list
    var mInList = this.get("moduleList").values.find(ea => ea.url === m.id);
    if (!mInList) {
      await this.updateModuleList();
      mInList = this.get("moduleList").values.find(ea => ea.url === m.id);
    }

    if (selectedModule && selectedModule.url === m.id && mInList) {
      if (this.hasUnsavedChanges()) {
        this.addModuleChangeWarning(m.id);
        this.state.sourceHash = string.hashCode(await m.source());
      } else await this.get("sourceEditor").saveExcursion(() => this.onModuleSelected(mInList));
    }
  }

  addModuleChangeWarning(mid) {
    this.state.moduleChangeWarning = mid;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // events
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  setStatusMessage() {
    let ed = this.ui.sourceEditor;
    return ed.setStatusMessage.apply(ed, arguments);
  }

  focus(evt) {
    let {metaInfoText, sourceEditor} = this.ui,
        t = evt && evt.targetMorph === metaInfoText ?
          metaInfoText : sourceEditor;
    t.focus();
  }

  get keybindings() {
    return [
      {keys: {mac: "Meta-S", win: "Ctrl-S"}, command: "browser save"},
      {keys: "Alt-Up",                       command: "focus list with selection"},
      {keys: "F1",                           command: "focus module list"},
      {keys: "F2",                           command: "focus code entities"},
      {keys: "F3|Alt-Down",                  command: "focus source editor"},
      {keys: "Alt-R",                        command: "reload module"},
      {keys: "Alt-L",                        command: "load or add module"},
      {keys: "Ctrl-C Ctrl-T",                command: "run all tests in module"},
      {keys: "Ctrl-C T",                     command: "run tests at point"},
      {keys: "Ctrl-C B E F",                 command: "run setup code of tests (before and beforeEach)"},
      {keys: "Ctrl-C A F T",                 command: "run teardown code of tests (after and afterEach)"},
      {keys: "Alt-P",                        command: "browser history backward"},
      {keys: "Alt-N",                        command: "browser history forward"},
      {keys: "Alt-H",                        command: "browser history browse"},
      {keys: "Meta-Shift-L b a c k e n d",   command: "activate eval backend dropdown list"},
      {keys: "Alt-J",                        command: "jump to codeentity"}
    ].concat(super.keybindings);
  }

  get commands() {
    return browserCommands(this)
      .concat(EvalBackendChooser.default.activateEvalBackendCommand(this));
  }

  async onContextMenu(evt) {
    evt.stop();

    var target = evt.targetMorph;
    var {
      sourceEditor,
      moduleList,
      codeEntityTree
    } = this.ui;

    var items = [];
    if ([sourceEditor, moduleList, codeEntityTree].includes(target))
      items.push(...await target.menuItems());

    this.openMenu([...items, ...await this.menuItems()], evt);
  }

  menuItems() {
    let p = this.selectedPackage,
        m = this.selectedModule,
        c = this.selectedCodeEntity;

    return [
      ["browse snippet", () => {
        let codeSnip = `$world.execCommand("open browser", {`
        if (p) codeSnip += `packageName: "${p.name}"`;
        if (m) codeSnip += `, moduleName: "${m.name}"`;
        if (c) codeSnip += `, codeEntity: ${JSON.stringify(obj.select(c, ["name", "type"]))}`;
        codeSnip += `});`
        this.world().execCommand("open workspace", {content: codeSnip});
      }],
      m && ["open in text editor", () => {
        var lineNumber = c ? this.ui.sourceEditor.indexToPosition(c.node.start).row : null;
        this.world().execCommand("open file", {url: m.url, lineNumber});
      }]
    ].filter(Boolean)
  }
}
