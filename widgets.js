import { obj, num } from "lively.lang";
import { pt, Color, Rectangle } from "lively.graphics";
import { Morph, Button, List, Text } from "./index.js";
import { Icon } from "./icons.js";
import { Tooltip } from "./tooltips.js";
import { signal, connect } from "lively.bindings";
import config from "./config.js";

export class ValueScrubber extends Text {

  constructor(props) {
      this.scrubbedValue = props.value || 0;
      super({
        fill: Color.transparent, draggable: true,
        textString: this.scrubbedValue.toString(),
        ...props
      });
  }

  onDragStart(evt) {
     this.execCommand("toggle active mark");
     this.initPos = evt.position;
     this.factorLabel = new Tooltip({
          position: evt.hand.position.addXY(10,10),
          description: "1x"}).openInWorld();
  }

  onDrag(evt) {
      // x delta is the offset to the original value
      // y is the scale
      const {x, y} = evt.position.subPt(this.initPos),
            scaleFactor = num.roundTo(Math.exp(-y / this.world().height * 4), 0.01);
            
      signal(this, "scrub", this.scrubbedValue + Math.round(x * scaleFactor));
      this.textString = (this.scrubbedValue + Math.round(x * scaleFactor)).toString();
      this.factorLabel.description = scaleFactor + "x";
      this.factorLabel.position = evt.hand.position.addXY(10,10);
  }

  onDragEnd(evt) {
      const {x, y} = this.initPos.subPt(evt.position),
            scaleFactor = num.roundTo(Math.exp(-y / this.world().height * 4), 0.01);
      this.scrubbedValue += Math.round(x * scaleFactor);
      this.factorLabel.softRemove();
  }

}

export class CheckBox extends Morph {

  constructor(props) {
    super({
      draggable: false,
      extent: pt(18, 18),
      borderWidth: 0,
      active: true,
      checked: false,
      fill: Color.transparent,
      ...props,
    });
  }

  get checked() { return this.getProperty("checked"); }
  set checked(value) { this.addValueChange("checked", value); }
  get active() { return this.getProperty("active"); }
  set active(value) { this.addValueChange("active", value); }

  trigger() {
    try {
      this.checked = !this.checked;
      signal(this, "toggle", this.checked);
    } catch (err) {
      var w = this.world();
      if (w) w.logError(err);
      else console.error(err);
    }
  }

  onMouseDown(evt) {
    if (this.active) this.trigger();
  }

  render(renderer) {
    return renderer.renderCheckBox(this);
  }

}
