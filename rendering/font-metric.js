import { pt, rect } from "lively.graphics";
import { arr, string, obj } from "lively.lang";


export default class FontMetric {

  static default() {
    if (!this._fontMetric)
      throw new Error("FontMetric has not yet been initialized!")
    return this._fontMetric;
  }

  static initDefault(domEnv) {
    if (!this._fontMetric) {
      if (!domEnv && typeof document === "undefined")
        throw new Error("Cannot initialize FontMetric without document");
      if (!domEnv) domEnv = {document}
      this._fontMetric = this.forDOMEnv(domEnv);
    }
    return this._fontMetric;
  }

  static removeDefault() {
    if (this._fontMetric) {
      this._fontMetric.uninstall();
      this._fontMetric = null;
    }
  }

  static forDOMEnv({document}) {
    var fontMetric = new FontMetric();
    fontMetric.install(document, document.body);
    return fontMetric;
  }

  constructor() {
    this.charMap = {};
    this.element = null;
    this.cachedBoundsInfo = {};
  }

  install(doc, parentEl) {
    this.element = doc.createElement("div");
    this.element.name = "fontMetric";
    this.setMeasureNodeStyles(this.element.style, true);
    parentEl.appendChild(this.element);
  }

  uninstall() {
    if (!this.element) return
    if (this.element.parentNode) this.element.parentNode.removeChild(this.element);
    this.element = null;
  }

  setMeasureNodeStyles(style, isRoot) {
    style.width = style.height = "auto";
    style.left = style.top = "0px";
    style.visibility = "hidden";
    style.position = "absolute";
    style.whiteSpace = "pre";
    style.font = "inherit";
    style.overflow = isRoot ? "hidden" : "visible";
  }

  measure(style, text) {
    var { fontFamily, fontSize, fontWeight, fontStyle, textDecoration, textStyleClasses } = style,
        rect = null;
    this.element.textContent = text;
    this.element.style.fontFamily = fontFamily;
    this.element.style.fontSize = fontSize + "px";
    this.element.style.fontWeight = fontWeight,
    this.element.style.fontStyle = fontStyle,
    this.element.style.textDecoration = textDecoration;
    this.element.className = textStyleClasses ? textStyleClasses.join(" ") : "";
    var width, height;
    try {
      ({width, height} = this.element.getBoundingClientRect());
    } catch(e) { return {width: 0, height:0}; };
    return {height, width}
  }

  charBoundsFor(style, str) {
    let nCols = str.length,
        bounds = new Array(nCols),
        { cachedBoundsInfo: { bounds: cachedBounds, str: cachedStr, style: cachedStyle } } = this,
        useCache = cachedBounds && obj.equals(cachedStyle, style),
        fontIsProportional = this.isProportional(style.fontFamily),
        adjustSpacing = fontIsProportional && !style.fixedCharacterSpacing;
    for (let col = 0, x = 0; col < nCols; col++) {
      let width, height, char = str[col];
      if (adjustSpacing) {
        useCache = useCache && char === cachedStr[col];
        if (useCache)
          ({ width, height } = cachedBounds[col]);
        else {
          let prefix = str.substr(0, col+1);
          ({ width, height } = this.measure(style, prefix));
          width -= x;
        }
      } else {
        ({ width, height } = this.sizeFor(style, char));
      }
      bounds[col] = { x, y: 0, width, height };
      x += width;
    }
    if (adjustSpacing) this.cachedBoundsInfo = { bounds, str, style };
    return bounds;
  }

  isProportional(fontFamily) {
    let style = { fontFamily, fontSize: 12 },
        w_width = this.sizeFor(style, 'w').width,
        i_width = this.sizeFor(style, 'i').width;
    return w_width !== i_width;
  }

  sizeFor(style, char) {
    // Select style properties relevant to individual character size
    let { fontFamily, fontSize,
          fontWeight, fontStyle, textDecoration, textStyleClasses } = style,
        relevantStyle = { fontFamily, fontSize,
                          fontWeight, fontStyle, textDecoration, textStyleClasses };

    if (char.length > 1) return this.measure(relevantStyle, char);

    let className = textStyleClasses ? textStyleClasses.join(" ") : "";
    let styleKey = [fontFamily, fontSize, fontWeight, fontStyle, textDecoration, className].join('-');

    if (!this.charMap[styleKey])
      this.charMap[styleKey] = {};
    if (!this.charMap[styleKey][char])
      this.charMap[styleKey][char] = this.measure(relevantStyle, char);

    return this.charMap[styleKey][char];
  }

  asciiSizes(style) {
    var result = {};
    for (var i = 32; i <= 126; i++) {
      var char = String.fromCharCode(i);
      result[char] = this.sizeFor(style, char)
    }
    return result;
  }

  defaultLineHeight(style) {
    return this.sizeFor(style, " ").height;
  }

}
