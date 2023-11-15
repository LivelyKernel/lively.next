/* global beforeEach, afterEach, before, after, describe, it,System */

import { expect } from 'mocha-es6';

import { resource, ensureFetch } from 'lively.resources';
import { module } from 'lively.modules';
import LivelyServer from '../server.js';

// Array.from(LivelyServer.servers.keys())

let hostname = 'localhost'; let port = 9009; let testServer;

let subserver1Path = 'lively.server/tests/subserver1.js';
let subserver1FullPath = System.decanonicalize(subserver1Path);
let modulesToRemove = [];

describe('subservers - lively.server', function () {
  before(async () => {
    await ensureFetch();
    testServer = LivelyServer.ensure({ port, hostname });
    await testServer.whenStarted();
  });

  after(async () => {
    testServer.close();
    await testServer.whenClosed();
  });

  afterEach(async () => {
    modulesToRemove = modulesToRemove.map(ea =>
      typeof ea === 'string' ? module(ea) : ea);
    await Promise.all(modulesToRemove.map(ea => ea.unload()));
    await Promise.all(modulesToRemove.map(ea => resource(ea.id).remove()));
    modulesToRemove.ength = 0;
    testServer.removePlugin('MySubserver');
  });

  it('can add and remove subserver', async () => {
    modulesToRemove.push(subserver1Path);
    await resource(subserver1FullPath).write(`
export default class MySubserver {

  get pluginId() { return "MySubserver" }
  handleRequest(req, res, next) {
    if (!req.url.startsWith("/subserver/MySubserver")) return next();
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end("MySubserver is running!");
  }
}
`);
    await testServer.addSubserver(subserver1Path);
    let response = await resource(`http://${hostname}:${port}/subserver/MySubserver`).read();
    expect(response).equals('MySubserver is running!');

    await testServer.removeSubserver(subserver1Path);
    let response2 = await resource(`http://${hostname}:${port}/subserver/MySubserver`).read();
    expect(response2).equals('lively.server');
  });
});
