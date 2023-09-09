/* global alert */
import { Path, obj, arr, graph } from 'lively.lang';
import ClassHelper from './class-helper.js';
import ExpressionSerializer from './plugins/expression-serializer.js';

export function referenceGraph (snapshot) {
  const ids = Object.keys(snapshot); const g = {};
  for (const id in snapshot) { g[id] = referencesOfId(snapshot, id); }
  return g;
}

export function isReference (value) { return value && value.__ref__; }

export function referencesOfRef (ref, withPath) {
  return referencesOfId({ [ref.id]: ref.currentSnapshot }, ref.id, withPath);
}

export function referencesOfId (snapshot, id, withPath) {
  // all the ids an regObj (given by id) points to
  const ref = snapshot[id]; const result = [];
  for (const key in ref.props) {
    const { value, verbatim } = ref.props[key] || {};
    if (Array.isArray(value)) {
      result.push(...referencesInArray(value, withPath && key));
      continue;
    }
    if (verbatim || !value || !isReference(value)) continue;
    result.push(withPath ? { key: key, id: value.id } : value.id);
  }

  // FIXME hack for maps and sets...
  if (ref.hasOwnProperty('entries')) {
    for (let i = 0; i < ref.entries.length; i++) {
      const entry = ref.entries[i];
      if (Array.isArray(entry)) { result.push(...referencesInArray(entry, withPath && entry)); continue; } else if (!entry || !isReference(entry)) {} else result.push(withPath ? { key: entry, id: entry.id } : entry.id);
    }
  }
  return result;
}

function referencesInArray (arr, optPath) {
  // helper for referencesOfId
  const result = [];
  for (let i = 0; i < arr.length; i++) {
    const value = arr[i];
    if (Array.isArray(value)) {
      const path = optPath ? optPath + '[' + i + ']' : undefined;
      result.push(...referencesInArray(value, path));
      continue;
    }
    if (!value || !isReference(value)) continue;
    result.push(optPath ? { key: optPath + '[' + i + ']', id: value.id } : value.id);
  }
  return result;
}

export function moduleOfId (snapshot, id) {
  const ref = snapshot[id];
  const classInfo = ref[ClassHelper.classMetaForSerializationProp] || {};
  return classInfo.module || {};
}

export function referencesAndClassNamesOfId (snapshot, id) {
  // given an id, the regObj behind it is taken and for all its references a list is assembled
  // [id:ClassName]
  return referencesOfId(snapshot, id).map(id =>
    id + ':' + classNameOfId(snapshot, id));
}

export function classNameOfId (snapshot, id) {
  const ref = snapshot[id];
  const { className } = ref[ClassHelper.classMetaForSerializationProp] || {};
  return className || 'Object';
}

export function findPathFromToId (snapshot, fromId, toId, options = {}) {
  // prints path:
  //   findIdReferencePathFromToId(snapshot, 0, 10);
  // prints ids, classNames, property names:
  //   findIdReferencePathFromToId(snapshot, id, "A9E157AB-E863-400C-A15C-677CE90098B0", {hideId: false, showClassNames: true})
  const showPath = options.showPath === undefined ? true : options.showPath;
  const showClassNames = options.hasOwnProperty('showClassNames') ? options.showClassNames : !showPath;
  const showPropNames = options.hasOwnProperty('showPropNames') ? options.showPropNames : showPath;
  const hideId = options.hasOwnProperty('hideId') ? options.hideId : showPath;

  // how can one get from obj behind fromId to obj behind toId
  // returns an array of ids
  // findIdReferencePathFromToId(snapshot, 0, 1548)
  const stack = []; const visited = {}; let found;

  function pathFromIdToId (fromId, toId, depth) {
    if (found) return;
    if (depth > 50) { alert('' + stack); return; }
    if (fromId === toId) { stack.push(fromId); found = stack.slice(); return; }
    if (visited[fromId]) return;
    visited[fromId] = true;
    stack.push(fromId);
    const refs = referencesOfId(snapshot, fromId);
    for (let i = 0; i < refs.length; i++) { pathFromIdToId(refs[i], toId, depth + 1); }
    stack.pop();
  }
  pathFromIdToId(fromId, toId, 0);

  if (!found) return null;

  if (!showClassNames && !showPropNames) return found;

  let result = [];
  for (let i = 0; i < found.length - 1; i++) {
    const currId = found[i];
    var nextId = found[i + 1];
    const strings = [];
    if (!hideId) strings.push(currId);
    if (showClassNames) {
      const { className } = snapshot[currId][ClassHelper.classMetaForSerializationProp] || {};
      strings.push(className || 'Object');
    }
    if (showPropNames) {
      const ref = referencesOfId(snapshot, currId, true).find(ea => ea.id === nextId) || { key: '????' };
      strings.push(ref.key);
    }
    result.push(strings.join(':'));
  }
  if (showPath) { result = '.' + result.join('.'); }
  return result;
}

export function lookupPath (snapshot, fromId, path) {
  // given a path like "submorphs.1.submorphs.0" and a starting id (root
  // object), try to resolve the path, returning the serialized object of
  // this.snapshot

  path = path.replace(/^\./, '');
  // foo[0].baz => foo.0.baz
  path = path.replace(/\[([^\]])+\]/g, '.$1');

  const parts = Path(path).parts();
  let current = snapshot[fromId];
  let counter = 0;

  while (true) {
    if (counter++ > 1000) throw 'stop';
    const key = parts.shift();
    if (!key) return current;

    if (!current.props || !current.props[key]) { throw new Error(`Property ${key} not found for ref ${JSON.stringify(current)}`); }

    let { value } = current.props[key];
    if (!value) { throw new Error(`Property ${key} has no value`); }

    while (Array.isArray(value)) { value = value[parts.shift()]; }

    if (!value || !value.__ref__) return value;

    current = snapshot[value.id];
  }
  return current;
}

export function modifyProperty (snapshot, objId, pathToProperty, modifyFn) {
  // lookup the object with identifier `objId` and modify it's property specified
  // by pathToProperty via modifyFn(obj, key, val);
  // Example:
  // let snap = {obj: {props: {a: {value: 23},b: {value: [123]}}}};
  // modifyProperty(snap, "obj", "a", (_, _2, val) => val+1)
  // snap.obj.props.a.value => 24
  // modifyProperty(snap, "obj", "b.0", (_, _2, val) => val+1)
  // snap.obj.props.b.value => [124]

  pathToProperty = pathToProperty.replace(/^\./, '');
  pathToProperty = pathToProperty.replace(/\[([^\]])+\]/g, '.$1');

  const parts = Path(pathToProperty).parts();
  const obj = snapshot[objId];
  const key = parts.shift();

  if (!obj.props || !obj.props[key]) { throw new Error(`Property ${key} not found for ref ${JSON.stringify(obj)}`); }

  const { value } = obj.props[key] || {};
  if (!value) { throw new Error(`Property ${key} has no value`); }

  if (parts.length) {
    const innerValue = Path(parts).get(value);
    Path(parts).set(value, modifyFn(obj, key, innerValue));
  } else {
    obj.props[key].value = modifyFn(obj, key, value);
  }
}

export function removeUnreachableObjects (rootIds, snapshot) {
  const idsToRemove = arr.withoutAll(Object.keys(snapshot), rootIds);
  const garbageCollectedConnections = idsToRemove.filter(id => {
    if (classNameOfId(snapshot, id) === 'AttributeConnection') {
      return snapshot[id].props.garbageCollect.value;
    }
  });
  const refGraph = referenceGraph(obj.dissoc({ ...snapshot }, garbageCollectedConnections));

  rootIds.forEach(rootId => {
    const subGraph = graph.subgraphReachableBy(refGraph, rootId);
    for (let i = idsToRemove.length; i--;) {
      const id = idsToRemove[i];
      if (id in subGraph) idsToRemove.splice(i, 1);
    }
  });

  idsToRemove.forEach(id => delete snapshot[id]);
  return idsToRemove;
}

export function clearDanglingConnections (snapshot) {
  for (const id in snapshot) {
    if (classNameOfId(snapshot, id) === 'AttributeConnection') {
      const objSnap = snapshot[id];
      if (snapshot[Path('props.targetObj.value.id').get(objSnap)]) continue;
      const sourceObjSnap = snapshot[Path('props.sourceObj.value.id').get(objSnap)];
      if (sourceObjSnap) { sourceObjSnap.props.attributeConnections.value = sourceObjSnap.props.attributeConnections.value.filter(ref => ref.id != id); }
      delete snapshot[id];
    }
  }
}

export function removeEpiConnections (snapshot) {
  for (const id in snapshot) {
    if (classNameOfId(snapshot, id) === 'AttributeConnection') {
      const objSnap = snapshot[id];
      const sourceObjSnap = snapshot[Path('props.sourceObj.value.id').get(objSnap)];
      if (objSnap.props._isEpiConnection) {
        sourceObjSnap.props.attributeConnections.value = sourceObjSnap.props.attributeConnections.value.filter(ref => ref.id != id);
        delete snapshot[id];
      }
    }
  }
}

const defaultExprSerializer = new ExpressionSerializer();

export function requiredModulesOfSnapshot (snapshot, exprSerializer = defaultExprSerializer) {
  // knows how to extract lively.modules packages/modules from __expr__ and
  // class data

  if (snapshot.snapshot) snapshot = snapshot.snapshot;

  let modules = [];

  for (let i = 0, ids = Object.keys(snapshot); i < ids.length; i++) {
    const ref = snapshot[ids[i]];

    if (ref.__expr__) {
      const exprModules = exprSerializer.requiredModulesOf__expr__(ref.__expr__);
      if (exprModules) modules.push(...exprModules);
      continue;
    }

    const classModules = ClassHelper.sourceModulesInObjRef(ref);
    if (classModules && classModules.length) {
      modules.push(...classModules.map(spec =>
        ((spec.package && spec.package.name) || '') + '/' + spec.pathInPackage.replace('./', '')));
    }

    if (ref.props) {
      for (const j in ref.props) {
        const val = ref.props[j].value;
        if (typeof val === 'string') {
          const exprModules = exprSerializer.requiredModulesOf__expr__(val);
          if (exprModules) modules.push(...exprModules);
        }
        if (obj.isArray(val)) {
          // scan each array entry for expressions
          val.forEach(val => {
            if (typeof val === 'string') {
              const exprModules = exprSerializer.requiredModulesOf__expr__(val);
              if (exprModules) modules.push(...exprModules);
            }
          });
        }
      }
    }
  }

  modules = arr.uniq(modules);

  return modules;
}
