/* global System */
import { promise, obj, arr } from 'lively.lang';
import { Rectangle } from 'lively.graphics';

export function cumulativeOffset (element) {
  let top = 0; let left = 0;
  do {
    top = top + (element.offsetTop || 0);
    left = left + (element.offsetLeft || 0);
    element = element.offsetParent;
  } while (element);
  return { top, left };
}

function createIFrame (parentElement, url = 'about:blank', bounds = new Rectangle(0, 0, 700, 700)) {
  return new Promise((resolve, reject) => {
    if (!parentElement) throw new Error('Need parent element!');
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.top = bounds.top() + 'px';
    iframe.style.left = bounds.left() + 'px';
    iframe.style.width = bounds.width + 'px';
    iframe.style.height = bounds.height + 'px';
    iframe.src = url;
    let loaded = false;
    iframe.onload = function (evt) { loaded = true; iframe.onload = null; resolve(iframe); };
    promise.waitFor(1000, () => !!loaded).catch((err) => reject(new Error('iframe load timeout')));
    parentElement.appendChild(iframe);
  });
}

function requestAnimationFramePolyfill (window) {
  // based on requestAnimationFrame polyfill by Erik Möller. fixes from Paul Irish and Tino Zijdel
  // MIT license
  // https://gist.github.com/paulirish/1579671
  let lastTime = 0;
  const vendors = ['ms', 'moz', 'webkit', 'o'];
  for (let x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
    window.requestAnimationFrame = window[vendors[x] + 'RequestAnimationFrame'];
    window.cancelAnimationFrame = window[vendors[x] + 'CancelAnimationFrame'] ||
                                 window[vendors[x] + 'CancelRequestAnimationFrame'];
  }

  if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = function (callback, element) {
      const currTime = Date.now();
      const timeToCall = Math.max(0, 16 - (currTime - lastTime));
      const id = window.setTimeout(function () { callback(currTime + timeToCall); }, timeToCall);
      lastTime = currTime + timeToCall;
      return id;
    };
  }

  if (!window.cancelAnimationFrame) { window.cancelAnimationFrame = function (id) { clearTimeout(id); }; }
}

async function createDOMEnvironment_browser () {
  return new IFramedDomEnvironment(await createIFrame(document.body));
}

function createDOMEnvironment_node () {
  const morphicDir = System.decanonicalize('lively.morphic/').replace(/file:\/\//, '');
  const jsdom = System._nodeRequire('jsdom');
  const virtualConsole = jsdom.createVirtualConsole().sendTo(console);
  return new Promise((resolve, reject) => {
    jsdom.env(
      '<div></div>',
      ['https://code.jquery.com/pep/0.4.1/pep.js'],
      { virtualConsole },
      (err, window) =>
        err
          ? reject(err)
          : resolve(new DomEnvironment(window, window.document, () => window.close())));
  });
}

export function createDOMEnvironment () {
  return System.get('@system-env').browser
    ? createDOMEnvironment_browser()
    : createDOMEnvironment_node();
}

class DomEnvironment {
  constructor (window, document, destroyFn) {
    requestAnimationFramePolyfill(window);
    this.window = window;
    this.document = document;
    this.destroyFn = destroyFn;
  }

  destroy () {
    if (typeof this.destroyFn === 'function') { this.destroyFn(); }
  }
}

class IFramedDomEnvironment extends DomEnvironment {
  constructor (iframe) {
    super(
      iframe.contentWindow,
      iframe.contentWindow.document,
      () => {
        iframe.contentWindow && iframe.contentWindow.close();
        iframe.parentNode && iframe.parentNode.removeChild(iframe);
      }
    );
    this.iframe = iframe;
  }
}

let _defaultEnv;
export function defaultDOMEnv () {
  return _defaultEnv || (_defaultEnv = System.get('@system-env').browser
    ? new DomEnvironment(window, document, () => {
      // clean body
      // clean header
      })
    : createDOMEnvironment());
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function setCSSDef (node, cssDefString, doc) {
  arr.from(node.childNodes).forEach(c => node.removeChild(c));
  const rules = doc.createTextNode(cssDefString);
  if (node.styleSheet) node.styleSheet.cssText = rules.nodeValue;
  else node.appendChild(rules);
  return node;
}

function addCSSDef (id, cssString, doc) {
  const style = doc.createElement('style');
  style.type = 'text/css';
  if (id) style.setAttribute('id', id);
  setCSSDef(style, cssString, doc);
  doc.head.appendChild(style);
  return style;
}

export function addOrChangeCSSDeclaration (id = 'lively-css', cssString, doc = document) {
  const node = doc.getElementById(id);
  return node
    ? setCSSDef(node, cssString, doc)
    : addCSSDef(id, cssString, doc);
}

export function addOrChangeLinkedCSS (id, url, doc = document, overwrite = true) {
  let link = doc.getElementById(id);
  let loaded = false;
  if (!link) {
    link = doc.createElement('link');
    link.type = 'text/css';
    link.rel = 'stylesheet';
    link.setAttribute('id', id);
    link.setAttribute('href', url);
    link.onload = () => loaded = true;
    doc.head.appendChild(link);
    return promise.waitFor(30000, () => !!loaded && link);
  }
  if (overwrite && link.getAttribute('href') !== url) {
    link.setAttribute('href', url);
    link.onload = () => loaded = true;
    return promise.waitFor(30000, () => !!loaded && link);
  }
  return Promise.resolve();
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

export const hyperscriptFnForDocument = (function () {
  const h_dom_cache = new WeakMap();

  return function hyperscriptFnForDocument (document = window.document) {
    // h() function that renders using document instead of virtual nodes
    return h_dom;

    const existing = h_dom_cache.get(document);
    if (!existing) h_dom_cache.set(document, h_dom);
    return existing || h_dom;

    function h_dom (tagname, childrenOrAttrs, children) {
      let attrs = childrenOrAttrs || undefined;

      if (typeof children === 'undefined') {
        children = childrenOrAttrs;
        attrs = undefined;
      }

      const cssClasses = []; let id = null;
      const tokens = tagname.split('.');

      if (tokens.length > 1) {
        tagname = tokens.shift();
        for (var i = 0; i < tokens.length; i++) {
          let token = tokens[i]; var hashIndex;
          if ((hashIndex = token.indexOf('#')) > -1) {
            id = token.slice(hashIndex + 1);
            token = token.slice(0, hashIndex);
          }
          cssClasses.push(token);
        }
      }
      const tagnameAndId = tagname.split('#');
      if (tagnameAndId.length > 1) {
        tagname = tagnameAndId[0];
        id = tagnameAndId[1];
      }

      const el = document.createElement(tagname);

      if (attrs) {
        for (const attrKey in attrs) {
          if (attrKey !== 'style' && attrKey !== 'dataset' && attrKey !== 'attributes') { el[attrKey] = attrs[attrKey]; }
        }
        const style = attrs.style;
        if (style) for (const styleKey in style) el.style[styleKey] = style[styleKey];
        const dataset = attrs.dataset;
        if (dataset) {
          if (el.dataset) for (var dsKey in dataset) el.dataset[dsKey] = dataset[dsKey];
          else for (var dsKey in dataset) el.setAttribute('data-' + dsKey, dataset[dsKey]);
        }
        const attributes = attrs.attributes;
        if (attributes) {
          for (const attr in attributes) {
            if (attributes[attr] && obj.isBoolean(attributes[attr])) el.toggleAttribute(attr);
            else el.setAttribute(attr, attributes[attr]);
          }
        }
      }

      if (!children) children = '';
      if (typeof children === 'string') {
        el.appendChild(document.createTextNode(children));
      } else if (Array.isArray(children)) {
        for (var i = 0; i < children.length; i++) {
          const child = children[i];
          el.appendChild(typeof child === 'string'
            ? document.createTextNode(child) : child);
        }
      } else {
        el.appendChild(typeof children === 'string'
          ? document.createTextNode(children) : children);
      }

      return el;
    }
  };
})();
