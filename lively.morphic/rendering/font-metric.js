/* global System, global, self */
import { arr, obj } from 'lively.lang';
import FontDetector from './font-detector.js';

const checkTimeout = 1000;

function ensureElementMounted (element, parentEl) {
  if (!element.isConnected) {
    // we assume we are mounted in then body.
    parentEl.insertBefore(element, parentEl.firstChild);
  }
}

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
      doc = this.element.getRootNode();
    }
    this.uninstall();
    this.charMap = {};
    this.cachedBoundsInfo = {};
    if (doc && parentNode) { this.install(doc, parentNode, debug); }
  }

  install (doc, parentEl, debug) {
    this.element = doc.createElement('div');
    this.element.name = 'fontMetric';
    this.parentEl = parentEl;
    this.setMeasureNodeStyles(this.element.style, true);
    parentEl.insertBefore(this.element, parentEl.firstChild); // it is inserted in the front of the body
    this._domMeasure = new DOMTextMeasure().install(doc, parentEl, debug); // eslint-disable-line no-use-before-define
  }

  uninstall () {
    if (this._domMeasure) this._domMeasure.uninstall();
    if (this.element?.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    this.fontDetector?.clear();
    this.element = null;
  }

  ensureElement () {
    ensureElementMounted(this.element, this.parentEl);
    ensureElementMounted(this._domMeasure.element, this._domMeasure.parentEl);
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
    ensureElementMounted(this.element, this.parentEl);
    let {
      fontFamily, fontSize, fontWeight,
      fontStyle, textDecoration,
      textStyleClasses, transform
    } = style;
    const el = this.element;
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

  get supportedFonts () {
    return arr.uniq(Object
      .keys(this.supportedFontCache)
      .map(font => font.split(',')[0].replaceAll(/-bold|-Medium|\"|-normal/g, '')));
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

  newDefaultCharExtent (morph, rendertTextLayerFn) {
    return this._domMeasure.defaultCharExtent(morph, null, rendertTextLayerFn);
  }

  newManuallyComputeCharBoundsOfLine (
    morph, line, offsetX = 0, offsetY = 0,
    rendertTextLayerFn, renderLineFn
  ) {
    return this._domMeasure.computeCharBBoxes(
      morph,
      line,
      (offsetX = 0),
      (offsetY = 0),
      null,
      rendertTextLayerFn,
      renderLineFn,
      this);
  }
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// font measuring inside text

function textlayerNodeForFontMeasure (morph) {
  let node = $world.env.renderer.getNodeForMorph(morph);
  if (node && node.isConnected) return node.querySelector(`#${morph.id}font-measure`);
  return null;
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// new text measure implementation

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
    this.parentEl = parentEl;
    const el = this.element = doc.createElement('div');
    el.className = 'dom-measure' + (debug ? ' debug' : '');
    this.setMeasureNodeStyles(el.style, true);
    parentEl.insertBefore(el, parentEl.firstChild);
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
    if (!styleOpts.isMorph) {
      const {

        fontFamily,
        fontSize,
        fontWeight,
        fontStyle,
        textDecoration,
        textStyleClasses,

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
    } else {
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
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // interface

  defaultCharExtent (morph, styleOpts, rendertTextLayerFn) {
    let styleKey;
    if (styleOpts) styleKey = this.generateStyleKey(styleOpts);
    else styleKey = this.generateStyleKey(morph);
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

  computeCharBBoxes (
    morph, line, offsetX = 0, offsetY = 0, styleOpts,
    renderTextLayerFn, renderLineFn, fontMetric
  ) {
    return this.withTextLayerNodeDo(
      morph, renderTextLayerFn, styleOpts,
      styleOpts ? this.generateStyleKey(styleOpts) : this.generateStyleKey(morph),
      (textNode, textNodeOffsetLeft, textNodeOffsetTop) => {
        let lineNode, nodeForMorph, actualTextNode;

        nodeForMorph = $world.env.renderer.getNodeForMorph(morph);
        actualTextNode = nodeForMorph && nodeForMorph.querySelector(`#${morph.id}textLayer`);
        const dataRowId = String(line.row);
        lineNode = actualTextNode && Array.from(actualTextNode.children).find(n => n.getAttribute('data-row') === dataRowId);

        const needsToCreateNode = !lineNode || line.lineNeedsRerender;
        let nodeToReplace;
        if (needsToCreateNode) {
          nodeToReplace = lineNode;
          lineNode = renderLineFn(line);
          textNode.appendChild(lineNode);
        } else {
          ({ top: textNodeOffsetTop, left: textNodeOffsetLeft } = actualTextNode.getBoundingClientRect());
        }

        let result;
        if (line.stringSize > 10000) {
          result = charBoundsOfBigMonospacedLine( // eslint-disable-line no-use-before-define
            morph,
            line,
            lineNode,
            offsetX,
            offsetY,
            renderTextLayerFn);
        } else {
          result = charBoundsOfLine(line, lineNode, // eslint-disable-line no-use-before-define
            offsetX - textNodeOffsetLeft,
            offsetY - textNodeOffsetTop);
        }

        if (actualTextNode && nodeToReplace) {
          actualTextNode.replaceChild(lineNode, nodeToReplace);
        } else if (needsToCreateNode) {
          lineNode.remove();
        }
        return result;
      });
  }

  withTextLayerNodeDo (morph, rendertTextLayerFn, styleOpts, styleKey, doFn) {
    ensureElementMounted(this.element, this.parentEl);
    const { doc: document, textlayerNodeCache: cache, element: root } = this;
    let textNodeOffsetLeft = 0; let textNodeOffsetTop = 0;
    // try to use the already rendered morph, it already has a layer node
    // for font measuring:
    let textNode = textlayerNodeForFontMeasure(morph);
    if (!textNode) textNode = cache[styleKey];

    if (!textNode) {
      this.textlayerNodeCacheCount++;
      textNode = rendertTextLayerFn();
      cache[styleKey] = textNode;
      textNode.id = styleKey;

      const { width, clipMode } = morph;

      if (width || clipMode && clipMode !== 'visible') {
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
      (tfm.getScale() !== 1 || tfm.getRotation() !== 0)) {
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
  ? node => GLOBAL.getComputedStyle(node).fontFamily
  : () => '';

const getComputedMarginLeft = typeof GLOBAL.getComputedStyle === 'function'
  ? node => parseInt(GLOBAL.getComputedStyle(node).marginLeft) || 0
  : () => 0;

function charBoundsOfBigMonospacedLine (morph, line, lineNode, offsetX = 0, offsetY = 0, directRenderTextLayerFn) {
  const textLength = line.text.length;

  if (textLength < 500 || $world.env.fontMetric.isProportional(getComputedFontFamily(lineNode))) { return null; }

  let lineWidth = Infinity;

  if (morph.lineWrapping) { ({ width: lineWidth } = lineNode.getBoundingClientRect()); }

  let { width, height } = $world.env.fontMetric._domMeasure.defaultCharExtent(
    morph, morph.defaultTextStyle, directRenderTextLayerFn);

  height = morph.fontSize * morph.lineHeight;

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

export function charBoundsOfLine (line, lineNode, offsetX = 0, offsetY = 0) {
  // ELEMENT_NODE === 1
  // TEXT_NODE === 3, nodeType property of DOM Node
  const { ELEMENT_NODE, TEXT_NODE } = lineNode;
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
            node.childNodes[0]) || node; // spans contain a text node, other morphs would also contain stuff

    if (textNode.nodeType === TEXT_NODE) {
      const length = textNode.length;
      for (let i = 0; i < length; i++) {
        // iterate over all characters in text
        // "right" bias for rect means that if we get multiple rects for a
        // single char (if it comes after a line break caused by wrapping, we
        // prefer the bounds on the next (the wrapped) line)
        ({ left, top, width, height } = measureCharInner(document, textNode, i, 'right')); // eslint-disable-line no-use-before-define
        x = left + offsetX;
        y = top + offsetY;

        result[index++] = { x, y, width, height };
      }
    } else if (node.nodeType === ELEMENT_NODE) { // morph or stuff
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
  if (node.nodeType === 3) { // If it is a text node, use a range to retrieve the coordinates.
    for (let i = 0; i < 4; i++) { // Retry a maximum of 4 times when nonsense rectangles are returned
      rect = getUsefulRect(range(document, node, start, end).getClientRects(), bias); // eslint-disable-line no-use-before-define
      if (rect.left || rect.right || start === 0) break;
      end = start;
      start = start - 1;
    }
  }
  return rect;
}

function range (document, node, start, end, endNode) {
  const r = document.createRange();
  r.setEnd(endNode || node, end);
  r.setStart(node, start);
  return r;
}

function getUsefulRect (rects, bias) {
  let rect = { left: 0, right: 0, top: 0, bottom: 0 };
  if (bias === 'left') {
    for (let i = 0; i < rects.length; i++) {
      if ((rect = rects[i]).left !== rect.right) break;
    }
  } else {
    for (let i = rects.length - 1; i >= 0; i--) {
      if ((rect = rects[i]).left !== rect.right) break;
    }
  }
  return rect;
}
