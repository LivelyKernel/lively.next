/*global beforeEach, afterEach, before, after, describe, it*/

import { expect } from "mocha-es6";

import { resource } from "lively.resources";
import ioClient from "socket.io-client";
import { ensure as serverEnsure, close as serverClose } from "../server.js";

var hostname = "localhost", port = 9009, testServer;
var tracker, client1;

describe('lively.server', function() {

  before(async () => testServer = await serverEnsure({port, hostname}));
  after(() => serverClose(testServer));

  it("runs and accepts requests", async () => {
    expect(async () => {
      await resource(`http://${hostname}:${port}`).read();
    }).not.to.throw();
  });

  it("has socket.io server", async () => {
    var {io: ioServer} = testServer;
    ioServer.on("connection", (socket) => {
      socket.on("test", (evt, ackFn) => ackFn("OK"));
    });
    var clientSocket = ioClient(`http://${hostname}:${port}`, {path: ioServer.path()}),
        answer = await new Promise(resolve => clientSocket.emit("test", {}, resolve));
    expect(answer).equals("OK");
  });
});
