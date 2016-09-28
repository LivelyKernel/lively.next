import { string, arr } from "lively.lang";
import { lessPosition, lessEqPosition, eqPosition, maxPosition, minPosition } from "./position.js";
import { Range } from "./range.js";
import { TextAttribute } from "./style.js";

export default class TextDocument {

  static fromString(string) {
    var doc = new TextDocument();
    doc.textString = string;
    return doc;
  }

  static get newline() { return "\n"; }
  static get newlineLength() { return 1; }
  static parseIntoLines(text) { return text.split(this.newline); }

  constructor(lines = [], textAttributes = []) {
    this.lines = lines;
    this._textAttributes = [];
    this._textAttributesByLine = [];
    textAttributes.map(range => this.addTextAttribute(range));
  }

  get textString() { return this.lines.join(this.constructor.newline); }
  set textString(string) { this.lines = this.constructor.parseIntoLines(string); }
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

  get textAttributes() { return this._textAttributes; }
  set textAttributes(textAttributes) {
    this.setSortedTextAttributes(textAttributes.sort(Range.compare));
  }
  get textAttributesByLine() { return this._textAttributesByLine; }

  textAttributesChunked(startRow = 0, endRow = this.lines.length-1, withLineEnding = false) {
    // returns an array chunked with chunked.length === lines.length
    // chunked[n] is an array that looks like
    // [startCol1, endCol1, [attr1, attr2, ...], startCol2, endCol2, [attr1, attr3, ...], ...]
    // i.e. it "chunks" and groups the attributes by columns, each
    // start-end-column-chunk marking a canonical text attribute range
    // This is used directly as the input for the text renderer that turns this
    // view on attributes into html elements

    var lines = new Array(endRow), newline = this.constructor.newline;

    // 1. find which attributes are "active" before startRow / 0
    var currentAttributes = [],
        attrsOfLine = this._textAttributesByLine[startRow] || [];
    for (let i = 0; i < attrsOfLine.length; i++) {
      var attr = attrsOfLine[i];
      if (attr.start.row < startRow || attr.start.column < 0)
        currentAttributes.push(attr);
    }

    for (let row = startRow; row <= endRow; row++) {

      attrsOfLine = this._textAttributesByLine[row] || [];
      let attributeChangesByColumn = [],
          content = this.lines[row] || "";
      if (withLineEnding) content += newline;

      // 2. Index the attributes of the current line by column, for each column
      // that has attributes starting or ending, remember those
      for (let i = 0; i < attrsOfLine.length; i++) {
        let attr = attrsOfLine[i],
            {start: {column: startColumn, row: startRow}, end: {column: endColumn, row: endRow}} = attr;
        if (startRow === row && startColumn >= 0) {
          let change = attributeChangesByColumn[startColumn] || (attributeChangesByColumn[startColumn] = {starting: [], ending: []});
          change.starting.push(attr);
        }
        if (endRow === row) {
          let change = attributeChangesByColumn[endColumn] || (attributeChangesByColumn[endColumn] = {starting: [], ending: []});
          change.ending.push(attr);
        }
      }

      let ranges = [], column = 0;

      // don't slip empty lines...
      if (!content.length) {
        ranges.push(0,0, currentAttributes.slice());
      } else {
        let prevCol = 0, endColumn = content.length;

        // 3. Now use the index to construct a data structure that looks like
        // [startCol, endCol, attributes, ...] describing the ranges and "active"
        // attributes for each.
        for (column = 0; column <= endColumn; column++) {
          var change = attributeChangesByColumn[column];
          if (!change) {
            if (column === endColumn)
              ranges.push(prevCol, column, currentAttributes.slice());
            continue;
          }
          let {starting, ending} = change;
          if (column > 0) // prevCol === 0 && column === 0
            ranges.push(prevCol, column, currentAttributes.slice());
          prevCol = column;
          if (ending.length)
            for (let i = 0; i < ending.length; i++)
              currentAttributes.splice(currentAttributes.indexOf(ending[i]), 1)

          if (starting.length)
            currentAttributes.push(...starting);
        }
      }

      lines[row] = ranges;

      if (column <= attributeChangesByColumn.length) {
        for (let i = column; i < attributeChangesByColumn.length; i++) {
          let change = attributeChangesByColumn[i];
          if (!change) continue;
          let {ending, starting} = change;
          if (ending.length)
            for (let i = 0; i < ending.length; i++)
              currentAttributes.splice(currentAttributes.indexOf(ending[i]), 1)
          if (starting.length)
            currentAttributes.push(...starting);
        }
      }
    }

    return lines
  }

  get textAndAttributes() {
    // t.document.textAndAttributes.map(([text, attrs]) => `"${text}"\n${attrs.join("\n")}\n`).join("\n")
    let newline = this.constructor.newline,
        maxRow = this.lines.length-1;
    return arr.flatmap(this.textAttributesChunked(0, maxRow, true), (chunked, row) => {
      if (row === maxRow) newline = "";
      return arr.toTuples(chunked, 3).map(
        ([startCol, endCol, attrs]) =>
          [(this.lines[row] + newline).slice(startCol, endCol), attrs]);
    });

  }

  set textAndAttributes(textAndAttributes) {
    // textAndAttributes are in the form of
    // [["some text", [attr1, attr2, ...]],
   //   [" ", [/*no attributes*/]],
   //   ["some more text", [attr1, attr3, ...]]]
    let row = 0, column = 0,
        lines = [], currentLine = "",
        activeAttrs = [], attrs = [];

    while (textAndAttributes.length) {
      let [text, attrsOfRange] = textAndAttributes.shift();

      for (let i = 0; i < activeAttrs.length; i++) {
        if (!attrsOfRange.includes(activeAttrs[i])) {
          let [attr] = activeAttrs.splice(i, 1);
          attr.end = {row, column};
        }
      }

      for (let i = 0; i < attrsOfRange.length; i++) {
        let attr = attrsOfRange[i];
        if (!attrs.includes(attr)) attrs.push(attr);
        if (!activeAttrs.includes(attr)) {
          activeAttrs.push(attr);
          attr.start = {row, column};
        }
      }

      for (let i = 0; i < text.length; i++) {
        let char = text[i];
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

    this.lines = lines;
    this.textAttributes = attrs;
  }

  setSortedTextAttributes(attributes) {
    // ONLY use if attributes are sorted according to Range.compare!
    // Horrible things will happen otherwise!!
    this._textAttributes = attributes;
    this._textAttributesByLine = new Array(this.lines.length);

    for (var i = 0; i < attributes.length; i++) {
      let attr = attributes[i], {start, end} = attr;
      for (let row = start.row; row <= end.row; row++)
        (this._textAttributesByLine[row] || (this._textAttributesByLine[row] = []))
          .push(attr);
    }
  }

  addTextAttribute(textAttr) {
    this.addSortedTextAttributes([textAttr]);
    return textAttr;
  }

  addTextAttributes(attrs) {
    return this.addSortedTextAttributes(attrs.sort(Range.compare));
  }

  addSortedTextAttributes(attrs) {
    if (!attrs.length) return;
    let textAttributes = this._textAttributes,
        first = attrs[0],
        last = arr.last(attrs);

    // 1. Figure out what the start and end indexes of this._textAttributes are
    // between which we need to insert the new attributes. We look for the
    // attributes between first.start.row and last.end.row since we also have to
    // update the line index later.
    let insertionStart = 0;
    while (insertionStart < textAttributes.length && textAttributes[insertionStart].start.row < first.start.row)
      insertionStart++;

    let insertionEnd = insertionStart;
    while (insertionEnd < textAttributes.length && textAttributes[insertionEnd].start.row <= last.end.row)
      insertionEnd++;

    var newAttributes = textAttributes.slice(insertionStart, insertionEnd).concat(attrs).sort(Range.compare);
    // 2. Insert the new attributes mixed with the old ones sorted.
    this._textAttributes = textAttributes.slice(0, insertionStart).concat(newAttributes).concat(textAttributes.slice(insertionEnd));

    // 3. Update the line index: First reset the line index between the start
    // and end row. However, in the line index might be ranges that start
    // before first.start.row. Those attributes are not in newAttributes and
    // this is why we need to leave them in the index
    var endRow = arr.max(newAttributes, (ea) => ea.end.row).end.row;
    for (let row = first.start.row; row <= endRow; row++) {
      var byLine = this._textAttributesByLine[row] || (this._textAttributesByLine[row] = []),
          i = 0;
      while (i < byLine.length && byLine[i].start.row < first.start.row) i++;
      byLine.length = i;
    }

    // Now that only attributes that start before of the inserted attributes
    // are in the line index we can simply append the new attributes. Since they
    // are already sorted, the correct order is maintained
    for (var i = 0; i < newAttributes.length; i++) {
      let attr = newAttributes[i], {start, end} = attr;
      for (let row = start.row; row <= end.row; row++)
        (this._textAttributesByLine[row] || (this._textAttributesByLine[row] = []))
          .push(attr);
    }

    return attrs;
  }

  removeTextAttribute(attr) {
    // fast for removing a single attribute but when called often with lot's of
    // attributes gets really slow
    var idx = this._textAttributes.indexOf(attr);
    if (idx > -1) this._textAttributes.splice(idx, 1);
    for (let row = attr.start.row; row <= attr.end.row; row++) {
      let attrs = this._textAttributesByLine[row] || [],
          idx = attrs.indexOf(attr);
      if (idx > -1) attrs.splice(idx, 1);
    }
  }

  removeTextAttributes(attrs) {
    // will simply reset it all. Not that the withoutAll filter can be really
    // slow when used with large attribute arrays. For a faster version that
    // requires the attributes to be removed in sorted order see the attribute
    // cleanup code at the end of Document>>remove
    this.setSortedTextAttributes(arr.withoutAll(this._textAttributes, attrs));
  }

  resetTextAttributes() { this._textAttributes = []; this._textAttributesByLine = []; }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  getLine(row) {
    var safeRow = Math.min(Math.max(0, row), this.lines.length-1);
    return this.lines[safeRow];
  }

  positionToIndex(pos, startRow = 0) {
    let {row, column} = this.clipPositionToLines(pos),
        index = 0,
        lines = this.lines,
        maxLength = lines.length-1,
        newlineLength = this.constructor.newlineLength;
    for (var i = startRow; i < row; i++)
      index += lines[i].length + (i === maxLength ? 0 : newlineLength);
    return index + column;
  }

  indexToPosition(index, startRow = 0) {
    // TextDocument.fromString("hello\nworld").indexToPosition(8)
    if (index < 0) index = 0;
    var lines = this.lines,
        newlineLength = this.constructor.newlineLength;
    if (lines.length === 0) return {row: 0, column: 0};
    for (var i = startRow, l = lines.length; i < l; i++) {
      index -= lines[i].length + newlineLength;
      if (index < 0)
        return {row: i, column: index + lines[i].length + newlineLength};
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
        lines = this.lines,
        newline = this.constructor.newline;

    if (row === endRow)
      return column === endColumn ?
        "" : lines[row].slice(column, endColumn);

    let result = lines[row].slice(column);
    for (let i = row+1; i < endRow; i++)
      result += newline + lines[i];
    return result + newline + lines[endRow].slice(0, endColumn);
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
        insertionLines = this.constructor.parseIntoLines(string);

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
    for (let i = this._textAttributes.length-1; i >= 0; i--) {
      let attr = this._textAttributes[i];
      // since the attributes are sorted we know that no other attr that needs
      // update is in _textAttributes but not in _textAttributesByLine
      if (attr.start.row <= row) break;
      attr.onInsert(insertionRange);
    }
    var attrsSeen = [];
    (this._textAttributesByLine[row] || (this._textAttributesByLine[row] = [])).forEach(attr => {
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


    // here we update and remove the text attributes that are affected by the
    // removal.
    var rangesToRemove = [],
        currentRangeStart = undefined, currentRangeEnd = undefined,
        textAttributes = this._textAttributes;

    // first lets find the indexes of the attributes that need to be removed.
    // Removing every one of them individually via splice or even filtering
    // them is slow for large attribute arrays. Instead of doing this we build
    // a list of start end indexes in the _textAttributes array that mark the
    // ranges to be removed. Those can be non-consecutive b/c text attributes
    // are sorted by Range.compare.
    // Given attributes a = range(0,0,0,1), b = range(0,1,0,4), c = range(0,2,0,3).
    // Sorted _textAttributes = [a,b,c]
    // If we remove range(0,0,0,3) attributes a and c would be both empty (range(0,0,0,0))
    // and would need to be removed. Attribute b however would be range(0,0,0,1) and stay.
    // The range intervals we will determine for this case are [[0,1], [1,2]]
    for (var i = 0; i < textAttributes.length; i++) {
      var ea = textAttributes[i];
      if (ea.onDelete(range) && ea.isEmpty()) {
        if (currentRangeStart === undefined)
          currentRangeStart = i;
        currentRangeEnd = i + 1;
      } else {
        if (currentRangeStart !== undefined) {
          rangesToRemove.push([currentRangeStart, currentRangeEnd]);
          currentRangeStart = currentRangeEnd = undefined;
        }
      }
    }

    if (currentRangeStart !== undefined)
      rangesToRemove.push([currentRangeStart, currentRangeEnd]);

    // build new textAttributes array
    rangesToRemove.reverse().forEach(([i,j]) =>
      textAttributes = textAttributes.slice(0,i).concat(textAttributes.slice(j)))
    // set it, new _textAttributesByLine index will be build there
    this.setSortedTextAttributes(textAttributes);
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
