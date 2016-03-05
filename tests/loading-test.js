/*global process, require, beforeEach, afterEach, describe, it*/

if (typeof window !== "undefined") {
  var chai = window.chai;
  var expect = window.expect;
  var lang = window.lively.lang;
  var ast = window.lively.ast;
} else {
  var chai = require('chai');
  var expect = chai.expect;
  var lang = require("lively.lang");
  var ast = require('../index');
  chai.use(require('chai-subset'));
}

function testPageLoad(url, waitForHTMLMatch) {
  return it('can load ' + url, function(done) {
    document.querySelector('#scratch').insertAdjacentHTML('beforeend', lang.string.format('<iframe width="400" height="600" src="%s"></iframe>', url));
    var testProcess = setInterval(function () {
      var iframe = document.querySelector('#scratch iframe'),
          log = iframe.contentDocument.body.querySelector('#log'),
          match = log.innerText.match(waitForHTMLMatch);
      if (!match) return;
      clearInterval(testProcess);
      done();
    }, 200);
  });
}

function testNodejsRuntimeLoad(name, src) {
  return it("nodejs loading " + name, function() {
    return new Promise(function(resolve, reject)  {
      src = "var Module = require(\"module\").Module;\n"
                + "var load = Module._load;\n"
                + "Module._load = function(request, parent, isMain) {\n"
                + "  if (!Module._cache[Module._resolveFilename(request, parent)])\n"
                + "    console.log(\"[" + name + " require] %s\", request)\n"
                + "  return load.call(this, request, parent, isMain);\n"
                + "};\n"
                + "\n"
                + src;

      var spawn = require("child_process").spawn,
          proc = spawn("node", ["-e", src]),
          out = "";
      proc.on("error", reject);
      proc.stdout.on("data", function(d) { out += String(d); });
      proc.on("exit", function() { resolve(out); });
    })
    .then(function(out) { return expect(out).to.match(/\nDONE\n/m); });
  });
}

function testNodejsLoad(bundleFile) {
  var src =   "var System = require(\"systemjs\");\n"
            + "require(\"" + bundleFile + "\");\n"
            + "System.config(require(\"" + bundleFile.replace(/\.js$/, "-config.json") + "\"));\n"
            + "\n"
            + "System.import(\"lively.ast\")\n"
            + "  .then(function(ast) {\n"
            + "    console.log(ast.parse(\"1+3\"));\n"
            + "    console.log(ast.stringify(ast.parse(\"1+3\")));\n"
            + "    console.log(\"DONE\")\n"
            + "  })\n"
            + "  .catch(function(err) { console.log(String(err.stack)); console.error(\"ERROR\", err); });\n";
  return testNodejsRuntimeLoad(bundleFile, src);
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

describe('loading', function() {

  this.timeout(5000);

  if (typeof window !== "undefined") {
    afterEach(function() {
      document.querySelector('#scratch').innerHTML = '';
    });

    testPageLoad("es6-runtime-loader.html", /DONE$/m);
    testPageLoad("test-lively.ast.bundle.html", /DONE$/m);
    testPageLoad("test-lively.ast.html", /DONE$/m);
    testPageLoad("test-lively.ast.es6.bundle.html", /DONE$/m);
    testPageLoad("test-lively.ast.es6.html", /DONE$/m);

  } else {
    this.timeout(5000);
    testNodejsRuntimeLoad("runtime load",
      lang.fun.extractBody(function() {
        var System = require("systemjs");
        var conf = require("./dist/es6-runtime-config.json");
        conf = JSON.parse(JSON.stringify(conf).replace(/__AST_DIR__/g, "./"));
        System.config(conf);
        System.import("lively.ast")
          .then(function(ast) {
              console.log(ast.fuzzyParse('1+3 0'));
              console.log(ast.stringify(ast.parse('1+3')));
              console.log('DONE');
          }).catch(function(err) { return console.error('ERROR', err); });
      }));
    testNodejsLoad("./dist/lively.ast.es6.bundle.js");
    testNodejsLoad("./dist/lively.ast.es6.js");
  }

});
