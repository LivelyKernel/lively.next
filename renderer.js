import vdom from "virtual-dom";

var {h, diff, patch, create} = vdom;

export class Renderer {

  static default() { return this._default || new this() }

  constructor(world, rootNode) {
    if (!world || !world.isMorph)
      throw new Error(`Trying to initialize renderer with an invalid world morph: ${world}`)
    if (!rootNode || !("nodeType" in rootNode))
      throw new Error(`Trying to initialize renderer with an invalid root node: ${rootNode}`)
    this.worldMorph = world;
    this.rootNode = rootNode;
    this.domNode = null;
    this.renderMap = new WeakMap();
    this.renderWorldLoopProcess = null;
  }

  clear() {
    this.stopRenderWorldLoop();
    this.domNode.parentNode.removeChild(this.domNode);
    this.domNode = null;
    this.renderMap = new WeakMap();
  }

  startRenderWorldLoop() {
    this.renderWorld();
    this.renderWorldLoopProcess = requestAnimationFrame(() =>
      this.renderWorldLoop());
  }

  stopRenderWorldLoop() {
    window.cancelAnimationFrame(this.renderWorldLoopProcess);
    this.renderWorldLoopProcess = null;
  }

  renderWorld() {
    var world = this.worldMorph;

    if (!world.needsRerender()) return;

    var tree = this.renderMap.get(world) || this.renderMorph(world),
        domNode = this.domNode || (this.domNode = create(tree)),
        newTree = this.renderMorph(world),
        patches = diff(tree, newTree);

    if (!domNode.parentNode)
      this.rootNode.appendChild(domNode);

    patch(domNode, patches);
  }

  renderMorph(morph) {
    if (!morph.needsRerender()) {
      var rendered = this.renderMap.get(morph);
      if (rendered) return rendered;
    }
    morph.aboutToRender();

    var tree = h('div', {
      style: {
        position: "absolute",
        left: morph.position.x + 'px',
        top: morph.position.y + 'px',
        width: morph.extent.x + 'px',
        height: morph.extent.y + 'px',
        backgroundColor: morph.fill ? morph.fill.toString() : "",
        overflow: morph.clipMode
      },
      id: morph.id
    }, morph.submorphs.map(m => this.renderMorph(m)));

    this.renderMap.set(morph, tree);
    return tree;
  }

  getMorphWithNode(root, node) {
    return root.withAllSubmorphsDetect(morph => morph.id === node.id);
  }
}
