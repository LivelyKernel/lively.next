import { fun, arr, obj, promise, string } from "lively.lang";
import { pt, Color, Rectangle } from "lively.graphics";
import { morph, Morph, Window, show } from "../index.js";
import { FilterableList } from "../list.js";
import { LabeledCheckBox } from "../widgets.js";
import Browser from "./js/browser/index.js";
import { connect, disconnectAll } from "lively.bindings"


export async function doSearch(
  livelySystem, searchTerm,
  excludedModules = [/systemjs-plugin-babel/],
  includeUnloaded = true
) {
  if (searchTerm.length <= 2) { return []; }

  var searchResult = await livelySystem.searchInAllPackages(
                        searchTerm, {excludedModules, includeUnloaded});

  var [errors, found] = arr.partition(searchResult, ({isError}) => isError)

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
        return nameAndLine
             + string.pad(ea.lineString, result.maxModuleNameLength - nameAndLine.length, true);
      }
    });
    return result;
  }, {items: [], maxModuleNameLength: 0}).items;

}


export class CodeSearcher extends FilterableList {

  static inWindow(props = {title: "code search", targetBrowser: null, backend: null}) {
    var searcher = new this(props),
        win = new Window({
          ...obj.dissoc(props, ["targetBrowser", "backend"]),
          extent: searcher.extent.addXY(0, 25),
          targetMorph: searcher
        });
    connect(win, 'windowActivated', searcher, 'onWindowActivated');
    return win;
  }

  constructor(props = {}) {
    super({
      fill: Color.white,
      extent: pt(800,500),
      fontFamily: "Inconsolata, monospace",
      fontSize: 14,
      historyId: "lively.morphic-code searcher",
      ...obj.dissoc(props, "targetBrowser", "backend")});
    var cb = this.addMorph(new LabeledCheckBox({
      checked: false,
      name: "searchInUnloadedModulesCheckbox",
      label: "search in unloaded modules"}));

    if (props.targetBrowser)
      this.state.targetBrowser = props.targetBrowser.id;
    this.state.currentSearchTerm = "";
    this.state.currentFilters = "";
    this.state.backend = props.backend || "local";

    connect(this, "accepted", this, "openBrowserForSelection");
    connect(cb, "checked", this, "searchAgain");
  }

  relayout() {
    super.relayout();
    
    var input = this.getSubmorphNamed("input"),
        cb = this.getSubmorphNamed("searchInUnloadedModulesCheckbox");
    cb && (cb.rightCenter = input.rightCenter);
  }

  get browser() {
    var w = this.world();
    if (!w || !this.state.targetBrowser) return null;
    return w.getMorphWithId(this.state.targetBrowser);
  }

  get backend() {
    var browser = this.browser;
    return browser ? browser.backend : this.state.backend;
  }

  set backend(backend) {
    var browser = this.browser;
    if (browser) browser.backend = backend;
    else this.state.backend = backend;
  }

  async getLivelySystem() {
    var backend = this.backend,
        remote = backend && backend !== "local" ? backend : null,
        systemInterface = await System.import("lively-system-interface");
    return remote ?
      systemInterface.serverInterfaceFor(remote) :
      systemInterface.localInterface; // FIXME
  }

  updateFilter() {
    // debounce

    var searchInput = this.get('input').textString;
    if (searchInput.length <= 2) return;
  
    // if (!this.typingIndicator) {
    //   this.typingIndicator = lively.ide.withLoadingIndicatorDo("input...");
    // }

    fun.debounceNamed(this.id + "updateFilterDebounced", 1200, async (needle) => {
      // if (this.typingIndicator) this.typingIndicator.then(i => i.remove());
      // this.typingIndicator = null;
      try {
        await this.searchAndUpdate(needle);
      } catch(err) {
        this.world().logError(err);
      }
    })(searchInput);
  }

  searchAgain() {
    var needle = this.state.currentSearchTerm;
    if (needle <= 2) return;
    this.getSubmorphNamed("list").items = [];
    this.state.currentSearchTerm = "";
    this.searchAndUpdate(needle);
  }

  async searchAndUpdate(searchInput) {
    this.get("input").acceptInput(); // for history
    var filterTokens = searchInput.split(/\s+/).filter(ea => !!ea);
  
    var win = this.getWindow();
    if (win && win.targetMorph === this)
      win.title = `${win.title.split("–")[0].trim()} – ${filterTokens.join(" + ")}`;

    var searchTerm = filterTokens.shift(),
        newSearch = searchTerm != this.state.currentSearchTerm;
    if (newSearch) {
      this.state.currentSearchTerm = searchTerm;
      var includeUnloaded = this.getSubmorphNamed("searchInUnloadedModulesCheckbox").checked;
      this.items = await doSearch(await this.getLivelySystem(), searchTerm, undefined, includeUnloaded);
    }
  
    filterTokens = filterTokens.map(ea => ea.toLowerCase());
    if (newSearch || this.state.currentFilters !== filterTokens.join("+")) {
      this.state.currentFilters = filterTokens.join("+");
      var filteredItems = this.state.allItems.filter(item =>
        filterTokens.every(token => item.string.toLowerCase().includes(token)))
      this.get('list').items = filteredItems;
    }
  }

  async openBrowserForSelection() {
    if (!this.selection) return;
    var {browser, selection: {column, line, packageName, pathInPackage}} = this,
        browserOrProps = browser,
        browser = await Browser.browse(
          packageName,
          pathInPackage,
          {column, row: line-1}, browserOrProps,
          browser? browser.backend : this.backend);
    browser.state.associatedSearchPanel = this;
    return browser.activate();
  }

  onWindowActivated() {
    this.get("input").selectAll();
  }
  
  get commands() {
    return super.commands.concat([
      {
        name: "toggle search in unloaded modules",
        exec: () => { this.get("searchInUnloadedModulesCheckbox").toggle(); return true; }
      }
    ]);
  }

  get commands() {
    return super.commands.concat([
      {
        name: "toggle search in unloaded modules",
        exec: () => { this.get("searchInUnloadedModulesCheckbox").trigger(); return true; }
      }
    ]);
  }
  
  get keybindings() {
    return [
      {keys: "Alt-L", command: "toggle search in unloaded modules"}
    ].concat(super.keybindings);
  }

}
