import { Color, rect, Rectangle, pt } from 'lively.graphics';
import { TilingLayout, Morph, Label, ViewModel, part, add, component } from 'lively.morphic';
import { AddButton, PropertyLabel, DarkPopupWindow, DarkThemeList, PropertyLabelActive, EnumSelector, NumberInputDark, PropertyLabelHovered } from '../shared.cp.js';
import { ColorInput } from '../../styling/color-picker.cp.js';
import { NumberWidget } from '../../value-widgets.js';
import { arr, string } from 'lively.lang';
import { once, connect, signal } from 'lively.bindings';
import { PropertySection, PropertySectionModel } from './section.cp.js';
import { DarkColorPicker } from '../dark-color-picker.cp.js';

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
      activeSectionComponent: {
        isComponent: true,
        get () {
          return this.getProperty('activeSectionComponent') || BorderControl; // eslint-disable-line no-use-before-define
        }
      },
      propertyLabelComponent: {
        isComponent: true,
        get () {
          return this.getProperty('propertyLabelComponent') || PropertyLabel;
        }
      },
      propertyLabelComponentActive: {
        isComponent: true,
        get () {
          return this.getProperty('propertyLabelComponentActive') || PropertyLabelActive; // eslint-disable-line no-use-before-define
        }
      },
      propertyLabelComponentHover: {
        isComponent: true,
        get () {
          return this.getProperty('propertyLabelComponentHover') || PropertyLabelHovered;
        }
      },
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
          return this.updateDirectly && arr.uniqBy([top, left, bottom, right], (a, b) => a.equals(b)).length > 1;
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
              model: 'border color input',
              signal: 'color',
              handler: 'confirm'
            },
            {
              target: 'border width input',
              signal: 'number',
              handler: 'confirm'
            },
            {
              model: 'border style selector',
              signal: 'selection',
              handler: 'confirm'
            },
            {
              target: 'more button',
              signal: 'onMouseDown',
              handler: 'openPopup'
            }
          ];
        }
      }
    };
  }

  onRefresh (prop) {
    if (prop === 'popup') {
      this.ui.moreButton.master = this.popup
        ? this.propertyLabelComponentActive
        : {
            auto: this.propertyLabelComponent,
            hover: this.propertyLabelComponentHover,
            click: this.propertyLabelComponentActive
          };
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
      this.targetMorph.borderWidth === 0 &&
      this.targetMorph.borderStyle === 'solid') {
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
    this.view.master = this.activeSectionComponent; // eslint-disable-line no-use-before-define
    if (initBorder) {
      this.targetMorph.border = { color: Color.white, width: 1, style: 'solid' };
      this.update();
    }
  }

  /**
   * Resets the border to the default border value of width 0.
   * Consequently deactivates the border control for this focused morph.
   */
  deactivate () {
    super.deactivate();
    this.view.master = { auto: this.activeSectionComponent, hover: this.hoverSectionComponent };
    this.closePopup();
    this.models.borderColorInput.closeColorPicker();
    if (!this.targetMorph) return;
    const { elementsWrapper } = this.ui;
    elementsWrapper.visible = false;
    this.view.layout = this.view.layout.with({ padding: rect(0, 10, 0, 0) });
    this.targetMorph.borderWidth = 0;
    this.targetMorph.borderColor = Color.white;
    this.targetMorph.borderStyle = 'solid';
  }

  /**
   * Opens the popup responsible for controlling the property.
   */
  openPopup () {
    const p = this.popup = this.popup || part(this.borderPopupComponent);
    p.viewModel.targetMorph = this.targetMorph;
    p.openInWorld();
    p.height = 25;
    p.topRight = this.ui.moreButton.globalBounds().bottomRight().addXY(0, 5);
    p.topLeft = this.world().visibleBounds().translateForInclusion(p.globalBounds()).topLeft();
    once(p.viewModel, 'close', this, 'closePopup');
    connect(p.viewModel, 'target updated', this, 'update');
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
    if (!borderWidthInput.isMixed) border.width = borderWidthInput.number;
    if (!borderColorInput.isMixed) border.color = borderColorInput.colorValue;
    if (!borderStyleSelector.isMixed) border.style = borderStyleSelector.selection;
    if (this.updateDirectly) this.targetMorph.border = border;
    else signal(this, 'value', border);
  }
}

/**
 * The popup window to control the separate border sides of a morph
 * individually.
 */
export class BorderPopupWindow extends ViewModel {
  static get properties () {
    return {
      targetMorph: {}, // this is fine because it only works in the context of a morph
      selectedBorder: { defaultValue: 'all' },
      isHaloItem: { defaultValue: true },
      propertyLabelComponent: {
        isComponent: true,
        get () {
          return this.getProperty('propertyLabelComponent') || PropertyLabel;
        }
      },
      propertyLabelComponentActive: {
        isComponent: true,
        get () {
          return this.getProperty('propertyLabelComponentActive') || PropertyLabelActive;
        }
      },
      propertyLabelComponentHover: {
        isComponent: true,
        get () {
          return this.getProperty('propertyLabelComponentHover') || PropertyLabelHovered;
        }
      },
      expose: {
        get () {
          return ['close', 'isHaloItem'];
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
            model: 'border control',
            signal: 'value',
            handler: 'updateBorder'
          }];
        }
      }
    };
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
      Object.values(valToElem).forEach(control => control.master = { auto: this.propertyLabelComponent, hover: this.propertyLabelComponentHover });
      valToElem[this.selectedBorder].master = this.propertyLabelComponentActive;
    }

    if (prop === 'targetMorph') {
      this.models.borderControl.withBorder(this.targetMorph.borderLeft);
    }
  }

  /**
   * Close the popup.
   */
  close () {
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
    this.targetMorph['border' + string.capitalize(this.selectedBorder)] = { ...borderStyle, borderRadius };
    signal(this, 'target updated');
  }
}

// BorderControlElements.openInWorld()
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
      spacing: 10,
      wrapSubmorphs: false
    }),
    submorphs: [part(NumberInputDark, {
      type: NumberWidget,
      tooltip: 'Border Width',
      name: 'border width input',
      extent: pt(90, 22),
      min: 0,
      submorphs: [{
        type: Label,
        name: 'interactive label',
        textAndAttributes: ['', {
          fontSize: 16,
          textStyleClasses: ['material-icons']
        }]
      }]
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
          textStyleClasses: ['material-icons']
        }]
      }, 'label'), {
        name: 'label',
        fontSize: 12
      }]
    })]
  }]
});

// part(BorderPopup).viewModel.models
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
    layout: new TilingLayout({ spacing: 10, hugContentsVertically: true, padding: Rectangle.inset(0, 10, 0, 10) }),
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
          padding: Rectangle.inset(20, 0, 0, 0),
          wrapSubmorphs: false
        }),
        submorphs: [
          part(AddButton, {
            master: { auto: AddButton, hover: PropertyLabelHovered },
            name: 'left border',
            tooltip: 'Configure Left Border',
            padding: rect(4, 4, 0, 0),
            textAndAttributes: ['\ue22e', {
              fontSize: 20,
              textStyleClasses: ['material-icons']
            }]
          }),
          part(AddButton, {
            name: 'top border',
            tooltip: 'Configure Top Border',
            master: { auto: AddButton, hover: PropertyLabelHovered },
            padding: rect(4, 4, 0, 0),
            textAndAttributes: ['\ue232', {
              fontSize: 20,
              textStyleClasses: ['material-icons']
            }]
          }),
          part(AddButton, {
            master: { auto: AddButton, hover: PropertyLabelHovered },
            name: 'right border',
            tooltip: 'Configure Right Border',
            padding: rect(4, 4, 0, 0),
            textAndAttributes: ['\ue230', {
              fontSize: 20,
              textStyleClasses: ['material-icons']
            }]
          }),
          part(AddButton, {
            master: { auto: AddButton, hover: PropertyLabelHovered },
            name: 'bottom border',
            tooltip: 'Configure Bottom Border',
            padding: rect(4, 4, 0, 0),
            textAndAttributes: ['\ue229', {
              fontSize: 20,
              textStyleClasses: ['material-icons']
            }]
          })
        ]
      }, part(BorderControlElements, { name: 'border control', viewModelClass: BorderControlModel, viewModel: { updateDirectly: false } })]
  })]
});

// part(BorderControl).openInWorld()
// BorderControl.openInWorld()
// i = part(BorderControl).get('border width input')
// i.width
// i.master._overriddenProps.get(i)
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
          spacing: 10,
          wrapSubmorphs: false
        }),
        submorphs: [{
          name: 'border width input',
          extent: pt(59.9, 22),
          min: 0,
          tooltip: 'Border Width',
          submorphs: [{
            name: 'value',
            extent: pt(45.7, 21)
          }]
        }]
      }, add(part(AddButton, {
        master: {
          hover: PropertyLabelHovered,
          click: PropertyLabelActive
        },
        name: 'more button',
        tooltip: 'Open Advanced Settings',
        padding: rect(6, 4, 0, 0),
        textAndAttributes: ['', {
          fontSize: 18,
          textStyleClasses: ['material-icons']
        }]
      }))
    ]
  }))
  ]
});

export { BorderControl, BorderPopup, BorderControlElements };
