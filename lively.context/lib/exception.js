/*global global, module*/
import { arr } from "lively.lang";
import { Scope, Frame, Function as AcornFunction } from "./interpreter.js";
import { getCurrentASTRegistry } from "lively.context";
import { acorn, query, escodegen } from "lively.ast";

let Global = typeof window !== "undefined" ? window : globalThis;
export const originalFunctions = new WeakMap();
export const capturedBindingMappings = new WeakSet();
export function freeFunctionReferences(ast) {
  return query.findGlobalVarRefs('(' + escodegen.generate(ast) + ')');
}
const lexicalBindings = new WeakMap();
const capturedScopes = new WeakMap();

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

export function __awaitValue(value, astIndex) {
  throw new UnwindException({reason: 'await', promise: Promise.resolve(value), astIndex,
    toString() { return 'Await'; }});
}

Object.assign(Global, { __createLexicalScope, __initializeBinding, __cloneLexicalScope, __captureLexicalScope, __scopeForUnwind, __awaitValue });

export function __createClosure(namespace, idx, parentFrameState, f, lexical) {
  // FIXME: Either save idx and use __getClosure later or attach the AST here and now (code dup.)?
  var registry = getCurrentASTRegistry();
  f._cachedAst = registry && registry[namespace] && registry[namespace][idx];
  // parentFrameState = [computedValues, varMapping, parentParentFrameState]
  f._cachedScopeObject = parentFrameState;
  f.livelyDebuggingEnabled = true;
  if (lexical) {
    f._lexicalThis = lexical.this;
    f._lexicalArguments = lexical.arguments;
    if (!originalFunctions.has(f._cachedAst)) originalFunctions.set(f._cachedAst, f);
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
        this.frameInfo.push(arguments);
    }

    recreateFrames() {
        this.frameInfo.forEach(function(frameInfo) {
            this.createAndShiftFrame.apply(this, arr.from(frameInfo));
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
        frame.setThis(thiz);
        if (frame.func.node && frame.func.node.type != 'Program')
            frame.setArguments(args);
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
