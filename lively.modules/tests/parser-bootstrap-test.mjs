import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

if (process.argv[2] !== '--child') {
  const result = spawnSync(process.execPath, [
    '--experimental-import-meta-resolve', fileURLToPath(import.meta.url), '--child'
  ], { encoding: 'utf8', timeout: 60000 });
  assert.equal(result.status, 0, result.error?.stack || result.stderr + result.stdout);
  console.log(result.stdout.trim());
} else {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const require = createRequire(import.meta.url);
  globalThis.System = require('systemjs');
  const { setupSystem } = await import('lively.installer');
  const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'lively parser runtime ~ '));
  try {
    const config = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    fs.writeFileSync(path.join(runtime, 'package.json'), JSON.stringify(config));
    // Desktop apps mount packaged workspaces in a separate writable runtime.
    for (const name of [...config.workspaces, 'node_modules']) {
      fs.symlinkSync(path.join(root, name), path.join(runtime, name), process.platform === 'win32' ? 'junction' : 'dir');
    }
    fs.mkdirSync(path.join(runtime, 'local_projects'));
    const system = await setupSystem(pathToFileURL(runtime + path.sep).href, { name: 'parser-bootstrap' });
    system.useModuleTranslationCache = false;
    const ast = await system.import('lively.ast');
    const parsed = ast.parse('@decorator class Example {}');
    assert.equal(parsed.body[0].type, 'ClassDeclaration');
    assert.equal(parsed.body[0].decorators[0].expression.name, 'decorator');
    console.log('Fresh System startup parses decorators through a mounted runtime.');
  } finally {
    fs.rmSync(runtime, { recursive: true, force: true });
  }
}
