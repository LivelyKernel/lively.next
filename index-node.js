/*global module,exports,require*/



require("systemjs");

var lang = require("lively.lang");

// configures current SystemJS instance to load lively.vm + deps
function configure() {
  var vmConfig = require("./dist/es6-runtime-config-node.json")  
  vmConfig.baseURL = vmConfig.map["lively.vm"] = process.cwd()
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
