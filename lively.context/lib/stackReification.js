/*global global, module,Global*/
import { Path, arr, Closure } from "lively.lang";
import { ReplaceVisitor, escodegen, parseFunction } from "lively.ast";
import { Interpreter, Function as AcornFunction, Scope } from "./interpreter.js";
import { __createClosure, originalFunctions, capturedBindingMappings, freeFunctionReferences, runtimeFunctionSource, removeRuntimeClosureAnnotations } from "./exception.js";
import { getCurrentASTRegistry, rewriteFunction } from "lively.context";

let Global = typeof window !== "undefined" ? window : globalThis;

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

let NativeArrayFunctions = {

  sort: function(sortFunc) {
    // show-in-doc
    if (!sortFunc) {
      sortFunc = function(x,y) {
        if (x < y) return -1;
        if (x > y) return 1;
        return 0;
      };
    }
    var len = this.length, sorted = [];
    for (var i = 0; i < this.length; i++) {
      var inserted = false;
      for (var j = 0; j < sorted.length; j++) {
        if (1 === sortFunc(sorted[j], this[i])) {
          inserted = true;
          sorted[j+1] = sorted[j];
          sorted[j] = this[i];
          break;
        }
      }
      if (!inserted) sorted.push(this[i]);
    }
    return sorted;
  },

  filter: function(iterator, context) {
    // show-in-doc
    var results = [];
    for (var i = 0; i < this.length; i++) {
      if (!this.hasOwnProperty(i)) continue;
      var value = this[i];
      if (iterator.call(context, value, i)) results.push(value);
    }
    return results;
  },

  forEach: function(iterator, context) {
    // show-in-doc
    for (var i = 0, len = this.length; i < len; i++) {
      iterator.call(context, this[i], i, this); }
  },

  some: function(iterator, context) {
    // show-in-doc
    for (var i = 0, len = this.length; i < len; i++) {
      if (i in this && iterator.call(context, this[i], i, this)) return true;
    }
    return false;
  },

  every: function(iterator, context) {
    // show-in-doc
    var result = true;
    for (var i = 0, len = this.length; i < len; i++) {
      result = result && !! iterator.call(context, this[i], i);
      if (!result) break;
    }
    return result;
  },

  map: function(iterator, context) {
    // show-in-doc
    var results = [];
    this.forEach(function(value, index) {
      results.push(iterator.call(context, value, index));
    });
    return results;
  },

  reduce: function(iterator, memo, context) {
    // show-in-doc
    var start = 0;
    if (!arguments.hasOwnProperty(1)) { start = 1; memo = this[0]; }
    for (var i = start; i < this.length; i++)
      memo = iterator.call(context, memo, this[i], i, this);
    return memo;
  },

  reduceRight: function(iterator, memo, context) {
    // show-in-doc
    var start = this.length-1;
    if (!arguments.hasOwnProperty(1)) { start--; memo = this[this.length-1]; }
    for (var i = start; i >= 0; i--)
      memo = iterator.call(context, memo, this[i], i, this);
    return memo;
  }

}

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
              spec.rewritten = stackCaptureMode(spec.dbg, null, astRegistry);
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
    const capture = Global.livelyDesktop && Global.livelyDesktop.debugger.captureFunctionBindings;
    if (liveBindings) addRecorderBindings(liveBindings, ast);
    const available = liveBindings && missing.every(name => Object.prototype.hasOwnProperty.call(liveBindings, name));
    if (!capture && !available) throw new Error('Missing closure bindings: ' + missing.join(', ') + '. Launch NW.js with LIVELY_APP_FUNCTION_SCOPES=1.');
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
    const capture = Global.livelyDesktop && Global.livelyDesktop.debugger.captureFunctionBindings;
    const ast = removeRuntimeClosureAnnotations(parseFunction(runtimeFunctionSource(func), {locations: true, addSource: true, addAstIndex: true}));
    if (liveBindings) addRecorderBindings(liveBindings, ast);
    const available = liveBindings && names.every(name => Object.prototype.hasOwnProperty.call(liveBindings, name));
    if (!capture && !available) throw new Error('Missing closure bindings: ' + names.join(', ') + '. Launch NW.js with LIVELY_APP_FUNCTION_SCOPES=1.');
    const bindings = available ? liveBindings : await capture(func, names);
    addRecorderBindings(bindings, ast);
    if (!liveBindings) capturedBindingMappings.add(bindings);
    const interpreted = new AcornFunction(ast, new Scope(bindings, new Scope(Global)), func).asFunction();
    return interpreted;
}

export function asRewrittenClosure(func, varMapping, astRegistry) {
    const bindings = func[Symbol.for('lively-debug-bindings')];
    if (bindings) {
        addRecorderBindings(bindings, parseFunction(runtimeFunctionSource(func)));
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
      originalFunctions.set(this.originalAst, this.getFunc());
      var func = this.recreateFuncFromSource(this.getRewrittenSource());
      if (this.originalAst.type === 'ArrowFunctionExpression') {
          const factory = this.recreateFuncFromSource('function() { return (' + this.getRewrittenSource() + '); }');
          const receiver = this.originalFunc && Object.prototype.hasOwnProperty.call(this.originalFunc, '_lexicalThis') ? this.originalFunc._lexicalThis : this.varMapping.this;
          const args = this.originalFunc && this.originalFunc._lexicalArguments || this.varMapping.arguments;
          func = factory.apply(receiver, args || []);
          func._lexicalThis = receiver;
          func._lexicalArguments = args;
      }
      const prototype = originalFunctions.get(this.originalAst)?.prototype;
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
      var src = this.originalFunc ? runtimeFunctionSource(this.originalFunc) : this.getFuncSource(),
          ast = removeToplevelRecorderRefs(parseFunction(src, { locations: true, addSource: true })),
          namespace = '[runtime]';
      // FIXME: URL not available here
      // if (this.originalFunc && this.originalFunc.sourceModule)
      //     namespace = new URL(this.originalFunc.sourceModule.findUri()).relativePathFrom(URL.root);
      this.originalAst = ast;
      this.frameState = [{}, this.varMapping, Global];
      this.varMapping = Object.defineProperties({__livelyClosureFrameState: this.frameState}, Object.getOwnPropertyDescriptors(this.varMapping));
      return this.ast = rewriteFunction(ast, astRegistry, namespace, '__livelyClosureFrameState', Object.keys(this.frameState[1]));
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
              result.error.shiftFrame(frame);
              return result;
          }

          // disconnect frames to ensure correct reconnection later
          frame.parentFrame = null;

          if (result.hasOwnProperty('val'))
              frame.supplyCallResult(result.val);

          try {
              return { val: frame.generator ? frame.generator.resume(interpreter) : interpreter.runFromPC(frame, result.val) };
          } catch (ex) {
              if (ex.unwindException) ex = ex.unwindException;
              if (!ex.isUnwindException)
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
          const exception = error instanceof Error ? error : new Error(String(error));
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
      continuation.reason = e.error instanceof Error ? 'exception' : e.error && e.error.reason || 'debugger';
      continuation.exception = e.error instanceof Error ? e.error : undefined;
      frame.exception = continuation.exception;
      return continuation;
  }

}
