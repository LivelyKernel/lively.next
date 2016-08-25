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
      composition: null
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

    textareaNode.style = `
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
      white-space: pre!important;`;

    if (bowser.tablet || bowser.mobile)
      textareaNode.setAttribute("x-palm-disable-auto-cap", true);

    textareaNode.setAttribute("wrap", "off");
    textareaNode.setAttribute("autocorrect", "off");
    textareaNode.setAttribute("autocapitalize", "off");
    textareaNode.setAttribute("spellcheck", false);
    textareaNode.value = "";
    newRootNode.insertBefore(textareaNode, newRootNode.firstChild);

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // event handlers
    domState.eventHandlers = [
      bowser.firefox ? 
        {type: "focus", node: newRootNode, fn: evt => { evt.preventDefault(); this.onFocus(evt); setTimeout(() => this.focus(), 0); }, capturing: true} :
        {type: "focus", node: newRootNode, fn: evt => this.onFocus(evt), capturing: false},
      // {type: "blur", node: domNode, fn: evt => evt => domNode.focus(), capturing: true},
      {type: "keydown", node: domState.textareaNode, fn: evt => this.eventDispatcher.dispatchDOMEvent(evt), capturing: false},
      {type: "keyup",   node: domState.textareaNode, fn: evt => this.eventDispatcher.dispatchDOMEvent(evt), capturing: false},
      {type: "cut",     node: domState.textareaNode, fn: evt => this.eventDispatcher.dispatchDOMEvent(evt), capturing: false},
      {type: "copy",    node: domState.textareaNode, fn: evt => this.eventDispatcher.dispatchDOMEvent(evt), capturing: false},
      {type: "paste",   node: domState.textareaNode, fn: evt => this.eventDispatcher.dispatchDOMEvent(evt), capturing: false},

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

  focus() { this.domState.textareaNode && this.domState.textareaNode.focus(); }
  blur() { this.domState.textareaNode && this.domState.textareaNode.blur(); }
  
  onFocus(evt) {
    this.domState.textareaNode.focus();
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
}