/*global beforeEach, afterEach, before, after, describe, it*/

import { expect } from "mocha-es6";

import Tracker from "../l2l/tracker.js";
import Client from "../l2l/client.js";
import { ensure as serverEnsure, close as serverClose } from "../server.js"

var hostname = "localhost", port = 9009, testServer;
var tracker, client1;

describe('l2l', function() {

  before(async () => testServer = await serverEnsure({port, hostname}));
  after(async () => serverClose(testServer));

  beforeEach(async () => {
    tracker = await Tracker.namespace("l2l-test", testServer);
    client1 = await Client.open(`http://${hostname}:${port}/lively.com`, {namespace: "l2l-test"});
    await tracker.open();
    await client1.open();
  });

  afterEach(async () => {
    if (client1) await client1.remove();
    if (tracker) await tracker.remove();
  });

  it("client registers and gets own id and tracker id", async () => {
    expect(client1.isOnline()).equals(true, "1: isOnline");

    expect(client1.isRegistered()).equals(false, "2: isRegistered");
    await client1.register();
    expect(client1.isRegistered()).equals(true, "3: isRegistered");

    expect(client1).property("id").is.a("string");
    expect(client1).property("trackerId").is.a("string");
    expect(tracker.id).equals(client1.trackerId);

    expect().assert(tracker.clients.has(client1.id), "client1 not in tracker clients");
    expect(tracker.clients.get(client1.id)).deep.equals({socketId: client1.socketId});
  });

  it("client unregisters", async () => {
    await client1.register();
    expect(client1.isRegistered()).equals(true);
    await client1.unregister();
    expect(client1.isRegistered()).equals(false);
    expect().assert(!tracker.clients.has(client1.id), "client1 still in tracker clients");
  });

  it('custom action in tracker', async () => {
    var trackerReceived = [];
    tracker.addService("test", (tracker, msg, ackFn, sender) => {
      trackerReceived.push(msg);
      ackFn("got it");
    });

    var msg = {
      action: "test", target: tracker.id,
      data: {payload: "for test"},
      messageId: "test-message-1"
    }, answer = await client1.sendAndWait(msg);

    expect(trackerReceived).deep.equals([msg]);

    expect(answer).containSubset({
      action: "test-response", target: client1.id, data: "got it",
      sender: tracker.id, inResponseTo: "test-message-1"
    });
  });

  it('custom action in client', async () => {
    await client1.register();

    var client1Received = [];
    client1.addService("test", (tracker, msg, ackFn, sender) => {
      client1Received.push(msg);
      ackFn("got it");
    });

    var msg = {
          action: "test", target: client1.id,
          data: {payload: "for test"},
          messageId: "test-message-1"
        },
        answer = await tracker.sendAndWait(msg);

    expect(client1Received).deep.equals([msg]);

    expect(answer).containSubset({
      action: "test-response", target: tracker.id, data: "got it",
      sender: client1.id, inResponseTo: "test-message-1"
    });
  });

});
