import { arr, obj, promise } from "lively.lang";
import { pt, Color, Rectangle } from "lively.graphics";
import { morph, Morph, Window, show } from "./index.js";
import { FilterableList } from "./list.js";
import { GridLayout } from "lively.morphic/layout.js";
import { JavaScriptEditorPlugin } from "./ide/js/editor-plugin.js";
import { RichTextControl } from "lively.morphic/text/ui.js"
import { connect } from "lively.bindings"
import config from "./config.js"

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
      border: {color: Color.gray, width: 1, radius: 3},
      padding: Rectangle.inset(8),
      readOnly: true,
      fontSize: 20,
      fontFamily: "Helvetica Neue, Arial, sans-serif",
      onDrag: doCopy,
      draggable: true,
      init() {
        this.draggable = false;
        this.grabbable = false;
        this.readOnly = false;
        connect(this, "selectionChange", RichTextControl, "openDebouncedFor", {converter: sel => sel.textMorph})
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
        type: "text",
        textString: props.content || "var i = 2 + 3",
        ...config.codeEditor.defaultStyle,
        plugins: [new JavaScriptEditorPlugin()]
      },
      extent: pt(400,300),
      ...obj.dissoc(props, ["content"])
    });
    this.targetMorph.__defineGetter__("evalEnvironment", function () {
      return {
        targetModule: "lively://lively.next-workspace/" + this.id,
        context: this.doitContext || this.owner.doitContext || this
      }
    })
  }

}
