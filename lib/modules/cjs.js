/*global process, require, global, __dirname*/

var Module = require("module").Module;
var evaluator = require("../evaluator");
var uuid = require("node-uuid");
var path = require("path");
var lang = require("lively.lang");
var callsite = require("callsite");

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// helper
function resolveFileName(file) {
  if (path.isAbsolute(file)) {
    try {
      return require.resolve(file);
    } catch (e) { return file; }
  }

  var frames = callsite(), frame;
  for (var i = 2; i < frames.length; i++) {
    frame = frames[i];
    var frameFile = frame.getFileName();
    if (!frameFile) continue;
    var dir = path.dirname(frameFile);
    var full = path.join(dir, file);
    try { return require.resolve(full); } catch (e) {}
  }

  try {
    return require.resolve(path.join(process.cwd(), file));
  } catch (e) {}

  return file;
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// module wrapping + loading

// maps filenames to envs = {isLoaded: BOOL, loadError: ERROR, recorder: OBJECT}
var loadedModules = {},
    originalCompile = null,
    exceptions = [module.filename],
    scratchModule = path.join(__dirname, "cjs-scratch.js"); // fallback eval target

function instrumentedFiles() { return Object.keys(loadedModules); }
function isLoaded(fileName) { return require.cache[fileName] && fileName in loadedModules; }
function ensureRecorder(fullName) { return ensureEnv(fullName).recorder; }

function ensureEnv(fullName) {
  return loadedModules[fullName]
    || (loadedModules[fullName] = {
      customCompiled: false,
      loadError: undefined,
      // recorderName: "eval_rec_" + path.basename(fullName).replace(/[^a-z]/gi, "_"),
      recorderName: "eval_rec_" + fullName.replace(/[^a-z]/gi, "_"),
      recorder: Object.create(global)
    });
}

function prepareCodeForCustomCompile(source, filename, env) {
  source = String(source);
  var magicVars = ["exports", "require", "module", "__filename", "__dirname"],
      tfmOptions = {
        topLevelVarRecorder: env.recorder,
        varRecorderName: env.recorderName,
        dontTransform: [env.recorderName, "global"].concat(magicVars),
        recordGlobals: true
      },
      header = "var " + env.recorderName + " = global." + env.recorderName + ";\n",
      header = header + magicVars
        .map(varName => env.recorderName + "." + varName + "=" + varName + ";")
        .join("\n"),
      source = ";(function() {\n" + source + "\n})();";

  try {
    return (header + "\n" + evaluator.evalCodeTransform(source, tfmOptions));
  } catch (e) { return e; }
}

function customCompile(content, filename) {
  // wraps Module.prototype._compile to capture top-level module definitions
  if (exceptions.indexOf(filename) > -1 || isLoaded(filename))
    return originalCompile.call(this, content, filename);

  console.log("[lively.vm commonjs] loads %s", filename);

  // if cache was cleared also reset our recorded state
  if (!require.cache[filename] && loadedModules[filename])
    delete loadedModules[filename];

  var env = ensureEnv(filename),
      _ = env.customCompiled = true,
      tfmedContent = prepareCodeForCustomCompile(content, filename, env);

  if (tfmedContent instanceof Error) {
    console.warn("Cannot compile module %s:", filename, tfmedContent);
    env.loadError = tfmedContent;
    var result = originalCompile.call(this, content, filename);
    return result;
  }

  global[env.recorderName] = env.recorder;
  try {
    var result = originalCompile.call(this, tfmedContent, filename);
    env.loadError = undefined;
    return result;
  } catch (e) {
    console.log("-=-=-=-=-=-=-=-");
    console.error("[lively.vm commonjs] evaluator error loading module: ", e);
    console.log("-=-=-=-=-=-=-=-");
    console.log(tfmedContent);
    console.log("-=-=-=-=-=-=-=-");
    env.loadError = e; throw e;
  } finally {
    // delete global[env.recorderName];
  }
}

function wrapModuleLoad() {
  if (!originalCompile)
    originalCompile = Module.prototype._compile;
  Module.prototype._compile = customCompile;
}

function unwrapModuleLoad() {
  if (originalCompile)
    Module.prototype._compile = originalCompile;
}

function envFor(moduleName) {
  // var fullName = require.resolve(moduleName);
  var fullName = resolveFileName(moduleName);
  return ensureEnv(fullName);
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// instrumented code evaluation

function runEval(code, options) {

  options = lang.obj.merge({currentModule: null, printed: null}, options);

  return Promise.resolve().then(() => {
    // if (!options.currentModule) return reject(new Error("options.currentModule not defined"));
    if (!options.currentModule) options.currentModule = scratchModule;
    var fullName = resolveFileName(options.currentModule);
    if (!require.cache[fullName]) {
      try {
        require(fullName);
      } catch (e) {
        throw new Error(`Cannot load module ${options.currentModule} (tried as ${fullName})\noriginal load error: ${e.stack}`)
      }
    }

    var m = require.cache[fullName],
        env = envFor(fullName),
        rec = env.recorder,
        recName = env.recorderName;
    rec.__filename = m.filename;
    var dirname = rec.__dirname = path.dirname(m.filename);
    // rec.require = function(fname) {
    //   if (!path.isAbsolute(fname))
    //     fname = path.join(dirname, fname);
    //   return Module._load(fname, m);
    // };
    rec.exports = m.exports;
    rec.module = m;
    global[recName] = rec;
    options = lang.obj.merge(
      {waitForPromise: true},
      options, {
        recordGlobals: true,
        dontTransform: [recName, "global"],
        varRecorderName: recName,
        topLevelVarRecorder: rec,
        sourceURL: options.currentModule,
        context: rec.exports || {}
      });

    if (!options.printed) {
      var printKeys = lang.arr.intersect(Object.keys(options), ["printDepth", "asString", "inspect"]);
      if (printKeys.length) {
        options.printed = printKeys.reduce((printed, k) => {
          printed[k] = options[k];
          delete options[k];
          return printed;
        }, {printDepth: 2, inspect: false, asString: false});
      }
    }

    return evaluator.runEval(code, options).then(result => {
      if (options.printed) result.value = printResult(result, options.printed);
      return result;
    });
  });
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// printing eval results

function printPromise(evalResult, options) {
  return "Promise({"
      + "status: " + lang.string.print(evalResult.promiseStatus)
      + (evalResult.promiseStatus === "pending" ?
        "" : ", value: " + printResult(evalResult.promisedValue, options))
      + "})";
}

function printResult(evalResult, options) {
  var value = evalResult && evalResult.isEvalResult ?
    evalResult.value : evalResult

  if (evalResult && evalResult.isPromise) {
    if (options.asString || options.inspect)
      return printPromise(evalResult, options);
    else if (evalResult.promiseStatus === "pending")
      value = 'Promise({status: "pending"})';  // for JSON stringify
  }

  if (options.asString)
    return String(value);

  if (options.inspect) {
    var printDepth = options.printDepth || 2;
    return lang.obj.inspect(value, {maxDepth: printDepth})
  }

  // tries to return as value
  try {
    JSON.stringify(value);
    return value;
  } catch (e) {
    try {
      var printDepth = options.printDepth || 2;
      return lang.obj.inspect(value, {maxDepth: printDepth})
    } catch (e) { return String(value); }
  }
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// module runtime status

function status(thenDo) {
  var files = Object.keys(loadedModules);
  var envs = files.reduce((envs, fn) => {
    envs[fn] = {
      loadError:         loadedModules[fn].loadError,
      isLoaded:          isLoaded(fn),
      recorderName:      loadedModules[fn].recorderName,
      customCompiled:    loadedModules[fn].customCompiled,
      recordedVariables: Object.keys(loadedModules[fn].recorder)
    }
    return envs;
  }, {});
  thenDo(null, envs);
}

function statusForPrinted(moduleName, options, thenDo) {
  options = lang.obj.merge({depth: 3}, options);
  var env = envFor(moduleName);

  var state = {
    loadError:         env.loadError,
    recorderName:      env.recorderName,
    recordedVariables: env.recorder
  }

  thenDo(null, lang.obj.inspect(state, {maxDepth: options.depth}));
}

function reloadModule(moduleName) {
  var id = forgetModule(moduleName);
  return require(id);
}

function forgetModule(moduleName) {
  var id = resolveFileName(moduleName),
      moduleMap = Module._cache,
      deps = findDependentModules(id, moduleMap);
  deps.forEach(d => {
    delete moduleMap[d];
    delete loadedModules[d];
  });
  return id;
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// module dependencies

function findDependentModules(id, moduleMap) {
  // which modules (module ids) are (in)directly required by module with id
  // moduleMap will probably be require.cache
  // var moduleMap = require.cache;

  var depMap = Object.keys(moduleMap).reduce((deps, k) => {
    deps[k] = moduleMap[k].children.map(ea => ea.id); return deps; }, {});

  return dependsOf(id, [id], 0);

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  function dependsOf(id, deps) {
    var newDeps = (depMap[id] || []).filter(dep => deps.indexOf(dep) === -1);
    if (newDeps.length === 0) return deps;
    deps = deps.concat(newDeps);
    for (var i = 0; i < newDeps.length; i++) {
      var newDepsDeep = dependsOf(newDeps[i], deps);
      newDepsDeep.forEach(dep => deps.indexOf(dep) === -1 && deps.push(dep));
    }
    return deps;
  }
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

module.exports = {
  resolveFileName: resolveFileName,
  wrapModuleLoad: wrapModuleLoad,
  unwrapModuleLoad: unwrapModuleLoad,
  prepareCodeForCustomCompile: prepareCodeForCustomCompile,
  reloadModule: reloadModule,
  forgetModule: forgetModule,
  instrumentedFiles: instrumentedFiles,
  status: status,
  statusForPrinted: statusForPrinted,
  envFor: envFor,
  runEval: runEval
}
