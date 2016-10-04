import { Window, GridLayout, FillLayout, Ellipse, Text,
         VerticalLayout, HorizontalLayout, Morph, morph } from "../index.js";
import { Rectangle, Color, LinearGradient, pt } from "lively.graphics";
import { obj, num } from "lively.lang";
import { signal, connect } from "lively.bindings";

const WHEEL_URL = 'https://www.sessions.edu/wp-content/themes/divi-child/color-calculator/wheel-5-ryb.png'

/* TODO: All of the color harmonies as well as the hsv based color storing should
         be moved into lively.graphics */

class ColorHarmony {

   constructor(colorPicker) { this.colorPicker = colorPicker }

   offsets() { return null }

   stepCount() { return 0 }

   stepSize() { return 0; }

   get name() { return "Color Harmony"}

   chord() {
      const {hue, saturation, brightness} = this.colorPicker, 
             offsets = this.offsets() || arr.range(0, this.steps()).map(i => i * this.stepSize());       
      return offsets.map(offset => Color.hsb(hue + offset % 360, saturation, brightness));
   }

}

class Complementary extends ColorHarmony {

    get name() { return "Complementary" }
    steps() { return 1 }
    stepSize() { return 180 }

}

class Triadic extends ColorHarmony {

   get name() { return "Triadic" }
   steps() { return 2 }
   stepSize() { return 120 } 
   
}

class Tetradic extends ColorHarmony {

   get name() { return "Tetradic" }
   offsets() { return [0, 60, 180, 240] } 

}

class Quadratic extends ColorHarmony {

   get name() { return "Quadratic" }
   steps() { return 3 }
   stepSize() { return 90 }

}

class Analogous extends ColorHarmony {

   get name() { return "Analogous" }
   steps() { return 5 }
   stepSize() { return 30 }

}

class Neutral extends ColorHarmony {

   get name() { return "Neutral" }
   steps() { return 5 }
   stepSize() { return 15 }

}

export class ColorPicker extends Window {

  constructor(props) {
    this.color = props.color || Color.blue;
    this.harmony = new Complementary(this);
    super({
      ...props,
      title: "Color Picker",
      name: "Color Picker",
      targetMorph: this.colorPalette()
    });
    this.update();
    connect(this, "change", this, "update", {
      updater: ($upd, {prop}) => ["extent"].includes(prop) && $upd()
    });
  }

  set color(c) {
    const [h, s, b] = c.toHSB();
    this.hue = h;
    this.saturation = s;
    this.brightness = b;
    signal(this, "color", c); 
  }

  get color() {
    return Color.hsb(this.hue, this.saturation, this.brightness);
  }

  get pickerPosition() {
    // translate the hsv of color to a position
    const s = this.saturation, b = this.brightness;
    return pt(this.getSubmorphNamed("hue").width * s,
              this.getSubmorphNamed("hue").height * (1 - b))
  }

  set pickerPosition({x: light, y: dark}) {
    // translate the pos to a new hsv value
    var {width, height} = this.getSubmorphNamed("hue");
    this.saturation = Math.max(0, Math.min(light / width, 1));
    this.brightness = Math.max(0, Math.min(1 - (dark / height), 1));
    this.update();
  }

  get scalePosition() {
    return pt(this.getSubmorphNamed("scale").width / 2, this.getSubmorphNamed("hueGradient").height * (this.hue / 360));
  }

  set scalePosition(pos) {
    console.log(pos.y / this.getSubmorphNamed("hueGradient").height)
    this.hue = Math.max(0, Math.min((pos.y / this.getSubmorphNamed("hueGradient").height) * 360, 359));
    this.update();
  }

  update() {
     [this.getSubmorphNamed("field"),
      this.getSubmorphNamed("colorViewer"),
      this.getSubmorphNamed("picker"),
      this.getSubmorphNamed("slider"),
      //this.getSubmorphNamed("harmonies"),
      this.getSubmorphNamed("hashViewer"),
      this.getSubmorphNamed("hsbViewer"),
      this.getSubmorphNamed("rgbViewer"),
     ].forEach(p => p && p.update(this));
     // would be better if this.color is the canonical place
     this.color = this.get("colorViewer").fill;
  }

  colorPalette() {
    const colorPalette = this.getSubmorphNamed("colorPalette") || new Morph({
      name: "colorPalette",
      fill: Color.transparent,
      layout: new GridLayout({grid: [["field", "scale", "details"]
                                     //["harmonies", "harmonies", "harmonies"]
                                     ]}),
      submorphs: [this.fieldPicker(), this.scalePicker(), this.colorDetails()]
    })
    colorPalette.layout.col(1).fixed = 55;
    colorPalette.layout.col(2).fixed = 100;
    return colorPalette;
  }

  fieldPicker() {
    return this.getSubmorphNamed("field") || new Morph({
      layout: new FillLayout({morphs: ["hue", "shade", "light"], spacing: 9}),
      name: "field",
      fill: Color.transparent,
      update(colorPicker) {
        this.getSubmorphNamed("hue").fill = Color.hsb(colorPicker.hue, 1, 1);
      },
      submorphs: [{
        borderRadius: 3,
        name: "hue"
      },{
        borderRadius: 3,
        name: "shade",
        fill: new LinearGradient([{color: Color.white, offset: "0%"},
                                  {color: Color.transparent, offset: "100%"}],
                                  "eastwest")
      },{
        borderRadius: 3,
        name: "light",
        fill: new LinearGradient([{color: Color.black, offset: "0%"},
                                  {color: Color.transparent, offset: "100%"}],
                                  "southnorth"),
        onMouseDown: (evt) => {
          this.pickerPosition = evt.positionIn(this.getSubmorphNamed("light"));
        },
        onDrag: (evt) => {
          this.pickerPosition = this.pickerPosition.addPt(evt.state.dragDelta)
        },
        submorphs: [{
          name: "picker",
          type: "ellipse",
          draggable: false,
          fill: Color.transparent,
          borderColor: Color.black,
          borderWidth: 3,
          extent: pt(18,18),
          update(colorPicker) {
            this.center = colorPicker.pickerPosition;
          },
          submorphs: [{
            type: "ellipse",
            fill: Color.transparent,
            borderColor: Color.white,
            onDrag: (evt) => {
              this.pickerPosition = this.pickerPosition.addPt(evt.state.dragDelta)
            },
            borderWidth: 3,
            center: pt(8,8),
            extent: pt(12,12)
          }]
      }]
     }]
    });
  }

  scalePicker() {
    return this.getSubmorphNamed("scale") || new Morph({
      layout: new FillLayout({morphs: ["hueGradient"], spacing: 9}),
      name: "scale",
      fill: Color.transparent,
      submorphs: [{
        name: "hueGradient",
        borderRadius: 3,
        fill: new LinearGradient([
          {color: Color.rgb(255,0,0), offset: "0%"},
          {color: Color.rgb(255,255,0), offset: "17%"},
          {color: Color.limeGreen, offset: "33%"},
          {color: Color.cyan, offset: "50%"},
          {color: Color.blue, offset: "66%"},
          {color: Color.magenta, offset: "83%"},
          {color: Color.rgb(255,0,0), offset: "100%"}],
         "northsouth"),
        onMouseDown: (evt) => {
          this.scalePosition = pt(0, evt.positionIn(this.getSubmorphNamed("hueGradient")).y);
        },
        onDrag: (evt) => {
          this.scalePosition = this.scalePosition.addPt(pt(0, evt.state.dragDelta.y));
        }
      },{
        name: "slider",
        height: 10,
        width: 50,
        borderRadius: 3,
        nativeCursor: "ns-resize",
        borderColor: Color.black,
        fill: Color.transparent,
        borderWidth: 2,
        update(colorPicker) {
          this.center = colorPicker.scalePosition.addPt(pt(0,10));
        },
        onDrag: (evt) => {
          this.scalePosition = this.scalePosition.addPt(pt(0, evt.state.dragDelta.y));
        }
      }]
    });
  }

  keyValue({name, key, value, update}) {
    return new Morph({
      update,
      name: name || key,
      fill: Color.transparent,
      layout: new HorizontalLayout({spacing: 5}),
      setValue(value) {
        this.submorphs[1].textString = obj.safeToString(value);
      },
      submorphs: [
        new Text({
          fill: Color.transparent,
          textString: key,
          fontColor: Color.darkgray,
          fontWeight: "bold"}),
        new Text({
          fill: Color.transparent,
          textString: obj.safeToString(value)})]
    })
  }

  hashViewer() {
    return this.getSubmorphNamed("hashViewer") || this.keyValue({
      name: "hashViewer",
      key: "#",
      update(colorPicker) {
        this.setValue(colorPicker.color.toHexString());
      },
      value: this.color.toHexString()})
  }

  rgbViewer() {
    const [r, g, b] = this.color.toTuple8Bit();
    return this.getSubmorphNamed("rgbViewer") || new Morph({
      name: "rgbViewer",
      layout: new VerticalLayout(),
      fill: Color.transparent,
      update(colorPicker) {
        const [r, g, b] = colorPicker.color.toTuple8Bit(),
              [rv, gv, bv] = this.submorphs;
        rv.setValue(r.toFixed()); gv.setValue(g.toFixed()); bv.setValue(b.toFixed());
      },
      submorphs: [this.keyValue({key: "R", value: r.toFixed()}),
                  this.keyValue({key: "G", value: g.toFixed()}),
                  this.keyValue({key: "B", value: b.toFixed()})]
    })
  }

  hsbViewer() {
    const [h, s, b] = this.color.toHSB();
    return this.getSubmorphNamed("hsbViewer") || new Morph({
      name: "hsbViewer",
      layout: new VerticalLayout(),
      fill: Color.transparent,
      update(colorPicker) {
        const [h, s, b] = colorPicker.color.toHSB(),
              [hm, sm, bm] = this.submorphs;
        hm.setValue(h.toFixed()); sm.setValue(s.toFixed(2)); bm.setValue(b.toFixed(2));
      },
      submorphs: [this.keyValue({key: "H", value: h.toFixed()}),
                  this.keyValue({key: "S", value: s.toFixed(2)}),
                  this.keyValue({key: "B", value: b.toFixed(2)})]
    })
  }

  colorDetails() {
    return this.getSubmorphNamed("details") || new Morph({
      name: "details",
      width: 80,
      fill: Color.transparent,
      layout: new VerticalLayout({spacing: 9}),
      submorphs: [{
        type: "ellipse",
        extent: pt(50,50),
        name: "colorViewer",
        fill: this.color,
        update(colorPicker) { this.fill = colorPicker.color; }
      },
      this.hashViewer(),
      this.rgbViewer(),
      this.hsbViewer()]
    })
  }

  harmonies() {
    return this.getSubmorphNamed("harmonies") || new Morph({
      name: "harmonies",
      update(colorPicker) {

      }
    })
  }

}