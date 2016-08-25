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
    success = commands.exec("insertstring", morph, {string: data || key}, evt);
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



var keyBindings = {
  'Meta-C': {command: "clipboard copy", passEvent: true},
  'Meta-X': {command: "clipboard cut", passEvent: true},
  'Meta-V': {command: "clipboard paste", passEvent: true},
  'Meta-A': "select all",
  'Meta-D': "doit",
  'Meta-P': "printit",
  'Meta-S': "saveit",
  'Backspace': "delete backwards",
  'Delete':    "delete",
  'Left':      "move cursor left",
  'Right':     "move cursor right",
  'Up':        "move cursor up",
  'Down':      "move cursor down",
  'Enter':     {command: "insertstring", args: {string: "\n"}}, // FIXME windows
  'Space':     {command: "insertstring", args: {string: " "}},
  'Tab':       {command: "insertstring", args: {string: "\t"}},
}

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
    Object.keys(keyBindings).forEach(key =>
      handler.bindKey(key, keyBindings[key]));
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

    var command = this.keyBindings[keyCombo];
    if (keyChain) {
      keyChain += " " + keyCombo;
      command = this.keyBindings[keyChain] || command;
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
