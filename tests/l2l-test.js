/*global beforeEach, afterEach, before, after, describe, it*/

import { expect } from "mocha-es6";

import { promise } from "lively.lang";
import L2LTracker from "../tracker.js";
import L2LClient from "../client.js";
import { ensure as serverEnsure, close as serverClose } from "lively.server/server.js"

var hostname = "localhost", port = 9009, namespace = "l2l-test";
var testServer, tracker, client1;

describe('l2l', function() {

  before(async () => testServer = await serverEnsure({port, hostname}));
  after(async () => serverClose(testServer));

  beforeEach(async () => {
    var url = `http://${hostname}:${port}${testServer.io.path()}`;
    tracker = await L2LTracker.ensure(Object.assign({namespace}, testServer));
    client1 = await L2LClient.ensure({url, namespace});
    await client1.whenRegistered(300);
  });

  afterEach(async () => {
    client1 && await client1.remove();
    tracker && await tracker.remove();
  });

  it("client registers and gets own id and tracker id", async () => {
    expect(client1.isOnline()).equals(true, "1: isOnline");

    expect(client1.isRegistered()).equals(true, "2: isRegistered");

    expect(client1).property("id").is.a("string");
    expect(client1).property("trackerId").is.a("string");
    expect(tracker.id).equals(client1.trackerId);

    expect().assert(tracker.clients.has(client1.id), "client1 not in tracker clients");
    expect(tracker.clients.get(client1.id)).deep.equals({socketId: client1.socketId});
  });

  it("client unregisters", async () => {
    expect(client1.isRegistered()).equals(true, 1);
    await client1.unregister();
    expect(client1.isRegistered()).equals(false, 2);
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
  

  describe("failure handling", () => {
  
    it('handler does not call ack', async () => {
      var trackerReceived = [];
      tracker.addService("test", (tracker, msg, ackFn, sender) => {/*nothing*/});
      tracker.addService("test-2", (tracker, msg, ackFn, sender) => { ackFn("OK"); });
      try {
        await client1.sendToAndWait(tracker.id, "test", {})
        expect().assert(false, "sending 'test' did not throw")
      } catch (e) { expect(e).match(/timeout/i); }
      expect(await client1.sendToAndWait(tracker.id, "test-2", {})).property("data", "OK");
    });


    it("switching tracker", async () => {
      console.log("tracker going down")
      await tracker.remove();
      await promise.delay(300);
      console.log("tracker down")
      expect().assert(!client1.isOnline(), "client still connected");
      expect().assert(!client1.isRegistered(), "client still registered");
      var newTracker = await L2LTracker.ensure({namespace, ...testServer});
      await newTracker.open()
      expect(newTracker).not.equals(tracker, "no new tracker created");
      client1.trackerId
      await client1.whenRegistered(300);
    });
  });


});
