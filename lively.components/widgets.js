import { obj, num, arr, properties } from 'lively.lang';
import { pt, Color, Rectangle } from 'lively.graphics';
import { signal, connect, disconnect } from 'lively.bindings';
import {
  Morph,
  ShadowObject,
  HorizontalLayout,
  Path,
  Ellipse,
  Label,
  Icon,
  part
} from 'lively.morphic';

import kld from 'kld-intersections';
import { Menu } from 'lively.components';
import { SystemTooltip } from 'lively.morphic/tooltips.cp.js';

const { Shapes, Intersection } = kld;

class LeashEndpoint extends Ellipse {
  get dragTriggerDistance () { return this.connectedMorph ? 20 : 0; }

  onDragStart (evt) {
    const { lastDragPosition, clickedOnPosition } = evt.state;
    evt.state.dragDelta = lastDragPosition.subPt(clickedOnPosition);
    evt.state.endpoint = this;
    this.leash.onEndpointDrag(evt);
  }

  canConnectTo (m) {
    return !m.isWorld && !m.isHaloItem && this.leash.canConnectTo(m) &&
            !m.isHighlighter && !m.ownerChain().some(m => m.isHaloItem);
  }

  onDrag (evt) {
    if (this.connectedMorph) {
      this.clearConnection();
    } else {
      const m = evt.hand.findDropTarget(
        evt.hand.globalPosition,
        [this.leash, this.leash.endPoint, this.leash.startPoint],
        m => this.canConnectTo(m)
      );
      if (this.possibleTarget !== m && this.highlighter) this.highlighter.deactivate();
      this.possibleTarget = m;
      if (this.possibleTarget) {
        this.closestSide = this.possibleTarget
          .globalBounds()
          .partNameNearest(obj.keys(Leash.connectionPoints), this.globalPosition); // eslint-disable-line no-use-before-define
        this.highlighter = $world.highlightMorph($world, this.possibleTarget, false, [this.closestSide]);
        this.highlighter.show();
        this.highlighter.get('name tag').value = this.leash.getLabelFor(this.possibleTarget);
      }
    }
    evt.state.endpoint = this;
    this.leash.onEndpointDrag(evt);
  }

  onDragEnd () {
    $world.removeHighlighters();
    if (this.possibleTarget && this.closestSide) {
      this.attachTo(this.possibleTarget, this.closestSide);
    }
  }

  getConnectionPoint () {
    const { isPath, isPolygon, vertices, origin } = this.connectedMorph;
    const gb = this.connectedMorph.globalBounds();
    if ((isPath || isPolygon) && this.attachedSide !== 'center') {
      const vs = vertices.map(({ x, y }) => pt(x, y).addPt(origin));
      const ib = Rectangle.unionPts(vs);
      const side = ib[this.attachedSide]();
      const center = ib.center().addPt(ib.center().subPt(side));
      const line = Shapes.line(side.x, side.y, center.x, center.y);
      const path = Shapes.polyline(vs.map(({ x, y }) => [x, y]).flat());
      const { x, y } = arr.min(Intersection.intersect(path, line).points, ({ x, y }) => pt(x, y).dist(side));
      return pt(x, y).addPt(gb.topLeft());
    } else {
      return gb[this.attachedSide]();
    }
  }

  update (change) {
    if (change &&
        !['position', 'extent', 'rotation', 'scale'].includes(change.prop) &&
        change.target !== this.connectedMorph) return;
    if (!this.connectedMorph) return;
    const globalPos = this.getConnectionPoint();
    const pos = this.leash.localize(globalPos);
    // if (this.leash.hasFixedPosition) pos = pos.addPt($world.scroll);
    this.vertex.position = pos;
    this.relayout();
  }

  clearConnection () {
    if (this.connectedMorph) {
      disconnect(this.connectedMorph, 'onChange', this, 'update');
      this.connectedMorph = null;
    }
  }

  relayout (change) {
    const { x, y } = this.vertex.position; const bw = this.leash.borderWidth;
    if (change && change.meta && change.meta.animation) {
      this.animate({ center: pt(x + bw, y + bw), duration: change.duration });
    } else {
      this.center = pt(x + bw, y + bw);
    }
  }

  attachTo (morph, side) {
    this.clearConnection();
    if (!this.leash.world()) this.leash.openInWorld(morph.globalPosition);
    this.connectedMorph = morph;
    this.attachedSide = side;
    this.vertex.controlPoints = this.leash.controlPointsFor(side, this);
    this.update();
    connect(this.connectedMorph, 'onChange', this, 'update');
  }

  static get properties () {
    return {
      index: {},
      leash: {},
      nativeCursor: { defaultValue: '-webkit-grab' },
      attachedSide: {},
      connectedMorph: {},
      draggable: { defaultValue: true },
      vertex: {
        after: ['leash'],
        get () {
          return this.leash.vertices[this.index];
        },
        set (v) {
          this.leash.vertices[this.index] = v;
          this.leash.vertices = this.leash.vertices; // this is a very akward interface
        }
      }
    };
  }
}

export class Leash extends Path {
  static get connectionPoints () {
    return {
      topCenter: pt(0, -1),
      topLeft: pt(-1, -1),
      rightCenter: pt(1, 0),
      bottomRight: pt(1, 1),
      bottomCenter: pt(0, 1),
      bottomLeft: pt(-1, 1),
      leftCenter: pt(-1, 0),
      topRight: pt(1, -1),
      center: pt(0, 0)
    };
  }

  static get properties () {
    return {
      start: { defaultValue: pt(0, 0) },
      end: { defaultValue: pt(0, 0) },
      canConnectTo: { defaultValue: m => true },
      getLabelFor: { defaultValue: m => m.name },
      reactsToPointer: { defaultValue: false },
      acceptsDroppedMorphs: { defaultValue: false },
      direction: {
        type: 'Enum',
        values: ['unidirectional', 'outward', 'inward'],
        defaultValue: 'unidirectional'
      },
      endpointStyle: {
        isStyleProp: true,
        defaultValue: {
          fill: Color.black,
          origin: pt(3.5, 3.5),
          extent: pt(10, 10),
          nativeCursor: '-webkit-grab'
        }
      },
      borderWidth: { defaultValue: 2 },
      borderColor: { defaultValue: Color.black },
      fill: { defaultValue: Color.transparent },
      vertices: {
        after: ['start', 'end', 'borderWidth'],
        initialize () {
          this.vertices = [this.start, this.end];
        }
      },
      submorphs: {
        initialize () {
          this.submorphs = [
            (this.startPoint = this.endpoint(0)),
            (this.endPoint = this.endpoint(1))
          ];
          connect(this, 'onChange', this, 'relayout');
          this.updateEndpointStyles();
        }
      }
    };
  }

  onMouseDown (evt) {
    this.updateEndpointStyles();
  }

  updateEndpointStyles () {
    Object.assign(this.startPoint, this.getEndpointStyle(0));
    Object.assign(this.endPoint, this.getEndpointStyle(1));
    this.relayout();
  }

  remove () {
    super.remove();
    this.startPoint.clearConnection();
    this.endPoint.clearConnection();
  }

  onEndpointDrag (evt) {
    const pos = evt.state.endpoint.vertex.position;
    evt.state.endpoint.vertex.position = pos.addPt(evt.state.dragDelta);
    this.relayout();
  }

  getEndpointStyle (idx) {
    return {
      ...this.endpointStyle,
      ...(idx === 0 ? this.endpointStyle.start : this.endpointStyle.end)
    };
  }

  endpoint (idx) {
    const leash = this; const { x, y } = leash.vertices[idx];
    return new LeashEndpoint({ index: idx, leash: this, position: pt(x, y) });
  }

  controlPointsFor (side, endpoint) {
    let next = Leash.connectionPoints[side];
    next = (endpoint === this.startPoint ? next.negated() : next);
    return { previous: next.scaleBy(100), next: next.negated().scaleBy(100) };
  }

  relayout (change) {
    if (change && !['vertices', 'position'].includes(change.prop)) return;
    this.startPoint.relayout(change);
    this.endPoint.relayout(change);
  }
}

export class Slider extends Morph {
  static get properties () {
    return {
      value: {},
      min: {},
      max: {},
      height: { defaultValue: 20 },
      fill: { defaultValue: Color.transparent },
      draggable: { defaultValue: false },
      submorphs: {
        after: ['value', 'max', 'min'],
        initialize () {
          const handle = new SliderHandle({ slider: this, name: 'slideHandle' }); // eslint-disable-line no-use-before-define
          this.submorphs = [
            new Path({
              borderColor: Color.gray.darker(),
              borderWidth: 2,
              vertices: [pt(0, 0), pt(this.width, 0)],
              position: pt(0, this.height / 2)
            }),
            handle
          ];
          connect(this, 'extent', this, 'update');
          this.update();
        }
      }
    };
  }

  normalize (v) {
    return Math.abs(v / (this.max - this.min));
  }

  update (v = this.value) {
    const x = (this.width - 15) * this.normalize(v);
    this.getSubmorphNamed('slideHandle').center = pt(x + 7.5, 10);
  }

  onSlide (slideHandle, delta) {
    const oldValue = this.value;
    const newValue = num.roundTo(oldValue + delta.x / this.width, 0.01);
    const v = Math.max(this.min, Math.min(this.max, newValue));
    this.value = v;
    this.update(v);
  }
}

class SliderHandle extends Ellipse {
  static get properties () {
    return {
      slider: {},
      fill: { defaultValue: Color.gray },
      borderColor: { defaultValue: Color.gray.darker() },
      borderWidth: { defaultValue: 1 },
      dropShadow: { defaultValue: new ShadowObject({ blur: 5 }) },
      extent: { defaultValue: pt(15, 15) },
      nativeCursor: { defaultValue: '-webkit-grab' },
      draggable: { defaultValue: true }
    };
  }

  onDragStart (evt) {
    this.valueView = part(SystemTooltip, { description: '' }).openInWorld(
      evt.hand.position.addXY(10, 10)
    );
  }

  onDrag (evt) {
    this.slider.onSlide(this, evt.state.dragDelta);
    this.valueView.description = this.slider.value;
    this.valueView.position = evt.hand.position.addXY(10, 10);
  }

  onDragEnd (evt) {
    this.valueView.remove();
  }
}

export class DropDownSelector extends Morph {
  static get properties () {
    return {
      values: { defaultValue: [] },
      getCurrentValue: { defaultValue: undefined },
      selectedValue: {
        after: ['submorphs', 'values', 'getCurrentValue'],
        set (v) {
          this.setProperty('selectedValue', v);
          this.relayout();
        }
      },
      fontColor: { isStyleProp: true, defaultValue: Color.black },
      fontSize: { isStyleProp: true, defaultValue: 12 },
      fontFamily: { isStyleProp: true, defaultValue: 'Sans-Serif' },
      border: { defaultValue: { radius: 3, color: Color.gray.darker(), style: 'solid' } },
      padding: { defaultValue: 1 },
      isSelected: {
        defaultValue: 'false',
        set (v) {
          this.setProperty('isSelected', v);
          this.fontColor = v ? Color.white : Color.black;
        }
      },
      layout: {
        initialize () {
          this.layout = new HorizontalLayout({ spacing: this.padding });
        }
      },
      submorphs: {
        initialize () {
          this.build();
        }
      }
    };
  }

  build () {
    this.dropDownLabel = Icon.makeLabel('chevron-circle-down', {
      opacity: 0, name: 'dropDownIcon'
    });
    this.submorphs = [
      {
        type: 'label',
        name: 'currentValue'
      },
      this.dropDownLabel
    ];
  }

  getMenuEntries () {
    const currentValue = this.getNameFor(this.selectedValue);
    return [
      ...(this.selectedValue !== undefined ? [{ command: currentValue, target: this }] : []),
      ...arr.compact(
        this.commands.map(c => {
          return c.name !== currentValue && { command: c.name, target: this };
        })
      )
    ];
  }

  get commands () {
    if (obj.isArray(this.values)) {
      return this.values.map(v => {
        return {
          name: String(v),
          exec: () => {
            signal(this, 'update', v);
            this.selectedValue = v;
          }
        };
      });
    } else {
      return properties.forEachOwn(this.values, (name, v) => {
        return {
          name,
          exec: () => {
            signal(this, 'update', v);
            this.selectedValue = v;
          }
        };
      });
    }
  }

  getNameFor (value) {
    if (this.getCurrentValue) return this.getCurrentValue();
    if (obj.isArray(this.values)) {
      return obj.safeToString(value);
    } else {
      return obj.safeToString(properties.nameFor(this.values, value));
    }
  }

  relayout () {
    const vPrinted = this.getNameFor(this.selectedValue);
    const valueLabel = this.get('currentValue');
    if (vPrinted === 'undefined') {
      valueLabel.value = 'Not set';
      valueLabel.fontColor = Color.gray;
    } else {
      valueLabel.value = vPrinted;
      valueLabel.fontColor = Color.black;
    }
  }

  onHoverIn () {
    this.dropDownLabel.animate({ opacity: 1, duration: 300 });
  }

  onHoverOut () {
    this.dropDownLabel.animate({ opacity: 0, duration: 200 });
  }

  onMouseDown (evt) {
    const eventState = this.env.eventDispatcher.eventState;
    if (eventState.menu) eventState.menu.remove();

    eventState.menu = this.getMenuEntries() && this.getMenuEntries().length
      ? Menu.openAtHand(this.getMenuEntries(), { hand: (evt && evt.hand) })
      : null;
    this.menu = eventState.menu;
    this.menu.hasFixedPosition = true; // !!this.ownerChain().find(m => m.hasFixedPosition);
    this.menu.topLeft = this.globalPosition;
    // this.menu.isHaloItem = this.isHaloItem;
  }
}
