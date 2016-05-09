import * as ast from "lively.ast";
import { obj } from "lively.lang";
import { moduleRecordFor, moduleEnv } from "./system.js";
import * as evaluator from "lively.vm/lib/evaluator.js";
import { recordDoitRequest, recordDoitResult } from "./notify.js";

export { runEval }

function ensureImportsAreLoaded(System, code, parentModule) {
  var body = ast.parse(code).body,
      imports = body.filter(node => node.type === "ImportDeclaration");
  return Promise.all(imports.map(node =>
          System.normalize(node.source.value, parentModule)
            .then(fullName => moduleRecordFor(System, fullName) ? undefined : System.import(fullName))))
        .catch(err => { console.error("Error ensuring imports: " + err.message); throw err; });
}


function runEval(System, code, options) {
  options = obj.merge({
    targetModule: null, parentModule: null,
    parentAddress: null
  }, options);

  var originalCode = code;

  return Promise.resolve()
    .then(() => {
      var targetModule = options.targetModule || "*scratch*";
      return System.normalize(targetModule, options.parentModule, options.parentAddress);
    })
    .then((targetModule) => {
      var fullname = options.targetModule = targetModule;

      // throw new Error(`Cannot load module ${options.targetModule} (tried as ${fullName})\noriginal load error: ${e.stack}`)

      return System.import(fullname)
        .then(() => ensureImportsAreLoaded(System, code, fullname))
        .then(() => {
          var env = moduleEnv(System, fullname),
              rec = env.recorder,
              recName = env.recorderName,
              header = `var _moduleExport = ${recName}._moduleExport,\n`
                     + `    _moduleImport = ${recName}._moduleImport;\n`;

          code = header + code;

          options = obj.merge(
            {waitForPromise: true},
            options, {
              recordGlobals: true,
              dontTransform: env.dontTransform,
              varRecorderName: recName,
              topLevelVarRecorder: rec,
              sourceURL: options.sourceURL || options.targetModule,
              context: rec,
              es6ExportFuncId: "_moduleExport",
              es6ImportFuncId: "_moduleImport",
              // header: header
            });

          // clearPendingModuleExportChanges(fullname);
          recordDoitRequest(System, originalCode, options, Date.now());

          return evaluator.runEval(code, options).then(result => {
            System["__lively.modules__"].evaluationDone(fullname);
            recordDoitResult(System, originalCode, options, result, Date.now());
            return result;
          })
        })
        // .catch(err => console.error(err) || err)
    });
}
