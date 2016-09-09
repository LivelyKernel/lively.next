import { arr, string } from "lively.lang"

export var dummyFontMetric = {
  height: 14, width: 6,
  sizeFor(style, text) {
    return {width: this.width, height: this.height}
  },
  charBoundsFor(style, adjustSpacing, text) {
    var prevX = 0;
    return text.split('').map(function (char, col) {
      let x = prevX,
          { width, height } = this;
      if (col === text.length - 1) width = 0;
      prevX += width;
      return { x, y: 0, width, height };
    }, this);
  }
}
