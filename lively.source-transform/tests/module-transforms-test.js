/* global describe, it */
import { expect } from 'mocha-es6';
import { babel, t } from '../babel/ast.js';
import { insertCapturesForImportAndExportDeclarations } from '../babel/transforms/exported-import-capture.js';

function captureModuleDeclarations (source, options = {}) {
  return babel.transformSync(source, {
    babelrc: false, configFile: false, ast: true, code: false,
    plugins: [() => ({ visitor: { Program (path) {
      insertCapturesForImportAndExportDeclarations(path, { captureObj: t.identifier('_rec'), captureImports: true, ...options });
      path.stop();
    } } })]
  }).ast.program.body;
}

describe('module transform passes', () => {
  it('forwards reexports through a fresh import when a local binding has the exported name', () => {
    const body = captureModuleDeclarations('const answer = 1; export { value as answer } from "dep";');
    const imported = body.find(node => t.isImportDeclaration(node)).specifiers[0];
    const exported = body.find(node => t.isExportNamedDeclaration(node)).specifiers[0];
    expect(imported.imported.name).equals('value');
    expect(imported.local.name).not.equals('answer');
    expect(exported.local.name).equals(imported.local.name);
    expect(exported.exported.name).equals('answer');
  });

  it('honors disabled import capture in the production Babel pass', () => {
    const body = captureModuleDeclarations('import value from "dep";', { captureImports: false });
    expect(body.length).equals(1);
    expect(body[0].type).equals('ImportDeclaration');
  });
});
