import { Text, ViewModel, TilingLayout, InputLine, Icon, ShadowObject, Label, component } from 'lively.morphic';
import { pt, Rectangle, rect, Color } from 'lively.graphics';
import { LabeledCheckBoxModel, CheckBoxMorph } from './inputs.js';
import { arr, string, Path as PropertyPath } from 'lively.lang';
import { signal } from 'lively.bindings';

// part(InputLineDefault).
const InputLineDefault = component({
  type: InputLine,
  name: 'input line light',
  highlightWhenFocused: true,
  borderColor: Color.rgb(204, 204, 204),
  borderRadius: 4,
  dropShadow: new ShadowObject({ distance: 3, rotation: 75, color: Color.rgba(0, 0, 0, 0.2) }),
  haloShadow: new ShadowObject({ distance: 4, color: Color.rgba(0, 0, 0, 0.26), blur: 10 }),
  extent: pt(318.1, 34.3),
  fontFamily: 'IBM Plex Sans',
  fontSize: 20,
  padding: rect(10, 3, 0, 0),
  placeholder: 'Name',
  fill: Color.white,
  nativeCursor: 'text',
  submorphs: [{
    type: Label,
    name: 'placeholder',
    fontColor: Color.rgb(204, 204, 204),
    fontFamily: 'IBM Plex Sans',
    fontSize: 20,
    padding: rect(10, 3, 0, 0),
    lineHeight: 1.4,
    reactsToPointer: false,
    textAndAttributes: ['Name', null]
  }]
});

// InputLineDark.openInWorld()
const InputLineDark = component(InputLineDefault, {
  name: 'input line dark',
  fill: Color.rgb(229, 231, 233)
});

const LabeledCheckBox = component({
  defaultViewModel: LabeledCheckBoxModel,
  name: 'labeled check box',
  extent: pt(66, 21),
  fill: Color.rgba(0, 0, 0, 0),
  layout: new TilingLayout({
    axis: 'row',
    wrapSubmorphs: false,
    align: 'top',
    direction: 'leftToRight'
  }),
  submorphs: [{
    type: CheckBoxMorph,
    name: 'checkbox'
  }, {
    type: Label,
    name: 'label',
    extent: pt(51, 21),
    nativeCursor: 'pointer',
    padding: rect(10, 3, -5, 0),
    value: 'a label'
  }]
});

export class SearchFieldModel extends ViewModel {
  static get properties () {
    return {
      input: {
        derived: true,
        set (val) {
          this.ui.searchInput.textString = val;
        },
        get () {
          // hard binding on the root being a text morph
          return this.ui.searchInput.textString || '';
        }
      },
      fuzzy: {
        after: ['filterFunction', 'sortFunction'],
        set (fuzzy) {
          // fuzzy => bool or prop;
          this.setProperty('fuzzy', fuzzy);
          if (!fuzzy) {
            if (this.sortFunction === this.fuzzySortFunction) { this.sortFunction = null; }
            if (this.filterFunction === this.fuzzyFilterFunction) { this.filterFunction = this.defaultFilterFunction; }
          } else {
            if (!this.sortFunction) this.sortFunction = this.fuzzySortFunction;
            if (this.filterFunction === this.defaultFilterFunction) { this.filterFunction = this.fuzzyFilterFunction; }
          }
        }
      },

      filterFunction: {
        get () {
          let filterFunction = this.getProperty('filterFunction');
          if (!filterFunction) return this.defaultFilterFunction;
          if (typeof filterFunction === 'string') { filterFunction = eval(`(${filterFunction})`); }
          return filterFunction;
        }
      },

      sortFunction: {},

      defaultFilterFunction: {
        readOnly: true,
        get () {
          return this._defaultFilterFunction ||
              (this._defaultFilterFunction = (parsedInput, item) =>
                parsedInput.lowercasedTokens.every(token =>
                  item.string.toLowerCase().includes(token)));
        }
      },

      fuzzySortFunction: {
        readOnly: true,
        get () {
          return this._fuzzySortFunction ||
              (this._fuzzySortFunction = (parsedInput, item) => {
                const prop = typeof this.fuzzy === 'string' ? this.fuzzy : 'string';
                // preioritize those completions that are close to the input
                const fuzzyValue = String(PropertyPath(prop).get(item)).toLowerCase();
                let base = 0;
                parsedInput.lowercasedTokens.forEach(t => {
                  if (fuzzyValue.startsWith(t)) base -= 10;
                  else if (fuzzyValue.includes(t)) base -= 5;
                });
                return arr.sum(parsedInput.lowercasedTokens.map(token =>
                  string.levenshtein(fuzzyValue.toLowerCase(), token))) + base;
              });
        }
      },

      fuzzyFilterFunction: {
        get () {
          return this._fuzzyFilterFunction ||
              (this._fuzzyFilterFunction = (parsedInput, item) => {
                const prop = typeof this.fuzzy === 'string' ? this.fuzzy : 'string';
                const tokens = parsedInput.lowercasedTokens;
                if (tokens.every(token => item.string.toLowerCase().includes(token))) return true;
                // "fuzzy" match against item.string or another prop of item
                const fuzzyValue = String(PropertyPath(prop).get(item)).toLowerCase();
                return arr.sum(parsedInput.lowercasedTokens.map(token =>
                  string.levenshtein(fuzzyValue, token))) <= 3;
              });
        }
      },
      placeHolder: { defaultValue: 'Search' },
      expose: {
        get () {
          return ['matches'];
        }
      },
      bindings: {
        get () {
          return [
            { target: 'placeholder icon', signal: 'onMouseDown', handler: 'clearInput' },
            { target: 'search input', signal: 'onChange', handler: 'onInputChange' },
            { target: 'search input', signal: 'onBlur', handler: 'onInputBlur' },
            { target: 'search input', signal: 'onFocus', handler: 'onInputFocus' }
          ];
        }
      }
    };
  }

  parseInput () {
    const filterText = this.input;
    // parser that allows escapes
    const parsed = Array.from(filterText).reduce(
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
    const lowercasedTokens = parsed.tokens.map(ea => ea.toLowerCase());
    return { tokens: parsed.tokens, lowercasedTokens };
  }

  clearInput () {
    this.input = '';
    signal(this, 'searchInput', this.parseInput());
    this.onInputBlur();
  }

  matches (string) {
    if (!this.input) return true;
    return this.filterFunction.call(this, this.parseInput(), { string });
  }

  onInputChange (change) {
    const inputChange = change.selector === 'replace';
    if (this.ui.placeholderIcon) { this.ui.placeholderIcon.visible = !!this.input; }
    if (this.input.includes('\n')) {
      this.input = this.input.replace('\n', '');
    }
    this.active && inputChange && signal(this, 'searchInput', this.parseInput());
  }

  onInputBlur (evt) {
    this.active = false;
    this.ui.placeholder.visible = !this.input;
    this.view.master = SearchField; // eslint-disable-line no-use-before-define
    this.view.master.applyAnimated({ duration: 300 });
  }

  onInputFocus (evt) {
    this.active = true;
    this.ui.placeholder.visible = false;
    this.view.master = SearchFieldFocused; // eslint-disable-line no-use-before-define
    this.view.master.applyAnimated({ duration: 300 });
  }
}

// part(SearchField, { name: 'hello'}).openInWorld()
const SearchField = component({
  defaultViewModel: SearchFieldModel,
  extent: pt(188, 21),
  fixedHeight: true,
  fontColor: Color.rgb(204, 204, 204),
  fill: Color.white,
  borderRadius: 15,
  borderWidth: 1,
  reactsToPointer: false,
  layout: new TilingLayout({
    axisAlign: 'center',
    axis: 'row',
    orderByIndex: true,
    wrapSubmorphs: false,
    padding: Rectangle.inset(0, 0, 3, 0),
    resizePolicies: [
      ['search input', { height: 'fixed', width: 'fill' }],
      ['placeholder icon', { height: 'fixed', width: 'fixed' }]
    ]
  }),
  submorphs: [
    {
      type: Text,
      readOnly: false,
      fill: Color.transparent,
      name: 'search input',
      fontFamily: 'IBM Plex Sans',
      styleClasses: ['idle'],
      clipMode: 'hidden',
      extent: pt(188, 21),
      fixedHeight: true,
      fontColor: Color.black,
      padding: rect(6, 3, 0, 0),
      submorphs: [
        {
          type: Label,
          name: 'placeholder',
          visible: true,
          opacity: 0.3,
          padding: rect(6, 4, 0, 0),
          reactsToPointer: false,
          textAndAttributes: ['Search', null]
        }
      ]
    }, {
      type: Label,
      name: 'placeholder icon',
      autofit: false,
      padding: 2,
      position: pt(165, 0),
      fontColor: Color.rgb(204, 204, 204),
      fontSize: 14,
      nativeCursor: 'pointer',
      textAndAttributes: Icon.textAttribute('times-circle'),
      visible: false
    }
  ]
});

const SearchFieldFocused = component(SearchField, {
  name: 'search field focused',
  dropShadow: new ShadowObject({ distance: 0, color: Color.rgb(52, 152, 219), blur: 5 }),
  submorphs: [
    { name: 'placeholder icon', visible: true }
  ]
});

export { LabeledCheckBox, SearchField, InputLineDefault, InputLineDark };
