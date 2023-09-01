/* global System,Babel,global,require,__dirname,self */
/* eslint-disable no-use-before-define */
'format global';
(function configure () {
  if (typeof System === 'undefined') System = global.System;
  System.useModuleTranslationCache = !urlQuery().noModuleCache;

  if (System.get('lively.transpiler') ||
   (System.map['plugin-babel'] && System.map['systemjs-plugin-babel'])) {
    console.log('[lively.modules] System seems already to be configured');
    return;
  }

  let features = featureTest();
  let transpiler = decideAboutTranspiler(features);

  if (transpiler === 'lively.transpiler') setupLivelyTranspiler(features);
  else if (transpiler === 'plugin-babel') setupPluginBabelTranspiler(features);
  else console.error('[lively.modules] could not find System transpiler for platform!');

  if (typeof require !== 'undefined') { System._nodeRequire = eval('require'); } // hack to enable dynamic requires in bundles
  if (typeof global !== 'undefined') { global.__webpack_require__ = global.__non_webpack_require__ = System._nodeRequire; }
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  System.global = typeof global === 'undefined' ? window : global;
  System.trace = true; // in order to harvest more metadata for lively.modules
  if (System._nodeRequire) {
    const Module = System._nodeRequire('module');
    // wrap _load() such that it attaches the __esModule flag to each imported native module
    // this ensures the interoperability to 0.21 SystemJS
    const origLoad = Module._load;
    // this also overrides native requires, which is not what we want really
    Module._load = (...args) => {
      let exports = origLoad(...args);
      const isCoreModule = !!System.loads['@node/' + args[0]];
      if (isCoreModule && !args[1].loaded && !exports.prototype) {
        exports = Object.assign(Object.create(exports.prototype || {}), exports)
        exports.__esModule = true; 
      };
      return exports;
    }
  }

  function decideAboutTranspiler (features) {
    return features.supportsAsyncAwait ? 'lively.transpiler' : 'plugin-babel';
  }

  function setupLivelyTranspiler (features) {
    if (features.isBrowser) {
      if (typeof Babel !== 'undefined') {
        System.global.babel = Babel;
        delete System.global.Babel;
      }
      if (!System.global.babel) {
        console.error('[lively.modules] in browser environments babel is required to be loaded before lively.modules!');
        return;
      }
    } else {
      System.global.babel = loadBabel_node();
    }

    console.log('[lively.modules] SystemJS configured with lively.transpiler & babel');

    function Transpiler (System, moduleId, env) {
      this.System = System;
      this.moduleId = moduleId;
      this.env = env;
    }
    Transpiler.prototype.transpileDoit = function transpileDoit (source, options) {
      // wrap in async function so we can use await top-level
      let System = this.System;
      var source = '(async function(__rec) {\n' + source.replace(/(\/\/# sourceURL=.+)$|$/, '\n}).call(this);\n$1'); // eslint-disable-line no-var
      let opts = System.babelOptions;
      let needsBabel = (opts.plugins && opts.plugins.length) || (opts.presets && opts.presets.length);
      return needsBabel
        ? System.global.babel.transform(source, opts).code
        : source;
    };
    Transpiler.prototype.transpileModule = function transpileModule (source, options) {
      let System = this.System;
      let opts = Object.assign({}, System.babelOptions);
      opts.plugins = opts.plugins ? opts.plugins.slice() : [];
      opts.plugins.push(System._nodeRequire ? System._nodeRequire('@babel/plugin-proposal-dynamic-import') : 'proposal-dynamic-import');
      opts.plugins.push(System._nodeRequire ? System._nodeRequire('@babel/plugin-proposal-class-properties') : 'proposal-class-properties');
      opts.plugins.push(System._nodeRequire ? System._nodeRequire('@babel/plugin-transform-modules-systemjs') : 'transform-modules-systemjs');
      return System.global.babel.transform(source, opts).code;
    };

    function translate (load, traceOpts) {
      return new Transpiler(this, load.name, {}).transpileModule(load.source, {});
    }
    System.set('lively.transpiler', System.newModule({ default: Transpiler, translate }));
    System._loader.transpilerPromise = Promise.resolve({ translate });
    System.translate = async (load) => await translate.bind(System)(load);
    System.config({
      transpiler: 'lively.transpiler',
      babelOptions: {
        sourceMaps: false,
        compact: 'auto',
        comments: true,
        presets: features.supportsAsyncAwait ? [] : ['es2015']
      }
    });
  }

  function setupPluginBabelTranspiler (features) {
    let isBrowser = !!System.get('@system-env').browser;
    let pluginBabelPath = isBrowser ? findSystemJSPluginBabel_browser() : findSystemJSPluginBabel_node();
    let babel = System.global.babel;

    if (!pluginBabelPath && !babel) {
      console.error('[lively.modules] Could not find path to systemjs-plugin-babel nor a babel global! This will likely break lively.modules!');
      return;
    }

    if (!pluginBabelPath) {
      console.warn("[lively.modules] Could not find path to systemjs-plugin-babel but babel! Will fallback but there might be features in lively.modules that won't work!");
      System.config({ transpiler: 'babel' });
    } else {
      console.log('[lively.modules] SystemJS configured with systemjs-plugin-babel transpiler from ' + pluginBabelPath);
      System.config({
        map: {
          'plugin-babel': pluginBabelPath + '/plugin-babel.js',
          'systemjs-babel-build': pluginBabelPath + (isBrowser ? '/systemjs-babel-browser.js' : '/systemjs-babel-node.js')
        },
        transpiler: 'plugin-babel',
        babelOptions: Object.assign({
          sourceMaps: 'inline',
          stage3: true,
          es2015: true,
          modularRuntime: true
        }, System.babelOptions)
      });
    }
  }

  function featureTest () {
    let isBrowser = System.get('@system-env').browser || typeof self !== 'undefined';

    // "feature test": we assume if the browser supports async/await it will also
    // support other es6/7/8 features we care about. In this case only use the
    // system-register transform. Otherwise use full transpilation.
    let supportsAsyncAwait = false;
    try { eval('async function foo() {}'); supportsAsyncAwait = true; } catch (e) {}

    return { supportsAsyncAwait, isBrowser };
  }

  function loadBabel_node () {
    if (global.Babel && !global.babel) global.babel = global.Babel;
    if (global.babel) return global.babel;
    let parent;
    try { parent = require.cache[require.resolve('lively.modules')]; } catch (err) {}
    try { parent = require.cache[require.resolve(__dirname + '/../')]; } catch (err) {}
    if (!parent) throw new Error('Cannot find batch to babel-standalone module');
    let babelPath = require('module').Module._resolveFilename('babel-standalone', parent);
    global.window = global;
    global.navigator = {};
    let babel = require(babelPath);
    delete global.navigator;
    delete global.window;
    return babel;
  }

  function urlQuery () {
    if (typeof document === 'undefined' || !document.location) return {};
    return (document.location.search || '').replace(/^\?/, '').split('&')
      .reduce(function (query, ea) {
        let split = ea.split('='); let key = split[0]; let value = split[1];
        if (value === 'true' || value === 'false') value = eval(value);
        else if (!isNaN(Number(value))) value = Number(value);
        query[key] = value;
        return query;
      }, {});
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  function findSystemJSPluginBabel_browser () {
    // walks the script tags
    let scripts = [].slice.call(document.getElementsByTagName('script'));
    let pluginBabelPath;

    for (let i = scripts.length - 1; i >= 0; i--) {
      let src = scripts[i].src;
      // is lively.modules loaded? Use it's node_modules folder
      let index1 = src.indexOf('lively.modules/');
      if (index1 > -1) {
        pluginBabelPath = src.slice(0, index1) + 'lively.next-node_modules/systemjs-plugin-babel';
        break;
      }

      // is systemjs loaded? Assume that systemjs-plugin-babel sits in the same folder...
      let index2 = src.indexOf('systemjs/dist/system');
      if (index2 > -1) {
        pluginBabelPath = src.slice(0, index2) + 'systemjs-plugin-babel';
        break;
      }

      // for LivelyKernel environments
      let index3 = src.indexOf('core/lively/bootstrap.js');
      if (index3 > -1) {
        pluginBabelPath = src.slice(0, index3) + 'node_modules/lively.modules/node_modules/systemjs-plugin-babel';
        break;
      }

      let match = src.match(/(.*)generated\/[^\/]+\/combinedModules.js/);
      if (match) {
        pluginBabelPath = match[1] + 'node_modules/lively.modules/node_modules/systemjs-plugin-babel';
        break;
      }
    }

    return pluginBabelPath;
  }

  function findSystemJSPluginBabel_node () {
    if (global.systemjsPluginBabel) return global.systemjsPluginBabel;
    let attempts = [attempt1, attempt2, attempt3];
    for (let i = 0; i < attempts.length; i++) { try { return attempts[i](); } catch (err) {} }
    return null;

    function attempt1 () {
      let parent = require.cache[require.resolve('lively.modules')];
      let pluginBabelPath = require('module').Module._resolveFilename('systemjs-plugin-babel', parent);
      if (pluginBabelPath) return require('path').dirname(pluginBabelPath);
    }

    function attempt2 () {
      let pluginBabelPath = require.resolve('systemjs-plugin-babel');
      if (pluginBabelPath) return require('path').dirname(pluginBabelPath);
    }
    function attempt3 () {
      let pluginBabelPath = require.resolve(require('path').join(__dirname, 'systemjs-babel-node.js'));
      if (pluginBabelPath) return require('path').dirname(pluginBabelPath);
    }
  }
})();
