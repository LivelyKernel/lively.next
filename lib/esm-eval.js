import { parse, nodes } from "lively.ast";
import { emit } from "lively.notifications";

var {funcCall, member, id, literal } = nodes;

import { obj, promise, arr } from "lively.lang";
import { runEval as vmRunEval } from "./eval.js";
// import { moduleEnv } from "lively.modules/src/system.js";
// import { recordDoitRequest, recordDoitResult } from "lively.modules/src/notify.js";

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// load support

async function ensureImportsAreLoaded(System, code, parentModule) {
  // FIXME do we have to do a reparse? We should be able to get the ast from
  // the rewriter...
  var body = parse(code).body,
      imports = body.filter(node => node.type === "ImportDeclaration");
  return Promise.all(imports.map(node =>
          System.normalize(node.source.value, parentModule)
            .then(fullName => System.get(fullName) || System.import(fullName))))
        .catch(err => { console.error("Error ensuring imports: " + err.message); throw err; });
}


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// transpiler to make es next work

function babelTranspilerForAsyncAwaitCode(System, babel, filename, env) {
  // The function wrapper is needed b/c we need toplevel awaits and babel
  // converts "this" => "undefined" for modules
  return (source, options) => {
    options = Object.assign({
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

function babelPluginTranspilerForAsyncAwaitCode(System, babelWrapper, filename, env) {

  // The function wrapper is needed b/c we need toplevel awaits and babel
  // converts "this" => "undefined" for modules
  return (source, options) => {
    var babelOptions = System.babelOptions || {},
        presets = [];
    presets.push(babelWrapper.presetES2015)
    if (babelOptions.stage3)
      presets.push({plugins: babelWrapper.pluginsStage3});
    if (babelOptions.stage2)
      presets.push({plugins: babelWrapper.pluginsStage2});
    if (babelOptions.stage1)
      presets.push({plugins: babelWrapper.pluginsStage1});

    options = Object.assign({
      sourceMap: undefined, // 'inline' || true || false
      inputSourceMap: undefined,
      filename: filename,
      babelrc: false,
      // plugins: plugins,
      presets: presets,
      moduleIds: false,
      code: true,
      ast: false
    }, options);
    var sourceForBabel = `(async function(__rec) {\n${source}\n}).call(this);`,
        transpiled = babelWrapper.babel.transform(sourceForBabel, options).code;
    transpiled = transpiled.replace(/\}\)\.call\(undefined\);$/, "}).call(this)");
    return transpiled;
  }

}

async function getEs6Transpiler(System, options, env) {
  if (options.transpiler) return Promise.resolve(options.transpiler)
  if (!options.es6Transpile) return Promise.resolve(null);

  if (System.transpiler === "babel") {
    var babel = System.global[System.transpiler] || await System.import(System.transpiler);
    return babelTranspilerForAsyncAwaitCode(System, babel, options.targetModule, env);
  }

  if (System.transpiler === "plugin-babel") {
    var babelPluginPath = await System.normalize("plugin-babel");
    var babelPath = babelPluginPath.split("/").slice(0, -1).concat("systemjs-babel-browser.js").join("/");
    var babelPlugin = await System.import(babelPath)
    return babelPluginTranspilerForAsyncAwaitCode(System, babelPlugin, options.targetModule, env);
  }

  throw new Error("Sorry, currently only babel is supported as es6 transpiler for runEval!");
}


export async function runEval(System, code, options) {
  options = obj.merge({
    targetModule: null, parentModule: null,
    parentAddress: null,
    es6Transpile: true,
    transpiler: null, // function with params: source, options
    transpilerOptions: null
  }, options);
  var originalCode = code;

  System.debug && console.log(`[lively.module] runEval: ${code.slice(0,100).replace(/\n/mg, " ")}...`);

  var fullname = await System.normalize(
    options.targetModule || "*scratch*",
    options.parentModule, options.parentAddress);
  options.targetModule = fullname;

  await System.import(fullname);
  await ensureImportsAreLoaded(System, code, fullname);

  var env = System.get("@lively-env").moduleEnv(fullname),
      {recorder, recorderName, dontTransform} = env,
      transpiler = await getEs6Transpiler(System, options, env),
      header = `var _moduleExport = ${recorderName}._moduleExport,\n`
             + `    _moduleImport = ${recorderName}._moduleImport;\n`;

  code = header + code;
  options = Object.assign(
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
      transpiler: transpiler,
      currentModuleAccessor: funcCall(
                              member(
                                funcCall(member("System", "get"), literal("@lively-env")),
                                "moduleEnv"),
                              literal(options.targetModule))
    });

  System.debug && console.log(`[lively.module] runEval in module ${fullname} started`);
  
  console.log("emitted");
  emit("lively.vm/doitrequest", {
    code: originalCode,
    waitForPromise: options.waitForPromise,
    targetModule: options.targetModule}, Date.now(), System);

  var result = await vmRunEval(code, options);

  System.get("@lively-env").evaluationDone(fullname);
  System.debug && console.log(`[lively.module] runEval in module ${fullname} done`);

  emit("lively.vm/doitresult", {
    code: originalCode, result,
    waitForPromise: options.waitForPromise,
    targetModule: options.targetModule}, Date.now(), System);

  return result;

}
