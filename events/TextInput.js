import bowser from "bowser";

export default class TextInput {

  constructor(eventDispatcher) {
    this.eventDispatcher = eventDispatcher;
    this.rootNode = null;
    this.textareaNode = null;
    this.handlerFunctions = [];
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

    var focusSpec = {type: "focus", node: rootNode, fn: evt => this.textareaNode.focus(), capturing: true}
    this.handlerFunctions.push(focusSpec);
    rootNode.addEventListener(focusSpec.type, focusSpec.fn, focusSpec.capturing);

    // var blurSpec = {type: "blur", node: domNode, fn: evt => evt => domNode.focus(), capturing: true}
    // this.handlerFunctions.push(blurSpec);
    // domNode.addEventListener(blurSpec.type, blurSpec.fn, blurSpec.capturing);

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

    return this;
  }

  uninstall() {
    this.isInstalled = false;

    this.handlerFunctions.forEach(({node, type, fn, capturing}) =>
      node.removeEventListener(type, fn, capturing));

    var n = this.textareaNode;
    n && n.parentNode && n.parentNode.removeChild(n)
    this.rootNode = null;

    return this;
  }

  focus() { this.textareaNode && this.textareaNode.focus(); }
  blur() { this.textareaNode && this.textareaNode.blur(); }
  onKeyDown(evt) { return this.eventDispatcher.dispatchDOMEvent(evt); }
  onKeyUp(evt) { return this.eventDispatcher.dispatchDOMEvent(evt); }
  onInput(evt) { return this.eventDispatcher.dispatchDOMEvent(evt); }
}