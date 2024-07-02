/* global System, global, self, OffscreenCanvas */
import { obj, arr } from 'lively.lang';
import { pt, rect } from 'lively.graphics';

const VARIATION_SELECTOR = 65039;
const ZWJ = 8205;

function ensureElementMounted (element, parentEl) {
  if (!element.isConnected) {
    // we assume we are mounted in then body.
    parentEl.insertBefore(element, parentEl.firstChild);
  }
}

export function fontWeightToString (weightNumber) {
  weightNumber = Number(weightNumber);
  switch (weightNumber) {
    case 100: return 'Thin';
    case 200: return 'Extra Light';
    case 300: return 'Light';
    case 400: return 'Normal';
    case 500: return 'Medium';
    case 600: return 'Semi Bold';
    case 700: return 'Bold';
    case 800: return 'Extra Bold';
    case 900: return 'Ultra Bold';
  }
}

export function fontWeightNameToNumeric () {
  return new Map([
    'Thin',
    'Extra Light',
    'Light',
    'Normal',
    'Medium',
    'Semi Bold',
    'Bold',
    'Extra Bold',
    'Ultra Bold'].map((name, i) => [name, String((i + 1) * 100)]));
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
    this.supportedFontCache = new Set();
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
      textStyleClasses, transform, lineHeight
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
      lineHeight,
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
      fontFamily, fontSize, lineHeight,
      fontWeight, fontStyle, textDecoration, textStyleClasses
    } = style;
    const relevantStyle = {
      lineHeight,
      fontFamily,
      fontSize,
      fontWeight,
      fontStyle,
      textDecoration,
      textStyleClasses
    };

    if (!forceCache && string.length > 1) return this.measure(relevantStyle, string);

    const styleKey = this._domMeasure.generateStyleKey(style);

    if (!this.charMap[styleKey]) { this.charMap[styleKey] = {}; }
    if (!this.charMap[styleKey][string]) { this.charMap[styleKey][string] = this.measure(relevantStyle, string); }

    return this.charMap[styleKey][string];
  }

  defaultLineHeight (style) {
    return this.sizeFor(style, ' ').height;
  }

  isFontSupported (font, weight = 'normal', style = 'normal') {
    if (this.supportedFontCache.has(`${style} ${weight} 12px ${font}`)) return true;
    const check = document.fonts.check(`${style} ${weight} 12px ${font}`);
    if (check) this.supportedFontCache.add(`${style} ${weight} 12px ${font}`);
    return check;
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
      offsetX,
      offsetY,
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
  if (node && node.isConnected) return morph.renderingState.fontMeasureNode;
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
    this.canvasCompatibility = {};

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
    this.canvas = new OffscreenCanvas(256, 256);
    return this;
  }

  getMeasuringState (textMorph) {
    const emptySpace = this.getEmptySpaceOfMorph(textMorph);
    return {
      currentWord: [],
      trailingWhitespaces: [],
      wordLength: 0,
      virtualRow: 0, // in case of wrapped lines, we have multiple virtual rows
      emptySpace,
      emptySpaceForWord: emptySpace
    };
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

  canBeMeasuredViaCanvas (aMorph) {
    if (!aMorph.allFontsLoaded() && document.fonts.status !== 'loading') return false;
    const { fontFamily, fontWeight, fontStyle } = aMorph;
    const key = `${fontFamily}-${fontWeight}-${fontStyle}`;
    if (key in this.canvasCompatibility) return this.canvasCompatibility[key];

    // determine wether or not a font does some weird shit with letter spacing
    // note, that this is a heuristic approximation only
    const errorMargin = 3;
    const testString = 'Lorem ipsum dolor sit amet.';
    const style = { fontFamily, fontSize: 20, fontWeight, fontStyle, lineWrapping: 'no-wrap' };
    const totalLength = this.measureTextWidthInCanvas(style, testString);
    const subBounds = this.measureCharWidthsInCanvas(aMorph, testString, style, this.getMeasuringState(aMorph));
    return this.canvasCompatibility[key] = Math.abs(totalLength - arr.sum(subBounds.map(b => b[0]))) < errorMargin;
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
        lineHeight,

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
        lineHeight,
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
        lineHeight,
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
        lineHeight,
        paddingLeft, paddingRight, paddingTop, paddingBottom,
        width, height, clipMode, lineWrapping, textAlign
      ].join('-');
    }
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // interface

  measureTextWidthInCanvas (morph, str) {
    const ctx = this.canvas.getContext('2d');
    const style = `${morph.fontStyle} ${morph.fontWeight} ${morph.fontSize}px ${morph.fontFamily}`;
    ctx.font = style;
    ctx.letterSpacing = '0px';
    ctx.textRendering = 'optimizeSpeed';
    const { width } = ctx.measureText(str);
    return width;
  }

  getEmptySpaceOfMorph (textMorph) {
    const leftBorder = textMorph.borderStyleLeft !== 'none' ? textMorph.borderWidthLeft : 0;
    const rightBorder = textMorph.borderStyleRight !== 'none' ? textMorph.borderWidthRight : 0;
    return textMorph.width - textMorph.padding.left() - textMorph.padding.right() - leftBorder - rightBorder;
  }

  measureCharWidthsInCanvas (morph, str, styleOpts = {}, measuringState) {
    const ctx = this.canvas.getContext('2d');
    const lineWrapping = styleOpts.lineWrapping || morph.lineWrapping;
    const style = `${styleOpts.fontStyle || morph.fontStyle} ${styleOpts.fontWeight || morph.fontWeight} ${styleOpts.fontSize || morph.fontSize}px ${styleOpts.fontFamily || morph.fontFamily}`;
    const styleKey = `${style} ls:${morph.letterSpacing}`;
    const fontMetric = morph.env.fontMetric;
    const isMonospace = !fontMetric.isProportional(styleOpts.fontFamily || morph.fontFamily);
    let cache;
    if (!this.lineBBoxCache[styleKey]) cache = this.lineBBoxCache[styleKey] = [];
    else cache = this.lineBBoxCache[styleKey];
    ctx.font = style;
    ctx.letterSpacing = `${styleOpts.letterSpacing || morph.letterSpacing}px`;
    ctx.textRendering = 'optimizeSpeed';
    const result = [];
    if (styleOpts.paddingLeft) {
      const offset = [Number.parseFloat(styleOpts.paddingLeft), measuringState.virtualRow];
      offset.isOffset = true;
      measuringState.currentWord.push(offset);
      measuringState.wordLength += offset[0];
      result.push(offset);
    }
    const emptySpace = this.getEmptySpaceOfMorph(morph);
    let codePoints = []; let i = 0; let charCode;
    while (i < str.length) {
      charCode = str.charCodeAt(i);
      // rms: 12.4.24 the below strategy is brittle but works. subject to change if we run into issues in the future.
      if ((charCode & 0xF800) === 0xD800) {
        const multiByteSequence = [charCode, str.charCodeAt(++i)];
        if (str.charCodeAt(i + 1) === VARIATION_SELECTOR) i++;
        while (str.charCodeAt(i + 1) === ZWJ) {
          multiByteSequence.push(
            str.charCodeAt(++i),
            str.charCodeAt(++i)); // and the following emoji
          charCode = str.charCodeAt(i + 1);
          if ((charCode & 0xF800) === 0xD800) multiByteSequence.push(str.charCodeAt(++i));
          if (str.charCodeAt(i + 1) === VARIATION_SELECTOR) i++;
        }
        codePoints.push(multiByteSequence);
      } else {
        codePoints.push(charCode);
      }
      ++i;
    }
    for (let i = 0; i < codePoints.length; i++) {
      const code = codePoints[i];
      if (code === 32 && measuringState.currentWord.length > 0) {
        measuringState.currentWord = [];
        measuringState.wordLength = 0;
        measuringState.emptySpaceForWord = measuringState.emptySpace;
        measuringState.trailingWhitespaces = [];
      }
      let hit = cache[Array.isArray(code) ? code.join(',') : code];
      if (!hit) {
        if (isMonospace && Array.isArray(code)) {
          hit = fontMetric.defaultCharExtent(morph).width * 2; // for emojis
        } else {
          const metrics = Array.isArray(code) ? fontMetric.measure(morph, code.map(c => String.fromCharCode(c)).join('')) : ctx.measureText(String.fromCharCode(code));
          const writeToCache = document.fonts.status === 'loaded' && morph.allFontsLoaded();
          hit = metrics.width;
          if (writeToCache) cache[Array.isArray(code) ? code.join(',') : code] = hit;
        }
      }

      const tmp = [hit, measuringState.virtualRow];
      measuringState.wordLength += hit;
      if (code !== 32) {
        measuringState.currentWord.push(tmp);
      } else if (measuringState.currentWord.length === 0) measuringState.trailingWhitespaces.push(tmp);

      switch (lineWrapping) {
        case 'only-by-words':
          if (measuringState.emptySpaceForWord < measuringState.wordLength && code !== 32) {
            measuringState.virtualRow++;
            measuringState.currentWord.forEach(entry => entry[1] = measuringState.virtualRow);
            measuringState.trailingWhitespaces.forEach(b => {
              measuringState.wordLength -= b[0];
              b[0] = 0;
            });
            measuringState.emptySpaceForWord = measuringState.emptySpace = emptySpace - measuringState.wordLength;
            measuringState.trailingWhitespaces = [];
            break;
          }
          measuringState.emptySpace -= hit;
          break;
        case 'by-words':
          if (measuringState.wordLength < morph.width) {
            if (measuringState.emptySpaceForWord < measuringState.wordLength && code !== 32) {
              measuringState.virtualRow++;
              measuringState.currentWord.forEach(entry => entry[1] = measuringState.virtualRow);
              measuringState.trailingWhitespaces.forEach(b => {
                measuringState.wordLength -= b[0];
                b[0] = 0;
              });
              measuringState.emptySpaceForWord = measuringState.emptySpace = emptySpace - measuringState.wordLength;
              measuringState.trailingWhitespaces = [];
              break;
            }
            measuringState.emptySpace -= hit;
            break;
          }
        case 'by-chars':
          if (measuringState.emptySpace < hit) {
            measuringState.virtualRow++;
            measuringState.emptySpace = emptySpace;
            if (measuringState.currentWord.length <= 1) measuringState.trailingWhitespaces.forEach(b => b[0] = 0); // too many are injected
            measuringState.trailingWhitespaces = [];
            tmp[1] = measuringState.virtualRow;
          }
          if (measuringState.emptySpace === emptySpace &&
              measuringState.currentWord.length === 0 &&
              measuringState.virtualRow > 0 &&
              code === 32) {
            tmp[0] = hit = 0;
          }
          measuringState.emptySpace -= hit;
      }
      // take into account the available free space and the wrapping style
      result.push(tmp);
      if (Array.isArray(code)) result.push(...arr.genN(code.length - 1, () => [0, measuringState.virtualRow])); // another empty char
    }
    if (styleOpts.paddingRight) {
      const offset = [Number.parseFloat(styleOpts.paddingRight), measuringState.virtualRow];
      offset.isOffset = true;
      measuringState.currentWord.push(offset);
      measuringState.wordLength += offset[0];
      result.push(offset);
    }
    return result;
  }

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
        const width = this.measureTextWidthInCanvas(morph, testStringW);
        const spanH = doc.createElement('span');
        spanH.className = 'line';
        spanH.style.whiteSpace = 'pre';
        if (styleOpts?.fontSize) spanH.style.fontSize = `${styleOpts.fontSize}px`;
        textNode.appendChild(spanH);
        spanH.textContent = testStringH;
        const { height } = spanH.getBoundingClientRect();

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
    const measureOnCanvas = this.canBeMeasuredViaCanvas(morph);
    if (measureOnCanvas) {
      return charBoundsOfLineViaCanvas(line, morph, fontMetric, this); // eslint-disable-line no-use-before-define
    }
    return this.withTextLayerNodeDo(
      morph, renderTextLayerFn, styleOpts,
      styleOpts ? this.generateStyleKey(styleOpts) : this.generateStyleKey(morph),
      (textNode, textNodeOffsetLeft, textNodeOffsetTop) => {
        let lineNode, nodeForMorph, actualTextNode;

        nodeForMorph = $world.env.renderer.getNodeForMorph(morph);
        actualTextNode = nodeForMorph && morph.renderingState.fontMeasureNode;
        const dataRowId = String(line.row);
        lineNode = actualTextNode && Array.from(actualTextNode.children).find(n => n.getAttribute('data-row') === dataRowId);

        const needsToCreateNode = !lineNode || line.lineNeedsRerender;
        let nodeToReplace;
        if (needsToCreateNode) {
          nodeToReplace = lineNode;
          lineNode = renderLineFn(line);
          textNode.appendChild(lineNode);
        } else {
          const tfm = morph.getGlobalTransform().inverse();
          if (tfm.getScale() !== 1 || tfm.getRotation() !== 0) {
            tfm.e = tfm.f = 0;
            actualTextNode.style.transform = tfm.toString();
          }
          ({ top: textNodeOffsetTop, left: textNodeOffsetLeft } = actualTextNode.getBoundingClientRect());
        }

        let result;
        if (line.stringSize > 1000 && !measureOnCanvas) {
          result = charBoundsOfBigMonospacedLine( // eslint-disable-line no-use-before-define
            morph,
            line,
            lineNode,
            offsetX,
            offsetY,
            renderTextLayerFn);
        }
        if (!result) {
          if (measureOnCanvas) {
            result = charBoundsOfLineViaCanvas(line, morph, fontMetric, this); // eslint-disable-line no-use-before-define
          }
          if (!result) {
            result = charBoundsOfLine(line, lineNode, // eslint-disable-line no-use-before-define
              offsetX - textNodeOffsetLeft,
              offsetY - textNodeOffsetTop);
          }
        }

        if (actualTextNode) actualTextNode.style.transform = '';

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
        if (clipMode) clipNode.style.overflow = 'hidden';
        if (width) clipNode.style.width = width + 'px';
        clipNode.id = styleKey;
        clipNode.appendChild(textNode);
        root.appendChild(clipNode);
      } else { root.appendChild(textNode); }
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

export function charBoundsOfLineViaCanvas (line, textMorph, fontMetric, measure) {
  const characterBounds = [];
  const { textAndAttributes } = line;
  const isWrapping = textMorph.lineWrapping !== 'no-wrap';
  const measuringState = measure.getMeasuringState(textMorph);
  for (let i = 0; i < textAndAttributes.length; i += 2) {
    const textOrMorph = textAndAttributes[i];
    let attrs = textAndAttributes[i + 1] || {};
    if (textOrMorph.isMorph) {
      const morphWidth = textOrMorph.width + Number.parseFloat(attrs.paddingLeft || '0') + Number.parseFloat(attrs.paddingRight || '0');
      if (isWrapping && measuringState.emptySpace < morphWidth) {
        measuringState.emptySpace = measure.getEmptySpaceOfMorph(textMorph);
        measuringState.virtualRow += 1;
      } else {
        measuringState.emptySpace -= morphWidth;
      }
      characterBounds.push([textOrMorph.height, [morphWidth, measuringState.virtualRow]]);
    } else if (typeof textOrMorph === 'string') {
      if (obj.isString(attrs.fontSize) && attrs.fontSize.endsWith('%')) {
        attrs.fontSize = Number.parseInt(attrs.fontSize) / 100 * textMorph.fontSize;
      }
      const style = { ...textMorph.defaultTextStyle, ...attrs };
      style.fontSize = Math.max(style.fontSize, textMorph.fontSize);
      measure.measureCharWidthsInCanvas(textMorph, textOrMorph, attrs, measuringState).forEach((res) => {
        characterBounds.push([fontMetric.defaultLineHeight(style), res]);
      });
    } else {
      console.warn('Can not measure', textOrMorph); // eslint-disable-line no-console
    }
  }
  // synthesize the character bounds
  const boundsPerInnerLine = arr.groupBy(characterBounds, b => b[1][1]);
  const result = [];
  let innerLineOffset = 0;
  const paddedSpace = textMorph.padding.right() + textMorph.padding.left();
  let totalWidth = textMorph.width;
  if (!textMorph.fixedWidth) {
    // in this case the padding + longest line defines the total width
    const lineWidth = arr.max(Object.values(boundsPerInnerLine).map(bs => arr.sum(bs.map(b => b[1][0]))));
    if (textMorph.document) totalWidth = (line.width === textMorph.document.width ? lineWidth : textMorph.document.width) + paddedSpace;
  } else {
    totalWidth = Math.max(textMorph.document ? textMorph.document.width + paddedSpace : 0, totalWidth);
  }

  for (let row in boundsPerInnerLine) {
    let currentOffset;
    const rowBounds = boundsPerInnerLine[row];
    const totalWidthOfRow = arr.sum(rowBounds.map(b => b[1][0]));
    const heightOfRow = arr.max(rowBounds.map(b => b[0]));
    switch (textMorph.textAlign) {
      case 'right':
        currentOffset = Math.max(0, totalWidth - paddedSpace - totalWidthOfRow);
        break;
      case 'center':
        currentOffset = Math.max(0, (totalWidth - paddedSpace - totalWidthOfRow) / 2);
        break;
      case 'left':
      default:
        currentOffset = 0;
    }
    result.push(...rowBounds.map(b => {
      const charBounds = pt(currentOffset, innerLineOffset).extent(pt(b[1][0], heightOfRow));
      currentOffset += b[1][0];
      if (b[1].isOffset) return false; // skip since it is not a char bound but just a padding
      return charBounds;
    }).filter(Boolean));
    innerLineOffset += heightOfRow;
  }
  if (result.length === 0) { // empty line
    let left;
    switch (textMorph.textAlign) {
      case 'right':
        left = Math.max(0, totalWidth - paddedSpace);
        break;
      case 'center':
        left = Math.max(0, (totalWidth - paddedSpace) / 2);
        break;
      case 'left':
      default:
        left = 0;
    }
    result.push(rect(left, 0, 1, fontMetric.defaultLineHeight(textMorph)));
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
