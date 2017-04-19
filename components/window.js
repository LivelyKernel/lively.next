/* global Expo */
import { arr, string } from "lively.lang";
import { pt, Color, Rectangle } from "lively.graphics";
import { Label, morph, Morph, ShadowObject } from "lively.morphic";
import { connect, signal } from "lively.bindings";
import {StyleSheet} from '../style-rules.js';
import {HorizontalLayout} from '../layout.js';

export const defaultWindowStyleSheet = () => {
  let windowButtonSize = pt(13,13),
      defaultLabelStyle = {
         fill: Color.transparent, opacity: 0.5,
         fontSize: 11,
         center: windowButtonSize.scaleBy(.5)
      };
  return new StyleSheet({
    buttonGroup: {
      fill: Color.transparent,
      position: pt(0, 0),
      layout: new HorizontalLayout({autoResize: true, spacing: 6})
    },
    closeButton: {
      borderRadius: 14,
      extent: windowButtonSize,
      borderColor: Color.darkRed,
      fill: Color.rgb(255, 96, 82)
    },
    closeLabel: defaultLabelStyle,
    minimizeButton: {
      borderRadius: 14,
      extent: windowButtonSize,
      borderColor: Color.brown,
      fill: Color.rgb(255, 190, 6)
    },
    minimizeLabel: defaultLabelStyle,
    maximizeButton: {
      borderRadius: 14,
      extent: windowButtonSize,
      borderColor: Color.darkGreen,
      fill: Color.green
    },
    maximizeLabel: defaultLabelStyle,
    windowTitleLabel: {
      fill: Color.transparent,
      fontColor: Color.darkGray
    },
    windowBody: {
      fill: Color.lightGray,
      borderRadius: 7,
      borderColor: Color.gray,
      borderWidth: 1
    }
  });
}

export default class Window extends Morph {

  static get properties() {
    return {
      submorphs: {
        initialize() {
          this.submorphs = this.controls = this.getControls();
        }
      },
      dropShadow: {
        initialize() {
          this.dropShadow = new ShadowObject(true);
        }
      },
      styleClasses: {defaultValue: ["windowBody"]},
      styleSheets: {
        initialize() {
          this.styleSheets = defaultWindowStyleSheet();
        }
      },
      clipMode: {defaultValue: "hidden"},
      resizable: {defaultValue: true},

      title: {
        after: ["submorphs"],
        derived: true,
        get() {
          return this.titleLabel().textString;
        },
        set(title) {
          let textAndAttrs = typeof title === "string" ? [title, {}] : title,
              maxLength = 100,
              length = 0,
              truncated = [];
          for (var i = 0; i < textAndAttrs.length; i = i + 2) {
            let string = textAndAttrs[i], attr = textAndAttrs[i + 1];
            string = string.replace(/\n/g, "");
            var delta = string.length + length - maxLength;
            if (delta > 0) string = string.slice(0, -delta);
            truncated.push(string, attr || {});
            if (length >= maxLength) break;
          }
          this.titleLabel().value = truncated;
        }
      },

      targetMorph: {
        after: ["submorphs"],
        derived: true,
        get() {
          return arr.withoutAll(this.submorphs, this.controls)[0];
        },
        set(morph) {
          let ctrls = this.controls;
          arr.withoutAll(this.submorphs, ctrls).forEach(ea => ea.remove());
          if (morph) this.addMorph(morph, ctrls[0]);
          this.whenRendered().then(() => this.relayoutWindowControls());
        }
      },

      nonMinizedBounds: {},
      nonMaximizedBounds: {},
      minimizedBounds: {},
      minimized: {},
      maximized: {}
    };
  }

  constructor(props = {}) {
    super(props);
    this.relayoutWindowControls();
    connect(this, "extent", this, "relayoutWindowControls");
    connect(this.titleLabel(), "value", this, "relayoutWindowControls");
  }

  get isWindow() {
    return true;
  }

  targetMorphBounds() {
    return new Rectangle(0, 25, this.width, this.height - 25);
  }

  relayoutWindowControls() {
    var innerB = this.innerBounds(),
        title = this.titleLabel(),
        labelBounds = innerB.withHeight(25),
        buttonOffset = this.get("button wrapper").bounds().right() + 3,
        minLabelBounds = labelBounds.withLeftCenter(pt(buttonOffset, labelBounds.height / 2));

    // resizer
    this.resizer().bottomRight = innerB.bottomRight();

    // targetMorph
    if (this.targetMorph && this.targetMorph.isLayoutable)
      this.targetMorph.setBounds(this.targetMorphBounds());

    // title
    title.textBounds().width < labelBounds.width - 2 * buttonOffset
      ? (title.center = labelBounds.center())
      : (title.leftCenter = minLabelBounds.leftCenter());
  }

  getControls() {
    return [
      morph({
        name: "button wrapper",
        styleClasses: ["buttonGroup"],
        submorphs: this.buttons()
      })
    ]
      .concat(this.titleLabel())
      .concat(this.resizable ? this.resizer() : []);
  }

  buttons() {
    let closeButton =
      this.getSubmorphNamed("close") ||
      morph({
        name: "close",
        styleClasses: ["closeButton"],
        tooltip: "close window",
        submorphs: [
          Label.icon("times", {
            styleClasses: ["closeLabel"],
            visible: false
          })
        ]
      });
    connect(closeButton, "onMouseDown", this, "close");
    connect(closeButton, "onHoverIn", closeButton.submorphs[0], "visible", {
      converter: () => true
    });
    connect(closeButton, "onHoverOut", closeButton.submorphs[0], "visible", {
      converter: () => false
    });

    let minimizeButton =
      this.getSubmorphNamed("minimize") ||
      morph({
        name: "minimize",
        styleClasses: ["minimizeButton"],
        tooltip: "collapse window",
        submorphs: [
          Label.icon("minus", {
            styleClasses: ["minimizeLabel"],
            visible: false
          })
        ]
      });
    connect(minimizeButton, "onMouseDown", this, "toggleMinimize");
    connect(minimizeButton, "onHoverIn", minimizeButton.submorphs[0], "visible", {
      converter: () => true
    });
    connect(minimizeButton, "onHoverOut", minimizeButton.submorphs[0], "visible", {
      converter: () => false
    });

    if (this.resizable) {
      var maximizeButton =
        this.getSubmorphNamed("maximize") ||
        morph({
          name: "maximize",
          styleClasses: ["maximizeButton"],
          tooltip: "maximize window",
          submorphs: [
            Label.icon("plus", {
              styleClasses: ["maximizeLabel"],
              visible: false
            })
          ]
        });
      connect(maximizeButton, "onMouseDown", this, "toggleMaximize");
      connect(maximizeButton, "onHoverIn", maximizeButton.submorphs[0], "visible", {
        converter: () => true
      });
      connect(maximizeButton, "onHoverOut", maximizeButton.submorphs[0], "visible", {
        converter: () => false
      });
    }

    return arr.compact([closeButton, minimizeButton, maximizeButton]);
  }

  titleLabel() {
    return (
      this.getSubmorphNamed("titleLabel") ||
      morph({
        padding: Rectangle.inset(0, 2, 0, 0),
        styleClasses: ["windowTitleLabel"],
        type: "label",
        name: "titleLabel",
        reactsToPointer: false,
        value: ""
      })
    );
  }

  resizer() {
    var win = this, resizer = this.getSubmorphNamed("resizer");
    if (resizer) return resizer;
    resizer = morph({
      name: "resizer",
      nativeCursor: "nwse-resize",
      extent: pt(20, 20),
      fill: Color.transparent,
      bottomRight: this.extent
    });
    connect(resizer, "onDrag", win, "resizeBy", {converter: evt => evt.state.dragDelta});
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
      if (labelBounds.width + 2 * buttonOffset < minimizedBounds.width)
        minimizedBounds = minimizedBounds.withWidth(labelBounds.width + buttonOffset + 3);
      this.minimizedBounds = minimizedBounds;
      collapseButton.tooltip = "uncollapse window";
      this.animate({bounds: minimizedBounds, duration, easing});
    }
    this.minimized = !minimized;
    this.resizer().visible = !this.minimized;
  }

  toggleMaximize() {
    var easing = Expo.easeOut, duration = 200;
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
    if (this.isActive()) {
      this.focus(evt);
      return this;
    }

    if (!this.world()) this.openInWorldNearHand();
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
