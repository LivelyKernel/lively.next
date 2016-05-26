(function() {
  var GLOBAL = typeof window !== "undefined" ? window :
      typeof global!=="undefined" ? global :
        typeof self!=="undefined" ? self : this;
  this.lively = this.lively || {};
(function (exports,lively_lang,ast,babelRegeneratorRuntime) {
  'use strict';

  var babelHelpers = {};

  babelHelpers.defineProperty = function (obj, key, value) {
    if (key in obj) {
      Object.defineProperty(obj, key, {
        value: value,
        enumerable: true,
        configurable: true,
        writable: true
      });
    } else {
      obj[key] = value;
    }

    return obj;
  };
  function scheduleModuleExportsChange(System, moduleId, name, value, addNewExport) {
    var pendingExportChanges = System.get("@lively-env").pendingExportChanges,
        rec = moduleRecordFor$1(System, moduleId);
    if (rec && (name in rec.exports || addNewExport)) {
      var pending = pendingExportChanges[moduleId] || (pendingExportChanges[moduleId] = {});
      pending[name] = value;
    }
  }

  function runScheduledExportChanges(System, moduleId) {
    var pendingExportChanges = System.get("@lively-env").pendingExportChanges,
        keysAndValues = pendingExportChanges[moduleId];
    if (!keysAndValues) return;
    clearPendingModuleExportChanges(System, moduleId);
    updateModuleExports(System, moduleId, keysAndValues);
  }

  function clearPendingModuleExportChanges(System, moduleId) {
    var pendingExportChanges = System.get("@lively-env").pendingExportChanges;
    delete pendingExportChanges[moduleId];
  }

  function updateModuleExports(System, moduleId, keysAndValues) {
    var debug = System.debug;
    updateModuleRecordOf(System, moduleId, function (record) {

      var newExports = [],
          existingExports = [];

      Object.keys(keysAndValues).forEach(function (name) {
        var value = keysAndValues[name];
        debug && console.log("[lively.vm es6 updateModuleExports] %s export %s = %s", moduleId, name, String(value).slice(0, 30).replace(/\n/g, "") + "...");

        var isNewExport = !(name in record.exports);
        if (isNewExport) record.__lively_modules__.evalOnlyExport[name] = true;
        // var isEvalOnlyExport = record.__lively_vm__.evalOnlyExport[name];
        record.exports[name] = value;

        if (isNewExport) newExports.push(name);else existingExports.push(name);
      });

      // if it's a new export we don't need to update dependencies, just the
      // module itself since no depends know about the export...
      // HMM... what about *-imports?
      newExports.forEach(function (name) {
        var oldM = System._loader.modules[moduleId].module,
            m = System._loader.modules[moduleId].module = new oldM.constructor(),
            pNames = Object.getOwnPropertyNames(record.exports);
        for (var i = 0; i < pNames.length; i++) (function (key) {
          Object.defineProperty(m, key, {
            configurable: false, enumerable: true,
            get: function get() {
              return record.exports[key];
            }
          });
        })(pNames[i]);
        // Object.defineProperty(System._loader.modules[fullname].module, name, {
        //   configurable: false, enumerable: true,
        //   get() { return record.exports[name]; }
        // });
      });

      // For exising exports we find the execution func of each dependent module and run that
      // FIXME this means we run the entire modules again, side effects and all!!!
      if (existingExports.length) {
        debug && console.log("[lively.vm es6 updateModuleExports] updating %s dependents of %s", record.importers.length, moduleId);
        for (var i = 0, l = record.importers.length; i < l; i++) {
          var importerModule = record.importers[i];
          if (!importerModule.locked) {
            var importerIndex = importerModule.dependencies.indexOf(record);
            importerModule.setters[importerIndex](record.exports);
            importerModule.execute();
          }
        }
      }
    });
  }

  function importsAndExportsOf$1(System, moduleName, parent) {
    var id, source, parsed, scope, imports, exports;
    return regeneratorRuntime.async(function importsAndExportsOf$(context$1$0) {
      while (1) switch (context$1$0.prev = context$1$0.next) {
        case 0:
          context$1$0.next = 2;
          return regeneratorRuntime.awrap(System.normalize(moduleName, parent));

        case 2:
          id = context$1$0.sent;
          context$1$0.next = 5;
          return regeneratorRuntime.awrap(sourceOf$1(System, id));

        case 5:
          source = context$1$0.sent;
          parsed = ast.parse(source);
          scope = ast.query.scopes(parsed);
          imports = scope.importDecls.reduce(function (imports, node) {
            var nodes = ast.query.nodesAtIndex(parsed, node.start);
            var importStmt = lively_lang.arr.without(nodes, scope.node)[0];
            if (!importStmt) return imports;

            var from = importStmt.source ? importStmt.source.value : "unknown module";
            if (!importStmt.specifiers.length) // no imported vars
              return imports.concat([{
                localModule: id,
                local: null,
                imported: null,
                fromModule: from,
                importStatement: importStmt
              }]);

            return imports.concat(importStmt.specifiers.map(function (importSpec) {
              var imported;
              if (importSpec.type === "ImportNamespaceSpecifier") imported = "*";else if (importSpec.type === "ImportDefaultSpecifier") imported = "default";else if (importStmt.source) imported = importStmt.source.name;else imported = null;
              return {
                localModule: id,
                local: importSpec.local ? importSpec.local.name : null,
                imported: imported,
                fromModule: from,
                importStatement: importStmt
              };
            }));
          }, []);
          exports = scope.exportDecls.reduce(function (exports, node) {
            var nodes = ast.query.nodesAtIndex(parsed, node.start);
            var exportsStmt = lively_lang.arr.without(nodes, scope.node)[0];
            if (!exportsStmt) return exports;

            if (exportsStmt.type === "ExportAllDeclaration") {
              var from = exportsStmt.source ? exportsStmt.source.value : null;
              return exports.concat([{
                localModule: id,
                local: null,
                exported: "*",
                fromModule: from,
                exportStatement: exportsStmt
              }]);
            }

            return exports.concat(exportsStmt.specifiers.map(function (exportSpec) {
              return {
                localModule: id,
                local: exportSpec.local ? exportSpec.local.name : null,
                exported: exportSpec.exported ? exportSpec.exported.name : null,
                fromModule: id,
                exportStatement: exportsStmt
              };
            }));
          }, []);
          return context$1$0.abrupt("return", {
            imports: lively_lang.arr.uniqBy(imports, function (a, b) {
              return a.local == b.local && a.imported == b.imported && a.fromModule == b.fromModule;
            }),
            exports: lively_lang.arr.uniqBy(exports, function (a, b) {
              return a.local == b.local && a.exported == b.exported && a.fromModule == b.fromModule;
            })
          });

        case 11:
        case "end":
          return context$1$0.stop();
      }
    }, null, this);
  }

  // compute imports

  function installHook$1(System, hookName, hook) {
    System[hookName] = lively_lang.fun.wrap(System[hookName], hook);
    System[hookName].hookFunc = hook;
  }

  function removeHook$1(System, methodName, hookOrName) {
    var chain = [],
        f = System[methodName];
    while (f) {
      chain.push(f);
      f = f.originalFunction;
    }

    var found = typeof hookOrName === "string" ? chain.find(function (wrapper) {
      return wrapper.hookFunc && wrapper.hookFunc.name === hookOrName;
    }) : chain.find(function (wrapper) {
      return wrapper.hookFunc === hookOrName;
    });

    if (!found) return false;

    lively_lang.arr.remove(chain, found);

    System[methodName] = chain.reduceRight(function (method, wrapper) {
      return lively_lang.fun.wrap(method, wrapper.hookFunc || wrapper);
    });

    return true;
  }

  function isHookInstalled$1(System, methodName, hookOrName) {
    var f = System[methodName];
    while (f) {
      if (f.hookFunc) {
        if (typeof hookOrName === "string" && f.hookFunc.name === hookOrName) return true;else if (f.hookFunc === hookOrName) return true;
      }
      f = f.originalFunction;
    }
    return false;
  }

  var evalCodeTransform = ast.evalSupport.evalCodeTransform;

  var isNode$1 = System.get("@system-env").node;

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // code instrumentation
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  var node_modulesDir = System.normalizeSync("lively.modules/node_modules/");

  var exceptions = [
  // id => id.indexOf(resolve("node_modules/")) > -1,
  // id => canonicalURL(id).indexOf(node_modulesDir) > -1,
  function (id) {
    return lively_lang.string.include(id, "acorn/src");
  }, function (id) {
    return lively_lang.string.include(id, "babel-core/browser.js") || lively_lang.string.include(id, "system.src.js");
  },
  // id => lang.string.include(id, "lively.ast.es6.bundle.js"),
  function (id) {
    return id.slice(-3) !== ".js";
  }];
  var esmFormatCommentRegExp = /['"]format (esm|es6)['"];/;
  var cjsFormatCommentRegExp = /['"]format cjs['"];/;
  var esmRegEx = /(^\s*|[}\);\n]\s*)(import\s+(['"]|(\*\s+as\s+)?[^"'\(\)\n;]+\s+from\s+['"]|\{)|export\s+\*\s+from\s+["']|export\s+(\{|default|function|class|var|const|let|async\s+function))/;
  function prepareCodeForCustomCompile(source, fullname, env, debug) {
    source = String(source);
    var tfmOptions = {
      topLevelVarRecorder: env.recorder,
      varRecorderName: env.recorderName,
      dontTransform: env.dontTransform,
      recordGlobals: true
    },
        isGlobal = env.recorderName === "System.global",
        header = debug ? "console.log(\"[lively.modules] executing module " + fullname + "\");\n" : "",
        footer = "";

    // FIXME how to update exports in that case?
    if (!isGlobal) {
      header += "var " + env.recorderName + " = System.get(\"@lively-env\").moduleEnv(\"" + fullname + "\").recorder;";
      footer += "\nSystem.get(\"@lively-env\").evaluationDone(\"" + fullname + "\");";
    }

    try {
      var rewrittenSource = header + evalCodeTransform(source, tfmOptions) + footer;
      if (debug && typeof $morph !== "undefined" && $morph("log")) $morph("log").textString = rewrittenSource;
      return rewrittenSource;
    } catch (e) {
      console.error("Error in prepareCodeForCustomCompile", e.stack);
      return source;
    }
  }

  function getCachedNodejsModule(System, load) {
    // On nodejs we might run alongside normal node modules. To not load those
    // twice we have this little hack...
    try {
      var Module = System._nodeRequire("module").Module,
          id = Module._resolveFilename(load.name.replace(/^file:\/\//, "")),
          nodeModule = Module._cache[id];
      return nodeModule;
    } catch (e) {
      System.debug && console.log("[lively.modules getCachedNodejsModule] %s unknown to nodejs", load.name);
    }
    return null;
  }

  function addNodejsWrapperSource(System, load) {
    // On nodejs we might run alongside normal node modules. To not load those
    // twice we have this little hack...
    var m = getCachedNodejsModule(System, load);
    if (m) {
      load.source = "export default System._nodeRequire('" + m.id + "');\n";
      load.source += lively_lang.properties.allOwnPropertiesOrFunctions(m.exports).map(function (k) {
        return lively_lang.classHelper.isValidIdentifier(k) ? "export var " + k + " = System._nodeRequire('" + m.id + "')['" + k + "'];" : "/*ignoring export \"" + k + "\" b/c it is not a valid identifier*/";
      }).join("\n");
      System.debug && console.log("[lively.modules customTranslate] loading %s from nodejs module cache", load.name);
      return true;
    }
    System.debug && console.log("[lively.modules customTranslate] %s not yet in nodejs module cache", load.name);
    return false;
  }

  function customTranslate(proceed, load) {
    // load like
    // {
    //   address: "file:///Users/robert/Lively/lively-dev/lively.vm/tests/test-resources/some-es6-module.js",
    //   name: "file:///Users/robert/Lively/lively-dev/lively.vm/tests/test-resources/some-es6-module.js",
    //   metadata: { deps: [/*...*/], entry: {/*...*/}, format: "esm", sourceMap: ... },
    //   source: "..."
    // }

    var System = this,
        debug = System.debug;

    if (exceptions.some(function (exc) {
      return exc(load.name);
    })) {
      debug && console.log("[lively.modules customTranslate ignoring] %s", load.name);
      return proceed(load);
    }
    if (isNode$1 && addNodejsWrapperSource(System, load)) {
      debug && console.log("[lively.modules] loaded %s from nodejs cache", load.name);
      return proceed(load);
    }

    var start = Date.now();

    var isEsm = load.metadata.format == 'esm' || load.metadata.format == 'es6' || !load.metadata.format && esmFormatCommentRegExp.test(load.source.slice(0, 5000)) || !load.metadata.format && !cjsFormatCommentRegExp.test(load.source.slice(0, 5000)) && esmRegEx.test(load.source),
        isCjs = load.metadata.format == 'cjs',
        isGlobal = load.metadata.format == 'global' || !load.metadata.format,
        env = moduleEnv$1(System, load.name),
        instrumented = false;

    if (isEsm) {
      load.metadata.format = "esm";
      load.source = prepareCodeForCustomCompile(load.source, load.name, env, debug);
      load.metadata["lively.modules instrumented"] = true;
      instrumented = true;
      debug && console.log("[lively.modules] loaded %s as es6 module", load.name);
      // debug && console.log(load.source)
    } else if (isCjs && isNode$1) {
        load.metadata.format = "cjs";
        var id = cjs.resolve(load.address.replace(/^file:\/\//, ""));
        load.source = cjs._prepareCodeForCustomCompile(load.source, id, cjs.envFor(id), debug);
        load.metadata["lively.modules instrumented"] = true;
        instrumented = true;
        debug && console.log("[lively.modules] loaded %s as instrumented cjs module", load.name);
        // console.log("[lively.modules] no rewrite for cjs module", load.name)
      } else if (load.metadata.format === "global") {
          env.recorderName = "System.global";
          env.recorder = System.global;
          load.metadata.format = "global";
          load.source = prepareCodeForCustomCompile(load.source, load.name, env, debug);
          load.metadata["lively.modules instrumented"] = true;
          instrumented = true;
          debug && console.log("[lively.modules] loaded %s as instrumented global module", load.name);
        }

    if (!instrumented) {
      debug && console.log("[lively.modules] customTranslate ignoring %s b/c don't know how to handle format %s", load.name, load.metadata.format);
    }

    debug && console.log("[lively.modules customTranslate] done %s after %sms", load.name, Date.now() - start);
    return proceed(load);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // Functions below are for re-loading modules from change.js. We typically
  // start with a load object that skips the normalize / fetch step. Since we need
  // to jumo in the "middle" of the load process and SystemJS does not provide an
  // interface to this, we need to invoke the translate / instantiate / execute
  // manually
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  function instrumentSourceOfEsmModuleLoad(System, load) {
    // brittle!
    // The result of System.translate is source code for a call to
    // System.register that can't be run standalone. We parse the necessary
    // details from it that we will use to re-define the module
    // (dependencies, setters, execute)
    // Note: this only works for esm modules!

    return System.translate(load).then(function (translated) {
      // translated looks like
      // (function(__moduleName){System.register(["./some-es6-module.js", ...], function (_export) {
      //   "use strict";
      //   var x, z, y;
      //   return {
      //     setters: [function (_someEs6ModuleJs) { ... }],
      //     execute: function () {...}
      //   };
      // });

      var parsed = ast.parse(translated),
          call = parsed.body[0].expression,
          moduleName = call.arguments[0].value,
          registerCall = call.callee.body.body[0].expression,
          depNames = lively_lang.arr.pluck(registerCall["arguments"][0].elements, "value"),
          declareFuncNode = call.callee.body.body[0].expression["arguments"][1],
          declareFuncSource = translated.slice(declareFuncNode.start, declareFuncNode.end),
          declare = eval("var __moduleName = \"" + moduleName + "\";(" + declareFuncSource + ");\n//@ sourceURL=" + moduleName + "\n");

      if (System.debug && typeof $morph !== "undefined" && $morph("log")) $morph("log").textString = declare;

      return { localDeps: depNames, declare: declare };
    });
  }

  function instrumentSourceOfGlobalModuleLoad(System, load) {

    return System.translate(load).then(function (translated) {
      // return {localDeps: depNames, declare: declare};
      return { translated: translated };
    });
  }

  function wrapModuleLoad$1(System) {
    if (isHookInstalled$1(System, "translate", "lively_modules_translate_hook")) return;
    installHook$1(System, "translate", function lively_modules_translate_hook(proceed, load) {
      return customTranslate.call(System, proceed, load);
    });
  }

  function unwrapModuleLoad$1(System) {
    removeHook$1(System, "translate", "lively_modules_translate_hook");
  }

  var GLOBAL$1 = typeof window !== "undefined" ? window : typeof Global !== "undefined" ? Global : global;
  var isNode = System.get("@system-env").node;

  var SystemClass = System.constructor;
  if (!SystemClass.systems) SystemClass.systems = {};

  var defaultOptions = {
    notificationLimit: null
  };

  function livelySystemEnv(System) {
    return Object.defineProperties({
      moduleEnv: function moduleEnv(id) {
        return moduleEnv$1(System, id);
      },

      evaluationDone: function evaluationDone(moduleId) {
        addGetterSettersForNewVars(System, moduleId);
        runScheduledExportChanges(System, moduleId);
      },

      dumpConfig: function dumpConfig() {
        return JSON.stringify({
          baseURL: System.baseURL,
          transpiler: System.transpiler,
          defaultJSExtensions: System.defaultJSExtensions,
          map: System.map,
          meta: System.meta,
          packages: System.packages,
          paths: System.paths,
          packageConfigPaths: System.packageConfigPaths
        }, null, 2);
      },

      // this is where the canonical state of the module system is held...
      loadedModules: System["__lively.modules__loadedModules"] || (System["__lively.modules__loadedModules"] = {}),
      pendingExportChanges: System["__lively.modules__pendingExportChanges"] || (System["__lively.modules__pendingExportChanges"] = {}),
      notifications: System["__lively.modules__notifications"] || (System["__lively.modules__notifications"] = []),
      notificationSubscribers: System["__lively.modules__notificationSubscribers"] || (System["__lively.modules__notificationSubscribers"] = {}),
      options: System["__lively.modules__options"] || (System["__lively.modules__options"] = lively_lang.obj.deepCopy(defaultOptions))
    }, {
      itself: { // TODO this is just a test, won't work in all cases...

        get: function get() {
          return System.get(System.normalizeSync("lively.modules/index.js"));
        },
        configurable: true,
        enumerable: true
      }
    });
  }

  function systems() {
    return SystemClass.systems;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // System creation + access interface
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  function nameOfSystem(System) {
    return Object.keys(systems()).detect(function (name) {
      return systems()[name] === System;
    });
  }

  function getSystem(nameOrSystem, config) {
    return nameOrSystem && typeof nameOrSystem !== "string" ? nameOrSystem : systems()[nameOrSystem] || (systems()[nameOrSystem] = makeSystem(config));
  }

  function removeSystem(nameOrSystem) {
    // FIXME "unload" code...???
    var name = nameOrSystem && typeof nameOrSystem !== "string" ? nameOfSystem(nameOrSystem) : nameOrSystem;
    delete systems()[name];
  }function makeSystem(cfg) {
    return prepareSystem(new SystemClass(), cfg);
  }

  function prepareSystem(System, config) {
    System.trace = true;

    System.set("@lively-env", System.newModule(livelySystemEnv(System)));

    wrapModuleLoad$1(System);

    if (!isHookInstalled$1(System, "normalizeHook")) installHook$1(System, "normalize", normalizeHook);

    if (!isHookInstalled$1(System, "normalizeSync", "normalizeSyncHook")) installHook$1(System, "normalizeSync", normalizeSyncHook);

    if (!isHookInstalled$1(System, "fetch", "fetch_lively_protocol")) installHook$1(System, "fetch", fetch_lively_protocol);

    config = lively_lang.obj.merge({ transpiler: 'babel', babelOptions: {} }, config);

    if (isNode) {
      var nodejsCoreModules = ["addons", "assert", "buffer", "child_process", "cluster", "console", "crypto", "dgram", "dns", "domain", "events", "fs", "http", "https", "module", "net", "os", "path", "punycode", "querystring", "readline", "repl", "stream", "stringdecoder", "timers", "tls", "tty", "url", "util", "v8", "vm", "zlib"],
          map = nodejsCoreModules.reduce(function (map, ea) {
        map[ea] = "@node/" + ea;return map;
      }, {});
      config.map = lively_lang.obj.merge(map, config.map);
      // for sth l ike map: {"lively.lang": "node_modules:lively.lang"}
      // cfg.paths = obj.merge({"node_modules:*": "./node_modules/*"}, cfg.paths);
    }

    config.packageConfigPaths = config.packageConfigPaths || ['./node_modules/*/package.json'];
    // if (!cfg.hasOwnProperty("defaultJSExtensions")) cfg.defaultJSExtensions = true;

    System.config(config);

    return System;
  }

  function normalizeHook(proceed, name, parent, parentAddress) {
    var System = this;
    if (name === "..") name = '../index.js'; // Fix ".."

    return proceed(name, parent, parentAddress).then(function (result) {

      // lookup package main
      var base = result.replace(/\.js$/, "");
      if (base in System.packages) {
        var main = System.packages[base].main;
        if (main) return base.replace(/\/$/, "") + "/" + main.replace(/^\.?\//, "");
      }

      // Fix issue with accidentally adding .js
      var m = result.match(/(.*json)\.js/i);
      if (m) return m[1];

      return result;
    });
  }

  function normalizeSyncHook(proceed, name, parent, isPlugin) {
    var System = this;
    if (name === "..") name = '../index.js'; // Fix ".."

    // systemjs' normalizeSync has by default not the fancy
    // '{node: "events", "~node": "@mepty"}' mapping but we need it
    var pkg = parent && normalize_packageOfURL(parent, System);
    if (pkg) {
      var mappedObject = pkg.map && pkg.map[name] || System.map[name];
      if (typeof mappedObject === "object") {
        name = normalize_doMapWithObject(mappedObject, pkg, System) || name;
      }
    }

    var result = proceed(name, parent, isPlugin);

    // lookup package main
    var base = result.replace(/\.js$/, "");
    if (base in System.packages) {
      var main = System.packages[base].main;
      if (main) return base.replace(/\/$/, "") + "/" + main.replace(/^\.?\//, "");
    }

    // Fix issue with accidentally adding .js
    var m = result.match(/(.*json)\.js/i);
    if (m) return m[1];

    return result;
  }

  function normalize_doMapWithObject(mappedObject, pkg, loader) {
    // SystemJS allows stuff like {events: {"node": "@node/events", "~node": "@empty"}}
    // for conditional name lookups based on the environment. The resolution
    // process in SystemJS is asynchronous, this one here synch. to support
    // normalizeSync and a one-step-load
    var env = loader.get(pkg.map['@env'] || '@system-env');
    // first map condition to match is used
    var resolved;
    for (var e in mappedObject) {
      var negate = e[0] == '~';
      var value = normalize_readMemberExpression(negate ? e.substr(1) : e, env);
      if (!negate && value || negate && !value) {
        resolved = mappedObject[e];
        break;
      }
    }

    if (resolved) {
      if (typeof resolved != 'string') throw new Error('Unable to map a package conditional to a package conditional.');
    }
    return resolved;

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    function normalize_readMemberExpression(p, value) {
      var pParts = p.split('.');
      while (pParts.length) value = value[pParts.shift()];
      return value;
    }
  }

  function normalize_packageOfURL(url, System) {
    // given a url like "http://localhost:9001/lively.lang/lib/base.js" finds the
    // corresponding package name in loader.packages, like "http://localhost:9001/lively.lang"
    // ... actually it returns the package
    var packageNames = Object.keys(System.packages || {}),
        matchingPackages = packageNames.map(function (pkgName) {
      return url.indexOf(pkgName) === 0 ? { url: pkgName, penalty: url.slice(pkgName.length).length } : null;
    }).filter(function (ea) {
      return !!ea;
    }),
        pName = matchingPackages.length ? matchingPackages.reduce(function (matchingPkg, ea) {
      return matchingPkg.penalty > ea.penalty ? ea : matchingPkg;
    }).url : null;
    return pName ? System.packages[pName] : null;
  }

  function fetch_lively_protocol(proceed, load) {
    if (load.name.match(/^lively:\/\//)) {
      var match = load.name.match(/lively:\/\/([^\/]+)\/(.*)$/),
          worldId = match[1],
          localObjectName = match[2];
      return typeof $morph !== "undefined" && $morph(localObjectName) && $morph(localObjectName).textString || "/*Could not locate " + load.name + "*/";
    }
    return proceed(load);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // debugging
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  function printSystemConfig$1(System) {
    System = getSystem(System);
    var json = {
      baseURL: System.baseURL,
      transpiler: System.transpiler,
      defaultJSExtensions: System.defaultJSExtensions,
      defaultExtension: System.defaultExtension,
      map: System.map,
      meta: System.meta,
      packages: System.packages,
      paths: System.paths,
      packageConfigPaths: System.packageConfigPaths,
      bundles: System.bundles
    };
    return JSON.stringify(json, null, 2);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // module state
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  function loadedModules$1(System) {
    return System.get("@lively-env").loadedModules;
  }

  function moduleEnv$1(System, moduleId) {
    var ext = System.get("@lively-env");

    if (ext.loadedModules[moduleId]) return ext.loadedModules[moduleId];

    var env = {
      loadError: undefined,
      recorderName: "__lvVarRecorder",
      dontTransform: ["__lvVarRecorder", "global", "self", "_moduleExport", "_moduleImport", "fetch" // doesn't like to be called as a method, i.e. __lvVarRecorder.fetch
      ].concat(ast.query.knownGlobals),
      recorder: Object.create(GLOBAL$1, {
        _moduleExport: {
          get: function get() {
            return function (name, val) {
              return scheduleModuleExportsChange(System, moduleId, name, val, true /*add export*/);
            };
          }
        },
        _moduleImport: {
          get: function get() {
            return function (imported, name) {
              var id = System.normalizeSync(imported, moduleId),
                  imported = System._loader.modules[id];
              if (!imported) throw new Error("import of " + name + " failed: " + imported + " (tried as " + id + ") is not loaded!");
              if (name == undefined) return imported.module;
              if (!imported.module.hasOwnProperty(name)) console.warn("import from " + imported + ": Has no export " + name + "!");
              return imported.module[name];
            };
          }
        }
      })
    };

    env.recorder.System = System;

    return ext.loadedModules[moduleId] = env;
  }

  function addGetterSettersForNewVars(System, moduleId) {
    // after eval we modify the env so that all captures vars are wrapped in
    // getter/setter to be notified of changes
    // FIXME: better to not capture via assignments but use func calls...!
    var rec = moduleEnv$1(System, moduleId).recorder,
        prefix = "__lively.modules__";

    if (rec === System.global) {
      console.warn("[lively.modules] addGetterSettersForNewVars: recorder === global, refraining from installing setters!");
      return;
    }

    lively_lang.properties.own(rec).forEach(function (key) {
      if (key.indexOf(prefix) === 0 || rec.__lookupGetter__(key)) return;
      Object.defineProperty(rec, prefix + key, {
        enumerable: false,
        writable: true,
        value: rec[key]
      });
      Object.defineProperty(rec, key, {
        enumerable: true,
        get: function get() {
          return rec[prefix + key];
        },
        set: function set(v) {
          scheduleModuleExportsChange(System, moduleId, key, v, false /*add export*/);
          return rec[prefix + key] = v;
        }
      });
    });
  }

  function sourceOf$1(System, moduleName, parent) {
    return System.normalize(moduleName, parent).then(function (id) {
      var load = System.loads && System.loads[id] || {
        status: 'loading', address: id, name: id,
        linkSets: [], dependencies: [], metadata: {} };
      return System.fetch(load);
    });
  }

  function metadata(System, moduleId) {
    var load = System.loads ? System.loads[moduleId] : null;
    return load ? load.metadata : null;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // module records
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  function moduleRecordFor$1(System, fullname) {
    var record = System._loader.moduleRecords[fullname];
    if (!record) return null;
    if (!record.hasOwnProperty("__lively_modules__")) record.__lively_modules__ = { evalOnlyExport: {} };
    return record;
  }

  function updateModuleRecordOf(System, fullname, doFunc) {
    var record = moduleRecordFor$1(System, fullname);
    if (!record) throw new Error("es6 environment global of " + fullname + ": module not loaded, cannot get export object!");
    record.locked = true;
    try {
      return doFunc(record);
    } finally {
      record.locked = false;
    }
  }

  function forgetEnvOf(System, fullname) {
    delete System["__lively.modules__"].loadedModules[fullname];
  }

  function forgetModuleDeps(System, moduleName, opts) {
    opts = lively_lang.obj.merge({ forgetDeps: true, forgetEnv: true }, opts);
    var id = System.normalizeSync(moduleName),
        deps = findDependentsOf$1(System, id);
    deps.forEach(function (ea) {
      System["delete"](ea);
      if (System.loads) delete System.loads[ea];
      opts.forgetEnv && forgetEnvOf(System, ea);
    });
    return id;
  }

  function forgetModule$1(System, moduleName, opts) {
    opts = lively_lang.obj.merge({ forgetDeps: true, forgetEnv: true }, opts);
    var id = opts.forgetDeps ? forgetModuleDeps(System, moduleName, opts) : System.normalizeSync(moduleName);
    System["delete"](moduleName);
    System["delete"](id);
    if (System.loads) {
      delete System.loads[moduleName];
      delete System.loads[id];
    }
    if (opts.forgetEnv) {
      forgetEnvOf(System, id);
      forgetEnvOf(System, moduleName);
    }
  }

  function reloadModule$1(System, moduleName, opts) {
    opts = lively_lang.obj.merge({ reloadDeps: true, resetEnv: true }, opts);
    var id = System.normalizeSync(moduleName),
        toBeReloaded = [id];
    if (opts.reloadDeps) toBeReloaded = findDependentsOf$1(System, id).concat(toBeReloaded);
    forgetModule$1(System, id, { forgetDeps: opts.reloadDeps, forgetEnv: opts.resetEnv });
    return Promise.all(toBeReloaded.map(function (ea) {
      return ea !== id && System["import"](ea);
    })).then(function () {
      return System["import"](id);
    });
  }

  // function computeRequireMap() {
  //   return Object.keys(_currentSystem.loads).reduce((requireMap, k) => {
  //     requireMap[k] = lang.obj.values(_currentSystem.loads[k].depMap);
  //     return requireMap;
  //   }, {});
  // }

  function computeRequireMap(System) {
    if (System.loads) {
      var store = System.loads,
          modNames = lively_lang.arr.uniq(Object.keys(loadedModules$1(System)).concat(Object.keys(store)));
      return modNames.reduce(function (requireMap, k) {
        var depMap = store[k] ? store[k].depMap : {};
        requireMap[k] = Object.keys(depMap).map(function (localName) {
          var resolvedName = depMap[localName];
          if (resolvedName === "@empty") return resolvedName + "/" + localName;
          return resolvedName;
        });
        return requireMap;
      }, {});
    }

    return Object.keys(System._loader.moduleRecords).reduce(function (requireMap, k) {
      requireMap[k] = System._loader.moduleRecords[k].dependencies.filter(Boolean).map(function (ea) {
        return ea.name;
      });
      return requireMap;
    }, {});
  }

  function findDependentsOf$1(System, name) {
    // which modules (module ids) are (in)directly import module with id
    // Let's say you have
    // module1: export var x = 23;
    // module2: import {x} from "module1.js"; export var y = x + 1;
    // module3: import {y} from "module2.js"; export var z = y + 1;
    // `findDependentsOf` gives you an answer what modules are "stale" when you
    // change module1 = module2 + module3
    var id = System.normalizeSync(name);
    return lively_lang.graph.hull(lively_lang.graph.invert(computeRequireMap(System)), id);
  }

  function findRequirementsOf$1(System, name) {
    // which modules (module ids) are (in)directly required by module with id
    // Let's say you have
    // module1: export var x = 23;
    // module2: import {x} from "module1.js"; export var y = x + 1;
    // module3: import {y} from "module2.js"; export var z = y + 1;
    // `findRequirementsOf("./module3")` will report ./module2 and ./module1
    var id = System.normalizeSync(name);
    return lively_lang.graph.hull(computeRequireMap(System), id);
  }

  var join = lively_lang.string.joinPath;

  function isURL(string) {
    return (/^[^:\\]+:\/\//.test(string)
    );
  }

  function urlResolve(url) {
    var urlMatch = url.match(/^([^:]+:\/\/)(.*)/);
    if (!urlMatch) return url;

    var protocol = urlMatch[1],
        path = urlMatch[2],
        result = path;
    // /foo/../bar --> /bar
    do {
      path = result;
      result = path.replace(/\/[^\/]+\/\.\./, '');
    } while (result != path);
    // foo//bar --> foo/bar
    result = result.replace(/(^|[^:])[\/]+/g, '$1/');
    // foo/./bar --> foo/bar
    result = result.replace(/\/\.\//g, '/');
    return protocol + result;
  }

  function normalizeInsidePackage(System, urlOrName, packageURL) {
    return isURL(urlOrName) ? urlOrName : // absolute
    urlResolve(join(urlOrName[0] === "." ? packageURL : System.baseURL, urlOrName)); // relative to either the package or the system:
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // packages
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  function importPackage$1(System, packageURL) {
    return regeneratorRuntime.async(function importPackage$(context$1$0) {
      while (1) switch (context$1$0.prev = context$1$0.next) {
        case 0:
          context$1$0.next = 2;
          return regeneratorRuntime.awrap(registerPackage$1(System, packageURL));

        case 2:
          context$1$0.t0 = System;
          context$1$0.next = 5;
          return regeneratorRuntime.awrap(System.normalize(packageURL));

        case 5:
          context$1$0.t1 = context$1$0.sent;
          return context$1$0.abrupt("return", context$1$0.t0["import"].call(context$1$0.t0, context$1$0.t1));

        case 7:
        case "end":
          return context$1$0.stop();
      }
    }, null, this);
  }

  function registerPackage$1(System, packageURL, packageLoadStack) {
    var url, registerSubPackages, packageInSystem, cfg, packageConfigResult, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, subp;

    return regeneratorRuntime.async(function registerPackage$(context$1$0) {
      while (1) switch (context$1$0.prev = context$1$0.next) {
        case 0:
          context$1$0.next = 2;
          return regeneratorRuntime.awrap(System.normalize(packageURL));

        case 2:
          url = context$1$0.sent;

          if (isURL(url)) {
            context$1$0.next = 5;
            break;
          }

          return context$1$0.abrupt("return", Promise.reject(new Error("Error registering package: " + url + " is not a valid URL")));

        case 5:

          // ensure it's a directory
          if (!url.match(/\.js/)) url = url;else if (url.indexOf(url + ".js") > -1) url = url.replace(/\.js$/, "");else url = url.split("/").slice(0, -1).join("/");

          if (!url.match(/\.js$/)) {
            context$1$0.next = 8;
            break;
          }

          return context$1$0.abrupt("return", Promise.reject(new Error("[registerPackage] packageURL is expected to point to a directory but seems to be a .js file: " + url)));

        case 8:

          url = String(url).replace(/\/$/, "");

          packageLoadStack = packageLoadStack || [];
          registerSubPackages = true;

          // stop here to support circular deps
          if (packageLoadStack.indexOf(url) !== -1) {
            registerSubPackages = false;
            System.debug && console.log("[lively.modules package register] %s is a circular dependency, stopping registerign subpackages", url);
          } else packageLoadStack.push(url);

          System.debug && console.log("[lively.modules package register] %s", url);

          packageInSystem = System.packages[url] || (System.packages[url] = {});
          context$1$0.next = 16;
          return regeneratorRuntime.awrap(tryToLoadPackageConfig(System, url));

        case 16:
          cfg = context$1$0.sent;
          context$1$0.next = 19;
          return regeneratorRuntime.awrap(applyConfig(System, cfg, url));

        case 19:
          packageConfigResult = context$1$0.sent;

          if (!registerSubPackages) {
            context$1$0.next = 47;
            break;
          }

          _iteratorNormalCompletion = true;
          _didIteratorError = false;
          _iteratorError = undefined;
          context$1$0.prev = 24;
          _iterator = packageConfigResult.subPackages[Symbol.iterator]();

        case 26:
          if (_iteratorNormalCompletion = (_step = _iterator.next()).done) {
            context$1$0.next = 33;
            break;
          }

          subp = _step.value;
          context$1$0.next = 30;
          return regeneratorRuntime.awrap(registerPackage$1(System, subp.address.replace(/\/?$/, "/"), packageLoadStack));

        case 30:
          _iteratorNormalCompletion = true;
          context$1$0.next = 26;
          break;

        case 33:
          context$1$0.next = 39;
          break;

        case 35:
          context$1$0.prev = 35;
          context$1$0.t0 = context$1$0["catch"](24);
          _didIteratorError = true;
          _iteratorError = context$1$0.t0;

        case 39:
          context$1$0.prev = 39;
          context$1$0.prev = 40;

          if (!_iteratorNormalCompletion && _iterator["return"]) {
            _iterator["return"]();
          }

        case 42:
          context$1$0.prev = 42;

          if (!_didIteratorError) {
            context$1$0.next = 45;
            break;
          }

          throw _iteratorError;

        case 45:
          return context$1$0.finish(42);

        case 46:
          return context$1$0.finish(39);

        case 47:
          return context$1$0.abrupt("return", cfg.name);

        case 48:
        case "end":
          return context$1$0.stop();
      }
    }, null, this, [[24, 35, 39, 47], [40,, 42, 46]]);
  }

  function tryToLoadPackageConfig(System, packageURL) {
    var packageConfigURL = packageURL + "/package.json";

    System.config({
      meta: babelHelpers.defineProperty({}, packageConfigURL, { format: "json" }),
      packages: babelHelpers.defineProperty({}, packageURL, { meta: { "package.json": { format: "json" } } })
    });

    System.debug && console.log("[lively.modules package reading config] %s", packageConfigURL);

    return Promise.resolve(System.get(packageConfigURL) || System["import"](packageConfigURL)).then(function (config) {
      lively_lang.arr.pushIfNotIncluded(System.packageConfigPaths, packageConfigURL);
      return config;
    })["catch"](function (err) {
      console.log("[lively.modules package] Unable loading package config %s for package: ", packageConfigURL, err);
      delete System.meta[packageConfigURL];
      var name = packageURL.split("/").slice(-1)[0];
      return { name: name }; // "pseudo-config"
    });
  }

  function applyConfig(System, packageConfig, packageURL) {
    // takes a config json object (typically read from a package.json file but
    // can be used standalone) and changes the System configuration to what it finds
    // in it.
    // In particular uses the "systemjs" section as described in https://github.com/systemjs/systemjs/blob/master/docs/config-api.md
    // and uses the "lively" section as described in `applyLivelyConfig`

    var name = packageConfig.name || packageURL.split("/").slice(-1)[0],
        packageInSystem = System.packages[packageURL] || (System.packages[packageURL] = {}),
        sysConfig = packageConfig.systemjs,
        livelyConfig = packageConfig.lively,
        main = packageConfig.main || "index.js";
    System.config({ map: babelHelpers.defineProperty({}, name, packageURL) });

    if (!packageInSystem.map) packageInSystem.map = {};

    if (sysConfig) {
      if (sysConfig.packageConfigPaths) System.packageConfigPaths = lively_lang.arr.uniq(System.packageConfigPaths.concat(sysConfig.packageConfigPaths));
      if (sysConfig.main) main = sysConfig.main;
      applySystemJSConfig(System, packageConfig, packageURL);
    }

    var packageApplyResult = livelyConfig ? applyLivelyConfig(System, livelyConfig, packageURL) : { subPackages: [] };

    packageInSystem.names = packageInSystem.names || [];
    lively_lang.arr.pushIfNotIncluded(packageInSystem.names, name);
    if (!main.match(/\.[^\/\.]+/)) main += ".js";
    packageInSystem.main = main;

    return packageApplyResult;
  }

  function applySystemJSConfig(System, systemjsConfig, packageURL) {}

  function applyLivelyConfig(System, livelyConfig, packageURL) {
    // configures System object from lively config JSON object.
    // - adds System.package entry for packageURL
    // - adds name to System.package[packageURL].names
    // - installs hook from {hooks: [{name, source}]}
    // - merges livelyConfig.packageMap into System.package[packageURL].map
    //   entries in packageMap are specifically meant to be sub-packages!
    // Will return a {subPackages: [{name, address},...]} object
    applyLivelyConfigMeta(System, livelyConfig, packageURL);
    applyLivelyConfigHooks(System, livelyConfig, packageURL);
    applyLivelyConfigBundles(System, livelyConfig, packageURL);
    return applyLivelyConfigPackageMap(System, livelyConfig, packageURL);
  }

  function applyLivelyConfigHooks(System, livelyConfig, packageURL) {
    (livelyConfig.hooks || []).forEach(function (h) {
      try {
        var f = eval("(" + h.source + ")");
        if (!f.name || !isHookInstalled$1(System, h.target, f.name)) installHook$1(System, h.target, f);
      } catch (e) {
        console.error("Error installing hook for %s: %s", packageURL, e, h);
      }
    });
  }

  function applyLivelyConfigBundles(System, livelyConfig, packageURL) {
    if (!livelyConfig.bundles) return Promise.resolve();
    var normalized = Object.keys(livelyConfig.bundles).reduce(function (bundles, name) {
      var absName = packageURL.replace(/\/$/, "") + "/" + name;
      var files = livelyConfig.bundles[name].map(function (f) {
        return System.normalizeSync(f, packageURL + "/");
      });
      bundles[absName] = files;
      return bundles;
    }, {});
    System.config({ bundles: normalized });
    return Promise.resolve();
  }

  function applyLivelyConfigMeta(System, livelyConfig, packageURL) {
    if (!livelyConfig.meta) return;
    var pConf = System.packages[packageURL];
    Object.keys(livelyConfig.meta).forEach(function (key) {
      var val = livelyConfig.meta[key];
      if (isURL(key)) {
        System.meta[key] = val;
      } else {
        if (!pConf.meta) pConf.meta = {};
        pConf.meta[key] = val;
      }
    });
  }

  function applyLivelyConfigPackageMap(System, livelyConfig, packageURL) {
    var subPackages = livelyConfig.packageMap ? Object.keys(livelyConfig.packageMap).map(function (name) {
      return subpackageNameAndAddress(System, livelyConfig, name, packageURL);
    }) : [];
    return { subPackages: subPackages };
  }

  function subpackageNameAndAddress(System, livelyConfig, subPackageName, packageURL) {
    var pConf = System.packages[packageURL],
        preferLoadedPackages = livelyConfig.hasOwnProperty("preferLoadedPackages") ? livelyConfig.preferLoadedPackages : true;

    var normalized = System.normalizeSync(subPackageName, packageURL + "/");
    if (preferLoadedPackages && (pConf.map[subPackageName] || System.map[subPackageName] || System.get(normalized))) {
      var subpackageURL;
      if (pConf.map[subPackageName]) subpackageURL = normalizeInsidePackage(System, pConf.map[subPackageName], packageURL);else if (System.map[subPackageName]) subpackageURL = normalizeInsidePackage(System, System.map[subPackageName], packageURL);else subpackageURL = normalized;
      System.debug && console.log("[lively.module package] Package %s required by %s already in system as %s", subPackageName, packageURL, subpackageURL);
      return { name: subPackageName, address: subpackageURL };
    }

    pConf.map[subPackageName] = livelyConfig.packageMap[subPackageName];

    // lookup
    var subpackageURL = normalizeInsidePackage(System, livelyConfig.packageMap[subPackageName], packageURL);
    System.debug && console.log("[lively.module package] Package %s required by %s NOT in system, will be loaded as %s", subPackageName, packageURL, subpackageURL);
    return { name: subPackageName, address: subpackageURL };
  }

  function groupIntoPackages(System, moduleNames, packageNames) {

    return lively_lang.arr.groupBy(moduleNames, groupFor);

    function groupFor(moduleName) {
      var fullname = System.normalizeSync(moduleName),
          matching = packageNames.filter(function (p) {
        return fullname.indexOf(p) === 0;
      });
      return matching.length ? matching.reduce(function (specific, ea) {
        return ea.length > specific.length ? ea : specific;
      }) : "no group";
    }
  }

  function getPackages$1(System) {
    // returns a map like
    // ```
    // {
    // package-address: {
    //   address: package-address,
    //   modules: [module-name-1, module-name-2, ...],
    //   name: package-name,
    //   names: [package-name, ...]
    // }, ...
    // ```

    var map = computeRequireMap(System),
        modules = Object.keys(map),
        packages = Object.keys(System.packages),
        result = {};

    groupIntoPackages(System, modules, packages).mapGroups(function (packageAddress, moduleNames) {
      var p = System.packages[packageAddress],
          names = p ? p.names : [];
      if (!names || !names.length) names = [packageAddress.replace(/^(?:.+\/)?([^\/]+)$/, "$1")];

      moduleNames = moduleNames.filter(function (name) {
        return name !== packageAddress && name !== packageAddress + "/";
      });

      result[packageAddress] = {
        address: packageAddress,
        name: names[0],
        names: names,
        modules: moduleNames.map(function (name) {
          return {
            name: name,
            deps: map[name]
          };
        })
      };
    });

    return result;
  }

  // *after* the package is registered the normalize call should resolve to the
  // package's main module

  var eventTypes = ["modulechange", "doitrequest", "doitresult"];

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // genric stuff
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  function getNotifications$1(System) {
    return System["__lively.modules__"].notifications;
  }

  function truncateNotifications(System) {
    var limit = System["__lively.modules__"].options.notificationLimit;
    if (limit) {
      var notifications = getNotifications$1(System);
      notifications.splice(0, notifications.length - limit);
    }
  }

  function record(System, event) {
    getNotifications$1(System).push(event);
    truncateNotifications(System);
    notifySubscriber(System, event.type, event);
    return event;
  }

  function recordModuleChange(System, moduleId, oldSource, newSource, error, options, time) {
    return record(System, {
      type: "modulechange",
      module: moduleId,
      oldCode: oldSource, newCode: newSource,
      error: error, options: options,
      time: time || Date.now()
    });
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // subscriptions
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  function notifySubscriber(System, type, data) {
    subsribersForType(System, type).forEach(function (_ref) {
      var name = _ref.name;
      var handler = _ref.handler;

      try {
        handler(data);
      } catch (e) {
        console.error("Error in lively.modules notification handler " + (name || handler) + ":\n" + e.stack);
      }
    });
  }

  function subsribersForType(System, type) {
    var subscribers = System["__lively.modules__"].notificationSubscribers;
    return subscribers[type] || (subscribers[type] = []);
  }

  function _addSubscriber(System, name, type, handlerFunc) {
    var subscribers = subsribersForType(System, type);
    if (name) _removeNamedSubscriptionOfType(System, name, type);
    subscribers.push({ name: name, handler: handlerFunc });
  }

  function _removeNamedSubscriptionOfType(System, name, type) {
    var subscribers = subsribersForType(System, type);
    subscribers.forEach(function (ea, i) {
      return ea.name === name && subscribers.splice(i, 1);
    });
  }

  function subscribe$1(System, type, name, handlerFunc) {
    if (typeof name === "function") {
      handlerFunc = name;
      name = undefined;
    }

    if (typeof type === "function") {
      handlerFunc = type;
      type = undefined;
      name = undefined;
    }

    if (type && eventTypes.indexOf(type) === -1) throw new Error("Unknown notification type " + type);
    if (typeof handlerFunc !== "function") throw new Error("handlerFunc in subscribe is not a function " + handlerFunc);
    var types = type ? [type] : eventTypes;
    types.forEach(function (type) {
      return _addSubscriber(System, name, type, handlerFunc);
    });
  }

  function moduleSourceChange$1(System, moduleName, newSource, options) {
    var oldSource, moduleId;
    return System.normalize(moduleName).then(function (id) {
      return moduleId = id;
    }).then(function () {
      return sourceOf$1(System, moduleId).then(function (source) {
        return oldSource = source;
      });
    }).then(function () {
      var meta = metadata(System, moduleId);
      switch (meta ? meta.format : undefined) {
        case 'es6':case 'esm':case undefined:
          return moduleSourceChangeEsm(System, moduleId, newSource, options);

        case 'global':
          return moduleSourceChangeGlobal(System, moduleId, newSource, options);

        default:
          throw new Error("moduleSourceChange is not supported for module " + moduleId + " with format ");
      }
    }).then(function (result) {
      recordModuleChange(System, moduleId, oldSource, newSource, null, options, Date.now());
      return result;
    }, function (error) {
      recordModuleChange(System, moduleId, oldSource, newSource, error, options, Date.now());
      throw error;
    });
  }

  function moduleSourceChangeEsm(System, moduleId, newSource, options) {
    var debug, load, updateData, _exports, declared, deps, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, depName, fullname, depModule, record, prevLoad;

    return regeneratorRuntime.async(function moduleSourceChangeEsm$(context$1$0) {
      while (1) switch (context$1$0.prev = context$1$0.next) {
        case 0:
          debug = System.debug, load = {
            status: 'loading',
            source: newSource,
            name: moduleId,
            address: moduleId,
            linkSets: [],
            dependencies: [],
            metadata: { format: "esm" }
          };

          if (System.get(moduleId)) {
            context$1$0.next = 4;
            break;
          }

          context$1$0.next = 4;
          return regeneratorRuntime.awrap(System["import"](moduleId));

        case 4:
          context$1$0.next = 6;
          return regeneratorRuntime.awrap(instrumentSourceOfEsmModuleLoad(System, load));

        case 6:
          updateData = context$1$0.sent;
          _exports = function _exports(name, val) {
            return scheduleModuleExportsChange(System, load.name, name, val);
          }, declared = updateData.declare(_exports);

          System.get("@lively-env").evaluationDone(load.name);

          debug && console.log("[lively.vm es6] sourceChange of %s with deps", load.name, updateData.localDeps);

          // ensure dependencies are loaded
          deps = [];
          _iteratorNormalCompletion = true;
          _didIteratorError = false;
          _iteratorError = undefined;
          context$1$0.prev = 14;
          _iterator = updateData.localDeps[Symbol.iterator]();

        case 16:
          if (_iteratorNormalCompletion = (_step = _iterator.next()).done) {
            context$1$0.next = 32;
            break;
          }

          depName = _step.value;
          context$1$0.next = 20;
          return regeneratorRuntime.awrap(System.normalize(depName, load.name));

        case 20:
          fullname = context$1$0.sent;
          context$1$0.t0 = System.get(fullname);

          if (context$1$0.t0) {
            context$1$0.next = 26;
            break;
          }

          context$1$0.next = 25;
          return regeneratorRuntime.awrap(System["import"](fullname));

        case 25:
          context$1$0.t0 = context$1$0.sent;

        case 26:
          depModule = context$1$0.t0;
          record = moduleRecordFor$1(System, fullname);

          deps.push({
            name: depName,
            fullname: fullname,
            module: depModule,
            record: moduleRecordFor$1(System, fullname)
          });

        case 29:
          _iteratorNormalCompletion = true;
          context$1$0.next = 16;
          break;

        case 32:
          context$1$0.next = 38;
          break;

        case 34:
          context$1$0.prev = 34;
          context$1$0.t1 = context$1$0["catch"](14);
          _didIteratorError = true;
          _iteratorError = context$1$0.t1;

        case 38:
          context$1$0.prev = 38;
          context$1$0.prev = 39;

          if (!_iteratorNormalCompletion && _iterator["return"]) {
            _iterator["return"]();
          }

        case 41:
          context$1$0.prev = 41;

          if (!_didIteratorError) {
            context$1$0.next = 44;
            break;
          }

          throw _iteratorError;

        case 44:
          return context$1$0.finish(41);

        case 45:
          return context$1$0.finish(38);

        case 46:
          record = moduleRecordFor$1(System, load.name);

          if (record) {
            record.dependencies = deps.map(function (ea) {
              return ea.record;
            });
            record.execute = declared.execute;
            record.setters = declared.setters;
          }

          // hmm... for house keeping... not really needed right now, though
          prevLoad = System.loads && System.loads[load.name];

          if (prevLoad) {
            prevLoad.deps = deps.map(function (ea) {
              return ea.name;
            });
            prevLoad.depMap = deps.reduce(function (map, dep) {
              map[dep.name] = dep.fullname;return map;
            }, {});
            if (prevLoad.metadata && prevLoad.metadata.entry) {
              prevLoad.metadata.entry.deps = prevLoad.deps;
              prevLoad.metadata.entry.normalizedDeps = deps.map(function (ea) {
                return ea.fullname;
              });
              prevLoad.metadata.entry.declare = updateData.declare;
            }
          }

          // 2. run setters to populate imports
          deps.forEach(function (d, i) {
            return declared.setters[i](d.module);
          });

          // 3. execute module body
          return context$1$0.abrupt("return", declared.execute());

        case 52:
        case "end":
          return context$1$0.stop();
      }
    }, null, this, [[14, 34, 38, 46], [39,, 41, 45]]);
  }

  function moduleSourceChangeGlobal(System, moduleId, newSource, options) {
    var load = {
      status: 'loading',
      source: newSource,
      name: moduleId,
      address: moduleId,
      linkSets: [],
      dependencies: [],
      metadata: { format: "global" }
    };

    return (System.get(moduleId) ? Promise.resolve() : System["import"](moduleId)).

    // translate the source and produce a {declare: FUNCTION, localDeps:
    // [STRING]} object
    then(function (_) {
      return instrumentSourceOfGlobalModuleLoad(System, load);
    }).then(function (updateData) {
      load.source = updateData.translated;
      var entry = doInstantiateGlobalModule(System, load);
      System["delete"](moduleId);
      System.set(entry.name, entry.esModule);
      return entry.module;
    });
  }

  function doInstantiateGlobalModule(System, load) {

    var entry = __createEntry();
    entry.name = load.name;
    entry.esmExports = true;
    load.metadata.entry = entry;

    entry.deps = [];

    for (var g in load.metadata.globals) {
      var gl = load.metadata.globals[g];
      if (gl) entry.deps.push(gl);
    }

    entry.execute = function executeGlobalModule(require, exports, module) {

      // SystemJS exports detection for global modules is based in new props
      // added to the global. In order to allow re-load we remove previously
      // "exported" values
      var prevMeta = metadata(System, module.id),
          exports = prevMeta && prevMeta.entry && prevMeta.entry.module && prevMeta.entry.module.exports;
      if (exports) Object.keys(exports).forEach(function (name) {
        try {
          delete System.global[name];
        } catch (e) {
          console.warn("[lively.modules] executeGlobalModule: Cannot delete global[\"" + name + "\"]");
        }
      });

      var globals;
      if (load.metadata.globals) {
        globals = {};
        for (var g in load.metadata.globals) if (load.metadata.globals[g]) globals[g] = require(load.metadata.globals[g]);
      }

      var exportName = load.metadata.exports;

      if (exportName) load.source += "\nSystem.global[\"" + exportName + "\"] = " + exportName + ";";

      var retrieveGlobal = System.get('@@global-helpers').prepareGlobal(module.id, exportName, globals);

      __evaluateGlobalLoadSource(System, load);

      return retrieveGlobal();
    };

    return runExecuteOfGlobalModule(System, entry);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  function __createEntry() {
    return {
      name: null,
      deps: null,
      originalIndices: null,
      declare: null,
      execute: null,
      executingRequire: false,
      declarative: false,
      normalizedDeps: null,
      groupIndex: null,
      evaluated: false,
      module: null,
      esModule: null,
      esmExports: false
    };
  }

  function __evaluateGlobalLoadSource(System, load) {
    // System clobbering protection (mostly for Traceur)
    var curLoad,
        curSystem,
        callCounter = 0,
        __global = System.global;
    return __exec.call(System, load);

    function preExec(loader, load) {
      if (callCounter++ == 0) curSystem = __global.System;
      __global.System = __global.SystemJS = loader;
    }

    function postExec() {
      if (--callCounter == 0) __global.System = __global.SystemJS = curSystem;
      curLoad = undefined;
    }

    function __exec(load) {
      // if ((load.metadata.integrity || load.metadata.nonce) && supportsScriptExec)
      //   return scriptExec.call(this, load);
      try {
        preExec(this, load);
        curLoad = load;
        (0, eval)(load.source);
        postExec();
      } catch (e) {
        postExec();
        throw new Error("Error evaluating " + load.address + ":\n" + e.stack);
      }
    };
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  function runExecuteOfGlobalModule(System, entry) {
    // if (entry.module) return;

    var exports = {},
        module = entry.module = { exports: exports, id: entry.name };

    // // AMD requires execute the tree first
    // if (!entry.executingRequire) {
    //   for (var i = 0, l = entry.normalizedDeps.length; i < l; i++) {
    //     var depName = entry.normalizedDeps[i];
    //     var depEntry = loader.defined[depName];
    //     if (depEntry)
    //       linkDynamicModule(depEntry, loader);
    //   }
    // }

    // now execute
    entry.evaluated = true;
    var output = entry.execute.call(System.global, function (name) {
      var dep = entry.deps.find(function (dep) {
        return dep === name;
      }),
          loadedDep = dep && System.get(entry.normalizedDeps[entry.deps.indexOf(dep)]) || System.get(System.normalizeSync(name, entry.name));
      if (loadedDep) return loadedDep;
      throw new Error('Module ' + name + ' not declared as a dependency of ' + entry.name);
    }, exports, module);

    if (output) module.exports = output;

    // create the esModule object, which allows ES6 named imports of dynamics
    exports = module.exports;

    // __esModule flag treats as already-named
    var Module = System.get("@system-env").constructor;
    if (exports && (exports.__esModule || exports instanceof Module)) entry.esModule = exports;
    // set module as 'default' export, then fake named exports by iterating properties
    else if (entry.esmExports && exports !== System.global) entry.esModule = System.newModule(exports);
      // just use the 'default' export
      else entry.esModule = { 'default': exports };

    return entry;
  }

  // translate the source and produce a {declare: FUNCTION, localDeps:
  // [STRING]} object

  // evaluate the module source

  // gather the data we need for the update, this includes looking up the
  // imported modules and getting the module record and module object as
  // a fallback (module records only exist for esm modules)

  // 1. update the record so that when its dependencies change and cause a
  // re-execute, the correct code (new version) is run

  var GLOBAL = typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : undefined;

  exports.System = exports.System || prepareSystem(GLOBAL.System);
  function changeSystem(newSystem, makeGlobal) {
    exports.System = newSystem;
    if (makeGlobal) GLOBAL.System = newSystem;
    return newSystem;
  }
  function loadedModules() {
    return Object.keys(lively.modules.requireMap());
  }
  function sourceOf(id) {
    return sourceOf$1(exports.System, id);
  }
  function moduleEnv(id) {
    return moduleEnv$1(exports.System, id);
  }
  function moduleRecordFor(id) {
    return moduleRecordFor$1(exports.System, id);
  }
  function printSystemConfig() {
    return printSystemConfig$1(exports.System);
  }
  function importPackage(packageURL) {
    return importPackage$1(exports.System, packageURL);
  }
  function registerPackage(packageURL) {
    return registerPackage$1(exports.System, packageURL);
  }
  function getPackages(moduleNames) {
    return getPackages$1(exports.System);
  }
  function moduleSourceChange(moduleName, newSource, options) {
    return moduleSourceChange$1(exports.System, moduleName, newSource, options);
  }
  function findDependentsOf(module) {
    return findDependentsOf$1(exports.System, module);
  }
  function findRequirementsOf(module) {
    return findRequirementsOf$1(exports.System, module);
  }
  function forgetModule(module, opts) {
    return forgetModule$1(exports.System, module, opts);
  }
  function reloadModule(module, opts) {
    return reloadModule$1(exports.System, module, opts);
  }
  function requireMap() {
    return computeRequireMap(exports.System);
  }
  function importsAndExportsOf(moduleName) {
    return importsAndExportsOf$1(exports.System, moduleName);
  }
  function isHookInstalled(methodName, hookOrName) {
    return isHookInstalled$1(exports.System, methodName, hookOrName);
  }
  function installHook(hookName, hook) {
    return installHook$1(exports.System, hookName, hook);
  }
  function removeHook(methodName, hookOrName) {
    return removeHook$1(exports.System, methodName, hookOrName);
  }
  function wrapModuleLoad() {
    wrapModuleLoad$1(exports.System);
  }
  function unwrapModuleLoad() {
    unwrapModuleLoad$1(exports.System);
  }
  function getNotifications() {
    return getNotifications$1(exports.System);
  }
  function subscribe(type, name, handlerFunc) {
    return subscribe$1(exports.System, type, name, handlerFunc);
  }
  function unsubscribe(type, nameOrHandlerFunc) {
    return subscribe$1(exports.System, type, nameOrHandlerFunc);
  }

  exports.getSystem = getSystem;
  exports.removeSystem = removeSystem;
  exports.loadedModules = loadedModules;
  exports.printSystemConfig = printSystemConfig;
  exports.changeSystem = changeSystem;
  exports.sourceOf = sourceOf;
  exports.moduleEnv = moduleEnv;
  exports.moduleRecordFor = moduleRecordFor;
  exports.importPackage = importPackage;
  exports.registerPackage = registerPackage;
  exports.getPackages = getPackages;
  exports.moduleSourceChange = moduleSourceChange;
  exports.findDependentsOf = findDependentsOf;
  exports.findRequirementsOf = findRequirementsOf;
  exports.forgetModule = forgetModule;
  exports.reloadModule = reloadModule;
  exports.requireMap = requireMap;
  exports.importsAndExportsOf = importsAndExportsOf;
  exports.isHookInstalled = isHookInstalled;
  exports.installHook = installHook;
  exports.removeHook = removeHook;
  exports.wrapModuleLoad = wrapModuleLoad;
  exports.unwrapModuleLoad = unwrapModuleLoad;
  exports.getNotifications = getNotifications;
  exports.subscribe = subscribe;
  exports.unsubscribe = unsubscribe;

}((this.lively.modules = this.lively.modules || {}),lively.lang,lively.ast,regeneratorRuntime));
  if (typeof module !== "undefined" && module.exports) module.exports = GLOBAL.lively.modules;
})();