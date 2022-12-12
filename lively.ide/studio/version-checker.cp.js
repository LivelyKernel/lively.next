import { component, TilingLayout, Morph, Icon, HTMLMorph, Label } from 'lively.morphic';
import { evalOnServer } from 'lively.freezer/src/util/helpers';
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
            statusIcon: this.get('status icon label')
          };
        }
      }
    };
  }

  get isVersionChecker () {
    return true;
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
    if (this.world().sceneGraph && this.world().sceneGraph.owner) {
      this.bottomLeft = this.world().visibleBounds().bottomLeft()
        .withX(this.world().sceneGraph.right)
        .addXY(padding, -padding)
        .subXY(dragAreaWidth, 0);
    } else {
      this.bottomLeft = this.world().visibleBounds().insetBy(padding).bottomLeft();
    }
  }

  async checkIfUpToDate () {
    const headHashCmd = 'git rev-parse @';
    // See https://stackoverflow.com/a/27940027 for how this works
    const comparingCmd = 'git rev-list --left-right --count origin/main...@';
    const cwd = await evalOnServer('System.baseURL').then(cwd => cwd.replace('file://', ''));

    let hash, comparison;
    try {
      ({ stdout: hash } = await runCommand(headHashCmd, { cwd }).whenDone());
      ({ stdout: comparison } = await runCommand(comparingCmd, { cwd }).whenDone());
    } catch (err) {
      this.showError();
      return;
    }
    hash = hash.slice(0, 6);
    comparison = comparison.replace('\n', '').split('\t');
    const numberOfUniqueCommitsOnRemote = parseInt(comparison[0]);
    const numberOfUniqueCommitsLocal = parseInt(comparison[1]);
    if (numberOfUniqueCommitsOnRemote === 0 && numberOfUniqueCommitsLocal === 0) return this.showEven(hash);
    if (numberOfUniqueCommitsOnRemote !== 0 && numberOfUniqueCommitsLocal === 0) return this.showBehind(hash);
    if (numberOfUniqueCommitsOnRemote === 0 && numberOfUniqueCommitsLocal !== 0) return this.showAhead(hash);
    return this.showDiverged(hash);
  }

  showEven (version) {
    const { status } = this.ui;
    status.value = ['Version: ', {}, `[${version}]`, { fontWeight: 'bold' }];
    this.updateShownIcon('even');
  }

  showBehind (version) {
    const { status } = this.ui;
    status.value = ['Version: ', {}, `[${version}]`, { fontWeight: 'bold' }, ' (Please update!)'];
    this.updateShownIcon('behind');
  }

  showAhead (version) {
    const { status } = this.ui;
    status.value = ['Version: ', {}, `[${version}]`, { fontWeight: 'bold' }];
    this.updateShownIcon('ahead');
  }

  showDiverged (version) {
    const { status } = this.ui;
    status.value = ['Version: ', {}, `[${version}]`, { fontWeight: 'bold' }, ' (Please update!)'];
    this.updateShownIcon('diverged');
  }

  showError () {
    const { status } = this.ui;
    status.value = 'Error while checking';
    this.updateShownIcon('error');
  }

  updateShownIcon (mode) {
    const { checking, statusIcon } = this.ui;
    switch (mode) {
      case 'checking': {
        checking.visible = checking.isLayoutable = true;
        statusIcon.visible = statusIcon.isLayoutable = false;
        return;
      }
      case 'even': {
        statusIcon.textAndAttributes = Icon.textAttribute('check-circle');
        statusIcon.fontColor = Color.rgb(40, 180, 99);
        break;
      }
      case 'ahead': {
        statusIcon.textAndAttributes = Icon.textAttribute('arrow-up');
        statusIcon.fontColor = Color.rgb(72, 152, 243);
        break;
      }
      case 'diverged': {
        statusIcon.textAndAttributes = Icon.textAttribute('arrows-up-down');
        statusIcon.fontColor = Color.rgb(231, 76, 60);
        break;
      }
      case 'error': {
        statusIcon.textAndAttributes = Icon.textAttribute('exclamation-triangle');
        statusIcon.fontColor = Color.rgb(231, 76, 60);
        break;
      }
      case 'behind': {
        statusIcon.textAndAttributes = Icon.textAttribute('arrow-down');
        statusIcon.fontColor = Color.rgb(231, 76, 60);
        break;
      }
    }
    checking.visible = checking.isLayoutable = false;
    statusIcon.visible = statusIcon.isLayoutable = true;
  }

  reset () {
    const { status } = this.ui;
    status.value = 'Checking version...';
    this.updateShownIcon('checking');
  }
}

const LivelyVersionChecker = component({
  type: VersionChecker,
  name: 'lively version checker',
  borderColor: Color.rgb(23, 160, 251),
  borderRadius: 5,
  extent: pt(135.5, 25.1),
  fill: Color.rgba(0, 0, 0, 0.6),
  hasFixedPosition: true,
  layout: new TilingLayout({
    axis: 'row',
    axisAlign: 'left',
    align: 'left',
    orderByIndex: true,
    hugContentsHorizontally: true,
    hugContentsVertically: true,
    wrapSubmorphs: false,
    padding: {
      height: 0,
      width: 0,
      x: 5,
      y: 5
    },
    reactToSubmorphAnimations: false,
    spacing: 5
  }),
  nativeCursor: 'pointer',
  position: pt(535, 438.4),
  submorphs: [{
    type: Label,
    fill: Color.transparent,
    name: 'version status label',
    fontColor: Color.rgb(253, 254, 254),
    lineHeight: 1.2,
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
    scale: 0.22
  }, {
    type: Label,
    name: 'status icon label',
    fontSize: 14,
    lineHeight: 1.1,
    fontColor: Color.rgb(231, 76, 60),
    fill: Color.transparent,
    isLayoutable: false,
    textAndAttributes: Icon.textAttribute('exclamation-triangle'),
    visible: false
  }]
});

export { LivelyVersionChecker, VersionChecker };
