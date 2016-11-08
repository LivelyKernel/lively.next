import { Morph, Text, show, GridLayout, Button } from "./index.js"
import { Label } from "./text/label.js"
import { Icon } from "./icons.js"
import { pt, Color, Rectangle, rect } from "lively.graphics";
import { arr, fun, obj } from "lively.lang";
import { signal } from "lively.bindings";

function asItem(obj) {
  return obj && obj.isListItem ? obj : {
    isListItem: true, value: obj, string: String(obj)
  }
}

class ListItemMorph extends Label {

  constructor(props) {
    super({
      halosEnabled: false, autofit: false, fill: null,
      textString: "", itemIndex: undefined,
      selectionFontColor: Color.white,
      selectionColor: Color.blue,
      nonSelectionFontColor: Color.rgbHex("333"),
      fontColor: Color.rgbHex("333"),
      ...props
    });
  }

  get selectionFontColor() { return this.getProperty("selectionFontColor"); }
  set selectionFontColor(c) { this.addValueChange("selectionFontColor", c); }

  get nonSelectionFontColor() { return this.getProperty("nonSelectionFontColor"); }
  set nonSelectionFontColor(c) { this.addValueChange("nonSelectionFontColor", c); }

  get selectionColor() { return this.getProperty("selectionColor"); }
  set selectionColor(c) { this.addValueChange("selectionColor", c); }

  displayItem(item, itemIndex, itemHeight, pos, isSelected = false, props) {
    if (props.fontFamily) this.fontFamily = props.fontFamily;
    if (props.selectionColor) this.selectionColor = props.selectionColor;
    if (props.selectionFontColor) this.selectionFontColor = props.selectionFontColor;
    if (props.nonSelectionFontColor) this.nonSelectionFontColor = props.nonSelectionFontColor;
    if (props.fontSize) this.fontSize = props.fontSize;
    if (props.padding) this.padding = props.padding;

    this.itemIndex = itemIndex;
    this.textString = item.string || "no item.string";
    this.position = pos;
    this.extent = pt(this.owner.width, itemHeight);
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
      var content = arr.pluck(list.items, "string").join("\n"),
          title = "items of " + list.name;
      return list.world().execCommand("open text window", {title, content, name: title, fontFamily: "Inconsolata, monospace"});
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
      ...this.listStyle(props.theme),
      ...props
    });
    this.update();
  }

  listStyle(theme) {
    if (theme == "dark") {
      return {
        fill: Color.transparent,
        hideScrollbars: true,
        nonSelectionFontColor: Color.gray,
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
            selectionFontColor, nonSelectionFontColor
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

        itemMorph.displayItem(item, itemIndex, itemHeight,
          pt(padLeft, padTop+itemHeight*itemIndex),
          selectedIndexes.includes(itemIndex),
          {fontFamily, selectionColor, selectionFontColor, nonSelectionFontColor,
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
      {keys: "Escape|Ctrl-G",                command: "cancel"},
      {keys: "Alt-Space",                    command: "select via filter"},
      {keys: "Ctrl-L",                       command: "realign top-bottom-center"}
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
        padding = props.padding || Rectangle.inset(2,0),
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
          theme: props.theme
        });

    super({borderWidth: 1, fill: Color.transparent, borderColor: Color.gray, submorphs: [inputText, list]});

    props = obj.dissoc(props, ["fontFamily", "fontSize", "input"]);

    this.state = {allItems: null};

    if (!props.bounds && !props.extent) props.extent = pt(400, 360);

    Object.assign(this, {items: []}, props);

    connect(this.get("input"), "inputChanged", this, "updateFilter");
    connect(this.get("list"), "selection", this, "selectionChanged");
    this.layout = new GridLayout({grid: [["input"], ["list"]]})
    this.layout.row(0).fixed = 25;
    this.layout.row(0).paddingBottom = 5;
  }

  get isList() { return true; }

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


export class DropDownList extends Button {

  // new DropDownList({selection: 1, items: [1,2,3,4]}).openInWorld()

  constructor(props = {}) {
    super({
      borderRadius: 2,
      ...obj.dissoc(props, ["items", "selection"])
    });
    this.list = new List({items: props.items || [], border: this.border});
    connect(this, "fire", this, "toggleList");
    if (props.selection) this.selection = props.selection;
  }

  isListVisible() { return this.list.owner === this; }

  get items() { return this.list.items; }
  set items(value) { this.list.items = value; }
  get selection() { return this.getProperty("selection"); }
  set selection(value) {
    this.addValueChange("selection", value);
    if (!value) {
      this.list.selection = null;
      this.label = "";
    } else {
      var item = this.list.find(value);
      this.label = item ?
        [[item.string || String(item), {}], [" ", {}], Icon.textAttribute("caret-down")] :
        "selection not found in list";
      this.list.selection = value;
    }
  }

  toggleList() {
    var list = this.list;
    if (this.isListVisible()) {
      signal(this, "deactivated");
      this.selection = list.selection;
      list.remove();
    } else {
      signal(this, "activated");
      this.addMorph(list);
      list.topLeft = this.innerBounds().bottomLeft();
      list.extent = pt(this.width, 100);
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
          if (this.isListVisible()) this.list.remove();
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
