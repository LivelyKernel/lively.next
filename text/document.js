const newline = "\n",
      newlineLength = newline.length;

export default class TextDocument {

  static fromString(string) {
    var doc = new TextDocument();
    doc.textString = string;
    return doc;
  }

  constructor(lines = []) {
    this.lines = lines;
  }

  parseIntoLines(string) {
    return string.split(newline)
  }

  get textString() { return this.lines.join(newline); }
  set textString(string) { this.lines = this.parseIntoLines(string); }
  get stringLength() { return this.textString.length; }

  positionToIndex({row, column}, startRow = 0) {
    let index = 0,
        lines = this.lines,
        maxLength = lines.length-1;
    row = Math.min(row, maxLength);
    column = Math.min(column, lines[row].length);
    for (var i = startRow; i < row; ++i)
      index += lines[i].length + (i === maxLength ? 0 : newlineLength);
    return index + column;
  }

  indexToPosition(index, startRow = 0) {
    // TextDocument.fromString("hello\nworld").indexToPosition(8)
    var lines = this.lines;
    if (lines.length === 0) return {row: 0, column: 0};
    for (var i = startRow, l = lines.length; i < l; i++) {
      index -= lines[i].length + newlineLength;
      if (index < 0)
        return {row: i, column: index + lines[i].length + newlineLength};
    }
    return {row: l-1, column: lines[l-1].length};
  }

  insert(string, pos) {
    var { lines } = this,
        line = lines[pos.row],
        insertionLines = this.parseIntoLines(string);

    if (!line) line = lines[pos.row] = "";

    if (pos.column > line.length)
        line += " ".repeat(pos.column - line.length);

    var before = line.slice(0, pos.column),
        after = line.slice(pos.column);

    lines[pos.row] = before + insertionLines.shift();
    if (insertionLines.length > 0)
      lines.splice(pos.row+1, 0, ...insertionLines);

    lines[pos.row + insertionLines.length] = lines[pos.row + insertionLines.length] + after;
  }

  remove({row: fromRow, column: fromCol}, {row: toRow, column: toCol}) {
    if (fromRow > toRow || (fromRow === toRow && fromCol > toCol)) {
      [fromRow, fromCol, toRow, toCol] = [toRow, toCol, fromRow, fromCol];
    }

    if (fromCol < 0) fromCol = 0;
    if (toCol < 0) toCol = 0;

    var { lines } = this;
    lines[fromRow] = lines[fromRow].slice(0, fromCol) + lines[toRow].slice(toCol);
    lines.splice(fromRow+1, toRow - fromRow);
  }
}
