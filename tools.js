import { arr, obj, promise } from "lively.lang";
import { pt, Color, Rectangle } from "lively.graphics";
import { morph, Morph, Window, show } from "./index.js";
import { FilterableList } from "./list.js";
import { GridLayout } from "lively.morphic/layout.js";
import CodeEditor from "./ide/code-editor.js";

export class ObjectDrawer extends Morph {

  constructor(props) {
    super({
      name: "object-drawer",
      position: pt(20, 20),
      extent: pt(4 * (140 + 10) + 15, 140),
      fill: Color.white,
      borderWidth: 1,
      borderColor: Color.gray,
      ...props
    });
    this.setup();
  }

  setup() {
    var n = 4,
        margin = pt(5,5),
        objExt = pt(((this.width - margin.x) / n) - margin.x, this.height - margin.y*2),
        pos = margin;

    this.addMorph({
      type: "ellipse",
      position: pos, extent: objExt,
      fill: Color.random(), grabbable: false,
      onDrag: doCopy,
      init() { this.fill = Color.random(); }
    });

    pos = arr.last(this.submorphs).topRight.addXY(margin.x, 0);

    this.addMorph({
      position: pos, extent: objExt,
      fill: Color.random(), grabbable: false,
      onDrag: doCopy,
      init() { this.fill = Color.random(); }
    });

    pos = arr.last(this.submorphs).topRight.addXY(margin.x, 0);

    this.addMorph({
      type: "image",
      position: pos, extent: objExt,
      fill: null, grabbable: false,
      onDrag: doCopy
    });

    pos = arr.last(this.submorphs).topRight.addXY(margin.x, 0);

    this.addMorph({
      type: "text",
      textString: "Lively rocks!",
      position: pos, extent: objExt,
      fill: Color.white, grabbable: false,
      readOnly: true,
      fontSize: 16,
      onDrag: doCopy,
      draggable: true,
      init() {
        this.draggable = false;
        this.grabbable = false;
        this.readOnly = false;
      }
    });

    function doCopy(evt) {
      evt.stop();
      var copy = Object.assign(this.copy(), {position: evt.positionIn(this).negated()});
      var name = copy.constructor.name.toLowerCase();
      name = (name[0].match(/[aeiou]/) ? "an " : "a ") + name;
      var i = 1; while (this.world().get(name + " " + i)) i++
      copy.name = name + " " + i;
      evt.hand.grab(copy);
      delete copy.onDrag;
      copy.init && copy.init();
    }
  }
}

export class Workspace extends Window {

  constructor(props = {}) {
    super({
      title: "Workspace",
      targetMorph: {
        type: CodeEditor,
        textString: props.content || "var i = 2 + 3",
        mode: "javascript"
      },
      extent: pt(400,300),
      ...obj.dissoc(props, ["content"])
    });
  }

}
