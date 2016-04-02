/*global process, require, beforeEach, afterEach, describe, it*/

import { string, fun } from "lively.lang";

import { expect } from "mocha-es6";

function testPageLoad(url, waitForHTMLMatch) {
  return it('can load ' + url, function(done) {
    document.querySelector('#scratch').insertAdjacentHTML('beforeend', string.format('<iframe width="400" height="600" src="%s"></iframe>', url));
    var testProcess = setInterval(function () {
      var iframe = document.querySelector('#scratch iframe'),
          log = iframe && iframe.contentDocument.body.querySelector('#log'),
          match = log && log.innerText.match(waitForHTMLMatch);
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
                + "var System = require('systemjs');"
                + src;
      var spawn = System._nodeRequire("child_process").spawn,
          proc = spawn("node", ["-e", src]),
          out = "";
      proc.on("error", function(err) { console.log(err);            reject(err); });
      proc.stdout.on("data", function(d) { console.log(String(d));  out += String(d); });
      proc.stderr.on("data", function(d) { console.log(String(d));  out += String(d); });
      proc.on("exit", function() { resolve(out); });
    })
    .then(function(out) { return expect(out).to.match(/\nDONE\n/m); });
  });
}

function testNodejsLoad(bundleFile) {
  var src = "System.config(require(\"./package.json\").systemjs);\n"
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

xdescribe('loading', function() {

  this.timeout(5000);

  if (typeof window !== "undefined") {
    beforeEach(function() {
      if (!document.querySelector('#scratch'))
        document.body.insertAdjacentHTML('beforeend', '<div id="scratch"></div>');
    });

    afterEach(function() {
      document.querySelector('#scratch').innerHTML = '';
    });

    testPageLoad("es6-runtime-loader.html", /DONE$/m);
    // testPageLoad("test-lively.ast.bundle.html", /DONE$/m);
    // testPageLoad("test-lively.ast.html", /DONE$/m);
    // testPageLoad("test-lively.ast.es6.bundle.html", /DONE$/m);
    // testPageLoad("test-lively.ast.es6.html", /DONE$/m);

  } else {
    this.timeout(5000);
    testNodejsRuntimeLoad("runtime load",
        `var conf = require("./package.json").systemjs;
        conf.transpiler = "babel";
        conf.babel = System.normalizeSync("babel");
        //conf.babel = "${System.normalizeSync("babel")}";
        // conf.map.babel = "${System.normalizeSync("babel")}";
        System.config(conf);
        console.log(System.babel)
        console.log(System.baseURL)
        System.import("./index.js")
          .then(function(ast) {
            console.log(ast.parse("1+3"));
            console.log(ast.stringify(ast.parse("1+3")));
            console.log("DONE")
          })
          .catch(function(err) { console.log(String(err.stack)); console.error("ERROR", err); });`);

    // testNodejsLoad("./dist/lively.ast.es6.bundle.js");
    
    // testNodejsLoad("./dist/lively.ast.es6.bundle.js");

    // testNodejsLoad("./dist/lively.ast.es6.js");
  }

});
