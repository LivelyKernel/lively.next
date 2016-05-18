import * as ast from "lively.ast";
import { obj, promise, arr } from "lively.lang";
import { moduleRecordFor, moduleEnv } from "./system.js";
import { runEval as realRunEval, EvalResult } from "lively.vm/lib/evaluator.js";
import { recordDoitRequest, recordDoitResult } from "./notify.js";
import "babel-regenerator-runtime";

var { exprStmt, member, funcCall, returnStmt, id, tryStmt, program } = ast.nodes;

export { runEvalWithAsyncSupport as runEval }

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

  System.debug && console.log(`[lively.module] runEval: ${code.slice(0,100).replace(/\n/mg, " ")}...`);

  return Promise.resolve()
    .then(() => {
      var targetModule = options.targetModule || "*scratch*";
      return System.normalize(targetModule, options.parentModule, options.parentAddress);
    })
    .then((targetModule) => {
      var fullname = options.targetModule = targetModule;
      System.debug && console.log(`[lively.module] runEval in module ${targetModule} started`);

      return System.import(fullname)
        .then(() => ensureImportsAreLoaded(System, code, fullname))
        .then(() => {
          var {recorder, recorderName, dontTransform} = moduleEnv(System, fullname),
              header = `var _moduleExport = ${recorderName}._moduleExport,\n`
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
              es6ExportFuncId: "_moduleExport",
              es6ImportFuncId: "_moduleImport"
            });

          recordDoitRequest(
            System, originalCode,
            {waitForPromise: options.waitForPromise, targetModule: options.targetModule},
            Date.now());

          return realRunEval(code, options).then(result => {
            System.debug && console.log(`[lively.module] runEval in module ${targetModule} done`);
            System["__lively.modules__"].evaluationDone(fullname);
            recordDoitResult(
              System, originalCode,
              {waitForPromise: options.waitForPromise, targetModule: options.targetModule},
              result, Date.now());
            return result;
          })
        })
    });
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-


function babelTranspile(babel, filename, env, source, options) {
  options = Object.assign({
    modules: 'ignore',
    sourceMap: undefined, // 'inline' || true || false
    inputSourceMap: undefined,
    filename: filename,
    code: true,
    ast: false
  }, options);
  return babel.transform(source, options).code;
}


function interactiveAsyncAwaitTranspile(babel, filename, env, source, options) {

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // FIXME this needs to go somehwere else
  Object.assign(env, {
    currentEval: {status: "not running"} // promise holder
  });

  Object.assign(env.recorder, {
    'lively.modules-start-eval'() {
      env.currentEval = promise.deferred();
      env.currentEval.status = "running";
    },
    'lively.modules-end-eval'(value) {
      var result = new EvalResult();
      result.value = value
      env.currentEval.status = "not running";
      env.currentEval.resolve(result);
    }
  });



  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // source is already rewritten for capturing
  // await isn't allowed top level so we wrap the code in an async function...
  // var src = "async () => { await (await foo()).bar(); }";

  var parsed = ast.parse(source),
      funcDecls = ast.query.topLevelFuncDecls(parsed),
      innerBody = parsed.body,
      outerBody = [],
      startEval = member(env.recorderName, 'lively.modules-start-eval'),
      endEval = member(env.recorderName, 'lively.modules-end-eval', true),
      initializer = exprStmt(funcCall(startEval)),
      transformedSource;
  funcDecls.forEach(({node, path}) => {
    lively.lang.Path(path).set(parsed, exprStmt(node.id));
    // lively.lang.Path(path.slice(1)).set(innerBody, expr(node.id));
    outerBody.push(node);
  });

  innerBody.unshift(initializer);
  var last = arr.last(innerBody);
  if (last.type === "ExpressionStatement") {
    var finalizer = returnStmt(funcCall(endEval, last.expression));
    innerBody.splice(innerBody.length-1, 1, finalizer)
  } else {
    var finalizer = returnStmt(funcCall(endEval, id("undefined")));
    innerBody.push(finalizer);
  }

  outerBody.push(tryStmt("err", [returnStmt(funcCall(endEval, id("err")))], ...innerBody));

  transformedSource = ast.stringify(program(...outerBody));

  // The function wrapper is needed b/c we need toplevel awaits and babel
  // converts "this" => "undefined" for modules
  var sourceForBabel = `(async function(__rec) {\n${transformedSource}\n}).call(this);`;
  return babelTranspile(babel, filename, env, sourceForBabel, options)
          .replace(/\}\)\.call\(undefined\);$/, "}).call(this)");
}

function ensureEs6Transpiler(System, moduleId, env) {
  if (System.transpiler !== "babel")
    return Promise.reject(new Error("Sorry, currently only babel is supported as es6 transpiler for runEval!"));

  return Promise.resolve(System.global[System.transpiler] || System.import(System.transpiler))
    .then(transpiler => {
      // if (System.transpiler === "babel") return babelTranspile.bind(System.global, transpiler, moduleId, env);
      if (System.transpiler === "babel") return interactiveAsyncAwaitTranspile.bind(System.global, transpiler, moduleId, env);
      return null;
    })
}


function runEvalWithAsyncSupport(System, code, options) {
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
        .then(() => options.transpiler ?
                      options.transpiler :
                      options.es6Transpile ? ensureEs6Transpiler(System, options.targetModule, env) : null)
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
              es6ExportFuncId: "_moduleExport",
              es6ImportFuncId: "_moduleImport",
              transpiler: transpiler
            });

          System.debug && console.log(`[lively.module] runEval in module ${fullname} started`);

          recordDoitRequest(
            System, originalCode,
            {waitForPromise: options.waitForPromise, targetModule: options.targetModule},
            Date.now());
          return realRunEval(code, options)
            .then(result =>
              result.isError || !env.currentEval.promise ?
                result :
                env.currentEval.promise.then(result => {
                  return result.process(options).then(() => result);
                }))
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
        })
    });
}
