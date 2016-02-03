/*global process, beforeEach, afterEach, describe, it, expect*/

var env = typeof module !== "undefined" && module.require ? module.require("../env") : window;
var chai = env.isCommonJS ? module.require("chai") : window.chai;
var chaiSubset = env.isCommonJS ? module.require("chai-subset") : window.chaiSubset;
var expect = chai.expect; chaiSubset && chai.use(chaiSubset);
var lang = env.lively.lang || lively.lang, vm = env.isCommonJS ? require('../index') : lively.vm;
var Global = env.Global;

describe("evaluation", function() {

  it("simple eval", function() {
    expect(vm.syncEval('1 + 2')).equals(3);
    expect(vm.syncEval('this.foo + 2;', {context: {foo: 3}})).equals(5);
    expect(vm.syncEval('throw new Error("foo");')).to.containSubset({message: "foo"});

    var result = null;
    vm.runEval('1+2', function(_, r) { result = r; })
    expect(result).to.containSubset(3);

    var result = null;
    vm.runEval('throw new Error("foo");', function(err, _e) { result = err; })
    expect(result).to.containSubset({message: 'foo'});
  });

  it("eval and capture topLevelVars", function() {
    var varMapper = {};
    var code = "var x = 3 + 2";
    var result = vm.syncEval(code, {topLevelVarRecorder: varMapper});

    expect(result).equals(5);
    expect(varMapper.x).equals(5);
  });

  it("eval single expressions", function() {
    var result = vm.syncEval('function() {}');
    expect(result).to.be.a("function");
    var result = vm.syncEval('{x: 3}');
    expect(result).to.an('object');
    expect(result.x).equals(3);
  });

  it("evalCapturedVarsReplaceVarRefs", function() {
    var varMapper = {};
    var code = "var x = 3; var y = foo() + x; function foo() { return x++ }; y";
    var result = vm.syncEval(code, {topLevelVarRecorder: varMapper});

    expect(result).equals(7);
    expect(varMapper.x).equals(4);
    expect(varMapper.y).equals(7);
  });

  it("only capture whitelisted globals", function() {
    var varMapper = {y: undefined};
    var code = "var x = 3; y = 5; z = 4;";
    var result = vm.syncEval(code, {topLevelVarRecorder: varMapper});

    expect(varMapper.x).equals(3);
    expect(varMapper.y).equals(5);

    expect(!varMapper.hasOwnProperty('z')).equals(true, 'Global "z" was recorded');
    // don't leave globals laying around
    delete Global.z;
  });

  it("dont capture blacklisted", function() {
    var varMapper = {},
      code = "var x = 3, y = 5;",
      result = vm.syncEval(code, {
        topLevelVarRecorder: varMapper,
        dontTransform: ['y']
      });

    expect(varMapper.x).equals(3);
    expect(!varMapper.hasOwnProperty('y')).equals(true, 'y recorded?');

  });

  it("dont transform var decls in for loop", function() {
    var code = "var sum = 0;\n"
        + "for (var i = 0; i < 5; i ++) { sum += i; }\n"
        + "sum"
    var recorder = {};
    var result = vm.syncEval(code, {topLevelVarRecorder: recorder});
    expect(recorder.sum).equals(10);
  });

  it("eval captured vars replace var refs", function() {
    var code = 'try { throw new Error("foo") } catch (e) { e.message }'
    var result = vm.syncEval(code, {topLevelVarRecorder: {}});
    expect(result).equals('foo');
  });

  it("capture def ranges", function() {
    var code   = "var y = 1, x = 2;\nvar y = 3; z = 4; baz(x, y, z); function baz(a,b,c) {}",
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
    vm.syncEval("delete z;", {topLevelVarRecorder: rec, topLevelDefRangeRecorder: rangeRecorder})
  });

  it("dont undefine vars", function() {
    var code = "var x; var y = x + 3;";
    var rec = {x: 23};
    vm.syncEval(code, {topLevelVarRecorder: rec});
    expect(rec.y).equals(26);
  });

  it("eval can set source url", function() {
    if ((typeof module !== "undefined" && module.require)  || navigator.userAgent.match(/PhantomJS/)) {
      console.log("FIXME sourceURL currently only works for web browser");
      return;
    }
    var code = "throw new Error('test');";
    var err = vm.syncEval(code, {sourceURL: "my-great-source!"});
    expect(err.stack).to.match(
      /at eval.*my-great-source!:1/,
      "stack does not have sourceURL info:\n"
    + lang.string.lines(err.stack).slice(0,3).join('\n'));
  });


  describe("promises", () => {

    it("runEval returns promise", () => 
      vm.runEval("3+5").then(val => expect(val).to.equal(8)));

    var code = "new Promise((resolve, reject) => setTimeout(() => resolve(23), 200));";

    it("sync eval onPromiseResolved", done => {
      var val, p = vm.syncEval(code, {
        onPromiseResolved: (err, _val) => val = _val,
        promiseTimeout: 400
      });
      setTimeout(() => { expect(val).to.equal(23); done(); }, 400);
    });

    it("run eval waits for promise", () =>
      vm.runEval(code, {waitForPromise: true})
        .then(val => expect(val).to.equal(23)));
  });

});

describe("context recording", () => {

  describe("record free variables", () => {

    it("adds them to var recorder", () => {
      var varMapper = {},
          code = "x = 3 + 2",
          result = vm.syncEval(code, {topLevelVarRecorder: varMapper, recordGlobals: true});
      expect(result).equals(5);
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

    vm.syncEval("var x = 3 + 2; y = 2", {runtime: runtime, currentModule: "foo/bar.js"});
    expect(runtime.modules["foo/bar.js"].topLevelVarRecorder.x).equals(5);
    expect(runtime.modules["foo/bar.js"].topLevelVarRecorder.y).equals(2);
  });

});
