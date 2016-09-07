import { string, arr } from "lively.lang";
import { lessPosition, lessEqPosition, eqPosition, maxPosition, minPosition } from "./position.js"

const newline = "\n",
      newlineLength = newline.length;

export default class TextDocument {

  static fromString(string) {
    var doc = new TextDocument();
    doc.textString = string;
    return doc;
  }

  static get newline() { return newline; }
  static get newlineLength() { return newlineLength; }
  static parseIntoLines(text) { return text.split(this.newline); }

  constructor(lines = [], styleRanges = []) {
    this.lines = lines;
    this._styleRanges = [];
    styleRanges.map(range => this.addStyleRange(range));
  }

  get textString() { return this.lines.join(TextDocument.newline); }
  set textString(string) { this.lines = TextDocument.parseIntoLines(string); }
  get stringLength() { return this.textString.length; }

  get endPosition() {
    var lines = this.lines, length = lines.length;
    return length ? {
      row: lines.length-1,
      column: lines[lines.length-1].length
    } : {row: 0, column: 0}
  }

  get styleRanges() { return this._styleRanges }

  addStyleRange(range) {
    this._styleRanges.push(range);
    // TODO: Consolidate/deduplicate ranges
  }

  getLine(row) {
    var safeRow = Math.min(Math.max(0, row), this.lines.length-1);
    return this.lines[safeRow];
  }

  positionToIndex(pos, startRow = 0) {
    let {row, column} = this.clipPositionToLines(pos),
        index = 0,
        lines = this.lines,
        maxLength = lines.length-1;
    for (var i = startRow; i < row; i++)
      index += lines[i].length + (i === maxLength ? 0 : TextDocument.newlineLength);
    return index + column;
  }

  indexToPosition(index, startRow = 0) {
    // TextDocument.fromString("hello\nworld").indexToPosition(8)
    if (index < 0) index = 0;
    var lines = this.lines;
    if (lines.length === 0) return {row: 0, column: 0};
    for (var i = startRow, l = lines.length; i < l; i++) {
      index -= lines[i].length + TextDocument.newlineLength;
      if (index < 0)
        return {row: i, column: index + lines[i].length + TextDocument.newlineLength};
    }
    return {row: l-1, column: lines[l-1].length};
  }

  clipPositionToLines({row, column}) {
    let lines = this.lines,
        nLines = lines.length;

    if (nLines === 0) return {row: 0, column: 0};

    if (row < 0) row = 0;
    else if (row >= nLines) row = nLines-1;

    if (column < 0) column = 0;
    else if (column > lines[row].length) column = lines[row].length;

    return {row, column}
  }

  textInRange({start, end}) {
    start = this.clipPositionToLines(start);
    end = this.clipPositionToLines(end);
    if (lessPosition(end, start)) [start, end] = [end, start];

    let {row, column} = start, 
        {row: endRow, column: endColumn} = end,
        lines = this.lines;

    if (row === endRow)
      return column === endColumn ?
        "" : lines[row].slice(column, endColumn);

    let result = lines[row].slice(column);
    for (let i = row+1; i < endRow; i++)
      result += TextDocument.newline + lines[i];
    return result + TextDocument.newline + lines[endRow].slice(0, endColumn);
  }

  setTextInRange(string, range) {
    var {start, end} = range;
    this.remove(range);
    return this.insert(string, start);
  }

  insert(string, pos) {
    let {lines} = this,
        {row, column} = pos,
        line = lines[row],
        insertionLines = TextDocument.parseIntoLines(string);

    if (!line) line = lines[row] = "";

    if (column > line.length)
        line += " ".repeat(column - line.length);

    let end = {row, column},
        before = line.slice(0, column),
        after = line.slice(column),
        firstLine = insertionLines.shift() || "";

    end.column += firstLine.length;
    lines[row] = before + firstLine;

    for (var i = 0; i < insertionLines.length; i++) {
      end.row++;
      end.column = insertionLines[i].length;
      lines.splice(row+1+i, 0, insertionLines[i]);
    }

    lines[row + insertionLines.length] = lines[row + insertionLines.length] + after;

    return {start: pos, end}
  }

  remove({start, end}) {
    var {lines} = this;
    if (!lines.length) return;

    if (lessPosition(end, start)) [start, end] = [end, start];

    let {row: fromRow, column: fromCol} = maxPosition(start, {column: 0, row: 0}),
        {row: toRow, column: toCol} = minPosition(end, this.endPosition);

    if (fromCol < 0) fromCol = 0;
    if (toCol < 0) toCol = 0;

    lines[fromRow] = lines[fromRow].slice(0, fromCol) + lines[toRow].slice(toCol);
    lines.splice(fromRow+1, toRow - fromRow);
  }

  wordsOfLine(row) {
    var line = this.lines[row] || "",
        words = [], word;
    for (var i = 0; i < line.length; i++) {
      if (line[i].match(/\s/)) {
        if (word) {
          word.range.end.column = i;
          words.push(word);
          word = null;
        }
      } else {
        word = (word || {index: words.length, string: "", range: {start: {row, column: i}, end: {row, column: i}}});
        word.string += line[i];
      }
    }
    if (word) { word.range.end.column = i; words.push(word); }
    return words;
  }

  wordAt({row, column}, words = this.wordsOfLine(row)) {
    return words.find(ea => {
      var {range: {start: {column: startCol}, end: {column: endCol}}} = ea;
      return startCol <= column && column <= endCol;
    }) || {range: {start: {column, row}, end: {column, row}}, string: ""};
  }

  wordLeft(pos) {
    var {row, column} = pos,
        words = this.wordsOfLine(row);

    // nothing on this line, find previous word of a line above
    if (!words.length || lessEqPosition(pos, words[0].range.start)) {
      while (--row >= 0) {
        words = this.wordsOfLine(row);
        if (words.length) return arr.last(words);
      }
      return {range: {start: pos, end: pos}, string: ""};
    }
    
    var word = this.wordAt(pos);
    // if there is a word at pos and pos = beginning of word we return the word
    // to the left, otherwise word
    if (word.string)
      return eqPosition(word.range.start, pos) ? words[word.index-1] : word;

    // no word at pos, find the next left word next to pos
    return words.slice().reverse().find(word => word.range.end.column <= column) || {range: {start: pos, end: pos}, string: ""};
  }

  wordRight(pos) {
    var {column, row} = pos,
        words = this.wordsOfLine(pos.row);
    if (!words.length || lessEqPosition(arr.last(words).range.end, pos)) {
      while (++row < this.lines.length) {
        words = this.wordsOfLine(row);
        if (words.length) return words[0];
      }
      return {range: {start: pos, end: pos}, string: ""};
    }
    var word = this.wordAt(pos);
    if (word.string) {
      return eqPosition(word.range.end, pos) ? words[word.index+1] : word;
    }
    return words.find(word => word.range.start.column >= column) || {range: {start: pos, end: pos}, string: ""};
  }

  copy() { return new TextDocument(this.lines.slice()); }

  toString() { return `TextDocument(${string.truncate(this.textString, 60)})`; }
}
