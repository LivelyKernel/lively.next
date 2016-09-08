import bowser from "bowser";
import { arr, string } from "lively.lang";

const letterRe = /[a-z]/i;


function computeHashIdOfEvent(evt) {
  let {key, ctrlKey, altKey, shiftKey, metaKey} = evt,
      hashId = 0 | (ctrlKey ? 1 : 0) | (altKey ? 2 : 0) | (shiftKey ? 4 : 0) | (metaKey ? 8 : 0);

  if (hashId === 0 && !canonicalizeFunctionKey(key) && (key && letterRe.test(key))) hashId = -1;

  return hashId;
}

var MODIFIER_KEYS = {
  16: 'Shift', 17: 'Ctrl', 18: 'Alt', 224: 'Meta'
}

var KEY_MODS = (() => {
  var base = {
    "control": 1, "ctrl": 1, "alt": 2, "option" : 2, "shift": 4,
    "super": 8, "win": 8, "meta": 8, "command": 8, "cmd": 8
  };
  
  var mods = ["alt", "ctrl", "meta", "shift"];
  for (var i = Math.pow(2, mods.length); i--;)
    base[i] = mods.filter(x => i & base[x]).join("-") + "-";

  base[0] = "";
  base[-1] = "input-";

  return base;
})();

var isNumber = (() => {
  var numberRe = /^[0-9]+$/;
  return (key) => numberRe.test(key);
})();

function isModifier(key) {
  if (isNumber(key)) return false;
  key = key.replace(/-$/, "").toLowerCase();
  return arr.withoutAll(Object.keys(KEY_MODS), ["", "input-"]).includes(key);
}

var FUNCTION_KEYS  = [
  "backspace",
  "tab",
  "enter",
  "pause",
  "escape",
  " ",
  "pageup",
  "pagedown",
  "end",
  "home",
  "left",
  "up",
  "right",
  "down",
  "print",
  "insert",
  "delete",
  "numpad0",
  "numpad1",
  "numpad2",
  "numpad3",
  "numpad4",
  "numpad5",
  "numpad6",
  "numpad7",
  "numpad8",
  "numpad9",
  "numpadenter",
  "f1",
  "f2",
  "f3",
  "f4",
  "f5",
  "f6",
  "f7",
  "f8",
  "f9",
  "f10",
  "f11",
  "f12",
  "numlock",
  "scrolllock"
];

function canonicalizeFunctionKey(key) {
  key = key.toLowerCase();
  switch (key) {
    case 'space': key = " "; break;
    case 'esc': key = "escape"; break;
    case 'return': key = "enter"; break;
    case 'arrowleft': key = "left"; break;
    case 'arrowright': key = "right"; break;
    case 'arrowup': key = "up"; break;
    case 'arrowdown': key = "down"; break;
    case 'esc': key = "escape"; break;
    case 'return': key = "enter"; break;
  }

  return FUNCTION_KEYS.includes(key) ? string.capitalize(key) : "";
}


function decodeKeyIdentifier(identifier, keyCode) {
  // trying to find out what the String representation of the key pressed
  // in key event is.
  // Uses keyIdentifier which can be Unicode like "U+0021"

  var id = identifier,
      unicodeDecodeRe = /u\+?([\d\w]{4})/gi,
      unicodeReplacer = function (match, grp) { return String.fromCharCode(parseInt(grp, 16)); },
      key = id && id.replace(unicodeDecodeRe, unicodeReplacer);

  if (key === 'Command' || key === 'Cmd') key = "Meta";
  if (key === ' ') key = "Space";
  if (keyCode === 8/*KEY_BACKSPACE*/) key = "Backspace";
  return key;
}


function identifyKeyFromCode({code}) {
  // works on Chrome and Safari
  // https://developer.mozilla.org/en/docs/Web/API/KeyboardEvent/code
  // For certain inputs evt.key or keyCode will return the inserted char, not
  // the key pressed. For keybindings it is nicer to have the actual key,
  // however

  if (typeof code !== "string") return null
  
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Numpad")) return code;
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Arrow")) return code.slice(5);
  if (code.match(/^F[0-9]{1-2}$/)) return code;
  
  switch (code) {
    case"Insert":
    case "Home":
    case"PageUp":
    case"PageDown":       return code;
    case 'Period':        return "."
    case 'Comma':         return ","
    case 'Help':          return "Insert"
    case 'Equal':         return "=";
    case 'IntlBackslash': return "\\";
    case 'Equal':         return "=";
    case "Minus":         return "-";
    case "BracketRight":  return "]";
    case "BracketLeft":   return "[";
    case "Quote":         return  "'";
    case 'Backquote':     return "`";
    case 'Semicolon':     return ";";
  }

  return null;
}


function dedasherize(keyCombo) {
  // splits string like Meta-x or Ctrl-- into its parts
  // dedasherize("Ctrl--") => ["Ctrl", "-"]
  var parts = [];
  while (true) {
    var idx = keyCombo.indexOf("-");
    if (idx === -1) {
      if (keyCombo) parts.push(keyCombo);
      return parts;
    }
    if (idx === 0) {
      parts.push(keyCombo[0]);
      keyCombo = keyCombo.slice(2);
    } else {
      parts.push(keyCombo.slice(0, idx));
      keyCombo = keyCombo.slice(idx+1)
    }
  }
}

var Keys = {

  computeHashIdOfEvent,

  keyComboToEventSpec(keyCombo, flags) {
    // keyCombo = "Enter"
    // key sth like alt-f, output an keyevent-like object

    // 1. create a key event object. We first gather what properties need to be
    // passed to the event creator in terms of the keyboard state

    let spec = {
      _isLivelyKeyEventSpec: true,
      keyCombo: "",
      key: '',
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      metaKey: false,
      altGraphKey: false,
      isFunctionKey: false,
      isModified: false,
      ...flags
    };

    // 2. Are any modifier keys pressed?
    let keyMods = dedasherize(keyCombo),
        modsToEvent = {
          shift: "shiftKey",
          control: "ctrlKey",
          ctrl: "ctrlKey",
          alt: "altKey",
          meta: "metaKey",
          command: "metaKey",
          cmd: "metaKey"
        }

    // input event
    if (keyMods[0] === "input" && keyMods.length === 2) {
      spec.keyCombo = keyCombo;
      spec.key = keyMods[1];
      return spec;
    }

    for (let i = keyMods.length - 1; i >= 0; i--) {
      let mod = keyMods[i],
          modEventFlag = modsToEvent[mod.toLowerCase()];
      if (!modEventFlag) continue;
      keyMods.splice(i, 1);
      spec.isModified = true;
      spec[modEventFlag] = true;
    }

    // only modifiers
    if (!keyMods.length) {
      spec.keyCombo = Keys.eventToKeyCombo(spec);
      spec.key = arr.last(dedasherize(spec.keyCombo));
      return spec;
    }

    if (keyMods.length > 1) {
      console.warn(`Strange key "${keyCombo}" encountered in keyComboToEventSpec, parsing probably failed`);
    }

    var trailing = arr.last(keyMods);

    // 3. determine the key code and key string of the event.
    var fnKey = canonicalizeFunctionKey(trailing);
    if (fnKey) {
      spec.isFunctionKey = true;
      spec.key = fnKey
    } else if (spec.isModified) {
      spec.key = trailing.toUpperCase();
    } else {
      spec.key = trailing;
    }

    spec.keyCombo = Keys.eventToKeyCombo(spec);
    return spec;
  },

  eventToKeyCombo(evt, options) {
    // var evt = Keys.keyComboToEventSpec("Enter")
    // var evt = {type: "keydown", keyIdentifier: "Meta"}
    // Keys.eventToKeyCombo(x)
    // stringify event to a key or key combo
    var {ignoreModifiersIfNoCombo, ignoreKeys} = {
      ignoreModifiersIfNoCombo: false,
      ignoreKeys: [], ...options
    };

    var {key, data, keyIdentifier} = evt;

    // deal with input events: They are considered coming from verbatim key
    // presses which might not be real but we maintain the data this way
    if (typeof data === "string") return "input-" + data;

    // fallback to keyIdentifier for Safari...
    if (!key && keyIdentifier) {
      key = decodeKeyIdentifier(keyIdentifier, evt.which || evt.keyCode);
      evt.key = key = key[evt.shiftKey ? "toUpperCase" : "toLowerCase"]();
      if (isModifier(key)) return string.capitalize(key);
    }

    var mod = KEY_MODS[computeHashIdOfEvent(evt)];

    if (mod === "input-") return mod + key;

    if (evt.code) key = identifyKeyFromCode(evt) || key;

    var keyCombo = !key || isModifier(key) ? mod.replace(/-$/, "") : mod + key;

    if (keyCombo.endsWith(" ")) keyCombo = keyCombo.replace(/ $/, "space");
    if (keyCombo.match(/enter$/)) keyCombo = keyCombo.replace(/ $/, "space");

    return keyCombo.replace(/(^|-)([a-z])/g, (_, start, char) => start+char.toUpperCase());
  },

  canonicalizeKeyCombo(string) {
    return Keys.eventToKeyCombo(Keys.keyComboToEventSpec(string));
  },

  canonicalizeEvent(evt) {
    return evt._isLivelyKeyEventSpec ?
      evt : Keys.keyComboToEventSpec(Keys.eventToKeyCombo(evt));
  }

}

export default Keys;
