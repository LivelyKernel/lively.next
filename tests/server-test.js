/*global beforeEach, afterEach, before, after, describe, it*/

import { expect } from "mocha-es6";

import { resource, ensureFetch } from "lively.resources";
import ioClient from "socket.io-client";
import LivelyServer from "../server.js";

// Array.from(LivelyServer.servers.keys())

var hostname = "localhost", port = 9009, testServer;
var tracker, client1;

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
import CorsPlugin from "../plugins/cors.js";
import SocketioPlugin from "../plugins/socketio.js";
import EvalPlugin from "../plugins/eval.js";
import L2lPlugin from "../plugins/l2l.js";
import ShellPlugin from "../plugins/remote-shell.js";
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

describe('lively.server', function() {

  before(async () => {
    await ensureFetch();
    testServer = LivelyServer.ensure({port, hostname});
    await testServer.whenStarted();
  });

  after(async () => {
    testServer.close();
    await testServer.whenClosed();
  });

  it("runs and accepts requests", async () => {
    try {
      await resource(`http://${hostname}:${port}`).read()
    } catch (err) {
      expect().assert(false, `HTTP request to http://${hostname}:${port} failed: ${err}`)
    }
  });

  it("has socket.io server", async () => {
    await testServer.addPlugins([new CorsPlugin(), new SocketioPlugin()]);
    var io = testServer.findPlugin("socketio").io;
    io.on("connection", (socket) => {
      socket.on("test", (evt, ackFn) => ackFn("OK"));
    });
    var clientSocket = ioClient(`http://${hostname}:${port}`, {path: io.path()}),
        answer = await new Promise(resolve => clientSocket.emit("test", {}, resolve));
    expect(answer).equals("OK");
  });

});


describe('lively.server middleware', function() {

  function makePlugin(n) {
    return {
      pluginId: "plugin" + n,
      setOptionsCalled: 0,
      setupCalled: 0,
      closeCalled: 0,
      setOptions() { this.setOptionsCalled++; },
      setup() { this.setupCalled++; },
      close() { this.closeCalled++; }
    };
  }

  var server;
  beforeEach(() => server = new LivelyServer({plugin1: {}}));

  it("finds right order for handlers", () => {
    expect(server.orderPlugins([{pluginId: "foo", after: ["bar"]}, {pluginId: "bar"}]).map(ea => ea.pluginId))
      .equals(["bar", "foo"]);
    expect(server.orderPlugins([{pluginId: "foo", after: ["bar"]}, {pluginId: "bar"}, {pluginId: "zork", before: ["foo"]}]).map(ea => ea.pluginId))
      .equals(["bar", "zork", "foo"]);
    expect(() => server.orderPlugins([{pluginId: "foo", after: ["bar"]}, {pluginId: "bar", after: ["foo"]}]))
      .throws(/could not resolve handlers foo, bar/)
  });

  it("installs and removes plugins", () => {
    var plugin1 = makePlugin(1);

    server.addPlugin(plugin1);
    expect(server.plugins).equals([plugin1]);
    expect(plugin1.setOptionsCalled).equals(1);
    expect(plugin1.setupCalled).equals(1);
    expect(plugin1.closeCalled).equals(0);

    server.removePlugin(plugin1);
    expect(server.plugins).equals([]);
    expect(plugin1.setupCalled).equals(1);
    expect(plugin1.closeCalled).equals(1);
  });

  it("installs plugins in right order", () => {
    var plugin1 = makePlugin(1),
        plugin2 = makePlugin(2);
    plugin2.before = ["plugin1"];

    server.addPlugin(plugin1);
    server.addPlugin(plugin2);
    expect(server.plugins).equals([plugin2, plugin1]);
  });

});
