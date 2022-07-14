import { ViewModel, TilingLayout, part, add, without, component } from 'lively.morphic';
import { PropertySection } from './section.cp.js';
import { pt, rect } from 'lively.graphics';
import { ColorInput } from '../../styling/color-picker.cp.js';
import { DarkColorPicker } from '../dark-color-picker.cp.js';

export class SVGControlModel extends ViewModel {
  static get properties () {
    return {
      target: {},
      bindings: {
        get () {
          return [
            { model: 'fill color input', signal: 'color', handler: 'confirm' }
          ];
        }
      }
    };
  }

  focusOn (target) {
    this.target = target;
  }

  onRefresh (prop) {
    if (prop === 'target') this.update();
  }

  confirm () {
    if (!this.target) return;
    let color = this.ui.fillColorInput.colorValue;
    this.target.css({ fill: color.toString(), 'fill-opacity': color.a });
  }

  async update () {
    console.log('update: ', this.target.attr('fill'));
    // this.ui.fillColorInput.setColor(this.target.attr('fill'));
  }

  deactivate () {
    this.models.fillColorInput.closeColorPicker();
  }
}

const SVGControl = component(PropertySection, {
  defaultViewModel: SVGControlModel,
  name: 'svg control',
  layout: new TilingLayout({
    axis: 'column',
    hugContentsVertically: true,
    orderByIndex: true,
    padding: rect(0, 10, 0, 10),
    resizePolicies: [['h floater', {
      height: 'fixed',
      width: 'fill'
    }]],
    spacing: 10,
    wrapSubmorphs: false
  }),
  extent: pt(250, 121),
  submorphs: [
    {
      name: 'h floater',
      submorphs: [
        without('add button'), {
          name: 'section headline',
          textAndAttributes: ['SVG Path', null]
        }]
    },
    add(part(ColorInput, {
      name: 'fill color input',
      viewModel: {
        gradientEnabled: true,
        colorPickerComponent: DarkColorPicker
      },
      extent: pt(250, 27)
    }))
  ]
});

export { SVGControl };
