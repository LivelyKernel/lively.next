/*global System,Uint8Array,Blob,location*/
import { Color, Line, Point, pt, rect, Rectangle, Transform } from "lively.graphics";
import { string, obj, arr, num, promise, tree, fun, Path as PropPath } from "lively.lang";
import {
  renderRootMorph,
  AnimationQueue,
  ShadowObject
} from "./rendering/morphic-default.js";
import { morph, Icon, show } from "./index.js";
import { MorphicEnv } from "./env.js";
import config from "./config.js";
import CommandHandler from "./CommandHandler.js";
import KeyHandler, { findKeysForPlatform } from "./events/KeyHandler.js";
import { TargetScript } from "./ticking.js";
import { copyMorph } from "./serialization.js";
import { Path as PropertyPath } from "lively.lang";
import { isNumber, isString } from "lively.lang/object.js";
import { capitalize } from "lively.lang/string.js";
import { connect, signal } from "lively.bindings";
import { StylingVisitor } from "./sizzle.js";

// optional lively.halos imports
import {showAndSnapToGuides, removeSnapToGuidesOf} from "lively.halos/drag-guides.js";

const defaultCommandHandler = new CommandHandler();

export function newMorphId(classOrClassName) {
  var prefix = typeof classOrClassName === "function" ?
    classOrClassName.name : typeof classOrClassName === "string" ?
      classOrClassName.toLowerCase() : "";
  return prefix + "_" + string.newUUID().replace(/-/g, "_");
}

function generateUnfolded(propName, members=['top', 'left', 'right', 'bottom'], group = "core") {
  // generate the accessors for members of a folded property
  let propertyDeclarations = {};
  for (let m of members) {
    propertyDeclarations[propName + capitalize(m)] = {
      group,
      derived: true,
      generated: true,
      after: [propName],
      get() { return this.getProperty(propName)[m]; },
      set(v) { this[propName] = {...this.getProperty(propName), [m]: v}; }
    };
  }
  return propertyDeclarations;
}

export class Morph {

  static get propertySettings() {
    return {
      defaultGetter(key) { return this.getProperty(key); },
      defaultSetter(key, value) { this.setProperty(key, value); },
      valueStoreProperty: "_morphicState"
    };
  }

  static get properties() {
    return {

      name: {
        group: "core",
        initialize() {
          let className = this.constructor.name;
          this.name = (string.startsWithVowel(className) ? "an" : "a") + className;
        }
      },

      draggable: {
        group: "interaction",
        isStyleProp: true, defaultValue: true
      },

      grabbable: {
        group: "interaction",
        isStyleProp: true,
        defaultValue: false,
        set(bool) {
          // Since grabbing is implemented via dragging we also need to make
          // this morph draggable
          if (bool && !this.draggable) this.draggable = true;
          this.setProperty("grabbable", bool);
        }
      },

      acceptsDrops: {
        group: "interaction",
        isStyleProp: true,
        defaultValue: true
      },

      dropShadow: {
        group: "styling",
        type: 'Shadow',
        isStyleProp: true,
        defaultValue: null,
        set(value) {
          if (value && !value.isShadowObject) {
            value = new ShadowObject(value);
            value.morph = this;
          }
          this.setProperty("dropShadow", value);
        }
      },

      tooltip:            {
        group: "core",
        defaultValue: null
      },

      focusable: {
        group: "interaction",
        defaultValue: true
      },

      nativeCursor: {
        group: "interaction",
        type: "Enum",
        values: [
          "auto",
          "default",
          "none",
          "context-menu",
          "help",
          "pointer",
          "progress",
          "wait",
          "cell",
          "crosshair",
          "text",
          "vertical-text",
          "alias",
          "copy",
          "move",
          "no-drop",
          "not-allowed",
          "e-resize",
          "n-resize",
          "ne-resize",
          "nw-resize",
          "s-resize",
          "se-resize",
          "sw-resize",
          "w-resize",
          "ew-resize",
          "ns-resize",
          "nesw-resize",
          "nwse-resize",
          "col-resize",
          "row-resize",
          "all-scroll",
          "zoom-in",
          "zoom-out",
          "grab",
          "grabbing"
        ],
        isStyleProp: true,
        defaultValue: "auto"
      },

      halosEnabled: {
        group: "interaction",
        isStyleProp: true,
        defaultValue: !!config.halosEnabled
      },

      reactsToPointer: {
        group: "interaction",
        defaultValue: true
      },

      position: {
        group: "geometry",
        type: "Point", isStyleProp: true, defaultValue: pt(0, 0)
      },

      origin:   {
        group: "geometry",
        type: 'Point', isStyleProp: true, defaultValue: pt(0,0)
      },

      extent:   {
        group: "geometry",
        type: 'Point', isStyleProp: true, defaultValue: pt(10, 10)
      },

      width: {
        group: "geometry",
        derived: true, after: ['extent'], before: ['submorphs'],
        get()         { return this.extent.x; },
        set(v)        { return this.extent = pt(v, this.extent.y); }
      },

      height: {
        group: "geometry",
        derived: true, after: ['extent'], before: ['submorphs'],
        get()        { return this.extent.y; },
        set(v)       { return this.extent = pt(this.extent.x, v); }
      },

      left: {
        group: "geometry",
        derived: true, after: ['extent', 'submorphs', 'layout'],
        get()          { return this.bounds().left(); },
        set(v)         { return this.moveBy(pt(v - this.left), 0); }
      },

      right: {
        group: "geometry",
        derived: true, after: ['extent', 'submorphs', 'layout'],
        get()         { return this.bounds().right(); },
        set(v)        { return this.moveBy(pt(v - this.right), 0); }
      },
      top: {
        group: "geometry",
        derived: true, after: ['extent', 'submorphs', 'layout'],
        get()           { return this.bounds().top(); },
        set(v)          { return this.moveBy(pt(0, v - this.top)); }
      },
      bottom: {
        group: "geometry",
        derived: true, after: ['extent', 'submorphs', 'layout'],
        get()        { return this.bounds().bottom(); },
        set(v)       { return this.moveBy(pt(0, v - this.bottom)); }
      },
      center: {
        group: "geometry",
        derived: true, after: ['extent', 'submorphs', 'layout'],
        get()        { return this.bounds().center(); },
        set(v)       { return this.align(this.center, v); }
      },
      topLeft: {
        group: "geometry",
        derived: true, after: ['extent', 'submorphs', 'layout'],
        get()       { return this.bounds().topLeft(); },
        set(v)      { return this.align(this.topLeft, v); }
      },
      topRight: {
        group: "geometry",
        derived: true, after: ['extent', 'submorphs', 'layout'],
        get()      { return this.bounds().topRight(); },
        set(v)     { return this.align(this.topRight, v); }
      },
      bottomRight: {
        group: "geometry",
        derived: true, after: ['extent', 'layout'],
        get()   { return this.bounds().bottomRight(); },
        set(v)  { return this.align(this.bottomRight, v); }
      },
      bottomLeft: {
        group: "geometry",
        derived: true, after: ['extent', 'submorphs', 'layout'],
        get()    { return this.bounds().bottomLeft(); },
        set(v)   { return this.align(this.bottomLeft, v); }
      },
      bottomCenter: {
        group: "geometry",
        derived: true, after: ['extent', 'submorphs', 'layout'],
        get()  { return this.bounds().bottomCenter(); },
        set(v) { return this.align(this.bottomCenter, v); }
      },
      topCenter: {
        group: "geometry",
        derived: true, after: ['extent', 'submorphs', 'layout'],
        get()     { return this.bounds().topCenter(); },
        set(v)    { return this.align(this.topCenter, v); }
      },
      leftCenter: {
        group: "geometry",
        derived: true, after: ['extent', 'submorphs'],
          get()    { return this.bounds().leftCenter(); },
          set(v)   { return this.align(this.leftCenter, v); }
      },
      rightCenter: {
        group: "geometry",
        derived: true, after: ['extent', 'submorphs'],
        get()   { return this.bounds().rightCenter(); },
        set(v)  { return this.align(this.rightCenter, v); }
      },
      rotation: {
        group: "geometry",
        type: 'Number',
        isFloat: true,
        isStyleProp: true, defaultValue:  0
      },

      scale: {
        group: "geometry",
        type: "Number", min: 0,
        isFloat: true,
        isStyleProp: true, defaultValue: 1
      },

      hasFixedPosition: {
        group: "geometry",
        doc: "When morph is submorph of world hasFixedPosition == true will keep the morph at the same position relative to top left of the browser window. This means, when the world is scrolled, the morph keeps its place.",
        defaultValue: false
      },

      opacity: {
        group: "styling",
        type: 'Number',
        min: 0,
        max: 1,
        isStyleProp: true, defaultValue: 1
      },

      fill: {
        group: "styling",
        type: 'ColorGradient',
        isStyleProp: true, defaultValue: Color.white
      },

      visible: {
        group: "styling",
        isStyleProp: true,
        defaultValue: true,
        set (bool) {
          if (!bool) this.makeDirty(); /*updates stopped afterwards*/
          this.setProperty("visible", bool);
        }
      },

      submorphs: {
        group: "core",
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
        group: "styling",
        type: 'Enum',
        values: ["visible", "hidden", "scroll", "auto"],
        isStyleProp: true,
        defaultValue: "visible",
        set(value) {
          this.setProperty("clipMode", value);
          if (!this.isClip()) this.scroll = pt(0, 0);
        }
      },

      scroll: {
        group: "geometry",
        defaultValue: pt(0, 0),
        type: 'Point',
        set({x, y}) {
          if (!this.isClip()) return;
          var {x: maxScrollX, y: maxScrollY} = this.scrollExtent.subPt(this.extent);
          x = Math.max(0, Math.min(maxScrollX, x));
          y = Math.max(0, Math.min(maxScrollY, y));
          this.setProperty("scroll", pt(x, y));
          this.makeDirty();
        }
      },

      scrollbarOffset: {
        group: "styling",
        defaultValue: pt(15,15)
      },

      styleClasses: {
        group: "styling",
        isStyleProp: true,
        defaultValue: ["morph"],
        get() {
          return this.constructor.styleClasses.concat(this.getProperty("styleClasses"));
        },
        set(value) {
          this.setProperty("styleClasses", arr.withoutAll(value, this.constructor.styleClasses));
          this.requestStyling();
        }
      },

      layout: {
        group: "layouting",
        isStyleProp: true,
        type: 'Layout',
        after: ["submorphs", "extent", "origin", "position", "isLayoutable", 'styleSheets'],
        set(value) {
          if (value) value.container = this;
          this.setProperty("layout", value);
        }
      },

      isLayoutable: {
        group: "layouting",
        isStyleProp: true, defaultValue: true
      },

      borderLeft: {
        group: "styling",
        isStyleProp: true,
        derived: true,
        after:   ["borderStyleLeft", "borderWidthLeft", "borderColorLeft"],
        get() {
          return {
            style: this.borderStyleLeft,
            width: this.borderWidthLeft,
            color: this.borderColorLeft
          };
        },
        set(x) {
          if ("style" in x) this.borderStyleLeft = x.style;
          if ("width" in x) this.borderWidthLeft = x.width;
          if ("color" in x) this.borderColorLeft = x.color;
          if ("radius" in x) this.borderRadiusLeft = x.radius;
        }
      },

      borderRight: {
        group: "styling",
        isStyleProp: true,
        derived: true,
        after:  ["borderStyleRight", "borderWidthRight", "borderColorRight"],
        get() {
          return {
            style: this.borderStyleRight,
            width: this.borderWidthRight,
            color: this.borderColorRight
          };
        },
        set(x) {
          if ("style" in x) this.borderStyleRight = x.style;
          if ("width" in x) this.borderWidthRight = x.width;
          if ("color" in x) this.borderColorRight = x.color;
          if ("radius" in x) this.borderRadiusRight = x.radius;
        }
      },

      borderBottom: {
        group: "styling",
        isStyleProp: true,
        derived: true,
        after: ["borderStyleBottom", "borderWidthBottom", "borderColorBottom"],
        get() {
          return {
            style: this.borderStyleBottom,
            width: this.borderWidthBottom,
            color: this.borderColorBottom
          };
        },
        set(x) {
          if ("style" in x) this.borderStyleBottom = x.style;
          if ("width" in x) this.borderWidthBottom = x.width;
          if ("color" in x) this.borderColorBottom = x.color;
          if ("radius" in x) this.borderRadiusBottom = x.radius;
        }
      },

      borderTop: {
        group: "styling",
        isStyleProp: true,
        derived: true,
        after: ["borderStyleTop", "borderWidthTop", "borderColorTop"],
        get() {
          return {
            style: this.borderStyleTop,
            width: this.borderWidthTop,
            color: this.borderColorTop
          };
        },
        set(x) {
          if ("style" in x) this.borderStyleTop = x.style;
          if ("width" in x) this.borderWidthTop = x.width;
          if ("color" in x) this.borderColorTop = x.color;
          if ("radius" in x) this.borderRadiusTop = x.radius;
        }
      },

      borderWidth: {
        group: "styling",
        isStyleProp: true,
        type: 'Number',
        foldable: ['top', 'left', 'right', 'bottom'],
        min: 0,
        defaultValue: {top: 0, bottom: 0, left: 0, right: 0, valueOf: () => 0},
        get() {
          let v = this.getProperty('borderWidth');
          return {...v, valueOf: () => v.left };
        },
        set(value) {
          if (isNumber(value)) {
             var left = value, right = value, top = value, bottom = value;
             value = {left, right, top, bottom};
          }
          this.setProperty('borderWidth', value);
        }
      },

      ...generateUnfolded('borderWidth', undefined, "styling"),

      borderRadius: {
        group: "styling",
        isStyleProp: true,
        type: 'Number',
        min: 0,
        foldable: ['top', 'left', 'right', 'bottom'],
        defaultValue: {top: 0, bottom: 0, right: 0, left: 0, valueOf: () => 0},
        get() {
          let v = this.getProperty('borderRadius');
          return {...v, valueOf: () => v.left };
        },
        set(value) {
          if (!value) value = 0;
          if (isNumber(value)) {
             var left = value, right = value, top = value, bottom = value;
             value = {left, right, top, bottom};
          }
          if (value.isRectangle) {
            value = {
              left: value.left(),
              right: value.right(),
              top: value.top(),
              bottom: value.bottom()
            };
          }
          this.setProperty('borderRadius', value);
        }
      },

      ...generateUnfolded('borderRadius', undefined, "styling"),

      borderStyle: {
        group: "styling",
        isStyleProp: true,
        type: 'Enum',
        foldable: ['top', 'left', 'right', 'bottom'],
        values: ["none", "hidden", "dotted", "dashed",
                 "solid", "double", "groove", "ridge", "inset", "outset"],
        defaultValue: {
          top: 'solid', left: 'solid', bottom: 'solid',
          right: 'solid', valueOf: () => 'solid'
        },
        get() {
          let v = this.getProperty('borderStyle');
          return {...v, valueOf: () => v.left}
        },
        set(value) {
          if (isString(value)) {
             var left = value, right = value, top = value, bottom = value;
             value = {left, right, top, bottom};
          }
          this.setProperty('borderStyle', value);
        }
      },

      ...generateUnfolded('borderStyle', undefined, "styling"),

      borderColor: {
        group: "styling",
        isStyleProp: true,
        type: "Color",
        foldable: ["top", "left", "right", "bottom"],
        defaultValue: {
          top: Color.white, left: Color.white, bottom: Color.white,
          right: Color.white, valueOf: () => Color.white
        },
        get() {
          let v = this.getProperty("borderColor");
          return {...v, valueOf: () => v.left};
        },
        set(value) {
          if (!value) value = Color.white;
          if (value.isColor) {
            value = {top: value, left: value, right: value, bottom: value};
          }
          this.setProperty(
            "borderColor",
            value ? obj.extract(value, ["top", "left", "right", "bottom"], (k, v) => {
              return obj.isArray(v) ? Color.fromTuple(v) : v
            }) : value
          );
        }
      },

      ...generateUnfolded('borderColor', undefined, "styling"),

      border: {
        group: "styling",
        isStyleProp: true,
        derived: true,
        after: ["borderStyle", "borderWidth", "borderColor"],
        get() {
          let self = this;
          return {
            get style()           { return self.borderStyle; },
            set style(val)        { self.borderStyle = val; },
            get width()           { return self.borderWidth; },
            set width(val)        { self.borderWidth = val; },
            get color()           { return self.borderColor; },
            set color(val)        { self.borderColor = val; },
            get borderRadius()    { return self.borderRadius; },
            set borderRadius(val) { self.borderRadius = val; }
          };
        },
        set(x)   {
          if ("style" in x) this.borderStyle = x.style;
          if ("width" in x) this.borderWidth = x.width;
          if ("color" in x) this.borderColor = x.color;
          if ("radius" in x) this.borderRadius = x.radius;
        }
      },

      styleSheets: {
        group: "styling",
        before: ['submorphs'],
        type: 'StyleSheets',
        defaultValue: [],
        set(sheets) {
          if (!obj.isArray(sheets)) {
            sheets = [sheets];
          }
          this.setProperty("styleSheets", sheets);
          sheets.forEach(ss => {
            ss.context = this;
          });
          this.requestStyling();
        }
      },

      styleProperties: {
        group: "styling",
        derived: true, readOnly: true,
        get() {
          var p = this.propertiesAndPropertySettings().properties,
              styleProps = [];
          for (var prop in p)
            if (p[prop].isStyleProp)
              styleProps.push(prop);
          return styleProps;
        }
      },

      style: {
        group: "styling",
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
        group: "core",
        doc: "epi morphs are 'transient' morphs, i.e. meta objects that should not be serialized like halo items, menus, etc.",
        defaultValue: false
      },

      respondsToVisibleWindow: {
        group: "interaction",
        doc: "Morphs will respond to changes in visible window and a call will be made to the morph's relayout function, supplying the event generated",
        defaultValue: false
      },

      metadata: {group: "core"}
    }

  }

  constructor(props) {
    if (!props) props = {};
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
    this.initializeProperties(props);
    if (props.bounds) this.setBounds(props.bounds);

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // rk 2017-02-04: FIXME remove the assign below once we are fully
    // transitioned to properties. Properties themselves set their default or
    // constructor value in initializeProperties
    let descriptors = Object.getOwnPropertyDescriptors(props),
        myDescriptors = {},
        dontAssign = {env: true, type: true, submorphs: true, bounds: true, layout: true},
        properties = this.propertiesAndPropertySettings().properties;
    for (let key in descriptors)
      if (!(key in dontAssign) && !(key in properties))
        myDescriptors[key] = descriptors[key];
    Object.defineProperties(this, myDescriptors);
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    if (props.layout) this.layout = props.layout;

    if (typeof this.onLoad === "function") this.onLoad();
  }

  get __serialization_id_property__() { return "_id"; }

  __deserialize__(snapshot, objRef) {
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
      if (
        descr.readOnly ||
        descr.derived ||
        this[key] === defaults[key] ||
        (descr.hasOwnProperty("serialize") && !descr.serialize)
      ) continue;
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

    for (let foldedProp of ['borderColor', 'borderWidth', 'borderStyle', 'borderRadius']) {
      snapshot.props[foldedProp] = {
        key: foldedProp,
        verbatim: true,
        value: obj.extract(
          this[foldedProp], ['top', 'right', 'bottom', 'left'],
          (prop, value) => value && value.isColor ? value.toTuple() : value)
      }
    }
  }


  get isMorph() { return true; }
  get id() { return this._id; }

  get env() { return this._env; }

  spec() {
    let defaults = this.defaultProperties,
        properties = this.propertiesAndPropertySettings().properties,
        ignored = {submorphs: true},
        spec = {};
    "attributeConnections"
    for (let key in properties) {
      let descr = properties[key];
      if (
        descr.readOnly ||
        descr.derived ||
        this[key] === defaults[key] ||
        (this[key] && typeof this[key].equals === "function" && this[key].equals(defaults[key])) ||
        (descr.hasOwnProperty("serialize") && !descr.serialize) ||
        key in ignored
      ) continue;
      spec[key] = this[key];
    }
    if (this.submorphs.length) {
      spec.submorphs = this.submorphs.map(ea => ea.spec());
    }
    spec.type = this.constructor.name.toLowerCase();
    return spec;
  }

  printSpec(spec = null, depth = 0) {
    spec = spec || this.spec();
    let priority = {name: true, type: true, submorphs: true};
    let singleIndent = "  ";
    let propIndent = singleIndent.repeat(depth+1);
    let printed = singleIndent.repeat(depth) + "{\n"
               + `${propIndent}name: "${spec.name}",\n`
               + `${propIndent}type: "${spec.type}",\n`;
    for (let key in spec)
      if (!priority[key])
        printed = printed + `${propIndent}${key}: ${string.print(spec[key])},\n`
    if (spec.submorphs) {
      printed += `${propIndent}submorphs: [\n`
      for (let subspec of spec.submorphs)
        printed += this.printSpec(subspec, depth+1);
      printed += `]\n`
    }
    printed += singleIndent.repeat(depth) + "}\n";
    return printed;
  }

  get defaultProperties() {
    let klass = this.constructor,
        superklass = klass[Symbol.for("lively-instance-superclass")];
    if (
      !klass._morphicDefaultPropertyValues ||
      klass._morphicDefaultPropertyValues ==
        (superklass && superklass._morphicDefaultPropertyValues)
    ) {
      var defaults = (this.constructor._morphicDefaultPropertyValues = {}),
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
  getProperty(key) { return this._morphicState[key] }
  setProperty(key, value, meta) {
    return this.addValueChange(key, value, meta);
  }

  changeMetaData(path, data, serialize = true, merge = true) {
    let {metadata} = this;
    if (!metadata) metadata = {};
    PropPath(path).withParentAndKeyDo(metadata, true, (parent, key) => {
      if (merge) parent[key] = {...parent[key], ...data};
      else parent[key] = data;
      let dont = parent.__dont_serialize__;
      if (!serialize) {
        if (!dont) dont = parent.__dont_serialize__ = []
        arr.pushIfNotIncluded(dont, key);
      } else {
        if (dont && dont.includes(key)) {
          arr.remove(dont, key);
          if (dont.length === 0) delete parent.__dont_serialize__;
        }
      }
    });
    this.metadata = metadata;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // debugging
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  toString() {
    return `<${this.constructor.name} - ${this.name ? this.name : this.id}>`;
  }

  edit(opts) {
    return this.env.world.execCommand("open object editor", {...opts, target: this});
  }

  inspect(opts) {
    return this.env.world.execCommand("open object inspector", {...opts, target: this});
  }

  livelyCustomInspect() {
    var ignored = {_id: true, _owner: true}, seen = {},
        props = this.propertiesAndPropertySettings().properties,
        properties = [];
    for (let key in props) {
      if (ignored[key] || (props[key].derived && !props[key].showInInspector)) continue;
      seen[key] = true;
      properties.push({key, value: this[key]});
    }

    properties.push({key: "id", value: this.id});
    properties.push({key: "owner", value: this.owner});

    properties = properties.sort((a, b) => {
      let aK = a.key.toLowerCase(),
          bK = b.key.toLowerCase();
      return aK < bK ? -1 : aK === bK ? 0 : 1
    });

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
      "_styleSheetProps",
      "_renderer",
      "_tooltipViewer",
      "layout",
    ];

    if (this.attributeConnections) {
      for (let c of this.attributeConnections)
        ignored[`$$${c.sourceAttrName}`, `${c.sourceAttrName}`] = true;
    }

    Object.assign(seen, ignored)
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
    const anim = change.meta && change.meta.animation,
          {prop, value} = change;

    if ('position' === prop || 'rotation' === prop
        || 'scale' === prop || 'origin' === prop
        || 'reactsToPointer' === prop) {
      this.onBoundsChanged(this.bounds());
      this.updateTransform({[prop]: value});

    } else  if (prop == 'extent') {
      this.onBoundsChanged(this.bounds());

    } else if (prop == "layout") {
      if (anim) {
         value && value.attachAnimated(anim.duration, this, anim.easing);
      } else {
         value && value.attach();
      }
    }

    this.layout && this.layout.onChange(change);
  }

  onBoundsChanged(bounds) {
    signal(this, 'bounds', bounds);
    [...bounds.corners, ...bounds.sides].forEach(c => {
      signal(this, c, bounds.partNamed(c))
    })
  }

  onSubmorphChange(change, submorph) {
    this.layout && this.layout.onSubmorphChange(submorph, change);
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
    return (this.submorphs.length ?
      this.innerBounds().union(this.submorphBounds()) :
      this.innerBounds()).extent().addPt(this.scrollbarOffset);
  }

  scrollBounds() {
    let {x, y} = this.scroll,
        {x: w, y: h} = this.scrollExtent;
    return new Rectangle(x,y, w,h);
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
  removeStyleClass(className) {
    this.styleClasses = this.styleClasses.filter(ea => ea != className);
  }

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

  relativeSubmorphBounds() {
    let bounds = this.innerBounds();
    return this.submorphs.map(ea => {
      let {width, height, x,y} = ea.bounds();
      return rect(x/bounds.width, y/bounds.height, width/bounds.width, height/bounds.height);
    });
  }

  globalBounds() {
    return this.relativeBounds(this.world());
  }

  submorphBounds() {
    if (this.submorphs.length < 1) return this.innerBounds();
    return this.submorphs.map(submorph => submorph.bounds())
                         .reduce((a,b) => a.union(b));
  }

  fitToSubmorphs(padding = Rectangle.inset(0)) {
    let {submorphs: morphs} = this;
    if (!morphs.length) return;

    let bounds = morphs.reduce(
      (bnds, ea) => bnds.union(ea.bounds()),
      morphs[0].bounds());

    let topOffset = bounds.top() - padding.top(),
        leftOffset = bounds.left() - padding.left();
    this.moveBy(pt(leftOffset, topOffset));
    arr.invoke(this.submorphs, "moveBy", pt(-leftOffset, -topOffset));
    this.extent = pt(
      bounds.width + padding.left() + padding.right(),
      bounds.height + padding.top() + padding.bottom());
  }

  align(p1, p2) { return this.moveBy(p2.subPt(p1)); }
  moveBy(delta) {
    this.position = this.position.addPt(delta);
  }
  rotateBy(delta) { this.rotation += delta; }
  resizeBy(delta) { this.extent = this.extent.addPt(delta); }
  snap(grid) { this.position = this.position.roundTo(grid || 1); }

  get isEpiMorph() {
    /*transient "meta" morph*/
    return this.getProperty("epiMorph");
  }

  isUsedAsEpiMorph() {
    var m = this;
    while (m) { if (m.isEpiMorph) return true; m = m.owner; }
    return false;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // morphic relationship
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  replaceWith(other, indexForOtherMorph, replaceSubmorphs = true) {
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
    if (replaceSubmorphs) {
      this.submorphs = [];
      other.submorphs = [];
    }

    if (myOwner === other) {
      otherOwner && otherOwner.addMorphAt(this, otherIndex);
      if (replaceSubmorphs) {
        this.submorphs = otherSubmorphs.slice(0, myIndex)
          .concat(other)
          .concat(otherSubmorphs.slice(myIndex))
        other.submorphs = mySubmorphs;
      }
    } else {
      myOwner && myOwner.addMorphAt(other, myIndex);
      otherOwner && otherOwner.addMorphAt(this, otherIndex);
      if (replaceSubmorphs) {
        other.submorphs = mySubmorphs;
        this.submorphs = otherSubmorphs;
      }
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

      submorph.requestStyling();

      this._submorphOrderChanged = true;
      this.makeDirty();
      submorph.resumeSteppingAll();

      submorph.withAllSubmorphsDo(ea => ea.onOwnerChanged(this));
    });

    return submorph;
  }

  addMorph(submorph, insertBeforeMorph) {
    // insert at right position in submorph list, according to insertBeforeMorph
    var submorphs = this.submorphs,
        insertBeforeMorphIndex = insertBeforeMorph
          ? submorphs.indexOf(insertBeforeMorph)
          : -1,
        insertionIndex = insertBeforeMorphIndex === -1
          ? submorphs.length
          : insertBeforeMorphIndex;

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
    this.ownerChain().forEach(m => {
      if (m._stylingVisitor) {
        m._stylingVisitor.deleteFromCache(this);
      }
    });
    if (this.owner) this.owner.removeMorph(this);
    this._cachedPaths = {};
    this._pathDependants.forEach(dep => dep._cachedPaths = {});
    this._pathDependants = [];
    this.withAllSubmorphsDo(ea => ea.onOwnerChanged(null));
    return this
  }

  onOwnerChanged(newOwner) {
    // newOwner = null => me or any of my owners was removed
    // newOwner = morp => me or any of my owners was added to another morph
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
    if (!world) return this;
    this.center = pos;
    this.setBounds(world.visibleBounds().insetBy(5).translateForInclusion(this.bounds()))
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
    if (pos) this.position = pos;
    else {
      this.center = world.visibleBounds().center();
      this.snap();
    }
    world.addMorph(this);
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
    for (var morph = this; morph && morph != other; morph = morph.owner) {
      let {origin, scroll}= morph;
      if (origin.x !== 0 || origin.y !== 0)
        tfm.preConcatenate(new Transform(morph.origin))
      tfm.preConcatenate(morph.getTransform())
      if (morph != this) {
        if ((scroll.x !== 0 || scroll.y !== 0) && morph.owner/*!owner means morph === world*/)
          tfm.preConcatenate(new Transform(scroll.negated()));
      }
      if (morph.hasFixedPosition && morph.owner) {
        tfm.preConcatenate(new Transform(morph.owner.scroll));
      }
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
    var {scroll} = other;
    if ((scroll.x !== 0 || scroll.y !== 0) && other.owner/*i.e. don't do it for the world'*/)
      tfm.preConcatenate(new Transform(scroll));
    return tfm;
  }

  transformPointToMorph(other, p) {
    for (var [d, m] of this.pathToMorph(other)) {
      if (this != m && d == 'up') {
        p.x -= m.scroll.x;
        p.y -= m.scroll.y;
        if (m.hasFixedPosition && m.owner && m.owner.owner) {
          p.x += m.owner.scroll.x;
          p.y += m.owner.scroll.y;
        }
      }
      this.applyTransform(d, m, p);
      if (this != m && d == 'down') {
        p.x += m.scroll.x;
        p.y += m.scroll.y;
        if (m.hasFixedPosition && m.owner && m.owner.owner/*i.e. except world*/) {
          p.x -= m.owner.scroll.x;
          p.y -= m.owner.scroll.y;
        }
      }
    }
    return p;
  }

  transformRectToMorph(other, r) {
     var tl, tr, br, bl;
     [tl = r.topLeft(), tr = r.topRight(),
      br = r.bottomRight(), bl = r.bottomLeft()]
       .forEach(corner => this.transformPointToMorph(other, corner));
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

  ensureToBeInWorldBounds() {
    let w = this.world();
    if (!w) return;
    let bnds = this.globalBounds(),
        translatedBnds = w.innerBounds().translateForInclusion(bnds),
        delta = translatedBnds.topLeft().subPt(bnds.topLeft());
    this.moveBy(delta);
  }

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

  getAllNamed(name, result = []) {
    if (!this._morphicState /*pre-init when used in constructor*/
     || !this.submorphs.length) return result;
    for (let i = 0; i < this.submorphs.length; i++) {
      let morph = this.submorphs[i];
      if (this.getNameTest(morph, name)) result.push(morph);
    }
    for (let i = 0; i < this.submorphs.length; i++)
      this.submorphs[i].getAllNamed(name, result);
    return result;
  }

  getSubmorphNamed(name) {
    if (!this._morphicState /*pre-init when used in constructor*/
     || !this.submorphs.length) return null;
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

  getSubmorphsByStyleClassName(styleClassName) {
    return this.withAllSubmorphsSelect(({styleClasses}) => styleClasses.includes(styleClassName));
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

  generateReferenceExpression(opts = {}) {
    // creates a expr (string) that, when evaluated, looks up a morph starting
    // from another morph
    // Example:
    // this.generateReferenceExpression()
    //   $world.get("aBrowser").get("sourceEditor");

    let morph = this,
        world = morph.world(),
        {
          maxLength = 10,
          fromMorph = world
        } = opts;

    if (fromMorph === morph) return "this";

    var rootExpr = world === fromMorph ? "$world" : "this";

    // can we find it at all? if not return a generic "morph"
    if (!world && (!morph.name || fromMorph.get(morph.name) !== morph))
      return "morph";

    var vm = lively.vm,
        exprs = makeReferenceExpressionListFor(morph);

    return exprs.length > maxLength
      ? `$world.getMorphWithId("${morph.id}")`
      : exprs.join(".");

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    function makeReferenceExpressionListFor(morph) {
      var name = morph.name,
          owners = morph.ownerChain(),
          owner = morph.owner,
          world = morph.world(),
          exprList;

      if (morph === fromMorph) exprList = [rootExpr];

      if (world === morph) exprList = ["$world"];

      if (!exprList && name && owner) {
        if (owner === world && arr.count(arr.pluck(world.submorphs, "name"), name) === 1) {
          exprList = [`$world.get("${name}")`]

        }

        if (!exprList && owner != world) {
          for (let i = owners.length-1; i--; ) {
            if (owners[i].getAllNamed(name).length === 1){
              exprList = [...makeReferenceExpressionListFor(owners[i]), `get("${name}")`];
              break;
            }
          }

        }

        if (!exprList) {
          var exprsToCheck = [...makeReferenceExpressionListFor(owner), `get("${name}")`];
          if (vm.syncEval(exprsToCheck.join("."), {context: fromMorph}).value === morph) {
            exprList = exprsToCheck;
          }
        }
      }

      // if (!exprList && owner && owner.name) {
      //   var idx = owner.submorphs.indexOf(morph);
      //   exprList = makeReferenceExpressionListFor(morph.owner).concat([`submorphs[${idx}]`]);
      // }

      if (!exprList) {
        exprList = [`${rootExpr}.getMorphById("${morph.id}")`];
      }

      return exprList;
    }

    function commonOwner(m1, m2) {
      var owners1 = m1.ownerChain(),
          owners2 = m2.ownerChain();
      if (owners1.includes(m2)) return m2;
      if (owners2.includes(m1)) return m1;
      return arr.intersect(owners1, owners2)[0];
    }

  }
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // mirror prototype

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
        if (this.grabbable && !evt.state.draggedMorph
            && evt.state.clickedOnMorph === this
            && !evt.hand.carriesMorphs()) evt.hand.grab(this);
      }, 800);
    }
  }

  onMouseUp(evt) {}
  onMouseMove(evt) {}
  onLongClick(evt) {}

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
    let world = this.world();
    return items && items.length && world ? world.openWorldMenu(optEvt, items) : null;
  }

  menuItems() {
    var world = this.world(),
        items = [], self = this;

    // items.push(['Select all submorphs', function(evt) { self.world().setSelectedMorphs(self.submorphs.clone()); }]);

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // morphic hierarchy / windows

    items.push(['Publish...', () => this.interactivelyPublish()]);

    items.push(['Open in...', [
      ['Window', () => { this.openInWindow(); }]
    ]]);

    // Drilling into scene to addMorph or get a halo
    // whew... this is expensive...
    function menuItemsForMorphsBeneathMe(itemCallback) {
      var morphs = world.morphsContainingPoint(self.worldPoint(pt(0,0)));
      morphs.pop(); // remove world
      var selfInList = morphs.indexOf(self);
      // remove self and other morphs over self (the menu)
      morphs = morphs.slice(selfInList + 1);
      return morphs.map(ea => [String(ea), itemCallback.bind(this, ea)]);
    }

    items.push(["Add morph to...", {
      getItems: menuItemsForMorphsBeneathMe.bind(this, morph => morph.addMorph(self))
    }]);

    items.push(["Get halo on...", {
      getItems: menuItemsForMorphsBeneathMe.bind(this, morph => morph.world().showHaloFor(morph))
    }]);

    if (this.owner && this.owner.submorphs.length > 1) {
      items.push(["Arrange morph", [
        ["Bring to front", () => this.owner.addMorph(this)],
        ["Send to back", () => this.owner.addMorphBack(this)]
      ]]);
    }

    if (this.submorphs.length) {
      items.push(["Select all submorphs",
        () => this.world().showHaloFor(this.submorphs.slice())]);
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // stepping scripts
    var steppingItems = [];

    if (this.startSteppingScripts) {
      steppingItems.push(["Start stepping", function(){self.startSteppingScripts()}])
    } else {
      steppingItems.push(["Start stepping", async () => {

        let items = [];
        let {completions} = await lively.vm.completions.getCompletions(() => this, "")

        for (let methodsPerProto of completions) {
          let [protoName, methods] = methodsPerProto;
          for (let method of methods) {
            if (method.startsWith("_") || method.startsWith("$")) continue;
            let [_, selector, args] = method.match(/^([^\(]+)\(?([^\)]+)?\)?$/) || []
            if (!selector || typeof this[selector] !== "function") continue;
            items.push({
              isListItem: true,
              string: `${protoName} ${method}`,
              value: {selector, args}
            })
          }
        }

        let {selected: [choice]} = await $world.filterableListPrompt("Select method to start", items, {
          requester: this,
          historyId: "lively.morphic-start-stepping-chooser",
        });
        if (!choice) return;

        let time = await $world.prompt("Steptime in ms (how of the method will be called)?", {input: 100})
        time = Number(time)
        if (isNaN(time)) return;

        let args = [time, choice.selector];
        if (choice.args) {
          let evalEnvironment = {targetModule: "lively://lively.morphic-stepping-args/eval.js"},
              _args = await $world.editPrompt("Arguments to pass", {
                input: `[${choice.args}]`,
                mode: "js",
                evalEnvironment
              }),
              {value: _argsEvaled, isError} = await lively.vm.runEval(_args, evalEnvironment);
          if (isError) {
            $world.inform(`Error evaluating the arguments: ${_argsEvaled}`);
            return;
          }
          if (Array.isArray(_argsEvaled))
            args.push(..._argsEvaled);
        }

        this.startStepping(...args);
      }]);
    }

    if (this.tickingScripts.length != 0) {
      steppingItems.push(["Stop stepping", () => self.stopStepping()])
    }

    if (steppingItems.length != 0) {
      items.push(["Stepping", steppingItems])
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // morphic properties
    var morphicMenuItems = ['Morphic properties', []];
    items.push(morphicMenuItems);
    // morphicMenuItems[1].push(['display serialization info', function() {
    //   require('lively.persistence.Debugging').toRun(function() {
    //     var json = self.copy(true),
    //         printer = lively.persistence.Debugging.Helper.listObjects(json);
    //     var text = world.addTextWindow({content: printer.toString(),
    //                                     extent: pt(600, 200),
    //                                     title: 'Objects in this world'});
    //     text.setFontFamily('Monaco,monospace');
    //     text.setFontSize(10);
    //   })}]);

    let checked = Icon.textAttribute('check-square-o'),
        unchecked = Icon.textAttribute('square-o');
    unchecked[1].paddingRight = "7px";
    checked[1].paddingRight = "5px";

    ['grabbable', 'draggable', 'acceptsDrops', 'halosEnabled'].forEach(propName =>
      morphicMenuItems[1].push(
        [[...(this[propName] ? checked : unchecked), "  " + propName],
         () => this[propName] = !this[propName]]));


    items.push(["Fit to submorphs", async () => {
      let padding = await this.world().prompt("Padding around submorphs:", {
        input: "Rectangle.inset(5)",
        historyId: "lively.morphic-fit-to-submorphs-padding-hist",
        requester: this
      })
      if (typeof padding !== "string") return;
      let {value} = await lively.vm.runEval(padding, {topLevelVarRecorder: {Rectangle}});

      padding = value && value.isRectangle ? value : Rectangle.inset(0);

      this.undoStart("fitToSubmorphs");
      this.fitToSubmorphs(padding);
      this.undoStop("fitToSubmorphs");
    }]);


    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    let connectionItems = this.connectionMenuItems();
    if (connectionItems) {
      items.push(["connections...", connectionItems]);
    }

    let connectItems = this.connectMenuItems();
    if (connectItems) {
      items.push(["connect...", connectItems]);
    }

    // if (this.hasFixedPosition()) {
    //   morphicMenuItems[1].push(["set unfixed", function() {
    //     self.disableFixedPositioning();
    //   }]);
    // } else {
    //   morphicMenuItems[1].push(["set fixed", function() {
    //     self.enableFixedPositioning()
    //   }]);
    // }

    return items;
  }

  connectionMenuItems() {
    if (!this.attributeConnections || !this.attributeConnections.length) return null;
    return this.attributeConnections.map(c => [String(c), [
      ["show", async () => {
        let { interactivelyShowConnection } = await System.import("lively.morphic/fabrik.js");
        interactivelyShowConnection(c);
      }],
      ["edit", async () => {
        let { interactivelyReEvaluateConnection } = await System.import("lively.morphic/fabrik.js");
        interactivelyReEvaluateConnection(c)
      }],
      ["disconnect", () => { c.disconnect(); $world.setStatusMessage("disconnected " + c)}]
    ]]);
  }

  sourceDataBindings() {
    let allProps = this.propertiesAndPropertySettings().properties,
        groupedProps = arr.groupByKey(
          Object.keys(allProps).map(name => {
            let props = {name, ...allProps[name]};
            // group "_..." is private, don't show
            if (props.group && props.group.startsWith("_")) return null;
            return props;
          }).filter(Boolean), "group"),
        customOrder = ["core", "geometry", "interaction", "styling", "layouting"],
        sortedGroupedProps = [];

    customOrder.forEach(ea => sortedGroupedProps.push(groupedProps[ea]));

    arr.withoutAll(groupedProps.keys(), customOrder).forEach(
      ea => sortedGroupedProps.push(groupedProps[ea]));

    return sortedGroupedProps;
  }

  targetDataBindings() {
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // builds a ["proto name", [metthod, ...]] list
    let methodsByProto = [];
    for (let proto = this;
         proto !== Object.prototype;
         proto = Object.getPrototypeOf(proto)) {
      let protoName = proto === this ? String(this) : proto.constructor.name,
          group = null,
          descrs = Object.getOwnPropertyDescriptors(proto);
      for (let prop in descrs) {
        if (typeof descrs[prop].value !== "function"
         || descrs[prop].value === proto.constructor) continue;
        if (!group) group = [protoName, []];
        group[1].push(prop);
        }
      if (group) methodsByProto.push(group);
    }
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    return this.sourceDataBindings();
  }

  connectMenuItems(actionFn) {
    // returns menu of source attributes that can be used for connection from this object.
    // when actionFn is passed it will be called with (sourceAttrName, morph, propertySpec)
    // sourceAttrName can be "custom..." in this case the user can enter specify manually
    // what the source should be
    let bindings = this.sourceDataBindings(),
        w = this.world(),
        items = bindings.map(
          group => [
            group[0].group || "uncategorized",
            group.map(ea => [
              ea.name, actionFn ? () => actionFn(ea.name, this, ea) : async () => {
                let { interactiveConnectGivenSource } =
                   await System.import("lively.morphic/fabrik.js");
                interactiveConnectGivenSource(this, ea.name);
              }
            ])]);

    w && items.push([
      "custom...", actionFn ?
      () => actionFn("custom...", this, null) :
      async () => {
        let { interactiveConnectGivenSource } =
             await System.import("lively.morphic/fabrik.js"),
            attr = await w.prompt("Enter custom connection point", {
              requester: this,
              historyId: "lively.morphic-custom-connection-points",
              useLastInput: true
            });
        if (attr) interactiveConnectGivenSource(this, attr);
      }]);
    return items;
  }

  onCut(evt) {}
  onCopy(evt) {}
  onPaste(evt) {}

  onDragStart(evt) {
    this.undoStart("drag-move");
    let {dragStartMorphPosition, absDragDelta} = evt.state;
    this.position = dragStartMorphPosition.addPt(absDragDelta);
  }

  onDragEnd(evt) {
    if (!removeSnapToGuidesOf) return;
    this.undoStop("drag-move");
    removeSnapToGuidesOf(this);
  }

  onDrag(evt) {
    if (!showAndSnapToGuides) return;
    let {dragStartMorphPosition, absDragDelta} = evt.state;
    this.position = dragStartMorphPosition.addPt(absDragDelta);
    showAndSnapToGuides(this, evt.isCtrlDown()/*show guides*/, evt.isCtrlDown()/*snap*/);
  }

  onGrab(evt) {
    if (evt.isShiftDown()) {
      let copy = this.copy();
      copy.position = this.transformPointToMorph(evt.hand, pt(0,0));
      evt.hand.grab(copy);
    } else {
      evt.hand.grab(this);
    }
  }

  onDrop(evt) {
    // called when `this` is choosen as a drop target, double dispatches the
    // drop back to the hand but can be overriden to handle drops differently
    evt.hand.dropMorphsOn(this);
  }

  wantsToBeDroppedOn(dropTarget) {
    // called when `this` is grabbed and a drop target for `this` needs to be found
    return true;
  }

  onDropHoverIn(evt) {}
  onDropHoverUpdate(evt) {}
  onDropHoverOut(evt) {}

  onBeingDroppedOn(hand, recipient) {
    // called when `this` was dropped onto morph `recipient`
    recipient.addMorph(this);
  }

  onHoverIn(evt) {}
  onHoverOut(evt) {}

  onScroll(evt) {}
  onMouseWheel(evt) {}

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

  async interactivelyPublish() {
    try {
      let {interactivelySavePart} = await System.import("lively.morphic/partsbin.js"),
          commit = await interactivelySavePart(this, {
            notifications: false, loadingIndicator: true}),
          world = this.world() || this.env.world;
      world.setStatusMessage(
        commit ?
          `Published ${this} as ${commit.name}` :
          `Failed to publish part ${this}`,
          commit ? Color.green : Color.red);
    } catch (e) { e != "canceled" && world.showError(e); }
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

  aboutToRender(renderer) {
    this._dirty = false; this._rendering = true;
  }
  onAfterRender(node) {}

  whenRendered(maxChecks = 50) {
    return this.env.whenRendered(this, maxChecks)
      .then(() => true)
      .catch(() => false);
  }

  render(renderer) {
    return renderer.renderMorph(this);
  }

  applyLayoutIfNeeded() {
     if (!this._dirty) return;
     for (var i in this.submorphs)
       this.submorphs[i].applyLayoutIfNeeded();
     this.layout && !this.layout.manualUpdate && this.layout.forceLayout();
  }

  requestStyling() {
    this.withAllSubmorphsDo(m => {
      m._wantsStyling = true;
      m.makeDirty();
    });
  }

  renderAsRoot(renderer) {
    this.dontRecordChangesWhile(() => {
      let stylingVisitor = this._stylingVisitor;
      if (!stylingVisitor) stylingVisitor = this._stylingVisitor = new StylingVisitor(this);
      stylingVisitor.visit();
      this.applyLayoutIfNeeded();
    })
    return renderRootMorph(this, renderer);
  }

  renderPreview(opts = {}, renderer = this.env.renderer) {
    // Creates a DOM node that is a "preview" of the morph, i.e. a
    // representation that looks like the morph but doesn't morphic behavior
    // attached
    // opts = {width = 100, height = 100, center = true, asNode = false}
    return renderer.renderPreview(this, opts);
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
        isStyleProp: true,
        after: ['extent', 'autoResize'],
        defaultValue: System.decanonicalize("lively.morphic/lively-web-logo-small.svg"),

        set(url) {
          this.isLoaded = false;
          this.setProperty("imageUrl", url);
          this.setProperty("naturalExtent", null);
          let autoResize = this.autoResize && !this._isDeserializing;
          this.whenLoaded().then(() => {
            if (this.imageUrl !== url) return;
            this.isLoaded = true;
            if (autoResize) this.extent = this.naturalExtent;
          });
        }
      },

      naturalExtent: {defaultValue: null},
      isLoaded: {defaultValue: false, serialize: false},
      autoResize: {defaultValue: false}
    }
  }

  __deserialize__(snapshot, objRef) {
    this._isDeserializing = true;
    super.__deserialize__(snapshot, objRef);
  }

  __after_deserialize__(snapshot, ref) {
    delete this._isDeserializing;
    super.__after_deserialize__(snapshot, ref);
  }

  get isImage() { return true }

  get ratio() { let {x, y} = this.naturalExtent; return x / y; }

  setWidthKeepingRatio(w) {
    this.width = w
    this.height = w/this.ratio
  }

  setHeightKeepingRatio(h) {
    this.width = this.ratio*h;
    this.height = h;
  }

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
      this.imageElement(image => {
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
    return new Promise((resolve, reject) => {
      let doc = this.env.domEnv.document,
          image = doc.createElement("img");
      image.onload = () => {
        resolve(image);
        if (typeof onloadFn === "function")
          onloadFn(image);
      }
      image.src = this.imageUrl;
    });
  }

  async canvasElementAndContext() {
    let doc = this.env.domEnv.document,
        image = await this.imageElement(),
        canvas = doc.createElement('canvas'),
        ctx = canvas.getContext('2d');
    canvas.width = image.width;
    canvas.height = image.height;
    ctx.drawImage(image, 0, 0, image.width, image.height);
    return {canvas, ctx, image};
  }


  async imageData(bounds) {
    let {ctx, image} = await this.canvasElementAndContext();
    if (!bounds) bounds = rect(0, 0, image.width, image.height);
    let {x, y, width, height} = bounds;
    console.log(x, y);
    return ctx.getImageData(x, y, width, height);
  }

  async pixelAt(pos) { return (await this.imageData(pos.extent(pt(1,1)))).data; }

  async colorAt(pos) { return Color.fromTuple8Bit(await this.pixelAt(pos)); }

  loadArrayBuffer(arrayBuffer, type = "image/jpeg") {
    let arrayBufferView = new Uint8Array(arrayBuffer),
        blob = new Blob( [ arrayBufferView ], { type: "image/jpeg" } ),
        urlCreator = window.URL || window.webkitURL,
        imageUrl = urlCreator.createObjectURL(blob);
    this.imageUrl = imageUrl;
    this.makeDirty();
  }

  async convertToBase64() {
    // this.imageUrl = "http://blog.openclassrooms.com/en/wp-content/uploads/sites/4/2015/11/hello-world-v02.jpg"
    // await this.convertToBase64();
    var urlString = this.imageUrl,
        type = urlString.slice(urlString.lastIndexOf('.') + 1, urlString.length).toLowerCase();
    if (type == 'jpg') type = 'jpeg';
    if (!['gif', 'jpeg', 'png', 'tiff'].includes(type)) type = 'gif';
    if (!urlString.startsWith('http'))
      urlString = location.origin + "/" + urlString;
    let {runCommand} = await System.import("lively.ide/shell/shell-interface"),
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
    await this.loadUrl("http://blog.openclassrooms.com/en/wp-content/uploads/sites/4/2015/11/hello-world-v02.jpg", false)
    let from = this.naturalExtent;
    await this.convertToBase64();
    this.extent = pt(300,300)
    await this.resampleImageToFitBounds();
    let to = this.naturalExtent;
    `${from} => ${to}`;
    */

    let {ctx, canvas, image} = await this.canvasElementAndContext(),
        {width: newWidth, height: newHeight} = this,
        {width: imageWidth, height: imageHeight} = image;

    canvas.width = imageWidth; canvas.height = imageHeight;
    ctx.drawImage(image, 0, 0, newWidth, newHeight);
    let data = ctx.getImageData(0, 0, imageWidth, imageHeight);
    canvas.width = newWidth;
    canvas.height = newHeight;
    ctx.putImageData(data, 0,0)
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


  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  async interactivelyChangeImageURL() {
    let url = await this.world().prompt("Enter image url", {
      historyId: "lively.morphic-image-url-inputs",
      input: this.imageUrl.startsWith("data:") ? "" : this.imageUrl,
      requester: this,
    });
    if (typeof url === "string")
      this.imageUrl = url;
  }

  menuItems() {
    let items = super.menuItems();
    items.unshift(
      ["change image url...", () => this.interactivelyChangeImageURL()],
      ["resize image to its real image size", () => this.extent = this.naturalExtent],
      ["resample image to fit current bounds", () => this.resampleImageToFitBounds()],
      {isDivider: true})
    return items;
  }
}

class PathPoint {

  constructor(path, props = {}) {
    this.path = path;
    this._isSmooth = props.isSmooth || false;
    this.x = props.position ? props.position.x : (props.x || 0);
    this.y = props.position ? props.position.y : (props.y || 0);
    this._controlPoints = props.controlPoints;
    connect(this, 'position', path, 'makeDirty');
    connect(this, 'controlPoints', path, 'makeDirty');
  }

  get isPathPoint() { return true; }

  get isSmooth() { return this._isSmooth || false; }
  set isSmooth(smooth) {
    let changed = this._isSmooth !== smooth;
    if (changed) {
      this._isSmooth = smooth;
      this.adaptControlPoints(smooth);
    }
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
    let {nextVertex, previousVertex, position, path} = this,
        {vertices} = path,
        i = vertices.indexOf(this),
        isFirst = i === 0,
        isLast = i === vertices.length-1,
        previousPos = previousVertex ? previousVertex.position : position,
        nextPos = nextVertex ? nextVertex.position : position;
    if (smooth) {
      const p = this.pointOnLine(
        previousPos, nextPos, position, path.borderWidth);
      this.controlPoints = {
        previous: isFirst ? pt(0,0) : p.subPt(nextPos),
        next: p.subPt(previousPos)
      };
    } else {
      this.controlPoints = {
        previous: isFirst ? pt(0,0) : previousPos.subPt(position).scaleBy(0.5),
        next: isLast ? pt(0,0) : nextPos.subPt(position).scaleBy(0.5)
      };
    }
    path.onVertexChanged(this);
  }
}

export class Path extends Morph {

  static get properties() {

    return {

      borderColor: {
        isStyleProp: true,
        type: "ColorGradient",
        foldable: ["top", "left", "right", "bottom"],
        set(value) {
          if (!value) value = Color.white;
          if (value.isColor || value.isGradient) {
            value = {top: value, left: value, right: value, bottom: value};
          }
          this.setProperty(
            "borderColor",
            obj.extract(value, ["top", "left", "right", "bottom"], (k, v) => {
              return obj.isArray(v) ? Color.fromTuple(v) : v
            })
          );
        }
      },

      showControlPoints: {
        defaultValue: false
      },

      vertices: {
        defaultValue: [],
        after: ["isSmooth", 'borderWidth'],
        type: "Vertices",
        set(vs) {
          let {isSmooth} = this;
          this._adjustingVertices = true;
          vs = vs.map(v => v.isPathPoint ?
            Object.assign(v, {path: this}) :
            new PathPoint(this, {isSmooth, ...v}));
          this.setProperty("vertices", vs);
          this._adjustingVertices = false;
          this.updateBounds(vs);
        }
      },

      startMarker: {defaultValue: null, type: "Object"},
      endMarker: {defaultValue: null, type: "Object"},

      isSmooth: {
        defaultValue: false,
        type: "Boolean",
        set(val) {
          this.setProperty("isSmooth", val);
          if (this.vertices) {
            this._adjustingVertices = true;
            this.vertices.forEach(ea => ea.isSmooth = val);
            this._adjustingVertices = false;
            this.updateBounds(this.vertices);
          }
        }
      }
    };
  }

  constructor(props = {}) {
    super({...obj.dissoc(props, "origin")});
    this.adjustOrigin(props.origin || this.origin);
    this.position = props.position || this.position;
    this.updateBounds(this.vertices);
  }

  __after_deserialize__(snapshot, objRef) {
    super.__after_deserialize__(snapshot, objRef)
    this.updateBounds(this.vertices);
  }

  get isPath() { return true; }
  get isSvgMorph() { return true }

  onVertexChanged(vertex) {
    this.makeDirty();
    this.updateBounds(this.vertices);
  }

  updateBounds(vertices = this.vertices) {
    // vertices = this.vertices
    if (!vertices.length) return;
    if (this._adjustingVertices) return;
    this._adjustingVertices = true;
    const {origin, extent: {x: w, y: h}} = this,
          relOriginX = origin.x/w,
          relOriginY = origin.y/h,
          points = [];
    for (let vertex of vertices) {
      let {isSmooth, position, controlPoints} = vertex,
          {next, previous} = controlPoints || {};
      points.push(position);
      if (isSmooth)
        points.push(position.addPt(next), position.addPt(previous));
    }
    let b = Rectangle.unionPts(points),
        newOrigin = pt(b.width*relOriginX, b.height*relOriginY),
        offset = b.topLeft();
    vertices.forEach(ea => ea.moveBy(offset.negated()));
    this.moveBy(this.getTransform().transformDirection(offset));
    this.extent = b.extent();
    this.origin = newOrigin;
    this._adjustingVertices = false;
  }

  onChange(change) {
    let {prop, value, prevValue} = change,
        { _adjustingVertices, _adjustingOrigin} = this;
    if (prop == "extent" && value && prevValue && !_adjustingVertices)
      this.adjustVertices(value.scaleByPt(prevValue.inverted()));
    if (!_adjustingOrigin && prop === "vertices" || prop === "borderWidthLeft")
      this.updateBounds(prop == "vertices" ? value : this.vertices);
    if (!_adjustingVertices && prop === "origin")
      this.updateBounds(this.vertices);
    super.onChange(change);
  }

  vertexBefore(v) {
    const i = this.vertices.indexOf(v) - 1;
    return this.vertices[i >= 0 ? i : this.vertices.length - 1];
  }

  vertexAfter(v) {
    const i = this.vertices.indexOf(v) + 1;
    return this.vertices[i > this.vertices.length - 1 ? 0 : i];
  }

  adjustVertices(delta) {
    let {vertices} = this;
    if (!vertices) return; /*init*/
    vertices.forEach(v => {
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
    this._adjustingOrigin = true;
    let {vertices, origin} = this;
    vertices.forEach(v =>
      v.position = origin.subPt(newOrigin).addXY(v.x, v.y));
    super.adjustOrigin(newOrigin);
    this._adjustingOrigin = false;
  }

  addVertex(v, before = null) {
    let {vertices} = this,
        insertIndex = typeof before === "number" ? before :
          before && before.isPathPoint ? vertices.indexOf(before) :
           undefined;
    if (typeof insertIndex === "number" && insertIndex > -1)
      vertices.splice(insertIndex, 0, v);
    else vertices.push(v);
    this.vertices = vertices;
  }

  addVertexCloseTo(point) {
    // add a new vertext near point
    let {
          closest: {
            length: closestLength, vertex: closestV
          }, next
        } = this.verticesCloseTo(point),
        {length, point: insertionPoint} = this.findClosestPointOnPath(point, 10, 3),
        insertBefore = length <= closestLength ? closestV : next ? next.vertex : null;
    return this.addVertex(insertionPoint, insertBefore);
  }

  render(renderer) {
    return renderer.renderPath(this);
  }

  get _pathNode() {
    let node = this.env.renderer.getNodeForMorph(this);
    return node && node.querySelector("#svg" + this.id);
  }

  verticesCloseTo(point, withLength = true) {
    let {vertices} = this,
        distsToVertices = [],
        minDist = Infinity, minDistIndex = -1;

    for (let i = 0; i < vertices.length; i++) {
      let dist = vertices[i].position.dist(point);
      distsToVertices.push(dist);
      if (dist >= minDist) continue;
      minDist = dist; minDistIndex = i;
    }

    let previous = minDistIndex === 0 ? null :
          {index: minDistIndex-1, vertex: vertices[minDistIndex-1]},
        next = minDistIndex === vertices.length-1 ? null :
          {index: minDistIndex+1, vertex: vertices[minDistIndex+1]},
        closest = {index: minDistIndex, vertex: vertices[minDistIndex]}

    if (withLength) {
      let {_pathNode} = this;
      if (previous) {
        let {length} = this.findClosestPointOnPath(
          previous.vertex.position, 6, 3, _pathNode);
        previous.length = length;
      }
      if (next) {
        let {length} = this.findClosestPointOnPath(
          next.vertex.position, 6, 3, _pathNode);
        next.length = length;
      }
      {
        let {length} = this.findClosestPointOnPath(
          closest.vertex.position, 6, 3, _pathNode);
        closest.length = length;
      }
    }

    return {previous, next, closest};
  }

  findClosestPointOnPath(fromPoint, nSamples, iterations, pathNode) {
    // fromPoint is a Point in local coordinates of this
    // returns {length, point}
    // length - absolute length of closes point on path
    // point the closest point in local coords

    if (!pathNode) {
      let node = this.env.renderer.getNodeForMorph(this);
      pathNode = node && node.querySelector("#svg" + this.id);
    }

    return pathNode ?
      findClosestPointOnPath(pathNode, fromPoint, nSamples, iterations) :
      {length: 0, point: fromPoint};

    function findClosestPointOnPath(
      pathNode, pos, nSamples = 10, iterations = 3,
      fromLength = 0, toLength = pathNode.getTotalLength(), iteration = 0
    ) {
      let samples = samplePathPoints(pathNode, toLength, fromLength, nSamples),
          minDist = Infinity, minIndex = -1;
      for (let [point, atLength, i] of samples) {
        let dist = pos.dist(point);
        if (dist >= minDist) continue;
        minDist = dist; minIndex = i;
      }

      if (iteration >= iterations) {
        let [point, length] = samples[minIndex];
        return {point, length};
      }

      fromLength = samples[Math.max(0, minIndex-1)][1];
      toLength = samples[Math.min(samples.length-1, minIndex+1)][1];

      return findClosestPointOnPath(
        pathNode, pos, nSamples, iterations,
        fromLength, toLength, iteration+1);

      function samplePathPoints(pathNode, from, to, sampleSize) {
        // 0 <= from, to <= pathNode.getTotalLength()
        // returns list of points with length sampleSize
        // including from, to
        let points = [],
            step = (to-from) / (sampleSize-1), i = 0;
        points.push([Point.ensure(pathNode.getPointAtLength(from)), from, i]);
        for (i = 1; i < sampleSize-1; i++) {
          let length = from + (i*step);
          points.push([Point.ensure(pathNode.getPointAtLength(length)), length, i]);
        }
        points.push([Point.ensure(pathNode.getPointAtLength(to)), to, i]);
        return points;
      }
    }
  }

  onDragStart(evt) {
    let {domEvt: {target}} = evt,
        cssClass = PropertyPath("attributes.class.value").get(target);
    if (cssClass && cssClass.includes("path-point")) {
      let [_, n, ctrlN] = cssClass.match(/path-point-([0-9]+)(?:-control-([0-9]+))?$/);
      this._controlPointDrag = {marker: target, n: Number(n)};
      if (ctrlN !== undefined) this._controlPointDrag.ctrlN = Number(ctrlN);
    } else return super.onDragStart(evt);
  }

  onDrag(evt) {
    if (!this._controlPointDrag) return super.onDrag(evt);
    let {target, n, ctrlN} = this._controlPointDrag,
        {vertices} = this,
        v = vertices[n];
    if (v) {
      let delta = this.getInverseTransform().transformDirection(evt.state.dragDelta);
      if (ctrlN === undefined) {
        v.moveBy(delta);
        let vp = vertices[n-1], vn = vertices[n+1];

        // merge?
        if (vp && vp.position.dist(v.position) < 10) {
          this._controlPointDrag.maybeMerge = [n-1, n];
        } else if (vn && vn.position.dist(v.position) < 10) {
          this._controlPointDrag.maybeMerge = [n, n+1];
        } else {
          this._controlPointDrag.maybeMerge = undefined;
        }
      }
      else if (ctrlN === 1) v.movePreviousControlPoint(delta);
      else if (ctrlN === 2) v.moveNextControlPoint(delta);
    }
  }

  onDragEnd(evt) {
    let {vertices, _controlPointDrag} = this;
    if (_controlPointDrag) {
      let {maybeMerge} = _controlPointDrag;
      delete this._controlPointDrag;
      if (maybeMerge) {
        let [i, j] = maybeMerge,
            v1 = vertices[i], v2 = vertices[j];
        v1.controlPoints.next = v2.controlPoints.next;
        vertices.splice(j, 1)
        this.vertices = vertices;
      }
    }
  }

  onMouseDown(evt) {
    var {state: {clickCount}} = evt,
        double = clickCount === 2;

    if (double) {
      this.addVertexCloseTo(this.localize(evt.position));
    }
  }

  menuItems() {
    let checked = Icon.textAttribute('check-square-o'),
        unchecked = Icon.textAttribute('square-o');
    unchecked[1].paddingRight = "7px";
    checked[1].paddingRight = "5px";
    return [
      [[...(this.showControlPoints ? checked : unchecked), " control points"],
       () => this.showControlPoints = !this.showControlPoints],
      [[...(this.isSmooth ? checked : unchecked), " smooth"],
       () => this.isSmooth = !this.isSmooth],
      {isDivider: true},
      ...super.menuItems()
    ]
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

export class LineMorph extends Morph {

  static get properties() {
    return {
      borderWidth: {defaultValue: 0},
      fill: {defaultValue: Color.black},
      height: {defaultValue: 1},
      line: {
        defaultValue: Line.fromCoords(0, 0, 0, 0),
        set(val) {
          this.setProperty("line", val);
          this.update();
        }
      },
      start: {
        derived: true, after: ["line"],
        get(val) { return this.line.start; },
        set(val) { this.line = this.line.withStart(val); }
      },
      end: {
        derived: true, after: ["line"],
        get(val) { return this.line.end; },
        set(val) { this.line = this.line.withEnd(val); }
      },
      position: {
        derived: true, after: ["line"],
        get(val) { return this.start; },
        set(val) {
          let delta = val.subPt(this.start);
          this.line = new Line(val, this.end.addPt(delta));
        }
      }
    }
  }

  get isPolygon() { return true; }

  update() {
    if (this._isUpdating) return;
    this._isUpdating = true;
    let {line, height} = this,
        vec = line.toVector();
    // offset of "width"
    this.setProperty("position", this.position.addPt(line.perpendicularLine(0, height, "cc").toVector()))
    this.width = vec.fastR();
    this.rotation = vec.theta();
    this._isUpdating = false;
  }
}
