/*global System, declare, it, xit, describe, xdescribe, beforeEach, afterEach, before, after*/
import { Text } from "../../text2/morph.js";
import { expect, chai } from "mocha-es6";
import { pt, Color, Rectangle, Transform, rect } from "lively.graphics";
import { dummyFontMetric as fontMetric, expectSelection } from "../test-helpers.js";
import { Range } from "../../text/range.js";
import KeyHandler from "../../events/KeyHandler.js"

function dummyPlugin() {
  return {
    installCount: 0,
    attach(text) {
      this.installCount++;
      this.text = text;
    },
    detach(text) {
      this.installCount--;
    }
  }
}

var text;
describe("text plugins", () => {

  beforeEach(() => text = new Text({textString: "Hello\n World"}))

  it("install", () => {
    var plugin = dummyPlugin();
    text.addPlugin(plugin);
    text.addPlugin(plugin);
    expect(plugin.installCount).equals(1);
    expect(plugin.text).equals(text);
    text.removePlugin(plugin);
    text.removePlugin(plugin);
    expect(plugin.installCount).equals(0);
  });

  it("can add keybindings and commands", () => {
  // text = new Text({textString: "Hello\n World"})
    var run = 0,
        pluginKeybinding = {command: "plugin-command", keys: "Alt-A"},
        pluginCommand = {name: "plugin-command", exec() { run++; return true; }},
        plugin = Object.assign(dummyPlugin(), {
          getKeyBindings(morphKeybindings) { return [pluginKeybinding].concat(morphKeybindings); },
          getCommands(morphCommands) { return [pluginCommand].concat(morphCommands); }
        });
    text.addPlugin(plugin);

    expect(text.keybindings[0]).equals(pluginKeybinding);

    text.simulateKeys("Alt-A");
    expect(run).equals(1, "command not run after key invocation");

    text.execCommand("plugin-command")
    expect(run).equals(2, "command not run after execCommand");
  });

  it("can overwrite keyhandlers", () => {
      var keyHandler = KeyHandler.withBindings([
        {keys: 'Alt-B', command: "plugin command"}
      ]);

  // text = new Text({textString: "Hello\n World"})
    var run = 0,
        pluginCommand = {name: "plugin command", exec() { run++; return true; }},
        plugin = Object.assign(dummyPlugin(), {
          getKeyHandlers(keyHandlersFromMorph) { return [keyHandler]; },
          getCommands() { return [pluginCommand]; }
        });
    text.addPlugin(plugin);

    expect(text.keyhandlers).equals([keyHandler]);
    text.simulateKeys("Alt-B");
    expect(run).equals(1, "command not run after key invocation");
  });

});
