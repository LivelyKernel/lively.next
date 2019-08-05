import { obj, arr } from "lively.lang";
import { acorn, escodegen } from "lively.ast";
import { UnwindException, __getClosure } from "./exception.js";
import { getGlobal } from "lively.vm/lib/util.js";

let Global = getGlobal();

export class Interpreter {

  constructor() {
    this.breakAtStatement = false; // for e.g. step over
    this.breakAtCall    = false; // for e.g. step into
  }

  get statements() { 
     return ['EmptyStatement', 'ExpressionStatement', 'IfStatement', 'LabeledStatement', 'BreakStatement', 'ContinueStatement', 'WithStatement', 'SwitchStatement', 'ReturnStatement', 'ThrowStatement', 'WhileStatement', 'DoWhileStatement', 'ForStatement', 'ForInStatement', 'DebuggerStatement', 'VariableDeclaration', 'FunctionDeclaration', 'SwitchCase'] // without BlockStatement and TryStatement
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

  runWithFrame(node, frame) {
    var isFunction = node.type == 'FunctionDeclaration' || node.type =='FunctionExpression',
        result = this.runWithFrameAndResult(isFunction ? node.body : node, frame, undefined);
    if (frame.returnTriggered || !isFunction)
      return result;
  }

  runFromPC(frame, lastResult) {
    var node = frame.getOriginalAst();
    if (frame.func.isFunction())
      node = node.body;
    return this.runWithFrameAndResult(node, frame, lastResult);
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
        node.declarations.forEach(function(decl) {
          frame.getScope().addToMapping(decl.id.name);
        });
      },
      FunctionDeclaration: (node, state, depth, type) => {
        if (type != 'FunctionDeclaration') return;
        self.visitFunctionDeclaration(node, { currentFrame: frame });
      }
    }, null, { visitors: acorn.walk.visitors.stopAtFunctions });
  }

  invoke(recv, func, argValues, frame, isNew) {
    // if we send apply to a function (recv) we want to interpret it
    // although apply is a native function
    if (recv && obj.isFunction(recv) && func === Function.prototype.apply) {
      func = recv; // The function object is what we want to run
      recv = argValues.shift(); // thisObj is first parameter
      argValues = argValues[0]; // the second arg are the arguments (as an array)
    }
    var origFunc = func;

    if (this.shouldHaltAtNextCall()) // try to fetch interpreted function
      func = this.fetchInterpretedFunction(func) || func;

    if (this.shouldInterpret(frame, func)) {
      func.setParentFrame(frame);
      if (this.shouldHaltAtNextCall()) {
        this.breakAtCall = false;
        this.breakAtStatement = false;
        func = func.startHalted(this);
      } else {
        func = func.forInterpretation(this);
      }
    }
    if (isNew) {
      function construct(constructor, args) {
        function F() {
          return constructor.apply(this, args);
        }
        F.prototype = constructor.prototype;
        return new F();
      }
      if (this.isNative(func)) return construct(func, argValues);
      recv = this.newObject(origFunc);
    }

    var result = func.apply(recv, argValues);
    if (isNew && !obj.isObject(result))
      return recv;
    return result;
  }

  isNative(func) {
    if (!this._nativeFuncRegex) this._nativeFuncRegex = /\{\s+\[native\scode\]\s+\}$/;
    return this._nativeFuncRegex.test(func.toString());
  }

  shouldInterpret(frame, func) {
    return !this.isNative(func) && !!func.isInterpretableFunction;
    // TODO: reactivate when necessary
      // || func.containsDebugger();
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

    // is the pc is in sub-ast of node? return false if not
    if (node.astIndex < frame.pcStatement.astIndex) return false;

    return true;
  }

  fetchInterpretedFunction(func) {
    if (!func.livelyDebuggingEnabled) return null;
    if (func.isInterpretableFunction !== undefined) return func;
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
      if (frame.isPCStatement(node)) frame.resumeReachedPCStatement();
      if (frame.resumesAt(node)) {
        frame.resumesNow();
        if (this.breakOnResume) {
          this.breakOnResume = false;
          throw throwableBreak();
        }
      }
      if (frame.isAlreadyComputed(node.astIndex)) {
        state.result = frame.alreadyComputed[node.astIndex];
        return;
      }
    } else if (this.shouldHaltAtNextStatement(node) && arr.include(this.statements, node.type)) {
      if (node.type == 'DebuggerStatement')
        frame.alreadyComputed[node.astIndex] = undefined;
      this.breakAtStatement = false;
      this.breakAtCall = false;
      throw throwableBreak();
    }

    try {
      this['visit' + node.type](node, state);
    } catch (e) {
      if (lively.Config && lively.Config.loadRewrittenCode && !(e instanceof UnwindException)) {
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
    for (var i = 0; i < node.body.length; i++) {
      this.accept(node.body[i], state);
      if (frame.returnTriggered || frame.breakTriggered || frame.continueTriggered)
        return;
    }
  }

  visitExpressionStatement(node, state) {
    this.accept(node.expression, state);
  }

  visitIfStatement(node, state) {
    var oldResult = state.result,
        frame = state.currentFrame;
    this.accept(node.test, state);
    var condVal = state.result;
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
    var frame = state.currentFrame,
        hasError = false, err;

    try {
      this.accept(node.block, state);
    } catch (e) {
      if (lively.Config && lively.Config.loadRewrittenCode) {
        if (e instanceof UnwindException)
          throw e;
        else  if (e.unwindException && e.toString() == 'Break')
          throw e.unwindException;
      }
      hasError = true;
      state.error = err = e;
    }
    if (!hasError && frame.isResuming() && (node.handler !== null)  && !frame.isAlreadyComputed(node.handler))
      hasError = true;

    try {
      if (hasError && (node.handler !== null)) {
        hasError = false;
        this.accept(node.handler, state);
        delete state.error;
      }
    } catch (e) {
      hasError = true;
      err = e;
    } finally {
      if (node.finalizer !== null)
        this.accept(node.finalizer, state);
    }

    if (hasError)
      throw err;
  }

  visitCatchClause(node, state) {
    var frame = state.currentFrame;
    if (!frame.isResuming() || state.hasOwnProperty('error')) {
      var catchScope = frame.newScope();
      catchScope.set(node.param.name, state.error);
      frame.setScope(catchScope);
    }
    this.accept(node.body, state);
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
      if (frame.returnTriggered)
        return;

      if (node.update) {
        this.accept(node.update, state);
      }

      if (node.test) {
        this.accept(node.test, state);
        testVal = state.result;
      }
      state.result = result;
    }
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
    if (node.left.type == 'VariableDeclaration') {
      this.accept(node.left, state);
      left = node.left.declarations[0].id;
    } else
      left = node.left;
    state.result = result;

    for (var i = 0; i < keys.length; i++) {
      state.result = keys[i];
      if (left.type == 'Identifier') {
        if (frame.isResuming() && frame.lookup(left.name) !== state.result)
          continue;
        this.setVariable(left.name, state);
      } else if (left.type == 'MemberExpression') {
        this.setSlot(left, state);
      }

      this.accept(node.body, state);

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

  visitDebuggerStatement(node, state) {
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
    if (node.kind == 'var') {
      node.declarations.forEach(function(decl) {
        this.accept(decl, state);
      }, this);
    } else
      throw new Error('No semantics for VariableDeclaration of kind ' + node.kind + '!');
    state.result = oldResult;
  }

  visitVariableDeclarator(node, state) {
    var oldResult = state.result, val;
    if (node.init) {
      this.accept(node.init, state);
      // addToMapping is done in evaluateDeclarations()
      this.setVariable(node.id.name, state);
    }
    state.result = oldResult;
  }

  visitThisExpression(node, state) {
    state.result = state.currentFrame.getThis();
  }

  visitArrayExpression(node, state) {
    var result = new Array(node.elements.length);
    node.elements.forEach(function(elem, idx) {
      if (elem) {
        this.accept(elem, state);
        result[idx] = state.result;
      }
    }, this);
    state.result = result;
  }

  visitObjectExpression(node, state) {
    var result = {};
    node.properties.forEach(function(prop) {
      var propName;
      if (prop.key.type == 'Identifier')
        propName = prop.key.name;
      else {
        this.accept(prop.key, state);
        propName = state.result;
      }
      switch (prop.kind) {
      case 'init':
        this.accept(prop.value, state);
        result[propName] = state.result;
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

  visitSequenceExpression(node, state) {
    node.expressions.forEach(function(expr) {
      this.accept(expr, state);
    }, this);
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
        var ex = (lively.Config && lively.Config.loadRewrittenCode && (e instanceof UnwindException)) ?
              e.error : e;
        if (ex instanceof ReferenceError)
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
     || (node.operator == '&&' && left))
     this.accept(node.right, state);
  }

  visitConditionalExpression(node, state) {
    this.visitIfStatement(node, state);
  }

  visitNewExpression(node, state) {
    state.isNew = true;
    this.visitCallExpression(node, state);
    delete state.isNew; // FIXME: nested NewExpressions?
  }

  visitCallExpression(node, state) {
    var recv, prop, fn;
    if (node.callee.type == 'MemberExpression') {
      // send
      this.accept(node.callee.object, state);
      recv = state.result;

      if ((node.callee.property.type == 'Identifier') && !node.callee.computed)
        prop = node.callee.property.name;
      else {
        this.accept(node.callee.property, state);
        prop = state.result;
      }
      fn = recv[prop];
    } else {
      // simple call
      this.accept(node.callee, state);
      fn = state.result;
    }
    var args = [];
    node.arguments.forEach(function(arg) {
      this.accept(arg, state);
      args.push(state.result);
    }, this);
    try {
      state.result = this.invoke(recv, fn, args, state.currentFrame, state.isNew);
    } catch (e) {
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

  visitLiteral(node, state) {
    state.result = node.value;
    return;
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

export class Function {

  get isInterpretableFunction() { return true }

  constructor(node, scope, optFunc) {
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
          return self.apply(this, arr.from(arguments));
        },
        forwardSrc = forwardFn.toStringRewritten ? forwardFn.toStringRewritten() : forwardFn.toString();
    
    var fn = obj.extend(
      // FIXME: this seems to be the only way to get the name attribute right
      eval('(' + forwardSrc.replace('FNAME', this.name() || '') + ')'), {
      isInterpretableFunction: true,
      forInterpretation: function(interpreter) {
        return function(/*args*/) { return self.apply(this, arr.from(arguments), interpreter); }
      },
      ast: function() { return self.node; },
      setParentFrame: function(frame) { self.parentFrame = frame; },
      startHalted: function(interpreter) {
        interpreter.haltAtNextStatement();
        return function(/*args*/) { return self.apply(this, arr.from(arguments), interpreter); }
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
      }
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
    this._cachedFunction = fn;
  }

  argNames() {
    return this.node.params.map(function(param) {
      // params are supposed to be of type Identifier
      return param.name;
    });
  }

  name() {
    return this.node.id ? this.node.id.name : undefined;
  }

  getAst() {
    return this.node;
  }

  isFunction() {
    var astType = this.getAst().type;
    return astType == 'FunctionExpression' || astType == 'FunctionDeclaration';
  }

  getSource() {
    var source = this.source || this.getAst().source;
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

  apply(thisObj, argValues, interpreter) {
    var // mapping = obj.extend({}, this.getVarMapping()),
        argNames = this.argNames();
    // work-around for $super
    // if (mapping['$super'] && argNames[0] == '$super')
    //     argValues.unshift(mapping['$super']);

    var parentFrame = this.parentFrame ? this.parentFrame : Frame.global(),
        frame = parentFrame.newFrame(this, this.lexicalScope);
    // FIXME: add mapping to the new frame.getScope()
    if (thisObj !== undefined)
      frame.setThis(thisObj);
    frame.setArguments(argValues);
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
    var parentFrame = this.getParentFrame();
    if (parentFrame) copy.setParentFrame(parentFrame.copy());
    copy.pc = this.pc;
    copy.pcStatement = this.pcStatement;
    copy.alreadyComputed = obj.extend({}, this.alreadyComputed);
    return copy;
	}

  reset() {
    try {
      var args = this.getArguments();
    } catch (e) { /* might throw ReferenceError */ }
    this.scope       = new Scope(null, this.scope.getParentScope());
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

  setScope(scope) { return this.scope = scope; }

  getScope() { return this.scope; }

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
    var argNames = this.func.argNames();
    argNames.forEach(function(arg, idx) {
      this.scope.set(arg, argValues[idx]);
    }, this);
    return this.arguments = argValues;
  }

  getArguments() {
    if (this.scope && this.scope.getMapping() != Global && this.func.isFunction())
      return this.arguments;
    throw new ReferenceError('arguments is not defined');
  }

  setThis(thisObj) { return this.thisObj = thisObj; }

  getThis() { return this.thisObj ? this.thisObj : Global; }

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
      this.pcStatement = acorn.walk.findStatementOfNode(ast, node) || ast;
      return this.pc = node;
    }
  }

  getPC(node) { return this.pc; }

  isResuming() { return this.pc !== null; }

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

  constructor(mapping, parentScope) {
    this.mapping     = mapping || {};
    this.parentScope = parentScope || null;
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

  has(name) { return this.mapping.hasOwnProperty(name); }

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
