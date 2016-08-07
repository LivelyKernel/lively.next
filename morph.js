import { Color, pt, rect, Rectangle, Transform } from "lively.graphics";
import { string, obj, arr, num, promise, tree } from "lively.lang";
import { renderRootMorph } from "./rendering/morphic-default.js"
import { morph, show } from "./index.js";
import { MorphicEnv } from "./env.js";
import config from "./config.js";


const defaultProperties = {
  visible: true,
  name: "a morph",
  position:  pt(0,0),
  rotation:  0,
  scale:  1,
  opacity: 1,
  origin: pt(0,0),
  extent: pt(10, 10),
  fill: Color.white,
  borderWidth: 0,
  borderColor: Color.white,
  borderRadius: Rectangle.inset(0),
  clipMode: "visible",
  reactsToPointer: true,
  draggable: true,
  grabbable: false,
  halosEnabled: !!config.halosEnabled,
  dropShadow: false,
  styleClasses: ["morph"],
  nativeCursor: "auto",
  focusable: true,
  submorphs:  []
}

function newMorphId(prefix) {
  return prefix + "_" + string.newUUID().replace(/-/g, "_")
}

export class Morph {

  constructor(props = {}) {
    var env = props.env || MorphicEnv.default();
    this._env = env;
    this._rev = env.changeManager.revision;
    this._owner = null;
    this._dirty = true; // for initial display
    this._currentState = {...defaultProperties};
    this._id = newMorphId(this.constructor.name);
    this._cachedBounds = null;
    if (props.env) props = obj.dissoc(props, ["env"]);
    if (props.bounds) {
      this.setBounds(props.bounds);
      props = obj.dissoc(props, ["bounds"]);
    }
    if (props.type) props = obj.dissoc(props, ["type"]);
    Object.assign(this, props);
  }

  get __only_serialize__() { return Object.keys(this._currentState); }

  get isMorph() { return true; }
  get id() { return this._id; }

  get env() { return this._env; }

  defaultProperty(key) { return defaultProperties[key]; }
  getProperty(key) { return this._currentState[key]; }

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

  onChange(change) {
    if (change.prop == "layout" && change.value) change.value.applyTo(this);
    if (["submorphs", "extent"].includes(change.prop) && this.layout) this.layout.applyTo(this);
  }

  onSubmorphChange(submorph, change) {
    if (this.layout) this.layout.applyTo(this);
    else this.refreshLayoutIfNeeded(change);
  }

  refreshLayoutIfNeeded(submorphChange) {
    const needsRefresh = ["extent", "position", "scale", "rotation"].includes(submorphChange.prop);
    if (this.layout && needsRefresh) this.layout.applyTo(this);
  }

  get changes() { return this.env.changeManager.changesFor(this); }
  applyChange(change) { this.env.changeManager.apply(this, change); }

  addValueChange(prop, value, meta) {
    return this.env.changeManager.addValueChange(this, prop, value, meta);
  }

  addMethodCallChangeDoing(receiver, selector, args, prop, value, doFn) {
    return this.env.changeManager.addMethodCallChangeDoing(this, receiver, selector, args, prop, value, doFn)
  }

  groupChangesWhile(groupChange, whileFn) {
    return this.env.changeManager.groupChangesWhile(this, groupChange, whileFn);
  }

  recordChangesWhile(whileFn, optFilter) {
    return this.env.changeManager.recordChangesWhile(whileFn, optFilter);
  }

  recordChangesStart(optFilter) {
    return this.env.changeManager.recordChangesStartForMorph(this, optFilter);
  }

  recordChangesStop(id) {
    return this.env.changeManager.recordChangesStopForMorph(this, id);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // undo
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  undoStart(name) {
    return this.env.undoManager.undoStart(this, name);
  }

  undoStop(name) {
    return this.env.undoManager.undoStop(this, name);
  }

  get undoInProgress() { return this.env.undoManager.undoInProgress; }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // morphic interface
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  get layout()         { return this.getProperty("layout") }
  set layout(value)    { this.addValueChange("layout", value); }

  get name()           { return this.getProperty("name"); }
  set name(value)      { this.addValueChange("name", value); }

  get position()       { return this.getProperty("position"); }
  set position(value)  { this._cachedBounds = null; this.addValueChange("position", value); }

  get scale()          { return this.getProperty("scale"); }
  set scale(value)     { this._cachedBounds = null; this.addValueChange("scale", value); }

  get rotation()       { return this.getProperty("rotation"); }
  set rotation(value)  { this._cachedBounds = null; this.addValueChange("rotation", value); }

  get origin()         { return this.getProperty("origin"); }
  set origin(value)    { return this.addValueChange("origin", value); }

  get extent()         { return this.getProperty("extent"); }
  set extent(value)    { this._cachedBounds = null; this.addValueChange("extent", value); }

  get fill()           { return this.getProperty("fill"); }
  set fill(value)      { this.addValueChange("fill", value); }

  get borderWidth()       { return this.getProperty("borderWidth"); }
  set borderWidth(value)  { this.addValueChange("borderWidth", value); }

  get borderColor()       { return this.getProperty("borderColor"); }
  set borderColor(value)  { this.addValueChange("borderColor", value); }

  get borderRadius()      { return this.getProperty("borderRadius"); }
  set borderRadius(value) {
    if (typeof value === "number") value = Rectangle.inset(value);
    this.addValueChange("borderRadius", value);
  }

  get clipMode()       { return this.getProperty("clipMode"); }
  set clipMode(value)  { this.addValueChange("clipMode", value); }

  get draggable()       { return this.getProperty("draggable"); }
  set draggable(value)  { this.addValueChange("draggable", value); }

  get grabbable()       { return this.getProperty("grabbable"); }
  set grabbable(value)  { this.addValueChange("grabbable", value); }

  get halosEnabled()       { return this.getProperty("halosEnabled"); }
  set halosEnabled(value)  { this.addValueChange("halosEnabled", value); }

  // does this morph react to pointer / mouse events
  get reactsToPointer()       { return this.getProperty("reactsToPointer"); }
  set reactsToPointer(value)  { this.addValueChange("reactsToPointer", value); }

  // The shape of the OS mouse cursor. nativeCursor can be one of
  // auto, default, none, context-menu, help, pointer, progress, wait, cell,
  // crosshair, text, vertical-text, alias, copy, move, no-drop, not-allowed,
  // e-resize, n-resize, ne-resize, nw-resize, s-resize, se-resize, sw-resize,
  // w-resize, ew-resize, ns-resize, nesw-resize, nwse-resize, col-resize,
  // row-resize, all-scroll, zoom-in, zoom-out, grab, grabbing
  get nativeCursor()       { return this.getProperty("nativeCursor"); }
  set nativeCursor(value)  { this.addValueChange("nativeCursor", value); }

  // can this morph receive keyboard focus?
  get focusable()       { return this.getProperty("focusable"); }
  set focusable(value)  { this.addValueChange("focusable", value); }

  get visible()       { return this.getProperty("visible"); }
  set visible(value)  { this.addValueChange("visible", value); }

  get dropShadow()      { return this.getProperty("dropShadow"); }
  set dropShadow(value) { this.addValueChange("dropShadow", value); }

  get styleClasses()       { return this.getProperty("styleClasses").slice(); }
  set styleClasses(value)  { this.addValueChange("styleClasses", value); }

  addStyleClass(className)  { this.styleClasses = arr.uniq(this.styleClasses.concat(className)) }
  removeStyleClass(className)  { this.styleClasses = this.styleClasses.filter(ea => ea != className) }

  adjustOrigin(newOrigin) {
    var oldOrigin = this.origin,
        oldPos = this.globalBounds().topLeft();
    this.origin = newOrigin;
    this.submorphs.forEach((m) =>
      m.position = m.position.subPt(newOrigin.subPt(oldOrigin)));
    var newPos = this.globalBounds().topLeft(),
        globalDelta = oldPos.subPt(newPos)
    this.globalPosition = this.globalPosition.addPt(globalDelta);
  }

  bounds() {
    if (this._cachedBounds) return this._cachedBounds;

    var tfm = this.getTransform(),
        bounds = this.innerBounds();

    bounds = tfm.transformRectToRect(bounds);

    var subBounds = this.submorphBounds();
    if (subBounds) bounds = bounds.union(subBounds);

    // FIXME: reactivate when clipping is done
    // if (!this.isClip()) {
    //   var subBounds = this.submorphBounds(tfm);
    //   if (subBounds) bounds = bounds.union(subBounds);
    // } else {
    //   var scroll = this.getScroll();
    //   bounds = bounds.translatedBy(pt(scroll[0], scroll[1]));
    // }
    this._cachedBounds = bounds;
    return bounds;
  }

  setBounds(bounds) {
    this._cachedBounds = bounds;
    this.position = bounds.topLeft().addPt(this.origin);
    this.extent = bounds.extent();
  }

  innerBounds() {
    var {x:w, y:h} = this.extent;
    return rect(0,0,w,h);
  }

  globalBounds() {
    if (this.owner) {
       var tfm = new Transform()
                  .preConcatenate(new Transform(this.origin).inverse())
                  .preConcatenate(this.getGlobalTransform()),
          bounds = tfm.transformRectToRect(this.innerBounds()),
          subBounds = this.submorphBounds(this.getGlobalTransform());
        if (subBounds) bounds = bounds.union(subBounds);
        return bounds;
    } else {
      return this.bounds();
    }
  }

  submorphBounds(tfm) {
    tfm = tfm || this.getTransform();
    var subBounds;
    for (var i = 0; i < this.submorphs.length; i++) {
      var morphBounds = this.submorphs[i].globalBounds();
      subBounds = subBounds ? subBounds.union(morphBounds) : morphBounds;
    }
    return subBounds;
    // return subBounds ? tfm.transformRectToRect(subBounds) : null;
  }

  align(p1, p2) { return this.moveBy(p2.subPt(p1)); }
  moveBy(delta) {
    var bounds = this._cachedBounds;
    if (bounds)
      bounds = bounds.translatedBy(delta);
    this.position = this.position.addPt(delta);
    this._cachedBounds = bounds;
  }
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

  get isEpiMorph() { /*transient "meta" morph*/ return false; }
  isUsedAsEpiMorph() {
    var m = this;
    while (m) { if (m.isEpiMorph) return true; m = m.owner; }
    return false;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // morphic relationship
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  get submorphs() { return this.getProperty("submorphs").slice(); }
  set submorphs(newSubmorphs) {
    this.submorphs.forEach(m => newSubmorphs.includes(m) || m.remove());
    newSubmorphs.forEach((m, i) =>
      this.submorphs[i] !== m && this.addMorph(m, this.submorphs[i]));
  }

  addMorphAt(submorph, index) {
    // ensure it's a morph or a spec
    if (!submorph || typeof submorph !== "object")
      throw new Error(`${submorph} cannot be added as a submorph to ${this}`)

    // sanity check
    if (submorph.isMorph && submorph.isAncestorOf(this)) {
      this.env.world.logError(new Error(`addMorph: Circular relationships between morphs not allowed\ntried to add ${submorph} to ${this}`));
      return null;
    }

    if (!submorph.isMorph) submorph = morph(submorph);

    this._cachedBounds = null;

    var prevOwner = submorph.owner,
        submorphs = this.submorphs;

    // modify the submorphs array
    index = Math.min(submorphs.length, Math.max(0, index));
    // is the morph already in submorphs? Remove it and fix index
    var existingIndex = submorphs.indexOf(submorph);
    if (existingIndex !== -1) {
      submorphs.splice(existingIndex, 1);
      if (existingIndex < index) index--;
    }
    submorphs.splice(index, 0, submorph);

    this.addMethodCallChangeDoing(
      this,              /*receiver*/
      "addMorphAt",      /*selector*/
      [submorph, index], /*args*/
      "submorphs",       /*prop*/
      submorphs          /*value*/,
      () => {
        var tfm;
        if (prevOwner && prevOwner !== this) {
        // since morph transforms are local to a morphs owner we need to
        // compute a new transform for the morph inside the new owner so that the
        // morphs does not appear to change its position / rotation / scale
          tfm = submorph.transformForNewOwner(this);
          submorph.remove();
        }

        // set new owner
        submorph._owner = this;
        if (tfm) submorph.setTransform(tfm);
      });

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

  removeMorph(morph) {
    var index = this.submorphs.indexOf(morph);
    if (index === -1) return;

    var submorphs = this.submorphs;
    submorphs.splice(index, 1);

    this.addMethodCallChangeDoing(
      this,           /*receiver*/
      "removeMorph",  /*selector*/
      [morph],        /*args*/
      "submorphs",    /*prop*/
      submorphs,      /*value*/
      () => {
        this._cachedBounds = null;
        morph._owner = null;
      });
  }

  remove() {
    if (this.owner) this.owner.removeMorph(this);
    return this
  }

  removeAllMorphs() { this.submorphs = []; }

  bringToFront() {
    const submorphs = this.owner.submorphs,
          index = submorphs.indexOf(this);
    submorphs.splice(index,1);
    this.owner.submorphs = submorphs.concat(this);
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
    // check if aMorph is somewhere in my submorph tree
    var owner = aMorph.owner;
    while (owner) { if (owner === this) return true; owner = owner.owner; }
    return false;
  }

  morphsContainingPoint(point, list) {
    // if morph1 visually before morph2 than list.indexOf(morph1) < list.indexOf(morph2)
    if (!list) list = [];
    if (!this.fullContainsWorldPoint(point)) return list;
    for (var i = this.submorphs.length-1; i >= 0; i--)
      this.submorphs[i].morphsContainingPoint(point, list);
    if (this.innerBoundsContainsWorldPoint(point)) list.push(this);
    return list;
  }

  morphBeneath(pos) {
    // returns the morph that is visually stacked below this morph at pos
    // note that this is independent of the morph hierarchy
    var someOwner = this.world() || this.owner;
    if (!someOwner) return null;
    var morphs = someOwner.morphsContainingPoint(pos),
        myIdx = morphs.indexOf(this),
        morphBeneath = morphs[myIdx + 1];
    return morphBeneath;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // transforms
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  localize(point) {
    // map world point to local coordinates
    var world = this.world();
    return world ? point.matrixTransform(world.transformToMorph(this)) : point;
  }

  worldPoint(p) {
    var world = this.world();
    return world ? p.matrixTransform(this.transformToMorph(world)) : p;
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
    for (var morph = this; (morph != world) && (morph != undefined); morph = morph.owner) {
      globalTransform
        .preConcatenate(new Transform(morph.origin))
        .preConcatenate(morph.getTransform())
    }
    return globalTransform;
  }

  get globalPosition() { return this.worldPoint(pt(0,0)) }
  set globalPosition(p) { return this.position = (this.owner ? this.owner.localize(p) : p); }

  getTransform() {
    var scale = this.scale,
        pos = this.position,
        moveToOrigin = new Transform(this.origin);

    if (typeof scale === "number") scale = pt(scale,scale);
    // FIXME reactivate
    // if (this.isClip()) {
    //   var scroll = this.getScroll();
    //   pos = pos.subXY(scroll[0], scroll[1]);
    // }

    return moveToOrigin.inverse()
      .preConcatenate(new Transform(pos, this.rotation, scale));
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

  innerBoundsContainsPoint(p) { // p is in local coordinates (offset by origin)
    return this.innerBounds().containsPoint(p.addPt(this.origin));
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // nameing
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  get(name) {
    // search below, search siblings, search upwards
    if (!name) return null;
    try {
      return (this.getNameTest(this, name) && this)
          || this.getSubmorphNamed(name)
          || this.getOwnerNamed(name);
    } catch(e) {
      if (e.constructor == RangeError && e.message == "Maximum call stack size exceeded") {
        e = new Error("'get' failed due to a stack overflow. The most\n"
          + "likely source of the problem is using 'get' as part of\n"
          + "toString, because 'get' calls 'getOwnerNamed', which\n"
          + "calls 'toString' on this. Try using 'getSubmorphNamed' instead,\n"
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

  getSubmorphNamed(name) {
    if (!this.submorphs.length) return null;
    var isRe = obj.isRegExp(name);
    for (var i = 0; i < this.submorphs.length; i++) {
      var morph = this.submorphs[i];
      if (this.getNameTest(morph, name)) return morph
    }
    for (var i = 0; i < this.submorphs.length; i++)  {
      var morph = this.submorphs[i].getSubmorphNamed(name);
      if (morph) return morph;
    }
    return null;
  }

  getOwnerNamed(name) {
    var owner = this.owner;
    if (!owner) return null;
    for (var i = 0; i < owner.submorphs.length; i++) {
      var morph = owner.submorphs[i];
      if (morph === this) continue;
      if (this.getNameTest(morph, name)) return morph;
      var foundInMorph = morph.getSubmorphNamed(name);
      if (foundInMorph) return foundInMorph;
    }
    return this.owner.getOwnerNamed(name);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // events
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  get dragTriggerDistance() { return 0; }

  onMouseDown(evt) {
    if (this === evt.targetMorph) {
      setTimeout(() => {
        if (this.grabbable && !evt.state.draggedMorph && evt.state.clickedOnMorph === this && !evt.hand.carriesMorphs())
          evt.hand.grab(this);
      }, 800);
    }
  }

  onMouseUp(evt) {}
  onMouseMove(evt) {}

  onFocus(evt) {}
  onBlur(evt) {}
  onKeyDown(evt) {}
  onKeyUp(evt) {}
  onContextMenu(evt) {}
  onCut(evt) {}
  onCopy(evt) {}
  onPaste(evt) {}

  onDragStart(evt) { this.undoStart("drag-move"); }
  onDragEnd(evt) { this.undoStop("drag-move"); }
  onDrag(evt) { this.moveBy(evt.state.dragDelta); }


  onGrab(evt) {
    evt.hand.grab(this);
  }

  onDrop(evt) {
    evt.hand.dropMorphsOn(this);
  }

  onHoverIn(evt) {}
  onHoverOut(evt) {}

  focus() {
    this._wantsFocus = true;
    this._dirty = true;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // serialization
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  exportToJSON(options = {keepFunctions: true}) {
    // quick hack to "snapshot" into JSON
    var exported = Object.keys(this._currentState).reduce((exported, name) => {
      var val = this[name];
      if (name === "submorphs") val = val.map(ea => ea.exportToJSON());
      exported[name] = val;
      return exported;
    }, {});
    if (!exported.name) exported.name = this.name;
    exported._id = this._id;
    exported._class = this.constructor;
    exported.type = this.constructor.name.toLowerCase();
    if (options.keepFunctions) {
      Object.keys(this).forEach(name =>
        typeof this[name] === "function" && (exported[name] = this[name]));
    }
    return exported;
  }

  initFromJSON(spec) {
    Object.assign(this, {
      _owner: null,
      _dirty: true,
      _id: newMorphId(this.constructor.name)
    }, spec);
    return this;
  }

  copy() {
    var exported = this.exportToJSON();
    tree.prewalk(exported, spec => spec._id = newMorphId(spec.type), ({submorphs}) => submorphs);
    exported.name = exported.name.replace(
        /copy( [0-9]+)?$/,
        (_, num) => `copy ${num && num.trim() ? Number(num)+1 : "1"}`);
    return morph(exported);
  }


  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // rendering
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  makeDirty() {
    if (this._dirty) return;
    this._dirty = true;
    if (this.owner) this.owner.makeDirty();
  }

  needsRerender() { return this._dirty; }

  aboutToRender() {
    if (this._wantsFocus) {
      const node =  this.world()._renderer.getNodeForMorph(this);
      if (node) {
        node.focus();
        this._wantsFocus = false;
      }
    }
    this._dirty = false;
  }

  whenRendered() {
    return promise.waitFor(() => !this.needsRerender()).then(() => this);
  }

  render(renderer) { return renderer.renderMorph(this); }

  renderAsRoot(renderer) { return renderRootMorph(this, renderer); }

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
      this.imageUrl = 'http://localhost:9001/core/media/lively-web-logo-small.png'
  }

  get isImage() { return true }

  get imageUrl()       { return this.getProperty("imageUrl"); }
  set imageUrl(value)  { this.addValueChange("imageUrl", value); }

  render(renderer) {
    return renderer.renderImage(this);
  }
}

export class Path extends Morph {

  get borderStyle() { return this.getProperty("borderStyle") }
  set borderStyle(value) { this.addValueChange("borderStyle", value) }

  get vertices() { return this.getProperty("vertices")}
  set vertices(value) { this.addValueChange("vertices", value)}

  resizeBy(delta) {
    const oldExtent = this.extent;
    super.resizeBy(delta);
    this.scaleVerticesBy(this.extent.scaleByPt(oldExtent.inverted()));
  }

  setBounds(bounds) {
    const oldExtent = this.extent;
    super.setBounds(bounds);
    this.scaleVerticesBy(this.extent.scaleByPt(oldExtent.inverted()));
  }

  scaleVerticesBy(scale) {
    const vs = this.vertices;
    this.vertices = vs && vs.map((v) => v.scaleByPt(scale));
  }

  addVertex(v, before=null) {
    if (before) {
      const insertIndex = this.vertices.indexOf(before);
      this.vertices = this.vertices.splice(insertIndex, 0, v);
    } else {
      this.vertices = this.vertices.concat(v);
    }
  }

  render(renderer) {
    return renderer.renderPath(this);
  }
}

export class Polygon extends Path {

  constructor(props) {
    if (props.vertices && props.vertices.length > 2) {
      super(props)
    } else {
      throw new Error("A polygon requires 3 or more vertices!");
    }
  }

  render(renderer) {
    return renderer.renderPolygon(this);
  }

}
