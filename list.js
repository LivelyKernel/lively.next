import { Morph, Text } from "./index.js"
import { pt, Color, Rectangle } from "lively.graphics";
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
      fixedWidth: true, fixedHeight: false, readOnly: true, selectable: false,
      fill: null, textString: "", itemIndex: undefined, ...props
    });
  }

  displayItem(item, itemIndex, pos, isSelected = false) {
    this.itemIndex = itemIndex;
    this.textString = item.string || "no item.string";
    this.position = pos;
    this.width = this.owner.width;
    this.fill = isSelected ? Color.blue : null;
    this.fontColor = isSelected ? Color.white : Color.black;
  }

  onMouseDown(evt) {
    this.owner.owner.selectItemMorph(this);
  }
}

export class List extends Morph {

  constructor(props) {
    super({
      layoutPolicy: "vertical",
      fontFamily: "Helvetica Neue, Arial, sans-serif",
      fontSize: 12,
      items: [],
      selectedIndexes: [],
      clipMode: "auto",
      ...props
    });
    this.update();
  }

  get connections() {
    return {selection: {signalOnAssignment: false}};
  }

  // horizonal or vertical (tiling?)
  get layoutPolicy() { return this.getProperty("layoutPolicy"); }
  set layoutPolicy(value) { this.addValueChange("layoutPolicy", value); }

  get fontFamily() { this.invalidateCache(); return this.getProperty("fontFamily"); }
  set fontFamily(value) { this.addValueChange("fontFamily", value); }

  get fontSize() { this.invalidateCache(); return this.getProperty("fontSize"); }
  set fontSize(value) { this.addValueChange("fontSize", value); }

  get items() { return this.getProperty("items"); }
  set items(items) {
    this.addValueChange("items", items.map(asItem));
    this.groupChangesWhile(undefined, () => this.update());
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

  get selectedIndex() { return this.selectedIndexes[0]; }
  set selectedIndex(i) { return this.selectedIndexes = typeof i === "number" ? [i] : []; }
  get selectedIndexes() { return this.getProperty("selectedIndexes") || []; }
  set selectedIndexes(indexes) {
    var maxLength = this.items.length;
    this.addValueChange(
      "selectedIndexes",
      (indexes || []).filter(i => 0 <= i && i < maxLength));
    this.groupChangesWhile(undefined, () => this.update());
    signal(this, "selection", this.selection);
  }

  get selection() { return this.selections[0]; }
  set selection(itemOrValue) { this.selections = [itemOrValue]; }

  get selections() { return this.selectedIndexes.map(i => this.items[i].value); }
  set selections(sels) { this.selectedIndexes = sels.map(ea => this.findIndex(ea)); }

  get selectedItems() { return this.selectedIndexes.map(i => this.items[i]); }

  selectItemMorph(itemMorph) {
    this.selectedIndexes = [itemMorph.itemIndex];
  }

  gotoIndex(i) {
    this.scrollIndexIntoView(this.selectedIndex = i);
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
    return this._itemHeight
       || (this._itemHeight = this.env.fontMetric.sizeFor({fontFamily: this.fontFamily, fontSize: this.fontSize}, "X").height);
  }

  update() {
    var {
          itemHeight,
          items, itemMorphs, listItemContainer,
          selectedIndexes,
          scroll: {x: left, y: top},
          extent: {x: width, y: height},
          fontSize, fontFamily
        } = this,
        firstItemIndex = Math.floor(top / itemHeight),
        lastItemIndex = Math.ceil((top+height) / itemHeight);

    listItemContainer.extent = pt(this.width, itemHeight*items.length);

    for (var i = 0; i < lastItemIndex-firstItemIndex; i++) {
      var itemIndex = firstItemIndex+i,
          item = items[itemIndex];

      if (!item) {
        // if no items to display, remove remaining itemMorphs
        itemMorphs.slice(i).forEach(itemMorph => itemMorph.remove());
        break;
      }

      var itemMorph = itemMorphs[i] || (itemMorphs[i] = listItemContainer.addMorph(new ListItemMorph({fontFamily, fontSize})));

      itemMorph.displayItem(item, itemIndex,
        pt(0, itemHeight*(itemIndex)),
        selectedIndexes.includes(itemIndex));
    }

    itemMorphs.slice(lastItemIndex-firstItemIndex).forEach(ea => ea.remove());
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

}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

import { connect } from "lively.bindings";
import FontMetric from "./rendering/font-metric.js";

export class FilterableList extends Morph {

  constructor(props = {}) {
    super({borderWidth: 1, borderColor: Color.gray});

    var fontFamily = props.fontFamily || "Arial",
        fontSize = props.fontSize || 11,
        input = props.input || "",
        inputText = Text.makeInputLine({
          name: "input",
          textString: input,
          fill: null,
          borderWidth: 1, borderColor: Color.gray,
          padding: Rectangle.inset(2),
          fontSize, fontFamily
        }),
        list = new List({
          name: "list", items: [],
          fill: null,
          clipMode: "auto",
          fontSize, fontFamily
        })

    props = obj.dissoc(props, ["fontFamily", "fontSize", "input"]);

    this.submorphs = [inputText, list];
    this.state = {allItems: null}
    Object.assign(this, {
      items: [],
      extent: props.bounds ? props.bounds.extent() : pt(400, 360),
      ...props
    });

    this.relayout();

    connect(this.get("input"), "inputChanged", this, "updateFilter");
    
    this.addKeyBindings([
      {keys: "Down|Ctrl-N", command: "arrow down"},
      {keys: "Up|Ctrl-P", command: "arrow up"},
      {keys: "Ctrl-V|PageDown", command: "page down"},
      {keys: "Alt-V|PageUp", command: "page up"},
      {keys: "Alt-Shift-,", command: "goto first item"},
      {keys: "Alt-Shift-.", command: "goto last item"},
      {keys: "Enter", command: "accept input"},
      {keys: "Escape|Ctrl-G", command: "cancel"}
    ]);
  }

  onChange(change) {
    // if (change.prop === "extent") this.relayout();
    return super.onChange(change);
  }

  relayout() {
    var i = this.get("input"),
        l = this.get("list"),
        inputHeight = i.env.fontMetric.sizeFor(i.fontFamily, i.fontSize, "X").height + 2*2,
        ext = this.extent;
    i.setBounds(new Rectangle(0,0, this.width, inputHeight));
    l.setBounds(new Rectangle(0, inputHeight, ext.x, ext.y-inputHeight));
  }

  set items(items) {
    var l = this.get("list");
    l.items = items;
    this.state.allItems = l.items;
    this.updateFilter();
  }

  get selection() { return this.get("list").selection; }
  set selection(x) { this.get("list").selection = x; }
  get selectedIndex() { return this.get("list").selectedIndex; }
  set selectedIndex(x) { this.get("list").selectedIndex = x; }

  updateFilter() {
    var filterText = this.get("input").textString,
        filterTokens = filterText.split(/\s+/).map(ea => ea.toLowerCase()),
        filteredItems = this.state.allItems.filter(item => filterTokens.every(token => item.string.toLowerCase().includes(token)));
    this.get("list").items = filteredItems;
  }

  get commands()  {
    var list = this.get("list");
    return super.commands.concat([
      {
        name: "accept input",
        exec: (morph) => {
          signal(morph, "accepted", list.selection);
          return true;
        }
      },

      {
        name: "cancel",
        exec: (morph) => {
          signal(morph, "canceled");
          return true;
        }
      },

      {
        name: "page up",
        exec: (morph) => {
          var index = list.selectedIndex,
              newIndex = Math.max(0, index - Math.round(list.height / list.itemHeight));
          list.gotoIndex(newIndex);
          return true;
        }
      },
    
      {
        name: "page down",
        exec: (morph) => {
          var index = list.selectedIndex,
              newIndex = Math.min(list.items.length-1, index + Math.round(list.height / list.itemHeight))
          list.gotoIndex(newIndex);
          return true;
        }
      },
    
      {
        name: "goto first item",
        exec: (morph) => { list.gotoIndex(0); return true; }
      },
      
      {
        name: "goto last item",
        exec: (morph) => { list.gotoIndex(list.items.length-1); return true; }
      },
      
      {
        name: "arrow up",
        exec: (morph) => { list.gotoIndex((list.selectedIndex || list.items.length) - 1); return true; }
      },
      
      {
        name: "arrow down",
        exec: (morph) => {
          var index = list.selectedIndex,
              newIndex = ((typeof index === "number" ? index : -1) + 1) % list.items.length;
          list.gotoIndex(newIndex);
          return true;
        }
      }
    ])
  }

}
