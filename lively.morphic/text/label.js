import { obj, promise, string, properties } from 'lively.lang';
import { Rectangle, Color } from 'lively.graphics';
import { signal } from 'lively.bindings';
import vdom from 'virtual-dom';

import { Morph } from '../morph.js';
import config from '../config.js';
import { defaultStyle, defaultAttributes } from '../rendering/morphic-default.js';
import { Icon, Icons } from './icons.js';

import { splitTextAndAttributesIntoLines } from './attributes.js';
import { Text } from './morph.js';

const { h } = vdom;

export class Label extends Text {
  static get properties() {
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
        set (value) { this.textAndAttributes = [value, null]; }
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
      // // labelMode: {
      // //   defaultValue: true,
      //   // }
    };
  }

  static icon (iconName, props = { prefix: '', suffix: '' }) {
    return Icon.makeLabel(iconName, props);
  }

  // onChange (change) {
  //   super.onChange(change);
  //   if (change.prop && change.prop.includes('borderWidth')) {
  //     this.fit();
  //   }
  // }

  // constructor (props = {}) {
  //   const {
  //     fontMetric, position, rightCenter, leftCenter, topCenter,
  //     bottom, top, right, left, bottomCenter, bottomLeft, bottomRight,
  //     topRight, topLeft, center, extent
  //   } = props;
  //   super(obj.dissoc(props, ['fontMetric']));
  //   if (fontMetric) { this._fontMetric = fontMetric; }
  //   this._cachedTextBounds = null;
  //   this.fit();
  //   // Update position + extent after fit
  //   if (extent !== undefined) this.extent = extent;
  //   if (position !== undefined) this.position = position;
  //   if (rightCenter !== undefined) this.rightCenter = rightCenter;
  //   if (leftCenter !== undefined) this.leftCenter = leftCenter;
  //   if (topCenter !== undefined) this.topCenter = topCenter;
  //   if (bottom !== undefined) this.bottom = bottom;
  //   if (top !== undefined) this.top = top;
  //   if (right !== undefined) this.right = right;
  //   if (left !== undefined) this.left = left;
  //   if (bottomCenter !== undefined) this.bottomCenter = bottomCenter;
  //   if (bottomLeft !== undefined) this.bottomLeft = bottomLeft;
  //   if (bottomRight !== undefined) this.bottomRight = bottomRight;
  //   if (topRight !== undefined) this.topRight = topRight;
  //   if (topLeft !== undefined) this.topLeft = topLeft;
  //   if (center !== undefined) this.center = center;
  // }

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

  // get isLabel () { return true; }

  // get textStyle () {
  //   return obj.select(this, [
  //     'textStyleClasses',
  //     'textDecoration',
  //     'fontStyle',
  //     'fontWeight',
  //     'textShadow',
  //     'fontColor',
  //     'fontSize',
  //     'fontFamily'
  //   ]);
  // }

  // fit () {
  //   this.withMetaDo({ skipReconciliation: true }, () => {
  //     this.extent = this.textBounds().extent().addXY(
  //       this.borderWidthLeft + this.borderWidthRight,
  //       this.borderWidthTop + this.borderWidthBottom
  //     );
  //   });
  //   if (!this.visible) {
  //     this._cachedTextBounds = null;
  //   } else this._needsFit = false;
  //   return this;
  // }

  // fitIfNeeded () {
  //   if (!this._needsFit) return;
  //   if (this.allFontsLoaded()) {
  //     this.fit();
  //     return;
  //   }
  //   return this.whenFontLoaded().then(() => this.fit());
  // }

  // get textAndAttributesOfLines () {
  //   return splitTextAndAttributesIntoLines(this.textAndAttributes, '\n');
  // }

  // allFontsLoaded (fontFaceSet) {
  //   const { fontMetric } = this.env;
  //   return [
  //     this,
  //     ...this.textAndAttributes.map((attr, i) => {
  //       if (i % 2) {
  //         return {
  //           fontFamily: (attr && attr.fontFamily) || this.fontFamily,
  //           fontWeight: (attr && attr.fontWeight) || this.fontWeight
  //         };
  //       }
  //     }).filter(Boolean)
  //   ].every(attr => {
  //     if (fontFaceSet) {
  //       const face = fontFaceSet.find(face =>
  //         face.family == attr.fontFamily &&
  //         face.weight == (fontMetric.fontDetector.namedToNumeric[attr.fontWeight] || attr.fontWeight));
  //       return !!face;
  //       // document.fonts.check(`normal ${attr.fontWeight} 12px ${attr.fontFamily}`)
  //     } else return fontMetric.isFontSupported(attr.fontFamily, attr.fontWeight);
  //   });
  // }

  // async whenFontLoaded () {
  //   // fixme: remove busy wait, since it kills performance
  //   if (this.allFontsLoaded()) return true;
  //   const fonts = [...(await document.fonts.ready)];
  //   if (this.allFontsLoaded(fonts.filter(face => face.status == 'loaded'))) return true;
  //   // as a last resort, do a busy wait...
  //   return promise.waitFor(5000, () => {
  //     return this.allFontsLoaded();
  //   });
  // }

  // textBoundsSingleChunk () {
  //   // text bounds not considering "chunks", i.e. only default text style is
  //   // used
  //   const fm = this._fontMetric || this.env.fontMetric;
  //   const [text, chunkStyle] = this.textAndAttributes;
  //   const style = { ...this.textStyle, ...chunkStyle };
  //   const padding = this.padding;
  //   let width; let height;
  //   if (!fm.isProportional(style.fontFamily)) {
  //     const { width: charWidth, height: charHeight } = fm.sizeFor(style, 'x');
  //     width = text.length * charWidth;
  //     height = charHeight;
  //   } else {
  //     ({ width, height } = fm.sizeFor(style, text));
  //   }
  //   return new Rectangle(0, 0,
  //     Math.ceil(padding.left() + padding.right() + width),
  //     Math.ceil(padding.top() + padding.bottom() + height));
  // }

  // textBoundsAllChunks () {
  //   const fm = this._fontMetric || this.env.fontMetric;
  //   const padding = this.padding;
  //   const defaultStyle = this.textStyle;
  //   const lines = this.textAndAttributesOfLines;
  //   const defaultIsMonospaced = !fm.isProportional(defaultStyle.fontFamily);
  //   const { height: defaultHeight } = fm.sizeFor(defaultStyle, 'x');
  //   let height = 0; let width = 0;

  //   for (let i = 0; i < lines.length; i++) {
  //     const textAndAttributes = lines[i];

  //     // empty line
  //     if (!textAndAttributes.length) { height += defaultHeight; continue; }

  //     let lineHeight = 0; let lineWidth = 0;

  //     for (let j = 0; j < textAndAttributes.length; j = j + 2) {
  //       const text = textAndAttributes[j];
  //       const style = textAndAttributes[j + 1] || {};
  //       const mergedStyle = { ...defaultStyle, ...style };
  //       const isMonospaced = (defaultIsMonospaced && !style.fontFamily) ||
  //                       !fm.isProportional(mergedStyle.fontFamily);

  //       if (isMonospaced) {
  //         const fontId = mergedStyle.fontFamily + '-' + mergedStyle.fontSize;
  //         const { width: charWidth, height: charHeight } = fm.sizeFor(mergedStyle, 'x');
  //         lineWidth += text.length * charWidth;
  //         lineHeight = Math.max(lineHeight, charHeight);
  //       } else {
  //         const { width: textWidth, height: textHeight } = fm.sizeFor(mergedStyle, text);
  //         lineWidth += textWidth;
  //         if (mergedStyle.paddingRight) lineWidth += Number.parseInt(mergedStyle.paddingRight);
  //         if (mergedStyle.paddingLeft) lineWidth += Number.parseInt(mergedStyle.paddingLeft);
  //         lineHeight = Math.max(lineHeight, textHeight);
  //       }
  //     }

  //     height += lineHeight;
  //     width = Math.max(width, lineWidth);
  //   }

  //   return new Rectangle(0, 0,
  //     Math.ceil(padding.left() + padding.right() + width),
  //     Math.ceil(padding.top() + padding.bottom() + height));
  // }

  // invalidateTextLayout () {
  //   this._cachedTextBounds = null;
  //   if (this.autofit) this._needsFit = true;
  //   this.makeDirty();
  // }

  // textBounds () {
  //   // this.env.fontMetric.sizeFor(style, string)
  //   const { textAndAttributes, _cachedTextBounds } = this;
  //   return _cachedTextBounds || (this._cachedTextBounds = textAndAttributes.length <= 2
  //     ? this.textBoundsSingleChunk()
  //     : this.textBoundsAllChunks());
  // }

  // forceRerender () {
  //   this._cachedTextBounds = null;
  //   this.makeDirty();
  // }

  // applyLayoutIfNeeded () {
  //   this.fitIfNeeded();
  //   super.applyLayoutIfNeeded();
  // }

  // render (renderer) {
  //   if (this._requestMasterStyling) {
  //     this.master && this.master.applyIfNeeded(true);
  //     this._requestMasterStyling = false;
  //   }
  //   const renderedText = [];
  //   const nLines = this.textAndAttributesOfLines.length;

  //   for (let i = 0; i < nLines; i++) {
  //     const line = this.textAndAttributesOfLines[i];
  //     for (let j = 0; j < line.length; j = j + 2) {
  //       const text = line[j];
  //       var style = line[j + 1];
  //       renderedText.push(this.renderChunk(text, style));
  //     }
  //     if (i < nLines - 1) renderedText.push(h('br'));
  //   }

  //   let {
  //     fontColor,
  //     fontFamily,
  //     fontSize,
  //     fontStyle,
  //     fontWeight,
  //     textShadow,
  //     textDecoration,
  //     textStyleClasses
  //   } = this.textStyle;
  //   let padding = this.padding;
  //   var style = {
  //     fontFamily,
  //     fontSize: typeof fontSize === 'number' ? fontSize + 'px' : fontSize,
  //     color: fontColor ? String(fontColor) : 'transparent',
  //     cursor: this.nativeCursor
  //   };
  //   let attrs = defaultAttributes(this, renderer);

  //   if (textShadow) style.textShadow = textShadow;
  //   if (fontWeight !== 'normal') style.fontWeight = fontWeight;
  //   if (fontStyle !== 'normal') style.fontStyle = fontStyle;
  //   if (textDecoration !== 'none') style.textDecoration = textDecoration;
  //   if (textStyleClasses && textStyleClasses.length) {
  //     attrs.className = (attrs.className || '') + ' ' + textStyleClasses.join(' ');
  //   }
  //   attrs.style = { ...defaultStyle(this), ...style };

  //   return h('div', attrs, [
  //     h('div', {
  //       style: {
  //         pointerEvents: 'none',
  //         // position: 'absolute',
  //         paddingLeft: padding.left() + 'px',
  //         paddingRight: padding.right() + 'px',
  //         paddingTop: padding.top() + 'px',
  //         paddingBottom: padding.bottom() + 'px',
  //         width: `calc(100% - ${padding.left()}px - ${padding.right()}px)`
  //       }
  //     }, renderedText), renderer.renderSubmorphs(this)]);
  // }

  // renderChunk (text, chunkStyle) {
  //   chunkStyle = chunkStyle || {};
  //   const {
  //     backgroundColor,
  //     fontColor,
  //     fontFamily,
  //     fontStyle,
  //     fontWeight,
  //     textShadow,
  //     textDecoration,
  //     textStyleClasses,
  //     textAlign,
  //     float,
  //     display,
  //     lineHeight,
  //     opacity
  //   } = chunkStyle;
  //   const style = {};
  //   const attrs = { style };
  //   if (float) style.float = float;
  //   if (display) style.display = display;
  //   if (backgroundColor) style.backgroundColor = String(backgroundColor);
  //   if (fontFamily) style.fontFamily = fontFamily;
  //   if (fontColor) style.color = String(fontColor);
  //   if (textShadow) style.textShadow = textShadow;
  //   if (fontWeight !== 'normal') style.fontWeight = fontWeight;
  //   if (fontStyle !== 'normal') style.fontStyle = fontStyle;
  //   if (textDecoration !== 'none') style.textDecoration = textDecoration;
  //   if (textAlign) style.textAlign = textAlign;
  //   if (lineHeight) style.lineHeight = lineHeight;
  //   if (opacity) style.opacity = opacity;
  //   if (textStyleClasses && textStyleClasses.length) { attrs.className = textStyleClasses.join(' '); }

  //   const lengthAttrs = ['fontSize', 'width', 'height', 'maxWidth', 'maxHeight', 'top', 'left', 'padding', 'paddingLeft', 'paddingRight', 'paddingBottom', 'paddingTop', 'marginTop', 'marginRight', 'marginLeft', 'marginBottom'];
  //   for (let i = 0; i < lengthAttrs.length; i++) {
  //     const name = lengthAttrs[i];
  //     if (!chunkStyle.hasOwnProperty(name)) continue;
  //     const value = chunkStyle[name];
  //     style[name] = typeof value === 'number' ? value + 'px' : value;
  //   }

  //   return h('span', attrs, text);
  // }

  // // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // // events

  // async interactivelyChangeLabel () {
  //   const newLabel = await this.world().prompt('edit label', {
  //     input: this.textString,
  //     historyId: 'lively.morphic-label-edit-hist',
  //     selectInput: true
  //   });
  //   if (typeof newLabel === 'string') { this.textString = newLabel; }
  // }

  // async interactivelySetIcon () {
  //   const res = await this.world().filterableListPrompt('Select Icon', Object.keys(Icons).map(iconName => {
  //     return { isListItem: true, label: [...Icon.textAttribute(iconName, { paddingRight: '10px' }), iconName, {}], value: iconName };
  //   }));
  //   const [iconName] = res.selected;
  //   if (iconName) { this.value = Icon.textAttribute(iconName); }
  // }

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
