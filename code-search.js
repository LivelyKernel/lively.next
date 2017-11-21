import { fun, arr, obj, string } from "lively.lang";
import { pt, Color, Rectangle } from "lively.graphics";
import { config, show } from "lively.morphic";
import { connect, noUpdate } from "lively.bindings";
import { localInterface } from "lively-system-interface/index.js";
import {
  LoadingIndicator,
  Window,
  FilterableList
} from "lively.components";
import Browser from "./js/browser/index.js";
import { MorphicDB } from "lively.morphic/morphicdb/index.js";
import { SnapshotEditor } from "lively.morphic/partsbin.js";

export async function doSearch(
  livelySystem, searchTerm,
  excludedModules = [/systemjs-plugin-babel|.*\.min\.js|.*browserified[^/]+js/],
  excludedPackages = [],
  includeUnloaded = true,
  caseSensitive = false
) {
  if (searchTerm.length <= 2) { return []; }

  var searchResult = await livelySystem.searchInAllPackages(
    searchTerm, {caseSensitive, excludedModules, excludedPackages, includeUnloaded});

  var [errors, found] = arr.partition(searchResult, ({isError}) => isError);

  if (errors.length) {
    show(`Errors in search results:\n${arr.pluck(errors, "value").join("\n")}`);
  }

  return found.reduce((result, ea) => {
    var nameAndLine = `${ea.packageName}/${ea.pathInPackage}:${ea.line}`;
    result.maxModuleNameLength = Math.max(result.maxModuleNameLength, nameAndLine.length);
    result.items.push({
      isListItem: true,
      value: ea,
      get string() {
        return nameAndLine + ea.lineString;
        //+ string.pad(, result.maxModuleNameLength - nameAndLine.length, true);
      }
    });
    return result;
  }, {items: [], maxModuleNameLength: 0}).items;

}


export class CodeSearcher extends FilterableList {

  static inWindow(props = {title: "code search", targetBrowser: null, systemInterface: null}) {
    var searcher = new this(props),
        win = new Window({
          ...obj.dissoc(props, ["targetBrowser", "systemInterface"]),
          extent: searcher.extent.addXY(0, 25),
          targetMorph: searcher
        });
    connect(win, "windowActivated", searcher, "onWindowActivated");
    return win;
  }

  static get properties() {
    return {

      fill:       {defaultValue: Color.transparent},
      extent:     {defaultValue: pt(800,500)},
      fontFamily: {defaultValue: "Monaco, monospace"},
      fontSize:   {defaultValue: 12},
      inputPadding: {defaultValue: Rectangle.inset(5)},
      itemPadding: {defaultValue: Rectangle.inset(4,2)},
      borderWidth: {defaultValue: 0},

      historyId:  {defaultValue: "lively.morphic-code searcher"},

      submorphs: {
        initialize() {
          this.submorphs = [
            {
              type: "input", name: "input",
              placeholder: "Search Source Files",
              fontColor: Color.gray.darker(),
              defaultTextStyle: {fontSize: 14},
              autofit: true,
              fill: Color.white.withA(.5)
            },
            {
              name: "list", type: "list",
              items: [],
              clipMode: "auto",
              borderTop: {width: 1, color: Color.gray}
            }
          ];
        }
      },

      input: {
        after: ["submorphs"], derived: true,
        get() { return this.getSubmorphNamed("input").input; },
        set(input) { this.getSubmorphNamed("input").input = input; }
      },

      browser: {
        set(browser) {
          this.setProperty("browser", browser ? browser.id : null);
        },
        get() {
          var w = this.world(), id = this.getProperty("browser");
          return !w || !id ? null : w.getMorphWithId(id);
        }
      },

      systemInterface: {
        after: ["browser"], derived: true,
        get() {
          var browser = this.browser;
          return browser ?
            browser.systemInterface :
            this.getProperty("systemInterface") || localInterface;
        },

        set(systemInterface) {
          var browser = this.browser;
          if (browser) browser.systemInterface = systemInterface;
          else this.setProperty("systemInterface", systemInterface);
        }

      },

      currentSearchTerm: {defaultValue: ""},
      currentFilters: {defaultValue: ""},

    };
  }

  constructor(props = {}) {
    if (props.targetBrowser) props.browser = props.targetBrowser;
    super(props);
    this.reset();
  }

  reset() {
    this.currentSearchTerm = "";
    connect(this, "accepted", this, "openSelection");
    connect(this.get("search chooser"), "selection", this, "searchAgain");
    this.get("list").items = [];
    this.get("input").input = "";
    this.get("search chooser").items = [
      "in loaded modules",
      "in loaded and unloaded modules",
      "in parts",
      "in worlds",
    ];
    noUpdate(() => {
      this.get("search chooser").selection = "in loaded modules";
    });
    this.getWindow().title = "code search";
    // this.get("search chooser").listAlign = "bottom"
  }

  ensureIndicator(label) {
    if (!this.progressIndicator) {
      let win = this.getWindow();
      this.progressIndicator = this.addMorph(LoadingIndicator.open());
      if (win) this.progressIndicator.center = win.innerBounds().center();
    }
    this.progressIndicator.label = label;
  }

  removeIndicator() {
    if (this.progressIndicator) this.progressIndicator.remove();
    this.progressIndicator = null;
  }

  updateFilter() {
    var searchInput = this.get("input").textString;
    if (searchInput.length <= 2) return;

    this.ensureIndicator("input...");

    fun.debounceNamed(this.id + "updateFilterDebounced", 1200, async (needle) => {
      this.removeIndicator();
      try { await this.searchAndUpdate(needle); }
      catch(err) { this.world().logError(err); }
    })(searchInput);
  }

  searchAgain() {
    var needle = this.currentSearchTerm;
    if (needle <= 2) return;
    this.getSubmorphNamed("list").items = [];
    this.currentSearchTerm = "";
    this.searchAndUpdate(needle);
    this.get('search chooser').right = this.width - 5;
  }

  async searchAndUpdate(searchInput) {
    this.get("input").acceptInput(); // for history
    var filterTokens = searchInput.split(/\s+/).filter(ea => !!ea);

    var win = this.getWindow();
    if (win && win.targetMorph === this)
      win.title = `${win.title.split("-")[0].trim()} - ${filterTokens.join(" + ")}`;

    var searchTerm = filterTokens.shift(),
        newSearch = searchTerm != this.currentSearchTerm;

    if (newSearch) {
      this.currentSearchTerm = searchTerm;

      let searchType = this.get("search chooser").selection,
          searchInModules = "in loaded modules" === searchType,
          searchInAllModules = "in loaded and unloaded modules" === searchType,
          searchInParts = "in parts" === searchType,
          searchInWorlds = "in worlds" === searchType;

      this.ensureIndicator("searching...");

      if (searchInModules || searchInAllModules) {
        this.items = await doSearch(
          this.systemInterface,
          searchTerm,
          undefined, /*excluded modules*/
          config.ide.js.ignoredPackages,
          !!searchInAllModules/*includeUnloaded*/);

      } else if (searchInParts || searchInWorlds) {
        let pbar = await $world.addProgressBar({label: "morphicdb search"}),
            type = searchInWorlds ? "world" : "part",
            found = await MorphicDB.default.codeSearchInPackages(
              searchTerm, type, (name, i, n) => Object.assign(pbar, {label: name, progress: i/n}));
        pbar.remove();
        this.items = found.map(ea => {
          let inFile = ea.file.path.slice(1).reduce((url, ea) => string.joinPath(url, ea));
          if (ea.lineString >= 300) ea.lineString = string.truncate(ea.lineString, 300);
          ea.isMorphicDBFind = true;
          return {isListItem: true, string: `[${ea.commit.type}/${ea.commit.name}] ${inFile}:${ea.line} ${ea.lineString}`, value: ea};
        });
      }

      this.removeIndicator();
      this.progressIndicator = null;
    }

    filterTokens = filterTokens.map(ea => ea.toLowerCase());
    if (newSearch || this.currentFilters !== filterTokens.join("+")) {
      this.currentFilters = filterTokens.join("+");
      var filteredItems = this.items.filter(item =>
        filterTokens.every(token => item.string.toLowerCase().includes(token)));
      this.get("list").items = filteredItems;
    }
  }

  async openSelection() {
    let sel = this.selection;
    if (!sel) return;

    if (sel.isMorphicDBFind) return new SnapshotEditor(sel.commit).interactivelyEditFileInSnapshotPackage(sel.file, () => {}, {row: sel.line, column: 0});
    return this.openBrowserForSelection();
  }

  async openBrowserForSelection() {
    if (!this.selection) return;
    var {browser, selection: {column, line, packageName, pathInPackage}} = this,
        browserOrProps = browser,
        browseSpec = {
          packageName, moduleName: pathInPackage,
          textPosition: {column, row: line-1}
        };
    browser = await Browser.browse(
      browseSpec, browserOrProps || {},
      browser ? browser.systemInterface : this.systemInterface);
    browser.associatedSearchPanel = this;
    return browser.activate();
  }

  onWindowActivated() {
    this.get("input").selectAll();
  }

  get commands() {
    let chooser = this.get("search chooser");
    return super.commands.concat([
      {
        name: "toggle search in unloaded modules",
        exec: () => {
          chooser.selection = chooser.selection === "in loaded modules" ?
            "in loaded and unloaded modules" : "in loaded modules";
          return true;
        }
      },
      {
        name: "toggle search in parts",
        exec: () => { chooser.selection = "in parts"; return true; }
      },
      {
        name: "toggle search in worlds",
        exec: () => { chooser.selection = "in worlds"; return true; }
      }
    ]);
  }

  get keybindings() {
    return [
      {keys: "F1", command: "toggle search in unloaded modules"},
      {keys: "F2", command: "toggle search in parts"},
      {keys: "F3", command: "toggle search in worlds"},
    ].concat(super.keybindings);
  }

}
