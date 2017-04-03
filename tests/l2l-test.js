/*global beforeEach, afterEach, before, after, describe, it*/

import { expect } from "mocha-es6";
import { resource } from "lively.resources";
import { promise } from "lively.lang";
import L2LTracker from "../tracker.js";
import L2LClient from "../client.js";

import LivelyServer from "lively.server/server.js";
import CorsPlugin from "lively.server/plugins/cors.js";
import UserPlugin from "lively.server/plugins/user.js";
import SocketioPlugin from "lively.server/plugins/socketio.js";
import L2lPlugin from "lively.server/plugins/l2l.js";

import * as authserver from "lively.user/authserver.js"

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
  await server.addPlugins([new UserPlugin()]);
  await server.whenStarted();
  return tracker;
}

describe('l2l', function() {

  before(() => startServer().then(s => testServer = s));

  after(async () => {
    testServer.close();
    await testServer.whenClosed();
  });

  beforeEach(async () => {
    tracker = await startTracker(testServer);
    client1 = await L2LClient.ensure({url, namespace});
    await client1.whenRegistered(300);
  });

  afterEach(async () => {
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
      expect(tracker.clients.get(client1.id)).deep.equals({socketId: client1.socketId});
    });

    it("client emits status events", async () => {

      let origin = `http://${hostname}:${port}`, path = io.path();
      client2 = new L2LClient(origin, path, namespace);

      client2.on("connected", () => console.log("CONNECTED"));
      client2.on("registered", () => console.log("REGISTERED"));
      client2.on("disconnected", () => console.log("DISCONNECTED"));

      let connected = false;
      client2.once("connected", () => connected = true);
      client2.open();
      await promise.waitFor(300, () => connected);

      let registered = false;
      client2.once("registered", () => registered = true);
      client2.register();
      await promise.waitFor(300, () => registered);

      let disconnected = false;
      client2.once("disconnected", () => disconnected = true);
      testServer.close();
      await promise.waitFor(300, () => disconnected);

      let connectedAgain = false;
      client2.once("connected", () => connectedAgain = true);
      tracker = await startTracker(await startServer().then(s => testServer = s));
      await promise.waitFor(1000, () => connectedAgain);
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
      var namespace = '/l2l-test'
      var id = client1.socketId
      var contents = io.nsps[namespace].adapter.rooms['defaultRoom']
      expect(contents.sockets.hasOwnProperty(id)).equals(true)
    })

    it('can connect to custom room and receive broadcast', async () => {

      var ackFn = function(ans) { console.log(ans); }
      var namespace = '/l2l-test'
      var roomName = 'testRoom'
      var msg = {
        action: "test", target: client1.id,
        data: {payload: "test for broadcast message"},
        messageId: "test-message-1"
      }
      var client1Received = [];

      client1.sendTo(tracker.id,"joinRoom", {roomName: roomName}, ackFn)
      client1.addService("test", (tracker, msg, ackFn, sender) => {
        client1Received.push(msg);});
      [msg, ackFn] = client1.prepareSend(msg, ackFn);
      client1.sendTo(tracker.id,"systemBroadcast", {broadcastMessage: msg, roomName: roomName}, ackFn)
      await promise.waitFor(200, () => client1Received.length == 1);
      var contents = io.nsps[namespace].adapter.rooms[roomName]
      expect(client1Received).deep.equals([msg]);
      expect(contents.sockets.hasOwnProperty(client1.socketId)).equals(true)

    });

    it('client can exit room correctly', async() => {
        var namespace = '/l2l-test'

        client1.sendTo(tracker.id,'joinRoom',{roomName: 'testRoom'},ans => console.log(ans))
        var length = 0;
        var rooms;
        client1.sendTo(tracker.id,'listRoom',{roomName: 'testRoom'},answer => {
          length = answer.data.length
        })
        await promise.waitFor(200, () => length >= 1);
        client1.sendTo(tracker.id,'leaveRoom',{roomName: 'testRoom'},ans => console.log(ans))
        var contents = null
        client1.sendTo(tracker.id,'listRoom',{},answer => {
          contents = answer.data.roomList
        })
        await promise.waitFor(200, () => contents != null)
        expect(contents.hasOwnProperty('testRoom')).equals(false)
    });

    it('receive broadcast message',async () => {
      var client1Received = [];

      client1.addService("test", (tracker, msg, ackFn, sender) => {
        client1Received.push(msg);});

      var msg = {
        action: "test", target: client1.id,
        data: {payload: "test for broadcast message"},
        messageId: "test-message-1"
      }
        var ackFn = function(ans){
          console.log(ans)
        };
        [msg, ackFn] = client1.prepareSend(msg, ackFn);
       client1.sendTo(tracker.id,"systemBroadcast", {broadcastMessage: msg, roomName: 'defaultRoom'}, ackFn)
       await promise.waitFor(200, () => client1Received.length == 1);
      expect(client1Received).deep.equals([msg]);
    })

    it('client gets list of all trackers', async() =>{
      var trackers = tracker.getTrackerList()
      console.log(trackers.length)
      expect(trackers.length).greaterThan(0)
      return

    })
    it('send broadcast message from server to server without sending to himself',async() =>{
      // return;

      var port2 = 9008,port3 = 9007
      var testServer2, testServer3
      var io2, io3;
      var l2l2, l2l3;

      //Create Server 2
      var testServer2 = new LivelyServer({port: port2, namespace: namespace, hostname: hostname, debug: true,plugins: [new CorsPlugin(), new SocketioPlugin(), new L2lPlugin()]}).start();
      await testServer2.whenStarted(300);
      await testServer2.addPlugins([new CorsPlugin(), new SocketioPlugin(), new L2lPlugin()]);

      //Create Server 3
      var testServer3 = new LivelyServer({port: port3, namespace: namespace, hostname: hostname, debug: true, plugins: [new CorsPlugin(), new SocketioPlugin(), new L2lPlugin()]}).start();
      await testServer3.whenStarted(300);
      await testServer3.addPlugins([new CorsPlugin(), new SocketioPlugin(), new L2lPlugin()]);

      //Ensure servers exist and that io can be found on both
      await promise.waitFor(1000, () => Array.from(LivelyServer.servers).length >= 0)
      // console.log(Array.from(LivelyServer.servers))
      await promise.waitFor(1000,() => (testServer2.findPlugin("socketio").io && testServer3.findPlugin("socketio").io))
      io2 = testServer2.findPlugin("socketio").io
      l2l2 = testServer2.findPlugin("Lively2LivelyPlugin")
      io3 = testServer3.findPlugin("socketio").io
      l2l3 = testServer3.findPlugin("Lively2LivelyPlugin")

      //Create tracker on Server 2
      var tracker2 = await L2LTracker.ensure({namespace: namespace, hostname: hostname, port: port2, io: io2});
      await tracker2.open()

      //Create tracker on Server 3
      var tracker3 = await L2LTracker.ensure({namespace: namespace, hostname: hostname, port: port3, io: io3});
      await tracker3.open()


      //Set up Handler for client 1
      var client1Received = [];
      client1.addService("test", (tracker, msg, ackFn, sender) => {
        client1Received.push(msg);});

      //Create Client 3
      var url3 = `http://${hostname}:${port2}/lively-socket.io`;
      var client3 = await L2LClient.ensure({url: url3, namespace: namespace});
      client3.register();
      await client3.whenRegistered(300);

      //Set up Handler for client 3
      var client3Received = [];
      client3.addService("test", (tracker, msg, ackFn, sender) => {
        client3Received.push(msg);});

      //Create Client 4
      var url4 = `http://${hostname}:${port3}/lively-socket.io`;
      var client4 = await L2LClient.ensure({url: url4, namespace: namespace});
      client4.register();
      await client4.whenRegistered(300);

      //set up Handler for clienr 4
      var client4Received = [];
      client4.addService("test", (tracker, msg, ackFn, sender) => {
        client4Received.push(msg);});



      //Expect Client 3 to connect to Tracker 2
      expect(client3.trackerId == tracker2.id).equals(true)

      //Expect Client 4 to connect to Tracker 3
      expect(client4.trackerId == tracker3.id).equals(true)

      //Client Ack Function
      var ackFn = function(ans){
      console.log(ans)
      }
      var roomName = 'defaultRoom'
      //Client 3 sends system broadcast
      var msg = {
        action: "test", target: client3.id,
        data: {payload: "test for broadcast message"},
        messageId: "test-message-1",
        sender: 'xxx',
        n:0
      }

      client3.sendTo(tracker2.id,"multiServerBroadcast", {broadcastMessage: msg, roomName: roomName}, ackFn)



      //Sender should not receive it
      await promise.waitFor(200, () => (client3Received.length == 0));
      expect(client3Received).deep.equals([]);
      //Others should receive
      await promise.waitFor(200, () => (client4Received.length == 1));
      expect(client4Received).deep.equals([msg]);
      await promise.waitFor(200, () => (client1Received.length == 1));
      expect(client1Received).deep.equals([msg]);

      //Disconnect Clients
      await client3.remove();
      await client4.remove();

      //Disconnect Trackers
      await tracker2.remove();
      await tracker3.remove();

      //Disconnect Servers
      await testServer2.close();
      await testServer2.whenClosed();

      await testServer3.close();
      await testServer3.whenClosed();
    })
  });


  describe("client-to-client", () => {

    beforeEach(async () => {
      await testServer.whenStarted();
      let origin = `http://${hostname}:${port}`, path = io.path();
      client2 = new L2LClient(origin, path, namespace);
      client2.open();
      client2.register();
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

      await promise.waitFor(200, () => !!client2Received.length)

      expect(client2Received).deep.equals([msg]);
      expect(ackFnSeen).equals(false, "ackFn was passed to client2 even though no answer was requested");
    });

    it('sends broadcast without sending to himself', async () =>{

        var ackFn = function(ans){
           console.log(ans)
        }

        client1.sendTo(tracker.id,"joinRoom", {roomName: 'testRoom'}, ackFn)
        client2.sendTo(tracker.id,"joinRoom", {roomName: 'testRoom'}, ackFn)

        var client1Received = [];
        client1.addService("test", (tracker, msg, ackFn, sender) => {
        client1Received.push(msg);});

        var client2Received = [];
        client2.addService("test", (tracker, msg, ackFn, sender) => {
        client2Received.push(msg);});

        var msg = {
          action: "test", target: 'testRoom',
          data: {payload: "test for broadcast message"},
          messageId: "test-message-1"
        }
        var ackFn = function(ans){
          console.log(ans)
        }

       [msg, ackFn] = client1.prepareSend(msg, ackFn);
       client1.sendTo(tracker.id,"broadcast", {broadcastMessage: msg, roomName: 'testRoom'}, ackFn)
       await promise.waitFor(200, () => (client1Received.length == 0 && client2Received.length == 1));
       expect(client1Received).deep.equals([]);
       expect(client2Received).deep.equals([msg]);
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



  describe("user integration", () => {
  
    before(async () =>
      authserver.addUser({
        name: "testUser1",
        email: "testuser1@lively-next.org",
        password: "test"
      }, 'adminpassword'));
  
    after(async () =>
      authserver.removeUser({
        name: "testUser1",
        email: "testuser1@lively-next.org"
      }, 'adminpassword'));
  
    it('Ensure anonymous user is created on init without options', async ()=>{
      await promise.delay(100);
      expect(client1.user).to.be.an('object',"user object not present");
      expect(client1.user.name).equals('anonymous',"Username not created as anonymous")
      expect(client1.user.email).equals(null,"null email for anonymous user not present")
      expect(client1.user.token).to.be.an('object','failed token object not present')
    })
  
    it('Determine that a user can be authenticated after creation', async () => {
      await promise.delay(100);
      expect(client1.user.token).to.be.an('object','failed token object not present');
      expect(client1.user.token.status).equals('error','token not showing error state before authentication');
      await client1.authenticate({name: "testUser1", email: "testuser1@lively-next.org", password: "test"});
      var response = await authserver.verify(client1.user);
      expect(response.type).equals('success');
    });
  
    it('Ensure token can be validated', async() => {
       await promise.delay(100);
       await client1.authenticate({name: "testUser1", email: "testuser1@lively-next.org", password: "test"})
       var response = await client1.validateToken(client1.user)
       expect(response.data.type).equals('success')
    });
  });

});
