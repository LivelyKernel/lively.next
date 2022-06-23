/* global fetch */

import { Morph } from 'lively.morphic';
import vdom from 'virtual-dom';
import { pt, Color } from 'lively.graphics';
const { diff, patch, create: createElement } = vdom;
import SVGWorkspace from './SVGWorkspace.js';
import { SVG } from './svg.js';

class SVGVNode {
  constructor (morph, renderer) {
    this.morph = morph;
    this.renderer = renderer;
    this.morphVtree = null;
    // unique identifier for VDOM
    this.key = `custom-${morph.id}`;
  }

  get type () { return 'Widget'; }

  renderMorph () {
    this.morphVtree = this.renderer.renderMorph(this.morph);
    return this.morphVtree;
  }

  // VDOM interface
  init () {
    const domNode = createElement(this.renderMorph(), this.renderer.domEnvironment);
    domNode.appendChild(this.morph.svgPath);
    return domNode;
  }

  /**
   * Part of the vdom interface.
   * The function called when the widget is being updated.
   * @see{ @link https://github.com/Matt-Esch/virtual-dom/blob/master/docs/widget.md}
   */
  update (previous, domNode) {
    const oldTree = previous.morphVtree || this.renderMorph();
    const newTree = this.renderMorph();
    const patches = diff(oldTree, newTree);
    patch(domNode, patches);
    // if (this.morph.afterRenderHook) this.morph.afterRenderHook();
    return null;
  }

  // VDOM Interface
  destroy (domNode) {
    // no custom operation 
  }
}

export class SVGMorph extends Morph {
  static get properties () {
    return {
      extent: {
        after: ['svgPathString'],
        defaultValue: pt(800, 450),
        set (extent) {
          this.setProperty('extent', extent);
          if (this.svgPath) {
            this.svgPath.setAttribute('height', extent.y);
            this.svgPath.setAttribute('width', extent.x);
          }
        }
      },
      fill: { defaultValue: Color.transparent },
      borderColor: { defaultValue: Color.transparent },
      svgUrl: {},
      svgPathString: {
        defaultValue: '',
        after: ['svgUrl'],
        set (svgPathString) {
          this.setProperty('svgPathString', svgPathString);
          const span = this.env.domEnv.document.createElement('span');
          span.innerHTML = this.svgPathString;
          const svgPath = span.getElementsByTagName('svg')[0];
          this.initializeSVGPath(svgPath);
        }
      },
      editMode: {
        defaultValue: false
      },
      showControlPoints: {
        defaultValue: false
      }
    };
  }

  initialize () {
    this.setSVGPath();
  }

  toggleEditMode () {
    this.editMode = !this.editMode;
    const t = SVG(this.svgPath);
    if (this.editMode) {
      const bbox_node = t.rect();
      bbox_node.addClass('my-svg-selection');
      bbox_node.attr({
        'fill-opacity': 0.0,
        stroke: '#000',
        'stroke-width': 2,
        x: t.bbox().x,
        y: t.bbox().y,
        width: t.bbox().width,
        height: t.bbox().height
      });
      t.add(bbox_node);
      bbox_node.back();
    } else {
      t.findOne('rect.my-svg-selection').remove();
      if (this.target && this.target.selected) {
        t.findOne('rect.my-path-selection').remove();
        this.target.selected = false;
      }
    }
  }

  selectElement (target) {
    const t = SVG(this.svgPath);
    let wasSelected = false;
    if (this.target && this.target.id === target.id && this.target.selected) wasSelected = true;
    if (this.target) {
      if (this.target.selected) t.findOne('rect.my-path-selection').remove();
      this.target.selected = false;
    }
    if (wasSelected) return;
    this.target = target;
    this.target.selected = true;
    const tar = SVG(target);
    let selection_node;
    switch (tar.type) {
      default:
        selection_node = t.rect();
        selection_node.attr({
          x: tar.bbox().x,
          y: tar.bbox().y,
          width: tar.bbox().width,
          height: tar.bbox().height
        });
    }
    selection_node.addClass('my-path-selection');
    selection_node.attr({
      'fill-opacity': 0.0,
      stroke: '#000',
      'stroke-width': 2,
      'pointer-events': 'none'
    });
    tar.after(selection_node);
    selection_node.front();
  }

  get isSVGMorph () { return true; }

  render (renderer) {
    if (!this.svgPath) return;
    if (this._requestMasterStyling) {
      this.master && this.master.applyIfNeeded(true);
      this._requestMasterStyling = false;
    }
    this.node = new SVGVNode(this, renderer);
    console.log(this.node);
    return this.node;
  }

  setSVGPath () {
    fetch(this.svgUrl)
      .then((response) => response.text())
      .then((response) => {
        const svgStr = response;
        if (svgStr.indexOf('<svg') === -1) {
          return;
        }
        this.svgPathString = svgStr;
      });
  }

  initializeSVGPath (svgPath) {
    this.svgPath = svgPath;
    const ratio = svgPath.getAttribute('height').replace(/\D/g, '') / svgPath.getAttribute('width').replace(/\D/g, '');
    SVG(svgPath).click((evt) => { if (this.editMode) this.selectElement(evt.target); });
    this.width = this.height * ratio;
  }
}
