import { RadialGradient, Complementary, Point,
         Triadic, Tetradic, Quadratic, pt, rect,
         Analogous, Neutral, Color, LinearGradient } from "lively.graphics";
import {ColorPalette} from "./color-palette.js";
import {ColorPicker} from "./color-picker.js";
import {Morph, Image, VerticalLayout, GridLayout, 
        Text, Path, HorizontalLayout, Ellipse, morph} from "../../index.js";
import {num, obj, arr} from "lively.lang";
import {Icon} from "../../icons.js";
import {StyleRules} from "../../style-rules.js";
import {connect, signal} from "lively.bindings";

const WHEEL_URL = 'https://www.sessions.edu/wp-content/themes/divi-child/color-calculator/wheel-5-ryb.png'

export class GradientEditor extends Morph {

   constructor(props) {
      if (!props.target) throw Error("No target provided!");
      super({
         morphClasses: ['body'],
         ...props
      });
      this.build();
   }

   remove() {
      super.remove();
      this.gradientHandle && this.gradientHandle.remove();
   }

   getStyler() {
      return new StyleRules({
              body: {layout: new VerticalLayout({spacing: 3}),fill: Color.transparent},
              addStopLabel: {fontSize: 18, fontColor: Color.orange, center: pt(-1, -17), extent: pt(10,10), 
                             padding: 0, fixedWidth: true, fixedHeight: true},
              stopControlPreview: {extent: pt(2, 50), fill: Color.orange},
              propertyView: {fill: Color.black.withA(.7), borderRadius: 5,
                             padding: 5, fontColor: Color.white},
              stopControlLine: {extent: pt(2,50), fill: Color.gray.darker(), tooltip: "Drag to change proportional offset of stop"},
              stopControlHead: {fill: Color.black.withA(.3), borderRadius: 20, extent: pt(15,15), center: pt(1, -13)},
              pickerField: {imageUrl: WHEEL_URL, extent: pt(15,15), tooltip: "Open Color Picker",
                            nativeCursor: "pointer",fill: Color.transparent},
              paletteField: {nativeCursor: "pointer", clipMode: "hidden", tooltip: "Open Color Palette"},
              typeSelector: {fill: Color.transparent, extent: pt(180, 40)},
              modeButton: {extent: pt(30,30), borderWidth: 2},
              instruction: {fontSize: 15, padding: 15, fontWeight: "bold", fontColor: Color.black.lighter()},
              closeButton: {fontColor: Color.gray.lighter(), 
                            tooltip: "Remove Stop", fontSize: 17, nativeCursor: "pointer"},
              gradientEditor: {width: 180, height: 50, borderRadius: 5,
                               borderWidth: 1, borderColor: Color.gray.darker()}});
   }

   get targetProperty() { return this.target[this.property]; }
   set targetProperty(v) { this.target[this.property] = v; signal(this, "targetProperty", v); }

   async selectRadialGradient() {
      this.gradientClass = RadialGradient;
      this.get("linearMode").borderColor = Color.gray.darker();
      this.get("radialMode").borderColor = Color.orange;
      this.applyGradient(this.gradientClass);
      this.updateGradientHandles();
   }

   async selectLinearGradient() {
      this.gradientClass = LinearGradient;
      this.get("radialMode").borderColor = Color.gray.darker();
      this.get("linearMode").borderColor = Color.orange;
      this.applyGradient(this.gradientClass);
      this.updateGradientHandles();
   }

   applyGradient(gradientClass) {
      const prevGradient = this.targetProperty,
            gradientEditor = this.get("gradientEditor");
      if (prevGradient && prevGradient.isGradient) {
         const {stops,focus, vector} = prevGradient; 
         this.targetProperty  = new gradientClass({stops, bounds: this.target.innerBounds(), focus, vector});
      } else {
         this.targetProperty = new gradientClass({
            stops: [
              {color: Color.white, offset: 0},
              {color: Color.black, offset: 1}
            ], 
            bounds: this.target.innerBounds()}
          );
      }
      this.update();
   }

   async updateGradientHandles(g = this.targetProperty) {
        const duration = 300;
        this.gradientHandle && await this.gradientHandle.fadeOut(duration);
        if (g instanceof RadialGradient) {
           this.gradientHandle = new GradientFocusHandle({target: this.target, opacity: 0}).openInWorld();
        } else if (g instanceof LinearGradient) {
           this.gradientHandle = new GradientDirectionHandle({target: this.target, opacity: 0}).openInWorld();
        }
        if (this.gradientHandle) {
           this.gradientHandle.animate({opacity: 1, duration});
           this.gradientHandle.relayout()
        }
   }

   update(g = this.targetProperty) {
      if (g && g.isGradient) {
        this.get("gradientEditor").update(g);
        this.get("typeSelector").update(g);
      }
   }
   
   build() {
       this.submorphs = [this.typeSelector(), this.gradientEditor()];
       connect(this, "targetProperty", this, "update");
       this.update();
       this.styleRules = this.getStyler();
       this.updateGradientHandles();
   }

   typeSelector() {
      const defaultLinearGradient = new LinearGradient({stops: [
              {color: Color.white, offset: 0},
              {color: Color.black, offset: 1}]}),
            defaultRadialGradient = new RadialGradient({
               stops: [
                {color: Color.white, offset: 0},
                {color: Color.black, offset: 1}], 
              focus: pt(.5,.5), 
              bounds: rect(0,0,30,30)});
      return {name: "typeSelector",
              layout: new GridLayout({
                               grid: [[null, "radialMode", null, "linearMode", null]],
                               autoAssign: false, fitToCell: false}),
              update(gradient) {
                 const [radial, linear] = this.submorphs;
                 radial.borderColor = linear.borderColor = Color.gray.darker();
                 if (gradient instanceof RadialGradient) {
                    radial.borderColor = Color.orange;
                 } else if (gradient instanceof LinearGradient) {
                    linear.borderColor = Color.orange;
                 }
              },
              submorphs: [{
                 type: "ellipse",
                 morphClasses: ['modeButton'], name: "radialMode",
                 fill: defaultRadialGradient,
                 onMouseDown: (evt) => {
                    this.selectRadialGradient();
                 }
              }, {
                  type: 'ellipse',
                  morphClasses: ['modeButton'], name: "linearMode",
                  fill: defaultLinearGradient,
                  onMouseDown: (evt) => {
                     this.selectLinearGradient();
                 }
              }]};
   }

   gradientStopControl(gradientEditor, idx) {
       const head = this.stopControlHead(gradientEditor, idx),
             stopControl = new Morph({
          head,
          morphClasses: ['stopControlLine'],
          nativeCursor: '-webkit-grab',
          update(gradient) {
             this.position = gradientEditor.extent.subPt(pt(10,0))
                                           .scaleByPt(pt(gradient.stops[idx].offset, 0))
                                           .addPt(pt(5,0))
             arr.invoke(this.submorphs, "update", gradient);          
          },
          onDragStart(evt) {
             this.nativeCursor = '-webkit-grabbing';
             gradientEditor.nativeCursor = '-webkit-grabbing';
             this.offsetView = this.addMorph(new Text({
                type: 'text', morphClasses: ['propertyView']
             })).openInWorld(evt.hand.position.addPt(pt(10,10)));
          },
          onDrag(evt) {
             const absOffset = this.position.x - 5 + evt.state.dragDelta.x,
                   offset = Math.max(0, Math.min(1, absOffset / (gradientEditor.width - 10)));
             gradientEditor.updateStop(idx, {offset});
             this.offsetView.textString = (offset * 100).toFixed(2) + "%"
             this.offsetView.position = evt.hand.position.addPt(pt(10,10));
          },
          onDragEnd() {
             this.nativeCursor = '-webkit-grab';
             gradientEditor.nativeCursor = 'auto';
             this.offsetView.remove();
          },
       });
       head.stopControl = stopControl;
       stopControl.addMorph(head);
       return stopControl;
   }

   stopControlHead(gradientEditor, idx) {
        const self = this;
        return morph({
           queue: [],
           isHaloItem: true,
           morphClasses: ['stopControlHead'],
           layout: new HorizontalLayout({spacing: 3}),
           update(gradient) {
              var paletteField = this.getSubmorphNamed("paletteField"),
                  pickerField = this.getSubmorphNamed("pickerField");
              if (!paletteField) {
                 this.submorphs = [paletteField = this.paletteField(pt(10,10))];
              }
              pickerField && pickerField.update(gradient);
              paletteField.update(gradient);
              
           },
           onHoverIn() {
              const color = self.targetProperty.stops[idx].color;
              this.palette = this.palette || new ColorPalette({color}),
              this.picker = this.picker || new ColorPicker({color}),
              this.picker.color = color;
              this.scheduleExpand();
           },
           onHoverOut() {
              this.scheduleShrink();
           },
           scheduleExpand() {
              if (this.queue.pop()) return;
              this.queue.push(this.expand);
              this.dequeue();
           },
           scheduleShrink() {
              if (this.queue.pop()) return;
              this.queue.push(this.shrink);
              this.dequeue();
           },
           async dequeue() {
              if (this.queueActive) return;
              this.queueActive = true;
              while (this.queue.length > 0) {
                 await this.queue.shift().bind(this)()
              }
              this.queueActive = false;
           },
           async expand() {
              if (this.submorphs.length > 1) return; 
              const oldCenter = this.globalBounds().center(),
                    palette = this.get("paletteField");
              this.layout = null;
              this.submorphs = [this.closeButton(), palette, this.pickerField()];
              this.openInWorld(this.globalPosition);
              palette.animate({extent: pt(15,15), duration: 200});
              await this.animate({layout: new HorizontalLayout({spacing: 3}), center: oldCenter, duration: 200});
              self.update();
           },
           async shrink() {
              if (this.submorphs.length < 3) return;
              const oldCenter = this.center,
                    [close, palette, picker] = [this.get("close"), this.get("paletteField"), this.get("pickerField")];
              palette.animate({extent: pt(10,10), duration: 200});
              this.layout = null; close.remove(); picker.remove();
              await this.animate({layout: new HorizontalLayout({spacing: 3}), center: oldCenter, duration: 200});
              this.stopControl.addMorph(this);
           },
           onWidgetClosed() {
               this.palette = this.picker = null;
               this.shrink();
           },
           closeButton() {
              return new Morph({
                 name: "close",
                 extent: pt(15,15), fill: Color.transparent, 
                 origin: pt(0,-3), clipMode: 'hidden',
                 submorphs: [Icon.makeLabel("close", {
                  morphClasses: ["closeButton"],
                  onMouseDown: () => {
                     gradientEditor.removeStop(idx) && this.remove();
                  }})]})
           },
           updateColor(color) {
               gradientEditor.updateStop(idx, {color});
           },
           openColorWidget(name) {
               gradientEditor.stopControls.forEach(c => c.head.closeAllWidgets());
               this[name].position = pt(0,0); 
               connect(this[name], "color", this, "updateColor");
               connect(this[name], "close", this, "onWidgetClosed");
               connect(self, "remove", this[name], "remove");
               connect(self.owner, "onMouseDown", this[name], "remove");
               this[name].fadeIntoWorld(this.globalBounds().bottomCenter());
           },
           closeColorWidget(name) {
              this[name] && this[name].remove();
           },
           closeAllWidgets() {
              this.closeColorWidget('palette');
              this.closeColorWidget('picker');
           },
           paletteField(extent) {
               const stopControl = this;
               return {
                  type: "ellipse", name: "paletteField", extent,
                  update(gradient) {
                     this.fill = stopControl.stopColor = gradient.stops[idx].color;
                  },
                  onMouseDown: () => {
                     this.openColorWidget("palette");
                     this.closeColorWidget("picker");
                  }
               }
           },
           pickerField() {
               return new Image({
                  name: "pickerField",
                  update: (gradient) => {
                     this.stopColor = gradient.stops[idx].color
                  },
                  onMouseDown: () => {
                     this.openColorWidget("picker");
                     this.closeColorWidget("palette");
                  }
               });
           }
        })
   }

   gradientEditor() {
      const self = this;
      return {
         name: "gradientEditor", fill: Color.gray,
         update(gradient) {
            this.fill = new LinearGradient({stops: gradient.stops, vector: "eastwest"});
            this.get("instruction").animate({opacity: 0, visible: false, duration: 300});
            this.renderStopControls(gradient)
         },
         onHoverOut() { this.toggleStopPreview(false) },
         onMouseMove(evt) {
            const pos = evt.positionIn(this),
                  absOffset = pos.x;
            if (this.stopControls && this.stopControls.find(m => m.bounds().containsPoint(pos))) {
               this.toggleStopPreview(false)
            } else {
               this.toggleStopPreview(true);
               this.get("stopControlPreview").position = pt(absOffset, 0);
            }
         },
         onMouseDown(evt) {
            if (!this.get("stopControlPreview").visible) return;
            var   offset = evt.positionIn(this).x / this.width,
                  idx = self.targetProperty.stops.findIndex(m => m.offset > offset);
            idx = idx < 0 ? self.targetProperty.stops.length - 1 : idx;
            this.insertStop(idx, offset);
         },
         toggleStopPreview(visible) { 
             if (!this.get("instruction").visible) 
                 this.get("stopControlPreview").visible = visible 
         },
         removeStop(idx) {
            const gradient = self.targetProperty;
            if (gradient.stops.length > 2) {
                arr.removeAt(gradient.stops, idx);
                self.targetProperty = gradient;
                return true;
            } else {
               return false;
            }
         },
         insertStop(idx, offset) {
            const gradient = self.targetProperty, 
                  color = gradient.stops[idx].color;
            arr.pushAt(gradient.stops, {offset, color}, idx);
            self.targetProperty = gradient;
         },
         updateStop(idx, props) {
            const gradient = self.targetProperty;
            gradient.stops[idx] = {...gradient.stops[idx], ...props};
            self.targetProperty = gradient;
         },
         renderStopControls(gradient) {
            if (!this.stopControls || this.stopControls.length != gradient.stops.length) {
               const [instructions, preview] = this.submorphs;
               this.stopControls = gradient.stops.map((s,i) => self.gradientStopControl(this, i));
               this.submorphs = [instructions, preview, ...this.stopControls];
               arr.invoke(this.stopControls, "update", gradient);
            }
            arr.invoke(this.stopControls, "update", gradient);
         },
         submorphs: [{
            type: "label", name: "instruction", value: "Select Gradient Type",
            visible: !(this.targetProperty && this.targetProperty.isGradient)
         }, {
            name: "stopControlPreview", visible: false, submorphs: [Icon.makeLabel("plus-circle", {name: "addStopLabel"})]
         }]
      }
   }
}

export class GradientFocusHandle extends Ellipse {

   /* Used to configure the focal point of a radial gradient, i.e. its center and bounds */

    constructor(props) {
       if (!props.target || !props.target.fill instanceof RadialGradient) 
          throw Error("Focus Handle only applicable to Morphs with radial gradient!")
       super({
          morphClasses: ['root'],
          ...props
       })
       this.build();
    }

    get isHaloItem() { return true }

    get styler() {
       return new StyleRules({
          root: {fill: Color.transparent,
                 borderColor: Color.orange, draggable: false,
                 borderWidth: 2},
          topCenter: {nativeCursor: "ns-resize"},
          rightCenter: {nativeCursor: "ew-resize"},
          bottomCenter: {nativeCursor: "ns-resize"},
          leftCenter: {nativeCursor: "ew-resize"},
          propertyView: {fill: Color.black.withA(.7), borderRadius: 5,
                         padding: 5, fontColor: Color.white},
          boundsHandle: {borderColor: Color.orange.darker(), fill: Color.orange.withA(.7),
                         tooltip: "Resize bounds of radial gradient"},
          crossBar: {borderWidth: 2, borderColor: Color.orange, center: pt(11,11), draggable: false},
          focusHandle: {clipMode: "hidden", nativeCursor: '-webkit-grab',
                        fill: Color.transparent, borderColor: Color.orange,
                        submorphs: [
                           {type: 'path', vertices: [pt(0,0), pt(50,0)], morphClasses: ["crossBar"]},
                           {type: 'path', vertices: [pt(0,0), pt(0,50)], morphClasses: ["crossBar"]},
                           {type: "ellipse", fill: Color.transparent, extent: pt(20,20), 
                            tooltip: "Shift focal center of radial gradient",
                            reactsToPointer: false}
                        ]}
       })
    }

    build() {
       this.initBoundsHandles();
       this.initFocusHandle();
       this.styleRules = this.styler;
       this.relayout();
    }

    relayout() {
       const {bounds, focus} = this.target.fill; 
       this.extent = bounds.extent();
       this.submorphs.forEach(m => m.relayout());
       this.center = this.target.worldPoint(this.target.extent.scaleByPt(focus).subPt(this.target.origin));
    }

    initBoundsHandles() {
       const self = this;
       this.bounds().sides.forEach(side => {
          this.addMorph({
             type: "ellipse",
             morphClasses: ['boundsHandle', side],
             relayout() {
                this.center = self.innerBounds().partNamed(side);
             },
             onDragStart(evt) {
                this.boundsView = this.addMorph(new Text({
                  type: 'text', morphClasses: ['propertyView']
                })).openInWorld(evt.hand.position.addPt(pt(10,10)));
             },
             onDrag(evt) {
                var g = self.target.fill,
                    newSide = g.bounds.partNamed(side).addPt(evt.state.dragDelta.scaleBy(2));
                g.bounds = g.bounds.withPartNamed(side, newSide);
                this.boundsView.textString = `w: ${g.bounds.width.toFixed()}px h: ${g.bounds.height.toFixed()}px`             
                this.boundsView.position = evt.hand.position.addPt(pt(10,10));
                self.target.makeDirty()
                self.relayout();
             },
             onDragEnd(evt) {
                this.boundsView.remove()
             }
          })
       });
    }

    initFocusHandle() {
       const self = this;
       this.addMorph({
          type: "ellipse",
          morphClasses: ['focusHandle'],
          extent: pt(20,20),
          relayout() {
             this.center = self.innerBounds().center();
          },
          onDragStart(evt) {
             this.tfm = self.target.getGlobalTransform().inverse();
             this.focusView = this.addMorph(new Text({
                  type: 'text', morphClasses: ['propertyView']
             })).openInWorld(evt.hand.position.addPt(pt(10,10)));
          },
          onDrag(evt) {
             const {x,y} = this.tfm.transformDirection(evt.state.dragDelta),
                   g = self.target.fill;
             g.focus = g.focus.addXY(x / self.target.width, y / self.target.height)
             this.focusView.textString = `x: ${(g.focus.x * 100).toFixed()}%, y: ${(g.focus.y * 100).toFixed()}%`;
             this.focusView.position = evt.hand.position.addPt(pt(10,10));
             self.target.makeDirty();
             self.relayout();
          },
          onDragEnd(evt) {
             this.focusView.remove();
          }
       })
    }
    
}

class GradientDirectionHandle extends Ellipse {

   /* Used to configure the direction of a linear gradient (degrees) */

  constructor(props) {
     if (!props.target || !props.target.fill instanceof LinearGradient) 
        throw Error("Focus Handle only applicable to Morphs with radial gradient!")
     super({
        morphClasses: ['root'],
        ...props
     })
     this.build();
  }

  get styler() {
     return new StyleRules({
        root: {borderColor: Color.orange, fill: Color.transparent, borderWidth: 1, 
               origin: pt(25,25), extent: pt(50,50)},
        rotationPoint: {fill: Color.orange, extent: pt(10,10), nativeCursor: '-webkit-grab', tooltipt: "Adjust direction of linear gradient"},
        propertyView: {fill: Color.black.withA(.7), borderRadius: 5,
                       padding: 5, fontColor: Color.white},
     })
  }

  get isHaloItem() { return true }

  relayout() {
      this.position = this.target.globalBounds().center();
      this.rotationPoint.relayout();
  }

  build() {
      this.initRotationPoint();
      this.styleRules = this.styler;
      this.relayout();
  }

  initRotationPoint() {
     const self = this;
     this.rotationPoint = this.addMorph({
         type: "ellipse", morphClasses: ['rotationPoint'],
         relayout() {
            this.center = Point.polar(self.width / 2, self.target.fill.vectorAsAngle());
         },
         onDragStart(evt) {
            this.angleView = this.addMorph(new Text({
                  type: 'text', morphClasses: ['propertyView']
             })).openInWorld(evt.hand.position.addPt(pt(10,10)));
         },
         onDrag(evt) {
            self.target.fill.vector = evt.positionIn(self).theta();
            self.target.makeDirty();
            self.relayout();
            this.angleView.textString = `${(num.toDegrees(self.target.fill.vectorAsAngle()) + 180).toFixed()}°`;
            this.angleView.position = evt.hand.position.addPt(pt(10,10));
         },
         onDragEnd(evt) {
            this.angleView.remove();
         }
     })
  }

} 


