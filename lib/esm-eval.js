import { parse, nodes } from "lively.ast";
import { emit } from "lively.notifications";

const { funcCall, member, id, literal } = nodes;

import { obj, promise, arr } from "lively.lang";
import { runEval as vmRunEval } from "./eval.js";

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// load support

function ensureImportsAreImported(System, code, parentModule) {
  // FIXME do we have to do a reparse? We should be able to get the ast from
  // the rewriter...
  var body = parse(code).body,
      imports = body.filter(node => node.type === "ImportDeclaration");
  return Promise.all(imports.map(node =>
          System.normalize(node.source.value, parentModule)
            .then(fullName => System.get(fullName) || System.import(fullName))))
        .catch(err => { console.error("Error ensuring imports: " + err.message); throw err; });
}

function hasUnimportedImports(System, code, parentModule) {
  var body = lively.ast.parse(code).body,
      imports = body.filter(node => node.type === "ImportDeclaration"),
      importedModules = arr.uniq(imports.map(ea => ea.source.value)).filter(Boolean),
      unloadedImports = importedModules.filter(ea =>
        !System.get(System.decanonicalize(ea, parentModule)));
  return unloadedImports.length > 0;
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

function getEs6Transpiler(System, options, env) {
  if (options.transpiler) return options.transpiler
  if (!options.es6Transpile) return null;

  if (System.transpiler === "babel") {
    var babel = System.global[System.transpiler]
             || System.get(System.decanonicalize(System.transpiler));

    return babel ?
      babelTranspilerForAsyncAwaitCode(System, babel, options.targetModule, env) :
      System.import(System.transpiler).then(babel =>
        babelTranspilerForAsyncAwaitCode(System, babel, options.targetModule, env));
  }

  if (System.transpiler === "plugin-babel") {
    var babelPluginPath = System.decanonicalize("plugin-babel"),
        babelPath = babelPluginPath
                      .split("/").slice(0, -1)
                      .concat("systemjs-babel-browser.js")
                      .join("/"),
        babelPlugin = System.get(babelPath);

    return babelPlugin ?
      babelPluginTranspilerForAsyncAwaitCode(System, babelPlugin, options.targetModule, env) :
      System.import(babelPath).then(babelPlugin =>
        babelPluginTranspilerForAsyncAwaitCode(System, babelPlugin, options.targetModule, env));
  }

  if (System.transpiler === "lively.transpiler") {
    var Transpiler = System.get(System.decanonicalize("lively.transpiler")).default,
        transpiler = new Transpiler(System, options.targetModule, env);
    return (source, options) => transpiler.transpileDoit(source, options);
  }

  throw new Error("Sorry, currently only babel is supported as es6 transpiler for runEval!");
}


export function runEval(System, code, options) {
  options = {
    targetModule: null, parentModule: null,
    es6Transpile: true,
    transpiler: null, // function with params: source, options
    transpilerOptions: null,
    format: "esm",
    ...options
  }
  var defaultSourceAccessorName = "__lvOriginalCode";
  var originalSource = code;

  System.debug && console.log(`[lively.module] runEval: ${code.slice(0,100).replace(/\n/mg, " ")}...`);

  var {format, targetModule, parentModule} = options;
  targetModule = System.decanonicalize(targetModule || "*scratch*", parentModule);
  options.targetModule = targetModule;

  if (format) {
    var meta = System.getConfig().meta[targetModule];
    if (!meta) meta = {};
    if (!meta[targetModule]) meta[targetModule] = {};
    if (!meta[targetModule].format) {
      meta[targetModule].format = format;
      System.config(meta);
    }
  }

  var module = System.get("@lively-env").moduleEnv(targetModule),
      {recorder, recorderName, dontTransform} = module,
      transpiler = getEs6Transpiler(System, options, module),
      header = `var _moduleExport = ${recorderName}._moduleExport,\n`
             + `    _moduleImport = ${recorderName}._moduleImport;\n`;

  options = {
    waitForPromise: true,
    sync: false,
    evalId: options.evalId || module.nextEvalId(),
    sourceAccessorName:
      (options.hasOwnProperty("embedOriginalCode") ? options.embedOriginalCode : true) ?
        defaultSourceAccessorName : undefined,
    originalSource,
    ...options,
    header,
    recordGlobals: true,
    dontTransform,
    varRecorderName: recorderName,
    topLevelVarRecorder: recorder,
    sourceURL: options.sourceURL || options.targetModule,
    context: options.context || recorder,
    wrapInStartEndCall: true, // for async / await eval support
    es6ExportFuncId: "_moduleExport",
    es6ImportFuncId: "_moduleImport",
    transpiler,
    declarationWrapperName: module.varDefinitionCallbackName,
    currentModuleAccessor: funcCall(
                            member(
                              funcCall(
                                member(member("__lvVarRecorder", "System"), "get"),
                                literal("@lively-env")),
                              "moduleEnv"),
                            literal(options.targetModule))
  };

  // delay eval to ensure imports
  if (!options.sync
   && !options.importsEnsured
   && hasUnimportedImports(System, code, targetModule)) {
    return ensureImportsAreImported(System, code, targetModule)
            .then(() => runEval(System, originalSource, {...options, importsEnsured: true}));
  }

  // delay eval to ensure SystemJS module record
  if (!module.record()) {
    if (!options.sync && !options._moduleImported)
      return System.import(targetModule)
              .catch(err => null)
              .then(() => runEval(System, originalSource, {...options, _moduleImported: true}));

    module.ensureRecord(); // so we can record dependent modules
  }

  // delay eval to ensure transpiler is loaded
  if (options.es6Transpile && options.transpiler instanceof Promise) {
    if (!options.sync && !options._transpilerLoaded) {
      return options.transpiler
              .catch(err => console.error(err))
              .then(transpiler => runEval(System, originalSource,
                {...options, transpiler, _transpilerLoaded: true}));
    } else {
      console.warn(`[lively.vm] sync eval requested but transpiler is not yet loaded, will continue without transpilation!`);
      options.transpiler = null;
    }
  }

  System.debug && console.log(`[lively.module] runEval in module ${targetModule} started`);

  emit("lively.vm/doitrequest", {
    code: originalSource,
    waitForPromise: options.waitForPromise,
    targetModule: options.targetModule
  }, Date.now(), System);

  System.get("@lively-env").evaluationStart(targetModule);

  var result = vmRunEval(code, options);

  return options.sync ?
    evalEnd(System, originalSource, options, result) :
    Promise.resolve(result).then(result => evalEnd(System, originalSource, options, result));
}

function evalEnd(System, code, options, result) {

  System.get("@lively-env").evaluationEnd(options.targetModule);
  System.debug && console.log(`[lively.module] runEval in module ${options.targetModule} done`);

  emit("lively.vm/doitresult", {
    code: code, result,
    waitForPromise: options.waitForPromise,
    targetModule: options.targetModule
  }, Date.now(), System);
  
  return result;
}
