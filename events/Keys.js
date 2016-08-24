import bowser from "bowser";
import { arr } from "lively.lang";

const letterRe = /[a-z]/i;

var KeyClassifier = (function() {
/*! @license
==========================================================================
SproutCore -- JavaScript Application Framework
copyright 2006-2009, Sprout Systems Inc., Apple Inc. and contributors.

Permission is hereby granted, free of charge, to any person obtaining a
copy of this software and associated documentation files (the "Software"),
to deal in the Software without restriction, including without limitation
the rights to use, copy, modify, merge, publish, distribute, sublicense,
and/or sell copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
DEALINGS IN THE SOFTWARE.

SproutCore and the SproutCore logo are trademarks of Sprout Systems, Inc.

For more information about SproutCore, visit http://www.sproutcore.com


==========================================================================
@license */

// Most of the "KeyClassifier" code is taken from SproutCore with a few changes.
  var ret = {
    MODIFIER_KEYS: {
      16: 'Shift', 17: 'Ctrl', 18: 'Alt', 224: 'Meta'
    },

    KEY_MODS: {
      "control": 1, "ctrl": 1, "alt": 2, "option" : 2, "shift": 4,
      "super": 8, "win": 8, "meta": 8, "command": 8, "cmd": 8
    },

    FUNCTION_KEYS : {
      8  : "Backspace",
      9  : "Tab",
      13 : "Enter",
      19 : "Pause",
      27 : "Esc",
      32 : "Space",
      33 : "PageUp",
      34 : "PageDown",
      35 : "End",
      36 : "Home",
      37 : "Left",
      38 : "Up",
      39 : "Right",
      40 : "Down",
      44 : "Print",
      45 : "Insert",
      46 : "Delete",
      96 : "Numpad0",
      97 : "Numpad1",
      98 : "Numpad2",
      99 : "Numpad3",
      100: "Numpad4",
      101: "Numpad5",
      102: "Numpad6",
      103: "Numpad7",
      104: "Numpad8",
      105: "Numpad9",
      '-13': "NumpadEnter",
      112: "F1",
      113: "F2",
      114: "F3",
      115: "F4",
      116: "F5",
      117: "F6",
      118: "F7",
      119: "F8",
      120: "F9",
      121: "F10",
      122: "F11",
      123: "F12",
      144: "Numlock",
      145: "Scrolllock"
    },

    PRINTABLE_KEYS: {
      32: ' ',  48: '0',  49: '1',  50: '2',  51: '3',  52: '4', 53:  '5',
      54: '6',  55: '7',  56: '8',  57: '9',  59: ';',  61: '=', 65:  'A',
      66: 'B',  67: 'C',  68: 'D',  69: 'E',  70: 'F',  71: 'G', 72:  'H',
      73: 'I',  74: 'J',  75: 'K',  76: 'L',  77: 'M',  78: 'N', 79:  'O',
      80: 'P',  81: 'Q',  82: 'R',  83: 'S',  84: 'T',  85: 'U', 86:  'V',
      87: 'W',  88: 'X',  89: 'Y',  90: 'Z', 107: '+', 109: '-', 110: '.',
      186: ';', 187: '=', 188: ',', 189: '-', 190: '.', 191: '/', 192: '`',
      219: '[', 220: '\\',221: ']', 222: "'", 111: '/', 106: '*'
    }
  };


  var {MODIFIER_KEYS, PRINTABLE_KEYS, FUNCTION_KEYS, KEY_MODS} = ret;

  // A reverse map of FUNCTION_KEYS
  var name, i;
  for (i in FUNCTION_KEYS) {
    name = FUNCTION_KEYS[i].toLowerCase();
    ret[name] = parseInt(i, 10);
  }

  // A reverse map of PRINTABLE_KEYS
  for (i in PRINTABLE_KEYS) {
    name = PRINTABLE_KEYS[i];
    ret[name] = parseInt(i, 10);
  }

  // Add the MODIFIER_KEYS, FUNCTION_KEYS and PRINTABLE_KEYS to the KEY
  // variables as well.
  Object.assign(ret, MODIFIER_KEYS, PRINTABLE_KEYS, FUNCTION_KEYS);

  // aliases
  ret["return"] = ret.enter;
  ret.escape = ret.esc;
  ret.del = ret["delete"];

  // workaround for firefox bug
  ret[173] = '-';

  (function() {
    var mods = ["alt", "command", "ctrl", "shift"];
    for (var i = Math.pow(2, mods.length); i--;)
      KEY_MODS[i] = mods.filter(x => i & KEY_MODS[x]).join("-") + "-";
  })();

  KEY_MODS[0] = "";
  KEY_MODS[-1] = "input-";

  return ret;
})();



var Keys = {
  classifier: KeyClassifier,

  keyCodeToString(keyCode) {
    // Language-switching keystroke in Chrome/Linux emits keyCode 0.
    var keyString = Keys.classifier[keyCode];
    if (typeof keyString != "string")
      keyString = String.fromCharCode(keyCode);
    return keyString;
  },

  getKeyCodeForKey: (() => {
    var keyCodeCache = {};
    return function getKeyCodeForKey(key, type) {
      // reverse mapping, key -> code
      key = key.toLowerCase();
      if (keyCodeCache[key]) return keyCodeCache[key];
      var classifier = Keys.classifier,
          base = classifier;
      // "MODIFIER_KEYS","FUNCTION_KEYS","PRINTABLE_KEYS"
      if (type) base = classifier[type];
      for (var code in base) {
        var code = Number(code);
        if (key === String(base[code]).toLowerCase()
         || code === classifier[key]/*alias*/)
          return keyCodeCache[key] = code;
      }
    }
  })(),

  isFunctionKey(string) {
    return !!Keys.getKeyCodeForKey(string, 'FUNCTION_KEYS');
  },

  isModifierKey(string) {
    return !!Keys.getKeyCodeForKey(string, 'MODIFIER_KEYS');
  },

  isPrintableKey(string) {
    return !!Keys.getKeyCodeForKey(string, 'PRINTABLE_KEYS');
  },

  keyComboToEventSpec(key, flags) {
    // key sth like alt-f, output an keyevent-like object

    // 1. create a key event object. We first gather what properties need to be
    // passed to the event creator in terms of the keyboard state

    let spec = {
      _isLivelyKeyEventSpec: true,
      keyString: '',
      keyCode: 0,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      metaKey: false,
      altGraphKey: false,
      isFunctionKey: false,
      isModified: false,
      hashId: -1,
      keyCombo: undefined,
      ...flags
    };

    // 2. Are any modifier keys pressed?
    let keyMods = key.split(/[\-]/),
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
      spec.keyCombo = key;
      spec.keyString = keyMods[1];
      if (spec.keyString.length === 1) spec.keyCode = spec.keyString.charCodeAt(0);
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
      spec.hashId = Keys.computeHashIdOfEvent(spec);
      spec.keyCombo = Keys.eventToKeyCombo(spec);
      return spec;
    }

    if (keyMods.length > 1) {
      console.warn(`Strange key "${key}" encountered in keyComboToEventSpec, parsing probably failed`);
    }

    var trailing = arr.last(keyMods);

    // 3. determine the key code and key string of the event.
    spec.isFunctionKey = Keys.isFunctionKey(trailing);
    if (spec.isFunctionKey) {
      spec.keyCode = Keys.getKeyCodeForKey(trailing, 'FUNCTION_KEYS');
      var printed = Keys.classifier.PRINTABLE_KEYS[spec.keyCode];
      if (printed) spec.keyString = printed;
    } else if (spec.isModified) {
      spec.keyString = trailing.toUpperCase();
      spec.keyCode = spec.keyString.charCodeAt(0);
    } else {
      spec.keyString = trailing;
      spec.keyCode = trailing.charCodeAt(0);
    }

    spec.hashId = Keys.computeHashIdOfEvent(spec);
    spec.keyCombo = Keys.eventToKeyCombo(spec);
    return spec;
  },

  eventToKeyCombo(evt, options) {
    // stringify event to a key or key combo
    var {ignoreModifiersIfNoCombo, ignoreKeys} = {
      ignoreModifiersIfNoCombo: false,
      ignoreKeys: [], ...options
    };

    var {keyCode, which, keyString, data} = evt;
    keyCode = keyCode || which;


    // deal with input events: They are considered coming from verbatim key
    // presses which might not be real but we maintain the data this way
    if (typeof data === "string") return "input-" + data;

    if (typeof keyCode === "undefined" && keyString)
      evt.keyCode = letterRe.test(keyString) ?
        keyString.charCodeAt(0) :
        Keys.getKeyCodeForKey(keyString);

    var hash = evt.hasOwnProperty("hashId") ? evt.hashId : Keys.computeHashIdOfEvent(evt),
        mod = Keys.classifier.KEY_MODS[hash];

    if (mod === "input-") return mod + (keyString ? keyString: Keys.keyCodeToString(keyCode));

    var keyString = keyCode ? mod + Keys.keyCodeToString(keyCode) : mod.replace(/-$/, "");

    return keyString.replace(/(^|-)([a-z])/g, (_, start, char) => start+char.toUpperCase());
  },

  computeHashIdOfEvent(evt) {
    let {keyCode, ctrlKey, altKey, shiftKey, metaKey, keyString} = evt,
        {PRINTABLE_KEYS, FUNCTION_KEYS} = Keys.classifier,
        hashId = 0 | (ctrlKey ? 1 : 0) | (altKey ? 2 : 0) | (shiftKey ? 4 : 0) | (metaKey ? 8 : 0);

    if (hashId === 0 && (!(keyCode in FUNCTION_KEYS) || (keyString && letterRe.test(keyString)))) hashId = -1;

    return hashId;
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
