/*global require, before, after, beforeEach, afterEach, describe, it*/

var env = typeof module !== "undefined" && module.require ? module.require("../env") : window;
var chai = env.isCommonJS ? module.require("chai") : window.chai;
var chaiSubset = env.isCommonJS ? module.require("chai-subset") : window.chaiSubset;
var expect = chai.expect; chaiSubset && chai.use(chaiSubset);

describe("bootstrap", function() {
  this.timeout(5000);
  
  it("vm in node", () =>
    new Promise(function(resolve, reject)  {
      var fork = require("child_process").fork,
          proc = fork("bootstrap-nodejs.js", {cwd: __dirname + "/..", silent: true}),
          out = "";
      proc.on("error", reject);
      proc.on("exit", function() { resolve(out); });
      proc.stdout.on("data", d => out += String(d));
    })
    .then(out => expect(out).to.match(/\nDONE\n/m)))
});
