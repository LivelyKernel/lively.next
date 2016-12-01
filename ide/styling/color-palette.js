import { Color, Complementary, Triadic, Tetradic, 
         Quadratic, Analogous, Neutral, pt, Point,
         flatDesignColors, materialDesignColors, webSafeColors } from "lively.graphics";
import { Morph, VerticalLayout, HorizontalLayout, 
         Text, TilingLayout, Ellipse, Image } from "../../index.js";
import { DropDownSelector, ModeSelector, Slider } from "../../widgets.js";
import { connect, disconnect, signal } from "lively.bindings";
import { num, arr } from "lively.lang";

const WHEEL_URL = 'https://www.sessions.edu/wp-content/themes/divi-child/color-calculator/wheel-5-ryb.png'

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
      const [h,s,b] = this.selectedColor.toHSB();
      this.pivotColor = Color.hsb(h,s,1);
      this.build();
      this.active = true;
   }

   isHaloItem() { return true }

   onKeyDown(evt) {
      if (evt.key == "Escape") this.remove();
   }

   get pivotBrightness() {
      const [h,s,b] = (this.pivotColor || this.selectedColor).toHSB();
      return b;
   }

   set pivotBrightness(b) {
      const [h,s] = (this.pivotColor || this.selectedColor).toHSB();
      this.pivotColor = Color.hsb(h,s,b);
      this.relayout();
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
        submorphs: [this.solidColorPalette(), this.harmonyPalette()]
      }
   }

   selectSolidMode() {
      var duration = 200,
          paletteView = this.get("paletteView");
       if (this.get("solidColorPalette").opacity) return;
       paletteView.submorphs.forEach(m => m.animate({opacity: 0, visible: false, duration}));
       this.get("solidColorPalette").animate({opacity: 1, visible: true, duration});
       this.relayout();
   }

   selectHarmonyMode() {
      var duration = 200,
          paletteView = this.get("paletteView");
      if (this.get("harmonyPalette").opacity) return;
      paletteView.submorphs.forEach(m => m.animate({opacity: 0, visible: false, duration}));
      this.get("harmonyPalette").animate({opacity: 1, visible: true, duration});
      this.relayout();
   }

   fillTypeSelector() {
      const selector = new ModeSelector({
                               name: "fillTypeSelector",
                               items: ["Color Palette", "Color Harmonies"],
                               tooltips: {"Color Harmonies": this.getPaletteDescription("harmony")}
                           });
      selector.width = 300;
      connect(selector, "Color Palette", this, "selectSolidMode");
      connect(selector, "Color Harmonies", this, "selectHarmonyMode");
      return selector;

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
                     new Slider({
                       target: this, min: 0, max: 1, tooltip: "Adjust Brightness",
                       property: "pivotBrightness", width: 100
                     }),
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
             harmonyPoints.fill = Color.black.withA(1 - brightness);
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
            fill: Color.black.withA(1 - this.pivotColor.toHSB()[2]),
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
         name: "harmonySelector", target: this, 
         property: "harmony", isHaloItem: true,
         values: {Complement: Complementary,
                  Triadic: Triadic,
                  Tetradic: Tetradic,
                  Quadratic: Quadratic,
                  Analogous: Analogous,
                  Neutral: Neutral}
     });
  }

}