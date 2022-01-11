/* global System,self */
import { fun, arr, obj, string } from 'lively.lang';
import { pt, Color, Rectangle } from 'lively.graphics';
import { config, show } from 'lively.morphic';
import { connect, noUpdate } from 'lively.bindings';
import { localInterface } from 'lively-system-interface/index.js';
import {
  LoadingIndicator,
  Window,
  FilterableList
} from 'lively.components';
import * as Browser from './js/browser/ui.cp.js';
import { MorphicDB } from 'lively.morphic/morphicdb/index.js';
import { SnapshotEditor } from 'lively.morphic/partsbin.js';
import { worker } from 'lively.lang';
import { serialize } from 'lively.serializer2';
import { plugins, allPlugins } from 'lively.serializer2/plugins.js';
import { callService, ProgressMonitor } from './service-worker.js';

export async function doSearch (
  livelySystem, searchTerm,
  excludedModules = [/systemjs-plugin-babel|.*\.min\.js|.*browserified[^/]+js/],
  excludedPackages = [],
  includeUnloaded = true,
  caseSensitive = false,
  progress
) {
  if (searchTerm.length <= 2) { return []; }

  if (!System.get('@system-env').worker && config.ide.workerEnabled) {
    return await callService('doSearch', {
      livelySystem,
      searchTerm,
      excludedModules,
      excludedPackages,
      includeUnloaded,
      caseSensitive,
      progress
    });
  }

  let searchResult = await livelySystem.searchInAllPackages(
    searchTerm, { caseSensitive, excludedModules, excludedPackages, includeUnloaded, progress });

  let [errors, found] = arr.partition(searchResult, ({ isError }) => isError);

  if (errors.length) {
    show(`Errors in search results:\n${arr.pluck(errors, 'value').join('\n')}`);
  }

  return found.reduce((result, ea) => {
    let nameAndLine = `${ea.packageName}/${ea.pathInPackage}:${ea.line}`;
    result.maxModuleNameLength = Math.max(result.maxModuleNameLength, nameAndLine.length);
    result.items.push({
      isListItem: true,
      value: ea,
      get string () {
        return nameAndLine + ea.lineString;
        // + string.pad(, result.maxModuleNameLength - nameAndLine.length, true);
      }
    });
    return result;
  }, { items: [], maxModuleNameLength: 0 }).items;
}

export class CodeSearcher extends FilterableList {
  static inWindow (props = { title: 'code search', targetBrowser: null, systemInterface: null }) {
    let searcher = new this(props);
    let win = new Window({
      ...obj.dissoc(props, ['targetBrowser', 'systemInterface']),
      extent: searcher.extent.addXY(0, 25),
      targetMorph: searcher
    });
    connect(win, 'windowActivated', searcher, 'onWindowActivated');
    return win;
  }

  static get properties () {
    return {
      fill: { defaultValue: Color.transparent },
      extent: { defaultValue: pt(800, 500) },
      fontFamily: { defaultValue: 'Monaco, monospace' },
      fontSize: { defaultValue: 12 },
      inputPadding: { defaultValue: Rectangle.inset(5) },
      itemPadding: { defaultValue: Rectangle.inset(4, 2) },
      borderWidth: { defaultValue: 0 },

      historyId: { defaultValue: 'lively.morphic-code searcher' },

      submorphs: {
        initialize () {
          this.submorphs = [
            {
              type: 'input',
              name: 'input',
              placeholder: 'Search Source Files',
              fontColor: Color.gray.darker(),
              defaultTextStyle: { fontSize: 14 },
              autofit: true,
              fill: Color.white.withA(0.5)
            },
            {
              name: 'list',
              type: 'list',
              items: [],
              clipMode: 'auto',
              borderTop: { width: 1, color: Color.gray }
            }
          ];
        }
      },

      input: {
        after: ['submorphs'],
        derived: true,
        get () { return this.getSubmorphNamed('input').input; },
        set (input) { this.getSubmorphNamed('input').input = input; }
      },

      browser: {
        set (browser) {
          this.setProperty('browser', browser ? browser.id : null);
        },
        get () {
          let w = this.world(); let id = this.getProperty('browser');
          return !w || !id ? null : w.getMorphWithId(id);
        }
      },

      systemInterface: {
        after: ['browser'],
        derived: true,
        get () {
          let browser = this.browser;
          return browser
            ? browser.systemInterface
            : this.getProperty('systemInterface') || localInterface;
        },

        set (systemInterface) {
          let browser = this.browser;
          if (browser) browser.systemInterface = systemInterface;
          else this.setProperty('systemInterface', systemInterface);
        }

      },

      currentSearchTerm: { defaultValue: '' },
      currentFilters: { defaultValue: '' }

    };
  }

  constructor (props = {}) {
    if (props.targetBrowser) props.browser = props.targetBrowser;
    super(props);
    this.reset();
  }

  onLoad () {
    this.reset();
  }

  reset () {
    this.currentSearchTerm = '';
    connect(this, 'accepted', this, 'openSelection');
    connect(this.get('search chooser'), 'selection', this, 'searchAgain');
    this.get('list').items = [];
    this.get('input').input = '';
    this.get('search chooser').items = [
      'in loaded modules',
      'in loaded and unloaded modules',
      'in parts',
      'in worlds'
    ];
    noUpdate(() => {
      this.get('search chooser').selection = 'in loaded modules';
    });
    this.getWindow() && (this.getWindow().title = 'code search');
    // this.get("search chooser").listAlign = "bottom"
  }

  ensureIndicator (label, progress) {
    if (!this.progressIndicator) {
      let win = this.getWindow();
      this.progressIndicator = this.addMorph(LoadingIndicator.open());
      if (win) this.progressIndicator.center = win.innerBounds().center();
    }
    this.progressIndicator.label = 'Searching Files';
    this.progressIndicator.status = label;
    if (progress) this.progressIndicator.progress = progress;
  }

  removeIndicator () {
    if (this.progressIndicator) this.progressIndicator.remove();
    this.progressIndicator = null;
  }

  updateFilter () {
    let searchInput = this.get('input').textString;
    if (searchInput.length <= 2) return;

    this.ensureIndicator('receiving input...');

    fun.debounceNamed(this.id + 'updateFilterDebounced', 1200, async (needle) => {
      this.removeIndicator();
      try { await this.searchAndUpdate(needle); } catch (err) { this.world().logError(err); }
    })(searchInput);
  }

  searchAgain () {
    let needle = this.currentSearchTerm;
    if (needle <= 2) return;
    this.getSubmorphNamed('list').items = [];
    this.currentSearchTerm = '';
    this.searchAndUpdate(needle);
  }

  async searchAndUpdate (searchInput) {
    this.get('search chooser').right = this.width - 5;
    this.get('input').acceptInput(); // for history
    let filterTokens = searchInput.split(/\s+/).filter(ea => !!ea);

    let win = this.getWindow();
    if (win && win.targetMorph === this) { win.title = `${win.title.split('-')[0].trim()} - ${filterTokens.join(' + ')}`; }

    let searchTerm = filterTokens.shift();
    let newSearch = searchTerm != this.currentSearchTerm;

    if (newSearch) {
      this.currentSearchTerm = searchTerm;

      let searchType = this.get('search chooser').selection;
      let searchInModules = searchType === 'in loaded modules';
      let searchInAllModules = searchType === 'in loaded and unloaded modules';
      let searchInParts = searchType === 'in parts';
      let searchInWorlds = searchType === 'in worlds';

      this.ensureIndicator('searching...');

      let progressMonitor = new ProgressMonitor({
        handlers: {
          loadingIndicatorUpdater: (step, percentage) => {
            this.ensureIndicator(step, percentage);
          }
        }
      });

      if (searchInModules || searchInAllModules) {
        this.items = await doSearch(
          this.systemInterface,
          searchTerm,
          undefined, /* excluded modules */
          config.ide.js.ignoredPackages,
          !!searchInAllModules/* includeUnloaded */,
          false,
          progressMonitor
        );
      } else if (searchInParts || searchInWorlds) {
        let pbar = await $world.addProgressBar({ label: 'morphicdb search' });
        let type = searchInWorlds ? 'world' : 'part';
        let found = await MorphicDB.default.codeSearchInPackages(
          searchTerm, type, (name, i, n) => Object.assign(pbar, { label: name, progress: i / n }));
        pbar.remove();
        this.items = found.map(ea => {
          let inFile = ea.file.path.slice(1).reduce((url, ea) => string.joinPath(url, ea));
          if (ea.lineString >= 300) ea.lineString = string.truncate(ea.lineString, 300);
          ea.isMorphicDBFind = true;
          return { isListItem: true, string: `[${ea.commit.type}/${ea.commit.name}] ${inFile}:${ea.line} ${ea.lineString}`, value: ea };
        });
      }

      this.removeIndicator();
      this.progressIndicator = null;
    }

    filterTokens = filterTokens.map(ea => ea.toLowerCase());
    if (newSearch || this.currentFilters !== filterTokens.join('+')) {
      this.currentFilters = filterTokens.join('+');
      let filteredItems = this.items.filter(item =>
        filterTokens.every(token => item.string.toLowerCase().includes(token)));
      this.get('list').items = filteredItems;
    }
  }

  async openSelection () {
    let sel = this.selection;
    if (!sel) return;

    if (sel.isMorphicDBFind) return new SnapshotEditor(sel.commit).interactivelyEditFileInSnapshotPackage(sel.file, () => {}, { row: sel.line, column: 0 });
    return this.openBrowserForSelection();
  }

  async openBrowserForSelection () {
    if (!this.selection) return;
    let { browser, selection: { column, line, packageName, pathInPackage } } = this;
    let browserOrProps = browser;
    let browseSpec = {
      packageName,
      moduleName: pathInPackage,
      textPosition: { column, row: line - 1 }
    };
    browser = await Browser.browse(
      browseSpec, browserOrProps || {},
      browser ? browser.systemInterface : this.systemInterface);
    browser.associatedSearchPanel = this;
    return browser.getWindow().activate();
  }

  onWindowActivated () {
    this.get('input').selectAll();
  }

  get commands () {
    let chooser = this.get('search chooser');
    return super.commands.concat([
      {
        name: 'toggle search in unloaded modules',
        exec: () => {
          chooser.selection = chooser.selection === 'in loaded modules'
            ? 'in loaded and unloaded modules'
            : 'in loaded modules';
          return true;
        }
      },
      {
        name: 'toggle search in parts',
        exec: () => { chooser.selection = 'in parts'; return true; }
      },
      {
        name: 'toggle search in worlds',
        exec: () => { chooser.selection = 'in worlds'; return true; }
      }
    ]);
  }

  get keybindings () {
    return [
      { keys: 'F1', command: 'toggle search in unloaded modules' },
      { keys: 'F2', command: 'toggle search in parts' },
      { keys: 'F3', command: 'toggle search in worlds' }
    ].concat(super.keybindings);
  }
}
