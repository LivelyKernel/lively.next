/* global location */
import { component, Text, part, TilingLayout, Morph, Icon, Label } from 'lively.morphic';
import { evalOnServer } from 'lively.freezer/src/util/helpers.js';
import { Color, pt } from 'lively.graphics';

import { runCommand } from '../shell/shell-interface.js';

import { guardNamed } from 'lively.lang/function.js';
import { Spinner } from './shared.cp.js';
import { disconnect, connect } from 'lively.bindings';
import L2LClient from 'lively.2lively/client.js';
import { bounceEasing } from 'lively.morphic/rendering/animations.js';
import { delay } from 'lively.lang/promise.js';

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
            copyButton: this.get('commit id copier'),
            updateButton: this.get('update button'),
            updateButtonWrapper: this.get('update button wrapper')
          };
        }
      }
    };
  }

  static async currentLivelyVersion (main) {
    const cwd = await VersionChecker.cwd();
    const fetchCmd = 'git fetch';
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

  async updateLively () {
    $world.withAllSubmorphsDo(m => m.blur = 3);
    let li = $world.showLoadingIndicatorFor($world, 'Updating lively');

    const cwd = await VersionChecker.cwd();
    const currentClientCommit = await VersionChecker.currentLivelyVersion(true); 

    /**
     * Two types of timing issues can occur:
     * 1. We try to send something to the server-side client that itself is not yet online.
     * 2. We try to use the `check git version` servive of the server-side client, but the service has not yet been installed.
     * For both cases, we allow for retrying 20 times in total. We thus have a grace period of at least 40 seconds for the **service** to come online.
     */
    async function checkIfNewServer (retries = 20) {
      const backoffTime = 2000;
      const peers = await L2LClient.default().listPeers()
      const gitVersionCheckerOnServer = peers.find(peer => peer.type === 'git version checker');
      if (!gitVersionCheckerOnServer) {
        // The L2LClient for Version Checking is not yet online. Try again later.
        if (retries){
          setTimeout(checkIfNewServer(retries - 1), backoffTime);
          return;
        }
        throw(new Error('Timing Issue during automatic restart of lively.next. You need to restart lively manually!'));
      }
      const sameServerVersion = await L2LClient.default().sendAndWait({ target: gitVersionCheckerOnServer.id, action: 'check git version', data: { payload: currentClientCommit } });
      if (sameServerVersion.data) {
        if (sameServerVersion.data.isError && sameServerVersion.data.error === 'message not understood: check git version'){
          // The L2LClient for Version Checking is online, but the version checking service is not yet installed. Try again later.
          // This case can occur since the Client comes online, is used to retrieve the currently running server version and only afterwards the service to compare against this version is installed.
          if (retries) {
            setTimeout(checkIfNewServer(retries - 1), backoffTime);
            return
          }
          throw(new Error('Timing Issue during automatic restart of lively.next. You need to restart lively manually!'));
        }
        // noop, server has not yet restarted with newer version yet
      } else {
        li.remove();
        // QOL - When one cancels the reload (which the average user should not do), one gets spammed with the reload modal otherwise
        disconnect(L2LClient.default(), 'onReconnect');
        await $world.inform('Press OK to reload this page and finish the update.');
        location.reload();
      }
    }
    connect(L2LClient.default(), 'onReconnect', checkIfNewServer);

    const updateStatus = new Text({
      name: 'update status',
      fill: Color.white,
      extent: pt(300, 300),
      clipMode: 'auto',
      lineWrapping: 'by-words',
      position: pt(li.center.x - 150, li.bottom + 10),
      hasFixedPosition: true,
      fixedWidth: true,
      fixedHeight: true,
      padding: 5,
      borderColor: Color.lively,
      borderWidth: 2,
      needsDocument: true,
      borderRadius: 5,
      halosEnabled: true
    });
    $world.addMorph(updateStatus);

    const cmd = runCommand('./update.sh', { cwd });
    connect(cmd, 'stdout', (output) => {
      updateStatus.textString = updateStatus.textString + output;
      updateStatus.gotoDocumentEnd();
      updateStatus.scrollCursorIntoView();
    });
  }

  async onMouseDown (evt) {
    super.onMouseDown(evt);
    if (evt.targetMorph === this.ui.status) {
      await this.updateLively();
      return;
    }
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

  async showBehind (version) {
    const cwd = await VersionChecker.cwd();
    const currentBranchCmd = 'git rev-parse --abbrev-ref HEAD';
    let currBranch = await runCommand(currentBranchCmd, { cwd }).whenDone();
    currBranch = currBranch.stdout.replace('\n', '');
    const { status, updateButtonWrapper } = this.ui;
    if (currBranch === 'main') {
      updateButtonWrapper.visible = updateButtonWrapper.isLayoutable = true;
      status.reactsToPointer = true;
      status.nativeCursor = 'pointer';
      this.bounceUpdateButton();
      status.value = ['Press here to update!', { fontWeight: 'bold' }];
      this.updateShownIcon('none');
    } else {
      status.value = ['Version: ', {}, `[${version}]`, { fontWeight: 'bold' }, ' (Please update!)'];
      this.updateShownIcon('behind');
    }
  }

  async bounceUpdateButton () {
    const { updateButton } = this.ui;
    await updateButton.animate({
      customTween: p => {
        updateButton.left = bounceEasing(p, 1, 10, 1);
      },
      easing: (t) => t
    });
    await updateButton.animate({ left: 0 });
    setTimeout(this.bounceUpdateButton.bind(this), 2500);
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
      case 'none': {
        checking.visible = checking.isLayoutable = false;
        statusIcon.visible = statusIcon.isLayoutable = false;
        return;
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
    name: 'update button wrapper',
    fill: Color.transparent,
    extent: pt(30, 0),
    clipMode: 'visible',
    isLayoutable: false,
    visible: false,
    submorphs: [
      {
        type: Label,
        name: 'update button',
        fontSize: 14,
        lineHeight: 1.1,
        fontColor: Color.lively,
        fill: Color.transparent,
        textAndAttributes: Icon.textAttribute('arrow-left')
      }]
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
