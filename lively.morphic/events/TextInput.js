/* global show */
import { promise } from 'lively.lang';
import bowser from 'bowser';
import { touchInputDevice } from '../helpers.js';

const placeholderValue = '\x01\x01';
const placeholderRe = new RegExp('\x01', 'g');

export default class TextInput {
  constructor (eventDispatcher) {
    this.eventDispatcher = eventDispatcher;

    this.domState = {
      rootNode: null,
      textareaNode: null,
      eventHandlers: [],
      isInstalled: false
    };

    this.inputState = {
      composition: null,
      manualCopy: null,
      manualPaste: null,
      positionChangedTime: 0,
      scrollLeftWhenChanged: 0,
      scrollTopWhenChanged: 0
    };
  }

  install (newRootNode, world) {
    const domState = this.domState;
    const { isInstalled, rootNode } = domState;

    this.world = world;

    if (isInstalled) {
      if (rootNode === newRootNode) return;
      this.uninstall();
    }

    domState.isInstalled = true;
    domState.rootNode = newRootNode;

    newRootNode.tabIndex = 1; // focusable so that we can relay the focus to the textarea

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // textarea element that acts as an event proxy

    const doc = newRootNode.ownerDocument;
    const textareaNode = domState.textareaNode = doc.createElement('textarea');

    textareaNode.setAttribute('style', `
      position: absolute;
      /*extent cannot be 0, input won't work correctly in Chrome 52.0*/
      width: 20px; height: 20px;
      z-index: 0;
      opacity: 1;
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

    if (touchInputDevice) {
      textareaNode.setAttribute('x-palm-disable-auto-cap', true);
    }

    textareaNode.setAttribute('wrap', 'off');
    textareaNode.setAttribute('autocorrect', 'off');
    textareaNode.setAttribute('autocapitalize', 'off');
    textareaNode.setAttribute('spellcheck', false);
    textareaNode.setAttribute('aria-label', 'Lively Textinput Node');
    textareaNode.className = 'lively-text-input';
    textareaNode.value = '';
    newRootNode.insertBefore(textareaNode, newRootNode.firstChild);

    if (touchInputDevice) {
      textareaNode.setAttribute('disabled', true);
      textareaNode.style.setProperty('transform', 'scale(0)');
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // event handlers
    domState.eventHandlers = [
      { type: 'focusin', node: newRootNode, fn: evt => this.onRootNodeFocus(evt), capturing: true },
      { type: 'focusin', node: domState.textareaNode, fn: evt => this.onTextAreaFocus(evt), capturing: true },
      { type: 'blur', node: domState.textareaNode, fn: evt => this.onTextAreaBlur(evt), capturing: true },
      { type: 'keydown', node: domState.textareaNode, fn: evt => this.eventDispatcher.dispatchDOMEvent(evt), capturing: false },
      { type: 'keyup', node: domState.textareaNode, fn: evt => this.eventDispatcher.dispatchDOMEvent(evt), capturing: false },
      { type: 'cut', node: domState.textareaNode, fn: evt => this.eventDispatcher.dispatchDOMEvent(evt), capturing: false },
      { type: 'copy', node: domState.textareaNode, fn: evt => this.inputState.manualCopy ? this.inputState.manualCopy.onEvent(evt) : this.eventDispatcher.dispatchDOMEvent(evt), capturing: false },
      { type: 'paste', node: domState.textareaNode, fn: evt => this.inputState.manualPaste ? this.inputState.manualPaste.onEvent(evt) : this.eventDispatcher.dispatchDOMEvent(evt), capturing: false },

      { type: 'compositionstart', node: domState.textareaNode, fn: evt => this.onCompositionStart(evt), capturing: false },
      { type: 'compositionend', node: domState.textareaNode, fn: evt => this.onCompositionEnd(evt), capturing: false },
      { type: 'compositionupdate', node: domState.textareaNode, fn: evt => this.onCompositionUpdate(evt), capturing: false },
      { type: 'input', node: domState.textareaNode, fn: evt => this.onInput(evt), capturing: false }
    ];
    domState.eventHandlers.forEach(({ type, node, fn, capturing }) =>
      node.addEventListener(type, fn, capturing));

    return this;
  }

  uninstall () {
    const domState = this.domState;

    domState.isInstalled = false;

    domState.eventHandlers.forEach(({ node, type, fn, capturing }) =>
      node.removeEventListener(type, fn, capturing));

    const n = domState.textareaNode;
    n && n.parentNode && n.parentNode.removeChild(n);
    domState.rootNode = null;

    return this;
  }

  resetValue () {
    const n = this.domState.textareaNode;
    n && (n.value = placeholderValue);
  }

  readValue () {
    const n = this.domState.textareaNode;
    return n ? n.value.replace(placeholderRe, '') : '';

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

  focus (morph, world) {
    const node = this.domState.textareaNode;
    if (!node) return;

    if (touchInputDevice) {
      /*
        On mobile we can not simply focus arbitrarliy, but only
        when a morph that accepts actual text input is focused

        In order to not get fucked over by the accompanying zoom
        effect in mobile browsers, we need to adjust the position
        of the textNode accordingly
      */
      if (morph && morph.isText && !morph.readOnly) {
        node.removeAttribute('disabled');
      } else if (morph && !morph.isText) {
        // node.setAttribute('disabled', true);
      }
    }

    if (!morph || !morph.stealFocus) {
      node.getRootNode().activeElement !== node && node.focus();
    }

    if (bowser.firefox) // FF needs an extra invitation...
    { Promise.resolve().then(() => node.getRootNode().activeElement !== node && node.focus()); }

    if (morph && morph.isText && morph.document && morph.focusable) {
      // need this even if node === activeElement
      // to bring up virtual keyboard on iPad
      if (touchInputDevice) node.focus();
      this.ensureBeingAtCursorOfText(morph);
    } else if (world) this.ensureBeingInVisibleBoundsOfWorld(world);
  }

  blur () {
    const node = this.domState.textareaNode;
    if (touchInputDevice) {
      node.setAttribute('disabled', true);
    }

    node && node.blur();
  }

  doCopyWithMimeTypes (dataAndTypes) {
    // dataAndTypes [{data: STRING, type: mime-type-STRING}]
    return this.execCommand('manualCopy', () => {
      const el = this.domState.textareaNode;
      const h = evt => {
        el.removeEventListener('copy', h);
        evt.preventDefault();
        dataAndTypes.forEach(({ data, type }) => evt.clipboardData.setData(type, data));
      };
      setTimeout(() => el.removeEventListener('copy', h), 300);
      el.addEventListener('copy', h);
      el.value = '';
      el.select();
      el.ownerDocument.execCommand('copy');
    });
  }

  doCopy (content) {
    // attempt to manually copy to the clipboard
    // this might fail for various strange browser reasons
    // also it will probably steal the focus...
    return this.execCommand('manualCopy', () => {
      const el = this.domState.textareaNode;
      el.value = content;
      el.select();
      el.ownerDocument.execCommand('copy');
    });
  }

  doPaste () {
    return this.execCommand('manualPaste', () => {
      const el = this.domState.textareaNode;
      el.value = '';
      el.select();
      el.ownerDocument.execCommand('paste');
    });
  }

  async execCommand (stateName, execFn) {
    if (!this.domState.isInstalled) { throw new Error('Cannot copy to clipboard – input helper is not installed into DOM!'); }

    const state = this.inputState;
    if (state[stateName]) {
      try {
        await state[stateName].promise;
      } catch (e) {}
    }

    const deferred = promise.deferred(); let isDone = false;
    state[stateName] = {
      onEvent: evt => {
        if (isDone) return;
        state[stateName] = null;
        isDone = true;
        deferred.resolve(evt);
      },
      promise: deferred.promise
    };

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

  onTextAreaBlur (evt) {
    /*
      On mobile browsers, the continuous capturing of keyboard events
      causes the keyboard to show up at all times. We therefore disable
      this behavior for either mobile or tablets

      This refocusing breaks the text selection of plain html.
      Stop that focusing if the morph explicitly steals the focus.
      Should be handled with care...
    */
    setTimeout(() => {
      const { textareaNode, rootNode } = this.domState || {};
      if (!textareaNode || !rootNode) return;
      const doc = textareaNode.getRootNode();
      const focusNotStolen = !(this.world.focusedMorph && this.world.focusedMorph.stealFocus);
      if (
        (doc.activeElement === rootNode || this.world.isEmbedded && !doc.activeElement) &&
        focusNotStolen &&
        !touchInputDevice
      ) {
        textareaNode.focus();
      }
    });
  }

  onTextAreaFocus (evt) {}

  onRootNodeFocus (evt) {
    const { textareaNode, rootNode } = this.domState || {};
    if (evt.target === textareaNode || evt.target === rootNode) {
      if (!(this.world.focusedMorph && this.world.focusedMorph.stealFocus)) { this.focus(); }
    }

    this.inputState.composition = null;
  }

  onInput (evt) {
    if (this.inputState.composition) return;
    if (!evt.data) {
      const data = this.readValue();
      evt.__defineGetter__('data', () => data);
    }
    this.resetValue();
    this.eventDispatcher.dispatchDOMEvent(evt);
  }

  onCompositionStart (evt) {
    this.inputState.composition = {};
    this.eventDispatcher.dispatchDOMEvent(evt);
  }

  onCompositionUpdate (evt) {
    const { composition: c } = this.inputState;
    const val = this.readValue();
    if (c.lastValue === val) return;
    c.lastValue = val;
    this.eventDispatcher.dispatchDOMEvent(evt);
  }

  onCompositionEnd (evt) {
    this.inputState.composition = null;
    this.eventDispatcher.dispatchDOMEvent(evt);
  }

  setPosition (pos) {
    const { textareaNode } = this.domState || {};
    if (!textareaNode) return;
    textareaNode.style.left = pos.x + 'px';
    textareaNode.style.top = pos.y + 'px';
  }

  ensureBeingInVisibleBoundsOfWorld (world) {
    this.setPosition(world.visibleBounds().center());
  }

  ensureBeingAtCursorOfText (textMorph) {
    // move the textarea to the text cursor
    if (textMorph.readOnly) return;

    const world = textMorph.world();
    if (!world) return;

    const { startRow, endRow } = textMorph.whatsVisible;
    let { row, column } = textMorph.cursorPosition;
    row = Math.max(startRow, Math.min(row, endRow));
    const localCursorPos = textMorph.charBoundsFromTextPosition({ row, column }).topLeft();
    const globalCursorPos = world.visibleBounds().insetBy(10).constrainPt(
      textMorph.worldPoint(
        localCursorPos.subPt(textMorph.scroll)));

    // rk 2017-07-02: Experimental, when input/text areas are focused the DOM
    // tries to auto scroll to them, even if they are inside the visible bounds
    // this can lead to the screen "jumping".  For a first fix, we remember the
    // scroll here and restore it in World>>onWorldScroll if we think the scroll
    // originated from the text area focus
    this.inputState.positionChangedTime = Date.now();
    this.inputState.scrollLeftWhenChanged = document.documentElement.scrollLeft;
    this.inputState.scrollTopWhenChanged = document.documentElement.scrollTop;

    this.setPosition(globalCursorPos);
  }

  ensureInputNode () {
    const { textareaNode, rootNode } = this.domState;
    if (!textareaNode.isConnected) {
      rootNode.insertBefore(textareaNode, rootNode.firstChild);
    }
  }
}
