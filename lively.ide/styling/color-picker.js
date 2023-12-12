import { HTMLMorph, ViewModel, part } from 'lively.morphic';
import {
  pt, RadialGradient, webSafeColors, flatDesignColors,
  materialDesignColors, Color, LinearGradient, rect
} from 'lively.graphics';
import { signal, noUpdate, connect } from 'lively.bindings';
import { string, arr, num } from 'lively.lang';
import { delay } from 'lively.lang/promise.js';
import { guardNamed } from 'lively.lang/function.js';

const WHEEL_URL = '/lively.ide/assets/color-wheel.png';

export class ColorInputModel extends ViewModel {
  static get properties () {
    return {
      targetMorph: {},
      colorPickerComponent: {
        isComponent: true
      },
      gradientEnabled: {
        defaultValue: false,
        after: ['colorValue']
      },
      activeColor: {
        isStyleProp: true,
        defaultValue: Color.gray.withA(.5)
      },
      colorValue: {
        set (v) {
          if (!(v && (v.isColor || v.isGradient))) {
            v = Color.blue;
          }
          this.setProperty('colorValue', v);
        },
        get () {
          return this.getProperty('colorValue') || Color.white;
        }
      },
      expose: {
        get () {
          return ['setColor', 'colorValue', 'setMixed'];
        }
      },
      bindings: {
        get () {
          return [
            { target: 'hex input', signal: 'inputAccepted', handler: 'onHexChanged' },
            { target: 'opacity input', signal: 'number', handler: 'onOpacityChanged' },
            { target: 'color cell', signal: 'onMouseDown', handler: 'openColorPicker' }
          ];
        }
      }
    };
  }

  __additionally_serialize__ (snapshot, ref, pool, addFn) {
    if (this.colorPickerComponent) {
      const expr = this.colorPickerComponent[Symbol.for('lively-module-meta')];
      addFn('colorPickerComponent', pool.expressionSerializer.exprStringEncode({
        __expr__: expr.export,
        bindings: { [expr.module]: expr.export }
      }));
    }
  }

  get isMixed () {
    const { hexInput, opacityInput } = this.ui;
    return opacityInput.isMixed || hexInput.input === 'Mix';
  }

  setMixed (colors) {
    const { hexInput, opacityInput, gradient } = this.ui;
    // if opacity varies, then set that to mixed
    if (arr.uniq(colors.map(c => c.a)).length > 1) opacityInput.setMixed();
    if (arr.uniq(colors.map(c => c.toHexString())).length > 1) {
      hexInput.value = 'Mix';
      gradient.visible = true;
      // generate a gradient of all the different colors...
      gradient.fill = new LinearGradient({
        stops: colors.map((color, i) => ({
          offset: i / colors.length,
          color
        }))
      });
    }
    this.colorValue = colors[0]; // just pick the first one
  }

  setColor (color) {
    this.colorValue = color;
    this.update();
    this.confirm();
  }

  attach (view) {
    super.attach(view);
    this.update();
  }

  update (control) {
    const color = this.colorValue;
    const { hexInput, opacityInput, gradientName, opaque, transparent, gradient } = this.ui;
    gradient.visible = !!color.isGradient;
    opacityInput.visible = hexInput.visible = !color.isGradient;
    gradientName.visible = !!color.isGradient;
    if (!color.isGradient) {
      if (hexInput !== control) hexInput.input = color.toHexString().toUpperCase();
      if (opacityInput !== control) opacityInput.number = color.a; // do not confirm this
      opaque.fill = color.withA(1);
      transparent.fill = color;
    } else {
      gradient.fill = color;
      if (color.type === 'radialGradient') gradient.fill = new RadialGradient({ ...color, bounds: color.bounds.scaleRectTo(rect(0, 0, 22, 22)) });
      gradientName.textString = string.capitalize(color.type.replace('Gradient', ''));
    }
  }

  closeColorPicker () {
    if (this.picker) {
      this.picker.remove();
      this.picker = null;
      this.onPickerClosed();
    }
  }

  async openColorPicker () {
    let ColorPicker = this.colorPickerComponent;
    if (!ColorPicker) ({ ColorPicker } = await System.import('lively.ide/styling/color-picker.cp.js'));
    const p = part(ColorPicker);
    let color = this.colorValue;
    p.solidOnly = !this.gradientEnabled;
    p.hasFixedPosition = true;
    if (this.targetMorph) p.focusOnMorph(this.targetMorph, color);
    else p.withColor(color);
    p.toggleHalos(false);
    p.position = pt(0, -p.height / 2);
    p.switchMode(color.isGradient ? color.type : 'Solid');
    connect(p, 'value', this, 'setColor');
    connect(p, 'close', this, 'onPickerClosed');
    connect(p, 'closeWithClick', this, 'onPickerClosedWithClick');

    this.view.fill = this.activeColor;
    this.picker = p.openInWorld();
    // this two step alignment is the simplest way to make the picker find its optimal position
    this.picker.topRight = this.view.globalBounds().topLeft();
    this.picker.topLeft = this.world().visibleBounds().insetBy(10).translateForInclusion(this.picker.globalBounds()).topLeft();
  }

  onPickerClosedWithClick () {
    this.onPickerClosed();
  }

  onPickerClosed () {
    this.view.fill = Color.transparent;
  }

  onHexChanged () {
    this.confirm();
    this.update(this.ui.hexInput);
  }

  onOpacityChanged () {
    this.confirm();
    this.update(this.ui.opacityInput);
  }

  confirm () {
    const { hexInput, opacityInput, gradientName } = this.ui;
    const currentColor = this.isMixed ? this.colorValue : Color.rgbHex(hexInput.input);
    if (!gradientName.visible) this.colorValue = currentColor.withA(opacityInput.number);
    signal(this, 'color', this.colorValue);
  }
}

export class ColorPaletteView extends HTMLMorph {
  test () {
    this.showPalette(materialDesignColors.map(c => {
      return Color.rgbHex(c);
    }));
  }

  selectPalette (paletteName) {
    const nameToPalette = {
      'Flat Design': flatDesignColors,
      Material: materialDesignColors,
      'Web Safe': webSafeColors
    };
    nameToPalette[paletteName] && this.showPalette(nameToPalette[paletteName].map(c => {
      return Color.rgbHex(c);
    }));
  }

  onMouseDown (evt) {
    super.onMouseDown(evt);
    const { color } = evt.domEvt.target.dataset;
    if (!color) return;
    signal(this, 'colorSelected', Color.fromString(color));
  }

  showPalette (colors) {
    this.withMetaDo({ metaInteraction: true }, () => {
      this.html = `<div class="palette-container">
      ${
        colors.map(c => {
            return `<div class="color-cell" data-color="${c}" style="background: ${c}"></div>`;
          }).join('\n')
      }
    </div>`;
    });
  }
}

/*****************
 *  VIEW MODELS  *
 *****************/

export class ColorPickerModel extends ViewModel {
  static get properties () {
    return {
      isHaloItem: { defaultValue: true },
      colorMode: {},
      context: {
        serialize: false,
        get () {
          return this._target && (this._target._context || this._target.world());
        }
      },
      hsb: {
        initialize () {
          this.hsb = [...Color.red.toHSB(), 1];
        }
      },
      gradientValue: {
        derived: true,
        get () {
          const gc = this.models.gradientControl;
          return gc.deref(gc.gradientValue);
        },
        set (v) {
          this.models.gradientControl.gradientValue = v;
        }
      },
      color: {
        derived: true,
        get () {
          return Color.hsb(...this.hsb.slice(0, 3)).withA(this.hsb[3]);
        },
        set (c) {
          this.hsb = [...c.toHSB(), c.a];
        }
      },
      solidOnly: {
        derived: true,
        set (active) {
          const { colorTypeSelector, title } = this.ui;
          if (active) colorTypeSelector.selection = 'Solid';
          colorTypeSelector.visible = !active;
          if (active) { title.visible = true; title.textString = 'Color'; }
        }
      },
      allControls: {
        derived: true,
        get () {
          const {
            colorEncoding, opacityPicker,
            shadePicker, huePicker, gradientControl
          } = this.models;
          return [
            colorEncoding, opacityPicker,
            shadePicker, huePicker, gradientControl
          ];
        }
      },
      expose: {
        get () {
          return ['solidOnly', 'focusOnMorph', 'toggleHalos', 'isHaloItem', 'close', 'isPropertiesPanelPopup', 'isColorPicker', 'withColor', 'switchMode', 'value', 'closeWithClick'];
        }
      },
      bindings: {
        get () {
          return [
            { model: 'color type selector', signal: 'selection', handler: 'switchMode' },
            { model: 'color palette selector', signal: 'selection', handler: 'switchPalette' },
            { target: 'color palette view', signal: 'colorSelected', handler: 'adjustColor' },
            { model: 'gradient control', signal: 'gradientChanged', handler: 'adjustGradient' },
            { model: 'gradient control', signal: 'switchColor', handler: 'adjustColor' },
            { model: 'color encoding', signal: 'colorEntered', handler: 'enterColor' },
            { model: 'hue picker', signal: 'hueChanged', handler: 'adjustHue' },
            { model: 'opacity picker', signal: 'opacityChanged', handler: 'adjustOpacity' },
            { model: 'shade picker', signal: 'shadeChanged', handler: 'adjustShade' },
            { target: 'close button', signal: 'onMouseUp', handler: 'closeWithClick' },
            { target: 'eye dropper button', signal: 'onMouseDown', handler: 'triggerEyeDropper' }
          ];
        }
      }
    };
  }

  get isPropertiesPanelPopup () {
    return true;
  }

  get isColorPicker () {
    return true;
  }
  // no onRefresh needed? it is needed. When we switch the mode, we need to update the selector...

  async triggerEyeDropper () {
    const chosenColor = await new window.EyeDropper().open();
    this.withColor(Color.fromString(chosenColor.sRGBHex));
  }

  toggleHalos (active) {
    this.view.withAllSubmorphsDo(m => m.halosEnabled = active);
    // this.ui.gradientControl.gradientHalo.withAllSubmorphsDo(m => m.halosEnabled = active);
  }

  // used when a morph reference is not sensible
  withColor (color) {
    if (color.isGradient) {
      this.models.gradientControl.setGradient(color, this);
      this.models.colorTypeSelector.selection = color.type;
    } else {
      this.color = color;
      this.ui.colorTypeSelector.selection = 'Solid'; // triggers a confirm...
    }
    this.switchPalette('Material');
    this.update();
  }

  focusOnMorph (aMorph, color) {
    this._target = aMorph;
    const { context } = this;
    if (context) {
      if (!color.isColor) noUpdate(() => context.halos().forEach(m => m.remove()));
      context.withTopBarDo(topBar => {
        topBar.setEditMode('Hand', true, true);
      });
    }
    this.withColor(color);
  }

  close () {
    this.view.remove();
    const { context } = this;
    if (context) context.withTopBarDo(topBar => topBar.setEditMode(topBar.view.recoverMode, true));
    this.ui.gradientControl.toggle(false, this);
  }

  closeWithClick () {
    signal(this.view,  'closeWithClick');
    noUpdate(() => this.close());
  }

  confirm () {
    switch (this.colorMode) {
      case 'linearGradient':
      case 'radialGradient':
        signal(this, 'value', this.gradientValue);
        signal(this.view, 'value', this.gradientValue);
        break;
      case 'Solid':
        signal(this, 'value', this.color);
        signal(this.view, 'value', this.color);
    }
  }

  switchPalette (palette) {
    this.ui.colorPaletteView.selectPalette(palette);
  }

  switchMode (newMode) {
    const isGradient = ['linearGradient', 'radialGradient'].includes(newMode);
    if (isGradient) noUpdate(() => this.context.halos().forEach(m => m.remove()));
    else {
      if (this._target) { noUpdate(() => $world.showHaloFor(this._target)); }
    }
    this.ui.gradientControl.toggle(isGradient, this);
    this.colorMode = newMode;
    this.update();
    this.confirm();
  }

  enterColor (c) {
    // store color as hue sat brt alpha
    this.color = c;
    this.update(this.models.colorEncoding);
    this.confirm();
  }

  adjustColor (c) {
    this.color = c;
    this.update();
    this.confirm();
  }

  adjustOpacity (a) {
    this.hsb = [...this.hsb.slice(0, 3), a];
    // this.color = this.color.withA(a);
    this.update(this.models.opacityPicker);
    this.confirm();
  }

  adjustHue (hue) {
    // const [_, sat, brt] = this.color.toHSB();
    // this.color = Color.hsb(hue, sat, brt).withA(this.color.a);
    this.hsb = [hue, ...this.hsb.slice(1)];
    this.update(this.models.huePicker);
    this.confirm();
  }

  adjustShade ([brt, sat]) {
    // const [hue] = this.color.toHSB();
    // this.color = Color.hsb(hue, sat, brt).withA(this.color.a);
    this.hsb = [this.hsb[0], sat, brt, this.hsb[3]];
    this.update(this.models.shadePicker);
    this.confirm();
  }

  adjustGradient (gradientValue) {
    this.confirm();
  }

  update (...toSkip) {
    arr.withoutAll(this.allControls, [...toSkip]).forEach(m => m.update(this));
  }

  viewDidLoad () {
    const { eyeDropperButton } = this.ui;
    // EyeDropper API is currently not supported in all browsers (missing in FF)
    if (!window.EyeDropper) eyeDropperButton.visible = eyeDropperButton.isLayoutable = false;
  }
}

export class ColorEncoderModel extends ViewModel {
  static get properties () {
    return {
      encodingMode: {
        type: 'Enum',
        defaultValue: 'HEX',
        values: ['HEX', 'RGB', 'HSL', 'HSB', 'CSS']
      },
      currentColor: {
        defaultValue: [...Color.white.toHSB(), 1]
      },
      bindings: {
        get () {
          const numberWidgets = [
            'opacity control', 'first value', 'second value',
            'third value', 'hex opacity control'
          ];
          return [
            {
              model: 'color code selector', signal: 'selection', handler: 'selectEncoding'
            },
            {
              target: 'hex input', signal: 'inputAccepted', handler: 'confirm'
            },
            {
              target: 'css input', signal: 'inputAccepted', handler: 'confirm'
            },
            ...numberWidgets.map(target => ({
              target, signal: 'number', handler: 'confirm'
            })),
            {
              target: 'color copier', signal: 'onMouseDown', handler: 'copyColor'
            }];
        }
      }
    };
  }

  copyColor () {
    guardNamed('copying', async () => {
      const originalFontColor = this.ui.colorCopier.fontColor;
      const currentColor = Color.hsb(this.currentColor[0], this.currentColor[1], this.currentColor[2]).withA(this.currentColor[3]);
      navigator.clipboard.writeText(currentColor.__serialize__().__expr__);
      await this.ui.colorCopier.animate({
        fontColor: Color.green,
        duration: 500
      })
        .then(() => delay(2000))
        .then(() => this.ui.colorCopier.animate({
          fontColor: originalFontColor,
          duration: 500
        }));
    })();
  }

  update (colorPicker) {
    this.currentColor = colorPicker.hsb;
    this.refresh();
  }

  refresh () {
    const color = this.currentColor;
    noUpdate(() => {
      ({
        HEX: () => this.updateHex(color),
        RGB: () => this.updateRGB(color),
        HSL: () => this.updateHSL(color),
        HSB: () => this.updateHSB(color),
        CSS: () => this.updateCSS(color)
      })[this.encodingMode]();
    });
  }

  updateHex (color) {
    color = Color.hsb(...color).withA(num.roundTo(color[3], 0.01));
    const hexInput = this.ui.hexInput;
    const hexOpacity = this.ui.hexOpacityControl;
    hexInput.input = color.toHexString().toUpperCase();
    hexOpacity.number = color.a;
  }

  updateRGB (color) {
    const rInput = this.ui.firstValue;
    const gInput = this.ui.secondValue;
    const bInput = this.ui.thirdValue;
    const aInput = this.ui.opacityControl;
    const [r, g, b] = Color.hsb(...color).toTuple();
    const a = color[3];
    rInput.number = r * 255;
    gInput.number = g * 255;
    bInput.number = b * 255;
    aInput.number = a;
  }

  updateHSL (color, hsl = true) {
    const hInput = this.ui.firstValue;
    const sInput = this.ui.secondValue;
    const lInput = this.ui.thirdValue;
    const aInput = this.ui.opacityControl;
    const [h, s, b] = color;
    if (hsl) lInput.number = 1 - b;
    else lInput.number = b;
    hInput.number = h;
    sInput.number = s;
    aInput.number = color[3];
  }

  updateHSB (color) {
    this.updateHSL(color, false);
  }

  updateCSS (color) {
    const { cssInput } = this.ui;
    color = Color.hsb(...color).withA(num.roundTo(color[3], 0.01));
    cssInput.input = color.toCSSString();
  }

  confirm () {
    ({
      HEX: () => this.confirmHex(),
      RGB: () => this.confirmRGB(),
      HSL: () => this.confirmHSL(),
      HSB: () => this.confirmHSB(),
      CSS: () => this.confirmCSS()
    })[this.encodingMode]();
  }

  confirmHex () {
    const hexInput = this.ui.hexInput;
    const hexOpacity = this.ui.hexOpacityControl;
    const c = Color.rgbHex(hexInput.input).withA(hexOpacity.number);
    this.currentColor = [...c.toHSB(), c.a];
    signal(this, 'colorEntered', c);
  }

  confirmRGB () {
    const rInput = this.ui.firstValue;
    const gInput = this.ui.secondValue;
    const bInput = this.ui.thirdValue;
    const aInput = this.ui.opacityControl;
    const c = Color.rgba(rInput.number, gInput.number, bInput.number, aInput.number);
    this.currentColor = [...c.toHSB(), c.a];
    signal(this, 'colorEntered', c);
  }

  confirmHSL () {
    const hInput = this.ui.firstValue;
    const sInput = this.ui.secondValue;
    const lInput = this.ui.thirdValue;
    const aInput = this.ui.opacityControl;
    const c = Color.hsb(hInput.number, sInput.number, 1 - lInput.number).withA(aInput.number);
    this.currentColor = [...c.toHSB(), c.a];
    signal(this, 'colorEntered', c);
  }

  confirmHSB () {
    const hInput = this.ui.firstValue;
    const sInput = this.ui.secondValue;
    const bInput = this.ui.thirdValue;
    const aInput = this.ui.opacityControl;
    const c = Color.hsb(hInput.number, sInput.number, bInput.number).withA(aInput.number);
    this.currentColor = [...c.toHSB(), c.a];
    signal(this, 'colorEntered', c);
  }

  confirmCSS () {
    const cssInput = this.ui.cssInput;
    const c = Color.fromString(cssInput.input);
    this.currentColor = [...c.toHSB(), c.a];
    signal(this, 'colorEntered', c);
  }

  selectEncoding (encodingName) {
    const nameToUI = {
      HEX: 'hexEncoding',
      RGB: '3ValEncoding',
      HSL: '3ValEncoding',
      HSB: '3ValEncoding',
      CSS: 'cssEncoding'
    };
    this.encodingMode = encodingName;
    this.ui.controls.submorphs.map(m => m.visible = m.isLayoutable = false);
    const control = this.ui[nameToUI[encodingName]];
    control.visible = control.isLayoutable = true;
    if (encodingName === 'RGB') {
      [
        control.getSubmorphNamed('first value'),
        control.getSubmorphNamed('second value'),
        control.getSubmorphNamed('third value')
      ].forEach(aNumberInput => {
        Object.assign(aNumberInput, {
          min: 0, max: 255, scaleFactor: 1
        });
      });
    }
    if (['HSL', 'HSB'].includes(encodingName)) {
      Object.assign(control.getSubmorphNamed('first value'), {
        min: 0, max: 360, scaleFactor: 1
      });
      [
        control.getSubmorphNamed('second value'),
        control.getSubmorphNamed('third value')
      ].forEach(aNumberInput => {
        Object.assign(aNumberInput, {
          min: 0, max: 1, scaleFactor: 100
        });
      });
    }
    this.refresh();
  }
}

export class FieldPickerModel extends ViewModel {
  static get properties () {
    return {
      saturation: { defaultValue: 0 },
      brightness: { defaultValue: 0 },
      pickerPosition: {
        derived: true,
        after: ['brightness', 'saturation'],
        get () {
          // translate the hsv of color to a position
          const { width, height } = this.view;
          const s = this.saturation; const b = this.brightness;
          if (s === undefined || b === undefined) return pt(0, 0);
          return pt(width * s, height * (1 - b));
        },
        set ({ x: light, y: dark }) {
          // translate the pos to a new hsv value
          const { width, height } = this.view;
          this.saturation = num.clamp(light / width, 0, 1);
          this.brightness = num.clamp(1 - (dark / height), 0, 1);
        }
      },
      bindings: {
        get () {
          return [
            { signal: 'extent', handler: 'relayout' },
            { signal: 'onDrag', handler: 'onDrag', override: true },
            { signal: 'onMouseDown', handler: 'onMouseDown', override: true }
          ];
        }
      }
    };
  }

  onRefresh (changedProp) {
    this.ui.picker.center = this.pickerPosition;
  }

  relayout () {
    const { hue, shade, light } = this.ui;
    const bounds = this.view.innerBounds();
    hue.setBounds(bounds);
    shade.setBounds(bounds);
    light.setBounds(bounds);
  }

  confirm () {
    signal(this, 'shadeChanged', [this.brightness, this.saturation]);
  }

  update (colorPicker) {
    const [hue, srt, brt] = colorPicker.color.toHSB();
    this.ui.hue.fill = Color.hsb(hue, 1, 1);
    this.brightness = brt;
    this.saturation = srt;
  }

  onMouseDown ($onMouseDown, evt) {
    this.pickerPosition = evt.positionIn(this.view);
    this.confirm();
  }

  onDrag ($onDrag, evt) {
    this.pickerPosition = evt.positionIn(this.view);
    this.confirm();
  }
}

class AbstractSlider extends ViewModel {
  static get properties () {
    return {
      alpha: { defaultValue: 1 },
      sliderPosition: {
        // to be defined by subclass
      },
      bindings: {
        get () {
          return [
            { signal: 'onMouseDown', handler: 'onMouseDown', override: true },
            { signal: 'onDrag', handler: 'onDrag', override: true }
          ];
        }
      }
    };
  }

  confirm () {
    // signal that the user entered a value
  }

  onMouseDown ($onMouseDown, evt) {
    const sliderWidth = this.ui.slider.width;
    this.sliderPosition = pt(evt.positionIn(this.view).x - sliderWidth / 2, 0);
    this.confirm();
  }

  onDrag ($onDrag, evt) {
    const sliderWidth = this.ui.slider.width;
    this.sliderPosition = pt(evt.positionIn(this.view).x - sliderWidth / 2, 0);
    this.confirm();
  }

  update (colorPicker) {
    // do custom updates based on the role of the slider
  }

  onRefresh (prop) {
    this.ui.slider.center = this.sliderPosition;
  }
}

export class OpacityPickerModel extends AbstractSlider {
  static get properties () {
    return {
      alpha: { defaultValue: 1 },
      sliderPosition: {
        derived: true,
        get () {
          const view = this.view;
          const w = view.width - 10;
          return pt(5 + w * this.alpha, view.height / 2);
        },
        set (pos) {
          if (!this.view) return;
          const view = this.view;
          const w = view.width - 10;
          this.alpha = num.clamp(pos.x / w, 0, 1);
        }
      }
    };
  }

  confirm () {
    signal(this, 'opacityChanged', this.alpha);
  }

  update (colorPicker) {
    // properly set the gradient...
    this.ui.opacityGradient.fill = new LinearGradient({
      vector: 'eastwest',
      stops: [
        { offset: 0, color: colorPicker.color.withA(0) },
        { offset: 1, color: colorPicker.color.withA(1) }
      ]
    });
    this.alpha = colorPicker.color.a;
  }
}

export class HuePickerModel extends AbstractSlider {
  static get properties () {
    return {
      hue: { defaultValue: 0 },
      sliderPosition: {
        derived: true,
        get () {
          const view = this.view;
          const w = view.width - 10;
          return pt(5 + w * (this.hue / 360), view.height / 2);
        },
        set (pos) {
          if (!this.view) return;
          const view = this.view;
          const w = view.width - 10;
          this.hue = Math.max(0, Math.min((pos.x / w) * 360, 359));
        }
      }
    };
  }

  confirm () {
    signal(this, 'hueChanged', this.hue);
  }

  update (colorPicker) {
    this.hue = colorPicker.hsb[0];
  }
}
