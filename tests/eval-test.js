/*global beforeEach, afterEach, describe, it, global*/

import { expect } from "mocha-es6";
import { runEval, syncEval, defaultTopLevelVarRecorderName } from "../lib/eval.js";
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
