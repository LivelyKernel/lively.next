import { Color, pt, rect } from "lively.graphics";
import { string, obj } from "lively.lang";

export function morph(props = {}) {
  var klass;
  switch (props.type) {
    case 'world': klass = WorldMorph; break;
    case 'hand': klass = HandMorph; break;
    case 'image': klass = Image; break;
    case 'ellipse': klass = Ellipse; break;
    default: klass = Morph;
  }
  return new klass(props);
}


const defaultProperties = {
  visible: true,
  name: "a morph",
  position:  pt(0,0),
  rotation:  0,
  scale:  1,
  extent: pt(10, 10),
  fill: Color.white,
  clipMode: "visible",
  reactsToPointer: true,
  draggable: true,
  grabbable: true,
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
    return `<${this.constructor.name} - ${this.name ? this.name : this.id}>`;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // changes
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  lastChangeFor(prop, onlyCommited) {
    var changes = this._changes.concat(onlyCommited ? [] : this._pendingChanges);
    for (var i = changes.length-1; i >= 0; i--)
      if (changes[i].prop === prop) return changes[i];
    return null
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

  get draggable()       { return this.getProperty("draggable"); }
  set draggable(value)  { this.change({prop: "draggable", value}); }

  get grabbable()       { return this.getProperty("grabbable"); }
  set grabbable(value)  { this.change({prop: "grabbable", value}); }

  get reactsToPointer()       { return this.getProperty("reactsToPointer"); }
  set reactsToPointer(value)  { this.change({prop: "reactsToPointer", value}); }

  get bounds() {
    var {x,y} = this.position, {x:w,y:h} = this.extent;
    return rect(x,y,w,h);
  }

  set bounds(bounds) {
    this.position = bounds.topLeft();
    this.extent = bounds.extent();
  }

  innerBounds() {
    var {x:w, y:h} = this.extent;
    return rect(0,0,w,h);
  }
  
  positionInWorld() {
    if(this.isWorld){
      return this.position;
    } else {
      return this.position.addPt(this.owner.positionInWorld()); 
    }
  }

  align(p1, p2) { return this.moveBy(p2.subPt(p1)); }
  moveBy(delta) { this.position = this.position.addPt(delta); }
  resizeBy(delta) { this.extent = this.extent.addPt(delta); }

  get width()         { return this.extent.x; }
  set width(v)        { return this.extent = pt(v, this.extent.y); }
  get height()        { return this.extent.y; }
  set height(v)       { return this.extent = pt(this.extent.x, v); }

  get left()          { return this.bounds.left(); }
  set left(v)         { return this.moveBy(pt(v - this.left), 0); }
  get right()         { return this.bounds.right(); }
  set right(v)        { return this.moveBy(pt(v - this.right), 0); }
  get top()           { return this.bounds.top(); }
  set top(v)          { return this.moveBy(pt(0, v - this.top)); }
  get bottom()        { return this.bounds.bottom(); }
  set bottom(v)       { return this.moveBy(pt(0, v - this.bottom)); }

  get center()        { return this.bounds.center(); }
  set center(v)       { return this.align(this.center, v); }
  get topLeft()       { return this.bounds.topLeft(); }
  set topLeft(v)      { return this.align(this.topLeft, v); }
  get topRight()      { return this.bounds.topRight(); }
  set topRight(v)     { return this.align(this.topRight, v); }
  get bottomRight()   { return this.bounds.bottomRight(); }
  set bottomRight(v)  { return this.align(this.bottomRight, v); }
  get bottomLeft()    { return this.bounds.bottomLeft(); }
  set bottomLeft(v)   { return this.align(this.bottomLeft, v); }
  get bottomCenter()  { return this.bounds.bottomCenter(); }
  set bottomCenter(v) { return this.align(this.bottomCenter, v); }
  get topCenter()     { return this.bounds.topCenter(); }
  set topCenter(v)    { return this.align(this.topCenter, v); }
  get leftCenter()    { return this.bounds.leftCenter(); }
  set leftCenter(v)   { return this.align(this.leftCenter, v); }
  get rightCenter()   { return this.bounds.rightCenter(); }
  set rightCenter(v)  { return this.align(this.rightCenter, v); }


  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // morphic relationship
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  get submorphs() { return this.getProperty("submorphs").slice(); }
  set submorphs(newSubmorphs) {
    this.submorphs.forEach(m => m.remove());
    return newSubmorphs.map(m => this.addMorph(m));
  }

  addMorph(submorph, insertBeforeMorph) {
    if (!submorph || typeof submorph !== "object")
      throw new Error(`${submorph} cannot be added as a submorph to ${this}`)

    if (!submorph.isMorph) submorph = morph(submorph);

    submorph._owner = this;
    var submorphs = this.submorphs,
        insertBeforeMorphIndex = insertBeforeMorph ? submorphs.indexOf(insertBeforeMorph) : -1,
        insertionIndex = insertBeforeMorphIndex === -1 ? submorphs.length : insertBeforeMorphIndex;
    submorphs.splice(insertionIndex, 0, submorph);

    this.change({prop: "submorphs", value: submorphs});
    return submorph;
  }

  remove() {
    var owner = this.owner;
    if (!owner) return this;
    this._owner = null;
    var submorphs = owner.submorphs,
        index = submorphs.indexOf(this)
    if (index > -1) submorphs.splice(index, 1);
    owner.change({prop: "submorphs", value: submorphs});
    return this;
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

  getInOwners(name) {
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

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // events
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  get dragTriggerDistance() { return 5; }
  onMouseDown(evt) {}
  onMouseUp(evt) {}
  onMouseMove(evt) {}

  onDragStart(evt) {
    evt.state.lastDragPosition = evt.position;
  }

  onDrag(evt) {
    this.moveBy(evt.position.subPt(evt.state.lastDragPosition));
    evt.state.lastDragPosition = evt.position;
  }

  onDragEnd(evt) {
    delete evt.state.lastDragPosition;
  }
  
  onGrab(evt) {
    const hand = this.world().withAllSubmorphsDetect((morph) => morph.isHand);
    hand.grab(this);
  }
  
  onDrop(evt) {
    const hand = this.world().get("hand");
    hand.dropMorph();
  }

}

export class WorldMorph extends Morph {

  get isWorld() { return true }

  get draggable() { return false; }
  get grabbable() { return false; }

  handForPointerId(pointerId) {
    return this.submorphs.find(m => m instanceof HandMorph && m.pointerId === pointerId)
        || this.addMorph(new HandMorph(pointerId), this.submorphs[0]);
  }

  world() { return this }
  
  onMouseMove(evt) {
    evt.hand.update(evt);
  }
  
  onMouseDown(evt) {
  }

  onMouseUp(evt) {
  }

  logError(err) {
  }
}

export class HandMorph extends Morph {

  constructor(pointerId) {
    super();
    this.pointerId = pointerId;
    this.fill = Color.orange;
    this.extent = pt(4,4);
    this.reactsToPointer = false;
    this._grabbedMorph = null;
  }

  get isHand() { return true }

  get draggable() { return false; }
  get grabbable() { return false; }

  update(evt) {
    this.position = evt.position;
  }
  
  getMorphBelow() {
    return this.world().withAllSubmorphsDetect(
      (morph) => {
        !morph.isHand && !morph.ownerChain().contains(this)
        morph.bounds.containsRect(this.bounds)
      }
    );
  }
  
  grab(morph) {
    if(morph.grabbable && !this._grabbedMorph){
      const relativePos = morph.positionInWorld().dist(this.positionInWorld());
      this._grabbedMorph = morph.remove();
      this.addMorph(morph);
      morph.position = relativePos;
    }
  }
  
  dropMorph() {
    const target = this.getMorphBelow();
    const relativePos = this._grabbedMorph.positionInWorld().dist(this.positionInWorld());
    target.addMorph(this.remove(this._grabbedMorph))
    this._grabbedMorph.position = relativePos;
    this._grabbedMorph = null;
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
