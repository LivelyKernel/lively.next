import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
globalThis.System = require('systemjs');
assert.equal(globalThis[Symbol.for('lively-debugger-state')], undefined, 'cold process must start without the context runtime');
await import('../index.js');
assert.equal(globalThis[Symbol.for('lively-debugger-state')], undefined, 'booting lively.modules without debugger-bearing modules must not evaluate lively.context');
assert.equal(typeof globalThis.__createClosure, 'undefined', 'ordinary boot must not install context globals');
console.log('module boot: no context evaluation or debugger globals');
