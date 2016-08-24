import Keys from "./Keys.js";
import bowser from "bowser";
import { defaultCommandHandler } from "../commands.js";

function ensureSpaces(s) { return s.length ? s : ' '; }


export function invokeKeyHandlers(morph, evt, noInputEvents = false) {
  evt = Keys.canonicalizeEvent(evt);

  let {hashId, keyString, data} = evt,
      toExecute,
      success = false,
      {keyhandlers, commands} = morph

  if (noInputEvents && hashId === -1) return false;

  if (!commands) commands = defaultCommandHandler;
  for (var i = keyhandlers.length; i--;) {
    toExecute = keyhandlers[i].handleKeyboard(morph, evt);

    if (!toExecute || !toExecute.command) continue;

    let {command, args, passEvent} = toExecute;

    // allow keyboardHandler to consume keys
    success = command === "null" ? true : commands.exec(command, morph, args, evt);

    // do not stop input events to not break repeating
    if (success && evt && hashId != -1 && !passEvent)
      typeof evt.stop === "function" && evt.stop();

    if (success) break;
  }

  if (!success && hashId == -1) {
    success = commands.exec("insertstring", morph, {string: data || keyString}, evt);
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
  'Command-C': {command: "clipboard copy", passEvent: true},
  'Command-X': {command: "clipboard cut", passEvent: true},
  'Command-V': {command: "clipboard paste", passEvent: true},
  'Command-A': "select all",
  'Command-D': "doit",
  'Command-P': "printit",
  'Command-S': "saveit",
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
    case 'windows':
    case 'windowsphone': return binding.windows;
    case 'linux':        return binding.linux || binding.windows;
    case 'chromeos':     return binding.chromeos || binding.linux || binding.windows;
    case 'android':      return binding.android || binding.linux || binding.windows;
    default:             return binding.linux || binding.windows
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
    return this.lookup(evt.keyCombo, evt.keyInputState, evt);
  }

  lookup(keyCombo, keyInputState = {}, evt = null) {
    // tries to find suitable command name or object for keyCombo in
    // this.keyBindings. Uses keyInputState for keychains. If key chaining is
    // detected, mutates keyInputState

    keyCombo = Keys.canonicalizeKeyCombo(keyCombo);
    var keyChain = keyInputState.keyChain || "";

    var command = this.keyBindings[keyCombo];
    if (keyChain) {
      keyInputState.keyChain = keyChain += " " + keyCombo;
      command = keyBindings[keyChain] || command;
    }
    
    if (command && command === "chainKeys") {
      keyChain = keyInputState.keyChain = keyChain || keyCombo;
      return {command: "null", keyChain};
    }
    
    if (keyChain) {
      let {hashId, keyString, keyCode} = evt || Keys.keyComboToEventSpec(keyCombo)
      if ((!hashId || hashId == 4) && keyString.length == 1)
        keyChain = keyInputState.keyChain = keyChain.slice(0, -keyCombo.length - 1); // wait for input
      else if (hashId == -1 || keyCode > 0)
        keyChain = keyInputState.keyChain = ""; // reset keyChain
    }

    return !command ? undefined :
      (typeof command === "object" ?
        (keyChain ? {...command, keyChain} : command) :
        (keyChain ? {command, keyChain} : {command}));
  }

  bindKey(keyCombo, command) {
    if (typeof keyCombo == "object" && keyCombo)
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

      this.addCommandToBinding(Keys.canonicalizeKeyCombo(keyPart), command);
    });
  }

  addCommand(command) {
    if (!command || command.bindKey) return;
  }

  addCommandToBinding(keyCombo, command) {
    if (!command) delete this.keyBindings[keyCombo];
    else this.keyBindings[keyCombo] = command;
  }

}
