import * as ast from "lively.ast";
import { obj, promise, arr } from "lively.lang";
import { moduleRecordFor, moduleEnv } from "./system.js";
import { runEval as vmRunEval } from "lively.vm/lib/evaluator.js";
import { recordDoitRequest, recordDoitResult } from "./notify.js";
import "babel-regenerator-runtime";

export { runEval }

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// load support

function ensureImportsAreLoaded(System, code, parentModule) {
  // FIXME do we have to do a reparse? We should be able to get the ast from
  // the rewriter...
  var body = ast.parse(code).body,
      imports = body.filter(node => node.type === "ImportDeclaration");
  return Promise.all(imports.map(node =>
          System.normalize(node.source.value, parentModule)
            .then(fullName => moduleRecordFor(System, fullName) ? undefined : System.import(fullName))))
        .catch(err => { console.error("Error ensuring imports: " + err.message); throw err; });
}


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// transpiler to make es next work

function babelTranspilerForAsyncAwaitCode(System, babel, filename, env) {
  // The function wrapper is needed b/c we need toplevel awaits and babel
  // converts "this" => "undefined" for modules
  return (source, options) => {
    options = Object.assign({
      modules: 'ignore',
      sourceMap: undefined, // 'inline' || true || false
      inputSourceMap: undefined,
      filename: filename,
      code: true,
      ast: false
    }, options);
    var sourceForBabel = `(async function(__rec) {\n${source}\n}).call(this);`,
        transpiled = babel.transform(sourceForBabel, options).code;
    transpiled = transpiled.replace(/\}\)\.call\(undefined\);$/, "}).call(this)");
    return transpiled;
  }
}

function getEs6Transpiler(System, options, env) {
  if (options.transpiler) return Promise.resolve(options.transpiler)
  if (!options.es6Transpile) return Promise.resolve(null);

  if (System.transpiler !== "babel")
    return Promise.reject(
      new Error("Sorry, currently only babel is supported as es6 transpiler for runEval!"));

  return Promise.resolve(System.global[System.transpiler] || System.import(System.transpiler))
    .then(babel => babelTranspilerForAsyncAwaitCode(System, babel, options.targetModule, env));
}


function runEval(System, code, options) {
  options = obj.merge({
    targetModule: null, parentModule: null,
    parentAddress: null,
    es6Transpile: true,
    transpiler: null, // function with params: source, options
    transpilerOptions: null
  }, options);

  var originalCode = code;

  System.debug && console.log(`[lively.module] runEval: ${code.slice(0,100).replace(/\n/mg, " ")}...`);

  return Promise.resolve()
    .then(() => {
      var targetModule = options.targetModule || "*scratch*";
      return System.normalize(targetModule, options.parentModule, options.parentAddress);
    })
    .then((targetModule) => {
      var fullname = options.targetModule = targetModule,
          env = moduleEnv(System, fullname),
          {recorder, recorderName, dontTransform} = env;

      return System.import(fullname)
        .then(() => ensureImportsAreLoaded(System, code, fullname))
        .then(() => getEs6Transpiler(System, options, env))
        .then(transpiler => {
          var header = `var _moduleExport = ${recorderName}._moduleExport,\n`
                     + `    _moduleImport = ${recorderName}._moduleImport;\n`;

          code = header + code;
          options = obj.merge(
            {waitForPromise: true},
            options, {
              recordGlobals: true,
              dontTransform: dontTransform,
              varRecorderName: recorderName,
              topLevelVarRecorder: recorder,
              sourceURL: options.sourceURL || options.targetModule,
              context: options.context || recorder,
              wrapInStartEndCall: true, // for async / await eval support
              es6ExportFuncId: "_moduleExport",
              es6ImportFuncId: "_moduleImport",
              transpiler: transpiler
            });

          System.debug && console.log(`[lively.module] runEval in module ${fullname} started`);

          recordDoitRequest(
            System, originalCode,
            {waitForPromise: options.waitForPromise, targetModule: options.targetModule},
            Date.now());

          return vmRunEval(code, options)
            .then(result => {
              System["__lively.modules__"].evaluationDone(fullname);
              System.debug && console.log(`[lively.module] runEval in module ${targetModule} done`);
              recordDoitResult(
                System, originalCode,
                {waitForPromise: options.waitForPromise, targetModule: options.targetModule},
                result, Date.now());
              return result;
            })
        })
        .catch(err => {
          console.error(`Error in runEval: ${err.stack}`);
          throw err;
        });
    });
}
