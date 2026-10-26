/* global System, beforeEach, afterEach, describe, it */

import { expect } from 'mocha-es6';
import { resource } from 'lively.resources';
import module from '../src/module.js';
import { removeSystem } from '../src/system.js';
import { prepareSystem } from './helpers.js';

describe('lively:// workspace resources', () => {
  const id = 'text_workspace_resource_test';
  const url = `lively://lively.next-workspace/${id}.cp.js`;
  const source = 'const workspaceValue = 23;';
  let S, morphs, world, originalWorld, originalLookup;

  beforeEach(() => {
    S = prepareSystem('workspace-resource-test', 'local://workspace-resource-test/');
    morphs = { [id]: { textString: source, remove () { delete morphs[id]; } } };
    originalWorld = globalThis.$world;
    world = originalWorld || (globalThis.$world = {});
    originalLookup = world.getMorphWithId;
    world.getMorphWithId = function (id) {
      return morphs[id] || originalLookup?.call(this, id);
    };
  });

  afterEach(() => {
    if (originalLookup) world.getMorphWithId = originalLookup;
    else delete world.getMorphWithId;
    if (!originalWorld) delete globalThis.$world;
    removeSystem('workspace-resource-test');
  });

  it('reads the workspace text as its component module source', async () => {
    expect(await module(S, url).source()).equals(source);
  });

  it('still reads an exact morph id without an extension', async () => {
    expect(await module(S, `lively://text-doit/${id}`).source()).equals(source);
  });

  it('prefers an exact morph id that already ends in .cp.js', async () => {
    morphs[id + '.cp.js'] = { textString: 'const exact = true;' };
    expect(await module(S, url).source()).equals('const exact = true;');
    await S.resource(url).write('const exact = false;');
    expect(morphs[id + '.cp.js'].textString).equals('const exact = false;');
    expect(morphs[id].textString).equals(source);
  });

  it('keeps the placeholder and failed write for a missing morph', async () => {
    const missing = `lively://lively.next-workspace/${id}_missing.cp.js`;
    expect(await module(S, missing).source()).equals(`/*Could not locate ${id}_missing.cp.js*/`);
    let error;
    try { await S.resource(missing).write('unwritten'); } catch (err) { error = err; }
    expect(error).equals(`Could not save morph ${id}_missing.cp.js`);
  });

  it('writes module source back to the same workspace text morph', async () => {
    await S.resource(url).write('const workspaceValue = 42;');
    expect(morphs[id].textString).equals('const workspaceValue = 42;');
    expect(await module(S, url).source()).equals('const workspaceValue = 42;');
  });

  it('resolves the same morph through the resource extension', async () => {
    const r = resource(url);
    expect(await r.exists()).equals(morphs[id]);
    expect(await r.read()).equals(source);
    await r.write('const changed = true;');
    expect(morphs[id].textString).equals('const changed = true;');
    await r.remove();
    expect(await r.exists()).not.ok;
  });

  it('does not strip unrelated file extensions', async () => {
    const other = `lively://lively.next-workspace/${id}.txt`;
    expect(await module(S, other).source()).equals(`/*Could not locate ${id}.txt*/`);
  });
});
