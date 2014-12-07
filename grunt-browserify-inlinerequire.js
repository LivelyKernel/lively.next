/*global require*/
module.exports = function install() {

/**********************************
 * grunt-browserify inline require
 * ********************************
 * installs "inlineRequire" option for grunt-browserify. Use it like

  grunt.initConfig({
    browserify: {
      myPackage: {
        options: {
          inlineRequire: {
            tempFilename: 'foo.js',
            inlineCode: "var fs = require('fs'); fs.foo = 23; ",
            requires: [{name: "fs", options: basedir: '.', expose: 'myFS'}]
          }
        }
      }
    }
  });

 *
 */


  var runner = require("grunt-browserify/lib/runner.js");

  function wrap(f, advice) {
    var proceed = function() { return f.apply(this, arguments); };
    var wrapper = function(/*args*/) {
      var args = Array.prototype.slice.call(arguments);
      return advice.apply(this, [proceed.bind(this)].concat(args));
    }
    wrapper.toString = function() { return f.toString(); };
    return wrapper;
  }

  var origRun = runner.prototype.run;

  function prepareInlineBrowserifyRequire(options, browserifyInstance) {
    require('fs').writeFileSync(options.tempFilename, options.inlineCode);
    browserifyInstance.add(options.tempFilename)
    if (options.requires) {
      options.requires.forEach(function(req) {
        var reqName = typeof req === "string" ? req : req.name;
        var reqOpts = typeof req === "object" ? req : undefined;
        // This seems to be needed by a bug in browserify:
        if (reqOpts && !reqOpts.basedir) reqOpts.basedir = ".";
        browserifyInstance.require(reqName, reqOpts);
      });
    }
  }

  function cleanupInlineBrowserifyRequire(options) {
    require('fs').unlink(options.tempFilename);
  }

  runner.prototype.run = wrap(origRun, function (proceed, files, destination, options, next) {
    if (options.inlineRequire) {
      // if (!files) files = [];
      var origPre = options.preBundleCB || function() {}
      var origPost = options.postBundleCB || function(err, buf, bundleComplete) { bundleComplete(err, buf); }
      options.preBundleCB = function(browserifyInstance) {
        prepareInlineBrowserifyRequire(options.inlineRequire, browserifyInstance);
        origPre(browserifyInstance);
      };
      options.postBundleCB = function(err, buf, bundleComplete) {
        cleanupInlineBrowserifyRequire(options.inlineRequire);
        origPost(err, buf, bundleComplete);
      };
    }

    return proceed(files, destination, options, next);
  });

}
