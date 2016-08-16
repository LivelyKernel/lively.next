import bowser from "bowser";
import { arr } from "lively.lang";

var Keys = {

  KEY_BACKSPACE: 8,
  KEY_TAB:     9,
  KEY_RETURN:   13,
  KEY_ESC:    27,
  KEY_LEFT:    37,
  KEY_UP:      38,
  KEY_RIGHT:  39,
  KEY_DOWN:    40,
  KEY_DELETE:   46,
  KEY_HOME:    36,
  KEY_END:    35,
  KEY_PAGEUP:   33,
  KEY_PAGEDOWN: 34,
  KEY_INSERT:   45,
  KEY_SPACEBAR: 32,
  KEY_SHIFT:  16,
  KEY_CTRL:    17,
  KEY_ALT:    18,
  KEY_CMD:    91,

  isCommandKey(domEvt) {
      var isCmd = false;
      if (!bowser.mac)
          isCmd = isCmd || domEvt.ctrlKey;
      if (bowser.tablet || bowser.tablet)
          isCmd = isCmd || false/*FIXME!*/
      return isCmd || domEvt.metaKey || domEvt.keyIdentifier === 'Meta';
  },
  isShiftDown(domEvt) { return !!domEvt.shiftKey },
  isCtrlDown(domEvt) { return !!domEvt.ctrlKey },
  isAltDown(domEvt) { return !!domEvt.altKey },

  manualKeyIdentifierLookup: (() => {
    // this is a fallback for browsers whose key events do not have a
    // "keyIdentifier" property.
    // FIXME: as of 12/30/2013 this is only tested on MacOS
    var keyCodeIdentifiers = {
      8: {identifier: "Backspace"},
      9: {identifier: "Tab"},
      13: {identifier: "Enter"},
      16: {identifier: "Shift"},
      17: {identifier: "Control"},
      18: {identifier: "Alt"},
      27: {identifier: "Esc"},
      32: {identifier: "Space"},
      37: {identifier: "Left"},
      38: {identifier: "Up"},
      39: {identifier: "Right"},
      40: {identifier: "Down"},
      46: {identifier: "Del"},
      48: {identifier: "0", shifted: ")"},
      49: {identifier: "1", shifted: "!"},
      50: {identifier: "2", shifted: "@"},
      51: {identifier: "3", shifted: "#"},
      52: {identifier: "4", shifted: "$"},
      53: {identifier: "5", shifted: "%"},
      54: {identifier: "6", shifted: "^"},
      55: {identifier: "7", shifted: "&"},
      56: {identifier: "8", shifted: "*"},
      57: {identifier: "9", shifted: "("},
      91: {identifier: "Command"},
      93: {identifier: "Command"},
      112: {identifier: "F1"},
      113: {identifier: "F2"},
      114: {identifier: "F3"},
      115: {identifier: "F4"},
      116: {identifier: "F5"},
      117: {identifier: "F6"},
      118: {identifier: "F7"},
      119: {identifier: "F8"},
      120: {identifier: "F9"},
      121: {identifier: "F10"},
      122: {identifier: "F11"},
      123: {identifier: "F12"},
      186: {identifier: ";", shifted:":"},
      187: {identifier: "=", shifted:"+"},
      188: {identifier: ",", shifted:"<"},
      189: {identifier: "-", shifted:"_"},
      190: {identifier: ".", shifted:">"},
      191: {identifier: "/", shifted:"?"},
      192: {identifier: "`", shifted:"~"},
      219: {identifier: "[", shifted:"{"},
      220: {identifier: "\\", shifted:"|"},
      221: {identifier: "]", shifted:"}"},
      222: {identifier: "'", shifted:"\""},
      224: {identifier: "Command"},
    }
    return function(domEvt) {
      var id, c = domEvt.keyCode,
          shifted = this.isShiftDown(domEvt),
          ctrl = this.isCtrlDown(domEvt),
          cmd = this.isCommandKey(domEvt),
          alt = this.isAltDown(domEvt);
      if ((c >= 65 && c <= 90)) {
        id = String.fromCharCode(c).toUpperCase();
      } else {
        var codeId = keyCodeIdentifiers[c];
        if (codeId === undefined) id = "???";
        else {
          id = shifted && codeId.shifted ?
            codeId.shifted : codeId.identifier
        }
      }
      if (shifted && c !== 16) id = 'Shift-' + id;
      if (alt && c !== 18) id = 'Alt-' + id;
      if (ctrl) id = 'Control-' + id;
      if (cmd && c !== 91 && c !== 93 && c !== 224) id = 'Command-' + id;
      return id
    }
  })(),

  unicodeUnescape: (() => {
    var unicodeDecodeRe = /u\+?([\d\w]{4})/gi;
    function unicodeReplacer(match, grp) { return String.fromCharCode(parseInt(grp, 16)); }
    return function(id) { return id ? id.replace(unicodeDecodeRe, unicodeReplacer) : null; }
  })(),

  decodeKeyIdentifier(keyEvt) {
    // trying to find out what the String representation of the key pressed
    // in key event is.
    // Uses keyIdentifier which can be Unicode like "U+0021"
    var key = this.unicodeUnescape(keyEvt.keyIdentifier);
    if (key === 'Meta') key = "Command";
    if (key === ' ') key = "Space";
    if (keyEvt.keyCode === this.KEY_BACKSPACE) key = "Backspace";
    return key;
  },

  pressedKeyString(domEvt, options) {
    // returns a human readable presentation of the keys pressed in the
    // event like Shift-Alt-X
    // options: {
    //   ignoreModifiersIfNoCombo: Bool, // if true don't print single mod like "Alt"
    //   ignoreKeys: Array // list of strings -- key(combos) to ignore
    // }
    options = options || {};
    if (domEvt.keyIdentifier === undefined) {
      var id = this.manualKeyIdentifierLookup(domEvt);
      if (options.ignoreModifiersIfNoCombo
       && [16,17,18,91,93,224].includes(domEvt.keyCode)
       && !id.includes('-')) return "";
      if (options.ignoreKeys && options.ignoreKeys.includes(id)) return '';
      return id;
    }
    var keyParts = [];
    // modifiers
    if (domEvt.metaKey || domEvt.keyIdentifier === 'Meta') keyParts.push('Command');
    if (this.isCtrlDown(domEvt)) keyParts.push('Control');
    if (this.isAltDown(domEvt)) keyParts.push('Alt');
    if (this.isShiftDown(domEvt)) keyParts.push('Shift');
    // key
    var id;
    if (domEvt.keyCode === this.KEY_TAB) id = 'Tab';
    else if (domEvt.keyCode === this.KEY_ESC) id = 'Esc';
    else if (domEvt.keyCode === this.KEY_DELETE) id = 'Del';
    else id = this.decodeKeyIdentifier(domEvt);
    if (options.ignoreModifiersIfNoCombo) {
      if (keyParts.length >= 1 && keyParts.includes(id)) return '';
    };
    keyParts.push(id);
    var result = arr.uniq(arr.compact(keyParts)).join('-');
    if (options.ignoreKeys && options.ignoreKeys.includes(result)) return '';
    return result;
  }
}

export default Keys;