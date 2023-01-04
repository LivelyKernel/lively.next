import { TilingLayout, ShadowObject, component, ViewModel, part } from 'lively.morphic';
import { Color, rect, pt } from 'lively.graphics';
import { obj, arr } from 'lively.lang';
import { once, noUpdate, connect } from 'lively.bindings';

import { ShadowPopup, OpacityPopup, FlipPopup, TiltPopup, CursorPopup, BlurPopup, InsetShadowPopup } from './popups.cp.js';
import { PropertySection, PropertySectionModel } from './section.cp.js';
import { PropertyLabel, RemoveButton, DarkThemeList, EnumSelector, PropertyLabelActive, PropertyLabelHovered } from '../shared.cp.js';

/**
  Controls the morph's "body" which comprises all of the dynamic effect properties.
*/
export class BodyControlModel extends PropertySectionModel {
  static get properties () {
    return {
      targetMorph: {},
      dynamicPropertyComponent: {
        isComponent: true,
        get () {
          return this.getProperty('dynamicPropertyComponent') || DynamicProperty; // eslint-disable-line no-use-before-define
        }
      },
      activeSectionComponent: {
        isComponent: true,
        get () {
          return this.getProperty('activeSectionComponent') || PropertySection; // eslint-disable-line no-use-before-define
        }
      },
      propConfig: {
        get () {
          return this.getProperty('propConfig') || PROP_CONFIG; // eslint-disable-line no-use-before-define
        }
      },
      availableItems: {
        derived: true,
        get () {
          const res = arr.withoutAll(Object.keys(this.propConfig), this.dynamicControls.map(m => m.selectedProp));
          if (!res.includes('Drop shadow') || !res.includes('Inner shadow')) {
            // exclude all shadows if one is applied
            return arr.withoutAll(res, ['Drop shadow', 'Inner shadow']);
          }
          return res;
        }
      },
      dynamicControls: {
        derived: true,
        get () {
          return this.view?.submorphs.filter(m => m.isControl) || [];
        }
      }
    };
  }

  get addEffectButton () {
    return this.ui.addButton;
  }

  disableAddEffectButton () {
    this.addEffectButton.reactsToPointer = false;
    this.addEffectButton.visible = false;
  }

  enableAddEffectButton () {
    this.addEffectButton.reactsToPointer = true;
    this.addEffectButton.visible = true;
  }

  /**
   * Sets the current morph the effects control is focused on.
   * @params { Morph } aMorph - The morph to be focused on.
   */
  focusOn (aMorph) {
    this.targetMorph = aMorph;
    this.ensureDynamicControls();
    // enable adding effects when we come from a morph which had all available effects applied
    this.enableAddEffectButton();
    // disable adding effects if the selected morph already has all effects applied
    if (this.availableItems.length === 0) this.disableAddEffectButton();
  }

  /**
   * Ensure that the dynamic controls applicable to the currently
   * focused morph are displayed. These are essentially alle the
   * effect-properties that diverge from the default value.
   */
  ensureDynamicControls () {
    this.dynamicControls.forEach(m => m.remove());
    // FIXME: adjusting the resize policies should automatically cause an override
    this.view.layout = this.view.layout; // ensure the layout is overridden
    for (const prop in this.propConfig) { // eslint-disable-line no-use-before-define
      const { resetValue, accessor } = this.propConfig[prop]; // eslint-disable-line no-use-before-define
      if (!obj.equals(resetValue, this.targetMorph[accessor])) {
        if (prop === 'Inner shadow' && !this.targetMorph[accessor].inset) continue;
        if (prop === 'Drop shadow' && this.targetMorph[accessor].inset) continue;
        this.addDynamicProperty(prop, false, false);
      }
    }
    this.refreshItemLists();
    this.deactivate();
  }

  /**
   * The set of items selectable in the drop downs of the
   * dynamic controls varies depending on the currently
   * applied effects. This method ensure that only the available
   * items can be selected inside the drop downs. It needs to be invoked
   * any time the set of applied effects changes.
   */
  refreshItemLists () {
    if (this._refreshing) return;
    this._refreshing = true;
    this.dynamicControls.forEach(ctrl => ctrl.refreshItems(this.availableItems));
    this._refreshing = false;
  }

  /**
   * Applies an additional effect(property) to the current morph.
   * @param { String } selectedProp - The name of the property this effect is controlled by.
   * @param { Boolean } refresh - Wether or not the selectable items of all the other dynamic
   *                              properties should be updated. Skipping this can make sense
   *                              for bulk updates.
   */
  addDynamicProperty (selectedProp, reset = true, applyDefault = true) {
    const { targetMorph, propConfig } = this;
    const control = this.view.addMorph(part(this.dynamicPropertyComponent, { viewModel: { targetMorph, propConfig } }));
    this.view.layout.setResizePolicyFor(control, { height: 'fixed', width: 'fill' });
    if (!selectedProp) selectedProp = this.availableItems[0];
    control.choose(selectedProp, reset, applyDefault);
    control.refreshItems(this.availableItems);
    if (this.availableItems.length === 0) {
      this.disableAddEffectButton();
    }
    once(control.viewModel, 'remove', this, 'deactivate');
    connect(control.viewModel, 'selectedProp', this, 'refreshItemLists');
  }

  /**
   * If no effects are applied to the current morph this will
   * add a first default effect to the morph which can in turn be
   * configured as needed.
   */
  activate () {
    this.view.layout = this.view.layout.with({ padding: rect(0, 10, 0, 10) });
    this.view.master = this.activeSectionComponent; // eslint-disable-line no-use-before-define
    this.addDynamicProperty(null, false);
  }

  /**
   * This is only invoked when all applied effects are removed from a morph
   * or if the morph does not have any applied effects to begin with.
   * Ensures that the appearance of the body control is faded out.
   */
  deactivate () {
    if (this.availableItems.length === 1 || (this.availableItems.includes('Drop shadow') && this.availableItems.length === 2)) {
      this.enableAddEffectButton();
    }
    this.refreshItemLists();
    // close any open popups
    this.dynamicControls.forEach(ctr => ctr.closePopup());
    if (this.dynamicControls.length > 0) {
      this.view.master = this.activeSectionComponent; // eslint-disable-line no-use-before-define
      return;
    }
    this.view.layout = this.view.layout.with({ padding: rect(0, 10, 0, 0) });
    this.view.master = { auto: this.inactiveSectionComponent, hover: this.hoverSectionComponent };
  }
}

/**
  Dynamic properties are effects like Opacity, Blur or Drop-shadow that can
  be applied to a morph as needed. Each of these is managed individually
  by this controller.
*/
export class DynamicPropertyModel extends ViewModel {
  static get properties () {
    return {
      targetMorph: {},
      selectedProp: {
        // secure this separately
        defaultValue: 'Opacity'
      },
      accessor: {
        get () {
          return this.propConfig[this.selectedProp].accessor;
        }
      },
      propConfig: {
        serialize: false, // Dynamic properties are ephemeral, so we dont care
        get () {
          return this.getProperty('propConfig') || PROP_CONFIG; // eslint-disable-line no-use-before-define
        }
      },
      popupComponent: {
        readOnly: true,
        serialize: false,
        get () {
          return this.propConfig[this.selectedProp].popupComponent;
        }
      },
      isControl: { get () { return true; } },
      expose: {
        get () { return ['refreshItems', 'chooseDefault', 'isControl', 'selectedProp', 'choose', 'closePopup', 'applyDefault']; }
      },
      bindings: {
        get () {
          return [
            { model: 'effect selector', signal: 'selection', handler: 'selectProperty', updated: ($upd) => $upd(true, true) },
            { target: 'open popup', signal: 'onMouseDown', handler: 'togglePopup' },
            { target: 'remove', signal: 'onMouseDown', handler: 'remove' }];
        }
      }
    };
  }

  /**
   * Programatically sets the selected property of this dynamic property.
   * @param { string } prop - The name of the dynamic property.
   * @param { boolean } [resetValue = false] - Wether or not to reset the previously selected property on the target morph.
   * @param { boolean } [applyDefault = false] - Wether or not to apply the default value of the chosen property right away.
   */
  choose (prop, resetValue = true, applyDefault = false) {
    noUpdate(() => {
      this.ui.effectSelector.selection = prop;
    });
    this.selectProperty(resetValue, applyDefault);
  }

  /**
   * Automatically selects the first effect property currently
   * available.
   */
  chooseDefault () {
    this.choose(this.ui.effectSelector.items[0].value);
  }

  /**
   * Sets the selected property based on the selection in the UI
   * controlled by the user.
   * @param { boolean } [resetValue = false] - Wether or not to reset the previously selected property on the target morph.
   * @param { boolean } [applyDefault = false] - Wether or not to apply the default value of the chosen property right away.
   */
  selectProperty (resetValue = false, applyDefault = false) {
    const { effectSelector } = this.ui;
    if (resetValue &&
        this.selectedProp &&
        this.selectedProp !== effectSelector.selection) {
      this.resetProperty(); // only when we do that interactively
    }
    this.selectedProp = effectSelector.selection;
    if (applyDefault) this.applyDefault();
  }

  /**
   * Sets the currently selected property to the corresponding "default" value of that property.
   * Note that this is not to be confused with the value we employ for resetting a property.
   * Resetting a property will turn it into a neutral state.
   * Default values on the other hand are decisively chosen to have a characteristic effect
   * in order to illustrate what the property controls in the morph's appearance.
   */
  applyDefault () {
    this.targetMorph[this.accessor] = PROP_CONFIG[this.selectedProp].defaultValue; // eslint-disable-line no-use-before-define
  }

  /**
   * Sets the selected property based on the selection in the UI
   * controlled by the user.
   */
  refreshItems (openItems) {
    const { effectSelector } = this.ui;
    let availableItems = [this.selectedProp, ...openItems];
    if (['Drop shadow', 'Inner shadow'].includes(this.selectedProp)) {
      availableItems = arr.uniq(['Drop shadow', 'Inner shadow'].concat(availableItems));
    }
    effectSelector.items = arr.compact(availableItems);
    noUpdate(() => {
      effectSelector.selection = this.selectedProp;
    });
  }

  /**
   * Resets the currently controlled effect property back to its default value
   * in order to "leave no trace behind".
   */
  resetProperty () {
    this.targetMorph.withMetaDo({ reconcileChanges: true }, () => {
      this.targetMorph[this.accessor] = PROP_CONFIG[this.selectedProp].resetValue; // eslint-disable-line no-use-before-define
    });
  }

  /**
   * Removes this dynamic property from the current morph.
   */
  remove () {
    this.view.remove();
    this.resetProperty();
  }

  /**
   * Toggles the popup that controls the current effect property.
   */
  togglePopup () {
    this.popup ? this.closePopup() : this.openPopup();
  }

  /**
   * Get the default configuration of the popup for this property.
   */
  getInitPopupProps () {
    return PROP_CONFIG[this.selectedProp].defaultModelProps(this.targetMorph); // eslint-disable-line no-use-before-define
  }

  /**
   * Update the current morph to reflect the changes.
   */
  confirm (v) {
    this.view.withMetaDo({ reconcileChanges: true }, () => {
      this.targetMorph[this.accessor] = v;
    });
  }

  /**
   * Opens the popup responsible for controlling the property.
   */
  openPopup () {
    this.view.fill = Color.gray.withA(0.3);
    const p = this.popup = part(this.popupComponent, { viewModel: this.getInitPopupProps() }).openInWorld();
    /*
      fixme: the problem is that the css layout of the popup window is not yet applied
      beacuse the vdom has not yet rendered the layout and we can not determine the
      total height via measuring. This will be gone once we move away from the vdom issue.
    */
    p.height = 25;
    p.topRight = this.view.globalBounds().topLeft();
    p.topLeft = this.world().visibleBounds().translateForInclusion(p.globalBounds()).topLeft();
    once(p, 'remove', this, 'closePopup');
    connect(p.viewModel, 'value', this, 'confirm');
  }

  /**
   * Closes the popup responsible for controlling the property.
   */
  closePopup () {
    this.view.fill = Color.transparent;
    if (!this.popup) return;
    this.popup.remove();
    this.popup = null;
  }
}

/*

handles fill, shadow, opacity and clipping
BodyControl.openInWorld()
*/
const BodyControl = component(PropertySection, {
  name: 'body control',
  defaultViewModel: BodyControlModel,
  submorphs: [{
    name: 'h floater',
    submorphs: [{
      name: 'section headline',
      textAndAttributes: ['Effects', null]
    }]
  }]
});

const PROP_CONFIG = {
  'Drop shadow': {
    accessor: 'dropShadow',
    defaultModelProps: (target) => {
      const v = target.dropShadow;
      const opts = { fastShadow: v && v.fast, insetShadow: false };
      if (v) opts.shadowValue = v;
      return opts;
    },
    popupComponent: ShadowPopup,
    resetValue: null,
    defaultValue: new ShadowObject({ color: Color.black, blur: 15 })
  },
  'Inner shadow': {
    accessor: 'dropShadow',
    defaultModelProps: (target) => {
      const v = target.dropShadow;
      const opts = { fastShadow: v && v.fast, insetShadow: true };
      if (v) opts.shadowValue = v;
      return opts;
    },
    popupComponent: InsetShadowPopup,
    resetValue: null,
    defaultValue: new ShadowObject({ color: Color.black, inset: true, blur: 15 })
  },
  Opacity: {
    accessor: 'opacity',
    defaultModelProps: (target) => {
      return { value: target.opacity };
    },
    popupComponent: OpacityPopup,
    resetValue: 1,
    defaultValue: 1
  },
  Blur: {
    accessor: 'blur',
    defaultModelProps: target => {
      return { value: target.blur };
    },
    popupComponent: BlurPopup,
    resetValue: 0,
    defaultValue: 1
  },
  Cursor: {
    accessor: 'nativeCursor',
    popupComponent: CursorPopup,
    resetValue: 'auto',
    defaultModelProps: target => {
      return { selection: target.nativeCursor };
    },
    defaultValue: 'pointer'
  },
  Tilted: {
    accessor: 'tilted',
    popupComponent: TiltPopup,
    resetValue: 0,
    defaultModelProps: target => {
      return { value: target.tilted };
    },
    defaultValue: 0.5
  },
  Flipped: {
    accessor: 'flipped',
    popupComponent: FlipPopup,
    resetValue: 0,
    defaultModelProps: target => {
      return { value: target.flipped };
    },
    defaultValue: 0.5
  }
};

const DynamicProperty = component({
  defaultViewModel: DynamicPropertyModel,
  name: 'dynamic property',
  layout: new TilingLayout({
    axisAlign: 'center',
    justifySubmorphs: 'spaced',
    padding: rect(10, 0, 0, 0),
    resizePolicies: [['effect selector', {
      height: 'fixed',
      width: 'fill'
    }]],
    spacing: 5
  }),
  fill: Color.rgba(255, 255, 255, 0),
  extent: pt(183.2, 30),
  submorphs: [part(PropertyLabel, {
    name: 'open popup',
    tooltip: 'Open Property Popup',
    padding: rect(4, 4, 0, 0),
    master: {
      auto: PropertyLabel,
      hover: PropertyLabelHovered,
      click: PropertyLabelActive
    }
  }), part(EnumSelector, {
    name: 'effect selector',
    clipMode: 'hidden',
    viewModel: {
      listAlign: 'selection',
      openListInWorld: true,
      listMaster: DarkThemeList,
      listHeight: 1000,
      // these should be set by the model
      items: Object.keys(PROP_CONFIG)
    }
  }), part(RemoveButton, {
    master: { auto: RemoveButton, hover: PropertyLabelHovered },
    name: 'remove',
    tooltip: 'Remove Property/Effect',
    padding: rect(4, 4, 0, 0)
  })]
});

export { BodyControl, DynamicProperty };
