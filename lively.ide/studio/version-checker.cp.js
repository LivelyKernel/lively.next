import { component, Morph, Icon, HTMLMorph, Label, HorizontalLayout } from 'lively.morphic';
import { evalOnServer } from 'lively.freezer/src/util/helpers';
import { resource } from 'lively.resources';
import { Color, pt } from 'lively.graphics';

import { runCommand } from '../shell/shell-interface.js';

class VersionChecker extends Morph {
  static get properties () {
    return {
      isEpiMorph: {
        derived: true,
        get () {
          return !this.isComponent;
        }
      },
      respondsToVisibleWindow: {
        derived: true,
        get () {
          return !this.isComponent;
        }
      },
      ui: {
        derived: true,
        get () {
          return {
            status: this.get('version status label'),
            checking: this.get('loading indicator'),
            outdated: this.get('icon outdated'),
            latest: this.get('icon latest')
          };
        }
      }
    };
  }

  onLoad () {
    if (!this.isComponent) {
      this.withAllSubmorphsDo(m => m.halosEnabled = false);
    }
  }

  checkVersion () {
    this.reset();
    this.checkIfUpToDate();
  }

  onMouseDown (evt) {
    super.onMouseDown(evt);
    if (!this.isComponent) { this.checkVersion(); }
  }

  relayout () {
    const padding = 10;
    const dragAreaWidth = 5;
    this.world().withTopBarDo(tb => {
      if (tb.sceneGraph && tb.sceneGraph.owner) {
        this.bottomLeft = this.world().visibleBounds().bottomLeft()
          .withX(tb.sceneGraph.right)
          .addXY(padding, -padding)
          .subXY(dragAreaWidth, 0);
      } else {
        this.bottomLeft = this.world().visibleBounds().insetBy(padding).bottomLeft();
      }
    });
  }

  async checkIfUpToDate () {
    const cmd = 'git rev-parse main';
    const cwd = await evalOnServer('System.baseURL').then(cwd => cwd.replace('file://', ''));
    let stdout;
    try {
      await runCommand('git fetch', {
        cwd
      }).whenDone();
      ({ stdout } = await runCommand(cmd, { cwd }).whenDone());
    } catch (err) {
      this.showError();
      return;
    }
    const hash1 = stdout.split('\n')[0];
    const { sha: hash2 } = await resource('https://api.github.com/repos/LivelyKernel/lively.next/commits/main').readJson();
    if (hash1 !== hash2) {
      return this.showOutdated(hash1.slice(0, 6));
    }
    return this.showUpToDate(hash1.slice(0, 6));
  }

  showOutdated (version) {
    const { status, checking, outdated } = this.ui;
    status.value = ['Version: ', {}, `[${version}]`, { fontWeight: 'bold' }, ' (Please update!)'];
    checking.visible = checking.isLayoutable = false;
    outdated.visible = outdated.isLayoutable = true;
  }

  showError () {
    const { status, checking, outdated } = this.ui;
    status.value = 'Error while checking';
    checking.visible = checking.isLayoutable = false;
    outdated.visible = outdated.isLayoutable = true;
  }

  showUpToDate (version) {
    const { status, checking, latest } = this.ui;
    status.value = ['Version: ', {}, `[${version}]`, { fontWeight: 'bold' }];
    checking.visible = checking.isLayoutable = false;
    latest.visible = latest.isLayoutable = true;
  }

  reset () {
    const { status, checking, outdated, latest } = this.ui;
    status.value = 'Checking version...';
    checking.visible = checking.isLayoutable = true;
    outdated.visible = latest.visible = outdated.isLayoutable = latest.isLayoutable = false;
  }
}
// LivelyVersionChecker.openInWorld()
const LivelyVersionChecker = component({
  type: VersionChecker,
  name: 'lively version checker',
  borderColor: Color.rgb(23, 160, 251),
  borderRadius: 5,
  extent: pt(135.5, 25.1),
  fill: Color.rgba(0, 0, 0, 0.6),
  hasFixedPosition: true,
  layout: new HorizontalLayout({
    align: 'center',
    autoResize: true,
    direction: 'leftToRight',
    orderByIndex: true,
    padding: {
      height: 0,
      width: 0,
      x: 5,
      y: 5
    },
    reactToSubmorphAnimations: false,
    renderViaCSS: true,
    resizeSubmorphs: false,
    spacing: 5
  }),
  nativeCursor: 'pointer',
  position: pt(535, 438.4),
  submorphs: [{
    type: Label,
    name: 'version status label',
    fontColor: Color.rgb(253, 254, 254),
    reactsToPointer: false,
    textAndAttributes: ['Checking version...', null]
  }, {
    type: HTMLMorph,
    name: 'loading indicator',
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
    extent: pt(83.7, 68.1),
    fill: Color.rgba(255, 255, 255, 0),
    html: '<div class="white-spinner lds-spinner"><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div></div>',
    scale: 0.2214986798373248
  }, {
    type: Label,
    name: 'icon outdated',
    fontColor: Color.rgb(231, 76, 60),
    isLayoutable: false,
    textAndAttributes: Icon.textAttribute('exclamation-triangle'),
    visible: false
  }, {
    type: Label,
    name: 'icon latest',
    fontColor: Color.rgb(40, 180, 99),
    isLayoutable: false,
    textAndAttributes: Icon.textAttribute('check-circle'),
    visible: false
  }]
});

export { LivelyVersionChecker, VersionChecker };
