/* global System, beforeEach, afterEach, describe, it */
import { expect } from 'mocha-es6';
import { resource } from 'lively.resources';
import { projectAsset } from '../helpers.js';
import { prepareSystem } from 'lively.modules/tests/helpers.js';
import { removeSystem } from 'lively.modules/src/system.js';
import { setupBabelTranspiler } from 'lively.source-transform/babel/plugin.js';
import { setupSwcTranspiler } from 'lively.source-transform/swc/transpiler-setup.js';
import { getValueExpr } from 'lively.ide/components/helpers.js';

describe('project asset URLs', () => {
  let freezerRuntime;
  beforeEach(() => {
    freezerRuntime = lively.FreezerRuntime;
    lively.FreezerRuntime = null;
  });
  afterEach(() => { lively.FreezerRuntime = freezerRuntime; });

  it('accepts explicit module URLs for native or namespace imports', () => {
    expect(projectAsset('image.svg', 'https://example.test/local_projects/test-project/ui/main.js'))
      .equals('/local_projects/test-project/assets/image.svg');
  });

  for (const [name, setup] of [['Babel', setupBabelTranspiler], ['SWC', setupSwcTranspiler]]) {
    for (const explicit of [true, false]) {
      it(`resolves ${explicit ? 'explicit caller URLs' : 'legacy stack URLs'} through ${name} after asynchronous work`, async () => {
        const systemName = `project-asset-${name}-${explicit}`;
        const base = `local://${systemName}/`;
        const id = base + 'local_projects/asset-project/ui/module.js';
        const helperId = System.normalizeSync('lively.project/helpers.js');
        const system = prepareSystem(systemName, base);
        await setup(system);
        system.set(helperId, system.newModule({ projectAsset }));
        const caller = explicit ? ', import.meta.url' : '';
        await resource(id).ensureExistance(`import { projectAsset as asset } from ${JSON.stringify(helperId)};
import * as helpers from ${JSON.stringify(helperId)};
export var top = asset('top.svg'${caller});
export async function urls() {
  await Promise.resolve();
  return [asset('nested/icon.svg'${caller}), helpers.projectAsset('namespace.svg'${caller})];
}`);
        try {
          const mod = await system.import(id);
          expect(mod.top).equals('/local_projects/asset-project/assets/top.svg');
          expect(await mod.urls()).deep.equals([
            '/local_projects/asset-project/assets/nested/icon.svg',
            '/local_projects/asset-project/assets/namespace.svg'
          ]);
        } finally {
          removeSystem(systemName);
          await resource(base).remove();
        }
      });
    }
  }

  it('accepts the Firefox legacy stack format for existing one-argument calls', () => {
    const OriginalError = globalThis.Error;
    let url;
    try {
      globalThis.Error = class extends OriginalError {
        constructor () {
          super();
          this.stack = 'projectAsset@http://localhost/lively.project/helpers.js:8:12\nrender@http://localhost/local_projects/firefox-project/ui/main.js:12:4';
        }
      };
      url = projectAsset('image.svg');
    } finally { globalThis.Error = OriginalError; }
    expect(url).equals('/local_projects/firefox-project/assets/image.svg');
  });

  it('reports the missing module context instead of parsing an Error stack', () => {
    expect(() => projectAsset('image.svg', 'https://example.test/lively.project/helpers.js'))
      .throws(/projectAsset requires a module URL inside local_projects/);
  });

  it('preserves the frozen asset path without module metadata', () => {
    lively.FreezerRuntime = {};
    expect(projectAsset('asset-project__image.svg')).equals('./assets/asset-project__image.svg');
  });

  it('includes explicit caller metadata in generated component image expressions', () => {
    const previousProject = $world.openedProject;
    try {
      $world.openedProject = { name: 'asset-project' };
      const expr = getValueExpr('imageUrl', '/local_projects/asset-project/assets/icon.svg');
      expect(expr.__expr__).equals("projectAsset('icon.svg', import.meta.url)");
      expect(expr.bindings).deep.equals({ 'lively.project': ['projectAsset'] });
    } finally { $world.openedProject = previousProject; }
  });
});
