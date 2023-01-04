import {
  Morph,
  morph,
  TilingLayout,
  Label,
  Icon,
  InputLine,
  config
} from 'lively.morphic';

import { connect, signal } from 'lively.bindings';
import { Color, pt, rect } from 'lively.graphics';
import { num, obj } from 'lively.lang';

import { popovers } from './index.js';

/*

Value Widgets are the default visual elements in lively.morphic to modify
certain types of values via direct manipulation. The idea is to make frequently
reappearing types of values within the morphic system (such as Points,
Gradients, Colors etc...) easily recognizable by the user in various different
context (i.e. tools). The widgets are designed to be easily embeddable into a
variety of different context both in a programmatic and visual (that is
aesthetic) way.

Developers conceiving new tools in lively are therefore encouraged to make use
of these existing and/or add their own for new types of values as they please.

*/

/*

  About Context Sensitive Widgets:

  It so happens that some properties of morphs can not be inspected in a
  meaningful way without taking into account to which morph the current
  property belongs to.   Take for instance the example of the layout property:
  Parametrizing layouts in a visual ways often requires us to directly interact
  with the morph the layout is attached to. For instance adding and removing
  morphs to and from cells of a GridLayout can not be done via direct
  manipulation without referring top a concrete morph instance that the
  GridLayout is attached to. Though these types of properties are (fortnunately
  rare), the widgets that modify these properties require a certain context
  (that is a morph) they can bind the change requests by the user.

*/

class ContextSensitiveWidget extends Morph {
  static get properties () {
    return {
      fill: { defaultValue: Color.transparent },
      isSelected: {
        defaultValue: 'false',
        set (v) {
          this.setProperty('isSelected', v);
          this.fontColor = v ? Color.white : Color.black;
        }
      },
      layout: {
        initialize () {
          this.layout = new TilingLayout({
            axis: 'column'
          });
        }
      },
      context: {
        serialize: false
        /* a certain morph that the inspected property is assigned to */
      }
    };
  }
}

class ShortcutWidget extends ContextSensitiveWidget {
  static get properties () {
    return {
      title: {
        defaultValue: 'No Title', /* Name denoting the shortcut */
        after: ['submorphs'],
        set (t) {
          this.setProperty('title', t);
          this.getSubmorphNamed('valueString').value = t;
        }
      },
      nativeCursor: { defaultValue: 'pointer' },
      fontColor: {
        derived: true,
        set (c) {
          this.submorphs.forEach(m => m.fontColor = c);
        }
      },
      submorphs: {
        initialize () {
          this.submorphs = [
            Icon.makeLabel('arrow-right', {
              styleClasses: ['TreeLabel'],
              fontSize: 15,
              padding: rect(1, 1, 4, 1)
            }),
            {
              type: 'label',
              value: this.title,
              styleClasses: ['TreeLabel'],
              fontWeight: 'bold',
              name: 'valueString',
              opacity: 0.8,
              borderRadius: 5,
              padding: rect(0, 0, 0, 2),
              nativeCursor: 'pointer',
              fontSize: 12,
              borderWidth: 0
            }
          ];
        }
      }
    };
  }

  onMouseDown (evt) {
    this.openPopover();
  }

  async openPopover () {
    /* provide a tool for editing the property at hand */
  }
}

export class LayoutWidget extends ShortcutWidget {
  static get properties () {
    return {
      title: {
        after: ['submorphs'],
        initialize () {
          this.title = this.context && this.context.layout
            ? 'Configure ' + this.context.layout.name() + ' Layout'
            : 'No Layout';
        }
      }
    };
  }

  layoutChanged () {
    this.title = this.context.layout
      ? 'Configure ' + this.context.layout.name() + ' Layout'
      : 'No Layout';
  }

  async openPopover () {
    const editor = new popovers.LayoutPopover({
      hasFixedPosition: !!this.ownerChain().find(m => m.hasFixedPosition),
      container: this.context
    });
    await editor.fadeIntoWorld(this.globalBounds().center());
    connect(editor, 'layoutChanged', this, 'layoutChanged');
    signal(this, 'openWidget', editor);
  }
}

// these can exist outside of a certain morph context

export class ColorWidget extends ContextSensitiveWidget {
  static get properties () {
    return {
      layout: {
        initialize () {
          this.layout = new HorizontalLayout({ direction: 'centered' });
        }
      },
      selectionFontColor: {
        defaultValue: Color.white
      },
      nonSelectionFontColor: {
        defaultValue: Color.black
      },
      color: { defaultValue: Color.blue },
      gradientEnabled: { defaultValue: false },
      fontSize: { defaultValue: 14 },
      isSelected: {
        after: ['submorphs'],
        set (selected) {
          if (this.getProperty('isSelected') !== selected) {
            this.getSubmorphNamed('valueString').fontColor = selected
              ? this.selectionFontColor
              : this.nonSelectionFontColor;
            this.setProperty('isSelected', selected);
          }
        }
      },
      submorphs: {
        after: ['nonSelectionFontColor', 'selectionFontColor'],
        initialize () {
          connect(this, 'color', this, 'relayout', {
            converter: (next, prev) => {
              return (prev && prev.isColor) !== (next && next.isColor);
            }
          });
          this.relayout(true);
        }
      }
    };
  }

  relayout (reset) {
    if (reset) {
      if (!this.color) {
        this.submorphs = this.renderNoColor();
        return;
      }
      this.submorphs = this.color.isGradient
        ? this.renderGradientValue()
        : this.renderColorValue();
    } else {
      if (!this.color) return;
      this.color.isGradient
        ? this.updateGradientValue()
        : this.updateColorValue();
    }
  }

  updateGradientValue () {
    const gradient = this.color;
    if (gradient.stops.length * 2 === this.submorphs.length - 3) {
      // patch the stops
      let stopLabel;
      for (const i in this.color.stops) {
        const { color, offset } = gradient.stops[i];
        const { submorphs: [stopColor] } = this.submorphs[2 + i * 2];
        stopLabel = this.submorphs[3 + i * 2];
        stopColor.fill = color;
        stopLabel.value = (offset * 100).toFixed() + '%' + (i < gradient.stops.length - 1 ? ',' : '');
      }
    } else {
      this.submorphs = this.renderGradientValue();
    }
  }

  renderGradientValue () {
    return [
      {
        type: 'label',
        styleClasses: ['TreeLabel'],
        value: this.color.type + '(',
        name: 'valueString'
      },
      ...this.renderStops(),
      {
        type: 'label',
        styleClasses: ['TreeLabel'],
        value: ')'
      }
    ];
  }

  updateColorValue () {
    this.getSubmorphNamed('color box').fill = this.color;
    this.getSubmorphNamed('valueString').value = obj.safeToString(this.color);
  }

  renderNoColor () {
    return [
      {
        extent: pt(15, 15),
        fill: Color.transparent,
        submorphs: [
          {
            styleClasses: ['colorValue'],
            name: 'color box',
            center: pt(5, 7.5),
            fill: Color.white,
            borderColor: Color.gray.darker(),
            borderWidth: 1,
            submorphs: [
              {
                type: 'path',
                name: 'no fill',
                vertices: [pt(0, 0), pt(10, 10)],
                borderColor: Color.red
              }
            ]
          }
        ]
      },
      {
        type: 'label',
        value: 'No Color',
        fontSize: 14,
        name: 'valueString',
        styleClasses: ['TreeLabel']
      }
    ];
  }

  renderColorValue () {
    return [
      {
        extent: pt(15, 15),
        fill: Color.transparent,
        submorphs: [{
          styleClasses: ['colorValue'],
          name: 'color box',
          center: pt(5, 7.5),
          fill: this.color,
          borderColor: Color.gray.darker(),
          nativeCursor: 'pointer',
          borderWidth: 1
        }
        ]
      },
      {
        type: 'label',
        value: obj.safeToString(this.color),
        fontSize: 14,
        name: 'valueString',
        styleClasses: ['TreeLabel']
      }
    ];
  }

  renderStops () {
    const gradient = this.color;
    const stops = [
      {
        type: 'label',
        padding: rect(0, 0, 5, 0),
        value: gradient.type === 'linearGradient'
          ? num.toDegrees(gradient.vectorAsAngle()).toFixed() + '°,'
          : ''
      }
    ];
    for (const i in gradient.stops) {
      const { color, offset } = gradient.stops[i];
      stops.push({
        extent: pt(this.fontSize, this.fontSize),
        fill: Color.transparent,
        layout: new HorizontalLayout({ spacing: 3 }),
        submorphs: [
          {
            styleClasses: ['colorValue'],
            fill: color
          }
        ]
      });
      stops.push({
        type: 'label',
        padding: rect(0, 0, 5, 0),
        value: (offset * 100).toFixed() + '%' + (i < gradient.stops.length - 1 ? ',' : '')
      });
    }
    return stops;
  }

  onMouseDown (evt) {
    this.openFillEditor();
  }

  update (color) {
    this.color = color;
  }

  async openFillEditor () {
    const editor = new popovers.FillPopover({
      hasFixedPosition: !!this.ownerChain().find(m => m.hasFixedPosition),
      handleMorph: this.context,
      fillValue: this.color,
      title: 'Fill Control',
      gradientEnabled: this.gradientEnabled
    });
    await editor.fadeIntoWorld(this.globalBounds().center());
    connect(editor, 'fillValue', this, 'update');
    signal(this, 'openWidget', editor);
  }
}

export class BooleanWidget extends Label {
  static get properties () {
    return {
      fontFamily: { defaultValue: config.codeEditor.defaultStyle.fontFamily },
      nativeCursor: { defaultValue: 'pointer' },
      boolean: {
        set (b) {
          this.setProperty('boolean', b);
          this.value = obj.safeToString(b);
          this.fontColor = this.boolean ? Color.green : Color.red;
        }
      }
    };
  }

  onMouseDown (evt) {
    this.boolean = !this.boolean;
  }
}

export class NumberWidget extends Morph {
  static get properties () {
    return {
      unit: {
        type: 'Enum',
        isStyleProp: true,
        values: ['px', '%', 'pt', '']
      },
      autofit: {
        defaultValue: true,
        after: ['submorphs', 'extent'],
        set (active) {
          this.setProperty('autofit', active);
          this.getSubmorphNamed('value').scaleToBounds = !active;
        }
      },
      number: {
        defaultValue: 0,
        after: ['unit', 'autofit'],
        set (v) {
          this.setProperty('number', v);
          this.relayout(false);
        }
      },
      min: { defaultValue: -Infinity },
      max: { defaultValue: Infinity },
      floatingPoint: {
        after: ['number', 'submorphs'],
        set (isFloat) {
          this.setProperty('floatingPoint', isFloat);
          this.get('value').floatingPoint = isFloat;
        },
        get () {
          if (typeof this.getProperty('floatingPoint') !== 'undefined') {
            return this.getProperty('floatingPoint');
          }
          const m = /[+-]?([0-9]*[.])?[0-9]+/.exec(this.number);
          return this.scaleFactor === 1 && m && !!m[1];
        }
      },
      extent: { defaultValue: pt(70, 25) },
      scaleFactor: {
        defaultValue: 1,
        get () {
          return this.getProperty('scaleFactor') || 1;
        }
      },
      baseFactor: {
        after: ['submorphs'],
        derived: true,
        get () {
          return this.get('value').baseFactor;
        },
        set (v) {
          this.get('value').baseFactor = v;
        }
      },
      styleClasses: { defaultValue: ['unfocused'] },
      fontColor: {
        isStyleProp: true,
        defaultValue: Color.rgbHex('#0086b3'),
        set (v) {
          this.setProperty('fontColor', v);
        }
      },
      isSelected: {
        set (selected) {
          if (this.getProperty('isSelected') !== selected) {
            // fixme: style sheets should restore the initial value, once a rule no longer applies
            if (selected) {
              this.addStyleClass('selected');
              this.removeStyleClass('unselected');
            } else {
              this.removeStyleClass('selected');
              this.addStyleClass('unselected');
            }
            this.setProperty('isSelected', selected);
          }
        }
      },
      fontFamily: {
        defaultValue: 'Sans-Serif',
        isStyleProp: true,
        set (v) {
          this.setProperty('fontFamily', v);
        }
      },
      fontSize: {
        defaultValue: 15,
        isStyleProp: true,
        set (v) {
          this.setProperty('fontSize', v);
        }
      },

      showStepControls: {
        derived: true,
        get () {
          const up = this.getSubmorphNamed('up');
          const down = this.getSubmorphNamed('down');
          return up && up.visible && down && down.visible;
        },
        set (active) {
          this.getSubmorphNamed('up').visible = this.getSubmorphNamed('down').visible = active;
          this.clipMode = active ? 'visible' : 'hidden';
        }
      }
    };
  }

  get isNumberWidget () {
    return true;
  }

  get isMixed () {
    return this.getSubmorphNamed('value').isMixed;
  }

  setMixed () {
    this.getSubmorphNamed('value').setMixed();
  }

  onMouseDown (evt) {
    super.onMouseDown(evt);
    if (evt.targetMorph.name === 'up') { this.increment(); }
    if (evt.targetMorph.name === 'down') { this.decrement(); }
  }

  onMouseUp (evt) {
    super.onMouseUp(evt);
    if (evt.targetMorph.name === 'value') { this.interactivelyEdit(); }
  }

  interactivelyEdit () {
    this.getSubmorphNamed('value').readOnly = false;
    this.getSubmorphNamed('value').focus();
  }

  spec () {
    return obj.dissoc(super.spec(), ['submorphs']);
  }

  update (v, fromScrubber = true) {
    // allows us to selectively skip relayouting
    this.setProperty('number', fromScrubber ? v / this.scaleFactor : v);
    signal(this, 'number', this.number);
    signal(this, 'numberChanged', this.number);
    this.relayout(fromScrubber);
  }

  relayoutButtons () {
    if (!this.showStepControls) return;
    const upButton = this.getSubmorphNamed('up');
    const downButton = this.getSubmorphNamed('down');

    if (upButton && downButton) {
      upButton.height = downButton.height = Math.floor(this.height / 2);
      upButton.width = downButton.width = 20;
    }
  }

  onChange (change) {
    super.onChange(change);
    if (change.prop === 'extent' && !this.autofit) this.relayout(true);
  }

  relayout (fromScrubber) {
    this.withMetaDo({ metaInteraction: true }, () => {
      const valueContainer = this.getSubmorphNamed('value');
      const buttonOffset = this.showStepControls ? 20 : 0;

      if (!valueContainer) return;
      valueContainer.readOnly = true;

      if (this.autofit) {
        if (!fromScrubber) valueContainer.value = this.number * this.scaleFactor;
        valueContainer.fit();
        this.height = valueContainer.height;
        this.width = valueContainer.width + buttonOffset;
        this.relayoutButtons();
      } else {
        if (!fromScrubber) valueContainer.width = this.width - buttonOffset;
        this.relayoutButtons();
      }
      if (!fromScrubber) {
        valueContainer.value = valueContainer.scrubbedValue = this.floatingPoint ? this.number * this.scaleFactor : num.roundTo(this.number * this.scaleFactor, 1);
        valueContainer.min = this.min !== -Infinity ? this.min * this.scaleFactor : this.min;
        valueContainer.max = this.max !== Infinity ? this.max * this.scaleFactor : this.max;
        valueContainer.unit = this.unit;
      }
    });
  }

  increment () {
    if (this.max !== undefined && this.number >= this.max) return;
    this.update(this.number + (1 / this.scaleFactor), false);
  }

  decrement () {
    if (this.min !== undefined && this.number <= this.min) return;
    this.update(this.number - (1 / this.scaleFactor), false);
  }
}

export class ShadowWidget extends Morph {
  static get properties () {
    return {
      shadowValue: {
        after: ['submorphs'],
        defaultValue: null,
        set (v) {
          this.setProperty('shadowValue', v);
          this.renderShadowDisplay();
        }
      },
      fill: { defaultValue: Color.transparent },
      nativeCursor: { defaultValue: 'pointer' },
      fontSize: { defaultValue: 12 },
      fontColor: {
        derived: true,
        set (c) {
          this.submorphs.forEach(m => m.fontColor = c);
        }
      },
      isSelected: {
        defaultValue: false,
        set (v) {
          this.setProperty('isSelected', v);
          this.fontColor = v ? Color.white : Color.black;
        }
      },
      layout: {
        initialize () {
          this.layout = new HorizontalLayout();
        }
      },
      submorphs: {
        initialize () {
          this.update();
        }
      }
    };
  }

  onMouseDown (evt) {
    this.openPopover();
  }

  async openPopover () {
    const shadowEditor = new popovers.ShadowPopover({
      hasFixedPosition: !!this.ownerChain().find(m => m.hasFixedPosition),
      shadowValue: this.shadowValue
    });
    await shadowEditor.fadeIntoWorld(this.globalBounds().center());
    connect(shadowEditor, 'shadowValue', this, 'shadowValue');
    connect(this, 'shadowValue', this, 'update');
    signal(this, 'openWidget', shadowEditor);
  }

  update () {
    this.renderShadowDisplay();
  }

  renderShadowDisplay () {
    if (!this.shadowValue) {
      this.submorphs = [
        {
          opacity: 0.8,
          reactsToPointer: false,
          styleClasses: ['TreeLabel'],
          name: 'valueString',
          type: 'label',
          value: 'No Shadow'
        }
      ];
      return;
    }
    if (this.submorphs.length > 1) {
      this.updateShadowDisplay();
    } else {
      this.initShadowDisplay();
    }
  }

  updateShadowDisplay () {
    const { inset, blur, spread, distance, color } = this.shadowValue;
    const [nameLabel, { submorphs: [shadowColor] }, paramLabel] = this.submorphs;
    nameLabel.value = `${inset ? 'inset' : 'drop'}-shadow(`;
    shadowColor.fill = color;
    paramLabel.value = `, ${blur}px, ${distance}px, ${spread}px)`;
  }

  initShadowDisplay () {
    const { inset, blur, spread, distance, color } = this.shadowValue;
    this.submorphs = [
      {
        name: 'valueString',
        opacity: 0.7,
        reactsToPointer: false,
        type: 'label',
        value: `${inset ? 'inset' : 'drop'}-shadow(`
      },
      morph({
        fill: Color.transparent,
        extent: pt(this.fontSize + 6, this.fontSize + 4),
        submorphs: [
          {
            extent: pt(this.fontSize, this.fontSize),
            position: pt(2, 2),
            fill: color,
            borderColor: Color.black,
            borderWidth: 1
          }
        ]
      }),
      {
        name: 'valueString',
        type: 'label',
        opacity: 0.7,
        reactsToPointer: false,
        value: `, ${blur}px, ${distance}px, ${spread}px)`
      }
    ];
  }
}

export class PointWidget extends Label {
  static get properties () {
    return {
      isSelected: {
        defaultValue: 'false',
        set (v) {
          this.setProperty('isSelected', v);
          this.fontColor = v ? this.selectionFontColor : this.nonSelectionFontColor;
        }
      },
      selectionFontColor: {
        isStyleProp: true,
        defaultValue: Color.white
      },
      nonSelectionFontColor: {
        isStyleProp: true,
        defaultValue: Color.black
      },
      fontFamily: { defaultValue: config.codeEditor.defaultStyle.fontFamily },
      nativeCursor: { defaultValue: 'pointer' },
      styleClasses: { defaultValue: ['TreeLabel'] }, // in order to be highlighted in tree
      pointValue: {
        after: ['textAndAttributes'],
        set (p) {
          const fontColor = Color.rgbHex('#0086b3');
          this.setProperty('pointValue', p);
          this.textAndAttributes = ['pt(', null,
            p.x.toFixed(), { fontColor },
            ',', {},
            p.y.toFixed(), { fontColor }, ')', null];
          this.fixedWidth = true;
          this.fixedHeight = true;
          this.height = 20;
          this.width = this.textString.length * this.fontSize;
        }
      }
    };
  }

  onMouseDown (evt) {
    this.openPopover();
  }

  async openPopover () {
    const editor = new popovers.PointPopover({
      pointValue: this.pointValue,
      hasFixedPosition: !!this.ownerChain().find(m => m.hasFixedPosition)
    });
    await editor.fadeIntoWorld(this.globalBounds().center());
    connect(editor, 'pointValue', this, 'pointValue');
    signal(this, 'openWidget', editor);
  }
}

export class PaddingWidget extends Label {
  static get properties () {
    return {
      nativeCursor: { defaultValue: 'pointer' },
      styleClasses: { defaultValue: ['TreeLabel'] },
      fontFamily: { defaultValue: config.codeEditor.defaultStyle.fontFamily },
      isSelected: {
        defaultValue: 'false',
        set (v) {
          this.setProperty('isSelected', v);
          this.fontColor = v ? Color.white : Color.black;
        }
      },
      rectangle: {
        defaultValue: rect(0),
        set (r) {
          this.setProperty('rectangle', r);
          this.value = obj.safeToString(r);
        }
      }
    };
  }

  onMouseDown (evt) {
    this.openPopover();
  }

  async openPopover () {
    const editor = new popovers.RectanglePopover({
      hasFixedPosition: !!this.ownerChain().find(m => m.hasFixedPosition),
      rectangle: this.rectangle
    });
    editor.relayout();
    await editor.fadeIntoWorld(this.globalBounds().center());
    connect(editor, 'rectangle', this, 'rectangle');
    signal(this, 'openWidget', editor);
  }
}

export class IconWidget extends Label {
  static get properties () {
    return {
      fontColor: { defaultValue: Color.gray.darker() },
      fontFamily: { defaultValue: 'FontAwesome' },
      nativeCursor: { defaultValue: 'pointer' },
      iconValue: {
        derived: true,
        get () {
          return this.value;
        },
        set (v) {
          this.value = v || 'No Icon';
        }
      }
    };
  }

  onMouseDown (evt) {
    this.openPopover();
  }

  async openPopover () {
    const iconPicker = new popovers.IconPopover({
      hasFixedPosition: !!this.ownerChain().find(m => m.hasFixedPosition)
    });
    await iconPicker.fadeIntoWorld(this.globalBounds().center());
    connect(iconPicker, 'select', this, 'iconValue', {
      converter: (iconName) => {
        return iconName && Icon.makeLabel(iconName).value;
      },
      varMapping: { Icon }
    });
    signal(this, 'openWidget', iconPicker);
  }
}

export class StringWidget extends InputLine {
  // inline editing of string, very basic
  static get properties () {
    return {
      fill: { defaultValue: Color.transparent },
      fontColor: { defaultValue: Color.blue },
      nativeCursor: { defaultValue: 'auto' },
      borderColor: { defaultValue: Color.transparent },
      borderStyle: { defaultValue: 'dashed' },
      borderRadius: { defaultValue: 4 },
      borderWidth: { defaultValue: 1 },
      padding: { defaultValue: rect(0, 0, 0, 0) },
      fixedWidth: { defaultValue: false },
      fixedHeight: { defaultValue: false },
      stringValue: {
        after: ['textString'],
        set (v) {
          this.setProperty('stringValue', v);
          this.textString = this.truncate(v);
          this.nativeCursor = this.stringTooLong ? 'pointer' : 'auto';
        }
      },
      stringTooLong: {
        readOnly: true,
        get () { return this.stringValue.includes('\n'); }
      },
      isSelected: {
        defaultValue: 'false',
        set (v) {
          this.setProperty('isSelected', v);
          this.fontColor = v ? Color.white : Color.blue;
        }
      }
    };
  }

  truncate (s) {
    if (s.length > 200) {
      return s.slice(0, 20) + '...';
    } else {
      return s;
    }
  }

  async onFocus (evt) {
    super.onFocus(evt);
    if (this.readOnly) return;
    if (!this.stringTooLong) {
      this.borderColor = Color.white.withA(0.9);
      this.textString = this.stringValue;
      return;
    }
    const result = await this.world().editPrompt(
      'edit string', { requester: this, input: this.stringValue });
    if (typeof result === 'string') this.onInput(result);
  }

  onBlur (evt) {
    super.onBlur(evt);
    if (this.readOnly) return;
    this.borderColor = Color.transparent;
    this.onInput(this.textString);
  }

  onInput (input) {
    this.owner.focus();
    signal(this, 'inputAccepted', input);
    this.stringValue = input;
  }
}

import { valueWidgets } from './index.js';
Object.assign(valueWidgets, {
  NumberWidget,
  StringWidget,
  IconWidget,
  BooleanWidget,
  LayoutWidget
});
