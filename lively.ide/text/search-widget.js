import { Morph, config, Icon, GridLayout, StyleSheet, morph, InputLine } from 'lively.morphic';
import { Color, Rectangle, pt } from 'lively.graphics';
import { connect, disconnect } from 'lively.bindings';
import { Path } from 'lively.lang';
import { Button } from 'lively.components';
import { occurStartCommand } from 'lively.morphic/text/occur.js';
import TextMap from './map.js';

export class SearchWidget extends Morph {
  static get properties () {
    return {
      name: { defaultValue: 'search widget' },
      borderWidth: { defaultValue: 1 },
      borderColor: { defaultValue: Color.gray },
      borderRadius: { defaultValue: 3 },
      fill: { defaultValue: Color.black.withA(0.6) },

      target: {},

      input: {
        after: ['submorphs'],
        get () {
          let text = this.get('searchInput').textString;
          let reMatch = text.match(/^\/(.*)\/([a-z]*)$/);
          return reMatch ? new RegExp(reMatch[1], reMatch[2]) : text;
        },
        set (v) {
          this.get('searchInput').textString = String(v);
        }
      },

      fontSize: {
        after: ['submorphs'],
        get () {
          return this.get('searchInput').fontSize;
        },
        set (v) {
          this.get('replaceInput').fontSize = v;
        }
      },

      fontFamily: {
        after: ['submorphs'],
        get () {
          return this.get('searchInput').fontFamily;
        },
        set (v) {
          this.get('searchInput').fontFamily = v;
          this.get('replaceInput').fontFamily = v;
        }
      },

      styleSheets: {
        initialize () {
          this.styleSheets = new StyleSheet({
            '.Button.nav': {
              extent: pt(24, 24),
              opacity: 0.9,
              borderWidth: 0,
              fill: Color.transparent
            },
            '.Button.nav [name=label]': {
              fontSize: 18,
              fontColor: Color.white
            },
            '.Button.replace': {
              borderWidth: 2,
              borderColor: Color.white,
              fill: Color.transparent
            },
            '.Button.replace [name=label]': {
              fontColor: Color.white
            },
            '.InputLine [name=placeholder]': {
              fontSize: 14,
              fontFamily: 'Monaco, monospace'
            },
            '.InputLine': {
              fill: Color.gray.withA(0.2),
              fontSize: 14,
              fontFamily: 'Monaco, monospace',
              fontColor: Color.white,
              borderWidth: 1,
              borderColor: Color.gray,
              padding: Rectangle.inset(2)
            }
          });
        }
      },

      layout: {
        initialize () {
          this.layout = new GridLayout({
            groups: {
              nextButton: { resize: false },
              prevButton: { resize: false },
              acceptButton: { resize: false },
              cancelButton: { resize: false }
            },
            rows: [
              0,
              { fixed: 30, paddingTop: 5, paddingBottom: 2.5 },
              1,
              { fixed: 30, paddingTop: 2.5, paddingBottom: 5 }
            ],
            columns: [
              0,
              { paddingLeft: 5, paddingRight: 5 },
              1,
              { fixed: 20 },
              2,
              { fixed: 20 },
              3,
              { fixed: 20 },
              4,
              { fixed: 20 },
              5,
              { fixed: 5 }
            ],
            grid: [
              ['searchInput', 'nextButton', 'prevButton', 'acceptButton', 'cancelButton', null],
              [
                'replaceInput',
                'replaceButton',
                'replaceButton',
                'replaceButton',
                'replaceButton',
                null
              ]
            ]
          });
        }
      },

      submorphs: {
        after: ['extent'],
        initialize () {
          let fontSize = 14; let fontFamily = 'Monaco, monospace';

          this.submorphs = [
            new Button({
              name: 'acceptButton',
              label: Icon.textAttribute('check-circle-o'),
              styleClasses: ['nav']
            }).fit(),
            new Button({
              name: 'cancelButton',
              label: Icon.textAttribute('times-circle-o'),
              styleClasses: ['nav']
            }).fit(),
            new Button({
              name: 'nextButton',
              label: Icon.textAttribute('arrow-circle-o-down'),
              styleClasses: ['nav']
            }).fit(),
            new Button({
              name: 'prevButton',
              label: Icon.textAttribute('arrow-circle-o-up'),
              styleClasses: ['nav']
            }).fit(),
            new InputLine({
              name: 'searchInput',
              clipMode: 'visible',
              width: this.width,
              height: 20,
              placeholder: 'search input',
              historyId: 'lively.morphic-text search'
            }),
            new InputLine({
              name: 'replaceInput',
              clipMode: 'visible',
              width: this.width,
              height: 20,
              placeholder: 'replace input',
              historyId: 'lively.morphic-text replace'
            }),
            new Button({
              styleClasses: ['replace'],
              name: 'replaceButton',
              label: 'replace',
              extent: pt(80, 20)
            })
          ];
        }
      }
    };

    {
      ['submorphs'];
    }
  }

  constructor (props = {}) {
    if (props.targetText) props.target = props.targetText;
    if (!props.target) throw new Error('SearchWidget needs a target text morph!');

    super(props);

    let replaceButton = this.getSubmorphNamed('replaceButton');
    let replaceInput = this.getSubmorphNamed('replaceInput');
    let searchInput = this.getSubmorphNamed('searchInput');
    let prevButton = this.getSubmorphNamed('prevButton');
    let nextButton = this.getSubmorphNamed('nextButton');
    let cancelButton = this.getSubmorphNamed('cancelButton');
    let acceptButton = this.getSubmorphNamed('acceptButton');
    connect(acceptButton, 'fire', this, 'execCommand', { converter: () => 'accept search' });
    connect(cancelButton, 'fire', this, 'execCommand', { converter: () => 'cancel search' });
    connect(nextButton, 'fire', this, 'execCommand', { converter: () => 'search next' });
    connect(prevButton, 'fire', this, 'execCommand', { converter: () => 'search prev' });
    connect(searchInput, 'inputChanged', this, 'search');
    connect(replaceButton, 'fire', this, 'execCommand', { converter: () => 'replace and go to next' });

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    this.state = {
      backwards: false,
      before: null,
      position: null,
      inProgress: null,
      last: null
    };

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    // override existing commands
    searchInput.addCommands([
      {
        name: 'realign top-bottom-center',
        exec: async () => {
          this.target.execCommand('realign top-bottom-center');
          this.addSearchMarkersForPreview(
            this.state.inProgress && this.state.inProgress.found, false);
          return true;
        }
      }
    ]);
  }

  focus () {
    this.get('searchInput').focus();
  }

  cleanup () {
    this.removeSearchMarkers();
    this.state.inProgress = null;
    this.textMap && this.textMap.update();
  }

  cancelSearch () {
    if (this.state.inProgress) { this.state.last = this.state.inProgress; }
    this.cleanup();
    this.removeTextMap();
    if (this.state.before) {
      let { scroll, selectionRange } = this.state.before;
      this.target.selection = selectionRange;
      this.target.scroll = scroll;
      this.state.before = null;
    }
    this.remove();
    this.target.focus();
  }

  acceptSearch () {
    if (this.state.inProgress) { this.state.last = this.state.inProgress; }
    if (this.applySearchResult(this.state.inProgress)) { this.state.before && this.target.saveMark(this.state.before.position); }
    this.get('searchInput').acceptInput(); // for history
    this.cleanup();
    this.removeTextMap();
    this.state.before = null;
    this.remove();
    this.target.focus();
  }

  applySearchResult (searchResult) {
    // searchResult = {found, backwards, ...}
    if (!searchResult || !searchResult.found) return null;
    let text = this.target;
    let sel = text.selection;
    let select = !!text.activeMark || !sel.isEmpty();
    let { backwards, found: { range: { start, end } } } = searchResult;
    let pos = backwards ? start : end;
    select ? sel.lead = pos : text.cursorPosition = pos;
    if (!text.isLineFullyVisible(pos.row)) text.centerRow();
    return searchResult;
  }

  removeSearchMarkers () {
    (this.target.markers || []).forEach(({ id }) =>
      id.startsWith('search-highlight') && this.target.removeMarker(id));
  }

  addSearchMarkers (found) {
    this.removeSearchMarkers();

    let { target: text, textMap } = this;
    let { startRow, endRow } = text.whatsVisible;
    let lines = text.document.lineStrings;
    let i = 0;
    let { maxCharsPerLine, fastHighlightLineCount } = config.codeEditor.search;

    if (textMap && found.match.length >= 3 && lines.length < fastHighlightLineCount) {
      startRow = 0, endRow = lines.length - 1;
    }
    for (let row = startRow; row <= endRow; row++) {
      let line = lines[row] || '';
      for (let col = 0; col < Math.min(line.length, maxCharsPerLine); col++) {
        if (line.slice(col).toLowerCase().indexOf(found.match.toLowerCase()) === 0) {
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
      let { row, column } = found.range.start;
      positionRange = { start: { row, column }, end: { row, column: column + 1 } };
    } else {
      let { row, column } = found.range.end;
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

    textMap && textMap.update();
  }

  addSearchMarkersForPreview (found, noCursor = true) {
    if (!found) return;
    this.addSearchMarkers(found);
    noCursor && this.target.removeMarker('search-highlight-cursor');
  }

  prepareForNewSearch () {
    let { target: text, state } = this;
    let world = text.world();

    if (!world) return;
    this.openInWorld(world.visibleBounds().center(), world);
    this.topRight = text.globalBounds().insetBy(5).topRight();

    let inputMorph = this.get('searchInput');
    let { scroll, selection: sel } = text;
    state.position = sel.lead;
    state.before = {
      scroll,
      position: sel.lead,
      selectionRange: sel.range,
      selectionReverse: sel.isReverse()
    };

    if (state.last && state.last.found) {
      // FIXME...! noUpdate etc
      disconnect(inputMorph, 'inputChanged', this, 'search');
      this.input = state.last.needle;
      connect(inputMorph, 'inputChanged', this, 'search');
      this.addSearchMarkersForPreview(state.last.found);
    }

    inputMorph.selectAll();
    this.focus();
  }

  advance (backwards) {
    let { inProgress } = this.state;
    if (inProgress && inProgress.found) {
      let dirChange = backwards !== this.state.backwards;
      let { found: { range: { start, end } } } = inProgress;
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

    let state = this.state; let { backwards, inProgress, position } = state;
    let opts = { backwards, start: position };
    let found = this.target.search(this.input, opts);

    let result = this.state.inProgress = { ...opts, needle: this.input, found };
    this.applySearchResult(result);
    found && this.addSearchMarkers(found, backwards);
    return result;
  }

  showTextMap () {
    let textMap = this.textMap = new TextMap();
    textMap.attachTo(this.target);
    textMap.isLayoutable = false;
    this.addMorph(textMap);
    textMap.topRight = this.innerBounds().bottomRight();
    textMap.height = this.target.height - this.height - 10;
    textMap.update();
    return textMap;
  }

  removeTextMap () {
    if (this.textMap) {
      this.textMap.remove();
      this.textMap.detachFromCurrentTextMorph();
      this.textMap = null;
    }
  }

  get keybindings () {
    return [
      { keys: 'Enter', command: 'accept search or replace and go to next' },
      { keys: 'Tab', command: 'change focus' },
      { keys: 'Ctrl-O', command: 'occur with search term' },
      { keys: 'Ctrl-W', command: 'yank next word from text' },
      { keys: 'Escape|Ctrl-G', command: 'cancel search' },
      { keys: { win: 'Ctrl-F|Ctrl-S|Ctrl-G', mac: 'Meta-F|Ctrl-S|Meta-G' }, command: 'search next' },
      { keys: { win: 'Ctrl-Shift-F|Ctrl-R|Ctrl-Shift-G', mac: 'Meta-Shift-F|Ctrl-R|Meta-Shift-G' }, command: 'search prev' }
    ];
  }

  get commands () {
    return [
      {
        name: 'occur with search term',
        exec: () => {
          this.target.addCommands([occurStartCommand]);
          this.execCommand('accept search');
          return this.target.execCommand('occur', { needle: this.input });
        }
      },
      { name: 'accept search', exec: () => { this.acceptSearch(); return true; } },
      { name: 'cancel search', exec: () => { this.cancelSearch(); return true; } },
      { name: 'search next', exec: () => { this.searchNext(); return true; } },
      { name: 'search prev', exec: () => { this.searchPrev(); return true; } },

      {
        name: 'accept search or replace and go to next',
        exec: (_, args, count) => {
          return this.execCommand(
            this.get('replaceInput').isFocused()
              ? 'replace and go to next'
              : 'accept search', args, count);
        }
      },

      {
        name: 'replace current search location with replace input',
        exec: () => {
          let search = Path('state.inProgress').get(this);
          if (search.found) {
            let replacement = this.get('replaceInput').textString;
            this.get('replaceInput').get('replaceInput').acceptInput(); // for history
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
        name: 'change focus',
        exec: () => {
          if (this.get('searchInput').isFocused()) { this.get('replaceInput').focus(); } else { this.get('searchInput').focus(); }
          return true;
        }
      },

      {
        name: 'yank next word from text',
        exec: () => {
          let text = this.target;
          let word = text.wordRight();
          let input = this.get('searchInput');
          if (!input.selection.isEmpty()) input.selection.text = '';
          let string = text.textInRange({ start: text.cursorPosition, end: word.range.end });
          input.textString += string;
          return true;
        }
      }
    ];
  }
}

export var searchCommands = [
  {
    name: 'search in text',
    exec: (morph, opts = { backwards: false }) => {
      let search = morph._searchWidget ||
        (morph._searchWidget = new SearchWidget({ target: morph, extent: pt(300, 20) }));
      search.state.backwards = opts.backwards;
      search.prepareForNewSearch();

      if (config.codeEditor.search.showTextMap) {
        search.showTextMap();
      }
      return true;
    }
  }
];
