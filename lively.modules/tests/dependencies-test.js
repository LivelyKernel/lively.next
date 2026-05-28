/* global beforeEach, afterEach, describe, it */

import { expect } from 'mocha-es6';
import semver from 'semver';
import { dependencyGraph, resolvePackageDependencies } from '../cjs/dependencies.js';

describe('cjs dependencies', () => {
  let previousLively;

  beforeEach(() => {
    previousLively = globalThis.lively;
    globalThis.lively = {
      ...previousLively,
      modules: {
        ...previousLively?.modules,
        semver
      }
    };
  });

  afterEach(() => {
    globalThis.lively = previousLively;
  });

  it('ignores invalid package versions when resolving dependencies', () => {
    const packageMap = {
      'app@1.0.0': {
        name: 'app',
        version: '1.0.0',
        dependencies: { dep: '^1.0.0' }
      },
      'dep@aK': {
        name: 'dep',
        version: 'aK'
      },
      'dep@1.2.0': {
        name: 'dep',
        version: '1.2.0'
      }
    };

    expect(() => dependencyGraph(packageMap)).not.throw();
    expect(resolvePackageDependencies(packageMap['app@1.0.0'], packageMap))
      .deep.equals({ dep: 'dep@1.2.0' });
    expect(dependencyGraph(packageMap)['app@1.0.0'])
      .deep.equals(['dep@1.2.0']);
  });
});
