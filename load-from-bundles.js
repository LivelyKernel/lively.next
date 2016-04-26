// lively.vm.es6._init();
// lively.modules.System.import("lively.ast/index.js").then(ast => lively.ast = ast).catch(show.curry("%s"))
// lively.modules.System.import("lively.vm/index.js").then(m => { lively.vm = m; lively.lang.VM = m }).catch(show.curry("%s"))
// System.import("http://localhost:9001/lively.modules/index.js").then(m => lively.modules = m).catch(show.curry("%s"))

var isNode = typeof process !== "undefined" && process.platform && typeof require !== "undefined";
var GLOBAL = isNode ? global : window;

if (isNode && !GLOBAL.System) require("systemjs");

GLOBAL.System = new (GLOBAL.System.constructor)(); // new system for bootstrap

var livelyModulesDir;
if (isNode) {
  livelyModulesDir = "file://" + __dirname;
} else {
  livelyModulesDir = URL.root ?
    URL.root.withFilename("lively.modules").toString() :
    document.location.origin + "/lively.modules";
}

Promise.resolve()
  .then(() => console.time("prep"))
  .then(() => loadBundles())
  .then(() => configure())
  .then(() => console.timeEnd("prep"))
  .then(m => {
    console.time("initial load");
    return loadLivelyModules()
      .then((m) => {
        console.timeEnd("initial load");
        console.log("1. lively.modules loaded");
        return m;
      });
  })
  .then(livelyModules => {
    // livelyModules.System.debug = true;
    console.time("bootstrap load");
    return selfLoadLivelyModules(livelyModules)
      .then(() => {
        console.timeEnd("bootstrap load");
        console.log("2. lively.modules bootstraped");
      });
  })
  .catch(err => {
    console.log(systemConfPrint());
    console.log(err)
    console.error(err.stack)
  })

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function load(url) {
  return new Promise((resolve, reject) => {
    if (isNode) {
      url = url.replace(/^file:\/\//, "");
      require(url);
      resolve();
    } else if (typeof JSLoader !== "undefined") {
      JSLoader.forcedReload(String(url), resolve);
    } else {
      var script = document.createElement("script");
      script.src = String(url);
      script.onload = function() { resolve(); };
      document.head.appendChild(script);
    }
  });
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function loadBundles() {
  return Promise.all([
    load(livelyModulesDir + "/dist/acorn-bundle.js"),
    load(livelyModulesDir + "/dist/ast-bundle.js"),
    load(livelyModulesDir + "/dist/lang-bundle.js"),
    load(livelyModulesDir + "/dist/modules-bundle.js"),
    load(livelyModulesDir + "/dist/vm-bundle.js")
  ])
}

function configure() {
  GLOBAL.System.trace = true;
  var normalize = GLOBAL.System.constructor.prototype.normalize.bind(GLOBAL.System);
  GLOBAL.System.config({
    normalize: function(name, parent, parentAddress) {
      if (name === "..") {
        return Promise.resolve(parent.split("/").slice(0, -2).join("/") + "/index.js");
      }
      return normalize(name, parent, parentAddress).then(result =>
        result.match(/json\.js$/) ? result.replace(/\.js$/, "") : result);
    },
    "transpiler": "babel",
    "defaultJSExtensions": true,
    bundles: {
      [livelyModulesDir + "/dist/acorn-bundle.js"]: ["acorn/package.json", "acorn/src/index.js", "acorn/src/walk/index.js", "acorn/src/loose/index.js", "acorn/src/state.js", "acorn/src/parseutil.js", "acorn/src/statement.js", "acorn/src/lval.js", "acorn/src/expression.js", "acorn/src/location.js", "acorn/src/options.js", "acorn/src/locutil.js", "acorn/src/node.js", "acorn/src/tokentype.js", "acorn/src/tokencontext.js", "acorn/src/identifier.js", "acorn/src/tokenize.js", "acorn/src/whitespace.js", "acorn/src/loose/state.js", "acorn/src/loose/tokenize.js", "acorn/src/loose/statement.js", "acorn/src/loose/expression.js", "acorn/src/util.js", "acorn/src/loose/parseutil.js"],
      [livelyModulesDir + "/dist/ast-bundle.js"]: ["lively.ast/package.json", "lively.ast/index.js", "lively.ast/lib/mozilla-ast-visitor-interface.js", "lively.ast/lib/parser.js", "lively.ast/lib/acorn-extension.js", "lively.ast/lib/stringify.js", "lively.ast/lib/query.js", "lively.ast/lib/transform.js", "lively.ast/lib/capturing.js", "lively.ast/lib/comments.js", "lively.ast/lib/code-categorizer.js", "lively.ast/lib/mozilla-ast-visitors.js", "lively.ast/dist/escodegen.browser.js", "lively.ast/generated/estree-visitor.js"],
      [livelyModulesDir + "/dist/lang-bundle.js"]: ["lively.lang/package.json", "lively.lang/index.js", "lively.lang/lib/base.js", "lively.lang/lib/object.js", "lively.lang/lib/class.js", "lively.lang/lib/collection.js", "lively.lang/lib/sequence.js", "lively.lang/lib/tree.js", "lively.lang/lib/function.js", "lively.lang/lib/string.js", "lively.lang/lib/number.js", "lively.lang/lib/date.js", "lively.lang/lib/promise.js", "lively.lang/lib/events.js", "lively.lang/lib/graph.js", "lively.lang/lib/messenger.js", "lively.lang/lib/worker.js"],
      [livelyModulesDir + "/dist/modules-bundle.js"]: ["lively.modules/package.json", "lively.modules/index.js", "lively.modules/src/system.js", "lively.modules/src/packages.js", "lively.modules/src/change.js", "lively.modules/src/dependencies.js", "lively.modules/src/hooks.js", "lively.modules/src/import-export.js", "lively.modules/src/instrumentation.js"],
      [livelyModulesDir + "/dist/vm-bundle.js"]: ["lively.vm/package.json", "lively.vm/index.js", "lively.vm/lib/completions.js", "lively.vm/lib/commonjs-interface.js", "lively.vm/lib/es6-interface.js", "lively.vm/lib/evaluator.js"]
    },
    packageConfigPaths: ["acorn/package.json", "lively.lang/package.json", "lively.ast/package.json", "lively.vm/package.json", "lively.modules/package.json"]
  });
  return Promise.resolve();
}

function loadLivelyModules() {
  return GLOBAL.System.import(livelyModulesDir + "/index.js")
    .then(m => {
      if (!GLOBAL.lively) GLOBAL.lively = {};
      GLOBAL.lively.modules = m;
      m.removeSystem("bootstrap");
      m.changeSystem(m.getSystem("bootstrap"), true);
      return m;
    });
}

function selfLoadLivelyModules(livelyModules) {
  return livelyModules.registerPackage(livelyModulesDir)
    .then(() => livelyModules.System.import(livelyModulesDir))
    .then(bootstrapped => {
      bootstrapped.changeSystem(livelyModules.System)
      GLOBAL.lively.modules = bootstrapped;
      // bootstrapped.changeSystem(bootstrapped.System, true)
      // return livelyModules.registerPackage(livelyModulesDir);
    });
}

function systemConfPrint() {
  var S = GLOBAL.System;
  var json = {
    baseURL: S.baseURL,
    transpiler: S.transpiler,
    defaultJSExtensions: S.defaultJSExtensions,
    map: S.map,
    meta: S.meta,
    packages: S.packages,
    paths: S.paths,
    packageConfigPaths: S.packageConfigPaths,
  }
  return JSON.stringify(json, null, 2);
}