/* global SERVER_URL */
/* global FormData */
/* eslint-disable no-use-before-define */
import { easings, ViewModel, touchInputDevice, World, MorphicDB, Image, HTMLMorph, Morph, Icon, TilingLayout, Label, ConstraintLayout, ShadowObject, component, part } from 'lively.morphic';
import { Color, LinearGradient, rect, pt } from 'lively.graphics/index.js';
import { arr, promise, fun, graph, date, string } from 'lively.lang/index.js';
import { GreenButton, ConfirmPrompt, RedButton, PlainButton } from 'lively.components/prompts.cp.js';
import { MorphList } from 'lively.components/list.cp.js';
import * as LoadingIndicator from 'lively.components/loading-indicator.cp.js';
import { Spinner } from './shared.cp.js';
import { SystemList } from '../styling/shared.cp.js';
import { ModeSelector } from 'lively.components/widgets/mode-selector.cp.js';
import { SearchField } from 'lively.components/inputs.cp.js';
import { Project } from 'lively.project';
import { without, add } from 'lively.morphic/components/core.js';
import { Text } from 'lively.morphic/text/morph.js';
import { Path } from 'lively.morphic/morph.js';
import { Rectangle } from 'lively.graphics/geometry-2d.js';
import { GitHubAPIWrapper } from 'lively.git';
import { currentUserToken, isUserLoggedIn } from 'lively.user';
import { resource } from 'lively.resources';
import { defaultDirectory } from 'lively.ide/shell/shell-interface.js';
import { signal } from 'lively.bindings';
import { StatusMessageError } from 'lively.halos/components/messages.cp.js';
import { config } from 'lively.morphic';

export const missingSVG = `data:image/svg+xml;utf8,
<svg aria-hidden="true" focusable="false" data-prefix="far" data-icon="question-circle" class="svg-inline--fa fa-question-circle fa-w-16" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="lightgray" d="M256 8C119.043 8 8 119.083 8 256c0 136.997 111.043 248 248 248s248-111.003 248-248C504 119.083 392.957 8 256 8zm0 448c-110.532 0-200-89.431-200-200 0-110.495 89.472-200 200-200 110.491 0 200 89.471 200 200 0 110.53-89.431 200-200 200zm107.244-255.2c0 67.052-72.421 68.084-72.421 92.863V300c0 6.627-5.373 12-12 12h-45.647c-6.627 0-12-5.373-12-12v-8.659c0-35.745 27.1-50.034 47.579-61.516 17.561-9.845 28.324-16.541 28.324-29.579 0-17.246-21.999-28.693-39.784-28.693-23.189 0-33.894 10.977-48.942 29.969-4.057 5.12-11.46 6.071-16.666 2.124l-27.824-21.098c-5.107-3.872-6.251-11.066-2.644-16.363C184.846 131.491 214.94 112 261.794 112c49.071 0 101.45 38.304 101.45 88.8zM298 368c0 23.159-18.841 42-42 42s-42-18.841-42-42 18.841-42 42-42 42 18.841 42 42z"></path></svg>
`;

class WorldVersion extends Morph {
  static get properties () {
    return {
      commit: {},
      fill: { defaultValue: Color.transparent },
      info: {
        derived: true,
        get () {
          const { _id, message, name, timestamp } = this.commit;
          return [`${_id.slice(0, 6)} `, { fontWeight: 'bold' },
                  `${string.truncate(message.split('\n')[0], 40)} `, {},
                  ` (${name} `, {},
                  `${date.format(new Date(timestamp), 'yyyy-mm-dd HH:MM Z')}`, {}];
        }
      },
      selected: {
        set (active) {
          this.setProperty('selected', active);
          this.update();
        }
      },
      layout: {
        initialize () {
          this.layout = new TilingLayout({ axis: 'column', align: 'left', wrapSubmorphs: true, spacing: 5 });
        }
      },
      submorphs: {
        initialize () {
          this.submorphs = [
            {
              type: 'image',
              extent: pt(30, 30),
              name: 'preview',
              reactsToPointer: false
            },
            {
              reactsToPointer: false,
              type: 'label',
              fill: null,
              name: 'commit info',
              fontFamily: 'IBM Plex Sans',
              fontColor: Color.gray
            }
          ];
        }
      }
    };
  }

  update () {
    const [preview, infoLabel] = this.submorphs;
    preview.imageUrl = this.commit.preview || missingSVG;
    infoLabel.textAndAttributes = this.info;
    infoLabel.fontColor = this.selected ? Color.white : Color.darkGray;
  }
}

class ProjectBranch extends Morph {
  static get properties () {
    return {
      fill: { defaultValue: Color.transparent },
      branchName: { },
      isDefaultBranch: { },
      isRemote: { },
      isLocal: { },
      isCheckedOut: { },
      selected: {
        set (active) {
          this.setProperty('selected', active);
          this.update();
        }
      },
      layout: {
        initialize () {
          this.layout = new TilingLayout({ axis: 'column', align: 'left', wrapSubmorphs: true, spacing: 5, padding: Rectangle.inset(10, 5, 10, 5) });
        }
      },

      submorphs: {
        initialize () {
          this.submorphs = [
            {
              type: Label,
              extent: pt(30, 30),
              name: 'preview',
              textAndAttributes: Icon.textAttribute('code-branch'),
              textAlign: 'right',
              fontSize: 20,
              reactsToPointer: false
            },
            {
              reactsToPointer: false,
              type: 'label',
              fill: null,
              name: 'commit info',
              fontFamily: 'IBM Plex Sans',
              fontColor: Color.gray
            }
          ];
        }
      }
    };
  }

  update () {
    const { branchName, isCheckedOut, isLocal, isRemote, isDefaultBranch } = this;
    this.getSubmorphNamed('commit info').textAndAttributes = [
      `${isDefaultBranch ? ' ' : ''}`, { fontFamily: 'Font Awesome', fontWeight: '900' },
      `${branchName} `, { fontWeight: 'bold' },
      `${isCheckedOut ? '\n' : '\n'}`, { fontFamily: 'Font Awesome', fontWeight: '400' },
      `${isLocal ? ' ' : ''}`, { fontFamily: 'Font Awesome', fontWeight: '900' },
      `${isRemote ? ' ' : ''}`, { fontFamily: 'Font Awesome Brands', fontWeight: '400' }
    ];
    this.getSubmorphNamed('preview').fontColor = this.selected ? Color.white : Color.black;
    this.getSubmorphNamed('commit info').fontColor = this.selected ? Color.white.withA(.9) : Color.darkGray;
  }
}

export default class WorldVersionViewer extends Morph {
  reset () {
    this.getSubmorphNamed('version list').items = [];
    this.getSubmorphNamed('version list spinner').visible = false;
    this.visible = false;
    this.layoutable = false;
  }

  onMouseDown (evt) {
    switch (evt.targetMorph.name) {
      case 'visit button':
        this.visitSelectedCommit();
        break;
      case 'revert button':
        this.revertToSelectedCommit();
        break;
    }
  }

  async visitSelectedCommit () {
    const commit = this.get('version list').selection;
    const i = LoadingIndicator.open(`Loading ${commit.name}...`);
    const oldWorld = $world;

    const morphicDB = this.db || MorphicDB.default;
    const commitId = commit._id;

    try {
      const newWorld = commitId
        ? await World.loadFromCommit(commitId, undefined, { morphicDB })
        : await World.loadFromDB(commit.name, commit.ref, undefined, { morphicDB });

      // if (worldList) {
      //   worldList.onWorldLoaded(newWorld, oldWorld);
      // }

      return newWorld;
    } catch (err) {
      console.error(err); // eslint-disable-line no-console
      oldWorld.showError('Error loading world:' + err);
    } finally { i.remove(); }
  }

  async revertToSelectedCommit () {
    const commit = this.get('version list').selection;
    if (!commit) return;
    const db = this.db || MorphicDB.default;
    const { _id, name, type } = commit;
    await db.revert(type, name, _id, /* ref = */'HEAD');
    return this.initializeFromStartCommit(commit, db, { showRevertButton: true });
  }

  async initializeFromStartCommit (startCommit, db = MorphicDB.default, opts = {}) {
    // startCommit = that.metadata.commit;
    const {
      indicateStartCommit = true,
      showRefs = true
      // showRevertButton = false,
      // showVisitButton = false
    } = opts;
    const { _id, type, name } = (this.startCommit = startCommit);
    const spinner = this.getSubmorphNamed('version list spinner');
    spinner.visible = true;
    spinner.center = this.get('version list').center;
    this.db = db;

    const { refs, history } = await db.history(type, name);
    let startCommitId = _id;

    const fwdHist = graph.invert(history);
    const ancestors = graph.hull(fwdHist, _id);

    const knownCommits = { _id: true }; const ancestorCommits = [startCommit];
    for (const id of ancestors) {
      const newCommits = await db.log(id, undefined, /* includeCommits = */true, knownCommits);
      ancestorCommits.push(...newCommits);
      newCommits.forEach(ea => knownCommits[ea._id] = true);
    }

    const newestCommit = arr.max(ancestorCommits, ea => ea.timestamp);
    startCommitId = newestCommit._id;

    // if (graph.hull(history, refs["HEAD"]).includes(_id)) {
    //   startCommitId = refs["HEAD"];
    // } else {
    //   let allRefs = arr.without(Object.keys(refs), "HEAD");
    //   let startRef = allRefs.find(ea => graph.hull(history, refs[ea]).includes(_id));
    //   if (startRef) startCommitId = refs[startRef];
    // }

    const commits = await db.log(startCommitId, undefined, /* includeCommits = */true);
    const shaToRef = {}; let maxRefLength = 0;
    if (showRefs) {
      for (const ref in refs) {
        shaToRef[refs[ref]] = ref;
        maxRefLength = Math.max(ref.length, maxRefLength);
      }
    }

    // do this via appearance of the item morphs (extraction)
    if (indicateStartCommit) {
      if (shaToRef[_id]) shaToRef[_id] = '=> ' + shaToRef[_id];
      else shaToRef[_id] = '=>';
      maxRefLength = Math.max(shaToRef[_id].length, maxRefLength);
    }

    const items = commits.map(ea => {
      // replace this by an actual world version morph
      const morph = new WorldVersion({
        reactsToPointer: false,
        commit: ea
      });
      morph.update();
      return {
        isListItem: true,
        morph,
        value: ea
      };
    });
    this.get('version list').items = items;
    spinner.visible = false;
  }
}

class ProjectVersionViewer extends WorldVersionViewer {
  async initializeFromStartCommit () {
    const spinner = this.getSubmorphNamed('version list spinner');
    spinner.visible = true;

    const { _projectName, _projectOwner } = this.owner._project;

    let notOnGithub, githubBranches, repoInfos;

    if (!lively.isInOfflineMode) {
      if (!isUserLoggedIn()) {
        $world.setStatusMessage('Login to retrieve more information from GitHub.', StatusMessageError);
        $world.get('user flap').show();
      } else {
        // used to figure out the default branch on github or if no repo exists at all
        repoInfos = await GitHubAPIWrapper.remoteRepoInfos(_projectOwner, _projectName);
        notOnGithub = repoInfos.message === 'Not Found';
        // retrieves all branches that exist remotely
        if (!notOnGithub) githubBranches = await GitHubAPIWrapper.listGithubBranches(_projectOwner, _projectName);
      }
    }

    const gitRes = await Project.ensureGitResource(`${_projectOwner}--${_projectName}`);
    // This is a bit of a leaky abstraction, as this will also identify remote branches based on the setup tracking.
    // When using lively the intended way, this is not a problem, but when deleting the repository on GitHub without
    // using lively, this will create a situation where there are remotes shown in lively but they not longer actually exist.
    // Minor problem for now.
    const repoBranches = await gitRes.branchesInRepository();

    const branches = [...repoBranches];
    !lively.isInOfflineMode && !notOnGithub && isUserLoggedIn() && githubBranches.forEach(branchName => {
      const foundBranch = branches.find(b => b.name === branchName);
      if (foundBranch) foundBranch.remote = true;
      else {
        branches.push({
          name: branchName,
          remote: true
        });
      }
    });

    const items = branches.map(b => {
      const morph = new ProjectBranch({
        reactsToPointer: false,
        // used to populate list entry label
        branchName: b.name,
        isRemote: b.remote,
        isLocal: b.local,
        isCheckedOut: b.checkedOut,
        isDefaultBranch: b.name === repoInfos?.default_branch
      });
      morph.update(); // generate label
      return {
        isListItem: true,
        morph,
        value: b
      };
    });

    const list = this.get('version list');
    list.items = items;
    list.selection = list.items.find(i => i.value.checkedOut);

    spinner.visible = false;
  }

  async visitSelectedCommit () {
    const spinner = this.getSubmorphNamed('version list spinner');
    spinner.visible = true;

    const localRepo = await Project.ensureGitResource(this.owner._project._name);
    const branchToUse = this.get('version list').selection;
    await localRepo.runCommand(`git stash -m "stashed-while-switching-to-branch-${branchToUse.name}"`).whenDone();
    // We need to create a local branch.
    if (!branchToUse.local) {
      await localRepo.fetch();
      await localRepo.createAndCheckoutBranch(branchToUse.name, true);
    } else {
      await localRepo.runCommand(`git switch ${branchToUse.name}`).whenDone();
    }

    const stashApplicationCommand = localRepo.runCommand(`git stash apply stash^{/stashed-while-switching-to-branch-${branchToUse.name}}`);
    await stashApplicationCommand.whenDone();
    // Successful stash application means we have created a stash that we need to clean up.
    if (stashApplicationCommand.exitCode === 0) {
      await localRepo.runCommand('git stash drop').whenDone();
    }
    if (stashApplicationCommand.exitCode !== 0 && !stashApplicationCommand.stderr.includes('is not a valid reference')) {
      console.warn('Stash application failed due to conflict. Aborting stash application.'); // eslint-disable-line no-console
      await localRepo.runCommand('git reset --hard').whenDone();
    }
    spinner.visible = false;
    this.owner.openEntity();
  }
}

export class TitleWrapper extends Morph {
  static get properties () {
    return {
      maxLength: { defaultValue: 18 },
      title: {
        derived: true,
        get () {
          let title = this.getProperty('title');
          if (!title) title = this.submorphs[0]?.textString;
          return title;
        },
        set (title) {
          this.setProperty('title', title);
          if (title) { this.submorphs[0].textString = string.truncate(title, 18, '...'); }
        }
      }
    };
  }

  startMovingRight () {
    this.animate({
      customTween: p => { this._hoverDelta = p; }
    });
  }

  stopMovingRight () {
    this.animate({
      customTween: p => { this._hoverDelta = 1 - p; }
    });
  }

  startMovingLeft () {
    this.animate({
      customTween: p => { this._hoverDelta = -p; }
    });
  }

  stopMovingLeft () {
    this.animate({
      customTween: p => { this._hoverDelta = -1 + p; }
    });
  }

  async startOnce (fn) {
    if (this._fn) return;
    this._fn = fn;
    await fn();
    this._fn = null;
  }

  updateTitle () {
    if (!this.title) return;
    const [title] = this.submorphs;
    title.left += this._hoverDelta;
    if (title.right < this.width - 20 && this._hoverDelta === -1) {
      // do not enter this block twice
      this.startOnce(async () => {
        await this.stopMovingLeft();
        await this.startMovingRight();
      });
    } else if (title.left > 20 && this._hoverDelta === 1) {
      // do not enter this block twice
      this.startOnce(async () => {
        await this.stopMovingRight();
        await this.startMovingLeft();
      });
    }
  }

  async startShowingFullTitle () {
    if (!this.title) return;
    const [title] = this.submorphs;
    title.textString = this.title;
    this._hoverDelta = 0;
    this.startStepping('updateTitle');
    if (title.right > this.width) { this.startMovingLeft(); }
  }

  stopShowingFullTitle () {
    if (!this.title) return;
    const title = this.submorphs[0];
    title.textString = string.truncate(this.title, this.maxLength, '...');
    this.stopStepping('updateTitle');
    this._hoverDelta = 0;
    title.left = 0;
  }

  onHoverIn (evt) {
    super.onHoverIn(evt);
    this.startShowingFullTitle();
  }

  onHoverOut (evt) {
    super.onHoverOut(evt);
    this.stopShowingFullTitle();
  }
}

export class StaticText extends HTMLMorph {
  static get properties () {
    return {
      html: {
        isStyleProp: false
      },
      fontSize: {
        type: 'Number',
        set (s) {
          this.setProperty('fontSize', s);
          this.refresh();
        }
      },
      fontColor: {
        type: 'Color',
        set (c) {
          this.setProperty('fontColor', c);
          this.refresh();
        }
      },
      fontFamily: {
        type: 'Enum',
        set (f) {
          this.setProperty('fontFamily', f);
          this.refresh();
        }
      },
      value: {
        set (v) {
          this.setProperty('value', v);
          this.refresh();
        }
      }
    };
  }

  refresh () {
    this.html = `<span style="line-height: 1.3; font-size: ${this.fontSize}px; color: ${this.fontColor}; font-family: ${this.fontFamily}">${this.value}</span>`;
  }
}

export class WorldBrowserModel extends ViewModel {
  static get properties () {
    return {
      expose: {
        get () {
          return ['alignInWorld', 'keybindings', 'commands', 'displayItems', 'allFontsLoaded', 'fadeOut', 'progressIndicator'];
        }
      },
      bindings: {
        get () {
          return [
            { target: 'close button', signal: 'onMouseDown', handler: 'close' },
            { target: 'search field', signal: 'searchInput', handler: 'displayItems' },
            { target: 'new project button', signal: 'onMouseDown', handler: 'createNewProject' },
            { target: 'mode selector', signal: 'selectionChanged', handler: 'modeChanged' },
            { target: 'open snapshot button', signal: 'onMouseDown', handler: 'chooseAndOpenSnapshot' }
          ];
        }
      },
      progressIndicator: {},
      playgroundsMode: {
        defaultValue: false
      },
      showCloseButton: {
        defaultValue: true
      },
      db: {
        serialize: false,
        get () { return MorphicDB.default; }
      }

    };
  }

  async chooseAndOpenSnapshot () {
    const pickerOpts = {
      types: [
        {
          description: 'lively.next Playground Snaphot',
          accept: {
            'application/json': ['.json']
          }
        }
      ],
      excludeAcceptAllOption: true
    };

    const files = await window.showOpenFilePicker(pickerOpts);
    if (files.length === 0) return;
    if (files.length > 1) {
      $world.setStatusMessage('You can only open one snapshot at a time!');
      return;
    }
    const file = await files[0].getFile();
    const snapshotInFolder = await resource(System.baseURL).join('../snapshots/').join(file.name).withRelativePartsResolved().exists();
    // "copy" (upload, as we are going through the server) into the lively.next/snapshots directory in order to open it
    if (!snapshotInFolder) {
      const fd = new FormData();
      fd.append('file', file, file.name);
      const res = resource(System.baseURL).join(`../upload?uploadPath=${encodeURIComponent('/snapshots/')}`).withRelativePartsResolved();
      await res.write(fd);
    }
    await this.fadeOut();
    const { bootstrap } = await System.import('lively.freezer/src/util/bootstrap.js');
    await bootstrap({ filePath: `snapshots/${file.name}`, fastLoad: !lively.doNotUseFastLoad, progress: this.progressIndicator });
  }

  async fadeOut () {
    const { view } = this;
    signal(view, 'fadingOut');
    const center = view.center;
    const easing = easings.outExpo;
    view.animate({
      scale: 1.3,
      opacity: 0,
      easing
    });
    await view.animate({
      center,
      easing
    });
    view.remove();
  }

  async onRefresh (prop) {
    if (prop === 'showCloseButton' && this.ui.closeButton) {
      this.updateCloseButtonVisibility();
    }
  }

  async confirm (title, text) {
    const prompt = part(ConfirmPrompt, { viewModel: { title, text } }).openInWorld();
    prompt.center = this.view.center;
    return promise.promise(prompt.activate());
  }

  async toggleFader (onlyOff) {
    if (this.fader) {
      await this.fader.animate({
        duration: 500,
        easing: easings.inOutSine,
        opacity: 0
      });
      this.fader.remove();
      this.fader = null;
      return false;
    } else {
      if (onlyOff) return false;
      this.fader = new Morph({
        name: 'world browser fader',
        extent: this.view.extent,
        position: this.view.position,
        hasFixedPosition: true,
        fill: Color.black,
        borderRadius: this.view.borderRadius,
        opacity: 0
      }).openInWorld();
      this.fader.bringToFront();
      await this.fader.animate({
        duration: 200,
        easing: easings.inOutSine,
        opacity: 0.6
      });
      return true;
    }
  }

  async updateCloseButtonVisibility () {
    await this.ui.closeButton.whenRendered();
    this.ui.closeButton.visible = this.showCloseButton;
  }

  close () {
    if (this.showCloseButton === false) return;
    this.toggleFader(true);
    this.view.remove();
  }

  async viewDidLoad () {
    if (lively.FreezerRuntime) {
      const localconfigContent = await resource(SERVER_URL + '/localconfig.js').read();
      if (localconfigContent.replaceAll(' = ', '=').includes('config.hideScrollbarsInWorldBrowser=true')) config.hideScrollbarsInWorldBrowser = true;
    }
    await this.displayItems();
    this.onRefresh('showCloseButton');
  }

  async modeChanged (mode) {
    const label = this.ui.newProjectButton.submorphs[0];
    if (mode === 'Playgrounds') {
      this.playgroundsMode = true;
      label.textAndAttributes = label.textAndAttributes.slice(0, -1).concat('NEW PLAYGROUND');
      this.ui.noWorldWarning.textAndAttributes = ['There are no playgrounds yet. Create one!', null];
      this.ui.openSnapshotButton.reactsToPointer = true;
      this.ui.openSnapshotButton.opacity = 1;
    }
    if (mode === 'Projects') {
      this.playgroundsMode = false;
      label.textAndAttributes = label.textAndAttributes.slice(0, -1).concat('NEW PROJECT');
      this.ui.noWorldWarning.textAndAttributes = ['There are no projects yet. Create one!', null];
      this.ui.openSnapshotButton.reactsToPointer = false;
      this.ui.openSnapshotButton.opacity = 0;
    }
    await this.displayItems();
  }

  beforePublish () {
    this.reset();
  }

  reset () {
    this.ui.worldList.items = [];
    this.ui.noWorldWarning.visible = false;
    this.ui.noMatchWarning.visible = false;
    this.previews = [];
  }

  relayout () {
    this.alignInWorld();
  }

  alignInWorld (world = $world) {
    const { view } = this;
    if (view.owner !== world) world.addMorph(view);
    view.center = world.visibleBounds().center();
  }

  sortAndFilterPreviews (previews) {
    return previews.filter(p => this.ui.searchField.matches((p._project?._projectName + p._project?._projectOwner + p._project?.author?.name + p._project?.description) || (p._commit.name + p._commit.description)));
  }

  updateList () {
    if (!this.previews) return;
    fun.debounceNamed('update item list' + this.view.id, 150, () => {
      this.ui.worldList.items = this.sortAndFilterPreviews(this.previews);

      if (this.previews.length === 0) {
        this.ui.noWorldWarning.animate({
          visible: true, duration: 300
        });
        return;
      } else this.ui.noWorldWarning.visible = false;

      if (this.ui.worldList.items.length === 0) {
        this.ui.noMatchWarning.animate({ visible: true, duration: 300 });
      } else this.ui.noMatchWarning.visible = false;
    })();
  }

  async displayItems () {
    const { loadingIndicator, worldList } = this.ui;
    if (!loadingIndicator.visible) {
      await loadingIndicator.animate({
        visible: true, duration: 300
      });
    }
    let entities = this.playgroundsMode ? await this.db.latestCommits('world') : await Project.listAvailableProjects(true);
    this.reset();
    if (config.hideScrollbarsInWorldBrowser) worldList.clipMode = 'hidden';
    // Filter out the project that is opened anyways.
    if ($world && $world.openedProject) entities = entities.filter(availableProject => availableProject._projectName !== $world.openedProject.name);
    this.previews = entities.map(entity => {
      const placeholder = part(Placeholder);
      if (this.playgroundsMode) placeholder._commit = entity;
      else placeholder._project = entity;
      placeholder.displayPreview = () => {
        const preview = this.playgroundsMode
          ? part(WorldPreviewTile, { defaultViewModel: WorldPreviewModel, viewModel: { _commit: entity, _worldBrowser: this } })
          : part(ProjectPreviewTile, { viewModel: { _project: entity, _worldBrowser: this } });
        preview.dropShadow = null;
        preview.opacity = 0;
        preview.clipMode = 'hidden';
        placeholder.addMorph(preview);
        preview.displayPreview();
        preview.position = pt(0, 0);
        placeholder.layout = new TilingLayout({
          axis: 'column',
          reactToSubmorphAnimations: true
        });
      };
      return placeholder;
    });
    fun.debounceNamed('hide-ld-' + loadingIndicator.id, 300, () => {
      loadingIndicator.animate({
        visible: false, duration: 300
      });
    })();
    this.updateList();
  }

  async createNewProject () {
    if (this.playgroundsMode) document.location = '/worlds/load?name=__newWorld__';
    else document.location = '/projects/load?name=__newProject__';
  }

  allFontsLoaded () {
    return this.ui.newProjectButton.submorphs[0].whenFontLoaded();
  }

  get keybindings () {
    return [{ keys: 'Escape', command: 'close' }];
  }

  get commands () {
    return [
      {
        name: 'close',
        exec: () => this.close()
      }
    ];
  }
}

export class GrowingWorldList extends Morph {
  static get properties () {
    return {
      scrollContainer: {
        get () {
          return this.getSubmorphNamed('scroll container') || this.addMorph({
            name: 'scroll container',
            fill: null,
            reactsToPointer: false,
            renderOnGPU: true,
            layout: new TilingLayout({ spacing: 25, align: 'center', autoResize: true })
          });
        }
      },
      ui: {
        get () {
          return {
            bufferTop: this.getSubmorphNamed('buffer top'),
            bufferBottom: this.getSubmorphNamed('buffer bottom')
          };
        }
      },
      items: {
        after: ['layout', 'scrollContainer'],
        set (items) {
          this.setProperty('items', items);
          let scrollContainer = this.scrollContainer;
          scrollContainer.layout && scrollContainer.layout.disable();
          let { bufferTop, bufferBottom } = this.ui;
          arr.withoutAll(scrollContainer.submorphs, [...items, bufferTop, bufferBottom]).forEach(m => m.remove());
          this.update();
        }
      }
    };
  }

  // switch to a lazy list, that has items and adds them to the morph until it covers the whole
  // viewport. Then consecutively adds in batches of the current #[width / item.width] until all
  // items are consumed

  onScroll (evt) {
    super.onScroll(evt);
    this.update();
  }

  onChange (change) {
    super.onChange(change);
    if (change.prop === 'extent') {
      this.update();
    }
  }

  onHoverIn () { this.clipMode = 'auto'; }
  onHoverOut () { if (!touchInputDevice && config.hideScrollbarsInWorldBrowser) this.clipMode = 'hidden'; }

  // add top and bottom buffer

  update () {
    let items = this.items;
    if (!items || items.length === 0) return; // pre-initialize
    let scrollContainer = this.scrollContainer;
    let layoutSpacing = scrollContainer.layout.spacing;
    scrollContainer.extent = this.extent;
    let { bufferTop, bufferBottom } = this.ui;
    bufferTop = bufferTop || scrollContainer.addMorph({ fill: null, name: 'buffer top', height: 34 });
    bufferBottom = bufferBottom || scrollContainer.addMorph({ fill: null, name: 'buffer bottom', height: 10 });
    bufferTop.width = bufferBottom.width = this.width - 100;
    // assume that all items have the same width and height and use first element as sample
    let sample = items[0];
    let itemsPerRow = Math.floor(this.width / (sample.width + layoutSpacing));
    let rowsInView = Math.ceil((this.scroll.y + this.height) / (sample.height + layoutSpacing)) + 1;
    let itemsInView = items.slice(0, itemsPerRow * rowsInView);
    let itemsToBeAdded = itemsInView.filter(m => m.owner !== scrollContainer);
    let newItemOffset = (this.scroll.y + 2 * this.height);
    for (let item of itemsToBeAdded) {
      newItemOffset++;
      item.top = newItemOffset;
      scrollContainer.addMorph(item, scrollContainer.get('buffer bottom'));
      if (!item._initialized) {
        item._initialized = true;
        item.displayPreview();
      }
    }
    if (itemsToBeAdded.length > 0) {
      bufferBottom.top = this.submorphBounds().height;
    }
  }
}

export class WorldPreviewModel extends ViewModel {
  static get properties () {
    return {
      bindingsToInherit: {
        defaultValue: [
          { target: 'delete button', signal: 'onMouseDown', handler: 'tryToDelete' },
          { target: 'open button', signal: 'onMouseDown', handler: 'openEntity' },
          { signal: 'onHoverIn', handler: 'toggleDeleteButton', converter: () => true },
          { signal: 'onHoverOut', handler: 'toggleDeleteButton', converter: () => false },
          { target: 'close versions button', signal: 'onMouseDown', handler: 'hideVersions' },
          { target: 'version button', signal: 'onMouseDown', handler: 'showVersions' }
        ]
      },
      bindings: {
        get () {
          return this.bindingsToInherit;
        }
      },
      _commit: {},
      _worldBrowser: {},
      expose: {
        get () {
          return ['relayout', 'displayPreview', '_commit'];
        }
      }
    };
  }

  relayout () {
    this.view.setBounds(this.world().visibleBounds());
  }

  async displayPreview () {
    await this.initWithCommit(this._commit);
  }

  async initWithCommit (commit) {
    const {
      preview, timestamp, title, description, titleWrapper
    } = this.ui;
    this.opacity = 0.5;
    preview.imageUrl = commit.preview || missingSVG;
    let { name: authorName } = commit.author;
    authorName = authorName.startsWith('guest') ? 'guest' : authorName;
    timestamp.value = [authorName, { fontSize: 13, fontWeight: 'bold', paddingTop: '1px' }, date.format(commit.timestamp, ' - d.m.yy HH:MM'), {
      fontWeight: 'bold', fontSize: 12, paddingTop: '2px'
    }];
    title.value = titleWrapper.title = commit.name;
    description.value = commit.description;
    this.view.animate({ opacity: 1, duration: 300 });
  }

  openEntity () {
    this._worldBrowser.fadeOut();
    this.loadEntity();
  }

  loadEntity () {
    this.transitionToLivelyWorld(this._commit);
  }

  async transitionToLivelyWorld (commit, projectName) {
    const progress = this._worldBrowser.progressIndicator;
    const { bootstrap } = await System.import('lively.freezer/src/util/bootstrap.js');
    if (projectName) await bootstrap({ projectName, fastLoad: !lively.doNotUseFastLoad, progress });
    else await bootstrap({ commit, fastLoad: !lively.doNotUseFastLoad, progress });
  }

  get versionContainer () {
    return this.view.get('version container') || this.view.get('branch container');
  }

  async showVersions () {
    const duration = 200; const easing = easings.inOutExpo;
    const { previewContainer } = this.ui;
    const versionContainer = this.versionContainer;

    versionContainer.reactsToPointer = versionContainer.visible = true;
    versionContainer.initializeFromStartCommit(this._commit);
    this.view.animate({
      width: 515, duration, easing
    });
    previewContainer.animate({
      opacity: 0, duration
    });
    await versionContainer.animate({
      opacity: 1, duration
    });
    previewContainer.reactsToPointer = previewContainer.visible = false;
  }

  async hideVersions () {
    const duration = 200; const easing = easings.inOutExpo;
    const { previewContainer } = this.ui;
    const versionContainer = this.versionContainer;
    previewContainer.reactsToPointer = previewContainer.visible = true;
    this.view.animate({
      width: 245, duration, easing
    });
    previewContainer.animate({
      opacity: 1, duration
    });
    await versionContainer.animate({
      opacity: 0, duration
    });
    versionContainer.reset();
  }

  toggleDeleteButton (active) {
    const { deleteButton } = this.ui;
    deleteButton.visible = deleteButton.reactsToPointer = active;
  }

  async tryToDelete () {
    const proceed = await this._worldBrowser.confirm('Delete World', ['Do you really want to remove this world from the database? This step can not be undone.', { fontWeight: 'normal', fontSize: 16 }]);
    if (proceed) await this.confirmDelete();
  }

  async confirmDelete () {
    await MorphicDB.default.commit({ ...this._commit, content: undefined, snapshot: null });
    await this._worldBrowser.displayItems();
  }
}

class ProjectPreviewModel extends WorldPreviewModel {
  static get properties () {
    return {
      bindings: {
        get () {
          return [
            ...this.bindingsToInherit
          ];
        }
      },
      _project: { },
      expose: {
        get () {
          return ['_project', 'displayPreview', 'hideVersions', 'openEntity'];
        }
      }
    };
  }

  async displayPreview () {
    await this.initWithProject(this._project);
  }

  loadEntity () {
    const { _name } = this._project;
    this.transitionToLivelyWorld(null, _name);
  }

  initWithProject (project) {
    const {
      timestamp, title, description, titleWrapper
    } = this.ui;
    this.opacity = 0.5;
    let authorName = project.author.name;
    const name = project._name.replace(/[^\-]*--/, '');
    authorName = authorName.startsWith('guest') ? 'guest' : authorName;
    timestamp.value = project.isFork
      ? [
          '', {
            fontFamily: 'Font Awesome',
            fontSize: 13,
            fontWeight: '900',
            paddingTop: '1px'
          }, ' ' + ((project._projectOwner !== authorName) ? project._projectOwner + ' - ' + authorName : project._projectOwner), { fontSize: 13, fontWeight: 'bold', paddingTop: '1px' }]
      : [((project._projectOwner !== authorName) ? project._projectOwner + ' - ' + authorName : project._projectOwner), { fontSize: 13, fontWeight: 'bold', paddingTop: '1px' }];
    timestamp.tooltip = `Project ${name} was created by ${authorName}.\nIts repository belongs to ${project._projectOwner}.`;
    title.value = titleWrapper.title = name;
    description.value = project.description;
    this.view.animate({ opacity: 1, duration: 300 });
  }

  async tryToDelete () {
    const proceed = await this._worldBrowser.confirm('Delete Project', ['Do you really want to remove this project from this system? This step can not be undone.', { fontWeight: 'normal', fontSize: 16 }]);
    if (proceed) {
      const { _projectOwner, _projectName } = this._project;
      const gitResource = await resource('git/' + await defaultDirectory()).join('..').join('local_projects').join(`${_projectOwner}--${_projectName}`).withRelativePartsResolved().asDirectory();
      const hasRemote = await gitResource.hasRemote();
      let deleteRepo;
      if (isUserLoggedIn() && hasRemote) {
        deleteRepo = await this._worldBrowser.confirm('Delete Remote Repository', ['Should the remote repository be deleted as well?', { fontWeight: 'normal', fontSize: 16 }]);
      }
      await this.confirmDelete(deleteRepo);
    }
  }

  async confirmDelete (deleteRepo) {
    const { _projectName, _projectOwner } = this._project;
    await Project.deleteProject(_projectName, _projectOwner, currentUserToken(), deleteRepo);
    await this._worldBrowser.displayItems();
  }
}

const Placeholder = component({
  reactsToPointer: false,
  fill: Color.transparent,
  dropShadow: new ShadowObject({ distance: 20, rotation: 75, color: Color.rgba(0, 0, 0, 0.11), blur: 50 }),
  extent: pt(245, 368.2)
});

const WorldPreviewTile = component({
  name: 'world preview',
  defaultViewModel: ProjectPreviewModel,
  borderRadius: 5,
  dropShadow: new ShadowObject({ distance: 20, rotation: 75, color: Color.rgba(0, 0, 0, 0.11), blur: 50 }),
  extent: pt(245, 368.2),
  fill: Color.rgb(253, 254, 254),
  position: pt(1109.2, 43.8),
  submorphs: [{
    name: 'preview container',
    extent: pt(244.5, 130),
    fill: Color.rgba(46, 75, 223, 0),
    position: pt(0, 0),
    submorphs: [part(PlainButton, {
      name: 'version button',
      extent: pt(85, 31),
      position: pt(148, 316.7),
      submorphs: [{
        name: 'label',
        fontFamily: '"IBM Plex Sans"',
        fontWeight: 600,
        textAndAttributes: ['VERSIONS', null]
      }]
    }), part(GreenButton, {
      name: 'open button',
      extent: pt(122, 30),
      position: pt(14.6, 317),
      submorphs: [{
        name: 'label',
        fontWeight: 600,
        textAndAttributes: ['OPEN WORLD', null]
      }]
    }),
    part(Spinner, {
      name: 'spinner',
      visible: false,
      scale: 0.5,
      viewModel: { color: 'black' },
      extent: pt(55.3, 66.9),
      position: pt(111.3, 158.1)
    }), {
      name: 'preview frame',
      borderColor: Color.rgb(23, 160, 251),
      clipMode: 'hidden',
      extent: pt(210.4, 184),
      fill: Color.rgba(0, 0, 0, 0),
      position: pt(16, 16.2),
      submorphs: [{
        type: Image,
        name: 'preview',
        extent: pt(210, 216.6),
        imageUrl: '',
        naturalExtent: pt(200, 200)
      }]
    }, {
      type: Label,
      name: 'delete button',
      dropShadow: false,
      fontColor: Color.rgb(231, 76, 60),
      fontSize: 25.108,
      nativeCursor: 'pointer',
      position: pt(212.1, 11.9),
      textAndAttributes: Icon.textAttribute('trash-alt'),
      visible: false
    }, {
      type: Label,
      name: 'timestamp',
      borderRadius: 30,
      fill: Color.rgba(0, 0, 0, 0.36),
      fontColor: Color.rgb(253, 254, 254),
      fontSize: 17,
      nativeCursor: 'pointer',
      padding: rect(10, 3, 0, 2),
      position: pt(16.7, 167.8),
      textAndAttributes: ['robin.schreiber', {
        fontSize: 13,
        fontWeight: 'bold',
        paddingTop: '1px'
      }, ' - 3.1.19 19:30', {
        fontSize: 12,
        fontWeight: 'bold',
        paddingTop: '2px'
      }]
    }, {
      type: StaticText,
      name: 'description',
      clipMode: 'hidden',
      extent: pt(199.9, 70.3),
      fill: Color.rgba(255, 255, 255, 0),
      fontColor: Color.rgb(97, 106, 107),
      fontFamily: 'IBM Plex Sans',
      fontSize: 17,
      html: '<span style="line-height: 1.3; font-size: 17px; color: rgb(97,106,107); font-family: IBM Plex Sans">An interactive essay abouy eyesight.</span>',
      position: pt(18.9, 238.9),
      renderOnGPU: true,
      value: 'An interactive essay abouy eyesight.'
    }, {
      type: TitleWrapper,
      name: 'title wrapper',
      borderColor: Color.rgb(23, 160, 251),
      clipMode: 'hidden',
      extent: pt(217.4, 32.5),
      fill: Color.rgba(0, 0, 0, 0),
      position: pt(12.3, 205.3),
      submorphs: [{
        type: Label,
        name: 'title',
        fill: Color.rgba(255, 255, 255, 0),
        fontColor: Color.rgb(64, 64, 64),
        fontSize: 22,
        fontWeight: 'bold',
        nativeCursor: 'pointer',
        padding: rect(4, 3, 1, 0),
        textAndAttributes: ['Title', null]
      }]
    }]
  }, {
    type: WorldVersionViewer,
    name: 'version container',
    draggable: true,
    extent: pt(515.7, 365.6),
    fill: Color.rgb(253, 254, 254),
    grabbable: true,
    position: pt(0, 0),
    visible: false,
    layoutable: false,
    submorphs: [{
      type: MorphList,
      name: 'version list',
      clipMode: 'hidden',
      master: SystemList,
      extent: pt(475.6, 285),
      itemHeight: 45,
      padding: rect(1, 1, 0, -1),
      position: pt(20.1, 16.8),
      touchInput: false
    }, part(Spinner, {
      name: 'version list spinner',
      viewModel: { color: 'black' },
      extent: pt(55.3, 66.9),
      position: pt(244, 166.1),
      scale: 0.5,
      visible: false,
      reactsToPointer: false
    }), part(PlainButton, {
      name: 'close versions button',
      dropShadow: new ShadowObject({ distance: 3, color: Color.rgba(0, 0, 0, 0.26), blur: 10 }),
      extent: pt(84, 31),
      fill: Color.rgb(81, 90, 90),
      position: pt(20.7, 317.2),
      submorphs: [{
        name: 'label',
        fontFamily: '"IBM Plex Sans"',
        fontWeight: 600,
        textAndAttributes: ['CLOSE', null]
      }]
    }), part(RedButton, {
      name: 'revert button',
      extent: pt(84, 31),
      position: pt(312.4, 316.2),
      submorphs: [{
        name: 'label',
        fontWeight: 600,
        textAndAttributes: ['REVERT', null]
      }]
    }), part(GreenButton, {
      name: 'visit button',
      dropShadow: new ShadowObject({ distance: 3, color: Color.rgba(0, 0, 0, 0.26), blur: 10 }),
      extent: pt(84, 31),
      label: 'VISIT',
      position: pt(413, 315.6),
      submorphs: [{
        name: 'label',
        fontWeight: 600,
        textAndAttributes: ['VISIT', null]
      }]
    })]
  }]
});

// TODO: This can be build much smoother by relying on more advanced components/layout features.
// As of writing this, those are however not yet available (via the sidebar).
const ProjectIcon = component({
  name: 'aMorph',
  borderColor: Color.rgb(56, 175, 249),
  borderRadius: 5,
  borderWidth: 6,
  extent: pt(155, 155),
  position: pt(26.5, 5.4),
  submorphs: [{
    type: Path,
    name: 'aPath2',
    borderColor: Color.rgba(4, 28, 43, 0.5),
    borderWidth: 4,
    extent: pt(6, 132),
    position: pt(25, 10),
    vertices: [({ position: pt(0, 0), isSmooth: false, controlPoints: { next: pt(0, 0), previous: pt(0, 0) } }), ({ position: pt(0, 131.99999999999991), isSmooth: false, controlPoints: { next: pt(0, 0), previous: pt(0, 0) } })]
  }, {
    type: Path,
    name: 'aPath3',
    borderColor: Color.rgba(4, 28, 43, 0.5),
    borderWidth: 4,
    extent: pt(1, 132),
    position: pt(46, 10),
    vertices: [({ position: pt(0, 0), isSmooth: false, controlPoints: { next: pt(0, 0), previous: pt(0, 0) } }), ({ position: pt(0, 132), isSmooth: false, controlPoints: { next: pt(0, 0), previous: pt(0, 0) } })]
  }, {
    type: Path,
    name: 'aPath4',
    borderColor: Color.rgba(4, 28, 43, 0.5),
    borderWidth: 4,
    extent: pt(1, 132),
    position: pt(67, 10),
    vertices: [({ position: pt(0, 0), isSmooth: false, controlPoints: { next: pt(0, 0), previous: pt(0, 0) } }), ({ position: pt(0, 132), isSmooth: false, controlPoints: { next: pt(0, 0), previous: pt(0, 0) } })]
  }, {
    type: Path,
    name: 'aPath5',
    borderColor: Color.rgba(4, 28, 43, 0.5),
    borderWidth: 4,
    extent: pt(1, 132),
    position: pt(88, 10),
    vertices: [({ position: pt(0, 0), isSmooth: false, controlPoints: { next: pt(0, 0), previous: pt(0, 0) } }), ({ position: pt(0, 132), isSmooth: false, controlPoints: { next: pt(0, 0), previous: pt(0, 0) } })]
  }, {
    type: Path,
    name: 'aPath6',
    borderColor: Color.rgba(4, 28, 43, 0.5),
    borderWidth: 4,
    extent: pt(1, 132),
    position: pt(108, 10),
    vertices: [({ position: pt(0, 0), isSmooth: false, controlPoints: { next: pt(0, 0), previous: pt(0, 0) } }), ({ position: pt(0, 132), isSmooth: false, controlPoints: { next: pt(0, 0), previous: pt(0, 0) } })]
  }, {
    type: Path,
    name: 'aPath1',
    borderColor: Color.rgba(4, 28, 43, 0.5),
    borderWidth: 4,
    extent: pt(1, 132),
    position: pt(130, 10),
    vertices: [({ position: pt(0, 0), isSmooth: false, controlPoints: { next: pt(0, 0), previous: pt(0, 0) } }), ({ position: pt(0, 132), isSmooth: false, controlPoints: { next: pt(0, 0), previous: pt(0, 0) } })]
  }, {
    name: 'aMorph3',
    borderColor: Color.rgb(23, 160, 251),
    borderRadius: 8,
    extent: pt(91, 6),
    fill: Color.rgb(77, 175, 243),
    position: pt(9.5, 20)
  }, {
    name: 'aMorph1',
    borderColor: Color.rgb(23, 160, 251),
    borderRadius: 8,
    extent: pt(61, 6),
    fill: Color.rgb(77, 175, 243),
    position: pt(33.5, 60)
  }, {
    name: 'aMorph2',
    borderColor: Color.rgb(23, 160, 251),
    borderRadius: 8,
    extent: pt(61, 6),
    fill: Color.rgb(77, 175, 243),
    position: pt(73, 89)
  }, add({
    name: 'background remover',
    borderColor: Color.rgb(23, 160, 251),
    extent: pt(30.5, 33.5),
    position: pt(20.5, 104.5)
  }, 'aText'), {
    type: Text,
    name: 'aText',
    fontWeight: 700,
    borderColor: Color.rgb(23, 160, 251),
    cursorWidth: 1.5,
    dynamicCursorColoring: true,
    extent: pt(48, 49),
    fill: Color.rgba(255, 255, 255, 0),
    fixedHeight: true,
    fixedWidth: true,
    fontColor: Color.rgb(92, 175, 238),
    fontSize: 42,
    lineWrapping: 'by-words',
    padding: rect(1, 1, 0, 0),
    position: pt(98.5, 21),
    textAndAttributes: ['', {
      fontFamily: 'Font Awesome',
      fontWeight: '900'
    }, ' ', {}]
  }, add({
    type: Text,
    name: 'aText2',
    lineHeight: 1,
    borderColor: Color.rgb(23, 160, 251),
    cursorWidth: 1.5,
    dynamicCursorColoring: true,
    extent: pt(61.5, 55),
    fill: Color.rgba(255, 255, 255, 0),
    fixedHeight: true,
    fixedWidth: true,
    fontColor: Color.rgb(77, 175, 243),
    fontSize: 62,
    lineWrapping: 'by-words',
    padding: rect(0, 0, 1, 0),
    position: pt(3.5, 89),
    textAndAttributes: ['', {
      fontFamily: 'Tabler Icons',
      fontWeight: '900'
    }]
  })]
});

const ProjectPreviewTile = component(WorldPreviewTile, {
  defaultViewModel: ProjectPreviewModel,
  submorphs: [{
    name: 'preview container',
    submorphs: [
      {
        name: 'version button',
        tooltip: 'Switch between different versions of this project.'
      },
      {
        name: 'open button',
        tooltip: 'Open the last used version of this project.',
        submorphs: [{
          name: 'label',
          textAndAttributes: ['OPEN PROJECT', null]
        }]
      },
      {
        name: 'preview frame',
        // TODO: We can still think about some kind of generated preview for Projects.
        submorphs: [without('preview'), add(part(ProjectIcon, { name: 'project icon' }))]
      }, {
        name: 'timestamp',
        nativeCursor: 'text',
        textAndAttributes: ['', {
          fontFamily: 'Font Awesome',
          fontSize: 13,
          paddingTop: '1px'
        }, ' robin.schreiber', {
          fontSize: 13,
          fontWeight: 'bold',
          paddingTop: '1px'
        }, ' - 3.1.19 19:30', {
          fontSize: 12,
          fontWeight: 'bold',
          paddingTop: '2px'
        }]
      }]
  }, {
    type: ProjectVersionViewer,
    name: 'version container',
    submorphs: [without('revert button'), {
      name: 'visit button',
      submorphs: [{
        name: 'label',
        textAndAttributes: ['USE', null]
      }]
    }]
  }]
});

const WorldBrowser = component({
  defaultViewModel: WorldBrowserModel,
  name: 'world browser',
  borderRadius: 10,
  clipMode: 'hidden',
  draggable: true,
  dropShadow: new ShadowObject({ color: Color.rgba(0, 0, 0, 0.52), blur: 15 }),
  extent: pt(880.3, 570),
  fill: Color.rgb(112, 123, 124),
  layout: new ConstraintLayout({
    lastExtent: {
      x: 880.3,
      y: 570
    },
    reactToSubmorphAnimations: false,
    submorphSettings: [['no world warning', {
      x: 'center',
      y: 'center'
    }], ['no match warning', {
      x: 'center',
      y: 'center'
    }], ['world list', {
      x: 'resize',
      y: 'resize'
    }], ['fader top', {
      x: 'resize',
      y: 'fixed'
    }], ['fader bottom', {
      x: 'resize',
      y: 'move'
    }], ['close button', {
      x: 'fixed',
      y: 'move'
    }], ['loading indicator', {
      x: 'center',
      y: 'center'
    }]]
  }),
  position: pt(1182.2, 536.7),
  renderOnGPU: true,
  submorphs: [{
    type: Label,
    name: 'no world warning',
    visible: false,
    extent: pt(531.3, 42.5),
    fixedHeight: true,
    fixedWidth: true,
    fontColor: Color.rgb(189, 195, 199),
    fontSize: 30,
    fontWeight: 'bold',
    position: pt(174.2, 261.5),
    reactsToPointer: false,
    textAndAttributes: ['There are no projects yet. Create one!', null]
  },
  {
    type: Label,
    name: 'no match warning',
    visible: false,
    extent: pt(400.9, 42.5),
    fixedHeight: true,
    fixedWidth: true,
    fontColor: Color.rgb(189, 195, 199),
    fontSize: 30,
    fontWeight: 'bold',
    position: pt(244.6, 259.8),
    reactsToPointer: false,
    textAndAttributes: ['No matching projects found.', null]
  },
  {
    type: GrowingWorldList,
    name: 'world list',
    clipMode: 'scroll',
    extent: pt(879.7, 580),
    fill: Color.rgba(46, 75, 223, 0),
    items: [],
    scrollContainer: null,
    submorphs: [{
      name: 'scroll container',
      extent: pt(868.9, 75),
      fill: Color.transparent,
      layout: new TilingLayout({
        align: 'center',
        orderByIndex: true,
        padding: rect(0, 0, 0, 30),
        reactToSubmorphAnimations: true,
        hugContentsVertically: true,
        spacing: 25,
        wrapSubmorphs: true
      }),
      reactsToPointer: false,
      submorphs: [{
        name: 'buffer top',
        extent: pt(768.9, 34),
        fill: Color.transparent
      }, {
        name: 'buffer bottom',
        extent: pt(768.9, 10),
        fill: Color.transparent
      }]
    }]
  }, {
    name: 'fader top',
    layout: new TilingLayout({
      align: 'center',
      axisAlign: 'center',
      justifySubmorphs: 'spaced',
      padding: rect(20, 0, 0, 0)
    }),
    extent: pt(881.6, 60),
    fill: new LinearGradient({
      stops: [{ offset: 0, color: Color.rgb(112, 123, 124) }, { offset: 1, color: Color.rgba(112, 123, 124, 0) }],
      vector: rect(0, 0, 0, 1)
    }),
    submorphs: [{
      name: 'left',
      fill: Color.transparent,
      layout: new TilingLayout({
        axisAlign: 'center',
        spacing: 10
      }),
      submorphs: [part(GreenButton, {
        name: 'new project button',
        extent: pt(163, 30),
        submorphs: [{
          name: 'label',
          fontWeight: 600,
          textAndAttributes: [...Icon.textAttribute('plus-circle', { paddingTop: '2px', paddingRight: '5px' }), ' NEW PROJECT']
        }]
      }), part(ModeSelector, {
        name: 'mode selector',
        extent: pt(150, 30),
        borderColor: Color.white,
        fill: Color.rgba(114, 123, 124, 0),
        borderRadius: 5,
        viewModel: {
          items: [
            { text: 'Projects', name: 'Projects', tooltip: 'Create or Open a Project' },
            { text: 'Playgrounds', name: 'Playgrounds', tooltip: 'Create or Open a Playground (Legacy/Prototyping Mode)' }
          ]
        }
      })]
    }, {
      name: 'right',
      fill: Color.transparent,
      layout: new TilingLayout({
        align: 'right',
        axisAlign: 'center',
        hugContentsHorizontally: true,
        hugContentsVertically: true,
        spacing: 10
      }),
      submorphs: [part(PlainButton, {
        name: 'open snapshot button',
        extent: pt(228, 33.5),
        position: pt(626.5, 531),
        opacity: 0,
        reactsToPointer: false,
        submorphs: [{
          name: 'label',
          textAndAttributes: ['OPEN PLAYGROUND SNAPSHOT', null]
        }]
      }), part(SearchField, {
        name: 'search field',
        borderWidth: 0,
        layout: new TilingLayout({
          axisAlign: 'center',
          orderByIndex: true,
          padding: rect(6, 0, 4, 0),
          resizePolicies: [
            ['search input', { height: 'fill', width: 'fill' }],
            ['placeholder icon', { height: 'fixed', width: 'fixed' }]
          ]
        }),
        borderRadius: 30,
        viewModel: { fuzzy: true },
        extent: pt(285.1, 34),
        fill: Color.rgb(234, 237, 237),
        submorphs: [
          {
            name: 'search input',
            layout: new ConstraintLayout({
              lastExtent: {
                x: 271,
                y: 36
              },
              reactToSubmorphAnimations: false,
              submorphSettings: []
            }),
            fixedWidth: true,
            selectionColor: Color.rgba(64, 196, 255, .4),
            fontSize: 20,
            submorphs: [
              {
                name: 'placeholder',
                padding: rect(6, 1, 0, 3),
                textAndAttributes: ['Search Projects', { fontSize: 22 }]
              }
            ]
          }, {
            name: 'placeholder icon',
            padding: rect(2, 2, -2, -2),
            fontSize: 18
          }
        ]
      })
      ]
    }]
  }, {
    name: 'fader bottom',
    extent: pt(880.3, 63.9),
    fill: new LinearGradient({
      stops: [
        { offset: 0, color: Color.rgb(112, 123, 124) },
        { offset: 0.9073299632352941, color: Color.rgba(127, 127, 127, 0) }
      ],
      vector: rect(0.498247508317511, 0.9999969287634702, 0.003504983364977972, -0.9999938575269406)
    }),
    position: pt(0, 506)
  }, part(RedButton, {
    name: 'close button',
    extent: pt(94.6, 30),
    position: pt(14.9, 531),
    submorphs: [{
      name: 'label',
      textAndAttributes: ['CLOSE', null]
    }]
  }), {
    name: 'loading indicator',
    layout: new TilingLayout({
      align: 'center',
      axisAlign: 'center',
      hugContentsHorizontally: true,
      hugContentsVertically: true,
      orderByIndex: true,
      padding: rect(10, 5, 0, 0),
      spacing: 7
    }),
    borderRadius: 30,
    extent: pt(90.5, 10),
    fill: Color.rgba(0, 0, 0, 0.36),
    opacity: 1,
    position: pt(355.7, 260.3),
    submorphs: [
      part(Spinner, {
        name: 'loading spinner',
        extent: pt(68.2, 70.2)
      }),
      {
        type: Label,
        name: 'loading label',
        fontColor: Color.rgb(253, 254, 254),
        fontFamily: '"IBM Plex Sans"',
        fontSize: 23,
        fontWeight: '500',
        textString: 'Loading...'
      }
    ]
  }]
});

export { WorldBrowser };
