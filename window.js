import { arr, obj, string } from "lively.lang";
import { pt, Color, Rectangle } from "lively.graphics";
import { show, morph, Morph, GridLayout } from "./index.js";
import { connect, signal } from "lively.bindings";

export default class Window extends Morph {

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
    });

    this.submorphs = this.controls(this.resizable);
    
    if (props.targetMorph) this.targetMorph = props.targetMorph;

    this.layout = new GridLayout({grid: [[this.titleLabel()],
                                         [this.targetMorph]],
                              autoAssign: false,
                              compensateOrigin: true}),
    this.layout.row(0).col(0).group.align = "center";
    this.layout.row(0).fixed = 25;
    
    this.title = props.title || this.name || "";
    this.resetPropertyCache();
    this.relayoutControls();
    connect(this, "extent", this, "relayoutControls");
  }

  get isWindow() { return true }

  get targetMorph() {
    return arr.withoutAll(this.submorphs, this.controls())[0];
  }

  set targetMorph(morph) {
    var ctrls = this.controls();
    arr.withoutAll(this.submorphs, ctrls).forEach(ea => ea.remove());
    if (morph) this.addMorph(morph, ctrls[0]);
  }

  targetMorphBounds() {
    return new Rectangle(0, 25, this.width, this.height - 25);
  }

  resetPropertyCache() {
    // For remembering the position and extents of the window states
    this.propertyCache = {nonMinizedBounds: null, nonMaximizedBounds: null, minimizedBounds: null};
  }

  relayoutControls() {
    this.resizer().bottomRight = this.innerBounds().bottomRight();
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
          styleClasses: ["fa", "fa-times"],
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
          styleClasses: ["fa", "fa-minus"], center: pt(5.5,5), opacity: 0.5
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
          styleClasses: ["fa", "fa-plus"], center: pt(5.5,5), opacity: 0.5
        }]
      }) : undefined
    ]
  }

  titleLabel() {
    return this.getSubmorphNamed("titleLabel") || {
      type: "label",
      name: "titleLabel",
      fill: Color.transparent,
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
      cache.minimizedBounds = cache.minimizedBounds || bounds.withExtent(pt(this.width, 25));
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
      this.animate({bounds: this.world().visibleBounds().insetBy(5), 
                    duration, easing});
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

    return this;
  }

  deactivate() {
    this.titleLabel().fontWeight = "normal";
  }
}
