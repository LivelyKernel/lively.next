/* global fetch */

import { Morph } from 'lively.morphic';
import vdom from 'virtual-dom';
import { pt, Color } from 'lively.graphics';
const { diff, patch, create: createElement } = vdom;
import { SVG } from './svg.js';
import { string, obj, arr, num, promise, tree, Path as PropertyPath } from 'lively.lang';

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
      editMode: {
        defaultValue: false
      },
      draggable: {
        defaultValue: true
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
      this.removeSVGSelection();
      if (this.target && this.target.selected) {
        this.removePathSelection();
      }
      this.removeAllControlPoints();
    }
  }

  removeSVGSelection () {
    const t = SVG(this.svgPath);
    if (t.findOne('rect.my-svg-selection'))t.findOne('rect.my-svg-selection').remove();
    this.editMode = false;
  }

  removePathSelection () {
    const t = SVG(this.svgPath);
    if (this.target && t.findOne('rect.my-path-selection')) {
      t.findOne('rect.my-path-selection').remove();
      this.target.selected = false;
    }
  }

  selectElement (target) {
    if (target.id.startsWith('control-point') || this._controlPointDrag) return;
    const t = SVG(this.svgPath);
    let wasSelected = false;
    if (this.target && this.target.id === target.id && this.target.selected) wasSelected = true;

    if (wasSelected) return;
    this.target = target;
    this.target.selected = true;
    const tar = SVG(target);
    let selection_node;
    this.removePathSelection();
    this.removeAllControlPoints();
    switch (tar.type) {
      case 'path':
        selection_node = SVG(target.outerHTML);
        this.getControlPoints();
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
      'stroke-width': 1,
      'pointer-events': 'none',
      'stroke-dasharray': '5, 3'
    });
    tar.after(selection_node);
    selection_node.front();
  }

  get isSVGMorph () { return true; }

  getControlPoints () {
    this.removeAllControlPoints();

    const tar = SVG(this.target);
    const targetPath = SVG(this.target).array();

    for (let i = 0; i < targetPath.length; i++) {
      let element = targetPath[i];
      if (element[0] != 'Z') {
        let defaultPoint = this.createControlPointAt(i, element[element.length - 2], element[element.length - 1], 'yellow');
        tar.after(defaultPoint);
        defaultPoint.front();
      }
      let lastElement = element;
    }
  }

  createControlPointAt (id, x, y, color) {
    const t = SVG(this.svgPath);
    let point = t.circle();

    point.attr({
      cx: x,
      cy: y,
      r: 5,
      id: 'control-point-' + id,
      fill: color
    });
    point.addClass('control-point');
    point.addClass('control-point-' + id);

    return point;
  }

  onDragStart (evt) {
    const { domEvt: { target } } = evt;
    const cssClass = new PropertyPath('attributes.class.value').get(target);
    if (cssClass && cssClass.includes('control-point')) {
      this._controlPointDrag = { marker: target };
    }
  }

  onDrag (evt) {
    if (!this._controlPointDrag) return super.onDrag(evt);
    let { marker, lastDelta } = this._controlPointDrag;
    this._controlPointDrag.lastDelta = evt.state.absDragDelta;
    lastDelta = lastDelta || { x: 0, y: 0 };
    let deltaX = evt.state.absDragDelta.x - lastDelta.x;
    let deltaY = evt.state.absDragDelta.y - lastDelta.y;
    const screenCTM = this.target.getScreenCTM();
    deltaY = screenCTM.d < 0 ? -deltaY : deltaY; // d determines the y direction
    SVG(marker).dmove(deltaX, deltaY);
    this.changeSVGToControlPoint(marker, pt(deltaX, deltaY));
  }

  onDragEnd (evt) {
    const { _controlPointDrag } = this;
    if (_controlPointDrag) {
      delete this._controlPointDrag;
    }
  }

  changeSVGToControlPoint (controlPoint, moveDelta) {
    const cssClass = new PropertyPath('attributes.class.value').get(controlPoint);
    if (cssClass && cssClass.includes('control-point')) {
      const [_, n, ctrlN] = cssClass.match(/control-point-([0-9]+)(?:-control-([0-9]+))?$/);
      if (SVG(this.target).type == 'path') {
        const selectedPath = SVG(this.target);
        let selectedPoint = selectedPath.array()[n];
        selectedPath.array()[n][selectedPoint.length - 2] += moveDelta.x;
        selectedPath.array()[n][selectedPoint.length - 1] += moveDelta.y;
        this.target.setAttribute('d', selectedPath.array().copyWithin());
        let bbox = SVG(this.svgPath).findOne('rect.my-path-selection');
        bbox.attr({
          x: selectedPath.bbox().x,
          y: selectedPath.bbox().y,
          width: selectedPath.bbox().width,
          height: selectedPath.bbox().height
        });
      }
    }
  }

  removeAllControlPoints () {
    let oldControlPoints = document.getElementsByClassName('control-point');
    while (oldControlPoints.length > 0) {
      oldControlPoints[0].remove();
    }
  }

  render (renderer) {
    if (!this.svgPath) return;
    if (this._requestMasterStyling) {
      this.master && this.master.applyIfNeeded(true);
      this._requestMasterStyling = false;
    }
    this.node = new SVGVNode(this, renderer);
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
        this.createDomNode(this.svgPathString);
      });
  }

  createDomNode (svgString) {
    const span = this.env.domEnv.document.createElement('span');
    span.innerHTML = this.svgPathString;
    const svgPath = span.getElementsByTagName('svg')[0];
    this.initializeSVGPath(svgPath);
  }

  initializeSVGPath (svgPath) {
    this.svgPath = svgPath;
    const ratio = parseFloat(svgPath.getAttribute('width')) / parseFloat(svgPath.getAttribute('height'));
    SVG(svgPath).click((evt) => { if (this.editMode) this.selectElement(evt.target); });
    this.width = this.height * ratio;
  }

  removeAllSelections () {
    this.removeSVGSelection();
    this.removePathSelection();
    this.removeAllControlPoints();
  }

  __additionally_serialize__ (snapshot, ref, pool, addFn) {
    super.__additionally_serialize__(snapshot, ref, pool, addFn);
    this.removeAllSelections();
    snapshot.props.svgPathString = { value: this.svgPath.parentElement.outerHTML };
  }

  __after_deserialize__ (snapshot, objRef, pool) {
    super.__after_deserialize__(snapshot, objRef, pool);
    this.createDomNode(this.svgPathString);
  }
}
