import { obj } from "lively.lang";
import { pt } from "lively.graphics";
import { Morph } from "./index.js";
import vdom from "virtual-dom";
var { diff, patch, h, create: createElement } = vdom

// see https://github.com/Matt-Esch/virtual-dom/blob/master/docs/widget.md
class CustomVNode {

  constructor(morph, renderer) {
    this.morph = morph;
    this.renderer = renderer;
    this.morphVtree = null;
  }

  get type() { return "Widget"; }

  renderMorph() {
    var vtree = this.morphVtree = this.renderer.renderMorph(this.morph);
    // The placeholder in vdom that our real dom node will replace
    var key = "customNode-key-" + this.morph.id;
    if (!vtree.children[0] || vtree.children[0].key !== key)
      vtree.children.unshift(h("div", {key}, []));
    return vtree;
  }

  init() {
    var domNode = createElement(this.renderMorph(), this.renderer.domEnvironment);
    // here we replace the placeholder node with our custom node, this only
    // needs to happen when we create the DOM node for the entire morph
    domNode.replaceChild(this.morph.domNode, domNode.childNodes[0]);
    return domNode;
  }

  update(previous, domNode) {
    var oldTree = previous.morphVtree || this.renderMorph(),
        newTree = this.renderMorph(),
        patches = diff(oldTree, newTree);
    // We patch the node representing the morph. Since oldVnode and newVNode
    // both include the same virtual placeholder, the customNode
    // will be left alone by the patch operation
    patch(domNode, patches);
    return null;
  }

  destroy(domNode) { console.log(`[HTMLMorph] node of ${this} gets removed from DOM`); }
}

// Usage:
// var {state: {renderer, eventDispatcher, world}} = $world.get("lively.morphic world")
// var h = world.addMorph(new HTMLMorph({position: pt(10,10), extent: pt(100,100)}));
// You can set either the html content directly
// h.html = "<h1>a test</h1>"
// Or create a dom node
// h.domNode = document.create("div");
// h.domNode.textContent = "Hello world"

export class HTMLMorph extends Morph {

  get html() { return this.domNode.innerHTML; }
  set html(value) { this.domNode.innerHTML = value; }

  get domNode() {
    if (!this._domNode) {
      this._domNode = this.document.createElement("div")
      this._domNode.setAttribute("style", "position: absolute; width: 100%; height: 100%;");
    }
    return this._domNode
  }
  set domNode(node) { return this._domNode = node; }

  get document() { return this.env.renderer.domEnvironment.document; }

  get scrollExtent() { return pt(this.domNode.scrollWidth, this.domNode.scrollHeight); }

  render(renderer) {
    return new CustomVNode(this, renderer);
  }

  copy() {
     const copiedHtmlMorph = super.copy();
     copiedHtmlMorph.html = this.html;
     return copiedHtmlMorph;
  }

}
