
// A `Closure` is a representation of a JavaScript function that controls what
// values are bound to out-of-scope variables. By default JavaScript has no
// reflection capabilities over closed values in functions. When needing to
// serialize execution or when behavior should become part of the state of a
// system it is often necessary to have first-class control over this language
// aspect.
//
// Typically closures aren't created directly but with the help of [`asScriptOf`](#)
//
// Example:
// function func(a) { return a + b; }
// var closureFunc = Closure.fromFunction(func, {b: 3}).recreateFunc();
// closureFunc(4) // => 7
// var closure = closureFunc.livelyClosure // => {
// //   varMapping: { b: 3 },
// //   originalFunc: function func(a) {/*...*/}
// // }
// closure.lookup("b") // => 3
// closure.getFuncSource() // => "function func(a) { return a + b; }"

import { evalJS } from "./function.js";

const parameterRegex = /function[^\(]*\(([^\)]*)\)|\(?([^\)=]*)\)?\s*=>/;

export default class Closure {

  static fromFunction(func, varMapping) {
    /*show-in-doc*/
    return new this(func, varMapping || {});
  }

  static fromSource(source, varMapping) {
    /*show-in-doc*/
    return new this(null, varMapping || {}, source);
  }

  constructor(func, varMapping, source, funcProperties) {
    this.originalFunc = func;
    this.varMapping = varMapping || {};
    this.setFuncSource(source || func);
    this.setFuncProperties(func || funcProperties);
  }

  get isLivelyClosure() { return true; }

  // serialization
  get doNotSerialize() { return ['originalFunc']; }


  // accessing
  setFuncSource(src) {
    /*show-in-doc*/
    src = typeof lively !== "undefined" && lively.sourceTransform
       && typeof lively.sourceTransform.stringifyFunctionWithoutToplevelRecorder === "function" ?
         lively.sourceTransform.stringifyFunctionWithoutToplevelRecorder(src) :
         String(src);
    return this.source = src;
  }

  getFuncSource() {
    /*show-in-doc*/
    return this.source || this.setFuncSource(this.originalFunc);
  }

  hasFuncSource() {
    /*show-in-doc*/
    return this.source && true;
  }

  getFunc() {
    /*show-in-doc*/
    return this.originalFunc || this.recreateFunc();
  }

  getFuncProperties() {
    // ignore-in-doc
    // a function may have state attached
    return this.funcProperties || (this.funcProperties = {});
  }

  setFuncProperties(obj) {
    // ignore-in-doc
    var props = this.getFuncProperties();
    for (var name in obj) {
      // The AST implementation assumes that Function objects are some
      // kind of value object. When their identity changes cached state
      // should not be carried over to new function instances. This is a
      // pretty intransparent way to invalidate attributes that are used
      // for caches.
      // @cschuster, can you please fix this by making invalidation more
      // explicit?
      if (obj.hasOwnProperty(name)) props[name] = obj[name];
    }
  }

  lookup(name) {
    /*show-in-doc*/
    return this.varMapping[name];
  }

  parameterNames(methodString) {
    // ignore-in-doc

    if (typeof lively !== "undefined" && lively.ast) {
      return (lively.ast.parseFunction(methodString).params || []).map(function(ea) {
        if (ea.type === "Identifier") return ea.name;
        if (ea.left && ea.left.type === "Identifier") return ea.left.name;
        return null;
      }).filter(Boolean);
    }

    var paramsMatch = parameterRegex.exec(methodString);
    if (!paramsMatch) return [];
    var paramsString = paramsMatch[1] || paramsMatch[2] || "";
    return paramsString.split(",").map(function(ea) { return ea.trim(); });
  }

  firstParameter(src) {
    // ignore-in-doc
    return this.parameterNames(src)[0] || null;
  }

  // -=-=-=-=-=-=-=-=-=-
  // function creation
  // -=-=-=-=-=-=-=-=-=-
  recreateFunc() {
    // Creates a real function object
    return this.recreateFuncFromSource(this.getFuncSource(), this.originalFunc);
  }

  recreateFuncFromSource(funcSource, optFunc) {
    // ignore-in-doc
    // what about objects that are copied by value, e.g. numbers?
    // when those are modified after the originalFunc we captured
    // varMapping then we will have divergent state
    var closureVars = [],
        thisFound = false,
        specificSuperHandling = this.firstParameter(funcSource) === '$super';
    for (var name in this.varMapping) {
      if (!this.varMapping.hasOwnProperty(name)) continue;
      if (name == 'this') { thisFound = true; continue; }
      // closureVars.push(`var ${name} = this.varMapping.${name};\n`);
      closureVars.push("var " + name + " = this.varMapping." + name + ";\n");
    }

    var src = "";
    if (closureVars.length > 0) src += closureVars.join("\n");
    if (specificSuperHandling) src += '(function superWrapperForClosure() { return ';
    src += "(" + funcSource + ")";
    if (specificSuperHandling) src += '.apply(this, [$super.bind(this)]'
                                    + '.concat(Array.from(arguments))) })';
    try {
      var func = evalJS.call(this, src) || this.couldNotCreateFunc(src);
      this.addFuncProperties(func);
      this.originalFunc = func;
      return func;
    } catch (e) {
      // var msg = `Cannot create function ${e} src: ${src}`;
      var msg = "Cannot create function " + e + " src: " + src;
      console.error(msg);
      throw new Error(msg);
    }
  }

  addFuncProperties(func) {
    // ignore-in-doc
    var props = this.getFuncProperties();
    for (var name in props)
      if (props.hasOwnProperty(name))
        func[name] = props[name];
    this.addClosureInformation(func);
  }

  couldNotCreateFunc(src) {
    // ignore-in-doc
    var msg = 'Could not recreate closure from source: \n' + src;
    console.error(msg);
    return function() { throw new Error(msg); };
  }

  // -=-=-=-=-=-
  // conversion
  // -=-=-=-=-=-
  asFunction() {
    /*ignore-in-doc*/
    return this.recreateFunc();
  }

  // -=-=-=-=-=-=-=-=-=-=-=-
  // function modification
  // -=-=-=-=-=-=-=-=-=-=-=-
  addClosureInformation(f) {
    /*ignore-in-doc-in-doc*/
    f.hasLivelyClosure = true;
    f.livelyClosure = this;
    return f;
  }

}
