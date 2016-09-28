import { Window, GridLayout, FillLayout, Ellipse, Text,  
         VerticalLayout, HorizontalLayout, Morph } from "../index.js";
import { Color, LinearGradient, pt } from "lively.graphics";
import { obj, num } from "lively.lang";

export class ColorPicker extends Window {
  
  constructor(props) {
    this.color = props.color || Color.blue;
    super({
      ...props,
      title: "Color Picker",
      targetMorph: this.colorPalette()
    });
    this.update();
  }
  
  get pickerPosition() {
    // translate the hsv of color to a position
    const [_, s, b] = this.color.toHSB();
    return pt(this.getSubmorphNamed("hue").width * s,
              this.getSubmorphNamed("hue").height * (1 - b))
  }
  
  set pickerPosition({x: light, y: dark}) {
    // translate the pos to a new hsv value
    var [h, s, b] = this.color.toHSB(),
        {width, height} = this.getSubmorphNamed("hue"),
        s = Math.max(0, Math.min(light / width, 1)),
        b = Math.max(0, Math.min(1 - (dark / height), 1));
    this.color = Color.hsb(h, s, b);
    this.update();
  }
  
  get scalePosition() {
    var [h, _, _] = this.color.toHSB();
    return pt(this.getSubmorphNamed("scale").width / 2, this.getSubmorphNamed("hueGradient").height * (h / 360)); 
  }
  
  set scalePosition(pos) {
    console.log(pos.y / this.getSubmorphNamed("hueGradient").height)
    const [_, s, b] = this.color.toHSB(),
          h = Math.max(0, Math.min((pos.y / this.getSubmorphNamed("hueGradient").height) * 360, 359));
    this.color = Color.hsb(h, s, b);
    this.update();
  }
  
  update() {
    this.getSubmorphNamed("field").update(this);
    this.getSubmorphNamed("colorViewer").update(this);
    this.getSubmorphNamed("picker").update(this);
    this.getSubmorphNamed("slider").update(this);
    //this.getSubmorphNamed("harmonies").update(this);
    this.getSubmorphNamed("hashViewer").update(this);
    this.getSubmorphNamed("hsbViewer").update(this);
    this.getSubmorphNamed("rgbViewer").update(this);
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
        const [h, s, b] = colorPicker.color.toHSB();
        this.getSubmorphNamed("hue").fill = Color.hsb(h, 1, 1)
      },
      submorphs: [{
        name: "hue",
        fill: this.color
      },{
        name: "shade",
        fill: new LinearGradient([{color: Color.white, offset: "0%"},
                                  {color: Color.transparent, offset: "100%"}], 
                                  "eastwest")
      },{
        name: "light",
        fill: new LinearGradient([{color: Color.black, offset: "0%"},
                                  {color: Color.transparent, offset: "100%"}],
                                  "southnorth"),
        onMouseDown: (evt) => {
          this.pickerPosition = evt.positionIn(this.getSubmorphNamed("light"));
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
        fill: new LinearGradient([
          {color: Color.rgb(255,0,0), offset: "0%"},
          {color: Color.rgb(255,255,0), offset: "17%"},
          {color: Color.limeGreen, offset: "33%"},
          {color: Color.cyan, offset: "50%"},
          {color: Color.blue, offset: "66%"},
          {color: Color.magenta, offset: "83%"}], 
         "northsouth"),
        onMouseDown: (evt) => {
          this.scalePosition = pt(0, evt.positionIn(this.getSubmorphNamed("hueGradient")).y);
        }
      },{
        name: "slider",
        height: 10,
        width: 50,
        borderRadius: 3,
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
          textString: obj.safeToString(value), 
          fixedWidth: true})]
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
        extent: pt(80,40),
        name: "colorViewer",
        fill: this.color,
        update(colorPicker) { this.fill = colorPicker.color }
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