import { component, add, ViewModel, part } from 'lively.morphic/components/core.js';
import { PropertySection, PropertySectionInactive, PropertySectionModel } from './section.cp.js';
import { TilingLayout, Icon, Morph, ShadowObject, Label } from 'lively.morphic';
import { Color, Point, rect, Rectangle, pt } from 'lively.graphics';
import { PropertyLabel, PropLabel, AddButton, NumberInput, DarkPopupWindow, RemoveButton, DarkThemeList, EnumSelector, PropertyLabelActive, PropertyLabelHovered } from '../shared.cp.js';
import { ColorInput } from '../../styling/color-picker.cp.js';
import { num, obj, string, arr } from 'lively.lang';
import { signal, once, connect } from 'lively.bindings';

/**
  Controls the morph's "body" which comprises all of the dynamic effect properties.
*/
export class BodyControlModel extends PropertySectionModel {
  static get properties () {
    return {
      targetMorph: {},
      availableItems: {
        derived: true,
        get () {
          const res = arr.withoutAll(Object.keys(PROP_CONFIG), this.dynamicControls.map(m => m.selectedProp));
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
          return this.view.submorphs.filter(m => m.isControl);
        }
      }
    };
  }

  /**
   * Sets the current morph the effects control is focused on.
   * @params { Morph } aMorph - The morph to be focused on.
   */
  focusOn (aMorph) {
    this.targetMorph = aMorph;
    this.ensureDynamicControls();
  }

  /**
   * Ensure that the dynamic controls applicable to the currently
   * focused morph are displayed. These are essentially alle the
   * effect-properties that diverge from the default value.
   */
  ensureDynamicControls () {
    this.dynamicControls.forEach(m => m.remove());
    for (const prop in PROP_CONFIG) {
      const { resetValue, accessor } = PROP_CONFIG[prop];
      if (!obj.equals(resetValue, this.targetMorph[accessor])) {
        if (prop == 'Inner shadow' && !this.targetMorph[accessor].inset) continue;
        if (prop == 'Drop shadow' && this.targetMorph[accessor].inset) continue;
        this.addDynamicProperty(prop, false);
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
  addDynamicProperty (selectedProp, refresh = true) {
    const { targetMorph } = this;
    const control = this.view.addMorph(part(DynamicProperty, { viewModel: { targetMorph } }));
    this.view.layout.setResizePolicyFor(control, { height: 'fixed', width: 'fill' });
    this.view.master._overriddenProps.get(this.view).layout = true;
    control.refreshItems(this.availableItems);
    if (selectedProp) control.choose(selectedProp);
    else {
      control.chooseDefault();
      if (refresh) this.refreshItemLists();
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
    this.view.master = BodyControl;
    this.addDynamicProperty();
  }

  /**
   * This is only invoked when all applied effects are removed from a morph
   * or if the morph does not have any applied effects to begin with.
   * Ensures that the appearance of the body control is faded out.
   */
  deactivate () {
    this.refreshItemLists();
    if (this.dynamicControls.length > 0) {
      this.view.master = BodyControl;
      return;
    }
    this.view.layout = this.view.layout.with({ padding: rect(0, 10, 0, 0) });
    this.view.master = { auto: PropertySectionInactive, hover: PropertySection };
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
      },
      accessor: {
        get () {
          return PROP_CONFIG[this.selectedProp].accessor;
        }
      },
      popupComponent: {
        readOnly: true,
        serialize: false,
        get () {
          return PROP_CONFIG[this.selectedProp].popupComponent;
        }
      },
      isControl: { get () { return true; } },
      expose: {
        get () { return ['refreshItems', 'chooseDefault', 'isControl', 'selectedProp', 'choose']; }
      },
      bindings: {
        get () {
          return [
            { model: 'effect selector', signal: 'selection', handler: 'selectProperty' },
            { target: 'open popup', signal: 'onMouseDown', handler: 'togglePopup' },
            { target: 'remove', signal: 'onMouseDown', handler: 'remove' }];
        }
      }
    };
  }

  /**
   * Programatically sets the selected property of this dynamic property.
   */
  choose (prop) {
    this.ui.effectSelector.selection = prop;
    this.selectProperty();
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
   */
  selectProperty () {
    if (this.selectedProp && this.selectedProp != this.ui.effectSelector.selection) { this.resetToDefaultValue(); }
    this.selectedProp = this.ui.effectSelector.selection;
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
    effectSelector.selection = this.selectedProp;
  }

  /**
   * Resets the currently controlled effect property back to its default value.
   */
  resetToDefaultValue () {
    this.targetMorph[this.accessor] = PROP_CONFIG[this.selectedProp].resetValue;
  }

  /**
   * Removes this dynamic property from the current morph.
   */
  remove () {
    this.view.remove();
    this.resetToDefaultValue();
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
    return PROP_CONFIG[this.selectedProp].defaultModelProps(this.targetMorph);
  }

  /**
   * Update the current morph to reflect the changes.
   */
  updateTarget (v) {
    this.targetMorph[this.accessor] = v;
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
    connect(p.viewModel, 'value', this, 'updateTarget');
  }

  /**
   * Closes the popup responsible for controlling the property.
   */
  closePopup () {
    this.view.fill = Color.transparent;
    this.popup.remove();
    this.popup = null;
  }
}

export class ShadowPopupModel extends ViewModel {
  static get properties () {
    return {
      fastShadow: { defaultValue: false },
      insetShadow: { defaultValue: false },
      isHaloItem: { defaultValue: true },
      shadowValue: {
        initialize () {
          this.shadowValue = new ShadowObject({});
        }
      },
      expose: { get () { return ['isHaloItem']; } },
      bindings: {
        get () {
          return [
            { target: 'close button', signal: 'onMouseDown', handler: 'close' },
            { target: 'fast shadow checkbox', signal: 'onMouseDown', handler: 'toggleFastShadow' },
            { target: 'x offset', signal: 'number', handler: 'confirm' },
            { target: 'y offset', signal: 'number', handler: 'confirm' },
            { target: 'blur input', signal: 'number', handler: 'confirm' },
            { target: 'spread input', signal: 'number', handler: 'confirm' },
            { model: 'shadow color input', signal: 'color', handler: 'confirm' }
          ];
        }
      }
    };
  }

  close () {
    this.view.remove();
  }

  attach (view) {
    super.attach(view);
    this.update();
  }

  onRefresh (prop) {
    if (!this.view) return;
    if (prop == 'fastShadow') this.update();
    if (prop == 'insetShadow') this.update();
  }

  /**
   * Initializes the shadow popup from an initial shadow value.
   */
  initFrom (shadowValue) {
    if (shadowValue) this.fastShadow = shadowValue.fast;
    this.shadowValue = shadowValue;
    this.update();
  }

  /**
   * Toggles wether or not the shadow should be rendered behind
   * transparent areas (slow) or not (fast)
   */
  toggleFastShadow () {
    this.fastShadow = !this.fastShadow;
    this.confirm();
  }

  /**
   * Refresh the UI to reflect the currently stored shadow value.
   */
  update () {
    this.withoutBindingsDo(() => {
      const {
        fastShadowCheckbox, spreadInput,
        blurInput, xOffset, yOffset, buffer,
        shadowColorInput, title, footer
      } = this.ui;

      const f = fastShadowCheckbox.fill;
      fastShadowCheckbox.borderColor = !this.fastShadow ? Color.transparent : Color.white;
      fastShadowCheckbox.fill = !this.fastShadow ? f.withA(1) : f.withA(0);
      fastShadowCheckbox.fontColor = !this.fastShadow ? Color.rgb(65, 65, 65) : Color.transparent;

      const p = Point.polar(this.shadowValue.distance, num.toRadians(this.shadowValue.rotation));
      xOffset.number = p.x;
      yOffset.number = p.y;
      spreadInput.number = this.shadowValue.spread;
      blurInput.number = this.shadowValue.blur;
      shadowColorInput.setColor(this.shadowValue.color);

      title.textString = this.insetShadow ? 'Inner Shadow' : 'Drop Shadow';
      footer.visible = !this.insetShadow;
      buffer.height = !this.insetShadow ? 10 : 20;
    });
  }

  /**
   * Update the current shadow value based on the inputs in the UI.
   * This is invoked in response to user interactions.
   */
  confirm () {
    const { shadowColorInput, spreadInput, blurInput, xOffset, yOffset } = this.ui;
    const polar = pt(xOffset.number, yOffset.number);
    const distance = polar.r();
    const rotation = num.toDegrees(polar.theta()) % 360;
    this.shadowValue = new ShadowObject({
      fast: this.fastShadow,
      inset: this.insetShadow,
      color: shadowColorInput.colorValue,
      blur: blurInput.number,
      spread: spreadInput.number,
      distance,
      rotation
    });
    signal(this, 'value', this.shadowValue);
  }
}

/**
  General control for all properties that can be configured
  by a single number input such as opacity or blur.
*/
export class SingleNumberModel extends ViewModel {
  static get properties () {
    return {
      value: {},
      isHaloItem: { defaultValue: true },
      expose: { get () { return ['isHaloItem']; } },
      bindings: {
        get () {
          return [
            { target: 'close button', signal: 'onMouseDown', handler: 'close' },
            { target: 'value input', signal: 'number', handler: 'onValueChanged' }
          ];
        }
      }
    };
  }

  close () { this.view.remove(); }

  attach (view) {
    super.attach(view);
    this.ui.valueInput.number = this.value;
  }

  onValueChanged () {
    this.value = this.ui.valueInput.number;
  }
}

/**
  General control for all properties that can be configured
  by a single selection input such as the native cursor of a morph.
*/
export class SingleSelectionModel extends ViewModel {
  static get properties () {
    return {
      selection: {},
      isHaloItem: { defaultValue: true },
      expose: { get () { return ['isHaloItem']; } },
      bindings: {
        get () {
          return [
            { target: 'close button', signal: 'onMouseDown', handler: 'close' },
            { model: 'selection input', signal: 'selection', handler: 'onSelectionChanged' }
          ];
        }
      }
    };
  }

  close () { this.view.remove(); }

  attach (view) {
    super.attach(view);
    this.ui.selectionInput.selection = this.selection;
  }

  onSelectionChanged () {
    this.selection = this.ui.selectionInput.selection;
    signal(this, 'value', this.selection);
  }
}

// ShadowPopup.openInWorld()
const ShadowPopup = component(DarkPopupWindow, {
  defaultViewModel: ShadowPopupModel,
  name: 'shadow popup',
  extent: pt(241.4, 191),
  submorphs: [{
    name: 'header menu',
    submorphs: [{
      name: 'title',
      textAndAttributes: ['Shadow', null]
    }]
  }, add({
    name: 'shadow controls',
    borderColor: Color.rgb(23, 160, 251),
    borderWidth: 0,
    extent: pt(241, 76.6),
    layout: new TilingLayout({ spacing: 10, justifySubmorphs: 'spaced', padding: Rectangle.inset(10, 10, 40) }),
    fill: Color.rgba(0, 0, 0, 0),
    submorphs: [part(NumberInput, {
      name: 'x offset',
      position: pt(17.5, 16.5),
      submorphs: [{
        name: 'interactive label',
        fontFamily: 'IBM Plex Mono',
        fontSize: 13,
        padding: rect(8, 0, -1, 0),
        textAndAttributes: ['X', null]
      }],
      tooltip: 'X offset'
    }),
    part(NumberInput, {
      name: 'blur input',
      min: 0,
      position: pt(123.7, 17.3),
      submorphs: [{
        name: 'interactive label',
        textAndAttributes: ['\ue3a5', {
          fontSize: 14,
          textStyleClasses: ['material-icons']
        }]
      }],
      tooltip: 'Shadow blur'
    }),
    part(NumberInput, {
      name: 'y offset',
      position: pt(18.5, 50.2),
      submorphs: [{
        name: 'interactive label',
        fontFamily: 'IBM Plex Mono',
        fontSize: 13,
        padding: rect(7, 0, 0, 0),
        textAndAttributes: ['Y', null]
      }],
      tooltip: 'Y offset'
    }),
    part(NumberInput, {
      name: 'spread input',
      min: 0,
      position: pt(124.2, 51.7),
      submorphs: [{
        name: 'interactive label',
        textAndAttributes: ['\ue3e0', {
          fontSize: 14,
          textStyleClasses: ['material-icons']
        }]
      }],
      tooltip: 'Shadow spread'
    })]
  }), add(part(ColorInput, {
    name: 'shadow color input',
    height: 27,
    submorphs: [{
      name: 'hex input',
      extent: pt(70, 23),
      textAndAttributes: ['FFFFFF', null]
    }]
  })), add({ name: 'buffer', height: 10, fill: Color.transprent }), add({
    name: 'footer',
    borderColor: Color.rgbHex('616A6B'),
    borderWidth: 1,
    extent: pt(241, 50.3),
    fill: Color.rgba(0, 0, 0, 0),
    submorphs: [{
      name: 'h wrapper',
      borderColor: Color.rgb(23, 160, 251),
      extent: pt(228, 31),
      fill: Color.rgba(0, 0, 0, 0),
      layout: new TilingLayout({
        axisAlign: 'center',
        orderByIndex: true,
        padding: rect(15, 0, -10, 0),
        wrapSubmorphs: false
      }),
      position: pt(6.2, 9.5),
      submorphs: [part(AddButton, {
        type: Label,
        name: 'fast shadow checkbox',
        borderColor: Color.transparent,
        borderWidth: 1,
        padding: rect(0, 0, 0, 0),
        fill: Color.rgb(178, 235, 242),
        fontColor: Color.rgb(65, 65, 65),
        textAndAttributes: ['', {
          fontSize: 13,
          textStyleClasses: ['material-icons']
        }]
      }), part(PropLabel, {
        type: Label,
        name: 'prop label',
        textAndAttributes: ['Show behind transparent areas', null]
      })]
    }]
  })]
});

// InsetShadowPopup.openInWorld()
const InsetShadowPopup = component(ShadowPopup, {
  name: 'inset shadow popup',
  submorphs: [{
    name: 'header menu',
    submorphs: [{
      name: 'title',
      textAndAttributes: ['Inset Shadow', null]
    }]
  }]
});

// BlurPopup.openInWorld()
// part(BlurPopup).openInWorld()
const BlurPopup = component(DarkPopupWindow, {
  defaultViewModel: SingleNumberModel,
  name: 'blur popup',
  submorphs: [{
    name: 'header menu',
    submorphs: [{
      name: 'title',
      textAndAttributes: ['Blur', null]
    }]
  }, add({
    name: 'footer',
    borderColor: Color.rgb(97, 106, 107),
    borderWidth: 0,
    extent: pt(241, 50.3),
    fill: Color.rgba(0, 0, 0, 0),
    submorphs: [part(NumberInput, {
      name: 'value input',
      min: 0,
      position: pt(11.3, 14),
      submorphs: [{
        name: 'interactive label',
        textAndAttributes: ['', {
          fontSize: 14,
          textStyleClasses: ['material-icons']
        }]
      }],
      tooltip: 'Object blur'
    })]
  })]
});

// OpacityPopup.openInWorld()
const OpacityPopup = component(DarkPopupWindow, {
  defaultViewModel: SingleNumberModel,
  name: 'opacity popup',
  submorphs: [{
    name: 'header menu',
    submorphs: [{
      name: 'title',
      textAndAttributes: ['Opacity', null]
    }]
  }, add({
    name: 'footer',
    borderColor: Color.rgb(97, 106, 107),
    borderWidth: 0,
    extent: pt(241, 50.3),
    fill: Color.rgba(0, 0, 0, 0),
    submorphs: [part(NumberInput, {
      name: 'value input',
      position: pt(11.3, 14),
      min: 0,
      max: 1,
      scaleFactor: 100,
      unit: '%',
      tooltip: 'Object opacity',
      submorphs: [{
        name: 'interactive label',
        textAndAttributes: ['\ue91c', {
          fontSize: 14,
          textStyleClasses: ['material-icons']
        }]
      }]
    })]
  })]
});

// CursorPopup.openInWorld()
const CursorPopup = component(DarkPopupWindow, {
  defaultViewModel: SingleSelectionModel,
  name: 'cursor popup',
  submorphs: [{
    name: 'header menu',
    submorphs: [{
      name: 'title',
      textAndAttributes: ['Cursor', null]
    }]
  }, add({
    name: 'footer',
    borderColor: Color.rgb(97, 106, 107),
    borderWidth: 0,
    extent: pt(241, 50.3),
    fill: Color.rgba(0, 0, 0, 0),
    submorphs: [part(EnumSelector, {
      name: 'selection input',
      viewModel: {
        openListInWorld: true,
        listAlign: 'selection',
        items: Morph.properties.nativeCursor.values,
        listMaster: DarkThemeList,
        listHeight: 1000
      },
      extent: pt(210.4, 23.3),
      master: EnumSelector,
      position: pt(15.4, 13.5),
      submorphs: [add({
        type: Label,
        name: 'interactive label',
        fill: Color.rgba(229, 231, 233, 0),
        fontColor: Color.rgb(255, 255, 255),
        fontFamily: 'Material Icons',
        nativeCursor: 'pointer',
        padding: rect(6, 0, -6, 0),
        reactsToPointer: false,
        textAndAttributes: Icon.textAttribute('mouse-pointer', { fontSize: 16 })
      }, 'label')]
    })]
  })]
});

// TiltPopup.openInWorld()
const TiltPopup = component(DarkPopupWindow, {
  defaultViewModel: SingleNumberModel,
  name: 'tilt popup',
  submorphs: [{
    name: 'header menu',
    submorphs: [{
      name: 'title',
      textAndAttributes: ['Tilt ', null, '(Rotate along X-Axis)', { fontWeight: '400' }]
    }]
  }, add({
    name: 'footer',
    borderColor: Color.rgb(97, 106, 107),
    borderWidth: 0,
    extent: pt(241, 50.3),
    fill: Color.rgba(0, 0, 0, 0),
    submorphs: [part(NumberInput, {
      name: 'value input',
      unit: '°',
      min: 0,
      scaleFactor: 180,
      max: 1,
      position: pt(11.3, 14),
      tooltip: 'Object tilt',
      submorphs: [{
        name: 'interactive label',
        textAndAttributes: ['X ', { fontSize: 16, fontFamily: 'IBM Plex Mono' }, ...Icon.textAttribute('undo', { fontSize: 14, paddingTop: '3px' })]
      }]
    })]
  })]
});

// FlipPopup.openInWorld()
const FlipPopup = component(DarkPopupWindow, {
  defaultViewModel: SingleNumberModel,
  name: 'flip popup',
  submorphs: [{
    name: 'header menu',
    submorphs: [{
      name: 'title',
      textAndAttributes: ['Flip ', null, '(Rotate along Y-Axis)', { fontWeight: '400' }]
    }]
  }, add({
    name: 'footer',
    borderColor: Color.rgb(97, 106, 107),
    borderWidth: 0,
    extent: pt(241, 50.3),
    fill: Color.rgba(0, 0, 0, 0),
    submorphs: [part(NumberInput, {
      name: 'value input',
      unit: '°',
      min: 0,
      scaleFactor: 180,
      max: 1,
      position: pt(11.3, 14),
      tooltip: 'Object flip',
      submorphs: [{
        name: 'interactive label',
        textAndAttributes: ['Y ', { fontSize: 16, fontFamily: 'IBM Plex Mono' }, ...Icon.textAttribute('undo', { fontSize: 14, paddingTop: '3px' })]
      }]
    })]
  })]
});

/*

handles fill, shadow, opacity and clipping
BodyControl.openInWorld()
*/
const BodyControl = component(PropertySection, {
  name: 'body control',
  defaultViewModel: BodyControlModel,
  mater: { auto: PropertySectionInactive, hover: PropertySection },
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
    resetValue: null
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
    resetValue: null
  },
  Opacity: {
    accessor: 'opacity',
    defaultModelProps: (target) => {
      return { value: target.opacity };
    },
    popupComponent: OpacityPopup,
    resetValue: 1
  },
  Blur: {
    accessor: 'blur',
    defaultModelProps: target => {
      return { value: target.blur };
    },
    popupComponent: BlurPopup,
    resetValue: 0
  },
  Cursor: {
    accessor: 'nativeCursor',
    popupComponent: CursorPopup,
    resetValue: 'auto',
    defaultModelProps: target => {
      return { selection: target.nativeCursor };
    }
  },
  Tilted: {
    accessor: 'tilted',
    popupComponent: TiltPopup,
    resetValue: 0,
    defaultModelProps: target => {
      return { value: target.tilted };
    }
  },
  Flipped: {
    accessor: 'flipped',
    popupComponent: FlipPopup,
    resetValue: 0,
    defaultModelProps: target => {
      return { value: target.flipped };
    }
  }
};

// DynamicProperty.openInWorld()
// part(DynamicProperty)
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
    spacing: 5,
    wrapSubmorphs: false
  }),
  fill: Color.rgba(255, 255, 255, 0),
  extent: pt(183.2, 30),
  submorphs: [part(PropertyLabel, {
    name: 'open popup',
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
    padding: rect(4, 4, 0, 0)
  })]
});

export { BodyControl, DynamicProperty, BlurPopup, ShadowPopup, InsetShadowPopup, OpacityPopup, CursorPopup, TiltPopup };
