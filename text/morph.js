/*global System*/
import { string, obj } from "lively.lang";
import { Rectangle, Color, pt } from "lively.graphics";
import { Morph, show } from "../index.js";
import { Selection } from "./selection.js";
import DocumentRenderer from "./rendering.js";
import TextDocument from "./document.js";
import { KeyHandler } from "../events/keyhandler.js";
import Keys from "../events/Keys.js";
import { CommandHandler } from "../commands.js";

const defaultKeyHandler = new KeyHandler();

export class Text extends Morph {

  static makeLabel(string, props) {
    return new Text({
      textString: string,
      fontFamily: "Helvetica Neue, Arial",
      fontColor: Color.black,
      fontSize: 11,
      readOnly: true,
      ...props
    });
  }

  constructor(props = {}) {
    var {fontMetric, textString, selectable, selection} = props;
    props = obj.dissoc(props, ["textString","fontMetric", "selectable", "selection"])
    super({
      readOnly: false,
      draggable: false,
      clipMode: "hidden",
      fixedWidth: false, fixedHeight: false,
      padding: 0,
      fontFamily: "Sans-Serif",
      fontSize: 12,
      fontColor: Color.black,
      fontKerning: true,
      ...props
    });
    this.document = new TextDocument();
    this.renderer = new DocumentRenderer(fontMetric || this.env.fontMetric);
    this._keyhandlers = []; // defaultKeyHandler is fallback
    // this.commands = new CommandHandler();
    this._selection = new Selection(this, selection);
    this.selectable = typeof selectable !== "undefined" ? selectable : true;
    this.textString = textString || "";
    this.fit();
    this._needsFit = false;
  }

  get isText() { return true }

  onChange(change) {
    if (change.prop === "textString"
     || change.prop === "fontFamily"
     || change.prop === "fontSize"
     || change.prop === "fontColor" // FIXME
     || change.prop === "fixedWidth"
     || change.prop === "fixedHeight"
     || change.prop === "fontKerning")
       this.renderer && (this.renderer.layoutComputed = false);
    super.onChange(change);
  }

  get readOnly() { return this.getProperty("readOnly"); }
  set readOnly(value) {
    this.nativeCursor = value ? "default" : "auto";
    this.addValueChange("readOnly", value);
  }

  rejectsInput() { return this.readOnly /*|| !this.isFocused()*/ }

  get selectable() { return this.getProperty("selectable"); }
  set selectable(value) {
    this.addValueChange("selectable", value);
    if (!value) this.selection.collapse();
  }

  get fixedWidth() { return this.getProperty("fixedWidth") }
  set fixedWidth(value) {
    this.addValueChange("fixedWidth", value);
    this._needsFit = true;
  }

  get fixedHeight() { return this.getProperty("fixedHeight"); }
  set fixedHeight(value) {
    this.addValueChange("fixedHeight", value);
    this._needsFit = true;
  }

  get padding() { return this.getProperty("padding"); }
  set padding(value) {
    this.addValueChange("padding", typeof value === "number" ? Rectangle.inset(value) : value);
    this._needsFit = true;
  }

  get fontFamily() { return this.getProperty("fontFamily") }
  set fontFamily(value) {
    this.addValueChange("fontFamily", value);
    this._needsFit = true;
  }

  get fontSize() { return this.getProperty("fontSize") }
  set fontSize(value) {
    this.addValueChange("fontSize", value);
    this._needsFit = true;
  }

  get fontColor() { return this.getProperty("fontColor") }
  set fontColor(value) { this.addValueChange("fontColor", value); }

  get fontKerning() { return this.getProperty("fontKerning") }
  set fontKerning(value) { this.addValueChange("fontKerning", value); }

  get clipMode()  { return this.getProperty("clipMode"); }
  set clipMode(value)  {
    this.addValueChange("clipMode", value);
    this.fixedWidth = this.fixedHeight = this.isClip();
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // document changes

  get textString() { return this.document ? this.document.textString : "" }
  set textString(value) {
    this.document.textString = String(value);
    this.selection = {start: 0, end: 0};
    this.addValueChange("textString", value);
    this._needsFit = true;
  }

  getLine(row) {
    if (typeof row !== "number") this.cursorPosition.row
    var doc = this.document;
    return doc.getLine(row);
  }

  insertTextAndSelect(text, pos = null) {
    text = String(text);
    if (pos) this.selection.range = this.insertText(text, pos);
    else this.selection.text = text;
  }

  insertText(text, pos = null) {
    text = String(text);
    var range = this.document.insert(text, pos || this.selection.end);
    this._needsFit = true;
    this.addValueChange(
      "textString", this.document.textString,
      {action: "insertText", text, pos});
    return range;
  }

  deleteText(range) {
    this.document.remove(range);
    this._needsFit = true;
    this.addValueChange(
      "textString", this.document.textString,
      {action: "deleteText", range});
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // selection

  get selection() { return this._selection; }
  set selection(range) { return this._selection.range = range; }

  get cursorPosition() { return this.selection.lead; }

  selectAll() {
    this.selection.range = {start: {row: 0, column: 0}, end: this.document.endPosition};
    return this.selection;
  }

  selectLine(row) {
    if (typeof row !== "number") row = this.cursorPosition.row
    this.selection.range = {start: {row, column: 0}, end: {row, column: this.getLine(row).length}};
    return this.selection;
  }

  selectionOrLineString() {
    var {text, start} = this.selection;
    if (text) return text;
    return this.getLine(start.row);
  }

  scrollToSelection() {
    var { scroll, selection, padding, renderer } = this,
        paddedBounds = this.innerBounds().insetByRect(padding),
        charBounds =   renderer.boundsFor(this, selection.start),
        selPt =        this.addPaddingAndScroll(charBounds.bottomRight());
    if (!paddedBounds.containsPoint(selPt))
      this.scroll = scroll.addPt(selPt.subPt(paddedBounds.bottomRight()));
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // text layout related

  fit() {
    let {fixedWidth, fixedHeight} = this;
    if ((fixedHeight && fixedWidth) || !this.renderer/*not init'ed yet*/) return;
    let textBounds = this.renderer.textBounds(this);
    if (!fixedHeight && !fixedWidth) this.extent = textBounds.extent();
    else if (!fixedHeight) this.height = textBounds.height;
    else if (!fixedWidth) this.width = textBounds.width;
  }

  fitIfNeeded() {
    if (this._needsFit) { this.fit(); this._needsFit = false; }
  }

  textPositionFromPoint(point) {
    return this.renderer.textPositionFor(this, point);
  }

  paddingAndScrollOffset() {
    return this.padding.topLeft().subPt(this.scroll);
  }

  addPaddingAndScroll(point) {
    return point.addPt(this.paddingAndScrollOffset());
  }

  removePaddingAndScroll(point) {
    return point.subPt(this.paddingAndScrollOffset());
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // rendering

  aboutToRender(renderer) {
    super.aboutToRender(renderer);
    this.fitIfNeeded();
  }

  render(renderer) {
    return this.renderer.renderMorph(renderer, this);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // mouse events

  onMouseDown(evt) {
    this.onMouseMove(evt);
  }

  onMouseMove(evt) {
    if (!evt.leftMouseButtonPressed()) return;
    var {clickedOnMorph, clickedOnPosition} = evt.state;
    if (clickedOnMorph !== this || !this.selectable) return;

    var start = this.textPositionFromPoint(this.removePaddingAndScroll(this.localize(clickedOnPosition))),
        end = this.textPositionFromPoint(this.removePaddingAndScroll(this.localize(evt.position)))

// console.log("%s => %s\n%s => %s",
//   this.localize(clickedOnPosition), JSON.stringify(start),
//   this.localize(evt.position), JSON.stringify(end));

    var from =this.selection.toString();
    this.selection.range = {start, end};

// show(`[mouse selection] ${from} -> ${this.selection}`)
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // keyboard events

  get keyhandlers() {
    return [defaultKeyHandler].concat(this._keyhandlers)
  }

  simulateKeys(keyString) {
    simulateKeys(this, keyString);
  }

  onKeyUp(evt) {
    switch (evt.keyCombo) {
      case 'Command-D': case 'Command-P': evt.stop(); break;
    }
  }

  onKeyDown(evt) {
    var keyString = evt.keyCombo(),
        key = evt.domEvt.key,
        sel = this.selection,
        handled = true,
        world = this.world();

    switch (keyString) {
      case 'Command-C': case 'Command-X': case 'Command-V':
        handled = false;
        break; // handled by onCut()/onPaste()

      case 'Command-A': this.selectAll(); break;

      case 'Command-D':
        (async () => {
          if (this.selection.isEmpty()) this.selectLine();
          var result = await lively.vm.runEval(this.selection.text, {
            System, targetModule: "lively://lively.next-prototype_2016_08_23/" + this.id});
          evt.world[result.isError ? "logError" : "setStatusMessage"](result.value);
        })();
        break;

      case 'Command-P':
        (async () => {
          if (this.selection.isEmpty()) this.selectLine();
          var result = await lively.vm.runEval(this.selection.text, {
            System, targetModule: "lively://lively.next-prototype_2016_08_23/" + this.id});
          sel.collapseToEnd();
          this.insertTextAndSelect(result.value);
        })();
        break;

      case 'Command-S': this.doSave(); break;

      case 'Backspace':
        if (this.rejectsInput()) break;
        if (sel.isEmpty()) sel.growLeft(1);
        sel.text = "";
        sel.collapse();
        break;

      case 'Delete': // forward-delete
        if (this.rejectsInput()) break;
        if (sel.isEmpty()) sel.growRight(1);
        sel.text = "";
        sel.collapse();
        break;

      case 'Left': if (sel.isEmpty()) sel.growLeft(1); sel.collapse(); break;
      case 'Right': if (sel.isEmpty()) sel.growRight(1); sel.collapseToEnd(); break;

      case 'Up':
        var {row, column} = sel.start;
        sel.start = {row: row-1, column};
        sel.collapse();
        break;
        
      case 'Down':
        var {row, column} = sel.start;
        sel.start = {row: row+1, column};
        sel.collapseToEnd();
        break;

      case 'Enter':
        if (!this.rejectsInput()) { sel.text = "\n"; sel.collapseToEnd(); } break;
      case 'Space':
        if (!this.rejectsInput()) { sel.text = " "; sel.collapseToEnd(); } break;
      case 'Tab':
        if (!this.rejectsInput()) { sel.text = "\t"; sel.collapseToEnd(); } break;

      default:
        handled = false;
    }

    if (handled) {
      evt.stop();
      this.selection.cursorBlinkStart();
      this.scrollToSelection();
    }

  }

  onTextInput(evt) {
    if (this.rejectsInput()) return;
    var sel = this.selection;
    sel.text = evt.data;
    sel.collapseToEnd();
    this.scrollToSelection();
    this.selection.cursorBlinkStart();
  }

  invokeKeyHandlersWithEvent(evt, opts) {
    opts = {onlyCommandOrFunctionKey: false, ...opts};
    return KeyHandler.invokeKeyHandlersWithEvent(this, evt, opts);
  }

  doSave() { /*...*/ }

  onCut(evt) {
    if (this.rejectsInput()) return;
    this.onCopy(evt);
    var sel = this.selection;
    sel.text = "";
    sel.collapse();
  }

  onCopy(evt) {
    if (!this.isFocused()) return;
    evt.stop();
    evt.domEvt.clipboardData.setData("text", this.selection.text);
  }

  onPaste(evt) {
    if (this.rejectsInput()) return;
    evt.stop();
    var sel = this.selection;
    sel.text = evt.domEvt.clipboardData.getData("text");
    sel.collapseToEnd();
  }

  onFocus(evt) {
    this.makeDirty();
    this.selection.cursorBlinkStart();
  }
  onBlur(evt) {
    this.makeDirty();
    this.selection.cursorBlinkStop();
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // debugging

  inspect() {
    return `<${this.name}>`
         + `\n  ${this.selection}`
         + "\n  " + this.renderer.lines.map(({height, width, text}, i) => {
              return `[${i}] ${width.toFixed(0)}x${height.toFixed(0)} ${obj.inspect(text)}`
            }).join("\n  ")
         + `\n</${this.name}>`;
  }

}
