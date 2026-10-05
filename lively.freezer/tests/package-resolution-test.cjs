const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { createRequire } = require('node:module');
const vm = require('node:vm');
const resolver = require('../src/resolvers/node.cjs');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lively-browser-resolve-'));
const previousRuntimeRoot = process.env.lv_next_dir;
try {
  const pkg = path.join(root, 'node_modules', 'conditional');
  fs.mkdirSync(pkg, { recursive: true });
  fs.writeFileSync(path.join(pkg, 'package.json'), JSON.stringify({
    name: 'conditional', version: '1.0.0',
    exports: { '.': { node: { default: './node.js' }, default: './browser.js' }, './blocked': null }
  }));
  for (const entry of ['node.js', 'browser.js']) fs.writeFileSync(path.join(pkg, entry), 'export const value = 42;');
  const importer = path.join(root, 'entry.js');
  assert.equal(resolver.resolveModuleId('conditional', importer, 'systemjs-browser'), path.join(pkg, 'browser.js'));
  assert.equal(resolver.resolveModuleId('conditional', importer, 'systemjs-node'), path.join(pkg, 'node.js'));
  assert.throws(() => resolver.resolveModuleId('conditional/blocked', importer, 'systemjs-browser'));
  assert.equal(resolver.resolvePackage(path.join(pkg, 'browser.js')).name, 'conditional');
  const file = path.join(pkg, 'browser.js');
  const url = pathToFileURL(file).href;
  assert.equal(resolver.resolveModuleId(url), file);
  assert.equal(resolver.normalizeFileName(url), file);
  assert.equal(resolver.decanonicalizeFileName(url), file);
  // A desktop runtime mounts workspaces from a separate application payload.
  const language = path.resolve(__dirname, '../../lively.lang');
  fs.symlinkSync(language, path.join(root, 'lively.lang'), process.platform === 'win32' ? 'junction' : 'dir');
  process.env.lv_next_dir = root;
  delete require.cache[require.resolve('../src/resolvers/node.cjs')];
  const desktopResolver = require('../src/resolvers/node.cjs');
  const commonjs = desktopResolver.supportingPlugins('browser', {}).find(plugin => plugin.name === 'commonjs');
  const worker = fs.realpathSync(path.join(root, 'lively.lang/worker.js'));
  assert.equal(commonjs.transform.call({ error (err) { throw err; } }, fs.readFileSync(worker, 'utf8'), worker), null);
  console.log('Freezer browser/Node conditions and blocked exports passed.');
  console.log('Mounted Lively workspaces retain their ESM source during project builds.');
  // Rollup normalizes separators even when runtime and payload use different drives.
  const resolverFile = require.resolve('../src/resolvers/node.cjs');
  const resolverRequire = createRequire(resolverFile);
  const windows = {
    module: { exports: {} }, console, RegExp,
    __dirname: 'D:/lively-app/app/lively.freezer/src/resolvers',
    __filename: resolverFile,
    process: { env: { ...process.env, lv_next_dir: 'C:/desktop/runtime-root' } },
    require: name => name === 'node:path' ? path.win32 : resolverRequire(name)
  };
  vm.runInNewContext(fs.readFileSync(resolverFile, 'utf8'), windows, { filename: resolverFile });
  const windowsCommonjs = windows.module.exports.supportingPlugins('browser', {}).find(plugin => plugin.name === 'commonjs');
  for (const id of ['D:/lively-app/app/lively.lang/worker.js', 'C:/desktop/runtime-root/lively.lang/worker.js']) {
    assert.equal(windowsCommonjs.transform.call({ error (err) { throw err; } }, fs.readFileSync(worker, 'utf8'), id), null);
  }
  console.log('Windows drive paths retain Lively ESM after Rollup separator normalization.');
} finally {
  if (previousRuntimeRoot === undefined) delete process.env.lv_next_dir;
  else process.env.lv_next_dir = previousRuntimeRoot;
  fs.rmSync(root, { recursive: true, force: true });
}
