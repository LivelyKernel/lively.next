import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('../src/util/bootstrap.js', import.meta.url), 'utf8');
const bootstrapSource = source.slice(source.indexOf('export async function bootstrap')).replace('export ', '');

for (const initialSetting of [undefined, false]) {
  for (const options of [{snapshot: 'http://fixture.test/snapshot.json'}, {commit: {name: 'saved'}}, {worldName: 'saved'}, {filePath: 'saved.json'}]) {
    const settings = [];
    const System = {debuggerInterception: initialSetting, baseURL: 'http://fixture.test/'};
    const load = async () => { settings.push(System.debuggerInterception); };
    const modules = {
      registerPackage: async () => {},
      module: () => ({recorder: {
        World: class {}, loadMorphFromSnapshot: load,
        loadWorld: async () => ({addMorph () {}, onWindowResize () {}})
      }})
    };
    const context = {
      System, query: {}, window: {addEventListener () {}}, document: {location: {}},
      $world: {env: {renderer: {bodyNode: {}}}},
      lively: {modules, morphic: {World: {loadFromCommit: load, loadFromDB: load, loadFromResource: load}}},
      polyfills: async () => {}, doBootstrap: false, fastPrepLivelySystem: async () => {}, askBeforeQuit: false,
      resource: () => ({readJson: async () => ({}), join: () => ({})})
    };
    const bootstrap = runInNewContext(`(${bootstrapSource})`, context);
    await bootstrap({...options, fastLoad: true, logError: err => { throw new Error(err); }});
    assert.deepEqual(settings, [initialSetting ?? true], 'Snapshot modules must see the setting before studio initialization');
    assert.equal(context.window.__loadError__, undefined);
  }
}
console.log('Saved-world loaders enable debugger interception before loading snapshot modules and preserve an explicit opt-out.');
