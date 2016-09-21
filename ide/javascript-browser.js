import { Color, pt, Rectangle } from "lively.graphics";
import { arr, promise } from "lively.lang";
import { connect, disconnect } from "lively.bindings";
import { Window, morph, show } from "../index.js";
import { GridLayout } from "../layout.js";
import CodeEditor from "./code-editor.js";


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// commands
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function commandsForBrowser(browser) {
  var pList = browser.get("packageList"),
      mList = browser.get("moduleList"),
      editor = browser.get("sourceEditor"),
      world = browser.world();

  return [
    {name: "focus list with selection", exec: () => focusList(mList.selection ? mList : pList)},
    {name: "focus package list", exec: () => focusList(pList)},
    {name: "focus module list", exec: () => focusList(mList)},
    {name: "focus source editor", exec: () => { editor.focus(); editor.show(); return true; }},

    {name: "reload module", exec: async () => {
      var m = browser.selectedModule;
      if (!m) return browser.world().inform("No module selected", {requester: browser});
      try {
        await (await browser.systemInterface()).interactivelyReloadModule(null, m.name);
      } catch(err) {
        browser.world().inform(`Error while reloading ${m.name}:\n${err.stack || err}`, {requester: browser});
        return true;
      }
      show(`Reloaded ${m.name}`);
      browser.selectModuleNamed(m.nameInPackage);
      return true;
    }},

    {name: "load or add module", exec: async (browser) => {    
      var p = browser.selectedPackage;
      try {
        var mods = await (await browser.systemInterface()).interactivelyAddModule(null, p ? p.address : null, browser.world());
      } catch(e) {
        e === "Canceled" ?
          show(e) :
          browser.world().inform(`Error while trying to load modules:\n${e.stack || e}`, {requester: browser});
        return;
      }

      mods.forEach(({name, error}) =>
        error ? show(`Error while loading module ${name}: ${error.stack || error}`) :
                show(`Module ${name} loaded`))
      await browser.updateModuleList(p);
      mods.length && browser.selectModuleNamed(mods[0].name);
      return true;
    }},

    {name: "run all tests in module",
     exec: (browser) => {
       var m = browser.selectedModule;
        if (!m) return browser.world().inform("No module selected", {requester: browser});
       return runTestsInModule(browser, m.name, null);
     }},

    {name: "run tests at point",
     exec: async (browser) => {
       var m = browser.selectedModule;
        if (!m) return browser.world().inform("No module selected", {requester: browser});

        var {parse, query: {nodesAt}} = await System.import("lively.ast");
        var ed = browser.get("sourceEditor").text;
        var source = ed.textString;
        var parsed = parse(source);
        var nodes = nodesAt(ed.document.positionToIndex(ed.cursorPosition), parsed)
          .filter(n => n.type === "CallExpression" && n.callee.name && n.callee.name.match(/describe|it/) && n.arguments[0].type === "Literal")
            .map(n => ({
              type: n.callee.name.match(/describe/) ? "suite" : "test",
              title: n.arguments[0].value,
          }))

        if (!nodes.length)
          return browser.world().inform("No test at " + JSON.stringify(ed.cursorPosition), {requester: browser});

       var spec = {fullTitle: arr.pluck(nodes, "title").join(" "), type: arr.last(nodes).type, file: m.name}
       return runTestsInModule(browser, m.name, spec);
     }}
  ]


  function focusList(list) {
    list.scrollSelectionIntoView();
    list.update();
    list.show();
    list.focus();
    return list
  }

  function runTestsInModule(browser, moduleName, spec) {
    var runner = browser.get("test runner window");
    if (!runner)
      runner = world.execCommand("open test runner");
    if (runner.minimized)
      runner.toggleMinimize();
    return spec ?
      runner.targetMorph[spec.type === "suite" ? "runSuite" : "runTest"](spec.fullTitle):
      runner.targetMorph.runTestFile(moduleName);
  }

}


// -=-=-=-=-=-
// Browser UI
// -=-=-=-=-=-

export class Browser extends Window {

  static async browse(packageName, moduleName, textPosition = {row: 0, column: 0}, browserOrProps = {}) {
    var browser = browserOrProps instanceof Browser ? browserOrProps : new this(browserOrProps);
    if (!browser.world())
      browser.openInWorldNearHand();
    await browser.whenRendered();
    if (packageName) await browser.selectPackageNamed(packageName);
    if (packageName && moduleName) await browser.selectModuleNamed(moduleName);
    if (textPosition) {
      var text = browser.get("sourceEditor").text;
      text.cursorPosition = textPosition;
      text.centerRow(textPosition.row);
    }
    return browser;
  }

  constructor(props = {}) {
    super({
      name: "browser",
      extent: pt(700,600),
      ...props,
      targetMorph: this.build()
    });
    this.state = {associatedSearchPanel: null, packageUpdateInProgress: null, moduleUpdateInProgress: null};
    this.onLoad();
  }

  get isBrowser() { return true; }

  focus() {
    this.get("sourceEditor").focus();
  }

  whenPackageUpdated() { return this.state.packageUpdateInProgress || Promise.resolve(); }
  whenModuleUpdated() { return this.state.moduleUpdateInProgress || Promise.resolve(); }

  build() {
    var style = {borderWidth: 1, borderColor: Color.gray, fontSize: 14, fontFamily: "Helvetica Neue, Arial, sans-serif"},
        textStyle = {borderWidth: 1, borderColor: Color.gray, fontSize: 12, type: CodeEditor, mode: "javascript"},
        container = morph({
          ...style,
          layout: new GridLayout({
            grid: [["packageList", "moduleList"],
                   ["sourceEditor", "sourceEditor"]]}),
          submorphs: [
            {name: "packageList", type: "list", ...style},
            {name: "moduleList", type: "list", ...style},
            {name: "sourceEditor", ...textStyle, doSave() { this.owner.owner/*FIXME*/.save(); }}
          ]
        });
    // FIXME? how to specify that directly??
    container.layout.grid.row(0).adjustProportion(-1/5);
    container.get("sourceEditor").text.__defineGetter__("evalEnvironment", function () {
      var browser = this.getWindow();
      if (!browser.selectedModule) throw new Error("Browser has no module selected");
      return {
        targetModule: browser.selectedModule.name,
        context: this.doitContext || this.owner.doitContext || this
      }
    });
    return container;
  }

  get keybindings() {
    return [
      {keys: "Alt-Up", command: "focus list with selection"},
      {keys: "F1", command: "focus package list"},
      {keys: "F2", command: "focus module list"},
      {keys: "F3|Alt-Down", command: "focus source editor"},
      {keys: "Alt-R", command: "reload module"},
      {keys: "Alt-L", command: "load or add module"},
      {keys: "Ctrl-C Ctrl-T", command: "run all tests in module"},
      {keys: "Ctrl-C T", command: "run tests at point"},
    ].concat(super.keybindings);
  }

  get commands() { return commandsForBrowser(this); }

  reset() {
    connect(this.get("packageList"), "selection", this, "onPackageSelected");
    connect(this.get("moduleList"), 'selection', this, 'onModuleSelected');
    this.get("packageList").items = [];
    this.get("moduleList").items = [];
    this.get("sourceEditor").textString = ""
  }

  async systemInterface() {
    return (await System.import("lively-system-interface")).localInterface;
  }

  get selectedModule() {
    return this.get("moduleList").selection;
  }

  get selectedPackage() {
    return this.get("packageList").selection;
  }

  async packageResources(p) {
    // await this.packageResources(this.selectedPackage)
    var system = await this.systemInterface(),
        resourceURLs = await system.resourcesOfPackage(p.address),
        loadedModules = arr.groupByKey(p.modules, "name");
    return resourceURLs
      // .filter(url => !url.endsWith("/"))
      .filter(url => url.endsWith(".js") || url.endsWith(".json"))
      .map(url => {
        var nameInPackage = url.replace(p.address, "").replace(/^\//, "");
        return url in loadedModules ?
          {...loadedModules[url][0], isLoaded: true, nameInPackage} :
          {isLoaded: false, name: url, nameInPackage}
      })
      .map(ea => ({...ea, package: p, nameInPackage: ea.nameInPackage}));
  }

  async onLoad() {
    this.reset();
    this.get("packageList").items = (await (await this.systemInterface()).getPackages()).map(p => ({isListItem: true, string: p.name, value: p}));
  }

  async selectPackageNamed(pName) {
    var p = this.get("packageList").selection = this.get("packageList").values.find(({address, name}) => address === pName || name === pName);
    await this.whenPackageUpdated();
    return p;
  }

  async selectModuleNamed(mName) {
    var m = this.get("moduleList").selection = this.get("moduleList").values.find(({nameInPackage, name}) => mName === name || mName === nameInPackage);
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
        return;
      }
  
      this.title = "browser – " + p.name;
  
      this.get("packageList").scrollSelectionIntoView();
      this.get("moduleList").selection = null;
      
      await this.updateModuleList(p);
    } finally { deferred && deferred.resolve(p); }
  }

  async onModuleSelected(m) {

    var pack = this.get("packageList").selection;

    if (!m) {
      this.get("sourceEditor").textString = "";
      this.title = "browser – " + pack && pack.name || "";
      return;
    }

    if (!this.state.moduleUpdateInProgress) {
      var deferred = promise.deferred()
      this.state.moduleUpdateInProgress = deferred.promise;
    }

    try {
      var system = await this.systemInterface();
  
      if (!m.isLoaded && m.name.endsWith("js")) {
        var err;
        try {
          await System.import(m.name);
        } catch(e) { err = e; }
  
        if (err) this.world().logError(err);
  
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
      this.title = "browser – " + pack.name + "/" + m.nameInPackage;
      var source = await system.moduleRead(m.name);
      this.get("sourceEditor").textString = source;
      this.get("sourceEditor").text.cursorPosition = {row: 0, column: 0}
    } finally { deferred && deferred.resolve(m); }
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

  async save() {
    var module = this.get("moduleList").selection;
    if (!module) return show("Cannot save, no module selected");

    var content = this.get("sourceEditor").textString,
        system = await this.systemInterface();

    try {
      if (module.isLoaded) { // is loaded in runtime
        await system.interactivelyChangeModule(
          this, module.name, content,
          {targetModule: module.name, doEval: true});      
      } else await system.moduleWrite(module.name, content);
    } catch(err) { return this.world().logError(err); }

    this.world().setStatusMessage("saved " + module.nameInPackage, Color.green);
  }

}