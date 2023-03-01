import { component, part, TilingLayout, ViewModel, Icon } from 'lively.morphic';
import { Color } from 'lively.graphics';

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
        defaultValue: 20
      }
    };
  }

  viewDidLoad () {
    this.ui.errorLabel.textString = this.information + ' ';
    this.ui.exclamationMark.tooltip = this.tooltip;
    this.view.tooltip = this.tooltip;

    this.view.height = this.height;

    this.ui.errorLabel.fontSize = this.fontsize;
  }
}

export const InputLineError = component({
  name: 'input line error',
  defaultViewModel: InputLineErrorModel,
  layout: new TilingLayout({ axisAlign: 'center', hugContentsHorizontally: true, renderViaCSS: false }),
  submorphs: [
    {
      name: 'error label',
      type: 'label',
      textString: 'an error',
      fontSize: 20,
      fontColor: Color.red,
      fill: Color.white.withA(0.9)
    },
    part(InformIconOnLight, {
      name: 'exclamation mark',
      fontColor: Color.red,
      fontSize: 20
    })
  ]
});
