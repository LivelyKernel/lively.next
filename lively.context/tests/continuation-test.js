"format esm";
/*global global, beforeEach, afterEach, describe, it, expect*/
import * as rewriting from '../lib/rewriter.js'
import { Path, arr } from "lively.lang";
import { expect, chai } from "mocha-es6";
import { parseFunction, stringify } from "lively.ast";
import { Continuation, stackCaptureMode } from "../lib/stackReification.js";
import * as StackReification from "../lib/stackReification.js";
import { Interpreter } from "../lib/interpreter.js";
import { runtimeFunctionSource } from '../lib/exception.js';
import { installShallowDeepEqual } from './helpers.js';
installShallowDeepEqual(chai);

describe('continuation', function() {
  var config,
      debugOption = Path('lively.Config.enableDebuggerStatements'),
      astRegistry, oldAstRegistry,
      Global = typeof window !== "undefined" ? window : global;

  beforeEach(function() {
    oldAstRegistry = rewriting.getCurrentASTRegistry();
    astRegistry = {};
    rewriting.setCurrentASTRegistry(astRegistry);
    config = debugOption.get(Global);
    debugOption.set(Global, true /*, true */);
  });

  afterEach(function() {
    rewriting.setCurrentASTRegistry(oldAstRegistry);
    debugOption.set(Global, config);
  });

  it('enters and exits debug support without calling interceptable Path accessors', function() {
    const get = Path.prototype.get, set = Path.prototype.set;
    Path.prototype.get = Path.prototype.set = () => { throw new Error('Debugger bookkeeping must not call intercepted helpers'); };
    try {
      StackReification.enableDebugSupport(astRegistry);
      const enabled = StackReification.debugSupportEnabled();
      StackReification.disableDebugSupport();
      expect(enabled).equals(true);
      expect(StackReification.debugSupportEnabled()).equals(false);
    } finally {
      Path.prototype.get = get;
      Path.prototype.set = set;
      StackReification.disableDebugSupport();
    }
  });

  it('reuses array helpers and restores prototype methods installed between captures', function() {
    const original = Array.prototype.forEach;
    StackReification.enableDebugSupport(astRegistry);
    const rewritten = Array.prototype.forEach;
    StackReification.disableDebugSupport();
    const installed = function(callback) { return original.call(this, callback); };
    let reused, restored;
    try {
      Array.prototype.forEach = installed;
      StackReification.enableDebugSupport(astRegistry);
      reused = Array.prototype.forEach;
      StackReification.disableDebugSupport();
      restored = Array.prototype.forEach;
    } finally { StackReification.disableDebugSupport(); Array.prototype.forEach = original; }
    expect(reused).equals(rewritten);
    expect(restored).equals(installed);
  });

  it('captures default and destructured parameters and resumes destructured declarations', function() {
    function compute({amount = 2} = {}, ...items) {
      const {value = amount, ...remaining} = {other: 3};
      debugger;
      const [first, ...rest] = items;
      return value + remaining.other + first + rest[0];
    }
    const stopped = StackReification.run(compute, astRegistry, [undefined, 4, 5]);
    if (stopped.exception) throw stopped.exception;
    expect(stopped.currentFrame.lookup('amount')).equals(2);
    expect(stopped.currentFrame.lookup('value')).equals(2);
    expect(stopped.currentFrame.lookup('items')).deep.equals([4, 5]);
    expect(stopped.resume()).equals(14);
  });

  it('binds destructured defaults when the interpreter calls a function after suspension', function() {
    function compute({amount = 2} = {}, ...items) { return amount + items[0]; }
    function caller() { debugger; return compute(undefined, 4); }
    const stopped = StackReification.run(caller, astRegistry, [], {compute});
    expect(stopped.resume()).equals(6);
  });

  it('evaluates parameter defaults once during capture and preserves their TDZ in interpreted calls', function() {
    const marker = {visits: 0};
    function compute(amount = ++marker.visits) { debugger; return amount; }
    const stopped = StackReification.run(compute, astRegistry, [], {marker});
    expect(marker.visits).equals(1);
    expect(stopped.resume()).equals(1);
    expect(marker.visits).equals(1);
    function invalid(first = second, second = 2) { return first; }
    function caller() { debugger; return invalid(); }
    const rejected = StackReification.run(caller, astRegistry, [], {invalid}).resume();
    expect(rejected.exception).instanceOf(ReferenceError);
  });

  it('retains destructured bindings in ordinary and iterator loop scopes', function() {
    function ordinary() { let total = 0; debugger; for (let [value] = [1]; value < 3; value++) total += value; return total; }
    expect(StackReification.run(ordinary, astRegistry).resume()).equals(3);
    function iterator() { let total = 0; for (const {value} of [{value: 3}]) { debugger; total += value; } return total; }
    const stopped = StackReification.run(iterator, astRegistry);
    expect(stopped.currentFrame.lookup('value')).equals(3);
    expect(stopped.resume()).equals(3);
  });

  it('retains per-iteration lexical for-in bindings through suspension and closure capture', function() {
    function compute() {
      const readers = [];
      for (const key in {first: 1, second: 2}) { readers.push(() => key); debugger; }
      return readers.map(read => read()).join(',');
    }
    const first = StackReification.run(compute, astRegistry);
    if (first.exception) throw first.exception;
    expect(first.currentFrame.lookup('key')).equals('first');
    const second = first.resume();
    if (second.exception) throw second.exception;
    expect(second.currentFrame.lookup('key')).equals('second');
    expect(second.resume()).equals('first,second');
  });

  it('preserves template literals before and after suspension', function() {
    function compute() { const before = `before ${2 + 1}`; debugger; return `${before}: after ${4}`; }
    const stopped = StackReification.run(compute, astRegistry);
    expect(stopped.currentFrame.lookup('before')).equals('before 3');
    expect(stopped.resume()).equals('before 3: after 4');
  });

  it('preserves spread calls and constructors before and after suspension', function() {
    function compute() {
      const values = [];
      values.push(...[1, 2]);
      debugger;
      const set = new Set([...values, ...[3]]);
      return Math.max(...set) + values.length;
    }
    const stopped = StackReification.run(compute, astRegistry);
    if (stopped.exception) throw stopped.exception;
    expect(stopped.currentFrame.lookup('values')).deep.equals([1, 2]);
    expect(stopped.resume()).equals(5);
  });

  it('retains expanded one-shot arguments when a callee suspends', function() {
    function caller() {
      function add(first, second) { debugger; return first + second; }
      return add(...items);
    }
    const items = new Set([2, 3]).values();
    const stopped = StackReification.run(caller, astRegistry, [], {items});
    if (stopped.exception) throw stopped.exception;
    expect(stopped.resume()).equals(5);
    expect(items.next().done).equals(true);
  });

  it('short circuits optional chains, preserves receivers and resumes calls inside chains', function() {
    const effects = {visits: 0};
    function compute() {
      function pause() { effects.visits++; debugger; return {amount: 4}; }
      const receiver = {amount: 2, read() { return this.amount; }};
      const before = receiver?.read?.() ?? 0;
      const absent = null?.[effects.visits++]?.(++effects.visits) ?? 3;
      const amount = ({pause})?.pause()?.amount;
      debugger;
      return before + absent + amount + (null?.missing.x ?? 0);
    }
    const first = StackReification.run(compute, astRegistry, [], {effects});
    if (first.exception) throw first.exception;
    expect(effects.visits).equals(1);
    const second = first.resume();
    if (second.exception) throw second.exception;
    expect(second.isContinuation).equals(true);
    expect(second.currentFrame.lookup('amount')).equals(4);
    expect(second.resume()).equals(9);
    expect(effects.visits).equals(1);
  });

  it('retains supplied closure bindings and receiver through suspend and resume', function() {
    const marker = { count: 0 }, receiver = { step: '1' };
    function increment() {
      var amount = this.step;
      debugger;
      marker.count += amount * factor;
      return marker.count;
    }
    const continuation = StackReification.run(increment, astRegistry, [], {
      this: receiver, marker, factor: 2
    });
    expect(continuation.currentFrame.getThis()).equals(receiver);
    expect(continuation.currentFrame.lookup('marker')).equals(marker);
    expect(continuation.currentFrame.lookup('factor')).equals(2);
    continuation.currentFrame.getScope().set('amount', 1);
    expect(continuation.resume()).equals(2);
    expect(marker.count).equals(2);
  });

  it('records changes to supplied primitive bindings before suspension', function() {
    const compute = Function('factor', 'return function compute() { factor += 1; debugger; return factor; }')(1);
    const mapping = { factor: 1 };
    const continuation = StackReification.run(compute, astRegistry, [], mapping);
    expect(continuation.currentFrame.lookup('factor')).equals(2);
    expect(continuation.resume()).equals(2);
    expect(mapping.factor).equals(2);
    expect(compute()).equals(2);
  });

  it('runs code without halt', function() {
    function code() {
      var x = 2;
      return x + 4;
    }
    var expected = {
      isContinuation: false,
      returnValue: 6
    }

    var runResult = StackReification.run(code);
    expect(runResult).to.eql(expected);
  });

  it('halts in a simple function', function() {
      // Program(12,"function code() { var x = 2; debu...")
      // \---.body[0]:FunctionDeclaration(11,"function code() { var x = 2; debu...")
      //     |---.id:Identifier(0,"code")
      //     \---.body:BlockStatement(10,"{ var x = 2; debugger; ...")
      //         |---.body[0]:VariableDeclaration(4,"var x = 2;")
      //         |   \---.declarations[0]:VariableDeclarator(3,"x = 2")
      //         |       |---.id:Identifier(1,"x")
      //         |       \---.init:Literal(2,"2")
      //         |---.body[1]:DebuggerStatement(5,"debugger;")
      //         \---.body[2]:ReturnStatement(9,"return x + 4;")
      //             \---.argument:BinaryExpression(8,"x + 4")
      //                 |---.left:Identifier(6,"x")
      //                 \---.right:Literal(7,"4")
      function code() {
        var x = 2;
        debugger;
        return x + 4;
      }

      var expected = { isContinuation: true },
          runResult = StackReification.run(code, this.astRegistry);
      expect(runResult.isContinuation).to.be.true;

      // can we access the original ast, needed for resuming?
      var frame = runResult.frames()[0],
          capturedAst = frame.getOriginalAst(),
          generatedAst = parseFunction(String(code));
      generatedAst.type = capturedAst.type;
      expect(stringify(capturedAst)).equals(stringify(generatedAst))
      //expect(capturedAst).to.shallowDeepEqual(generatedAst);

      // where did the execution stop?
      // expect(frame.getPC()).to.equal(5); // pc
      expect(frame.getPC()).to.eql(capturedAst.body.body[1]);
    });

  it('halts in a simple, nested function', function() {
    function code() {
      var x = 1;
      var f = function() {
        debugger;
        return x * 2;
      };
      var y = x + f();
      return y;
    }

    var continuation = StackReification.run(code, this.astRegistry),
        frame1 = continuation.frames()[0],
        frame2 = continuation.frames()[1];
    // frame state
    expect(continuation.frames()).to.have.length(2);
    expect(continuation.currentFrame.lookup('x')).to.equal(1); // val of x
    expect(continuation.currentFrame.lookup('y')).to.be.undefined; // val of y
    expect(continuation.currentFrame.getThis()).to.equal(Global); // val of this

    // captured asts
    var expectedAst = parseFunction('                                                 function() {\n        debugger;\n        return x * 2;\n      }'), // FIXME: should not need all those spaces!
        actualAst = frame1.getOriginalAst();
    expect(stringify(actualAst)).equals(stringify(expectedAst))
    ///expect(actualAst).to.shallowDeepEqual(expectedAst);
    //expect(frame2.getOriginalAst()).to.shallowDeepEqual(parseFunction(String(code)));
    expect(stringify(frame2.getOriginalAst())).equals(stringify(parseFunction(runtimeFunctionSource(code))));

    // access the node where execution stopped
    var resumeNode = frame1.getPC(),
        debuggerNode = actualAst.body.body[0];
    expect(resumeNode, 'resumeNode').to.shallowDeepEqual(debuggerNode);
  });

  it('halts and is able to continue', function() {
    function code() {
      var x = 1;
      debugger;
      return x + 3;
    }

    var continuation = StackReification.run(code, astRegistry),
        result = continuation.resume();
    expect(result).to.equal(4); // resume working
  });

  it('halts in for-loop and is able to continue from there', function() {
    function code() {
      var x = 1;
      for (var i = 0; i < 5; i++) {
        if (i == 3) debugger;
        x += i;
      }
      return x + 3;
    }

    var continuation = StackReification.run(code, astRegistry),
        result = continuation.resume();
    expect(result).to.equal(14); // resume not working
  });


  it('halts in while-loop and is able to continue from there', function() {
    function code() {
      var x = 1, i = 0;
      while (i < 5) {
        if (i == 3) debugger;
        x += i;
        i++;
      }
      return x + 3;
    }

    var continuation = StackReification.run(code, astRegistry),
        result = continuation.resume();
    expect(result).to.equal(14); // resume working
  });

  it('halts in for-in-loop and is able to continue from there', function() {
    function code() {
      var x = 1,
        obj = { a: 1, b: 2, c: 3 };
      for (var i in obj) {
        if (i == 'b') debugger;
        x += obj[i];
      }
      return x + 3;
    }

    var continuation = StackReification.run(code, astRegistry),
        result = continuation.resume();
    expect(result).to.equal(10); // resume working
  });

  it('halts in for-in-loop with member expression and is able to continue from there', function() {
    function code() {
      var x = 1,
        obj = { a: 1, b: 2, c: 3 },
        obj2 = {};
      for (obj2.foo in obj) {
        if (obj2.foo == 'b') debugger;
        x += obj[obj2.foo];
      }
      return x + 3;
    }
    debugger;
    var continuation = StackReification.run(code, astRegistry),
        result = continuation.resume();
    expect(result).to.equal(10); // resume working
  });

  it('halts in inner function and is able to continue from there', function() {
    function code() {
      var x = 1;
      var f = function() {
        debugger;
        return x * 2;
      };
      var y = x + f();
      return y;
    }

    var continuation = StackReification.run(code, astRegistry),
        result = continuation.resume();
    expect(result).to.equal(3); // resume working
  });

  it('halts and continues function that was returned', function() {
    function code() {
      var x = 3;
      return function() {
        debugger;
        return x * 2;
      };
    }

    var continuation = StackReification.run(code, astRegistry),
        func = continuation.returnValue;
    var continuation2 = StackReification.run(func, astRegistry),
        result = continuation2.resume();
    expect(result).to.equal(6); // resume working
  });

  it('halts and continues in inner function that was returned', function() {
    function code() {
      var x = 1;
      function f() { debugger; return x; }
      return (function() { var x = 2; return f(); })();
    }

    var continuation = StackReification.run(code, astRegistry),
        result = continuation.resume();
    expect(result).to.equal(1); // resume working
  });

  it('halts and continues function with multiple nested scopes', function() {
    function code() {
      var x = 1, y = 2;
      function g() { debugger; return x; }
      function f() { var x = 3; return y + g(); }
      return (function() { var x = 2; return f(); })();
    }

    var continuation = StackReification.run(code, astRegistry),
        result = continuation.resume();
    expect(result).to.equal(3); // resume working
  });

  it('halts and continues (native) forEach function', function() {
    function code() {
      var sum = 0;
      [1,2,3].forEach(function(ea) { sum += ea; if (ea === 2) debugger; });
      return sum;
    }
    var continuation = StackReification.run(code, astRegistry);
    var result = continuation.resume();
    expect(result).to.equal(6); // resume working
  });

  it('halts and continues in independent functions', function() {
    var f1 = (function(x) { if (x === 1) debugger; return x + 1; }),
        f2 = function() { return f1(0) + f1(1) + f1(2); };
    if (!f1.livelyDebuggingEnabled)
      f1 = stackCaptureMode(f1, null, astRegistry);

    var continuation = StackReification.run(f2, astRegistry, null, { f1: f1 });
    arr.last(continuation.frames()).scope.set('f1', f1);
    var result = continuation.resume();
    expect(result).to.equal(6); // resume working
  });

  it('halts and continues with multiple debugger breaks', function() {
    function code() {
      var sum = 1; debugger; sum += 2; debugger; sum += 3; return sum;
    }

    var continuation1 = StackReification.run(code, astRegistry),
        continuation2 = continuation1.resume(),
        result = continuation2.resume();
    expect(result).to.equal(6); // 2x resume working
  });

  it('halts and continues with multiple debugger breaks in nested functions', function() {
    function code() {
      var sum = 1; debugger; (function() { sum += 2; debugger; })(); sum += 3; return sum;
    }

    var continuation1 = StackReification.run(code, astRegistry),
        continuation2 = continuation1.resume();
    expect(continuation2.currentFrame.getParentFrame()).not.to.be.null; // nested frame was created
    var result = continuation2.resume();
    expect(result).to.equal(6); // second resume working
  });

  it('halts and interprets arguments in resume', function() {
    function code() {
      var a = arguments[0]; debugger; return a + arguments[1];
    }
    var continuation = StackReification.run(code, astRegistry, [2, 3]),
        result = continuation.resume();
    expect(result).to.equal(5); // accessing arguments not working
  });

  it('halts in try without triggering catch- or finally-block', function() {
    function code() {
      var a = 1;
      try {
        debugger;
      } catch (e) {
        a += 2;
      } finally {
        a += 3;
      }
      return a;
    }
    var continuation = StackReification.run(code, astRegistry);
    expect(continuation.currentFrame.lookup('a')).to.equal(1); // execution of finally block was prevented
    var result = continuation.resume();
    expect(result).to.equal(4); // try-finally was resumed correctly
  });

  it('halts and continues in catch-block', function() {
    function code() {
      var a = 1;
      try {
        throw { b: 2 };
      } catch (e) {
        e.b = 3;
        debugger;
        a += e.b;
      } finally {
        a += 10;
      }
      return a;
    }
    var continuation = StackReification.run(code, astRegistry),
        result = continuation.resume();
    expect(result).to.equal(14); // try-catch resumed in catch
  });

  it('halts and continues in finally-block', function() {
    function code() {
      var a = 1;
      try {
        throw { b: 2 };
      } catch (e) {
        a += e.b;
      } finally {
        debugger;
        a += 3;
      }
      return a;
    }
    var continuation = StackReification.run(code, astRegistry),
        result = continuation.resume();
    expect(result).to.equal(6); // try-catch resumed in finally
  });

  it('halts and continues in catch-block with modified state', function() {
    function code() {
      var a = 1;
      try {
        throw 2;
      } catch (e) {
        e = 3;
        debugger;
        a += e;
      }
      return a;
    }
    var continuation = StackReification.run(code, astRegistry),
        result = continuation.resume();
    expect(result).to.equal(4); // catch variable was correctly captured
  });

  it('halts and continues in catch-block with variable overriding outer scope', function() {
    function code() {
      var e = 1;
      try {
        throw 2;
      } catch (e) {
        debugger;
        e = 3;
      }
      return e;
    }
    var continuation = StackReification.run(code, astRegistry);
    expect(continuation.currentFrame.lookup('e')).to.equal(2); // catch variable was correctly captured
    var result = continuation.resume();
    expect(result).to.equal(1); // overridden catch variable was correctly restored
  });

  it('attaches function declaration to the state of the frame', function() {
    function code() {
      function f() {}
      debugger;
    }

    var continuation = StackReification.run(code, astRegistry),
        frame = continuation.currentFrame,
        func = frame.lookup('f');
    expect(func).to.exist; // FunctionDeclaration f could be found
    expect(func._cachedScopeObject).to.exist; // parentFrameState was correctly attached correctly
  });

  it('can step into a function', function() {
    function code() {
      var x = 2, y = 3;
      function f() {
        var x = 5;
        return x;
      }
      debugger;
      return x + f();
    }

    var continuation = StackReification.run(code, astRegistry),
        frame = continuation.currentFrame,
        interpreter = new Interpreter(),
        ast = frame.getOriginalAst(),
        result;
    expect(frame.lookup('x')).to.equal(2); // initialized x correctly
    expect(frame.lookup('y')).to.equal(3); // initialized y correctly

    result = interpreter.stepToNextStatement(frame); // step over debugger statement
    expect(result && result.toString()).to.equal('Break'); // stopped after debugger
    expect(result.unwindException.top.getPC()).to.eql(ast.body.body[3]); // stopped before return

    result = interpreter.stepToNextCallOrStatement(frame);
    expect(result && result.toString()).to.equal('Break'); // stopped at call
    expect(result.unwindException.top.getPC()).to.eql(ast.body.body[1].body.body[0]); // stepped into f()
    expect(result.unwindException.top.lookup('x')).to.be.undefined; // new scope was created
  });

  it('can step over with debugger statement after halt', function() {
    function code() {
      var x = 2, y = 3;
      function f() {
        var x = 5;
        debugger;
        return x;
      }
      debugger;
      return x + f();
    }

    var continuation = StackReification.run(code, astRegistry),
        frame = continuation.currentFrame,
        interpreter = new Interpreter(),
        ast = frame.getOriginalAst(),
        result;
    expect(frame.lookup('x')).to.equal(2); // initialized x correctly
    expect(frame.lookup('y')).to.equal(3); // initialize y correctly

    result = interpreter.stepToNextStatement(frame); // step over debugger statement
    expect(result && result.toString()).to.equal('Break'); // stopped after debugger
    expect(result.unwindException.top.getPC()).to.eql(ast.body.body[3]); // stopped before return

    result = interpreter.stepToNextStatement(frame); // UnwindException
    expect(result.isUnwindException).to.exist;
    expect(result.top.getPC()).to.eql(ast.body.body[1].body.body[1]); // stopped at debugger in f()
    expect(result.top.getParentFrame()).to.exist; // new frame has parent frame
    expect(result.top.getParentFrame().getPC()).to.eql(ast.body.body[3].argument.right); // parent frame has the right PC
  });

  it('can throw simple error', function() {
    function code() {
      var x = 2;
      throw new Error();
      return x + 4;
    }

    var runResult = StackReification.run(code, astRegistry);
    expect(runResult.exception).instanceOf(Error);
    var frame = runResult.frames()[0];
    expect(runResult.isContinuation).to.exist; // continuation

    var capturedAst = frame.getOriginalAst(),
        generatedAst = parseFunction(String(code));
    generatedAst.type = capturedAst.type;
    expect(stringify(capturedAst)).equals(stringify(generatedAst));
    //expect(capturedAst).to.shallowDeepEqual(generatedAst);
    expect(frame.getPC()).to.eql(capturedAst.body.body[1].argument); // pc
  });

  it('has correct PC after throwing error', function() {
    function code() {
      var e = new Error();
      throw e;
    }

    var continuation = StackReification.run(code, astRegistry), frame = continuation.frames()[0];
    expect(continuation.exception).instanceOf(Error);

    var capturedAst = frame.getOriginalAst();
    expect(capturedAst.body.body[1].astIndex).to.equal(frame.getPC().astIndex); // pc
  });

  it('create nested function findings', function() {
    function code() {
      var createClosure = function(i) {
        return function() { return i; };
      };
      var a = createClosure(2),
          b = createClosure(3);
      return a() + b();
    }
    var expected = {
          isContinuation: false,
          returnValue: 5
        };

    var runResult = StackReification.run(code, astRegistry);
    expect(expected).to.eql(runResult);
  });

  it('halts and continues in switch-statement', function() {
    function code() {
      var a = 1;
      switch (a) {
      case ++a:
        a += 20;
        break
      case 1:
        a++;
        debugger;
        a++;
      default:
        a += 10;
      }
      return a;
    }

    var continuation = StackReification.run(code, astRegistry);
    expect(continuation.currentFrame.getScope().get('a')).to.equal(3); // right value when at debugger
    var result = continuation.resume();
    expect(result).to.equal(14); // switch-case resumed correctly
  });

});
