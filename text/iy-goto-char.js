import { arr } from "lively.lang";
import { eqPosition } from "./position.js";
import KeyHandler from "../events/KeyHandler.js";


var commands = {

  activate: {
    name: '[IyGotoChar] activate',
    exec: function(morph, opts = {backwards: false}) {
      IyGotoCharKeyHandler.installInto(morph, opts.backwards);
      return true;
    }    
  },

  moveTo: {
    name: '[IyGotoChar] move to',
    exec: function(morph, options) {
      morph.saveMark();
      var sel = morph.selection,
          {row, column} = sel.lead,
          select = !!morph.activeMark || !sel.isEmpty(),
          start = options.backwards ? {row, column: column-1} : {row, column},
          pos = morph.document[options.backwards ? "scanBackward" : "scanForward"](
            start, (char, pos) => char === options.needle && !eqPosition(start, pos) ? pos : null);

      if (!pos) return true;
      pos.column++;
      sel.lead = pos;
      if (!select) sel.anchor = pos;
      return true;
    },
    multiSelectAction: 'forEach',
    readOnly: true
  }

}

export var activate = commands.activate;

class IyGotoCharKeyHandler extends KeyHandler {

  static installInto(textMorph, backwards = false) {
    textMorph.keyhandlers.filter(h => h.isIyGoToChar).forEach(ea => ea.uninstallFrom(textMorph));
    textMorph._keyhandlers = (textMorph._keyhandlers || []).concat(new this(backwards));
  }

  constructor(backwards = false) {
    super();
    this.charToFind = undefined;
    this.backwards = backwards;
  }

  get isIyGoToChar() { return true; }

  uninstallFrom(morph) {
    arr.remove(morph._keyhandlers || [], this)
  }

  eventCommandLookup(morph, evt) {
    // first invocation: if a key is pressed remember this char as the char
    // to search for
    // subsequent invocations: when the same char is pressed, move to the
    // next found location of that char, other wise deactivate this mode

    var debug = false,
        keyCombo = evt.keyCombo,
        isInputKey = keyCombo.startsWith("input-");

    debug && console.log(`[iy] ${keyCombo}`)
    if (evt.onlyModifiers
     || keyCombo.startsWith("Shift-")
     || (evt.isFunctionKey && !keyCombo === "Escape" && !keyCombo === "Backspace")
    || (!isInputKey && !evt.isModified && !evt.isFunctionKey)
     ) {
      debug && console.log(`[iy] => pass`)
      return {command: 'null', passEvent: true}
    }

    var key = isInputKey && keyCombo.slice("input-".length);

    if (!this.charToFind) {
      if (isInputKey) {
          debug && console.log(`[iy] find: "${key}"`)
          this.charToFind = key;
      } else {
        debug && console.log(`[iy] uninstall, before key set`)
        this.uninstallFrom(morph);
        return null;
      }
    }

    if (key !== this.charToFind) {
      debug && console.log(`[iy] uninstall, other key pressed`)
      this.uninstallFrom(morph);
      return null;
    }

    return {
      command: commands.moveTo,
      args: {backwards: this.backwards, needle: key, preventScroll: true, wrap: false}};
  }

}
