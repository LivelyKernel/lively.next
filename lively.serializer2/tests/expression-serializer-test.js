/* global System, describe, it, beforeEach, afterEach */
import { expect, chai } from 'mocha-es6';

import { obj } from 'lively.lang';
import module from 'lively.modules/src/module.js';
import ExpressionSerializer from '../plugins/expression-serializer.js';

let sut = new ExpressionSerializer({ prefix: '_prefix' });

describe('expression serializer module exports', () => {
  it('preserves exports from a live module record', () => {
    const id = System.decanonicalize('lively.serializer2/tests/expression-serializer-test.js');
    const record = module(System, id).record();
    expect(record).to.be.ok;
    expect(sut.getModuleExports(id)).equals(record.exports);
  });

  it('reads a registered namespace without a live module record', async () => {
    const id = 'lively://expression-serializer-test/registered.js';
    const namespace = System.newModule({ answer: 42 });
    System.set(id, namespace);
    const registeredModule = module(System, id);
    try {
      expect(registeredModule.record()).equals(null);
      expect(sut.getModuleExports(id)).equals(namespace);
      expect(sut.getModuleExports(id).answer).equals(42);
    } finally { await registeredModule.unload({ forgetDeps: false }); }
  });

  it('returns no exports for an unloaded module', () => {
    expect(sut.getModuleExports('lively://expression-serializer-test/missing.js')).deep.equals({});
  });
});

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
