import Keys from "./Keys.js";

function ensureSpaces(s) { return s.length ? s : ' '; }

export class KeyHandler {

  static callKeyHandlers(morph, evt) {
    let {hashId, keyString} = evt,
        toExecute,
        success = false,
        {keyhandlers, commands} = morph

    for (var i = keyhandlers.length; i--;) {
      toExecute = keyhandlers[i].handleKeyboard(evt);

      if (!toExecute || !toExecute.command) continue;

      let {command, args, passEvent} = toExecute;

      // allow keyboardHandler to consume keys
      success = command === "null" ? true : commands.exec(command, morph, args, evt);

      // do not stop input events to not break repeating
      if (success && evt && hashId != -1
       && passEvent != true
       && command.passEvent != true)
        evt && typeof evt.stop === "function" && evt.stop();

      if (success) break;
    }

    if (!success && hashId == -1) {
      toExecute = {command: "insertstring"};
      success = commands.exec("insertstring", morph, {keyString}, evt);
    }

    return success;
  }

  constructor(textMorph) {
    this.textMorph = textMorph;
  }

  simulateKeys(keysString) {
    // there can be multiple pressed keys separated by spaces. To simulate a
    // space press use a double space. split up the individual keys and
    // simulate each
    var pressedKeys = keysString.length === 1 ?
        [keysString] :
        keysString.split(/ /g).map(ensureSpaces)
    pressedKeys.forEach(ea => this.simulateKey(ea));
  }

  simulateKey(keySpec) {

    // var spec = keySpec(key);
    // var e = exports.createKeyboardEvent(spec);

    // if (spec.isFunctionKey || spec.isModified) {
    //     exports.normalizeCommandKeys(editor.onCommandKey.bind(editor), e, e.keyCode, {});
    // }
    // if (!e.defaultPrevented && spec.keyString) {
    //     editor.onTextInput(spec.keyString);
    //     if (editor.session.$syncInformUndoManager) // FIXME for vim
    //         editor.session.$syncInformUndoManager();
    // }

  }
}
