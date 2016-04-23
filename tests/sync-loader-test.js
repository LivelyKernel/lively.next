/*global System, beforeEach, afterEach, describe, it*/

import { expect } from "mocha-es6";

import { getSystem, removeSystem, moduleRecordFor, moduleEnv, sourceOf } from "../src/system.js";
import { importSync } from "../src/sync-loader.js";

function defineEntries(System, loadLog) {
  // a -> b <-> c
  System.register('a.js', ['./b.js'], function (_export) {
    'use strict';
    loadLog.push("declared a");
    var b;
    return {
      setters: [_b => { loadLog.push("setters in a"); b = _b.default; }],
      execute: function () { loadLog.push("body a"); _export('default', "exported from a, " + b); }};
  })
  
  System.register('b.js', ['./c.js'], function (_export) {
    'use strict';
    loadLog.push("declared b");
    var c;
    return {
      setters: [_c => { loadLog.push("setters in b"); c = _c.default; }],
      execute: function() { loadLog.push("body b"); _export('default', "exported from b, " + c); }};
  })
  
  System.register('c.js', ["./b.js"], function (_export) {
    'use strict';
    loadLog.push("declared c");
    var b;
    return {
      setters: [_b => { loadLog.push("setters in c"); b = _b.default; }],
      execute: function() { loadLog.push("body c"); _export('default', "exported from c"); }};
  })

}

describe("sync loader", () => {

  var S;
  beforeEach(() => S = getSystem("lang-test"));
  afterEach(() => removeSystem("lang-test"));
  
  it("loads register-modules right away", () => {
    var log = [];
    defineEntries(S, log);
    var exported = importSync(S, "a");
    expect(exported.default).to.equal("exported from a, exported from b, exported from c");
    expect(log.join(",")).to.equal('declared c,declared b,setters in b,setters in c,declared a,setters in a,body c,setters in b,body b,setters in c,setters in a,body a');
  });

});
