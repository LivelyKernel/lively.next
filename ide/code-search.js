import { fun, arr, obj, promise, string } from "lively.lang";
import { pt, Color, Rectangle } from "lively.graphics";
import { morph, Morph, Window, show } from "../index.js";
import { FilterableList } from "../list.js";
import { Browser } from "./javascript-browser.js";
import { connect, disconnectAll } from "lively.bindings"


export async function doSearch(searchTerm, excludes = [/systemjs-plugin-babel/]) {
  if (searchTerm.length <= 2) { return []; }

  var system = System.get(System.decanonicalize("lively-system-interface/index.js")),
      found = await system.localInterface.searchInAllPackages(searchTerm, {excludedModules: excludes}),
      items = found.reduce((result, ea) => {
        var nameAndLine = `${ea.module.package().name}${ea.module.pathInPackage().replace(/^\./, "")}:${ea.line}`;
        result.maxModuleNameLength = Math.max(result.maxModuleNameLength, nameAndLine.length) + 1;
        result.items.push({
          isListItem: true,
          get string() { return nameAndLine + string.pad(ea.lineString, result.maxModuleNameLength - nameAndLine.length, true); },
          value: ea
        });
        return result;
      }, {items: [], maxModuleNameLength: 0}).items;

  return items;
}


export class CodeSearcher extends FilterableList {

  static inWindow(props = {title: "code search", targetBrowser: null}) {
    var searcher = new this(props);
    return new Window({...obj.dissoc(props, "targetBrowser"), extent: searcher.extent.addXY(0, 25), targetMorph: searcher});
  }

  constructor(props = {}) {
    super({
      extent: pt(800,500),
      fontFamily: "Inconsolata, monospace",
      fontSize: 14,
      historyId: "lively.morphic-code searcher",
      ...obj.dissoc(props, "targetBrowser")});
    if (props.targetBrowser)
      this.state.targetBrowser = props.targetBrowser.id;
    this.state.currentSearchTerm = "";
    this.state.currentFilters = "";
    connect(this, "accepted", this, "openBrowserForSelection");
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
        this.searchAndUpdate(needle);
      } catch(err) {
        this.world().logError(err);
      }
    })(searchInput);
  }

  async searchAndUpdate(searchInput) {
    var filterTokens = searchInput.split(/\s+/).filter(ea => !!ea);
  
    var win = this.getWindow();
    if (win && win.targetMorph === this)
      win.title = `${win.title.split("–")[0].trim()} – ${filterTokens.join(" + ")}`;

    var searchTerm = filterTokens.shift(),
        newSearch = searchTerm != this.state.currentSearchTerm;
    if (newSearch) {
      this.state.currentSearchTerm = searchTerm;
      this.items = await doSearch(searchTerm);
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
    var {column, line, module} = this.selection,
        browserOrProps = (this.state.targetBrowser ?
          this.world().getMorphWithId(this.state.targetBrowser) : null)
             || {center: this.globalBounds().center()},
        browser = await Browser.browse(
          module.package().name,
          module.pathInPackage().replace(/^\.\//, ""),
          {column, row: line-1},
          browserOrProps);
    browser.state.associatedSearchPanel = this;
    return browser.activate();
  }

}
