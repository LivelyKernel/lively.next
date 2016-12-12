import { obj, arr, string } from "lively.lang";
import { rect, Rectangle, Color, pt } from "lively.graphics";
import { Morph, morph, show } from "../index.js";
import { defaultStyle, defaultAttributes } from "../rendering/morphic-default.js";
import { h } from "virtual-dom";
import { Icon } from "../icons.js";


export class Label extends Morph {

  static icon(iconName, props = {prefix: "", suffix: ""}) {
    return Icon.makeLabel(iconName, props);
  }

  constructor(props = {}) {
    var { fontMetric, position, rightCenter, leftCenter, topCenter,
          bottom, top, right, left, bottomCenter, bottomLeft, bottomRight,
          topRight, topLeft, center } = props;
    super(obj.dissoc(props, ["fontMetric"]));
    if (fontMetric)
      this._fontMetric = fontMetric;
    this.fit();
    // Update position after fit
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

  get defaultTextStyle() {
    return {
      fontFamily: "Sans-Serif",
      fontSize: 12,
      fontColor: Color.black,
      fontWeight: "normal",
      fontStyle: "normal",
      textDecoration: "none",
      textStyleClasses: undefined,
    }
  }

  get defaultProperties() {
    return {
      ...super.defaultProperties,
      fill: null,
      draggable: false,
      padding: Rectangle.inset(0),
      nativeCursor: "default",
      autofit: true,
      ...this.defaultTextStyle,
      savedMarks: [],
    };
  }

  get isLabel() { return true }

  get value() {
    var {textAndAttributes} = this;
    if (textAndAttributes.length === 1) {
      var [text, style] = textAndAttributes[0];
      if (!Object.keys(style || {}).length) return text;
    }
    return textAndAttributes;
  }
  set value(value) {
    typeof value === "string" ?
      this.textString = value :
      this.textAndAttributes = value;
  }

  get textString() { return this.textAndAttributes.map(([text]) => text).join(""); }
  set textString(value) { this.textAndAttributes = [[value, {}]]; }

  get textAndAttributes() {
    var val = this.getProperty("textAndAttributes");
    if (!val || val.length < 1) val = [[""]];
    return val;
  }

  set textAndAttributes(value) {
    if (!Array.isArray(value)) value = [[String(value), {}]];
    if (value.length === 0) value = [["", {}]];
    this._cachedTextBounds = null;
    this.addValueChange("textAndAttributes", value);
    if (this.autofit) this._needsFit = true;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // valueAndAnnotation is a way to put rich text content followed by a right
  // aligned annotation into a label. It simply is using textAndAttributes with
  // the convention that the last string/attribue pair in textAndAttributes is the
  // annotation (the attribute includes the textStyleClass "annotation")

  get valueAndAnnotation() {
    var value = this.textAndAttributes, annotation = null;
    if (value.length > 1)  {
      var [string, props] = arr.last(value);
      if (props && props.textStyleClasses && props.textStyleClasses.includes("annotation")) {
        value = value.slice(0, -1);
        annotation = [string, props];
      }
    }
    return {value, annotation};
  }

  set valueAndAnnotation(valueAndAnnotation) {
    var {value, annotation} = valueAndAnnotation;
    
    // Ensure value is in the right format for being the prefix in textAndAttributes
    if (!value) value = "";
    if (typeof value === "string") value = [[value, {}]]
    if (!Array.isArray(value)) value = String(value);
    else if (value.length === 2 && typeof value[0] === "string") value = [value]

    var textAndAttributes = value.slice();

    // convert and add the annotation
    if (annotation) {
      if (typeof annotation === "string") annotation = [annotation, {}];
      textAndAttributes.push(annotation);
      var annAttr = annotation[1];
      if (!annAttr) annAttr = annotation[1] = {};
      annAttr.textStyleClasses = (annAttr.textStyleClasses || []).concat("annotation");
      if (!annAttr.textStyleClasses.includes("annotation"))
        annAttr.textStyleClasses.push("annotation");
    }

    this.textAndAttributes = textAndAttributes;
  }

  get autofit() { return this.getProperty("autofit") }
  set autofit(value) {
    this.addValueChange("autofit", value);
    if (value) this._needsFit = true;
  }

  get padding() { return this.getProperty("padding"); }
  set padding(value) {
    this._cachedTextBounds = null;
    this.addValueChange("padding", typeof value === "number" ? Rectangle.inset(value) : value);
    if (this.autofit) this._needsFit = true;
  }

  get fontFamily() { return this.getProperty("fontFamily"); }
  set fontFamily(fontFamily) {
    this._cachedTextBounds = null;
    this.addValueChange("fontFamily", fontFamily);
    if (this.autofit) this._needsFit = true;
  }

  get fontSize() { return this.getProperty("fontSize"); }
  set fontSize(fontSize) {
    this._cachedTextBounds = null;
    this.addValueChange("fontSize", fontSize);
    if (this.autofit) this._needsFit = true;
  }

  get fontColor() { return this.getProperty("fontColor"); }
  set fontColor(fontColor) {
    this.addValueChange("fontColor", fontColor);
  }

  get fontWeight() { return this.getProperty("fontWeight"); }
  set fontWeight(fontWeight) {
    this._cachedTextBounds = null;
    this.addValueChange("fontWeight", fontWeight);
    if (this.autofit) this._needsFit = true;
  }

  get fontStyle() { return this.getProperty("fontStyle"); }
  set fontStyle(fontStyle) {
    this._cachedTextBounds = null;
    this.addValueChange("fontStyle", fontStyle);
    if (this.autofit) this._needsFit = true;
  }

  get textDecoration() { return this.getProperty("textDecoration"); }
  set textDecoration(textDecoration) {
    this.addValueChange("textDecoration", textDecoration);
  }

  get textStyleClasses() { return this.getProperty("textStyleClasses"); }
  set textStyleClasses(textStyleClasses) {
    this._cachedTextBounds = null;
    this.addValueChange("textStyleClasses", textStyleClasses);
    if (this.autofit) this._needsFit = true;
  }

  get textStyle() {
    return obj.select(this, [
      "textStyleClasses",
      "textDecoration",
      "fontStyle",
      "fontWeight",
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

  get textAndAttributesOfLines() {
    var lines = [[]],
        {textAndAttributes} = this;
    for (var i = 0; i < textAndAttributes.length; i++) {
      var [text, style] = textAndAttributes[i],
          style = style || {},
          textLines = string.lines(text);
      if (textLines[0].length)
        arr.last(lines).push([textLines[0], style])
      for (var j = 1; j < textLines.length; j++)
        lines.push(textLines[j].length ? [[textLines[j], style]] : []);
    }
    return lines
  }

  textBoundsSingleChunk() {
    // text bounds not considering "chunks", i.e. only default text style is
    // used
    var fm = this._fontMetric || this.env.fontMetric,
        [[text, chunkStyle]] = this.textAndAttributes,
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
      padding.left() + padding.right() + width,
      padding.top() + padding.bottom() + height);
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

      for (var j = 0; j < textAndAttributes.length; j++) {
        var [text, style] = textAndAttributes[j],
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
      padding.left() + padding.right() + width,
      padding.top() + padding.bottom() + height);
  }

  textBounds() {
    // this.env.fontMetric.sizeFor(style, string)
    var {textAndAttributes, _cachedTextBounds} = this;
    return _cachedTextBounds ? _cachedTextBounds :
      this._cachedTextBounds = textAndAttributes.length <= 1 ?
        this.textBoundsSingleChunk() : this.textBoundsAllChunks();
  }

  forceRerender() {
    this._cachedTextBounds = null;
    this.makeDirty();
  }

  render(renderer) {
    if (this._needsFit) this.fit();

    var renderedText = [],
        nLines = this.textAndAttributesOfLines.length;

    for (var i = 0; i < nLines; i++) {
      var line = this.textAndAttributesOfLines[i];
      for (var j = 0; j < line.length; j++) {
        var [text, style] = line[j];
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
          textDecoration,
          textStyleClasses,
        } = this.textStyle,
        padding = this.padding,
        style = {
          fontFamily,
          fontSize: typeof fontSize === "number" ? fontSize + "px" : fontSize,
          color: fontColor ? String(fontColor) : "transparent",
          position: "absolute",
          paddingLeft: padding.left() + "px",
          paddingRight: padding.right() + "px",
          paddingTop: padding.top() + "px",
          paddingBottom: padding.bottom() + "px",
          cursor: this.nativeCursor
        },
        attrs = defaultAttributes(this, renderer);

    if (fontWeight !== "normal") style.fontWeight = fontWeight;
    if (fontStyle !== "normal") style.fontStyle = fontStyle;
    if (textDecoration !== "none") style.textDecoration = textDecoration;
    if (textStyleClasses && textStyleClasses.length)
      attrs.className = (attrs.className || "") + " " + textStyleClasses.join(" ");
    attrs.style = {...defaultStyle(this), ...style};

    return h("div", attrs,
      renderedText.concat(renderer.renderSubmorphs(this)));
  }

  renderChunk(text, chunkStyle) {
    var {
          backgroundColor,
          fontColor,
          fontFamily,
          fontStyle,
          fontWeight,
          textDecoration,
          textStyleClasses,
          textAlign
        } = chunkStyle || {},
        style = {},
        attrs = {style};
    if (backgroundColor) style.backgroundColor = String(backgroundColor);
    if (fontFamily) style.fontFamily = fontFamily;
    if (fontColor) style.fontColor = String(fontColor);
    if (fontWeight !== "normal") style.fontWeight = fontWeight;
    if (fontStyle !== "normal") style.fontStyle = fontStyle;
    if (textDecoration !== "none") style.textDecoration = textDecoration;
    if (textAlign) style.textAlign = textAlign;
    if (textStyleClasses && textStyleClasses.length)
      attrs.className = textStyleClasses.join(" ");

    var lengthAttrs = ["fontSize", "width", "height", "maxWidth", "maxHeight", "top", "left", "padding", "paddingLeft", "paddingRight", "paddingBottom", "paddingTop"];
    for (var i = 0; i < lengthAttrs.length; i++) {
      var name = lengthAttrs[i];
      if (!chunkStyle.hasOwnProperty(name)) continue;
      var value = chunkStyle[name]
      style[name] = typeof value === "number" ? value + "px" : value;
    }

    return h("span", attrs, text);
  }
}
