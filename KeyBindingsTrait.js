import KeyHandler, { findKeysForPlatform } from "./key-handler.js";

let KeyBindingsTrait = {

  addKeyBindings(bindings) {
    if (!this._keybindings) this._keybindings = [];
    this._keybindings.unshift(...bindings);
  },

  get keybindings() { return this._keybindings || []; },

  set keybindings(bndgs) {
    return this._keybindings = bndgs;
  },

  get keyhandlers() {
    // Note that reconstructing the keyhandler on every stroke might prove too
    // slow. On my machine it's currently around 10ms which isn't really noticable
    // but for snappier key behavior we might want to cache that. Tricky thing
    // about caching is to figure out when to invalidate... keys binding changes
    // can happen in a number of places
    return [KeyHandler.withBindings(this.keybindings)];
  },

  get keyCommandMap() {
    var platform = this.keyhandlers[0].platform;
    return this.keybindings.reduce((keyMap, binding) => {
      var keys = binding.keys,
          platformKeys = findKeysForPlatform(keys, platform),
          command = binding.command,
          name = typeof command === "string" ? command : command.command || command.name;

      if (typeof platformKeys !== "string") return keyMap;

      return platformKeys.split("|").reduce((keyMap, combo) =>
        Object.assign(keyMap, {
          [combo]: {
            name, command,
            prettyKeys: KeyHandler.prettyCombo(combo)
          }
        }), keyMap);
    }, {});
  },

  keysForCommand(commandName, pretty = true) {
    var map = this.keyCommandMap,
        rawKey = Object.keys(map).find(key => map[key].name === commandName);
    return rawKey && pretty ? map[rawKey].prettyKeys : rawKey
  },

  simulateKeys(keyString) { return KeyHandler.simulateKeys(this, keyString); },
}

export default KeyBindingsTrait;
