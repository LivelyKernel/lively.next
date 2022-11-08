import { eqPosition, lessPosition } from './position.js';

/*

let t = Date.now()
lively.lang.fun.timeToRunN(() => {
  let attr1 = Math.random() < 0.5 ? {foo: 23} : null;
  let attr2 = Math.random() < 0.5 ? {foo: 23} : null;
  concatAttributePair("hello", attr1, "world", attr2)
}, 500000);
Date.now() - t;

*/

function textAndAttributesDo (textAndAttributes, doFn) {
  for (let i = 0; i < textAndAttributes.length; i = i + 2) { doFn(textAndAttributes[i], textAndAttributes[i + 1]); }
}

export function shallowEquals (obj1, obj2) {
  if (!obj1 || !obj2) return obj1 === obj2;
  let areEqual = true; const seen = {};
  for (const key1 in obj1) {
    seen[key1] = true;
    if (!obj2.hasOwnProperty(key1) ||
     obj1[key1] !== obj2[key1]) { areEqual = false; break; }
  }
  if (areEqual) {
    for (const key2 in obj2) {
      if (seen[key2]) continue;
      if (!obj1.hasOwnProperty(key2) ||
       obj1[key2] !== obj2[key2]) { areEqual = false; break; }
    }
  }
  return areEqual;
}

export function concatAttributePair (text1, attr1, text2, attr2, seperator = '') {
  // concatAttributePair("hello", null, "world", null) => ["helloworld", null]
  // concatAttributePair("hello", null, "world", {foo: 23}) => ["hello", null, "world", {foo: 23}]
  // concatAttributePair("hello", {foo: 23}, "world", {foo: 23}) => ["helloworld", {foo: 23}]
  // concatAttributePair({}, {foo: 23}, "world", {foo: 23}) =>  [{}, {foo: 23}, "world", {foo: 23}]
  // concatAttributePair({}, {foo: 23}, {}, {foo: 23}) =>  [{}, {foo: 23}, {}, {foo: 23}]
  const isObj1 = typeof text1 !== 'string';
  const isObj2 = typeof text2 !== 'string';

  if (isObj1 || isObj2) {
    const result = [];
    if (isObj1) {
      result.push(text1, attr1);
    } else result.push(text1 + seperator, attr1);
    if (isObj2) {
      result.push(text2, attr2);
    } else result.push(text2 + seperator, attr2);
    return result;
  }

  if (!attr1 && !attr2) return [text1 + seperator + text2, attr1];
  if (attr1 === attr2) return [text1 + seperator + text2, attr1];
  if (!attr1 || !attr2) return [text1 + seperator, attr1, text2, attr2];
  return shallowEquals(attr1, attr2)
    ? [text1 + seperator + text2, attr1]
    : [text1 + seperator, attr1, text2, attr2];
}

export function joinTextAttributes (textAttributes, seperator = '') {
  // takes a list of textAttribtues like [text1, attr1, text2, attr2, ....] and
  // "joins" each text using `seperator`.  Joining means: If `attr1` and `attr2`
  // can be merged (see `concatAttributePair`) then do
  // text1 + seperator + text2, merge(attr1, attr2) as the text attribute text/attr pair
  if (textAttributes.length <= 2) return textAttributes;
  const result = []; let [text, attr] = textAttributes;
  for (let i = 2; i < textAttributes.length; i = i + 2) {
    const nextText = textAttributes[i];
    const nextAttr = textAttributes[i + 1];
    const merged = concatAttributePair(text, attr, nextText, nextAttr, seperator);
    if (merged.length <= 2) {
      text = merged[0]; attr = merged[1];
    } else {
      result.push(...merged.slice(0, -2));
      [text, attr] = merged.slice(-2);
    }
  }
  result.push(text, attr);
  return result;
}

export function splitTextAndAttributesAt (textAndAttributes, column) {
  // returns a two-item array: left everything that is before column, right trailing
  // splitTextAndAttributesAt(["hel", {a: 1}, "lo", {a: 2}], 2)
  //   => [["he", {a: 1}], ["l", {a: 1}, "lo", {a: 2}]]

  let textPos = 0;

  for (let i = 0; i < textAndAttributes.length; i = i + 2) {
    const text = textAndAttributes[i];
    const textEndPos = textPos + (typeof text === 'string' ? text.length : 1);
    if (textEndPos < column) { textPos = textEndPos; continue; }

    if (textPos === column) { return [textAndAttributes.slice(0, i), textAndAttributes.slice(i)]; }
    if (textEndPos === column) { return [textAndAttributes.slice(0, i + 2), textAndAttributes.slice(i + 2)]; }

    if (typeof text !== 'string') { throw new Error(`Assuming text is a string for splitting it, got ${text} instead!`); }

    const attr = textAndAttributes[i + 1];
    const sliceI = column - textPos;
    const before = [...textAndAttributes.slice(0, i), text.slice(0, sliceI), attr];
    const after = text.length === sliceI
      ? textAndAttributes.slice(i + 2)
      : [text.slice(column - textPos), attr, ...textAndAttributes.slice(i + 2)];
    return [before, after];
  }

  return [textAndAttributes, []];
}

export function splitTextAndAttributesAtColumns (textAndAttributes, columns) {
  // splitTextAndAttributesAtColumns(["hel", {a: 1}, "lo", {a: 2}], [1,2])
  //   => [["h", {a: 1}], ["e", {a: 1}], ["l", {a: 1}, "lo", {a: 2}]]
  // splitTextAndAttributesAtColumns(["hel", {a: 1}, "lo", {a: 2}], [0,2])
  // splitTextAndAttributesAtColumns(["hel", {a: 1}, "lo", {a: 2}], [1,5])
  let current = textAndAttributes;
  let offset = 0;
  const result = [];
  for (let i = 0; i < columns.length; i++) {
    const [left, right] = splitTextAndAttributesAt(current, columns[i] - offset);
    result.push(left);
    for (let j = 0; j < left.length; j = j + 2) { offset = offset + (typeof left[j] === 'string' ? left[j].length : 1); }
    current = right;
  }
  result.push(current);
  return result;
}

export function concatTextAndAttributes (a, b, mutate = false) {
  // empty suffix?
  if (!a.length || (a.length === 2 && a[0] === '')) { return mutate ? b : b.slice(); }
  if (!b.length || (b.length === 2 && b[0] === '')) { return mutate ? a : a.slice(); }

  const result = mutate ? a : a.slice();
  for (let i = 0; i < b.length; i = i + 2) {
    const text = b[i]; const attr = b[i + 1];
    result.push(text, attr);
  }
  return result;
}

export function modifyAttributesInRange (doc, range, modifyFn) {
  let { start, end } = range;
  if (eqPosition(start, end)) return null;
  if (lessPosition(end, start)) [start, end] = [end, start];

  const { row: startRow, column: startColumn } = start;
  const { row: endRow, column: endColumn } = end;
  let line = doc.getLine(startRow);

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // mixin into first line
  {
    const textAndAttributes = line.textAndAttributes;
    let offset = 0;
    let [before, attrs1] = splitTextAndAttributesAt(textAndAttributes, startColumn); let after;
    // textAndAttributes = []
    textAndAttributes.length = 0;

    textAndAttributesDo(before, (text, attr) => {
      offset = offset + (typeof text === 'string' ? text.length : 1);
      textAndAttributes.push(text, attr);
    });

    if (startRow === endRow) { [attrs1, after] = splitTextAndAttributesAt(attrs1, endColumn - offset); }

    textAndAttributesDo(attrs1, (text, attr) =>
      textAndAttributes.push(text, modifyFn(line, attr)));

    // if only one line is affected we return here....
    if (startRow === endRow) {
      textAndAttributesDo(after, (text, attr) =>
        textAndAttributes.push(text, attr));
    }

    line._textAttributes = null; // reset cache;
    line.textAndAttributes = joinTextAttributes(textAndAttributes);

    if (startRow === endRow) return;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // modify lines between startRow and endRow, exclusive
  for (let i = startRow + 1; i < endRow; i++) {
    line = line.nextLine();
    const textAndAttributes = line.textAndAttributes;
    const textAndAttributesToModify = textAndAttributes.slice();
    textAndAttributes.length = 0;
    textAndAttributesDo(textAndAttributesToModify, (text, attr) =>
      textAndAttributes.push(text, modifyFn(line, attr)));
    line._textAttributes = null; // reset cache;
    line.textAndAttributes = joinTextAttributes(textAndAttributes);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // last row
  {
    line = line.nextLine();
    const textAndAttributes = line.textAndAttributes;
    const [attrsLast, after] = splitTextAndAttributesAt(textAndAttributes, endColumn);
    textAndAttributes.length = 0;

    textAndAttributesDo(attrsLast, (text, attr) =>
      textAndAttributes.push(text, modifyFn(line, attr)));

    textAndAttributesDo(after, (text, attr) =>
      textAndAttributes.push(text, attr));

    line._textAttributes = null; // reset cache;
    line.textAndAttributes = joinTextAttributes(textAndAttributes);
  }
}

export function splitTextAndAttributesIntoLines (textAndAttributes, nl = '\n') {
  // splitTextAndAttributesIntoLines(["fooo\nbar", {a: 1}, "ba\nz", {b: 1}])
  // => [["fooo", {a: 1}],
  //     ["bar", {a: 1}, "ba", {b: 1}],
  //     ["z", {b: 1}]]
  if (!textAndAttributes.length) return [];

  const lines = []; let attrsSoFar = [];
  for (let i = 0; i < textAndAttributes.length; i = i + 2) {
    let text = textAndAttributes[i]; const attr = textAndAttributes[i + 1];

    if (typeof text !== 'string') { attrsSoFar.push(text, attr); continue; }

    while (text.length) {
      const lineSplit = text.indexOf(nl);
      if (lineSplit === -1) { attrsSoFar.push(text, attr); break; }

      if (lineSplit > 0) { attrsSoFar.push(text.slice(0, lineSplit), attr); }
      lines.push(attrsSoFar);

      text = text.slice(lineSplit + 1/* newlinelength! */);
      attrsSoFar = [];
    }
  }

  if (attrsSoFar.length) {
    lines.push(attrsSoFar);
  } else {
    const [lastText, lastAttr] = textAndAttributes.slice(-2);
    if (typeof lastText === 'string' && lastText.endsWith(nl)) { lines.push(['', lastAttr]); }
  }

  return lines;
}

export function textAndAttributesWithSubRanges (start, textAndAttributes) {
  // textAndAttributesWithSubRanges(that.selection.start, that.textAndAttributesInRange())
  let { column, row } = start;
  const ranges = []; const textAndAttributesIntoLines = [];
  for (const lineTextAndAttributes of splitTextAndAttributesIntoLines(textAndAttributes)) {
    for (let i = 0; i < lineTextAndAttributes.length; i = i + 2) {
      const part = lineTextAndAttributes[i];
      const endColumn = column + (typeof part === 'string' ? part.length : 1);
      ranges.push({ start: { row, column }, end: { row, column: endColumn } });
      textAndAttributesIntoLines.push(lineTextAndAttributes[i], lineTextAndAttributes[i + 1]);
      column = endColumn;
    }
    column = 0;
    row++;
  }
  return { ranges, textAndAttributes: textAndAttributesIntoLines };
}

export function containsMorph (textAndAttributes) {
  return textAndAttributes
    .flat()
    .map(element => element && element.isMorph)
    .some(elem => elem === true);
}
