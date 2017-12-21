/*global System,Babel,global,require,__dirname,self*/
"format global";
(function configure() {

  System.useModuleTranslationCache = !urlQuery().noModuleCache;

  if (System.get("lively.transpiler")
   || (System.map['plugin-babel'] && System.map['systemjs-plugin-babel'])) {
    console.log("[lively.modules] System seems already to be configured");
    return;
  }

  var features = featureTest();
  var transpiler = decideAboutTranspiler(features);

  if (transpiler === "lively.transpiler") setupLivelyTranspiler(features);
  else if (transpiler === "plugin-babel") setupPluginBabelTranspiler(features);
  else console.error(`[lively.modules] could not find System transpiler for platform!`);

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  function decideAboutTranspiler(features) {
    return features.supportsAsyncAwait ? "lively.transpiler" : "plugin-babel";
  }

  function setupLivelyTranspiler(features) {
    if (features.isBrowser) {
      if (typeof Babel !== "undefined") {
        System.global.babel = Babel
        delete System.global.Babel;
      }
      if (!System.global.babel) {
        console.error("[lively.modules] in browser environments babel is required to be loaded before lively.modules!");
        return;
      }
    } else {
      System.global.babel = loadBabel_node();
    }

    console.log("[lively.modules] SystemJS configured with lively.transpiler & babel");

    function Transpiler(System, moduleId, env) {
      this.System = System;
      this.moduleId = moduleId;
      this.env = env;
    }
    Transpiler.prototype.transpileDoit = function transpileDoit(source, options) {
      // wrap in async function so we can use await top-level
      var System = this.System,
          source = "(async function(__rec) {\n" + source.replace(/(\/\/# sourceURL=.+)$|$/, "\n}).call(this);\n$1"),
          opts = System.babelOptions,
          needsBabel = (opts.plugins && opts.plugins.length) || (opts.presets && opts.presets.length);
      return needsBabel ?
        System.global.babel.transform(source, opts).code :
        source;
    }
    Transpiler.prototype.transpileModule = function transpileModule(source, options) {
      var System = this.System,
          opts = Object.assign({}, System.babelOptions);
      opts.plugins = opts.plugins ? opts.plugins.slice() : [];
      opts.plugins.push("transform-es2015-modules-systemjs");
      return System.global.babel.transform(source, opts).code;
    }

    function translate(load, traceOpts) {
      return new Transpiler(this, load.name, {}).transpileModule(load.source, {})
    }
    System.set("lively.transpiler", System.newModule({default: Transpiler}));
    System._loader.transpilerPromise = Promise.resolve({translate})

    System.config({
      transpiler: 'lively.transpiler',
      babelOptions: {
        sourceMaps: false,
        compact: "auto",
        comments: "true",
        presets: features.supportsAsyncAwait ? [] : ["es2015"]
      }
    });
  }

  function setupPluginBabelTranspiler(features) {
    var isBrowser = !!System.get("@system-env").browser,
        pluginBabelPath = isBrowser ? findSystemJSPluginBabel_browser() : findSystemJSPluginBabel_node(),
        babel = System.global.babel;

    if (!pluginBabelPath && !babel) {
      console.error("[lively.modules] Could not find path to systemjs-plugin-babel nor a babel global! This will likely break lively.modules!");
      return;
    }

    if (!pluginBabelPath) {
      console.warn("[lively.modules] Could not find path to systemjs-plugin-babel but babel! Will fallback but there might be features in lively.modules that won't work!");
      System.config({transpiler: 'babel'});

    } else {

      console.log("[lively.modules] SystemJS configured with systemjs-plugin-babel transpiler from " + pluginBabelPath);
      System.config({
        map: {
          'plugin-babel': pluginBabelPath + '/plugin-babel.js',
          'systemjs-babel-build': pluginBabelPath + (isBrowser ? '/systemjs-babel-browser.js' : "/systemjs-babel-node.js")
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
  }



  function featureTest() {
    var isBrowser = System.get("@system-env").browser || typeof self !== 'undefined';

    // "feature test": we assume if the browser supports async/await it will also
    // support other es6/7/8 features we care about. In this case only use the
    // system-register transform. Otherwise use full transpilation.
    var supportsAsyncAwait = false;
    try { eval("async function foo() {}"); supportsAsyncAwait = true; } catch (e) {}

    return {supportsAsyncAwait, isBrowser};
  }

  function loadBabel_node() {
    if (global.Babel && !global.babel) global.babel = global.Babel;
    if (global.babel) return global.babel;
		var parent;
		try { parent = require.cache[require.resolve("lively.modules")]; } catch(err) {};
		try { parent = require.cache[require.resolve(__dirname + "/../")]; } catch(err) {};
		if (!parent) throw new Error("Cannot find batch to babel-standalone module")
    var babelPath = require("module").Module._resolveFilename("babel-standalone", parent);
    global.window = global;
    global.navigator = {};
    var babel = require(babelPath);
    delete global.navigator;
    delete global.window;
    return babel
  }

  function urlQuery() {
    if (typeof document === "undefined" || !document.location) return {};
    return (document.location.search || "").replace(/^\?/, "").split("&")
      .reduce(function(query, ea) {
        var split = ea.split("="), key = split[0], value = split[1];
        if (value === "true" || value === "false") value = eval(value);
        else if (!isNaN(Number(value))) value = Number(value);
        query[key] = value;
        return query;
      }, {});
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  function findSystemJSPluginBabel_browser() {
    // walks the script tags
    var scripts = [].slice.call(document.getElementsByTagName("script")),
        pluginBabelPath;

    for (var i = scripts.length-1; i >= 0; i--) {
      var src = scripts[i].src;
      // is lively.modules loaded? Use it's node_modules folder
      var index1 = src.indexOf("lively.modules/");
      if (index1 > -1) {
        pluginBabelPath = src.slice(0, index1) + "lively.next-node_modules/systemjs-plugin-babel";
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

      var match = src.match(/(.*)generated\/[^\/]+\/combinedModules.js/);
      if (match) {
        pluginBabelPath = match[1] + "node_modules/lively.modules/node_modules/systemjs-plugin-babel";
        break;
      }
    }

    return pluginBabelPath;
  }

  function findSystemJSPluginBabel_node() {
    if (global.systemjsPluginBabel) return global.systemjsPluginBabel;
    var attempts = [attempt1, attempt2, attempt3]
    for (var i = 0; i < attempts.length; i++)
      try { return attempts[i](); } catch (err) {};
    return null;

    function attempt1() {
      var parent = require.cache[require.resolve("lively.modules")],
          pluginBabelPath = require("module").Module._resolveFilename("systemjs-plugin-babel", parent)
      if (pluginBabelPath) return require('path').dirname(pluginBabelPath);
    }

    function attempt2() {
      var pluginBabelPath = require.resolve("systemjs-plugin-babel");
      if (pluginBabelPath) return require('path').dirname(pluginBabelPath);
    }
    function attempt3() {
      var pluginBabelPath = require.resolve(require("path").join(__dirname, "systemjs-babel-node.js"));
      if (pluginBabelPath) return require('path').dirname(pluginBabelPath);
    }
  }

})();
