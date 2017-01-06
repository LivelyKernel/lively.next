import { Color, Complementary, Triadic, Tetradic, 
         Quadratic, Analogous, Neutral, pt, Point,
         flatDesignColors, materialDesignColors, webSafeColors } from "lively.graphics";
import { Morph, VerticalLayout, HorizontalLayout, 
         Text, TilingLayout, Ellipse, Image } from "../../index.js";
import { DropDownSelector, ModeSelector, Slider } from "../../widgets.js";
import { connect, disconnect, signal } from "lively.bindings";
import { num, arr } from "lively.lang";
import { StyleRules } from "../../style-rules.js"; 

const WHEEL_URL = 'https://www.sessions.edu/wp-content/themes/divi-child/color-calculator/wheel-5-ryb.png'

const duration = 200;

export class ColorPalette extends Morph {

   constructor(props) {
      this.harmony = Complementary;
      this.color = props.color || Color.blue,
      this.colorFieldWidth = 20,
      super({
         morphClasses: ['back'],
         styleRules: this.styler,
         ...props,
      });
      const [h,s,b] = this.color.toHSB();
      this.pivotColor = Color.hsb(h,s,1);
      this.build();
      this.active = true;
   }

   onDrag(evt) {
      const a = this.get('arrow'),
            dt = a.getTransform().transformDirection(evt.state.dragDelta.negated());
      this.moveBy(evt.state.dragDelta);
      a.vertices[1].moveBy(dt);
   }

   fadeIntoWorld(pos) {
      super.fadeIntoWorld(pos);
      this.initPosition = pos;
      this.relayout();
      return this;
   }

   get styler() {
      const fill = Color.gray;
      return new StyleRules({
         body:{
           fill,
           extent: pt(200,300),
           borderRadius: 5, reactsToPointer: false,
           layout: new VerticalLayout()},
         back: {
           fill: Color.transparent, dropShadow: true, borderRadius: 5,
           extent: pt(200,300),
           layout: new VerticalLayout({ignore: ["arrow"]})
         },
         arrow: { fill, grabbable: false, draggable: false },
         paletteFormatter: {layout: new HorizontalLayout({spacing: 5}),
                            fill: Color.transparent},
         harmonyControl: {layout: new VerticalLayout({spacing: 5}),
                            fill: Color.transparent},
         paletteView: {clipMode: "hidden", fill: Color.transparent},
         solidColorPalette: {fill: Color.transparent, layout: new VerticalLayout()},
         paletteContainer: {fill: Color.transparent,
                            rotation: num.toRadians(90)},
         vacantColorField: {
             extent: pt(this.colorFieldWidth, this.colorFieldWidth),
             borderColor: Color.black.lighter().lighter(), borderWidth: 1,
             fill: Color.transparent
         },
         colorField: {
            extent: pt(this.colorFieldWidth, this.colorFieldWidth),
            borderColor: Color.transparent,
            borderWidth: 2
         },
         harmonies: {
            layout: new TilingLayout({spacing: 5}),
            fill: Color.transparent,
            width: 260,
         },
         harmonyVisualizer: {
            extent: pt(110,110),
            fill: Color.transparent,
            imageUrl: WHEEL_URL,
         },
         harmonyPoints: {
            borderWidth: 1,
            draggable: false,
            extent: pt(100,100),
            origin: pt(50,50),
            position: pt(50,50),
         },
         pivotControl: {
            draggable: false,
            fill: Color.transparent,
            borderColor: Color.black,
            borderWidth: 3,
            extent: pt(18,18)
         },
         pivotControlCenter: {
            fill: Color.transparent,
            borderColor: Color.white,
            borderWidth: 3,
            center: pt(8,8),
            extent: pt(12,12)
         }
      })
   }

   isHaloItem() { return true }

   onKeyDown(evt) {
      if (evt.key == "Escape") this.close();
   }

   close(duration) {
      duration ? this.fadeOut(duration) : this.remove();
      signal(this, 'close');
   }
   
   get pivotBrightness() {
      const [h,s,b] = (this.pivotColor || this.color).toHSB();
      return b;
   }

   set pivotBrightness(b) {
      const [h,s] = (this.pivotColor || this.color).toHSB();
      this.pivotColor = Color.hsb(h,s,b);
      this.get('harmonyPalette').relayout();
   }

   get harmony() { return this._harmony }
   set harmony(h) {
      this._harmony = h;
      this.active && this.relayout();
   }

   build() {
     this.cachedPalette = {};
     this.submorphs = [{type: "polygon", name: "arrow", 
                        vertices: [pt(-1,0),pt(0,-.5), pt(1,0)],
                        bottomCenter: pt(this.width/2, 0)},
                       {name: 'body',
                        submorphs: [
                           this.fillTypeSelector(),
                           this.paletteView()]
                        }];
     this.selectSolidMode();
   }

   relayout() {
      const arrow = this.get('arrow'),
            harmonyPalette = this.get('harmonyPalette'),
            fillTypeSelector = this.get("fillTypeSelector"),
            paletteView = this.get("paletteView"),
            world = this.world(),
            buttonSize = this.width/15;
      paletteView.relayout();
      fillTypeSelector.animate({width: paletteView.bounds().width, duration});
      harmonyPalette.relayout();
      arrow.vertices = [pt(-1,1), pt(0,.5), pt(1,1)];
      arrow.extent = pt(buttonSize, buttonSize);
      if (world) {
          arrow.remove();
          const heightInWorld = world.visibleBounds().height - this.initPosition.y;
          this.globalPosition = world.visibleBounds()
                                     .translateForInclusion(this.globalBounds())
                                     .topLeft();
          if (this.initPosition) {
              if (heightInWorld < this.height) {
                 this.animate({bottomCenter: this.owner
                                         .localize(this.initPosition)
                                         .addXY(0,1 - buttonSize)
                                         .withX(this.bottomCenter.x), duration});
                 arrow.rotation = Math.PI;
              } else {
                this.animate({topCenter: this.owner
                       .localize(this.initPosition)
                       .addXY(0, -1)
                       .withX(this.topCenter.x), duration});
                 arrow.rotation = 0;
              }
              this.addMorph(arrow, this.get('body'));
              arrow.animate({bottomCenter: this.localize(this.initPosition), duration});
          }
          this.addMorph(arrow, this.get('body'))
          if (arrow.bottomLeft.x < 0) {
             this.animate({position: this.position.addXY(arrow.bottomLeft.x, 0), duration});
             arrow.animate({bottomLeft: arrow.bottomLeft.withX(0), duration});
          }
          if (arrow.bottomRight.x > this.width) {
             this.animate({position: this.position.addXY(arrow.bottomRight.x - this.width, 0), duration})
             arrow.animate({bottomRight: arrow.bottomRight.withX(this.width), duration});
          }
      }
   }

   paletteView() {
      return {
        name: "paletteView",
        relayout() {
           this.animate({extent: this.submorphs.find(p => p.visible).extent, duration});
        },
        submorphs: [this.solidColorPalette(), this.harmonyPalette()]
      }
   }

   selectSolidMode() {
      var duration = 200,
          paletteView = this.get("paletteView");
       if (this.get("solidColorPalette").visible) return;
       paletteView.submorphs.forEach(m => m.animate({opacity: 0, visible: false, duration}));
       this.get("solidColorPalette").animate({opacity: 1, visible: true, duration});
       this.relayout();
   }

   selectHarmonyMode() {
      var duration = 200,
          paletteView = this.get("paletteView");
      if (this.get("harmonyPalette").visible) return;
      paletteView.submorphs.forEach(m => m.animate({opacity: 0, visible: false, duration}));
      this.get("harmonyPalette").animate({opacity: 1, visible: true, duration});
      this.relayout();
   }

   fillTypeSelector() {
      const selector = new ModeSelector({
                               reactsToPointer: false,
                               name: "fillTypeSelector",
                               items: ["Color Palette", "Color Harmonies"],
                               tooltips: {"Color Harmonies": this.getPaletteDescription("harmony")}
                           });
      selector.width = this.width;
      connect(selector, "Color Palette", this, "selectSolidMode");
      connect(selector, "Color Harmonies", this, "selectHarmonyMode");
      return selector;

   }

   solidColorPalette() {
      // switch between different palettes (material, flat, harmonies, custom)
      // custom allows to add new colors via color picker
      return {
         name: "solidColorPalette", visible: false,
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
       return {width, height, name: "paletteContainer",
               layout: new TilingLayout(),
               submorphs: paddedColors.map(c => {
                  const  fill = c && Color.rgbHex(c)
                  return c ? {
                     fill,
                     morphClasses: ['colorField'],
                     onHoverIn() {
                        const [h,s,b] = fill.toHSB();
                        this.borderColor = Color.hsb(h,s + .5 > 1 ? s - .5 : s + .5, b + .5 > 1 ? b - .5 : b + .5)
                     },
                     onHoverOut() {
                        this.borderColor = Color.transparent;
                     },
                     onMouseDown: () => {
                        this.color = Color.rgbHex(c);
                        signal(this, "color", this.color);
                        this.close(200);
                     }
                  } : {
                     morphClasses: ['vacantColorField'], 
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
         name: "paletteConfig", morphClasses: ['paletteFormatter'],
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
      name: "harmonyPalette", morphClasses: ['paletteFormatter'], visible: false,
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
                           colorPalette.color = this.fill;
                           signal(colorPalette, "color", this.fill);
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
         submorphs: [{
            type: "ellipse",
            name: "harmonyPoints",
            fill: Color.black.withA(1 - this.pivotColor.toHSB()[2]),
            submorphs: [{
              name: "pivotControl",
              type: "ellipse",
              update() {
                 const [h,s,_] = colorPalette.pivotColor.toHSB(),
                       angle = num.toRadians(h),
                       currentPos = Point.polar(50 * s, angle);
                 this.center = currentPos;
              },
              submorphs: [{
                type: "ellipse", morphClasses: ['pivotControlCenter'],
                onDrag: (evt) => {
                   var  [h,s,b] = colorPalette.pivotColor.toHSB(),
                         angle = num.toRadians(h),
                         currentPos = Point.polar(50 * s, angle),
                         newPos = currentPos.addPt(evt.state.dragDelta),
                         h = num.toDegrees(newPos.theta()),
                         h = h < 0 ? h + 360 : h,
                         s = Math.min(newPos.r()/50, 1);
                   colorPalette.pivotColor = Color.hsb(h, s, b);
                   this.get("harmonyPalette").relayout();
                },
              }]
          }]
         }]
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