import { promise, arr } from "lively.lang";
import { Rectangle } from "lively.graphics";

function createIFrame(parentElement, url = "about:blank", bounds = new Rectangle(0,0, 700,700)) {
  return new Promise((resolve, reject) => {
    if (!parentElement) throw new Error("Need parent element!")
    var iframe = document.createElement('iframe');
    iframe.style.position = "absolute";
    iframe.style.top = bounds.top() + 'px';
    iframe.style.left = bounds.left() + 'px';
    iframe.style.width = bounds.width + 'px';
    iframe.style.height = bounds.height + 'px';
    iframe.src = url;
    var loaded = false;
    iframe.onload = function(evt) { loaded = true; iframe.onload = null; resolve(iframe); };
    promise.waitFor(1000, () => !!loaded).catch((err) => reject(new Error("iframe load timeout")))
    parentElement.appendChild(iframe);
  })
};

function requestAnimationFramePolyfill(window) {
  // based on requestAnimationFrame polyfill by Erik Möller. fixes from Paul Irish and Tino Zijdel
  // MIT license
  // https://gist.github.com/paulirish/1579671
  var lastTime = 0,
      vendors = ['ms', 'moz', 'webkit', 'o'];
  for(var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
      window.requestAnimationFrame = window[vendors[x]+'RequestAnimationFrame'];
      window.cancelAnimationFrame = window[vendors[x]+'CancelAnimationFrame']
                                 || window[vendors[x]+'CancelRequestAnimationFrame'];
  }

  if (!window.requestAnimationFrame)
    window.requestAnimationFrame = function(callback, element) {
      var currTime = Date.now(),
          timeToCall = Math.max(0, 16 - (currTime - lastTime)),
          id = window.setTimeout(function() { callback(currTime + timeToCall); }, timeToCall);
      lastTime = currTime + timeToCall;
      return id;
    };

  if (!window.cancelAnimationFrame)
      window.cancelAnimationFrame = function(id) { clearTimeout(id); };
}

async function createDOMEnvironment_browser() {
  var iframe = await createIFrame(document.body)
  requestAnimationFramePolyfill(iframe.contentWindow);
  return {
    iframe: iframe,
    window: iframe.contentWindow,
    document: iframe.contentWindow.document,
    destroy() {
      iframe.contentWindow && iframe.contentWindow.close();
      iframe.parentNode && iframe.parentNode.removeChild(iframe);
    }
  }
}

function createDOMEnvironment_node() {
  var morphicDir = System.decanonicalize("lively.morphic/").replace(/file:\/\//, ""),
      jsdom = System._nodeRequire(morphicDir + "node_modules/jsdom"),
      virtualConsole = jsdom.createVirtualConsole().sendTo(console);
  return new Promise((resolve, reject) => {
    jsdom.env(
      '<div></div>',
      ["https://code.jquery.com/pep/0.4.1/pep.js"],
      { virtualConsole },
      function (err, window) {
        requestAnimationFramePolyfill(window);
        err ? reject(err) : resolve({
          window: window,
          document: window.document,
          destroy() { window.close(); }
        })
      });
  })
}

export function createDOMEnvironment() {
  return System.get("@system-env").browser ?
    createDOMEnvironment_browser() :
    createDOMEnvironment_node();
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function setCSSDef(node, cssDefString, doc) {
  arr.from(node.childNodes).forEach(c => node.removeChild(c));
  var rules = doc.createTextNode(cssDefString);
  if (node.styleSheet) node.styleSheet.cssText = rules.nodeValue
  else node.appendChild(rules);
  return node;
}

function addCSSDef(id, cssString, doc) {
  var style = doc.createElement('style');
  style.type = 'text/css';
  if (id) style.setAttribute('id', id);
  setCSSDef(style, cssString, doc);
  doc.head.appendChild(style);
  return style;
}

export function addOrChangeCSSDeclaration(id = "lively-css", cssString, doc = document) {
  var node = doc.getElementById(id);
  return node ?
    setCSSDef(node, cssString, doc) :
    addCSSDef(id, cssString, doc);
}

export function addOrChangeLinkedCSS(id, url, doc = document) {
  var link = doc.getElementById(id);
  if (!link) {
    link = doc.createElement('node');
    link.type = 'text/css';
    link.setAttribute('id', id);
    doc.head.appendChild(link);
  }
  link.setAttribute('href', url);
  return link;
}
