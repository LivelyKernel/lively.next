import { arr, num, string, graph, Path } from "lively.lang";

import { ObjectPool } from "lively.serializer2";
import ClassHelper from "./class-helper.js";

/*

var a = {bar: 15}; a.b = {foo: 23};
var p = new ObjectPool(); p.add(a)
var i = SnapshotInspector.forSnapshot(p.snapshot())

var ids = p.objectRefs().map(ea => ea.id);
i.findIdReferencePathFromToId(ids[0], ids[1]);

*/

export class SnapshotInspector {

  static forSnapshot(snapshot) {
    return new this(snapshot).processSnapshot();
  }

  constructor(snapshot) {
    this.snapshot = snapshot;
    this.classes = {};
    this.expressions = {};
  }

  processSnapshot() {
    var {snapshot, classes, expressions} = this,
        pool = ObjectPool.fromSnapshot(snapshot);

    pool.objectRefs().forEach(ref => {
      var snap = ref.currentSnapshot,
          {className} = snap[ClassHelper.classMetaForSerializationProp] || {};
  
      var propNames = Object.keys(snap.props);
      if (className == null) {
        if (propNames.length > 3) className = "{" + propNames.slice(0, 3).join(", ") + ", ...}";
        else className = "{" + propNames.join(", ") + "}";
      }
  
      if (!classes[className])
        classes[className] = {count: 0, bytes: 0, name: className, objects: []};
      classes[className].count++;
      classes[className].bytes += JSON.stringify(snap).length;
      classes[className].objects.push([ref.id, snap]);

      propNames.forEach(key => {
        var value = snap.props[key].value;
        if (!value || typeof value !== "string"
         || !pool.expressionSerializer.isSerializedExpression(value)) return;
        
        var {__expr__} = pool.expressionSerializer.exprStringDecode(value);
        var expr = expressions[__expr__]
        if (!expr)
          expr = expressions[__expr__] = {count: 0, bytes: 0, name: __expr__, objects: []};
        expr.count++;
        expr.bytes += value.length;
        expr.objects.push([[ref.id, key], value]);
      });

    });

    return this;
  }

  explainId(id) {
    var ref = this.snapshot[id];
    if (!ref) return null;
    var {className} = ref[ClassHelper.classMetaForSerializationProp] || {className: "Object"};
    var propNames = Object.keys(ref.props)
    if (className == "Object") {
      if (propNames.length > 3) className = "{" + propNames.slice(0, 3).join(", ") + ", ...}";
      else className = "{" + propNames.join(", ") + "}";
    }
    return className
  }

  sorted(prop) {
    return arr.sortBy(
      Object.keys(this[prop]).map(key => this[prop][key]),
      tuple => isNaN(tuple.bytes) ? 0 : tuple.bytes).reverse()
  }

  report(prop) {
    var items = [
      ['#bytes', '#objs', 'avg', prop],
      ...this.sorted(prop).map(tuple =>
        [num.humanReadableByteSize(tuple.bytes),
         tuple.count,
         num.humanReadableByteSize(tuple.bytes / tuple.count),
         tuple.name])];
    return string.printTable(items, {separator: ' | '})
  }

  toString() {
    var {snapshot} = this,
        bytesAltogether = JSON.stringify(snapshot).length,
        objCount = Object.keys(snapshot).length;
    return string.format('Total: %s (%s objs - %s per obj)',
                num.humanReadableByteSize(bytesAltogether), objCount,
                num.humanReadableByteSize(bytesAltogether / objCount))
        + '\nclasses:\n' + this.report("classes")
        + '\nexpressions:\n' + this.report("expressions")
  }

  biggestObjectsOfType(typeString) {
    return arr.sortBy(
      this.classes[typeString].objects.map(([id, obj]) => JSON.stringify(obj)),
      ea => ea.length).reverse()
     .map(ea => JSON.parse(ea));
  }

  toCSV() {
    var lines = ['type,size,size in bytes,count,size per object,size perobject in bytes'];
    this.sorted("classes").forEach(tuple => {
      lines.push([tuple.name, num.humanReadableByteSize(tuple.bytes), tuple.bytes, tuple.count,
      num.humanReadableByteSize(tuple.bytes / tuple.count), tuple.bytes / tuple.count].join(','))
    });
    return lines.join('\n');
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  findPathFromToId(fromId, toId, options = {}) {
    // findPathFromToId(snapshot, id, "A9E157AB-E863-400C-A15C-677CE90098B0")
    // findPathFromToId(snapshot, id, "A9E157AB-E863-400C-A15C-677CE90098B0", {hideId: false, showClassNames: true})
    return findPathFromToId(this.snapshot, fromId, toId, options);
  }

  referenceGraph() {
    return Object.keys(this.snapshot).reduce((g, id) =>
      Object.assign(g, {[id]: referencesOfId(this.snapshot, id)}), {})
  }

  referenceCouncts() {
    var invertedG = graph.invert(this.referenceGraph()),
        counts = {};
    Object.keys(invertedG).forEach(key => counts[key] = invertedG[key].length);
    return counts;
  }

  lookupPath(fromId, path) {
    // given a path like "submorphs.1.submorphs.0" and a starting id (root
    // object), try to resolve the path, returning the serialized object of
    // this.snapshot

    path = path.replace(/^\./, "");
    // foo[0].baz => foo.0.baz
    path = path.replace(/\[([^\]])+\]/g, ".$1")
  
    var parts = Path(path).parts(),
        current = this.snapshot[fromId],
        counter = 0;
  
    while (true) {
      if (counter++ > 1000) throw "stop";
      var key = parts.shift();
      if (!key) return current;
  
      if (!current.props || !current.props[key])
        throw new Error(`Property ${key} not found for ref ${JSON.stringify(current)}`);
  
      var {value} = current.props[key];
      if (!value)
        throw new Error(`Property ${key} has no value`);
  
      while (Array.isArray(value))
        value = value[parts.shift()];
  
      if (!value || !value.__ref__) return value;
  
      current = this.snapshot[value.id];
    }
    return current;
  }

}


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-


function isReference(value) { return value && value.__ref__; }

function referencesOfId(snapshot, id, withPath) {
  // all the ids an regObj (given by id) points to
  var ref = snapshot[id], result = [];
  Object.keys(ref.props).forEach(key => {
    var {value, verbatim} = ref.props[key];
    if (Array.isArray(value)) {
      result = result.concat(referencesInArray(snapshot, value, withPath && key));
      return;
    };
    if (verbatim || !value || !isReference(value)) return;
    result.push(withPath ? {key: key, id: value.id} : value.id);
  });
  return result;
}

function referencesInArray(snapshot, arr, optPath) {
  // helper for referencesOfId
  var result = [];
  arr.forEach((value, idx) => {
    if (Array.isArray(value)) {
      var path = optPath ? optPath + '[' + idx + ']' : undefined;
      result = result.concat(referencesInArray(snapshot, value, path));
      return;
    };
    if (!value || !isReference(value)) return;
    result.push(optPath ? {key: optPath + '[' + idx + ']', id: value.id} : value.id);
  })
  return result;
}

function referencesAndClassNamesOfId(snapshot, id) {
  // given an id, the regObj behind it is taken and for all its references a list is assembled
  // [id:ClassName]
  return referencesOfId(snapshot, id).map(id => id + ':' + classNameOfId(snapshot, id));
}

function classNameOfId(snapshot, id) {
  var ref = snapshot[id];
  var {className} = ref[ClassHelper.classMetaForSerializationProp] || {}
  return className || "Object";
}



function findIdReferencePathFromToId(snapshot, fromId, toId, options = {}) {
  // prints path:
  //   findIdReferencePathFromToId(snapshot, 0, 10);
  // prints ids, classNames, property names:
  //   findIdReferencePathFromToId(snapshot, id, "A9E157AB-E863-400C-A15C-677CE90098B0", {hideId: false, showClassNames: true})
  var showPath = options.showPath === undefined ?  true : options.showPath,
      showClassNames = options.hasOwnProperty('showClassNames') ? options.showClassNames : !showPath,
      showPropNames = options.hasOwnProperty('showPropNames') ? options.showPropNames : showPath,
      hideId = options.hasOwnProperty('hideId') ? options.hideId : showPath;

  // how can one get from obj behind fromId to obj behind toId
  // returns an array of ids
  // findIdReferencePathFromToId(snapshot, 0, 1548)
  var stack = [], visited = {}, found;

  function pathFromIdToId(fromId, toId, depth) {
    if (found) return;
    if (depth > 50) { alert('' + stack); return; }
    if (fromId === toId) { stack.push(fromId); found = stack.slice(); return };
    if (visited[fromId]) return;
    visited[fromId] = true;
    stack.push(fromId);
    var refs = referencesOfId(snapshot, fromId);
    for (var i = 0; i < refs.length; i++)
      pathFromIdToId(refs[i], toId, depth + 1);
    stack.pop();
  }
  pathFromIdToId(fromId, toId, 0);

  if (!found) return null;

  if (!showClassNames && !showPropNames) return found;

  var result = [];
  for (var i = 0; i < found.length-1; i++) {
    var currId = found[i],
        nextId = found[i+1],
        strings = [];
    if (!hideId) strings.push(currId);
    if (showClassNames) {
      var {className} = snapshot[currId][ClassHelper.classMetaForSerializationProp] || {}
      strings.push(className || "Object");
    }
    if (showPropNames) {
      console.log(referencesOfId(snapshot, currId, true))
      var ref = referencesOfId(snapshot, currId, true).find(ea => ea.id === nextId) || {key: "????"};
      strings.push(ref.key);
    }
    result.push(strings.join(':'));
  }
  if (showPath)
    result = '.' + result.join('.');
  return result;
}
