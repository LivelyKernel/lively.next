import { eqPosition, lessPosition } from "../text/position.js";
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

export function lineTextAndAttributesDo(attrs, doFn) {
  for (let i = 0; i < attrs.length; i = i+4) {
    let from = attrs[i], to = attrs[i+1], text = attrs[i+2], attr = attrs[i+3];
    doFn(from, to, text, attr);
  }
}

function convertLineTextAndAttributesIntoAttributesWithOffsets(attrs) {
  // [0,3, "foo", {}] => [0,3, {}]
  let result = []
  for (let i = 0; i < attrs.length; i = i+4) {
    let from = attrs[i], to = attrs[i+1], attr = attrs[i+3];
    result.push(from, to, attr);
  }
  return result;
}

export function convertLineTextAndAttributesIntoDocTextAndAttributes(attrs) {
  // [0,3, "foo", {}] => ["foo", {}]
  let result = []
  for (let i = 0; i < attrs.length; i = i+4) {
    let from = attrs[i], to = attrs[i+1], attr = attrs[i+3];
    result.push(from, to, attr);
  }
  return result;
}

export function splitLineTextAndAttributesAt(line, column) {
  // returns a two-item array: left everything that is before column, right trailing
  let t = line.text, length = t.length;
  return line.attributesWithOffsets ?
    splitTextAndAttributesAt(line.textAndAttributes, column) :
    [[0, column, t.slice(0, column), null], [column, length, t.slice(column), null]];
}

export function splitTextAndAttributesAt(textAndAttributes, column) {
  // returns a two-item array: left everything that is before column, right trailing

  let textLength = 0;

  for (let i = 0; i < textAndAttributes.length; i = i+4) {
    let from = textAndAttributes[i+0],
        to = textAndAttributes[i+1],
        text = textAndAttributes[i+2],
        attr = textAndAttributes[i+3];
    textLength = to;
    if (to <= column) continue;
    if (from === column)
      return [textAndAttributes.slice(0, i), textAndAttributes.slice(i)];

    return [
      [...textAndAttributes.slice(0, i), from, column, text.slice(0, column-from), attr],
      [column, to, text.slice(column-from), attr, ...textAndAttributes.slice(i+4)]];
  }

  return [textAndAttributes, [textLength, textLength, "", null]];
}

export function concatLineTextAndAttributes(a, b, mutate = false) {
  // empty suffix?
  if (!a.length || (a.length === 4 && a[0] === a[1]))
    return mutate ? b : b.slice();
  if (!b.length || (b.length === 4 && b[0] === b[1]))
    return mutate ? a : a.slice();

  let offset = a.length ? a[a.length-3] : 0,
      result = mutate ? a : a.slice();
  for (let i = 0; i < b.length; i=i+4) {
    let text = b[i+2], attr = b[i+3],
        newOffset = offset+text.length;
    result.push(offset, newOffset, text, attr);
    offset = newOffset;
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
    let attributesWithOffsets = (line.attributesWithOffsets || (line.attributesWithOffsets = [])),
        textAndAttributes = line.textAndAttributes,
        [before, attrs1] = splitLineTextAndAttributesAt(line, startColumn), after;
    attributesWithOffsets.length = 0;
    textAndAttributes.length = 0;

    lineTextAndAttributesDo(before, (from, to, text, attr) => {
      textAndAttributes.push(from, to, text, attr);
      attributesWithOffsets.push(from, to, attr);
    });

    if (startRow === endRow)
      ([attrs1, after] = splitTextAndAttributesAt(attrs1, endColumn));

    lineTextAndAttributesDo(attrs1, (from, to, text, attr) => {
      let modifiedAttr = modifyFn(line, from, to, attr);
      textAndAttributes.push(from, to, text, modifiedAttr);
      attributesWithOffsets.push(from, to, modifiedAttr)
    });

    // if only one line is affected we return here....
    if (startRow === endRow) {
      lineTextAndAttributesDo(after, (from, to, text, attr) => {
        textAndAttributes.push(from, to, text, attr);
        attributesWithOffsets.push(from, to, attr);
      });
      return;
    }
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // modify lines between startRow and endRow, exclusive
  for (let i = startRow+1; i < endRow; i++) {
    line = line.nextLine();
    let attributesWithOffsets = line.attributesWithOffsets;
    if (!attributesWithOffsets) {
      let modifiedAttr = modifyFn(line, 0, line.text.length, null);
      line.attributesWithOffsets = [0, line.text.length, modifiedAttr];
      continue;
    }
    let textAndAttributes = line.textAndAttributes.slice();
    attributesWithOffsets.length = 0;
    textAndAttributes.length = 0;
    lineTextAndAttributesDo(textAndAttributes, (from, to, text, attr) => {
      let modifiedAttr = modifyFn(line, from, to, attr);
      textAndAttributes.push(from, to, text, modifiedAttr);
      attributesWithOffsets.push(from, to, modifiedAttr);
    });
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // last row
  {
    line = line.nextLine();
    let [attrsLast, after] = splitLineTextAndAttributesAt(line, endColumn),
        textAndAttributes = line.textAndAttributes,
        attributesWithOffsets = (line.attributesWithOffsets || (line.attributesWithOffsets = []));
    attributesWithOffsets.length = 0;
    textAndAttributes.length = 0;

    lineTextAndAttributesDo(attrsLast, (from, to, text, attr) => {
      let modifiedAttr = modifyFn(line, from, to, attr);
      textAndAttributes.push(from, to, text, modifiedAttr);
      attributesWithOffsets.push(from, to, modifiedAttr);
    });

    lineTextAndAttributesDo(after, (from, to, text, attr) => {
      textAndAttributes.push(from, to, text, attr);
      attributesWithOffsets.push(from, to, attr);
    });
  }

}
