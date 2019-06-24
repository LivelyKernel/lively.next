/*global alert*/
import ClassHelper, { locateClass } from "./class-helper.js";
import { Path, obj, arr, graph } from "lively.lang";
import ExpressionSerializer from "./plugins/expression-serializer.js";
import { Morph } from "lively.morphic";

export function referenceGraph(snapshot) {
  let ids = Object.keys(snapshot), g = {};
  for (var id in snapshot)
    g[id] = referencesOfId(snapshot, id);
  return g;
}

export function isReference(value) { return value && value.__ref__; }

export function referencesOfRef(ref, withPath) {
  return referencesOfId({[ref.id]: ref.currentSnapshot}, ref.id, withPath);
}

export function referencesOfId(snapshot, id, withPath) {
  // all the ids an regObj (given by id) points to
  let ref = snapshot[id], result = [];
  for (var key in ref.props) {
    let {value, verbatim} = ref.props[key] || {};
    if (Array.isArray(value)) {
      result.push(...referencesInArray(value, withPath && key));
      continue;
    };
    if (verbatim || !value || !isReference(value)) continue;
    result.push(withPath ? {key: key, id: value.id} : value.id);
  }

  // FIXME hack for maps and sets...
  if (ref.hasOwnProperty("entries")) {
    for (let i = 0; i < ref.entries.length; i++) {
      let entry = ref.entries[i];
      if (Array.isArray(entry)) { result.push(...referencesInArray(entry, withPath && entry)); continue; }
      else if (!entry || !isReference(entry)) {}
      else result.push(withPath ? {key: entry, id: entry.id} : entry.id);
    }
  }
  return result;
}


function referencesInArray(arr, optPath) {
  // helper for referencesOfId
  var result = [];
  for (let i = 0; i < arr.length; i++) {
    let value = arr[i];
    if (Array.isArray(value)) {
      let path = optPath ? optPath + '[' + i + ']' : undefined;
      result.push(...referencesInArray(value, path));
      continue;
    };
    if (!value || !isReference(value)) continue;
    result.push(optPath ? {key: optPath + '[' + i + ']', id: value.id} : value.id);    
  }
  return result;
}

export function moduleOfId(snapshot, id) {
  var ref = snapshot[id],
      classInfo = ref[ClassHelper.classMetaForSerializationProp] || {};
  return classInfo.module || {};
}

export function referencesAndClassNamesOfId(snapshot, id) {
  // given an id, the regObj behind it is taken and for all its references a list is assembled
  // [id:ClassName]
  return referencesOfId(snapshot, id).map(id =>
    id + ':' + classNameOfId(snapshot, id));
}


export function classNameOfId(snapshot, id) {
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

export function modifyProperty(snapshot, objId, pathToProperty, modifyFn) {
  // lookup the object with identifier `objId` and modify it's property specified
  // by pathToProperty via modifyFn(obj, key, val);
  // Example:
  // let snap = {obj: {props: {a: {value: 23},b: {value: [123]}}}};
  // modifyProperty(snap, "obj", "a", (_, _2, val) => val+1)
  // snap.obj.props.a.value => 24
  // modifyProperty(snap, "obj", "b.0", (_, _2, val) => val+1)
  // snap.obj.props.b.value => [124]

  pathToProperty = pathToProperty.replace(/^\./, "");
  pathToProperty = pathToProperty.replace(/\[([^\]])+\]/g, ".$1")

  var parts = Path(pathToProperty).parts(),
      obj = snapshot[objId],
      key = parts.shift();

  if (!obj.props || !obj.props[key])
    throw new Error(`Property ${key} not found for ref ${JSON.stringify(obj)}`);

  var {value} = obj.props[key] || {};
  if (!value)
    throw new Error(`Property ${key} has no value`);

  if (parts.length) {
    let innerValue = Path(parts).get(value);
    Path(parts).set(value, modifyFn(obj, key, innerValue))
  } else {
    obj.props[key].value = modifyFn(obj, key, value);
  }
}

export function removeUnreachableObjects(rootIds, snapshot) {
  let idsToRemove = arr.withoutAll(Object.keys(snapshot), rootIds),
      garbageCollectedConnections = idsToRemove.filter(id => {
        if (classNameOfId(snapshot, id) === 'AttributeConnection') {
          return snapshot[id].props.garbageCollect.value;
        }
      }),
      refGraph = referenceGraph(obj.dissoc({...snapshot}, garbageCollectedConnections));
  
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

export function clearDanglingConnections(snapshot) {
  for (let id in snapshot) {
    if (classNameOfId(snapshot, id) === 'AttributeConnection') {
       let objSnap = snapshot[id];
       if (snapshot[Path('props.targetObj.value.id').get(objSnap)]) continue;
       let sourceObjSnap = snapshot[Path('props.sourceObj.value.id').get(objSnap)];
       if (sourceObjSnap)
         sourceObjSnap.props.attributeConnections.value = sourceObjSnap.props.attributeConnections.value.filter(ref => ref.id != id);
       delete snapshot[id];
    }
  }
}

const defaultExprSerializer = new ExpressionSerializer();

export function requiredModulesOfSnapshot(snapshot, exprSerializer = defaultExprSerializer) {
  // knows how to extract lively.modules packages/modules from __expr__ and
  // class data

  if (snapshot.snapshot) snapshot = snapshot.snapshot;

  var modules = [];

  for (var i = 0, ids = Object.keys(snapshot); i < ids.length; i++) {
    var ref = snapshot[ids[i]];

    if (ref.__expr__) {
      let exprModules = exprSerializer.requiredModulesOf__expr__(ref.__expr__);
      if (exprModules) modules.push(...exprModules);
      continue;
    }

    var classModules = ClassHelper.sourceModulesInObjRef(ref);
    if (classModules && classModules.length)
      modules.push(...classModules.map(spec =>
        ((spec.package && spec.package.name) || "") + "/" + spec.pathInPackage));

    if (ref.props) {
      for (var j = 0; j < ref.props.length; j++) {
        let val = ref.props[j].value;
        if (typeof val === "string") {
          let exprModules = exprSerializer.requiredModulesOf__expr__(val);
          if (exprModules) modules.push(...exprModules);
        }
      }
    }

  }

  modules = arr.uniq(modules);

  return modules;
}

function isMorphClass(klass) {
    if (!klass) return false;
    if (Morph === klass) return true;
    return isMorphClass(klass[Symbol.for("lively-instance-superclass")]);
}

export function replaceMorphsBySerializableExpressions(snapshot, pool) {
  /*
  finds all the morphs inside a snapshot that can be represented by the expression
  returned via exportToJSON({ asExpression: true }). This requires that the snapshot contains no
  references to any of the morphs in that morphs hierarchy (i.e. via AttributeConnections, embedded morphs, custom properties)
  Those deemed suitable are then being replaced by the aforementioned expression */
  
  //1. compute inverse reference graph
  let G = referenceGraph(snapshot),
      inverseG = graph.invert(G);
  // 2. find all morphs and objects which are only referenced once

  let referencedOnce = Object.entries(inverseG).filter(([id, refs]) => {
    if (refs.length < 2 && isMorphClass(locateClass(snapshot[id][ClassHelper.classMetaForSerializationProp] || {}))) return true
  }).map(([id, refs]) => id);

  referencedOnce = referencedOnce.filter((id) => {
    return G[id].filter(ref => {
      // filter all morphs that have a property that references an object that is referenced by other morphs
      if (inverseG[ref].length > 1) return true;
    }).length == 0;
  });

  // 3. successively reduce the collection gathered in 2, by replacing each of the morphs with their parent
  let morphsToReplaceByExpr = new Set(referencedOnce); 
  for (let id of referencedOnce) {
    if (referencedOnce.includes(inverseG[id][0])) {
      morphsToReplaceByExpr.delete(id);
    }
  }

  for (let id of [...morphsToReplaceByExpr]) {
    let referer = snapshot[inverseG[id][0]],
        morphExpression = pool.expressionSerializer.exprStringEncode(
            pool.resolveToObj(id).exportToJSON({ asExpression: true }));

    // remove all referencedOnce morphs since they are no longer needed
    delete snapshot[id];
    
    let replaceReferenceInArray = (morphRefs, id) => {
       let idx = arr.findIndex(morphRefs, value => value && value.id === id);
       if (idx > -1) {
          morphRefs[idx] = morphExpression;
         return true;
       } 
    }

    for (let prop in referer.props) {
      if (Path('props.' + prop + '.value.id').get(referer) == id) {
        referer.props[prop].value = morphExpression;
        continue;
      }
      if (obj.isArray(referer.props[prop].value)) {
        if (replaceReferenceInArray(referer.props[prop].value, id)) continue;
      }
    }
  }
}
