import Keys from "./Keys.js";
import bowser from "bowser";
import { arr } from "lively.lang";
import { defaultCommandHandler } from "../commands.js";

function ensureSpaces(s) { return s.length ? s : ' '; }


export function invokeKeyHandlers(morph, evt, noInputEvents = false) {
  evt = Keys.canonicalizeEvent(evt);

  let {keyCombo, key, data} = evt,
      toExecute,
      success = false,
      {keyhandlers, commands} = morph,
      isInputEvent = keyCombo.startsWith("input-");

  if (noInputEvents && isInputEvent) return false;

  if (!commands) commands = defaultCommandHandler;
  for (var i = keyhandlers.length; i--;) {
    toExecute = keyhandlers[i].handleKeyboard(morph, evt);

    if (!toExecute || !toExecute.command) continue;

    let {command, args, passEvent} = toExecute;

    // allow keyboardHandler to consume keys
    success = command === "null" ? true : commands.exec(command, morph, args, evt);

    // do not stop input events to not break repeating
    if (success && evt && !isInputEvent && !passEvent)
      typeof evt.stop === "function" && evt.stop();

    if (success) break;
  }

  if (!success && isInputEvent) {
    success = commands.exec("insertstring", morph, {string: data || key, undoGroup: 600/*ms*/}, evt);
  }

  return success;
}


export function simulateKeys(morph, keyComboString) {
  // keyComboString like "a b ctrl-c"
  // there can be multiple pressed keys separated by spaces. To simulate a
  // space press use a double space. split up the individual keys and
  // simulate each
  var pressedKeys = keyComboString.length === 1 ?
      [keyComboString] :
      keyComboString.split(/ /g).map(ensureSpaces)
  pressedKeys.forEach(ea => simulateKey(morph, ea));
}


export function simulateKey(morph, keyComboString) {
  return invokeKeyHandlers(morph, Keys.keyComboToEventSpec(keyComboString));
}



var keyBindings = [
  {keys: {mac: 'Meta-C', win: 'Ctrl-C'}, command: {command: "clipboard copy", passEvent: true}},
  {keys: {mac: 'Meta-X', win: 'Ctrl-X'}, command: {command: "clipboard cut", passEvent: true}},
  {keys: {mac: 'Meta-V', win: 'Ctrl-V'}, command: {command: "clipboard paste", passEvent: true}},

  {keys: {mac: 'Meta-Z', win: 'Ctrl-Z'}, command: "text undo"},
  {keys: {mac: 'Meta-Shift-Z'}, command: "text redo"},

  {keys: {mac: 'Meta-A', win: 'Ctrl-A'}, command: "select all"},
  {keys: {mac: 'Meta-D', win: 'Ctrl-D'}, command: "doit"},
  {keys: {mac: 'Meta-P', win: 'Ctrl-P'}, command: "printit"},
  {keys: {mac: 'Meta-S', win: 'Ctrl-S'}, command: "saveit"},

  {keys: 'Backspace',   command: "delete backwards"},
  {keys: 'Delete',      command: "delete"},

  {keys: {win: 'Left', mac: 'Left|Ctrl-B'},       command: "move cursor left"},
  {keys: {win: 'Right', mac: 'Right|Ctrl-F'},     command: "move cursor right"},
  {keys: {win: 'Up', mac: 'Up|Ctrl-P'},           command: "move cursor up"},
  {keys: {win: 'Down', mac: 'Down|Ctrl-N'},       command: "move cursor down"},

  {keys: 'Shift-Left',  command: "select left"},
  {keys: 'Shift-Right', command: "select right"},
  {keys: 'Shift-Up',    command: "select up"},
  {keys: 'Shift-Down',  command: "select down"},

  {keys: {win: "Ctrl-Shift-L", mac: 'Meta-L'},  command: "select line"},
  {keys: {win: "Shift-Home", mac: "Shift-Home|Ctrl-Shift-A"}, command: "select to line start"},
  {keys: {win: "Home", mac: "Home|Ctrl-A"}, command: {command: "select to line start", args: {collapse: true}}},
  {keys: {win: "Shift-End", mac: "Shift-End|Ctrl-Shift-E"}, command: "select to line end"},
  {keys: {win: "End", mac: "End|Ctrl-E"}, command: {command: "select to line end", args: {collapse: true}}},
  {keys: "Ctrl-X Ctrl-X", command: "reverse selection"},

  {keys: {win: "PageDown", mac: "PageDown|Ctrl-V"},      command: "goto page down"},
  {keys: {win: "PageUp", mac: "PageUp|Alt-V"},           command: "goto page up"},
  {keys: {win: "Shift-PageDown", mac: "Shift-PageDown"}, command: "goto page down and select"},
  {keys: {win: "Shift-PageUp", mac: "Shift-PageUp"},     command: "goto page up and select"},

  {keys: {win: "Ctrl-Shift-Home", mac: "Meta-Shift-Up"},           command: "goto start and select"},
  {keys: {win: "Ctrl-Shift-End", mac: "Meta-Shift-Down"},          command: "goto end and select"},
  {keys: {win: "Ctrl-Home", mac: "Meta-Up|Meta-Home|Alt-Shift-,"}, command: "goto start"},
  {keys: {win: "Ctrl-End", mac: "Meta-Down|Meta-End|Alt-Shift-."}, command: "goto end"},

  {keys: "Ctrl-L", command: "realign top-bottom-center"},
  {keys: {win: "Ctrl-Shift-L", mac: "Ctrl-Shift-L|Alt-G G"}, command: "goto line"},

  {keys: 'Enter',       command: {command: "insertstring", args: {string: "\n", undoGroup: true}}}, // FIXME windowss
  {keys: 'Space',       command: {command: "insertstring", args: {string: " ", undoGroup: true}}},
  {keys: 'Tab',         command: {command: "insertstring", args: {string: "\t", undoGroup: true}}},
]

function bowserOS() {
  if (bowser.mac)          return "mac";
  if (bowser.windows)      return "windows";;
  if (bowser.windowsphone) return "windowsphone";
  if (bowser.linux)        return "linux";;
  if (bowser.chromeos)     return "chromeos";
  if (bowser.android)      return "android";
  if (bowser.ios)          return "ios";;
  if (bowser.blackberry)   return "blackberry";
  if (bowser.firefoxos)    return "firefoxos";
  if (bowser.webos)        return "webos";;
  if (bowser.bada)         return "bada";
  if (bowser.tizen)        return "tizen";
  if (bowser.sailfish)     return "sailfish";
  console.error(`bowserOS detection, unknown OS!`, bowser);
  return "";
}

function findKeysForPlatform(binding, platform/*bowser OS flag*/) {
  // bowser OS flags 2016-08-24:
  // bowser
  // mac
  // windows - other than Windows Phone
  // windowsphone
  // linux - other than android, chromeos, webos, tizen, and sailfish
  // chromeos
  // android
  // ios - also sets one of iphone/ipad/ipod
  // blackberry
  // firefoxos
  // webos - may also set touchpad
  // bada
  // tizen
  // sailfish
  if (!binding || typeof binding !== "object") return null;
  
  switch (platform) {
    case 'ios':          return binding.ios || binding.mac;
    case 'mac':          return binding.mac || binding.ios;
    case 'win':
    case 'windows':
    case 'windowsphone': return binding.win      || binding.windows;
    case 'linux':        return binding.linux    || binding.win     || binding.windows;
    case 'chromeos':     return binding.chromeos || binding.linux   || binding.win || binding.windows;
    case 'android':      return binding.android  || binding.linux   || binding.win || binding.windows;
    default:             return binding.linux    || binding.win     || binding.windows
  }
}

export class KeyHandler {

  static withDefaultBindings() {
    var handler = new this;
    keyBindings.forEach(({command, keys}) =>
      handler.bindKey(keys, command));
    return handler
  }

  constructor(platform = bowserOS()) {
    this.platform = platform;
    this.keyBindings = {};
  }

  handleKeyboard(morph, evt) {
    // Mutates evt.keyInputState.keyChain
    let {keyCombo, keyInputState} = evt,
        cmd = this.lookup(keyCombo, keyInputState);
    // only modify key chain if we found command
    if (cmd && keyInputState) keyInputState.keyChain = cmd.keyChain || "";

    return cmd;
  }

  lookup(keyCombo, keyInputState = {}) {
    // tries to find suitable command name or object for keyCombo in
    // this.keyBindings. Uses keyInputState for keychains.

    keyCombo = Keys.canonicalizeKeyCombo(keyCombo);
    var keyChain = keyInputState.keyChain || "";

    // for simple input test both upper and lowercase
    var combos = [keyCombo];
    if (!command && keyCombo.startsWith("input-")) {
      var upper = keyCombo.replace(/^(input-)(.*)$/, (_, before, key) => before+key.toUpperCase()),
          lower = keyCombo.replace(/^(input-)(.*)$/, (_, before, key) => before+key.toLowerCase());
      combos.push(upper, lower);
    }

    var command = combos.map(keyCombo => this.keyBindings[keyCombo])[0];

    if (keyChain) {
      var chainCombo = combos.find(keyCombo => this.keyBindings[keyChain + " " + keyCombo]);
      if (chainCombo) {
        keyChain += " " + chainCombo;
        command = this.keyBindings[keyChain] || command;
      }
    }

    if (command && command === "chainKeys") {
      keyChain = keyChain || keyCombo;
      return {command: "null", keyChain};
    }
    
    return !command ? undefined : typeof command === "object" ? {...command} : {command};
  }

  bindKey(keyCombo, command) {
    if (typeof keyCombo == "object" && keyCombo && !Array.isArray(keyCombo))
      keyCombo = findKeysForPlatform(keyCombo, this.platform);

    if (!keyCombo) return;

    if (typeof command == "function")
      return this.addCommand({exec: command, bindKey: keyCombo, name: command.name || keyCombo});
    
    var allCombos = Array.isArray(keyCombo) ?
      keyCombo : keyCombo.includes("|") ?
        keyCombo.split("|") : [keyCombo];

    allCombos.forEach((keyPart) => {
      var chain = "";
      if (keyPart.indexOf(" ") != -1) {
        var parts = keyPart.split(/\s+/);
        keyPart = parts.pop();
        parts.forEach((keyPart) => {
          var binding = Keys.canonicalizeKeyCombo(keyPart);
          chain += (chain ? " " : "") + binding;
          this.addCommandToBinding(chain, "chainKeys");
        });
        chain += " ";
      }

      this.addCommandToBinding(chain + Keys.canonicalizeKeyCombo(keyPart), command);
    });
  
    this.cleanupUnusedKeyChains();
  }

  unbindKey(keyCombo) { this.bindKey(keyCombo, null); }

  cleanupUnusedKeyChains() {
    var keys = Object.keys(this.keyBindings),
        chainedKeys = keys.filter(key => this.keyBindings[key] === "chainKeys");
    chainedKeys = arr.sortBy(chainedKeys, ea => ea.length).reverse();
    // remove all chainKeys bindings that doesn't point to a real binding
    chainedKeys.forEach(key => {
      if (keys.some(other => key !== other && other.startsWith(key))) return;
      delete this.keyBindings[key];
      arr.remove(keys, key);
      arr.remove(chainedKeys, key);
    });
  }

  addCommand(command) {
    return !command || !command.bindKey ?
      undefined : this.addCommandToBinding(command.bindKey, command);
  }

  addCommandToBinding(keyCombo, command) {

    // remove overwritten keychains
    var prev = this.keyBindings[keyCombo];
    if (prev === "chainKeys" && command != "chainKeys") {
      Object.keys(this.keyBindings).forEach(key => {
        if (key.startsWith(keyCombo))
          delete this.keyBindings[key];
      });
    }

    if (!command) delete this.keyBindings[keyCombo];
    else this.keyBindings[keyCombo] = command;
    if (command !== "chainKeys") this.cleanupUnusedKeyChains();
  }

}
