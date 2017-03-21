import ClassHelper from "./class-helper.js";
import { Path, arr, graph } from "lively.lang";

export function referenceGraph(snapshot) {
  let ids = Object.keys(snapshot),
      g = {};
  for (let id in snapshot)
    g[id] = referencesOfId(snapshot, id);
  return g;
}

function isReference(value) { return value && value.__ref__; }

function referencesOfId(snapshot, id, withPath) {
  // all the ids an regObj (given by id) points to
  let ref = snapshot[id], result = [];
  for (let key in ref.props) {
    let {value, verbatim} = ref.props[key] || {};
    if (Array.isArray(value)) {
      result.push(...referencesInArray(snapshot, value, withPath && key));
      continue;
    };
    if (verbatim || !value || !isReference(value)) continue;
    result.push(withPath ? {key: key, id: value.id} : value.id);
  }
  return result;
}


function referencesInArray(snapshot, arr, optPath) {
  // helper for referencesOfId
  var result = [];
  for (let i = 0; i < arr.length; i++) {
    let value = arr[i];
    if (Array.isArray(value)) {
      let path = optPath ? optPath + '[' + i + ']' : undefined;
      result.push(...referencesInArray(snapshot, value, path));
      continue;
    };
    if (!value || !isReference(value)) continue;
    result.push(optPath ? {key: optPath + '[' + i + ']', id: value.id} : value.id);    
  }
  return result;
}


function referencesAndClassNamesOfId(snapshot, id) {
  // given an id, the regObj behind it is taken and for all its references a list is assembled
  // [id:ClassName]
  return referencesOfId(snapshot, id).map(id =>
    id + ':' + classNameOfId(snapshot, id));
}


function classNameOfId(snapshot, id) {
  var ref = snapshot[id],
      {className} = ref[ClassHelper.classMetaForSerializationProp] || {};
  return className || "Object";
}


export function findPathFromToId(snapshot, fromId, toId, options = {}) {
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


export function lookupPath(snapshot, fromId, path) {
  // given a path like "submorphs.1.submorphs.0" and a starting id (root
  // object), try to resolve the path, returning the serialized object of
  // this.snapshot

  path = path.replace(/^\./, "");
  // foo[0].baz => foo.0.baz
  path = path.replace(/\[([^\]])+\]/g, ".$1")

  var parts = Path(path).parts(),
      current = snapshot[fromId],
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

    current = snapshot[value.id];
  }
  return current;
}

export function removeUnreachableObjects(rootIds, snapshot) {
  let idsToRemove = arr.withoutAll(Object.keys(snapshot), rootIds),
      refGraph = referenceGraph(snapshot);
  rootIds.forEach(rootId => {
    let subGraph = graph.subgraphReachableBy(refGraph, rootId);
    for (let i = idsToRemove.length; i--; ) {
      let id = idsToRemove[i];
      if (id in subGraph) idsToRemove.splice(i, 1);
    }
  });

  idsToRemove.forEach(id => delete snapshot[id]);
  return idsToRemove;
}
