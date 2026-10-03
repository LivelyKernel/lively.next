#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { restorePackageLinks, stripPackageLinks } from './package-windows-dependencies.mjs';

const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'lively-windows-graph-'));
const relocated = fixture + ' relocated';
try {
  const store = path.join(fixture, 'node_modules', '.bun', 'fixture@1.0.0', 'node_modules', 'fixture');
  const workspace = path.join(fixture, 'lively.fixture');
  fs.mkdirSync(store, { recursive: true });
  fs.mkdirSync(path.join(workspace, 'node_modules'), { recursive: true });
  fs.writeFileSync(path.join(store, 'package.json'), '{}');
  fs.writeFileSync(path.join(workspace, 'package.json'), '{}');
  fs.symlinkSync(store, path.join(fixture, 'node_modules', 'fixture'), 'dir');
  fs.symlinkSync(workspace, path.join(workspace, 'node_modules', 'lively.fixture'), 'dir');

  const manifest = stripPackageLinks(fixture);
  assert.equal(manifest.length, 2);
  assert.equal(fs.lstatSync(path.join(fixture, '.lively-package-links.json')).isFile(), true);
  assert.equal(fs.existsSync(path.join(fixture, 'node_modules', 'fixture')), false);
  assert.equal(fs.existsSync(path.join(workspace, 'node_modules', 'lively.fixture')), false);

  fs.cpSync(fixture, relocated, { recursive: true });
  restorePackageLinks(relocated);
  assert.equal(
    fs.realpathSync(path.join(relocated, 'node_modules', 'fixture')),
    path.join(relocated, 'node_modules', '.bun', 'fixture@1.0.0', 'node_modules', 'fixture'));
  assert.equal(
    fs.realpathSync(path.join(relocated, 'lively.fixture', 'node_modules', 'lively.fixture')),
    path.join(relocated, 'lively.fixture'));
  stripPackageLinks(relocated);
  console.log('Windows dependency graph strip/restore fixture passed.');
} finally {
  fs.rmSync(fixture, { recursive: true, force: true });
  fs.rmSync(relocated, { recursive: true, force: true });
}
