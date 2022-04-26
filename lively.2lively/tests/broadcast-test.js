/* global beforeEach, afterEach, before, after, describe, it */
import { expect } from 'mocha-es6';
import { promise } from 'lively.lang';
import L2LTracker from '../tracker.js';
import L2LClient from '../client.js';

import LivelyServer from 'lively.server/server.js';
import CorsPlugin from 'lively.server/plugins/cors.js';
import SocketioPlugin from 'lively.server/plugins/socketio.js';
import L2lPlugin from 'lively.server/plugins/l2l.js';

let hostname = 'localhost';
let port = 9009;
let namespace = 'l2l-test';

let testServer, tracker, client1, client2,
  io, url;

async function startServer () {
  let server = LivelyServer.ensure({ port, hostname });
  await server.addPlugins([new CorsPlugin(), new SocketioPlugin(), new L2lPlugin()]);
  return await server.whenStarted();
}

async function startTracker (server, port, hostname) {
  await server.whenStarted();
  io = server.findPlugin('socketio').io;
  url = `http://${hostname}:${port}${io.path()}`;
  let tracker = await L2LTracker.ensure({ namespace, hostname, port, io });
  server.findPlugin('l2l').setOptions({ l2lNamespace: namespace, l2lTracker: tracker });
  await server.whenStarted();
  return tracker;
}

describe('l2l broadcast', function () {
  this.timeout(20000);

  before(async () => {
    testServer = await startServer();
  });

  after(async () => {
    await testServer.close();
    await testServer.whenClosed();
  });

  beforeEach(async () => {
    tracker = await startTracker(testServer, port, hostname);
    client1 = await L2LClient.ensure({ url, namespace });
    await client1.whenRegistered(300);
    console.log('...START');
  });

  afterEach(async () => {
    console.log('...STOP');
    client1 && await client1.remove();
    client2 && await client2.remove();
    tracker && await tracker.remove();
  });

  it('can connect to default room', async () => {
    let namespace = '/l2l-test';
    let id = client1.socketId;
    let contents = io._nsps.get(namespace).adapter.rooms.get('defaultRoom');
    expect(contents.has(id)).equals(true);
  });

  it('can connect to custom room and receive broadcast', async () => {
    let client1Received = [];
    client1.addService('test', (tracker, msg, ackFn, sender) => client1Received.push(msg));
    client1.joinRoom('testRoom');
    client1.broadcast('testRoom', 'test', { payload: 'test for broadcast message' }, true/* system */);

    await promise.waitFor(200, () => client1Received.length === 1);

    expect(client1Received).deep.equals([{
      action: 'test',
      broadcast: true,
      data: { payload: 'test for broadcast message' },
      sender: client1.id
    }]);

    let namespace = '/l2l-test';
    let contents = io._nsps.get(namespace).adapter.rooms.get('testRoom');
    expect(contents.has(client1.socketId)).equals(true);
  });

  it('client can exit room correctly', async () => {
    await client1.joinRoom('testRoom');

    let data = await client1.listRoomMembers('testRoom');
    expect(data).deep.equals({
      length: 1,
      room: 'testRoom',
      sockets: { [client1.socketId]: true }
    });

    await client1.leaveRoom('testRoom');

    data = await client1.listRoomMembers('testRoom');
    expect(data).deep.equals({ length: 0, room: 'testRoom', sockets: {} });
  });

  describe('to other client', () => {
    beforeEach(async () => {
      await testServer.whenStarted();
      client2 = await L2LClient.create({ url, namespace });
      await client2.whenRegistered();
    });

    it('sends broadcast without sending to himself', async () => {
      let client1Received = []; let client2Received = [];
      client1.addService('test', (tracker, msg, ackFn, sender) => client1Received.push(msg));
      client2.addService('test', (tracker, msg, ackFn, sender) => client2Received.push(msg));
      await client1.joinRoom('testRoom');
      await client2.joinRoom('testRoom');

      client1.broadcast('testRoom', 'test', { payload: 'test for broadcast message' });

      await promise.waitFor(5000, () => client2Received.length);

      expect(client1Received).deep.equals([]);

      expect(client2Received).deep.equals([{
        action: 'test',
        broadcast: true,
        data: { payload: 'test for broadcast message' },
        sender: client1.id
      }]);
    });
  });

  describe('multi server', () => {
    let debug = false;
    let port2 = 9008; let port3 = 9007;
    let testServer2; let testServer3;
    let client3; let client4;
    let client4Received; let client3Received; let client1Received;

    beforeEach(async () => {
      // Create Server 2
      testServer2 = await LivelyServer.ensure({ port: port2, hostname, debug });
      await testServer2.addPlugins([new CorsPlugin(), new SocketioPlugin(), new L2lPlugin()]);
      await startTracker(testServer2, port2, hostname);

      testServer3 = await LivelyServer.ensure({ port: port3, hostname, debug });
      await testServer3.addPlugins([new CorsPlugin(), new SocketioPlugin(), new L2lPlugin()]);
      await startTracker(testServer3, port3, hostname);

      // // Set up Handler for client 1
      client1Received = [];
      client1.addService('test', (tracker, msg, ackFn, sender) => client1Received.push(msg));
      await client1.joinRoom('testRoom');

      // // Create Client 3
      let url3 = `http://${hostname}:${port2}/lively-socket.io`;
      client3Received = [];
      client3 = await L2LClient.ensure({ url: url3, namespace });
      client3.addService('test', (tracker, msg, ackFn, sender) => client3Received.push(msg));
      await client3.whenRegistered();
      await client3.joinRoom('testRoom');

      // Create Client 4
      let url4 = `http://${hostname}:${port3}/lively-socket.io`;
      client4Received = [];
      client4 = await L2LClient.ensure({ url: url4, namespace });
      client4.addService('test', (tracker, msg, ackFn, sender) => client4Received.push(msg));
      await client3.whenRegistered();
      await client4.joinRoom('testRoom');
    });

    after(async () => {
      client3 && await client3.remove();
      client4 && await client4.remove();

      if (testServer2) {
        LivelyServer.servers.delete(LivelyServer._key({ port: port2, hostname }));
        testServer2.close();
        await testServer2.whenClosed();
      }
      if (testServer3) {
        LivelyServer.servers.delete(LivelyServer._key({ port: port3, hostname }));
        testServer3.close();
        await testServer3.whenClosed();
      }
    });

    it('send broadcast message from server to server without sending to himself', async () => {
      await promise.waitFor(1000, () => (client3.trackerId), {});
      await promise.waitFor(1000, () => (client4.trackerId), {});

      expect(client3.trackerId === testServer2.findPlugin('Lively2LivelyPlugin').l2lTracker.id)
        .equals(true, 'Expect Client 3 to connect to Tracker 2');

      expect(client4.trackerId === testServer3.findPlugin('Lively2LivelyPlugin').l2lTracker.id)
        .equals(true, 'Expect Client 4 to connect to Tracker 3');

      // Client 3 sends system broadcast
      client3.broadcast('testRoom', 'test',
        { payload: 'test for broadcast message' }, false, true);

      await promise.waitFor(200, () => (client3Received.length > 1), {});
      expect(client3Received).length(0, 'Sender should not receive it');

      // Others should receive
      await promise.waitFor(200, () => (client4Received.length > 0), {});
      expect(client4Received[0].data).deep.equals({ payload: 'test for broadcast message' });
      await promise.waitFor(200, () => (client1Received.length > 0), {});
      expect(client1Received[0].data).deep.equals({ payload: 'test for broadcast message' });
    });
  });
});
