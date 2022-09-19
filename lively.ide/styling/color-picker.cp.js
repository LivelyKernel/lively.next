import { Color, Rectangle, LinearGradient, rect, pt } from 'lively.graphics';
import { Ellipse, ShadowObject, InputLine, Label, TilingLayout, component, add, part } from 'lively.morphic';
import {
  ColorEncoderModel, ColorInputModel, ColorPickerModel,
  ColorPaletteView, FieldPickerModel, HuePickerModel, OpacityPickerModel
} from './color-picker.js';
import { NumberWidget } from '../value-widgets.js';
import { DefaultNumberWidget } from '../value-widgets.cp.js';
import { DropDownList } from 'lively.components/list.cp.js';
import { CheckerPattern, PopupWindow, SystemList } from './shared.cp.js';
import { GradientControl } from './gradient-editor.cp.js';
import { ColorCell } from './color-stops.cp.js';
import { TextInput, PropLabel, DarkNumberIconWidget } from '../studio/shared.cp.js'; // that should be revised...

const ColorInput = component({
  defaultViewModel: ColorInputModel,
  name: 'color input',
  extent: pt(250, 27),
  layout: new TilingLayout({
    axisAlign: 'center',
    orderByIndex: true,
    padding: rect(20, 2, -10, 0),
    resizePolicies: [['hex input', {
      height: 'fill',
      width: 'fixed'
    }], ['opacity input', {
      height: 'fill',
      width: 'fixed'
    }]],
    spacing: 10,
    wrapSubmorphs: false
  }),
  fill: Color.rgba(255, 255, 255, 0),
  submorphs: [part(ColorCell, {
    name: 'color cell',
    tooltip: 'Open Color Picker',
    borderWidth: 0,
    nativeCursor: 'pointer',
    extent: pt(22, 22),
    submorphs: [{
      name: 'opaque',
      reactsToPointer: false,
      borderColor: Color.rgb(23, 160, 251),
      extent: pt(11, 22),
      position: pt(0),
      fill: Color.rgb(255, 0, 0)
    }, {
      name: 'transparent',
      reactsToPointer: false,
      borderColor: Color.rgb(23, 160, 251),
      extent: pt(11, 22),
      fill: Color.rgba(255, 0, 0, 0.38),
      position: pt(11, 0)
    }, add({
      name: 'gradient',
      reactsToPointer: false,
      visible: false,
      fill: Color.blue,
      extent: pt(22, 22)
    })]
  }), part(TextInput, {
    type: InputLine,
    fill: Color.transparent,
    value: 'DDDDDD',
    name: 'hex input',
    tooltip: 'HEX Color Value',
    extent: pt(72.1, 23),
    fill: Color.rgb(66, 73, 73),
    fontSize: 14,
    padding: rect(4, 3, 6, 2)
  }), part(DarkNumberIconWidget, {
    type: NumberWidget,
    name: 'opacity input',
    tooltip: 'Opacity',
    extent: pt(78.8, 23),
    unit: '%',
    max: 1,
    min: 0,
    scaleFactor: 100,
    submorphs: [{
      name: 'interactive label',
      lineHeight: 1,
      textAndAttributes: ['', {
        fontSize: 14, textStyleClasses: ['material-icons']
      }]
    }]
  }), part(PropLabel, {
    name: 'gradient name',
    visible: false,
    textAndAttributes: ['Linear', null]
  })]
});

const DefaultInputLine = component({
  type: InputLine,
  name: 'default input line',
  borderColor: Color.rgb(204, 204, 204),
  fill: Color.transparent,
  extent: pt(97, 23),
  fontFamily: 'IBM Plex Sans',
  fontSize: 14,
  haloShadow: new ShadowObject({ distance: 0, color: Color.rgb(52, 152, 219) }),
  highlightWhenFocused: true,
  padding: rect(10, 3, -10, 0),
  nativeCursor: 'text',
  submorphs: [{
    type: Label,
    name: 'placeholder',
    fontColor: Color.rgb(204, 204, 204),
    fontFamily: 'IBM Plex Sans',
    fontSize: 14,
    padding: rect(10, 3, -10, 0),
    reactsToPointer: false,
    textAndAttributes: ['Hex Code', null]
  }]
});

const HexEncoder = component({
  name: 'hex encoder',
  borderColor: Color.rgb(23, 160, 251),
  extent: pt(150.5, 25),
  fill: Color.rgb(189, 195, 199),
  layout: new TilingLayout({
    axis: 'column',
    axisAlign: 'center',
    align: 'center',
    spacing: 1
  }),
  submorphs: [
    part(DefaultNumberWidget, {
      name: 'hex opacity control',
      dropShadow: false,
      extent: pt(49.6, 23),
      floatingPoint: false,
      borderRadius: 0,
      max: 1,
      min: 0,
      scaleFactor: 100,
      unit: '%',
      submorphs: [{
        name: 'value',
        fontSize: 14
      },
      {
        name: 'up',
        visible: false
      }, {
        name: 'down',
        visible: false
      }]
    }),
    part(DefaultInputLine, {
      placeholder: 'Hex Code',
      fill: Color.white,
      name: 'hex input'
    })]
});

const ThreeValEncoder = component({
  name: 'three val encoder',
  borderColor: Color.rgb(23, 160, 251),
  extent: pt(160, 23),
  fill: Color.rgb(189, 195, 199),
  layout: new TilingLayout({
    axis: 'column',
    align: 'center',
    axisAlign: 'center',
    spacing: 1
  }),
  submorphs: [
    part(DefaultNumberWidget, {
      name: 'opacity control',
      dropShadow: false,
      extent: pt(49.6, 22),
      floatingPoint: false,
      max: 1,
      min: 0,
      scaleFactor: 100,
      borderRadius: 0,
      unit: '%',
      submorphs: [{
        name: 'value',
        fontSize: 14
      }, {
        name: 'up',
        visible: false
      }, {
        name: 'down',
        visible: false
      }]
    }),
    part(DefaultNumberWidget, {
      type: NumberWidget,
      name: 'first value',
      dropShadow: false,
      extent: pt(35, 22),
      floatingPoint: false,
      borderRadius: 0,
      max: 255,
      min: 0,
      unit: '',
      submorphs: [{
        name: 'value',
        fontSize: 14
      }, {
        name: 'up',
        visible: false
      }, {
        name: 'down',
        visible: false
      }]
    }),
    part(DefaultNumberWidget, {
      type: NumberWidget,
      name: 'second value',
      borderRadius: 0,
      dropShadow: false,
      extent: pt(35, 22),
      floatingPoint: false,
      max: 255,
      min: 0,
      unit: '',
      submorphs: [{
        name: 'value',
        fontSize: 14
      }, {
        name: 'up',
        visible: false
      }, {
        name: 'down',
        visible: false
      }]
    }),
    part(DefaultNumberWidget, {
      name: 'third value',
      borderRadius: 0,
      dropShadow: false,
      extent: pt(35, 22),
      floatingPoint: false,
      max: 255,
      min: 0,
      unit: '',
      submorphs: [{
        name: 'value',
        fontSize: 14
      }, {
        name: 'up',
        visible: false
      }, {
        name: 'down',
        visible: false
      }]
    })]
});

const CssEncoder = component({
  name: 'css encoder',
  borderColor: Color.rgb(23, 160, 251),
  extent: pt(152.5, 25.2),
  fill: Color.rgb(189, 195, 199),
  isLayoutable: false,
  layout: new TilingLayout({
    align: 'center',
    orderByIndex: true,
    padding: {
      height: 0,
      width: 0,
      x: 1,
      y: 1
    },
    reactToSubmorphAnimations: false,
    renderViaCSS: true,
    resizeSubmorphs: false,
    spacing: 1
  }),
  submorphs: [part(DefaultInputLine, {
    name: 'css input',
    placeholder: 'CSS color string',
    extent: pt(150.5, 23.2),
    padding: rect(5, 3, -5, -3)
  })],
  visible: false
});

const ColorEncoder = component({
  defaultViewModel: ColorEncoderModel,
  name: 'color encoder',
  extent: pt(219.6, 25),
  fill: Color.transparent,
  layout: new TilingLayout({ justifySubmorphs: 'spaced', wrapSubmorphs: false }),
  submorphs: [
    part(DropDownList, {
      name: 'color code selector',
      extent: pt(54, 25),
      viewModel: {
        listMaster: SystemList,
        items: [
          'HEX', 'RGB', 'HSL', 'HSB', 'CSS'
        ],
        openListInWorld: true
      }
    }),
    {
      name: 'controls',
      borderColor: Color.rgb(23, 160, 251),
      clipMode: 'visible',
      encodingMode: 'HEX',
      extent: pt(162.5, 30.8),
      fill: Color.transparent,
      layout: new TilingLayout({
        axis: 'column',
        axisAlign: 'right'
      }),
      submorphs: [
        part(HexEncoder, { name: 'hex encoding' }),
        part(ThreeValEncoder, { name: '3 val encoding', visible: false }),
        part(CssEncoder, { name: 'css encoding', visible: false })
      ]
    }
  ]
});

const DefaultSlider = component({
  name: 'default slider',
  borderColor: Color.rgb(189, 195, 199),
  borderRadius: 9,
  borderWidth: 1,
  draggable: true,
  extent: pt(215, 10),
  submorphs: [{
    name: 'slider',
    position: pt(0, -2),
    borderRadius: 10,
    borderWidth: 3,
    dropShadow: new ShadowObject({
      distance: 0,
      color: Color.rgba(7, 7, 7, 0.5),
      blur: 4,
      fast: false
    }),
    extent: pt(15, 15),
    fill: Color.rgba(0, 0, 0, 0),
    nativeCursor: 'ns-resize',
    reactsToPointer: false
  }]
});

const OpacitySlider = component(DefaultSlider, {
  defaultViewModel: OpacityPickerModel,
  name: 'opacity slider',
  submorphs: [
    add(part(CheckerPattern, {
      name: 'checkerboard pattern',
      extent: pt(215, 10),
      borderColor: Color.rgb(203, 203, 203),
      borderRadius: 10,
      borderWidth: 1
    }), 'slider'),
    add({
      name: 'opacity gradient',
      borderColor: Color.rgb(23, 160, 251),
      borderRadius: 5,
      extent: pt(215, 10),
      fill: new LinearGradient({
        stops: [
          { offset: 0, color: Color.transparent },
          { offset: 1, color: Color.black }
        ],
        vector: 'eastwest'
      }),
      reactsToPointer: false
    }, 'slider')
  ]
});

const HueSlider = component(DefaultSlider, {
  defaultViewModel: HuePickerModel,
  name: 'hue slider',
  fill: new LinearGradient({
    stops: [{ color: Color.rgb(255, 0, 0), offset: 0 },
      { color: Color.rgb(255, 255, 0), offset: 0.17 },
      { color: Color.limeGreen, offset: 0.33 },
      { color: Color.cyan, offset: 0.50 },
      { color: Color.blue, offset: 0.66 },
      { color: Color.magenta, offset: 0.83 },
      { color: Color.rgb(255, 0, 0), offset: 1 }],
    vector: 'eastwest'
  })
});

const FieldPicker = component({
  defaultViewModel: FieldPickerModel,
  name: 'field picker',
  borderColor: Color.rgb(162, 162, 162),
  borderWidth: 1,
  draggable: true,
  clipMode: 'hidden',
  extent: pt(241, 240.8),
  submorphs: [{
    name: 'hue',
    extent: pt(241, 240.8),
    fill: Color.rgb(255, 0, 0),
    reactsToPointer: false
  }, {
    name: 'shade',
    extent: pt(241, 240.8),
    reactsToPointer: false,
    fill: new LinearGradient({
      stops: [{ offset: 0, color: Color.white }, { offset: 1, color: Color.transparent }],
      vector: rect(0, 0, 1, 0)
    })
  }, {
    name: 'light',
    extent: pt(241, 240.8),
    reactsToPointer: false,
    fill: new LinearGradient({
      stops: [{ offset: 0, color: Color.black }, { offset: 1, color: Color.transparent }],
      vector: rect(0, 1, 0, -1)
    })
  }, {
    type: Ellipse,
    name: 'picker',
    borderColor: Color.rgb(0, 0, 0),
    borderWidth: 3,
    extent: pt(16, 16),
    fill: Color.rgba(0, 0, 0, 0),
    reactsToPointer: false,
    submorphs: [{
      type: Ellipse,
      name: 'inside picker',
      borderWidth: 3,
      position: pt(2, 2),
      extent: pt(12, 12),
      fill: Color.rgba(0, 0, 0, 0),
      reactsToPointer: false
    }]
  }]
});

const ColorPicker = component(PopupWindow, {
  name: 'color picker',
  defaultViewModel: ColorPickerModel,
  layout: new TilingLayout({
    axis: 'column',
    wrapSubmorphs: false,
    hugContentsVertically: true,
    resizePolicies: [
      ['color controls', { height: 'fixed', width: 'fill' }]
    ]
  }),
  submorphs: [{
    name: 'header menu',
    submorphs: [
      add(part(DropDownList, {
        name: 'color type selector',
        extent: pt(102, 27),
        viewModel: {
          listMaster: SystemList,
          openListInWorld: true,
          items: [{
            isListItem: true,
            string: 'Solid',
            value: 'Solid'
          }, {
            isListItem: true,
            string: 'Linear',
            value: 'linearGradient'
          }, {
            isListItem: true,
            string: 'Radial',
            value: 'radialGradient'
          }]
        }
      }), 'close button'), {
        name: 'title', visible: false
      }
    ]
  },
  add(part(GradientControl, {
    name: 'gradient control',
    visible: false
  })),
  add(part(FieldPicker, {
    name: 'shade picker'
  })),
  add({
    name: 'color controls',
    borderWidth: { top: 0, left: 0, right: 0, bottom: 1 },
    layout: new TilingLayout({
      orderByIndex: true,
      padding: Rectangle.inset(5, 15, 5, 15),
      spacing: 10,
      axis: 'column',
      axisAlign: 'center',
      justifySubmorphs: 'spaced',
      wrapSubmorphs: false
    }),
    borderColor: Color.rgb(215, 219, 221),
    extent: pt(0, 113.7),
    fill: Color.rgba(0, 0, 0, 0),
    submorphs: [
      part(HueSlider, { name: 'hue picker' }),
      part(OpacitySlider, { name: 'opacity picker' }),
      part(ColorEncoder, {
        name: 'color encoding'
      })
    ]
  }), add({
    name: 'color palettes',
    borderColor: Color.rgb(23, 160, 251),
    extent: pt(241, 157.2),
    fill: Color.rgba(0, 0, 0, 0),
    submorphs: [
      part(DropDownList, {
        name: 'color palette selector',
        position: pt(9.7, 9.2),
        viewModel: {
          listMaster: SystemList,
          items: ['Material', 'Flat Design', 'Web Safe'],
          openListInWorld: true
        },
        extent: pt(97, 25),
        tooltip: 'Select a color palette'
      }), {
        type: ColorPaletteView,
        name: 'color palette view',
        cssDeclaration: `.palette-container {
  height: 100%;
  width: 100%;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  overflow: auto;
}

.color-cell {
  height: 15px;
  width: 15px;
  margin: 4px;
  border-width: .5px;
  border-style: solid;
  border-color: lightgray;
  border-radius: 1px;
  cursor: pointer;
}`,
        position: pt(-0.1, 41),
        borderColor: Color.rgb(23, 160, 251),
        clipMode: 'hidden',
        extent: pt(241.3, 116.8),
        fill: Color.rgba(0, 0, 0, 0)
      }]
  })]
});

export { ColorEncoder, DefaultSlider, OpacitySlider, HueSlider, ColorPicker, HexEncoder, ColorInput };
