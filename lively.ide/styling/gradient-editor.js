import {
  RadialGradient,
  Point,
  pt,
  rect,
  Color,
  LinearGradient
} from "lively.graphics";
import {
  Morph, Tooltip,
  Image,
  VerticalLayout,
  GridLayout,
  Text,
  Ellipse,
  morph,
  Icon
} from "lively.morphic";
import { num, arr } from "lively.lang";
import { connect, signal } from "lively.bindings";
import { Popover } from "lively.components/popup.js";
import { ColorPalette } from "./color-palette.js";
import { ColorPicker } from "./color-picker.js";
import { colorWidgets } from "./style-popover.js";

const WHEEL_URL = '/lively.ide/assets/color-wheel.png';

class GradientTypeSelector extends Morph {

  get defaultLinearGradient() {
     return new LinearGradient({stops: [
          {color: Color.white, offset: 0},
          {color: Color.black, offset: 1}]});
  }

  get defaultRadialGradient() {
     return new RadialGradient({
           stops: [
            {color: Color.white, offset: 0},
            {color: Color.black, offset: 1}],
          focus: pt(.5,.5),
          bounds: rect(0,0,30,30)});
  }

  static get properties() {
    return {
      fill: {
        defaultValue: Color.transparent,
      },
      layout: {
        initialize() {
          this.extent = pt(180, 40);
          this.layout = new GridLayout({
           grid: [[null, "radialMode", null, "linearMode", null]],
                   autoAssign: false, fitToCell: false})
        }
      },

      submorphs: {
        initialize() {
          let [m1, m2] = this.submorphs = [morph({
             type: "ellipse",
             master: {
               auto: 'styleguide://SystemWidgets/gradient mode/deselected'
             },
             name: "radialMode",
             fill: this.defaultRadialGradient,
          }), morph({
              type: 'ellipse',
              master: {
                auto: 'styleguide://SystemWidgets/gradient mode/deselected'
              },
              name: "linearMode",
              fill: this.defaultLinearGradient
          })];
          connect(m1, 'onMouseDown', () => signal(this, 'radial'));
          connect(m2, 'onMouseDown', () => signal(this, 'linear'));
        }
      }
    }
  }

  update(gradient) {
    const [radial, linear] = this.submorphs;
    radial.borderColor = linear.borderColor = Color.gray.darker();
    if (gradient instanceof RadialGradient) {
        radial.borderColor = Color.orange;
    } else if (gradient instanceof LinearGradient) {
        linear.borderColor = Color.orange;
    }
  }

}

export class GradientEditor extends Morph {
  static get properties() {
    return {
      layout: {
        initialize() {
          this.layout = new VerticalLayout({
            spacing: 3,
          })
        }
      },
      fill: { defaultValue: Color.transparent },
      handleMorph: {},
      gradientValue: {
        set(v) {
          if (!(v && v.isGradient)) {
            v = false;
          }
          this.setProperty("gradientValue", v);
        }
      },
      submorphs: {
        initialize() {
          this.build();
        }
      },
    };
  }

  remove() {
    super.remove();
    this.gradientHandle && this.gradientHandle.remove();
  }

  async selectRadialGradient() {
    this.get("linearMode").borderColor = Color.gray.darker();
    this.get("radialMode").borderColor = Color.orange;
    await this.applyGradient(RadialGradient);
    await this.updateGradientHandles();
  }

  async selectLinearGradient() {
    this.get("radialMode").borderColor = Color.gray.darker();
    this.get("linearMode").borderColor = Color.orange;
    await this.applyGradient(LinearGradient);
    await this.updateGradientHandles();
  }

  async applyGradient(gradientClass) {
    const prevGradient = this.gradientValue, gradientEditor = this.get("gradientEditor");
    if (prevGradient && prevGradient.isGradient) {
      const {stops, focus, vector} = prevGradient;
      this.gradientValue = new gradientClass({
        stops,
        bounds: this.gradientBounds,
        focus,
        vector
      });
    } else {
      this.gradientValue = new gradientClass({
        stops: [{color: Color.white, offset: 0}, {color: Color.black, offset: 1}],
        bounds: this.gradientBounds
      });
    }
    this.update(this.gradientValue);
  }

  showGradientHandlesOn(aMorph) {
    this.handleMorph = aMorph;
    this.updateGradientHandles();
  }

  async updateGradientHandles() {
    // gradient handles need to be requested from the user of
    // a gradient editor. It is not the responsibility of
    // the gradient editor to know of the target at hand.
    const duration = 300,
          gradientClass = this.gradientValue.__proto__.constructor;
    if (!this.handleMorph) return;
    this.gradientHandle && (await this.gradientHandle.fadeOut(duration));
    if (gradientClass == RadialGradient) {
      this.gradientHandle = new GradientFocusHandle({target: this.handleMorph});
    } else if (gradientClass == LinearGradient) {
      this.gradientHandle = new GradientDirectionHandle({target: this.handleMorph});
    }
    if (this.gradientHandle) {
      signal(this, "openHandle", this.gradientHandle);
      this.gradientHandle.relayout();
      this.gradientHandle.opacity = 0;
      this.gradientHandle.animate({opacity: 1, duration});
    }
  }

  update(g = this.gradientValue) {
    if (g && g.isGradient) {
      this.get("gradientEditor").update(g);
    }
  }

  build() {
    var selector;
    this.submorphs = [(selector = new GradientTypeSelector({name: "typeSelector"})), this.gradientEditor()];
    connect(selector, "radial", this, "selectRadialGradient");
    connect(selector, "linear", this, "selectLinearGradient");
    connect(this, "gradientValue", this, "update");
    this.update(this.gradientValue);
    selector.update(this.gradientValue);
    this.gradientValue && this.updateGradientHandles();
  }

  gradientEditor() {
    return morph({
      fill: null, clipMode: 'hidden', extent: pt(190,80), 
      submorphs: [new GradientStopVisualizer({
        position: pt(5,30), name: "gradientEditor", gradientEditor: this})]});
  }
}

class StopControlHead extends Morph {

   static get properties() {
     return {
       stopVisualizer: {},
       gradientEditor: {},
       targetProperty: {
         get() { return this.stopVisualizer.targetProperty },
       },
       master: {
         initialize() {
           this.master = {
             auto: 'styleguide://SystemWidgets/stop control head/collapsed'
           }
         }
       },
       index: {},
       queue: {defaultValue: []},
       isHaloItem: {defaultValue: true},
    }
  }

   update(gradient) {
      var paletteField = this.getSubmorphNamed("paletteField"),
          pickerField = this.getSubmorphNamed("pickerField");
      if (!paletteField) {
         this.submorphs = [paletteField = this.paletteField(pt(10,10))];
      }
      paletteField.fill = this.stopColor = gradient.stops[this.index].color;
   }

   onHoverIn() {
      const color = this.targetProperty.stops[this.index].color;
      this.palette = this.palette || new Popover({
        name: "Color Palette",
        targetMorph: new ColorPalette({color})
      });
      connect(this.palette.targetMorph, 'color', this.palette, 'color');
      this.picker = this.picker || new ColorPicker({color}),
      this.picker.color = color;
      this.scheduleExpand();
   }

   onHoverOut() {
      this.scheduleShrink();
   }

   scheduleExpand() {
      if (this.queue.pop()) return;
      this.queue.push(this.expand);
      this.dequeue();
   }

   scheduleShrink() {
      if (this.queue.pop()) return;
      this.queue.push(this.shrink);
      this.dequeue();
   }

   async dequeue() {
      if (this.queueActive) return;
      this.queueActive = true;
      while (this.queue.length > 0) {
         await this.queue.shift().bind(this)()
      }
      this.queueActive = false;
   }

   async expand() {
      if (this.submorphs.length > 1) return;
      let palette = this.get("paletteField"), duration = 100, ge;
      var center = pt(2,-14);
      this.submorphs = [this.closeButton(), palette, this.pickerField()];
      this.master = {
        auto: 'styleguide://SystemWidgets/stop control head/expanded'
      };
      // if clipped by owner move into view accordingly
      ge = this.get('gradientEditor');
      let {x: leftDistance, width} = this.transformRectToMorph(ge, this.innerBounds()),
          rightDistance = leftDistance + width - ge.width;
      if (leftDistance < this.width / 2) center = center.addXY((this.width / 3) - leftDistance, 0);
      if (rightDistance > this.width / 2) center = center.addXY((this.width / 3) - rightDistance, 0);
      palette.extent = pt(15,15);
      this.center = center;
      this.stopVisualizer.gradientEditor.update();
   }

   async shrink() {
      if (this.submorphs.length < 3) {
        return;
      }
      const oldCenter = pt(2,-14),
            [close, palette, picker] = [
              this.get("close"), this.get("paletteField"), this.get("pickerField")
            ];
      let duration = 200;
      palette.bringToFront();
      close.remove();
      picker.remove();
      this.master = {
        auto: 'styleguide://SystemWidgets/stop control head/collapsed'
      }
      this.center = oldCenter;
   }

   onWidgetClosed() {
       this.palette = this.picker = null;
       this.shrink();
   }

  removeStop() {
     this.stopVisualizer.removeStop(this.index) && this.remove();
  }

   closeButton() {
      let bt = new Morph({
         name: "close",
         extent: pt(15,15), fill: Color.transparent,
         origin: pt(0,-3), clipMode: 'hidden',
         submorphs: [Icon.makeLabel("times", {
          styleClasses: ["closeButton"],
        })]
      });
      connect(bt, 'onMouseDown', this, 'removeStop');
      return bt;
   }

   updateColor(color) {
       this.stopVisualizer.updateStop(this.index, {color});
   }

   openColorWidget(name) {
       this.stopVisualizer.stopControls.forEach(c => c.head.closeAllWidgets());
       this[name].topLeft = pt(0, 0);
       connect(this[name], "color", this, "updateColor");
       connect(this[name], "close", this, "onWidgetClosed");
       connect(this.stopVisualizer, "remove", this[name], "remove");
       connect(this[name], 'onBlur', this, 'removeWhenLostFocus', {
         converter: () => name, varMapping: {name}
       });
       this[name].fadeIntoWorld(this.globalBounds().bottomCenter());
       this[name].focus();
   }

   removeWhenLostFocus(name) {
    setTimeout(() => {
      if (!$world.focusedMorph.ownerChain().includes(this[name]) &&
          !$world.focusedMorph.isMenuItem) {
       this.closeColorWidget(name);
     } else {
       this[name].focus();
     }
    }, 100);
   }

   closeColorWidget(name) {
      this[name] && this[name].remove();
   }

   closeAllWidgets() {
      this.closeColorWidget('palette');
      this.closeColorWidget('picker');
   }

   paletteField(extent) {
       const stopControl = this,
             paletteField = morph({
          type: "ellipse", name: "paletteField", extent,
          styleClasses: ['paletteField'],
       });
     connect(
       paletteField, 'onMouseDown',
       this, 'openColorWidget', {
         converter: () => 'palette'
       }
     );
     return paletteField;
   }

   pickerField() {
       let pickerField = new Image({
          name: "pickerField",
          styleClasses: ['pickerField']
       });
      connect(pickerField, 'onMouseDown',
              this, 'openColorWidget', {
        converter: () => 'picker'
      });
     return pickerField;
   }
}

class GradientStopVisualizer extends Morph {

  static get properties() {
    return {
         fill: {defaultValue: Color.gray},
         gradientEditor: {},
         draggable: { defaultValue: false },
         targetProperty: {
           derived: true,
           get() {
             return this.gradientEditor && this.gradientEditor.gradientValue;
           },
           set(v) {
             this.gradientEditor.gradientValue = v;
           }
         },
         master: {
           initialize() {
             this.master = {
               auto: 'styleguide://SystemWidgets/gradient stop visualizer'
             }
           }
         },
         submorphs: {
           after: ['gradientEditor'],
           initialize() {
             this.submorphs = [{
                 type: "label", name: "instruction", value: "Select Gradient Type",
                 visible: !(this.targetProperty && this.targetProperty.isGradient)
             }, {
                 name: "stopControlPreview", visible: false,
                 master: {
                   auto: 'styleguide://SystemWidgets/stop control preview'
                 },
                 submorphs: [Icon.makeLabel("plus-circle", {name: "addStopLabel"})]
             }];
            }
          }
      }
  }

  update(gradient) {
    this.fill = new LinearGradient({stops: gradient.stops, vector: "eastwest"});
    this.get("instruction").animate({visible: false, duration: 300});
    this.renderStopControls(gradient)
  }

  onHoverOut() { this.toggleStopPreview(false) }

  onMouseMove(evt) {
    const pos = evt.positionIn(this),
          absOffset = pos.x;
    if (this.stopControls && this.stopControls.find(m => m.bounds().containsPoint(pos))) {
       this.toggleStopPreview(false)
    } else {
       this.toggleStopPreview(true);
       this.get("stopControlPreview").position = pt(absOffset, 0);
    }
  }

  onMouseDown(evt) {
    if (!this.get("stopControlPreview").visible) return;
    var   offset = evt.positionIn(this).x / this.width,
          idx = this.targetProperty.stops.findIndex(m => m.offset > offset);
    idx = idx < 0 ? this.targetProperty.stops.length - 1 : idx;
    this.insertStop(idx, offset);
  }

  toggleStopPreview(visible) {
    if (!this.get("instruction").visible)
      this.get("stopControlPreview").visible = visible
  }

  removeStop(idx) {
      const gradient = this.targetProperty;
      if (gradient.stops.length > 2) {
          arr.removeAt(gradient.stops, idx);
          this.targetProperty = gradient;
          return true;
      } else {
         return false;
      }
  }

  insertStop(idx, offset) {
      const gradient = this.targetProperty,
            color = gradient.stops[idx].color;
      arr.pushAt(gradient.stops, {offset, color}, idx);
      this.targetProperty = gradient;
   }

   updateStop(idx, props) {
      const gradient = this.targetProperty;
      gradient.stops[idx] = {...gradient.stops[idx], ...props};
      this.targetProperty = gradient;
   }

   renderStopControls(gradient) {
      if (!this.stopControls || this.stopControls.length != gradient.stops.length) {
         const [instructions, preview] = this.submorphs;
         this.stopControls = gradient.stops.map((s,i) => new GradientStopControl({
              stopVisualizer: this, index: i
         }));
         this.submorphs = [instructions, preview, ...this.stopControls];
         arr.invoke(this.stopControls, "update", gradient);
      }
     arr.invoke(this.stopControls, "update", gradient);
   }

}

class GradientStopControl extends Morph {

  static get properties() {
    return {
      index: {},
      head: {},
      stopVisualizer: {},
      styleClasses: {defaultValue: ['stopControlLine']},
      nativeCursor: {defaultValue: '-webkit-grab'},
      draggable: {defaultValue: true},
      master: {
        initialize() {
          this.master = {
            auto: 'styleguide://SystemWidgets/gradient stop control'
          }
        }
      },
      submorphs: {
        after: ['index', 'stopVisualizer'],
        initialize() {
          this.head = new StopControlHead({
             name: 'stop control head',
             stopVisualizer: this.stopVisualizer,
             index: this.index
          });
          this.head.stopControl = this;
          this.addMorph(this.head);
         }
      }
    }
  }

  update(gradient) {
    this.position = this.stopVisualizer
                        .extent.subPt(pt(10,0))
                        .scaleByPt(pt(gradient.stops[this.index].offset, 0))
                        .addPt(pt(5,0))
   this.head.update(gradient);
  }

  onDragStart(evt) {
     this.nativeCursor = '-webkit-grabbing';
     this.stopVisualizer.nativeCursor = '-webkit-grabbing';
     this.offsetView = new Tooltip().openInWorld(evt.hand.position.addPt(pt(10,10)));
  }

  onDrag(evt) {
     const absOffset = this.position.x - 5 + evt.state.dragDelta.x,
           offset = Math.max(0, Math.min(1, absOffset / (this.stopVisualizer.width - 10)));
     this.stopVisualizer.updateStop(this.index, {offset});
     this.offsetView.description = (offset * 100).toFixed(2) + "%"
     this.offsetView.position = evt.hand.position.addPt(pt(10,10));
  }

  onDragEnd() {
     this.nativeCursor = '-webkit-grab';
     this.stopVisualizer.nativeCursor = 'auto';
     this.offsetView.remove();
  }
}

class FocusHandle extends Ellipse {

  static get properties() {
    return {
      gradientHandle: {},
      styleClasses: {defaultValue: ['focusHandle']},
      extent: {defaultValue: pt(20,20)},
      fill: {defaultValue: Color.orange}
    }
  }

  relayout() {
     this.center = this.gradientHandle.innerBounds().center();
  }

  onDragStart(evt) {
     this.tfm = this.gradientHandle.target.getGlobalTransform().inverse();
     this.focusView = new Tooltip().openInWorld(evt.hand.position.addPt(pt(10,10)));
  }

  onDrag(evt) {
     const {x,y} = evt.state.dragDelta,
           gh = this.gradientHandle,
           g = gh.target.fill;
     g.focus = g.focus.addXY(x / gh.target.width, y / gh.target.height)
     this.focusView.description = `x: ${(g.focus.x * 100).toFixed()}%, y: ${(g.focus.y * 100).toFixed()}%`;
     this.focusView.position = evt.hand.position.addPt(pt(10,10));
     gh.target.makeDirty();
     gh.relayout();
  }

  onDragEnd(evt) {
     this.focusView.remove();
  }

}

class BoundsHandle extends Ellipse {

  static get properties() {
    return {
      side: {},
      gradientHandle: {},
      styleClasses: {
        after: ['side'],
        initialize() {
          this.styleClasses = ['boundsHandle', this.side]
        }
      }
    }
  }

  relayout() {
     this.center = this.gradientHandle.innerBounds().partNamed(this.side);
     this.scale = 1 / this.gradientHandle.target.getGlobalTransform().getScale();
  }

  onDragStart(evt) {
    this.boundsView = new Tooltip().openInWorld(evt.hand.position.addPt(pt(10,10)));
  }

  onDrag(evt) {
    var gh = this.gradientHandle,
        g = gh.target.fill,
        newSide = g.bounds.partNamed(this.side).addPt(evt.state.dragDelta.scaleBy(2));
    g.bounds = g.bounds.withPartNamed(this.side, newSide);
    this.boundsView.description = `w: ${g.bounds.width.toFixed()}px h: ${g.bounds.height.toFixed()}px`
    this.boundsView.position = evt.hand.position.addPt(pt(10,10));
    gh.target.makeDirty()
    gh.relayout();
  }

  onDragEnd(evt) {
    this.boundsView.remove()
  }

}

export class GradientFocusHandle extends Ellipse {

   /* Used to configure the focal point of a radial gradient, i.e. its center and bounds */

    static get properties() {
      return {
        target: {/* REQUIRED */},
        isHaloItem: {defaultValue: true},
        hasFixedPosition: { defaultValue: true },
        master: {
          initialize() {
            this.master = {
              auto: 'styleguide://SystemWidgets/gradient focus handle'
            }
          }
        },
        submorphs: {
          initialize() {
            this.submorps = [];
            this.initBoundsHandles();
            this.addMorph(new FocusHandle({gradientHandle: this}))
            this.relayout();
          }
        }
      }
    }

    relayout() {
       const {bounds, focus} = this.target.fill;
       this.extent = bounds.extent();
       this.submorphs.forEach(m => m.relayout());
       this.rotation = this.target.rotation;
       this.scale = this.target.scale;
       this.borderWidth = 2 / this.scale;
       if (this.owner)
          this.center = this.owner.localizePointFrom(this.target.extent.scaleByPt(focus), this.target);
    }

    initBoundsHandles() {
       this.bounds().sides.forEach(side => {
          this.addMorph(new BoundsHandle({gradientHandle: this, side, name: 'bounds handle ' + side.split('C')[0]}))
       });
    }

}

class RotationPoint extends Ellipse {
  static get properties() {
    return {
      gradientHandle: {},
    };
  }

  relayout() {
    this.center = Point.polar(
      this.gradientHandle.width / 2,
      this.gradientHandle.target.fill.vectorAsAngle()
    );
  }

  onDragStart(evt) {
    this.angleView = new Tooltip().openInWorld(evt.hand.position.addPt(pt(10, 10)));
    this.angleView.rotation = 0;
  }

  onDrag(evt) {
    let gh = this.gradientHandle;
    gh.target.fill.vector = evt.positionIn(gh).theta();
    gh.target.makeDirty();
    gh.relayout();
    this.angleView.description = `${(num.toDegrees(gh.target.fill.vectorAsAngle()) + 180).toFixed()}°`;
    this.angleView.position = evt.hand.position.addPt(pt(10, 10));
  }

  onDragEnd(evt) {
    this.angleView.remove();
  }
}

class GradientDirectionHandle extends Ellipse {

   /* Used to configure the direction of a linear gradient (degrees) */

  static get properties() {
    return {
      target: {},
      origin: {defaultValue: pt(25, 25)},
      extent: {defaultValue: pt(50, 50)},
      hasFixedPosition: { defaultValue: true },
      submorphs: {
        initialize() {
          this.initRotationPoint();
          this.relayout();
        }
      },
      master: {
        initialize() {
          this.master = {
            auto: 'styleguide://SystemWidgets/gradient direction handle'
          }
        }
      }
    }
  }

  get isHaloItem() { return true }

  relayout() {
    if (this.owner)
      this.position = this.owner.localizePointFrom(this.target.extent.scaleBy(0.5), this.target);
    this.rotationPoint.relayout();
  }

  initRotationPoint() {
     this.rotationPoint = this.addMorph(new RotationPoint({gradientHandle: this, name: 'rotation point'}));
  }

}


colorWidgets.GradientEditor = GradientEditor;

