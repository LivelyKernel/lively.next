/* global System */
import { fun, arr } from "lively.lang"
import { show, DropDownList, inspect, morph, Morph } from "../index.js";
import { pt, LinearGradient, Rectangle, Color } from "lively.graphics";
import { connect, noUpdate } from "lively.bindings"
import { Icon } from "lively.morphic/components/icons.js";
import { loadObjectFromPartsbinFolder } from "../partsbin.js";


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
    this.get("font button").items = RichTextControl.basicFontItems();
    this.get("font button").selection = this.get("font button").items[0].value;

    connect(this.target, "selectionChange", this, "setFontFromTarget");
    connect(this.target, "selectionChange", this, "setTextAlignFromTarget");
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
    // this.build(); this.relayout();

    this.removeAllMorphs();

    var fill = new LinearGradient({
      stops: [
        {color: Color.white, offset: 0},
        {color: Color.rgb(236,240,241), offset: 1}
      ]
    });

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

    this.addMorph({name: "divider 1", fill: Color.gray, extent: pt(4,30)});

    this.addMorph({name: "inc fontsize button", ...btnStyle, label: Icon.makeLabel("plus"), tooltip: "increase font size"});
    this.addMorph({name: "dec fontsize button", ...btnStyle, label: Icon.makeLabel("minus"), tooltip: "decrease font size"});
    // this.addMorph({name: "font button",      ...btnStyle, label: Icon.makeLabel("font"), tooltip: ""});
    let fontItems = RichTextControl.basicFontItems();
    this.addMorph(new DropDownList({
      selection: fontItems[0], items: fontItems,
      width: 100, name: "font button", fill,
      tooltip: "change font family",
      listAlign: "top"
    }));

    this.addMorph({name: "text align tabs", width: 120, height: 24});
    loadObjectFromPartsbinFolder("tab-buttons").then(tabs => {
      this.getSubmorphNamed("text align tabs").replaceWith(tabs);
      connect(tabs, "activeTab", this, "changeTextAlign");
      connect(tabs, "extent", this, "relayout");
      Object.assign(tabs, {
        tabs: [
          {name: "left", label: Icon.textAttribute("align-left")},
          {name: "center", label: Icon.textAttribute("align-center")},
          {name: "right", label: Icon.textAttribute("align-right")},
          {name: "justify", label: Icon.textAttribute("align-justify")}
        ],
        name: "text align tabs"
      })
    });

    this.addMorph({name: "divider 2", fill: Color.gray, extent: pt(4,30)});

    this.addMorph({name: "copy style button", ...btnStyle, label: Icon.makeLabel("copy"), tooltip: "copy style"});
    this.addMorph({name: "paste style button", ...btnStyle, label: Icon.makeLabel("paint-brush"), tooltip: "paste style"});
    this.addMorph({name: "clear style button", ...btnStyle, label: Icon.makeLabel("remove"), tooltip: "clear style"});
    // this.addMorph({type: "triangle", name: "arrow", fill: this.fill, grabbable: false, draggable: false});

    connect(this.get("bold button"),      "fire", this, "toggleBold");
    connect(this.get("italic button"),    "fire", this, "toggleItalic");
    connect(this.get("underline button"), "fire", this, "toggleUnderline");
    connect(this.get("fontcolor button"), "fire", this, "openFontColorChooser");
    connect(this.get("inc fontsize button"), "fire", this, "incFontSize");
    connect(this.get("dec fontsize button"), "fire", this, "decFontSize");
    connect(this.get("link button"),      "fire", this, "changeLink");
    connect(this.get("font button"),      "selection", this, "changeFont");
    connect(this.get("text align tabs"),      "activeTab", this, "changeTextAlign");
    connect(this.get("copy style button"),      "fire", this, "copyStyle");
    connect(this.get("paste style button"),      "fire", this, "pasteStyle");
    connect(this.get("clear style button"),      "fire", this, "clearStyle");
  }

  relayout() {
    // this.height = 30;
    var offset = 3;
    var h = this.innerBounds().height;
    var l = Math.max(h-2*offset, 22);
    var btns = [
      this.getSubmorphNamed("bold button"),
      this.getSubmorphNamed("italic button"),
      this.getSubmorphNamed("underline button"),
      this.getSubmorphNamed("link button"),
      this.getSubmorphNamed("fontcolor button"),

      this.getSubmorphNamed("divider 1"),

      this.getSubmorphNamed("inc fontsize button"),
      this.getSubmorphNamed("dec fontsize button"),
      this.getSubmorphNamed("font button"),
      this.getSubmorphNamed("text align tabs"),

      this.getSubmorphNamed("divider 2"),

      this.getSubmorphNamed("copy style button"),
      this.getSubmorphNamed("paste style button"),
      this.getSubmorphNamed("clear style button")
    ]
    var arrow = this.getSubmorphNamed("arrow");

    btns[0].topLeft = pt(offset, offset); btns[0].extent = pt(l,l);
    btns[1].topLeft = pt(btns[0].right + offset, offset); btns[1].extent = pt(l,l);
    btns[2].topLeft = pt(btns[1].right + offset, offset); btns[2].extent = pt(l,l);
    btns[3].topLeft = pt(btns[2].right + offset, offset); btns[3].extent = pt(l,l);
    btns[4].topLeft = pt(btns[3].right + offset, offset); btns[4].extent = pt(l,l);

    btns[5].topLeft = pt(btns[4].right + 2*offset, 0); btns[5].extent = pt(2,h);

    btns[6].topLeft = pt(btns[5].right + 2*offset, offset); btns[6].extent = pt(l,l);
    btns[7].topLeft = pt(btns[6].right + offset, offset); btns[7].extent = pt(l,l);
    btns[8].topLeft = pt(btns[7].right + offset, offset); btns[8].extent = pt(100, l);

    btns[9].bottomLeft = btns[8].bottomRight.addXY(offset, 0);

    btns[10].topLeft = pt(btns[9].right + 2*offset, 0); btns[10].extent = pt(2,h);

    btns[11].topLeft = pt(btns[10].right + 2*offset, offset); btns[11].extent = pt(l, l);
    btns[12].topLeft = pt(btns[11].right + offset, offset); btns[12].extent = pt(l, l);
    btns[13].topLeft = pt(btns[12].right + offset, offset); btns[13].extent = pt(l, l);
    if (arrow) {
      arrow.extent = pt(this.width/10, this.width/10);
      arrow.bottomCenter = pt(this.width/2, 1);
      if (this.width != arr.last(btns).right+offset)
        this.width = arr.last(btns).right+offset;
    }
    this.extent = btns[13].bottomRight.addXY(offset, offset);
  }

  changeAttributeInSelectionOrMorph(name, valueOrFn) {
    let {target} = this,
        sel = target.selection;
    if (sel.isEmpty()) {
      target[name] = typeof valueOrFn === "function"
                      ? valueOrFn(target[name])
                      : valueOrFn
    } else {
      target.undoManager.group();
      target.changeStyleProperty(name,
        oldVal => typeof valueOrFn === "function"
          ? valueOrFn(oldVal) : valueOrFn);
      target.undoManager.group();
    }
  }

  static basicFontItems() {
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
    this.changeAttributeInSelectionOrMorph("fontFamily", fontFamily);
  }

  setFontFromTarget() {
    // this.reset();
    // this.target.resetTextAttributes()
    
    let {target} = this, sel = target.selection,
        fb = this.get("font button"),
        attr = sel.isEmpty() ? target.textAttributeAt(sel.start) : target.getStyleInRange(sel),
        fontFamily = (attr && attr.fontFamily) || target.fontFamily,
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

  changeTextAlign(textAlign) {
    this.changeAttributeInSelectionOrMorph("textAlign", textAlign);
  }

  setTextAlignFromTarget() {
    // this.reset();
    // this.target.resetTextAttributes()

    let {target} = this, sel = target.selection,
        tabs = this.get("text align tabs"),        
        attr = sel.isEmpty() ? target.textAttributeAt(sel.start) : target.getStyleInRange(sel),
        textAlign = (attr && attr.textAlign) || target.textAlign,
        tab = tabs.submorphs.find(ea => ea.name === textAlign);

    noUpdate({
      sourceObj: tabs, sourceAttribute: "activeTab",
      targetObj: this.get("rich-text-control"), targetAttribute: "changeTextAlign"
    }, () => tabs.activeTab = tab);
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
    this.changeAttributeInSelectionOrMorph(
      "textDecoration",
      textDecoration => (textDecoration === "underline" ? "none" : "underline"));
  }

  toggleItalic() {
    this.changeAttributeInSelectionOrMorph(
      "fontStyle",
      fontStyle => fontStyle === "italic" ? "normal" : "italic");
  }

  toggleBold() {
    this.changeAttributeInSelectionOrMorph(
      "fontWeight",
      fontWeight => fontWeight === "bold" || fontWeight === "700" ? "normal" : "bold");
  }

  async openFontColorChooser() {
    let { ColorPicker } = await System.import("lively.morphic/ide/styling/color-picker.js"),
        picker = new ColorPicker({}).openInWorldNearHand();
    connect(picker, "color", this, "changeFontColor");
    this.autoRemove && this.remove();
  }

  changeFontColor(color) {
    this.changeAttributeInSelectionOrMorph("fontColor", color);
  }

  incFontSize() {    
    let defaultFontSize = this.target.fontSize;
    this.changeAttributeInSelectionOrMorph("fontSize", oldSize => {
      oldSize = oldSize || defaultFontSize;
      return oldSize + (oldSize >= 18 ? 2 : 1);
    });
  }

  decFontSize() {
    let defaultFontSize = this.target.fontSize;
    this.changeAttributeInSelectionOrMorph("fontSize", oldSize => {
      oldSize = oldSize || defaultFontSize;
      return oldSize - (oldSize <= 18 ? 1 : 2);
    });
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
    morph.selections.forEach(sel =>
      morph.addTextAttribute(this.copiedStyle, sel));
  }

  clearStyle() {
    let morph = this.target;
    morph.selections.forEach(sel => 
      morph.resetStyleInRange(sel));
    this.setFontFromTarget();
    this.setTextAlignFromTarget();
  }
}
