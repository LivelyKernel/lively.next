#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  assertSelfContainedSymlinks,
  copyMonorepo,
  materializeFileSymlinksAndRejectDirectorySymlinks
} from './build.mjs';

const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'lively-desktop-layout-'));
const source = path.join(fixture, 'checkout with spaces');
const bundle = path.join(fixture, 'relocated bundle', 'app');

try {
  const workspace = path.join(source, 'lively.fixture');
  const storedPackage = path.join(
    source,
    'node_modules',
    '.bun',
    'fixture@1.0.0',
    'node_modules',
    'fixture');
  const appModules = path.join(source, 'lively.app', 'node_modules');
  fs.mkdirSync(workspace, { recursive: true });
  fs.mkdirSync(storedPackage, { recursive: true });
  fs.mkdirSync(appModules, { recursive: true });
  fs.writeFileSync(path.join(workspace, 'package.json'), '{"name":"lively.fixture"}\n');
  fs.writeFileSync(path.join(storedPackage, 'package.json'), '{"name":"fixture"}\n');
  const executable = path.join(storedPackage, 'cli.js');
  fs.writeFileSync(executable, '#!/usr/bin/env node\n');
  fs.chmodSync(executable, 0o755);

  fs.symlinkSync(workspace, path.join(appModules, 'lively.fixture'), 'dir');
  fs.symlinkSync(
    path.relative(appModules, storedPackage),
    path.join(appModules, 'fixture'),
    'dir');

  copyMonorepo(source, bundle, () => true);
  assertSelfContainedSymlinks(bundle);
  assert.equal(
    fs.realpathSync(path.join(bundle, 'lively.app', 'node_modules', 'lively.fixture')),
    path.join(bundle, 'lively.fixture'));
  assert.equal(fs.statSync(path.join(
    bundle,
    'node_modules',
    '.bun',
    'fixture@1.0.0',
    'node_modules',
    'fixture',
    'cli.js')).mode & 0o777, 0o755);

  fs.renameSync(source, path.join(fixture, 'checkout removed'));
  assertSelfContainedSymlinks(bundle);

  const portableFiles = path.join(fixture, 'portable-files');
  fs.mkdirSync(portableFiles);
  const fileTarget = path.join(portableFiles, 'link-target.txt');
  const fileLink = path.join(portableFiles, 'link.txt');
  fs.writeFileSync(fileTarget, 'portable\n');
  fs.symlinkSync('link-target.txt', fileLink, 'file');
  materializeFileSymlinksAndRejectDirectorySymlinks(portableFiles);
  assert.equal(fs.lstatSync(fileLink).isSymbolicLink(), false);
  assert.equal(fs.readFileSync(fileLink, 'utf8'), 'portable\n');
  const directoryTarget = path.join(portableFiles, 'directory-target');
  fs.mkdirSync(directoryTarget);
  fs.symlinkSync('directory-target', path.join(portableFiles, 'directory-link'), 'dir');
  assert.throws(
    () => materializeFileSymlinksAndRejectDirectorySymlinks(portableFiles),
    /directory symlink/);

  const externalSource = path.join(fixture, 'external-source');
  const externalBundle = path.join(fixture, 'external-bundle');
  fs.mkdirSync(externalSource);
  fs.symlinkSync(bundle, path.join(externalSource, 'bad-link'), 'dir');
  assert.throws(
    () => copyMonorepo(externalSource, externalBundle, () => true),
    /external symlink/);
  console.log('desktop install graph remains self-contained after relocation');
} finally {
  fs.rmSync(fixture, { recursive: true, force: true });
}
