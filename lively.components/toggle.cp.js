import { component, ViewModel, part } from 'lively.morphic/components/core.js';
import { Color } from 'lively.graphics/color.js';
import { pt, rect, Rectangle } from 'lively.graphics/geometry-2d.js';
import { TilingLayout } from 'lively.morphic/layout.js';
import { TopBarButton, TopBarButtonSelected, TopBarButtonUnselected } from 'lively.ide/studio/top-bar-buttons.cp.js';
import { Icon } from 'lively.morphic';
import { signal } from 'lively.bindings';

export class ToggleModel extends ViewModel {
  static get properties () {
    return {
      active: {
        defaultValue: false
      },
      iconInactive: {
        defaultValue: 'skull'
      },
      iconActive: {
        defaultValue: 'dragon'
      },
      labelActive: {
        defaultValue: 'label active'
      },
      labelInactive: {
        defaultValue: 'label inactive'
      },
      tooltip: { },
      expose: {
        get () {
          return ['active', 'tooltip'];
        }
      },
      bindings: {
        get () {
          return [
            { signal: 'onMouseDown', handler: 'toggle' }
          ];
        }
      }
    };
  }

  toggle () {
    this.active = !this.active;
    signal(this.view, 'toggeled', this.active);
  }

  onRefresh () {
    const { toggleIndicator, label, icon } = this.ui;
    if (this.active) {
      label.master.setState('selected');
      icon.master.setState('selected');
      toggleIndicator.master.setState('selected');
    } else {
      label.master.setState(null);
      icon.master.setState(null);
      toggleIndicator.master.setState(null);
    }

    toggleIndicator.textAndAttributes = Icon.textAttribute(this.active ? 'toggle-on' : 'toggle-off');
    icon.textAndAttributes = Icon.textAttribute(this.active ? this.iconActive : this.iconInactive);
    label.textString = this.active ? this.labelActive : this.labelInactive;
    this.view.tooltip = this.tooltip;
  }
}

export const Toggle = component({
  defaultViewModel: ToggleModel,
  name: 'fast load toggler',
  borderColor: Color.rgb(23, 160, 251),
  extent: pt(115.3, 41.1),
  fill: Color.rgba(0, 0, 0, 0),
  layout: new TilingLayout({
    axisAlign: 'center',
    align: 'center',
    direction: 'rightToLeft',
    hugContentsHorizontally: true,
    orderByIndex: true,
    padding: Rectangle.inset(5, 5, 0, 5),
    reactToSubmorphAnimations: false,
    renderViaCSS: true,
    spacing: 5
  }),
  submorphs: [
    part(TopBarButton, {
      name: 'icon',
      fontSize: 16,
      padding: rect(0, 4, 0, -4),
      textAndAttributes: Icon.textAttribute('dragon')
    }), part(TopBarButton, {
      name: 'label',
      fontSize: 16,
      textAndAttributes: ['Fast Load', null]
    }), part(TopBarButton, {
      name: 'toggle indicator',
      fontSize: 23,
      nativeCursor: 'pointer',
      textAndAttributes: Icon.textAttribute('toggle-off')
    })]
});

const TopBarButtonUnselectedLight = component(TopBarButtonUnselected, {
  fontColor: Color.white
});

const TopBarButtonSelectedLight = component(TopBarButtonSelected, {
  fontColor: Color.rgb(99, 207, 255)
});

const TopBarButtonLight = component(TopBarButtonUnselectedLight, {
  master: {
    states: {
      selected: TopBarButtonSelectedLight
    }
  }
});

export const LightToggle = component(Toggle, {
  submorphs: [
    {
      name: 'icon',
      fontSize: 16,
      master: TopBarButtonLight
    },
    {
      name: 'label',
      fontSize: 16,
      master: TopBarButtonLight
    },
    {
      name: 'toggle indicator',
      master: TopBarButtonLight
    }
  ]
});
