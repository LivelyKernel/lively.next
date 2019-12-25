import { arr, promise } from "lively.lang";
import { pt, LinearGradient, Color, Rectangle } from "lively.graphics";
import {
  Label,
  morph,
  Morph,
  HorizontalLayout,
  StyleSheet
} from "lively.morphic";
import { connect, signal } from "lively.bindings";
import { easings } from "lively.morphic/rendering/animations.js";

export default class Window extends Morph {

  static get nodeStyleSheet() {
    return new StyleSheet({
      ".node .LabeledCheckBox .Label": {
        "fontColor": Color.rgb(214,219,223)
      },
      ".node .List": {
        "borderColor": Color.rgb(133,146,158),
        "fill": Color.rgb(86,101,115),
        "fontColor": Color.rgb(174,182,191),
        "nonSelectionFontColor": Color.rgb(214,219,223),
        "selectionColor": Color.rgb(174,182,191),
        "selectionFontColor": Color.rgb(52,73,94)
      },
      ".node .SearchField": {
        "fill": Color.rgb(93,109,126),
        "selectedFontColor": Color.rgb(213,216,220)
      },
      ".node .Text": {
        "borderColor": Color.rgb(171,178,185),
        "fontColor": Color.rgb(214,219,223),
        "selectionColor": Color.rgba(212,230,241,0.16)
      },
      ".node .Tree": {
        "borderColor": Color.rgb(133,146,158),
        "fill": Color.rgb(86,101,115),
        "selectionColor": Color.rgb(174,182,191),
        "selectionFontColor": Color.rgb(52,73,94)
      },
      ".node [name=metaInfoText]": {
        "fill": Color.rgb(86,101,115),
        "fontColor": Color.rgb(214,219,223)
      },
      ".node.active": {
        "borderColor": Color.rgb(93,109,126),
        "fill": Color.rgb(33,47,61)
      },
      ".node.active .Button": {
        "borderColor": Color.rgb(52,73,94),
        "fill": new LinearGradient({
          stops: [
            {offset: 0, color: Color.rgb(127,140,141)}, {offset: 1, color: Color.rgb(97,106,107)}
          ],
          vector: 0
        }),
        "fontColor": Color.rgb(253,254,254),
        "opacity": 1
      },
      ".node.active .windowTitleLabel": {
        "fontColor": Color.rgb(174,182,191)
      },
      ".node.inactive": {
        "fill": Color.rgb(171,178,185)
      },
      ".node.inactive .Button": {
        "fill": new LinearGradient({
          stops: [{
            offset: 0, color: Color.rgb(52,73,94)}, {offset: 1, color: Color.rgb(33,47,60)}
          ],
          vector: 0
        }),
        "fontColor": Color.rgb(235,237,239),
        "opacity": 0.3
      },
      ".node.inactive .Label": {
        "fontColor": Color.rgb(234,236,238)
      },
      ".node.inactive .windowTitleLabel": {
        "fontColor": Color.rgb(234,236,238)
      }
    })
  }

  static get styleSheet() {
    let windowButtonSize = pt(13, 13);
    return new StyleSheet('System Window Style',{
      ".Window .buttonGroup": {
        draggable: false,
        fill: Color.transparent,
        position: pt(0, 0),
        layout: new HorizontalLayout({autoResize: true, spacing: 6})
      },
      ".Window.inactive .windowButton .Label": {
        fontColor: Color.gray.darker(),
      },
      ".Window .defaultLabelStyle": {
        fontSize: 14,
        position: pt(2,1)
      },
      ".Window .buttonGroup .windowButton": {
        borderRadius: 14,
        fill: Color.transparent,
        nativeCursor: 'pointer',
        extent: pt(15,13)
      },
      ".Window .windowButton .Label": {
        nativeCursor: 'pointer'
      },
      ".Window .closeButton .Label.highlight": {
        fontColor: Color.rgb(223, 75, 75),
      },
      ".Window.active .closeButton .Label.default": {
        fontColor: Color.rgb(255, 96, 82)
      },
      ".Window .minimizeButton .Label.highlight": {
        fontColor: Color.rgb(224, 177, 77),
      },
      ".Window.active .minimizeButton .Label.default": {
        fontColor: Color.rgb(255, 190, 6)
      },
      ".Window .windowMenuButton .Label.highlight": {
        fontColor: Color.rgb(40,116,166),
      },
      ".Window.active .windowMenuButton .Label.default": {
        fontColor: Color.rgb(52,152,219),
      },
      ".Window .windowTitleLabel": {
        fill: Color.transparent,
        fontColor: Color.darkGray
      },
      ".Window": {
        borderRadius: 7,
        borderColor: Color.gray,
        borderWidth: 1
      },
      ".Window.inactive": {
        fill: Color.lightGray.lighter(),
        dropShadow: {
          fast: true,
          rotation: 90,
          distance: 8,
          blur: 10,
          color: Color.black.withA(0.1)
        }
      },
      ".Window.active": {
        fill: Color.lightGray,
        dropShadow: {
          fast: true,
          rotation: 90,
          distance: 8,
          blur: 35,
          color: Color.black.withA(0.3),
          spread: 5
        }
      }
    });
  }

  static get properties() {

    return {
      controls: {
        after: ["submorphs"],
        initialize() {
          this.controls = this.getControls();
          if (this.resizable) this.controls.push(this.resizer());
          this.submorphs = [...this.submorphs, ...this.controls];
        }
      },

      styleClasses: {defaultValue: ["active"]},
      clipMode: {defaultValue: "hidden"},
      resizable: {defaultValue: true},

      title: {
        after: ["controls"],
        derived: true,
        get() {
          return this.titleLabel().textString;
        },
        set(title) {
          let textAndAttrs = typeof title === "string" ? [title, {}] : title, maxLength = 100, length = 0, truncated = [];
          for (var i = 0; i < textAndAttrs.length; i = i + 2) {
            let string = textAndAttrs[i], attr = textAndAttrs[i + 1];
            string = string.replace(/\n/g, "");
            var delta = string.length + length - maxLength;
            if (delta > 0) string = string.slice(0, -delta);
            truncated.push(string, attr || {});
            if (length >= maxLength) break;
          }
          this.titleLabel().value = truncated;
          this.relayoutWindowControls();
        }
      },

      targetMorph: {
        after: ["controls"],
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

      minimizedBounds: {serialize: false},
      nonMinizedBounds: {},
      nonMaximizedBounds: {},
      minimized: {
        set(isMinimized) {
          this.setProperty('minimized', isMinimized);
          this.applyMinimize();
        }
      },
      maximized: {}
    };
  }

  constructor(props = {}) {
    super(props);
    this.relayoutWindowControls();
    connect(this, "extent", this, "relayoutWindowControls");
    connect(this.titleLabel(), "extent", this, "relayoutWindowControls");
  }

  fixControls() {
    let title = this.title;
    arr.invoke(this.controls, "remove");
    this.propertiesAndPropertySettings()
      .properties.controls.initialize.call(this);
    this.title = title;
  }

  async openWindowMenu() {
    let w = this.world() || this.env.world;
    return this.targetMorph.world().openMenu([
      [
        "Change Window Title",
        async () => {
          let newTitle = await w.prompt("Enter New Name", {input: this.title});
          if (newTitle) this.title = newTitle;
        }
      ],
      [
        "Align and resize", [
          {alias: "left",   target: w, command: "resize active window", args: {window: this, how: "left"}},
          {alias: "center", target: w, command: "resize active window", args: {window: this, how: "center"}},
          {alias: "right",  target: w, command: "resize active window", args: {window: this, how: "right"}},
          {alias: "reset",  target: w, command: "resize active window", args: {window: this, how: "reset"}},
        ]
      ],
      {isDivider: true},
      ...(await this.targetMorph.menuItems())
    ]);
  }

  async toggleFader(active) {
    let fader = this.getSubmorphNamed('fader') || this.addMorph({
      name: 'fader', fill: Color.black.withA(.5), opacity: 0, extent: this.extent
    });
    if (active) {
      this._faderTriggered = true;
      fader.opacity = 1;
    } else {
      this._faderTriggered = false;
      await promise.delay(100);
      if (this._faderTriggered) return; // hacky way to allow other prompts to steal the prompt
      await fader.animate({ opacity: 0, duration: 300 });
      fader.remove();
    }
  }

  get isWindow() { return true; }

  targetMorphBounds() {
    return new Rectangle(0, 25, this.width, this.height - 25);
  }

  relayoutWindowControls() {
    var innerB = this.innerBounds(),
        title = this.titleLabel(),
        labelBounds = innerB.withHeight(25),
        lastButtonOrWrapper = this.getSubmorphNamed("button wrapper") || arr.last(this.buttons()),
        buttonOffset = lastButtonOrWrapper.bounds().right() + 3,
        minLabelBounds = labelBounds.withLeftCenter(pt(buttonOffset, labelBounds.height / 2));

    // resizer
    this.resizer().bottomRight = innerB.bottomRight();

    // targetMorph
    if (!this.minimized && this.targetMorph && this.targetMorph.isLayoutable) this.targetMorph.setBounds(this.targetMorphBounds());

    // title
    title.textBounds().width < labelBounds.width - 2 * buttonOffset
      ? (title.center = labelBounds.center())
      : (title.leftCenter = minLabelBounds.leftCenter());
  }

  ensureNotOverTheTop() {
    let world = this.world();
    if (!world) return;
    let bounds = this.globalBounds();
    if (bounds.top() < world.innerBounds().top())
      this.moveBy(pt(0, world.innerBounds().top() - bounds.top()));
  }

  getControls() {
    return [
      morph({
        name: "button wrapper",
        styleClasses: ["buttonGroup"],
        submorphs: this.buttons()
      }),
      this.titleLabel(),
    ];
  }

  buttons() {
    let closeButton =
      this.getSubmorphNamed("close") ||
      morph({
        name: "close",
        styleClasses: ['windowButton', "closeButton"],
        tooltip: "close window",
        submorphs: [
          Label.icon("times", {
            styleClasses: ["defaultLabelStyle",'default'],
          })
        ]
      });
    connect(closeButton, "onMouseDown", this, "close");

    let minimizeButton =
      this.getSubmorphNamed("minimize") ||
      morph({
        name: "minimize",
        styleClasses: ['windowButton', "minimizeButton"],
        tooltip: "collapse window",
        submorphs: [
          Label.icon("minus", {
            styleClasses: ["defaultLabelStyle", 'default'],
          })
        ]
      });
    connect(minimizeButton, "onMouseDown", this, "minimized", {
      updater: function($upd) {
        $upd(!this.targetObj.minimized)
      }
    });

    if (this.resizable) {
      var windowMenuButton =
        this.getSubmorphNamed("window menu button") ||
        morph({
          name: "window menu button",
          styleClasses: ['windowButton', "windowMenuButton"],
          tooltip: "Open Window Menu",
          submorphs: [
            Label.icon("chevron-down", {
              styleClasses: ["defaultLabelStyle", 'default'],
            })
          ]
        });
      connect(windowMenuButton, "onMouseDown", this, "openWindowMenu");
    }

    let buttons = arr.compact([closeButton, minimizeButton, windowMenuButton]);
    buttons.forEach(b => {
      connect(b, "onHoverIn", b.submorphs[0], "styleClasses", {
        converter: () => ["defaultLabelStyle", "highlight"]
      });
      connect(b, "onHoverOut", b.submorphs[0], "styleClasses", {
        converter: () => ["defaultLabelStyle", "default"]
      });
    });
    return buttons;
  }

  titleLabel() {
    return (
      this.getSubmorphNamed("titleLabel") ||
      this.addMorph({
        padding: Rectangle.inset(0, 2, 0, 0),
        styleClasses: ["windowTitleLabel"],
        type: "label",
        name: "titleLabel",
        reactsToPointer: false,
        value: ""
      })
    );
  }

  resizeAt([corner, dist]) {
    let right;
    switch (corner) {
      case 'right':
        this.resizeBy(dist.withY(0)); break;
      case 'bottom right':
        this.resizeBy(dist); break;
      case 'bottom':
        this.resizeBy(dist.withX(0)); break;
      case 'left':
        right = this.right;
        this.resizeBy(dist.withY(0).negated());
        this.right = right;
        break; // more adjustment needed
      case 'bottom left':
        right = this.right;
        this.resizeBy(dist.scaleByPt(pt(-1, 1))); 
        this.right = right;
        break; // adjustment needed
    }
    this.relayoutResizer();
  }

  relayoutResizer() {
    let resizer = this.getSubmorphNamed("resizer"),
      {
        submorphs: [
          rightResizer, bottomRightResizer, leftResizer,
          bottomLeftResizer, bottomResizer
        ]
      } = resizer;
    
    rightResizer.height = this.height;
    rightResizer.bottomRight = this.extent;

    bottomRightResizer.bottomRight = this.extent;

    leftResizer.height = this.height;
    leftResizer.bottomLeft = pt(0, this.height);

    bottomLeftResizer.bottomLeft = pt(0, this.height);

    bottomResizer.width = this.width;
    bottomResizer.bottomLeft = pt(0,this.height);

    resizer.position = pt(0,0)
  }

  resizer() {
    var win = this, resizer = this.getSubmorphNamed("resizer"),
        rightResizer, bottomRightResizer, leftResizer, bottomLeftResizer, bottomResizer;
    if (resizer) return resizer;
    let fill = Color.transparent;
    resizer = morph({
      name: "resizer",
      fill: Color.transparent,
      position: pt(0,0),
      submorphs: [
        rightResizer = morph({
          name: 'right resizer',
          fill, width: 5,
          nativeCursor: 'ew-resize'
        }),
        bottomRightResizer = morph({
          name: 'bottom right resizer',
          fill, extent: pt(10,10),
          nativeCursor: "nwse-resize"
        }),
        leftResizer = morph({
          name: 'right resizer',
          fill, width: 5, 
          nativeCursor: 'ew-resize'
        }),
        bottomLeftResizer = morph({
          name: 'bottom left resizer',
          fill, extent: pt(10,10),
          nativeCursor: "nesw-resize"
        }),
        bottomResizer = morph({
          name: 'bottom resizer',
          fill, height: 5,
          nativeCursor: 'ns-resize'
        }),
      ]
    });
    connect(bottomRightResizer, "onDrag", win, "resizeAt", {
      converter: evt => ['bottom right', evt.state.dragDelta]
    });
    connect(rightResizer, "onDrag", win, "resizeAt", {
      converter: evt => ['right', evt.state.dragDelta]
    });
    connect(bottomResizer, "onDrag", win, "resizeAt", {
      converter: evt => ['bottom', evt.state.dragDelta]
    })
    connect(leftResizer, "onDrag", win, "resizeAt", {
      converter: evt => ['left', evt.state.dragDelta]
    });
    connect(bottomLeftResizer, "onDrag", win, "resizeAt", {
      converter: evt => ['bottom left', evt.state.dragDelta]
    })
    this.addMorph(resizer);
    this.relayoutResizer();
    return resizer;
  }

  async toggleMinimize() { this.minimized = !this.minimized; }

  async applyMinimize() {
    if (!this.targetMorph) return;
    let {nonMinizedBounds, minimized, width} = this,
        bounds = this.bounds(),
        duration = 100,
        collapseButton = this.getSubmorphNamed("minimize"),
        easing = easings.outQuad;

    if (!minimized) {
      this.minimizedBounds = bounds;
      this.targetMorph && (this.targetMorph.visible = true);
      this.animate({
        bounds: nonMinizedBounds || bounds,
        styleClasses: ['neutral', 'active', ...arr.without(this.styleClasses, 'minimzed')], 
        duration, easing
      });
      collapseButton.tooltip = "collapse window";
    } else {
      this.nonMinizedBounds = bounds;
      var minimizedBounds = this.minimizedBounds || bounds.withExtent(pt(width, 28)),
          labelBounds = this.titleLabel().textBounds(),
          buttonOffset = this.get('button wrapper').bounds().right() + 3;
      if (labelBounds.width + 2 * buttonOffset < minimizedBounds.width)
        minimizedBounds = minimizedBounds.withWidth(labelBounds.width + buttonOffset + 5);
      this.minimizedBounds = minimizedBounds;
      collapseButton.tooltip = "uncollapse window";
      await this.animate({styleClasses: ['minimized', 'active', ...arr.without(this.styleClasses, 'neutral')],
        bounds: minimizedBounds, duration, easing});
      this.targetMorph && (this.targetMorph.visible = false);
    }
    this.resizer().visible = !this.minimized;
  }

  async close() {
    let proceed;
    if (this.targetMorph && typeof this.targetMorph.onWindowClose === "function")
      proceed = await this.targetMorph.onWindowClose();
    if (proceed === false) return;
    var world = this.world();
    this.deactivate();
    this.remove();

    var next = world.activeWindow() || arr.last(world.getWindows());
    next && next.activate();

    signal(this, "windowClosed", this);
  }

  onMouseDown(evt) {
    this.activate(evt);
  }
  
  onDragStart(evt) {
    super.onDragStart(evt);
    if (this.targetMorph) {
      evt.state.origReactsToPointer = this.targetMorph.reactsToPointer;
      this.targetMorph.reactsToPointer = false;
    }
  }

  onDragEnd(evt) {
    super.onDragEnd(evt);
    if (this.targetMorph) {
      this.targetMorph.reactsToPointer = evt.state.origReactsToPointer;
    }
  }

  onDrag(evt) {
    super.onDrag(evt);
    this.ensureNotOverTheTop();
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
      this.bringToFront();
      this.focus(evt);
      this.renderOnGPU = true;
      return this;
    }

    this.removeStyleClass('inactive');
    this.addStyleClass('active');

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
    if (this.styleClasses.includes('inactive')) return;
    this.removeStyleClass('active');
    this.addStyleClass('inactive');
    this.titleLabel().fontWeight = "normal";
    this.relayoutWindowControls();
    this.renderOnGPU = false;
  }

  get keybindings() {
    return super.keybindings.concat([
      {
        keys: {
          mac: "Meta-Shift-L R E N",
          win: "Ctrl-Shift-L R E N",
        },
        command: "[window] change title"
      }
    ]);
  }

  get commands() {
    return super.commands.concat([
      {
        name: "[window] change title",
        exec: async (win, args = {}) =>  {
          let title = args.title ||
            (await win.world().prompt("Enter new title", {
              input: win.title,
              historyId: "lively.morphic-window-title-hist"
            }));
          if (title) win.title = title;
          return true;
        }
      }
    ]);
  }
}
