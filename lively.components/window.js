import { arr, promise } from 'lively.lang';
import { pt, Color, Rectangle } from 'lively.graphics';
import {
  Label, 
  morph,
  Morph
} from 'lively.morphic';
import { connect, signal } from 'lively.bindings';
import { easings } from 'lively.morphic/rendering/animations.js';
import { DefaultWindow, DefaultWindowInactive } from './window.cp.js';

export default class Window extends Morph {
  static get properties () {
    return {
      submorphs: {
        initialize () {
          this.build();
        }
      },

      position: {
        set (p) {
          this.setProperty('position', p.roundTo(1));
        }
      },

      ui: {
        derived: true,
        get () {
          return {
            header: this.get('header'),
            resizer: this.get('resizer'),
            windowControls: this.get('window controls'),
            windowTitle: this.get('window title')
          };
        }
      },

      master: {
        initialize () {
          this.master = { auto: DefaultWindow };
        }
      },

      styleClasses: { defaultValue: ['active'] },
      clipMode: { defaultValue: 'hidden' },
      resizable: { defaultValue: true },

      title: {
        after: ['submorphs'],
        derived: true,
        get () {
          return this.ui.windowTitle.textString;
        },
        async set (title) {
          const textAndAttrs = typeof title === 'string' ? [title, {}] : title; const maxLength = 100; const length = 0; const truncated = [];
          for (let i = 0; i < textAndAttrs.length; i = i + 2) {
            let string = textAndAttrs[i]; const attr = textAndAttrs[i + 1];
            string = string.replace(/\n/g, '');
            const delta = string.length + length - maxLength;
            if (delta > 0) string = string.slice(0, -delta);
            truncated.push(string, attr || {});
            if (length >= maxLength) break;
          }
          this.ui.windowTitle.value = truncated;
          await this.whenRendered();
          this.ui.windowTitle.reactsToPointer = false;
          this.relayoutWindowControls();
        }
      },

      targetMorph: {
        after: ['submorphs'],
        derived: true,
        get () {
          return arr.withoutAll(this.submorphs, [this.get('header'), this.get('resizer')])[0];
        },
        set (morph) {
          const ctrls = [this.get('header'), this.get('resizer')];
          arr.withoutAll(this.submorphs, ctrls).forEach(ea => ea.remove());
          if (morph) this.addMorph(morph, this.resizable ? this.get('resizer') : false);
          this.relayoutWindowControls();
        }
      },

      minimizedBounds: { serialize: false },
      nonMinizedBounds: {},
      nonMaximizedBounds: {},
      minimized: {
        set (isMinimized) {
          this.setProperty('minimized', isMinimized);
          this.applyMinimize();
        }
      },
      maximized: {
        set (isMaximized) {
          this.setProperty('maximized', isMaximized);
          this.applyMaximize();
        }
      }
    };
  }

  build () {
    this.submorphs = [this.buildHeader(), this.buildResizer()];
  }

  async openWindowMenu () {
    const w = this.world() || this.env.world;
    return this.targetMorph.world().openMenu([
      [
        'Change Window Title',
        async () => {
          const newTitle = await w.prompt('Enter New Name', { input: this.title });
          if (newTitle) this.title = newTitle;
        }
      ],
      [
        'Align and resize', [
          { alias: 'full', target: w, command: 'resize active window', args: { window: this, how: 'full' } },
          { alias: 'left', target: w, command: 'resize active window', args: { window: this, how: 'left' } },
          { alias: 'center', target: w, command: 'resize active window', args: { window: this, how: 'center' } },
          { alias: 'right', target: w, command: 'resize active window', args: { window: this, how: 'right' } },
          { alias: 'top', target: w, command: 'resize active window', args: { window: this, how: 'top' } },
          { alias: 'bottom', target: w, command: 'resize active window', args: { window: this, how: 'bottom' } },
          { alias: 'reset', target: w, command: 'resize active window', args: { window: this, how: 'reset' } }
        ]
      ],
      [
        'Window Management', [
          { alias: 'minimize all except this', target: w, command: 'toggle minimize all except active window' },
          { alias: 'close all except this', target: w, command: 'close all except active window' },
          { isDivider: true },
          { alias: 'minimize all', target: w, command: 'toggle minimize all windows' },
          { alias: 'close all', target: w, command: 'close all windows' }
        ]
      ],
      { isDivider: true },
      ...(await this.targetMorph.menuItems())
    ]);
  }

  isFaderActive () {
    return !!this.getSubmorphNamed('fader');
  }

  async toggleFader (active) {
    const fader = this.getSubmorphNamed('fader') || this.addMorph({
      position: pt(0, 0),
      name: 'fader',
      fill: Color.black.withA(0.5),
      opacity: 0,
      extent: this.extent
    });
    if (active) {
      const shiftedBounds = this.world().visibleBoundsExcludingTopBar().translateForInclusion(this.bounds());
      this._originalBounds = this.bounds();
      this.animate({ bounds: shiftedBounds, duration: 300 });
      this.borderColor = Color.gray.darker();
      this._faderTriggered = true;
      fader.opacity = 1;
    } else {
      if (this._originalBounds) {
        this.animate({
          bounds: this._originalBounds, duration: 300
        });
        this._originalBounds = null;
      }
      this._faderTriggered = false;
      await this.whenRendered();
      await promise.delay(100);
      this.borderColor = Color.gray;
      if (this._faderTriggered) return; // hacky way to allow other prompts to steal the prompt
      await fader.animate({ opacity: 0, duration: 300 });
      fader.remove();
    }
  }

  get isWindow () { return true; }

  targetMorphBounds () {
    return new Rectangle(0, 25, this.width, this.height - 25);
  }

  relayoutWindowControls () {
    const innerB = this.innerBounds();
    const title = this.ui.windowTitle;
    const resizer = this.ui.resizer;
    const labelBounds = innerB.withHeight(25);
    const header = this.ui.header;
    const lastButtonOrWrapper = this.ui.windowControls;
    const buttonOffset = lastButtonOrWrapper.bounds().right() + 3;
    const minLabelBounds = labelBounds.withLeftCenter(pt(buttonOffset, labelBounds.height / 2));

    // resizer
    resizer.bottomRight = innerB.bottomRight();

    // title
    title.textBounds().width < labelBounds.width - 2 * buttonOffset
      ? (title.center = labelBounds.center())
      : (title.leftCenter = minLabelBounds.leftCenter());

    // targetMorph
    if (!this.minimized && this.targetMorph && this.targetMorph.isLayoutable) { this.targetMorph.setBounds(this.targetMorphBounds()); }

    header.width = this.width;
  }

  ensureNotOverTheTop () {
    const world = this.world();
    if (!world) return;
    const bounds = this.globalBounds();
    world.withTopBarDo(tb => {
      if (bounds.top() < tb.height) {
        this.moveBy(pt(0, tb.height - bounds.top()));
      }
    });
  }

  buildHeader () {
    return morph({
      name: 'header',
      extent: pt(this.width, 50),
      submorphs: [
        morph({
          name: 'window controls',
          styleClasses: ['buttonGroup'],
          submorphs: this.buildButtons()
        }),
        this.buildTitleLabel()
      ]
    });
  }

  buildButtons () {
    const closeButton =
      this.getSubmorphNamed('close') ||
      morph({
        name: 'close',
        styleClasses: ['windowButton', 'closeButton'],
        tooltip: 'close window',
        submorphs: [
          Label.icon('times', {
            name: 'label',
            styleClasses: ['defaultLabelStyle', 'default']
          })
        ]
      });
    connect(closeButton, 'onMouseDown', this, 'close');

    const minimizeButton =
      this.getSubmorphNamed('minimize') ||
      morph({
        name: 'minimize',
        styleClasses: ['windowButton', 'minimizeButton'],
        tooltip: 'collapse window',
        submorphs: [
          Label.icon('minus', {
            name: 'label',
            styleClasses: ['defaultLabelStyle', 'default']
          })
        ]
      });
    connect(minimizeButton, 'onMouseDown', this, 'minimized', {
      updater: function ($upd) {
        $upd(!this.targetObj.minimized);
      }
    });
    let windowMenuButton;
    if (this.resizable) {
      windowMenuButton =
        this.getSubmorphNamed('menu') ||
        morph({
          name: 'menu',
          styleClasses: ['windowButton', 'windowMenuButton'],
          tooltip: 'Open Window Menu',
          submorphs: [
            Label.icon('chevron-down', {
              name: 'label',
              styleClasses: ['defaultLabelStyle', 'default']
            })
          ]
        });
      connect(windowMenuButton, 'onMouseDown', this, 'openWindowMenu');
    }

    return arr.compact([closeButton, minimizeButton, windowMenuButton]);
  }

  buildTitleLabel () {
    const title = morph({
      padding: Rectangle.inset(0, 2, 0, 0),
      styleClasses: ['windowTitleLabel'],
      type: 'label',
      name: 'window title',
      tooltip: 'double click to maximize/reset',
      reactsToPointer: true,
      value: ''
    });
    connect(this, 'onDoubleMouseDown', this, 'toggleMaximize', {
      updater: `($upd, evt) => {
        if (source.fullContainsWorldPoint(evt.position)) {
          $upd();
        }
      }`
    });
    return this.addMorph(title);
  }

  resizeBy (dist) {
    super.resizeBy(dist);
    this.relayoutWindowControls();
  }

  resizeAt ([corner, dist]) {
    let right;
    let x, y, height, width;
    const b = this.bounds();
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
      case 'top':
        x = b.x;
        y = b.y + dist.y;
        width = b.width;
        height = b.height - dist.y;
        this.setBounds(new Rectangle(x, y, width, height));
        break;
      case 'top left':
        x = b.x + dist.x;
        y = b.y + dist.y;
        width = b.width - dist.x;
        height = b.height - dist.y;
        this.setBounds(new Rectangle(x, y, width, height));
        break;
      case 'top right':
        x = b.x;
        y = b.y + dist.y;
        width = b.width + dist.x;
        height = b.height - dist.y;
        this.setBounds(new Rectangle(x, y, width, height));
        break;
    }
    this.relayoutResizer();
  }

  relayoutResizer () {
    try {
      const resizer = this.getSubmorphNamed('resizer');
      const {
        submorphs: [
          rightResizer, bottomRightResizer, leftResizer,
          bottomLeftResizer, bottomResizer, topResizer,
          topLeftResizer, topRightResizer
        ]
      } = resizer;
      const resizerInset = 10;

      rightResizer.height = this.height - resizerInset;
      rightResizer.bottomRight = this.extent.subXY(0, resizerInset);

      bottomRightResizer.bottomRight = this.extent;

      leftResizer.height = this.height - resizerInset;
      leftResizer.bottomLeft = pt(0, this.height - resizerInset);

      bottomLeftResizer.bottomLeft = pt(0, this.height);

      bottomResizer.width = this.width - 2 * resizerInset;
      bottomResizer.bottomLeft = pt(resizerInset, this.height);

      topResizer.width = this.width - 2 * resizerInset;
      topResizer.bottomLeft = pt(resizerInset, resizerInset / 4);

      topLeftResizer.topLeft = pt(0, 0);

      topRightResizer.topRight = pt(this.width, 0);

      resizer.position = pt(0, 0);
    } catch (err) {

    }
  }

  buildResizer () {
    const win = this;
    let rightResizer, bottomRightResizer, leftResizer, bottomLeftResizer, bottomResizer, topResizer, topLeftResizer, topRightResizer;
    const fill = Color.transparent;
    const resizerInset = 10;
    const resizer = morph({
      name: 'resizer',
      fill: Color.transparent,
      position: pt(0, 0),
      submorphs: [
        rightResizer = morph({
          name: 'right resizer',
          fill,
          width: resizerInset,
          draggable: true,
          nativeCursor: 'ew-resize'
        }),
        bottomRightResizer = morph({
          name: 'bottom right resizer',
          fill,
          extent: pt(10, 10),
          draggable: true,
          nativeCursor: 'nwse-resize'
        }),
        leftResizer = morph({
          name: 'left resizer',
          fill,
          width: resizerInset,
          draggable: true,
          nativeCursor: 'ew-resize'
        }),
        bottomLeftResizer = morph({
          name: 'bottom left resizer',
          draggable: true,
          fill,
          extent: pt(10, 10),
          nativeCursor: 'nesw-resize'
        }),
        bottomResizer = morph({
          name: 'bottom resizer',
          draggable: true,
          fill,
          height: resizerInset,
          nativeCursor: 'ns-resize'
        }),
        topResizer = morph({
          name: 'top resizer',
          draggable: true,
          fill,
          height: resizerInset / 4,
          nativeCursor: 'ns-resize'
        }),
        topLeftResizer = morph({
          name: 'top left resizer',
          draggable: true,
          fill,
          extent: pt(10, 10),
          nativeCursor: 'nwse-resize'
        }),
        topRightResizer = morph({
          name: 'top rigth resizer',
          draggable: true,
          fill,
          extent: pt(10, 10),
          nativeCursor: 'nesw-resize'
        })
      ]
    });
    connect(topResizer, 'onDrag', win, 'resizeAt', {
      converter: evt => ['top', evt.state.dragDelta]
    });
    connect(topRightResizer, 'onDrag', win, 'resizeAt', {
      converter: evt => ['top right', evt.state.dragDelta]
    });
    connect(topLeftResizer, 'onDrag', win, 'resizeAt', {
      converter: evt => ['top left', evt.state.dragDelta]
    });
    connect(bottomRightResizer, 'onDrag', win, 'resizeAt', {
      converter: evt => ['bottom right', evt.state.dragDelta]
    });
    connect(rightResizer, 'onDrag', win, 'resizeAt', {
      converter: evt => ['right', evt.state.dragDelta]
    });
    connect(bottomResizer, 'onDrag', win, 'resizeAt', {
      converter: evt => ['bottom', evt.state.dragDelta]
    });
    connect(leftResizer, 'onDrag', win, 'resizeAt', {
      converter: evt => ['left', evt.state.dragDelta]
    });
    connect(bottomLeftResizer, 'onDrag', win, 'resizeAt', {
      converter: evt => ['bottom left', evt.state.dragDelta]
    });
    this.addMorph(resizer);
    this.relayoutResizer();
    return resizer;
  }

  toggleMaximize () { if (!this.minized) this.maximized = !this.maximized; }

  applyMaximize () {
    if (this.maximized) {
      $world.execCommand('resize active window', { window: this, how: 'full' });
    } else {
      $world.execCommand('resize active window', { window: this, how: 'reset' });
    }
  }

  async toggleMinimize () { this.minimized = !this.minimized; }

  async applyMinimize () {
    if (!this.targetMorph) return;
    let { nonMinizedBounds, minimized, width } = this;
    const { windowTitle, resizer } = this.ui;
    const bounds = this.bounds();
    const duration = 100;
    const collapseButton = this.getSubmorphNamed('minimize');
    const easing = easings.outQuad;

    if (!minimized) {
      this.minimizedBounds = bounds;
      this.withMetaDo({ metaInteraction: true }, () => {
        this.targetMorph && (this.targetMorph.visible = true);
      });
      nonMinizedBounds = this.world().visibleBoundsExcludingTopBar().translateForInclusion(nonMinizedBounds || bounds);
      this.animate({
        bounds: nonMinizedBounds,
        styleClasses: ['neutral', 'active', ...arr.without(this.styleClasses, 'minimzed')],
        duration,
        easing
      });
      collapseButton.tooltip = 'collapse window';
    } else {
      this.nonMinizedBounds = bounds;
      let minimizedBounds = (this.minimizedBounds || bounds).withExtent(pt(width, 28));
      const labelBounds = windowTitle.textBounds();
      const buttonOffset = this.get('window controls').bounds().right() + 3;
      if (labelBounds.width + 2 * buttonOffset < minimizedBounds.width) { minimizedBounds = minimizedBounds.withWidth(labelBounds.width + buttonOffset + 5); }
      this.minimizedBounds = minimizedBounds;
      collapseButton.tooltip = 'uncollapse window';
      await this.animate({
        styleClasses: ['minimized', 'active', ...arr.without(this.styleClasses, 'neutral')],
        bounds: minimizedBounds,
        duration,
        easing
      });
      if (this.targetMorph) {
        if (!this.targetMorph.isComponent) this.targetMorph.visible = false;
        else this.targetMorph.top = this.height;
      }
    }
    windowTitle.reactsToPointer = !this.minimized;
    resizer.visible = !this.minimized;
    this.relayoutWindowControls();
  }

  setBounds (bounds) {
    super.setBounds(bounds);
    this.relayoutResizer();
    this.relayoutWindowControls();
  }

  setBounds (bounds) {
    super.setBounds(bounds);
    this.relayoutResizer();
    this.relayoutWindowControls();
  }

  async close () {
    let proceed;
    if (this.targetMorph && typeof this.targetMorph.onWindowClose === 'function') { proceed = await this.targetMorph.onWindowClose(); }
    if (proceed === false) return;
    const world = this.world();
    this.deactivate();
    this.remove();

    const next = world.activeWindow() || arr.last(world.getWindows());
    next && next.activate();

    signal(this, 'windowClosed', this);
  }

  onMouseUp (evt) {
    super.onMouseUp(evt);
    if (!this.minimized) { this.ui.resizer.visible = true; }
  }

  onMouseDown (evt) {
    super.onMouseDown(evt);
    this.activate(evt);
    if (!this.minimized && !this.ui.resizer.submorphs.includes(evt.targetMorph)) {
      this.ui.resizer.visible = false;
    }
  }

  onDragStart (evt) {
    super.onDragStart(evt);
    if (this.targetMorph) {
      evt.state.origReactsToPointer = this.targetMorph.reactsToPointer;
      this.withMetaDo({ metaInteraction: true }, () => {
        this.targetMorph.reactsToPointer = false;
      });
    }
  }

  onDragEnd (evt) {
    super.onDragEnd(evt);
    if (this.targetMorph) {
      this.withMetaDo({ metaInteraction: true }, () => {
        this.targetMorph.reactsToPointer = evt.state.origReactsToPointer;
      });
    }
    if (!this.minimized) { this.ui.resizer.visible = true; }
  }

  onDrag (evt) {
    super.onDrag(evt);
    this.ensureNotOverTheTop();
  }

  focus () {
    const w = this.world(); const t = this.targetMorph;
    if (!w || !t) return;
    if (w.focusedMorph && (w.focusedMorph === t || t.isAncestorOf(w.focusedMorph))) return;
    t.focus();
  }

  isActive () {
    const w = this.world();
    if (!w) return false;
    if (this.ui.windowTitle.fontWeight !== 'bold') return false;
    return arr.last(w.getWindows()) === this;
  }

  activate (evt) {
    if (this.isFaderActive()) return;
    if (this.isActive()) {
      this.bringToFront();
      this.focus(evt);
      this.renderOnGPU = true;
      this.relayoutWindowControls();
      return this;
    }

    this.master.whenApplied().then(() => {
      this.master = { auto: DefaultWindow };
    });

    if (!this.world()) this.openInWorldNearHand();
    else this.bringToFront();
    const w = this.world() || this.env.world;

    arr.without(w.getWindows(), this).forEach(ea => ea.deactivate());
    this.focus(evt);

    signal(this, 'windowActivated', this);
    Promise.resolve(this.master.applyIfNeeded(true)).then(() => this.relayoutWindowControls());

    return this;
  }

  deactivate () {
    // if (this.styleClasses.includes('inactive')) return;
    // this.removeStyleClass('active');
    // this.addStyleClass('inactive');
    if (this.master && this.master.auto === DefaultWindowInactive) return;
    this.master.whenApplied().then(() => {
      this.master = { auto: DefaultWindowInactive };
    });
    this.relayoutWindowControls();
    this.renderOnGPU = false;
  }

  get keybindings () {
    return super.keybindings.concat([
      {
        keys: {
          mac: 'Meta-Shift-L R E N',
          win: 'Ctrl-Shift-L R E N'
        },
        command: '[window] change title'
      }
    ]);
  }

  get commands () {
    return super.commands.concat([
      {
        name: '[window] change title',
        exec: async (win, args = {}) => {
          const title = args.title ||
            (await win.world().prompt('Enter new title', {
              input: win.title,
              historyId: 'lively.morphic-window-title-hist'
            }));
          if (title) win.title = title;
          return true;
        }
      }
    ]);
  }
}
