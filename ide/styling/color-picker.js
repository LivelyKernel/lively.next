import {
  Morph, Text, Icon, Window,
  VerticalLayout,
  GridLayout,
  HorizontalLayout
} from "../../index.js";
import {pt, Rectangle, Color, LinearGradient, rect} from "lively.graphics";
import {signal, connect, disconnect} from "lively.bindings";
import {Slider} from "../../components/widgets.js";
import { obj } from "lively.lang";
import {ColorPalette} from "./color-palette.js";
import { StyleSheet } from '../../style-rules.js';
import { zip } from "lively.lang/array.js";
import { Popover } from "./style-popover.js";

const WHEEL_URL = 'https://www.sessions.edu/wp-content/themes/divi-child/color-calculator/wheel-5-ryb.png'

export class ColorPickerField extends Morph {

   static get properties() {
     return {
      colorValue: {
        set(v) {
          if (!(v && v.isColor)) {
            v = Color.blue;
          }
          this.setProperty('colorValue', v);
        }
      },
      styleSheets: {
        initialize() {
          this.styleSheets = new StyleSheet({
            '.ColorPickerField': {
              extent: pt(70,30), 
              layout: new HorizontalLayout(),
              borderRadius: 5, fill: Color.gray, clipMode: "hidden",
              borderWidth: 1, borderColor: Color.gray.darker(),
            },
            '[name=pickerButton]': {
              extent: pt(20, 20),
              nativeCursor: "pointer",
              fill: Color.transparent,
              position: pt(3, 3),
            }
          })  
        }
      },
      submorphs: {
        initialize() {
          const topRight = this.innerBounds().topRight(),
                bottomLeft = this.innerBounds().bottomLeft(),
                colorFieldExtent = pt(40, 25);

          this.submorphs = [
            {
              extent: colorFieldExtent,
              clipMode: "hidden",
              name: 'paletteButton',
              onHoverIn() {
                this.get("dropDownIndicator").animate({opacity: 1, duration: 300});
              },
              onHoverOut() {
                this.get("dropDownIndicator").animate({opacity: 0, duration: 300});
              },
              submorphs: [
                {
                  name: "topLeft",
                  extent: colorFieldExtent,
                  fill: this.colorValue
                },
                {
                  name: "bottomRight",
                  type: "polygon",
                  extent: colorFieldExtent,
                  fill: this.colorValue.withA(1),
                  origin: pt(0, 0),
                  vertices: [pt(0, 0), colorFieldExtent.withX(0), colorFieldExtent]
                },
                Icon.makeLabel("chevron-down", {
                  opacity: 0,
                  name: "dropDownIndicator",
                  center: pt(30, 12.5)
                })
              ]
            },
            {
              fill: Color.transparent,
              extent: pt(25, 25),
              onHoverIn() {
                this.fill = Color.black.withA(0.2);
              },
              onHoverOut() {
                this.fill = Color.transparent;
              },
              submorphs: [
                {
                  name: 'pickerButton',
                  type: "image",
                  autoResize: false,
                  imageUrl: WHEEL_URL,
                }
              ]
            }
          ];
          connect(this.getSubmorphNamed('pickerButton'), 'onMouseDown', this, 'openPicker');
          connect(this.getSubmorphNamed('paletteButton'), 'onMouseDown', this, 'openPalette');
          connect(this, 'remove', this, 'removeWidgets');
        }
      }
     }
   }

  onHoverIn() {
    if (!this.palette)
      this.palette = new Popover({
        name: "Color Palette",
        targetMorph: new ColorPalette({color: Color.red})
      });
  }
  
   onKeyDown(evt) {
      if (evt.key == "Escape") {
         this.picker && this.picker.remove();
         this.palette && this.palette.remove();
      }
   }

  update(color) {
    this.colorValue = color;
    this.get("topLeft").fill = color;
    this.get("bottomRight").fill = color.withA(1);
  }

  async openPicker(evt) {
    const p = this.picker || new ColorPicker({color: this.colorValue});
    p.position = pt(0, -p.height / 2);
    connect(p, "color", this, "update");
    this.picker = await p.fadeIntoWorld(this.globalBounds().bottomCenter());
    this.removePalette();
  }

   removePicker() {
      this.picker && this.picker.remove();
   }

  async openPalette(evt) {
    const p =
      this.palette ||
      new Popover({
        name: "Color Palette", 
        targetMorph: new ColorPalette({color: this.colorValue})
      });
    connect(p.targetMorph, "color", this, "update");
    p.topLeft = pt(0,0);
    p.isLayoutable = false; 
    this.palette = await p.fadeIntoWorld(this.globalBounds().insetBy(10).bottomCenter());
    this.removePicker();
  }
  
   removePalette() {
     this.palette && this.palette.remove();
   }

   removeWidgets() {
      this.removePalette();
      this.removePicker();
   }

}

class FieldPicker extends Morph {

   static get properties() {
     return {
       fill: {defaultValue: Color.transparent},
       saturation: {defaultValue: 0},
       brightness: {defaultValue: 0},
       pickerPosition: {
        derived: true,
        after: ['submorphs', 'brightness', 'saturation'],
        get() {
          // translate the hsv of color to a position
          const s = this.saturation, b = this.brightness;
          if (s === undefined || b === undefined) return pt(0,0);
          return pt(this.getSubmorphNamed("hue").width * s,
                    this.getSubmorphNamed("hue").height * (1 - b))
        },
        set({x: light, y: dark}) {
          // translate the pos to a new hsv value
          var {width, height} = this.getSubmorphNamed("hue");
          this.saturation = Math.max(0, Math.min(light / width, 1));
          this.brightness = Math.max(0, Math.min(1 - (dark / height), 1));
          signal(this, 'saturation', this.saturation);
          signal(this, 'brightness', this.brightness);
        }
      },
       submorphs: {
         initialize() {
           this.submorphs = [
             {borderRadius: 3,
              name: "hue",
              reactsToPointer: false},
             {borderRadius: 3,
              name: "shade",
              reactsToPointer: false,
              fill: new LinearGradient({stops: [
                                        {color: Color.white, offset: 0},
                                        {color: Color.transparent, offset: 1}],
                                        vector: "eastwest"})},
             {borderRadius: 3,
              name: "light",
              reactsToPointer: false,
              fill: new LinearGradient({stops: [
                                        {color: Color.black, offset: 0},
                                        {color: Color.transparent, offset: 1}],
                                        vector: "southnorth"})},
             {name: "picker",
              type: "ellipse",
              reactsToPointer: false,
              fill: Color.transparent,
              borderColor: Color.black,
              borderWidth: 3,
              extent: pt(16,16),
              submorphs: [{
                type: "ellipse",
                fill: Color.transparent,
                borderColor: Color.white,
                reactsToPointer: false,
                borderWidth: 3,
                center: pt(8,8),
                extent: pt(12,12)
              }]
            }];
           connect(this, 'extent', this, 'relayout');
         }
       }
     }
   }

   update(colorPicker) {
     this.getSubmorphNamed("hue").fill = Color.hsb(colorPicker.hue, 1, 1);
     this.brightness = colorPicker.brightness;
     this.saturation = colorPicker.saturation;
     this.get('picker').center = this.pickerPosition;
   }

   onMouseDown(evt) {
     this.pickerPosition = evt.positionIn(this);
     signal(this, 'pickerPosition', this.pickerPosition);
   }
   
   onDrag(evt) {
     this.pickerPosition = evt.positionIn(this);
   }
   
   relayout() {
     const bounds = this.innerBounds();
     this.getSubmorphNamed('hue').setBounds(bounds);
     this.getSubmorphNamed('shade').setBounds(bounds);
     this.getSubmorphNamed('light').setBounds(bounds);
   }
}

class ColorPropertyView extends Text {

  static get properties() {
    return {
       update: {}, 
       value: {
         derived: [true],
         set(v) {
           this.textString = obj.safeToString(v);
         },
         get() {
           return this.textString;
         }
       },
       styleClasses: {
         after: ['readOnly'],
         initialize() {
           this.styleClasses = [!this.readOnly && 'editable', 'value'];
         }
       },
       selectionColor: {defaultValue: Color.gray.darker()}
    }
  }
  
  onFocus() {
    this.get('keyLabel').styleClasses = ['key', ...!this.readOnly ? ['large', 'active'] : []];
    this.styleClasses = [...!this.readOnly ? ['editable', 'active'] : [], 'value'];
    this.selection.cursorBlinkStart();
  }
  
  onBlur() {
    this.get('keyLabel').styleClasses = [!this.readOnly && 'large', 'key'];
    this.styleClasses = [!this.readOnly && 'editable', 'value'];
    this.selection.uninstall();
  }
  
  onKeyDown(evt) {
    if ("Enter" == evt.keyCombo && !this.readOnly) {
       this.owner.focus(); 
       evt.stop();
       signal(this, 'updateValue', this.value);
    } else {
       super.onKeyDown(evt);
    }
  }
}

class HuePicker extends Morph {

  static get properties() {
    return {
      fill: {defaultValue: new LinearGradient({
               stops: [{color: Color.rgb(255,0,0), offset: 0},
                      {color: Color.rgb(255,255,0), offset: 0.17},
                      {color: Color.limeGreen, offset: 0.33},
                      {color: Color.cyan, offset: 0.50},
                      {color: Color.blue, offset: 0.66},
                      {color: Color.magenta, offset: 0.83},
                      {color: Color.rgb(255,0,0), offset: 1}],
               vector: "northsouth"})},
      borderRadius: {defaultValue: 3},
      hue: {defaultValue: 0},
      sliderPosition: {
          derived: true,
          after: ['submorphs'],
          get() {
           return pt(this.width / 2, this.height * (this.hue / 360));
          },
          set(pos) {
            this.hue = Math.max(0, Math.min((pos.y / this.height) * 360, 359));
            signal(this, 'hue', this.hue);
          }
      },
      submorphs: {
        initialize() {
          this.submorphs = [{
            name: "slider",
            height: 10,
            width: 50,
            borderRadius: 3,
            reactsToPointer: false,
            nativeCursor: "ns-resize",
            borderColor: Color.black,
            fill: Color.transparent,
            borderWidth: 2
          }];
        }
      }
    }
  } 

  onMouseDown(evt) {
     this.sliderPosition = pt(0, evt.positionIn(this).y);
  }
  
  onDrag(evt) {
     this.sliderPosition = pt(0, evt.positionIn(this).y);
  }

  update(colorPicker) {
    this.hue = colorPicker.hue;
    this.get('slider').center = this.sliderPosition;
  }
  
}

class ColorDetails extends Morph {

  static get properties() {
    return {
      color: {defaultValue: Color.blue},
      width: {defaultValue: 80},
      fill: {defaultValue: Color.transparent},
      layout: {initialize() {this.layout = new VerticalLayout({spacing: 9})}},
      submorphs: {
        after: ['color'],
        initialize() {
          this.submorphs = [{
            type: "ellipse",
            extent: pt(50,50),
            name: "colorViewer",
            fill: this.color,
          },
          this.hashViewer(),
          {type: 'label', name: 'R', 
           autofit: true,
           padding: rect(10,0,0,0),
           styleClasses: ['ColorPropertyView']}];
          this.update(this);
        }
      }
    }
  }

   update({color}) { 
     const [r, g, b] = color.toTuple8Bit(),
           [h, s, v] = color.toHSB();
     this.get('colorViewer').fill = color;
     this.get('hashViewer').value = color.toHexString();
     this.get('R').value = `R ${r.toFixed(0)}\n\nG ${g.toFixed(0)}\n\nB ${b.toFixed(0)}\n\nH ${h.toFixed(0)}\n\nS ${s.toFixed(2)}\n\nV ${v.toFixed(2)}`
   }

   keyValue({name, key, value, update, editable}) {
    return new Morph({
      fill: Color.transparent,
      layout: new HorizontalLayout({spacing: 5}),
      submorphs: [
        {type: 'label', name: "keyLabel", styleClasses: [editable && 'large', 'key'], value: key},
        new ColorPropertyView({name: name || key, readOnly: !editable, value, update})]
    })
  }

  hashViewer() {
    let hashViewer = this.keyValue({
      name: "hashViewer",
      key: "#",
      editable: true,
      value: this.color.toHexString()
    });
    connect(hashViewer.get('hashViewer'), 'updateValue', this, 'color', {
       converter: (v) => Color.rgbHex(v), varMapping: {Color}})
    return hashViewer;
  }

  rgbViewer() {
    const [r, g, b] = this.color.toTuple8Bit();
    return new Morph({
      name: "rgbViewer",
      fill: Color.transparent,
      submorphs: [this.keyValue({key: "R", value: r.toFixed()}),
                  this.keyValue({key: "G", value: g.toFixed()}),
                  this.keyValue({key: "B", value: b.toFixed()})]
    })
  }

  hsbViewer() {
    const [h, s, b] = this.color.toHSB();
    return new Morph({
      name: "hsbViewer",
      fill: Color.transparent,
      submorphs: [this.keyValue({key: "H", value: h.toFixed()}),
                  this.keyValue({key: "S", value: s.toFixed(2)}),
                  this.keyValue({key: "V", value: b.toFixed(2)})]
    })
  }

}

export class ColorPicker extends Window {

  static get properties() {
    return {
      extent: {defaultValue: pt(400, 320)},
      fill: {defaultValue: Color.black.withA(.7)},
      isHaloItem: {defaultValue: true},
      borderWidth: {defaultValue: 0},
      color: {
        defaultValue: Color.blue,
        derived: true,
        after: ['submorphs', 'targetMorph'],
        get() { return Color.hsb(this.hue, this.saturation, this.brightness).withA(this.alpha) },
        set(c) {
          const [h, s, b] = c.toHSB();
          this.hue = h
          this.saturation = s;
          this.brightness = b;
          this.alpha = c.a;
        }
      },
      alpha: {
        after: ['submorphs', 'targetMorph'],
        set(a) {
          this.setProperty("alpha", a);
          this.update();
        },
      },
      saturation: {
      
      },
      brightness: {
        set(b) {
          this.setProperty('brightness', b);
          this.update();
        }
      },
      hue: {
        after: ['targetMorph'],
        set(h) {
          this.setProperty('hue', h);
          this.update();
        }
      },
      targetMorph: {
        initialize() {
          this.targetMorph = this.colorPalette();
          this.titleLabel().fontColor = Color.gray;
          this.whenRendered().then(() => this.update());
        }
      },
      styleSheets: {
        initialize() {
          this.styleSheets = new StyleSheet({
              ".ColorPicker .key": {
                fill: Color.transparent,
                fontColor: Color.gray,
                fontWeight: "bold"
              },
              ".ColorPicker.Window": {
                fill: Color.black.withA(0.7),
                borderColor: Color.gray.darker()
              },
              ".ColorPicker .large": {fontSize: 20},
              ".ColorPicker .active": {fontColor: Color.orange, borderColor: Color.orange},
              ".ColorPicker .ColorPropertyView": {
                fill: Color.transparent,
                fontColor: Color.gray.lighter()
              },
              ".ColorPicker .editable": {
                borderRadius: 4,
                borderWidth: 1,
                padding: rect(2, 2, 2, 2),
                borderColor: Color.gray.lighter()
              }
            });
        }
      }
    }
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
  
  update() {
     this.get('field picker').update(this);
     this.get('hue picker').update(this);
     this.get('details').update(this);
     this.get('alpha slider').update(this);
     // would be better if this.color is the canonical place
     // rms: as long as lively.graphics/color loses the hue information
     //      when lightness or saturation drop to 0, this.color can not serve
     //      as the canonical place but only as a getter for the morph that retrieves
     //      the picker's color.
     signal(this, "color", this.color);
  }
  
  colorPalette() {
    let colorDetails = this.colorDetails(),
        fieldPicker = this.fieldPicker(),
        huePicker = this.huePicker(),
        alphaSlider = this.alphaSlider(),
        colorPalette = new Morph({
          name: "colorPalette",
          width: this.width,
          fill: Color.transparent,
          draggable: false,
          layout: new GridLayout({
            autoAssign: false,
            rows: [1, {fixed: 30}],
            columns: [0, {paddingLeft: 10}, 
                      1, {fixed: 55, paddingLeft: 10, paddingRight: 5}, 
                      2, {fixed: 100}],
            groups: {"field picker": {alignedProperty: 'position'},
                     "hue picker": {alignedProperty: 'position'}},
            grid: [["field picker", "hue picker", "details"],
                   ["alphaSlider", "alphaSlider", "alphaSlider"]]}),
            submorphs: [fieldPicker, huePicker, colorDetails, alphaSlider]
        })
    connect(fieldPicker, 'brightness', this, 'brightness');
    connect(fieldPicker, 'saturation', this, 'saturation');
    connect(huePicker, 'hue', this, 'hue');
    return colorPalette;
  }
  
  alphaSlider() {
    return {
      name: "alphaSlider",
      fill: Color.transparent,
      layout: new HorizontalLayout({spacing: 3}),
      submorphs: [
        {
          type: "label",
          padding: Rectangle.inset(3),
          value: "Alpha",
          fontColor: Color.gray,
          fontWeight: "bold"
        },
        new Slider({
          name: 'alpha slider',
          target: this,
          min: 0,
          max: 1,
          property: "alpha",
          width: 170
        })
      ]
    };
  }
  
  fieldPicker() {
    return new FieldPicker({
        name: 'field picker', 
        saturation: this.saturation,
        brightness: this.brightness
      });
  }
  
  huePicker() {
    return new HuePicker({name: "hue picker", hue: this.hue});
  }
  
  colorDetails() {
    return new ColorDetails({name: "details", color: this.color})
  }

}
