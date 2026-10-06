#!/usr/bin/env node
// Usage: node rebuild-windows-leveldown.mjs [app root] [packaged node executable]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

assert.equal(process.platform, 'win32', 'Leveldown rebuild is specific to Windows');
const root = path.resolve(process.argv[2] || '.');
const node = path.resolve(process.argv[3] || process.execPath);
const require = createRequire(path.join(root, 'lively.storage/package.json'));
const leveldown = path.dirname(createRequire(require.resolve('pouchdb')).resolve('leveldown/package.json'));
const gyp = path.join(path.dirname(process.execPath), 'node_modules/npm/node_modules/node-gyp');
const hook = path.join(gyp, 'src/win_delay_load_hook.cc');
const original = fs.readFileSync(hook, 'utf8');
// Leveldown uses only Node-API. NW.js exports it from node.dll; standalone Node
// exports it from its executable. Keep the normal hook fallback for HTTP mode.
const patched = original.replaceAll('GetModuleHandle(NULL)',
  '(GetModuleHandleA("node.dll") ? GetModuleHandleA("node.dll") : GetModuleHandle(NULL))');
assert.notEqual(patched, original, 'Unrecognized node-gyp Windows delay-load hook');
fs.writeFileSync(hook, patched);
try {
  const version = execFileSync(node, ['-p', 'process.versions.node'], { encoding: 'utf8' }).trim();
  execFileSync(node, [path.join(gyp, 'bin/node-gyp.js'), 'rebuild',
    '--directory=' + leveldown, '--target=' + version], { stdio: 'inherit' });
} finally {
  fs.writeFileSync(hook, original);
}
