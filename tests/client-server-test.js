/*global beforeEach, afterEach, before, after, describe, it*/

import { expect } from "mocha-es6";

import { promise } from "lively.lang";

import L2LClient from "lively.2lively/client.js";

import LivelyServer from "lively.server/server.js"
import CorsPlugin from "lively.server/plugins/cors.js";
import SocketioPlugin from "lively.server/plugins/socketio.js";
import EvalPlugin from "lively.server/plugins/eval.js";
import L2lPlugin from "lively.server/plugins/l2l.js";
import ShellPlugin from "lively.server/plugins/remote-shell.js";

import ServerCommand from "../server-command.js";
import ClientCommand from "../client-command.js";

var hostname = "localhost", port = 9012, ioNamespace = "lively.shell-test";
var testServer, l2lTracker, l2lClient;


async function setup() {
  testServer = LivelyServer.ensure({port, hostname, l2l: {l2lNamespace: ioNamespace}});
  await testServer.whenStarted();
  await testServer.addPlugins([
    new CorsPlugin(),
    new SocketioPlugin(),
    new ShellPlugin(),
    new L2lPlugin()
  ]);

  var io = testServer.findPlugin("socketio").io;
  var url = `http://${hostname}:${port}${io.path()}`;
  l2lClient = await L2LClient.ensure({url, namespace: ioNamespace});
  ClientCommand.installLively2LivelyServices(l2lClient);
  await l2lClient.whenRegistered(300);
}

async function teardown() {
  l2lClient && await l2lClient.remove();

  testServer.close();
  await testServer.whenClosed();
}

describe('lively.shell', function() {

  before(() => setup());
  after(() => teardown());

  it("can run a simple command", async () => {
    var client = new ClientCommand(l2lClient);
    await client.spawn({command: "echo hello"});
    await client.whenDone();
    expect(client.stdout).equals("hello\n")
  });

  it("kills command", async () => {
    var cmd = new ClientCommand(l2lClient);
    await cmd.spawn({command: "echo 1; sleep 1; echo 2; sleep 2; echo 3"});
    await cmd.whenStarted();
    await cmd.kill();
    expect(cmd.stdout).equals("1\n")
  });

  it("sends input to command", async () => {
    var cmd = new ClientCommand(l2lClient);
    await cmd.spawn({command: "read a; echo $a"});
    await cmd.whenStarted();
    await cmd.writeToStdin("aaa");
    cmd.writeToStdin("bbb\n");
    await cmd.whenDone()
    expect(cmd.stdout).equals("aaabbb\n")
  });

});
