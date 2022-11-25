import { component, ensureFont, part } from 'lively.morphic';
import { ColorPicker } from '../styling/color-picker.cp.js';
import { Color, pt } from 'lively.graphics';
import { EnumSelector, DarkNumberIconWidget, DarkThemeList, DarkCloseButton, DarkCloseButtonHovered } from './shared.cp.js';
// DarkColorPicker.openInWorld()

ensureFont({
  'Material Icons': 'https://fonts.googleapis.com/icon?family=Material+Icons'
});

const DarkColorPicker = component(ColorPicker, {
  name: 'dark color picker',
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
    borderColor: Color.rgb(112, 123, 124),
    submorphs: [{
      name: 'color encoding',
      extent: pt(219.2, 25.3),
      clipMode: 'hidden',
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
          extent: pt(150, 25),
          submorphs: [{
            name: 'hex encoding',
            extent: pt(150, 25),
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
                fontColor: Color.rgbHex('B2EBF2'),
                fontSize: 14
              }]
          }, {
            name: '3 val encoding',
            submorphs: [{
              name: 'opacity control',
              master: DarkNumberIconWidget,
              borderRadius: 0,
              submorphs: [{
                name: 'value',
                fontColor: Color.rgbHex('B2EBF2')
              }]
            }, {
              name: 'first value',
              master: DarkNumberIconWidget,
              borderRadius: 0,
              submorphs: [{
                name: 'value',
                fontColor: Color.rgbHex('B2EBF2')
              }]
            },
            {
              name: 'second value',
              master: DarkNumberIconWidget,
              borderRadius: 0,
              submorphs: [{
                name: 'value',
                fontColor: Color.rgbHex('B2EBF2')
              }]
            }, {
              name: 'third value',
              master: DarkNumberIconWidget,
              borderRadius: 0,
              submorphs: [{
                name: 'value',
                fontColor: Color.rgbHex('B2EBF2')
              }]
            }]
          }, {
            name: 'css encoding',
            submorphs: [{
              name: 'css input',
              fontSize: 14,
              master: DarkNumberIconWidget,
              borderRadius: 0
            }]
          }]
        }]
    }]
  }, {
    name: 'color palettes',
    submorphs: [{
      name: 'color palette selector',
      extent: pt(98.2, 25),
      master: EnumSelector,
      viewModel: {
        listMaster: DarkThemeList,
        listAlign: 'selection'
      }
    }]
  }]
});

export { DarkColorPicker };
