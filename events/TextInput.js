import bowser from "bowser";

export default class TextInput {

  constructor(eventDispatcher) {
    this.eventDispatcher = eventDispatcher;
    this.rootNode = null;
    this.textareaNode = null;
    this.eventHandlers = [];
    this.isInstalled = false;
  }

  install(rootNode) {
    if (this.isInstalled) {
      if (this.rootNode === rootNode) return;
      this.uninstall();
    }

    this.isInstalled = true;
    this.rootNode = rootNode;

    rootNode.tabIndex = 1; // focusable so that we can relay the focus to the textarea

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // textarea element that acts as an event proxy

    var doc = rootNode.ownerDocument,
        textareaNode = this.textareaNode = doc.createElement("textarea");
    textareaNode.style = `
      position: absolute;
      width: 0px; height: 0px;
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
    rootNode.insertBefore(textareaNode, rootNode.firstChild);

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // event handlers
    this.eventHandlers = [
      {type: "focus", node: rootNode, fn: evt => this.textareaNode.focus(), capturing: true},
      // {type: "blur", node: domNode, fn: evt => evt => domNode.focus(), capturing: true},
      {type: "keydown", node: this.textareaNode, fn: evt => this.eventDispatcher.dispatchDOMEvent(evt), capturing: false},
      {type: "keyup",   node: this.textareaNode, fn: evt => this.eventDispatcher.dispatchDOMEvent(evt), capturing: false},
      {type: "cut",     node: this.textareaNode, fn: evt => this.eventDispatcher.dispatchDOMEvent(evt), capturing: false},
      {type: "copy",    node: this.textareaNode, fn: evt => this.eventDispatcher.dispatchDOMEvent(evt), capturing: false},
      {type: "paste",   node: this.textareaNode, fn: evt => this.eventDispatcher.dispatchDOMEvent(evt), capturing: false}
    ]
    this.eventHandlers.forEach(({type, node, fn, capturing}) =>
      rootNode.addEventListener(type, fn, capturing));

    return this;
  }

  uninstall() {
    this.isInstalled = false;

    this.eventHandlers.forEach(({node, type, fn, capturing}) =>
      node.removeEventListener(type, fn, capturing));

    var n = this.textareaNode;
    n && n.parentNode && n.parentNode.removeChild(n)
    this.rootNode = null;

    return this;
  }

  focus() { this.textareaNode && this.textareaNode.focus(); }
  blur() { this.textareaNode && this.textareaNode.blur(); }
}