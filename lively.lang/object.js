/*
 * Utility functions that help to inspect, enumerate, and create JS objects
 */

import { fromString as functionFromString, asScriptOf, argumentNames } from './function.js';
import { deepEquals as arrayDeepEquals, isSubset, flatten } from './array.js';

// -=-=-=-=-=-=-=-=-
// internal helper
// -=-=-=-=-=-=-=-=-

// serveral methods in lib/object.js are inspired or derived from
// Prototype JavaScript framework, version 1.6.0_rc1
// (c) 2005-2007 Sam Stephenson
// Prototype is freely distributable under the terms of an MIT-style license.
// For details, see the Prototype web site: http://www.prototypejs.org/

function print (object) {
  if (object && Array.isArray(object)) { return '[' + object.map(print) + ']'; }
  if (typeof object !== 'string') { return String(object); }
  let result = String(object);
  result = result.replace(/\n/g, '\\n\\\n');
  result = result.replace(/(")/g, '\\$1');
  result = '\"' + result + '\"';
  return result;
}

function indent (str, indentString, depth) {
  if (!depth || depth <= 0) return str;
  while (depth > 0) { depth--; str = indentString + str; }
  return str;
}

const getOwnPropertyDescriptors = (typeof Object.getOwnPropertyDescriptors === 'function')
  ? Object.getOwnPropertyDescriptors
  : function getOwnPropertyDescriptors (object) {
    const descriptors = {};
    for (const name in object) {
      if (!Object.prototype.hasOwnProperty.call(object, name)) continue;
      Object.defineProperty(descriptors, name, {
        configurable: true,
        enumerable: true,
        writable: true,
        value: Object.getOwnPropertyDescriptor(object, name)
      });
    }
    return descriptors;
  };

// show-in-doc

// -=-=-=-=-
// testing
// -=-=-=-=-

function isArray (obj) { /* show-in-doc */ return Array.isArray(obj); }

function isElement (object) { /* show-in-doc */ return object && object.nodeType == 1; }

function isFunction (object) { /* show-in-doc */ return object instanceof Function; }

function isBoolean (object) { /* show-in-doc */ return typeof object === 'boolean'; }

function isString (object) { /* show-in-doc */ return typeof object === 'string'; }

function isNumber (object) { /* show-in-doc */ return typeof object === 'number'; }

function isUndefined (object) { /* show-in-doc */ return typeof object === 'undefined'; }

function isRegExp (object) { /* show-in-doc */ return object instanceof RegExp; }

function isObject (object) { /* show-in-doc */ return typeof object === 'object'; }

function isPrimitive (obj) {
  // show-in-doc
  if (!obj) return true;
  switch (typeof obj) {
    case 'string':
    case 'number':
    case 'boolean': return true;
  }
  return false;
}

function isEmpty (object) {
  /* show-in-doc */
  for (const key in object) { if (object.hasOwnProperty(key)) return false; }
  return true;
}

function equals (a, b) {
  // Is object `a` structurally equivalent to object `b`? Deep comparison.
  if (a === b) return true;
  if (!a || !b) return a == b;
  if (Array.isArray(a)) return arrayDeepEquals(a, b);
  switch (a.constructor) {
    case String:
    case Date:
    case Boolean:
    case Number: return a == b;
  }
  if (typeof a.isEqualNode === 'function') return a.isEqualNode(b);
  if (typeof a.equals === 'function') return a.equals(b);
  const seenInA = [];
  for (var name in a) {
    seenInA.push(name);
    if (typeof a[name] === 'function') continue;
    if (!equals(a[name], b[name])) return false;
  }
  for (var name in b) {
    if (seenInA.indexOf(name) !== -1) continue;
    if (typeof b[name] === 'function') continue;
    if (!equals(b[name], a[name])) return false;
  }
  return true;
}

// -=-=-=-=-=-
// accessing
// -=-=-=-=-=-

const keys = Object.keys;

function values (object) {
  // Example:
  // var obj1 = {x: 22}, obj2 = {x: 23, y: {z: 3}};
  // obj2.__proto__ = obj1;
  // obj.values(obj1) // => [22]
  // obj.values(obj2) // => [23,{z: 3}]
  return object ? Object.keys(object).map(function (k) { return object[k]; }) : [];
}

function select (obj, keys) {
  // return a new object that copies all properties with `keys` from `obj`
  const selected = {};
  for (let i = 0; i < keys.length; i++) selected[keys[i]] = obj[keys[i]];
  return selected;
}

function dissoc (object, keys) {
  object = object || {};
  const descriptors = getOwnPropertyDescriptors(object);
  for (let i = 0; i < keys.length; i++) {
    if (keys[i] in descriptors) delete descriptors[keys[i]];
  }
  return Object.defineProperties({}, descriptors);
}

function addScript (object, funcOrString, optName, optMapping) {
  const func = functionFromString(funcOrString);
  return asScriptOf(func, object, optName, optMapping);
}

// -=-=-=-=-
// mutation
// -=-=-=-=-
function extend (destination, source) {
  // Add all properties of `source` to `destination`.
  // Example:
  // var dest = {x: 22}, src = {x: 23, y: 24}
  // obj.extend(dest, src);
  // dest // => {x: 23,y: 24}

  let currentCategoryNames = null;
  for (let i = 1; i < arguments.length; i++) {
    if (typeof arguments[i] === 'string') {
      const catName = arguments[i];
      if (!destination.categories) destination.categories = {};
      if (!destination.categories[catName]) destination.categories[catName] = [];
      currentCategoryNames = destination.categories[catName];
      continue;
    }

    var source = arguments[i];
    for (const property in source) {
      const getter = source.__lookupGetter__(property);
      const setter = source.__lookupSetter__(property);
      if (getter) { destination.__defineGetter__(property, getter); }
      if (setter) { destination.__defineSetter__(property, setter); }
      if (getter || setter) { continue; }
      const sourceObj = source[property];
      destination[property] = sourceObj;
      if (currentCategoryNames) { currentCategoryNames.push(property); }
      if (typeof sourceObj === 'function') {
        if (!sourceObj.displayName) { sourceObj.displayName = property; }
        // remember the module that contains the definition
        if (typeof lively !== 'undefined' &&
         lively.Module && lively.Module.current) { sourceObj.sourceModule = lively.Module.current(); }
      }
    }
  }

  return destination;
}

// -=-=-=-=-
// clone
// -=-=-=-=-

function clone (object) {
  // Shallow copy
  if (isPrimitive(object)) return object;
  if (Array.isArray(object)) return Array.prototype.slice.call(object);
  const clone = {};
  for (const key in object) {
    if (object.hasOwnProperty(key)) { clone[key] = object[key]; }
  }
  clone.__proto__ = object.__proto__; // ensure same proto
  return clone;
}

function extract (object, properties, mapFunc) {
  // Takes a list of properties and returns a new object with those
  // properties shallow-copied from object
  const copied = {};
  for (let i = 0; i < properties.length; i++) {
    if (properties[i] in object) {
      copied[properties[i]] = mapFunc
        ? mapFunc(properties[i], object[properties[i]])
        : object[properties[i]];
    }
  }
  return copied;
}

// -=-=-=-=-=-
// inspection
// -=-=-=-=-=-

/**
 * Prints a human-readable representation of `obj`. The printed
 * representation will be syntactically correct JavaScript but will not
 * necessarily evaluate to a structurally identical object. `inspect` is
 * meant to be used while interactivively exploring JavaScript programs and
 * state.
 * @params { Object } object - The JavaScript Object to be inspected.
 * @params { InspectOptions } options -
 *   { Boolean } printFunctionSource - Wether or not to show closures' source code.
 *   { Boolean } escapeKeys - Wether or not to escape special characters.
 *   { Number } maxDepth - The maximum depth upon which to inspect the object.
 *   { Function } customPrinter - Custom print function that returns an
 *                                alternative string representation of values.
 *   { Number } maxNumberOfKeys - Limit the number of keys to be printed of an object.
 *   { Function } keySorter - Custom sorting function to define the order in which
 *                            object key/value pairs are printed.
 */
function inspect (object, options, depth) {
  options = options || {};
  depth = depth || 0;

  if (options.customPrinter) {
    const ignoreSignal = options._ignoreSignal || (options._ignoreSignal = {});
    const continueInspectFn = (obj) => inspect(obj, options, depth + 1);
    const customInspected = options.customPrinter(object, ignoreSignal, continueInspectFn);
    if (customInspected !== ignoreSignal) return customInspected;
  }
  if (!object) return print(object);

  // print function
  if (typeof object === 'function') {
    return options.printFunctionSource
      ? String(object)
      : 'function' + (object.name ? ' ' + object.name : '') +
      '(' + argumentNames(object).join(',') + ') {/*...*/}';
  }

  // print "primitive"
  switch (object.constructor) {
    case String:
    case Boolean:
    case RegExp:
    case Number: return print(object);
  }

  if (typeof object.serializeExpr === 'function') { return object.serializeExpr(); }

  const isArray = object && Array.isArray(object);
  const openBr = isArray ? '[' : '{'; const closeBr = isArray ? ']' : '}';
  if (options.maxDepth && depth >= options.maxDepth) { return openBr + '/*...*/' + closeBr; }

  let printedProps = [];
  if (isArray) {
    printedProps = object.map(function (ea) { return inspect(ea, options, depth + 1); });
  } else {
    let propsToPrint = Object.keys(object)
      .sort(function (a, b) {
        const aIsFunc = typeof object[a] === 'function';
        const bIsFunc = typeof object[b] === 'function';
        if (aIsFunc === bIsFunc) {
          if (a < b) return -1;
          if (a > b) return 1;
          return 0;
        }
        return aIsFunc ? 1 : -1;
      });
    if (typeof options.keySorter === 'function') {
      propsToPrint = propsToPrint.sort(options.keySorter);
    }
    for (let i = 0; i < propsToPrint.length; i++) {
      if (i > (options.maxNumberOfKeys || Infinity)) {
        const hiddenEntryCount = propsToPrint.length - i;
        printedProps.push(`...${hiddenEntryCount} hidden ${hiddenEntryCount > 1 ? 'entries' : 'entry'}...`);
        break;
      }
      const key = propsToPrint[i];
      if (isArray) inspect(object[key], options, depth + 1);
      const printedVal = inspect(object[key], options, depth + 1);
      printedProps.push((options.escapeKeys
        ? JSON.stringify(key)
        : key) + ': ' + printedVal);
    }
  }

  if (printedProps.length === 0) { return openBr + closeBr; }

  let printedPropsJoined = printedProps.join(', ');
  const useNewLines = (!isArray || options.newLineInArrays) &&
        (!options.minLengthForNewLine ||
        printedPropsJoined.length >= options.minLengthForNewLine);
  const ind = indent('', options.indent || '  ', depth);
  const propIndent = indent('', options.indent || '  ', depth + 1);
  const startBreak = useNewLines && !isArray ? '\n' + propIndent : '';
  const eachBreak = useNewLines ? '\n' + propIndent : '';
  const endBreak = useNewLines && !isArray ? '\n' + ind : '';
  if (useNewLines) printedPropsJoined = printedProps.join(',' + eachBreak);
  return openBr + startBreak + printedPropsJoined + endBreak + closeBr;
}

// -=-=-=-=-
// merging
// -=-=-=-=-
function merge (objs) {
  // `objs` can be a list of objects. The return value will be a new object,
  // containing all properties of all objects. If the same property exist in
  // multiple objects, the right-most property takes precedence.
  //
  // Like `extend` but will not mutate objects in `objs`.

  // if objs are arrays just concat them
  // if objs are real objs then merge propertdies
  if (arguments.length > 1) {
    return merge(Array.prototype.slice.call(arguments));
  }

  if (Array.isArray(objs[0])) { // test for all?
    return Array.prototype.concat.apply([], objs);
  }

  return objs.reduce(function (merged, ea) {
    for (const name in ea) {
      if (ea.hasOwnProperty(name)) { merged[name] = ea[name]; }
    }
    return merged;
  }, {});
}

function deepMerge (objA, objB) {
  // `objs` can be a list of objects. The return value will be a new object,
  // containing all properties of all objects. If the same property exist in
  // multiple objects, the right-most property takes precedence.
  //
  // Like `extend` but will not mutate objects in `objs`.

  // if objs are arrays just concat them
  // if objs are real objs then merge propertdies

  if (!objA) return objB;
  if (!objB) return objA;

  if (Array.isArray(objA)) {
    if (!Array.isArray(objB)) return objB;
    let merged = objA.map(function (ea, i) { return deepMerge(ea, objB[i]); });
    if (objB.length > objA.length) merged = merged.concat(objB.slice(objA.length));
    return merged;
  }

  if (typeof objA !== 'object' || typeof objB !== 'object') return objB;

  return Object.keys(objA).concat(Object.keys(objB)).reduce(function (merged, name) {
    if (!objA[name]) merged[name] = objB[name];
    else if (!objB[name]) merged[name] = objA[name];
    else if (typeof objA[name] !== 'object' || typeof objB[name] !== 'object') merged[name] = objB[name];
    else merged[name] = deepMerge(objA[name], objB[name]);
    return merged;
  }, {});
}

function sortKeysWithBeforeAndAfterConstraints (properties, throwErrorOnMissing = false) {
  // Expects `properties` to be a map of keys to objects having optional
  // before/after attributes that, if present, should be lists of other property
  // keys. `sortProperties` will return an ordered list of property keys so
  // that the before / after requirements are fullfilled. If a cyclic
  // dependency is encountered an error will be thrown.
  // Example:
  // ```
  // sortProperties({foo: {}, bar: {after: ["foo"], before: ["baz"]}, "baz": {after: ["foo"]}})
  // // => ["foo","bar","baz"]
  // ```

  // ignore-in-doc
  // 1. convert "before" requirement into "after" and check if all properties
  // mentioned in after/before are actually there
  const keys = []; const props = []; const remaining = [];
  for (const key in properties) {
    const prop = properties[key];
      	 const before = prop.hasOwnProperty('before') ? prop.before : (prop.before = []);
      	 const after = prop.hasOwnProperty('after') ? prop.after : (prop.after = []);

    keys.push(key);
    props.push(prop);

    for (let i = before.length; i--;) {
      const beforePropName = before[i];
      const beforeProp = properties[beforePropName];
      if (!beforeProp) {
    	    console.warn(`[initializeProperties] ${this} sortProperties: ` +
                    `Property ${key} requires to be initialized before ${beforePropName} ` +
                    'but that property cannot be found.');
        before.splice(i, 1);
        continue;
      }
      if (!beforeProp.hasOwnProperty('after')) beforeProp.after = [];
      beforeProp.after.push(key);
    }

    for (let i = after.length; i--;) {
      const afterPropName = after[i];
      const afterProp = properties[afterPropName];
      if (!afterProp) {
    	    console.warn(`[initializeProperties] ${this} sortProperties: ` +
                    `Property ${key} requires to be initialized after ${afterPropName} ` +
                    'but that property cannot be found.');
        after.splice(i, 1);
      }
    }

    remaining.push(key);
  }

  // ignore-in-doc
  // compute order
  const resolvedGroups = [];
  const resolvedKeys = [];
  let lastLength = remaining.length + 1;

  while (remaining.length) {
    if (lastLength === remaining.length) {
      throw new Error('Circular dependencies in handler order, could not resolve properties ' +
                			  remaining.map(key => {
                			    const before = properties[key].before; const after = properties[key].after;
                			    if ((!before || !before.length) && (!after || !after.length)) return '';
                			    let report = `${key}\n`;
                			    if (before && before.length) report += `  - before ${before.join(',')}\n`;
                			    if (after && after.length) report += `  - after ${after.join(',')}\n`;
                			    return report;
                			  }).join(''));
    }
    lastLength = remaining.length;
    const resolvedGroup = [];
    for (let i = remaining.length; i--;) {
      const key = remaining[i];
      if (isSubset(properties[key].after, resolvedKeys)) {
        remaining.splice(i, 1);
        resolvedKeys.push(key);
        resolvedGroup.push(key);
      }
    }
    resolvedGroups.push(resolvedGroup);
  }

  return flatten(resolvedGroups, 1);
}

// -=-=-=-=-=-=-
// inheritance
// -=-=-=-=-=-=-
function inherit (obj) { return Object.create(obj); }

function valuesInPropertyHierarchy (obj, name) {
  // Lookup all properties named name in the proto hierarchy of obj.
  // Example:
  // var a = {foo: 3}, b = Object.create(a), c = Object.create(b);
  // c.foo = 4;
  // obj.valuesInPropertyHierarchy(c, "foo") // => [3,4]
  const result = []; let lookupObj = obj;
  while (lookupObj) {
    if (lookupObj.hasOwnProperty(name)) result.unshift(lookupObj[name]);
    lookupObj = Object.getPrototypeOf(lookupObj);
  }
  return result;
}

function mergePropertyInHierarchy (obj, propName) {
  // like `merge` but automatically gets all definitions of the value in the
  // prototype chain and merges those.
  // Example:
  // var o1 = {x: {foo: 23}}, o2 = {x: {foo: 24, bar: 15}}, o3 = {x: {baz: "zork"}};
  // o2.__proto__ = o1; o3.__proto__ = o2;
  // obj.mergePropertyInHierarchy(o3, "x");
  // // => {bar: 15, baz: "zork",foo: 24}
  return merge(valuesInPropertyHierarchy(obj, propName));
}

function deepCopy (object) {
  // Recursively traverses `object` and its properties to create a copy.
  if (!object || typeof object !== 'object' || object instanceof RegExp) return object;
  const result = Array.isArray(object) ? Array(object.length) : {};
  for (const key in object) {
    if (object.hasOwnProperty(key)) { result[key] = deepCopy(object[key]); }
  }
  return result;
}

// -=-=-=-=-=-=-=-=-
// stringification
// -=-=-=-=-=-=-=-=-
function typeStringOf (obj) {
  // ignore-in-doc
  if (obj === null) return 'null';
  if (typeof obj === 'undefined') return 'undefined';
  return obj.constructor.name;
}

function shortPrintStringOf (obj) {
  // ignore-in-doc
  // primitive values
  if (!isMutableType(obj)) return safeToString(obj);

  // constructed objects
  if (obj.constructor.name !== 'Object' && !Array.isArray(obj)) {
    if (obj.constructor.name) {
      return obj.constructor.name
        ? obj.constructor.name
        : Object.prototype.toString.call(obj).split(' ')[1].split(']')[0];
    }
  }

  // arrays or plain objects
  let typeString = '';

  function displayTypeAndLength (obj, collectionType, firstBracket, secondBracket) {
    if (obj.constructor.name === collectionType) {
      typeString += firstBracket;
      if (obj.length || Object.keys(obj).length) typeString += '...';
      typeString += secondBracket;
    }
  }
  displayTypeAndLength(obj, 'Object', '{', '}');
  displayTypeAndLength(obj, 'Array', '[', ']');
  return typeString;
}

function isMutableType (obj) {
  // Is `obj` a value or mutable type?
  const immutableTypes = ['null', 'undefined', 'Boolean', 'Number', 'String'];
  return immutableTypes.indexOf(typeStringOf(obj)) === -1;
}

function safeToString (obj) {
  // Like `toString` but catches errors.
  try {
    return (obj ? obj.toString() : String(obj)).replace('\n', '');
  } catch (e) { return '<error printing object>'; }
}

function asObject (obj) {
  switch (typeof obj) {
    case 'string':
      return new String(obj);
    case 'boolean':
      return new Boolean(obj);
    case 'number':
      return new Number(obj);
    default:
      return obj;
  }
}

function newKeyIn (obj, base = '_') {
  let i = 1; let key;
  do {
    key = base + '-' + i++;
  } while (key in obj);
  return key;
}

export {
  isArray,
  isElement,
  isFunction,
  isBoolean,
  isString,
  isNumber,
  isUndefined,
  isRegExp,
  isObject,
  isPrimitive,
  isEmpty,
  equals,
  keys,
  values,
  select,
  dissoc,
  addScript,
  extend,
  clone,
  extract,
  inspect,
  merge,
  deepMerge,
  inherit,
  valuesInPropertyHierarchy,
  mergePropertyInHierarchy,
  sortKeysWithBeforeAndAfterConstraints,
  deepCopy,
  typeStringOf,
  shortPrintStringOf,
  isMutableType,
  safeToString,
  asObject,
  newKeyIn,
  getOwnPropertyDescriptors
};
