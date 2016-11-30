import { obj, num, arr } from "lively.lang";
import { pt, Color, Rectangle } from "lively.graphics";
import { Morph, Button, List, Text, GridLayout } from "./index.js";
import { Icon } from "./icons.js";
import { signal, connect } from "lively.bindings";
import { Tooltip } from "./tooltips.js";
import config from "./config.js";

export class ValueScrubber extends Text {

  constructor(props) {
      super({
        fill: Color.transparent, draggable: true,
        textString: obj.safeToString(this.scrubbedValue),
        min: -Infinity,
        max: Infinity,
        ...obj.dissoc(props, ["value"])
      });

      this.value = props.value || 0;
  }

  onDragStart(evt) {
     this.execCommand("toggle active mark");
     this.initPos = evt.position;
     this.factorLabel = new Tooltip({
          position: evt.hand.position.addXY(10,10),
          description: "1x"}).openInWorld();
  }

  onKeyDown(evt) {
    super.onKeyDown(evt);
    if ("Enter" == evt.keyCombo) {
      const [v, unit] = this.textString.split(" ");
      if (v) {
         this.value = parseFloat(v);
         signal(this, "scrub", this.scrubbedValue);
      }
      evt.stop();
    }
  }

  onDrag(evt) {
      // x delta is the offset to the original value
      // y is the scale
      const {x, y} = evt.position.subPt(this.initPos),
            scaleFactor = num.roundTo(Math.exp(-y / this.world().height * 4), 0.01),
            v = this.getCurrentValue(x, scaleFactor);
      signal(this, "scrub", v);
      this.textString = obj.safeToString(v);
      if (this.unit) this.textString += " " + this.unit;
      this.factorLabel.description = scaleFactor + "x";
      this.factorLabel.position = evt.hand.position.addXY(10,10);
  }

  getCurrentValue(delta, s) {
      const v = this.scrubbedValue + Math.round(delta * s);
      return Math.max(this.min, Math.min(this.max, v));
  }

  onDragEnd(evt) {
      const {x, y} = this.initPos.subPt(evt.position),
            scaleFactor = num.roundTo(Math.exp(-y / this.world().height * 4), 0.01);
      this.scrubbedValue = this.getCurrentValue(x, scaleFactor);
      this.factorLabel.softRemove();
  }

  set value(v) {
      v = Math.max(this.min, Math.min(this.max, v));
      this.scrubbedValue = v;
      this.textString = obj.safeToString(v) || "";
      if (this.unit) this.textString += " " + this.unit;
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

export class ModeSelector extends Morph {

   constructor(props) {
     var {items, init, tooltips = {}} = props, keys, values;
     if (obj.isArray(items)) {
         keys = values = items;
     } else {
         keys = obj.keys(items);
         values = obj.values(items);
     }
     super({
         keys, values, tooltips,
         morphClasses: ['root'],
         layout: new GridLayout({
             grid: [[null, ...arr.interpose(keys.map(k => k + "Label"), null), null]],
             autoAssign: false, fitToCell: false, 
         }),
         ...props
      })
      this.build();
      this.update(init ? init : keys[0], 
                   values[keys.includes(init) ? keys.indexOf(init) : 0]);
      connect(this, "extent", this, "relayout");
    }

    build() {
       this.submorphs = [
            {name: "typeMarker"},
            ...this.createLabels(this.keys, this.values, this.tooltips)
         ]
       this.applyStyler();
    }

    applyStyler() {
       this.withAllSubmorphsDo(m => {
         var styleProps;
         if (styleProps = this.styler[m.name]) {
            Object.assign(m, styleProps);
         } else if (m.morphClasses) {
            styleProps = obj.merge(arr.compact(m.morphClasses.map(c => this.styler[c])));
            Object.assign(m, styleProps);
         }
      })
    }

    get styler() {
       return {
          root: {fill: Color.transparent, 
                 height: 30, origin: pt(0,5)},
          typeMarker: {fill: Color.gray.darker(), borderRadius: 3},
          label: {fontWeight: 'bold', nativeCursor: "pointer", padding: 4}
       }
    }

    createLabels(keys, values, tooltips = {}) {
       return arr.zip(keys, values)
                 .map(([name, value]) => {
                   const tooltip = tooltips[name];
                   return {
                      name: name + "Label", morphClasses: ['label'],
                      type: "label", value: name, 
                      ...tooltip && {tooltip},
                      onMouseDown: () => {
                         this.update(name, value);
                }}});
    }

    async relayout() { 
        return this.currentLabel && this.get("typeMarker").animate({bounds: this.currentLabel.bounds(), duration: 200}); 
    }
    
    async update(label, value) {
       const newLabel = this.get(label + "Label"), duration = 200;
       if (newLabel == this.currentLabel) return;
       this.currentLabel && this.currentLabel.animate({fontColor: Color.black, duration});
       this.currentLabel = newLabel;
       newLabel.animate({fontColor: Color.white, duration});
       await this.relayout();
       signal(this, label, value)
       signal(this, "switchLabel", value);
    }
}
