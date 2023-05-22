import { promise } from 'lively.lang';
import { pt } from 'lively.graphics';
import { Morph } from './morph.js';
import { addOrChangeCSSDeclaration } from './rendering/dom-helper.js';
import css from 'esm://cache/css@3.0.0';

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
      domNodeTagName: {
        readOnly: true,
        get () { return 'div'; }
      },
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
          if (this.domNode.parentNode) {
            this.domNode.parentNode.replaceChild(node, this.domNode);
          }
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
          const doc = this.document;
          if (!val) {
            const style = doc.getElementById('css-for-' + this.id);
            if (style) style.remove();
          } else {
            this.installCssDeclaration(doc);
            this.makeDirty();
          }
        }
      }
    };
  }

  get isHTMLMorph () { return true; }

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

  getNodeForRenderer (renderer) {
    return renderer.nodeForHTMLMorph(this);
  }

  installCssDeclaration (doc) {
    if (!this.cssDeclaration) return;
    try {
      const parsed = css.parse(this.cssDeclaration);
      // prepend morph id to each rule so that css is scoped to morph
      parsed.stylesheet.rules.forEach(r => {
        if (r.selectors) r.selectors = r.selectors.map(ea => `#${this.id} ${ea}`);
      });
      addOrChangeCSSDeclaration('css-for-' + this.id, css.stringify(parsed), this.document);
    } catch (err) {
      console.error(`Error setting cssDeclaration of ${this}: ${err}`); // eslint-disable-line no-console
    }
  }

  onOwnerChanged (newOwner) {
    if (newOwner === null) this.document.getElementById('css-for-' + this.id)?.remove();
    else this.installCssDeclaration(this.document);
  }

  ensureScrollPosition () {
  // custom code that can traverse the custom dom node
  // and reconstruct scroll state if that is lost
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
          this._whenLoaded = Promise.resolve(true);
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
