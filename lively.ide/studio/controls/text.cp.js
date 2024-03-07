import { pt, rect, Color } from 'lively.graphics';
import { TilingLayout, Icon, ViewModel, part, add, component } from 'lively.morphic';
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
import { disconnect, epiConnect } from 'lively.bindings';

import { DarkColorPicker } from '../dark-color-picker.cp.js';
import { PaddingControlsDark } from './popups.cp.js';
import { availableFonts, DEFAULT_FONTS } from 'lively.morphic/rendering/fonts.js';
import { fontWeightToString, fontWeightNameToNumeric } from 'lively.morphic/rendering/font-metric.js';
import { sanitizeFont } from 'lively.morphic/helpers.js';
import { rainbow } from 'lively.graphics/color.js';
import { openFontManager } from '../font-manager.cp.js';
import { capitalize } from 'lively.lang/string.js';

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
            { target: 'font family selector', signal: 'selection', handler: 'changeFontFamily' },
            { target: 'font weight selector', signal: 'selection', handler: 'changeFontWeight' },
            { target: 'line wrapping selector', signal: 'selection', handler: 'changeLineWrapping' },
            { target: 'font size input', signal: 'number', handler: 'changeFontSize' },
            { target: 'line height input', signal: 'number', handler: 'changeLineHeight' },
            { target: 'letter spacing input', signal: 'number', handler: 'changeLetterSpacing' },
            { target: 'font color input', signal: 'color', handler: 'changeFontColor' },
            { target: 'alignment controls', signal: 'onMouseDown', handler: 'selectTextAlignment' },
            { target: 'resizing controls', signal: 'onMouseDown', handler: 'selectBoundsResizing' },
            { target: 'inline link', signal: 'onMouseDown', handler: 'changeLink' },
            { target: 'italic style', signal: 'onMouseDown', handler: 'toggleItalic' },
            { target: 'quote', signal: 'onMouseDown', handler: 'toggleQuote' },
            { target: 'underline style', signal: 'onMouseDown', handler: 'toggleUnderline' },
            { target: 'padding controls', signal: 'paddingChanged', handler: 'changePadding' },
            { target: 'add button', signal: 'onMouseDown', handler: 'installCustomFont' }
          ];
        }
      }
    };
  }

  installCustomFont () {
    const p = openFontManager();
    p.env.forceUpdate(p);
    p.topRight = this.view.globalBounds().topLeft();
    p.topLeft = this.world().visibleBounds().translateForInclusion(p.globalBounds()).topLeft();
    this.update();
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
          leftAlign, centerAlign, rightAlign, blockAlign, inlineLink,
          italicStyle, underlineStyle, quote,
          lineWrappingSelector, paddingControls
        } = this.ui;

        const fontItemCreator = font => {
          return {
            value: font,
            string: font.name,
            isListItem: true,
            tooltip: font.name
          };
        };

        if ($world.openedProject) {
          const projectFontItems = $world.openedProject.projectFonts.map(fontItemCreator);
          if (projectFontItems.length > 0) {
            projectFontItems[projectFontItems.length - 1].style = {
              borderWidth: { bottom: 5, top: 0, left: 0, right: 0, top: 0 },
              borderStyle: { bottom: 'double', top: 'none', left: 'none', right: 'none', top: 'none' }
            };
          }
          this.models.fontFamilySelector.items = projectFontItems.concat(DEFAULT_FONTS.map(fontItemCreator));
        } else this.models.fontFamilySelector.items = DEFAULT_FONTS.map(fontItemCreator);

        fontFamilySelector.selection = text.fontFamily?.replace(/^"(.*)"$/, '$1');
        if (text.fontFamilyMixed || this.globalMode && text.hasMixedTextAttributes('fontFamily')) fontFamilySelector.setMixed();

        fontWeightSelector.selection = /\d/.test(text.fontWeight) ? fontWeightToString(text.fontWeight) : capitalize(text.fontWeight);

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

        leftAlign.master.setState(text.textAlign === 'left' ? 'active' : null);
        centerAlign.master.setState(text.textAlign === 'center' ? 'active' : null);
        rightAlign.master.setState(text.textAlign === 'right' ? 'active' : null);
        blockAlign.master.setState(text.textAlign === 'justify' ? 'active' : null);
        italicStyle.master.setState(text.fontStyle === 'italic' ? 'active' : null);
        underlineStyle.master.setState(text.textDecoration === 'underline' ? 'active' : null);
        if (quote) quote.master.setState(text.quote === 1 ? 'active' : null);
        if (inlineLink) inlineLink.master.setState(text.link ? 'active' : null);
        if (paddingControls) paddingControls.startPadding(text.padding);
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
    if (sel && !sel.isEmpty() && !this.globalMode) cb({ ...obj.select(targetMorph, this.styledProps), ...targetMorph.getStyleInRange(sel) });
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
    if (text) {
      text.withMetaDo({ reconcileChanges: true }, () => {
        text.lineWrapping = this.ui.lineWrappingSelector.selection;
      });
    }
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
    const fontEntry = availableFonts().find(f => sanitizeFont(f.name) === sanitizeFont(forFont));
    const supportedFontWeights = fontEntry?.supportedWeights.map(fontWeight => fontWeightToString(fontWeight)) || [];
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
    axis: 'column',
    axisAlign: 'center',
    hugContentsVertically: true,
    orderByIndex: true,
    padding: rect(0, 10, 0, 0),
    resizePolicies: [['h floater', {
      height: 'fixed',
      width: 'fill'
    }]],
    spacing: 10
  }),
  submorphs: [{
    name: 'h floater',
    submorphs: [{
      name: 'section headline',
      textAndAttributes: ['Rich Text', null]
    }, {
      name: 'add button',
      tooltip: 'Install a custom font',
      textAndAttributes: ['', {
        fontFamily: 'Tabler Icons',
        fontSize: 18,
        fontWeight: '900'
      }]
    }]
  }, add({
    name: 'text controls',
    layout: new TilingLayout({
      orderByIndex: true,
      padding: rect(20, 0, -20, 0),
      spacing: 10,
      wrapSubmorphs: true
    }),
    borderColor: Color.rgb(23, 160, 251),
    borderWidth: 0,
    extent: pt(250, 93.8),
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
      }), {
        name: 'weight and styles',
        extent: pt(198, 8.9),
        layout: new TilingLayout({
          hugContentsVertically: true,
          orderByIndex: true,
          resizePolicies: [['font weight selector', {
            height: 'fixed',
            width: 'fill'
          }]],
          spacing: 10
        }),
        fill: Color.transparent,
        submorphs: [part(EnumSelector, {
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
          extent: pt(87.4, 26.4),
          master: { auto: BoundsContainerInactive, hover: BoundsContainerHovered },
          layout: new TilingLayout({
            orderByIndex: true,
            hugContentsHorizontally: true
          }),
          submorphs: [add(part(PropertyLabel, {
            name: 'italic style',
            master: { states: { active: PropertyLabelHovered } },
            tooltip: 'Italic',
            fontSize: 14,
            padding: rect(2, 0, 0, 0),
            textAndAttributes: ['\ue23f', {
              fontSize: 18,
              fontFamily: 'Material Icons'
            }]
          })), add(part(PropertyLabel, {
            name: 'underline style',
            master: { states: { active: PropertyLabelHovered } },
            tooltip: 'Underline',
            fontSize: 14,
            padding: rect(2, 0, 0, 0),
            textAndAttributes: ['\ue249', {
              fontSize: 18,
              fontFamily: 'Material Icons'
            }]
          })), add(part(PropertyLabel, {
            name: 'inline link',
            master: { states: { active: PropertyLabelHovered } },
            tooltip: 'Create Link',
            fontSize: 14,
            padding: rect(2, 0, 0, 0),
            textAndAttributes: ['\ue157', {
              fontSize: 18,
              fontFamily: 'Material Icons'
            }]
          })), add(part(PropertyLabel, {
            name: 'quote',
            master: { states: { active: PropertyLabelHovered } },
            tooltip: 'Quote',
            fontSize: 14,
            padding: rect(2, 0, 0, 0),
            textAndAttributes: ['\ue244', {
              fontSize: 18,
              fontFamily: 'Material Icons'
            }]
          }))]
        })]
      },
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
      hugContentsVertically: true,
      orderByIndex: true,
      padding: rect(20, 0, -20, 0),
      spacing: 10,
      wrapSubmorphs: true
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
        master: { states: { active: PropertyLabelHovered } },
        tooltip: 'Align Left',
        fontSize: 14,
        padding: rect(4, 4, 0, 0),
        textAndAttributes: Icon.textAttribute('align-left')
      }), part(PropertyLabel, {
        name: 'center align',
        master: { states: { active: PropertyLabelHovered } },
        tooltip: 'Align Centered',
        fontSize: 14,
        padding: rect(4, 4, 0, 0),
        textAndAttributes: Icon.textAttribute('align-center')
      }), part(PropertyLabel, {
        name: 'right align',
        master: { states: { active: PropertyLabelHovered } },
        tooltip: 'Align Right',
        fontSize: 14,
        padding: rect(4, 4, 0, 0),
        textAndAttributes: Icon.textAttribute('align-right')
      }), part(PropertyLabel, {
        name: 'block align',
        master: { states: { active: PropertyLabelHovered } },
        tooltip: 'Justify Text',
        fontSize: 14,
        padding: rect(4, 4, 0, 0),
        textAndAttributes: Icon.textAttribute('align-justify')
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
  }), add(part(PaddingControlsDark, { name: 'padding controls' }))
  ]
});

export { RichTextControl };
