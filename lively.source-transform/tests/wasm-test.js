/* global before, describe, it, System */
import { expect } from 'mocha-es6';
import { parse } from 'lively.ast';
import { initWasm, isAvailable, swcTransform } from '../swc/browser-transform.js';
import { setupSwcTranspiler, SwcBrowserTranspiler } from '../swc/transpiler-setup.js';

const moduleId = 'lively.source-transform/tests/wasm-test-input.js';

function wasmConfig (overrides = {}) {
  return {
    captureObj: '_rec',
    moduleId,
    exclude: [
      '_rec',
      'System',
      '__contextModule__',
      'lively',
      'undefined'
    ],
    captureImports: true,
    enableExportSplit: true,
    enableComponentTransform: false,
    enableNamespaceTransform: false,
    enableDynamicImportTransform: false,
    enableSystemjsTransform: false,
    enableScopeCapture: true,
    ...overrides
  };
}

function transformWithWasm (source, config = {}) {
  const result = swcTransform(source, wasmConfig(config));
  if (!result) throw new Error('WASM transform did not return a result');
  parse(result.code);
  return result.code;
}

function expectIncludes (code, expected) {
  expect(code.includes(expected)).equals(
    true,
    `Expected transformed code to include:\n${expected}\n\nActual:\n${code}`
  );
}

describe('wasm transform', function () {
  before(async function () {
    if (
      typeof WebAssembly === 'undefined' ||
      typeof fetch === 'undefined' ||
      typeof document === 'undefined'
    ) this.skip();

    const baseURL = typeof System !== 'undefined' ? System.baseURL : location.origin;
    await initWasm(baseURL);
    expect(isAvailable()).equals(true);
  });

  it('emits parseable System.register output', function () {
    const code = transformWithWasm('var x = 23;');
    expectIncludes(code, 'System.register([], function');
    expectIncludes(code, `_rec = (lively.FreezerRuntime || lively.frozenModules).recorderFor("${moduleId}", __contextModule__);`);
    expectIncludes(code, `_rec.x = 23;`);
  });

  it('registers SWC under its own transpiler id', async function () {
    const modules = new Map();
    const testSystem = {
      baseURL: System.baseURL,
      _loader: {},
      newModule: module => module,
      set: (id, module) => modules.set(id, module),
      get: id => modules.get(id),
      config (config) { Object.assign(this, config); }
    };

    await setupSwcTranspiler(testSystem);
    expect(testSystem.transpiler).equals('lively.transpiler.swc');
    expect(modules.get('lively.transpiler.swc').default.name).equals('SwcBrowserTranspiler');
  });

  it('captures top-level var declarations and references', function () {
    const code = transformWithWasm('var y, z = foo + bar; baz.foo(z, 3);');
    expectIncludes(code, '_rec.y = Object.prototype.hasOwnProperty.call(_rec, "y") ? _rec.y : undefined;');
    expectIncludes(code, '_rec.z = _rec.foo + _rec.bar;');
    expectIncludes(code, '_rec.baz.foo(_rec.z, 3);');
  });

  it('uses the Babel fallback for retained runtime closures', function () {
    const transpiler = new SwcBrowserTranspiler(System, moduleId, {});
    const module = {id: moduleId, recorderName: '_rec', sourceAccessorName: '_source'};
    expect(transpiler.transpileModule('export function make(value) { return () => value; }', {module})).equals(null);
    expect(!!transpiler.transpileModule('export const value = 2;', {module})).equals(true);
  });

  it('captures iterable references inside generator yield delegation', function () {
    const code = transformWithWasm('function* values() { yield* items; }\nexport var result = [...values()];');
    expectIncludes(code, 'function* values()');
    expectIncludes(code, 'yield* _rec.items;');
    expectIncludes(code, '_rec.values = values;');
    expectIncludes(code, '_export("result", result = _rec.result =');
  });

  it('propagates captured mutations and dependency updates to live exports', async function () {
    const recorder = {};
    const exports = {};
    let declaration;
    const context = { id: moduleId };
    const testSystem = {
      get: () => ({ evaluationStart () {}, evaluationEnd () {} }),
      register (dependencies, factory) {
        declaration = factory((name, value) => {
          if (typeof name === 'object') Object.assign(exports, name);
          else exports[name] = value;
          return value;
        }, context);
      }
    };
    const code = transformWithWasm(`
      import { value } from 'dep';
      export { value as alias };
      let count = 0;
      export { count, count as default };
      export function next() { return count++; }
    `);
    const runtime = { FreezerRuntime: { recorderFor: () => recorder } };
    new Function('System', 'lively', '__contextModule__', code)(testSystem, runtime, context);
    declaration.setters[0]({ value: 3 });
    await declaration.execute();
    expect(exports.alias).equals(3);
    expect(exports.next()).equals(0);
    expect(exports.count).equals(1);
    expect(exports.default).equals(1);
    expect(recorder.count).equals(1);
    declaration.setters[0]({ value: 9 });
    expect(exports.alias).equals(9);
  });
});
