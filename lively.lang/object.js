/**
 * Utility functions that help to inspect, enumerate, and create JS objects
 * @module lively.lang/object
 */

import { fromString as functionFromString, asScriptOf, argumentNames } from './function.js';
import { deepEquals as arrayDeepEquals, isSubset } from './array.js';

// -=-=-=-=-=-=-=-=-
// internal helper
// -=-=-=-=-=-=-=-=-

// serveral methods in lib/object.js are inspired or derived from
// Prototype JavaScript framework, version 1.6.0_rc1
// (c) 2005-2007 Sam Stephenson
// Prototype is freely distributable under the terms of an MIT-style license.
// For details, see the Prototype web site: http://www.prototypejs.org/

/**
 * Returns a stringified representation of an object.
 * @param { object } object - The object to generate a stringified representation for.
 * @returns { string } The stringified, formatted representation of the object.
 */
function print (object) {
  if (object && Array.isArray(object)) { return '[' + object.map(print) + ']'; }
  if (typeof object !== 'string') { return String(object); }
  let result = String(object);
  result = result.replace(/\n/g, '\\n\\\n');
  result = result.replace(/(")/g, '\\$1');
  result = '\"' + result + '\"';
  return result;
}

/**
 * Shifts the string a number of times to the right by the contents of `indentString`.
 * @param { string } str - The string whose contents to shift.
 * @param { string } indentString - The string to insert on the left.
 * @param { number } depth - The number of times to indent `str` by.
 */
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

// -=-=-=-=-
// testing
// -=-=-=-=-

function isArray (obj) { return Array.isArray(obj); }

function isElement (object) { return object && object.nodeType === 1; }

function isFunction (object) { return object instanceof Function; }

function isBoolean (object) { return typeof object === 'boolean'; }

function isString (object) { return typeof object === 'string'; }

function isNumber (object) { return typeof object === 'number'; }

function isUndefined (object) { return typeof object === 'undefined'; }

function isRegExp (object) { return object instanceof RegExp; }

function isObject (object) { return typeof object === 'object'; }

function isPrimitive (obj) {
  if (!obj) return true;
  switch (typeof obj) {
    case 'string':
    case 'number':
    case 'boolean': return true;
  }
  return false;
}

function isEmpty (object) {
  for (const key in object) { if (object.hasOwnProperty(key)) return false; }
  return true;
}

/**
 * Is object `a` structurally equivalent to object `b`?. Performs a deep comparison.
 * Functions are completely ignored, with regards to both their implementation and existence/name!
 * @param { object } a - The first object to compare.
 * @param { object } b - The second object to compare.
 * @returns { boolean }
 */
function equals (a, b) {
  if (a === b) return true;
  if (!a || !b) return a === b;
  if (Array.isArray(a)) return arrayDeepEquals(a, b);
  switch (a.constructor) {
    case String:
    case Date:
    case Boolean:
    case Number: return a === b;
  }
  if (typeof a.isEqualNode === 'function') return a.isEqualNode(b);
  if (typeof a.equals === 'function') return a.equals(b);

  const seenInA = [];
  for (let name in a) {
    seenInA.push(name);
    if (typeof a[name] === 'function') continue;
    if (!equals(a[name], b[name])) return false;
  }
  for (let name in b) {
    if (seenInA.indexOf(name) !== -1) continue; // key existed in A, we already compared successfully above
    if (typeof b[name] === 'function') continue;
    return false; // we have not seen key in A, thus objects **cannot** be equal
  }
  return true;
}

// -=-=-=-=-=-
// accessing
// -=-=-=-=-=-

const keys = Object.keys;

/**
 * Returns the values held by the object properties.
 * @example
 * var obj1 = {x: 22}, obj2 = {x: 23, y: {z: 3}};
 * obj2.__proto__ = obj1;
 * obj.values(obj1) // => [22]
 * obj.values(obj2) // => [23,{z: 3}]
 * @param { object } object - The object to retrive the values from.
 * @returns { any[] }
 */
function values (object) {
  return object ? Object.keys(object).map(function (k) { return object[k]; }) : [];
}

/**
 * Returns a new object that copies all properties with `keys` from `obj`.
 * @param { object } obj - The object to collect the properties from.
 * @param { string[] } keys - The names of the properties to collect.
 * @returns { object }
 */
function select (obj, keys) {
  const selected = {};
  for (let i = 0; i < keys.length; i++) selected[keys[i]] = obj[keys[i]];
  return selected;
}

/**
 * Returns a new object that excludes all of the properties defined in `keys`.
 * @param { object } object - The object to reduce.
 * @param { string[] } keys - The list of properties to exclude.
 * @returns { object }
 */
function dissoc (object, keys) {
  object = object || {};
  const descriptors = getOwnPropertyDescriptors(object);
  for (let i = 0; i < keys.length; i++) {
    if (keys[i] in descriptors) delete descriptors[keys[i]];
  }
  return Object.defineProperties({}, descriptors);
}

/**
 * Adds a method to a given `object`.
 * @param { object } object - The object to extend.
 * @param { string|function } funcOrString - The function object or source string for the method.
 * @param { string } [optName] - The name of the method.
 * @param { object } [optMapping] - The variable mapping for the method, when provided as string.
 */
function addScript (object, funcOrString, optName, optMapping) {
  const func = functionFromString(funcOrString);
  return asScriptOf(func, object, optName, optMapping);
}

// -=-=-=-=-
// mutation
// -=-=-=-=-

/**
 * Add all properties of `source` to `destination`.
 * @example
 * var dest = {x: 22}, src = {x: 23, y: 24}
 * obj.extend(dest, src);
 * dest // => {x: 23,y: 24}
 * @param { object } destination - The source object.
 * @param { object } source - The destination object.
 */
function extend (destination, source) {
  let currentCategoryNames = null;
  for (let i = 1; i < arguments.length; i++) {
    if (typeof arguments[i] === 'string') {
      const catName = arguments[i];
      if (!destination.categories) destination.categories = {};
      if (!destination.categories[catName]) destination.categories[catName] = [];
      currentCategoryNames = destination.categories[catName];
      continue;
    }

    source = arguments[i];
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

/**
 * Shallow copy.
 * @param { object } object - The object to shallow copy.
 * @returns { object } The copied object.
 */
function clone (object) {
  if (isPrimitive(object)) return object;
  if (Array.isArray(object)) return Array.prototype.slice.call(object);
  const clone = {};
  for (const key in object) {
    if (object.hasOwnProperty(key)) { clone[key] = object[key]; }
  }
  clone.__proto__ = object.__proto__; // ensure same proto
  return clone;
}

/**
 * Takes a list of properties and returns a new object with those properties shallow-copied from object.
 * Similar to `select` but supports an additional `mapFunc`.
 * @param { object } object - The object to extract the properties from.
 * @param { string[] } properties - The list of properties to extract.
 * @param { function } [mapFunc] - Function to map the ectracted properties to custom values.
 * @returns { object } A new object with the extracted properties.
 */
function extract (object, properties, mapFunc) {
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
 * @param { Object } object - The JavaScript Object to be inspected.
 * @param { InspectOptions } options -
 * @param { Boolean } options.printFunctionSource - Wether or not to show closures' source code.
 * @param { Boolean } options.escapeKeys - Wether or not to escape special characters.
 * @param { Number } options.maxDepth - The maximum depth upon which to inspect the object.
 * @param { Function } options.customPrinter - Custom print function that returns an alternative string representation of values.
 * @param { Number } options.maxNumberOfKeys - Limit the number of keys to be printed of an object.
 * @param { Function } options.keySorter - Custom sorting function to define the order in which object key/value pairs are printed.
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

/**
 * Given a list of objects, return a new object,
 * containing all properties of all objects. If the same property exist in
 * multiple objects, the right-most property takes precedence.
 * Like `extend` but will not mutate objects in `objs`.
 * if objs are arrays just concat them
 * if objs are real objs then merge properties
 * @param { object[] } objs - The list of objects to merge.
 */
function merge (objs) {
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

/**
 * Performs a deep merge of two objects that recursively merges the properties in case
 * they are objects.
 * @param { object } objA - The first object to merge.
 * @param { object } objB - The second object to merge.
 */
function deepMerge (objA, objB) {
  if (!objA) return objB;
  if (!objB) return objA;

  if (Array.isArray(objA)) {
    if (!Array.isArray(objB)) return objB;
    let merged = objA.map(function (ea, i) { return deepMerge(ea, objB[i]); });
    if (objB.length > objA.length) merged = merged.concat(objB.slice(objA.length));
    return merged;
  }

  if (objA.constructor !== Object || objB.constructor !== Object) return objB;

  return Object.keys(objA).concat(Object.keys(objB)).reduce(function (merged, name) {
    if (!objA[name]) merged[name] = objB[name];
    else if (!objB[name]) merged[name] = objA[name];
    else if (typeof objA[name] !== 'object' || typeof objB[name] !== 'object') merged[name] = objB[name];
    else merged[name] = deepMerge(objA[name], objB[name]);
    return merged;
  }, {});
}

/**
 * Expects `properties` to be a map of keys to objects having optional
 * before/after attributes that, if present, should be lists of other property
 * keys. `sortProperties` will return an ordered list of property keys so
 * that the before / after requirements are fullfilled. If a cyclic
 * dependency is encountered an error will be thrown.
 * Example:
 * ```
 * sortProperties({foo: {}, bar: {after: ["foo"], before: ["baz"]}, "baz": {after: ["foo"]}})
 * // => ["foo","bar","baz"]
 * ```
 * ignore-in-doc
 * 1. convert "before" requirement into "after" and check if all properties
 * mentioned in after/before are actually there
 * @param { Map.<string, { after: string, before: string }> } properties - The map of properties to check for.
 * @param { boolean } [throwErrorOnMissing=false] - Wether or not to throw an error on detection of missing properties.
 */
function sortKeysWithBeforeAndAfterConstraints (properties, throwErrorOnMissing = false) {
  const keys = []; const props = []; const remaining = [];
  for (const key in properties) {
    const prop = properties[key];
      	 const before = prop.hasOwnProperty('before') ? prop.before : (prop.before = []);
      	 const after = prop.hasOwnProperty('after') ? prop.after : (prop.after = []);

    keys.push(key);
    props.push(prop);

    let stringified = '';
    try {
      stringified = String(this);
    } catch (err) {

    }

    for (let i = before.length; i--;) {
      const beforePropName = before[i];
      const beforeProp = properties[beforePropName];
      if (!beforeProp) {
    	    console.warn(`[initializeProperties] ${stringified} sortProperties: ` +
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
    	    console.warn(`[initializeProperties] ${stringified} sortProperties: ` +
                    `Property ${key} requires to be initialized after ${afterPropName} ` +
                    'but that property cannot be found.');
        after.splice(i, 1);
      }
    }

    remaining.push(key);
  }

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

  return resolvedGroups.flat();
}

// -=-=-=-=-=-=-
// inheritance
// -=-=-=-=-=-=-

/**
 * Wrapper for `Object.create`. Essentially creates a new object that is derived from `obj`;
 * @param { object } obj - The object to derive.
 * @returns { object } The derived object.
 */
function inherit (obj) { return Object.create(obj); }

/**
 * Lookup all properties named name in the proto hierarchy of obj.
 * @example
 * var a = {foo: 3}, b = Object.create(a), c = Object.create(b);
 * c.foo = 4;
 * obj.valuesInPropertyHierarchy(c, "foo") // => [3,4]
 * @param { object } obj - The object to lookup the property values for.
 * @param { string } name - The name of the property to gather the values for.
 */
function valuesInPropertyHierarchy (obj, name) {
  const result = []; let lookupObj = obj;
  while (lookupObj) {
    if (lookupObj.hasOwnProperty(name)) result.unshift(lookupObj[name]);
    lookupObj = Object.getPrototypeOf(lookupObj);
  }
  return result;
}

/**
 * like `merge` but automatically gets all definitions of the value in the
 * prototype chain and merges those.
 * @example
 * var o1 = {x: {foo: 23}}, o2 = {x: {foo: 24, bar: 15}}, o3 = {x: {baz: "zork"}};
 * o2.__proto__ = o1; o3.__proto__ = o2;
 * obj.mergePropertyInHierarchy(o3, "x");
 * // => {bar: 15, baz: "zork",foo: 24}
 * @param { object } obj - The object to whose property definitions to merge.
 * @param { string } propName - The name of the property whose definition to merge.
 */
function mergePropertyInHierarchy (obj, propName) {
  return merge(valuesInPropertyHierarchy(obj, propName));
}

/**
 * Recursively traverses `object` and its properties to create a copy.
 * @param { object } object - The object to copy.
 * @returns { object } The deeply copied object.
 */
function deepCopy (object) {
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

/**
 * Returns the constructor's name of a `obj`.
 * @param { object } obj
 * @returns { string }
 */
function typeStringOf (obj) {
  if (obj === null) return 'null';
  if (typeof obj === 'undefined') return 'undefined';
  return obj.constructor.name;
}

/**
 * Returns wether `obj` is a value or mutable type.
 * @param { * } obj - The object to check for.
 * @returns { boolean }
 */
function isMutableType (obj) {
  const immutableTypes = ['null', 'undefined', 'Boolean', 'Number', 'String'];
  return immutableTypes.indexOf(typeStringOf(obj)) === -1;
}

/**
 * Returns a short stringified representation of `obj`.
 * @param { object } obj
 * @returns { string }
 */
function shortPrintStringOf (obj) {
  // primitive values
  if (!isMutableType(obj)) return safeToString(obj); // eslint-disable-line no-use-before-define

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

/**
 * Like `toString` but catches errors.
 * @param { object } obj - The object the should be converted to string.
 * @returns { string }
 */
function safeToString (obj) {
  try {
    return (obj ? obj.toString() : String(obj)).replace('\n', '');
  } catch (e) { return '<error printing object>'; }
}

/**
 * Return the object representation if given a primitive value or just the object itself.
 * @param { * } obj - The value to convert to object representation if needed.
 * @returns { object }
 */
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

/**
 * Returns a name for a key in an object that is not yet occupied.
 * @param { object } obj - The object within wich to look for a new unoccupied property name.
 * @param { string } [base='_'] - The base name of the property that allows us to generate well formed property names.
 * @returns { string } An unoccpuied property name.
 */
function newKeyIn (obj, base = '_') {
  let i = 1; let key;
  do {
    key = base + '-' + i++;
  } while (key in obj);
  return key;
}

/**
 * Convenience method for adjusting the prototype of an object.
 */
const setPrototypeOf = typeof Object.setPrototypeOf === 'function'
  ? (obj, proto) => Object.setPrototypeOf(obj, proto)
  : (obj, proto) => obj.__proto__ = proto;

/**
 * Adopts a given object to a new class.
 * @param { object } object - The object to change the class for.
 * @param { function } newClass - The new class we want to configure for the object.
 */
function adoptObject (object, newClass) {
  // change the class of object to newClass
  if (newClass === object.constructor) return;
  object.constructor = newClass;
  setPrototypeOf(object, newClass.prototype);
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
  getOwnPropertyDescriptors,
  adoptObject,
  setPrototypeOf
};
