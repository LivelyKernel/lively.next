/*global require, before, after, beforeEach, afterEach, describe, it*/

import { expect } from "chai";
import * as vm from "lively.vm";
import lang from "lively.lang";
import { fork } from "child_process"

if (System.get("@system-env").node) {

describe("bootstrap", function() {
  this.timeout(5000);
  
  it("vm in node", () =>
    new Promise(function(resolve, reject)  {
      var proc = fork("bootstrap-nodejs.js", {cwd: "..", silent: true}),
          out = "";
      proc.on("error", reject);
      proc.on("exit", function() { resolve(out); });
      proc.stdout.on("data", d => out += String(d));
    })
    .then(out => expect(out).to.match(/\nDONE\n/m)))
});

}