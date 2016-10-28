import { arr, num, obj } from "lively.lang";
import { pt, Color, Rectangle } from "lively.graphics";
import { show, morph, Morph, Ellipse, Text, HorizontalLayout } from "./index.js";
import { signal, connect } from "lively.bindings";
import config from "./config.js";

export class Window extends Morph {

  constructor(props = {}) {
    super({
      fill: Color.lightGray,
      borderRadius: 7,
      dropShadow: true,
      borderColor: Color.gray,
      borderWidth: 1,
      clipMode: "hidden",
      resizable: true,
      ...obj.dissoc(props, ["title", "targetMorph"]),
      submorphs: [{fill: Color.transparent, name: "wrapper", 
                   onDrag: (evt) => {this.onDrag(evt)}}]
    });
    const wrapper = this.getSubmorphNamed("wrapper");
    wrapper.setBounds(this.innerBounds().withTopLeft(pt(0,25)));
    wrapper.submorphs = (props.submorphs || []).concat(this.controls());
    if (props.targetMorph) this.targetMorph = props.targetMorph;
    this.title = props.title || this.name || "";
    this.resetPropertyCache();
    connect(this, "extent", this, "relayout");
    connect(this.titleLabel(), "extent", this, "relayout");
  }

  get isWindow() { return true }

  resetPropertyCache() {
    // For remembering the position and extents of the window states
    this.propertyCache = {nonMinizedBounds: null, nonMaximizedBounds: null, minimizedBounds: null};
  }

  relayout() {
    var bounds = this.innerBounds();
    this.titleLabel().center = pt(Math.max(bounds.extent().x / 2, 100), 10);
    this.resizer().bottomRight = bounds.bottomRight();
    var t = this.targetMorph;
    t && t.setBounds(bounds.withTopLeft(pt(0,25)))
    this.getSubmorphNamed("wrapper").position = this.origin.negated(); 
  }

  controls() {
    return this.buttons()
               .concat(this.titleLabel())
               .concat(this.resizable ? this.resizer() : []);
  }

  buttons() {

    let defaultStyle = {
      type: "ellipse",
      extent: pt(13,13),
      borderWith: 1,
      onHoverIn() { this.submorphs[0].visible = true; },
      onHoverOut() { this.submorphs[0].visible = false; }
    }

    return [

      this.getSubmorphNamed("close") || {
        ...defaultStyle,
        name: "close",
        center: pt(15,13),
        borderColor: Color.darkRed,
        fill: Color.rgb(255,96,82),
        onMouseDown: (evt) => { this.close(); },
        submorphs: [{
          fill: Color.black.withA(0), scale: 0.7, visible: false,
          styleClasses: ["morph", "fa", "fa-times"],
          center: pt(5.5, 5), opacity: 0.5
        }]
      },

      this.getSubmorphNamed("minimize") || {
        ...defaultStyle,
        center: pt(35,13),
        name: "minimize",
        borderColor: Color.brown,
        fill: Color.rgb(255,190,6),
        onMouseDown: (evt) => { this.toggleMinimize(); },
        submorphs: [{
          fill: Color.black.withA(0), scale: 0.7, visible: false,
          styleClasses: ["morph", "fa", "fa-minus"], center: pt(5.5,5), opacity: 0.5
        }]
      },

      this.resizable ? (this.getSubmorphNamed("maximize") || {
        ...defaultStyle,
        name: "maximize",
        center: pt(55,13),
        borderColor: Color.darkGreen,
        fill: Color.green,
        onMouseDown: (evt) => { this.toggleMaximize(); },
        submorphs: [{
          fill: Color.black.withA(0), scale: 0.7, visible: false,
          styleClasses: ["morph", "fa", "fa-plus"], center: pt(5.5,5), opacity: 0.5
        }]
      }) : undefined

    ]
  }

  titleLabel() {
    return this.getSubmorphNamed("titleLabel") || {
      type: "text",
      name: "titleLabel",
      readOnly: true,
      draggable: false,
      grabbable: false,
      fill: Color.transparent,
      fontColor: Color.darkGray,
      reactsToPointer: false,
      selectable: false
    };
  }

  resizer() {
    const win = this;
    return this.getSubmorphNamed("resizer") || {
      name: "resizer",
      nativeCursor: "nwse-resize",
      extent: pt(20,20),
      opacity: 0.5,
      fill: Color.transparent,
      bottomRight: this.extent,
      onDrag(evt) {
        win.resizeBy(evt.state.dragDelta);
        this.bottomRight = win.extent;
      }
    };
  }

  get title() { return this.titleLabel().textString; }
  set title(title) { this.titleLabel().textString = title; }

  get targetMorph() { return arr.last(arr.withoutAll(this.getSubmorphNamed('wrapper').submorphs, this.controls())); }
  set targetMorph(targetMorph) {
    if (!targetMorph) {
      var existing = this.targetMorph;
      existing && existing.remove();
      return;
    }

    if (!targetMorph.isMorph) targetMorph = morph(targetMorph); // spec

    this.getSubmorphNamed("wrapper").addMorph(targetMorph, this.resizer());
    this.relayout();
  }

  toggleMinimize() {
    var cache = this.propertyCache,
        bounds = this.bounds();
    if (this.minimized) {
      cache.minimizedBounds = bounds;
      this.animate({bounds: cache.nonMinizedBounds || bounds, duration: 300});
    } else {
      cache.nonMinizedBounds = bounds;
      cache.minimizedBounds = cache.minimizedBounds || bounds.withExtent(pt(this.width, 25));
      this.animate({bounds: cache.minimizedBounds, duration: 300});
    }
    this.minimized = !this.minimized;
    this.resizer().visible = !this.minimized;
  }

  toggleMaximize() {
    var cache = this.propertyCache;
    if (this.maximized) {
      this.animate({bounds: cache.nonMaximizedBounds, duration: 300});
      this.resizer().bottomRight = this.extent;
      this.maximized = false;
    } else {
      cache.nonMaximizedBounds = this.bounds();
      this.animate({bounds: this.world().visibleBounds().insetBy(5), duration: 300});
      this.resizer().visible = true;
      this.maximized = true;
      this.minimized = false;
    }
  }

  close() {
    this.remove()
  }

  onMouseDown(evt) {
    this.activate();
    this.styleClasses = ["morph"];
  }

  focus() {
    var w = this.world(), t = this.targetMorph;
    if (!w || !t) return;
    if (w.focusedMorph && (w.focusedMorph === t || t.isAncestorOf(w.focusedMorph))) return;
    t.focus();
  }

  isActive() {
    var w = this.world();
    return w ? arr.last(w.getWindows()) === this : false;
  }

  activate() {
    if (this.isActive()) { this.focus(); return this; }

    if (!this.world()) {
      this.openInWorldNearHand()
    } else this.bringToFront();
    var w = this.world() || this.env.world;

    arr.without(w.getWindows(), this).forEach(ea => ea.deactivate());
    this.focus();
    return this;
  }

  deactivate() {}
}

export class Button extends Morph {

  constructor(props) {
    super({
      draggable: false,
      borderRadius: 15,
      extent: pt(100,24),
      borderWidth: 1,
      active: true,
      padding: Rectangle.inset(2),
      activeStyle: {
        borderColor: Color.gray,
        fill: Color.rgb(240,240,240),
        fontColor: Color.almostBlack,
        nativeCursor: "pointer"
      },
      inactiveStyle: {
        borderColor: Color.gray.withA(0.5),
        fill: Color.rgba(240,240,240, 0.5),
        fontColor: Color.almostBlack.withA(0.5),
        nativeCursor: "not-allowed"
      },
      triggerStyle: {
        fill: Color.rgb(161,161,161)
      },
      submorphs: [{
        type: "text",
        name: "label",
        readOnly: true,
        selectable: false,
        fill: Color.white.withA(0),
      }],
      ...props
    });
    this.active = this.active; // style
    this.relayout();

    connect(this, "change", this, "relayout", {updater: ($upd, {prop}) => ["extent", "padding"].includes(prop) && $upd()})
    connect(this.submorphs[0], "change", this, "relayout", {updater: ($upd, {prop}) => ["extent"].includes(prop) && $upd()})
  }

  get activeStyle() { return this.getProperty("activeStyle"); }
  set activeStyle(value) { this.addValueChange("activeStyle", value); }
  get inactiveStyle() { return this.getProperty("inactiveStyle"); }
  set inactiveStyle(value) { this.addValueChange("inactiveStyle", value); }
  get triggerStyle() { return this.getProperty("triggerStyle"); }
  set triggerStyle(value) { this.addValueChange("triggerStyle", value); }

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
  set label(label) { this.get("label").textString = label; this.relayout(); }
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

  mouseMove({targetMorph}) {
    if(this.currentMorph != targetMorph) {
      this.hoverOutOfMorph(this.currentMorph);
      this.hoverIntoMorph(targetMorph);
      this.currentMorph = targetMorph;
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
