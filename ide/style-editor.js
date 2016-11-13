import { Window, GridLayout, FillLayout, Ellipse, Text,
         VerticalLayout, HorizontalLayout, Image, 
         TilingLayout, Morph, morph, Menu, Path } from "../index.js";
import { Rectangle, Color, LinearGradient, pt, Point, rect } from "lively.graphics";
import { obj, num, arr } from "lively.lang";
import { signal, connect } from "lively.bindings";
import { ValueScrubber } from "../widgets.js";
import { Icon } from "../icons.js";

const WHEEL_URL = 'https://www.sessions.edu/wp-content/themes/divi-child/color-calculator/wheel-5-ryb.png'

/*TODO:  Move this to a more appropriate location */

export class RotateSlider extends Ellipse {

}

export class Slider extends Morph {

    constructor(props) {
        const slider = this;
        super({
           height: 20,
           fill: Color.transparent,
           ...props
        });
        this.submorphs = [
           new Path({
                borderColor: Color.gray.darker(),
                borderWidth: 4,
                vertices: [this.leftCenter.addXY(7.5,0), 
                           this.rightCenter.addXY(-7.5,0)]
              }),
              {type: "ellipse", fill: Color.gray, name: "slideHandle",
               borderColor: Color.gray.darker(), borderWidth: 1, dropShadow: true,
               extent: pt(15,15),
               onDrag(evt) {
                  slider.onSlide(this, evt.state.dragDelta);
               }}
         ];
         connect(this, "extent", this, "update");
         this.update();
    }

    normalize(v) {
        return Math.abs(v / (this.max - this.min));
    }

    update() {
        const x = (this.width - 15) * this.normalize(this.target[this.property]);
        this.get("slideHandle").center = pt(x + 7.5, 10);
    }

    onSlide(slideHandle, delta) {
       const oldValue = this.target[this.property],
             newValue = oldValue + delta.x / this.width;
       this.target[this.property] = Math.max(this.min, Math.min(this.max, newValue));
       this.update();
    }
    
}

export class DropDownSelector extends Morph {

     constructor(props) {
        const {target, property} = props;
        this.dropDownLabel = Icon.makeLabel("chevron-circle-down", {
                                     opacity: 0, fontSize: 14, 
                                     fontColor: Color.gray.darker()
                              });
        super({border: {
                  radius: 3, 
                  color: Color.gray.darker(), 
                  style: "solid"},
                layout: new HorizontalLayout({spacing: 4}),
                ...props,
                submorphs: [{
                    type: "text", name: "currentValue", 
                    textString: target[property], 
                    padding: 0, readOnly: true,
                  }, this.dropDownLabel]
               });
     }

     get commands() {
        return this.values.map(v => {return {name: v, exec: (self, v) => { this.value = v }}});
     }

     set value(v) {
        this.target[this.property] = v;
        this.get("currentValue").textString = obj.safeToString(v);
     }

     onHoverIn() {
        this.dropDownLabel.animate({opacity: 1, duration: 300});
     }

     onHoverOut() {
        this.dropDownLabel.animate({opacity: 0, duration: 200});
     }
 
     onMouseDown(evt) {
         this.menu = this.world().openWorldMenu(this.values.map(v => 
           { return {command: v, target: this, args: v}}));
         this.menu.globalPosition = this.globalPosition;
         this.menu.isHaloItem = this.isHaloItem;
     }

}

export class PropertyInspector extends Morph {

   constructor(props) {
       const btnStyle = {
          type: "button",
          border: {radius: 3, style: "solid", color: Color.gray}
       }, {target, property} = props;
       super({
           fill: Color.transparent,
           extent:pt(55, 20), 
           submorphs: [new ValueScrubber({
                        name: "value", 
                        borderRadius: 3, fill: Color.white,
                        padding: 3, fontSize: 13,
                        borderColor: Color.gray.darker(), 
                        value: target[property], ...props}),
                        {name: "up", ...btnStyle, label: Icon.makeLabel(
                                  "sort-asc", {padding: rect(2,0,0,0)})},
                        {name: "down", ...btnStyle, label: Icon.makeLabel(
                                  "sort-desc", {padding: rect(0,0,0,2)})}]
       });
       this.target = target;
       this.property = property;
       this.initLayout();
       connect(this.get("value"), "scrub", this.target, this.property);
       connect(this.get("up"), "fire", this, "increment");
       connect(this.get("down"), "fire", this, "decrement");
   }

   update() {
       this.get("value").value = this.target[this.property];
   }

   increment() { this.target[this.property] += 1; this.update() }

   decrement() { this.target[this.property] -= 1; this.update() }

   initLayout() {
      const l = this.layout = new GridLayout({
                      grid:[["value", "up"],
                            ["value", "down"]]
                    });
      l.col(1).paddingLeft = 5;
      l.col(1).paddingRight = 5;
      l.col(1).fixed = 25;
      return l;
   }

}

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

    get name() { return "Complement" }
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
      isHaloItem: true,
      ...props
    });
    this.titleLabel().fontColor = Color.gray;
    this.update();
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

  get commands() {
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
     this.targetMorph.withAllSubmorphsDo(p => p.update && p.update(this));
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
           this.toggle(this.active = !this.active, toggleIndicator);
        },
        toggle: (active, toggleIndicator) => {
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
      opacity: 0,
      submorphs: [this.harmonyPalette(), this.harmonyControl()]
    })
  }

  harmonyPalette() {
     const colorPicker = this;
     return this.getSubmorphNamed("harmonyPalette") || new Morph({
         name: "harmonyPalette",
         layout: new TilingLayout({spacing: 5}),
         fill: Color.transparent,
         width: 260,
         update(colorPicker) {
             const colors = colorPicker.harmony.chord();
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
     const dropDownIndicator = Icon.makeLabel("chevron-circle-down", {
               fontColor: Color.gray.lighter(),
               fontSize: 14, opacity: 0}
           );
     return this.getSubmorphNamed("harmonySelector") || new Morph({
         name: "harmonySelector",
         extent: pt(150, 50),
         layout: new HorizontalLayout({spacing: 5}),
         fill: Color.transparent,
         onMouseDown: (evt) => {
               this.harmonyMenu = Menu.forItems([
                  {command: "Complement", target: this}, {command: "Triadic", target: this}, 
                  {command: "Tetradic", target: this}, {command: "Quadratic", target: this}, 
                  {command: "Analogous", target: this}, {command: "Neutral", target: this}
               ]).openInWorld();
               this.harmonyMenu.globalPosition = this.harmonySelector().globalPosition;
            },
         onHoverIn() {
            dropDownIndicator.animate({opacity: 1, duration: 200});
         },
         onHoverOut() {
            dropDownIndicator.animate({opacity: 0, duration: 200});
         },
         submorphs: [new Text({
            name: "harmonyLabel",
            nativeCursor: "pointer",
            fill: Color.transparent,
            readOnly: true,
            fontSize: 15,
            fontColor: Color.gray.lighter(),
            textString: this.harmony.name}),
          dropDownIndicator]
     });
     
  }
}

// TODO: add Color palette as first instance to selecting a color

export class ColorPickerField extends Morph {

   constructor({property, target}) {
      super({
         property, target,
         extent: pt(20,20),
         borderRadius: 5, clipMode: "hidden",
         borderWidth: 1, borderColor: Color.gray.darker(),
      })
      const topRight = this.innerBounds().topRight(),
            bottomLeft = this.innerBounds().bottomLeft();
      
      this.submorphs = [{
             name: "topLeft",
             extent: pt(20,20)
         }, {
             name: "bottomRight",
             extent: pt(40,20),
             origin: pt(40,0), topRight, 
             rotation: num.toRadians(-45)
      }];

      this.update();
      connect(this.target, "change", this, "update");
   }

   update() {
      this.get("topLeft").fill = this.target[this.property];
      this.get("bottomRight").fill = this.target[this.property].withA(1);
   }

   onMouseDown(evt) {
      const p = this.picker || new ColorPicker({
                    extent: pt(400,310), 
                    color: this.target[this.property]})
      p.openInWorldNearHand();
      p.adjustOrigin(evt.positionIn(p));
      p.scale = 0; p.opacity = 0;
      p.animate({opacity: 1, scale: 1, duration: 200});
      connect(p, "color", this.target, this.property);
      this.picker = p;
   }

}

class StyleEditor extends Morph {

   constructor(props) {
      const {title} = props;
      super({
        name: "BorderStyler",
        dropShadow: true,
        draggable: true,
        borderColor: Color.gray,
        borderWidth: 4,
        fill: Color.black.withA(.7),
        borderRadius: 15,
        layout: new VerticalLayout({spacing: 5}),
        ...props,
        submorphs: [{
           fill: Color.transparent,
           layout: new HorizontalLayout(),
           onDrag: (evt) => this.onDrag(evt),
           submorphs: [{
             type: "text", fontWeight: "bold", padding: 5,
             fontColor: Color.gray, fontSize: 12, readOnly: true,
             textString: title, fill: Color.transparent, draggable: true,
             onDrag: (evt) => this.onDrag(evt)
        }]
    }]});
   }

   close() {
      this.active = false;
      signal(this, "close", false);
      this.remove()
   }
   
   async open() {
      if (this.active) return;
      const [wrapper] = this.submorphs,
            {submorphs: [instruction]} = wrapper,
            duration = 200;
      this.layout = null;
      wrapper.addMorphAt(Icon.makeLabel("times-circle-o", {
           fontSize: 22, fontColor: Color.gray.darker(),
           nativeCursor: "pointer", onMouseDown: () => this.close()}), 0);
      instruction.animate({fontColor: Color.gray.darker(), duration});
      this.controls(this.target).forEach(c => {
         c.opacity = 0;
         this.addMorph(c).animate({opacity: 1, duration});
      });
      this.animate({
          fill: Color.gray.lighter(),
          borderWidth: 1, borderRadius: 7,
          borderColor: Color.gray,
          duration, layout: new VerticalLayout({spacing: 5})
      });
      this.active = true;
      return false;
   }

   get isHaloItem() { return true }

   createControl(name, controlElement) {
     return {
      fill: Color.transparent, 
      draggable: true, onDrag: (evt) =>  this.onDrag(evt),
      layout: new VerticalLayout({spacing: 5}),
      submorphs: [
        {type: "text", textString: name, 
         fontColor: Color.black, padding: rect(5,0,0,0), 
         fill: Color.transparent},
        controlElement
     ]}
  }


}

export class BodyStyleEditor extends StyleEditor {
   
   controls(target) {
       return [
           this.fillControl(target),
           this.opacityControl(target)
           //this.shadowControl(target)
       ]
   }

   opacityControl(target) {
      return this.createControl("Opacity", new Slider({
             target, min: 0, max: 1, 
             property: "opacity", width: 150
      }));
   }

   fillControl(target) {
      return this.createControl("Fill", new ColorPickerField({target, property: "fill"}));
   }

   shadowControl() {
     return this.createControl("Shadow", {
        // position (angle), distance, blur, color, opacity?
        layout: new GridLayout({grid: [["distanceSlider"],
                                       ["blurSlider"],
                                       ["angleSlider", "angleControl", "colorPicker"]]}),
        submorphs: [new Slider(), new Slider(), 
                    new RotateSlider(), new PropertyInspector(),
                    new ColorPickerField()]
     })
  }
   
}

export class BorderStyleEditor extends StyleEditor {

  controls(target) {
     return [
         this.borderControl(target),
         this.clipControl(target)
      ]
  }
  
  clipControl(target) {
     return this.createControl("Clip Mode", 
       {layout: new HorizontalLayout({spacing: 5}),
        fill: Color.transparent,
        submorphs: [
         new DropDownSelector({
             isHaloItem: true,
             target, property: "clipMode", 
             values: ["visible", "hidden", "scroll"]
       })]
     });
  }

  borderControl(target) {
     return this.createControl("Border", {
             layout: new HorizontalLayout({spacing: 5, compensateOrigin: true}),
             fill: Color.transparent, 
             submorphs: [new DropDownSelector({target, isHaloItem: true, property: "borderStyle", values: ["solid", "dashed"]}), 
                         new ColorPickerField({target, property: "borderColor"}),
                         new PropertyInspector({min: 0, target, unit: "pt", property: "borderWidth"})]
              })
  }
  
}

export class LayoutStyleEditor extends Morph {

    getLayoutObjects() {
       return [null,
               new HorizontalLayout({autoResize: false}), 
               new VerticalLayout({autoResize: false}), 
               new FillLayout(), 
               new TilingLayout(), 
               new GridLayout({grid: [[null], [null], [null]]})];
   }

   remove() {
       this.layoutHalo && this.layoutHalo.remove();
       super.remove();
   }

   async toggle() {
       const layoutHaloToggler = this.getSubmorphNamed("layoutHaloToggler"),
             layoutPicker = this.getSubmorphNamed('layoutPicker');
       if (this.layoutHalo) {
          this.active = false;
          this.halo.showStyleGuides(true);
          this.layout = null;
          this.submorphs = [this.getSubmorphNamed("layoutControlPickerWrapper")];
          layoutPicker.textString = this.getCurrentLayoutName();
          this.layoutHalo.remove(); this.layoutHalo = null;
          Icon.setIcon(layoutHaloToggler, "th");
          layoutHaloToggler.fontSize = 14; layoutHaloToggler.padding = 3;
          layoutHaloToggler.tooltip = "Show layout halo";
          await this.animate({
                layout: new HorizontalLayout(),
                duration: 300
          });
       } else {
          this.active = true;
          this.halo.showStyleGuides(false);
          this.layoutHalo = this.world().showLayoutHaloFor(this.target, this.pointerId);
          this.layout = null;
          this.submorphs = [...this.submorphs, ...this.layoutHalo.optionControls()]
          layoutPicker.textString = "Configure Layout";
          Icon.setIcon(layoutHaloToggler, "times-circle-o");
          layoutHaloToggler.fontSize = 22; layoutHaloToggler.padding = 0;
          layoutHaloToggler.tooltip = "Close layout halo";
          this.animate({
             layout: new VerticalLayout({spacing: 0}),
             duration: 300
          });
       }
       this.update(true);
   }

   getCurrentLayoutName() {
      return this.getLayoutName(this.target.layout);
   }

   getLayoutName(l) {
      return l ? l.name() + " Layout" : "No Layout";
   }

   openLayoutMenu() {
     if (this.layoutHalo) return;
     var menu = this.world().openWorldMenu(
        this.getLayoutObjects().map(l => {
           return [this.getLayoutName(l), 
                   () => {
                       const p = this.getSubmorphNamed("layoutPicker");
                       this.target.animate({layout: l, 
                                            easing: "cubic-bezier(0.075, 0.82, 0.165, 1)"});
                       p.textString = this.getLayoutName(l);
                       p.fitIfNeeded();
                       this.update();
                   }]
        })
     )
     menu.globalPosition = this.getSubmorphNamed("layoutPicker").globalPosition;
     menu.isHaloItem = true;
   }

   update(animated) { 
      const topCenter = this.target
                            .globalBounds()
                            .withX(0).withY(0)
                            .bottomCenter().addXY(50, 70),
            inspectButton = this.getSubmorphNamed('layoutHaloToggler');
      if (animated) {
         this.animate({topCenter, duration: 300});
      } else { this.topCenter = topCenter; }
      if (!this.target.layout) {
        inspectButton.opacity = .5;
        inspectButton.nativeCursor = null;
      } else {
        inspectButton.opacity = 1;
        inspectButton.nativeCursor = "pointer";
      }
   }

   constructor(props) {
       const {target} = props;
       super({
           name: "layoutControl",
           border: {radius: 15, color: Color.gray, width: 1},
           clipMode: "hidden", dropShadow: true,
           extent: pt(120, 75),
           fill: Color.gray.lighter(),
           layout: new VerticalLayout(),
           isHaloItem: true,
           ...props, 
       });
       this.submorphs = [{
            name: "layoutControlPickerWrapper",
            fill: Color.transparent,
            layout: new HorizontalLayout({spacing: 5}),
            submorphs: [
               this.layoutHaloToggler(),
               this.layoutPicker()
           ]}];
       this.update(false);
   }

   layoutPicker() {
      return {
          type: 'text', fill: Color.transparent, name: "layoutPicker",
          padding: 2, readOnly: true,  fontColor: Color.black.lighter(),
          fontWeight: 'bold', nativeCursor: "pointer", padding: 3,
          fontStyle: 'bold', textString: this.getCurrentLayoutName(),
          onMouseDown: (evt) => {
             this.openLayoutMenu();
        }
      }
   }

   layoutHaloToggler() {
      return Icon.makeLabel("th", {
                  name: "layoutHaloToggler",
                  nativeCursor: "pointer",
                  fontSize: 15, fontColor: Color.black.lighter(),
                  padding: 3,
                  tooltip: "Toggle layout halo",
                  onMouseDown: (evt) => {
                     this.target.layout && this.toggle();
                  }
               })
   }
}
