import { Morph, Text } from "./index.js"
import { pt, Color } from "lively.graphics";
import { arr } from "lively.lang";

function asItem(obj) {
  return obj && obj.isListItem ? obj : {
    isListItem: true, value: obj, string: String(obj)
  }
}

class ListItemMorph extends Text {

  constructor(props) {
    super({
      fixedWidth: true, fixedHeight: false, readOnly: true,
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

    this.addMethodCallChangeDoing(
      this,          /*receiver*/
      "addItemAt",   /*selector*/
      [item, index], /*args*/
      "items",       /*prop*/
      items,        /*value*/
      () => this.update());
  }

  removeItem(itemOrValue) {
    var item = this.find(itemOrValue),
        items = this.items,
        index = items.indexOf(item)
    if (index === -1) return;

    items.splice(index, 1);

    this.addMethodCallChangeDoing(
      this,         /*receiver*/
      "removeItem", /*selector*/
      [item],       /*args*/
      "items",      /*prop*/
      items,        /*value*/
      () => this.update());
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
                 || (this._itemHeight = this.env.fontMetric.sizeFor(this.fontFamily, this.fontSize, "X").height),
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

// console.log(`[list] itemHeight: ${itemHeight} lastItemIndex: ${lastItemIndex}-firstItemIndex: ${firstItemIndex}`)

    for (var i = 0; i < lastItemIndex-firstItemIndex; i++) {
      var itemIndex = firstItemIndex+i,
          item = items[itemIndex];

      if (!item) {
        // if no items to display, remove remaining itemMorphs
        itemMorphs.slice(i).forEach(itemMorph => itemMorph.remove());
        break;
      }

      var itemMorph = itemMorphs[i] || (itemMorphs[i] = console.log(`[list] creating itemMorph for ${item.string}`) || listItemContainer.addMorph(new ListItemMorph({fontFamily, fontSize})));

      itemMorph.displayItem(item, itemIndex,
        pt(0, itemHeight*(itemIndex)),
        selectedIndexes.includes(itemIndex));
    }

// console.log(`[list] deleting ${itemMorphs.length-(lastItemIndex-firstItemIndex)} items`);

    itemMorphs.slice(lastItemIndex-firstItemIndex).forEach(ea => ea.remove());

    // if (this.layoutPolicy == "horizontal") {
    //   var maxHeight = 0,
    //       pos = pt(0, 0);

    //   this.items.forEach(item => {
    //     this.addMorph(item);
    //     item.position = pos;
    //     pos = item.topRight;
    //     maxHeight = Math.max(item.height, maxHeight);
    //   });

    //   this.extent = pt(pos.x, maxHeight);

    //   return;
    // }

    // if (this.layoutPolicy == "vertical") {
    //   var maxWidth = 0,
    //       pos = pt(0, 0);

    //   this.items.forEach(item => {
    //     this.addMorph(item);
    //     item.position = pos;
    //     pos = item.bottomLeft;
    //     maxWidth = Math.max(item.width, maxWidth);
    //   });

    //   this.extent = pt(maxWidth, pos.y);

    //   return;
    // }

    // throw new Error("Unsupported Layout " + this.layoutPolicy);
  }

  onScroll() {
    this.update();
  }

}
