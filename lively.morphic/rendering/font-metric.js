/* global System, global, self */
import { string, obj } from 'lively.lang';
import FontDetector from './font-detector.js';
import { cumulativeOffset } from './dom-helper.js';
import config from '../config.js';

const debug = !!config.onloadURLQuery['debug-font-metric'];

const checkTimeout = 1000;

export default class FontMetric {
  static default () {
    if (!this._fontMetric) { throw new Error('FontMetric has not yet been initialized!'); }
    return this._fontMetric;
  }

  static initDefault (domEnv) {
    if (!this._fontMetric) {
      if (!domEnv && typeof document === 'undefined') { throw new Error('Cannot initialize FontMetric without document'); }
      if (!domEnv) domEnv = { document };
      this._fontMetric = this.forDOMEnv(domEnv);
    }
    return this._fontMetric;
  }

  static removeDefault () {
    if (this._fontMetric) {
      this._fontMetric.uninstall();
      this._fontMetric = null;
    }
  }

  static forDOMEnv ({ document }) {
    const fontMetric = new FontMetric();
    fontMetric.install(document, document.body);
    return fontMetric;
  }

  constructor () {
    this.charMap = {};
    this.cachedBoundsInfo = {};
    this.supportedFontCache = {};
    this.element = null;
    this.isProportionalCache = {};
  }

  reset (debug) {
    let doc, parentNode;
    if (this.element) {
      parentNode = this.element.parentNode;
      doc = this.element.ownerDocument;
    }
    this.uninstall();
    this.charMap = {};
    this.cachedBoundsInfo = {};
    if (doc && parentNode) { this.install(doc, parentNode, debug); }
  }

  install (doc, parentEl, debug) {
    this.element = doc.createElement('div');
    this.element.name = 'fontMetric';
    this.setMeasureNodeStyles(this.element.style, true);
    parentEl.appendChild(this.element);
    this._domMeasure = new DOMTextMeasure().install(doc, parentEl, debug);
  }

  uninstall () {
    if (!this.element) return;
    if (this.element.parentNode) this.element.parentNode.removeChild(this.element);
    this.element = null;
    if (this._domMeasure) this._domMeasure.uninstall();
  }

  setMeasureNodeStyles (style, isRoot) {
    style.width = style.height = 'auto';
    style.left = style.top = '0px';
    style.visibility = 'hidden';
    style.position = 'absolute';
    style.whiteSpace = 'pre';
    style.font = 'inherit';
    style.overflow = isRoot ? 'hidden' : 'visible';
  }

  measure (style, text) {
    let {
      fontFamily, fontSize, fontWeight,
      fontStyle, textDecoration,
      textStyleClasses, transform
    } = style;
    const el = this.element;
    const rect = null;
    if (transform) transform = transform.inverse();
    el.textContent = text;
    Object.assign(el.style, {
      '-webkit-text-size-adjust': 'none',
      fontFamily,
      fontWeight,
      fontStyle,
      textDecoration,
      transform: transform,
      fontSize: fontSize + 'px'
    });
    el.className = textStyleClasses ? textStyleClasses.join(' ') : '';
    let width, height;
    try {
      ({ width, height } = el.getBoundingClientRect());
    } catch (e) { return { width: 0, height: 0 }; }

    return { height, width };
  }

  charBoundsFor (style, str) {
    const nCols = str.length;
    const bounds = new Array(nCols);
    const {
      cachedBoundsInfo: {
        bounds: cachedBounds,
        str: cachedStr,
        style: cachedStyle
      }
    } = this;
    const isMonospace = !this.isProportional(style.fontFamily);

    if (isMonospace) {
      // measuring a single char does not give us a precise width
      const single = this.sizeFor(style, 'x', true);
      const double = this.sizeFor(style, 'xx', true);
      const width = double.width - single.width;
      const height = single.height; let x = 0;
      for (let i = 0; i < nCols; i++) {
        x = width * i;
        bounds[i] = { x, y: 0, width, height };
      }
    } else {
      let useCache = cachedBounds && obj.equals(cachedStyle, style);
      const adjustSpacing = !style.fixedCharacterSpacing;

      for (let col = 0, x = 0; col < nCols; col++) {
        let width; let height; const char = str[col];
        if (adjustSpacing) {
          useCache = useCache && char === cachedStr[col];
          if (useCache) { ({ width, height } = cachedBounds[col]); } else {
            const prefix = str.substr(0, col + 1);
            ({ width, height } = this.measure(style, prefix));
            width -= x;
          }
        } else {
          ({ width, height } = this.sizeFor(style, char));
        }
        bounds[col] = { x, y: 0, width: Math.ceil(width), height: Math.ceil(height) };
        x = x + width;
      }
      if (adjustSpacing) this.cachedBoundsInfo = { bounds, str, style };
    }

    return bounds;
  }

  isProportional (fontFamily) {
    if (this.isProportionalCache.hasOwnProperty(fontFamily)) { return this.isProportionalCache[fontFamily]; }
    // if (fontFamily && fontFamily.includes('Font Awesome')) return false;
    const style = { fontFamily, fontSize: 12 };
    const w_width = this.sizeFor(style, 'w').width;
    const i_width = this.sizeFor(style, 'i').width; // this fails for glyph unicode languages like font awesome
    return this.isProportionalCache[fontFamily] = w_width !== i_width;
  }

  sizeFor (style, string = '', forceCache = false) {
    // Select style properties relevant to individual character size
    const {
      fontFamily, fontSize,
      fontWeight, fontStyle, textDecoration, textStyleClasses
    } = style;
    const relevantStyle = {
      fontFamily,
      fontSize,
      fontWeight,
      fontStyle,
      textDecoration,
      textStyleClasses
    };

    if (!forceCache && string.length > 1) return this.measure(relevantStyle, string);

    const className = textStyleClasses ? textStyleClasses.join(' ') : '';
    const styleKey = [fontFamily, fontSize, fontWeight, fontStyle, textDecoration, className].join('-');

    if (!this.charMap[styleKey]) { this.charMap[styleKey] = {}; }
    if (!this.charMap[styleKey][string]) { this.charMap[styleKey][string] = this.measure(relevantStyle, string); }

    return this.charMap[styleKey][string];
  }

  defaultLineHeight (style) {
    return this.sizeFor(style, ' ').height;
  }

  isFontSupported (font, weight = 'normal') {
    const fd = this.fontDetector || (this.fontDetector = new FontDetector(this.element.ownerDocument));

    if (this.supportedFontCache[font + '-' + weight]) {
      const { ts, value } = this.supportedFontCache[font + '-' + weight];
      if (Date.now() - ts < checkTimeout) return value;
    }

    const value = fd.isFontSupported(font, weight);

    this.supportedFontCache[font + '-' + weight] = {
      ts: Date.now(), value
    };

    return value;
  }

  defaultCharExtent (morph, styleOpts, rendertTextLayerFn) {
    return this._domMeasure.defaultCharExtent(morph, styleOpts, rendertTextLayerFn);
  }

  manuallyComputeCharBoundsOfLine (
    morph, line, offsetX = 0, offsetY = 0, styleOpts,
    rendertTextLayerFn, renderLineFn
  ) {
    return this._domMeasure.computeCharBBoxes(
      morph,
      line,
      (offsetX = 0),
      (offsetY = 0),
      styleOpts,
      rendertTextLayerFn,
      renderLineFn,
      this);
  }

  manuallyComputeBoundsOfLines (
    morph, lines, offsetX = 0, offsetY = 0, styleOpts,
    rendertTextLayerFn, renderLineFn
  ) {
    return this._domMeasure.computeBBoxesOfLines(
      morph, lines, offsetX = 0, offsetY = 0, styleOpts,
      rendertTextLayerFn, renderLineFn);
  }
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// font measuring inside text

function textlayerNodeForFontMeasure (morph) {
  let { text_layer_node, fontmetric_text_layer_node } = morph.viewState;

  // due to vdom, references to actual nodes don't guarantee that a node is
  // used in the way we think it would...
  if (text_layer_node) {
    if (!text_layer_node.className.includes('newtext-text-layer')) {
      morph.viewState.text_layer_node = text_layer_node =
        text_layer_node.parentNode.querySelector('.newtext-text-layer.actual');
    }
  }
  if (fontmetric_text_layer_node) {
    if (!fontmetric_text_layer_node.className.includes('newtext-text-layer')) { morph.viewState.fontmetric_text_layer_node = fontmetric_text_layer_node = null; }
  }

  if (text_layer_node && !fontmetric_text_layer_node && text_layer_node.parentNode) {
    fontmetric_text_layer_node = morph.viewState.fontmetric_text_layer_node =
      text_layer_node.parentNode.querySelector('.newtext-text-layer.font-measure');
  }

  return fontmetric_text_layer_node;
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// new text measure implementation

// Unicode characters that are considered "extending", i.e. treated as a single
// unit. The list below is based on
// https://github.com/codemirror/CodeMirror/blob/master/src/util/misc.js#L122
const extendingChars = /[\u0300-\u036f\u0483-\u0489\u0591-\u05bd\u05bf\u05c1\u05c2\u05c4\u05c5\u05c7\u0610-\u061a\u064b-\u065e\u0670\u06d6-\u06dc\u06de-\u06e4\u06e7\u06e8\u06ea-\u06ed\u0711\u0730-\u074a\u07a6-\u07b0\u07eb-\u07f3\u0816-\u0819\u081b-\u0823\u0825-\u0827\u0829-\u082d\u0900-\u0902\u093c\u0941-\u0948\u094d\u0951-\u0955\u0962\u0963\u0981\u09bc\u09be\u09c1-\u09c4\u09cd\u09d7\u09e2\u09e3\u0a01\u0a02\u0a3c\u0a41\u0a42\u0a47\u0a48\u0a4b-\u0a4d\u0a51\u0a70\u0a71\u0a75\u0a81\u0a82\u0abc\u0ac1-\u0ac5\u0ac7\u0ac8\u0acd\u0ae2\u0ae3\u0b01\u0b3c\u0b3e\u0b3f\u0b41-\u0b44\u0b4d\u0b56\u0b57\u0b62\u0b63\u0b82\u0bbe\u0bc0\u0bcd\u0bd7\u0c3e-\u0c40\u0c46-\u0c48\u0c4a-\u0c4d\u0c55\u0c56\u0c62\u0c63\u0cbc\u0cbf\u0cc2\u0cc6\u0ccc\u0ccd\u0cd5\u0cd6\u0ce2\u0ce3\u0d3e\u0d41-\u0d44\u0d4d\u0d57\u0d62\u0d63\u0dca\u0dcf\u0dd2-\u0dd4\u0dd6\u0ddf\u0e31\u0e34-\u0e3a\u0e47-\u0e4e\u0eb1\u0eb4-\u0eb9\u0ebb\u0ebc\u0ec8-\u0ecd\u0f18\u0f19\u0f35\u0f37\u0f39\u0f71-\u0f7e\u0f80-\u0f84\u0f86\u0f87\u0f90-\u0f97\u0f99-\u0fbc\u0fc6\u102d-\u1030\u1032-\u1037\u1039\u103a\u103d\u103e\u1058\u1059\u105e-\u1060\u1071-\u1074\u1082\u1085\u1086\u108d\u109d\u135f\u1712-\u1714\u1732-\u1734\u1752\u1753\u1772\u1773\u17b7-\u17bd\u17c6\u17c9-\u17d3\u17dd\u180b-\u180d\u18a9\u1920-\u1922\u1927\u1928\u1932\u1939-\u193b\u1a17\u1a18\u1a56\u1a58-\u1a5e\u1a60\u1a62\u1a65-\u1a6c\u1a73-\u1a7c\u1a7f\u1b00-\u1b03\u1b34\u1b36-\u1b3a\u1b3c\u1b42\u1b6b-\u1b73\u1b80\u1b81\u1ba2-\u1ba5\u1ba8\u1ba9\u1c2c-\u1c33\u1c36\u1c37\u1cd0-\u1cd2\u1cd4-\u1ce0\u1ce2-\u1ce8\u1ced\u1dc0-\u1de6\u1dfd-\u1dff\u200c\u200d\u20d0-\u20f0\u2cef-\u2cf1\u2de0-\u2dff\u302a-\u302f\u3099\u309a\ua66f-\ua672\ua67c\ua67d\ua6f0\ua6f1\ua802\ua806\ua80b\ua825\ua826\ua8c4\ua8e0-\ua8f1\ua926-\ua92d\ua947-\ua951\ua980-\ua982\ua9b3\ua9b6-\ua9b9\ua9bc\uaa29-\uaa2e\uaa31\uaa32\uaa35\uaa36\uaa43\uaa4c\uaab0\uaab2-\uaab4\uaab7\uaab8\uaabe\uaabf\uaac1\uabe5\uabe8\uabed\udc00-\udfff\ufb1e\ufe00-\ufe0f\ufe20-\ufe26\uff9e\uff9f]/;
function isExtendingChar (ch) { return ch.charCodeAt(0) >= 768 && extendingChars.test(ch); }

// Returns a number from the range [`0`; `str.length`] unless `pos` is outside that range.
function skipExtendingChars (str, pos, dir) {
  while ((dir < 0 ? pos > 0 : pos < str.length) && isExtendingChar(str.charAt(pos))) { pos = pos + dir; }
  return pos;
}

class DOMTextMeasure {
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // setup

  reset () {
    let doc, parentNode;
    if (this.element) {
      parentNode = this.element.parentNode;
      doc = this.element.ownerDocument;
    }
    this.uninstall();
    // this.charMap = {};
    // this.cachedBoundsInfo = {};
    if (doc && parentNode) { this.install(doc, parentNode); }
    return this;
  }

  install (doc, parentEl, debug = false) {
    this.debug = debug;

    this.maxLineBBoxCacheCount = debug ? 1 : 3000;
    this.lineBBoxCacheCount = 0;
    this.lineBBoxCache = {};

    this.maxTextlayerNodeCacheCount = debug ? 1 : 30;
    this.textlayerNodeCacheCount = 0;
    this.textlayerNodeCache = {};

    this.defaultCharWidthHeightCache = {};
    this.doc = doc;
    const el = this.element = doc.createElement('div');
    el.className = 'dom-measure' + (debug ? ' debug' : '');
    this.setMeasureNodeStyles(el.style, true);
    parentEl.appendChild(el);
    return this;
  }

  uninstall () {
    const el = this.element;
    if (!el) return;
    if (el.parentNode) el.parentNode.removeChild(el);
    this.element = null;
  }

  setMeasureNodeStyles (style, isRoot) {
    style.width = style.height = 'auto';
    if (!this.debug) {
      style.left = style.top = '0px';
      style.visibility = 'hidden';
    }
    style.position = 'absolute';
    style.whiteSpace = 'pre';
    style.font = 'inherit';
    style.overflow = isRoot && !this.debug ? 'hidden' : 'visible';
  }

  generateStyleKey (styleOpts) {
    const {
      defaultTextStyle: {
        fontFamily,
        fontSize,
        fontWeight,
        fontStyle,
        textDecoration,
        textStyleClasses
      },
      paddingLeft, paddingRight, paddingTop, paddingBottom,
      width, height, clipMode, lineWrapping, textAlign
    } = styleOpts;
    return [
      fontFamily,
      fontSize,
      fontWeight,
      fontStyle,
      textDecoration,
      textStyleClasses,
      paddingLeft, paddingRight, paddingTop, paddingBottom,
      width, height, clipMode, lineWrapping, textAlign
    ].join('-');
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // interface

  defaultCharExtent (morph, styleOpts, rendertTextLayerFn) {
    const styleKey = this.generateStyleKey(styleOpts);
    const found = this.defaultCharWidthHeightCache[styleKey];

    if (typeof found !== 'undefined' &&
     (found.height !== 0 || found.width !== 0)) { return found; }

    const { doc } = this;
    const testStringW = "abcdefghijklmnopqrstufwxyz ABCDEFGHIJKLMNOPQRSTUFWXYZ 1234567890 {}[];,./<>?'\"!@#$%^&*()-=_+";
    const testStringH = 'H\ne\nll\no';

    return this.withTextLayerNodeDo(
      morph,
      rendertTextLayerFn, styleOpts, styleKey,
      textNode => {
        const spanW = doc.createElement('span');
        spanW.className = 'line';
        spanW.style.whiteSpace = 'pre';
        textNode.appendChild(spanW);
        spanW.textContent = testStringW;
        const { width } = spanW.getBoundingClientRect();

        const spanH = doc.createElement('span');
        spanH.className = 'line';
        spanH.style.whiteSpace = 'pre';
        textNode.appendChild(spanH);
        spanH.textContent = testStringH;
        const { height } = spanH.getBoundingClientRect();

        textNode.removeChild(spanW);
        textNode.removeChild(spanH);
        return this.defaultCharWidthHeightCache[styleKey] = {
          width: width / testStringW.length,
          height: Math.ceil(height / 4)
        };
      });
  }

  computeBBoxesOfLines (
    morph, lines, offsetX = 0, offsetY = 0, styleOpts,
    rendertTextLayerFn, renderLineFn
  ) {
    const styleKey = this.generateStyleKey(styleOpts);
    const result = new Array(lines.length);
    let allInCache = true;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const cached = !line.textAttributes.length && // if line has attributes, don't use cache
                this.lineBBoxCache[styleKey + '_' + lines[i].text];
      if (cached && cached.height && cached.width) result[i] = cached;
      else allInCache = false;
    }

    if (allInCache) return result;

    return this.withTextLayerNodeDo(
      morph, rendertTextLayerFn, styleOpts, styleKey,
      (textNode, textNodeOffsetLeft, textNodeOffsetTop) => {
        // render in once go, then read, not intermixed!
        const lineNodes = new Array(lines.length);
        const results = new Array(lines.length);
        const { doc: document } = this;
        for (let i = 0; i < lines.length; i++) {
          if (results[i]) continue;
          const lineNode = renderLineFn(lines[i]);
          // FIXME!!!!
          lineNode.style.display = 'inline-block';
          textNode.appendChild(lineNode);
          lineNodes[i] = lineNode;
        }
        for (let i = 0; i < lineNodes.length; i++) {
          if (results[i]) continue;
          const node = lineNodes[i];
          const { left, top, width, height } = node.getBoundingClientRect();

          this.lineBBoxCache[styleKey + '_' + lines[i].text] = results[i] = {
            x: left - node.offsetLeft + offsetX - textNodeOffsetLeft,
            y: top - node.offsetTop + offsetY - textNodeOffsetTop,
            width,
            height
          };
        }

        for (let i = 0; i < lineNodes.length; i++) { textNode.removeChild(lineNodes[i]); }

        return results;
      });
  }

  computeCharBBoxes (
    morph, line, offsetX = 0, offsetY = 0, styleOpts,
    renderTextLayerFn, renderLineFn, fontMetric
  ) {
    return this.withTextLayerNodeDo(
      morph, renderTextLayerFn, styleOpts,
      this.generateStyleKey(styleOpts),
      (textNode, textNodeOffsetLeft, textNodeOffsetTop) => {
        const lineNode = renderLineFn(line);
        const _ = textNode.appendChild(lineNode);
        const { doc: document } = this;
        const result = (line.stringSize > 10000 &&

                   charBoundsOfBigMonospacedLine(
                     morph, fontMetric, line, lineNode,
                     offsetX,
                     offsetY,
                     styleOpts, renderTextLayerFn)) ||

                charBoundsOfLine(line, lineNode,
                  offsetX - textNodeOffsetLeft,
                  offsetY - textNodeOffsetTop);

        if (!this.debug) { lineNode.parentNode.removeChild(lineNode); }

        return result;
      });
  }

  withTextLayerNodeDo (morph, rendertTextLayerFn, styleOpts, styleKey, doFn) {
    const { doc: document, textlayerNodeCache: cache, element: root } = this;
    let textNodeOffsetLeft = 0; let textNodeOffsetTop = 0;
    // try to use the already rendered morph, it already has a layer node
    // for font measuring:
    let textNode = textlayerNodeForFontMeasure(morph);

    if (!textNode) textNode = cache[styleKey];

    if (!textNode) {
      this.textlayerNodeCacheCount++;
      textNode = cache[styleKey] = rendertTextLayerFn(styleOpts, []);
      textNode.id = styleKey;

      const { width, clipMode } = styleOpts;
      if (styleOpts.width || (styleOpts.clipMode && styleOpts.clipMode !== 'visible')) {
        const clipNode = document.createElement('div');
        clipNode.style.position = 'absolute';
        if (clipMode) clipNode.style.overflow = clipMode;
        if (width) clipNode.style.width = width + 'px';
        clipNode.id = styleKey;
        clipNode.appendChild(textNode);
        root.appendChild(clipNode);
      } else { root.appendChild(textNode); }
    }

    const tfm = morph.getGlobalTransform().inverse();
    if (morph.env.renderer && morph.env.renderer.getNodeForMorph(morph) &&
        (tfm.getScale() != 1 || tfm.getRotation() != 0)) {
      tfm.e = tfm.f = 0;
      textNode.style.transform = tfm.toString();
    }

    const layerBounds = textNode.getBoundingClientRect();
    textNodeOffsetLeft = layerBounds.left;
    textNodeOffsetTop = layerBounds.top;

    try {
      return doFn(textNode, textNodeOffsetLeft, textNodeOffsetTop);
    } finally {
      textNode.style.transform = '';
      if (!this.debug && this.textlayerNodeCacheCount > this.maxTextlayerNodeCacheCount) {
        let toRemove = Math.ceil(this.maxTextlayerNodeCacheCount / 2); let node;
        while (toRemove-- && (node = root.childNodes[0])) {
          cache[node.id] = null;
          root.removeChild(node);
        }
        this.textlayerNodeCacheCount = this.textlayerNodeCacheCount - toRemove;
      }
    }
  }
}

const GLOBAL = typeof System !== 'undefined'
  ? System.global
  : window || global || self || this;

const getComputedFontFamily = typeof GLOBAL.getComputedStyle === 'function'
  ? node => GLOBAL.getComputedStyle(node).fontFamily : () => '';
const getComputedMarginLeft = typeof GLOBAL.getComputedStyle === 'function'
  ? node => parseInt(GLOBAL.getComputedStyle(node).marginLeft) || 0 : () => 0;

function charBoundsOfBigMonospacedLine (
  morph, fontMetric, line, lineNode,
  offsetX = 0, offsetY = 0,
  styleOpts, directRenderTextLayerFn
) {
  const textLength = line.text.length;
  const index = 0;

  if (textLength < 500 || fontMetric.isProportional(getComputedFontFamily(lineNode))) { return null; }

  let lineWidth = Infinity;
  let lineHeight = Infinity;
  const { defaultTextStyle, lineWrapping } = styleOpts;

  if (lineWrapping) { ({ width: lineWidth, height: lineHeight } = lineNode.getBoundingClientRect()); }

  const { width, height } = fontMetric._domMeasure.defaultCharExtent(
    morph, { defaultTextStyle }, directRenderTextLayerFn);
  let x = offsetX;
  let y = offsetY;
  const result = new Array(textLength);

  for (let i = 0; i < textLength; i++) {
    if (x + width > lineWidth) { x = 0; y = y + height; }
    result[i] = { x, y, width, height };
    x = x + width;
  }

  return result;
}

function charBoundsOfLine (line, lineNode, offsetX = 0, offsetY = 0) {
  const { ELEMENT_NODE, TEXT_NODE, childNodes } = lineNode;
  const maxLength = Infinity;
  const document = lineNode.ownerDocument;
  const result = [];

  let index = 0;
  let textNode; let left; let top; let width; let height; let x; let y;
  let emptyNodeFill; let node;

  if (!lineNode) node = null;
  else if (lineNode.className.includes('line')) {
    offsetX = offsetX - lineNode.offsetLeft;
    offsetY = offsetY - lineNode.offsetTop;
    node = lineNode.childNodes[0];
  } else {
    const realLineNode = lineNode.getElementsByClassName('line')[0];
    node = realLineNode.childNodes[0];
    const offsetNode = node;

    offsetX = offsetX - lineNode.offsetLeft + getComputedMarginLeft(lineNode);
    offsetY = offsetY - lineNode.offsetTop;
  }

  if (!node) {
    emptyNodeFill = node = document.createElement('br');
    lineNode.appendChild(emptyNodeFill);
  }

  while (node) {
    if (index > maxLength) break;

    textNode = (node.tagName !== 'BR' &&
            node.nodeType === ELEMENT_NODE &&
            node.childNodes[0]) || node;

    if (textNode.nodeType === TEXT_NODE) {
      const length = textNode.length;
      for (let i = 0; i < length; i++) {
        // "right" bias for rect means that if we get multiple rects for a
        // single char (if it comes after a line break caused by wrapping, we
        // prefer the bounds on the next (the wrapped) line)
        ({ left, top, width, height } = measureCharInner(document, textNode, i, 'right'));
        x = left + offsetX;
        y = top + offsetY;

        result[index++] = { x, y, width, height };
      }
    } else if (node.nodeType === ELEMENT_NODE) {
      ({ left, top, width, height } = node.getBoundingClientRect());
      x = left + offsetX,
      y = top + offsetY;
      result[index++] = { x, y, width, height };
    } else throw new Error(`Cannot deal with node ${node}`);

    node = node.nextSibling;
  }

  if (emptyNodeFill) { emptyNodeFill.parentNode.removeChild(emptyNodeFill); }

  return result;
}

function measureCharInner (document, node, index, bias = 'left') {
  let rect; let start = index; let end = index + 1;
  if (node.nodeType == 3) { // If it is a text node, use a range to retrieve the coordinates.
    for (let i = 0; i < 4; i++) { // Retry a maximum of 4 times when nonsense rectangles are returned
      rect = getUsefulRect(range(document, node, start, end).getClientRects(), bias);
      if (rect.left || rect.right || start == 0) break;
      end = start;
      start = start - 1;
    }
  }
  return rect;
  // let {bottom, height, left, right, top, width} = rect;
  // return {bottom, height, left, right, top, width};
}

function range (document, node, start, end, endNode) {
  const r = document.createRange();
  r.setEnd(endNode || node, end);
  r.setStart(node, start);
  return r;
}

function getUsefulRect (rects, bias) {
  let rect = { left: 0, right: 0, top: 0, bottom: 0 };
  if (bias == 'left') {
    for (let i = 0; i < rects.length; i++) {
      if ((rect = rects[i]).left != rect.right) break;
    }
  } else {
    for (let i = rects.length - 1; i >= 0; i--) {
      if ((rect = rects[i]).left != rect.right) break;
    }
  }
  return rect;
}
