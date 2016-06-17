
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
      babelOptions: Object.assign(
        {stage3: true, es2015: true, modularRuntime: true},
        System.babelOptions)
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
    }
    
    if (!pluginBabelPath)
      for (var i = 0; i < scripts.length; i++) {
        // is systemjs loaded? Assume that systemjs-plugin-babel sits in the same folder...
        var index2 = src.indexOf("systemjs/dist/system");
        if (index2 > -1) {
          pluginBabelPath = src.slice(0, index2) + "systemjs-plugin-babel";
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

  function installHook$1(System, hookName, hook) {
    System[hookName] = lively_lang.fun.wrap(System[hookName], hook);
    System[hookName].hookFunc = hook;
  }

  function remove(System, methodName, hookOrName) {
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
      keepPreviouslyDeclaredValues: true
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
      recordGlobals: true
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
    remove(System, "translate", "lively_modules_translate_hook");
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

  var moduleSourceChange$1 = function () {
    var ref = asyncToGenerator(regeneratorRuntime.mark(function _callee(System, moduleId, oldSource, newSource, format, options) {
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
      return ref.apply(this, arguments);
    };
  }();

  var moduleSourceChangeEsm = function () {
    var ref = asyncToGenerator(regeneratorRuntime.mark(function _callee2(System, moduleId, newSource, options) {
      var debug, load, updateData, _exports, declared, deps, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, depName, depId, depModule, loaded, record, prevLoad, result;

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
              loaded = _context2.sent;

              deps.push({ name: depName, fullname: depId, module: loaded, record: depModule.record() });

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

              // 1. update the record so that when its dependencies change and cause a
              // re-execute, the correct code (new version) is run
              record = module$2(System, load.name).record();

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
              result = declared.execute();

              // for updating records, modules, etc
              // FIXME... Actually this gets compiled into the source and won't need to run again??!!!

              System.get("@lively-env").evaluationDone(load.name);

              return _context2.abrupt("return", result);

            case 50:
            case "end":
              return _context2.stop();
          }
        }
      }, _callee2, this, [[13, 30, 34, 42], [35,, 37, 41]]);
    }));
    return function moduleSourceChangeEsm(_x7, _x8, _x9, _x10) {
      return ref.apply(this, arguments);
    };
  }();

  var moduleSourceChangeGlobal = function () {
    var ref = asyncToGenerator(regeneratorRuntime.mark(function _callee3(System, moduleId, newSource, options) {
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
      return ref.apply(this, arguments);
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

  var urlTester = /[a-z][a-z0-9\+\-\.]/i;

  function isURL(id) {
    return urlTester.test(id);
  }

  function module$2(System, moduleName, parent) {
    return new ModuleInterface(System, System.decanonicalize(moduleName, parent));
  }

  // ModuleInterface is primarily used to provide an API that integrates the System
  // loader state with lively.modules extensions.
  // It does not hold any mutable state.

  var ModuleInterface = function () {
    function ModuleInterface(System, id) {
      classCallCheck(this, ModuleInterface);

      // We assume module ids to be a URL with a scheme
      if (!isURL(id)) throw new Error("ModuleInterface constructor called with " + id + " that does not seem to be a fully normalized module id.");
      this.System = System;
      this.id = id;
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
        var _this = this;

        if (this.id.match(/^http/) && this.System.global.fetch) {
          return this.System.global.fetch(this.id).then(function (res) {
            return res.text();
          });
        }
        if (this.id.match(/^file:/) && this.System.get("@system-env").node) {
          var _ret = function () {
            var path = _this.id.replace(/^file:\/\//, "");
            return {
              v: new Promise(function (resolve, reject) {
                return _this.System._nodeRequire("fs").readFile(path, function (err, content) {
                  return err ? reject(err) : resolve(String(content));
                });
              })
            };
          }();

          if ((typeof _ret === "undefined" ? "undefined" : _typeof(_ret)) === "object") return _ret.v;
        }
        return Promise.reject(new Error("Cannot retrieve source for " + this.id));
      }
    }, {
      key: "ast",
      value: function () {
        var ref = asyncToGenerator(regeneratorRuntime.mark(function _callee() {
          return regeneratorRuntime.wrap(function _callee$(_context) {
            while (1) {
              switch (_context.prev = _context.next) {
                case 0:
                  _context.next = 2;
                  return this.source();

                case 2:
                  _context.t0 = _context.sent;
                  return _context.abrupt("return", lively_ast.parse(_context.t0));

                case 4:
                case "end":
                  return _context.stop();
              }
            }
          }, _callee, this);
        }));

        function ast() {
          return ref.apply(this, arguments);
        }

        return ast;
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

      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
      // loading
      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    }, {
      key: "load",
      value: function () {
        var ref = asyncToGenerator(regeneratorRuntime.mark(function _callee2() {
          return regeneratorRuntime.wrap(function _callee2$(_context2) {
            while (1) {
              switch (_context2.prev = _context2.next) {
                case 0:
                  _context2.t0 = this.System.get(this.id);

                  if (_context2.t0) {
                    _context2.next = 5;
                    break;
                  }

                  _context2.next = 4;
                  return this.System.import(this.id);

                case 4:
                  _context2.t0 = _context2.sent;

                case 5:
                  return _context2.abrupt("return", _context2.t0);

                case 6:
                case "end":
                  return _context2.stop();
              }
            }
          }, _callee2, this);
        }));

        function load() {
          return ref.apply(this, arguments);
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
        delete this.System.get("@lively-env").loadedModules[this.id];
      }
    }, {
      key: "unloadDeps",
      value: function unloadDeps(opts) {
        var _this2 = this;

        opts = lively_lang.obj.merge({ forgetDeps: true, forgetEnv: true }, opts);
        this.dependents().forEach(function (ea) {
          _this2.System.delete(ea.id);
          if (_this2.System.loads) delete _this2.System.loads[ea.id];
          if (opts.forgetEnv) ea.unloadEnv();
        });
      }
    }, {
      key: "unload",
      value: function unload(opts) {
        opts = lively_lang.obj.merge({ forgetDeps: true, forgetEnv: true }, opts);
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
        var ref = asyncToGenerator(regeneratorRuntime.mark(function _callee3(opts) {
          var _this3 = this;

          var toBeReloaded;
          return regeneratorRuntime.wrap(function _callee3$(_context3) {
            while (1) {
              switch (_context3.prev = _context3.next) {
                case 0:
                  opts = lively_lang.obj.merge({ reloadDeps: true, resetEnv: true }, opts);
                  toBeReloaded = [this];

                  if (opts.reloadDeps) toBeReloaded = this.dependents().concat(toBeReloaded);
                  this.unload({ forgetDeps: opts.reloadDeps, forgetEnv: opts.resetEnv });
                  _context3.next = 6;
                  return Promise.all(toBeReloaded.map(function (ea) {
                    return ea.id !== _this3.id && ea.load();
                  }));

                case 6:
                  _context3.next = 8;
                  return this.load();

                case 8:
                case "end":
                  return _context3.stop();
              }
            }
          }, _callee3, this);
        }));

        function reload(_x) {
          return ref.apply(this, arguments);
        }

        return reload;
      }()

      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
      // change
      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    }, {
      key: "changeSourceAction",
      value: function () {
        var ref = asyncToGenerator(regeneratorRuntime.mark(function _callee4(changeFunc) {
          var source, newSource;
          return regeneratorRuntime.wrap(function _callee4$(_context4) {
            while (1) {
              switch (_context4.prev = _context4.next) {
                case 0:
                  _context4.next = 2;
                  return this.source();

                case 2:
                  source = _context4.sent;
                  _context4.next = 5;
                  return changeFunc(source);

                case 5:
                  newSource = _context4.sent;
                  return _context4.abrupt("return", this.changeSource(newSource, { evaluate: true }));

                case 7:
                case "end":
                  return _context4.stop();
              }
            }
          }, _callee4, this);
        }));

        function changeSourceAction(_x2) {
          return ref.apply(this, arguments);
        }

        return changeSourceAction;
      }()
    }, {
      key: "changeSource",
      value: function () {
        var ref = asyncToGenerator(regeneratorRuntime.mark(function _callee5(newSource, options) {
          var oldSource;
          return regeneratorRuntime.wrap(function _callee5$(_context5) {
            while (1) {
              switch (_context5.prev = _context5.next) {
                case 0:
                  _context5.next = 2;
                  return this.source();

                case 2:
                  oldSource = _context5.sent;
                  return _context5.abrupt("return", moduleSourceChange$1(this.System, this.id, oldSource, newSource, this.format(), options));

                case 4:
                case "end":
                  return _context5.stop();
              }
            }
          }, _callee5, this);
        }));

        function changeSource(_x3, _x4) {
          return ref.apply(this, arguments);
        }

        return changeSource;
      }()

      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
      // dependencies
      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    }, {
      key: "dependents",
      value: function dependents() {
        var _this4 = this;

        // which modules (module ids) are (in)directly import module with id
        // Let's say you have
        // module1: export var x = 23;
        // module2: import {x} from "module1.js"; export var y = x + 1;
        // module3: import {y} from "module2.js"; export var z = y + 1;
        // `dependents` gives you an answer what modules are "stale" when you
        // change module1 = module2 + module3
        return lively_lang.graph.hull(lively_lang.graph.invert(requireMap$1(this.System)), this.id).map(function (mid) {
          return module$2(_this4.System, mid);
        });
      }
    }, {
      key: "requirements",
      value: function requirements() {
        var _this5 = this;

        // which modules (module ids) are (in)directly required by module with id
        // Let's say you have
        // module1: export var x = 23;
        // module2: import {x} from "module1.js"; export var y = x + 1;
        // module3: import {y} from "module2.js"; export var z = y + 1;
        // `module("./module3").requirements()` will report ./module2 and ./module1
        return lively_lang.graph.hull(requireMap$1(this.System), this.id).map(function (mid) {
          return module$2(_this5.System, mid);
        });
      }

      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
      // module environment
      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    }, {
      key: "env",
      value: function env() {
        var id = this.id,
            S = this.System,
            ext = S.get("@lively-env");
        if (ext.loadedModules[id]) return ext.loadedModules[id];

        var e = {
          loadError: undefined,
          recorderName: "__lvVarRecorder",
          dontTransform: ["__lvVarRecorder", "global", "self", "_moduleExport", "_moduleImport", "fetch" // doesn't like to be called as a method, i.e. __lvVarRecorder.fetch
          ].concat(lively_ast.query.knownGlobals),
          recorder: Object.create(S.global, {
            _moduleExport: {
              get: function get() {
                return function (name, val) {
                  scheduleModuleExportsChange(S, id, name, val, true /*add export*/);
                };
              }
            },
            _moduleImport: {
              get: function get() {
                return function (imported, name) {
                  var id = S.decanonicalize(imported, id),
                      imported = S._loader.modules[id];
                  if (!imported) throw new Error("import of " + name + " failed: " + imported + " (tried as " + id + ") is not loaded!");
                  if (name == undefined) return imported.module;
                  if (!imported.module.hasOwnProperty(name)) console.warn("import from " + imported + ": Has no export " + name + "!");
                  return imported.module[name];
                };
              }
            }
          })
        };

        e.recorder.System = S;
        return ext.loadedModules[id] = e;
      }

      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
      // imports and exports
      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    }, {
      key: "imports",
      value: function () {
        var ref = asyncToGenerator(regeneratorRuntime.mark(function _callee6(optAstOrSource) {
          var parsed, scope, imports;
          return regeneratorRuntime.wrap(function _callee6$(_context6) {
            while (1) {
              switch (_context6.prev = _context6.next) {
                case 0:
                  if (!optAstOrSource) {
                    _context6.next = 4;
                    break;
                  }

                  _context6.t0 = typeof optAstOrSource === "string" ? lively_ast.parse(optAstOrSource) : optAstOrSource;
                  _context6.next = 7;
                  break;

                case 4:
                  _context6.next = 6;
                  return this.ast();

                case 6:
                  _context6.t0 = _context6.sent;

                case 7:
                  parsed = _context6.t0;
                  scope = lively_ast.query.scopes(parsed);
                  imports = scope.importDecls.reduce(function (imports, node) {
                    var nodes = lively_ast.query.nodesAtIndex(parsed, node.start),
                        importStmt = lively_lang.arr.without(nodes, scope.node)[0];
                    if (!importStmt) return imports;

                    var from = importStmt.source ? importStmt.source.value : "unknown module";
                    if (!importStmt.specifiers.length) // no imported vars
                      return imports.concat([{
                        local: null,
                        imported: null,
                        fromModule: from
                      }]);

                    return imports.concat(importStmt.specifiers.map(function (importSpec) {
                      var imported;
                      if (importSpec.type === "ImportNamespaceSpecifier") imported = "*";else if (importSpec.type === "ImportDefaultSpecifier") imported = "default";else if (importSpec.type === "ImportSpecifier") imported = importSpec.imported.name;else if (importStmt.source) imported = importStmt.source.name;else imported = null;
                      return {
                        local: importSpec.local ? importSpec.local.name : null,
                        imported: imported,
                        fromModule: from
                      };
                    }));
                  }, []);
                  return _context6.abrupt("return", lively_lang.arr.uniqBy(imports, function (a, b) {
                    return a.local == b.local && a.imported == b.imported && a.fromModule == b.fromModule;
                  }));

                case 11:
                case "end":
                  return _context6.stop();
              }
            }
          }, _callee6, this);
        }));

        function imports(_x5) {
          return ref.apply(this, arguments);
        }

        return imports;
      }()
    }, {
      key: "exports",
      value: function () {
        var ref = asyncToGenerator(regeneratorRuntime.mark(function _callee7(optAstOrSource) {
          var parsed, scope, exports;
          return regeneratorRuntime.wrap(function _callee7$(_context7) {
            while (1) {
              switch (_context7.prev = _context7.next) {
                case 0:
                  if (!optAstOrSource) {
                    _context7.next = 4;
                    break;
                  }

                  _context7.t0 = typeof optAstOrSource === "string" ? lively_ast.parse(optAstOrSource) : optAstOrSource;
                  _context7.next = 7;
                  break;

                case 4:
                  _context7.next = 6;
                  return this.ast();

                case 6:
                  _context7.t0 = _context7.sent;

                case 7:
                  parsed = _context7.t0;
                  scope = lively_ast.query.scopes(parsed);
                  exports = scope.exportDecls.reduce(function (exports, node) {

                    var exportsStmt = lively_ast.query.statementOf(scope.node, node);
                    if (!exportsStmt) return exports;

                    var from = exportsStmt.source ? exportsStmt.source.value : null;

                    if (exportsStmt.type === "ExportAllDeclaration") {
                      return exports.concat([{
                        local: null,
                        exported: "*",
                        fromModule: from
                      }]);
                    }

                    if (exportsStmt.specifiers && exportsStmt.specifiers.length) {
                      return exports.concat(exportsStmt.specifiers.map(function (exportSpec) {
                        return {
                          local: from ? null : exportSpec.local ? exportSpec.local.name : null,
                          exported: exportSpec.exported ? exportSpec.exported.name : null,
                          fromModule: from
                        };
                      }));
                    }

                    if (exportsStmt.declaration && exportsStmt.declaration.declarations) {
                      return exports.concat(exportsStmt.declaration.declarations.map(function (decl) {
                        return {
                          local: decl.id.name,
                          exported: decl.id.name,
                          type: exportsStmt.declaration.kind,
                          fromModule: null
                        };
                      }));
                    }

                    if (exportsStmt.declaration) {
                      return exports.concat({
                        local: exportsStmt.declaration.id.name,
                        exported: exportsStmt.declaration.id.name,
                        type: exportsStmt.declaration.type === "FunctionDeclaration" ? "function" : exportsStmt.declaration.type === "ClassDeclaration" ? "class" : null,
                        fromModule: null
                      });
                    }
                    return exports;
                  }, []);
                  return _context7.abrupt("return", lively_lang.arr.uniqBy(exports, function (a, b) {
                    return a.local == b.local && a.exported == b.exported && a.fromModule == b.fromModule;
                  }));

                case 11:
                case "end":
                  return _context7.stop();
              }
            }
          }, _callee7, this);
        }));

        function exports(_x6) {
          return ref.apply(this, arguments);
        }

        return exports;
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
        var ref = asyncToGenerator(regeneratorRuntime.mark(function _callee8(searchStr) {
          var src, re, match, res, i, j, line;
          return regeneratorRuntime.wrap(function _callee8$(_context8) {
            while (1) {
              switch (_context8.prev = _context8.next) {
                case 0:
                  _context8.next = 2;
                  return this.source();

                case 2:
                  src = _context8.sent;
                  re = new RegExp(searchStr, "g");
                  match = void 0, res = [];

                  while ((match = re.exec(src)) !== null) {
                    res.push(match.index);
                  }
                  for (i = 0, j = 0, line = 1; i < src.length && j < res.length; i++) {
                    if (src[i] == '\n') line++;
                    if (i == res[j]) {
                      res[j] = this.id + ":" + line;
                      j++;
                    }
                  }
                  return _context8.abrupt("return", res);

                case 8:
                case "end":
                  return _context8.stop();
              }
            }
          }, _callee8, this);
        }));

        function search(_x7) {
          return ref.apply(this, arguments);
        }

        return search;
      }()
    }]);
    return ModuleInterface;
  }();

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

      // For exising exports we find the execution func of each dependent module and run that
      // FIXME this means we run the entire modules again, side effects and all!!!
      if (existingExports.length) {
        debug && console.log("[lively.vm es6 updateModuleExports] updating %s dependents of %s", record.importers.length, moduleId);
        for (var i = 0, l = record.importers.length; i < l; i++) {
          var importerModule = record.importers[i];
          if (!importerModule.locked) {
            var importerIndex = importerModule.dependencies.indexOf(record);
            importerModule.setters[importerIndex](record.exports);
            // rk 2016-06-09: for now don't re-execute dependent modules on save,
            // just update module bindings
            if (false) {} else {
              runScheduledExportChanges(System, importerModule.name);
            }
          }
        }
      }
    });
  }

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
        return module$2(System, id).env();
      },

      // TODO this is just a test, won't work in all cases...
      get itself() {
        return System.get(System.decanonicalize("lively.modules/index.js"));
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

  function addGetterSettersForNewVars(System, moduleId) {
    // after eval we modify the env so that all captures vars are wrapped in
    // getter/setter to be notified of changes
    // FIXME: better to not capture via assignments but use func calls...!
    var rec = module$2(System, moduleId).env().recorder,
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

  // relative to either the package or the system:
  var normalizePackageURL = function () {
    var ref = asyncToGenerator(regeneratorRuntime.mark(function _callee(System, packageURL) {
      var url;
      return regeneratorRuntime.wrap(function _callee$(_context) {
        while (1) {
          switch (_context.prev = _context.next) {
            case 0:
              if (!Object.keys(getPackages$1(System)).some(function (ea) {
                return ea === packageURL;
              })) {
                _context.next = 2;
                break;
              }

              return _context.abrupt("return", packageURL);

            case 2:
              _context.next = 4;
              return System.normalize(packageURL);

            case 4:
              url = _context.sent;

              if (isURL$1(url)) {
                _context.next = 7;
                break;
              }

              throw new Error("Strange package URL: " + url + " is not a valid URL");

            case 7:

              // ensure it's a directory
              if (!url.match(/\.js/)) url = url;else if (url.indexOf(url + ".js") > -1) url = url.replace(/\.js$/, "");else url = url.split("/").slice(0, -1).join("/");

              if (!url.match(/\.js$/)) {
                _context.next = 10;
                break;
              }

              throw new Error("packageURL is expected to point to a directory but seems to be a .js file: " + url);

            case 10:
              return _context.abrupt("return", String(url).replace(/\/$/, ""));

            case 11:
            case "end":
              return _context.stop();
          }
        }
      }, _callee, this);
    }));
    return function normalizePackageURL(_x, _x2) {
      return ref.apply(this, arguments);
    };
  }();

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // packages
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  var importPackage$1 = function () {
    var ref = asyncToGenerator(regeneratorRuntime.mark(function _callee2(System, packageURL) {
      return regeneratorRuntime.wrap(function _callee2$(_context2) {
        while (1) {
          switch (_context2.prev = _context2.next) {
            case 0:
              _context2.next = 2;
              return registerPackage$1(System, packageURL);

            case 2:
              _context2.t0 = System;
              _context2.next = 5;
              return System.normalize(packageURL);

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
    return function importPackage(_x3, _x4) {
      return ref.apply(this, arguments);
    };
  }();

  var reloadPackage$1 = function () {
    var ref = asyncToGenerator(regeneratorRuntime.mark(function _callee3(System, packageURL) {
      var url;
      return regeneratorRuntime.wrap(function _callee3$(_context3) {
        while (1) {
          switch (_context3.prev = _context3.next) {
            case 0:
              _context3.next = 2;
              return normalizePackageURL(System, packageURL);

            case 2:
              url = _context3.sent;
              _context3.next = 5;
              return removePackage$1(System, url);

            case 5:
              return _context3.abrupt("return", importPackage$1(System, url));

            case 6:
            case "end":
              return _context3.stop();
          }
        }
      }, _callee3, this);
    }));
    return function reloadPackage(_x5, _x6) {
      return ref.apply(this, arguments);
    };
  }();

  var registerPackage$1 = function () {
    var ref = asyncToGenerator(regeneratorRuntime.mark(function _callee4(System, packageURL, packageLoadStack) {
      var url, registerSubPackages, cfg, packageConfigResult, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, subp;

      return regeneratorRuntime.wrap(function _callee4$(_context4) {
        while (1) {
          switch (_context4.prev = _context4.next) {
            case 0:
              _context4.next = 2;
              return normalizePackageURL(System, packageURL);

            case 2:
              url = _context4.sent;


              packageLoadStack = packageLoadStack || [];
              registerSubPackages = true;
              // stop here to support circular deps

              if (packageLoadStack.indexOf(url) !== -1) {
                registerSubPackages = false;
                System.debug && console.log("[lively.modules package register] %s is a circular dependency, stopping registerign subpackages", url);
              } else packageLoadStack.push(url);

              System.debug && console.log("[lively.modules package register] %s", url);
              _context4.next = 9;
              return tryToLoadPackageConfig(System, url);

            case 9:
              cfg = _context4.sent;
              _context4.next = 12;
              return applyConfig(System, cfg, url);

            case 12:
              packageConfigResult = _context4.sent;

              if (!registerSubPackages) {
                _context4.next = 40;
                break;
              }

              _iteratorNormalCompletion = true;
              _didIteratorError = false;
              _iteratorError = undefined;
              _context4.prev = 17;
              _iterator = packageConfigResult.subPackages[Symbol.iterator]();

            case 19:
              if (_iteratorNormalCompletion = (_step = _iterator.next()).done) {
                _context4.next = 26;
                break;
              }

              subp = _step.value;
              _context4.next = 23;
              return registerPackage$1(System, subp.address.replace(/\/?$/, "/"), packageLoadStack);

            case 23:
              _iteratorNormalCompletion = true;
              _context4.next = 19;
              break;

            case 26:
              _context4.next = 32;
              break;

            case 28:
              _context4.prev = 28;
              _context4.t0 = _context4["catch"](17);
              _didIteratorError = true;
              _iteratorError = _context4.t0;

            case 32:
              _context4.prev = 32;
              _context4.prev = 33;

              if (!_iteratorNormalCompletion && _iterator.return) {
                _iterator.return();
              }

            case 35:
              _context4.prev = 35;

              if (!_didIteratorError) {
                _context4.next = 38;
                break;
              }

              throw _iteratorError;

            case 38:
              return _context4.finish(35);

            case 39:
              return _context4.finish(32);

            case 40:
              return _context4.abrupt("return", cfg);

            case 41:
            case "end":
              return _context4.stop();
          }
        }
      }, _callee4, this, [[17, 28, 32, 40], [33,, 35, 39]]);
    }));
    return function registerPackage(_x7, _x8, _x9) {
      return ref.apply(this, arguments);
    };
  }();

  var tryToLoadPackageConfig = function () {
    var ref = asyncToGenerator(regeneratorRuntime.mark(function _callee5(System, packageURL) {
      var packageConfigURL, config, name;
      return regeneratorRuntime.wrap(function _callee5$(_context5) {
        while (1) {
          switch (_context5.prev = _context5.next) {
            case 0:
              packageConfigURL = packageURL + "/package.json";

              System.config({
                meta: defineProperty({}, packageConfigURL, { format: "json" }),
                packages: defineProperty({}, packageURL, { meta: { "package.json": { format: "json" } } })
              });

              System.debug && console.log("[lively.modules package reading config] %s", packageConfigURL);

              _context5.prev = 3;
              _context5.t0 = System.get(packageConfigURL);

              if (_context5.t0) {
                _context5.next = 9;
                break;
              }

              _context5.next = 8;
              return System.import(packageConfigURL);

            case 8:
              _context5.t0 = _context5.sent;

            case 9:
              config = _context5.t0;

              lively_lang.arr.pushIfNotIncluded(System.packageConfigPaths, packageConfigURL);
              return _context5.abrupt("return", config);

            case 14:
              _context5.prev = 14;
              _context5.t1 = _context5["catch"](3);

              console.log("[lively.modules package] Unable loading package config %s for package: ", packageConfigURL, _context5.t1);
              delete System.meta[packageConfigURL];
              name = packageURL.split("/").slice(-1)[0];
              return _context5.abrupt("return", { name: name });

            case 20:
            case "end":
              return _context5.stop();
          }
        }
      }, _callee5, this, [[3, 14]]);
    }));
    return function tryToLoadPackageConfig(_x10, _x11) {
      return ref.apply(this, arguments);
    };
  }();

  var join = lively_lang.string.joinPath;

  function isURL$1(string) {
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
    return isURL$1(urlOrName) ? urlOrName : // absolute
    urlResolve(join(urlOrName[0] === "." ? packageURL : System.baseURL, urlOrName));
  }

  function removePackage$1(System, packageURL) {
    packageURL = packageURL.replace(/\/$/, "");
    var conf = System.getConfig(),
        packageConfigURL = packageURL + "/package.json";

    System.delete(String(packageConfigURL));
    lively_lang.arr.remove(conf.packageConfigPaths || [], packageConfigURL);

    var p = getPackages$1(System)[packageURL];
    if (p) p.modules.forEach(function (mod) {
      return module$2(System, mod.name).unload({ forgetEnv: true, forgetDeps: false });
    });

    System.config({
      meta: defineProperty({}, packageConfigURL, {}),
      packages: defineProperty({}, packageURL, {}),
      packageConfigPaths: conf.packageConfigPaths
    });
    delete System.meta[packageConfigURL];
    delete System.packages[packageURL];
  }

  // "pseudo-config"


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

    var packageApplyResult = livelyConfig ? applyLivelyConfig(System, livelyConfig, packageURL) : { subPackages: [] };

    packageInSystem.names = packageInSystem.names || [];
    lively_lang.arr.pushIfNotIncluded(packageInSystem.names, name);

    if (!main.match(/\.[^\/\.]+/)) main += ".js";
    packageInSystem.main = main;

    // System.packages doesn't allow us to store our own properties
    System.get("@lively-env").packages[packageURL] = packageInSystem;

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
        return System.decanonicalize(f, packageURL + "/");
      });
      bundles[absName] = files;
      return bundles;
    }, {});
    System.config({ bundles: normalized });
    return Promise.resolve();
  }

  function applyLivelyConfigMeta(System, livelyConfig, packageURL) {
    if (!livelyConfig.meta) return;
    var pConf = System.getConfig().packages[packageURL] || {},
        c = { meta: {}, packages: defineProperty({}, packageURL, pConf) };
    Object.keys(livelyConfig.meta).forEach(function (key) {
      var val = livelyConfig.meta[key];
      if (isURL$1(key)) {
        c.meta[key] = val;
      } else {
        if (!pConf.meta) pConf.meta = {};
        pConf.meta[key] = val;
      }
    });
    System.config(c);
  }

  function applyLivelyConfigPackageMap(System, livelyConfig, packageURL) {
    var subPackages = livelyConfig.packageMap ? Object.keys(livelyConfig.packageMap).map(function (name) {
      return subpackageNameAndAddress(System, livelyConfig, name, packageURL);
    }) : [];
    return { subPackages: subPackages };
  }

  function subpackageNameAndAddress(System, livelyConfig, subPackageName, packageURL) {
    var pConf = System.packages[packageURL],
        preferLoadedPackages = livelyConfig.hasOwnProperty("preferLoadedPackages") ? livelyConfig.preferLoadedPackages : true,
        normalized = System.decanonicalize(subPackageName, packageURL + "/");

    if (preferLoadedPackages && (pConf.map[subPackageName] || System.map[subPackageName] || System.get(normalized))) {
      var subpackageURL;
      if (pConf.map[subPackageName]) subpackageURL = normalizeInsidePackage(System, pConf.map[subPackageName], packageURL);else if (System.map[subPackageName]) subpackageURL = normalizeInsidePackage(System, System.map[subPackageName], packageURL);else subpackageURL = normalized;
      if (System.get(subpackageURL)) subpackageURL = subpackageURL.split("/").slice(0, -1).join("/"); // force to be dir
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
        livelyPackages = System.get("@lively-env").packages,
        packageNames = lively.lang.arr.uniq(Object.keys(sysPackages).concat(Object.keys(livelyPackages))),
        result = [];

    groupIntoPackages(System, modules, packageNames).mapGroups(function (packageAddress, moduleNames) {
      var systemP = sysPackages[packageAddress],
          livelyP = livelyPackages[packageAddress],
          p = livelyP && systemP ? Object.assign(livelyP, systemP) : livelyP || systemP,
          names = p ? p.names : [];
      if (!names || !names.length) names = [packageAddress.replace(/^(?:.+\/)?([^\/]+)$/, "$1")];

      moduleNames = moduleNames.filter(function (name) {
        return name !== packageAddress && name !== packageAddress + "/";
      });

      result.push(Object.assign(p || {}, {
        address: packageAddress,
        name: names[0],
        names: names,
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

  var GLOBAL = typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : this;

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
  function getPackages(moduleNames) {
    return getPackages$1(exports.System);
  }
  function applyPackageConfig(packageConfig, packageURL) {
    return applyConfig(exports.System, packageConfig, packageURL);
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
    return remove(exports.System, methodName, hookOrName);
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