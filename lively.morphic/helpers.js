/* global System */
import { locateClass } from "lively.serializer2";
import { string } from "lively.lang";
import { parseQuery } from "lively.resources";
import { stringifyQuery } from "lively.resources/src/helpers.js";

var touchInput;

try {  
  document.createEvent("TouchEvent");  
  touchInput = true;  
} catch (e) {  
  touchInput = false;  
}

export var touchInputDevice = touchInput;

var nameToClassMapping = nameToClassMapping || {};

export function pathForBrowserHistory(worldName, queryString) {
  // how does the resource map to a URL shown in the browser URL bar? used for
  // browser history
  queryString = queryString.trim();
  let query;
  if (!queryString || queryString === "?") query = {};
  else query = parseQuery(queryString);
  
  let basePath = "/worlds/load";
  query.name = worldName.replace(/\.json$/, "").replace(/%20/g, " ");
  // ensure the name param in the query string matches worldName
  
  return `${basePath}?${stringifyQuery(query)}`;
}

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
    classOrClassName[Symbol.for('__LivelyClassName__')] : typeof classOrClassName === "string" ?
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