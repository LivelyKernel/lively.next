import { obj, arr } from "lively.lang";

export class Plugin {}

class CustomSerializePlugin {

  // can realObj be manually serialized, e.g. into an expression?
  serializeObject(realObj, isProperty, pool, serializedObjMap, path) {
    if (typeof realObj.__serialize__ !== "function") return null;
    let serialized = realObj.__serialize__(pool, serializedObjMap, path);
    if (serialized.hasOwnProperty("__expr__")) {
      let expr = pool.expressionSerializer.exprStringEncode(serialized);
      serialized = isProperty ? expr : {__expr__: expr};
    }
    return serialized;
  }

  deserializeObject(pool, ref, snapshot, path) {
    let {__expr__} = snapshot;
    return __expr__ ? pool.expressionSerializer.deserializeExpr(__expr__) : null;
  }

}

class ClassPlugin {

  // record class meta info for re-instantiating
  additionallySerialize(pool, ref, snapshot, addFn) {
    pool.classHelper.addClassInfo(ref, ref.realObj, snapshot);
  }

  deserializeObject(pool, ref, snapshot, path) {
    return pool.classHelper.restoreIfClassInstance(ref, snapshot);
  }

}

class AdditionallySerializePlugin {
  // for objects with __additionally_serialize__(snapshot, ref, pool, addFn) method

  additionallySerialize(pool, ref, snapshot, addFn) {
    let {realObj} = ref;
    if (realObj && typeof realObj.__additionally_serialize__  === "function")
      realObj.__additionally_serialize__(snapshot, ref, pool, addFn);
  }

}

class OnlySerializePropsPlugin {

 propertiesToSerialize(pool, ref, snapshot, keysSoFar) {
   let {realObj} = ref;
   return (realObj && realObj.__only_serialize__) || null;
 }
}

class DontSerializePropsPlugin {

 propertiesToSerialize(pool, ref, snapshot, keysSoFar) {
   let {realObj} = ref;
   if (!realObj || !realObj.__dont_serialize__) return null;
   let ignoredKeys = obj.mergePropertyInHierarchy(realObj, "__dont_serialize__"),
       keys = [];
   for (let i = 0; i < keysSoFar.length; i++) {
     let key = keysSoFar[i];
     if (!ignoredKeys.includes(key))
       keys.push(key);
   }
   return keys;
 }

}

class LivelyClassPropertiesPlugin {

  propertiesToSerialize(pool, ref, snapshot, keysSoFar) {
    // serialize class properties as indicated by realObj.constructor.properties
    let {realObj} = ref,
        classProperties =
          ref.realObj.constructor[Symbol.for("lively.classes-properties-and-settings")];

    if (!classProperties) return null;

    let {properties, propertySettings} = classProperties,
        valueStoreProperty = propertySettings.valueStoreProperty || "_state",
        valueStore = realObj[valueStoreProperty],
        keys = [];

    let valueStoreKeyIdx = keysSoFar.indexOf(valueStoreProperty);
    if (valueStoreKeyIdx > -1) keysSoFar.splice(valueStoreKeyIdx, 1);

    if (!valueStore) return;

    for (let key in properties) {
      let spec = properties[key];
      if (spec.derived) continue;
      if (!spec || (spec.hasOwnProperty("serialize") && !spec.serialize)) continue;
      keys.push(key);
    }

    return arr.uniq(keys.concat(keysSoFar));
  }
}

export var plugins = {
  livelyClassPropertiesPlugin: new LivelyClassPropertiesPlugin(),
  dontSerializePropsPlugin:    new DontSerializePropsPlugin(),
  onlySerializePropsPlugin:    new OnlySerializePropsPlugin(),
  additionallySerializePlugin: new AdditionallySerializePlugin(),
  classPlugin:                 new ClassPlugin(),
  customSerializePlugin:       new CustomSerializePlugin(),
}

export var allPlugins = [
  plugins.customSerializePlugin,
  plugins.classPlugin,
  plugins.additionallySerializePlugin,
  plugins.onlySerializePropsPlugin,
  plugins.dontSerializePropsPlugin,
  plugins.livelyClassPropertiesPlugin
]
