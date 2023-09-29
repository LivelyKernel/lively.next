import { TilingLayout, without, Icon, Morph, ShadowObject, Label, component, add, ViewModel, part } from 'lively.morphic';
import { Color, Point, rect, Rectangle, pt } from 'lively.graphics';
import { PropertyLabel, PropertyLabelLight, PropertyLabelActiveLight, PropertyLabelHoveredLight, PropLabel, AddButton, DarkNumberIconWidget, DarkPopupWindow, DarkThemeList, EnumSelector, PropertyLabelActive, PropertyLabelHovered } from '../shared.cp.js';
import { ColorInput } from '../../styling/color-picker.cp.js';
import { num, string, arr } from 'lively.lang';
import { signal } from 'lively.bindings';
import { DarkColorPicker } from '../dark-color-picker.cp.js';
import { PopupWindow } from '../../styling/shared.cp.js';
import { InputLineDefault } from 'lively.components/inputs.cp.js';
import { DefaultNumberWidget, DarkNumberWidget } from '../../value-widgets.cp.js';
import { LabeledCheckbox } from 'lively.components';

export class PopupModel extends ViewModel {
  static get properties () {
    return {
      liveStyleClasses: {
        defaultValues: ['Popup']
      },
      bindings: {
        get () {
          return [{ target: 'close button', signal: 'onMouseDown', handler: 'close' }];
        }
      },
      expose: { get () { return ['close']; } }
    };
  }

  alignAtButton (btn) {
    // FIXME: Hack that is necessary due to the fact that otherwise,
    // a wrong initial extent propagates through the layout computation leading to a visible hickup.
    this.view.height = 25;
    this.view.topRight = btn.globalBounds().bottomRight().addXY(0, 5);
    this.view.topLeft = this.world().visibleBounds().translateForInclusion(this.view.globalBounds()).topLeft();
  }

  close () {
    this.view.remove();
  }
}

export class ShadowPopupModel extends PopupModel {
  static get properties () {
    return {
      fastShadow: { defaultValue: false },
      insetShadow: { defaultValue: false },
      isHaloItem: { defaultValue: true },
      shadowValue: {
        initialize () {
          this.shadowValue = new ShadowObject({});
        }
      },
      expose: { get () { return ['isHaloItem', 'isPropertiesPanelPopup', 'close']; } },
      bindings: {
        get () {
          return [
            { target: 'close button', signal: 'onMouseDown', handler: 'close' },
            { target: 'fast shadow checkbox', signal: 'checked', handler: 'toggleFastShadow' },
            { target: 'x offset', signal: 'number', handler: 'confirm' },
            { target: 'y offset', signal: 'number', handler: 'confirm' },
            { target: 'blur input', signal: 'number', handler: 'confirm' },
            { target: 'spread input', signal: 'number', handler: 'confirm' },
            { model: 'shadow color input', signal: 'color', handler: 'confirm' }
          ];
        }
      }
    };
  }

  get isPropertiesPanelPopup () {
    return true;
  }

  attach (view) {
    super.attach(view);
    this.update();
  }

  onRefresh (prop) {
    if (!this.view) return;
    if (prop === 'fastShadow') this.update();
    if (prop === 'insetShadow') this.update();
  }

  /**
   * Initializes the shadow popup from an initial shadow value.
   */
  initFrom (shadowValue) {
    if (shadowValue) this.fastShadow = shadowValue.fast;
    this.shadowValue = shadowValue;
    this.update();
  }

  /**
   * Toggles wether or not the shadow should be rendered behind
   * transparent areas (slow) or not (fast)
   */
  toggleFastShadow () {
    this.fastShadow = !this.fastShadow;
    this.confirm();
  }

  /**
   * Refresh the UI to reflect the currently stored shadow value.
   */
  update () {
    this.withoutBindingsDo(() => {
      const {
        fastShadowCheckbox, spreadInput,
        blurInput, xOffset, yOffset, buffer,
        shadowColorInput, title, footer
      } = this.ui;

      fastShadowCheckbox.checked = this.fastShadow;

      const p = Point.polar(this.shadowValue.distance, num.toRadians(this.shadowValue.rotation));
      xOffset.number = p.x;
      yOffset.number = p.y;
      spreadInput.number = this.shadowValue.spread;
      blurInput.number = this.shadowValue.blur;
      shadowColorInput.setColor(this.shadowValue.color);

      title.textString = this.insetShadow ? 'Inner Shadow' : 'Drop Shadow';
      footer.visible = !this.insetShadow;
      buffer.height = !this.insetShadow ? 10 : 20;
    });
  }

  /**
   * Update the current shadow value based on the inputs in the UI.
   * This is invoked in response to user interactions.
   */
  confirm () {
    const { shadowColorInput, spreadInput, blurInput, xOffset, yOffset } = this.ui;
    const polar = pt(xOffset.number, yOffset.number);
    const distance = polar.r();
    const rotation = num.toDegrees(polar.theta()) % 360;
    this.shadowValue = new ShadowObject({
      fast: this.fastShadow,
      inset: this.insetShadow,
      color: shadowColorInput.colorValue,
      blur: blurInput.number,
      spread: spreadInput.number,
      distance,
      rotation
    });
    signal(this, 'value', this.shadowValue);
  }
}

/**
  General control for all properties that can be configured
  by a single number input such as opacity or blur.
*/
export class SingleNumberModel extends PopupModel {
  static get properties () {
    return {
      value: {},
      isHaloItem: { defaultValue: true },
      expose: { get () { return ['isHaloItem', 'value', 'isPropertiesPanelPopup', 'close']; } },
      bindings: {
        get () {
          return [
            { target: 'close button', signal: 'onMouseDown', handler: 'close' },
            { target: 'value input', signal: 'number', handler: 'onValueChanged' }
          ];
        }
      }
    };
  }

  get isPropertiesPanelPopup () {
    return true;
  }

  attach (view) {
    super.attach(view);
    this.ui.valueInput.number = this.value;
  }

  onValueChanged () {
    this.value = this.ui.valueInput.number;
  }
}

/**
  General control for all properties that can be configured
  by a single selection input such as the native cursor of a morph.
*/
export class SingleSelectionModel extends PopupModel {
  static get properties () {
    return {
      selection: {},
      isHaloItem: { defaultValue: true },
      expose: { get () { return ['isHaloItem', 'isPropertiesPanelPopup', 'close']; } },
      bindings: {
        get () {
          return [
            { target: 'close button', signal: 'onMouseDown', handler: 'close' },
            { model: 'selection input', signal: 'selection', handler: 'onSelectionChanged' }
          ];
        }
      }
    };
  }

  get isPropertiesPanelPopup () {
    return true;
  }

  attach (view) {
    super.attach(view);
    this.ui.selectionInput.selection = this.selection;
  }

  onSelectionChanged () {
    this.selection = this.ui.selectionInput.selection;
    signal(this, 'value', this.selection);
  }
}

export class PaddingControlsModel extends ViewModel {
  static get properties () {
    return {
      showAllSidesControl: {
        defaultValue: false
      },
      propertyLabelComponent: {
        isComponent: true,
        get () {
          return this.getProperty('propertyLabelComponent') || PropertyLabel;
        }
      },
      propertyLabelComponentActive: {
        isComponent: true,
        get () {
          return this.getProperty('propertyLabelComponentActive') || PropertyLabelActive;
        }
      },
      propertyLabelComponentHover: {
        isComponent: true,
        get () {
          return this.getProperty('propertyLabelComponentHover') || PropertyLabelHovered;
        }
      },
      expose: {
        get () {
          return ['paddingChanged', 'startPadding'];
        }
      },
      bindings: {
        get () {
          return [
            { target: 'independent padding toggle', signal: 'onMouseDown', handler: 'toggleAllSidesPadding' },
            { target: 'padding top', signal: 'onMouseDown', handler: 'focusField', converter: () => 'top' },
            { target: 'padding right', signal: 'onMouseDown', handler: 'focusField', converter: () => 'right' },
            { target: 'padding bottom', signal: 'onMouseDown', handler: 'focusField', converter: () => 'bottom' },
            { target: 'padding left', signal: 'onMouseDown', handler: 'focusField', converter: () => 'left' },

            { target: 'padding top', signal: 'numberChanged', handler: 'confirm' },
            { target: 'padding right', signal: 'numberChanged', handler: 'confirm' },
            { target: 'padding bottom', signal: 'numberChanged', handler: 'confirm' },
            { target: 'padding left', signal: 'numberChanged', handler: 'confirm' },
            { target: 'padding all', signal: 'numberChanged', handler: 'confirm' }
          ];
        }
      }
    };
  }

  startPadding (pad) {
    const left = pad.left();
    const right = pad.right();
    const bottom = pad.bottom();
    const top = pad.top();
    this.showAllSidesControl = !(arr.uniq([left, right, top, bottom]).length === 1);
    this.ui.paddingBottom.number = bottom;
    this.ui.paddingLeft.number = left;
    this.ui.paddingRight.number = right;
    this.ui.paddingTop.number = top;

    if (!this.showAllSidesControl) this.ui.paddingAll.number = left;
    else this.ui.paddingAll.setMixed();
  }

  viewDidLoad () {
    this.update();
  }

  onRefresh (prop) {
    if (prop === 'showAllSidesControl') {
      this.update();
    }
  }

  update () {
    const { paddingAll, multiPaddingControl, independentPaddingToggle } = this.ui;
    paddingAll.visible = !this.showAllSidesControl;
    multiPaddingControl.visible = this.showAllSidesControl;
    independentPaddingToggle.master = this.showAllSidesControl
      ? this.propertyLabelComponentActive
      : { auto: this.propertyLabelComponent, hover: this.propertyLabelComponentHover };
  }

  focusField (focusedField) {
    const { paddingIndicator } = this.ui;
    switch (focusedField) {
      case 'top':
        paddingIndicator.rotation = 0;
        break;
      case 'right':
        paddingIndicator.rotation = Math.PI / 2;
        break;
      case 'bottom':
        paddingIndicator.rotation = Math.PI;
        break;
      case 'left':
        paddingIndicator.rotation = -Math.PI / 2;
        break;
    }
  }

  confirm () {
    const {
      paddingAll, multiPaddingControl,
      paddingTop, paddingRight, paddingBottom, paddingLeft
    } = this.ui;
    if (paddingAll.visible) {
      signal(this, 'paddingChanged', rect(paddingAll.number, paddingAll.number, 0, 0));

      paddingLeft.number = paddingRight.number = paddingTop.number = paddingBottom.number = paddingAll.number;
    }

    if (multiPaddingControl.visible) {
      signal(this, 'paddingChanged', Rectangle.inset(paddingLeft.number, paddingTop.number, paddingRight.number, paddingBottom.number));

      if (paddingTop.number === paddingLeft.number && paddingTop.number === paddingRight.number && paddingTop.number === paddingBottom.number) paddingAll.number = paddingLeft.number;
      else paddingAll.setMixed();
    }
  }

  toggleAllSidesPadding () {
    this.showAllSidesControl = !this.showAllSidesControl;
  }
}

export class PaddingPopupModel extends PopupModel {
  static get properties () {
    return {
      expose: {
        get () {
          return ['isPropertiesPanelPopup', 'close', 'startPadding'];
        }
      },
      bindings: {
        get () {
          return [
            { model: 'padding controls', signal: 'paddingChanged', handler: 'paddingChanged' },
            { target: 'close button', signal: 'onMouseDown', handler: 'close' }
          ];
        }
      }
    };
  }

  startPadding (pad) {
    this.ui.paddingControls.startPadding(pad);
  }

  get isPropertiesPanelPopup () {
    return true;
  }

  paddingChanged (padding) {}
}

export class PositionPopupModel extends PopupModel {
  static get properties () {
    return {
      expose: {
        get () {
          return ['setPoint', 'isPropertiesPanelPopup', 'close'];
        }
      },
      bindings: {
        get () {
          return [
            { target: 'close button', signal: 'onMouseDown', handler: 'close' },
            {
              target: 'position x input',
              signal: 'numberChanged',
              handler: 'confirm'
            }, {
              target: 'position y input',
              signal: 'numberChanged',
              handler: 'confirm'
            }];
        }
      }
    };
  }

  get isPropertiesPanelPopup () {
    return true;
  }

  setPoint (point) {
    const { positionYInput, positionXInput } = this.ui;
    positionXInput.number = point.x;
    positionYInput.number = point.y;
  }

  confirm () {
    const { positionYInput, positionXInput } = this.ui;
    signal(this, 'value', pt(positionXInput.number, positionYInput.number));
  }
}

const ShadowPopup = component(DarkPopupWindow, {
  defaultViewModel: ShadowPopupModel,
  name: 'shadow popup',
  layout: new TilingLayout({
    axis: 'column',
    axisAlign: 'center',
    hugContentsHorizontally: true,
    hugContentsVertically: true,
    orderByIndex: true,
    resizePolicies: [['header menu', {
      height: 'fixed',
      width: 'fill'
    }], ['footer', {
      height: 'fixed',
      width: 'fill'
    }]]
  }),
  extent: pt(241.4, 191),
  submorphs: [{
    name: 'header menu',
    submorphs: [{
      name: 'title',
      textAndAttributes: ['Shadow', null]
    }]
  }, add({
    name: 'shadow controls',
    borderColor: Color.rgb(23, 160, 251),
    borderWidth: 0,
    extent: pt(241, 76.6),
    layout: new TilingLayout({
      align: 'right',
      hugContentsVertically: true,
      justifySubmorphs: 'spaced',
      orderByIndex: true,
      padding: rect(48, 10, -15, -2),
      spacing: 10,
      wrapSubmorphs: true
    }),
    fill: Color.rgba(0, 0, 0, 0),
    submorphs: [part(DarkNumberIconWidget, {
      name: 'x offset',
      width: 70,
      submorphs: [{
        name: 'interactive label',
        fontFamily: 'IBM Plex Mono',
        fontSize: 13,
        padding: rect(8, 0, -1, 0),
        textAndAttributes: ['X', null]
      }],
      tooltip: 'X offset'
    }),
    part(DarkNumberIconWidget, {
      name: 'blur input',
      extent: pt(80, 22),
      viewModel: { min: 0 },
      submorphs: [{
        name: 'interactive label',
        textAndAttributes: ['\ue3a5', {
          fontSize: 14,
          fontFamily: 'Material Icons'
        }]
      }],
      tooltip: 'Shadow blur'
    }),
    part(DarkNumberIconWidget, {
      name: 'y offset',
      width: 70,
      submorphs: [{
        name: 'interactive label',
        fontFamily: 'IBM Plex Mono',
        fontSize: 13,
        padding: rect(7, 0, 0, 0),
        textAndAttributes: ['Y', null]
      }],
      tooltip: 'Y offset'
    }),
    part(DarkNumberIconWidget, {
      name: 'spread input',
      extent: pt(80, 22),
      viewModel: { min: 0 },
      submorphs: [{
        name: 'interactive label',
        textAndAttributes: ['\ue3e0', {
          fontSize: 14,
          fontFamily: 'Material Icons'
        }]
      }],
      tooltip: 'Shadow spread'
    })]
  }), add(part(ColorInput, {
    name: 'shadow color input',
    height: 27,
    viewModel: {
      colorPickerComponent: DarkColorPicker
    },
    submorphs: [{
      name: 'hex input',
      extent: pt(70, 23),
      textAndAttributes: ['FFFFFF', null]
    }, {
      name: 'opacity input',
      width: 80
    }]
  })), add({ name: 'buffer', height: 10, fill: Color.transparent }), add({
    name: 'footer',
    borderColor: Color.rgbHex('616A6B'),
    borderWidth: 1,
    extent: pt(241, 50.3),
    fill: Color.rgba(0, 0, 0, 0),
    submorphs: [{
      name: 'h wrapper',
      borderColor: Color.rgb(23, 160, 251),
      extent: pt(228, 31),
      fill: Color.rgba(0, 0, 0, 0),
      layout: new TilingLayout({
        axisAlign: 'center',
        orderByIndex: true,
        padding: rect(15, 0, -10, 0)
      }),
      position: pt(6.2, 9.5),
      submorphs: [part(LabeledCheckbox, {
        name: 'fast shadow checkbox',
        submorphs: [
          {
            name: 'label',
            master: PropLabel
          }
        ],
        viewModel: { label: 'Show behind transparent areas' }
      })]
    }]
  })]
});

const NumberWidgetLight = component(DefaultNumberWidget, {
  name: 'number widget/light',
  borderColor: Color.rgbHex('CCCCCC'),
  borderRadius: 2,
  borderWidth: 1,
  dropShadow: null,
  submorphs: [
    { name: 'value', fontColor: Color.black, cursorColor: Color.gray, fontSize: 14 },
    { name: 'button holder', visible: false }
  ]
});

const NumberPopupLight = component(PopupWindow, {
  defaultViewModel: SingleNumberModel,
  name: 'number popup',
  layout: new TilingLayout({
    axis: 'column',
    hugContentsHorizontally: true,
    hugContentsVertically: true
  }),
  submorphs: [{
    name: 'header menu',
    submorphs: [{
      name: 'title',
      textAndAttributes: ['d', null]
    }]
  }, add({
    name: 'footer',
    borderColor: Color.rgb(97, 106, 107),
    borderWidth: 0,
    extent: pt(70, 50.3),
    fill: Color.rgba(0, 0, 0, 0),
    submorphs: [part(NumberWidgetLight, {
      name: 'value input',
      min: 0,
      position: pt(11.3, 14),
      submorphs: [{
        name: 'interactive label',
        textAndAttributes: ['', {
          fontSize: 14,
          fontFamily: 'Material Icons'
        }]
      }],
      tooltip: 'Object Blur'
    })]
  })]
});

export function parameterizedNumberPopupLight (spec) {
  let { title, tooltip, value, min, max, baseFactor, floatingPoint } = spec;
  title = string.tokens(string.decamelize(title)).map(m => string.capitalize(m)).join(' ');
  return component(NumberPopupLight, {
    viewModel: { value },
    hasFixedPosition: true,
    submorphs: [{
      name: 'header menu',
      submorphs: [{
        name: 'title',
        textAndAttributes: [title, null]
      }]
    }, {
      name: 'footer',
      submorphs: [{
        name: 'value input',
        min,
        max,
        baseFactor,
        floatingPoint
      }],
      tooltip: tooltip
    }]
  });
}

const PositionPopupLight = component(PopupWindow, {
  name: 'position popup/light',
  defaultViewModel: PositionPopupModel,
  submorphs: [
    {
      name: 'header menu',
      submorphs: [{
        name: 'title',
        textAndAttributes: ['Position', null]
      }]
    },
    add({
      name: 'position controls',
      extent: pt(241, 43.6),
      layout: new TilingLayout({
        orderByIndex: true,
        padding: rect(10, 10, 0, 0),
        spacing: 20
      }),
      submorphs: [
        part(DarkNumberIconWidget, {
          name: 'position x input',
          master: NumberWidgetLight,
          submorphs: [{
            name: 'interactive label',
            fontSize: 13,
            fontFamily: 'IBM Plex Mono',
            padding: rect(8, 0, -1, 0),
            textAndAttributes: ['X', null],
            fontColor: Color.rgba(101, 135, 139, .5)
          }]
        }),
        part(DarkNumberIconWidget, {
          name: 'position y input',
          master: NumberWidgetLight,
          submorphs: [{
            name: 'interactive label',
            fontSize: 13,
            fontFamily: 'IBM Plex Mono',
            padding: rect(8, 0, -1, 0),
            textAndAttributes: ['Y', null],
            fontColor: Color.rgba(101, 135, 139, .5)
          }]
        })
      ]
    })
  ]
});

const ShadowPopupLight = component(ShadowPopup, {
  name: 'shadow popup/light',
  layout: new TilingLayout({
    axis: 'column',
    axisAlign: 'center',
    hugContentsHorizontally: true,
    hugContentsVertically: true,
    orderByIndex: true,
    resizePolicies: [['header menu', {
      height: 'fixed',
      width: 'fill'
    }], ['footer', {
      height: 'fixed',
      width: 'fill'
    }]],
    wrapSubmorphs: false
  }),
  master: PopupWindow,
  submorphs: [
    {
      name: 'shadow controls',
      submorphs: [
        {
          name: 'x offset',
          master: NumberWidgetLight,
          submorphs: [{
            name: 'interactive label',
            fontColor: Color.rgba(101, 135, 139, .5)
          }]
        },
        {
          name: 'blur input',
          master: NumberWidgetLight,
          submorphs: [{
            name: 'interactive label',
            fontColor: Color.rgba(101, 135, 139, .5)
          }]
        },
        {
          name: 'y offset',
          master: NumberWidgetLight,
          submorphs: [{
            name: 'interactive label',
            fontColor: Color.rgba(101, 135, 139, .5)
          }]
        },
        {
          name: 'spread input',
          master: NumberWidgetLight,
          submorphs: [{
            name: 'interactive label',
            fontColor: Color.rgba(101, 135, 139, .5)
          }]
        }
      ]
    },
    {
      name: 'shadow color input',
      submorphs: [
        {
          name: 'hex input',
          borderRadius: 2,
          borderWidth: 1,
          dropShadow: null,
          fontSize: 14,
          master: InputLineDefault
        },
        {
          name: 'opacity input',
          master: NumberWidgetLight,
          submorphs: [{
            name: 'interactive label',
            fontColor: Color.rgba(101, 135, 139, .5)
          }]
        }
      ]
    },
    {
      name: 'footer',
      borderColor: Color.rgbHex('D7DBDD'),
      borderWidthLeft: 0,
      submorphs: [
        {
          name: 'h wrapper',
          submorphs: [
            {
              name: 'fast shadow checkbox',
              borderColor: Color.gray, // why is this not taking effect?
              fill: Color.rgb(66, 165, 245),
              fontColor: Color.white
            },
            {
              name: 'prop label',
              fontColor: Color.rgb(66, 73, 73)
            }
          ]
        }
      ]
    }
  ]
});

const InsetShadowPopup = component(ShadowPopup, {
  name: 'inset shadow popup',
  submorphs: [{
    name: 'header menu',
    submorphs: [{
      name: 'title',
      textAndAttributes: ['Inset Shadow', null]
    }]
  }]
});

export const PaddingControlsLight = component({
  name: 'padding controls',
  defaultViewModel: PaddingControlsModel,
  viewModel: {
    propertyLabelComponent: PropertyLabelLight,
    propertyLabelComponentActive: PropertyLabelActiveLight,
    propertyLabelComponentHover: PropertyLabelHoveredLight
  },
  layout: new TilingLayout({
    align: 'right',
    axisAlign: 'center',
    orderByIndex: true,
    padding: rect(0, 0, 27, 0),
    spacing: 5
  }),
  extent: pt(250, 30),
  fill: Color.rgba(0, 0, 0, 0),
  submorphs: [
    part(NumberWidgetLight, {
      name: 'padding all',
      min: 0,
      number: 0,
      extent: pt(60, 22),
      position: pt(9.7, 6.6),
      tooltip: 'Padding',
      borderRadius: 2,
      submorphs: [
        add({
          type: Label,
          name: 'interactive label',
          fontFamily: 'Material Icons',
          fontColor: Color.rgba(101, 135, 139),
          padding: rect(8, 0, -1, 0),
          lineHeight: 1,
          textAndAttributes: ['\ue22f', {
            fontSize: 16,
            fontFamily: 'Material Icons'
          }]
        }, 'value'),
        { name: 'value', fontSize: 14, width: 60 }]
    }),
    {
      name: 'multi padding control',
      position: pt(7.6, 33.4),
      layout: new TilingLayout({
        align: 'center',
        axisAlign: 'center',
        orderByIndex: true,
        spacing: 1
      }),
      fill: Color.transparent,
      extent: pt(175, 30),
      clipMode: 'hidden',
      submorphs: [
        {
          name: 'centering wrapper',
          fill: Color.transparent,
          clipMode: 'hidden',
          layout: new TilingLayout({
            align: 'center',
            axisAlign: 'center'
          }),
          extent: pt(30, 30),
          submorphs: [
            {
              type: Label,
              name: 'padding indicator',
              fill: Color.rgba(229, 231, 233, 0),
              fontColor: Color.rgb(101, 135, 139),
              fontFamily: 'Material Icons',
              padding: rect(7, 5, 0, 0),
              textAndAttributes: ['\ue25a', {
                fontSize: 16,
                fontFamily: 'Material Icons'
              }]
            }
          ]
        },
        part(NumberWidgetLight, {
          name: 'padding left',
          min: 0,
          extent: pt(35, 22),
          tooltip: 'Leftside Padding',
          borderRadiusTopRight: 0,
          borderRadiusBottomRight: 0,
          borderRadiusTopleft: 2,
          borderRadiusBottomLeft: 2,
          submorphs: [
            { name: 'value', fontSize: 14, width: 35 },
            without('interactive label')
          ]
        }),
        part(NumberWidgetLight, {
          name: 'padding top',
          viewModel: { min: 0 },
          borderRadius: 0,
          extent: pt(35, 22),
          tooltip: 'Topside Padding',
          submorphs: [
            { name: 'value', fontSize: 14, width: 35 },
            without('interactive label')
          ]
        }),
        part(NumberWidgetLight, {
          name: 'padding right',
          viewModel: { min: 0 },
          borderRadius: 0,
          extent: pt(35, 22),
          tooltip: 'Rightside Padding',
          submorphs: [
            { name: 'value', fontSize: 14, width: 35 },
            without('interactive label')]
        }),
        part(NumberWidgetLight, {
          name: 'padding bottom',
          viewModel: { min: 0 },
          borderRadiusTopLeft: 0,
          borderRadiusBottomLeft: 0,
          borderRadiusTopRight: 2,
          borderRadiusBottomRight: 2,
          extent: pt(35, 22),
          tooltip: 'Bottomside Padding',
          submorphs: [
            { name: 'value', fontSize: 14, width: 35 },
            without('interactive label')]
        })
      ]
    }, part(PropertyLabel, {
      name: 'independent padding toggle',
      padding: rect(2, 2),
      lineHeight: 1,
      fontColor: Color.rgb(101, 135, 139),
      fontSize: 14,
      master: { auto: PropertyLabelLight, hover: PropertyLabelHoveredLight },
      tooltip: 'Toggle independent Fields per Direction',
      fontFamily: 'Material Icons',
      textAndAttributes: ['', {
        fontFamily: 'Material Icons',
        fontSize: 18
      }]
    })
  ]
}
);

export const PaddingControlsDark = component(PaddingControlsLight, {
  viewModel: {
    propertyLabelComponent: PropertyLabel,
    propertyLabelComponentActive: PropertyLabelActive,
    propertyLabelComponentHover: PropertyLabelHovered
  },
  submorphs: [
    {
      name: 'padding all',
      borderWidth: 0,
      master: DarkNumberWidget,
      dropShadow: null,
      submorphs: [{
        name: 'interactive label',
        lineHeight: 1,
        fontColor: Color.rgba(178, 235, 242, 0.4976)
      },
      { name: 'value', fontSize: 14 }]
    },
    {
      name: 'multi padding control',
      submorphs: [
        {
          name: 'centering wrapper',
          submorphs: [{
            name: 'padding indicator',
            fontColor: Color.rgb(178, 235, 242),
            borderWidth: 0
          }]
        },
        {
          name: 'padding left',
          master: DarkNumberWidget,
          dropShadow: null,
          borderWidth: 0,
          submorphs: [
            { name: 'value', fontSize: 14 },
            without('button holder')
          ]
        },
        {
          name: 'padding top',
          master: DarkNumberWidget,
          borderRadius: 0,
          dropShadow: null,
          borderWidth: 0,
          submorphs: [
            { name: 'value', fontSize: 14 },
            without('button holder')
          ]
        },
        {
          name: 'padding right',
          master: DarkNumberWidget,
          borderRadius: 0,
          dropShadow: null,
          borderWidth: 0,
          submorphs: [
            { name: 'value', fontSize: 14 },
            without('button holder')
          ]
        },
        {
          name: 'padding bottom',
          master: DarkNumberWidget,
          dropShadow: null,
          borderWidth: 0,
          submorphs: [
            { name: 'value', fontSize: 14 },
            without('button holder')
          ]
        }
      ]
    },
    {
      name: 'independent padding toggle',
      fontColor: Color.rgb(178, 235, 242),
      master: { auto: PropertyLabel, hover: PropertyLabelHovered }
    }
  ]
}
);

// m = part(PaddingPopup).openInWorld()
// m.viewModel.startPadding(rect(5,5,0,0))
// m.openInWorld()
const PaddingPopup = component(PopupWindow, {
  name: 'padding popup',
  defaultViewModel: PaddingPopupModel,
  submorphs: [{
    name: 'header menu',
    submorphs: [{
      name: 'title',
      textAndAttributes: ['Padding', null]
    }]
  }, add(part(PaddingControlsLight))]
});

const BlurPopup = component(DarkPopupWindow, {
  defaultViewModel: SingleNumberModel,
  name: 'blur popup',
  submorphs: [{
    name: 'header menu',
    submorphs: [{
      name: 'title',
      textAndAttributes: ['Blur', null]
    }]
  }, add({
    name: 'footer',
    borderColor: Color.rgb(97, 106, 107),
    borderWidth: 0,
    extent: pt(241, 50.3),
    fill: Color.rgba(0, 0, 0, 0),
    submorphs: [part(DarkNumberIconWidget, {
      name: 'value input',
      viewModel: {
        min: 0,
        scaleFactor: 100,
        unit: '%'
      },
      position: pt(11.3, 14),
      submorphs: [{
        name: 'interactive label',
        textAndAttributes: ['', {
          fontSize: 14,
          fontFamily: 'Material Icons'
        }]
      }],
      tooltip: 'Object Blur'
    })]
  })]
});

const OpacityPopup = component(DarkPopupWindow, {
  defaultViewModel: SingleNumberModel,
  name: 'opacity popup',
  submorphs: [{
    name: 'header menu',
    submorphs: [{
      name: 'title',
      textAndAttributes: ['Opacity', null]
    }]
  }, add({
    name: 'footer',
    borderColor: Color.rgb(97, 106, 107),
    borderWidth: 0,
    extent: pt(241, 50.3),
    fill: Color.rgba(0, 0, 0, 0),
    submorphs: [part(DarkNumberIconWidget, {
      name: 'value input',
      position: pt(11.3, 14),
      viewModel: {
        min: 0,
        max: 1,
        scaleFactor: 100,
        unit: '%'
      },
      tooltip: 'Object opacity',
      submorphs: [{
        name: 'interactive label',
        textAndAttributes: ['\ue91c', {
          fontSize: 14,
          fontFamily: 'Material Icons'
        }]
      }]
    })]
  })]
});

const CursorPopup = component(DarkPopupWindow, {
  defaultViewModel: SingleSelectionModel,
  name: 'cursor popup',
  submorphs: [{
    name: 'header menu',
    submorphs: [{
      name: 'title',
      textAndAttributes: ['Cursor', null]
    }]
  }, add({
    name: 'footer',
    borderColor: Color.rgb(97, 106, 107),
    borderWidth: 0,
    extent: pt(241, 50.3),
    fill: Color.rgba(0, 0, 0, 0),
    submorphs: [part(EnumSelector, {
      name: 'selection input',
      tooltip: 'Selector Cursor',
      viewModel: {
        openListInWorld: true,
        listAlign: 'selection',
        items: Morph.properties.nativeCursor.values,
        listMaster: DarkThemeList,
        listHeight: 1000
      },
      extent: pt(210.4, 23.3),
      master: EnumSelector,
      position: pt(15.4, 13.5),
      submorphs: [add({
        type: Label,
        name: 'interactive label',
        fill: Color.rgba(229, 231, 233, 0),
        fontColor: Color.rgb(255, 255, 255),
        fontFamily: 'Material Icons',
        nativeCursor: 'pointer',
        padding: rect(6, 0, -6, 0),
        reactsToPointer: false,
        textAndAttributes: Icon.textAttribute('mouse-pointer', { fontSize: 16 })
      }, 'label')]
    })]
  })]
});

const TiltPopup = component(DarkPopupWindow, {
  defaultViewModel: SingleNumberModel,
  name: 'tilt popup',
  submorphs: [{
    name: 'header menu',
    submorphs: [{
      name: 'title',
      textAndAttributes: ['Tilt ', null, '(Rotate along X-Axis)', { fontWeight: '400' }]
    }]
  }, add({
    name: 'footer',
    borderColor: Color.rgb(97, 106, 107),
    borderWidth: 0,
    extent: pt(241, 50.3),
    fill: Color.rgba(0, 0, 0, 0),
    submorphs: [part(DarkNumberIconWidget, {
      name: 'value input',
      extent: pt(90, 22),
      viewModel: {
        unit: '°',
        min: 0,
        scaleFactor: 180,
        max: 1
      },
      position: pt(11.3, 14),
      tooltip: 'Object Tilt',
      submorphs: [{
        name: 'interactive label',
        textAndAttributes: ['X ', { fontSize: 16, fontFamily: 'IBM Plex Mono' }, ...Icon.textAttribute('undo', { fontSize: 14, paddingTop: '3px' })]
      }]
    })]
  })]
});

const FlipPopup = component(DarkPopupWindow, {
  defaultViewModel: SingleNumberModel,
  name: 'flip popup',
  submorphs: [{
    name: 'header menu',
    submorphs: [{
      name: 'title',
      textAndAttributes: ['Flip ', null, '(Rotate along Y-Axis)', { fontWeight: '400' }]
    }]
  }, add({
    name: 'footer',
    borderColor: Color.rgb(97, 106, 107),
    borderWidth: 0,
    extent: pt(241, 50.3),
    fill: Color.rgba(0, 0, 0, 0),
    submorphs: [part(DarkNumberIconWidget, {
      name: 'value input',
      extent: pt(90, 22),
      viewModel: {
        unit: '°',
        min: 0,
        scaleFactor: 180,
        max: 1
      },
      position: pt(11.3, 14),
      tooltip: 'Object Flip',
      submorphs: [{
        name: 'interactive label',
        textAndAttributes: [
          'Y ', { fontSize: 16, fontFamily: 'IBM Plex Mono' },
          ...Icon.textAttribute('undo', { fontSize: 14, paddingTop: '3px' })]
      }]
    })]
  })]
});

export { BlurPopup, ShadowPopup, ShadowPopupLight, InsetShadowPopup, OpacityPopup, CursorPopup, TiltPopup, NumberWidgetLight, NumberPopupLight, PaddingPopup, PositionPopupLight, FlipPopup };
