System.registerDynamic('lively.modules/package.json', [], false, function(require, exports, module) {
return {
  "name": "lively.modules",
  "version": "0.1.0",
  "scripts": {
    "test": "mocha-es6 tests/*-test.js"
  },
  "systemjs": {
    "main": "./index.js",
    "map": {
      "lively.modules": ".",
      "fetch": {
        "node": "@empty",
        "~node": "https://cdnjs.cloudflare.com/ajax/libs/fetch/0.11.0/fetch.js"
      },
      "fs": {
        "node": "@node/fs",
        "~node": "@empty"
      },
      "URI": "./lib/URI.js"
    }
  },
  "lively": {
    "packageMap": {
      "lively.lang": "./node_modules/lively.lang",
      "lively.ast": "./node_modules/lively.ast",
      "lively.vm": "./node_modules/lively.vm"
    },
    "meta": {
      "https://cdnjs.cloudflare.com/ajax/libs/fetch/0.11.0/fetch.js": {
        "format": "global",
        "exports": "fetch"
      }
    }
  },
  "dependencies": {
    "babel-core": "^5.8.38",
    "lively.ast": "^0.5.4",
    "lively.lang": "^0.5.20",
    "lively.vm": "^0.4.9",
    "systemjs": "^0.19.24"
  },
  "devDependencies": {
    "mocha-es6": "^0.1.6"
  }
}
});

System.register('lively.modules/index.js', [
    'lively.lang',
    './src/system.js',
    './src/packages.js',
    './src/change.js',
    './src/dependencies.js',
    './src/import-export.js',
    './src/hooks.js',
    './src/instrumentation.js',
    './src/eval.js'
], function (_export) {
    'use strict';
    var obj, arr, getSystem, removeSystem, _moduleEnv, _moduleRecordFor, _sourceOf, _printSystemConfig, _registerPackage, _groupIntoPackages, _moduleSourceChange, _findDependentsOf, _findRequirementsOf, _forgetModule, _reloadModule, computeRequireMap, _importsAndExportsOf, _isHookInstalled, _installHook, _removeHook, _wrapModuleLoad, _unwrapModuleLoad, _runEval, GLOBAL, defaultSystem;
    function changeSystem(newSystem, makeGlobal) {
        _export('System', defaultSystem = newSystem);
        if (makeGlobal)
            GLOBAL.System = newSystem;
    }
    function sourceOf(id) {
        return _sourceOf(defaultSystem, id);
    }
    function moduleEnv(id) {
        return _moduleEnv(defaultSystem, id);
    }
    function moduleRecordFor(id) {
        return _moduleRecordFor(defaultSystem, id);
    }
    function printSystemConfig() {
        return _printSystemConfig(defaultSystem);
    }
    function registerPackage(packageURL) {
        return _registerPackage(defaultSystem, packageURL);
    }
    function groupIntoPackages(moduleNames, packageNames) {
        return _groupIntoPackages(defaultSystem, moduleNames, packageNames);
    }
    function moduleSourceChange(moduleName, newSource, options) {
        return _moduleSourceChange(defaultSystem, moduleName, newSource, options);
    }
    function findDependentsOf(module) {
        return _findDependentsOf(defaultSystem, module);
    }
    function findRequirementsOf(module) {
        return _findRequirementsOf(defaultSystem, module);
    }
    function forgetModule(module, opts) {
        return _forgetModule(defaultSystem, module, opts);
    }
    function reloadModule(module, opts) {
        return _reloadModule(defaultSystem, module, opts);
    }
    function requireMap() {
        return computeRequireMap(defaultSystem);
    }
    function importsAndExportsOf(System, moduleName, parent) {
        return _importsAndExportsOf(defaultSystem, moduleName, parent);
    }
    function isHookInstalled(methodName, hookOrName) {
        return _isHookInstalled(defaultSystem, methodName, hookOrName);
    }
    function installHook(hookName, hook) {
        return _installHook(defaultSystem, hookName, hook);
    }
    function removeHook(methodName, hookOrName) {
        return _removeHook(defaultSystem, methodName, hookOrName);
    }
    function wrapModuleLoad() {
        _wrapModuleLoad(defaultSystem);
    }
    function unwrapModuleLoad() {
        _unwrapModuleLoad(defaultSystem);
    }
    function runEval(code, options) {
        return _runEval(defaultSystem, code, options);
    }
    return {
        setters: [
            function (_livelyLang) {
                obj = _livelyLang.obj;
                arr = _livelyLang.arr;
            },
            function (_srcSystemJs) {
                getSystem = _srcSystemJs.getSystem;
                removeSystem = _srcSystemJs.removeSystem;
                _moduleEnv = _srcSystemJs.moduleEnv;
                _moduleRecordFor = _srcSystemJs.moduleRecordFor;
                _sourceOf = _srcSystemJs.sourceOf;
                _printSystemConfig = _srcSystemJs.printSystemConfig;
            },
            function (_srcPackagesJs) {
                _registerPackage = _srcPackagesJs.registerPackage;
                _groupIntoPackages = _srcPackagesJs.groupIntoPackages;
            },
            function (_srcChangeJs) {
                _moduleSourceChange = _srcChangeJs.moduleSourceChange;
            },
            function (_srcDependenciesJs) {
                _findDependentsOf = _srcDependenciesJs.findDependentsOf;
                _findRequirementsOf = _srcDependenciesJs.findRequirementsOf;
                _forgetModule = _srcDependenciesJs.forgetModule;
                _reloadModule = _srcDependenciesJs.reloadModule;
                computeRequireMap = _srcDependenciesJs.computeRequireMap;
            },
            function (_srcImportExportJs) {
                _importsAndExportsOf = _srcImportExportJs.importsAndExportsOf;
            },
            function (_srcHooksJs) {
                _isHookInstalled = _srcHooksJs.isInstalled;
                _installHook = _srcHooksJs.install;
                _removeHook = _srcHooksJs.remove;
            },
            function (_srcInstrumentationJs) {
                _wrapModuleLoad = _srcInstrumentationJs.wrapModuleLoad;
                _unwrapModuleLoad = _srcInstrumentationJs.unwrapModuleLoad;
            },
            function (_srcEvalJs) {
                _runEval = _srcEvalJs.runEval;
            }
        ],
        execute: function () {
            GLOBAL = typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : undefined;
            defaultSystem = defaultSystem || getSystem('default');
            _export('System', defaultSystem);
            _export('getSystem', getSystem);
            _export('removeSystem', removeSystem);
            _export('printSystemConfig', printSystemConfig);
            _export('changeSystem', changeSystem);
            _export('sourceOf', sourceOf);
            _export('moduleEnv', moduleEnv);
            _export('moduleRecordFor', moduleRecordFor);
            _export('registerPackage', registerPackage);
            _export('groupIntoPackages', groupIntoPackages);
            _export('moduleSourceChange', moduleSourceChange);
            _export('findDependentsOf', findDependentsOf);
            _export('findRequirementsOf', findRequirementsOf);
            _export('forgetModule', forgetModule);
            _export('reloadModule', reloadModule);
            _export('requireMap', requireMap);
            _export('importsAndExportsOf', importsAndExportsOf);
            _export('isHookInstalled', isHookInstalled);
            _export('installHook', installHook);
            _export('removeHook', removeHook);
            _export('runEval', runEval);
        }
    };
})
System.register('lively.modules/src/system.js', [
    'lively.ast',
    'lively.lang',
    './import-export.js',
    './hooks.js',
    './instrumentation.js'
], function (_export) {
    'use strict';
    var ast, obj, properties, scheduleModuleExportsChange, runScheduledExportChanges, installHook, isHookInstalled, wrapModuleLoad, GLOBAL, isNode, SystemClass;
    function systems() {
        return SystemClass.systems;
    }
    function nameOfSystem(System) {
        return Object.keys(systems()).detect(function (name) {
            return systems()[name] === System;
        });
    }
    function getSystem(nameOrSystem, config) {
        return nameOrSystem && typeof nameOrSystem !== 'string' ? nameOrSystem : systems()[nameOrSystem] || (systems()[nameOrSystem] = makeSystem(config));
    }
    function removeSystem(nameOrSystem) {
        var name = nameOrSystem && typeof nameOrSystem !== 'string' ? nameOfSystem(nameOrSystem) : nameOrSystem;
        delete systems()[name];
    }
    function makeSystem(cfg) {
        var System = new SystemClass();
        System.trace = true;
        wrapModuleLoad(System);
        if (!isHookInstalled(System, 'normalizeHook'))
            installHook(System, 'normalize', normalizeHook);
        if (!isHookInstalled(System, 'normalizeSync', 'normalizeSyncHook'))
            installHook(System, 'normalizeSync', normalizeSyncHook);
        cfg = obj.merge({
            transpiler: 'babel',
            babelOptions: {}
        }, cfg);
        if (isNode) {
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
        }
        cfg.packageConfigPaths = cfg.packageConfigPaths || ['./node_modules/*/package.json'];
        if (!cfg.baseURL)
            cfg.baseURL = '/';
        System.config(cfg);
        return System;
    }
    function normalizeHook(proceed, name, parent, parentAddress) {
        var System = this;
        if (name === '..')
            name = '../index.js';
        return proceed(name, parent, parentAddress).then(function (result) {
            var base = result.replace(/\.js$/, '');
            if (base in System.packages) {
                var main = System.packages[base].main;
                if (main)
                    return base.replace(/\/$/, '') + '/' + main.replace(/^\.?\//, '');
            }
            var m = result.match(/(.*json)\.js/i);
            if (m)
                return m[1];
            return result;
        });
    }
    function normalizeSyncHook(proceed, name, parent, isPlugin) {
        var System = this;
        if (name === '..')
            name = '../index.js';
        var pkg = parent && normalize_packageOfURL(parent, System);
        if (pkg) {
            var mappedObject = pkg.map[name] || System.map[name];
            if (typeof mappedObject === 'object') {
                name = normalize_doMapWithObject(mappedObject, pkg, System) || name;
            }
        }
        var result = proceed(name, parent, isPlugin);
        var base = result.replace(/\.js$/, '');
        if (base in System.packages) {
            var main = System.packages[base].main;
            if (main)
                return base.replace(/\/$/, '') + '/' + main.replace(/^\.?\//, '');
        }
        var m = result.match(/(.*json)\.js/i);
        if (m)
            return m[1];
        return result;
    }
    function normalize_doMapWithObject(mappedObject, pkg, loader) {
        var env = loader.get(pkg.map['@env'] || '@system-env');
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
            if (typeof resolved != 'string')
                throw new Error('Unable to map a package conditional to a package conditional.');
        }
        return resolved;
        function normalize_readMemberExpression(p, value) {
            var pParts = p.split('.');
            while (pParts.length)
                value = value[pParts.shift()];
            return value;
        }
    }
    function normalize_packageOfURL(url, System) {
        var packageNames = Object.keys(System.packages || {}), matchingPackages = packageNames.map(function (pkgName) {
                return url.indexOf(pkgName) === 0 ? {
                    url: pkgName,
                    penalty: url.slice(pkgName.length).length
                } : null;
            }).filter(function (ea) {
                return !!ea;
            }), pName = matchingPackages.length ? matchingPackages.reduce(function (matchingPkg, ea) {
                return matchingPkg.penalty > ea.penalty ? ea : matchingPkg;
            }).url : null;
        return pName ? System.packages[pName] : null;
    }
    function printSystemConfig(System) {
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
    function loadedModules(System) {
        return System['__lively.modules__'].loadedModules;
    }
    function _moduleEnv(System, moduleId) {
        var ext = System['__lively.modules__'];
        if (ext.loadedModules[moduleId])
            return ext.loadedModules[moduleId];
        var env = {
            loadError: undefined,
            recorderName: '__lvVarRecorder',
            dontTransform: [
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
                            return scheduleModuleExportsChange(System, moduleId, name, val, true);
                        };
                    }
                },
                _moduleImport: {
                    get: function get() {
                        return function (imported, name) {
                            var id = System.normalizeSync(imported, moduleId), imported = System._loader.modules[id];
                            if (!imported)
                                throw new Error('import of ' + name + ' failed: ' + imported + ' (tried as ' + id + ') is not loaded!');
                            if (name == undefined)
                                return imported.module;
                            if (!imported.module.hasOwnProperty(name))
                                console.warn('import from ' + imported + ': Has no export ' + name + '!');
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
        var rec = _moduleEnv(System, moduleId).recorder, prefix = '__lively.modules__';
        properties.own(rec).forEach(function (key) {
            if (key.indexOf(prefix) === 0 || rec.__lookupGetter__(key))
                return;
            rec[prefix + key] = rec[key];
            rec.__defineGetter__(key, function () {
                return rec[prefix + key];
            });
            rec.__defineSetter__(key, function (v) {
                scheduleModuleExportsChange(System, moduleId, key, v, false);
                return rec[prefix + key] = v;
            });
        });
    }
    function sourceOf(System, moduleName, parent) {
        return System.normalize(moduleName, parent).then(function (id) {
            var load = System.loads && System.loads[id] || {
                status: 'loading',
                address: id,
                name: id,
                linkSets: [],
                dependencies: [],
                metadata: {}
            };
            return System.fetch(load);
        });
    }
    function moduleRecordFor(System, fullname) {
        var record = System._loader.moduleRecords[fullname];
        if (!record)
            return null;
        if (!record.hasOwnProperty('__lively_modules__'))
            record.__lively_modules__ = { evalOnlyExport: {} };
        return record;
    }
    function updateModuleRecordOf(System, fullname, doFunc) {
        var record = moduleRecordFor(System, fullname);
        if (!record)
            throw new Error('es6 environment global of ' + fullname + ': module not loaded, cannot get export object!');
        record.locked = true;
        try {
            return doFunc(record);
        } finally {
            record.locked = false;
        }
    }
    return {
        setters: [
            function (_livelyAst) {
                ast = _livelyAst;
            },
            function (_livelyLang) {
                obj = _livelyLang.obj;
                properties = _livelyLang.properties;
            },
            function (_importExportJs) {
                scheduleModuleExportsChange = _importExportJs.scheduleModuleExportsChange;
                runScheduledExportChanges = _importExportJs.runScheduledExportChanges;
            },
            function (_hooksJs) {
                installHook = _hooksJs.install;
                isHookInstalled = _hooksJs.isInstalled;
            },
            function (_instrumentationJs) {
                wrapModuleLoad = _instrumentationJs.wrapModuleLoad;
            }
        ],
        execute: function () {
            GLOBAL = typeof window !== 'undefined' ? window : typeof Global !== 'undefined' ? Global : global;
            isNode = System.get('@system-env').node;
            SystemClass = System.constructor;
            if (!SystemClass.systems)
                SystemClass.systems = {};
            SystemClass.prototype.__defineGetter__('__lively.modules__', function () {
                var System = this;
                return Object.defineProperties({
                    moduleEnv: function moduleEnv(id) {
                        return _moduleEnv(System, id);
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
                    loadedModules: System['__lively.modules__loadedModules'] || (System['__lively.modules__loadedModules'] = {}),
                    pendingExportChanges: System['__lively.modules__pendingExportChanges'] || (System['__lively.modules__pendingExportChanges'] = {})
                }, {
                    itself: {
                        get: function get() {
                            return System.get(System.normalizeSync('lively.modules/index.js'));
                        },
                        configurable: true,
                        enumerable: true
                    }
                });
            });
            _export('getSystem', getSystem);
            _export('removeSystem', removeSystem);
            _export('printSystemConfig', printSystemConfig);
            _export('moduleRecordFor', moduleRecordFor);
            _export('updateModuleRecordOf', updateModuleRecordOf);
            _export('loadedModules', loadedModules);
            _export('moduleEnv', _moduleEnv);
            _export('sourceOf', sourceOf);
        }
    };
})
System.register('lively.modules/src/packages.js', [
    'lively.lang',
    './hooks.js'
], function (_export) {
    'use strict';
    var arr, string, installHook, isHookInstalled, join;
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
    function isJsFile(url) {
        return /\.js/i.test(url);
    }
    function asDir(url) {
        return isJsFile(url) ? url.replace(/\/[^\/]*$/, '') : url.replace(/\/$/, '');
    }
    function isURL(string) {
        return /^[^:\\]+:\/\//.test(string);
    }
    function urlResolve(url) {
        var urlMatch = url.match(/^([^:]+:\/\/)(.*)/);
        if (!urlMatch)
            return url;
        var protocol = urlMatch[1], path = urlMatch[2], result = path;
        do {
            path = result;
            result = path.replace(/\/[^\/]+\/\.\./, '');
        } while (result != path);
        result = result.replace(/(^|[^:])[\/]+/g, '$1/');
        result = result.replace(/\/\.\//g, '/');
        return protocol + result;
    }
    function normalizeInsidePackage(System, urlOrName, packageURL) {
        return isURL(urlOrName) ? urlOrName : urlResolve(join(urlOrName[0] === '.' ? packageURL : System.baseURL, urlOrName));
    }
    function registerPackage(System, packageURL) {
        if (!isURL(packageURL)) {
            return Promise.reject(new Error('Error registering package: ' + packageURL + ' is not a valid URL'));
        }
        packageURL = String(packageURL).replace(/\/$/, '');
        System.debug && console.log('[lively.modules package register] %s', packageURL);
        var packageInSystem = System.packages[packageURL] || (System.packages[packageURL] = {});
        return tryToLoadPackageConfig(System, packageURL).then(function (cfg) {
            return Promise.resolve(applyConfig(System, cfg, packageURL)).then(function (packageConfigResult) {
                return Promise.all(packageConfigResult.subPackages.map(function (subp) {
                    return registerPackage(System, subp.address);
                }));
            }).then(function () {
                return cfg.name;
            });
        });
    }
    function tryToLoadPackageConfig(System, packageURL) {
        var packageConfigURL = packageURL + '/package.json';
        System.config({
            meta: _defineProperty({}, packageConfigURL, { format: 'json' }),
            packages: _defineProperty({}, packageURL, { meta: { 'package.json': { format: 'json' } } })
        });
        System.debug && console.log('[lively.modules package reading config] %s', packageConfigURL);
        return Promise.resolve(System.get(packageConfigURL) || System['import'](packageConfigURL)).then(function (config) {
            arr.pushIfNotIncluded(System.packageConfigPaths, packageConfigURL);
            return config;
        })['catch'](function (err) {
            console.log('[lively.modules package] Unable loading package config %s for package: ', packageConfigURL, err);
            delete System.meta[packageConfigURL];
            var name = packageURL.split('/').slice(-1)[0];
            return { name: name };
        });
    }
    function applyConfig(System, packageConfig, packageURL) {
        var name = packageConfig.name || packageURL.split('/').slice(-1)[0], packageInSystem = System.packages[packageURL] || (System.packages[packageURL] = {}), sysConfig = packageConfig.systemjs, livelyConfig = packageConfig.lively, main = packageConfig.main || 'index.js';
        System.config({ map: _defineProperty({}, name, packageURL) });
        if (!packageInSystem.map)
            packageInSystem.map = {};
        if (sysConfig) {
            if (sysConfig.packageConfigPaths)
                System.packageConfigPaths = arr.uniq(System.packageConfigPaths.concat(sysConfig.packageConfigPaths));
            if (sysConfig.main)
                main = sysConfig.main;
            applySystemJSConfig(System, packageConfig, packageURL);
        }
        var packageApplyResult = livelyConfig ? applyLivelyConfig(System, livelyConfig, packageURL) : { subPackages: [] };
        packageInSystem.names = packageInSystem.names || [];
        arr.pushIfNotIncluded(packageInSystem.names, name);
        if (!main.match(/\.[^\/\.]+/))
            main += '.js';
        packageInSystem.main = main;
        return packageApplyResult;
    }
    function applySystemJSConfig(System, systemjsConfig, packageURL) {
    }
    function applyLivelyConfig(System, livelyConfig, packageURL) {
        applyLivelyConfigMeta(System, livelyConfig, packageURL);
        applyLivelyConfigHooks(System, livelyConfig, packageURL);
        applyLivelyConfigBundles(System, livelyConfig, packageURL);
        return applyLivelyConfigPackageMap(System, livelyConfig, packageURL);
    }
    function applyLivelyConfigHooks(System, livelyConfig, packageURL) {
        (livelyConfig.hooks || []).forEach(function (h) {
            try {
                var f = eval('(' + h.source + ')');
                if (!f.name || !isHookInstalled(System, h.target, f.name))
                    installHook(System, h.target, f);
            } catch (e) {
                console.error('Error installing hook for %s: %s', packageURL, e, h);
            }
        });
    }
    function applyLivelyConfigBundles(System, livelyConfig, packageURL) {
        if (!livelyConfig.bundles)
            return Promise.resolve();
        var normalized = Object.keys(livelyConfig.bundles).reduce(function (bundles, name) {
            var absName = packageURL.replace(/\/$/, '') + '/' + name;
            var files = livelyConfig.bundles[name].map(function (f) {
                return System.normalizeSync(f, packageURL + '/');
            });
            bundles[absName] = files;
            return bundles;
        }, {});
        System.config({ bundles: normalized });
        return Promise.resolve();
    }
    function applyLivelyConfigMeta(System, livelyConfig, packageURL) {
        if (!livelyConfig.meta)
            return;
        var pConf = System.packages[packageURL];
        Object.keys(livelyConfig.meta).forEach(function (key) {
            var val = livelyConfig.meta[key];
            if (isURL(key)) {
                System.meta[key] = val;
            } else {
                if (!pConf.meta)
                    pConf.meta = {};
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
        var pConf = System.packages[packageURL], preferLoadedPackages = livelyConfig.hasOwnProperty('preferLoadedPackages') ? livelyConfig.preferLoadedPackages : true;
        var normalized = System.normalizeSync(subPackageName, packageURL + '/');
        if (preferLoadedPackages && (pConf.map[subPackageName] || System.map[subPackageName] || System.get(normalized))) {
            var subpackageURL;
            if (pConf.map[subPackageName])
                subpackageURL = normalizeInsidePackage(System, pConf.map[subPackageName], packageURL);
            else if (System.map[subPackageName])
                subpackageURL = normalizeInsidePackage(System, System.map[subPackageName], packageURL);
            else
                subpackageURL = normalized;
            System.debug && console.log('[lively.module package] Package %s required by %s already in system as %s', subPackageName, packageURL, subpackageURL);
            return {
                name: subPackageName,
                address: subpackageURL
            };
        }
        pConf.map[subPackageName] = livelyConfig.packageMap[subPackageName];
        var subpackageURL = normalizeInsidePackage(System, livelyConfig.packageMap[subPackageName], packageURL);
        System.debug && console.log('[lively.module package] Package %s required by %s NOT in system, will be loaded as %s', subPackageName, packageURL, subpackageURL);
        return {
            name: subPackageName,
            address: subpackageURL
        };
    }
    function knownPackages(System) {
        return Object.keys(System.packages).reduce(function (nameMap, packageURL) {
            var pkg = System.packages[packageURL];
            if (pkg.names)
                pkg.names.forEach(function (name) {
                    return nameMap[name] = packageURL;
                });
            return nameMap;
        }, {});
    }
    function groupIntoPackages(System, moduleNames, packageNames) {
        return arr.groupBy(moduleNames, groupFor);
        function groupFor(moduleName) {
            var fullname = System.normalizeSync(moduleName), matching = packageNames.filter(function (p) {
                    return fullname.indexOf(p) === 0;
                });
            return matching.length ? matching.reduce(function (specific, ea) {
                return ea.length > specific.length ? ea : specific;
            }) : 'no group';
        }
    }
    return {
        setters: [
            function (_livelyLang) {
                arr = _livelyLang.arr;
                string = _livelyLang.string;
            },
            function (_hooksJs) {
                installHook = _hooksJs.install;
                isHookInstalled = _hooksJs.isInstalled;
            }
        ],
        execute: function () {
            _export('registerPackage', registerPackage);
            _export('applyConfig', applyConfig);
            _export('knownPackages', knownPackages);
            _export('groupIntoPackages', groupIntoPackages);
            join = string.joinPath;
        }
    };
})
System.register('lively.modules/src/change.js', [
    './system.js',
    './instrumentation.js',
    './import-export.js'
], function (_export) {
    'use strict';
    var moduleRecordFor, instrumentSourceOfModuleLoad, scheduleModuleExportsChange;
    function moduleSourceChange(System, moduleName, newSource, options) {
        var debug = System['__lively.modules__'].debug, load = {
                status: 'loading',
                source: newSource,
                name: null,
                linkSets: [],
                dependencies: [],
                metadata: { format: 'esm' }
            };
        return System.normalize(moduleName).then(function (moduleId) {
            load.name = moduleId;
            return System.get(moduleId) ? Promise.resolve() : System['import'](moduleId);
        }).then(function (_) {
            return instrumentSourceOfModuleLoad(System, load);
        }).then(function (updateData) {
            var record = moduleRecordFor(System, load.name), _exports = function _exports(name, val) {
                    return scheduleModuleExportsChange(System, load.name, name, val);
                }, declared = updateData.declare(_exports);
            System.__lively_vm__.evaluationDone(load.name);
            debug && console.log('[lively.vm es6] sourceChange of %s with deps', load.name, updateData.localDeps);
            return Promise.all(updateData.localDeps.map(function (depName) {
                return System.normalize(depName, load.name).then(function (depFullname) {
                    var depModule = System.get(depFullname), record = moduleRecordFor(System, depFullname);
                    return depModule && record ? {
                        name: depName,
                        fullname: depFullname,
                        module: depModule,
                        record: record
                    } : System['import'](depFullname).then(function (module) {
                        return {
                            name: depName,
                            fullname: depFullname,
                            module: System.get(depFullname) || module,
                            record: moduleRecordFor(System, depFullname)
                        };
                    });
                });
            })).then(function (deps) {
                record.dependencies = deps.map(function (ea) {
                    return ea.record;
                });
                var prevLoad = System.loads && System.loads[load.name];
                if (prevLoad) {
                    prevLoad.deps = deps.map(function (ea) {
                        return ea.name;
                    });
                    prevLoad.depMap = deps.reduce(function (map, dep) {
                        map[dep.name] = dep.fullname;
                        return map;
                    }, {});
                    if (prevLoad.metadata && prevLoad.metadata.entry) {
                        prevLoad.metadata.entry.deps = prevLoad.deps;
                        prevLoad.metadata.entry.normalizedDeps = deps.map(function (ea) {
                            return ea.fullname;
                        });
                        prevLoad.metadata.entry.declare = updateData.declare;
                    }
                }
                deps.forEach(function (d, i) {
                    return declared.setters[i](d.module);
                });
                return declared.execute();
            });
        });
    }
    return {
        setters: [
            function (_systemJs) {
                moduleRecordFor = _systemJs.moduleRecordFor;
            },
            function (_instrumentationJs) {
                instrumentSourceOfModuleLoad = _instrumentationJs.instrumentSourceOfModuleLoad;
            },
            function (_importExportJs) {
                scheduleModuleExportsChange = _importExportJs.scheduleModuleExportsChange;
            }
        ],
        execute: function () {
            _export('moduleSourceChange', moduleSourceChange);
        }
    };
})
System.register('lively.modules/src/dependencies.js', [
    'lively.lang',
    './system.js'
], function (_export) {
    'use strict';
    var graph, arr, obj, loadedModules;
    function forgetEnvOf(System, fullname) {
        delete System['__lively.modules__'].loadedModules[fullname];
    }
    function forgetModuleDeps(System, moduleName, opts) {
        opts = obj.merge({
            forgetDeps: true,
            forgetEnv: true
        }, opts);
        var id = System.normalizeSync(moduleName), deps = findDependentsOf(System, id);
        deps.forEach(function (ea) {
            System['delete'](ea);
            if (System.loads)
                delete System.loads[ea];
            opts.forgetEnv && forgetEnvOf(System, ea);
        });
        return id;
    }
    function forgetModule(System, moduleName, opts) {
        opts = obj.merge({
            forgetDeps: true,
            forgetEnv: true
        }, opts);
        var id = opts.forgetDeps ? forgetModuleDeps(System, moduleName, opts) : System.normalizeSync(moduleName);
        System['delete'](moduleName);
        System['delete'](id);
        if (System.loads) {
            delete System.loads[moduleName];
            delete System.loads[id];
        }
        if (opts.forgetEnv) {
            forgetEnvOf(System, id);
            forgetEnvOf(System, moduleName);
        }
    }
    function reloadModule(System, moduleName, opts) {
        opts = obj.merge({
            reloadDeps: true,
            resetEnv: true
        }, opts);
        var id = System.normalizeSync(moduleName), toBeReloaded = [id];
        if (opts.reloadDeps)
            toBeReloaded = findDependentsOf(System, id).concat(toBeReloaded);
        forgetModule(System, id, {
            forgetDeps: opts.reloadDeps,
            forgetEnv: opts.resetEnv
        });
        return Promise.all(toBeReloaded.map(function (ea) {
            return ea !== id && System['import'](ea);
        })).then(function () {
            return System['import'](id);
        });
    }
    function computeRequireMap(System) {
        if (System.loads) {
            var store = System.loads, modNames = arr.uniq(Object.keys(loadedModules(System)).concat(Object.keys(store)));
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
        return Object.keys(System._loader.moduleRecords).reduce(function (requireMap, k) {
            requireMap[k] = System._loader.moduleRecords[k].dependencies.filter(Boolean).map(function (ea) {
                return ea.name;
            });
            return requireMap;
        }, {});
    }
    function findDependentsOf(System, name) {
        var id = System.normalizeSync(name);
        return graph.hull(graph.invert(computeRequireMap(System)), id);
    }
    function findRequirementsOf(System, name) {
        var id = System.normalizeSync(name);
        return graph.hull(computeRequireMap(System), id);
    }
    return {
        setters: [
            function (_livelyLang) {
                graph = _livelyLang.graph;
                arr = _livelyLang.arr;
                obj = _livelyLang.obj;
            },
            function (_systemJs) {
                loadedModules = _systemJs.loadedModules;
            }
        ],
        execute: function () {
            _export('findDependentsOf', findDependentsOf);
            _export('findRequirementsOf', findRequirementsOf);
            _export('computeRequireMap', computeRequireMap);
            _export('forgetModuleDeps', forgetModuleDeps);
            _export('forgetModule', forgetModule);
            _export('reloadModule', reloadModule);
        }
    };
})
System.register('lively.modules/src/import-export.js', [
    'lively.ast',
    'lively.lang',
    './system.js'
], function (_export) {
    'use strict';
    var ast, arr, moduleRecordFor, updateModuleRecordOf, sourceOf;
    function scheduleModuleExportsChange(System, moduleId, name, value, addNewExport) {
        var pendingExportChanges = System['__lively.modules__'].pendingExportChanges, rec = moduleRecordFor(System, moduleId);
        if (rec && (name in rec.exports || addNewExport)) {
            var pending = pendingExportChanges[moduleId] || (pendingExportChanges[moduleId] = {});
            pending[name] = value;
        }
    }
    function runScheduledExportChanges(System, moduleId) {
        var pendingExportChanges = System['__lively.modules__'].pendingExportChanges, keysAndValues = pendingExportChanges[moduleId];
        if (!keysAndValues)
            return;
        clearPendingModuleExportChanges(System, moduleId);
        updateModuleExports(System, moduleId, keysAndValues);
    }
    function clearPendingModuleExportChanges(System, moduleId) {
        var pendingExportChanges = System['__lively.modules__'].pendingExportChanges;
        delete pendingExportChanges[moduleId];
    }
    function updateModuleExports(System, moduleId, keysAndValues) {
        var debug = System['__lively.modules__'].debug;
        updateModuleRecordOf(System, moduleId, function (record) {
            var newExports = [], existingExports = [];
            Object.keys(keysAndValues).forEach(function (name) {
                var value = keysAndValues[name];
                debug && console.log('[lively.vm es6 updateModuleExports] %s export %s = %s', moduleId, name, String(value).slice(0, 30).replace(/\n/g, '') + '...');
                var isNewExport = !(name in record.exports);
                if (isNewExport)
                    record.__lively_modules__.evalOnlyExport[name] = true;
                record.exports[name] = value;
                if (isNewExport)
                    newExports.push(name);
                else
                    existingExports.push(name);
            });
            newExports.forEach(function (name) {
                var oldM = System._loader.modules[moduleId].module, m = System._loader.modules[moduleId].module = new oldM.constructor(), pNames = Object.getOwnPropertyNames(record.exports);
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
                debug && console.log('[lively.vm es6 updateModuleExports] updating %s dependents of %s', record.importers.length, moduleId);
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
    function importsAndExportsOf(System, moduleName, parent) {
        return System.normalize(moduleName, parent).then(function (id) {
            return Promise.resolve(sourceOf(System, id)).then(function (source) {
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
    return {
        setters: [
            function (_livelyAst) {
                ast = _livelyAst;
            },
            function (_livelyLang) {
                arr = _livelyLang.arr;
            },
            function (_systemJs) {
                moduleRecordFor = _systemJs.moduleRecordFor;
                updateModuleRecordOf = _systemJs.updateModuleRecordOf;
                sourceOf = _systemJs.sourceOf;
            }
        ],
        execute: function () {
            _export('runScheduledExportChanges', runScheduledExportChanges);
            _export('scheduleModuleExportsChange', scheduleModuleExportsChange);
            _export('importsAndExportsOf', importsAndExportsOf);
        }
    };
})
System.register('lively.modules/src/hooks.js', ['lively.lang'], function (_export) {
    'use strict';
    var arr, fun;
    function install(System, hookName, hook) {
        System[hookName] = fun.wrap(System[hookName], hook);
        System[hookName].hookFunc = hook;
    }
    function remove(System, methodName, hookOrName) {
        var chain = [], f = System[methodName];
        while (f) {
            chain.push(f);
            f = f.originalFunction;
        }
        var found = typeof hookOrName === 'string' ? chain.find(function (wrapper) {
            return wrapper.hookFunc && wrapper.hookFunc.name === hookOrName;
        }) : chain.find(function (wrapper) {
            return wrapper.hookFunc === hookOrName;
        });
        if (!found)
            return false;
        arr.remove(chain, found);
        System[methodName] = chain.reduceRight(function (method, wrapper) {
            return method.wrap(wrapper.hookFunc || wrapper);
        });
        return true;
    }
    function isInstalled(System, methodName, hookOrName) {
        var f = System[methodName];
        while (f) {
            if (f.hookFunc) {
                if (typeof hookOrName === 'string' && f.hookFunc.name === hookOrName)
                    return true;
                else if (f.hookFunc === hookOrName)
                    return true;
            }
            f = f.originalFunction;
        }
        return false;
    }
    return {
        setters: [function (_livelyLang) {
                arr = _livelyLang.arr;
                fun = _livelyLang.fun;
            }],
        execute: function () {
            _export('install', install);
            _export('remove', remove);
            _export('isInstalled', isInstalled);
        }
    };
})
System.register('lively.modules/src/instrumentation.js', [
    'lively.ast',
    'lively.lang',
    './system.js',
    'lively.vm/lib/evaluator.js',
    './hooks.js'
], function (_export) {
    'use strict';
    var ast, arr, string, properties, classHelper, moduleEnv, evalCodeTransform, installHook, removeHook, isHookInstalled, isNode, node_modulesDir, exceptions, pendingConfigs, configInitialized, esmFormatCommentRegExp, cjsFormatCommentRegExp, esmRegEx;
    function canonicalURL(url) {
        var m = url.match(/([^:]+:\/\/)(.*)/);
        if (m) {
            var protocol = m[1];
            url = m[2];
        }
        url = url.replace(/([^:])\/[\/]+/g, '$1/');
        return (protocol || '') + url;
    }
    function getExceptions() {
        return exceptions;
    }
    function setExceptions(v) {
        return exceptions = v;
    }
    function prepareCodeForCustomCompile(source, fullname, env, debug) {
        source = String(source);
        var tfmOptions = {
                topLevelVarRecorder: env.recorder,
                varRecorderName: env.recorderName,
                dontTransform: env.dontTransform,
                recordGlobals: true
            }, header = (debug ? 'console.log("[lively.modules] executing module ' + fullname + '");\n' : '') + ('var __lively_modules__ = System["__lively.modules__"], ' + env.recorderName + ' = __lively_modules__.moduleEnv("' + fullname + '").recorder;\n'), footer = '\n__lively_modules__.evaluationDone("' + fullname + '");';
        try {
            var rewrittenSource = header + evalCodeTransform(source, tfmOptions) + footer;
            if (debug && typeof $morph !== 'undefined' && $morph('log'))
                $morph('log').textString = rewrittenSource;
            return rewrittenSource;
        } catch (e) {
            console.error('Error in prepareCodeForCustomCompile', e.stack);
            return source;
        }
    }
    function getCachedNodejsModule(System, load) {
        try {
            var Module = System._nodeRequire('module').Module, id = Module._resolveFilename(load.name.replace(/^file:\/\//, '')), nodeModule = Module._cache[id];
            return nodeModule;
        } catch (e) {
            System.debug && console.log('[lively.modules getCachedNodejsModule] %s unknown to nodejs', load.name);
        }
        return null;
    }
    function addNodejsWrapperSource(System, load) {
        var m = getCachedNodejsModule(System, load);
        if (m) {
            load.source = 'export default System._nodeRequire(\'' + m.id + '\');\n';
            load.source += properties.allOwnPropertiesOrFunctions(m.exports).map(function (k) {
                return classHelper.isValidIdentifier(k) ? 'export var ' + k + ' = System._nodeRequire(\'' + m.id + '\')[\'' + k + '\'];' : '/*ignoring export "' + k + '" b/c it is not a valid identifier*/';
            }).join('\n');
            System.debug && console.log('[lively.modules customTranslate] loading %s from nodejs module cache', load.name);
            return true;
        }
        System.debug && console.log('[lively.modules customTranslate] %s not yet in nodejs module cache', load.name);
        return false;
    }
    function customTranslate(proceed, load) {
        var System = this, debug = System.debug;
        if (exceptions.some(function (exc) {
                return exc(load.name);
            })) {
            debug && console.log('[lively.modules customTranslate ignoring] %s', load.name);
            return proceed(load);
        }
        if (isNode && addNodejsWrapperSource(System, load)) {
            debug && console.log('[lively.modules] loaded %s from nodejs cache', load.name);
            return proceed(load);
        }
        var start = Date.now();
        var isEsm = load.metadata.format == 'esm' || load.metadata.format == 'es6' || !load.metadata.format && esmFormatCommentRegExp.test(load.source.slice(0, 5000)) || !load.metadata.format && !cjsFormatCommentRegExp.test(load.source.slice(0, 5000)) && esmRegEx.test(load.source), isCjs = load.metadata.format == 'cjs', isGlobal = load.metadata.format == 'global';
        if (isEsm) {
            load.metadata.format = 'esm';
            load.source = prepareCodeForCustomCompile(load.source, load.name, moduleEnv(System, load.name), debug);
            load.metadata['lively.vm instrumented'] = true;
            debug && console.log('[lively.modules] loaded %s as es6 module', load.name);
        } else if (isCjs && isNode) {
            load.metadata.format = 'cjs';
            var id = cjs.resolve(load.address.replace(/^file:\/\//, ''));
            load.source = cjs._prepareCodeForCustomCompile(load.source, id, cjs.envFor(id), debug);
            load.metadata['lively.vm instrumented'] = true;
            debug && console.log('[lively.modules] loaded %s as instrumented cjs module', load.name);
        } else if (isGlobal) {
            load.source = prepareCodeForCustomCompile(load.source, load.name, moduleEnv(System, load.name), debug);
            load.metadata['lively.vm instrumented'] = true;
        } else {
            debug && console.log('[lively.modules] customTranslate ignoring %s b/c don\'t know how to handle global format', load.name);
        }
        debug && console.log('[lively.modules customTranslate] done %s after %sms', load.name, Date.now() - start);
        return proceed(load);
    }
    function instrumentSourceOfModuleLoad(System, load) {
        return System.translate(load).then(function (translated) {
            var parsed = ast.parse(translated), call = parsed.body[0].expression, moduleName = call.arguments[0].value, registerCall = call.callee.body.body[0].expression, depNames = arr.pluck(registerCall['arguments'][0].elements, 'value'), declareFuncNode = call.callee.body.body[0].expression['arguments'][1], declareFuncSource = translated.slice(declareFuncNode.start, declareFuncNode.end), declare = eval('var __moduleName = "' + moduleName + '";(' + declareFuncSource + ');\n//@ sourceURL=' + moduleName + '\n');
            if (System.debug && typeof $morph !== 'undefined' && $morph('log'))
                $morph('log').textString = declare;
            return {
                localDeps: depNames,
                declare: declare
            };
        });
    }
    function wrapModuleLoad(System) {
        if (isHookInstalled(System, 'translate', 'lively_modules_translate_hook'))
            return;
        installHook(System, 'translate', function lively_modules_translate_hook(proceed, load) {
            return customTranslate.call(System, proceed, load);
        });
    }
    function unwrapModuleLoad(System) {
        removeHook(System, 'translate', 'lively_modules_translate_hook');
    }
    return {
        setters: [
            function (_livelyAst) {
                ast = _livelyAst;
            },
            function (_livelyLang) {
                arr = _livelyLang.arr;
                string = _livelyLang.string;
                properties = _livelyLang.properties;
                classHelper = _livelyLang.classHelper;
            },
            function (_systemJs) {
                moduleEnv = _systemJs.moduleEnv;
            },
            function (_livelyVmLibEvaluatorJs) {
                evalCodeTransform = _livelyVmLibEvaluatorJs.evalCodeTransform;
            },
            function (_hooksJs) {
                installHook = _hooksJs.install;
                removeHook = _hooksJs.remove;
                isHookInstalled = _hooksJs.isInstalled;
            }
        ],
        execute: function () {
            _export('wrapModuleLoad', wrapModuleLoad);
            _export('unwrapModuleLoad', unwrapModuleLoad);
            _export('instrumentSourceOfModuleLoad', instrumentSourceOfModuleLoad);
            _export('getExceptions', getExceptions);
            _export('setExceptions', setExceptions);
            isNode = System.get('@system-env').node;
            node_modulesDir = System.normalizeSync('lively.modules/node_modules/');
            exceptions = [
                function (id) {
                    return string.include(id, 'acorn/src');
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
        }
    };
})
System.register('lively.modules/src/eval.js', [
    'lively.ast',
    'lively.lang',
    './system.js',
    'lively.vm/lib/evaluator.js'
], function (_export) {
    'use strict';
    var ast, obj, moduleRecordFor, moduleEnv, evaluator;
    function ensureImportsAreLoaded(System, code, parentModule) {
        var body = ast.parse(code).body, imports = body.filter(function (node) {
                return node.type === 'ImportDeclaration';
            });
        return Promise.all(imports.map(function (node) {
            return System.normalize(node.source.value, parentModule).then(function (fullName) {
                return moduleRecordFor(System, fullName) ? undefined : System['import'](fullName);
            });
        }))['catch'](function (err) {
            console.error('Error ensuring imports: ' + err.message);
            throw err;
        });
    }
    function runEval(System, code, options) {
        options = obj.merge({
            targetModule: null,
            parentModule: null,
            parentAddress: null
        }, options);
        return Promise.resolve().then(function () {
            var targetModule = options.targetModule || '*scratch*';
            return System.normalize(targetModule, options.parentModule, options.parentAddress);
        }).then(function (targetModule) {
            var fullname = options.targetModule = targetModule;
            return System['import'](fullname).then(function () {
                return ensureImportsAreLoaded(System, code, fullname);
            }).then(function () {
                var env = moduleEnv(System, fullname), rec = env.recorder, recName = env.recorderName, header = 'var _moduleExport = ' + recName + '._moduleExport,\n' + ('    _moduleImport = ' + recName + '._moduleImport;\n');
                code = header + code;
                options = obj.merge({ waitForPromise: true }, options, {
                    recordGlobals: true,
                    dontTransform: env.dontTransform,
                    varRecorderName: recName,
                    topLevelVarRecorder: rec,
                    sourceURL: options.sourceURL || options.targetModule,
                    context: rec,
                    es6ExportFuncId: '_moduleExport',
                    es6ImportFuncId: '_moduleImport'
                });
                return evaluator.runEval(code, options).then(function (result) {
                    System['__lively.modules__'].evaluationDone(fullname);
                    return result;
                });
            });
        });
    }
    return {
        setters: [
            function (_livelyAst) {
                ast = _livelyAst;
            },
            function (_livelyLang) {
                obj = _livelyLang.obj;
            },
            function (_systemJs) {
                moduleRecordFor = _systemJs.moduleRecordFor;
                moduleEnv = _systemJs.moduleEnv;
            },
            function (_livelyVmLibEvaluatorJs) {
                evaluator = _livelyVmLibEvaluatorJs;
            }
        ],
        execute: function () {
            _export('runEval', runEval);
        }
    };
})