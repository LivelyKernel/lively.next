/* global System */
import { fun, arr } from "lively.lang"
import { show, DropDownList, inspect, morph, Morph } from "../index.js";
import { pt, LinearGradient, Rectangle, Color } from "lively.graphics";
import { connect, noUpdate } from "lively.bindings"
import { Icon } from "lively.morphic/components/icons.js";


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

  static get properties() {
    return {
      autoRemove: {defaultValue: false},
      target: {},
      copiedStyle: {}
    }
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

  reset() {
    this.get("font button").items = this.basicFontItems();
    this.get("font button").selection = this.get("font button").items[0].value;
  }

  removeFocus() {
   if (this.autoRemove && this.target) {
     this.remove();
     this.target = null;
   }
  }

  focusOn(textMorph) {
    if (this.autoRemove) {
      this.openInWorld();
      this.topCenter = textMorph.getGlobalTransform()
          .transformRectToRect(textMorph.selectionBounds()).bottomCenter();
      this.animate({opacity: 1, duration: 1});
    }
    this.target = textMorph;
  }

  build() {
    this.removeAllMorphs();

    var fill = "linear-gradient(180deg,rgba(255,255,255,1) 0%,rgba(236,240,241,1) 100%)";
    var btnStyle = {
      type: "button", borderRadius: 5, padding: Rectangle.inset(0),
      grabbable: false, draggable: false,
      activeStyle: {fill}, fill
    }

    this.opacity = 1;

    this.addMorph({name: "bold button",      ...btnStyle, label: Icon.makeLabel("bold"), tooltip: "toggle bold font"});
    this.addMorph({name: "italic button",    ...btnStyle, label: Icon.makeLabel("italic"), tooltip: "toggle italic font"});
    this.addMorph({name: "underline button", ...btnStyle, label: Icon.makeLabel("underline"), tooltip: "toggle underlined font"});
    this.addMorph({name: "link button",      ...btnStyle, label: Icon.makeLabel("link"), tooltip: "add or edit link"});
    this.addMorph({name: "fontcolor button", ...btnStyle, label: Icon.makeLabel("tint"), tooltip: "change font color"});

    this.addMorph({name: "inc fontsize button", ...btnStyle, label: Icon.makeLabel("plus"), tooltip: "increase font size"});
    this.addMorph({name: "dec fontsize button", ...btnStyle, label: Icon.makeLabel("minus"), tooltip: "decrease font size"});
    // this.addMorph({name: "font button",      ...btnStyle, label: Icon.makeLabel("font"), tooltip: ""});
    let fontItems = this.basicFontItems();
    this.addMorph(new DropDownList({
      selection: fontItems[0], items: fontItems,
      width: 100, name: "font button", fill,
      tooltip: "change font family"
    }));
  

    this.addMorph({name: "copy style button", ...btnStyle, label: Icon.makeLabel("copy"), tooltip: "copy style"});
    this.addMorph({name: "paste style button", ...btnStyle, label: Icon.makeLabel("paint-brush"), tooltip: "paste style"});
    // this.addMorph({type: "triangle", name: "arrow", fill: this.fill, grabbable: false, draggable: false});

    connect(this.get("bold button"),      "fire", this, "toggleBold");
    connect(this.get("italic button"),    "fire", this, "toggleItalic");
    connect(this.get("underline button"), "fire", this, "toggleUnderline");
    connect(this.get("fontcolor button"), "fire", this, "openFontColorChooser");
    connect(this.get("inc fontsize button"), "fire", this, "incFontSize");
    connect(this.get("dec fontsize button"), "fire", this, "decFontSize");
    connect(this.get("link button"),      "fire", this, "changeLink");
    connect(this.get("font button"),      "selection", this, "changeFont");
    connect(this.get("copy style button"),      "fire", this, "copyStyle");
    connect(this.get("paste style button"),      "fire", this, "pasteStyle");
  }

  relayout() {
    var offset = 3;
    var l = this.height-2*offset
    var btns = [
      this.getSubmorphNamed("bold button"),
      this.getSubmorphNamed("italic button"),
      this.getSubmorphNamed("underline button"),
      this.getSubmorphNamed("link button"),
      this.getSubmorphNamed("fontcolor button"),
      this.getSubmorphNamed("inc fontsize button"),
      this.getSubmorphNamed("dec fontsize button"),
      this.getSubmorphNamed("font button"),
      this.getSubmorphNamed("copy style button"),
      this.getSubmorphNamed("paste style button")
    ]
    var arrow = this.getSubmorphNamed("arrow");
    btns[0].topLeft = pt(offset, offset); btns[0].extent = pt(l,l);
    btns[1].topLeft = btns[0].topRight.addXY(offset, 0); btns[1].extent = pt(l,l);
    btns[2].topLeft = btns[1].topRight.addXY(offset, 0); btns[2].extent = pt(l,l);
    btns[3].topLeft = btns[2].topRight.addXY(offset, 0); btns[3].extent = pt(l,l);
    btns[4].topLeft = btns[3].topRight.addXY(offset, 0); btns[4].extent = pt(l,l);
    btns[5].topLeft = btns[4].topRight.addXY(offset, 0); btns[5].extent = pt(l,l);
    btns[6].topLeft = btns[5].topRight.addXY(offset, 0); btns[6].extent = pt(l,l);
    btns[7].topLeft = btns[6].topRight.addXY(offset, 0); btns[7].extent = pt(100, l);
    btns[8].topLeft = btns[7].topRight.addXY(offset, 0); btns[8].extent = pt(l, l);
    btns[9].topLeft = btns[8].topRight.addXY(offset, 0); btns[9].extent = pt(l, l);
    if (arrow) {
      arrow.extent = pt(this.width/10, this.width/10);
      arrow.bottomCenter = pt(this.width/2, 1);
      if (this.width != arr.last(btns).right+offset)
        this.width = arr.last(btns).right+offset;
    }
    this.extent = btns[9].bottomRight.addXY(offset, offset);
  }

  basicFontItems() {
    return [
      "Sans-serif",
      "serif",
      "Monospace",
      "Arial Black",
      "Arial Narrow",
      "Comic Sans MS",
      "Garamond",
      "Tahoma",
      "Trebuchet MS",
      "Verdana",
    ].map(ea => ({isListItem: true, label: [ea, {fontFamily: ea}], value: ea}));
  }

  changeFont(fontFamily) {
    let morph = this.target;
    morph.undoManager.group();
    morph.changeStyleProperty("fontFamily", _ => fontFamily);
    morph.undoManager.group();
  }

  setFontFromTarget() {
    // this.reset();
    // this.target.resetTextAttributes()
    let fb = this.get("font button"),
        fontFamily = this.target.getStyleInRange().fontFamily
                  || this.target.fontFamily,
        existing = fb.items.find(ea =>
          ea.value.toLowerCase() === fontFamily.toLowerCase());

    noUpdate({
      sourceObj: fb, sourceAttribute: "selection",
      targetObj: this.get("rich-text-control"), targetAttribute: "changeFont"
    }, () => {
      if (existing) fb.selection = existing.value;
      else {
        fb.items = fb.items.concat({
          isListItem: true,
          label: [fontFamily, {fontFamily: fontFamily}],
          value: fontFamily
        });
        fb.selection = arr.last(fb.items);
      }
    });
  }

  async changeLink() {
    let morph = this.target,
        sel = morph.selection,
        {link} = morph.getStyleInRange(sel),
        newLink = await this.world().prompt("Set link", {input: link || "https://"});
    morph.undoManager.group();
    morph.setStyleInRange({link: newLink || undefined}, sel);
    morph.undoManager.group();
    this.autoRemove && this.remove();
  }

  toggleUnderline() {
    let morph = this.target;
    morph.undoManager.group();
    morph.changeStyleProperty(
      "textDecoration",
      textDecoration => textDecoration === "underline" ? "none" : "underline")
    morph.undoManager.group();
  }

  toggleItalic() {
    let morph = this.target;
    morph.undoManager.group();
    morph.changeStyleProperty(
      "fontStyle",
      fontStyle => fontStyle === "italic" ? "normal" : "italic");
    morph.undoManager.group();
  }

  toggleBold() {
    let morph = this.target;
    morph.undoManager.group();
    morph.changeStyleProperty(
      "fontWeight",
      fontWeight => fontWeight === "bold" || fontWeight === "700" ? "normal" : "bold");
    morph.undoManager.group();
  }

  async openFontColorChooser() {
    let { ColorPicker } = await System.import("lively.morphic/ide/styling/color-picker.js"),
        picker = new ColorPicker({}).openInWorldNearHand();
    connect(picker, "color", this, "changeFontColor");
    this.autoRemove && this.remove();
  }

  changeFontColor(color) {
    let morph = this.target;
    morph.undoManager.group();
    morph.changeStyleProperty("fontColor", oldFontColor => color);
    morph.undoManager.group();
  }

  incFontSize() {
    let morph = this.target,
        defaultFontSize = morph.fontSize;
    morph.undoManager.group();
    morph.changeStyleProperty("fontSize", oldSize => {
      oldSize = oldSize || defaultFontSize;
      return oldSize + (oldSize >= 18 ? 2 : 1);
    });
    morph.undoManager.group();
  }

  decFontSize() {    
    let morph = this.target,
        defaultFontSize = morph.fontSize;
    morph.undoManager.group();
    morph.changeStyleProperty("fontSize", oldSize => {
      oldSize = oldSize || defaultFontSize;
      return oldSize-(oldSize <= 18 ? 1 : 2);
    });
    morph.undoManager.group();
  }

  copyStyle() {
    let morph = this.target,
        style = morph.getStyleInRange(morph.selection),
        styleString = JSON.stringify(style, null, 2);
    this.copiedStyle = style;
    this.setStatusMessage(`Copied style\n${styleString}`);
    this.getSubmorphNamed("paste style button").tooltip = "paste style\n" + styleString;
  }
  
  pasteStyle() {
    let morph = this.target;
    morph.addTextAttribute(this.copiedStyle, morph.selection);
  }
}
