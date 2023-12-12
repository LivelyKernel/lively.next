/* global System */

import { once } from 'lively.bindings';
import { arr, string } from 'lively.lang';

import config from 'lively.morphic/config.js';
import { ViewModel, part } from 'lively.morphic/components/core.js';

import { comparePosition, lessEqPosition } from 'lively.morphic/text/position.js';
import { debounceNamed } from '../../lively.lang/function';
import { Color } from 'lively.graphics';

export class TextSearcher {
  constructor (morph) {
    this.morph = morph;
  }

  get document () { return this.morph.document; }

  /**
   * Helper function that is used to map starting positions and lengths of search results to valid text ranges.
   * @param {number} start
   * @param {string} match
   * @returns {object} An object containing a range beginning at `start` and ending after the length of `match`.
   */
  calculateRangeForFind (start, match) {
    const i = this.document.positionToIndex(start);
    const end = this.document.indexToPosition(i + match.length);
    return { range: { start, end }, match };
  }

  /**
   * Searches for the first occurrence of a given string `needle` inside of a text.
   * @param {string[]} lines - The text which parts of should be searched.
   * @param {string} needle - The string to search for.
   * @param {boolean} caseSensitive - Whether or not the search is case sensitive.
   * @param {number} nLines - The number of lines which need to be searched at once, i.e., the number of lines that `needle` spans.
   * @param {char} char - The character at the current position of the text. Optimization.
   * @param {range} pos - The text position inside of `lines` at which the search for `needle` begins for `nLines`.
   * @returns {?object} `null`, when nothing has been found or an Object containing the range of the result as well as the result.
   */
  stringSearch (lines, needle, caseSensitive, nLines, char, pos) {
    if (!caseSensitive) char = char.toLowerCase();
    if (char !== needle[0]) return null;

    const { row, column } = pos;
    const lineString = lines[row];
    const followingText = nLines <= 1 ? '' : '\n' + lines.slice(row + 1, (row + 1) + (nLines - 1)).join('\n');
    const chunk = lineString.slice(column) + followingText;
    const chunkToTest = caseSensitive ? chunk : chunk.toLowerCase();

    return chunkToTest.indexOf(needle) !== 0
      ? null
      : this.calculateRangeForFind({ row, column }, chunk.slice(0, needle.length));
  }

  /**
   * Searches for the first hit of a given RegEx `needle` inside of a text.
   * @param {string[]} lines - The text which parts of should be searched.
   * @param {string} needle - The RegEx to apply for searching.
   * @param {boolean} multiline - Whether more than one line should be searched.
   * @param {boolean} char - unused placeholder to provide the same interface as `stringSearch`
   * @param {range} pos - The text position inside of `lines` at which the search for `needle` begins for `nLines`.
   * @returns {?object} `null`, when nothing has been found or an Object containing the range of the result as well as the result.
   */
  reSearch (lines, needle, multiline, char, pos) {
    const { row, column } = pos;
    const chunk = lines[row].slice(column) + (multiline ? '\n' + lines.slice(row + 1).join('\n') : '');
    const reMatch = chunk.match(needle);
    return reMatch ? this.calculateRangeForFind({ row, column }, reMatch[0]) : null;
  }

  /**
   * Wrapper around reSearch and stringSearch, that choses the right method to search based on the `needle` to search for.
   * @param {object} options - An Object that can contain `needle`, `start`, `backwards`, and `caseSensitive`. See `stringSearch` and `reSearch` above.
   * @returns {?object} `null`, when nothing has been found or an Object containing the range of the result as well as the result.
   */
  search (options) {
    let { start, needle, backwards, caseSensitive } = {
      start: this.morph.cursorPosition,
      needle: '',
      backwards: false,
      caseSensitive: false,
      ...options // Basically makes the above values default values, that are overwritten with the provided values in options
    };

    if (!needle) return null;

    let search;
    if (needle instanceof RegExp) { // search for regular expression
      const flags = (needle.flags || '').split('');
      const multiline = !!needle.multiline;
      flags.splice(flags.indexOf('m'), 1); // in place modification ಡ_ಡ
      if (!caseSensitive && !flags.includes('i')) flags.push('i');

      needle = new RegExp('^' + needle.source.replace(/^\^+/, ''), flags.join(''));
      search = this.reSearch.bind(this, this.document.lineStrings, needle, multiline); // basically converts reSearch into a function taking two arguments -> char, pos
    } else { // string search
      needle = String(needle);
      if (!caseSensitive) needle = needle.toLowerCase();
      const nLines = needle.split(this.document.constructor.newline).length;
      search = this.stringSearch.bind(this, this.document.lineStrings, needle, caseSensitive, nLines); // basically converts stringSearch into a function taking two arguments -> char, pos
    }

    const result = this.document[backwards ? 'scanBackward' : 'scanForward'](start, search);

    return result === {} ? null : result;
  }

  /**
   * Loops around `search` and takes the position of the last match of the previous run as the start for the next one.
   * Thus, collecting up to 10.000 matches.
   * Will only search in one direction and begin from the specified starting position. Therefore, cases exist where not the whole document get searched.
   * @param {object} options - An Object that can contain `needle`, `start`, `backwards`, and `caseSensitive`. See `stringSearch` and `reSearch` above.
   * @returns {object[]} An array of objects containing a range beginning at `start` and ending after the length of `match`, as well as `match`.
   */
  searchForAll (options) {
    const results = [];
    let i = 0;
    while (true) {
      if (i++ > 10000) throw new Error('endless loop');
      const found = this.search(options);
      if (!found) return results;
      results.push(found);
      options = { ...options, start: options.backwards ? found.range.start : found.range.end };
    }
  }
}

export class SearchWidgetModel extends ViewModel {
  static get properties () {
    return {
      target: {},
      state: {
        initialize () {
          this.state = {
            backwards: false,
            caseMode: false,
            regexMode: false,
            results: []
          };
        }
      },

      currentResultIndex: {
        set (v) {
          this.setProperty('currentResultIndex', v);
          this.showResultNumberHint();
        }
      },

      input: {
        get () {
          const text = this.ui.searchInput.textString;
          if (this.state.regexMode) {
            const reMatch = text.match(/^\/(.*)\/([a-z]*)$/);
            if (reMatch) { // are flags specified?
              return RegExp(reMatch[1], reMatch[2]);
            }
            return new RegExp(text);
          }
          return text;
        },
        set (v) { this.ui.searchInput.textString = String(v); }
      },

      results: {
        defaultValue: []
      },

      replaceInput: {
        get () {
          return this.ui.replaceInput.textString;
        },
        set (v) {
          this.ui.replaceInput.textString = String(v);
        }
      },

      textMap: {
        get () {
          return this.target.textMap;
        }
      },

      expose: {
        get () {
          return ['state', 'prepareForNewSearch', 'commands', 'keybindings', 'isSearchWidget', '_reuseTextMap'];
        }
      },

      bindings: {
        get () {
          return [
            { target: 'searchInput', signal: 'onBlur', handler: 'onBlur' },
            { target: 'replaceInput', signal: 'onBlur', handler: 'onBlur' },
            { signal: 'onBlur', handler: 'onBlur', override: true },
            { target: 'nextButton', signal: 'fire', handler: 'execCommand', converter: () => 'goto next result' },
            { target: 'prevButton', signal: 'fire', handler: 'execCommand', converter: () => 'goto previous result' },
            { target: 'searchInput', signal: 'inputChanged', handler: 'search' },
            { target: 'replaceButton', signal: 'fire', handler: 'execCommand', converter: () => 'replace and go to next' },
            { target: 'replaceAllButton', signal: 'fire', handler: 'execCommand', converter: () => 'replace all' },
            { target: 'caseModeButton', signal: 'fire', handler: 'toggleCaseMode' },
            { target: 'regexModeButton', signal: 'fire', handler: 'toggleRegexMode' }
          ];
        }
      }

    };
  }

  get isSearchWidget () {
    return true;
  }

  viewDidLoad () {
    if (this.targetText) this.target = this.targetText;
    if (!this.target) throw new Error('SearchWidget needs a target text morph!');
    this.setProperty('currentResultIndex', 0);
    if (this.input) this.search();
    this.ui.regexModeButton.master.setState('disabled');
    this.ui.caseModeButton.master.setState('disabled');
    this.ui.replaceAllButton.master.setState('disabled');
    this.ui.replaceButton.master.setState('disabled');
  }

  toggleRegexMode () {
    this.state.regexMode = !this.state.regexMode;
    this.ui.regexModeButton.master.setState(this.state.regexMode ? null : 'disabled');

    this.cleanup();
    this.search();
  }

  toggleCaseMode () {
    this.state.caseMode = !this.state.caseMode;
    this.ui.caseModeButton.master.setState(this.state.caseMode ? null : 'disabled');

    this.cleanup();
    this.search();
  }

  async focus () {
    this.ui.searchInput.focus();
  }

  /**
   * Keeps the search widget around when one just clicks a button in the widget or uses the text map.
   * @param {Event} evt - The event causing the blur handler to be invoked.
   */
  onBlur (evt) {
    const world = this.world();
    const { view, ui: { searchInput, replaceInput } } = this;
    if (!world) return;
    setTimeout(() => {
      const focusedMorph = world.focusedMorph;
      if (!view.withAllSubmorphsDetect(m => m.isFocused()) &&
         !$world.focusedMorph.isTextMap) {
        this.close();
        return;
      }
      view.bringToFront();
      if (searchInput !== focusedMorph &&
        replaceInput !== focusedMorph) {
        searchInput.focus();
      }
    });
  }

  cleanup () {
    this.removeSearchMarkers();
    this.results = [];
    this.currentResultIndex = 0;
    this.textMap && this.textMap.update();
  }

  close () {
    this.ui.searchInput.acceptInput();
    this.cleanup();
    if (!this._reuseTextMap) this.target.removeTextMap();
    this.view.remove();
    this.target.focus();
  }

  moveCursorToNextResult (backwards = false) {
    if (this.results.length === 0) return;

    this.state.backwards = backwards;

    const text = this.target;
    const sel = text.selection;
    const select = !!text.activeMark || !sel.isEmpty();

    if (backwards) this.currentResultIndex = this.currentResultIndex - 1 === -1 ? this.results.length - 1 : this.currentResultIndex - 1;
    else this.currentResultIndex = this.currentResultIndex + 1 === this.results.length ? 0 : this.currentResultIndex + 1;

    const { range: { start, end } } = this.results[this.currentResultIndex];

    const pos = backwards ? end : start;
    select ? sel.lead = pos : text.cursorPosition = pos;

    if (!text.isLineFullyVisible(pos.row)) text.centerRow();
    this.updateCursorMarker();
  }

  removeSearchMarkers () {
    (this.target.markers || []).forEach(({ id }) =>
      id.startsWith('search-highlight') && this.target.removeMarker(id));
  }

  addSearchMarkers () {
    this.removeSearchMarkers();
    const { target: text } = this;

    this.results.forEach((searchResult, i) => {
      text.addMarker({
        id: 'search-highlight-' + i,
        range: searchResult.range,
        style: {
          'border-radius': '4px',
          'background-color': 'rgba(255, 200, 0, 0.3)',
          'box-shadow': '0 0 4px rgba(255, 200, 0, 0.3)',
          'pointer-events': 'none'
        }
      });
    });

    this.updateCursorMarker();
    this.textMap && this.textMap.update();
  }

  updateCursorMarker () {
    this.target.removeMarker('search-highlight-cursor');

    const resultAtCursor = this.results[this.currentResultIndex];
    let positionRange;
    if (this.state.backwards) {
      const { row, column } = resultAtCursor.range.end;
      positionRange = { start: { row, column }, end: { row, column: column + 1 } };
    } else {
      const { row, column } = resultAtCursor.range.start;
      positionRange = { start: { row, column: column - 1 }, end: { row, column } };
    }

    this.createCursorMarker(positionRange);
  }

  createCursorMarker (range) {
    this.target.addMarker({
      id: 'search-highlight-cursor',
      range: range,
      style: {
        'pointer-events': 'none',
        'box-sizing': 'border-box',
        [this.state.backwards ? 'border-left' : 'border-right']: '3px red solid'
      }
    });
  }

  prepareForNewSearch () {
    const { target: text, view, ui: { searchInput } } = this;

    const world = text.world();
    if (!world) return;

    view.openInWorld(world.visibleBounds().center(), world);
    view.topRight = text.globalBounds().insetBy(5).topRight().addXY(0, text.padding.top());
    if (text.verticalScrollbarVisible) view.topRight = view.topRight.subXY(text.scrollbarOffset.x, 0);

    if (text.getWindow()) once(text.getWindow(), 'remove', view, 'remove');

    this.focus();
    if (!text.selection.isEmpty()) {
      searchInput.textString = text.selectionOrLineString();
      text.selection.collapse();
    } else searchInput.selectAll();

    if (this.input.length > 0) {
      this.search();
    } else this.showNoSearchHint();
  }

  showNoSearchHint () {
    this.ui.resultIndexLabel.textString = 'no search';
    this.ui.resultTotalLabel.fontColor = Color.lively.withA(0);
    this.ui.nextButton.master.setState('disabled');
    this.ui.prevButton.master.setState('disabled');
  }

  showResultNumberHint () {
    if (this.results.length > 10000) {
      this.ui.resultIndexLabel.textString = '> 10000';
      this.ui.resultTotalLabel.fontColor = Color.lively.withA(0);
    } else {
      this.ui.resultTotalLabel.fontColor = Color.lively.withA(1);
      this.ui.resultIndexLabel.textString = (this.results.length === 0 ? 0 : this.currentResultIndex + 1) + '/';
      this.ui.resultTotalLabel.textString = this.results.length;
    }

    if (this.results.length > 0) {
      this.ui.nextButton.master.setState(null);
      this.ui.prevButton.master.setState(null);
      this.ui.replaceButton.master.setState(null);
      this.ui.replaceAllButton.master.setState(null);
    } else {
      this.ui.nextButton.master.setState('disabled');
      this.ui.prevButton.master.setState('disabled');
      this.ui.replaceButton.master.setState('disabled');
      this.ui.replaceAllButton.master.setState('disabled');
    }
  }

  search () {
    debounceNamed('search', 10, () => {
      if (!this.input) {
        this.cleanup();
        this.showNoSearchHint();
        return;
      }

      const opts = { start: { column: 0, row: 0 }, caseSensitive: this.state.caseMode };
      let found = new TextSearcher(this.target).searchForAll({ needle: this.input, ...opts });

      found = found.sort((a, b) => comparePosition(a.range, b.range));

      this.results = found;

      if (found.length > 0) {
        const currPos = this.target.cursorPosition;
        const resultsBehindCursor = this.results.filter(resPos => lessEqPosition(currPos, resPos.range.start));
        const firstResultBehindCursor = resultsBehindCursor[0];
        const resultsBeforeCursor = this.results.filter(resPos => !lessEqPosition(currPos, resPos.range.start));
        const firstResultBeforeCursor = arr.last(resultsBeforeCursor);
        if (!firstResultBehindCursor) this.currentResultIndex = this.results.findIndex((res) => res === firstResultBeforeCursor);
        else if (!firstResultBeforeCursor) this.currentResultIndex = this.results.findIndex((res) => res === firstResultBehindCursor);
        else if (comparePosition(firstResultBehindCursor.range.start, firstResultBeforeCursor.range.start) === 0) this.currentResultIndex = this.results.findIndex((res) => res === firstResultBehindCursor);
        else {
          const distanceToBefore = { row: Math.abs(currPos.row - firstResultBeforeCursor.range.end.row), column: Math.abs(currPos.column - firstResultBeforeCursor.range.end.column) };
          const distanceToBehind = { row: Math.abs(currPos.row - firstResultBehindCursor.range.start.row), column: Math.abs(currPos.column - firstResultBehindCursor.range.start.column) };
          this.currentResultIndex = lessEqPosition(distanceToBefore, distanceToBehind) ? this.results.findIndex((res) => res === firstResultBeforeCursor) : this.results.findIndex((res) => res === firstResultBehindCursor);
        }
        this.addSearchMarkers();
        const { range: { start, end } } = this.results[this.currentResultIndex];
        let positionRange = { start: { row: start.row, column: start.column - 1 }, end: { row: end.row, column: end.column } };
        this.createCursorMarker(positionRange);
        this.target.centerRow(positionRange.start.row);
        this.target.cursorPosition = positionRange.end;
      } else {
        this.cleanup();
      }
    })();
  }

  get keybindings () {
    return [
      { keys: 'Enter', command: 'search next or replace and go to next' },
      { keys: 'Alt-Enter', command: { command: 'search next or replace and go to next', args: { direction: 'backwards' } } },
      { keys: 'Tab', command: 'change focus' },
      { keys: { mac: 'Ctrl-O', win: 'Alt-O' }, command: 'occur with search term' },
      { keys: 'Escape', command: 'remove search widget' }
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
      { name: 'remove search widget', exec: () => { this.close(); return true; } },
      { name: 'goto next result', exec: () => { this.moveCursorToNextResult(); return true; } },
      { name: 'goto previous result', exec: () => { this.moveCursorToNextResult(true); return true; } },

      {
        name: 'search next or replace and go to next',
        exec: (_, args) => {
          if (args?.direction === 'backwards') this.state.backwards = true;
          else this.state.backwards = false;
          this.ui.searchInput.acceptInput();
          if (this.replaceInput) this.ui.replaceInput.acceptInput();
          return this.execCommand(
            this.ui.replaceInput.isFocused()
              ? 'replace and go to next'
              : (this.state.backwards ? 'goto previous result' : 'goto next result'));
        }
      },

      {
        name: 'replace current search location with replace input',
        exec: () => {
          const { replaceInput } = this.ui;
          if (this.replaceInput.length > 0) {
            replaceInput.acceptInput();
            let replacement = this.replaceInput;
            this.target.replace(this.results[this.currentResultIndex].range, replacement);
          }
          return true;
        }
      },
      {
        name: 'replace and go to next',
        exec: () => {
          if (this.state.backwards) this.execCommand('goto previous result');
          this.execCommand('replace current search location with replace input');
          if (!this.state.backwards) this.execCommand('goto next result');
          this.search();
          return true;
        }
      },

      {
        name: 'replace all',
        exec: () => {
          const { target } = this;
          const { replaceInput } = this.ui;
          let currentSourceString = target.textString;
          let replacement = replaceInput.textString;
          replaceInput.acceptInput();

          let lineOfLastMatch = -1;
          let offsetForCurrentLine = 0;
          const replacements = [];
          this.results.forEach(found => {
            const { range, match } = found;
            const lineOfCurrentMatch = range.start.row;
            if (lineOfCurrentMatch === lineOfLastMatch) {
              offsetForCurrentLine += (replacement.length - match.length);
            } else offsetForCurrentLine = 0;
            lineOfLastMatch = lineOfCurrentMatch;
            const start = target.positionToIndex(range.start);
            const end = target.positionToIndex(range.end);
            replacements.unshift(
              { action: 'remove', start, end },
              { action: 'insert', start, lines: [replacement] }
            );
            range.start.column += offsetForCurrentLine;
            range.end.column += offsetForCurrentLine;
          });
          target.textString = string.applyChanges(currentSourceString, replacements);
          this.search();
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
      }
    ];
  }
}

export const searchCommands = [
  {
    name: 'search in text',
    exec: async (morph, opts = { backwards: false }) => {
      const { SearchWidget } = await System.import('lively.ide/text/search.cp.js');
      const search = morph._searchWidget ||
        (morph._searchWidget = part(SearchWidget, { viewModel: { target: morph } }));
      search.state.backwards = opts.backwards;
      search.prepareForNewSearch();

      search._reuseTextMap = !!morph.textMap;
      if (config.codeEditor.search.showTextMap && !search._reuseTextMap) {
        morph.showTextMap();
      }
      morph.textMap?.updateDebounced();
      return true;
    }
  }
];
