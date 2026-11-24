/* global System, describe, it, beforeEach, afterEach */
import { expect, chai } from 'mocha-es6';

import { obj } from 'lively.lang';
import ExpressionSerializer from '../plugins/expression-serializer.js';
import { connect } from 'lively.bindings';
import { resource } from 'lively.resources';
import module from '../../lively.modules/src/module.js';
import { serialize, deserialize } from '../index.js';

let sut = new ExpressionSerializer({ prefix: '_prefix' });

describe('expression serializer format', () => {
  describe('encode', () => {
    it('just expression', () =>
      expect(sut.exprStringEncode({ __expr__: 'foo()' })).equals('_prefix:foo()'));

    it('with binding', () =>
      expect(sut.exprStringEncode({ __expr__: 'foo()', bindings: { 'package/foo.js': ['foo'] } }))
        .equals('_prefix:{foo}:package/foo.js:foo()'));

    it('with 3 vars and 2 bindings', () =>
      expect(sut.exprStringEncode({ __expr__: 'foo()', bindings: { 'package/foo.js': ['foo', 'bar'], 'package/zork.js': ['xxx'] } }))
        .equals('_prefix:{xxx}:package/zork.js:{foo,bar}:package/foo.js:foo()'));

    it('with alias bindings', () =>
      expect(
        sut.exprStringEncode({
          __expr__: 'bar() + zork()',
          bindings: { 'package/foo.js': [{ exported: 'foo', local: 'bar' }, { exported: 'bar', local: 'zork' }] }
        })).equals('_prefix:{foo:bar,bar:zork}:package/foo.js:bar() + zork()'));
  });

  describe('decode', () => {
    it('keeps URI schemes and authority ports intact, with aliases and multiple bindings', () => {
      for (const moduleId of ['http://127.0.0.1:9011/project/foo.js', 'https://example.test:8443/project/foo.js',
        'https://example.test/foo.js', 'custom://example.test:8123/project/foo.js', 'local://project/foo.js', 'local://foo.js',
        'file:///tmp/project/foo.js', 'file:///C:/project/foo.js', 'file://localhost/D:/project/foo.js',
        'file://fileserver/share/project/foo.js']) {
        for (const __expr__ of ['foo({label: "ok"})', '1 / 2 + foo()', '1/2 + foo()']) {
          const expression = {__expr__, bindings: {[moduleId]: [{exported: 'bar', local: 'foo'}], 'package/helper.js': ['helper']}};
          expect(sut.exprStringDecode(sut.exprStringEncode(expression)), moduleId).deep.equals(expression);
        }
      }
    });

    it('just epxression', () =>
      expect(sut.exprStringDecode('_prefix:foo()'))
        .deep.equals({ __expr__: 'foo()', bindings: null }));

    it('with 1 binding', () =>
      expect(sut.exprStringDecode('_prefix:{foo}:package/foo.js:foo()'))
        .deep.equals({ __expr__: 'foo()', bindings: { 'package/foo.js': ['foo'] } }));

    it('with alias binding', () =>
      expect(sut.exprStringDecode('_prefix:{foo:bar,bar:zork}:package/foo.js:bar() + zork()'))
        .deep.equals({
          __expr__: 'bar() + zork()',
          bindings: {
            'package/foo.js': [
              { exported: 'foo', local: 'bar' },
              { exported: 'bar', local: 'zork' }
            ]
          }
        }));

    it('with 3 vars and 2 bindings', () =>
      expect(sut.exprStringDecode('_prefix:{xxx}:package/zork.js:{foo,bar}:package/foo.js:foo()'))
        .deep.equals({ __expr__: 'foo()', bindings: { 'package/foo.js': ['foo', 'bar'], 'package/zork.js': ['xxx'] } }));
  });
});

describe('expression serializer deserialize', () => {
  /** Registers `exports` as module `id`, annotating `functions` with its module meta, while `check` runs. */
  function withModule (id, exports, functions, check) {
    for (const func of functions) Object.defineProperty(func, Symbol.for('lively-module-meta'), {value: {package: {}, pathInPackage: id}});
    System.set(id, System.newModule(exports));
    try { check(); } finally { System.delete(id); }
  }

  it('keeps native callbacks out of the expression serialization protocol', () => {
    const callback = (captured => () => captured)(23);
    expect([sut.embedValue(callback), callback()]).deep.equals([callback, 23]);
  });

  it('resolves module bindings on an HTTP origin with a port, exported aliases and classes as identity-checked references', () => {
    const id = 'http://127.0.0.1:9011/expression-test.js', foo = () => 23, original = value => value * 2, Original = class {};
    const defaultCallback = () => 3;
    Object.defineProperty(defaultCallback, 'name', {value: 'default'});
    const functions = [foo, original, Original, defaultCallback];
    withModule(id, {foo, renamed: original, Renamed: Original, default: defaultCallback}, functions, () => {
      const encoded = sut.getExpressionForFunction(foo);
      expect(sut.requiredModulesOf__expr__(encoded)).deep.equals([id]);
      expect(sut.deserializeExpr(encoded)()).equals(23);
      for (const func of functions) expect(sut.deserializeExpr(sut.getExpressionForFunction(func))).equals(func);
    });
  });

  it('rejects local varMapping functions even when a top-level binding has the same name', () => {
    const id = 'local://expression-local-function-test.js';
    const local = module(System, id).recordDebugClosure(function double (value) { return value * 3; }, {}, 0, 0, '', 'double');
    withModule(id, {double: function double (value) { return value * 2; }}, [], () => {
      expect(() => sut.getExpressionForFunction(local)).throws(/no matching binding/);
      const source = {x: 1}, target = {y: 0};
      connect(source, 'x', target, 'y', {converter: 'value => double(value)', varMapping: {double: local}});
      source.x = 2;
      expect(target.y).equals(6);
      expect(() => serialize({source, target})).throws(/Cannot be serialized due to lack of module information/);
    });
  });

  it('evals expression', () => {
    try {
      System.global.foo = () => 23;
      expect(sut.deserializeExpr('_prefix:foo()')).deep.equals(23);
    } finally { delete System.global.foo; }
  });

  it('throws on invalid expression', () => {
    expect(() => sut.deserializeExpr('foo()'))
      .throws(/"foo\(\)" is not a serialized expression/i);
  });

  it('evals expression with bindings', () => {
    System.config({ map: { 'foo-package': 'lively://foo-package/index.js' } });
    System.set('lively://foo-package/index.js', System.newModule({ foo: () => 23 }));
    System.get(System.decanonicalize('foo-package'));

    try {
      expect(sut.deserializeExpr('_prefix:{foo}:foo-package:foo()')).deep.equals(23);
    } finally {
      let map = System.getConfig().map;
      delete map['foo-package'];
      System.config({ map });
    }
  });

  it('evals expression with alias bindings', () => {
    System.config({ map: { 'foo-package': 'lively://foo-package/index.js' } });
    System.set('lively://foo-package/index.js', System.newModule({ foo: () => 23 }));
    System.get(System.decanonicalize('foo-package'));

    try {
      expect(sut.deserializeExpr('_prefix:{foo:bar}:foo-package:bar()')).deep.equals(23);
    } finally {
      let map = System.getConfig().map;
      delete map['foo-package'];
      System.config({ map });
    }
  });
});

describe('expression serializer live module references', () => {
  const id = 'local://expression-live-reference-test/task.js';
  const source = factor => `export function double(value) { return value * ${factor}; } export const arrow = value => value * ${factor};
    export function make(factor) { return function double(value) { return value * factor; }; } export class Foo {}`;
  let mod, exports;
  beforeEach(async () => {
    await resource(id).write(source(2));
    mod = module(System, id);
    mod.retainRuntimeClosures = true;
    exports = await mod.load();
  });
  afterEach(async () => { mod.unload(); await resource(id).remove(); });

  it('keeps saved connection functions live after editing a retained module', async () => {
    const {double, arrow} = exports, sourceObject = {x: 1}, target = {y: 0};
    connect(sourceObject, 'x', target, 'y', {converter: 'value => double(value)', varMapping: {double}});
    await mod.changeSource(source(3));
    expect(mod.recorder.double).not.equals(double);
    expect(sut.deserializeExpr(sut.getExpressionForFunction(double))).equals(mod.recorder.double);
    expect(sut.deserializeExpr(sut.getExpressionForFunction(arrow))).equals(mod.recorder.arrow);
    const restored = deserialize(JSON.parse(JSON.stringify(serialize({source: sourceObject, target}))));
    restored.source.x = 2;
    expect(restored.target.y).equals(6);
    expect(() => sut.getExpressionForFunction(exports.make(4))).throws(/no matching binding/);
  });

  it('resolves a class reference to the current class after a module reload', async () => {
    await mod.reload({reloadDeps: false});
    const current = (await mod.load()).Foo;
    expect(current).not.equals(exports.Foo);
    expect(sut.deserializeExpr(sut.getExpressionForFunction(exports.Foo))).equals(current);
  });

  it('uses frozen module recorders without a loadedModules registry', () => {
    const frozenId = 'lively.test/frozen-reference.js', old = function double (value) { return value * 2; };
    const current = function double (value) { return value * 3; }, recorder = {double: current};
    const entry = {recorder, exports: {double: current}}, meta = {package: {name: 'lively.test'}, pathInPackage: 'frozen-reference.js'};
    Object.defineProperty(old, Symbol.for('lively-module-meta'), {value: meta});
    const [previousSystem, previousRuntime, environment] = [globalThis.System, globalThis.lively.FreezerRuntime, System.get('@lively-env')];
    const previousRegistry = environment.loadedModules;
    try {
      delete environment.loadedModules;
      globalThis.lively.FreezerRuntime = globalThis.System = {decanonicalize: name => name, fetchStandaloneFor: () => undefined,
        get: (name, useRecorder = true) => name === '@lively-env' ? {} : name === frozenId ? useRecorder ? recorder : entry : undefined};
      const serializer = new ExpressionSerializer();
      expect([serializer.getModuleRecorder(frozenId), serializer.getModuleExports(frozenId)]).ordered.members([recorder, entry.exports]);
      expect(serializer.deserializeExpr(serializer.getExpressionForFunction(old))).equals(current);
    } finally {
      environment.loadedModules = previousRegistry;
      globalThis.System = previousSystem;
      globalThis.lively.FreezerRuntime = previousRuntime;
    }
  });
});
