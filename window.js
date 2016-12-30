import { arr, obj, string } from "lively.lang";
import { pt, Color, Rectangle } from "lively.graphics";
import { show, Label, morph, Morph, GridLayout } from "./index.js";
import { connect, signal } from "lively.bindings";

export default class Window extends Morph {

  constructor(props = {}) {
    super({
      dropShadow: true, // FIXME!
      ...obj.dissoc(props, ["title", "targetMorph"]),
    });

    this.submorphs = this.controls();

    if (props.targetMorph) this.targetMorph = props.targetMorph;

    this.title = props.title || this.name || "";
    this.resetPropertyCache();
    this.relayoutWindowControls();
    connect(this, "extent", this, "relayoutWindowControls");
    connect(this.titleLabel(), "value", this, "relayoutWindowControls");
  }

  get defaultProperties() {
    return {
      ...super.defaultProperties,
      fill: Color.lightGray,
      borderRadius: 7,
      dropShadow: true,
      borderColor: Color.gray,
      borderWidth: 1,
      clipMode: "hidden",
      resizable: true
    }
  }

  get resizable() { return this.getProperty("resizable"); }
  set resizable(val) { return this.setProperty("resizable", val); }

  get isWindow() { return true }

  get targetMorph() {
    return arr.withoutAll(this.submorphs, this.controls())[0];
  }

  set targetMorph(morph) {
    var ctrls = this.controls();
    arr.withoutAll(this.submorphs, ctrls).forEach(ea => ea.remove());
    if (morph) this.addMorph(morph, ctrls[0]);
    this.whenRendered().then(() => this.relayoutWindowControls());
  }

  targetMorphBounds() {
    return new Rectangle(0, 25, this.width, this.height - 25);
  }

  resetPropertyCache() {
    // For remembering the position and extents of the window states
    this.propertyCache = {
      nonMinizedBounds: null,
      nonMaximizedBounds: null,
      minimizedBounds: null
    };
  }

  relayoutWindowControls() {
    var innerB = this.innerBounds(),
        title = this.titleLabel(),
        labelBounds = innerB.withHeight(25),
        buttonOffset = arr.last(this.buttons()).bounds().right() + 3,
        minLabelBounds = labelBounds.withLeftCenter(pt(buttonOffset, labelBounds.height/2));

    // resizer
    this.resizer().bottomRight = innerB.bottomRight();

    // targetMorph
    if (this.targetMorph)
      this.targetMorph.setBounds(this.targetMorphBounds());

    // title
    title.textBounds().width < labelBounds.width - 2*buttonOffset ?
      title.center = labelBounds.center() :
      title.leftCenter = minLabelBounds.leftCenter();
  }

  controls() {
    return this.buttons().concat(this.titleLabel()).concat(this.resizable ? this.resizer() : []);
  }

  buttons() {

    let defaultStyle = {
      type: "ellipse",
      extent: pt(14,14),
      onHoverIn() { this.submorphs[0].visible = true; },
      onHoverOut() { this.submorphs[0].visible = false; }
    };

    return arr.compact([

      this.getSubmorphNamed("close") || {
        ...defaultStyle,
        name: "close",
        center: pt(15,13),
        borderColor: Color.darkRed,
        fill: Color.rgb(255,96,82),
        onMouseDown: (evt) => { this.close(); },
        submorphs: [
          Label.icon("times", {
            fill: null, visible: false,
            center: defaultStyle.extent.scaleBy(.5), opacity: 0.5
          })]
      },

      this.getSubmorphNamed("minimize") || {
        ...defaultStyle,
        center: pt(35,13),
        name: "minimize",
        borderColor: Color.brown,
        fill: Color.rgb(255,190,6),
        onMouseDown: (evt) => { this.toggleMinimize(); },
        submorphs: [
          Label.icon("minus", {
            fill: null, visible: false,
            center: defaultStyle.extent.scaleBy(.5), opacity: 0.5
          })]
      },

      this.resizable ? (this.getSubmorphNamed("maximize") || {
        ...defaultStyle,
        name: "maximize",
        center: pt(55,13),
        borderColor: Color.darkGreen,
        fill: Color.green,
        onMouseDown: (evt) => { this.toggleMaximize(); },
        submorphs: [
          Label.icon("plus", {
            fill: null, visible: false,
            center: defaultStyle.extent.scaleBy(.5), opacity: 0.5
          })]
      }) : undefined
    ]);
  }

  titleLabel() {
    return this.getSubmorphNamed("titleLabel") || {
      padding: Rectangle.inset(0, 2, 0, 0),
      type: "label",
      name: "titleLabel",
      fill: null,
      fontColor: Color.darkGray,
      reactsToPointer: false,
      value: ""
    };
  }

  resizer() {
    const win = this;
    return this.getSubmorphNamed("resizer") || {
      name: "resizer",
      nativeCursor: "nwse-resize",
      extent: pt(20,20),
      fill: Color.transparent,
      bottomRight: this.extent,
      onDrag(evt) {
        win.resizeBy(evt.state.dragDelta);
        this.bottomRight = win.extent;
      }
    };
  }

  get title() { return this.titleLabel().textString; }
  set title(title) {
    var textAndAttrs = typeof title === "string" ? [[title, {}]] : title,
        maxLength = 100, length = 0, truncated = [];
    for (let ea of textAndAttrs) {
      let [string, attr] = ea;
      string = string.replace(/\n/g, "");
      var delta = string.length + length - maxLength;
      if (delta > 0) string = string.slice(0, -delta);
      truncated.push([string, attr || {}]);
      if (length >= maxLength) break;
    }
    this.titleLabel().value = truncated;
  }

  toggleMinimize() {
    var cache = this.propertyCache,
        bounds = this.bounds(),
        duration = 200, easing = "easeOutQuint";
    if (this.minimized) {
      cache.minimizedBounds = bounds;
      this.animate({bounds: cache.nonMinizedBounds || bounds, duration, easing});
    } else {
      cache.nonMinizedBounds = bounds;
      var minimizedBounds = cache.minimizedBounds || bounds.withExtent(pt(this.width, 25)),
          labelBounds = this.titleLabel().textBounds(),
          buttonOffset = arr.last(this.buttons()).bounds().right() + 3;
      if (labelBounds.width + 2*buttonOffset < minimizedBounds.width)
        minimizedBounds = minimizedBounds.withWidth(labelBounds.width + buttonOffset + 3);
      cache.minimizedBounds = minimizedBounds;
      this.animate({bounds: cache.minimizedBounds, duration, easing});
    }
    this.minimized = !this.minimized;
    this.resizer().visible = !this.minimized;
  }

  toggleMaximize() {
    var cache = this.propertyCache,
        easing = "easeOutQuint",
        duration = 200;
    if (this.maximized) {
      this.animate({bounds: cache.nonMaximizedBounds, duration, easing});
      this.resizer().bottomRight = this.extent;
      this.maximized = false;
    } else {
      cache.nonMaximizedBounds = this.bounds();
      this.animate({bounds: this.world().visibleBounds().insetBy(5), duration, easing});
      this.resizer().visible = true;
      this.maximized = true;
      this.minimized = false;
    }
  }

  close() {
    var world = this.world();
    this.deactivate();
    this.remove();

    var next = world.activeWindow() || arr.last(world.getWindows());
    next && next.activate();

    signal(this, "windowClosed", this);
    if (this.targetMorph && typeof this.targetMorph.onWindowClose === "function")
      this.targetMorph.onWindowClose();
  }

  onMouseDown(evt) {
    this.activate();
  }

  focus() {
    var w = this.world(), t = this.targetMorph;
    if (!w || !t) return;
    if (w.focusedMorph && (w.focusedMorph === t || t.isAncestorOf(w.focusedMorph))) return;
    t.focus();
  }

  isActive() {
    var w = this.world();
    if (!w) return false;
    if (this.titleLabel().fontWeight != "bold") return false;
    return arr.last(w.getWindows()) === this;
  }

  activate() {
    if (this.isActive()) { this.focus(); return this; }

    if (!this.world()) {
      this.openInWorldNearHand()
    } else this.bringToFront();
    var w = this.world() || this.env.world;

    arr.without(w.getWindows(), this).forEach(ea => ea.deactivate());
    this.titleLabel().fontWeight = "bold";
    this.focus();

    signal(this, "windowActivated", this);
    setTimeout(() => {
      this.relayoutWindowControls();
    }, 0)

    return this;
  }

  deactivate() {
    this.titleLabel().fontWeight = "normal";
    this.relayoutWindowControls();
  }
}
