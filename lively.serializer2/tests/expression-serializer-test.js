/* global System, describe, it, beforeEach, afterEach */
import { expect, chai } from 'mocha-es6';

import { obj } from 'lively.lang';
import ExpressionSerializer from '../plugins/expression-serializer.js';
import { connect } from 'lively.bindings';
import { serialize } from '../index.js';

let sut = new ExpressionSerializer({ prefix: '_prefix' });

function nativeCallback(captured) { return () => captured; }

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
      for (const moduleId of [
        'http://127.0.0.1:9011/project/foo.js',
        'https://example.test:8443/project/foo.js',
        'https://example.test/foo.js',
        'custom://example.test:8123/project/foo.js',
        'local://project/foo.js',
        'local://foo.js',
        'file:///tmp/project/foo.js',
        'file:///C:/project/foo.js',
        'file://localhost/D:/project/foo.js',
        'file://fileserver/share/project/foo.js'
      ]) {
        for (const __expr__ of ['foo({label: "ok"})', '1 / 2 + foo()', '1/2 + foo()']) {
          const expression = {
            __expr__,
            bindings: {[moduleId]: [{exported: 'bar', local: 'foo'}], 'package/helper.js': ['helper']}
          };
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
  it('keeps native callbacks out of the expression serialization protocol', () => {
    const callback = nativeCallback(23);
    expect(sut.embedValue(callback)).equals(callback);
    expect(callback()).equals(23);
  });

  it('resolves a module binding on an HTTP origin with a port', () => {
    const id = 'http://127.0.0.1:9011/expression-test.js';
    const foo = () => 23;
    Object.defineProperty(foo, Symbol.for('lively-module-meta'), {value: {package: {}, pathInPackage: id}});
    System.set(id, System.newModule({foo}));
    try {
      const encoded = sut.getExpressionForFunction(foo);
      expect(sut.requiredModulesOf__expr__(encoded)).deep.equals([id]);
      expect(sut.deserializeExpr(encoded)).equals(foo);
      expect(sut.deserializeExpr(encoded)()).equals(23);
    } finally { System.delete(id); }
  });

  it('rejects local varMapping functions even when a top-level binding has the same name', () => {
    const id = 'local://expression-local-function-test.js';
    const topLevel = function double(value) { return value * 2; };
    const local = function double(value) { return value * 3; };
    Object.defineProperty(local, Symbol.for('lively-module-meta'), {value: {package: {}, pathInPackage: id}});
    System.set(id, System.newModule({double: topLevel}));
    try {
      expect(() => sut.getExpressionForFunction(local)).throws(/no matching binding/);
      const source = {x: 1}, target = {y: 0};
      connect(source, 'x', target, 'y', {converter: 'value => double(value)', varMapping: {double: local}});
      source.x = 2;
      expect(target.y).equals(6);
      expect(() => serialize({source, target})).throws(/Cannot be serialized due to lack of module information/);
    } finally { System.delete(id); }
  });

  it('preserves exported aliases and classes as identity-checked module references', () => {
    const id = 'local://expression-alias-function-test.js';
    function original(value) { return value * 2; }
    class Original {}
    const defaultCallback = () => 3;
    Object.defineProperty(defaultCallback, 'name', {value: 'default'});
    const functions = [original, Original, defaultCallback];
    for (const func of functions) {
      Object.defineProperty(func, Symbol.for('lively-module-meta'), {value: {package: {}, pathInPackage: id}});
    }
    System.set(id, System.newModule({renamed: original, Renamed: Original, default: defaultCallback}));
    try {
      for (const func of functions) {
        const encoded = sut.getExpressionForFunction(func);
        expect(sut.deserializeExpr(encoded)).equals(func);
      }
    } finally { System.delete(id); }
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
