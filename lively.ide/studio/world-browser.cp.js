import { InputLine, easings, touchInputDevice, morph, World, MorphicDB, Image, HTMLMorph, Morph, Icon, TilingLayout, Label, ConstraintLayout, ShadowObject, component, part } from 'lively.morphic';
import { connect } from 'lively.bindings';
import * as moduleManager from 'lively.modules';
import { Color, LinearGradient, rect, pt } from 'lively.graphics/index.js';
import { arr, fun, graph, date, string } from 'lively.lang/index.js';
import { GreenButton, RedButton, PlainButton } from 'lively.components/prompts.cp.js';
import { DropDownList, MorphList } from 'lively.components/list.cp.js';
import * as LoadingIndicator from 'lively.components/loading-indicator.cp.js';
import { UserUI } from 'lively.user/morphic/user-ui.js';

import { Spinner } from './shared.cp.js';
import { SystemList } from '../styling/shared.cp.js';

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
          this.layout = new TilingLayout({ axis: 'column', align: 'center', spacing: 5 });
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

export default class WorldVersionViewer extends Morph {
  reset () {
    this.getSubmorphNamed('version list').items = [];
    this.getSubmorphNamed('version list spinner').visible = false;
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
      console.error(err);
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

class TitleWrapper extends Morph {
  static get properties () {
    return {
      title: {
        derived: true,
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
    title.textString = string.truncate(this.title, 18, '...');
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

class StaticText extends HTMLMorph {
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

class SearchInputLine extends InputLine {
  fuzzyMatch (s, parsedInput = this.parseInput()) {
    let tokens = parsedInput.lowercasedTokens;
    if (tokens.every(token => s.toLowerCase().includes(token))) return true;
    let fuzzyValue = s.toLowerCase();
    return arr.sum(parsedInput.lowercasedTokens.map(token =>
      string.levenshtein(fuzzyValue, token))) <= 3;
  }

  fuzzyFilter (items, toString = item => item) {
    let parsedInput = this.parseInput();
    return items.filter(item => this.fuzzyMatch(toString(item), parsedInput));
  }

  parseInput () {
    let filterText = this.textString;
    // parser that allows escapes
    let parsed = Array.from(filterText).reduce(
      (state, char) => {
        // filterText = "foo bar\\ x"
        if (char === '\\' && !state.escaped) {
          state.escaped = true;
          return state;
        }

        if (char === ' ' && !state.escaped) {
          if (!state.spaceSeen && state.current) {
            state.tokens.push(state.current);
            state.current = '';
          }
          state.spaceSeen = true;
        } else {
          state.spaceSeen = false;
          state.current += char;
        }
        state.escaped = false;
        return state;
      },
      { tokens: [], current: '', escaped: false, spaceSeen: false }
    );
    parsed.current && parsed.tokens.push(parsed.current);
    let lowercasedTokens = parsed.tokens.map(ea => ea.toLowerCase());
    return { tokens: parsed.tokens, lowercasedTokens };
  }
}

class WorldDashboard extends Morph {
  static get properties () {
    return {
      showCloseButton: {
        derived: true,
        get () {
          return this.ui.closeButton.visible;
        },
        set (v) {
          this.ui.closeButton.visible = v;
        }
      },
      db: {
        serialize: false,
        get () { return MorphicDB.default; }
      },
      ui: {
        derived: true,
        get () {
          return {
            worldList: this.getSubmorphNamed('world list'),
            sortSelector: this.getSubmorphNamed('search selector'),
            searchField: this.getSubmorphNamed('search field'),
            closeButton: this.getSubmorphNamed('close button'),
            loadingIndicator: this.getSubmorphNamed('loading indicator'),
            noWorldWarning: this.getSubmorphNamed('no world warning'),
            newProjectButton: this.getSubmorphNamed('new project button')
          };
        }
      }
    };
  }

  onLoad () {
    if (this.isComponent) return;
    if (typeof localStorage === 'undefined') return;
    const storedFilter = localStorage.getItem('lively.morphic-projects-filter');
    if (storedFilter && this.ui.sortSelector.selection !== storedFilter) {
      this.ui.sortSelector.selection = storedFilter;
    }
    this.initConnections();
  }

  initConnections () {
    const { sortSelector, searchField, newProjectButton } = this.ui;
    connect(sortSelector.viewModel, 'selection', this, 'update');
    connect(searchField, 'inputChanged', this, 'updateList');
    connect(newProjectButton, 'onMouseDown', this, 'createNewProject');
  }

  onMouseDown (evt) {
    super.onMouseDown(evt);
    if (evt.targetMorph === this.ui.closeButton) {
      this.remove();
    }
  }

  focus () {
    this.ui.searchField.focus();
  }

  update () {
    this.displayWorlds();
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem('lively.morphic-projects-filter', this.ui.sortSelector.selection);
    } catch (e) { console.error(e); }
  }

  beforePublish () {
    this.reset();
  }

  reset () {
    this.ui.worldList.items = [];
    this.ui.noWorldWarning.visible = false;
  }

  relayout () {
    this.alignInWorld();
  }

  alignInWorld (world = $world) {
    if (this.owner !== world) world.addMorph(this);
    this.center = world.visibleBounds().center();
  }

  sortAndFilterPreviews (previews) {
    const user = UserUI.getCurrentUser();
    previews = this.ui.searchField.fuzzyFilter(previews, p => p._commit.name + p._commit.description);
    switch (this.ui.sortSelector.selection) {
      case 'RECENT':
        return arr.sortBy(previews, p => -p._commit.timestamp);
      case 'TEMPLATES':
        // what defines a template ?
        return previews;
      case 'MY PROJECTS':
        return previews.filter(p => p._commit.author.name === user.name);
      case 'PUBLISHED':
        return previews;
          // determine if the worlds are frozen or not
    }
  }

  updateList () {
    if (!this.previews) return;
    fun.debounceNamed('update world list', 150, () => {
      this.ui.worldList.items = this.sortAndFilterPreviews(this.previews);
    })();
  }

  async displayWorlds () {
    this.reset();
    const { loadingIndicator } = this.ui;
    loadingIndicator.animate({
      opacity: 1, duration: 300
    });
    const worldCommits = await this.db.latestCommits('world');
    this.previews = worldCommits.map(commit => {
      const placeholder = part(Placeholder); // eslint-disable-line no-use-before-define

      placeholder._commit = commit;
      placeholder.displayPreview = () => {
        const preview = part(WorldPreviewTile); // eslint-disable-line no-use-before-define
        preview.dropShadow = null;
        preview._commit = commit;
        preview.opacity = 0;
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

    await loadingIndicator.animate({
      opacity: 0, duration: 300
    });
    this.updateList();

    if (worldCommits.length === 0) {
      this.ui.noWorldWarning.center = this.innerBounds().center();
      this.ui.noWorldWarning.animate({
        visible: true, duration: 300
      });
    }
  }

  createNewProject () {
    // navigate to worlds/new
    document.location = '/worlds/load?name=__newWorld__';
  }

  allFontsLoaded () {
    return this.ui.newProjectButton.submorphs[0].whenFontLoaded();
  }
}

class GrowingWorldList extends Morph {
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
          this.update(true);
        }
      }
    };
  }

  onLoad () {
    this.clipMode = 'auto';
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
      this.update(true);
    }
  }

  onHoverIn (evt) { this.clipMode = 'auto'; }
  onHoverOut (evt) { if (!touchInputDevice) this.clipMode = 'hidden'; }

  // add top and bottom buffer

  update (sort) {
    let items = this.items;
    if (!items || items.length === 0) return; // pre-initialize
    let scrollContainer = this.scrollContainer;
    let layoutSpacing = scrollContainer.layout.spacing;
    scrollContainer.extent = this.extent;
    let { bufferTop, bufferBottom } = this.ui;
    bufferTop = bufferTop || scrollContainer.addMorph({ fill: null, name: 'buffer top', height: 10 });
    bufferBottom = bufferBottom || scrollContainer.addMorph({ fill: null, name: 'buffer bottom', height: 10 });
    bufferTop.width = bufferBottom.width = this.width - 100;
    scrollContainer.layout.disable();
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
      scrollContainer.addMorph(item);
      if (!item._initialized) {
        item._initialized = true;
        item.displayPreview();
      }
    }
    if (sort) {
      bufferTop.position = pt(0, 0);
      items.forEach((m, i) => m.position = pt(i + 1, i + 1));
      bufferBottom.position = pt(items.length + 2, items.length + 2);
    }
    scrollContainer.layout.enable();
    if (sort || itemsToBeAdded.length > 0) {
      bufferBottom.top = this.submorphBounds().height;
      scrollContainer.layout.apply();
    }
  }
}

export class WorldPreview extends Morph {
  static get properties () {
    return {
      ui: {
        readOnly: true,
        get () {
          return {
            previewContainer: this.getSubmorphNamed('preview container'),
            versionContainer: this.getSubmorphNamed('version container'),
            preview: this.getSubmorphNamed('preview'),
            timestamp: this.getSubmorphNamed('timestamp'),
            title: this.getSubmorphNamed('title wrapper'),
            description: this.getSubmorphNamed('description'),
            openButton: this.getSubmorphNamed('open button'),
            versionButton: this.getSubmorphNamed('version button'),
            spinner: this.getSubmorphNamed('spinner'),
            deleteButton: this.getSubmorphNamed('delete button'),
            closeVersionsButton: this.getSubmorphNamed('close versions button'),
            versionList: this.getSubmorphNamed('version list'),
            deleteWorldPrompt: this.getSubmorphNamed('delete world prompt'),
            cancelDeleteButton: this.getSubmorphNamed('cancel delete button'),
            confirmDeleteButton: this.getSubmorphNamed('confirm delete button')
          };
        }
      }
    };
  }

  relayout () {
    // fit to world
    this.setBounds(this.world().visibleBounds());
  }

  onLoad () {
    this.ui.spinner.visible = false; // this causes the fan to spin
  }

  async displayPreview () {
    await this.initWithCommit(this._commit);
  }

  async initWithCommit (commit) {
    const {
      preview, timestamp, title, description,
      previewContainer
    } = this.ui;
    this.opacity = 0.5;
    this._commit = commit;
    preview.imageUrl = commit.preview || missingSVG;
    let { name: authorName } = commit.author;
    authorName = authorName.startsWith('guest-') ? 'guest' : authorName;
    timestamp.value = [authorName, { fontSize: 13, fontWeight: 'bold', paddingTop: '1px' }, date.format(commit.timestamp, ' - d.m.yy HH:MM'), {
      fontWeight: 'bold', fontSize: 12, paddingTop: '2px'
    }];
    title.title = commit.name;
    description.value = commit.description;
    this.animate({ opacity: 1, duration: 300 });
  }

  async openAnimated (targetBounds = $world.visibleBounds()) {
    const copy = morph({
      ...this.spec(),
      reactsToPointer: false,
      renderOnGPU: true,
      submorphs: [this.ui.spinner.spec()]
    }).openInWorld();
    copy.hasFixedPosition = true;
    copy.globalPosition = this.globalPosition;
    copy.opacity = 0;
    await copy.animate({ opacity: 1, duration: 300 });
    const duration = 500;
    copy.dropShadow = false;
    copy.animate({
      bounds: targetBounds,
      borderRadius: 0,
      duration,
      easing: easings.inOutQuint
    });
    copy.respondsToVisibleWindow = true;
    await copy.ui.spinner.animate({
      center: copy.innerBounds().center(),
      easing: easings.inOutQuint,
      duration
    });
    return copy;
  }

  async openWorld () {
    await this.openAnimated();
    this.loadWorld();
  }

  async loadWorld () {
    const { _id, name } = this._commit;
    if (lively.FreezerRuntime) {
      // open the world via url redirect
      // rms: instead of redirect load within world
      const li = LoadingIndicator.open('...starting bootstrap process...', {
        animated: true, delay: 1000
      });
      this.transitionToLivelyWorld(
        document.location.origin,
        this._commit,
        li
      );
    } else {
      const li = LoadingIndicator.open('loading ' + name);
      await World.loadFromCommit(_id, undefined, { morphicDB: MorphicDB.default, moduleManager });
      li.remove();
    }
  }

  async transitionToLivelyWorld (baseURL, commit, loadingIndicator) {
    const { bootstrap } = await System.import('lively.freezer/src/util/bootstrap.js');
    const { ProgressIndicator } = await System.import('lively.freezer/src/loading-screen.cp.js');
    const progress = part(ProgressIndicator, {
      opacity: 0, hasFixedPosition: true
    }).openInWorld();
    progress.startStepping('updateProgressBar');
    await bootstrap({ commit, loadingIndicator, progress });
  }

  async showVersions () {
    const duration = 200; const easing = easings.inOutExpo;
    const { previewContainer } = this.ui;
    const versionContainer = part(VersionContainer, { name: 'version container', position: pt(0, 0) }); // eslint-disable-line no-use-before-define
    this.addMorph(versionContainer);
    versionContainer.reactsToPointer = versionContainer.visible = true;
    versionContainer.initializeFromStartCommit(this._commit);
    this.animate({
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
    const { previewContainer, versionContainer } = this.ui;
    previewContainer.reactsToPointer = previewContainer.visible = true;
    this.animate({
      width: 245, duration, easing
    });
    previewContainer.animate({
      opacity: 1, duration
    });
    await versionContainer.animate({
      opacity: 0, duration
    });
    versionContainer.reset();
    versionContainer.remove();
  }

  toggleDeleteButton (active) {
    this.ui.deleteButton.visible = active;
  }

  onHoverIn (evt) {
    this.toggleDeleteButton(true);
  }

  onHoverOut (evt) {
    this.toggleDeleteButton(false);
  }

  async tryToDelete () {
    const proceed = await $world.confirm(['Delete World\n', {}, 'Do you really want to remove this world from the database? This step can not be undone.', { fontWeight: 'normal', fontSize: 16 }]);
    if (proceed) await this.confirmDelete();
  }

  async confirmDelete () {
    await MorphicDB.default.commit({ ...this._commit, content: undefined, snapshot: null });
    if (!this.isComponent && !this.owner.isWorld) this.owner.remove();
  }

  onMouseUp (evt) {
    const {
      openButton, versionButton, deleteButton,
      closeVersionsButton, cancelDeleteButton,
      confirmDeleteButton
    } = this.ui;
    // we want to initialize this from the spec, so we dont use connections
    switch (evt.targetMorph) {
      case openButton:
        this.openWorld();
        break;
      case versionButton:
        this.showVersions();
        break;
      case deleteButton:
        this.tryToDelete();
        break;
      case closeVersionsButton:
        this.hideVersions();
        break;
      case confirmDeleteButton:
        this.confirmDelete();
        break;
      case cancelDeleteButton:
        this.cancelDelete();
        break;
    }
  }
}

const Placeholder = component({
  reactsToPointer: false,
  fill: Color.transparent,
  clipMode: 'hidden',
  dropShadow: new ShadowObject({ distance: 20, rotation: 75, color: Color.rgba(0, 0, 0, 0.11), blur: 50 }),
  extent: pt(245, 368.2)
});

const VersionContainer = component({
  type: WorldVersionViewer,
  name: 'version container',
  draggable: true,
  extent: pt(515.7, 365.6),
  fill: Color.rgb(253, 254, 254),
  grabbable: true,
  position: pt(1472.2, 114.6),
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
    extent: pt(55.3, 66.9),
    position: pt(244, 166.1),
    scale: 0.5,
    visible: false
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
});

const WorldPreviewTile = component({
  type: WorldPreview,
  name: 'world preview',
  borderRadius: 5,
  clipMode: 'hidden',
  dropShadow: new ShadowObject({ distance: 20, rotation: 75, color: Color.rgba(0, 0, 0, 0.11), blur: 50 }),
  extent: pt(245, 368.2),
  fill: Color.rgb(253, 254, 254),
  position: pt(1109.2, 43.8),
  reactsToPointer: false,
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
        textAndAttributes: ['OPEN PROJECT', null]
      }]
    }), part(Spinner, {
      name: 'spinner',
      extent: pt(55.3, 66.9),
      position: pt(111.3, 158.1),
      visible: false
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
        naturalExtent: pt(200, 200),
        reactsToPointer: false
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
      reactsToPointer: false,
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
      fontFamily: 'IBM Plex Sans, Sans-Serif',
      fontSize: 17,
      html: '<span style="line-height: 1.3; font-size: 17px; color: rgb(97,106,107); font-family: IBM Plex Sans, Sans-Serif">An interactive essay abouy eyesight.</span>',
      position: pt(18.9, 238.9),
      reactsToPointer: false,
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
        reactsToPointer: false,
        textAndAttributes: ['Title', null]
      }]
    }]
  }]
});

const WorldBrowser = component({
  type: WorldDashboard,
  name: 'world browser',
  borderRadius: 10,
  clipMode: 'hidden',
  draggable: true,
  dropShadow: new ShadowObject({ color: Color.rgba(0, 0, 0, 0.52), blur: 15 }),
  extent: pt(870, 570),
  fill: Color.rgb(112, 123, 124),
  layout: new ConstraintLayout({
    lastExtent: {
      x: 870,
      y: 570
    },
    reactToSubmorphAnimations: false,
    submorphSettings: [['fader bottom', {
      x: 'resize',
      y: 'move'
    }], ['go back button', {
      x: 'fixed',
      y: 'move'
    }], ['dropdown list', {
      x: 'move',
      y: 'fixed'
    }], ['search-input', {
      x: 'move',
      y: 'fixed'
    }], ['fader top', {
      x: 'resize',
      y: 'fixed'
    }], ['world list', {
      x: 'resize',
      y: 'resize'
    }], ['world search', {
      x: 'move',
      y: 'fixed'
    }], ['search field', {
      x: 'move',
      y: 'fixed'
    }], ['close button', {
      x: 'fixed',
      y: 'move'
    }], ['search selector', {
      x: 'move',
      y: 'fixed'
    }]]
  }),
  position: pt(1182.2, 536.7),
  renderOnGPU: true,
  submorphs: [{
    type: Label,
    name: 'no world warning',
    fontColor: Color.rgb(189, 195, 199),
    fontSize: 30,
    fontWeight: 'bold',
    position: pt(170.8, 265.5),
    textAndAttributes: ['There are no projects yet. Create one!', null],
    visible: false
  }, {
    type: GrowingWorldList,
    name: 'world list',
    clipMode: 'hidden',
    extent: pt(869.6, 568.7),
    fill: Color.rgba(46, 75, 223, 0),
    items: [],
    scrollContainer: null,
    submorphs: [{
      name: 'scroll container',
      extent: pt(868.9, 75),
      fill: Color.transparent,
      layout: new TilingLayout({
        align: 'center',
        hugContentsVertically: true,
        orderByIndex: true,
        padding: rect(0, 0, 0, 30),
        reactToSubmorphAnimations: true,
        spacing: 25
      }),
      reactsToPointer: false,
      submorphs: [{
        name: 'buffer top',
        extent: pt(768.9, 10),
        fill: Color.transparent
      }, {
        name: 'buffer bottom',
        extent: pt(768.9, 10),
        fill: Color.transparent
      }]
    }]
  }, {
    name: 'fader top',
    extent: pt(871.9, 63.9),
    fill: new LinearGradient({
      stops: [{ offset: 0, color: Color.rgb(112, 123, 124) }, { offset: 1, color: Color.rgba(112, 123, 124, 0) }],
      vector: rect(0, 0, 0, 1)
    }),
    submorphs: [part(GreenButton, {
      name: 'new project button',
      extent: pt(145, 30),
      position: pt(19.8, 17),
      submorphs: [{
        name: 'label',
        fontWeight: 600,
        textAndAttributes: [...Icon.textAttribute('plus-circle', { paddingTop: '2px', paddingRight: '5px' }), ' NEW PROJECT']
      }]
    })]
  }, {
    type: SearchInputLine,
    name: 'search field',
    borderColor: Color.rgb(189, 195, 199),
    borderRadius: 30,
    dropShadow: new ShadowObject({ distance: 1, color: Color.rgba(0, 0, 0, 0.26) }),
    extent: pt(285.1, 34),
    fill: Color.rgb(234, 237, 237),
    fixedHeight: false,
    fontColor: Color.rgb(64, 64, 64),
    fontSize: 17,
    padding: rect(12, 5, -4, 0),
    placeholder: 'Search Projects',
    position: pt(574.3, 13.6),
    selectionColor: Color.rgba(52, 152, 219, 0.25)
  }, {
    name: 'fader bottom',
    extent: pt(871.9, 63.9),
    fill: new LinearGradient({
      stops: [
        { offset: 0, color: Color.rgb(112, 123, 124) },
        { offset: 0.9073299632352941, color: Color.rgba(127, 127, 127, 0) }
      ],
      vector: rect(0.498247508317511, 0.9999969287634702, 0.003504983364977972, -0.9999938575269406)
    }),
    position: pt(0, 506)
  }, {
    name: 'close button',
    nativeCursor: 'pointer',
    borderColor: Color.rgb(66, 73, 73),
    dropShadow: new ShadowObject({ distance: 3, color: Color.rgba(0, 0, 0, 0.26), blur: 10 }),
    extent: pt(94.6, 30),
    fill: Color.rgb(81, 90, 90),
    label: 'CLOSE',
    position: pt(14.9, 531),
    borderRadius: 5,
    borderWidth: 1,
    submorphs: [{
      type: Label,
      name: 'label',
      fontColor: Color.rgb(215, 219, 221),
      fontWeight: 'bold',
      position: pt(28.8, 7.5),
      reactsToPointer: false,
      textAndAttributes: ['CLOSE', null]
    }]
  }, {
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
    position: pt(353.5, 253),
    submorphs: [
      part(Spinner, {
        name: 'loading spinner',
        cssDeclaration: '\n           .lds-spinner {\n            color: official;\n            display: inline-block;\n            position: relative;\n            width: 64px;\n            height: 64px;\n          }\n          .lds-spinner div {\n            transform-origin: 32px 32px;\n            animation: lds-spinner .6s linear infinite;\n          }\n          .white-spinner div:after {\n            content: " ";\n            display: block;\n            position: absolute;\n            top: 3px;\n            left: 29px;\n            width: 5px;\n            height: 14px;\n            border-radius: 20%;\n            background: white;\n          }\n          .lds-spinner div:nth-child(1) {\n            transform: rotate(0deg);\n            animation-delay: -.55s;\n          }\n          .lds-spinner div:nth-child(2) {\n            transform: rotate(30deg);\n            animation-delay: -.5s;\n          }\n          .lds-spinner div:nth-child(3) {\n            transform: rotate(60deg);\n            animation-delay: -0.45s;\n          }\n          .lds-spinner div:nth-child(4) {\n            transform: rotate(90deg);\n            animation-delay: -0.4s;\n          }\n          .lds-spinner div:nth-child(5) {\n            transform: rotate(120deg);\n            animation-delay: -0.35s;\n          }\n          .lds-spinner div:nth-child(6) {\n            transform: rotate(150deg);\n            animation-delay: -0.3s;\n          }\n          .lds-spinner div:nth-child(7) {\n            transform: rotate(180deg);\n            animation-delay: -0.25s;\n          }\n          .lds-spinner div:nth-child(8) {\n            transform: rotate(210deg);\n            animation-delay: -0.2s;\n          }\n          .lds-spinner div:nth-child(9) {\n            transform: rotate(240deg);\n            animation-delay: -0.15s;\n          }\n          .lds-spinner div:nth-child(10) {\n            transform: rotate(270deg);\n            animation-delay: -0.1s;\n          }\n          .lds-spinner div:nth-child(11) {\n            transform: rotate(300deg);\n            animation-delay: -0.05s;\n          }\n          .lds-spinner div:nth-child(12) {\n            transform: rotate(330deg);\n            animation-delay: 0s;\n          }\n          @keyframes lds-spinner {\n            0% {\n              opacity: 1;\n            }\n            100% {\n              opacity: 0;\n            }\n          }',
        extent: pt(68.2, 70.2)
      }),
      {
        type: Label,
        name: 'loading label',
        fontColor: Color.rgb(253, 254, 254),
        fontFamily: '"IBM Plex Sans"',
        fontSize: 23,
        fontWeight: '500',
        reactsToPointer: false,
        textString: 'Loading...'
      }
    ]
  }, part(DropDownList, {
    name: 'search selector',
    position: pt(432.9, 17),
    borderColor: Color.rgb(66, 73, 73),
    dropShadow: new ShadowObject({ distance: 1, color: Color.rgba(0, 0, 0, 0.26) }),
    extent: pt(125.6, 29.6),
    fill: Color.rgb(81, 90, 90),
    viewModel: {
      items: ['MY PROJECTS', 'TEMPLATES', 'PUBLISHED', 'RECENT'],
      openListInWorld: true,
      selection: 'MY PROJECTS',
      listMaster: SystemList
    },
    submorphs: [{
      name: 'label',
      fontSize: 12,
      fontWeight: 600,
      fontColor: Color.rgb(215, 219, 221),
      textAndAttributes: ['MY PROJECTS', null, ' ', null, '', {
        fontFamily: '"Font Awesome 5 Free", "Font Awesome 5 Brands"',
        fontWeight: '900',
        paddingRight: '0px',
        paddingTop: '0px',
        textStyleClasses: ['fa', 'annotation']
      }]
    }]
  })]
});

export { WorldBrowser, WorldPreviewTile, VersionContainer };
