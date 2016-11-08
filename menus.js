import { Text, Morph, show } from "./index.js";
import { arr, obj } from "lively.lang";
import { pt, Color } from "lively.graphics";

export class MenuItem extends Text {

  constructor({textString, action, props} = {}) {
    super({
      fixedWidth: false, fixedHeight: false,
      fill: null,
      fontSize: 14,
      draggable: false,
      readOnly: true,
      nativeCursor: "pointer",
      textString,
      action,
      ...obj.dissoc(props, ["selected"])
    });
    this.selected = props.hasOwnProperty("selected") ? props.selected : false;
  }

  get selected() { return this.getProperty("selected"); }
  set selected(value) {
    if (this.selected === value) return;
    this.addValueChange("selected", value);
    if (value) {
      this.fontColor = Color.white;
      this.fill = Color.blue;
    } else {
      this.fill = Color.null;
      this.fontColor = Color.black;
    }
  }

  get action() { return this.getProperty("action") }
  set action(value) { this.addValueChange("action", value); }

  get isMenuItem() { return true; }

  onHoverIn(evt) {
    this.owner.itemMorphs.forEach(ea => ea !== this && (ea.selected = false));
    this.selected = true;
  }

  onHoverOut(evt) {
    this.selected = false;
  }

  onMouseDown(evt) {
    try {
      if (typeof this.action !== "function")
        throw new Error(`Menu item ${this.textString} as no executable action!`)
      this.action();
    } catch (err) {
      var w = this.world();
      if (w) w.logError(err);
      else console.error(err);
    }
  }
}


export class Menu extends Morph {

  static forItems(items, opts = {title: ""}) {
    return new this({...opts, title: opts.title, items});
  }


  constructor(props) {
    super({
      dropShadow: true,
      title: null,
      padding: 3,
      borderWidth: 1,
      borderColor: Color.gray,
      ...props
    });
    this.updateMorphs();
  }

  remove() {
     this.animate({
        opacity: 0,
        duration: 300,
        onFinish: () => super.remove()
      });
  }

  get title() { return this.getProperty("title") }
  set title(value) { this.addValueChange("title", value); }

  get items() { return this.getProperty("items") }
  set items(items) {
    items = items.map(this.ensureItem.bind(this));
    this.addValueChange("items", items);
  }

  get padding() { return this.getProperty("padding") }
  set padding(value) { this.addValueChange("padding", value); }

  get itemMorphs() {
    return this.submorphs.filter(ea => ea.isMenuItem);
  }

  ensureItem(item) {
    var invalid = ["invalid item", () => show("invalid item")];
    if (!item) return invalid;

    if (Array.isArray(item)) {
      var [name, exec] = item;
      if (typeof name !== "string" || typeof exec !== "function") return invalid;
      return item;
    }

    if (item.command) {
      var {command, showKeyShortcuts, target, alias, args} = item;
      if (!command || !target) return invalid;
      if (showKeyShortcuts === undefined) showKeyShortcuts = true;
      var keys = !showKeyShortcuts ?
          null :
          typeof showKeyShortcuts === "string" ?
            showKeyShortcuts :
            target.keysForCommand(command),
          descr = (alias || command) + (keys ? ` [${keys}]` : "");
      return [descr, () => target.execCommand(command, args)]
    }

    return invalid;
  }

  updateMorphs() {
    this.submorphs = [];
    var p = this.padding;
    var maxWidth = 0, pos = pt(p, p);

    if (this.title) {
      var title = this.addMorph(Text.makeLabel(this.title, {position: pos, fontSize: 16, draggable: false}));
      pos = title.bottomLeft;
      maxWidth = Math.max(title.width, maxWidth);
    }

    this.items.forEach(item => {
      var itemMorph = this.addMorph(new MenuItem({
           textString: item[0],
           action: item[1],
           props: {position: pos}
      }));
      pos = itemMorph.bottomLeft;
      maxWidth = Math.max(itemMorph.width + 6/*FIXME*/, maxWidth);
    });

    this.submorphs.forEach(ea => {
      ea.fit();
      ea.fixedWidth = true;
      ea.fixedHeight = true;
      ea.width = maxWidth;
    });

    this.extent = pt(maxWidth + 2*p, pos.y + p);
  }

}
