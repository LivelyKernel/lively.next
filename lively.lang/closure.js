
/**
 * A `Closure` is a representation of a JavaScript function that controls what
 * values are bound to out-of-scope variables. By default JavaScript has no
 * reflection capabilities over closed values in functions. When needing to
 * serialize execution or when behavior should become part of the state of a
 * system it is often necessary to have first-class control over this language
 * aspect.
 * 
 * Typically closures aren't created directly but with the help of [`asScriptOf`](#)
 * 
 * @example
 * function func(a) { return a + b; }
 * var closureFunc = Closure.fromFunction(func, {b: 3}).recreateFunc();
 * closureFunc(4) // => 7
 * var closure = closureFunc.livelyClosure // => {
 * //   varMapping: { b: 3 },
 * //   originalFunc: function func(a) {/*...*\/}
 * // }
 * closure.lookup("b") // => 3
 * closure.getFuncSource() // => "function func(a) { return a + b; }"
 * @module lively.lang/closure
 */

import { evalJS } from './function.js';

const parameterRegex = /function[^\(]*\(([^\)]*)\)|\(?([^\)=]*)\)?\s*=>/;

/**
 * The representation of a JavaScript function.
 */
export default class Closure {
  /**
   * Converts a given `func` into a `Closure`.
   * @static
   * @param { function } func - The function to derive the closure from.
   * @param { object } [varMapping] - The variable bindings for the closure.
   * @returns { Closure }
   */
  static fromFunction (func, varMapping) {
    return new this(func, varMapping || {});
  }

  /**
   * Creates a Closure from a JavaScript source string.
   * @static
   * @param { string } source - The source code defining the function.
   * @param { object } [varMapping] - The variable bindings for the closure.
   * @param { Closure }
   */
  static fromSource (source, varMapping) {
    return new this(null, varMapping || {}, source);
  }

  /**
   * Create a `Closure`.
   * @param { function } func
   * @param { object } varMapping
   * @param { string } source
   * @param { object } funcProperties
   */
  constructor (func, varMapping, source, funcProperties) {
    this.originalFunc = func;
    this.varMapping = varMapping || {};
    this.setFuncSource(source || func);
    this.setFuncProperties(func || funcProperties);
  }

  /**
   * @property { boolean }
   */
  get isLivelyClosure () { return true; }

  get doNotSerialize () { return ['originalFunc']; }

  /**
   * Sets the source code of the closure.
   * @param { string } src
   */
  setFuncSource (src) {
    src = typeof lively !== 'undefined' && lively.sourceTransform &&
       typeof lively.sourceTransform.stringifyFunctionWithoutToplevelRecorder === 'function'
      ? lively.sourceTransform.stringifyFunctionWithoutToplevelRecorder(src)
      : String(src);
    return this.source = src;
  }

  /**
   * Returns the source code of the closure.
   * @returns { string }
   */
  getFuncSource () {
    return this.source || this.setFuncSource(this.originalFunc);
  }

  /**
   * Wether or not the closure has the source code of the function stored.
   * @returns { boolean }
   */
  hasFuncSource () {
    return this.source && true;
  }

  /**
   * Retrieve the original javascript function this closure represents.
   * @returns { function }
   */
  getFunc () {
    return this.originalFunc || this.recreateFunc();
  }

  /**
   * A function may have state attached. This returns the stored properties.
   * @returns { object }
   */
  getFuncProperties () {
    return this.funcProperties || (this.funcProperties = {});
  }

  /**
   * Attaches state to the function.
   * @returns { object }
   */
  setFuncProperties (obj) {
    const props = this.getFuncProperties();
    for (const name in obj) {
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

  /**
   * Lookup the binding of a given variable name.
   * @param { string } name - The name of the variable.
   * @returns { * } The value the variable is bound to.
   */
  lookup (name) {
    return this.varMapping[name];
  }
  
  /**
   * Returns the names of all the parameters of the function.
   * @access private
   * @param {string} methodString - The source code of the function.
   * @returns { string[] } The list of parameter names.
   */
  parameterNames (methodString) {
    // fixme: How to remove dependency of lively.ast? rms 21.1.22
    if (typeof lively !== 'undefined' && lively.ast && lively.ast.parseFunction) {
      return (lively.ast.parseFunction(methodString).params || []).map(function (ea) {
        if (ea.type === 'Identifier') return ea.name;
        if (ea.left && ea.left.type === 'Identifier') return ea.left.name;
        return null;
      }).filter(Boolean);
    }

    const paramsMatch = parameterRegex.exec(methodString);
    if (!paramsMatch) return [];
    const paramsString = paramsMatch[1] || paramsMatch[2] || '';
    return paramsString.split(',').map(function (ea) { return ea.trim(); });
  }
  
  /**
   * Returns the first parameter name derived from a given source code string of the function.
   * @access private
   * @param {string} src - The source code of the function.
   * @returns {string} The name of the first parameter.
   */
  firstParameter (src) {
    return this.parameterNames(src)[0] || null;
  }

  // -=-=-=-=-=-=-=-=-=-
  // function creation
  // -=-=-=-=-=-=-=-=-=-

  /**
   * Creates a real function object.
   * @returns { function }
   */
  recreateFunc () {
    return this.recreateFuncFromSource(this.getFuncSource(), this.originalFunc);
  }

  /**
   * what about objects that are copied by value, e.g. numbers?
   * when those are modified after the originalFunc we captured
   * varMapping then we will have divergent state.
   * @access private
   */
  recreateFuncFromSource (funcSource, optFunc) {
    const closureVars = [];
    // let thisFound = false;
    const specificSuperHandling = this.firstParameter(funcSource) === '$super';
    for (const name in this.varMapping) {
      if (!this.varMapping.hasOwnProperty(name)) continue;
      // if (name === 'this') { thisFound = true; continue; }
      // closureVars.push(`var ${name} = this.varMapping.${name};\n`);
      closureVars.push('var ' + name + ' = this.varMapping.' + name + ';\n');
    }

    let src = '';
    if (closureVars.length > 0) src += closureVars.join('\n');
    if (specificSuperHandling) src += '(function superWrapperForClosure() { return ';
    src += '(' + funcSource + ')';
    if (specificSuperHandling) {
      src += '.apply(this, [$super.bind(this)]' +
                                    '.concat(Array.from(arguments))) })';
    }
    try {
      const func = evalJS.call(this, src) || this.couldNotCreateFunc(src);
      this.addFuncProperties(func);
      this.originalFunc = func;
      return func;
    } catch (e) {
      // var msg = `Cannot create function ${e} src: ${src}`;
      const msg = 'Cannot create function ' + e + ' src: ' + src;
      console.error(msg);
      throw new Error(msg);
    }
  }

  /**
   * @access private
   */
  addFuncProperties (func) {
    const props = this.getFuncProperties();
    for (const name in props) {
      if (props.hasOwnProperty(name)) { func[name] = props[name]; }
    }
    this.addClosureInformation(func);
  }

  /**
   * Signal that function creation was unsuccessful.
   * @access private
   */
  couldNotCreateFunc (src) {
    const msg = 'Could not recreate closure from source: \n' + src;
    console.error(msg);
    return function () { throw new Error(msg); };
  }

  /**
   * Returns the function represented by the closure.
   * @returns { function }
   */
  asFunction () {
    return this.recreateFunc();
  }

  /**
   * Attach meta attributes to a function object.
   * @access private
   */
  addClosureInformation (f) {
    f.hasLivelyClosure = true;
    f.livelyClosure = this;
    return f;
  }
}
