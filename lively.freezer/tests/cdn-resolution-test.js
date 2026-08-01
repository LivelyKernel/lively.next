/* global describe, it */

import { expect } from 'mocha-es6';
import { resolveEsmShNodeBuiltin } from '../src/bundler.js';

describe('freezer CDN resolution', () => {
  it('resolves esm.sh Node shims through the browser import map', () => {
    const importMap = {
      scopes: {
        'esm://ga.jspm.io/': {
          events: 'esm://ga.jspm.io/npm:@jspm/core@2.1.0/nodelibs/browser/events.js',
          'node:fs/promises': 'esm://ga.jspm.io/npm:@jspm/core@2.1.0/nodelibs/browser/fs/promises.js'
        }
      }
    };
    const importer = 'esm://esm.sh/example@1.0.0/es2022/example.mjs';

    expect(resolveEsmShNodeBuiltin('/node/events.mjs', importer, importMap))
      .equals(importMap.scopes['esm://ga.jspm.io/'].events);
    expect(resolveEsmShNodeBuiltin('/node/fs/promises.mjs', importer, importMap))
      .equals(importMap.scopes['esm://ga.jspm.io/']['node:fs/promises']);
  });

  it('leaves provider modules alone when the import map has no replacement', () => {
    const importer = 'esm://esm.sh/example@1.0.0/es2022/example.mjs';
    expect(resolveEsmShNodeBuiltin('/node/events.mjs', importer, {})).equals(null);
    expect(resolveEsmShNodeBuiltin('/node/events.mjs', 'esm://ga.jspm.io/example.js', {})).equals(null);
  });
});
