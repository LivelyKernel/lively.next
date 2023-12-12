import { PropertySection, PropertySectionModel } from './section.cp.js';
import { component, ViewModel, TilingLayout } from 'lively.morphic';
import { rect } from 'lively.graphics';
import { pt } from 'lively.graphics/geometry-2d.js';
import { Color } from 'lively.graphics/color.js';
import { add, part } from 'lively.morphic/components/core.js';
import { AddButton, PropertyLabelActive, PropertyLabelDisabled, DarkPopupWindow } from 'lively.ide/studio/shared.cp.js';
import { Text } from 'lively.morphic/text/morph.js';
import { ResponsiveLayoutHalo, getColorForBreakpoint } from 'lively.components/responsive.cp.js';
import { grid, arr, obj } from 'lively.lang';
import { disconnect, connect, signal, epiConnect } from 'lively.bindings';

import { ComponentSelection, ComponentSelectionDisabled } from './component.cp.js';
import { PopupModel } from './popups.cp.js';
import { ComponentBrowserPopupDark } from '../component-browser.cp.js';

class BreakpointEntryModel extends ViewModel {
  static get properties () {
    return {
      breakpoint: {
        defaultValue: { h: 0, v: 0 }
      },
      componentSelectionEnabled: { defaultValue: true },
      component: {},
      targetMorph: {},
      expose: { get () { return ['update', 'getBreakpointSpec']; } },
      targetStylePolicy: {
        get () {
          let stylePolicy = this.targetMorph.master;
          if (stylePolicy.overriddenMaster) stylePolicy = stylePolicy.overriddenMaster;
          return stylePolicy;
        }
      },
      bindings: {
        get () {
          return [{
            target: 'configure component button',
            signal: 'onMouseDown',
            handler: 'chooseComponent'
          }];
        }
      }
    };
  }

  getBreakpointSpec () {
    const store = this.targetStylePolicy?.getBreakpointStore();
    if (!store) {
      return;
    }
    return [pt(store._horizontalBreakpoints[this.breakpoint.h], store._verticalBreakpoints[this.breakpoint.v]), this.component];
  }

  update (targetMorph) {
    this.targetMorph = targetMorph;
    const store = this.targetStylePolicy?.getBreakpointStore();
    if (!store) return;
    const { horizontalPin, verticalPin, configureComponentButton } = this.ui;
    const {
      _verticalBreakpoints, _horizontalBreakpoints,
      _breakpointMasters
    } = store;
    const { v, h } = this.breakpoint;
    const vOffset = _verticalBreakpoints[v];
    const hOffset = _horizontalBreakpoints[h];
    this.component = grid.get(_breakpointMasters, v, h);
    const isSelected = obj.equals([v, h], store.getMatchingBreakpoint(targetMorph));
    horizontalPin.textString = `w: ${hOffset && hOffset.toFixed() || '*'} px`;
    horizontalPin.fill = getColorForBreakpoint(h, 'horizontal');
    horizontalPin.opacity = isSelected ? 1 : 0.5;
    verticalPin.textString = `h: ${vOffset && vOffset.toFixed() || '*'} px`;
    verticalPin.fill = getColorForBreakpoint(v, 'vertical');
    verticalPin.opacity = isSelected ? 1 : 0.5;
    if (!this.componentSelectionEnabled) configureComponentButton.master.setState('disabled');
    else {
      configureComponentButton.master.setState(this._popup ? 'active' : null);
    }
  }

  async chooseComponent () {
    if (!this.componentSelectionEnabled) return;
    this._popup = part(ComponentSelectionPopup, { // eslint-disable-line no-use-before-define
      viewModel: { component: this.component }
    }).openInWorld();
    this._popup.alignAtButton(this.ui.configureComponentButton);
    connect(this._popup, 'component changed', this, 'confirm');
    connect(this._popup, 'remove', () => {
      this._popup = null;
      this.update(this.targetMorph);
    });
    this.update(this.targetMorph);
  }

  confirm (selectedComponent) {
    this.component = selectedComponent;
    signal(this.view, 'component changed', selectedComponent);
  }
}

export const BreakpointEntry = component({
  name: 'breakpoint entry',
  defaultViewModel: BreakpointEntryModel,
  layout: new TilingLayout({
    axisAlign: 'center',
    padding: rect(20, 0, -20, 0),
    resizePolicies: [['padding', {
      height: 'fixed',
      width: 'fill'
    }]],
    spacing: 5
  }),
  fill: Color.rgba(255, 255, 255, 0),
  borderColor: Color.rgb(23, 160, 251),
  extent: pt(238, 30),
  position: pt(6.4, 8.9),
  submorphs: [add({
    type: Text,
    name: 'horizontal pin',
    textAndAttributes: ['w: 10px', null],
    borderRadius: 12,
    dynamicCursorColoring: true,
    extent: pt(98.7, 22.1),
    fill: Color.rgb(244, 67, 54),
    fixedHeight: true,
    fixedWidth: false,
    lineWrapping: true,
    padding: rect(5, 2, 0, -1),
    position: pt(7.1, 5.2)
  }), {
    type: Text,
    name: 'vertical pin',
    extent: pt(97, 20.3),
    borderRadius: 12,
    dynamicCursorColoring: true,
    fill: Color.rgb(76, 175, 80),
    fixedHeight: true,
    fixedWidth: false,
    lineWrapping: true,
    padding: rect(5, 2, 0, -1),
    position: pt(-27, 26),
    textAndAttributes: ['h: *', null]

  }, {
    name: 'padding',
    fill: Color.transparent
  }, add(part(AddButton, {
    master: {
      states: {
        active: PropertyLabelActive,
        disabled: PropertyLabelDisabled
      }
    },
    name: 'configure component button',
    padding: rect(4, 4, 0, 0),
    textAndAttributes: ['', {
      fontFamily: 'Tabler Icons',
      fontSize: 18,
      fontWeight: '900'
    }]
  }))]
});

class ComponentSelectionPopupModel extends PopupModel {
  static get properties () {
    return {
      isPropertiesPanelPopup: { get () { return true; } },
      isHaloItem: { get () { return true; } },
      expose: { get () { return ['close', 'isPropertiesPanelPopup', 'isHaloItem', 'alignAtButton']; } },
      component: {}
    };
  }

  get bindings () {
    return [
      ...super.bindings, {
        target: 'component controls',
        signal: 'componentChanged',
        handler: 'confirm'
      }];
  }

  viewDidLoad () {
    super.viewDidLoad();
    this.ui.componentControls.component = this.component;
  }

  confirm () {
    this.component = this.ui.componentControls.component;
    signal(this.view, 'component changed', this.component);
  }
}

// FIXME: this popup seems really unnessecary. the only thing it really does is display in more detail *which* component is mapped to that breakpoint
export const ComponentSelectionPopup = component(DarkPopupWindow, {
  defaultViewModel: ComponentSelectionPopupModel,
  layout: new TilingLayout({
    axis: 'column',
    axisAlign: 'center',
    hugContentsHorizontally: true,
    hugContentsVertically: true
  }),
  submorphs: [add(part(ComponentSelection, {
    master: { states: { disabled: ComponentSelectionDisabled } },
    name: 'component controls',
    layout: new TilingLayout({
      align: 'right',
      padding: rect(17, 10, -7, 0),
      resizePolicies: [['component name ref', {
        height: 'fixed',
        width: 'fill'
      }]],
      spacing: 5
    }),
    submorphs: [{
      name: 'policy type pin',
      visible: false
    }]
  })), {
    name: 'header menu',
    submorphs: [{
      name: 'title',
      textAndAttributes: ['Breakpoint Component', null]
    }]
  }]
});

export class ResponsiveControlModel extends PropertySectionModel {
  static get properties () {
    return {
      targetMorph: {},
      targetStylePolicy: {
        get () {
          let stylePolicy = this.targetMorph?.master;
          if (stylePolicy?.overriddenMaster) stylePolicy = stylePolicy.overriddenMaster;
          return stylePolicy;
        }
      },
      expose: {
        get () { return ['focusOn', 'activate']; }
      },
      responsiveHaloOpen: { get () { return this.targetMorph._responsiveHalo; } }
    };
  }

  get bindings () {
    return [
      ...super.bindings,
      { target: /breakpoint control/, signal: 'component changed', handler: 'confirm' }
    ];
  }

  update () {
    const bpStore = this.targetStylePolicy?.getBreakpointStore();
    if (!bpStore) {
      this.ui.controls.submorphs = [];
      return;
    }
    this.ui.controls.submorphs = [
      ...grid.map(bpStore._breakpointMasters, (master, v, h) => {
        return part(BreakpointEntry, {
          name: `breakpoint control ${v} ${h}`,
          viewModel: {
            componentSelectionEnabled: v !== 0 || h !== 0,
            breakpoint: { v, h }
          }
        });
      }).flat()
    ];
    this.refreshFromTarget();
  }

  toggleResponsiveHalo () {
    const h = this.targetMorph._responsiveHalo;
    if (h) {
      h.close();
    } else {
      part(ResponsiveLayoutHalo).openInWorld().focusOn(this.targetMorph);
    }
    this.update();
  }

  clearHalo () { this.targetMorph?._responsiveHalo?.close(); }

  refreshFromTarget () {
    this.ui.controls.submorphs.forEach(m => m.update(this.targetMorph));
  }

  focusOn (aMorph) {
    if (this.targetMorph) {
      disconnect(this.targetMorph, 'breakpoint removed', this, 'update');
      disconnect(this.targetMorph, 'breakpoint added', this, 'update');
      disconnect(this.targetMorph, 'breakpoint changed', this, 'refreshFromTarget');
      disconnect(this.targetMorph, 'extent', this, 'refreshFromTarget');
    }
    this.targetMorph = aMorph;
    epiConnect(this.targetMorph, 'breakpoint removed', this, 'update');
    epiConnect(this.targetMorph, 'breakpoint added', this, 'update');
    epiConnect(this.targetMorph, 'breakpoint changed', this, 'refreshFromTarget');
    epiConnect(this.targetMorph, 'extent', this, 'refreshFromTarget');
    if (this.targetStylePolicy?._breakpointStore) this.activate();
    else this.deactivate();
  }

  async activate () {
    super.activate();
    let policy = this.targetStylePolicy;
    if (!policy) {
      const proceed = await this.world().confirm(['Missing Base Style', { fontWeight: 'bold', fontSize: 20 }, '\nThe morph you want to configure a responsive design for, is not associated with any master component that defines its "base" style. In order to proceed you need to select a master component to serve as the base style.\n', { fontWeight: 'normal', fontSize: 18 }], {
        customize: (prompt) => {
          prompt.addStyleClass('Halo');
          prompt.isHaloItem = true;
        }
      });
      if (!proceed) return this.deactivate();
      const selectedComponent = await part(ComponentBrowserPopupDark, { hasFixedPosition: true, viewModel: { selectionMode: true } }).activate();
      if (!selectedComponent) return this.deactivate();
      const pos = this.targetMorph.position;
      this.targetMorph.master = selectedComponent;
      policy = this.targetStylePolicy;
      this.targetMorph.position = pos;
    }
    this.ui.controls.visible = true;
    if (!policy._breakpointStore) {
      policy.setBreakpoints([[pt(0, 0), policy.parent]]);
      this.refreshChangeTrackers();
      this.world().execCommand('show responsive halo for', { target: this.targetMorph });
    }
    // display the responsive layout halo
    this.update();
  }

  deactivate () {
    super.deactivate();
    this.ui.controls.visible = false;
    this.targetStylePolicy?.clearBreakpoints();
    this.targetMorph.master?.applyIfNeeded(true);
    this.refreshChangeTrackers();
    this.targetMorph._responsiveHalo?.close();
    this.update();
  }

  // FIXME: this is code duplication to lively.components/responsive.cp.js
  refreshChangeTrackers () {
    if (!this.targetMorph._changeTracker) return;
    this.targetMorph._changeTracker.processChangeInComponent({
      prop: 'master',
      meta: { reconcileChanges: true },
      target: this.targetMorph,
      value: this.targetStylePolicy
    });
  }

  getBreakpointSpec () {
    // extract the component spec from the ui controls
    return arr.compact(this.ui.controls.submorphs.map(bpControl => {
      return bpControl.getBreakpointSpec();
    }));
  }

  confirm () {
    this.targetStylePolicy.setBreakpoints(this.getBreakpointSpec());
    this.refreshChangeTrackers();
    this.targetMorph.master.applyIfNeeded(true);
  }
}

export const ResponsiveControl = component(PropertySection, {
  defaultViewModel: ResponsiveControlModel,
  layout: new TilingLayout({
    axis: 'column',
    hugContentsVertically: true,
    padding: rect(0, 10, 0, 0),
    resizePolicies: [['h floater', {
      height: 'fixed',
      width: 'fill'
    }]],
    spacing: 10
  }),
  submorphs: [{
    name: 'h floater',
    layout: new TilingLayout({
      axisAlign: 'center',
      justifySubmorphs: 'spaced',
      padding: rect(10, 0, 0, 0),
      spacing: 4
    }),
    submorphs: [{
      name: 'section headline',
      textAndAttributes: ['Responsive Design', null]
    }, {
      name: 'add button',
      tooltip: 'Add Breakpoint Masters'
    }, {
      name: 'remove button',
      tooltip: 'Disable Breakpoints'
    }]
  }, add({
    name: 'controls',
    layout: new TilingLayout({
      axis: 'column',
      hugContentsVertically: true,
      resizePolicies: [['breakpoint entry', {
        height: 'fixed',
        width: 'fill'
      }], ['responsive halo toggle', {
        height: 'fixed',
        width: 'fill'
      }]]
    }),
    fill: Color.rgba(255, 255, 255, 0),
    borderColor: Color.rgb(23, 160, 251),
    extent: pt(194.9, 144.5),
    position: pt(-64.5, 19.6),
    submorphs: [
      part(BreakpointEntry, { name: 'breakpoint entry' })
    ]
  })]
});
