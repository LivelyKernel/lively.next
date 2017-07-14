/*global System*/
// import config from "../config.js";
import { obj, arr, num } from "lively.lang";
import { Rectangle, rect, Color, pt } from "lively.graphics";
import { connect, signal, disconnect } from "lively.bindings"; // for makeInputLine
import { Text } from "../text/morph.js"
import { Range } from "./range.js";

export default class InputLine extends Text {

/*

  This represents a single text input line, useful in places where users
  should be prompted for short strings

  The input line provides two connection points: input and inputChanged
  input is signaled when a user accepts the text content, e.g. by pressing enter,
  inputChanged is signaled when the input text changes, basically on every keystroke

  props:
    clearOnInput: Boolean to indicate to remove the users input when input is signaled
    historyId: id to use for providing an input history, the history stores
       the users accepted inputs and when a InputLine is subsequently created with
       the same id those inputs become available again via Alt-H (browse history) or
       Arrow Up/Down (traverse history)
    label: a string that prefixes the text content that is static, i.e. it
      cannot be selected or changed by the user and will not be part of "input"
    input: string to pre-fill the input text

  Example:

    InputLine.getHistory("name query");

    var input = Text.makeInputLine({
      fill: Color.green,
      historyId: "name query",
      label: "What is your name? ",
      placeholder: "type your name in here",
      width: 300
    }).openInWorld();

    connect(input, 'inputAccepted', input, 'remove');
    connect(input, 'inputAccepted', input.world(), 'setStatusMessage');
    input.focus()

*/

  static getHistoryFromLocalSorage(id) {
    if (typeof localStorage === "undefined") return null;
    try {
      var hist = localStorage.getItem("lively.morphic-inputline-" + id);
      return hist ? JSON.parse(hist) : null;
    } catch (e) {
      return null
    }
  }

  static addHistoryToLocalStorage(id, hist) {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem("lively.morphic-inputline-" + id, JSON.stringify(hist));
    } catch (e) { console.error(e); }
  }

  static get histories() {
    if (!this._histories) this._histories = new Map();
    return this._histories;
  }

  static getHistory(id) {
    var hist = this.histories.get(id);
    if (hist) return hist;
    hist = this.getHistoryFromLocalSorage(id) || {items: [], max: 50, index: 0};
    this.histories.set(id, hist);
    return hist;
  }

  static setHistory(id, hist = {items: [], max: 50, index: 0}) {
    this.histories.set(id, hist);
    this.addHistoryToLocalStorage(id, hist);
    return hist;
  }

  static get properties() {

    return {
      fixedWidth:   {defaultValue: true},
      fixedHeight:  {defaultValue: true},
      extent:       {defaultValue: pt(100, 20)},
      padding:      {defaultValue: Rectangle.inset(2,4)},
      clipMode:     {defaultValue: "hidden"},
      lineWrapping: {defaultValue: false},
      historyId:    {defaultValue: null},
      clearOnInput: {defaultValue: false},

      haloShadow: {
        defaultValue: {
          blur: 6,
          color: Color.rgb(52,152,219),
          distance: 0,
          rotation: 45
        }
      },
      highlightWhenFocused: {defaultValue: false},

      height: {
        after: ["padding", "textAndAttributes"],
        initialize() {
          this.height = this.defaultLineHeight + this.padding.top() + this.padding.bottom();
        }
      },

      label: {
        after: ["textAndAttributes", "extent", "padding", "submorphs"], defaultValue: "",
        set(value) {
          this.setProperty("label", value);
          if (this.textString.startsWith(value)) return;
          disconnect(this, 'textChange', this, 'onInputChanged');
          this.textString = value + this.input;
          connect(this, 'textChange', this, 'onInputChanged');
        }
      },

      input: {
        after: ["label"], derived: true,
        get() {
          return this.textString.slice(this.label.length);
        },
        set(val) {
          this.textString = this.label + (val ? String(val) : "");
          this.updatePlaceholder();
        }
      },

      placeholder: {
        after: ["submorphs", "label", "defaultTextStyle"], dervied: true,
        get() {
          let placeholder = this.getSubmorphNamed("placeholder");
          return placeholder ? placeholder.value : null;
        },
        set(val) {
          let placeholder = this.getSubmorphNamed("placeholder");
          if (!val) {
            if (placeholder) {
              placeholder.remove();
              placeholder = null;
            }
          } else {
            if (!placeholder) {
              placeholder = this.addMorph(Text.makeLabel(val, {
                ...this.defaultTextStyle,
                name: "placeholder",
                reactsToPointer: false,
                fontColor: Color.gray
              }));
            } else {
              placeholder.defaultTextStyle = {...this.defaultTextStyle, fontColor: Color.gray};
              placeholder.value = val;
            }            
          }
          this.updatePlaceholder();
        }
      }
    }
  }

  constructor(props = {}) {
    super(props);
    connect(this, 'textChange', this, 'onInputChanged');
    connect(this, 'selectionChange', this, 'fixCursor');
    this.updatePlaceholder();
  }

  onChange(change) {
    if (["extent",
         "fontSize",
         "padding",
         "fontFamily",
         "position",
         "selection"].includes(change.prop)) { this.updatePlaceholder(); }


    return super.onChange(change);
  }

  get isInputLine() { return true; }

  get allowDuplicatesInHistory() { return false }

  resetHistory() { this.inputHistory = {items: [], max: 50, index: 0}; }

  get inputHistory() {
    if (this._inputHistory) return this._inputHistory;
    return this._inputHistory = this.historyId ?
      this.constructor.getHistory(this.historyId) :
      {items: [], max: 30, index: 0};
  }

  set inputHistory(hist) {
    this._inputHistory = hist;
    this.historyId && this.constructor.setHistory(this.historyId, this._inputHistory);
  }

  clear() {
    this.input = "";
  }

  focus() {
    this.fixCursor();
    return super.focus();
  }

  updatePlaceholder() {
    let placeholder = this.getSubmorphNamed("placeholder");
    if (!placeholder) return;
    if (!!this.input.length) {
      placeholder.visible = false;
      return;
    }

    let textB = this.textBounds();
    placeholder.leftCenter = this.label.length
                           ? textB.rightCenter().addXY(0, this.borderWidth)
                           : textB.leftCenter().withX(0);
    placeholder.visible = true;
    placeholder.height = this.height;
    placeholder.padding = this.padding;
    placeholder.defaultTextStyle = this.defaultTextStyle;
    placeholder.lineHeight = this.height + "px";
  }

  fixCursor() {
    if (!this.label) return
    var leadIndex = this.positionToIndex(this.selection.lead);
    if (leadIndex < this.label.length)
      this.selection.lead = this.indexToPosition(this.label.length)
    var anchorIndex = this.positionToIndex(this.selection.anchor);
    if (anchorIndex < this.label.length)
      this.selection.anchor = this.indexToPosition(this.label.length)
  }

  acceptInput() { var i = this.input; this.onInput(i); return i; }
  onInput(input) {
    if (this.input.length > 0) this.addInputToHistory(this.input);
    this.clearOnInput && this.clear();
    signal(this, "inputAccepted", input);
  }
  onInputChanged(change) {
    signal(this, "inputChanged", change);
    this.updatePlaceholder();
  }

  deleteText(range) {
    range = range.isRange ? range : new Range(range);
    if (range.isEmpty()) return;    
    range = range.subtract({
      start: {row: 0, column: 0},
      end: {row: 0, column: this.label.length}
    })[0];
    return super.deleteText(range);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // history

  addInputToHistory(input) {
    var hist = this.inputHistory,
        items = hist.items;
    if (arr.last(items) === input) return;
    items.push(input);
    if (items.length > hist.max) {
      hist.items = items = items.slice(-hist.max);
    }
    hist.index = items.length - 1;
    if (!this.allowDuplicatesInHistory) {
      for (var i = hist.items.length-1; i--; )
        if (hist.items[i] === input) {
          hist.items.splice(i, 1); hist.index--; }
    }
    this.historyId && this.constructor.addHistoryToLocalStorage(this.historyId, hist);
  }

  async browseHistory() {
    var items = this.inputHistory.items.map((item, i) =>
          ({isListItem: true, string: item, value: i})).reverse(),
        {selected: [item]} = await this.world().filterableListPrompt(
                                "Choose item:", items, {commands: [this.histEditCommandForHistBrowse()]});
    typeof item === "number" && this.setAndShowHistItem(item);
    this.focus();
  }

  histEditCommandForHistBrowse() {
    return {
      name: "edit history " + this.historyId,
      exec: async prompt => {
        var items = this.inputHistory.items.slice().reverse()
        var {status, list: values} = await prompt.world().editListPrompt(
                                        "edit history " + this.historyId, items)
        if ("canceled" === status) return true;
        items = items.filter(ea => ea.isListItem ? values.includes(ea.value) : values.includes(ea));
        this.inputHistory = {...this.inputHistory, items};
        prompt.get("list").items = items.map((item, i) =>
          ({isListItem: true, string: item, value: i})).reverse()
        return true;
      }
    }
  }

  setAndShowHistItem(idx) {
    var hist = this.inputHistory, items = hist.items, len = items.length-1, i = idx;
    if (!num.between(i, 0, len+1)) hist.index = i = len;
    else hist.index = i;
    if (this.input !== items[i] && typeof items[i] !== 'undefined') this.input = items[i];
  }

  showHistItem(dir) {
    dir = dir || 'next';
    var hist = this.inputHistory, items = hist.items, len = items.length-1, i = hist.index;
    if (!num.between(i, 0, len+1)) hist.index = i = len;
    if (this.input !== items[i] && typeof items[i] !== 'undefined') { this.input = items[i]; return; }
    if (dir === 'next') {
      if (i > len) return;
      i = ++hist.index;
    } else {
      if (i <= 0) return;
      i = --hist.index;
    }
    this.input = items[i] || '';
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // ui events
  get commands() {
    return [
      {name: "accept input", exec: () => { this.acceptInput(); return true; }},
      {name: "show previous input from history", exec: () => { this.showHistItem('prev'); return true; }},
      {name: "show next input from history", exec: () => { this.showHistItem('next'); return true; }},
      {name: "browse history", exec: () => { this.browseHistory(); return true; }},
      {
        name: "remove items from history",
        exec: async inputLine => {
          var hist = inputLine.inputHistory,
              items = hist.items.map((item, i) =>
                ({isListItem: true, string: item, value: i})).reverse(),
              {selected} = await inputLine.world().filterableListPrompt(
                            "Choose items to delete:", items, {multiSelect: true});

          arr.sort(selected).reverse().forEach(index => {
            if (index < hist.index) hist.index--;
            hist.items.splice(index, 1);
          });
          inputLine.inputHistory = hist;
          return true;
        }
      }
    ].concat(super.commands);
  }

  get keybindings() {
    return super.keybindings.concat([
      {keys: "Enter", command: "accept input"},
      {keys: {mac: "Meta-S", win: "Ctrl-S"}, command: "accept input"},
      {keys: "Up|Ctrl-Up|Alt-P", command: "show previous input from history"},
      {keys: "Down|Ctrl-Down|Alt-N", command: "show next input from history"},
      {keys: "Alt-H", command: "browse history"},
      {keys: "Alt-Shift-H", command: "remove items from history"}
    ]);
  }
  

  onFocus(evt) {
    super.onFocus(evt);
    this.highlightWhenFocused && this.animate({
      dropShadow: this.haloShadow,
      duration: 200
    });
  }

  onBlur(evt) {
    super.onBlur(evt);
    this.highlightWhenFocused && this.animate({
      dropShadow: false,
      duration: 200
    });
  }
  
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // html export
  htmlExport_transformNode(node) {
    let doc = node.ownerDocument,
        input = doc.createElement("input"),
        textCSSProps = [
          "padding",
          "font-family",
          "font-weight",
          "font-style",
          "text-decoration",
          "font-size",
          "color"],
        textLayer = node.querySelector(".newtext-text-layer.actual");
    input.id = node.id; input.className = node.className;
    input.style = node.style.cssText;
    Object.assign(input.style, obj.select(textLayer.style, textCSSProps));
    input.placeholder = this.placeholder;
    input.type = "text";
    input.name = this.name.replace(/[\s"]/g, "-");
    return input;
  }
}



import { HTMLMorph } from "../html-morph.js"

// var i = new PasswordInputLine().openInWorld();
// i.remove();

export class PasswordInputLine extends HTMLMorph {

  static get properties() {
    return {
      // this.clipMode = "hidden"
      extent: {defaultValue: pt(100,20)},

      html: {
        derived: true,
        initialize() {},
        get() { return ""; },
        set(x) {}
      },

      domNodeTagName: {readOnly: true, get() { return "input"; }},
      domNodeStyle: {readOnly: true, get() { return ""; }},

      input: {
        derived: true, after: ["domNode"],
        get() { return (this.domNode && this.domNode.value) || ""; },
        set(val) { this.domNode.value = val; this.updateHtml(this.input); }
      },

      placeholder: {
        after: ["domNode"],
        set(val) { this.setProperty("placeholder", val); this.updateHtml(this.input); }
      },

      fontSize: {
        defaultValue: 12, after: ["input"],
        set(value) { this.setProperty("fontSize", value); this.updateHtml(this.input); }
      },

      fontFamily: {
        defaultValue: "sans-serif", after: ["input"],
        set(value) { this.setProperty("fontFamily", value); this.updateHtml(this.input); }
      },

      padding: {
        defaultValue: Rectangle.inset(2), after: ["input"],
        set(value) { this.setProperty("padding", value); this.updateHtml(this.input); }
      },

      // extent: {
      //   defaultValue: pt(100,20), after: ["input"],
      //   get(value) {
      //     let ext = this.getProperty("extent"), pad = this.padding;
      //     return ext.addXY(pad.left() + pad.right(), pad.top() + pad.bottom());
      //   },
      //   set(value) {
      //     let pad = this.padding;
      //     this.setProperty("extent", value.addXY(-(pad.left() + pad.right()), -(pad.top() + pad.bottom())));
      //   },
      // }
    }
  }

  constructor(opts = {}) {
    super(opts);
    this.onLoad();
  }

  bounds() {
    // FIXME
    // show(this.owner.getGlobalTransform().transformRectToRect(this.bounds()))

    return super.bounds();
    // let {padding} = this, {x,y,width, height} = super.bounds();
    // return rect(x, y, width + padding.left()+padding.right(), height + padding.top()+padding.bottom());
  }

  onLoad() {
    // hmm key events aren't dispatched by default...
    this.ensureInputNode().then(node => {
      this.updateHtml(this.input);
      node.onkeydown = evt => this.env.eventDispatcher.dispatchDOMEvent(evt, this, "onKeyDown");
      node.onkeyup = evt => this.env.eventDispatcher.dispatchDOMEvent(evt, this, "onKeyUp");
    });
  }

  ensureInputNode() { return this.whenRendered().then(() => this.domNode); }

  onKeyDown(evt) {
    super.onKeyDown(evt);
    // at that point in time the input has not changed to the most recent value yet
    if (this.input != this.lastInput) {
      this.onInputChanged(this.input);
    }
    this.lastInput = this.input
  }

  focus() {
    super.focus()
    this.domNode && this.domNode.focus(); 
  }

  acceptInput() { var i = this.input; signal(this, "inputAccepted", i); return i; }
  onInputChanged(change) { signal(this, "inputChanged", change); }

  async updateHtml(input) {
    // await this.updateHtml(this.input)
    let {fontSize, fontFamily, padding, placeholder} = this,
        padt = padding.top(),
        padr = padding.right(),
        padb = padding.bottom(),
        padl = padding.left();
    let n = await this.ensureInputNode();
    n.setAttribute("type", "password");
    n.setAttribute("placeholder", placeholder);
    n.setAttribute("value", input);
    Object.assign(n.style, {
      height: `calc(100% - ${padt}px - ${padb}px)`,
      width: `calc(100% - ${padl}px - ${padr}px)`,
      "border-width": 0,
      padding: `${padt}px ${padr}px ${padb}px ${padl}px`,
      "font-size": `${fontSize}px`,
      "font-family": `${fontFamily}`
    });
  }

  get commands() {
    return [
      {name: "accept input", exec: () => { this.acceptInput(); return true; }}
    ].concat(super.commands);
  }

  get keybindings() {
    return super.keybindings.concat([
      {keys: "Enter", command: "accept input"},
      {keys: {mac: "Meta-S", win: "Ctrl-S"}, command: "accept input"}
    ]);
  }
  
  htmlExport_transformNode(node) {    
    let doc = node.ownerDocument,
        oldInput = node.querySelector("input"),
        input = doc.createElement("input"),
        textCSSProps = [
          "padding",
          "font-family",
          "font-weight",
          "font-style",
          "text-decoration",
          "font-size",
          "color"];
    input.id = node.id; input.className = node.className;
    input.placeholder = this.placeholder;
    input.style = node.style.cssText;
    Object.assign(input.style, obj.select(oldInput.style, textCSSProps));
    input.type = "password";
    input.name = this.name.replace(/[\s"]/g, "-");
    return input;
  }

}
