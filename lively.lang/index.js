import * as string from "./string.js";
import * as num from "./number.js";
import * as fun from "./function.js";
import Closure from "./closure.js";
import * as arr from "./array.js";
import * as obj from "./object.js";
import * as properties from "./properties.js";
import * as date from "./date.js";
import promise from "./promise.js";
import Path from "./Path.js";
import * as graph from "./graph.js";
import * as interval from "./interval.js";
import * as arrayProjection from "./array-projection.js";
import Group from "./Group.js";
import * as grid from "./grid.js";
import * as tree from "./tree.js";
import * as events from "./events.js";
import * as messenger from "./messenger.js";
import * as worker from "./worker.js";

export {
  worker,
  messenger,
  events,
  tree,
  grid,
  arrayProjection,
  interval,
  graph,
  date,
  properties,
  obj,
  arr,
  fun,
  num,
  string,
  Closure,
  promise,
  Path,
  Group
}


var GLOBAL = typeof window !== "undefined" ?
              window : typeof global !== "undefined" ?
                global : typeof self !== "undefined" ?
                  self : this;
                  
var isNode = typeof process !== "undefined" && process.env && typeof process.exit === "function";
 
var globalInterfaceSpec = [
  {action: "installMethods", target: "Array",              sources: ["arr"],    methods: ["from", "genN","range","withN"]},
  {action: "installMethods", target: "Array.prototype",    sources: ["arr"],    methods: ["all","any","batchify","clear","clone","collect","compact","delimWith","detect","doAndContinue","each","equals","filterByKey","findAll","first","flatten","forEachShowingProgress","grep","groupBy","groupByKey","histogram","include","inject","intersect","invoke","last","mapAsync", "mapAsyncSeries", "mask","max","min","mutableCompact","nestedDelay","partition","pluck","pushAll","pushAllAt","pushAt","pushIfNotIncluded","reMatches","reject","rejectByKey","remove","removeAt","replaceAt","rotate","shuffle","size","sortBy","sortByKey","sum","swap","toArray","toTuples","union","uniq","uniqBy","without","withoutAll","zip"], alias: [["select", "filter"]]},
  {action: "installMethods", target: "Date",               sources: ["date"],   methods: [/*"parse"*/]},
  {action: "installMethods", target: "Date.prototype",     sources: ["date"],   methods: ["equals","format","relativeTo"]},
  {action: "installMethods", target: "Function",           sources: ["fun"],    methods: ["fromString"]},
  {action: "installMethods", target: "Function.prototype", sources: ["fun"],    methods: [/*"addProperties",*/"addToObject","argumentNames","asScript","asScriptOf","binds","curry","delay","functionNames","localFunctionNames","getOriginal","getVarMapping","logCalls","logCompletion","logErrors","qualifiedMethodName","setProperty","traceCalls","wrap"]},
  {action: "installMethods", target: "Number",             sources: ["num"],    methods: []},
  {action: "installMethods", target: "Number.prototype",   sources: ["num"],    methods: ["detent","randomSmallerInteger","roundTo","toDegrees","toRadians"]},
  {action: "installMethods", target: "Object",             sources: ["obj"],    methods: ["addScript","clone","deepCopy","extend","inherit","isArray","isBoolean","isElement","isEmpty","isFunction","isNumber","isObject","isRegExp","isString","isUndefined","merge","mergePropertyInHierarchy","values","valuesInPropertyHierarchy"]},
  {action: "installMethods", target: "Object.prototype",   sources: ["obj"],    methods: []},
  {action: "installMethods", target: "String.prototype",   sources: ["string"], methods: ["camelize","capitalize","digitValue","empty","hashCode","include","pad","regExpEscape","startsWithVowel","succ","times","toArray","toQueryParams","truncate"]},

  {action: "installObject", target: "Numbers",                source: "num",        methods: ["average","between","convertLength","humanReadableByteSize","median","normalRandom","parseLength","random","sort"]},
  {action: "installObject", target: "Properties",             source: "properties", methods: ["all","allOwnPropertiesOrFunctions","allProperties","any","forEachOwn","hash","nameFor","own","ownValues","values"]},
  {action: "installObject", target: "Strings",                source: "string",     methods: ["camelCaseString","createDataURI","diff","format","formatFromArray","indent","lineIndexComputer","lines","md5","newUUID","nonEmptyLines","pad","paragraphs","peekLeft","peekRight","print","printNested","printTable","printTree","quote","reMatches","stringMatch","tableize","tokens","unescapeCharacterEntities","withDecimalPrecision"]},
  {action: "installObject", target: "Objects",                source: "obj",        methods: ["asObject", "equals","inspect","isMutableType","safeToString","shortPrintStringOf","typeStringOf"]},
  {action: "installObject", target: "Functions",              source: "fun",        methods: ["all","compose","composeAsync","createQueue","debounce","debounceNamed","either","extractBody","flip","notYetImplemented","once","own","throttle","throttleNamed","timeToRun","timeToRunN","waitFor","workerWithCallbackQueue","wrapperChain"]},
  {action: "installObject", target: "Grid",                   source: "grid"},
  {action: "installObject", target: "Interval",               source: "interval"},
  {action: "installObject", target: "lively.ArrayProjection", source: "arrayProjection"},
  {action: "installObject", target: "lively.Closure",         source: "Closure"},
  {action: "installObject", target: "lively.Grouping",        source: "Group"},
  {action: "installObject", target: "lively.PropertyPath",    source: "Path"},
  {action: "installObject", target: "lively.Worker",          source: "worker"},
  {action: "installObject", target: "lively.Class",           source: "classHelper"}
];


function createLivelyLangObject() {
  return {
    chain: chain,
    noConflict: noConflict,
    installGlobals: installGlobals,
    uninstallGlobals: uninstallGlobals,
    globalInterfaceSpec: globalInterfaceSpec,
    toString: function() { return "[object lively.lang]"; }
  };
}

export var livelyLang = createLivelyLangObject();

function globalInstall() {
  if (isNode && !GLOBAL.lively) { if (!GLOBAL.lively) return; }

  livelyLang._prevLivelyGlobal = GLOBAL.lively;
  if (!GLOBAL.lively) GLOBAL.lively = {};
  if (!GLOBAL.lively.lang) GLOBAL.lively.lang = livelyLang;
  else
    for (var name in livelyLang) {
      GLOBAL.lively.lang[name] = livelyLang[name];
    }
};


export function chain(object) {
  if (!object) return object;

  var chained;
  if (Array.isArray(object)) return createChain(arr, object);
  if (object.constructor.name === "Date") return createChain(date, object);
  switch (typeof object) {
    case 'string': return createChain(string, object);
    case 'object': return createChain(obj, object);
    case 'function': return createChain(fun, object);
    case 'number': return createChain(num, object);
  }
  throw new Error("Chain for object " + object + " (" + object.constructor.name + ") no supported");
}

function createChain(interfaceObj, obj) {
  return Object.keys(interfaceObj).reduce(function(chained, methodName) {
    chained[methodName] = function(/*args*/) {
      var args = Array.prototype.slice.call(arguments),
          result = interfaceObj[methodName].apply(null, [obj].concat(args));
      return chain(result);
    }
    return chained;
  }, {value: function() { return obj; }});
}

export function noConflict() {
  if (!isNode) {
    var keepLivelyNS = livelyLang._prevLivelyGlobal;
    if (!keepLivelyNS) delete GLOBAL.lively
    else delete GLOBAL.lively.lang
  }
  return livelyLang;
}

export function installGlobals() {
  Object.assign(livelyLang, {
    worker,
    messenger,
    events,
    tree,
    grid,
    arrayProjection,
    interval,
    graph,
    date,
    properties,
    obj,
    arr,
    fun,
    num,
    string,
    Closure,
    promise,
    Path,
    Group
  });
  globalInterfaceSpec.forEach(function(ea) {
    if (ea.action === "installMethods") {
      var targetPath = Path(ea.target);
      if (!targetPath.isIn(GLOBAL)) targetPath.set(GLOBAL, {}, true);
      var sourcePath = Path(ea.sources[0]);
      ea.methods.forEach(function(name) {
        installProperty(
          sourcePath.concat([name]),
          targetPath.concat([name]));
      });
      if (ea.alias)
        ea.alias.forEach(function(mapping) {
          installProperty(
            sourcePath.concat([mapping[1]]),
            targetPath.concat([mapping[0]]));
        });

    } else if (ea.action === "installObject") {
      var targetPath = Path(ea.target);
      var source = Path(ea.source).get(livelyLang);
      targetPath.set(GLOBAL, source, true);

    } else throw new Error("Cannot deal with global setup action: " + ea.action);
  });
}

function installProperty(sourcePath, targetPath) {
  if (!sourcePath.isIn(livelyLang)) {
    var err = new Error("property not provided by lively.lang: " + sourcePath);
    console.error(err.stack || err);
    throw err;
  }

  var prop = sourcePath.get(livelyLang);
  if (typeof prop === "function" && targetPath.slice(-2, -1).toString() === "prototype") {
    var origFunc = prop;
    prop = function(/*this and args*/) {
      var args = Array.prototype.slice.call(arguments);
      args.unshift(this);
      return origFunc.apply(null, args);
    };
    prop.toString = function() { return origFunc.toString(); };
  }
  targetPath.set(GLOBAL, prop, true);
}

export function uninstallGlobals() {
  globalInterfaceSpec.forEach(function(ea) {
    if (ea.action === "installMethods") {
      var p = Path(ea.target)
      var source = Path(ea.source).get(livelyLang);
      var target = p.get(GLOBAL);
      if (!target) return;
      ea.methods
        .filter(function(name) { return source === target[name]; })
        .forEach(function(name) { delete target[name]; });
      if (ea.alias)
        ea.alias
          .filter(function(name) { return source === target[name]; })
          .forEach(function(mapping) { delete target[mapping[0]]; });

    } else if (ea.action === "installObject") {
      var p = Path(ea.target);
      p.del(GLOBAL);

    } else throw new Error("Cannot deal with global setup action: " + ea.action);
  })
}
