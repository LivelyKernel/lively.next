import { promise, num } from "lively.lang";
import { addOrChangeCSSDeclaration, addOrChangeLinkedCSS } from "./dom-helper.js";
import {
  defaultStyle,
  renderGradient,
  defaultAttributes,
  defaultCSS,
  pathAttributes,
  svgAttributes
} from "./morphic-default.js";
import { h } from "virtual-dom";


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
        addOrChangeLinkedCSS("lively-font-awesome", System.decanonicalize("lively.morphic/assets/font-awesome/css/font-awesome.css"), doc),
        addOrChangeLinkedCSS("lively-font-inconsolata", System.decanonicalize("lively.morphic/assets/inconsolata/inconsolata.css"), doc)]));
  }

  startRenderWorldLoop() {
    this.renderWorldLoopProcess = this.requestAnimationFrame(() => this.startRenderWorldLoop());
    return this.renderStep();
  }

  stopRenderWorldLoop() {
    this.domEnvironment.window.cancelAnimationFrame(this.renderWorldLoopProcess);
    this.renderWorldLoopProcess = null;
  }

  renderLater(n = 10) {
    this.renderWorldLoopLaterCounter = n;
    if (this.renderWorldLoopLater) return;
    this.renderWorldLoopLater = this.requestAnimationFrame(() => {
      this.renderStep();
      this.renderWorldLoopLater = null;
      if (this.renderWorldLoopLaterCounter > 0)
        this.renderLater(this.renderWorldLoopLaterCounter-1);
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
    return this.domNode ? this.domNode.querySelector("#" + morph.id) : null;
  }

  getMorphForNode(node) {
    return this.worldMorph ?
      this.worldMorph.withAllSubmorphsDetect(morph => morph.id === node.id) :
      null;
  }

  render(x) {
    if (!x.needsRerender()) {
      var renderedTree = this.renderMap.get(x);
      if (renderedTree) return renderedTree;
    }

    x.aboutToRender(this);

    var tree = x.render(this);
    this.renderMap.set(x, tree);
    return tree;
  }

  renderMorph(morph) {
    return h("div", {
      ...defaultAttributes(morph, this),
      style: defaultStyle(morph)
    }, this.renderSubmorphs(morph));
  }

  renderSubmorphs(morph) {
    return h("div", {
          style: {
            position: "absolute",
            transform: `translate(${morph.origin.x - morph.borderWidthLeft}px,${morph.origin.y - morph.borderWidthTop}px)`
          }
        }, morph.submorphs.map(m => this.render(m)));
  }


  renderImage(image) {
    return h("div", {
      ...defaultAttributes(image, this),
        style: defaultStyle(image)
      }, [
        h("img", {
          src: image.imageUrl,
          draggable: false,
          style: {
            "pointer-events": "none",
            position: "absolute",
            width: "100%", height: "100%"
          }
        }),
        this.renderSubmorphs(image)
      ]);
  }

  renderCanvas(canvas) {
    const CanvasHook = function(){}
    CanvasHook.prototype.hook = function(node, prop, prev) {
      canvas._canvas = node;    // remember HTML canvas node for drawing
    }
    return h("div", {
      ...defaultAttributes(canvas, this),
        style: defaultStyle(canvas),
      }, [
        h("canvas", {
          width: canvas.width,
          height: canvas.height,
          style: {
            "pointer-events": "none",
            position: "absolute",
            width: "100%", height: "100%"
          },
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
            position: "relative",
            top: "-3px",
            left: "-4px",
            width: "100%", height: "100%"
          }
        }),
        this.renderSubmorphs(checkbox)
      ]);
  }

  // FIXME: The gradient handling is inconsistent to the way its handled in "vanilla" morphs

  renderPath(path) {
    const vertices = h("path", {
      namespace: "http://www.w3.org/2000/svg",
      id: "svg" + path.id,
      ...pathAttributes(path)
    });
    return this.renderSvgMorph(path, vertices);
  }

  renderSvgMorph(morph, svg) {
    const {
            position,
            filter,
            display,
            opacity,
            transform,
            transformOrigin,
            cursor
          } = defaultStyle(morph),
          {width, height} = morph.innerBounds(),
          defs = h("defs", {namespace: "http://www.w3.org/2000/svg"}, [
            morph.fill && morph.fill.isGradient ?
              [renderGradient(morph, "fill")] : null,
            morph.borderColor && morph.borderColor.isGradient ?
              [renderGradient(morph, "borderColor")] : null
          ]);

    return h("div",
      {
        ...defaultAttributes(morph, this),
        style: {
          transform,
          transformOrigin,
          position,
          opacity,
          cursor,
          width: width + "px",
          height: height + "px",
          display,
          filter,
          "pointer-events": morph.reactsToPointer ? "auto" : "none",
        }
      },
      [
        h("svg",
          {
            namespace: "http://www.w3.org/2000/svg",
            version: "1.1",
            style: {
              position: "absolute",
              "pointer-events": "none",
              overflow: "visible"
            },
            ...svgAttributes(morph)
          },
          [defs, svg]
        ),
        this.renderSubmorphs(morph)
      ]);
  }

}
