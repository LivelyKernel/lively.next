import { obj, properties } from 'lively.lang';

/*

Plugins can implement the following methods to hook into and modify the
serialization process

# serialization

beforeSerialization(pool, realObj)
  Called before serialization starts

afterSerialization(pool, snapshot, realObj)
  Called after serialization ended

serializeObject(realObj, isProperty, pool, serializedObjMap, path)
  If an non-null value is returned this is taken as the value to be placed into
  the snapshot

propertiesToSerialize(pool, ref, snapshot, keysSoFar)
  Should either return null or a list of property names to serialize.  Plugins
  implementing this method get chained in the order in which the object pool
  has the plugins installed.  The return value of one plugin gets passed as
  `keysSoFar` to the next plugin.  The initial value of `keysSoFar` is
  Object.getOwnPropertyKeys(obj).  A nullish value is ignored.

additionallySerialize(pool, ref, snapshot, addFn)
  Can modify `snapshot`.  Return value is not used.

# deserialization

beforeDeserialization(pool, idAndSnapshot)
  Called before serialization starts

afterDeserialization(pool, idAndSnapshot)
  Called after deserialization ended

deserializeObject(pool, ref, snapshot, path)
  given snapshot can produce a new object as the instance to be used in the new
  object graph.  A nullish value will result in the deserializer using a plain
  Object instance.

additionallyDeserializeBeforeProperties(pool, ref, newObj, props, snapshot, serializedObjMap, path)
  Gets snapshot.props passed and can modify newObj.  A non-nullish value will
  be used as props, it is passed to the next plugin implementing this method.
  The result of the final plugin will be used for the normal props
  deserialization.

additionallyDeserializeAfterProperties(pool, ref, newObj, snapshot, serializedObjMap, path)
  Called for side effect, can modify newObj

*/

export class Plugin {
}

class CustomSerializePlugin {
  // can realObj be manually serialized, e.g. into an expression?
  serializeObject (realObj, isProperty, pool, serializedObjMap, path) {
    if (typeof realObj.__serialize__ !== 'function') return null;
    let serialized = realObj.__serialize__(pool, serializedObjMap, path);
    if (serialized && serialized.hasOwnProperty('__expr__')) {
      const expr = pool.expressionSerializer.exprStringEncode(serialized);
      serialized = isProperty ? expr : { __expr__: expr };
    }
    return serialized;
  }

  deserializeObject (pool, ref, snapshot, path) {
    const { __expr__ } = snapshot;
    return __expr__ ? pool.expressionSerializer.deserializeExpr(__expr__) : null;
  }
}

class ClassPlugin {
  // record class meta info for re-instantiating
  additionallySerialize (pool, ref, snapshot, addFn) {
    pool.classHelper.addClassInfo(ref, ref.realObj, snapshot);
  }

  deserializeObject (pool, ref, snapshot, path) {
    return pool.classHelper.restoreIfClassInstance(ref, snapshot);
  }
}

class SerializationIndicationPlugin {
  serializeObject (realObj, isProperty, pool, serializedObjMap, path) {
    if (realObj && realObj.isMorph) { realObj.__isBeingSerialized__ = true; }
    return null; // do not intercept serialization
  }
}

class SerializationFinishPlugin {
  additionallySerialize (pool, ref, snapshot, addFn) {
    if (ref.realObj && ref.realObj.isMorph) { ref.realObj.__isBeingSerialized__ = false; }
  }
}

class AdditionallySerializePlugin {
  // for objects with __additionally_serialize__(snapshot, ref, pool, addFn) method

  additionallySerialize (pool, ref, snapshot, addFn) {
    const { realObj } = ref;
    if (realObj && typeof realObj.__additionally_serialize__ === 'function') { realObj.__additionally_serialize__(snapshot, ref, pool, addFn); }
  }

  additionallyDeserializeBeforeProperties (pool, ref, newObj, props, snapshot, serializedObjMap, path) {
    if (typeof newObj.__deserialize__ === 'function') { newObj.__deserialize__(snapshot, ref, serializedObjMap, pool, path); }
  }

  additionallyDeserializeAfterProperties (pool, ref, newObj, snapshot, serializedObjMap, path) {
    if (typeof newObj.__after_deserialize__ === 'function') { newObj.__after_deserialize__(snapshot, ref, pool); }
    delete newObj._rev;
  }
}

class OnlySerializePropsPlugin {
  propertiesToSerialize (pool, ref, snapshot, keysSoFar) {
    const { realObj } = ref;
    return (realObj && realObj.__only_serialize__) || null;
  }
}

class DontSerializePropsPlugin {
  propertiesToSerialize (pool, ref, snapshot, keysSoFar) {
    const { realObj } = ref;
    if (!realObj || !realObj.__dont_serialize__) return null;
    const ignoredKeys = obj.mergePropertyInHierarchy(realObj, '__dont_serialize__');
    const keys = [];
    for (let i = 0; i < keysSoFar.length; i++) {
      const key = keysSoFar[i];
      if (!ignoredKeys.includes(key)) { keys.push(key); }
    }
    return keys;
  }
}

class LivelyClassPropertiesPlugin {
  propertiesToSerialize (pool, ref, snapshot, keysSoFar) {
    // serialize class properties as indicated by realObj.constructor.properties
    const { realObj } = ref;
    const classProperties = realObj.constructor[Symbol.for('lively.classes-properties-and-settings')];

    if (!classProperties) return null;

    const { properties, propertySettings } = classProperties;
    const valueStoreProperty = propertySettings.valueStoreProperty || '_state';
    const valueStore = realObj[valueStoreProperty];
    const only = !!realObj.__only_serialize__;
    const keys = [];

    if (!valueStore) return;

    // if __only_serialize__ is defined we will only consider those properties
    // that are in keysSoFar – it is expected that the OnlySerializePropsPlugin
    // was producing that list.

    if (only) {
      for (let i = 0; i < keysSoFar.length; i++) {
        const key = keysSoFar[i]; const spec = properties[key];
        if (key === valueStoreProperty) continue;
        if (spec) {
          if (spec && (spec.derived || spec.readOnly ||
                    (spec.hasOwnProperty('serialize') && !spec.serialize))) continue;
        }
        keys.push(key);
      }
      return keys;
    }

    // Otherwise properties add to keysSoFar
    const valueStoreKeyIdx = keysSoFar.indexOf(valueStoreProperty);
    if (valueStoreKeyIdx > -1) keysSoFar.splice(valueStoreKeyIdx, 1);

    for (const key in properties) {
      const spec = properties[key];
      const idx = keysSoFar.indexOf(key);
      if (spec.derived || spec.readOnly ||
          (spec.hasOwnProperty('serialize') && !spec.serialize)) {
        if (idx > -1) keysSoFar.splice(idx, 1);
      } else if (idx === -1) keys.push(key);
    }
    return keys.concat(keysSoFar);
  }

  additionallyDeserializeBeforeProperties (pool, ref, newObj, props, snapshot, serializedObjMap, path) {
    // deserialize class properties as indicated by realObj.constructor.properties
    const classProperties = newObj.constructor[Symbol.for('lively.classes-properties-and-settings')];

    if (!classProperties) return props;

    const { properties, propertySettings, order: sortedKeys } = classProperties;
    const valueStoreProperty = propertySettings.valueStoreProperty || '_state';
    var props = snapshot.props;

    // if props has a valueStoreProperty then we directly deserialize that.
    // As of 2017-02-26 this is for backwards compat.
    if (props[valueStoreProperty]) return props;

    props = obj.clone(props);

    if (!newObj.hasOwnProperty(valueStoreProperty)) { newObj.initializeProperties(); }

    const valueStore = newObj[valueStoreProperty];
    for (let i = 0; i < sortedKeys.length; i++) {
      const key = sortedKeys[i];
      const spec = properties[key];
      if (!props.hasOwnProperty(key)) continue;
      ref.recreatePropertyAndSetProperty(newObj, props, key, serializedObjMap, pool, path);
      delete props[key];
    }

    return props;
  }
}

// export class LeakDetectorPlugin {
//
//   afterSerialization(pool, snapshot, realObj) {
//     let i = SnapshotInspector.forPoolAndSnapshot(snapshot, pool),
//         weakRefs = new Set([...(i.classes.AttributeConnection || {objects: []}).objects,
//                             ...(i.classes["{source, target}"] || {objects: []}).objects,
//                             ...(i.classes["{_rev, source, target}"] || {objects: []}).objects].map(c => c[0])),
//         G = i.referenceGraph(), invG = graph.invert(G),
//         memoryLeaks = arr.compact(
//                       arr.flatten(Object.entries(invG)
//                          .filter(([id, c]) =>
//                              c.length < 3
//                              && snapshot.id != id
//                              && !weakRefs.has(id)
//                              && c.every(r => weakRefs.has(r)))
//                          .map(([id]) => {
//                            let subgraph = graph.subgraphReachableBy(G, id), obj = pool.resolveToObj(id);
//                            if (Object.keys(subgraph).length > 1)
//                               return arr.compact(invG[id].map(ref => {
//                                 let conn = pool.resolveToObj(ref);
//                                 if (conn.constructor.name === 'AttributeConnection') return conn
//                               })).map(conn => ({conn, obj}))
//                           })));
//      if (memoryLeaks.length > 0) this.memoryLeaks = memoryLeaks;
//     return snapshot;
//   }
// }

class SerializableCheckPlugin {
  additionallySerialize (pool, ref, snapshot, addFn) {
    const { realObj } = ref;
    if (!realObj) return;

    if (!this._serializable(realObj)) {
      console.warn(`Cannot serialize anonymous function ${realObj}`);
      return;
    }

    properties.allOwnPropertiesOrFunctions(realObj, (self, property) => {
      if (!this._serializable(realObj[property])) {
        console.warn(`Attribute cannot be serialized: ${property} of ${realObj}. Might be an anonymous function?`);
      }
    });
  }

  _serializable (object) {
    // isWrapped gets functions which are only part of a AttributeConnection and are serialized anyway
    // hasLivelyClosure is an attribute on functions which got recreated from a closure and we assume if you are using closures you will ensure saving them
    return typeof object !== 'function' || !!object.isWrapped || !!object.hasLivelyClosure;
  }
}

export var plugins = {
  livelyClassPropertiesPlugin: new LivelyClassPropertiesPlugin(),
  dontSerializePropsPlugin: new DontSerializePropsPlugin(),
  onlySerializePropsPlugin: new OnlySerializePropsPlugin(),
  additionallySerializePlugin: new AdditionallySerializePlugin(),
  classPlugin: new ClassPlugin(),
  customSerializePlugin: new CustomSerializePlugin(),
  indicationPlugin: new SerializationIndicationPlugin(),
  serializableCheckPlugin: new SerializableCheckPlugin(),
  finishPlugin: new SerializationFinishPlugin()
};

export var allPlugins = [
  plugins.indicationPlugin,
  plugins.customSerializePlugin,
  plugins.classPlugin,
  plugins.additionallySerializePlugin,
  plugins.onlySerializePropsPlugin,
  plugins.dontSerializePropsPlugin,
  plugins.livelyClassPropertiesPlugin,
  // plugins.serializableCheckPlugin,
  plugins.finishPlugin
];
