/*global global, module,Global*/
import { Path, arr, Closure } from "lively.lang";
import { ReplaceVisitor, escodegen, parseFunction, withMozillaAstDo } from "lively.ast";
import { Interpreter, Function as AcornFunction, Scope } from "./interpreter.js";
import { __createClosure, originalFunctions, frameFunctions, isControlSignal, capturedBindingMappings, freeFunctionReferences, runtimeFunctionSource, removeRuntimeClosureAnnotations } from "./exception.js";
import { getCurrentASTRegistry, rewriteFunction } from "lively.context";

import { lexicalCaptures } from './lexical-captures.js';

let Global = typeof window !== "undefined" ? window : globalThis;

// Code caches contain syntax only; per-invocation mappings stay on the closure.
const parsedSources = new Map(), compiledSources = new WeakMap();
const compilationKey = Symbol('runtime compilation');
/** Bound syntax caches to the most recently used source entries. */
function cacheCode(cache, key, value) {
    cache.delete(key);
    cache.set(key, value);
    if (cache.size > 256) cache.delete(cache.keys().next().value);
    return value;
}
/** Parse runtime source once without retaining the function or its captures. */
function runtimeAst(func) {
    const source = runtimeFunctionSource(func);
    const ast = parsedSources.get(source) || parseFunction(source, {locations: true, addSource: true});
    cacheCode(parsedSources, source, ast);
    return ast;
}

function removeToplevelRecorderRefs(ast, recorderName = '__lvVarRecorder') {
    return ReplaceVisitor.run(removeRuntimeClosureAnnotations(ast), node => {
        if (!node) return node;
        if (node.type !== 'MemberExpression' || node.computed || !node.object) return node;
        if (node.object.type !== 'Identifier' || node.object.name !== recorderName) return node;
        return node.property;
    });
}

function ensureLivelyLangPath() {
    if (!Global.lively) Global.lively = {};
    if (!Global.lively.lang) Global.lively.lang = {};
    if (!Global.lively.lang.Path) Global.lively.lang.Path = Path;
}

/** Box receivers while preserving the native null/undefined rejection. */
function arrayObject(value) {
  if (value == null) throw new TypeError('Array method called on null or undefined');
  return Object(value);
}

/** Capture LengthOfArrayLike once, using ToLength numeric conversion. */
function arrayLength(object) {
  const length = +object.length;
  return length > 0 ? Math.min(Math.floor(length), Number.MAX_SAFE_INTEGER) : 0;
}

/** Validate callbacks even when the receiver is empty. */
function arrayCallback(callback) {
  if (typeof callback !== 'function') throw new TypeError('Array callback must be callable');
}

/** Create map/filter results with the receiver's Array species. */
function arraySpeciesCreate(object, length) {
  let constructor;
  if (Array.isArray(object)) {
    constructor = object.constructor;
    // The intrinsic Array from another realm is treated as the default species.
    if (typeof constructor === 'function' && constructor !== Array &&
        globalThis.Function.prototype.toString.call(constructor) === 'function Array() { [native code] }') constructor = undefined;
    if (constructor && (typeof constructor === 'object' || typeof constructor === 'function')) {
      constructor = constructor[Symbol.species];
      if (constructor === null) constructor = undefined;
    }
  }
  return constructor === undefined ? new Array(length) : new constructor(length);
}

/** Create result elements without invoking inherited setters. */
function arrayDefine(object, key, value) {
  Object.defineProperty(object, key, {value, writable: true, enumerable: true, configurable: true});
}

/** Preserve sort's throwing Set semantics on read-only indices. */
function arraySet(object, key, value) {
  if (!Reflect.set(object, key, value)) throw new TypeError('Cannot write array index ' + key);
}

/** Preserve sort's throwing Delete semantics when trailing holes remain. */
function arrayDelete(object, key) {
  if (!Reflect.deleteProperty(object, key)) throw new TypeError('Cannot delete array index ' + key);
}

/** Use ToString semantics, including the rejection of Symbols. */
function arraySortString(value) {
  if (typeof value === 'symbol') throw new TypeError('Cannot convert a Symbol value to a string');
  return String(value);
}

const arrayHelpers = {arrayObject, arrayLength, arrayCallback, arraySpeciesCreate, arrayDefine, arraySet, arrayDelete, arraySortString};

let NativeArrayFunctions = {
  sort: function(compare) {
    if (compare !== undefined) arrayCallback(compare);
    var object = arrayObject(this), length = arrayLength(object), values = [];
    for (var index = 0; index < length; index++) if (index in object) values.push(object[index]);
    // A stable merge keeps callback invocations resumable, unlike native sort.
    for (var width = 1; width < values.length; width *= 2) {
      var merged = [];
      for (var start = 0; start < values.length; start += width * 2) {
        var left = start, middle = Math.min(start + width, values.length), right = middle, end = Math.min(start + width * 2, values.length);
        while (left < middle && right < end) {
          var x = values[left], y = values[right], order;
          if (x === undefined) order = y === undefined ? 0 : 1;
          else if (y === undefined) order = -1;
          else if (compare !== undefined) order = +Reflect.apply(compare, undefined, [x, y]);
          else { var a = arraySortString(x), b = arraySortString(y); order = a < b ? -1 : a > b ? 1 : 0; }
          if (!(order > 0)) merged.push(values[left++]);
          else merged.push(values[right++]);
        }
        while (left < middle) merged.push(values[left++]);
        while (right < end) merged.push(values[right++]);
      }
      values = merged;
    }
    for (var index = 0; index < values.length; index++) arraySet(object, index, values[index]);
    for (; index < length; index++) arrayDelete(object, index);
    return object;
  },

  filter: function(iterator, context) {
    var object = arrayObject(this), length = arrayLength(object);
    arrayCallback(iterator);
    var result = arraySpeciesCreate(object, 0), next = 0;
    for (var index = 0; index < length; index++) {
      if (!(index in object)) continue;
      var value = object[index];
      if (Reflect.apply(iterator, context, [value, index, object])) arrayDefine(result, next++, value);
    }
    return result;
  },

  forEach: function(iterator, context) {
    var object = arrayObject(this), length = arrayLength(object);
    arrayCallback(iterator);
    for (var index = 0; index < length; index++) {
      if (index in object) Reflect.apply(iterator, context, [object[index], index, object]);
    }
  },

  some: function(iterator, context) {
    var object = arrayObject(this), length = arrayLength(object);
    arrayCallback(iterator);
    for (var index = 0; index < length; index++) {
      if (index in object && Reflect.apply(iterator, context, [object[index], index, object])) return true;
    }
    return false;
  },

  every: function(iterator, context) {
    var object = arrayObject(this), length = arrayLength(object);
    arrayCallback(iterator);
    for (var index = 0; index < length; index++) {
      if (index in object && !Reflect.apply(iterator, context, [object[index], index, object])) return false;
    }
    return true;
  },

  map: function(iterator, context) {
    var object = arrayObject(this), length = arrayLength(object);
    arrayCallback(iterator);
    var result = arraySpeciesCreate(object, length);
    for (var index = 0; index < length; index++) {
      if (index in object) arrayDefine(result, index, Reflect.apply(iterator, context, [object[index], index, object]));
    }
    return result;
  },

  reduce: function(iterator, memo) {
    var object = arrayObject(this), length = arrayLength(object), index = 0;
    arrayCallback(iterator);
    if (arguments.length < 2) {
      while (index < length && !(index in object)) index++;
      if (index === length) throw new TypeError('Reduce of empty array with no initial value');
      memo = object[index++];
    }
    for (; index < length; index++) {
      if (index in object) memo = Reflect.apply(iterator, undefined, [memo, object[index], index, object]);
    }
    return memo;
  },

  reduceRight: function(iterator, memo) {
    var object = arrayObject(this), length = arrayLength(object), index = length - 1;
    arrayCallback(iterator);
    if (arguments.length < 2) {
      while (index >= 0 && !(index in object)) index--;
      if (index < 0) throw new TypeError('Reduce of empty array with no initial value');
      memo = object[index--];
    }
    for (; index >= 0; index--) {
      if (index in object) memo = Reflect.apply(iterator, undefined, [memo, object[index], index, object]);
    }
    return memo;
  }
};

export const debugReplacements = {
        Function: {
            bind: {},
            call: {},
            applyt: {}
        },
        Array: {
            sort: {
                dbg: NativeArrayFunctions.sort
            },
            filter: {
                dbg: NativeArrayFunctions.filter
            },
            forEach: {
                dbg: NativeArrayFunctions.forEach
            },
            some: {
                dbg: NativeArrayFunctions.some
            },
            every: {
                dbg: NativeArrayFunctions.every
            },
            map: {
                dbg: NativeArrayFunctions.map
            },
            reduce: {
                dbg: NativeArrayFunctions.reduce
            },
            reduceRight: {
                dbg: NativeArrayFunctions.reduceRight
            }
        },
        String: {
            // TODO: second parameter can be function (replaceValue)
            replace: {}
        },
        JSON: {
            // TODO: second parameter can be function (replacer)
            stringify: {}
        }
    }

const debuggerState = Global[Symbol.for('lively-debugger-state')] ||= {};
debuggerState.supportDepth ||= 0;

export function debugSupportEnabled() { return debuggerState.supportDepth > 0; }

export function enableDebugSupport(astRegistry) {
  // FIXME currently only takes care of Array
  try {
      ensureLivelyLangPath();
      if (debuggerState.supportDepth++) return;
      debuggerState.configOption = Global.lively.Config?.enableDebuggerStatements;
      (Global.lively.Config ||= {}).enableDebuggerStatements = true;
      astRegistry = astRegistry || getCurrentASTRegistry();
      var replacements = debugReplacements;
      for (var method in replacements.Array) {
          if (!replacements.Array.hasOwnProperty(method)) continue;
          var spec = replacements.Array[method];
          if (spec.astRegistry !== astRegistry) {
              const closure = asRewrittenClosure(spec.dbg, arrayHelpers, astRegistry);
              // Native methods keep null/undefined receivers; the compiled body
              // needs a directive outside its generated try/catch for that too.
              closure.ast.body.body.unshift({type: 'ExpressionStatement', directive: 'use strict', expression: {type: 'Literal', value: 'use strict'}});
              spec.rewritten = closure.getRewrittenFunc();
              Object.defineProperties(spec.rewritten, {
                  name: {value: method, configurable: true},
                  length: {value: Array.prototype[method].length, configurable: true}
              });
              spec.astRegistry = astRegistry;
          }
          spec.original = Array.prototype[method];
          Array.prototype[method] = spec.rewritten;
      }
  } catch(e) {
      disableDebugSupport();
      throw e;
  }
}

export function disableDebugSupport() {
  if (!debuggerState.supportDepth || --debuggerState.supportDepth) return;
  Global.lively.Config.enableDebuggerStatements = debuggerState.configOption;
  var replacements = debugReplacements;
  for (var method in replacements.Array) {
      var spec = replacements.Array[method],
          original = spec.original || Array.prototype[method];
      Array.prototype[method] = original;
  }
}

export function run(func, astRegistry, args, optMapping) {
  // FIXME: __getClosure - needed for UnwindExceptions also used here - uses
  //        lively.ast.Rewriting.getCurrentASTRegistry()
  astRegistry = astRegistry || getCurrentASTRegistry();
  enableDebugSupport(astRegistry);
  try {
      if (!func.livelyDebuggingEnabled)
          func = stackCaptureMode(func, optMapping, astRegistry);
      return { isContinuation: false, returnValue: func.apply(optMapping && optMapping.this, args || []) };
  } catch (e) {
      // e will not be an UnwindException in rewritten system (gets unwrapped)
      if (!e.isUnwindException && !e.unwindException) throw e;
      e = e.isUnwindException ? e : e.unwindException;
      const continuation = Continuation.fromUnwindException(e);
      if (continuation.reason !== 'await') return continuation;
      return continuation.resume().then(result => result && result.isContinuation
          ? result : {isContinuation: false, returnValue: result});
  } finally {
      disableDebugSupport(astRegistry);
  }
}

export async function runWithCapturedBindings(func, astRegistry, args, mapping = {}) {
    if (func.livelyDebuggingEnabled) return run(func, astRegistry, args, mapping);
    const ast = removeRuntimeClosureAnnotations(parseFunction(runtimeFunctionSource(func)));
    const missing = [...new Set(freeFunctionReferences(ast).map(ref => ref.name))]
        .filter(name => !Object.prototype.hasOwnProperty.call(mapping, name) && !(name in Global));
    if (!missing.length) return run(func, astRegistry, args, mapping);
    const liveBindings = func[Symbol.for('lively-debug-bindings')];
    const capture = Global.livelyDesktop?.debugger?.captureFunctionBindings;
    if (liveBindings) addRecorderBindings(liveBindings, ast);
    const available = liveBindings && missing.every(name => Object.prototype.hasOwnProperty.call(liveBindings, name));
    if (!capture && !available) throw new Error('Missing closure bindings: ' + missing.join(', ') + '. Retained bindings are read by the lively.next desktop app unless LIVELY_APP_FUNCTION_SCOPES=0.');
    const bindings = available ? Object.defineProperties({}, Object.getOwnPropertyDescriptors(liveBindings)) : await capture(func, missing);
    addRecorderBindings(bindings, ast);
    if (!liveBindings) capturedBindingMappings.add(bindings);
    Object.defineProperties(bindings, Object.getOwnPropertyDescriptors(mapping));
    return run(func, astRegistry, args, bindings);
}

export function addRecorderBindings(bindings, ast) {
    const recorder = bindings.__lvVarRecorder;
    if (!recorder) return;
    const namesKey = Symbol.for('lively-debug-module-bindings');
    if (!bindings[namesKey]) Object.defineProperty(bindings, namesKey, {value: []});
    for (const ref of freeFunctionReferences(removeToplevelRecorderRefs(ast))) {
        if (Object.prototype.hasOwnProperty.call(bindings, ref.name) || !(ref.name in recorder)) continue;
        Object.defineProperty(bindings, ref.name, {enumerable: true, configurable: true,
            get() { return recorder[ref.name]; }, set(value) { recorder[ref.name] = value; }});
        bindings[namesKey].push(ref.name);
    }
}

export async function prepareCapturedFunction(func, names) {
    const liveBindings = func[Symbol.for('lively-debug-bindings')];
    const capture = Global.livelyDesktop?.debugger?.captureFunctionBindings;
    const ast = removeRuntimeClosureAnnotations(parseFunction(runtimeFunctionSource(func), {locations: true, addSource: true, addAstIndex: true}));
    if (liveBindings) addRecorderBindings(liveBindings, ast);
    const available = liveBindings && names.every(name => Object.prototype.hasOwnProperty.call(liveBindings, name));
    if (!capture && !available) throw new Error('Missing closure bindings: ' + names.join(', ') + '. Retained bindings are read by the lively.next desktop app unless LIVELY_APP_FUNCTION_SCOPES=0.');
    const bindings = available ? liveBindings : await capture(func, names);
    addRecorderBindings(bindings, ast);
    if (!liveBindings) capturedBindingMappings.add(bindings);
    const interpreted = new AcornFunction(ast, new Scope(bindings, new Scope(Global)), func).asFunction();
    return interpreted;
}

export function asRewrittenClosure(func, varMapping, astRegistry) {
    const bindings = func[Symbol.for('lively-debug-bindings')];
    if (bindings) {
        addRecorderBindings(bindings, runtimeAst(func));
        const supplied = varMapping || {};
        varMapping = Object.defineProperties({}, Object.getOwnPropertyDescriptors(bindings));
        Object.defineProperties(varMapping, Object.getOwnPropertyDescriptors(supplied));
        const cellKey = Symbol.for('lively-debug-binding-cells');
        const overrides = name => Object.prototype.hasOwnProperty.call(supplied, name) &&
            Object.getOwnPropertyDescriptor(supplied, name).get !== Object.getOwnPropertyDescriptor(bindings, name).get;
        if (Object.keys(bindings[cellKey]).some(overrides)) {
            const descriptors = Object.getOwnPropertyDescriptors(varMapping);
            descriptors[cellKey] = {value: Object.fromEntries(Object.entries(bindings[cellKey]).filter(([name]) => !overrides(name))), configurable: true};
            varMapping = Object.defineProperties({}, descriptors);
        }
    }
    var closure = new RewrittenClosure(func, varMapping);
    closure.rewrite(astRegistry);
    return closure;
}

export function stackCaptureMode(func, varMapping, astRegistry) {
    var closure = asRewrittenClosure(func, varMapping, astRegistry),
        rewrittenFunc = closure.getRewrittenFunc();
    if (!rewrittenFunc) throw new Error('Cannot rewrite ' + func);
    return rewrittenFunc;
}

export function stackCaptureSource(func, varMapping, astRegistry) {
    return asRewrittenClosure(func, astRegistry).getRewrittenSource();
}

// fixme: remove the need to monkey path the lang object 
//lang.obj.extend(lang.fun, FunctionExtensions);
// Object.getOwnPropertyNames(FunctionExtensions).forEach(function(prop) {
//     Function.prototype[prop] = FunctionExtensions[prop];
// });

export class RewrittenClosure extends Closure {

  constructor(func, varMapping, source) {
      super(func, varMapping, source);
      this.ast = null;
  }

  getRewrittenFunc() {
      const original = this.getFunc();
      originalFunctions.set(this.originalAst, original);
      frameFunctions.set(this.frameState, {ast: this.originalAst, func: original});
      var func = this.recreateFuncFromSource(this.getRewrittenSource());
      if (this.originalAst.type === 'ArrowFunctionExpression') {
          const factory = this.recreateFuncFromSource('function() { return (' + this.getRewrittenSource() + '); }');
          const receiver = this.originalFunc && Object.prototype.hasOwnProperty.call(this.originalFunc, '_lexicalThis') ? this.originalFunc._lexicalThis : this.varMapping.this;
          const args = this.originalFunc && this.originalFunc._lexicalArguments || this.varMapping.arguments;
          func = factory.apply(receiver, args || []);
          const captures = lexicalCaptures(this.originalAst);
          if (captures.this) Object.defineProperty(func, '_lexicalThis', {value: receiver, configurable: true, writable: true});
          if (captures.arguments) Object.defineProperty(func, '_lexicalArguments', {value: args, configurable: true, writable: true});
      }
      const prototype = original.prototype;
      if (prototype && func.prototype) func.prototype = prototype;
      return __createClosure('[runtime]', this.originalAst.registryId, this.frameState, func);
  }

  getRewrittenSource() {
      return this.ast && escodegen.generate(this.ast);
  }

  getOriginalFunc() {
      return this.addClosureInformation(this.getFunc());
  }

  rewrite(astRegistry) {
      astRegistry ||= getCurrentASTRegistry();
      const source = this.originalFunc ? runtimeFunctionSource(this.originalFunc) : this.getFuncSource();
      const key = JSON.stringify([source, Object.keys(this.varMapping).sort()]);
      let cache = compiledSources.get(astRegistry);
      if (!cache) compiledSources.set(astRegistry, cache = new Map());
      let code = cache.get(key)?.deref();
      this.frameState = [{}, this.varMapping, Global];
      this.varMapping = Object.defineProperties({__livelyClosureFrameState: this.frameState}, Object.getOwnPropertyDescriptors(this.varMapping));
      if (!code) {
          const parsed = this.originalFunc ? runtimeAst(this.originalFunc) : parseFunction(source, {locations: true, addSource: true});
          const ast = removeToplevelRecorderRefs(structuredClone(parsed));
          // Preserve Acorn's Node.__serialize__ protocol on cached syntax copies.
          withMozillaAstDo(ast, null, (next, node) => { Object.setPrototypeOf(node, Object.getPrototypeOf(parsed)); next(); });
          const rewritten = rewriteFunction(ast, astRegistry, '[runtime]', '__livelyClosureFrameState', Object.keys(this.frameState[1]));
          code = {original: ast, rewritten};
          // Live generated closures keep their entire compilation (including child AST slots).
          Object.defineProperty(ast, compilationKey, {value: code});
      }
      cacheCode(cache, key, new WeakRef(code));
      this.originalAst = code.original;
      return this.ast = code.rewritten;
  }

};

export class Continuation {

  get __dont_serialize__() { return ['error', 'onSuspend']; }

  __additionally_serialize__(snapshot, ref, pool, addFn) {
      if (this.currentFrame.pendingAwait) addFn('reason', 'await');
      else addFn('error', this.error);
  }

  get isContinuation() { return true }

  constructor(frame) {
      this.currentFrame = frame; // the frame in which the the unwind was triggered
  }

  copy() {
      return new this.constructor(this.currentFrame.copy());
  }

  frames() {
      var frame = this.currentFrame, result = [];
      do { result.push(frame); } while (frame = frame.getParentFrame());
      return result;
  }

  resume() {
      if (this.reason === 'bindings') return this.settleBindings().then(continuation => continuation.resume());
      if (this.reason === 'await') return this.settleAwait().then(continuation =>
          continuation.reason === 'exception' ? continuation : continuation.resume());
      // FIXME: outer context usually does not have original AST
      // attaching the program node would possibly be right (otherwise the pc's context is missing)
      if (!this.currentFrame.getOriginalAst())
          throw new Error('Cannot resume because frame has no AST!');
      if (!this.currentFrame.getPC())
          throw new Error('Cannot resume because frame has no pc!');

      var interpreter = new Interpreter({captureErrors: true});

      // go through all frames on the stack. beginning with the top most,
      // resume each of them
      var result = this.frames().reduce(function(result, frame, i) {
          if (result.error) {
              if (!(frame.pendingIterator || frame.pendingDelegate) || isControlSignal(result.error.error)) {
                  result.error.shiftFrame(frame);
                  return result;
              }
              // A resumed iterator request rejects at its consumer's loop/yield.
              if (result.error.top?.generator) result.error.top.generator.state = 'done';
              frame.awaitRejection = result.error.release();
              delete frame.pendingIterator;
              delete frame.pendingDelegate;
          }

          // disconnect frames to ensure correct reconnection later
          frame.parentFrame = null;

          if (result.hasOwnProperty('val'))
              frame.supplyCallResult(result.val);

          try {
              return { val: frame.generator ? frame.generator.resume(interpreter) : interpreter.runFromPC(frame, result.val) };
          } catch (ex) {
              if (ex?.unwindException) ex = ex.unwindException;
              if (!ex?.isUnwindException)
                  throw ex;
              return { error: ex };
          }
      }, {});

      if (result.error) {
          const continuation = Continuation.fromUnwindException(result.error);
          continuation.onSuspend = this.onSuspend;
          return continuation.reason === 'await' || continuation.reason === 'bindings' ? continuation.resume() : continuation;
      }
      else
          return result.val;
  }

  async settleAwait() {
      const frame = this.currentFrame;
      if (!this.error?.promise) throw new Error('The saved await needs a result. Supply it in the debugger before proceeding.');
      if (this.onSuspend) this.onSuspend(this);
      try {
          const value = await this.error.promise;
          this.supplyAwaitResult(value);
      } catch (error) {
          const exception = error;
          this.reason = 'exception';
          this.error = this.exception = frame.exception = frame.awaitRejection = exception;
          delete frame.pendingAwait;
          if (frame.canCatchAt(frame.getPC())) {
              this.reason = 'debugger';
              this.exception = frame.exception = undefined;
          }
      }
      return this;
  }

  supplyAwaitResult(value) {
      const frame = this.currentFrame;
      if (!frame.pendingAwait) throw new Error('No pending await in this frame');
      const pending = frame.pendingAwait;
      if (pending.iteratorKey) {
          const iterator = frame.alreadyComputed[pending.iteratorKey];
          if (pending.operation === 'next') iterator.acceptStep(value);
          else {
              if (value === null || typeof value !== 'object') throw new TypeError('Iterator result is not an object');
              iterator.done = true;
              iterator.phase = 'done';
          }
      } else if (pending.valueKey) frame.alreadyComputed[pending.valueKey] = value;
      else if (pending.delegateKey) {
          const iterator = frame.alreadyComputed[pending.delegateKey];
          iterator.hasResult = true;
          iterator.result = value;
      } else frame.alreadyComputed[pending.astIndex] = value;
      delete frame.pendingAwait;
      this.reason = 'debugger';
      this.error = undefined;
      return this;
  }

  async settleBindings() {
      const prepared = await prepareCapturedFunction(this.error.func, this.error.names);
      const pending = this.currentFrame.pendingCall;
      if (pending.fn === this.error.func) pending.fn = prepared;
      else pending.recv = prepared; // Function.prototype.call/apply
      this.reason = 'debugger';
      this.error = undefined;
      return this;
  }

  static fromUnwindException(e) {
      if (!e.isUnwindException) console.error("No unwind exception?");
      e.recreateFrames();
      var frame = Interpreter.stripInterpreterFrames(e.top),
          continuation = new this(frame);
      continuation.error = e.error;
      e.release();
      const control = isControlSignal(e.error);
      if (!control && !(e.error instanceof Error)) throw e.error;
      continuation.reason = control ? e.error.reason || 'debugger' : 'exception';
      continuation.exception = control ? undefined : e.error;
      frame.exception = continuation.exception;
      return continuation;
  }

}
