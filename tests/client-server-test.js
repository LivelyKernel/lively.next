/*global beforeEach, afterEach, before, after, describe, it*/

import { expect } from "mocha-es6";

import { promise } from "lively.lang";

import L2LTracker from "lively.2lively/tracker.js";
import L2LClient from "lively.2lively/client.js";
import { ensure as serverEnsure, close as serverClose } from "lively.server/server.js"

import ServerCommand from "../server-command.js";
import ClientCommand from "../client-command.js";

var hostname = "localhost", port = 9012, ioNamespace = "lively.shell-test";
var testServer, l2lTracker, l2lClient;

async function setup() {
  testServer = await serverEnsure({port, hostname})
  l2lTracker = await L2LTracker.ensure({namespace: ioNamespace, ...testServer});
  l2lClient = await L2LClient.ensure({
    url: `http://${hostname}:${port}${testServer.io.path()}`,
    namespace: ioNamespace
  });
  ServerCommand.installLively2LivelyServices(l2lTracker);
  ClientCommand.installLively2LivelyServices(l2lClient);
  await l2lClient.whenRegistered(300);
}

async function teardown() {
  l2lClient && await l2lClient.remove();
  l2lTracker && await l2lTracker.remove();
  await serverClose(testServer);
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
