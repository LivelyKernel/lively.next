import { Color, pt, rect, Rectangle, Transform } from "lively.graphics";
import { string, obj, arr, num, promise, tree, fun } from "lively.lang";
import { renderRootMorph, renderMorph, AnimationQueue, ShadowObject } from "./rendering/morphic-default.js"
import { morph, show } from "./index.js";
import { MorphicEnv } from "./env.js";
import config from "./config.js";
import CommandHandler from "./CommandHandler.js";
import KeyHandler, { findKeysForPlatform } from "./events/KeyHandler.js";
import { TargetScript } from "./ticking.js";
import { copyMorph } from "./serialization.js";

const defaultCommandHandler = new CommandHandler();

export function newMorphId(classOrClassName) {
  var prefix = typeof classOrClassName === "function" ?
    classOrClassName.name : typeof classOrClassName === "string" ?
      classOrClassName.toLowerCase() : "";
  return prefix + "_" + string.newUUID().replace(/-/g, "_");
}

export class Morph {

  static get propertySettings() {
    return {
      defaultGetter(key) { return this.getProperty(key); },
      defaultSetter(key, value) { this.setProperty(key, value); },
      valueStoreProperty: "_morphicState"
    }
  }

  static get properties() {
    return {

      name: {
        initialize() {
          let className = this.constructor.name;
          this.name = (string.startsWithVowel(className) ? "an" : "a") + className;
        }
      },

      draggable: {isStyleProp: true, defaultValue: true},
      grabbable: {
        isStyleProp: true,
        defaultValue: false,
        set(bool) {
          // Since grabbing is implemented via dragging we also need to make
          // this morph draggable
          if (bool && !this.draggable) this.draggable = true;
          this.setProperty("grabbable", bool);
        }
      },

      acceptsDrops: {isStyleProp: true, defaultValue: true},
      dropShadow: {
        isStyleProp: true,
        defaultValue: false,
        set(value) {
          if (value && !value.isShadowObject) {
            value = new ShadowObject(value);
            value.morph = this;
          }
          this.setProperty("dropShadow", value);
        }
      },

      tooltip:            {defaultValue: null},
      focusable:          {defaultValue: true},
      nativeCursor:       {isStyleProp: true, defaultValue: "auto"},
      halosEnabled:       {isStyleProp: true, defaultValue: !!config.halosEnabled},
      reactsToPointer:    {defaultValue: true},

      position:           {defaultValue: pt(0,0)},
      origin:             {defaultValue: pt(0,0)},
      extent:             {defaultValue: pt(10, 10)},
      rotation:           {defaultValue:  0},
      scale:              {defaultValue:  1},
      opacity:            {isStyleProp: true, defaultValue: 1},
      fill:               {isStyleProp: true, defaultValue: Color.white},
      visible:            {isStyleProp: true, defaultValue: true},

      submorphs: {
        defaultValue: [],
        after: ["isLayoutable", "origin", "position", "rotation", "scale"],
        get() { return (this.getProperty("submorphs") || []).slice(); },
        set(newSubmorphs) {
          let {layout} = this,
              activateLayout = layout && layout.isEnabled();
          if (activateLayout) layout.disable();
          this.submorphs.forEach(m => newSubmorphs.includes(m) || m.remove());
          newSubmorphs.forEach(
            (m, i) => this.submorphs[i] !== m &&
              this.addMorph(m, this.submorphs[i]));
          if (activateLayout) layout.enable();
        }
      },

      clipMode: {
        isStyleProp: true,
        defaultValue: "visible",
        set(value) {
          this.setProperty("clipMode", value);
          if (!this.isClip()) this.scroll = pt(0, 0);
        }
      },

      scroll: {
        defaultValue: pt(0, 0),
        set({x, y}) {
          if (!this.isClip()) return;
          var {x: maxScrollX, y: maxScrollY} = this.scrollExtent.subPt(this.extent);
          x = Math.max(0, Math.min(maxScrollX, x));
          y = Math.max(0, Math.min(maxScrollY, y));
          this.setProperty("scroll", pt(x, y));
          this.makeDirty();
        }
      },

      styleClasses: {
        isStyleProp: true,
        defaultValue: ["morph"],
        get() {
          return this.constructor.styleClasses.concat(this.getProperty("styleClasses"));
        },
        set(value) {
          this.setProperty("styleClasses", arr.withoutAll(value, this.constructor.styleClasses));
        }
      },

      layout: {
        after: ["submorphs", "extent", "origin", "position", "isLayoutable"],
        set(value) {
          if (value) value.container = this;
          this.setProperty("layout", value);
        }
      },
      isLayoutable: {isStyleProp: true, defaultValue: true},

      borderColorBottom:  {isStyleProp: true, defaultValue: Color.white},
      borderColorLeft:    {isStyleProp: true, defaultValue: Color.white},
      borderColorRight:   {isStyleProp: true, defaultValue: Color.white},
      borderColorTop:     {isStyleProp: true, defaultValue: Color.white},
      borderRadiusBottom: {isStyleProp: true, defaultValue: 0},
      borderRadiusLeft:   {isStyleProp: true, defaultValue: 0},
      borderRadiusRight:  {isStyleProp: true, defaultValue: 0},
      borderRadiusTop:    {isStyleProp: true, defaultValue: 0},
      borderStyleBottom:  {isStyleProp: true, defaultValue: "solid"},
      borderStyleLeft:    {isStyleProp: true, defaultValue: "solid"},
      borderStyleRight:   {isStyleProp: true, defaultValue: "solid"},
      borderStyleTop:     {isStyleProp: true, defaultValue: "solid"},
      borderWidthBottom:  {isStyleProp: true, defaultValue: 0},
      borderWidthLeft:    {isStyleProp: true, defaultValue: 0},
      borderWidthRight:   {isStyleProp: true, defaultValue: 0},
      borderWidthTop:     {isStyleProp: true, defaultValue: 0},

      borderLeft: {
        isStyleProp: true,
        derived: true,
        after:   ["borderStyleLeft", "borderWidthLeft", "borderColorLeft"],
        get()    { return {style: this.borderStyleLeft, width: this.borderWidthLeft, color: this.borderColorLeft} },
        set(x) {
          if ("style" in x) this.borderStyleLeft = x.style;
          if ("width" in x) this.borderWidthLeft = x.width;
          if ("color" in x) this.borderColorLeft = x.color;
          if ("radius" in x) this.borderRadiusLeft = x.radius;
        }
      },

      borderRight: {
        isStyleProp: true,
        derived: true,
        after:  ["borderStyleRight", "borderWidthRight", "borderColorRight"],
        get()   { return {style: this.borderStyleRight, width: this.borderWidthRight, color: this.borderColorRight} },
        set(x) {
          if ("style" in x) this.borderStyleRight = x.style;
          if ("width" in x) this.borderWidthRight = x.width;
          if ("color" in x) this.borderColorRight = x.color;
          if ("radius" in x) this.borderRadiusRight = x.radius;
        }
      },

      borderBottom: {
        isStyleProp: true,
        derived: true,
        after: ["borderStyleBottom", "borderWidthBottom", "borderColorBottom"],
        get()  { return {style: this.borderStyleBottom, width: this.borderWidthBottom, color: this.borderColorBottom} },
        set(x) {
          if ("style" in x) this.borderStyleBottom = x.style;
          if ("width" in x) this.borderWidthBottom = x.width;
          if ("color" in x) this.borderColorBottom = x.color;
          if ("radius" in x) this.borderRadiusBottom = x.radius;
        }
      },

      borderTop: {
        isStyleProp: true,
        derived: true,
        after: ["borderStyleTop", "borderWidthTop", "borderColorTop"],
        get()     { return {style: this.borderStyleTop, width: this.borderWidthTop, color: this.borderColorTop} },
        set(x) {
          if ("style" in x) this.borderStyleTop = x.style;
          if ("width" in x) this.borderWidthTop = x.width;
          if ("color" in x) this.borderColorTop = x.color;
          if ("radius" in x) this.borderRadiusTop = x.radius;
        }
      },

      borderWidth: {
        isStyleProp: true,
        derived: true,
        after:      ["borderWidthLeft", "borderWidthRight", "borderWidthTop", "borderWidthBottom"],
        get()       { return this.borderWidthLeft; },
        set(value) {
          this.borderWidthLeft = this.borderWidthRight =
            this.borderWidthTop = this.borderWidthBottom = value;
        }
      },

      borderRadius: {
        isStyleProp: true,
        derived: true,
        after: ["borderRadiusLeft","borderRadiusRight","borderRadiusTop","borderRadiusBottom"],
        get()      { return this.borderRadiusLeft; },
        set(value) {
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
      },

      borderStyle: {
        isStyleProp: true,
        derived: true,
        after:      ["borderStyleLeft", "borderStyleRight", "borderStyleTop", "borderStyleBottom"],
        get()       { return this.borderStyleLeft; },
        set(value) {
          this.borderStyleLeft = this.borderStyleRight =
            this.borderStyleTop = this.borderStyleBottom = value;
        }
      },

      borderColor: {
        isStyleProp: true,
        derived: true,
        after:      ["borderColorLeft", "borderColorRight", "borderColorTop", "borderColorBottom"],
        get()       { return this.borderColorLeft; },
        set(value) {
          this.borderColorLeft = this.borderColorRight =
            this.borderColorTop = this.borderColorBottom = value;
        }
      },

      border: {
        isStyleProp: true,
        derived: true,
        after: ["borderStyle", "borderWidth", "borderColor"],
        get()    { return {style: this.borderStyle, width: this.borderWidth, color: this.borderColor} },
        set(x)   {
          if ("style" in x) this.borderStyle = x.style;
          if ("width" in x) this.borderWidth = x.width;
          if ("color" in x) this.borderColor = x.color;
          if ("radius" in x) this.borderRadius = x.radius;
        }
      },

      morphClasses: {isStyleProp: true}, //2017-01-31 rk: What is this????

      styleRules: {
        isStyleProp: true,
        set(rules) {
          this.setProperty("styleRules", rules);
          if (rules) rules.applyToAll(this);
        }
      },

      styleProperties: {
        derived: true, readOnly: true,
        get() {
          let p = this.propertiesAndPropertySettings().properties,
              styleProps = [];
          for (let prop in p)
            if (p[prop].isStyleProp)
              styleProps.push(prop);
          return styleProps;
        }
      },

      style: {
        derived: true, readOnly: true,
        get() {
          let styleProperties = this.styleProperties, style = {};
          for (let i = 0; i < styleProperties.length; i++) {
            let prop = styleProperties[i];
            style[prop] = this[prop]
          }
          return style;
        }
      },
    
      epiMorph: {
        doc: "epi morphs are 'transient' morphs, i.e. meta objects that should not be serialized like halo items, menus, etc.",
        defaultValue: false
      }
    }
  }

  constructor(props = {}) {
    var env = props.env || MorphicEnv.default();
    this._env = env;
    this._rev = env.changeManager.revision;
    this._owner = null;
    this._dirty = true; // for renderer, signals need  to re-render
    this._rendering = false; // for knowing when rendering is done
    this._submorphOrderChanged = false; // extra info for renderer
    this._id = newMorphId(this.constructor.name);
    this._animationQueue = new AnimationQueue(this);
    this._cachedPaths = {};
    this._pathDependants = [];
    this._tickingScripts = [];
    this.initializeProperties
    this.initializeProperties(props);
    if (props.bounds) this.setBounds(props.bounds);

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // rk 2017-02-04: FIXME remove the assign below once we are fully
    // transitioned to properties. Properties themselves set their default or
    // constructor value in initializeProperties
    var dontAssign = ["env", "type", "submorphs", "bounds", "layout"],
        properties = this.propertiesAndPropertySettings().properties;
    for (var key in properties) dontAssign.push(key);
    Object.assign(this, obj.dissoc(props, dontAssign));
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    if (props.layout) this.layout = props.layout;
  }

  get __serialization_id_property__() { return "_id"; }

  __deserialize__(snapshot, objRef) {
    // inspect({snapshot, objRef})
    this._env = MorphicEnv.default(); // FIXME!
    this._rev = snapshot.rev;
    this._owner = null;
    this._dirty = true; // for renderer, signals need  to re-render
    this._rendering = false; // for knowing when rendering is done
    this._submorphOrderChanged = false; // extra info for renderer
    this._id = objRef.id;
    this._animationQueue = new AnimationQueue(this);
    this._cachedPaths = {};
    this._pathDependants = [];
    this._tickingScripts = [];
    this.initializeProperties();
  }

  __after_deserialize__() {
    this.resumeStepping();
    if (typeof this.onLoad === "function") {
      try { this.onLoad(); }
      catch (e) { console.error(`[lively.morphic] ${this}.onLoad() error: ${e.stack}`)}
    }
  }

  get __only_serialize__() {
    let defaults = this.defaultProperties,
        properties = this.propertiesAndPropertySettings().properties,
        propsToSerialize = ["_tickingScripts", "attributeConnections"];
    for (let key in properties) {
      let descr = properties[key];
      if (descr.readOnly || descr.derived || this[key] === defaults[key]
       || (descr.hasOwnProperty("serialize") && !descr.serialize)) continue;
      propsToSerialize.push(key);
    }
    return propsToSerialize;
  }

  __additionally_serialize__(snapshot, ref, pool, addFn) {
    // remove epi morphs
    if (!this.isEpiMorph) {
      let submorphs = snapshot.props.submorphs.value;
      for (let i = submorphs.length; i--; ) {
        let {id} = submorphs[i];
        if (pool.refForId(id).realObj.isEpiMorph)
          arr.removeAt(submorphs, i);
      }
    }
  }


  get isMorph() { return true; }
  get id() { return this._id; }

  get env() { return this._env; }

  get defaultProperties() {
    if (!this.constructor._morphicDefaultPropertyValues) {
      var defaults = this.constructor._morphicDefaultPropertyValues = {},
          propDescriptors = this.propertiesAndPropertySettings().properties;
      for (var key in propDescriptors) {
        var descr = propDescriptors[key];
        if (descr.hasOwnProperty("defaultValue")) {
          let val = descr.defaultValue;
          if (Array.isArray(val)) val = val.slice();
          defaults[key] = val;
        }
      }
    }
    return this.constructor._morphicDefaultPropertyValues;
  }

  defaultProperty(key) { return this.defaultProperties[key]; }
  getProperty(key) { return this._morphicState[key]; }
  setProperty(key, value, meta) { return this.addValueChange(key, value, meta); }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // debugging
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  toString() {
    return `<${this.constructor.name} - ${this.name ? this.name : this.id}>`;
  }

  edit() {
    return this.env.world.execCommand("open object editor", {target: this});
  }

  livelyCustomInspect() {
    var properties = [],
        ignored = [], seen = {},
        wellKnown = Object.keys(this._morphicState);

    wellKnown.push("id", "owner");
    ignored.push("_id", "_owner");

    properties.push(...wellKnown
      .map(key => { seen[key] = true; return {key, value: this[key]}; })
      .sort((a, b) => {
        let aK = a.key.toLowerCase(),
            bK = b.key.toLowerCase();
        return aK < bK ? -1 : aK === bK ? 0 : 1
      }))

    var morphInternals = [
      "attributeConnections",
      "_animationQueue",
      "_morphicState",
      "_dirty",
      "doNotCopyProperties",
      "doNotSerialize",
      "_env",
      "_cachedPaths",
      "_pathDependants",
      "_rendering",
      "_rev",
      "_submorphOrderChanged",
      "_tickingScripts",
      "_transform",
      "_invTransform",
      "layout"
    ]

    if (this.attributeConnections) {
      for (let c of this.attributeConnections)
        ignored.push(`$$${c.sourceAttrName}`, `${c.sourceAttrName}`);
    }

    for (let ignore of ignored) seen[ignore] = true;
    for (let key of morphInternals) {
      if (!(key in this)) continue;
      seen[key] = true;
      properties.push({key, value: this[key], keyString: `[internal] ${key}`});
    }

    for (let key in this) {
      if (seen[key] || !this.hasOwnProperty(key)) continue;
      properties.unshift({key, value: this[key], keyString: `[UNKNOWN PROPERTY] ${key}`});
    }

    return {sort: false, includeDefault: false, properties};
  }

  show() { return show(this); }

  setStatusMessage(msg, color, delay, opts) {
    var w = this.world();
    opts = {maxLines: 7, ...opts}
    return w ? w.setStatusMessageFor(this, msg, color, delay, opts) : console.log(msg)
  }

  showError(err) {
    var w = this.world();
    return w ? w.showErrorFor(this, err) : console.error(err)
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
      return Promise.resolve(this);
    }
    return anim ? anim.asPromise() : Promise.resolve(this);
  }

  isClip() { return this.clipMode !== "visible"; }
  get scrollExtent() {
    /*
     Since the DOM will always include the scrollbar area to the scrollable
     are of the div, we need to allow the morphic scroll to take that
     area into account as well. If not, we get weird jiggle effects when morphic
     and the DOM fight over how much the scroll is actually allowed to be.
     rms: I tried fixing this entirely in CSS, but failed. My idea was to add invisible margins
          to the rendered div container of a scrollable morph, such that HTML will end up with the
          same scrollable area as morphic, but that somehow does not work.
    */
    const HTMLScrollbarOffset = pt(15, 15);
    return (this.submorphs.length ?
      this.innerBounds().union(this.submorphBounds()) :
      this.innerBounds()).extent().addPt(HTMLScrollbarOffset);
  }

  scrollDown(n) { this.scroll = this.scroll.addXY(0, n); }
  scrollUp(n) { this.scrollDown(-n); }
  scrollLeft(n) { this.scroll = this.scroll.addXY(n, 0); }
  scrollRight(n) { this.scrollLeft(-n); }
  scrollPageDown(n) { this.scrollDown(this.height); }
  scrollPageUp(n) { this.scrollUp(this.height); }

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
    if (this.submorphs.length < 1) return this.innerBounds();
    return this.submorphs.map(submorph => submorph.bounds())
                         .reduce((a,b) => a.union(b));
  }

  align(p1, p2) { return this.moveBy(p2.subPt(p1)); }
  moveBy(delta) {
    this.position = this.position.addPt(delta);
  }
  rotateBy(delta) { this.rotation += delta; }
  resizeBy(delta) { this.extent = this.extent.addPt(delta); }
  snap(grid) { this.position = this.position.roundTo(grid || 1); }

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

  replaceWith(other, indexForOtherMorph) {
    // this method switches the scene graph location of two morphs (this and
    // other). Morphs can be unrelated or in child/owner relationship.
    // Transforms / submorphs of this and other are also replaced so that the
    // replace operation seems to not have any other effects on the scene graph

    if (this === other || !other) return other;

    if (this === other.owner) {
      other.replaceWith(this);
      return other;
    }

    let myOwner = this.owner,
        mySubmorphs = this.submorphs,
        myTfm = this.getTransform().copy(),
        myIndex = typeof indexForOtherMorph === "number" ? indexForOtherMorph :
                    myOwner ? myOwner.submorphs.indexOf(this) : -1,
        otherOwner = other.owner,
        otherSubmorphs = arr.without(other.submorphs, this),
        otherTfm = other.getTransform().copy(),
        otherIndex = otherOwner ? otherOwner.submorphs.indexOf(other) : -1;

    myOwner && this.remove();
    otherOwner && other.remove();
    this.submorphs = [];
    other.submorphs = [];

    if (myOwner === other) {
      otherOwner && otherOwner.addMorphAt(this, otherIndex);
      this.submorphs = otherSubmorphs.slice(0, myIndex)
                        .concat(other)
                        .concat(otherSubmorphs.slice(myIndex))
      other.submorphs = mySubmorphs;
    } else {
      myOwner && myOwner.addMorphAt(other, myIndex);
      otherOwner && otherOwner.addMorphAt(this, otherIndex);
      other.submorphs = mySubmorphs;
      this.submorphs = otherSubmorphs;
    }

    other.setTransform(myTfm);
    this.setTransform(otherTfm);

    return other;
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

      if (submorph._env !== this._env) submorph._env = this._env;

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
      submorph._cachedPaths = {};
      if (tfm) submorph.setTransform(tfm);
      this._morphicState["submorphs"] = submorphs;

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
    this._pathDependants = arr.withoutAll(this._pathDependants, morph._pathDependants);
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
    else {
      this.center = world.visibleBounds().center();
      this.snap();
    }
    return this;
  }

  openInHand(hand) {
    if (!hand) {
      var world = this.world() || this.env.world;
      hand = world.firstHand;
    }
    hand.grab(this);
    this.center = pt(0,0);
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
          .preConcatenate(morph.getTransform())
          .preConcatenate(morph != this ? new Transform(morph.scroll.negated()) : new Transform());
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
    tfm.preConcatenate(inv)
    tfm.preConcatenate(new Transform(other.scroll));
    return tfm;
  }

  transformPointToMorph(other, p) {
     for(var [d, m] of this.pathToMorph(other)) {
        if (this != m && d == 'up') {
          p.x -= m.scroll.x;
          p.y -= m.scroll.y;
        }
        this.applyTransform(d, m, p);
        if (this != m && d == 'down') {
          p.x += m.scroll.x;
          p.y += m.scroll.y;
        }
     }
     return p;
  }

  transformRectToMorph(other, r) {
     var tl, tr, br, bl;
     [tl = r.topLeft(), tr = r.topRight(),
      br = r.bottomRight(), bl = r.bottomLeft()].forEach(corner => {
        this.transformPointToMorph(other, corner);
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
      return otherMorph.transformPointToMorph(this, pt);
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

  getTransform() {
    if (!this._transform) this.updateTransform();
    return this._transform;
  }

  getInverseTransform() {
    if (!this._invTransform) this.updateTransform();
    return this._invTransform;
  }

  updateTransform({position, scale, origin, rotation} = {}) {
    const tfm = this._transform || new Transform(),
          tfm_inv = this._invTransform || new Transform();

    position = position || this.position;
    origin = origin || this.origin;
    scale = scale || this.scale;
    rotation = rotation || this.rotation;
    tfm.a = scale * Math.cos(rotation);
    tfm.b = scale * Math.sin(rotation);
    tfm.c = scale * - Math.sin(rotation);
    tfm.d = scale * Math.cos(rotation);
    tfm.e = tfm.a * -origin.x + tfm.c * -origin.y + position.x;
    tfm.f = tfm.b * -origin.x + tfm.d * -origin.y + position.y;

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
    this.position = tfm.getTranslation()
    this.rotation = num.toRadians(tfm.getRotation());
    this.scale = tfm.getScalePoint().x;
    this.updateTransform(this);
  }

  fullContainsWorldPoint(p) { // p is in world coordinates
    return this.fullContainsPoint(this.owner == null ? p : this.owner.localize(p));
  }

  fullContainsPoint(p) { // p is in owner coordinates
    return this.bounds().containsPoint(p);
  }

  innerBoundsContainsWorldPoint(p) { // p is in world coordinates
    return this.innerBoundsContainsPoint(this.localize(p));
  }

  innerBoundsContainsPoint(p) { // p is in local coordinates (offset by origin)
    return this.innerBounds().containsPoint(p.addPt(this.origin).subPt(this.scroll));
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
    if (!this._morphicState /*pre-init when used in constructor*/
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

  setMirrored(bool){
    if(!bool){
      this.addStyleClass('hidden-in-mirror')
    } else {
      this.removeStyleClass('hidden-in-mirror')
    }
  }

  isMirrored(){
    if(this.styleClasses.indexOf('hidden-in-mirror') >= 0){
      return true
    }
    return false
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
      this._cachedKeyhandlers = null;
      this._keybindings.unshift(...bindings);
    });
  }
  get keybindings() { return this._keybindings || []; }
  set keybindings(bndgs) {
    this._cachedKeyhandlers = null;
    return this._keybindings = bndgs;
  }
  get keyhandlers() {
    // Note that reconstructing the keyhandler on every stroke might prove too
    // slow. On my machine it's currently around 10ms which isn't really noticable
    // but for snappier key behavior we might want to cache that. Tricky thing
    // about caching is to figure out when to invalidate... keys binding changes
    // can happen in a number of places
    return this._cachedKeyhandlers
       || (this._cachedKeyhandlers = [KeyHandler.withBindings(this.keybindings)]);
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
    Promise
      .resolve(this.menuItems()).then(items => this.openMenu(items, evt))
      .catch(err => $world.logError(err));
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
    // called when `this` is choosen as a drop target, double dispatches the
    // drop back to the hand but can be overriden to handle drops differently
    evt.hand.dropMorphsOn(this);
  }

  onBeingDroppedOn(recipient) {
    // called when `this` was dropped onto morph `recipient`
  }

  onHoverIn(evt) {}
  onHoverOut(evt) {}

  onScroll(evt) {}

  onMouseWheel(evt) {
return ;
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

  // access to the HTML 5 drag'n'drop API
  onNativeDrop(evt) {}
  onNativeDragleave(evt) {}
  onNativeDragenter(evt) {}
  onNativeDragover(evt) {}
  onNativeDragend(evt) {}
  onNativeDragstart(evt) {}
  onNativeDrag(evt) {}

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
    var exported = Object.keys(this._morphicState).reduce((exported, name) => {
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
    this._env = MorphicEnv.default();
    this._rev = 0;
    this._owner = null;
    this._dirty = true;
    this._rendering = false;
    this._submorphOrderChanged = false;
    this._id =  newMorphId(this.constructor.name);
    this._animationQueue = new AnimationQueue(this);
    this._cachedPaths = {};
    this._pathDependants = [];
    this._tickingScripts = [];
    this.initializeProperties();
    Object.assign(this, spec)
    return this;
  }

  copyViaJSON() {
    var exported = this.exportToJSON();
    tree.prewalk(exported, spec => spec._id = newMorphId(spec.type), ({submorphs}) => submorphs);
    exported.name = exported.name.replace(
        /copy( [0-9]+)?$/,
        (_, num) => `copy ${num && num.trim() ? Number(num)+1 : "1"}`);
    // rk 2017-01-08: attributeConnections hard reset...! and only of root
    // morph? this seems really wrong!
    return morph({attributeConnections: [], ...exported});
  }

  copy() { return copyMorph(this); }


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
  onAfterRender(node) {}

  whenRendered() {
    return promise
      .waitFor(() => !this._dirty && !this._rendering)
      .then(() => this);
  }

  render(renderer) { return renderer.renderMorph(this); }

  renderAsRoot(renderer) { return renderRootMorph(this, renderer); }

  renderPreview(opts = {}) {
    // Creates a DOM node that is a "preview" of he morph, i.e. a
    // representation that looks like the morph but doesn't morphic behavior
    // attached

    // FIXME doesn't work with scale yet...!

    let {width = 100, height = 100, center = true, asNode = false} = opts,
        {
          borderWidthLeft, borderWidthTop, borderWidthBottom, borderWidthRight,
          scale, position, origin, rotation
        } = this,
        // goalWidth = width - (borderWidthLeft + borderWidthRight),
        // goalHeight = height - (borderWidthTop + borderWidthBottom),
        goalWidth = width,
        goalHeight = height,
        invTfm = new Transform(position.negated(), 0, pt(1/this.scale,1/scale)),
        bbox = invTfm.transformRectToRect(this.bounds()),
        w = bbox.width, h = bbox.height,
        ratio = Math.min(goalWidth/w, goalHeight/h),
        node = renderMorph(this),
        tfm = new Transform(
          bbox.topLeft().negated().scaleBy(ratio).subPt(origin),
          rotation, pt(ratio, ratio));

    if (center) {
      var previewBounds = tfm.transformRectToRect(
            this.extent.extentAsRectangle()),
          offsetX = previewBounds.width < goalWidth ?
            (goalWidth-previewBounds.width) / 2 : 0,
          offsetY = previewBounds.height < goalHeight ?
            (goalHeight-previewBounds.height) / 2 : 0;
      tfm = tfm.preConcatenate(new Transform(pt(offsetX, offsetY)))
    }

    node.style.transform = tfm.toCSSTransformString();
    node.style.pointerEvents = "";

    // preview nodes must not appear like nodes of real morphs otherwise we
    // mistaken them for morphs and do wrong stuff in event dispatch etc.
    tree.prewalk(node, (node) => {
      if (typeof node.className !== "string") return;
        let cssClasses = node.className
              .split(" ")
              .map(ea => ea.trim())
              .filter(Boolean),
            isMorph = cssClasses.includes("Morph");
      if (!isMorph) return;
      node.className = arr.withoutAll(cssClasses, ["morph", "Morph"]).join(" ");
      node.id = "";
    },
    node => Array.from(node.childNodes));

    return asNode ? node : node.outerHTML;
  }

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
    this._tickingScripts.push(script);
    script.startTicking(stepTime);
    return script;
  }

  get tickingScripts() { return this._tickingScripts; }

  stopStepping() {
    arr.invoke(this._tickingScripts, 'stop');
    this._tickingScripts.length = [];
  }

  stopSteppingScriptNamed(selector) {
    var scriptsToStop = this._tickingScripts.filter(ea => ea.selector === selector);
    this.stopScripts(scriptsToStop);
  }

  stopScripts(scripts) {
    arr.invoke(scripts, 'stop');
    this._tickingScripts = arr.withoutAll(this._tickingScripts, scripts);
  }

  suspendStepping() {
    if (this._tickingScripts)
      arr.invoke(this._tickingScripts, 'suspend');
  }

  suspendSteppingAll() {
    this.withAllSubmorphsDo(ea => ea.suspendStepping());
  }

  resumeStepping() {
    arr.invoke(this._tickingScripts, 'resume');
  }

  resumeSteppingAll() {
    this.withAllSubmorphsDo(ea => arr.invoke(ea._tickingScripts, 'resume'));
  }

  removeEqualScripts(script) {
    this.stopScripts(this._tickingScripts.filter(ea => ea.equals(script)));
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
  static get properties() {
    return {
      borderRadiusLeft:   {get() { return this.height; }, set() {}},
      borderRadiusRight:  {get() { return this.height; }, set() {}},
      borderRadiusTop:    {get() { return this.width; }, set() {}},
      borderRadiusBottom: {get() { return this.width; }, set() {}},
    }
  }
}

export class Triangle extends Morph {

  static get properties() {
    return {
      direction: {defaultValue: "up"},
      triangleFill: {after: ["fill"], initialize() { this.triangleFill = this.fill; }}
    }
  }

  constructor(props = {}) {
    super(props);
    this.update();
  }

  onChange(change) {
    if (change.prop == "extent"
     || change.prop == "direction"
     || (change.prop == "fill" && change.value)
   ) this.update();
    super.onChange(change);
  }

  update() {
    var {x: width, y: height} = this.extent;
    if (width != height) this.extent = pt(Math.max(width, height), Math.max(width, height))

    this.origin = pt(width/2, height/2)

    var color = this.triangleFill = this.fill || this.triangleFill;
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

  static get properties() {
    return {

      imageUrl: {
        after: ['extent'],
        defaultValue: System.decanonicalize("lively.morphic/lively-web-logo-small.svg"),

        set(url) {
          this.isLoaded = false;
          this.setProperty("imageUrl", url);
          this.setProperty("naturalExtent", null);
          this.whenLoaded().then(() => {
            if (this.imageUrl !== url) return;
            this.isLoaded = true;
            this.autoResize && (this.extent = this.naturalExtent);
          });
        }
      },

      naturalExtent: {defaultValue: null},
      isLoaded: {defaultValue: false, serialize: false},
      autoResize: {defaultValue: false}
    }
  }

  get isImage() { return true }

  loadUrl(url, autoResize = this.autoResize) {
    let prevAutoResize = this.autoResize;
    this.autoResize = autoResize;
    this.imageUrl = url;
    return promise.finally(this.whenLoaded(), () => this.autoResize = prevAutoResize)
  }

  whenLoaded() {
    if (this.isLoaded) return Promise.resolve(this);
    return new Promise((resolve, reject) => {
      let url = this.imageUrl;
      let image = this.imageElement(image => {
        if (this.imageUrl !== url) reject(new Error(`url changed (${url} => ${this.imageUrl})`));
        this.naturalExtent = pt(image.width, image.height);
        this.isLoaded = true;
        resolve(this);
      });
    });
  }

  determineNaturalExtent() { return this.whenLoaded().then(() => this.naturalExtent); }

  render(renderer) { return renderer.renderImage(this); }

  
  clear() {
    // transparent gif:
    return this.loadUrl("data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", false);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // accessing DOM related things

  imageElement(onloadFn) {
    let doc = this.env.domEnv.document,
        image = doc.createElement("img");
    if (typeof onloadFn === "function")
      image.onload = () => onloadFn(image);
    image.src = this.imageUrl;
    return image;
  }

  canvasElementAndContext() {
    let doc = this.env.domEnv.document,
        image = this.imageElement(),
        canvas = doc.createElement('canvas'),
        ctx = canvas.getContext('2d');
    return {canvas, ctx, image};
  }


  imageData() {
    // this.arrayBuffer();
    let {ctx, canvas, image} = this.canvasElementAndContext();
    return ctx.getImageData(0,0, image.width, image.height);
  }

  arrayBuffer() { return this.imageData().data.buffer; }

  async convertToBase64() {
    // this.imageUrl = "http://www.amir.ninja/content/images/2015/12/Hello-World.png"
    // await this.convertToBase64();
    var urlString = this.imageUrl,
        type = urlString.slice(urlString.lastIndexOf('.') + 1, urlString.length).toLowerCase();
    if (type == 'jpg') type = 'jpeg';
    if (!['gif', 'jpeg', 'png', 'tiff'].includes(type)) type = 'gif';
    if (!urlString.startsWith('http'))
      urlString = location.origin + "/" + urlString;
    let {runCommand} = await System.import("lively.morphic/ide/shell/shell-interface"),
        cmd = 'curl --silent "' + urlString + '" | openssl base64',
        {stdout} = await runCommand(cmd).whenDone();
    return this.loadUrl('data:image/' + type + ';base64,' + stdout, false);
  }

  downloadImage() {
    // This doesn't work in all browsers. Alternative would be:
    // var dataDownloadURL = url.replace(/^data:image\/[^;]/, 'data:application/octet-stream')
    // window.open(dataDownloadURL);
    // however this wouldn't allow to set a file name...  
    // this.downloadImage();
    var url = this.imageUrl, name;
    if (url.match(/^data:image/)) { // data url
      name = this.name || "image-from-lively";
      var typeMatch = url.match(/image\/([^;]+)/)
      if (typeMatch && typeMatch[1]) name += "." + typeMatch[1];
    } else {
      if (!name) name = arr.last(url.split('/'));
    }
    var link = document.createElement('a');
    link.download = name;
    link.href = url;
    link.click();
  }
  
  convertTo(type, quality) {
    // this.convertTo("image/jpeg", 0.8)
    // this.convertTo(); 123
    if (!quality) quality = 1;
    let {ctx, canvas, image} = this.canvasElementAndContext(),
        {width, height} = this;
    canvas.width = image.width;
    canvas.height = image.height;
    ctx.drawImage(image, 0, 0, width, height);
    return this.loadUrl(canvas.toDataURL(type, quality), false);
  }

  async resampleImageToFitBounds() {
    // changes the image resolution so that it fits 1:1 to the current extent
    // of the image;

    // Example:
    /*
    await this.loadUrl("http://www.amir.ninja/content/images/2015/12/Hello-World.png", false)
    let from = this.naturalExtent;
    await this.convertToBase64();
    this.extent = pt(300,300)
    await this.resampleImageToFitBounds();
    let to = this.naturalExtent;
    `${from} => ${to}`;
    */
    let {ctx, canvas, image} = this.canvasElementAndContext(),
        {width: newWidth, height: newHeight} = this,
        {width: imageWidth, height: imageHeight} = image,
        pixelratio = window.devicePixelRatio || 1;

    canvas.width = imageWidth; canvas.height = imageHeight;
    ctx.drawImage(image, 0, 0, newWidth, newHeight);
    let data = ctx.getImageData(0, 0, imageWidth, imageHeight);
    canvas.width = newWidth * pixelratio | 0;
    canvas.height = newHeight * pixelratio | 0;
    ctx.putImageData(data, 0,0);
    return this.loadUrl(canvas.toDataURL(), false);
  }

  crop(cropBounds) {
    let {ctx, canvas, image} = this.canvasElementAndContext(),
        {width, height} = this,
        innerBounds = this.innerBounds(),
        {width: imageWidth, height: imageHeight} = image,
        intersection = innerBounds.intersection(cropBounds),
        relativeCrop = new Rectangle(
          intersection.x / innerBounds.width,
          intersection.y / innerBounds.height,
          intersection.width / innerBounds.width,
          intersection.height / innerBounds.height),
        [unscaledCropBounds] = new Rectangle(0, 0, imageWidth, imageHeight).divide([relativeCrop]);

    canvas.width = imageWidth; canvas.height = imageHeight;
    ctx.drawImage(image, 0, 0, imageWidth, imageHeight);

    let data = ctx.getImageData(unscaledCropBounds.x, unscaledCropBounds.y, unscaledCropBounds.width, unscaledCropBounds.height);
    canvas.width = unscaledCropBounds.width;
    canvas.height = unscaledCropBounds.height;
    ctx.putImageData(data, 0,0);

    return this.loadUrl(canvas.toDataURL(), false);
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

  get controlPoints() {
    return this._controlPoints || {next: pt(0, 0), previous: pt(0, 0)};
  }
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
    var v0 = pt(a.x, a.y),
        v1 = pt(b.x, b.y),
        l = v1.subPt(v0),
        ln = l.scaleBy(1 / l.r()),
        dot = v1.subPt(pos).dotProduct(ln);
    return v1
      .subPt(ln.scaleBy(Math.max(1, Math.min(dot, l.r()))))
      .addXY(bw, bw);
  }

  get nextVertex() { return this.path.vertexAfter(this); }

  get previousVertex() { return this.path.vertexBefore(this); }

  adaptControlPoints(smooth) {
    var nextPos = this.nextVertex.position,
        previousPos = this.previousVertex.position;
    if (smooth) {
      const p = this.pointOnLine(
        previousPos, nextPos, this.position, this.borderWidth);
      this.controlPoints = {
        next: p.subPt(previousPos),
        previous: p.subPt(nextPos)
      };
    } else {
      this.controlPoints = {
        previous: previousPos.subPt(this.position).scaleBy(0.5),
        next: nextPos.subPt(this.position).scaleBy(0.5)
      };
    }
    this.path.onVertexChanged(this);
  }

}

export class Path extends Morph {

  static get properties() {
    return {
      vertices: {
        defaultValue: [],
        set(vs) {
          vs = vs.map(v => new PathPoint(this, {...v, borderWidth: this.borderWidth}));
          this.setProperty("vertices", vs);
        }
      }
    }
  }

  constructor(props = {}) {
    super({...obj.dissoc(props, "origin")});
    this.adjustOrigin(props.origin || this.origin);
    this.position = props.position || this.position;
  }

  get isPath() { return true; }
  get isSvgMorph() { return true }

  onVertexChanged(vertex) {
    this.makeDirty();
    this.updateBounds(this.vertices);
  }

  updateBounds(vertices) {
    const b = Rectangle.unionPts([
      pt(0, 0),
      ...arr.flatmap(vertices, ({position, controlPoints}) => {
        var {next, previous} = controlPoints || {};
        if (next) next = position.addPt(next);
        if (previous) previous = position.addPt(previous);
        return arr.compact([next, position, previous]);
      })
    ]);
    this.adjustingVertices = true;
    this.extent = b.extent();
    this.origin = b.topLeft().negated();
    this.adjustingVertices = false;
  }

  onChange(change) {
    if (change.prop == "extent" && change.value && change.prevValue && !this.adjustingVertices)
      this.adjustVertices(change.value.scaleByPt(change.prevValue.inverted()));
    if (!this.adjustingOrigin && ["vertices", "borderWidthLeft"].includes(change.prop))
      this.updateBounds(change.prop == "vertices" ? change.value : this.vertices);
    super.onChange(change);
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
    this.vertices && this.vertices.forEach(v => {
        var {next, previous} = v.controlPoints;
        next = next.scaleByPt(delta);
        previous = previous.scaleByPt(delta);
        v.position = v.position
          .addPt(this.origin)
          .scaleByPt(delta)
          .subPt(this.origin);
        v.controlPoints = {next, previous};
      });
  }

  adjustOrigin(newOrigin) {
    this.adjustingOrigin = true;
    this.vertices.forEach(v =>
      v.position = this.origin.subPt(newOrigin).addXY(v.x, v.y));
    super.adjustOrigin(newOrigin);
    this.adjustingOrigin = false;
  }

  addVertex(v, before = null) {
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
    } else {
      throw new Error("A polygon requires 3 or more vertices!");
    }
  }

  get isPolygon() { return true; }

}
