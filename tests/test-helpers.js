import { arr, string } from "lively.lang"

export var dummyFontMetric = {
  height: 14, width: 6,
  sizeForStr(fontFamily, fontSize, fontKerning, text) {
    // ea char 10*10
    var lines = string.lines(text),
        maxCols = arr.max(lines, line => line.length).length;
    return {width: maxCols*this.width, height: lines.length*this.height}
  },
  sizeFor(fontFamily, fontSize, text) {
    return {width: this.width, height: this.height}
  },
  charBoundsForStr(fontFamily, fontSize, fontKerning, text) {
    var prevX = 0;
    return text.split('').map(function (char, col) {
      let x = prevX,
          { width, height } = this;
      if (col === text.length - 1) width = 0;
      prevX += width;
      return { x, y: 0, width, height };
    }, this);
  },
  kerningFor: () => 0,
  ligatureAdjustmentFor: () => 0
}
