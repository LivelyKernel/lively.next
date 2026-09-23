import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import * as helpers from '../helpers.mjs';

const require = createRequire(import.meta.url);
const uuidExports = {
  node: { types: './dist/index.d.ts', default: './dist-node/index.js' },
  default: './dist/index.js'
};

for (const resolver of [helpers, require('../flatn-cjs.js')]) {
  for (const mapping of [uuidExports, {
    node: './node.js', browser: { import: './browser.js' }, import: './import.js'
  }]) {
    const browser = mapping === uuidExports ? './dist/index.js' : './browser.js';
    const node = mapping === uuidExports ? './dist-node/index.js' : './node.js';
    for (const [context, expected] of [
      ['systemjs-browser', browser], ['node-import', node], ['node-require', node]
    ]) {
      assert.equal(resolver.resolveExportMapping(mapping, context), expected);
      assert.equal(resolver.resolveImportMapping('#entry', { '#entry': mapping }, context), expected);
    }
  }
}

console.log('Conditional exports: browser and Node resolution passed (source and bundle).');
