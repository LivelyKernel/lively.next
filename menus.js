import { Text, Morph, show } from "./index.js";
import { pt, Color } from "lively.graphics";

export class MenuItem extends Text {

  constructor(textString, action, props) {
    super({
     fixedWidth: false, fixedHeight: false,
     fill: null,
     fontSize: 14,
     draggable: false,
     readOnly: true,
     nativeCursor: "pointer",
     textString,
     action,
     ...props});
  }

  get action() { return this.getProperty("action") }
  set action(value) { this.addValueChange("action", value); }

  get isMenuItem() { return true; }

  select() {
    this.fontColor = Color.white;
    this.fill = Color.blue;
  }

  deselect() {
    this.fill = Color.null;
    this.fontColor = Color.black;
  }

  onHoverIn(evt) {
    this.owner.itemMorphs.forEach(ea => ea !== this && ea.deselect());
    this.select();
  }

  onHoverOut(evt) {
    this.deselect();
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

  get title() { return this.getProperty("title") }
  set title(value) { this.addValueChange("title", value); }

  get items() { return this.getProperty("items") }
  set items(value) { this.addValueChange("items", value); }

  get padding() { return this.getProperty("padding") }
  set padding(value) { this.addValueChange("padding", value); }

  get itemMorphs() {
    return this.submorphs.filter(ea => ea.isMenuItem);
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
      var itemMorph = this.addMorph(new MenuItem(item[0], item[1], {position: pos}));
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
