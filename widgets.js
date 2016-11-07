import { obj } from "lively.lang";
import { pt, Color, Rectangle } from "lively.graphics";
import { show, morph, Morph, Text, Label, List, HorizontalLayout } from "./index.js";
import { Icon } from "./icons.js";
import { signal, connect } from "lively.bindings";
import config from "./config.js";

export class Button extends Morph {

  constructor(props) {
    var {label, fontFamily, fontSize, fontColor} = props;
    if (!label) label = "";
    if (label.isMorph) {
      label.name = "label";
    } else {
      label = {
        type: "label", name: "label",
        value: label, fill: Color.white.withA(0),
        padding: Rectangle.inset(0),
      }
    }

    super({
      draggable: false,
      borderRadius: 15,
      extent: pt(100,24),
      borderWidth: 1,
      active: true,
      padding: Rectangle.inset(0),
      submorphs: [label],
      ...obj.dissoc(props, ["label", "fontFamily", "fontSize", "fontColor"])
    });

    this.active = this.active; // style
    this.relayout();

    if (fontFamily !== undefined) this.fontFamily = fontFamily;
    if (fontSize !== undefined) this.fontSize = fontSize;
    if (fontColor !== undefined) this.fontColor = fontColor;

    connect(this, "change", this, "relayout", {updater: ($upd, {prop}) => ["extent", "padding"].includes(prop) && $upd()})
    connect(this.submorphs[0], "change", this, "relayout", {updater: ($upd, {prop}) => ["extent"].includes(prop) && $upd()})
  }

  get isButton() { return true }

  get defaultActiveStyle() {
    return {
      borderColor: Color.gray,
      fill: Color.rgb(240,240,240),
      fontColor: Color.almostBlack,
      nativeCursor: "pointer"
    }
  }
  get activeStyle() { return this.getProperty("activeStyle") || this.defaultActiveStyle; }
  set activeStyle(value) {
    this.addValueChange("activeStyle", {...this.defaultActiveStyle, ...value});
    this.active = this.active; /*update*/
  }

  get defaultInactiveStyle() {
    return {
      borderColor: Color.gray.withA(0.5),
      fill: Color.rgba(240,240,240, 0.5),
      fontColor: Color.almostBlack.withA(0.5),
      nativeCursor: "not-allowed"
    }
  }
  get inactiveStyle() { return this.getProperty("inactiveStyle") || this.defaultInactiveStyle; }
  set inactiveStyle(value) {
    this.addValueChange("inactiveStyle", {...this.defaultInactiveStyle, ...value});
    this.active = this.active; /*update*/
  }

  get defaultTriggerStyle() {
    return {
      fill: Color.rgb(161,161,161)
    }
  }
  get triggerStyle() { return this.getProperty("triggerStyle") || this.defaultTriggerStyle; }
  set triggerStyle(value) {
    this.addValueChange("triggerStyle", {...this.defaultTriggerStyle, ...value});
  }

  relayout() {
    var padding = this.padding,
        label = this.submorphs[0],
        minHeight = label.height + padding.top() + padding.bottom(),
        minWidth = label.width + padding.left() + padding.right();
    if (minHeight > this.height) this.height = minHeight;
    if (minWidth > this.width) this.width = minWidth;
    label.center = this.innerBounds().center();
    return this;
  }

  get label() { return this.get("label").textString; }
  set label(stringOrAttributesOrMorph) {
    if (stringOrAttributesOrMorph.isMorph) {
      this.get("label").remove();
      stringOrAttributesOrMorph.name = "label";
      this.addMorph(stringOrAttributesOrMorph);
    } else {
      this.get("label").value = stringOrAttributesOrMorph;
    }
    this.relayout();
  }

  get labelWithTextAttributes() { return this.get("label").textAndAttributes; }
  set labelWithTextAttributes(textAndAttributes) { this.get("label").textAndAttributes = textAndAttributes; this.relayout(); }

  get fontFamily() { return this.submorphs[0].fontFamily; }
  set fontFamily(fontFamily) { this.submorphs[0].fontFamily = fontFamily; this.relayout(); }
  get fontSize() { return this.submorphs[0].fontSize; }
  set fontSize(fontSize) { this.submorphs[0].fontSize = fontSize; this.relayout(); }
  get fontColor() { return this.submorphs[0].fontColor; }
  set fontColor(color) { this.submorphs[0].fontColor = color; }
  set padding(value) { this.addValueChange("padding", value); this.relayout(); }
  get padding() { return this.getProperty("padding"); }

  get action() { return this.getProperty("action"); }
  set action(value) { this.addValueChange("action", value); }
  get active() { return this.getProperty("active"); }
  set active(value) {
    Object.assign(this, value ? this.activeStyle : this.inactiveStyle);
    this.submorphs[0].nativeCursor = this.nativeCursor;
    this.addValueChange("active", value);
  }

  fit() {
    var padding = this.padding,
        label = this.submorphs[0];
    label.fit();
    this.extent = padding.bottomLeft().addPt(padding.bottomRight()).addPt(label.extent);
    return this.relayout();
  }

  trigger() {
    try {
      signal(this, "fire");
      typeof this.action == "function" && this.action();
    } catch (err) {
      var w = this.world();
      if (w) w.logError(err);
      else console.error(err);
    }
  }

  onMouseDown(evt) {
    if (this.active)
      Object.assign(this, this.triggerStyle);
  }

  onMouseUp(evt) {
    if (evt.isClickTarget(this) && this.active) {
      Object.assign(this, this.activeStyle);
      this.trigger();
    }
  }

  onHoverOut(evt) {
    // When leaving the button without mouse up, reset appearance
    if (this.active && evt.isClickTarget(this))
      Object.assign(this, this.activeStyle);
  }

  onHoverIn(evt) {
    if (this.active && evt.isClickTarget(this))
      Object.assign(this, this.triggerStyle);
  }

}

export class CheckBox extends Morph {

  constructor(props) {
    super({
      draggable: false,
      extent: pt(18, 18),
      borderWidth: 0,
      active: true,
      checked: false,
      ...props,
    });
  }

  get checked() { return this.getProperty("checked"); }
  set checked(value) { this.addValueChange("checked", value); }
  get active() { return this.getProperty("active"); }
  set active(value) { this.addValueChange("active", value); }

  trigger() {
    try {
      this.checked = !this.checked;
      signal(this, "toggle", this.checked);
    } catch (err) {
      var w = this.world();
      if (w) w.logError(err);
      else console.error(err);
    }
  }

  onMouseDown(evt) {
    if (this.active) this.trigger();
  }

  render(renderer) {
    return renderer.renderCheckBox(this);
  }

}

export class TooltipViewer {

  constructor(world) {
    this.currenMorph = world;
  }

  notPartOfCurrentTooltip(newTarget) {
     return !newTarget.ownerChain().includes(this.currentMorph);
  }

  invalidatesCurrentTooltip(newTarget) {
     return newTarget.tooltip || this.notPartOfCurrentTooltip(newTarget);
  }

  mouseMove({targetMorph}) {
    if(this.currentMorph != targetMorph) {
      if (this.invalidatesCurrentTooltip(targetMorph)) {
         this.hoverOutOfMorph(this.currentMorph);
         this.hoverIntoMorph(targetMorph);
         this.currentMorph = targetMorph;
      }
    }
  }

  mouseDown({targetMorph}) {
    this.currentTooltip && this.currentTooltip.remove()
    this.currentTooltip = null;
  }

  hoverIntoMorph(morph) {
    this.clearScheduledTooltip();
    if (this.currentTooltip) {
      this.showTooltipFor(morph);
    } else {
      this.scheduleTooltipFor(morph);
    }
  }

  hoverOutOfMorph(morph) {
    const current = this.currentTooltip;
    this.currentTooltip && this.currentTooltip.softRemove((tooltip) => {
      if (this.currentTooltip == tooltip) {
          this.currentTooltip = null;
      }
    });
  }

  scheduleTooltipFor(morph) {
    this.timer = setTimeout(() => {
        this.showTooltipFor(morph);
      }, config.showTooltipsAfter * 1000);
  }

  clearScheduledTooltip() {
    clearTimeout(this.timer);
  }

  showTooltipFor(morph) {
    if (morph.tooltip) {
      this.currentTooltip && this.currentTooltip.remove();
      this.currentTooltip = new Tooltip({
        position: morph.globalBounds().bottomRight(),
        description: morph.tooltip});
      morph.world().addMorph(this.currentTooltip);
    }
  }

}

class Tooltip extends Morph {

  constructor(props) {
    super({
      ...props,
      styleClasses: ["morph", "tooltip"],
      draggable: false,
      fill: Color.black.withA(.5),
      borderRadius: 4,
      layout: new HorizontalLayout({spacing: 5}),
      submorphs: [new Text({
        width: 200,
        fixedWidth: props.description.length > 40,
        textString: props.description,
        fill: Color.transparent,
        fontColor: Color.white,
      })]
    });
  }

  softRemove(cb) {
    this.animate({opacity: 0, onFinish: () => {
      cb(this);
      this.remove()
    }});
  }

}


class DropDownList extends Button {

  // new DropDownList({selection: 1, items: [1,2,3,4]}).openInWorld()

  constructor(props = {}) {
    super({
      borderRadius: 2,
      ...obj.dissoc(props, ["items", "selection"])
    });
    this.list = new List({items: props.items || [], border: this.border});
    connect(this.list, "selection", this, "selection");
    connect(this, "fire", this, "toggleList");
    if (props.selection) this.selection = props.selection;
  }

  isListVisible() { return this.list.owner === this; }

  get selection() { return this.getProperty("selection"); }
  set selection(value) {
    this.addValueChange("selection", value);
    if (!value) {
      this.list.selection = null;
      this.label = "";
    } else {
      var item = this.list.find(value);
      this.label = item ?
        [[item.string || String(item), {}], [" ", {}], Icon.textAttribute("caret-down")] :
        "selection not found in list";
      this.list.selection = value;
    }
  }

  toggleList() {
    if (this.isListVisible()) { this.list.remove(); return; }
    this.addMorph(this.list);
    this.list.topLeft = this.innerBounds().bottomLeft();
    this.list.extent = pt(this.width, 100);
  }

}
