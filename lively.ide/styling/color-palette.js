import { Color, rect, Complementary, Triadic, Tetradic,
         Quadratic, Analogous, Neutral, pt, Point,
         flatDesignColors, materialDesignColors, webSafeColors } from "lively.graphics";
import { Morph, CustomLayout, VerticalLayout, HorizontalLayout,
         Text, TilingLayout, Ellipse, Image, StyleSheet} from "lively.morphic";
import { DropDownSelector, ModeSelector, Slider } from "lively.components/widgets.js";
import { connect, signal } from "lively.bindings";
import { num, arr } from "lively.lang";
import { SnapLayout } from "lively.morphic/layout.js";

const WHEEL_URL = '/lively.ide/assets/color-wheel.png'

const duration = 200;

class ColorPaletteField extends Morph {

  static get properties() {
    return {
      color: {defaultValue: Color.blue},
      borderWidth: { defaultValue: 2 },
      borderColor: {
        after: ['color'],
        initialize() {
          this.borderColor = this.color || Color.transparent;
        }
      },
      fill: {
        after: ['color'],
        initialize() {
          this.fill = this.color || Color.transparent;
        }
      },
      styleClasses: {
        after: ['color'],
        initialize() {
           this.styleClasses = this.color ? ['colorField'] : ['vacantColorField'];
        }
      }
    }
  }

  onHoverIn() {
    if (!this.color) return;
    const [h,s,b] = this.color.toHSB();
    this.borderColor = Color.hsb(h,s + .5 > 1 ? s - .5 : s + .5, b + .5 > 1 ? b - .5 : b + .5)
  }
  onHoverOut() {
    this.borderColor = Color.transparent;
  }
  onMouseDown() {
    signal(this, "updateColor", this.color);
  }

}

class ColorHarmonyField extends Morph {

  static get properties() {
    return {
         extent: {defaultValue: pt(80, 60)},
         fill: {defaultValue: Color.transparent},
         master: {
           initialize() {
             this.master = {
               auto: 'styleguide://SystemWidgets/color harmony field'    
             }
           }
         },
         color: {
           set(c) {
              const [colorView, hashView] = this.submorphs,
                    [h,s,b] = c ? c.toHSB() : [];
              this.setProperty('color', c);
              if (!c) return;
              if (colorView && hashView) {
                colorView.fill = c;
                hashView.textString = c.toHexString();
                hashView.fontColor = Color.hsb(h,s + .5 > 1 ? s - .5 : s + .5, b + .5 > 1 ? b - .5 : b + .5);
              }
           }
         },
         submorphs: {
           after: ['color'],
           initialize() {
             let [h,s,b] = (this.color || Color.transparent).toHSB();
             this.submorphs = [
                new Morph({fill: this.color, extent: pt(80, 50)}),
                new Text({textString: `${h.toFixed()}, ${s.toFixed(2)}, ${b.toFixed(2)}`,
                          fill: Color.transparent, fontColor: Color.gray.darker(),
                          bottomLeft: pt(0,50)})
             ];
           }
         }
     }
  }

  onMouseDown() {
    signal(this, "updateColor", this.color);
  }

}

class HarmonyDisplay extends Morph {

  update(colorPalette) {
    const [hue, saturation, brightness] = colorPalette.pivotColor.toHSB(),
         colors = colorPalette.harmony.chord({hue, saturation, brightness});
    if (colors.length != this.submorphs.length) {
      this.submorphs = colors.map(c => {
         let f = new ColorHarmonyField({color: c});
         connect(f, 'updateColor', colorPalette, 'color');
         return f;
     })
    } else {
      arr.zip(this.submorphs, colors)
         .forEach(([f, c]) => {
            f.color = c;
      });
    }
  }

}

class PivotColorControl extends Ellipse {

  static get properties() {
    return {
      pivotColor: { defaultValue: Color.blue },
      draggable: { defaultValue: true },
    }
  }

  update(colorPalette) {
    this.pivotColor = colorPalette.pivotColor;
  }

  onDrag(evt) {
     var  [h,s,b] = this.pivotColor.toHSB(),
           angle = num.toRadians(h),
           currentPos = Point.polar(50 * s, angle),
           newPos = currentPos.addPt(evt.state.dragDelta),
           h = num.toDegrees(newPos.theta()),
           h = h < 0 ? h + 360 : h,
           s = Math.min(newPos.r()/50, 1);
     this.pivotColor = Color.hsb(h, s, b);
  }

}

class HarmonyVisualizer extends Image {

  static get properties() {
    return {
     styleClasses: {defaultValue: ['harmonyVisualizer']},
     submorphs: {
       initialize() {
         this.submorphs = [{
            type: "ellipse",
            name: "harmonyPoints",
            submorphs: [new PivotColorControl({name: 'pivot control'})]
         }];
       }
     }
    }
  }

  update(colorPalette) {
     const [harmonyPoints] = this.submorphs,
           pivotControl = this.get("pivot control"),
           [hue, saturation, brightness] = colorPalette.pivotColor.toHSB(),
           angle = num.toRadians(hue),
           chord = colorPalette.harmony.chord({hue, saturation, brightness}),
           colorPoints = chord.map(c => {
              const [h,s,_] = c.toHSB(),
                     angle = num.toRadians(h);
              return Point.polar(50 * s, angle);
           });
     harmonyPoints.fill = Color.black.withA(1 - brightness);
     pivotControl.update(colorPalette);
     if (harmonyPoints.submorphs.length - 1 != colorPoints.length) {
         harmonyPoints.submorphs = [...colorPoints.map(p => new Ellipse({
                center: p, fill: Color.transparent, draggable: false,
                borderWidth: 1, borderColor: Color.black
             })), pivotControl];
     } else {
         arr.zip(harmonyPoints.submorphs, colorPoints).forEach(([m, p]) => {if (p) m.center = p});
         pivotControl.center = Point.polar(50 * saturation, angle);
     }
  }

}

class HarmonyPalette extends Morph {

  static get properties() {
    return {
      harmony: {defaultValue: new Complementary()},
      pivotBrightness: {defaultValue: 1},
      master: {
        initialize() {
          this.master = {
            auto: 'styleguide://SystemWidgets/harmony palette'
          }
        }
      },
      submorphs: {
        after: ['harmony'],
        initialize() {
          this.submorphs = [
             new HarmonyDisplay({name: "harmonies"}),
             this.harmonyControl()]
        }
      }
    }
  }

  update(colorPalette) {
    if (this.updateInProgress) return;
    this.updateInProgress = true;
    this.pivotBrightness = colorPalette.pivotBrightness;
    this.harmony = colorPalette.harmony;
    this.get('harmonies').update(colorPalette);
    this.get('harmony visualizer').update(colorPalette);
    this.updateInProgress = false;
  }

  harmonyControl() {
    var selector,
        slider,
        controls = new Morph({
         name: "harmonyControl",
         submorphs: [new HarmonyVisualizer({name: "harmony visualizer"}),
                     slider = new Slider({
                       min: 0, max: 1, tooltip: "Adjust Brightness",
                       width: 100, value: this.pivotBrightness
                     }),
                     selector = new DropDownSelector({
                       name: "harmonySelector", isHaloItem: true,
                       padding: 4,
                       selectedValue: this.harmony,
                       getCurrentValue() { return this.selectedValue.name },
                       values: {Complement: new Complementary(),
                                Triadic: new Triadic(),
                                Tetradic: new Tetradic(),
                                Quadratic: new Quadratic(),
                                Analogous: new Analogous(),
                                Neutral: new Neutral()}
                   })]
     });
    connect(slider, "value", this,  "pivotBrightness");
    connect(selector, 'selectedValue', this, 'harmony');
    return controls;
  }
}

// new ColorPalette({ color: Color.red }).openInWorld()

export class ColorPalette extends Morph {

   static get properties() {
     return {
       extent: {defaultValue: pt(200, 300) },
       colorPalette: {
         after: ['submorphs'],
         defaultValue: "flatDesign",
         set(paletteName) {
           this.setProperty('colorPalette', paletteName);
           this.switchPalette(this.getColorsFor(paletteName));
           this.updatePaletteDescription();
         }
       },
       pivotColor: {
         after: ['submorphs'],
         set(c) {
           this.setProperty('pivotColor', c)
           this.get('harmony palette').update(this);
         }
       },
       color: {
         set(c) {
           this.setProperty('color', c);
           this.get('harmony palette') && this.get('harmony palette').update(this);
         }
       },
       pivotBrightness: {
         after: ['submorphs', 'color'],
         get() {
            const [h,s,b] = (this.pivotColor || this.color).toHSB();
            return b;
         },
         set(b) {
            const [h,s] = (this.pivotColor || this.color).toHSB();
            this.pivotColor = Color.hsb(h,s,b);
         }
       },
       harmony: {
         after: ['submorphs', 'pivotColor'],
         defaultValue: new Complementary(),
         set(h) {
           this.setProperty('harmony', h);
           this.get('harmony palette').update(this);
         }
       },
       colorFieldWidth: {defaultValue: 20},
       master: {
         initialize() {
           this.master = {
             auto: 'styleguide://SystemWidgets/color palette'
           }
         }
       },
       submorphs: {
         after: ['color'],
         initialize() {
            const [h,s,b] = this.color.toHSB();
            this.cachedPalette = {};
            this.submorphs = [this.fillTypeSelector(), this.paletteView()];
            this.pivotColor = Color.hsb(h,s,1);
            connect(this.get('harmony palette'), 'harmony', this, 'harmony');
            connect(this.get('pivot control'), 'pivotColor', this, 'pivotColor');
            connect(this.get('harmony palette'), 'pivotBrightness', this, 'pivotBrightness');
            this.selectSolidMode();
            this.active = true;
         }
       }
     }
   }

   fadeIntoWorld(pos) {
      super.fadeIntoWorld(pos);
      this.initPosition = pos;
      return this;
   }

   isHaloItem() { return true }

   onKeyDown(evt) {
      if (evt.key == "Escape") this.close();
   }

   close(duration) {
      duration ? this.fadeOut(duration) : this.remove();
      signal(this, 'close');
   }

   paletteView() {
      return {
        name: "paletteView",
        extent: pt(400.0,253.0),
        submorphs: [
           this.solidColorPalette(),
           new HarmonyPalette({
             name: "harmony palette",
             isLayoutable: false,
             visible: false,
             draggable: false
           })]
      }
   }

   selectSolidMode() {
      var duration = 200,
          solidPalette = this.get("solidColorPalette"),
          paletteView = this.get("paletteView");
       if (solidPalette.visible) return;
       paletteView.submorphs.forEach(m => m.animate({isLayoutable: false, visible: false, duration}));
       solidPalette.animate({isLayoutable: true, visible: true, duration});
   }

   selectHarmonyMode() {
      var duration = 200,
          paletteView = this.get("paletteView");
      if (this.get("harmony palette").visible) return;
      paletteView.submorphs.forEach(m => m.animate({isLayoutable: false, visible: false, duration}));
      this.get("harmony palette").animate({isLayoutable: true, visible: true, duration});
   }

  fillTypeSelector() {
    const selector = new ModeSelector({
      reactsToPointer: false,
      name: "fillTypeSelector",
      items: ["Color Palette", "Color Harmonies"],
      tooltips: {"Color Harmonies": this.getPaletteDescription("harmony")}
    });
    connect(selector, "Color Palette", this, "selectSolidMode");
    connect(selector, "Color Harmonies", this, "selectHarmonyMode");
    return selector;
  }

   solidColorPalette() {
      // switch between different palettes (material, flat, harmonies, custom)
      // custom allows to add new colors via color picker
      return {
         name: "solidColorPalette",
         master: {
           auto: 'styleguide://SystemWidgets/solid color palette'
         },
         submorphs: [
           this.getCurrentPalette(),
           this.paletteConfig(),
         ]
      }
   }

   getCurrentPalette() {
      const {name, colors, mod} = this.getColorsFor(this.colorPalette);
      return this.cachedPalette[name] || this.getPalette(colors, mod)
   }

   getPalette(colors, mod) {
       const cols = Math.max(Math.ceil(colors.length / mod), 15),
             width = cols * this.colorFieldWidth,
             height =  mod * this.colorFieldWidth,
             paddedColors = [...colors, ...arr.withN((cols * mod) - colors.length, null)];
       return {
         extent: pt(width, height),
         name: "paletteContainer",
         submorphs: paddedColors.map(c => {
            let field = new ColorPaletteField({
              color: c && Color.rgbHex(c),
              extent: pt(this.colorFieldWidth, this.colorFieldWidth),
            });
            connect(field, 'updateColor', this, 'color');
            return field;
         })
       };
   }

  switchPalette({name, colors, mod}) {
    const colorPalette = this.get("solidColorPalette"), [_, config] = colorPalette.submorphs;
    this.cachedPalette[name] = this.cachedPalette[name] || this.getPalette(colors, mod, name);
    colorPalette.submorphs = [this.cachedPalette[name], config];
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
         webSafe: 'Web safe colors emerged during the early era of\n' +
                  'the internet; a standardized palette of 216 colors\n' +
                  'that displayed consistently across all major browsers.'
      }
      return descriptions[paletteName];
   }

   updatePaletteDescription() {
      const description = this.get("paletteSelector");
      description.tooltip = this.getPaletteDescription(this.colorPalette);
   }

   getColorsFor(paletteName) {
       const nameToColors = {
          flatDesign: {colors: flatDesignColors, mod: 11},
          materialDesign: {colors: materialDesignColors, mod: 15},
          webSafe: {colors: webSafeColors, mod: 12}
       };
       return {name: paletteName, ...nameToColors[paletteName]};
   }

   paletteConfig() {
      var selector,
          config = {
         name: "paletteConfig", styleClasses: ['paletteFormatter'],
         submorphs: [
           selector = new DropDownSelector({
             isHaloItem: true, name: "paletteSelector",
             selectedValue: 'flatDesign', padding: 4,
             tooltip: this.getPaletteDescription(this.colorPalette),
             values: {"Flat Design" : "flatDesign",
                      "Material Design" : "materialDesign",
                      "Web Safe" : "webSafe"}
       })]
      };
     connect(selector, 'selectedValue', this, 'colorPalette');
     return config;
   }

}
