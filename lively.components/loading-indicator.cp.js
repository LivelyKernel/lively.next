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
          const { status, label } = this.ui;
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

      expose: {
        get () {
          return ['status', 'label', 'progress'];
        }
      },

      bindings: {
        get () {
          return [
            { signal: 'extent', handler: 'relayout' },
            { signal: 'onHoverIn', handler: 'onHoverIn' },
            { signal: 'onHoverOut', handler: 'onHoverOut' },
            { signal: 'openInWorld', handler: 'openInWorld' },

            // rms: 10.1.22 all of these are for centering in response to label updates...
            // ... isnt there a more elegant way to achieve this???
            { target: 'label', signal: 'extent', handler: 'relayout' },
            { target: 'label', signal: 'value', handler: 'updateLabel' },
            { target: 'label', signal: 'fontSize', handler: 'updateLabel' },
            { target: 'label', signal: 'fontFamily', handler: 'updateLabel' },
            { model: 'close button', signal: 'fire', handler: 'close' }
          ];
        }
      }
    };
  }

  onHoverIn () { this.ui.closeButton.visible = true; }
  onHoverOut () { this.ui.closeButton.visible = false; }

  close () {
    this.view.remove();
  }

  openInWorld () {
    const { status, label, spinner } = this.ui;
    label.whenRendered().then(() => {
      if (spinner) spinner.visible = true;
      label.fit();
    });

    // somewhat redundant
    if (this.label) {
      status.visible = true;
      status.value = this.label;
    } else {
      status.visible = false;
      status.value = '';
    }

    this.relayout();
  }

  viewDidLoad () {
    const { label, closeButton, progressBar } = this.ui;
    if (progressBar) {
      progressBar.opacity = 0;
      progressBar.isLayoutable = false;
    }
    label.value = this.label;
    this.relayout();
  }

  async animateProgress (p) {
    let { ui: { progressBar }, view } = this;
    if (!progressBar) {
      progressBar = view.addMorph(new ProgressBar({ name: 'progress bar' }));
    }
    const center = view.center;
    if (p == false) {
      progressBar.isLayoutable = false;
      progressBar.opacity = 0;
    } else {
      progressBar.isLayoutable = true;
      progressBar.opacity = 1;
    }
    progressBar.progress = p;
    await view.whenRendered();
    view.center = center;
  }

  async hideSpinner () {
    const { ui: { spinner }, view } = this;
    if (!spinner) return;
    spinner.visible = false;
    spinner.width = 50;
    spinner.remove();
    await view.whenRendered();
  }

  updateLabel () {
    const { view } = this;
    const center = view.center;
    this.relayout();
    view.center = center;
  }

  relayout () {
    const padding = Rectangle.inset(20, 12);
    const { view, ui: { spinner, label, closeButton, progressBar, status } } = this;
    closeButton.topRight = view.innerBounds().insetBy(2).topRight();
    progressBar.extent = pt(label.owner.bounds().width, 5);
    status[status.visible ? 'top' : 'bottom'] = label.height;
  }
}

function forPromise (p, label, props) {
  const i = open(label, props);
  promise.finally(Promise.resolve(p), () => i.remove());
  return i;
}

async function runFn (fn, label, props) {
  const i = open(label, props);
  await i.whenRendered();
  try { return await fn(i); } finally { i.remove(); }
}

function open (label = 'Loading...', props) {
  const li = part(LoadingIndicator, { viewModel: { label }, ...props });
  if (props && props.animated) {
    promise.delay(props.delay || 0).then(() => {
      const hoverOffset = 25;
      li.openInWorld();
      li.opacity = 0;
      li.whenRendered().then(() => {
        if (li.ui.spinner) li.ui.spinner.visible = true;
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
    });
    return li;
  }
  li.openInWorld();
  return li;
}

// part(LoadingIndicator).openInWorld()
const LoadingIndicator = component({
  defaultViewModel: LoadingIndicatorModel,
  name: 'loading indicator',
  borderRadius: 10,
  clipMode: 'hidden',
  epiMorph: true,
  hasFixedPosition: true,
  dropShadow: new ShadowObject({ color: Color.rgba(0, 0, 0, 0.62), blur: 28 }),
  extent: pt(225, 65),
  fill: Color.rgba(0, 0, 0, 0.65),
  layout: new TilingLayout({
    autoResize: true,
    align: 'center',
    axis: 'column',
    axisAlign: 'center',
    orderByIndex: true,
    spacing: 15
  }),
  position: pt(1035, 573),
  submorphs: [{
    name: 'wrapper',
    extent: pt(195, 35),
    fill: Color.rgba(46, 75, 223, 0),
    layout: new TilingLayout({
      axis: 'row',
      align: 'center',
      axisAlign: 'center',
      autoResize: true,
      direction: 'leftToRight',
      orderByIndex: true,
      padding: 0,
      reactToSubmorphAnimations: false,
      renderViaCSS: true,
      resizeSubmorphs: false,
      spacing: 0
    }),
    submorphs: [{
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
      extent: pt(86.2, 70.2),
      fill: Color.rgba(255, 255, 255, 0),
      html: '<div class="white-spinner lds-spinner"><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div></div>',
      scale: 0.5
    }, {
      type: Label,
      name: 'label',
      fill: Color.rgba(255, 255, 255, 0),
      fontColor: Color.rgb(253, 254, 254),
      fontSize: 16,
      fontWeight: 'bold',
      nativeCursor: 'pointer',
      padding: rect(0, 0, 20, 0),
      submorphs: [{
        type: Label,
        name: 'status',
        fill: Color.rgba(255, 255, 255, 0),
        fontColor: Color.rgb(253, 254, 254),
        fontWeight: 'bold',
        nativeCursor: 'pointer',
        opacity: 0.65,
        position: pt(0, 20),
        textAndAttributes: ['', null],
        visible: false
      }],
      textAndAttributes: ['test test test test ', null]
    }]
  }, part(ButtonDefault, {
    name: 'close button',
    borderWidth: 0,
    extent: pt(23, 22),
    fill: Color.transparent,
    isLayoutable: false,
    visible: false,
    submorphs: [{
      name: 'label',
      fontColor: Color.rgb(253, 254, 254),
      fontSize: 18,
      fontWeight: 'bolder',
      textAndAttributes: Icon.textAttribute('times')
    }]
  }), {
    type: ProgressBar,
    name: 'progress bar',
    extent: pt(195, 5),
    isLayoutable: false,
    opacity: 0,
    progress: 0,
    submorphs: [{
      name: 'progress path',
      extent: pt(1, 10),
      fill: Color.rgb(255, 153, 0)
    }]
  }]
});

export { LoadingIndicator, open, forPromise, runFn, LoadingIndicatorModel };
