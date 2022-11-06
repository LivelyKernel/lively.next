import { withoutAll } from 'lively.lang/array.js';
import { arr, tree, num, obj } from 'lively.lang';
import { getSvgVertices, canBePromotedToCompositionLayer, applyAttributesToNode, stylepropsToNode, lineWrappingToClass } from './property-dom-mapping.js';
import { Rectangle, pt, Transform } from 'lively.graphics';
import { objectReplacementChar } from 'lively.morphic/text/document.js';
import { splitTextAndAttributesIntoLines } from 'lively.morphic/text/attributes.js';

import { keyed, noOpUpdate } from './keyed.js';
import promise from 'lively.lang/promise.js';
import { defaultCSS, applyStylingToNode, cssForTexts } from './morphic-default.js';
import { addOrChangeCSSDeclaration, addOrChangeLinkedCSS, config } from 'lively.morphic';

const svgNs = 'http://www.w3.org/2000/svg';

export default class Renderer {
  // -=-=-=-
  // SETUP
  // -=-=-=-

  /**
   * @param {Morph} world - The world that this renderer renders
   * @param {Node} rootNode - Parent node of the node that the world gets rendered into
   * @param {DomEnvironment} domEnvironment
   */
  constructor (world, rootNode, domEnvironment) {
    if (!world || !world.isMorph) { throw new Error(`Trying to initialize renderer with an invalid world morph: ${world}`); }
    if (!rootNode || !('nodeType' in rootNode)) { throw new Error(`Trying to initialize renderer with an invalid root node: ${rootNode}`); }

    if (!domEnvironment) {
      const doc = rootNode.getRootNode();
      domEnvironment = { window: System.global, document: doc };
    }
    this.worldMorph = world;
    this.worldMorph.renderingState.renderedFixedMorphs = [];
    this.renderMap = new WeakMap();
    this.morphsWithStructuralChanges = [];
    this.renderedMorphsWithChanges = [];
    this.renderedMorphsWithAnimations = [];
    this.doc = world.env.domEnv.document;
    this.bodyNode = rootNode;
    this.rootNode = this.doc.createElement('div');
    this.rootNode.setAttribute('id', this.worldMorph.id);
    this.rootNode.classList.add('LivelyWorld', 'World', 'Morph', 'morph');
    this.renderMap.set(this.worldMorph, this.rootNode);
    this.installTextCSS();
    this.installPlaceholder();
    this.ensureDefaultCSS();
    window.renderer = this;
    this.domEnvironment = domEnvironment;
    this.bodyNode.appendChild(this.rootNode);
    world._renderer = this;
    this.requestAnimationFrame = domEnvironment.window.requestAnimationFrame.bind(domEnvironment.window);
  }

  /**
   * The Placeholder is currently used for measuring the bounds of Text that is not backed by a Document.
   */
  installPlaceholder () {
    this.placeholder = this.placeholder || this.doc.getElementById('placeholder');

    if (this.placeholder) return;

    const placeholder = this.doc.createElement('div');
    placeholder.id = 'placeholder';
    placeholder.style.height = 'fit-content';
    placeholder.style.width = 'fit-content';
    placeholder.style.visibility = 'hidden';
    placeholder.style.position = 'absolute';
    placeholder.style.transform = 'translate(0px, 0px)'; // removes element from the flow
    this.placeholder = this.doc.body.appendChild(placeholder);
  }

  installTextCSS () {
    addOrChangeCSSDeclaration('styles-for-text', cssForTexts, this.doc);
  }

  ensureDefaultCSS () {
    const fm = $world.env.fontMetric;
    return promise.waitFor(3000, () => this.bodyNode.getRootNode())
      .then(doc => Promise.all([
        addOrChangeCSSDeclaration('lively-morphic-css', defaultCSS, doc),
        promise.waitFor(1000, () => fm.isFontSupported('IBM Plex Sans') && fm.isFontSupported('IBM Plex Mono'), false).then((isSupported) => !isSupported && addOrChangeLinkedCSS('lively-ibm-plex', config.css.ibmPlex)), // those are many files, is there a smaller one?
        addOrChangeLinkedCSS('lively-font-awesome', config.css.fontAwesome, doc, false),
        addOrChangeLinkedCSS('lively-font-inconsolata', config.css.inconsolata, doc, false)]));
  }

  async clear () {
    const domNode = this.rootNode;

    try {
      await this.stopRenderWorldLoop();
    } catch (err) {
    }
    if (domNode) {
      const parent = domNode.parentNode;
      const domNodeIndex = Array.from(parent.children).findIndex(n => n === domNode);
      const fixedSubmorphs = this.worldMorph.submorphs.filter(s => s.hasFixedPosition);
      for (let m of [this.worldMorph, ...fixedSubmorphs]) {
        this.renderMap.get(m).remove();
      }
    }
    this.domNode = null;
    this.emptyRenderQueues();
    this.renderMap = new WeakMap();
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

  /**
   * The heart of the rendering process.
   * The general logic is as follows: We traverse through all morphs in the world and fill different queues depending on some criteria.
   * Fixed morphs are handled separately at the beginning of the method.
   * Afterwards, we take care of CSS Layouts, morphs for which we need to adjust properties and morphs for which we need to adjust structure, e.g., a submorph was added.
   */
  renderStep () {
    this.emptyRenderQueues();
    this.worldMorph.applyLayoutIfNeeded(); // cascades through all submorphs and applies the javascript layouts

    const morphsToHandle = this.worldMorph.withAllSubmorphsDo(m => m);

    this.renderFixedMorphs();

    for (let morph of morphsToHandle) {
      if (morph.isLabel) morph.fitIfNeeded();
    }

    for (let morph of morphsToHandle) {
      if (morph._requestMasterStyling && morph.master) {
        morph.master.applyIfNeeded(true);
        morph._requestMasterStyling = false;
      }
    }

    // handling these first allows us to assume correct wrapping, when we have submorphs already!
    for (let morph of morphsToHandle) {
      if (morph.renderingState.hasCSSLayoutChange) this.renderLayoutChange(morph);
    }

    for (let morph of morphsToHandle) {
      if (morph.renderingState.hasStructuralChanges) this.morphsWithStructuralChanges.push(morph);
      if (morph.renderingState.needsRerender) this.renderedMorphsWithChanges.push(morph);
      if (morph.renderingState.animationAdded) this.renderedMorphsWithAnimations.push(morph);
    }

    for (let morph of this.morphsWithStructuralChanges) {
      morph.withAllSubmorphsDo(m => !this.renderMap.has(m) && this.renderMorph(m));
    }

    for (let morph of this.renderedMorphsWithChanges) {
      this.renderStylingChanges(morph);
    }

    for (let morph of this.morphsWithStructuralChanges) {
      this.renderStructuralChanges(morph);
    }

    for (let morph of this.renderedMorphsWithAnimations) {
      this.handleAddedAnimationChange(morph);
    }
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  //  HIGHER LEVEL RENDERING FUNCTIONS
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  handleAddedAnimationChange (morph) {
    const node = this.getNodeForMorph(morph);

    if (morph.isPath) {
      const svgNode = node.firstChild;
      morph._animationQueue.startSvgAnimationsFor(svgNode, 'svg');
      morph._animationQueue.startSvgAnimationsFor(svgNode, 'path');
    }

    morph._animationQueue.startAnimationsFor(node);
    morph.renderingState.animationAdded = false;
  }

  renderFixedMorphs () {
    const fixedSubmorphs = this.worldMorph.submorphs.filter(s => s.hasFixedPosition);
    const beforeElem = Array.from(this.bodyNode.children).find(n => n.id === this.worldMorph.id);
    keyed('id',
      this.bodyNode,
      this.worldMorph.renderingState.renderedFixedMorphs,
      fixedSubmorphs,
      item => this.renderAsFixed(item),
      noOpUpdate,
      beforeElem, // before elem
      null
    );
    fixedSubmorphs.forEach(s => {
      this.updateNodeScrollFromMorph(s);
    });
    this.worldMorph.renderingState.renderedFixedMorphs = fixedSubmorphs;
  }

  renderAsFixed (morph) {
    morph.withAllSubmorphsDo(sm => {
      // FIXME: There was a problem with renderedLines of fixedMorphs, for which the root cause could not be identified.
      // This fixes that, by rerendering all lines of renderedLines. This is only problematic in the case a large Text would be a fixed Morph.
      if (sm.renderingState.renderedLines) sm.renderingState.renderedLines = [];
    });
    const node = this.renderMorph(morph);
    if (!morph.isHTMLMorph) { node.style.position = 'fixed'; }
    // in case this world is embedded, we need to add the offset of the world morph here
    if (this.worldMorph.isEmbedded) {
      const bbx = this.bodyNode.getBoundingClientRect();
      const { origin, worldMorph, position } = morph;
      const x = Math.round(position.x - origin.x - (morph._skipWrapping && worldMorph ? worldMorph.borderWidthLeft : 0));
      const y = Math.round(position.y - origin.y - (morph._skipWrapping && worldMorph ? worldMorph.borderWidthTop : 0));
      const { x: left, y: top } = canBePromotedToCompositionLayer(morph) ? pt(0, 0) : pt(x, y);
      node.style.top = top + bbx.y + 'px';
      node.style.left = left + bbx.x + 'px';
    }
    return node;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-
  // BASIC RENDERING FUNCTIONS
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-

  /**
   * Returns a new DOM node for a morph.
   * @param {Morph} morph - The morph for which a DOM node should be generated.
   * @param {Boolean} force - If set to true will force a rerender of the morph, ignoring possibly cached nodes.
   */
  renderMorph (morph, force) {
    let node;
    node = this.renderMap.get(morph);
    if (force || !node) {
      node = morph.getNodeForRenderer(this); // returns a DOM node as specified by the morph
      this.renderMap.set(morph, node);
    }

    applyAttributesToNode(morph, node);
    applyStylingToNode(morph, node);

    if (morph.submorphs.length === 0) return node;

    const skipWrapping = morph.layout && morph.layout.renderViaCSS;

    if (!skipWrapping) {
      this.installWrapperNodeFor(morph, node);
    }

    morph.renderingState.hasStructuralChanges = true;
    return node;
  }

  /**
   * In case the positioning of submorphs is not handled by a CSS layout, the nodes of submorphs are put into a wrapper node in which they
   * are positioned absolutely.
   * This methood hangs such a wrapper node into the node of a morph, taking care of the correct positioning inside of the morph node.
   * @param {Morph} morph - The morph for which a submorph holding node is to be created.
   * @param {Node} node - The DOM node of `morph`.
   * @param {Boolean} fixChildNodes - Whether or not the nodes that are already children of `node` should be moved into the wrapper node.
   */
  installWrapperNodeFor (morph, node, fixChildNodes = false) {
    const wrapperNode = this.submorphWrapperNodeFor(morph);
    if (morph.isPolygon) this.renderPolygonClipMode(morph, wrapperNode);

    const wrapped = node.querySelector(`#submorphs-${morph.id}`);
    if (!wrapped) {
      if (morph.isText && morph.document) {
        let scrollWrapper = node.querySelector('.scrollWrapper');
        if (!scrollWrapper) {
          morph.renderingState.needsScrollLayerAdded = true;
          this.handleScrollLayer(node, morph);
          scrollWrapper = node.querySelector('.scrollWrapper');
        }
        scrollWrapper.appendChild(wrapperNode);
      } else if (!morph.isPath) node.appendChild(wrapperNode); // normal morphs
      else node.insertBefore(wrapperNode, node.lastChild); // path
      if (fixChildNodes) {
        const childNodes = Array.from(node.childNodes);
        if (morph.isPath) { childNodes.shift(); childNodes.pop(); } else if (morph.isImage || morph.isCanvas || morph.isHTMLMorph) childNodes.shift();
        childNodes.forEach((n) => {
          if (n !== wrapperNode) wrapperNode.appendChild(n);
        });
      }
      return wrapperNode;
    }
  }

  /**
   * Moves the node of submorphs from the submorph wrapper node (@see installWrapperNodeFor) into the node of its owner morph.
   * Also removes the wrapper node from the DOM.
   * Can be used idempotent, aka when the nodes are already children of the owner morph's node, nothing will happen.
   * This is used for example when a CSS layout gets applied to a morph containing submorphs.
   * @param {Node} node - Node of the morph for which submorphs should get unwrapped.
   * @param {Morph} morph - Morph of which the submorphs should be unwrapped.
   */
  unwrapSubmorphNodesIfNecessary (node, morph) {
    // do nothing if submorph nodes are not wrapped
    // e.g. in case we have had a css layout already, this can be skipped
    let children = Array.from(node.children);
    const wrapped = children.some(c => c.getAttribute('id') && c.getAttribute('id').includes('submorphs'));
    if (wrapped) {
      if (!morph.isPath) {
        node.append(...node.lastChild.childNodes);
        children = Array.from(node.children);
        children.forEach((n) => {
          if (n.getAttribute('id') && n.getAttribute('id').includes('submorphs')) n.remove();
        });
      } else {
        const wrapperNode = node.firstChild.nextSibling;
        let children = Array.from(wrapperNode.children);
        children.forEach((n) => node.insertBefore(n, node.lastChild));
        wrapperNode.remove();
      }
    }
  }

  /**
   * Gets called whenever a (CSS) layout gets applied/removed from a Morph. A morph can have exactly one layout.
   * Depending on whether a layout gets applied/removed, we take care of the DOM nodes (move them into/outside of) the wrapper node.
   * After changing the layout of a morph, all its submorphs need to be rerendered, since their position might have changed.
   * @param {Morph} morph - Morph of which the layout property was changed.
   */
  renderLayoutChange (morph) {
    const node = this.getNodeForMorph(morph);

    // Second case is for early returning unneeded wrapping, since we only want to install wrappers when they are needed.
    if (!node || morph.submorphs.length === 0) return;

    let layoutAdded = morph.layout && morph.layout.renderViaCSS;

    if (layoutAdded) {
      this.unwrapSubmorphNodesIfNecessary(node, morph);
    } else {
      this.installWrapperNodeFor(morph, node, true); // no css layout applied at the moment
    }
    morph.renderingState.hasCSSLayoutChange = false;
    morph.submorphs.forEach(s => s.renderingState.needsRerender = true);
  }

  /**
   * Updates the DOM structure starting from the node for `morph`. Does not take styling into account. Will add/remove nodes to the dom as necessary.
   * Thus, this function is triggered for morphs that either have submorphs added or removed or that have a layout applied.
   * Going through this routine for morphs that have a layout added/removed is necessary, since we need to wrap/unwrap submorphs in a separate DOM node.
   * @param { Morph } morph - The morph which has had changed to its submorph hierarchy.
   */
  renderStructuralChanges (morph) {
    let node = this.getNodeForMorph(morph);
    if (!node) node = this.renderMorph(morph);

    let submorphsToRender = morph.submorphs; // the order of these is important to make sure that morphs overlap each other correctly

    const remountedSubmorphs = morph.submorphs.filter(m => m.renderingState.hasStructuralChanges).concat(morph);
    if (morph.isWorld) {
      submorphsToRender = morph.submorphs.filter(sm => !sm.hasFixedPosition); // fixed morph are handed separately in `renderStep()`
    }
    if (morph.isText) {
      submorphsToRender = submorphsToRender.filter(subm => !morph.embeddedMorphMap.has(subm));
    }
    // Optimization for when a morph has no longer any submorphs
    if (submorphsToRender.length === 0) {
      if (morph.isPath) {
        // two SVG nodes are necessary
        // remove everything else, in the case that we have unwrapped submorph nodes
        node.childNodes.forEach(n => {
          if (n.tagName !== 'svg') n.remove();
        });
      } else if (morph.isText && morph.document) {
        const scrollWrapper = node.querySelector('.scrollWrapper');
        // we need to keep markers, selections, syntax errors etc. around
        scrollWrapper.childNodes.forEach(n => {
          if (!n.className) n.remove();
          if (n.classList.contains('morph')) n.remove();
        });
      } else {
        node.replaceChildren();
      }
      morph.renderingState.renderedMorphs = [];
      morph.renderingState.hasStructuralChanges = false;
      return;
    }

    // Due to the early return, we know that we have submorphs here.
    let alreadyRenderedSubmorphs = morph.renderingState.renderedMorphs;

    let newlyRenderedSubmorphs = withoutAll(submorphsToRender, alreadyRenderedSubmorphs);
    if (morph.isWorld) {
      alreadyRenderedSubmorphs = withoutAll(alreadyRenderedSubmorphs, morph.renderingState.renderedFixedMorphs);
      newlyRenderedSubmorphs = withoutAll(newlyRenderedSubmorphs, morph.renderingState.renderedFixedMorphs);
    }

    let skipWrapping = morph.layout && morph.layout.renderViaCSS;
    if (morph.isPath) {
      if (skipWrapping) {
        const [firstSvg, secondSvg] = Array.from(node.children).filter(n => n.tagName === 'svg');
        keyed('id',
          node,
          alreadyRenderedSubmorphs,
          submorphsToRender,
          item => this.renderMorph(item),
          noOpUpdate,
          firstSvg,
          secondSvg
        );
      } else {
        this.installWrapperNodeFor(morph, node);
        keyed('id',
          node.firstChild.nextSibling,
          alreadyRenderedSubmorphs,
          submorphsToRender,
          item => this.renderMorph(item)
        );
      }
    } else if (morph.isText) {
      if (!skipWrapping) {
        this.installWrapperNodeFor(morph, node);
        keyed('id',
          node.querySelector(`#submorphs-${morph.id}`),
          alreadyRenderedSubmorphs,
          submorphsToRender,
          item => this.renderMorph(item)
        );
      }
    } else { // morph is not path and not text
      if (skipWrapping) {
        keyed('id',
          node,
          alreadyRenderedSubmorphs,
          submorphsToRender,
          item => this.renderMorph(item),
          noOpUpdate,
          this.isComposite(morph) ? node.firstChild : null
        );
      } else {
        this.installWrapperNodeFor(morph, node);
        keyed('id',
          node.lastChild,
          alreadyRenderedSubmorphs,
          submorphsToRender,
          item => this.renderMorph(item)
        );
      }
    }

    // When a node get removed/added to the DOM its scollTop/scrollLeft values are reset.
    // We fix those up here.
    // FIXME: this does not seem to work with morphs that are moved to the front
    for (let morph of newlyRenderedSubmorphs) {
      this.updateNodeScrollFromMorph(morph);
    }

    for (let morph of remountedSubmorphs) {
      morph.withAllSubmorphsDo(m => {
        this.updateNodeScrollFromMorph(m);
      });
    }

    morph.renderingState.renderedMorphs = morph.submorphs.filter(sm => !(sm.hasFixedPosition && morph.isWorld) && !(morph.isText && morph.embeddedMorphMap.has(sm)));
    morph.renderingState.hasStructuralChanges = false;
  }

  /**
   * Some morph types result into more than one node inside of the outer most `div` node.
   * These return true here in order to take the nodes that will come before nodes of submorphs into account when reconciling the rendered
   * nodes to render submorphs that have been added/removed.
   * @param {Morph} morph - The morph for which to check if it results in multiple nodes.
   */
  isComposite (morph) {
    return morph.isCanvas || morph.isHTMLMorph || morph.isImage || morph.isCheckbox;
  }

  /**
   * Assumes that a DOM node for the given morph already exists and changes the attributes of this node according to the current style definition of the morph.
   * `patchSpecialProps` can be implemented on a given morph to render changes that are not reflected by the (default) set CSS attributes or to manipulate childnodes.
   * @param { Morph } morph - The morph for which to update the DOM node.
   */
  renderStylingChanges (morph) {
    if (morph._requestMasterStyling) {
      morph.master && morph.master.applyIfNeeded(true);
      morph._requestMasterStyling = false;
    }

    morph.renderingState.needsRemeasure = true;
    const node = this.getNodeForMorph(morph);

    if (morph.patchSpecialProps) {
      morph.patchSpecialProps(node, this); // super expensive for text
    }

    const turnedVisible = node.style.display === 'none' && morph.visible;
    applyStylingToNode(morph, node);
    if (turnedVisible) this.updateNodeScrollFromMorph(morph);

    if (morph.isText && (morph.document || morph.needsDocument)) node.style.overflow = 'hidden';
    morph.renderingState.needsRerender = false;
  }

  // -=-=-=-=-=-=-=-=-
  // HELPER FUNCTIONS
  // -=-=-=-=-=-=-=-=-

  /**
   * Creates a wrapper node for the DOM nodes of submorphs of a node.
   * This wrapper is necessary for the absolute positioning of submorph nodes when their positioning is not governed by a CSS layout.
   * @see installWrapperNode().
   * @param {type} morph - description
   * @returns {Node} The wrapper node for `morph`.
   */
  submorphWrapperNodeFor (morph) {
    let { borderWidthLeft, borderWidthTop, origin: { x: oX, y: oY } } = morph;

    const node = this.doc.createElement('div');
    node.setAttribute('id', 'submorphs-' + morph.id);
    node.style.setProperty('position', 'absolute');
    node.style.setProperty('left', `${oX - (morph.isPath ? 0 : borderWidthLeft)}px`);
    node.style.setProperty('top', `${oY - (morph.isPath ? 0 : borderWidthTop)}px`);
    if (morph.isPolygon) {
      node.style.setProperty('height', '100%');
      node.style.setProperty('width', '100%');
    }

    return node;
  }

  /**
   * Cleans up the rendering queue at the end of each render cycle.
   */
  emptyRenderQueues () {
    this.morphsWithStructuralChanges = [];
    this.renderedMorphsWithChanges = [];
    this.renderedMorphsWithAnimations = [];
  }

  /**
   * @param {Morph} morph
   * @returns {Node} The node via which `morph` is rendered into the DOM.
   */
  getNodeForMorph (morph) {
    return this.renderMap.get(morph);
  }

  /**
   * Removing a Node from the DOM and hanging it back in will lead to the node losing its scroll position.
   * Thus, when we e.g. update the position of a morph's node in the DOM, we afterwards need to update the
   * scroll position of the actual node with what we have stored in the morphic data model.
   * @param {Morph} morph - The morph for which to update the scroll of its node.
   */
  updateNodeScrollFromMorph (morph) {
    if (morph.clipMode !== 'auto' && morph.clipMode !== 'scroll') return;
    const node = this.getNodeForMorph(morph);
    if (!node) {
      return;
    }
    const { x, y } = morph.scroll;
    if (morph.isText && morph.document) { // FIXME: maybe check if we are insisting for the document?
      // update the scroll layer for text morphs
      const scrollLayer = node.querySelector('.scrollLayer');
      if (!scrollLayer) return;
      scrollLayer.scrollTop = y;
      scrollLayer.scrollLeft = x;
      return;
    }
    node.scrollTop = y;
    node.scrollLeft = x;
  }

  // -=-=-=-=-=-
  // NODE TYPES
  // -=-=-=-=-=-

  /**
   * @see nodeForMorph utilizes a double dispatch in order to generate the DOM node(s) for a morph.
   * In the default case (this method) this results in a `DIV` node. Other morphs may consist of multiple nodes
   * or a different node type. Those are handled in the methods below.
   * @param {Morph} morph - a morph to be rendered.
   * @returns {Node} A `DIV` node.
   */
  nodeForMorph (morph) {
    return this.doc.createElement('div');
  }

  nodeForCanvas (morph) {
    const node = this.doc.createElement('div');
    const canvasNode = this.doc.createElement('canvas');

    canvasNode.style.width = `${this.width}px`;
    canvasNode.style.height = `${this.height}px`;
    canvasNode.style.pointerEvents = 'none';
    canvasNode.style.position = 'absolute';

    node.appendChild(canvasNode);

    const hasNewCanvas = morph._canvas !== canvasNode && canvasNode.tagName === 'CANVAS';
    morph.afterRender(canvasNode, hasNewCanvas);

    return node;
  }

  nodeForHTMLMorph (morph) {
    const node = this.doc.createElement('div');
    node.appendChild(morph.domNode);

    return node;
  }

  nodeForImage (morph) {
    const node = this.doc.createElement('div');
    const imageNode = this.doc.createElement('img');

    imageNode.draggable = false;
    imageNode.style['pointer-events'] = 'none';
    imageNode.style.position = 'absolute';
    imageNode.style.left = 0;
    imageNode.style.width = '100%';
    imageNode.style.height = '100%';

    node.appendChild(imageNode);
    return node;
  }

  nodeForCheckbox (morph) {
    const node = this.doc.createElement('div');
    const boxNode = this.doc.createElement('input');
    node.appendChild(boxNode);

    boxNode.setAttribute('type', 'checkbox');

    boxNode.setAttribute('draggable', 'false'),

    boxNode.style['pointer-events'] = 'none';
    boxNode.style.width = '15px',
    boxNode.style.height = '15px',
    boxNode.style.position = 'absolute';

    return node;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-
  // SVGs, Path and Polygons
  // -=-=-=-=-=-=-=-=-=-=-=-
  nodeForPath (morph) {
    const node = this.doc.createElement('div');
    applyAttributesToNode(morph, node);

    const innerSvg = this.createSvgForPolygon();
    const pathElem = this.doc.createElementNS(svgNs, 'path');
    pathElem.setAttribute('id', 'svg' + morph.id);
    const defNode = this.doc.createElementNS(svgNs, 'defs');
    innerSvg.appendChild(pathElem);
    innerSvg.appendChild(defNode);

    const outerSvg = this.createSvgForPolygon();

    node.appendChild(innerSvg);
    node.appendChild(outerSvg);
    return node;
  }

  createSvgForPolygon () {
    const elem = this.doc.createElementNS(svgNs, 'svg');
    elem.style.position = 'absolute';
    elem.style.overflow = 'visible';
    return elem;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-
  // TEXT MORPH NODE CREATIONS
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-

  /**
   * The text morph adheres to logic that is quite a bit more complicated than the other morphs.
   * This is a) because it consists of many different nodes and b) the updating logic of it is complex,
   * since lines need to be rendered efficiently even when interactively edited and since we wing selections, cursors, etc. ourselves,
   * we need to keep book where each line/character starts and ends.
   * @param {Text} morph - The Text to create a node for.
   * @returns {Node} The DOM node for `morph`, with text layer etc.
   */
  nodeForText (morph) {
    let scrollLayerNode;
    const node = this.doc.createElement('div');

    const textLayer = this.textLayerNodeFor(morph);

    /*
      The scrollLayer is mecessary for Text that can be interactively edited.
      For performance reasons, we do not render all lines in this case, but only the ones that are visible.
      This means, that when scrolling in such a morph, the lines (divs) are exchanged/updated.
      For some reason, changing the subnodes of a DOM node that is simultaneously scrolled will lead to unsmooth scrolling.
      With this trick, the scrollLayer is the node that actually gets scrolled, while we can exchange all line nodes as we like.
      Since for non-interactive text all lines are rendered once, this trick is not needed there.
    */
    if (morph.document) {
      scrollLayerNode = this.renderScrollLayer(morph);
      node.appendChild(scrollLayerNode);
      const textLayerForFontMeasure = this.textLayerNodeFor(morph);
      textLayerForFontMeasure.id = morph.id + 'font-measure';
      textLayerForFontMeasure.classList.remove('actual');
      textLayerForFontMeasure.classList.add('font-measure');
      node.appendChild(textLayerForFontMeasure);

      const scrollWrapper = this.scrollWrapperFor(morph);
      node.appendChild(scrollWrapper);
      scrollWrapper.appendChild(textLayer);
    } else node.appendChild(textLayer);

    this.renderTextAndAttributes(node, morph);

    if (morph.document) {
      const textLayerNode = node.querySelector(`#${morph.id}textLayer`);
      this.updateExtentsOfLines(textLayerNode, morph);
    }

    return node;
  }

  /**
   * When the Text is set up to be interactive we decouple scrolling of the text
   * via a separate scroll layer that captures the scroll events from the user.
   * @param {Text} morph - The Text to be rendered.
   * @returns {Node} DOM Node of scrollLayer.
   */
  renderScrollLayer (morph) {
    if (!morph.document) return;
    const horizontalScrollBarVisible = morph.document.width > morph.width;
    const scrollBarOffset = horizontalScrollBarVisible ? morph.scrollbarOffset : pt(0, 0);
    const verticalPaddingOffset = morph.padding.top() + morph.padding.bottom();

    const node = this.doc.createElement('div');
    node.classList.add('scrollLayer');
    node.style.position = 'absolute';
    node.style.top = '0px';
    node.style.width = '100%';
    node.style.height = '100%';
    node.style['overflow-anchor'] = 'none';

    const subnode = this.doc.createElement('div');
    subnode.style.width = Math.max(morph.document.width, morph.width) + 'px';
    subnode.style.height = Math.max(morph.document.height, morph.height) - scrollBarOffset.y + verticalPaddingOffset + 'px';

    node.appendChild(subnode);
    return node;
  }

  /**
   * @param {Text} morph
   * @returns {Node} DOM Node of the scrolLWrappers, i.e. the node in which scrollable content (lines,...) are wrapped.
   */
  scrollWrapperFor (morph) {
    const scrollWrapper = this.doc.createElement('div');
    scrollWrapper.classList.add('scrollWrapper');
    scrollWrapper.style['pointer-events'] = 'none',
    scrollWrapper.style.position = 'absolute',
    scrollWrapper.style.width = '100%',
    scrollWrapper.style.height = '100%',
    scrollWrapper.style.transform = `translate(${-morph.scroll.x}px, ${-morph.scroll.y}px)`;
    return scrollWrapper;
  }

  /**
   * Changing a Text's mode from Label-Mode to interactive warrants the addition of a scrollLayer.
   * @see renderScrollLayer.
   * The other way around will warrant the removal of this layer.
   * This method gets called when either an addition or removal is needed and takes care of the necessary DOM operations.
   * @param {Node} node - Node of a Text.
   * @param {Text} morph - The Text which has changes that warrant the addition/removal of a ScrollLayer.
   */
  handleScrollLayer (node, morph) {
    if (!node) return;

    if (morph.renderingState.needsScrollLayerAdded) {
      if (node.querySelector('.scrollWrapper')) {
        delete morph.renderingState.needsScrollLayerAdded;
        return;
      }
      const scrollLayer = this.renderScrollLayer(morph);
      const scrollWrapper = this.scrollWrapperFor(morph);
      node.childNodes.forEach(c => scrollWrapper.appendChild(c));
      node.appendChild(scrollLayer);
      node.appendChild(scrollWrapper);
      scrollLayer.scrollTop = morph.scroll.y;
      scrollLayer.scrollLeft = morph.scroll.x;
      delete morph.renderingState.needsScrollLayerAdded;
    } else if (morph.renderingState.needsScrollLayerRemoved) {
      this.removeTextSpecialsFromDOMFor(node, morph);
      if (!node.querySelector('.scrollWrapper')) {
        delete morph.renderingState.needsScrollLayerRemoved;
        return;
      }

      node.querySelector('.scrollLayer').remove();
      const wrapper = node.querySelector('.scrollWrapper');
      Array.from(wrapper.children).forEach(c => node.append(c));
      wrapper.remove();
      delete morph.renderingState.needsScrollLayerRemoved;
    }
  }

  /**
   * When a Text is downgraded from being backed with a Document to not having one, it looses support for lively selections and markers.
   * As it is not interactively editable, it also does not need a cursor any longer.
   * This method cleans up render artifacts that might still exist in the DOM from when these were still supported.
   * @param {Node} node
   * @param {Text} morph
   */
  removeTextSpecialsFromDOMFor (node, morph) {
    const cursorNode = node.querySelector('.newtext-cursor');
    cursorNode.remove();

    const selectionNodes = node.querySelectorAll('.selection');
    selectionNodes.forEach(n => n?.remove());

    const markerNodes = node.querySelectorAll('.newtext-marker-layer');
    markerNodes.forEach(n => n?.remove());
  }

  /**
   * The texlayer is a node that wraps text content (line node,...) of a Text.
   * It sets styling properties that are applicable for the whole text (like a specific font set on the morph property).
   * Those might be overriden by styes that are later rendered inline on line nodes.
   * @param {Text} morph - Text for which the text layer node is to be created.
   * @returns {Node} A DOM node for the text layer of `morph`.
   */
  textLayerNodeFor (morph) {
    const {
      lineWrapping,
      fixedWidth,
      fixedHeight,
      selectionMode
    } = morph;

    let textLayerClasses = 'newtext-text-layer actual';
    if (!fixedWidth) textLayerClasses = textLayerClasses + ' auto-width';
    if (!fixedHeight) textLayerClasses = textLayerClasses + ' auto-height';

    textLayerClasses = textLayerClasses + ' ' + (fixedWidth ? lineWrappingToClass(lineWrapping) : lineWrappingToClass(false));

    if (selectionMode === 'native') textLayerClasses = textLayerClasses + ' selectable';

    const node = this.doc.createElement('div');
    node.id = morph.id + 'textLayer';
    const style = morph.styleObject();
    stylepropsToNode(style, node);
    morph.renderingState.nodeStyleProps = style;
    node.className = textLayerClasses;

    return node;
  }

  /**
   * Wrapper function to create textLayerNodes inside of the fontMetric.
   * This is necessary to calculate e.g. default line/letter extents before actually rendering Text.
   * This way, we can e.g. estimate which lines need to be renderer inside of a scrolled Text.
   * @param {Morph} morph - The Morph for which to render the fontMetric.
   */
  textLayerNodeFunctionFor (morph) {
    return () => this.textLayerNodeFor(morph);
  }

  /**
   * Renders chunks (1 pair of text and textAttributes) into lines (divs),
   * Thus returns an array of divs that can each contain multiple spans
   * @param {Line|Object} lineObject - The line to be rendered. Can either be a `Line` object or a simple Object adhering to `textAndAttributes` semantics.
   * @param {Text} morph - The Text in which the line is to be displayed.
   * @param {Boolean} isRealRender - Indicates whether this is an actual render to display the resulting node in the DOM or if it is a render inside of an invisible node to measure the text to be renderer.
   * @returns {Node} The DOM node for the line (`DIV`).
   */
  nodeForLine (lineObject, morph, isRealRender = false) {
    if (!lineObject) lineObject = '';
    let line = lineObject.isLine ? lineObject.textAndAttributes : lineObject;

    const renderedChunks = [];

    let content, attributes, fontSize, nativeCursor, textStyleClasses, link, tagname, chunkNodeStyle, paddingRight, paddingLeft, paddingTop, paddingBottom, lineHeight, textAlign, wordSpacing, letterSpacing, quote, textStroke, fontFamily, fontWeight, textDecoration, fontStyle, fontColor, backgroundColor, verticalAlign, chunkNodeAttributes, opacity;

    if (line.length > 0) {
      for (let i = 0; i < line.length; i = i + 2) {
        content = line[i] || '\u00a0';
        attributes = line[i + 1];

        if (typeof content !== 'string') {
          renderedChunks.push(
            content.isMorph
              ? this.renderMorphInLine(content, attributes)
              : objectReplacementChar);
          continue;
        }

        if (!attributes) {
          const node = this.doc.createElement('span');
          node.textContent = content;
          renderedChunks.push(node);
          continue;
        }

        chunkNodeStyle = {};
        chunkNodeAttributes = {};

        fontSize = attributes.fontSize && (obj.isString(attributes.fontSize) ? attributes.fontSize : attributes.fontSize + 'px');
        fontFamily = attributes.fontFamily;
        fontWeight = attributes.fontWeight;
        fontStyle = attributes.fontStyle;
        textDecoration = attributes.textDecoration;
        fontColor = attributes.fontColor;
        backgroundColor = attributes.backgroundColor;
        nativeCursor = attributes.nativeCursor;
        textStyleClasses = attributes.textStyleClasses;
        link = attributes.link;
        lineHeight = attributes.lineHeight || lineHeight;
        textAlign = attributes.textAlign || textAlign;
        wordSpacing = attributes.wordSpacing || wordSpacing;
        letterSpacing = attributes.letterSpacing || letterSpacing;
        paddingRight = attributes.paddingRight;
        paddingLeft = attributes.paddingLeft;
        paddingTop = attributes.paddingTop;
        paddingBottom = attributes.paddingBottom;
        verticalAlign = attributes.verticalAlign;
        textStroke = attributes.textStroke;
        quote = attributes.quote || quote;
        opacity = attributes.opacity;

        tagname = 'span';

        if (link) {
          tagname = 'a';
          chunkNodeAttributes.href = link;
          if (link && link.startsWith('http')) chunkNodeAttributes.target = '_blank';
        }

        if (link || nativeCursor) chunkNodeStyle.pointerEvents = 'auto';

        if (obj.isNumber(opacity)) chunkNodeStyle.opacity = opacity;
        if (fontSize) chunkNodeStyle.fontSize = fontSize;
        if (fontFamily) chunkNodeStyle.fontFamily = fontFamily;
        if (fontWeight) chunkNodeStyle.fontWeight = fontWeight;
        if (fontStyle) chunkNodeStyle.fontStyle = fontStyle;
        if (textDecoration) chunkNodeStyle.textDecoration = textDecoration;
        if (fontColor) chunkNodeStyle.color = String(fontColor);
        if (backgroundColor) chunkNodeStyle.backgroundColor = String(backgroundColor);
        if (nativeCursor) chunkNodeStyle.cursor = nativeCursor;
        if (paddingRight) chunkNodeStyle.paddingRight = paddingRight;
        if (paddingLeft) chunkNodeStyle.paddingLeft = paddingLeft;
        if (paddingTop) chunkNodeStyle.paddingTop = paddingTop;
        if (paddingBottom) chunkNodeStyle.paddingBottom = paddingBottom;
        if (verticalAlign) chunkNodeStyle.verticalAlign = verticalAlign;
        if (textStroke) chunkNodeStyle['-webkit-text-stroke'] = textStroke;
        if (attributes.doit) { chunkNodeStyle.pointerEvents = 'auto'; chunkNodeStyle.cursor = 'pointer'; }

        const chunkNode = this.doc.createElement(tagname);
        chunkNode.textContent = content || '&nbsp';
        if (chunkNodeAttributes.href) chunkNode.href = chunkNodeAttributes.href;
        if (chunkNodeAttributes.target) chunkNode.target = chunkNodeAttributes.target;
        if (textStyleClasses && textStyleClasses.length) { chunkNode.className = textStyleClasses.join(' '); }
        stylepropsToNode(chunkNodeStyle, chunkNode);
        renderedChunks.push(chunkNode);
      }
    } else renderedChunks.push(this.doc.createElement('br'));

    const lineStyle = {};

    if (lineHeight) lineStyle.lineHeight = lineHeight;
    if (textAlign) lineStyle.textAlign = textAlign;
    if (letterSpacing) lineStyle.letterSpacing = letterSpacing + 'px';
    if (wordSpacing) lineStyle.wordSpacing = wordSpacing + 'px';
    let node = this.doc.createElement('div');
    node.className = 'line';
    if (lineObject.isLine) {
      node.dataset.row = lineObject.row;
    }
    node.id = morph.id + 'lineNode' + node.dataset.row;
    stylepropsToNode(lineStyle, node);
    node.append(...renderedChunks);

    if (quote) {
      if (typeof quote !== 'number') quote = 1;
      for (let i = quote; i--;) {
        const quoteNode = this.doc.createElement('blockquote');
        quoteNode.append(node);
        node = quoteNode;
      }
    }

    if (lineObject.isLine && isRealRender) lineObject.lineNeedsRerender = false;
    return node;
  }

  /**
   * @see textLayerNodeFunctionFor above.
   */
  lineNodeFunctionFor (morph) {
    return (line) => this.nodeForLine(line, morph);
  }

  /**
   * Renders a morph embedded inline in a Text. Only takes care of morphs that should be treated as a single text character in the text flow.
   * Thus, this in case a more complex hierarchy is embedded into a Text, only the outer-most morph (for which this.parent === text) gets rendered with this method.
   * Afterwards, @see renderStructuralChanges takes over.
   * @param {Morph} morph - The morph to be rendered.
   * @param {Object} attr - An Object with which some properties of `morph` can be overwritten.
   * @returns {Node} The node of the morph to be added as a child of a node for a line.
   */
  renderMorphInLine (morph, attr) {
    attr = attr || {};
    const rendered = this.renderMorph(morph);
    rendered.style.position = 'sticky';
    rendered.style.transform = '';
    rendered.style.textAlign = 'initial';
    rendered.style.removeProperty('top');
    rendered.style.removeProperty('left');

    // fixme:  this addition screws up the bounds computation of the embedded submorph
    if (attr.paddingTop) rendered.style.marginTop = attr.paddingTop;
    if (attr.paddingLeft) rendered.style.marginLeft = attr.paddingLeft;
    if (attr.paddingRight) rendered.style.marginRight = attr.paddingRight;
    if (attr.paddingBottom) rendered.style.marginBottom = attr.paddingBottom;
    morph.renderingState.needsRerender = false;
    return rendered;
  }

  /**
   * Creates nodes for all lines present in a Text morph which is not backed by a document.
   * @param {Morph} morph - The morph for which to render its whole text.
   * @returns {Node[]} An array of Nodes
   */
  renderWholeText (morph) {
    const renderedLines = [];
    const textAndAttributesByLine = splitTextAndAttributesIntoLines(morph.textAndAttributes);
    for (let line of textAndAttributesByLine) {
      renderedLines.push(this.nodeForLine(line, morph, true));
    }
    return renderedLines;
  }

  /**
   * Creates the nodes responsible for markers in text.
   * Markers for example take care of highlighting undeclared variables and syntax highlighting.
   * @param {Text} morph - The Text owning the markers.
   * @returns {Node[]} An array of all marker nodes.
   */
  renderMarkerLayer (morph) {
    const {
      markers,
      renderingState: { firstVisibleRow, lastVisibleRow }
    } = morph;
    const parts = [];

    if (!markers) return parts;

    for (const m of markers) {
      const { style, range: { start, end } } = m;

      if (end.row < firstVisibleRow || start.row > lastVisibleRow) continue;

      // single line
      if (start.row === end.row) {
        parts.push(this.renderMarkerPart(morph, start, end, style));
        continue;
      }

      // multiple lines
      // first line
      parts.push(this.renderMarkerPart(morph, start, morph.lineRange(start.row).end, style));
      // lines in the middle
      for (let row = start.row + 1; row <= end.row - 1; row++) {
        const { start: lineStart, end: lineEnd } = morph.lineRange(row);
        parts.push(this.renderMarkerPart(morph, lineStart, lineEnd, style, true));
      }
      // last line
      parts.push(this.renderMarkerPart(morph, { row: end.row, column: 0 }, end, style));
    }

    return parts;
  }

  /**
   * Creates a node representing a slice of a single/multiline marker.
   * @param {Text} morph - The text morph owning the markers.
   * @param {TextPosition} start - The position in the text where the marker starts.
   * @param {TextPosition} end - The position in the text where the marker ends.
   * @param {CSSStyle} style - Custom styles for the marker to override the defaults.
   * @param {Boolean} entireLine - Flag to indicate wether or not the marker part covers the entire line.
   * @return {Node} A DOM node representing the respective part of the marker.
   */
  renderMarkerPart (morph, start, end, style, entireLine = false) {
    let startX = 0; let endX = 0; let y = 0; let height = 0;
    const { document: doc, textLayout } = morph;
    const line = doc.getLine(start.row);
    if (entireLine) {
      const { padding } = morph;
      startX = padding.left();
      y = padding.top() + doc.computeVerticalOffsetOf(start.row);
      endX = startX + line.width;
      height = line.height;
    } else {
      ({ x: startX, y } = textLayout.boundsFor(morph, start));
      ({ x: endX, height } = textLayout.boundsFor(morph, end));
    }
    height = Math.ceil(height);
    const node = this.doc.createElement('div');
    node.classList.add('newtext-marker-layer');
    node.style.left = startX + 'px';
    node.style.top = y + 'px';
    node.style.height = height + 'px';
    node.style.width = endX - startX + 'px';
    for (const prop in style) {
      node.style[prop] = style[prop];
    }

    return node;
  }

  /**
   * When a Text is set up to support lively selections, we render our custom
   * selection layer instead of the HTML one which we cannot control.
   * @param {Text} morph - The Text to be rendered.
   * @returns {Node[]} An array of SVG Nodes that represent the selection to be displayed, including a cursor.
   */
  renderSelectionLayer (morph) {
    if (!morph.document || !morph.selection) return [];
    const cursorWidth = morph.cursorWidth || 1;
    const sel = morph.selection;
    if (morph.inMultiSelectMode()) {
      const selectionLayer = [];
      const sels = sel.selections; let i = 0;
      for (; i < sels.length - 1; i++) { selectionLayer.push(...this.renderSelectionPart(morph, sels[i], true/* diminished */, 2)); }
      selectionLayer.push(...this.renderSelectionPart(morph, sels[i], false/* diminished */, 4));
      return selectionLayer;
    } else {
      return this.renderSelectionPart(morph, sel, false, cursorWidth);
    }
  }

  /**
   * Since we can not control the selection of HTML DOM-Nodes we wing it ourselves.
   * Here we render a custom DOM representation of the current selection within a Text.
   * @param {Text} morph - The Text to display selections.
   * @param {Selection} selection - The selection to be rendered.
   * @param {Boolean} diminished - Wether or not to render the cursor diminished.
   * @param {Integer} cursorWidth - The width of the cursor.
   * @returns {Node[]} An array of SVG Nodes that represent one selection to be displayed, including a cursor.}
   */
  renderSelectionPart (morph, selection, diminished = false, cursorWidth = 2) {
    if (!selection) return [];

    const { textLayout } = morph;

    const { start, end, cursorVisible, selectionColor } = selection;
    const { document, cursorColor } = morph;
    const isReverse = selection.isReverse();

    const startBounds = textLayout.boundsFor(morph, start);
    const endBounds = textLayout.boundsFor(morph, end);

    const leadLineHeight = startBounds.height;
    const endLineHeight = endBounds.height;

    const endPos = pt(endBounds.x, endBounds.y);

    const cursorPos = isReverse ? pt(startBounds.x, startBounds.y) : endPos;
    const cursorHeight = isReverse ? leadLineHeight : endLineHeight;
    const renderedCursor = this.cursor(cursorPos, cursorHeight, cursorVisible, diminished, cursorWidth, cursorColor);

    if (obj.equals(selection.start, selection.end)) return [renderedCursor];

    // render selection layer
    const slices = [];
    let row = selection.start.row;
    let yOffset = document.computeVerticalOffsetOf(row) + morph.padding.top();
    const paddingLeft = morph.padding.left();
    const bufferOffset = 50;

    let charBounds,
      selectionTopLeft,
      selectionBottomRight,
      isFirstLine,
      cb, line, isWrapped;

    // extract the slices the selection is comprised of
    while (row <= selection.end.row) {
      line = document.getLine(row);
      if (row < morph.renderingState.firstVisibleRow - bufferOffset) { // selected lines before the visible ones
        yOffset += line.height;
        row++;
        continue;
      }

      if (row > morph.renderingState.lastVisibleRow + bufferOffset) break; // selected lines after the visible ones

      // selected lines (rows) that are visible
      charBounds = textLayout.charBoundsOfRow(morph, row).map(Rectangle.fromLiteral);
      isFirstLine = row === selection.start.row;
      isWrapped = charBounds[0].bottom() < arr.last(charBounds).top();

      if (isWrapped) {
        // since wrapped lines spread multiple "rendered" rows, we need to do add in a couple of
        // additional selection parts here
        const rangesToRender = textLayout.rangesOfWrappedLine(morph, row).map(r => r.intersect(selection));
        let isFirstSubLine = isFirstLine;
        let subLineMinY = 0;
        let subCharBounds;
        let subLineMaxBottom;
        for (const r of rangesToRender) {
          if (r.isEmpty()) continue;

          subCharBounds = charBounds.slice(r.start.column, r.end.column);

          subLineMinY = isFirstSubLine ? arr.min(subCharBounds.map(cb => cb.top())) : subLineMinY;
          subLineMaxBottom = arr.max(subCharBounds.map(cb => cb.bottom()));

          cb = subCharBounds[0];
          selectionTopLeft = pt(paddingLeft + cb.left(), yOffset + subLineMinY);

          cb = arr.last(subCharBounds);
          selectionBottomRight = pt(paddingLeft + cb.right(), yOffset + subLineMaxBottom);

          subLineMinY = subLineMaxBottom;
          isFirstSubLine = false;

          slices.push(Rectangle.fromAny(selectionTopLeft, selectionBottomRight));
        }
      } else {
        const isLastLine = row === selection.end.row;
        const startIdx = isFirstLine ? selection.start.column : 0;
        const endIdx = isLastLine ? selection.end.column : charBounds.length - 1;
        const lineMinY = isFirstLine && arr.min(charBounds.slice(startIdx, endIdx + 1).map(cb => cb.top())) || 0;
        const emptyBuffer = startIdx >= endIdx ? 5 : 0;

        cb = charBounds[startIdx];
        selectionTopLeft = pt(paddingLeft + (cb ? cb.left() : arr.last(charBounds).right()), yOffset + lineMinY);

        cb = charBounds[endIdx];
        if (selection.includingLineEnd) { selectionBottomRight = pt(morph.width - morph.padding.right(), yOffset + lineMinY + line.height); } else {
          const excludeCharWidth = isLastLine && selection.end.column <= charBounds.length - 1;
          selectionBottomRight = pt(paddingLeft + (cb ? (excludeCharWidth ? cb.left() : cb.right()) : arr.last(charBounds).right()) + emptyBuffer, yOffset + lineMinY + line.height);
        }

        slices.push(Rectangle.fromAny(selectionTopLeft, selectionBottomRight));
      }

      yOffset += line.height;
      row++;
    }

    const renderedSelection = this.selectionLayerRounded(slices, selectionColor, morph);
    renderedSelection.push(renderedCursor);
    return renderedSelection;
  }

  /**
   * Renders a Text's text cursor.
   * @param {Point} pos - The position of the Cursor.
   * @param {Number} height - Height of the cursor to be rendered in pixels.
   * @param {Boolean} visible - Wether or not to display the cursor.
   * @param {Boolean} diminished - Wether or not to render the cursor diminished.
   * @param {Number} width - The width of the cursor in pixels.
   * @param {Color} color - The color of the cursor.
   */
  cursor (pos, height, visible, diminished, width, color) {
    const node = this.doc.createElement('div');
    node.classList.add('newtext-cursor');
    if (diminished) node.classList.add('diminished');
    node.style.left = pos.x - Math.ceil(width / 2) + 'px';
    node.style.top = pos.y + 'px';
    node.style.width = width + 'px';
    node.style.height = height + 'px';
    node.style.display = visible ? '' : 'none';
    node.style.background = color || 'black';
    return node;
  }

  /**
   * Renders the slices as specified in renderSelectionLayer to SVG, utilizing a rounded corner
   * selection style that is stolen from Visual Studio Code.
   * @param {Rectangle[]} slice - The slices to render.
   * @param {Color} selectionColor - The color of the rendered selection.
   * @param {Text} morph - The Text to be rendered.
   * @returns {SVGNode} Rendered slices as `SVG`.
   */
  selectionLayerRounded (slices, selectionColor, morph) {
    // split up the rectangle corners into a left and right batches
    let currentBatch;
    const batches = [
      currentBatch = {
        left: [], right: []
      }
    ];

    let lastSlice;
    for (const slice of slices) {
      // if rectangles do not overlap, create a new split batch
      if (lastSlice && (lastSlice.left() > slice.right() || lastSlice.right() < slice.left())) {
        batches.push(currentBatch = { left: [], right: [] });
      }
      currentBatch.left.push(slice.topLeft(), slice.bottomLeft());
      currentBatch.right.push(slice.topRight(), slice.bottomRight());
      lastSlice = slice;
    }
    // turn each of the batches into its own svg path
    const svgs = [];
    for (const batch of batches) {
      if (!batch.left.length) continue;
      const pos = batch.left.reduce((p1, p2) => p1.minPt(p2)); // topLeft of the path
      const vs = batch.left.concat(batch.right.reverse());

      // move a sliding window over each vertex
      let updatedVs = [];
      for (let vi = 0; vi < vs.length; vi++) {
        const prevV = vs[vi - 1] || arr.last(vs);
        const currentV = vs[vi];
        const nextV = vs[vi + 1] || arr.first(vs);

        // replace the vertex by two adjacent ones offset by distance
        const offset = 6;
        const offsetV1 = prevV.subPt(currentV).normalized().scaleBy(offset);
        const p1 = currentV.addPt(offsetV1);
        p1._next = offsetV1.scaleBy(-1);
        const offsetV2 = nextV.subPt(currentV).normalized().scaleBy(offset);
        const p2 = currentV.addPt(offsetV2);
        p2._prev = offsetV2.scaleBy(-1);

        updatedVs.push(p1, p2);
      }

      updatedVs = updatedVs.map(p => ({
        position: p.subPt(pos), isSmooth: true, controlPoints: { next: p._next || pt(0), previous: p._prev || pt(0) }
      })
      );

      const d = getSvgVertices(updatedVs);
      const { y: minY, x: minX } = updatedVs.map(p => p.position).reduce((p1, p2) => p1.minPt(p2));
      const { y: maxY, x: maxX } = updatedVs.map(p => p.position).reduce((p1, p2) => p1.maxPt(p2));
      const height = maxY - minY;
      const width = maxX - minX;
      const pathNode = this.doc.createElementNS(svgNs, 'path');
      pathNode.setAttribute('fill', selectionColor.toString());
      pathNode.setAttribute('d', d);

      const svgNode = this.doc.createElementNS(svgNs, 'svg');
      svgNode.classList.add('selection');
      svgNode.setAttribute('style', `position: absolute; left: ${pos.x}px;top: ${pos.y}px; width: ${width}px; height: ${height}px`);

      svgNode.appendChild(pathNode);
      svgs.push(svgNode);
    }

    return svgs;
  }

  /**
   * Renders the debug layer of a Text, which visualizes the bounds computed by the text layout.
   * @param {Text} morph - The text morph to visualize the text layout for.
   * @return {Node[]} An array of DOM nodes that comprise the debug layer.
   */
  renderDebugLayer (morph) {
    const vs = morph.renderingState;
    const debugHighlights = [];
    let { heightBefore: rowY, firstVisibleRow, lastVisibleRow, visibleLines } = vs;
    const { padding, scroll: { x: visibleLeft, y: visibleTop } } = morph;
    const leftP = padding.left();
    const rightP = padding.right();
    const topP = 0;
    const debugInfo = this.doc.createElement('div');
    debugInfo.classList.add('debug-info');
    debugInfo.style.left = (visibleLeft + leftP) + 'px';
    debugInfo.style.top = visibleTop + 'px';
    debugInfo.style.width = (morph.width - rightP) + 'px';

    const visibleRowsSpan = this.doc.createElement('span');
    visibleRowsSpan.innerHTML = `visible rows: ${firstVisibleRow} - ${lastVisibleRow}`;
    debugInfo.appendChild(visibleRowsSpan);
    debugHighlights.push(debugInfo);

    for (let i = 0, row = firstVisibleRow; row < lastVisibleRow; i++, row++) {
      const line = visibleLines[i];
      const charBounds = morph.textLayout.lineCharBoundsCache.get(line);
      const { height } = line;

      const debugLine = this.doc.createElement('div');
      debugLine.classList.add('debug-line');
      debugLine.style.left = (visibleLeft + leftP) + 'px';
      debugLine.style.top = (topP + rowY) + 'px';
      debugLine.style.width = (morph.width - rightP) + 'px';
      debugLine.style.height = height + 'px';

      const lineSpan = this.doc.createElement('span');
      lineSpan.innerHTML = String(row);

      debugLine.appendChild(lineSpan);
      debugHighlights.push(debugLine);

      if (!charBounds) {
        rowY = rowY + height;
        continue;
      }

      for (let col = 0; col < charBounds.length; col++) {
        const { x, y, width, height } = charBounds[col];
        const debugChar = this.doc.createElement('div');
        debugChar.classList.add('debug-char');

        debugChar.style.left = (leftP + x) + 'px';
        debugChar.style.top = (topP + rowY + y) + 'px';
        debugChar.style.width = width + 'px';
        debugChar.style.height = height + 'px';

        debugHighlights.push(debugChar);
      }

      rowY = rowY + height;
    }

    return debugHighlights;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // SPECIAL METHODS FOR UPDATING ALREADY EXISTING NODES IN THE RENDER CYCLE
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  // -=-=-=-=-=-
  // TEXT MORPH
  // -=-=-=-=-=-

  /**
   * Finds out how many and which lines can be dislpayed in `morph`, adapts the values in `morphs`'s renderingState accordingly,
   * and updates the fillerDiv that is used to push the lines inside of the visible are of `morph`'s node.
   * The last part is necessary since the scrolling layer and the content part of the `morph` are decoupled.
   * @param {Text} morph - The morph for which we want to find out which lines are visible.
   * @param {Node} node - `morph`'s node inside of the DOM.
   * @returns {Line[]} An arry containing the `Line` objects of all visible lines.
   */
  collectVisibleLinesForRendering (morph, node) {
    const {
      height,
      scroll,
      document: doc,
      clipMode,
      padding: { y: padTop }
    } = morph;
    const scrollTop = scroll.y;
    const scrollHeight = height;
    const lastLineNo = doc.rowCount - 1;
    const textHeight = doc.height;
    const clipsContent = clipMode !== 'visible';

    const {
      line: startLine,
      offset: startOffset,
      y: heightBefore,
      row: startRow
    } = doc.findLineByVerticalOffset(clipsContent ? Math.max(0, clipsContent ? scrollTop - padTop : 0) : 0) ||
     { row: 0, y: 0, offset: 0, line: doc.getLine(0) };

    const {
      line: endLine,
      offset: endLineOffset,
      row: endRow
    } = doc.findLineByVerticalOffset(clipsContent ? Math.min(textHeight, (scrollTop - padTop) + scrollHeight) : textHeight) ||
     { row: lastLineNo, offset: 0, y: 0, line: doc.getLine(lastLineNo) };

    const firstVisibleRow = clipsContent ? startRow : 0;
    const firstFullyVisibleRow = startOffset === 0 ? startRow : startRow + 1;
    const lastVisibleRow = clipsContent ? endRow + 1 : lastLineNo;
    const lastFullyVisibleRow = !endLine || endLineOffset === endLine.height ? endRow : endRow - 1;

    morph.maxVisibleLines = Math.max(morph.maxVisibleLines || 1, lastVisibleRow - firstVisibleRow + 1);

    morph.renderingState.maxVisibleLines = morph.maxVisibleLines;
    morph.renderingState.startLine = firstVisibleRow;

    const visibleLines = [];

    let line = startLine; let i = 0;
    while (i < morph.maxVisibleLines) {
      visibleLines.push(line);
      i++;
      line = line.nextLine();
      if (!line) break;
    }

    this.updateFillerDIV(morph, node, heightBefore);

    Object.assign(morph.renderingState, {
      scrollTop,
      scrollHeight,
      scrollBottom: scrollTop + scrollHeight,
      heightBefore,
      textHeight,
      firstVisibleRow,
      lastVisibleRow,
      firstFullyVisibleRow,
      lastFullyVisibleRow,
      visibleLines
    });

    return visibleLines;
  }

  /**
   * Takes care of creating and/or updating the necessary nodes to display a Texts text.
   * Reconciles LineNodes when e.g. a new Line is inserted between already existing ones and takes care of updating existing lines that have been changed.
   * @param {Node} node - The DOM Node of `morph`
   * @param {Text} morph - The Text for which the text should be (re)rendered.
   */
  renderTextAndAttributes (node, morph) {
    const textNode = node.querySelector(`#${morph.id}textLayer`);
    if (!textNode) return;
    if (!morph.document) textNode.replaceChildren(...this.renderWholeText(morph));
    else {
      if (morph.debug) textNode.querySelectorAll('.debug-line, .debug-char, .debug-info').forEach(n => n.remove());
      const linesToRender = this.collectVisibleLinesForRendering(morph, node);
      morph.renderingState.visibleLines = linesToRender;
      // To make sure that we operate on the lines that are actually currently renderer, we pod the nodes out of the DOM
      // This allows for reusing old nodes
      let renderedLinesFromDOM = [];
      textNode.childNodes.forEach(node => {
        if (!node.classList.contains('line')) return;
        const ds = node.dataset;
        const row = Number(ds ? ds.row : node.getAttribute('data-row'));
        const line = morph.document.lines[row];
        renderedLinesFromDOM.push(line);
      });
      // In case we have deleted the last line of a Document the above optimization will fail.
      // In this case we rerender all lines.
      let patchLines = true;
      if (renderedLinesFromDOM.some(e => e === undefined)) {
        renderedLinesFromDOM = [];
        // The selector needs to be this comples as we a) need to keep the filler around (see below) and b) need to make sure only to remove lines that are belonging directly to us.
        // Otherwise, we might delete lines from `Text` that are embedded into our document as well.
        const lineNodes = textNode.querySelectorAll(`#${morph.id}textLayer > .line`);
        lineNodes.forEach(n => n.remove());
        patchLines = false; // calling keyed once is enough, since all nodes are recreated from scratch
      }
      morph.renderingState.renderedLines = renderedLinesFromDOM;
      keyed('row',
        textNode,
        morph.renderingState.renderedLines,
        linesToRender,
        item => this.nodeForLine(item, morph, true),
        noOpUpdate,
        textNode.firstChild,
        null
      );
      morph.renderingState.renderedLines = morph.renderingState.visibleLines;
      if (patchLines) {
        let i = 0; // the first child is always the filler, we can skip it
        let previousLineChanged = false;
        for (const line of morph.renderingState.renderedLines) {
          i++;
          if (!line.lineNeedsRerender && !previousLineChanged) continue;
          // It might be that we introduced a new line (by line breaking).
          // The document is smart and changes the minimal amount of lines.
          // We still need to update all following lines as the node contents need to be different now.
          if (line.lineNeedsRerender) {
            previousLineChanged = true;
          }
          const oldLineNode = textNode.children[i];
          if (!oldLineNode) continue;
          const newLineNode = this.nodeForLine(line, morph, true);
          textNode.replaceChild(newLineNode, oldLineNode);
        }
      }
    }
    if (morph.document) {
      this.updateExtentsOfLines(textNode, morph);
    }

    let inlineMorphUpdated = false;
    morph.textAndAttributes.forEach(ta => {
      if (ta && ta.isMorph && ta.renderingState.needsRerender) {
        ta.renderingState.needsRerender = false;
        inlineMorphUpdated = true;
      }
    });
    if (inlineMorphUpdated) morph.invalidateTextLayout(true, false);
    morph.renderingState.renderedTextAndAttributes = morph.textAndAttributes;
    morph.renderingState.extent = morph.extent;
  }

  /**
   * Removes and rerenders the current selections in a Text to update them.
   * @param {Node} node - The DOM node in which `morph` is rendered.
   * @param {Text} morph - The Text which selections were changed.
   */
  patchSelectionLayer (node, morph) {
    if (!node) return;
    node.querySelectorAll('div.newtext-cursor').forEach(c => c.remove());
    node.querySelectorAll('svg.selection').forEach(s => s.remove());
    const nodeToAppendTo = !morph.document ? node : node.querySelectorAll('.scrollWrapper')[0];
    if (nodeToAppendTo) nodeToAppendTo.append(...this.renderSelectionLayer(morph));

    morph.renderingState.selectionRanges = morph.selection._selections.map(s => s.range);
  }

  /**
   *
   * @param {*} node
   * @param {*} morph
   */
  patchSelectionMode (node, morph) {
    if (morph.selectionMode === 'native') {
      node.querySelector('.newtext-text-layer').classList.add('selectable');
    }
    if (morph.selectionMode === 'lively' || morph.selectionMode === 'none') {
      node.querySelector('.newtext-text-layer').classList.remove('selectable');
    }

    morph.renderingState.selectionMode = morph.selectionMode;
  }

  /**
   * Removes and rerenders the current markers in a Text to update them.
   * @param {Node} node - The DOM node in which `morph` is rendered.
   * @param {Text} morph - The Text which markers were changed.
   */
  patchMarkerLayer (node, morph) {
    if (!node) return;
    node.querySelectorAll('div.newtext-marker-layer').forEach(s => s.remove());
    const nodeToAppendTo = !morph.document ? node : node.querySelectorAll('.scrollWrapper')[0];
    nodeToAppendTo.append(...this.renderMarkerLayer(morph));
    morph.renderingState.markers = morph.markers;
  }

  /**
   * Updates the line height and/or letter spacing properties of a text morph.
   * Takes care of also adjusting (rerendering) already visible parts.
   * @param {Node} node - The node in which the text morph is rendered.
   * @param {Text} morph
   */
  patchLineHeightAndLetterSpacing (node, morph) {
    node.querySelectorAll('.newtext-text-layer').forEach(node => {
      if (morph.letterSpacing) node.style.letterSpacing = morph.letterSpacing;
      else delete node.style.letteSpacing;
      node.style.lineHeight = morph.lineHeight;
    });
    if (morph.document) {
      morph.document.lines.forEach(l => l.needsRerender = true);
      this.renderTextAndAttributes(node, morph);
    }
    morph.renderingState.lineHeight = morph.lineHeight;
    morph.renderingState.letterSpacing = morph.letterSpacing;
  }

  /**
   * @see collectVisibleLinesForRendering
   * @param {Node} node - DOM node of a text morph
   * @param {Number} heightBefore - Height before the visible lines start in pixels.
   */
  updateFillerDIV (morph, node, heightBefore) {
    const textLayer = node.querySelector(`#${morph.id}textLayer`);
    const filler = textLayer.querySelector('.newtext-before-filler');
    if (filler) {
      filler.style.height = heightBefore + 'px';
    } else {
      const spacer = this.doc.createElement('div');
      spacer.classList.add('newtext-before-filler');
      spacer.style.height = heightBefore + 'px';
      textLayer.insertBefore(spacer, textLayer.firstChild);
    }
  }

  /**
   * @param {Node} node - DOM node in which a text morph is rendered.
   * @param {Text} morph
   */
  // FIXME: Somehow, the size of the child is unbound, as the document continuously grows when scrolling
  adjustScrollLayerChildSize (node, morph) {
    const scrollLayer = node.querySelectorAll('.scrollLayer')[0];
    if (!scrollLayer) return;
    const horizontalScrollBarVisible = morph.document.width > morph.width;
    const scrollBarOffset = horizontalScrollBarVisible ? morph.scrollbarOffset : pt(0, 0);
    const verticalPaddingOffset = morph.padding.top() + morph.padding.bottom();
    const horizontalPaddingOffset = morph.padding.left() + morph.padding.right();
    scrollLayer.firstChild.style.width = morph.document.width + horizontalPaddingOffset + 'px';
    scrollLayer.firstChild.style.height = morph.document.height - scrollBarOffset.y + verticalPaddingOffset + 'px';
  }

  /**
   * Used to mirror the scroll state from the morphic model back into the DOM.
   * @see updateNodeScrollFromMorph.
   * @param {Node} node - Node of a Text.
   * @param {Text} morph
   */
  scrollScrollLayerFor (node, morph) {
    const scrollLayer = node.querySelectorAll('.scrollLayer')[0];
    const scrollWrapper = node.querySelectorAll('.scrollWrapper')[0];

    if (scrollLayer && scrollWrapper) {
      // FIXME: Introduced to fix "scroll skipping", i.e., a reset of the scroll-position when for example navigating
      // with the code entities listed in the browser columns.
      // There might be an opportunity to shove off a few cycles of redundant work here,
      // as changing the `scrollTop` value of the scrollLayer seems to update the displayed text as well?
      // However, why that updates the text as well is not entirely understood and thus it is unclear how robust it would be to abuse this.
      scrollLayer.scrollTop = morph.scroll.y;
      scrollLayer.scrollLeft = morph.scroll.x;

      scrollWrapper.style.transform = `translate(${-morph.scroll.x}px, ${-morph.scroll.y}px)`;
      morph.renderingState.scroll = morph.scroll;
      this.renderTextAndAttributes(node, morph);
    }
  }

  /**
   * Updates the style of a text layer based on the style object of a text morph.
   * The style object contains e.g. padding, fontWeigth, ...
   * @see { SmartText >> styleObject() }
   * @param {Node} node - DOM node in which a Text is rendered.
   * @param {Text} morph - Text of which the textLayer is to be updated.
   * @param {Object} newStyle - Style Object which is to be applied to the text layer node.
   */
  patchTextLayerStyleObject (node, morph, newStyle) {
    const textLayer = node.querySelector(`#${morph.id}textLayer`);
    const fontMeasureTextLayer = node.querySelector(`#${morph.id}font-measure`);
    stylepropsToNode(newStyle, textLayer);
    if (fontMeasureTextLayer) stylepropsToNode(newStyle, fontMeasureTextLayer);
    morph.renderingState.nodeStyleProps = newStyle;
    morph.invalidateTextLayout(true, false);
  }

  /**
   * Takes care of adjusting the relevant CSS classes after the lineWrapping property of a Text was updated.
   * @param {Node} node - The node which is used to render `morph`
   * @param {Text} morph - The Text for which lineWrapping was updated
   */
  patchLineWrapping (node, morph) {
    const oldWrappingClass = lineWrappingToClass(morph.renderingState.lineWrapping);
    const newWrappingClass = morph.fixedWidth ? lineWrappingToClass(morph.lineWrapping) : lineWrappingToClass(false);

    const textLayer = node.querySelector(`#${morph.id}textLayer`);
    const fontMeasureTextLayer = node.querySelector(`#${morph.id}font-measure`);

    textLayer.classList.remove(oldWrappingClass);
    if (fontMeasureTextLayer) fontMeasureTextLayer.classList.remove(oldWrappingClass);

    textLayer.classList.add(newWrappingClass);
    if (fontMeasureTextLayer) fontMeasureTextLayer.classList.add(newWrappingClass);

    morph.renderingState.lineWrapping = morph.lineWrapping;
    morph.renderingState.fixedWidth = morph.fixedWidth;
  }

  /**
   * Updates the clipMode of a Text. Takes into account that we have decoupled the scroll from the node.
   * @see renderScrollLayer.
   * @param {Node} node - DOM node in which a Text is rendered.
   * @param {Text} morph - Text of which the clipMode is to be updated.
   * @param {scrollActive} fromMorph - If this is true, we set the correct clipMode according to the Morph. Otherwise, we set hidden.
   */
  patchClipModeForText (node, morph, scrollActive) {
    const scrollLayer = node.querySelectorAll('.scrollLayer')[0];
    if (!scrollLayer) return;

    if (scrollActive) {
      scrollLayer.style.overflow = morph.clipMode;
      this.scrollScrollLayerFor(node, morph);
    } else scrollLayer.style.overflow = 'hidden';

    morph.renderingState.scrollActive = morph.scrollActive;
  }

  /**
   * Exchanges all nodes for the debug layer in the DOM. Actually deletes and recreates the nodes.
   * @param {Node} node - The node of the text morph for which the debug layer is to be displayed.
   * @param {Text} morph - The morph for which the debug layer is to be displayed.
   */
  updateDebugLayer (node, morph) {
    const textNode = node.querySelector(`#${morph.id}textLayer`);
    textNode.querySelectorAll('.debug-line, .debug-char, .debug-info').forEach(n => n.remove());
    if (morph.debug) textNode.append(...this.renderDebugLayer(morph));
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // TEXTRENDERING - MEASURING AFTER RENDER
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  /**
   * Measures the bounds of `morph` in the DOM. Only used for `Text` that is not backed by Document.
   * Without a `Document`, the `Text` also does not have a `Layout`, which means we have to measure ourself.
   * @param {Text} morph - A `Text` which is not backed by a Document.
   * @returns {Rectangle} The actual bounds of `morph` when rendered into the DOM.
   */
  measureStaticTextBoundsFor (morph) {
    if (!morph.renderingState.needsRemeasure && morph._cachedBounds) return morph._cachedBounds;

    let node = this.getNodeForMorph(morph);
    if (!node) node = this.renderMorph(morph);
    else this.renderStylingChanges(morph);

    const textNode = node.querySelector(`#${morph.id}textLayer`);
    const prevParent = textNode.parentNode;
    textNode.remove();
    this.placeholder.className = 'Text';
    textNode.style.width = 'max-content';
    textNode.style.height = 'max-content';
    textNode.style.position = 'static';
    if (morph.fixedWidth) textNode.style.width = morph.width + 'px';
    if (morph.fixedHeight) textNode.style.height = morph.height + 'px';
    this.placeholder.appendChild(textNode);
    const domMeasure = this.placeholder.getBoundingClientRect();
    textNode.style.removeProperty('width');
    textNode.style.removeProperty('position');
    const bounds = new Rectangle(domMeasure.x, domMeasure.y, domMeasure.width, domMeasure.height);
    prevParent.appendChild(textNode);

    morph._cachedBounds = bounds;
    morph.renderingState.needsRemeasure = false;
    return bounds;
  }

  /**
   * Iterates over the visible lines of a Text, measures their bounds in the DOM and updates the data model in their Document.
   * @see updateLineHeightOfNode.
   * @param {Node} textlayerNode - The textLayerNode of a Text.
   * @param {Text} morph - The Text to which `textlayerNode` belongs.
   */
  updateExtentsOfLines (textlayerNode, morph) {
    // figure out what lines are displayed in the text layer node and map those
    // back to document lines.  Those are then updated via lineNode.getBoundingClientRect
    const { fontMetric } = morph;

    const lineNodes = textlayerNode.children;
    let i = 0;
    let firstLineNode;

    while (i < lineNodes.length && lineNodes[i].className !== 'line') i++;

    if (i < lineNodes.length) {
      firstLineNode = lineNodes[i];
    } else {
      return;
    }

    const ds = firstLineNode.dataset;
    const row = Number(ds ? ds.row : firstLineNode.getAttribute('data-row'));
    if (typeof row !== 'number' || isNaN(row)) return;

    let actualTextHeight = 0;
    let line = morph.document.getLine(row);

    let foundEstimatedLine;
    const gtfm = morph.getGlobalTransform().inverse();
    gtfm.e = gtfm.f = 0;
    for (; i < lineNodes.length; i++) {
      const node = lineNodes[i];
      if (line) {
        if (!foundEstimatedLine) { foundEstimatedLine = line.hasEstimatedExtent; }
        line.hasEstimatedExtent = foundEstimatedLine;
        actualTextHeight = actualTextHeight + this.updateLineHeightOfNode(morph, line, node, gtfm);
        // if we measured but the font as not been loaded, this is also just an estimate
        line.hasEstimatedExtent = !fontMetric.isFontSupported(morph.fontFamily, morph.fontWeight);
        line = line.nextLine();
      }
    }
  }

  /**
   * @param {Text} morph
   * @param {Line} docLine
   * @param {Node} lineNode - The Node in which `Line` is rendered.
   * @returns
   */
  updateLineHeightOfNode (morph, docLine, lineNode, tfm) {
    if (docLine.height === 0 || docLine.hasEstimatedExtent) {
      const needsTransformAdjustment = tfm.getScale() !== 1 || tfm.getRotation() !== 0;
      if (needsTransformAdjustment) lineNode.style.transform = tfm.toString();
      const { height: nodeHeight, width: nodeWidth } = lineNode.getBoundingClientRect();
      if (needsTransformAdjustment) lineNode.style.transform = '';

      if (nodeHeight && nodeWidth && (docLine.height !== nodeHeight || docLine.width !== nodeWidth) &&
         morph.fontMetric.isFontSupported(morph.fontFamily, morph.fontWeight)) {
        docLine.changeExtent(nodeWidth, nodeHeight, false);
        morph.textLayout.resetLineCharBoundsCacheOfLine(docLine);
        morph.renderingState.needsFit = true;
      }

      // positions embedded morphs
      if (docLine.textAndAttributes && docLine.textAndAttributes.length) {
        let inlineMorph;
        for (let j = 0, column = 0; j < docLine.textAndAttributes.length; j += 2) {
          inlineMorph = docLine.textAndAttributes[j];
          if (inlineMorph && inlineMorph.isMorph) {
            morph._positioningSubmorph = inlineMorph;
            inlineMorph.position = morph.textLayout.pixelPositionFor(morph, { row: docLine.row, column }).subPt(morph.origin);
            inlineMorph.renderingState.needsRerender = false;
            morph._positioningSubmorph = null;
            column++;
          } else if (inlineMorph) {
            column += inlineMorph.length;
          }
        }
      }

      return nodeHeight;
    }
    return docLine.height;
  }

  // -=-=-=-=-=-=-=-=-=-
  // TEXT MORPH HELPERS
  // -=-=-=-=-=-=-=-=-=-

  extractHTMLFromTextMorph (textMorph, textAndAttributes = textMorph.textAndAttributesInRange(textMorph.selection.range)) {
    const text = new textMorph.constructor({
      ...textMorph.defaultTextStyle,
      width: textMorph.width,
      textAndAttributes: textAndAttributes,
      needsDocument: true
    });
    const render = this.textLayerNodeFunctionFor(text);
    const renderLine = this.lineNodeFunctionFor(text);
    const textLayerNode = render();
    const style = System.global && System.global.getComputedStyle ? System.global.getComputedStyle(textLayerNode) : null;
    if (style) {
      textLayerNode.ownerDocument.body.appendChild(textLayerNode);
      textLayerNode.style.whiteSpace = style.whiteSpace;
      textLayerNode.style.overflowWrap = style.overflowWrap;
      textLayerNode.style.wordBreak = style.wordBreak;
      textLayerNode.style.minWidth = style.minWidth;
      textLayerNode.parentNode.removeChild(textLayerNode);
    }
    for (const line of text.document.lines) { textLayerNode.appendChild(renderLine(line)); }
    return textLayerNode.outerHTML;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // DYNAMICALLY RENDER POLYGON PROPS
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  /**
   * This and all following methods with regards to Paths/Polygons/SVGs always assume that the Morph has been rendered in its structure.
   * These methods thus only take the already existing node and modify it so that some morphic properties are reflected correctly.
   * @param {Path} morph
   */
  renderControlPoints (morph) {
    let controlPoints = [];
    if (morph.showControlPoints) {
      controlPoints = this.doc.createElementNS(svgNs, 'g');
      controlPoints.append(...this._renderPath_ControlPoints(morph));
    }
    const node = this.getNodeForMorph(morph);

    node.lastChild.replaceChildren();
    if (!arr.equals(controlPoints, [])) {
      node.lastChild.appendChild(controlPoints);
    }
  }

  renderPolygonBorderColor (morph) {
    const node = this.getNodeForMorph(morph);
    node.firstChild.firstChild.setAttribute('stroke', morph.borderColor.valueOf().toString());
  }

  renderPolygonClippingPath (morph) {
    const clipPath = this.doc.createElementNS(svgNs, 'clipPath');
    clipPath.setAttribute('id', 'clipPath' + morph.id);
    const clipPathInner = this.doc.createElementNS(svgNs, 'path');
    clipPath.appendChild(clipPathInner);
    return clipPath;
  }

  renderPolygonDrawAttribute (morph) {
    const node = this.getNodeForMorph(morph);
    const d = getSvgVertices(morph.vertices);
    if (morph.vertices.length) {
      node.firstChild.firstChild.setAttribute('d', d);
      const defNode = Array.from(node.firstChild.children).find(n => n.tagName === 'defs');
      let clipPath = Array.from(defNode.children).find(n => n.tagName === 'clipPath');
      if (!clipPath) {
        clipPath = this.renderPolygonClippingPath(morph);
        defNode.appendChild(clipPath);
      }
      clipPath.firstChild.setAttribute('d', d);
    }
  }

  renderPolygonFill (morph) {
    const node = this.getNodeForMorph(morph);
    let newGradient;
    let defsNode = Array.from(node.firstChild.children).find(n => n.tagName === 'defs');
    const def = Array.from(defsNode.children).find(n => n.getAttribute('id').includes('fill'));
    node.firstChild.firstChild.setAttribute('fill', morph.fill ? morph.fill.isGradient ? 'url(#gradient-fill' + morph.id + ')' : morph.fill.toString() : 'transparent');
    if (morph.fill && !morph.fill.isGradient) {
      if (def) def.remove();
      return;
    }
    newGradient = this.renderGradient('fill' + morph.id, morph.extent, morph.fill);

    if (!defsNode && newGradient) {
      defsNode = this.doc.createElementNS(svgNs, 'defs');
      defsNode.appendChild(newGradient);
      node.firstChild.appendChild(defsNode);
    } else {
      if (def) defsNode.replaceChild(newGradient, def);
      else defsNode.appendChild(newGradient);
    }
  }

  renderPolygonStrokeStyle (morph) {
    const node = this.getNodeForMorph(morph);
    const firstSvg = node.firstChild;
    firstSvg.style['stroke-linejoin'] = morph.cornerStyle || 'mint';
    firstSvg.style['stroke-linecap'] = morph.endStyle || 'round';
  }

  /**
   * This inserts/changes a defined mask for a Polygon morph in order to animate its drawn part.
   * This can result in animations that seem like the SVG is drawing itself.
   * The way the SVG rendering is implemented, **it is impossible to change the vertices of a SVG when such an animation is running**.
   * Doing so results in unknown behavior, up to crashing the render process!
   * This is currently the only known limitation, i.e. other properties can be animated/changed simultaneously.
   * @see{ @link https://css-tricks.com/svg-line-animation-works/ } for more information regarding how and why this works.
   * @param { Morph } morph - The Polygon/Path for which the mask should be updated.
   */
  renderPolygonMask (morph) {
    const node = this.getNodeForMorph(morph);
    const drawnProportion = morph.drawnProportion;
    const pathElem = node.firstChild.firstChild;
    const defNode = node.firstChild.lastChild;

    let maskNode, innerRect, firstPath, secondPath;

    for (let n of Array.from(defNode.children)) {
      if (n.tagName === 'mask') {
        maskNode = n;
        break;
      }
    }

    if (drawnProportion === 0) {
      pathElem.removeAttribute('mask');
      return;
    }

    pathElem.setAttribute('mask', 'url(#mask' + morph.id + ')');

    if (maskNode) {
      innerRect = maskNode.firstChild;
      firstPath = innerRect.nextSibling;
      secondPath = firstPath.nextSibling;
    } else {
      maskNode = this.doc.createElementNS(svgNs, 'mask');
      innerRect = this.doc.createElementNS(svgNs, 'rect');
      firstPath = this.doc.createElementNS(svgNs, 'path');
      secondPath = this.doc.createElementNS(svgNs, 'path');
    }

    maskNode.setAttribute('id', 'mask' + morph.id);

    innerRect.setAttribute('fill', 'white');
    innerRect.setAttribute('x', 0);
    innerRect.setAttribute('y', 0);
    innerRect.setAttribute('width', morph.width + 20);
    innerRect.setAttribute('height', morph.height + 20);

    [firstPath, secondPath].map(path => {
      path.setAttribute('d', getSvgVertices(morph.vertices));
      path.setAttribute('stroke-width', morph.borderWidth.valueOf() + 1);
      path.setAttribute('stroke-dasharray', path.getTotalLength());
      secondPath.setAttribute('fill', 'none');
    });

    firstPath.setAttribute('stroke', 'black');
    secondPath.setAttribute('stroke', 'white');

    firstPath.setAttribute('stroke-dashoffset', firstPath.getTotalLength() * (1 - morph.drawnProportion));
    secondPath.setAttribute('stroke-dashoffset', secondPath.getTotalLength() * (-1 + (1 - morph.drawnProportion)));

    maskNode.append(innerRect, firstPath, secondPath);
    defNode.appendChild(maskNode);
  }

  renderPolygonBorder (morph) {
    const node = this.getNodeForMorph(morph);
    const pathNode = node.firstChild.firstChild;
    const bs = morph.borderStyle.valueOf();
    if (bs === 'dashed') {
      const bw = morph.borderWidth.valueOf();
      pathNode.setAttribute('stroke-dasharray', bw * 1.61 + ' ' + bw);
    } else if (bs === 'dotted') {
      const bw = morph.borderWidth.valueOf();
      pathNode.setAttribute('stroke-dasharray', '1 ' + bw * 2);
      pathNode.setAttribute('stroke-linecap', 'round');
      pathNode.setAttribute('stroke-linejoin', 'round');
    }
    pathNode.setAttribute('stroke-width', morph.borderWidth.valueOf());
  }

  renderPolygonSVGAttributes (morph) {
    const { width, height } = morph;
    const node = this.getNodeForMorph(morph);
    [node.firstChild, node.lastChild].forEach(n => {
      n.setAttribute('width', width || 1);
      n.setAttribute('height', height || 1);
      n.setAttribute('viewBox', [0, 0, width || 1, height || 1].join(' '));
    });
  }

  renderPolygonClipMode (morph, submorphNode) {
    if (!submorphNode) {
      submorphNode = Array.from(this.getNodeForMorph(morph).children).find(n => n.id && n.id.includes('submorphs'));
    }
    if (submorphNode) {
      submorphNode.style.setProperty('overflow', `${morph.clipMode}`);
      if (morph.clipMode !== 'visible') {
        submorphNode.style.setProperty('clip-path', `url(#clipPath${morph.id})`);
      } else {
        submorphNode.style.setProperty('clip-path', '');
      }
    } // when no submorphNode is found we are skipping wrapping or do not have any submorphs
  }

  _renderPath_ControlPoints (morph) {
    const {
      vertices,
      borderWidth, showControlPoints, _controlPointDrag
    } = morph;
    let fill = 'red';
    let radius = borderWidth === 0 ? 6 : borderWidth + 2;

    // HELPER FUNCTION
    const circ = (cx, cy, n, merge, type, isCtrl) => {
      let r = merge ? 12 : Math.min(8, Math.max(3, radius));
      let cssClass = 'path-point path-point-' + n;
      const color = merge ? 'orange' : fill;
      if (typeof type === 'string') cssClass += '-' + type;
      if (isCtrl) r = Math.max(3, Math.ceil(r / 2));
      const node = this.doc.createElementNS(svgNs, 'circle');
      if (isCtrl) {
        node.style.setProperty('fill', 'white');
        node.style.setProperty('stroke-width', 2);
        node.style.setProperty('stroke', color);
        node.setAttribute('class', cssClass);
        node.setAttribute('cx', cx);
        node.setAttribute('cy', cy);
        node.setAttribute('r', r);
      } else {
        node.style.setProperty('fill', color);
        node.setAttribute('class', cssClass);
        node.setAttribute('cx', cx);
        node.setAttribute('cy', cy);
        node.setAttribute('r', r);
      }
      return node;
    };

    const rendered = [];

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
  }

  renderPathMarker (morph, mode) {
    const node = this.getNodeForMorph(morph);
    const pathElem = node.firstChild.firstChild;
    const defElem = node.firstChild.lastChild;

    const specTo_h_svg = (spec) => {
      let { tagName, id, children } = spec;
      const childNodes = children ? children.map(specTo_h_svg) : undefined;

      if (id) id = morph.id + '-' + id;

      const node = this.doc.createElementNS(svgNs, tagName);
      node.setAttribute('id', id);
      for (let prop in obj.dissoc(spec, ['id', 'tagName', 'children'])) {
        node.setAttribute(prop, spec[prop]);
      }

      if (childNodes) node.append(...childNodes);

      return node;
    };
    const marker = mode === 'start' ? morph.startMarker : morph.endMarker;

    if (marker) {
      if (!marker.id) marker.id = `${mode}-marker`;
      if (!pathElem.getAttribute(`marker-${mode}`)) pathElem.setAttribute(`marker-${mode}`, `url(#${morph.id}-${marker.id})`);
      const defs = Array.from(defElem.children);
      const newMarkerNode = specTo_h_svg(marker);
      let markerInserted = false;
      defs.forEach(d => {
        // This is still one DOM operation too many, since we could also patch the existing spec node.
        if (d.id && d.id.includes(`${mode}-marker`)) {
          defElem.replaceChild(newMarkerNode, d);
          markerInserted = true;
        }
      });
      if (!markerInserted) defElem.appendChild(newMarkerNode);
    } else {
      pathElem.removeAttribute(`marker-${mode}`);
      const defs = Array.from(defElem.children);
      defs.forEach(d => {
        if (d.id && d.id.includes(`${mode}-marker`)) d.remove();
      });
    }
  }

  renderGradient (id, extent, gradient) {
    gradient = gradient.valueOf();
    const { bounds, focus, vector, stops } = gradient;
    const { x: width, y: height } = extent;
    const props = {
      id: 'gradient-' + id,
      gradientUnits: 'userSpaceOnUse',
      r: '50%'
    };
    if (vector) {
      props.gradientTransform =
      `rotate(${num.toDegrees(vector.extent().theta())}, ${width / 2}, ${height / 2})`;
    }
    if (focus && bounds) {
      const { width: bw, height: bh } = bounds;
      const { x, y } = focus;
      props.gradientTransform = `matrix(
${bw / width}, 0, 0, ${bh / height},
${((width / 2) - (bw / width) * (width / 2)) + (x * width) - (width / 2)},
${((height / 2) - (bh / height) * (height / 2)) + (y * height) - (height / 2)})`;
    }

    const node = this.doc.createElementNS(svgNs, gradient.type);
    for (let prop in props) {
      node.setAttribute(prop, props[prop]);
    }

    const stopNodes = stops.map(stop => {
      const node = this.doc.createElementNS(svgNs, 'stop');
      node.setAttribute('offset', (stop.offset * 100) + '%');
      node.setAttribute('stop-opacity', stop.color.a);
      node.setAttribute('stop-color', stop.color.withA(1).toString());
      return node;
    });

    node.append(...stopNodes);

    return node;
  }

  /**
   * Creates a DOM node that is a "preview" of the morph, i.e. a
   * representation that looks like the morph but doesn't have morphic behavior
   * attached.
   * Include the css and fonts into the preview as well, to serve as a server side pre-
   * rendering to speed up loading times of frozen parts.
   * @param {*} morph
   * @param {*} opts
   * @returns
   */
  renderPreview (morph, opts) {
    // FIXME doesn't work with scale yet...!

    const {
      width = 100, height = 100, center = true, ignoreMorphs = [],
      asNode = false
    } = opts;
    const {
      scale, position, origin, rotation
    } = morph;
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
    else node = this.renderMorph(morph);

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
