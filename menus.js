import { Morph } from "./morph.js";
import { Text } from "./text.js";
import { pt, Color } from "lively.graphics";

export class Menu extends Morph {

  constructor(props) {
    super({
      items: [],
      title: null,
      padding: 3,
      borderWidth: 1,
      borderColor: Color.gray,
      ...props
    });
    this.updateMorphs();
  }

  get title() { return this.getProperty("title") }
  set title(value) { this.recordChange({prop: "title", value}); }

  get items() { return this.getProperty("items") }
  set items(value) { this.recordChange({prop: "items", value}); }

  get padding() { return this.getProperty("padding") }
  set padding(value) { this.recordChange({prop: "padding", value}); }

  updateMorphs() {
    this.submorphs = [];
    var p = this.padding;
    var maxWidth = 0, pos = pt(p, p);
    
    if (this.title) {
      var title = this.addMorph(Text.makeLabel(this.title, {position: pos, fontSize: 14, draggable: false}));
      pos = title.bottomLeft;
      maxWidth = Math.max(title.width, maxWidth);
    }

    this.items.forEach(item => {
      var itemMorph = this.addMorph(Text.makeLabel(item[0], {
        textString: item[0],
        position: pos,
        onMouseDown: item[1],
        fontSize: 12,
        draggable: false
      }))
      pos = itemMorph.bottomLeft;
      maxWidth = Math.max(itemMorph.width, maxWidth);
    });

    this.submorphs.forEach(ea => {
      ea.fit();
      ea.fixedWidth = true;
      ea.fixedHeight = true;
      ea.width = maxWidth;
    });

    this.extent = pt(maxWidth + 2*p, pos.y + p);
  }
}