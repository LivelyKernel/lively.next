/* global describe, it */

import { expect } from 'mocha-es6';
import { resource } from '../index.js';
import { adaptEsmShExportsForJspmInterop, ESMResource } from '../src/esm-resource.js';

describe('ESM resource', () => {
  it('keeps providers isolated in the on-disk cache', () => {
    const jspmPath = ESMResource.normalize('esm://ga.jspm.io/npm:example@1.0.0/index.js');
    const esmShPath = ESMResource.normalize('esm://esm.sh/npm:example@1.0.0/index.js');

    expect(jspmPath).deep.equals(['ga.jspm.io', 'npm~3Aexample@1.0.0', 'index.js']);
    expect(esmShPath).deep.equals(['esm.sh', 'npm~3Aexample@1.0.0', 'index.js']);
    expect(ESMResource.normalize('esm://ga.jspm.io/npm~3Aexample@1.0.0/index.js')).deep.equals(['ga.jspm.io', 'npm~7E3Aexample@1.0.0', 'index.js']);
  });

  it('escapes esm.sh wildcard package paths for Windows', () => {
    expect(ESMResource.normalize('esm://esm.sh/*engine.io@6.6.4/es2022/engine.io.mjs'))
      .deep.equals(['esm.sh', '~2Aengine.io@6.6.4', 'es2022', 'engine.io.mjs']);
  });

  it('checks cached module existence without contacting the provider', async () => {
    const cached = resource('local://esm-cache-test/esm_cache/provider.invalid/npm~3Ademo@1.0.0/index.js');
    await cached.ensureExistance('export default 1;');
    try {
      const module = new ESMResource('esm://provider.invalid/npm:demo@1.0.0/index.js');
      module.getBaseURL = () => 'local://esm-cache-test/';
      expect(await module.exists()).equals(true);
    } finally { await cached.remove(); }
  });

  it('preserves JSPM CommonJS default semantics for esm.sh entry modules', () => {
    const source = `/* esm.sh - @babel/template */
export * from "/@babel/template/es2022/template.mjs";
export { default } from "/@babel/template/es2022/template.mjs";`;

    expect(adaptEsmShExportsForJspmInterop(source, 'esm://esm.sh/@babel/template/lib/index.js')).equals(`/* esm.sh - @babel/template */
import * as __livelyEsmShModule from "/@babel/template/es2022/template.mjs";
export * from "/@babel/template/es2022/template.mjs";
const __livelyEsmShDefault = __livelyEsmShModule.default;
if (__livelyEsmShModule.__esModule && __livelyEsmShDefault &&
    (typeof __livelyEsmShDefault === "object" || typeof __livelyEsmShDefault === "function")) {
  for (const __livelyEsmShKey of Object.keys(__livelyEsmShModule)) {
    if (!(__livelyEsmShKey in __livelyEsmShDefault)) {
      Object.defineProperty(__livelyEsmShDefault, __livelyEsmShKey, {
        enumerable: true,
        get: () => __livelyEsmShModule[__livelyEsmShKey]
      });
    }
  }
  if (!("default" in __livelyEsmShDefault)) {
    Object.defineProperty(__livelyEsmShDefault, "default", {
      enumerable: true,
      value: __livelyEsmShDefault
    });
  }
}
export { __livelyEsmShDefault as default };`);
  });

  it('keeps ESM namespace access lazy across CommonJS cycles', () => {
    const source = 'const c=m=>Object.assign({__esModule:true},m);';
    expect(adaptEsmShExportsForJspmInterop(source, 'esm://esm.sh/package/es2022/package.mjs'))
      .equals('const c=m=>Object.create(m,{__esModule:{value:true}});');
  });

  it('does not adapt modules from other providers', () => {
    const source = 'export { default } from "./module.js";';
    expect(adaptEsmShExportsForJspmInterop(source, 'esm://ga.jspm.io/module.js')).equals(source);
  });
});
