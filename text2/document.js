import TextTree from "./document-tree.js";

export default class TextDocument {

  static fromString(string) {
    var doc = new TextDocument();
    doc.textString = string;
    return doc;
  }

  static get newline() { return "\n"; }
  static get newlineLength() { return 1; }
  static parseIntoLines(text) { return text.split(this.newline); }

  constructor(textString) {
    var textTreeOptions = {maxLeafSize: 50, minLeafSize: 25, maxNodeSize: 16, minNodeSize: 7};
    this.newline = this.constructor.newline;
    this.lineTree = new TextTree(this.constructor.parseIntoLines(textString), textTreeOptions)
  }

  get lines() {
    var lines = this.lineTree.lines,
        textLines = new Array(lines.length);
    for (var i = 0; i < lines.length; i++)
      textLines[i] = lines[i].text;
    return textLines;
  }
  set lines(lines) { return this.lineTree.lines = lines; }

  get textString() {
     var {lineTree: {lines}, newline} = this,
         textString = lines[0] ? lines[0].text : "";
     for (var i = 1; i < lines.length; i++)
       textString = textString + newline + lines[i].text;
     return textString;
  }

  set textString(string) { this.lines = this.constructor.parseIntoLines(string); }

  get stringLength() { return this.textString.length; }

}
