/* global Expo */
import { arr, string } from "lively.lang";
import { pt, LinearGradient, rect, Color, Rectangle } from "lively.graphics";
import { Label, Icon, morph, Morph, ShadowObject } from "lively.morphic";
import { connect, signal } from "lively.bindings";
import {StyleSheet} from '../style-rules.js';
import {HorizontalLayout} from '../layout.js';


export default class Window extends Morph {

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
        extent: windowButtonSize,
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
      ".Window .maximizeButton .Label.highlight": {
        fontColor: Color.rgb(40,116,166),
      },
      ".Window.active .maximizeButton .Label.default": {
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
          rotation: 90,
          distance: 8,
          blur: 10,
          color: Color.black.withA(0.1)
        }
      },
      ".Window.active": {
        fill: Color.lightGray,
        dropShadow: {
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
      minimized: {},
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
    lively.lang.arr.invoke(this.controls, "remove");
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
      this.moveBy(pt(0, world.innerBounds().top() - bounds.top()))
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
    connect(minimizeButton, "onMouseDown", this, "toggleMinimize");

    if (this.resizable) {
      var maximizeButton =
        this.getSubmorphNamed("maximize") ||
        morph({
          name: "maximize",
          styleClasses: ['windowButton', "maximizeButton"],
          tooltip: "Open Window Menu",
          submorphs: [
            Label.icon("toggle-down", {
              styleClasses: ["defaultLabelStyle", 'default'],
            })
          ]
        });
      connect(maximizeButton, "onMouseDown", this, "openWindowMenu");
    }

    let buttons = arr.compact([closeButton, minimizeButton, maximizeButton]);
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

  async toggleMinimize() {
    let {nonMinizedBounds, minimized, width} = this,
        bounds = this.bounds(),
        duration = 200,
        collapseButton = this.getSubmorphNamed("minimize"),
        easing = Expo.easeOut;

    if (minimized) {
      this.minimized = false;
      this.minimizedBounds = bounds;
      this.targetMorph.visible = true;
      this.animate({bounds: nonMinizedBounds || bounds,
                    styleClasses: ['neutral', 'active'], duration, easing});
      collapseButton.tooltip = "collapse window";
    } else {
      this.minimized = true;
      this.nonMinizedBounds = bounds;
      var minimizedBounds = this.minimizedBounds || bounds.withExtent(pt(width, 28)),
          labelBounds = this.titleLabel().textBounds(),
          buttonOffset = this.get('button wrapper').bounds().right() + 3;
      if (labelBounds.width + 2 * buttonOffset < minimizedBounds.width)
        minimizedBounds = minimizedBounds.withWidth(labelBounds.width + buttonOffset + 5);
      this.minimizedBounds = minimizedBounds;
      collapseButton.tooltip = "uncollapse window";
      await this.animate({styleClasses: ['minimized', 'active'],
                          bounds: minimizedBounds, duration, easing});
      this.targetMorph.visible = false;
    }
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
      this.focus(evt);
      return this;
    }

    this.removeStyleClass('inactive');
    this.addStyleClass('active')

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
    this.addStyleClass('inactive')
    this.titleLabel().fontWeight = "normal";
    this.relayoutWindowControls();
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
    ])
  }
}
