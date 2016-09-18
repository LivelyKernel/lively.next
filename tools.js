import { arr, obj, promise } from "lively.lang";
import { pt, Color, Rectangle } from "lively.graphics";
import { morph, Morph, Window, show } from "./index.js";
import { FilterableList } from "./list.js";
import { GridLayout } from "lively.morphic/layout.js";
import CodeEditor from "./ide/code-editor.js";

export class ObjectDrawer extends Morph {

  constructor(props) {
    super({
      name: "object-drawer",
      position: pt(20, 20),
      extent: pt(4 * (140 + 10) + 15, 140),
      fill: Color.white,
      borderWidth: 1,
      borderColor: Color.gray,
      ...props
    });
    this.setup();
  }

  setup() {
    var n = 4,
        margin = pt(5,5),
        objExt = pt(((this.width - margin.x) / n) - margin.x, this.height - margin.y*2),
        pos = margin;

    this.addMorph({
      type: "ellipse",
      position: pos, extent: objExt,
      fill: Color.random(), grabbable: false,
      onDrag: doCopy,
      init() { this.fill = Color.random(); }
    });

    pos = arr.last(this.submorphs).topRight.addXY(margin.x, 0);

    this.addMorph({
      position: pos, extent: objExt,
      fill: Color.random(), grabbable: false,
      onDrag: doCopy,
      init() { this.fill = Color.random(); }
    });

    pos = arr.last(this.submorphs).topRight.addXY(margin.x, 0);

    this.addMorph({
      type: "image",
      position: pos, extent: objExt,
      fill: null, grabbable: false,
      onDrag: doCopy
    });

    pos = arr.last(this.submorphs).topRight.addXY(margin.x, 0);

    this.addMorph({
      type: "text",
      textString: "Lively rocks!",
      position: pos, extent: objExt,
      fill: Color.white, grabbable: false,
      readOnly: true,
      fontSize: 16,
      onDrag: doCopy,
      draggable: true,
      init() {
        this.draggable = false;
        this.grabbable = false;
        this.readOnly = false;
      }
    });

    function doCopy(evt) {
      evt.stop();
      var copy = Object.assign(this.copy(), {position: evt.positionIn(this).negated()});
      var name = copy.constructor.name.toLowerCase();
      name = (name[0].match(/[aeiou]/) ? "an " : "a ") + name;
      var i = 1; while (this.world().get(name + " " + i)) i++
      copy.name = name + " " + i;
      evt.hand.grab(copy);
      delete copy.onDrag;
      copy.init && copy.init();
    }
  }
}

export class Workspace extends Window {

  constructor(props = {}) {
    super({
      title: "Workspace",
      targetMorph: {
        type: CodeEditor,
        textString: props.content || "var i = 2 + 3",
        mode: "javascript"
      },
      extent: pt(400,300),
      ...obj.dissoc(props, ["content"])
    });
  }

}



import { connect, disconnect } from "lively.bindings";

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
    this.state = {associatedSearchPanel: null};
    this.onLoad();
  }

  get isBrowser() { return true; }

  focus() {
    this.get("sourceEditor").focus();
  }

  build() {
    var style = {borderWidth: 1, borderColor: Color.gray, fontSize: 14, fontFamily: "Helvetica Neue, Arial, sans-serif"},
        textStyle = {borderWidth: 1, borderColor: Color.gray, fontSize: 12, type: CodeEditor, mode: "plain"},
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
    container.get("sourceEditor").text.__defineGetter__("evalEnvironment", () => {
      if (!this.selectedModule) throw new Error("Browser has no module selected");
      return {
        targetModule: this.selectedModule.name
      }
    })
    return container;
  }


  get keybindings() {
    return [
      {keys: "Alt-Up", command: "focus list with selection"},
      {keys: "F1", command: "focus package list"},
      {keys: "F2", command: "focus module list"},
      {keys: "F3|Alt-Down", command: "focus source editor"},
    ].concat(super.keybindings);
  }

  get commands() {
    var pList = this.get("packageList"),
        mList = this.get("moduleList"),
        editor = this.get("sourceEditor");
    return [
      {name: "focus list with selection", exec: () => focusList(mList.selection ? mList : pList)},
      {name: "focus package list", exec: () => focusList(pList)},
      {name: "focus module list", exec: () => focusList(mList)},
      {name: "focus source editor", exec: () => { editor.focus(); editor.show(); return true; }},
    ]

    function focusList(list) {
      list.scrollSelectionIntoView();
      list.update();
      list.show();
      list.focus();
      return list
    }
  }

  get keybindings() {
    return [
      {keys: "Alt-Up", command: "focus list with selection"},
      {keys: "F1", command: "focus package list"},
      {keys: "F2", command: "focus module list"},
      {keys: "F3|Alt-Down", command: "focus source editor"},
    ].concat(super.keybindings);
  }

  get commands() {
    var pList = this.get("packageList"),
        mList = this.get("moduleList"),
        editor = this.get("sourceEditor");
    return [
      {name: "focus list with selection", exec: () => focusList(mList.selection ? mList : pList)},
      {name: "focus package list", exec: () => focusList(pList)},
      {name: "focus module list", exec: () => focusList(mList)},
      {name: "focus source editor", exec: () => { editor.focus(); editor.show(); return true; }},
    ]

    function focusList(list) {
      list.scrollSelectionIntoView();
      list.update();
      list.show();
      list.focus();
      return list
    }
  }

  reset() {
    connect(this.get("packageList"), "selection", this, "onPackageSelected");
    connect(this.get("moduleList"), 'selection', this, 'onModuleSelected');
    this.get("packageList").items = [];
    this.get("moduleList").items = [];
    this.get("sourceEditor").textString = ""
  }

  async allPackages() {
    var livelySystem = (await System.import("lively-system-interface")).localInterface;
    return livelySystem.getPackages();
  }


  get selectedModule() {
    return this.get("moduleList").selection;
  }

// await this.getWindow().modulesOfPackage(this.getWindow().get("packageList").selection)
// this.getWindow().get("packageList").selection.address
// await livelySystem.getPackage(this.getWindow().get("packageList").selection.address)

  async modulesOfPackage(p) {
    var livelySystem = (await System.import("lively-system-interface")).localInterface
        p = await livelySystem.getPackage(p.address);
    return p.modules.map(m => ({...m, package: p, nameInPackage: m.name.replace(p.address, "").replace(/^\//, "")}));
  }

  async allModules() {
    var modules = [];
    for (let p of await this.allPackages())
      modules.push(...this.modulesOfPackage(p))
    return modules;
  }

  async onLoad() {
    this.reset();
    this.get("packageList").items = (await this.allPackages()).map(p => ({isListItem: true, string: p.name, value: p}));
  }

  async selectPackageNamed(pName) {
    var p = this.get("packageList").selection = this.get("packageList").values.find(({name}) => name === pName);
    await this.get("moduleList").whenRendered();
    return p;
  }

  async selectModuleNamed(mName) {
    var m = this.get("moduleList").selection = this.get("moduleList").values.find(({nameInPackage}) => mName === nameInPackage);
    await this.get("sourceEditor").text.whenRendered();
    try { // FIXME, text.whenRendered() doesn't ensure that textString is available...
      await promise.waitFor(1000, () => !!this.get("sourceEditor").text.textString);
    } catch(err) {}
    return m;
  }

  async onPackageSelected(p) {
    if (!p) {
      this.get("moduleList").items = [];
      this.get("sourceEditor").textString = "";
      this.title = "browser";
      return;
    }

    this.title = "browser – " + p.name;

    this.get("packageList").scrollSelectionIntoView();
    this.get("moduleList").selection = null;

    this.get("moduleList").items = arr.sortBy(
      (await this.modulesOfPackage(p)).map(m => ({string: m.nameInPackage, value: m, isListItem: true})),
      ({string}) => string.toLowerCase());
  }

  async onModuleSelected(m) {
    var pack = this.get("packageList").selection,
        module = this.get("moduleList").selection;

    if (!m) {
      this.get("sourceEditor").textString = "";
      this.title = "browser – " + pack && pack.name || "";
      return;
    }

    this.get("moduleList").scrollSelectionIntoView();
    this.title = "browser – " + pack.name + "/" + module.nameInPackage;
    var livelySystem = (await System.import("lively-system-interface")).localInterface;
    var source = await livelySystem.moduleRead(m.name);
    this.get("sourceEditor").textString = source;
    this.get("sourceEditor").text.cursorPosition = {row: 0, column: 0}
  }

  updateModuleList() {/*FIXME*/}

  async save() {
    var module = this.get("moduleList").selection;
    if (!module) return show("Cannot save, no module selected");

    try {
      var livelySystem = (await System.import("lively-system-interface")).localInterface;
      await livelySystem.interactivelyChangeModule(
        this,
        module.name,
        this.get("sourceEditor").textString,
        {targetModule: module.name, doEval: true});
    
    } catch (err) { return this.world().logError(err); }

    this.world().setStatusMessage("saved " + module.name, Color.green);
  }
}