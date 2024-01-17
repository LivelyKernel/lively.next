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
    let isCalledFromESM = false;
    try { throw Error() } catch (err) { isCalledFromESM = err.stack.toString().includes('flatn/resolver.mjs') }
    try {
      result = originalResolve.call(this, request, parent, isMain);
      return result;
    } catch (err) {
      if (isCalledFromESM) throw err;
      else if (result = flatnResolve(request, !parent ? parent : parent.filename || parent.id, 'node-require')) {
        return result;
      }
      throw err;
    }
  }
}

installResolver();
