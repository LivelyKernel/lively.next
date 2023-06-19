import { Color, rect, pt } from 'lively.graphics';
import { TilingLayout, ViewModel, ShadowObject, Icon, Label, component, part } from 'lively.morphic';
import { obj, num } from 'lively.lang';
import { SystemTooltip } from 'lively.morphic/tooltips.cp.js';
import { signal } from 'lively.bindings';

const CaretButton = component({
  name: 'caret button',
  borderColor: Color.rgb(23, 160, 251),
  clipMode: 'hidden',
  extent: pt(20, 12),
  fill: Color.rgba(0, 0, 0, 0),
  nativeCursor: 'pointer',
  submorphs: [{
    type: Label,
    name: 'icon',
    borderColor: Color.rgba(0, 0, 0, 0),
    borderWidth: 1,
    fontColor: Color.rgb(127, 140, 141),
    nativeCursor: 'pointer',
    padding: rect(5, 0, -1, -1),
    reactsToPointer: false,
    textAndAttributes: Icon.textAttribute('sort-up')
  }]
});

export class NumberWidgetModel extends ViewModel {
  static get properties () {
    return {
      unit: {
        type: 'Enum',
        values: ['px', '%', 'pt', '']
      },
      autofit: {
        // if set to true, this will shrink the displayed value to
        // fit into the current bounds of the number input
        // FIXME: is currently broken, since the text bounds logic breaks
        //        once we start scaling the text
        defaultValue: false
      },
      number: {
        defaultValue: 0,
        after: ['unit', 'autofit'],
        set (v) {
          this.setProperty('number', v);
          signal(this.view, 'number', v);
          signal(this.view, 'numberChanged', v);
        }
      },
      precision: {
        defaultValue: 0
      },
      min: {
        defaultValue: -Infinity,
        set (v) {
          if (isNaN(v)) {
            return;
          }
          this.setProperty('min', v);
        }
      },
      max: {
        defaultValue: Infinity,
        set (v) {
          if (isNaN(v)) {
            return;
          }
          this.setProperty('max', v);
        }
      },
      floatingPoint: {
        after: ['number'],
        defaultValue: false,
        get () {
          if (typeof this.getProperty('floatingPoint') !== 'undefined') {
            return this.getProperty('floatingPoint');
          }
          const m = /[+-]?([0-9]*[.])?[0-9]+/.exec(this.number);
          return this.scaleFactor === 1 && m && !!m[1];
        }
      },
      // defines a scalor value that is applied to the internally stored value
      // in order to be applied to the displayed value. For instance when controlling
      // the opacity of a morph, we want to store floats between 0 and 1 inside the number
      // property, but want the values between 1 and 100 to be displayed in the number widget.
      // Hence in this case the scaleFactor would be 100.
      scaleFactor: {
        defaultValue: 1
      },
      // defines the velocity of the value change, usually controlled by the alignment
      // of the mouse cursor while scrubbing.
      baseFactor: {
        defaultValue: 1
      },
      isSelected: {
        set (selected) {
          if (this.getProperty('isSelected') !== selected) {
            // fixme: style sheets should restore the initial value, once a rule no longer applies
            const { view } = this;
            if (selected) {
              view.addStyleClass('selected');
              view.removeStyleClass('unselected');
            } else {
              view.removeStyleClass('selected');
              view.addStyleClass('unselected');
            }
            this.setProperty('isSelected', selected);
          }
        }
      },

      spaceToDisplay: {
        get () {
          if (this.ui.up) return this.ui.up.left;
          return this.view.width;
        }
      },

      showStepControls: {
        derived: true,
        get () {
          const { up, down } = this.ui;
          return up && up.visible && down && down.visible;
        },
        set (active) {
          this.ui.up.visible = this.ui.down.visible = active;
          this.clipMode = active ? 'visible' : 'hidden';
        }
      },

      expose: { get () { return ['number', 'increment', 'decrement', 'isMixed', 'setMixed']; } },

      bindings: {
        get () {
          return [
            { target: 'value', signal: 'onDragStart', handler: 'onScrubStart' },
            { target: 'value', signal: 'onDrag', handler: 'onScrub' },
            { target: 'value', signal: 'onDragEnd', handler: 'onScrubEnd' },
            { target: 'value', signal: 'onKeyDown', handler: 'onInput' },
            { target: 'value', signal: 'onMouseUp', handler: 'interactivelyEdit' },
            { target: 'up', signal: 'onMouseDown', handler: 'increment' },
            { target: 'down', signal: 'onMouseDown', handler: 'decrement' }
          ];
        }
      }
    };
  }

  // helpers

  increment () {
    if (this.max !== undefined && this.number >= this.max) return;
    this.number += (1 / this.scaleFactor);
  }

  decrement () {
    if (this.min !== undefined && this.number <= this.min) return;
    this.number -= (1 / this.scaleFactor);
  }

  setMixed () {
    this.ui.value.textString = 'Mix';
  }

  get isMixed () {
    return this.ui.value.textString === 'Mix';
  }

  getCurrentValue (delta, s) {
    let v = this.scrubbedValue + (this.floatingPoint ? delta * s : Math.round(delta * s));
    v /= this.scaleFactor;
    return Math.max(this.min, Math.min(this.max, v));
  }

  getScaleAndOffset (evt) {
    const { x, y } = evt.position.subPt(this.initPos);
    const scale = num.roundTo(Math.exp(-y / $world.height * 4), 0.01) * this.baseFactor;
    return { offset: x, scale };
  }

  interactivelyEdit () {
    this.ui.value.readOnly = false;
    this.ui.value.focus();
  }

  // event handling

  onInput (evt) {
    if (evt.keyCombo === 'Enter') {
      const [v] = this.ui.value.textString.replace('\n', '').split(' ');
      if (typeof v === 'string') {
        this.number = parseFloat(v) / this.scaleFactor;
      }
      this.ui.value.readOnly = true;
      evt.stop();
    }
  }

  onScrubStart (evt) {
    this.view.execCommand('toggle active mark');
    this.initPos = evt.position;
    this.scrubbedValue = this.floatingPoint ? this.number * this.scaleFactor : num.roundTo(this.number * this.scaleFactor, 1);
    this.factorLabel = part(SystemTooltip, { description: '1x' }).openInWorld(
      evt.hand.position.addXY(10, 10)
    );
    evt.hand.extent = pt(30, 30);
    evt.hand.nativeCursor = 'ew-resize';
    evt.hand.fill = Color.transparent;
    evt.hand.reactsToPointer = true;
  }

  onScrub (evt) {
    // x delta is the offset to the original value
    // y is the scale
    const { scale, offset } = this.getScaleAndOffset(evt);
    this.number = this.getCurrentValue(offset, scale);
    this.factorLabel.description = scale.toFixed(this.precision) + 'x';
    this.factorLabel.position = evt.hand.position.addXY(10, 10);
    evt.hand.moveBy(pt(-5, -5));
  }

  onScrubEnd (evt) {
    const { offset, scale } = this.getScaleAndOffset(evt);
    this.scrubbedValue = this.getCurrentValue(offset, scale) * this.scaleFactor;
    this.factorLabel.softRemove();
    evt.hand.extent = pt(1, 1);
    evt.hand.reactsToPointer = false;
  }

  // UI updating

  updateDisplayedValue (v) {
    v = Math.max(this.min, Math.min(this.max, v));
    if (!this.isBeingDragged) { this.scrubbedValue = v; }
    this.renderValue(v);
  }

  renderValue (v) {
    v *= this.scaleFactor;
    let valueString = this.floatingPoint ? v.toFixed(this.precision) : v.toFixed(0);
    if (this.unit) valueString += ' ' + this.unit;
    const { value } = this.ui;
    value.textString = valueString;
    if (this.autofit && valueString.length > 0) {
      if (!this._digitWidth) {
        this._digitWidth = value.textBounds().width / value.textString.length;
      }
      const p = Math.min(this.spaceToDisplay / (valueString.length * this._digitWidth), 1);
      value.scale = p;
    } else {
      if (value.scale < 1) value.scale = 1;
    }
  }

  onRefresh (prop) {
    if (prop == 'number') this.renderValue(this.number);
  }
}

const DefaultNumberWidget = component({
  defaultViewModel: NumberWidgetModel,
  name: 'default number widget',
  borderColor: Color.rgb(149, 165, 166),
  borderRadius: 4,
  dropShadow: new ShadowObject({ color: Color.rgba(0, 0, 0, 0.26) }),
  extent: pt(72.5, 25.7),
  fill: Color.rgb(253, 254, 254),
  fontColor: Color.rgb(178, 235, 242),
  fontFamily: 'IBM Plex Sans',
  fontSize: 16,
  clipMode: 'hidden',
  layout: new TilingLayout({
    axisAlign: 'center',
    orderByIndex: true,
    resizePolicies: [['value', {
      height: 'fixed',
      width: 'fill'
    }]]
  }),
  padding: rect(6, 2, -6, -2),
  submorphs: [
    {
      type: 'text',
      name: 'value',
      fill: Color.transparent,
      extent: pt(53.6, 24),
      fixedWidth: true,
      selectable: true,
      readOnly: true,
      fontColor: Color.rgb(40, 116, 166),
      fontFamily: 'IBM Plex Sans',
      fontSize: 16,
      padding: rect(6, 2, -6, -2),
      scaleToBounds: true,
      draggable: true,
      textAndAttributes: ['0', null]
    },
    {
      name: 'button holder',
      fill: Color.transparent,
      layout: new TilingLayout({ axis: 'column' }),
      submorphs: [part(CaretButton, {
        name: 'up',
        submorphs: [{
          name: 'icon',
          padding: rect(6, 0, -2, -1),
          textAndAttributes: Icon.textAttribute('sort-up')
        }]
      }),
      part(CaretButton, { name: 'down', rotation: Math.PI })]
    }
  ]
});

const DarkNumberWidget = component(DefaultNumberWidget, {
  name: 'dark number widget',
  fill: Color.rgb(66, 73, 73),
  submorphs: [{
    name: 'value',
    fontColor: Color.rgb(178, 235, 242),
    cursorColor: Color.rgba(178, 235, 242, 0.5)
  }]
});

export { DefaultNumberWidget, DarkNumberWidget };
