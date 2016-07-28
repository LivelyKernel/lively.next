import { ObjectPool } from "lively.serializer2";

export function serializeMorph(m, objPool = new ObjectPool()) {
  var {id} = objPool.add(m);
  return {id, snapshot: objPool.snapshot()};
}

export function deserializeMorph(idAndSnapshot) {
  var {id, snapshot} = idAndSnapshot,
      objPool = ObjectPool.fromSnapshot(snapshot);
  return objPool.resolveToObj(id)
}


