import { Icon, TilingLayout, component, part, config } from 'lively.morphic';
import { pt, Rectangle, Color, rect } from 'lively.graphics';
import { InputLineDefault } from 'lively.components/inputs.cp.js';
import { DropDownList, DefaultList } from 'lively.components/list.cp.js';
import { SystemList } from './styling/shared.cp.js';
import { ButtonDefault } from 'lively.components/buttons.cp.js';
import { Label } from 'lively.morphic/text/label.js';
import { FilterableList, LoadingIndicator, Window } from 'lively.components';
import { callService, ProgressMonitor } from './service-worker.js';
import { arr, fun, obj } from 'lively.lang';
import { show } from 'lively.halos';
import { connect, noUpdate } from 'lively.bindings';
import { localInterface } from 'lively-system-interface';

export async function doSearch (
  livelySystem, searchTerm,
  excludedModules = [/systemjs-plugin-babel|.*\.min\.js|.*browserified[^/]+js|landing-page|loading-screen/],
  excludedPackages = [],
  includeUnloaded = true,
  caseSensitive = false,
  regexMode = false,
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
      regexMode,
      progress
    });
  }

  let searchResult = await livelySystem.searchInAllPackages(
    searchTerm, { caseSensitive, regexMode, excludedModules, excludedPackages, includeUnloaded, progress });

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
      fontFamily: { defaultValue: 'IBM Plex Mono' },
      fontSize: { defaultValue: 12 },
      inputPadding: { defaultValue: Rectangle.inset(5) },
      itemPadding: { defaultValue: Rectangle.inset(4, 2) },
      borderWidth: { defaultValue: 0 },

      historyId: { defaultValue: 'lively.morphic-code searcher' },

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

  relayout () { }

  reset () {
    this.caseModeActive = false;
    this.regexModeActive = false;
    this.currentSearchTerm = '';
    connect(this, 'accepted', this, 'openSelection');
    this.get('list').items = [];
    this.get('input').input = '';
    this.get('search chooser').items = [
      'in loaded modules',
      'in loaded and unloaded modules'
    ];
    noUpdate(() => {
      this.get('search chooser').selection = 'in loaded modules';
    });
    this.getWindow() && (this.getWindow().title = 'code search');

    // initialize connections
    connect(this.get('caseMode'), 'fire', this, 'caseModeToggled', { converter: '() => target.searchModeToggled("case")' });
    connect(this.get('regexMode'), 'fire', this, 'regexModeToggled', { converter: '() => target.searchModeToggled("regex")' });
    connect(this.get('search chooser'), 'selection', this, 'handleSpecialSearchModes');
    connect(this.get('search chooser'), 'selection', this, 'searchAgain');
    connect(this.get('reload'), 'fire', this, 'searchAgain');
    connect(this.get('input'), 'inputChanged', this, 'updateFilter');
    connect(this.get('list'), 'selection', this, 'selectionChanged');
    connect(this.get('list'), 'onItemMorphDoubleClicked', this, 'acceptInput');
  }

  handleSpecialSearchModes () {
    this.caseModeActive = false;
    this.regexModeActive = false;

    [this.get('caseMode'), this.get('regexMode')].forEach(button => button.master = {
      auto: ModeButtonInactive,
      hover: ModeButtonInactiveHover,
      click: ModeButtonInactiveClick
    });
  }

  searchModeToggled (type) {
    const button = type === 'case' ? this.get('caseMode') : this.get('regexMode');
    let active;
    if (type === 'case') {
      this.caseModeActive = !this.caseModeActive;
      active = this.caseModeActive;
    }
    if (type === 'regex') {
      this.regexModeActive = !this.regexModeActive;
      active = this.regexModeActive;
    }

    if (active) {
      button.master = {
        auto: ModeButtonActive,
        hover: ModeButtonActiveHover,
        click: ModeButtonActiveClick
      };
    } else {
      button.master = {
        auto: ModeButtonInactive,
        hover: ModeButtonInactiveHover,
        click: ModeButtonInactiveClick
      };
    }

    this.searchAgain();
  }

  ensureIndicator (label, progress) {
    if (!this.progressIndicator) {
      let win = this.getWindow();
      this.progressIndicator = this.addMorph(LoadingIndicator.open('Searching Files', { isLayoutable: false }));
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
    this.get('input').acceptInput(); // for history
    let filterTokens = searchInput.split(/\s+/).filter(ea => !!ea);

    let win = this.getWindow();
    if (win && win.targetMorph === this) { win.title = `${win.title.split('-')[0].trim()} - ${filterTokens.join(' + ')}`; }

    let searchTerm = filterTokens.shift();
    let newSearch = searchTerm !== this.currentSearchTerm;

    if (newSearch) {
      this.currentSearchTerm = searchTerm;

      let searchType = this.get('search chooser').selection;
      let searchInModules = searchType === 'in loaded modules';
      let searchInAllModules = searchType === 'in loaded and unloaded modules';

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
          this.caseModeActive,
          this.regexModeActive,
          progressMonitor
        );
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
    const Browser = await System.import('lively.ide/js/browser/ui.cp.js');
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
      }
    ]);
  }

  get keybindings () {
    return [
      { keys: 'F1', command: 'toggle search in unloaded modules' }
    ].concat(super.keybindings);
  }
}

const ModeButtonInactive = component(ButtonDefault, {
  extent: pt(27, 27),
  borderStyle: 'none',
  fill: Color.transparent
});

const ModeButtonInactiveHover = component(ModeButtonInactive, {
  fill: Color.gray
});

const ModeButtonActiveClick = ModeButtonInactiveHover;

const ModeButtonInactiveClick = component(ModeButtonInactive, {
  fill: Color.darkGray
});

const ModeButtonActiveHover = ModeButtonInactiveClick;

const ModeButtonActive = component(ModeButtonInactive, {
  fill: Color.darkGray,
  submorphs: [{
    name: 'label',
    fontColor: Color.white
  }]
});

const ModeButtonDisabled = component(ModeButtonInactive, {
  visible: false,
  reactsToPointer: false
});

const CodeSearch = component({
  type: CodeSearcher,
  name: 'code search',
  acceptsDrops: false,
  fill: Color.transparent,
  extent: pt(538, 421.5),
  layout: new TilingLayout({
    axis: 'column',
    orderByIndex: true,
    resizePolicies: [['controls holder', {
      height: 'fixed',
      width: 'fill'
    }], ['list', {
      height: 'fill',
      width: 'fill'
    }]],
    spacing: 5,
    renderViaCSS: false
  }),
  selectedAction: 'default',
  submorphs: [
    {
      name: 'controls holder',
      height: 43.0921875,
      layout: new TilingLayout({
        axisAlign: 'right',
        orderByIndex: true,
        padding: rect(5, 0, -5, 0),
        resizePolicies: [['input', {
          height: 'fixed',
          width: 'fill'
        }], ['holder', {
          height: 'fixed'
        }]],
        spacing: 2
      }),
      borderColor: Color.rgb(23, 160, 251),
      fill: Color.transparent,
      position: pt(17.3, 247.4),
      submorphs: [part(ModeButtonInactive, {
        master: { click: ModeButtonInactiveClick, hover: ModeButtonInactiveHover },
        name: 'reload',
        position: pt(-415.8, -407.5),
        submorphs: [{
          name: 'label',
          fontColor: Color.rgb(60, 60, 60),
          textAndAttributes: Icon.textAttribute('rotate-right')
        }],
        tooltip: 'Refresh Search Results'
      }), part(InputLineDefault, {
        name: 'input',
        borderRadius: 6,
        borderWidth: 1,
        extent: pt(243, 27),
        fontFamily: 'IBM Plex Mono',
        fontSize: 14,
        haloShadow: {
          blur: 6,
          color: {
            a: 1,
            b: 0.8588,
            g: 0.5961,
            r: 0.2039
          },
          distance: 0,
          rotation: 45
        },
        historyId: 'lively.morphic-code searcher',
        padding: rect(5, 5, 0, 0),
        placeholder: 'Search Source Files',
        submorphs: [{
          name: 'placeholder',
          extent: pt(134, 29),
          fontSize: 14,
          padding: rect(5, 5, 0, 0),
          lineHeight: 1,
          textAndAttributes: ['Search Source Files', null]
        }]
      }), {
        name: 'holder',
        extent: pt(89.7, 27),
        fill: Color.transparent,
        layout: new TilingLayout({
          align: 'right',
          axisAlign: 'center',
          hugContentsHorizontally: true,
          orderByIndex: true,
          padding: rect(0, 0, 5, 0),
          spacing: 2
        }),
        position: pt(0, 33),
        submorphs: [part(ModeButtonInactive, {
          master: { click: ModeButtonInactiveClick, hover: ModeButtonInactiveHover },
          tooltip: 'Search Case Sensitive',
          name: 'caseMode',
          extent: pt(27, 22),
          submorphs: [{
            type: Label,
            name: 'label',
            textAndAttributes: Icon.textAttribute('circle-h')
          }]
        }), part(ModeButtonInactive, {
          master: { click: ModeButtonInactiveClick, hover: ModeButtonInactiveHover },
          tooltip: 'Search based on regular expressions.\n\
Regular expression should be given without quotes or literal mode slashes.',
          name: 'regexMode',
          extent: pt(27, 22),
          submorphs: [{
            type: Label,
            name: 'label',
            textAndAttributes: Icon.textAttribute('circle-question')
          }]
        }), part(DropDownList, {
          name: 'search chooser',
          master: { auto: ModeButtonActive, click: ModeButtonInactiveClick },
          viewModel: {
            openListInWorld: true,
            listMaster: SystemList,
            items: [
              'in loaded modules',
              'in loaded and unloaded modules'
            ]
          },
          borderColor: Color.gray,
          borderStyle: 'none',
          extent: pt(63, 22),
          fill: Color.darkGray,
          layout: new TilingLayout({
            align: 'center',
            axisAlign: 'center',
            hugContentsHorizontally: true,
            orderByIndex: true,
            padding: rect(10, 0, 0, 0)
          }),
          submorphs: [{
            name: 'label',
            fontColor: Color.white
          }]
        })]
      }]
    },
    part(DefaultList, {
      name: 'list',
      extent: pt(538.7, 279.6),
      fontFamily: 'IBM Plex Mono',
      itemPadding: rect(4, 2, 0, 0),
      padding: rect(2, 0, 0, 0),
      position: pt(0, 27)
    })
  ]
})
 ;

export { CodeSearch, ModeButtonActive, ModeButtonInactive, ModeButtonActiveClick, ModeButtonInactiveClick, ModeButtonActiveHover, ModeButtonInactiveHover, ModeButtonDisabled };
