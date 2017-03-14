/*global System*/
import { obj, arr, promise, fun, string } from "lively.lang";
import { rect, Rectangle, Color, pt } from "lively.graphics";
import { Morph, show, config } from "../index.js";
import { Selection, MultiSelection } from "./selection.js";
import { Range } from "./range.js";
import { TextAttribute, TextStyleAttribute } from "./attribute.js";
import TextLayout from "./layout.js";
import TextDocument from "./document.js";
import KeyHandler from "../events/KeyHandler.js";
import { UndoManager } from "../undo.js";
import { Anchor } from "./anchors.js";
import { TextSearcher } from "./search.js";
import { connect, signal } from "lively.bindings"; // for makeInputLine
import commands from "./commands.js";
import { defaultRenderer } from "./rendering.js";
import { lessPosition, lessEqPosition, eqPosition } from "./position.js";
import InputLine from "./input-line.js";
import { Label } from "./label.js";
import { Snippet } from "./snippets.js";
import { RichTextControl } from "./ui.js";


const defaultTextStyle = {
  fontFamily: "Sans-Serif",
  fontSize: 12,
  fontColor: Color.black,
  fontWeight: "normal",
  fontStyle: "normal",
  textDecoration: "none",
  backgroundColor: undefined,
  fixedCharacterSpacing: false,
  textStyleClasses: undefined,
  link: undefined,
  nativeCursor: undefined
}


export class Text extends Morph {

  static makeLabel(value, props) {
    return new Label({
      value,
      fontFamily: "Helvetica Neue, Arial, sans-serif",
      fontColor: Color.almostBlack,
      fontSize: 11,
      ...props
    });
  }

  static makeInputLine(props) { return new InputLine(props); }

  static get properties() {
    return {

      fontMetric: {},

      textLayout: {
        after: ["fontMetric", "padding"],
        initialize() {
          this.textLayout = new TextLayout(this.fontMetric || this.env.fontMetric);
        }
      },

      textRenderer: {defaultValue: defaultRenderer},

      document: {
        after: ["textLayout"],
        initialize() { this.changeDocument(TextDocument.fromString(""), true); }
      },

      undoManager: {
        before: ["document"],
        initialize() { this.ensureUndoManager(); }
      },

      draggable:   {defaultValue: false},
      useSoftTabs: {defaultValue: config.text.useSoftTabs !== undefined ? config.text.useSoftTabs : true},
      tabWidth:    {defaultValue: config.text.tabWidth || 2},

      tab: {
        after: ["useSoftTabs", "tabWidth"], readOnly: true,
        get() { return this.useSoftTabs ? " ".repeat(this.tabWidth) : "\t"; }
      },

      clipMode: {
        defaultValue: "visible",
        set(value)  {
          this.setProperty("clipMode", value);
          this.fixedWidth = this.fixedHeight = this.isClip();
        },
      },

      fixedWidth: {
        after: ["clipMode"], defaultValue: false,
        get() { return this.getProperty("fixedWidth") },
        set(value) {
          this.setProperty("fixedWidth", value);
          this._needsFit = true;
        }
      },

      fixedHeight: {
        after: ["clipMode"], defaultValue: false,
        get() { return this.getProperty("fixedHeight") },
        set(value) {
          this.setProperty("fixedHeight", value);
          this._needsFit = true;
        }
      },

      readOnly: {
        defaultValue: false,
        set(value) {
          this.nativeCursor = value ? "default" : "auto";
          this.setProperty("readOnly", value);
        }
      },

      selectable: {
        after: ["selection"], defaultValue: true,
        set(value) {
          this.setProperty("selectable", value);
          if (!value) this.selection.collapse();
        }
      },

      padding: {
        defaultValue: Rectangle.inset(0),
        set(value) {
          this.setProperty("padding", typeof value === "number" ? Rectangle.inset(value) : value);
          this._needsFit = true;
        }
      },

      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
      // selection

      cursorScreenPosition: {
        derived: true, after: ["cursorPosition"],
        get() { return this.toScreenPosition(this.cursorPosition); },
        set(p) { return this.cursorPosition = this.toDocumentPosition(p); }
      },
      cursorPosition: {
        derived: true, after: ["selection"],
        get() { return this.selection.lead; },
        set(p) { this.selection.range = {start: p, end: p}; }
      },

      selection: {
        after: ["textLayout", "document", "textString"],
        get() {
          var sel = this.getProperty("selection");
          if (sel) return sel;
          sel = new (config.text.useMultiSelect ? MultiSelection : Selection)(this);
          this.setProperty("selection", sel);
          return sel
        },
        set(selOrRange) {
          if (!selOrRange) {
            if (this.selection.isMultiSelection) {
              this.selection.disableMultiSelect();
            }
            this.selection.collapse();
          } else if (selOrRange.isSelection) this.setProperty("selection", selOrRange);
          else this.selection.range = selOrRange;
        }
      },

      selections: {
        derived: true, after: ["selection"],
        get() {
          return this.selection.isMultiSelection ?
            this.selection.selections :
            [this.selection];
        },

        set(sels) {
          this.selection = sels[0];
          if (!this.selection.isMultiSelection) return;
          sels.slice(1).forEach(ea => this.selection.addRange(ea));
        }
      },

      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
      // content

      textString: {
        after: ["document"], derived: true,
        get() { return this.document ? this.document.textString : "" },
        set(value) {
          value = value ? String(value) : "";
          this.deleteText({start: {column: 0, row: 0}, end: this.document.endPosition});
          this.insertText(value, {column: 0, row: 0});
        }
      },

      value: {
        after: ["textAttributes"], derived: true,
        get() {
          var {textAndAttributes} = this;
          if (textAndAttributes.length === 1) {
            var [text, style] = textAndAttributes[0];
            if (!Object.keys(style || {}).length) return text;
          }
          return textAndAttributes;
        },
        set(value) {
          typeof value === "string" ?
            this.textString = value :
            this.textAndAttributes = value;
        }
      },


      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
      // default font styling

      textAttributes: {
        derived: true, after: ["document", "textString"],
        get() { return this.document.textAttributes; },
        set(attrs) {
          // attrs.map(range => this.addTextAttribute(range));
          this.document.textAttributes = attrs;
          this.onAttributesChanged();
        }
      },

      textAndAttributes: {
        derived: true, after: ["document"],
        get() { return this.document.textAndAttributes; },
        set(textAndAttributes) {
          // 1. remove everything
          this.deleteText({start: {row: 0, column: 0}, end: this.documentEndPosition});
          // 2. set text, don't set attributes yet so that attributes don't grow
          // across their border when more text is subsequently inserted
          var rangesAndAttrs = textAndAttributes.map(([text, attrs]) =>
            [this.insertText(text, this.documentEndPosition), attrs]);
          // 3. From the ranges we get from the text insertion we now where to
          // install the attributes
          rangesAndAttrs.forEach(([range, attrs]) =>
            (Array.isArray(attrs) ? attrs : [attrs]).forEach(attr =>
              this.addTextAttribute(attr, range)));
          return {start: {row: 0, column: 0}, end: this.documentEndPosition};
        }
      },

      defaultTextStyleAttribute: {
        derived: true, after: ["textAttributes"],
        get() {
          // currently we have this cryptic convention of having the attribute start
          // at {row: 0, column -1}...
          var attr = this.textAttributes.find(ea =>
            ea.isStyleAttribute && (ea.start.row < 0 || ea.start.row === 0 && ea.start.column < 0));
          if (!attr)
            attr = this.addTextAttribute(new TextStyleAttribute(
              {...defaultTextStyle}, {start: {row: 0, column: -1}, end: this.documentEndPosition}));
          return attr;
        }
      },

      defaultTextStyle: {
        after: ["defaultTextStyleAttribute"],
        initialize() { this.defaultTextStyle = defaultTextStyle; },
        get() { return this.defaultTextStyleAttribute.data; },
        set(style) { this.setDefaultTextStyle(style); }
      },

      fontFamily: {
        derived: true, after: ["defaultTextStyle"],
        get() { return this.defaultTextStyle.fontFamily; },
        set(fontFamily) {
          this.setProperty("fontFamily", fontFamily);
          this.setDefaultTextStyle({fontFamily});
        }
      },

      fontSize: {
        derived: true, after: ["defaultTextStyle"],
        get() { return this.defaultTextStyle.fontSize; },
        set(fontSize) {
          this.setProperty("fontSize", fontSize);
          this.setDefaultTextStyle({fontSize});
        }
      },

      selectionColor: {
        derived: true, after: ["defaultTextStyle"],
        get() { return this.defaultTextStyle.selectionColor; },
        set(selectionColor) {
          this.setProperty("selectionColor", selectionColor);
          this.setDefaultTextStyle({selectionColor});
        }
      },

      fontColor: {
        derived: true, after: ["defaultTextStyle"],
        get() { return this.defaultTextStyle.fontColor; },
        set(fontColor) {
          this.setProperty("fontColor", fontColor);
          this.setDefaultTextStyle({fontColor});
        }
      },

      fontWeight: {
        derived: true, after: ["defaultTextStyle"],
        get() { return this.defaultTextStyle.fontWeight; },
        set(fontWeight) {
          this.setProperty("fontWeight", fontWeight);
          this.setDefaultTextStyle({fontWeight});
        }
      },

      fontStyle: {
        derived: true, after: ["defaultTextStyle"],
        get() { return this.defaultTextStyle.fontStyle; },
        set(fontStyle) {
          this.setProperty("fontStyle", fontStyle);
          this.setDefaultTextStyle({fontStyle});
        }
      },

      textDecoration: {
        derived: true, after: ["defaultTextStyle"],
        get() { return this.defaultTextStyle.textDecoration; },
        set(textDecoration) {
          this.setProperty("textDecoration", textDecoration);
          this.setDefaultTextStyle({textDecoration});
        }
      },

      fixedCharacterSpacing: {
        derived: true, after: ["defaultTextStyle"],
        get() { return this.defaultTextStyle.fixedCharacterSpacing; },
        set(fixedCharacterSpacing) {
          this.setProperty("fixedCharacterSpacing", fixedCharacterSpacing);
          this.setDefaultTextStyle({fixedCharacterSpacing});
        }
      },

      textStyleClasses: {
        derived: true, after: ["defaultTextStyle"],
        get() { return this.defaultTextStyle.textStyleClasses; },
        set(textStyleClasses) {
          this.setProperty("textStyleClasses", textStyleClasses);
          this.setDefaultTextStyle({textStyleClasses});
        }
      },

      backgroundColor: {
        derived: true, after: ["defaultTextStyle"],
        get() { return this.defaultTextStyle.backgroundColor; },
        set(backgroundColor) {
          this.setProperty("backgroundColor", backgroundColor);
          this.setDefaultTextStyle({backgroundColor});
        }
      },

      lineWrapping: {
        after: ["textLayout", "document"],
        set(lineWrapping) {
          this.setProperty("lineWrapping", lineWrapping);
          this.textLayout.updateFromMorphIfNecessary(this);
        }
      },

      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
      // anchors – positions in text that move when text is changed
      anchors: {
        defaultValue: [],
      },

      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
      // markers
      markers: {
        defaultValue: [],
      },

      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
      // marks
      savedMarks: {
        defaultValue: [], after: ["anchors"],
        set(val) {
          var savedMarks = this.savedMarks;
          val = val.map(ea => ea.isAnchor ? ea : this.addAnchor({...ea, id: "saved-mark-" + string.newUUID()}));
          var toRemove = this.savedMarks.filter(ea => !val.includes(ea))
          if (val > config.text.markStackSize)
            toRemove.push(...val.splice(0, val.length - config.text.markStackSize));
          toRemove.map(ea => this.removeAnchor(ea));
          return this.setProperty("savedMarks", val);
        }
      },

      activeMarkPosition: {
        after: ["activeMark"], derived: true,
        get() { var m = this.activeMark; return m ? m.position : null; }
      },

      activeMark: {
        after: ["anchors"],
        set(val) {
          if (val) val = this.addAnchor(val.isAnchor ? val : {...val, id: "saved-mark-" + string.newUUID()});
          else {
            var m = this.activeMark;
            if (!this.savedMarks.includes(m))
              this.removeAnchor(m);
          }
          this.setProperty("activeMark", val);
        }
      },

      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
      // plugins
      plugins: {
        defaultValue: [], after: ["textAttributes", "value"],
        set(plugins) {
          var prevPlugins = this.getProperty("plugins"),
              removed = arr.withoutAll(prevPlugins, plugins);
          removed.forEach(p => this.removePlugin(p));
          plugins.forEach(p => this.addPlugin(p));
        }
      }

    }
  }

  constructor(props = {}) {
    var {
      position, rightCenter, leftCenter, topCenter, bottom, top, right, left,
      bottomCenter, bottomLeft, bottomRight, topRight, topLeft, center,
    } = props;

    super(props);

    this.undoManager.reset();

    this.fit();
    this._needsFit = false;
    // Update position after fit
    if (position !== undefined) this.position = position;
    if (rightCenter !== undefined) this.rightCenter = rightCenter;
    if (leftCenter !== undefined) this.leftCenter = leftCenter;
    if (topCenter !== undefined) this.topCenter = topCenter;
    if (bottom !== undefined) this.bottom = bottom;
    if (top !== undefined) this.top = top;
    if (right !== undefined) this.right = right;
    if (left !== undefined) this.left = left;
    if (bottomCenter !== undefined) this.bottomCenter = bottomCenter;
    if (bottomLeft !== undefined) this.bottomLeft = bottomLeft;
    if (bottomRight !== undefined) this.bottomRight = bottomRight;
    if (topRight !== undefined) this.topRight = topRight;
    if (topLeft !== undefined) this.topLeft = topLeft;
    if (center !== undefined) this.center = center;
  }

  __deserialize__(snapshot, objRef) {
    super.__deserialize__(snapshot, objRef);

    this.markers = [];
    this.textLayout = new TextLayout(this.env.fontMetric);
    this.textRenderer = defaultRenderer;
    this.changeDocument(TextDocument.fromString(""), true);
    this.ensureUndoManager();
    this.setDefaultTextStyle(defaultTextStyle);
    // this.fit();
    // this._needsFit = false;
  }


  get __only_serialize__() {
    let propNames = super.__only_serialize__;
    return arr.withoutAll(propNames,
      ["document", "textLayout", "undoManager", "textRenderer", "textAttributes", "markers"]);
  }

  __additionally_serialize__(snapshot, objRef) {
    let {defaultTextStyleAttribute} = this;
    snapshot.props.textAndAttributes = {
      key: "textAndAttributes",
      verbatim: true,
      value: this.textAndAttributes.map(([text, attrs]) =>
        [text, arr.without(attrs, defaultTextStyleAttribute)
          .map(ea => ea.data)])
    };
  }

  get isText() { return true }

  onChange(change) {
    let textChange = change.selector === "insertText"
                  || change.selector === "deleteText";

    if (textChange
     || (change.prop === "extent" && this.lineWrapping && this.isClip())
     || (change.prop === "lineWrapping" && this.isClip())
     || change.prop === "fixedWidth"
     || change.prop === "fixedHeight"
     || change.prop === "fontFamily"
     || change.prop === "fontSize"
     || change.prop === "backgroundColor"
     || change.prop === "fontColor" // FIXME
     || change.prop === "fontWeight"
     || change.prop === "fontStyle"
     || change.prop === "textDecoration"
     || change.prop === "fixedCharacterSpacing"
     || change.prop === "textStyleClasses"
    ) this.textLayout && (this.textLayout.layoutComputed = false);

    super.onChange(change);
    textChange && signal(this, "textChange", change);
  }

  rejectsInput() { return this.readOnly /*|| !this.isFocused()*/ }

  addAnchor(anchor) {
    if (!anchor) return;

    if (typeof anchor === "string") {
      anchor = {id: anchor, row: 0, column: 0};
    }

    if (!anchor.isAnchor) {
      let {id, column, row} = anchor;
      anchor = new Anchor(id,
                row || column ? {row, column} : undefined,
                anchor.insertBehavior || "move");
    }

    var existing = anchor.id && this.anchors.find(ea => ea.id === anchor.id);
    if (existing) return Object.assign(existing, anchor);

    this.anchors.push(anchor);
    return anchor;
  }

  removeAnchor(anchor) {
    this.anchors = this.anchors.filter(
      typeof anchor === "string" ?
        ea => ea.id !== anchor :
        ea => ea !== anchor);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // markers, text ranges with styles that are rendered over/below the text and
  // do not influence the text appearance themselves
  addMarker(marker) {
    // id, range, style
    this.removeMarker(marker.id);
    this.markers.push(marker);
    this.makeDirty();
    return marker;
  }

  removeMarker(marker) {
    var id = typeof marker === "string" ? marker : marker.id;
    this.markers = this.markers.filter(ea => ea.id !== id);
    this.makeDirty();
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // marks: text position that are saved and can be retrieved
  // the activeMark affects movement commands: when it's active movement will
  // select

  saveMark(p = this.cursorPosition, activate) {
    var prevMark = this.activeMark;
    if (prevMark && prevMark !== p && !prevMark.equalsPosition(p))
      this.savedMarks = this.savedMarks.concat(prevMark);
    if (activate) this.activeMark = p;
    else this.savedMarks = this.savedMarks.concat(p);
  }

  saveActiveMarkAndDeactivate() {
    var m = this.activeMark;
    if (m) {
      this.saveMark(m);
      this.activeMark = null;
    }
  }

  popSavedMark() {
    var mark = this.activeMark;
    if (mark) { this.activeMark = null; return mark; }
    var last = arr.last(this.savedMarks);
    this.savedMarks = this.savedMarks.slice(0, -1);
    return last;
  }

  get lastSavedMark() { return this.activeMark || arr.last(this.savedMarks); }

  savedMarkForSelection(replacement) {
    // find the mark in $emacsMarkRing corresponding to the current
    // selection
    var {selection: sel, savedMarks} = this,
        multiRangeLength = this.multiSelect ?
            this.multiSelect.getAllRanges().length : 1,
        selIndex = sel.index || 0,
        markIndex = savedMarks.length - (multiRangeLength - selIndex),
        lastMark = savedMarks[markIndex] || sel.anchor;
    if (replacement && "row" in replacement && "column" in replacement) {
      this.savedMarks = savedMarks.slice(0, markIndex)
                          .concat(replacement)
                          .concat(savedMarks.slice(markIndex+1))
    }
    return lastMark;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // plugins: objects that can attach/detach to/from text objects and react to
  // text changes as well as modify text however they see fit

  addPlugin(plugin) {
    if (!this.plugins.includes(plugin)) {
      this.plugins.push(plugin);
      this._cachedKeyhandlers = null;
      typeof plugin.attach === "function" && plugin.attach(this);
    }
    return plugin;
  }

  removePlugin(plugin) {
    if (!this.plugins.includes(plugin)) return false;
    this._cachedKeyhandlers = null;
    arr.remove(this.plugins, plugin);
    typeof plugin.detach === "function" && plugin.detach(this);
    return true
  }

  pluginCollect(method, result = []) {
    this.plugins.forEach(p =>
      typeof p[method] === "function" &&
        (result = p[method](result)));
    return result;
  }

  pluginInvokeFirst(method, ...args) {
    var plugin = this.pluginFind(p => typeof p[method] === "function");
    return plugin ? plugin[method](...args) : undefined;
  }

  pluginFind(iterator) {
    return this.plugins.slice().reverse().find(iterator);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  textBounds() {
    return this.textLayout ? this.textLayout.textBounds(this) : this.padding.topLeft().extent(pt(0,0));
  }

  get scrollExtent() {
    // rms: See: morph>>scrollExtent
    const HTMLScrollbarOffset = pt(15,15);
    return this.textBounds().extent()
      .addPt(this.padding.topLeft())
      .addPt(this.padding.bottomRight())
      .addPt(HTMLScrollbarOffset)
      .maxPt(super.scrollExtent);
  }

  get commands() {
    return this.pluginCollect("getCommands", (this._commands || []).concat(commands))
  }


  execCommand(commandOrName, args, count, evt) {
    var {name, command} = this.lookupCommand(commandOrName) || {};
    if (!command) return undefined;

    var multiSelect = this.inMultiSelectMode(),
        multiSelectAction = command.hasOwnProperty("multiSelectAction") ?
          command.multiSelectAction : "forEach";

    // first we deal with multi select, if the command doesn't handle it
    // itsself. From inside here we just set the selection to each range in the
    // multi selection and then let the comand run normally
    if (multiSelect && multiSelectAction === "forEach") {
      var origSelection = this.selection,
          selections = this.selection.selections.slice().reverse();
      this.selection = selections[0];
      this._multiSelection = origSelection;

      try {
        var result = this.execCommand(commandOrName, args, count, evt);
      } catch(err) {
        this.selection = origSelection;
        this._multiSelection = null;
        this.selection.mergeSelections();
        throw err;
      }

      if (!result) return result;
      var results = [result];

      if (typeof result.then === "function" && typeof result.catch === "function") {
        return promise.finally(promise.chain([() => result].concat(
            selections.slice(1).map(sel => () => {
              this.selection = sel;
              return Promise.resolve(this.execCommand(commandOrName, args, count, evt))
                      .then(result => results.push(result));
            }))).then(() => results),
            () => {
              this.selection = origSelection;
              this._multiSelection = null;
              this.selection.mergeSelections();
            });

      } else {
        try {
          for (var sel of selections.slice(1)) {
            this.selection = sel;
            results.push(this.execCommand(commandOrName, args, count, evt))
          }
        } finally {
          this.selection = origSelection;
          this._multiSelection = null;
          this.selection.mergeSelections();
        }
        return results;
      }
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // Here we know that we don't have to deal with multi select and directly
    // call the command handler

    var result = this.commandHandler.exec(commandOrName, this, args, count, evt);

    if (result) {
      if (typeof result.then === "function" && typeof result.catch === "function")
        result.then(() => cleanupScroll(this))
      else
        cleanupScroll(this);
    }

    return result;

    function cleanupScroll(morph) {
      var scrollCursorIntoView = command.hasOwnProperty("scrollCursorIntoView") ?
        command.scrollCursorIntoView : true;
      if (scrollCursorIntoView)
        fun.debounceNamed("execCommand-scrollCursorIntoView-" + morph.id,
          100, () => morph.scrollCursorIntoView())();
    }

  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // document changes

  changeDocument(doc, resetStyle = false) {
    if (this.document) var defaultTextStyle = this.defaultTextStyle;
    else resetStyle = false;
    this.document = doc;
    this.textLayout.reset();
    if (resetStyle)
      this.setDefaultTextStyle(defaultTextStyle);
    this.makeDirty();
  }

  textInRange(range) { return this.document.textInRange(range); }
  charRight({row, column} = this.cursorPosition) { return this.getLine(row).slice(column, column+1); }
  charLeft({row, column} = this.cursorPosition) { return this.getLine(row).slice(column-1, column); }

  indexToPosition(index) { return this.document.indexToPosition(index); }
  positionToIndex(position) { return this.document.positionToIndex(position); }

  getVisibleLine(row = this.cursorScreenPosition.row) {
    return this.textLayout.wrappedLines(this)[row].text
  }

  isLineVisible(row = this.cursorScreenPosition.row) {
    return this.textLayout.isLineVisible(this, row);
  }

  isLineFullyVisible(row = this.cursorScreenPosition.row) {
    return this.textLayout.isLineFullyVisible(this, row);
  }

  getLine(row = this.cursorPosition.row) {
    var doc = this.document;
    return doc.getLine(row);
  }
  isLineEmpty(row) { return !this.getLine(row).trim(); }
  isAtLineEnd(pos = this.cursorPosition) {
    var line = this.getLine(pos.row);
    return pos.column === line.length;
  }

  wordsOfLine(row = this.cursorPosition.row) { return this.document.wordsOfLine(row); }
  wordAt(pos = this.cursorPosition) { return this.document.wordAt(pos); }
  wordLeft(pos = this.cursorPosition) { return this.document.wordLeft(pos); }
  wordRight(pos = this.cursorPosition) { return this.document.wordRight(pos); }

  lineRange(row = this.cursorPosition.row, ignoreLeadingWhitespace = true) {
    if (typeof row !== "number") this.cursorPosition.row;
    var line = this.getLine(row),
        range = {start: {column: 0, row}, end: {column: line.length, row}},
        leadingSpace = line.match(/^\s*/);
    if (leadingSpace[0].length && ignoreLeadingWhitespace)
      range.start.column += leadingSpace[0].length;
    return new Range(range);
  }

  rangesOfWrappedLine(row = this.cursorPosition.row) {
    return this.textLayout.rangesOfWrappedLine(this, row);
  }

  screenLineRange(pos = this.cursorPosition, ignoreLeadingWhitespace = true) {
    var ranges = this.textLayout.rangesOfWrappedLine(this, pos.row),
        range = ranges.slice().reverse().find(({start, end}) => start.column <= pos.column),
        content = this.textInRange(range),
        leadingSpace = content.match(/^\s*/);
    if (leadingSpace[0].length && ignoreLeadingWhitespace)
      range.start.column += leadingSpace[0].length;
    if (range !== arr.last(ranges)) range.end.column--;
    return new Range(range);
  }

  setTextWithTextAttributes(text, attributes) {
     this.deleteText({start: {row: 0, column: 0}, end: this.documentEndPosition});
     return this.insertTextWithTextAttributes(text, attributes, {row: 0, column: 0});
  }

  insertTextWithTextAttributes(text, attributes = [], pos) {
    if (!Array.isArray(attributes)) attributes = [attributes];
    var range = this.insertText(text, pos);
    attributes.forEach(attr => this.addTextAttribute(attr, range));
    return range;
  }

  insertTextAndSelect(text, pos = null) {
    text = String(text);
    if (pos) this.selection.range = this.insertText(text, pos);
    else this.selection.text = text;
  }

  append(text) {
    return this.saveExcursion(() =>
      this.insertText(text, this.documentEndPosition));
  }

  insertText(text, pos = this.cursorPosition) {
    text = String(text);

    if (!text.length) return Range.fromPositions(pos, pos);

    // ensure that the default text style includes the newly inserted text
    var defaultStyleAttr = this.defaultTextStyleAttribute;
    if (lessPosition(defaultStyleAttr.end, pos)) {
      var prevEnd = defaultStyleAttr.end;
      // FIXME this is a hacky version of updating the document's cache, this
      // should better be hidden inside the doc!
      arr.range(prevEnd.row+1, pos.row).map(row => {
        var attrsOfLine = this.document._textAttributesByLine[row]
                       || (this.document._textAttributesByLine[row] = []);
        if (!attrsOfLine.includes(defaultStyleAttr))
          attrsOfLine.unshift(defaultStyleAttr);
      });
      this.defaultTextStyleAttribute.end = pos;
    }

    // the document manages the actual content
    var range = this.document.insert(text, pos);

    this.textLayout.shiftLinesIfNeeded(this, range, "insertText");

    this.undoManager.undoStart(this, "insertText");

    this.addMethodCallChangeDoing({
      target: this,
      selector: "insertText",
      args: [text, pos],
      undo: {
        target: this,
        selector: "deleteText",
        args: [range],
      }
    }, () => {
      this._needsFit = true;
      this.anchors.forEach(ea => ea.onInsert(range));
      // When auto multi select commands run, we replace the actual selection
      // with individual normal selections
      if (this._multiSelection) this._multiSelection.updateFromAnchors();
      else this.selection.updateFromAnchors();
    });

    this.undoManager.undoStop();

    return new Range(range);
  }

  deleteText(range) {
    range = range.isRange ? range : new Range(range);

    if (range.isEmpty()) return;

    this.undoManager.undoStart(this, "deleteText");
    var {document: doc, textLayout} = this,
        text = doc.textInRange(range);
    doc.remove(range);
    textLayout.shiftLinesIfNeeded(this, range, "deleteText");
    this._needsFit = true;

    this.addMethodCallChangeDoing({
      target: this,
      selector: "deleteText",
      args: [range],
      undo: {
        target: this,
        selector: "insertText",
        args: [text, range.start],
      }
    }, () => {
      this.anchors.forEach(ea => ea.onDelete(range));
      // When auto multi select commands run, we replace the actual selection
      // with individual normal selections
      if (this._multiSelection) this._multiSelection.updateFromAnchors();
      else this.selection.updateFromAnchors();
    });
    this.undoManager.undoStop();
    return text;
  }

  replace(range, text, undoGroup = false) {
    if (undoGroup) this.undoManager.group();
    this.deleteText(range);
    var range = this.insertText(text, range.start);
    if (undoGroup) this.undoManager.group();
    return range;
  }

  modifyLines(startRow, endRow, modifyFn) {
    var lines = arr.range(startRow, endRow).map(row => this.getLine(row)),
        modifiedText = lines.map(modifyFn).join("\n") + "\n";
    this.deleteText({start: {row: startRow, column: 0}, end: {row: endRow+1, column: 0}})
    this.insertText(modifiedText, {row: startRow, column: 0});
  }

  modifySelectedLines(modifyFn) {
    var range = this.selection.isEmpty() ?
      this.lineRange(undefined, false) :
      this.selection.range;
    return this.modifyLines(range.start.row, range.end.row, modifyFn);
  }

  withLinesDo(startRow, endRow, doFunc) {
    return arr.range(startRow, endRow).map(row => {
      var line = this.getLine(row),
          range = Range.create(row, 0, row, line.length);
      return doFunc(line, range);
    });
  }

  withSelectedLinesDo(doFunc) {
    var range = this.selection.isEmpty() ?
      this.lineRange(undefined, false) :
      this.selection.range;
    var {start: {row: startRow}, end: {row: endRow, column: endColumn}} = range;
    // if selection is only in the beginning of last line don't include it
    return this.withLinesDo(startRow, endColumn === 0 && endRow > startRow ? endRow-1 : endRow, doFunc);
  }

  joinLine(row = this.cursorPosition.row) {
    // joins line identified by row with following line
    // returns the position inside the joined line where the join happened
    var firstLine = this.getLine(row),
        otherLine = this.getLine(row+1),
        joined = firstLine + otherLine.replace(/^\s+/, "") + this.document.constructor.newline;
    this.replace({start: {column: 0, row}, end: {column: 0, row: row+2}}, joined, true);
    return {row, column: firstLine.length};
  }

  get whatsVisible() {
    var startRow = this.textLayout.firstVisibleLine || 0,
        endRow = this.textLayout.lastVisibleLine,
        lines = this.lineWrapping ?
          this.textLayout.wrappedLines(this).slice(startRow, endRow).map(ea => ea.text) :
          this.document.lines.slice(startRow, endRow);
    return {lines, startRow, endRow};
  }


  flash(range = this.selection.range, options) {
    options = {time: 1000, fill: Color.orange, ...options};
    var id = options.id || "flash" + string.newUUID();
    this.addMarker({
      id, range: range,
      style: {
        "background-color": options.fill.toCSSString(),
        "pointer-events": "none"
      }
    });
    fun.debounceNamed("flash-" + id, options.time, () => this.removeMarker(id))();
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // TextAttributes
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  setSortedTextAttributes(attrs) {
    // see comment in document
    this.document.setSortedTextAttributes(attrs);
    this.onAttributesChanged();
  }

  addTextAttribute(attr, range/*optional, if attr doesn't specify*/) {
    if (!attr.isTextAttribute)
      attr = TextStyleAttribute.isStyleData(attr) ?
        new TextStyleAttribute(attr) : new TextAttribute(attr);
    if (range) attr.range = range;
    var attr = this.document.addTextAttribute(attr);
    this.onAttributesChanged();
    return attr;
  }

  removeTextAttribute(attr) {
    this.document.removeTextAttribute(attr);
    this.onAttributesChanged();
  }

  textAttributesAt(point) {
    var chunk = this.textLayout.chunkAtPoint(this, point);
    return chunk ? chunk.textAttributes : [];
  }

  textAttributesAtScreenPos(pos) {
    var chunk = this.textLayout.chunkAtScreenPos(this, pos);
    return chunk ? chunk.textAttributes : [];
  }

  resetTextAttributes() {
    this.document.resetTextAttributes();
    this.setDefaultTextStyle();
  }

  onAttributesChanged() {
    this._needsFit = true;
    this.textLayout && (this.textLayout.layoutComputed = false);
    this.makeDirty();
  }

  styleAt(point) {
    var chunk = this.textLayout.chunkAtPoint(this, point);
    return chunk ? chunk.style : {...this.defaultTextStyle};
  }

  styleAtScreenPos(pos) {
    var chunk = this.textLayout.chunkAtScreenPos(this, pos);
    return chunk ? chunk.style : {...this.defaultTextStyle};
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // text styles (ranges)
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  setDefaultTextStyle(style = obj.select(this, TextStyleAttribute.styleProps)) {
    var attr = this.defaultTextStyleAttribute;
    Object.assign(attr.data, style);
    this.onAttributesChanged();
    return attr;
  }

  getStyleInRange(range = this.selection) {
    var [[from, to, firstStyle]] = this.document.stylesChunked(range);
    return firstStyle;
  }

  setStyleInRange(style, range = this.selection) {
    this.document.setStyleInRange(
      style, range, this.document._textAttributes[0]);
    this.onAttributesChanged();
  }

  resetStyleInRange(range = this.selection) {
    this.setStyleInRange(this.defaultTextStyle, range);
  }


  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // selection

  inMultiSelectMode() {
    return this.selection.selections && this.selection.selections.length > 1;
  }

  selectionBounds() {
    return this.selections.map(sel => {
      var start = this.charBoundsFromTextPosition(sel.start),
          end = this.charBoundsFromTextPosition(sel.end)
      return sel.start.row === sel.end.row ?
        start.union(end) :
        rect(pt(this.padding.left(), start.top()),
             pt(this.width-this.padding.left(), end.bottom()));
    }).reduce((all, ea) => ea.union(all));
  }

  get documentEndPosition() { return this.document ? this.document.endPosition : {row: 0, column: 0}; }
  isAtDocumentEnd() { return eqPosition(this.cursorPosition, this.documentEndPosition); }

  cursorUp(n = 1) { return this.selection.goUp(n); }
  cursorDown(n = 1) { return this.selection.goDown(n); }
  cursorLeft(n = 1) { return this.selection.goLeft(n); }
  cursorRight(n = 1) { return this.selection.goRight(n); }

  getPositionAboveOrBelow(n = 1, pos = this.cursorPosition, useScreenPosition = false, goalColumn) {
    // n > 0 above, n < 0 below

    if (n === 0) return pos;

    if (!useScreenPosition) {
      if (goalColumn === undefined) goalColumn = pos.column
      return {
        row: pos.row-n,
        column: Math.min(this.getLine(pos.row-n).length, goalColumn)
      }
    }

    // up / down in screen coordinates is a little difficult, there are a
    // number of requirements to observe:
    // When going up and down the "goalColumn" should be observed, that is
    // the column offset from the (screen!) line start that the cursor should
    // be placed on. If the (screen) line is shorter than that then the cursor
    // should be placed at line end. Important here is that the line end for
    // wrapped lines is actually not the column value after the last char but
    // the column before the last char (b/c there is no newline the cursor could
    // be placed between). For actual line ends the last column value is after
    // the last char.

    var ranges = this.rangesOfWrappedLine(pos.row)
    if (!ranges.length) return pos;

    var currentRangeIndex = ranges.length -1 - ranges.slice().reverse().findIndex(({start, end}) =>
                                                  start.column <= pos.column),
        nextRange, nextRangeIsAtLineEnd = false;

    if (n >= 1) {
      var isFirst = 0 === currentRangeIndex;
      nextRange = isFirst ?
        arr.last(this.rangesOfWrappedLine(pos.row-1)) :
        ranges[currentRangeIndex-1];
      if (!nextRange) return pos;
      nextRangeIsAtLineEnd = isFirst;

    } else if (n <= -1) {
      var isLast = ranges.length-1 === currentRangeIndex,
          nextRanges = isLast ?
            this.rangesOfWrappedLine(pos.row+1) :
            ranges.slice(currentRangeIndex+1);
      nextRange = nextRanges[0];
      if (!nextRange) return pos;
      nextRangeIsAtLineEnd = nextRanges.length === 1;
    }

    if (goalColumn === undefined)
      goalColumn = pos.column - ranges[currentRangeIndex].start.column

    var columnOffset = Math.min(nextRange.end.column - nextRange.start.column, goalColumn),
        column = nextRange.start.column + columnOffset;
    if (!nextRangeIsAtLineEnd && column >= nextRange.end.column) column--;

    var newPos = {row: nextRange.end.row, column};

    return Math.abs(n) > 1 ?
      this.getPositionAboveOrBelow(n + (n > 1 ? -1 : 1), newPos, useScreenPosition, goalColumn) :
      newPos
  }

  collapseSelection() {
    this.selection.collapse(this.selection.lead);
    return this.selection;
  }

  selectAll() {
    this.selection.selectAll();
    return this.selection;
  }

  selectLine(row = this.cursorPosition.row, includingLineEnd = false) {
    this.selection.selectLine(row, includingLineEnd);
    return this.selection;
  }

  selectionOrLineString() {
    var {text, start} = this.selection;
    return text ? text : this.getLine(start.row);
  }

  scrollCursorIntoView() {
    this.scrollPositionIntoView(this.cursorPosition);
  }

  centerRange(range = this.selection.range, offset = pt(0,0), alignAtTopIfLarger = true) {
    var t = this.charBoundsFromTextPosition(range.start).top(),
        b = this.charBoundsFromTextPosition(range.end).bottom(),
        height = b - t;

    if (height < this.height || alignAtTopIfLarger === false) {
      var centerY = t + height/2;
      this.scroll = this.scroll.withY(centerY - this.height/2).addPt(offset);
    } else {
      this.scroll = this.scroll.withY(t).addPt(offset);
    }
  }

  centerRow(row = this.cursorPosition.row, offset = pt(0,0)) {
    return this.alignRowAtTop(row, offset.addXY(0, -this.height/2));
  }

  alignRowAtTop(row = this.cursorPosition.row, offset = pt(0,0)) {
    var charBounds = this.charBoundsFromTextPosition({row, column: 0}),
        pos = charBounds.topLeft().addXY(-this.padding.left(), 0);
    this.scroll = pos.addPt(offset);
  }

  scrollPositionIntoView(pos, offset = pt(0,0)) {
    if (!this.isClip()) return;
    var { scroll, padding } = this,
        paddedBounds = this.innerBounds().translatedBy(scroll),
        charBounds =   this.charBoundsFromTextPosition(pos),
        // if no line wrapping is enabled we add a little horizontal offset so
        // that characters at line end are better visible
        charBounds =   this.lineWrapping ? charBounds : charBounds.insetByPt(pt(-20, 0)),
        delta = charBounds.topLeft()
          .subPt(paddedBounds.translateForInclusion(charBounds).topLeft());
    this.scroll = this.scroll.addPt(delta).addPt(offset);

    if (this.isFocused()) this.ensureKeyInputHelperAtCursor();
  }

  keepPosAtSameScrollOffsetWhile(doFn, pos = this.cursorPosition) {
    // doFn has some effect on the text that might change the scrolled
    // position, like changing the font size. This function ensures that the
    // text position given will be at the same scroll offset after running the doFn
    var {scroll, selection: {lead: pos}} = this,
        offset = this.charBoundsFromTextPosition(pos).y - scroll.y,
        isPromise = false,
        cleanup = () => this.scroll =
          this.scroll.withY(this.charBoundsFromTextPosition(pos).y - offset);

    try {
      var result = doFn();
      isPromise = result && result instanceof Promise;
    } finally { !isPromise && cleanup(); }
    if (isPromise) promise.finally(result, cleanup);
    return result;
  }

  saveExcursion(doFn, opts) {
    // run doFn that can change the morph arbitrarily and keep selection /
    // scroll as it was before doFn.
    // if opts = {useAnchors: true} is used then use anchors to mark selection.
    // subsequent text modifications will move anchors around. useful for
    // insertText / deleteText but not helpful when entire textString changes.
    opts = {useAnchors: false, ...opts};
    var sels = this.selection.isMultiSelection ?
                this.selection.selections.map(ea => ea.directedRange) :
                [this.selection],
        anchors = opts.useAnchors ? sels.map(({start, end}) => [
          this.addAnchor({...start, id: "save-excursion-" + string.newUUID()}),
          this.addAnchor({...end, id: "save-excursion-" + string.newUUID()}),
        ]) : null,
        isPromise = false,
        cleanup = opts.useAnchors ? () => {
          var sels = anchors.map(([{position: start}, {position: end}]) => ({start, end}));
          this.selections = sels;
          anchors.forEach(([a, b]) => { this.removeAnchor(a); this.removeAnchor(b); });
        } : () => this.selections = sels;
    try {
      var result = this.keepPosAtSameScrollOffsetWhile(doFn);
      isPromise = result && result instanceof Promise;
    } finally { !isPromise && cleanup(); };
    if (isPromise) promise.finally(result, cleanup);
    return result;
  }

  alignRow(row, how = "center") {
    // how = "center", "bottom", "top";
    if (!this.isClip()) return;
    var { scroll, padding } = this,
        paddedBounds = this.innerBounds().insetByRect(padding).translatedBy(scroll),
        charBounds =   this.charBoundsFromTextPosition({row, column: 0}),
        deltaY = how === "top" || how === "bottom" ?
          paddedBounds[how]() - charBounds[how]() :
          how === "center" ?
            paddedBounds[how]().y - charBounds[how]().y : 0;
    if (deltaY)
      this.scroll = this.scroll.addXY(0, -deltaY)
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // text layout related

  fit() {
    let {fixedWidth, fixedHeight} = this;
    if ((fixedHeight && fixedWidth) || !this.textLayout/*not init'ed yet*/) return;
    let textBounds = this.textBounds().outsetByRect(this.padding);
    if (!fixedHeight) this.height = textBounds.height;
    if (!fixedWidth) this.width = textBounds.width;
    return this;
  }

  fitIfNeeded() {
    if (this._needsFit) { this.fit(); this._needsFit = false; }
  }

  get defaultLineHeight() {
    var p = this.padding;
    return p.top() + p.bottom() + this.textLayout.fontMetric.defaultLineHeight({fontSize: this.fontSize, fontFamily: this.fontFamily})
  }

  textPositionFromPoint(point) {
    // FIXME cleanup when text wrapping thing done!
    return this.textLayout.screenToDocPos(this, this.screenPositionFromPoint(point));
  }

  screenPositionFromPoint(point) {
    // FIXME cleanup when text wrapping thing done!
    return this.textLayout.screenPositionFor(this, point);
  }

  toScreenPosition(documentPosition) {
    return this.textLayout.docToScreenPos(this, documentPosition);
  }

  toDocumentPosition(screenPosition) {
    return this.textLayout.screenToDocPos(this, screenPosition);
  }

  charBoundsFromTextPosition(pos) {
    return this.textLayout.boundsFor(this, pos);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // rendering

  forceRerender() {
    // expensive!
    this.textLayout.reset();
    this.makeDirty();
  }

  aboutToRender(renderer) {
    super.aboutToRender(renderer);
    this.fitIfNeeded();
  }

  render(renderer) { return this.textRenderer.renderMorph(renderer, this); }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // mouse events

  onMouseDown(evt) {
    if (evt.rightMouseButtonPressed()) return;

    this.activeMark && (this.activeMark = null);

    var {position, state: {clickedOnMorph, clickedOnPosition, clickCount}} = evt;
    if (clickedOnMorph !== this) return;

    var maxClicks = 3, normedClickCount = ((clickCount - 1) % maxClicks) + 1,
        clickPos = this.localize(position),
        clickTextPos = this.textPositionFromPoint(clickPos);

    if (evt.leftMouseButtonPressed() && !evt.isShiftDown() && !evt.isAltDown()
     && this.callTextAttributeDoitFromMouseEvent(evt, clickPos)) {
      // evt.stop();
      // return;
    }

    if (!this.selectable) return;

    if (evt.isShiftDown()) {
      this.selection.lead = clickTextPos;
    } else if (evt.isAltDown()) {
      this.selection.addRange(Range.at(clickTextPos));
    } else {
      this.selection.disableMultiSelect();
      if (normedClickCount === 1) {
        if (!evt.isShiftDown()) this.selection = {start: clickTextPos, end: clickTextPos};
        else this.selection.lead = clickTextPos
      }
      else if (normedClickCount === 2) this.execCommand("select word", null, 1, evt);
      else if (normedClickCount === 3) this.execCommand("select line", null, 1, evt);
    }

    if (this.isFocused()) this.ensureKeyInputHelperAtCursor();
  }

  callTextAttributeDoitFromMouseEvent(evt, clickPos) {
    var attributes = this.textAttributesAt(clickPos) || [], doit;
    // if (this === that) inspect([evt.positionIn(this), clickPos])
    for (var i = attributes.length; i--; ) {
      var ea = attributes[i];
      if (ea.data && ea.data.doit) { doit = ea.data.doit; break; }
    }
    if (!doit || !doit.code) return false;

  // FIXME move this to somewhere else?
    var moduleId = `lively://text-doit/${this.id}`,
        mod = lively.modules.module(moduleId);
    mod.recorder.evt = evt;
    lively.vm.runEval(doit.code, {
      context: doit.context || this,
      format: "esm",
      targetModule: moduleId
    })
    .catch(err => this.world().logError(new Error(`Error in text doit: ${err.stack}`)));
    // .then(() => mod.recorder.evt = null)

    return true;
  }

  onMouseMove(evt) {
    if (!evt.leftMouseButtonPressed() || !this.selectable
     || evt.state.clickedOnMorph !== this) return;
    this.selection.lead = this.textPositionFromPoint(this.localize(evt.position))
  }

  onContextMenu(evt) {
    var posClicked = this.textPositionFromPoint(this.localize(evt.position));
    var sels = this.selection.selections || [this.selection];
    if (this.selection.isEmpty() || sels.every(sel => !sel.range.containsPosition(posClicked)))
      this.cursorPosition = posClicked;
    return super.onContextMenu(evt);
  }

  async menuItems() {
    var items = [
      ["run command", () => { this.focus(); this.world().execCommand("run command")}],
      {command: "text undo", alias: "undo", target: this, showKeyShortcuts: true},
      {command: "text redo", alias: "redo", target: this, showKeyShortcuts: true},
      {command: "manual clipboard copy", alias: "copy", target: this, showKeyShortcuts: this.keysForCommand("clipboard copy"), args: {collapseSelection: false, delete: false}},
      {command: "manual clipboard paste", alias: "paste", target: this, showKeyShortcuts: this.keysForCommand("clipboard paste")}];

    for (let plugin of this.plugins) {
      if (typeof plugin["getMenuItems"] === "function")
        items = await plugin["getMenuItems"](items);
    }
    return items;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // keyboard events

  get keybindings() {
    return this.pluginCollect("getKeyBindings", super.keybindings.concat(config.text.defaultKeyBindings))
  }
  set keybindings(x) { super.keybindings = x }
  get keyhandlers() {
    return this._cachedKeyhandlers
       || (this._cachedKeyhandlers = this.pluginCollect("getKeyHandlers", super.keyhandlers.concat(this._keyhandlers || [])));
  }

  get snippets() {
    return this.pluginCollect("getSnippets", []).map(snippet => {
      if (snippet.isTextSnippet) return snippet;
      var [trigger, expansion] = snippet;
      return new Snippet({trigger, expansion});
    })
  }

  onKeyDown(evt) {
    this.selection.cursorBlinkStart();
    KeyHandler.invokeKeyHandlers(this, evt, true/*no input evts*/);
  }

  onTextInput(evt) {
    KeyHandler.invokeKeyHandlers(this, evt, false/*allow input evts*/);
  }

  doSave() { /*...*/ }

  onCut(evt) {
    if (this.rejectsInput() || !this.isFocused()) return;
    if (config.emacs) return;
    this.onCopy(evt, !this.rejectsInput())
  }

  onCopy(evt, deleteCopiedText = false) {
    if (!this.isFocused()) return;
    evt.stop();
    var sel = this.selection;
    evt.domEvt.clipboardData.setData("text", sel.text);
    this.execCommand("manual clipboard copy", {delete: deleteCopiedText, dontTryNativeClipboard: true})
  }

  onPaste(evt) {
    if (this.rejectsInput()) return;
    evt.stop();
    var data = evt.domEvt.clipboardData.getData("text");
    this.undoManager.group();
    var sel = this.selection,
        sels = sel.isMultiSelection ? sel.selections : [sel];
    sels.forEach(sel => {
      sel.text = data;
      this.saveMark(sel.start);
      sel.collapseToEnd();
    });
    this.undoManager.group();
  }

  onFocus(evt) {
    this.makeDirty();
    this.selection.cursorBlinkStart();
  }

  onScroll(evt) {
    if (this.isFocused())
      this.ensureKeyInputHelperAtCursor();
  }

  ensureKeyInputHelperAtCursor() {
    // move the textarea to the text cursor
    if (this.env.eventDispatcher.keyInputHelper)
      this.env.eventDispatcher.keyInputHelper.ensureBeingAtCursorOfText(this);
  }

  onBlur(evt) {
    this.makeDirty();
    this.selection.cursorBlinkStop();
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // command helper

  pageUpOrDown(opts = {direction: "up", select: false}) {
    var {direction, select} = opts;
    this[direction === "down" ? "scrollPageDown" : "scrollPageUp"]();
    var offset = pt(0, (direction === "down" ? 1 : -1) * this.height),
        pos = this.textLayout.pixelPositionFor(this, this.cursorPosition).addPt(offset),
        textPos = this.textPositionFromPoint(pos);
    if (!opts || !opts.select) this.cursorPosition = textPos;
    else this.selection.lead = textPos;
  }

  gotoDocumentStart(opts = {select: false}) {
    this.selection.lead = {row: 0, column: 0};
    if (!opts || !opts.select) this.selection.anchor = this.selection.lead;
  }

  gotoDocumentEnd(opts = {select: false}) {
    this.selection.lead = this.documentEndPosition;
    if (!opts || !opts.select) this.selection.anchor = this.selection.lead;
  }

  paragraphRangeAbove(row) {
    var startLineIsEmpty = this.isLineEmpty(row),
        rowInParagraph;
    if (startLineIsEmpty) { // we need to go above to find the paragraph start
      for (var i = row - 1; i >= 0; i--)
        if (!this.isLineEmpty(i)) { rowInParagraph = i; break; }
      if (rowInParagraph === undefined) return {start: {row, column: 0}, end: {row, column: 0}};
    } else rowInParagraph = row;
    return this.paragraphRange(rowInParagraph);
  }

  paragraphRangeBelow(row) {
    var startLineIsEmpty = this.isLineEmpty(row),
        rowInParagraph,
        endPos = this.documentEndPosition;

    if (startLineIsEmpty) { // we need to go above to find the paragraph start
      for (var i = row+1; i <= endPos.row; i++)
        if (!this.isLineEmpty(i)) { rowInParagraph = i; break; }
      if (rowInParagraph === undefined) return {start: {row, column: 0}, end: {row, column: 0}};
    } else rowInParagraph = row;

    return this.paragraphRange(rowInParagraph);
  }

  paragraphRange(row) {
    if (this.isLineEmpty(row)) return {start: {row, column: 0}, end: {row, column: 0}}

    var endPos = this.documentEndPosition,
        pragraphEnd;

    for (var i = row+1; i <= endPos.row; i++)
      if (this.isLineEmpty(i)) { pragraphEnd = {row: i-1, column: this.getLine(i-1).length}; break; }
    if (!pragraphEnd) pragraphEnd = endPos;

    var start;
    for (var i = pragraphEnd.row - 1; i >= 0; i--)
      if (this.isLineEmpty(i)) { start = {row: i+1, column: 0}; break; }
    if (!start) start = {row: 0, column: 0};

    return {start, end: pragraphEnd};
  }

  astNodeRange(node) {
    // node is expected to be in mozilla AST format, ie {type, start: INDEX, end: INDEX}
    return {
      start: this.document.indexToPosition(node.start),
      end: this.document.indexToPosition(node.end)
    };
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // text undo / redo

  computeTextRangeForChanges(changes) {
    if (!changes.length) return Range.at(this.cursorPosition);

    var change = changes[0],
        range = change.selector === "insertText" ?
          insertRange(change.args[0], change.args[1]) :
          change.selector === "deleteText" ?
            Range.at(change.args[0].start) :
            Range.at(this.cursorPosition);

    for (var i = 1; i < changes.length; i++) {
      var change = changes[i];
      range = change.selector === "deleteText" ?
        range.without(change.args[0]) :
        change.selector === "insertText" ?
          range.merge(insertRange(change.args[0], change.args[1])) :
          range;
    }

    return range;

    function insertRange(text, pos) {
      var lines = TextDocument.parseIntoLines(text), range;

      if (lines.length === 1)
        return Range.fromPositions(
          pos, {row: pos.row, column: pos.column+lines[0].length});

      if (lines.length > 1)
        return Range.fromPositions(
          pos, {row: pos.row+lines.length-1, column: arr.last(lines).length});

      return Range.at(pos);
    }
  }

  ensureUndoManager() {
    if (this.undoManager) return this.undoManager;
    var filterFn = change => change.selector === "insertText" || change.selector === "deleteText";
    return this.undoManager = new UndoManager(filterFn);
  }

  textUndo() {
    var undo = this.undoManager.undo();
    if (!undo) return; // no undo left
    var changes = undo.changes.slice().reverse().map(ea => ea.undo);
    this.selection = this.computeTextRangeForChanges(changes);
  }

  textRedo() {
    var redo = this.undoManager.redo();
    if (!redo) return; // nothing to redo
    var changes = redo.changes.slice();
    this.selection = this.computeTextRangeForChanges(changes);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // search

  findMatchingForward(pos, side = "right", pairs = {}) {
    // searching for closing char, counting open and closing
    // side is the char we want to match "right" or "left" of pos?
    // pairs can be a JS object like {"[": "]", "<": ">"}
    var openChar = this[side === "right" ? "charRight" : "charLeft"](pos),
        closeChar = pairs[openChar];
    if (!closeChar) return null;

    var counter = side === "right" ? -1 : 0;
    return this.document.scanForward(pos, (char, pos) => {
      if (char === closeChar) {
        if (counter === 0) return side === "right" ? {row: pos.row, column: pos.column+1} : pos;
        else counter--;
      }
      else if (char === openChar) counter++;
      return null;
    });
  }

  findMatchingBackward(pos, side = "right", pairs = {}) {
    // see findMatchingForward
    var openChar = this[side === "right" ? "charRight" : "charLeft"](pos),
        closeChar = pairs[openChar];
    if (!closeChar) return null;

    var counter = side === "left" ? -1 : 0;
    return this.document.scanBackward(pos, (char, pos) => {
      if (char === closeChar) {
        if (counter === 0) return side === "right" ? {row: pos.row, column: pos.column+1} : pos;
        else counter--;
      }
      else if (char === openChar) counter++;
      return null;
    });
  }

  search(needle, options = {start: this.cursorPosition, backwards: false, caseSensitive: false}) {
    return new TextSearcher(this).search({needle, ...options});
  }

  searchForAll(needle, options = {caseSensitive: false}) {
    return new TextSearcher(this).searchForAll({needle, ...options});
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // editor support

  tokenAt(pos) { return this.pluginInvokeFirst("tokenAt", pos); }
  astAt(pos) { return this.pluginInvokeFirst("astAt", pos); }
  get evalEnvironment() {
    var p = this.pluginFind(p => p.isEditorPlugin);
    return p && p.evalEnvironment;
  }
  set evalEnvironment(env) {
    var p = this.pluginFind(p => p.isEditorPlugin);
    p && (p.evalEnvironment = env);
  }
  get doitContext() { var {context} = this.evalEnvironment || {}; return context; }
  set doitContext(c) { (this.evalEnvironment || {}).context = c; }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // controls
  openRichTextControl() {
    return RichTextControl.openDebouncedFor(this);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // serialization
  exportToJSON(options) {
    return Object.assign(super.exportToJSON(options), {
      textString: this.textString
    });
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // debugging

  inspect() {
    return `Text("${this.name}" <${this.selection}>)`
  }

}
