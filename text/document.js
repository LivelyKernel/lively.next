import { string } from "lively.lang";
import { lessPosition, eqPosition } from "./position.js"

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

  constructor(lines = []) {
    this.lines = lines;
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

  static delimitWordInStringAt(string, index) {
    if (string.trim().length === 0) return string; // string is entirely whitespace
    var left  = string.slice(0, index+1),
        right = string.slice(index),
        whitespaceAtIndex = string.charAt(index).match(/\s/),
        startRegex = new RegExp(`\\${whitespaceAtIndex ? "s" : "S"}+\$`),
        endRegex = new RegExp(`\\${whitespaceAtIndex ? "S" : "s"}`),
        start = left.search(startRegex),
        end   = right.search(endRegex);
    if (start === -1) start = 0;
    if (end === -1) end = right.length;
    end += index;
    return { start, end };
  }

  delimitWordAt(pos = {row: 0, column: 0}) {
    var { row, column } = pos,
        line = this.getLine(row);
    return this.constructor.delimitWordInStringAt(line, column);
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
    if (!this.lines.length) return;

    if (lessPosition(end, start)) [start, end] = [end, start];

    let {row: fromRow, column: fromCol} = start,
        {row: toRow, column: toCol} = end,
        {lines} = this;

    if (fromCol < 0) fromCol = 0;
    if (toCol < 0) toCol = 0;

    lines[fromRow] = lines[fromRow].slice(0, fromCol) + lines[toRow].slice(toCol);
    lines.splice(fromRow+1, toRow - fromRow);
  }

  copy() { return new TextDocument(this.lines.slice()); }

  toString() { return `TextDocument(${string.truncate(this.textString, 60)})`; }
}
