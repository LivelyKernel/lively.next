import { Window, GridLayout, FillLayout, Ellipse, Text,
         VerticalLayout, HorizontalLayout, Image,
         TilingLayout, Morph, morph, Menu, Path } from "../index.js";
import { Rectangle, Color, LinearGradient, pt, Point, rect,
         materialDesignColors, flatDesignColors, RadialGradient,
         webSafeColors } from "lively.graphics";
import { obj, num, arr, properties } from "lively.lang";
import { signal, connect } from "lively.bindings";
import { ValueScrubber, CheckBox } from "../widgets.js";
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
                borderWidth: 2,
                vertices: [this.leftCenter.addXY(5,0),
                           this.rightCenter.addXY(-5,0)]
              }),
              {type: "ellipse", fill: Color.gray, name: "slideHandle",
               borderColor: Color.gray.darker(), borderWidth: 1, dropShadow: {blur: 5},
               extent: pt(15,15), nativeCursor: "grab",
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
        this.get("slideHandle").center = pt(x + 7.5, 12);
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
      const {target, property, values} = props;
      this.values = values;
      this.dropDownLabel = Icon.makeLabel("chevron-circle-down", {
                                   opacity: 0, fontSize: 16, 
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
                  textString: this.getNameFor(target[property]), 
                  padding: 0, readOnly: true,
                }, this.dropDownLabel]
             });
   }

   getMenuEntries() {
      return this.commands.map(c => { 
          return {command: c.name, target: this}
         });
   }

   get commands() {
      if (obj.isArray(this.values)) {
         return this.values.map(v => {
             return {name: v, exec: () => { this.value = v }}
         });
      } else {
         return properties.forEachOwn(this.values, (name, v) => {
             return {name, exec: () => { this.value = v }}
         });
      }
      
   }

   getNameFor(value) {
      if (obj.isArray(this.values)) {
         return obj.safeToString(value);
      } else {
         return obj.safeToString(properties.nameFor(this.values, value));
      }
   }

   set value(v) {
      this.target[this.property] = v;
      this.get("currentValue").textString = this.getNameFor(v);
   }

   onHoverIn() {
      this.dropDownLabel.animate({opacity: 1, duration: 300});
   }

   onHoverOut() {
      this.dropDownLabel.animate({opacity: 0, duration: 200});
   }
 
  onMouseDown(evt) {
    this.menu = this.world().openWorldMenu(evt, this.getMenuEntries());
    this.menu.globalPosition = this.globalPosition;
    this.menu.isHaloItem = this.isHaloItem;
  }

}

export class PropertyInspector extends Morph {

   constructor(props) {
       const btnStyle = {
          type: "button", activeStyle: {fill: Color.transparent, borderWidth: 0, fontColor: Color.white.darker()}, 
                          triggerStyle: {fill: Color.transparent, fontColor: Color.black}
       }, {target, property, name} = props;
       super({
           name,
           extent:pt(55, 25), borderRadius: 5,
           borderWidth: 1, borderColor: Color.gray, 
           clipMode: "hidden",
           submorphs: [new ValueScrubber({
                        name: "value", fill: Color.white,
                        padding: 4, fontSize: 15,
                        value: target[property],
                        ...obj.dissoc(props, ["name"])}),
                        {name: "down", ...btnStyle, label: Icon.makeLabel(
                                  "sort-desc", {padding: rect(2,2,0,0), fontSize: 12})},
                        {name: "up", ...btnStyle, label: Icon.makeLabel(
                                  "sort-asc", {padding: rect(2,2,0,0), fontSize: 12})}]
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
      l.row(1).paddingTop = -10;
      return l;
   }

}

/* TODO: All of the color harmonies as well as the hsv based color storing should
         be moved into lively.graphics */

class ColorHarmony {

   static offsets() { return null }

   static stepCount() { return 0 }

   static stepSize() { return 0; }

   static get name() { return "Color Harmony"}

   static chord({hue, saturation, brightness}) {
      const offsets = this.offsets() || arr.range(0, this.steps()).map(i => i * this.stepSize());
      return offsets.map(offset => Color.hsb(hue + offset % 360, saturation, brightness));
   }

}

class Complementary extends ColorHarmony {

    static get name() { return "Complement" }
    static steps() { return 1 }
    static stepSize() { return 180 }

}

class Triadic extends ColorHarmony {

   static get name() { return "Triadic" }
   static steps() { return 2 }
   static stepSize() { return 120 }

}

class Tetradic extends ColorHarmony {

   static get name() { return "Tetradic" }
   static offsets() { return [0, 60, 180, 240] }

}

class Quadratic extends ColorHarmony {

   static get name() { return "Quadratic" }
   static steps() { return 3 }
   static stepSize() { return 90 }

}

class Analogous extends ColorHarmony {

   static get name() { return "Analogous" }
   static steps() { return 5 }
   static stepSize() { return 30 }

}

class Neutral extends ColorHarmony {

   static get name() { return "Neutral" }
   static steps() { return 5 }
   static stepSize() { return 15 }

}

export class ColorPicker extends Window {

  constructor(props) {
    this.color = props.color || Color.blue;
    this.harmony = new Complementary(this);
    super({
      title: "Color Picker",
      name: "Color Picker",
      extent: pt(400, 320),
      fill: Color.black.withA(.7),
      borderWidth: 0,
      resizable: false,
      targetMorph: this.colorPalette(),
      isHaloItem: true,
      ...props
    });
    this.titleLabel().fontColor = Color.gray;
    this.update();
    this.focus();
  }

  onKeyDown(evt) {
     if (evt.key == "Escape") this.remove();
  }

  onMouseDown(evt) {
     if (this.harmonyMenu) this.harmonyMenu.remove();
  }

  set color(c) {
    const [h, s, b] = c.toHSB();
    this.hue = h
    this.saturation = s;
    this.brightness = b;
    this._alpha = c.a;
  }

  set alpha(a) {
     this._alpha = a;
     this.update();
  }

  get alpha() { return this._alpha}

  get color() {
    return Color.hsb(this.hue, this.saturation, this.brightness).withA(this.alpha);
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
      submorphs: [this.fieldPicker(), this.scalePicker(), this.colorDetails(), this.alphaSlider()]
    })
    colorPalette.layout.col(0).paddingLeft = 10;
    colorPalette.layout.col(1).fixed = 55;
    colorPalette.layout.col(2).fixed = 100;
    colorPalette.layout.row(0).fixed = this.colorDetails().height;
    colorPalette.layout.row(1).fixed = 20;
    return colorPalette;
  }
  
  alphaSlider() {
    return {
       name: "alphaSlide",
       fill: Color.transparent, layout: new HorizontalLayout({spacing: 3}),
       update(colorPicker) {
          this.get("alphaDisplay").value = (colorPicker.color.a * 100).toFixed();
       },
       submorphs: [
        {type: "label", padding: 3, value: "Alpha", fontColor: Color.gray, fontWeight: 'bold'},
        new Slider({
             target: this, min: 0, max: 1,
             property: "alpha", width: 170
      }), {type: "label", padding: 3, value: (this.alpha * 100).toFixed(), 
           fontSize: 12, fontColor: Color.gray, name: "alphaDisplay"}]
    }
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

}

export class ColorPalette extends Morph {

   constructor(props) {
      this.harmony = Complementary;
      super({
         fill: Color.gray,
         dropShadow: true, 
         colorFieldWidth: 20,
         extent: pt(200,300),
         borderRadius: 5,
         selectedColor: props.selectedColor || Color.blue,
         layout: new VerticalLayout({ignore: ["arrow"]}),
         ...props,
      });
      this.pivotColor = this.selectedColor;
      this.build();
      this.active = true;
      this.focus();
   }

   isHaloItem() { return true }

   onKeyDown(evt) {
      if (evt.key == "Escape") this.remove();
   }

   get harmony() { return this._harmony }
   set harmony(h) { 
      this._harmony = h;
      this.active && this.relayout();
   }

   build() {
     this.cachedPalette = {};
     this.submorphs = [{type: "triangle", name: "arrow", 
                        fill: this.fill, grabbable: false, 
                        draggable: false},
                       this.fillTypeSelector(),
                       this.paletteView()];
     this.selectSolidMode();
   }

   relayout() {
      const arrow = this.get('arrow'), 
            harmonyPalette = this.get('harmonyPalette'),
            fillTypeSelector = this.get("fillTypeSelector"),
            paletteView = this.get("paletteView");
      paletteView.relayout();
      fillTypeSelector.animate({width: this.get("paletteView").bounds().width, duration: 200});
      fillTypeSelector.relayout();
      harmonyPalette.relayout();
      arrow.extent = pt(this.width/15, this.width/15);
      arrow.bottomCenter = pt(this.width/2, 1);
   }

   paletteView() {
      return {
        fill: Color.transparent,
        name: "paletteView",
        clipMode: "hidden",
        relayout() {
           this.animate({extent: this.submorphs.find(p => p.visible).extent, duration: 300});
        },
        submorphs: [this.solidColorPalette(), this.gradientPalette(), this.harmonyPalette()]
      }
   }

   selectSolidMode() {
      var duration = 200,
          paletteView = this.get("paletteView"),
          selector = this.get('fillTypeSelector');
       if (this.get("solidColorPalette").opacity) return;
       paletteView.submorphs.forEach(m => m.animate({opacity: 0, visible: false, duration}));
       this.get("solidColorPalette").animate({opacity: 1, visible: true, duration});
       this.relayout();
       selector.switchLabel("labelSolid");
   }

   selectHarmonyMode() {
      var duration = 200,
          paletteView = this.get("paletteView"),
          selector = this.get('fillTypeSelector');
      if (this.get("harmonyPalette").opacity) return;
      paletteView.submorphs.forEach(m => m.animate({opacity: 0, visible: false, duration}));
      this.get("harmonyPalette").animate({opacity: 1, visible: true, duration});
      this.relayout();
      selector.switchLabel("labelHarmonies");
   }

   fillTypeSelector() {
      // switch between gradient or solid
      return {
         name: "fillTypeSelector",
         fill: Color.transparent, 
         height: 30, width: 300, origin: pt(0,5),
         layout: new GridLayout({
             grid: [[null, "labelSolid", null, "labelHarmonies", null]],
             autoAssign: false, fitToCell: false, 
         }),
         relayout() { this.currentLabel && this.get("typeMarker").setBounds(this.currentLabel.bounds()); },
         switchLabel(newLabelName) {
             const newLabel = this.get(newLabelName), duration = 200;
             this.get("typeMarker").animate({bounds: newLabel.bounds(), duration});
             newLabel.animate({fontColor: Color.white, duration});
             this.currentLabel && this.currentLabel.animate({fontColor: Color.black, duration});
             this.currentLabel = newLabel;
         },
         submorphs: [
            {name: "typeMarker", fill: Color.gray.darker(), borderRadius: 3},
            {name: "labelSolid", type: "label", fontWeight: 'bold', nativeCursor: "pointer",
             padding: 4, value: "Color Palettes", onMouseDown: () => {
                this.selectSolidMode();
            }},
            {name: "labelHarmonies", type: "label", fontWeight: 'bold', nativeCursor: 'pointer',
             padding: 4, value: "Color Harmonies", tooltip: this.getPaletteDescription("harmony"), 
             onMouseDown: () => {
                this.selectHarmonyMode();
            }}
         ]
      }
   }

   gradientPalette() {
      const palette = this,
            defaultLinearGradient = new LinearGradient([
              {color: Color.white, offset: "0%"},
              {color: Color.black, offset: "100%"}]),
            defaultRadialGradient = new RadialGradient([
              {color: Color.white, offset: "0%"},
              {color: Color.black, offset: "100%"}]);
      return {
         name: "gradientPalette",
         fill: Color.transparent,
         layout: new VerticalLayout(),
         relayout() {
            if (palette.selectedColor.isGradient) {
              // select the approporiate gradient type,
              // attach gradient editor to the found gradient
            } else {
               // signify user to select a Gradient Type
               // disable the gradient editor
            }
         },
         submorphs: [
             {fill: Color.transparent, 
              layout: new GridLayout({grid: [["selectInst", "radialMode", "linearMode", null]],
                                      autoAssign: false, fitToCell: false}),
              width: 400,
              height: 100,
              submorphs: [{
                 type: "label", name: "selectInst",
                 value: "Select Gradient Type:"
              }, {
                 name: "radialMode",
                 extent: pt(50,50), borderRadius: 5,
                 fill: defaultRadialGradient,
                 onMouseDown(evt) {
                    palette.applyGradient(RadialGradient)
                 }
              }, {
                 name: "linearMode",
                 extent: pt(50,50), borderRadius: 5,
                 fill: defaultLinearGradient,
                 onMouseDown: (evt) => {
                    palette.applyGradient(LinearGradient)
                 }
              }]}, 
              this.gradientEditor()],
      }
   }

   gradientEditor() {
      return {
         name: "gradientEditor",
         width: 400,
         height: 100,
         borderWidth: 5, borderColor: Color.gray.darker(),
         fill: Color.gray,
         submorphs: [{
            type: "label", name: "gradientInst", value: "Please select a Gradient Type",
            fontSize: 20, fontWeight: "bold", fontColor: Color.gray.darker()
         }]
      }
   }

   solidColorPalette() {
      // switch between different palettes (material, flat, harmonies, custom)
      // custom allows to add new colors via color picker
      return {
         opacity: 0, 
         name: "solidColorPalette",
         fill: Color.transparent,
         layout: new VerticalLayout(),
         submorphs: [this.getCurrentPalette(),
                     this.paletteConfig()]
      }
   }

   getCurrentPalette() {
      const {name, colors, mod} = this.getColorsFor(this.colorPalette);
      return this.cachedPalette[name] || this.getPalette(colors, mod)
   }

   getPalette(colors, mod) {
       const cols = Math.max(Math.ceil(colors.length / mod), 15),
             height = cols * this.colorFieldWidth, 
             width =  mod * this.colorFieldWidth,
             paddedColors = [...colors, ...arr.withN((cols * mod) - colors.length, null)];
       return {fill: Color.transparent, 
               width, height,
               layout: new TilingLayout(), 
               rotation: num.toRadians(90),
               submorphs: paddedColors.map(c => {
                  const  fill = c && Color.rgbHex(c)
                  return c ? {
                     extent: pt(this.colorFieldWidth, this.colorFieldWidth),
                     fill,
                     borderColor: Color.transparent,
                     borderWidth: 2,
                     onHoverIn() {
                        const [h,s,b] = fill.toHSB();
                        this.borderColor = Color.hsb(h,s + .5 > 1 ? s - .5 : s + .5, b + .5 > 1 ? b - .5 : b + .5)
                     },
                     onHoverOut() {
                        this.borderColor = Color.transparent;
                     },
                     onMouseDown: () => { 
                        this.selectedColor = Color.rgbHex(c);
                        signal(this, "selectedColor", this.selectedColor);
                        this.fadeOut(200);
                     } 
                  } : {
                     extent: pt(this.colorFieldWidth, this.colorFieldWidth),
                     borderColor: Color.black.lighter().lighter(), borderWidth: 1,
                     fill: Color.transparent
                  }
               })};
   }

   switchPalette({name, colors, mod}) {
      const colorPalette = this.get("solidColorPalette"),
            [_, config] = colorPalette.submorphs;
      this.cachedPalette[name] = this.cachedPalette[name] || this.getPalette(colors, mod, name);
      colorPalette.submorphs = [this.cachedPalette[name], config];
      this.relayout();
   }

   getPaletteDescription(paletteName) {
      const descriptions = {
         harmony: 'Color harmonies are particularly pleasing combinations\n' +
                  'of two or more colors derived from their relationship\n' + 
                  'on a color wheel. Also known as color chords, color\n' + 
                  'harmonies are useful when exploring a possible color\n' + 
                  'palette, or can be used as a standalone color scheme.\n',
         custom: `Your personal set of customly defined colors.`,
         materialDesign: 'Material design is a visual language and design\n' +
                         'system developed by Google with an almost flat\n' +
                         'style and vibrant color schemes.',
         flatDesign: 'Flat design or flat UI colors are quite popular\n' +
                     'in web design today where bold, bright colors\n' +
                     'are used to create clean, simple interfaces.',
         webSafe: 'Web safe colors emerged during the early era of' +
                  'the internet; a standardized palette of 216 colors' + 
                  'that displayed consistently across all major browsers.'
      }
      return descriptions[paletteName];
   }

   updatePaletteDescription() {
      const description = this.get("paletteSelector");
      description.tooltip = this.getPaletteDescription(this.colorPalette);
   }

   set colorPalette(paletteName) {
       this._currentPalette = paletteName;
       this.switchPalette(this.getColorsFor(paletteName));
       this.updatePaletteDescription();
   }

   getColorsFor(paletteName) {
       const nameToColors = {
          flatDesign: {colors: flatDesignColors, mod: 11},
          materialDesign: {colors: materialDesignColors, mod: 15},
          webSafe: {colors: webSafeColors, mod: 12}
       };
       return {name: paletteName, ...nameToColors[paletteName]};
   }

   get colorPalette() { return this._currentPalette || "flatDesign" }

   paletteConfig() {
      return {
         name: "paletteConfig",
         fill: Color.transparent,
         layout: new HorizontalLayout({spacing: 5}),
         submorphs: [new DropDownSelector({
             isHaloItem: true, name: "paletteSelector",
             target: this, property: "colorPalette", 
             tooltip: this.getPaletteDescription(this.colorPalette),
             values: {"Flat Design" : "flatDesign",
                      "Material Design" : "materialDesign",
                      "Web Safe" : "webSafe"}
       })]
      }
   }

   
  harmonyPalette() {
    return {
      name: "harmonyPalette",
      layout: new HorizontalLayout({spacing: 5}),
      fill: Color.transparent,
      relayout() {
          const harmonyVisualizer = this.get("harmonyVisualizer"),
                harmonies = this.get("harmonies");
          harmonyVisualizer.update();
          harmonies.update();
      },
      submorphs: [this.harmonies(), this.harmonyControl()]
    }
  }

  colorField(color) {
     const colorPalette = this,
           [h,s,b] = color.toHSB();
     return new Morph({
         extent: pt(80, 60),
         fill: Color.transparent,
         setColor(c) {
            const [colorView, hashView] = this.submorphs,
                  [h,s,b] = c.toHSB();
            colorView.fill = c;
            hashView.textString = c.toHexString();
            hashView.fontColor = Color.hsb(h,s + .5 > 1 ? s - .5 : s + .5, b + .5 > 1 ? b - .5 : b + .5);
         },
         submorphs: [
            new Morph({fill: color, extent: pt(80, 50),
                       onMouseDown(evt) {
                           colorPalette.selectedColor = this.fill;
                           signal(colorPalette, "selectedColor", this.fill);
                           colorPalette.relayout();
                       }}),
            new Text({textString: `${h.toFixed()}, ${s.toFixed(2)}, ${b.toFixed(2)}`, fill: Color.transparent,
                      fontColor: Color.gray.darker(), bottomLeft: pt(0,50)})
         ]
     });
  }

  harmonies() {
     const colorPalette = this;
     return {
         name: "harmonies",
         layout: new TilingLayout({spacing: 5}),
         fill: Color.transparent,
         width: 260,
         update() {
             const [hue, saturation, brightness] = colorPalette.pivotColor.toHSB(),
                   colors = colorPalette.harmony.chord({hue, saturation, brightness});
             if (colors.length != this.submorphs.length) {
                this.submorphs = colors.map(c => colorPalette.colorField(c))
             } else {
                arr.zip(this.submorphs, colors)
                   .forEach(([f, c]) => {
                      f.setColor(c);
                });
             }
         }
     }
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
     const colorPalette = this;
     return this.getSubmorphNamed("harmonyVisualizer") || new Image({
         name: "harmonyVisualizer",
         extent: pt(110,110),
         fill: Color.transparent,
         imageUrl: WHEEL_URL,
         update() {
             const [harmonyPoints] = this.submorphs,
                   pivotControl = this.get("pivotControl"),
                   [hue, saturation, brightness] = colorPalette.pivotColor.toHSB(),
                   chord = colorPalette.harmony.chord({hue, saturation, brightness}),
                   colorPoints = chord.map(c => {
                      const [h,s,_] = c.toHSB(),
                             angle = num.toRadians(h);
                      return Point.polar(50 * s, angle);
                   });
             if (harmonyPoints.submorphs.length - 1 != colorPoints.length) {
                 harmonyPoints.submorphs = [...colorPoints.map(p => new Ellipse({
                        center: p, fill: Color.transparent, draggable: false, 
                        borderWidth: 1, borderColor: Color.black
                     })), pivotControl];
             } else {
                 arr.zip(harmonyPoints.submorphs, colorPoints).forEach(([m, p]) => {if (p) m.center = p});
                 pivotControl.update();
             }
         },
         submorphs: [new Ellipse({
            name: "harmonyPoints",
            draggable: false, 
            extent: pt(100,100),
            origin: pt(50,50),
            position: pt(50,50),
            fill: Color.transparent,
            borderWidth: 1,
            submorphs: [{
              name: "pivotControl",
              type: "ellipse",
              draggable: false,
              fill: Color.transparent,
              borderColor: Color.black,
              borderWidth: 3,
              extent: pt(18,18),
              update() {
                 const [h,s,_] = colorPalette.pivotColor.toHSB(),
                       angle = num.toRadians(h),
                       currentPos = Point.polar(50 * s, angle);
                 this.center = currentPos;
              },
              submorphs: [{
                type: "ellipse",
                fill: Color.transparent,
                borderColor: Color.white,
                onDrag: (evt) => {
                   var  [h,s,b] = colorPalette.pivotColor.toHSB(),
                         angle = num.toRadians(h),
                         currentPos = Point.polar(50 * s, angle),
                         newPos = currentPos.addPt(evt.state.dragDelta),
                         h = num.toDegrees(newPos.theta()),
                         h = h < 0 ? h + 360 : h,
                         s = Math.min(newPos.r()/50, 1);
                   colorPalette.pivotColor = Color.hsb(h, s, b);
                   colorPalette.relayout();
                },
                borderWidth: 3,
                center: pt(8,8),
                extent: pt(12,12)
              }]
          }]
         })]
     });
  }

  harmonySelector() {
     return this.getSubmorphNamed("harmonySelector") || new DropDownSelector({
         name: "harmonySelector", target: this, property: "harmony",
         values: {Complement: Complementary, 
                  Triadic: Triadic, 
                  Tetradic: Tetradic, 
                  Quadratic: Quadratic, 
                  Analogous: Analogous, 
                  Neutral: Neutral}
     });
  }

}

export class ColorPickerField extends Morph {

   constructor(props) {
      const {property, target} = props;
      super({
         property, target,
         extent: pt(70,30), layout: new HorizontalLayout(),
         borderRadius: 5, fill: Color.gray, clipMode: "hidden",
         borderWidth: 1, borderColor: Color.gray.darker(),
         ...props
      })
      const topRight = this.innerBounds().topRight(),
            bottomLeft = this.innerBounds().bottomLeft();

      this.submorphs = [
        {extent: pt(40,25), clipMode: "hidden", onMouseDown: (evt) => this.openPalette(evt),
         submorphs: [{
               name: "topLeft",
               extent: pt(70,70)
           }, {
               name: "bottomRight",
               extent: pt(70,80),
               origin: pt(35,0), topRight,
               rotation: num.toRadians(-45)
        }]},
        {fill: Color.transparent, extent: pt(25, 25), 
         onHoverIn() { this.fill = Color.black.withA(.2); },
         onHoverOut() { this.fill = Color.transparent; },
         submorphs: [{
          type: "image", imageUrl: WHEEL_URL, extent: pt(20,20), nativeCursor: "pointer",
          fill: Color.transparent, position: pt(3,3), onMouseDown: (evt) => this.openPicker(evt)}]}];

      this.update();
      connect(this.target, "onChange", this, "update");
   }

   update() {
      this.get("topLeft").fill = this.target[this.property];
      this.get("bottomRight").fill = this.target[this.property].withA(1);
   }

   async fadeIntoWorld(evt, widget) {
      const w = new Morph({extent: pt(400,310), fill: Color.transparent, submorphs: [widget]});
      w.openInWorldNearHand();
      w.adjustOrigin(w.innerBounds().topCenter());
      w.position = evt.position;
      w.scale = 0; w.opacity = 0;
      await w.animate({opacity: 1, scale: 1, duration: 300});
      this.world().addMorph(widget);
      w.remove();
      return widget;
   }

   async openPicker(evt) {
      const p = this.picker || new ColorPicker({
                    color: this.target[this.property]});
      connect(p, "color", this.target, this.property);
      connect(p, "color", this, "update");
      this.picker = await this.fadeIntoWorld(evt, p);
      this.palette && this.palette.remove();
   }

   async openPalette(evt) {
      const p = this.palette || new ColorPalette({
                    extent: pt(400,310), 
                    selectedColor: this.target[this.property]});
      connect(p, "selectedColor", this.target, this.property);
      connect(p, "selectedColor", this, "update");
      this.palette = await this.fadeIntoWorld(evt, p);
      this.picker && this.picker.remove();
   }
   
   remove() {
      super.remove();
      this.picker.remove();
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

   onMouseDown() { this.open() }

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
        {type: "text", textString: name, fontSize: 12, fontWeight: 'bold',
         fontColor: Color.black, padding: rect(5,0,0,0),
         fill: Color.transparent},
        controlElement
     ]}
  }

  createToggledControl({title, render, target, property}) {
    if (!target || !property) throw Error("Please pass property AND target to toggled control.");
    const toggler = new CheckBox({checked: target[property]}),
          flap = new Morph({
            clipMode: "hidden",
            fill: Color.transparent,
            draggable: true, onDrag: (evt) =>  this.onDrag(evt),
            layout: new VerticalLayout({spacing: 5}),
            toggle(value) {
                if (value) {
                    value = this.memoizedValue || value;
                } else {
                    this.memoizedValue = target[property];
                }
                target[property] = value;
                const [title] = this.submorphs,
                      controls =  render(target[property]);
                this.submorphs = [title, ...controls ? [controls] : []];
            },
            submorphs: [
              {fill: Color.transparent, layout: new HorizontalLayout(),
               submorphs: [
                {type: "text", textString: title, fontSize: 12, fontWeight: "bold",
                 fontColor: Color.black, padding: rect(5,0,0,0),
                 fill: Color.transparent},
                toggler]}
           ]});

     connect(toggler, "toggle", flap, "toggle");
     flap.toggle(target[property]);
     return flap;
  }


}

export class BodyStyleEditor extends StyleEditor {

   controls(target) {
       return [
           this.fillControl(target),
           this.opacityControl(target),
           this.shadowControl(target)
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
     return this.createToggledControl({
          title: "Drop Shadow",
          target: this.target, property: "dropShadow",
          render: (value) => {
             if (!value) return null;
             const distanceInspector = new PropertyInspector({
                  name: "distanceSlider",
                  min: 0, target: value,
                  property: "distance"
             }),
             angleSlider = new PropertyInspector({
                  name: "angleSlider",
                  min: 0, max: 360,
                  target: value,
                  property: "rotation"
             }),
             blurInspector = new PropertyInspector({
                 name: "blurSlider",
                 min: 0, target: value,
                 property: "blur"
             });
             const control = new Morph({
                  width: 150, height: 120, fill: Color.transparent,
                  layout: new GridLayout({
                      autoAssign: false,
                      fitToCell: false,
                      grid: [
                      ["distanceLabel", null, "distanceSlider"],
                      ["blurLabel", null, "blurSlider"],
                      ["angleLabel", null, "angleSlider"],
                      ["colorLabel", null, "colorPicker"]]}),
                  submorphs: [
                    {type: "label", value: "Distance: ", padding: 4, name: "distanceLabel"}, distanceInspector,
                    {type: "label", value: "Blur: ", padding: 4, name: "blurLabel"}, blurInspector,
                    {type: "label", value: "Angle: ", padding: 4, name: "angleLabel"}, angleSlider,
                    {type: "label", value: "Color: ", padding: 4, name: "colorLabel"},
                    new ColorPickerField({
                         target: value,
                         name: "colorPicker",
                         property: "color"
                    })]
               });
             control.layout.col(0).paddingLeft = 5;
             control.layout.row(0).paddingBottom = 5;
             control.layout.row(1).paddingBottom = 5;
             control.layout.row(2).paddingBottom = 5;
             control.layout.row(3).paddingBottom = 5;
             return control;
          }
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
             submorphs: [new DropDownSelector({target, isHaloItem: true, property: "borderStyle", values: ["solid", "dashed", "dotted"]}),
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

   openLayoutMenu(evt) {
     if (this.layoutHalo) return;
     var items = this.getLayoutObjects().map(l => {
       return [this.getLayoutName(l),
         () => {
             const p = this.getSubmorphNamed("layoutPicker");
             this.target.animate({layout: l,
                                  easing: "easeOutQuint"});
             p.textString = this.getLayoutName(l);
             p.fitIfNeeded();
             this.update();
         }]
       });
     var menu = this.world().openWorldMenu(evt, items);
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
          onMouseDown: (evt) => this.openLayoutMenu(evt)
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
