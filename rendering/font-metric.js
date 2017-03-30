import { string, obj } from "lively.lang";


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
    this.cachedBoundsInfo = {};
    this.element = null;
  }

  reset() {
    var doc, parentNode;
    if (this.element) {
      parentNode = this.element.parentNode;
      doc = this.element.ownerDocument;
    }
    this.uninstall()
    this.charMap = {};
    this.cachedBoundsInfo = {};
    if (doc && parentNode)
      this.install(doc, parentNode);
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
        el = this.element,
        rect = null;
    el.textContent = text;
    Object.assign(el.style, {
      fontFamily, fontWeight, fontStyle, textDecoration,
      fontSize: fontSize + "px",
    })
    el.className = textStyleClasses ? textStyleClasses.join(" ") : "";
    var width, height;
    try {
      ({width, height} = el.getBoundingClientRect());
    } catch(e) { return {width: 0, height:0}; };

    return {height, width}
  }

  charBoundsFor(style, str) {
    let nCols = str.length,
        bounds = new Array(nCols),
        { cachedBoundsInfo: { bounds: cachedBounds, str: cachedStr, style: cachedStyle } } = this,
        isMonospace = !this.isProportional(style.fontFamily);

    if (isMonospace) {
      // measuring a single char does not give us a precise width
      var single = this.sizeFor(style, "x", true),
          double = this.sizeFor(style, "xx", true),
          width = double.width - single.width,
          height = single.height, x = 0;
      for (var i = 0; i < nCols; i++) {
        x = width*i;
        bounds[i]= {x, y: 0, width, height};
      }
    } else {
      var useCache = cachedBounds && obj.equals(cachedStyle, style),
          adjustSpacing = !style.fixedCharacterSpacing;

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

// if (window.debugCharBoundsFor) var start = Date.now();

          ({ width, height } = this.sizeFor(style, char));

  // if (window.debugCharBoundsFor) {
  //   var t = Date.now() - start;
  //   window._debugCharBoundsFor.push(`${char} computed in ${t}ms`)
  // }

        }
        bounds[col] = { x, y: 0, width, height };
        x += width;
      }
      if (adjustSpacing) this.cachedBoundsInfo = { bounds, str, style };

    }

    return bounds;
  }

  isProportional(fontFamily) {
    let style = { fontFamily, fontSize: 12 },
        w_width = this.sizeFor(style, 'w').width,
        i_width = this.sizeFor(style, 'i').width;
    return w_width !== i_width;
  }

  sizeFor(style, string, forceCache = false) {
    // Select style properties relevant to individual character size
    let { fontFamily, fontSize,
          fontWeight, fontStyle, textDecoration, textStyleClasses } = style,
        relevantStyle = { fontFamily, fontSize,
                          fontWeight, fontStyle, textDecoration, textStyleClasses };

    if (!forceCache && string.length > 1) return this.measure(relevantStyle, string);

    let className = textStyleClasses ? textStyleClasses.join(" ") : "";
    let styleKey = [fontFamily, fontSize, fontWeight, fontStyle, textDecoration, className].join('-');

    if (!this.charMap[styleKey])
      this.charMap[styleKey] = {};
    if (!this.charMap[styleKey][string])
      this.charMap[styleKey][string] = this.measure(relevantStyle, string);

    return this.charMap[styleKey][string];
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
