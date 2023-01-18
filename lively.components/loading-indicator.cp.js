import { ShadowObject, TilingLayout, easings, stringToEasing, Morph, Icon, Label, HTMLMorph, component, ViewModel, part } from 'lively.morphic';
import { Color, Rectangle, rect, pt } from 'lively.graphics';
import { promise, num } from 'lively.lang';
import { ButtonDefault } from './buttons.cp.js';

class ProgressBar extends Morph {
  static get properties () {
    return {
      progress: {
        after: ['submorphs'],
        initialize () {
          this.progress = 0;
          this.startStepping('update');
        },
        set (p) {
          const pb = this.get('progress path');
          this._lastWidth = Math.max(pb.width, this._targetWidth, 1);
          this._targetWidth = this.width * p;
          this._timeStamp = Date.now();
          this.setProperty('progress', p);
        }
      },
      fill: {
        defaultValue: Color.darkGray
      },
      borderRadius: {
        defaultValue: 5
      },
      clipMode: {
        defaultValue: 'hidden'
      },
      submorphs: {
        initialize () {
          this.submorphs = [
            {
              name: 'progress path',
              fill: Color.orange,
              width: 1
            }
          ];
        }
      }
    };
  }

  async test () {
    this.progress = 0;
    while (this.progress < 1) {
      this.progress += 0.1;
      await promise.delay(1000);
    }
  }

  update () {
    setTimeout(() => {
      if (!this.world()) this.stopStepping();
    }, 1000);
    if (!this._lastWidth) return;
    const pb = this.get('progress path');
    const p = stringToEasing(easings.inOutExpo)(num.clamp(Date.now() - this._timeStamp, 0, 1000) / 1000);
    const targetWidth = this._targetWidth;
    pb.topLeft = pt(0, 0);
    pb.height = this.height;
    if (this._lastWidth > targetWidth) {
      pb.width = targetWidth;
    } else {
      pb.width = num.interpolate(p, this._lastWidth, targetWidth);
    }
  }
}

class LoadingIndicatorModel extends ViewModel {
  static get properties () {
    return {
      progress: {
        derived: true,
        set (p) {
          this.animateProgress(num.clamp(p, 0, 1));
        }
      },
      label: {
        set (val) {
          this.setProperty('label', val);
          if (!this.view) return;
          this.ui.label.value = val;
        }
      },
      status: {
        defaultValue: false,
        set (val) {
          this.setProperty('status', val);
          const { status } = this.ui;
          if (val) {
            status.visible = true;
            status.value = val;
          } else {
            status.visible = false;
            status.value = '';
          }
        }
      },

      expose: {
        get () {
          return ['status', 'label', 'progress', 'isLoadingIndicator'];
        }
      },

      bindings: {
        get () {
          return [
            { signal: 'onHoverIn', handler: 'onHoverIn' },
            { signal: 'onHoverOut', handler: 'onHoverOut' },
            { signal: 'openInWorld', handler: 'openInWorld' },
            { model: 'close button', signal: 'fire', handler: 'close' }
          ];
        }
      }
    };
  }

  get isLoadingIndicator () {
    return true;
  }

  onHoverIn () { this.ui.closeButton.opacity = 1; }
  onHoverOut () { this.ui.closeButton.opacity = 0; }

  close () {
    this.view.remove();
  }

  openInWorld () {
    const { status } = this.ui;

    if (this.label) {
      status.visible = true;
      status.value = this.label;
    } else {
      status.visible = false;
      status.value = '';
    }
  }

  viewDidLoad () {
    const { label, progressBar } = this.ui;
    if (progressBar) {
      progressBar.visible = false;
    }
    label.value = this.label;
  }

  async animateProgress (p) {
    let { ui: { progressBar } } = this;
    if (p === false) {
      progressBar.visible = false;
    } else {
      progressBar.visible = true;
    }
    progressBar.progress = p;
  }

  async hideSpinner () {
    const { ui: { spinner } } = this;
    if (!spinner) return;
    spinner.visible = false;
    spinner.width = 50;
    spinner.remove();
  }
}

function open (label = 'Loading...', props) {
  const li = part(LoadingIndicator, { viewModel: { label }, ...props }); // eslint-disable-line no-use-before-define
  if (props && props.animated) {
    promise.delay(props.delay || 0).then(() => {
      const hoverOffset = 25;
      li.openInWorld();
      li.opacity = 0;
      li.top += hoverOffset;
      li.animate({
        top: li.top - hoverOffset,
        easing: easings.outExpo
      });
      li.animate({
        opacity: 1,
        easing: easings.outExpo
      });
    });
    return li;
  }
  li.openInWorld();
  return li;
}

async function runFn (fn, label, props) {
  const i = open(label, props);
  i.env.forceUpdate();
  try { return await fn(i); } finally { i.remove(); }
}

function forPromise (p, label, props) {
  const i = open(label, props);
  promise.finally(Promise.resolve(p), () => i.remove());
  return i;
}

const LoadingIndicator = component({
  defaultViewModel: LoadingIndicatorModel,
  epiMorph: true,
  fill: Color.transparent,
  name: 'loading indicator',
  layout: new TilingLayout({ align: 'center', axisAlign: 'center' }),
  extent: pt(225, 50),
  submorphs: [{
    name: 'background',
    borderRadius: 10,
    clipMode: 'hidden',
    dropShadow: new ShadowObject({ color: Color.rgba(0, 0, 0, 0.62), blur: 28 }),
    extent: pt(225, 65),
    fill: Color.rgba(0, 0, 0, 0.65),
    layout: new TilingLayout({
      axis: 'column',
      padding: 10,
      hugContentsVertically: true,
      hugContentsHorizontally: true,
      resizePolicies: [
        ['progress bar', { width: 'fill', height: 'fixed' }]
      ]
    }),
    submorphs: [{
      name: 'top float',
      fill: Color.transparent,
      layout: new TilingLayout({
        hugContentsVertically: true,
        hugContentsHorizontally: true,
        align: 'center',
        axis: 'row',
        axisAlign: 'top',
        padding: rect(22, 0, -22, 0)
      }),
      submorphs: [{
        name: 'spinner wrapper',
        fill: Color.transparent,
        height: 45,
        width: 40,
        layout: new TilingLayout({
          axis: 'row',
          align: 'left',
          axisAlign: 'center',
          reactToSubmorphAnimations: false
        }),
        submorphs: [
          {
            type: HTMLMorph,
            name: 'spinner',
            cssDeclaration: '\n\
           .lds-spinner {\n\
            color: official;\n\
            display: inline-block;\n\
            position: relative;\n\
            width: 64px;\n\
            height: 64px;\n\
          }\n\
          .lds-spinner div {\n\
            transform-origin: 32px 32px;\n\
            animation: lds-spinner .6s linear infinite;\n\
          }\n\
          .white-spinner div:after {\n\
            content: " ";\n\
            display: block;\n\
            position: absolute;\n\
            top: 3px;\n\
            left: 29px;\n\
            width: 5px;\n\
            height: 14px;\n\
            border-radius: 20%;\n\
            background: white;\n\
          }\n\
          .lds-spinner div:nth-child(1) {\n\
            transform: rotate(0deg);\n\
            animation-delay: -.55s;\n\
          }\n\
          .lds-spinner div:nth-child(2) {\n\
            transform: rotate(30deg);\n\
            animation-delay: -.5s;\n\
          }\n\
          .lds-spinner div:nth-child(3) {\n\
            transform: rotate(60deg);\n\
            animation-delay: -0.45s;\n\
          }\n\
          .lds-spinner div:nth-child(4) {\n\
            transform: rotate(90deg);\n\
            animation-delay: -0.4s;\n\
          }\n\
          .lds-spinner div:nth-child(5) {\n\
            transform: rotate(120deg);\n\
            animation-delay: -0.35s;\n\
          }\n\
          .lds-spinner div:nth-child(6) {\n\
            transform: rotate(150deg);\n\
            animation-delay: -0.3s;\n\
          }\n\
          .lds-spinner div:nth-child(7) {\n\
            transform: rotate(180deg);\n\
            animation-delay: -0.25s;\n\
          }\n\
          .lds-spinner div:nth-child(8) {\n\
            transform: rotate(210deg);\n\
            animation-delay: -0.2s;\n\
          }\n\
          .lds-spinner div:nth-child(9) {\n\
            transform: rotate(240deg);\n\
            animation-delay: -0.15s;\n\
          }\n\
          .lds-spinner div:nth-child(10) {\n\
            transform: rotate(270deg);\n\
            animation-delay: -0.1s;\n\
          }\n\
          .lds-spinner div:nth-child(11) {\n\
            transform: rotate(300deg);\n\
            animation-delay: -0.05s;\n\
          }\n\
          .lds-spinner div:nth-child(12) {\n\
            transform: rotate(330deg);\n\
            animation-delay: 0s;\n\
          }\n\
          @keyframes lds-spinner {\n\
            0% {\n\
              opacity: 1;\n\
            }\n\
            100% {\n\
              opacity: 0;\n\
            }\n\
          }',
            extent: pt(65, 70),
            fill: Color.rgba(255, 255, 255, 0),
            html: '<div class="white-spinner lds-spinner"><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div></div>',
            scale: 0.5
          }
        ]
      }, {
        name: 'wrapper',
        extent: pt(195, 35),
        fill: Color.rgba(46, 75, 223, 0),
        layout: new TilingLayout({
          axis: 'column',
          align: 'center',
          axisAlign: 'left',
          direction: 'leftToRight',
          orderByIndex: true,
          reactToSubmorphAnimations: false,
          renderViaCSS: true,
          hugContentsHorizontally: true,
          hugContentsVertically: true
        }),
        submorphs: [{
          type: Label,
          name: 'label',
          fill: Color.rgba(255, 255, 255, 0),
          fontColor: Color.rgb(253, 254, 254),
          fontSize: 16,
          padding: rect(0, 0, 10, 0),
          fontWeight: 'bold',
          nativeCursor: 'pointer',
          textAndAttributes: ['test test test test ', null]
        }, {
          type: Label,
          name: 'status',
          fill: Color.rgba(255, 255, 255, 0),
          padding: Rectangle.inset(0, 0, 0, 7.5),
          fontColor: Color.rgb(253, 254, 254),
          fontWeight: 'bold',
          nativeCursor: 'pointer',
          opacity: 0.65,
          textAndAttributes: ['', null],
          visible: false
        }]
      }, part(ButtonDefault, {
        name: 'close button',
        borderWidth: 0,
        opacity: 0,
        extent: pt(23, 22),
        fill: Color.transparent,
        submorphs: [{
          name: 'label',
          fontColor: Color.rgb(253, 254, 254),
          fontSize: 18,
          fontWeight: 'bolder',
          textAndAttributes: Icon.textAttribute('times')
        }]
      })]
    }, {
      type: ProgressBar,
      name: 'progress bar',
      extent: pt(195, 5),
      visible: false,
      progress: 0,
      submorphs: [{
        name: 'progress path',
        extent: pt(1, 10),
        fill: Color.rgb(255, 153, 0)
      }]
    }]
  }]
});

export { LoadingIndicator, open, forPromise, runFn, LoadingIndicatorModel };
