#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { seedPackagedPartsbin } from '../desktop/package-payload.cjs';
import { restorePackageLinks, stripPackageLinks } from './package-windows-dependencies.mjs';

const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'lively-windows-graph-'));
const relocated = fixture + ' relocated';
const runtime = fixture + ' runtime with spaces';
const linkType = process.platform === 'win32' ? 'junction' : 'dir';
try {
  const store = path.join(fixture, 'node_modules', '.bun', 'fixture@1.0.0', 'node_modules', 'fixture');
  const workspace = path.join(fixture, 'lively.fixture');
  fs.mkdirSync(store, { recursive: true });
  fs.mkdirSync(path.join(workspace, 'node_modules'), { recursive: true });
  fs.writeFileSync(path.join(store, 'package.json'), '{}');
  fs.writeFileSync(path.join(workspace, 'package.json'), '{}');
  fs.symlinkSync(store, path.join(fixture, 'node_modules', 'fixture'), linkType);
  fs.symlinkSync(workspace, path.join(workspace, 'node_modules', 'lively.fixture'), linkType);

  const partsbin = path.join(fixture, 'local_projects', 'LivelyKernel--partsbin');
  fs.mkdirSync(path.join(partsbin, 'node_modules'), { recursive: true });
  fs.writeFileSync(path.join(partsbin, 'component.cp.js'), 'bundled component');
  fs.symlinkSync(partsbin, path.join(partsbin, 'node_modules', 'LivelyKernel--partsbin'), linkType);
  fs.symlinkSync(workspace, path.join(partsbin, 'node_modules', 'lively.fixture'), linkType);

  const manifest = stripPackageLinks(fixture);
  assert.equal(manifest.length, 4);
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
  fs.mkdirSync(runtime);
  fs.symlinkSync(path.join(relocated, 'lively.fixture'), path.join(runtime, 'lively.fixture'), linkType);
  seedPackagedPartsbin(relocated, runtime);
  const installed = path.join(runtime, 'local_projects', 'LivelyKernel--partsbin');
  assert.equal(fs.realpathSync(path.join(installed, 'node_modules', 'LivelyKernel--partsbin')),
    fs.realpathSync(installed));
  assert.equal(fs.realpathSync(path.join(installed, 'node_modules', 'lively.fixture')),
    fs.realpathSync(path.join(runtime, 'lively.fixture')));
  fs.writeFileSync(path.join(installed, 'node_modules', 'LivelyKernel--partsbin', 'component.cp.js'), 'user edit');
  assert.equal(fs.readFileSync(path.join(relocated, 'local_projects', 'LivelyKernel--partsbin', 'component.cp.js'), 'utf8'),
    'bundled component');
  seedPackagedPartsbin(relocated, runtime);
  assert.equal(fs.readFileSync(path.join(installed, 'component.cp.js'), 'utf8'), 'user edit');
  stripPackageLinks(relocated);
  console.log('Windows dependency graph strip/restore fixture passed.');
} finally {
  fs.rmSync(fixture, { recursive: true, force: true });
  fs.rmSync(relocated, { recursive: true, force: true });
  fs.rmSync(runtime, { recursive: true, force: true });
}
