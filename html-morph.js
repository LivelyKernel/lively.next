import { obj } from "lively.lang";
import { Morph } from "./index.js";
import{ renderMorph } from "./rendering/morphic-default.js"
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
    var vtree = this.morphVtree = renderMorph(this.morph, this.renderer);
    // The placeholder in vdom that our real dom node will replace
    var key = "customNode-key-" + this.morph.id;
    if (!vtree.children.find(ea => ea.key === key))
      vtree.children.push(h("div", {key}, []));
    return vtree;
  }

  init() {
    var domNode = createElement(this.renderMorph());
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

  destroy(domNode) { console.log("destroy " + domNode.outerHTML); }
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

  constructor(props = {}) {
    if (props.document) this.document = props.document; // priority
    super(props);
  }

  get html() { return this.domNode.innerHTML; }
  set html(value) { this.domNode.innerHTML = value; }

  get domNode() { return this._domNode || (this._domNode = this.document.createElement("div")); }
  set domNode(node) { return this._domNode = node; }

  get document() { return this._document || document; }
  set document(doc) { return this._document = doc; }

  render(renderer) {
    return new CustomVNode(this, renderer);
  }

}
