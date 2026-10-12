import { obj, arr } from "lively.lang";
import { acorn, escodegen, parseFunction, query } from "lively.ast";
import { UnwindException, __getClosure, __createLexicalScope, __declareLexicalBindings, __initializeBinding, __cloneLexicalScope, __awaitValue, __forOf, __closeIteratorsAfterCatch, bindingCells, restoreBindingCells, capturedBindingMappings, freeFunctionReferences, runtimeFunctionSource, removeRuntimeClosureAnnotations, originalFunctions } from "./exception.js";
import { getGlobal } from "lively.vm/lib/util.js";
import { Continuation, debugSupportEnabled } from './stackReification.js';

let Global = getGlobal();

export function RestoredFunction() {
  const fn = function() { return fn.interpretedFunction.asFunction().apply(this, arguments); };
  fn.__after_deserialize__ = function() {
    if (!fn.interpretedFunction.node) { fn.interpretedFunction._restoredFunction = fn; return; }
    Object.assign(fn, fn.interpretedFunction.asFunction());
    Object.defineProperty(fn, 'name', {value: fn.interpretedFunction.name(), configurable: true});
  };
  return fn;
}

export function serializeManagedFunction(fn, interpreted, pool, snapshots, path) {
  const ref = pool.add(fn);
  if (snapshots[ref.id]) return ref.asRefForSerializedObjMap(ref.currentRev);
  const snapshot = snapshots[ref.id] = {rev: ref.currentRev, props: {}};
  pool.classHelper.addClassInfo(ref, {constructor: RestoredFunction}, snapshot);
  snapshot.props.interpretedFunction = {value: ref.snapshotProperty(ref.id, interpreted, path.concat('interpretedFunction'), snapshots, pool)};
  return ref.asRefForSerializedObjMap(ref.currentRev);
}

export class Interpreter {

  constructor({captureErrors = false} = {}) {
    this.captureErrors = captureErrors;
    this.breakAtStatement = false; // for e.g. step over
    this.breakAtCall    = false; // for e.g. step into
  }

  get statements() { 
     return ['EmptyStatement', 'ExpressionStatement', 'IfStatement', 'LabeledStatement', 'BreakStatement', 'ContinueStatement', 'WithStatement', 'SwitchStatement', 'ReturnStatement', 'ThrowStatement', 'WhileStatement', 'DoWhileStatement', 'ForStatement', 'ForInStatement', 'ForOfStatement', 'DebuggerStatement', 'VariableDeclaration', 'FunctionDeclaration', 'SwitchCase'] // without BlockStatement and TryStatement
  }

  run(node, optMapping) {
    var program = new Function(node),
        frame = Frame.create(program, optMapping);
    program.lexicalScope = frame.getScope(); // FIXME
    return this.runWithFrameAndResult(node, frame, undefined);
  }

  runWithContext(node, ctx, optMapping) {
    var program = new Function(node),
        frame = Frame.create(program);
    if (optMapping != null) {
      var parentScope = new Scope(optMapping);
      frame.getScope().setParentScope(parentScope);
    }
    program.lexicalScope = frame.getScope(); // FIXME
    frame.setThis(ctx);
    return this.runWithFrameAndResult(node, frame, undefined);
  }

  runWithFrame(node, frame, lastResult) {
    var isFunction = node.type == 'FunctionDeclaration' || node.type =='FunctionExpression' || node.type === 'ArrowFunctionExpression',
        result = this.runWithFrameAndResult(isFunction ? node.body : node, frame, lastResult);
    if (frame.returnTriggered || !isFunction || node.type === 'ArrowFunctionExpression' && node.body.type !== 'BlockStatement')
      return frame.completeReturnValue(result);
    return frame.completeReturnValue(undefined);
  }

  runFromPC(frame, lastResult) {
    return this.runWithFrame(frame.getOriginalAst(), frame, lastResult);
  }

  runWithFrameAndResult(node, frame, result) {
    var state = {
      currentFrame: frame,
      labels: {},
      result: result
    };
    if (!frame.isResuming()) this.evaluateDeclarations(node, frame);

    try {
      this.accept(node, state);
    } catch (e) {
      if (lively.Config && lively.Config.loadRewrittenCode && e.unwindException)
        e = e.unwindException;
      if (e.isUnwindException && !frame.isResuming()) {
        frame.setPC(acorn.walk.findNodeByAstIndex(frame.getOriginalAst(), e.error.astIndex));
        e.shiftFrame(frame);
      }
      throw e;
    }
    // finished execution, remove break
    this.breakAtStatement = false;
    return state.result;
  }

  setVariable(name, state) {
    var scope = state.currentFrame.getScope();
    if (name != 'arguments')
      scope = scope.findScope(name, true).scope; // may throw ReferenceError
    scope.set(name, state.result);
  }

  setSlot(node, state) {
    if (node.type != 'MemberExpression')
      throw new Error('setSlot can only be called with a MemberExpression node');
    var value = state.result;
    this.accept(node.object, state);
    var obj = state.result, prop;
    if (node.property.type == 'Identifier' && !node.computed) {
      prop = node.property.name;
    } else {
      this.accept(node.property, state);
      prop = state.result;
    }

    var setter = obj.__lookupSetter__(prop);
    if (setter) {
      this.invoke(obj, setter, [value], state.currentFrame, false/*isNew*/);
    } else if (obj === state.currentFrame.arguments) {
      obj[prop] = value;
      state.currentFrame.setArguments(obj);
    } else {
      obj[prop] = value;
    }
    state.result = value;
  }
  
  evaluateDeclarations(node, frame) {
    // lookup all the declarations but stop at new function scopes
    var self = this;
    acorn.walk.matchNodes(node, {
      VariableDeclaration: (node, state, depth, type)  =>{
        if (type != 'VariableDeclaration') return;
        if (node.kind !== 'var') return;
        query.helpers.declIds(node.declarations.map(decl => decl.id)).forEach(function(id) {
          frame.getScope().addToMapping(id.name);
        });
      },
      FunctionDeclaration: (node, state, depth, type) => {
        if (type != 'FunctionDeclaration') return;
        self.visitFunctionDeclaration(node, { currentFrame: frame });
      }
    }, null, { visitors: acorn.walk.visitors.stopAtFunctions });
  }

  invoke(recv, func, argValues, frame, isNew) {
    if (typeof func !== 'function') throw new TypeError(String(func) + ' is not a function');
    const generatorMethod = func === ManagedGenerator.prototype.next ? 'next' : func === ManagedGenerator.prototype.throw ? 'throw' : func === ManagedGenerator.prototype.return ? 'return' : null;
    if (recv instanceof ManagedGenerator && generatorMethod) {
      if (this.breakAtCall) { this.breakAtCall = false; this.breakAtStatement = true; }
      return recv.advance(generatorMethod, argValues[0], frame, this);
    }
    // if we send apply to a function (recv) we want to interpret it
    // although apply is a native function
    if (recv && obj.isFunction(recv) && (func === globalThis.Function.prototype.apply || func === globalThis.Function.prototype.call)) {
      argValues = argValues.slice();
      const isCall = func === globalThis.Function.prototype.call;
      func = recv; // The function object is what we want to run
      recv = argValues.shift(); // thisObj is first parameter
      argValues = isCall ? argValues : argValues[0] || [];
    }
    var origFunc = func;

    if (this.shouldHaltAtNextCall() || !this.isNative(func) && func.livelyDebuggingEnabled || this.functionHasDebugger(func))
      func = this.fetchInterpretedFunction(func) || func;

    if (this.shouldInterpret(frame, func)) {
      func.setParentFrame(frame);
      if (this.shouldHaltAtNextCall()) {
        this.breakAtCall = false;
        this.breakAtStatement = false;
        func = func.startHalted(this, isNew ? origFunc : undefined);
      } else {
        func = func.forInterpretation(new Interpreter({captureErrors: this.captureErrors}), isNew ? origFunc : undefined);
      }
    }
    if (isNew) {
      if (this.isNative(func)) return Reflect.construct(func, argValues);
      recv = this.newObject(origFunc);
    }

    var result = func.apply(recv, argValues);
    if (isNew && !obj.isObject(result) && typeof result !== 'function')
      return recv;
    return result;
  }

  isNative(func) {
    if (!this._nativeFuncRegex) this._nativeFuncRegex = /\{\s+\[native\scode\]\s+\}$/;
    return this._nativeFuncRegex.test(func.toString());
  }

  shouldInterpret(frame, func) {
    return !this.isNative(func) && !!func.isInterpretableFunction;
  }

  functionHasDebugger(func) {
    if (typeof func !== 'function' || !/\bdebugger\s*;/.test(func.toString())) return false;
    const ast = removeRuntimeClosureAnnotations(parseFunction(runtimeFunctionSource(func)));
    let found = false;
    acorn.walk.matchNodes(ast.body, {DebuggerStatement() { found = true; }}, null,
      {visitors: acorn.walk.visitors.stopAtFunctions});
    return found;
  }

  newObject(func) {
    var proto = func.prototype;
    function constructor() {}
    constructor.prototype = proto;
    var newObj = new constructor();
    newObj.constructor = func;
    return newObj;
  }

  haltAtNextStatement() {
    this.breakAtStatement = true;
  }

  shouldHaltAtNextStatement(node) {
    return this.breakAtStatement;
  }

  stepToNextStatement(frame) {
    this.haltAtNextStatement();
    try { // should throw Break
      return frame.isResuming() ?
        this.runFromPC(frame) :
        this.runWithFrame(frame.getOriginalAst(), frame);
    } catch (e) {
      // TODO: create continuation
      if (!e.isUnwindException && !e.unwindException) throw e;
      if (e.isUnwindException && e.error.toString() == 'Break')
        e = e.error;
      return e;
    }
  }

  haltAtNextCall() {
    this.breakAtCall = true;
  }

  shouldHaltAtNextCall(node) {
    return this.breakAtCall;
  }

  stepToNextCallOrStatement(frame) {
    this.haltAtNextCall();
    return this.stepToNextStatement(frame);
  }

  resumeToAndBreak(node, frame) {
    frame.setPC(node);
    this.breakOnResume = true;
    return this.runFromPC(frame);
  }

  findNodeLabel(node, state) {
    return Object.getOwnPropertyNames(state.labels).reduce(function(res, label) {
      if (state.labels[label] === node) res = label;
      return res;
    }, undefined);
  }

  wantsInterpretation(node, frame) {
    if (node.type == 'FunctionDeclaration')
      return false; // is done in evaluateDeclarations()

    if (!frame.isResuming()) return true;

    // Have we reached the statement the pc is in already? If yes then we
    // need to resume interpretation
    if (frame.resumeHasReachedPCStatement()) return true;

    // An enclosing branch may need its recorded condition to reach the pc.
    if (frame.isAlreadyComputed(node)) return true;

    // is the pc is in sub-ast of node? return false if not
    if (node.astIndex < frame.pcStatement.astIndex) return false;

    return true;
  }

  fetchInterpretedFunction(func) {
    if (typeof func !== 'function' || this.isNative(func)) return null;
    if (func.isInterpretableFunction !== undefined) return func;
    if (!func.livelyDebuggingEnabled) {
      const ast = removeRuntimeClosureAnnotations(parseFunction(runtimeFunctionSource(func), {locations: true, addSource: true, addAstIndex: true}));
      const names = [...new Set(freeFunctionReferences(ast).map(ref => ref.name))].filter(name => !(name in Global));
      if (names.length) throw new UnwindException({reason: 'bindings', func, names, toString() { return 'Function bindings'; }});
      return new Function(ast, new Scope(Global), func).asFunction();
    }
    var topScope = Scope.recreateFromFrameState(func._cachedScopeObject);
    func = new Function(func._cachedAst, topScope, func);
    return func.asFunction();
  }

  accept(node, state) {
    function throwableBreak() {
      return new UnwindException({
        toString: function() { return 'Break'; },
        astIndex: node.astIndex,
        lastResult: state.result
      });
    }

    var frame = state.currentFrame;

    if (!this.wantsInterpretation(node, frame)) return;

    if (frame.isResuming()) {
      const pc = frame.getPC();
      const enclosesPC = node !== pc && node.start <= pc.start && node.end >= pc.end;
      if (frame.isPCStatement(node)) frame.resumeReachedPCStatement();
      if (frame.resumesAt(node)) {
        if (node.type === 'ForOfStatement') state.resumingIterator = node.astIndex;
        frame.resumesNow();
        if (this.breakOnResume) {
          this.breakOnResume = false;
          throw throwableBreak();
        }
      }
      if (!enclosesPC && frame.isAlreadyComputed(node.astIndex)) {
        state.result = frame.alreadyComputed[node.astIndex];
        return;
      }
    } else if (this.shouldHaltAtNextStatement(node) && (arr.include(this.statements, node.type) ||
        frame.func.node.type === 'ArrowFunctionExpression' && frame.func.node.body === node && node.type !== 'BlockStatement')) {
      if (node.type == 'DebuggerStatement')
        frame.alreadyComputed[node.astIndex] = undefined;
      this.breakAtStatement = false;
      this.breakAtCall = false;
      throw throwableBreak();
    }

    try {
      // A new iteration may suspend before overwriting its previous result.
      if (node.astIndex != null && node.type.endsWith('Expression')) delete frame.alreadyComputed[node.astIndex];
      this['visit' + node.type](node, state);
      if (node.astIndex != null && node.type.endsWith('Expression') && (typeof state.result !== 'function' || state.result.isInterpretableFunction)) frame.alreadyComputed[node.astIndex] = state.result;
    } catch (e) {
      if (e.isGeneratorReturn || e.isGeneratorThrow) throw e;
      if ((this.captureErrors || lively.Config && lively.Config.loadRewrittenCode) && !(e instanceof UnwindException)) {
        if (e.unwindException)
          e = e.unwindException;
        else {
          e = new UnwindException(e);
          frame.setPC(node);
          e.shiftFrame(frame);
        }
      }
      if (!frame.isResuming() && e.error && e.error.toString() != 'Break') {
        frame.setPC(node);
        e.shiftFrame(frame);
      }
      throw e;
    }
  }

  visitProgram(node, state) {
    var frame = state.currentFrame;
    for (var i = 0; i < node.body.length; i++) {
      this.accept(node.body[i], state);
      if (frame.returnTriggered) // frame.breakTriggered || frame.continueTriggered
        return;
    }
  }

  visitEmptyStatement(node, state) {
    // do nothing, not even change the result
  }

  visitBlockStatement(node, state) {
    var frame = state.currentFrame;
    const declarations = node.body.filter(n => n.type === 'VariableDeclaration' && n.kind !== 'var')
        .flatMap(n => query.helpers.declIds(n.declarations.map(d => d.id)).map(id => [id.name, n.kind]));
    const previousScope = frame.getScope();
    let blockScope = previousScope;
    if (declarations.length) {
      if (frame.isResuming()) {
        let scope = previousScope;
        while (scope && scope.lexicalNodeIndex !== node.astIndex) scope = scope.getParentScope();
        if (scope) blockScope = scope;
        // Function-body lexical declarations share the recorded function scope.
        else if (node === frame.getOriginalAst().body) blockScope = frame.getFunctionScope();
        else throw new Error('Missing recorded block scope at ' + node.astIndex);
      } else {
        const mapping = __createLexicalScope(null, frame.alreadyComputed, node.astIndex, declarations)[1];
        blockScope = new Scope(mapping, previousScope);
        blockScope.lexicalNodeIndex = node.astIndex;
        frame.setScope(blockScope);
      }
      __declareLexicalBindings(blockScope.getMapping(), declarations);
    }
    for (var i = 0; i < node.body.length; i++) {
      this.accept(node.body[i], state);
      if (frame.returnTriggered || frame.breakTriggered || frame.continueTriggered)
        break;
    }
    if (declarations.length && blockScope.lexicalNodeIndex === node.astIndex) frame.setScope(blockScope.getParentScope());
  }

  visitExpressionStatement(node, state) {
    this.accept(node.expression, state);
  }

  visitIfStatement(node, state) {
    var oldResult = state.result,
        frame = state.currentFrame;
    this.accept(node.test, state);
    var condVal = state.result;
    if (node.test.astIndex != null) frame.alreadyComputed[node.test.astIndex] = condVal;
    state.result = oldResult;

    if (condVal) {
      this.accept(node.consequent, state);
    } else if (node.alternate) {
      this.accept(node.alternate, state);
    }
  }

  visitLabeledStatement(node, state) {
    var frame = state.currentFrame,
        label = node.label.name;
    state.labels[label] = node.body;
    this.accept(node.body, state);
    delete state.labels[label];
    if (frame.breakTriggered)
      frame.stopBreak(label);
    if (frame.continueTriggered)
      frame.stopContinue(label);
  }

  visitBreakStatement(node, state) {
    state.currentFrame.triggerBreak(node.label ? node.label.name : undefined);
  }

  visitContinueStatement(node, state) {
    state.currentFrame.triggerContinue(node.label ? node.label.name : undefined);
  }

  visitWithStatement(node, state) {
    var frame = state.currentFrame,
        oldResult = state.result;
    this.accept(node.object, state);
    var lexicalObj = state.result;
    state.result = oldResult;
    var withScope = frame.newScope(lexicalObj);
    state.currentFrame.setScope(withScope);
    this.accept(node.body, state);
    state.currentFrame.setScope(withScope.getParentScope());
  }

  visitSwitchStatement(node, state) {
    var result = state.result,
        frame = state.currentFrame;
    this.accept(node.discriminant, state);
    var leftVal = state.result,
        rightVal, caseMatched = false, defaultCaseId;
    for (var i = 0; i < node.cases.length; i++) {
      if (node.cases[i].test === null) {
        // default
        defaultCaseId = i;
        if (!caseMatched)
          continue;
      } else {
        this.accept(node.cases[i].test, state);
        rightVal = state.result;
        state.result = result;
      }
      if (frame.isResuming() && this.wantsInterpretation(node.cases[i], frame)) {
        caseMatched = true; // resuming node is inside this case
      }
      if (leftVal === rightVal || caseMatched) {
        this.accept(node.cases[i], state);
        caseMatched = true;

        if (frame.breakTriggered) {
          frame.stopBreak(); // only non-labled break
          return;
        }
        if (frame.continueTriggered || frame.returnTriggered)
          return;
      }
    }
    if (!caseMatched && (defaultCaseId !== undefined)) {
      caseMatched = true;
      for (i = defaultCaseId; i < node.cases.length; i++) {
        this.accept(node.cases[i], state);
        caseMatched = true;

        if (frame.breakTriggered) {
          frame.stopBreak(); // only non-labled break
          return;
        }
        if (frame.continueTriggered || frame.returnTriggered)
          return;
      }
    }
    return result;
  }

  visitReturnStatement(node, state) {
    if (node.argument)
      this.accept(node.argument, state);
    else
      state.result = undefined;
    state.currentFrame.triggerReturn();
  }

  visitTryStatement(node, state) {
    const frame = state.currentFrame, key = '__finally_' + node.astIndex;
    let completion = frame.alreadyComputed[key];
    const pc = frame.getPC();
    const inHandler = pc && node.handler && node.handler.start <= pc.start && pc.end <= node.handler.end;
    if (!completion) {
      completion = {};
      try {
        try { if (!inHandler) this.accept(node.block, state); }
        catch (error) {
          if (error.isGeneratorReturn || !node.handler) throw error;
          const unwind = error.isUnwindException ? error : error.unwindException;
          if (unwind) {
            if (!(unwind.error instanceof Error)) throw unwind;
            __closeIteratorsAfterCatch(unwind);
            error = unwind.error;
            delete error.unwindException;
            frame.setPC(null);
          }
          state.error = error.isGeneratorThrow ? error.value : error;
          this.accept(node.handler, state);
          delete state.error;
        }
        if (inHandler) this.accept(node.handler, state);
      } catch (error) {
        if (error.isUnwindException || error.unwindException) throw error;
        completion.error = error;
        completion.hasError = true;
      }
      Object.assign(completion, {value: state.result, returning: frame.returnTriggered, breaking: frame.breakTriggered, continuing: frame.continueTriggered});
      if (node.finalizer) frame.alreadyComputed[key] = completion;
    }
    if (node.finalizer) {
      frame.returnTriggered = false;
      frame.breakTriggered = null;
      frame.continueTriggered = null;
      this.accept(node.finalizer, state);
      delete frame.alreadyComputed[key];
      if (frame.returnTriggered || frame.breakTriggered || frame.continueTriggered) return;
    }
    frame.returnTriggered = completion.returning;
    frame.breakTriggered = completion.breaking;
    frame.continueTriggered = completion.continuing;
    if (completion.returning) state.result = completion.value;
    if (completion.hasError) throw completion.error;
  }

  visitCatchClause(node, state) {
    var frame = state.currentFrame;
    if (!frame.isResuming() || state.hasOwnProperty('error')) {
      var catchScope = frame.newScope();
      catchScope.set(node.param.name, state.error);
      frame.setScope(catchScope);
    }
    try { this.accept(node.body, state); }
    catch (error) {
      if (error.isGeneratorReturn || error.isGeneratorThrow) frame.setScope(frame.getScope().getParentScope());
      throw error;
    }
    state.currentFrame.setScope(frame.getScope().getParentScope()); // restore original scope
  }

  visitThrowStatement(node, state) {
    this.accept(node.argument, state);
    throw state.result;
  }

  visitWhileStatement(node, state) {
    var result = state.result,
        frame = state.currentFrame;
    this.accept(node.test, state);
    var testVal = state.result;
    state.result = result;

    if (frame.isResuming()) testVal = true; // resuming node inside loop
    while (testVal) {
      this.accept(node.body, state);
      result = state.result;

      if (frame.breakTriggered) {
        frame.stopBreak(); // only non-labled break
        break;
      }
      if (frame.continueTriggered) {
        frame.stopContinue(this.findNodeLabel(node, state)); // try a labled continue
        if (frame.continueTriggered) // still on: different labeled continue
          break;
      }
      if (frame.returnTriggered)
        return;

      this.accept(node.test, state);
      testVal = state.result;
      state.result = result;
    }
  }

  visitDoWhileStatement(node, state) {
    var frame = state.currentFrame,
        testVal, result;
    do {
      this.accept(node.body, state);
      result = state.result;

      if (frame.breakTriggered) {
        frame.stopBreak(); // only non-labled break
        break;
      }
      if (frame.continueTriggered) {
        frame.stopContinue(this.findNodeLabel(node, state)); // try a labled continue
        if (frame.continueTriggered) // still on: different labeled continue
          break;
      }
      if (frame.returnTriggered)
        return;

      this.accept(node.test, state);
      testVal = state.result;
      state.result = result;
    } while (testVal);
    return result;
  }

  visitForStatement(node, state) {
    var result = state.result,
        frame = state.currentFrame;
    const lexical = node.init && node.init.type === 'VariableDeclaration' && node.init.kind !== 'var';
    let loopScope;
    if (lexical) {
      if (frame.isResuming()) {
        loopScope = frame.getScope();
        while (loopScope && loopScope.lexicalNodeIndex !== node.astIndex) loopScope = loopScope.getParentScope();
        if (!loopScope) throw new Error('Missing recorded loop scope');
      } else {
        const mapping = __createLexicalScope(null, frame.alreadyComputed, node.astIndex,
          query.helpers.declIds(node.init.declarations.map(d => d.id)).map(id => [id.name, node.init.kind]))[1];
        loopScope = new Scope(mapping, frame.getScope());
        loopScope.lexicalNodeIndex = node.astIndex;
        frame.setScope(loopScope);
      }
    }
    node.init && this.accept(node.init, state);

    var testVal = true;
    if (node.test) {
      this.accept(node.test, state);
      testVal = state.result;
    }
    state.result = result;

    if (frame.isResuming()) testVal = true; // resuming node inside loop or update
    while (testVal) {
      this.accept(node.body, state);
      result = state.result;

      if (frame.breakTriggered) {
        frame.stopBreak(); // only non-labled break
        break;
      }
      if (frame.continueTriggered) {
        frame.stopContinue(this.findNodeLabel(node, state)); // try a labled continue
        if (frame.continueTriggered) // still on: different labeled continue
          break;
      }
      if (frame.returnTriggered) break;

      if (lexical) {
        const mapping = __cloneLexicalScope([frame.alreadyComputed, loopScope.getMapping(), null, node.astIndex])[1];
        loopScope = new Scope(mapping, loopScope.getParentScope());
        loopScope.lexicalNodeIndex = node.astIndex;
        frame.setScope(loopScope);
      }

      if (node.update) {
        this.accept(node.update, state);
      }

      if (node.test) {
        this.accept(node.test, state);
        testVal = state.result;
      }
      state.result = result;
    }
    if (lexical) frame.setScope(loopScope.getParentScope());
  }

  visitForInStatement(node, state) {
    var result = state.result,
        frame = state.currentFrame,
        keys, left;

    if (frame.isResuming() && frame.isAlreadyComputed(node.right.astIndex)) {
      // computed value only contains property names
      keys = frame.alreadyComputed[node.right.astIndex];
    } else {
      this.accept(node.right, state);
      keys = Object.keys(state.result); // collect enumerable properties (like for-in)
    }
    const declaration = node.left.type === 'VariableDeclaration' ? node.left : null;
    const lexical = declaration && declaration.kind !== 'var';
    if (declaration) {
      if (!lexical) this.accept(node.left, state);
      left = node.left.declarations[0].id;
    } else
      left = node.left;
    state.result = result;

    for (var i = 0; i < keys.length; i++) {
      state.result = keys[i];
      let loopScope;
      if (lexical) {
        if (frame.isResuming()) {
          loopScope = frame.getScope();
          while (loopScope && loopScope.lexicalNodeIndex !== node.astIndex) loopScope = loopScope.getParentScope();
          if (!loopScope) throw new Error('Missing recorded for-in scope');
          if (loopScope.get(left.name) !== keys[i]) continue;
        } else {
          const mapping = __createLexicalScope(null, frame.alreadyComputed, node.astIndex, [[left.name, declaration.kind]])[1];
          __initializeBinding(mapping, left.name, keys[i]);
          loopScope = new Scope(mapping, frame.getScope());
          loopScope.lexicalNodeIndex = node.astIndex;
        }
        frame.setScope(loopScope);
      } else if (left.type == 'Identifier') {
        if (frame.isResuming() && frame.lookup(left.name) !== state.result)
          continue;
        this.setVariable(left.name, state);
      } else if (left.type == 'MemberExpression') {
        this.setSlot(left, state);
      }

      this.accept(node.body, state);
      if (lexical) frame.setScope(loopScope.getParentScope());

      if (frame.breakTriggered) {
        frame.stopBreak(); // only non-labled break
        break;
      }
      if (frame.continueTriggered) {
        frame.stopContinue(this.findNodeLabel(node, state)); // try a labled continue
        if (frame.continueTriggered) // still on: different labeled continue
          break;
      }
      if (frame.returnTriggered)
        return;
      // TODO: reactivate for debugger
      // frame.removeValue(node.body);
    }
  }

  visitForOfStatement(node, state) {
    const frame = state.currentFrame, key = '__forOf_' + node.astIndex;
    const resuming = frame.isResuming() || state.resumingIterator === node.astIndex;
    delete state.resumingIterator;
    let iterator = frame.alreadyComputed[key];
    if (!resuming || !iterator) {
      this.accept(node.right, state);
      iterator = __forOf(state.result, frame.alreadyComputed, node.astIndex, !!node.await);
    } else if (frame.getPC() && node.body.start <= frame.getPC().start && frame.getPC().end <= node.body.end) iterator.entered = true;
    if (frame.awaitRejection) {
      const error = frame.awaitRejection;
      delete frame.awaitRejection;
      throw iterator.completion?.hasError ? iterator.completion.error : error;
    }
    const declaration = node.left.type === 'VariableDeclaration' ? node.left : null;
    const left = declaration ? declaration.declarations[0].id : node.left;
    const lexical = declaration && declaration.kind !== 'var';
    while (iterator.phase !== 'done') {
      if (iterator.phase === 'next' || iterator.phase === 'close') {
        const operation = iterator.phase === 'next' ? 'next' : 'close';
        const receiver = iterator.iterator || iterator;
        const method = operation === 'next' ? receiver.next : receiver.return;
        let result;
        if (iterator.hasResult) { result = iterator.result; delete iterator.result; delete iterator.hasResult; }
        else if (method) {
          frame.pendingIterator = {key, operation};
          if (operation === 'close') iterator.suspended = false;
          result = receiver === iterator ? method.call(receiver) : this.invoke(receiver, method, [], frame, false);
          delete frame.pendingIterator;
        } else result = {done: true};
        if (node.await) {
          if (iterator.fromSync) result = Promise.resolve(result).then(async step => {
            if (step === null || typeof step !== 'object') throw new TypeError('Iterator result is not an object');
            return {value: await step.value, done: step.done};
          });
          __awaitValue(result, node.astIndex, {iteratorKey: key, operation});
        }
        if (operation === 'next') iterator.acceptStep(result);
        else {
          if (result === null || typeof result !== 'object') throw new TypeError('Iterator result is not an object');
          iterator.done = true;
          iterator.phase = 'done';
        }
      }
      if (iterator.phase === 'done') break;
      if (!iterator.entered) {
        if (lexical) {
          const mapping = __createLexicalScope(null, frame.alreadyComputed, node.astIndex, query.helpers.declIds([left]).map(id => [id.name, declaration.kind]))[1];
          const scope = new Scope(mapping, frame.getScope());
          scope.lexicalNodeIndex = node.astIndex;
          frame.setScope(scope);
          this.bindPattern(left, iterator.value, state, (id, value) => __initializeBinding(mapping, id.name, value));
        } else {
          if (declaration) this.accept(declaration, state);
          state.result = iterator.value;
          this.bindPattern(left, iterator.value, state, (id, value) => { state.result = value; this.setVariable(id.name, state); });
        }
        iterator.entered = true;
      }
      let failure;
      try { this.accept(node.body, state); }
      catch (error) {
        const unwind = error.isUnwindException ? error : error.unwindException;
        if (unwind && (!(unwind.error instanceof Error) || !frame.canCatchAt(node))) {
          (unwind.iteratorsToClose || (unwind.iteratorsToClose = [])).push(iterator);
          throw unwind;
        }
        failure = unwind ? unwind.error : error;
        if (unwind) { delete failure.unwindException; frame.setPC(null); }
      }
      iterator.entered = false;
      if (lexical) {
        let scope = frame.getScope();
        while (scope && scope.lexicalNodeIndex !== node.astIndex) scope = scope.getParentScope();
        frame.setScope(scope.getParentScope());
      }
      if (frame.continueTriggered) frame.stopContinue(this.findNodeLabel(node, state));
      if (failure || frame.breakTriggered || frame.returnTriggered || frame.continueTriggered) {
        iterator.completion = {value: state.result, returning: frame.returnTriggered, breaking: frame.breakTriggered,
          continuing: frame.continueTriggered, error: failure, hasError: !!failure};
        frame.returnTriggered = false;
        frame.breakTriggered = null;
        frame.continueTriggered = null;
        iterator.phase = 'close';
      } else iterator.phase = 'next';
    }
    if (iterator.completion) {
      state.result = iterator.completion.value;
      frame.returnTriggered = iterator.completion.returning;
      frame.breakTriggered = iterator.completion.breaking;
      frame.continueTriggered = iterator.completion.continuing;
      frame.stopBreak();
      if (iterator.completion.hasError) throw iterator.completion.error;
    }
  }

  visitDebuggerStatement(node, state) {
    if (!debugSupportEnabled() && state.currentFrame.getScope().debugModule()?.debuggingEnabled === false) return;
    // FIXME: might not be in debug session => do nothing?
    //    node.astIndex might be missing
    var e = {
      toString: function() {
        return 'Debugger';
      },
      astIndex: node.astIndex
    };
    state.currentFrame.alreadyComputed[node.astIndex] = undefined;
    throw new UnwindException(e);
  }

  visitVariableDeclaration(node, state) {
    var oldResult = state.result;
    if (node.kind == 'var' || node.kind == 'let' || node.kind == 'const') {
      const previousKind = state.declarationKind;
      state.declarationKind = node.kind;
      node.declarations.forEach(function(decl) {
        this.accept(decl, state);
      }, this);
      state.declarationKind = previousKind;
    } else
      throw new Error('No semantics for VariableDeclaration of kind ' + node.kind + '!');
    state.result = oldResult;
  }

  visitVariableDeclarator(node, state) {
    var oldResult = state.result, val;
    if (node.init || state.declarationKind !== 'var') {
      if (node.init) this.accept(node.init, state);
      else state.result = undefined;
      // addToMapping is done in evaluateDeclarations()
      this.bindPattern(node.id, state.result, state, (id, value) => {
        if (state.declarationKind === 'var') { state.result = value; this.setVariable(id.name, state); }
        else {
          let scope = state.currentFrame.getScope();
          while (scope && !scope.has(id.name)) scope = scope.getParentScope();
          if (!scope) throw new ReferenceError(id.name + ' has no lexical scope');
          __initializeBinding(scope.getMapping(), id.name, value);
        }
      });
    }
    state.result = oldResult;
  }

  bindPattern(node, value, state, bind) {
    if (node.type === 'Identifier') return bind(node, value);
    if (node.type === 'MemberExpression') { state.result = value; return this.setSlot(node, state); }
    if (node.type === 'RestElement') return this.bindPattern(node.argument, value, state, bind);
    if (node.type === 'AssignmentPattern') {
      if (value === undefined) { this.accept(node.right, state); value = state.result; }
      return this.bindPattern(node.left, value, state, bind);
    }
    if (node.type === 'ObjectPattern') {
      if (value == null) throw new TypeError('Cannot destructure ' + value);
      const object = Object(value), keys = new Set();
      for (const prop of node.properties) {
        if (prop.type === 'RestElement') {
          const rest = {};
          for (const key of Reflect.ownKeys(object)) if (!keys.has(key) && Object.prototype.propertyIsEnumerable.call(object, key)) {
            Object.defineProperty(rest, key, {value: object[key], enumerable: true, writable: true, configurable: true});
          }
          this.bindPattern(prop.argument, rest, state, bind);
        } else {
          let key = prop.key.name ?? prop.key.value;
          if (prop.computed) { this.accept(prop.key, state); key = state.result; }
          key = Reflect.ownKeys({[key]: undefined})[0];
          keys.add(key);
          this.bindPattern(prop.value, object[key], state, bind);
        }
      }
      return;
    }
    if (node.type === 'ArrayPattern') {
      const iterator = __forOf(value, state.currentFrame.alreadyComputed, node.astIndex);
      let done = false;
      try {
        for (const element of node.elements) {
          if (element?.type === 'RestElement') {
            const rest = [];
            while (!done) { const step = iterator.next(); done = !!step.done; if (!done) rest.push(step.value); }
            this.bindPattern(element.argument, rest, state, bind);
          } else {
            const step = done ? {done: true} : iterator.next();
            done = !!step.done;
            if (element) this.bindPattern(element, done ? undefined : step.value, state, bind);
          }
        }
      } finally { if (!done && iterator.return) iterator.return(); }
      return;
    }
    throw new Error('Cannot bind pattern ' + node.type);
  }

  visitThisExpression(node, state) {
    state.result = state.currentFrame.getThis();
  }

  visitSpreadElement(node, state) {
    this.accept(node.argument, state);
    state.result = [...state.result];
    state.currentFrame.alreadyComputed[node.astIndex] = state.result;
  }

  visitArrayExpression(node, state) {
    const result = [];
    for (const element of node.elements) {
      if (!element) { result.length++; continue; }
      this.accept(element, state);
      if (element.type === 'SpreadElement') result.push(...state.result);
      else result.push(state.result);
    }
    state.result = result;
  }

  visitObjectExpression(node, state) {
    var result = {};
    node.properties.forEach(function(prop) {
      if (prop.type === 'SpreadElement') {
        this.accept(prop.argument, state);
        const source = state.result;
        if (source != null) for (const key of Reflect.ownKeys(Object(source))) {
          if (Object.prototype.propertyIsEnumerable.call(source, key))
            Object.defineProperty(result, key, {value: source[key], writable: true, enumerable: true, configurable: true});
        }
        return;
      }
      var propName;
      if (prop.key.type == 'Identifier' && !prop.computed)
        propName = prop.key.name;
      else {
        this.accept(prop.key, state);
        propName = state.result;
      }
      switch (prop.kind) {
      case 'init':
        this.accept(prop.value, state);
        if (propName === '__proto__' && !prop.computed && !prop.shorthand && !prop.method) {
          if (state.result === null || typeof state.result === 'object') Object.setPrototypeOf(result, state.result);
        } else Object.defineProperty(result, propName, {value: state.result, writable: true, enumerable: true, configurable: true});
        break;
      case 'get':
        this.accept(prop.value, state);
        Object.defineProperty(result, propName, {
          get: state.result,
          enumerable : true,
          configurable : true
        });
        break;
      case 'set':
        this.accept(prop.value, state);
        Object.defineProperty(result, propName, {
          set: state.result,
          enumerable : true,
          configurable : true
        });
        break;
      default: throw new Error('Invalid kind for ObjectExpression!');
      }
    }, this);
    state.result = result;
  }

  visitFunctionDeclaration(node, state) {
    // IS NOT CALLED DIRECTLY FROM THE accept()
    var result = state.result;
    this.visitFunctionExpression(node, state);
    state.currentFrame.getScope().set(node.id.name, state.result);
    state.result = result;
  }

  visitFunctionExpression(node, state) {
    var fn = new Function(node, state.currentFrame.getScope());
    state.result = fn.asFunction();

    // if (node.defaults) {
    //   node.defaults.forEach(function(ea) {
    //     // ea is of type Expression
    //     this.accept(ea, state);
    //   }, this);
    // }
    // if (node.rest) {
    //   // rest is a node of type Identifier
    //   this.accept(node.rest, state);
    // }
  }

  visitArrowFunctionExpression(node, state) {
    const frame = state.currentFrame;
    const fn = new Function(node, frame.getScope());
    fn.lexicalThis = frame.getThis();
    try { fn.lexicalArguments = frame.getArguments(); } catch (error) {}
    state.result = fn.asFunction();
  }

  visitSequenceExpression(node, state) {
    node.expressions.forEach(function(expr) {
      this.accept(expr, state);
    }, this);
  }

  visitTemplateLiteral(node, state) {
    let result = node.quasis[0].value.cooked;
    node.expressions.forEach((expression, index) => {
      this.accept(expression, state);
      result += `${state.result}` + node.quasis[index + 1].value.cooked;
    });
    state.result = result;
  }

  visitUnaryExpression(node, state) {
    if (node.operator == 'delete') {
      node = node.argument;
      if (node.type == 'Identifier') {
        // do not delete
        try {
          state.currentFrame.getScope().findScope(node.name);
          state.result = false;
        } catch (e) { // should be ReferenceError
          state.result = true;
        }
      } else if (node.type == 'MemberExpression') {
        this.accept(node.object, state);
        var obj = state.result, prop;
        if ((node.property.type == 'Identifier') && !node.computed)
          prop = node.property.name;
        else {
          this.accept(node.property, state);
          prop = state.result;
        }
        state.result = delete obj[prop];
      } else
        throw new Error('Delete not yet implemented for ' + node.type + '!');
      return;
    } else if (node.operator == 'typeof') {
      try {
        this.accept(node.argument, state);
        state.result = typeof state.result;
      } catch(e) {
        var ex = e instanceof UnwindException ?
              e.error : e;
        if (ex instanceof ReferenceError && node.argument.type === 'Identifier' &&
            !state.currentFrame.getScope().hasInChain(node.argument.name))
          state.result = 'undefined';
        else
          throw e;
      }
      return;
    }

    this.accept(node.argument, state);
    switch (node.operator) {
      case '-':     state.result = -state.result; break;
      case '+':     state.result = +state.result; break;
      case '!':     state.result = !state.result; break;
      case '~':     state.result = ~state.result; break;
      case 'void':  state.result = void state.result; break; // or undefined?
      default: throw new Error('No semantics for UnaryExpression with ' + node.operator + ' operator!');
    }
  }

  visitBinaryExpression(node, state) {
    this.accept(node.left, state);
    var left = state.result;
    this.accept(node.right, state);
    var right = state.result;

    switch (node.operator) {
      case '==':  state.result = left == right; break;
      case '!=':  state.result = left != right; break;
      case '===': state.result = left === right; break;
      case '!==': state.result = left !== right; break;
      case '<':   state.result = left < right; break;
      case '<=':  state.result = left <= right; break;
      case '>':   state.result = left > right; break;
      case '>=':  state.result = left >= right; break;
      case '<<':  state.result = left << right; break;
      case '>>':  state.result = left >> right; break;
      case '>>>': state.result = left >>> right; break;
      case '+':   state.result = left + right; break;
      case '-':   state.result = left - right; break;
      case '*':   state.result = left * right; break;
      case '/':   state.result = left / right; break;
      case '%':   state.result = left % right; break;
      case '|':   state.result = left | right; break;
      case '^':   state.result = left ^ right; break;
      case '&':   state.result = left & right; break;
      case 'in':  state.result = left in right; break;
      case 'instanceof': state.result = left instanceof right; break;
      // case '..': // E4X-specific
      default: throw new Error('No semantics for BinaryExpression with ' + node.operator + ' operator!');
    }
  }

  visitAssignmentExpression(node, state) {
    if (node.operator == '=') {
      this.accept(node.right, state);
    } else {
      this.accept(node.left, state);
      var oldVal = state.result;
      this.accept(node.right, state);
      switch (node.operator) {
        case '+=':  state.result = oldVal + state.result; break;
        case '-=':  state.result = oldVal - state.result; break;
        case '*=':  state.result = oldVal * state.result; break;
        case '/=':  state.result = oldVal / state.result; break;
        case '%=':  state.result = oldVal % state.result; break;
        case '<<=':   state.result = oldVal << state.result; break;
        case '>>=':   state.result = oldVal >> state.result; break;
        case '>>>=':  state.result = oldVal >>> state.result; break;
        case '|=':  state.result = oldVal | state.result; break;
        case '^=':  state.result = oldVal ^ state.result; break;
        case '&=':  state.result = oldVal & state.result; break;
        default: throw new Error('No semantics for AssignmentExpression with ' + node.operator + ' operator!');
      }
    }
    if (node.left.type == 'Identifier')
      this.setVariable(node.left.name, state);
    else if (node.left.type == 'MemberExpression')
      this.setSlot(node.left, state);
    else
      throw new Error('Invalid left-hand in AssigmentExpression!');
  }

  visitUpdateExpression(node, state) {
    this.accept(node.argument, state);
    var oldVal = state.result,
        newVal;

    switch (node.operator) {
    case '++': newVal = oldVal + 1; break;
    case '--': newVal = oldVal - 1; break;
    default: throw new Error('No semantics for UpdateExpression with ' + node.operator + ' operator!');
    }
    state.result = newVal;
    if (node.argument.type == 'Identifier')
      this.setVariable(node.argument.name, state);
    else if (node.argument.type == 'MemberExpression')
      this.setSlot(node.argument, state);
    else
      throw new Error('Invalid argument in UpdateExpression!');
    if (!node.prefix)
      state.result = oldVal;
  }

  visitLogicalExpression(node, state) {
    this.accept(node.left, state);
    var left = state.result;
    if ((node.operator == '||' && !left)
     || (node.operator == '&&' && left)
     || (node.operator == '??' && (left === null || left === undefined)))
     this.accept(node.right, state);
  }

  visitConditionalExpression(node, state) {
    this.visitIfStatement(node, state);
  }

  visitChainExpression(node, state) {
    const previous = state.optionalChain;
    state.optionalChain = {shortCircuited: false};
    try { this.accept(node.expression, state); }
    finally { state.optionalChain = previous; }
  }

  shortCircuitChain(node, value, state) {
    if (state.optionalChain?.shortCircuited || node.optional && (value === null || value === undefined)) {
      state.optionalChain.shortCircuited = true;
      state.result = undefined;
      return true;
    }
    return false;
  }

  visitNewExpression(node, state) {
    state.isNew = true;
    this.visitCallExpression(node, state);
    delete state.isNew; // FIXME: nested NewExpressions?
  }

  visitCallExpression(node, state) {
    var recv, prop, fn, args = [];
    const frame = state.currentFrame;
    if (frame.pendingCall && frame.pendingCall.node === node) {
      ({recv, fn, args} = frame.pendingCall);
      delete frame.pendingCall;
    } else {
    if (node.callee.type == 'MemberExpression') {
      // send
      this.accept(node.callee.object, state);
      recv = state.result;
      if (this.shortCircuitChain(node.callee, recv, state)) return;

      if ((node.callee.property.type == 'Identifier') && !node.callee.computed)
        prop = node.callee.property.name;
      else {
        this.accept(node.callee.property, state);
        prop = state.result;
      }
      fn = frame.isResuming() && frame.isAlreadyComputed(node.callee.astIndex) ? frame.alreadyComputed[node.callee.astIndex] : recv[prop];
    } else {
      // simple call
      this.accept(node.callee, state);
      fn = state.result;
    }
    if (this.shortCircuitChain(node, fn, state)) return;
    node.arguments.forEach(function(arg) {
      this.accept(arg, state);
      if (arg.type === 'SpreadElement') args.push(...state.result);
      else args.push(state.result);
    }, this);
    }
    try {
      state.result = this.invoke(recv, fn, args, state.currentFrame, state.isNew);
    } catch (e) {
      if (e.isUnwindException && e.error.reason === 'bindings') frame.pendingCall = {node, recv, fn, args};
      if (lively.Config && lively.Config.loadRewrittenCode && e.unwindException)
        e = e.unwindException;
      state.result = e;
      state.currentFrame.setPC(node);
      if (e.isUnwindException) {
        e.shiftFrame(state.currentFrame);
        e = e.error;
      }
      throw e.unwindException || e;
    }
  }

  visitMemberExpression(node, state) {
    this.accept(node.object, state);
    var object = state.result,
        property;
    if (this.shortCircuitChain(node, object, state)) return;
    if ((node.property.type == 'Identifier') && !node.computed)
      property = node.property.name;
    else {
      this.accept(node.property, state);
      property = state.result;
    }
    var getter = object != null ? object.__lookupGetter__(property) : false;
    if (getter) {
      state.result = this.invoke(object, getter, [], state.currentFrame, false/*isNew*/)
    } else {
      state.result = object[property];
    }
  }

  visitSwitchCase(node, state) {
    var frame = state.currentFrame;
    for (var i = 0; i < node.consequent.length; i++) {
      this.accept(node.consequent[i], state);
      if (frame.returnTriggered || frame.breakTriggered || frame.continueTriggered)
        return;
    }
  }

  visitIdentifier(node, state) {
    state.result = state.currentFrame.lookup(node.name);
  }

  visitMetaProperty(node, state) {
    if (node.meta.name !== 'new' || node.property.name !== 'target') throw new Error('Unsupported meta property');
    state.result = state.currentFrame.newTarget;
  }

  visitLiteral(node, state) {
    state.result = node.value;
    return;
  }

  visitAwaitExpression(node, state) {
    const frame = state.currentFrame;
    if (frame.awaitRejection) {
      const error = frame.awaitRejection;
      delete frame.awaitRejection;
      throw error;
    }
    this.accept(node.argument, state);
    __awaitValue(state.result, node.astIndex);
  }

  visitYieldExpression(node, state) {
    const frame = state.currentFrame;
    if (frame.awaitRejection) {
      const error = frame.awaitRejection;
      delete frame.awaitRejection;
      throw error;
    }
    const request = frame.generatorRequest;
    delete frame.generatorRequest;
    if (node.delegate) return this.visitDelegatedYield(node, state, request);
    if (request && request.method !== 'next') {
      if (request.method === 'throw') throw new GeneratorThrow(request.value);
      throw new GeneratorReturn(request.value);
    }
    if (node.argument) this.accept(node.argument, state);
    else state.result = undefined;
    if (frame.func.node.async) {
      const key = '__yieldValue_' + node.astIndex;
      if (Object.prototype.hasOwnProperty.call(frame.alreadyComputed, key)) {
        state.result = frame.alreadyComputed[key];
        delete frame.alreadyComputed[key];
      } else __awaitValue(state.result, node.astIndex, {valueKey: key});
    }
    throw new UnwindException({reason: 'yield', value: state.result, astIndex: node.astIndex, toString() { return 'Yield'; }});
  }

  visitDelegatedYield(node, state, request = {method: 'next', value: undefined}) {
    const frame = state.currentFrame, key = '__delegate_' + node.astIndex;
    let iterator = frame.alreadyComputed[key];
    if (!iterator) {
      this.accept(node.argument, state);
      iterator = frame.alreadyComputed[key] = __forOf(state.result, {}, node.astIndex, !!frame.func.node.async);
    }
    if (!iterator.hasResult) iterator.request = request;
    else request = iterator.request;
    let step;
    if (iterator.hasResult) { step = iterator.result; delete iterator.hasResult; delete iterator.result; }
    else {
      const method = request.method;
      const receiver = iterator.iterator || iterator;
      const operation = receiver[method];
      if (iterator.indexed && method === 'return') throw new GeneratorReturn(request.value);
      if (!operation) {
        if (method === 'return') throw new GeneratorReturn(request.value);
        if (receiver.return) this.invoke(receiver, receiver.return, [], frame, false);
        throw new TypeError('Delegated iterator has no throw method');
      }
      frame.pendingDelegate = {key};
      step = receiver === iterator ? operation.call(receiver, request.value) : this.invoke(receiver, operation, [request.value], frame, false);
      delete frame.pendingDelegate;
      if (frame.func.node.async) {
        if (iterator.fromSync) step = Promise.resolve(step).then(async result => ({value: await result.value, done: result.done}));
        __awaitValue(step, node.astIndex, {delegateKey: key});
      }
    }
    if (step === null || typeof step !== 'object') throw new TypeError('Iterator result is not an object');
    if (step.done) {
      delete frame.alreadyComputed[key];
      if (request.method === 'return') throw new GeneratorReturn(step.value);
      state.result = step.value;
      return;
    }
    throw new UnwindException({reason: 'yield', value: step.value, astIndex: node.astIndex, toString() { return 'Yield'; }});
  }

  static stripInterpreterFrames(topFrame) {
    var allFrames = [topFrame];
    while (arr.last(allFrames).getParentFrame())
      allFrames.push(arr.last(allFrames).getParentFrame());
    allFrames = arr.filter(allFrames, function(frame) {
        return !frame.isInternal();
    });
    allFrames.push(undefined);
    allFrames.reduce(function(frame, parentFrame) {
      frame.setParentFrame(parentFrame);
      return parentFrame;
    });
    return allFrames[0];
  }

};

export class GeneratorReturn {
  constructor(value) { this.value = value; }
  get isGeneratorReturn() { return true; }
}

export class GeneratorThrow {
  constructor(value) { this.value = value; }
  get isGeneratorThrow() { return true; }
}

export class ManagedGenerator {
  constructor(frame) {
    this.frame = frame;
    this.state = 'start';
    this.async = !!frame.func.node.async;
    frame.generator = this;
    frame.setParentFrame(null);
    this.__after_deserialize__();
  }

  get isManagedGenerator() { return true; }
  get __dont_serialize__() { return ['queue', 'debuggerRuntime']; }
  __after_deserialize__() {
    Object.defineProperty(this, this.async ? Symbol.iterator : Symbol.asyncIterator, {value: undefined, configurable: true});
  }
  [Symbol.iterator]() { return this; }
  [Symbol.asyncIterator]() { return this; }
  next(value) { return this.request('next', value); }
  throw(value) { return this.request('throw', value); }
  return(value) { return this.request('return', value); }

  request(method, value) {
    const execute = () => {
      try { return this.advance(method, value); }
      catch (error) {
        if (this.debuggerRuntime && !debugSupportEnabled()) return this.debuggerRuntime.capture(error);
        if (error.isUnwindException && error.error.reason === 'await') return Continuation.fromUnwindException(error).resume();
        if (error.isUnwindException && error.error instanceof Error) { this.state = 'done'; throw error.error; }
        throw error;
      }
    };
    if (!this.async) return execute();
    const result = (this.queue || Promise.resolve()).then(async () => {
      if (method === 'return') value = await value;
      const result = await execute();
      return result?.isContinuation ? result : {value: await result.value, done: result.done};
    });
    this.queue = result.catch(() => {});
    return result;
  }

  advance(method, value, parentFrame = null, interpreter = new Interpreter({captureErrors: true})) {
    if (this.state === 'executing') throw new TypeError('Generator is already running');
    if (this.state === 'done' || this.state === 'start' && method !== 'next') {
      this.state = 'done';
      if (method === 'throw') throw value;
      return {value: method === 'return' ? value : undefined, done: true};
    }
    if (this.state === 'yield') {
      const pc = this.frame.getPC();
      if (method === 'next' && !pc.delegate) this.frame.alreadyComputed[pc.astIndex] = value;
      else {
        delete this.frame.alreadyComputed[pc.astIndex];
        this.frame.generatorRequest = {method, value};
      }
    }
    this.frame.setParentFrame(parentFrame);
    return this.resume(interpreter);
  }

  resume(interpreter) {
    const frame = this.frame;
    this.state = 'executing';
    try {
      const value = frame.isResuming() ? interpreter.runFromPC(frame) : interpreter.runWithFrame(frame.func.node, frame);
      this.state = 'done';
      frame.setParentFrame(null);
      return {value, done: true};
    } catch (error) {
      if (error.isGeneratorReturn) {
        this.state = 'done';
        frame.setParentFrame(null);
        return {value: error.value, done: true};
      }
      if (error.isGeneratorThrow) { this.state = 'done'; frame.setParentFrame(null); throw error.value; }
      if (error.isUnwindException && error.error.reason === 'yield') {
        this.state = 'yield';
        frame.setParentFrame(null);
        return {value: error.error.value, done: false};
      }
      this.state = 'debugger';
      throw error;
    }
  }
}

export class Function {

  get __dont_serialize__() { return ['_cachedFunction', 'originalFunction', 'capturedFrameState', '_restoredFunction']; }

  __after_deserialize__() {
    if (this._restoredFunction) {
      this._restoredFunction.__after_deserialize__();
      delete this._restoredFunction;
    }
  }

  __additionally_serialize__(snapshot, ref, pool, addFn) {
    if (this.capturedFrameState) addFn('lexicalScope', Scope.recreateFromFrameState(this.capturedFrameState));
  }

  get isInterpretableFunction() { return true }

  constructor(node, scope, optFunc) {
    this.originalFunction = optFunc;
    const parent = !optFunc && node._parentEntry != null && originalFunctions.get(__getClosure(node.sourceFile || '[runtime]', node._parentEntry));
    const meta = parent && parent[Symbol.for('lively-object-meta')];
    this.runtimeObjectMeta = optFunc && optFunc[Symbol.for('lively-object-meta')] || meta && {...meta, start: meta.start + node.start, end: meta.start + node.end};
    this.runtimeModuleMeta = (optFunc || parent)?.[Symbol.for('lively-module-meta')];
    this.lexicalThis = optFunc && optFunc._lexicalThis;
    this.lexicalArguments = optFunc && optFunc._lexicalArguments;
    this.lexicalScope = scope;
    this.node = node;
    this.source = undefined;

    if (!optFunc && node.type == 'FunctionExpression' && node.source) {
      // FIXME: make sure that source really is a FunctionExpression (and not the complete source)
      optFunc = eval('(' + node.source + ')'); // multiple brackets don't hurt
    }
    this.prepareFunction(optFunc);
  }

  prepareFunction(optFunc) {
    if (this._cachedFunction)
      return this._cachedFunction;

    var self = this,
        forwardFn = function FNAME(/*args*/) {
          'use strict';
          return self.apply(this, arr.from(arguments), undefined, new.target);
        },
        forwardSrc = forwardFn.toStringRewritten ? forwardFn.toStringRewritten() : forwardFn.toString();
    
    var fn = obj.extend(
      // FIXME: this seems to be the only way to get the name attribute right
      eval('(' + forwardSrc.replace('FNAME', this.name() || '') + ')'), {
      isInterpretableFunction: true,
      forInterpretation: function(interpreter, newTarget) {
        return function(/*args*/) { 'use strict'; return self.apply(this, arr.from(arguments), interpreter, newTarget); }
      },
      ast: function() { return self.node; },
      setParentFrame: function(frame) { self.parentFrame = frame; },
      startHalted: function(interpreter, newTarget) {
        interpreter.haltAtNextStatement();
        return function(/*args*/) { 'use strict'; return self.apply(this, arr.from(arguments), interpreter, newTarget); }
      },
      // TODO: reactivate when necessary
      // evaluatedSource: function() { return ...; }
      // custom Lively stuff
      methodName: (optFunc && optFunc.methodName) || this.name(),
      declaredClass: (optFunc && optFunc.declaredClass),
      sourceModule: (optFunc && optFunc.sourceModule),
      argumentNames: function() {
        return self.argNames();
      },
      toString: function() {
        return self.getSource();
      },
      __serialize__: function(pool, snapshots, path) { return serializeManagedFunction(fn, self, pool, snapshots, path); }
    });
    if (fn.methodName && fn.declaredClass)
      fn.displayName = fn.declaredClass + '$' + fn.methodName;
    else if (optFunc && optFunc.displayName)
      fn.displayName = optFunc.displayName;

    if (optFunc) {
      fn.prototype = optFunc.prototype;
      this.source = optFunc.toString();
      // TODO: prepare more stuff from optFunc
    }
    if (this.runtimeObjectMeta) Object.defineProperty(fn, Symbol.for('lively-object-meta'), {value: this.runtimeObjectMeta});
    if (this.runtimeModuleMeta) Object.defineProperty(fn, Symbol.for('lively-module-meta'), {value: this.runtimeModuleMeta});
    const module = this.lexicalScope?.debugModule();
    if (module) fn = module.System.get('@lively-env').moduleDebugger.wrapFunction(fn, module);
    this._cachedFunction = fn;
  }

  argNames() {
    return query.helpers.declIds(this.node.params).map(param => param.name);
  }

  name() {
    return this.node.id ? this.node.id.name : undefined;
  }

  getAst() {
    return this.node;
  }

  isFunction() {
    var astType = this.getAst().type;
    return astType == 'FunctionExpression' || astType == 'FunctionDeclaration' || astType === 'ArrowFunctionExpression';
  }

  getSource() {
    var source = this.node.type === 'ArrowFunctionExpression' && this.getAst().source || this.source || this.getAst().source;
    if (source) return source;

    var ast = this.getAst();
    if (ast._parentEntry != null) {
      source = __getClosure(ast.sourceFile || "[runtime]", ast._parentEntry).source;
    }
    if (!source && ast.sourceFile) {
      //source = resource(System.baseURL).join(ast.sourceFile).read();
    }
    if (source)
      return source.substring(ast.start, ast.end);

    return escodegen.generate(this.getAst());
  }

  apply(thisObj, argValues, interpreter, newTarget) {
    if (this.capturedFrameState) {
      this.lexicalScope = Scope.recreateFromFrameState(this.capturedFrameState);
      delete this.capturedFrameState;
    }
    var // mapping = obj.extend({}, this.getVarMapping()),
        argNames = this.argNames();
    // work-around for $super
    // if (mapping['$super'] && argNames[0] == '$super')
    //     argValues.unshift(mapping['$super']);

    var parentFrame = this.parentFrame ? this.parentFrame : Frame.global(),
        frame = parentFrame.newFrame(this, this.lexicalScope);
    if (!parentFrame.func) frame.setParentFrame(null);
    frame.newTarget = newTarget;
    frame.constructorInvocation = !!this.originalFunction?.[Symbol.for('lively-debug-constructor')];
    // FIXME: add mapping to the new frame.getScope()
    if (this.node.type === 'ArrowFunctionExpression') frame.setThis(this.lexicalThis);
    else if (thisObj !== undefined) frame.setThis(thisObj);
    frame.setArguments(argValues);
    if (this.node.generator) return new ManagedGenerator(frame);
    // TODO: reactivate when necessary
    // frame.setCaller(lively.ast.Interpreter.Frame.top);
    return this.basicApply(frame, interpreter);
  }

  basicApply(frame, interpreter) {
    interpreter = interpreter || new Interpreter();
    try {
      // TODO: reactivate?!
      // Frame.top = frame;
      // important: lively.ast.Interpreter.Frame.top is only valid
      // during the native VM-execution time. When the execution
      // of the interpreter is stopped, there is no top frame anymore.
      return interpreter.runWithFrame(this.node, frame);
    } catch (ex) {
      if (lively.Config && lively.Config.loadRewrittenCode && ex.unwindException)
        ex = ex.unwindException;
      if (ex.isUnwindException && !frame.getPC()) {
        var pc = acorn.walk.findNodeByAstIndex(frame.getOriginalAst(), ex.error.astIndex);
        frame.setPC(pc);
        ex.shiftFrame(frame);
      }
      throw ex;
    }
  }

  asFunction() {
    return this.prepareFunction() && this._cachedFunction;
  }

  resume(frame) {
    return this.basicApply(frame);
  }

  browse(thisObject) {
    var fn = this.asFunction();
    if (fn.sourceModule && fn.methodName && fn.declaredClass) {
      $world.browseCode(fn.declaredClass, fn.methodName, fn.sourceModule.name());
    } else if (thisObject && lively.Class.isClass(thisObject) && fn.displayName) {
      $world.browseCode(thisObject.name, fn.displayName, (fn.sourceModule || thisObject.sourceModule).name());
    } else if (thisObject && thisObject.isMorph && this.node.type != 'Program') {
      $world.openObjectEditorFor(thisObject, function(ed) {
        ed.targetMorph.get('ObjectEditorScriptList').setSelection(fn.methodName || this.name());
      });
    } else
      //TODO: Add browse implementation for other functions
      throw new Error('Cannot browse anonymous function ' + this);
  }

};

export class Frame {

  get __dont_serialize__() { return ['alreadyComputed', 'pc', 'pcStatement']; }

  __additionally_serialize__(snapshot, ref, pool, addFn) {
    const computed = Object.fromEntries(Object.entries(this.alreadyComputed)
      .filter(([, value]) => !value || typeof value.then !== 'function'));
    addFn('alreadyComputed', computed);
    addFn('serializedPC', this.pc && this.pc.astIndex);
    addFn('serializedPCStatement', this.pcStatement && this.pcStatement.astIndex);
  }

  __after_deserialize__() {
    if (!this.func?.node) return;
    this.pc = this.serializedPC == null ? null : acorn.walk.findNodeByAstIndex(this.func.node, this.serializedPC);
    this.pcStatement = this.serializedPCStatement == null ? null : acorn.walk.findNodeByAstIndex(this.func.node, this.serializedPCStatement);
    delete this.serializedPC;
    delete this.serializedPCStatement;
  }

  constructor(func, scope) {
    this.func              = func;  // Function object
    this.scope             = scope; // lexical scope
    this.returnTriggered   = false;
    this.breakTriggered    = null;  // null, true or string (labeled break)
    this.continueTriggered = null;  // null, true or string (labeled continue)
    this.parentFrame       = null;
    this.pc                = null;  // program counter, actually an AST node
    this.pcStatement       = null;  // statement node of the pc
    this.alreadyComputed   = {};    // maps astIndex to values. Filled
                                    // when we unwind from captured state
  }

  newFrame(func, scope, mapping) {
    mapping = mapping || {};
    var newScope = new Scope(mapping, scope); // create new scope
    var newFrame = new Frame(func, newScope);
    newFrame.setParentFrame(this);
    return newFrame;
  }

  newScope(mapping) { return new Scope(mapping, this.scope); }

	copy() {
	  var scope = this.scope.copy();
	  var func = new Function(this.func.node, scope);
    var copy = new this.constructor(func, scope);
    copy.returnTriggered = this.returnTriggered;
    copy.breakTriggered = this.breakTriggered;
    copy.continueTriggered = this.continueTriggered;
    copy.newTarget = this.newTarget;
    copy.constructorInvocation = this.constructorInvocation;
    var parentFrame = this.getParentFrame();
    if (parentFrame) copy.setParentFrame(parentFrame.copy());
    copy.pc = this.pc;
    copy.pcStatement = this.pcStatement;
    copy.alreadyComputed = obj.extend({}, this.alreadyComputed);
    return copy;
	}

  reset() {
    try {
      var args = this.arguments;
    } catch (e) { /* might throw ReferenceError */ }
    this.scope       = new Scope(null, this.func.lexicalScope);
    this.returnTriggered   = false;
    this.breakTriggered  = null;    // null, true or string (labeled break)
    this.continueTriggered = null;    // null, true or string (labeled continue)
    this.pc        = null;    // program counter, actually an AST node
    this.pcStatement     = null;    // statement node of the pc
    this.alreadyComputed   = {};    // maps astIndex to values. Filled
                      // when we unwind from captured state
    if (args != undefined) this.setArguments(args);
  }

  // accessing

  completeReturnValue(value) {
    return (this.newTarget || this.constructorInvocation) && (value === null || typeof value !== 'object' && typeof value !== 'function') ? this.getThis() : value;
  }

  setScope(scope) { return this.scope = scope; }

  getScope() { return this.scope; }

  getFunctionScope() {
    let scope = this.scope;
    while (scope.getParentScope() && scope.getParentScope() !== this.func.lexicalScope) scope = scope.getParentScope();
    return scope;
  }

  setParentFrame(frame) { return this.parentFrame = frame; }

  getParentFrame() { return this.parentFrame; }

  getOriginalAst() { return this.func.getAst(); }

 // accessing - mapping

  lookup(name) {
    if (name === 'undefined') return undefined;
    if (name === 'NaN') return NaN;
    if (name === 'arguments')
      return this.scope.has(name) ? this.scope.get(name) : this.getArguments();
    var result = this.scope.findScope(name);
    if (result) return result.val;
    return undefined;
  }

  setArguments(argValues) {
    this.arguments = argValues;
    const interpreter = new Interpreter(), state = {currentFrame: this};
    const complex = this.func.node.params.some(param => param.type !== 'Identifier');
    if (complex) __declareLexicalBindings(this.scope.getMapping(), this.func.argNames().map(name => [name, 'let']));
    else for (const name of this.func.argNames()) this.scope.addToMapping(name);
    this.func.node.params.forEach((param, idx) => interpreter.bindPattern(param,
      param.type === 'RestElement' ? Array.from(argValues).slice(idx) : argValues[idx], state,
      (id, value) => complex ? __initializeBinding(this.scope.getMapping(), id.name, value) : this.scope.set(id.name, value)));
    return argValues;
  }

  getArguments() {
    if (this.func.node.type === 'ArrowFunctionExpression') {
      if (this.func.lexicalArguments === undefined) throw new ReferenceError('arguments is not defined');
      return this.func.lexicalArguments;
    }
    if (this.scope && this.scope.getMapping() != Global && this.func.isFunction())
      return this.arguments;
    throw new ReferenceError('arguments is not defined');
  }

  setThis(thisObj) { return this.thisObj = thisObj; }

  getThis() { return this.thisObj !== undefined ? this.thisObj : Global; }

  getException() { return this.exception; }

  canCatchAt(pc) {
    let handled = false;
    acorn.walk.simple(this.func.node.body, {TryStatement(node) {
      if (node.handler && node.block.start <= pc.start && pc.end <= node.block.end) handled = true;
    }}, acorn.walk.visitors.stopAtFunctions);
    return handled;
  }

 // control flow

  triggerReturn() { this.returnTriggered = true; }

  triggerBreak(label) { this.breakTriggered = label ? label : true; }

  stopBreak(label) {
    if (label === undefined) label = true;
    if (this.breakTriggered === label)
      this.breakTriggered = null;
  }

  triggerContinue(label) { this.continueTriggered = label ? label : true; }

  stopContinue(label) {
    if (label === undefined) label = true;
    if (this.continueTriggered === label)
      this.continueTriggered = false;
  }

  // resuming

  setAlreadyComputed(mapping) {
    // mapping == {astIndex: value}
    return this.alreadyComputed = mapping;
  }

  supplyCallResult(value) {
    const pending = this.pendingIterator || this.pendingDelegate;
    if (pending) {
      const iterator = this.alreadyComputed[pending.key];
      iterator.result = value;
      iterator.hasResult = true;
      delete this.pendingIterator;
      delete this.pendingDelegate;
    } else this.alreadyComputed[this.pc.astIndex] = value;
  }

  isAlreadyComputed(nodeOrAstIndex) {
    var astIndex = typeof nodeOrAstIndex === "number" ?
        nodeOrAstIndex : nodeOrAstIndex.astIndex;
    return this.alreadyComputed.hasOwnProperty(astIndex);
  }

  setPC(node) {
    if (!node) {
      this.pcStatement = null;
      return this.pc = null;
    } else {
      var ast = this.getOriginalAst();
      this.pcStatement = acorn.walk.findStatementOfNode(ast, node) ||
        (ast.type === 'ArrowFunctionExpression' && ast.body.type !== 'BlockStatement' ? ast.body : ast);
      return this.pc = node;
    }
  }

  getPC(node) {
    if (Object.prototype.hasOwnProperty.call(this, 'serializedPC')) this.__after_deserialize__();
    return this.pc;
  }

  isResuming() { return this.getPC() !== null; }

  resumesAt(node) { return node === this.pc; }

  resumesNow() { this.setPC(null); }

  resumeHasReachedPCStatement() {
    // For now: Just remove the pcStatement attribute to signal that
    // resuming reached it
    return this.pcStatement == null;
  }

  resumeReachedPCStatement() { this.pcStatement = null; }

  isPCStatement(node) {
    return this.pcStatement
      && (node === this.pcStatement
       || node.astIndex === this.pcStatement.astIndex);
  }

 // testing

  isInternal() {
    if (!this._internalModules) {
      // FIXME: URL not available here
      // var internalModules = [
      //   lively.ast.AcornInterpreter
      // ];
      // this._internalModules = internalModules.map(function(m) {
      //   return new URL(m.uri()).relativePathFrom(URL.root);
      // });
      this._internalModules = [
        'lively/ast/AcornInterpreter.js'
      ];
    }
    return arr.include(this._internalModules, this.getOriginalAst().sourceFile);
  }

};

obj.extend(Frame, {

  create(func, mapping) {
    var scope = new Scope(mapping);
    return new Frame(func, scope);
  },

  global() {
    return this.create(null, Global);
  }

});

export class Scope {
  debugModule() {
    for (let scope = this; scope; scope = scope.getParentScope()) {
      const module = scope.getMapping()[Symbol.for('lively-debug-module')];
      if (module) return module;
    }
  }

  get __dont_serialize__() { return ['mapping', 'computationState']; }

  __additionally_serialize__(snapshot, ref, pool, addFn) {
    const cells = bindingCells(this.mapping);
    if (cells) {
      addFn('serializedBindingCells', cells);
      const moduleNames = this.mapping[Symbol.for('lively-debug-module-bindings')] || [];
      const moduleId = this.mapping.__lvVarRecorder?.__currentLivelyModule.shortName();
      if (moduleId && moduleNames.length) {
        addFn('serializedModuleId', moduleId);
        addFn('serializedModuleNames', moduleNames);
        for (const name of moduleNames) addFn('serializedModuleBinding_' + name, pool.expressionSerializer.exprStringEncode({
          __expr__: name, bindings: {[moduleId]: [name]}
        }));
      }
      addFn('serializedExtraBindings', Object.fromEntries(Object.keys(this.mapping)
        .filter(name => !Object.prototype.hasOwnProperty.call(cells, name) && !moduleNames.includes(name)).map(name => [name, this.mapping[name]])));
    }
    else addFn('mapping', this.mapping);
  }

  __after_deserialize__() {
    if (this.serializedBindingCells) {
      this.mapping = restoreBindingCells(this.serializedExtraBindings || {}, this.serializedBindingCells);
      delete this.serializedBindingCells;
      delete this.serializedExtraBindings;
      if (this.serializedModuleId) {
        const recorder = Global.System.get('@lively-env').moduleEnv(Global.System.decanonicalize(this.serializedModuleId)).recorder;
        for (const name of this.serializedModuleNames) {
          Object.defineProperty(this.mapping, name, {enumerable: true, configurable: true,
            get() { return recorder[name]; }, set(value) { recorder[name] = value; }});
          delete this['serializedModuleBinding_' + name];
        }
        Object.defineProperty(this.mapping, '__lvVarRecorder', {value: recorder});
        Object.defineProperty(this.mapping, Symbol.for('lively-debug-module-bindings'), {value: this.serializedModuleNames});
        delete this.serializedModuleId;
        delete this.serializedModuleNames;
      }
    }
  }

  constructor(mapping, parentScope) {
    this.mapping     = mapping || {};
    this.parentScope = parentScope || null;
    this.nativeSnapshot = capturedBindingMappings.has(this.mapping);
  }

	copy() {
    return new this.constructor(
      obj.extend({}, this.mapping),
      this.parentScope ? this.parentScope.copy() : null
    );
	}

  // accessing

  getMapping() { return this.mapping; }

  setMapping(mapping) { this.mapping = mapping ; }

  getParentScope() { return this.parentScope; }

  setParentScope(parentScope) { this.parentScope = parentScope; }

  // accessing - mapping

  has(name) { return Object.prototype.hasOwnProperty.call(this.mapping, name); }

  hasInChain(name) { return this.has(name) || !!(this.parentScope && this.parentScope.hasInChain(name)); }

  get(name) { return this.mapping[name]; }

  set(name, value) { return this.mapping[name] = value; }

  addToMapping(name) {
    return this.has(name) ? this.get(name) : this.set(name, undefined);
  }

  findScope(name, isSet) {
    if (this.has(name)) {
      return { val: this.get(name), scope: this };
    }
    if (this.getMapping() === Global) { // reached global scope
      if (!isSet)
        throw new ReferenceError(name + ' is not defined');
      else
        return { val: undefined, scope: this };
    }
    // TODO: what is this doing?
    // lookup in my current function
    // if (!this.func) return null;
    // var mapping = this.func.getVarMapping();
    // if (mapping) {
    //     var val = mapping[name];
    //     if (val)
    //         return { val: val, frame: this };
    // }
    var parentScope = this.getParentScope();
    if (!parentScope)
      throw new ReferenceError(name + ' is not defined');
    return parentScope.findScope(name, isSet);
  }

}

obj.extend(Scope, {

  recreateFromFrameState(frameState) {
    var scope, topScope, newScope;
    // frameState: [0], alreadyComputed, [1] = varMapping, [2] = parentFrameState
    do {
      newScope = new Scope(frameState == Global ? Global : frameState[1]);
      if (frameState !== Global) newScope.computationState = frameState[0];
      if (frameState !== Global && frameState[3] !== undefined) newScope.lexicalNodeIndex = frameState[3];
      if (scope)
        scope.setParentScope(newScope);
      else
        topScope = newScope;
      scope = newScope
      frameState = frameState == Global ? null : frameState[2];
    } while (frameState);
    return topScope;
  },

  varMappingOfFrameState(frameState) {
    return this.varMapping(this.recreateFromFrameState(frameState));
  },

  varMapping(scope) {
    // takes a scope instance and returns a simple JS obj (map) that
    // represents the var names / values captured in scope

    return obj.merge.apply(null,
      scopes(scope).invoke("getMapping").reverse());

    function scopes(scope) {
      return [scope].concat(scope.parentScope ?
        scopes(scope.parentScope) : []);
    }
  }

});
