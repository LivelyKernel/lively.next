import { Morph, Text } from "./index.js"
import { pt, Color } from "lively.graphics";
import { arr } from "lively.lang";
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

  get fontFamily() { return this.getProperty("fontFamily"); }
  set fontFamily(value) { this.addValueChange("fontFamily", value); }

  get fontSize() { return this.getProperty("fontSize"); }
  set fontSize(value) { this.addValueChange("fontSize", value); }

  get items() { return this.getProperty("items"); }
  set items(items) {
    this.addValueChange("items", items.map(asItem));
    this.groupChangesWhile(undefined, () => this.update());
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

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // rendering

  get listItemContainer() {
    return this.getSubmorphNamed("listItemContainer") || this.addMorph({
      name: "listItemContainer", fill: null, clipMode: "visible"
    });
  }

  get itemMorphs() { return this.listItemContainer.submorphs; }

  update() {
    var itemHeight = this._itemHeight
                 || (this._itemHeight = this.env.fontMetric.sizeFor({fontFamily: this.fontFamily, fontSize: this.fontSize}, "X").height),
        {
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

  onScroll() {
    this.update();
  }

}
