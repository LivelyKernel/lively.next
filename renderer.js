import vdom from "virtual-dom";

var {h, diff, patch, create} = vdom;

export class Renderer {

  static default() { return this._default || new this() }

  constructor() {
    // stores the render state for morphs, that is the vdom tree
    this.renderMap = new WeakMap();
    // stores the dom nodes that are used for rendering "world" morphs
    this.domNodeMap = new WeakMap();
    this.renderWorldLoopProcess = null;
  }

  renderWorldLoop(world, rootElement) {
    this.renderWorld(world, rootElement);
    this.renderWorldLoopProcess = requestAnimationFrame(() =>
      this.renderWorldLoop(world, rootElement));
  }

  stopRenderWorldLoop() {
    window.cancelAnimationFrame(this.renderWorldLoopProcess);
    this.renderWorldLoopProcess = null;
  }

  renderStateFor(worldMorph) {
    let tree = this.renderMap.get(worldMorph);
    if (!tree) {
      tree = this.renderMorph(worldMorph);
      this.renderMap.set(worldMorph, tree);
    }
    let domNode = this.domNodeMap.get(worldMorph);
    if (!domNode) {
      domNode = create(tree);
      this.domNodeMap.set(worldMorph, domNode);
    }
    return {tree, domNode};
  }

  renderWorld(worldMorph, rootElement) {
    if (!worldMorph.needsRerender()) return;

    var {domNode, tree} = this.renderStateFor(worldMorph);

    if (!domNode.parentNode) {
      rootElement.appendChild(domNode);
    }

    var newTree = this.renderMorph(worldMorph),
        patches = diff(tree, newTree);

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
      }
    }, morph.submorphs.map(m => this.renderMorph(m)));

    this.renderMap.set(morph, tree);
    return tree;
  }

}
