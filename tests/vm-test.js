/*global process, beforeEach, afterEach, describe, it, expect*/

var env = typeof module !== "undefined" && module.require ? module.require("../env") : window;
if (typeof module !== "undefined" && module.require) module.require("./chai-bundle.js");
var lang = env.lively.lang || lively.lang, vm = env.isCommonJS ? require('../index') : lively.vm;

describe('lively.vm', function() {

  describe("JS evaluation", function() {

    it("simpleEval", function() {
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

    it("evalAndCaptureTopLevelVars", function() {
      var varMapper = {};
      var code = "var x = 3 + 2";
      var result = vm.syncEval(code, {topLevelVarRecorder: varMapper});

      expect(result).equals(5);
      expect(varMapper.x).equals(5);
    });

    it("evalSingleExpressions", function() {
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

    it("onlyCaptureWhitelistedGlobals", function() {
      var varMapper = {y: undefined};
      var code = "var x = 3; y = 5; z = 4;";
      var result = vm.syncEval(code, {topLevelVarRecorder: varMapper});

      expect(varMapper.x).equals(3);
      expect(varMapper.y).equals(5);

      expect(!varMapper.hasOwnProperty('z')).to.be.true('Global "z" was recorded');
      // don't leave globals laying around
      vm.syncEval("delete z;", {topLevelVarRecorder: varMapper})
    });

    it("dontCaptureBlacklisted", function() {
      var varMapper = {},
        code = "var x = 3, y = 5;",
        result = vm.syncEval(code, {
          topLevelVarRecorder: varMapper,
          dontTransform: ['y']
        });

      expect(varMapper.x).equals(3);
      expect(!varMapper.hasOwnProperty('y')).to.be.true('y recorded?');

    });

    it("dontTransformVarDeclsInForLoop", function() {
      var code = "var sum = 0;\n"
           + "for (var i = 0; i < 5; i ++) { sum += i; }\n"
           + "sum"
      var recorder = {};
      var result = vm.syncEval(code, {topLevelVarRecorder: recorder});
      expect(recorder.sum).equals(10);

    });

    it("dontTransformCatchClause", function() {
      var code = 'try { throw new Error("foo") } catch (e) { e.message }'
      var result = vm.syncEval(code, {topLevelVarRecorder: {}});
      expect(result).equals('foo');

    });

    it("captureDefRanges", function() {
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

    it("dontUndefineVars", function() {
      var code = "var x; var y = x + 3;";
      var rec = {x: 23};
      vm.syncEval(code, {topLevelVarRecorder: rec});
      expect(rec.y).equals(26);

    });

    it("evalCanSetSourceURL", function() {
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

  });

  describe("LivelyCompat", function() {

    it("addScriptWithVarMapping", function() {
      var Global = typeof window !== "undefined" ? window : global;
      Global.fun = (lang || lively.lang).fun;
      var src = "var obj = {c: 3};\n"
          + "lively.lang.fun.asScriptOf(function(a) { return a + b + this.c; }, obj, 'm', {b: 2});\n"
          + "obj.m(1);\n";
      delete Global.fun;

      var result1 = vm.syncEval(src);
      expect(result1).equals(6, 'simple eval not working');

      var result2 = vm.syncEval(src, {topLevelVarRecorder: varMapper});
      var varMapper = {};
      expect(result2).equals(6, 'capturing eval not working');

      expect(Object.keys(varMapper).length).equals(0, 'varMApper captured stuff');
    });

  });

});
