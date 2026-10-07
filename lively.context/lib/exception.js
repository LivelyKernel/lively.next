/*global global, module*/
import { arr } from "lively.lang";
import { Scope, Frame, Function as AcornFunction, serializeManagedFunction } from "./interpreter.js";
import { getCurrentASTRegistry } from "lively.context";
import { acorn, query, escodegen, parseFunction, ReplaceVisitor, withMozillaAstDo } from "lively.ast";
import { addRecorderBindings } from './stackReification.js';

let Global = typeof window !== "undefined" ? window : globalThis;
const debuggerState = Global[Symbol.for('lively-debugger-state')] ||= {};
export const originalFunctions = debuggerState.originalFunctions ||= new WeakMap();
export const capturedBindingMappings = debuggerState.capturedBindingMappings ||= new WeakSet();
export function freeFunctionReferences(ast) {
  return query.findGlobalVarRefs('(' + escodegen.generate(ast) + ')');
}
const lexicalBindings = debuggerState.lexicalBindings ||= new WeakMap();
const capturedScopes = debuggerState.capturedScopes ||= new WeakMap();

export function withDebugModule(module, invoke) {
  const previous = debuggerState.executingDebugModule;
  debuggerState.executingDebugModule = module;
  try { return invoke(); } finally { debuggerState.executingDebugModule = previous; }
}

export function runtimeFunctionSource(func) {
  if (func[Symbol.for('lively-debug-function-source')]) return func[Symbol.for('lively-debug-function-source')];
  const meta = func[Symbol.for('lively-object-meta')];
  return func[Symbol.for('lively-debug-bindings')] && meta
    ? meta.moduleSource.slice(meta.start, meta.end) : func.toString();
}

export function removeRuntimeClosureAnnotations(ast) {
  const cells = new Set();
  const isCapture = node => node?.type === 'CallExpression' && node.callee.type === 'MemberExpression' &&
    ['recordDebugClosure', 'recordDebugMethod'].includes(node.callee.property.name) &&
    (node.callee.object.type === 'CallExpression' && node.callee.object.callee.property?.name === 'moduleEnv' ||
      node.callee.object.type === 'MemberExpression' && node.callee.object.property.name === '__currentLivelyModule') &&
    node.arguments[1]?.type === 'ObjectExpression' &&
    node.arguments[4]?.type === 'Identifier';
  withMozillaAstDo(ast, null, (next, node) => {
    if (isCapture(node)) for (const property of node.arguments[1].properties)
      if (property.value?.type === 'Identifier') cells.add(property.value.name);
    next();
  });
  return ReplaceVisitor.run(ast, node => {
    if (!node) return node;
    if (isCapture(node)) return {...node.arguments[0], compilerClosureAnnotation: true};
    if (node.type === 'VariableDeclaration') {
      node.declarations = node.declarations.filter(declaration => !cells.has(declaration.id.name));
      if (!node.declarations.length) return {type: 'EmptyStatement', compilerClosureAnnotation: true};
    }
    if (node.type === 'ExpressionStatement' && node.expression.type === 'Identifier' && node.expression.compilerClosureAnnotation)
      return {type: 'EmptyStatement', compilerClosureAnnotation: true};
    if (node.type === 'BlockStatement' || node.type === 'Program') node.body = node.body.filter(statement =>
      statement.type !== 'EmptyStatement' || !statement.compilerClosureAnnotation);
    return node;
  });
}

Global.__serializeDebugClosure = (func, pool, snapshots, path) => {
  const ast = parseFunction(runtimeFunctionSource(func), {locations: true, addSource: true, addAstIndex: true});
  const bindings = func[Symbol.for('lively-debug-bindings')];
  addRecorderBindings(bindings, ast);
  const interpreted = new AcornFunction(ast, new Scope(bindings, new Scope(Global)), func);
  return serializeManagedFunction(func, interpreted, pool, snapshots, path);
};

export function bindingCells(mapping) {
  return lexicalBindings.get(mapping) || mapping[Symbol.for('lively-debug-binding-cells')];
}

export function restoreBindingCells(mapping, cells) {
  for (const [name, cell] of Object.entries(cells)) Object.defineProperty(mapping, name, {
    enumerable: true,
    get() {
      if (!cell.initialized) throw new ReferenceError("Cannot access '" + name + "' before initialization");
      return cell.value;
    },
    set(value) {
      if (!cell.initialized) throw new ReferenceError("Cannot access '" + name + "' before initialization");
      if (cell.kind === 'const') throw new TypeError('Assignment to constant variable.');
      cell.value = value;
    }
  });
  lexicalBindings.set(mapping, cells);
  return mapping;
}

// Keep the same mapping object in native rewritten closures and interpreted frames.
export function __createLexicalScope(parent, computed, astIndex, declarations, mapping = {}) {
  __declareLexicalBindings(mapping, declarations);
  return [computed, mapping, parent, astIndex];
}

export function __declareLexicalBindings(mapping, declarations) {
  const cells = lexicalBindings.get(mapping) || Object.create(null);
  for (const [name, kind] of declarations) {
    if (cells[name]) {
      if (cells[name].kind !== kind) throw new TypeError("Binding kind changed for '" + name + "'; restart the frame");
      continue;
    }
    const cell = cells[name] = { kind, initialized: false, value: undefined };
    Object.defineProperty(mapping, name, {
      enumerable: true,
      get() {
        if (!cell.initialized) throw new ReferenceError("Cannot access '" + name + "' before initialization");
        return cell.value;
      },
      set(value) {
        if (!cell.initialized) throw new ReferenceError("Cannot access '" + name + "' before initialization");
        if (cell.kind === 'const') throw new TypeError('Assignment to constant variable.');
        cell.value = value;
      }
    });
  }
  lexicalBindings.set(mapping, cells);
  return mapping;
}

export function __initializeBinding(mapping, name, value) {
  const cells = lexicalBindings.get(mapping), cell = cells && cells[name];
  if (!cell) return mapping[name] = value;
  if (cell.initialized) throw new ReferenceError("Binding '" + name + "' is already initialized");
  cell.value = value;
  cell.initialized = true;
  return value;
}

export function __initializationTarget(mapping) {
  return new Proxy(mapping, {set(target, name, value) { __initializeBinding(target, name, value); return true; }});
}

export function __cloneLexicalScope(scope) {
  const cells = lexicalBindings.get(scope[1]);
  const copy = __createLexicalScope(scope[2], scope[0], scope[3], Object.entries(cells).map(([name, cell]) => [name, cell.kind]));
  for (const [name, cell] of Object.entries(cells)) {
    if (cell.initialized) __initializeBinding(copy[1], name, cell.value);
  }
  return copy;
}

export function __captureLexicalScope(error, root, scope) {
  const original = error;
  error = error && (error.isUnwindException ? error.error : error.unwindException ? error.unwindException.error : error);
  if (error && (typeof error === 'object' || typeof error === 'function')) {
    let scopes = capturedScopes.get(error);
    if (!scopes) capturedScopes.set(error, scopes = new Map());
    if (!scopes.has(root)) scopes.set(root, scope);
  }
  return original;
}

export function __scopeForUnwind(error, root) {
  const scopes = error && capturedScopes.get(error);
  const scope = scopes && scopes.get(root);
  if (scope) scopes.delete(root);
  return scope || root;
}

export function __awaitValue(value, astIndex, pending = {}) {
  throw new UnwindException({reason: 'await', promise: Promise.resolve(value), astIndex, pending,
    toString() { return 'Await'; }});
}

export class RecordedIterator {
  constructor(iterable, async = false) {
    this.source = iterable;
    this.index = 0;
    this.done = false;
    this.suspended = false;
    this.async = async;
    this.phase = 'next';
    this.fromSync = async && !iterable?.[Symbol.asyncIterator];
    this.indexed = Array.isArray(iterable) && iterable[Symbol.iterator] === Array.prototype[Symbol.iterator] || typeof iterable === 'string';
    if (iterable !== undefined && (!this.indexed || async && !this.fromSync)) this.iterator = iterable[async && !this.fromSync ? Symbol.asyncIterator : Symbol.iterator]();
  }

  get __dont_serialize__() { return ['iterator']; }

  __additionally_serialize__(snapshot, ref, pool, addFn) {
    if (this.iterator?.isManagedGenerator) addFn('iterator', this.iterator);
    else if (!this.indexed && !this.done) throw new Error('Cannot save a suspended native iterator. Use an array/string or finish the loop before saving.');
  }

  next() {
    let step;
    if (this.done) step = {done: true};
    else if (this.indexed) {
      if (this.index >= this.source.length) step = {done: true};
      else if (typeof this.source === 'string') {
        const value = String.fromCodePoint(this.source.codePointAt(this.index));
        this.index += value.length;
        step = {value, done: false};
      } else step = {value: this.source[this.index++], done: false};
    } else step = this.iterator.next();
    if (step === null || typeof step !== 'object') throw new TypeError('Iterator result is not an object');
    this.done = !!step.done;
    this.value = this.done ? undefined : step.value;
    this.phase = this.done ? 'done' : 'body';
    return {value: this.value, done: this.done};
  }

  acceptStep(step) {
    if (step === null || typeof step !== 'object') throw new TypeError('Iterator result is not an object');
    this.done = !!step.done;
    this.value = step.value;
    this.phase = this.done ? 'done' : 'body';
  }

  return() {
    if (this.suspended) { this.suspended = false; return {}; }
    this.done = true;
    return this.iterator?.return ? this.iterator.return() : {};
  }

  [Symbol.iterator]() { return this; }
}

export function __forOf(iterable, computed, astIndex, async = false) {
  const state = new RecordedIterator(iterable, async);
  computed['__forOf_' + astIndex] = state;
  return state;
}

export function __closeIteratorsAfterCatch(error) {
  if (!error?.isUnwindException || ['await', 'bindings', 'yield'].includes(error.error?.reason) || ['Debugger', 'Break'].includes(error.error?.toString())) return;
  for (const iterator of error.iteratorsToClose || []) {
    iterator.suspended = false;
    iterator.return();
  }
  delete error.iteratorsToClose;
}

Object.assign(Global, { __createLexicalScope, __initializeBinding, __initializationTarget, __cloneLexicalScope, __captureLexicalScope, __scopeForUnwind, __awaitValue, __forOf, __closeIteratorsAfterCatch });

export function __createClosure(namespace, idx, parentFrameState, f, lexical) {
  // FIXME: Either save idx and use __getClosure later or attach the AST here and now (code dup.)?
  var registry = getCurrentASTRegistry();
  f._cachedAst = registry && registry[namespace] && registry[namespace][idx];
  // parentFrameState = [computedValues, varMapping, parentParentFrameState]
  f._cachedScopeObject = parentFrameState;
  if (f._cachedAst?.iteratorFrame) {
    const interpreted = new AcornFunction(f._cachedAst, new Scope(Global), originalFunctions.get(f._cachedAst));
    interpreted.capturedFrameState = parentFrameState;
    return interpreted.asFunction();
  }
  f.livelyDebuggingEnabled = true;
  Object.defineProperty(f, '__serialize__', {configurable: true, value(pool, snapshots, path) {
    return serializeManagedFunction(f, new AcornFunction(f._cachedAst, Scope.recreateFromFrameState(f._cachedScopeObject), f), pool, snapshots, path);
  }});
  if (lexical) {
    f._lexicalThis = lexical.this;
    f._lexicalArguments = lexical.arguments;
    if (!originalFunctions.has(f._cachedAst)) originalFunctions.set(f._cachedAst, f);
  }
  let state = parentFrameState, module;
  while (Array.isArray(state)) {
    module = state[1]?.[Symbol.for('lively-debug-module')];
    if (module) break;
    state = state[2];
  }
  module = module || debuggerState.executingDebugModule;
  if (module) {
    const original = originalFunctions.get(registry[namespace][f._cachedAst._parentEntry]);
    const meta = original?.[Symbol.for('lively-object-meta')];
    if (meta) Object.defineProperties(f, {
      [Symbol.for('lively-object-meta')]: {value: {...meta, start: meta.start + f._cachedAst.start, end: meta.start + f._cachedAst.end}, configurable: true},
      [Symbol.for('lively-module-meta')]: {value: original[Symbol.for('lively-module-meta')], configurable: true}
    });
    return module.System.get('@lively-env').moduleDebugger.wrapFunction(f, module);
  }
  return f;
}

Global.__createClosure = __createClosure;

// FIXME naming -- actually we return the ast node not a closure
export function __getClosure(namespace, idx) {
  var subRegistry = getCurrentASTRegistry()[namespace];
  return (subRegistry != null ? subRegistry[idx] : null); // ast
}

export class UnwindException {

    constructor(error) {
      this.error = error;
      if (error && (typeof error === 'object' || typeof error === 'function')) error.unwindException = this;
      this.frameInfo = [];
    }

    get isUnwindException() { return true }

    toString() {
      return '[UNWIND] ' + this.error.toString();
    }

    storeFrameInfo(/*...*/) {
        if (arguments[6]) arguments.newTarget = arguments[6];
        this.frameInfo.push(arguments);
    }

    recreateFrames() {
        this.frameInfo.forEach(function(frameInfo) {
            const frame = this.createAndShiftFrame.apply(this, arr.from(frameInfo));
            if (frameInfo.newTarget) frame.newTarget = frameInfo.newTarget;
        }, this);
        this.frameInfo = [];
        return this;
    }

    createAndShiftFrame(thiz, args, frameState, lastNodeAstIndex, namespaceForOrigAst, pointerToOriginalAst) {
        var topScope = Scope.recreateFromFrameState(frameState),
            alreadyComputed = frameState[0],
            ast = __getClosure(namespaceForOrigAst, pointerToOriginalAst),
            functionScope = topScope,
            func,
            frame,
            pc;
        while (functionScope.getParentScope() && functionScope.getParentScope().computationState === frameState[0]) {
            functionScope = functionScope.getParentScope();
        }
        func = new AcornFunction(ast, functionScope.getParentScope(), originalFunctions.get(ast));
        if (ast.type === 'ArrowFunctionExpression') {
            func.lexicalThis = thiz;
            if (functionScope.has('arguments')) func.lexicalArguments = functionScope.get('arguments');
        }
        frame = Frame.create(func /*, varMapping */);
        frame.constructorInvocation = !!originalFunctions.get(ast)?.[Symbol.for('lively-debug-constructor')];
        frame.setThis(thiz);
        if (frame.func.node && frame.func.node.type != 'Program')
            frame.arguments = args;
        frame.setAlreadyComputed(alreadyComputed);
        if (!this.top) {
            pc = this.error && acorn.walk.findNodeByAstIndex(frame.getOriginalAst(),
                this.error.astIndex != null ? this.error.astIndex : lastNodeAstIndex);
        } else {
            if (frame.isAlreadyComputed(lastNodeAstIndex)) lastNodeAstIndex++;
            pc = acorn.walk.findNodeByAstIndex(frame.getOriginalAst(), lastNodeAstIndex);
        }
        frame.setPC(pc);
        frame.setScope(topScope);

        return this.shiftFrame(frame, true);
    }

    shiftFrame(frame, isRecreating) {
        if (!isRecreating)
            this.recreateFrames();
        for (let existing = this.top; existing; existing = existing.getParentFrame()) {
            if (existing === frame) return frame;
        }
        if (!frame.isResuming()) console.log('Frame without PC found!', frame);
        if (!this.top) {
            this.top = this.last = frame;
            if (this.error && this.error.reason === 'await') frame.pendingAwait = {astIndex: frame.getPC().astIndex, ...this.error.pending};
        } else {
            this.last.setParentFrame(frame);
            this.last = frame;
        }
        return frame;
    }

    unshiftFrame() {
        this.recreateFrames();
        if (!this.top) return;

        var frame = this.top,
            prevFrame;
        while (frame.getParentFrame()) {
            prevFrame = frame;
            frame = frame.getParentFrame();
        }
        if (prevFrame) { // more then one frame
            prevFrame.setParentFrame(undefined);
            this.last = prevFrame;
        } else {
            this.top = this.last = undefined;
        }
        return frame;
    }

}

// fixme: User proper reqriting that does not depend on global var
Global.UnwindException = UnwindException;
