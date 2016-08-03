import { Morph } from "./index.js"
import { pt } from "lively.graphics";
import { arr } from "lively.lang";

export class List extends Morph {

  constructor(props) {
    super({
      layoutPolicy: "vertical",
      items: [],
      ...props
    });
    this.applyLayout();
  }

  // horizonal or vertical (tiling?)
  get layoutPolicy() { return this.getProperty("layoutPolicy"); }
  set layoutPolicy(value) { this.recordValueChange("layoutPolicy", value); }

  get items() { return this.getProperty("items"); }
  set items(value) { this.recordValueChange("items", value); }

  addItemAt(item, index) {
    var items = this.items;
    var index = Math.min(items.length, Math.max(0, index));
    items.splice(index, 0, item);

    this.recordMethodCallChange(
      this,          /*receiver*/
      "addItemAt",   /*selector*/
      [item, index], /*args*/
      "items",       /*prop*/
      items          /*value*/);

    this.applyLayout();
  }

  removeItem(item) {
    var items = this.items,
        index = items.indexOf(item)
    if (index > -1) items.splice(index, 1);

    this.recordMethodCallChange(
      this,         /*receiver*/
      "removeItem", /*selector*/
      [item],       /*args*/
      "items",      /*prop*/
      items         /*value*/);

    this.applyLayout();
  }

  applyLayout() {
    this.submorphs = [];
    if (this.layoutPolicy == "horizontal" ) {
      var maxHeight = 0,
          pos = pt(0, 0);

      this.items.forEach(item => {
        this.addMorph(item);
        item.position = pos;
        pos = item.topRight;
        maxHeight = Math.max(item.height, maxHeight);
      });

      this.extent = pt(pos.x, maxHeight);
    } else if (this.layoutPolicy == "vertical") {
      var maxWidth = 0,
          pos = pt(0, 0);

      this.items.forEach(item => {
        this.addMorph(item);
        item.position = pos;
        pos = item.bottomLeft;
        maxWidth = Math.max(item.width, maxWidth);
      });

      this.extent = pt(maxWidth, pos.y);
    } else {
      throw new Error("Unsupported Layout " + this.layoutPolicy);
    }
  }

}
