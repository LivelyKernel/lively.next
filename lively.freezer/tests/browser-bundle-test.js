/* global describe, it, before, System, document */
import { expect } from 'mocha-es6';

describe('public browser module bundling', function () {
  this.timeout(180000);
  let bundleModule, bundler, runtime, systemJS;

  before(async function () {
    if (System.get('@system-env').node) return this.skip();
    ({ bundleModule } = await System.import('lively.freezer'));
    const { default: Bundler } = await System.import('lively.freezer/src/bundler.js');
    const { default: resolver } = await System.import('lively.freezer/src/resolvers/browser.js');
    const { resource } = await System.import('lively.resources');
    bundler = new Bundler({ resolver });
    systemJS = await resource(System.decanonicalize('lively.freezer/src/util/system.0.21.js')).read();
  });

  for (const mode of ['None', 'SWC', 'Terser']) {
    it(`executes the generated ${mode} bundle in a clean browser realm`, async () => {
      const entryURL = System.decanonicalize('lively.freezer/tests/fixtures/browser-module.js');
      const result = await bundleModule(entryURL, {
        minify: mode !== 'None', useTerser: mode === 'Terser', compress: false,
        exclude: [], mainFunction: 'main'
      });
      const chunks = result.output.filter(output => output.type === 'chunk');
      expect(chunks).length(1);
      const entry = chunks[0];
      expect(entry.isEntry).equals(true);
      expect(entry.imports).deep.equals([]);
      expect(entry.dynamicImports).deep.equals([]);
      if (!runtime) runtime = await bundler.getRuntimeCode();

      const frame = document.createElement('iframe');
      frame.hidden = true;
      document.body.appendChild(frame);
      try {
        const realm = frame.contentWindow;
        realm.eval(runtime);
        realm.eval(systemJS);
        const loader = realm.System;
        const bundleURL = new URL(entry.fileName, System.baseURL).href;
        loader.config({ baseURL: System.baseURL });
        // Name the anonymous registration as the browser's script loader would.
        const register = loader.register.bind(loader);
        loader.register = (dependencies, declare) => register(bundleURL, dependencies, declare);
        realm.eval(entry.code);
        const exports = await loader.import(bundleURL);
        expect(await exports.main()).equals(42);
        expect(realm.__freezerBrowserMainCalls).equals(1);
      } finally {
        frame.remove();
      }
    });
  }
});
