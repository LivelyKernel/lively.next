/*global process, require, global, __dirname*/

var Module = require("module").Module;
var vm = require("../../index.js");
var uuid = require("node-uuid");
var path = require("path");
var lang = require("lively.lang");
var helper = require("./cjs-helper");


// maps filenames to envs = {isLoaded: BOOL, loadError: ERROR, recorder: OBJECT}
var loadedModules = {};
var originalCompile = null;
var exceptions = [module.filename];
var scratchModule = path.join(__dirname, "..", "scratch.js");

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
      // recorderName: "eval_rec_" + path.basename(fullName).replace(/[^a-z]/gi, "_"),
      recorderName: "eval_rec_" + fullName.replace(/[^a-z]/gi, "_"),
      recorder: Object.create(global)
    });
}

function ensureRecorder(fullName) {
  return ensureEnv(fullName).recorder;
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
        .join("\n");

  try {
    return (header + "\n" + vm.evalCodeTransform(source, tfmOptions));
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
    console.warn("Cannot compile module %s:", filename, e);
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
  var id = helper.resolveFileName(moduleName),
      moduleMap = Module._cache,
      deps = findDependentModules(id, moduleMap);
  deps.forEach(d => {
    delete moduleMap[d];
    delete loadedModules[d];
  });
  return id;
}

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
  wrapModuleLoad: wrapModuleLoad,
  unwrapModuleLoad: unwrapModuleLoad,
  envFor: envFor,
  evalIn: evalIn,
  evalInAndPrint: evalInAndPrint,
  status: status,
  statusForPrinted: statusForPrinted,
  instrumentedFiles: instrumentedFiles,
  prepareCodeForCustomCompile: prepareCodeForCustomCompile,
  reloadModule: reloadModule,
  forgetModule: forgetModule
}
