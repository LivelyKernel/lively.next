import { arr } from "lively.lang";
import { pt, Color } from "lively.graphics";
import { Morph } from "./morph.js";

export class ObjectDrawer extends Morph {

  constructor(props) {
    super(Object.assign({
      name: "object-drawer",
      position: pt(20, 20),
      extent: pt(3 * (120 + 10) + 15, 130),
      fill: Color.white,
      borderWidth: 1,
      borderColor: Color.gray
    }, props));
    this.setup();
  }

  setup() {
    var n = 3,
        margin = pt(5,5),
        objExt = pt(((this.width - margin.x) / n) - margin.x, this.height - margin.y*2),
        pos = margin;

    this.addMorph({
      type: "ellipse",
      position: pos, extent: objExt,
      fill: Color.random(), grabbable: false,
      onDrag: doCopy
    });

    pos = arr.last(this.submorphs).topRight.addXY(margin.x, 0);

    this.addMorph({
      position: pos, extent: objExt,
      fill: Color.random(), grabbable: false,
      onDrag: doCopy
    });

    pos = arr.last(this.submorphs).topRight.addXY(margin.x, 0);

    this.addMorph({
      type: "image",
      position: pos, extent: objExt,
      fill: null, grabbable: false,
      onDrag: doCopy
    });

    function doCopy(evt) {
      evt.stop();
      evt.hand.grab(Object.assign(this.copy(), {
        fill: this.isImage ? null : Color.random(),
        grabbable: false,
        position: evt.positionIn(this).negated()
      }), evt);
    }

  }
}