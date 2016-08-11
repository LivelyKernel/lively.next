import { arr, obj } from "lively.lang";
import { pt, Color } from "lively.graphics";
import { morph, Morph, Window } from "./index.js";
import { GridLayout } from "lively.morphic/layout.js";

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
      targetMorph: morph({
        type: "text",
        textString: props.content || "3 + 4",
        fixedWidth: true,
        fixedHeight: true
      }),
      extent: pt(400,300),
      ...obj.dissoc(props, ["content"])
    });
  }

}



import { connect, disconnect } from "lively.bindings";
import { localInterface as livelySystem } from "lively-system-interface";

export class Browser extends Window {

  constructor(props) {
    super({
      name: "browser",
      extent: pt(500,400),
      ...props,
      targetMorph: this.build()
    });
    this.onLoad();
  }

  build() {
    var style = {borderWidth: 1, borderColor: Color.gray},
        textStyle = {...style, type: "text", fixedWidth: true, fixedHeight: true, clipMode: "auto"};
    return morph({
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
  }


  reset() {
    connect(this.get("packageList"), "selection", this, "onPackageSelected");
    connect(this.get("moduleList"), 'selection', this, 'onModuleSelected');
    this.get("packageList").items = [];
    this.get("moduleList").items = [];
    this.get("sourceEditor").textString = ""
  }

  onLoad() {
    this.reset();
    this.get("packageList").items = livelySystem.getPackages().map(p => ({isListItem: true, string: p.name, value: p}));
  }

  onPackageSelected(p) {
    if (!p) {
      this.get("moduleList").items = [];
      this.get("sourceEditor").textString = "";
      return;
    }
    
    this.get("moduleList").selection = null;
    this.get("moduleList").items = p.modules.map(m => ({
      string: m.name.slice(p.address.length).replace(/^\//, ""),
      value: m,
      isListItem: true
    }));
  }

  async onModuleSelected(m) {
    if (!m) {
      this.get("sourceEditor").textString = "";
      return;
    }
    
    var source = await livelySystem.moduleRead(m.name);
    this.get("sourceEditor").textString = source;
  }

  updateModuleList() {/*FIXME*/}

  async save() {
    var module = this.get("moduleList").selection;
    if (!module) return show("Cannot save, no module selected");

    try {
      await livelySystem.interactivelyChangeModule(
        this,
        module.name,
        this.get("sourceEditor").textString,
        {targetModule: module.name, doEval: true});
    
    } catch (err) { return this.world().logError(err); }

    this.world().setStatusMessage("saved " + module.name, Color.green);
  }
}
