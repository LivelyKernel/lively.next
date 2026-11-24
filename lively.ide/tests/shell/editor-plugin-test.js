/* global it, describe, beforeEach, afterEach */
import { expect } from 'mocha-es6';
import { module } from 'lively.modules';
import ShellEditorPlugin from 'lively.ide/shell/editor-plugin.js';

describe('shell editor plugin', () => {
  // Each test replaces the server lookup of the default directory and clears the plugin's cached one.
  const shellInterface = module('lively.ide/shell/shell-interface.js');
  const plugin = module('lively.ide/shell/editor-plugin.js');
  let original, requests;

  beforeEach(() => {
    original = { defaultDirectory: shellInterface.recorder.defaultDirectory, defaultDir: plugin.recorder.defaultDir };
    requests = 0;
    plugin.recorder.defaultDir = undefined;
    shellInterface.define('defaultDirectory', async () => { requests++; return '/server/default'; });
  });

  afterEach(() => {
    shellInterface.define('defaultDirectory', original.defaultDirectory);
    plugin.recorder.defaultDir = original.defaultDir;
  });

  it('requests the default directory of the server when the directory chooser opens', async () => {
    let offered;
    const shell = new ShellEditorPlugin();
    shell.textMorph = {
      getWindow: () => null,
      world: () => ({
        async editListPrompt (label, dirs) {
          offered = dirs;
          return { status: 'canceled', list: dirs, selections: [] };
        }
      })
    };
    expect(requests, 'constructing the plugin does not request it').equals(0);
    await shell.changeCwdInteractively();
    expect(requests).equals(1);
    expect(offered[0]).equals('/server/default');
  });
});
