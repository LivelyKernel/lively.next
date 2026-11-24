// Checks that freezer builds reject chunks whose SystemJS dependencies include Node built-ins.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { assertNoNodeBuiltins, nodeBuiltinDependencies } from '../tools/assert-no-node-builtins.mjs';

assert.deepEqual(nodeBuiltinDependencies(
  "System.register(['./index.js', 'node:path', \"fs\"], (function (exports) { return { execute () {} }; }));"),
['fs', 'node:path']);
assert.deepEqual(nodeBuiltinDependencies(
  "BootstrapSystem.register(['livelyClassesRuntime.js', './a.js'], (function () { if (isNode) require('child_process'); }));"),
[], 'built-ins required by Node-only code are not dependencies');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'freezer-builtins-'));
try {
  fs.writeFileSync(path.join(dir, 'clean.js'), "System.register(['./other.js'], (function () { return { execute () { System._nodeRequire('fs'); } }; }));");
  fs.writeFileSync(path.join(dir, 'notes.txt'), "System.register(['fs'], () => {});");
  await assertNoNodeBuiltins(dir);
  fs.writeFileSync(path.join(dir, 'leaky.js'), "System.register(['path', './x.js'], (function () {}));");
  await assert.rejects(assertNoNodeBuiltins(dir), /leaky\.js: path/);
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
console.log('Freezer Node built-in dependency checks passed.');
