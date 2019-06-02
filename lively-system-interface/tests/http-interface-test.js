/*global describe, it, before, after*/
import { expect } from "mocha-es6";
import { startServer } from "./http-server-for-interface.js";
import { serverInterfaceFor } from "../index.js";

describe("http lively-system-interface", function () {

  this.timeout(30*1000);

  var server, system;
  before(async () => {
    server = (await startServer("/lively-tester", 3011)).server;
    system = serverInterfaceFor("http://localhost:3011/lively-tester")
  });

  after(async () => {
    await server.kill();
  });

  it("evals on server", async () => {
    var {value} = await system.runEval("1+3", {targetModule: "lively://foo/bar"});
    expect(value).equals('4');
  });

});
