import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { discoverPackageRootPaths, hasMutableRuntimePackages } from '../install.js';

const fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'lively-installer-runtime-root-'));
const runtimeRoot = path.join(fixture, 'runtime');
const workspaceSource = path.join(fixture, 'workspace-source');
const project = path.join(runtimeRoot, 'local_projects', 'owned-project');
try {
  await fs.mkdir(workspaceSource, { recursive: true });
  await fs.mkdir(project, { recursive: true });
  await fs.writeFile(path.join(workspaceSource, 'package.json'), JSON.stringify({ name: 'runtime-workspace', version: '1.0.0' }));
  await fs.writeFile(path.join(project, 'package.json'), JSON.stringify({ name: 'owned-project', version: '1.0.0' }));
  await fs.symlink(workspaceSource, path.join(runtimeRoot, 'lively.workspace'), process.platform === 'win32' ? 'junction' : 'dir');
  await fs.writeFile(path.join(runtimeRoot, 'package.json'), JSON.stringify({ private: true, workspaces: ['lively.workspace', 'lively.workspace'] }));

  const roots = discoverPackageRootPaths(pathToFileURL(`${runtimeRoot}${path.sep}`).href);
  assert.deepEqual(roots, [path.join(runtimeRoot, 'lively.workspace'), project]);
  assert.equal(hasMutableRuntimePackages(roots), true);
  console.log('Runtime workspace and local-project registry discovery passed.');
} finally {
  await fs.rm(fixture, { recursive: true, force: true });
}
