import { Color, pt, rect, Rectangle, Transform } from "lively.graphics";
import { string, obj, arr, num, promise, tree, fun } from "lively.lang";
import { signal } from "lively.bindings";
import { renderRootMorph, AnimationQueue, ShadowObject } from "./rendering/morphic-default.js"
import { morph, show } from "./index.js";
import { MorphicEnv } from "./env.js";
import config from "./config.js";
import CommandHandler from "./CommandHandler.js";
import KeyHandler, { findKeysForPlatform } from "./events/KeyHandler.js";
import { TargetScript } from "./ticking.js";
import { connect } from "lively.bindings";

const defaultCommandHandler = new CommandHandler();

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
  borderStyleLeft: "solid", borderWidthLeft: 0, borderColorLeft: Color.white, borderRadiusLeft: 0,
  borderStyleRight: "solid", borderWidthRight: 0, borderColorRight: Color.white, borderRadiusRight: 0,
  borderStyleBottom: "solid", borderWidthBottom: 0, borderColorBottom: Color.white, borderRadiusBottom: 0,
  borderStyleTop: "solid", borderWidthTop: 0, borderColorTop: Color.white, borderRadiusTop: 0,
  clipMode: "visible",
  scroll: pt(0,0),
  reactsToPointer: true,
  draggable: true,
  grabbable: false,
  halosEnabled: !!config.halosEnabled,
  dropShadow: false,
  styleClasses: ["morph"],
  nativeCursor: "auto",
  focusable: true,
  epiMorph: false,
  submorphs:  []
}

function newMorphId(classOrClassName) {
  var prefix = typeof classOrClassName === "function" ?
    classOrClassName.name : typeof classOrClassName === "string" ?
      classOrClassName.toLowerCase() : "";
  return prefix + "_" + string.newUUID().replace(/-/g, "_")
}

export class Morph {

  constructor(props = {}) {
    var env = props.env || MorphicEnv.default();
    this._env = env;
    this._rev = env.changeManager.revision;
    this._owner = null;
    this._dirty = true; // for renderer, signals need  to re-render
    this._rendering = false; // for knowing when rendering is done
    this._submorphOrderChanged = false; // extra info for renderer
    this._currentState = {...this.defaultProperties};
    this._id = newMorphId(this.constructor.name);
    this._animationQueue = new AnimationQueue(this);
    this._cachedPaths = {};
    this._pathDependants = [];
    this.tickingScripts = [];
    this.updateTransform(this);
    if (props.submorphs) this.submorphs = props.submorphs;
    if (props.bounds) this.setBounds(props.bounds);
    Object.assign(this, obj.dissoc(props, ["env", "type", "submorphs", "bounds", "layout"]));
    if (props.layout) this.layout = props.layout;
  }

  __deserialize__(snapshot, objRef) {
    // inspect({snapshot, objRef})
    this._env = MorphicEnv.default(); // FIXME!
    this._rev = snapshot.rev;
    this._owner = null;
    this._dirty = true; // for renderer, signals need  to re-render
    this._rendering = false; // for knowing when rendering is done
    this._submorphOrderChanged = false; // extra info for renderer
    this._currentState = {...this.defaultProperties};
    this._id = objRef.id;
    this._animationQueue = new AnimationQueue(this);
    this.updateTransform(this);
  }

  get __only_serialize__() {
    return Object.keys(this._currentState)
      .filter(key => this[key] != this.defaultProperties[key])
        .concat("tickingScripts");
  }

  get isMorph() { return true; }
  get id() { return this._id; }

  get env() { return this._env; }

  get defaultProperties() { return defaultProperties; }
  defaultProperty(key) { return this.defaultProperties[key]; }
  getProperty(key) { return this._currentState[key]; }
  setProperty(key, value, meta) { return this.addValueChange(key, value, meta); }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // debugging
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  toString() {
    return `<${this.constructor.name} - ${this.name ? this.name : this.id}>`;
  }

  show() { return show(this); }

  setStatusMessage(msg, color) {
    var w = this.world();
    return w ? w.setStatusMessage(msg, color) : console.log(msg)
  }

  showError(err) {
    var w = this.world();
    return w ? w.showError(err) : console.error(err)
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // changes
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  onChange(change) {
    const anim = change.meta && change.meta.animation;
    if (['position', 'rotation', 'scale', 'origin', 'reactsToPointer'].includes(change.prop))
        this.updateTransform({[change.prop]: change.value});
    if (change.prop == "layout") {
      if (anim) {
         change.value && change.value.attachAnimated(anim.duration, this, anim.easing);
      } else {
         change.value && change.value.apply();
      }
    }
    this.layout && this.layout.onChange(change);
    this.styleRules && this.styleRules.onMorphChange(this, change);
  }

  onSubmorphChange(change, submorph) {
    this.layout && this.layout.onSubmorphChange(submorph, change);
    this.styleRules && this.styleRules.onMorphChange(submorph, change);
  }

  get changes() { return this.env.changeManager.changesFor(this); }
  applyChange(change) { this.env.changeManager.apply(this, change); }

  addValueChange(prop, value, meta) {
    return this.env.changeManager.addValueChange(this, prop, value, meta);
  }

  addMethodCallChangeDoing(spec, doFn) {
    // spec = {target, selector, args, undo}
    return this.env.changeManager.addMethodCallChangeDoing(spec, this, doFn);
  }

  groupChangesWhile(groupChange, whileFn) {
    return this.env.changeManager.groupChangesWhile(this, groupChange, whileFn);
  }

  dontRecordChangesWhile(whileFn) {
    return this.env.changeManager.dontRecordChangesWhile(this, whileFn);
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

  withMetaDo(meta, doFn) {
    return this.env.changeManager.doWithValueChangeMeta(meta, this, doFn);
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

  async animate(config) {
    const anim = this._animationQueue.registerAnimation(config);
    if (!this._animationQueue.animationsActive) {
      anim && anim.finish();
      return this;
    }
    return anim ? anim.asPromise() : this;
  }

  get morphClasses() { return this.getProperty("morphClasses"); }
  set morphClasses(classes) { this.setProperty("morphClasses", classes); }

  get styleRules() { return this.getProperty("styleRules"); }
  set styleRules(rules) {
     if (rules) rules.applyToAll(this);
     this.setProperty("styleRules", rules);
  }
  
  get layout()         { return this.getProperty("layout") }
  set layout(value)    {
    if (value) value.container = this;
    this.setProperty("layout", value);
  }

  get name()           { return this.getProperty("name"); }
  set name(value)      { this.setProperty("name", value); }

  get position()       { return this.getProperty("position"); }
  set position(value)  { this.setProperty("position", value); }

  get scale()          { return this.getProperty("scale"); }
  set scale(value)     { this.setProperty("scale", value); }

  get rotation()       { return this.getProperty("rotation"); }
  set rotation(value)  { this.setProperty("rotation", value); }

  get origin()         { return this.getProperty("origin"); }
  set origin(value)    { return this.setProperty("origin", value); }

  get extent()         { return this.getProperty("extent"); }
  set extent(value)    { this.setProperty("extent", value); }

  get fill()           { return this.getProperty("fill"); }
  set fill(value)      { this.setProperty("fill", value); }

  get opacity()         { return this.getProperty("opacity"); }
  set opacity(value)    { this.setProperty("opacity", value); }

  get borderLeft()    { return {style: this.borderStyleLeft, width: this.borderWidthLeft, color: this.borderColorLeft} }
  set borderLeft(x)   { if ("style" in x) this.borderStyleLeft = x.style; if ("width" in x) this.borderWidthLeft = x.width; if ("color" in x) this.borderColorLeft = x.color; if ("radius" in x) this.borderRadiusLeft = x.radius; }
  get borderRight()   { return {style: this.borderStyleRight, width: this.borderWidthRight, color: this.borderColorRight} }
  set borderRight(x)  { if ("style" in x) this.borderStyleRight = x.style; if ("width" in x) this.borderWidthRight = x.width; if ("color" in x) this.borderColorRight = x.color; if ("radius" in x) this.borderRadiusRight = x.radius; }
  get borderBottom()  { return {style: this.borderStyleBottom, width: this.borderWidthBottom, color: this.borderColorBottom} }
  set borderBottom(x) { if ("style" in x) this.borderStyleBottom = x.style; if ("width" in x) this.borderWidthBottom = x.width; if ("color" in x) this.borderColorBottom = x.color; if ("radius" in x) this.borderRadiusBottom = x.radius; }
  get borderTop()     { return {style: this.borderStyleTop, width: this.borderWidthTop, color: this.borderColorTop} }
  set borderTop(x)    { if ("style" in x) this.borderStyleTop = x.style; if ("width" in x) this.borderWidthTop = x.width; if ("color" in x) this.borderColorTop = x.color; if ("radius" in x) this.borderRadiusTop = x.radius; }

  get borderStyleLeft()        { return this.getProperty("borderStyleLeft"); }
  set borderStyleLeft(value)   { this.setProperty("borderStyleLeft", value); }
  get borderStyleRight()       { return this.getProperty("borderStyleRight"); }
  set borderStyleRight(value)  { this.setProperty("borderStyleRight", value); }
  get borderStyleBottom()      { return this.getProperty("borderStyleBottom"); }
  set borderStyleBottom(value) { this.setProperty("borderStyleBottom", value); }
  get borderStyleTop()         { return this.getProperty("borderStyleTop"); }
  set borderStyleTop(value)    { this.setProperty("borderStyleTop", value); }
  get borderRadiusLeft()        { return this.getProperty("borderRadiusLeft"); }
  set borderRadiusLeft(value)   { this.setProperty("borderRadiusLeft", value); }
  get borderRadiusRight()       { return this.getProperty("borderRadiusRight"); }
  set borderRadiusRight(value)  { this.setProperty("borderRadiusRight", value); }
  get borderRadiusBottom()      { return this.getProperty("borderRadiusBottom"); }
  set borderRadiusBottom(value) { this.setProperty("borderRadiusBottom", value); }
  get borderRadiusTop()         { return this.getProperty("borderRadiusTop"); }
  set borderRadiusTop(value)    { this.setProperty("borderRadiusTop", value); }
  get borderWidthLeft()        { return this.getProperty("borderWidthLeft"); }
  set borderWidthLeft(value)   { this.setProperty("borderWidthLeft", value); }
  get borderWidthRight()       { return this.getProperty("borderWidthRight"); }
  set borderWidthRight(value)  { this.setProperty("borderWidthRight", value); }
  get borderWidthBottom()      { return this.getProperty("borderWidthBottom"); }
  set borderWidthBottom(value) { this.setProperty("borderWidthBottom", value); }
  get borderWidthTop()         { return this.getProperty("borderWidthTop"); }
  set borderWidthTop(value)    { this.setProperty("borderWidthTop", value); }
  get borderColorLeft()        { return this.getProperty("borderColorLeft"); }
  set borderColorLeft(value)   { this.setProperty("borderColorLeft", value); }
  get borderColorRight()       { return this.getProperty("borderColorRight"); }
  set borderColorRight(value)  { this.setProperty("borderColorRight", value); }
  get borderColorBottom()      { return this.getProperty("borderColorBottom"); }
  set borderColorBottom(value) { this.setProperty("borderColorBottom", value); }
  get borderColorTop()         { return this.getProperty("borderColorTop"); }
  set borderColorTop(value)    { this.setProperty("borderColorTop", value); }
  get borderWidth()       { return this.borderWidthLeft; }
  set borderWidth(value)  { this.borderWidthLeft = this.borderWidthRight = this.borderWidthTop = this.borderWidthBottom = value; }
  get borderRadius()      { return this.borderRadiusLeft; }
  set borderRadius(value) {
    if (!value) value = 0;
    var left = value, right = value, top = value, bottom = value;
    if (value.isRectangle) {
      left = value.left();
      right = value.right();
      top = value.top();
      bottom = value.bottom();
    }
    this.borderRadiusLeft = left;
    this.borderRadiusRight = right;
    this.borderRadiusTop = top;
    this.borderRadiusBottom = bottom;
  }
  get borderStyle()       { return this.borderStyleLeft; }
  set borderStyle(value)  { this.borderStyleLeft = this.borderStyleRight = this.borderStyleTop = this.borderStyleBottom = value; }
  get borderColor()       { return this.borderColorLeft; }
  set borderColor(value)  { this.borderColorLeft = this.borderColorRight = this.borderColorTop = this.borderColorBottom = value; }
  get border()    { return {style: this.borderStyle, width: this.borderWidth, color: this.borderColor} }
  set border(x)   {
    if ("style" in x) this.borderStyle = x.style;
    if ("width" in x) this.borderWidth = x.width;
    if ("color" in x) this.borderColor = x.color;
    if ("radius" in x) this.borderRadius = x.radius;
  }

  get clipMode()       { return this.getProperty("clipMode"); }
  set clipMode(value)  {
    this.setProperty("clipMode", value);
    if (!this.isClip()) this.scroll = pt(0,0);
  }
  isClip() { return this.clipMode !== "visible"; }

  get scroll()       { return this.getProperty("scroll"); }
  set scroll({x,y})  {
    if (!this.isClip()) return;
    var {x: maxScrollX, y: maxScrollY} = this.scrollExtent.subPt(this.extent);
    x = Math.max(0, Math.min(maxScrollX, x));
    y = Math.max(0, Math.min(maxScrollY, y));
    this.setProperty("scroll", pt(x,y));
    this.makeDirty();
  }

  get scrollExtent() {
    return (this.submorphs.length ?
      this.innerBounds().union(this.submorphBounds()) :
      this.innerBounds()).extent();
  }

  scrollDown(n) { this.scroll = this.scroll.addXY(0, n); }
  scrollUp(n) { this.scrollDown(-n); }
  scrollLeft(n) { this.scroll = this.scroll.addXY(n, 0); }
  scrollRight(n) { this.scrollLeft(-n); }
  scrollPageDown(n) { this.scrollDown(this.height); }
  scrollPageUp(n) { this.scrollUp(this.height); }

  get draggable()       { return this.getProperty("draggable"); }
  set draggable(value)  { this.setProperty("draggable", value); }

  get grabbable()       { return this.getProperty("grabbable"); }
  set grabbable(value)  { this.setProperty("grabbable", value); }

  get halosEnabled()       { return this.getProperty("halosEnabled"); }
  set halosEnabled(value)  { this.setProperty("halosEnabled", value); }

  // does this morph react to pointer / mouse events
  get reactsToPointer()       { return this.getProperty("reactsToPointer"); }
  set reactsToPointer(value)  { this.setProperty("reactsToPointer", value); }

  // The shape of the OS mouse cursor. nativeCursor can be one of
  // auto, default, none, context-menu, help, pointer, progress, wait, cell,
  // crosshair, text, vertical-text, alias, copy, move, no-drop, not-allowed,
  // e-resize, n-resize, ne-resize, nw-resize, s-resize, se-resize, sw-resize,
  // w-resize, ew-resize, ns-resize, nesw-resize, nwse-resize, col-resize,
  // row-resize, all-scroll, zoom-in, zoom-out, grab, grabbing
  get nativeCursor()       { return this.getProperty("nativeCursor"); }
  set nativeCursor(value)  { this.setProperty("nativeCursor", value); }

  // can this morph receive keyboard focus?
  get focusable()       { return this.getProperty("focusable"); }
  set focusable(value)  { this.setProperty("focusable", value); }

  get visible()       { return this.getProperty("visible"); }
  set visible(value)  { this.setProperty("visible", value); }

  get dropShadow()      { return this.getProperty("dropShadow"); }
  set dropShadow(value) {
      if (value && !value.isShadowObject) {
        if (!value.isShadowObject) value = new ShadowObject(value);
        value.morph = this;
      }
      this.setProperty("dropShadow", value);
  }

  static get styleClasses() {
    // we statically determine default style classes based on the Morph
    // inheritance chain, i.e. by default a morph gets the style class names of
    // its class and all the classes up to morph.
    // Can be overridden on the instance level see Morph>>get styleClasses()
    if (this.hasOwnProperty("_styclassNames"))
      return this._styleClasses;

    var klass = this,
        classNames = [];
    while (klass) {
      if (klass === Object) break;
      classNames.push(klass.name);
      klass = klass[Symbol.for("lively-instance-superclass")];
    }
    return this._styleClasses = classNames;
  }

  get styleClasses() {
    return this.constructor.styleClasses.concat(this.getProperty("styleClasses"));
  }
  set styleClasses(value)  { this.setProperty("styleClasses", value); }

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

  setBounds(bounds) {
    this.position = bounds.topLeft().addPt(this.origin);
    this.extent = bounds.extent();
  }

  innerBounds() {
    var {x:w, y:h} = this.extent;
    return rect(0,0,w,h);
  }

  relativeBounds(other) {
    var other = other || this.world(),
        bounds = this.origin.negated().extent(this.extent);
        
    if (other) {
       bounds = this.transformRectToMorph(other, bounds);
    } else {
       bounds = this.getGlobalTransform().transformRectToRect(bounds);
    }
  
    if (!this.isClip()) {
       this.submorphs.forEach(submorph => {
          bounds = bounds.union(submorph.relativeBounds(other));
      });
    }
  
    return bounds;
  }

  bounds() {
    return this.relativeBounds(this.owner);
  }

  globalBounds() {
    return this.relativeBounds(this.world());
  }

  submorphBounds() {
    return this.submorphs.map(submorph => submorph.bounds())
                         .reduce((a,b) => a.union(b));
  }

  align(p1, p2) { return this.moveBy(p2.subPt(p1)); }
  moveBy(delta) {
    this.position = this.position.addPt(delta);
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

  get isEpiMorph() { /*transient "meta" morph*/ return this.getProperty("epiMorph"); }

  isUsedAsEpiMorph() {
    var m = this;
    while (m) { if (m.isEpiMorph) return true; m = m.owner; }
    return false;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // morphic relationship
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  get submorphs() { return (this.getProperty("submorphs") || []).slice(); }
  set submorphs(newSubmorphs) {
      this.layout && this.layout.disable();
      this.submorphs.forEach(m => newSubmorphs.includes(m) || m.remove());
      newSubmorphs.forEach((m, i) => this.submorphs[i] !== m && this.addMorph(m, this.submorphs[i]));
      this.layout && this.layout.enable();
  }

  addMorphAt(submorph, index) {
    // ensure it's a morph or a spec
    if (!submorph || typeof submorph !== "object")
      throw new Error(`${submorph} cannot be added as a submorph to ${this}`)

    // sanity check
    if (submorph.isMorph) {
      if (submorph.isAncestorOf(this)) {
        this.env.world.logError(new Error(`addMorph: Circular relationships between morphs not allowed\ntried to add ${submorph} to ${this}`));
        return null;
      }
      if (submorph === this) {
        this.env.world.logError(new Error(`addMorph: Trying to add itself as a submorph: ${this}`));
        return null;
      }
    }

    if (!submorph.isMorph) submorph = morph(submorph);
    var existingIndex = this.submorphs.indexOf(submorph);
    if (existingIndex > -1 && existingIndex === index) return;

    this.addMethodCallChangeDoing({
      target: this,
      selector: "addMorphAt",
      args: [submorph, index],
      undo: {
        target: this,
        selector: "removeMorph",
        args: [submorph],
      }
    }, () => {
      var prevOwner = submorph.owner,
          submorphs = this.submorphs, tfm;

      if (prevOwner && prevOwner !== this) {
      // since morph transforms are local to a morphs owner we need to
      // compute a new transform for the morph inside the new owner so that the
      // morphs does not appear to change its position / rotation / scale
        tfm = submorph.transformForNewOwner(this);
        submorph.remove();
      }

      // modify the submorphs array
      index = Math.min(submorphs.length, Math.max(0, index));
      // is the morph already in submorphs? Remove it and fix index
      if (existingIndex > -1) {
        submorphs.splice(existingIndex, 1);
        if (existingIndex < index) index--;
      }
      submorphs.splice(index, 0, submorph);

      // set new owner
      submorph._owner = this;
      if (tfm) submorph.setTransform(tfm);
      this._currentState["submorphs"] = submorphs;

      this._submorphOrderChanged = true;
      this.makeDirty();
      submorph.resumeSteppingAll();
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

    var submorphs = this.getProperty("submorphs") || [];
    submorphs.splice(index, 1);

    this.addMethodCallChangeDoing({
      target: this,
      selector: "removeMorph",
      args: [morph],
      undo: {
        target: this,
        selector: "addMorphAt",
        args: [morph, index],
      }
    }, () => {
      morph.suspendSteppingAll();
      morph._owner = null;
    });
  }

  remove() {
    if (this.owner) this.owner.removeMorph(this);
    this._cachedPaths = {};
    this._pathDependants.forEach(dep => dep._cachedPaths = {});
    this._pathDependants = [];
    return this
  }

  async fadeOut(duration=1000) {
    await this.animate({opacity: 0, duration, easing: "easeOut"});
    this.remove();
    this.opacity = 1;
  }

  async fadeIn(duration=1000) {
     this.opacity = 0;
     this.animate({opacity: 1, duration});
     return this;
  }

  async fadeIntoWorld(pos, duration=300, origin=this.innerBounds().topCenter()) {
      const w = new Morph({extent: this.extent, opacity: 0, scale: 0, 
                           fill: Color.transparent, submorphs: [this]}),
            world = this.env.world;
      w.openInWorldNearHand();
      w.adjustOrigin(origin);
      w.position = pos || world.visibleBounds().center();
      await w.animate({opacity: 1, scale: 1, duration});
      world.addMorph(this);
      w.remove();
      return this;
   }

  removeAllMorphs() { this.submorphs = []; }

  bringToFront() {
    if (this.owner && arr.last(this.owner.submorphs) !== this)
      this.owner.addMorph(this);
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

  getWindow() { return this.isWindow ? this : this.ownerChain().find(({isWindow}) => isWindow); }

  openInWorldNear(pos, optWorld) {
    var world = optWorld || this.world() || this.env.world;
    if (!world) return;
    this.center = pos;
    this.setBounds(world.visibleBounds().translateForInclusion(this.bounds()))
    return this.openInWorld(this.position);
  }

  openInWorldNearHand(optWorld) {
    var world = optWorld || this.world() || this.env.world,
        pos = world.firstHand ? world.firstHand.position : pt(0,0);
    return world ? this.openInWorldNear(pos) : undefined;
  }

  openInWorld(pos, optWorld) {
    var world = optWorld || this.world() || this.env.world;
    if (!world) {
      console.warn(`Cannot open morph ${this}, world morph not found;`)
      return this;
    }
    world.addMorph(this);
    if (pos) this.position = pos;
    else this.center = world.visibleBounds().center();
    return this;
  }

  openInWindow(opts = {title: this.name, name: "window for " + this.name, world: null}) {
    var world = opts.world || this.world() || this.env.world;
    return world.openInWindow(this, obj.dissoc(opts, ["world"]));
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

  transformTillMorph(other, direction = "up") {
     // faster version of transform to, that benefits from
     // having the other morph in the current morph's owner chain
    if (direction == "down") return other.transformTillMorph(this, "up").inverse();
    var tfm = new Transform();
    for (var morph = this; (morph != other) && (morph != undefined); morph = morph.owner) {
       tfm.preConcatenate(new Transform(morph.origin))
          .preConcatenate(morph.getTransform());
    }
    return tfm;
  }

  localize(p) {
    // map world point to local coordinates
    var world = this.world(), {x,y} = p;
    return world ? world.transformPointToMorph(this, pt(x,y)) : p;
  }

  worldPoint(p) {
    var world = this.world(), {x,y} = p
    return world ? this.transformPointToMorph(world, pt(x,y)) : p;
  }

  transformToMorph(other) {
    var tfm = this.getGlobalTransform(),
        inv = other.getGlobalTransform().inverse();
    tfm.preConcatenate(inv);
    return tfm;
  }

  transformPointToMorph(other, p) {
     for(var [d, m] of this.pathToMorph(other)) {
        this.applyTransform(d, m, p);
     }
     return p;
  }

  transformRectToMorph(other, r) {
     var tl, tr, br, bl;
     [tl = r.topLeft(), tr = r.topRight(), 
      br = r.bottomRight(), bl = r.bottomLeft()].forEach(corner => {
        for(var [d, m] of this.pathToMorph(other)) {
           this.applyTransform(d, m, corner);
        }
       });
     return Rectangle.unionPts([tl,tr,br,bl]);
  }

  applyTransform(d, m, p) {
    if (d == "up") {
      p.x += m.origin.x;
      p.y += m.origin.y;
      p.matrixTransform(m.getTransform(), p);
    } else {
      p.matrixTransform(m.getInverseTransform(), p);
      p.x -= m.origin.x;
      p.y -= m.origin.y;
    }
  }

  _addPathDependant(morph) {
     if (!this._pathDependants.includes(morph)) 
         this._pathDependants.push(morph);
  }

  pathToMorph(other) {
     var path;
     if (path = this._cachedPaths[other.id]) return path;
     var commonRoot = this.closestCommonAncestor(other) || this,
         morph = this, down = [], up = [];
     commonRoot._addPathDependant(this);
     while(morph && morph != commonRoot) {
        up.push(["up", morph]);
        morph._addPathDependant(this);
        morph = morph.owner;
     }
     morph = other;
     while(morph && morph != commonRoot) {
        down.push(['down', morph]);
        morph._addPathDependant(this);
        morph = morph.owner;
     }
     this._cachedPaths[other.id] = path = [...up, ...down.reverse()];
     return path;
  }

  closestCommonAncestor(other) {
     return arr.intersect([this, ...this.ownerChain()], [other, ...other.ownerChain()])[0];
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
    return this.transformTillMorph(this.world());
  }

  get globalPosition() { return this.worldPoint(pt(0,0)) }
  set globalPosition(p) { return this.position = (this.owner ? this.owner.localize(p) : p); }

  getTransform() { return this._transform }
  getInverseTransform() { return this._invTransform || this._transform.inverse() }

  updateTransform({position, scale, origin, rotation} = {}) {
    const tfm = this._transform || new Transform(),
          tfm_inv = this._invTransform || new Transform();
              
    if (position || origin) {
        position = position || this.position;
        origin = origin || this.origin;
        if (this.owner && this.owner.isClip()) position = position.subPt(this.owner.scroll);
        tfm.e = position.x - origin.x;
        tfm.f = position.y - origin.y;
    }
    
    if (scale || rotation) {
        scale = scale || this.scale;
        rotation = rotation || this.rotation;
        tfm.a = scale * Math.cos(rotation);
        tfm.b = scale * Math.sin(rotation);
        tfm.c = scale * - Math.sin(rotation);
        tfm.d = scale * Math.cos(rotation);
    }

    const {a,b,c,d,e,f} = tfm,
          det = a * d - c * b,
          invdet = 1/det;

    tfm_inv.a =  d * invdet;
    tfm_inv.b = -b * invdet;
    tfm_inv.c = -c * invdet;
    tfm_inv.d =  a * invdet;
    tfm_inv.e =  (c * f - e * d) * invdet;
    tfm_inv.f = -(a * f - b * e) * invdet;
    
    this._transform = tfm;
    this._invTransform = tfm_inv;
  }

  setTransform(tfm) {
    this.position = tfm.getTranslation();
    this.rotation = num.toRadians(tfm.getRotation());
    this.scale = tfm.getScalePoint().x;
    this._transform = tfm;
    this._invTransform = tfm.inverse();
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
  // naming
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  get(name) {
    // search below, search siblings, search upwards
    if (!name) return null;
    try {
      return this.getSubmorphNamed(name)
          || (this.getNameTest(this, name) && this)
          || this.getOwnerOrOwnerSubmorphNamed(name);
    } catch(e) {
      if (e.constructor == RangeError && e.message == "Maximum call stack size exceeded") {
        throw new Error("'get' failed due to a stack overflow. The most\n"
          + "likely source of the problem is using 'get' as part of\n"
          + "toString, because 'get' calls 'getOwnerOrOwnerSubmorphNamed', which\n"
          + "calls 'toString' on this. Try using 'getSubmorphNamed' instead,\n"
          + "which only searches in this' children.\nOriginal error:\n" + e.stack);
      }
      throw e;
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
    if (!this._currentState /*pre-init when used in constructor*/
     || !this.submorphs.length) return null;
    let isRe = obj.isRegExp(name);
    for (let i = 0; i < this.submorphs.length; i++) {
      let morph = this.submorphs[i];
      if (this.getNameTest(morph, name)) return morph;
    }
    for (let i = 0; i < this.submorphs.length; i++)  {
      let morph = this.submorphs[i].getSubmorphNamed(name);
      if (morph) return morph;
    }
    return null;
  }

  getOwnerNamed(name) {
    return this.ownerChain().find(ea => ea.name === name);
  }

  getOwnerOrOwnerSubmorphNamed(name) {
    var owner = this.owner;
    if (!owner) return null;
    if (owner.name === name) return owner;
    for (var i = 0; i < owner.submorphs.length; i++) {
      var morph = owner.submorphs[i];
      if (morph === this) continue;
      if (this.getNameTest(morph, name)) return morph;
      var foundInMorph = morph.getSubmorphNamed(name);
      if (foundInMorph) return foundInMorph;
    }
    return this.owner.getOwnerOrOwnerSubmorphNamed(name);
  }

  getMorphWithId(id) {
    return this.withAllSubmorphsDetect(({id: morphId}) => id === morphId);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // events
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  get dragTriggerDistance() { return 0; }

  onMouseDown(evt) {
    // FIXME this doesn't belong here. Event dispatch related code should go
    // into events/dispatcher.js
    if (this === evt.targetMorph) {
      setTimeout(() => {
        if (this.grabbable && !evt.state.draggedMorph && evt.state.clickedOnMorph === this && !evt.hand.carriesMorphs())
          evt.hand.grab(this);
      }, 800);
    }
  }

  onMouseUp(evt) {}
  onMouseMove(evt) {}

  addKeyBindings(bindings) {
    this.addMethodCallChangeDoing({
      target: this,
      selector: "addKeyBindings",
      args: [bindings],
      undo: null
    }, () => {
      if (!this._keybindings) this._keybindings = [];
      this._keybindings.unshift(...bindings);
    });
  }
  get keybindings() { return this._keybindings || []; }
  set keybindings(bndgs) { return this._keybindings = bndgs; }
  get keyhandlers() {
    // Note that reconstructing the keyhandler on every stroke might prove too
    // slow. On my machine it's currently around 10ms which isn't really noticable
    // but for snappier key behavior we might want to cache that. Tricky thing
    // about caching is to figure out when to invalidate... keys binding changes
    // can happen in a number of places
    return [KeyHandler.withBindings(this.keybindings)];
  }

  get keyCommandMap() {
    var platform = this.keyhandlers[0].platform;
    return this.keybindings.reduce((keyMap, binding) => {
      var keys = binding.keys,
          platformKeys = findKeysForPlatform(keys, platform),
          command = binding.command,
          name = typeof command === "string" ? command : command.command || command.name;

      if (typeof platformKeys !== "string") return keyMap;

      return platformKeys.split("|").reduce((keyMap, combo) =>
        Object.assign(keyMap, {
          [combo]: {
            name, command,
            prettyKeys: KeyHandler.prettyCombo(combo)
          }
        }), keyMap);
    }, {});
  }

  keysForCommand(commandName, pretty = true) {
    var map = this.keyCommandMap,
        rawKey = Object.keys(map).find(key => map[key].name === commandName);
    return rawKey && pretty ? map[rawKey].prettyKeys : rawKey
  }

  simulateKeys(keyString) { return KeyHandler.simulateKeys(this, keyString); }

  onKeyDown(evt) {
    if (KeyHandler.invokeKeyHandlers(this, evt, false/*allow input evts*/)) {
      evt.stop();
    }
  }
  onKeyUp(evt) {}

  onContextMenu(evt) {
    if (evt.targetMorph !== this) return;
    evt.stop();
    this.openMenu(this.menuItems(), evt);
  }
  openMenu(items, optEvt) {
    return items && items.length ? this.world().openWorldMenu(optEvt, items) : null;
  }
  menuItems() {}

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

  onScroll(evt) {}

  onMouseWheel(evt) {

    var scrollTarget = evt.targetMorphs.find(ea => ea.isClip());
    if (this !== scrollTarget) return;
    var {deltaY, deltaX} = evt.domEvt,
        magnX = Math.abs(deltaX),
        magnY = Math.abs(deltaY);


    // This dance here is to avoid "overscroll", i.e. you scroll a clip morph
    // and it reaches it's boundary. Normally the clip morphs up the scene graph
    // would now be scrolled, e.g. the world, moving your view away from the morph
    // you are looking at. This is highly undesirable.

    var kind = "both directions";
    if (magnX <= 2 && magnY <= 2) kind = "tiny";
    else if (magnY / magnX <= 0.2) kind = "horizontal";
    else if (magnX / magnY <= 0.2) kind = "vertical";


    if (kind === "tiny") return;


    var {x: scrollX, y: scrollY} = this.scroll,
        newScrollTop = deltaY + scrollY,
        newScrollLeft = deltaX + scrollX,
        newScrollBottom = newScrollTop + this.height,
        newScrollRight = newScrollLeft + this.width,
        newScrollX, newScrollY;

    if (kind === "vertical" || kind === "both directions") {
      if (newScrollBottom >= this.scrollExtent.y) newScrollY = this.scrollExtent.y-1;
      else if (newScrollTop <= 0) newScrollY = 1;
      if (newScrollY !== undefined) {
        this.scroll = pt(scrollX, newScrollY);
        evt.stop();
      }
    
    } else if (kind === "horizontal" || kind === "both directions") {
      if (newScrollRight >= this.scrollExtent.x) newScrollX = this.scrollExtent.x-1;
      else if (newScrollLeft <= 0) newScrollX = 1;
      if (newScrollX !== undefined) {
        this.scroll = pt(newScrollX, scrollY);
        evt.stop();
      }
    }

    // Here we install a debouncer for letting the renderer know when it is
    // safe to update the DOM for scroll values.
    // See MorphAfterRenderHook in rendering/morphic-default.js and
    // https://github.com/LivelyKernel/lively.morphic/issues/88
    // for more info
    if (!evt.state.scroll.interactiveScrollInProgress) {
      var {promise: p, resolve} = promise.deferred();
      evt.state.scroll.interactiveScrollInProgress = p;
      p.debounce = fun.debounce(250, () => {
        evt.state.scroll.interactiveScrollInProgress = null;
        resolve();
      });
    }
    evt.state.scroll.interactiveScrollInProgress.debounce();
  }


  focus() {
    var eventDispatcher = this.env.eventDispatcher;
    eventDispatcher && eventDispatcher.focusMorph(this);
  }
  onFocus(evt) {}
  onBlur(evt) {}
  isFocused() {
    var eventDispatcher = this.env.eventDispatcher;
    return eventDispatcher && eventDispatcher.isMorphFocused(this);
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
    exported.type = this.constructor; // not JSON!
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
    return morph({attributeConnections: [], ...exported});
  }


  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // rendering
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  makeDirty() {
    // for notifying renderer that this morph needs to be updated. The flag is
    // reset by aboutToRender() which then transitions the morph to the
    // _rendering = true state. This gets reset in MorphAfterRenderHook when
    // the render process is done
    if (this._dirty) return;
    this._dirty = true;
    if (this.owner) this.owner.makeDirty();
  }

  needsRerender() { return this._dirty; }
  aboutToRender(renderer) { this._dirty = false; this._rendering = true; }
  whenRendered() { return promise.waitFor(() => !this._dirty && !this._rendering).then(() => this); }
  render(renderer) { return renderer.renderMorph(this); }
  renderAsRoot(renderer) { return renderRootMorph(this, renderer); }


  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // ticking
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  startStepping(/*stepTime, scriptName, ...args*/) {
    // stepTime is optional
    var args = Array.from(arguments),
        stepTime = typeof args[0] === "number" ? args.shift() : null,
        scriptName = args.shift(),
        script = new TargetScript(this, scriptName, args);
    this.removeEqualScripts(script);
    this.tickingScripts.push(script);
    script.startTicking(stepTime);
    return script;
  }

  stopStepping() {
    arr.invoke(this.tickingScripts, 'stop');
    this.tickingScripts.length = [];
  }

  stopSteppingScriptNamed(selector) {
    var scriptsToStop = this.tickingScripts.filter(ea => ea.selector === selector);
    this.stopScripts(scriptsToStop);
  }

  stopScripts(scripts) {
    arr.invoke(scripts, 'stop');
    this.tickingScripts = arr.withoutAll(this.tickingScripts, scripts);
  }

  suspendStepping() {
    if (this.tickingScripts)
      arr.invoke(this.tickingScripts, 'suspend');
  }

  suspendSteppingAll() {
    this.withAllSubmorphsDo(ea => ea.suspendStepping());
  }

  resumeStepping() {
    arr.invoke(this.tickingScripts, 'resume');
  }

  resumeSteppingAll() {
    this.withAllSubmorphsDo(ea => arr.invoke(ea.tickingScripts, 'resume'));
  }

  removeEqualScripts(script) {
    this.stopScripts(this.tickingScripts.filter(ea => ea.equals(script)));
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // commands
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  get commands() { return this._commands || []; }
  set commands(cmds) {
    if (this._commands) this.removeCommands(this._commands);
    this.addCommands(cmds);
  }
  get commandsIncludingOwners() {
    return arr.flatmap([this].concat(this.ownerChain()), morph =>
      arr.sortByKey(morph.commands, "name").map(command => ({target: morph, command})));
  }

  addCommands(cmds) {
    this.addMethodCallChangeDoing({
      target: this,
      selector: "addCommands",
      args: [cmds],
      undo: {target: this, selector: "removeCommands", args: [cmds]}
    }, () => {
      this.removeCommands(cmds);
      this._commands = (this._commands || []).concat(cmds);
    });
  }

  removeCommands(cmdsOrNames) {
    this.addMethodCallChangeDoing({
      target: this,
      selector: "removeCommands",
      args: [cmdsOrNames],
      undo: {target: this, selector: "addCommands", args: [cmdsOrNames]}
    }, () => {
      var names = cmdsOrNames.map(ea => typeof ea === "string" ? ea : ea.name),
          commands = (this._commands || []).filter(({name}) => !names.includes(name));
      if (!commands.length) delete this._commands;
      else this._commands = commands;
    });
  }

  get commandHandler() {
    return this._commandHandler || defaultCommandHandler;
  }

  lookupCommand(commandOrName) {
    var result = this.commandHandler.lookupCommand(commandOrName, this);
    return result && result.command ? result : null;
  }

  execCommand(command, args, count, evt) {
    return this.commandHandler.exec(command, this, args, count, evt);
  }

}


export class Ellipse extends Morph {
  // cut the corners so that a rectangle becomes an ellipse
  set borderRadiusLeft(_) {}
  get borderRadiusLeft() { return this.height; }
  set borderRadiusRight(_) {}
  get borderRadiusRight() { return this.height; }
  set borderRadiusTop(_) {}
  get borderRadiusTop() { return this.width; }
  set borderRadiusBottom(_) {}
  get borderRadiusBottom() { return this.width; }
}

export class Triangle extends Morph {

  constructor(props = {}) {
    super({direction: "up", ...props});
    this._currentState.triangleFill = props.fill;
    this.update();
  }

  onChange(change) {
    if (change.prop == "extent"
     || change.prop == "direction"
     || (change.prop == "fill" && change.value)
   ) this.update();
    super.onChange(change);
  }

  get direction() { return this.getProperty("direction"); }
  set direction(col) { this.setProperty("direction", col); }

  update() {
    var {x: width, y: height} = this.extent;
    if (width != height) this.extent = pt(Math.max(width, height), Math.max(width, height))

    this.origin = pt(width/2, height/2)

    var color = this._currentState.triangleFill = this.fill || this._currentState.triangleFill;
    this.fill = null;

    var base = {width: width/2, style: "solid", color: color},
        side = {width: height/2, style: "solid", color: Color.transparent},
        side1, side2, bottom;

    switch (this.direction) {
      case "down": side1 = "borderLeft"; side2 = "borderRight"; bottom = "borderTop"; break;
      case "up": side1 = "borderLeft"; side2 = "borderRight"; bottom = "borderBottom"; break;
      case "left": side1 = "borderBottom"; side2 = "borderTop"; bottom = "borderRight"; break;
      case "right": side1 = "borderBottom"; side2 = "borderTop"; bottom = "borderLeft"; break;
    }

    Object.assign(this, {[side1]: side, [side2]: side, [bottom]: base});
  }

}

export class Image extends Morph {

  constructor(props) {
    super(props);
    if (!this.imageUrl)
      this.imageUrl = System.decanonicalize("lively.morphic/lively-web-logo-small.png");
  }

  get isImage() { return true }

  get imageUrl()       { return this.getProperty("imageUrl"); }
  set imageUrl(value)  { this.setProperty("imageUrl", value); }

  render(renderer) {
    return renderer.renderImage(this);
  }
}

class PathPoint {

    constructor(path, props = {}) {
       this.path = path;
       Object.assign(this, obj.dissoc(props, "path"));
    }

    get isSmooth() { return this._isSmooth; }
    set isSmooth(smooth) {
       this._isSmooth = smooth;
       this.adaptControlPoints(smooth);
    }

    get position() { return pt(this.x, this.y)};
    set position({x,y}) { this.x = x; this.y = y; }

    moveBy(delta) {
       this.position = this.position.addPt(delta);
       this.path.onVertexChanged(this);
    }

    get controlPoints() { return this._controlPoints || {next: pt(0,0), previous: pt(0,0)}}
    set controlPoints(cps) { this._controlPoints = cps; }

    moveNextControlPoint(delta) {
      this.moveControlPoint("next", delta);
   }

   movePreviousControlPoint(delta) {
      this.moveControlPoint("previous", delta);
   }

   moveControlPoint(name, delta) {
      var acp = this.controlPoints[name],
          acp = acp ? acp.addPt(delta) : delta,
          other = name == "next" ? "previous" : "next",
          bcp = this.controlPoints[other];
      if (this.isSmooth) {
         bcp = acp.negated().normalized().scaleBy(bcp.r());
      }
      this.controlPoints = {[name]: acp, [other]: bcp};
      this.path.onVertexChanged(this);
   }

   pointOnLine(a, b, pos, bw) {
     var v0 = pt(a.x, a.y), v1 = pt(b.x, b.y), 
         l = v1.subPt(v0), ln = l.scaleBy(1/l.r()),
         dot = v1.subPt(pos).dotProduct(ln);
     return v1.subPt(ln.scaleBy(Math.max(1,Math.min(dot, l.r())))).addXY(bw,bw);
   }

   get nextVertex() {
      return this.path.vertexAfter(this);
   }

   get previousVertex() {
      return this.path.vertexBefore(this);
   }

   adaptControlPoints(smooth) {
      var nextPos = this.nextVertex.position,
          previousPos = this.previousVertex.position;
      if (smooth) {
         const p = this.pointOnLine(previousPos, nextPos, this.position, this.borderWidth);
         this.controlPoints = {
              next: p.subPt(previousPos), 
              previous: p.subPt(nextPos)
         };
      } else {
         this.controlPoints = {
              previous: previousPos.subPt(this.position).scaleBy(.5), 
              next: nextPos.subPt(this.position).scaleBy(.5)
         };
      }
      this.path.onVertexChanged(this);
   }

}

export class Path extends Morph {

  constructor(props) {
    super({...obj.dissoc(props, "origin"), fill: Color.transparent});
    this.adjustOrigin(props.origin || this.origin);
    this.position = props.position || this.position;
  }

  get isPath() { return true; }

  onVertexChanged(vertex) {
     this.makeDirty();
     this.updateBounds(this.vertices);
  }

  updateBounds(vertices) {
     const b = Rectangle.unionPts([pt(0,0), ...arr.flatmap(vertices, 
               ({position, controlPoints}) => {
                  var {next, previous} = controlPoints || {};
                  if (next) next = position.addPt(next);
                  if (previous) previous = position.addPt(previous);
                  return arr.compact([next, position, previous]);
               })]);
     this.adjustingVertices = true;
     this.extent = b.extent();
     this.origin = b.topLeft().negated();
     this.adjustingVertices = false;
  }

  onChange(change) {
    if (change.prop == "extent"
        && change.value
        && change.prevValue
        && !this.adjustingVertices)
        this.adjustVertices(change.value.scaleByPt(change.prevValue.inverted()))
    if (!this.adjustingOrigin && ["vertices", "borderWidthLeft"].includes(change.prop)) {
       this.updateBounds(change.prop == "vertices" ? change.value : this.vertices);
    }
    super.onChange(change);
  }

  get isSvgMorph() { return true }

  get vertices() { return this.getProperty("vertices") || []}
  set vertices(vs) { 
     vs = vs.map(v => new PathPoint(this, { ...v, borderWidth: this.borderWidth}));
     this.setProperty("vertices", vs); 
  }

  vertexBefore(v) {
     const i = this.vertices.indexOf(v) - 1;
     return this.vertices[i > 0 ? i : this.vertices.length - 1];
  }

  vertexAfter(v) {
     const i = this.vertices.indexOf(v) + 1;
     return this.vertices[i > this.vertices.length - 1 ? 0 : i];
  }

  adjustVertices(delta) {
     this.vertices && this.vertices.forEach((v) => {
        var {next, previous} = v.controlPoints;
        next = next.scaleByPt(delta);
        previous = previous.scaleByPt(delta);
        v.position = v.position.addPt(this.origin).scaleByPt(delta).subPt(this.origin);
        v.controlPoints = {next, previous};
     });
  }

  adjustOrigin(newOrigin) {
    this.adjustingOrigin = true;
    this.vertices.forEach(v => {
       v.position = this.origin.subPt(newOrigin).addXY(v.x, v.y);
    });
    super.adjustOrigin(newOrigin);
    this.adjustingOrigin = false;
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
      super(props);
      this.fill = props.fill;
    } else {
      throw new Error("A polygon requires 3 or more vertices!");
    }
  }

  get isPolygon() { return true; }

}
