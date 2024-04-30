import { component } from 'lively.morphic/components/core.js';
import { PropertySection, PropertySectionModel } from './section.cp.js';
import { TilingLayout, ViewModel, part, add } from 'lively.morphic';
import { rect, Color } from 'lively.graphics';
import { TextInput, AddButton } from '../shared.cp.js';
import { pt } from 'lively.graphics/geometry-2d.js';
import { Text } from 'lively.morphic/text/morph.js';
import { ComponentBrowserPopupDark } from '../component-browser.cp.js';
import { signal, once } from 'lively.bindings';
import { string, obj } from 'lively.lang';
import { ExpressionSerializer } from 'lively.serializer2';

export class ComponentSelectionControl extends ViewModel {
  static get properties () {
    return {
      control: {},
      component: {},
      moduleInfo: {},
      editable: { defaultValue: false },
      stateName: { defaultValue: 'AUTO' },
      expose: { get () { return ['component', 'stateName', 'closePopup', 'control', 'moduleInfo']; } },
      bindings: {
        get () {
          return [{
            target: 'select component button', signal: 'onMouseDown', handler: 'selectComponent'
          }, {
            target: 'no component button', signal: 'onMouseDown', handler: 'clearComponent'
          }, {
            target: 'policy type pin', signal: 'onKeyDown', handler: 'onInputStateName'
          }, {
            target: 'policy type pin', signal: 'onBlur', handler: 'confirmStateName'
          }, {
            target: 'policy type pin', signal: 'onFocus', handler: 'startEditingStateName'
          }];
        }
      }
    };
  }

  viewDidLoad () {
    this.onRefresh('component');
  }

  async onRefresh (prop) {
    this.ui.policyTypePin.textString = this.stateName;
    if (prop !== 'editable') {
      await this.ui.policyTypePin.whenFontLoaded();
      this.ui.policyTypePin.fit();
      this.ui.policyTypePin.readOnly = !this.editable;
      this.ui.policyTypePin.nativeCursor = this.editable ? 'text' : 'auto';
    }
    if (prop === 'component') {
      this.component ? this.activate() : this.deactivate();
    }
  }

  clearComponent () {
    this.component = null;
    signal(this.view, 'componentChanged');
  }

  onInputStateName (evt) {
    const { policyTypePin } = this.ui;
    if (evt.key === 'Enter') {
      policyTypePin.textString = policyTypePin.textString.replace('\n', '');
      this.view.focus();
    }
  }

  startEditingStateName () {
    if (!this.editable) return;
    this.ui.policyTypePin.master.setState('focused');
  }

  confirmStateName () {
    if (!this.editable) return;
    this.ui.policyTypePin.master.setState(null);
    this.stateName = this.ui.policyTypePin.textString;
    if (this.component) signal(this.view, 'componentChanged');
  }

  async selectComponent () {
    await $world.withLoadingIndicatorDo(async () => {
      this.control?.closePopup();
      this._componentBrowserPopup = part(ComponentBrowserPopupDark, { hasFixedPosition: true, viewModel: { selectionMode: true } });

      const closestComponent = this.component || this.control?.targetMaster;
      if (closestComponent) {
        const descr = new ExpressionSerializer().deserializeExprObj(closestComponent.__serialize__());
        await this._componentBrowserPopup.browse(descr);
      } else if (this.moduleInfo) {
        const descr = new ExpressionSerializer().deserializeExprObj({
          __expr__: this.moduleInfo.exportedName,
          bindings: { [this.moduleInfo.moduleId]: [this.moduleInfo.exportedName] }
        });
        await this._componentBrowserPopup.browse(descr);
      }
      once(this._componentBrowserPopup, 'close', this, 'closePopup');
    }, $world, 'Opening Component Browser...');
    const selectedComponent = await this._componentBrowserPopup.activate();
    if (selectedComponent) {
      this.component = selectedComponent;
      signal(this.view, 'componentChanged');
    }
  }

  closePopup () {
    if (!this._componentBrowserPopup) return;
    this._componentBrowserPopup.close();
    this._componentBrowserPopup = null;
  }

  deactivate () {
    this.ui.componentNameRef.input = '';
    this.view.master.setState('disabled');
  }

  activate () {
    if (this.component) {
      this.ui.componentNameRef.input = this.component[Symbol.for('lively-module-meta')]?.exportedName;
    }
    if (this.view.master.getState() !== 'immutable') this.view.master.setState(null);
  }
}

const PolicyPin = component({
  type: Text,
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
  lineWrapping: 'by-words',
  padding: rect(5, 1, 0, 0),
  position: pt(-55, 30)
});

const PolicyPinFocused = component(PolicyPin, {
  borderWidth: 1,
  borderColor: Color.rgb(206, 147, 216),
  fill: Color.rgba(178, 235, 242, 0),
  fontColor: Color.rgb(206, 147, 216),
  padding: rect(4, 0, 0, 0)
});

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
  submorphs: [part(PolicyPin, {
    name: 'policy type pin'
  }), part(TextInput, {
    name: 'component name ref',
    placeholder: 'no component',
    padding: rect(4, 2, -2, 2),
    readOnly: true,
    textAndAttributes: ['sfhgs', null]
  }), part(AddButton, {
    name: 'select component button',
    tooltip: 'Select Component',
    padding: rect(4, 4, 0, 0),
    textAndAttributes: ['', {
      fontFamily: 'Font Awesome',
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
      fill: Color.rgb(206, 147, 216)
    }, {
      name: 'no component button',
      padding: rect(4, 2, 0, 2),
      tooltip: 'Remove this custom component state.',
      textAndAttributes: ['', {
        fontFamily: 'Font Awesome',
        fontWeight: '900'
      }]
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

export const ComponentSelectionImmutable = component(ComponentSelection, {
  submorphs: [{
    name: 'no component button',
    visible: false
  }]
});

export class ComponentControlModel extends PropertySectionModel {
  static get properties () {
    return {
      expose: {
        get () { return ['focusOn', 'targetMaster']; }
      }
    };
  }

  get bindings () {
    return [
      ...super.bindings,
      { target: /component selection/, signal: 'componentChanged', handler: 'confirm' }
    ];
  }

  get targetMaster () {
    const { auto, hover, click } = this.targetMorph.master?.getConfig() || {};
    return auto || hover || click;
  }

  viewDidLoad () {
    const { autoComponentSelection, hoverComponentSelection, clickComponentSelection } = this.ui;
    autoComponentSelection.control = this;
    hoverComponentSelection.control = this;
    clickComponentSelection.control = this;
  }

  confirm () {
    const { autoComponentSelection, hoverComponentSelection, clickComponentSelection } = this.ui;
    const pos = this.targetMorph.position;
    // the parent is always preserved, since we can not alter the structural inheritance here
    if (this.targetMorph.master) {
      const previousMasterConfig = this.targetMorph.master.getConfig() || {};
      const bps = previousMasterConfig.breakpoints;
      if (bps) bps[0][1] = autoComponentSelection.component;
      this.targetMorph.master.applyConfiguration({
        ...previousMasterConfig,
        // also insert the breakpoint [0] if present
        ...bps ? { breakpoints: bps } : { auto: autoComponentSelection.component },
        hover: hoverComponentSelection.component,
        click: clickComponentSelection.component
      });
      this.targetMorph.master.updateSplitPolicies();
      const policy = this.targetMorph.master.copy();
      policy.attach(this.targetMorph);
      policy.apply(this.targetMorph);
      this.targetMorph.withMetaDo({ reconcileChanges: true }, () => {
        this.targetMorph.setProperty('master', policy); // trigger onChange
      });
    } else {
      this.targetMorph.withMetaDo({ reconcileChanges: true }, () => {
        this.targetMorph.master = {
          auto: autoComponentSelection.component,
          hover: hoverComponentSelection.component,
          click: clickComponentSelection.component
        };
      });
    }
    this.targetMorph.position = pos;
    signal(this.view, 'component changed');
  }

  update () {
    const meta = this.targetMorph[Symbol.for('lively-module-meta')];
    let stylePolicy = this.targetMorph.master;
    let autoMaster, hoverMaster, clickMaster;
    while (true) {
      if (stylePolicy._breakpointStore) {
        autoMaster = stylePolicy._breakpointStore._breakpointMasters[0][0];
        if (autoMaster) break;
      }
      if (stylePolicy._autoMaster) {
        autoMaster = stylePolicy._autoMaster;
        if (autoMaster[Symbol.for('lively-module-meta')]?.path.length > 0) {
          stylePolicy = autoMaster;
          continue;
        }
        break;
      }
      if (!stylePolicy.parent) {
        if (!stylePolicy.targetMorph?.isComponent || stylePolicy !== this.targetMorph.master) autoMaster = stylePolicy;
        break;
      }
      if (stylePolicy.parent) stylePolicy = stylePolicy.parent;
      else break;
    }
    let canChangeAuto = stylePolicy === this.targetMorph.master;

    stylePolicy = this.targetMorph.master;
    while (true) {
      if (stylePolicy._hoverMaster) { hoverMaster = stylePolicy._hoverMaster; break; }
      if (stylePolicy.parent) stylePolicy = stylePolicy.parent;
      else break;
    }
    let canChangeHover = stylePolicy === this.targetMorph.master;

    stylePolicy = this.targetMorph.master;
    while (true) {
      if (stylePolicy._clickMaster) {
        clickMaster = stylePolicy._clickMaster;
        break;
      }
      if (stylePolicy.parent) stylePolicy = stylePolicy.parent;
      else break;
    }
    let canChangeClick = stylePolicy === this.targetMorph.master;

    const { autoComponentSelection, hoverComponentSelection, clickComponentSelection } = this.ui;
    this.withoutBindingsDo(() => {
      autoComponentSelection.master.setState(canChangeAuto ? null : 'immutable');
      autoComponentSelection.component = autoMaster;
      autoComponentSelection.moduleInfo = meta;
      hoverComponentSelection.master.setState(canChangeHover ? null : 'immutable');
      hoverComponentSelection.component = hoverMaster;
      hoverComponentSelection.moduleInfo = meta;
      clickComponentSelection.master.setState(canChangeClick ? null : 'immutable');
      clickComponentSelection.component = clickMaster;
      clickComponentSelection.moduleInfo = meta;
    });
  }

  focusOn (aMorph) {
    this.targetMorph = aMorph;
    if (!aMorph.master) this.deactivate();
    else this.activate();
  }

  closePopup () {
    this.view.withAllSubmorphsDo(m => m.closePopup && m.control && m.closePopup());
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
    if (!this.targetMorph.master) {
      this.targetMorph.master = {};
      signal(this.view, 'component changed');
    }
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
    master: { states: { disabled: ComponentSelectionDisabled, immutable: ComponentSelectionImmutable } },
    viewModel: { stateName: 'AUTO' },
    name: 'auto component selection'
  })),
  add(part(ComponentSelection, {
    master: { states: { disabled: ComponentSelectionDisabled, immutable: ComponentSelectionImmutable } },
    viewModel: { stateName: 'CLICK' },
    name: 'click component selection'
  })),
  add(part(ComponentSelection, {
    master: { states: { disabled: ComponentSelectionDisabled, immutable: ComponentSelectionImmutable } },
    viewModel: { stateName: 'HOVER' },
    name: 'hover component selection'
  }))]
});

class ComponentStatesControlModel extends PropertySectionModel {
  static get properties () {
    return {
      expose: {
        get () { return ['focusOn', 'closePopup']; }
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
    let states = {};
    for (let { stateName, component } of this.getStatesConfig()) {
      if (component) states[stateName] = component;
    }
    const prevMaster = this.targetMorph.master.getConfig() || {};
    if (obj.isEmpty(states)) {
      delete prevMaster.states;
    } else prevMaster.states = states;

    this.targetMorph.master.applyConfiguration(prevMaster);
    const policy = this.targetMorph.master.copy();
    policy.attach(this.targetMorph);
    policy.apply(this.targetMorph);
    this.targetMorph.withMetaDo({ reconcileChanges: true }, () => {
      this.targetMorph.setProperty('master', policy); // trigger onChange
    });

    this.focusOn(this.targetMorph);
  }

  getStatesConfig () {
    return this.ui.stateControls.submorphs.map(({ stateName, component }) => ({
      stateName, component
    }));
  }

  getComponentStates () {
    let statesHoldingPolicy = this.targetMorph.master;
    let states = statesHoldingPolicy?._localComponentStates;
    while (!states) {
      statesHoldingPolicy = statesHoldingPolicy?.parent;
      if (!statesHoldingPolicy) { states = []; break; }
      states = statesHoldingPolicy._localComponentStates;
    }
    return states;
  }

  ensureDynamicControls () {
    this.view.master.setState(null);
    const { stateControls } = this.ui;
    stateControls.visible = true;
    stateControls.submorphs = Object.entries(this.getComponentStates()).map(([stateName, component]) => {
      return part(CustomStateComponentSelection, {
        name: 'component selection',
        viewModel: { stateName, component, editable: true, control: this },
        submorphs: [
          { name: 'policy type pin', master: { states: { focused: PolicyPinFocused } } }
        ]
      });
    });
    stateControls.submorphs.forEach(m => {
      stateControls.layout.setResizePolicyFor(m, {
        width: 'fill', height: 'fixed'
      });
    });
  }

  getNewStateName () {
    let candidate = 'State_1';
    const currentStates = this.getStatesConfig().map(({ stateName }) => stateName);
    while (currentStates.includes(candidate)) candidate = string.incName(candidate);
    return candidate;
  }

  addDynamicState () {
    const selectionControl = this.ui.stateControls.addMorph(part(CustomStateComponentSelection, {
      name: 'component selection',
      viewModel: { stateName: this.getNewStateName(), editable: true, control: this },
      submorphs: [
        { name: 'policy type pin', master: { states: { focused: PolicyPinFocused } } }
      ]
    }));
    this.ui.stateControls.layout.setResizePolicyFor(selectionControl, {
      width: 'fill', height: 'fixed'
    });
  }

  closePopup () {
    this.view.withAllSubmorphsDo(m => m.closePopup && m.control && m.closePopup());
  }

  focusOn (aMorph) {
    this.targetMorph = aMorph;
    if (this.getComponentStates().length === 0) {
      this.deactivate();
      return;
    }
    this.ensureDynamicControls();
  }

  activate () {
    this.view.master.setState(null);
    this.ui.stateControls.visible = true;

    this.addDynamicState();
  }

  deactivate () {
    super.deactivate();
    this.ui.stateControls.visible = false;
    this.ui.stateControls.submorphs = [];
  }
}

const ComponentStatesControl = component(PropertySection, {
  viewModelClass: ComponentStatesControlModel,
  layout: new TilingLayout({
    axis: 'column',
    hugContentsVertically: true,
    padding: rect(0, 10, 0, 0),
    resizePolicies: [['h floater', {
      height: 'fixed',
      width: 'fill'
    }], ['state controls', {
      height: 'fixed',
      width: 'fill'
    }]],
    spacing: 10
  }),
  submorphs: [add({
    name: 'state controls',
    layout: new TilingLayout({
      axis: 'column',
      hugContentsVertically: true
    }),
    fill: Color.rgba(255, 255, 255, 0),
    borderColor: Color.rgb(23, 160, 251),
    extent: pt(107.7, 107.1),
    position: pt(-29.6, 24.5),
    visible: false
  }), {
    name: 'h floater',
    submorphs: [{
      name: 'section headline',
      textAndAttributes: ['Component States', null]

    }]
  }]
});

export { ComponentControl, ComponentStatesControl };
