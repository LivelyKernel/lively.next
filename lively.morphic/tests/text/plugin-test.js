/* global System, it, describe, xdescribe, beforeEach */
import { Text } from '../../text/morph.js';
import { expect } from 'mocha-es6';

import KeyHandler from '../../events/KeyHandler.js';

let describeInBrowser = System.get('@system-env').browser
  ? describe
  : (title, fn) => { console.warn(`Test "${title}" is currently only supported in a browser`); return xdescribe(title, fn); };

function dummyPlugin () {
  return {
    installCount: 0,
    attach (text) {
      this.installCount++;
      this.text = text;
    },
    detach (text) {
      this.installCount--;
    }
  };
}

let text;
describeInBrowser('text plugins', () => {
  beforeEach(() => text = new Text({ textString: 'Hello\n World', readOnly: false }));

  it('install', () => {
    let plugin = dummyPlugin();
    text.addPlugin(plugin);
    text.addPlugin(plugin);
    expect(plugin.installCount).equals(1);
    expect(plugin.text).equals(text);
    text.removePlugin(plugin);
    text.removePlugin(plugin);
    expect(plugin.installCount).equals(0);
  });

  it('can add keybindings and commands', () => {
  // text = new Text({textString: "Hello\n World"})
    let run = 0;
    let pluginKeybinding = { command: 'plugin-command', keys: 'Alt-A' };
    let pluginCommand = { name: 'plugin-command', exec () { run++; return true; } };
    let plugin = Object.assign(dummyPlugin(), {
      getKeyBindings (morphKeybindings) { return [pluginKeybinding].concat(morphKeybindings); },
      getCommands (morphCommands) { return [pluginCommand].concat(morphCommands); }
    });
    text.addPlugin(plugin);

    expect(text.keybindings[0]).equals(pluginKeybinding);

    text.simulateKeys('Alt-A');
    expect(run).equals(1, 'command not run after key invocation');
    text.execCommand('plugin-command');
    expect(run).equals(2, 'command not run after execCommand');
  });

  it('can overwrite keyhandlers', () => {
    let keyHandler = KeyHandler.withBindings([
      { keys: 'Alt-B', command: 'plugin command' }
    ]);

    // text = new Text({textString: "Hello\n World"})
    let run = 0;
    let pluginCommand = { name: 'plugin command', exec () { run++; return true; } };
    let plugin = Object.assign(dummyPlugin(), {
      getKeyHandlers (keyHandlersFromMorph) { return [keyHandler]; },
      getCommands () { return [pluginCommand]; }
    });
    text.addPlugin(plugin);

    expect(text.keyhandlers).equals([keyHandler]);
    text.simulateKeys('Alt-B');
    expect(run).equals(1, 'command not run after key invocation');
  });
});
