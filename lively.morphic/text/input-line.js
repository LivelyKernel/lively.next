/* global System */
// import config from "../config.js";
import { obj, arr, num } from 'lively.lang';
import { Rectangle, rect, Color, pt } from 'lively.graphics';
import { connect, noUpdate, signal, disconnect } from 'lively.bindings'; // for makeInputLine
import { Text } from './morph.js';
import { Range } from './range.js';
import { HTMLMorph } from '../html-morph.js';
import { Icon } from './icons.js';
import { morph } from '../helpers.js';

export default class InputLine extends Text {
  /*
    rms 19.02.2020: The fact that InputLine merely extends the TextMorph causes issues when
                    these are used as part of a form. Forms do not take into account span
                    elements which is however the sole tag being used to render text morphs.
                    This is especially troublesome on mobile devices where the input line is
                    not properly scrolled into view when selected.
                    It is therefore advised to switch to an implementation based on the HTML
                    morph analogous to the password input line below.
  */

  /*

  This represents a single text input line, useful in places where users
  should be prompted for short strings

  The input line provides two connection points: input and inputChanged
  input is signaled when a user accepts the text content, e.g. by pressing enter,
  inputChanged is signaled when the input text changes, basically on every keystroke

  props:
    clearOnInput: Boolean to indicate to remove the users input when input is signaled
    historyId: id to use for providing an input history, the history stores
       the users accepted inputs and when a InputLine is subsequently created with
       the same id those inputs become available again via Alt-H (browse history) or
       Arrow Up/Down (traverse history)
    label: a string that prefixes the text content that is static, i.e. it
      cannot be selected or changed by the user and will not be part of "input"
    input: string to pre-fill the input text

  Example:

    InputLine.getHistory("name query");

    var input = Text.makeInputLine({
      fill: Color.green,
      historyId: "name query",
      label: "What is your name? ",
      placeholder: "type your name in here",
      width: 300
    }).fit().openInWorld();

    connect(input, 'inputAccepted', input, 'remove');
    connect(input, 'inputAccepted', input.world(), 'setStatusMessage');
    input.focus()

*/

  static getHistoryFromLocalSorage (id) {
    if (typeof localStorage === 'undefined') return null;
    try {
      const hist = localStorage.getItem('lively.morphic-inputline-' + id);
      return hist ? JSON.parse(hist) : null;
    } catch (e) {
      return null;
    }
  }

  static addHistoryToLocalStorage (id, hist) {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem('lively.morphic-inputline-' + id, JSON.stringify(hist));
    } catch (e) { console.error(e); }
  }

  static get histories () {
    if (!this._histories) this._histories = new Map();
    return this._histories;
  }

  static getHistory (id) {
    let hist = this.histories.get(id);
    if (hist) return hist;
    hist = this.getHistoryFromLocalSorage(id) || { items: [], max: 50, index: 0 };
    this.histories.set(id, hist);
    return hist;
  }

  static setHistory (id, hist = { items: [], max: 50, index: 0 }) {
    this.histories.set(id, hist);
    this.addHistoryToLocalStorage(id, hist);
    return hist;
  }

  static get properties () {
    return {
      readOnly: { defaultValue: false },
      fixedWidth: { defaultValue: true },
      fixedHeight: { defaultValue: true },
      extent: { defaultValue: pt(100, 20) },
      padding: { defaultValue: Rectangle.inset(2, 4) },
      clipMode: { defaultValue: 'hidden' },
      lineWrapping: { defaultValue: false },
      historyId: { defaultValue: null },
      clearOnInput: { defaultValue: false },
      selectionMode: { defaultValue: 'lively' },
      nativeCursor: { defaultValue: 'text' },

      label: {
        after: ['textAndAttributes', 'extent', 'padding', 'submorphs'],
        defaultValue: '',
        set (value) {
          this.setProperty('label', value);
          if (this.textString.startsWith(value)) return;
          noUpdate(() => {
            this.textString = value + this.input;
          });
        }
      },

      input: {
        after: ['label'],
        derived: true,
        get () {
          return this.textString.slice(this.label.length);
        },
        set (val) {
          this.textString = this.label + (val ? String(val) : '');
          this.updatePlaceholder();
        }
      },

      placeholder: {
        after: ['submorphs', 'label', 'defaultTextStyle'],
        dervied: true,
        get () {
          const placeholder = this.getSubmorphNamed('placeholder');
          return placeholder ? placeholder.value : null;
        },
        set (val) {
          let placeholder = this.getSubmorphNamed('placeholder');
          if (!val) {
            if (placeholder) {
              placeholder.remove();
              placeholder = null;
            }
          } else {
            if (!placeholder) {
              placeholder = this.addMorph(Text.makeLabel(val, {
                ...this.defaultTextStyle,
                name: 'placeholder',
                reactsToPointer: false,
                fontColor: Color.gray
              }));
            } else {
              placeholder.defaultTextStyle = { ...this.defaultTextStyle, fontColor: Color.gray };
              placeholder.value = val;
            }
          }
          this.updatePlaceholder();
        }
      }
    };
  }

  constructor (props = {}) {
    super(props);
    connect(this, 'textChange', this, 'onInputChanged');
    connect(this, 'selectionChange', this, 'fixCursor');
  }

  async menuItems () {
    return [{ command: 'change placeholder', target: this }, { isDivider: true }, ...await super.menuItems()];
  }

  onChange (change) {
    if (['extent',
      'fontSize',
      'padding',
      'fontFamily',
      'position',
      'selection'].includes(change.prop)) { this.updatePlaceholder(); }

    return super.onChange(change);
  }

  get isInputLine () { return true; }

  get allowDuplicatesInHistory () { return false; }

  resetHistory () { this.inputHistory = { items: [], max: 50, index: 0 }; }

  get inputHistory () {
    if (this._inputHistory) return this._inputHistory;
    return this._inputHistory = this.historyId
      ? this.constructor.getHistory(this.historyId)
      : { items: [], max: 30, index: 0 };
  }

  set inputHistory (hist) {
    this._inputHistory = hist;
    this.historyId && this.constructor.setHistory(this.historyId, this._inputHistory);
  }

  clear () {
    this.input = '';
  }

  focus () {
    this.fixCursor();
    super.focus();
  }

  onBlur (evt) {
    super.onBlur(evt);
    this.updatePlaceholder();
  }

  fitToLineHeight () {
    this.height = this.defaultLineHeight + this.padding.top() + this.padding.bottom();
  }

  // this.indicateError('hello')
  // this.clearError()

  async indicateError (message) {
    this.borderColor = Color.red;
    this._errorIcon = this.addMorph(this._errorIcon || morph({
      type: 'label',
      value: [' ' + message, { fontSize: this.fontSize }, ' ', {}, ...Icon.textAttribute('exclamation-circle', { paddingTop: '2px' })],
      fontSize: this.fontSize,
      fontColor: Color.red,
      opacity: 0,
      reactsToPointer: false,
      fill: Color.white.withA(0.9)
    }));
    await this.whenRendered();
    this._errorIcon.opacity = 1;
    this._errorIcon.rightCenter = this.innerBounds().insetBy(10).rightCenter();
  }

  clearError () {
    if (!this._errorIcon) return;
    this._errorIcon && this._errorIcon.remove();
    this._errorIcon = null;
    this.borderColor = Color.transparent;
  }

  updatePlaceholder () {
    const placeholder = this.getSubmorphNamed('placeholder');
    if (!placeholder) return;
    if (this.input.length) {
      placeholder.visible = false;
      return;
    }

    const textB = this.innerBounds();
    placeholder.fontSize = this.fontSize;
    placeholder.visible = true;
    placeholder.height = this.height;
    placeholder.padding = this.padding;
    if (placeholder.fit) placeholder.fit();
    placeholder.topLeft = this.label.length
      ? textB.topLeft().addXY(0, this.borderWidth)
      : textB.topLeft().withX(0);
  }

  fixCursor () {
    if (!this.label) return;
    const leadIndex = this.positionToIndex(this.selection.lead);
    if (leadIndex < this.label.length) { this.selection.lead = this.indexToPosition(this.label.length); }
    const anchorIndex = this.positionToIndex(this.selection.anchor);
    if (anchorIndex < this.label.length) { this.selection.anchor = this.indexToPosition(this.label.length); }
  }

  acceptInput () { const i = this.input; this.onInput(i); return i; }
  onInput (input) {
    if (this.input.length > 0) this.addInputToHistory(this.input);
    this.clearOnInput && this.clear();
    signal(this, 'inputAccepted', input);
  }

  onInputChanged (change) {
    signal(this, 'inputChanged', change);
    this.clearError();
    this.updatePlaceholder();
  }

  onMouseDown (evt) {
    super.onMouseDown(evt);
    this._errorIcon && this._errorIcon.remove();
  }

  deleteText (range) {
    range = range.isRange ? range : new Range(range);
    if (range.isEmpty()) return;
    range = range.subtract({
      start: { row: 0, column: 0 },
      end: { row: 0, column: this.label.length }
    })[0];
    return super.deleteText(range);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // history

  addInputToHistory (input) {
    const hist = this.inputHistory;
    let items = hist.items;
    if (arr.last(items) === input) return;
    items.push(input);
    if (items.length > hist.max) {
      hist.items = items = items.slice(-hist.max);
    }
    hist.index = items.length - 1;
    if (!this.allowDuplicatesInHistory) {
      for (let i = hist.items.length - 1; i--;) {
        if (hist.items[i] === input) {
          hist.items.splice(i, 1); hist.index--;
        }
      }
    }
    this.historyId && this.constructor.addHistoryToLocalStorage(this.historyId, hist);
  }

  async browseHistory () {
    const items = this.inputHistory.items.map((item, i) =>
      ({ isListItem: true, string: item, value: i })).reverse();
    const { selected: [item] } = await this.world().filterableListPrompt(
      'Choose item:', items, { commands: [this.histEditCommandForHistBrowse()] });
    typeof item === 'number' && this.setAndShowHistItem(item);
    this.focus();
  }

  histEditCommandForHistBrowse () {
    return {
      name: 'edit history ' + this.historyId,
      exec: async prompt => {
        let items = this.inputHistory.items.slice().reverse();
        const { status, list: values } = await prompt.world().editListPrompt(
          'edit history ' + this.historyId, items);
        if (status === 'canceled') return true;
        items = items.filter(ea => ea.isListItem ? values.includes(ea.value) : values.includes(ea));
        this.inputHistory = { ...this.inputHistory, items };
        prompt.get('list').items = items.map((item, i) =>
          ({ isListItem: true, string: item, value: i })).reverse();
        return true;
      }
    };
  }

  setAndShowHistItem (idx) {
    const hist = this.inputHistory; const items = hist.items; const len = items.length - 1; let i = idx;
    if (!num.between(i, 0, len + 1)) hist.index = i = len;
    else hist.index = i;
    if (this.input !== items[i] && typeof items[i] !== 'undefined') this.input = items[i];
  }

  showHistItem (dir) {
    dir = dir || 'next';
    const hist = this.inputHistory; const items = hist.items; const len = items.length - 1; let i = hist.index;
    if (!num.between(i, 0, len + 1)) hist.index = i = len;
    if (this.input !== items[i] && typeof items[i] !== 'undefined') { this.input = items[i]; return; }
    if (dir === 'next') {
      if (i > len) return;
      i = ++hist.index;
    } else {
      if (i <= 0) return;
      i = --hist.index;
    }
    this.input = items[i] || '';
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // ui events
  get commands () {
    return [
      {
        name: 'change placeholder',
        exec: async () => {
          const newPlaceholder = await this.world().prompt('Enter Placeholder:', {
            input: this.placeholder
          });
          if (newPlaceholder) this.placeholder = newPlaceholder;
        }
      },
      { name: 'accept input', exec: () => { this.acceptInput(); return true; } },
      { name: 'show previous input from history', exec: () => { this.showHistItem('prev'); return true; } },
      { name: 'show next input from history', exec: () => { this.showHistItem('next'); return true; } },
      { name: 'browse history', exec: () => { this.browseHistory(); return true; } },
      {
        name: 'remove items from history',
        exec: async inputLine => {
          const hist = inputLine.inputHistory;
          const items = hist.items.map((item, i) =>
            ({ isListItem: true, string: item, value: i })).reverse();
          const { selected } = await inputLine.world().filterableListPrompt(
            'Choose items to delete:', items, { multiSelect: true });

          selected.reverse().forEach(index => {
            if (index < hist.index) hist.index--;
            hist.items.splice(index, 1);
          });
          inputLine.inputHistory = hist;
          return true;
        }
      }
    ].concat(super.commands);
  }

  get keybindings () {
    return super.keybindings.concat([
      { keys: 'Enter', command: 'accept input' },
      { keys: { mac: 'Meta-S', win: 'Ctrl-S' }, command: 'accept input' },
      { keys: 'Up|Ctrl-Up|Alt-P', command: 'show previous input from history' },
      { keys: 'Down|Ctrl-Down|Alt-N', command: 'show next input from history' },
      { keys: 'Alt-H', command: 'browse history' },
      { keys: 'Alt-Shift-H', command: 'remove items from history' }
    ]);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // html export
  htmlExport_transformNode (node) {
    const doc = node.getRootNode();
    const input = doc.createElement('input');
    const textCSSProps = [
      'padding',
      'font-family',
      'font-weight',
      'font-style',
      'text-decoration',
      'font-size',
      'color'];
    const textLayer = node.querySelector('.newtext-text-layer.actual');
    input.id = node.id; input.className = node.className;
    input.style = node.style.cssText;
    Object.assign(input.style, obj.select(textLayer.style, textCSSProps));
    input.placeholder = this.placeholder;
    input.type = 'text';
    input.autocomplete = input.name = this.name.replace(/[\s"]/g, '-');
    return input;
  }
}

// var i = new PasswordInputLine().openInWorld();
// i.remove();

export class PasswordInputLine extends HTMLMorph {
  static get properties () {
    return {
      // this.clipMode = "hidden"
      extent: { defaultValue: pt(100, 20) },

      html: {
        derived: true,
        initialize () {},
        get () { return ''; },
        set (x) {}
      },

      highlightWhenFocused: {
        defaultValue: true
      },

      isPasswordInput: {
        get () { return true; }
      },

      haloShadow: {
        type: 'Shadow'
      },

      domNodeTagName: { readOnly: true, get () { return 'input'; } },
      domNodeStyle: { readOnly: true, get () { return 'background: grey'; } },

      input: {
        derived: true,
        after: ['domNode'],
        get () { return (this.domNode && this.domNode.value) || ''; },
        set (val) { this.domNode.value = val; this.updateHtml(this.input); }
      },

      placeholder: {
        after: ['domNode'],
        set (val) { this.setProperty('placeholder', val); this.updateHtml(this.input); }
      },

      fontSize: {
        defaultValue: 12,
        after: ['input'],
        set (value) { this.setProperty('fontSize', value); this.updateHtml(this.input); }
      },

      fontFamily: {
        defaultValue: 'sans-serif',
        after: ['input'],
        set (value) { this.setProperty('fontFamily', value); this.updateHtml(this.input); }
      },

      padding: {
        defaultValue: Rectangle.inset(2),
        after: ['input'],
        set (value) { this.setProperty('padding', value); this.updateHtml(this.input); }
      }
    };
  }

  constructor (opts = {}) {
    super(opts);
    this.onLoad();
  }

  onChange (change) {
    super.onChange(change);
    if (['fill', 'borderRadius'].includes(change.prop)) {
      this.updateHtml(this.input);
    }
  }

  async onLoad () {
    // hmm key events aren't dispatched by default...
    await this.whenRendered();
    this.ensureInputNode().then(node => {
      this.updateHtml(this.input);
      node.onkeydown = evt => this.env.eventDispatcher.dispatchDOMEvent(evt, this, 'onKeyDown');
      node.onkeyup = evt => this.env.eventDispatcher.dispatchDOMEvent(evt, this, 'onKeyUp');
    });
  }

  onMouseDown (evt) {
    super.onMouseDown(evt);
    this._errorIcon && this._errorIcon.remove();
  }

  ensureInputNode () {
    return this.whenRendered().then(() => {
      const n = this.domNode;

      if (n.parentNode && n.parentNode.tagName == 'INPUT') {
        n.parentNode.remove();
        const morphNode = this.env.renderer.getNodeForMorph(this);
        morphNode.insertBefore(this.domNode, morphNode.firstChild);
        // make sure that the submorph node is still in front
      }
      return this.domNode;
    });
  }

  onKeyDown (evt) {
    super.onKeyDown(evt);
    // at that point in time the input has not changed to the most recent value yet
    if (this.input != this.lastInput) {
      this.onInputChanged(this.input);
    }
    this.lastInput = this.input;
  }

  focus () {
    super.focus();
    this.domNode && this.domNode.focus();
  }

  onFocus (evt) {
    super.onFocus(evt);
    if (this._originalShadow) return;
    this._originalShadow = this.dropShadow;
    this.withAnimationDo(() => {
      this.withMetaDo({ skipReconciliation: true }, () => {
        if (this.highlightWhenFocused) this.dropShadow = this.haloShadow;
      });
    }, { duration: 200 });
  }

  onBlur (evt) {
    super.onBlur(evt);
    this.withAnimationDo(() => {
      this.withMetaDo({ skipReconciliation: true }, () => {
        if (this.highlightWhenFocused) this.dropShadow = this._originalShadow || null;
      });
    }, { duration: 200 });
    this._originalShadow = null;
  }

  // this.indicateError('hello')
  // this.clearError()

  async indicateError (message) {
    this.borderWidth = 3;
    this.borderColor = Color.red;
    this._errorIcon = this.addMorph(this._errorIcon || morph({
      type: 'label',
      value: [' ' + message, { fontSize: 18 }, ' ', {}, ...Icon.textAttribute('exclamation-circle', { paddingTop: '2px' })],
      fontSize: 20,
      fontColor: Color.red,
      opacity: 0,
      reactsToPointer: false,
      fill: Color.white.withA(0.9)
    }));
    await this.whenRendered();
    this._errorIcon.opacity = 1;
    this._errorIcon.rightCenter = this.innerBounds().insetBy(10).rightCenter();
  }

  clearError () {
    if (!this._errorIcon) return;
    this._errorIcon && this._errorIcon.remove();
    this._errorIcon = null;
    this.borderColor = Color.transparent;
  }

  acceptInput () { const i = this.input; signal(this, 'inputAccepted', i); return i; }
  onInputChanged (change) { this.clearError(); signal(this, 'inputChanged', change); }

  async updateHtml (input) {
    // await this.updateHtml(this.input)
    const {
      fontSize, fontFamily, padding, placeholder,
      fill = Color.white, borderRadius
    } = this;
    const padt = padding.top();
    const padr = padding.right();
    const padb = padding.bottom();
    const padl = padding.left();
    const n = await this.ensureInputNode();
    n.setAttribute('type', 'password');
    n.setAttribute('placeholder', placeholder);
    n.setAttribute('value', input);
    Object.assign(n.style, {
      position: 'absolute',
      width: `calc(100% - ${padl}px - ${padr}px)`,
      'border-width': 0,
      outline: 'none',
      'border-radius': `${borderRadius.valueOf()}px`,
      background: fill.toString(),
      padding: `${padt}px ${padr}px ${padb}px ${padl}px`,
      'font-size': `${fontSize}px`,
      'font-family': `${fontFamily}`
    });
  }

  get commands () {
    return [
      { name: 'accept input', exec: () => { this.acceptInput(); return true; } }
    ].concat(super.commands);
  }

  get keybindings () {
    return super.keybindings.concat([
      { keys: 'Enter', command: 'accept input' },
      { keys: { mac: 'Meta-S', win: 'Ctrl-S' }, command: 'accept input' }
    ]);
  }

  htmlExport_transformNode (node) {
    const doc = node.getRootNode();
    const wrapper = doc.createElement('div');
    let oldInput = node.querySelector('input');
    const input = doc.createElement('input');
    const textCSSProps = [
      'padding',
      'font-family',
      'font-weight',
      'font-style',
      'text-decoration',
      'font-size',
      'border-radius',
      'color'];
    if (oldInput.childNodes[0] && oldInput.childNodes[0].tagName === 'INPUT') { oldInput = oldInput.childNodes[0]; }
    input.id = node.id; input.className = node.className;
    wrapper.style = node.style.cssText;
    Object.assign(input.style, obj.select(oldInput.style, textCSSProps));
    input.style.position = 'absolute';
    input.style.width = node.style.width;
    input.style.height = node.style.height;
    input.style['border-width'] = node.style['border-width'];
    input.placeholder = this.placeholder;
    input.type = 'password';
    input.autocomplete = input.name = this.name.replace(/[\s"]/g, '-');
    wrapper.appendChild(input);
    wrapper.appendChild(node.childNodes[1]);
    return wrapper;
  }
}
