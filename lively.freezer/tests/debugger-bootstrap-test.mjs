// Saved-world loaders enable debugger interception before loading snapshot modules and keep an explicit opt-out.
// A bundle chunk that loads after the live module system took over registers only modules the live system does not load.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('../src/util/bootstrap.js', import.meta.url), 'utf8');
const bootstrapSource = source.slice(source.indexOf('export async function bootstrap')).replace('export ', '');
for (const initialSetting of [undefined, false]) {
  for (const options of [{snapshot: 'http://fixture.test/snapshot.json'}, {commit: {name: 'saved'}}, {worldName: 'saved'},
    {filePath: 'saved.json'}]) {
    const settings = [], System = {debuggerInterception: initialSetting, baseURL: 'http://fixture.test/'};
    const load = async () => { settings.push(System.debuggerInterception); };
    const recorder = {World: class {}, loadMorphFromSnapshot: load, loadWorld: async () => ({addMorph () {}, onWindowResize () {}})};
    const context = {
      System, query: {}, window: {addEventListener () {}}, document: {location: {}}, $world: {env: {renderer: {bodyNode: {}}}},
      lively: {modules: {registerPackage: async () => {}, module: () => ({recorder})},
        morphic: {World: {loadFromCommit: load, loadFromDB: load, loadFromResource: load}}},
      polyfills: async () => {}, doBootstrap: false, fastPrepLivelySystem: async () => {}, askBeforeQuit: false,
      resource: () => ({readJson: async () => ({}), join: () => ({})})
    };
    await runInNewContext(`(${bootstrapSource})`, context)({...options, fastLoad: true, logError: err => { throw new Error(err); }});
    assert.deepEqual(settings, [initialSetting ?? true], 'Snapshot modules see the setting before studio initialization');
    assert.equal(context.window.__loadError__, undefined);
  }
}
console.log('debugger bootstrap: interception precedes saved-world loading');

const registerSource = source.match(/\nfunction registerFrozenChunkModules [\s\S]*?\n}\n/)[0];
const loading = 'lively.context/lib/interpreter.js', late = 'lively.context/lib/rewriter.js', url = id => 'http://fixture.test/' + id;
const loaded = {}, liveRecorder = {}, modules = {[loading]: {_recorder: liveRecorder}};
const System = {decanonicalize: url, get: id => loaded[id], set: (id, m) => { loaded[id] = m; }, newModule: exports => ({...exports}),
  REGISTER_INTERNAL: {records: {[url(loading)]: {}}}};
const R = {registry: {[loading]: {recorder: {}}, [late]: {recorder: {}}}, exportsOf: id => ({id})};
const register = runInNewContext(`(${registerSource})`, {lively: {modules: {module: id => modules[id] ||= {}}}});
assert.deepEqual(register(System, R, [loading, late]), [late]);
assert.equal(modules[loading]._recorder, liveRecorder, 'A module that loads from source keeps its recorder');
assert.equal(loaded[url(loading)], undefined, 'A module that loads from source keeps its source module');
assert.deepEqual(loaded[url(late)], {id: late});
assert.equal(modules[late]._recorder, R.registry[late].recorder);
assert.equal(modules[late]._frozenModule, true);
console.log('debugger bootstrap: late bundle chunks keep modules that load from source');
