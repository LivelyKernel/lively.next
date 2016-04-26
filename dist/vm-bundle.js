System.registerDynamic('lively.vm/package.json', [], false, function(require, exports, module) {
return {
  "name": "lively.vm",
  "version": "0.4.9",
  "description": "Controlled JavaScript code execution and instrumentation.",
  "main": "index-node.js",
  "systemjs": {
    "main": "index.js",
    "map": {
      "path": {
        "node": "@node/path",
        "~node": "@empty"
      },
      "module": {
        "node": "@node/module",
        "~node": "@empty"
      },
      "fs": {
        "node": "@node/fs",
        "~node": "@empty"
      }
    }
  },
  "lively": {
    "packageMap": {
      "lively.lang": "./node_modules/lively.lang",
      "lively.ast": "./node_modules/lively.ast"
    }
  },
  "scripts": {
    "test": "cd tests/ && node es6-mocha-nodejs-runner.js && cd .. && phantomjs node_modules/mocha-phantomjs-core/mocha-phantomjs-core.js tests/run-tests.html",
    "build": "node build.js"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/LivelyKernel/lively.vm.git"
  },
  "keywords": [
    "LivelyWeb",
    "JavaScript"
  ],
  "author": "Robert Krahn",
  "license": "MIT",
  "bugs": {
    "url": "https://github.com/LivelyKernel/lively.vm/issues"
  },
  "homepage": "https://github.com/LivelyKernel/lively.vm",
  "dependencies": {
    "babel-core": "^5.8.35",
    "lively.ast": "^0.5.4",
    "lively.lang": "^0.5.12",
    "node-uuid": "^1.4.7",
    "systemjs": "^0.19.20",
    "systemjs-builder": "^0.15.13"
  },
  "devDependencies": {
    "browserify": "^13.0.0",
    "chai": "^3.3.0",
    "chai-subset": "^1.1.0",
    "code-pump": "^0.1.6",
    "mocha": "^2.3.3",
    "mocha-phantomjs-core": "^1.3.0",
    "uglify-js": "^2.6.1"
  }
}

});

System.register('lively.vm/index.js', [
    './lib/completions.js',
    './lib/commonjs-interface.js',
    './lib/es6-interface.js',
    './lib/evaluator.js'
], function (_export) {
    'use strict';
    var completions, cjs, es6, load, configure, bootstrap;
    function setLoadFunction(f) {
        _export('load', load = f);
    }
    function setConfigureFunction(f) {
        _export('configure', configure = f);
    }
    function setBootstrapFunction(f) {
        _export('bootstrap', bootstrap = f);
    }
    return {
        setters: [
            function (_libCompletionsJs) {
                completions = _libCompletionsJs;
            },
            function (_libCommonjsInterfaceJs) {
                cjs = _libCommonjsInterfaceJs;
            },
            function (_libEs6InterfaceJs) {
                es6 = _libEs6InterfaceJs;
            },
            function (_libEvaluatorJs) {
                for (var _key in _libEvaluatorJs) {
                    if (_key !== 'default')
                        _export(_key, _libEvaluatorJs[_key]);
                }
            }
        ],
        execute: function () {
            _export('completions', completions);
            _export('cjs', cjs);
            _export('es6', es6);
            _export('bootstrap', bootstrap);
            _export('load', load);
            _export('configure', configure);
            _export('setBootstrapFunction', setBootstrapFunction);
            _export('setLoadFunction', setLoadFunction);
            _export('setConfigureFunction', setConfigureFunction);
        }
    };
})
System.register('lively.vm/lib/completions.js', ['lively.lang'], function (_export) {
    'use strict';
    var lang;
    function signatureOf(name, func) {
        var source = String(func), match = source.match(/function\s*[a-zA-Z0-9_$]*\s*\(([^\)]*)\)/), params = match && match[1] || '';
        return name + '(' + params + ')';
    }
    function isClass(obj) {
        if (obj === obj || obj === Array || obj === Function || obj === String || obj === Boolean || obj === Date || obj === RegExp || obj === Number || obj === Promise)
            return true;
        return obj instanceof Function && (obj.superclass !== undefined || obj._superclass !== undefined);
    }
    function pluck(list, prop) {
        return list.map(function (ea) {
            return ea[prop];
        });
    }
    function getObjectForCompletion(evalFunc, stringToEval) {
        var startLetters = '';
        return Promise.resolve().then(function () {
            var idx = stringToEval.lastIndexOf('.');
            if (idx >= 0) {
                startLetters = stringToEval.slice(idx + 1);
                stringToEval = stringToEval.slice(0, idx);
            } else {
                startLetters = stringToEval;
                stringToEval = '(typeof window === "undefined" ? global : window)';
            }
            return evalFunc(stringToEval);
        }).then(function (evalResult) {
            return {
                evalResult: evalResult,
                startLetters: startLetters,
                code: stringToEval
            };
        });
    }
    function propertyExtract(excludes, obj, extractor) {
        return Object.getOwnPropertyNames(obj).filter(function (key) {
            return excludes.indexOf(key) === -1;
        }).map(extractor).filter(function (ea) {
            return !!ea;
        }).sort(function (a, b) {
            return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
        });
    }
    function getMethodsOf(excludes, obj) {
        return propertyExtract(excludes, obj, function (key) {
            if (obj.__lookupGetter__ && obj.__lookupGetter__(key) || typeof obj[key] !== 'function')
                return null;
            return {
                name: key,
                completion: signatureOf(key, obj[key])
            };
        });
    }
    function getAttributesOf(excludes, obj) {
        return propertyExtract(excludes, obj, function (key) {
            if (obj.__lookupGetter__ && !obj.__lookupGetter__(key) && typeof obj[key] === 'function')
                return null;
            return {
                name: key,
                completion: key
            };
        });
    }
    function getProtoChain(obj) {
        var protos = [], proto = obj;
        while (obj) {
            protos.push(obj);
            obj = obj.__proto__;
        }
        return protos;
    }
    function getDescriptorOf(originalObj, proto) {
        function shorten(s, len) {
            if (s.length > len)
                s = s.slice(0, len) + '...';
            return s.replace(/\n/g, '').replace(/\s+/g, ' ');
        }
        if (originalObj === proto) {
            if (typeof originalObj !== 'function')
                return shorten(originalObj.toString ? originalObj.toString() : '[some object]', 50);
            var funcString = originalObj.toString(), body = shorten(funcString.slice(funcString.indexOf('{') + 1, funcString.lastIndexOf('}')), 50);
            return signatureOf(originalObj.displayName || originalObj.name || 'function', originalObj) + ' {' + body + '}';
        }
        var klass = proto.hasOwnProperty('constructor') && proto.constructor;
        if (!klass)
            return 'prototype';
        if (typeof klass.type === 'string' && klass.type.length)
            return shorten(klass.type, 50);
        if (typeof klass.name === 'string' && klass.name.length)
            return shorten(klass.name, 50);
        return 'anonymous class';
    }
    function getCompletionsOfObj(obj, thenDo) {
        var err, completions;
        try {
            var excludes = [];
            completions = getProtoChain(obj).map(function (proto) {
                var descr = getDescriptorOf(obj, proto), methodsAndAttributes = getMethodsOf(excludes, proto).concat(getAttributesOf(excludes, proto));
                excludes = excludes.concat(pluck(methodsAndAttributes, 'name'));
                return [
                    descr,
                    pluck(methodsAndAttributes, 'completion')
                ];
            });
        } catch (e) {
            err = e;
        }
        thenDo(err, completions);
    }
    function descriptorsOfObjAndProtoProperties(obj) {
        var excludes = [], completions = getProtoChain(obj).map(function (proto) {
                var descr = getDescriptorOf(obj, proto), methodsAndAttributes = getMethodsOf(excludes, proto).concat(getAttributesOf(excludes, proto));
                excludes = excludes.concat(pluck(methodsAndAttributes, 'name'));
                return [
                    descr,
                    pluck(methodsAndAttributes, 'completion')
                ];
            });
        return completions;
    }
    function getCompletions(evalFunc, string, thenDo) {
        var promise = getObjectForCompletion(evalFunc, string).then(function (evalResultAndStartLetters) {
            var evalResult = evalResultAndStartLetters.evalResult, value = evalResult && evalResult.isEvalResult ? evalResult.value : evalResult, result = {
                    completions: descriptorsOfObjAndProtoProperties(value),
                    startLetters: evalResultAndStartLetters.startLetters,
                    code: evalResultAndStartLetters.code
                };
            if (evalResult && evalResult.isPromise) {
                if (evalResult.promiseStatus === 'fulfilled')
                    result.promiseResolvedCompletions = descriptorsOfObjAndProtoProperties(evalResult.promisedValue);
                else if (evalResult.promiseStatus === 'rejected')
                    result.promiseRejectedCompletions = descriptorsOfObjAndProtoProperties(evalResult.promisedValue);
            }
            return result;
        });
        if (typeof thenDo === 'function') {
            promise.then(function (result) {
                return thenDo(null, result);
            })['catch'](function (err) {
                return thenDo(err);
            });
        }
        return promise;
    }
    return {
        setters: [function (_livelyLang) {
                lang = _livelyLang;
            }],
        execute: function () {
            _export('getCompletions', getCompletions);
        }
    };
})
System.register('lively.vm/lib/commonjs-interface.js', [
    'path',
    'lively.lang',
    'module',
    'fs',
    './evaluator'
], function (_export) {
    'use strict';
    var path, lang, Module, fs, evaluator, isNode, GLOBAL, debug, join, isAbsolute, relative, dirname, nodeModules, __dirname, __filename, loadedModules, requireMap, originalCompile, originalLoad, exceptions, scratchModule, loadDepth;
    function callsite() {
        var orig = Error.prepareStackTrace;
        Error.prepareStackTrace = function (_, stack) {
            return stack;
        };
        var err = new Error();
        Error.captureStackTrace(err, arguments.callee);
        var stack = err.stack;
        Error.prepareStackTrace = orig;
        return stack;
    }
    function resolve(file, parent) {
        if (typeof parent === 'string')
            parent = { id: parent };
        try {
            return nodeModules.resolve(file, parent);
        } catch (e) {
        }
        if (!isAbsolute(file) && parent) {
            if (!file.match(/\.js$/))
                file += '.js';
            try {
                return nodeModules.resolve(join(parent.id, '..', file));
            } catch (e) {
            }
        }
        var frames = callsite(), frame;
        for (var i = 2; i < frames.length; i++) {
            frame = frames[i];
            var frameFile = frame.getFileName();
            if (!frameFile)
                continue;
            var dir = dirname(frameFile), full = join(dir, file);
            try {
                return nodeModules.resolve(full, parent);
            } catch (e) {
            }
        }
        try {
            return nodeModules.resolve(join(process.cwd(), file), parent);
        } catch (e) {
        }
        return file;
    }
    function sourceOf(moduleName, parent) {
        var read = lang.promise.convertCallbackFun(fs.readFile);
        return read(resolve(moduleName, parent)).then(String);
    }
    function getExceptions() {
        return exceptions;
    }
    function setExceptions(value) {
        return exceptions = value;
    }
    function instrumentedFiles() {
        return Object.keys(loadedModules);
    }
    function isLoaded(fileName) {
        return nodeModules.cache[fileName] && fileName in loadedModules;
    }
    function ensureRecorder(fullName) {
        return ensureEnv(fullName).recorder;
    }
    function ensureEnv(fullName) {
        return loadedModules[fullName] || (loadedModules[fullName] = {
            isInstrumented: false,
            loadError: undefined,
            recorderName: '__lv_rec__',
            recorder: Object.create(GLOBAL)
        });
    }
    function prepareCodeForCustomCompile(source, filename, env) {
        source = String(source);
        var magicVars = [
                'exports',
                'require',
                'module',
                '__filename',
                '__dirname'
            ], tfmOptions = {
                topLevelVarRecorder: env.recorder,
                varRecorderName: env.recorderName,
                dontTransform: [
                    env.recorderName,
                    'global'
                ].concat(magicVars),
                recordGlobals: true
            }, header = 'var __cjs = System.get(\'file://' + __filename + '\'),\n    ' + env.recorderName + ' = __cjs.envFor(\'' + filename + '\').recorder;\n' + magicVars.map(function (varName) {
                return env.recorderName + '.' + varName + ' = ' + varName + ';';
            }).join('\n');
        try {
            return header + '\n' + ';(function() {\n' + evaluator.evalCodeTransform(source, tfmOptions) + '\n})();';
        } catch (e) {
            return e;
        }
    }
    function customCompile(content, filename) {
        if (exceptions.some(function (exc) {
                return exc(filename);
            }) || isLoaded(filename))
            return originalCompile.call(this, content, filename);
        debug && console.log('[lively.vm customCompile] %s', filename);
        if (!nodeModules.cache[filename] && loadedModules[filename])
            delete loadedModules[filename];
        var env = ensureEnv(filename), _ = env.isInstrumented = true, tfmedContent = prepareCodeForCustomCompile(content, filename, env);
        if (tfmedContent instanceof Error) {
            console.warn('Cannot compile module %s:', filename, tfmedContent);
            env.loadError = tfmedContent;
            var result = originalCompile.call(this, content, filename);
            return result;
        }
        GLOBAL[env.recorderName] = env.recorder;
        loadDepth++;
        try {
            var result = originalCompile.call(this, tfmedContent, filename);
            env.loadError = undefined;
            return result;
        } catch (e) {
            console.log('-=-=-=-=-=-=-=-');
            console.error('[lively.vm commonjs] evaluator error loading module: ', e.stack || e);
            console.log('-=-=-=-=-=-=-=-');
            console.log(tfmedContent);
            console.log('-=-=-=-=-=-=-=-');
            env.loadError = e;
            throw e;
        } finally {
            loadDepth--;
        }
    }
    function customLoad(request, parent, isMain) {
        var id = resolve(request, parent), parentId = resolve(parent.id);
        if (exceptions.some(function (exc) {
                return exc(id);
            }) || exceptions.some(function (exc) {
                return exc(parentId);
            }))
            return originalLoad.call(this, request, parent, isMain);
        if (debug) {
            var parentRel = relative(process.cwd(), parentId);
            console.log(lang.string.indent('[lively.vm cjs dependency] %s -> %s', ' ', loadDepth), parentRel, request);
        }
        if (!requireMap[parent.id])
            requireMap[parent.id] = [id];
        else
            requireMap[parent.id].push(id);
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
        var fullName = resolve(moduleName);
        return ensureEnv(fullName);
    }
    function runEval(code, options) {
        options = lang.obj.merge({
            targetModule: null,
            parentModule: null
        }, options);
        return Promise.resolve().then(function () {
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
                    throw new Error('Cannot load module ' + options.targetModule + ' (tried as ' + fullName + ')\noriginal load error: ' + e.stack);
                }
            }
            var m = nodeModules.cache[fullName], env = envFor(fullName), rec = env.recorder, recName = env.recorderName;
            rec.__filename = m.filename;
            var d = rec.__dirname = dirname(m.filename);
            rec.exports = m.exports;
            rec.module = m;
            GLOBAL[recName] = rec;
            options = lang.obj.merge(options, {
                recordGlobals: true,
                dontTransform: [
                    recName,
                    'global'
                ],
                varRecorderName: recName,
                topLevelVarRecorder: rec,
                sourceURL: options.targetModule,
                context: rec.exports || {}
            });
            return evaluator.runEval(code, options);
        });
    }
    function importCjsModule(name) {
        return new Promise(function (ok) {
            return ok(nodeModules.require(resolve(name)));
        });
    }
    function status(thenDo) {
        var files = Object.keys(loadedModules), envs = files.reduce(function (envs, fn) {
                envs[fn] = {
                    loadError: loadedModules[fn].loadError,
                    isLoaded: isLoaded(fn),
                    recorderName: loadedModules[fn].recorderName,
                    isInstrumented: loadedModules[fn].isInstrumented,
                    recordedVariables: Object.keys(loadedModules[fn].recorder)
                };
                return envs;
            }, {});
        if (typeof thenDo === 'function')
            thenDo(null, envs);
        return Promise.resolve(envs);
    }
    function statusForPrinted(moduleName, options, thenDo) {
        options = lang.obj.merge({ depth: 3 }, options);
        var env = envFor(moduleName);
        var state = {
            loadError: env.loadError,
            recorderName: env.recorderName,
            recordedVariables: env.recorder
        };
        thenDo(null, lang.obj.inspect(state, { maxDepth: options.depth }));
    }
    function _invalidateCacheForModules(fullModuleIds, moduleMap) {
        fullModuleIds.forEach(function (id) {
            delete moduleMap[id];
            delete loadedModules[id];
        });
    }
    function forgetModule(moduleName, parent) {
        var id = resolve(moduleName, parent), deps = findDependentsOf(id);
        _invalidateCacheForModules([id].concat(deps), Module._cache);
        return id;
    }
    function forgetModuleDeps(moduleName, parent) {
        var id = resolve(moduleName, parent), deps = findDependentsOf(id);
        _invalidateCacheForModules(deps, Module._cache);
        return id;
    }
    function reloadModule(moduleName, parent) {
        var id = forgetModule(moduleName, parent);
        return nodeModules.require(id);
    }
    function findDependentsOf(id) {
        return lang.graph.hull(lang.graph.invert(requireMap), resolve(id));
    }
    function findRequirementsOf(id) {
        return lang.graph.hull(requireMap, resolve(id));
    }
    return {
        setters: [
            function (_path) {
                path = _path;
            },
            function (_livelyLang) {
                lang = _livelyLang;
            },
            function (_module2) {
                Module = _module2.Module;
            },
            function (_fs) {
                fs = _fs;
            },
            function (_evaluator) {
                evaluator = _evaluator;
            }
        ],
        execute: function () {
            isNode = System.get('@system-env').node;
            GLOBAL = typeof window !== 'undefined' ? window : typeof Global !== 'undefined' ? Global : global;
            debug = false;
            join = path.join || lang.string.joinPath;
            isAbsolute = path.isAbsolute || function (p) {
                return !!p.match(/^(\/|[^\/]+:\/\/)/);
            };
            relative = path.relative || function (base, path) {
                return path;
            };
            dirname = path.dirname || function (path) {
                return path.replace(/\/[^\/]+$/, '');
            };
            nodeModules = isNode ? Object.defineProperties({}, {
                cache: {
                    get: function get() {
                        return Module._cache;
                    },
                    configurable: true,
                    enumerable: true
                },
                require: {
                    get: function get() {
                        return function (name, parent) {
                            return System._nodeRequire(name, parent);
                        };
                    },
                    configurable: true,
                    enumerable: true
                },
                resolve: {
                    get: function get() {
                        return function (name, parent) {
                            return Module._resolveFilename(name, parent);
                        };
                    },
                    configurable: true,
                    enumerable: true
                }
            }) : Object.defineProperties({}, {
                cache: {
                    get: function get() {
                        console.warn('[lively.vm cjs] module cache accessor used on non-node system');
                        return {};
                    },
                    configurable: true,
                    enumerable: true
                },
                require: {
                    get: function get() {
                        return function (name, parent) {
                            console.warn('[lively.vm cjs] require used on non-node system');
                            return undefined;
                        };
                    },
                    configurable: true,
                    enumerable: true
                },
                resolve: {
                    get: function get() {
                        return function (name, parent) {
                            console.warn('[lively.vm cjs] resolveFilename used on non-node system');
                            return name;
                        };
                    },
                    configurable: true,
                    enumerable: true
                }
            });
            __dirname = System.normalizeSync('lively.vm/lib/').replace(/^[^:]+:\/\//, '');
            __filename = isNode ? join(__dirname, 'commonjs-interface.js') : System.normalizeSync('lively.vm/lib/commonjs-interface.js').replace(/^[^:]+:\/\//, '');
            loadedModules = {};
            requireMap = {};
            originalCompile = null;
            originalLoad = null;
            exceptions = [];
            scratchModule = join(__dirname, 'commonjs-scratch.js');
            loadDepth = 0;
            _export('_requireMap', requireMap);
            _export('_loadedModules', loadedModules);
            _export('instrumentedFiles', instrumentedFiles);
            _export('_prepareCodeForCustomCompile', prepareCodeForCustomCompile);
            _export('_getExceptions', getExceptions);
            _export('_setExceptions', setExceptions);
            _export('sourceOf', sourceOf);
            _export('envFor', envFor);
            _export('status', status);
            _export('statusForPrinted', statusForPrinted);
            _export('runEval', runEval);
            _export('resolve', resolve);
            _export('import', importCjsModule);
            _export('reloadModule', reloadModule);
            _export('forgetModule', forgetModule);
            _export('forgetModuleDeps', forgetModuleDeps);
            _export('findRequirementsOf', findRequirementsOf);
            _export('findDependentsOf', findDependentsOf);
            _export('wrapModuleLoad', wrapModuleLoad);
            _export('unwrapModuleLoad', unwrapModuleLoad);
        }
    };
})
System.register('lively.vm/lib/es6-interface.js', [
    'path',
    'lively.lang',
    'lively.ast',
    './evaluator',
    './commonjs-interface.js',
    'module'
], function (_export) {
    'use strict';
    var path, arr, obj, string, graph, properties, classHelper, ast, evaluator, cjs, Module, __require, GLOBAL, SystemLoader, isNode, debug, node_modulesDir, exceptions, pendingConfigs, configInitialized, esmFormatCommentRegExp, cjsFormatCommentRegExp, esmRegEx, pendingExportChanges;
    function _defineProperty(obj, key, value) {
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
    }
    function currentSystem() {
        return GLOBAL.System;
    }
    function relative(_x, _x2) {
        var _again = true;
        _function:
            while (_again) {
                var a = _x, b = _x2;
                _again = false;
                if (!path || !path.relative) {
                    return b;
                } else {
                    _x = a;
                    _x2 = b;
                    _again = true;
                    continue _function;
                }
            }
    }
    function relativeName(name) {
        var base = currentSystem().baseURL.replace(/^[\w]+:\/\//, ''), abs = name.replace(/^[\w]+:\/\//, '');
        return relative(base, abs);
    }
    function join(pathA, pathB) {
        return pathA.replace(/\/$/, '') + '/' + pathB.replace(/^\//, '');
    }
    function getExceptions() {
        return exceptions;
    }
    function setExceptions(v) {
        return exceptions = v;
    }
    function init(cfg) {
        var SystemLoader = currentSystem().constructor;
        debug && console.log('[lively.vm es6] defining new System');
        GLOBAL.System = new SystemLoader();
        currentSystem().trace = true;
        cfg = obj.merge({
            transpiler: 'babel',
            babelOptions: {}
        }, cfg);
        if (currentSystem().get('@system-env').node) {
            var nodejsCoreModules = [
                    'addons',
                    'assert',
                    'buffer',
                    'child_process',
                    'cluster',
                    'console',
                    'crypto',
                    'dgram',
                    'dns',
                    'domain',
                    'events',
                    'fs',
                    'http',
                    'https',
                    'module',
                    'net',
                    'os',
                    'path',
                    'punycode',
                    'querystring',
                    'readline',
                    'repl',
                    'stream',
                    'stringdecoder',
                    'timers',
                    'tls',
                    'tty',
                    'url',
                    'util',
                    'v8',
                    'vm',
                    'zlib'
                ], map = nodejsCoreModules.reduce(function (map, ea) {
                    map[ea] = '@node/' + ea;
                    return map;
                }, {});
            cfg.map = obj.merge(map, cfg.map);
            cfg.paths = obj.merge({ 'node_modules:*': './node_modules/*' }, cfg.paths);
            cfg.packageConfigPaths = cfg.packageConfigPaths || ['./node_modules/*/package.json'];
            if (!cfg.hasOwnProperty('defaultJSExtensions'))
                cfg.defaultJSExtensions = true;
        }
        config(cfg);
    }
    function config(cfg) {
        if (!configInitialized && !cfg.baseURL) {
            debug && console.log('[lively.vm es6 config call queued]');
            pendingConfigs.push(cfg);
            return;
        }
        debug && console.log('[lively.vm es6 System] config');
        currentSystem().config(cfg);
        if (!configInitialized) {
            configInitialized = true;
            pendingConfigs.forEach(function (ea) {
                return currentSystem().config(ea);
            });
        }
    }
    function importES6Module(path, options) {
        if (typeof options !== 'undefined')
            config(options);
        return currentSystem()['import'](path);
    }
    function instrumentedFiles() {
        return Object.keys(currentSystem().__lively_vm__.loadedModules);
    }
    function isLoaded(fullname) {
        return fullname in currentSystem().__lively_vm__.loadedModules;
    }
    function canonicalURL(url) {
        var m = url.match(/([^:]+:\/\/)(.*)/);
        if (m) {
            var protocol = m[1];
            url = m[2];
        }
        url = url.replace(/([^:])\/[\/]+/g, '$1/');
        return (protocol || '') + url;
    }
    function resolve(name, parentName, parentAddress) {
        return canonicalURL(currentSystem().normalizeSync(name, parentName, parentAddress));
    }
    function addGetterSettersForNewVars(moduleId, env) {
        var prefix = '__lively.vm__';
        Object.keys(env).forEach(function (key) {
            if (key.indexOf(prefix) === 0 || env.__lookupGetter__(key))
                return;
            env[prefix + key] = env[key];
            env.__defineGetter__(key, function () {
                return env[prefix + key];
            });
            env.__defineSetter__(key, function (v) {
                scheduleModuleExportsChange(moduleId, key, v, false);
                return env[prefix + key] = v;
            });
        });
    }
    function envFor(fullname) {
        if (currentSystem().__lively_vm__.loadedModules[fullname])
            return currentSystem().__lively_vm__.loadedModules[fullname];
        var env = currentSystem().__lively_vm__.loadedModules[fullname] = {
            loadError: undefined,
            recorderName: '__rec__',
            dontTransform: [
                '__lively_vm__',
                '__rec__',
                '__lvVarRecorder',
                'global',
                'System',
                '_moduleExport',
                '_moduleImport'
            ].concat(ast.query.knownGlobals),
            recorder: Object.create(GLOBAL, {
                _moduleExport: {
                    get: function get() {
                        return function (name, val) {
                            return scheduleModuleExportsChange(fullname, name, val, true);
                        };
                    }
                },
                _moduleImport: {
                    get: function get() {
                        return function (moduleName, name) {
                            var fullModuleName = resolve(moduleName, fullname), imported = currentSystem()._loader.modules[fullModuleName];
                            if (!imported)
                                throw new Error('import of ' + name + ' failed: ' + moduleName + ' (tried as ' + fullModuleName + ') is not loaded!');
                            if (name == undefined)
                                return imported.module;
                            if (!imported.module.hasOwnProperty(name))
                                console.warn('import from ' + moduleName + ': Has no export ' + name + '!');
                            return imported.module[name];
                        };
                    }
                }
            })
        };
        return env;
    }
    function moduleRecordFor(fullname) {
        var record = currentSystem()._loader.moduleRecords[fullname];
        if (!record)
            return null;
        if (!record.hasOwnProperty('__lively_vm__'))
            record.__lively_vm__ = { evalOnlyExport: {} };
        return record;
    }
    function updateModuleRecordOf(fullname, doFunc) {
        var record = moduleRecordFor(fullname);
        if (!record)
            throw new Error('es6 environment global of ' + fullname + ': module not loaded, cannot get export object!');
        record.locked = true;
        try {
            doFunc(record);
        } finally {
            record.locked = false;
        }
    }
    function sourceOf(moduleName, parent) {
        var name = resolve(moduleName), load = currentSystem().loads && currentSystem().loads[name] || {
                status: 'loading',
                address: name,
                name: name,
                linkSets: [],
                dependencies: [],
                metadata: {}
            };
        return currentSystem().fetch(load);
    }
    function importsAndExportsOf(moduleName) {
        return currentSystem().normalize(moduleName).then(function (id) {
            return Promise.resolve(sourceOf(id)).then(function (source) {
                var parsed = ast.parse(source), scope = ast.query.scopes(parsed);
                var imports = scope.importDecls.reduce(function (imports, node) {
                    var nodes = ast.query.nodesAtIndex(parsed, node.start);
                    var importStmt = arr.without(nodes, scope.node)[0];
                    if (!importStmt)
                        return imports;
                    var from = importStmt.source ? importStmt.source.value : 'unknown module';
                    if (!importStmt.specifiers.length)
                        return imports.concat([{
                                localModule: id,
                                local: null,
                                imported: null,
                                fromModule: from,
                                importStatement: importStmt
                            }]);
                    return imports.concat(importStmt.specifiers.map(function (importSpec) {
                        var imported;
                        if (importSpec.type === 'ImportNamespaceSpecifier')
                            imported = '*';
                        else if (importSpec.type === 'ImportDefaultSpecifier')
                            imported = 'default';
                        else if (importStmt.source)
                            imported = importStmt.source.name;
                        else
                            imported = null;
                        return {
                            localModule: id,
                            local: importSpec.local ? importSpec.local.name : null,
                            imported: imported,
                            fromModule: from,
                            importStatement: importStmt
                        };
                    }));
                }, []);
                var exports = scope.exportDecls.reduce(function (exports, node) {
                    var nodes = ast.query.nodesAtIndex(parsed, node.start);
                    var exportsStmt = arr.without(nodes, scope.node)[0];
                    if (!exportsStmt)
                        return exports;
                    if (exportsStmt.type === 'ExportAllDeclaration') {
                        var from = exportsStmt.source ? exportsStmt.source.value : null;
                        return exports.concat([{
                                localModule: id,
                                local: null,
                                exported: '*',
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
                return {
                    imports: arr.uniqBy(imports, function (a, b) {
                        return a.local == b.local && a.imported == b.imported && a.fromModule == b.fromModule;
                    }),
                    exports: arr.uniqBy(exports, function (a, b) {
                        return a.local == b.local && a.exported == b.exported && a.fromModule == b.fromModule;
                    })
                };
            });
        });
    }
    function scheduleModuleExportsChange(moduleId, name, value, addNewExport) {
        var rec = moduleRecordFor(moduleId);
        if (rec && (name in rec.exports || addNewExport)) {
            var pending = pendingExportChanges[moduleId] || (pendingExportChanges[moduleId] = {});
            pending[name] = value;
        }
    }
    function runScheduledExportChanges(moduleId) {
        var keysAndValues = pendingExportChanges[moduleId];
        if (!keysAndValues)
            return;
        clearPendingModuleExportChanges(moduleId);
        updateModuleExports(moduleId, keysAndValues);
    }
    function clearPendingModuleExportChanges(moduleId) {
        delete pendingExportChanges[moduleId];
    }
    function updateModuleExports(moduleId, keysAndValues) {
        updateModuleRecordOf(moduleId, function (record) {
            var newExports = [], existingExports = [];
            Object.keys(keysAndValues).forEach(function (name) {
                var value = keysAndValues[name];
                debug && console.log('[lively.vm es6 updateModuleExports] %s export %s = %s', relativeName(moduleId), name, String(value).slice(0, 30).replace(/\n/g, '') + '...');
                var isNewExport = !(name in record.exports);
                if (isNewExport)
                    record.__lively_vm__.evalOnlyExport[name] = true;
                record.exports[name] = value;
                if (isNewExport)
                    newExports.push(name);
                else
                    existingExports.push(name);
            });
            newExports.forEach(function (name) {
                var oldM = currentSystem()._loader.modules[moduleId].module, m = currentSystem()._loader.modules[moduleId].module = new oldM.constructor(), pNames = Object.getOwnPropertyNames(record.exports);
                for (var i = 0; i < pNames.length; i++)
                    (function (key) {
                        Object.defineProperty(m, key, {
                            configurable: false,
                            enumerable: true,
                            get: function get() {
                                return record.exports[key];
                            }
                        });
                    }(pNames[i]));
            });
            if (existingExports.length) {
                debug && console.log('[lively.vm es6 updateModuleExports] updating %s dependents of %s', record.importers.length, relativeName(moduleId));
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
    function prepareCodeForCustomCompile(source, fullname, env) {
        source = String(source);
        var tfmOptions = {
                topLevelVarRecorder: env.recorder,
                varRecorderName: env.recorderName,
                dontTransform: env.dontTransform,
                recordGlobals: true
            }, header = (debug ? 'console.log("[lively.vm es6] executing module ' + relativeName(fullname) + '");\n' : '') + ('var __lively_vm__ = System.__lively_vm__, ' + env.recorderName + ' = __lively_vm__.envFor("' + fullname + '").recorder;\n'), footer = '\n__lively_vm__.evaluationDone("' + fullname + '");';
        try {
            return header + evaluator.evalCodeTransform(source, tfmOptions) + footer;
        } catch (e) {
            console.error('Error in prepareCodeForCustomCompile', e.stack);
            return source;
        }
    }
    function getCachedNodejsModule(load) {
        try {
            var Module = __require('module').Module, id = Module._resolveFilename(load.name.replace(/^file:\/\//, '')), nodeModule = Module._cache[id];
            return nodeModule;
        } catch (e) {
            debug && console.log('[lively.vm es6 getCachedNodejsModule] %s unknown to nodejs', relativeName(load.name));
        }
        return null;
    }
    function addNodejsWrapperSource(load) {
        var m = getCachedNodejsModule(load);
        if (m) {
            load.source = 'export default System._nodeRequire(\'' + m.id + '\');\n';
            load.source += properties.allOwnPropertiesOrFunctions(m.exports).map(function (k) {
                return classHelper.isValidIdentifier(k) ? 'export var ' + k + ' = System._nodeRequire(\'' + m.id + '\')[\'' + k + '\'];' : '/*ignoring export "' + k + '" b/c it is not a valid identifier*/';
            }).join('\n');
            debug && console.log('[lively.vm es6 customTranslate] loading %s from nodejs module cache', relativeName(load.name));
            return true;
        }
        debug && console.log('[lively.vm es6 customTranslate] %s not yet in nodejs module cache', relativeName(load.name));
        return false;
    }
    function customTranslate(proceed, load) {
        if (exceptions.some(function (exc) {
                return exc(load.name);
            })) {
            debug && console.log('[lively.vm es6 customTranslate ignoring] %s', relativeName(load.name));
            return proceed(load);
        }
        if (currentSystem().get('@system-env').node && addNodejsWrapperSource(load)) {
            debug && console.log('[lively.vm es6] loaded %s from nodejs cache', relativeName(load.name));
            return proceed(load);
        }
        var start = Date.now();
        var isEsm = load.metadata.format == 'esm' || load.metadata.format == 'es6' || !load.metadata.format && esmFormatCommentRegExp.test(load.source.slice(0, 5000)) || !load.metadata.format && !cjsFormatCommentRegExp.test(load.source.slice(0, 5000)) && esmRegEx.test(load.source), isCjs = load.metadata.format == 'cjs', isGlobal = load.metadata.format == 'global';
        if (isEsm) {
            load.metadata.format = 'esm';
            load.source = prepareCodeForCustomCompile(load.source, load.name, envFor(load.name));
            load.metadata['lively.vm instrumented'] = true;
            debug && console.log('[lively.vm es6] loaded %s as es6 module', relativeName(load.name));
        } else if (isCjs && isNode) {
            load.metadata.format = 'cjs';
            var id = cjs.resolve(load.address.replace(/^file:\/\//, ''));
            load.source = cjs._prepareCodeForCustomCompile(load.source, id, cjs.envFor(id));
            load.metadata['lively.vm instrumented'] = true;
            debug && console.log('[lively.vm es6] loaded %s as instrumented cjs module', relativeName(load.name));
        } else if (isGlobal) {
            load.source = prepareCodeForCustomCompile(load.source, load.name, envFor(load.name));
            load.metadata['lively.vm instrumented'] = true;
        } else {
            debug && console.log('[lively.vm es6] customTranslate ignoring %s b/c don\'t know how to handle global format', relativeName(load.name));
        }
        debug && console.log('[lively.vm es6 customTranslate] done %s after %sms', relativeName(load.name), Date.now() - start);
        return proceed(load);
    }
    function wrapModuleLoad() {
        if (!currentSystem().origTranslate) {
            currentSystem().origTranslate = currentSystem().translate;
            currentSystem().translate = function (load) {
                return customTranslate(currentSystem().origTranslate.bind(currentSystem()), load);
            };
        }
    }
    function unwrapModuleLoad() {
        if (currentSystem().origTranslate) {
            currentSystem().translate = currentSystem().origTranslate;
            delete currentSystem().origTranslate;
        }
    }
    function ensureImportsAreLoaded(code, parentModule) {
        var body = ast.parse(code).body, imports = body.filter(function (node) {
                return node.type === 'ImportDeclaration';
            });
        return Promise.all(imports.map(function (node) {
            var fullName = resolve(node.source.value, parentModule);
            return moduleRecordFor(fullName) ? undefined : currentSystem()['import'](fullName);
        }))['catch'](function (err) {
            console.error('Error ensuring imports: ' + err.message);
            throw err;
        });
    }
    function runEval(code, options) {
        options = obj.merge({
            targetModule: null,
            parentModule: null,
            parentAddress: null
        }, options);
        return Promise.resolve().then(function () {
            if (!options.targetModule) {
                options.targetModule = '*scratch*';
            } else {
                options.targetModule = resolve(options.targetModule, options.parentModule || currentSystem().baseURL, options.parentAddress);
            }
            var fullname = options.targetModule;
            return importES6Module(fullname).then(function () {
                return ensureImportsAreLoaded(code, options.targetModule);
            }).then(function () {
                var env = envFor(fullname), rec = env.recorder, recName = env.recorderName, header = 'var ' + recName + ' = System.__lively_vm__.envFor("' + fullname + '").recorder,\n' + ('    _moduleExport = ' + recName + '._moduleExport,\n') + ('    _moduleImport = ' + recName + '._moduleImport;\n');
                options = obj.merge({ waitForPromise: true }, options, {
                    recordGlobals: true,
                    dontTransform: env.dontTransform,
                    varRecorderName: recName,
                    topLevelVarRecorder: rec,
                    sourceURL: options.sourceURL || options.targetModule,
                    context: rec,
                    es6ExportFuncId: '_moduleExport',
                    es6ImportFuncId: '_moduleImport',
                    header: header
                });
                clearPendingModuleExportChanges(fullname);
                return evaluator.runEval(code, options).then(function (result) {
                    currentSystem().__lively_vm__.evaluationDone(fullname);
                    return result;
                });
            });
        });
    }
    function sourceChange(moduleName, newSource, options) {
        var fullname = resolve(moduleName), load = {
                status: 'loading',
                source: newSource,
                name: fullname,
                linkSets: [],
                dependencies: [],
                metadata: { format: 'esm' }
            };
        return (currentSystem().get(fullname) ? Promise.resolve() : importES6Module(fullname)).then(function (_) {
            return _systemTranslateParsed(load);
        }).then(function (updateData) {
            var record = moduleRecordFor(fullname), _exports = function _exports(name, val) {
                    return scheduleModuleExportsChange(fullname, name, val);
                }, declared = updateData.declare(_exports);
            currentSystem().__lively_vm__.evaluationDone(fullname);
            debug && console.log('[lively.vm es6] sourceChange of %s with deps', fullname, updateData.localDeps);
            return Promise.all(updateData.localDeps.map(function (depName) {
                return currentSystem().normalize(depName, fullname).then(function (depFullname) {
                    var depModule = currentSystem().get(depFullname), record = moduleRecordFor(depFullname);
                    return depModule && record ? {
                        name: depName,
                        fullname: depFullname,
                        module: depModule,
                        record: record
                    } : importES6Module(depFullname).then(function (module) {
                        return {
                            name: depName,
                            fullname: depFullname,
                            module: currentSystem().get(depFullname) || module,
                            record: moduleRecordFor(depFullname)
                        };
                    });
                });
            })).then(function (deps) {
                record.dependencies = deps.map(function (ea) {
                    return ea.record;
                });
                var load = currentSystem().loads && currentSystem().loads[fullname];
                if (load) {
                    load.deps = deps.map(function (ea) {
                        return ea.name;
                    });
                    load.depMap = deps.reduce(function (map, dep) {
                        map[dep.name] = dep.fullname;
                        return map;
                    }, {});
                    if (load.metadata && load.metadata.entry) {
                        load.metadata.entry.deps = load.deps;
                        load.metadata.entry.normalizedDeps = deps.map(function (ea) {
                            return ea.fullname;
                        });
                        load.metadata.entry.declare = updateData.declare;
                    }
                }
                deps.forEach(function (d, i) {
                    return declared.setters[i](d.module);
                });
                return declared.execute();
            });
        });
    }
    function _systemTranslateParsed(load) {
        return currentSystem().translate(load).then(function (translated) {
            var parsed = ast.parse(translated), call = parsed.body[0].expression, moduleName = call.arguments[0].value, registerCall = call.callee.body.body[0].expression, depNames = arr.pluck(registerCall['arguments'][0].elements, 'value'), declareFuncNode = call.callee.body.body[0].expression['arguments'][1], declareFuncSource = translated.slice(declareFuncNode.start, declareFuncNode.end), declare = eval('var __moduleName = "' + moduleName + '";(' + declareFuncSource + ');\n//@ sourceURL=' + moduleName + '\n');
            if (typeof $morph !== 'undefined' && $morph('log'))
                $morph('log').textString = declare;
            return {
                localDeps: depNames,
                declare: declare
            };
        });
    }
    function modulesMatching(stringOrRegExp) {
        var re = stringOrRegExp instanceof RegExp ? stringOrRegExp : new RegExp(stringOrRegExp);
        return Object.keys(currentSystem()._loader.modules).filter(function (ea) {
            return stringOrRegExp.test(ea);
        });
    }
    function forgetEnvOf(fullname) {
        delete currentSystem().__lively_vm__.loadedModules[fullname];
    }
    function forgetModuleDeps(moduleName, opts) {
        opts = obj.merge({
            forgetDeps: true,
            forgetEnv: true
        }, opts);
        var id = resolve(moduleName), deps = findDependentsOf(id);
        deps.forEach(function (ea) {
            currentSystem()['delete'](ea);
            if (currentSystem().loads)
                delete currentSystem().loads[ea];
            opts.forgetEnv && forgetEnvOf(ea);
        });
        return id;
    }
    function forgetModule(moduleName, opts) {
        opts = obj.merge({
            forgetDeps: true,
            forgetEnv: true
        }, opts);
        var id = opts.forgetDeps ? forgetModuleDeps(moduleName, opts) : resolve(moduleName);
        currentSystem()['delete'](moduleName);
        currentSystem()['delete'](id);
        if (currentSystem().loads) {
            delete currentSystem().loads[moduleName];
            delete currentSystem().loads[id];
        }
        if (opts.forgetEnv) {
            forgetEnvOf(id);
            forgetEnvOf(moduleName);
        }
    }
    function reloadModule(moduleName, opts) {
        opts = obj.merge({
            reloadDeps: true,
            resetEnv: true
        }, opts);
        var id = resolve(moduleName), toBeReloaded = [id];
        if (opts.reloadDeps)
            toBeReloaded = findDependentsOf(id).concat(toBeReloaded);
        forgetModule(id, {
            forgetDeps: opts.reloadDeps,
            forgetEnv: opts.resetEnv
        });
        return Promise.all(toBeReloaded.map(function (ea) {
            return ea !== id && importES6Module(ea);
        })).then(function () {
            return importES6Module(id);
        });
    }
    function computeRequireMap() {
        if (currentSystem().loads) {
            var store = currentSystem().loads, modNames = arr.uniq(Object.keys(currentSystem().__lively_vm__.loadedModules).concat(Object.keys(store)));
            return modNames.reduce(function (requireMap, k) {
                var depMap = store[k] ? store[k].depMap : {};
                requireMap[k] = Object.keys(depMap).map(function (localName) {
                    var resolvedName = depMap[localName];
                    if (resolvedName === '@empty')
                        return resolvedName + '/' + localName;
                    return resolvedName;
                });
                return requireMap;
            }, {});
        }
        return Object.keys(currentSystem()._loader.moduleRecords).reduce(function (requireMap, k) {
            requireMap[k] = currentSystem()._loader.moduleRecords[k].dependencies.filter(Boolean).map(function (ea) {
                return ea.name;
            });
            return requireMap;
        }, {});
    }
    function findDependentsOf(id) {
        return graph.hull(graph.invert(computeRequireMap()), resolve(id));
    }
    function findRequirementsOf(id) {
        return graph.hull(computeRequireMap(), resolve(id));
    }
    function importPackage(packageLocation, options) {
        options = obj.deepMerge({
            modules: [],
            config: {}
        }, options);
        currentSystem().config({
            packages: _defineProperty({}, packageLocation, options.config),
            packageConfigPaths: [join(packageLocation, 'package.json')]
        });
        var mods = options.modules.map(function (ea) {
            return ea.indexOf(packageLocation) === 0 ? ea : join(packageLocation, ea);
        });
        return mods.length ? new Promise(function (resolve, reject) {
            var loadedModules = [];
            mods.reduce(function (nextLoad, modName) {
                return function () {
                    return importES6Module(modName).then(function (mod) {
                        return loadedModules.push(mod);
                    }).then(nextLoad);
                };
            }, function () {
                return resolve(loadedModules);
            })()['catch'](reject);
        }) : importES6Module(packageLocation);
    }
    function exportTrace(bundleName, outfile, matchNames, transformNames, builderConfig, bundleConfig) {
        var trace = Object.keys(currentSystem().loads).filter(matchNames).reduce(function (trace, name) {
            var load = currentSystem().loads[name];
            load.metadata && load.metadata && load.metadata.entry && delete load.metadata.entry;
            load.source = getOrigSource(name);
            if (load.name)
                load.name = transformNames(load.name);
            if (load.address)
                load.address = transformNames(load.address);
            load.depMap = Object.keys(load.depMap).reduce(function (depMap, name) {
                depMap[name] = transformNames(load.depMap[name]);
                return depMap;
            }, {});
            trace[name] = load;
            return trace;
        }, {});
        return _runBuilderInNodejs(bundleName, outfile, trace, builderConfig, bundleConfig);
        function getOrigSource(address) {
            return new URL(address).asWebResource().get().content;
        }
    }
    function _runBuilderInNodejs(bundleName, outfile, trace, builderConfig, bundleConfig) {
        var names = Object.keys(trace).map(function (name) {
            return trace[name].name;
        });
        if (!bundleConfig.bundles)
            bundleConfig.bundles = {};
        bundleConfig.bundles[bundleName] = names;
        var program = 'var trace = ' + JSON.stringify(trace, null, 2) + ';\n';
        program += 'var outputFile = \'' + outfile + '\';\n';
        program += 'var builderConfig = ' + JSON.stringify(builderConfig, null, 2) + ';\n';
        program += 'var bundleConfig = ' + JSON.stringify(bundleConfig, null, 2) + ';\n';
        program += 'var livelyVMDir = \'' + join(lively.shell.WORKSPACE_LK, 'node_modules/lively.vm/') + '\';\n';
        program += 'var path = require("path");\nvar Builder = require(livelyVMDir + \'node_modules/systemjs-builder\');\nvar builder = new Builder();\nbuilder.config(builderConfig);\n\n  // delete require.cache[require.resolve("/Users/robert/Lively/LivelyKernel2/traced.json")]\n  // var x = require("/Users/robert/Lively/LivelyKernel2/traced.json")\n\n  // Object.keys(x).forEach(name => {\n  //   x[name].source = String(fs.readFileSync(name.replace("http://localhost:9001/", "/Users/robert/Lively/LivelyKernel2/")))\n  // });\n\nbuilder.bundle(trace, outputFile)\n  .then(() => {\n    require("fs").appendFileSync(outputFile, \'\\nSystem.config(\' + JSON.stringify(bundleConfig, null, 2) + \');\\n\');\n    console.log("%s bundled", outputFile);\n  })\n  .catch(err => { console.error(err); process.exit(1); });\n';
        var programFile = join(lively.shell.WORKSPACE_LK, '.lively.modules-bundle-program.js');
        return writeProgram().then(function () {
            return runProgram();
        });
        function runProgram() {
            return new Promise(function (resolve, reject) {
                lively.shell.run('node ' + programFile, { cwd: lively.shell.WORKSPACE_LK }, function (err, cmd) {
                    return cmd.getCode() > 0 ? reject(new Error(cmd.resultString(true))) : resolve();
                });
            });
        }
        function writeProgram() {
            return new Promise(function (resolve, reject) {
                return lively.shell.writeFile(programFile, program, function (cmd) {
                    return cmd.getCode() > 0 ? reject(cmd.resultString(true)) : resolve();
                });
            });
        }
        function deleteProgram() {
            return new Promise(function (resolve, reject) {
                return lively.shell.rm(programFile, function (err) {
                    return err ? reject(err) : resolve();
                });
            });
        }
    }
    function groupIntoPackages(moduleNames, packageNames) {
        return arr.groupBy(moduleNames, groupFor);
        function groupFor(moduleName) {
            var fullname = resolve(moduleName), matching = packageNames.filter(function (p) {
                    return fullname.indexOf(p) === 0;
                });
            return matching.length ? matching.reduce(function (specific, ea) {
                return ea.length > specific.length ? ea : specific;
            }) : 'no group';
        }
    }
    return {
        setters: [
            function (_path) {
                path = _path['default'];
            },
            function (_livelyLang) {
                arr = _livelyLang.arr;
                obj = _livelyLang.obj;
                string = _livelyLang.string;
                graph = _livelyLang.graph;
                properties = _livelyLang.properties;
                classHelper = _livelyLang.classHelper;
            },
            function (_livelyAst) {
                ast = _livelyAst;
            },
            function (_evaluator) {
                evaluator = _evaluator;
            },
            function (_commonjsInterfaceJs) {
                cjs = _commonjsInterfaceJs;
            },
            function (_module2) {
                Module = _module2.Module;
            }
        ],
        execute: function () {
            __require = function __require(name, parent) {
                return Module._load(name, parent);
            };
            GLOBAL = typeof window !== 'undefined' ? window : typeof Global !== 'undefined' ? Global : global;
            SystemLoader = currentSystem().constructor;
            SystemLoader.prototype.__defineGetter__('__lively_vm__', function () {
                return {
                    envFor: envFor,
                    evaluationDone: function evaluationDone(moduleId) {
                        var env = envFor(moduleId);
                        addGetterSettersForNewVars(moduleId, env);
                        runScheduledExportChanges(moduleId);
                    },
                    dumpConfig: function dumpConfig() {
                        var System = currentSystem(), json = {
                                baseURL: System.baseURL,
                                transpiler: System.transpiler,
                                map: System.map,
                                meta: System.meta,
                                packages: System.packages,
                                paths: System.paths,
                                packageConfigPaths: System.packageConfigPaths
                            };
                        return JSON.stringify(json, null, 2);
                    },
                    loadedModules: this.__lively_vm__loadedModules || (this.__lively_vm__loadedModules = {})
                };
            });
            isNode = currentSystem().get('@system-env').node;
            debug = false;
            node_modulesDir = resolve('lively.vm/node_modules/');
            exceptions = [
                function (id) {
                    return canonicalURL(id).indexOf(node_modulesDir) > -1;
                },
                function (id) {
                    return string.include(id, 'babel-core/browser.js') || string.include(id, 'system.src.js');
                },
                function (id) {
                    return id.slice(-3) !== '.js';
                }
            ];
            pendingConfigs = [];
            configInitialized = false;
            esmFormatCommentRegExp = /['"]format (esm|es6)['"];/;
            cjsFormatCommentRegExp = /['"]format cjs['"];/;
            esmRegEx = /(^\s*|[}\);\n]\s*)(import\s+(['"]|(\*\s+as\s+)?[^"'\(\)\n;]+\s+from\s+['"]|\{)|export\s+\*\s+from\s+["']|export\s+(\{|default|function|class|var|const|let|async\s+function))/;
            pendingExportChanges = {};
            if (currentSystem().origTranslate) {
                unwrapModuleLoad();
                wrapModuleLoad();
            }
            _export('currentSystem', currentSystem);
            _export('_init', init);
            _export('config', config);
            _export('_moduleRecordFor', moduleRecordFor);
            _export('_updateModuleRecordOf', updateModuleRecordOf);
            _export('_updateModuleExports', updateModuleExports);
            _export('_computeRequireMap', computeRequireMap);
            _export('getExceptions', getExceptions);
            _export('setExceptions', setExceptions);
            _export('sourceOf', sourceOf);
            _export('envFor', envFor);
            _export('importsAndExportsOf', importsAndExportsOf);
            _export('runEval', runEval);
            _export('sourceChange', sourceChange);
            _export('resolve', resolve);
            _export('modulesMatching', modulesMatching);
            _export('import', importES6Module);
            _export('reloadModule', reloadModule);
            _export('forgetModule', forgetModule);
            _export('forgetModuleDeps', forgetModuleDeps);
            _export('findRequirementsOf', findRequirementsOf);
            _export('findDependentsOf', findDependentsOf);
            _export('groupIntoPackages', groupIntoPackages);
            _export('wrapModuleLoad', wrapModuleLoad);
            _export('unwrapModuleLoad', unwrapModuleLoad);
        }
    };
})
System.register('lively.vm/lib/evaluator.js', [
    'lively.lang',
    'lively.ast'
], function (_export) {
    'use strict';
    var lang, ast;
    function _normalizeEvalOptions(opts) {
        if (!opts)
            opts = {};
        opts = lang.obj.merge({
            targetModule: null,
            sourceURL: opts.targetModule,
            runtime: null,
            context: getGlobal(),
            varRecorderName: '__lvVarRecorder',
            dontTransform: [],
            topLevelDefRangeRecorder: null,
            recordGlobals: null,
            returnPromise: true,
            promiseTimeout: 200,
            waitForPromise: true
        }, opts);
        if (opts.targetModule) {
            var moduleEnv = opts.runtime && opts.runtime.modules && opts.runtime.modules[opts.targetModule];
            if (moduleEnv)
                opts = lang.obj.merge(opts, moduleEnv);
        }
        return opts;
    }
    function _eval(__lvEvalStatement, __lvVarRecorder) {
        return eval(__lvEvalStatement);
    }
    function tryToWaitForPromise(evalResult, timeoutMs) {
        console.assert(evalResult.isPromise, 'no promise in tryToWaitForPromise???');
        var timeout = {}, timeoutP = new Promise(function (resolve) {
                return setTimeout(resolve, timeoutMs, timeout);
            });
        return Promise.race([
            timeoutP,
            evalResult.value
        ]).then(function (resolved) {
            return lang.obj.extend(evalResult, resolved !== timeout ? {
                promiseStatus: 'fulfilled',
                promisedValue: resolved
            } : { promiseStatus: 'pending' });
        })['catch'](function (rejected) {
            return lang.obj.extend(evalResult, {
                promiseStatus: 'rejected',
                promisedValue: rejected
            });
        });
    }
    function EvalResult() {
    }
    function print(value, options) {
        if (options.isError || value instanceof Error)
            return value.stack || String(value);
        if (options.isPromise) {
            var status = lang.string.print(options.promiseStatus), value = options.promiseStatus === 'pending' ? undefined : print(options.promisedValue, lang.obj.merge(options, { isPromise: false }));
            return 'Promise({status: ' + status + ', ' + (value === undefined ? '' : 'value: ' + value) + '})';
        }
        if (value instanceof Promise)
            return 'Promise({status: "unknown"})';
        if (options.inspect) {
            var printDepth = options.printDepth || 2;
            return lang.obj.inspect(value, { maxDepth: printDepth });
        }
        return String(value);
    }
    function transformForVarRecord(code, varRecorder, varRecorderName, blacklist, defRangeRecorder, recordGlobals, es6ExportFuncId, es6ImportFuncId) {
        blacklist = blacklist || [];
        blacklist.push('arguments');
        var undeclaredToTransform = recordGlobals ? null : lang.arr.withoutAll(Object.keys(varRecorder), blacklist), transformed = ast.capturing.rewriteToCaptureTopLevelVariables(code, {
                name: varRecorderName,
                type: 'Identifier'
            }, {
                es6ImportFuncId: es6ImportFuncId,
                es6ExportFuncId: es6ExportFuncId,
                ignoreUndeclaredExcept: undeclaredToTransform,
                exclude: blacklist,
                recordDefRanges: !!defRangeRecorder
            });
        code = transformed.source;
        if (defRangeRecorder)
            lang.obj.extend(defRangeRecorder, transformed.defRanges);
        return code;
    }
    function transformSingleExpression(code) {
        try {
            var parsed = ast.fuzzyParse(code);
            if (parsed.body.length === 1 && (parsed.body[0].type === 'FunctionDeclaration' || parsed.body[0].type === 'BlockStatement' && parsed.body[0].body[0].type === 'LabeledStatement')) {
                code = '(' + code.replace(/;\s*$/, '') + ')';
            }
        } catch (e) {
            if (typeof lively && lively.Config && lively.Config.showImprovedJavaScriptEvalErrors)
                $world.logError(e);
            else
                console.error('Eval preprocess error: %s', e.stack || e);
        }
        return code;
    }
    function evalCodeTransform(code, options) {
        if (options.topLevelVarRecorder)
            code = transformForVarRecord(code, options.topLevelVarRecorder, options.varRecorderName || '__lvVarRecorder', options.dontTransform, options.topLevelDefRangeRecorder, !!options.recordGlobals, options.es6ExportFuncId, options.es6ImportFuncId);
        code = transformSingleExpression(code);
        if (options.sourceURL)
            code += '\n//# sourceURL=' + options.sourceURL.replace(/\s/g, '_');
        return code;
    }
    function getGlobal() {
        if (typeof window !== 'undefined')
            return window;
        if (typeof global !== 'undefined')
            return global;
        if (typeof Global !== 'undefined')
            return Global;
        return function () {
            return this;
        }();
    }
    function runEval(code, options, thenDo) {
        if (typeof options === 'function' && arguments.length === 2) {
            thenDo = options;
            options = null;
        }
        options = _normalizeEvalOptions(options);
        var warnings = [];
        try {
            code = evalCodeTransform(code, options);
            if (options.header)
                code = options.header + code;
            if (options.footer)
                code = code + options.footer;
        } catch (e) {
            var warning = 'lively.vm evalCodeTransform not working: ' + (e.stack || e);
            console.warn(warning);
            warnings.push(warning);
        }
        var result = new EvalResult();
        try {
            typeof $morph !== 'undefined' && $morph('log') && ($morph('log').textString = code);
            result.value = _eval.call(options.context, code, options.topLevelVarRecorder);
            if (result.value instanceof Promise)
                result.isPromise = true;
        } catch (e) {
            result.isError = true;
            result.value = e;
        }
        if (options.sync)
            return result.processSync(options);
        else {
            return typeof thenDo === 'function' ? new Promise(function (resolve, reject) {
                return result.process(options).then(function () {
                    thenDo(null, result);
                    resolve(result);
                })['catch'](function (err) {
                    thenDo(err);
                    reject(err);
                });
            }) : result.process(options);
        }
    }
    function syncEval(string, options) {
        options = lang.obj.merge(options, { sync: true });
        return runEval(string, options);
    }
    return {
        setters: [
            function (_livelyLang) {
                lang = _livelyLang;
            },
            function (_livelyAst) {
                ast = _livelyAst;
            }
        ],
        execute: function () {
            EvalResult.prototype.isEvalResult = true;
            EvalResult.prototype.value = undefined;
            EvalResult.prototype.warnings = [];
            EvalResult.prototype.isError = false;
            EvalResult.prototype.isPromise = false;
            EvalResult.prototype.promisedValue = undefined;
            EvalResult.prototype.promiseStatus = 'unknown';
            EvalResult.prototype.printed = function (options) {
                this.value = print(this.value, lang.obj.merge(options, {
                    isError: this.isError,
                    isPromise: this.isPromise,
                    promisedValue: this.promisedValue,
                    promiseStatus: this.promiseStatus
                }));
            };
            EvalResult.prototype.processSync = function (options) {
                if (options.inspect || options.asString)
                    this.value = this.print(this.value, options);
                return this;
            };
            EvalResult.prototype.process = function (options) {
                var result = this;
                if (result.isPromise && options.waitForPromise) {
                    return tryToWaitForPromise(result, options.promiseTimeout).then(function () {
                        if (options.inspect || options.asString)
                            result.printed(options);
                        return result;
                    });
                }
                if (options.inspect || options.asString)
                    result.printed(options);
                return Promise.resolve(result);
            };
            _export('transformForVarRecord', transformForVarRecord);
            _export('transformSingleExpression', transformSingleExpression);
            _export('evalCodeTransform', evalCodeTransform);
            _export('getGlobal', getGlobal);
            _export('runEval', runEval);
            _export('syncEval', syncEval);
        }
    };
})