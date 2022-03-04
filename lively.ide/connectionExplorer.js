import { FilterableList, Window } from 'lively.components';
import { obj, string } from 'lively.lang';

import { Color, Rectangle, pt } from 'lively.graphics';

import { ProgressMonitor } from './service-worker.js';
import { doSearch } from './code-search.js';
import { config } from 'lively.morphic';
import MorphicDB from 'lively.morphic/morphicdb/db.js';

// const test = new ConnectionExplorer();
// ConnectionExplorer.inWindow()
export class ConnectionExplorer extends FilterableList {
  static inWindow (props = { title: 'code search' }) {
    let searcher = new this();
    let win = new Window({
      ...obj.dissoc(props),
      extent: searcher.extent.addXY(0, 25),
      targetMorph: searcher
    });
    return win;
  }

  onLoad () {
    this.reset();
  }

  reset () {
   
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
    
  }
}
