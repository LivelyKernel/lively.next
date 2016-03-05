/*global process, require, global, __dirname*/

var isNode = System.get("@system-env").node
var debug = false;
var debug = true;

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// utils
import * as path from "path";
import * as lang from "lively.lang";
var join = path.join || lang.string.joinPath,
    isAbsolute = path.isAbsolute ||  (p => !!p.match(/^(\/|[^\/]+:\/\/)/)),
    relative = path.relative || ((base, path) => path),
    dirname = path.dirname || (path => path.replace(/\/[^\/]+$/, ""));

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// node interface
import { Module } from "module";

var nodeModules = isNode ? {
  get cache() { return Module._cache; },
  get require() { return (name, parent) => Module._load(name, parent); },
  get resolve() { return (name, parent) => Module._resolveFilename(name, parent); },
} : {
  get cache() {
    console.warn("[lively.vm cjs] module cache accessor used on non-node system");
    return {};
  },
  get require() {
    return (name, parent) => {
      console.warn("[lively.vm cjs] require used on non-node system");
      return undefined;
    };
  },
  get resolve() {
    return (name, parent) => {
      console.warn("[lively.vm cjs] resolveFilename used on non-node system");
      return name;
    };
  }
}

var __dirname = isNode ?
  join(process.cwd(), "lib") :
  System.normalizeSync("lively.vm/lib/");
var __filename = isNode ?
  join(__dirname, "commonjs-interface.js") :
  System.normalizeSync("lively.vm/lib/commonjs-interface.js");

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// other deps
import callsite from "callsite";
import * as fs from "fs";
import * as evaluator from "./evaluator";

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// helper
function resolve(file, parent) {
  if (typeof parent === "string") parent = {id: parent};

  // normal resolve
  try {
    return nodeModules.resolve(file, parent);
  } catch (e) {}

  // manual lookup using path
  if (!isAbsolute(file) && parent) {
    if (!file.match(/\.js$/)) file += ".js";
    try {
      return nodeModules.resolve(join(parent.id, "..", file));
    } catch (e) {}
  }

  // manual lookup using callstack
  var frames = callsite(), frame;
  for (var i = 2; i < frames.length; i++) {
    frame = frames[i];
    var frameFile = frame.getFileName();
    if (!frameFile) continue;
    var dir = dirname(frameFile),
        full = join(dir, file);
    try { return nodeModules.resolve(full, parent); } catch (e) {}
  }

  // last resort: current working directory
  try {
    return nodeModules.resolve(join(process.cwd(), file), parent);
  } catch (e) {}

  return file;
}

function sourceOf(moduleName, parent) {
  var read = lang.promise.convertCallbackFun(fs.readFile);
  return read(resolve(moduleName, parent)).then(String);
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// module wrapping + loading

// maps filenames to envs = {isLoaded: BOOL, loadError: ERROR, recorder: OBJECT}
var loadedModules = {},
    requireMap = {},
    originalCompile = null, originalLoad = null,
    exceptions = [
      // (id) => console.log(!!id.match(/lib\/commonjs-interface\.js$/)) || id.match(/lib\/commonjs-interface\.js$/),
      (id) => id.indexOf("commonjs-interface.js") > -1,
      (id) => ["lively.lang/node_modules", "lively.vm/node_modules", "code-pump/node_modules"]
              .some(ignore => id.indexOf(ignore) > -1)
    ],
    // exceptions = [module.filename],
    // exceptions = [],
    scratchModule = join(__dirname, "commonjs-scratch.js"); // fallback eval target

function instrumentedFiles() { return Object.keys(loadedModules); }
function isLoaded(fileName) { return nodeModules.cache[fileName] && fileName in loadedModules; }
function ensureRecorder(fullName) { return ensureEnv(fullName).recorder; }

function ensureEnv(fullName) {
  return loadedModules[fullName]
    || (loadedModules[fullName] = {
      isInstrumented: false,
      loadError: undefined,
      // recorderName: "eval_rec_" + path.basename(fullName).replace(/[^a-z]/gi, "_"),
      // recorderName: "eval_rec_" + fullName.replace(/[^a-z]/gi, "_"),
      recorderName: "__lv_rec__",
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
      header = `var __cjs = System.get('file://${__filename}'),\n    ${env.recorderName} = __cjs.envFor('${filename}').recorder;\n`
             + magicVars.map(varName => `${env.recorderName}.${varName} = ${varName};`).join("\n");

  try {
    return (header + "\n"
          + ";(function() {\n"
          + evaluator.evalCodeTransform(source, tfmOptions)
          + "\n})();");
  } catch (e) { return e; }
}

var loadDepth = 0;
function customCompile(content, filename) {
  // wraps Module.prototype._compile to capture top-level module definitions
  if (exceptions.some(exc => exc(filename)) || isLoaded(filename))
    return originalCompile.call(this, content, filename);

  debug && console.log("[lively.vm customCompile] %s", filename);
  // console.log(lang.string.indent("[lively.vm commonjs] loads %s", " ", loadDepth), filename);

  // if cache was cleared also reset our recorded state
  if (!nodeModules.cache[filename] && loadedModules[filename])
    delete loadedModules[filename];

  var env = ensureEnv(filename),
      _ = env.isInstrumented = true,
      tfmedContent = prepareCodeForCustomCompile(content, filename, env);

  if (tfmedContent instanceof Error) {
    console.warn("Cannot compile module %s:", filename, tfmedContent);
    env.loadError = tfmedContent;
    var result = originalCompile.call(this, content, filename);
    return result;
  }

  global[env.recorderName] = env.recorder;
  loadDepth++;
  try {
    var result = originalCompile.call(this, tfmedContent, filename);
    env.loadError = undefined;
    return result;
  } catch (e) {
    console.log("-=-=-=-=-=-=-=-");
    console.error("[lively.vm commonjs] evaluator error loading module: ", e.stack || e);
    console.log("-=-=-=-=-=-=-=-");
    console.log(tfmedContent);
    console.log("-=-=-=-=-=-=-=-");
    env.loadError = e; throw e;
  } finally {
    loadDepth--;
    // console.log(lang.string.indent("[lively.vm commonjs] done loading %s", " ", loadDepth), filename);
    // delete global[env.recorderName];
  }
}

function customLoad(request, parent, isMain) {
  var id = resolve(request, parent),
      parentId = resolve(parent.id);
  if (exceptions.some(exc => exc(id)) || exceptions.some(exc => exc(parentId)))
    return originalLoad.call(this, request, parent, isMain);

  if (debug) {
    var parentRel = relative(process.cwd(), parentId);
    console.log(lang.string.indent("[lively.vm cjs dependency] %s -> %s", " ", loadDepth), parentRel, request);
    // console.log(id);
  }

  if (!requireMap[parent.id]) requireMap[parent.id] = [id];
  else requireMap[parent.id].push(id);
  return originalLoad.call(this, request, parent, isMain);
}

function wrapModuleLoad() {
  if (!originalCompile)
    originalCompile = Module.prototype._compile;
  Module.prototype._compile = customCompile;
  if (!originalLoad)
    originalLoad = Module._load;
  Module._load = customLoad;
}

function unwrapModuleLoad() {
  if (originalCompile)
    Module.prototype._compile = originalCompile;
  if (originalLoad)
    Module._load = originalLoad;
}

function envFor(moduleName) {
  // var fullName = require.resolve(moduleName);
  var fullName = resolve(moduleName);
  return ensureEnv(fullName);
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// instrumented code evaluation

function runEval(code, options) {
  options = lang.obj.merge({targetModule: null, parentModule: null}, options);

  return Promise.resolve().then(() => {
    if (!options.targetModule) {
      options.targetModule = scratchModule;
    } else {
      options.targetModule = resolve(options.targetModule, options.parentModule);
    }

    var fullName = resolve(options.targetModule);
    if (!nodeModules.cache[fullName]) {
      try {
        nodeModules.require(fullName);
      } catch (e) {
        throw new Error(`Cannot load module ${options.targetModule} (tried as ${fullName})\noriginal load error: ${e.stack}`)
      }
    }

    var m = nodeModules.cache[fullName],
        env = envFor(fullName),
        rec = env.recorder,
        recName = env.recorderName;
    rec.__filename = m.filename;
    var d = rec.__dirname = dirname(m.filename);
    // rec.require = function(fname) {
    //   if (!path.isAbsolute(fname))
    //     fname = path.join(d, fname);
    //   return Module._load(fname, m);
    // };
    rec.exports = m.exports;
    rec.module = m;
    global[recName] = rec;
    options = lang.obj.merge(options, {
      recordGlobals: true,
      dontTransform: [recName, "global"],
      varRecorderName: recName,
      topLevelVarRecorder: rec,
      sourceURL: options.targetModule,
      context: rec.exports || {}
    });

    return evaluator.runEval(code, options);
  });
}

function importCjsModule(name) {
  return new Promise(ok => ok(nodeModules.require(resolve(name))));
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// module runtime status

function status(thenDo) {
  var files = Object.keys(loadedModules),
      envs = files.reduce((envs, fn) => {
        envs[fn] = {
          loadError:         loadedModules[fn].loadError,
          isLoaded:          isLoaded(fn),
          recorderName:      loadedModules[fn].recorderName,
          isInstrumented:    loadedModules[fn].isInstrumented,
          recordedVariables: Object.keys(loadedModules[fn].recorder)
        }
        return envs;
      }, {});
  if (typeof thenDo === "function") thenDo(null, envs);
  return Promise.resolve(envs);
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

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// module reloading

function _invalidateCacheForModules(fullModuleIds, moduleMap) {
  fullModuleIds.forEach(id => {
    delete moduleMap[id];
    delete loadedModules[id];
  });
}

function forgetModule(moduleName, parent) {
  var id = resolve(moduleName, parent),
      deps = findDependentsOf(id);
  _invalidateCacheForModules([id].concat(deps), Module._cache);
  return id;
}

function forgetModuleDeps(moduleName, parent) {
  var id = resolve(moduleName, parent),
      deps = findDependentsOf(id);
  _invalidateCacheForModules(deps, Module._cache);
  return id;
}

function reloadModule(moduleName, parent) {
  var id = forgetModule(moduleName, parent);
  return nodeModules.require(id);
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// module dependencies

function findDependentsOf(id) {
  // which modules (module ids) are (in)directly required by module with id
  // Let's say you have
  // module1: exports.x = 23;
  // module2: exports.y = require("./module1").x + 1;
  // module3: exports.z = require("./module2").y + 1;
  // `findDependentsOf` gives you an answer what modules are "stale" when you
  // change module1
  return lang.graph.hull(lang.graph.invert(requireMap), resolve(id));
}

function findRequirementsOf(id) {
  // which modules (module ids) are (in)directly required by module with id
  // Let's say you have
  // module1: exports.x = 23;
  // module2: exports.y = require("./module1").x + 1;
  // module3: exports.z = require("./module2").y + 1;
  // `findRequirementsOf("./module3")` will report ./module2 and ./module1
  return lang.graph.hull(requireMap, resolve(id));
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

export {

  // internals
  requireMap as _requireMap,
  loadedModules as _loadedModules,
  instrumentedFiles,
  prepareCodeForCustomCompile as _prepareCodeForCustomCompile,

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // accessing
  sourceOf,
  envFor,
  status,
  statusForPrinted,

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // eval + changes
  runEval,
  // sourceChange,

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // loading + dependencies
  // reloadModule,
  resolve,
  importCjsModule as import,
  reloadModule,
  forgetModule,
  forgetModuleDeps,
  findRequirementsOf,
  findDependentsOf,

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // instrumentation
  wrapModuleLoad,
  unwrapModuleLoad
}
