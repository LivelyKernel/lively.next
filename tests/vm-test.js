/*global beforeEach, afterEach, describe, it, global*/

import { expect } from "mocha-es6";
import * as vm from "lively.vm";
import lang from "lively.lang";

var Global = typeof global !== "undefined" ? global : window;

describe("evaluation", function() {

  it("syncEval", function() {
    expect(vm.syncEval('1 + 2')).property("value").equals(3);
    expect(vm.syncEval('this.foo + 2;', {context: {foo: 3}})).property("value").equals(5);
    expect(vm.syncEval('throw new Error("foo");'))
      .to.containSubset({isError: true})
      .property("value").matches(/Error.*foo/);
  });

  it("runEval", () =>
    vm.runEval('1+2')
      .then(result => expect(result.value).equal(3))
      .catch(err => expect(false, "got error in runEval " + err)));

  it("runEval promise-rejects on error", () =>
    vm.runEval('throw new Error("foo");')
      .then(result => {
        expect(result).property("isError").to.be.true;
        expect(result).property("value").to.match(/error.*foo/i)
      })
      .catch(err => expect(false, "got error in runEval " + err)))

  it("eval and capture topLevelVars", function() {
    var varMapper = {},
        code = "var x = 3 + 2",
        result = vm.syncEval(code, {topLevelVarRecorder: varMapper});
    expect(result.value).equals(5);
    expect(varMapper.x).equals(5);
  });

  it("eval single expressions", function() {
    var result = vm.syncEval('function() {}');
    expect(result.value).to.be.a("function");
    var result = vm.syncEval('{x: 3}');
    expect(result.value).to.an('object');
    expect(result.value.x).equals(3);
  });

  it("evalCapturedVarsReplaceVarRefs", function() {
    var varMapper = {};
    var code = "var x = 3; var y = foo() + x; function foo() { return x++ }; y";
    var result = vm.syncEval(code, {topLevelVarRecorder: varMapper});

    expect(result.value).equals(7);
    expect(varMapper.x).equals(4);
    expect(varMapper.y).equals(7);
  });

  it("only capture whitelisted globals", function() {
    var varMapper = {y: undefined},
        code = "var x = 3; y = 5; z = 4;";
    vm.syncEval(code, {topLevelVarRecorder: varMapper});

    expect(varMapper.x).equals(3);
    expect(varMapper.y).equals(5);

    expect(!varMapper.hasOwnProperty('z')).equals(true, 'Global "z" was recorded');
    // don't leave globals laying around
    delete Global.z;
  });

  it("dont capture blacklisted", function() {
    var varMapper = {},
      code = "var x = 3, y = 5;";
    vm.syncEval(code, {
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
    vm.syncEval(code, {topLevelVarRecorder: recorder});
    expect(recorder.sum).equals(10);
  });

  it("eval captured vars replace var refs", function() {
    var code = 'try { throw new Error("foo") } catch (e) { e.message }',
        result = vm.syncEval(code, {topLevelVarRecorder: {}});
    expect(result.value).equals('foo');
  });

  it("capture def ranges", function() {
    var code = "var y = 1, x = 2;\nvar y = 3; z = 4; baz(x, y, z); function baz(a,b,c) {}",
        expectedValues = {baz: function baz(a,b,c) {}, y: 3, x: 2},
        expectedRanges = {
          baz: [{end: 72, start: 50, type: "FunctionDeclaration"}],
            x: [{end: 16, start: 11, type: "VariableDeclarator"}],
            y: [{end: 9, start: 4, type: "VariableDeclarator"},
                {end: 27, start: 22, type: "VariableDeclarator"}]},
          rec = {}, rangeRecorder = {};
    vm.syncEval(code, {topLevelVarRecorder: rec, topLevelDefRangeRecorder: rangeRecorder});
    expect(lang.obj.inspect(rangeRecorder)).equals(lang.obj.inspect(expectedRanges));
    expect(lang.obj.inspect(rec)).equals(lang.obj.inspect(expectedValues));
    // don't leave globals laying around
    delete Global.z;
  });

  it("dont undefine vars", function() {
    var code = "var x; var y = x + 3;",
        rec = {x: 23};
    vm.syncEval(code, {topLevelVarRecorder: rec});
    expect(rec.y).equals(26);
  });

  it("eval can set source url", function() {
    if ((System.get("@system-env").node)  || navigator.userAgent.match(/PhantomJS/)) {
      console.log("FIXME sourceURL currently only works for web browser");
      return;
    }
    var code = "throw new Error('test');",
        result = vm.syncEval(code, {sourceURL: "my-great-source!"});
    expect(result.value.stack).to.match(
      /at eval.*my-great-source!:1/,
      "stack does not have sourceURL info:\n"
    + lang.string.lines(result.value.stack).slice(0,3).join('\n'));
  });


  describe("promises", () => {

    it("runEval returns promise", () => 
      vm.runEval("3+5").then(result => expect(result).property("value").to.equal(8)));

    var code = "new Promise(function(resolve, reject) { return setTimeout(resolve, 200, 23); });"

    it("run eval waits for promise", () =>
      vm.runEval(code, {waitForPromise: true})
        .then(result => expect(result).to.containSubset({
          isPromise: true, promiseStatus: "fulfilled", promisedValue: 23})));
  });

  describe("printed", () => {

    it("asString", () =>
      vm.runEval("3 + 4", {asString: true})
        .then(printed => expect(printed).to.containSubset({value: "7"})));

    it("inspect", () =>
      vm.runEval("({foo: {bar: {baz: 42}, zork: 'graul'}})", {inspect: true, printDepth: 2})
        .then(printed => expect(printed).to.containSubset({value: "{\n  foo: {\n    bar: {/*...*/},\n    zork: \"graul\"\n  }\n}"})));

    it("prints promises", () =>
      vm.runEval("Promise.resolve(23)", {asString: true})
        .then(printed => expect(printed).to.containSubset({value: 'Promise({status: "fulfilled", value: 23})'})));

  });
});

describe("context recording", () => {

  describe("record free variables", () => {

    it("adds them to var recorder", () => {
      var varMapper = {},
          code = "x = 3 + 2",
          result = vm.syncEval(code, {topLevelVarRecorder: varMapper, recordGlobals: true});
      expect(result).property("value").equals(5);
      expect(varMapper.x).equals(5);
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

    vm.syncEval("var x = 3 + 2; y = 2", {runtime: runtime, targetModule: "foo/bar.js"});
    expect(runtime.modules["foo/bar.js"].topLevelVarRecorder.x).equals(5);
    expect(runtime.modules["foo/bar.js"].topLevelVarRecorder.y).equals(2);
  });

});
