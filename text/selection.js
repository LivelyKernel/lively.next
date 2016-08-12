"format esm";

export default class Selection {

  constructor(textMorph) {
    this.textMorph = textMorph;
  }

  get range() { return this.textMorph._selection; }
  set range(rangeObj) {
    let morph = this.textMorph;
    morph._selection = rangeObj;
  }

  get start() { return this.range.start; }
  set start(val) { this.range = { start: val, end: this.end }; }

  get end() { return this.range.end }
  set end(val) { this.range = { start: this.start, end: val }; }

  get text() { return this.textMorph.textString.substring(this.start, this.end) }
  set text(val) {
    let { start, end } = this.range,
        morph = this.textMorph;
    if (!this.isCollapsed) {
      morph.deleteText(start, end);
    }
    if (val.length) {
      morph.insertText(start, val);
    }
    this.range = { start: this.start, end: this.start + val.length };
  }

  get isCollapsed() { return this.start === this.end; }
  collapse(index = this.start) { this.range = { start: index, end: index }; }
}
