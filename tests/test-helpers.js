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
  kerningFor(fontFamily, fontSize, left, right) { return 0 },
}