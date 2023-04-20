/* global System,Uint8Array,Blob */
import { Color, Line, Point, pt, rect, Rectangle, Transform } from 'lively.graphics';
import { string, obj, arr, num, promise, tree, Path as PropertyPath } from 'lively.lang';
import { signal } from 'lively.bindings';
import { deserializeSpec, ExpressionSerializer, serializeSpec, getClassName } from 'lively.serializer2';
import {
  ShadowObject
} from './rendering/morphic-default.js';
import { AnimationQueue, easings } from './rendering/animations.js';
import { Icon } from './text/icons.js';
import { morph, newMorphId } from './helpers.js';
import { MorphicEnv } from './env.js';
import config from './config.js';
import CommandHandler from './CommandHandler.js';
import KeyHandler, { findKeysForPlatform } from './events/KeyHandler.js';
import { TargetScript } from './ticking.js';
import { copyMorph } from './serialization.js';

import { PolicyApplicator } from './components/policy.js';

const defaultCommandHandler = new CommandHandler();

function generateUnfolded (propName, members = ['top', 'left', 'right', 'bottom'], group = 'core') {
  // generate the accessors for members of a folded property
  const propertyDeclarations = {};
  for (const m of members) {
    propertyDeclarations[propName + string.capitalize(m)] = {
      group,
      derived: true,
      generated: true,
      after: [propName],
      get () { return this.getProperty(propName)[m]; },
      set (v) { this[propName] = { ...this.getProperty(propName), [m]: v }; }
    };
  }
  return propertyDeclarations;
}

export class Morph {
  static get propertySettings () {
    return {
      defaultGetter (key) { return this.getProperty(key); },
      defaultSetter (key, value) {
        this.setProperty(key, value);
      },
      valueStoreProperty: '_morphicState'
    };
  }

  static get properties () {
    return {

      renderingState: {
        group: '_rendering',
        defaultValue: {},
        serialize: false,
        initialize () {
          this.renderingState = this.defaultRenderingState;
        }
      },

      defaultRenderingState: {
        derived: true,
        readOnly: true,
        group: '_rendering',
        get () {
          return {
            renderedMorphs: [],
            hasStructuralChanges: false,
            needsRerender: true,
            animationAdded: false,
            hasCSSLayoutChange: false,
            cssLayoutToMeasureWith: false
          };
        }
      },

      name: {
        group: 'core',
        initialize (name) {
          if (!name) {
            const className = getClassName(this);
            name = string.findArticle(className) + className;
          }
          this.name = name;
        }
      },

      isComponent: {
        group: 'core',
        defaultValue: false,
        after: ['master'],
        set (active) {
          this.setProperty('isComponent', active);
          if (active) {
            if (!this.master) delete this._parametrizedProps;
          }
        }
      },

      master: {
        before: ['metadata'],
        after: ['clipMode'],
        group: 'core',
        set (args) {
          // if (this.master instanceof PolicyApplicator && this.master.equals(args)) return;
          // FIXME: when we set the master of a morph we need to modify that policy applicator in place
          // since else the enclosing applicator is not being notified, the master is now overridden
          const policy = args ? PolicyApplicator.for(this, args) : (args === false ? false : null);
          if (this.master?.isPolicyApplicator && this.master?.parent[Symbol.for('lively-module-meta')]?.path.length) {
            // how about we only do this with inline policies?
            this.master.spec.master = policy;
            this._skipMasterReplacement = true;
          } else {
            this.setProperty('master', policy);
            if (policy?.isPolicyApplicator) policy.attach(this); // FIXME: remove that
          }
          if (this.master) this.requestMasterStyling();
        }
      },

      viewModel: {
        after: ['submorphs'],
        set (vm) {
          if (this.viewModel && this.viewModel !== vm) this.viewModel.onDeactivate();
          this.setProperty('viewModel', vm);
        }
      },

      renderOnGPU: {
        group: 'core',
        defaultValue: false
      },

      draggable: {
        group: 'interaction',
        isStyleProp: true,
        defaultValue: false
      },

      grabbable: {
        group: 'interaction',
        isStyleProp: true,
        defaultValue: false,
        set (bool) {
          // Since grabbing is implemented via dragging we also need to make
          // this morph draggable
          if (bool && !this.draggable) this.draggable = true;
          this.setProperty('grabbable', bool);
        }
      },

      acceptsDrops: {
        group: 'interaction',
        isStyleProp: true,
        defaultValue: true
      },

      grayscale: {
        group: 'styling',
        type: 'Number',
        isStyleProp: true,
        defaultValue: 0,
        min: 0,
        max: 1,
        isFloat: true
      },

      blur: {
        group: 'styling',
        type: 'Number',
        isStyleProp: true,
        defaultValue: 0,
        min: 0,
        isFloat: true
      },

      dropShadow: {
        group: 'styling',
        type: 'Shadow',
        isStyleProp: true,
        defaultValue: null,
        set (value) {
          if (value && !value.isShadowObject) {
            value = new ShadowObject(value);
            value.morph = this;
          }
          this.setProperty('dropShadow', value);
        }
      },

      tooltip: {
        group: 'core',
        defaultValue: null
      },

      focusable: {
        group: 'interaction',
        defaultValue: true
      },

      nativeCursor: {
        group: 'interaction',
        type: 'Enum',
        values: [
          'auto',
          'default',
          'none',
          'context-menu',
          'help',
          'pointer',
          'progress',
          'wait',
          'cell',
          'crosshair',
          'text',
          'vertical-text',
          'alias',
          'copy',
          'move',
          'no-drop',
          'not-allowed',
          'e-resize',
          'n-resize',
          'ne-resize',
          'nw-resize',
          's-resize',
          'se-resize',
          'sw-resize',
          'w-resize',
          'ew-resize',
          'ns-resize',
          'nesw-resize',
          'nwse-resize',
          'col-resize',
          'row-resize',
          'all-scroll',
          'zoom-in',
          'zoom-out',
          'grab',
          'grabbing'
        ],
        isStyleProp: true,
        defaultValue: 'auto'
      },

      halosEnabled: {
        group: 'interaction',
        isStyleProp: true,
        defaultValue: !!config.halosEnabled
      },

      reactsToPointer: {
        group: 'interaction',
        isStyleProp: true,
        defaultValue: true
      },

      origin: {
        group: 'geometry',
        type: 'Point',
        isStyleProp: true,
        defaultValue: pt(0, 0)
      },

      position: {
        group: 'geometry',
        type: 'Point',
        isStyleProp: true,
        defaultValue: pt(0, 0),
        get () {
          let layout;
          if (layout = this.renderingState.cssLayoutToMeasureWith) {
            layout.updateBoundsFor(this);
          }
          return this.getProperty('position');
        }
      },

      positionOnCanvas: {
        group: 'geometry',
        type: 'Point',
        isStyleProp: true,
        get () {
          let parentFound = false;
          if (this._positionOnCanvas) return this._positionOnCanvas;
          else {
            this.ownerChain().forEach(parent => {
              if (parentFound) return;
              if (parent._positionOnCanvas) {
                const posOnCanvasOfParent = parent._positionOnCanvas;
                const globalPositionOfParent = parent.globalPosition;
                const ownGlobalPosition = this.globalPosition;
                const diff = pt(globalPositionOfParent.x - ownGlobalPosition.x, globalPositionOfParent.y - ownGlobalPosition.y).scaleBy(1 / $world.scaleFactor);
                parentFound = pt(posOnCanvasOfParent.x - (diff.x), posOnCanvasOfParent.y - (diff.y));
              }
            });
          }
          return parentFound;
        }
      },

      extent: {
        group: 'geometry',
        type: 'Point',
        isStyleProp: true,
        defaultValue: pt(10, 10),
        get () {
          let layout;
          if (layout = this.renderingState.cssLayoutToMeasureWith) {
            layout.updateBoundsFor(this);
          }
          return this.getProperty('extent');
        },
        set (ext) {
          const priorExtent = this.extent;
          this.setProperty('extent', ext);
          if (!this.origin.equals(pt(0, 0))) { // Adjust origin, especially for ellipses
            const scalePt = pt(ext.x / priorExtent.x, ext.y / priorExtent.y);
            this.adjustOrigin(this.origin.scaleByPt(scalePt));
          }
        }
      },

      width: {
        group: 'geometry',
        derived: true,
        after: ['extent'],
        before: ['submorphs'],
        get () { return this.extent.x; },
        set (v) { return this.extent = pt(v, this.extent.y); }
      },

      height: {
        group: 'geometry',
        derived: true,
        after: ['extent'],
        before: ['submorphs'],
        get () { return this.extent.y; },
        set (v) { return this.extent = pt(this.extent.x, v); }
      },

      left: {
        group: 'geometry',
        derived: true,
        after: ['extent', 'submorphs', 'layout'],
        get () { return this.bounds().left(); },
        set (v) { return this.moveBy(pt(v - this.left), 0); }
      },

      right: {
        group: 'geometry',
        derived: true,
        after: ['extent', 'submorphs', 'layout'],
        get () { return this.bounds().right(); },
        set (v) { return this.moveBy(pt(v - this.right), 0); }
      },
      top: {
        group: 'geometry',
        derived: true,
        after: ['extent', 'submorphs', 'layout'],
        get () { return this.bounds().top(); },
        set (v) { return this.moveBy(pt(0, v - this.top)); }
      },
      bottom: {
        group: 'geometry',
        derived: true,
        after: ['extent', 'submorphs', 'layout'],
        get () { return this.bounds().bottom(); },
        set (v) { return this.moveBy(pt(0, v - this.bottom)); }
      },
      center: {
        group: 'geometry',
        derived: true,
        after: ['extent', 'submorphs', 'layout'],
        get () { return this.bounds().center(); },
        set (v) { return this.align(this.center, v); }
      },
      topLeft: {
        group: 'geometry',
        derived: true,
        after: ['extent', 'submorphs', 'layout'],
        get () { return this.bounds().topLeft(); },
        set (v) { return this.align(this.topLeft, v); }
      },
      topRight: {
        group: 'geometry',
        derived: true,
        after: ['extent', 'submorphs', 'layout'],
        get () { return this.bounds().topRight(); },
        set (v) { return this.align(this.topRight, v); }
      },
      bottomRight: {
        group: 'geometry',
        derived: true,
        after: ['extent', 'layout'],
        get () { return this.bounds().bottomRight(); },
        set (v) { return this.align(this.bottomRight, v); }
      },
      bottomLeft: {
        group: 'geometry',
        derived: true,
        after: ['extent', 'submorphs', 'layout'],
        get () { return this.bounds().bottomLeft(); },
        set (v) { return this.align(this.bottomLeft, v); }
      },
      bottomCenter: {
        group: 'geometry',
        derived: true,
        after: ['extent', 'submorphs', 'layout'],
        get () { return this.bounds().bottomCenter(); },
        set (v) { return this.align(this.bottomCenter, v); }
      },
      topCenter: {
        group: 'geometry',
        derived: true,
        after: ['extent', 'submorphs', 'layout'],
        get () { return this.bounds().topCenter(); },
        set (v) { return this.align(this.topCenter, v); }
      },
      leftCenter: {
        group: 'geometry',
        derived: true,
        after: ['extent', 'submorphs'],
        get () { return this.bounds().leftCenter(); },
        set (v) { return this.align(this.leftCenter, v); }
      },
      rightCenter: {
        group: 'geometry',
        derived: true,
        after: ['extent', 'submorphs'],
        get () { return this.bounds().rightCenter(); },
        set (v) { return this.align(this.rightCenter, v); }
      },

      rotation: {
        group: 'geometry',
        type: 'Number',
        isFloat: true,
        isStyleProp: true,
        defaultValue: 0
      },

      flipped: {
        group: 'geometry',
        type: 'Number',
        isFloat: true,
        isStyleProp: true,
        defaultValue: 0,
        min: 0,
        max: 1
      },

      tilted: {
        group: 'geometry',
        type: 'Number',
        isFloat: true,
        isStyleProp: true,
        defaultValue: 0,
        min: 0,
        max: 1
      },

      perspective: {
        group: 'geometry',
        type: 'Number',
        isStyleProp: true,
        defaultValue: 0,
        min: 0
      },

      scale: {
        group: 'geometry',
        type: 'Number',
        min: 0,
        isFloat: true,
        isStyleProp: true,
        defaultValue: 1
      },

      hasFixedPosition: {
        group: 'geometry',
        doc: 'When morph is submorph of world hasFixedPosition == true will keep the morph at the same position relative to top left of the browser window. This means, when the world is scrolled, the morph keeps its place.',
        defaultValue: false
      },

      opacity: {
        group: 'styling',
        type: 'Number',
        isFloat: true,
        min: 0,
        max: 1,
        isStyleProp: true,
        defaultValue: 1
      },

      fill: {
        group: 'styling',
        type: 'ColorGradient',
        isStyleProp: true,
        defaultValue: Color.white
      },

      visible: {
        group: 'styling',
        isStyleProp: true,
        defaultValue: true,
        set (bool) {
          if (!bool) this.makeDirty(); /* updates stopped afterwards */
          this.setProperty('visible', bool);
        }
      },

      submorphs: {
        group: 'core',
        defaultValue: [],
        after: ['isLayoutable', 'origin', 'position', 'rotation', 'scale'],
        get () { return (this.getProperty('submorphs') || []).concat(); },
        set (newSubmorphs) {
          const { layout } = this;
          const activateLayout = layout && layout.isEnabled();
          if (activateLayout) layout.disable();
          this.submorphs.forEach(m => newSubmorphs.includes(m) || m.remove());
          newSubmorphs.forEach(
            (m, i) => this.submorphs[i] !== m &&
              this.addMorph(m, this.submorphs[i]));
          if (activateLayout) layout.enable();
        }
      },

      clipMode: {
        group: 'styling',
        type: 'Enum',
        values: ['visible', 'hidden', 'scroll', 'auto'],
        isStyleProp: true,
        defaultValue: 'visible',
        set (value) {
          this.setProperty('clipMode', value);
          if (!this.isClip()) this.scroll = pt(0, 0);
        }
      },

      hideScrollbars: {
        group: 'styling',
        type: 'Boolean',
        isStyleProp: true,
        defaultValue: false
      },

      scroll: {
        group: 'geometry',
        defaultValue: pt(0, 0),
        after: ['clipMode', 'submorphs'],
        type: 'Point',
        set ({ x, y }) {
          if (!this.isClip()) return;
          const { x: maxScrollX, y: maxScrollY } = this.scrollExtent.subPt(this.extent);
          x = Math.max(0, Math.min(maxScrollX, x));
          y = Math.max(0, Math.min(maxScrollY, y));
          this.setProperty('scroll', pt(x, y));
          this.renderingState.scrollChanged = true;
          this.makeDirty();
        }
      },

      scrollbarOffset: {
        group: 'styling',
        defaultValue: pt(15, 15)
      },

      styleClasses: {
        group: 'styling',
        isStyleProp: true,
        defaultValue: ['morph'],
        get () {
          return this._cachedStyleClasses || (this._cachedStyleClasses = this.constructor.styleClasses.concat(this.getProperty('styleClasses')));
        },
        set (value) {
          this._cachedStyleClasses = null;
          this.setProperty('styleClasses', arr.withoutAll(value, this.constructor.styleClasses));
        }
      },

      layout: {
        group: 'layouting',
        isStyleProp: true,
        type: 'Layout',
        after: ['submorphs', 'extent', 'origin', 'position', 'isLayoutable'],
        set (value) {
          delete this.renderingState.inlineGridImportant;
          delete this.renderingState.inlineFlexImportant;
          this.renderingState.hasCSSLayoutChange = true;
          if (value) {
            value.container = this;
          }
          this.setProperty('layout', value);
        }
      },

      isLayoutable: {
        group: 'layouting',
        isStyleProp: true,
        defaultValue: true
      },

      borderLeft: {
        group: 'styling',
        isStyleProp: true,
        derived: true,
        after: ['borderStyleLeft', 'borderWidthLeft', 'borderColorLeft'],
        get () {
          return {
            style: this.borderStyleLeft,
            width: this.borderWidthLeft,
            color: this.borderColorLeft
          };
        },
        set (x) {
          if ('style' in x) this.borderStyleLeft = x.style;
          if ('width' in x) this.borderWidthLeft = x.width;
          if ('color' in x) this.borderColorLeft = x.color;
        }
      },

      borderRight: {
        group: 'styling',
        isStyleProp: true,
        derived: true,
        after: ['borderStyleRight', 'borderWidthRight', 'borderColorRight'],
        get () {
          return {
            style: this.borderStyleRight,
            width: this.borderWidthRight,
            color: this.borderColorRight
          };
        },
        set (x) {
          if ('style' in x) this.borderStyleRight = x.style;
          if ('width' in x) this.borderWidthRight = x.width;
          if ('color' in x) this.borderColorRight = x.color;
        }
      },

      borderBottom: {
        group: 'styling',
        isStyleProp: true,
        derived: true,
        after: ['borderStyleBottom', 'borderWidthBottom', 'borderColorBottom'],
        get () {
          return {
            style: this.borderStyleBottom,
            width: this.borderWidthBottom,
            color: this.borderColorBottom
          };
        },
        set (x) {
          if ('style' in x) this.borderStyleBottom = x.style;
          if ('width' in x) this.borderWidthBottom = x.width;
          if ('color' in x) this.borderColorBottom = x.color;
        }
      },

      borderTop: {
        group: 'styling',
        isStyleProp: true,
        derived: true,
        after: ['borderStyleTop', 'borderWidthTop', 'borderColorTop'],
        get () {
          return {
            style: this.borderStyleTop,
            width: this.borderWidthTop,
            color: this.borderColorTop
          };
        },
        set (x) {
          if ('style' in x) this.borderStyleTop = x.style;
          if ('width' in x) this.borderWidthTop = x.width;
          if ('color' in x) this.borderColorTop = x.color;
        }
      },

      borderWidth: {
        group: 'styling',
        isStyleProp: true,
        type: 'Number',
        foldable: ['top', 'left', 'right', 'bottom'],
        min: 0,
        defaultValue: { top: 0, bottom: 0, left: 0, right: 0, valueOf: () => 0 },
        get () {
          const v = this.getProperty('borderWidth');
          return { ...v, valueOf: () => v.left };
        },
        set (value) {
          if (obj.isNumber(value)) {
            const left = value; const right = value; const top = value; const bottom = value;
            value = { left, right, top, bottom };
          }
          this.setProperty('borderWidth', value);
        }
      },

      ...generateUnfolded('borderWidth', undefined, 'styling'),

      borderRadius: {
        group: 'styling',
        isStyleProp: true,
        type: 'Number',
        min: 0,
        foldable: ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'],
        defaultValue: { topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0, valueOf: () => 0 },
        get () {
          const v = this.getProperty('borderRadius');
          return { ...v, valueOf: () => v.topLeft };
        },
        set (value) {
          if (!value) value = 0;
          if (obj.isNumber(value)) {
            const topLeft = value; const topRight = value; const bottomRight = value; const bottomLeft = value;
            value = { topLeft, topRight, bottomRight, bottomLeft };
          }
          this.setProperty('borderRadius', value);
        }
      },

      ...generateUnfolded('borderRadius', ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'], 'styling'),

      borderStyle: {
        group: 'styling',
        isStyleProp: true,
        type: 'Enum',
        foldable: ['top', 'left', 'right', 'bottom'],
        values: ['none', 'hidden', 'dotted', 'dashed',
          'solid', 'double', 'groove', 'ridge', 'inset', 'outset'],
        defaultValue: {
          top: 'solid',
          left: 'solid',
          bottom: 'solid',
          right: 'solid',
          valueOf: () => 'solid'
        },
        get () {
          const v = this.getProperty('borderStyle');
          return { ...v, valueOf: () => v.left };
        },
        set (value) {
          if (obj.isString(value)) {
            const left = value; const right = value; const top = value; const bottom = value;
            value = { left, right, top, bottom };
          }
          this.setProperty('borderStyle', value);
        }
      },

      ...generateUnfolded('borderStyle', undefined, 'styling'),

      borderColor: {
        group: 'styling',
        isStyleProp: true,
        type: 'Color',
        foldable: ['top', 'left', 'right', 'bottom'],
        defaultValue: {
          top: Color.white,
          left: Color.white,
          bottom: Color.white,
          right: Color.white,
          valueOf: () => Color.white
        },
        get () {
          const v = this.getProperty('borderColor');
          return { ...v, valueOf: () => v.left };
        },
        set (value) {
          if (!value) value = Color.white;
          if (value.isColor) {
            value = { top: value, left: value, right: value, bottom: value };
          }
          this.setProperty(
            'borderColor',
            value
              ? obj.extract(value, ['top', 'left', 'right', 'bottom'], (k, v) => {
                return obj.isArray(v) ? Color.fromTuple(v) : v;
              })
              : value
          );
        }
      },

      ...generateUnfolded('borderColor', undefined, 'styling'),

      border: {
        group: 'styling',
        isStyleProp: true,
        derived: true,
        after: ['borderStyle', 'borderWidth', 'borderColor', 'borderRadius'],
        get () {
          const self = this;
          return {
            get style () { return self.borderStyle; },
            set style (val) { self.borderStyle = val; },
            get width () { return self.borderWidth; },
            set width (val) { self.borderWidth = val; },
            get color () { return self.borderColor; },
            set color (val) { self.borderColor = val; },
            get radius () { return self.borderRadius; },
            set radius (val) { self.borderRadius = val; }
          };
        },
        set (x) {
          if ('style' in x) this.borderStyle = x.style;
          if ('width' in x) this.borderWidth = x.width;
          if ('color' in x) this.borderColor = x.color;
          if ('radius' in x) this.borderRadius = x.radius;
        }
      },

      styleProperties: {
        group: 'styling',
        derived: true,
        readOnly: true,
        get () {
          const { properties, order } = this.propertiesAndPropertySettings();
          const styleProps = [];
          for (const prop of order) {
            if (properties[prop].isStyleProp) { styleProps.push(prop); }
          }
          return styleProps;
        }
      },

      style: {
        group: 'styling',
        derived: true,
        readOnly: true,
        get () {
          const styleProperties = this.styleProperties; const style = {};
          for (let i = 0; i < styleProperties.length; i++) {
            const prop = styleProperties[i];
            style[prop] = this[prop];
          }
          return style;
        }
      },

      epiMorph: {
        group: 'core',
        doc: "epi morphs are 'transient' morphs, i.e. meta objects that should not be serialized like halo items, menus, etc.",
        defaultValue: false
      },

      respondsToVisibleWindow: {
        group: 'interaction',
        doc: "Morphs will respond to changes to the visible browser window and a call will be made to the morph's relayout function, supplying the event generated",
        defaultValue: false
      },

      metadata: { group: 'core' }
    };
  }

  constructor (props) {
    if (!props) props = {};

    const env = props.env || MorphicEnv.default();
    this._env = env;
    this._rev = env.changeManager.revision;
    this._owner = null;
    this._id = newMorphId(getClassName(this));
    this._animationQueue = new AnimationQueue(this);
    this._cachedPaths = {};
    this._pathDependants = [];
    this._tickingScripts = [];
    this._parametrizedProps = obj.select(props, arr.intersect(Object.keys(props), [...this.styleProperties, 'master']));
    this.initializeProperties(props);

    if (props.bounds) {
      this.setBounds(props.bounds);
      this._parametrizedProps.extent = this.extent;
      this._parametrizedProps.position = this.position;
    }
    if (props.height !== undefined || props.width !== undefined) { this._parametrizedProps.extent = this.extent; }
    // if (props.layout) this.layout = props.layout;

    if (typeof this.onLoad === 'function' && !this.isComponent) this.onLoad();
  }

  get __serialization_id_property__ () { return '_id'; }

  __deserialize__ (snapshot, objRef, serializedMap, pool) {
    this._isDeserializing = true;
    this._env = MorphicEnv.default(); // FIXME!
    this._rev = snapshot.rev;
    this._owner = null;
    this._id = pool.reinitializeIds ? pool.reinitializeIds(objRef.id, objRef) : objRef.id;
    this._animationQueue = new AnimationQueue(this);
    this._cachedPaths = {};
    this._pathDependants = [];
    this._tickingScripts = [];
    this._parametrizedProps = obj.select(snapshot.props, arr.intersect(Object.keys(snapshot.props), [...this.styleProperties].concat(
      snapshot._masterOverridden
        ? ['master']
        : [])));
    this._parametrizedProps.__takenFromSnapshot__ = true;
    const s = pool.expressionSerializer;
    for (const prop in this._parametrizedProps) {
      const v = this._parametrizedProps[prop].value;
      if (v && obj.isString(v) && s.isSerializedExpression(v)) {
        this._parametrizedProps[prop] = s.deserializeExpr(v);
      }
    }
    this.initializeProperties();
    this._pool = pool;
  }

  __after_deserialize__ (snapshot, ref, pool) {
    delete this._isDeserializing;
    this.resumeStepping();
    // too late, the master may have already applied itself here...
    if (typeof this.onLoad === 'function') {
      try { this.onLoad(); } catch (e) { console.error(`[lively.morphic] ${this}.onLoad() error: ${e.stack}`); }
    }
    if (!this.isComponent || this.owner) delete this._pool;
    if (this.master) {
      if (pool.mastersInSubHierarchy) { pool.mastersInSubHierarchy.push(this.master); } else { pool.mastersInSubHierarchy = [this.master]; }
    }
    if (this.viewModel) {
      this.viewModel.attach(this);
    }
  }

  get __only_serialize__ () {
    const defaults = this.defaultProperties;
    const properties = this.propertiesAndPropertySettings().properties;
    const propsToSerialize = [];
    if (this._tickingScripts.length > 0) propsToSerialize.push('_tickingScripts');
    if (this.attributeConnections) propsToSerialize.push('attributeConnections');
    for (const key in properties) {
      const descr = properties[key];
      if (
        descr.readOnly ||
        descr.derived ||
        descr.isComponent ||
        (descr.hasOwnProperty('serialize') && !descr.serialize) ||
        obj.equals(this[key], defaults[key])
      ) continue;
      propsToSerialize.push(key);
    }

    return propsToSerialize;
  }

  __additionally_serialize__ (snapshot, ref, pool, addFn) {
    // remove epi morphs
    let submorphs = snapshot.props.submorphs;
    if (submorphs && !this.isEpiMorph) {
      submorphs = submorphs.value;
      for (let i = submorphs.length; i--;) {
        const { id, __ref__ } = submorphs[i];
        if (!__ref__) continue;
        if (pool.refForId(id).realObj.isEpiMorph) { arr.removeAt(submorphs, i); }
      }
    }
    for (const foldedProp of arr.intersect(this.__only_serialize__, ['borderColor', 'borderWidth', 'borderStyle', 'borderRadius'])) {
      snapshot.props[foldedProp] = {
        key: foldedProp,
        verbatim: true,
        value: obj.extract(
          this[foldedProp], this.propertiesAndPropertySettings().properties[foldedProp].foldable,
          (prop, value) => value && value.isColor ? value.toTuple() : value)
      };
    }

    const { properties } = this.propertiesAndPropertySettings();
    for (const key in properties) {
      const descr = properties[key];
      if (descr.isComponent && this[key]) {
        const meta = this[key][Symbol.for('lively-module-meta')];
        if (!meta) continue;
        addFn(key, pool.expressionSerializer.exprStringEncode({
          __expr__: meta.export,
          bindings: { [meta.module]: meta.export }
        }));
      }
    }

    if (this._masterOverridden) snapshot._masterOverridden = true;
  }

  get isMorph () { return true; }
  get id () { return this._id; }

  get env () { return this._env; }

  spec (skipUnchangedFromDefault = true, seenMorphs = new WeakMap()) {
    const defaults = this.defaultProperties;
    const properties = this.propertiesAndPropertySettings().properties;
    const ignored = { submorphs: true };
    const spec = {};
    if (seenMorphs.has(this)) return seenMorphs.get(this);
    seenMorphs.set(this, spec);
    for (const key in properties) {
      const descr = properties[key];
      if (!descr) continue;
      if (
        descr.readOnly ||
        descr.derived ||
        (descr.hasOwnProperty('serialize') && !descr.serialize) ||
        key in ignored
      ) continue;
      if (skipUnchangedFromDefault) {
        if (obj.equals(this[key], defaults[key]) || (
          this[key] && defaults[key] &&
            this[key].valueOf && defaults[key].valueOf &&
            obj.equals(this[key].valueOf(), defaults[key].valueOf())
        )) {
          continue;
        }
      }
      if (this[key] && this[key].isMorph) {
        spec[key] = this[key].spec(skipUnchangedFromDefault, seenMorphs);
        continue;
      }
      if (this[key] && key === 'layout') {
        spec[key] = this[key].copy();
        continue;
      }
      spec[key] = this[key];
    }
    spec.submorphs = this.submorphs.map(ea => ea.spec(skipUnchangedFromDefault, seenMorphs));
    spec.type = this.constructor;
    return spec;
  }

  printSpec (spec = null, depth = 0) {
    spec = spec || this.spec();
    const priority = { name: true, type: true, submorphs: true };
    const singleIndent = '  ';
    const propIndent = singleIndent.repeat(depth + 1);
    let printed = singleIndent.repeat(depth) + '{\n' +
               `${propIndent}name: "${spec.name}",\n` +
               `${propIndent}type: "${spec.type}",\n`;
    for (const key in spec) {
      if (!priority[key]) { printed = printed + `${propIndent}${key}: ${string.print(spec[key])},\n`; }
    }
    if (spec.submorphs) {
      printed += `${propIndent}submorphs: [\n`;
      for (const subspec of spec.submorphs) { printed += this.printSpec(subspec, depth + 1); }
      printed += ']\n';
    }
    printed += singleIndent.repeat(depth) + '}\n';
    return printed;
  }

  defaultProperty (key) { return this.defaultProperties[key]; }
  getProperty (key) { return this._morphicState[key]; }
  setProperty (key, value, meta) {
    return this.addValueChange(key, value, meta);
  }

  /**
  * Change the metadata object of the morph.
  * @param {string} path - The property path inside the meta object to modify.
  * @param {object} data - The data to put into the metadata.
  * @param {boolean} serialize - Wether to mark the data as serializable or not.
  * @param {boolean} merge - Wether to replace or merge in the updated data.
  */
  changeMetaData (path, data, serialize = true, merge = true) {
    let { metadata } = this;
    if (!metadata) metadata = {};
    new PropertyPath(path).withParentAndKeyDo(metadata, true, (parent, key) => {
      if (merge) parent[key] = { ...parent[key], ...data };
      else parent[key] = data;
      let dont = parent.__dont_serialize__;
      if (!serialize) {
        if (!dont) dont = parent.__dont_serialize__ = [];
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

  toString () {
    return `<${getClassName(this)} - ${this.name ? this.name : this.id}>`;
  }

  edit (opts) {
    return this.env.world.execCommand('open object editor', { className: getClassName(this), ...opts, target: this });
  }

  inspect (opts) {
    if (obj.isNumber(opts)) return; // call from chai, which we do not want to react to
    return this.env.world.execCommand('open object inspector', { ...opts, target: this });
  }

  livelyCustomInspect () {
    const ignored = { _id: true, _owner: true }; const seen = {};
    const props = this.propertiesAndPropertySettings().properties;
    let properties = [];
    for (const key in props) {
      if (ignored[key] || (props[key].derived && !props[key].showInInspector)) continue;
      seen[key] = true;
      properties.push({ key, value: this[key] });
    }

    properties.push({ key: 'id', value: this.id });
    properties.push({ key: 'owner', value: this.owner });

    properties = properties.sort((a, b) => {
      const aK = a.key.toLowerCase();
      const bK = b.key.toLowerCase();
      return aK < bK ? -1 : aK === bK ? 0 : 1;
    });

    const morphInternals = [
      'attributeConnections',
      '_animationQueue',
      '_morphicState',
      'doNotCopyProperties',
      'doNotSerialize',
      '_env',
      '_cachedPaths',
      '_pathDependants',
      '_rev',
      '_tickingScripts',
      '_transform',
      '_invTransform',
      '_styleSheetProps',
      '_tooltipViewer',
      'layout'
    ];

    if (this.attributeConnections) {
      for (const c of this.attributeConnections) { ignored[`$$${c.sourceAttrName}`, `${c.sourceAttrName}`] = true; }
    }

    Object.assign(seen, ignored);
    for (const key of morphInternals) {
      if (!(key in this)) continue;
      seen[key] = true;
      properties.push({ key, value: this[key], keyString: `[internal] ${key}` });
    }

    for (const key in this) {
      if (seen[key] || !this.hasOwnProperty(key)) continue;
      properties.unshift({ key, value: this[key], keyString: `[UNKNOWN PROPERTY] ${key}` });
    }

    return { sort: false, includeDefault: false, properties };
  }

  show (loop) { return $world.execCommand('show morph', { morph: this, loop }); }

  setStatusMessage (msg, statusMessageComponent, delay, opts) {
    const w = this.world();
    opts = { maxLines: 7, isCompact: true, ...opts };
    return w ? w.setStatusMessageFor(this, msg, statusMessageComponent, delay, opts) : console.log(msg);
  }

  showError (err) {
    const w = this.world();
    return w ? w.showErrorFor(this, err) : console.error(err);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // changes
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  onChange (change) {
    const anim = change.meta && change.meta.animation;
    const { prop, value } = change;

    if (prop === 'position' || prop === 'rotation' ||
        prop === 'scale' ||
        prop === 'origin' ||
        prop === 'reactsToPointer') {
      this.onBoundsChanged(this.bounds());
      this.updateTransform({ [prop]: value });
    } else if (prop === 'extent') {
      this.onBoundsChanged(this.bounds());
    } else if (prop === 'layout') {
      if (anim) {
        value && value.attachAnimated(anim.duration, this, anim.easing);
      } else {
        value && value.attach();
      }
    }

    this.layout && this.layout.onChange(change);

    if (this.isComponent && !PropertyPath('meta.metaInteraction').get(change)) {
      this.updateDerivedMorphs();
    }
    if (this.master) {
      this.master.onMorphChange(this, change);
    }
  }

  updateDerivedMorphs () {
    const world = this.world() || $world;
    delete this._preview;
    const derivedMorphs = world ? world.withAllSubmorphsSelect(m => m.master && m.master.uses(this)) : [];
    derivedMorphs.forEach(m => {
      m.requestMasterStyling();
    });
  }

  onBoundsChanged (bounds) {
    signal(this, 'bounds', bounds);
    for (let c of bounds.corners) {
      signal(this, c, bounds.partNamed(c));
    }
    for (let c of bounds.sides) {
      signal(this, c, bounds.partNamed(c));
    }
  }

  onSubmorphChange (change, submorph) {
    this.master?.onMorphChange(submorph, change);
    this.layout?.onSubmorphChange(submorph, change);
  }

  get changes () { return this.env.changeManager.changesFor(this); }
  applyChange (change) { this.env.changeManager.apply(this, change); }

  addValueChange (prop, value, meta) {
    return this.env.changeManager.addValueChange(this, prop, value, meta);
  }

  addMethodCallChangeDoing (spec, doFn) {
    // spec = {target, selector, args, undo}
    return this.env.changeManager.addMethodCallChangeDoing(spec, this, doFn);
  }

  groupChangesWhile (groupChange, whileFn) {
    return this.env.changeManager.groupChangesWhile(this, groupChange, whileFn);
  }

  dontRecordChangesWhile (whileFn) {
    return this.env.changeManager.dontRecordChangesWhile(this, whileFn);
  }

  recordChangesWhile (whileFn, optFilter) {
    return this.env.changeManager.recordChangesWhile(whileFn, optFilter);
  }

  recordChangesStart (optFilter) {
    return this.env.changeManager.recordChangesStartForMorph(this, optFilter);
  }

  recordChangesStop (id) {
    return this.env.changeManager.recordChangesStopForMorph(this, id);
  }

  withMetaDo (meta, doFn) {
    return this.env.changeManager.doWithValueChangeMeta(meta, this, doFn);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // undo
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  undoStart (name) {
    return this.env.undoManager.undoStart(this, name);
  }

  undoStop (name) {
    return this.env.undoManager.undoStop(this, name);
  }

  get undoInProgress () { return this.env.undoManager.undoInProgress; }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // morphic interface
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  async animate (config) {
    this.renderingState.animationAdded = true;
    const anim = this._animationQueue.registerAnimation(config);
    this.makeDirty();
    if (anim) {
      return await anim.asPromise();
    }
    return Promise.resolve(this);
  }

  async withAnimationDo (cb, config) {
    // collect all changes inside the submorphs and animate them
    const { changes } = this.groupChangesWhile(false, cb);
    await Promise.all(Object.values(arr.groupBy(changes, change => change.target.id))
      .map((changes) => {
        const animConfig = { ...config };
        let target;
        changes.forEach(change => {
          target = change.target;
          this.withMetaDo({ metaInteraction: true }, () => {
            change.reverseApply();
          });
          animConfig[change.prop] = change.value;
        });
        return target && target.animate(animConfig);
      }));
  }

  isClip () { return this.clipMode !== 'visible'; }

  get scrollExtent () {
    /*
     Since the DOM will always include the scrollbar area to the scrollable
     are of the div, we need to allow the morphic scroll to take that
     area into account as well. If not, we get weird jiggle effects when morphic
     and the DOM fight over how much the scroll is actually allowed to be.
     rms: I tried fixing this entirely in CSS, but failed. My idea was to add invisible margins
          to the rendered div container of a scrollable morph, such that HTML will end up with the
          same scrollable area as morphic, but that somehow does not work.
    */
    return (this.submorphs.length
      ? this.innerBounds().union(this.submorphBounds())
      : this.innerBounds()).extent().addPt(this.scrollbarOffset);
  }

  /**
   * Returns whether or not the horizontal scrollbar of this Morphs is visible.
   * TODO: Might return incorrect values for arrangements with submorphs that are not arranged orthogonal to each other.
   */
  get horizontalScrollbarVisible () {
    const extent = this.extent.x;
    const scrollExtent = this.scrollExtent.x - this.scrollbarOffset.x;
    return (scrollExtent > extent && this.clipMode === 'auto') || this.clipMode === 'scroll';
  }

  /**
   * Returns whether or not the vertical scrollbar of this Morphs is visible.
   * TODO: Might return incorrect values for arrangements with submorphs that are not arranged orthogonal to each other.
   */
  get verticalScrollbarVisible () {
    const extent = this.extent.y;
    const scrollExtent = this.scrollExtent.y - this.scrollbarOffset.y;
    return (scrollExtent > extent && this.clipMode === 'auto') || this.clipMode === 'scroll';
  }

  scrollBounds () {
    const { x, y } = this.scroll;
    const { x: w, y: h } = this.scrollExtent;
    return new Rectangle(x, y, w, h);
  }

  scrollDown (n) { this.scroll = this.scroll.addXY(0, n); }
  scrollUp (n) { this.scrollDown(-n * 50); }
  scrollLeft (n) { this.scroll = this.scroll.addXY(n, 0); }
  scrollRight (n) { this.scrollLeft(-n); }
  scrollPageDown () { this.scrollDown(this.height); }
  scrollPageUp () { this.scrollUp(this.height); }

  static get styleClasses () {
    // we statically determine default style classes based on the Morph
    // inheritance chain, i.e. by default a morph gets the style class names of
    // its class and all the classes up to morph.
    // Can be overridden on the instance level see Morph>>get styleClasses()
    if (this.hasOwnProperty('_styclassNames')) { return this._styleClasses; }

    let klass = this;
    const classNames = [];
    while (klass) {
      if (klass === Object) break;
      classNames.push(klass[Symbol.for('__LivelyClassName__')]);
      klass = klass[Symbol.for('lively-instance-superclass')];
    }
    return this._styleClasses = classNames;
  }

  addStyleClass (className) {
    this.styleClasses = arr.uniq(this.styleClasses.concat(className));
    this.renderingState.needsRerender = true;
  }

  removeStyleClass (className) {
    this.styleClasses = this.styleClasses.filter(ea => ea !== className);
    this.renderingState.needsRerender = true;
  }

  adjustOrigin (newOrigin) {
    this.withMetaDo({ metaInteraction: true }, () => {
      const oldOrigin = this.origin;
      const oldPos = this.globalBounds().topLeft();
      this.origin = newOrigin;
      this.submorphs.forEach((m) =>
        m.position = m.position.subPt(newOrigin.subPt(oldOrigin)));
      const newPos = this.globalBounds().topLeft();
      const globalDelta = oldPos.subPt(newPos);
      this.globalPosition = this.globalPosition.addPt(globalDelta);
    });
  }

  setBounds (bounds) {
    this.extent = bounds.extent();
    this.position = bounds.topLeft().addPt(this.origin);
  }

  innerBounds () {
    const { x: w, y: h } = this.extent;
    return rect(0, 0, w, h);
  }

  relativeBounds (other) {
    other = other || this.world();
    let bounds = this.origin.negated().extent(this.extent);

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

  bounds () {
    return this.relativeBounds(this.owner);
  }

  relativeSubmorphBounds () {
    const bounds = this.innerBounds();
    return this.submorphs.map(ea => {
      const { width, height, x, y } = ea.bounds();
      return rect(x / bounds.width, y / bounds.height, width / bounds.width, height / bounds.height);
    });
  }

  globalBounds () {
    return this.relativeBounds(this.world());
  }

  submorphBounds (filterFn = () => true) {
    const morphs = this.submorphs.filter(filterFn);
    if (morphs.length < 1) return this.innerBounds();
    return morphs.map(submorph => submorph.bounds())
      .reduce((a, b) => a.union(b));
  }

  fitToSubmorphs (padding = Rectangle.inset(0)) {
    const { submorphs: morphs } = this;
    if (!morphs.length) return;

    const bounds = morphs.reduce(
      (bnds, ea) => bnds.union(ea.bounds()),
      morphs[0].bounds());

    const topOffset = bounds.top() - padding.top();
    const leftOffset = bounds.left() - padding.left();
    this.moveBy(pt(leftOffset, topOffset));
    arr.invoke(this.submorphs, 'moveBy', pt(-leftOffset, -topOffset));
    this.extent = pt(
      bounds.width + padding.left() + padding.right(),
      bounds.height + padding.top() + padding.bottom());
  }

  align (p1, p2) { return this.moveBy(p2.subPt(p1)); }
  moveBy (delta) {
    this.position = this.position.addPt(delta);
    return this;
  }

  rotateBy (delta) { this.rotation += delta; }
  resizeBy (delta) { this.extent = this.extent.addPt(delta); }
  snap (grid) { this.position = this.position.roundTo(grid || 1); }

  get isEpiMorph () {
    /* transient "meta" morph */
    // note: Components even if declared epi Morphs are not treated as such
    //       since that should only apply to their derived morphs.
    return this.getProperty('epiMorph') && !this.isComponent;
  }

  isUsedAsEpiMorph () {
    let m = this;
    while (m) { if (m.isEpiMorph) return true; m = m.owner; }
    return false;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // morphic relationship
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  replaceWith (other, indexForOtherMorph, replaceSubmorphs = true) {
    // this method switches the scene graph location of two morphs (this and
    // other). Morphs can be unrelated or in child/owner relationship.
    // Transforms / submorphs of this and other are also replaced so that the
    // replace operation seems to not have any other effects on the scene graph

    if (this === other || !other) return other;

    if (this === other.owner) {
      other.replaceWith(this);
      return other;
    }

    const myOwner = this.owner;
    const mySubmorphs = this.submorphs;
    const myTfm = this.getTransform().copy();
    const myIndex = typeof indexForOtherMorph === 'number'
      ? indexForOtherMorph
      : myOwner ? myOwner.submorphs.indexOf(this) : -1;
    const otherOwner = other.owner;
    const otherSubmorphs = arr.without(other.submorphs, this);
    const otherTfm = other.getTransform().copy();
    const otherIndex = otherOwner ? otherOwner.submorphs.indexOf(other) : -1;

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
          .concat(otherSubmorphs.slice(myIndex));
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

  addMorphAt (submorph, index) {
    // ensure it's a morph or a spec
    if (!submorph || typeof submorph !== 'object') { throw new Error(`${submorph} cannot be added as a submorph to ${this}`); }

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
    const existingIndex = this.submorphs.indexOf(submorph);
    if (existingIndex > -1 && existingIndex === index) return;

    this.renderingState.hasStructuralChanges = true;

    this.requestMasterStyling();

    this.addMethodCallChangeDoing({
      target: this,
      selector: 'addMorphAt',
      args: [submorph, index],
      undo: {
        target: this,
        selector: 'removeMorph',
        args: [submorph]
      }
    }, () => {
      const prevOwner = submorph.owner;
      const submorphs = this.submorphs; let tfm;

      if (prevOwner && prevOwner !== this) {
      // since morph transforms are local to a morphs owner we need to
      // compute a new transform for the morph inside the new owner so that the
      // morphs does not appear to change its position / rotation / scale
        tfm = submorph.transformForNewOwner(this);
        submorph.remove();
      }

      if (submorph._env !== this._env) {
        submorph._env = this._env;
        // reset the rendering state
        submorph.renderingState.renderedMorphs = [];
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
      submorph._cachedPaths = {};
      if (tfm) submorph.setTransform(tfm);
      this._morphicState.submorphs = submorphs;

      this.makeDirty();
      submorph.resumeSteppingAll();

      submorph.withAllSubmorphsDo(ea => ea.onOwnerChanged(this));

      if (this.world() && submorph._requestMasterStyling) {
        submorph.master && submorph.master.applyIfNeeded(true);
        submorph._requestMasterStyling = false;
      }
    });

    return submorph;
  }

  addMorph (submorph, insertBeforeMorph) {
    this.renderingState.hasStructuralChanges = true;
    submorph._positionOnCanvas = null;
    // insert at right position in submorph list, according to insertBeforeMorph
    const submorphs = this.submorphs;
    const insertBeforeMorphIndex = insertBeforeMorph
      ? submorphs.indexOf(insertBeforeMorph)
      : -1;
    const insertionIndex = insertBeforeMorphIndex === -1
      ? submorphs.length
      : insertBeforeMorphIndex;

    return this.addMorphAt(submorph, insertionIndex);
  }

  addMorphBack (other) {
    // adds a morph "behind" all other submorphs
    const next = other === this.submorphs[0] ? this.submorphs[1] : this.submorphs[0];
    return this.addMorph(other, next);
  }

  removeMorph (morph) {
    const index = this.submorphs.indexOf(morph);
    if (index === -1) return;

    const submorphs = this.getProperty('submorphs') || [];
    submorphs.splice(index, 1);

    this.addMethodCallChangeDoing({
      target: this,
      selector: 'removeMorph',
      args: [morph],
      undo: {
        target: this,
        selector: 'addMorphAt',
        args: [morph, index]
      }
    }, () => {
      morph.suspendSteppingAll();
      morph._owner = null;
    });
    this._pathDependants = arr.withoutAll(this._pathDependants, morph._pathDependants);
    this.renderingState.hasStructuralChanges = true;
    this.renderingState.hasMorphRemoved = true;
  }

  /**
   * Removes a morph from the morph hierarchy, meaning it has no longer any owner and is thus not visible.
   * If a reference to the morph exists, it can again be added into the hierarchy later.
   * @returns {Morph} The Morph on which this method was called.
   */
  remove () {
    signal(this, 'onRemove');
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
    return this;
  }

  /**
   * Different than `remove`, this method should be used to indicate than this morph is no longer needed.
   * It can be handy to e.g. clean up connections and other resources.
   * @param {Boolean} remove - Whether or not remove() should be called. Normally, it does not make sense to set this to be false, as abandoning indicates that a morph is no longer to be used.
   * `remove` was introduced as a band-aid for the old master component system (before we had declarative components)
   * FIXME: can the parameter be removed?
   */
  abandon (remove = true) {
    signal(this, 'onAbandon');
    if ($world.isIDEWorld) $world.emptyCommentsFor(this);
    if (remove) this.remove();
    this.submorphs.forEach(submorph => submorph.abandon(false)); // do not remove submorphs
  }

  /**
   * Called whenever this morph has moved in or out of the morph hierarchy.
   * If `newOwner` is `null`, the morph was removed from a morph.
   * In case it was attached to a new parent, that morph is referenced by `newOwner`.
   * @param { Morph|null } newOwner - If applicable, the new owner the morph is assigned to.
   */
  onOwnerChanged (newOwner) {}

  async fadeOut (duration = 1000) {
    await this.animate({ opacity: 0, duration, easing: easings.outQuad });
    this.remove();
    this.opacity = 1;
  }

  async fadeIn (duration = 1000) {
    this.opacity = 0;
    this.animate({ opacity: 1, duration });
    return this;
  }

  async fadeIntoWorld (pos = $world.visibleBounds().center(), duration = 200) {
    const w = new Morph({
      opacity: 0,
      scale: 0,
      epiMorph: true,
      hasFixedPosition: true,
      fill: Color.transparent
    });
    const world = this.env.world;
    w.openInWorld();
    w.addMorph(this);
    this.position = w.extent.scaleBy(0.5);
    w.center = pos;
    w.scale = 0.8;
    await w.animate({ opacity: 1, scale: 1, duration });
    const bounds = this.globalBounds();
    world.addMorph(this);
    this.top = bounds.top();
    this.left = bounds.left();
    w.remove();
    return this;
  }

  removeAllMorphs () { this.submorphs = []; }

  bringToFront () {
    const { owner } = this;
    if (owner && arr.last(owner.submorphs) !== this) {
      const i = owner.submorphs.indexOf(this);
      owner.submorphs.slice(i).forEach(m => m.renderingState.hasStructuralChanges = true);
      this.remove();
      owner.addMorph(this);
      this.renderingState.hasStructuralChanges = true;
    }
    return this;
  }

  get owner () { return this._owner; }

  withAllSubmorphsDetect (testerFunc) {
    if (testerFunc(this)) return this;
    for (const m of this.submorphs) {
      const found = m.withAllSubmorphsDetect(testerFunc);
      if (found) return found;
    }
    return undefined;
  }

  withAllSubmorphsDoExcluding (func, exclusionFunc) {
    const result = [func(this)];
    if (exclusionFunc(this)) return result;
    for (const m of this.submorphs) { arr.pushAll(result, m.withAllSubmorphsDoExcluding(func, exclusionFunc)); }
    return result;
  }

  withAllSubmorphsDo (func) {
    const result = [func(this)];
    for (const m of this.submorphs) { arr.pushAll(result, m.withAllSubmorphsDo(func)); }
    return result;
  }

  withAllSubmorphsSelect (testerFunc) {
    const result = [];
    this.withAllSubmorphsDo(m =>
      testerFunc(m) && result.push(m));
    return result;
  }

  ownerChain () {
    return this.owner ? [this.owner].concat(this.owner.ownerChain()) : [];
  }

  world () {
    return this.owner ? this.owner.world() : null;
  }

  getWindow () { return this.isWindow ? this : this.ownerChain().find(({ isWindow }) => isWindow); }

  openInWorldNear (pos, optWorld) {
    const world = optWorld || this.world() || this.env.world;
    if (!world) return this;
    if (this.master) {
      this.opacity = 0;
      this.master.whenApplied().then(() => {
        this.opacity = 1;
      });
    }
    this.center = pos;
    this.setBounds(world.visibleBoundsExcludingTopBar().translateForInclusion(this.bounds()));
    return this.openInWorld(this.position);
  }

  openInWorldNearHand (optWorld) {
    const world = optWorld || this.world() || this.env.world;
    const pos = world.firstHand ? world.firstHand.position.addPt(!this.hasFixedPosition ? world.scroll : pt(0, 0)) : pt(0, 0);
    return world ? this.openInWorldNear(pos) : undefined;
  }

  openInWorld (pos, optWorld) {
    const world = optWorld || this.world() || this.env.world;
    if (!world) {
      console.warn(`Cannot open morph ${this}, world morph not found;`);
      return this;
    }
    if (pos) this.position = pos;
    else {
      this.center = this.hasFixedPosition ? world.visibleBounds().extent().scaleBy(0.5, 0.5) : world.visibleBounds().center();
      this.snap();
    }
    world.addMorph(this);
    return this;
  }

  openInHand (hand) {
    if (!hand) {
      const world = this.world() || this.env.world;
      hand = world.firstHand;
    }
    hand.grab(this);
    this.center = pt(0, 0);
  }

  openInWindow (opts = { title: this.name, name: 'window for ' + this.name, world: null }) {
    const world = opts.world || this.world() || this.env.world;
    return world.openInWindow(this, obj.dissoc(opts, ['world']));
  }

  isAncestorOf (aMorph) {
    // check if aMorph is somewhere in my submorph tree
    let owner = aMorph.owner;
    while (owner) { if (owner === this) return true; owner = owner.owner; }
    return false;
  }

  morphsContainingPoint (point, list) {
    // if morph1 visually before morph2 than list.indexOf(morph1) < list.indexOf(morph2)
    if (!list) list = [];
    if (!this.fullContainsWorldPoint(point)) return list;
    for (let i = this.submorphs.length - 1; i >= 0; i--) { this.submorphs[i].morphsContainingPoint(point, list); }
    if (this.innerBoundsContainsWorldPoint(point)) list.push(this);
    return list;
  }

  morphBeneath (pos) {
    // returns the morph that is visually stacked below this morph at pos
    // note that this is independent of the morph hierarchy
    const someOwner = this.world() || this.owner;
    if (!someOwner) return null;
    const morphs = someOwner.morphsContainingPoint(pos);
    const myIdx = morphs.indexOf(this);
    const morphBeneath = morphs[myIdx + 1];
    return morphBeneath;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // transforms
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  transformTillMorph (other, direction = 'up') {
    // faster version of transform to, that benefits from
    // having the other morph in the current morph's owner chain
    if (direction === 'down') return other.transformTillMorph(this, 'up').inverse();
    const tfm = new Transform();
    for (let morph = this; morph && morph !== other; morph = morph.owner) {
      const { origin, scroll } = morph;
      if (origin.x !== 0 || origin.y !== 0) { tfm.preConcatenate(new Transform(morph.origin)); }
      tfm.preConcatenate(morph.getTransform());
      if (morph !== this) {
        if ((scroll.x !== 0 || scroll.y !== 0) && morph.owner/*! owner means morph === world */) { tfm.preConcatenate(new Transform(scroll.negated())); }
      }
      if (morph.hasFixedPosition && morph.owner) {
        tfm.preConcatenate(new Transform(morph.owner.scroll));
      }
    }
    return tfm;
  }

  localize (p) {
    // map world point to local coordinates
    const world = this.world(); const { x, y } = p;
    return world ? world.transformPointToMorph(this, pt(x, y)) : p;
  }

  worldPoint (p) {
    const world = this.world(); const { x, y } = p;
    return world ? this.transformPointToMorph(world, pt(x, y)) : p.addPt(this.position);
  }

  transformToMorph (other) {
    const tfm = this.getGlobalTransform();
    const inv = other.getGlobalTransform().inverse();
    tfm.preConcatenate(inv);
    const { scroll } = other;
    if ((scroll.x !== 0 || scroll.y !== 0) && other.owner/* i.e. don't do it for the world' */) { tfm.preConcatenate(new Transform(scroll)); }
    return tfm;
  }

  transformPointToMorph (other, p) {
    const pathToMorph = this.pathToMorph(other);
    let hasFixedParent = !!pathToMorph.find(([_, m]) => m.hasFixedPosition && m.owner && m.owner.isWorld);
    if (hasFixedParent && this.isWorld) {
      p.x = p.x + this.position.x - this.scroll.x;
      p.y = p.y + this.position.y - this.scroll.y;
    }
    for (const [d, m] of pathToMorph) {
      if (this !== m && d === 'up') {
        p.x -= m.scroll.x;
        p.y -= m.scroll.y;
        if (m.hasFixedPosition && m.owner && m.owner.owner) {
          p.x += m.owner.scroll.x;
          p.y += m.owner.scroll.y;
        }
      }
      this.applyTransform(d, m, p);
      if (this !== m && d === 'down') {
        p.x += m.scroll.x;
        p.y += m.scroll.y;
        if (m.hasFixedPosition && m.owner && m.owner.owner/* i.e. except world */) {
          p.x -= m.owner.scroll.x;
          p.y -= m.owner.scroll.y;
        }
      }
    }
    if (hasFixedParent && other.isWorld) {
      p.x = p.x - other.position.x + other.scroll.x;
      p.y = p.y - other.position.y + other.scroll.y;
    }
    // this needs to be applied with the transform!

    return p;
  }

  transformRectToMorph (other, r) {
    let tl, tr, br, bl;
    [tl = r.topLeft(), tr = r.topRight(),
      br = r.bottomRight(), bl = r.bottomLeft()]
      .forEach(corner => this.transformPointToMorph(other, corner));
    return Rectangle.unionPts([tl, tr, br, bl]);
  }

  applyTransform (d, m, p) {
    if (d === 'up') {
      p.x += m.origin.x;
      p.y += m.origin.y;
      p.matrixTransform(m.getTransform(), p);
    } else {
      p.matrixTransform(m.getInverseTransform(), p);
      p.x -= m.origin.x;
      p.y -= m.origin.y;
    }
  }

  _addPathDependant (morph) {
    if (!this._pathDependants.includes(morph)) { this._pathDependants.push(morph); }
  }

  pathToMorph (other) {
    let path;
    if (path = this._cachedPaths[other.id]) return path;
    path = [];
    const commonRoot = this.closestCommonAncestor(other) || this;
    let morph = this;
    commonRoot._addPathDependant(this);
    while (morph && morph !== commonRoot) {
      path.push(['up', morph]);
      morph._addPathDependant(this);
      morph = morph.owner;
    }
    morph = other;
    const firstDownIndex = path.length;
    while (morph && morph !== commonRoot) {
      arr.pushAt(path, ['down', morph], firstDownIndex);
      morph._addPathDependant(this);
      morph = morph.owner;
    }
    this._cachedPaths[other.id] = path;
    return path;
  }

  closestCommonAncestor (other) {
    return arr.intersect([this, ...this.ownerChain()], [other, ...other.ownerChain()])[0];
  }

  transformForNewOwner (newOwner) {
    return new Transform(this.transformToMorph(newOwner));
  }

  localizePointFrom ({ x, y }, otherMorph) {
    // map local point to owner coordinates
    try {
      return otherMorph.transformPointToMorph(this, pt(x, y));
    } catch (er) {
      console.warn('problem ' + er + ' in localizePointFrom');
      return pt;
    }
  }

  getGlobalTransform () {
    return this.transformTillMorph(this.world());
  }

  get globalPosition () { return this.worldPoint(pt(0, 0)); }
  set globalPosition (p) { return this.position = (this.owner ? this.owner.localize(p) : p); }

  ensureToBeInWorldBounds () {
    const w = this.world();
    if (!w) return;
    const bnds = this.globalBounds();
    const translatedBnds = w.innerBounds().translateForInclusion(bnds);
    const delta = translatedBnds.topLeft().subPt(bnds.topLeft());
    this.moveBy(delta);
  }

  getTransform () {
    if (!this._transform) this.updateTransform();
    return this._transform;
  }

  getInverseTransform () {
    if (!this._invTransform) this.updateTransform();
    return this._invTransform;
  }

  updateTransform ({ position, scale, origin, rotation } = {}) {
    const tfm = this._transform || new Transform();
    const tfm_inv = this._invTransform || new Transform();

    position = position || this.position;
    origin = origin || this.origin;
    scale = scale || this.scale;
    rotation = rotation || this.rotation;
    tfm.a = scale * Math.cos(rotation);
    tfm.b = scale * Math.sin(rotation);
    tfm.c = scale * -Math.sin(rotation);
    tfm.d = scale * Math.cos(rotation);
    tfm.e = tfm.a * -origin.x + tfm.c * -origin.y + position.x;
    tfm.f = tfm.b * -origin.x + tfm.d * -origin.y + position.y;

    const { a, b, c, d, e, f } = tfm;
    const det = a * d - c * b;
    const invdet = 1 / det;

    tfm_inv.a = d * invdet;
    tfm_inv.b = -b * invdet;
    tfm_inv.c = -c * invdet;
    tfm_inv.d = a * invdet;
    tfm_inv.e = (c * f - e * d) * invdet;
    tfm_inv.f = -(a * f - b * e) * invdet;

    this._transform = tfm;
    this._invTransform = tfm_inv;
  }

  setTransform (tfm) {
    this.position = tfm.getTranslation();
    this.rotation = num.toRadians(tfm.getRotation());
    this.scale = tfm.getScalePoint().x;
    this.updateTransform(this);
  }

  fullContainsWorldPoint (p) { // p is in world coordinates
    return this.fullContainsPoint(this.owner === null ? p : this.owner.localize(p));
  }

  fullContainsPoint (p) { // p is in owner coordinates
    return this.bounds().containsPoint(p);
  }

  innerBoundsContainsWorldPoint (p) { // p is in world coordinates
    return this.innerBoundsContainsPoint(this.localize(p));
  }

  innerBoundsContainsPoint (p) { // p is in local coordinates (offset by origin)
    return this.innerBounds().containsPoint(p.addPt(this.origin).subPt(this.scroll));
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // naming
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  get (name) {
    // search below, search siblings, search upwards
    if (!name) return null;
    try {
      return this.getSubmorphNamed(name) ||
          (this.getNameTest(this, name) && this) ||
          this.getOwnerOrOwnerSubmorphNamed(name);
    } catch (e) {
      if (e.constructor === RangeError && e.message === 'Maximum call stack size exceeded') {
        throw new Error("'get' failed due to a stack overflow. The most\n" +
          "likely source of the problem is using 'get' as part of\n" +
          "toString, because 'get' calls 'getOwnerOrOwnerSubmorphNamed', which\n" +
          "calls 'toString' on this. Try using 'getSubmorphNamed' instead,\n" +
          "which only searches in this' children.\nOriginal error:\n" + e.stack);
      }
      throw e;
    }
  }

  getNameTest (morph, expectedName) {
    const isRe = obj.isRegExp(expectedName);
    if (isRe) {
      if (expectedName.test(morph.name) || expectedName.test(String(morph))) return true;
    } else {
      if (morph.name === expectedName || String(morph) === expectedName) return true;
    }
    return false;
  }

  getAllNamed (name, result = []) {
    if (!this._morphicState || /* pre-init when used in constructor */
     !this.submorphs.length) return result;
    for (let i = 0; i < this.submorphs.length; i++) {
      const morph = this.submorphs[i];
      if (this.getNameTest(morph, name)) result.push(morph);
    }
    for (let i = 0; i < this.submorphs.length; i++) { this.submorphs[i].getAllNamed(name, result); }
    return result;
  }

  getSubmorphNamed (name) {
    if (!this._morphicState || /* pre-init when used in constructor */
     !this.submorphs.length) return null;
    for (let i = 0; i < this.submorphs.length; i++) {
      const morph = this.submorphs[i];
      if (this.getNameTest(morph, name)) return morph;
    }
    for (let i = 0; i < this.submorphs.length; i++) {
      const morph = this.submorphs[i].getSubmorphNamed(name);
      if (morph) return morph;
    }
    return null;
  }

  getSubmorphsByStyleClassName (styleClassName) {
    return this.withAllSubmorphsSelect(({ styleClasses }) => styleClasses.includes(styleClassName));
  }

  getOwnerNamed (name) {
    return this.ownerChain().find(ea => ea.name === name);
  }

  getOwnerOrOwnerSubmorphNamed (name) {
    const owner = this.owner;
    if (!owner) return null;
    if (owner.name === name) return owner;
    for (let i = 0; i < owner.submorphs.length; i++) {
      const morph = owner.submorphs[i];
      if (morph === this) continue;
      if (this.getNameTest(morph, name)) return morph;
      const foundInMorph = morph.getSubmorphNamed(name);
      if (foundInMorph) return foundInMorph;
    }
    return this.owner.getOwnerOrOwnerSubmorphNamed(name);
  }

  getMorphWithId (id) {
    return this.withAllSubmorphsDetect(({ id: morphId }) => id === morphId);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // mirror prototype

  setMirrored (bool) {
    if (!bool) {
      this.addStyleClass('hidden-in-mirror');
    } else {
      this.removeStyleClass('hidden-in-mirror');
    }
  }

  isMirrored () {
    if (this.styleClasses.indexOf('hidden-in-mirror') >= 0) {
      return true;
    }
    return false;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // events
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  get dragTriggerDistance () { return 0; }

  /**
   * Called when mouse down event is received on the area of this Morph while its halo is active.
   * @param {Object} evt - The DOM event causing the call
   */
  onHaloMouseDown (evt) {

  }

  onMouseDown (evt) {
    if (this === evt.targetMorph) {
      evt.state.clickedMorph = this;
      if (evt.state.prevClick.clickCount === 1) {
        const timeDiff = Date.now() - evt.state.prevClick.clickedAtTime;
        if (timeDiff <= 200) {
          this.onDoubleMouseDown(evt);
          return;
        }
      }
    }
    if (this === evt.targetMorph && this.master) {
      this.requestMasterStyling();
    }
  }

  onDoubleMouseDown (evt) {}

  onMouseUp (evt) {
    evt.state.clickedMorph = null;
    if (this === evt.targetMorph && this.master) { this.requestMasterStyling(); }
  }

  onMouseMove (evt) {}
  onLongClick (evt) {}

  addKeyBindings (bindings) {
    this.addMethodCallChangeDoing({
      target: this,
      selector: 'addKeyBindings',
      args: [bindings],
      undo: null
    }, () => {
      if (!this._keybindings) this._keybindings = [];
      this._cachedKeyhandlers = null;
      this._keybindings.unshift(...bindings);
    });
  }

  get keybindings () { return this._keybindings || []; }
  set keybindings (bndgs) {
    this._cachedKeyhandlers = null;
    return this._keybindings = bndgs;
  }

  get keyhandlers () {
    // Note that reconstructing the keyhandler on every stroke might prove too
    // slow. On my machine it's currently around 10ms which isn't really noticable
    // but for snappier key behavior we might want to cache that. Tricky thing
    // about caching is to figure out when to invalidate... keys binding changes
    // can happen in a number of places
    return this._cachedKeyhandlers ||
       (this._cachedKeyhandlers = [KeyHandler.withBindings(this.keybindings)]);
  }

  get keyCommandMap () {
    const platform = this.keyhandlers[0].platform;
    return this.keybindings.reduce((keyMap, binding) => {
      const keys = binding.keys;
      const platformKeys = findKeysForPlatform(keys, platform);
      const command = binding.command;
      const name = typeof command === 'string' ? command : command.command || command.name;

      if (typeof platformKeys !== 'string') return keyMap;

      return platformKeys.split('|').reduce((keyMap, combo) =>
        Object.assign(keyMap, {
          [combo]: {
            name,
            command,
            prettyKeys: KeyHandler.prettyCombo(combo)
          }
        }), keyMap);
    }, {});
  }

  keysForCommand (commandName, pretty = true) {
    const map = this.keyCommandMap;
    const rawKey = Object.keys(map).find(key => map[key].name === commandName);
    return rawKey && pretty ? map[rawKey].prettyKeys : rawKey;
  }

  simulateKeys (keyString) { return KeyHandler.simulateKeys(this, keyString); }

  onKeyDown (evt) {
    if (KeyHandler.invokeKeyHandlers(this, evt, false/* allow input evts */)) {
      evt.stop();
    }
  }

  onKeyUp (evt) {}

  onContextMenu (evt) {
    // FIXME: if (lively.FreezerRuntime) return; // do not stop propagation if in freezer mode
    if (evt.targetMorph !== this) return;
    if (!lively.FreezerRuntime) evt.stop();
    Promise
      .resolve(this.menuItems(evt)).then(items => this.openMenu(items, evt))
      .catch(err => $world.logError(err));
  }

  openMenu (items, optEvt) {
    const world = this.world();
    return items && items.length && world ? world.openWorldMenu(optEvt, items) : null;
  }

  menuItems (evt) {
    return $world.defaultMenuItems(this, evt);
  }

  onCut (evt) {}
  onCopy (evt) {}
  onPaste (evt) {}

  onDragStart (evt) {
    this.undoStart('drag-move');
    const { dragStartMorphPosition, absDragDelta } = evt.state;
    this.position = dragStartMorphPosition.addPt(absDragDelta);
  }

  onDragEnd (evt) {
    this.undoStop('drag-move');
    $world.execCommand('remove snap to guides', this);
  }

  onDrag (evt) {
    const { dragStartMorphPosition, absDragDelta } = evt.state;
    this.position = dragStartMorphPosition.addPt(absDragDelta);
    $world.execCommand('show and snap to guides', {
      target: this, showGuides: evt.isCtrlDown(), snap: evt.isCtrlDown()
    });
  }

  onGrab (evt) {
    if (evt.isShiftDown()) {
      const copy = this.copy();
      copy.position = this.transformPointToMorph(evt.hand, pt(0, 0));
      evt.hand.grab(copy);
    } else {
      evt.hand.grab(this);
    }
  }

  onDrop (evt) {
    // called when `this` is choosen as a drop target, double dispatches the
    // drop back to the hand but can be overriden to handle drops differently
    evt.hand.dropMorphsOn(this);
  }

  doNotAcceptDropsForThisAndSubmorphs () {
    this.withAllSubmorphsDo(m => m.acceptsDrops = false);
  }

  acceptDropsForThisAndSubmorphs () {
    this.withAllSubmorphsDo(m => m.acceptsDrops = true);
  }

  wantsToBeDroppedOn (dropTarget) {
    // called when `this` is grabbed and a drop target for `this` needs to be found
    return true;
  }

  onDropHoverIn (evt) {}
  onDropHoverUpdate (evt) {}
  onDropHoverOut (evt) {}

  onBeingDroppedOn (hand, recipient) {
    // called when `this` was dropped onto morph `recipient`
    recipient.addMorph(this);
  }

  onHoverIn (evt) {
    if (this.master?.respondsToHover) { this.requestMasterStyling(); }
  }

  onHoverOut (evt) {
    if (this.master?.respondsToHover || this.master?.respondsToClick) { this.requestMasterStyling(); }
  }

  onScroll (evt) {}
  onMouseWheel (evt) {}

  // access to the HTML 5 drag'n'drop API
  onNativeDrop (evt) {}
  onNativeDragleave (evt) {}
  onNativeDragenter (evt) {}
  onNativeDragover (evt) {}
  onNativeDragend (evt) {}
  onNativeDragstart (evt) {}
  onNativeDrag (evt) {}

  focus () {
    const eventDispatcher = this.env.eventDispatcher;
    eventDispatcher && eventDispatcher.focusMorph(this);
  }

  onWindowActivated () {}
  onWindowDeactivated () {}
  onFocus (evt) {}
  onBlur (evt) {}
  isFocused () {
    const eventDispatcher = this.env.eventDispatcher;
    return eventDispatcher && eventDispatcher.isMorphFocused(this);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // serialization
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  exportToJSON (options) {
    return serializeSpec(this, options);
  }

  initFromJSON (spec) {
    this._env = spec.env || spec._env || MorphicEnv.default();
    this._rev = 0;
    this._owner = null;
    this._id = spec._id || newMorphId(getClassName(this));
    this._animationQueue = new AnimationQueue(this);
    this._cachedPaths = {};
    this._pathDependants = [];
    this._tickingScripts = [];
    this.dontRecordChangesWhile(() => {
      this.initializeProperties();
      deserializeSpec(spec, spec => morph(spec), this);
    });
    return this;
  }

  copyViaJSON () {
    const exported = this.exportToJSON();
    tree.prewalk(exported, spec => spec._id = newMorphId(spec.type), ({ submorphs }) => submorphs);
    exported.name = exported.name.replace(
      /copy( [0-9]+)?$/,
      (_, num) => `copy ${num && num.trim() ? Number(num) + 1 : '1'}`);
    // rk 2017-01-08: attributeConnections hard reset...! and only of root
    // morph? this seems really wrong!
    return morph({ type: exported.type }).initFromJSON(exported);
  }

  canBeCopied () { return true; }
  copy (realCopy = false) { return copyMorph(this, realCopy); }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // rendering
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  makeDirty () {
    this.renderingState.needsRerender = true;
    if (this.owner) this.owner.makeDirty();
  }

  needsRerender () {
    return this.renderingState.needsRerender;
  }

  whenRendered (maxChecks = 50) {
    return this.env.whenRendered(this, maxChecks)
      .then(() => true)
      .catch(() => false);
  }

  whenEnvReady () {
    return this.env.whenReady();
  }

  getNodeForRenderer (renderer) {
    return renderer.nodeForMorph(this);
  }

  applyLayoutIfNeeded () {
    for (let i = 0; i < this.submorphs.length; i++) { this.submorphs[i].applyLayoutIfNeeded(); }
    this.layout && !this.layout.manualUpdate && this.layout.onContainerRender();
  }

  requestMasterStyling () {
    if (this.master) {
      this._requestMasterStyling = true;
      this.makeDirty();
    }
  }

  get borderOptions () {
    return ['none', 'hidden', 'dotted', 'dashed', 'solid', 'double', 'groove', 'ridge', 'inset', 'outset'];
  }

  renderPreview (opts = {}, renderer = $world.env.renderer) {
    // Creates a DOM node that is a "preview" of the morph, i.e. a
    // representation that looks like the morph but doesn't morphic behavior
    // attached
    // opts = {width = 100, height = 100, center = true, asNode = false}
    return renderer.renderPreview(this, opts);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // ticking
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  startStepping (/* stepTime, scriptName, ...args */) {
    // stepTime is optional
    const args = Array.from(arguments);
    const stepTime = typeof args[0] === 'number' ? args.shift() : null;
    const scriptName = args.shift();
    const script = new TargetScript(this, scriptName, args);
    this.removeEqualScripts(script);
    this._tickingScripts.push(script);
    script.startTicking(stepTime);
    return script;
  }

  get tickingScripts () { return this._tickingScripts; }

  stopStepping () {
    arr.invoke(this._tickingScripts, 'stop');
    this._tickingScripts.length = [];
  }

  stopSteppingScriptNamed (selector) {
    const scriptsToStop = this._tickingScripts.filter(ea => ea.selector === selector);
    this.stopScripts(scriptsToStop);
  }

  stopScripts (scripts) {
    arr.invoke(scripts, 'stop');
    this._tickingScripts = arr.withoutAll(this._tickingScripts, scripts);
  }

  suspendStepping () {
    if (this._tickingScripts) { arr.invoke(this._tickingScripts, 'suspend'); }
  }

  suspendSteppingAll () {
    this.withAllSubmorphsDo(ea => ea.suspendStepping());
  }

  resumeStepping () {
    arr.invoke(this._tickingScripts, 'resume');
  }

  resumeSteppingAll () {
    this.withAllSubmorphsDo(ea => arr.invoke(ea._tickingScripts, 'resume'));
  }

  removeEqualScripts (script) {
    this.stopScripts(this._tickingScripts.filter(ea => ea.equals(script)));
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // comments
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  /**
   * Retrieves comments made on this morph from the world and returns them. Returns an empty array when no comments exist.
   * @see `lively.collab` for more information on comments.
   * Comments are only available when the world is a `LivelyWorld` provided by `lively.ide`.
   * When comments are not available, this method returns an empty array.
   * @returns {[CommentData]} An array of the comments on this morph or an empty array
   */
  get comments () {
    if (!$world.isIDEWorld) return [];
    const commentMap = $world.morphCommentMap;
    if (!commentMap.has(this)) return [];
    else return commentMap.get(this);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // commands
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  get commands () { return this._commands || []; }
  set commands (cmds) {
    if (this._commands) this.removeCommands(this._commands);
    this.addCommands(cmds);
  }

  get commandsIncludingOwners () {
    return [this].concat(this.ownerChain()).flatMap(morph =>
      arr.sortByKey(morph.commands, 'name').map(command => ({ target: morph, command })));
  }

  addCommands (cmds) {
    this.addMethodCallChangeDoing({
      target: this,
      selector: 'addCommands',
      args: [cmds],
      undo: { target: this, selector: 'removeCommands', args: [cmds] }
    }, () => {
      this.removeCommands(cmds);
      this._commands = (this._commands || []).concat(cmds);
    });
  }

  removeCommands (cmdsOrNames) {
    this.addMethodCallChangeDoing({
      target: this,
      selector: 'removeCommands',
      args: [cmdsOrNames],
      undo: { target: this, selector: 'addCommands', args: [cmdsOrNames] }
    }, () => {
      const names = cmdsOrNames.map(ea => typeof ea === 'string' ? ea : ea.name);
      const commands = (this._commands || []).filter(({ name }) => !names.includes(name));
      if (!commands.length) delete this._commands;
      else this._commands = commands;
    });
  }

  get commandHandler () {
    return this._commandHandler || defaultCommandHandler;
  }

  lookupCommand (commandOrName) {
    const result = this.commandHandler.lookupCommand(commandOrName, this);
    return result && result.command ? result : null;
  }

  execCommand (command, args, count, evt) {
    return this.commandHandler.exec(command, this, args, count, evt);
  }
}

/**
 * Custom render logic is applied to transform a rectangle into an ellipse by cutting the corners based on its width and height.
 */
export class Ellipse extends Morph {
  static get properties () {
    return {
      isEllipse: { get () { return true; } }
    };
  }

  renderStyles (styleProps) {
    delete styleProps.borderRadius;
    styleProps['border-radius'] = '50%';
    return styleProps;
  }
}

export class Triangle extends Morph {
  static get properties () {
    return {
      direction: { defaultValue: 'up' },
      triangleFill: { after: ['fill'], initialize () { this.triangleFill = this.fill; } }
    };
  }

  constructor (props = {}) {
    super(props);
    this.update();
  }

  onChange (change) {
    if (change.prop === 'extent' ||
     change.prop === 'direction' ||
     (change.prop === 'fill' && change.value)
    ) this.update();
    super.onChange(change);
  }

  update () {
    const { x: width, y: height } = this.extent;
    if (width !== height) this.extent = pt(Math.max(width, height), Math.max(width, height));

    this.origin = pt(width / 2, height / 2);

    const color = this.triangleFill = this.fill || this.triangleFill;
    this.fill = null;

    const base = { width: width / 2, style: 'solid', color: color };
    const side = { width: height / 2, style: 'solid', color: Color.transparent };
    let side1; let side2; let bottom;

    switch (this.direction) {
      case 'down': side1 = 'borderLeft'; side2 = 'borderRight'; bottom = 'borderTop'; break;
      case 'up': side1 = 'borderLeft'; side2 = 'borderRight'; bottom = 'borderBottom'; break;
      case 'left': side1 = 'borderBottom'; side2 = 'borderTop'; bottom = 'borderRight'; break;
      case 'right': side1 = 'borderBottom'; side2 = 'borderTop'; bottom = 'borderLeft'; break;
    }

    Object.assign(this, { [side1]: side, [side2]: side, [bottom]: base });
  }
}

export class Image extends Morph {
  static get properties () {
    return {
      imageUrl: {
        isStyleProp: true,
        copyAssetOnFreeze: true,
        after: ['extent', 'autoResize'],
        defaultValue: config.defaultImage,

        set (url) {
          this.isLoaded = false;
          this.setProperty('imageUrl', url);
          this.setProperty('naturalExtent', null);
          const autoResize = this.autoResize && !this._isDeserializing;
          this.whenLoaded().then(() => {
            if (this.imageUrl !== url) return;
            this.isLoaded = true;
            if (autoResize) this.extent = this.naturalExtent;
          }).catch((err) => {
            // just ignore
          });
        }
      },

      fill: {
        defaultValue: Color.transparent
      },

      naturalExtent: { defaultValue: null },
      isLoaded: { defaultValue: false, serialize: false },
      autoResize: {
        isStyleProp: true,
        defaultValue: false
      },
      clipMode: {
        defaultValue: 'auto'
      }
    };
  }

  get isImage () { return true; }

  get ratio () { const { x, y } = this.naturalExtent; return x / y; }

  setWidthKeepingRatio (w) {
    this.width = w;
    this.height = w / this.ratio;
  }

  setHeightKeepingRatio (h) {
    this.width = this.ratio * h;
    this.height = h;
  }

  loadUrl (url, autoResize = this.autoResize) {
    const prevAutoResize = this.autoResize;
    this.autoResize = autoResize;
    this.imageUrl = url;
    return promise.finally(this.whenLoaded(), () => this.autoResize = prevAutoResize);
  }

  whenLoaded () {
    if (this.isLoaded) return Promise.resolve(this);
    return new Promise((resolve, reject) => {
      const url = this.imageUrl;
      this.imageElement(image => {
        if (this.imageUrl !== url) reject(new Error(`url changed (${url} => ${this.imageUrl})`));
        this.naturalExtent = pt(image.width, image.height);
        this.isLoaded = true;
        resolve(this);
      });
    });
  }

  determineNaturalExtent () { return this.whenLoaded().then(() => this.naturalExtent); }

  getNodeForRenderer (renderer) {
    return renderer.nodeForImage(this);
  }

  getURLForImgNode () {
    let url = this.imageUrl;
    if (url.startsWith('data:')) {
      const dataPos = url.indexOf(',');
      const header = url.substring(5, dataPos);
      const [mimeType, encoding] = header.split(';');
      const data = url.substring(dataPos + 1);
      if (encoding !== 'base64') {
        url = string.createDataURI(data, mimeType);
      }
    }
    return url;
  }

  patchSpecialProps (node) {
    if (this.renderingState.imageUrl !== this.imageUrl) {
      node.firstChild.src = this.getURLForImgNode();
      this.renderingState.imageUrl = this.imageUrl;
    }
    if (this.renderingState.tooltip !== this.tooltip) {
      node.firstChild.alt = this.tooltip;
      this.renderingState.tooltip = this.tooltip;
    }
  }

  clear () {
    // transparent gif:
    return this.loadUrl('data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', false);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // accessing DOM related things

  imageElement (onloadFn) {
    return new Promise((resolve, reject) => {
      const doc = this.env.domEnv.document;
      const image = doc.createElement('img');
      image.onload = () => {
        resolve(image);
        if (typeof onloadFn === 'function') { onloadFn(image); }
      };
      image.src = this.imageUrl;
    });
  }

  async canvasElementAndContext () {
    const doc = this.env.domEnv.document;
    const image = await this.imageElement();
    const canvas = doc.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = image.width;
    canvas.height = image.height;
    ctx.drawImage(image, 0, 0, image.width, image.height);
    return { canvas, ctx, image };
  }

  async imageData (bounds) {
    const { ctx, image } = await this.canvasElementAndContext();
    if (!bounds) bounds = rect(0, 0, image.width, image.height);
    const { x, y, width, height } = bounds;
    return ctx.getImageData(x, y, width, height);
  }

  async pixelAt (pos) { return (await this.imageData(pos.extent(pt(1, 1)))).data; }

  async colorAt (pos) { return Color.fromTuple8Bit(await this.pixelAt(pos)); }

  loadArrayBuffer (arrayBuffer, type = 'image/jpeg') {
    const arrayBufferView = new Uint8Array(arrayBuffer);
    const blob = new Blob([arrayBufferView], { type: 'image/jpeg' });
    const urlCreator = window.URL || window.webkitURL;
    const imageUrl = urlCreator.createObjectURL(blob);
    this.imageUrl = imageUrl;
    this.makeDirty();
  }

  async convertToBase64 () {
    // await this.convertToBase64();
    let urlString = this.imageUrl;
    let type = urlString.slice(urlString.lastIndexOf('.') + 1, urlString.length).toLowerCase();

    if (type === 'jpg') {
      type = 'jpeg';
    } else if (type === 'svg') {
      type = 'svg+xml';
    }
    if (!['gif', 'jpeg', 'png', 'tiff', 'svg+xml'].includes(type)) {
      type = 'gif';
    }

    if (!urlString.startsWith('http')) {
      urlString = string.joinPath(System.baseURL, urlString);
    }

    const { runCommand } = await System.import('lively.ide/shell/shell-interface.js');
    const cmd = `curl --silent "${urlString}" | openssl base64`;
    const { stdout } = await runCommand(cmd).whenDone();
    return this.loadUrl(`data:image/${type};base64,${stdout}`, false);
  }

  downloadImage () {
    // This doesn't work in all browsers. Alternative would be:
    // var dataDownloadURL = url.replace(/^data:image\/[^;]/, 'data:application/octet-stream')
    // window.open(dataDownloadURL);
    // however this wouldn't allow to set a file name...
    // this.downloadImage();
    const url = this.imageUrl; let name;
    if (url.match(/^data:image/)) { // data url
      name = this.name || 'image-from-lively';
      const typeMatch = url.match(/image\/([^;]+)/);
      if (typeMatch && typeMatch[1]) name += '.' + typeMatch[1];
    } else {
      if (!name) name = arr.last(url.split('/'));
    }
    const link = document.createElement('a');
    link.download = name;
    link.href = url;
    link.click();
  }

  async convertTo (type, quality, canvasFilter = false) {
    // this.convertTo("image/jpeg", 0.8)
    // this.convertTo(); 123
    if (!quality) quality = 1;
    const { ctx, canvas, image } = await this.canvasElementAndContext();
    const { x: width, y: height } = await this.determineNaturalExtent();
    canvas.width = image.width;
    canvas.height = image.height;
    if (canvasFilter) ctx.filter = canvasFilter;
    ctx.drawImage(image, 0, 0, width, height);
    return this.loadUrl(canvas.toDataURL(type, quality), false);
  }

  async resampleImageToFitBounds () {
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

    const { ctx, canvas, image } = await this.canvasElementAndContext();
    const { width: newWidth, height: newHeight } = this;
    const { width: imageWidth, height: imageHeight } = image;

    canvas.width = imageWidth; canvas.height = imageHeight;
    ctx.drawImage(image, 0, 0, newWidth, newHeight);
    const data = ctx.getImageData(0, 0, imageWidth, imageHeight);
    canvas.width = newWidth;
    canvas.height = newHeight;
    ctx.putImageData(data, 0, 0);
    return this.loadUrl(canvas.toDataURL(), false);
  }

  crop (cropBounds) {
    const { ctx, canvas, image } = this.canvasElementAndContext();
    const innerBounds = this.innerBounds();
    const { width: imageWidth, height: imageHeight } = image;
    const intersection = innerBounds.intersection(cropBounds);
    const relativeCrop = new Rectangle(
      intersection.x / innerBounds.width,
      intersection.y / innerBounds.height,
      intersection.width / innerBounds.width,
      intersection.height / innerBounds.height);
    const [unscaledCropBounds] = new Rectangle(0, 0, imageWidth, imageHeight).divide([relativeCrop]);

    canvas.width = imageWidth; canvas.height = imageHeight;
    ctx.drawImage(image, 0, 0, imageWidth, imageHeight);

    const data = ctx.getImageData(unscaledCropBounds.x, unscaledCropBounds.y, unscaledCropBounds.width, unscaledCropBounds.height);
    canvas.width = unscaledCropBounds.width;
    canvas.height = unscaledCropBounds.height;
    ctx.putImageData(data, 0, 0);

    return this.loadUrl(canvas.toDataURL(), false);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  async interactivelyChangeImageURL () {
    const url = await this.world().prompt('Enter image url', {
      historyId: 'lively.morphic-image-url-inputs',
      input: this.imageUrl.startsWith('data:') ? '' : this.imageUrl,
      requester: this,
      selectInput: true
    });
    if (typeof url === 'string') { this.imageUrl = url; }
  }

  menuItems (evt) {
    const items = super.menuItems(evt);
    items.unshift(
      ['change image url...', () => this.interactivelyChangeImageURL()],
      ['resize image to to fit world', () => {
        const s = Math.min(
          this.world().visibleBounds().width / this.naturalExtent.x,
          this.world().visibleBounds().height / this.naturalExtent.y
        );
        this.extent = this.naturalExtent.scaleBy(s);
      }],
      ['resize image to its real image size', async () => this.extent = await this.determineNaturalExtent()],
      ['resample image to fit current bounds', () => this.resampleImageToFitBounds()],
      { isDivider: true });
    return items;
  }
}

export class PathPoint {
  constructor (path, props = {}) {
    this.path = path;
    this._isSmooth = props.isSmooth || false;
    this.x = props.position ? props.position.x : (props.x || 0);
    this.y = props.position ? props.position.y : (props.y || 0);
    this._controlPoints = props.controlPoints;
  }

  get __dont_serialize__ () {
    return [
      'attributeConnections',
      '$$controlPoints', '$$position',
      'doNotCopyProperties', 'doNotSerialize'
    ];
  }

  get isPathPoint () { return true; }

  get isSmooth () { return this._isSmooth || false; }
  set isSmooth (smooth) {
    const changed = this._isSmooth !== smooth;
    if (changed) {
      this._isSmooth = smooth;
      this.adaptControlPoints(smooth);
    }
  }

  get position () { return pt(this.x, this.y); }
  set position ({ x, y }) {
    this.x = x;
    this.y = y;
    this.path.makeDirty();
  }

  moveBy (delta) {
    this.position = this.position.addPt(delta);
    this.path.onVertexChanged(this);
    return this;
  }

  copy () {
    const e = new ExpressionSerializer();
    return new PathPoint(this.path, e.deserializeExprObj(this.__serialize__()));
  }

  __serialize__ () {
    return {
      __expr__: `({
         position: ${this.position.toString(false)},
         isSmooth: ${this.isSmooth},
         controlPoints: {
           next: ${this.controlPoints.next.toString(false)},
           previous: ${this.controlPoints.previous.toString(false)}
         }
      })`.replace(/[\n|\s]/g, ''),
      bindings: { 'lively.graphics/geometry-2d.js': ['pt'] }
    };
  }

  get controlPoints () {
    return this._controlPoints || { next: pt(0, 0), previous: pt(0, 0) };
  }

  set controlPoints (cps = {}) {
    // ensure points
    const { next, previous } = cps;
    this._controlPoints = { next: next ? Point.fromLiteral(next) : pt(0, 0), previous: previous ? Point.fromLiteral(previous) : pt(0, 0) };
    this.path.makeDirty();
  }

  moveNextControlPoint (delta) {
    this.moveControlPoint('next', delta);
  }

  movePreviousControlPoint (delta) {
    this.moveControlPoint('previous', delta);
  }

  moveControlPoint (name, delta) {
    let acp = this.controlPoints[name];
    acp = acp ? acp.addPt(delta) : delta;
    const other = name === 'next' ? 'previous' : 'next';
    let bcp = this.controlPoints[other];
    if (this.isSmooth) {
      bcp = acp.negated().normalized().scaleBy(bcp.r());
    }
    this.controlPoints = { [name]: acp, [other]: bcp };
    this.path.onVertexChanged(this);
  }

  pointOnLine (a, b, pos, bw) {
    const v0 = pt(a.x, a.y);
    const v1 = pt(b.x, b.y);
    const l = v1.subPt(v0);
    const ln = l.scaleBy(1 / l.r());
    const dot = v1.subPt(pos).dotProduct(ln);
    return v1
      .subPt(ln.scaleBy(Math.max(1, Math.min(dot, l.r()))))
      .addXY(bw, bw);
  }

  get nextVertex () { return this.path.vertexAfter(this); }

  get previousVertex () { return this.path.vertexBefore(this); }

  interpolate (p, pos) {
    const interpolated = this.copy();
    interpolated.position = interpolated.position.interpolate(p, pos);
    return interpolated;
  }

  adaptControlPoints (smooth) {
    const { nextVertex, previousVertex, position, path } = this;
    const { vertices } = path;
    const i = vertices.indexOf(this);
    const isFirst = i === 0;
    const isLast = i === vertices.length - 1;
    const previousPos = previousVertex ? previousVertex.position : position;
    const nextPos = nextVertex ? nextVertex.position : position;
    if (smooth) {
      const p = this.pointOnLine(
        previousPos, nextPos, position, path.borderWidth);
      this.controlPoints = {
        previous: isFirst ? pt(0, 0) : p.subPt(nextPos),
        next: p.subPt(previousPos)
      };
    } else {
      this.controlPoints = {
        previous: isFirst ? pt(0, 0) : previousPos.subPt(position).scaleBy(0.5),
        next: isLast ? pt(0, 0) : nextPos.subPt(position).scaleBy(0.5)
      };
    }
    path.onVertexChanged(this);
  }
}

export class Path extends Morph {
  static get properties () {
    return {

      borderColor: {
        isStyleProp: true,
        type: 'ColorGradient',
        foldable: ['top', 'left', 'right', 'bottom'],
        set (value) {
          if (!value) value = Color.white;
          if (value.isColor || value.isGradient) {
            value = { top: value, left: value, right: value, bottom: value };
          }
          this.setProperty(
            'borderColor',
            obj.extract(value, ['top', 'left', 'right', 'bottom'], (k, v) => {
              return obj.isArray(v) ? Color.fromTuple(v) : v;
            })
          );
        }
      },

      showControlPoints: {
        defaultValue: false
      },

      vertices: {
        defaultValue: [],
        after: ['isSmooth', 'borderWidth'],
        before: ['extent', 'origin'],
        type: 'Vertices',
        set (vs) {
          const { isSmooth } = this;
          this._adjustingVertices = true;
          vs = vs.map(v => v.isPathPoint
            ? Object.assign(v, { path: this })
            : new PathPoint(this, { isSmooth, ...v }));
          this.setProperty('vertices', vs);
          this._adjustingVertices = false;
          this.updateBounds(vs);
        }
      },

      startMarker: { defaultValue: null, type: 'Object' },
      endMarker: { defaultValue: null, type: 'Object' },

      endStyle: {
        isStyleProp: true,
        type: 'Enum',
        values: ['butt', 'round', 'square'],
        defaultValue: 'butt'
      },

      drawnProportion: {
        type: 'Number',
        isStyleProp: true,
        isFloat: true,
        min: -1,
        max: 1,
        defaultValue: 0
      },

      cornerStyle: {
        type: 'Enum',
        isStyleProp: true,
        values: ['arcs', 'bevel', 'miter', 'miter-clip', 'round'],
        defaultValue: 'miter'
      },

      draggable: {
        get () {
          return this.getProperty('draggable') || this.showControlPoints;
        }
      },

      isSmooth: {
        defaultValue: false,
        before: ['vertices'],
        type: 'Boolean',
        set (val) {
          this.setProperty('isSmooth', val);
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

  constructor (props = {}) {
    super({ ...obj.dissoc(props, 'origin') });
    this.adjustOrigin(props.origin || this.origin);
    this.position = props.position || this.position;
    this.updateBounds(this.vertices);
  }

  __after_deserialize__ (snapshot, objRef, pool) {
    super.__after_deserialize__(snapshot, objRef, pool);
    this.updateBounds(this.vertices);
  }

  __additionally_serialize__ (snapshot, ref, pool, addFn) {
    super.__additionally_serialize__(snapshot, ref, pool, addFn);
    const draggable = this.getProperty('draggable');
    if (draggable !== this.propertiesAndPropertySettings().properties.draggable.defaultValue) { snapshot.props.draggable = { value: draggable }; }
    const c = this.borderColor.valueOf();
    if (!c) return;
    snapshot.props.borderColor = {
      key: 'borderColor',
      value: pool.expressionSerializer.exprStringEncode({
        __expr__: c.toJSExpr(),
        bindings: {
          'lively.graphics/geometry-2d.js': ['pt', 'rect'],
          'lively.graphics/color.js': ['Color', getClassName(c)]
        }
      })
    };
  }

  get isPath () { return true; }

  onVertexChanged (vertex) {
    this.makeDirty();
    this.updateBounds(this.vertices);
  }

  copyVertices () {
    return this.vertices.map(v => v.copy());
  }

  updateBounds (vertices = this.vertices) {
    // vertices = this.vertices
    if (!vertices.length) return;
    if (this._adjustingVertices) return;
    this._adjustingVertices = true;
    const { origin, extent: { x: w, y: h } } = this;
    const relOriginX = origin.x / w;
    const relOriginY = origin.y / h;
    const points = [];
    vertices.forEach((vertex, i) => {
      const { isSmooth, position, controlPoints } = vertex;
      const { next, previous } = controlPoints || {};
      points.push(position);
      if (isSmooth && i > 0 && i < vertices.length - 1) { points.push(position.addPt(next), position.addPt(previous)); }
    });
    const b = Rectangle.unionPts(points);
    const newOrigin = pt(b.width * relOriginX, b.height * relOriginY);
    const offset = b.topLeft();
    vertices.forEach(ea => ea.moveBy(offset.negated()));
    this.moveBy(this.getTransform().transformDirection(offset));
    this.extent = b.extent().maxPt(pt(this.borderWidth, this.borderWidth));
    this.origin = newOrigin;
    this._adjustingVertices = false;
  }

  onChange (change) {
    const { prop, value, prevValue } = change;
    const { _adjustingVertices, _adjustingOrigin } = this;
    if (prop === 'extent' && value && prevValue && !_adjustingVertices) { this.adjustVertices(value.scaleByPt(prevValue.inverted())); }
    if (!_adjustingOrigin && prop === 'vertices' || prop === 'borderWidthLeft') { this.updateBounds(prop === 'vertices' ? value : this.vertices); }
    if (!_adjustingVertices && prop === 'origin') { this.updateBounds(this.vertices); }
    super.onChange(change);
  }

  vertexBefore (v) {
    const i = this.vertices.indexOf(v) - 1;
    return this.vertices[i >= 0 ? i : this.vertices.length - 1];
  }

  vertexAfter (v) {
    const i = this.vertices.indexOf(v) + 1;
    return this.vertices[i > this.vertices.length - 1 ? 0 : i];
  }

  adjustVertices (delta) {
    const { vertices } = this;
    if (!vertices) return; /* init */
    vertices.forEach(v => {
      let { next, previous } = v.controlPoints;
      next = next.scaleByPt(delta);
      previous = previous.scaleByPt(delta);
      v.position = v.position
        .addPt(this.origin)
        .scaleByPt(delta)
        .subPt(this.origin);
      v.controlPoints = { next, previous };
    });
  }

  adjustOrigin (newOrigin) {
    this._adjustingOrigin = true;
    const { vertices, origin } = this;
    vertices.forEach(v =>
      v.position = origin.subPt(newOrigin).addXY(v.x, v.y));
    super.adjustOrigin(newOrigin);
    this._adjustingOrigin = false;
  }

  addVertex (v, before = null) {
    const { vertices } = this;
    const insertIndex = typeof before === 'number'
      ? before
      : before && before.isPathPoint
        ? vertices.indexOf(before)
        : undefined;
    if (typeof insertIndex === 'number' && insertIndex > -1) { vertices.splice(insertIndex, 0, v); } else vertices.push(v);
    this.vertices = vertices;
  }

  addVertexCloseTo (point) {
    // add a new vertext near point
    const {
      closest: {
        length: closestLength, vertex: closestV
      }, next
    } = this.verticesCloseTo(point);
    const { length, point: insertionPoint } = this.findClosestPointOnPath(point, 10, 3);
    const insertBefore = length <= closestLength ? closestV : next ? next.vertex : null;
    return this.addVertex(insertionPoint, insertBefore);
  }

  renderStyles (style) {
    style = obj.select(style, ['position', 'filter', 'display', 'opacity',
      'transform', 'top', 'left', 'transformOrigin', 'cursor', 'overflow']);

    style.width = this.width + 'px';
    style.height = this.height + 'px';
    style['pointer-events'] = this.reactsToPointer ? 'auto' : 'none';

    return style;
  }

  getNodeForRenderer (renderer) {
    return renderer.nodeForPath(this);
  }

  patchSpecialProps (node, renderer) {
    if (!obj.equals(this.borderColor, this.renderingState.borderColor)) {
      renderer.renderPolygonBorderColor(this);
      this.renderingState.borderColor = this.borderColor;
    }

    if (!obj.equals(this.endMarker, this.renderingState.endMarker)) {
      renderer.renderPathMarker(this, 'end');
      this.renderingState.endMarker = this.endMarker;
    }

    if (!obj.equals(this.startMarker, this.renderingState.startMarker)) {
      renderer.renderPathMarker(this, 'start');
      this.renderingState.startMarker = this.startMarker;
    }

    if (!this.clipMode !== this.renderingState.clipMode) {
      renderer.renderPolygonClipMode(this);
      this.renderingState.clipMode = this.clipMode;
    }

    if (!obj.equals(this.vertices, this.renderingState.vertices) ||
       this.isSmooth !== this.renderingState.isSmooth ||
       this.renderingState.controlPointDragged) {
      renderer.renderPolygonDrawAttribute(this);
      renderer.renderControlPoints(this);

      delete this.renderingState.controlPointDragged;
      this.renderingState.vertices = this.vertices;
      this.renderingState.isSmooth = this.isSmooth;
    }

    if (this.showControlPoints !== this.renderingState.showControlPoints) {
      renderer.renderControlPoints(this);
      this.renderingState.showControlPoints = this.showControlPoints;
    }

    if (!obj.equals(this.fill, this.renderingState.fill)) {
      renderer.renderPolygonFill(this);
      this.renderingState.fill = this.fill;
    }

    if (!obj.equals(this.cornerStyle, this.renderingState.cornerStyle) ||
       !obj.equals(this.endStyle, this.renderingState.endStyle)) {
      renderer.renderPolygonStrokeStyle(this);
      this.renderingState.cornerStyle = this.cornerStyle;
      this.renderingState.endStyle = this.endStyle;
    }

    if (!obj.equals(this.borderStyle, this.renderingState.borderStyle) ||
       !obj.equals(this.borderWidth, this.renderingState.borderWidth)) {
      renderer.renderPolygonBorder(this);
      this.renderingState.borderWidth = this.borderWidth;
      this.renderingState.borderStyle = this.borderStyle;
    }

    if (!obj.equals(this.width, this.renderingState.width) ||
       !obj.equals(this.height, this.renderingState.height)) {
      renderer.renderPolygonSVGAttributes(this);
      renderer.renderPolygonDrawAttribute(this);
      renderer.renderControlPoints(this);
      if (this.drawnProportion) renderer.renderPolygonMask(this);

      this.renderingState.vertices = this.vertices;
      this.renderingState.width = this.width;
      this.renderingState.height = this.height;
    }

    if (this.drawnProportion !== this.renderingState.drawnProportion) {
      renderer.renderPolygonMask(this);
      this.renderingState.drawnProportion = this.drawnProportion;
    }
  }

  get _pathNode () {
    const renderer = PropertyPath('env.renderer').get(this);
    const node = renderer && renderer.getNodeForMorph(this);
    return node && node.querySelector('#svg' + string.regExpEscape(this.id));
  }

  verticesCloseTo (point, withLength = true) {
    const { vertices } = this;
    const distsToVertices = [];
    let minDist = Infinity; let minDistIndex = -1;

    for (let i = 0; i < vertices.length; i++) {
      const dist = vertices[i].position.dist(point);
      distsToVertices.push(dist);
      if (dist >= minDist) continue;
      minDist = dist; minDistIndex = i;
    }

    const previous = minDistIndex === 0
      ? null
      : { index: minDistIndex - 1, vertex: vertices[minDistIndex - 1] };
    const next = minDistIndex === vertices.length - 1
      ? null
      : { index: minDistIndex + 1, vertex: vertices[minDistIndex + 1] };
    const closest = { index: minDistIndex, vertex: vertices[minDistIndex] };

    if (withLength) {
      const { _pathNode } = this;
      if (previous) {
        const { length } = this.findClosestPointOnPath(
          previous.vertex.position, 6, 3, _pathNode);
        previous.length = length;
      }
      if (next) {
        const { length } = this.findClosestPointOnPath(
          next.vertex.position, 6, 3, _pathNode);
        next.length = length;
      }
      {
        const { length } = this.findClosestPointOnPath(
          closest.vertex.position, 20, 3, _pathNode);
        closest.length = length;
      }
    }

    return { previous, next, closest };
  }

  findClosestPointOnPath (fromPoint, nSamples, iterations, pathNode) {
    // fromPoint is a Point in local coordinates of this
    // returns {length, point}
    // length - absolute length of closes point on path
    // point the closest point in local coords

    if (!pathNode) {
      const node = this.env.renderer.getNodeForMorph(this);
      pathNode = node && node.querySelector('#svg' + string.regExpEscape(this.id));
    }

    return pathNode
      ? findClosestPointOnPath(pathNode, fromPoint, nSamples, iterations)
      : { length: 0, point: fromPoint };

    function findClosestPointOnPath (
      pathNode, pos, nSamples = 10, iterations = 3,
      fromLength = 0, toLength = pathNode.getTotalLength(), iteration = 0
    ) {
      const samples = samplePathPoints(pathNode, toLength, fromLength, nSamples);
      let minDist = Infinity; let minIndex = -1;
      for (const [point, _, i] of samples) {
        const dist = pos.dist(point);
        if (dist >= minDist) continue;
        minDist = dist; minIndex = i;
      }

      if (iteration >= iterations) {
        const [point, length] = samples[minIndex];
        return { point, length };
      }

      fromLength = samples[Math.max(0, minIndex - 1)][1];
      toLength = samples[Math.min(samples.length - 1, minIndex + 1)][1];

      return findClosestPointOnPath(
        pathNode, pos, nSamples, iterations,
        fromLength, toLength, iteration + 1);

      function samplePathPoints (pathNode, from, to, sampleSize) {
        // 0 <= from, to <= pathNode.getTotalLength()
        // returns list of points with length sampleSize
        // including from, to
        const points = [];
        const step = (to - from) / (sampleSize - 1); let i = 0;
        points.push([Point.ensure(pathNode.getPointAtLength(from)), from, i]);
        for (i = 1; i < sampleSize - 1; i++) {
          const length = from + (i * step);
          points.push([Point.ensure(pathNode.getPointAtLength(length)), length, i]);
        }
        points.push([Point.ensure(pathNode.getPointAtLength(to)), to, i]);
        return points;
      }
    }
  }

  onDragStart (evt) {
    const { domEvt: { target } } = evt;
    const cssClass = new PropertyPath('attributes.class.value').get(target);
    if (cssClass && cssClass.includes('path-point')) {
      this.renderingState.controlPointDragged = true;
      const [_, n, ctrlN] = cssClass.match(/path-point-([0-9]+)(?:-control-([0-9]+))?$/);
      this._controlPointDrag = { marker: target, n: Number(n) };
      if (ctrlN !== undefined) this._controlPointDrag.ctrlN = Number(ctrlN);
    } else return super.onDragStart(evt);
  }

  onDrag (evt) {
    if (!this._controlPointDrag) return super.onDrag(evt);
    this.renderingState.controlPointDragged = true;
    const { n, ctrlN } = this._controlPointDrag;
    const { vertices } = this;
    const v = vertices[n];
    if (v) {
      const delta = this.getInverseTransform().transformDirection(evt.state.dragDelta);
      if (ctrlN === undefined) {
        v.moveBy(delta);
        const vp = vertices[n - 1]; const vn = vertices[n + 1];

        // merge?
        if (vp && vp.position.dist(v.position) < 10) {
          this._controlPointDrag.maybeMerge = [n - 1, n];
        } else if (vn && vn.position.dist(v.position) < 10) {
          this._controlPointDrag.maybeMerge = [n, n + 1];
        } else {
          this._controlPointDrag.maybeMerge = undefined;
        }
      } else if (ctrlN === 1) v.movePreviousControlPoint(delta);
      else if (ctrlN === 2) v.moveNextControlPoint(delta);
    }
  }

  onDragEnd (evt) {
    const { vertices, _controlPointDrag } = this;
    if (_controlPointDrag) {
      this.renderingState.controlPointDragged = true;
      const { maybeMerge } = _controlPointDrag;
      delete this._controlPointDrag;
      if (maybeMerge) {
        const [i, j] = maybeMerge;
        const v1 = vertices[i]; const v2 = vertices[j];
        v1.controlPoints.next = v2.controlPoints.next;
        vertices.splice(j, 1);
        this.vertices = vertices;
      }
    }
  }

  onDoubleMouseDown (evt) {
    if (this.showControlPoints) {
      this.addVertexCloseTo(this.localize(evt.position));
    }
  }

  menuItems () {
    const checked = Icon.textAttribute('check-square', { textStyleClasses: ['far'] });
    const unchecked = Icon.textAttribute('square', { textStyleClasses: ['far'] });
    unchecked[1].paddingRight = '7px';
    checked[1].paddingRight = '5px';
    return [
      [[...(this.showControlPoints ? checked : unchecked), ' control points'],
        () => this.showControlPoints = !this.showControlPoints],
      [[...(this.isSmooth ? checked : unchecked), ' smooth'],
        () => this.isSmooth = !this.isSmooth],
      { isDivider: true },
      ...super.menuItems()
    ];
  }

  getPointOnPath (n /* 0 - 1 */) {
    if (!this._pathNode) return pt(0, 0);
    const { x, y } = this._pathNode.getPointAtLength(this._pathNode.getTotalLength() * n) || pt(0, 0);
    return pt(x, y);
  }

  get borderOptions () {
    return ['solid', 'dotted', 'dashed'];
  }
}

export class Polygon extends Path {
  constructor (props) {
    if (props.vertices && props.vertices.length > 2) {
      super(props);
    } else {
      throw new Error('A polygon requires 3 or more vertices!');
    }
  }

  get isPolygon () { return true; }
}

export class LineMorph extends Morph {
  static get properties () {
    return {
      borderWidth: { defaultValue: 0 },
      fill: { defaultValue: Color.black },
      height: { defaultValue: 1 },
      line: {
        defaultValue: Line.fromCoords(0, 0, 0, 0),
        set (val) {
          this.setProperty('line', val);
          this.update(val);
        }
      },
      start: {
        derived: true,
        after: ['line'],
        get (val) { return this.line.start; },
        set (val) { this.line = this.line.withStart(val); }
      },
      end: {
        derived: true,
        after: ['line'],
        get (val) { return this.line.end; },
        set (val) { this.line = this.line.withEnd(val); }
      },
      position: {
        derived: true,
        after: ['line'],
        get (val) { return this.start; },
        set (val) {
          const delta = val.subPt(this.start);
          const rotation = this.rotation;
          this.line = new Line(val, this.end.addPt(delta));
          this.rotation = rotation;
        }
      }
    };
  }

  get isPolygon () { return true; }

  update () {
    if (this._isUpdating) return;
    this._isUpdating = true;
    const { line, height } = this;
    const vec = line.toVector();
    // offset of "width"
    this.setProperty('position', this.position.addPt(line.perpendicularLine(0, height, 'cc').toVector()));
    this.width = vec.fastR();
    this.rotation = vec.theta();
    this.vec = vec;
    this._isUpdating = false;
  }
}
