import { component, part, TilingLayout, Morph, Icon, Label } from 'lively.morphic';
import { evalOnServer } from 'lively.freezer/src/util/helpers.js';
import { Color, pt } from 'lively.graphics';

import { runCommand } from '../shell/shell-interface.js';

import { delay } from 'lively.lang/promise.js';
import { guardNamed } from 'lively.lang/function.js';
import { Spinner } from './shared.cp.js';

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
            statusIcon: this.get('status icon label'),
            copyButton: this.get('commit id copier')
          };
        }
      }
    };
  }

  static async currentLivelyVersion (main) {
    const cwd = await VersionChecker.cwd();
    const fetchCmd = `git fetch`
    await runCommand(fetchCmd, { cwd }).whenDone();
    const hashCmd = main ? 'git merge-base origin/main HEAD' : 'git rev-parse @';
    const result = await runCommand(hashCmd, { cwd }).whenDone();
    return result.stdout.trim();
  }

  static async cwd () {
    return await evalOnServer('System.baseURL').then(cwd => cwd.replace('file://', ''));
  }

  get isVersionChecker () {
    return true;
  }

  onLoad () {
    if (!this.isComponent) {
      this.withAllSubmorphsDo(m => m.halosEnabled = false);
    }
  }

  async checkVersion () {
    this.reset();
    await this.displayLivelyVersionStatus();
  }

  onMouseDown (evt) {
    super.onMouseDown(evt);
    if (evt.targetMorph.name === 'commit id copier') {
      guardNamed('copying', async () => {
        navigator.clipboard.writeText(this.hash);
        await this.ui.copyButton.animate({
          duration: 500,
          fontColor: Color.green
        })
          .then(() => delay(2000))
          .then(() => this.ui.copyButton.animate({
            duration: 500,
            fontColor: Color.rgb(152, 152, 152)
          }));
      })();
      return;
    }
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

  /**
   * If no parameters are given, checks the relation between the current commit and the main of the official lively.next repository.
   * If only the first parameter is given, checks the relation between the current commit and the given one.
   * If the second parameter ist set to true, we compare the newest commit that is shared between main and the currently checked out branch with the first parameter.
   * This option is meant to make working with Projects on feature branches easier.
   * @param {string} hashToCheckAgainst
   * @param {boolean} compareLatestAncestor
   */
  static async checkVersionRelation (hashToCheckAgainst, compareLatestAncestor) {
    const cwd = await VersionChecker.cwd();
    let currentLivelyVersion, comparison;
    currentLivelyVersion = await VersionChecker.currentLivelyVersion();
    let commonAncestor;
    if (compareLatestAncestor) {
      const findLatestMainAncestorCmd = 'git merge-base origin/main HEAD';
      ({ stdout: commonAncestor } = await runCommand(findLatestMainAncestorCmd, { cwd }).whenDone());
      commonAncestor = commonAncestor.trim();
    }
    // See https://stackoverflow.com/a/27940027 for how this works
    if (!hashToCheckAgainst) hashToCheckAgainst = 'origin/main';
    const comparingCmd = `git rev-list --left-right --count ${hashToCheckAgainst}...${compareLatestAncestor ? commonAncestor : '@'}`;
    ({ stdout: comparison } = await runCommand(comparingCmd, { cwd }).whenDone());
    return { comparison, hash: currentLivelyVersion };
  }

  /**
   * Returns 0 when both compared commits are equal, -1 when the current version is behind, 1 when one is ahead.
   * Returns 2 when both compared versions are diverged.
   */
  static parseHashComparison (comparison) {
    comparison = comparison.replace('\n', '').split('\t');
    const numberOfUniqueCommitsOnRemote = parseInt(comparison[0]);
    const numberOfUniqueCommitsLocal = parseInt(comparison[1]);
    if (numberOfUniqueCommitsOnRemote === 0 && numberOfUniqueCommitsLocal === 0) return 0;
    if (numberOfUniqueCommitsOnRemote !== 0 && numberOfUniqueCommitsLocal === 0) return -1;
    if (numberOfUniqueCommitsOnRemote === 0 && numberOfUniqueCommitsLocal !== 0) return 1;
    return 2;
  }

  async displayLivelyVersionStatus () {
    let { hash, comparison } = await VersionChecker.checkVersionRelation();
    // we need to do this here, since the other possible places are static
    this.hash = hash;
    if (!(hash && comparison)) {
      this.showError();
      return;
    }
    hash = hash.slice(0, 6);
    const comparisonResult = VersionChecker.parseHashComparison(comparison);
    switch (comparisonResult) {
      case (0): this.showEven(hash); break;
      case (1): this.showAhead(hash); break;
      case (-1): this.showBehind(hash); break;
      case (2): this.showDiverged(hash);
    }
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
    orderByIndex: true,
    hugContentsHorizontally: true,
    hugContentsVertically: true,
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
  }, part(Spinner, {
    name: 'loading indicator',
    extent: pt(83.7, 68.1),
    fill: Color.rgba(255, 255, 255, 0),
    scale: 0.22
  }), {
    type: Label,
    name: 'status icon label',
    fontSize: 14,
    lineHeight: 1.1,
    fontColor: Color.rgb(231, 76, 60),
    fill: Color.transparent,
    isLayoutable: false,
    textAndAttributes: Icon.textAttribute('exclamation-triangle'),
    visible: false
  },
  {
    type: Label,
    name: 'commit id copier',
    nativeCursor: 'pointer',
    fontSize: 14,
    lineHeight: 1.1,
    fontColor: Color.rgb(148, 152, 166),
    fill: Color.transparent,
    textAndAttributes: Icon.textAttribute('copy')
  }]
});

export { LivelyVersionChecker, VersionChecker };
