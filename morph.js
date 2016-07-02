import { Color, pt, rect } from "lively.graphics";
import { string } from "lively.lang";

const defaultProperties = {
  position:  pt(0,0),
  rotation:  0,
  scale:  1,
  extent:  pt(10, 10),
  fill:  Color.white,
  clipMode:  "visible",
  submorphs:  []
}

export class Morph {

  constructor(props) {
    this._owner = null;
    this._changes = []
    this._pendingChanges = [];
    this._dirty = true; // for initial display
    this._id = string.newUUID();
    Object.assign(this, props);
  }

  get id() { return this._id; }

  defaultProperty(key) { return defaultProperties[key]; }

  getProperty(key) {
     var c = this.lastChangeFor(key);
     return c ? c.value : this.defaultProperty(key); 
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // debugging
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  toString() {
    return `<Morph ${this.name ? this.name : this.id}>`;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // changes
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  lastChangeFor(prop, onlyCommited) {
    var changes = this._changes.concat(onlyCommited ? [] : this._pendingChanges);
    return changes.reverse().find(ea => ea.prop === prop);
  }

  change(change) {
    this._pendingChanges.push(change);
    this.makeDirty();
    return change;
  }

  hasPendingChanges() { return !!this._pendingChanges.length; }

  commitChanges() {
    this._changes = this._changes.concat(this._pendingChanges);
    this._pendingChanges = [];
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // render hooks
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  makeDirty() {
    this._dirty = true;
    if (this.owner) this.owner.makeDirty();
  }

  needsRerender() {
    return this._dirty || !!this._pendingChanges.length;
  }
  
  aboutToRender() {
    this.commitChanges();
    this._dirty = false;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // morphic interface
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  get position()       { return this.getProperty("position"); }
  set position(value)  { this.change({prop: "position", value}); }

  get scale()          { return this.getProperty("scale"); }
  set scale(value)     { this.change({prop: "scale", value}); }

  get rotation()       { return this.getProperty("rotation"); }
  set rotation(value)  { this.change({prop: "rotation", value}); }

  get extent()         { return this.getProperty("extent"); }
  set extent(value)    { this.change({prop: "extent", value}); }

  get fill()           { return this.getProperty("fill"); }
  set fill(value)      { this.change({prop: "fill", value}); }

  get clipMode()       { return this.getProperty("clipMode"); }
  set clipMode(value)  { this.change({prop: "clipMode", value}); }

  bounds() {
    var {x,y} = this.position, {x:w,y:h} = this.extent;
    return rect(x,y,w,h);
  }

  innerBounds() {
    var {x:w,y:h} = this.extent;
    return rect(0,0,w,h);
  }

  moveBy(delta) { this.position = this.position.addPt(delta); }
  resizeBy(delta) { this.extent = this.extent.addPt(delta); }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // morphic relationship
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  get submorphs()      { return this.getProperty("submorphs"); }
  addMorph(morph) {
    morph._owner = this;
    this.change({prop: "submorphs", value: this.submorphs.concat(morph)});
    return morph;
  }
  remove() {
    var o = this.owner;
    if (o) {
      this._owner = null;
      o.change({prop: "submorphs", value: o.submorphs.filter(ea => ea !== this)});
    }
  }
  get owner() { return this._owner; }

  withAllSubmorphsDetect(testerFunc) {
    if (testerFunc(this)) return this;
    for (let m of this.submorphs) {
      var found = m.withAllSubmorphsDetect(testerFunc);
      if (found) return found;
    }
    return undefined;
  }

  ownerChain() {
    return this.owner ? [this.owner].concat(this.owner.ownerChain()) : [];
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-  
  // undo / redo
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  undo() {
    // fixme redo stack
    this._changes.pop();
    this.makeDirty();
  }
  
  dispatchEvent(evt) {
    var { type, target } = evt,
        targetId = target.id,
        targetMorph = this.withAllSubmorphsDetect(sub => sub.id === targetId);
    switch (type) {
      case 'mousedown':
        [targetMorph].concat(targetMorph.ownerChain())
          .reverse()
          .map(ea => ea.onMouseDown(evt));
        break;

      default:
        throw new Error(`dispatchEvent: ${type} nt yet supported!`)
    }
  }
  
}
