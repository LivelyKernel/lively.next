import { RadialGradient, Complementary, 
         Triadic, Tetradic, Quadratic, pt, rect,
         Analogous, Neutral, Color, LinearGradient } from "lively.graphics";
import {ColorPalette} from "./color-palette.js";
import {ColorPicker} from "./color-picker.js";
import {Morph, Image, VerticalLayout, GridLayout, 
        Text, Path, HorizontalLayout} from "../../index.js";
import {num, obj, arr} from "lively.lang";
import {Icon} from "../../icons.js";
import {connect, signal} from "lively.bindings";

const WHEEL_URL = 'https://www.sessions.edu/wp-content/themes/divi-child/color-calculator/wheel-5-ryb.png'

export class GradientEditor extends Morph {

   constructor(props) {
      super({
         morphClasses: ['controlElement'],
         layout: new VerticalLayout({spacing: 3}),
         ...props
      });
      this.build();
   }

   get styler() {
      return {controlElement: {fill: Color.transparent},
              addStopLabel: {fontSize: 18, fontColor: Color.orange, center: pt(1, -16)},
              stopControlPreview: {extent: pt(2, 50), fill: Color.orange},
              propertyView: {fill: Color.black.withA(.7), borderRadius: 5,
                             padding: 5, fontColor: Color.white},
              stopControlLine: {extent: pt(2,50), fill: Color.gray.darker()},
              stopControlHead: {fill: Color.black.withA(.3), borderRadius: 20, center: pt(1,-15)},
              pickerField: {imageUrl: WHEEL_URL, extent: pt(15,15), 
                            nativeCursor: "pointer",fill: Color.transparent,},
              paletteField: {nativeCursor: "pointer", clipMode: "hidden"},
              typeSelector: {fill: Color.transparent, extent: pt(180, 40)},
              modeButton: {extent: pt(30,30), borderWidth: 2},
              instruction: {fontSize: 15, padding: 15, fontWeight: "bold", fontColor: Color.black.lighter()},
              closeButton: {fontColor: Color.gray, fontSize: 18, nativeCursor: "pointer"},
              gradientEditor: {width: 180, height: 50, borderRadius: 5,
                               borderWidth: 1, borderColor: Color.gray.darker()}};
   }

   applyStyler() {
      if (this.stylerActive) return;
      this.stylerActive = true;
      this.withAllSubmorphsDo(m => {
         var styleProps;
         if (styleProps = this.styler[m.name]) {
            Object.assign(m, styleProps);
         } else if (m.morphClasses) {
            styleProps = obj.merge(arr.compact(m.morphClasses.map(c => this.styler[c])));
            Object.assign(m, styleProps);
         }
      })
      this.stylerActive = false;
   }

   onSubmorphChange(change, submorph) {
      this.applyStyler();
      super.onSubmorphChange(change, submorph);
   } 

   get targetProperty() { return this.target[this.property]; }
   set targetProperty(v) { this.target[this.property] = v; signal(this, "targetProperty", v); }

   selectRadialGradient() {
      this.gradientClass = RadialGradient;
      this.get("linearMode").borderColor = Color.gray.darker();
      this.get("radialMode").borderColor = Color.orange;
      this.applyGradient(this.gradientClass);
   }

   selectLinearGradient() {
      this.gradientClass = LinearGradient;
      this.get("radialMode").borderColor = Color.gray.darker();
      this.get("linearMode").borderColor = Color.orange;
      this.applyGradient(this.gradientClass);
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

   update(v = this.targetProperty) {
      if (v && v.isGradient) {
        this.get("gradientEditor").update(v);
        this.get("typeSelector").update(v);
      }
   }
   
   build() {
       this.submorphs = [this.typeSelector(), this.gradientEditor()];
       connect(this, "targetProperty", this, "update");
       this.update(this.targetProperty);
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
       return new Morph({
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
             gradientEditor.toggleStopPreview(false);
          },
          onDragEnd() {
             this.nativeCursor = '-webkit-grab';
             gradientEditor.nativeCursor = 'auto';
             this.offsetView.remove();
          },
          submorphs: [this.stopControlHead(gradientEditor, idx)],
       });
   }

   stopControlHead(gradientEditor, idx) {
        const self = this;
        return {
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
              this.expand();
           },
           onHoverOut() {
              this.shrink();
           },
           async expand() {
              if (this.expansion || this.submorphs.length == 3) return; 
              this.shrinking && await this.shrinking
              const oldCenter = this.globalBounds().center(),
                    oldLayout = this.layout,
                    [palette] = this.submorphs;
              this.layout = null; this.stopControl = this.owner;
              this.submorphs = [this.closeButton(), palette, this.pickerField()];
              palette.animate({extent: pt(15,15), duration: 200});
              this.openInWorld(this.globalPosition);
              this.expansion = this.animate({layout: oldLayout, center: oldCenter, duration: 200});
              self.update();
              await this.expansion; this.expansion = null;
           },
           async shrink() {
              if (this.shrinking || this.submorphs.length == 1) return;
              this.expansion && await this.expansion;
              const oldCenter = this.stopControl.localize(this.center),
                    oldLayout = this.layout,
                    [close, palette, picker] = this.submorphs;
              this.layout = null; close.remove(); picker.remove();
              palette.animate({extent: pt(10,10), duration: 200});
              this.stopControl.addMorph(this);
              this.shrinking = this.animate({layout: oldLayout, center: oldCenter, duration: 200});
              await this.shrinking; this.shrinking = null;
              
           },
           onWidgetClosed() {
               this.palette = this.picker = null;
               this.shrink();
           },
           closeButton() {
              return new Morph({
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
           openColorWidget(name, widget) {
               this[widget] = this[widget] || widget;
               widget.position = pt(0,0);
               connect(widget, "color", this, "updateColor");
               connect(widget, "close", this, "onWidgetClosed");
               widget.fadeIntoWorld(this.globalBounds().bottomCenter());
           },
           closeColorWidget(name, widget) {
              if (!this[name]) return;
              this[name].remove();
              this[name] = null;
           },
           paletteField(extent) {
               const stopControl = this;
               return {
                  type: "ellipse", name: "paletteField", extent,
                  update(gradient) {
                     this.fill = stopControl.stopColor = gradient.stops[idx].color;
                     
                  },
                  onMouseDown: () => {
                     this.openColorWidget("palette", new ColorPalette({color: this.stopColor}));
                     this.closeColorWidget("picker");
                  }
               }
           },
           pickerField() {
               return new Image({
                  morphClasses: ["pickerField"],
                  update: (gradient) => {
                     this.stopColor = gradient.stops[idx].color
                  },
                  onMouseDown: () => {
                     this.openColorWidget("picker", new ColorPicker({color: this.stopColor}));
                     this.closeColorWidget("palette");
                  }
               });
           }
        }
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
         onHoverIn() { this.toggleStopPreview(true) },
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
            const offset = evt.positionIn(this).x / this.width,
                  idx = self.targetProperty.stops.findIndex(m => m.offset > offset);
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