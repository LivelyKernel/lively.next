/* global XMLSerializer */
/* global fetch */

import { Morph, Icon } from 'lively.morphic';
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
        after: ['svgUrl'],
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
      svgUrl: {
        defaultValue: '',
        set (url) {
          this.setProperty('svgUrl', url);
          this.setSVGPath();
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

  toggleEditMode () {
    this.editMode = !this.editMode;
    const t = SVG(this.svgPath);
    if (this.editMode) {
      const bbox_node = t.rect();
      bbox_node.addClass('my-bbox-selection');
      bbox_node.attr(t.bbox());
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
      t.findOne('rect.my-bbox-selection').remove();
    }

    console.log(this.editMode);
  }

  selectElement (target) {
    console.log('select', target.id, target.selected);
    if (target.selected) {
      target.selected = false;
      // remove bbox
    } else {
      target.selected = true;
      const t = SVG(target);
      const bbox = t.bbox();
      t.opacity(0.5);
    }
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
        const span = this.env.domEnv.document.createElement('span');
        span.innerHTML = svgStr;
        const svgPath = span.getElementsByTagName('svg')[0];
        this.initializeSVGPath(svgPath);
      });
  }

  initializeSVGPath (svgPath) {
    this.svgPath = svgPath;
    const ratio = svgPath.getAttribute('height').replace(/\D/g, '') / svgPath.getAttribute('width').replace(/\D/g, '');
    SVG(svgPath).click((evt) => { if (this.editMode) this.selectElement(evt.target); });
    this.width = this.height * ratio;
  }

  menuItems () {
    let s = new XMLSerializer();
    let str = s.serializeToString(this.svgPath).replace(/\/>/ig, '/>\n');

    const checked = Icon.textAttribute('check-square', { textStyleClasses: ['far'] });
    const unchecked = Icon.textAttribute('square', { textStyleClasses: ['far'] });

    return [
      [[...(this.showControlPoints ? checked : unchecked), ' control points'],
        () => this.showControlPoints = !this.showControlPoints],
      ['edit svg...', () => {
        new SVGWorkspace({
          center: $world.center,
          content: str,
          targetMorph: this
        }).activate();
        console.log(this.svgPath);
      }],
      { isDivider: true },
      ...super.menuItems()
    ];
  }
}
