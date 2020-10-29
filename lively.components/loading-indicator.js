/* global System */
import { promise, fun, num } from "lively.lang";
import { Icon, stringToEasing, easings, VerticalLayout, ShadowObject, HorizontalLayout, morph, Morph, StyleSheet, Image } from "lively.morphic";
import { pt, RadialGradient, rect, Rectangle, Color } from "lively.graphics";
import { connect } from "lively.bindings";

class ProgressBar extends Morph {
  static get properties() {
    return {
      progress: {
        after: ["submorphs"],
        initialize() {
          this.progress = 0;
          this.startStepping('update');
        },
        set(p) {
          let pb = this.get("progress path");
          this._lastWidth = Math.max(pb.width, this._targetWidth, 1);
          this._targetWidth = this.width * p;
          this._timeStamp = Date.now();
          this.setProperty("progress", p);
        }
      },
      fill: {
        defaultValue: Color.darkGray,
      },
      borderRadius: {
        defaultValue: 5
      },
      clipMode: {
        defaultValue: "hidden"
      },
      submorphs: {
        initialize() {
          this.submorphs = [
            {
              name: "progress path",
              fill: Color.orange,
              width: 1,
            }
          ];
        }
      }
    }
  }

  async test() {
    this.progress = 0;
    while (this.progress < 1) {
      this.progress += .1;
      await promise.delay(1000);
    }
  }

  update() {
    setTimeout(() => {
      if (!this.world()) this.stopStepping();
    }, 1000);
    if (!this._lastWidth) return;
    let pb = this.get('progress path');
    let p = stringToEasing(easings.inOutExpo)(num.clamp(Date.now() - this._timeStamp, 0, 1000) / 1000);
    let targetWidth = this._targetWidth;
    pb.topLeft = pt(0,0);
    pb.height = this.height;
    if (this._lastWidth > targetWidth) {
      pb.width = targetWidth;
    } else {
      pb.width = num.interpolate(p, this._lastWidth, targetWidth); 
    }
  }
}

// p = LoadingIndicator.open('test test test test ')
// p.status = 'adsfadsfasdfasdfasdfaa'
// p.ui.progressBar.test()
// p.progress = .5

export default class LoadingIndicator extends Morph {

  static open(label, props) {
    let li = morph({ type: LoadingIndicator, ...props, label });
    if (props && props.animated) {
      promise.delay(props.delay || 0).then(() => {
        const hoverOffset = 25;
        li.openInWorld();
        li.opacity = 0;
        li.whenRendered().then(() => {
          li.ui.spinner.visible = true;
          li.top += hoverOffset;
          li.animate({
            top: li.top - hoverOffset,
            easing: easings.outExpo
          });
          li.animate({
            opacity: 1,
            easing: easings.outExpo
          });
        })
        
      })
      return li;
    }
    //LoadingIndicator.open('hallo I am a very long state', { animated: false })
    li.openInWorld();
    li.ui.label.whenRendered().then(() => {
      li.ui.spinner.visible = true;
      li.ui.label.fit();
    })
    return li;
    //return new this({...props, label}).openInWorld();
  }

  static forPromise(p, label, props) {
    var i = this.open(label, props);
    promise.finally(Promise.resolve(p), () => i.remove());
    return i;
  }

  static async runFn(fn, label, props) {
    var i = this.open(label, props);
    await i.whenRendered();
    try { return await fn(i); } finally { i.remove(); }
  }

  static get properties() {
    return {
      name:       {defaultValue: "LoadingIndicator"},
      styleClasses: {defaultValue: ['Halo']},
      hasFixedPosition: { defaultValue: true },
      ui: {
        derived: true,
        get() {
          return {
            progressBar: this.getSubmorphNamed('progress bar'),
            closeButton: this.getSubmorphNamed('closeButton'),
            spinner: this.getSubmorphNamed('spinner'),
            label: this.getSubmorphNamed('ld label'),
            status: this.getSubmorphNamed('status')
          }
        }
      },
      progress: {
        derived: true,
        set(p) {
          this.animateProgress(num.clamp(p, 0, 1));
        }
      },
      label: {
        derived: true, after: ["submorphs"],
        get() { 
          return this.ui.label.value; },
        set(val) { 
          this.ui.label.value = val; 
        }
      },
      status: {
        derived: true, after: ['submorphs'], defaultValue: false,
        get() { return this.getSubmorphNamed('status').value; },
        set(val) { 
          let { status, label } = this.ui;
          if (val) {
            status.visible = true;
            status.value = val;
          } else {
            status.visible = false;
            status.value = '';
          }
          this.relayout();
        }
      },

      fontFamily: {
        derived: true,
        after: ["submorphs"],
        get() { return this.ui.label.fontFamily; },
        set(val) { this.ui.label.fontFamily = val; }
      },

      fontSize: {
        derived: true,
        after: ["submorphs"],
        get() { return this.ui.label.fontSize; },
        set(val) { this.ui.label.fontSize = val; }
      },

      loadingImage: {
        defaultValue: System.decanonicalize("lively.morphic/") + "lively-web-logo-small-animate.svg"
      },

      master: {
        initialize() {
          this.master = {
            auto: 'styleguide://SystemWidgets/loading indicator'
          }
        }
      },
      submorphs: {
        initialize() {
          this.submorphs = [
            {
              name: 'wrapper',
              submorphs: [
                {
                  type: 'html',
                  name: 'spinner',
                  extent: pt(86.2,70.2),
                },
                {
                  type: 'label',
                  name: 'ld label',
                  extent: pt(20,100),
                  submorphs: [
                    {
                      type: 'label',
                      name: 'status',
                    }
                  ]
                }
              ]
            },
            {
              type: 'button',
              name: 'closeButton',
              label: Icon.textAttribute('times')
            },
            {
              type: ProgressBar,
              name: 'progress bar',
            }
          ];
        }
      }
    };
  }

  constructor(props = {}) {
    super(props);
    let { label, closeButton, progressBar } = this.ui;
    if (progressBar) {
      progressBar.opacity = 0;
      progressBar.isLayoutable = false;
    }
    connect(this, 'extent', this, 'relayout');
    connect(label, 'extent', this, "relayout");
    connect(label, 'value', this, "updateLabel");
    connect(label, 'fontSize', this, "updateLabel");
    connect(label, 'fontFamily', this, "updateLabel");
    connect(closeButton, 'fire', this, "remove");
    closeButton.fit();
    this.relayout();
  }

  async animateProgress(p) {
    let { progressBar } = this.ui;
    if (!progressBar) {
      progressBar = this.addMorph(new ProgressBar({ name: "progress bar" }));
    }
    let center = this.center;
    if (p == false) {
      progressBar.isLayoutable = false;
      progressBar.opacity = 0;
    } else {
      progressBar.isLayoutable = true;
      progressBar.opacity = 1; 
    }
    progressBar.progress = p;
    await this.whenRendered();
    this.center = center;
  }

  get isEpiMorph() { return true; }

  updateLabel() {
    var center = this.center; this.relayout();
    this.center = center;
  }

  relayout() {
    var padding = Rectangle.inset(20, 12),
        {spinner, label, closeButton, progressBar, status} = this.ui;
    closeButton.topRight = this.innerBounds().insetBy(2).topRight();
    progressBar.extent = pt(label.owner.bounds().width, 5);
    status[status.visible ? 'top' : 'bottom'] = label.height;
  }

  onHoverIn(evt) { this.ui.closeButton.visible = true; }
  onHoverOut(evt) { this.ui.closeButton.visible = false; }
}
