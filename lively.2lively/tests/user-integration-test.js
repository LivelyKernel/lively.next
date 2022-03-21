// /* global beforeEach, afterEach, before, after, describe, it, xdescribe, authserver,xit */

// import { expect } from 'mocha-es6';
// import { promise } from 'lively.lang';
// import L2LTracker from '../tracker.js';
// import L2LClient from '../client.js';

// import LivelyServer from 'lively.server/server.js';
// import CorsPlugin from 'lively.server/plugins/cors.js';
// import SocketioPlugin from 'lively.server/plugins/socketio.js';
// import L2lPlugin from 'lively.server/plugins/l2l.js';

// let hostname = 'localhost';
// let port = 9009;
// let namespace = 'l2l-test';

// let testServer, tracker, client1, client2,
//   io, url;

// async function startServer () {
//   let server = LivelyServer.ensure({ port, hostname });
//   await server.addPlugins([new CorsPlugin(), new SocketioPlugin(), new L2lPlugin()]);
//   return await server.whenStarted();
// }

// async function startTracker (server) {
//   await server.whenStarted();
//   io = server.findPlugin('socketio').io;
//   url = `http://${hostname}:${port}${io.path()}`;
//   let tracker = await L2LTracker.ensure({ namespace, hostname, port, io });
//   server.findPlugin('l2l').setOptions({ l2lNamespace: namespace, l2lTracker: tracker });
//   await server.whenStarted();
//   return tracker;
// }

// xdescribe('l2l user integration', function () {
//   // rms 3.7.18: This seems to be a stub, since there is no authserver that can be found in the
//   //             codebase as of right now.

//   this.timeout(5000);

//   before(async () => {
//     testServer = await startServer();
//     authserver.addUser({
//       name: 'testUser1',
//       email: 'testuser1@lively-next.org',
//       password: 'test'
//     }, 'adminpassword');
//   });

//   after(async () => {
//     authserver.removeUser({
//       name: 'testUser1',
//       email: 'testuser1@lively-next.org'
//     }, 'adminpassword');
//     await testServer.close();
//     await testServer.whenClosed();
//   });

//   beforeEach(async () => {
//     tracker = await startTracker(testServer);
//     client1 = await L2LClient.ensure({ url, namespace });
//     await client1.register();
//     await client1.whenRegistered(300);
//     console.log('...START');
//   });

//   afterEach(async () => {
//     console.log('...STOP');
//     client1 && await client1.remove();
//     client2 && await client2.remove();
//     tracker && await tracker.remove();
//   });

//   xit('Ensure anonymous user is created on init without options', async () => {
//     await promise.delay(100);
//     expect(client1.user).to.be.an('object', 'user object not present');
//     expect(client1.user.name).equals('anonymous', 'Username not created as anonymous');
//     expect(client1.user.email).equals(null, 'null email for anonymous user not present');
//     expect(client1.user.token).to.be.an('object', 'failed token object not present');
//   });

//   xit('Determine that a user can be authenticated after creation', async () => {
//     await promise.delay(100);
//     expect(client1.user.token).to.be.an('object', 'failed token object not present');
//     expect(client1.user.token.status).equals('error', 'token not showing error state before authentication');
//     await client1.authenticate({ name: 'testUser1', email: 'testuser1@lively-next.org', password: 'test' });
//     let response = await authserver.verify(client1.user);
//     expect(response.type).equals('success');
//   });

//   xit('Ensure token can be validated', async () => {
//     await promise.delay(100);
//     await client1.authenticate({ name: 'testUser1', email: 'testuser1@lively-next.org', password: 'test' });
//     let response = await client1.validateToken(client1.user);
//     expect(response.data.type).equals('success');
//   });
// });
