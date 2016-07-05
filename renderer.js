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

    const shapedStyle = Object.assign({
        position: "absolute",
        visibility: morph.visible ? "visible" : "hidden",
        left: morph.position.x + 'px',
        top: morph.position.y + 'px',
        width: morph.extent.x + 'px',
        height: morph.extent.y + 'px',
        backgroundColor: morph.fill ? morph.fill.toString() : "",
        overflow: morph.clipMode,
        "pointer-events": morph.reactsToPointer ? "auto" : "none"
    }, 
    morph.dropShadow &&
      {WebkitFilter: "drop-shadow(5px 5px 5px rgba(0, 0, 0, 0.36))",
       WebkitTransition: "-webkit-filter 0.5s"},
    morph.shape().style);

    const attributes = Object.assign(
      morph.shape(), {
        id: morph.id,
        className: morph.styleClasses.join(" "),
        draggable: false,
        style: shapedStyle
     });

    var tree = h(morph._nodeType,
                attributes,
                morph.submorphs.map(m => this.renderMorph(m)));

    this.renderMap.set(morph, tree);
    return tree;
  }

  getNodeForMorph(morph) {
    // Hmm, this also finds dom nodes not associated with this renderer, its
    // domNode... Is this a problem?
    return this.domNode.ownerDocument.getElementById(morph.id);
  }

  getMorphForNode(node) {
    return this.worldMorph ?
      this.worldMorph.withAllSubmorphsDetect(morph => morph.id === node.id) :
      null;
  }
}
