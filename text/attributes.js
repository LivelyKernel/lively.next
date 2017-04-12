import { eqPosition, lessPosition } from "./position.js";

/*

let t = Date.now()
lively.lang.fun.timeToRunN(() => {
  let attr1 = Math.random() < 0.5 ? {foo: 23} : null;
  let attr2 = Math.random() < 0.5 ? {foo: 23} : null;
  concatAttributePair("hello", attr1, "world", attr2)
}, 500000);
Date.now() - t;

*/

export function shallowEquals(obj1, obj2) {
  if (!obj1 || !obj2) return obj1 == obj2;
  let areEqual = true, seen = {};
  for (let key1 in obj1) {
    seen[key1] = true;
    if (!obj2.hasOwnProperty(key1)
     || obj1[key1] !== obj2[key1])
       { areEqual = false; break; }
  }
  if (areEqual) {
    for (let key2 in obj2) {
      if (seen[key2]) continue;
      if (!obj1.hasOwnProperty(key2)
       || obj1[key2] !== obj2[key2])
         { areEqual = false; break; }
    }
  }
  return areEqual;
}

export function concatAttributePair(text1, attr1, text2, attr2, seperator = "") {
  // concatAttributePair("hello", null, "world", null) => ["helloworld", null]
  // concatAttributePair("hello", null, "world", {foo: 23}) => ["hello", null, "world", {foo: 23}]
  // concatAttributePair("hello", {foo: 23}, "world", {foo: 23}) => ["helloworld", {foo: 23}]
  if (!attr1 && !attr2) return [text1 + seperator + text2, attr1];
  if (attr1 == attr2) return [text1 + seperator + text2, attr1];
  if (!attr1 || !attr2) return [text1 + seperator, attr1, text2, attr2];
  return shallowEquals(attr1, attr2) ?
    [text1 + seperator + text2, attr1] :
    [text1 + seperator, attr1, text2, attr2];
}

export function joinTextAttributes(textAttributes, seperator = "") {
  // takes a list of textAttribtues like [text1, attr1, text2, attr2, ....] and
  // "joins" each text using `seperator`.  Joining means: If `attr1` and `attr2`
  // can be merged (see `concatAttributePair`) then do 
  // text1 + seperator + text2, merge(attr1, attr2) as the text attribute text/attr pair
  if (textAttributes.length <= 2) return textAttributes;
  let result = [], [text, attr] = textAttributes;
  for (let i = 2; i < textAttributes.length; i = i+2) {
    let nextText = textAttributes[i],
        nextAttr = textAttributes[i+1],
        merged = concatAttributePair(text, attr, nextText, nextAttr, seperator);
    if (merged.length === 2) {
      text = merged[0]; attr = merged[1];
    } else {
      result.push(merged[0], merged[1]);
      text = merged[2]; attr = merged[3];
    }
  }
  result.push(text, attr);
  return result;
}


export function splitTextAndAttributesAt(textAndAttributes, column) {
  // returns a two-item array: left everything that is before column, right trailing
  // splitTextAndAttributesAt(["hel", {a: 1}, "lo", {a: 2}], 2)
  //   => [["he", {a: 1}], ["l", {a: 1}, "lo", {a: 2}]]

  let textPos = 0;

  for (let i = 0; i < textAndAttributes.length; i = i+2) {
    let text = textAndAttributes[i],
        textEndPos = textPos + text.length;
    if (textEndPos < column) { textPos = textEndPos; continue; }

    if (textPos === column)
      return [textAndAttributes.slice(0, i), textAndAttributes.slice(i)];

    let attr = textAndAttributes[i+1],
        sliceI = column - textPos,
        before = [...textAndAttributes.slice(0, i), text.slice(0, sliceI), attr],
        after = text.length === sliceI ? textAndAttributes.slice(i+2) :
          [text.slice(column - textPos), attr, ...textAndAttributes.slice(i+2)]
    return [before, after];
  }

  return [textAndAttributes, []];
}

export function splitTextAndAttributesAtColumns(textAndAttributes, columns) {
  // splitTextAndAttributesAtColumns(["hel", {a: 1}, "lo", {a: 2}], [1,2])
  //   => [["h", {a: 1}], ["e", {a: 1}], ["l", {a: 1}, "lo", {a: 2}]]
  // splitTextAndAttributesAtColumns(["hel", {a: 1}, "lo", {a: 2}], [0,2])
  // splitTextAndAttributesAtColumns(["hel", {a: 1}, "lo", {a: 2}], [1,5])
  let current = textAndAttributes,
      offset = 0,
      result = [];
  for (let i = 0; i < columns.length; i++) {
    let [left, right] = splitTextAndAttributesAt(current, columns[i] - offset);
    result.push(left);
    for (let j = 0; j < left.length; j = j+2)
      offset = offset + left[j].length;
    current = right;
  }
  result.push(current);
  return result;
}

export function concatTextAndAttributes(a, b, mutate = false) {
  // empty suffix?
  if (!a.length || (a.length === 2 && a[0] == ""))
    return mutate ? b : b.slice();
  if (!b.length || (b.length === 2 && b[0] == ""))
    return mutate ? a : a.slice();

  let result = mutate ? a : a.slice();
  for (let i = 0; i < b.length; i=i+2) {
    let text = b[i], attr = b[i+1];
    result.push(text, attr);
  }
  return result;
}

export function modifyAttributesInRange(doc, range, modifyFn) {
  let {start, end} = range;
  if (eqPosition(start, end)) return null;
  if (lessPosition(end, start)) [start, end] = [end, start];

  let {row: startRow, column: startColumn} = start,
      {row: endRow, column: endColumn} = end,
      line = doc.getLine(startRow);

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // mixin into first line
  {
    let textAndAttributes = line.textAndAttributes,
        offset = 0,
        [before, attrs1] = splitTextAndAttributesAt(textAndAttributes, startColumn), after;
    // textAndAttributes = []
    textAndAttributes.length = 0;

    textAndAttributesDo(before, (text, attr) => {
      offset = offset + text.length;
      textAndAttributes.push(text, attr);
    });

    if (startRow === endRow)
      [attrs1, after] = splitTextAndAttributesAt(attrs1, endColumn-offset);

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
  for (let i = startRow+1; i < endRow; i++) {
    line = line.nextLine();
    let textAndAttributes = line.textAndAttributes,
        textAndAttributesToModify = textAndAttributes.slice();
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
    let textAndAttributes = line.textAndAttributes,
        [attrsLast, after] = splitTextAndAttributesAt(textAndAttributes, endColumn);
    textAndAttributes.length = 0;

    textAndAttributesDo(attrsLast, (text, attr) =>
      textAndAttributes.push(text, modifyFn(line, attr)));

    textAndAttributesDo(after, (text, attr) =>
      textAndAttributes.push(text, attr));
      
    line._textAttributes = null; // reset cache;
    line.textAndAttributes = joinTextAttributes(textAndAttributes);
  }

}

function textAndAttributesDo(textAndAttributes, doFn) {
  for (let i = 0; i < textAndAttributes.length; i=i+2)
    doFn(textAndAttributes[i], textAndAttributes[i+1]);
}

export function splitTextAndAttributesIntoLines(textAndAttributes, nl = "\n") {
  // splitTextAndAttributesIntoLines(["fooo\nbar", {a: 1}, "ba\nz", {b: 1}])
  // => [["fooo", {a: 1}],
  //     ["bar", {a: 1}, "ba", {b: 1}],
  //     ["z", {b: 1}]]
  if (!textAndAttributes.length) return [];

  let lines = [], attrsSoFar = [];
  for (var i = 0; i < textAndAttributes.length; i = i+2) {
    let text = textAndAttributes[i], attr = textAndAttributes[i+1];
    while (text.length) {
      let lineSplit = text.indexOf(nl);
      if (lineSplit === -1) { attrsSoFar.push(text, attr); break; }

      if (lineSplit > 0)
        attrsSoFar.push(text.slice(0, lineSplit), attr);
      lines.push(attrsSoFar)

      text = text.slice(lineSplit+1/*newlinelength!*/);
      attrsSoFar = [];
    }
  }

  if (attrsSoFar.length) {
    lines.push(attrsSoFar);
  } else {
    let [lastText, lastAttr] = textAndAttributes.slice(-2);
    if (lastText.endsWith(nl)) lines.push(["", lastAttr]);
  }

  return this.lines = lines;
}
