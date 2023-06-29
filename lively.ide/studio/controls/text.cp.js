import { pt, rect, Color, Rectangle } from 'lively.graphics';
import { TilingLayout, Icon, ViewModel, part, add, without, component } from 'lively.morphic';
import { obj } from 'lively.lang';
import {
  EnumSelector,
  BoundsContainerHovered,
  BoundsContainerInactive,
  PropertyLabelHovered,
  DarkNumberIconWidget,
  PropertyLabel,
  DarkThemeList
} from '../shared.cp.js';
import { ColorInput } from '../../styling/color-picker.cp.js';
import { PropertySection } from './section.cp.js';
import { disconnect, connect } from 'lively.bindings';

import { DarkColorPicker } from '../dark-color-picker.cp.js';
import { PaddingControlsDark } from './popups.cp.js';
import { availableFonts } from 'lively.morphic/rendering/fonts.js';
import { fontWeightToString, fontWeightNameToNumeric } from 'lively.morphic/rendering/font-metric.js';
import { sanitizeFont } from 'lively.morphic/helpers.js';
import { rainbow } from 'lively.graphics/color.js';

/**
 * This model provides functionality for rich-text-editing frontends.
 * There are two distinct use cases for this: Changing the global defaults of a Text,
 * or changing the textattributes of an selection. Those two modes are utilized by different frontends
 * (side bar vs. formatting popup). The mode is controlled by the `globalMode` flag on the model.
 */
export class RichTextControlModel extends ViewModel {
  static get properties () {
    return {
      globalMode: {
        defaultValue: false
      },
      targetMorph: {},
      hoveredButtonComponent: {
        isComponent: true,
        get () {
          return { auto: PropertyLabelHovered, hover: PropertyLabel };
        }
      },
      activeButtonComponent: {
        isComponent: true,
        get () {
          return { auto: PropertyLabel, hover: PropertyLabelHovered };
        }
      },
      styledProps: {
        readOnly: true,
        get () {
          return ['fontSize', 'lineHeight', 'letterSpacing', 'fontColor', 'fontFamily', 'fontWeight', 'textAlign', 'textDecoration', 'fontStyle'];
        }
      },
      expose: {
        get () {
          return ['update', 'targetMorph'];
        }
      },
      bindings: {
        get () {
          return [
            { model: 'font family selector', signal: 'selection', handler: 'changeFontFamily' },
            { model: 'font weight selector', signal: 'selection', handler: 'changeFontWeight' },
            { model: 'line wrapping selector', signal: 'selection', handler: 'changeLineWrapping' },
            { target: 'font size input', signal: 'number', handler: 'changeFontSize' },
            { target: 'line height input', signal: 'number', handler: 'changeLineHeight' },
            { target: 'letter spacing input', signal: 'number', handler: 'changeLetterSpacing' },
            { model: 'font color input', signal: 'color', handler: 'changeFontColor' },
            { target: 'alignment controls', signal: 'onMouseDown', handler: 'selectTextAlignment' },
            { target: 'resizing controls', signal: 'onMouseDown', handler: 'selectBoundsResizing' },
            { target: 'inline link', signal: 'onMouseDown', handler: 'changeLink' },
            { target: 'italic style', signal: 'onMouseDown', handler: 'toggleItalic' },
            { target: 'quote', signal: 'onMouseDown', handler: 'toggleQuote' },
            { target: 'underline style', signal: 'onMouseDown', handler: 'toggleUnderline' },
            { model: 'padding controls', signal: 'paddingChanged', handler: 'changePadding' }
          ];
        }
      }
    };
  }

  focusOn (target) {
    if (this.targetMorph) { disconnect(this.targetMorph, 'selectionChange', this, 'update'); }
    if (target.isText || target.isLabel) { this.targetMorph = target; }
    this.update();
    // also watch for changes in selection
    if (target.isText && !this.globalMode) {
      epiConnect(target, 'selectionChange', this, 'update');
    }
  }

  attach (view) {
    super.attach(view);
    this.update();
  }

  update () {
    this.withoutBindingsDo(() => {
      this.withContextDo(text => {
        const {
          fontFamilySelector, fontWeightSelector, fontSizeInput,
          lineHeightInput, letterSpacingInput, fontColorInput,
          leftAlign, centerAlign, rightAlign, blockAlign,
          autoWidth, autoHeight, fixedExtent, inlineLink,
          italicStyle, underlineStyle, quote,
          lineWrappingSelector, paddingControls
        } = this.ui;
        const { activeButtonComponent, hoveredButtonComponent } = this;
        
        this.models.fontFamilySelector.items = availableFonts().map(font => {
          return {
            value: font,
            string: font.name,
            isListItem: true
          };
        });
        fontFamilySelector.selection = text.fontFamily;
        if (text.fontFamilyMixed || this.globalMode && text.hasMixedTextAttributes('fontFamily')) fontFamilySelector.setMixed();

        fontWeightSelector.selection = text.fontWeight;
        if (text.fontWeightMixed || this.globalMode && text.hasMixedTextAttributes('fontWeight')) fontWeightSelector.setMixed();
        this.updateFontWeightChoices(text.fontFamily);

        fontSizeInput.number = text.fontSize;
        if (text.fontSizeMixed || this.globalMode && text.hasMixedTextAttributes('fontSize')) fontSizeInput.setMixed();

        lineHeightInput.number = text.lineHeight;
        if (text.lineHeightMixed || this.globalMode && text.hasMixedTextAttributes('lineHeight')) lineHeightInput.setMixed();

        if (letterSpacingInput) {
          letterSpacingInput.number = text.letterSpacing;
          if (text.letterSpacingMixed || this.globalMode && text.hasMixedTextAttributes('letterSpacing')) letterSpacingInput.setMixed();
        }

        if (lineWrappingSelector) {
          lineWrappingSelector.selection = text.lineWrapping;
          if (text.lineWrappingMixed || this.globalMode && text.hasMixedTextAttributes('lineWrapping')) lineWrappingSelector.setMixed();
        }

        fontColorInput.setColor(text.fontColor);
        if (text.fontColorMixed || this.globalMode && text.hasMixedTextAttributes('fontColor')) fontColorInput.setMixed(rainbow);

        leftAlign.master = text.textAlign === 'left' ? hoveredButtonComponent : activeButtonComponent;
        centerAlign.master = text.textAlign === 'center' ? hoveredButtonComponent : activeButtonComponent;
        rightAlign.master = text.textAlign === 'right' ? hoveredButtonComponent : activeButtonComponent;
        blockAlign.master = text.textAlign === 'justify' ? hoveredButtonComponent : activeButtonComponent;
        italicStyle.master = text.fontStyle === 'italic' ? hoveredButtonComponent : activeButtonComponent;
        underlineStyle.master = text.textDecoration === 'underline' ? hoveredButtonComponent : activeButtonComponent;
        if (quote) quote.master = text.quote === 1 ? hoveredButtonComponent : activeButtonComponent;
        if (inlineLink) inlineLink.master = text.link ? hoveredButtonComponent : activeButtonComponent;
        if (paddingControls) paddingControls.startPadding(text.padding);
        if (text.isMorph) {
          fixedExtent.master = text.fixedWidth && text.fixedHeight ? hoveredButtonComponent : activeButtonComponent;
          autoHeight.master = text.fixedWidth && !text.fixedHeight ? hoveredButtonComponent : activeButtonComponent;
          autoWidth.master = !text.fixedWidth && text.fixedHeight ? hoveredButtonComponent : activeButtonComponent;
        }
      });
    });
  }

  /*
   * Execute the callback with the currently focused text/label morph or the
   * current selection (if present).
   * @param { Function } cb - Callback to be called with the context as the argument.
   */
  withContextDo (cb) {
    const { targetMorph } = this;
    if (!targetMorph) return;
    const sel = targetMorph.selection;
    if (sel && !sel.isEmpty() && !this.globalMode) cb({ ...obj.select(targetMorph, this.styledProps), ...targetMorph.getStyleInRange(sel, true) });
    else cb(targetMorph);
  }

  /*
   * Changes the text attributes of the entire morph or the selection of a text morph.
   * @param { String } name - Property name to be changed.
   * @param { Function | Number | String } valueOrFn - The new value of the property or a function where
   *                                                   the return method will be used as the new property value.
   */
  confirm (name, valueOrFn) {
    const { targetMorph } = this;
    if (!targetMorph) return;
    targetMorph.withMetaDo({ reconcileChanges: true }, () => {
      const sel = targetMorph.selection;
      if (targetMorph.isLabel || sel && sel.isEmpty() || this.globalMode) {
        targetMorph[name] = typeof valueOrFn === 'function'
          ? valueOrFn(targetMorph[name])
          : valueOrFn;
      } else {
        targetMorph.undoManager.group();
        targetMorph.changeStyleProperty(name,
          oldVal => typeof valueOrFn === 'function'
            ? valueOrFn(oldVal)
            : valueOrFn);
        targetMorph.undoManager.group();
      }
    });
  }

  /*
   * Opens a prompt that allows to change/set the link of a selection in
   * the currently focused text morph.
   */
  async changeLink () {
    const { targetMorph } = this;
    const sel = targetMorph.selection;
    const { link } = targetMorph.getStyleInRange(sel);
    const newLink = await this.world().prompt('Set link', { input: link || 'https://' });
    targetMorph.undoManager.group();
    targetMorph.setStyleInRange({ link: newLink || undefined }, sel);
    targetMorph.undoManager.group();
  }

  /*
   * Set the alignment of the text inside the selection/morph based on which button was
   * clicked in the UI.
   * @param { Event } evt - Mouse down event triggered in one of the text alignment buttons.
   */
  selectTextAlignment (evt) {
    const align = ({
      'left align': 'left',
      'right align': 'right',
      'center align': 'center',
      'block align': 'justify'
    })[evt.targetMorph.name];
    if (align) {
      if (this.globalMode) this.targetMorph.removePlainTextAttribute('textAlign');
      this.confirm('textAlign', align);
      this.update();
    }
  }

  /*
   * Selects the desired resizing behavior of the text morph dispatched
   * on the button that was clicked inside the UI.
   * @param { Event } evt - Mouse down event targeted on one of the resizing buttons.
   */
  selectBoundsResizing (evt) {
    // only apply to entire morph
    const text = this.targetMorph;
    switch (evt.targetMorph.name) {
      case 'auto width':
        text.fixedWidth = false;
        text.fixedHeight = true;
        break;
      case 'auto height':
        text.fixedWidth = true;
        text.fixedHeight = false;
        break;
      case 'fixed extent':
        text.fixedWidth = true;
        text.fixedHeight = true;
        break;
    }
    this.update();
  }

  changeLineWrapping () {
    // depending on the line wrapping we adjust the bounds resizing
    const text = this.targetMorph;
    if (text) text.lineWrapping = this.ui.lineWrappingSelector.selection;
  }

  toggleItalic () {
    if (this.globalMode) this.targetMorph.removePlainTextAttribute('fontStyle');
    this.confirm('fontStyle', style =>
      style === 'italic' ? 'normal' : 'italic');
    this.update();
  }

  toggleUnderline () {
    if (this.globalMode) this.targetMorph.removePlainTextAttribute('textDecoration', 'underline');
    this.confirm('textDecoration', decoration =>
      decoration === 'underline' ? 'none' : 'underline');
    this.update();
  }

  toggleQuote () {
    this.changeAttributeInSelectionOrMorph('quote', quoteActive =>
      quoteActive === 1 ? 0 : 1);
    this.update();
  }

  changeFontWeight (weight) {
    if (this.globalMode) this.targetMorph.removePlainTextAttribute('fontWeight');
    this.confirm('fontWeight', fontWeightNameToNumeric().get(weight));
  }

  changeFontColor (color) {
    if (this.globalMode) this.targetMorph.removePlainTextAttribute('fontColor');
    this.confirm('fontColor', color);
  }

  changeFontSize (size) {
    if (this.globalMode) this.targetMorph.removePlainTextAttribute('fontSize');
    this.confirm('fontSize', size);
  }

  changeFontFamily (fontFamily) {
    if (this.globalMode) this.targetMorph.removePlainTextAttribute('fontFamily');
    this.confirm('fontFamily', sanitizeFont(fontFamily.name));
    this.updateFontWeightChoices(fontFamily.name);
  }

  updateFontWeightChoices (forFont) {
    const supportedFontWeights = availableFonts().find(f => sanitizeFont(f.name) === sanitizeFont(forFont)).supportedWeights.map(fontWeight => fontWeightToString(fontWeight));
    this.models.fontWeightSelector.items = supportedFontWeights.length > 0 ? supportedFontWeights : [400, 700].map(fontWeight => fontWeightToString(fontWeight));
  }

  changeLineHeight (height) {
    if (this.globalMode) this.targetMorph.removePlainTextAttribute('lineHeight');
    this.confirm('lineHeight', height);
  }

  changeLetterSpacing (spacing) {
    if (this.globalMode) this.targetMorph.removePlainTextAttribute('letterSpacing');
    this.confirm('letterSpacing', spacing);
  }

  changePadding (padding) {
    this.targetMorph.withMetaDo({ reconcileChanges: true }, () => {
      this.targetMorph.padding = padding;
    });
  }

  deactivate () {
    this.models.fontColorInput.closeColorPicker();
  }
}

const RichTextControl = component(PropertySection, {
  defaultViewModel: RichTextControlModel,
  name: 'rich text control',
  extent: pt(250, 313),
  layout: new TilingLayout({
    axisAlign: 'center',
    hugContentsVertically: true,
    orderByIndex: true,
    padding: rect(0, 10, 0, 0),
    resizePolicies: [['h floater', {
      height: 'fixed',
      width: 'fill'
    }]],
    spacing: 10,
    wrapSubmorphs: true
  }),
  submorphs: [{
    name: 'h floater',
    submorphs: [{
      name: 'section headline',
      textAndAttributes: ['Rich Text', null]
    }, without('add button')]
  }, add({
    name: 'text controls',
    layout: new TilingLayout({
      wrapSubmorphs: true,
      orderByIndex: true,
      spacing: 10,
      padding: Rectangle.inset(20, 0, 0, 0)
    }),
    borderColor: Color.rgb(23, 160, 251),
    borderWidth: 0,
    extent: pt(250, 92),
    fill: Color.rgba(0, 0, 0, 0),
    submorphs: [
      part(EnumSelector, {
        name: 'font family selector',
        tooltip: 'Choose Font',
        layout: new TilingLayout({
          align: 'center',
          axisAlign: 'center',
          justifySubmorphs: 'spaced',
          orderByIndex: true,
          padding: rect(10, 0, 5, 0),
          spacing: 0
        }),
        extent: pt(198.6, 23.3),
        viewModel: {
          items: ['IBM Plex Sans'],
          openListInWorld: true,
          listMaster: DarkThemeList,
          listHeight: 200,
          listAlign: 'bottom'
        },
        submorphs: [{
          name: 'label',
          fontSize: 12
        }]
      }), part(EnumSelector, {
        name: 'font weight selector',
        tooltip: 'Choose Font Weight',
        extent: pt(100, 23.3),
        viewModel: {
          listMaster: DarkThemeList,
          items: [{
            isListItem: true,
            string: 'Thin',
            value: 100
          }, {
            isListItem: true,
            string: 'Extra Light',
            value: 200
          }, {
            isListItem: true,
            string: 'Light',
            value: 300
          }, {
            isListItem: true,
            string: 'Normal',
            value: 400
          }, {
            isListItem: true,
            string: 'Medium',
            value: 500
          }, {
            isListItem: true,
            string: 'Semi Bold',
            value: 600
          }, {
            isListItem: true,
            string: 'Bold',
            value: 700
          }, {
            isListItem: true,
            string: 'Extra Bold',
            value: 800
          }, {
            isListItem: true,
            string: 'Ultra Bold',
            value: 900
          }],
          listAlign: 'bottom',
          openListInWorld: true,
          listHeight: 1000
        },
        layout: new TilingLayout({
          align: 'center',
          axisAlign: 'center',
          justifySubmorphs: 'spaced',
          orderByIndex: true,
          padding: rect(10, 0, 5, 0)
        }),
        submorphs: [{
          name: 'label',
          fontSize: 12
        }]
      }),
      part(BoundsContainerInactive, {
        name: 'styling controls',
        extent: pt(88, 24),
        master: { auto: BoundsContainerInactive, hover: BoundsContainerHovered },
        layout: new TilingLayout({
          hugContentsVertically: true,
          padding: Rectangle.inset(0, 1, 0, 1)
        }),
        submorphs: [add(part(PropertyLabel, {
          name: 'italic style',
          tooltip: 'Italic',
          fontSize: 14,
          padding: rect(2, 2, 0, 0),
          textAndAttributes: ['\ue23f', {
            fontSize: 18,
            fontFamily: 'Material Icons'
          }]
        })), add(part(PropertyLabel, {
          name: 'underline style',
          tooltip: 'Underline',
          fontSize: 14,
          padding: rect(2, 2, 0, 0),
          textAndAttributes: ['\ue249', {
            fontSize: 18,
            fontFamily: 'Material Icons'
          }]
        })), add(part(PropertyLabel, {
          name: 'inline link',
          tooltip: 'Create Link',
          fontSize: 14,
          padding: rect(2, 2, 0, 0),
          textAndAttributes: ['\ue157', {
            fontSize: 18,
            fontFamily: 'Material Icons'
          }]
        })), add(part(PropertyLabel, {
          name: 'quote',
          tooltip: 'Quote',
          fontSize: 14,
          padding: rect(2, 2, 0, 0),
          textAndAttributes: ['\ue244', {
            fontSize: 18,
            fontFamily: 'Material Icons'
          }]
        }))]
      }),
      part(DarkNumberIconWidget, {
        name: 'font size input',
        width: 60,
        submorphs: [{
          name: 'interactive label',
          textAndAttributes: ['\ue245', {
            fontSize: 16,
            fontFamily: 'Material Icons'
          }]
        }],
        tooltip: 'Font Size'
      }), part(DarkNumberIconWidget, {
        name: 'line height input',
        width: 60,
        floatingPoint: true,
        submorphs: [{
          name: 'interactive label',
          textAndAttributes: ['\ue240', {
            fontSize: 16,
            fontFamily: 'Material Icons'
          }]
        }, {
          name: 'value',
          floatingPoint: true,
          precision: 1
        }],
        tooltip: 'Line Height'
      }), part(DarkNumberIconWidget, {
        name: 'letter spacing input',
        width: 60,
        submorphs: [{
          name: 'interactive label',
          textAndAttributes: ['\ue014', {
            fontSize: 16,
            fontFamily: 'Material Icons'
          }]
        }],
        tooltip: 'Letter Spacing'
      })]
  }), add(part(ColorInput, {
    name: 'font color input',
    viewModel: {
      colorPickerComponent: DarkColorPicker
    },
    layout: new TilingLayout({
      axisAlign: 'center',
      orderByIndex: true,
      padding: rect(20, 1, -10, 1),
      resizePolicies: [['hex input', {
        height: 'fill',
        width: 'fixed'
      }], ['opacity input', {
        height: 'fill',
        width: 'fixed'
      }]],
      spacing: 10
    }),
    extent: pt(250.3, 25),
    submorphs: [{
      name: 'hex input',
      extent: pt(74.8, 22)
    }, {
      name: 'opacity input',
      extent: pt(83.4, 22)
    }]
  })),

  add({
    name: 'bottom wrapper',
    clipMode: 'hidden',
    extent: pt(251.4, 65.6),
    fill: Color.transparent,
    layout: new TilingLayout({
      wrapSubmorphs: true,
      spacing: 10,
      padding: Rectangle.inset(20, 0, 0, 0),
      hugContentsVertically: true
    }),
    submorphs: [{
      name: 'alignment controls',
      master: { auto: BoundsContainerInactive, hover: BoundsContainerHovered },
      extent: pt(110.3, 22),
      layout: new TilingLayout({
        hugContentsVertically: true,
        justifySubmorphs: 'spaced',
        spacing: 5
      }),
      submorphs: [part(PropertyLabel, {
        name: 'left align',
        tooltip: 'Align Left',
        fontSize: 14,
        padding: rect(4, 4, 0, 0),
        textAndAttributes: Icon.textAttribute('align-left')
      }), part(PropertyLabel, {
        name: 'center align',
        tooltip: 'Align Centered',
        fontSize: 14,
        padding: rect(4, 4, 0, 0),
        textAndAttributes: Icon.textAttribute('align-center')
      }), part(PropertyLabel, {
        name: 'right align',
        tooltip: 'Align Right',
        fontSize: 14,
        padding: rect(4, 4, 0, 0),
        textAndAttributes: Icon.textAttribute('align-right')
      }), part(PropertyLabel, {
        name: 'block align',
        tooltip: 'Justify Text',
        fontSize: 14,
        padding: rect(4, 4, 0, 0),
        textAndAttributes: Icon.textAttribute('align-justify')
      })]
    }, {
      name: 'resizing controls',
      extent: pt(80.4, 22),
      master: { auto: BoundsContainerInactive, hover: BoundsContainerHovered },
      layout: new TilingLayout({
        hugContentsVertically: true,
        justifySubmorphs: 'spaced',
        spacing: 5
      }),
      submorphs: [part(PropertyLabel, {
        name: 'auto width',
        tooltip: 'Fit Width',
        padding: rect(3, 0, -3, 0),
        rotation: Math.PI / 2,
        textAndAttributes: ['\ue94f', {
          fontSize: 18,
          fontFamily: 'Material Icons'
        }]
      }), part(PropertyLabel, {
        name: 'auto height',
        tooltip: 'Fit Height',
        padding: 0,
        textAndAttributes: ['\ue94f', {
          fontSize: 18,
          fontFamily: 'Material Icons'
        }]
      }), part(PropertyLabel, {
        name: 'fixed extent',
        padding: 0,
        fontSize: 14,
        tooltip: 'Fix Extent/Don\'t fit',
        textAndAttributes: ['\ue835', {
          fontSize: 18,
          fontFamily: 'Material Icons'
        }]
      })]
    }, part(EnumSelector, {
      name: 'line wrapping selector',
      extent: pt(202.2, 23.3),
      tooltip: 'Choose Line Wrapping',
      viewModel: {
        listAlign: 'bottom',
        openListInWorld: true,
        listMaster: DarkThemeList,
        items: [
          { isListItem: true, string: 'No Wrapping', value: 'no-wrap' },
          { isListItem: true, string: 'Wrap by Words', value: 'by-words' },
          { isListItem: true, string: 'Wrap by Characters', value: 'by-chars' },
          { isListItem: true, string: 'Wrap only by Words', value: 'only-by-words' }]
      },
      submorphs: [{
        name: 'label',
        fontSize: 12
      }]
    })]
  }), add(part(PaddingControlsDark))
  ]
});

export { RichTextControl };
