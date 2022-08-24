import { promise } from 'lively.lang';
import { pt } from 'lively.graphics';
import { Morph } from './morph.js';
import vdom from 'virtual-dom';
import { addOrChangeCSSDeclaration } from './rendering/dom-helper.js';
import css from 'esm://cache/css@3.0.0';
const { diff, patch, h, create: createElement } = vdom;

// see https://github.com/Matt-Esch/virtual-dom/blob/master/docs/widget.md
class CustomVNode {
  constructor (morph, renderer) {
    this.morph = morph;
    this.renderer = renderer;
    this.morphVtree = null;
    // this is needed to ensure that virtual dom can correctly
    // identify this node when morph hierarchies change
    this.key = `custom-${morph.id}`;
  }

  get type () { return 'Widget'; }

  renderMorph () {
    const { morph, renderer } = this;
    const vtree = this.morphVtree = renderer.renderMorph(morph);
    // The placeholder in vdom that our real dom node will replace
    const key = 'customNode-key-' + morph.id;

    if (morph._updateCSSDeclaration) {
      morph.ensureCSSDeclaration();
      morph._updateCSSDeclaration = false;
    }
    return vtree;
  }

  init () {
    const domNode = createElement(this.renderMorph(), this.renderer.domEnvironment);
    // here we replace the placeholder node with our custom node, this only
    // needs to happen when we create the DOM node for the entire morph
    // domNode.childNodes[0].setAttribute('style', this.morph.domNodeStyle);
    domNode.insertBefore(this.morph.domNode, domNode.childNodes[0]);
    // mount the style node
    if (this.morph.cssDeclaration) { this.morph.ensureCSSDeclaration(); }
    return domNode;
  }

  update (previous, domNode) {
    const oldTree = previous.morphVtree || this.renderMorph();
    const newTree = this.renderMorph();
    const patches = diff(oldTree, newTree);
    // We patch the node representing the morph. Since oldVnode and newVNode
    // both include the same virtual placeholder, the customNode
    // will be left alone by the patch operation
    patch(domNode, patches);
    if (this.morph.afterRenderHook) this.morph.afterRenderHook();
    return null;
  }

  destroy (domNode) {
    // clear the css node of the morph
    const doc = this.renderer.domEnvironment.document;
    const style = doc.getElementById('css-for-' + this.morph.id);
    if (style) style.remove();
    console.log(`[HTMLMorph] node of ${this.morph.name} gets removed from DOM`);
  }
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
  static get properties () {
    return {
      extent: { defaultValue: pt(420, 330) },

      html: {
        after: ['cssDeclaration'],
        isStyleProp: true,
        initialize () { this.html = this.defaultHTML; },
        get () { return this.domNode.innerHTML; },
        set (value) {
          this.domNode.innerHTML = value;
          // manually trigger master change
          const parentWithMaster = [this, ...this.ownerChain()].find(m => m.master);
          if (parentWithMaster) {
            parentWithMaster.master.onMorphChange(this, {
              prop: 'html', value
            });
          }
          // scripts won't execute using innerHTML...
          if (value.includes('<script')) {
            const scripts = this.domNode.querySelectorAll('script');
            for (const script of scripts) {
              const parent = script.parentNode;
              script.remove();
              const copdiedScript = document.createElement('script');
              for (const { name, value } of script.attributes) { copdiedScript.setAttribute(name, value); }
              for (const n of script.childNodes) { copdiedScript.appendChild(n); }
              parent.appendChild(copdiedScript);
            }
          }
        }
      },

      domNodeTagName: { readOnly: true, get () { return 'div'; } },
      domNodeStyle: {
        readOnly: true,
        get () { return 'position: absolute; width: 100%; height: 100%;'; }
      },

      domNode: {
        derived: true, /* FIXME only for dont serialize... */
        get () {
          if (!this._domNode) {
            this._domNode = this.document.createElement(this.domNodeTagName);
            this._domNode.setAttribute('style', this.domNodeStyle);
          }
          return this._domNode;
        },
        set (node) {
          if (this.domNode.parentNode) { this.domNode.parentNode.replaceChild(node, this.domNode); }
          return this._domNode = node;
        }
      },

      document: {
        readOnly: true,
        get () { return this.env.domEnv.document; }
      },

      scrollExtent: {
        readOnly: true,
        get () { return pt(this.domNode.scrollWidth, this.domNode.scrollHeight); }
      },

      cssDeclaration: {
        isStyleProp: true,
        set (val) {
          this.setProperty('cssDeclaration', val);
          if (!val) {
            const doc = this.env.domEnv.document;
            const style = doc.getElementById('css-for-' + this.id);
            if (style) style.remove();
          } else {
            this.makeDirty();
            this._updateCSSDeclaration = true;
          }
        }
      }
    };
  }

  get isHTMLMorph () { return true; }

  ensureCSSDeclaration () {
    try {
      const parsed = css.parse(this.cssDeclaration);
      // prepend morph id to each rule so that css is scoped to morph
      this.whenRendered().then(() => {
        // wait until morphs id has been determined
        parsed.stylesheet.rules.forEach(r => {
          if (r.selectors) r.selectors = r.selectors.map(ea => `#${this.id} ${ea}`);
        });
        addOrChangeCSSDeclaration('css-for-' + this.id, css.stringify(parsed));
      });
    } catch (err) {
      console.error(`Error setting cssDeclaration of ${this}: ${err}`);
    }
  }

  get defaultHTML () {
    return `
<div style="display: flex;
            align-items: center;
            justify-content: center;
            height: 100%;
            background: -webkit-gradient(linear, 0% 0%, 0% 100%, color-stop(0%, rgba(242,243,244,1)),color-stop(100%, rgba(229,231,233,1)))">
  <p style="font: bold 40pt Inconsolata, monospace; color: lightgray;">&lt;HTML&#x2F;&gt;</p>
</div>`;
  }

  render (renderer) {
    if (this._requestMasterStyling) {
      this.master && this.master.applyIfNeeded(true);
      this._requestMasterStyling = false;
    }
    return new CustomVNode(this, renderer);
  }

  getNodeForRenderer (renderer) {
    return renderer.nodeForHTMLMorph(this);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  menuItems () {
    const items = super.menuItems();
    items.unshift(
      ['edit CSS...', () => this.world().execCommand('open workspace', {
        language: 'css', content: this.cssDeclaration, target: this
      })],
      ['edit html...', () => this.world().execCommand('open workspace', { language: 'html', content: this.html, target: this })],
      { isDivider: true });
    return items;
  }
}

export class IFrameMorph extends HTMLMorph {
  static async example () {
    const iframeMorph = new IFrameMorph().openInWindow({ title: 'iframe' }).targetMorph;

    iframeMorph.srcDoc = '';
    iframeMorph.src = 'http://localhost:9011/worlds/html%20export';

    await iframeMorph.loadURL('https://google.com');
    iframeMorph.iframe.src;
    iframeMorph.iframe.srcDoc;
    iframeMorph.src = '';
    iframeMorph.srcDoc = 'fooo';
    await iframeMorph.reload();
  }

  static get properties () {
    return {

      html: {
        initialize () {
          this.html = this.defaultHTML;
          this.srcDoc = this.defaultSrcDoc;
        }
      },

      iframe: {
        derived: true,
        readOnly: true,
        after: ['domNode'],
        get () {
          return this.domNode.querySelector('iframe');
        }
      },

      src: {
        derived: true,
        after: ['iframe'],
        get () { return this.iframe.src; },
        set (val) {
          this.iframe.removeAttribute('srcDoc');
          this.iframe.src = val;
          const { promise: p, resolve } = promise.deferred();
          this._whenLoaded = p;
          this.iframe.onload = arg => resolve(arg);
        }
      },

      srcDoc: {
        derived: true,
        after: ['iframe'],
        get () { return this.iframe.srcdoc; },
        set (val) {
          this.iframe.removeAttribute('src');
          this.iframe.srcdoc = val;
          this._whenLoaded = this.whenRendered().then(() => promise.delay(20));
        }
      },

      iframeScroll: {
        derived: true,
        after: ['iframe'],
        get () {
          try {
            const { scrollX: x, scrollY: y } = this.iframe.contentWindow;
            return pt(x, y);
          } catch (err) { return pt(0, 0); }
        },
        set (val) {
          try {
            this.iframe.contentWindow.scrollTo(val.x, val.y);
          } catch (err) {}
        }
      }
    };
  }

  get isIFrameMorph () { return true; }

  reload () {
    return this.src
      ? this.loadURL(this.src)
      : this.srcDoc ? this.displayHTML(this.srcDoc) : null;
  }

  whenLoaded () {
    return this._whenLoaded || Promise.resolve();
  }

  async displayHTML (html, opts = {}) {
    const { keepScroll = true } = opts; let scroll;
    if (keepScroll) scroll = this.iframeScroll;
    this.srcDoc = html;
    await this.whenLoaded();
    if (keepScroll && scroll) this.iframeScroll = scroll;

    return this;
  }

  async loadURL (url, opts = {}) {
    const { keepScroll = true } = opts; let scroll;
    if (keepScroll) scroll = this.iframeScroll;
    this.src = url;
    await this.whenLoaded();
    if (keepScroll && scroll) this.iframeScroll = scroll;
    return this;
  }

  get defaultSrcDoc () {
    return `
    <div style=\"display: flex;
                align-items: center;
                justify-content: center;
                height: 100%;
                background: -webkit-gradient(linear, 0% 0%, 0% 100%, color-stop(0%, rgba(242,243,244,1)),color-stop(100%, rgba(229,231,233,1)))\">
      <p style=\"font: bold 40pt Inconsolata, monospace; color: lightgray;\">&lt;iFrame&#x2F;&gt;</p>
    </div>`;
  }

  get defaultHTML () {
    return '<iframe width="100%" height="100%" frameBorder="false" srcdoc=""></iframe>';
  }
}
