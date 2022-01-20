/**
 * Methods to streamline the querying of object properties.
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

/**
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

/**
 * For a given object only returns all the *property or function names*
 * that are directly defined on the object itself. Here we *do not* consider
 * what is defined on any of the prototypes in the prototype chain of the given object.
 * If `predicate` is given, these can further be filtered by a custom condition.
 * @param { Object } obj - The object to collect the property and function names for. 
 * @param { function(*, string): boolean } [predicate] - The predicate to filter the properties by further.
 * @returns { string[] } The names of all the local properties or functions.
 */
function allOwnPropertiesOrFunctions (obj, predicate) {
  return Object.getOwnPropertyNames(obj).reduce(function (result, name) {
    if (predicate ? predicate(obj, name) : true) result.push(name);
    return result;
  }, []);
}

/**
 * For a given object only returns all the *property names*
 * that are directly defined on the object itself. Here we *do not* consider
 * what is defined on any of the prototypes in the prototype chain of the given object.
 * @param { Object } object- The object to collect the property names for. 
 * @returns { string[] } The names of all the local properties.
 */
function own (object) {
  const a = [];
  for (const name in object) {
    if (object.hasOwnProperty(name) && (object.__lookupGetter__(name) ||
      object[name] !== 'function')) { a.push(name); }
  }
  return a;
}

/**
 * For a given object iterate over its local properties
 * invoking `func` on each time.
 * @param { Object } object - The object whose properties to traverse.
 * @param { function(string, *): * } func - The iteration function.
 * @param { Object } [context] - The binding of `this` during the execution of `func`.
 * @returns { any[] } The results of each iteration.
 */
function forEachOwn (object, func, context) {
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

/**
 * For a given `object` return the name of the property that is equal to `value`.
 * @param { Object } object - The object whose properties to check.
 * @param { * } value - The value to scan the properties for. 
 * @returns { string } The name of the property that stores the same `value`.
 */
function nameFor (object, value) {
  for (const name in object) {
    if (object[name] === value) { return name; }
  }
  return undefined;
}

/**
 * Traverse all the values of a given object, including the ones defined in the prototype chain.
 * @param { Object } obj - The object to gather all the values from.
 * @returns { any[] } The list of all values.
 */
function values (obj) {
  const values = [];
  for (const name in obj) { values.push(obj[name]); }
  return values;
}

/**
 * Traverse all the values of a given object, only considering the ones directly defined on the object itself.
 * @param { Object } obj - The object to gather all the local values from.
 * @returns { any[] } The list of all (own) values.
 */
function ownValues (obj) {
  const values = [];
  for (const name in obj) {
    if (obj.hasOwnProperty(name)) { values.push(obj[name]); }
  }
  return values;
}

/**
 * For a given `obj` and `predicate` checks wether any property defined for `obj` satisfies the condition
 * defined by `predicate`.
 * @param { Object } obj - The object whose properties to check.
 * @param { function(Object, string): boolean } predicate - The predicate to check the properties for. 
 * @returns { boolean } Wether or not any of the properties of the object satisfies the predicate.
 */
function any (obj, predicate) {
  for (const name in obj) {
    if (predicate(obj, name)) { return true; }
  }
  return false;
}

/**
 * Gather all the property names of a given 'obj'. Can be further filtered by specifying a `predicate`.
 * @param { Object } obj - The object whose properties to collect.
 * @param { function(Object, string): boolean } [predicate] - The predicate to filter the properties with.
 * @return { string[] } The list of all the names of the matching properties.
 */
function allProperties (obj, predicate) {
  const result = [];
  for (const name in obj) {
    if (predicate ? predicate(obj, name) : true) { result.push(name); }
  }
  return result;
}

/**
 * Uses the property names of `obj` to generate a hash value.
 * @param { Object } obj - The object to generate a hash for.
 * @returns { string } The computed hash.
 */
function hash (obj) {
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
