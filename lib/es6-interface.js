/*global process, require, global, __dirname*/

var lang = require("lively.lang");

var evaluator = require("./evaluator");
var System = require("systemjs");

(function setupSystemjs() {
  System.config({transpiler: 'babel', babelOptions: {}});
  System.trace = true;
  System.__defineGetter__("__lively_vm__", () => require(__filename));
})();

var loadedModules = loadedModules || {},
    exceptions = [
      id => id.indexOf("lively.vm/node_modules") > -1
    ];

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// loading
function importES6Module(path, options) {
  if (typeof options !== "undefined")
    System.config(options);
  return System.import(path);
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// module environment + runtime state
function instrumentedFiles() { return Object.keys(loadedModules); }
function isLoaded(fullname) { return fullname in loadedModules; }

function resolve(name, parentName, parentAddress) {
  return System.normalizeSync(name, parentName, parentAddress);
}

function envFor(fullname) {
  if (loadedModules[fullname]) return loadedModules[fullname];
  var env = loadedModules[fullname] = {
    isInstrumented: false,
    loadError: undefined,
    recorderName: "__state_recorder__",
    dontTransform: ["__state_recorder__", "global", "System", "__lvVarRecorder"],
    recorder: Object.create(global)
  }
  return env;
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// code instrumentation

function prepareCodeForCustomCompile(source, fullname, env) {
  source = String(source);
  var tfmOptions = {
        topLevelVarRecorder: env.recorder,
        varRecorderName: env.recorderName,
        dontTransform: env.dontTransform,
        recordGlobals: true
      },
      header = `var ${env.recorderName} = System.__lively_vm__.envFor("${fullname}").recorder;\n`;

  try {
    return header + evaluator.evalCodeTransform(source, tfmOptions);
  } catch (e) {
    console.error("Error in prepareCodeForCustomCompile", e.stack);
    return source;
  }
}

function customTranslate(proceed, load) {
  // load like
  // {
  //   address: "file:///Users/robert/Lively/lively-dev/lively.vm/tests/test-resources/some-es6-module.js",
  //   name: "file:///Users/robert/Lively/lively-dev/lively.vm/tests/test-resources/some-es6-module.js",
  //   metadata: { deps: [/*...*/], entry: {/*...*/}, format: "esm", sourceMap: ... },
  //   source: "..."
  // }

  if (exceptions.some(exc => exc(load.name))) {
    console.log("[lively.vm es6 customTranslate ignoring] %s", load.name);
    return proceed(load);
    // return Promise.resolve(load);
    // return System.origTranslate.call(System, load);
  }

  console.log("[lively.vm es6 customTranslate] %s", load.name);
  load.source = prepareCodeForCustomCompile(load.source, load.name, envFor(load.name));
  return proceed(load);
}

function wrapModuleLoad() {
  if (!System.origTranslate) {
    System.origTranslate = System.translate
    System.translate = function(load) {
      return customTranslate(System.origTranslate.bind(System), load);
    }
  }
}

function unwrapModuleLoad() {
  System.translate = System.origTranslate;
  delete System.origTranslate;
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// evaluation

function runEval(code, options) {

  options = lang.obj.merge({targetModule: null, parentModule: null, parentAddress: null, printed: null}, options);
  return Promise.resolve().then(() => {
    // if (!options.targetModule) return reject(new Error("options.targetModule not defined"));
    if (!options.targetModule) {
      options.targetModule = "*scratch*";
    } else {
      options.targetModule = resolve(options.targetModule, options.parentModule, options.parentAddress);
    }

    var fullname = resolve(options.targetModule);
    
    return importES6Module(fullname)
        // throw new Error(`Cannot load module ${options.targetModule} (tried as ${fullName})\noriginal load error: ${e.stack}`)
      .then((m) => {
        var env = envFor(fullname),
            rec = env.recorder,
            recName = env.recorderName;
        options = lang.obj.merge(
          {waitForPromise: true},
          options, {
            recordGlobals: true,
            dontTransform: env.dontTransform,
            varRecorderName: recName,
            topLevelVarRecorder: rec,
            sourceURL: options.targetModule,
            context: m
          });

        code = `var ${env.recorderName} = __lvVarRecorder;\n${code}`;

        return evaluator.runEval(code, options);
      })
      .then(result => {
        // if (options.printed) result.value = printResult(result, options.printed);
        // if (options.printed) result.value = String(result.value);
        return result;
      });
      // .catch(err => console.error(err) || err)
  });
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

module.exports = {
  import: importES6Module,
  config: System.config.bind(System),

  wrapModuleLoad: wrapModuleLoad,
  unwrapModuleLoad: unwrapModuleLoad,
  envFor: envFor,

  resolve: resolve,
  _loadedModules: loadedModules,

  runEval: runEval

  // evalIn: evalIn,
  // evalInAndPrint: evalInAndPrint,
  // status: status,
  // statusForPrinted: statusForPrinted,
  // instrumentedFiles: instrumentedFiles,
  // prepareCodeForCustomCompile: prepareCodeForCustomCompile,
  // reloadModule: reloadModule,
  // forgetModule: forgetModule
}
