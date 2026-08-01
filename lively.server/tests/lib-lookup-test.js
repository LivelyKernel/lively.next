/* global describe, it */

import { expect } from 'mocha-es6';
import { findUnavailableJspmPackages, installDeps } from '../plugins/lib-lookup.js';

class FakeGenerator {
  constructor (failure) {
    this.failure = failure;
    this.installs = [];
    this.map = { imports: {} };
  }

  async install (spec) {
    this.installs.push(spec);
    if (this.failure) throw new Error(this.failure);
    this.map.imports[spec.slice(0, spec.lastIndexOf('@'))] = 'resolved';
  }

  async uninstall () {}

  getMap () { return this.map; }
}

describe('import map generation', () => {
  it('retries unavailable JSPM packages on esm.sh without changing versions', async () => {
    const firstGenerator = new FakeGenerator(
      'Unable to fetch https://ga.jspm.io/npm:ajv@6.15.0/package.json'
    );
    const fallbackGenerator = new FakeGenerator();
    const providers = {};
    const createdWith = [];

    const result = await installDeps(
      firstGenerator,
      [['eslint', '7.32.0']],
      {},
      providers,
      (inputMap, providerOverrides) => {
        createdWith.push({ inputMap, providerOverrides: { ...providerOverrides } });
        return fallbackGenerator;
      }
    );

    expect(result).equals(fallbackGenerator);
    expect(providers).deep.equals({ ajv: 'esm.sh' });
    expect(createdWith).deep.equals([{
      inputMap: false,
      providerOverrides: { ajv: 'esm.sh' }
    }]);
    expect(firstGenerator.installs).deep.equals(['eslint@7.32.0']);
    expect(fallbackGenerator.installs).deep.equals(['eslint@7.32.0']);
  });

  it('can discover multiple unavailable transitive packages', async () => {
    const generators = [
      new FakeGenerator('Unable to fetch https://ga.jspm.io/npm:ajv@6.15.0/package.json'),
      new FakeGenerator('Unable to fetch https://ga.jspm.io/npm:@babel/helper-plugin-utils@7.29.7/package.json'),
      new FakeGenerator()
    ];
    const providers = {};

    const result = await installDeps(
      generators.shift(),
      [['eslint', '7.32.0']],
      {},
      providers,
      () => generators.shift()
    );

    expect(result.installs).deep.equals(['eslint@7.32.0']);
    expect(providers).deep.equals({
      ajv: 'esm.sh',
      '@babel/helper-plugin-utils': 'esm.sh'
    });
  });

  it('checks generated module artifacts instead of trusting package metadata', async () => {
    const importMap = {
      imports: {
        available: 'https://ga.jspm.io/npm:available@1.0.0/index.js',
        missing: 'https://ga.jspm.io/npm:@scope/missing@2.0.0/index.js',
        fallback: 'https://esm.sh/*already-on-fallback@3.0.0/index.js'
      }
    };
    const requested = [];

    const unavailable = await findUnavailableJspmPackages(
      importMap,
      async (url, options) => {
        requested.push({ url, options });
        return { status: url.includes('/missing@') ? 404 : 200 };
      },
      new Map()
    );

    expect(unavailable).deep.equals(['@scope/missing']);
    expect(requested).length(2);
    expect(requested.every(({ options }) => options.method === 'HEAD')).equals(true);
  });

  it('rebuilds a map when validation finds a generated 404', async () => {
    const firstGenerator = new FakeGenerator();
    const fallbackGenerator = new FakeGenerator();
    const providers = {};
    const inputMaps = [];
    let validation = 0;

    const result = await installDeps(
      firstGenerator,
      [['package', '1.0.0']],
      {},
      providers,
      (inputMap) => {
        inputMaps.push(inputMap);
        return fallbackGenerator;
      },
      async () => validation++ === 0 ? ['transitive'] : []
    );

    expect(result).equals(fallbackGenerator);
    expect(providers).deep.equals({ transitive: 'esm.sh' });
    expect(inputMaps).deep.equals([false]);
  });
});
