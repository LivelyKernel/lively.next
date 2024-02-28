import { Color, rect, Rectangle, pt } from 'lively.graphics';
import { TilingLayout, without, Morph, Label, part, add, component } from 'lively.morphic';
import { AddButton, PropertyLabel, DarkPopupWindow, DarkThemeList, PropertyLabelActive, EnumSelector, DarkNumberIconWidget, PropertyLabelHovered } from '../shared.cp.js';
import { ColorInput } from '../../styling/color-picker.cp.js';

import { arr, string } from 'lively.lang';
import { once, epiConnect, signal } from 'lively.bindings';
import { PropertySection, PropertySectionModel } from './section.cp.js';
import { DarkColorPicker } from '../dark-color-picker.cp.js';
import { PopupModel } from './popups.cp.js';

/**
 * Implements the control elements for border values. This includes the color, width and style of the border.
 * Note that the border radius is NOT part of this. The border control is used directly embedded in the sidebar
 * but is also embedded in the advanced border popup.
 */
export class BorderControlModel extends PropertySectionModel {
  static get properties () {
    return {
      targetMorph: {},
      popup: {},
      updateDirectly: { defaultValue: true },
      borderPopupComponent: {
        isComponent: true,
        get () {
          return this.getProperty('borderPopupComponent') || BorderPopup; // eslint-disable-line no-use-before-define
        }
      },
      hasMixedColor: {
        derived: true,
        get () {
          if (!this.targetMorph) return false;
          const { top, left, bottom, right } = this.targetMorph.borderColor;
          return this.updateDirectly && arr.uniqBy([top, left, bottom, right], (a, b) => a?.equals(b)).length > 1;
        }
      },
      hasMixedStyle: {
        derived: true,
        get () {
          if (!this.targetMorph) return false;
          const { top, left, bottom, right } = this.targetMorph.borderStyle;
          return this.updateDirectly && arr.uniq([top, left, bottom, right]).length > 1;
        }
      },
      hasMixedWidth: {
        derived: true,
        get () {
          if (!this.targetMorph) return false;
          const { top, left, bottom, right } = this.targetMorph.borderWidth;
          return this.updateDirectly && arr.uniq([top, left, bottom, right]).length > 1;
        }
      },

      bindings: {
        get () {
          return [
            ...super.prototype.bindings,
            {
              target: 'border color input',
              signal: 'color',
              handler: 'confirm'
            },
            {
              target: 'border width input',
              signal: 'number',
              handler: 'confirm'
            },
            {
              target: 'border style selector',
              signal: 'selection',
              handler: 'confirm'
            },
            {
              target: 'more button',
              signal: 'onMouseDown',
              handler: 'openPopup'
            },
            {
              signal: 'onMouseDown',
              handler: 'onMouseDown'
            }
          ];
        }
      }
    };
  }

  onMouseDown () {
    this.closePopup();
    this.models.borderColorInput.closeColorPicker();
  }

  onRefresh (prop) {
    if (prop === 'popup') {
      this.ui.moreButton.master.setState(this.popup ? 'active' : null);
    }
  }

  /**
   * Sets the current morph the effects control is focused on.
   * @params { Morph } aMorph - The morph to be focused on.
   */
  focusOn (aMorph) {
    this.targetMorph = aMorph;
    if (
      Color.white.equals(this.targetMorph.borderColor.valueOf()) &&
      this.targetMorph.borderWidth.valueOf() === 0 &&
      this.targetMorph.borderStyle.valueOf() === 'solid') {
      this.deactivate();
    } else {
      this.activate(false);
      this.update();
    }
  }

  /**
   * Refresh the UI to reflect the current border of the focused morph.
   */
  update () {
    this.ui.borderStyleSelector.items = this.targetMorph.borderOptions.map(v => ({
      string: string.capitalize(v), value: v, isListItem: true
    }));
    this.withBorder(this.targetMorph.border);
  }

  /**
   * Set the input elements to display the given border value.
   * @param { BorderValue } borderValue - The value of the border (style, color, width) that is to be displayed.
   */
  withBorder (borderValue) {
    this.withoutBindingsDo(() => {
      const { borderColorInput, borderWidthInput, borderStyleSelector } = this.ui;
      const { color, width, style } = borderValue;

      if (this.hasMixedColor) {
        borderColorInput.setMixed(Object.values(this.targetMorph.borderColor).filter(c => c.isColor));
      } else {
        borderColorInput.setColor(color.valueOf ? color.valueOf() : color);
      }

      if (this.hasMixedWidth) {
        borderWidthInput.setMixed();
      } else {
        borderWidthInput.number = width.valueOf ? width.valueOf() : width;
      }

      if (this.hasMixedStyle) {
        borderStyleSelector.setMixed();
      } else {
        borderStyleSelector.selection = style.valueOf ? style.valueOf() : style;
      }
    });
  }

  /**
   * If the border is just the default morphic border
   * the controls are inactive. Activating the controls
   * causes them to be initialized to a default initial
   * border with width 1.
   * @param { Boolean }
   */
  activate (initBorder = true) {
    super.activate();
    const { elementsWrapper } = this.ui;
    elementsWrapper.visible = true;
    this.view.layout = this.view.layout.with({ padding: rect(0, 10, 0, 10) });
    if (initBorder) {
      this.targetMorph.withMetaDo({ reconcileChanges: true }, () => {
        this.targetMorph.border = { color: Color.white, width: 1, style: 'solid' };
      });
      this.update();
    }
  }

  /**
   * Resets the border to the default border value of width 0.
   * Consequently deactivates the border control for this focused morph.
   */
  deactivate () {
    super.deactivate();
    this.closePopup();
    this.models.borderColorInput.closeColorPicker();
    if (!this.targetMorph) return;
    const { elementsWrapper } = this.ui;
    elementsWrapper.visible = false;
    this.view.layout = this.view.layout.with({ padding: rect(0, 10, 0, 0) });
    this.targetMorph.withMetaDo({ reconcileChanges: true }, () => {
      this.targetMorph.borderWidth = 0;
      this.targetMorph.borderColor = Color.white;
      this.targetMorph.borderStyle = 'solid';
    });
  }

  /**
   * Opens the popup responsible for controlling the property.
   */
  openPopup () {
    const p = this.popup = this.popup || part(this.borderPopupComponent);
    p.targetMorph = this.targetMorph;
    p.openInWorld();
    p.alignAtButton(this.ui.moreButton);
    once(p, 'close', this, 'closePopup');
    epiConnect(p, 'target updated', this, 'update');
  }

  /**
 * Closes the popup responsible for controlling the property.
   */
  closePopup () {
    if (!this.popup) return;
    this.popup.close();
    this.popup = null;
  }

  /**
   * Update the current border value based on the inputs in the UI.
   * This is invoked in response to user interactions.
   */
  confirm () {
    if (!this.targetMorph && this.updateDirectly) return;
    const { borderColorInput, borderWidthInput, borderStyleSelector } = this.ui;
    const border = this.targetMorph?.border || {};
    const updateBorder = () => {
      if (!borderWidthInput.isMixed) border.width = borderWidthInput.number;
      if (!borderColorInput.isMixed) border.color = borderColorInput.colorValue;
      if (!borderStyleSelector.isMixed) border.style = borderStyleSelector.selection;
    };
    if (this.updateDirectly) {
      this.targetMorph.withMetaDo({ reconcileChanges: true }, () => {
        updateBorder();
        this.targetMorph.border = border;
      });
    } else {
      updateBorder();
      signal(this.view, 'value', border);
    }
  }
}

/**
 * The popup window to control the separate border sides of a morph
 * individually.
 */
export class BorderPopupWindow extends PopupModel {
  static get properties () {
    return {
      targetMorph: {}, // this is fine because it only works in the context of a morph
      selectedBorder: { defaultValue: 'all' },
      isHaloItem: { defaultValue: true },
      expose: {
        get () {
          return ['close', 'isHaloItem', 'isPropertiesPanelPopup', 'alignAtButton', 'targetMorph'];
        }
      },
      bindings: {
        get () {
          return [{
            target: 'close button',
            signal: 'onMouseDown',
            handler: 'close'
          }, {
            target: 'border selector wrapper',
            signal: 'onMouseDown',
            handler: 'selectBorderSide'
          }, {
            target: 'border control',
            signal: 'value',
            handler: 'updateBorder'
          }];
        }
      }
    };
  }

  get isPropertiesPanelPopup () {
    return true;
  }

  attach (view) {
    super.attach(view);
    this.selectedBorder = 'left';
  }

  onRefresh (prop) {
    if (prop === 'selectedBorder') {
      const { leftBorder, rightBorder, bottomBorder, topBorder } = this.ui;
      const valToElem = {
        left: leftBorder,
        right: rightBorder,
        bottom: bottomBorder,
        top: topBorder
      };
      Object.values(valToElem).forEach(control => control.master.setState(null));
      valToElem[this.selectedBorder].master.setState('active');
    }

    if (prop === 'targetMorph') {
      this.models.borderControl.withBorder(this.targetMorph.borderLeft);
    }
  }

  /**
   * Close the popup.
   */
  close () {
    signal(this.view, 'close');
    this.view.remove();
  }

  /**
   * Switches the currently selected border side to be controlled. Run in response to the user
   * touching the selection buttons.
   * @params { Event } evt - The mouse down event targeted to one of the border side selection buttons.
   */
  selectBorderSide (evt) {
    const { borderControl } = this.models;
    const elemToVal = {
      'left border': 'left',
      'right border': 'right',
      'top border': 'top',
      'bottom border': 'bottom'
    };
    if (elemToVal[evt.targetMorph.name]) {
      this.selectedBorder = elemToVal[evt.targetMorph.name];
      borderControl.withBorder(this.targetMorph['border' + string.capitalize(this.selectedBorder)]);
    }
  }

  updateBorder (borderStyle) {
    if (!this.targetMorph) return;
    const { borderRadius } = this.targetMorph;
    this.targetMorph.withMetaDo({ reconcileChanges: true }, () => {
      this.targetMorph['border' + string.capitalize(this.selectedBorder)] = { ...borderStyle, borderRadius };
    });
    signal(this.view, 'target updated');
  }
}

const BorderControlElements = component({
  name: 'border control elements',
  fill: Color.transparent,
  layout: new TilingLayout({
    spacing: 10,
    wrapSubmorphs: true,
    hugContentsVertically: true
  }),
  submorphs: [part(ColorInput, {
    name: 'border color input',
    viewModel: {
      colorPickerComponent: DarkColorPicker
    }
  }), {
    name: 'border width control',
    extent: pt(196.4, 25),
    fill: Color.rgba(255, 255, 255, 0),
    layout: new TilingLayout({
      axisAlign: 'center',
      justifySubmorphs: 'spaced',
      orderByIndex: true,
      padding: rect(15, 0, -10, 0),
      spacing: 10
    }),
    submorphs: [part(DarkNumberIconWidget, {
      name: 'border width input',
      viewModel: { min: 0 },
      tooltip: 'Border Width',
      extent: pt(90, 22),
      submorphs: [{
        name: 'interactive label',
        textAndAttributes: ['', {
          fontSize: 16,
          fontFamily: 'Material Icons'
        }]
      }, without('button holder')]
    }), part(EnumSelector, {
      name: 'border style selector',
      tooltip: 'Select Border Style',
      clipMode: 'hidden',
      extent: pt(90, 22),
      viewModel: {
        listAlign: 'selection',
        openListInWorld: true,
        listHeight: 500,
        listMaster: DarkThemeList,
        items: Morph.prototype.borderOptions
      },
      submorphs: [add({
        type: Label,
        name: 'interactive label',
        fontColor: Color.rgb(255, 255, 255),
        padding: rect(0, 4, 7, -4),
        textAndAttributes: ['', {
          fontSize: 18,
          fontFamily: 'Material Icons'
        }]
      }, 'label'), {
        name: 'label',
        fontSize: 12
      }]
    })]
  }]
});

const BorderPopup = component(DarkPopupWindow, {
  defaultViewModel: BorderPopupWindow,
  name: 'border popup',
  submorphs: [{
    name: 'header menu',
    submorphs: [{
      name: 'title',
      textAndAttributes: ['Advanced Stroke', null]
    }]
  }, add({
    name: 'multi border control',
    borderColor: Color.rgb(23, 160, 251),
    extent: pt(241, 115.1),
    fill: Color.rgba(0, 0, 0, 0),
    clipMode: 'hidden',
    layout: new TilingLayout({
      spacing: 10,
      axis: 'column',
      hugContentsVertically: true,
      padding: Rectangle.inset(0, 10, 0, 10)
    }),
    submorphs: [
      {
        fill: Color.transparent,
        name: 'border selector wrapper',
        extent: pt(223, 28),
        position: pt(12.6, 12),
        layout: new TilingLayout({
          hugContentsVertically: true,
          justifySubmorphs: 'spaced',
          orderByIndex: true,
          spacing: 10,
          padding: Rectangle.inset(20, 0, 0, 0)
        }),
        submorphs: [
          part(AddButton, {
            master: { states: { active: PropertyLabelActive }, hover: PropertyLabelHovered },
            name: 'left border',
            tooltip: 'Configure Left Border',
            padding: rect(4, 4, 0, 0),
            textAndAttributes: ['\ue22e', {
              fontSize: 20,
              fontFamily: 'Material Icons'
            }]
          }),
          part(AddButton, {
            name: 'top border',
            tooltip: 'Configure Top Border',
            master: { states: { active: PropertyLabelActive }, hover: PropertyLabelHovered },
            padding: rect(4, 4, 0, 0),
            textAndAttributes: ['\ue232', {
              fontSize: 20,
              fontFamily: 'Material Icons'
            }]
          }),
          part(AddButton, {
            master: { states: { active: PropertyLabelActive }, hover: PropertyLabelHovered },
            name: 'right border',
            tooltip: 'Configure Right Border',
            padding: rect(4, 4, 0, 0),
            textAndAttributes: ['\ue230', {
              fontSize: 20,
              fontFamily: 'Material Icons'
            }]
          }),
          part(AddButton, {
            master: { states: { active: PropertyLabelActive }, hover: PropertyLabelHovered },
            name: 'bottom border',
            tooltip: 'Configure Bottom Border',
            padding: rect(4, 4, 0, 0),
            textAndAttributes: ['\ue229', {
              fontSize: 20,
              fontFamily: 'Material Icons'
            }]
          })
        ]
      }, part(BorderControlElements, { name: 'border control', viewModelClass: BorderControlModel, viewModel: { updateDirectly: false } })]
  })]
});

const BorderControl = component(PropertySection, {
  name: 'border control',
  defaultViewModel: BorderControlModel,
  height: 100,
  width: 250,
  submorphs: [{
    name: 'h floater',
    submorphs: [{
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
          spacing: 10
        }),
        submorphs: [{
          name: 'border width input',
          extent: pt(59.9, 22),
          tooltip: 'Border Width',
          submorphs: [{
            name: 'value',
            extent: pt(45.7, 21)
          }]
        }]
      }, add(part(AddButton, {
        master: {
          states: { active: PropertyLabelActive },
          hover: PropertyLabelHovered,
          click: PropertyLabelActive
        },
        name: 'more button',
        tooltip: 'Open Advanced Settings',
        padding: rect(6, 4, 0, 0),
        textAndAttributes: ['', {
          fontSize: 18,
          fontFamily: 'Material Icons'
        }]
      }))
    ]
  }))
  ]
});

export { BorderControl, BorderPopup, BorderControlElements };
