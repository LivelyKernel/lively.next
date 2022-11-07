import { pt, rect, Color, Rectangle } from 'lively.graphics';
import { TilingLayout, config, Icon, ViewModel, part, add, without, component } from 'lively.morphic';
import { obj, arr } from 'lively.lang';
import {
  EnumSelector, BoundsContainerHovered, BoundsContainerInactive, PropertyLabelHovered,
  AddButton, DarkNumberIconWidget, PropertyLabel, DarkThemeList
} from '../shared.cp.js';
import { ColorInput } from '../../styling/color-picker.cp.js';
import { PropertySection } from './section.cp.js';
import { disconnect, connect } from 'lively.bindings';
import { sanitizeFont } from 'lively.morphic/helpers.js';
import { DarkColorPicker } from '../dark-color-picker.cp.js';
import { PaddingControlsDark } from './popups.cp.js';

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
          return this.getProperty('hoveredButtonComponent') || PropertyLabelHovered;
        }
      },
      activeButtonComponent: {
        isComponent: true,
        get () {
          return this.getProperty('activeButtonComponent') || PropertyLabel;
        }
      },
      styledProps: {
        readOnly: true,
        get () {
          return ['fontSize', 'lineHeight', 'letterSpacing', 'fontColor', 'fontFamily', 'fontWeight'];
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
    this.models.fontFamilySelector.items = arr.uniq([...this.view.env.fontMetric.supportedFonts, ...config.text.basicFontItems]).map(f => {
      return {
        value: sanitizeFont(f),
        string: f,
        isListItem: true
      };
    });

    // also watch for changes in selection
    if (target.isText && !this.globalMode) {
      connect(target, 'selectionChange', this, 'update');
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
          autoWidth, autoHeight, fixedExtent,
          italicStyle, underlineStyle, quote,
          lineWrappingSelector, paddingControls
        } = this.ui;
        const { activeButtonComponent, hoveredButtonComponent } = this;

        fontFamilySelector.selection = text.fontFamily;
        fontWeightSelector.selection = text.fontWeight; // fixme
        fontSizeInput.number = text.fontSize;
        lineHeightInput.number = text.lineHeight; // fixme
        letterSpacingInput.number = text.letterSpacing;
        lineWrappingSelector.selection = text.lineWrapping;
        fontColorInput.setColor(text.fontColor);
        leftAlign.master = text.textAlign === 'left' ? hoveredButtonComponent : activeButtonComponent;
        centerAlign.master = text.textAlign === 'center' ? hoveredButtonComponent : activeButtonComponent;
        rightAlign.master = text.textAlign === 'right' ? hoveredButtonComponent : activeButtonComponent;
        blockAlign.master = text.textAlign === 'justify' ? hoveredButtonComponent : activeButtonComponent;
        italicStyle.master = text.fontStyle === 'italic' ? hoveredButtonComponent : activeButtonComponent;
        underlineStyle.master = text.textDecoration === 'underline' ? hoveredButtonComponent : activeButtonComponent;
        if (quote) quote.master = text.quote === 1 ? hoveredButtonComponent : activeButtonComponent;
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
    cb(sel && !sel.isEmpty() && !this.globalMode ? { ...obj.select(targetMorph, this.styledProps), ...targetMorph.getStyleInRange(sel) } : targetMorph);
  }

  /*
   * Changes the text attributes of the entire morph or the selection of a text morph.
   * @param { String } name - Property name to be changed.
   * @param { Function | Number | String } valueOrFn - The new value of the property or a function where
   *                                                   the return method will be used as the new property value.
   */
  changeAttributeInSelectionOrMorph (name, valueOrFn) {
    const { targetMorph } = this;
    if (!targetMorph) return;
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
      this.changeAttributeInSelectionOrMorph('textAlign', align);
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
    this.changeAttributeInSelectionOrMorph('fontStyle', style =>
      style === 'italic' ? 'normal' : 'italic');
    this.update();
  }

  toggleUnderline () {
    this.changeAttributeInSelectionOrMorph('textDecoration', decoration =>
      decoration === 'underline' ? 'none' : 'underline');
    this.update();
  }

  toggleQuote () {
    this.changeAttributeInSelectionOrMorph('quote', quoteActive =>
      quoteActive === 1 ? 0 : 1);
    this.update();
  }

  changeFontWeight (weight) {
    this.changeAttributeInSelectionOrMorph('fontWeight', weight);
  }

  changeFontColor (color) {
    this.changeAttributeInSelectionOrMorph('fontColor', color);
  }

  changeFontSize (size) {
    this.changeAttributeInSelectionOrMorph('fontSize', size);
  }

  changeFontFamily (fontFamily) {
    this.changeAttributeInSelectionOrMorph('fontFamily', fontFamily);
  }

  changeLineHeight (height) {
    this.changeAttributeInSelectionOrMorph('lineHeight', height);
  }

  changeLetterSpacing (spacing) {
    this.changeAttributeInSelectionOrMorph('letterSpacing', spacing);
  }

  changePadding (padding) {
    this.targetMorph.padding = padding;
  }

  deactivate () {
    this.models.fontColorInput.closeColorPicker();
  }
}

// RichTextControl.openInWorld()
// part(RichTextControl, { viewModel: { targetMorph: this.get('test text')}}).openInWorld()
const RichTextControl = component(PropertySection, {
  defaultViewModel: RichTextControlModel,
  name: 'rich text control',
  extent: pt(250, 313),
  submorphs: [{
    name: 'h floater',
    submorphs: [{
      name: 'section headline',
      textAndAttributes: ['Rich Text', null]
    }, without('add button')]
  }, add({
    name: 'text controls',
    layout: new TilingLayout({
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
          spacing: 0,
          wrapSubmorphs: false
        }),
        extent: pt(198.6, 23.3),
        viewModel: {
          items: ['IBM Plex Sans'],
          openListInWorld: true,
          listMaster: DarkThemeList,
          listHeight: 1000,
          listAlign: 'selection'
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
          listAlign: 'selection',
          openListInWorld: true,
          listHeight: 1000
        },
        layout: new TilingLayout({
          align: 'center',
          axisAlign: 'center',
          justifySubmorphs: 'spaced',
          orderByIndex: true,
          padding: rect(10, 0, 5, 0),
          wrapSubmorphs: false
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
          padding: Rectangle.inset(0, 1, 0, 1),
          justifySubmorphs: 'packed',
          wrapSubmorphs: false
        }),
        submorphs: [add(part(PropertyLabel, {
          name: 'italic style',
          tooltip: 'Italic',
          fontSize: 14,
          padding: rect(2, 2, 0, 0),
          textAndAttributes: ['\ue23f', {
            fontSize: 18,
            textStyleClasses: ['material-icons']
          }]
        })), add(part(PropertyLabel, {
          name: 'underline style',
          tooltip: 'Underline',
          fontSize: 14,
          padding: rect(2, 2, 0, 0),
          textAndAttributes: ['\ue249', {
            fontSize: 18,
            textStyleClasses: ['material-icons']
          }]
        })), add(part(PropertyLabel, {
          name: 'inline link',
          tooltip: 'Create Link',
          fontSize: 14,
          padding: rect(2, 2, 0, 0),
          textAndAttributes: ['\ue157', {
            fontSize: 18,
            textStyleClasses: ['material-icons']
          }]
        })), add(part(PropertyLabel, {
          name: 'quote',
          tooltip: 'Quote',
          fontSize: 14,
          padding: rect(2, 2, 0, 0),
          textAndAttributes: ['\ue244', {
            fontSize: 18,
            textStyleClasses: ['material-icons']
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
            textStyleClasses: ['material-icons']
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
            textStyleClasses: ['material-icons']
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
            textStyleClasses: ['material-icons']
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
      spacing: 10,
      wrapSubmorphs: false
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
      spacing: 10,
      padding: Rectangle.inset(20, 0, 0, 0)
    }),
    submorphs: [{
      name: 'alignment controls',
      master: { auto: BoundsContainerInactive, hover: BoundsContainerHovered },
      extent: pt(110.3, 22),
      layout: new TilingLayout({
        wrapSubmorphs: false,
        hugContentsVertically: true,
        justifySubmorphs: 'spaced',
        spacing: 5
      }),
      submorphs: [part(AddButton, {
        name: 'left align',
        tooltip: 'Align Left',
        fontSize: 14,
        padding: rect(4, 4, 0, 0),
        textAndAttributes: Icon.textAttribute('align-left')
      }), part(AddButton, {
        name: 'center align',
        tooltip: 'Align Centered',
        fontSize: 14,
        padding: rect(4, 4, 0, 0),
        textAndAttributes: Icon.textAttribute('align-center')
      }), part(AddButton, {
        name: 'right align',
        tooltip: 'Align Right',
        fontSize: 14,
        padding: rect(4, 4, 0, 0),
        textAndAttributes: Icon.textAttribute('align-right')
      }), part(AddButton, {
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
        wrapSubmorphs: false,
        hugContentsVertically: true,
        justifySubmorphs: 'spaced',
        spacing: 5
      }),
      submorphs: [part(AddButton, {
        name: 'auto width',
        fontSize: 14,
        padding: rect(2, 2, 0, 0),
        rotation: -1.57,
        tooltip: 'Fit Width',
        textAndAttributes: ['\ue94f', {
          fontSize: 18,
          textStyleClasses: ['material-icons']
        }]
      }), part(AddButton, {
        name: 'auto height',
        fontSize: 14,
        padding: rect(2, 2, 0, 0),
        tooltip: 'Fit Height',
        textAndAttributes: ['\ue94f', {
          fontSize: 18,
          textStyleClasses: ['material-icons']
        }]
      }), part(AddButton, {
        name: 'fixed extent',
        fontSize: 14,
        padding: rect(2, 2, 0, 0),
        tooltip: 'Fix Extent/Don\'t fit',
        textAndAttributes: ['\ue835', {
          fontSize: 18,
          textStyleClasses: ['material-icons']
        }]
      })]
    }, part(EnumSelector, {
      name: 'line wrapping selector',
      extent: pt(202.2, 23.3),
      tooltip: 'Choose Line Wrapping',
      viewModel: {
        listAlign: 'selection',
        openListInWorld: true,
        listMaster: DarkThemeList,
        items: [
          { isListItem: true, string: 'No wrapping', value: false },
          { isListItem: true, string: 'Wrap lines', value: true },
          { isListItem: true, string: 'Wrap by characters', value: 'by-chars' },
          { isListItem: true, string: 'Wrap by words', value: 'by-words' },
          { isListItem: true, string: 'Wrap only by words', value: 'only-by-words' }]
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
