import gfx from "lively.graphics";
import vdom from "virtual-dom";

var {h, diff, patch, create} = vdom;

const defaultProps = {
  position: pt(0,0),
  rotation: 0,
  scale: 1,
  extent: pt(0,0),
  fill: Color.white,
  clipMode: "visible",
  submorphs: []
}

export class Renderer {

  static default() { return this._default || new this() }

  constructor() {
    // stores the render state for world morphs, that is domNode + vdom tree
    this.morphMap = new WeakMap();
    this.renderWorldLoopProcess = null;
  }

  renderWorldLoop(world) {
    this.renderWorld(world);
    this.renderWorldLoopProcess = requestAnimationFrame(() =>
      this.renderWorldLoop(world));
  }

  stopRenderWorldLoop() {
    window.cancelAnimationFrame(this.renderWorldLoopProcess);
    this.renderWorldLoopProcess = null;
  }

  renderStateFor(worldMorph) {
    let state = this.morphMap.get(worldMorph);
    if (!state) {
      var tree = this.renderMorph(worldMorph),
          domNode = create(tree);
      this.morphMap.set(worldMorph, state = {tree, domNode});
    }
    return state;
  }

  renderWorld(worldMorph) {
    var state = this.renderStateFor(worldMorph),
        {domNode, tree} = state;

    if (!domNode.parentNode) {
      $morph("vdomMorphTest").setHTMLString("")
      $morph("vdomMorphTest").renderContext().shapeNode.appendChild(domNode);
    }

    var newTree = this.renderMorph(worldMorph),
        patches = diff(tree, newTree);
    state.domNode = patch(domNode, patches);
    state.tree = newTree;
  }

  renderMorph(morph) {
    console.log(morph)
    var props = Object.assign({}, defaultProps, morph);
    return h('div', {
      style: {
        position: "absolute",
        left: props.position.x + 'px',
        top: props.position.y + 'px',
        width: props.extent.x + 'px',
        height: props.extent.y + 'px',
        backgroundColor: props.fill ? props.fill.toCSSString() : "",
        overflow: props.clipMode
      }
    }, props.submorphs.map(m => this.renderMorph(m)));
  }

}