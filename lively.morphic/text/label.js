import { obj, arr, string, properties } from "lively.lang";
import { Morph, config } from "../index.js";
import { Rectangle, Color } from "lively.graphics";
import { signal } from "lively.bindings";
import { h } from "virtual-dom";

import { defaultStyle, defaultAttributes } from "../rendering/morphic-default.js";
import { Icon, Icons } from "./icons.js";

import { splitTextAndAttributesIntoLines } from "./attributes.js";


export class Label extends Morph {

  static get properties() {
    return {
      fill:             {defaultValue: Color.transparent},
      draggable:        {defaultValue: false},
      nativeCursor:     {defaultValue: "default"},

      isIcon: {
        derived: true,
        get() { 
           return properties.values(Icons).map(({code}) => code).includes(this.textString) 
        }
      },

      value: {
        derived: true, after: ["textAndAttributes", "textString"],
        get() {
          var {textAndAttributes} = this;
          if (textAndAttributes.length <= 2) {
            var [text, style] = textAndAttributes;
            if (!Object.keys(style || {}).length) return text || "";
          }
          return textAndAttributes;
        },
        set(value) {
          typeof value === "string" ?
            this.textString = value :
            this.textAndAttributes = value;
        }
      },

      textString: {
        derived: true, after: ["textAndAttributes"],
        get() { return this.textAndAttributes.map((text, i) => i % 2==0 ? text : "").join(""); },
        set(value) { this.textAndAttributes = [value, null]; }
      },

      textAndAttributes: {
        get() {
          var val = this.getProperty("textAndAttributes");
          if (!val || val.length < 1) val = ["", null];
          return val;
        },

        set(value) {
          if (!Array.isArray(value)) value = [String(value), {}];
          if (value.length === 0) value = ["", {}];
          let prevValue = this.textAndAttributes;
          this.setProperty("textAndAttributes", value);
          if (this.autofit) this.invalidateTextLayout();
          signal(this, "value", value);
        }
      },

      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
      // valueAndAnnotation is a way to put rich text content followed by a right
      // aligned annotation into a label. It simply is using textAndAttributes with
      // the convention that the last string/attribue pair in textAndAttributes is the
      // annotation (the attribute includes the textStyleClass "annotation")

      valueAndAnnotation: {
        derived: true, after: ["textAndAttributes"],

        get() {
          var value = this.textAndAttributes, annotation = null;
          if (value.length > 2)  {
            var [string, props] = value.slice(-2);
            if (props && props.textStyleClasses && props.textStyleClasses.includes("annotation")) {
              value = value.slice(0, -2);
              annotation = [string, props];
            }
          }
          return {value, annotation};
        },

        set(valueAndAnnotation) {
          var {value, annotation} = valueAndAnnotation;

          // Ensure value is in the right format for being the prefix in textAndAttributes
          if (!value) value = "";
          if (typeof value === "string") value = [value, null]
          if (!Array.isArray(value)) value = [String(value), null];

          var textAndAttributes = value.slice();

          // convert and add the annotation
          if (annotation) {
            if (typeof annotation === "string") annotation = [annotation, null];
            var annAttr = annotation[1];
            if (!annAttr) annAttr = annotation[1] = {};
            textAndAttributes.push(...annotation);
            annAttr.textStyleClasses = (annAttr.textStyleClasses || []).concat("annotation");
            if (!annAttr.textStyleClasses.includes("annotation"))
              annAttr.textStyleClasses.push("annotation");
          }

          this.textAndAttributes = textAndAttributes;
        }

      },

      autofit: {
        defaultValue: true,
        set(value) {
          this.setProperty("autofit", value);
          if (value) this._needsFit = true;
        }
      },

      padding: {
        type: "Rectangle",
        isStyleProp: true,
        defaultValue: Rectangle.inset(0),
        initialize(value) { this.padding = value; /*for num -> rect conversion*/},
        set(value) {
          if (!value) value = Rectangle.inset(0);
          let previousPadding = this.padding;
          this.setProperty("padding", typeof value === "number" ? Rectangle.inset(value) : value);
          if (this.autofit && !previousPadding.equals(value)) this.invalidateTextLayout();
        }
      },

      fontFamily: {
        isStyleProp: true,
        type: "Enum",
        values: config.text.basicFontItems,
        defaultValue: "Sans-Serif",
        set(fontFamily) {
          let previousFontFamily = this.fontFamily;
          this.setProperty("fontFamily", fontFamily);
          if (this.autofit && previousFontFamily != fontFamily) this.invalidateTextLayout()
        }
      },

      fontSize: {
        type: "Number",
        min: 1,
        isStyleProp: true,
        defaultValue: 12,
        set(fontSize) {
          let previousFontSize = this.fontSize;
          this.setProperty("fontSize", fontSize);
          if (this.autofit && fontSize != previousFontSize) this.invalidateTextLayout();
        }
      },

      fontColor: {type: "Color", isStyleProp: true, defaultValue: Color.black},

      fontWeight: {
        type: "Enum",
        values: ["bold", "bolder", "light", "lighter"],
        isStyleProp: true,
        defaultValue: "normal",
        set(fontWeight) {
          let previousFontWeight = this.fontWeight;
          this.setProperty("fontWeight", fontWeight);
          if (this.autofit && previousFontWeight != fontWeight) this.invalidateTextLayout();
        }
      },

      fontStyle: {
        type: "Enum",
        values: ["normal", "italic", "oblique"],
        isStyleProp: true,
        defaultValue: "normal",
        set(fontStyle) {
          let previousFontStyle = this.fontStyle;
          this.setProperty("fontStyle", fontStyle);
          if (this.autofit && previousFontStyle != fontStyle) this.invalidateTextLayout();
        }
      },

      textShadow: {type: "String", isStyleProp: true, defaultValue: ""},

      textDecoration: {defaultValue: "none"},

      textStyleClasses: {
        defaultValue: undefined,
        set(textStyleClasses) {
          this.setProperty("textStyleClasses", textStyleClasses);
          if (this.autofit) this.invalidateTextLayout();
        }
      }

    }
  }

  static icon(iconName, props = {prefix: "", suffix: ""}) {
    return Icon.makeLabel(iconName, props);
  }

  constructor(props = {}) {
    var { fontMetric, position, rightCenter, leftCenter, topCenter,
          bottom, top, right, left, bottomCenter, bottomLeft, bottomRight,
          topRight, topLeft, center, extent } = props;
    super(obj.dissoc(props, ["fontMetric"]));
    if (fontMetric)
      this._fontMetric = fontMetric;
    this._cachedTextBounds = null;
    this.fit();
    // Update position + extent after fit
    if (extent !== undefined) this.extent = extent;
    if (position !== undefined) this.position = position;
    if (rightCenter !== undefined) this.rightCenter = rightCenter;
    if (leftCenter !== undefined) this.leftCenter = leftCenter;
    if (topCenter !== undefined) this.topCenter = topCenter;
    if (bottom !== undefined) this.bottom = bottom;
    if (top !== undefined) this.top = top;
    if (right !== undefined) this.right = right;
    if (left !== undefined) this.left = left;
    if (bottomCenter !== undefined) this.bottomCenter = bottomCenter;
    if (bottomLeft !== undefined) this.bottomLeft = bottomLeft;
    if (bottomRight !== undefined) this.bottomRight = bottomRight;
    if (topRight !== undefined) this.topRight = topRight;
    if (topLeft !== undefined) this.topLeft = topLeft;
    if (center !== undefined) this.center = center;
  }

  __additionally_serialize__(snapshot, objRef, pool, addFn) {
    super.__additionally_serialize__(snapshot, objRef, pool, addFn);
    this.fit();
    snapshot._cachedTextBounds = this._cachedTextBounds && this._cachedTextBounds.toTuple();
  }

  __after_deserialize__(snapshot, objRef) {
    super.__after_deserialize__(snapshot, objRef);
    if (snapshot._cachedTextBounds) {
      // change meta data to indicate that morph is being reconstructed      
      this.changeMetaData('deserializeInfo', {recoveredTextBounds: true});
      this._cachedTextBounds =  Rectangle.fromTuple(snapshot._cachedTextBounds);
    }
  }

  get isLabel() { return true }

  get textStyle() {
    return obj.select(this, [
      "textStyleClasses",
      "textDecoration",
      "fontStyle",
      "fontWeight",
      "textShadow",
      "fontColor",
      "fontSize",
      "fontFamily"
    ]);
  }

  fit() {
    this.extent = this.textBounds().extent();
    this._needsFit = false;
    return this;
  }

  fitIfNeeded() {
    if (this._needsFit) { this.fit(); }
  }

  get textAndAttributesOfLines() {
    return splitTextAndAttributesIntoLines(this.textAndAttributes, "\n");
  }

  textBoundsSingleChunk() {
    // text bounds not considering "chunks", i.e. only default text style is
    // used
    var fm = this._fontMetric || this.env.fontMetric,
        [text, chunkStyle] = this.textAndAttributes,
        style = {...this.textStyle, ...chunkStyle},
        padding = this.padding,
        width, height;
    if (!fm.isProportional(style.fontFamily)) {
      var {width: charWidth, height: charHeight} = fm.sizeFor(style, "x");
      width = text.length * charWidth;
      height = charHeight;
    } else {
      ({width, height} = fm.sizeFor(style, text));
    }
    return new Rectangle(0,0,
      Math.ceil(padding.left() + padding.right() + width),
      Math.ceil(padding.top() + padding.bottom() + height));
  }

  textBoundsAllChunks() {
    var fm = this._fontMetric || this.env.fontMetric,
        padding = this.padding,
        defaultStyle = this.textStyle,
        lines = this.textAndAttributesOfLines,
        defaultIsMonospaced = !fm.isProportional(defaultStyle.fontFamily),
        {height: defaultHeight} = fm.sizeFor(defaultStyle, "x"),
        height = 0, width = 0;

    for (var i = 0; i < lines.length; i++) {
      var textAndAttributes = lines[i];

      // empty line
      if (!textAndAttributes.length) { height += defaultHeight; continue; }

      var lineHeight = 0, lineWidth = 0;

      for (var j = 0; j < textAndAttributes.length; j = j+2) {
        var text = textAndAttributes[j],
            style = textAndAttributes[j+1] || {},
            mergedStyle = {...defaultStyle, ...style},
            isMonospaced = (defaultIsMonospaced && !style.fontFamily)
                        || !fm.isProportional(mergedStyle.fontFamily);

        if (isMonospaced) {
          var fontId = mergedStyle.fontFamily + "-" + mergedStyle.fontSize,
              {width: charWidth, height: charHeight} = fm.sizeFor(mergedStyle, "x");
          lineWidth += text.length*charWidth;
          lineHeight = Math.max(lineHeight, charHeight);

        } else {
          var {width: textWidth, height: textHeight} = fm.sizeFor(mergedStyle, text);
          lineWidth += textWidth
          lineHeight = Math.max(lineHeight, textHeight);
        }
      }

      height += lineHeight;
      width = Math.max(width, lineWidth);
    }

    return new Rectangle(0,0,
      Math.ceil(padding.left() + padding.right() + width),
      Math.ceil(padding.top() + padding.bottom() + height));
  }

  invalidateTextLayout() {
    this._cachedTextBounds = null;
    if (this.autofit) this._needsFit = true;
    this.makeDirty();
  }

  textBounds() {
    // this.env.fontMetric.sizeFor(style, string)
    var {textAndAttributes, _cachedTextBounds} = this;
    return _cachedTextBounds ? _cachedTextBounds :
      this._cachedTextBounds = textAndAttributes.length <= 2 ?
        this.textBoundsSingleChunk() : this.textBoundsAllChunks();
  }

  forceRerender() {
    this._cachedTextBounds = null;
    this.makeDirty();
  }

  applyLayoutIfNeeded() {
    this.fitIfNeeded();
    super.applyLayoutIfNeeded();
  }

  render(renderer) {

    var renderedText = [],
        nLines = this.textAndAttributesOfLines.length;

    for (var i = 0; i < nLines; i++) {
      var line = this.textAndAttributesOfLines[i];
      for (var j = 0; j < line.length; j = j+2) {
        var text = line[j],
            style = line[j+1];
        renderedText.push(this.renderChunk(text, style));
      }
      if (i < nLines-1) renderedText.push(h("br"));
    }

    var {
          fontColor,
          fontFamily,
          fontSize,
          fontStyle,
          fontWeight,
          textShadow,
          textDecoration,
          textStyleClasses,
        } = this.textStyle,
        padding = this.padding,
        style = {
          fontFamily,
          fontSize: typeof fontSize === "number" ? fontSize + "px" : fontSize,
          color: fontColor ? String(fontColor) : "transparent",
          position: "absolute",
          cursor: this.nativeCursor
        },
        attrs = defaultAttributes(this, renderer);

    if (textShadow) style.textShadow = textShadow;
    if (fontWeight !== "normal") style.fontWeight = fontWeight;
    if (fontStyle !== "normal") style.fontStyle = fontStyle;
    if (textDecoration !== "none") style.textDecoration = textDecoration;
    if (textStyleClasses && textStyleClasses.length)
      attrs.className = (attrs.className || "") + " " + textStyleClasses.join(" ");
    attrs.style = {...defaultStyle(this), ...style};

    return h("div", attrs, [
      h('div', {
        style: {
          position: 'absolute',
          paddingLeft: padding.left() + "px",
          paddingRight: padding.right() + "px",
          paddingTop: padding.top() + "px",
          paddingBottom: padding.bottom() + "px",
          width: `calc(100% - ${padding.left()}px - ${padding.right()}px)`
        }
      }, renderedText), renderer.renderSubmorphs(this)]);
  }

  renderChunk(text, chunkStyle) {
    chunkStyle = chunkStyle || {};
    var {
          backgroundColor,
          fontColor,
          fontFamily,
          fontStyle,
          fontWeight,
          textShadow,
          textDecoration,
          textStyleClasses,
          textAlign,
          float,
          display,
          lineHeight
        } = chunkStyle,
        style = {},
        attrs = {style};
    if (float) style.float = float;
    if (display) style.display = display;
    if (backgroundColor) style.backgroundColor = String(backgroundColor);
    if (fontFamily) style.fontFamily = fontFamily;
    if (fontColor) style.color = String(fontColor);
    if (textShadow) style.textShadow = textShadow;
    if (fontWeight !== "normal") style.fontWeight = fontWeight;
    if (fontStyle !== "normal") style.fontStyle = fontStyle;
    if (textDecoration !== "none") style.textDecoration = textDecoration;
    if (textAlign) style.textAlign = textAlign;
    if (lineHeight) style.lineHeight = lineHeight;
    if (textStyleClasses && textStyleClasses.length)
      attrs.className = textStyleClasses.join(" ");

    var lengthAttrs = ["fontSize", "width", "height", "maxWidth", "maxHeight", "top", "left", "padding", "paddingLeft", "paddingRight", "paddingBottom", "paddingTop", "marginTop", "marginRight", "marginLeft", "marginBottom"];
    for (var i = 0; i < lengthAttrs.length; i++) {
      var name = lengthAttrs[i];
      if (!chunkStyle.hasOwnProperty(name)) continue;
			var value = chunkStyle[name];
      style[name] = typeof value === "number" ? value + "px" : value;
    }

    return h("span", attrs, text);
  }
  
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // events
  
  async interactivelyChangeLabel() {
    let newLabel = await this.world().prompt("edit label", {
      input: this.textString,
      historyId: "lively.morphic-label-edit-hist"
    });
    if (typeof newLabel === "string")
      this.textString = newLabel;
  }
  
  menuItems() {
    let items = super.menuItems();
    items.unshift({isDivider: true});
    items.unshift(["change label", () => this.interactivelyChangeLabel()]);
    return items;
  }

}
