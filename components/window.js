import { arr, obj, string } from "lively.lang";
import { pt, Color, Rectangle } from "lively.graphics";
import { show, Label, morph, Morph, GridLayout, ShadowObject } from "lively.morphic";
import { connect, signal } from "lively.bindings";

export default class Window extends Morph {

  static get properties() {
    return {
      submorphs:    {initialize() { this.submorphs = this.controls(); }},
      dropShadow:   {initialize() { this.dropShadow = new ShadowObject(true); }},
      fill:         {defaultValue: Color.lightGray},
      borderRadius: {defaultValue: 7},
      borderColor:  {defaultValue: Color.gray},
      borderWidth:  {defaultValue: 1},
      clipMode:     {defaultValue: "hidden"},
      resizable:    {defaultValue: true},

      title: {
        after: ["submorphs"], derived: true,
        get() { return this.titleLabel().textString; },
        set(title) {
          let textAndAttrs = typeof title === "string" ? [[title, {}]] : title,
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
      },

      targetMorph:  {
        after: ["submorphs"], derived: true,
        get() { return arr.withoutAll(this.submorphs, this.controls())[0]; },
        set(morph) {
          let ctrls = this.controls();
          arr.withoutAll(this.submorphs, ctrls).forEach(ea => ea.remove());
          if (morph) this.addMorph(morph, ctrls[0]);
          this.whenRendered().then(() => this.relayoutWindowControls());
        }
      },

      nonMinizedBounds: {},
      nonMaximizedBounds: {},
      minimizedBounds: {}

    }
  }

  constructor(props = {}) {
    super(props);
    this.relayoutWindowControls();
    connect(this, "extent", this, "relayoutWindowControls");
    connect(this.titleLabel(), "value", this, "relayoutWindowControls");
  }

  get isWindow() { return true }

  targetMorphBounds() { return new Rectangle(0, 25, this.width, this.height - 25); }

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
    return this.buttons()
              .concat(this.titleLabel())
              .concat(this.resizable ? this.resizer() : []);
  }

  buttons() {
    let defaultStyle = {type: "ellipse", extent: pt(14,14)};

    let closeButton = this.getSubmorphNamed("close") || morph({
      ...defaultStyle,
      name: "close",
      tooltip: "close window",
      center: pt(15,13),
      borderColor: Color.darkRed,
      fill: Color.rgb(255,96,82),
      submorphs: [
        Label.icon("times", {
          fill: null, visible: false,
          center: defaultStyle.extent.scaleBy(.5), opacity: 0.5
        })]
    });
    connect(closeButton, 'onMouseDown', this, 'close');
    connect(closeButton, 'onHoverIn', closeButton.submorphs[0], 'visible', {converter: () => true});
    connect(closeButton, 'onHoverOut', closeButton.submorphs[0], 'visible', {converter: () => false});

    let minimizeButton = this.getSubmorphNamed("minimize") || morph({
      ...defaultStyle,
      center: pt(35,13),
      name: "minimize",
      tooltip: "collapse window",
      borderColor: Color.brown,
      fill: Color.rgb(255,190,6),
      submorphs: [
        Label.icon("minus", {
          fill: null, visible: false,
          center: defaultStyle.extent.scaleBy(.5), opacity: 0.5
        })]
    });
    connect(minimizeButton, 'onMouseDown', this, 'toggleMinimize');
    connect(minimizeButton, 'onHoverIn', minimizeButton.submorphs[0], 'visible', {converter: () => true});
    connect(minimizeButton, 'onHoverOut', minimizeButton.submorphs[0], 'visible', {converter: () => false});

    if (this.resizable) {
      var maximizeButton =  (this.getSubmorphNamed("maximize") || morph({
        ...defaultStyle,
        name: "maximize",
        tooltip: "maximize window",
        center: pt(55,13),
        borderColor: Color.darkGreen,
        fill: Color.green,
        submorphs: [
          Label.icon("plus", {
            fill: null, visible: false,
            center: defaultStyle.extent.scaleBy(.5), opacity: 0.5
          })]
      }));
      connect(maximizeButton, 'onMouseDown', this, 'toggleMaximize');
      connect(maximizeButton, 'onHoverIn', maximizeButton.submorphs[0], 'visible', {converter: () => true});
      connect(maximizeButton, 'onHoverOut', maximizeButton.submorphs[0], 'visible', {converter: () => false});
    }

    return arr.compact([closeButton, minimizeButton, maximizeButton]);
  }

  titleLabel() {
    return this.getSubmorphNamed("titleLabel") || morph({
      padding: Rectangle.inset(0, 2, 0, 0),
      type: "label",
      name: "titleLabel",
      fill: null,
      fontColor: Color.darkGray,
      reactsToPointer: false,
      value: ""
    });
  }

  resizer() {
    var win = this, resizer = this.getSubmorphNamed("resizer");
    if (resizer) return resizer;
    resizer = morph({
      name: "resizer",
      nativeCursor: "nwse-resize",
      extent: pt(20,20),
      fill: Color.transparent,
      bottomRight: this.extent,
    });
    connect(resizer, 'onDrag', win, 'resizeBy', {converter: evt => evt.state.dragDelta});
    connect(win, 'extent', resizer, 'bottomRight');
    return resizer;
  }

  toggleMinimize() {
    let {nonMinizedBounds, minimized, width} = this,
        bounds = this.bounds(),
        duration = 200,
        collapseButton = this.getSubmorphNamed("minimize"),
        easing = Expo.easeOut;

    if (minimized) {
      this.minimizedBounds = bounds;
      this.animate({bounds: nonMinizedBounds || bounds, duration, easing});
      collapseButton.tooltip = "collapse window";
    } else {
      this.nonMinizedBounds = bounds;
      var minimizedBounds = this.minimizedBounds || bounds.withExtent(pt(width, 25)),
          labelBounds = this.titleLabel().textBounds(),
          buttonOffset = arr.last(this.buttons()).bounds().right() + 3;
      if (labelBounds.width + 2*buttonOffset < minimizedBounds.width)
        minimizedBounds = minimizedBounds.withWidth(labelBounds.width + buttonOffset + 3);
      this.minimizedBounds = minimizedBounds;
      collapseButton.tooltip = "uncollapse window";
      this.animate({bounds: minimizedBounds, duration, easing});
    }
    this.minimized = !minimized;
    this.resizer().visible = !this.minimized;
  }

  toggleMaximize() {
    var easing = Expo.easeOut,
        duration = 200;
    if (this.maximized) {
      this.animate({bounds: this.nonMaximizedBounds, duration, easing});
      this.resizer().bottomRight = this.extent;
      this.maximized = false;
    } else {
      this.nonMaximizedBounds = this.bounds();
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
    this.activate(evt);
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

  activate(evt) {
    if (this.isActive()) { this.focus(evt); return this; }

    if (!this.world()) this.openInWorldNearHand()
    else this.bringToFront();
    let w = this.world() || this.env.world;

    arr.without(w.getWindows(), this).forEach(ea => ea.deactivate());
    this.titleLabel().fontWeight = "bold";
    this.focus(evt);

    signal(this, "windowActivated", this);
    setTimeout(() => this.relayoutWindowControls(), 0);

    return this;
  }

  deactivate() {
    this.titleLabel().fontWeight = "normal";
    this.relayoutWindowControls();
  }
}
