import { pt, rect } from "lively.graphics";
import { arr, string } from "lively.lang";

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
    this.charMap = [];
    this.kerningMap = [];
    this.element = null;
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

  measure(fontFamily, fontSize, char) {
    var rect = null;
    this.element.innerHTML = char;
    this.element.style.fontFamily = fontFamily;
    this.element.style.fontSize = fontSize + "px";
    try {
      rect = this.element.getBoundingClientRect();
    } catch(e) {
      rect = {width: 0, height:0};
    };
    return {
      height: rect.height,
      width: rect.width
    }
  }

  charBoundsForStr(fontFamily, fontSize, fontKerning, str) {
    let nCols = str.length,
        bounds = new Array(nCols);
    for (let col = 0, x = 0; col < nCols; col++) {
      let width, height;
      if (fontKerning) {
        let prefix = str.substr(0, col+1),
            { width: prefixWidth, height: prefixHeight } = this.measure(fontFamily, fontSize, prefix);
        width = prefixWidth - x;
        height = prefixHeight;
      } else {
        let char = str[col];
        ({ width, height } = this.sizeFor(fontFamily, fontSize, char));
      }
      bounds[col] = { x, y: 0, width, height };
      x += width;
    }
    return bounds;
  }

  sizeFor(fontFamily, fontSize, char) {
    if (char.length > 1)
      return this.sizeForStr(fontFamily, fontSize, false, char);

    if (!this.charMap[fontFamily]) {
      this.charMap[fontFamily] = [];
    }
    if (!this.charMap[fontFamily][fontSize]) {
      this.charMap[fontFamily][fontSize] = [];
    }
    if (!this.charMap[fontFamily][fontSize][char])
      this.charMap[fontFamily][fontSize][char] = this.measure(fontFamily, fontSize, char);
    return this.charMap[fontFamily][fontSize][char];
  }

  sizeForStr(fontFamily, fontSize, fontKerning, str) {
    var height = 0, width = 0,
        defaultLineHeight = this.defaultLineHeight(fontFamily, fontSize);
    for (let line of str.split('\n')) {
      let lineHeight = defaultLineHeight, lineWidth = 0,
          chars = line.split(''), nChars = chars.length;
      for (let charIndex = 0; charIndex < nChars; charIndex++) {
        let char = chars[charIndex],
          { height: charHeight, width: charWidth } = this.sizeFor(fontFamily, fontSize, char);
        if (charHeight > lineHeight) lineHeight = charHeight;
        if (fontKerning) {
          let nextChar = chars[charIndex+1],
              prevChar = chars[charIndex-1],
              kerning  = this.kerningFor(fontFamily, fontSize, ...chars.slice(0, charIndex+2)),
              ligatureOffset = 0;
          if (charIndex % 2 === 0) {
            let prevChar = chars[charIndex-1];
            ligatureOffset = this.ligatureAdjustmentFor(fontFamily, fontSize, prevChar, char, nextChar);
          }
          charWidth += kerning + ligatureOffset;
        }
        lineWidth += charWidth;
      }
      if (lineWidth > width) width = lineWidth;
      height += lineHeight;
    }
    return { height: height, width: width };
  }

  // FIXME? do browsers implement contextual kerning?
  kerningFor(fontFamily, fontSize, ...chars) {
    var left = chars.slice(0, -1).join(''),
        right = chars.slice(-1).join(''),
        measureStr = `${left}${right}`,
        indexStr = `_${measureStr}`;
    if (measureStr.length < 2 || string.lines(measureStr).length !== 1) return 0;
    if (!this.kerningMap[fontFamily]) {
      this.kerningMap[fontFamily] = [];
    }
    if (!this.kerningMap[fontFamily][fontSize]) {
      this.kerningMap[fontFamily][fontSize] = [];
    }
    if (this.kerningMap[fontFamily][fontSize][indexStr] === undefined) {
      let leftWidth = this.measure(fontFamily, fontSize, left).width,
          rightWidth = this.sizeFor(fontFamily, fontSize, right).width,
          totalWidth = this.measure(fontFamily, fontSize, measureStr).width;
      this.kerningMap[fontFamily][fontSize][indexStr] = totalWidth - leftWidth - rightWidth;
    }
    return this.kerningMap[fontFamily][fontSize][indexStr];
  }

  ligatureAdjustmentFor() { return 0 }

  _ligatureAdjustmentFor(fontFamily, fontSize, pre, anchor, next) {
    var measureStr = `${pre}${anchor}${next}`,
        indexStr = `_${measureStr}`;
    if (measureStr.length !== 3 || string.lines(measureStr).length !== 1) return 0;
    if (!this.kerningMap[fontFamily]) {
      this.kerningMap[fontFamily] = [];
    }
    if (!this.kerningMap[fontFamily][fontSize]) {
      this.kerningMap[fontFamily][fontSize] = [];
    }
    if (this.kerningMap[fontFamily][fontSize][indexStr] === undefined) {
      let unadjustedWidth = this.sizeForStr(fontFamily, fontSize, true, measureStr).width,
          measuredWidth = this.measure(fontFamily, fontSize, measureStr).width;
      this.kerningMap[fontFamily][fontSize][indexStr] = measuredWidth - unadjustedWidth;
    }
    return this.kerningMap[fontFamily][fontSize][indexStr];
  }

  asciiSizes(fontFamily, fontSize) {
    var result = {};
    for (var i = 32; i <= 126; i++) {
      var char = String.fromCharCode(i);
      result[char] = this.sizeFor(fontFamily, fontSize, char)
    }
    return result;
  }

  defaultLineHeight(fontFamily, fontSize) {
    return this.sizeFor(fontFamily, fontSize, " ").height;
  }
}
