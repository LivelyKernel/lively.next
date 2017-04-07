import { arr, string } from "lively.lang"

export var dummyFontMetric = {
  height: 14, width: 6,
  sizeFor(style, text) {
    return {width: this.width*text.length, height: this.height*text.split("\n").length}
  },
  charBoundsFor(style, text) {
    let { width, height } = this;
    if (!text.length) return [{ x: 0, y: 0, width, height }]
    var prevX = 0;
    return text.split('').map(function (char, col) {
      let x = prevX;
      prevX += width;
      return { x, y: 0, width, height };
    }, this);
  },
  defaultCharExtent() {
    let { width, height } = this;
    return { width, height };
  },
  manuallyComputeCharBoundsOfLine(line, offsetX = 0, offsetY = 0, styleOpts, styleKey) {
    return this.charBoundsFor({}, line.text);
  },
  defaultLineHeight(style) { return this.height; },
  isProportional(fontFamily) { return true; },
  reset() {},
  uninstall() {}
}

export function expectSelection(chai) {

  chai.Assertion.addChainableMethod('selectionEquals', function(obj) {
    if (!this._obj || !this._obj.isSelection)
      return this.assert(false, 'not a selection ' + this._obj);

    if (!obj || (!obj.isSelection && typeof obj !== 'string'))
      return this.assert(false, 'not a selection ' + obj);

    var expected  = String(obj),
        actual    = String(this._obj);

    var isOK = expected === actual;

    if (!isOK) {
      if (this._obj.isMultiSelection && this._obj.selections.length === 1)
        isOK = String(this._obj.selections[0]) === expected
    }
  
    return this.assert(
      isOK,
      'expected ' + actual + ' to equal' + expected,
      'expected ' + actual + ' to not equal' + expected,
      expected, actual, true/*show diff*/);
  });

}