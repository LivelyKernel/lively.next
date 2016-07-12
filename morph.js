import { Color, pt, rect, Rectangle, Transform } from "lively.graphics";
import { string, obj, arr, num } from "lively.lang";
import { show } from "./markers.js";

export function morph(props = {}, opts = {restore: false}) {
  var klass;
  switch (props.type) {
    case 'world':   klass = World; break;
    case 'hand':    klass = Hand; break;
    case 'image':   klass = Image; break;
    case 'ellipse': klass = Ellipse; break;
    case 'text':    klass = Text; break;
    default:        klass = Morph;
  }
  return opts.restore ?
    new klass({[Symbol.for("lively-instance-restorer")]: true}).initFromJSON(props) :
    new klass(props);
}


const defaultProperties = {
  visible: true,
  name: "a morph",
  position: pt(0,0),
  rotation: 0,
  scale: 1,
  extent: pt(10, 10),
  fill: Color.white,
  borderWidth: 0,
  borderColor: Color.white,
  borderRadius: Rectangle.inset(0),
  clipMode: "visible",
  reactsToPointer: true,
  draggable: true,
  grabbable: true,
  dropShadow: false,
  styleClasses: ["morph"],
  submorphs:  []
}

function newMorphId(morph) {
  return morph.constructor.name + "_" + string.newUUID().replace(/-/g, "_")
}

function dissoc(obj, keys) {
  var clone = obj.clone(obj);
  keys.forEach(name => delete obj[name]);
  return clone;
}

export class Morph {

  constructor(props) {
    this._owner = null;
    this._changes = [];
    this._unrenderedChanges = [];
    this._dirty = true; // for initial display
    this._id = newMorphId(this);
    Object.assign(this, props);
  }

  get _nodeType() { return 'div'; }

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

  show() { return show(this); }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // changes
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  lastChangeFor(prop, onlyRendered = false) {
    var changes = this._changes.concat(onlyRendered ? [] : this._unrenderedChanges);
    for (var i = changes.length-1; i >= 0; i--)
      if (changes[i].prop === prop) return changes[i];
    return null
  }

  recordChange(change) {
    if (!change.target) change.target = this;
    if (!change.owner) change.owner = this.owner;
    if (!change.type) change.type = "setter";
    this._unrenderedChanges.push(change);
    this.makeDirty();
    this.signalMorphChange(change, this);
    return change;
  }

  applyChange(change) {
    // can be used from the outside, e.g. to replay changes
    var {target, type, prop, value, receiver, selector, args} = change;

    if (target !== this)
      throw new Error(`change applied to ${this} which is not the target of the change ${target}`);

    if (type === "setter") {
      this.recordChange(change);
    } else if (type === "method-call") {
      receiver[selector].apply(receiver, args);
    } else {
      throw new Error(`Strange change of type ${type}, cannot apply it! ${obj.inspect(change, {maxDepth: 1})}`);
    }
  }

  commitChanges() {
    this._changes = this._changes.concat(this._unrenderedChanges);
    this._unrenderedChanges = [];
  }

  signalMorphChange(change, morph) {
    if (this.owner) this.owner.signalMorphChange(change, morph);
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
  set name(value)      { this.recordChange({prop: "name", value}); }

  get position()       { return this.getProperty("position"); }
  set position(value)  { this.recordChange({prop: "position", value}); }

  get scale()          { return this.getProperty("scale"); }
  set scale(value)     { this.recordChange({prop: "scale", value}); }

  get rotation()       { return this.getProperty("rotation"); }
  set rotation(value)  { this.recordChange({prop: "rotation", value}); }

  get extent()         { return this.getProperty("extent"); }
  set extent(value)    { this.recordChange({prop: "extent", value}); }

  get fill()           { return this.getProperty("fill"); }
  set fill(value)      { this.recordChange({prop: "fill", value}); }

  get borderWidth()       { return this.getProperty("borderWidth"); }
  set borderWidth(value)  { this.recordChange({prop: "borderWidth", value}); }

  get borderColor()       { return this.getProperty("borderColor"); }
  set borderColor(value)  { this.recordChange({prop: "borderColor", value}); }

  get borderRadius()      { return this.getProperty("borderRadius"); }
  set borderRadius(value) {
    if (typeof value === "number") value = Rectangle.inset(value);
    this.recordChange({prop: "borderRadius", value});
  }

  get clipMode()       { return this.getProperty("clipMode"); }
  set clipMode(value)  { this.recordChange({prop: "clipMode", value}); }

  get draggable()       { return this.getProperty("draggable"); }
  set draggable(value)  { this.recordChange({prop: "draggable", value}); }

  get grabbable()       { return this.getProperty("grabbable"); }
  set grabbable(value)  { this.recordChange({prop: "grabbable", value}); }

  get reactsToPointer()       { return this.getProperty("reactsToPointer"); }
  set reactsToPointer(value)  { this.recordChange({prop: "reactsToPointer", value}); }

  get visible()       { return this.getProperty("visible"); }
  set visible(value)  { this.recordChange({prop: "visible", value}); }

  get dropShadow()      { return this.getProperty("dropShadow"); }
  set dropShadow(value) { this.recordChange({prop: "dropShadow", value}); }

  get styleClasses()       { return this.getProperty("styleClasses").slice(); }
  set styleClasses(value)  { this.recordChange({prop: "styleClasses", value}); }

  addStyleClass(className)  { this.styleClasses = arr.uniq(this.styleClasses.concat(className)) }
  removeStyleClass(className)  { this.styleClasses = this.styleClasses.filter(ea => ea != className) }

  bounds() {
    var tfm = this.getTransform(),
        bounds = this.innerBounds();

    bounds = tfm.transformRectToRect(bounds);

    var subBounds = this.submorphBounds(tfm);
    if (subBounds) bounds = bounds.union(subBounds);

    // FIXME: reactivate when clipping is done
    // if (!this.isClip()) {
    //   var subBounds = this.submorphBounds(tfm);
    //   if (subBounds) bounds = bounds.union(subBounds);
    // } else {
    //   var scroll = this.getScroll();
    //   bounds = bounds.translatedBy(pt(scroll[0], scroll[1]));
    // }

    return bounds;
  }

  setBounds(bounds) {
    this.position = bounds.topLeft();
    this.extent = bounds.extent();
  }

  innerBounds() {
    var {x:w, y:h} = this.extent;
    return rect(0,0,w,h);
  }

  globalBounds() {
    return this.owner ?
      this.owner.getGlobalTransform().transformRectToRect(this.bounds()) :
      this.bounds();
  }

  submorphBounds(tfm) {
    tfm = tfm || this.getTransform();
    var subBounds;
    for (var i = 0; i < this.submorphs.length; i++) {
      var morphBounds = this.submorphs[i].bounds();
      subBounds = subBounds ? subBounds.union(morphBounds) : morphBounds;
    }
    return subBounds ? tfm.transformRectToRect(subBounds) : null;
  }

  align(p1, p2) { return this.moveBy(p2.subPt(p1)); }
  moveBy(delta) { this.position = this.position.addPt(delta); }
  rotateBy(delta) { this.rotation += delta; }
  resizeBy(delta) { this.extent = this.extent.addPt(delta); }

  get width()         { return this.extent.x; }
  set width(v)        { return this.extent = pt(v, this.extent.y); }
  get height()        { return this.extent.y; }
  set height(v)       { return this.extent = pt(this.extent.x, v); }

  get left()          { return this.bounds().left(); }
  set left(v)         { return this.moveBy(pt(v - this.left), 0); }
  get right()         { return this.bounds().right(); }
  set right(v)        { return this.moveBy(pt(v - this.right), 0); }
  get top()           { return this.bounds().top(); }
  set top(v)          { return this.moveBy(pt(0, v - this.top)); }
  get bottom()        { return this.bounds().bottom(); }
  set bottom(v)       { return this.moveBy(pt(0, v - this.bottom)); }

  get center()        { return this.bounds().center(); }
  set center(v)       { return this.align(this.center, v); }
  get topLeft()       { return this.bounds().topLeft(); }
  set topLeft(v)      { return this.align(this.topLeft, v); }
  get topRight()      { return this.bounds().topRight(); }
  set topRight(v)     { return this.align(this.topRight, v); }
  get bottomRight()   { return this.bounds().bottomRight(); }
  set bottomRight(v)  { return this.align(this.bottomRight, v); }
  get bottomLeft()    { return this.bounds().bottomLeft(); }
  set bottomLeft(v)   { return this.align(this.bottomLeft, v); }
  get bottomCenter()  { return this.bounds().bottomCenter(); }
  set bottomCenter(v) { return this.align(this.bottomCenter, v); }
  get topCenter()     { return this.bounds().topCenter(); }
  set topCenter(v)    { return this.align(this.topCenter, v); }
  get leftCenter()    { return this.bounds().leftCenter(); }
  set leftCenter(v)   { return this.align(this.leftCenter, v); }
  get rightCenter()   { return this.bounds().rightCenter(); }
  set rightCenter(v)  { return this.align(this.rightCenter, v); }


  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // morphic relationship
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  get submorphs() { return this.getProperty("submorphs").slice(); }
  set submorphs(newSubmorphs) {
    this.submorphs
      .filter(ea => !arr.include(newSubmorphs, ea))
      .forEach(m => m.remove());
    return newSubmorphs.map((m, i) => {
      if (this.submorphs[i] !== m) this.addMorph(m, this.submorphs[i]);
    });
  }

  addMorphAt(submorph, index) {
    if (submorph.isMorph) {

      // sanity check
      if (submorph.isAncestorOf(this)) {
          alert('addMorph: Circular relationships between morphs not allowed\n'
              + 'tried to drop ' + submorph + ' on ' + this);
          // return null;
          this.remove();
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

    var submorphs = this.submorphs;
    index = Math.min(submorphs.length, Math.max(0, index));
    submorphs.splice(index, 0, submorph);

    this.recordChange({
      prop: "submorphs", value: submorphs,
      type: "method-call",
      receiver: this,
      selector: "addMorphAt",
      args: [submorph, index]
    });

    if (tfm) { submorph.setTransform(tfm); }

    return submorph;
  }

  addMorph(submorph, insertBeforeMorph) {
    // insert at right position in submorph list, according to insertBeforeMorph
    var submorphs = this.submorphs,
        insertBeforeMorphIndex = insertBeforeMorph ? submorphs.indexOf(insertBeforeMorph) : -1,
        insertionIndex = insertBeforeMorphIndex === -1 ? submorphs.length : insertBeforeMorphIndex;

    return this.addMorphAt(submorph, insertionIndex);
  }

  addMorphBack(other) {
    // adds a morph "behind" all other submorphs
    var next = other === this.submorphs[0] ? this.submorphs[1] : this.submorphs[0];
    return this.addMorph(other, next);
  }

  remove() {
    var owner = this.owner;
    if (!owner) return this;
    this._owner = null;
    var submorphs = owner.submorphs,
        index = submorphs.indexOf(this)
    if (index > -1) submorphs.splice(index, 1);
    owner.recordChange({
      prop: "submorphs", value: submorphs,
      type: "method-call",
      owner: owner,
      receiver: this,
      selector: "remove",
      args: [],
      meta: {index}
    });
    return this;
  }

  removeAllMorphs() { this.submorphs = [] }

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
    var result = [func(this)];
    for (let m of this.submorphs)
      arr.pushAll(result, m.withAllSubmorphsDo(func));
    return result;
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
    for (var i = this.submorphs.length-1; i >= 0; i--) {
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

  worldPoint(p) {
    var world = this.world();
    return world ? p.matrixTransform(this.transformToMorph(world)) : p;
  }

  get globalPosition() { return this.worldPoint(pt(0,0)) }
  set globalPosition(p) { return this.position = this.owner ? this.owner.localize(p) : p; }

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
    return this.bounds().containsPoint(p);
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
  onInput(evt) {}

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
    evt.hand.dropMorphsOn(this, evt);
  }


  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // serialization
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  exportToJSON() {
    // quick hack to "snapshot" into JSON
    var allChanges = Object.assign(
          arr.groupByKey(this._changes, "prop"),
          arr.groupByKey(this._unrenderedChanges, "prop")),
        exported = allChanges.reduceGroups((exported, name, props) => {
            var val = this[name];
            if (name === "submorphs") val = val.map(ea => ea.exportToJSON());
            exported[name] = val;
            return exported;
          }, {});
    if (!exported.name) exported.name = this.name;
    exported._id = this._id;
    exported.type = this.constructor.name.toLowerCase();
    return exported;
  }

  initFromJSON(spec) {
    Object.assign(this, {
      _owner: null,
      _changes: [],
      _unrenderedChanges: [],
      _dirty: true,
      _id: newMorphId(this)
    }, spec);
    return this;
  }


  copy() { return morph(Object.assign(this.exportToJSON(), {_id: newMorphId(this)})); }

}

export class World extends Morph {

  constructor(props) {
    super(props);
    this.addStyleClass("world");
  }

  get isWorld() { return true }

  get draggable() { return false; }
  get grabbable() { return false; }

  handForPointerId(pointerId) {
    return this.submorphs.find(m => m instanceof Hand && m.pointerId === pointerId)
        || this.addMorph(new Hand(pointerId), this.submorphs[0]);
  }

  world() { return this }

  get hands() {
    return this.submorphs.filter(ea => ea.isHand);
  }

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

export class Hand extends Morph {

  constructor(pointerId) {
    super({
      fill: Color.orange,
      extent: pt(4,4),
      reactsToPointer: false
    });
    this.pointerId = pointerId;
    this.addStyleClass("hand");
  }

  get isHand() { return true }

  get draggable() { return false; }
  get grabbable() { return false; }

  get grabbedMorphs() { return this.submorphs; }
  
  carriesMorphs() { return !!this.grabbedMorphs.length; }

  update(evt) {
    this.position = evt.position;
  }

  morphBeneath(pos) {
    var someOwner = this.world() || this.owner;
    if (!someOwner) return null;
    var morphs = someOwner.morphsContainingPoint(pos),
        myIdx = morphs.indexOf(this),
        morphBeneath = morphs[myIdx + 1];
    return morphBeneath;
  }

  grab(morph, evt) {
    evt.state.prevProps = {
      dropShadow: morph.dropShadow,
      reactsToPointer: morph.reactsToPointer
    }
    this.addMorph(morph);
    // So that the morph doesn't steal events
    morph.reactsToPointer = false;
    morph.dropShadow = true;
  }

  dropMorphsOn(dropTarget, evt) {
    this.grabbedMorphs.forEach(morph => {
      dropTarget.addMorph(morph)
      morph.reactsToPointer = evt.state.prevProps.reactsToPointer;
      morph.dropShadow = evt.state.prevProps.dropShadow;
    });
  }

}


export class Ellipse extends Morph {

  set borderRadius(_) {}
  get borderRadius() {
    // cut the corners so that a rectangle becomes an ellipse
    var {x:w,y:h} = this.extent;
    return Rectangle.inset(h,w,h,w);
  }

}


export class Image extends Morph {

  constructor(props) {
    super(props);
    if (!this.imageUrl)
      this.imageUrl = 'http://lively-web.org/core/media/lively-web-logo-small.png'
  }

  get isImage() { return true }

  get _nodeType() { return 'img'; }

  get imageUrl()       { return this.getProperty("imageUrl"); }
  set imageUrl(value)  { this.recordChange({prop: "imageUrl", value}); }

  shape() {
    return {
      src: this.imageUrl
    }
  }
}

export class Text extends Morph {

  constructor(props, submorphs) {
    super(props, submorphs);
    if (typeof this.allowsInput !== "boolean") {
      this.allowsInput = true;
    }
  }

  get isText() { return true }

  get _nodeType() { return 'textarea'; }

  get textString() { return this.getProperty("textString") }
  set textString(value) { this.recordChange({prop: "textString", value}) }

  get allowsInput() { return this.getProperty("allowsInput") }
  set allowsInput(value) { this.recordChange({prop: "allowsInput", value}) }

  get autoFitsOnInput() { return this.getProperty("autoFitsOnInput") }
  set autoFitsOnInput(value) { this.recordChange({prop: "autoFitsOnInput", value}) }

  shape() {
    return {
      value: this.textString,
      readOnly: !this.allowsInput,
      style: { resize: "none", border: "none", overflow: "hidden", "white-space": "nowrap" }
    }
  }

  autoFit(domNode) {
    domNode.style.height = "0px";
    domNode.style.width = "0px";
    var newHeight = domNode.scrollHeight,
        newWidth = domNode.scrollWidth;
    domNode.style.height = newHeight + "px";
    domNode.style.width = newWidth + "px";
    this.height = newHeight;
    this.width = newWidth;
  }

  onInput(evt) {
    this.textString = evt.domEvt.target.value;
    if (this.autoFitsOnInput) this.autoFit(evt.domEvt.target);
  }
}
