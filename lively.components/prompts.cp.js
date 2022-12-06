import { List, FilterableList, RadioButtonGroup } from 'lively.components';
import { ShadowObject, TilingLayout, InputLine, PasswordInputLine, Ellipse, Text, Icon, Label, component, ViewModel, add, part } from 'lively.morphic';
import { Color, rect, pt } from 'lively.graphics';
import { ButtonDefault } from './buttons.cp.js';
import { InputLineDefault } from './inputs.cp.js';
import { arr, promise } from 'lively.lang';

export class AbstractPromptModel extends ViewModel {
  static get properties () {
    return {
      _isActive: { defaultValue: false },
      autoRemove: { defaultValue: true },
      answer: { defaultValue: null, derived: true },
      label: {
        defaultValue: 'A prompt title',
        set (label) {
          this.setProperty('label', label);
          if (this.view) { this.ui.promptTitle.value = label; }
        }
      },
      isPrompt: {
        get () { return true; }
      },
      expose: {
        get () {
          return ['keybindings', 'commands', 'activate', 'isActive', 'isPrompt'];
        }
      }
    };
  }

  viewDidLoad () {
    this.view.hasFixedPosition = true;
  }

  focus () {
    this.view.focus();
  }

  resolve (arg) { return this.answer.resolve(arg); }
  reject (reason = undefined) { return this.answer.resolve(reason); }

  async activate () {
    this.focus();
    this.answer = promise.deferred();
    this._isActive = true;
    promise.finally(this.answer.promise, () => this._isActive = false);
    if (this.autoRemove) { promise.finally(this.answer.promise, () => this.view.fadeOut(200)); }
    return this.answer.promise;
  }

  isActive () { return !!this.world() && this._isActive; }

  get keybindings () {
    return [
      { keys: 'Enter', command: 'resolve' },
      { keys: 'Escape', command: 'reject' },
      { keys: { mac: 'Meta-.' }, command: 'reject' }
    ];
  }

  get commands () {
    return [
      { name: 'resolve', exec: (_, arg) => { this.resolve(arg); return true; } },
      { name: 'reject', exec: (_, arg) => { this.reject(arg); return true; } }
    ];
  }
}

export class InformPromptModel extends AbstractPromptModel {
  static get properties () {
    return {
      lineWrapping: { defaultValue: true },
      bindings: {
        get () {
          return [
            { model: 'ok button', signal: 'fire', handler: 'resolve' }
          ];
        }
      }
    };
  }

  viewDidLoad () {
    super.viewDidLoad();
    const { view, ui: { promptTitle } } = this;
    promptTitle.lineWrapping = this.lineWrapping;
    promptTitle.textString = this.label;

    if (!this.lineWrapping) {
      view.opacity = 0;
      view.whenRendered().then(() => {
        if (promptTitle.document) {
          const currentCenter = view.center;
          view.width = Math.max(view.width, promptTitle.document.width + 100);
          view.align(view.center, currentCenter);
        }
        view.opacity = 1;
      });
    }
  }

  get keybindings () {
    return super.keybindings.concat([
      { keys: 'Escape', command: 'resolve' }
    ]);
  }
}

export class ConfirmPromptModel extends AbstractPromptModel {
  static get properties () {
    return {
      label: {
        defaultValue: ['Confirm\n\
', {
          fontWeight: 'bold'
        }, 'An appropriate message for the user that helps them to understand the situation!', {
          fontSize: 17,
          fontWeight: 'normal'
        }]
      },
      forceConfirm: { defaultValue: false },
      lineWrapping: { defaultValue: true },
      confirmLabel: { defaultValue: 'OK' },
      rejectLabel: { defaultValue: 'CANCEL' },
      bindings: {
        get () {
          return [
            { model: 'ok button', signal: 'fire', handler: 'resolve' },
            { model: 'cancel button', signal: 'fire', handler: 'reject' }
          ];
        }
      }
    };
  }

  get expose () {
    return ['label', ...super.expose];
  }

  viewDidLoad () {
    super.viewDidLoad();
    const { ui: { promptTitle: title, okButton, cancelButton }, view } = this;
    title.value = this.label;

    okButton.label = this.confirmLabel;
    cancelButton.label = this.rejectLabel;

    if (this.forceConfirm) cancelButton.disable();

    title.lineWrapping = this.lineWrapping;
    if (!this.lineWrapping) {
      view.opacity = 0;
      view.whenRendered().then(() => {
        title.lineWrapping = this.lineWrapping;
        const center = view.center;
        title.invalidateTextLayout(true, true);
        view.width = Math.max(view.width, title.document.width + 100);
        view.center = center;
        view.opacity = 1;
      });
    }
  }

  resolve () { super.resolve(true); }
  reject () { super.resolve(false); }
}

export class MultipleChoicePromptModel extends ConfirmPromptModel {
  static get properties () {
    return {
      choices: {
        defaultValue: [],
        set (choices) {
          this.setProperty('choices', choices);
          const { choices: choiceContainer } = this.ui;
          if (choiceContainer) { choiceContainer.choices = choices; }
        }
      },
      bindings: {
        get () {
          return [
            { model: 'ok button', signal: 'fire', handler: 'resolve' },
            { model: 'cancel button', signal: 'fire', handler: 'reject' },
            { signal: 'onKeyDown', handler: 'onKeyDown', override: true }
          ];
        }
      }
    };
  }

  resolve (value) {
    return this.answer.resolve(value || this.ui.choices.value);
  }

  viewDidLoad () {
    super.viewDidLoad();
    this.ui.choices.choices = this.choices;
  }

  onKeyDown ($onKeyDown, evt) {
    if (/^[0-9]$/.test(evt.keyCombo)) {
      const n = Number(evt.keyCombo);
      const btn = this.view.getSubmorphNamed('button ' + n);
      if (btn) {
        btn.select();
        return evt.stop();
      }
    }
    return $onKeyDown(evt);
  }
}

export class TextPromptModel extends ConfirmPromptModel {
  static get properties () {
    return {
      lineWrapping: { defaultValue: true },
      errorMessage: { defaultValue: 'Invalid Input' },
      confirmLabel: { defaultValue: 'OK' },
      rejectLabel: { defaultValue: 'CANCEL' },
      historyId: { defaultValue: 'text prompt' },
      input: { defaultValue: '' },
      selectInput: { defaultValue: false },
      useLastInput: { defaultValue: false },
      maxWidth: {
        initialize () {
          this.maxWidth = $world.width - 20;
        }
      },
      validate: {
        serialize: false,
        initialize () {
          this.validate = () => true;
        }
      },
      bindings: {
        get () {
          return [
            { model: 'ok button', signal: 'fire', handler: 'resolve' },
            { model: 'cancel button', signal: 'fire', handler: 'reject' }
          ];
        }
      }
    };
  }

  focus () { this.ui.input.focus(); }

  resolve () {
    const inputLine = this.ui.input;
    if (this.validate(inputLine.input)) {
      return this.answer.resolve(inputLine.acceptInput());
    } else inputLine.indicateError(this.errorMessage);
  }

  viewDidLoad () {
    const {
      ui: { promptTitle: title, input: inputLine },
      label, historyId, input, useLastInput, selectInput
    } = this;
    title.value = label;

    if (inputLine) {
      if (inputLine.viewState) { inputLine.viewState.fastScroll = false; }
      inputLine.textString = input || '';

      if (historyId && useLastInput) {
        const lastInput = arr.last(inputLine.inputHistory.items);
        if (lastInput) inputLine.textString = lastInput;
      }
    }

    super.viewDidLoad();

    if (!inputLine.isPasswordInput) {
      inputLine.gotoDocumentEnd();
      inputLine.scrollCursorIntoView();
    }

    if (selectInput) {
      inputLine.selectAll();
    }
  }
}

export class EditPromptModel extends TextPromptModel {
  static get properties () {
    return {
      textStyle: { defaultValue: {} },
      historyId: { defaultValue: 'edit prompt' },
      mode: { defaultValue: 'text' },
      maxWidth: {
        initialize () {
          this.maxWidth = $world.visibleBounds().width - 20;
        }
      },
      bindings: {
        get () {
          return [
            { model: 'ok button', signal: 'fire', handler: 'resolve' },
            { model: 'cancel button', signal: 'fire', handler: 'reject' },
            { signal: 'focus', handler: 'focus', override: true }
          ];
        }
      }
    };
  }

  get keybindings () {
    return [
      { keys: { mac: 'Meta-Enter|Meta-S', win: 'Ctrl-Enter|Ctrl-S' }, command: 'resolve' },
      { keys: 'Escape', command: 'reject' },
      { keys: 'Alt-P|Alt-Up', command: 'history back' },
      { keys: 'Alt-N|Alt-Down', command: 'history forward' },
      { keys: 'Alt-H', command: 'browse history' }
    ];
  }

  get commands () {
    return super.commands.concat([
      {
        name: 'history back',
        exec: (_, arg) => {
          if (this.historyId) {
            const { editor } = this.ui;
            const hist = InputLine.getHistory(this.historyId);
            let { items, index } = hist;
            hist.index = --index;
            if (index < 0) hist.index = index = items.length - 1;
            editor.undoManager.group();
            editor.textString = items[index];
            editor.undoManager.group();
          }
          return true;
        }
      },

      {
        name: 'browse history',
        exec: async (_, arg) => {
          if (this.historyId) {
            const hist = InputLine.getHistory(this.historyId);
            const { status, list, selections: [choice] } = await this.world().editListPrompt(
              'input history ' + this.historyId, hist.items, { requester: this.view });
            if (status !== 'canceled') {
              hist.items = list;
              InputLine.setHistory(this.historyId, hist);
              if (choice) {
                hist.index = hist.items.indexOf(choice);
                this.ui.editor.textString = choice;
              }
            }
          }
          return true;
        }
      },

      {
        name: 'history forward',
        exec: (_, arg) => {
          if (this.historyId) {
            const { editor } = this.ui;
            const hist = InputLine.getHistory(this.historyId); let { items, index } = hist;
            hist.index = ++index;
            if (index >= items.length) hist.index = index = 0;
            editor.undoManager.group();
            editor.textString = items[index];
            editor.undoManager.group();
          }
          return true;
        }
      }
    ]);
  }

  focus () { this.ui.editor.focus(); }

  viewDidLoad () {
    const {
      textStyle, input, mode, evalEnvironment, maxWidth,
      view, ui: { editor }
    } = this;

    view.hasFixedPosition = true;

    if (mode && !textStyle.fontFamily) textStyle.fontFamily = 'Monaco, monospace';

    editor.value = input || '';
    Object.assign(editor, textStyle);

    editor.changeEditorMode(mode).then(() => {
      if (evalEnvironment && editor.editorPlugin) { Object.assign(editor.editorPlugin.evalEnvironment, evalEnvironment); }
    });

    const inputWidth = editor.textBounds().width + 50;
    // if the input string we pre-fill is wide than we try to make it fit
    if (inputWidth > view.width - 25) { view.width = Math.min(maxWidth, inputWidth + 125); }

    editor.gotoDocumentEnd();
    editor.scrollCursorIntoView();
  }

  resolve (arg) {
    if (this.resolveTextAttributes) {
      return super.resolve(this.ui.editor.textAndAttributes);
    }

    const content = this.ui.editor.textString.trim();
    if (this.historyId) {
      const hist = InputLine.getHistory(this.historyId);
      hist.items = hist.items.filter(ea => ea !== content);
      hist.items.push(content);
      while (hist.items.length > hist.items.max) hist.items.shift();
      hist.index = hist.items.length;
      InputLine.setHistory(this.historyId, hist);
    }
    return super.resolve(content);
  }
}

export class PasswordPromptModel extends TextPromptModel {
  resolve () { return super.resolve(this.ui.input.acceptInput()); }

  focus () {
    const i = this.ui.input;
    // this is nessecary because of the html implementation of the password input
    i.whenRendered().then(() => i.focus());
  }
}

export class ListPromptModel extends TextPromptModel {
  static get properties () {
    return {
      items: {
        defaultValue: []
      },
      multiSelect: { defaultValue: false },
      filterable: { defaultValue: false },
      padding: { defaultValue: rect(0, 0, 0, 0) },

      preselect: {
        defaultValue: 0
      },
      onSelection: {
        defaultValue: () => {}
      },

      actions: { defaultValue: [] },
      selectedAction: {},

      // in case of filterable list
      fuzzy: { defaultValue: false },
      filterFunction: {},
      sortFunction: {},
      onFilter: {
        defaultValue: () => {}
      }
    };
  }

  get bindings () {
    return [
      ...super.bindings,
      { target: 'prompt list', signal: 'selection', handler: 'onSelection' },
      { target: 'prompt list', signal: 'accepted', handler: 'resolve' },
      { target: 'prompt list', signal: 'reject', handler: 'reject' },
      { target: 'prompt list', signal: 'updateFilter', handler: 'onFilter' }
    ];
  }

  focus () { this.ui.promptList.focus(); }

  reset () {
    this.items = [];
  }

  viewDidLoad () {
    super.viewDidLoad();
    const {
      label, multiSelect, historyId, useLastInput, filterable, items,
      fuzzy, filterFunction, sortFunction, actions, selectedAction,
      ui: { promptTitle: title, promptList: list, input }
    } = this;

    title.value = label;

    Object.assign(list, {
      multiSelect,
      historyId,
      useLastInput
    });

    list.whenRendered().then(() => {
      // this is super strange
      list.items = items;
    });

    input.visible = !!filterable;

    if (filterable && fuzzy) list.fuzzy = fuzzy;
    if (filterable && typeof filterFunction === 'function') { list.filterFunction = filterFunction; }
    if (filterable && typeof sortFunction === 'function') { list.sortFunction = sortFunction; }
    if (filterable && actions) { list.actions = actions; }
    if (filterable && selectedAction) { list.selectedAction = selectedAction; }
  }

  onRefresh (prop) {
    if (prop === 'items') {
      this.ui.promptList.items = this.items;
    }
  }

  resolve (arg) {
    const list = this.ui.promptList;
    const answer = arg || list instanceof FilterableList
      ? list.acceptInput()
      : { selected: list.selections, status: 'accepted', actions: 'default' };
    return this.answer.resolve(answer);
  }

  reject () {
    return this.answer.resolve({
      prompt: this,
      selected: [],
      filtered: [],
      status: 'canceled'
    });
  }
}

export class EditListPromptModel extends ListPromptModel {
  resolve () {
    const { items: list, selections } = this.ui.promptList;
    return this.answer.resolve({ list: list.map(item => item.value), selections });
  }

  reject () { return this.answer.resolve({ list: [], selections: [], status: 'canceled' }); }

  get bindings () {
    return [
      ...super.bindings,
      { model: 'add item button', signal: 'fire', handler: 'addItemToList' },
      { model: 'remove item button', signal: 'fire', handler: 'removeSelectedItemsFromList' }
    ];
  }

  get keybindings () {
    return super.keybindings.concat([
      { keys: { mac: 'Meta-Enter', win: 'Ctrl-Enter' }, command: 'resolve' },
      { keys: 'Ctrl-G', command: 'deselect' },
      { keys: 'Shift-=|+', command: 'add item to list' },
      { keys: 'Delete|-|Backspace', command: 'remove item from list' }
    ]);
  }

  get commands () {
    return super.commands.concat([
      {
        name: 'deselect',
        exec: () => { this.ui.list.selection = null; return true; }
      },
      {
        name: 'add item to list',
        exec: () => { this.addItemToList(); return true; }
      },
      {
        name: 'remove item from list',
        exec: () => { this.removeSelectedItemsFromList(); return true; }
      }
    ]);
  }

  async removeSelectedItemsFromList () {
    const list = this.ui.promptList;
    const selectAfterwards = list.selectedItems.length !== 1
      ? -1
      : list.selectedIndex === 0 ? 0 : list.selectedIndex - 1;
    list.items = arr.withoutAll(list.items, list.selectedItems);
    if (selectAfterwards < 0) list.selection = null;
    else list.selectedIndex = selectAfterwards;
    list.focus();
  }

  async addItemToList () {
    let list = this.ui.promptList;
    const input = list.selection ? list.items[list.selectedIndex].string : '';
    const toAdd = await this.world().prompt(
      'Input to add to the list', {
        historyId: this.historyId || 'EditListPrompt-input-history',
        requester: this.view,
        input
      });
    if (!toAdd) return;
    // this is not going to bode well
    list = this.ui.list;
    const insertAt = list.selection ? list.selectedIndex + 1 : list.items.length;
    list.addItemAt(toAdd, insertAt);
    list.focus();
    list.selectedIndex = insertAt;
  }
}

const RedButton = component(ButtonDefault, {
  name: 'red button',
  borderWidth: 0,
  dropShadow: new ShadowObject({ distance: 3, color: Color.rgba(0, 0, 0, 0.26), blur: 10 }),
  extent: pt(94, 38),
  fill: Color.rgb(231, 76, 60),
  submorphs: [{
    type: Label,
    name: 'label',
    fontColor: Color.rgb(253, 254, 254),
    fontFamily: 'IBM Plex Sans',
    fontSize: 14,
    fontWeight: 'bold',
    position: pt(20, 10),
    reactsToPointer: false,
    textAndAttributes: ['CANCEL', null]
  }]
});

const RedButtonClicked = component(RedButton, {
  name: 'red button clicked',
  fill: Color.rgb(177, 57, 44)
});

const GreenButton = component(ButtonDefault, {
  name: 'green button',
  borderWidth: 0,
  dropShadow: new ShadowObject({ distance: 3, color: Color.rgba(0, 0, 0, 0.26), blur: 10 }),
  extent: pt(90, 38),
  fill: Color.rgb(62, 207, 142),
  submorphs: [{
    type: Label,
    name: 'label',
    fontColor: Color.rgb(253, 254, 254),
    fontFamily: 'IBM Plex Sans',
    fontSize: 14,
    fontWeight: 'bold',
    position: pt(35, 10),
    reactsToPointer: false,
    textAndAttributes: ['OK', null]
  }]
});

const GreenButtonClicked = component(GreenButton, {
  name: 'green button clicked',
  fill: Color.rgb(40, 155, 104)
});

const PlainButton = component(ButtonDefault, {
  name: 'plain button',
  borderWidth: 0,
  dropShadow: new ShadowObject({ distance: 1, color: Color.rgba(0, 0, 0, 0.26) }),
  extent: pt(40, 37),
  fill: Color.rgb(202, 207, 210),
  submorphs: [{
    type: Label,
    name: 'label',
    fontColor: Color.rgb(253, 254, 254),
    fontFamily: 'IBM Plex Sans',
    fontSize: 14,
    fontWeight: 'bold',
    position: pt(13.5, 11.5),
    reactsToPointer: false,
    textAndAttributes: Icon.textAttribute('plus')
  }]
});

const PlainButtonClicked = component(PlainButton, {
  name: 'plain button clicked',
  fill: Color.rgb(127, 140, 141)
});

const ChoiceButtonSelected = component({
  // type: RadioButton,
  name: 'choice button Selected',
  acceptsDrops: false,
  borderColor: Color.rgb(204, 204, 204),
  borderRadius: 4,
  dropShadow: new ShadowObject({ distance: 3, rotation: 75, color: Color.rgba(0, 0, 0, 0.2) }),
  extent: pt(371.5, 47),
  layout: new TilingLayout({
    axisAlign: 'center',
    align: 'left',
    axis: 'row',
    orderByIndex: true,
    padding: {
      height: 0,
      width: 0,
      x: 12,
      y: 12
    },
    reactToSubmorphAnimations: false,
    renderViaCSS: true,
    spacing: 12
  }),
  nativeCursor: 'pointer',
  selected: true,
  selectionColor: Color.rgb(52, 152, 219),
  submorphs: [{
    type: Ellipse,
    name: 'indicator',
    borderColor: Color.rgb(204, 204, 204),
    borderWidth: 1,
    dropShadow: new ShadowObject({ distance: 3, rotation: 75, color: Color.rgba(0, 0, 0, 0.2) }),
    extent: pt(12, 12),
    fill: Color.rgb(52, 152, 219),
    isEllipse: true,
    nativeCursor: 'pointer',
    origin: pt(6, 6)
  }, {
    type: Label,
    name: 'label',
    fontSize: 15,
    reactsToPointer: false,
    textAndAttributes: [...Icon.textAttribute('external-link-alt'), '  Import existing package']
  }]
});

const ChoiceButtonUnselected = component(ChoiceButtonSelected, {
  name: 'choice button unselected',
  opacity: 0.5,
  submorphs: [{
    name: 'indicator',
    fill: Color.rgb(255, 255, 255)
  }, {
    name: 'label',
    textAndAttributes: [...Icon.textAttribute('cube'), '  Add Package']
  }]
});

const LightPrompt = component({
  name: 'light prompt',
  borderRadius: 8,
  epiMorph: true,
  dropShadow: new ShadowObject({ distance: 5, rotation: 75, color: Color.rgba(0, 0, 0, 0.37), blur: 60, fast: false }),
  extent: pt(387, 60),
  fill: Color.rgb(251, 252, 252),
  layout: new TilingLayout({
    align: 'center',
    axisAlign: 'center',
    axis: 'column',
    orderByIndex: true,
    justifySubmorphs: 'packed',
    wrapSubmorphs: false,
    hugContentsVertically: true,
    hugContentsHorizontally: true,
    spacing: 16,
    padding: 15,
    renderViaCSS: true
  }),
  submorphs: [{
    type: Text,
    name: 'prompt title',
    extent: pt(355, 28),
    fill: Color.rgba(255, 255, 255, 0),
    fixedWidth: true,
    fontColor: Color.rgb(102, 102, 102),
    fontFamily: '"IBM Plex Sans"',
    fontSize: 20,
    fontWeight: 'bold',
    nativeCursor: 'default',
    padding: rect(20, 0, 0, 0),
    readOnly: true,
    textAlign: 'center',
    textString: 'Hello World!'
  }]
});

const DarkPrompt = component(LightPrompt, {
  name: 'dark prompt',
  dropShadow: new ShadowObject({ distance: 5, rotation: 75.00000000000001, color: Color.rgba(0, 0, 0, 0.5), blur: 60, fast: false }),
  fill: Color.rgba(0, 0, 0, 0.65),
  submorphs: [{
    name: 'prompt title',
    fontColor: Color.rgb(253, 254, 254)
  }]
});

const InformPrompt = component(LightPrompt, {
  defaultViewModel: InformPromptModel,
  name: 'inform prompt',
  extent: pt(249.3, 114),
  submorphs: [{
    name: 'prompt title',
    lineWrapping: true,
    textAndAttributes: ['Inform message', null]
  }, add(part(GreenButton, {
    name: 'ok button',
    extent: pt(90, 38),
    submorphs: [{ name: 'label', textString: 'OK' }]
  }))]
});

// part(ConfirmPrompt).openInWorld()
const ConfirmPrompt = component(LightPrompt, {
  defaultViewModel: ConfirmPromptModel,
  name: 'confirm prompt',
  submorphs: [{
    name: 'prompt title',
    lineWrapping: 'by-words',
    textAndAttributes: ['Confirm\n\
', {
      fontWeight: 'bold'
    }, 'An appropriate message for the user that helps them to understand the situation!', {
      fontSize: 17,
      fontWeight: 'normal'
    }]
  }, add({
    name: 'button wrapper',
    extent: pt(331, 48.9),
    fill: Color.rgba(0, 0, 0, 0),
    layout: new TilingLayout({
      align: 'center',
      orderByIndex: true,
      reactToSubmorphAnimations: false,
      renderViaCSS: true,
      spacing: 20
    }),
    submorphs: [part(GreenButton, {
      name: 'ok button',
      submorphs: [{ name: 'label', textString: 'OK' }]
    }), part(RedButton, {
      name: 'cancel button',
      submorphs: [{ name: 'label', textString: 'CANCEL' }]
    })]
  })]
});

const MultipleChoicePrompt = component(ConfirmPrompt, {
  defaultViewModel: MultipleChoicePromptModel,
  name: 'multiple choice prompt',
  submorphs: [add({
    type: RadioButtonGroup,
    layout: new TilingLayout({
      hugContentsVertically: true,
      hugContentsHorizontally: true,
      align: 'center',
      axisAlign: 'center'
    }),
    name: 'choices',
    extent: pt(387, 118),
    fill: Color.rgba(0, 0, 0, 0),
    submorphs: [
      part(ChoiceButtonUnselected),
      part(ChoiceButtonSelected)
    ]
  }, 'button wrapper')]
});

const TextPrompt = component(ConfirmPrompt, {
  defaultViewModel: TextPromptModel,
  name: 'text prompt',
  submorphs: [add(part(InputLineDefault, { name: 'input' }), 'button wrapper')]
});

const EditPrompt = component(ConfirmPrompt, {
  defaultViewModel: EditPromptModel,
  name: 'edit prompt',
  submorphs: [add({
    name: 'editor',
    type: Text,
    fontSize: 12,
    master: InputLineDefault,
    height: 300
  }, 'button wrapper')]
});

const PasswordPrompt = component(ConfirmPrompt, {
  defaultViewModel: PasswordPromptModel,
  name: 'password prompt',
  master: DarkPrompt,
  submorphs: [
    {
      name: 'prompt title',
      lineWrapping: 'by-words'
    },
    add({
      name: 'input',
      type: PasswordInputLine,
      placeholder: 'Password',
      dropShadow: new ShadowObject({ distance: 4, color: Color.rgba(0, 0, 0, 0.26), blur: 10 }),
      master: InputLineDefault
    }, 'button wrapper')
  ]
});

const ListPrompt = component(ConfirmPrompt, {
  defaultViewModel: ListPromptModel,
  name: 'list prompt',
  extent: pt(441.8, 537.2),
  master: DarkPrompt,
  submorphs: [
    {
      name: 'promptTitle',
      lineWrapping: 'by-words'
    },
    add({
      type: FilterableList,
      name: 'prompt list',
      layout: new TilingLayout({
        axis: 'column',
        orderByIndex: true,
        resizePolicies: [['input', {
          height: 'fixed',
          width: 'fill'
        }], ['list', {
          height: 'fill',
          width: 'fill'
        }]],
        spacing: 5,
        wrapSubmorphs: false
      }),
      borderColor: Color.rgb(204, 204, 204),
      borderWidth: 0,
      extent: pt(442, 385),
      selectedAction: 'default',
      submorphs: [{
        type: InputLine,
        name: 'input',
        borderRadius: 5,
        dropShadow: new ShadowObject({ distance: 3, rotation: 75, color: Color.rgba(0, 0, 0, 0.2) }),
        extent: pt(355, 26),
        fill: Color.rgba(204, 204, 204, 0.8),
        fixedHeight: false,
        fontColor: Color.rgb(102, 102, 102),
        fontFamily: '"IBM Plex Sans"',
        fontSize: 16,
        padding: rect(10, 2, 0, 0)
      }, {
        type: List,
        name: 'list',
        borderColor: Color.rgb(149, 165, 166),
        borderRadius: 4,
        dropShadow: new ShadowObject({ distance: 3, rotation: 75, color: Color.rgba(0, 0, 0, 0.2) }),
        extent: pt(410, 354),
        fill: Color.rgba(66, 73, 73, 0.85),
        fontFamily: 'Monaco, monospace',
        itemHeight: 16,
        itemPadding: undefined,
        manualItemHeight: true,
        master: false,
        multiSelect: true,
        nonSelectionFontColor: Color.rgb(204, 204, 204),
        padding: rect(7, 6, -4, -3),
        position: pt(0, 31),
        scroll: pt(2, 0),
        selectedIndex: undefined,
        selectedIndexes: [],
        selectionColor: Color.rgb(230, 230, 230),
        selectionFontColor: Color.rgb(0, 0, 0),
        selections: []
      }],
      theme: 'dark'
    }, 'button wrapper')
  ]
});

const EditListPrompt = component(ListPrompt, {
  defaultViewModel: EditListPromptModel,
  name: 'edit list prompt',
  submorphs: [
    {
      name: 'button wrapper',
      submorphs: [
        add(part(PlainButton, { name: 'add item button' })),
        add(part(PlainButton, {
          name: 'remove item button',
          submorphs: [{
            name: 'label',
            textAndAttributes: Icon.textAttribute('minus')
          }]
        }))
      ]
    }
  ]
});

export { GreenButton, RedButton, GreenButtonClicked, RedButtonClicked, PlainButton, PlainButtonClicked, LightPrompt, DarkPrompt, InformPrompt, ConfirmPrompt, ChoiceButtonSelected, ChoiceButtonUnselected, MultipleChoicePrompt, TextPrompt, EditPrompt, PasswordPrompt, ListPrompt, EditListPrompt };
