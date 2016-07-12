import { promise } from "lively.lang";
import vdom from "virtual-dom";
import { addOrChangeCSSDeclaration } from "./dom-helper.js";

var {h, diff, patch, create} = vdom;

const defaultCSS = `
.morph {
  box-sizing: border-box;
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
`;

export class Renderer {

  static default() { return this._default || new this() }

  constructor(world, rootNode, domEnvironment) {
    if (!domEnvironment) {
      if (typeof window !== "undefined" && typeof document !== "undefined")
        domEnvironment = {window, document};
      else
        throw new Error("Morphic renderer cannot find DOM environment (window / document)!");
    }
    if (!world || !world.isMorph)
      throw new Error(`Trying to initialize renderer with an invalid world morph: ${world}`)
    if (!rootNode || !("nodeType" in rootNode))
      throw new Error(`Trying to initialize renderer with an invalid root node: ${rootNode}`)
    this.worldMorph = world;
    world._isWorld = true; // for world() method
    world._renderer = this;
    this.rootNode = rootNode;
    this.domNode = null;
    this.domEnvironment = domEnvironment;
    this.renderMap = new WeakMap();
    this.renderWorldLoopProcess = null;
  }

  clear() {
    this.stopRenderWorldLoop();
    this.domNode && this.domNode.parentNode.removeChild(this.domNode);
    this.domNode = null;
    this.renderMap = new WeakMap();
    this._fontMetric && this._fontMetric.uninstall();
    this._fontMetric = null;
  }

  ensureDefaultCSS() {
    return promise.waitFor(3000, () => this.domNode.ownerDocument)
      .then(doc => addOrChangeCSSDeclaration("lively-morphic-css", defaultCSS, doc))
  }

  startRenderWorldLoop() {
    this.renderWorld();
    this.renderWorldLoopProcess = this.domEnvironment.window.requestAnimationFrame(() =>
      this.startRenderWorldLoop());
  }

  stopRenderWorldLoop() {
    this.domEnvironment.window.cancelAnimationFrame(this.renderWorldLoopProcess);
    this.renderWorldLoopProcess = null;
  }

  renderWorld() {
    var world = this.worldMorph;

    if (!world.needsRerender()) return;

    var tree = this.renderMap.get(world) || this.renderMorph(world),
        domNode = this.domNode || (this.domNode = create(tree, this.domEnvironment)),
        newTree = this.renderMorph(world),
        patches = diff(tree, newTree);

    if (!domNode.parentNode) {
      this.rootNode.appendChild(domNode);
      this.ensureDefaultCSS();
    }

    patch(domNode, patches);
  }

  renderMorph(morph) {
    if (!morph.needsRerender()) {
      var rendered = this.renderMap.get(morph);
      if (rendered) return rendered;
    }

    morph.aboutToRender();

    var {
      visible,
      position: {x,y},
      extent: {x: width, y: height},
      fill, borderWidth, borderColor, borderRadius: br,
      clipMode,
      reactsToPointer
    } = morph;

    var shapedStyle = Object.assign(

      {
        position: "absolute",
        visibility: visible ? "visible" : "hidden",
        left: x + 'px',
        top: y + 'px',
        width: width + 'px',
        height: height + 'px',
        backgroundColor: fill ? fill.toString() : "",
        border: `${borderWidth}px ${borderColor ? borderColor.toString() : "transparent"} solid`,
        borderRadius: `${br.top()}px ${br.top()}px ${br.bottom()}px ${br.bottom()}px / ${br.left()}px ${br.right()}px ${br.right()}px ${br.left()}px`,
        overflow: clipMode,
        "pointer-events": reactsToPointer ? "auto" : "none"
      },

      morph.dropShadow ? {
        WebkitFilter: "drop-shadow(5px 5px 5px rgba(0, 0, 0, 0.36))",
        WebkitTransition: "-webkit-filter 0.5s"
      } : null,

      morph.shape().style
    );

    var attributes = Object.assign(
      morph.shape(), {
        id: morph.id,
        className: morph.styleClasses.join(" "),
        draggable: false,
        style: shapedStyle
     });

    var tree = h(
      morph._nodeType, attributes, 
      morph.submorphs.map(m => this.renderMorph(m)));

    this.renderMap.set(morph, tree);
    return tree;
  }

  getNodeForMorph(morph) {
    // Hmm, this also finds dom nodes not associated with this renderer, its
    // domNode... Is this a problem?
    // return this.domNode.ownerDocument.getElementById(morph.id);

    // test, for scoped lookup, fixing the issue mentioned above
    return this.domNode.querySelector("#" + morph.id);
  }

  getMorphForNode(node) {
    return this.worldMorph ?
      this.worldMorph.withAllSubmorphsDetect(morph => morph.id === node.id) :
      null;
  }

  get fontMetric() {
    if (!this._fontMetric) {
      this._fontMetric = new FontMetric();
      this._fontMetric.install(this.domNode);
    }
    return this._fontMetric;
  }
}


class FontMetric {

  constructor() {
    this.charMap = [];
    this.parentElement = null;
    this.element = null;
  }

  install(parentEl = document.body) {
    this.parentElement = parentEl;
    this.element = document.createElement("div");
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
    if (!this.element) this.install();
    var rect = null;
    this.element.innerHTML = char;
    this.element.style.fontFamily = fontFamily;
    this.element.style.fontSize = fontSize;
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
