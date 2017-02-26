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
// var htmlMorph = $world.addMorph(new HTMLMorph({position: pt(10,10)}));
// You can set either the html content directly
// htmlMorph.html
// htmlMorph.html = "<h1>a test</h1>"
// Or create a dom node
// htmlMorph.domNode = document.createElement("div");
// htmlMorph.domNode.textContent = "Hello world"

export class HTMLMorph extends Morph {

  static get properties() {
    return {
      extent: {defaultValue: pt(420, 330)},

      html: {
        initialize() { this.html = this.defaultHTML},
        get() { return this.domNode.innerHTML; },
        set(value) { this.domNode.innerHTML = value; }
      },

      domNode: {
        derived: true,/*FIXME only for dont serialize...*/
        get() {
          if (!this._domNode) {
            this._domNode = this.document.createElement("div")
            this._domNode.setAttribute("style", "position: absolute; width: 100%; height: 100%;");
          }
          return this._domNode
        },
        set(node) {
          if (this.domNode.parentNode)
            this.domNode.parentNode.replaceChild(node, this.domNode);
          return this._domNode = node;
        }
      },

      document: {
        readOnly: true,
        get() { return this.env.renderer.domEnvironment.document; }
      },

      scrollExtent: {
        readOnly: true,
        get() { return pt(this.domNode.scrollWidth, this.domNode.scrollHeight); }
      }

    }
  }

  get defaultHTML() {
     return `
<div style="display: flex;
            align-items: center;
            justify-content: center;
            height: 100%;
            background: -webkit-gradient(linear, 0% 0%, 0% 100%, color-stop(0%, rgba(242,243,244,1)),color-stop(100%, rgba(229,231,233,1)))">
  <p style="font: bold 40pt Inconsolata, monospace; color: lightgray;">&lt;HTML&#x2F;&gt;</p>
</div>`
  }

  render(renderer) {
    return new CustomVNode(this, renderer);
  }

}
