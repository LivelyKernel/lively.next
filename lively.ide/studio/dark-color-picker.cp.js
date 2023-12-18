import { component, TilingLayout, part } from 'lively.morphic';
import { ColorPicker } from '../styling/color-picker.cp.js';
import { Color, pt } from 'lively.graphics';
import { EnumSelector, TextInput, DarkNumberIconWidget, DarkThemeList, DarkCloseButton, DarkCloseButtonHovered } from './shared.cp.js';
import { BackendButtonDefault } from '../js/browser/ui.cp.js';
import { InputLineDark } from 'lively.components/inputs.cp.js';
import { rect } from 'lively.graphics/geometry-2d.js';

const DarkColorPicker = component(ColorPicker, {
  name: 'dark color picker',
  master: DarkColorPicker,
  borderColor: Color.rgba(112, 123, 124, 1),
  fill: Color.rgb(66, 73, 73),
  submorphs: [{
    name: 'header menu',
    borderWidth: { top: 0, left: 0, right: 0, bottom: 1 },
    borderColor: Color.rgb(112, 123, 124),
    submorphs: [{
      name: 'title',
      fontColor: Color.white
    }, {
      name: 'color type selector',
      master: EnumSelector,
      viewModel: {
        listMaster: DarkThemeList,
        listAlign: 'selection'
      }
    }, {
      name: 'close button',
      master: { auto: DarkCloseButton, hover: DarkCloseButtonHovered }
    }]
  }, {
    name: 'color controls',
    layout: new TilingLayout({
      align: 'right',
      axis: 'column',
      justifySubmorphs: 'spaced',
      padding: rect(5, 15, 1, 0),
      resizePolicies: [['eye dropper button', {
        height: 'fixed',
        width: 'fill'
      }]],
      spacing: 10
    }),
    borderColor: Color.rgb(112, 123, 124),
    submorphs: [{
      name: 'color encoding',
      submorphs: [
        {
          name: 'color code selector',
          master: EnumSelector,
          viewModel: {
            listMaster: DarkThemeList,
            listHeight: 500,
            listAlign: 'selection'
          }
        },
        {
          name: 'controls',
          submorphs: [{
            name: 'hex encoding',
            submorphs: [
              {
                name: 'hex opacity control',
                master: DarkNumberIconWidget,
                borderRadius: 0,
                submorphs: [{
                  name: 'value',
                  fontColor: Color.rgbHex('B2EBF2')
                }]
              },
              {
                name: 'hex input',
                borderRadius: 0,
                fill: Color.rgb(66, 73, 73),
                fontColor: Color.rgbHex('B2EBF2')
              }]
          }, {
            name: '3 val encoding',
            submorphs: [{
              name: 'opacity control',
              master: DarkNumberIconWidget,
              borderRadius: 0,
              submorphs: [{
                name: 'value',
                fontSize: 14,
                fontColor: Color.rgbHex('B2EBF2')
              }]
            }, {
              name: 'first value',
              master: DarkNumberIconWidget,
              borderRadius: 0,
              submorphs: [{
                name: 'value',
                fontSize: 14,
                fontColor: Color.rgbHex('B2EBF2')
              }]
            },
            {
              name: 'second value',
              master: DarkNumberIconWidget,
              borderRadius: 0,
              submorphs: [{
                name: 'value',
                fontSize: 14,
                fontColor: Color.rgbHex('B2EBF2')
              }]
            }, {
              name: 'third value',
              master: DarkNumberIconWidget,
              borderRadius: 0,
              submorphs: [{
                name: 'value',
                fontSize: 14,
                fontColor: Color.rgbHex('B2EBF2')
              }]
            }]
          }, {
            name: 'css encoding',
            layout: new TilingLayout({
              align: 'center',
              padding: rect(1, 1, 0, 0),
              resizePolicies: [['css input', {
                height: 'fixed',
                width: 'fill'
              }]],
              spacing: 1
            }),
            submorphs: [{
              name: 'css input',
              textAlign: 'center',
              master: TextInput,
              borderRadius: 0
            }]
          }]
        },
        {
          name: 'color copier',
          fontColor: Color.white
        }]
    },
    {
      name: 'eye dropper button',
      layout: new TilingLayout({
        align: 'center',
        axisAlign: 'center',
        padding: rect(5, 0, 0, 0)
      }),
      master: BackendButtonDefault,
      borderColor: Color.fromString('95A5A6'),
      fill: Color.transparent

    }]
  }, {
    name: 'color palettes',
    submorphs: [{
      name: 'color palette selector',
      master: EnumSelector,
      viewModel: {
        listMaster: DarkThemeList,
        listAlign: 'selection'
      }
    }]
  }]
});

export { DarkColorPicker };
