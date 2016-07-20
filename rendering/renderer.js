import { promise } from "lively.lang";
import { addOrChangeCSSDeclaration, addOrChangeLinkedCSS } from "./dom-helper.js";

const defaultCSS = `

.no-html-select {
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  -khtml-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
}

.morph {
  /*for aliasing issue in chrome: http://stackoverflow.com/questions/6492027/css-transform-jagged-edges-in-chrome*/
  -webkit-backface-visibility: hidden;

  /*include border size in extent of element*/
  box-sizing: border-box;

  /*don't use dom selection on morphs*/
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  -khtml-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
}

.hand {
  z-index: 1;
}

.halo {
  z-index: 2;
}

.center-text {
	text-align: center;
	vertical-align: middle;
}

.halo-item {
  /*FIXME: we shouldn't need to hardcode the size...*/
	line-height: 24px !important;
	text-align: center;
	vertical-align: middle;
}
`;

export class Renderer {

  static default() { return this._default || new this() }

  constructor(world, rootNode, domEnvironment) {
    if (!world || !world.isMorph)
      throw new Error(`Trying to initialize renderer with an invalid world morph: ${world}`)
    if (!rootNode || !("nodeType" in rootNode))
      throw new Error(`Trying to initialize renderer with an invalid root node: ${rootNode}`)
    if (!domEnvironment) {
      var doc = rootNode.ownerDocument;
      domEnvironment = {window: System.global, document: doc};
    }
    this.worldMorph = world;
    world._isWorld = true; // for world() method
    world._renderer = this;
    this.rootNode = rootNode;
    this.domNode = null;
    this.domEnvironment = domEnvironment;
    this.renderMap = new WeakMap();
    this.renderWorldLoopProcess = null;
    FontMetric.initDefault(domEnvironment.document);
  }

  clear() {
    this.stopRenderWorldLoop();
    this.domNode && this.domNode.parentNode.removeChild(this.domNode);
    this.domNode = null;
    this.renderMap = new WeakMap();
    FontMetric.removeDefault();
  }

  ensureDefaultCSS() {
    return promise.waitFor(3000, () => this.domNode.ownerDocument)
      .then(doc => Promise.all([
        addOrChangeCSSDeclaration("lively-morphic-css", defaultCSS, doc),
        addOrChangeLinkedCSS("lively-font-awesome", System.decanonicalize("lively.morphic/assets/font-awesome/css/font-awesome.css"), doc)]));
  }

  startRenderWorldLoop() {
    this.worldMorph.renderAsRoot(this);
    this.renderWorldLoopProcess = this.domEnvironment.window.requestAnimationFrame(() =>
      this.startRenderWorldLoop());
    return this;
  }

  stopRenderWorldLoop() {
    this.domEnvironment.window.cancelAnimationFrame(this.renderWorldLoopProcess);
    this.renderWorldLoopProcess = null;
  }

  getNodeForMorph(morph) {
    // Hmm, this also finds dom nodes not associated with this renderer, its
    // domNode... Is this a problem?
    // return this.domNode.ownerDocument.getElementById(morph.id);

    // test, for scoped lookup, fixing the issue mentioned above
    return this.domNode ? this.domNode.querySelector("#" + morph.id) : null;
  }

  getMorphForNode(node) {
    return this.worldMorph ?
      this.worldMorph.withAllSubmorphsDetect(morph => morph.id === node.id) :
      null;
  }

}


export class FontMetric {

  static default() {
    if (!this._fontMetric) 
      throw new Error("FontMetric has not yet been initialized!")
    return this._fontMetric;
  }

  static initDefault(doc = typeof document !== "undefined" ? document : null) {
    if (!this._fontMetric) {
      this._fontMetric = new FontMetric();
      this._fontMetric.install(doc, doc.body);
    }
  }

  static removeDefault() {
    if (this._fontMetric) {
      this._fontMetric.uninstall();
      this._fontMetric = null;
    }
  }

  constructor() {
    this.charMap = [];
    this.parentElement = null;
    this.element = null;
  }

  install(doc, parentEl) {
    this.parentElement = parentEl;
    this.element = doc.createElement("div");
    this.setMeasureNodeStyles(this.element.style, true);
    this.parentElement.appendChild(this.element);
  }

  uninstall() {
    if (this.element) {
      this.parentElement.removeChild(this.element);
      this.parentElement = null;
      this.element = null;
    }
  }

  setMeasureNodeStyles(style, isRoot) {
    style.width = style.height = "auto";
    style.left = style.top = "0px";
    style.visibility = "hidden";
    style.position = "absolute";
    style.whiteSpace = "pre";
    style.font = "inherit";
    style.overflow = isRoot ? "hidden" : "visible";
  }

  measure(fontFamily, fontSize, char) {
    var rect = null;
    this.element.innerHTML = char;
    this.element.style.fontFamily = fontFamily;
    this.element.style.fontSize = fontSize + "px";
    try {
      rect = this.element.getBoundingClientRect();
    } catch(e) {
      rect = {width: 0, height:0};
    };
    return {
      height: rect.height,
      width: rect.width
    }
  }

  sizeFor(fontFamily, fontSize, char) {
    if (char.length > 1)
      return this.sizeForStr(fontFamily, fontSize, char);

    if (!this.charMap[fontFamily]) {
      this.charMap[fontFamily] = [];
    }
    if (!this.charMap[fontFamily][fontSize]) {
      this.charMap[fontFamily][fontSize] = [];
    }
    if (!this.charMap[fontFamily][fontSize][char])
      this.charMap[fontFamily][fontSize][char] = this.measure(fontFamily, fontSize, char);
    return this.charMap[fontFamily][fontSize][char];
  }

  sizeForStr(fontFamily, fontSize, str) {
    var height = 0, width = 0;
    for (let line of str.split('\n')) {
      let lineHeight = 0, lineWidth = 0;
      for (let char of line.split('')) {
        let { height: charHeight, width: charWidth } = this.sizeFor(fontFamily, fontSize, char);
        if (charHeight > lineHeight) lineHeight = charHeight;
        lineWidth += charWidth;
      }
      if (lineWidth > width) width = lineWidth;
      height += lineHeight || this.sizeFor(fontFamily, fontSize, " ").height;
    }
    return { height: height, width: width };
  }

  asciiSizes(fontFamily, fontSize) {
    var result = {};
    for (var i = 32; i <= 126; i++) {
      var char = String.fromCharCode(i);
      result[char] = this.sizeFor(fontFamily, fontSize, char)
    }
    return result;
  }
}
