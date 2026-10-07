const assert = require('node:assert/strict');
const { Session } = require('node:inspector');
const { captureFunctionBindings } = require('../desktop/function-scopes.cjs');

(async () => {
  const marker = { count: 0 }, step = '1', large = 12n, special = NaN;
  const fn = function () { return [marker, step, large, special]; };
  const commands = [];
  const originalPost = Session.prototype.post;
  Session.prototype.post = function (method, ...args) { commands.push(method); return originalPost.call(this, method, ...args); };
  try {
    const values = await captureFunctionBindings(fn, ['marker', 'step', 'large', 'special']);
    assert.equal(values.marker, marker);
    assert.equal(values.step, '1');
    assert.equal(values.large, 12n);
    assert(Number.isNaN(values.special));
    values.marker.count = 2;
    assert.equal(marker.count, 2);
    values.step = 7;
    assert.equal(fn()[1], '1');
    await assert.rejects(captureFunctionBindings(fn, ['notRetained']), /Missing retained bindings/);
    assert(commands.every(method => method.startsWith('Runtime.')));
    assert(!Object.keys(global).some(name => name.startsWith('__livelyFunctionScopes')));
    console.log('retained bindings: identity, primitives, cleanup, and Runtime-only access passed');
  } finally { Session.prototype.post = originalPost; }
})().catch(error => { console.error(error); process.exitCode = 1; });
