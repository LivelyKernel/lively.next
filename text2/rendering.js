import { defaultStyle, defaultAttributes } from "../rendering/morphic-default.js";
import { h } from "virtual-dom";
import { arr } from "lively.lang";

class Line {

  constructor(text, fontFamily, fontSize, fontMetric) {
    this.text = text;
    this.fontFamily = fontFamily;
    this.fontSize = fontSize;
    this.fontMetric = fontMetric;
    this.width = null;
    this.height = null;
    this.lineLayoutComputed = false;
    this.charLayoutComputed = false;
    this.rendered = null;
  }

  updateText(text, fontFamily, fontSize, fontMetric) {
    if (text === this.text
     && this.fontFamily === fontFamily
     && this.fontSize === fontSize
     && this.fontMetric === fontMetric) return;

    this.charLayoutComputed = false;
    this.lineLayoutComputed = false;
    this.rendered = null;
    this.text = text;
    this.fontFamily = fontFamily;
    this.fontSize = fontSize;
    this.fontMetric = fontMetric;
    return this;
  }

  computeLineLayout() {
    let {height, width} = this.fontMetric.sizeForStr(this.fontFamily, this.fontSize, this.text);
    this.height = height;
    this.width = width;
    this.lineLayoutComputed = true;
    return this;
  }

  render() {
    if (this.rendered) return this.rendered;
    if (!this.lineLayoutComputed) this.computeLineLayout();
    return this.rendered = h("span", {
      style: {pointerEvents: "none", position: "absolute"},
    }, [this.text]);
  }

}

export default class TextRenderer {

  constructor() {
    this.lines = [];
  }

  updateText(string, fontFamily, fontSize, fontMetric) {
    let lines = lively.lang.string.lines(string),
        nRows = lines.length;
    for (let row = 0; row < nRows; row++) {
      this.lines[row] = this.lines[row] ?
        this.lines[row].updateText(lines[row], fontFamily, fontSize, fontMetric) :
        new Line(lines[row], fontFamily, fontSize, fontMetric);
    }
    this.lines.splice(nRows, this.lines.length - nRows)
    return this;
  }

  renderMorph(morph) {
    var {fontFamily, fontSize, textString} = morph;
    this.updateText(textString, fontFamily, fontSize);

    return h('div.text-layer',
      {},
      arr.interpose(this.lines.map(line => line.render()), h("br")))
  }

}



/* -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
this is going towards tokenization, we will do this later in a seperate
tokenizer:

processLine(line, x, y, fontFamily, fontSize) {
  let fontMetric = this.fontMetric,
      rendered = [],
      [text] = line,
      maxHeight = 0,
      state = text === " " ? "space" : "text";

  for (let col = 1; col < line.length; col++) {
    let newState = line[col] === " " ? "space" : "text";
    if (newState !== state) {
      let {height, width} = fontMetric.sizeForStr(fontFamily, fontSize, text);
      rendered.push({x, y, height, text})
      maxHeight = Math.max(maxHeight, height);
      x += width;
      text = line[col];
      state = newState;
    } else {
      text += line[col];
    };
  }

  if (text.length) {
    let {height, width} = fontMetric.sizeForStr(fontFamily, fontSize, text);
    rendered.push({x, y, height, text})
    maxHeight = Math.max(maxHeight, height);
  }

  return {maxHeight, rendered};
}
*/