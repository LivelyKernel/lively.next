import {Window, Morph, Text, VerticalLayout, 
        GridLayout, HorizontalLayout, FillLayout} from "../../index.js";
import {pt, Color, LinearGradient} from "lively.graphics";
import {signal, connect, disconnect} from "lively.bindings";
import {Slider} from "../../widgets.js";
import {obj, num} from "lively.lang";
import {ColorPalette} from "./color-palette.js";
import {Icon} from "../../icons.js";

const WHEEL_URL = 'https://www.sessions.edu/wp-content/themes/divi-child/color-calculator/wheel-5-ryb.png'

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
        {extent: pt(40,25), clipMode: "hidden",
         onMouseDown: (evt) => this.openPalette(evt),
         onHoverIn() {
            this.get("dropDownIndicator").animate({opacity: 1, duration: 300});
         },
         onHoverOut() {
            this.get("dropDownIndicator").animate({opacity: 0, duration: 300});
         },
         submorphs: [{
               name: "topLeft",
               extent: pt(70,70)
           }, {
               name: "bottomRight",
               extent: pt(70,80),
               origin: pt(35,0), topRight,
               rotation: num.toRadians(-45)
        }, Icon.makeLabel("chevron-down", {
               opacity: 0,
               name: "dropDownIndicator",
               center: pt(30,12.5)
          })]},
        {fill: Color.transparent, extent: pt(25, 25),
         onHoverIn() { this.fill = Color.black.withA(.2); },
         onHoverOut() { this.fill = Color.transparent; },
         submorphs: [{
          type: "image", imageUrl: WHEEL_URL, extent: pt(20,20), nativeCursor: "pointer",
          fill: Color.transparent, position: pt(3,3), onMouseDown: (evt) => this.openPicker(evt)}]}];
      this.update();
      connect(this.target, "onChange", this, "update");
   }

   onHoverIn() {
      if (!this.palette) 
          this.palette = new ColorPalette({
                    extent: pt(400,310),
                    color: this.targetProperty});
   }

   onKeyDown(evt) {
      if (evt.key == "Escape") {
         this.picker && this.picker.remove();
         this.palette && this.palette.remove();
      }
   }

   get targetProperty() {
      const v  = this.target[this.property];
      if (v && v.isGradient) return Color.blue
      return v;
   }

   set targetProperty(v) {
      this.target[this.property] = v;
   }

   update() {
      this.get("topLeft").fill = this.targetProperty;
      this.get("bottomRight").fill = this.targetProperty.withA(1);
   }

   async openPicker(evt) {
      const p = this.picker || new ColorPicker({
                    color: this.targetProperty});
      p.position = pt(0,0);
      connect(p, "color", this.target, this.property);
      connect(p, "color", this, "update");
      this.picker = await p.fadeIntoWorld(this.globalBounds().bottomCenter());
      this.palette && this.palette.remove();
   }

   async openPalette(evt) {
      const p = this.palette || new ColorPalette({
                    extent: pt(400,310),
                    color: this.targetProperty});
      p.position = pt(0,0);
      connect(p, "color", this.target, this.property);
      connect(p, "color", this, "update");
      this.palette = await p.fadeIntoWorld(this.globalBounds().bottomCenter());
      this.picker && this.picker.remove();
   }

   remove() {
      super.remove();
      this.picker && this.picker.remove();
      this.palette && this.palette.remove();
      disconnect(this.target, "onChange", this, "update");
   }

}

export class ColorPicker extends Window {

  constructor(props) {
    this.color = props.color || Color.blue;
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
     if (evt.key == "Escape") { 
         this.close();
     }
  }

  close() {
     super.close();
     signal(this, 'close');
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
        fill: new LinearGradient({stops: [
                                  {color: Color.white, offset: 0},
                                  {color: Color.transparent, offset: 1}],
                                  vector: "eastwest"})
      },{
        borderRadius: 3,
        name: "light",
        fill: new LinearGradient({stops: [
                                  {color: Color.black, offset: 0},
                                  {color: Color.transparent, offset: 1}],
                                  vector: "southnorth"}),
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
        fill: new LinearGradient({
         stops: [{color: Color.rgb(255,0,0), offset: 0},
                {color: Color.rgb(255,255,0), offset: 0.17},
                {color: Color.limeGreen, offset: 0.33},
                {color: Color.cyan, offset: 0.50},
                {color: Color.blue, offset: 0.66},
                {color: Color.magenta, offset: 0.83},
                {color: Color.rgb(255,0,0), offset: 1}],
         vector: "northsouth"}),
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
