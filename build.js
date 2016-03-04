/*global require*/


/*
fswatch -0 -r . | xargs -0 -I{} bash -c \
  "[[ \"{}\" =~ .js$ ]] && [[ ! \"{}\" =~ .bundle. ]] && node build.js;"
*/

var fs            = require("fs"),
    execSync      = require("child_process").execSync,
    path          = require("path"),
    lang          = require("lively.lang"),
    fun           = lang.fun,
    arr           = lang.arr,
    babel         = require("babel-core"),
    estreeVisitor = "generated/estree-visitor.js";

module.exports = function() {

  return lang.promise.chain([
    log("1. Creating estree visitor"),
    createEstreeVisitorModule,
    log("2. Initializing build of packages"),
    build,
    log("SUCCESS")
  ])
  .catch(err => console.error(err.stack || err));
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function log(msg) { return () => console.log(msg) }

function createEstreeVisitorModule() {
  var estree = require("estree-to-js"),
      estreeSpec = JSON.parse(fs.readFileSync(require.resolve("estree-to-js/generated/es6.json"))),
      source = estree.createVisitor(estreeSpec, []/*exceptions*/, "Visitor") + "\nmodule.exports = Visitor;"
  return lang.promise(fs.writeFile)(estreeVisitor, source);
}

function build() {
  var moduleName = "lively.ast",
      moduleMain = path.join(moduleName, JSON.parse(fs.readFileSync("package.json")).main);

  // for getting a properly named module we package the module from the outside
  // directory, effectively creating a prefix for the module and all its dependencies
  // Note we need to do this before loading systemjs-builder!
  process.chdir('../');
  var baseConfig = systemjsBuildConfig(),
      bundleConfig = lang.obj.deepMerge(baseConfig, {meta: {escodegen: {format: "global"}}});

  // The package artifacts to create and their individual configurations
  var targets = [

    {
      config: bundleConfig,
      outFile: moduleName + "/dist/lively.ast.es6.bundle.js",
      substitutions: [],
      buildMethod: "bundle",
      onBuildDone: build => lang.promise(fs.writeFile)(moduleName + "/dist/lively.ast.es6.bundle-config.json", createSystemjsConfigForLaterConsumption(moduleName, moduleMain, bundleConfig, build))
    },

    {
      config: bundleConfig,
      outFile: moduleName + "/dist/lively.ast.bundle.js",
      substitutions: [],
      buildMethod: "buildStatic",
      transformSource: build => {
        //     if (build.sourceMap) {
        //       var map = JSON.parse(build.sourceMap), mapName = to + ".map";
        //       source += "\n//# sourceMappingURL=/" + mapName + "\n";
        //       map.file = "/" + to;
        //       map.sources = map.sources.map(ea => "/" + ea);
        //       fs.writeFileSync(mapName, JSON.stringify(map));
        //     }
        //     fs.writeFileSync(to, source);
        return wrapStaticSystemjsModuleForConsumption(moduleName, build.source);
      }
    },

    {
      config: baseConfig,
      outFile: moduleName + '/dist/lively.ast.es6.js',
      substitutions: [
        {match: load => load.name.match(/lively.lang\/index.js$/), code: "module.exports = lively.lang;"},
        {match: load => load.name.match(/escodegen.(browser.)?.js/), code: "for (var name in escodegen) module.exports[name] = window.escodegen[name];"}
      ],
      buildMethod: "bundle",
      onBuildDone: build => lang.promise(fs.writeFile)(moduleName + "/dist/lively.ast.es6-config.json", createSystemjsConfigForLaterConsumption(moduleName, moduleMain, bundleConfig, build))
    },

    {
      config: baseConfig,
      outFile: moduleName + '/dist/lively.ast.js',
      substitutions: [
        {match: load => load.name.match(/lively.lang\/index.js$/), code: "module.exports = lively.lang;"},
        {match: load => load.name.match(/escodegen.(browser.)?.js/), code: "for (var name in escodegen) module.exports[name] = window.escodegen[name];"}
      ],
      buildMethod: "buildStatic",
      transformSource: build => wrapStaticSystemjsModuleForConsumption(moduleName, build.source)
    }

  ];

  // run the build
  return lang.promise.chain([
    manualFileTranslations,
    () => systemjsBuild(moduleName, targets),
    revertManualFileTranslations,
    (out) => console.log('Done')
  ]).catch(function(err) {
    if (err.originalErr) console.error(err.originalErr.stack)
    revertManualFileTranslations().catch(err => console.error("Error reverting manual es5 translations: " + err.stack));
    throw err;
  });

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  function wrapStaticSystemjsModuleForConsumption(name, __CODE__) {
    return `
  "format cjs";
  (function define_${name.replace(/[^\w]/g, "_")}() {
    var isNodejs = typeof require !== "undefined" && typeof exports !== "undefined",
        GLOBAL = typeof window !== "undefined" ? window : (typeof self !== "undefined" ? self : global);
    if (!isNodejs) {
      if (GLOBAL.require) GLOBAL.__prev_require__ = GLOBAL.require;
      GLOBAL.require = function(name) { console.log("require %s", name); };
      if (GLOBAL.module) GLOBAL.__prev_module__ = GLOBAL.module;
      GLOBAL.module = {exports: {}};
    }

    ${__CODE__}

    if (!isNodejs) {
      var lv = GLOBAL.lively || (GLOBAL.lively = {}),
          exported = GLOBAL.module.exports;
      if (!lv.ast) lv.ast = exported;
      else {
        if (lv.ast.acorn) {
          for (var name in exported.acorn) {
            if (exported.acorn.hasOwnProperty(name))
              lv.ast.acorn[name] = exported.acorn[name];
          }
        } else { lv.ast.acorn = exported.acorn; }
        for (var name in exported) {
          if (exported.hasOwnProperty(name) && name !== "acorn")
            lv.ast[name] = exported[name];
        }
      }
      if (GLOBAL.__prev_module__) GLOBAL.module = GLOBAL.__prev_module__;
      else delete GLOBAL.module;
      if (GLOBAL.__prev_require__) GLOBAL.require = GLOBAL.__prev_require__;
      else delete GLOBAL.require;
    }
  })();
  `;

  }
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// fs helper
function isLink(fname) {
  fname = fname.replace(/\/$/, "");
  var code = execSync(`readlink ${fname}; echo $?`).toString().trim().slice(-1);
  return code === "0";
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// translate es6 -> es5, even if modules aren't in es6 format
function manualFileTranslations() {
  var fileReverts = manualFileTranslations.fileReverts || (manualFileTranslations.fileReverts = {});
  return new Promise((resolve, reject) => {
    var files = ["lively.ast/lib/capturing.js",
                 "lively.ast/node_modules/lively.lang/lib/promise.js",
                 "lively.ast/node_modules/lively.lang/lib/graph.js"];
    files.forEach(f => {
      console.log("[setup] Babel translate %s", f);
      fileReverts[f] = fs.readFileSync(f);
      var code = babel.transformFileSync(f, {stage: 2}).code;
      fs.writeFileSync(f, code);
    });
    resolve();
  });
}

function revertManualFileTranslations() {
  var fileReverts = manualFileTranslations.fileReverts || (manualFileTranslations.fileReverts = {});
  return new Promise((resolve, reject) => {
    Object.keys(fileReverts).forEach(f => {
      console.log("[cleanup] Babel revert translate %s", f);
      fs.writeFileSync(f, fileReverts[f]);
    });
    resolve();
  });
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// systemjs(-builder) config
function prepareSystemjsConfigOfNodeModules(projDir, exceptions) {
  exceptions = exceptions || [];
  var pkgFile = path.join(projDir, "package.json");

  if (!fs.existsSync(pkgFile)) return null; // e.g. .bin/
  // if (!fs.existsSync(pkgFile)) throw new Error("Cannot read package config in project dir " + projDir);
  var pkgJSON = JSON.parse(fs.readFileSync(pkgFile).toString()),
      main = pkgJSON.main || "index.js";
  if (!fs.existsSync(path.join(projDir, main))) main += ".js";
  if (fs.statSync(path.join(projDir, main)).isDirectory()) main = path.join(main, "index.js");
  var entry = {name: pkgJSON.name, main: main, dir: projDir, deepName: path.join(projDir, pkgJSON.name), packageConfigPath: pkgFile, subpackages: []},
      nodeModulesDir = path.join(projDir, "node_modules");
  if (fs.existsSync(nodeModulesDir)) {
    entry.subpackages = fs.readdirSync(nodeModulesDir).reduce((entries, d) => {
      if (exceptions.indexOf(d) > -1 || isLink(path.join(nodeModulesDir, d))) return entries;
      var sub = prepareSystemjsConfigOfNodeModules(path.join(nodeModulesDir, d));
      if (!sub) return entries;
      return entries.concat([sub]);
    }, entry.subpackages);
  }
  return entry;
}

function systemjsConfigOfNodeModules(projDir, exceptions) {
  var conf = {map: {}, packages: {}, packageConfigPaths: []},
      root = prepareSystemjsConfigOfNodeModules(projDir, exceptions);
  addToMap(root, conf.map)
  return conf;

  function addToMap(entry, map) {
    var isRoot = entry === root, id = entry.dir;
    map[entry.name] = id;
    if (entry.subpackages.length) {
      var subMap = isRoot ? conf.map : (conf.map[id] || (conf.map[id] = {}));
      entry.subpackages.forEach(sub => addToMap(sub, subMap));
    }
    conf.packages[id] = {main: entry.main, format: "cjs", configured: true};
    conf.packageConfigPaths.push(entry.packageConfigPath);
  }
}

function systemjsBuildConfig() {
  var cfg = systemjsConfigOfNodeModules("./lively.ast/", ["browserify", "traceur", "escodegen", "systemjs-builder", "mocha"]);

  cfg = {
    baseURL: './',
    transpiler: "babel", babelOptions: {"stage": 2},
    paths: cfg.paths,
    map: lang.obj.merge(cfg.map, {
      "lively.ast.js": "./lively.ast",
      "lively.ast": "./lively.ast",
      "babel": "lively.ast/node_modules/babel-core/browser.js",
      "lively.lang": "lively.ast/node_modules/lively.lang/index.js",
      "escodegen": "lively.ast/dist/escodegen.browser.js",
      // "acorn": "node_modules/acorn"
      // "escodegen": "node_modules/escodegen/escodegen.js"
    }),
    meta: {escodegen: {format: "global"}},
    packages: cfg.packages,
    packageConfigPaths: cfg.packageConfigPaths,
    defaultJSExtensions: true
  };

  var nodejsCoreModules = ["addons", "assert", "buffer", "child_process",
      "cluster", "console", "crypto", "dgram", "dns", "domain", "events", "fs",
      "http", "https", "module", "net", "os", "path", "punycode", "querystring",
      "readline", "repl", "stream", "stringdecoder", "timers", "tls",
      "tty", "url", "util", "v8", "vm", "zlib"];
  cfg.map = nodejsCoreModules.reduce((map, ea) => { map[ea] = "@node/" + ea; return map; }, cfg.map);

  return cfg;
}

function systemjsBuild(from, targets) {
  return Promise.all(targets.map(t => {
    // outFile, substitutions, buildMethod, transformSource
    var Builder = require('systemjs-builder'),
        builder = new Builder(t.config),
        buildConfig = {fetch: systemJSFetch.bind(null, t.substitutions || []), runtime: false};
    console.log("[build] " + t.outFile);
    return builder[t.buildMethod](from, buildConfig).then(build => {
      var source = t.transformSource ? t.transformSource(build) : build.source;
      fs.writeFileSync(t.outFile, source);
      return Promise.resolve(t.onBuildDone ? t.onBuildDone(build) : null).then(() => build);
    });
  }));
}

function systemJSFetch(substitutions, load, fetch) {
  var substitution = lang.arr.detect(substitutions, ea => ea.match(load))
  if (substitution) {
    console.log("[systemjs build fetch override] substituting %s", load.name);
    return typeof substitution.code === "function" ? substitution.code(load) : substitution.code;
  }
  // console.log(path.relative(process.cwd(), load.name.replace("file://", "")))
  return fetch(load);
};

function createSystemjsConfigForLaterConsumption(moduleName, moduleMain, cfg, build) {
  var cfgForBrowser = lang.obj.deepCopy(cfg);
  delete cfgForBrowser.baseURL;
  // Remove the maps / packages / configs of those modules we found when
  // traversing the node_modules structure but that aren't actually needed for the
  // package that was build
  delete cfgForBrowser.meta;
  delete cfgForBrowser.packages;
  delete cfgForBrowser.packageConfigPaths;
  cfgForBrowser.map = Object.keys(cfgForBrowser.map).reduce((map, key) => {
    if (typeof map[key] === "string" && map[key].indexOf("@node/") === 0) map[key] = "@empty";
    else if (typeof map[key] === "string") {
      if (!build.modules.some((registered) => registered.indexOf(map[key]) === 0)) {
        delete map[key];
      }
    } else if (typeof map[key] === "object") {
      if (!build.modules.some((registered) => registered.indexOf(key) === 0)) delete map[key];
    }
    return map;
  }, cfgForBrowser.map);
  cfgForBrowser.map[moduleName] = moduleMain;
  cfgForBrowser.bundles = lang.obj.deepMerge(cfgForBrowser.bundles || {[moduleName]: build.modules});
  // return `System.config(${});`;
  return JSON.stringify(cfgForBrowser, null, 2);
}
