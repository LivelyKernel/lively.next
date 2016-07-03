import { Color, pt, rect } from "lively.graphics";
import { string, obj } from "lively.lang";

const defaultProperties = {
  name: "a morph",
  position:  pt(0,0),
  rotation:  0,
  scale:  1,
  extent:  pt(10, 10),
  fill:  Color.white,
  clipMode:  "visible",
  submorphs:  []
}

export class Morph {

  constructor(props, submorphs) {
    this._nodeType = 'div';
    this._owner = null;
    this._changes = []
    this._pendingChanges = [];
    this._dirty = true; // for initial display
    this._id = string.newUUID();
    Object.assign(this, props);
  }

  get isMorph() { return true; }
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

  shape() {
    return {}
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // morphic interface
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  get name()           { return this.getProperty("name"); }
  set name(value)      { this.change({prop: "name", value}); }

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

  get submorphs() { return this.getProperty("submorphs").slice(); }
  set submorphs(newSubmorphs) {
    this.submorphs.forEach(m => m.remove());
    newSubmorphs.forEach(m => {
      if (!m.isMorph) m = new Morph(m);
      this.addMorph(m);
    });
    return newSubmorphs
  }

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

  withAllSubmorphsDo(func) {
    func(this)
    for (let m of this.submorphs)
      m.withAllSubmorphsDo(func);
  }

  withAllSubmorphsSelect(testerFunc) {
    var result = [];
    this.withAllSubmorphsDo(m =>
      testerFunc(m) && result.push(m));
    return result;
  }

  ownerChain() {
    return this.owner ? [this.owner].concat(this.owner.ownerChain()) : [];
  }

  world() {
    return this.owner ? this.owner.world() : null;
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
        throw new Error(`dispatchEvent: ${type} not yet supported!`)
    }
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // nameing
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  get(name) {
    // search below, search siblings, search upwards
    if (!name) return null;
    try {
      return (this.getNameTest(this, name) && this)
          || this.getInSubmorphs(name)
          || this.getInOwners(name);
    } catch(e) {
      if (e.constructor == RangeError && e.message == "Maximum call stack size exceeded") {
        e = new Error("'get' failed due to a stack overflow. The most\n"
          + "likely source of the problem is using 'get' as part of\n"
          + "toString, because 'get' calls 'getInOwners', which\n"
          + "calls 'toString' on this. Try using 'getInSubmorphs' instead,\n"
          + "which only searches in this' children.");
      }
      throw e
    }
  }

  getNameTest(morph, expectedName) {
    var isRe = obj.isRegExp(expectedName);
    if (isRe) {
      if (expectedName.test(morph.name) || expectedName.test(String(morph))) return true;
    } else {
      if (morph.name === expectedName || String(morph) === expectedName) return true;
    }
    return false;
  }

  getInSubmorphs(name) {
    if (!this.submorphs.length) return null;
    var isRe = obj.isRegExp(name);
    for (var i = 0; i < this.submorphs.length; i++) {
      var morph = this.submorphs[i];
      if (this.getNameTest(morph, name)) return morph
    }
    for (var i = 0; i < this.submorphs.length; i++)  {
      var morph = this.submorphs[i].getInSubmorphs(name);
      if (morph) return morph;
    }
    return null;
  }

  getInOwners (name) {
    var owner = this.owner;
    if (!owner) return null;
    for (var i = 0; i < owner.submorphs.length; i++) {
      var morph = owner.submorphs[i];
      if (morph === this) continue;
      if (this.getNameTest(morph, name)) return morph;
      var foundInMorph = morph.getInSubmorphs(name);
      if (foundInMorph) return foundInMorph;
    }
    return this.owner.getInOwners(name);
  }
}

export class Ellipse extends Morph {

  shape() {
    return {
      style: {
        borderRadius: this.extent.x + "px/" + this.extent.y + "px"
      }
    }
  }

}

export class Image extends Morph {

  constructor(props, submorphs) {
    super(props, submorphs);
    this._nodeType = 'img';
    if (!this.imageUrl)
      this.imageUrl = 'http://lively-web.org/core/media/lively-web-logo-small.png'
  }

  get imageUrl()       { return this.getProperty("imageUrl"); }
  set imageUrl(value)  { this.change({prop: "imageUrl", value}); }

  shape() {
    return {
      src: this.imageUrl
    }
  }
}
export class WorldMorph extends Morph {

  handForPointerId(pointerId) {
    return this.submorphs.find(m => m instanceof HandMorph && m.pointerId === pointerId)
        || this.addMorph(new HandMorph(pointerId));
  }

  world() { return this }
  
  onMouseMove(evt) {
    evt.hand.update(evt);
  }
  
  onMouseUp(evt) {
  }
}
