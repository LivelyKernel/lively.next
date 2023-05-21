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

/**
 * A VideoMorph, which is just an overlay on the HTML Video element
 * This is a subclass of the HTMLMorph, and so it inherits all of the HTMLMorph's
 * properties.
 * properties (should be in the constructor)
 *   - src: url for the video
 *   - type: type of the video (mp4, ogg, etc)
 *   - controls: true/false to show not/show the controls (default false)
 *   - loop: true/false to play on a loop (default true)
 *   - autoplay: true/false to play on load (default true)
 *   - videoLayout:  one of 'autosize', 'autoaspect', 'none'. Default to autoaspect.
 *          If 'autosize', size the morph to the video's size.
 *          If 'autoaspect', resize to correct aspect ratio within current bounding box
 * methods:
 *    - startPlaying() -- start playing the video
 *    - stopPlaying() -- stop playing the video
 *    - rewind()  -- set the video counter to 0
 *
 * read-only properties:
 *     - videoDomElement -- the DOM element for the video
 */

// new VideoMorph({autoplay: true, src:'https://matt.engagelively.com/assets/ITF/New-creative-video-6-.mp4', videoLayout:'autosize'}).openInWorld()
export class VideoMorph extends HTMLMorph {
  static get properties () {
    return {
      autoplay: {
        defaultValue: false,
        set (aBool) {
          this.setVideoProperty('autoplay', !!aBool);
        }
      },
      loop: {
        defaultValue: false,
        set (aBool) {
          this.setVideoProperty('loop', !!aBool);
        }
      },
      controls: {
        defaultValue: false,
        set (aBool) {
          this.setVideoProperty('controls', !!aBool);
        }
      },
      src: {
        defaultValue: 'https://matt.engagelively.com/assets/kaleidoscope-art-17141.mp4',
        set (srcURL) {
          this.setVideoProperty('src', srcURL);
          this.videoLoaded = false;
        }
      },
      type: {
        defaultValue: 'video/mp4',
        set (videoType) {
          this.setVideoProperty('type', videoType);
        }
      },
      videoLayout: {
        defaultValue: 'autoaspect',
        set (aLayoutStyle) {
          // console.log('Setting videoLayout to ' + aLayoutStyle);
          const choices = ['none', 'autoaspect', 'autosize'];
          const index = choices.indexOf(aLayoutStyle);
          const choice = index >= 0 ? choices[index] : 'none';
          this.setProperty('videoLayout', choice);
          this.resizeToExtentProperties();
        }

      }

    };
  }

  constructor (props) {
    // this.videoId = `video-${Math.floor(Math.random() * 1E6)}`;
    this.constructorProps = props;
    super(props);
  }

  setVideoProperty (propertyName, value) {
    this.setProperty(propertyName, value);
    this.resetHTML();
  }

  onLoad () {
    const props = this.constructorProps;
    this.log = [];
    this.autorelayout = true;
    this.videoLoaded = false;
    const setField = (field, defaultVal) => {
      this[field] = props && props[field] ? props[field] : defaultVal;
      this.log.push([field, this[field]]);
    };
    const normalizeBoolean = field => {
      this[field] = props ? !!props[field] : false;
    };

    const bools = ['loop', 'controls', 'autoplay'];
    bools.forEach(bool => normalizeBoolean(bool));
    const fields = [
      { name: 'src', defaultVal: 'https://matt.engagelively.com/assets/kaleidoscope-art-17141.mp4' },
      { name: 'type', defaultVal: 'video/mp4' },
      { name: 'badBrowserMessage', defaultVal: 'Your browser does not support video content' },
      { name: 'loop', defaultVal: false },
      { name: 'autoplay', defaultVal: false },
      { name: 'controls', defaultVal: false }
      // { name: 'videoLayout', defaultVal: 'autoaspect' }
    ];

    fields.forEach(field => setField(field.name, field.defaultVal));
    this.resetHTML();

    this.awaitingResize = false;

    this.autorelayout = false;
  }

  resizeToExtentProperties () {
    // resize to the extent properties.  Since the default behavior on
    // bounds change is to set videoLayout to 'none', and we don't want that
    // to happen in this case, set this.autorelayout to true to tell
    // onBoundsChanged() not to reset the videoLayout method
    this.whenRendered().then(_ => {
      // console.log('in resizeToExtentProperties, this.videoLayout = ' + this.videoLayout);

      this.autorelayout = true;
      if (this.videoLayout === 'autosize') {
        // console.log('Resizing to natural extent');
        this.resizeToNaturalExtent();
      } else if (this.videoLayout === 'autoaspect') {
        // console.log('Resizing to fit video');
        this.resizeToFitVideo();
      }

      this.autorelayout = false;
      // console.log('leaving resizeToExtentProperties');
    });
  }

  get domElementExtent () {
    return pt(this.videoDomElement.width, this.videoDomElement.height);
  }

  onBoundsChanged (bounds) {
    super.onBoundsChanged(bounds);
    // console.log('In onBoundsChanged');
    if (!this.autorelayout) {
      // once a user has resized, this turns off autosizing to accomodate the video
      // the autorelayout flag is set by the resize methods to ensure that this
      // won't happen when we are resizing to accomodate a video
      this.videoLayout = 'none';
    }

    if (this.bounds().extent().eqPt(this.domElementExtent)) {
      return;
    }
    // console.log('Leaving onBoundsChanged');
    this.resetHTML();
  }

  init () {
    this.resetHTML();
    this.startPlaying();
  }

  get videoDomElement () {
    return this.domNode.querySelectorAll('video')[0];
  }

  get naturalExtent () {
    if (this.videoDomElement) {
      return pt(this.videoDomElement.videoWidth, this.videoDomElement.videoHeight);
    } else {
      return pt(10, 10);
    }
  }

  resizeToNaturalExtent () {
    if (this.videoLoaded) {
      // console.log('natural extent is' + this.naturalExtent);
      this.extent = this.naturalExtent;
    } else {
      // console.log('Video is not yet loaded');
    }
  }

  resizeToFitVideo () {
    const videoExtent = this.naturalExtent;
    const widthRatio = this.width / videoExtent.x;
    const heightRatio = this.height / videoExtent.y;
    // remain within the current bounding box, but shrink one dimension so
    // this.width/this.height = video.extent.x/video.extent.y
    if (heightRatio > widthRatio) {
      // morph is too tall for the video
      this.extent = pt(this.extent.x, videoExtent.y * widthRatio);
    } else if (widthRatio > heightRatio) {
      // morph is too wide for the video
      this.extent = pt(videoExtent.x * heightRatio, this.extent.y);
    }
  }

  rewind () {
    this.videoDomElement.currentTime = 0;
  }

  startPlaying () {
    this.videoDomElement.play();
  }

  stopPlaying () {
    this.videoDomElement.pause();
    this.videoDomElement.currentTime = 0;
  }

  resetHTML () {
    const options = ` ${this.loop ? 'loop' : ''} ${this.controls ? 'controls' : ''} ${this.autoplay ? 'autoplay' : ''}`;
    this.html = `
  <video id="${this.videoId}"  this.width = "${this.width}" height="${this.height}" ${options}>
  <source src="${this.src}"  type="${this.type}"/> 
${this.badBrowserMessage}
</video>
`;
  }

  menuItems () {
    let items = super.menuItems();
    // pop the first two items off the list.  Note this must change if
    // HTMLMorph.menuItems() changes
    // items.shift(); // remove edit html
    // items.shift(); // remove edit css
    return items;
  }
}
