import { Morph, Text, show } from "./index.js"
import { pt, Color, Rectangle, rect } from "lively.graphics";
import { arr, fun, obj } from "lively.lang";
import { signal } from "lively.bindings";

function asItem(obj) {
  return obj && obj.isListItem ? obj : {
    isListItem: true, value: obj, string: String(obj)
  }
}

class ListItemMorph extends Text {

  constructor(props) {
    super({
      lineWrapping: false,
      halosEnabled: false, readOnly: true, selectable: false,
      fixedWidth: true, fixedHeight: false, fill: null,
      textString: "", itemIndex: undefined,
      ...props
    });
  }

  get selectionFontColor() { return this._selectionFontColor || Color.white }
  set selectionFontColor(c) { this._selectionFontColor = c; }

  get selectionColor() { return this._selectionColor || Color.blue }
  set selectionColor(c) { this._selectionColor = c; }

  get inactiveFonctColor() { return this._inactiveFontColor || Color.black }
  set inactiveFontColor(c) { this._inactiveFontColor = c; }

  displayItem(item, itemIndex, pos, isSelected = false, props) {
    if (props) Object.assign(this, props);
    this.itemIndex = itemIndex;
    this.textString = item.string || "no item.string";
    this.position = pos;
    this.width = this.owner.width;
    this.fill = isSelected ? this.selectionColor : null;
    this.fontColor = isSelected ? this.selectionFontColor : this.fontColor;
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
  }
];


export class List extends Morph {

  constructor(props = {}) {
    if (!props.bounds && !props.extent) props.extent = pt(400, 360);
    super({
      fill: Color.white,
      fontFamily: "Helvetica Neue, Arial, sans-serif",
      fontSize: 12,
      items: [],
      selectedIndexes: [],
      clipMode: "auto",
      padding: props.padding || Rectangle.inset(3),
      itemPadding: props.itemPadding || Rectangle.inset(1),
      multiSelect: false,
      ...props
    });
    this.update();
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

  get extent() { return this.getProperty("extent"); }
  set extent(value) {
    if (value.eqPt(this.extent)) return;
    this.addValueChange("extent", value);
    this.update();
  }

  get fontFamily() { return this.getProperty("fontFamily"); }
  set fontFamily(value) {
    this.addValueChange("fontFamily", value);
    this.invalidateCache();
  }

  get fontSize() { return this.getProperty("fontSize"); }
  set fontSize(value) {
    this.addValueChange("fontSize", value);
    this.invalidateCache();
  }

  get padding() { return this.getProperty("padding"); }
  set padding(value) {
    this.addValueChange("padding", value);
  }

  get itemPadding() { return this.getProperty("itemPadding"); }
  set itemPadding(value) {
    this.addValueChange("itemPadding", value);
    this.invalidateCache();
  }

  get items() { return this.getProperty("items"); }
  set items(items) {
    this.addValueChange("items", items.map(asItem));
  }

  get multiSelect() { return this.getProperty("multiSelect"); }
  set multiSelect(bool) { this.addValueChange("multiSelect", bool); }

  get values() { return this.items.map(ea => ea.value); }

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

  get selectedIndex() { return this.selectedIndexes[0]; }
  set selectedIndex(i) { return this.selectedIndexes = typeof i === "number" ? [i] : []; }
  get selectedIndexes() { return this.getProperty("selectedIndexes") || []; }
  set selectedIndexes(indexes) {
    var maxLength = this.items.length;
    this.addValueChange(
      "selectedIndexes",
      (indexes || []).filter(i => 0 <= i && i < maxLength));
    this.update()
    signal(this, "selection", this.selection);
  }

  get selection() { return this.selections[0]; }
  set selection(itemOrValue) { this.selections = [itemOrValue]; }

  get selections() { return this.selectedIndexes.map(i => this.items[i] && this.items[i].value); }
  set selections(sels) { this.selectedIndexes = sels.map(ea => this.findIndex(ea)); }

  get selectedItems() { return this.selectedIndexes.map(i => this.items[i]); }

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

  get listItemContainer() {
    return this.getSubmorphNamed("listItemContainer") || this.addMorph({
      name: "listItemContainer", fill: null, clipMode: "visible"
    });
  }

  get itemMorphs() { return this.listItemContainer.submorphs; }

  get itemHeight() {
    if (this._itemHeight) return this._itemHeight;
    var h = this.env.fontMetric.defaultLineHeight({fontFamily: this.fontFamily, fontSize: this.fontSize});
    var padding = this.itemPadding;
    if (padding) h += padding.top() + padding.bottom();
    return this._itemHeight = h;
  }

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
            selectionFontColor
          } = this,
          padding = padding || Rectangle.inset(0),
          padTop = padding.top(), padLeft = padding.left(),
          padBottom = padding.bottom(), padRight = padding.right(),
          firstItemIndex = Math.floor((top + padTop) / itemHeight),
          lastItemIndex = Math.ceil((top + height + padTop) / itemHeight);

      listItemContainer.extent = pt(this.width + padLeft + padRight, Math.max(padTop + padBottom + itemHeight*items.length, this.height));

      for (var i = 0; i < lastItemIndex-firstItemIndex; i++) {
        var itemIndex = firstItemIndex+i,
            item = items[itemIndex];

        if (!item) {
          // if no items to display, remove remaining itemMorphs
          itemMorphs.slice(i).forEach(itemMorph => itemMorph.remove());
          break;
        }

        var itemMorph = itemMorphs[i]
                    || (itemMorphs[i] = listItemContainer.addMorph(
                          new ListItemMorph({fontFamily, fontSize})));

        itemMorph.displayItem(item, itemIndex,
          pt(padLeft, padTop+itemHeight*itemIndex),
          selectedIndexes.includes(itemIndex),
          {fontFamily, fontColor, selectionColor, selectionFontColor,
           fontSize, padding: itemPadding || Rectangle.inset(0)});
      }

      itemMorphs.slice(lastItemIndex-firstItemIndex).forEach(ea => ea.remove());
    });
  }

  scrollSelectionIntoView() {
    if (this.selection) this.scrollIndexIntoView(this.selectedIndex);
  }

  scrollIndexIntoView(idx) {
    var {itemHeight, width, scroll} = this,
        itemBounds = new Rectangle(0, idx*itemHeight, width, itemHeight),
        visibleBounds = this.innerBounds().translatedBy(scroll),
        offsetX = 0, offsetY = 0
    if (itemBounds.bottom() > visibleBounds.bottom())
      offsetY = itemBounds.bottom() - visibleBounds.bottom()
    if (itemBounds.top() < visibleBounds.top())
      offsetY = itemBounds.top() - visibleBounds.top()
    this.scroll = scroll.addXY(offsetX, offsetY);
  }

  onScroll() {
    fun.debounceNamed(this.id + "scroll", 81, () => this.update(), true)();
  }

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

      } else {
        indexes = [itemI];
      }
    } else indexes = [itemI];
    this.selectedIndexes = indexes;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // event handling
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  get keybindings() {
    return [
      {keys: "Up|Ctrl-P", command: "arrow up"},
      {keys: "Down|Ctrl-N", command: "arrow down"},
      {keys: "Shift-Up", command: "select up"},
      {keys: "Shift-Down", command: "select down"},
      {keys: {win: "Ctrl-A", mac: "Meta-A"}, command: "select all"},
      {keys: "Alt-V|PageUp", command: "page up"},
      {keys: "Ctrl-V|PageDown", command: "page down"},
      {keys: "Alt-Shift-,", command: "goto first item"},
      {keys: "Alt-Shift-.", command: "goto last item"},
      {keys: "Enter", command: "accept input"},
      {keys: "Escape|Ctrl-G", command: "cancel"},
      {keys: "Alt-Space", command: "select via filter"},
    ].concat(super.keybindings);
  }

  get commands() {
    return listCommands;
  }

}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

import { connect } from "lively.bindings";

export class FilterableList extends Morph {

  constructor(props = {}) {
    var fontFamily = props.fontFamily || "Helvetica Neue, Arial, sans-serif",
        padding = props.padding,
        itemPadding = props.itemPadding,
        fontSize = props.fontSize || 11,
        input = props.input || "",
        historyId = props.historyId || null,
        inputText = Text.makeInputLine({
          name: "input",
          textString: input,
          fontSize, fontFamily,
          historyId,
          ...this.inputStyle(props.theme)
        }),
        list = new List({
          name: "list", items: [],
          clipMode: "auto",
          fontSize, fontFamily,
          padding, itemPadding,
          borderWidth: props.borderWidth,
          borderColor: props.borderColor,
          ...this.listStyle(props.theme),
        });

    super({borderWidth: 1, fill: Color.transparent, borderColor: Color.gray, submorphs: [inputText, list]});

    props = obj.dissoc(props, ["fontFamily", "fontSize", "input"]);

    this.state = {allItems: null};

    if (!props.bounds && !props.extent) props.extent = pt(400, 360);

    Object.assign(this, {items: []}, props);


    this.relayout();

    connect(this.get("input"), "inputChanged", this, "updateFilter");
    connect(this.get("list"), "selection", this, "selectionChanged");
    connect(this, "extent", this, "relayout");
  }

  get isList() { return true; }

  listStyle(theme) {
    if (theme == "dark") {
      return {
        fill: Color.transparent,
        hideScrollbars: true,
        fontColor: Color.gray,
        selectionFontColor: Color.black,
        selectionColor: Color.gray.lighter(),
        padding: Rectangle.inset(2, 0)
      }
     } else {
        return {
          padding: Rectangle.inset(2, 0)
        }
     }
  }

  inputStyle(theme) {
     if (theme == "dark") {
        return {
          borderWidth: 0,
          borderRadius: 20,
          fill: Color.gray.withA(0.8),
          fontColor: Color.gray.darker(),
          padding: rect(10,2,0,-2)
        }
      } else {
        return {
          borderWidth: 1,
          borderColor: Color.gray,
          padding: Rectangle.inset(2)
        }
      }
  }

  focus() { this.get("input").focus(); }

  relayout() {
    var i = this.get("input"),
        l = this.get("list"),
        ext = this.extent;
    i.width = l.width = this.width;
    l.top = i.bottom;
    l.height = this.height - i.height;
  }

  get multiSelect() { return this.get("list").multiSelect; }
  set multiSelect(multiSelect) { this.get("list").multiSelect = multiSelect; }

  get items() { return this.state.allItems || []; }
  set items(items) {
    var l = this.get("list");
    this.state.allItems = items.map(asItem);
    this.updateFilter();
  }
  get visibleItems() { return this.get("list").items; }

  get selection() { return this.get("list").selection; }
  set selection(x) { this.get("list").selection = x; }
  get selectedIndex() { return this.get("list").selectedIndex; }
  set selectedIndex(x) { this.get("list").selectedIndex = x; }

  selectionChanged(sel) { signal(this, "selection", sel); }

  scrollSelectionIntoView() { return this.get("list").scrollSelectionIntoView(); }

  updateFilter() {
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
        }), {tokens: [], current: "", escaped: false, spaceSeen: false}),
        _ = parsed.current && parsed.tokens.push(parsed.current),
        filterTokens = parsed.tokens.map(ea => ea.toLowerCase()),

        filteredItems = this.state.allItems.filter(item => filterTokens.every(token => item.string.toLowerCase().includes(token))),
        list = this.get("list"),
        newSelectedIndexes = list.selectedIndexes.map(i => filteredItems.indexOf(list.items[i])).filter(i => i !== -1)
    list.items = filteredItems;
    list.selectedIndexes = newSelectedIndexes.length ? newSelectedIndexes : filteredItems.length ? [0] : [];
    this.scrollSelectionIntoView();
  }

  acceptInput() {
    var list = this.get("list");
    if (list.selectedIndex in list.items)
      this.get("input").addInputToHistory(list.items[list.selectedIndex].string);
    var result = {
      filtered: this.state.allItems,
      selected: list.selections,
      status: "accepted"
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
      {keys: {win: "Ctrl-A", mac: "Meta-A"}, command: "select all"},
      {keys: "Alt-V|PageUp",                 command: "page up"},
      {keys: "Ctrl-V|PageDown",              command: "page down"},
      {keys: "Alt-Shift-,",                  command: "goto first item"},
      {keys: "Alt-Shift-.",                  command: "goto last item"},
      {keys: "Enter",                        command: "accept input"},
      {keys: "Escape|Ctrl-G",                command: "cancel"}
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

      ...listCommands.map(cmd =>
        ({...cmd, exec: (morph, opts, count) => cmd.exec(this.get("list"), opts, count)}))
    ]);
  }

}
