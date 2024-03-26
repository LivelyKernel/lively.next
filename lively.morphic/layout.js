import { pt, Rectangle, rect } from 'lively.graphics';
import { arr, promise, Closure, num, obj, fun } from 'lively.lang';
import { once, signal } from 'lively.bindings';
import { loadYoga } from 'yoga-layout';

let Yoga;
if (!Yoga) {
  loadYoga().then((l) => {
    Yoga = l;
  });
}

export function getYoga () { return Yoga; }

class Layout {
  constructor (config = {}) {
    const {
      spacing, padding, border, container, manualUpdate,
      ignore, onScheduleApply, layoutOrder,
      reactToSubmorphAnimations
    } = config;
    this.config = config;
    this.applyRequests = false;
    this.border = { top: 0, left: 0, right: 0, bottom: 0, ...border };
    this.ignore = ignore || [];
    this.active = false;
    this.container = container;
    this.manualUpdate = manualUpdate;
    this.reactToSubmorphAnimations = reactToSubmorphAnimations || false;
    this.onScheduleApply = onScheduleApply || ((submorph, animation, change) => {}); // eslint-disable-line no-unused-vars
    if (layoutOrder) {
      this.layoutOrder = layoutOrder;
      this.layoutOrderSource = JSON.stringify(String(layoutOrder));
    }
    this._spacing = spacing || 0;
    this._padding = !padding ? Rectangle.inset(0) : typeof padding === 'number' ? Rectangle.inset(padding) : Rectangle.fromLiteral(padding);
  }

  hasEmbeddedContainer () {
    if (this.container?.owner?.isText) return false;
    return this.container.owner?.embeddedMorphMap?.has(this.container);
  }

  attach () {
    if (this.renderViaCSS) {
      this.layoutableSubmorphs.forEach(m => m.makeDirty());
      return;
    }
    this.apply();
    if (this.container.master) {
      this.container.master.whenApplied().then(() => {
        this.applyRequests = true;
        this.forceLayout();
      });
    }
    this.refreshBoundsCache();
  }

  getNodeFor (aMorph) {
    const { renderer } = aMorph.env;
    if (!renderer) return null;
    return renderer.getNodeForMorph(aMorph);
  }

  measureSubmorph (layoutableSubmorph) {
    if (layoutableSubmorph.ownerChain().find(m => !m.visible)) return;
    const submorphNode = this.getNodeFor(layoutableSubmorph);
    if (!layoutableSubmorph.isLayoutable) return;
    this.onDomResize(submorphNode, layoutableSubmorph);
  }

  copy () { return new this.constructor(this); }

  with (props) {
    const c = this.copy();
    Object.assign(c, props);
    return c;
  }

  description () { return 'Describe the layout behavior here.'; }
  name () { return 'Name presented to the user.'; }

  isEnabled () { /* FIXME! */ return !this.active; }
  disable () { this.active = true; }
  enable (animation) {
    this.active = false;
    this.scheduleApply(null, animation);
  }

  get padding () { return this._padding; }
  set padding (padding) {
    if (typeof padding === 'number') {
      padding = Rectangle.inset(padding);
    }
    this._padding = padding;
    this.apply();
  }

  boundsChanged (container) {
    return !(this.lastBoundsExtent && container.bounds().extent().equals(this.lastBoundsExtent));
  }

  extentChanged (container) {
    return !(this.lastExtent && container.extent.equals(this.lastExtent));
  }

  equals (otherLayout) {
    return otherLayout.name() === this.name();
  }

  get layoutableSubmorphs () {
    if (!this.layoutOrder) { this.layoutOrder = Closure.fromSource(JSON.parse(this.layoutOrderSource)).recreateFunc(); }
    if (!this.container) return [];
    return arr.sortBy(
      this.container.submorphs.filter(
        m => m.isLayoutable && !this.ignore.includes(m.name)),
      m => this.layoutOrder(m));
  }

  layoutOrder (aMorph) {
    // helps orderdSubmorphs order my morphs
    return this.container.submorphs.indexOf(aMorph);
  }

  get submorphBoundsChanged () {
    const { layoutableSubmorphs, layoutableSubmorphBounds } = this;
    if (!layoutableSubmorphBounds ||
     (layoutableSubmorphs.length !== layoutableSubmorphBounds.length)) {
      return true;
    }
    for (let i = 0; i < layoutableSubmorphs.length; i++) {
      const m = layoutableSubmorphs[i];
      const b = layoutableSubmorphBounds[i];
      if (!b.equals(m.bounds())) {
        return true;
      }
    }
    return false;
  }

  refreshBoundsCache () {
    this.lastExtent = this.container.extent;
    this.lastBoundsExtent = this.container.bounds().extent();
    this.layoutableSubmorphBounds = this.layoutableSubmorphs.map(m => m.bounds());
  }

  onContainerRender () {
    this.forceLayout();
  }

  get noLayoutActionNeeded () {
    return !this.submorphsChanged &&
            !this.extentChanged(this.container) &&
            !this.boundsChanged(this.container) &&
            !this.submorphBoundsChanged;
  }

  get __dont_serialize__ () { return ['lastAnim', 'animationPromise']; }

  forceLayout () {
    if (this.applyRequests) {
      this.applyRequests = false;
      if (this.noLayoutActionNeeded) return;
      this.refreshBoundsCache();
      this.container.withMetaDo({
        isLayoutAction: true,
        animation: this.lastAnim
      }, () => this.apply(this.lastAnim));
      this.lastAnim = false;
    }
  }

  forceLayoutsOfMorph (m) {
    if (m.layout) { m.layout.forceLayout(); } else { m.submorphs.forEach(m => this.forceLayoutsOfMorph(m)); }
  }

  forceLayoutsInNextLevel () {
    this.layoutableSubmorphs.forEach(m => this.forceLayoutsOfMorph(m));
  }

  scheduleApply (submorph, animation, change = {}) {
    if (typeof this.onScheduleApply === 'function') { this.onScheduleApply(submorph, animation, change); }
    if (this.active) return;
    if (animation) this.lastAnim = animation;
    this.applyRequests = true;
  }

  onSubmorphResized (submorph, change) {
    this.scheduleApply(submorph, this.reactToSubmorphAnimations && change.meta.animation, change);
  }

  onSubmorphAdded (submorph, animation) {
    this.submorphsChanged = true;
    this.scheduleApply(submorph, animation);
  }

  onSubmorphRemoved (submorph, animation) {
    this.submorphsChanged = true;
    this.scheduleApply(submorph, animation);
  }

  onOwnerChanged (newOwner) {}

  onChange ({ selector, args, prop, value, prevValue, meta }) {
    const anim = this.reactToSubmorphAnimations && meta && meta.animation;
    const submorph = args && args[0];
    switch (selector) {
      case 'removeMorph':
        this.onSubmorphRemoved(submorph, anim);
        break;
      case 'addMorphAt':
        this.onSubmorphAdded(submorph, anim);
        break;
    }
    if (prop === 'borderWidth' && this.renderViaCSS) this.layoutableSubmorphs.forEach(m => m.makeDirty());
    if (prop === 'extent' && value && prevValue &&
        (prevValue.x !== value.x || prevValue.y !== value.y)) {
      this.scheduleApply(submorph, anim, { prop: 'extent', meta });
    }
  }

  getAffectedPolicy () {
    let curr = this.container;
    while (curr && !curr.master) curr = curr.owner;
    if (curr?.master?.managesMorph(this.container)) {
      return curr.master;
    }
  }

  affectsLayout (submorph, { prop, value, prevValue }) {
    return ['position', 'scale', 'rotation', 'isLayoutable', 'extent'].includes(prop) &&
           !obj.equals(value, prevValue);
  }

  get isLayoutAction () {
    return this.container?.env.changeManager.defaultMeta.isLayoutAction;
  }

  onConfigUpdate () {
    this.apply();
    if (!this._configChanged) {
      this._configChanged = true;
      this.layoutableSubmorphs.forEach(m => m.makeDirty());
      if (this.container) {
        this.container.renderingState.hasStructuralChanges = true;
        this.container.renderingState.hasCSSLayoutChange = true;
      }
    }
    if (this._initializingPolicies) return;
    if (!this.isLayoutAction) this.getAffectedPolicy()?.overrideProp(this.container, 'layout');
  }

  onSubmorphChange (submorph, change) {
    if (change.meta && change.meta.isLayoutAction) { return this.scheduleApply(submorph, this.reactToSubmorphAnimation && change.meta.animation); }
    if (this.affectsLayout(submorph, change)) {
      this.onSubmorphResized(submorph, change);
    }
  }

  changePropertyAnimated (target, propName, value, animate) {
    if (animate) {
      const { duration, easing } = animate;
      this.animationPromise = target.animate({ [propName]: value, duration, easing });
    } else {
      target[propName] = value;
    }
  }

  attachAnimated (duration = 0, container, easing) {
    if (this.active) return;
    this.container = container;
    this.active = true;
    container.layout = this;
    this.active = false;
    this.lastAnim = { duration, easing };
  }

  apply (animated) { // eslint-disable-line no-unused-vars
    if (this.active) return;
    this.active = true;
    this.submorphsChanged = false;
    this.lastBoundsExtent = this.container && this.container.bounds().extent();
    this.active = false;
  }

  resizesMorphVertically (aMorph) { // eslint-disable-line no-unused-vars
    return false;
  }

  resizesMorphHorizontally (aMorph) { // eslint-disable-line no-unused-vars
    return false;
  }

  /*
   * Called from position or extent getter inside a morph
   * if _askLayoutForBounds is set to true. This is in order
   * to *defer* expensive measuring of the dom up to the point
   * where the information is actually needed
   * (which is when the getter is invoked)
   * @param { Morph } morph - The layoutable submorph for which to update the bounds for.
   */
  updateBoundsFor () {

  }

  measureAfterRender (layoutableSubmorph) {
    if (!this.renderViaCSS) return;
    if (layoutableSubmorph.isText) {
      layoutableSubmorph.renderingState.needsFit = true;
    }
    layoutableSubmorph.renderingState.cssLayoutToMeasureWith = this;
  }
}

/**

  Tiling Layouts align morphs either horizontally or vertically,
  much like vertical or horizontal Layouts. The key difference is that they
  wrap the flow of the positioned morphs according to the size of the container.
  Essentially Tiling Layouts are just Vertical or Horizontal layouts that have
  wrapping enabled.
*/

export class TilingLayout extends Layout {
  constructor (props = {}) {
    super(props);
    this._renderViaCSS = typeof props.renderViaCSS !== 'undefined' ? props.renderViaCSS : true;
    this._axis = props.axis || 'row';
    this._align = props.align || 'left';
    this._axisAlign = props.axisAlign || 'left';
    this._justifySubmorphs = props.justifySubmorphs || 'packed';
    this._hugContentsVertically = props.hugContentsVertically || false;
    this._hugContentsHorizontally = props.hugContentsHorizontally || false;
    this._orderByIndex = props.orderByIndex || true;
    this._wrapSubmorphs = false;
    if (typeof props.wrapSubmorphs !== 'undefined') {
      this._wrapSubmorphs = props.wrapSubmorphs;
    }
    this._resizePolicies = props.resizePolicies || new WeakMap();
  }

  equals (other) {
    return this.__serialize__().__expr__ === (other && other.__serialize__().__expr__);
  }

  name () { return 'Tiling'; }

  __serialize__ () {
    // fixme: serialize padding as rect
    const rectSerializer = (anObject, ignoreSignal) => {
      if (anObject && anObject.isRectangle) { return anObject.toString(); } else return ignoreSignal;
    };
    return {
      __expr__: `new TilingLayout(${obj.inspect(this.getSpec(), {
        customPrinter: rectSerializer
      })})`,
      bindings: { 'lively.morphic': ['TilingLayout'], 'lively.graphics/geometry-2d.js': ['rect'] }
    };
  }

  attach () {
    this._initializingPolicies = true;
    this.initializeResizePolicies();
    this._initializingPolicies = false;
    super.attach();
    this.measureAfterRender(this.container);
  }

  ensureLayoutComputed (curr) {
    const origNode = this.ensureYogaNodeFor(curr);
    while (curr.owner?._yogaNode && curr.owner.layout && curr.isLayoutable) curr = curr.owner;
    curr._yogaNode.calculateLayout();
    return origNode;
  }

  ensureYogaNodeFor (aMorph) {
    return aMorph._yogaNode || (aMorph._yogaNode = Yoga.Node.create());
  }

  initializeResizePolicies () {
    const resizePolicies = this._resizePolicies;
    if (resizePolicies && !Array.isArray(resizePolicies)) return;
    const { layoutableSubmorphs } = this;
    this._resizePolicies = new WeakMap();
    if (Array.isArray(resizePolicies)) {
      resizePolicies.map(([morphName, policy]) => {
        const m = this.container.submorphs.find(m => m.name === morphName);
        if (m) this.setResizePolicyFor(m, policy);
        arr.remove(layoutableSubmorphs, m);
      });
      delete this._policiesSynthesized;
    } else {
      this.layoutableSubmorphs.forEach(m => {
        this.setResizePolicyFor(m, {
          width: 'fixed', height: 'fixed'
        });
      });
    }
  }

  scheduleApply (submorph, animation, change = {}) {
    if (change.prop === 'extent' &&
        !change.meta?.isLayoutAction &&
        this.renderViaCSS
    ) {
      this.computeBoundsOfEntireLayoutComposition();
      this.updateContainerBounds();
    }
    super.scheduleApply(submorph, animation, change);
  }

  get layoutableSubmorphs () {
    const layoutableSubmorphs = super.layoutableSubmorphs;
    if (this.renderViaCSS) return layoutableSubmorphs;
    else return layoutableSubmorphs.filter(m => m.visible);
  }

  get reactToSubmorphAnimations () {
    return this._reactToSubmorphAnimations;
  }

  set reactToSubmorphAnimations (v) {
    this._reactToSubmorphAnimations = v;
  }

  get resizePolicies () {
    return this.layoutableSubmorphs.map(m => [m.name, this._resizePolicies.get(m) || { width: 'fixed', height: 'fixed' }]);
  }

  set padding (padding) {
    this._padding = padding;
    this.onConfigUpdate();
  }

  get padding () { return this._padding; }

  /**
   * Returns a copy of the tile layout based on the spec.
   * @type {TileLayout}
   */
  copy () {
    return new this.constructor(this.getSpec());
  }

  sanitizeConfig (config) {
    const spec = {};
    for (let prop of obj.keys(config)) {
      switch (prop) {
        case 'resizePolicies':
          spec.resizePolicies = [...config.resizePolicies];
          break;
        case 'spacing':
          if (config.spacing !== 0) spec.spacing = config.spacing;
          break;
        case 'renderViaCSS':
          if (config.renderViaCSS !== true) spec.renderViaCSS = config.renderViaCSS;
          break;
        case 'axis':
          if (config.axis !== 'row') spec.axis = config.axis;
          break;
        case 'align':
          if (config.align !== 'left') spec.align = config.align;
          break;
        case 'axisAlign':
          if (config.axisAlign !== 'left') spec.axisAlign = config.axisAlign;
          break;
        case 'justifySubmorphs':
          if (config.justifySubmorphs !== 'packed') spec.justifySubmorphs = config.justifySubmorphs;
          break;
        case 'hugContentsVertically':
          if (config.hugContentsVertically !== false) spec.hugContentsVertically = true;
          break;
        case 'hugContentsHorizontally':
          if (config.hugContentsHorizontally !== false) spec.hugContentsHorizontally = true;
          break;
        case 'orderByIndex':
          if (config.orderByIndex !== false && config.renderViaCSS === false) spec.orderByIndex = true;
          break;
        case 'wrapSubmorphs':
          if (config.wrapSubmorphs !== false) spec.wrapSubmorphs = true;
          break;
        case 'padding':
          if (rect(0).equals(config.padding)) break;
          if (obj.isNumber(config.padding)) { spec.padding = rect(config.padding, config.padding); break; }
          if (!config.padding.isRectangle) { spec.padding = Rectangle.fromLiteral(config.padding); break; }
          spec.padding = config.padding;
          break;
        case 'reactToSubmorphAnimations':
          if (config.reactToSubmorphAnimations) spec.reactToSubmorphAnimations = true;
          break;
      }
    }
    return spec;
  }

  /**
   * Returns the current values of the layout's parameters as key-values.
   * Useful for safely copying layout objects.
   * @todo Also return the resizePolicies in a declarative manner.
   * @returns {TileLayoutSpec}
   */
  getSpec () {
    if (!this.container) return this.sanitizeConfig(this.config);
    if (Array.isArray(this._resizePolicies)) {
      this._initializingPolicies = true;
      this.initializeResizePolicies();
      this._initializingPolicies = false;
    }
    let {
      axis, align, axisAlign, spacing, orderByIndex, resizePolicies,
      reactToSubmorphAnimations, renderViaCSS, padding, wrapSubmorphs,
      justifySubmorphs,
      _hugContentsVertically: hugContentsVertically,
      _hugContentsHorizontally: hugContentsHorizontally
    } = this;
    const spec = this.sanitizeConfig({
      axis,
      align,
      axisAlign,
      spacing,
      orderByIndex: !renderViaCSS && orderByIndex,
      reactToSubmorphAnimations,
      renderViaCSS,
      padding,
      wrapSubmorphs,
      justifySubmorphs,
      hugContentsVertically,
      hugContentsHorizontally
    });
    // only set the ones different to the default value
    for (let [morphName, policy] of resizePolicies) {
      if (policy.width !== 'fixed' || policy.height !== 'fixed') {
        if (!spec.resizePolicies) spec.resizePolicies = [];
        spec.resizePolicies.push([morphName, { ...policy }]);
      }
    }
    if (!this._policiesSynthesized && this.config.resizePolicies) {
      spec.resizePolicies = [...this.config.resizePolicies];
      if (spec.resizePolicies.length === 0) delete spec.resizePolicies;
    }
    return spec;
  }

  get possibleAxisValues () { return ['row', 'column']; }
  get possibleAlignValues () { return ['left', 'center', 'right']; } // better for morphs: ['start', 'center', 'end'] ?

  /**
   * Defines how the positioned submorphs are to be ordered.
   * If set to false, the layoutable submorphs are ordered by their relative offset to the container.
   * If set to true, the layoutable submorphs are ordered by the index they are found at from their owner.
   * Warning: This property is not supported when the layout is rendered via CSS and defaults to true in this case.
   * @type {Boolean}
   */
  get orderByIndex () { return this._orderByIndex || this.renderViaCSS; }
  set orderByIndex (active) { this._orderByIndex = active; this.onConfigUpdate(); }

  /**
   * Defines the flow direction of the positioned morphs.
   * If set to "row", the morphs flow horizontally.
   * If set to "column" the morphs flow vertically.
   * @enum {string}
   */
  get axis () { return this._axis; }
  set axis (a) { this._axis = a; this.onConfigUpdate(); }

  /**
   * Defines how the morphs are positioned along their axis.
   * Possible values are floating to the "left", floating to the "right", or "centered".
   * @enum {string}
   */
  get align () { return this._align; }
  set align (a) { this._align = a; this.onConfigUpdate(); }

  /**
   * Defines how the axis themselves are distributed within the container.
   * By default the axis are floating to the "left". Other options: "right" or "centered".
   * @enum {string}
   */
  get axisAlign () { return this._axisAlign; }
  set axisAlign (a) {
    this._axisAlign = a; this.onConfigUpdate();
  }

  /**
   * Defines the space in pixels between the positioned submorphs.
   * @type {number}
   */
  get spacing () { return this._spacing; }
  set spacing (offset) {
    this._spacing = offset;
    this.onConfigUpdate();
  }

  /**
   * Defines wether or not the morphs are supposed to be wrapped
   * and lined up on multiple axis.
   * @type {Boolean}
   */
  get wrapSubmorphs () { return this._wrapSubmorphs; }
  set wrapSubmorphs (wrappingEnabled) {
    this._wrapSubmorphs = wrappingEnabled;
    this.onConfigUpdate();
  }

  /**
   * If set to true, the container auto adjusts its height to fit the content.
   * Warning: This property is inactive when wrapping is enabled AND the axis are columns. It also is inactive when none of the layoutable submorphs are set for their height to be fixed. The reason is that then there is no way for the layout to determine what height to hug to.
   * @type {Boolean}
   */
  get hugContentsVertically () {
    if (this.wrapSubmorphs && this.axis === 'column') return false;
    for (let m of this.layoutableSubmorphs) {
      if (!m.visible) continue;
      const h = this._resizePolicies.get(m)?.height;
      if (!h) continue;
      if (h === 'fill') return false;
    }
    return this._hugContentsVertically;
  }

  set hugContentsVertically (active) {
    this._hugContentsVertically = active;
    this.onConfigUpdate();
  }

  get stretchedVertically () {
    const { container } = this;
    if (
      container.owner?.layout?.name() === 'Tiling' &&
      container.owner.layout.getResizeHeightPolicyFor(container) === 'fill') return true;
    return false;
  }

  /**
   * If set to true, the container auto adjusts its width to fit the content.
   * Warning: This property is inactive when wrapping is enabled AND the axis are rows. It also is inactive when none of the layoutable submorphs are set for their width to be fixed. The reason is that then there is no way for the layout to determine what width to hug to.
   * @type {Boolean}
   */
  get hugContentsHorizontally () {
    if (this.wrapSubmorphs && this.axis === 'row') return false;
    for (let m of this.layoutableSubmorphs) {
      if (!m.visible) continue;
      const w = this._resizePolicies.get(m)?.width;
      if (!w) continue;
      if (w === 'fill') return false;
    }
    return this._hugContentsHorizontally;
  }

  set hugContentsHorizontally (active) {
    this._hugContentsHorizontally = active;
    this.onConfigUpdate();
  }

  get stretchedHorizontally () {
    const { container } = this;
    if (
      container.owner?.layout?.name() === 'Tiling' &&
      container.owner.layout.getResizeWidthPolicyFor(container) === 'fill') return true;
    return false;
  }

  /**
   * Defines the justificaton of submorphs:
   *   "packed": distributes the morphs along a chain as close as possible.
   *   "spaced": makes the morphs cover the entire possible axis they fit into.
   * @enum {string}
   */
  get justifySubmorphs () {
    return this._justifySubmorphs;
  }

  set justifySubmorphs (val) {
    this._justifySubmorphs = val;
    this.onConfigUpdate();
  }

  /**
   * Each submorph can define its own resizing policy, that is how its width and height
   * should respond with respect to the container. Fixed width/height will make the respective
   * submorph maintain its height/width. If set to fill, the submorph will fill the
   * container vertically/horizontally.
   *
   * Warning: When wrapping of submorphs is enabled, the policies for the morphs are disabled.
   *          This means that all morphs can only carry a fixed width/height since a fill behavior in any
   *          dimension would compromise the wrapping of morphs.
   */
  getResizeHeightPolicyFor (aLayoutableSubmorph) {
    const policy = this._resizePolicies.get(aLayoutableSubmorph) || { width: 'fixed', height: 'fixed' };
    return this.wrapSubmorphs ? 'fixed' : policy.height;
  }

  getResizeWidthPolicyFor (aLayoutableSubmorph) {
    const policy = this._resizePolicies.get(aLayoutableSubmorph) || { width: 'fixed', height: 'fixed' };
    return this.wrapSubmorphs ? 'fixed' : policy.width;
  }

  setResizePolicyFor (aLayoutableSubmorph, policy) {
    // policy : width = fixed/fill, height = fixed/fill
    if (Array.isArray(this._resizePolicies)) {
      let entry = this._resizePolicies.find(([name]) => aLayoutableSubmorph.name === name);
      if (entry) { entry[1] = policy; } else this._resizePolicies.push([aLayoutableSubmorph.name, policy]);
    } else {
      this._policiesSynthesized = true;
      this._resizePolicies.set(aLayoutableSubmorph, policy);
      this.onConfigUpdate();
    }
  }

  resizesMorphHorizontally (aMorph) {
    return this.getResizeWidthPolicyFor(aMorph) === 'fill';
  }

  resizesMorphVertically (aMorph) {
    return this.getResizeHeightPolicyFor(aMorph) === 'fill';
  }

  /**
   * Defines wether or not this specific layout object should be rendered via CSS
   * (therefore dispatching any layout ops to the browser stack) or manually computing
   * the submorph positions through JavaScript.
   * CSS renders generally have a much better performance but lack precision with regards
   * transitioning smoothly between different configurations (layout animations).
   * When you animate your layout operations it's best to set this property to false.
   * @type {Boolean}
   */
  get renderViaCSS () {
    return this._renderViaCSS;
  }

  set renderViaCSS (active) {
    this._renderViaCSS = active;
    this.onConfigUpdate();
  }

  get embeddedInTiling () {
    return this.container.owner?.layout?.name() === 'Tiling';
  }

  /**************
   * CSS LAYOUT *
   **************/

  /**
   * In reaction to changes in the DOM that have happend due to a
   * render pass, we update the morphic model to align with the
   * values in the DOM. Since we delegate the placement of morphs
   * to the browser, we need to confirm the definite bounds of
   * the layoutable submorphs from there.
   */
  onDomResize (node, morph) {} // eslint-disable-line no-unused-vars

  measureSubmorph () {} // do nothing

  onContainerResized (morph) {} // eslint-disable-line no-unused-vars

  onOwnerChanged (newOwner) {
    if (newOwner) return;
    this.container._yogaNode?.free();
    delete this.container._yogaNode;
    delete this.layoutableSubmorphBounds;
    this.container.submorphs.forEach(m => {
      m._yogaNode?.free();
      delete m._yogaNode;
    });
  }

  onContainerRender () {
    super.onContainerRender();
    if (this.renderViaCSS) {
      this.computeBoundsOfEntireLayoutComposition();
    }
  }

  /**
   * Invoked once a new morph is added to the container.
   * @override
   */
  onSubmorphAdded (submorph) {
    if (!this._resizePolicies.get(submorph)) {
      submorph.withMetaDo({ isLayoutAction: true }, () => {
        this.setResizePolicyFor(submorph, {
          width: 'fixed', height: 'fixed'
        });
      });
    }
  }

  /**
   * Invoked once a morph in the container has changed their bounds.
   * @override
   */
  onSubmorphResized (submorph, change) {
    if (this.renderViaCSS) {
      submorph = [submorph, ...submorph.ownerChain()].find(m => m.owner === this.container);
      if (submorph.isLayoutable) this.tryToMeasureNodeNow(submorph);
    } else super.onSubmorphResized(submorph, change);
  }

  onSubmorphRemoved (submorph) {
    this._resizePolicies.delete(submorph);
    // Ensure correct propagation of layout propert and adaption of resizePolicies.
    if (this.config.resizePolicies) { arr.remove(this.config.resizePolicies, this.config.resizePolicies.find(entry => entry[0] === submorph.name)); }
    this.container.layout = this.copy();
    this.container.renderingState.cssLayoutToMeasureWith = this.container.layout;
  }

  handleRenamingOf (oldName, newName) {
    this.config.resizePolicies = this.config.resizePolicies.map(([target, policy]) => {
      if (target === oldName) return [newName, policy];
      else return [target, policy];
    });
  }

  /**
   * Attempt an immediate measure of the morph's rendered node
   * to retrieve bounds from the DOM. If not possible, defer to
   * the next render pass.
   */
  tryToMeasureNodeNow (aSubmorph) {
    const node = this.getNodeFor(aSubmorph);
    if (node && this.orderByIndex) { // ordering via dragging does not really work nicely...
      this.updateSubmorphBounds(aSubmorph);
    } else {
      this.measureAfterRender(aSubmorph);
    }
  }

  updateSubmorphBounds (morph) {
    const node = this.ensureYogaNodeFor(morph);
    const newPosX = node.getComputedLeft();
    const newPosY = node.getComputedTop();
    const newWidth = node.getComputedWidth();
    const newHeight = node.getComputedHeight();
    const heightPolicy = this.getResizeHeightPolicyFor(morph);
    const widthPolicy = this.getResizeWidthPolicyFor(morph);

    if (newPosX !== morph.position.x || newPosY !== morph.position.y) {
      morph.withMetaDo({ isLayoutAction: true, skipRender: true }, () => morph.position = pt(newPosX, newPosY));
    }

    if (widthPolicy === 'fill' && String(newWidth) !== 'NaN' && newWidth !== morph.width) {
      morph.withMetaDo({ isLayoutAction: true, skipRender: false }, () => {
        morph.width = newWidth;
      });
    }
    if (heightPolicy === 'fill' && String(newHeight) !== 'NaN' && newHeight !== morph.height) {
      morph.withMetaDo({ isLayoutAction: true, skipRender: false }, () => morph.height = newHeight);
    }

    if (morph.layout && morph.layout.name() === 'Constraint') {
      morph.layout.applyRequests = true;
      morph.layout.forceLayout();
    }

    if (morph.layout && morph.layout.name() === 'Tiling') {
      // we also need to compute the layout here actually
      morph.layout.updateContainerBounds();
    }
  }

  updateContainerBounds () {
    const { container, hugContentsVertically, hugContentsHorizontally } = this;
    const node = this.ensureLayoutComputed(container);

    let width = node.getComputedWidth();
    let height = node.getComputedHeight();

    // fix the ones that where due to fill or fixed policies
    const heightSetting = node.getHeight();
    const widthSetting = node.getWidth();
    const isVisible = this.checkYogaNodeVisible(node);
    if (isVisible && !hugContentsVertically) {
      node.setHeight(height);
    }
    if (isVisible && !hugContentsHorizontally) {
      node.setWidth(width);
    }

    if (hugContentsVertically) {
      node.calculateLayout();
      height = node.getComputedHeight();
    }

    if (hugContentsHorizontally) {
      node.calculateLayout();
      width = node.getComputedWidth();
    }

    if (heightSetting.unit === 2) {
      node.setHeight(`${heightSetting.value}%`);
    }
    if (widthSetting.unit === 2) {
      node.setWidth(`${widthSetting.value}%`);
    }

    this.ensureLayoutComputed(container);

    // revert to the original

    if (this.container.submorphs.length > 0) {
      let updateTransform = false;
      if (hugContentsVertically && container.height !== height) {
        // container.height = height;
        container._morphicState.extent = container.extent.withY(height);
        updateTransform = true;
      }
      if (hugContentsHorizontally && container.width !== width) {
        // container.width = width;
        container._morphicState.extent = container.extent.withX(width);
        updateTransform = true;
      }
      if (updateTransform) container.updateTransform();
    }

    this.layoutableSubmorphs.forEach(m => {
      if (!m._yogaNode) return;
      this.updateSubmorphBounds(m);
    });
  }

  addSubmorphCSS (morph, style) {
    style['z-index'] = this.container.submorphs.indexOf(morph);
    let node = morph._yogaNode;
    if (!node) {
      node = this.updateSubmorphNode(morph);
    }
    if (!node._computedMargin) {
      node = this.updateSubmorphNode(morph);
    }
    if (!morph.isLayoutable) return;
    let margin = node._computedMargin;
    const { axis, layoutableSubmorphs } = this;
    const isVertical = axis === 'column';

    if (this.getResizeWidthPolicyFor(morph) === 'fill') {
      if (isVertical) {
        style.width = `calc(100% + ${margin.offset}px)`;
      } else {
        style.width = `calc(100% + ${margin.offset}px)`;
        style['flex-grow'] = 1;
        style['flex-shrink'] = 1;
      }
    }
    if (this.getResizeHeightPolicyFor(morph) === 'fill') {
      if (isVertical) {
        style.height = `calc(100% + ${margin.offset}px)`;
        style['flex-grow'] = 1; // let flex handle that
        style['flex-shrink'] = 1;
      } else {
        style.height = `calc(100% + ${margin.offset}px)`;
      }
    }
    style.position = 'relative';
    if (morph.owner && morph.owner.isText && morph.owner.embeddedMorphMap.get(morph)) {
      style.position = 'sticky';
    }
    style.top = 'unset';
    style.left = 'unset';
    style.order = layoutableSubmorphs.indexOf(morph); // already handled by the node ordering
    style['margin-top'] = `${margin.top}px`;
    style['margin-bottom'] = `${margin.bottom}px`;
    style['margin-left'] = `${margin.left}px`;
    style['margin-right'] = `${margin.right}px`;
    if (Number.parseInt(style['flex-grow']) !== 1) style['flex-shrink'] = 0;
  }

  adjustMargin (margin) {
    const { container, axis } = this;
    const isVertical = axis === 'column';
    if (isVertical) {
      margin.offset = container.borderWidthLeft + container.borderWidthRight;
    } else {
      margin.offset = container.borderWidthTop + container.borderWidthBottom;
    }
  }

  computeOffset () {
    const { container, axis } = this;
    const offset = { top: 0, bottom: 0, left: 0, right: 0 };
    const isVertical = axis === 'column';
    if (isVertical) {
      offset.top = container.borderWidthTop;
      offset.bottom = container.borderWidthBottom;
      offset.left = container.borderWidthLeft;
      offset.right = container.borderWidthRight;
    } else {
      offset.left = container.borderWidthLeft;
      offset.right = container.borderWidthRight;
      offset.top = container.borderWidthTop;
      offset.bottom = container.borderWidthBottom;
    }
    return offset;
  }

  computeBoundsOfEntireLayoutComposition (force = false) {
    if (!this.container.needsRerender() &&
        this.noLayoutActionNeeded &&
        this.container._yogaNode ||
        !this.container.visible) {
      return;
    }
    if (!force && this.embeddedInTiling) return;

    this.updateContainerNode();
    this.container.submorphs.forEach(m => {
      if (m.layout?.name() === 'Tiling') {
        m.layout.computeBoundsOfEntireLayoutComposition(true);
      }
      this.updateSubmorphNode(m);
    });
    this.updateContainerNode();
    this.refreshBoundsCache();
  }

  addContainerCSS (containerMorph, style) {
    const {
      axis, hugContentsHorizontally, hugContentsVertically,
      wrapSubmorphs, justifySubmorphs
    } = this;
    let node = containerMorph._yogaNode;
    if (!node) node = this.updateContainerNode();

    if (containerMorph.visible) {
      style.display = 'flex';
    }
    if (containerMorph.owner?.embeddedMorphMap?.has(containerMorph)) {
      containerMorph.renderingState.inlineFlexImportant = true;
    }
    style.gap = `${node.getGap(Yoga.GUTTER_ALL)}px`;

    style['justify-content'] = ({
      [Yoga.JUSTIFY_CENTER]: 'center',
      [Yoga.JUSTIFY_FLEX_START]: 'flex-start',
      [Yoga.JUSTIFY_FLEX_END]: 'flex-end'
    })[node.getJustifyContent()];

    style['flex-flow'] = axis;
    if (wrapSubmorphs) style['flex-flow'] += ' wrap';

    style['align-items'] = ({
      [Yoga.ALIGN_CENTER]: 'center',
      [Yoga.ALIGN_FLEX_START]: 'flex-start',
      [Yoga.ALIGN_FLEX_END]: 'flex-end'
    })[node.getAlignItems()];
    style['align-content'] = ({
      [Yoga.ALIGN_CENTER]: 'center',
      [Yoga.ALIGN_FLEX_START]: 'flex-start',
      [Yoga.ALIGN_FLEX_END]: 'flex-end'
    })[node.getAlignContent()];

    if (justifySubmorphs === 'spaced') {
      style['justify-content'] = 'space-between';
    }

    style['padding-top'] = `${node.getPadding(Yoga.EDGE_TOP).value}px`;
    style['padding-left'] = `${node.getPadding(Yoga.EDGE_LEFT).value}px`;
    style['padding-right'] = `${node.getPadding(Yoga.EDGE_RIGHT).value}px`;
    style['padding-bottom'] = `${node.getPadding(Yoga.EDGE_BOTTOM).value}px`;

    if (hugContentsHorizontally) {
      style.width = 'auto';
    }

    if (hugContentsVertically) {
      style.height = 'auto';
    }
  }

  checkYogaNodeVisible (node) {
    while (node) {
      if (node.getDisplay() === Yoga.DISPLAY_NONE) return false;
      node = node.getParent();
    }
    return true;
  }

  ensureYogaNodesInSync () {
    let { layoutableSubmorphs } = this;
    layoutableSubmorphs = layoutableSubmorphs.filter(m => m.visible);
    const containerNode = this.ensureYogaNodeFor(this.container);
    let i = 0; let resetNodes = layoutableSubmorphs.length !== containerNode.getChildCount();
    for (let m of layoutableSubmorphs) {
      if (this.ensureYogaNodeFor(m) !== containerNode.getChild(i++)) {
        resetNodes = true;
        break;
      }
    }
    if (resetNodes) {
      while (containerNode.getChildCount()) containerNode.removeChild(containerNode.getChild(0));
      i = 0;
      for (let m of layoutableSubmorphs) {
        let subNode = this.ensureYogaNodeFor(m); let danglingParent;
        if (danglingParent = subNode.getParent()) danglingParent.removeChild(subNode);
        containerNode.insertChild(subNode, i++);
      }
    }
  }

  hasBoundsConnection (morph) {
    return morph.attributeConnections && morph.attributeConnections.find(conn => {
      return ['position', 'extent', 'width', 'height'].includes(conn.sourceAttrName);
    });
  }

  delaySubmorphBounds () {
    this.layoutableSubmorphs.forEach(m => {
      if (this.hasBoundsConnection(m)) {
        this.measureAfterRender(m);
      } else if (m.isEllipse) {
        // fixme: There is still a rendering glitch which occurs due to the async nature of the virtual dom render  loop
        this.measureAfterRender(m);
      } else {
        m.renderingState.cssLayoutToMeasureWith = this; // only if this is confirmed by a resize observer
      }

      if (m.layout && m.layout.name() === 'Tiling') m.layout.delaySubmorphBounds();
    });
  }

  ensureResizePolicies (layoutableSubmorphs) {
    if (!layoutableSubmorphs.every(m => this._resizePolicies.has(m))) {
      this._resizePolicies = this.config.resizePolicies;
      const before = this._initializingPolicies;
      this._initializingPolicies = true;
      this.initializeResizePolicies();
      this._initializingPolicies = before;
    }
  }

  /*************
   * JS LAYOUT *
   *************/

  updateContainerNode () {
    const {
      axis, padding, _align: align, axisAlign,
      hugContentsHorizontally, hugContentsVertically,
      stretchedHorizontally, stretchedVertically,
      wrapSubmorphs, spacing, justifySubmorphs, container
    } = this;
    const yogaNode = this.ensureYogaNodeFor(container);
    this._configChanged = false;
    if (container.visible) {
      yogaNode.setDisplay(Yoga.DISPLAY_FLEX);
    } else {
      yogaNode.setDisplay(Yoga.DISPLAY_NONE);
    }
    const spacingOffset = axis === 'row'
      ? container.borderWidthLeft + container.borderWidthRight
      : container.borderWidthTop + container.borderWidthBottom;

    yogaNode.setGap(Yoga.GUTTER_ALL, spacing + spacingOffset);
    yogaNode.setBorder(Yoga.EDGE_TOP, container.borderWidthTop);
    yogaNode.setBorder(Yoga.EDGE_LEFT, container.borderWidthLeft);
    yogaNode.setBorder(Yoga.EDGE_BOTTOM, container.borderWidthBottom);
    yogaNode.setBorder(Yoga.EDGE_RIGHT, container.borderWidthRight);

    yogaNode.setJustifyContent(({
      left: Yoga.JUSTIFY_FLEX_START,
      center: Yoga.JUSTIFY_CENTER,
      right: Yoga.JUSTIFY_FLEX_END
    })[align]);
    yogaNode.setFlexDirection(axis === 'row' ? Yoga.FLEX_DIRECTION_ROW : Yoga.FLEX_DIRECTION_COLUMN);
    yogaNode.setFlexWrap(wrapSubmorphs ? Yoga.WRAP_WRAP : Yoga.WRAP_NO_WRAP);
    yogaNode.setAlignItems(({
      center: Yoga.ALIGN_CENTER,
      left: Yoga.ALIGN_FLEX_START,
      right: Yoga.ALIGN_FLEX_END
    })[axisAlign]);
    yogaNode.setAlignContent(({
      center: Yoga.ALIGN_CENTER,
      left: Yoga.ALIGN_FLEX_START,
      right: Yoga.ALIGN_FLEX_END
    })[axisAlign]);

    if (justifySubmorphs === 'spaced') {
      yogaNode.setJustifyContent(Yoga.JUSTIFY_SPACE_BETWEEN);
    }
    yogaNode.setPadding(Yoga.EDGE_TOP, padding.top());
    yogaNode.setPadding(Yoga.EDGE_LEFT, padding.left());
    yogaNode.setPadding(Yoga.EDGE_RIGHT, padding.right());
    yogaNode.setPadding(Yoga.EDGE_BOTTOM, padding.bottom());

    if (hugContentsHorizontally) {
      yogaNode.setWidthAuto();
    } else if (!stretchedHorizontally) {
      yogaNode.setWidth(container.width);
    }

    if (hugContentsVertically) {
      yogaNode.setHeightAuto();
    } else if (!stretchedVertically) {
      yogaNode.setHeight(container.height);
    }

    this.ensureYogaNodesInSync();
    this.updateContainerBounds();

    return yogaNode;
  }

  updateSubmorphNode (submorph) {
    const yogaNode = this.ensureYogaNodeFor(submorph);
    yogaNode.setPositionType(submorph.isLayoutable ? Yoga.POSITION_TYPE_RELATIVE : Yoga.POSITION_TYPE_ABSOLUTE);
    if (submorph.visible && submorph.isLayoutable) {
      yogaNode.setDisplay(Yoga.DISPLAY_FLEX);
    } else {
      yogaNode.setDisplay(Yoga.DISPLAY_NONE);
    }
    if (!submorph.isLayoutable) return yogaNode;
    const { axis } = this;
    const clip = submorph.clipMode !== 'visible';
    const isVertical = axis === 'column';
    yogaNode.setOverflow(clip ? Yoga.OVERFLOW_HIDDEN : Yoga.OVERFLOW_VISIBLE);
    this.updateSubmorphBounds(submorph); // in case fill behavior is present

    // however hug behavior is not considered above

    let bounds;
    let originOffset = pt(0, 0);

    // skip the bounds computation if nothing changed there
    if (clip) {
      bounds = rect(0, 0, submorph.width, submorph.height);
    } else {
      // this can lead to false conclusions if we are configured to fit vertically or horizontally
      bounds = submorph.submorphBounds().union(submorph.innerBounds());
    }

    if (submorph.scale !== 1) {
      bounds = bounds.withWidth(bounds.width * submorph.scale).withHeight(bounds.height * submorph.scale);
    }

    if (submorph.rotation !== 0) {
      // we also need to adjust the bounds themselves...
      const rotatedBounds = submorph.getInverseTransform().transformRectToRect(bounds);
      bounds.width = num.roundTo(rotatedBounds.width, 1);
      bounds.height = num.roundTo(rotatedBounds.height, 1);
      originOffset = submorph.bounds().topLeft().subPt(submorph.position).negated();
    }

    const offset = this.computeOffset(submorph);

    const margin = { top: 0, left: 0, bottom: 0, right: 0 };

    margin.top = Math.max(0, -bounds.top()) + originOffset.y - offset.top;
    margin.bottom = bounds.bottom() - submorph.height - originOffset.y - offset.bottom;
    margin.left = Math.max(0, -bounds.left()) + originOffset.x - offset.left;
    margin.right = bounds.right() - submorph.width - originOffset.x - offset.right;

    this.adjustMargin(margin, submorph);

    if (this.getResizeWidthPolicyFor(submorph) === 'fill') {
      if (isVertical) {
        yogaNode.setWidth('100%');
        margin.left = 0;
        margin.right = 0;
      } else {
        yogaNode.setWidth('100%');
        yogaNode.setFlexShrink(1);
        yogaNode.setFlexGrow(1);
      }
    } else {
      yogaNode.setWidth(submorph.width);
    }
    if (this.getResizeHeightPolicyFor(submorph) === 'fill') {
      if (isVertical) {
        yogaNode.setHeight('100%');
        yogaNode.setFlexGrow(1);
        yogaNode.setFlexShrink(1);
      } else {
        yogaNode.setHeight('100%');
        margin.bottom = 0;
        margin.top = 0;
      }
    } else {
      yogaNode.setHeight(submorph.height); // what if the text morph layout is fitting the morph here?
    }

    yogaNode.setMargin(Yoga.EDGE_TOP, margin.top);
    yogaNode.setMargin(Yoga.EDGE_BOTTOM, margin.bottom);
    yogaNode.setMargin(Yoga.EDGE_LEFT, margin.left);
    yogaNode.setMargin(Yoga.EDGE_RIGHT, margin.right);
    if (yogaNode.getFlexGrow() !== 1) yogaNode.setFlexShrink(0);
    yogaNode._computedMargin = margin;
    return yogaNode;
  }

  apply (animate = false) {
    if (this.active || !this.container || this.renderViaCSS) return;

    super.apply(animate);
    this.active = true;

    this.computeBoundsOfEntireLayoutComposition(true);
    const containerNode = this.container._yogaNode;

    const containerBounds = containerNode.getComputedLayout();
    this.changePropertyAnimated(this.container, 'width', containerBounds.width, animate);
    this.changePropertyAnimated(this.container, 'height', containerBounds.height, animate);
    this.layoutableSubmorphs.forEach(m => {
      const submorphBounds = m._yogaNode.getComputedLayout();
      this.changePropertyAnimated(m, 'width', submorphBounds.width, animate);
      this.changePropertyAnimated(m, 'height', submorphBounds.height, animate);
      this.changePropertyAnimated(m, 'position', pt(submorphBounds.left, submorphBounds.top), animate);
      m.makeDirty();
    });
    this.active = false;
  }

  oldApply (animate = false) {
    if (this.active || !this.container || this.renderViaCSS) return;

    this.active = true;
    super.apply(animate);

    const {
      container, axis, _align: align, spacing, axisAlign,
      layoutableSubmorphs, padding, wrapSubmorphs,
      justifySubmorphs, hugContentsVertically, hugContentsHorizontally
    } = this;
    const morphsToLayout = [...layoutableSubmorphs];
    this.ensureResizePolicies(morphsToLayout);
    const spaceSubmorphs = justifySubmorphs === 'spaced';
    const length = this.getOptimalWidth(container);
    const isHorizontal = axis === 'row';
    const lengthAccessor = isHorizontal ? 'left' : 'top';
    const normalizedLengthAccessor = isHorizontal ? 'x' : 'y';
    const normalizedBreadthAccessor = isHorizontal ? 'y' : 'x';
    let posAccessor;
    if (axisAlign === 'left') posAccessor = 'topLeft';
    if (axisAlign === 'right') posAccessor = 'topRight';
    if (axisAlign === 'center') posAccessor = isHorizontal ? 'leftCenter' : 'topCenter';
    let axisToPositions = [];
    let currentAxis;

    while (morphsToLayout.length) {
      let remainingLength = length + spacing;
      let morphsOnAxis = arr.takeWhile(morphsToLayout, m => {
        const ext = m.bounds().extent();
        const newLength = remainingLength - (Math.round(ext[normalizedLengthAccessor]) + spacing);
        if (wrapSubmorphs && newLength < 0) return false;
        remainingLength = newLength;
        return true;
      });

      if (morphsOnAxis.length > 0) morphsToLayout.splice(0, morphsOnAxis.length);
      else {
        morphsOnAxis = [morphsToLayout.shift()];
        remainingLength = 0;
      }

      // adjust width/height based on resize policy
      // this.wrapSubmorphs = false
      let fixedHeight = padding.top() + padding.bottom() - this.spacing;
      let fixedWidth = padding.left() + padding.right() - this.spacing;
      let numDynamic = 0;

      if (hugContentsVertically) {
        const huggedHeight = container.submorphBounds(m => layoutableSubmorphs.includes(m) && this.getResizeHeightPolicyFor(m) === 'fixed').height + padding.top() + padding.bottom();
        this.changePropertyAnimated(container, 'height', huggedHeight, animate);
      }

      if (hugContentsHorizontally) {
        const huggedWidth = container.submorphBounds(m => layoutableSubmorphs.includes(m) && this.getResizeWidthPolicyFor(m) === 'fixed').width + padding.left() + padding.right();
        this.changePropertyAnimated(container, 'width', huggedWidth, animate);
      }

      morphsOnAxis.forEach(m => {
        if (isHorizontal) {
          fixedWidth += this.spacing;
          if (this.getResizeHeightPolicyFor(m) === 'fill') {
            m.height = container.height - padding.top() - padding.bottom();
          }
          if (this.getResizeWidthPolicyFor(m) === 'fixed') {
            fixedWidth += m.width;
          } else numDynamic++;
        }
        if (!isHorizontal) {
          fixedHeight += this.spacing;
          if (this.getResizeWidthPolicyFor(m) === 'fill') {
            m.width = container.width - padding.left() - padding.right();
          }
          if (this.getResizeHeightPolicyFor(m) === 'fixed') {
            fixedHeight += m.height;
          } else numDynamic++;
        }
        this.forceLayoutsOfMorph(m);
      });

      // make the morphs occupy the flexible width remaining that fill in the direction of the axis
      morphsOnAxis.forEach(m => {
        if (isHorizontal && this.getResizeWidthPolicyFor(m) === 'fill') {
          m.width = Math.max(0, container.width - fixedWidth) / numDynamic;
        }
        if (!isHorizontal && this.getResizeHeightPolicyFor(m) === 'fill') {
          m.height = Math.max(0, container.height - fixedHeight) / numDynamic;
        }
      });

      let offset;

      axisToPositions.push(currentAxis = [
        arr.max(morphsOnAxis.map(m => m.bounds().extent()[normalizedBreadthAccessor]))
      ]);

      if (spaceSubmorphs) {
        let startPadding, endPadding;
        if (isHorizontal) {
          startPadding = padding.left();
          endPadding = padding.right();
        } else {
          startPadding = padding.top();
          endPadding = padding.bottom();
        }
        offset = startPadding;
        const totalLength = container.extent[normalizedLengthAccessor] - startPadding - endPadding;
        const emptySpace = totalLength - arr.sum(morphsOnAxis.map(m => m.bounds().extent()[normalizedLengthAccessor]));
        const bufferSpace = emptySpace / Math.max(1, morphsOnAxis.length - 1);
        for (const m of morphsOnAxis) {
          currentAxis.push([m, offset]);
          offset = offset + m.bounds().extent()[normalizedLengthAccessor] + bufferSpace;
        }
      } else {
        switch (align) {
          case 'left':
            offset = padding[lengthAccessor](); break;
          case 'center':
            offset = remainingLength / 2 + padding[lengthAccessor](); break;
          case 'right':
            offset = remainingLength + padding[lengthAccessor](); break; // ???
        }

        for (const m of morphsOnAxis) {
          currentAxis.push([m, num.roundTo(offset, 1)]);
          offset = offset + spacing + m.bounds().extent()[normalizedLengthAccessor];
        }
      }
    }

    let breadthOffsets = [];
    let currentOffset;

    if (this.axisAlign === 'center') {
      let totalBreadth = -spacing;
      axisToPositions.forEach(([axisBreadth]) => totalBreadth += axisBreadth + spacing);
      currentOffset = container.extent[normalizedBreadthAccessor] / 2 - totalBreadth / 2;
      axisToPositions.map(([axisBreadth]) => {
        breadthOffsets.push(currentOffset + axisBreadth / 2);
        currentOffset += axisBreadth + spacing;
      });
    }

    if (this.axisAlign === 'right') {
      currentOffset = container.extent[normalizedBreadthAccessor] - (isHorizontal ? padding.bottom() : padding.right());
      axisToPositions = axisToPositions.reverse();
      axisToPositions.map(([axisBreadth]) => {
        breadthOffsets.push(currentOffset);
        currentOffset -= axisBreadth + spacing;
      });
    }

    if (this.axisAlign === 'left') {
      currentOffset = isHorizontal ? padding.top() : padding.left();
      axisToPositions.map(([axisBreadth]) => {
        breadthOffsets.push(currentOffset);
        currentOffset += spacing;
        currentOffset += axisBreadth;
      });
    }

    axisToPositions.forEach(([_, ...morphOffsets], i) => { // eslint-disable-line no-unused-vars
      morphOffsets.forEach(([m, offset]) => {
        const pos = isHorizontal ? pt(offset, breadthOffsets[i]) : pt(breadthOffsets[i], offset);
        this.changePropertyAnimated(m, posAccessor, pos, animate);
      });
    });

    this.active = false;
    this.forceLayoutsInNextLevel();
  }

  forceLayout () {
    if (!this.renderViaCSS) { super.forceLayout(); }
  }

  getMinWidth () {
    const { layoutableSubmorphs, padding } = this;
    return layoutableSubmorphs.reduce((s, m) =>
      (m.bounds().width > s) ? m.bounds().width : s, 0) + padding.left() + padding.right();
  }

  getMinHeight () {
    const { layoutableSubmorphs, padding } = this;
    return layoutableSubmorphs.reduce((s, e) =>
      (e.bounds().height > s) ? e.bounds().height : s, 0) + padding.top() + padding.bottom();
  }

  getOptimalWidth (container) {
    const { axis, padding } = this;
    const width = axis === 'row'
      ? container.width - padding.left() - padding.right()
      : container.height - padding.top() - padding.bottom();
    const maxSubmorphWidth = axis === 'row' ? this.getMinWidth() : this.getMinHeight();
    return Math.max(width, maxSubmorphWidth);
  }

  layoutOrder (morph) {
    // the following creates a drop zone that is 15 pixels tall.
    // allows for horizontal reordering.
    if (this.orderByIndex) return this.container.getProperty('submorphs').indexOf(morph);
    return this.axis === 'row' ? (morph.top - morph.top % 15) * 1000000 + morph.left : (morph.left - morph.left % 15) * 1000000 + morph.top;
  }
}

export class ConstraintLayout extends Layout {
  name () { return 'Constraint'; }
  description () { return 'Resizes, scales, and moves morphs according to their original position.'; }

  constructor (props) {
    super(props);
    this._morphConfigurations = new Map();
    this._renderViaCSS = typeof props.renderViaCSS !== 'undefined' ? props.renderViaCSS : true;
    this.extentDelta = pt(0, 0);
    this.constraintLayoutSettingsForMorphs = new WeakMap();
    this.submorphSettings = (props && props.submorphSettings) || [];
    this.lastExtent = props.lastExtent;
    delete this.spacing;
  }

  attach () {
    super.attach();
    this.layoutableSubmorphs.forEach(m => this.ensureConfigForMorph(m));
  }

  scheduleApply (submorph, animation, change = {}) {
    if (change.prop === 'extent' &&
        !change.meta?.isLayoutAction &&
        this.renderViaCSS) {
      this.layoutableSubmorphs.forEach(m => this.measureAfterRender(m));
    }

    super.scheduleApply(submorph, animation, change);
  }

  /**
   * Defines wether or not this specific layout object should be rendered via CSS
   * (therefore dispatching any layout ops to the browser stack) or manually computing
   * the submorph positions through JavaScript.
   * CSS renders generally have a much better performance but lack precision with regards
   * transitioning smoothly between different configurations (layout animations).
   * When you animate your layout operations it's best to set this property to false.
   * @type {Boolean}
   */
  get renderViaCSS () {
    return this._renderViaCSS;
  }

  set renderViaCSS (active) {
    this._renderViaCSS = active;
    this.onConfigUpdate();
  }

  addContainerCSS (containerMorph, style) { // eslint-disable-line no-unused-vars
    // container css is not really affected, since the constraint layout only
    // controls the submorphs
    this._configChanged = false;
  }

  ensureConfigForMorph (aMorph) {
    if (!this._morphConfigurations) this._morphConfigurations = new Map();
    let config = this._morphConfigurations.get(aMorph);
    if (config) return config;
    config = this.getConfigFor(aMorph);
    this._morphConfigurations.set(aMorph, config);
    return config;
  }

  getConfigFor (aMorph) {
    const left = aMorph.position.x;
    const top = aMorph.position.y;
    const right = this.container.width - (aMorph.position.x + aMorph.width);
    const bottom = this.container.height - (aMorph.position.y + aMorph.height);
    const leftProportion = left / this.container.width * 100;
    const rightProportion = right / this.container.width * 100;
    const topProportion = top / this.container.height * 100;
    const bottomProportion = bottom / this.container.height * 100;
    return {
      left,
      top,
      right,
      bottom,
      leftProportion,
      rightProportion,
      topProportion,
      bottomProportion
    };
  }

  // It is not wise for a CSS based layout to base the configuration
  // on external state, such as the morphic properties or the state in the DOM
  // Instead the CSS needs to be computed based on the internal layout configuration. The layout needs to keep an internal configuration for each morph, that is updated manually in response to changes.
  addSubmorphCSS (aMorph, style) {
    const { x, y } = this.settingsFor(aMorph);
    const border = this.container.borderWidth;
    const {
      left, top, right, bottom,
      leftProportion, rightProportion, topProportion, bottomProportion
    } = this.ensureConfigForMorph(aMorph);

    switch (x) {
      case 'fixed':
        style.left = left - border.left + 'px';
        break;
      case 'resize':
        style.left = left - border.left + 'px';
        style.width = 'auto';
        style.right = right - border.right + 'px';
        break;
      case 'move':
        style.left = 'unset';
        style.right = right - border.right + 'px';
        break;
      case 'center':
        style.left = `calc(${leftProportion}% - ${aMorph.width / 2}px)`;
        break;
      case 'scale':
        style.width = 'auto';
        style.left = leftProportion + '%';
        style.right = rightProportion + '%';
        break;
    }

    switch (y) {
      case 'fixed':
        style.top = top - border.top + 'px';
        break;
      case 'resize':
        style.top = top - border.top + 'px';
        style.height = 'auto';
        style.bottom = bottom - border.bottom + 'px';
        break;
      case 'move':
        style.top = 'unset';
        style.bottom = bottom - border.bottom + 'px';
        break;
      case 'center':
        style.top = `calc(${topProportion}% - ${aMorph.height / 2}px)`;
        break;
      case 'scale':
        style.height = 'auto';
        style.top = topProportion + '%';
        style.bottom = bottomProportion * 100 + '%';
        break;
    }
  }

  onDomResize (node, morph) {
    if (morph === this.container || !this.layoutableSubmorphs.includes(morph)) {
      return;
    }
    morph.withMetaDo({ isLayoutAction: true }, () => {
      this.updateSubmorphViaDom(morph, node, true);
    });
  }

  updateSubmorphViaDom (morph, node, makeDirty = false) {
    const { borderWidth } = this.container;
    const newPosX = Math.floor(node.offsetLeft) + borderWidth.left;
    const newPosY = Math.floor(node.offsetTop) + borderWidth.top;
    const newWidth = Math.floor(node.offsetWidth);
    const newHeight = Math.floor(node.offsetHeight);
    const { x, y } = this.settingsFor(morph);
    let updateTransform = false;
    const horizontallyResized = ['resize', 'scale'].includes(x);
    const verticallyResized = ['resize', 'scale'].includes(y);
    if (newPosX !== morph.position.x ||
        newPosY !== morph.position.y) {
      if (makeDirty) {
        morph.position = pt(newPosX, newPosY);
      } else {
        morph._morphicState.position = pt(newPosX, newPosY);
        updateTransform = true;
        signal(morph, 'position', morph.position); // still notify connections
      }
    }
    // also update the extent if the resize policy is not fixed!
    if (newWidth !== morph.width && horizontallyResized) {
      if (makeDirty) morph.width = newWidth;
      else {
        morph._morphicState.extent = morph.extent.withX(newWidth);
        updateTransform = true;
        signal(morph, 'extent', morph.extent);
      }
    }
    if (newHeight !== morph.height && verticallyResized) {
      if (makeDirty) morph.height = newHeight;
      else {
        morph._morphicState.extent = morph.extent.withY(newHeight);
        updateTransform = true;
        signal(morph, 'extent', morph.extent); // does not update the halo!
      }
    }

    if (morph.layout && morph.layout.renderViaCSS) {
      morph.layout.onDomResize(node, morph);
    }

    if (updateTransform) {
      // trigger the halo if needed
      morph.updateTransform();
    }
  }

  getSpec () {
    if (!this.container) return this.config;
    const submorphSettings = [];
    for (let m of this.layoutableSubmorphs) {
      const settings = this.settingsFor(m);
      if (settings.x === 'fixed' && settings.y === 'fixed') continue;
      submorphSettings.push([m.name, settings]);
    }
    return {
      submorphSettings,
      reactToSubmorphAnimations: this.reactToSubmorphAnimations,
      lastExtent: this.lastExtent
    };
  }

  __serialize__ () {
    return {
      __expr__: `new ConstraintLayout(${obj.inspect(this.getSpec())})`,
      bindings: { 'lively.morphic': ['ConstraintLayout'] }
    };
  }

  get __dont_serialize__ () { return [...super.__dont_serialize__, 'extentDelta', 'lastExtent']; }

  __after_deserialize__ (snapshot, ref) { // eslint-disable-line no-unused-vars
    const { _submorphSettings, container } = this;
    const map = this.constraintLayoutSettingsForMorphs || new WeakMap();
    this.extentDelta = pt(0, 0);
    if (!_submorphSettings || !container) return;
    for (const [ident, setting] of _submorphSettings) {
      const [morph] = this._morphsMatchingSelector(container, ident);
      morph && map.set(morph, setting);
    }
    this.constraintLayoutSettingsForMorphs = map;
  }

  adjustConfigViaExtentDelta (config, delta) {
    config.right -= delta.x;
    config.bottom -= delta.y;
    config.rightProportion = config.right / this.container.width * 100;
    config.bottomProportion = config.bottom / this.container.height * 100;
  }

  adjustConfigViaPositionDelta (config, delta) {
    config.left += delta.x;
    config.right -= delta.x;
    config.top += delta.y;
    config.bottom -= delta.y;
    config.rightProportion = config.right / this.container.width * 100;
    config.bottomProportion = config.bottom / this.container.height * 100;
    config.leftProportion = config.left / this.container.width * 100;
    config.topProportion = config.top / this.container.height * 100;
  }

  onSubmorphChange (submorph, change) {
    if (change.prop === 'name') {
      const settings = this.constraintLayoutSettingsForMorphs.get(submorph);
      if (settings) this.changeSettingsFor(submorph, settings, true);
    }
    if (change.prop === 'extent' &&
        !change.value.equals(change.prevValue)) {
      if (change.meta?.isLayoutAction) this.measureAfterRender(submorph);
      else {
        let config = this._morphConfigurations?.get(submorph);
        if (config) {
          this.adjustConfigViaExtentDelta(config, change.value.subPt(change.prevValue));
        }
      }
    }
    if (change.prop === 'position' &&
        !change.value.equals(change.prevValue)) {
      if (change.meta?.isLayoutAction) this.measureAfterRender(submorph);
      else {
        let config = this._morphConfigurations?.get(submorph);
        if (config) {
          this.adjustConfigViaPositionDelta(config, change.value.subPt(change.prevValue));
        }
      }
    }

    return super.onSubmorphChange(submorph, change);
  }

  handleRenamingOf (submorph) {
    // nothing to be done any more
  }

  settingsFor (morph) {
    // move, resize, scale, fixed, center
    const settings = this.constraintLayoutSettingsForMorphs.get(morph);
    return settings || { x: 'fixed', y: 'fixed' };
  }

  changeSettingsFor (morph, mergin, save = false) {
    if (typeof mergin === 'string') mergin = { x: mergin, y: mergin };
    this.constraintLayoutSettingsForMorphs
      .set(morph, { ...this.settingsFor(morph), ...mergin });
    if (save) {
      const settings = this.submorphSettings.filter(ea => ea[0] !== morph.name);
      settings.push([morph.name, this.settingsFor(morph)]);
      this._submorphSettings = settings;
    }
  }

  get submorphSettings () { return this._submorphSettings; }
  set submorphSettings (submorphSettings) {
    if (!this.container) {
      once(this, 'container', this, 'submorphSettings',
        { converter: 'function () { return submorphSettings }', varMapping: { submorphSettings } });
      return;
    }
    this._submorphSettings = submorphSettings;
    this.changeSubmorphSettings(submorphSettings);
  }

  changeSubmorphSettings (submorphSettings) {
    for (const [morphSelector, setting] of submorphSettings) {
      const morphs = this._morphsMatchingSelector(this.container, morphSelector);
      morphs.forEach(m => this.changeSettingsFor(m, setting));
    }
  }

  _morphsMatchingSelector (container, selector) {
    let morphs = [];
    if (!selector) return morphs;
    if (selector.isMorph) {
      morphs = [selector];
    } else if (selector instanceof RegExp) {
      morphs = container.submorphs.filter(ea => ea.name.match(selector));
    } else if (typeof selector === 'string') {
      morphs = container.submorphs.filter(ea => ea.name === selector);
    } else if (Array.isArray(selector)) {
      morphs = selector.flatMap(sel => this._morphsMatchingSelector(container, sel));
    }
    return morphs;
  }

  refreshBoundsCache () {
    const { container: { extent }, lastExtent } = this;
    if (lastExtent && !extent.eqPt(lastExtent)) { this.extentDelta = this.extentDelta.addPt(extent.subPt(lastExtent)); }
    this.lastExtent = extent.copy();
    this.layoutableSubmorphBounds = this.layoutableSubmorphs.map(m => m.bounds());
  }

  apply (animate = false, requireExtentChange = true) {
    const { container, active, extentDelta: { x: deltaX, y: deltaY }, renderViaCSS } = this;
    const { extent } = container || {};
    if (active || !container || (requireExtentChange && deltaX === 0 && deltaY === 0) || renderViaCSS) { return; }

    this.extentDelta = pt(0, 0);
    this.active = true;
    super.apply(animate);

    const { layoutableSubmorphs } = this;

    const scalePt = extent.scaleByPt(extent.addXY(-deltaX, -deltaY).invertedSafely());
    for (const m of layoutableSubmorphs) {
      const { x, y } = this.settingsFor(m);
      let moveX = 0; let moveY = 0; let resizeX = 0; let resizeY = 0;

      if (x === 'move') moveX = deltaX;
      if (y === 'move') moveY = deltaY;
      if (x === 'resize') resizeX = deltaX;
      if (y === 'resize') resizeY = deltaY;

      if (x === 'center') moveX = m.center.x * scalePt.x - m.center.x;
      if (y === 'center') moveY = m.center.y * scalePt.y - m.center.y;

      if (x === 'scale' || y === 'scale') {
        const morphScale = pt(
          x === 'scale' ? scalePt.x : 1,
          y === 'scale' ? scalePt.y : 1);
        this.changePropertyAnimated(m, 'position', m.position.scaleByPt(morphScale), animate);
        this.changePropertyAnimated(m, 'extent', m.extent.scaleByPt(morphScale), animate);
      }

      if (moveX || moveY) { this.changePropertyAnimated(m, 'position', m.position.addXY(moveX, moveY), animate); }
      if (resizeX || resizeY) { this.changePropertyAnimated(m, 'extent', m.extent.addXY(resizeX, resizeY), animate); }
    }

    this.forceLayoutsInNextLevel();

    // this.lastExtent = extent;
    this.active = false;
  }

  copy () {
    return new this.constructor(this.getSpec()); // no container
  }
}

/**
 * @typedef {String} GridAlign
 **/

/**
 * A CellGroup is a collection of one or multiple cells. These can cover multiple rows/columns.
 * Every cell group is responsible for at most a single morph. The group than manages this morph
 * by enforcing its bounds/position in that morph accordinly.
 */
export class CellGroup {
  /**
   * Create a new CellGroup.
   */
  constructor ({ cell, morph, layout, align, resize = layout.fitToCell }) {
    this.state = { cells: [cell], layout, align, resize };
    layout && layout.addGroup(this);
    this.morph = morph;
  }

  /**
   * Wether or not to automatically resize the controlled morph to fit the bounds of the group.
   * @property
   * @type { Boolean }
   */
  get resize () { return this.state.resize; }
  set resize (forceBounds) { this.state.resize = forceBounds; this.layout.apply(); }

  /**
   * The direction the morph floats to within the group. This matters when the group is
   * not actively resizing the morph.
   * @property
   * @type { GridAlign }
   */
  get align () { return this.state.align || 'topLeft'; }
  set align (orientation) {
    this.state.align = orientation;
    this.layout.apply();
  }

  /**
   * The are that is covered by the group. This are is not represented in pixels
   * but instead the bordering rows, columns and padding.
   * @property
   * @readonly
   * @type { CellBounds }
   */
  get area () {
    let minCol, maxCol, minRow, maxRow;
    this.cells.map(cell => {
      const colIdx = cell.before.length;
      if (minCol === undefined || minCol > colIdx) minCol = colIdx;
      if (maxCol === undefined || maxCol < colIdx) maxCol = colIdx;

      const rowIdx = cell.above.length;
      if (minRow === undefined || minRow > rowIdx) minRow = rowIdx;
      if (maxRow === undefined || maxRow < rowIdx) maxRow = rowIdx;
    });

    const tl = this.layout.row(minRow).col(minCol).padding;
    const br = this.layout.row(maxRow).col(maxCol).padding;

    return {
      minCol,
      maxCol,
      minRow,
      maxRow,
      padding: Rectangle.inset(tl.left(), tl.top(), br.right(), br.bottom())
    };
  }

  /**
   * The morph that the CellGroup controls. This can be either a direct reference or
   * the name of the controlled morph, which is then dynamically resolved.
   * @property
   * @type { Morph|String }
   */
  get morph () {
    const { morph, layout } = this.state;
    if (morph) {
      if (morph.isMorph) return morph;
      return layout.layoutableSubmorphs.find(m => m.name === morph);
    }
    return null;
  }

  set morph (value) {
    const conflictingGroup = value && this.layout.getCellGroupFor(value);
    if (conflictingGroup) {
      conflictingGroup.morph = null;
    }
    this.state.morph = value;
    this.layout.apply();
  }

  /**
   * Check if a given morph is actually controlled by this CellGroup.
   * @param { Morph } morph - The morph to check for.
   * @returns { Boolean }
   */
  manages (morph) {
    return this.morph && (this.morph === morph || this.morph.name === morph);
  }

  /**
   * Adjust the position and size of the controlled morph as needed.
   * @param { Animation } animate - Animation config to perform the application with animated transitions.
   */
  apply (animate = false) {
    const target = this.morph;
    if (target) {
      const bounds = this.bounds();
      const offset = this.layout.container.origin.negated();
      if (animate) {
        const extent = this.resize ? bounds.extent() : target.extent;
        const { duration, easing } = animate;
        target.animate({
          [this.alignedProperty || this.align]: bounds[this.align]().addPt(offset),
          extent,
          duration,
          easing
        });
      } else {
        if (this.resize && !target.extent.equals(bounds.extent())) target.extent = bounds.extent();
        target[this.alignedProperty || this.align] = bounds[this.align]().addPt(offset);
      }
      this.layout.forceLayoutsInNextLevel();
    }
  }

  /**
   * Get all the cells comprised by the CellGroup.
   * @property
   * @readonly
   * @type { LayoutCell[] }
   */
  get cells () { return this.state.cells; }

  /**
   * Get the layout this group belongs to.
   * @property
   * @readonly
   * @type { LayoutGrid }
   */
  get layout () { return this.state.layout; }

  /**
   * Returns the bounds of the group measured in pixels as a rectangle.
   * @returns { Rectangle }
   */
  bounds () {
    if (this.cells.length > 0) {
      return this.cells
        .map(cell => cell.bounds())
        .reduce((a, b) => a.union(b));
    } else {
      return rect(0, 0, 0, 0);
    }
  }

  /**
   * Check if a given cell is part of the group.
   * @param { LayoutCell } cell - The cell to check for.
   * @returns { Boolean }
   */
  includes (cell) {
    return !!this.cells.find(c => c === cell);
  }

  /**
   * Add a given cell to this group
   * @param { LayoutCell } cell - The cell to add to this group.
   */
  connect (cell) {
    // connect partial row and col ?
    if (this.morph === undefined || this.morph === null) {
      this.morph = cell.group.morph;
    }
    if (cell.group) {
      cell.group.disconnect(cell, this);
    } else {
      cell.group = this;
    }
    this.cells.push(cell);
  }

  /**
   * Remove a given cell from this group.
   * @param { LayoutCell } cell - The cell to add to this group.
   * @param { LayoutGroup } newGroup - The new group the removed cell should belong to. If none is provided a new one is created.
   */
  disconnect (cell, newGroup = new CellGroup({ morph: null, layout: this.layout, cell })) {
    cell.group = newGroup;
    arr.remove(this.cells, cell);
    if (this.cells.length < 1 && this.layout) this.layout.removeGroup(this);
  }

  /**
   * Merge with another group thereby incorporating all of the other's cells.
   * @param { LayoutGroup } otherGroup - The group to merge with.
   */
  merge (otherGroup) {
    otherGroup.cells.forEach(c => {
      this.connect(c);
    });
  }

  /**
   * The top left most cell of the CellGroup.
   * @property
   * @readonly
   * @type { LayoutCell }
   */
  get topLeft () {
    return this.cells.find(cell =>
      (cell.left === null || cell.left.group !== this) &&
        (cell.top === null || cell.top.group !== this));
  }

  /**
   * The bottom right most cell of the CellGroup.
   * @property
   * @readonly
   * @type { LayoutCell }
   */
  get bottomRight () {
    return this.cells.find(cell =>
      (cell.right === null || cell.right.group !== this) &&
        (cell.bottom === null || cell.bottom.group !== this));
  }

  /**
   * The position of the CellGroup derived from the top left most cell.
   * @property
   * @readonly
   * @type { Point }
   */
  get position () {
    return this.topLeft.position;
  }
}

/**
 * An axis combines the concept of rows and columns.
 * Each row or column (axis) defines its width or height
 * (its length) by an absolute number of pixels.
 * An Axis can be either fixed or proportional.
 * Proportional axis adjust their width
 * upon change of the container's extent.
 * This is done by computing the ratio of the the
 * axis' length to to the containers width or height
 * that is made up of proportional axis respectively.
 * The ratio is then used to compute the new adjusted
 * width of the column in turn. This saves us from
 * juggling with ratios and absolute values and mediate between
 * fixed and proportional axis more easily.
 */
class LayoutAxis {
  /**
   * Creates a LayoutAxis.
   * @params { LayoutCell } cell - Cell to be used as the origin of the axis.  This can be actually any cell pf the axis.
   */
  constructor (cell) {
    this.origin = cell;
  }

  /**
   * Gets all the other axes of the same kind the precede and proceed this axis.
   * @property
   * @readonly
   * @type { LayoutAxis[] }
   */
  get otherAxis () {
    return [...this.axisBefore, ...this.axisAfter];
  }

  /**
   * Gets all the axes the preceed this axis.
   * @property
   * @readonly
   * @type { LayoutAxis[] }
   */
  get axisBefore () {
    let curr = this; let res = [];
    while (curr = curr.before) res = [curr, ...res];
    return res;
  }

  /**
   * Gets all the axes the proceed this axis.
   * @property
   * @readonly
   * @type { LayoutAxis[] }
   */
  get axisAfter () {
    let curr = this; let res = [];
    while (curr = curr.after) res = [...res, curr];
    return res;
  }

  /**
   * The axis right before.
   * @property
   * @readonly
   * @abstract
   * @type { LayoutAxis|null }
   */
  get before () { throw Error('before() not implemented!'); }

  /**
   * The axis right after.
   * @property
   * @readonly
   * @abstract
   * @type { LayoutAxis|null }
   */
  get after () { throw Error('after() not implemented!'); }

  /**
   * The length in pixels of the container along the dimension of the axis.
   * @property
   * @type { Number }
   */
  get containerLength () { return this.container[this.dimension]; }
  set containerLength (length) { this.container[this.dimension] = length; }

  /**
   * Returns the root, i.e. the top left cell of a grid.
   * @returns { LayoutCell }
   */
  getRoot () {
    return (this.axisBefore[0] || this).items[0];
  }

  /**
   * The container morph the layout belongs to.
   * @property
   * @readonly
   * @type { Morph }
   */
  get container () { return this.origin.container; }
  /**
   * The grid layout this axis belongs to.
   * @property
   * @readonly
   * @type { GridLayout }
   */
  get layout () { return this.origin.layout; }

  /**
   * If set to frozen the axis rejects any changes to the length as long as they
   * are below the min threshold.
   * @todo Do we really need a property for this basic logic?
   * @property
   * @type { boolean }
   */
  get frozen () { return this.origin.frozen[this.dimension]; }
  set frozen (active) { this.origin.frozen[this.dimension] = active; }

  /**
   * Write to this property to set the align for all groups covered by this
   * axis to a particular align.
   * @see CellGroup.align
   * @property
   * @writeonly
   * @type { String }
   */
  set align (align) {
    this.items.forEach(c => c.group.state.align = align);
  }

  /**
   * Defines wether or not the axis is fixed along its dimension.
   * This means that the axis always maintains its defined length
   * regardless of how the container resizes.
   * For convenience, if fixed is set to a number value, fixed is set to be true
   * and the length of the axis is set to be that passed number. This also triggers
   * a readjustments of the other axes' proportion.
   * @property
   * @type { boolean }
   */
  get fixed () { return this.origin.fixed[this.dimension]; }
  set fixed (active) {
    let newLength, containerLength;
    if (obj.isNumber(active)) {
      newLength = active;
      active = true;
    }
    this.items.forEach(c => {
      c.fixed[this.dimension] = active;
    });
    containerLength = this.containerLength;
    if (newLength !== undefined) this[this.dimension] = newLength;
    this.adjustOtherProportions(active);
    this.containerLength = containerLength; // force length
  }

  /**
   * Defines the length of the axis in pixels. This is always an absolute value.
   * They way it is adjusted however is dictated by properties such as 'proportion'
   * or 'fixed' and 'min'.
   * @property
   * @type { Number }
   */
  get length () { return this.origin[this.dimension]; }
  set length (x) {
    this.items.forEach(cell => {
      cell[this.dimension] = num.roundTo(x, 1);
    });
  }

  /**
   * Defines the proportion the length of the axis occupies among the dynamic
   * length of the container. This value is utilized to derive the new length
   * of the axis once the container is getting resized.
   * @property
   * @type { Number }
   */
  get proportion () { return this.origin.proportion[this.dimension]; }
  set proportion (prop) {
    this.items.forEach(cell => {
      cell.proportion[this.dimension] = prop;
    });
  }

  /**
   * Defines the minimum length of the axis in pixels.
   * If this is set to a value greater than 0 the axis will block
   * any resizing attempt that would shrink the axis length below that value.
   * This therefore overrides resizing attempts to maintain the proportion of the axis.
   * @property
   * @type { Number }
   */
  get min () { return this.origin.min[this.dimension]; }
  set min (x) { this._adjustMin(x - this.min); }

  _adjustMin (delta) {
    this.items.forEach(c => {
      if (c.min[this.dimension] + delta < 0) {
        c.min[this.dimension] = 0;
      } else if (c.min[this.dimension] + delta > c[this.dimension]) {
        c.min[this.dimension] += delta;
      } else {
        c.min[this.dimension] += delta;
      }
    });
    this.layout.apply();
  }

  /*
   In order to be numerically stable (lengths go to very small values or 0)
   axis and cells need to store their dynamic proportion which is used in turn to
   compute their current length.
   Proportions are ONLY updated when one of the following things happen:
   1. An axis becomes or stops being fixed.
   2. An axis reaches its minimum length
   3. An axis adjusts its length via the width or height property
   4. A new axis is introduced to the grid
  */

  adjustOtherProportions (remove) {
    const before = this.axisBefore; const after = this.axisAfter;
    const dynamicProportions = arr.sum([...before, ...after].filter(a => !a.fixed).map(a => a.proportion));
    const removeOwnProportion = c => c.proportion = c.proportion / dynamicProportions;
    const insertOwnProportion = c => c.proportion = c.proportion * this.origin.removedDynamicProportions;
    if (remove) this.origin.removedDynamicProportions = dynamicProportions;
    before.forEach(remove ? removeOwnProportion : insertOwnProportion);
    after.forEach(remove ? removeOwnProportion : insertOwnProportion);
  }

  /**
   * Adjust the length of the axis based on the proportion of the axis.
   * @params { Number } newContainerLength - The new length of the container along the axis' length dimension.
   */
  adjustLengthToProportion (newContainerLength) {
    const newLength = this.proportion * Math.max(0, newContainerLength - this.staticLength);
    if (this.frozen && newLength >= this.min) {
      this.frozen = false;
      this.fixed = false;
      this.length = newLength;
    } else if (!this.frozen && this.min > newLength) {
      this.frozen = true;
      this.fixed = true;
      this.length = this.min;
    }
    return this;
  }

  /**
   * Just setting the length property of an axis itself does not suffice to preserve
   * the soundness of the grid layout as a whole. In order to preserve the proportions
   * we need to adjust other axis as well. This method encapsulates all that logic.
   * @params { Number } delta - The amount to adjust the length of the axis in pixels.
   */
  adjustLength (delta) {
    let nextDynamicAxis;
    if (this.length + delta < 0) { // trunkate delta
      delta = -this.length;
    }
    if (nextDynamicAxis = this.axisAfter.find(axis => !axis.fixed)) {
      delta = Math.min(delta, nextDynamicAxis.length);
      this.length += delta;
      nextDynamicAxis.length -= delta;
      this.adjustProportion();
      nextDynamicAxis.adjustProportion();
    } else {
      // we are either the last axis
      nextDynamicAxis = this.axisBefore.reverse().find(axis => !axis.fixed);
      if (nextDynamicAxis) {
        nextDynamicAxis.length -= delta;
        this.length += delta;
        this.adjustProportion();
        nextDynamicAxis.adjustProportion();
      } else {
        // or there are no axis to steal from
        this.length += delta;
        this.adjustProportion();
        this.otherAxis.forEach(a => a.adjustProportion());
        this.containerLength += delta;
      }
    }
  }

  /**
   * Convenience method for deriving the axis proportion based on its current length relative
   * to the total dynamic length of the container.
   */
  adjustProportion () {
    if (!this.fixed) this.proportion = this.dynamicLength > 0 ? this.length / this.dynamicLength : 0;
  }

  /**
   * Convenience method for equally distributing the dynamic length of the container among
   * all of the dynamic axes.
   */
  equalizeDynamicAxis () {
    const dynamicAxis = [...this.otherAxis.filter(a => !a.fixed), ...this.fixed ? [] : [this]];
    const l = (this.containerLength - this.staticLength) / dynamicAxis.length;
    dynamicAxis.map(a => {
      if (!a.fixed) a.length = l;
      return a;
    }).forEach(a => a.adjustProportion());
  }

  /**
   * Create a new empty axis and insert it in front of this axis into the grid.
   */
  addBefore () {
    const newAxis = this.emptyAxis();
    this.before && this.before.attachTo(newAxis);
    newAxis.attachTo(this);
    this.equalizeDynamicAxis();
    this.layout.grid = this.getRoot();
  }

  /**
   * Create a new empty axis and insert it next to this axis into the grid.
   */
  addAfter () {
    const newAxis = this.emptyAxis();
    this.after && newAxis.attachTo(this.after);
    this.attachTo(newAxis);
    this.equalizeDynamicAxis();
    this.layout.grid = this.getRoot();
  }

  /**
   * Creates a new empty axis of this kind.
   * @abstract
   * @returns { LayoutAxis }
   */
  emptyAxis () {
    fun.notYetImplemented('emptyAxis');
  }
}

/**
 * Represents a single column of a GridLayout.
 * @extends LayoutAxis
 */
export class LayoutColumn extends LayoutAxis {
  constructor (cell) {
    super(cell);
    this.items = [...cell.above, cell, ...cell.below];
  }

  get dimension () { return 'width'; }

  get before () { return this._before || (this._before = this.origin.left && new LayoutColumn(this.origin.left)); }
  get after () { return this._after || (this._after = this.origin.right && new LayoutColumn(this.origin.right)); }

  row (idx) { return this.items[idx]; }

  get dynamicLength () { return this.origin.dynamicWidth; }
  get staticLength () { return this.origin.totalStaticWidth; }

  get width () { return this.length; }
  set width (w) {
    const delta = w - this.width;
    if (this.fixed) {
      this.length += delta;
      this.container.width += delta;
    } else {
      this.adjustLength(delta);
    }
    if (this.layout.renderViaCSS) {
      this.layout.patchContainer();
      this.layout.measureMorphsIn(this, this.after);
    }
    !this.layout.manualUpdate && this.layout.apply();
  }

  set paddingLeft (left) {
    this.items.forEach(c => {
      c.padding.x = left;
    });
    this.layout.apply();
  }

  get paddingLeft () { return this.items[0].padding.x; }

  set paddingRight (right) {
    this.items.forEach(c => {
      c.padding.width = right;
    });
    this.layout.apply();
  }

  get paddingRight () { return this.items[0].padding.width; }

  emptyAxis () {
    const col = new LayoutColumn(new LayoutCell({ // eslint-disable-line no-use-before-define
      column: arr.withN(this.items.length, null),
      layout: this.layout
    }));
    arr.zip(col.items, this.items).forEach(([n, o]) => {
      n.height = o.height;
      n.fixed.height = o.fixed.height;
      n.frozen.height = o.frozen.height;
      n.proportion.height = o.proportion.height;
      n.min.height = o.min.height;
    });
    return col;
  }

  attachTo (col) {
    this.after && (this.after._before = null);
    this._after = null;
    arr.zip(this.items, col.items)
      .forEach(([a, b]) => {
        a.right = b;
        b.left = a;
      });
    this.equalizeDynamicAxis();
    return col;
  }

  remove () {
    const a = this.before || this.after;
    this.items.forEach(c => {
      if (c.left) c.left.right = c.right;
      if (c.right) c.right.left = c.left;
      c.group.disconnect(c);
      this.layout.removeGroup(c.group);
    });
    this.before && (this.before._after = null);
    this.after && (this.after._before = null);
    if (!this.before) {
      this.layout.grid = this.after.getRoot();
    }
    a.equalizeDynamicAxis();
  }
}

/**
 * Represents a single row of a GridLayout.
 * @extends LayoutAxis
 */
export class LayoutRow extends LayoutAxis {
  constructor (cell) {
    super(cell);
    this.items = [...cell.before, cell, ...cell.after];
  }

  get dimension () { return 'height'; }

  emptyAxis () {
    const row = new LayoutRow(new LayoutCell({ // eslint-disable-line no-use-before-define
      row: arr.withN(this.items.length, null),
      layout: this.layout
    }));

    arr.zip(row.items, this.items).forEach(([n, o]) => {
      n.width = o.width;
      n.fixed.width = o.fixed.width;
      n.frozen.width = o.frozen.width;
      n.proportion.width = o.proportion.width;
      n.min.width = o.min.width;
    });
    return row;
  }

  set paddingTop (top) {
    this.items.forEach(c => {
      c.padding.y = top;
    });
    this.layout.apply();
  }

  get paddingTop () { return this.items[0].padding.y; }

  set paddingBottom (bottom) {
    this.items.forEach(c => {
      c.padding.height = bottom;
    });
    this.layout.apply();
  }

  get paddingBottom () { return this.items[0].padding.height; }

  get before () { return this._before || (this._before = this.origin.top && new LayoutRow(this.origin.top)); }
  get after () { return this._after || (this._after = this.origin.bottom && new LayoutRow(this.origin.bottom)); }

  get dynamicLength () { return this.origin.dynamicHeight; }
  get staticLength () { return this.origin.totalStaticHeight; }

  attachTo (row) {
    this.after && (this.after._before = null);
    this._after = null;
    arr.zip(this.items, row.items)
      .forEach(([a, b]) => {
        a.bottom = b;
        b.top = a;
      });
    this.equalizeDynamicAxis();
    return row;
  }

  col (idx) { return this.items[idx]; }

  get height () { return this.length; }
  set height (h) {
    const delta = h - this.height;
    if (this.fixed) {
      this.length += delta;
      this.container.height += delta;
    } else {
      this.adjustLength(delta);
      this.proportion = this.origin.dynamicHeight > 0 ? this.height / this.origin.dynamicHeight : 0;
    }
    if (this.layout.renderViaCSS) {
      this.layout.patchContainer();
      this.layout.measureMorphsIn(this, this.after);
    }
    !this.layout.manualUpdate && this.layout.apply();
  }

  remove () {
    const a = this.before || this.after;
    this.items.forEach(c => {
      if (c.top) c.top.bottom = c.bottom;
      if (c.bottom) c.bottom.top = c.top;
      c.group.disconnect(c);
      this.layout.removeGroup(c.group);
    });
    this.before && (this.before._after = null);
    this.after && (this.after._before = null);
    if (!this.before) {
      this.layout.grid = this.after.getRoot();
    }
    a.equalizeDynamicAxis();
  }
}

/**
 * Represents a single cell of a GridLayout.
 */
export class LayoutCell {
  /**
   * Creates a LayoutCell.
   * Recursively creates other cells as needed
   * to fully initialize a grid as specified.
   */
  constructor ({
    row, column,
    top, left, right, bottom,
    layout
  }) {
    let group, rv, cv;
    ([rv, ...row] = row || []);
    ([cv, ...column] = column || []);

    this.layout = layout;
    this.fixed = { width: false, height: false };
    this.frozen = { width: false, height: false };
    this.min = { width: 0, height: 0 };
    this.top = top; this.left = left;
    this.bottom = bottom; this.right = right;

    this.padding = rect(0, 0, 0, 0);

    if (row.length > 0) {
      this.right = new LayoutCell({ row, left: this, layout });
    } else if (column.length > 0) {
      this.bottom = new LayoutCell({ column, top: this, layout });
    }

    this.proportion = {
      width: 1 / (1 + this.before.length + this.after.length),
      height: 1 / (1 + this.above.length + this.below.length)
    };

    this.height = this.container.height * this.proportion.height;
    this.width = this.container.width * this.proportion.width;

    if (group = layout && layout.getCellGroupFor(rv || cv)) {
      group.connect(this);
    } else {
      this.group = new CellGroup({ cell: this, morph: rv || cv, layout });
    }
  }

  /**
   * Derived property to retrieve the container of the layout the cell belongs to.
   * @property
   * @type { Morph }
   */
  get container () { return this.layout.container; }

  /**
   * Retrieve all cells that are above the cell. (vertically)
   * @property
   * @readonly
   * @type { LayoutCell[] }
   */
  get above () { return this.collect({ neighbor: 'top', prepend: true }); }

  /**
   * Retrieve all cells that are below the cell. (vertically)
   * @property
   * @readonly
   * @type { LayoutCell[] }
   */
  get below () { return this.collect({ neighbor: 'bottom', append: true }); }

  /**
   * Retrieve all cells that come before the cell. (horizontally)
   * @property
   * @readonly
   * @type { LayoutCell[] }
   */
  get before () { return this.collect({ neighbor: 'left', prepend: true }); }

  /**
   * Retrieve all cells that come after the cell. (horizontally)
   * @property
   * @readonly
   * @type { LayoutCell[] }
   */
  get after () { return this.collect({ neighbor: 'right', append: true }); }

  /**
   * Collect all of the cells neighbors given a particular direction.
   * @param { String } args.neighbor - The direction along which to collect the neighboring cells.
   * @param { Boolean } args.prepend - Retrieve the cells in the reverse order they were retreived.
   * @param { Boolean } args.append - Retrieve the cells in the order they were retreived.
   * @returns { LayoutCell[] }
   */
  collect ({ neighbor, prepend, append }) {
    let items = []; let curr = this;
    while (curr = curr[neighbor]) {
      if (prepend) items = [curr, ...items];
      if (append) items = [...items, curr];
    }
    return items;
  }

  /**
   * Get the column at a given index.
   * The reason this is also implemented in cells
   * is so that we can store a reference to the grid by pointing to the top left cell
   * and then retrieve all rows/columns/cells from there.
   * @param { Number } idx - The (absolute) index of the column to retrieve.
   * @throws Will throw an error if no column at the specified index exists.
   * @returns { LayoutColumn }
   */
  col (idx) {
    let cell = this; let i = idx;
    while (i > 0 && cell) {
      cell = cell.right;
      i--;
    }
    if (!cell) throw Error(`${idx} out of bounds! Last column was ${idx - i - 1}`);
    return new LayoutColumn(cell);
  }

  /**
   * Get the row at a given index.
   * @param { Number } idx - The (absolute) index of the row to retrieve.
   * @returns { LayoutRow }
   */
  row (idx) {
    let cell = this; let i = idx;
    while (i > 0 && cell) {
      cell = cell.bottom;
      i--;
    }
    if (!cell) throw Error(`${idx} out of bounds! Last row was ${idx - i - 1}`);
    return new LayoutRow(cell);
  }

  /**
   * Returns true if the columns width is configured to be fixed or the width has reached
   * the minimum allowance.
   * @property
   * @readonly
   * @type { Boolean }
   */
  get staticWidth () { return this.fixed.width || (this.min.width === this.width); }

  /**
   * Returns true if the columns height is configured to be fixed or the height has reached
   * the minimum allowance.
   * @property
   * @readonly
   * @type { Boolean }
   */
  get staticHeight () { return this.fixed.height || (this.min.height === this.height); }

  /**
   * Collects all cells along the horizontal axis of this cell (i.e. row)
   * and returns the total static width of all of those cells combined.
   * @property
   * @readonly
   * @type { Number }
   */
  get totalStaticWidth () {
    return arr.sum(
      [this, ...this.before, ...this.after]
        .filter(c => c.staticWidth)
        .map(c => c.width)
    );
  }

  /**
   * Collects all cells along the vertical axis of this cell (i.e. column)
   * and returns the total static height of all of those cells combined.
   * @property
   * @readonly
   * @type { Number }
   */
  get totalStaticHeight () {
    return arr.sum(
      [this, ...this.above, ...this.below]
        .filter(c => c.staticHeight)
        .map(c => c.height)
    );
  }

  /**
   * Collects all cells along the horizontal axis of this cell (i.e. row)
   * and returns the total dynamic width of them all combined. Dynamic widths
   * are such that are not fixed to a certain size in pixels and stretch horizontally
   * according to the proportion of the respective column.
   * @property
   * @readonly
   * @type { Number }
   */
  get dynamicWidth () {
    return arr.sum(
      [this, ...this.before, ...this.after]
        .filter(c => !c.staticWidth)
        .map(c => c.width)
    );
  }

  /**
   * Collects all cells along the vertical axis of this cell (i.e. column)
   * and returns the total dynamic height of them all combined. Dynamic heights
   * are such that are not fixed to a certain size in pixels and stretch vertically
   * according to the proportion of the respective row.
   * @property
   * @readonly
   * @type { Number }
   */
  get dynamicHeight () {
    return arr.sum([this, ...this.above, ...this.below]
      .filter(c => !c.staticHeight)
      .map(c => c.height));
  }

  /**
   * Defines the height of the cell in pixels.
   * Heights of cells are always absolute regardless of dynamic or fixed height.
   * The height is dictated from the row that owns the cell.
   * @property
   * @type { Number }
   */
  get height () { return Math.max(this.min.height, this._height || 0); }
  set height (h) {
    this._height = h;
  }

  /**
   * Defines the width of the cell in pixels.
   * Widths of cells are always absolute regardless of dynamic or fixed width.
   * The width is dictated from the column that owns the cell.
   * @property
   * @type { Number }
   */
  get width () { return Math.max(this.min.width, this._width || 0); }
  set width (w) {
    this._width = w;
  }

  /**
   * Retrive the computed height and width of the cell in one.
   * @property
   * @readonly
   * @type { Point }
   */
  get extent () {
    return pt(this.width, this.height);
  }

  /**
   * Returns the position of the cell.
   * A cell's position is always derived from the extends of the neighboring cells
   * so this property can not be set.
   * @property
   * @readonly
   * @type { Point }
   */
  get position () {
    return pt(arr.sum(this.before.map(c => c.width)),
      arr.sum(this.above.map(c => c.height)));
  }

  /**
   * Returns the bounds of the cell.
   * Derived from the extent, position and padding of the cell.
   * @returns { Point }
   */
  bounds () {
    return this.position.addPt(this.padding.topLeft())
      .extent(this.extent.subPt(this.padding.extent())
        .subPt(this.padding.topLeft()));
  }
}

/**
 * Aligns the submorphs alongside a configurable grid.
 * Columns and rows and be configured to have different proportional,
 * minimal or fixed sizes. Cells can further be grouped such that
 * submorphs fill up multiple slots of the grid.
 * @extends Layout
 */
export class GridLayout extends Layout {
  /**
   * Create a GridLayout.
   * @param { GridLayoutConfig }
   */
  constructor (config) {
    super(config);
    this._renderViaCSS = typeof config.renderViaCSS !== 'undefined' ? config.renderViaCSS : true;
    config = { autoAssign: true, fitToCell: true, ...config };
    this.cellGroups = [];
  }

  forceLayout () {
    if (!this.renderViaCSS) { super.forceLayout(); }
  }

  /**
   * Returns the name of this layout.
   * @return { String }
   */
  name () { return 'Grid'; }

  /**
   * @override Ensure that grid is initialized when rendering via CSS.
   */
  attach () {
    if (this.renderViaCSS) this.initGrid();
    else super.attach();
  }

  /**
   * Disable the layout if enabled.
   * @override
   */
  disable () {
    // Ensure that we revert to JS based layout during being disabled.
    // This is because we can not "disable" CSS layouts.
    // The layout automatically switches back to CSS rendering on being enabled.
    if (this.renderViaCSS) {
      this.renderViaCSS = false;
      this._revertToCSSOnEnable = true;
      this.apply(); // ensure proper initialization
    }
    super.disable();
  }

  /**
   * Enables the layout if disabled.
   * @override
   */
  async enable (anim) {
    await super.enable(anim);
    if (anim) await promise.delay(anim.duration);
    // If we were disabled as a CSS layout, revert back to that state.
    if (this._revertToCSSOnEnable) {
      this.renderViaCSS = true;
      this.layoutableSubmorphs.forEach(m => this.tryToMeasureNodeNow(m));
      delete this._revertToCSSOnEnble;
    }
  }

  /**
   * Copy this layout via spec.
   * @return { GridLayout }
   */
  copy () {
    return new this.constructor(this.getSpec());
  }

  /**
   * Returns a spec that allows us to reconstruct the grid layout.
   * @return { GridLayoutSpec }
   */
  getSpec () {
    if (!this.container) return this.config;
    const grid = [];
    const rows = [];
    const columns = [];
    const groups = {};
    for (const r of arr.range(0, this.rowCount - 1)) {
      grid.push(this.grid.row(r).items.map(item =>
        item.group.state.morph ? item.group.state.morph.name || item.group.state.morph : null));
    }
    for (const r of arr.range(0, this.rowCount - 1)) {
      const row = this.grid.row(r);
      const rowSpec = row.fixed
        ? {
            fixed: row.length
          }
        : {
            height: row.height
          };
      if (row.paddingTop) { rowSpec.paddingTop = row.paddingTop; }
      if (row.paddingBottom) { rowSpec.paddingBottom = row.paddingBottom; }
      rows.push(r, rowSpec);
    }
    for (const c of arr.range(0, this.columnCount - 1)) {
      const col = this.grid.col(c);
      const colSpec = {
        ...(col.fixed
          ? {
              fixed: col.length
            }
          : {
              width: col.width
            })
      };
      if (col.paddingLeft) { colSpec.paddingLeft = col.paddingLeft; }
      if (col.paddingRight) { colSpec.paddingRight = col.paddingRight; }
      columns.push(c, colSpec);
    }

    for (const cell of this.cellGroups) {
      if (cell.state.morph) {
        groups[typeof cell.state.morph === 'string' ? cell.state.morph : cell.morph.name] = obj.select(cell, ['align', 'resize']);
      }
    }
    return { autoAssign: false, grid, rows, columns, groups };
  }

  /**
   * Serialize this layout as an expression based on the spec.
   * @override
   * @return { SerializableExpression }
   */
  __serialize__ () {
    return {
      __expr__: `new GridLayout(${obj.inspect(this.getSpec(), { escapeKeys: true })})`,
      bindings: { 'lively.morphic': ['GridLayout'] }
    };
  }

  /**
   * Initialize the grid based on the config.
   */
  initGrid () {
    const grid = this.sanitizeGrid(this.config);
    const rows = grid.map(row => new LayoutRow(new LayoutCell({ row, layout: this })));
    rows.reduce((a, b) => a.attachTo(b));
    this.config.autoAssign && this.autoAssign(this.notInLayout);
    this.grid = rows[0].col(0);
    this.col(0).equalizeDynamicAxis();
    this.row(0).equalizeDynamicAxis();
    this._initRowsAndColumns();
    this._initGroups();
  }

  _initGroups () {
    const { groups } = this.config;
    if (groups) {
      for (const g in groups) {
        const group = this.getCellGroupFor(this.container.getSubmorphNamed(g));
        const { resize, align = 'topLeft', alignedProperty = 'topLeft' } = groups[g];
        if (!group) continue;
        if (resize !== undefined) group.resize = resize;
        group.align = align;
        group.alignedProperty = alignedProperty;
      }
    }
  }

  _initRowsAndColumns () {
    let { rows = false, columns = false } = this.config;
    const ignore = ['height', 'width', 'fixed'];

    rows = rows ? arr.toTuples(rows, 2) : [];
    columns = columns ? arr.toTuples(columns, 2) : [];
    for (let [idx, props] of rows) {
      if (typeof props.fixed !== 'undefined') this.row(idx).fixed = true;
      if (obj.isNumber(props.fixed)) props.length = props.fixed;
      if (typeof props.height !== 'undefined') props.length = props.height;
    }
    for (let [idx, props] of columns) {
      if (typeof props.fixed !== 'undefined') this.col(idx).fixed = true;
      if (obj.isNumber(props.fixed)) props.length = props.fixed;
      if (typeof props.width !== 'undefined') props.length = props.width;
    }

    for (let [idx, props] of rows) {
      Object.assign(this.row(idx), obj.dissoc(props, ignore));
    }
    for (let [idx] of rows) {
      this.row(idx).adjustProportion();
    }

    for (let [idx, props] of columns) {
      Object.assign(this.col(idx), obj.dissoc(props, ignore));
    }
    for (let [idx] of columns) {
      this.col(idx).adjustProportion();
    }
  }

  /**
   * Global toggle to make each cell enforce its bounds on the controlled morph.
   * @property
   * @type { boolean }
   */
  get fitToCell () { return this.config.fitToCell; }
  set fitToCell (fit) {
    this.config.fitToCell = fit;
    this.cellGroups.forEach(g => g.resize = fit);
    this.apply();
  }

  /**
   * Get all the morphs that are not controlled by the layout.
   * @property
   * @readonly
   * @type { Morph[] }
   */
  get notInLayout () {
    return arr.withoutAll(
      this.layoutableSubmorphs,
      this.cellGroups.map(g => g.morph));
  }

  /**
   * Retrieve the column at a given index.
   * @param { Number } idx - The index of the column requested.
   * @return { LayoutColumn }
   */
  col (idx) { return this.grid.col(idx); }

  /**
   * Retrieve the row at a given index.
   * @param { Number } idx - The index of the row requested.
   * @return { LayoutRow }
   */
  row (idx) { return this.grid.row(idx); }

  /**
   * Get the total number of rows in the layout.
   * @property
   * @readonly
   * @type { Number }
   */
  get rowCount () { return this.grid.col(0).items.length; }

  /**
   * Get the total number of columns in the layout.
   * @property
   * @readonly
   * @type { Number }
   */
  get columnCount () { return this.grid.row(0).items.length; }

  /**
   * Add a given initialized CellGroup to the layout.
   * @param { CellGroup } group - The CellGroup to add to the layout.
   */
  addGroup (group) {
    this.cellGroups.push(group);
  }

  /**
   * Remove a given CellGroup from the layout. This will remove the morphs that belong
   * to that group from the layout as well.
   * @param { CellGroup } group - The CellGroup to remove from the layout.
   */
  removeGroup (group) {
    arr.remove(this.cellGroups, group);
  }

  /**
   * For a given morph return the CellGroup that this morph belongs to.
   * Returns null if no group can be found.
   * @param { Morph } morph - The morph to find the cell group for.
   * @return { CellGroup | null }
   */
  getCellGroupFor (morph) {
    return morph && this.cellGroups.find(g => g.morph === morph);
  }

  /**
   * Detect wether or not one of the layoutable submorph's bounds has changed
   * and we are required to reapply the layout.
   * @property
   * @readonly
   * @type { boolean }
   */
  get submorphBoundsChanged () {
    for (const g of this.cellGroups) {
      if (g.morph && !g.bounds().equals(g.morph.bounds())) {
        return true;
      }
    }
    return false;
  }

  /**
   * Convenience method that accepts a representation of a grid (declarative or instantiated)
   * and returns a instanciated version of this grid where all references to morphs are resolved
   * to direct references.
   * @param { (Morph|String)[][] } args.grid - A description of the grid and how the cells are allocated.
   * @param { Number } args.rowCount - Total number of rows.
   * @param { Number } args.columnCount - Total number of columns.
   * @returns { Morph[][] } - An instantiated grid.
   */
  sanitizeGrid ({ grid, rowCount, columnCount }) {
    grid = grid || [[]];
    rowCount = rowCount || grid.length;
    columnCount = columnCount || arr.max(grid.map(row => row.length));

    if (grid.length < rowCount) {
      grid = grid.concat(arr.withN(rowCount - grid.length, []));
    }

    grid = grid.map(row => {
      if (row.length < columnCount) { row = row.concat(arr.withN(columnCount - row.length, null)); }
      return row.map(v => {
        if (v && v.isMorph) {
          if (v.owner !== this.container) this.container.addMorph(v);
          return v;
        }
        if (v) return this.container.getSubmorphNamed(v) || v;
        return v;
      });
    });
    return grid;
  }

  /**
   * Convenience method that automatically assigns morphs to the closest cells that are not yet managed
   * by this Grid Layout.
   * @param { Morph[] } morphs - A set of submorphs of the container that are supposed to be assigned.
   */
  autoAssign (morphs) {
    morphs.forEach(m => {
      let currentlyClosestCellGroup;
      let closestDist = Infinity;
      this.cellGroups.forEach(cellGroup => {
        if (!cellGroup.morph) {
          cellGroup.cells.forEach(c => {
            const distToCell = c.position.dist(m.position);
            if (distToCell < closestDist) {
              currentlyClosestCellGroup = cellGroup;
              closestDist = distToCell;
            }
          });
        }
      });
      if (currentlyClosestCellGroup) currentlyClosestCellGroup.morph = m;
    });
  }

  /*************
   * JS LAYOUT *
   *************/

  /**
   * Implements the JavaScript based logic for the Grid Layout.
   * @override
   */
  apply (animate = false) {
    if (this.active || this.renderViaCSS) return;
    this.active = true;
    super.apply(animate);
    if (!this.grid) this.initGrid();
    // fit dynamic rows and cols
    this.fitAxis();
    this.container.extent = pt(Math.max(this.grid.totalStaticWidth, this.container.width),
      Math.max(this.grid.totalStaticHeight, this.container.height));
    this.fitAxis();
    this.cellGroups.forEach(g => {
      g && g.apply(animate);
    });
    this.lastBoundsExtent = this.container.bounds().extent();
    this.active = false;
  }

  /**
   * Routine to distribute the remaining dynamic space among the left
   * dynamic axes once the total fixed space has been determined.
   * This is usally called in response to a resized container.
   */
  fitAxis () {
    let totalStaticHeight;
    let totalStaticWidth;
    [this.grid.row(0), ...this.grid.row(0).axisAfter].map(r => {
      r.adjustLengthToProportion(this.container.height);
      totalStaticHeight = this.grid.totalStaticHeight;
      return r;
    }).forEach(r => {
      if (!r.fixed) r.length = r.proportion * Math.max(0, this.container.height - totalStaticHeight);
    });
    [this.grid.col(0), ...this.grid.col(0).axisAfter].map(c => {
      c.adjustLengthToProportion(this.container.width);
      totalStaticWidth = this.grid.totalStaticWidth;
      return c;
    }).forEach(c => {
      if (!c.fixed) c.length = c.proportion * Math.max(0, this.container.width - totalStaticWidth);
    });
  }

  /**************
   * CSS LAYOUT *
   **************/

  /**
   * Defines how the layout is supposed to be reified.
   * If set to true, the layout hands of the implementation of the layouting to the browser DOM.
   * This has huge performance benefits, since we avoid interference with javascript and css layouts
   * and allow the browser to optimize the layouts internally, which is usually faster than running
   * through Javascript.
   * @property
   * @type { boolean }
   */
  set renderViaCSS (active) {
    this._renderViaCSS = active;
    this.layoutableSubmorphs.forEach(m => m.makeDirty());
  }

  get renderViaCSS () {
    return this._renderViaCSS;
  }

  /**
   * Grid layouts are not affected by submorphs just being added. They need to be manually assigned to groups.
   * @todo Check how figma handles this kind of layout and copy if it makes sense.
   * @override
   * @param { Morph } submorph - The submorph that is added and now part of the layout.
   * @param { AnimationConfig } [animation] - If addition was animated, the params for this animation is provided here.
   */
  onSubmorphAdded (submorph, animation) {
    super.onSubmorphAdded(submorph, animation);
    if (this.renderViaCSS) {
      this.measureAfterRender(submorph);
    }
  }

  onChange (change) {
    super.onChange(change);
    if (change.prop === 'extent' && this.renderViaCSS) {
      this.cellGroups.forEach(g => g.morph && this.measureAfterRender(g.morph));
    }
  }

  /**
   * Grid layouts are affected when a submorph is removed. This always removes the morph
   * from the layout if he was part of it.
   * @override
   * @param { Morph } removedMorph - The submorph removed from the layout.
   * @param { AnimationConfig } [animation] - If removal was animated, the params for this animation is provided here.
   */
  onSubmorphRemoved (removedMorph, animation) {
    const cellGroup = this.getCellGroupFor(removedMorph);
    if (cellGroup) cellGroup.morph = null;
    super.onSubmorphRemoved(removedMorph, animation);
  }

  /**
   * Grid layouts always dictate or ignore the extent of a certain submorph.
   * While a resize therefore does not affect the layout, we still need to watch
   * and correct the extent if nessecary.
   * @override
   * @param { Morph } submorph - The submorph removed from the layout.
   * @param { Change } change - If removal was animated, the params for this animation is provided here.
   */
  onSubmorphResized (submorph, change) {
    if (this.renderViaCSS) {
      if (submorph.isLayoutable && submorph.owner === this.container) { this.measureAfterRender(submorph); }
    } else super.onSubmorphResized(submorph, change);
  }

  handleRenamingOf (submorph) {
    // nothing to be done any more
  }

  /**
   * Trigger a measure once the submorph has been rendered completely.
   * @param { Morph } layoutableSubmorph
   */
  measureAfterRender (layoutableSubmorph) {
    if (!this.renderViaCSS || !this.getCellGroupFor(layoutableSubmorph)) return;
    layoutableSubmorph.renderingState.cssLayoutToMeasureWith = this;
  }

  measureSubmorph (layoutableSubmorph) {
    this.onDomResize(null, layoutableSubmorph);
  }

  /**
   * Attempt to immediately measure the node corresponding to a morph.
   * If not present yet because the vdom has not gotten around to render
   * the morph yet, fall back to a measure after the render.
   * @param { Morph } layoutableSubmorph
   */
  tryToMeasureNodeNow (layoutableSubmorph) {
    const group = this.getCellGroupFor(layoutableSubmorph);
    if (!group) return;
    const node = this.getNodeFor(layoutableSubmorph);
    if (node) {
      this.updateSubmorphViaDom(layoutableSubmorph, node, group.resize);
    } else {
      this.measureAfterRender(layoutableSubmorph);
    }
  }

  /**
   * Grid Layouts do not influence the container. But a resize of the container's dom node
   * will change the size/position of layoutable submorphs which we need to detect and update.
   */
  onDomResize (node, morph) {
    if (morph !== this.container && !this.layoutableSubmorphs.includes(morph)) {
      return;
    }
    this.updateContainerViaDom();
    for (let { resize, morph: layoutableSubmorph } of this.cellGroups) {
      if (!layoutableSubmorph) continue;
      const node = this.getNodeFor(layoutableSubmorph);
      if (!node) continue;
      this.updateSubmorphViaDom(layoutableSubmorph, node, resize, true);
    }
  }

  /**
   * Update a layoutable submorph based on position and extent of the corresponding DOM node.
   * @params { Morph } layoutableSubmorph - The morph to be updated from the DOM.
   * @params { HTMLElement } node - The updated DOM node corresponding to the morph.
   * @params { Boolean } resize - Wether or not to resize the morph. This allows to optimize bounds checking of the DOM node.
   * @params { Boolean } makeDirty - Wether or not to update the morph
   */
  updateSubmorphViaDom (layoutableSubmorph, node, resize, makeDirty = false) {
    layoutableSubmorph.withMetaDo({ isLayoutAction: true }, () => {
      if (resize) {
        const newExt = pt(node.offsetWidth, node.offsetHeight);
        if (!layoutableSubmorph.extent.equals(newExt)) {
          if (makeDirty) { layoutableSubmorph.extent = newExt; } else {
            layoutableSubmorph._morphicState.extent = newExt;
            layoutableSubmorph.updateTransform({ extent: newExt });
            signal(layoutableSubmorph, 'extent');
          }
        }
      }
      const newPos = pt(node.offsetLeft, node.offsetTop);
      if (!layoutableSubmorph.position.equals(newPos)) {
        if (makeDirty) {
          layoutableSubmorph.position = newPos;
        } else {
          layoutableSubmorph._morphicState.position = newPos;
          layoutableSubmorph.updateTransform({ position: newPos });
          signal(layoutableSubmorph, 'position');
        }
      }
    });
    if (layoutableSubmorph.layout && layoutableSubmorph.layout.renderViaCSS) {
      layoutableSubmorph.layout.onDomResize(node, layoutableSubmorph);
    }
  }

  /**
   * Update the container based on extent of the corresponding DOM node.
   */
  updateContainerViaDom () {
    const renderer = this.container.env.renderer;
    if (!renderer) return;
    const node = this.getNodeFor(this.container);
    if (node && this.hasEmbeddedContainer()) {
      this.container.renderingState.inlineGridImportant = true;
    }
  }

  /**
   * Add the custom CSS attributes that is needed to make a layoutable submorph align to the rows and columns it
   * belongs to via a group.
   * @params { Morph } morph - A morph aligned by the grid layout.
   * @params { Object | CSSStyleDeclaration } style - The (virtual) style definition object.
   */
  addSubmorphCSS (morph, style) {
    if (!morph.isLayoutable) return;
    const { area, resize, align } = this.getCellGroupFor(morph) || {};
    if (!area) return;
    const { minCol, maxCol, minRow, maxRow, padding } = area;
    style.margin = padding.top() + 'px ' + padding.right() + 'px ' + padding.bottom() + 'px ' + padding.left() + 'px';
    style['grid-column-start'] = minCol + 1;
    style['grid-column-end'] = maxCol + 2;
    style['grid-row-start'] = minRow + 1;
    style['grid-row-end'] = maxRow + 2;
    style.position = 'relative';
    style.top = 'unset';
    style.left = 'unset';
    const alignToStretch = {
      topLeft: {}, // the default
      topRight: {
        justifySelf: 'end',
        alignSelf: 'start'
      },
      bottomRight: {
        justifySelf: 'end',
        alignSelf: 'end'
      },
      bottomLeft: {
        justifySelf: 'start',
        alignSelf: 'end'
      },
      center: {
        justifySelf: 'center',
        alignSelf: 'center'
      },
      topCenter: {
        justifySelf: 'center',
        alignSelf: 'start'
      },
      bottomCenter: {
        justifySelf: 'center',
        alignSelf: 'end'
      },
      leftCenter: {
        justifySelf: 'start',
        alignSelf: 'center'
      },
      rightCenter: {
        justifySelf: 'end',
        alignSelf: 'center'
      }
    };
    Object.assign(style, alignToStretch[align]);
    if (resize) {
      style.width = 'auto';
      style.height = 'auto';
    }
  }

  /**
   * Add the custom CSS attributes that is needed to make the container implement
   * a grid based layout.
   * @params { Morph } containerMorph - The morph that is the container of this grid layout.
   * @params { Object | CSSStyleDeclaration } style - The (virtual) style definition object.
   */
  addContainerCSS (containerMorph, style) {
    if (containerMorph.visible) { style.display = 'grid'; }
    const cols = arr.range(0, this.columnCount - 1).map(i => {
      const col = this.col(i);
      if (col.fixed) return col.length + 'px';
      else return col.proportion + 'fr';
    });
    const rows = arr.range(0, this.rowCount - 1).map(i => {
      const row = this.row(i);
      if (row.fixed) return row.length + 'px';
      else return row.proportion + 'fr';
    });
    style['grid-template-columns'] = cols.join(' ');
    style['grid-template-rows'] = rows.join(' ');
  }

  /**
   * To synchronously apply an update to the rendered dom without consulting the
   * (asynchronous) virtual dom layer. Allows for fast and immediate changes that have
   * an immediate effect in the view and morphic scene graph.
   */
  patchContainer () {
    if (!this.container.owner) return;
    const m = this.container;
    const node = this.getNodeFor(m);
    if (node) {
      this.addContainerCSS(m, node.style);
    }
  }

  /**
   * Convenience method that allows us to measure a set of morphs based on
   * a set of axes they belong to.
   * @param {...LayoutAxis} axes - Set of columns or rows that we will go through and measure the morphs they control.
   */
  measureMorphsIn (...axes) {
    const groupsToMeasure = arr.compact(axes).map(axis => {
      return axis.items.map(item => item.group);
    }).flat();
    groupsToMeasure.forEach(({ morph: m, resize }) => {
      if (!m) return;
      const node = this.getNodeFor(m);
      if (node) {
        this.updateSubmorphViaDom(m, node, resize);
      }
    });
  }

  /**
   * Convenience method that allows us to determine wether or not a particular
   * morph is being resizes *horizontally* by the grid.
   * @param {Morph} aMorph - The morph to check for.
   */
  resizesMorphHorizontally (aMorph) {
    const g = this.getCellGroupFor(aMorph);
    return g && g.resize;
  }

  /**
   * Convenience method that allows us to determine wether or not a particular
   * morph is being resizes *vertically* by the grid.
   * @param {Morph} aMorph - The morph to check for.
   */
  resizesMorphVertically (aMorph) {
    const g = this.getCellGroupFor(aMorph);
    return g && g.resize;
  }
}
