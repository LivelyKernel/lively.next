/* global describe, it */

import { expect } from 'mocha-es6';
import { ESMResource } from '../src/esm-resource.js';

describe('ESM resource', () => {
  it('keeps providers isolated in the on-disk cache', () => {
    const jspmPath = ESMResource.normalize('esm://ga.jspm.io/npm:example@1.0.0/index.js');
    const esmShPath = ESMResource.normalize('esm://esm.sh/npm:example@1.0.0/index.js');

    expect(jspmPath).deep.equals(['ga.jspm.io', 'npm:example@1.0.0', 'index.js']);
    expect(esmShPath).deep.equals(['esm.sh', 'npm:example@1.0.0', 'index.js']);
  });
});
