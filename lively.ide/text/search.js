/* global System */
import { pt } from 'lively.graphics';
import { once } from 'lively.bindings';
import { Path } from 'lively.lang';

import config from 'lively.morphic/config.js';
import { ViewModel, part } from 'lively.morphic/components/core.js';
import { TextSearcher } from 'lively.morphic/text/search.js';

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// widget for text search, maintains search state

export class SearchWidgetModel extends ViewModel {
  static get properties () {
    return {
      isEpiMorph: { defaultValue: true },

      target: {},
      state: {
        initialize () {
          this.state = {
            backwards: false,
            before: null,
            position: null,
            inProgress: null,
            last: null,
            caseMode: false,
            regexMode: false
          };
        }
      },

      input: {
        get () {
          const text = this.ui.searchInput.textString;
          if (this.state.regexMode) {
            const reMatch = text.match(/^\/(.*)\/([a-z]*)$/);
            if (reMatch) {
              return RegExp(reMatch[1], reMatch[2]);
            }
            return new RegExp(text);
          }
          return text;
        },
        set (v) { this.ui.searchInput.textString = String(v); }
      },

      textMap: {
        get () {
          return this.target.textMap;
        }
      },

      expose: {
        get () {
          return ['state', 'prepareForNewSearch', 'commands', 'keybindings', 'isEpiMorph'];
        }
      },

      bindings: {
        get () {
          return [
            { target: 'searchInput', signal: 'onBlur', handler: 'onBlur' },
            { target: 'replaceInput', signal: 'onBlur', handler: 'onBlur' },
            { target: 'acceptButton', signal: 'fire', handler: 'execCommand', converter: () => 'accept search' },
            { target: 'cancelButton', signal: 'fire', handler: 'execCommand', converter: () => 'cancel search and reset cursor in text' },
            { target: 'nextButton', signal: 'fire', handler: 'execCommand', converter: () => 'search next' },
            { target: 'prevButton', signal: 'fire', handler: 'execCommand', converter: () => 'search prev' },
            { target: 'searchInput', signal: 'inputChanged', handler: 'search' },
            { target: 'replaceButton', signal: 'fire', handler: 'execCommand', converter: () => 'replace and go to next' },
            { target: 'replaceAllButton', signal: 'fire', handler: 'execCommand', converter: () => 'replace all' },
            { target: 'caseModeButton', signal: 'fire', handler: 'toggleCaseMode' },
            { target: 'regexModeButton', signal: 'fire', handler: 'toggleRegexMode' },
            { signal: 'onBlur', handler: 'onBlur', override: true }
          ];
        }
      }

    };
  }

  viewDidLoad () {
    if (this.targetText) this.target = this.targetText;
    if (!this.target) throw new Error('SearchWidget needs a target text morph!');

    // override existing commands
    this.ui.searchInput.addCommands([
      {
        name: 'realign top-bottom-center',
        exec: async () => {
          this.target.execCommand('realign top-bottom-center');
          this.addSearchMarkersForPreview(
            this.state.inProgress && this.state.inProgress.found, false, this.state.caseMode);
          return true;
        }
      }
    ]);
  }

  toggleRegexMode () {
    this.state.regexMode = !this.state.regexMode;
    this.ui.regexModeButton.opacity = this.state.regexMode ? 1 : 0.5;

    this.cleanup();
    this.search();
  }

  toggleCaseMode () {
    this.state.caseMode = !this.state.caseMode;
    this.ui.caseModeButton.opacity = this.state.caseMode ? 1 : 0.5;

    this.cleanup();
    this.search();
  }

  async focus () {
    const { searchInput } = this.ui;
    searchInput.focus();
    await searchInput.whenRendered();
    searchInput.invalidateTextLayout(true, true);
  }

  onBlur ($super, evt) {
    const world = this.world();
    const { view, ui: { searchInput, replaceInput } } = this;
    if (!world) return;
    setTimeout(() => {
      const focusedMorph = world.focusedMorph;
      if (!view.withAllSubmorphsDetect(m => m.isFocused())) {
        this.cancelSearch(false);
        return;
      }
      if (searchInput !== focusedMorph &&
        replaceInput !== focusedMorph) {
        searchInput.focus();
      }
    });
  }

  cleanup () {
    this.removeSearchMarkers();
    this.state.inProgress = null;
    this.textMap && this.textMap.update();
  }

  cancelSearch (resetEditor) {
    if (this.state.inProgress) { this.state.last = this.state.inProgress; }
    this.cleanup();
    if (!this._reuseTextMap) this.target.removeTextMap();
    if (this.state.before && resetEditor) {
      const { scroll, selectionRange } = this.state.before;
      this.target.selection = selectionRange;
      this.target.scroll = scroll;
      this.state.before = null;
    }
    this.view.remove();
    this.target.focus();
  }

  acceptSearch () {
    if (this.state.inProgress) { this.state.last = this.state.inProgress; }
    if (this.applySearchResult(this.state.inProgress)) {
      this.state.before && this.target.saveMark(this.state.before.position);
    }
    this.ui.searchInput.acceptInput(); // for history
    this.cleanup();
    if (!this._reuseTextMap) this.target.removeTextMap();
    this.state.before = null;
    this.view.remove();
    this.target.focus();
  }

  applySearchResult (searchResult) {
    // searchResult = {found, backwards, ...}
    if (!searchResult || !searchResult.found) return null;
    const text = this.target;
    const sel = text.selection;
    const select = !!text.activeMark || !sel.isEmpty();
    const { backwards, found: { range: { start, end } } } = searchResult;
    const pos = backwards ? start : end;
    select ? sel.lead = pos : text.cursorPosition = pos;
    if (!text.isLineFullyVisible(pos.row)) text.centerRow();
    return searchResult;
  }

  removeSearchMarkers () {
    (this.target.markers || []).forEach(({ id }) =>
      id.startsWith('search-highlight') && this.target.removeMarker(id));
  }

  addSearchMarkers (found, backwards = false, caseSensitive = false) {
    this.removeSearchMarkers();

    const { target: text } = this;
    let { startRow, endRow } = text.whatsVisible;
    const lines = text.document.lineStrings;
    let i = 0;
    const { maxCharsPerLine, fastHighlightLineCount } = config.codeEditor.search;

    if (this.textMap && found.match.length >= 3 && lines.length < fastHighlightLineCount) {
      startRow = 0, endRow = lines.length - 1;
    }

    let stop = false;
    const ts = window.performance.now();

    for (let row = startRow; row <= endRow; row++) {
      if (stop) break;
      const line = lines[row] || '';
      for (let col = 0; col < Math.min(line.length, maxCharsPerLine); col++) {
        if (window.performance.now() - ts > 300) { stop = true; break; }
        const matched = caseSensitive
          ? line.slice(col).indexOf(found.match) === 0
          : line.slice(col).toLowerCase().indexOf(found.match.toLowerCase()) === 0;
        if (matched) {
          text.addMarker({
            id: 'search-highlight-' + i++,
            range: { start: { row, column: col }, end: { row, column: col + found.match.length } },
            style: {
              'border-radius': '4px',
              'background-color': 'rgba(255, 200, 0, 0.3)',
              'box-shadow': '0 0 4px rgba(255, 200, 0, 0.3)',
              'pointer-events': 'none'
            }
          });
          col += found.match.length;
        }
      }
    }

    let positionRange;
    if (this.state.backwards) {
      const { row, column } = found.range.start;
      positionRange = { start: { row, column }, end: { row, column: column + 1 } };
    } else {
      const { row, column } = found.range.end;
      positionRange = { start: { row, column: column - 1 }, end: { row, column } };
    }

    text.addMarker({
      id: 'search-highlight-cursor',
      range: positionRange,
      style: {
        'pointer-events': 'none',
        'box-sizing': 'border-box',
        [this.state.backwards ? 'border-left' : 'border-right']: '3px red solid'
      }
    });

    this.textMap && this.textMap.update();
  }

  addSearchMarkersForPreview (found, noCursor = true) {
    if (!found) return;
    this.addSearchMarkers(found, false, this.state.caseMode);
    noCursor && this.target.removeMarker('search-highlight-cursor');
  }

  prepareForNewSearch () {
    const { target: text, state, view, ui: { searchInput } } = this;
    const world = text.world();

    if (!world) return;
    view.openInWorld(world.visibleBounds().center(), world);
    view.topRight = text.globalBounds().insetBy(5).topRight().addXY(0, text.padding.top());
    if (text.verticalScrollbarVisible) view.topRight = view.topRight.subXY(text.scrollbarOffset.x, 0);

    if (text.getWindow()) once(text.getWindow(), 'remove', view, 'remove');

    const { scroll, selection: sel } = text;
    state.position = sel.lead;
    state.before = {
      scroll,
      position: sel.lead,
      selectionRange: sel.range,
      selectionReverse: sel.isReverse()
    };

    if (state.last && state.last.found) {
      this.withoutBindingsDo(() => this.input = state.last.needle);
      this.addSearchMarkersForPreview(state.last.found, false, state.caseMode);
    }

    this.focus();
    if (!text.selection.isEmpty()) {
      searchInput.textString = text.selectionOrLineString();
      text.selection.collapse();
    } else searchInput.selectAll();
  }

  advance (backwards) {
    const { inProgress } = this.state;
    if (inProgress && inProgress.found) {
      const dirChange = backwards !== this.state.backwards;
      const { found: { range: { start, end } } } = inProgress;
      this.state.position = dirChange
        ? (backwards ? end : start)
        : (backwards ? start : end);
    }
    this.state.backwards = backwards;
    return this.search();
  }

  searchNext () { return this.advance(false); }
  searchPrev () { return this.advance(true); }

  search () {
    if (!this.input) {
      this.cleanup();
      return null;
    }

    const state = this.state; const { backwards, position, caseMode } = state;
    const opts = { backwards, start: position, caseSensitive: this.state.caseMode };
    const found = this.target.search(this.input, opts);

    const result = this.state.inProgress = { ...opts, needle: this.input, found };
    this.applySearchResult(result);
    if (found) {
      this.addSearchMarkers(found, backwards, caseMode);
    } else {
      this.cleanup();
    }
    return result;
  }

  get keybindings () {
    return [
      { keys: 'Enter', command: 'search next or replace and go to next' },
      { keys: 'Alt-Enter', command: 'only search prev' },
      { keys: 'Tab', command: 'change focus' },
      { keys: { mac: 'Ctrl-O', win: 'Alt-O' }, command: 'occur with search term' },
      { keys: 'Ctrl-W', command: 'yank next word from text' },
      { keys: 'Escape', command: 'cancel search' },
      { keys: { win: 'Ctrl-F|Ctrl-S|Ctrl-G', mac: 'Meta-F|Ctrl-S|Meta-G' }, command: 'search next' },
      { keys: { win: 'Ctrl-Shift-F|Ctrl-R|Ctrl-Shift-G', mac: 'Meta-Shift-F|Ctrl-R|Meta-Shift-G' }, command: 'search prev' }
    ];
  }

  get commands () {
    return [
      {
        name: 'occur with search term',
        exec: async () => {
          const { occurStartCommand } = await System.import('lively.ide/text/occur.js');
          this.target.addCommands([occurStartCommand]);
          this.execCommand('accept search');
          return this.target.execCommand('occur', { needle: this.input });
        }
      },
      { name: 'accept search', exec: () => { this.acceptSearch(); return true; } },
      { name: 'cancel search and reset cursor in text', exec: () => { this.cancelSearch(true); return true; } },
      { name: 'cancel search', exec: () => { this.cancelSearch(false); return true; } },
      { name: 'search next', exec: () => { this.searchNext(); return true; } },
      { name: 'search prev', exec: () => { this.searchPrev(); return true; } },
      { name: 'only search prev', exec: () => { if (this.ui.searchInput.isFocused()) { this.searchPrev(); return true; } } },

      {
        name: 'search next or replace and go to next',
        exec: (_, args, count) => {
          this.ui.searchInput.acceptInput();
          return this.execCommand(
            this.ui.replaceInput.isFocused()
              ? 'replace and go to next'
              : 'search next', args, count);
        }
      },

      {
        name: 'replace current search location with replace input',
        exec: () => {
          const search = Path('state.inProgress').get(this);
          if (search.found) {
            let replacement = this.ui.replaceInput.textString;
            this.ui.replaceInput.acceptInput(); // for history
            if (search.needle instanceof RegExp) {
              replacement = search.found.match.replace(search.needle, replacement);
            }
            this.target.replace(search.found.range, replacement);
          }
          return true;
        }
      },

      {
        name: 'replace and go to next',
        exec: () => {
          this.execCommand('replace current search location with replace input');
          this.execCommand(this.state.backwards ? 'search prev' : 'search next');
          return true;
        }
      },

      {
        name: 'replace all',
        exec: () => {
          let search = Path('state.inProgress').get(this);
          const { replaceInput } = this.ui;
          if (search.found) {
            search = { ...search, start: { row: 0, column: 0 } };

            let replacement = replaceInput.textString;
            replaceInput.acceptInput(); // for history

            const allMatches = new TextSearcher(this.target).searchForAll(search);

            this.target.undoManager.group();
            allMatches.forEach(found => {
              const { range, match } = found;
              if (search.needle instanceof RegExp) {
                replacement = match.replace(search.needle, replacement);
              }
              this.target.replace(range, replacement, true, true, false);
            });
            this.target.undoManager.group();
            this.acceptSearch();
          }
          return true;
        }
      },

      {
        name: 'change focus',
        exec: () => {
          const { searchInput, replaceInput } = this.ui;
          if (searchInput.isFocused()) { replaceInput.focus(); } else { searchInput.focus(); }
          return true;
        }
      },

      {
        name: 'yank next word from text',
        exec: () => {
          const text = this.target;
          const word = text.wordRight();
          const input = this.ui.searchInput;
          if (!input.selection.isEmpty()) input.selection.text = '';
          const string = text.textInRange({ start: text.cursorPosition, end: word.range.end });
          input.textString += string;
          return true;
        }
      }
    ];
  }
}

export const searchCommands = [
  {
    name: 'search in text',
    exec: async (morph, opts = { backwards: false }) => {
      // update text/commands!
      const { SearchWidget } = await System.import('lively.ide/text/search.cp.js');
      const search = morph._searchWidget ||
        (morph._searchWidget = part(SearchWidget, { viewModel: { target: morph }, extent: pt(300, 55) }));
      search.state.backwards = opts.backwards;
      search.prepareForNewSearch();

      search._reuseTextMap = !!morph.textMap;
      if (config.codeEditor.search.showTextMap && !search._reuseTextMap) {
        morph.showTextMap();
      }
      return true;
    }
  }
];
