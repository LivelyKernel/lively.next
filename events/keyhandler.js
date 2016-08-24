import Keys from "./Keys.js";
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


export class KeyHandler {

  handleKeyboard(morph, evt) {
    var {keyInputState, keyString, keyCode, hashId, keyCombo} = evt,
        keyInputState = keyInputState || {},
        keyChain = keyInputState.keyChain || "";

    var command = keyBindings[keyCombo];
    if (keyChain) {
        keyInputState.keyChain = keyChain += " " + keyCombo;
        command = keyBindings[keyChain] || command;
    }
    
    if (command && (command == "chainKeys" || command[command.length - 1] == "chainKeys")) {
      keyInputState.keyChain = keyChain || keyCombo;
      return {command: "null"};
    }
    
    if (keyChain) {
      if ((!hashId || hashId == 4) && keyString.length == 1)
        keyInputState.keyChain = keyChain.slice(0, -keyCombo.length - 1); // wait for input
      else if (hashId == -1 || keyCode > 0)
        keyInputState.keyChain = ""; // reset keyChain
    }

    return typeof command === "object" ? {...command, keyChain} : {command, keyChain}
  }
}
