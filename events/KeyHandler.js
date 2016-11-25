import { show } from "../index.js";
import Keys from "./Keys.js";
import bowser from "bowser";
import config from "../config.js";
import { arr } from "lively.lang";

function ensureSpaces(s) { return s.length ? s : ' '; }

function invokeKeyHandlers(morph, evt, noInputEvents = false) {
  evt = Keys.canonicalizeEvent(evt);

  let {keyCombo, key, data} = evt,
      toExecute,
      executed = false,
      keyhandlers = morph.keyhandlers,
      keyInputState = evt.keyInputState || {},
      isInputEvent = keyCombo.startsWith("input-"),
      nullCommand = false,
      carryOverCount = keyInputState.count,
      carryOverKeyChain = keyInputState.keyChain || "",
      keyInputStateNeedsUpdate = false;

  if (!keyhandlers || (noInputEvents && isInputEvent)) return false;

  for (var i = keyhandlers.length; i--;) {
    toExecute = keyhandlers[i].eventCommandLookup(morph, evt);

    if (!toExecute || !toExecute.command) continue;

    let {command, args, passEvent, count, keyChain, onlyWhenFocused} = toExecute;

    // carry count and keychain along, either to be used in the command lookup
    // + execute process, or if there is no command (keyCombo is part of a key
    // chain) then update the keyInputState accordingly so that count/keyChain are
    // remembered when the next event is processed

    keyInputStateNeedsUpdate = true;
    carryOverCount = count;
    carryOverKeyChain = keyChain;

    nullCommand = command === "null"; // "null"... is there something better?!

    if (onlyWhenFocused) {
      var world = morph.world();
      if (world && world.focusedMorph && world.focusedMorph !== morph)
        continue;
    }

    executed = nullCommand ? false : morph.execCommand(command, args, count, evt);

    // do not stop input events to not break repeating
    if (executed && (!isInputEvent || command !== "insertstring")
     && !passEvent && typeof evt.stop === "function")
       evt.stop();

    if (executed || nullCommand) break;
  }

  if (!executed && !nullCommand && isInputEvent && morph.onTextInput && !carryOverKeyChain) {
    var count = keyInputState.count;
    executed = morph.execCommand("insertstring", {
      string: data || key,
      undoGroup: config.text.undoGroupDelay/*ms*/
    }, count, evt);
  }

  if (keyInputStateNeedsUpdate) {
    // delay setting the new keyInputState to allow all target morphs to
    // handle key, this is necessary when multiple morphs share the same
    // keyChain prefixes
    // keyInputState.count = carryOverCount;
    if (typeof evt.onAfterDispatch === "function") {
      evt.onAfterDispatch(() => {
        keyInputState.count = executed ? undefined : carryOverCount;
        keyInputState.keyChain = executed ? "" : carryOverKeyChain;
      });
    } else {
      keyInputState.count = executed ? undefined : carryOverCount;
      keyInputState.keyChain = executed ? "" : carryOverKeyChain;
    }
  }

  // when isKeyChainPrefix was detected, do not return a truthy value so that
  // submorphs that might also be the event target can process the evt as well.
  // This is necessary to allow for shared keyChain prefixes in multiple morphs,
  // sth like "Ctrl-X D" in the world and "Ctrl-X Ctrl-X" in a text morph.
  return executed && !nullCommand;
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

export function findKeysForPlatform(binding, platform/*bowser OS flag*/) {
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

  if (typeof binding === "string") return binding;

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
    listOfBindings.forEach(({command, keys}) => handler.bindKey(keys, command));
    return handler;
  }

  static generateCommandToKeybindingMap(morph, includeOwnerCommands = false) {
    var keyMaps = {}, commandsToKeys = {},
        commands = includeOwnerCommands ?
          morph.commandsIncludingOwners :
          morph.commands.map(command => ({command, target: morph}));

    return commands.map(({target, command}) =>
      ({keys: commandsToKeysFor(target)[command.name], target, command}));

    function commandsToKeysFor(target) {
      if (commandsToKeys[target.id]) return commandsToKeys[target.id];
      var keyMap = keyMaps[target.id] || (keyMaps[target.id] = target.keyCommandMap);
      return commandsToKeys[target.id] = arr.groupBy(Object.keys(keyMap), combo => keyMap[combo].name);
    }
  }

  constructor(platform = bowserOS()) {
    this.platform = platform;
    this.keyBindings = {};
  }

  eventCommandLookup(morph, evt) {
    let {keyCombo, keyInputState} = evt;
    return this.lookup(keyCombo, keyInputState);
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
      if (keyCombo === "Ctrl-U") return {command: "null", count: 4, keyChain: "Ctrl-U"};
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
