import {
  Morph, morph, StyleSheet, Text, Icon,
  VerticalLayout,
  GridLayout,
  HorizontalLayout
} from 'lively.morphic';
import { pt, Rectangle, Color, LinearGradient, rect } from 'lively.graphics';
import { signal, once, connect } from 'lively.bindings';
import { obj } from 'lively.lang';

import { Window } from 'lively.components';

import { ColorPalette } from './color-palette.js';
import { FillPopover, colorWidgets } from './style-popover.js';
import { Slider } from 'lively.components/widgets.js';
import { Popover } from 'lively.components/popup.js';

const WHEEL_URL = '/lively.ide/assets/color-wheel.png';

export class ColorPickerField extends Morph {
  static get properties () {
    return {
      gradientEnabled: {
        defaultValue: false,
        after: ['colorValue'],
        set (active) {
          this.setProperty('gradientEnabled', active);
          this.update(this.colorValue);
        }
      },
      fillWidget: {
        serialize: false,
        get () {
          return (this._fillWidget = new FillPopover({
            fillValue: this.colorValue
          }));
        }
      },
      testProp: {
        get () {
          return [42];
        }
      },
      palette: {
        serialize: false,
        get () {
          return this._palette || (this._palette = new Popover({
            position: pt(0, 0),
            name: 'Color Palette',
            targetMorph: new ColorPalette({ color: this.colorValue })
          }));
        }
      },
      colorValue: {
        after: ['submorphs'],
        set (v) {
          if (!(v && (v.isColor || v.isGradient))) {
            v = Color.blue;
          }
          if (!this._updating) return this.update(v);
          this.setProperty('colorValue', v);
        },
        get () {
          return this.getProperty('colorValue') || Color.white;
        }
      },
      master: {
        initialize () {
          this.master = {
            auto: 'styleguide://SystemWidgets/color field'
          };
        }
      },
      submorphs: {
        initialize () {
          const topRight = this.innerBounds().topRight();
          const bottomLeft = this.innerBounds().bottomLeft();
          const colorFieldExtent = pt(40, 25);

          this.submorphs = [
            {
              extent: colorFieldExtent,
              clipMode: 'hidden',
              name: 'paletteButton',
              submorphs: [
                {
                  name: 'topLeft',
                  extent: colorFieldExtent
                },
                {
                  name: 'bottomRight',
                  type: 'polygon',
                  extent: colorFieldExtent,
                  origin: pt(0, 0),
                  vertices: [pt(0, 0), colorFieldExtent.withX(0), colorFieldExtent]
                },
                Icon.makeLabel('chevron-down', {
                  opacity: 0,
                  name: 'dropDownIndicator',
                  center: pt(30, 12.5)
                })
              ]
            },
            {
              fill: Color.transparent,
              extent: pt(25, 25),
              onHoverIn () {
                this.fill = Color.black.withA(0.2);
              },
              onHoverOut () {
                this.fill = Color.transparent;
              },
              submorphs: [
                {
                  name: 'pickerButton',
                  type: 'image',
                  autoResize: false,
                  imageUrl: WHEEL_URL
                }
              ]
            }
          ];
          connect(this.getSubmorphNamed('pickerButton'), 'onMouseDown', this, 'openPicker');
          connect(this.getSubmorphNamed('paletteButton'), 'onMouseDown', this, 'openPalette');
          connect(this, 'remove', this, 'removeWidgets');
          this.colorValue && this.update(this.colorValue);
        }
      }
    };
  }

  get testAttr () {
    return [42];
  }

  spec () {
    return obj.dissoc(super.spec(), ['submorphs']);
  }

  onKeyDown (evt) {
    if (evt.key == 'Escape') {
      this.picker && this.picker.remove();
      this.colorValue.isGradient ? this.fillWidget.remove() : this.palette.remove();
    }
  }

  onHoverIn () {
    this.get('dropDownIndicator').animate({ opacity: 1, duration: 300 });
  }

  onHoverOut () {
    this.get('dropDownIndicator').animate({ opacity: 0, duration: 300 });
  }

  update (color) {
    this._updating = true;
    const pickerButton = this.submorphs[1];
    this.colorValue = color;
    this.get('topLeft').fill = color;
    this.get('bottomRight').fill = color.isGradient ? Color.transparent : color.withA(1);
    pickerButton.visible = pickerButton.isLayoutable = !this.gradientEnabled;
    if (this.gradientEnabled) {
      this.get('bottomRight').width = this.get('topLeft').width = this.submorphs[0].width = this.width;
    } else {
      this.get('bottomRight').width = this.get('topLeft').width = Math.max(1, this.width - pickerButton.width);
    }
    this.get('bottomRight').left = 0;
    this.get('dropDownIndicator').right = this.get('paletteButton').width - 5;
    this._updating = false;
  }

  async openPicker (evt) {
    const p = this.picker || new ColorPicker({ color: this.colorValue });
    p.position = pt(0, -p.height / 2);
    connect(p, 'color', this, 'update');
    this.picker = p.openInWorld();
    this.picker.topLeft = this.globalBounds().bottomCenter();
    this.picker.topLeft = this.world().visibleBounds().translateForInclusion(this.picker.globalBounds()).topLeft();
    this.removePalette();
  }

  removePicker () {
    this.picker && this.picker.remove();
  }

  async openPalette (evt) {
    const p =
      this.gradientEnabled ? this.fillWidget : this.palette;
    this.gradientEnabled ? connect(p, 'fillValue', this, 'update') : connect(p.targetMorph, 'color', this, 'update');
    p.isLayoutable = false;
    await p.openInWorld();
    p.topCenter = this.get('paletteButton').globalBounds().center();
    p.topCenter = this.world().visibleBounds().translateForInclusion(p.globalBounds()).topCenter();
    this.removePicker();
    once(p, 'remove', p, 'topLeft', { converter: () => pt(0, 0), varMapping: { pt } });
  }

  removePalette () {
    this.colorValue.isGradient ? this.fillWidget.remove() : this.palette.remove();
  }

  removeWidgets () {
    this.removePalette();
    this.removePicker();
  }
}

colorWidgets.ColorPickerField = ColorPickerField;

class FieldPicker extends Morph {
  static get properties () {
    return {
      fill: { defaultValue: Color.transparent },
      saturation: { defaultValue: 0 },
      brightness: { defaultValue: 0 },
      draggable: { defaultValue: true },
      pickerPosition: {
        derived: true,
        after: ['submorphs', 'brightness', 'saturation'],
        get () {
          // translate the hsv of color to a position
          const s = this.saturation; const b = this.brightness;
          if (s === undefined || b === undefined) return pt(0, 0);
          return pt(this.getSubmorphNamed('hue').width * s,
            this.getSubmorphNamed('hue').height * (1 - b));
        },
        set ({ x: light, y: dark }) {
          // translate the pos to a new hsv value
          const { width, height } = this.getSubmorphNamed('hue');
          this.saturation = Math.max(0, Math.min(light / width, 1));
          this.brightness = Math.max(0, Math.min(1 - (dark / height), 1));
          signal(this, 'saturation', this.saturation);
          signal(this, 'brightness', this.brightness);
        }
      },
      submorphs: {
        initialize () {
          this.submorphs = [
            {
              borderRadius: 3,
              name: 'hue',
              reactsToPointer: false
            },
            {
              borderRadius: 3,
              name: 'shade',
              reactsToPointer: false,
              fill: new LinearGradient({
                stops: [
                  { color: Color.white, offset: 0 },
                  { color: Color.transparent, offset: 1 }],
                vector: 'eastwest'
              })
            },
            {
              borderRadius: 3,
              name: 'light',
              reactsToPointer: false,
              fill: new LinearGradient({
                stops: [
                  { color: Color.black, offset: 0 },
                  { color: Color.transparent, offset: 1 }],
                vector: 'southnorth'
              })
            },
            {
              name: 'picker',
              type: 'ellipse',
              reactsToPointer: false,
              fill: Color.transparent,
              borderColor: Color.black,
              borderWidth: 3,
              extent: pt(16, 16),
              submorphs: [{
                type: 'ellipse',
                fill: Color.transparent,
                borderColor: Color.white,
                reactsToPointer: false,
                borderWidth: 3,
                center: pt(8, 8),
                extent: pt(12, 12)
              }]
            }];
          connect(this, 'extent', this, 'relayout');
        }
      }
    };
  }

  update (colorPicker) {
    this.getSubmorphNamed('hue').fill = Color.hsb(colorPicker.hue, 1, 1);
    this.brightness = colorPicker.brightness;
    this.saturation = colorPicker.saturation;
    this.get('picker').center = this.pickerPosition;
  }

  onMouseDown (evt) {
    this.pickerPosition = evt.positionIn(this);
    signal(this, 'pickerPosition', this.pickerPosition);
  }

  onDrag (evt) {
    this.pickerPosition = evt.positionIn(this);
  }

  relayout () {
    const bounds = this.innerBounds();
    this.getSubmorphNamed('hue').setBounds(bounds);
    this.getSubmorphNamed('shade').setBounds(bounds);
    this.getSubmorphNamed('light').setBounds(bounds);
  }
}

class ColorPropertyView extends Text {
  static get properties () {
    return {
      update: {},
      value: {
        derived: [true],
        set (v) {
          this.textString = obj.safeToString(v);
        },
        get () {
          return this.textString;
        }
      },
      styleClasses: {
        after: ['readOnly'],
        initialize () {
          this.styleClasses = [!this.readOnly && 'editable', 'value'];
        }
      },
      selectionColor: { defaultValue: Color.gray.darker() }
    };
  }

  onFocus () {
    this.get('keyLabel').styleClasses = ['key', ...!this.readOnly ? ['large', 'active'] : []];
    this.styleClasses = [...!this.readOnly ? ['editable', 'active'] : [], 'value'];
    this.selection.cursorBlinkStart();
  }

  onBlur () {
    this.get('keyLabel').styleClasses = [!this.readOnly && 'large', 'key'];
    this.styleClasses = [!this.readOnly && 'editable', 'value'];
    this.selection.uninstall();
  }

  onKeyDown (evt) {
    if (evt.keyCombo == 'Enter' && !this.readOnly) {
      this.owner.focus();
      evt.stop();
      signal(this, 'updateValue', this.value);
    } else {
      super.onKeyDown(evt);
    }
  }
}

class HuePicker extends Morph {
  static get properties () {
    return {
      fill: {
        defaultValue: new LinearGradient({
          stops: [{ color: Color.rgb(255, 0, 0), offset: 0 },
            { color: Color.rgb(255, 255, 0), offset: 0.17 },
            { color: Color.limeGreen, offset: 0.33 },
            { color: Color.cyan, offset: 0.50 },
            { color: Color.blue, offset: 0.66 },
            { color: Color.magenta, offset: 0.83 },
            { color: Color.rgb(255, 0, 0), offset: 1 }],
          vector: 'northsouth'
        })
      },
      borderRadius: { defaultValue: 3 },
      hue: { defaultValue: 0 },
      sliderPosition: {
        derived: true,
        after: ['submorphs'],
        get () {
          return pt(this.width / 2, this.height * (this.hue / 360));
        },
        set (pos) {
          this.hue = Math.max(0, Math.min((pos.y / this.height) * 360, 359));
          signal(this, 'hue', this.hue);
        }
      },
      submorphs: {
        initialize () {
          this.submorphs = [{
            name: 'slider',
            height: 10,
            width: 50,
            borderRadius: 3,
            reactsToPointer: false,
            nativeCursor: 'ns-resize',
            borderColor: Color.black,
            fill: Color.transparent,
            borderWidth: 2
          }];
        }
      }
    };
  }

  onMouseDown (evt) {
    this.sliderPosition = pt(0, evt.positionIn(this).y);
  }

  onDrag (evt) {
    this.sliderPosition = pt(0, evt.positionIn(this).y);
  }

  update (colorPicker) {
    this.hue = colorPicker.hue;
    this.get('slider').center = this.sliderPosition;
  }
}

class ColorDetails extends Morph {
  static get properties () {
    return {
      color: { defaultValue: Color.blue },
      width: { defaultValue: 80 },
      fill: { defaultValue: Color.transparent },
      layout: {
        initialize () { this.layout = new VerticalLayout({ spacing: 9, layoutOrder (m) { return this.container.submorphs.indexOf(m); } }); }
      },
      submorphs: {
        after: ['color'],
        initialize () {
          this.submorphs = [{
            type: 'ellipse',
            extent: pt(50, 50),
            name: 'colorViewer',
            fill: this.color
          },
          this.hashViewer(),
          {
            type: 'label',
            name: 'R',
            autofit: true,
            padding: rect(10, 0, 0, 0),
            styleClasses: ['ColorPropertyView']
          }];
          this.update(this);
        }
      }
    };
  }

  update ({ color }) {
    const [r, g, b] = color.toTuple8Bit();
    const [h, s, v] = color.toHSB();
    const hashViewer = this.get('hashViewer');
    this.get('colorViewer').fill = color;
    hashViewer.replace(hashViewer.documentRange, color.toHexString(), false, false);
    this.get('R').value = `R ${r.toFixed(0)}\n\nG ${g.toFixed(0)}\n\nB ${b.toFixed(0)}\n\nH ${h.toFixed(0)}\n\nS ${s.toFixed(2)}\n\nV ${v.toFixed(2)}`;
  }

  onHashViewerChanged (hexString) {
    const color = Color.rgbHex(hexString);
    this.owner.owner.color = color;
  }

  keyValue ({ name, key, value, update, editable }) {
    return new Morph({
      fill: Color.transparent,
      layout: new HorizontalLayout({ spacing: 5 }),
      submorphs: [
        { type: 'label', name: 'keyLabel', styleClasses: [editable && 'large', 'key'], value: key },
        new ColorPropertyView({ name: name || key, readOnly: !editable, value, update })]
    });
  }

  hashViewer () {
    const hashViewer = this.keyValue({
      name: 'hashViewer',
      key: '#',
      editable: true,
      value: this.color.toHexString()
    });
    connect(hashViewer.get('hashViewer'), 'updateValue', this, 'onHashViewerChanged');
    return hashViewer;
  }

  rgbViewer () {
    const [r, g, b] = this.color.toTuple8Bit();
    return new Morph({
      name: 'rgbViewer',
      fill: Color.transparent,
      submorphs: [this.keyValue({ key: 'R', value: r.toFixed() }),
        this.keyValue({ key: 'G', value: g.toFixed() }),
        this.keyValue({ key: 'B', value: b.toFixed() })]
    });
  }

  hsbViewer () {
    const [h, s, b] = this.color.toHSB();
    return new Morph({
      name: 'hsbViewer',
      fill: Color.transparent,
      submorphs: [this.keyValue({ key: 'H', value: h.toFixed() }),
        this.keyValue({ key: 'S', value: s.toFixed(2) }),
        this.keyValue({ key: 'V', value: b.toFixed(2) })]
    });
  }
}

export class ColorPicker extends Window {
  static get properties () {
    return {
      extent: { defaultValue: pt(400, 320) },
      fill: { defaultValue: Color.black.withA(0.7) },
      isHaloItem: { defaultValue: true },
      borderWidth: { defaultValue: 0 },
      hasFixedPosition: { defaultValue: true },
      color: {
        defaultValue: Color.blue,
        derived: true,
        before: ['submorphs', 'targetMorph'],
        get () { return Color.hsb(this.hue, this.saturation, this.brightness).withA(this.alpha); },
        set (c) {
          const [h, s, b] = c.toHSB();
          this.hue = h;
          this.saturation = s;
          this.brightness = b;
          this.alpha = c.a;
        }
      },
      alpha: {
        set (a) {
          this.setProperty('alpha', a);
          this.update();
        }
      },
      saturation: {

      },
      brightness: {
        set (b) {
          this.setProperty('brightness', b);
          this.update();
        }
      },
      hue: {
        set (h) {
          this.setProperty('hue', h);
          this.update();
        }
      },
      targetMorph: {
        initialize () {
          this.targetMorph = this.colorPalette();
          this.ui.windowTitle.fontColor = Color.gray;
          this.ui.header.fill = Color.transparent;
          this.whenRendered().then(() => {
            this.fill = Color.black.withA(0.7);
            this.update();
          });
        }
      }
    };
  }

  onKeyDown (evt) {
    if (evt.key == 'Escape') {
      this.close();
    }
  }

  close () {
    super.close();
    signal(this, 'close');
  }

  update () {
    if (this.submorphs.length == 0) return;
    this.get('header').fill = Color.transparent; // hack
    this.get('field picker').update(this);
    this.get('hue picker').update(this);
    this.get('details').update(this);
    this.get('alpha slider').update(this.alpha);
    // would be better if this.color is the canonical place
    // rms: as long as lively.graphics/color loses the hue information
    //      when lightness or saturation drop to 0, this.color can not serve
    //      as the canonical place but only as a getter for the morph that retrieves
    //      the picker's color.
    signal(this, 'color', this.color);
  }

  colorPalette () {
    const colorDetails = this.colorDetails();
    const fieldPicker = this.fieldPicker();
    const huePicker = this.huePicker();
    const alphaSlider = this.alphaSlider();
    const colorPalette = new Morph({
      master: {
        auto: 'styleguide://SystemWidgets/color picker'
      },
      name: 'colorPalette',
      width: this.width,
      submorphs: [fieldPicker, huePicker, colorDetails, alphaSlider]
    });
    connect(fieldPicker, 'brightness', this, 'brightness');
    connect(fieldPicker, 'saturation', this, 'saturation');
    connect(huePicker, 'hue', this, 'hue');
    return colorPalette;
  }

  alphaSlider () {
    let slider;
    const m = morph({
      name: 'alphaSlider',
      fill: Color.transparent,
      layout: new HorizontalLayout({ spacing: 3 }),
      submorphs: [
        {
          type: 'label',
          padding: Rectangle.inset(3),
          value: 'Alpha',
          fontColor: Color.gray,
          fontWeight: 'bold'
        },
        slider = new Slider({
          name: 'alpha slider',
          value: this.alpha,
          min: 0,
          max: 1,
          width: 170
        })
      ]
    });
    connect(slider, 'value', this, 'alpha');
    return m;
  }

  fieldPicker () {
    return new FieldPicker({
      name: 'field picker',
      saturation: this.saturation,
      brightness: this.brightness
    });
  }

  huePicker () {
    return new HuePicker({ name: 'hue picker', hue: this.hue });
  }

  colorDetails () {
    return new ColorDetails({ name: 'details', color: this.color });
  }
}
