/* global describe, it, before, after */
import { expect } from 'mocha-es6';
import { startServer } from './http-server-for-interface.js';
import { serverInterfaceFor } from '../index.js';

let server, system;
describe('http lively-system-interface', function () {
  this.timeout(30 * 1000);

  before(async () => {
    ({ server } = await startServer('/lively-tester', 3011));
    system = serverInterfaceFor('http://localhost:3011/lively-tester');
  });

  after(async () => {
    server.kill();
  });

  it('evals on server', async () => {
    let { value } = await system.runEval('1+3', { targetModule: 'lively://foo/bar' });
    expect(value).equals(4);
  });
});
