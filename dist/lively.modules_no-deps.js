
(function configure() {

  if (System.map['plugin-babel'] && System.map['systemjs-plugin-babel']) {
    console.log("[lively.modules] System seems already to be configured");
    return;
  }

  var pluginBabelPath = System.get("@system-env").browser ?
    findSystemJSPluginBabel_browser() : findSystemJSPluginBabel_node();

  var babel = System.global.babel;

  if (!pluginBabelPath && !babel) {
    console.error("[lively.modules] Could not find path to systemjs-plugin-babel nor a babel global! This will likely break lively.modules!");
    return;
  }

  if (!pluginBabelPath) {
    console.warn("[lively.modules] Could not find path to systemjs-plugin-babel but babel! Will fallback but there might be features in lively.modules that won't work!");
    System.config({transpiler: 'babel'});

  } else {

    console.log("[lively.modules] SystemJS configured with systemjs-plugin-babel transpiler");
    System.config({
      map: {
        'plugin-babel': pluginBabelPath + '/plugin-babel.js',
        'systemjs-babel-build': pluginBabelPath + '/systemjs-babel-browser.js'
      },
      transpiler: 'plugin-babel',
      babelOptions: Object.assign({
        sourceMaps: "inline",
        stage3: true,
        es2015: true,
        modularRuntime: true
      }, System.babelOptions)
    });
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  function findSystemJSPluginBabel_browser() {
    // walks the script tags
    var scripts = [].slice.call(document.getElementsByTagName("script")),
        pluginBabelPath;

    for (var i = 0; i < scripts.length; i++) {
      var src = scripts[i].src;
      // is lively.modules loaded? Use it's node_modules folder
      var index1 = src.indexOf("lively.modules/");
      if (index1 > -1) {
        pluginBabelPath = src.slice(0, index1) + "lively.modules/node_modules/systemjs-plugin-babel";
        break;
      }

      // is systemjs loaded? Assume that systemjs-plugin-babel sits in the same folder...
      var index2 = src.indexOf("systemjs/dist/system");
      if (index2 > -1) {
        pluginBabelPath = src.slice(0, index2) + "systemjs-plugin-babel";
        break;
      }

      // for LivelyKernel environments
      var index3 = src.indexOf("core/lively/bootstrap.js");
      if (index3 > -1) {
        pluginBabelPath = src.slice(0, index3) + "node_modules/lively.modules/node_modules/systemjs-plugin-babel";
        break;
      }
    }

    return pluginBabelPath;
  }

  function findSystemJSPluginBabel_node() {
    try {
      var parent = require.cache[require.resolve("lively.modules")];
      pluginBabelPath = require("module").Module._resolveFilename("systemjs-plugin-babel", parent)
      if (pluginBabelPath) return require('path').dirname(pluginBabelPath);
    } catch (e) {}
    try {
      var pluginBabelPath = require.resolve("systemjs-plugin-babel");
      if (pluginBabelPath) return require('path').dirname(pluginBabelPath);
    } catch (e) {}

    return null;
  }

})();

(function() {
  var GLOBAL = typeof window !== "undefined" ? window :
      typeof global!=="undefined" ? global :
        typeof self!=="undefined" ? self : this;
  this.lively = this.lively || {};
(function (exports,lively_lang,lively_ast,lively_vm) {
  'use strict';

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

  // function computeRequireMap() {
  //   return Object.keys(_currentSystem.loads).reduce((requireMap, k) => {
  //     requireMap[k] = lang.obj.values(_currentSystem.loads[k].depMap);
  //     return requireMap;
  //   }, {});
  // }

  function requireMap$1(System) {
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

  var funcCall = lively_ast.nodes.funcCall;
  var member = lively_ast.nodes.member;
  var literal = lively_ast.nodes.literal;

  var isNode$1 = System.get("@system-env").node;

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // code instrumentation
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  var node_modulesDir = System.decanonicalize("lively.modules/node_modules/");

  var exceptions = [
  // id => id.indexOf(resolve("node_modules/")) > -1,
  // id => canonicalURL(id).indexOf(node_modulesDir) > -1,
  function (id) {
    return lively_lang.string.include(id, "acorn/src");
  }, function (id) {
    return lively_lang.string.include(id, "babel-core/browser.js") || lively_lang.string.include(id, "system.src.js") || lively_lang.string.include(id, "systemjs-plugin-babel");
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
      recordGlobals: true,
      keepPreviouslyDeclaredValues: true,
      currentModuleAccessor: funcCall(member(funcCall(member("System", "get"), literal("@lively-env")), "moduleEnv"), literal(fullname))

    },
        isGlobal = env.recorderName === "System.global",
        header = debug ? "console.log(\"[lively.modules] executing module " + fullname + "\");\n" : "",
        footer = "";

    if (isGlobal) {
      // FIXME how to update exports in that case?
    } else {
      header += "var " + env.recorderName + " = System.get(\"@lively-env\").moduleEnv(\"" + fullname + "\").recorder;";
      footer += "\nSystem.get(\"@lively-env\").evaluationDone(\"" + fullname + "\");";
    }

    try {
      var rewrittenSource = header + lively_vm.evalCodeTransform(source, tfmOptions) + footer;
      if (debug && typeof $morph !== "undefined" && $morph("log")) $morph("log").textString = rewrittenSource;
      return rewrittenSource;
    } catch (e) {
      console.error("Error in prepareCodeForCustomCompile", e.stack);
      return source;
    }
  }

  function prepareTranslatedCodeForSetterCapture(source, fullname, env, debug) {
    source = String(source);
    var tfmOptions = {
      topLevelVarRecorder: env.recorder,
      varRecorderName: env.recorderName,
      dontTransform: env.dontTransform,
      recordGlobals: true,
      currentModuleAccessor: funcCall(member(funcCall(member("System", "get"), literal("@lively-env")), "moduleEnv"), literal(fullname))
    },
        isGlobal = env.recorderName === "System.global";

    try {
      var rewrittenSource = lively_vm.evalCodeTransformOfSystemRegisterSetters(source, tfmOptions);
      if (debug && typeof $morph !== "undefined" && $morph("log")) $morph("log").textString += rewrittenSource;
      return rewrittenSource;
    } catch (e) {
      console.error("Error in prepareTranslatedCodeForSetterCapture", e.stack);
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
      load.metadata.format = 'esm';
      load.source = "var exports = System._nodeRequire('" + m.id + "'); export default exports;\n" + lively_lang.properties.allOwnPropertiesOrFunctions(m.exports).map(function (k) {
        return lively_lang.classHelper.isValidIdentifier(k) ? "export var " + k + " = exports['" + k + "'];" : "/*ignoring export \"" + k + "\" b/c it is not a valid identifier*/";
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
        env = module$2(System, load.name).env(),
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

    return proceed(load).then(function (translated) {
      if (translated.indexOf("System.register(") === 0) {
        debug && console.log("[lively.modules customTranslate] Installing System.register setter captures for %s", load.name);
        translated = prepareTranslatedCodeForSetterCapture(translated, load.name, env, debug);
      }

      debug && console.log("[lively.modules customTranslate] done %s after %sms", load.name, Date.now() - start);
      return translated;
    });
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

      var parsed = lively_ast.parse(translated),
          registerCall = parsed.body[0].expression,
          depNames = lively_lang.arr.pluck(registerCall["arguments"][0].elements, "value"),
          declareFuncNode = registerCall["arguments"][1],
          declareFuncSource = translated.slice(declareFuncNode.start, declareFuncNode.end),
          declare = eval("var __moduleName = \"" + load.name + "\";(" + declareFuncSource + ");\n//@ sourceURL=" + load.name + "\n");

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

  function scheduleModuleExportsChange(System, moduleId, name, value, addNewExport) {
    var pendingExportChanges = System.get("@lively-env").pendingExportChanges,
        rec = module$2(System, moduleId).record();
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
    module$2(System, moduleId).updateRecord(function (record) {

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
      if (newExports.length) {
        var m = System.get(moduleId);
        if (Object.isFrozen(m)) {
          console.warn("[lively.vm es6 updateModuleExports] Since module %s is frozen a new module object was installed in the system. Note that only(!) exisiting module bindings are updated. New exports that were added will only be available in already loaded modules after those are reloaded!", moduleId);
          System.set(moduleId, System.newModule(record.exports));
        } else {
          debug && console.log("[lively.vm es6 updateModuleExports] adding new exports to %s", moduleId);
          newExports.forEach(function (name) {
            Object.defineProperty(m, name, {
              configurable: false, enumerable: true,
              get: function get() {
                return record.exports[name];
              },
              set: function set() {
                throw new Error("exports cannot be changed from the outside");
              }
            });
          });
        }
      }
      if (existingExports.length) {
        debug && console.log("[lively.vm es6 updateModuleExports] updating %s dependents of %s", record.importers.length, moduleId);
        for (var i = 0, l = record.importers.length; i < l; i++) {
          var importerModule = record.importers[i];
          if (!importerModule.locked) {
            // via the module bindings to importer modules we refresh the values
            // bound in those modules by triggering the setters defined in the
            // records of those modules
            var importerIndex,
                found = importerModule.dependencies.some(function (dep, i) {
              importerIndex = i;
              return dep && dep.name === record.name;
            });
            if (found) {
              importerModule.setters[importerIndex](record.exports);
            }

            // rk 2016-06-09: for now don't re-execute dependent modules on save,
            // just update module bindings
            if (false) {} else {
              module$2(System, importerModule.name).evaluationDone();
            }
          }
        }
      }
    });
  }

  var eventTypes = ["modulechange", "doitrequest", "doitresult"];

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // genric stuff
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  function getNotifications$1(System) {
    return System.get("@lively-env").notifications;
  }

  function truncateNotifications(System) {
    var limit = System.get("@lively-env").options.notificationLimit;
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
    var subscribers = System.get("@lively-env").notificationSubscribers;
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

  var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {
    return typeof obj;
  } : function (obj) {
    return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj;
  };

  var asyncToGenerator = function (fn) {
    return function () {
      var gen = fn.apply(this, arguments);
      return new Promise(function (resolve, reject) {
        function step(key, arg) {
          try {
            var info = gen[key](arg);
            var value = info.value;
          } catch (error) {
            reject(error);
            return;
          }

          if (info.done) {
            resolve(value);
          } else {
            return Promise.resolve(value).then(function (value) {
              return step("next", value);
            }, function (err) {
              return step("throw", err);
            });
          }
        }

        return step("next");
      });
    };
  };

  var classCallCheck = function (instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  };

  var createClass = function () {
    function defineProperties(target, props) {
      for (var i = 0; i < props.length; i++) {
        var descriptor = props[i];
        descriptor.enumerable = descriptor.enumerable || false;
        descriptor.configurable = true;
        if ("value" in descriptor) descriptor.writable = true;
        Object.defineProperty(target, descriptor.key, descriptor);
      }
    }

    return function (Constructor, protoProps, staticProps) {
      if (protoProps) defineProperties(Constructor.prototype, protoProps);
      if (staticProps) defineProperties(Constructor, staticProps);
      return Constructor;
    };
  }();

  var defineProperty = function (obj, key, value) {
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

  var slicedToArray = function () {
    function sliceIterator(arr, i) {
      var _arr = [];
      var _n = true;
      var _d = false;
      var _e = undefined;

      try {
        for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {
          _arr.push(_s.value);

          if (i && _arr.length === i) break;
        }
      } catch (err) {
        _d = true;
        _e = err;
      } finally {
        try {
          if (!_n && _i["return"]) _i["return"]();
        } finally {
          if (_d) throw _e;
        }
      }

      return _arr;
    }

    return function (arr, i) {
      if (Array.isArray(arr)) {
        return arr;
      } else if (Symbol.iterator in Object(arr)) {
        return sliceIterator(arr, i);
      } else {
        throw new TypeError("Invalid attempt to destructure non-iterable instance");
      }
    };
  }();

  var moduleSourceChange$1 = function () {
    var _ref = asyncToGenerator(regeneratorRuntime.mark(function _callee(System, moduleId, oldSource, newSource, format, options) {
      var changeResult;
      return regeneratorRuntime.wrap(function _callee$(_context) {
        while (1) {
          switch (_context.prev = _context.next) {
            case 0:
              _context.prev = 0;

              if (!(!format || format === "es6" || format === "esm" || format === "register" || format === "defined")) {
                _context.next = 7;
                break;
              }

              _context.next = 4;
              return moduleSourceChangeEsm(System, moduleId, newSource, options);

            case 4:
              changeResult = _context.sent;
              _context.next = 14;
              break;

            case 7:
              if (!(format === "global")) {
                _context.next = 13;
                break;
              }

              _context.next = 10;
              return moduleSourceChangeGlobal(System, moduleId, newSource, options);

            case 10:
              changeResult = _context.sent;
              _context.next = 14;
              break;

            case 13:
              throw new Error("moduleSourceChange is not supported for module " + moduleId + " with format " + format);

            case 14:

              recordModuleChange(System, moduleId, oldSource, newSource, null, options, Date.now());
              return _context.abrupt("return", changeResult);

            case 18:
              _context.prev = 18;
              _context.t0 = _context["catch"](0);

              recordModuleChange(System, moduleId, oldSource, newSource, _context.t0, options, Date.now());
              throw _context.t0;

            case 22:
            case "end":
              return _context.stop();
          }
        }
      }, _callee, this, [[0, 18]]);
    }));

    return function moduleSourceChange(_x, _x2, _x3, _x4, _x5, _x6) {
      return _ref.apply(this, arguments);
    };
  }();

  var moduleSourceChangeEsm = function () {
    var _ref2 = asyncToGenerator(regeneratorRuntime.mark(function _callee2(System, moduleId, newSource, options) {
      var debug, load, updateData, _exports, declared, deps, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, depName, depId, depModule, exports, prevLoad, mod, record, result;

      return regeneratorRuntime.wrap(function _callee2$(_context2) {
        while (1) {
          switch (_context2.prev = _context2.next) {
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
                _context2.next = 4;
                break;
              }

              _context2.next = 4;
              return System.import(moduleId);

            case 4:
              _context2.next = 6;
              return instrumentSourceOfEsmModuleLoad(System, load);

            case 6:
              updateData = _context2.sent;


              // evaluate the module source, to get the register module object with execute
              // and setters fields
              _exports = function _exports(name, val) {
                return scheduleModuleExportsChange(System, load.name, name, val, true);
              }, declared = updateData.declare(_exports);


              debug && console.log("[lively.vm es6] sourceChange of %s with deps", load.name, updateData.localDeps);

              // ensure dependencies are loaded
              deps = [];
              _iteratorNormalCompletion = true;
              _didIteratorError = false;
              _iteratorError = undefined;
              _context2.prev = 13;
              _iterator = updateData.localDeps[Symbol.iterator]();

            case 15:
              if (_iteratorNormalCompletion = (_step = _iterator.next()).done) {
                _context2.next = 28;
                break;
              }

              depName = _step.value;
              _context2.next = 19;
              return System.normalize(depName, load.name);

            case 19:
              depId = _context2.sent;
              depModule = module$2(System, depId);
              _context2.next = 23;
              return depModule.load();

            case 23:
              exports = _context2.sent;

              deps.push({ name: depName, fullname: depId, module: depModule, exports: exports });

            case 25:
              _iteratorNormalCompletion = true;
              _context2.next = 15;
              break;

            case 28:
              _context2.next = 34;
              break;

            case 30:
              _context2.prev = 30;
              _context2.t0 = _context2["catch"](13);
              _didIteratorError = true;
              _iteratorError = _context2.t0;

            case 34:
              _context2.prev = 34;
              _context2.prev = 35;

              if (!_iteratorNormalCompletion && _iterator.return) {
                _iterator.return();
              }

            case 37:
              _context2.prev = 37;

              if (!_didIteratorError) {
                _context2.next = 40;
                break;
              }

              throw _iteratorError;

            case 40:
              return _context2.finish(37);

            case 41:
              return _context2.finish(34);

            case 42:

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

              mod = module$2(System, load.name), record = mod.record();

              // 1. update the record so that when its dependencies change and cause a
              // re-execute, the correct code (new version) is run

              deps.forEach(function (ea, i) {
                return mod.addDependencyToModuleRecord(ea.module, declared.setters[i]);
              });
              if (record) record.execute = declared.execute;

              // 2. run setters to populate imports
              deps.forEach(function (d, i) {
                return declared.setters[i](d.exports);
              });

              // 3. execute module body
              result = declared.execute();

              // for updating records, modules, etc
              // FIXME... Actually this gets compiled into the source and won't need to run again??!!!

              System.get("@lively-env").evaluationDone(load.name);

              return _context2.abrupt("return", result);

            case 51:
            case "end":
              return _context2.stop();
          }
        }
      }, _callee2, this, [[13, 30, 34, 42], [35,, 37, 41]]);
    }));

    return function moduleSourceChangeEsm(_x7, _x8, _x9, _x10) {
      return _ref2.apply(this, arguments);
    };
  }();

  var moduleSourceChangeGlobal = function () {
    var _ref3 = asyncToGenerator(regeneratorRuntime.mark(function _callee3(System, moduleId, newSource, options) {
      var load, updateData, entry;
      return regeneratorRuntime.wrap(function _callee3$(_context3) {
        while (1) {
          switch (_context3.prev = _context3.next) {
            case 0:
              load = {
                status: 'loading',
                source: newSource,
                name: moduleId,
                address: moduleId,
                linkSets: [],
                dependencies: [],
                metadata: { format: "global" }
              };

              if (System.get(moduleId)) {
                _context3.next = 4;
                break;
              }

              _context3.next = 4;
              return System["import"](moduleId);

            case 4:
              _context3.next = 6;
              return instrumentSourceOfGlobalModuleLoad(System, load);

            case 6:
              updateData = _context3.sent;


              load.source = updateData.translated;
              entry = doInstantiateGlobalModule(System, load);

              System.delete(moduleId);
              System.set(entry.name, entry.esModule);
              return _context3.abrupt("return", entry.module);

            case 12:
            case "end":
              return _context3.stop();
          }
        }
      }, _callee3, this);
    }));

    return function moduleSourceChangeGlobal(_x11, _x12, _x13, _x14) {
      return _ref3.apply(this, arguments);
    };
  }();

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

    entry.execute = function executeGlobalModule(require, exports, m) {

      // SystemJS exports detection for global modules is based in new props
      // added to the global. In order to allow re-load we remove previously
      // "exported" values
      var prevMeta = module$2(System, m.id).metadata(),
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
        for (var g in load.metadata.globals) {
          if (load.metadata.globals[g]) globals[g] = require(load.metadata.globals[g]);
        }
      }

      var exportName = load.metadata.exports;

      if (exportName) load.source += "\nSystem.global[\"" + exportName + "\"] = " + exportName + ";";

      var retrieveGlobal = System.get('@@global-helpers').prepareGlobal(module$2.id, exportName, globals);

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
          loadedDep = dep && System.get(entry.normalizedDeps[entry.deps.indexOf(dep)]) || System.get(System.decanonicalize(name, entry.name));
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

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // config
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  var tryToLoadPackageConfig = function () {
    var _ref = asyncToGenerator(regeneratorRuntime.mark(function _callee(System, packageURL) {
      var packageConfigURL, config, name;
      return regeneratorRuntime.wrap(function _callee$(_context) {
        while (1) {
          switch (_context.prev = _context.next) {
            case 0:
              packageConfigURL = packageURL + "/package.json";

              System.config({
                meta: defineProperty({}, packageConfigURL, { format: "json" }),
                packages: defineProperty({}, packageURL, { meta: { "package.json": { format: "json" } } })
              });

              System.debug && console.log("[lively.modules package reading config] %s", packageConfigURL);

              _context.prev = 3;
              _context.t0 = System.get(packageConfigURL);

              if (_context.t0) {
                _context.next = 9;
                break;
              }

              _context.next = 8;
              return System.import(packageConfigURL);

            case 8:
              _context.t0 = _context.sent;

            case 9:
              config = _context.t0;

              lively_lang.arr.pushIfNotIncluded(System.packageConfigPaths, packageConfigURL); // to inform systemjs that there is a config
              return _context.abrupt("return", config);

            case 14:
              _context.prev = 14;
              _context.t1 = _context["catch"](3);

              console.log("[lively.modules package] Unable loading package config %s for package: ", packageConfigURL, _context.t1);
              delete System.meta[packageConfigURL];
              name = packageURL.split("/").slice(-1)[0];
              return _context.abrupt("return", { name: name });

            case 20:
            case "end":
              return _context.stop();
          }
        }
      }, _callee, this, [[3, 14]]);
    }));

    return function tryToLoadPackageConfig(_x, _x2) {
      return _ref.apply(this, arguments);
    };
  }();

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // internal
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  function normalizeInsidePackage(System, urlOrName, packageURL) {
    return isURL(urlOrName) ? urlOrName : // absolute
    urlResolve(join(urlOrName[0] === "." ? packageURL : System.baseURL, urlOrName)); // relative to either the package or the system:
  }

  function normalizePackageURL(System, packageURL) {
    if (Object.keys(getPackages$1(System)).some(function (ea) {
      return ea === packageURL;
    })) return packageURL;

    var url = System.decanonicalize(packageURL.replace(/[\/]+$/, "") + "/");

    if (!isURL(url)) throw new Error("Strange package URL: " + url + " is not a valid URL");

    // ensure it's a directory
    if (!url.match(/\.js/)) url = url;else if (url.indexOf(url + ".js") > -1) url = url.replace(/\.js$/, "");else url = url.split("/").slice(0, -1).join("/");

    if (url.match(/\.js$/)) throw new Error("packageURL is expected to point to a directory but seems to be a .js file: " + url);

    return String(url).replace(/\/$/, "");
  }

  function packageStore(System) {
    return System.get("@lively-env").packages;
  }

  function addToPackageStore(System, p) {
    var store = packageStore(System);
    store[p.url] = p;
    return p;
  }

  function findPackageNamed(System, name) {
    return lively_lang.obj.values(packageStore(System)).find(function (ea) {
      return ea.name === name;
    });
  }

  function applyConfig(System, packageConfig, packageURL) {
    // takes a config json object (typically read from a package.json file but
    // can be used standalone) and changes the System configuration to what it finds
    // in it.
    // In particular uses the "systemjs" section as described in https://github.com/systemjs/systemjs/blob/master/docs/config-api.md
    // and uses the "lively" section as described in `applyLivelyConfig`

    var name = packageConfig.name || packageURL.split("/").slice(-1)[0],
        sysConfig = packageConfig.systemjs || {},
        livelyConfig = packageConfig.lively,
        main = packageConfig.main || "index.js";

    System.config({
      map: defineProperty({}, name, packageURL),
      packages: defineProperty({}, packageURL, sysConfig)
    });

    var packageInSystem = System.getConfig().packages[packageURL] || {};
    if (!packageInSystem.map) packageInSystem.map = {};

    if (sysConfig) {
      if (sysConfig.packageConfigPaths) System.packageConfigPaths = lively_lang.arr.uniq(System.packageConfigPaths.concat(sysConfig.packageConfigPaths));
      if (sysConfig.main) main = sysConfig.main;
      applySystemJSConfig(System, packageConfig, packageURL);
    }

    packageInSystem.referencedAs = packageInSystem.referencedAs || [];
    lively_lang.arr.pushIfNotIncluded(packageInSystem.referencedAs, name);

    if (!main.match(/\.[^\/\.]+/)) main += ".js";
    packageInSystem.main = main;

    // System.packages doesn't allow us to store our own properties
    var p = getPackage(System, packageURL);
    p.mergeWithConfig(packageInSystem);

    var packageApplyResult = livelyConfig ? applyLivelyConfig(System, livelyConfig, p) : { subPackages: [] };

    return packageApplyResult;
  }

  function applySystemJSConfig(System, systemjsConfig, pkg) {}

  function applyLivelyConfig(System, livelyConfig, pkg) {
    // configures System object from lively config JSON object.
    // - adds System.package entry for package
    // - adds name to System.package[pkg.url].referencedAs
    // - installs hook from {hooks: [{name, source}]}
    // - merges livelyConfig.packageMap into System.package[pkg.url].map
    //   entries in packageMap are specifically meant to be sub-packages!
    // Will return a {subPackages: [{name, address},...]} object
    applyLivelyConfigMeta(System, livelyConfig, pkg);
    applyLivelyConfigHooks(System, livelyConfig, pkg);
    applyLivelyConfigBundles(System, livelyConfig, pkg);
    return applyLivelyConfigPackageMap(System, livelyConfig, pkg);
  }

  function applyLivelyConfigHooks(System, livelyConfig, pkg) {
    (livelyConfig.hooks || []).forEach(function (h) {
      try {
        var f = eval("(" + h.source + ")");
        if (!f.name || !isHookInstalled$1(System, h.target, f.name)) installHook$1(System, h.target, f);
      } catch (e) {
        console.error("Error installing hook for %s: %s", pkg.url, e, h);
      }
    });
  }

  function applyLivelyConfigBundles(System, livelyConfig, pkg) {
    if (!livelyConfig.bundles) return Promise.resolve();
    var normalized = Object.keys(livelyConfig.bundles).reduce(function (bundles, name) {
      var absName = pkg.url + "/" + name,
          files = livelyConfig.bundles[name].map(function (f) {
        return System.decanonicalize(f, pkg.url + "/");
      });
      bundles[absName] = files;
      return bundles;
    }, {});
    System.config({ bundles: normalized });
    return Promise.resolve();
  }

  function applyLivelyConfigMeta(System, livelyConfig, pkg) {
    if (!livelyConfig.meta) return;
    var pConf = System.getConfig().packages[pkg.url] || {},
        c = { meta: {}, packages: defineProperty({}, pkg.url, pConf) };
    Object.keys(livelyConfig.meta).forEach(function (key) {
      var val = livelyConfig.meta[key];
      if (isURL(key)) {
        c.meta[key] = val;
      } else {
        if (!pConf.meta) pConf.meta = {};
        pConf.meta[key] = val;
      }
    });
    System.config(c);
  }

  function applyLivelyConfigPackageMap(System, livelyConfig, pkg) {
    var subPackages = livelyConfig.packageMap ? Object.keys(livelyConfig.packageMap).map(function (name) {
      return subpackageNameAndAddress(System, livelyConfig, name, pkg);
    }) : [];
    return { subPackages: subPackages };
  }

  function subpackageNameAndAddress(System, livelyConfig, subPackageName, pkg) {
    // var pConf = System.packages[packageURL],
    var preferLoadedPackages = livelyConfig.hasOwnProperty("preferLoadedPackages") ? livelyConfig.preferLoadedPackages : true,
        normalized = System.decanonicalize(subPackageName, pkg.url);

    if (preferLoadedPackages) {
      var subpackageURL,
          existing = findPackageNamed(System, subPackageName);

      if (existing) subpackageURL = existing.url;else if (pkg.map[subPackageName]) subpackageURL = normalizeInsidePackage(System, pkg.map[subPackageName], pkg.url);else if (System.map[subPackageName]) subpackageURL = normalizeInsidePackage(System, System.map[subPackageName], pkg.url);else if (System.get(normalized)) subpackageURL = System.decanonicalize(subPackageName, pkg.url + "/");

      if (subpackageURL) {
        if (System.get(subpackageURL)) subpackageURL = subpackageURL.split("/").slice(0, -1).join("/"); // force to be dir
        System.debug && console.log("[lively.module package] Package %s required by %s already in system as %s", subPackageName, pkg, subpackageURL);
        return getPackage(System, subpackageURL);
      }
    }

    pkg.addMapping(subPackageName, livelyConfig.packageMap[subPackageName]);

    // lookup
    var subpackageURL = normalizeInsidePackage(System, livelyConfig.packageMap[subPackageName], pkg.url);
    System.debug && console.log("[lively.module package] Package %s required by %s NOT in system, will be loaded as %s", subPackageName, pkg, subpackageURL);
    return getPackage(System, subpackageURL);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // package object
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  var Package = function () {
    function Package(System, packageURL) {
      classCallCheck(this, Package);

      // the name from the packages config, set once the config is loaded
      this._name = undefined;
      // The names under which the package is referenced by other packages
      this.referencedAs = [];
      this.url = packageURL;
      this.System = System;
      this.registerProcess = null;
      this.map = {};
    }

    createClass(Package, [{
      key: "path",
      value: function path() {
        var base = this.System.baseURL;
        return this.url.indexOf(base) === 0 ? this.url.slice(base.length) : this.url;
      }
    }, {
      key: "toString",
      value: function toString() {
        return "Package(" + this._name + " – " + this.path() + "/)";
      }
    }, {
      key: "import",
      value: function () {
        var _ref2 = asyncToGenerator(regeneratorRuntime.mark(function _callee2() {
          return regeneratorRuntime.wrap(function _callee2$(_context2) {
            while (1) {
              switch (_context2.prev = _context2.next) {
                case 0:
                  _context2.next = 2;
                  return this.register();

                case 2:
                  _context2.t0 = this.System;
                  _context2.next = 5;
                  return this.System.normalize(this.url);

                case 5:
                  _context2.t1 = _context2.sent;
                  return _context2.abrupt("return", _context2.t0.import.call(_context2.t0, _context2.t1));

                case 7:
                case "end":
                  return _context2.stop();
              }
            }
          }, _callee2, this);
        }));

        function _import() {
          return _ref2.apply(this, arguments);
        }

        return _import;
      }()
    }, {
      key: "isRegistering",
      value: function isRegistering() {
        return !!this.registerProcess;
      }
    }, {
      key: "register",
      value: function () {
        var _ref3 = asyncToGenerator(regeneratorRuntime.mark(function _callee3() {
          var packageLoadStack = arguments.length <= 0 || arguments[0] === undefined ? [this.url] : arguments[0];

          var System, url, cfg, packageConfigResult, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, supPkg, shortStack, registerP;

          return regeneratorRuntime.wrap(function _callee3$(_context3) {
            while (1) {
              switch (_context3.prev = _context3.next) {
                case 0:
                  System = this.System;
                  url = this.url;

                  if (!this.isRegistering()) {
                    _context3.next = 4;
                    break;
                  }

                  return _context3.abrupt("return", this.registerProcess.promise);

                case 4:
                  this.registerProcess = lively_lang.promise.deferred();

                  System.debug && console.log("[lively.modules package register] %s", url);
                  _context3.next = 8;
                  return tryToLoadPackageConfig(System, url);

                case 8:
                  cfg = _context3.sent;
                  _context3.next = 11;
                  return applyConfig(System, cfg, url);

                case 11:
                  packageConfigResult = _context3.sent;
                  _iteratorNormalCompletion = true;
                  _didIteratorError = false;
                  _iteratorError = undefined;
                  _context3.prev = 15;
                  _iterator = packageConfigResult.subPackages[Symbol.iterator]();

                case 17:
                  if (_iteratorNormalCompletion = (_step = _iterator.next()).done) {
                    _context3.next = 29;
                    break;
                  }

                  supPkg = _step.value;

                  if (!lively_lang.arr.include(packageLoadStack, supPkg.url)) {
                    _context3.next = 23;
                    break;
                  }

                  if (System.debug || true) {
                    shortStack = packageLoadStack && packageLoadStack.map(function (ea) {
                      return ea.indexOf(System.baseURL) === 0 ? ea.slice(System.baseURL.length) : ea;
                    });

                    console.log("[lively.modules package register] " + url + " is a circular dependency, stopping registering subpackages, stack: " + shortStack);
                  }
                  _context3.next = 26;
                  break;

                case 23:
                  packageLoadStack.push(supPkg.url);
                  _context3.next = 26;
                  return supPkg.register(packageLoadStack);

                case 26:
                  _iteratorNormalCompletion = true;
                  _context3.next = 17;
                  break;

                case 29:
                  _context3.next = 35;
                  break;

                case 31:
                  _context3.prev = 31;
                  _context3.t0 = _context3["catch"](15);
                  _didIteratorError = true;
                  _iteratorError = _context3.t0;

                case 35:
                  _context3.prev = 35;
                  _context3.prev = 36;

                  if (!_iteratorNormalCompletion && _iterator.return) {
                    _iterator.return();
                  }

                case 38:
                  _context3.prev = 38;

                  if (!_didIteratorError) {
                    _context3.next = 41;
                    break;
                  }

                  throw _iteratorError;

                case 41:
                  return _context3.finish(38);

                case 42:
                  return _context3.finish(35);

                case 43:
                  registerP = this.registerProcess.promise;

                  this.registerProcess.resolve(cfg);
                  delete this.registerProcess;

                  return _context3.abrupt("return", registerP);

                case 47:
                case "end":
                  return _context3.stop();
              }
            }
          }, _callee3, this, [[15, 31, 35, 43], [36,, 38, 42]]);
        }));

        function register(_x3) {
          return _ref3.apply(this, arguments);
        }

        return register;
      }()
    }, {
      key: "remove",
      value: function remove() {
        var System = this.System;
        var url = this.url;


        url = url.replace(/\/$/, "");
        var conf = System.getConfig(),
            packageConfigURL = url + "/package.json";

        var p = getPackages$1(System).find(function (ea) {
          return ea.address === url;
        });
        if (p) p.modules.forEach(function (mod) {
          return module$2(System, mod.name).unload({ forgetEnv: true, forgetDeps: false });
        });

        System.delete(String(packageConfigURL));
        lively_lang.arr.remove(conf.packageConfigPaths || [], packageConfigURL);

        System.config({
          meta: defineProperty({}, packageConfigURL, {}),
          packages: defineProperty({}, url, {}),
          packageConfigPaths: conf.packageConfigPaths
        });
        delete System.meta[packageConfigURL];
        delete System.packages[url];
      }
    }, {
      key: "reload",
      value: function reload() {
        this.remove();return this.import();
      }
    }, {
      key: "search",
      value: function search(needle, options) {
        return searchInPackage$1(this.System, this.url, needle, options);
      }
    }, {
      key: "mergeWithConfig",
      value: function mergeWithConfig(config) {
        var copy = Object.assign({}, config);
        var name = copy.name;
        var referencedAs = copy.referencedAs;
        var map = copy.map;


        if (referencedAs) {
          delete copy.referencedAs;
          this.referencedAs = lively_lang.arr.uniq(this.referencedAs.concat(referencedAs));
        }

        if (name) {
          delete copy.name;
          this._name = name;
        }

        if (map) {
          delete copy.map;
          Object.assign(this.map, map);
        }

        Object.assign(this, copy);
        return this;
      }
    }, {
      key: "addMapping",
      value: function addMapping(name, url) {
        this.map[name] = url;
        this.System.config({ packages: defineProperty({}, this.url, { map: defineProperty({}, name, url) }) });
      }
    }, {
      key: "name",
      get: function get() {
        return this._name || lively_lang.arr.last(this.url.replace(/[\/]+$/, "").split("/"));
      },
      set: function set(v) {
        return this._name = v;
      }
    }, {
      key: "address",
      get: function get() {
        return this.url;
      },
      set: function set(v) {
        return this.url = v;
      }
    }]);
    return Package;
  }();

  function getPackage(System, packageURL) {
    var url = normalizePackageURL(System, packageURL);
    return packageStore(System).hasOwnProperty(url) ? packageStore(System)[url] : addToPackageStore(System, new Package(System, url));
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // interface
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  function importPackage$1(System, packageURL) {
    return getPackage(System, packageURL).import();
  }
  function registerPackage$1(System, packageURL, packageLoadStack) {
    return getPackage(System, packageURL).register(packageLoadStack);
  }
  function removePackage$1(System, packageURL) {
    return getPackage(System, packageURL).remove();
  }
  function reloadPackage$1(System, packageURL) {
    return getPackage(System, packageURL).reload();
  }

  function groupIntoPackages(System, moduleNames, packageNames) {

    return lively_lang.arr.groupBy(moduleNames, groupFor);

    function groupFor(moduleName) {
      var fullname = System.decanonicalize(moduleName),
          matching = packageNames.filter(function (p) {
        return fullname.indexOf(p) === 0;
      });
      return matching.length ? matching.reduce(function (specific, ea) {
        return ea.length > specific.length ? ea : specific;
      }) : "no group";
    }
  }

  function getPackages$1(System) {
    // returns a list like
    // ```
    // [{
    //   address: package-address,
    //   modules: [module-name-1, module-name-2, ...],
    //   name: package-name,
    //   names: [package-name, ...]
    // }, ... ]
    // ```

    var map = requireMap$1(System),
        modules = Object.keys(map),
        sysPackages = System.packages,
        livelyPackages = packageStore(System),
        packageNames = lively_lang.arr.uniq(Object.keys(sysPackages).concat(Object.keys(livelyPackages))),
        result = [];

    groupIntoPackages(System, modules, packageNames).mapGroups(function (packageAddress, moduleNames) {
      var systemP = sysPackages[packageAddress],
          livelyP = livelyPackages[packageAddress],
          p = livelyP && systemP ? livelyP.mergeWithConfig(systemP) : livelyP || systemP,
          referencedAs = p ? p.referencedAs : [];
      if (!referencedAs || !referencedAs.length) referencedAs = [packageAddress.replace(/^(?:.+\/)?([^\/]+)$/, "$1")];

      moduleNames = moduleNames.filter(function (name) {
        return name !== packageAddress && name !== packageAddress + "/";
      });

      result.push(Object.assign({}, p || {}, {
        address: packageAddress,
        name: referencedAs[0],
        names: referencedAs,
        modules: moduleNames.map(function (name) {
          return {
            name: name,
            deps: map[name]
          };
        })
      }));
    });

    return result;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // search
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  function searchInPackage$1(System, packageURL, searchStr, options) {
    packageURL = packageURL.replace(/\/$/, "");
    var p = getPackages$1(System).find(function (p) {
      return p.address == packageURL;
    });
    return p ? Promise.all(p.modules.map(function (m) {
      return module$2(System, m.name).search(searchStr, options);
    })).then(function (res) {
      return lively_lang.arr.flatten(res, 1);
    }) : Promise.resolve([]);
  }

  function module$2(System, moduleName, parent) {
    var sysEnv = livelySystemEnv(System),
        id = System.decanonicalize(moduleName, parent);
    return sysEnv.loadedModules[id] || (sysEnv.loadedModules[id] = new ModuleInterface(System, id));
  }

  // ModuleInterface is primarily used to provide an API that integrates the System
  // loader state with lively.modules extensions.
  // It does not hold any mutable state.

  var ModuleInterface = function () {
    function ModuleInterface(System, id) {
      var _this = this;

      classCallCheck(this, ModuleInterface);

      // We assume module ids to be a URL with a scheme

      if (!isURL(id) && !/^@/.test(id)) throw new Error("ModuleInterface constructor called with " + id + " that does not seem to be a fully normalized module id.");
      this.System = System;
      this.id = id;

      // Under what variable name the recorder becomes available during module
      // execution and eval
      this.recorderName = "__lvVarRecorder";
      this._recorder = null;

      // cached values
      this._source = null;
      this._ast = null;
      this._scope = null;
      this._observersOfTopLevelState = [];

      subscribe$1(System, "modulechange", function (data) {
        if (data.module === _this.id) _this.reset();
      });
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // properties
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    // returns Promise<string>


    createClass(ModuleInterface, [{
      key: "fullName",
      value: function fullName() {
        return this.id;
      }

      // returns Promise<string>

    }, {
      key: "source",
      value: function source() {
        var _this2 = this;

        // rk 2016-06-24:
        // We should consider using lively.resource here. Unfortunately
        // System.fetch (at least with the current systemjs release) will not work in
        // all cases b/c modules once loaded by the loaded get cached and System.fetch
        // returns "" in those cases

        if (this.id === "@empty") return Promise.resolve("");

        if (this._source) return Promise.resolve(this._source);
        if (this.id.match(/^http/) && this.System.global.fetch) {
          return this.System.global.fetch(this.id).then(function (res) {
            return res.text();
          });
        }

        if (this.id.match(/^file:/) && this.System.get("@system-env").node) {
          var _ret = function () {
            var path = _this2.id.replace(/^file:\/\//, "");
            return {
              v: new Promise(function (resolve, reject) {
                return _this2.System._nodeRequire("fs").readFile(path, function (err, content) {
                  return err ? reject(err) : resolve(_this2._source = String(content));
                });
              })
            };
          }();

          if ((typeof _ret === "undefined" ? "undefined" : _typeof(_ret)) === "object") return _ret.v;
        }

        if (this.id.match(/^lively:/) && typeof $world !== "undefined") {
          // This needs to go into a separate place for "virtual" lively modules
          var morphId = lively_lang.arr.last(this.id.split("/"));
          var m = $world.getMorphById(morphId);
          return Promise.resolve(m ? m.textContent : "");
        }

        return Promise.reject(new Error("Cannot retrieve source for " + this.id));
      }
    }, {
      key: "ast",
      value: function () {
        var _ref = asyncToGenerator(regeneratorRuntime.mark(function _callee() {
          return regeneratorRuntime.wrap(function _callee$(_context) {
            while (1) {
              switch (_context.prev = _context.next) {
                case 0:
                  if (!this._ast) {
                    _context.next = 2;
                    break;
                  }

                  return _context.abrupt("return", this._ast);

                case 2:
                  _context.next = 4;
                  return this.source();

                case 4:
                  _context.t0 = _context.sent;
                  return _context.abrupt("return", this._ast = lively_ast.parse(_context.t0));

                case 6:
                case "end":
                  return _context.stop();
              }
            }
          }, _callee, this);
        }));

        function ast() {
          return _ref.apply(this, arguments);
        }

        return ast;
      }()
    }, {
      key: "scope",
      value: function () {
        var _ref2 = asyncToGenerator(regeneratorRuntime.mark(function _callee2() {
          var ast;
          return regeneratorRuntime.wrap(function _callee2$(_context2) {
            while (1) {
              switch (_context2.prev = _context2.next) {
                case 0:
                  if (!this._scope) {
                    _context2.next = 2;
                    break;
                  }

                  return _context2.abrupt("return", this._scope);

                case 2:
                  _context2.next = 4;
                  return this.ast();

                case 4:
                  ast = _context2.sent;
                  return _context2.abrupt("return", this._scope = lively_ast.query.topLevelDeclsAndRefs(ast).scope);

                case 6:
                case "end":
                  return _context2.stop();
              }
            }
          }, _callee2, this);
        }));

        function scope() {
          return _ref2.apply(this, arguments);
        }

        return scope;
      }()
    }, {
      key: "resolvedScope",
      value: function () {
        var _ref3 = asyncToGenerator(regeneratorRuntime.mark(function _callee3() {
          return regeneratorRuntime.wrap(function _callee3$(_context3) {
            while (1) {
              switch (_context3.prev = _context3.next) {
                case 0:
                  _context3.t0 = lively_ast.query;
                  _context3.next = 3;
                  return this.scope();

                case 3:
                  _context3.t1 = _context3.sent;
                  return _context3.abrupt("return", this._scope = _context3.t0.resolveReferences.call(_context3.t0, _context3.t1));

                case 5:
                case "end":
                  return _context3.stop();
              }
            }
          }, _callee3, this);
        }));

        function resolvedScope() {
          return _ref3.apply(this, arguments);
        }

        return resolvedScope;
      }()
    }, {
      key: "metadata",
      value: function metadata() {
        var load = this.System.loads ? this.System.loads[this.id] : null;
        return load ? load.metadata : null;
      }
    }, {
      key: "format",
      value: function format() {
        // assume esm by default
        var meta = this.metadata();
        return meta ? meta.format : "esm";
      }
    }, {
      key: "reset",
      value: function reset() {
        this._source = null;
        this._ast = null;
        this._scope = null;
      }

      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
      // loading
      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    }, {
      key: "load",
      value: function () {
        var _ref4 = asyncToGenerator(regeneratorRuntime.mark(function _callee4() {
          return regeneratorRuntime.wrap(function _callee4$(_context4) {
            while (1) {
              switch (_context4.prev = _context4.next) {
                case 0:
                  _context4.t0 = this.System.get(this.id);

                  if (_context4.t0) {
                    _context4.next = 5;
                    break;
                  }

                  _context4.next = 4;
                  return this.System.import(this.id);

                case 4:
                  _context4.t0 = _context4.sent;

                case 5:
                  return _context4.abrupt("return", _context4.t0);

                case 6:
                case "end":
                  return _context4.stop();
              }
            }
          }, _callee4, this);
        }));

        function load() {
          return _ref4.apply(this, arguments);
        }

        return load;
      }()
    }, {
      key: "isLoaded",
      value: function isLoaded() {
        return !!this.System.get(this.id);
      }
    }, {
      key: "unloadEnv",
      value: function unloadEnv() {
        this._recorder = null;
        this._observersOfTopLevelState = [];
        // FIXME this shouldn't be necessary anymore....
        delete livelySystemEnv(this.System).loadedModules[this.id];
      }
    }, {
      key: "unloadDeps",
      value: function unloadDeps(opts) {
        var _this3 = this;

        opts = lively_lang.obj.merge({ forgetDeps: true, forgetEnv: true }, opts);
        this.dependents().forEach(function (ea) {
          _this3.System.delete(ea.id);
          if (_this3.System.loads) delete _this3.System.loads[ea.id];
          if (opts.forgetEnv) ea.unloadEnv();
        });
      }
    }, {
      key: "unload",
      value: function unload(opts) {
        opts = lively_lang.obj.merge({ reset: true, forgetDeps: true, forgetEnv: true }, opts);
        if (opts.reset) this.reset();
        if (opts.forgetDeps) this.unloadDeps(opts);
        this.System.delete(this.id);
        if (this.System.loads) {
          delete this.System.loads[this.id];
        }
        if (this.System.meta) delete this.System.meta[this.id];
        if (opts.forgetEnv) this.unloadEnv();
      }
    }, {
      key: "reload",
      value: function () {
        var _ref5 = asyncToGenerator(regeneratorRuntime.mark(function _callee5(opts) {
          var _this4 = this;

          var toBeReloaded;
          return regeneratorRuntime.wrap(function _callee5$(_context5) {
            while (1) {
              switch (_context5.prev = _context5.next) {
                case 0:
                  opts = lively_lang.obj.merge({ reloadDeps: true, resetEnv: true }, opts);
                  toBeReloaded = [this];

                  if (opts.reloadDeps) toBeReloaded = this.dependents().concat(toBeReloaded);
                  this.unload({ forgetDeps: opts.reloadDeps, forgetEnv: opts.resetEnv });
                  _context5.next = 6;
                  return Promise.all(toBeReloaded.map(function (ea) {
                    return ea.id !== _this4.id && ea.load();
                  }));

                case 6:
                  _context5.next = 8;
                  return this.load();

                case 8:
                case "end":
                  return _context5.stop();
              }
            }
          }, _callee5, this);
        }));

        function reload(_x) {
          return _ref5.apply(this, arguments);
        }

        return reload;
      }()

      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
      // change
      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    }, {
      key: "changeSourceAction",
      value: function () {
        var _ref6 = asyncToGenerator(regeneratorRuntime.mark(function _callee6(changeFunc) {
          var source, newSource;
          return regeneratorRuntime.wrap(function _callee6$(_context6) {
            while (1) {
              switch (_context6.prev = _context6.next) {
                case 0:
                  _context6.next = 2;
                  return this.source();

                case 2:
                  source = _context6.sent;
                  _context6.next = 5;
                  return changeFunc(source);

                case 5:
                  newSource = _context6.sent;
                  return _context6.abrupt("return", this.changeSource(newSource, { evaluate: true }));

                case 7:
                case "end":
                  return _context6.stop();
              }
            }
          }, _callee6, this);
        }));

        function changeSourceAction(_x2) {
          return _ref6.apply(this, arguments);
        }

        return changeSourceAction;
      }()
    }, {
      key: "changeSource",
      value: function () {
        var _ref7 = asyncToGenerator(regeneratorRuntime.mark(function _callee7(newSource, options) {
          var oldSource;
          return regeneratorRuntime.wrap(function _callee7$(_context7) {
            while (1) {
              switch (_context7.prev = _context7.next) {
                case 0:
                  _context7.next = 2;
                  return this.source();

                case 2:
                  oldSource = _context7.sent;
                  return _context7.abrupt("return", moduleSourceChange$1(this.System, this.id, oldSource, newSource, this.format(), options));

                case 4:
                case "end":
                  return _context7.stop();
              }
            }
          }, _callee7, this);
        }));

        function changeSource(_x3, _x4) {
          return _ref7.apply(this, arguments);
        }

        return changeSource;
      }()
    }, {
      key: "addDependencyToModuleRecord",
      value: function addDependencyToModuleRecord(dependency) {
        var _this5 = this;

        var setter = arguments.length <= 1 || arguments[1] === undefined ? function () {} : arguments[1];

        // `dependency is another module, setter is the function that gets
        // triggered when a dependency's binding changes so that "this" module is updated
        var record = this.record(),
            dependencyRecord = dependency.record();

        if (record && dependencyRecord) {
          // 1. update the record so that when its dependencies change and cause a
          // re-execute, the correct code (new version) is run
          var depIndex,
              hasDepenency = record.dependencies.some(function (ea, i) {
            if (!ea) return;depIndex = i;return ea && ea.name === dependency.id;
          });
          if (!hasDepenency) {
            record.dependencies.push(dependencyRecord);
          } else if (dependencyRecord !== record.dependencies[depIndex] /*happens when a dep is reloaded*/) record.dependencies.splice(depIndex, 1, dependencyRecord);

          // setters are for updating module bindings, the position of the record
          // in dependencies should be the same as the position of the setter for that
          // dependency...
          if (!hasDepenency || !record.setters[depIndex]) record.setters[hasDepenency ? depIndex : record.dependencies.length - 1] = setter;

          // 2. update records of dependencies, so that they know about this module as an importer
          var impIndex,
              hasImporter = dependencyRecord.importers.some(function (imp, i) {
            if (!imp) return;impIndex = i;return imp && imp.name === _this5.id;
          });
          if (!hasImporter) dependencyRecord.importers.push(record);else if (record !== dependencyRecord.importers[impIndex]) dependencyRecord.importers.splice(impIndex, 1, record);
        }
      }

      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
      // dependencies
      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    }, {
      key: "dependents",
      value: function dependents() {
        var _this6 = this;

        // which modules (module ids) are (in)directly import module with id
        // Let's say you have
        // module1: export var x = 23;
        // module2: import {x} from "module1.js"; export var y = x + 1;
        // module3: import {y} from "module2.js"; export var z = y + 1;
        // `dependents` gives you an answer what modules are "stale" when you
        // change module1 = module2 + module3
        return lively_lang.graph.hull(lively_lang.graph.invert(requireMap$1(this.System)), this.id).map(function (mid) {
          return module$2(_this6.System, mid);
        });
      }
    }, {
      key: "requirements",
      value: function requirements() {
        var _this7 = this;

        // which modules (module ids) are (in)directly required by module with id
        // Let's say you have
        // module1: export var x = 23;
        // module2: import {x} from "module1.js"; export var y = x + 1;
        // module3: import {y} from "module2.js"; export var z = y + 1;
        // `module("./module3").requirements()` will report ./module2 and ./module1
        return lively_lang.graph.hull(requireMap$1(this.System), this.id).map(function (mid) {
          return module$2(_this7.System, mid);
        });
      }

      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
      // module environment
      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

      // What variables to not transform during execution, i.e. what variables
      // should not be accessed as properties of recorder

    }, {
      key: "define",
      value: function define(varName, value) {
        return this.recorder[varName] = value;
      }
    }, {
      key: "undefine",
      value: function undefine(varName) {
        delete this.recorder[varName];
      }

      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
      // observing top level state
      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    }, {
      key: "subscribeToToplevelDefinitionChanges",
      value: function subscribeToToplevelDefinitionChanges(func) {
        this._observersOfTopLevelState.push(func);
        return func;
      }
    }, {
      key: "notifyTopLevelObservers",
      value: function notifyTopLevelObservers(key) {
        var ignored = ["createOrExtendES6ClassForLively", "lively.capturing-declaration-wrapper"],
            rec = this.recorder;
        if (lively_lang.arr.include(ignored, key)) return;
        this._observersOfTopLevelState.forEach(function (fn) {
          return fn(key, rec[key]);
        });
      }
    }, {
      key: "unsubscribeFromToplevelDefinitionChanges",
      value: function unsubscribeFromToplevelDefinitionChanges(funcOrName) {
        this._observersOfTopLevelState = typeof funcOrName === "string" ? this._observersOfTopLevelState.filter(function (ea) {
          return ea.name !== funcOrName;
        }) : this._observersOfTopLevelState.filter(function (ea) {
          return ea !== funcOrName;
        });
      }
    }, {
      key: "evaluationDone",
      value: function evaluationDone() {
        this.addGetterSettersForNewVars();
        runScheduledExportChanges(this.System, this.id);
      }
    }, {
      key: "addGetterSettersForNewVars",
      value: function addGetterSettersForNewVars() {
        var _this8 = this;

        // after eval we modify the env so that all captures vars are wrapped in
        // getter/setter to be notified of changes
        // FIXME: better to not capture via assignments but use func calls...!
        var rec = this.recorder,
            prefix = "__lively.modules__";

        if (rec === this.System.global) {
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
              rec[prefix + key] = v;
              scheduleModuleExportsChange(_this8.System, _this8.id, key, v, false /*add export*/);
              _this8.notifyTopLevelObservers(key);
            }
          });

          _this8.notifyTopLevelObservers(key);
        });
      }
    }, {
      key: "env",
      value: function env() {
        return this;
      }

      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
      // package related
      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    }, {
      key: "package",
      value: function _package() {
        var _this9 = this;

        return getPackages$1(this.System).find(function (ea) {
          return ea.modules.some(function (mod) {
            return mod.name === _this9.id;
          });
        });
      }
    }, {
      key: "pathInPackage",
      value: function pathInPackage() {
        var p = this.package();
        return p && this.id.indexOf(p.address) === 0 ? join("./", this.id.slice(p.address.length)) : this.id;
      }

      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
      // imports and exports
      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    }, {
      key: "imports",
      value: function () {
        var _ref8 = asyncToGenerator(regeneratorRuntime.mark(function _callee8() {
          var parsed, scope;
          return regeneratorRuntime.wrap(function _callee8$(_context8) {
            while (1) {
              switch (_context8.prev = _context8.next) {
                case 0:
                  _context8.next = 2;
                  return this.ast();

                case 2:
                  parsed = _context8.sent;
                  _context8.next = 5;
                  return this.scope();

                case 5:
                  scope = _context8.sent;
                  return _context8.abrupt("return", lively_ast.query.imports(scope));

                case 7:
                case "end":
                  return _context8.stop();
              }
            }
          }, _callee8, this);
        }));

        function imports() {
          return _ref8.apply(this, arguments);
        }

        return imports;
      }()
    }, {
      key: "exports",
      value: function () {
        var _ref9 = asyncToGenerator(regeneratorRuntime.mark(function _callee9() {
          var parsed, scope;
          return regeneratorRuntime.wrap(function _callee9$(_context9) {
            while (1) {
              switch (_context9.prev = _context9.next) {
                case 0:
                  _context9.next = 2;
                  return this.ast();

                case 2:
                  parsed = _context9.sent;
                  _context9.next = 5;
                  return this.scope();

                case 5:
                  scope = _context9.sent;
                  return _context9.abrupt("return", lively_ast.query.exports(scope));

                case 7:
                case "end":
                  return _context9.stop();
              }
            }
          }, _callee9, this);
        }));

        function exports() {
          return _ref9.apply(this, arguments);
        }

        return exports;
      }()

      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
      // bindings
      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    }, {
      key: "_localDeclForRefAt",
      value: function () {
        var _ref10 = asyncToGenerator(regeneratorRuntime.mark(function _callee10(pos) {
          var scope, ref;
          return regeneratorRuntime.wrap(function _callee10$(_context10) {
            while (1) {
              switch (_context10.prev = _context10.next) {
                case 0:
                  _context10.next = 2;
                  return this.resolvedScope();

                case 2:
                  scope = _context10.sent;
                  ref = lively_ast.query.refWithDeclAt(pos, scope);
                  return _context10.abrupt("return", ref && { decl: ref.decl, id: ref.declId, declModule: this });

                case 5:
                case "end":
                  return _context10.stop();
              }
            }
          }, _callee10, this);
        }));

        function _localDeclForRefAt(_x6) {
          return _ref10.apply(this, arguments);
        }

        return _localDeclForRefAt;
      }()
    }, {
      key: "_importForNSRefAt",
      value: function () {
        var _ref11 = asyncToGenerator(regeneratorRuntime.mark(function _callee11(pos) {
          var scope, ast, nodes, id, member, _ref12, decl, name, spec;

          return regeneratorRuntime.wrap(function _callee11$(_context11) {
            while (1) {
              switch (_context11.prev = _context11.next) {
                case 0:
                  _context11.next = 2;
                  return this.resolvedScope();

                case 2:
                  scope = _context11.sent;
                  ast = scope.node;
                  nodes = lively_ast.query.nodesAtIndex(ast, pos);

                  if (!(nodes.length < 2)) {
                    _context11.next = 7;
                    break;
                  }

                  return _context11.abrupt("return", [null, null]);

                case 7:
                  id = nodes[nodes.length - 1], member = nodes[nodes.length - 2];

                  if (!(id.type != "Identifier" || member.type != "MemberExpression" || member.computed || member.object.type !== "Identifier")) {
                    _context11.next = 10;
                    break;
                  }

                  return _context11.abrupt("return", [null, null]);

                case 10:
                  _ref12 = scope.resolvedRefMap.get(member.object) || {};
                  decl = _ref12.decl;

                  if (!(!decl || decl.type !== "ImportDeclaration")) {
                    _context11.next = 14;
                    break;
                  }

                  return _context11.abrupt("return", [null, null]);

                case 14:
                  name = member.object.name, spec = decl.specifiers.find(function (s) {
                    return s.local.name === name;
                  });
                  return _context11.abrupt("return", spec.type !== "ImportNamespaceSpecifier" ? [null, null] : [decl, spec.local, id.name]);

                case 16:
                case "end":
                  return _context11.stop();
              }
            }
          }, _callee11, this);
        }));

        function _importForNSRefAt(_x7) {
          return _ref11.apply(this, arguments);
        }

        return _importForNSRefAt;
      }()
    }, {
      key: "_resolveImportedDecl",
      value: function () {
        var _ref13 = asyncToGenerator(regeneratorRuntime.mark(function _callee12(decl) {
          var _decl$id, start, name, type, imports, im, imM;

          return regeneratorRuntime.wrap(function _callee12$(_context12) {
            while (1) {
              switch (_context12.prev = _context12.next) {
                case 0:
                  if (decl) {
                    _context12.next = 2;
                    break;
                  }

                  return _context12.abrupt("return", []);

                case 2:
                  _decl$id = decl.id;
                  start = _decl$id.start;
                  name = _decl$id.name;
                  type = _decl$id.type;
                  _context12.next = 8;
                  return this.imports();

                case 8:
                  imports = _context12.sent;
                  im = imports.find(function (i) {
                    return i.node.start == start && // can't rely on
                    i.node.name == name && // object identity
                    i.node.type == type;
                  });

                  if (!im) {
                    _context12.next = 17;
                    break;
                  }

                  imM = module$2(this.System, im.fromModule, this.id);
                  _context12.t0 = [decl];
                  _context12.next = 15;
                  return imM.bindingPathForExport(im.imported);

                case 15:
                  _context12.t1 = _context12.sent;
                  return _context12.abrupt("return", _context12.t0.concat.call(_context12.t0, _context12.t1));

                case 17:
                  return _context12.abrupt("return", [decl]);

                case 18:
                case "end":
                  return _context12.stop();
              }
            }
          }, _callee12, this);
        }));

        function _resolveImportedDecl(_x8) {
          return _ref13.apply(this, arguments);
        }

        return _resolveImportedDecl;
      }()
    }, {
      key: "bindingPathForExport",
      value: function () {
        var _ref14 = asyncToGenerator(regeneratorRuntime.mark(function _callee13(name) {
          var exports, ex, imM, decl;
          return regeneratorRuntime.wrap(function _callee13$(_context13) {
            while (1) {
              switch (_context13.prev = _context13.next) {
                case 0:
                  _context13.next = 2;
                  return this.resolvedScope();

                case 2:
                  _context13.next = 4;
                  return this.exports();

                case 4:
                  exports = _context13.sent;
                  ex = exports.find(function (e) {
                    return e.exported === name;
                  });

                  if (!ex.fromModule) {
                    _context13.next = 17;
                    break;
                  }

                  imM = module$2(this.System, ex.fromModule, this.id);
                  decl = { decl: ex.node, id: ex.declId };

                  decl.declModule = this;
                  _context13.t0 = [decl];
                  _context13.next = 13;
                  return imM.bindingPathForExport(ex.imported);

                case 13:
                  _context13.t1 = _context13.sent;
                  return _context13.abrupt("return", _context13.t0.concat.call(_context13.t0, _context13.t1));

                case 17:
                  return _context13.abrupt("return", this._resolveImportedDecl({
                    decl: ex.decl,
                    id: ex.declId,
                    declModule: ex && ex.decl ? this : null
                  }));

                case 18:
                case "end":
                  return _context13.stop();
              }
            }
          }, _callee13, this);
        }));

        function bindingPathForExport(_x9) {
          return _ref14.apply(this, arguments);
        }

        return bindingPathForExport;
      }()
    }, {
      key: "bindingPathForRefAt",
      value: function () {
        var _ref15 = asyncToGenerator(regeneratorRuntime.mark(function _callee14(pos) {
          var decl, _ref16, _ref17, imDecl, id, name, imM;

          return regeneratorRuntime.wrap(function _callee14$(_context14) {
            while (1) {
              switch (_context14.prev = _context14.next) {
                case 0:
                  _context14.next = 2;
                  return this._localDeclForRefAt(pos);

                case 2:
                  decl = _context14.sent;

                  if (!decl) {
                    _context14.next = 7;
                    break;
                  }

                  _context14.next = 6;
                  return this._resolveImportedDecl(decl);

                case 6:
                  return _context14.abrupt("return", _context14.sent);

                case 7:
                  _context14.next = 9;
                  return this._importForNSRefAt(pos);

                case 9:
                  _ref16 = _context14.sent;
                  _ref17 = slicedToArray(_ref16, 3);
                  imDecl = _ref17[0];
                  id = _ref17[1];
                  name = _ref17[2];

                  if (imDecl) {
                    _context14.next = 16;
                    break;
                  }

                  return _context14.abrupt("return", []);

                case 16:
                  imM = module$2(this.System, imDecl.source.value, this.id);
                  _context14.t0 = [{ decl: imDecl, declModule: this, id: id }];
                  _context14.next = 20;
                  return imM.bindingPathForExport(name);

                case 20:
                  _context14.t1 = _context14.sent;
                  return _context14.abrupt("return", _context14.t0.concat.call(_context14.t0, _context14.t1));

                case 22:
                case "end":
                  return _context14.stop();
              }
            }
          }, _callee14, this);
        }));

        function bindingPathForRefAt(_x10) {
          return _ref15.apply(this, arguments);
        }

        return bindingPathForRefAt;
      }()
    }, {
      key: "definitionForRefAt",
      value: function () {
        var _ref18 = asyncToGenerator(regeneratorRuntime.mark(function _callee15(pos) {
          var path;
          return regeneratorRuntime.wrap(function _callee15$(_context15) {
            while (1) {
              switch (_context15.prev = _context15.next) {
                case 0:
                  _context15.next = 2;
                  return this.bindingPathForRefAt(pos);

                case 2:
                  path = _context15.sent;
                  return _context15.abrupt("return", path.length < 1 ? null : path[path.length - 1].decl);

                case 4:
                case "end":
                  return _context15.stop();
              }
            }
          }, _callee15, this);
        }));

        function definitionForRefAt(_x11) {
          return _ref18.apply(this, arguments);
        }

        return definitionForRefAt;
      }()

      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
      // module records
      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    }, {
      key: "record",
      value: function record() {
        var rec = this.System._loader.moduleRecords[this.id];
        if (!rec) return null;
        if (!rec.hasOwnProperty("__lively_modules__")) rec.__lively_modules__ = { evalOnlyExport: {} };
        return rec;
      }
    }, {
      key: "updateRecord",
      value: function updateRecord(doFunc) {
        var record = this.record();
        if (!record) throw new Error("es6 environment global of " + this.id + ": module not loaded, cannot get export object!");
        record.locked = true;
        try {
          return doFunc(record);
        } finally {
          record.locked = false;
        }
      }

      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
      // search
      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    }, {
      key: "search",
      value: function () {
        var _ref19 = asyncToGenerator(regeneratorRuntime.mark(function _callee16(searchStr, options) {
          var _this10 = this;

          var src, re, flags, match, res, i, j, line, lineStart, _res$j, idx, length, lineEnd;

          return regeneratorRuntime.wrap(function _callee16$(_context16) {
            while (1) {
              switch (_context16.prev = _context16.next) {
                case 0:
                  options = Object.assign({ excludedModules: [] }, options);

                  if (!options.excludedModules.some(function (ex) {
                    if (typeof ex === "string") return ex === _this10.id;
                    if (ex instanceof RegExp) return ex.test(_this10.id);
                    return false;
                  })) {
                    _context16.next = 3;
                    break;
                  }

                  return _context16.abrupt("return", []);

                case 3:
                  _context16.next = 5;
                  return this.source();

                case 5:
                  src = _context16.sent;
                  re = void 0;

                  if (searchStr instanceof RegExp) {
                    flags = 'g'; // add 'g' flag

                    if (searchStr.ignoreCase) flags += 'i';
                    if (searchStr.multiline) flags += 'm';
                    re = RegExp(searchStr.source, flags);
                  } else {
                    re = RegExp(searchStr, 'g');
                  }

                  match = void 0, res = [];

                  while ((match = re.exec(src)) !== null) {
                    res.push([match.index, match[0].length]);
                  }i = 0, j = 0, line = 1, lineStart = 0;

                case 11:
                  if (!(i < src.length && j < res.length)) {
                    _context16.next = 25;
                    break;
                  }

                  if (src[i] == '\n') {
                    line++;
                    lineStart = i + 1;
                  }
                  _res$j = slicedToArray(res[j], 2);
                  idx = _res$j[0];
                  length = _res$j[1];

                  if (!(i !== idx)) {
                    _context16.next = 18;
                    break;
                  }

                  return _context16.abrupt("continue", 22);

                case 18:
                  lineEnd = src.slice(lineStart).indexOf("\n");

                  if (lineEnd === -1) lineEnd = src.length;else lineEnd += lineStart;
                  res[j] = {
                    module: this,
                    length: length,
                    line: line, column: i - lineStart,
                    lineString: src.slice(lineStart, lineEnd)
                  };
                  j++;

                case 22:
                  i++;
                  _context16.next = 11;
                  break;

                case 25:
                  return _context16.abrupt("return", res);

                case 26:
                case "end":
                  return _context16.stop();
              }
            }
          }, _callee16, this);
        }));

        function search(_x12, _x13) {
          return _ref19.apply(this, arguments);
        }

        return search;
      }()
    }, {
      key: "toString",
      value: function toString() {
        return "module(" + this.id + ")";
      }
    }, {
      key: "dontTransform",
      get: function get() {
        return ["__lvVarRecorder", "global", "self", "_moduleExport", "_moduleImport", "fetch" // doesn't like to be called as a method, i.e. __lvVarRecorder.fetch
        ].concat(lively_lang.arr.withoutAll(lively_ast.query.knownGlobals, ["pt", "rect", "rgb", "$super", "show"]));
      }

      // FIXME... better to make this read-only, currently needed for loading
      // global modules, from instrumentation.js

    }, {
      key: "recorder",
      set: function set(v) {
        return this._recorder = v;
      },
      get: function get() {
        if (this._recorder) return this._recorder;

        var S = this.System,
            self = this;

        return this._recorder = Object.create(S.global, {

          System: { configurable: true, writable: true, value: S },

          _moduleExport: {
            value: function value(name, val) {
              scheduleModuleExportsChange(S, self.id, name, val, true /*add export*/);
            }
          },

          _moduleImport: {
            value: function value(depName, key) {
              var depId = S.decanonicalize(depName, self.id),
                  depExports = S.get(depId);

              if (!depExports) {
                console.warn("import of " + key + " failed: " + depName + " (tried as " + self.id + ") is not loaded!");
                return undefined;
              }

              self.addDependencyToModuleRecord(module$2(S, depId),
              // setter is only installed if there isn't a setter already. In
              // those cases we make sure that at least the module varRecorder gets
              // updated, which is good enough for "virtual modules"
              function (imports) {
                return Object.assign(self.recorder, imports);
              });

              if (key == undefined) return depExports;

              if (!depExports.hasOwnProperty(key)) console.warn("import from " + depExports + ": Has no export " + key + "!");

              return depExports[key];
            }
          }

        });
      }
    }]);
    return ModuleInterface;
  }();

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  var isNode = System.get("@system-env").node;
  var initialSystem = initialSystem || System;

  var SystemClass = System.constructor;
  if (!SystemClass.systems) SystemClass.systems = {};

  var defaultOptions = {
    notificationLimit: null
  };

  function livelySystemEnv(System) {
    return {
      moduleEnv: function moduleEnv(id) {
        return module$2(System, id);
      },


      // TODO this is just a test, won't work in all cases...
      get itself() {
        return System.get(System.decanonicalize("lively.modules/index.js"));
      },

      evaluationDone: function evaluationDone(moduleId) {
        module$2(System, moduleId).evaluationDone();
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
      packages: System["__lively.modules__packages"] || (System["__lively.modules__packages"] = {}),
      loadedModules: System["__lively.modules__loadedModules"] || (System["__lively.modules__loadedModules"] = {}),
      pendingExportChanges: System["__lively.modules__pendingExportChanges"] || (System["__lively.modules__pendingExportChanges"] = {}),
      notifications: System["__lively.modules__notifications"] || (System["__lively.modules__notifications"] = []),
      notificationSubscribers: System["__lively.modules__notificationSubscribers"] || (System["__lively.modules__notificationSubscribers"] = {}),
      options: System["__lively.modules__options"] || (System["__lively.modules__options"] = lively_lang.obj.deepCopy(defaultOptions))
    };
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
  }

  function makeSystem(cfg) {
    return prepareSystem(new SystemClass(), cfg);
  }

  function prepareSystem(System, config) {
    System.trace = true;
    config = config || {};

    System.set("@lively-env", System.newModule(livelySystemEnv(System)));

    wrapModuleLoad$1(System);

    if (!isHookInstalled$1(System, "normalizeHook")) installHook$1(System, "normalize", normalizeHook);

    if (!isHookInstalled$1(System, "decanonicalize", "decanonicalizeHook")) installHook$1(System, "decanonicalize", decanonicalizeHook);

    if (!isHookInstalled$1(System, "fetch", "fetch_lively_protocol")) installHook$1(System, "fetch", fetch_lively_protocol);

    if (!isHookInstalled$1(System, "newModule", "newModule_volatile")) installHook$1(System, "newModule", newModule_volatile);

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
    if (!config.transpiler && System.transpiler === "traceur") {
      System.config({
        map: {
          'plugin-babel': initialSystem.map["plugin-babel"],
          'systemjs-babel-build': initialSystem.map["systemjs-babel-build"]
        },
        transpiler: initialSystem.transpiler,
        babelOptions: Object.assign(initialSystem.babelOptions || {}, config.babelOptions)
      });
    }

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

  function decanonicalizeHook(proceed, name, parent, isPlugin) {
    var System = this;
    if (name === "..") name = '../index.js'; // Fix ".."

    // systemjs' decanonicalize has by default not the fancy
    // '{node: "events", "~node": "@mepty"}' mapping but we need it
    var pkg = parent && normalize_packageOfURL(parent, System);
    if (pkg) {
      var mappedObject = pkg.map && pkg.map[name] || System.map[name];
      if ((typeof mappedObject === "undefined" ? "undefined" : _typeof(mappedObject)) === "object") {
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
    // decanonicalize and a one-step-load
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
      while (pParts.length) {
        value = value[pParts.shift()];
      }return value;
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
      load.metadata.format = "esm";
      var match = load.name.match(/lively:\/\/([^\/]+)\/(.*)$/),
          worldId = match[1],
          localObjectName = match[2];
      return typeof $morph !== "undefined" && $morph(localObjectName) && $morph(localObjectName).textString || "/*Could not locate " + load.name + "*/";
    }
    return proceed(load);
  }

  function newModule_volatile(proceed, exports) {
    var freeze = Object.freeze;
    Object.freeze = function (x) {
      return x;
    };
    var m = proceed(exports);
    Object.freeze = freeze;
    return m;
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
  function module$1(id) {
    return module$2(exports.System, id);
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
  function removePackage(packageURL) {
    return removePackage$1(exports.System, packageURL);
  }
  function reloadPackage(packageURL) {
    return reloadPackage$1(exports.System, packageURL);
  }
  function getPackages() {
    return getPackages$1(exports.System);
  }
  function applyPackageConfig(packageConfig, packageURL) {
    return applyConfig(exports.System, packageConfig, packageURL);
  }
  function searchInPackage(packageURL, searchString, options) {
    return searchInPackage$1(exports.System, packageURL, searchString, options);
  }
  function moduleSourceChange(moduleName, newSource, options) {
    return moduleSourceChange$1(exports.System, moduleName, newSource, options);
  }
  function requireMap() {
    return requireMap$1(exports.System);
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
  exports.module = module$1;
  exports.importPackage = importPackage;
  exports.registerPackage = registerPackage;
  exports.removePackage = removePackage;
  exports.reloadPackage = reloadPackage;
  exports.getPackages = getPackages;
  exports.applyPackageConfig = applyPackageConfig;
  exports.searchInPackage = searchInPackage;
  exports.moduleSourceChange = moduleSourceChange;
  exports.requireMap = requireMap;
  exports.isHookInstalled = isHookInstalled;
  exports.installHook = installHook;
  exports.removeHook = removeHook;
  exports.wrapModuleLoad = wrapModuleLoad;
  exports.unwrapModuleLoad = unwrapModuleLoad;
  exports.getNotifications = getNotifications;
  exports.subscribe = subscribe;
  exports.unsubscribe = unsubscribe;

}((this.lively.modules = this.lively.modules || {}),lively.lang,lively.ast,lively.vm));
  if (typeof module !== "undefined" && module.exports) module.exports = GLOBAL.lively.modules;
})();