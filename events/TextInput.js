import { promise } from "lively.lang";
import bowser from "bowser";

const placeholderValue = "\x01\x01",
      placeholderRe = new RegExp("\x01", "g");

export default class TextInput {

  constructor(eventDispatcher) {
    this.eventDispatcher = eventDispatcher;

    this.domState = {
      rootNode: null,
      textareaNode: null,
      eventHandlers: [],
      isInstalled: false
    }

    this.inputState = {
      composition: null,
      manualCopy: null,
      manualPaste: null
    }
  }

  install(newRootNode) {
    let domState = this.domState,
        {isInstalled, rootNode} = domState;

    if (isInstalled) {
      if (rootNode === newRootNode) return;
      this.uninstall();
    }

    domState.isInstalled = true;
    domState.rootNode = newRootNode;

    newRootNode.tabIndex = 1; // focusable so that we can relay the focus to the textarea

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // textarea element that acts as an event proxy

    var doc = newRootNode.ownerDocument,
        textareaNode = domState.textareaNode = doc.createElement("textarea");


    textareaNode.setAttribute("style", `
      position: absolute;
      /*extent cannot be 0, input won't work correctly in Chrome 52.0*/
      width: 20px; height: 20px;
      z-index: 0;
      opacity: 0;
      background: transparent;
      -moz-appearance: none;
      appearance: none;
      border: none;
      resize: none;
      outline: none;
      overflow: hidden;
      font: inherit;
      padding: 0 1px;
      margin: 0 -1px;
      text-indent: -1em;
      -ms-user-select: text;
      -moz-user-select: text;
      -webkit-user-select: text;
      user-select: text;
      /*with pre-line chrome inserts &nbsp; instead of space*/
      white-space: pre!important;`);

    if (bowser.tablet || bowser.mobile)
      textareaNode.setAttribute("x-palm-disable-auto-cap", true);

    textareaNode.setAttribute("wrap", "off");
    textareaNode.setAttribute("autocorrect", "off");
    textareaNode.setAttribute("autocapitalize", "off");
    textareaNode.setAttribute("spellcheck", false);
    textareaNode.className = "lively-text-input";
    textareaNode.value = "";
    newRootNode.insertBefore(textareaNode, newRootNode.firstChild);

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // event handlers
    domState.eventHandlers = [
      {type: "focus", node: newRootNode, fn: evt => this.onRootNodeFocus(evt), capturing: true},
      // {type: "blur", node: domNode, fn: evt => evt => domNode.focus(), capturing: true},
      {type: "keydown", node: domState.textareaNode, fn: evt => this.eventDispatcher.dispatchDOMEvent(evt), capturing: false},
      {type: "keyup",   node: domState.textareaNode, fn: evt => this.eventDispatcher.dispatchDOMEvent(evt), capturing: false},
      {type: "cut",     node: domState.textareaNode, fn: evt => this.eventDispatcher.dispatchDOMEvent(evt), capturing: false},
      {type: "copy",    node: domState.textareaNode, fn: evt => this.inputState.manualCopy ? this.inputState.manualCopy.onEvent(evt) : this.eventDispatcher.dispatchDOMEvent(evt), capturing: false},
      {type: "paste",   node: domState.textareaNode, fn: evt => this.inputState.manualPaste ? this.inputState.manualPaste.onEvent(evt) : this.eventDispatcher.dispatchDOMEvent(evt), capturing: false},

      {type: "compositionstart",  node: domState.textareaNode, fn: evt => this.onCompositionStart(evt), capturing: false},
      {type: "compositionend",    node: domState.textareaNode, fn: evt => this.onCompositionEnd(evt), capturing: false},
      {type: "compositionupdate", node: domState.textareaNode, fn: evt => this.onCompositionUpdate(evt), capturing: false},
      {type: "input",             node: domState.textareaNode, fn: evt => this.onInput(evt), capturing: false},
    ]
    domState.eventHandlers.forEach(({type, node, fn, capturing}) =>
      node.addEventListener(type, fn, capturing));

    return this;
  }

  uninstall() {
    var domState = this.domState;

    domState.isInstalled = false;

    domState.eventHandlers.forEach(({node, type, fn, capturing}) =>
      node.removeEventListener(type, fn, capturing));

    var n = domState.textareaNode;
    n && n.parentNode && n.parentNode.removeChild(n)
    domState.rootNode = null;

    return this;
  }

  resetValue() {
    var n = this.domState.textareaNode;
    n && (n.value = placeholderValue);
  }

  readValue() {
    var n = this.domState.textareaNode;
    return n ? n.value.replace(placeholderRe, "") : "";

  //   if (!n) return "";
  //   var val = n.value;
  //   var placeholder1 = placeholderValue.charAt(0);
  // // if (val == placeholder1) return "DELETE";
  //   if (val.substring(0, 2) == placeholderValue)
  //     val = val.substr(2);
  //   else if (val.charAt(0) == placeholder1)
  //     val = val.substr(1);
  //   else if (val.charAt(val.length - 1) == placeholder1)
  //     val = val.slice(0, -1);
  //   // can happen if undo in textarea isn't stopped
  //   if (val.charAt(val.length - 1) == placeholder1)
  //     val = val.slice(0, -1);
  //   return val;

  }

  focus(morph, world) {
    var node = this.domState.textareaNode;
    if (!node) return;
    node.ownerDocument.activeElement !== node && node.focus();
    if (bowser.firefox) // FF needs an extra invitation...
      Promise.resolve().then(() => node.ownerDocument.activeElement !== node && node.focus());

    if (morph && morph.isText) this.ensureBeingAtCursorOfText(morph);
    else if (world) this.ensureBeingInVisibleBoundsOfWorld(world);
  }

  blur() {
    var node = this.domState.textareaNode;
    node && node.blur();
  }

  doCopyWithMimeTypes(dataAndTypes) {
    // dataAndTypes [{data: STRING, type: mime-type-STRING}]
    return this.execCommand("manualCopy", () => {
      var el = this.domState.textareaNode;
      let h = evt => {
        el.removeEventListener('copy', h);
        evt.preventDefault();
        dataAndTypes.forEach(({data, type}) => evt.clipboardData.setData(type, data));
      }
      setTimeout(() => el.removeEventListener('copy', h), 300);
      el.addEventListener('copy', h);
      el.value = "";
      el.select();
      el.ownerDocument.execCommand("copy")
    });
  }

  doCopy(content) {
    // attempt to manually copy to the clipboard
    // this might fail for various strange browser reasons
    // also it will probably steal the focus...
    return this.execCommand("manualCopy", () => {
      var el = this.domState.textareaNode;
      el.value = content;
      el.select();
      el.ownerDocument.execCommand("copy");
    });
  }

  doPaste() {
    return this.execCommand("manualPaste", () => {
      var el = this.domState.textareaNode;
      el.value = "";
      el.select();
      el.ownerDocument.execCommand("paste");
    });
  }

  async execCommand(stateName, execFn) {
    if (!this.domState.isInstalled)
      throw new Error("Cannot copy to clipboard – input helper is not installed into DOM!");

    var state = this.inputState;
    if (state[stateName]) {
      try {
        await state[stateName].promise;
      } catch (e) {}
    }

    var deferred = promise.deferred(), isDone = false;
    state[stateName] = {
      onEvent: evt => {
        if (isDone) return;
        state[stateName] = null;
        isDone = true;
        deferred.resolve(evt);
      },
      promise: deferred.promise
    }

    execFn();

    try {
      await promise.waitFor(1000, () => isDone);
    } catch (e) {
      state[stateName] = null;
      isDone = true;
      deferred.reject(e);
    }

    return deferred.promise;
  }

  onRootNodeFocus(evt) {
    var {textareaNode, rootNode} = this.domState || {};
    if (evt.target === textareaNode || evt.target === rootNode)
      this.focus();
    this.inputState.composition = null;
  }

  onInput(evt) {
    if (this.inputState.composition) return;
    if (!evt.data) evt.data = this.readValue();
    this.resetValue();
    this.eventDispatcher.dispatchDOMEvent(evt);
  }

  onCompositionStart(evt) {
    this.inputState.composition = {};
  }

  onCompositionUpdate(evt) {
    var {composition: c} = this.inputState,
        val = this.readValue();
    if (c.lastValue === val) return;
    c.lastValue = val;
  }

  onCompositionEnd(evt) {
    this.inputState.composition = null;
  }

  setPosition(pos) {
    var {textareaNode} = this.domState || {};
    if (!textareaNode) return;
    textareaNode.style.left = pos.x + "px";
    textareaNode.style.top = pos.y + "px";
  }

  ensureBeingInVisibleBoundsOfWorld(world) {
    this.setPosition(world.visibleBounds().center());
  }

  ensureBeingAtCursorOfText(textMorph) {
    // move the textarea to the text cursor

    if (!textMorph.world()) return;

    let localCursorPos = textMorph.textLayout.pixelPositionFor(textMorph, textMorph.cursorPosition),
        posInClippedBounds = textMorph.innerBounds().constrainPt(localCursorPos),
        globalCursorPos = textMorph.worldPoint(posInClippedBounds.subPt(textMorph.scroll));
    this.setPosition(globalCursorPos);
  }
}
