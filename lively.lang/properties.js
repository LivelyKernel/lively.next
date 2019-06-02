function all(object, predicate) {
  // ignore-in-doc
  var a = [];
  for (var name in object) {
    if ((object.__lookupGetter__(name) || typeof object[name] !== 'function')
      && (predicate ? predicate(name, object) : true))
      a.push(name);
  }
  return a;
}

function allOwnPropertiesOrFunctions(obj, predicate) {
  // ignore-in-doc
  return Object.getOwnPropertyNames(obj).reduce(function(result, name) {
    if (predicate ? predicate(obj, name) : true) result.push(name);
    return result;
  }, []);
}

function own(object) {
  // ignore-in-doc
  var a = [];
  for (var name in object) {
    if (object.hasOwnProperty(name) && (object.__lookupGetter__(name)
      || object[name] !== 'function'))
      a.push(name);
  }
  return a;
}

function forEachOwn(object, func, context) {
  // ignore-in-doc
  var result = [];
  for (var name in object) {
    if (!object.hasOwnProperty(name)) continue;
    var value = object[name];
    if (value !== 'function') {
      result.push(func.call(context || this, name, value));
    }
  }
  return result;
}

function nameFor(object, value) {
  // ignore-in-doc
  for (var name in object)
    if (object[name] === value)
      return name;
  return undefined;
}

function values(obj) {
  // ignore-in-doc
  var values = [];
  for (var name in obj)
    values.push(obj[name]);
  return values;
}

function ownValues(obj) {
  // ignore-in-doc
  var values = [];
  for (var name in obj)
    if (obj.hasOwnProperty(name))
      values.push(obj[name]);
  return values;
}

function any(obj, predicate) {
  // ignore-in-doc
  for (var name in obj)
    if (predicate(obj, name))
      return true;
  return false;
}

function allProperties(obj, predicate) {
  // ignore-in-doc
  var result = [];
  for (var name in obj)
    if (predicate ? predicate(obj, name) : true)
      result.push(name);
  return result;
}

function hash(obj) {
  // ignore-in-doc
  // Using the property names of `obj` to generate a hash value.
  return Object.keys(obj).sort().join('').hashCode();
}


export {
  all,
  allOwnPropertiesOrFunctions,
  own,
  forEachOwn,
  nameFor,
  values,
  ownValues,
  any,
  allProperties,
  hash,
}
