import { obj, num, arr, properties } from "lively.lang";
import { pt, Color, Rectangle, rect } from "lively.graphics";
import { Morph, Button, List, Text, GridLayout, HorizontalLayout, Path, Ellipse } from "./index.js";
import { Icon } from "./icons.js";
import { signal, connect, disconnect } from "lively.bindings";
import { Tooltip } from "./tooltips.js";
import { StyleRules } from "./style-rules.js";
import config from "./config.js";
import { Label } from "./text/label.js";
import { Intersection, IntersectionParams } from 'kld-intersections';

export class Leash extends Path {

   constructor(props) {
      const {start, end} = props;
      super({
         borderWidth: 2, borderColor: Color.black,
         ...props,
         endpointStyle: {
             fill: Color.black, origin: pt(3.5,3.5), 
             extent: pt(10,10), nativeCursor: "-webkit-grab",
             ...props.endpointStyle
         },
         vertices: [start, end]
      });
      this.build()
      connect(this, "extent", this, "relayout");
      connect(this, "position", this, "relayout");
   }

   get endpointStyle() { return this._endpointStyle }
   set endpointStyle(style) { 
       this._endpointStyle = style;
       this.startPoint && Object.assign(this.startPoint, this.getEndpointStyle(0)); 
       this.endPoint && Object.assign(this.endPoint, this.getEndpointStyle(1)); 
   }

   remove() {
      super.remove();
      this.startPoint.clearConnection();
      this.endPoint.clearConnection()
   }

   onEndpointDrag(endpoint, evt) {
      const v = endpoint.getVertex(),
            {x,y} = v;
      endpoint.setVertex({...v, ...pt(x,y).addPt(evt.state.dragDelta)})
      this.relayout();
   }

   getEndpointStyle(idx) {
      return {...this.endpointStyle, ...idx == 0 ? 
                 this.endpointStyle.start : 
                 this.endpointStyle.end}
   }

   endpoint(idx) {
      const leash = this, {x,y} = leash.vertices[idx];
      return new Ellipse({
              position: pt(x,y), index: idx,
              ...this.getEndpointStyle(idx),
              onDrag(evt) {
                 leash.onEndpointDrag(this, evt);
              },
              getConnectionPoint() {
                  const {isPath, isPolygon, vertices, origin} = this.connectedMorph,
                        gb = this.connectedMorph.globalBounds();
                  if ((isPath || isPolygon) && this.attachedSide != "center") {
                     const vs = vertices.map(({x,y}) => pt(x,y).addPt(origin)),
                           ib = Rectangle.unionPts(vs),
                           side = ib[this.attachedSide](),
                           center = ib.center().addPt(ib.center().subPt(side)),
                           line = IntersectionParams.newLine(new Point2D(side.x, side.y), new Point2D(center.x,center.y)),
                           path = IntersectionParams.newPolyline(vs.map(({x,y}) => new Point2D(x, y))),
                           {x,y} = arr.min(Intersection.intersectShapes(path, line).points, ({x,y}) => pt(x,y).dist(side));
                     return pt(x,y).addPt(gb.topLeft());
                  } else {
                     return gb[this.attachedSide]();
                  }
              },
              update(change) {
                 const globalPos = this.getConnectionPoint(),
                       pos = leash.localize(globalPos);
                 this.setVertex({...this.vertex, ...pos});
              },
              clearConnection() {
                 if (this.connectedMorph) {
                     disconnect(this.connectedMorph, "extent", this, "update");
                     disconnect(this.connectedMorph, "position", this, "update");
                 }
              },
              relayout() {
                const {x,y} = this.getVertex(), bw = leash.borderWidth;
                //this.extent = this.pt((2*bw), (2 * bw));
                this.center = pt(x + bw,y + bw);
              },
              getVertex() {
                 return leash.vertices[idx];
              },
              setVertex(v) {
                 leash.vertices[idx] = v;
                 leash.vertices = leash.vertices;
              },
              attachTo(morph, side) {
                  this.clearConnection()
                  this.connectedMorph = morph;
                  this.attachedSide = side;
                  this.vertex = {...leash.vertices[idx], 
                                 controlPoints: leash.controlPointsFor(side)} 
                  connect(this.connectedMorph, "position", this, "update");
                  connect(this.connectedMorph, "extent", this, "update");
                  this.update();
              }})
   }

   controlPointsFor(side) {
      const next = {
         topCenter: pt(0,-1), topLeft: pt(1,-1),
         rightCenter: pt(1,0), bottomRight: pt(1,1),
         bottomCenter: pt(0,1), bottomLeft: pt(-1,1),
         leftCenter: pt(-1,0), topRight: pt(-1,-1),
         center: pt(0,0)
      }[side];
      return {previous: next.negated().scaleBy(100), next: next.scaleBy(100)}
   }

   build() {
       this.submorphs = [this.startPoint = this.endpoint(0), this.endPoint = this.endpoint(1)]
   }

   relayout() {
      this.startPoint.relayout();
      this.endPoint.relayout();
   }

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

export class PropertyInspector extends Morph {

   constructor(props) {
       const {target, property, name, min, max} = props;
       super({
           name, morphClasses: ["root"],
           styleRules: this.styler,
           submorphs: [new ValueScrubber({
                        name: "value",
                        value: target[property],
                        ...obj.dissoc(props, ["name"])}),
                        {type: "button", name: "down", label: Icon.makeLabel(
                                  "sort-desc", {padding: rect(2,2,0,0), fontSize: 12})},
                        {type: "button", name: "up", label: Icon.makeLabel(
                                  "sort-asc", {padding: rect(2,2,0,0), fontSize: 12})}]
       });
       this.target = target; this.min = min;
       this.property = property;
       this.initLayout();
       connect(this.get("value"), "scrub", this.target, this.property);
       connect(this.get("up"), "fire", this, "increment");
       connect(this.get("down"), "fire", this, "decrement");
   }

   get styler() {
       const buttonStyle = {
            type: "button", 
            clipMode: "hidden",
            activeStyle: {
                fill: Color.transparent, 
                borderWidth: 0, fontColor: Color.white.darker()
            }, 
            triggerStyle: {fill: Color.transparent, fontColor: Color.black}
         };
       return new StyleRules({
           root: {
              extent:pt(55, 25), borderRadius: 5,
              borderWidth: 1, borderColor: Color.gray, 
              clipMode: "hidden"},
           down: {padding: rect(0,-5,0,10), ...buttonStyle},
           up: {padding: rect(0,0,0,-5), ...buttonStyle},
           value: {fill: Color.white, padding: 4, fontSize: 15},
           
       })
   }

   update() {
       this.get("value").value = this.target[this.property];
   }

   increment() { 
      if (this.max != undefined && this.target[this.property] >= this.max) return;
      this.target[this.property] += 1; 
      this.update() 
   }

   decrement() { 
      if (this.min != undefined && this.target[this.property] <= this.min) return;
      this.target[this.property] -= 1; 
      this.update() 
   }

   initLayout() {
      const l = this.layout = new GridLayout({
                      grid:[["value", "up"],
                            ["value", "down"]]
                    });
      l.col(1).paddingLeft = 5;
      l.col(1).paddingRight = 5;
      l.col(1).fixed = 25;
      return l;
   }

}

export class ValueScrubber extends Text {

  constructor(props) {
      super({
        fill: Color.transparent, draggable: true,
        textString: obj.safeToString(this.scrubbedValue),
        min: -Infinity,
        max: Infinity,
        ...obj.dissoc(props, ["value"])
      });

      this.value = props.value || 0;
  }

  onDragStart(evt) {
     this.execCommand("toggle active mark");
     this.initPos = evt.position;
     this.factorLabel = new Tooltip({
          position: evt.hand.position.addXY(10,10),
          description: "1x"}).openInWorld();
  }

  onKeyDown(evt) {
    super.onKeyDown(evt);
    if ("Enter" == evt.keyCombo) {
      const [v, unit] = this.textString.split(" ");
      if (v) {
         this.value = parseFloat(v);
         signal(this, "scrub", this.scrubbedValue);
      }
      evt.stop();
    }
  }

  onDrag(evt) {
      // x delta is the offset to the original value
      // y is the scale
      const {x, y} = evt.position.subPt(this.initPos),
            scaleFactor = num.roundTo(Math.exp(-y / this.world().height * 4), 0.01),
            v = this.getCurrentValue(x, scaleFactor);
      signal(this, "scrub", v);
      this.textString = obj.safeToString(v);
      if (this.unit) this.textString += " " + this.unit;
      this.factorLabel.description = scaleFactor + "x";
      this.factorLabel.position = evt.hand.position.addXY(10,10);
  }

  getCurrentValue(delta, s) {
      const v = this.scrubbedValue + Math.round(delta * s);
      return Math.max(this.min, Math.min(this.max, v));
  }

  onDragEnd(evt) {
      const {x, y} = this.initPos.subPt(evt.position),
            scaleFactor = num.roundTo(Math.exp(-y / this.world().height * 4), 0.01);
      this.scrubbedValue = this.getCurrentValue(x, scaleFactor);
      this.factorLabel.softRemove();
  }

  set value(v) {
      v = Math.max(this.min, Math.min(this.max, v));
      this.scrubbedValue = v;
      this.textString = obj.safeToString(v) || "";
      if (this.unit) this.textString += " " + this.unit;
  }

}

export class CheckBox extends Morph {

  get defaultProperties() {
    return {
      ...super.defaultProperties,
      draggable: false,
      extent: pt(15,15),
      borderWidth: 0,
      active: true,
      checked: false,
      fill: Color.transparent,
      nativeCursor: "pointer"
    }
  }

  get checked() { return this.getProperty("checked"); }
  set checked(value) { this.addValueChange("checked", value); }
  get active() { return this.getProperty("active"); }
  set active(value) { this.addValueChange("active", value); }

  trigger() {
    try {
      this.checked = !this.checked;
      signal(this, "toggle", this.checked);
    } catch (err) {
      var w = this.world();
      if (w) w.logError(err);
      else console.error(err);
    }
  }

  onMouseDown(evt) {
    if (this.active) this.trigger();
  }

  render(renderer) {
    return renderer.renderCheckBox(this);
  }

}

export class LabeledCheckBox extends Morph {

  constructor(props) {
    super({
      name: "LabeledCheckBox",
      ...props,
      submorphs: [
        new CheckBox({name: "checkbox"}),
        new Label({
          value: props.label, nativeCursor: "pointer",
          name: "label", padding: Rectangle.inset(3, 0)
        })]});
    connect(this.labelMorph, 'value', this, 'relayout');
    connect(this.checkboxMorph, 'checked', this, 'checked');
    this.relayout();
  }

  relayout() {
    var l = this.labelMorph, cb = this.checkboxMorph;
    if (this.alignCheckBox === "left") {
      cb.leftCenter = pt(0, l.height/2);
      l.leftCenter = cb.rightCenter;
    } else {
      l.position = pt(0,0)
      cb.leftCenter = pt(l.width, l.height/2);
    }
    this.extent = this.submorphBounds().extent();
  }

  get labelMorph() { return this.getSubmorphNamed("label"); }
  get checkboxMorph() { return this.getSubmorphNamed("checkbox"); }

  get defaultProperties() {
    return {
      ...super.defaultProperties,
      alignCheckBox: "left",
      label: "label"
    }
  }
  
  get alignCheckBox() { return this.getProperty("alignCheckBox"); }
  set alignCheckBox(leftOrRight) {
    this.addValueChange("alignCheckBox", leftOrRight);
    this.relayout();
  }

  get label() { return this.labelMorph.value; }
  set label(value) { this.labelMorph.value = value; }

  get checked() { return this.checkboxMorph.checked; }
  set checked(value) { this.checkboxMorph.checked; signal(this, "checked", value); }

  get active() { return this.checkboxMorph.active; }
  set active(value) { this.checkboxMorph.active; }
  trigger() { this.checkboxMorph.trigger(); }

  onMouseDown(evt) {
    if (this.active) this.trigger();
    evt.stop();
  }

}

export class ModeSelector extends Morph {

   constructor(props) {
     var {items, init, tooltips = {}} = props, keys, values;
     if (obj.isArray(items)) {
         keys = values = items;
     } else {
         keys = obj.keys(items);
         values = obj.values(items);
     }
     super({
         keys, values, tooltips,
         morphClasses: ['root'],
         layout: new GridLayout({
             grid: [[...arr.interpose(keys.map(k => k + "Label"), null)]],
             autoAssign: false, fitToCell: true, 
         }),
         ...props
      })
      this.build();
      this.update(init ? init : keys[0], 
                   values[keys.includes(init) ? keys.indexOf(init) : 0],
                   true);
      connect(this, "extent", this, "relayout");
    }

    build() {
       this.submorphs = [
            {name: "typeMarker"},
            ...this.createLabels(this.keys, this.values, this.tooltips)
         ]
       this.layout.col(0).row(0).group.align = "topCenter";
       this.layout.col(2).row(0).group.align = "topCenter";
       this.applyStyler();
    }

    applyStyler() {
       this.withAllSubmorphsDo(m => {
         var styleProps;
         if (styleProps = this.styler[m.name]) {
            Object.assign(m, styleProps);
         } else if (m.morphClasses) {
            styleProps = obj.merge(arr.compact(m.morphClasses.map(c => this.styler[c])));
            Object.assign(m, styleProps);
         }
      })
    }

    get styler() {
       return {
          root: {fill: Color.transparent,
                 height: 30, origin: pt(0,5)},
          typeMarker: {fill: Color.gray.darker(), borderRadius: 3},
          label: {fontWeight: 'bold', nativeCursor: "pointer", padding: 4}
       }
    }

    createLabels(keys, values, tooltips = {}) {
       return arr.zip(keys, values)
                 .map(([name, value]) => {
                   const tooltip = tooltips[name];
                   return {
                      name: name + "Label", morphClasses: ['label'],
                      type: "label", value: name, 
                      ...this.labelStyle,
                      ...tooltip && {tooltip},
                      onMouseDown: () => {
                         this.update(name, value);
                }}});
    }

    async relayout() { 
        return this.currentLabel && this.get("typeMarker").animate({
                       bounds: this.currentLabel.bounds(), 
                       duration: 200}); 
    }
    
    async update(label, value, silent=false) {
       const newLabel = this.get(label + "Label"), duration = 200
       if (newLabel == this.currentLabel) return;
       if (this.currentLabel) this.currentLabel.fontColor = Color.black;
       this.currentLabel = newLabel;
       newLabel.fontColor = Color.white;
       await this.relayout(duration);
       !silent && signal(this, label, value)
       !silent && signal(this, "switchLabel", value);
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
      const currentValue = this.getNameFor(this.target[this.property]);
      return [{command: currentValue, target: this}, ...arr.compact(this.commands.map(c => { 
          return c.name != currentValue && {command: c.name, target: this}
         }))];
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
