/*global global, module,Global*/
import { Path, arr, Closure } from "lively.lang";
import { ReplaceVisitor, escodegen, parseFunction } from "lively.ast";
import { Interpreter, Function as AcornFunction, Scope } from "./interpreter.js";
import { __createClosure, originalFunctions, interpretedFunctions, capturedBindingMappings, freeFunctionReferences } from "./exception.js";
import { getCurrentASTRegistry, rewriteFunction } from "lively.context";

let Global = typeof window !== "undefined" ? window : globalThis;

function removeToplevelRecorderRefs(ast, recorderName = '__lvVarRecorder') {
    return ReplaceVisitor.run(ast, node => {
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
    return arr.detect(this, iterator, context) !== undefined;
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

let debugOption = Path('lively.Config.enableDebuggerStatements');
let configOption, debugSupportDepth = 0;

export function enableDebugSupport(astRegistry) {
  // FIXME currently only takes care of Array
  try {
      ensureLivelyLangPath();
      if (debugSupportDepth++) return;
      configOption = debugOption.get(Global);
      debugOption.set(Global, true, true);
      var replacements = debugReplacements;
      for (var method in replacements.Array) {
          if (!replacements.Array.hasOwnProperty(method)) continue;
          var spec = replacements.Array[method],
              dbgVersion = stackCaptureMode(spec.dbg, null, astRegistry);
          if (!spec.original) spec.original = Array.prototype[method];
          Array.prototype[method] = dbgVersion;
      }
  } catch(e) {
      disableDebugSupport();
      throw e;
  }
}

export function disableDebugSupport() {
  if (!debugSupportDepth || --debugSupportDepth) return;
  debugOption.set(Global, configOption, true);
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
    const ast = parseFunction(func.toString());
    const missing = [...new Set(freeFunctionReferences(ast).map(ref => ref.name))]
        .filter(name => !Object.prototype.hasOwnProperty.call(mapping, name) && !(name in Global));
    if (!missing.length) return run(func, astRegistry, args, mapping);
    const capture = Global.livelyDesktop && Global.livelyDesktop.debugger.captureFunctionBindings;
    if (!capture) throw new Error('Missing closure bindings: ' + missing.join(', ') + '. Launch NW.js with LIVELY_APP_FUNCTION_SCOPES=1.');
    const bindings = await capture(func, missing);
    addRecorderBindings(bindings, ast);
    capturedBindingMappings.add(bindings);
    Object.defineProperties(bindings, Object.getOwnPropertyDescriptors(mapping));
    return run(func, astRegistry, args, bindings);
}

function addRecorderBindings(bindings, ast) {
    const recorder = bindings.__lvVarRecorder;
    if (!recorder) return;
    for (const ref of freeFunctionReferences(removeToplevelRecorderRefs(ast))) {
        if (Object.prototype.hasOwnProperty.call(bindings, ref.name) || !(ref.name in recorder)) continue;
        Object.defineProperty(bindings, ref.name, {enumerable: true, configurable: true,
            get() { return recorder[ref.name]; }, set(value) { recorder[ref.name] = value; }});
    }
}

export async function prepareCapturedFunction(func, names) {
    const capture = Global.livelyDesktop && Global.livelyDesktop.debugger.captureFunctionBindings;
    if (!capture) throw new Error('Missing closure bindings: ' + names.join(', ') + '. Launch NW.js with LIVELY_APP_FUNCTION_SCOPES=1.');
    const bindings = await capture(func, names);
    const ast = parseFunction(func.toString(), {locations: true, addSource: true, addAstIndex: true});
    addRecorderBindings(bindings, ast);
    capturedBindingMappings.add(bindings);
    const interpreted = new AcornFunction(ast, new Scope(bindings, new Scope(Global)), func).asFunction();
    interpretedFunctions.set(func, interpreted);
    return interpreted;
}

export function asRewrittenClosure(func, varMapping, astRegistry) {
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
      return __createClosure('[runtime]', this.originalAst.registryId, this.frameState, func);
  }

  getRewrittenSource() {
      return this.ast && escodegen.generate(this.ast);
  }

  getOriginalFunc() {
      return this.addClosureInformation(this.getFunc());
  }

  rewrite(astRegistry) {
      var src = this.getFuncSource(),
          ast = removeToplevelRecorderRefs(parseFunction(src, { locations: true, addSource: true })),
          namespace = '[runtime]';
      // FIXME: URL not available here
      // if (this.originalFunc && this.originalFunc.sourceModule)
      //     namespace = new URL(this.originalFunc.sourceModule.findUri()).relativePathFrom(URL.root);
      this.originalAst = ast;
      this.frameState = [{}, this.varMapping, Global];
      this.varMapping = { ...this.varMapping, __livelyClosureFrameState: this.frameState };
      return this.ast = rewriteFunction(ast, astRegistry, namespace, '__livelyClosureFrameState', Object.keys(this.frameState[1]));
  }

};

export class Continuation {

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
      if (!this.currentFrame.pc)
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
              frame.alreadyComputed[frame.pc.astIndex] = result.val;

          try {
              return { val: interpreter.runFromPC(frame, result.val) };
          } catch (ex) {
              if (ex.unwindException) ex = ex.unwindException;
              if (!ex.isUnwindException)
                  throw ex;
              return { error: ex };
          }
      }, {});

      if (result.error) {
          const continuation = Continuation.fromUnwindException(result.error);
          return continuation.reason === 'await' ? continuation.resume() : continuation;
      }
      else
          return result.val;
  }

  async settleAwait() {
      const frame = this.currentFrame;
      try {
          const value = await this.error.promise;
          frame.alreadyComputed[frame.getPC().astIndex] = value;
          this.reason = 'debugger';
          this.error = undefined;
      } catch (error) {
          const exception = error instanceof Error ? error : new Error(String(error));
          this.reason = 'exception';
          this.error = this.exception = frame.exception = frame.awaitRejection = exception;
      }
      return this;
  }

  async settleBindings() {
      await prepareCapturedFunction(this.error.func, this.error.names);
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
