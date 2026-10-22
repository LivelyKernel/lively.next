/* global System, describe, it */
import { expect } from 'mocha-es6';
import { resource } from 'lively.resources';
import module from '../src/module.js';
import { prepareSystem } from './helpers.js';
import { removeSystem } from '../src/system.js';

describe('lazy module debugger dependencies', function () {
  it('has no eager context dependency in the module loading graph', async () => {
    const imports = await module(System, System.decanonicalize('lively.modules/src/module.js')).imports();
    expect(imports.filter(entry => /lively\.context/.test(entry.fromModule)), 'ordinary module boot must not evaluate lively.context through static imports').length(0);
  });

  it('keeps an ordinary module load free of context evaluation', async () => {
    const dir = 'local://lazy-debugger-boot/', id = dir + 'plain.js';
    const S = prepareSystem('lazy-debugger-boot', dir);
    S.debuggerInterception = true;
    await resource(id).write('export const value = "debugger mentioned only in a string";');
    try {
      const result = await S.import(id);
      expect(result.value).includes('debugger');
      const ids = Object.keys(S.get('@lively-env').loadedModules);
      expect(ids.filter(id => /lively\.context/.test(id)), 'ordinary loader must not load or evaluate context modules').length(0);
      expect(S.get('@lively-env').moduleDebugger, 'ordinary load must not install the debugger runtime').equals(undefined);
    } finally { removeSystem('lazy-debugger-boot'); await resource(dir).remove(); }
  });
});
