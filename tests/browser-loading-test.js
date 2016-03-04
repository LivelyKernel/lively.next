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

var arr = lang.arr;

function testPageLoad(url, waitForHTMLMatch) {
  return it(`can load ${url}`, () => {
    document.querySelector("#scratch").insertAdjacentHTML("beforeend", `<iframe width="400" height="600" src="${url}"></iframe>`);
    return new Promise((resolve, reject) => {
      var testProcess = setInterval(function() {
        var iframe = document.querySelector("#scratch iframe");
        var log = iframe.contentDocument.body.querySelector("#log");
        var match = log.innerText.match(waitForHTMLMatch);
        if (!match) return;
        clearInterval(testProcess);
        // setTimeout(resolve, 1000);
        resolve();
      }, 200);
    });
  });
}

if (typeof window !== "undefined") {
  describe('browser loading', function() {

    this.timeout(5000);

    afterEach(() => {
      document.querySelector("#scratch").innerHTML = "";
    });

    testPageLoad("test-lively.ast.bundle.html", /DONE$/m);
    // testPageLoad("test-lively.ast.html", /DONE$/m);
    // testPageLoad("test-lively.ast.es6.bundle.html", /DONE$/m);
    // testPageLoad("test-lively.ast.es6.html", /DONE$/m);
  });
}
