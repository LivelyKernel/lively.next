import assert from 'node:assert/strict';
import { createContext, runInContext } from 'node:vm';
import { transformSync } from '@swc/core';
import { getSerializableClassMeta, locateClass } from 'lively.serializer2/class-helper.js';
import { requiredModulesOfSnapshot } from 'lively.serializer2/snapshot-navigation.js';
import { LivelySwcTransform } from '../src/bundler-swc.js';
import { runtimeDefinition } from '../src/util/runtime.js';

// A module bundled for resurrection defines its top-level functions through the
// runtime's __define__; a world that holds an instance of an exported
// constructor function names the module that defines it and finds the function again.
const moduleId = 'demo-package/lib/ledger.js';
const source = 'export function Ledger () { this.total = 0; }\nfunction helper () { return 1; }\nexport const tools = { helper };';
const bundled = new LivelySwcTransform().transform(source, {
  filename: 'ledger.js', moduleId, resurrection: true, declarationWrapper: `__varRecorder__[${JSON.stringify(moduleId + '__define__')}]`
});
assert.match(bundled.code, /__define__"\]\("Ledger", "function", Ledger, __varRecorder__/);
const code = transformSync(bundled.code, { module: { type: 'systemjs' }, jsc: { target: 'es2022' } }).code;

const context = createContext({ console, document: { location: { href: 'http://fixture.test/' } }, __contextModule__: { id: 'bundle.js' } });
context.window = context;
runInContext(`(${runtimeDefinition.toString()})()`, context);
const exports = {};
context.System = {
  register (deps, factory) {
    factory((name, value) => {
      if (typeof name === 'object') Object.assign(exports, name);
      else exports[name] = value;
      return value;
    }, context.__contextModule__).execute();
  }
};
runInContext(code, context);

const runtime = context.lively.FreezerRuntime, recorder = runtime.get(moduleId), metaKey = Symbol.for('lively-module-meta');
const plain = value => JSON.parse(JSON.stringify(value));
const moduleMeta = { package: { name: 'demo-package' }, pathInPackage: 'lib/ledger.js' };
assert.deepEqual(plain(exports.Ledger[metaKey]), moduleMeta, 'exported functions record their module, not its recorder');
assert.deepEqual(plain(recorder.helper[metaKey]), moduleMeta, 'module-local functions record their module');

const classInfo = getSerializableClassMeta(new exports.Ledger());
assert.deepEqual(requiredModulesOfSnapshot({ snapshot: { ledger: { 'lively.serializer-class-info': classInfo } } }), [moduleId]);
globalThis.System = {
  global: {},
  decanonicalize: name => name,
  get: id => id === '@lively-env' ? { moduleEnv: id => runtime.get(id) && { recorder: runtime.get(id) } } : undefined
};
assert.equal(locateClass(classInfo), exports.Ledger, 'a saved instance finds its bundled constructor function');

// The module accessor of the class transform and module ids without a package.
const define = (id, accessor) => {
  const fn = function defined () {};
  runtime.recorderFor(id, context.__contextModule__)[id + '__define__']('defined', 'function', fn, accessor);
  return plain(fn[metaKey]);
};
const accessor = { package: () => ({ name: 'demo-package', version: '1.0.0' }), pathInPackage: () => './lib/accessor.js' };
assert.deepEqual(define('demo-package/lib/accessor.js', accessor), { package: { name: 'demo-package', version: '1.0.0' }, pathInPackage: './lib/accessor.js' });
assert.deepEqual(define('esm://ga.jspm.io/npm:demo@1.0.0/index.js'), { package: {}, pathInPackage: 'esm://ga.jspm.io/npm:demo@1.0.0/index.js' });
console.log('Functions defined in bundles record the module meta of their module.');
