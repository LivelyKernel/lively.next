/*global process, require, global, __dirname*/

var Module = require("module").Module;
var vm = require("../../index");
var uuid = require("node-uuid");
var path = require("path");
var lang = require("lively.lang");
var helper = require("./cjs-helper");


// maps filenames to envs = {isLoaded: BOOL, loadError: ERROR, recorder: OBJECT}
var loadedModules = {};
var originalCompile = null;
var exceptions = [module.filename];
var scratchModule = path.join(__dirname, "cjs-scratch.js");

function instrumentedFiles() {
  return Object.keys(loadedModules);
}

function isLoaded(fileName) {
  return require.cache[fileName] && fileName in loadedModules;
}

function ensureEnv(fullName) {
  return loadedModules[fullName]
    || (loadedModules[fullName] = {
      customCompiled: false,
      loadError: undefined,
      isLoaded: false,
      // recorderName: "eval_rec_" + path.basename(fullName).replace(/[^a-z]/gi, "_"),
      recorderName: "eval_rec_" + fullName.replace(/[^a-z]/gi, "_"),
      recorder: Object.create(global)
    });
}

function ensureRecorder(fullName) {
  return ensureEnv(fullName).recorder;
}

function customCompile(content, filename) {
  // wraps Module.prototype._compile to capture top-level module definitions
  if (exceptions.indexOf(filename) > -1 || isLoaded(filename))
    return originalCompile.call(this, content, filename);

  // if cache was cleared also reset our recorded state
  if (!require.cache[filename] && loadedModules[filename])
    delete loadedModules[filename];

  // console.log("recording load of %s", filename);

  var env = ensureEnv(filename),
      _ = env.customCompiled = true,
      magicVars = ["exports", "require", "module", "__filename", "__dirname"],
      tfmOptions = {
        topLevelVarRecorder: env.recorder,
        varRecorderName: env.recorderName,
        dontTransform: [env.recorderName, "global"].concat(magicVars),
        recordGlobals: true
      },
      header = "var " + env.recorderName + " = global." + env.recorderName + ";\n",
      header = header + magicVars.map(varName => {
        return env.recorderName + "." + varName + "=" + varName + ";"; }).join("\n"),
      tfmedContent;

  try {
    tfmedContent = (header + "\n" + vm.evalCodeTransform(content, tfmOptions));
  } catch (e) {
    console.warn("Cannot compile module %s:", filename, e);
    return originalCompile.call(this, content, filename);
  }

  global[env.recorderName] = env.recorder;

  try {
    var result = originalCompile.call(this, tfmedContent, filename);
    env.loadError = undefined;
    return result;
  } catch (e) {
    env.loadError = e; throw e;
  } finally {
    // delete global[env.recorderName];
    env.isLoaded = true;
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
  var fullName = helper.resolveFileName(moduleName);
  return ensureEnv(fullName);
}

function evalIn(moduleName, code, options) {
  var fullName = helper.resolveFileName(moduleName);
  if (!require.cache[fullName]) {
    try {
      require(fullName);
    } catch (e) {
      return new Error("Cannot find module " + moduleName + " (tried as " + fullName + ")");
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
  var result = vm.syncEval(code, lang.obj.merge(options, {
    recordGlobals: true,
    dontTransform: [recName, "global"],
    varRecorderName: recName,
    topLevelVarRecorder: rec,
    sourceURL: moduleName,
    context: rec.exports || {}
  }));
  
  // delete global[recName];
  return result;
}

function evalInAndPrint(code, module, options, thenDo) {
  var mod = module || scratchModule,
      code = code || "'no code'",
      options = options || {},
      result = evalIn(mod, code, options);
  if (result instanceof Error) result = result.stack;
  else if (options.asString) {
    result = String(result);
  } else if (options.inspect) {
    var printDepth = options.printDepth || 2;
    try {
      result = lang.obj.inspect(result, {maxDepth: printDepth})
    } catch (e) {
      result = "Error inspecting " + result + ": " + e.stack;
    }
  } else { // tries to return as value
    try {
      JSON.stringify(result);
    } catch (e) {
        try {
          var printDepth = options.printDepth || 2;
          result = lang.obj.inspect(result, {maxDepth: printDepth})
        } catch (e) {
          result = String(result);
        }
    }
  }
  thenDo(null, result);
}

function status(thenDo) {
  var files = Object.keys(loadedModules);
  var envs = files.reduce((envs, fn) => {
    envs[fn] = {
      loadError:         loadedModules[fn].loadError,
      isLoaded:          loadedModules[fn].isLoaded,
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
    isLoaded:          env.isLoaded,
    recorderName:      env.recorderName,
    recordedVariables: env.recorder
  }
  
  thenDo(null, lang.obj.inspect(state, {maxDepth: options.depth}));
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

module.exports = {
  wrapModuleLoad: wrapModuleLoad,
  unwrapModuleLoad: unwrapModuleLoad,
  envFor: envFor,
  evalIn: evalIn,
  evalInAndPrint: evalInAndPrint,
  status: status,
  statusForPrinted: statusForPrinted,
  instrumentedFiles: instrumentedFiles
}
