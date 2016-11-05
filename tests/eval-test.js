/*global beforeEach, afterEach, describe, it, global*/

import { expect } from "mocha-es6";
import { runEval, syncEval, defaultTopLevelVarRecorderName } from "../index.js";
import lang from "lively.lang";

var Global = typeof global !== "undefined" ? global : window;

describe("evaluation", function() {

  it("syncEval", function() {
    expect(syncEval('1 + 2')).property("value").equals(3);
    expect(syncEval('this.foo + 2;', {context: {foo: 3}})).property("value").equals(5);
    expect(syncEval('throw new Error("foo");'))
      .to.containSubset({isError: true})
      .property("value").matches(/Error.*foo/);
  });

  it("runEval", () =>
    runEval('1+2')
      .then(result => expect(result.value).equal(3))
      .catch(err => expect(false, "got error in runEval " + err)));

  it("runEval promise-rejects on error", () =>
    runEval('throw new Error("foo");')
      .then(result => {
        expect(result).property("isError").to.be.true;
        expect(result).property("value").to.match(/error.*foo/i)
      })
      .catch(err => expect(false, "got error in runEval " + err)))

  it("eval and capture topLevelVars", function() {
    var varMapper = {},
        code = "var x = 3 + 2",
        result = syncEval(code, {topLevelVarRecorder: varMapper});
    expect(result.value).equals(5);
    expect(varMapper.x).equals(5);
  });

  it("eval single expressions", function() {
    var result = syncEval('function() {}');
    expect(result.value).to.be.a("function");
    var result = syncEval('{x: 3}');
    expect(result.value).to.an('object');
    expect(result.value.x).equals(3);
  });

  it("evalCapturedVarsReplaceVarRefs", function() {
    var varMapper = {};
    var code = "var x = 3; var y = foo() + x; function foo() { return x++ }; y";
    var result = syncEval(code, {topLevelVarRecorder: varMapper});

    expect(result.value).equals(7);
    expect(varMapper.x).equals(4);
    expect(varMapper.y).equals(7);
  });

  it("only capture whitelisted globals", function() {
    var varMapper = {y: undefined},
        code = "var x = 3; y = 5; z = 4;";
    syncEval(code, {topLevelVarRecorder: varMapper});

    expect(varMapper.x).equals(3);
    expect(varMapper.y).equals(5);

    expect(!varMapper.hasOwnProperty('z')).equals(true, 'Global "z" was recorded');
    // don't leave globals laying around
    delete Global.z;
  });

  it("dont capture blacklisted", function() {
    var varMapper = {},
      code = "var x = 3, y = 5;";
    syncEval(code, {
      topLevelVarRecorder: varMapper,
      dontTransform: ['y']
    });
    expect(varMapper.x).equals(3);
    expect(!varMapper.hasOwnProperty('y')).equals(true, 'y recorded?');
  });

  it("dont transform var decls in for loop", function() {
    var code = "var sum = 0;\n"
        + "for (var i = 0; i < 5; i ++) { sum += i; }\n"
        + "sum", recorder = {};
    syncEval(code, {topLevelVarRecorder: recorder});
    expect(recorder.sum).equals(10);
  });

  it("eval captured vars replace var refs", function() {
    var code = 'try { throw new Error("foo") } catch (e) { e.message }',
        result = syncEval(code, {topLevelVarRecorder: {}});
    expect(result.value).equals('foo');
  });

  it("dont undefine vars", function() {
    var code = "var x; var y = x + 3;",
        rec = {x: 23};
    syncEval(code, {topLevelVarRecorder: rec});
    expect(rec.y).equals(26);
  });

  it("eval can set source url", function() {
    if ((System.get("@system-env").node)  || navigator.userAgent.match(/PhantomJS/)) {
      console.log("FIXME sourceURL currently only works for web browser");
      return;
    }
    var code = "throw new Error('test');",
        result = syncEval(code, {sourceURL: "my-great-source!"});
    expect(result.value.stack).to.match(
      /at eval.*my-great-source!:1/,
      "stack does not have sourceURL info:\n"
    + lang.string.lines(result.value.stack).slice(0,3).join('\n'));
  });


  describe("promises", () => {

    it("runEval returns promise", () =>
      runEval("3+5").then(result => expect(result).property("value").to.equal(8)));

    var code = "new Promise(function(resolve, reject) { return setTimeout(resolve, 200, 23); });"

    it("run eval waits for promise", () =>
      runEval(code, {waitForPromise: true})
        .then(result => expect(result).to.containSubset({
          isPromise: true, promiseStatus: "fulfilled", promisedValue: 23})));
  });

  describe("printed", () => {

    it("asString", () =>
      runEval("3 + 4", {asString: true})
        .then(printed => expect(printed).to.containSubset({value: "7"})));

    it("inspect", () =>
      runEval("({foo: {bar: {baz: 42}, zork: 'graul'}})", {inspect: true, printDepth: 2})
        .then(printed => expect(printed).to.containSubset({value: "{\n  foo: {\n    bar: {/*...*/},\n    zork: \"graul\"\n  }\n}"})));

    it("prints promises", () =>
      runEval("Promise.resolve(23)", {asString: true})
        .then(printed => expect(printed).to.containSubset({value: 'Promise({status: "fulfilled", value: 23})'})));

  });

  describe("transpiler", () => {

    it("transforms code after lively rewriting", () =>
      runEval("x + 3", {
        topLevelVarRecorder: {x: 2},
        // ".x" will only appear in rewritten code
        transpiler: (source, opts) => source.replace(/\.x/, ".x + 1")
      })
      .then(({value}) => expect(value).to.equal(6)));

  });
});

describe("context recording", () => {

  describe("record free variables", () => {

    it("adds them to var recorder", () => {
      var varMapper = {},
          code = "x = 3 + 2",
          result = syncEval(code, {topLevelVarRecorder: varMapper, recordGlobals: true});
      expect(result).property("value").equals(5);
      expect(varMapper.x).equals(5);
    });

  });

});

describe("wrap in start-end calls", () => {

  var evalCount, evalEndRecordings, varMapper, opts;
  function onStartExecution() { evalCount++; }
  function onEndExecution(err, result) { evalEndRecordings.push({error: err, result: result}); }
  beforeEach(() => {
    evalCount = 0;
    evalEndRecordings = [];
    varMapper = {};
    opts = {
      topLevelVarRecorder: varMapper,
      recordGlobals: true,
      wrapInStartEndCall: true,
      onStartEval: onStartExecution,
      onEndEval: onEndExecution
    }
  });

  describe("async", () => {

    it("calls start and end handlers", () =>
      runEval("var x = 3 + 2", opts).then(result => {
        expect(result).property("value").equals(5);
        expect(varMapper.x).equals(5);
        expect(evalCount).to.equal(1);
        expect(evalEndRecordings).to.have.length(1);
        expect(evalEndRecordings).to.deep.equal([{error: null, result: 5}]);
      }));

    it("works with errors", () =>
      runEval("foo.bar()", opts).then(result => {
        expect(result.isError).equals(true);
        expect(result.value).to.match(/TypeError/);
        expect(evalCount).to.equal(1);
        expect(evalEndRecordings).to.have.length(1);
        expect(evalEndRecordings[0]).to.have.property("error").to.match(/TypeError/);
      }));

  });

  describe("sync", () => {

    it("calls injected function before and after eval, using value of last expression", () => {
      var result = syncEval("var x = 3 + 2", opts);
      expect(result).property("value").equals(5);
      expect(varMapper.x).equals(5);
      expect(evalCount).to.equal(1);
      expect(evalEndRecordings).to.have.length(1);
      expect(evalEndRecordings).to.deep.equal([{error: null, result: 5}]);
    });

    it("works with errors", () => {
      var result = syncEval("foo.bar()", opts);
      expect(result.isError).equals(true);
      expect(result.value).to.match(/TypeError/);
      expect(evalCount).to.equal(1);
      expect(evalEndRecordings).to.have.length(1);
      expect(evalEndRecordings[0]).to.have.property("error").to.match(/TypeError/);
    });
  });

});

describe("runtime", () => {

  it("evaluation uses runtime", () => {
    var runtime = {
      modules: {
        "foo/bar.js": {
          topLevelVarRecorder: {},
          recordGlobals: true
        }
      }
    }

    syncEval("var x = 3 + 2; y = 2", {runtime: runtime, targetModule: "foo/bar.js"});
    expect(runtime.modules["foo/bar.js"].topLevelVarRecorder.x).equals(5);
    expect(runtime.modules["foo/bar.js"].topLevelVarRecorder.y).equals(2);
  });

});

describe("declaration callback", () => {

  it("invokes function when declaration is evaluated", async () => {
    var recordings = [];
    await runEval("var a = 1, b = 'foo'; a = 2", {
      topLevelVarRecorder: {},
      declarationCallback: (name, kind, val, recorder) => recordings.push([name, val])
    });
    expect(recordings).deep.equals([["a", 1], ["b", 'foo'], ["a", 2]])
  });
});

describe("persistent definitions", () => {

  var varMapper, opts;
  beforeEach(() => {
    varMapper = {};
    opts = {topLevelVarRecorder: varMapper}
  });

  describe("primitives", () => {

    it("redefines number, strings, regexp", async () => {
      await runEval("var a = 1, b = '2', c = /foo/", opts);
      await runEval("var a = 2, b = '3', c = /bar/", opts);
      expect(varMapper.a).equals(2, "number");
      expect(varMapper.b).equals('3', "string");
      expect(varMapper.c.test("bar")).equals(true, "regexp");
    });

  });

  xdescribe("objects", () => {

    it("keeps identy", async () => {
      var result1 = await runEval("var x = {y: 23}", opts),
          x1 = varMapper.x;
      expect(result1.value).deep.equals({y: 23});
      expect(x1).deep.equals({y: 23});
      var result2 = await runEval("var x = {y: 24}", opts),
          x2 = varMapper.x;
      expect(result2.value).deep.equals({y: 24}, "eval result");
      expect(x2).deep.equals({y: 24}, "var mapper value");
      expect(x1).equals(x2, "identity");
    });

    it("keeps symbols", async () => {
      var sym = Symbol.for('y'),
          result1 = await runEval("var x = {[Symbol.for('y')]: 23}", opts),
          x1 = varMapper.x;
      expect(result1.value).deep.equals({[sym]: 23});
      expect(x1).deep.equals({[sym]: 23});
      var result2 = await runEval("var x = {[Symbol.for('y')]: 24}", opts),
          x2 = varMapper.x;
      expect(result2.value).deep.equals({[sym]: 24});
      expect(x2).deep.equals({[sym]: 24});
      expect(x1).equals(x2);
    });

    it("keeps identity of generated object", async () => {
      await runEval("var a = (function() { return {x: 23}; })();", opts);
      var a1 = varMapper.a;
      await runEval("var a = (function() { return {x: 24}; })();", opts);
      var a2 = varMapper.a;
      expect(a2).deep.equals({x: 24});
      expect(a2).equals(a1);
    });

    it("copies getters and setters", async () => {
      await runEval("var a = {get x() { return this._x; }, set x(v) { this._x = v; }}; a.x = 3;", opts);
      var a1 = varMapper.a;
      expect(a1.x).equals(3);
      await runEval("var a = {get x() { return this._x; }, set x(v) { this._x = v + 1; }};", opts);
      var a2 = varMapper.a;
      expect(a1).equals(a2);
      expect(a2.x).equals(3);
      a2.x = 4;
      expect(a2.x).equals(5);
    });
  });


  describe("class", () => {

    beforeEach(() =>
      runEval("class Foo {a() { return 1 } get b() { return 2 } static c() { return 3; }}", opts))

    it("keeps identity", async () => {
      var Foo1 = varMapper.Foo;
      await runEval("class Foo {a() { return 2 }}", opts);
      var Foo2 = varMapper.Foo;
      expect(new Foo2().a()).equals(2);
      expect(Foo1).equals(Foo2);
    });

    it("redefines props", async () => {
      await runEval("class Foo {get b() { return 3 }}", opts);
      expect(new varMapper.Foo().b).equals(3);
    });

    it("redefines class side", async () => {
      await runEval("class Foo {static c() { return 4 }}", opts);
      expect(varMapper.Foo.c()).equals(4);
    });

    it("class identical to instance constructor", async () => {
      var isIdentical = (await runEval("class Bar {}; Bar === new Bar().constructor", opts)).value;
      expect(isIdentical).equals(true);
    });

    it("redefines class twice and keeps identity", async () => {
      var isIdentical = (await runEval("class Bar {}; class Bar {}; Bar === new Bar().constructor", opts)).value;
      expect(isIdentical).equals(true);
    });

    it("class methods don't shadow similar named functions in lexical scope", async () => {
      expect(await runEval("function m() {return 3}; class Bar {m() { return m() }}; new Bar().m()", opts))
        .property("value").equals(3);
    });

    it("class is only captured in toplevel scope", async () => {
      await runEval("(function() { class InnerClass {a() { return 2 }} })()", opts);
      expect(varMapper).to.not.have.property("InnerClass");
    });

  });

});