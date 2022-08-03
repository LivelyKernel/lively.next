/* global fetch, DOMPoint */

import { Morph } from 'lively.morphic';
import vdom from 'virtual-dom';
import { pt, Color } from 'lively.graphics';
const { diff, patch, create: createElement } = vdom;
import { SVG } from './svg.js';
import { Path as PropertyPath } from 'lively.lang';
import { connect, disconnect } from 'lively.bindings';

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
      },
      showBezierPoints: {
        defaultValue: true
      }
    };
  }

  initialize () {
    connect($world, 'showHaloFor', this, 'removeAllSelections');
    this.setSVGPath();
  }

  abandon (remvoe) {
    super.abandon();
    disconnect($world, 'showHaloFor', this, 'removeAllSelections');
  }

  toggleEditMode () {
    this.editMode = !this.editMode;
    if (this.editMode) {
      this.createSVGSelectionBox();
    } else {
      this.removeAllSelections();
      if (this.target) this.target.selected = false;
      this.removeAllBezierLines();
    }
  }

  selectElement (target) {
    if (target.id.startsWith('control-point') || target.id.startsWith('bezier-point') || this._controlPointDrag) return;
    let wasSelected = false;
    if (this.target && this.target.id === target.id && this.target.selected) wasSelected = true;

    if (wasSelected) return;
    this.target = target;
    this.target.selected = true;
    this.removeAllControlPoints();
    this.removeAllBezierLines();
    this.createSelectionBoxAndPointsFor(target);
  }

  createSVGSelectionBox () {
    this.removeSVGSelection();
    let t = SVG(this.svgPath);
    const bbox_node = t.rect();
    bbox_node.addClass('my-svg-selection');
    bbox_node.attr({
      'fill-opacity': 0.0,
      stroke: 'orange',
      'stroke-width': 3,
      x: t.bbox().x,
      y: t.bbox().y,
      width: t.bbox().width,
      height: t.bbox().height,
      'stroke-dasharray': '2, 2',
      'pointer-events': 'none'
    });
    t.add(bbox_node);
    bbox_node.back();
  }

  createSelectionBoxAndPointsFor (target) {
    this.removePathSelection();
    this.createSVGSelectionBox();
    let t = SVG(this.svgPath);
    const tar = SVG(target);
    let selection_node;
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

  // ======= Control- and Bezierpoints for SVG paths ===========

  getControlPoints () {
    this.removeAllControlPoints();
    this.removeAllBezierLines();

    const tar = SVG(this.target);
    $world.svgSelect(tar);

    const targetPath = SVG(this.target).array();

    for (let i = 0; i < targetPath.length; i++) {
      let element = targetPath[i];
      if (element[0] !== 'Z') {
        const x = element[element.length - 2];
        const y = element[element.length - 1];
        let controlPoint = this.createControlPointAt(i, x, y);
        tar.after(controlPoint);
        controlPoint.front();
        if (element[0] === 'C' && this.showBezierPoints) {
          for (let j = 0; j < 2; j++) {
            const x1 = element[1 + (2 * j)];
            const y1 = element[2 + (2 * j)];

            let bezierLine;
            if (j === 0) {
              let prevElement = targetPath[i - 1]; // first in array will never be 'C'
              const prevX = prevElement[prevElement.length - 2];
              const prevY = prevElement[prevElement.length - 1];
              bezierLine = this.createBezierLine(i, j, prevX, prevY, x1, y1);
            } else {
              bezierLine = this.createBezierLine(i, j, x1, y1, x, y);
            }
            tar.after(bezierLine);
            bezierLine.front();

            let bezierPoint = this.createBezierPointAt(i, j, x1, y1);
            tar.after(bezierPoint);
            bezierPoint.front();
          }
        }
      }
    }
  }

  createBezierLine (id, number, startX, startY, endX, endY) {
    const t = SVG(this.svgPath);

    const line = t.line(startX, startY, endX, endY);
    line.id = 'bezier-line-' + id + '-' + number;
    line.stroke({ color: 'grey', width: 2, linecap: 'round' });
    line.addClass('bezier-line');
    line.addClass('bezier-line-' + id + '-' + number);
    line.attr({
      'pointer-events': 'none'
    });
    line.startPath = id;
    line.nmbBezier = number;

    return line;
  }

  createBezierPointAt (id, number, x, y) {
    const idString = 'bezier-point-' + id + '-' + number;
    let point = this.createPointAt(idString, 'control-point', x, y, 'red');
    point.addClass('bezier-point');
    return point;
  }

  createControlPointAt (id, x, y) {
    const idString = 'control-point-' + id;
    let point = this.createPointAt(idString, 'control-point', x, y, 'yellow');
    return point;
  }

  createPointAt (idString, pointClass, x, y, color) {
    const t = SVG(this.svgPath);
    let point = t.circle();

    point.attr({
      cx: x,
      cy: y,
      r: 3,
      id: idString,
      fill: color,
      cursor: 'move'
    });
    point.addClass('control-point');

    return point;
  }

  // === drag handling ===

  onDragStart (evt) {
    const { domEvt: { target } } = evt;

    if (this.editMode) {
      const cssClass = new PropertyPath('attributes.class.value').get(target);
      if (cssClass && cssClass.includes('control-point')) {
        this._controlPointDrag = { targetPoint: target };
      } else if (target.instance && target.instance.type === 'path') {
        this._pathDrag = { targetPath: target };
      } else {
        this.removeAllControlPoints();
        this.removeAllBezierLines();
        this.removePathSelection();
        if (this.target) this.target.selected = false;
      }
    }
  }

  onDrag (evt) {
    if (this._controlPointDrag || this._pathDrag) {
      const point = this.convertPointToCTMOf(this.target, evt.state.dragDelta.x, evt.state.dragDelta.y);
      if (this._controlPointDrag) this.controlPointDrag(point);
      else this.pathDrag(point);
      this.updateSVGSelectionBox();
    } else {
      super.onDrag(evt);
    }
  }

  onDragEnd (moveDelta) {
    const { _controlPointDrag, _pathDrag } = this;
    if (_controlPointDrag) {
      delete this._controlPointDrag;
    } else if (_pathDrag) {
      delete this._pathDrag;
    }
  }

  pathDrag (moveDelta) {
    SVG(this.target).dmove(moveDelta.x, moveDelta.y);
    this.createSelectionBoxAndPointsFor(this.target);
  }

  controlPointDrag (moveDelta) {
    let { targetPoint } = this._controlPointDrag;

    SVG(targetPoint).dmove(moveDelta.x, moveDelta.y);
    this.changeSVGToControlPoint(targetPoint, pt(moveDelta.x, moveDelta.y));
  }

  convertPointToCTMOf (target, x, y) {
    const CTM = this.target.getCTM();
    let point = new DOMPoint();
    point.x = x;
    point.y = y;
    point = point.matrixTransform(this.svgPath.getCTM()); // gives transform matrix relative to svg origin
    point.y = CTM.d < 0 ? -point.y : point.y; // d determines the y direction

    return point;
  }

  changeSVGToControlPoint (controlPoint, moveDelta) {
    const cssClass = new PropertyPath('attributes.class.value').get(controlPoint);
    const selectedPath = SVG(this.target);
    const selectedPathArray = selectedPath.array();
    let selectedPoint;
    let _, n, ctrlN;

    if (this.isBezierPoint(controlPoint)) {
      [_, n, ctrlN] = controlPoint.id.match(/bezier-point-([0-9]+)-([0-9]+)/);

      selectedPoint = selectedPathArray[n];
      selectedPoint[1 + (2 * ctrlN)] += moveDelta.x;
      selectedPoint[2 + (2 * ctrlN)] += moveDelta.y;
      this.target.setAttribute('d', selectedPathArray.copyWithin());
      this.updatePathBBox(selectedPath);
    } else if (cssClass && cssClass.includes('control-point')) {
      [_, n, ctrlN] = controlPoint.id.match(/control-point-([0-9]+)(?:-control-([0-9]+))?$/);

      selectedPoint = selectedPathArray[n];
      selectedPathArray[n][selectedPoint.length - 2] += moveDelta.x;
      selectedPathArray[n][selectedPoint.length - 1] += moveDelta.y;
      this.target.setAttribute('d', selectedPathArray.copyWithin());
      this.updatePathBBox(selectedPath);
    }
    n = parseInt(n);
    ctrlN = parseInt(ctrlN);
    // TODO: would like to do that in another method since it is not part of changing the SVG but don't know yet how and where
    if (this.isControlPointWithBezierLine(selectedPath, n)) {
      this.updateBezierLine(controlPoint, n, ctrlN, moveDelta);
    }
  }

  updateBezierLine (controlPoint, id, number, moveDelta) {
    const selectedPath = SVG(this.target).array();
    let startPoints = [];
    if (this.isBezierPoint(controlPoint)) {
      if (number === 0) {
        startPoints = [{ id: id, index: selectedPath[id - 1].length - 2, number: 0, moveStart: false }];
      } else {
        startPoints = [{ id: id, index: 3, number: 1, moveStart: true }];
      }
    } else {
      if (selectedPath[id + 1][0] === 'C')startPoints = [{ id: id + 1, index: selectedPath[id].length - 2, number: 0, moveStart: true }];
      if (selectedPath[id][0] === 'C') startPoints.push({ id: id, index: 2, number: 1, moveStart: false });
    }
    const t = SVG(this.svgPath);

    for (let i = 0; i < startPoints.length; i++) {
      let line = t.findOne('line.bezier-line-' + startPoints[i].id + '-' + startPoints[i].number);
      const lineArray = line.array();
      if (startPoints[i].moveStart) {
        line.plot(lineArray[0][0] + moveDelta.x, lineArray[0][1] + moveDelta.y, lineArray[1][0], lineArray[1][1]);
      } else {
        line.plot(lineArray[0][0], lineArray[0][1], lineArray[1][0] + moveDelta.x, lineArray[1][1] + moveDelta.y);
      }
    }
  }

  isBezierPoint (controlPoint) {
    return controlPoint.id.startsWith('bezier-point');
  }

  isControlPointWithBezierLine (selectedPath, n) {
    const selectedPoint = selectedPath.array()[n];
    const nextPoint = selectedPath.array()[n + 1];
    return this.showBezierPoints && (selectedPoint[0] === 'C' || (nextPoint && nextPoint[0] === 'C'));
  }

  updatePathBBox (selectedPath) {
    let bbox = SVG(this.svgPath).findOne('rect.my-path-selection');
    bbox.attr({
      x: selectedPath.bbox().x,
      y: selectedPath.bbox().y,
      width: selectedPath.bbox().width,
      height: selectedPath.bbox().height
    });
  }

  updateSVGSelectionBox () {
    let svg = SVG(this.svgPath);
    let bbox = svg.findOne('rect.my-svg-selection');

    bbox.attr({
      x: svg.bbox().x,
      y: svg.bbox().y,
      width: svg.bbox().width,
      height: svg.bbox().height
    });
  }

  //= == clear SVG from custom elements ===

  removeAllControlPoints () {
    let oldControlPoints = document.getElementsByClassName('control-point');
    while (oldControlPoints.length > 0) {
      oldControlPoints[0].remove();
    }
  }

  removeAllBezierLines () {
    let oldBezierLines = document.getElementsByClassName('bezier-line');
    while (oldBezierLines.length > 0) {
      oldBezierLines[0].remove();
    }
  }

  removeSVGSelection () {
    const t = SVG(this.svgPath);
    if (t.findOne('rect.my-svg-selection'))t.findOne('rect.my-svg-selection').remove();
  }

  removePathSelection () {
    const t = SVG(this.svgPath);
    if (this.target && t.findOne('rect.my-path-selection')) {
      t.findOne('rect.my-path-selection').remove();
      this.target.selected = false;
    }
  }

  removeAllSelections () {
    this.removeSVGSelection();
    this.removePathSelection();
    this.removeAllControlPoints();
    this.removeAllBezierLines();
    this.editMode = false;
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
    SVG(svgPath).mousedown((evt) => { if (this.editMode) this.selectElement(evt.target); });
    this.width = this.height * ratio;
  }

  removeAllSelections () {
    this.removeSVGSelection();
    this.removePathSelection();
    this.removeAllControlPoints();
    this.removeAllBezierLines();
    this.editMode = false;
  }

  exportSVG () {
    this.svgPath.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    let svgData = this.svgPath.parentElement.innerHTML;
    let preface = '<?xml version="1.0" standalone="no"?>\r\n';
    let svgBlob = new Blob([preface, svgData], { type: 'image/svg+xml;charset=utf-8' });
    $world.serveFileAsDownload(svgBlob, { fileName: 'export-' + this.name, type: 'svg+xml' });
  }

  menuItems () {
    return [
      ['export SVG', () => this.exportSVG()],
      { isDivider: true },
      ...super.menuItems()
    ];
  }

  __additionally_serialize__ (snapshot, ref, pool, addFn) {
    super.__additionally_serialize__(snapshot, ref, pool, addFn);
    this.removeAllSelections();
    snapshot.props.svgPathString = { value: this.svgPath.parentElement.outerHTML };
  }

  __after_deserialize__ (snapshot, objRef, pool) {
    super.__after_deserialize__(snapshot, objRef, pool);
    this.createDomNode(this.svgPathString);
    connect($world, 'showHaloFor', this, 'removeAllSelections');
  }
}
