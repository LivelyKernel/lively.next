import { arr, string } from "lively.lang"

export var dummyFontMetric = {
  height: 14, width: 6,
  sizeFor(style, text) {
    return {width: this.width, height: this.height}
  },
  charBoundsFor(style, text) {
    var prevX = 0;
    return text.split('').map(function (char, col) {
      let x = prevX,
          { width, height } = this;
      prevX += width;
      return { x, y: 0, width, height };
    }, this);
  },
  defaultLineHeight(style) { return this.height; }
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