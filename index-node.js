/*global module,exports,require*/



require("systemjs");

var lang = require("lively.lang");

// configures current SystemJS instance to load lively.vm + deps
function configure() {
  require("./node_modules/lively.ast/dist/lively.ast.es6.bundle.js");
  
  var astConfig = require("./node_modules/lively.ast/dist/lively.ast.es6-config.json"),
      vmConfig = lang.obj.deepMerge(astConfig, {
        defaultJSExtensions: true,
        map: {
          "lively.lang": "node_modules/lively.lang/index.js",
          "callsite": "node_modules/callsite/index.js",
          "babel": "node_modules/babel-core/browser.js",
          "assert": "@node/assert",
          "buffer": "@node/buffer",
          "child_process": "@node/child_process",
          "events": "@node/events",
          "fs": "@node/fs",
          "module": "@node/module",
          "path": "@node/path",
          "util": "@node/util",
          "vm": "@node/vm",
        }
      });
  
  System.config(vmConfig);
}

// async load of ./index.js
function load() {
  return new Promise((resolve, reject) => {
    configure();
    System.import("./index.js")
      .then(index => lang.obj.extend(module.exports, index))
      .then(resolve)
      .catch(reject)
  })
}

// Will be populated with index.js exports
module.exports = {
  load: load,
  configure: configure
};
