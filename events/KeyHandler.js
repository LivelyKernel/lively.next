import Keys from "./Keys.js";
import bowser from "bowser";
import { arr } from "lively.lang";

function ensureSpaces(s) { return s.length ? s : ' '; }

function invokeKeyHandlers(morph, evt, noInputEvents = false) {
  evt = Keys.canonicalizeEvent(evt);

  let {keyCombo, key, data} = evt,
      toExecute,
      success = false,
      keyhandlers = morph.keyhandlers,
      isInputEvent = keyCombo.startsWith("input-");

  if (!keyhandlers || (noInputEvents && isInputEvent)) return false;

  for (var i = keyhandlers.length; i--;) {
    toExecute = keyhandlers[i].eventCommandLookup(morph, evt);

    if (!toExecute || !toExecute.command) continue;

    let {command, args, passEvent, count, onlyWhenFocused} = toExecute;

    if (onlyWhenFocused) {
      var world = morph.world();
      if (world && world.focusedMorph && world.focusedMorph !== morph)
        continue;
    }

    // allow keyboardHandler to consume keys
    success = command === "null" ? true : morph.execCommand(command, args, count, evt);

    // do not stop input events to not break repeating
    if (success && evt && !isInputEvent && !passEvent)
      typeof evt.stop === "function" && evt.stop();

    // reset count on success
    if (success && evt && evt.keyInputState && command !== "null")
      evt.keyInputState.count = undefined;

    if (success) break;
  }

  if (!success && isInputEvent && morph.onTextInput) {
    var count = evt && evt.keyInputState ? evt.keyInputState.count : undefined;
    success = morph.execCommand("insertstring", {string: data || key, undoGroup: 600/*ms*/}, count, evt);
    if (success && evt && evt.keyInputState)
      evt.keyInputState.count = undefined;
  }

  return success;
}


async function simulateKeys(
  morph, keyComboString,
  keyInputState = {keyChain: undefined, count: undefined}) {
  // keyComboString like "a b ctrl-c"
  // there can be multiple pressed keys separated by spaces. To simulate a
  // space press use a double space. split up the individual keys and
  // simulate each
  var pressedKeys = keyComboString.length === 1 ?
      [keyComboString] :
      keyComboString.split(/ /g).map(ensureSpaces)
  for (let keys of pressedKeys)
    await simulateKey(morph, keys, keyInputState);
}


function simulateKey(morph, keyComboString, keyInputState) {
  return invokeKeyHandlers(morph, {...Keys.keyComboToEventSpec(keyComboString), keyInputState});
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

export default class KeyHandler {

  static invokeKeyHandlers(morph, evt, noInputEvents = false) {
    return invokeKeyHandlers(morph, evt, noInputEvents);
  }

  static simulateKeys(morph, keyCombo, keyInputState) {
    return simulateKeys(morph, keyCombo, keyInputState);
  }

  static withBindings(listOfBindings, platform) {
    // listOfBindings is a list of objects that should have at least fields keys and command
    // e.g. {keys: "Ctrl-A", command: "selectall"}
    // you can make platform specific bindings like
    // {keys: {mac: "Meta-A", win: "Ctrl-A"}, command: "selectall"}
    // command can be an object specifying additional properties like "args"
    // that are being passed to the command handler when the command is executed,
    // e.g. {command: {command: "goto line start", args: {select: true}}, keys: "Shift-Home"}
    var handler = new this(platform);
    listOfBindings.forEach(({command, keys}) =>
      handler.bindKey(keys, command));
    return handler;
  }

  constructor(platform = bowserOS()) {
    this.platform = platform;
    this.keyBindings = {};
  }

  eventCommandLookup(morph, evt) {
    // Mutates evt.keyInputState keyChain / count

    let {keyCombo, keyInputState} = evt,
        cmd = this.lookup(keyCombo, keyInputState);

    // only modify keyInputState if necessary
    if (cmd && keyInputState) {
      keyInputState.keyChain = cmd.keyChain || "";
      keyInputState.count = cmd.hasOwnProperty("count") ? cmd.count : undefined;
    }

    return cmd;
  }

  lookup(keyCombo, keyInputState = {keyChain: undefined, count: undefined}) {
    // tries to find suitable command name or object for keyCombo in
    // this.keyBindings. Uses keyInputState for keychains.
    keyCombo = Keys.canonicalizeKeyCombo(keyCombo);

    var keyChain = keyInputState.keyChain || "",
        count = keyInputState.count;

    if (!keyChain && keyCombo.startsWith("Ctrl-")) {
      let countMatch = keyCombo.match(/^Ctrl-([0-9]+)/);
      if (countMatch) {
        let numArg = parseInt((typeof count === "number" ? count : "") + countMatch[1]);
        return {command: "null", count: numArg};
      }
      // universal argument
      if (keyCombo === "Ctrl-U") return {command: "null", count: 4, keyChain: keyCombo};
    }

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
      var result = {command: "null", keyChain}
      if (count !== undefined) result.count = count;
      return result;
    }

    if (!command) return undefined;
    var result = typeof command === "object" ? {...command} : {command};
    if (count !== undefined) result.count = count;
    return result;
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
