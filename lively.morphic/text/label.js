import {  promise } from 'lively.lang';
import { Color } from 'lively.graphics';
import { Icon } from './icons.js';
import { Text } from './morph.js';


export class Label extends Text {
  static get properties () {
    return {
      acceptsDrops: {
        defaultValue: false
      },

      fill: { defaultValue: Color.transparent },
      draggable: { defaultValue: false },
      nativeCursor: { defaultValue: 'default' },

      isIcon: {
        derived: true,
        get () {
          return properties.values(Icons).map(({ code }) => code).includes(this.textString);
        }
      },

      value: {
        derived: true,
        after: ['textAndAttributes', 'textString'],
        get () {
          const { textAndAttributes } = this;
          if (textAndAttributes.length <= 2) {
            const [text, style] = textAndAttributes;
            if (!Object.keys(style || {}).length) return text || '';
          }
          return textAndAttributes;
        },
        set (value) {
          typeof value === 'string'
            ? this.textString = value
            : this.textAndAttributes = value;
        }
      },

      textString: {
        derived: true,
        after: ['textAndAttributes'],
        get () { return this.textAndAttributes.map((text, i) => i % 2 == 0 ? text : '').join(''); },
        set (value) {
          // This is only needed because the timing of the Text -> Label transition is messed up....
          if (this.document) {
            value = (value !== null) ? String(value) : '';
            this.deleteText({ start: { column: 0, row: 0 }, end: this.document.endPosition });
            this.insertText(value, { column: 0, row: 0 });
          } 
          this.textAndAttributes = [String(value), null]; 
        }
      },

      textAndAttributes: {
        after: ['autofit'],
        get () {
          let val = this.getProperty('textAndAttributes');
          if (!val || val.length < 1) val = ['', null];
          return val;
        },

        set (value) {
          if (!Array.isArray(value)) value = [String(value), {}];
          if (value.length === 0) value = ['', {}];
          const prevValue = this.textAndAttributes;
          this.setProperty('textAndAttributes', value);
          if (this.autofit) this.invalidateTextLayout();
          signal(this, 'value', value);
        }
      },

      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
      // valueAndAnnotation is a way to put rich text content followed by a right
      // aligned annotation into a label. It simply is using textAndAttributes with
      // the convention that the last string/attribue pair in textAndAttributes is the
      // annotation (the attribute includes the textStyleClass "annotation")

      valueAndAnnotation: {
        derived: true,
        after: ['textAndAttributes'],

        get () {
          let value = this.textAndAttributes; let annotation = null;
          if (value.length > 2) {
            const [string, props] = value.slice(-2);
            if (props && props.textStyleClasses && props.textStyleClasses.includes('annotation')) {
              value = value.slice(0, -2);
              annotation = [string, props];
            }
          }
          return { value, annotation };
        },

        set (valueAndAnnotation) {
          let { value, annotation } = valueAndAnnotation;

          // Ensure value is in the right format for being the prefix in textAndAttributes
          if (!value) value = '';
          if (typeof value === 'string') value = [value, null];
          if (!Array.isArray(value)) value = [String(value), null];

          const textAndAttributes = value.slice();

          // convert and add the annotation
          if (annotation) {
            if (typeof annotation === 'string') annotation = [annotation, null];
            let annAttr = annotation[1];
            if (!annAttr) annAttr = annotation[1] = {};
            textAndAttributes.push(...annotation);
            annAttr.textStyleClasses = (annAttr.textStyleClasses || []).concat('annotation');
            if (!annAttr.textStyleClasses.includes('annotation')) { annAttr.textStyleClasses.push('annotation'); }
          }

          this.textAndAttributes = textAndAttributes;
        }

      },

      autofit: {
        defaultValue: true,
        set (value) {
          this.setProperty('autofit', value);
          if (value) this._needsFit = true;
        }
      },

      master: {
        after: ['padding']
      },

      padding: {
        type: 'Rectangle',
        isStyleProp: true,
        defaultValue: Rectangle.inset(0),
        after: ['autofit'],
        initialize (value) { this.padding = value; /* for num -> rect conversion */ },
        set (value) {
          if (!value) value = Rectangle.inset(0);
          const previousPadding = this.padding;
          this.setProperty('padding', typeof value === 'number' ? Rectangle.inset(value) : value);
          if (this.autofit && !previousPadding.equals(value)) this.invalidateTextLayout();
        }
      },

      fontFamily: {
        isStyleProp: true,
        type: 'Enum',
        values: config.text.basicFontItems,
        after: ['autofit'],
        defaultValue: 'IBM Plex Sans, Sans-Serif',
        set (fontFamily) {
          const previousFontFamily = this.fontFamily;
          this.setProperty('fontFamily', fontFamily);
          if (this.autofit && previousFontFamily != fontFamily) this.invalidateTextLayout();
        }
      },

      fontSize: {
        type: 'Number',
        min: 1,
        isStyleProp: true,
        defaultValue: 12,
        after: ['autofit'],
        set (fontSize) {
          const previousFontSize = this.fontSize;
          this.setProperty('fontSize', fontSize);
          if (this.autofit && fontSize != previousFontSize) this.invalidateTextLayout();
        }
      },

      fontColor: { type: 'Color', isStyleProp: true, defaultValue: Color.black },

      fontWeight: {
        type: 'Enum',
        values: ['bold', 'bolder', 'light', 'lighter'],
        isStyleProp: true,
        defaultValue: 'normal',
        after: ['autofit'],
        set (fontWeight) {
          const previousFontWeight = this.fontWeight;
          this.setProperty('fontWeight', fontWeight);
          if (this.autofit && previousFontWeight != fontWeight) this.invalidateTextLayout();
        }
      },

      fontStyle: {
        type: 'Enum',
        values: ['normal', 'italic', 'oblique'],
        isStyleProp: true,
        defaultValue: 'normal',
        after: ['autofit'],
        set (fontStyle) {
          const previousFontStyle = this.fontStyle;
          this.setProperty('fontStyle', fontStyle);
          if (this.autofit && previousFontStyle != fontStyle) this.invalidateTextLayout();
        }
      },

      textShadow: { type: 'String', isStyleProp: true, defaultValue: '' },

      textDecoration: { defaultValue: 'none' },

      textStyleClasses: {
        defaultValue: undefined,
        after: ['autofit'],
        set (textStyleClasses) {
          this.setProperty('textStyleClasses', textStyleClasses);
          if (this.autofit) this.invalidateTextLayout();
        }
      }
    };
  }

  static icon (iconName, props = { prefix: '', suffix: '' }) {
    return Icon.makeLabel(iconName, props);
  }
  
  onDropHoverUpdate (evt) {
    // prevent default
  }

  // __additionally_serialize__ (snapshot, objRef, pool, addFn) {
  //   super.__additionally_serialize__(snapshot, objRef, pool, addFn);
  //   if (this.autofit) this.fitIfNeeded();
  //   snapshot._cachedTextBounds = this._cachedTextBounds && this._cachedTextBounds.toTuple();
  // }

  // __after_deserialize__ (snapshot, objRef, pool) {
  //   super.__after_deserialize__(snapshot, objRef, pool);
  //   if (snapshot._cachedTextBounds) {
  //     // change meta data to indicate that morph is being reconstructed
  //     this.changeMetaData('deserializeInfo', { recoveredTextBounds: true });
  //     this._cachedTextBounds = Rectangle.fromTuple(snapshot._cachedTextBounds);
  //   }
  // }

  get isLabel () { return true; }

  allFontsLoaded (fontFaceSet) {
    const { fontMetric } = this.env;
    return [
      this,
      ...this.textAndAttributes.map((attr, i) => {
        if (i % 2) {
          return {
            fontFamily: (attr && attr.fontFamily) || this.fontFamily,
            fontWeight: (attr && attr.fontWeight) || this.fontWeight
          };
        }
      }).filter(Boolean)
    ].every(attr => {
      if (fontFaceSet) {
        const face = fontFaceSet.find(face =>
          face.family == attr.fontFamily &&
          face.weight == (fontMetric.fontDetector.namedToNumeric[attr.fontWeight] || attr.fontWeight));
        return !!face;
        // document.fonts.check(`normal ${attr.fontWeight} 12px ${attr.fontFamily}`)
      } else return fontMetric.isFontSupported(attr.fontFamily, attr.fontWeight);
    });
  }

  async whenFontLoaded () {
    // fixme: remove busy wait, since it kills performance
    if (this.allFontsLoaded()) return true;
    const fonts = [...(await document.fonts.ready)];
    if (this.allFontsLoaded(fonts.filter(face => face.status == 'loaded'))) return true;
    // as a last resort, do a busy wait...
    return promise.waitFor(5000, () => {
      return this.allFontsLoaded();
    });
  }

  // // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // // events

  // FIXME
  // async interactivelyChangeLabel () {
  //   const newLabel = await this.world().prompt('edit label', {
  //     input: this.textString,
  //     historyId: 'lively.morphic-label-edit-hist',
  //     selectInput: true
  //   });
  //   if (typeof newLabel === 'string') { this.textString = newLabel; }
  // }

  // FIXME
  // async interactivelySetIcon () {
  //   const res = await this.world().filterableListPrompt('Select Icon', Object.keys(Icons).map(iconName => {
  //     return { isListItem: true, label: [...Icon.textAttribute(iconName, { paddingRight: '10px' }), iconName, {}], value: iconName };
  //   }));
  //   const [iconName] = res.selected;
  //   if (iconName) { this.value = Icon.textAttribute(iconName); }
  // }

  // FIXME
  // menuItems () {
  //   const items = super.menuItems();
  //   items.unshift({ isDivider: true });
  //   items.unshift(['edit label as rich text', async () => {
  //     const editedAttributes = await $world.editPrompt('rich text', {
  //       input: this.value,
  //       resolveTextAttributes: true
  //     });
  //     if (editedAttributes) this.value = editedAttributes;
  //   }]);
  //   items.unshift(['change label', () => this.interactivelyChangeLabel()]);
  //   items.unshift(['set Icon', () => this.interactivelySetIcon()]);
  //   return items;
  // }
}
