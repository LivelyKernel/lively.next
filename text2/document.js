import { string, arr } from "lively.lang";
import { lessPosition, lessEqPosition, eqPosition, maxPosition, minPosition } from "./position.js";
import { Range } from "./range.js";
import { TextAttribute } from "./style.js";

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

  constructor(lines = [], textAttributes = []) {
    this.lines = lines;
    this._textAttributes = [];
    this._textAttributesByLine = [];
    textAttributes.map(range => this.addTextAttribute(range));
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

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // TextAttributes

  get textAndAttributes() { return getTextAndAttributes(this); }
  set textAndAttributes(textAndAttributes) { setTextAndAttributes(this, textAndAttributes); }

  get textAttributes() { return this._textAttributes; }
  // NOTE: assumes provided textAttributes are non-overlapping
  set textAttributes(textAttributes) {
    this._textAttributes = textAttributes.sort(Range.compare);
    this._textAttributesByLine = new Array(this.lines.length);

    for (var i = 0; i < textAttributes.length; i++) {
      let attr = textAttributes[i], {start, end} = attr;
      for (let row = start.row; row <= end.row; row++)
        (this._textAttributesByLine[row] || (this._textAttributesByLine[row] = []))
          .push(attr);
    }
  }

  addTextAttribute(textAttr) {
    var {start, end} = textAttr;

    // _textAttributes is sorted by position. To not iterate over the entire
    // attributes array when inserting the new attribute we first try to find
    // an existing attribute in the by-line index if we have found that and it
    // is a shortcut into finding the right position
    var textAttrBefore;
    for (var row = start.row; row >= 0; row--) {
      var attrs = this._textAttributesByLine[row];
      if (attrs && attrs.length && Range.compare(attrs[0], textAttr) <= 0) {
        textAttrBefore = attrs[0];
        break;
      }
    }

    if (textAttrBefore) {
      this._textAttributes.splice(this._textAttributes.indexOf(textAttrBefore)+1, 0, textAttr);
    } else {
      this._textAttributes.unshift(textAttr);
    }

    for (let row = start.row; row <= end.row; row++)
      (this._textAttributesByLine[row] || (this._textAttributesByLine[row] = []))
        .push(textAttr);
  }

  clearTextAttributes() { this._textAttributes = []; this._textAttributesByLine = []; }

  updateLineTextAttributes(row) {
    let { textAttributes } = this,
        text = this.lines[row] || "",
        start = {row, column: 0},
        end = {row, column: text ? text.length : 0},
        lineRange = Range.fromPositions(start, end),
        lineTextAttributes = [];
    for (var i = 0; i < textAttributes.length; i++) {
      let {data, range} = textAttributes[i],
          intersection = lineRange.intersect(range);
      if (intersection.start.row === lineRange.start.row)
        lineTextAttributes.push(new TextAttribute(data, intersection));
    }
    this._textAttributesByLine[row] = Range.sort(lineTextAttributes);
  }

  get textAttributesByLine() { return this._textAttributesByLine; }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

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
      this._textAttributesByLine.splice(row+1+i, 0, []);
    }

    lines[row + insertionLines.length] = lines[row + insertionLines.length] + after;

    let insertionRange = {start: pos, end};

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // text attribute updating...
    // Note that the _textAttributesByLine index can include identical
    // TextAttribute objects on multiple lines so track which one where updated
    // already
    var attrsSeen = [];
    (this._textAttributesByLine[row] || []).forEach(attr => {
      if (attrsSeen.includes(attr)) return;
      attrsSeen.push(attr);
      if (!attr.onInsert(insertionRange)) return;
      for (let i = 0; i < insertionLines.length; i++) {
        let newRow = row+1+i,
            attrsInNewRow = this._textAttributesByLine[newRow];
        // need to maintain the sort order! ....
        if (attr.end.row >= newRow) attrsInNewRow.push(attr);
      }      
    });
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    return insertionRange;
  }

  remove(range) {
    var {start, end} = range, {lines} = this;
    if (!lines.length) return;

    if (lessPosition(end, start)) [start, end] = [end, start];

    let {row: fromRow, column: fromCol} = maxPosition(start, {column: 0, row: 0}),
        {row: toRow, column: toCol} = minPosition(end, this.endPosition);

    if (fromCol < 0) fromCol = 0;
    if (toCol < 0) toCol = 0;

    lines[fromRow] = lines[fromRow].slice(0, fromCol) + lines[toRow].slice(toCol);
    lines.splice(fromRow+1, toRow - fromRow);

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // text attribute updating...    
    // ...those that now have an empty range...
    var attrsToRemove = [], attrsSeen = [];
    for (let row = fromRow; row <= toRow; row++) {
      // Get the attributes for each line. Note that the _textAttributesByLine
      // index can include identical TextAttribute objects on multiple lines...
      let attrs = this._textAttributesByLine[row];
      if (!attrs) continue;
      for (let i = attrs.length-1; i >= 0; i--) {
        let attr = attrs[i];
        // ...this is why we need to keep track of which attribtues we have
        // already seen...
        if (attrsToRemove.includes(attr)) { attrs.splice(i, 1); continue; }
        if (attrsSeen.includes(attr)) continue;
        attrsSeen.push(attr);
        // ...and only inform those about the change once...
        if (!attr.onDelete(range) || !attr.isEmpty()) continue; // not changed or not to remove
        attrsToRemove.push(attr);
        attrs.splice(i, 1);
        // ...and remove them only once as well!
        this._textAttributes.splice(this._textAttributes.indexOf(attr), 1);
      }
    }
    // Last thing: resize the line index.
    this._textAttributesByLine.splice(fromRow+1, toRow - fromRow);
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  }

  wordsOfLine(row) {
    var line = this.lines[row] || "",
        words = [], word,
        isWordDelimiter = char => /[^a-z0-9_]/i.test(char);

    for (var i = 0; i < line.length; i++) {
      if (isWordDelimiter(line[i])) {
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


  scanForward(startPos, matchFn) {
    var {
          endPosition: {row: endRow, column: endColumn},
          lines
        } = this,
        {row, column} = startPos

    // first line
    for (let col = column, line = lines[row]; col < line.length; col++) {
      let char = line[col], pos = {row, column: col},
          result = matchFn(char, pos);
      if (result) return result;
    }

    // the rest
    for (let r = row+1; r < lines.length; r++) {
      let line = lines[r];
      for (let col = 0; col < line.length; col++) {
        let char = line[col], pos = {row: r, column: col},
            result = matchFn(char, pos);
        if (result) return result;
      }
    }

    return null;
  }

  scanBackward(startPos, matchFn) {
    var lines = this.lines,
        {row, column} = startPos

    // first line
    for (let col = column-1, line = lines[row]; col >= 0; col--) {
      let char = line[col], pos = {row, column: col},
          result = matchFn(char, pos);
      if (result) return result;
    }

    // the rest
    for (let r = row-1; r >= 0; r--) {
      let line = lines[r];
      for (let col = line.length-1; col >= 0; col--) {
        let char = line[col], pos = {row: r, column: col},
            result = matchFn(char, pos);
        if (result) return result;
      }
    }

    return null;
  }

  copy() { return new TextDocument(this.lines.slice()); }

  toString() { return `TextDocument(${string.truncate(this.textString, 60)})`; }
}



// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-



function attributesIndexed(doc) {
  // produces a data structure like {row, column, starting: [], ending: []}
  // that lists the beginnging / end of all text attributes in the order in
  // which they occur in the document

  // snap.map(({row, column, starting, ending}) => `[${row}/${column}] starting: ${starting.map(ea => ea.data.id).join(",")} ending: ${ending.map(ea => ea.data.id).join(",")}`).join("\n")

  var attributes = doc.textAttributes,
      attributesByStartLine = [],
      attributesByEndLine = [];
  
  for (var i = 0; i < attributes.length; i++) {
    var {start, end} = attributes[i],
        startList = attributesByStartLine[start.row] || (attributesByStartLine[start.row] = []),
        endList = attributesByEndLine[end.row] || (attributesByEndLine[end.row] = []);  
    startList.push(attributes[i]);
    endList.push(attributes[i]);
  }

  var indexed = [],
      current = [],
      snapStarting = [],
      snapEnding = [],
      lastSnapPos = {row: 0, column: 0}
  
  for (var row = 0; row < doc.lines.length; row++) {
  
    var line = doc.lines[row],
        attributesStarting = attributesByStartLine[row] || [],
        attributesEnding = attributesByEndLine[row] || [];
  
    for (var column = 0; column < line.length; column++) {
      var pos = {row, column}, someStarting = false, someEnding = false;
  
      for (let i = attributesStarting.length-1; i >= 0; i--) {
        let attr = attributesStarting[i];
        if (attr.start.column === column) {
          snapStarting.push(attr);
          someStarting = someStarting || true;
          attributesStarting.splice(i, 1);
        }
      }
  
      for (let i = attributesEnding.length-1; i >= 0; i--) {
        let attr = attributesEnding[i];
        if (attr.end.column === column) {
          snapEnding.push(attr)
          someEnding = someEnding || true;
          attributesEnding.splice(i, 1);
        }
      }
  
      if (someStarting || someEnding) {
        indexed.push({row, column, starting: snapStarting.slice(), ending: snapEnding.slice()});
        lastSnapPos = pos;
        snapStarting.length = 0;
        snapEnding.length = 0;
      }
  
    }
  
    attributesEnding.length && indexed.push({row, column, starting: [], ending: attributesEnding});
  }

  return indexed;
}


function getTextAndAttributes(doc, indexed) {
  // returns a list like [["text", [attribute1, attribute2, ...]], ["...", [...]], ...]
  // that splits the text in attributed ranges

  // currentAttrs.map(([text, attrs]) => `[${attrs.map(ea => ea.data.fontColor).join("-")}]${text}`).join("")
  indexed = (indexed || attributesIndexed(doc)).slice();
  var result = [], active = [], currentText = "", lines = doc.lines;

  if (!indexed.length) return [[lines.join("\n"), []]];

  // preamble
  while (true) {
    if (!indexed.length) break;
    var {row, column, ending, starting} = indexed[0];
    if (row > 0 || row === 0 && column > 0) break;
    active = arr.withoutAll(active, ending).concat(starting);
    indexed.shift();
  }

  for (var row = 0; row < lines.length; row++) {
    var line = doc.lines[row] + "\n";

    for (var column = 0; column < line.length; column++) {
      var pos = {row, column}, next = indexed[0];
      if (!next) break;
      if (next.row === row && next.column === column) {
        indexed.shift();
        result.push([currentText, active.slice()]);
        currentText = "";
        var {starting, ending} = next;
        for (var i = 0; i < ending.length; i++) {
          var idx = active.indexOf(ending[i]);
          if (idx > -1) active.splice(idx, 1);
        }
        for (var i = 0; i < starting.length; i++) {
          if (!active.includes(starting[i]))
            active.push(starting[i]);
        }
      }
      currentText += line[column]
    }
  
    if (!indexed[0]) break;
  }

  if (currentText.length) {
    result.push([currentText, indexed[0] ? indexed[0].ending : []]);
  }

  return result;
}

function setTextAndAttributes(doc, textAndAttributes) {
    var row = 0, column = 0,
        lines = [], currentLine = "",
        activeAttrs = [], attrs = [];

    while (textAndAttributes.length) {
      var [text, attrsOfRange] = textAndAttributes.shift();
      
      for (var i = 0; i < activeAttrs.length; i++) {
        if (!attrsOfRange.includes(activeAttrs[i])) {
          var [attr] = activeAttrs.splice(i, 1);
          attr.end = {row, column};
        }
      }
      
      for (var i = 0; i < attrsOfRange.length; i++) {
        var attr = attrsOfRange[i];
        if (!attrs.includes(attr)) attrs.push(attr);
        if (!activeAttrs.includes(attr)) {
          activeAttrs.push(attr);
          attr.start = {row, column};
        }
      }

      for (var i = 0; i < text.length; i++) {
        var char = text[i];
        if (char === "\n") {
          lines.push(currentLine);
          currentLine = "";
          row++; column = 0;
        } else {
          currentLine += char;
          column++;
        }
      }
    }
    if (currentLine.length) lines.push(currentLine);
    activeAttrs.forEach(attr => attr.end = {row, column});

    doc.lines = lines;
    doc.textAttributes = attrs;
}
