import { component, part, TilingLayout, ViewModel, Icon } from 'lively.morphic';
import { Color } from 'lively.graphics';
import { pt, rect } from 'lively.graphics/geometry-2d.js';

class InformIconModel extends ViewModel {
  static get properties () {
    return {
      information: {
        defaultValue: 'This is important information!'
      }
    };
  }

  viewDidLoad () {
    this.view.tooltip = this.information;
  }
}

export const InformIconOnLight = component({
  defaultViewModel: InformIconModel,
  type: 'label',
  textAndAttributes: Icon.textAttribute('circle-info'),
  fontColor: Color.darkGray
});

class InputLineErrorModel extends InformIconModel {
  static get properties () {
    return {
      tooltip: {},
      height: {},
      fontSize: {
        defaultValue: 16
      }
    };
  }

  viewDidLoad () {
    this.ui.errorLabel.textString = this.information;
    this.ui.exclamationMark.tooltip = this.tooltip;
    this.view.tooltip = this.tooltip;

    this.view.height = this.height;

    this.ui.errorLabel.fontSize = this.fontSize;
  }
}

export const InputLineError = component({
  name: 'input line error',
  defaultViewModel: InputLineErrorModel,
  extent: pt(100, 10),
  fill: Color.rgba(255, 255, 255, 0),
  layout: new TilingLayout({
    align: 'right',
    axisAlign: 'center',
    padding: rect(0, 0, 10, 0),
    spacing: 5
  }),
  submorphs: [
    {
      name: 'error label',
      type: 'label',
      textString: 'an error',
      fontSize: 20,
      fontColor: Color.red,
      fill: Color.rgba(255, 255, 255, 0)
    },
    part(InformIconOnLight, {
      name: 'exclamation mark',
      fontColor: Color.red,
      fontSize: 20
    })
  ]
});
