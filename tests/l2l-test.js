/*global beforeEach, afterEach, before, after, describe, it*/

import { expect } from "mocha-es6";

import { promise } from "lively.lang";
import L2LTracker from "../tracker.js";
import L2LClient from "../client.js";

import LivelyServer from "lively.server/server.js";
import CorsPlugin from "lively.server/plugins/cors.js";
import SocketioPlugin from "lively.server/plugins/socketio.js";
// import L2lPlugin from "lively.server/plugins/l2l.js";


var hostname = "localhost", port = 9009, namespace = "l2l-test", url;
var testServer, tracker, client1;


describe('l2l', function() {

  before(async () => {
    testServer = LivelyServer.ensure({port, hostname});
    await testServer.addPlugins([new CorsPlugin(), new SocketioPlugin()]);
    await testServer.whenStarted();
  });

  after(async () => {
    testServer.close();
    await testServer.whenClosed();
  });


  beforeEach(async () => {
    await testServer.whenStarted();
    var io = testServer.findPlugin("socketio").io;
    url = `http://${hostname}:${port}${io.path()}`;
    tracker = await L2LTracker.ensure({namespace, hostname, port, io});
    client1 = await L2LClient.ensure({url, namespace});
    await client1.whenRegistered(300);
  });

  afterEach(async () => {
    client1 && await client1.remove();
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

    it('can connect to default room', async () => {
      var io = testServer.findPlugin("socketio").io;
      var namespace = '/l2l-test'
      var id = client1.socketId
      var contents = io.nsps[namespace].adapter.rooms['defaultRoom']
      expect(contents.sockets.hasOwnProperty(id)).equals(true)
    })

  });


  describe("client-to-client", () => {

    var client2;       

    beforeEach(async () => { 
    await testServer.whenStarted();
    var io = testServer.findPlugin("socketio").io;    
    var origin = `http://${hostname}:${port}`,
        path = io.path()
        // namespace = '/l2l-test'    
    
      client2 = new L2LClient(origin,path,namespace);
      client2.open();
      client2.register();
      await client2.whenRegistered();      
    });
    afterEach(async () => client2 && await client2.remove());

    it("sends message and gets answer back", async () => {

      var client2Received = [];
      client2.addService("test", (tracker, msg, ackFn, sender) => {
        client2Received.push(msg); ackFn("got it"); });

      var msg = {
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

      await promise.waitFor(200, () => !!client2Received.length)

      expect(client2Received).deep.equals([msg]);
      expect(ackFnSeen).equals(false, "ackFn was passed to client2 even though no answer was requested");
    });

  });

  describe("failure handling", () => {

    it('handler does not call ack', async () => {
      var trackerReceived = [];
      tracker.addService("test", (tracker, msg, ackFn, sender) => {/*nothing*/});
      tracker.addService("test-2", (tracker, msg, ackFn, sender) => { ackFn("OK"); });
      var answer = await client1.sendToAndWait(tracker.id, "test", {})
      expect(answer).deep.property("data.isError");
      expect(answer).deep.property("data.error").match(/timeout/i)
      expect(await client1.sendToAndWait(tracker.id, "test-2", {})).property("data", "OK");
    });


    it("switching tracker", async () => {
      console.log("tracker going down")
      await tracker.remove();
      await promise.delay(300);
      console.log("tracker down")
      expect().assert(!client1.isOnline(), "client still connected");
      expect().assert(!client1.isRegistered(), "client still registered");
      var newTracker = await L2LTracker.ensure({namespace, hostname, port, io: tracker.io});
      await newTracker.open()
      expect(newTracker).not.equals(tracker, "no new tracker created");
      client1.trackerId
      await client1.whenRegistered(300);
    });
  });


});
