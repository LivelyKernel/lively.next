/* global System */
import { locateClass } from "lively.serializer2";
import { string } from "lively.lang";

const nameToClassMapping = {};

export function addClassMappings(mapping) {
  Object.assign(nameToClassMapping, mapping);
}

export function morph(props = {}, opts = {restore: false}) {
  var klass = nameToClassMapping.default;
  if (props.type) {
    if (typeof props.type === "function") klass = props.type;
    if (typeof props.type === "object") klass = locateClass(props.type);
    else if (typeof props.type === "string")
      klass = nameToClassMapping[props.type.toLowerCase()] || klass;
  }

  return opts.restore ?
    new klass({[Symbol.for("lively-instance-restorer")]: true}).initFromJSON(props) :
    new klass(props);
}

export function newMorphId(classOrClassName) {
  var prefix = typeof classOrClassName === "function" ?
    classOrClassName.name : typeof classOrClassName === "string" ?
      classOrClassName.toLowerCase() : "";
  return prefix + "_" + string.newUUID().replace(/-/g, "_");
}

async function lazyInspect(obj) {
  // lazy load
  var {inspect: realInspect} = await System.import("lively.ide/js/inspector.js")
  inspect = realInspect;
  return realInspect(obj);
}

export var inspect = lazyInspect;