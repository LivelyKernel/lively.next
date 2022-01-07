/**
 * Methods to streamline the querying of object properties
 * @module lively.lang/properties
 */

function all (object, predicate) {
  // ignore-in-doc
  const a = [];
  for (const name in object) {
    if ((object.__lookupGetter__(name) || typeof object[name] !== 'function') &&
      (predicate ? predicate(name, object) : true)) { a.push(name); }
  }
  return a;
}

/*
 * For a given object, traverses all prototypes in the proto chain
 * and collects all property descriptors and merges them into one object.
 * @param { Object } obj - The object to collect the property descriptors for.
 * @returns { Object } The collection of property descriptors as a dictionary.
 */
function allPropertyDescriptors (obj) {
  let proto = obj;
  const descriptors = {};
  while (proto = proto.__proto__) {
    // fixme: maybe the performance is not ideal
    Object.assign(descriptors, Object.getOwnPropertyDescriptors(proto));
  }
  return descriptors;
}

function allOwnPropertiesOrFunctions (obj, predicate) {
  // ignore-in-doc
  return Object.getOwnPropertyNames(obj).reduce(function (result, name) {
    if (predicate ? predicate(obj, name) : true) result.push(name);
    return result;
  }, []);
}

function own (object) {
  // ignore-in-doc
  const a = [];
  for (const name in object) {
    if (object.hasOwnProperty(name) && (object.__lookupGetter__(name) ||
      object[name] !== 'function')) { a.push(name); }
  }
  return a;
}

function forEachOwn (object, func, context) {
  // ignore-in-doc
  const result = [];
  for (const name in object) {
    if (!object.hasOwnProperty(name)) continue;
    const value = object[name];
    if (value !== 'function') {
      result.push(func.call(context || this, name, value));
    }
  }
  return result;
}

function nameFor (object, value) {
  // ignore-in-doc
  for (const name in object) {
    if (object[name] === value) { return name; }
  }
  return undefined;
}

function values (obj) {
  // ignore-in-doc
  const values = [];
  for (const name in obj) { values.push(obj[name]); }
  return values;
}

function ownValues (obj) {
  // ignore-in-doc
  const values = [];
  for (const name in obj) {
    if (obj.hasOwnProperty(name)) { values.push(obj[name]); }
  }
  return values;
}

function any (obj, predicate) {
  // ignore-in-doc
  for (const name in obj) {
    if (predicate(obj, name)) { return true; }
  }
  return false;
}

function allProperties (obj, predicate) {
  // ignore-in-doc
  const result = [];
  for (const name in obj) {
    if (predicate ? predicate(obj, name) : true) { result.push(name); }
  }
  return result;
}

function hash (obj) {
  // ignore-in-doc
  // Using the property names of `obj` to generate a hash value.
  return Object.keys(obj).sort().join('').hashCode();
}

export {
  all,
  allOwnPropertiesOrFunctions,
  allPropertyDescriptors,
  own,
  forEachOwn,
  nameFor,
  values,
  ownValues,
  any,
  allProperties,
  hash
};
