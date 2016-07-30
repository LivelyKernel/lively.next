import { promise, num } from "lively.lang";
import { addOrChangeCSSDeclaration, addOrChangeLinkedCSS } from "./dom-helper.js";
import { defaultStyle, defaultAttributes, render } from "./morphic-default.js";
import {h} from "virtual-dom";

const defaultCSS = `

.no-html-select {
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  -khtml-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
}

.halo-guide {
  -webkit-animation: fadein .5s;
}

.smooth-extent {
  -webkit-transition: width .15s, height .15s, transform .15s;
}

.halo-mesh {
  background-color:transparent;
  background-image: linear-gradient(rgba(0,0,0,.1) 2px, transparent 2px),
  linear-gradient(90deg, rgba(0,0,0,.1) 2px, transparent 2px),
  linear-gradient(rgba(0,0,0,.1) 1px, transparent 1px),
  linear-gradient(90deg, rgba(0,0,0,.1) 1px, transparent 1px);
  background-size:100px 100px, 100px 100px, 10px 10px, 10px 10px;
  background-position:-2px -2px, -2px -2px, -1px -1px, -1px -1px;
   -webkit-animation: fadein .5s;
}

.morph {
  /*for aliasing issue in chrome: http://stackoverflow.com/questions/6492027/css-transform-jagged-edges-in-chrome*/
  -webkit-backface-visibility: hidden;

  /*include border size in extent of element*/
  box-sizing: border-box;

  /*don't use dom selection on morphs*/
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  -khtml-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
  zIndex: 1010
}

.hand {
  z-index: 1;
}

.halo {
  z-index: 2;
}

.center-text {
	text-align: center;
	vertical-align: middle;
}

.halo-item {
  /*FIXME: we shouldn't need to hardcode the size...*/
	line-height: 24px !important;
	text-align: center;
	vertical-align: middle;
}

@-webkit-keyframes fadein { /* Safari and Chrome */
    from {
        opacity:0;
    }
    to {
        opacity:1;
    }
}

`;

export class Renderer {

  static default() { return this._default || new this() }

  constructor(world, rootNode, domEnvironment) {
    if (!world || !world.isMorph)
      throw new Error(`Trying to initialize renderer with an invalid world morph: ${world}`)
    if (!rootNode || !("nodeType" in rootNode))
      throw new Error(`Trying to initialize renderer with an invalid root node: ${rootNode}`)
    if (!domEnvironment) {
      var doc = rootNode.ownerDocument;
      domEnvironment = {window: System.global, document: doc};
    }
    this.worldMorph = world;
    world._isWorld = true; // for world() method
    world._renderer = this;
    this.rootNode = rootNode;
    this.domNode = null;
    this.domEnvironment = domEnvironment;
    this.renderMap = new WeakMap();
    this.renderWorldLoopProcess = null;
    FontMetric.initDefault(domEnvironment.document);
  }

  clear() {
    this.stopRenderWorldLoop();
    this.domNode && this.domNode.parentNode.removeChild(this.domNode);
    this.domNode = null;
    this.renderMap = new WeakMap();
    FontMetric.removeDefault();
  }

  ensureDefaultCSS() {
    return promise.waitFor(3000, () => this.domNode.ownerDocument)
      .then(doc => Promise.all([
        addOrChangeCSSDeclaration("lively-morphic-css", defaultCSS, doc),
        addOrChangeLinkedCSS("lively-font-awesome", System.decanonicalize("lively.morphic/assets/font-awesome/css/font-awesome.css"), doc)]));
  }

  startRenderWorldLoop() {
    this.worldMorph.renderAsRoot(this);
    this.renderWorldLoopProcess = this.domEnvironment.window.requestAnimationFrame(() =>
      this.startRenderWorldLoop());
    return this;
  }

  stopRenderWorldLoop() {
    this.domEnvironment.window.cancelAnimationFrame(this.renderWorldLoopProcess);
    this.renderWorldLoopProcess = null;
  }

  getNodeForMorph(morph) {
    // Hmm, this also finds dom nodes not associated with this renderer, its
    // domNode... Is this a problem?
    // return this.domNode.ownerDocument.getElementById(morph.id);

    // test, for scoped lookup, fixing the issue mentioned above
    return this.domNode ? this.domNode.querySelector("#" + morph.id) : null;
  }

  getMorphForNode(node) {
    return this.worldMorph ?
      this.worldMorph.withAllSubmorphsDetect(morph => morph.id === node.id) :
      null;
  }

  render(x) {
    if (!x.needsRerender()) {
      var rendered = this.renderMap.get(x);
      if (rendered) return rendered;
    }
    
    x.aboutToRender();

    var tree = x.render(this);
    this.renderMap.set(x, tree);
    return tree;
  }

  renderMorph(morph) {
    return h("div", {
      ...defaultAttributes(morph),
      style: defaultStyle(morph)
    }, this.renderSubmorphs(morph));
  }
  
  renderSubmorphs(morph) {
    return h("div", {style: {position: "absolute",
                             transform: `translate(${morph.origin.x}px,${morph.origin.y}px)`}}, 
            morph.submorphs.map(m => this.render(m)));
  }

  renderText(text) {
    return h("textarea", {
      ...defaultAttributes(text),
      value: text.textString,
      readOnly: text.readOnly,
      placeholder: text.placeholder,
      ...(text._needsSelect && {
        selectionStart: text._selection.start,
        selectionEnd: text._selection.end
      }),
      style: {
        ...defaultStyle(text),
        resize: "none",
        border: 0,
        "white-space": "nowrap",
        padding: "0px",
        "font-family": text.fontFamily,
        "font-size": text.fontSize + "px",
        "color": String(text.fontColor)
      }
    });
  }

  renderImage(image) {
    return h("div", {...defaultAttributes(image),
                     style: defaultStyle(image)},
                    [h("img", {src: image.imageUrl,
                               draggable: false,
                               style: {
                                  "pointer-events": "none",
                                  position: "absolute",
                                  width: "100%", height: "100%"}}),
                     this.renderSubmorphs(image)]);
  }

  renderPath(path) {
    const vertices = [],
          edge = ({x: x1, y: y1}, {x: x2, y: y2}) =>
                  h("path",
                    {namespace: "http://www.w3.org/2000/svg",
                     attributes:
                      {"sroke-width": path.borderWidth,
                       stroke: path.gradient ? "url(#" + path.id + ")" : path.borderColor,
                       d: "M"+x1+","+y1+" "+"L"+x2+","+y2}});
  
    for (var i = 0; i < path.vertices.length - 1; i++) {
      vertices.push(edge(path.vertices[i], path.vertices[i + 1]));
    }
    return this.renderSvgMorph(path, vertices);
  }
  
  renderPolygon(polygon) {
    const vertices = h("polygon",
                        {namespace: "http://www.w3.org/2000/svg",
                         attributes:
                          {style: "fill:" + (polygon.gradient ? "url(#" + polygon.id + ")" : polygon.fill) + 
                                  ";stroke-width:" + polygon.borderWidth +
                                  ";stroke:" + polygon.borderColor,
                           points: polygon.vertices.map(({x,y}) => x + "," + y).join(" ")}});
    return this.renderSvgMorph(polygon, [vertices]);
  }
  
  renderSvgMorph(morph, svg) {
    const {position, WebkitFilter, transform, transformOrigin,
           display, top, left} = defaultStyle(morph),
          {width, height} = morph.innerBounds(),
          defs = morph.gradient && renderGradient(morph);
    return h("div", {...defaultAttributes(morph),
                     style: {transform, transformOrigin, position,
                             width: width + 'px', height: height + 'px',
                             display, WebkitFilter, "pointer-events": "auto"}},
              [h("svg", {namespace: "http://www.w3.org/2000/svg",
                        style: {position: "absolute", "pointer-events": "none"},
                        attributes:
                         {width, height, "viewBox": [0,0,width,height].join(" "),
                        ...(morph.borderStyle == "dashed" && {"stroke-dasharray": "7 4"})}},
                  [defs].concat(svg)),
                this.renderSubmorphs(morph)]);
  }
}


function renderGradient(morph) {
  return h("defs", {namespace: "http://www.w3.org/2000/svg"},
                h("linearGradient", {namespace: "http://www.w3.org/2000/svg",
                                     attributes: {id: morph.id,
                                                  gradientUnits: "userSpaceOnUse"}
                                     },
                    morph.gradient.map(([k, c]) =>
                        h("stop",
                            {namespace: "http://www.w3.org/2000/svg",
                              attributes:
                                {offset: (k * 100) + "%",
                                 "stop-color": c}}))));
}


export class FontMetric {

  static default() {
    if (!this._fontMetric)
      throw new Error("FontMetric has not yet been initialized!")
    return this._fontMetric;
  }

  static initDefault(doc = typeof document !== "undefined" ? document : null) {
    if (!this._fontMetric) {
      this._fontMetric = new FontMetric();
      this._fontMetric.install(doc, doc.body);
    }
  }

  static removeDefault() {
    if (this._fontMetric) {
      this._fontMetric.uninstall();
      this._fontMetric = null;
    }
  }

  constructor() {
    this.charMap = [];
    this.parentElement = null;
    this.element = null;
  }

  install(doc, parentEl) {
    this.parentElement = parentEl;
    this.element = doc.createElement("div");
    this.setMeasureNodeStyles(this.element.style, true);
    this.parentElement.appendChild(this.element);
  }

  uninstall() {
    if (this.element) {
      this.parentElement.removeChild(this.element);
      this.parentElement = null;
      this.element = null;
    }
  }

  setMeasureNodeStyles(style, isRoot) {
    style.width = style.height = "auto";
    style.left = style.top = "0px";
    style.visibility = "hidden";
    style.position = "absolute";
    style.whiteSpace = "pre";
    style.font = "inherit";
    style.overflow = isRoot ? "hidden" : "visible";
  }

  measure(fontFamily, fontSize, char) {
    var rect = null;
    this.element.innerHTML = char;
    this.element.style.fontFamily = fontFamily;
    this.element.style.fontSize = fontSize + "px";
    try {
      rect = this.element.getBoundingClientRect();
    } catch(e) {
      rect = {width: 0, height:0};
    };
    return {
      height: rect.height,
      width: rect.width
    }
  }

  sizeFor(fontFamily, fontSize, char) {
    if (char.length > 1)
      return this.sizeForStr(fontFamily, fontSize, char);

    if (!this.charMap[fontFamily]) {
      this.charMap[fontFamily] = [];
    }
    if (!this.charMap[fontFamily][fontSize]) {
      this.charMap[fontFamily][fontSize] = [];
    }
    if (!this.charMap[fontFamily][fontSize][char])
      this.charMap[fontFamily][fontSize][char] = this.measure(fontFamily, fontSize, char);
    return this.charMap[fontFamily][fontSize][char];
  }

  sizeForStr(fontFamily, fontSize, str) {
    var height = 0, width = 0;
    for (let line of str.split('\n')) {
      let lineHeight = 0, lineWidth = 0;
      for (let char of line.split('')) {
        let { height: charHeight, width: charWidth } = this.sizeFor(fontFamily, fontSize, char);
        if (charHeight > lineHeight) lineHeight = charHeight;
        lineWidth += charWidth;
      }
      if (lineWidth > width) width = lineWidth;
      height += lineHeight || this.sizeFor(fontFamily, fontSize, " ").height;
    }
    return { height: height, width: width };
  }

  asciiSizes(fontFamily, fontSize) {
    var result = {};
    for (var i = 32; i <= 126; i++) {
      var char = String.fromCharCode(i);
      result[char] = this.sizeFor(fontFamily, fontSize, char)
    }
    return result;
  }
}
