import { Morph, GridLayout, Text, StyleSheet, Label, Button, morph } from "lively.morphic";
import { pt, LinearGradient, Color, Rectangle, rect } from "lively.graphics";
import { arr, Path, string, obj } from "lively.lang";
import { signal, once } from "lively.bindings";
import { Icon } from "./icons.js"

function asItem(obj) {
  // make sure that object is of the form
  // {isListItem: true, string: STRING, value: OBJECT}
  if (obj && obj.isListItem && typeof obj.string === "string") return obj;
  if (!obj || !obj.isListItem) return {isListItem: true, string: String(obj), value: obj};
  var label = obj.string || obj.label || "no item.string";
  obj.string = !label || typeof label === "string" ? String(label) :
    Array.isArray(label) ?
      label.map((text, i) => i%2==0? String(text) : "").join("") :
      String(label);
  return obj;
}

class ListItemMorph extends Label {

  static get properties() {
    return {
      clipMode:              {defaultValue: "hidden"},
      autofit:               {defaultValue: false},
      fill:                  {defaultValue: null},
      itemIndex:             {defaultValue: undefined},
      selectionFontColor:    {defaultValue: Color.white},
      selectionColor:        {defaultValue: Color.blue},
      nonSelectionFontColor: {defaultValue: Color.rgbHex("333")},
      fontColor:             {defaultValue: Color.rgbHex("333")},
    }
  }

  displayItem(item, itemIndex, goalWidth, itemHeight, pos, isSelected = false, style) {
    let label = item.label || item.string || "no item.string";

    if (style) {
      let {
        fontFamily,
        selectionColor,
        selectionFontColor,
        nonSelectionFontColor,
        fontSize,
        padding
      } = style;
      if (selectionFontColor && this.selectionFontColor !== selectionFontColor)
        this.selectionFontColor = selectionFontColor;
      if (nonSelectionFontColor && this.nonSelectionFontColor !== nonSelectionFontColor)
        this.nonSelectionFontColor = nonSelectionFontColor;
      if (selectionColor && this.selectionColor !== selectionColor)
        this.selectionColor = selectionColor;
      if (fontSize && this.fontSize !== fontSize) this.fontSize = fontSize;
      if (fontFamily && this.fontFamily !== fontFamily) this.fontFamily = fontFamily;
      if (padding && !this.padding.equals(padding)) this.padding = padding;
    }
    if (item.annotation) this.valueAndAnnotation = {value: label, annotation: item.annotation};
    else if (typeof label === "string") this.textString = label;
    else this.value = label;

    this.tooltip = this.tooltip || this.textString;
    this.itemIndex = itemIndex;
    this.position = pos;

    {
      // if its wider, its wider...
      // this is more correct but slower:
      // this.extent = pt(Math.max(goalWidth, this.textBounds().width), itemHeight);
      // this is faster:
      this.extent = pt(goalWidth, itemHeight);
    }
    this.fill = isSelected ? this.selectionColor : null;
    this.fontColor = isSelected ? this.selectionFontColor : this.nonSelectionFontColor;
  }

  onMouseDown(evt) {
    this.owner.owner.onItemMorphClicked(evt, this);
  }
}

var listCommands = [
  {
    name: "page up",
    exec: (list) => {
      var index = list.selectedIndex,
          newIndex = Math.max(0, index - Math.round(list.height / list.itemHeight));
      list.gotoIndex(newIndex);
      return true;
    }
  },

  {
    name: "page down",
    exec: (list) => {
      var index = list.selectedIndex,
          newIndex = Math.min(list.items.length-1, index + Math.round(list.height / list.itemHeight))
      list.gotoIndex(newIndex);
      return true;
    }
  },

  {
    name: "goto first item",
    exec: (list) => { list.gotoIndex(0); return true; }
  },

  {
    name: "goto last item",
    exec: (list) => { list.gotoIndex(list.items.length-1); return true; }
  },

  {
    name: "arrow up",
    exec: (list) => { list.gotoIndex(list.indexUp()); return true; }
  },

  {
    name: "arrow down",
    exec: (list) => {
      list.gotoIndex(list.indexDown());
      return true;
    }
  },

  {
    name: "select up",
    exec: (list) => {
      var selected = list.selectedIndexes;
      if (!list.multiSelect || !selected.length)
        return list.execCommand("arrow up");

      var current = selected[0];
      if (typeof current !== "number") list.selectedIndexes = [current];
      else {
        var up = list.indexUp(current);
        if (selected.includes(current) && selected.includes(up)) {
          list.selectedIndexes = selected.filter(ea => ea !== current)
        } else {
          list.selectedIndexes = [up].concat(selected.filter(ea => ea !== up))
        }
      }
      return true;
    }
  },

  {
    name: "select down",
    exec: (list) => {
      var selected = list.selectedIndexes;
      if (!list.multiSelect || !selected.length)
        return list.execCommand("arrow down");

      var current = selected[0],
          down = list.indexDown(current);
      if (selected.includes(current) && selected.includes(down)) {
        list.selectedIndexes = selected.filter(ea => ea !== current)
      } else {
        list.selectedIndexes = [down].concat(selected.filter(ea => ea !== down))
      }
      return true;
    }
  },

  {
    name: "select all",
    exec: (list) => {
      list.selectedIndexes = arr.range(list.items.length-1, 0);
      list.scrollIndexIntoView(list.selectedIndexes[0]);
      return true;
    }
  },

  {
    name: "select via filter",
    exec: async (list) => {
      var preselect = list.selectedIndex || 0;
      var {selected} = await list.world().filterableListPrompt(
        "Select item", list.items,
        {preselect, requester: list.getWindow() || list, itemPadding: Rectangle.inset(0,2), multiSelect: true});
      if (selected.length) {
        if (list.multiSelect) list.selections = selected;
        else list.selection = selected[0];
        list.scrollSelectionIntoView();
        list.update();
      }
      return true;
    }
  },

  {
    name: "realign top-bottom-center",
    exec: list => {
      if (!list.selection) return;
      var {padding, selectedIndex: idx, itemHeight, scroll: {x: scrollX, y: scrollY}} = list,
          pos = pt(0, idx*itemHeight),
          offsetX = 0, offsetY = 0,
          h = list.height - itemHeight - padding.top() - padding.bottom();
      if (Math.abs(pos.y - scrollY) < 2) {
        scrollY = pos.y - h;
      } else if (Math.abs(pos.y - scrollY - h * 0.5) < 2) {
        scrollY = pos.y;
      } else {
        scrollY = pos.y - h * 0.5;
      }
      list.scroll = pt(scrollX, scrollY);
      return true;
    }
  },

  {
    name: "print contents in text window",
    exec: list => {
      var title = "items of " + list.name,
          content = list.items.map(item => {
            if (typeof item === "string") return item;
            var {string, label, annotation} = item,
                result = "";

            if (label) {
              if (typeof label === "string") result += label;
              else result += label.map((text, i) => i%2==0? text: "").join("")
            } else if (string) result += string;

            if (annotation) {
              result += " ";
              if (typeof annotation === "string") result += annotation;
              else result += annotation[0];
            }
            return result;
          }).join("\n");

      return list.world().execCommand("open text window",
        {title, content, name: title, fontFamily: "Inconsolata, monospace"});
    }
  }
];


export class List extends Morph {

  static get properties() {

    return {

      styleClasses:    {defaultValue: ['list']},
      fill:            {defaultValue: Color.white},
      clipMode:        {defaultValue: "auto"},
      
      selectionFontColor:    {defaultValue: Color.white},
      selectionColor:        {defaultValue: Color.blue},
      nonSelectionFontColor: {defaultValue: Color.rgbHex("333")},
      fontColor:             {defaultValue: Color.rgbHex("333")},

      theme: {
        isStyleProp: true,
        after: ["styleSheets"],
        set(val) {
          this.setProperty("theme", val);
          this.styleSheets = this.listStyle(val);
        }
      },

      extent: {
        set(value) {
          if (value.eqPt(this.extent)) return;
          this.setProperty("extent", value);
          this.update();
        }
      },

      fontFamily: {
        isStyleProp: true,
        defaultValue: "Helvetica Neue, Arial, sans-serif",
        set(value) {
          this.setProperty("fontFamily", value);
          this.invalidateCache();
        }
      },

      fontSize: {
        isStyleProp: true,
        defaultValue: 12,
        set(value) {
          this.setProperty("fontSize", value);
          this.invalidateCache();
        }
      },

      padding: {
        isStyleProp: true,
        defaultValue: Rectangle.inset(3)
      },

      itemPadding: {
        isStyleProp: true,
        defaultValue: Rectangle.inset(1),
        set(value) {
          this.setProperty("itemPadding", value);
          this.invalidateCache();
        }
      },

      items: {
        defaultValue: [], after: ["submorphs"],
        set(items) {
          this.setProperty("items", items.map(asItem));
          this.update();
        }
      },

      multiSelect: {
        defaultValue: false
      },

      values: {
        after: ["items"], readOnly: true,
        get() { return this.items.map(ea => ea.value); }
      },

      selectedIndex: {
        defaultValue: [], after: ["selectedIndexes"],
        get() { return this.selectedIndexes[0]; },
        set(i) { return this.selectedIndexes = typeof i === "number" ? [i] : []; }
      },

      selectedIndexes: {
        after: ["items"],
        get() { return this.getProperty("selectedIndexes") || []; },
        set(indexes) {
          var maxLength = this.items.length;
          this.setProperty(
            "selectedIndexes",
            (indexes || []).filter(i => 0 <= i && i < maxLength));
          this.update();
          signal(this, "selection", this.selection);
        }
      },

      selection: {
        after: ["selections"],
        get() { return this.selections[0]; },
        set(itemOrValue) { this.selections = [itemOrValue]; }
      },

      selections: {
        after: ["selectedIndexes"],
        get() { return this.selectedIndexes.map(i => this.items[i] && this.items[i].value); },
        set(sels) { this.selectedIndexes = sels.map(ea => this.findIndex(ea)); }
      },

      selectedItems: {
        after: ["selectedIndexes"], readOnly: true,
        get() { return this.selectedIndexes.map(i => this.items[i]); }
      },

      listItemContainer: {
        after: ["submorphs"], readOnly: true,
        get() {
          return this.getSubmorphNamed("listItemContainer") || this.addMorph({
            name: "listItemContainer", fill: null, clipMode: "visible", halosEnabled: false
          });
        }
      },

      itemMorphs: {
        after: ["submorphs"], readOnly: true,
        get() { return this.listItemContainer.submorphs; }
      },

      itemHeight: {
        after: ["fontFamily", "fontSize", "itemPadding"], readOnly: true,
        get() {
          if (this._itemHeight) return this._itemHeight;
          var h = this.env.fontMetric.defaultLineHeight(
            {fontFamily: this.fontFamily, fontSize: this.fontSize});
          var padding = this.itemPadding;
          if (padding) h += padding.top() + padding.bottom();
          return this._itemHeight = h;
        }
      }

    }
  }

  constructor(props = {}) {
    if (!props.bounds && !props.extent) props.extent = pt(400, 360);
    super(props);
    this.update();
  }

  listStyle(theme) {
    if (theme == "dark") {
      return new StyleSheet({
        list: {
          fill: Color.transparent,
          hideScrollbars: true,
          nonSelectionFontColor: Color.gray,
          selectionFontColor: Color.black,
          selectionColor: Color.gray.lighter(),
          padding: Rectangle.inset(2, 0)
        }
      });
    } else {
      return new StyleSheet({list: {padding: Rectangle.inset(2, 0)}});
    }
  }

  get isList() { return true; }

  onChange(change) {
    var {prop} = change;
    if (prop === "fontFamily"
     || prop === "fontSize"
     || prop === "padding"
     || prop === "itemPadding"
     || prop === "items") this.update();
    return super.onChange(change);
  }

  get connections() {
    return {selection: {signalOnAssignment: false}};
  }

  invalidateCache() {
    delete this._itemHeight;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // items

  find(itemOrValue) {
    return this.items.find(item => item === itemOrValue || item.value === itemOrValue);
  }

  findIndex(itemOrValue) {
    return this.items.findIndex(item => item === itemOrValue || item.value === itemOrValue);
  }

  addItem(item) { return this.addItemAt(item); }

  addItemAt(item, index = this.items.length) {
    var items = this.items,
        index = Math.min(items.length, Math.max(0, index));
    items.splice(index, 0, asItem(item));

    this.addMethodCallChangeDoing({
      target: this,
      selector: "addItemAt",
      args: [item, index],
      undo: {
        target: this,
        selector: "removeItem",
        args: [item],
      }
    }, () => this.update());

  }

  removeItem(itemOrValue) {
    var item = this.find(itemOrValue),
        items = this.items,
        index = items.indexOf(item)
    if (index === -1) return;

    items.splice(index, 1);

    this.addMethodCallChangeDoing({
      target: this,
      selector: "removeItem",
      args: [item],
      undo: {
        target: this,
        selector: "addItemAt",
        args: [item, index],
      }
    }, () => this.update());

  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // selection

  selectItemMorph(itemMorph) {
    this.selectedIndexes = [itemMorph.itemIndex];
  }

  gotoIndex(i) { this.scrollIndexIntoView(this.selectedIndex = i); }

  indexUp(from) {
    from = typeof from === "number" ? from : this.selectedIndex;
    // wrap around:
    return (from || this.items.length) - 1;
  }

  indexDown(index = this.selectedIndex) {
    index = typeof index === "number" ? index : -1
    return (index + 1) % this.items.length;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // rendering

  update() {
    var items = this.items;
    if (!items) return; // pre-initialize

    this.dontRecordChangesWhile(() => {
      var {
            itemHeight,
            itemMorphs, listItemContainer,
            selectedIndexes,
            scroll: {x: left, y: top},
            extent: {x: width, y: height},
            fontSize, fontFamily, fontColor,
            padding, itemPadding, selectionColor,
            selectionFontColor, nonSelectionFontColor
          } = this,
          additionalSpace = 2*height,
          padding = padding || Rectangle.inset(0),
          padTop = padding.top(), padLeft = padding.left(),
          padBottom = padding.bottom(), padRight = padding.right(),
          firstItemIndex = Math.max(0, Math.floor((top + padTop - additionalSpace) / itemHeight)),
          lastItemIndex = Math.min(items.length, Math.ceil((top + height + padTop + additionalSpace) / itemHeight)),
          maxWidth = 0,
          goalWidth = this.width - (padLeft + padRight);

      for (var i = 0; i < lastItemIndex-firstItemIndex; i++) {
        var itemIndex = firstItemIndex+i,
            item = items[itemIndex];

        if (!item) {
          // if no items to display, remove remaining itemMorphs
          itemMorphs.slice(i).forEach(itemMorph => itemMorph.remove());
          break;
        }

        let style = {
          fontFamily,
          selectionColor,
          selectionFontColor,
          nonSelectionFontColor,
          fontSize,
          padding: itemPadding
        }, itemMorph = itemMorphs[i];

        if (!itemMorph)
          itemMorph = itemMorphs[i] = listItemContainer.addMorph(new ListItemMorph(style));

        itemMorph.displayItem(
          item, itemIndex,
          goalWidth, itemHeight,
          pt(0, 0+itemHeight*itemIndex),
          selectedIndexes.includes(itemIndex),
          style);

        maxWidth = Math.max(maxWidth, itemMorph.width);
      }

      itemMorphs.slice(lastItemIndex-firstItemIndex).forEach(ea => ea.remove());

      listItemContainer.position = pt(padLeft, padTop);
      listItemContainer.extent = pt(
        maxWidth,
        Math.max(padTop + padBottom + itemHeight * items.length, this.height));
    });
  }

  scrollSelectionIntoView() {
    if (this.selection) this.scrollIndexIntoView(this.selectedIndex);
  }

  scrollIndexIntoView(idx) {
    var {itemHeight, width, scroll} = this,
        itemBounds = new Rectangle(0, idx*itemHeight, width, itemHeight),
        visibleBounds = this.innerBounds().insetByRect(this.padding).translatedBy(scroll),
        offsetX = 0, offsetY = 0
    if (itemBounds.bottom() > visibleBounds.bottom())
      offsetY = itemBounds.bottom() - visibleBounds.bottom()
    if (itemBounds.top() < visibleBounds.top())
      offsetY = itemBounds.top() - visibleBounds.top()
    this.scroll = scroll.addXY(offsetX, offsetY);
  }

  onScroll() { this.update(); }

  onItemMorphClicked(evt, itemMorph) {
    var itemI = itemMorph.itemIndex,
        {selectedIndexes} = this,
        isClickOnSelected = selectedIndexes.includes(itemI),
        indexes = [];

    if (this.multiSelect) {
      if (evt.isCommandKey()) {

        // deselect item
        if (isClickOnSelected) {
          indexes = selectedIndexes.filter(ea => ea != itemI);
        } else {
          // just add clicked item to selection list
          indexes = [itemI].concat(selectedIndexes.filter(ea => ea != itemI))
        }

      } else if (evt.isShiftDown()) {

        if (isClickOnSelected) {
          indexes = selectedIndexes.filter(ea => ea != itemI);
        } else {
          // select from last selected to clicked item
          var from = selectedIndexes[0],
              added = typeof from === "number" ? arr.range(itemI, from) : [itemI];
          indexes = added.concat(selectedIndexes.filter(ea => !added.includes(ea)))
        }

      } else indexes = [itemI];

    } else indexes = [itemI];

    this.selectedIndexes = indexes;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // event handling
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  get keybindings() {
    return [
      {keys: "Up|Ctrl-P",                    command: "arrow up"},
      {keys: "Down|Ctrl-N",                  command: "arrow down"},
      {keys: "Shift-Up",                     command: "select up"},
      {keys: "Shift-Down",                   command: "select down"},
      {keys: {win: "Ctrl-A", mac: "Meta-A"}, command: "select all"},
      {keys: "Alt-V|PageUp",                 command: "page up"},
      {keys: "Ctrl-V|PageDown",              command: "page down"},
      {keys: "Alt-Shift-,",                  command: "goto first item"},
      {keys: "Alt-Shift-.",                  command: "goto last item"},
      {keys: "Alt-Space",                    command: "select via filter"},
      {keys: "Ctrl-L",                       command: "realign top-bottom-center"}
    ].concat(super.keybindings);
  }

  get commands() { return listCommands; }

}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

import { connect } from "lively.bindings";

export class FilterableList extends Morph {

  static get properties() {

    return {

      fill: {defaultValue: Color.transparent},
      borderWidth: {defaultValue: 1},
      borderColor: {defaultValue: 1},
      updateSelectionsAfterFilter: {defaultValue: false},

      submorphs: {
        initialize() {
          let input = Text.makeInputLine({
              name: "input",
              highlightWhenFocused: false,
              fixedHeight: false,
              autofit: false
            });
          input.whenRendered().then(() => this.relayout());
          this.submorphs = [
            input,
            new morph({name: 'padding', fill: Color.transparent, height: 5}),
            new List({name: "list", items: [], clipMode: "auto"})
          ];
        }
      },

      paddingMorph: {
        derived: true, readOnly: true, after: ['submorphs'],
        get() { return this.getSubmorphNamed('padding') }
      },

      listMorph: {
        derived: true, readOnly: true, after: ["submorphs"],
        get() { return this.getSubmorphNamed("list"); },
      },

      inputMorph: {
        derived: true, readOnly: true, after: ["submorphs"],
        get() { return this.getSubmorphNamed("input"); },
      },

      theme: {
        isStyleProp: true,
        after: ["submorphs"],
        get() { return this.listMorph.theme; },
        set(val) {
          this.inputMorph.styleSheets = this.inputStyle(val);
          this.listMorph.theme = val;
        }
      },

      fontFamily: {
        isStyleProp: true,
        derived: true, after: ["submorphs"], defaultValue: "Helvetica Neue, Arial, sans-serif",
        get() { return this.listMorph.fontFamily; },
        set(val) {
          this.listMorph.fontFamily = val;
          this.inputMorph.fontFamily = val;
        }
      },

      padding: {
        isStyleProp: true,
        derived: true, after: ["submorphs"],
        defaultValue: Rectangle.inset(2,0),
        get() { return this.listMorph.padding; },
        set(val) {
          this.listMorph.padding = val;
          this.inputMorph.padding = val;
        }
      },

      fontSize: {
        isStyleProp: true,
        derived: true, after: ["submorphs"], defaultValue: 11,
        get() { return this.listMorph.fontSize; },
        set(val) {
          this.listMorph.fontSize = val;
          this.inputMorph.fontSize = val;
        }
      },

      itemPadding: {
        isStyleProp: true,
        derived: true, after: ["submorphs"],
        get() { return this.listMorph.itemPadding; },
        set(val) { this.listMorph.itemPadding = val; }
      },

      inputPadding: {
        isStyleProp: true,
        derived: true, after: ["submorphs", "padding"],
        defaultValue: Rectangle.inset(2),
        get() { return this.inputMorph.padding; },
        set(val) { this.inputMorph.padding = val; }
      },

      input: {
        derived: true, after: ["submorphs"], defaultValue: "",
        get() { return this.inputMorph.input; },
        set(val) { this.inputMorph.input = val; }
      },

      historyId: {
        derived: true, after: ["submorphs"], defaultValue: null,
        get() { return this.inputMorph.historyId; },
        set(val) { this.inputMorph.historyId = val; }
      },

      multiSelect: {
        derived: true, after: ["submorphs"],
        get() { return this.listMorph.multiSelect; },
        set(multiSelect) { this.listMorph.multiSelect = multiSelect; }
      },

      items: {
        after: ["submorphs", "fuzzy", "fuzzySortFunction", "fuzzyFilterFunction"],
        defaultValue: [],
        set(items) {
          this.setProperty("items", items.map(asItem));
          this.updateFilter();
        }
      },

      visibleItems: {
        derived: true, after: ["submorphs"],
        get visibleItems() { return this.listMorph.items; }
      },

      selection: {
        derived: true, after: ["submorphs"],
        get() { return this.listMorph.selection; },
        set(x) { this.listMorph.selection = x; }
      },

      selectedIndex: {
        derived: true, after: ["submorphs"],
        get() { return this.listMorph.selectedIndex; },
        set(x) { this.listMorph.selectedIndex = x; }
      },

      fuzzy: {
        derived: true, after: ["filterFunction", "sortFunction"],
        set(fuzzy) {
          // fuzzy => bool or prop;
          this.setProperty("fuzzy", fuzzy);
          if (!fuzzy) {
            if (this.sortFunction === this.fuzzySortFunction)
              this.sortFunction = null;
            if (this.filterFunction === this.fuzzyFilterFunction)
              this.filterFunction = this.defaultFilterFunction;
          } else  {
            if (!this.sortFunction) this.sortFunction = this.fuzzySortFunction
            if (this.filterFunction == this.defaultFilterFunction)
              this.filterFunction = this.fuzzyFilterFunction;
          }
        }
      },

      filterFunction: {
        get() {
          let filterFunction = this.getProperty("filterFunction");
          if (!filterFunction) return this.defaultFilterFunction;
          if (typeof filterFunction === "string")
            filterFunction = eval(`(${filterFunction})`);
          return filterFunction;
        }
      },

      sortFunction: {},

      defaultFilterFunction: {
        readOnly: true,
        get() {
          return this._defaultFilterFunction
              || (this._defaultFilterFunction = (parsedInput, item) =>
                    parsedInput.lowercasedTokens.every(token =>
                      item.string.toLowerCase().includes(token)));
        }
      },

      fuzzySortFunction: {
        get() {
          return this._fuzzySortFunction
              || (this._fuzzySortFunction = (parsedInput, item) => {
                var prop = typeof this.fuzzy === "string" ? this.fuzzy : "string";
                // preioritize those completions that are close to the input
                var fuzzyValue = String(Path(prop).get(item)).toLowerCase();
                var base = 0;
                parsedInput.lowercasedTokens.forEach(t => {
                  if (fuzzyValue.startsWith(t)) base -= 10;
                  else if (fuzzyValue.includes(t)) base -= 5;
                });
                return arr.sum(parsedInput.lowercasedTokens.map(token =>
                  string.levenshtein(fuzzyValue.toLowerCase(), token))) + base
              })
        }
      },

      fuzzyFilterFunction: {
        get() {
          return this._fuzzyFilterFunction
              || (this._fuzzyFilterFunction = (parsedInput, item) => {
            var prop = typeof this.fuzzy === "string" ? this.fuzzy : "string";
            var tokens = parsedInput.lowercasedTokens;
            if (tokens.every(token => item.string.toLowerCase().includes(token))) return true;
            // "fuzzy" match against item.string or another prop of item
            var fuzzyValue = String(Path(prop).get(item)).toLowerCase();
            return arr.sum(parsedInput.lowercasedTokens.map(token =>
                    string.levenshtein(fuzzyValue, token))) <= 3;
          });
        }
      },

      selectedAction: {
        get() { return this.getProperty("selectedAction") || "default"; }
      },

      actions: {}
    }

  }

  constructor(props = {}) {
    if (!props.bounds && !props.extent) props.extent = pt(400, 360);
    super(props);
    connect(this.inputMorph, "inputChanged", this, "updateFilter");
    connect(this.listMorph, "selection", this, "selectionChanged");
    this.updateFilter();
    connect(this, 'items', this, "relayout");
    connect(this, 'extent', this, "relayout");
    connect(this, "padding", this, "relayout");
    connect(this, "fontSize", this, "relayout");
    connect(this, "itemPadding", this, "relayout");
    connect(this, "inputPadding", this, "relayout");
  }

  resetConnections() {
    let cs = this.attributeConnections;
    if (!cs) return;
    let props = ["accepted", "canceled", "remove"];
    cs.filter(c => props.includes(c.sourceAttrName) && c.targetObj !== this)
      .forEach(c => c.disconnect());
  }

  get isList() { return true; }

  relayout() {
    let {listMorph, inputMorph, paddingMorph, borderWidth: offset} = this;
    inputMorph.topLeft = pt(offset, offset);
    inputMorph.width = listMorph.width = this.width - 2*offset;
    if (paddingMorph) {
      paddingMorph.topLeft = inputMorph.bottomLeft;
    }
    listMorph.topLeft = paddingMorph ? paddingMorph.bottomLeft : inputMorph.bottomLeft;
    listMorph.height = this.height -listMorph.top - offset;
  }

  inputStyle(theme) {
   if (theme == "dark") {
      return new StyleSheet({
        input: {
          borderWidth: 0,
          borderRadius: 20,
          fill: Color.gray.withA(0.8),
          fontColor: Color.gray.darker(),
          padding: rect(10,2)
        }
      })
    } else {
      return new StyleSheet({
        input: {
          borderWidth: 0,
          borderColor: Color.gray
        }
      })
    }
  }

  focus() { this.get("input").focus(); }

  selectionChanged(sel) { signal(this, "selection", sel); }

  scrollSelectionIntoView() { return this.listMorph.scrollSelectionIntoView(); }

  parseInput() {
    var filterText = this.get("input").textString,

        // parser that allows escapes
        parsed = Array.from(filterText).reduce(((state, char) => {
          // filterText = "foo bar\\ x"
          if (char === "\\" && !state.escaped) {
            state.escaped = true;
            return state;
          }

          if (char === " " && !state.escaped) {
            if (!state.spaceSeen && state.current) {
              state.tokens.push(state.current);
              state.current = "";
            }
            state.spaceSeen = true;
          } else {
            state.spaceSeen = false;
            state.current += char;
          }
          state.escaped = false;
          return state;
        }), {tokens: [], current: "", escaped: false, spaceSeen: false});
    parsed.current && parsed.tokens.push(parsed.current)
    var lowercasedTokens = parsed.tokens.map(ea => ea.toLowerCase());
    return {tokens: parsed.tokens, lowercasedTokens};
  }

  updateFilter() {
    var parsedInput = this.parseInput(),
        filterFunction = this.filterFunction,
        sortFunction = this.sortFunction,
        filteredItems = this.items.filter(item => filterFunction.call(this, parsedInput, item));

    if (sortFunction)
      filteredItems = arr.sortBy(filteredItems, ea => sortFunction.call(this, parsedInput, ea));

    var list = this.listMorph,
        newSelectedIndexes = this.updateSelectionsAfterFilter ?
          list.selectedIndexes.map(i => filteredItems.indexOf(list.items[i])).filter(i => i !== -1) :
          list.selectedIndexes;

    list.items = filteredItems;
    list.selectedIndexes = newSelectedIndexes.length ? newSelectedIndexes : filteredItems.length ? [0] : [];
    this.relayout();
    this.scrollSelectionIntoView();

    signal(this, "filterChanged", {parsedInput, items: list.items});
  }

  acceptInput() {
    var list = this.listMorph;
    this.get("input").acceptInput();
    var result = {
      filtered: this.items,
      selected: list.selections,
      action: this.selectedAction,
      status: "accepted",
    }
    signal(this, "accepted", result);
    return result;
  }

  get keybindings() {
    return [
      {keys: "Up|Ctrl-P",                    command: "arrow up"},
      {keys: "Down|Ctrl-N",                  command: "arrow down"},
      {keys: "Shift-Up",                     command: "select up"},
      {keys: "Shift-Down",                   command: "select down"},
      {keys: "Alt-V|PageUp",                 command: "page up"},
      {keys: "Ctrl-V|PageDown",              command: "page down"},
      {keys: "Alt-Shift-,",                  command: "goto first item"},
      {keys: "Alt-Shift-.",                  command: "goto last item"},
      {keys: "Enter",                        command: "accept input"},
      {keys: "Escape|Ctrl-G",                command: "cancel"},
      {keys: "Tab",                          command: "choose action"},
      ...arr.range(0, 8).map(n => {
        return {
          keys: "Alt-" + (n+1),
          command: {command: "choose action and accept input", args: {actionNo: n}}}
      })
    ].concat(super.keybindings);
  }

  get commands()  {
    return super.commands.concat([
      {
        name: "accept input",
        exec: (morph) => { this.acceptInput(); return true; }
      },

      {
        name: "cancel",
        exec: (morph) => {
          signal(morph, "canceled");
          return true;
        }
      },

      {
        name: "choose action and accept input",
        exec: (flist, args = {}) => {
          let {actionNo = 0} = args;
          flist.selectedAction = (flist.actions || [])[actionNo];
          return flist.execCommand("accept input");
        }
      },

      {
        name: "choose action",
        exec: async (morph) => {
          if (!morph.actions) return true;
        
          let similarStyle = {...morph.style, extent: morph.extent};
          if (similarStyle.theme === "dark")
            similarStyle.fill = Color.gray.darker();
          let chooser = new FilterableList(similarStyle);
          chooser.openInWorld(morph.globalPosition);
          chooser.items = morph.actions;
          let preselect = morph.actions.indexOf(morph.selectedAction);
          if (preselect === -1) preselect = 0;
          chooser.selectedIndex = preselect;
          connect(chooser, 'accepted', morph, 'selectedAction', {
            converter: function(result) {
              this.targetObj.focus();
              this.disconnect();
              this.sourceObj.remove();
              return result.selected[0]
            }
          });
          connect(chooser, 'canceled', morph, 'selectedAction', {
            converter: function(result) {                
              this.targetObj.focus();
              this.disconnect();
              this.sourceObj.remove();
              return this.targetObj.selectedAction
            }
          });
          chooser.focus();

          return true;
        }
      },

      ...listCommands.map(cmd =>
        ({...cmd, exec: (morph, opts, count) => cmd.exec(this.listMorph, opts, count)}))
    ]);
  }

}


export class DropDownList extends Button {

  // new DropDownList({selection: 1, items: [1,2,3,4]}).openInWorld()

  static get properties() {
    return {

      borderRadius: {defaultValue: 5},
      padding:      {defaultValue: Rectangle.inset(3,2)},

      listHeight: {defaultValue: 100},

      listMorph: {
        after: ["labelMorph"],
        get() {
          let list = this.getProperty("listMorph");
          if (list) return list;
          list = new List({
            name: "list",
            fontSize: this.fontSize,
            fontFamily: this.fontFamily,
            fontColor: this.fontColor,
            border: this.border
          });
          this.setProperty("listMorph", list);
          return list;
        }
      },

      label: {
        readOnly: true, after: ["submorphs"],
        get() { return this.getSubmorphNamed("label"); }
      },

      items: {
        derived: true, after: ["listMorph"],
        get() { return this.listMorph.items; },
        set(value) { this.listMorph.items = value; }
      },

      selection: {
        after: ["listMorph", 'items'],
        set(value) {
          this.setProperty("selection", value);
          if (!value) {
            this.listMorph.selection = null;
            this.label = "";
          } else {
            var item = this.listMorph.find(value);
            if (!item) return;
            let label = item.label || [item.string, null];
            this.label = [...label, " ", null, ...Icon.textAttribute("caret-down")];
            this.listMorph.selection = value;
          }
        }
      }

    }

  }

  constructor(props = {}) {
    super(props);
    this.activeStyle = {
        fill: new LinearGradient({stops: [
               {offset: 0, color: Color.white},
               {offset: 1, color: new Color.rgb(236,240,241)}
            ]})
    }
    connect(this, "fire", this, "toggleList");
  }

  isListVisible() { return this.listMorph.owner === this; }

  toggleList() {
    var list = this.listMorph;
    if (this.isListVisible()) {
      signal(this, "deactivated");
      this.selection = list.selection;
      list.remove();
    } else {
      signal(this, "activated");
      this.addMorph(list);
      once(list, 'onItemMorphClicked', this, 'toggleList');
      list.topLeft = this.innerBounds().bottomLeft();
      list.extent = pt(this.width, this.listHeight);
      list.focus();
    }
  }

  get commands() {
    return [
      {
        name: "accept",
        exec: () => {
          if (this.isListVisible()) this.toggleList();
          return true;
        }
      },

      {
        name: "cancel",
        exec: () => {
          if (this.isListVisible()) this.listMorph.remove();
          return true;
        }
      }
    ].concat(super.commands);
  }

  get keybindings() {
    return super.keybindings.concat([
      {keys: "Enter", command: "accept"},
      {keys: "Escape|Ctrl-G", command: "cancel"}
    ]);
  }

}