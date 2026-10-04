import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { installProjectDependencies } from '../package-install.mjs';
import { linkLocalDependencies } from '../../lively.installer/helpers.cjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const coreLock = await fs.readFile(path.join(root, 'bun.lock'), 'utf8');
const prefix = `bun-project-test-${process.pid}`;
const packages = ['linked', 'one', 'two'].map(name => path.join(root, 'local_projects', `${prefix}-${name}`));
const wrongBun = path.join(root, 'local_projects', `${prefix}-wrong-bun`);
try {
  for (const directory of packages) await fs.mkdir(directory, { recursive: true });
  const linkedName = `${prefix}-linked`;
  await fs.writeFile(path.join(packages[0], 'package.json'), JSON.stringify({ name: linkedName, version: '1.0.0', type: 'module', main: 'index.js' }));
  await fs.writeFile(path.join(packages[0], 'index.js'), 'export const identity = {};');
  for (const [i, directory] of packages.slice(1).entries()) {
    await fs.writeFile(path.join(directory, 'package.json'), JSON.stringify({ name: `${prefix}-${i}`, version: '1.0.0', type: 'module', dependencies: { 'is-number': i === 0 ? '6.0.0' : '7.0.0', ...(i === 0 ? { [linkedName]: '1.0.0', 'lively.lang': '^0.1.0' } : {}) } }));
    await fs.writeFile(path.join(directory, 'index.js'), `export { identity } from '${linkedName}';`);
    const before = await fs.readFile(path.join(directory, 'package.json'), 'utf8');
    if (i === 0) {
      const supportedBun = process.env.BUN_PATH;
      // The launcher can exit before its child's inherited stdout closes.
      await fs.writeFile(wrongBun, `#!${process.execPath}
import { spawn } from 'node:child_process';
spawn(process.execPath, ['-e', "setTimeout(() => console.log('1.3.10'), 100)"], { stdio: ['ignore', 1, 2] }).unref();
process.exit(0);
`);
      await fs.chmod(wrongBun, 0o755);
      process.env.BUN_PATH = wrongBun;
      await assert.rejects(installProjectDependencies(directory, { update: true }), /Bun 1\.4\.2 is required \(found 1\.3\.10\)/);
      assert.equal(await fs.readFile(path.join(directory, 'package.json'), 'utf8'), before);
      if (supportedBun === undefined) delete process.env.BUN_PATH;
      else process.env.BUN_PATH = supportedBun;
    }
    await assert.rejects(installProjectDependencies(directory, { update: true, dependency: { name: '--help', version: '1' } }), /Invalid package/);
    assert.equal(await fs.readFile(path.join(directory, 'package.json'), 'utf8'), before);
    await fs.writeFile(path.join(directory, '.cachedImportMap.json'), JSON.stringify({ imports: { obsolete: 'esm://example.invalid/obsolete.js' } }));
    // Opening a pre-Bun project must migrate without a CLI-only --update step.
    await assert.rejects(fs.access(path.join(directory, 'bun.lock')), { code: 'ENOENT' });
    await installProjectDependencies(directory);
    const config = JSON.parse(await fs.readFile(path.join(directory, 'package.json'), 'utf8'));
    assert.equal(config.lively.localDependencies[linkedName], `../${prefix}-linked`);
    if (i === 0) {
      assert.equal(config.lively.localDependencies['lively.lang'], '../../lively.lang');
      assert.equal(config.dependencies[linkedName], undefined);
      assert.equal(config.dependencies['lively.lang'], undefined);
    }
    assert.equal(JSON.parse(await fs.readFile(path.join(directory, '.cachedImportMap.json'), 'utf8')).imports.obsolete, undefined);
    const lock = await fs.readFile(path.join(directory, 'bun.lock'), 'utf8');
    await fs.unlink(path.join(directory, '.cachedImportMap.json'));
    await installProjectDependencies(directory);
    assert.ok(JSON.parse(await fs.readFile(path.join(directory, '.cachedImportMap.json'), 'utf8')).imports['is-number']);
    await assert.rejects(fs.access(path.join(directory, 'browser-import-map.json')), { code: 'ENOENT' });
    assert.equal(await fs.readFile(path.join(directory, 'bun.lock'), 'utf8'), lock);
    if (i === 0) {
      const migrated = await fs.readFile(path.join(directory, 'package.json'), 'utf8');
      config.dependencies['is-number'] = '7.0.0';
      await fs.writeFile(path.join(directory, 'package.json'), JSON.stringify(config));
      await assert.rejects(installProjectDependencies(directory), /Bun failed/);
      assert.equal(await fs.readFile(path.join(directory, 'bun.lock'), 'utf8'), lock);
      await fs.writeFile(path.join(directory, 'package.json'), migrated);
    }
    const require = createRequire(path.join(directory, 'index.js'));
    assert.equal(require.resolve(config.name + '/index.js'), path.join(directory, 'index.js'));
    assert.equal(require('is-number/package.json').version, i === 0 ? '6.0.0' : '7.0.0');
  }
  const [first, second] = await Promise.all(packages.slice(1).map(dir => import(pathToFileURL(path.join(dir, 'index.js')))));
  assert.equal(first.identity, second.identity);
  assert.equal(await fs.readFile(path.join(root, 'bun.lock'), 'utf8'), coreLock);
  console.log('Legacy project migration, frozen reopen, conflicting versions, and linked source identity passed.');
} finally {
  await Promise.all([...packages, wrongBun].map(directory => fs.rm(directory, { recursive: true, force: true })));
}


const runtimeFixture = await fs.mkdtemp(path.join(os.tmpdir(), 'lively-project-runtime-root-'));
const runtimeRoot = path.join(runtimeFixture, 'runtime');
const workspaceSource = path.join(runtimeFixture, 'workspace-source');
const runtimeProject = path.join(runtimeRoot, 'local_projects', 'runtime-project');
const previousRuntimeRoot = process.env.lv_next_dir;
try {
  await fs.mkdir(workspaceSource, { recursive: true });
  await fs.mkdir(runtimeProject, { recursive: true });
  await fs.writeFile(path.join(workspaceSource, 'package.json'), JSON.stringify({ name: 'runtime-linked', version: '1.0.0', type: 'module' }));
  await fs.writeFile(path.join(workspaceSource, 'index.js'), 'export const runtimeIdentity = {};\n');
  await fs.symlink(workspaceSource, path.join(runtimeRoot, 'lively.linked'), process.platform === 'win32' ? 'junction' : 'dir');
  await fs.writeFile(path.join(runtimeRoot, 'package.json'), JSON.stringify({ name: 'runtime-root', private: true, workspaces: ['lively.linked'] }));
  await fs.writeFile(path.join(runtimeProject, 'package.json'), JSON.stringify({
    name: 'runtime-project', version: '1.0.0', type: 'module', dependencies: { 'is-number': '7.0.0' },
    lively: { localDependencies: { 'runtime-linked': '../../lively.linked' } }
  }));
  await new Promise((resolve, reject) => {
    const child = spawn(process.env.BUN_PATH || 'bun', ['install', '--ignore-scripts'], { cwd: runtimeProject, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`Fixture Bun install failed (${code})`)));
  });
  process.env.lv_next_dir = runtimeRoot;
  await assert.rejects(installProjectDependencies(path.join(runtimeRoot, 'lively.linked')), /Missing workspace bun.lock/);
  await installProjectDependencies(runtimeProject);
  assert.equal(await fs.realpath(path.join(runtimeProject, 'node_modules', 'runtime-linked')), workspaceSource);
  assert.equal(await fs.realpath(path.join(runtimeProject, 'node_modules', 'runtime-project')), runtimeProject);
  const link = path.join(runtimeProject, 'node_modules', 'runtime-linked');
  const mountedWorkspace = path.join(runtimeRoot, 'lively.linked');
  const lock = await fs.readFile(path.join(runtimeProject, 'bun.lock'), 'utf8');
  const nextSource = path.join(runtimeFixture, 'next-workspace-source');
  await fs.mkdir(nextSource);
  await fs.writeFile(path.join(nextSource, 'package.json'), await fs.readFile(path.join(workspaceSource, 'package.json')));
  await fs.writeFile(path.join(nextSource, 'index.js'), 'export const runtimeIdentity = "updated";\n');
  await fs.unlink(mountedWorkspace);
  await fs.symlink(nextSource, mountedWorkspace, process.platform === 'win32' ? 'junction' : 'dir');
  assert.equal(await fs.realpath(link), nextSource, 'A workspace link must follow an app update without reinstalling');
  // Migrate links created by older apps, including links to a removed payload.
  await fs.unlink(link);
  await fs.symlink(workspaceSource, link, process.platform === 'win32' ? 'junction' : 'dir');
  await fs.rm(workspaceSource, { recursive: true });
  const config = JSON.parse(await fs.readFile(path.join(runtimeProject, 'package.json'), 'utf8'));
  linkLocalDependencies(runtimeProject, config.lively.localDependencies);
  assert.equal(await fs.realpath(link), nextSource);
  assert.equal(await fs.readFile(path.join(runtimeProject, 'bun.lock'), 'utf8'), lock);
  console.log('Workspace links follow runtime updates and repair removed payloads without changing Bun locks.');
  console.log('Runtime root with symlinked workspaces and owned local_projects passed.');
} finally {
  if (previousRuntimeRoot === undefined) delete process.env.lv_next_dir;
  else process.env.lv_next_dir = previousRuntimeRoot;
  await fs.rm(runtimeFixture, { recursive: true, force: true });
}
