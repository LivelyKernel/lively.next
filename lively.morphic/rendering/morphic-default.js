import { num, Path, obj, arr } from 'lively.lang';
import { Color, Point } from 'lively.graphics';
import config from '../config.js';
import { styleProps, stylepropsToNode } from './property-dom-mapping.js';
import bowser from 'bowser';

/**
  * @param {Morph} morph - The Morph for which to generate the attributes. 
  */
 export function defaultAttributes (morph) {
  const attrs = {
    id: morph.id,
    class: (morph.hideScrollbars
      ? morph.styleClasses.concat('hiddenScrollbar')
      : morph.styleClasses).join(' '),
    draggable: false
  };
  if (bowser.ios && morph.draggable && !morph.isWorld) {
    attrs['touch-action'] = 'none';
  } else if (bowser.ios && morph.clipMode !== 'visible' && !morph.isWorld) {
    attrs['touch-action'] = 'auto';
  } else {
    attrs['touch-action'] = 'manipulation';
  }
  return attrs;
}

/**
 * Extract the styling information from `morph`'s morphic model and applies them to its DOM node.
 * Classes subclassing Morph can implement `renderStyles` that gets the Object with the styles to be applied passed before they are applied to the node. 
 * @see defaultStyle.
 * @param {Morph} morph - The Morph to be rendered.
 * @param {Node} node - The node in which `morph` is rendered into the DOM.
 * @returns {Node} `morph`'s DOM node with applied styling attributes.
 */
 export function applyStylingToNode (morph, node) {
  let styleProps = defaultStyle(morph);

  if (typeof morph.renderStyles === 'function') {
    styleProps = morph.renderStyles(styleProps);
  }

  stylepropsToNode(styleProps, node); // eslint-disable-line no-use-before-define

  if (morph.owner && morph.owner.isText && morph.owner.embeddedMorphMap.has(morph)){
    node.style.position = 'sticky';
    node.style.transform = '';
    node.style.textAlign = 'initial';
    node.style.removeProperty('top');
    node.style.removeProperty('left');
  }

  return node;
}

export const cssForTexts = `

    /* markers */

    .newtext-marker-layer {
      position: absolute;
    }

    /* selection / cursor */

    .newtext-cursor {
      z-index: 5;
      pointer-events: none;
      position: absolute;
      background-color: black;
    }

    .hidden-cursor .newtext-cursor {
      background-color: transparent !important;
    }

    .newtext-cursor.diminished {
      background-color: gray;
    }

    .newtext-selection-layer {
      position: absolute;
    }

    /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-*/
    /* text layer / content */
    .font-measure {
      visibility: hidden;
    }

    .newtext-text-layer {
      box-sizing: border-box;
      position: absolute;
      white-space: pre;
      z-index: 10; /* fixme: hackz */
      min-width: 100%;
      pointer-events: none;
    }

    .newtext-before-filler {}

    .newtext-text-layer.wrap-by-words {
      white-space: pre-wrap;
      overflow-wrap: break-word;
      max-width: 100%;
    }

    .newtext-text-layer.only-wrap-by-words {
      white-space: pre-wrap;
      overflow-wrap: break-all;
      max-width: 100%;
    }

    .newtext-text-layer.wrap-by-chars {
      white-space: pre-wrap;
      word-break: break-all;
      max-width: 100%;
    }

    .newtext-text-layer.no-wrapping {
    }

    .newtext-text-layer a {
       pointer-events: auto;
    }

    .newtext-text-layer.auto-width .line {
      width: fit-content;
    }

    .newtext-text-layer .line {
      -moz-border-radius: 0;
      -webkit-border-radius: 0;
      border-radius: 0;
      border-width: 0;
      background: transparent;
      font-family: inherit;
      font-size: inherit;
      margin: 0;
      word-wrap: normal;
      line-height: inherit;
      color: inherit;
      position: relative;
      overflow: visible;
      -webkit-tap-highlight-color: transparent;
      -webkit-font-variant-ligatures: contextual;
      font-variant-ligatures: contextual;
    }

    .line > .Morph {
      display: inline-block !important;
      vertical-align: top !important;
    }

    blockquote {
      margin: 0;
      -webkit-margin-start: 0;
      -webkit-margin-end: 0;
    }

    .newtext-text-layer blockquote {
      margin-left: 2em;
      margin-right: 2em;
      border-left: 2px lightgray solid;
      padding-left: 2%;
    }

    .selectable {
      user-select: text;
      pointer-events: all;
    }

    ::selection  {
      background: rgba(212,230,241,0.8);
    }

    /* -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-*/
    /* debug styling */

    .debug-info {
      position: absolute;
      outline: 1px solid green;
      pointer-events: none;
      z-index: 4;
      text-align: center;
      font-family: monospace;
      color: green;
      background-color: white;
      font-size: small;
      vertical-align: baseline;
    }

    .debug-line {
      position: absolute;
      outline: 1px solid red;
      pointer-events: none;
      z-index: 4,
      text-align: right;
      font-family: monospace;
      font-size: small;
      vertical-align: baseline;
      color: red;
    }

    .debug-char {
      position: absolute;
      outline: 1px solid orange;
      pointer-events: none;
      z-index: 3
    }

  `;

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

.hiddenScrollbar::-webkit-scrollbar {
  /* This is the magic bit */
  display: none;
}

.hiddenScrollbar {
  scrollbar-width: none;
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
  float: right;
  position: relative;
  top: 50%;
}

.truncated-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/*-=- input elements -=-*/

.Popups {
  z-index: 3;
}

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
    this.fast = typeof fast === 'boolean' ? fast : true;
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
    if (color) color = color.toJSExpr();
    return {
      __expr__: `new ShadowObject({${
         arr.compact(
           Object.entries({ distance, rotation, color, inset, blur, spread, fast }).map(([k, v]) => {
           return v === undefined ? null : `${k}:${v}`;
         })).join(',')
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
    // only select the properties that are different from default
    const res = {};
    if (this.rotation !== 45) res.rotation = this.rotation;
    if (this.distance !== 2) res.distance = this.distance;
    if (this.blur !== 6) res.blur = this.blur;
    if (!this.color.equals(Color.gray.darker())) res.color = this.color;
    if (this.inset === true) res.inset = this.inset;
    if (this.spread !== 0) res.spread = this.spread;
    if (!this.fast) res.fast = this.fast;
    return res;
  }

  equals (other) {
    return !!other && other.isShadowObject && obj.equals(this.toJson(), other.toJson());
  }

  toFilterCss () {
    let { distance, rotation, blur, color } = this;
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

function defaultStyle (morph) {
  const { reactsToPointer, nativeCursor, clipMode } = morph;
  const layoutStyle = {};
  // this also performs measure of the actual morphs height, so do that before rendering the style props
  if (Path('owner.layout.renderViaCSS').get(morph)) {
    morph.owner.layout.addSubmorphCSS(morph, layoutStyle);
  }
  if (Path('layout.renderViaCSS').get(morph)) {
    morph.layout.addContainerCSS(morph, layoutStyle);
  }
  // problem: If we resize the parent, the submorphs have not yet taken the adjusted height/width
  //          this means measuring the contentRect for these updates is not the correct ground truth but
  //          instead the correct answer lies in the model. This is a problem for morphs like the ellipse morph
  //          that render themselves based on the current extent in the model.
  // now we can render the other dom props
  const domStyle = styleProps(morph);
  const maskedProps = morph._animationQueue.maskedProps('css');

  if ('backgroundImage' in maskedProps) delete domStyle.background;

  if (clipMode !== 'visible') {
    domStyle.overflow = clipMode;
    domStyle['-webkit-overflow-scrolling'] = 'touch';
    // Fix for Safari clipping bugs
    if (!morph.dropShadow) domStyle['clip-path'] = 'border-box';
    else domStyle['clip-path'] = 'none';
    if (morph.isImage) domStyle['will-change'] = 'transform';
    // Fix for Chrome scroll issue, see
    // https://github.com/noraesae/perfect-scrollbar/issues/612
    // https://developers.google.com/web/updates/2016/04/scroll-anchoring
    domStyle['overflow-anchor'] = 'none';
  }

  Object.assign(domStyle, maskedProps);
  domStyle.position = 'absolute';
  domStyle['pointer-events'] = reactsToPointer ? 'auto' : 'none';
  domStyle.cursor = nativeCursor;

  Object.assign(domStyle, layoutStyle);

  return domStyle;
}
