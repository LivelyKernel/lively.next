import vdom from "virtual-dom";
import parser from "vdom-parser";
import { num, Path, obj, arr, properties, promise } from "lively.lang";
import { Color, RadialGradient, pt, Point, LinearGradient, rect } from "lively.graphics";
import config from "../config.js";
import { styleProps, addSvgAttributes, addPathAttributes } from "./property-dom-mapping.js"
import bowser from 'bowser';

const { h, diff, patch, create: createNode } = vdom;

// await $world.env.renderer.ensureDefaultCSS()
export const defaultCSS = `

/*-=- html fixes -=-*/

html {
  overflow: visible;
}

textarea.lively-text-input.debug {
  z-index: 20 !important;
  opacity: 1 !important;
  background: rgba(0,255,0,0.5) !important;
}

.no-html-select {
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  -khtml-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
}

.hiddenScrollbar::-webkit-scrollbar {
  /* This is the magic bit */
  display: none;
}


/*-=- generic morphic -=-*/

.Morph {
  outline: none;
  /*for aliasing issue in chrome: http://stackoverflow.com/questions/6492027/css-transform-jagged-edges-in-chrome*/
  /* -webkit-backface-visibility: hidden; */

  /*include border size in extent of element*/
  box-sizing: border-box;

  /*don't use dom selection on morphs*/
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  -khtml-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
}

.Morph img {
  -moz-user-select: none;
}

.Tooltip {
  z-index: 3;
}

.Hand {
  z-index: 1;
}

/*-=- halos -=-*/

.Halo {
  z-index: 2;
}

.ProportionalLayoutHalo, .FlexLayoutHalo, .GridLayoutHalo, .TilingLayoutHalo {
  z-index: auto;
}

.HaloItem:not(.NameHaloItem) {
  /*FIXME: we shouldn't need to hardcode the size...*/
  line-height: 24px !important;
  text-align: center;
  vertical-align: middle;
}

.halo-mesh {
  background-color:transparent;
  background-image: linear-gradient(rgba(0,0,0,.1) 2px, transparent 2px),
  linear-gradient(90deg, rgba(0,0,0,.1) 2px, transparent 2px),
  linear-gradient(rgba(0,0,0,.1) 1px, transparent 1px),
  linear-gradient(90deg, rgba(0,0,0,.1) 1px, transparent 1px);
  background-size:100px 100px, 100px 100px, 10px 10px, 10px 10px;
  background-position:-2px -2px, -2px -2px, -1px -1px, -1px -1px;
}

/*-=- text -=-*/

.center-text {
  text-align: center;
}

.v-center-text {
  position: relative;
  top: 50%;
}

div.text-layer span {
  line-height: normal;
}

/*-=- text -=-*/

.Label span {
  white-space: pre;
  float: left;
  line-height: initial;
  -moz-user-select: none;
}

.Text .annotation {
  text-align: right;
  position: absolute;
  right: 0;
}

.Label .annotation {
/*  vertical-align: middle;
  height: 100%;*/
  /*vertical align*/
  float: right;
  position: relative;
  top: 50%;
  text-align: right;
}

.truncated-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/*-=- input elements -=-*/

input::-webkit-input-placeholder {
  color: rgb(202, 202, 202);
}
input::-moz-placeholder {
  color: rgb(202, 202, 202);
}
input:-ms-input-placeholder {
  color: rgb(202, 202, 202);
}
input:-moz-placeholder {
  color: rgb(202, 202, 202);
}
input:placeholder {
  color: rgb(202, 202, 202);
}

/*-=- input elements -=-*/
.Morph svg .path-point {
  cursor: move; /* fallback if grab cursor is unsupported */
  cursor: grab;
  cursor: -moz-grab;
  cursor: -webkit-grab;
  fill: red;
}

`;

export class ShadowObject {
  constructor (args) {
    if (obj.isBoolean(args)) args = config.defaultShadow;
    const { rotation, distance, blur, color, morph, inset, spread, fast } = args;
    this.rotation = obj.isNumber(rotation) ? rotation : 45; // in degrees
    this.distance = obj.isNumber(distance) ? distance : 2;
    this.blur = obj.isNumber(blur) ? blur : 6;
    this.inset = inset || false;
    this.spread = spread || 0;
    this.color = color || Color.gray.darker();
    this.morph = morph;
    this.fast = fast;
  }

  get __dont_serialize__ () { return ['morph']; }

  get distance () { return this._distance; }
  get blur () { return this._blur; }
  get rotation () { return this._rotation; }
  get color () { return this._color; }
  get inset () { return this._inset; }

  /* rms 5.3.17: This is a problem in general: mutating properties of
  morph properties that are themselves objects will not be tracked
  correctly by the change recording, since the reference does not change.
  Recreating a new property object on every set seems costly also.
  Maybe we should allow properties to communicate with the change recording
  to let it know when things about it (i.e. dropShadow.blur, vertices.at(0), gradient.stops....)
  have changed. */

  set inset (v) {
    this._inset = v;
    if (this.morph) this.morph.dropShadow = this;
  }

  set distance (d) {
    this._distance = d;
    if (this.morph) this.morph.dropShadow = this;
  }

  set blur (b) {
    this._blur = b;
    if (this.morph) this.morph.dropShadow = this;
  }

  set rotation (r) {
    this._rotation = r;
    if (this.morph) this.morph.dropShadow = this;
  }

  set color (c) {
    this._color = c;
    if (this.morph) this.morph.dropShadow = this;
  }

  get isShadowObject () { return true; }

  __serialize__ () {
    let { distance, rotation, color, inset, blur, spread, fast } = this.toJson();
    color = color.toJSExpr();
    return {
      __expr__: `new ShadowObject({${
         Object.entries({ distance, rotation, color, inset, blur, spread, fast }).map(([k, v]) => `${k}:${v}`)
      }})`,
      bindings: {
        'lively.graphics/color.js': ['Color'],
        'lively.morphic': ['ShadowObject']
      }
    };
  }

  with (props) {
    const { distance, rotation, color, inset, blur, spread, fast } = this;
    return new ShadowObject({ distance, rotation, color, inset, blur, spread, fast, ...props });
  }

  toCss () {
    const { distance, rotation, color, inset, blur, spread } = this;
    const { x, y } = Point.polar(distance, num.toRadians(rotation));
    return `${inset ? 'inset' : ''} ${color.toString()} ${x.toFixed(2)}px ${y.toFixed(2)}px ${blur}px ${spread}px`;
  }

  toJson () {
    return obj.select(this, [
      'rotation',
      'distance',
      'blur',
      'color',
      'inset',
      'spread',
      'fast'
    ]);
  }

  equals (other) {
    return !!other && obj.equals(this.toJson(), other.toJson());
  }

  toFilterCss () {
    let { distance, rotation, blur, color, spread } = this;
    const { x, y } = Point.polar(distance, num.toRadians(rotation));
    blur = bowser.chrome ? blur / 3 : blur / 2;
    return `drop-shadow(${x.toFixed(2)}px ${y.toFixed(2)}px ${blur.toFixed(2)}px ${color.toString()})`;
  }

  interpolate (p, other) {
    return new ShadowObject({
      distance: num.interpolate(p, this.distance, other.distance),
      rotation: num.interpolate(p, this.rotation, other.rotation),
      color: this.color.interpolate(p, other.color),
      blur: num.interpolate(p, this.blur, other.blur),
      spread: num.interpolate(p, this.spread, other.spread),
      inset: other.inset,
      fast: other.fast
    });
  }
}

export function defaultStyle (morph) {
  const { opacity, reactsToPointer, nativeCursor, clipMode } = morph;
  const domStyle = styleProps(morph);
  const maskedProps = morph._animationQueue.maskedProps('css');

  if ('backgroundImage' in maskedProps) delete domStyle.background;

  if (clipMode !== 'visible') {
    domStyle.overflow = clipMode;
    domStyle['-webkit-overflow-scrolling'] = 'touch';
    // Fix for Chrome scroll issue, see
    // https://github.com/noraesae/perfect-scrollbar/issues/612
    // https://developers.google.com/web/updates/2016/04/scroll-anchoring
    domStyle['overflow-anchor'] = 'none';
  }

  Object.assign(domStyle, maskedProps);
  domStyle.position = 'absolute';
  domStyle['pointer-events'] = reactsToPointer ? 'auto' : 'none';
  domStyle.cursor = nativeCursor;
  if (Path('owner.layout.renderViaCSS').get(morph)) {
    morph.owner.layout.addSubmorphCSS(morph, domStyle);
  }
  if (Path('layout.renderViaCSS').get(morph)) {
    morph.layout.addContainerCSS(morph, domStyle);
  }
  return domStyle;
}

// Sets the scroll later...
// See https://github.com/Matt-Esch/virtual-dom/issues/338 for why that is necessary.
// See https://github.com/Matt-Esch/virtual-dom/blob/dcb8a14e96a5f78619510071fd39a5df52d381b7/docs/hooks.md
// for why this has to be a function of prototype
function MorphAfterRenderHook (morph, renderer) { this.morph = morph; this.renderer = renderer; }
MorphAfterRenderHook.prototype.hook = function (node, propertyName, previousValue, attempt = 0) {
  const isInDOM = !!node.parentNode;

  if (isInDOM) {
    // 2. update scroll of morph itself
    // 3. Update scroll of DOM nodes of submorphs
    if (this.morph._submorphOrderChanged && this.morph.submorphs.length) {
      this.morph._submorphOrderChanged = false;
      this.updateScrollOfSubmorphs(this.morph, this.renderer);
    } else if (this.morph.isClip()) this.updateScroll(this.morph, node);

    if (Path('morph.owner.layout.renderViaCSS').get(this)) {
      this.morph.owner.layout.ensureBoundsMonitor(node, this.morph);
    }
    if (Path('morph.layout.renderViaCSS').get(this)) {
      this.morph.layout.ensureBoundsMonitor(node, this.morph);
    }
  }

  if (isInDOM || attempt > 3) {
    this.morph._rendering = false; // see morph.makeDirty();
    this.morph.onAfterRender(node);
    return;
  }

  // wait for node to be really rendered, i.e. it's in DOM
  attempt++;
  setTimeout(() => this.hook(node, propertyName, previousValue, attempt), 20 * attempt);
};
MorphAfterRenderHook.prototype.updateScroll = function (morph, node, fromScroll) {
  // If there is a scroll in progress (e.g. the user scrolled the morph via
  // trackpad), we register that via onScroll event handlers and update the scroll
  // prperty of the morph.  However, while the scroll is ongoing, we will not set
  // the scrollLeft/scrollTop DOM element attributes b/c that would interfere with
  // "smooth" scrolling and appear jerky.
  // evt.state.scroll.interactiveScrollInProgress promise is used for tracking
  // that.
  const { interactiveScrollInProgress } = morph.env.eventDispatcher.eventState.scroll;
  if (node && interactiveScrollInProgress) {
    return interactiveScrollInProgress.then(() => this.updateScroll(morph, node, true)); // scheduled more then once!!
  }
  if (morph.isWorld) return;
  if (node) {
    const { x, y } = morph.scroll;

    if (morph._animationQueue.animations.find(anim => anim.animatedProps.scroll)) return;
    const scrollLayer = morph.isText && morph.viewState.fastScroll ? node.querySelector('.scrollLayer') : node;
    if (morph._skipScrollUpdate) return;
    if (!scrollLayer) return;
    // prevent interference with bounce back animation

    // this is only there to immediately respoond in the view to a setScroll
    scrollLayer.scrollTop !== y && (scrollLayer.scrollTop = y);
    scrollLayer.scrollLeft !== x && (scrollLayer.scrollLeft = x);

    !fromScroll && requestAnimationFrame(() => {
      scrollLayer.scrollTop !== y && (scrollLayer.scrollTop = y);
      scrollLayer.scrollLeft !== x && (scrollLayer.scrollLeft = x);
    }, morph.id);
  }
}
MorphAfterRenderHook.prototype.unhook = function(node, propName, propValue) {
  // remove the listener to that node
  // this is getting called on every render pass... too many times :(
  if (Path('morph.layout.renderViaCSS').get(this) && !propValue) {
    this.morph.layout._resizeObservers = new WeakMap();
  }
  // if (this.morph._boundsObserver && !propValue) {
  //   this.morph._boundsObserver.unobserve(node);
  //   delete this.morph._boundsObserver;
  // }
}
MorphAfterRenderHook.prototype.updateScrollOfSubmorphs = function(morph, renderer) {
  morph.submorphs.forEach(m => {
    if (m.isClip()) { this.updateScroll(m, renderer.getNodeForMorph(m)); }
    this.updateScrollOfSubmorphs(m, renderer);
  });
};

// simple toplevel constructor, not a class and not wrapped for efficiency
function Animation (morph) { this.morph = morph; }
Animation.prototype.hook = function (node) {
  this.morph._animationQueue.startAnimationsFor(node);
};

export function SvgAnimation (morph, type) { this.morph = morph; this.type = type; }
SvgAnimation.prototype.hook = function (node) {
  this.morph._animationQueue.startSvgAnimationsFor(node, this.type);
};

export function defaultAttributes (morph, renderer) {
  const attrs = {
    animation: new Animation(morph),
    key: morph.id,
    id: morph.id,
    attributes: {},
    className: (morph.hideScrollbars
      ? morph.styleClasses.concat('hiddenScrollbar')
      : morph.styleClasses).join(' '),
    draggable: false,
    'morph-after-render-hook': new MorphAfterRenderHook(morph, renderer)
  };
  if (bowser.ios && morph.draggable && !morph.isWorld) {
    attrs.attributes['touch-action'] = 'none';
  } else if (bowser.ios && morph.clipMode != 'visible' && !morph.isWorld) {
    attrs.attributes['touch-action'] = 'auto';
  } else {
    attrs.attributes['touch-action'] = 'manipulation';
  }
  return attrs;
}

export function svgAttributes (svg) {
  const animation = new SvgAnimation(svg, 'svg'); const attributes = {};
  addSvgAttributes(svg, attributes);
  Object.assign(attributes, svg._animationQueue.maskedProps('svg'));
  return { animation, attributes };
}

export function pathAttributes (path) {
  const animation = new SvgAnimation(path, 'path'); const attributes = {
    mask: path.drawnProportion !== 0 ? 'url(#mask' + path.id + ')' : ''
  };
  addPathAttributes(path, attributes);
  Object.assign(attributes, path._animationQueue.maskedProps('path'));
  return { animation, attributes };
}

export function renderGradient (id, extent, gradient) {
  gradient = gradient.valueOf();
  const { bounds, focus, vector, stops } = gradient;
  const { x: width, y: height } = extent;
  const props = {
    namespace: 'http://www.w3.org/2000/svg',
    attributes: {
      id: 'gradient-' + id,
      gradientUnits: 'userSpaceOnUse',
      r: '50%'
    }
  };
  if (vector) {
    props.attributes.gradientTransform =
      `rotate(${num.toDegrees(vector.extent().theta())}, ${width / 2}, ${height / 2})`;
  }
  if (focus && bounds) {
    const { width: bw, height: bh } = bounds;
    const { x, y } = focus;
    props.attributes.gradientTransform = `matrix(
${bw / width}, 0, 0, ${bh / height},
${((width / 2) - (bw / width) * (width / 2)) + (x * width) - (width / 2)},
${((height / 2) - (bh / height) * (height / 2)) + (y * height) - (height / 2)})`;
  }

  return h(gradient.type, props,
    stops.map(stop =>
      h('stop',
        {
          namespace: 'http://www.w3.org/2000/svg',
          attributes:
                       {
                         offset: (stop.offset * 100) + '%',
                         'stop-opacity': stop.color.a,
                         'stop-color': stop.color.withA(1).toString()
                       }
        })));
}

function initDOMState (renderer, world) {
  renderer.rootNode.appendChild(renderer.domNode);
  renderer.ensureDefaultCSS()
    .then(() => promise.delay(500))
    .then(() => world.env.fontMetric && world.env.fontMetric.reset())
    .then(() => world.withAllSubmorphsDo(ea => {
      if (ea.isText || ea.isLabel) {
        const { serializationInfo } = ea.metadata || {};
        if (serializationInfo && serializationInfo.recoveredTextBounds) return;
        ea.forceRerender();
      }
    }))
    .catch(err => console.error(err));
}

export function renderMorph (morph, renderer = morph.env.renderer) {
  // helper that outputs a dom element for the morph, independent from the
  // morph being rendered as part of a world or not. The node returned *is not*
  // the DOM node that represents the morph as part of its world! It's a new node!
  return createNode(morph.render(renderer), renderer.domEnvironment);
}

export function renderSubTree (morph, renderer) {
  // a function which allows to force rendering in a subhierarchy of the world
  // useful in situation where in order for synchronous execution to continue, we
  // quickly need to push changes to the dom and update the DOM state (text and label morphs)
  const tree = renderer.renderMap.get(morph);
  const domNode = renderer.getNodeForMorph(morph);

  if (!domNode || !tree) return;

  const newTree = renderer.render(morph);
  const patches = diff(tree, newTree);

  // insert new tree into global tree
  const parentNode = renderer.renderMap.get(morph.owner);
  if (!parentNode) return;
  const siblings = parentNode.children[0].children;
  const treeIndex = siblings.indexOf(tree);
  siblings[treeIndex] = newTree;

  patch(domNode, patches);
}

export function renderRootMorph (world, renderer) {
  if (!world.needsRerender()) return;

  let hydrated = false;
  let domNode = renderer.domNode;
  const tree = renderer.renderMap.get(world) || (domNode && (hydrated = true) && parser(domNode)) || renderer.render(world);
  const newTree = renderer.render(world);

  if (hydrated) tree.key = newTree.key;

  const patches = diff(tree, newTree);

  domNode = domNode || (renderer.domNode = createNode(tree, renderer.domEnvironment));

  if (!domNode.parentNode) initDOMState(renderer, world);

  patch(domNode, patches);

  renderer.renderFixedMorphs(newTree.fixedMorphs, world);
}
