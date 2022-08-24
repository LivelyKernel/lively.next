import { Morph, ViewModel } from 'lively.morphic';
import { pt, Color } from 'lively.graphics';
import { signal } from 'lively.bindings';
import { arr, string } from 'lively.lang';
import PropertyPath from 'lively.lang/Path.js';

export class LabeledCheckBoxModel extends ViewModel {
  static get properties () {
    return {
      alignCheckBox: {
        defaultValue: 'left',
        type: 'Enum',
        values: ['left', 'right']
      },
      label: {
        defaultValue: 'a label'
      },
      checked: {
        type: 'Boolean'
      },
      active: {
        type: 'Boolean',
        defaultValue: true
      },
      labelMorph: {
        derived: true,
        readOnly: true,
        get () {
          return this.ui.label;
        }
      },
      checkboxMorph: {
        derived: true,
        readOnly: true,
        get () {
          return this.ui.checkbox;
        }
      },

      expose: {
        get () {
          return ['checked', 'active', 'label'];
        }
      },

      bindings: {
        get () {
          return [
            { signal: 'onMouseDown', handler: 'onClick' },
            { target: 'checkbox', signal: 'checked', handler: 'onTrigger' }
          ];
        }
      }
    };
  }

  onRefresh () {
    if (!this.view) return;
    this.view.withMetaDo({ metaInteraction: true }, () => {
      this.labelMorph.value = this.label;
      this.checkboxMorph.checked = this.checked;
    });
  }

  onTrigger (active) {
    this.setProperty('checked', active); // bypass the update
    signal(this, 'checked', active);
  }

  disable () {
    this.active = false;
    this.labelMorph.opacity = 0.5;
  }

  enable () {
    this.active = true;
    this.labelMorph.opacity = 1;
  }

  trigger () {
    this.checkboxMorph.trigger();
  }

  onClick (evt) {
    if (this.active) this.trigger();
    evt.stop();
  }
}

export class SearchFieldModel extends ViewModel {
  static get properties () {
    return {
      input: {
        derived: true,
        set (val) {
          this.view.textString = val;
        },
        get () {
          // hard binding on the root being a text morph
          return this.view.textString;
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
            { signal: 'onChange', handler: 'onInputChange' },
            { signal: 'onBlur', handler: 'onInputBlur' },
            { signal: 'onFocus', handler: 'onInputFocus' }
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
      this.owner.focus();
    }
    this.active && inputChange && signal(this, 'searchInput', this.parseInput());
  }

  onInputBlur (evt) {
    this.active = false;
    this.ui.placeholder.visible = !this.input;
  }

  onInputFocus (evt) {
    this.ui.placeholder.visible = false;
    this.active = true;
  }
}

// custom morph implementation since we have to adjust the rendering
export class CheckBoxMorph extends Morph {
  static get properties () {
    return {
      draggable: { defaultValue: false },
      extent: { defaultValue: pt(15, 15) },
      borderWidth: { defaultValue: 0 },
      active: { defaultValue: true },
      checked: { defaultValue: false },
      fill: { defaultValue: Color.transparent },
      nativeCursor: { defaultValue: 'pointer' }
    };
  }

  get isCheckbox () {
    return true;
  }

  trigger () {
    try {
      this.checked = !this.checked;
      signal(this, 'toggle', this.checked);
    } catch (err) {
      const w = this.world();
      if (w) w.logError(err);
      else console.error(err);
    }
  }

  onMouseDown (evt) {
    if (this.active) this.trigger();
  }

  render (renderer) {
    return renderer.renderCheckBox(this);
  }

  patchSpecialProps (node) {
    if (this.renderingState.specialProps.checked !== this.checked) {
      node.firstChild.checked = this.checked;
      this.renderingState.specialProps.checked = this.checked;
    }
    if (this.renderingState.specialProps.active !== this.active) {
      node.firstChild.disabled = !this.active;
      this.renderingState.specialProps.active = this.active;
    }
  }

  getNodeForRenderer (renderer) {
    return renderer.nodeForCheckbox(this);
  }
}
