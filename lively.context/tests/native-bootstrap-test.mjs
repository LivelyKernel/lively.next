import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
globalThis.System = createRequire(new URL('../../lively.modules/package.json', import.meta.url))('systemjs');
assert.equal(typeof window, 'undefined', 'Exercise the Node realm, without a browser shim');
const {Continuation} = await import('../lib/stackReification.js');
assert.equal(typeof Continuation.fromUnwindException, 'function', 'Node imports the continuation runtime');
assert.equal(typeof globalThis.__createClosure, 'function', 'Closure helpers are installed in the Node realm');
assert.equal(typeof globalThis[Symbol.for('lively-debugger-state')], 'object', 'Debugger state lives on the same Node global');
console.log('Node context bootstrap passed');
