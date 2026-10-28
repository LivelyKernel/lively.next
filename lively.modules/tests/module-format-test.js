/* global describe, it */
import { expect } from 'mocha-es6';
import { detectModuleFormat } from '../src/module.js';

describe('module format detection', () => {
  it('ignores module syntax inside CommonJS formatter strings and comments', () => {
    for (const source of [
      'module.exports = value => `}export default ${value}`;',
      'exports.format = value => "}export default " + value;',
      '/* export default 42; */ module.exports = 42;',
      'exports.source = `}import value from "other"`;',
      'exports.source = /}export default/;'
    ]) expect(detectModuleFormat(source), source).equals('global');
  });

  it('recognizes real module syntax after formatter strings and modern syntax', () => {
    for (const source of [
      'const text = `}export default 0`; export const answer = 42;',
      '#!/usr/bin/env node\nexport class Answer { #value = 42; }',
      'import value from "other"; module.exports = value;',
      'export * from "other";'
    ]) expect(detectModuleFormat(source), source).equals('esm');
    expect(detectModuleFormat('const load = () => import("other");')).equals('global');
  });

  it('preserves explicit loader metadata and format directives', () => {
    expect(detectModuleFormat('export default 42;', { format: 'cjs' })).equals('cjs');
    expect(detectModuleFormat('"format cjs"; exports.source = `}export default 42`;')).equals('cjs');
    expect(detectModuleFormat('"format esm"; const value = 42;')).equals('esm');
  });
});
