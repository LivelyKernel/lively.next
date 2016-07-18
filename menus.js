import { Morph } from "./morph.js";
import { Text } from "./text.js";
import { pt, Color } from "lively.graphics";

export class Menu extends Morph {

  constructor(props) {
    super(Object.assign({items: [], title: null, borderWidth: 1, borderColor: Color.gray}, props));
    this.updateMorphs();
  }

  get title() { return this.getProperty("title") }
  set title(value) {
    this.recordChange({prop: "title", value});
    this.updateMorphs();
  }

  get items() { return this.getProperty("items") }
  set items(value) {
    this.recordChange({prop: "items", value});
    this.updateMorphs();
  }

  updateMorphs() {
    this.submorphs = [];
    var maxWidth = 0, pos = pt(0,0);
    
    if (this.title) {
      var title = this.addMorph(Text.makeLabel(this.title, {fontSize: 20, draggable: false, borderWidth: 0}));
      pos = title.bottomLeft;
      maxWidth = Math.max(title.width, maxWidth);
    }

    this.items.forEach(item => {
      var itemMorph = this.addMorph(Text.makeLabel(item[0], {
        position: pos,
        onMouseUp: item[1],
        fontSize: 14,
        draggable: false,
        borderWidth: 0
      }))
      pos = itemMorph.bottomLeft;
      maxWidth = Math.max(itemMorph.width, maxWidth);
    });

    this.submorphs.forEach(ea => {
      ea.fixedWidth = true;
      ea.fixedHeight = true;
      ea.width = maxWidth;
    });

    this.extent = pt(maxWidth, pos.y);
  }
}