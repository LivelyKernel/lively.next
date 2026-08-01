/* global beforeEach, afterEach, describe, it */
import { expect } from 'mocha-es6';

import { getSystem, propagateImportMapCache, removeSystem } from '../src/system.js';
import { install as installHook, remove as removeHook, isInstalled as isHookInstalled } from '../src/hooks.js';

describe('hooks', () => {
  let System;
  beforeEach(() => System = getSystem('test'));
  afterEach(() => removeSystem('test'));

  it('install normalize hook', () => {
    let hook = (proceed, name, parent) => (name === 'foo' && parent === 'bar' ? Promise.resolve('123') : proceed(name, parent));
    installHook(System, 'normalize', hook);
    return Promise.all([
      System.normalize('foo', 'bar').then(n => expect(n).to.equal('123', 'install issue')),
      System.normalize('foo').then(n => expect(n).to.equal(System.baseURL + 'foo'))]);
  });

  it('remove normalize hook', () => {
    let hook = (proceed, name, parent) => (name === 'foo' && parent === 'bar' ? Promise.resolve('123') : proceed(name, parent));
    installHook(System, 'normalize', hook);
    removeHook(System, 'normalize', hook);
    return System.normalize('foo', 'bar').then(n => expect(n).to.equal(System.baseURL + 'foo', 'remove issue'));
  });

  it('remove normalize hook by name', () => {
    function hook (proceed, name, parent) { return name === 'foo' && parent === 'bar' ? Promise.resolve('123') : proceed(name, parent); }
    installHook(System, 'normalize', hook);
    removeHook(System, 'normalize', 'hook');
    return System.normalize('foo', 'bar').then(n => expect(n).to.equal(System.baseURL + 'foo', 'remove issue'));
  });

  it('hook installed test', () => {
    function hook (proceed, name, parent) { return proceed(name, parent); }
    installHook(System, 'normalize', hook);
    expect(isHookInstalled(System, 'normalize', 'hook')).to.equal(true);
  });

  it('preserves import maps across module ID normalization', () => {
    const importMap = { imports: { dependency: 'esm://cdn.example/dependency.js' } };
    System.importMapCache.set('esm://cdn.example/entry.js', importMap);

    propagateImportMapCache(
      System,
      'esm://cdn.example/entry.js',
      'http://localhost:9011/esm_cache/cdn.example/entry.js'
    );

    expect(System.importMapCache.get('http://localhost:9011/esm_cache/cdn.example/entry.js'))
      .equals(importMap);
  });
});
