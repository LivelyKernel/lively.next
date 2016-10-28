import { Window, GridLayout, FillLayout, Ellipse, Text,
         VerticalLayout, HorizontalLayout, Image, 
         TilingLayout, Morph, morph, Menu } from "../index.js";
import { Rectangle, Color, LinearGradient, pt, Point } from "lively.graphics";
import { obj, num, arr } from "lively.lang";
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
      title: "Color Picker",
      name: "Color Picker",
      extent: pt(400, 300),
      fill: Color.black.withA(.7),
      borderWidth: 0,
      resizable: false,
      targetMorph: this.colorPalette(),
      commands: this.harmonyCommands,
      ...props
    });
    this.titleLabel().fontColor = Color.gray;
    this.update();
    connect(this, "change", this, "update", {
      updater: ($upd, {prop}) => ["extent"].includes(prop) && $upd()
    });
  }

  onMouseDown(evt) {
     if (this.harmonyMenu) this.harmonyMenu.remove();
  }

  get harmony() { return this._harmony }
  set harmony(h) { 
      const harmonyLabel = this.getSubmorphNamed("harmonyLabel");
      if (harmonyLabel) harmonyLabel.textString = h.name;
      this._harmony = h;
   }

  get harmonyCommands() {
    return [Complementary, Triadic, Tetradic, Quadratic,  Analogous, Neutral].map(harmony => {
       return {name: harmony.name,
               exec: colorPicker => { 
                    colorPicker.harmony = new harmony(colorPicker);
                    colorPicker.harmonyMenu.remove(); 
                    colorPicker.update();
                  }
               }
       });
  }

  set color(c) {
    const [h, s, b] = c.toHSB();
    this.hue = h
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
    this.hue = Math.max(0, Math.min((pos.y / this.getSubmorphNamed("hueGradient").height) * 360, 359));
    this.update();
  }

  update() {
     [this.getSubmorphNamed("field"),
      this.getSubmorphNamed("colorViewer"),
      this.getSubmorphNamed("picker"),
      this.getSubmorphNamed("slider"),
      this.getSubmorphNamed("harmonies"),
      this.getSubmorphNamed("hashViewer"),
      this.getSubmorphNamed("hsbViewer"),
      this.getSubmorphNamed("rgbViewer"),
     ].forEach(p => p && p.update(this));
     // would be better if this.color is the canonical place
     // rms: as long as lively.graphics/color loses the hue information
     //      when lightness or saturation drop to 0, this.color can not serve
     //      as the canonical place but only as a getter for the morph that retrieves
     //      the picker's color.
     signal(this, "color", this.color); 
  }

  colorPalette() {
    const colorPalette = this.getSubmorphNamed("colorPalette") || new Morph({
      name: "colorPalette",
      fill: Color.transparent,
      draggable: false,
      layout: new GridLayout({grid: [["field", "scale", "details"],
                                     ["toggleHarmonies", "toggleHarmonies", "toggleHarmonies"],
                                     ["harmonies", "harmonies", "harmonies"]]}),
      submorphs: [this.fieldPicker(), this.scalePicker(), this.colorDetails(),
                  this.toggleHarmoniesButton(),
                  this.harmonies()]
    })
    colorPalette.layout.col(0).paddingLeft = 10;
    colorPalette.layout.col(1).fixed = 55;
    colorPalette.layout.col(2).fixed = 100;
    colorPalette.layout.row(0).fixed = this.colorDetails().height;
    colorPalette.layout.row(1).fixed = 20;
    return colorPalette;
  }

  fieldPicker() {
    return this.getSubmorphNamed("field") || new Morph({
      layout: new FillLayout({morphs: ["hue", "shade", "light"], spacing: {top: 10, bottom: 10}}),
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
          fontColor: Color.gray,
          fontWeight: "bold"}),
        new Text({
          fill: Color.transparent,
          fontColor: Color.gray.lighter(),
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

  colorField(color) {
     const picker = this;
     return new Morph({
         extent: pt(80, 80),
         layout: new VerticalLayout(),
         fill: Color.transparent,
         setColor(c) {
            const [colorView, hashView] = this.submorphs;
            colorView.fill = c;
            hashView.textString = c.toHexString(); 
         },
         submorphs: [
            new Morph({fill: color, extent: pt(80, 50), 
                       onMouseDown(evt) {
                           picker.color = this.fill;
                           picker.update();
                       }}),
            new Text({textString: color.toHexString(), fill: Color.transparent,
                      fontColor: Color.gray})
         ]
     });
  }

  toggleHarmoniesButton() {
     return this.getSubmorphNamed("toggleHarmonies") || 
       {name: "toggleHarmonies", fill: Color.transparent,
        active: false,
        onMouseDown(evt) {
           const [toggleIndicator, _] = this.submorphs;
           this.update(this.active = !this.active, toggleIndicator);
        },
        update: (active, toggleIndicator) => {
           const duration = 300, easing = 'ease-out';
           if (active) {
              toggleIndicator.animate({rotation: num.toRadians(90), duration});
              this.harmonies().animate({opacity: 1, duration, easing});
              this.animate({height: this.height + this.harmonies().height, duration});
           } else {
              toggleIndicator.animate({rotation: 0, duration});
              this.animate({height: this.height - this.harmonies().height, duration});
              this.harmonies().animate({opacity: 0, duration, easing});
           }
        },
        layout: new HorizontalLayout({spacing: 5}),
        submorphs: [
        {extent: pt(30,30), clipMode: "hidden", origin: pt(15,15), scale: 0.5,
         position: pt(20,20), fill: Color.transparent, submorphs: [
             {extent: pt(30,30), rotation: num.toRadians(45), origin: pt(15,15), position: pt(-20,0),
              fill: Color.gray}]},
        {
           type: "text",
           fill: Color.transparent,
           fontColor: Color.gray,
           fontWeight: 'bold',
           textString: "Harmonies",
           readOnly: true,
           onMouseDown: (evt) => {
               
           }
        }]};
  }

  harmonies() {
    return this.getSubmorphNamed("harmonies") || new Morph({
      name: "harmonies",
      layout: new HorizontalLayout({spacing: 5}),
      fill: Color.transparent,
      update: (colorPicker) => {
         this.harmonyVisualizer().update(colorPicker);
         this.harmonyPalette().displayHarmony(colorPicker, this.harmony.chord())
      },
      submorphs: [this.harmonyPalette(), this.harmonyControl()]
    })
  }

  harmonyPalette() {
     return this.getSubmorphNamed("harmonyPalette") || new Morph({
         name: "harmonyPalette",
         layout: new TilingLayout({spacing: 5}),
         fill: Color.transparent,
         width: 260,
         displayHarmony(colorPicker, colors) {
             if (colors.length != this.submorphs.length) {
                this.submorphs = colors.map(c => colorPicker.colorField(c))
             } else {
                arr.zip(this.submorphs, colors)
                   .forEach(([f, c]) => {
                      f.setColor(c);
                });
             }
         }
     });
  }

  harmonyControl() {
     return this.getSubmorphNamed("harmonyControl") || new Morph({
         name: "harmonyControl",
         layout: new VerticalLayout({spacing: 5}),
         fill: Color.transparent,
         submorphs: [this.harmonyVisualizer(),
                     this.harmonySelector()]
     })
  }

  harmonyVisualizer() {
     return this.getSubmorphNamed("harmonyVisualizer") || new Image({
         name: "harmonyVisualizer",
         extent: pt(110,110),
         fill: Color.transparent,
         imageUrl: WHEEL_URL,
         update(colorPicker) {
             const [harmonyPoints] = this.submorphs,
                   chord = colorPicker.harmony.chord(),
                   colorPoints = chord.map(c => {
                      const [h,s,_] = c.toHSB(),
                             angle = num.toRadians(h);
                      return Point.polar(50 * s, angle);
                   });
             if (harmonyPoints.submorphs.length != colorPoints.length) {
                 harmonyPoints.submorphs = colorPoints.map(p => new Ellipse({
                        center: p, fill: Color.transparent, 
                        borderWidth: 1, borderColor: Color.black
                     }));
             } else {
                 arr.zip(harmonyPoints.submorphs, colorPoints).forEach(([m, p]) => { m.center = p});
             }
         },
         submorphs: [new Ellipse({
            name: "harmonyPoints",
            extent: pt(100,100),
            origin: pt(50,50),
            position: pt(50,50),
            fill: Color.transparent,
            borderWidth: 1
         })]
     });
  }

  harmonySelector() {
     return this.getSubmorphNamed("harmonySelector") || new Morph({
         name: "harmonySelector",
         extent: pt(150, 50),
         layout: new HorizontalLayout(),
         fill: Color.transparent,
         onMouseDown: (evt) => {
               this.harmonyMenu = Menu.forItems([
                  {command: "Complementary", target: this}, {command: "Triadic", target: this}, 
                  {command: "Tetradic", target: this}, {command: "Quadratic", target: this}, 
                  {command: "Analogous", target: this}, {command: "Neutral", target: this}
               ]).openInWorld();
               this.harmonyMenu.globalPosition = this.harmonySelector().globalPosition;
            },
         submorphs: [new Text({
            name: "harmonyLabel",
            nativeCursor: "pointer",
            fill: Color.transparent,
            readOnly: true,
            fontSize: 15,
            fontColor: Color.gray.lighter(),
            textString: this.harmony.name})]
     });
     
  }
}
