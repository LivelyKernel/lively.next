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

      var match = src.match(/(.*)generated\/[^\/]+\/combinedModules.js/);
      if (match) {
        pluginBabelPath = match[1] + "node_modules/lively.modules/node_modules/systemjs-plugin-babel";
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