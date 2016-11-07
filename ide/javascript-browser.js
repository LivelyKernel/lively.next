import { Color, pt, Rectangle } from "lively.graphics";
import { arr, promise, Path, string } from "lively.lang";
import { connect, disconnect, noUpdate } from "lively.bindings";
import { Window, morph, show, Label, HorizontalLayout } from "../index.js";
import { JavaScriptEditorPlugin } from "./js/editor-plugin.js";
import config from "../config.js";
import { HorizontalResizer } from "../resizers.js";
import { Icon } from "../icons.js";

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

    {name: "browser history backward", exec: browser => { browser.historyBackward(); return true; }},
    {name: "browser history forward", exec: browser => { browser.historyForward(); return true; }},

    {
      name: "browser history browse",
      async exec: browser => {
        var {left, right} = browser.state.history,
            current = arr.last(left),
            currentIdx = left.indexOf(current);

        var items = left.concat(right).map(loc => ({
          isListItem: true,
          string: loc.module ? loc.module.nameInPackage :
            loc.package ? loc.package.name || loc.package.address :
              "strange location",
          value: loc
        }))

        var {selected: [choice]} = await browser.world().filterableListPrompt("Jumpt to location", items, {preselect: currentIdx})
        if (choice) {
          if (left.includes(choice)) {
            browser.state.history.left = left.slice(0, left.indexOf(choice) + 1);
            browser.state.history.right = left.slice(left.indexOf(choice) + 1).concat(right);
          } else if (right.includes(choice)) {
            browser.state.history.left = left.concat(right.slice(0, right.indexOf(choice) + 1));
            browser.state.history.right = right.slice(right.indexOf(choice) + 1);
          }
          if (current) {
            var {scroll, cursor} = browser.historyGetLocation();
            current.scroll = scroll; current.cursor = cursor;
          }
          await browser.historySetLocation(choice);
        }

        return true;
      }
    },

    {
      name: "open code search",
      exec: browser => browser.world().execCommand("open code search", {browser})
    },

    {
      name: "choose and browse package resources",
      exec: browser => browser.world().execCommand("choose and browse package resources", {browser})
    },

    {
      name: "reload module",
      exec: async () => {
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
      }
    },

    {
      name: "load or add module",
      exec: async (browser) => {
        var p = browser.selectedPackage,
            system = await browser.systemInterface();
        try {
          var mods = await system.interactivelyAddModule(browser, p ? p.address : null);
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
      }
    },

    {
      name: "remove module",
      exec: async (browser) => {
        var p = browser.selectedPackage,
            m = browser.selectedModule,
            system = await browser.systemInterface();
        if (!p) return browser.world().inform("No package selected", {requester: browser});
        if (!m) return browser.world().inform("No module selected", {requester: browser});
        try {
          await system.interactivelyRemoveModule(browser, m.name || m.id);
        } catch(e) {
          e === "Canceled" ?
            browser.world().inform("Canceled module removal") :
            browser.showError(`Error while trying to load modules:\n${e.stack || e}`);
          return true;
        }

        await browser.updateModuleList(p);
        p && browser.selectPackageNamed(p.name);

        return true;
      }
    },

    {
      name: "add package",
      exec: async (browser) => {
        var what = await browser.world().multipleChoicePrompt(
          "Create a new package or load an existing one?",
          {choices: ["create", "load", "cancel"]});

        if (!what || what === "cancel") {
          browser.world().inform("Canceled add package");
          return true;
        }

        var pkg;
        try {
          var system = await browser.systemInterface();
          pkg = what === "create" ?
            await system.interactivelyCreatePackage(browser) :
            await system.interactivelyLoadPackage(
              browser, browser.selectedPackage ? browser.selectedPackage.address : null);
        } catch (e) {
          if (e === "Canceled") browser.world().inform("Canceled package creation");
          else throw e;
          return true;
        }

        await browser.reloadPackages();
        await browser.selectPackageNamed(pkg.name);
        return true;
      }
    },

    {
      name: "remove package",
      exec: async (browser) => {
        var p = browser.selectedPackage;
        if (!p) { browser.world().inform("No package selected"); return true; }

        try {
          var pkg = await (await browser.systemInterface()).interactivelyRemovePackage(browser, p.address);
        } catch (e) {
          if (e === "Canceled") browser.world().inform("Canceled package removel");
          else throw e;
          return true;
        }

        await browser.reloadPackages();
        await browser.selectPackageNamed(null);

        return true;
      }
    },

    {
      name: "run all tests in module",
      exec: (browser) => {
         var m = browser.selectedModule;
          if (!m) return browser.world().inform("No module selected", {requester: browser});
         return runTestsInModule(browser, m.name, null);
      }
    },

    {
      name: "run tests at point",
      exec: async (browser) => {
        var m = browser.selectedModule;
        if (!m) return browser.world().inform("No module selected", {requester: browser});

        var ed = browser.get("sourceEditor"),
            testDescriptors = await extractTestDescriptors(
              ed.textString, ed.document.positionToIndex(ed.cursorPosition));

        if (!testDescriptors || !testDescriptors.length)
          return browser.world().inform(
            "No test at " + JSON.stringify(ed.cursorPosition),
            {requester: browser});

        var spec = {
          fullTitle: arr.pluck(testDescriptors, "title").join(" "),
          type: arr.last(testDescriptors).type,
          file: m.name
        }

        return runTestsInModule(browser, m.name, spec);
       }
     },

     {
       name: "run setup code of tests (before and beforeEach)",
       exec: async (browser, args = {what: "setup"}) => {
          var m = browser.selectedModule;
          if (!m) return browser.world().inform("No module selected", {requester: browser});


          var ed = browser.get("sourceEditor"),
              testDescriptors = await extractTestDescriptors(
                ed.textString, ed.document.positionToIndex(ed.cursorPosition));

          if (!testDescriptors || !testDescriptors.length)
            return browser.world().inform(
              "No test at " + JSON.stringify(ed.cursorPosition),
              {requester: browser});

          // the stringified body of all before(() => ...) or after(() => ...) calls
          var what = (args && args.what) || "setup", // or: teardown
              prop = what === "setup" ? "setupCalls" : "teardownCalls",
              beforeCode = testDescriptors[0][prop].map(beforeFn => {
                var bodyStmts = beforeFn.body.body || [beforeFn.body];
                return bodyStmts.map(lively.ast.stringify).join("\n")
              }),
              {coreInterface: livelySystem} = await browser.systemInterface();

          try {
            for (let snippet of beforeCode)
              await livelySystem.runEval(beforeCode, {...ed.evalEnvironment});
            browser.setStatusMessage(`Executed ${beforeCode.length} test ${what} functions`);
          } catch (e) {
            browser.showError(new Error(`Error when running ${what} calls of test:\n${e.stack}`));
          }

          return true;
       }
     },

     {
       name: "run teardown code of tests (after and afterEach)",
        exec: async (browser) =>
          browser.execCommand(
            "run setup code of tests (before and beforeEach)",
            {what: "teardown"})
     }
  ]


  function focusList(list) {
    list.scrollSelectionIntoView();
    list.update();
    list.show();
    list.focus();
    return list
  }

  async function runTestsInModule(browser, moduleName, spec) {
    var runner = browser.get("test runner window");
    if (!runner)
      runner = await world.execCommand("open test runner");
    if (runner.minimized)
      runner.toggleMinimize();
    return spec ?
      runner.targetMorph[spec.type === "suite" ? "runSuite" : "runTest"](spec.fullTitle):
      runner.targetMorph.runTestFile(moduleName);
  }

  async function extractTestDescriptors(source, positionAsIndex) {
    // Expects mocha.js like test definitions: https://mochajs.org/#getting-started
    // Extracts nested "describe" and "it" suite and test definitions from the
    // source code and associates setup (before(Each)) and tear down (after(Each))
    // code with them. Handy to run tests at point etc.

    var {parse, query: {nodesAt}} = await System.import("lively.ast"),
         parsed = parse(source),
         nodes = nodesAt(positionAsIndex, parsed)
                   .filter(n => n.type === "CallExpression"
                             && n.callee.name
                             && n.callee.name.match(/describe|it/)
                             && n.arguments[0].type === "Literal"),
         setupCalls = nodes.map(n => {
                         var innerCode = Path("arguments.1.body.body").get(n);
                         if (!innerCode) return null;
                         return innerCode
                                   .filter(n =>
                                        n.expression && n.expression.type === "CallExpression"
                                     && n.expression.callee.name
                                     && n.expression.callee.name.match(/before(Each)?/))
                                   .map(n => n.expression.arguments[0]); }),
         teardownCalls = nodes.map(n => {
                         var innerCode = Path("arguments.1.body.body").get(n);
                         if (!innerCode) return null;
                         return innerCode
                                   .filter(n =>
                                        n.expression && n.expression.type === "CallExpression"
                                     && n.expression.callee.name
                                     && n.expression.callee.name.match(/after(Each)?/))
                                   .map(n => n.expression.arguments[0]); }),

         testDescriptors = nodes.map((n,i) => ({
           type: n.callee.name.match(/describe/) ? "suite" : "test",
           title: n.arguments[0].value,
           astNode: n,
           setupCalls: setupCalls[i],
           teardownCalls: teardownCalls[i],
         }));
    return testDescriptors;
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
      var text = browser.get("sourceEditor");
      text.cursorPosition = textPosition;
      text.centerRow(textPosition.row);
    }
    return browser;
  }

  constructor(props = {}) {
    super({
      name: "browser",
      extent: pt(700,600),
      ...props
    });
    this.targetMorph = this.build();
    this.state = {
      packageUpdateInProgress: null,
      moduleUpdateInProgress: null,
      history: {left: [], right: [], navigationInProgress: null}
    };
    this.onLoad();
  }

  get isBrowser() { return true; }

  focus() {
    this.get("sourceEditor").focus();
  }

  whenPackageUpdated() { return this.state.packageUpdateInProgress || Promise.resolve(); }
  whenModuleUpdated() { return this.state.moduleUpdateInProgress || Promise.resolve(); }

  build() {

    var jsPlugin = new JavaScriptEditorPlugin(config.codeEditor.defaultTheme),
        style = {
          // borderWidth: 1, borderColor: Color.gray,
          fontSize: 14, fontFamily: "Helvetica Neue, Arial, sans-serif"
        },
        textStyle = {
          borderWidth: 1, borderColor: Color.gray,
          type: "text",
          ...config.codeEditor.defaultStyle,
          plugins: [jsPlugin]
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
          packageCommandBoxBounds,
          moduleCommandBoxBounds,
          resizerBounds,
          sourceEditorBounds
        ] = bounds.extent().extentAsRectangle().divide([
          new Rectangle(0,   0,    1,   0.04),
          new Rectangle(0,   0.04, 0.5, 0.39),
          new Rectangle(0.5, 0.04, 0.5, 0.39),
          new Rectangle(0,   0.43, 0.5, 0.04),
          new Rectangle(0.5, 0.43, 0.5, 0.04),
          new Rectangle(0,   0.47, 1,   0.01),
          new Rectangle(0,   0.48, 1,   0.58)]),

        container = morph({
          ...style,
          bounds,
          submorphs: [
            {name: "browserCommands", bounds: browserCommandsBounds, fill: Color.gray.lighter(),
             draggable: false, layout: new HorizontalLayout({spacing: 2, autoResize: false}),
             submorphs: [
              {...btnStyle, name: "searchButton", label: Icon.makeLabel("search"), tooltip: "code search"},
              {...btnStyle, name: "browseModulesButton", label: Icon.makeLabel("navicon"), tooltip: "list all modules"},
              {...btnStyle, name: "historyBackwardButton", label: Icon.makeLabel("step-backward"), tooltip: "back in browse history"},
              {...btnStyle, name: "browseHistoryButton", label: Icon.makeLabel("history"), tooltip: "show browse history"},
              {...btnStyle, name: "historyForwardButton", label: Icon.makeLabel("step-forward"), tooltip: "forward in browse history"},
              ]},
            {name: "packageList", bounds: packageListBounds, type: "list", ...style,
             borderRight: {color: Color.gray, width: 1},
             borderBottom: {color: Color.gray, width: 1},
             borderTop: {color: Color.gray, width: 1},
             },
            {name: "moduleList", bounds: moduleListBounds, type: "list", ...style,
             borderBottom: {color: Color.gray, width: 1},
             borderTop: {color: Color.gray, width: 1}},
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
               {...btnStyle, name: "removeModuleButton", label: Icon.makeLabel("minus"), tooltip: "remove package"}]},
            new HorizontalResizer({name: "hresizer", bounds: resizerBounds}),
            {name: "sourceEditor", bounds: sourceEditorBounds, ...textStyle, doSave: () => { this.save(); }}
          ]
        });

    this._inLayout = false;
    connect(this, 'extent', this, 'relayout');

    connect(container.get("searchButton"), 'fire', this, 'execCommand', {converter: () => "open code search"});
    connect(container.get("historyBackwardButton"), 'fire', this, 'execCommand', {converter: () => "browser history backward"});
    connect(container.get("historyForwardButton"), 'fire', this, 'execCommand', {converter: () => "browser history forward"});
    connect(container.get("browseHistoryButton"), 'fire', this, 'execCommand', {converter: () => "browser history browse"});

    connect(container.get("browseModulesButton"), 'fire', this, 'execCommand', {converter: () => "choose and browse package resources"});
    connect(container.get("addPackageButton"), 'fire', this, 'execCommand', {converter: () => "add package"});
    connect(container.get("removePackageButton"), 'fire', this, 'execCommand', {converter: () => "remove package"});
    connect(container.get("addModuleButton"), 'fire', this, 'execCommand', {converter: () => "load or add module"});
    connect(container.get("removeModuleButton"), 'fire', this, 'execCommand', {converter: () => "remove module"});

    container.get("hresizer").addScalingAbove(container.get("packageList"));
    container.get("hresizer").addFixed(container.get("packageCommands"));
    container.get("hresizer").addScalingAbove(container.get("moduleList"));
    container.get("hresizer").addFixed(container.get("moduleCommands"));
    container.get("hresizer").addScalingBelow(container.get("sourceEditor"));

    // FIXME? how to specify that directly??
    jsPlugin.evalEnvironment = {
      get targetModule() {
        var browser = jsPlugin.textMorph.getWindow();
        if (!browser.selectedModule) throw new Error("Browser has no module selected");
        return browser.selectedModule.name;
      },
      context: jsPlugin.textMorph,
      get format() {
        return lively.modules.module(this.targetModule).format() || "global";
      }
    }
    return container;
  }

  relayout() {
    if (this._inLayout) return;
    this._inLayout = true;

    var container = this.targetMorph,
        packageList = this.get("packageList"),
        moduleList = this.get("moduleList"),
        browserCommands = this.get("browserCommands"),
        packageCommands = this.get("packageCommands"),
        moduleCommands = this.get("moduleCommands"),
        ed = this.get("sourceEditor"),
        resizer = this.get("hresizer"),
        listEditorRatio = packageList.height / (container.height - resizer.height);

    container.setBounds(this.targetMorphBounds());

    [packageList, packageCommands, moduleList, moduleCommands]
      .forEach(ea => ea.width = container.width/2);
    [packageCommands, moduleCommands]
      .forEach(ea => ea.height = resizer.top-packageList.bottom);

    moduleCommands.left = moduleList.left = packageList.right;

    ed.height = container.height-resizer.bottom;
    browserCommands.width = ed.width = resizer.width = container.width;

    this._inLayout = false;
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
      {keys: "Ctrl-C B E F", command: "run setup code of tests (before and beforeEach)"},
      {keys: "Ctrl-C A F T", command: "run teardown code of tests (after and afterEach)"},
      {keys: "Alt-P", command: "browser history backward"},
      {keys: "Alt-N", command: "browser history forward"},
      {keys: "Alt-H", command: "browser history browse"},
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

  set selectedModule(m) {
    var mlist = this.get("moduleList");
    if (!m) mlist.selection = null;
    else this.selectModuleNamed(typeof m === "string" ? m : m.name || m.id);
  }

  get selectedPackage() {
    return this.get("packageList").selection;
  }

  set selectedPackage(p) {
    if (!p) this.get("packageList").selection = null;
    else this.selectPackageNamed(typeof p === "string" ? p : p.url || p.address);
  }

  async packageResources(p) {
    // await this.packageResources(this.selectedPackage)
    return (await (await this.systemInterface()).resourcesOfPackage(p.address))
      .filter(({name}) => name.endsWith(".js") || name.endsWith(".json"));
  }

  async onLoad() {
    this.reset();
    this.reloadPackages();
  }

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
    } finally {
      this.state.packageUpdateInProgress = null;
      deferred && deferred.resolve(p);
    }
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
      this.get("sourceEditor").cursorPosition = {row: 0, column: 0}

      this.historyRecord();
    } finally {
      this.state.moduleUpdateInProgress = null;
      deferred && deferred.resolve(m);
    }
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
          module.name, content, {targetModule: module.name, doEval: true});
      } else await system.moduleWrite(module.name, content);
    } catch(err) { return this.world().logError(err); }

    this.world().setStatusMessage("saved " + module.nameInPackage, Color.green);
  }

  // -=-=-=-=-
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

}