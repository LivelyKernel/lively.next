import { Color, pt, rect, Transform } from "lively.graphics";
import { string, obj, arr, num } from "lively.lang";

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
  dropShadow: false,
  styleClasses: ["morph"],
  submorphs:  []
}


export class Morph {

  constructor(props, submorphs) {
    this._nodeType = 'div';
    this._owner = null;
    this._changes = []
    this._unrenderedChanges = [];
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

  lastChangeFor(prop, onlyRendered = false) {
    var changes = this._changes.concat(onlyRendered ? [] : this._unrenderedChanges);
    for (var i = changes.length-1; i >= 0; i--)
      if (changes[i].prop === prop) return changes[i];
    return null
  }

  change(change) {
    this._unrenderedChanges.push(change);
    this.makeDirty();
    return change;
  }

  commitChanges() {
    this._changes = this._changes.concat(this._unrenderedChanges);
    this._unrenderedChanges = [];
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // render hooks
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  makeDirty() {
    this._dirty = true;
    if (this.owner) this.owner.makeDirty();
  }

  needsRerender() {
    return this._dirty || !!this._unrenderedChanges.length;
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

  get visible()       { return this.getProperty("visible"); }
  set visible(value)  { this.change({prop: "visible", value}); }
  
  get dropShadow()      { return this.getProperty("dropShadow"); }
  set dropShadow(value) { this.change({prop: "dropShadow", value}); }

  get styleClasses()       { return this.getProperty("styleClasses").slice(); }
  set styleClasses(value)  { this.change({prop: "styleClasses", value}); }
  addStyleClass(className)  { this.styleClasses = arr.uniq(this.styleClasses.concat(className)) }
  removeStyleClass(className)  { this.styleClasses = this.styleClasses.filter(ea => ea != className) }

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

  globalBounds() {
    return this.owner ?
      this.owner.getGlobalTransform().transformRectToRect(this.bounds) :
      this.bounds;
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
    if (submorph.isMorph) {

      // sanity check
      if (submorph.isAncestorOf(this)) {
          alert('addMorph: Circular relationships between morphs not allowed\n'
              + 'tried to drop ' + submorph + ' on ' + this);
          return null;
      }

      // tramsformation of new owner is applied to morph
      var tfm = submorph.owner
             && submorph.owner !== this
             && submorph.transformForNewOwner(this);

      if (submorph.owner) submorph.remove();
    }

    // ensure it's a morph and not just a spec
    if (!submorph || typeof submorph !== "object")
      throw new Error(`${submorph} cannot be added as a submorph to ${this}`)
    if (!submorph.isMorph) submorph = morph(submorph);

    // set new owner
    submorph._owner = this;

    // insert at right position in submorph list, according to insertBeforeMorph
    var submorphs = this.submorphs,
        insertBeforeMorphIndex = insertBeforeMorph ? submorphs.indexOf(insertBeforeMorph) : -1,
        insertionIndex = insertBeforeMorphIndex === -1 ? submorphs.length : insertBeforeMorphIndex;
    submorphs.splice(insertionIndex, 0, submorph);

    this.change({prop: "submorphs", value: submorphs});

    if (tfm) { submorph.setTransform(tfm); }

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

  isAncestorOf(aMorph) {
    // check if aMorph is somewhere in my submorph graph
    return !!this.withAllSubmorphsDetect(ea => ea === aMorph);
  }
  
  morphsContainingPoint(point, list) {
    // if morph1 visually before morph2 than list.indexOf(morph1) < list.indexOf(morph2)
    if (!list) list = [];
    if (!this.fullContainsWorldPoint(point)) return list;
    for (var i = this.submorphs.length -1 ; i >=0; i--) {
        this.submorphs[i].morphsContainingPoint(point, list);
    }
    if (this.innerBoundsContainsWorldPoint(point)) list.push(this);
    return list;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // transforms
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  localize(point) {
    // map world point to local coordinates
    var world = this.world();
    return world ? point.matrixTransform(world.transformToMorph(this)) : point;
  }

  transformToMorph(other) {
    var tfm = this.getGlobalTransform(),
        inv = other.getGlobalTransform().inverse();
    tfm.preConcatenate(inv);
    return tfm;
  }

  transformForNewOwner(newOwner) {
    return new Transform(this.transformToMorph(newOwner));
  }

  localizePointFrom(pt, otherMorph) {
    // map local point to owner coordinates
    try {
      return pt.matrixTransform(otherMorph.transformToMorph(this));
    } catch (er) {
      console.warn("problem " + er + " in localizePointFrom");
      return pt;
    }
  }

  getGlobalTransform() {
    var globalTransform = new Transform(),
        world = this.world();
    for (var morph = this; (morph != world) && (morph != undefined); morph = morph.owner)
      globalTransform.preConcatenate(morph.getTransform());
    return globalTransform;
  }

  worldPoint(pt) {
    return pt.matrixTransform(this.transformToMorph(this.world()));
  }

  getTransform () {
    var scale = this.scale,
        pos = this.position;
    if (typeof scale === "number") scale = pt(scale,scale);
    // FIXME reactivate
    // if (this.isClip()) {
    //   var scroll = this.getScroll();
    //   pos = pos.subXY(scroll[0], scroll[1]);
    // }
    return new Transform(pos, this.rotation, scale);
  }

  setTransform(tfm) {
    this.position = tfm.getTranslation();
    this.rotation = num.toRadians(tfm.getRotation());
    this.scale = tfm.getScalePoint().x;
  }

  fullContainsWorldPoint(p) { // p is in world coordinates
    return this.fullContainsPoint(this.owner == null ? p : this.owner.localize(p));
  }

  fullContainsPoint(p) { // p is in owner coordinates
    return this.bounds.containsPoint(p);
  }

  innerBoundsContainsWorldPoint(p) { // p is in world coordinates
    return this.innerBoundsContainsPoint(this.owner == null ? p : this.localize(p));
  }

  innerBoundsContainsPoint(p) { return this.innerBounds().containsPoint(p);  }

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
    evt.hand.grab(this, evt);
  }

  onDrop(evt) {
    evt.hand.dropMorph(evt);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // serialization
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  exportToJSON() {
    // quick hack to "snapshot" world into JSON
    var exported = arr.groupByKey(this._changes, "prop").reduceGroups((exported, name, props) => {
      var val = this[name];
      if (name === "submorphs") val = val.map(ea => ea.exportToJSON());
      exported[name] = val;
      return exported;
    }, {});
    if (!exported.name) exported.name = this.name;
    exported._id = this._id;
    return exported;
  }

}

export class WorldMorph extends Morph {

  constructor(props) {
    super(props);
    this.addStyleClass("world");
  }

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
    this.addStyleClass("hand");
  }

  get isHand() { return true }

  get draggable() { return false; }
  get grabbable() { return false; }

  update(evt) {
    this.position = evt.position;
  }
  
  morphBeneath(pos) {
      var someOwner = this.world() || this.owner;
      if (!someOwner) return null;
      var morphs = someOwner.morphsContainingPoint(pos),
          myIdx = morphs.indexOf(this),
          morphBeneath = morphs[myIdx + 1];
      return morphBeneath
  }

  grab(morph, evt) {
    if (morph.grabbable) {
      evt.state.prevProps = {
        dropShadow: morph.dropShadow,
        reactsToPointer: morph.reactsToPointer
      }
      this.addMorph(morph);
      // So that the morph doesn't steal events
      morph.reactsToPointer = false;
      morph.dropShadow = true;
    }
  }

  dropMorph(evt) {
    this.submorphs.forEach(morph => {
      this.morphBeneath(this.position).addMorph(morph)
      morph.reactsToPointer = evt.state.prevProps.reactsToPointer;
      morph.dropShadow = evt.state.prevProps.dropShadow;
    });
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
