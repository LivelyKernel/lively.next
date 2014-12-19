var isCommonJS = typeof module !== "undefined" && module.require;
var Global = typeof window !== "undefined" ? window : global;
var lang = typeof lively !== "undefined" ? lively.lang : isCommonJS ? module.require("lively.lang") : {};
var ast = typeof lively !== "undefined" && lively.ast ? lively.ast : (isCommonJS ? module.require("lively.ast") : (function() { throw new Error("Cannot find lively.lang") })());
var lv = Global.lively || {};
lv.ast = ast;
lv.lang = lang;

var env = {
  isCommonJS: isCommonJS,
  Global: Global,
  lively: lv
}

lang.obj.extend(isCommonJS ? module.exports : Global, env);
;
/*global module,lively*/

var exports = typeof module !== "undefined" && module.require ? module.exports : (lively.vm = {});
var lang = typeof module !== "undefined" && module.require ? module.require("lively.lang") : lively.lang;
var ast = typeof module !== "undefined" && module.require ? module.require("lively.ast") : lively.ast;

var arr = lang.arr;

lang.obj.extend(exports, {

  transformForVarRecord: function(code, varRecorder, varRecorderName, blacklist, defRangeRecorder) {
    // variable declaration and references in the the source code get
    // transformed so that they are bound to `varRecorderName` aren't local
    // state. THis makes it possible to capture eval results, e.g. for
    // inspection, watching and recording changes, workspace vars, and
    // incrementally evaluating var declarations and having values bound later.
    blacklist = blacklist || [];
    var undeclaredToTransform = lang.arr.withoutAll(Object.keys(varRecorder), blacklist),
        transformed = ast.transform.replaceTopLevelVarDeclAndUsageForCapturing(
          code, {name: varRecorderName, type: "Identifier"},
          {ignoreUndeclaredExcept: undeclaredToTransform,
           exclude: blacklist, recordDefRanges: !!defRangeRecorder});
    code = transformed.source;
    if (defRangeRecorder) lang.obj.extend(defRangeRecorder, transformed.defRanges);
    return code;
  },

  transformSingleExpression: function(code) {
    // evaling certain expressions such as single functions or object
    // literals will fail or not work as intended. When the code being
    // evaluated consists just out of a single expression we will wrap it in
    // parens to allow for those cases
    try {
      var parsed = ast.fuzzyParse(code);
      if (parsed.body.length === 1 &&
         (parsed.body[0].type === 'FunctionDeclaration'
       || parsed.body[0].type === 'BlockStatement')) {
        code = '(' + code.replace(/;\s*$/, '') + ')';
      }
    } catch(e) {
      if (typeof lively && lively.Config && lively.Config.showImprovedJavaScriptEvalErrors) $world.logError(e)
      else console.error("Eval preprocess error: %s", e.stack || e);
    }
    return code;
  },

  evalCodeTransform: function(code, options) {
    var vm = exports,
        recorder = options.topLevelVarRecorder,
        varRecorderName = options.varRecorderName || '__lvVarRecorder';

    if (recorder) code = vm.transformForVarRecord(
      code, recorder, varRecorderName,
      options.dontTransform, options.topLevelDefRangeRecorder);
    code = vm.transformSingleExpression(code);

    if (options.sourceURL) code += "\n//# sourceURL=" + options.sourceURL.replace(/\s/g, "_");

    return code;
  },

  getGlobal: function() {
    return (function() { return this; })();
  },

  _eval: function(__lvEvalStatement, __lvVarRecorder/*needed as arg for capturing*/) {
    return eval(__lvEvalStatement);
  },

  runEval: function (code, options, thenDo) {
    // The main function where all eval options are configured.
    // options can include {
    //   varRecorderName: STRING, // default is '__lvVarRecorder'
    //   topLevelVarRecorder: OBJECT,
    //   context: OBJECT,
    //   sourceURL: STRING
    // }
    if (typeof options === 'function' && arguments.length === 2) {
      thenDo = options; options = {};
    } else if (!options) options = {};

    var vm = exports, result, err,
        context = options.context || vm.getGlobal(),
        recorder = options.topLevelVarRecorder;

    try {
      code = vm.evalCodeTransform(code, options);
      typeof $morph !== "undefined" && $morph('log') && ($morph('log').textString = code);
      result = vm._eval.call(context, code, recorder);
    } catch (e) { err = e; } finally { thenDo(err, result); }
  },

  syncEval: function(string, options) {
    // See #runEval for options.
    // Although the defaul eval is synchronous we assume that the general
    // evaluation might not return immediatelly. This makes is possible to
    // change the evaluation backend, e.g. to be a remotely attached runtime
    var result;
    exports.runEval(string, options, function(e, r) { result = e || r; });
    return result;
  }

});

//# sourceMappingURL=lively.vm.dev.js.map