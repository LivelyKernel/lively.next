import { component } from 'lively.morphic/components/core.js';
import { PropertySection, PropertySectionModel } from './section.cp.js';
import { TilingLayout, ViewModel, part, add } from 'lively.morphic';
import { rect, Color } from 'lively.graphics';
import { TextInput, AddButton } from '../shared.cp.js';
import { pt } from 'lively.graphics/geometry-2d.js';
import { Text } from 'lively.morphic/text/morph.js';
import { ComponentBrowserPopupDark } from '../component-browser.cp.js';
import { signal } from 'lively.bindings';

export class ComponentSelectionControl extends ViewModel {
  static get properties () {
    return {
      component: {
        set (componentDescriptor) {
          this.setProperty('component', componentDescriptor);
          componentDescriptor ? this.activate() : this.deactivate();
          this.ui.policyTypePin.fit(); // FIXME: why do we need to trigger this manually?
        }
      },
      expose: { get () { return ['component']; } },
      bindings: {
        get () {
          return [{
            target: 'select component button', signal: 'onMouseDown', handler: 'selectComponent'
          }, {
            target: 'no component button', signal: 'onMouseDown', handler: 'clearComponent'
          }];
        }
      }
    };
  }

  clearComponent () {
    this.component = null;
    signal(this.view, 'componentChanged');
  }

  async selectComponent () {
    const selectedComponent = await part(ComponentBrowserPopupDark, { hasFixedPosition: true, viewModel: { selectionMode: true } }).activate();
    if (selectedComponent) {
      this.component = selectedComponent;
      signal(this.view, 'componentChanged');
    }
  }

  deactivate () {
    this.ui.componentNameRef.input = '';
    this.view.master.setState('disabled');
  }

  activate () {
    if (this.component) {
      this.ui.componentNameRef.input = this.component[Symbol.for('lively-module-meta')].exportedName;
    }
    this.view.master.setState(null);
  }
}

export const ComponentSelection = component({
  defaultViewModel: ComponentSelectionControl,
  name: 'selection controls',
  extent: pt(242.9, 45.7),
  layout: new TilingLayout({
    align: 'right',
    padding: rect(17, 10, -7, 0),
    resizePolicies: [['component name ref', {
      height: 'fixed',
      width: 'fill'
    }]],
    spacing: 5
  }),
  fill: Color.rgba(255, 255, 255, 0),
  borderColor: Color.rgb(23, 160, 251),
  submorphs: [{
    type: Text,
    name: 'policy type pin',
    fontColor: Color.rgb(66, 73, 73),
    borderRadius: 17,
    fontFamily: '"IBM Plex Mono"',
    fontWeight: 700,
    textAlign: 'left',
    textAndAttributes: ['AUTO', null],
    borderColor: Color.rgb(23, 160, 251),
    cursorWidth: 1.5,
    dynamicCursorColoring: true,
    extent: pt(53.5, 19.8),
    fill: Color.rgb(178, 235, 242),
    lineWrapping: true,
    padding: rect(5, 1, 0, 0),
    position: pt(-55, 30)
  }, part(TextInput, {
    name: 'component name ref',
    placeholder: 'no component',
    padding: rect(4, 2, -2, 2),
    readOnly: true,
    textAndAttributes: ['sfhgs', null]
  }), part(AddButton, {
    name: 'select component button',
    tooltip: 'Select Component for Breakpoint',
    padding: rect(4, 4, 0, 0),
    textAndAttributes: ['', {
      fontFamily: '"Font Awesome 6 Free", "Font Awesome 6 Brands"',
      fontWeight: '900'
    }]
  }),
  part(AddButton, {
    name: 'no component button',
    tooltip: 'Clear Component',
    fontSize: 15,
    padding: rect(4, 4, 0, 0),
    textAndAttributes: ['', {
      fontFamily: 'Material Icons',
      fontWeight: '900'
    }]
  })]
});

export const CustomStateComponentSelection = component(ComponentSelection, {
  submorphs: [
    {
      name: 'policy type pin',
      fill: Color.rgb(206, 147, 216),
      readOnly: false
    }
  ]
});

export const ComponentSelectionDisabled = component(ComponentSelection, {
  submorphs: [{
    name: 'policy type pin',
    opacity: 0.3
  }, {
    name: 'component name ref',
    opacity: 0.3,
    textAndAttributes: []
  }, {
    name: 'no component button',
    visible: false
  }]
});

export class ComponentControlModel extends PropertySectionModel {
  static get properties () {
    return {
      expose: {
        get () { return ['focusOn']; }
      }
    };
  }

  get bindings () {
    return [
      ...super.bindings,
      { target: /component selection/, signal: 'componentChanged', handler: 'confirm' }
    ];
  }

  confirm () {
    const { autoComponentSelection, hoverComponentSelection, clickComponentSelection } = this.ui;
    const pos = this.targetMorph.position;
    const previousMaster = this.targetMorph.master?.getConfig() || {};
    this.targetMorph.withMetaDo({ reconcileChanges: true }, () => {
      this.targetMorph.master = {
        ...previousMaster,
        auto: autoComponentSelection.component,
        hover: hoverComponentSelection.component,
        click: clickComponentSelection.component
      };
      if (!this.targetMorph.master.overriddenMaster) { this.targetMorph.master._isOverridden = true; }
    });
    this.targetMorph.position = pos;
    signal(this.view, 'component changed');
  }

  update () {
    let stylePolicy = this.targetMorph.master;
    if (stylePolicy.overriddenMaster) stylePolicy = stylePolicy.overriddenMaster;
    const { autoComponentSelection, hoverComponentSelection, clickComponentSelection } = this.ui;
    this.withoutBindingsDo(() => {
      autoComponentSelection.component = stylePolicy?._parent;
      hoverComponentSelection.component = stylePolicy?._hoverMaster;
      clickComponentSelection.component = stylePolicy?._clickMaster;
    });
  }

  focusOn (aMorph) {
    this.targetMorph = aMorph;
    if (!aMorph.master) this.deactivate();
    else this.activate();
  }

  deactivate () {
    const { autoComponentSelection, hoverComponentSelection, clickComponentSelection } = this.ui;
    super.deactivate();
    autoComponentSelection.visible = false;
    hoverComponentSelection.visible = false;
    clickComponentSelection.visible = false;
    if (this.targetMorph.master) {
      this.targetMorph.withMetaDo({ reconcileChanges: true }, () => {
        this.targetMorph.master = null;
      });
      signal(this.view, 'component changed');
    }
  }

  activate () {
    const { autoComponentSelection, hoverComponentSelection, clickComponentSelection } = this.ui;
    super.activate();
    if (!this.targetMorph.master) this.targetMorph.master = {};
    autoComponentSelection.visible = true;
    hoverComponentSelection.visible = true;
    clickComponentSelection.visible = true;
    this.update();
  }
}

const ComponentControl = component(PropertySection, {
  defaultViewModel: ComponentControlModel,
  name: 'component control',
  extent: pt(223.4, 188),
  layout: new TilingLayout({
    axis: 'column',
    hugContentsVertically: true,
    padding: rect(0, 10, 0, 0),
    resizePolicies: [['h floater', {
      height: 'fixed',
      width: 'fill'
    }], ['auto component selection', {
      height: 'fixed',
      width: 'fill'
    }], ['click component selection', {
      height: 'fixed',
      width: 'fill'
    }], ['hover component selection', {
      height: 'fixed',
      width: 'fill'
    }]]
  }),
  submorphs: [{
    name: 'h floater',
    submorphs: [{
      name: 'section headline',
      textAndAttributes: ['Component', null]
    }]
  }, add(part(ComponentSelection, {
    master: { states: { disabled: ComponentSelectionDisabled } },
    name: 'auto component selection'
  })),
  add(part(ComponentSelection, {
    master: { states: { disabled: ComponentSelectionDisabled } },
    name: 'click component selection',
    submorphs: [{
      name: 'policy type pin',
      textAndAttributes: ['CLICK', null]
    }]
  })),
  add(part(ComponentSelection, {
    master: { states: { disabled: ComponentSelectionDisabled } },
    name: 'hover component selection',
    submorphs: [{
      name: 'policy type pin',
      textAndAttributes: ['HOVER', null]
    }]
  }))]
});

export { ComponentControl };
