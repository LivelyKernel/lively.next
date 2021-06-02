import { obj } from 'lively.lang';
import { morph } from 'lively.morphic';
import { ValueChange, MethodCallChange } from 'lively.morphic/changes.js';
import { ExpressionSerializer } from 'lively.serializer2';

let i = val => obj.inspect(val, { maxDepth: 2 });
let assert = (bool, msgFn) => { if (!bool) throw new Error(msgFn()); };

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// change (de)serialization
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function deserializeChangeProp (change, name, val, objectMap, syncController) {
  if (!val || val.isMorph) return val;

  if (typeof val === 'string' && objectMap.has(val)) {
    console.warn(`deserializeChange: Found prop [${name}] that is a morph id but is not specified as one!`);
    return objectMap.get(val);
  }

  // let exprSerializer = new ExpressionSerializer();
  // if (typeof val === "string" && exprSerializer.isSerializedExpression(val)) {
  //   return exprSerializer.deserializeExpr(val);
  // }

  if (val.type === 'lively-sync-morph-ref') {
    var resolved = objectMap.get(val.id);
    assert(resolved, () => `Cannot deserialize change ${i(change)}[${name}], cannot find ref ${val.id} (property ${name})`);
    return resolved;
  }

  if (val.type === 'lively-sync-morph-spec') {
    var resolved = objectMap.get(val.spec._id);
    if (!resolved) {
      resolved = morph({ _env: syncController.morphicEnv, ...val.spec }, { restore: true });
      objectMap.set(val.spec._id, resolved);
    }
    assert(resolved, () => `Cannot deserialize change ${i(change)}[${name}], cannot create morph from spec ${val.spec}`);
    return resolved;
  }

  return val;
}

export function deserializeChange (change, objectMap, syncController) {
  let deserializedChange;
  let target = change.target
    ? deserializeChangeProp(change, 'target', change.target, objectMap, syncController)
    : null;

  if (change.type === 'setter') {
    let value = deserializeChangeProp(change, 'value', change.value, objectMap, syncController);
    deserializedChange = new ValueChange(target, change.prop, value, change.meta);
  } else if (change.type === 'method-call') {
    let args = change.args.map((arg, i) => deserializeChangeProp(change, `args[${i}]`, arg, objectMap, syncController));
    deserializedChange = new MethodCallChange(target, change.selector, args, null, change.meta);
  } else {
    assert(false, () => `Unknown change type ${change.type}, ${i(change)}`);
  }

  return deserializedChange;
}

function serializeChangeProp (change, name, val, objectMap, opts = { forceMorphId: false }) {
  if (!val) return val;

  if (val.isMorph) {
    val.withAllSubmorphsDo(m => {
      if (!objectMap.has(m.id)) { objectMap.set(m.id, m); }
    });
    return opts.forceMorphId
      ? { type: 'lively-sync-morph-ref', id: val.id }
      : { type: 'lively-sync-morph-spec', spec: val.exportToJSON({ keepFunctions: false }) };
  }

  // if (val.__serialize__) {
  //   let exprSerializer = new ExpressionSerializer();
  //   try {
  //     val = exprSerializer.exprStringEncode(val.__serialize__());
  //   } catch (e) {
  //     console.log(`serializeChange: failed to serialize ${name} to serialized expression`);
  //   }
  // }

  return val;
}

export function serializeChange (change, objectMap) {
  let serializedChange = obj.clone(change);
  serializedChange.type = change.type; // FIXME since change.type is a getter...

  if (change.target) { serializedChange.target = serializeChangeProp(change, 'target', change.target, objectMap, { forceMorphId: true }); }

  if (change.owner) { serializedChange.owner = serializeChangeProp(change, 'owner', change.owner, objectMap, { forceMorphId: true }); }

  if (change.type === 'setter') {
    serializedChange.value = serializeChangeProp(change, 'value', change.value, objectMap);
  } else if (change.type === 'method-call') {
    serializedChange.args = change.args.map((arg, i) => serializeChangeProp(change, `arg[${i}]`, arg, objectMap));
  } else {
    assert(false, () => `Unknown change type ${change.type}, ${i(change)}`);
  }

  // if (change.undo) {
  //   delete serializedChange.undo;
  // }

  return serializedChange;
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

export function applyChange (change, syncController) {
  let { world, objects } = syncController.state;
  let deserializedChange = deserializeChange(change, objects, syncController);
  let { type, args } = deserializedChange;

  // FIXME...! Adding unknown morphs to local registry...
  if (type === 'method-call') {
    args
      .filter(ea => ea && ea.isMorph && !objects.has(ea))
      .forEach(m => m.withAllSubmorphsDo(child => objects.set(child.id, child)));
  }

  deserializedChange.target.applyChange(deserializedChange);

  return deserializedChange;
}
