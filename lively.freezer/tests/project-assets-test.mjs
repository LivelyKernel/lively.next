import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import LivelyRollup from '../src/bundler.js';

for (const separator of ['/', '\\']) {
  const id = ['C:', 'runtime', 'local_projects', 'fixture', 'index.js'].join(separator);
  const bundler = new LivelyRollup({
    resolver: { detectFormatFromSource: () => 'global', ensureFileFormat: path => path, setStatus () {} },
    minify: false
  });
  const source = "globalThis.urls = [projectAsset('logo.svg', import.meta.url), projectAsset('legacy.svg')];";
  const transformed = await bundler.transform(source, id);
  const code = typeof transformed === 'string' ? transformed : transformed.code;
  const context = { projectAsset: name => './assets/' + name };
  runInNewContext(code, context);
  assert.deepEqual(Array.from(context.urls), ['./assets/fixture__logo.svg', './assets/fixture__legacy.svg']);
  assert.deepEqual(bundler.projectAssets, [
    { oldName: 'logo.svg', newName: 'fixture__logo.svg', project: 'fixture' },
    { oldName: 'legacy.svg', newName: 'fixture__legacy.svg', project: 'fixture' }
  ]);
}
console.log('Project asset collection preserves explicit caller metadata and legacy calls.');
