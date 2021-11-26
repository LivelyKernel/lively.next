import { component, part } from 'lively.morphic/components/core.js';
import { ColorPicker } from './color-picker.cp.js';
import { pt } from 'lively.graphics/geometry-2d.js';

const ColorPickerJP = component(ColorPicker, {
  name: 'color picker JP',
  submorphs: [{
    name: 'header menu',
    submorphs: [{
      name: 'color type selector',
      extent: pt(131, 27),
      viewModel: {
        selection: '単一色',
        items: [{
          isListItem: true,
          string: '単一色',
          value: 'Solid'
        }, {
          isListItem: true,
          string: 'グラデーション',
          value: 'linearGradient'
        }, {
          isListItem: true,
          string: '放射状',
          value: 'radialGradient'
        }]
      }
    }]
  }]
});

// ColorPickerJP.openInWorld()
// part(ColorPickerJP).openInWorld()

export { ColorPickerJP };
