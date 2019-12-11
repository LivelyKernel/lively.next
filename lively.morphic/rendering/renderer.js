/*global System,WeakMap*/
import { h, diff, patch, create as createNode } from "virtual-dom";
import { promise, arr, tree, obj, string } from "lively.lang";
import { addOrChangeCSSDeclaration, addOrChangeLinkedCSS } from "./dom-helper.js";
import {
  defaultStyle,
  renderGradient,
  defaultAttributes,
  defaultCSS,
  pathAttributes,
  svgAttributes,
  renderMorph
} from "./morphic-default.js";
import { Transform, pt } from "lively.graphics";
import { getSvgVertices } from "./property-dom-mapping.js";
import config from '../config.js';

const svgNs = "http://www.w3.org/2000/svg";

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
    world._renderer = this;
    this.rootNode = rootNode;
    this.domNode = null;
    this.domEnvironment = domEnvironment;
    this.renderMap = new WeakMap();
    this.fixedMorphNodeMap = new Map();
    this.renderWorldLoopProcess = null;
    this.renderWorldLoopLater = null;
    this.requestAnimationFrame = domEnvironment.window.requestAnimationFrame.bind(domEnvironment.window);
  }

  clear() {
    this.stopRenderWorldLoop();
    this.domNode && this.domNode.parentNode.removeChild(this.domNode);
    this.domNode = null;
    this.renderMap = new WeakMap();
  }

  ensureDefaultCSS() {
    return promise.waitFor(3000, () => this.domNode.ownerDocument)
      .then(doc => Promise.all([
        addOrChangeCSSDeclaration("lively-morphic-css", defaultCSS, doc),
        addOrChangeLinkedCSS("lively-font-awesome", config.css.fontAwesome, doc),
        addOrChangeLinkedCSS("lively-font-inconsolata", config.css.inconsolata, doc)]));
  }

  startRenderWorldLoop() {
    this.renderWorldLoopProcess = this.requestAnimationFrame(() => this.startRenderWorldLoop());
    return this.renderStep();
  }

  stopRenderWorldLoop() {
    this.domEnvironment.window.cancelAnimationFrame(this.renderWorldLoopProcess);
    this.renderWorldLoopProcess = null;
    this.domEnvironment.window.cancelAnimationFrame(this.renderWorldLoopLater);
    this.renderWorldLoopLater = null;
  }

  renderLater(n = 10) {
    this.renderWorldLoopLaterCounter = n;
    if (this.renderWorldLoopLater) return;
    this.renderWorldLoopLater = this.requestAnimationFrame(() => {
      this.renderWorldLoopLater = null;
      if (this.renderWorldLoopLaterCounter > 0)
        this.renderLater(this.renderWorldLoopLaterCounter-1);
      try { this.renderStep(); } catch (err) {
        console.error(`Error rendering morphs:`, err);
      }
    });
  }

  renderStep() {
    this.worldMorph.renderAsRoot(this);
    return this;
  }

  getNodeForMorph(morph) {
    // Hmm, this also finds dom nodes not associated with this renderer, its
    // domNode... Is this a problem?
    // return this.domNode.ownerDocument.getElementById(morph.id);

    // test, for scoped lookup, fixing the issue mentioned above
    let id = "#" + string.regExpEscape(morph.id),
        node = this.domNode && this.domNode.querySelector(id);
    if (this.domNode && this.domNode.id == morph.id) node = this.domNode;
    if (node) return node;
    // we also need to lookup fixed morphs which are covered by this renderer
    for (let fixedNode of this.fixedMorphNodeMap.values()) {
      node = fixedNode.querySelector(id);
      if (node) return node;
    }
    return null;
  }

  getMorphForNode(node) {
    return this.worldMorph ?
      this.worldMorph.withAllSubmorphsDetect(morph => morph.id === node.id) :
      null;
  }

  render(morph) {
    if (!morph.needsRerender()) {
      var renderedTree = this.renderMap.get(morph);
      if (renderedTree) return renderedTree;
    }

    morph.aboutToRender(this);

    var tree = morph.render(this);
    this.renderMap.set(morph, tree);
    return tree;
  }

  renderAsFixed(morph) {
    let tree = this.render(morph);
    tree.properties.style.position = "fixed";
    return tree;
  }

  renderFixedMorphs(fixedMorphs, world) {
    let {domNode, fixedMorphNodeMap} = this;
    if (!fixedMorphs.length && !fixedMorphNodeMap.size) return;
    if (!domNode || !domNode.parentNode) return;

    let fixedMorphNode = domNode.parentNode;

    for (let [morph, node] of fixedMorphNodeMap) {
      if (!fixedMorphs.includes(morph)) {
        node.parentNode.removeChild(node);
        fixedMorphNodeMap.delete(morph);
      }
    }

    // now figure out if the order of nodes changed
    let currentFixedMorphNodes = fixedMorphs.map(m => fixedMorphNodeMap.get(m));
    let supposedOrder = currentFixedMorphNodes.map(m => m && m.id);
    let actualOrder = [...fixedMorphNode.children].map(m => m.id).filter(id => supposedOrder.includes(id));

    if (!arr.equals(supposedOrder, actualOrder))
      currentFixedMorphNodes.map(n => n && n.parentNode && n.parentNode.removeChild(n));
    
    for (let morph of fixedMorphs) {

      var tree = this.renderMap.get(morph) || this.renderAsFixed(morph),
          newTree = this.renderAsFixed(morph),
          patches = diff(tree, newTree);

      var morphNode = fixedMorphNodeMap.get(morph);
      if (!morphNode) {
        morphNode = createNode(tree, this.domEnvironment);
        fixedMorphNodeMap.set(morph, morphNode);
      }
      if (!morphNode.parentNode)
        fixedMorphNode.appendChild(morphNode);

      patch(morphNode, patches);
    }

  }

  renderMorph(morph) {
    let submorphs = this.renderSubmorphs(morph);
    return h("div", {
      ...defaultAttributes(morph, this),
      style: defaultStyle(morph)
    }, submorphs);
  }

  renderSubmorphs(morph) {
    return this.renderSelectedSubmorphs(morph, morph.submorphs);
  }

  renderSelectedSubmorphs(morph, submorphs) {
    let {borderWidthLeft, borderWidthTop, origin: {x: oX, y: oY}} = morph,
        i = submorphs.length - 1, renderedSubmorphs = new Array(i + 1);
    for (; i >= 0; i--) renderedSubmorphs[i] = this.render(submorphs[i]);
    return h("div", {
      style: {
        position: "absolute",
        left: `${oX - (morph.isPath ? 0 : borderWidthLeft)}px`,
        top: `${oY - (morph.isPath ? 0 : borderWidthTop)}px`,
        ...(morph.isPolygon ? {
          height: '100%', width: '100%',
          overflow: morph.clipMode,
          ...(morph.clipMode !== 'visible' ? {
            [navigator.userAgent.includes('AppleWebKit') ? '-webkit-clip-path' : 'clip-path']: `url(#clipPath${morph.id})`
          } : {})
        } : {})
      }
    }, renderedSubmorphs);
  }

  renderWorld(world) {
    let {submorphs} = world,
        normalSubmorphs = [],fixedMorphs = [];
    for (let i = 0; i < submorphs.length; i++) {
      let morph = submorphs[i];
      if (morph.hasFixedPosition) fixedMorphs.push(morph);
      else normalSubmorphs.push(morph);
    }
    let renderedSubmorphs = this.renderSelectedSubmorphs(world, normalSubmorphs),
        vnode = h("div", {
          ...defaultAttributes(world, this),
          style: defaultStyle(world),
        }, renderedSubmorphs);
    vnode.fixedMorphs = fixedMorphs;
    return vnode;
  }

  renderImage(image) {
    let url = image.imageUrl;
    if (url.startsWith('data:')) {
      let dataPos = url.indexOf(',');
      let header = url.substring(5, dataPos);
      let [mimeType, encoding] = header.split(';');
      let data = url.substring(dataPos + 1);
      if (encoding !== 'base64') {
        url = string.createDataURI(data, mimeType);
      }
    }

    return h("div", {
      ...defaultAttributes(image, this),
        style: defaultStyle(image)
      }, [
        h("img", {
          src: url,
          alt: image.tooltip || '',
          draggable: false,
          style: {
            "pointer-events": "none",
            position: "absolute",
            left: 0,
            width: "100%", height: "100%"
          }
        }),
        this.renderSubmorphs(image)
      ]);
  }

  renderCanvas(canvas) {
    const CanvasHook = function() {}
    CanvasHook.prototype.hook = function(node, prop, prev) {
      let hasNewCanvas = canvas._canvas !== node;
      canvas.afterRender(node, hasNewCanvas);
    }
    return h("div", {
      ...defaultAttributes(canvas, this),
        style: defaultStyle(canvas),
      }, [
        h("canvas", {
          width: canvas.width,
          height: canvas.height,
          style: {"pointer-events": "none", position: "absolute"},
          canvasHook: new CanvasHook(),
        }),
        this.renderSubmorphs(canvas)
      ]);
  }

  renderCheckBox(checkbox) {
    return h("div", {
      ...defaultAttributes(checkbox, this),
        style: defaultStyle(checkbox)
      }, [
        h("input", {
          type: "checkbox",
          checked: checkbox.checked,
          disabled: !checkbox.active,
          draggable: false,
          style: {
            "pointer-events": "none",
            width: "15px", height: "15px",
            position: "absolute"
          }
        }),
        this.renderSubmorphs(checkbox)
    ]);
  }

  // FIXME: The gradient handling is inconsistent to the way its handled in "vanilla" morphs
  renderPath(path) {
    const {id, startMarker, endMarker, showControlPoints, origin} = path;
    const d = getSvgVertices(path.vertices);
    var el = h("path", {
      namespace: svgNs,
      id: "svg" + path.id,
      ...pathAttributes(path)
    }), clipPath = h("clipPath", {
      namespace: svgNs,
      id: "clipPath" + path.id,
    }, h("path", {namespace: svgNs, attributes: { d, fill: "white" }}));

    var markers = [clipPath];
    if (startMarker) {
      if (!startMarker.id) startMarker.id = "start-marker"
      el.properties.attributes["marker-start"] = `url(#${path.id}-${startMarker.id})`;
      markers = [];
      markers.push(this._renderPath_Marker(path, startMarker));
    }
    if (endMarker) {
      if (!endMarker.id) endMarker.id = "end-marker";
      el.properties.attributes["marker-end"] = `url(#${path.id}-${endMarker.id})`;
      if (!markers) markers = [];
      markers.push(this._renderPath_Marker(path, endMarker));
    }

    let controlPoints;
    if (showControlPoints)
      controlPoints = h("g", {namespace: svgNs}, this._renderPath_ControlPoints(path));

    return this.renderSvgMorph(path, el, markers, controlPoints);
  }

  _renderPath_ControlPoints(path, style) {
    let {
          vertices,
          borderWidth, showControlPoints, _controlPointDrag
        } = path,
        radius = borderWidth == 0 ? 6 : borderWidth + 2,
        fill = "red",
        rendered = [], i = 0;

    if (typeof showControlPoints === "object") {
      let {radius: r, fill: f} = showControlPoints;
      if (f) fill = String(f);
      if (typeof r === "number") radius = r;
    }

    if (vertices.length) {

      let i = 0, X, Y, left_cp;
      {
        let {x, y, controlPoints: {next: n}} = vertices[0],
            merge = _controlPointDrag && _controlPointDrag.maybeMerge && _controlPointDrag.maybeMerge.includes(i);
        X = x; Y = y;
        rendered.push(circ(X, Y, i, merge));
        left_cp = n;
      }

      for (i = 1; i < vertices.length-1; i++) {
        let vertex = vertices[i],
            {isSmooth, x, y, controlPoints: {previous: p, next: n}} = vertex,
            merge = _controlPointDrag && _controlPointDrag.maybeMerge && _controlPointDrag.maybeMerge.includes(i);

        if (isSmooth) {
          rendered.push(
            circ(x, y, i, merge),
            circ(X + left_cp.x, Y + left_cp.y, i-1, false, "control-2", true),
            circ(x + p.x, y + p.y, i, false, "control-1", true));
        } else {
          rendered.push(circ(x, y, i, merge));
        }

        X = x; Y = y
        left_cp = n;
      }

      {
        let {isSmooth, x, y, controlPoints: {previous: p}} = vertices[vertices.length-1],
            merge = _controlPointDrag && _controlPointDrag.maybeMerge && _controlPointDrag.maybeMerge.includes(i);
        if (isSmooth) {
          rendered.push(
            circ(x, y, i, merge),
            circ(X + left_cp.x, Y + left_cp.y, i-1, false, "control-2", true),
            circ(x + p.x, y + p.y, i, false, "control-1", true));
        } else {
          rendered.push(circ(x, y, i, merge));
        }
      }

    }

    return rendered;

    function circ(cx, cy, n, merge, type, isCtrl) {
      let r = merge ? 12 : Math.min(8, Math.max(3, radius)),
          cssClass = "path-point path-point-" + n,
          color = merge ? "orange" : fill;
      if (typeof type === "string") cssClass += "-" + type;
      if (isCtrl) r = Math.max(3, Math.ceil(r/2));
      return isCtrl ? 
        h("circle", {
        namespace: svgNs,
        style: {fill: "white", "stroke-width": 2, "stroke": color},
        attributes: {class: cssClass, cx, cy, r},
      }) : h("circle", {
        namespace: svgNs,
        style: {fill: color},
        attributes: {class: cssClass, cx, cy, r},
      });
    }
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  _renderPath_Marker(path, markerSpec) {
    return specTo_h_svg(markerSpec);

    function specTo_h_svg(spec) {
      let {tagName, id, children, style} = spec,
          childNodes = children ? children.map(specTo_h_svg) : undefined;
      if (id) id = path.id + "-" + id;
      return h(tagName, {
        namespace: svgNs,
        id, style,
        attributes: obj.dissoc(spec, ["tagName", "id", "children", "style"])
      }, childNodes);
    }
  }

  renderSvgMorph(morph, svgEl, markers, controlPoints = []) {
    let svgAttrs = svgAttributes(morph),
        {width, height} = morph.innerBounds(),
        defs, svgElements = [];

    if (morph.fill && morph.fill.isGradient) {
      if (!defs) defs = [];
      defs.push(renderGradient("fill" + morph.id, morph.extent, morph.fill));
    }
    if (morph.borderColor && morph.borderColor.valueOf().isGradient) {
      if (!defs) defs = [];
      defs.push(renderGradient("borderColor" + morph.id, morph.extent, morph.borderColor))
    }
    if (markers && markers.length) {
      if (!defs) defs = [];
      defs.push(...markers);
    }

    svgElements.push(svgEl)
    if (defs) svgElements.push(h("defs", {namespace: svgNs}, defs));  

    let basicStyle = obj.select(defaultStyle(morph), ['position', 'filter', 'display', 'opacity',
        'transform', 'top', 'left', 'transformOrigin', 'cursor', 'overflow']);
    
    return h("div", {
        ...defaultAttributes(morph, this),
        style: {
          ...basicStyle,
          width: width + "px",
          height: height + "px",
          "pointer-events": morph.reactsToPointer ? "auto" : "none",
        }
      }, [
        h("svg", {
            namespace: svgNs, version: "1.1",
            style: {
              position: "absolute",
              // "pointer-events": controlPoints ? "" : "none",
              overflow: "visible"
            },
            ...svgAttrs
          }, svgElements),
        this.renderSubmorphs(morph),
        h("svg", {
            namespace: svgNs, version: "1.1",
            style: {
              position: "absolute",
              overflow: "visible"
            },
            ...svgAttrs
          }, controlPoints),
      ]);
  }

  renderPreview(morph, opts) {
    // Creates a DOM node that is a "preview" of the morph, i.e. a
    // representation that looks like the morph but doesn't have morphic behavior
    // attached

    // include the css and fonts into the preview as well, to serve as a server side pre
    // rendering to speed up loading times of frozen parts

    // FIXME doesn't work with scale yet...!

    let {width = 100, height = 100, center = true, 
         asNode = false, includeStyles = false, disableScroll = false} = opts,
        {
          borderWidthLeft, borderWidthTop, borderWidthBottom, borderWidthRight,
          scale, position, origin, rotation
        } = morph,
        // goalWidth = width - (borderWidthLeft + borderWidthRight),
        // goalHeight = height - (borderWidthTop + borderWidthBottom),
        goalWidth = width,
        goalHeight = height,
        safeScale = Math.max(0.1, 1/scale), // Chrome crashes with too small scaling
        invTfm = new Transform(position.negated(), 0, pt(safeScale, safeScale)),
        bbox = invTfm.transformRectToRect(morph.bounds()),
        w = bbox.width, h = bbox.height,
        ratio = Math.max(0.1, Math.min(goalWidth/w, goalHeight/h)),
        tfm = new Transform(
          bbox.topLeft().negated().scaleBy(ratio).subPt(origin),
          rotation, pt(ratio, ratio));

    let node = this.getNodeForMorph(morph);
    if (node) node = node.cloneNode(true);
    else node = renderMorph(morph);
    
    if (center) {
      var previewBounds = tfm.transformRectToRect(
            morph.extent.extentAsRectangle()),
          offsetX = previewBounds.width < goalWidth ?
            (goalWidth-previewBounds.width) / 2 : 0,
          offsetY = previewBounds.height < goalHeight ?
            (goalHeight-previewBounds.height) / 2 : 0;
      tfm = tfm.preConcatenate(new Transform(pt(offsetX, offsetY)))
    }

    node.style.transform = tfm.toCSSTransformString();
    node.style.pointerEvents = "";

    // preview nodes must not appear like nodes of real morphs otherwise we
    // mistaken them for morphs and do wrong stuff in event dispatch etc.
    tree.prewalk(node, (node) => {
      if (typeof node.className !== "string") return;
        let cssClasses = node.className
              .split(" ")
              .map(ea => ea.trim())
              .filter(Boolean),
            isMorph = cssClasses.includes("Morph");
      if (!isMorph) return;
      node.className = arr.withoutAll(cssClasses, ["morph", "Morph"]).join(" ");
      node.id = "";
    },
    node => Array.from(node.childNodes));

    return asNode ? node : node.outerHTML;
  }

}
