/*global beforeEach, afterEach, before, after, describe, it,xdescribe,authserver,xit*/

import { expect } from "mocha-es6";
import { promise } from "lively.lang";
import L2LTracker from "../tracker.js";
import L2LClient from "../client.js";

import LivelyServer from "lively.server/server.js";
import CorsPlugin from "lively.server/plugins/cors.js";
import SocketioPlugin from "lively.server/plugins/socketio.js";
import L2lPlugin from "lively.server/plugins/l2l.js";

let hostname = "localhost",
    port = 9009,
    namespace = "l2l-test";

var testServer, tracker, client1, client2,
    io, url;


async function startServer() {
  let server = LivelyServer.ensure({port, hostname});
  await server.addPlugins([new CorsPlugin(), new SocketioPlugin(), new L2lPlugin()]);
  return await server.whenStarted();
}

async function startTracker(server) {
  await server.whenStarted();
  io = server.findPlugin("socketio").io;
  url = `http://${hostname}:${port}${io.path()}`;
  let tracker = await L2LTracker.ensure({namespace, hostname, port, io});
  server.findPlugin('l2l').setOptions({l2lNamespace: namespace, l2lTracker: tracker})
  await server.whenStarted();
  return tracker;
}

describe('l2l', function() {

  this.timeout(5000);

  before(async () => {
    testServer = await startServer();
  });

  after(async () => {
    await testServer.close();
    await testServer.whenClosed();
  });

  beforeEach(async () => {
    tracker = await startTracker(testServer);
    client1 = await L2LClient.ensure({url, namespace,});
    await client1.register()
    await client1.whenRegistered(300);
    console.log("...START");
  });

  afterEach(async () => {
    console.log("...STOP");
    client1 && await client1.remove();
    client2 && await client2.remove();
    tracker && await tracker.remove();
  });

  describe("between client and tracker", () => {

    it("client registers and gets own id and tracker id", async () => {
      expect(client1.isOnline()).equals(true, "1: isOnline");

      expect(client1.isRegistered()).equals(true, "2: isRegistered");

      expect(client1).property("id").is.a("string");
      expect(client1).property("trackerId").is.a("string");
      expect(tracker.id).equals(client1.trackerId);

      expect().assert(tracker.clients.has(client1.id), "client1 not in tracker clients");
      expect(tracker.clients.get(client1.id)).containSubset({
        socketId: client1.socketId,
        registeredAt: {},
        info: {type: "l2l node", userName: "unknown"}
      });
    });

    it("client emits status events", async () => {
      client2 = await L2LClient.create({url, namespace, autoOpen: false});

      client2.on("connected", () => console.log("CONNECTED"));
      client2.on("registered", () => console.log("REGISTERED"));
      client2.on("disconnected", () => console.log("DISCONNECTED"));

      let connected = false;
      client2.once("connected", () => connected = true);
      client2.open();
      await promise.waitFor(1000, () => connected);

      let registered = false;
      client2.once("registered", () => registered = true);
      client2.register();

      await promise.waitFor(1000, () => registered);
      
      let disconnected = false;
      client2.once("disconnected", () => disconnected = true);
      
      testServer.close();
      await promise.waitFor(1000, () => disconnected);

      let connectedAgain = false;
      client2.once("connected", () => connectedAgain = true);
      
      tracker = await startTracker(await startServer().then(s => testServer = s));
      await promise.waitFor(4000, () => connectedAgain);
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

    it('mutliple messages at once', async () => {
      var counter = 0;
      tracker.addService("test", (tracker, msg, ackFn, sender) => ackFn(++counter));
      var answers = await Promise.all([
        client1.sendToAndWait(tracker.id, "test", {}),
        client1.sendToAndWait(tracker.id, "test", {}),
        client1.sendToAndWait(tracker.id, "test", {})
      ]);
      expect(answers.map(ea => ea.data)).deep.equals([1,2,3]);
    });

  });

  xit('client gets list of all trackers', async () => {
    // FIXME...!
    var trackers = tracker.getTrackerList()
    console.log(trackers.length)
    expect(trackers.length).greaterThan(0)
    return;
  });

  describe("client-to-client", () => {

    beforeEach(async () => {
      await testServer.whenStarted();
      let origin = `http://${hostname}:${port}`, path = io.path();
      client2 = await L2LClient.create({url, namespace});
      await client2.whenRegistered();
    });

    it("sends message and gets answer back", async () => {
      let client2Received = [];
      client2.addService("test", (tracker, msg, ackFn, sender) => {
        client2Received.push(msg); ackFn("got it"); });

      let msg = {
        action: "test", target: client2.id,
        data: {payload: "for test"},
        messageId: "test-message-1"
      }, answer = await client1.sendAndWait(msg);

      expect(client2Received).deep.equals([msg]);

      expect(answer).containSubset({
        action: "test-response", target: client1.id, data: "got it",
        sender: client2.id, inResponseTo: "test-message-1"
      });

    });

    it("sends message without answer", async () => {
      var client2Received = [], ackFnSeen;
      client2.addService("test", (tracker, msg, ackFn, sender) => {
        client2Received.push(msg); ackFnSeen = typeof ackFn === "function"; });

      var msg = {
        action: "test", target: client2.id,
        data: {payload: "for test"},
        messageId: "test-message-1"
      }
      client1.send(msg);

      await promise.waitFor(200, () => !!client2Received.length);

      expect(client2Received).deep.equals([msg]);
      expect(ackFnSeen).equals(false, "ackFn was passed to client2 even though no answer was requested");
    });

  });

  describe("failure handling", () => {

    it('handler does not call ack', async () => {
      console.log('START')
      var trackerReceived = [];
      tracker.addService("test", (tracker, msg, ackFn, sender) => {/*nothing*/});
      tracker.addService("test-2", (tracker, msg, ackFn, sender) => { ackFn("OK"); });
      var answer = await client1.sendToAndWait(tracker.id, "test", {});
      expect(answer).deep.property("data.isError");
      expect(answer).deep.property("data.error").match(/timeout/i)
      expect(await client1.sendToAndWait(tracker.id, "test-2", {})).property("data", "OK");
    });

    it("switching tracker", async () => {
      console.log("tracker going down");
      await tracker.remove();
      await promise.delay(300);
      console.log("tracker down");
      expect().assert(!client1.isOnline(), "client still connected");
      expect().assert(!client1.isRegistered(), "client still registered");
      var newTracker = await L2LTracker.ensure({namespace, hostname, port, io: tracker.io});
      await newTracker.open()
      console.log("tracker re-opened");
      expect(newTracker).not.equals(tracker, "no new tracker created");
      await client1.whenRegistered(3000);
    });

  });

});
