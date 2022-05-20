/*global require, process, __dirname */
var path = require("path");
var Module = require("module");
var { flatnResolve } = require("./module-resolver.js");

process.execPath = process.argv[0] = path.join(__dirname, "bin/node");

// implements a custom resolver for the node.js cjs modules.

var originalResolve;
function installResolver() {
  if (!originalResolve) originalResolve = Module._resolveFilename;
  Module._resolveFilename = function(request, parent, isMain) {
    let result;
    try {
      result = originalResolve.call(this, request, parent, isMain);
      return result;
    } catch (err) {
      if (result = flatnResolve(request, parent.filename || parent.id)) {
        return result;
      }
      throw err;
    }
  }
}

installResolver();
