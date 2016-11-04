import { fun, arr } from "lively.lang"
import { show, morph, Label, Morph } from "../index.js"
import { pt, Rectangle, rect, Color } from "lively.graphics"
import { connect } from "lively.bindings"
import { TextAttribute, TextStyleAttribute } from "./attribute.js";
import { ColorPicker } from "../ide/style-editor.js";

const cachedControls = new WeakMap();

export class RichTextControl extends Morph {

  static openDebouncedFor(textMorph) {
    var selection = textMorph.selection;

    if (selection.isEmpty()) {
      var ctrl = cachedControls.get(textMorph);
      ctrl && ctrl.removeFocus();
      return;
    }

    fun.debounceNamed(textMorph.id+"openRichTextControl", 600, () => {
      var ctrl = cachedControls.get(textMorph);
      if (selection.isEmpty()) { ctrl && ctrl.removeFocus(); return }
      if (!ctrl) {
        ctrl = new RichTextControl();
        cachedControls.set(textMorph, ctrl);
      }
      ctrl.focusOn(textMorph);
    })();
  }

  constructor(props = {}) {

    super({
      name: "rich-text-control",
      dropShadow: true,
      extent: pt(200,35),
      fill: Color.gray,
      borderRadius: 7,
      ...props
    });

    connect(this, "extent", this, "relayout");
    this.build();
    this.relayout();
  }

  removeFocus() {
     if (this.target) {
       this.remove();
       this.target = null;
     }
  }

  focusOn(textMorph) {
      this.openInWorld();
      this.topCenter = textMorph.getGlobalTransform()
          .transformRectToRect(textMorph.selectionBounds()).bottomCenter();
      this.target = textMorph;
      this.animate({opacity: 1, duration: 1});
  }

  build() {
    var btnStyle = {
      type: "button", borderRadius: 5, padding: Rectangle.inset(0),
      grabbable: false, draggable: false
    }

    this.opacity = 1;

    this.addMorph({name: "bold button",      ...btnStyle, label: Label.icon("bold")});
    this.addMorph({name: "italic button",    ...btnStyle, label: Label.icon("italic")});
    this.addMorph({name: "underline button", ...btnStyle, label: Label.icon("underline")});
    this.addMorph({name: "fontcolor button", ...btnStyle, label: Label.icon("paint-brush")});
    this.addMorph({name: "inc fontsize button", ...btnStyle, label: Label.icon("plus")});
    this.addMorph({name: "dec fontsize button", ...btnStyle, label: Label.icon("minus")});
    this.addMorph({name: "link button",      ...btnStyle, label: Label.icon("link")});
    this.addMorph({name: "font button",      ...btnStyle, label: Label.icon("font")});

    this.addMorph({type: "triangle", name: "arrow", fill: this.fill, grabbable: false, draggable: false});

    connect(this.get("bold button"),      "fire", this, "toggleBold");
    connect(this.get("italic button"),    "fire", this, "toggleItalic");
    connect(this.get("underline button"), "fire", this, "toggleUnderline");
    connect(this.get("fontcolor button"), "fire", this, "openFontColorChooser");
    connect(this.get("inc fontsize button"), "fire", this, "incFontSize");
    connect(this.get("dec fontsize button"), "fire", this, "decFontSize");
    connect(this.get("link button"),      "fire", this, "changeLink");
    connect(this.get("font button"),      "fire", this, "changeFont");
  }

  relayout() {
    var offset = 5;
    var l = this.height-2*offset
    var btns = [
      this.get("bold button"),
      this.get("italic button"),
      this.get("underline button"),
      this.get("fontcolor button"),
      this.get("inc fontsize button"),
      this.get("dec fontsize button"),
      this.get("link button"),
      this.get("font button"),
    ]
    var arrow = this.get("arrow");
    btns[0].topLeft = pt(offset, offset); btns[0].extent = pt(l,l);
    btns[1].topLeft = btns[0].topRight.addXY(offset, 0); btns[1].extent = pt(l,l);
    btns[2].topLeft = btns[1].topRight.addXY(offset, 0); btns[2].extent = pt(l,l);
    btns[3].topLeft = btns[2].topRight.addXY(offset, 0); btns[3].extent = pt(l,l);
    btns[4].topLeft = btns[3].topRight.addXY(offset, 0); btns[4].extent = pt(l,l);
    btns[5].topLeft = btns[4].topRight.addXY(offset, 0); btns[5].extent = pt(l,l);
    btns[6].topLeft = btns[5].topRight.addXY(offset, 0); btns[6].extent = pt(l,l);
    btns[7].topLeft = btns[6].topRight.addXY(offset, 0); btns[7].extent = pt(l,l);
    arrow.extent = pt(this.width/10, this.width/10);
    arrow.bottomCenter = pt(this.width/2, 1);
    if (this.width != arr.last(btns).right+offset)
      this.width = arr.last(btns).right+offset;
  }

  changeFont() {
    show("NOT YET IMPLEMENTED!")
  }

  async changeLink() {
    var sel = this.target.selection,
        {link} = this.target.getStyleInRange(sel),
        newLink = await this.world().prompt("Set link", {input: link || "https://"});
    this.target.setStyleInRange({link: newLink || undefined}, sel);
    this.remove();
  }

  toggleUnderline() {
    setSingleStyleProperty(
      this.target, "textDecoration",
      textDecoration => textDecoration === "underline" ? "none" : "underline")
  }

  toggleItalic() {
    setSingleStyleProperty(
      this.target, "fontStyle",
      fontStyle => fontStyle === "italic" ? "normal" : "italic")
  }

  toggleBold() {
    setSingleStyleProperty(
      this.target, "fontWeight",
      fontWeight => fontWeight === "bold" || fontWeight === "700" ? "normal" : "bold")
  }

  openFontColorChooser() {
    var picker = new ColorPicker({extent: pt(300,150)}).openInWorldNearHand();
    connect(picker, "color", this, "changeFontColor");
    this.remove();
  }

  changeFontColor(color) {
    setSingleStyleProperty(
      this.target, "fontColor",
      oldFontColor => color)
  }

  incFontSize() {
    setSingleStyleProperty(this.target, "fontSize", oldSize => oldSize+(oldSize >= 18 ? 2 : 1))
  }
  
  decFontSize() {
    setSingleStyleProperty(this.target, "fontSize", oldSize => oldSize-(oldSize <= 18 ? 1 : 2))
  }
}

function setSingleStyleProperty(morph, propName, newValueFn) {
  if (!morph) return;
  var oldValue = morph.getStyleInRange()[propName],
      newValue = newValueFn(oldValue);
  morph.selections.forEach(sel =>
    morph.setStyleInRange({[propName]: newValue}, sel))
}
