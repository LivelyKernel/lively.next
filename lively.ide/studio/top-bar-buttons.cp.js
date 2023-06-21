import { component, ViewModel, Icon, part, TilingLayout, ShadowObject, Label } from 'lively.morphic';
import { Color, pt, rect } from 'lively.graphics';

class TopBarButtonModel extends ViewModel {
  static get properties () {
    return {
      expose: {
        get () {
          return ['activateButton', 'deactivateButton', 'changeIcon', 'getIcon'];
        }
      },
      opts: {}
    };
  }

  getIcon () {
    return this.ui.symbol.textAndAttributes;
  }

  changeIcon (iconAttributes) {
    this.ui.symbol.textAndAttributes = iconAttributes;
  }

  activateButton () {
    this.view.master = TopBarButtonSelected; // eslint-disable-line no-use-before-define
  }

  deactivateButton () {
    this.view.master = null;
  }
}

export const TopBarButton = component({
  type: Label,
  defaultViewModel: TopBarButtonModel,
  name: 'top bar button',
  lineHeight: 1,
  fontColor: Color.rgb(102, 102, 102),
  fontSize: 23,
  nativeCursor: 'pointer',
  padding: rect(0, 1, 0, -1)
});

export const TopBarButtonSelected = component(TopBarButton, {
  name: 'top bar button selected',
  dropShadow: new ShadowObject({ color: Color.rgba(64, 196, 255, 0.4), fast: false }),
  fontColor: Color.rgb(0, 176, 255)
});

class TopBarButtonDropDownModel extends TopBarButtonModel {
  static get properties () {
    return {
      opts: {}
    };
  }

  get expose () {
    return [...super.expose, 'removeDropdown'];
  }

  activateButton () {
    this.ui.symbol.master = TopBarButtonSelected;
  }

  deactivateButton () {
    this.ui.symbol.master = null;
  }

  viewDidLoad () {
    const { view, opts } = this;
    view.tooltip = opts.tooltip;
    const symbolButton = this.ui.symbol;
    symbolButton.tooltip = opts.symbol.tooltip;
    symbolButton.textAndAttributes = opts.symbol.textAndAttributes;
  }

  /**
   * This might seem non-sensical, but for the moment it allows us to "downgrade" a dropdown-equipped button if necessary
   * The more proper solution might be to unify the two types of buttons more,
   * or actually dealing with exchanging the button where we want to downgrade
   */
  removeDropdown () {
    this.ui.dropdown.remove();
  }
}

export const TopBarButtonDropDown = component({
  name: 'outer button name',
  defaultViewModel: TopBarButtonDropDownModel,
  extent: pt(55.8, 24.7),
  fill: Color.rgba(46, 75, 223, 0),
  layout: new TilingLayout({
    axisAlign: 'center',
    hugContentsHorizontally: true,
    align: 'center',
    padding: {
      height: 0,
      width: 0,
      x: 5,
      y: 5
    },
    spacing: 5
  }),
  nativeCursor: 'pointer',
  submorphs: [
    part(TopBarButton, {
      name: 'symbol',
      reactsToPointer: false,
      textAndAttributes: Icon.textAttribute('square'),
      tooltip: 'symbol tooltip'
    }),
    part(TopBarButton, {
      name: 'dropdown',
      fontSize: 23,
      nativeCursor: 'pointer',
      textAndAttributes: Icon.textAttribute('angle-down')
    })
  ],
  tooltip: 'dropdown tooltip'
});
