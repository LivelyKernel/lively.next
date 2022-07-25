import { ViewModel, TilingLayout, part, add, without, component } from 'lively.morphic';
import { PropertySection } from './section.cp.js';
import { pt, Color, rect } from 'lively.graphics';
import { ColorInput } from '../../styling/color-picker.cp.js';
import { DarkColorPicker } from '../dark-color-picker.cp.js';
import { BorderControlElements } from './border.cp.js';

export class SVGFillControlModel extends ViewModel {
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

  onRefresh (prop) {
    if (prop === 'target') this.update();
  }

  confirm () {
    if (!this.target) return;
    let color = this.ui.fillColorInput.colorValue;
    this.target.css({ fill: color.toString(), 'fill-opacity': color.a });
  }

  async update () {
    // TODO: Fixme, color must not be defined via css in the svg
    // this.ui.fillColorInput.setColor(this.target.css.fill);
  }

  deactivate () {
    this.models.fillColorInput.closeColorPicker();
  }
}

export class SVGBorderControlModel extends ViewModel {
  static get properties () {
    return {
      target: {},
      bindings: {
        get () {
          return [
            {
              model: 'border color input',
              signal: 'color',
              handler: 'confirm'
            },
            {
              target: 'border width input',
              signal: 'number',
              handler: 'confirm'
            },
            {
              model: 'border style selector',
              signal: 'selection',
              handler: 'confirm'
            }
          ];
        }
      }
    };
  }

  deactivate () {
    this.models.borderColorInput.closeColorPicker();
  }

  /**
   * Update the current border value based on the inputs in the UI.
   * This is invoked in response to user interactions.
   */
  confirm () {
    if (!this.target) return;
    const { borderColorInput, borderWidthInput, borderStyleSelector } = this.ui;
    this.target.css({
      stroke: borderColorInput.colorValue,
      'stroke-width': borderWidthInput.number,
      'stroke-dasharray': borderStyleSelector.selection,
      'stroke-linecap': 'round'
    });
  }
}

export class SVGControlModel extends ViewModel {
  focusOn (target) {
    this.target = target;
    Object.values(this.models).forEach(each => each.target = this.target);
  }

  deactivate () {
    this.view.visible = false;
    Object.values(this.models).forEach(each => { if (each !== this) each.deactivate(); });
  }
}

// part(SVGFillControl).openInWorld()

const SVGFillControl = component(PropertySection, {
  defaultViewModel: SVGFillControlModel,
  name: 'svg fill control',
  fill: Color.transparent,
  layout: new TilingLayout({
    axis: 'column',
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
          textAndAttributes: ['Fill', null]
        }]
    },
    add(part(ColorInput, {
      name: 'fill color input',
      viewModel: {
        colorPickerComponent: DarkColorPicker
      },
      extent: pt(250, 27)
    }))

  ]
});

// part(SVGBorderControl).openInWorld()

const SVGBorderControl = component(PropertySection, {
  name: 'svg border control',
  defaultViewModel: SVGBorderControlModel,
  height: 100,
  width: 250,
  borderWidth: 0,
  fill: Color.transparent,
  submorphs: [
    {
      name: 'h floater',
      submorphs: [
        without('add button'), {
          name: 'section headline',
          textAndAttributes: ['Stroke', null]
        }]
    },
    add(part(BorderControlElements, {
      name: 'elements wrapper',
      extent: pt(250, 50),
      submorphs: [
        {
          name: 'border color input',
          submorphs: [{
            name: 'hex input',
            extent: pt(80, 23)
          }]
        },
        {
          name: 'border width control',
          extent: pt(175, 25),
          fill: Color.rgba(255, 255, 255, 0),
          layout: new TilingLayout({
            axisAlign: 'center',
            justifySubmorphs: 'spaced',
            orderByIndex: true,
            padding: rect(20, 0, -10, 0),
            spacing: 10,
            wrapSubmorphs: false
          }),
          submorphs: [{
            name: 'border width input',
            extent: pt(59.9, 22),
            min: 0,
            tooltip: 'Border Width',
            submorphs: [{
              name: 'value',
              extent: pt(45.7, 21)
            }]
          },
          {
            name: 'border style selector',
            viewModel: {
              items: [
                { string: 'Solid', value: '0', isListItem: true },
                { string: 'Dotted', value: '0, 10', isListItem: true },
                { string: 'Dashed', value: '5, 10', isListItem: true }],
              selection: '0'
            }

          }
          ]
        }]
    }))
  ]
});

// part(SVGControl).openInWorld()
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
    { name: 'h floater', visible: false },
    add(part(SVGFillControl, { name: 'svg fill control' })),
    add(part(SVGBorderControl, { name: 'svg border control' }))
  ]
});

export { SVGControl };
