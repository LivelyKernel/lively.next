import { pt, Color } from "lively.graphics";
import { Morph } from "./morph.js";

export class ObjectDrawer extends Morph {

  constructor() {
    super({
      name: "object-drawer",
      position: pt(20, 20),
      extent: pt(3 * (120 + 10) + 15, 130),
      fill: Color.white,
      borderWidth: 1,
      borderColor: Color.gray
    });
    this.setup();
  }

  setup() {
    var pos = pt(5,5);

    this.addMorph({
      type: "ellipse",
      position: pos, extent: pt(118,118),
      fill: Color.random(), grabbable: false,
      onDrag: doCopy
    });

    pos = pos.addXY(140, 0);

    this.addMorph({
      position: pos, extent: pt(118,118),
      fill: Color.random(), grabbable: false,
      onDrag: doCopy
    });

    pos = pos.addXY(140, 0);

    this.addMorph({
      type: "image",
      position: pos, extent: pt(118,118),
      fill: null, grabbable: false,
      onDrag: doCopy
    });

    function doCopy(evt) {
      evt.stop();
      evt.hand.grab(Object.assign(this.copy(), {
        fill: this.isImage ? null : Color.random(),
        grabbable: true,
        position: evt.positionIn(this).negated()
      }), evt);
    }

  }
}