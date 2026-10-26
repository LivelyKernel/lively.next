/* global describe, it, System, $world */
import { expect } from 'mocha-es6';
import module from 'lively.modules/src/module.js';
import { resource } from 'lively.resources';

describe('real workspace module resources', () => {
  it('module source of a real workspace eval module is the workspace text', async () => {
    const ws = await $world.execCommand('open workspace', { language: 'javascript', content: 'const probeValue = 1;' });
    try {
      const target = ws.jsPlugin.evalEnvironment.targetModule;
      expect(target).match(/\.cp\.js$/);
      const m = module(System, target);
      m.reset && m.reset();
      expect(await resource(target).read()).equals('const probeValue = 1;', 'workspace module reads must resolve the real text morph');
      expect(await m.source()).equals('const probeValue = 1;', 'workspace module reads must resolve the real text morph');
    } finally { ws.remove(); }
  });

  it('loads module.source directly from the real workspace text', async () => {
    const ws = await $world.execCommand('open workspace', { language: 'javascript', content: 'const moduleValue = 4;' });
    try {
      const m = module(System, ws.jsPlugin.evalEnvironment.targetModule);
      m.reset();
      expect(await m.source()).equals('const moduleValue = 4;', 'module.source must read the real workspace buffer');
    } finally { ws.remove(); }
  });

  it('writing a workspace module rewrites the real workspace buffer', async () => {
    const ws = await $world.execCommand('open workspace', { language: 'javascript', content: 'const beforeWrite = 1;' });
    try {
      const target = ws.jsPlugin.evalEnvironment.targetModule;
      let error;
      try { await resource(target).write('const afterWrite = 2;'); } catch (err) { error = err; }
      expect(error).equals(undefined, 'workspace module write must resolve the real text morph');
      expect(ws.content).equals('const afterWrite = 2;', 'resource writes must rewrite the workspace buffer');
      const m = module(System, target);
      m.reset();
      expect(await m.source()).equals(ws.content, 'module source must match the rewritten workspace buffer');
    } finally { ws.remove(); }
  });

  it('evaluating in a real workspace still works and keeps text unchanged', async () => {
    const ws = await $world.execCommand('open workspace', { language: 'javascript', content: 'var probeX = 3 + 4; probeX' });
    try {
      const result = await ws.jsPlugin.runEval('var probeX = 3 + 4; probeX', {});
      expect(result.value).equals(7);
      expect(ws.content).equals('var probeX = 3 + 4; probeX');
    } finally { ws.remove(); }
  });
});
