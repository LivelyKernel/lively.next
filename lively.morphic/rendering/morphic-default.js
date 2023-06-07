import { num, obj, arr } from 'lively.lang';
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
    class: morph.styleClasses.join(' '),
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

  if (morph.owner && morph.owner.isText && morph.owner.embeddedMorphMap.has(morph)) {
    styleProps.position = 'sticky';
    styleProps.transform = '';
    styleProps.textAlign = 'initial';
    delete styleProps.top;
    delete styleProps.left;
  }

  stylepropsToNode(styleProps, node); // eslint-disable-line no-use-before-define
  if (morph.renderingState.inlineGridImportant && styleProps.display !== 'none') node.style.setProperty('display', 'inline-grid', 'important');
  if (morph.renderingState.inlineFlexImportant && styleProps.display !== 'none') node.style.setProperty('display', 'inline-flex', 'important');

  return node;
}

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
  if (morph.owner?.layout?.renderViaCSS) {
    morph.owner.layout.addSubmorphCSS(morph, layoutStyle); // FIXME: expensive
  }
  if (morph.layout?.renderViaCSS) {
    morph.layout.addContainerCSS(morph, layoutStyle); // FIXME: expensive
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
