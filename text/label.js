import { obj } from "lively.lang";
import { rect, Rectangle, Color, pt } from "lively.graphics";
import { Morph, show } from "../index.js";
import { defaultStyle, defaultAttributes } from "../rendering/morphic-default.js";
import { h } from "virtual-dom";

const defaultTextStyle = {
  fontFamily: "Sans-Serif",
  fontSize: 12,
  fontColor: Color.black,
  fontWeight: "normal",
  fontStyle: "normal",
  textDecoration: "none",
  textStyleClasses: undefined,
}


export class Label extends Morph {

  constructor(props = {}) {
    var { fontMetric } = props;
    super({
      draggable: false,
      padding: 0,
      nativeCursor: "default",
      autofit: true,
      ...defaultTextStyle,
      ...obj.dissoc(props, ["fontMetric"])
    });
    if (fontMetric)
      this._fontMetric = fontMetric;
  }

  get isLabel() { return true }

  get textString() { return this.getProperty("textString") }
  set textString(value) {
    this._cachedTextBounds = null;
    this.addValueChange("textString", value);
    if (this.autofit) this._needsFit = true;
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
  }

  textBounds() {
    // this.env.fontMetric.sizeFor(style, string)
    if (this._cachedTextBounds) return this._cachedTextBounds;
    var fm = this._fontMetric || this.env.fontMetric,
        padding = this.padding,
        width, height;
    if (!fm.isProportional(this.fontFamily)) {
      var {width: charWidth, height: charHeight} = fm.sizeFor(this.textStyle, "x");
      width = this.textString.length * charWidth;
      height = charHeight;
    } else {
      ({width, height} = fm.sizeFor(this.textStyle, this.textString));
    }
    return this._cachedTextBounds = new Rectangle(0,0,
      padding.left() + padding.right() + width,
      padding.top() + padding.bottom() + height);
  }

  render(renderer) {
    if (this._needsFit) this.fit();

    var {
      fontColor,
      fontFamily,
      fontSize,
      fontStyle,
      fontWeight,
      textDecoration,
      textStyleClasses,
    } = this.textStyle;

    var padding = this.padding;

    var style = {
      fontFamily,
      fontSize: typeof fontSize === "number" ? fontSize + "px" : fontSize,
      color: fontColor ? String(fontColor) : "transparent",
      position: "absolute",
      paddingLeft: padding.left() + "px",
      paddingRight: padding.right() + "px",
      paddingTop: padding.top() + "px",
      paddingBottom: padding.bottom() + "px",
      cursor: this.nativeCursor,
      whiteSpace: "pre"
    }
    if (fontWeight !== "normal") style.fontWeight = fontWeight;
    if (fontStyle !== "normal") style.fontStyle = fontStyle;
    if (textDecoration !== "none") style.textDecoration = textDecoration;
    
    var attrs = {style}
    if (textStyleClasses && textStyleClasses.length)
      attrs.className = textStyleClasses.join(" ");
  
    var renderedText = h("span", attrs, this.textString);

    return h("div", {
      ...defaultAttributes(this, renderer),
      style: defaultStyle(this)
    },
    // renderer.renderSubmorphs(this)
    // [renderer.renderSubmorphs(this)].concat(renderedText)
    [renderedText].concat(renderer.renderSubmorphs(this))
    )
  }
}
