/* global System,WeakMap */
import vdom from 'virtual-dom';
import { promise, arr, tree, obj, string } from 'lively.lang';
import { addOrChangeCSSDeclaration, addOrChangeLinkedCSS } from './dom-helper.js';
import {
  defaultStyle,
  renderGradient,
  defaultAttributes,
  defaultCSS,
  pathAttributes,
  svgAttributes,
  renderMorph
} from './morphic-default.js';
import { Transform, pt } from 'lively.graphics';
import { getSvgVertices, canBePromotedToCompositionLayer } from './property-dom-mapping.js';
import config from '../config.js';

const { h, diff, patch, create: createNode } = vdom;

const svgNs = 'http://www.w3.org/2000/svg';

const CanvasHook = function (canvas) {
  this.canvasMorph = canvas;
};
CanvasHook.prototype.hook = function (node, prop, prev) {
  const hasNewCanvas = this.canvasMorph._canvas !== node && node.tagName == 'CANVAS';
  this.canvasMorph.afterRender(node, hasNewCanvas);
};

const InitStroke = function (path, renderer, reverse) { this.path = path; this.renderer = renderer; this.reverse = reverse; };
InitStroke.prototype.hook = function (node, propertyName, previousValue) {
  const p = this.path.drawnProportion || 0;
  if (p == 0) return;
  node.setAttribute('stroke-width', this.path.borderWidth.valueOf() + 1);
  node.setAttribute('stroke-dasharray', node.getTotalLength());
  node.setAttribute('stroke-dashoffset', node.getTotalLength() * (!this.reverse ? (-1 + (1 - p)) : (1 - p)));
};

export class Renderer {
  static default () { return this._default || new this(); }

  constructor (world, rootNode, domEnvironment) {
    if (!world || !world.isMorph) { throw new Error(`Trying to initialize renderer with an invalid world morph: ${world}`); }
    if (!rootNode || !('nodeType' in rootNode)) { throw new Error(`Trying to initialize renderer with an invalid root node: ${rootNode}`); }
    if (!domEnvironment) {
      const doc = rootNode.getRootNode();
      domEnvironment = { window: System.global, document: doc };
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

  async clear () {
    const domNode = this.domNode;
    try {
      await this.stopRenderWorldLoop();
    } catch (err) {

    }
    if (domNode) {
      const parent = domNode.parentNode;
      parent.removeChild(domNode);
      [...this.fixedMorphNodeMap.values()].forEach(n => parent.removeChild(n));
    }
    this.domNode = null;
    this.renderMap = new WeakMap();
  }

  ensureDefaultCSS () {
    const fm = this.worldMorph.env.fontMetric;
    return promise.waitFor(3000, () => this.domNode.getRootNode())
      .then(doc => Promise.all([
        addOrChangeCSSDeclaration('lively-morphic-css', defaultCSS, doc),
        promise.waitFor(1000, () => fm.isFontSupported('IBM Plex Sans') && fm.isFontSupported('IBM Plex Mono'), false).then((isSupported) => !isSupported && addOrChangeLinkedCSS('lively-ibm-plex', config.css.ibmPlex)), // those are many files, is there a smaller one?
        addOrChangeLinkedCSS('lively-font-awesome', config.css.fontAwesome, doc, false),
        addOrChangeLinkedCSS('lively-font-inconsolata', config.css.inconsolata, doc, false)]));
  }

  startRenderWorldLoop () {
    this._stopped = false;
    this._renderWorldLoopLater = null;
    this.renderWorldLoopProcess = this.requestAnimationFrame(() => this.startRenderWorldLoop());
    return this.renderStep();
  }

  async stopRenderWorldLoop () {
    this._stopped = true;
    this.domEnvironment.window.cancelAnimationFrame(this.renderWorldLoopProcess);
    this.renderWorldLoopProcess = null;
    this.domEnvironment.window.cancelAnimationFrame(this.renderWorldLoopLater);
    this.renderWorldLoopLater = null;
    await promise.waitFor(2000, () => !this.worldMorph.needsRerender());
  }

  renderLater (n = 10) {
    this.renderWorldLoopLaterCounter = n;
    if (this.renderWorldLoopLater || this._stopped) return;
    this.renderWorldLoopLater = this.requestAnimationFrame(() => {
      this.renderWorldLoopLater = null;
      if (this.renderWorldLoopLaterCounter > 0) { this.renderLater(this.renderWorldLoopLaterCounter - 1); }
      try { this.renderStep(); } catch (err) {
        console.error('Error rendering morphs:', err);
      }
    });
  }

  renderStep () {
    this.worldMorph.renderAsRoot(this);
    return this;
  }

  getNodeForMorph (morph) {
    // Hmm, this also finds dom nodes not associated with this renderer, its
    // domNode... Is this a problem?
    // return this.domNode.ownerDocument.getElementById(morph.id);

    // test, for scoped lookup, fixing the issue mentioned above
    const id = '#' + string.regExpEscape(morph.id);
    let node = this.domNode && this.domNode.querySelector(id);
    if (this.domNode && this.domNode.id == morph.id) node = this.domNode;
    if (node) return node;
    // we also need to lookup fixed morphs which are covered by this renderer
    for (const fixedNode of this.fixedMorphNodeMap.values()) {
      node = fixedNode.querySelector(id);
      if (node) return node;
    }
    return null;
  }

  getMorphForNode (node) {
    return this.worldMorph
      ? this.worldMorph.withAllSubmorphsDetect(morph => morph.id === node.id)
      : null;
  }

  render (morph) {
    if (!morph.needsRerender()) {
      const renderedTree = this.renderMap.get(morph);
      if (renderedTree) return renderedTree;
    }

    morph.aboutToRender(this);

    const tree = morph.render(this);
    this.renderMap.set(morph, tree);
    return tree;
  }

  renderAsFixed (morph) {
    const tree = this.render(morph);
    if (!morph.isHTMLMorph) { tree.properties.style.position = 'fixed'; }
    // in case this world is embedded, we need to add the offset of the world morph here
    if (this.worldMorph.isEmbedded) {
      const bbx = this.domNode.getBoundingClientRect();
      const { origin, owner, position } = morph;
      const x = Math.round(position.x - origin.x - (morph._skipWrapping && owner ? owner.borderWidthLeft : 0));
      const y = Math.round(position.y - origin.y - (morph._skipWrapping && owner ? owner.borderWidthTop : 0));
      const { x: left, y: top } = canBePromotedToCompositionLayer(morph) ? pt(0, 0) : pt(x, y);
      tree.properties.style.top = top + bbx.y + 'px';
      tree.properties.style.left = left + bbx.x + 'px';
    }
    return tree;
  }

  renderFixedMorphs (fixedMorphs, world) {
    const { domNode, fixedMorphNodeMap } = this;
    if (!fixedMorphs.length && !fixedMorphNodeMap.size) return;
    if (!domNode || !domNode.parentNode) return;

    const fixedMorphNode = domNode.parentNode;

    for (const [morph, node] of fixedMorphNodeMap) {
      if (!fixedMorphs.includes(morph)) {
        if (node.parentNode) node.parentNode.removeChild(node);
        fixedMorphNodeMap.delete(morph);
      }
    }

    // now figure out if the order of nodes changed
    const currentFixedMorphNodes = fixedMorphs.map(m => fixedMorphNodeMap.get(m));
    const supposedOrder = fixedMorphs.map(m => m.id);
    const actualOrder = [...fixedMorphNode.children].map(m => m.id).filter(id => supposedOrder.includes(id));

    const orderChanged = !arr.equals(supposedOrder, actualOrder);
    const restoreScrollFor = new WeakMap();

    if (orderChanged) {
      const scrolls = new WeakMap();
      const nodes = arr.compact(fixedMorphs.map(m => m.withAllSubmorphsDo(m => this.getNodeForMorph(m))).flat());
      nodes.forEach(node => scrolls.set(node, node.scrollTop));
      currentFixedMorphNodes.map(n => n && n.parentNode && n.parentNode.removeChild(n));
      nodes.forEach(node => {
        if (scrolls.get(node) != node.scrollTop) {
          restoreScrollFor.set(node, scrolls.get(node));
        }
      });
    }

    for (const morph of fixedMorphs) {
      const tree = this.renderMap.get(morph) || this.renderAsFixed(morph);
      const newTree = this.renderAsFixed(morph);
      const patches = diff(tree, newTree);
      let morphNode = fixedMorphNodeMap.get(morph);

      if (!morphNode) {
        morphNode = createNode(tree, this.domEnvironment);
        fixedMorphNodeMap.set(morph, morphNode);
      }
      if (!morphNode.parentNode) {
        fixedMorphNode.appendChild(morphNode);
      }

      if (orderChanged) {
        // the scroll of dom nodes is reset once they are unmounted
        // immediately restore once added to the DOM again
        morph.withAllSubmorphsDo(m => this.getNodeForMorph(m)).forEach(node => {
          if (restoreScrollFor.has(node)) node.scrollTop = restoreScrollFor.get(node);
        });
      }

      patch(morphNode, patches);
    }
  }

  renderMorph (morph) {
    const submorphs = this.renderSubmorphs(morph);
    return h('div', {
      style: defaultStyle(morph),
      ...defaultAttributes(morph, this)
    }, submorphs);
  }

  renderEllipse (morph) {
    const submorphs = this.renderSubmorphs(morph);
    const style = defaultStyle(morph);
    delete style.borderRadius;
    style['border-radius'] = '50%';
    return h('div', {
      style,
      ...defaultAttributes(morph, this)
    }, submorphs);
  }

  renderSubmorphs (morph) {
    return this.renderSelectedSubmorphs(morph, morph.submorphs);
  }

  renderSelectedSubmorphs (morph, submorphs) {
    let { borderWidthLeft, borderWidthTop, origin: { x: oX, y: oY } } = morph;
    let i = submorphs.length - 1; let renderedSubmorphs = new Array(i + 1);
    let skipWrapping = morph.layout && morph.layout.renderViaCSS;
    for (; i >= 0; i--) {
      renderedSubmorphs[i] = this.render(submorphs[i]);
    }
    if (skipWrapping || renderedSubmorphs.length == 0) {
      return renderedSubmorphs;
    }

    return h('div', {
      key: 'submorphs-' + morph.id,
      style: {
        position: 'absolute',
        left: `${oX - (morph.isPath ? 0 : borderWidthLeft)}px`,
        top: `${oY - (morph.isPath ? 0 : borderWidthTop)}px`,
        ...(morph.isPolygon
          ? {
              height: '100%',
              width: '100%',
              overflow: morph.clipMode,
              ...(morph.clipMode !== 'visible'
                ? {
                    [navigator.userAgent.includes('AppleWebKit') ? '-webkit-clip-path' : 'clip-path']: `url(#clipPath${morph.id})`
                  }
                : {})
            }
          : {})
      }
    }, renderedSubmorphs);
  }

  renderWorld (world) {
    const { submorphs } = world;
    const normalSubmorphs = []; const fixedMorphs = [];
    for (let i = 0; i < submorphs.length; i++) {
      const morph = submorphs[i];
      if (morph.hasFixedPosition) fixedMorphs.push(morph);
      else normalSubmorphs.push(morph);
    }
    const renderedSubmorphs = this.renderSelectedSubmorphs(world, normalSubmorphs);
    const vnode = h('div', {
      ...defaultAttributes(world, this),
      style: defaultStyle(world)
    }, renderedSubmorphs);
    vnode.fixedMorphs = fixedMorphs;
    return vnode;
  }

  renderImage (image) {
    let url = image.getURLForImgNode();

    return h('div', {
      ...defaultAttributes(image, this),
      style: defaultStyle(image)
    }, [
      h('img', {
        src: url,
        alt: image.tooltip || '',
        draggable: false,
        style: {
          'pointer-events': 'none',
          position: 'absolute',
          left: 0,
          width: '100%',
          height: '100%'
        }
      }),
      this.renderSubmorphs(image)
    ]);
  }

  renderCanvas (canvas) {
    return h('div', {
      ...defaultAttributes(canvas, this),
      style: defaultStyle(canvas)
    }, [
      h('canvas', {
        width: canvas.width,
        height: canvas.height,
        style: { 'pointer-events': 'none', position: 'absolute' },
        canvasHook: new CanvasHook(canvas)
      }),
      this.renderSubmorphs(canvas)
    ]);
  }

  renderCheckBox (checkbox) {
    return h('div', {
      ...defaultAttributes(checkbox, this),
      style: defaultStyle(checkbox)
    }, [
      h('input', {
        type: 'checkbox',
        checked: checkbox.checked,
        disabled: !checkbox.active,
        draggable: false,
        style: {
          'pointer-events': 'none',
          width: '15px',
          height: '15px',
          position: 'absolute'
        }
      }),
      this.renderSubmorphs(checkbox)
    ]);
  }

  // FIXME: The gradient handling is inconsistent to the way its handled in "vanilla" morphs
  renderPath (path) {
    const { id, startMarker, endMarker, showControlPoints, origin, drawnProportion, borderWidth } = path;
    const d = getSvgVertices(path.vertices);
    const el = h('path', {
      namespace: svgNs,
      id: 'svg' + path.id,
      ...pathAttributes(path)
    }); const maskPath = h('mask', {
      namespace: svgNs,
      id: 'mask' + path.id
    }, [
      h('rect', {
        namespace: svgNs,
        attributes: {
          fill: 'white',
          x: 0,
          y: 0,
          width: path.width + 20,
          height: path.height + 20
        }
      }),
      h('path', {
        namespace: svgNs,
        initStroke: new InitStroke(path, this, true),
        attributes: {
          d,
          stroke: 'black',
          fill: 'none'
        }
      }),
      h('path', {
        namespace: svgNs,
        initStroke: new InitStroke(path, this, false),
        attributes: {
          d,
          stroke: 'white',
          fill: 'none'
        }
      })
    ]);
    const clipPath = h('clipPath', {
      namespace: svgNs,
      id: 'clipPath' + path.id
    }, h('path', { namespace: svgNs, attributes: { d, fill: 'white' } }));

    let markers = [clipPath, maskPath];
    if (startMarker) {
      if (!startMarker.id) startMarker.id = 'start-marker';
      el.properties.attributes['marker-start'] = `url(#${path.id}-${startMarker.id})`;
      markers = [];
      markers.push(this._renderPath_Marker(path, startMarker));
    }
    if (endMarker) {
      if (!endMarker.id) endMarker.id = 'end-marker';
      el.properties.attributes['marker-end'] = `url(#${path.id}-${endMarker.id})`;
      if (!markers) markers = [];
      markers.push(this._renderPath_Marker(path, endMarker));
    }

    let controlPoints;
    if (showControlPoints) { controlPoints = h('g', { namespace: svgNs }, this._renderPath_ControlPoints(path)); }

    return this.renderSvgMorph(path, el, markers, controlPoints);
  }

  _renderPath_ControlPoints (path, style) {
    const {
      vertices,
      borderWidth, showControlPoints, _controlPointDrag
    } = path;
    let radius = borderWidth == 0 ? 6 : borderWidth + 2;
    let fill = 'red';
    const rendered = []; const i = 0;

    if (typeof showControlPoints === 'object') {
      const { radius: r, fill: f } = showControlPoints;
      if (f) fill = String(f);
      if (typeof r === 'number') radius = r;
    }

    if (vertices.length) {
      let i = 0; let X; let Y; let left_cp;
      {
        const { x, y, controlPoints: { next: n } } = vertices[0];
        const merge = _controlPointDrag && _controlPointDrag.maybeMerge && _controlPointDrag.maybeMerge.includes(i);
        X = x; Y = y;
        rendered.push(circ(X, Y, i, merge));
        left_cp = n;
      }

      for (i = 1; i < vertices.length - 1; i++) {
        const vertex = vertices[i];
        const { isSmooth, x, y, controlPoints: { previous: p, next: n } } = vertex;
        const merge = _controlPointDrag && _controlPointDrag.maybeMerge && _controlPointDrag.maybeMerge.includes(i);

        if (isSmooth) {
          rendered.push(
            circ(x, y, i, merge),
            circ(X + left_cp.x, Y + left_cp.y, i - 1, false, 'control-2', true),
            circ(x + p.x, y + p.y, i, false, 'control-1', true));
        } else {
          rendered.push(circ(x, y, i, merge));
        }

        X = x; Y = y;
        left_cp = n;
      }

      {
        const { isSmooth, x, y, controlPoints: { previous: p } } = vertices[vertices.length - 1];
        const merge = _controlPointDrag && _controlPointDrag.maybeMerge && _controlPointDrag.maybeMerge.includes(i);
        if (isSmooth) {
          rendered.push(
            circ(x, y, i, merge),
            circ(X + left_cp.x, Y + left_cp.y, i - 1, false, 'control-2', true),
            circ(x + p.x, y + p.y, i, false, 'control-1', true));
        } else {
          rendered.push(circ(x, y, i, merge));
        }
      }
    }

    return rendered;

    function circ (cx, cy, n, merge, type, isCtrl) {
      let r = merge ? 12 : Math.min(8, Math.max(3, radius));
      let cssClass = 'path-point path-point-' + n;
      const color = merge ? 'orange' : fill;
      if (typeof type === 'string') cssClass += '-' + type;
      if (isCtrl) r = Math.max(3, Math.ceil(r / 2));
      return isCtrl
        ? h('circle', {
          namespace: svgNs,
          style: { fill: 'white', 'stroke-width': 2, stroke: color },
          attributes: { class: cssClass, cx, cy, r }
        })
        : h('circle', {
          namespace: svgNs,
          style: { fill: color },
          attributes: { class: cssClass, cx, cy, r }
        });
    }
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  _renderPath_Marker (path, markerSpec) {
    return specTo_h_svg(markerSpec);

    function specTo_h_svg (spec) {
      let { tagName, id, children, style } = spec;
      const childNodes = children ? children.map(specTo_h_svg) : undefined;
      if (id) id = path.id + '-' + id;
      return h(tagName, {
        namespace: svgNs,
        id,
        style,
        attributes: obj.dissoc(spec, ['tagName', 'id', 'children', 'style'])
      }, childNodes);
    }
  }

  renderSvgMorph (morph, svgEl, markers, controlPoints = []) {
    const svgAttrs = svgAttributes(morph);
    const { width, height } = morph.innerBounds();
    let defs; const svgElements = [];

    if (morph.fill && morph.fill.isGradient) {
      if (!defs) defs = [];
      defs.push(renderGradient('fill' + morph.id, morph.extent, morph.fill));
    }
    if (morph.borderColor && morph.borderColor.valueOf().isGradient) {
      if (!defs) defs = [];
      defs.push(renderGradient('borderColor' + morph.id, morph.extent, morph.borderColor));
    }
    if (markers && markers.length) {
      if (!defs) defs = [];
      defs.push(...markers);
    }

    svgElements.push(svgEl);
    if (defs) svgElements.push(h('defs', { namespace: svgNs }, defs));

    const basicStyle = obj.select(defaultStyle(morph), ['position', 'filter', 'display', 'opacity',
      'transform', 'top', 'left', 'transformOrigin', 'cursor', 'overflow']);

    return h('div', {
      ...defaultAttributes(morph, this),
      style: {
        ...basicStyle,
        width: width + 'px',
        height: height + 'px',
        'pointer-events': morph.reactsToPointer ? 'auto' : 'none'
      }
    }, [
      h('svg', {
        namespace: svgNs,
        version: '1.1',
        style: {
          position: 'absolute',
          'stroke-linejoin': morph.cornerStyle || 'mint',
          'stroke-linecap': morph.endStyle || 'round',
          // "pointer-events": controlPoints ? "" : "none",
          overflow: 'visible'
        },
        ...svgAttrs
      }, svgElements),
      this.renderSubmorphs(morph),
      h('svg', {
        namespace: svgNs,
        version: '1.1',
        style: {
          position: 'absolute',
          overflow: 'visible'
        },
        ...svgAttrs
      }, controlPoints)
    ]);
  }

  renderPreview (morph, opts) {
    // Creates a DOM node that is a "preview" of the morph, i.e. a
    // representation that looks like the morph but doesn't have morphic behavior
    // attached

    // include the css and fonts into the preview as well, to serve as a server side pre
    // rendering to speed up loading times of frozen parts

    // FIXME doesn't work with scale yet...!

    const {
      width = 100, height = 100, center = true, ignoreMorphs = [],
      asNode = false, includeStyles = false, disableScroll = false
    } = opts;
    const {
      borderWidthLeft, borderWidthTop, borderWidthBottom, borderWidthRight,
      scale, position, origin, rotation
    } = morph;
    // goalWidth = width - (borderWidthLeft + borderWidthRight),
    // goalHeight = height - (borderWidthTop + borderWidthBottom),
    const goalWidth = width;
    const goalHeight = height;
    const safeScale = Math.max(0.1, 1 / scale); // Chrome crashes with too small scaling
    const invTfm = new Transform(position.negated(), 0, pt(safeScale, safeScale));
    const bbox = invTfm.transformRectToRect(morph.bounds());
    const w = bbox.width; const h = bbox.height;
    const ratio = Math.max(0.1, Math.min(goalWidth / w, goalHeight / h));
    let tfm = new Transform(
      bbox.topLeft().negated().scaleBy(ratio).subPt(origin),
      rotation, pt(ratio, ratio));

    let node = this.getNodeForMorph(morph);
    if (node) node = node.cloneNode(true);
    else node = renderMorph(morph);

    if (center) {
      const previewBounds = tfm.transformRectToRect(
        morph.extent.extentAsRectangle());
      const offsetX = previewBounds.width < goalWidth
        ? (goalWidth - previewBounds.width) / 2
        : 0;
      const offsetY = previewBounds.height < goalHeight
        ? (goalHeight - previewBounds.height) / 2
        : 0;
      tfm = tfm.preConcatenate(new Transform(pt(offsetX, offsetY)));
    }

    node.style.transform = tfm.toCSSTransformString();
    node.style.pointerEvents = '';

    // preview nodes must not appear like nodes of real morphs otherwise we
    // mistaken them for morphs and do wrong stuff in event dispatch etc.
    tree.prewalk(node, (node) => {
      if (typeof node.className !== 'string') return;
      const cssClasses = node.className
        .split(' ')
        .map(ea => ea.trim())
        .filter(Boolean);
      const isMorph = cssClasses.includes('Morph');
      if (!isMorph) return;
      node.className = arr.withoutAll(cssClasses, ['morph', 'Morph']).join(' ');
      if (ignoreMorphs.find(m => m.id === node.id)) node.remove();
      node.id = '';
    },
    node => Array.from(node.childNodes));

    return asNode ? node : node.outerHTML;
  }
}
