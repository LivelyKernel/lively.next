/*global beforeEach, afterEach, before, after, describe, it*/

import { expect } from "mocha-es6";

import { promise } from "lively.lang";

import L2LClient from "lively.2lively/client.js";

import LivelyServer from "lively.server/server.js"
import CorsPlugin from "lively.server/plugins/cors.js";
import SocketioPlugin from "lively.server/plugins/socketio.js";
import L2lPlugin from "lively.server/plugins/l2l.js";
import ShellPlugin from "lively.server/plugins/remote-shell.js";

import ServerCommand from "../server-command.js";
import ClientCommand from "../client-command.js";
import ShellClientResource from "../client-resource.js";

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

import { join } from "path";
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, rmdirSync } from "fs";
var shellProjDir = System.decanonicalize("lively.shell/").replace("file://", "");
var testDir = join(shellProjDir, "test-tmp-dir");

describe('shell client resource', function() {

  before(() => setup());
  after(() => teardown());

  describe("with test dir", () => {

    beforeEach(() => {
      mkdirSync(testDir);
      mkdirSync(join(testDir, "subdir"));
      mkdirSync(join(testDir, "subdir/subsubdir"));
      writeFileSync(join(testDir, "foo.txt"), "hello\nworld");
      writeFileSync(join(testDir, "subdir/bar.txt"), "i'm bar");
      writeFileSync(join(testDir, "subdir/subsubdir/zork.txt"), "i'm zork");
    });

    afterEach(() => {
      var f = join(testDir, "foo.txt"); existsSync(f) && unlinkSync(f);
      var f = join(testDir, "foo2.txt"); existsSync(f) && unlinkSync(f);
      var f = join(testDir, "subdir/bar.txt"); existsSync(f) && unlinkSync(f);
      var f = join(testDir, "subdir/subsubdir/zork.txt"); existsSync(f) && unlinkSync(f);
      var d = join(testDir, "subdir/subsubdir"); existsSync(d) && rmdirSync(d);
      var d = join(testDir, "subdir"); existsSync(d) && rmdirSync(d);
      var d = testDir; existsSync(d) && rmdirSync(d);
    })


    it("can read files", async () => {
      var res = new ShellClientResource(join(testDir, "foo.txt"), l2lClient),
          content = await res.read();
      expect(content).equals("hello\nworld");
    });

    it("can write files", async () => {
      var f = join(testDir, "foo2.txt"),
          res = new ShellClientResource(f, l2lClient);
      await res.write("xxx");
      expect(String(readFileSync(f))).equals("xxx");
    });

    it("can remove files", async () => {
      var f = join(testDir, "foo.txt");
      expect(existsSync(f)).equals(true, "1");
      await new ShellClientResource(f, l2lClient).remove();
      expect(existsSync(f)).equals(false, "1");

      var d = join(testDir, "subdir")
      expect(existsSync(d)).equals(true, "1");
      await new ShellClientResource(d, l2lClient).remove();
      expect(existsSync(d)).equals(false, "2");

      expect(existsSync(testDir)).equals(true, "1");
    });

    it("can reads dir list", async () => {
      var list = await new ShellClientResource(testDir, l2lClient).dirList();
      expect(list.map(ea => ea.url)).deep.equals([join(testDir, "foo.txt"), join(testDir, "subdir/")])

      var list = await new ShellClientResource(testDir, l2lClient).dirList("infinity");
      expect(list.map(ea => ea.url).sort()).deep.equals([
        join(testDir, "foo.txt"),
        join(testDir, "subdir/"),
        join(testDir, "subdir/bar.txt"),
        join(testDir, "subdir/subsubdir/"),
        join(testDir, "subdir/subsubdir/zork.txt")
      ].sort());
    })
  });

});
