/*global System*/
import { Rectangle, rect, Color, pt } from 'lively.graphics';
import { morph, VerticalLayout, Morph, StyleSheet, Text, GridLayout,
  Icon, HorizontalLayout, InputLine, PasswordInputLine } from 'lively.morphic';
import { arr, obj, promise } from "lively.lang";
import { connect } from 'lively.bindings';

import { List, FilterableList } from './list.js';
import { RadioButtonGroup, RadioButton } from "./buttons.js";

export class AbstractPrompt extends Morph {

  static get properties() {
    return {
      fill: {defaultValue: Color.black.withA(0.6)},
      extent: {defaultValue: pt(300,80)},
      borderRadius: {defaultValue: 5},
      dropShadow: {initialize() { this.dopShadow = true; }},
      clipMode: {defaultValue: 'hidden'},
      _isActive: {defaultValue: false},
      autoRemove: {defaultValue: true},
      epiMorph: { defaultValue: true },
      answer: {defaultValue: null, derived: true},
      label: {
        derived: true,
        after: ['submorphs'],
        get() { return this.getSubmorphNamed("promptTitle").value; },
        set(label) { this.getSubmorphNamed("promptTitle").value = label; } 
      },
    };
  }

  constructor(props = {}) {
    super(obj.dissoc(props, ["label", "commands", "keybindings"]));
    this.build(props);
    if (props.commands) this.addCommands(props.commands);
    if (props.keybindings) this.addKeyBindings(props.keybindings);
  }

  get isPrompt() { return true; }

  resolve(arg) { return this.answer.resolve(arg); }
  reject(reason = undefined) { return this.answer.resolve(reason); }

  async activate() {
    this.focus();
    this.answer = promise.deferred();
    this._isActive = true;
    promise.finally(this.answer.promise, () => this._isActive = false);
    if (this.autoRemove)
      promise.finally(this.answer.promise, () => this.fadeOut(200));
    return this.answer.promise;
  }

  isActive() { return !!this.world() && this._isActive; }

  build() { throw new Error("Not yet implemented"); }
  applyLayout() { throw new Error("Not yet implemented"); }

  get keybindings() {
    return super.keybindings.concat([
      {keys: "Enter", command: "resolve"},
      {keys: "Escape", command: "reject"},
      {keys: {mac: "Meta-."}, command: "reject"}
    ]);
  }

  get commands() {
    return super.commands.concat([
      {name: "resolve", exec: (_, arg) => { this.resolve(arg); return true; }},
      {name: "reject", exec: (_, arg) => { this.reject(arg); return true; }}
    ]);
  }

  async transitionTo(otherPrompt, duration = 300) {
    // assumes to be working with prompts opened in world
    let morphBox = morph({
          fill: this.fill,
          borderRadius: this.borderRadius,
        }),
        scaler = morph({
          fill: null, origin: pt(5,5)
        });
    otherPrompt.opacity = 0;
    otherPrompt.fill = Color.transparent;
    otherPrompt.openInWorld();
    this.fill = Color.transparent;
    $world.addMorph(morphBox, this);
    morphBox.setBounds(this.bounds());

    scaler.openInWorld();
    scaler.addMorph(otherPrompt);
    otherPrompt.center = scaler.origin;
    scaler.center = morphBox.center = this.center;
    scaler.scale = otherPrompt.width / this.width;

    morphBox.whenRendered().then(async () => {
      this.animate({scale: this.width / otherPrompt.width, opacity: 0, duration});
      otherPrompt.animate({opacity: 1, duration});
      scaler.animate({scale: 1, duration});
      await morphBox.animate({bounds: scaler.bounds(), duration});
      otherPrompt.fill = morphBox.fill;
      $world.addMorph(otherPrompt);
      morphBox.remove();
      this.remove();
      scaler.remove();
    });
  }

  addNamed(name, spec) {
    let m = this.getSubmorphNamed(name) || this.addMorph(spec.isMorph ? spec : morph({ ...spec, name }));
    if (spec.label) m.label = spec.label; // to parametrize labels
    if (spec.isMorph) m.name = name;
    return m;
  }

}

export class InformPrompt extends AbstractPrompt {

  static get properties() {
    return {
      lineWrapping: { defaultValue: true },
      master: {
        initialize() {
          this.master = {
            auto: "styleguide://SystemPrompts/prompts/inform"
          }
        }
      }
    }
  }

  // $world.inform('hi. I am an interesting guy.', { lineWrapping: false })

  build(props = {}) {
    var {label, lineWrapping} = props;
    let title = this.addNamed('promptTitle', { type: "text", lineWrapping });
    let okButton = this.addNamed('ok button', {
      type: "button", label: "OK", width: 100,
    });
    this.addNamed('button wrapper', {
      submorphs: [okButton]
    });
    title.textString = label;
    connect(okButton, 'fire', this, 'resolve');
    if (!props.lineWrapping) {
      this.opacity = 0;
      this.whenRendered().then(() => {
        if (title.document) {
          let currentCenter = this.center;
          this.width = Math.max(this.width, title.document.width + 100);
          this.align(this.center, currentCenter);
        }
        this.opacity = 1;
      });
    }
  }

  get keybindings() {
    return super.keybindings.concat([
      {keys: "Escape", command: "resolve"},
    ]);
  }

}

// new ConfirmPrompt().openInWorld()

export class ConfirmPrompt extends AbstractPrompt {

  static get properties() {
    return {
      lineWrapping: { defaultValue: true },
      confirmLabel: { defaultValue: 'OK' },
      rejectLabel: { defaultValue: 'CANCEL' },
      master: { 
        initialize() {
          this.master = {
            auto: 'styleguide://SystemPrompts/prompts/confirm'
          }
        }
      }
    }
  }

  build(props) {
    let title = this.addNamed('promptTitle', {
      type: "text"
    });
    title.value = props.label;
    
    let okButton = this.addNamed('ok button', {
      type: "button",
      label: this.confirmLabel
    });
    let cancelButton = this.addNamed('cancel button', {
      type: "button",
      label: this.rejectLabel
    });
    this.addNamed('button wrapper', { submorphs: [okButton, cancelButton]});
    
    connect(okButton, 'fire', this, 'resolve');
    connect(cancelButton, 'fire', this, 'reject');
    
    title.lineWrapping = this.lineWrapping;
    if (!this.lineWrapping) {
      this.opacity = 0;
      this.whenRendered().then(() => {
        title.lineWrapping = this.lineWrapping;
        let center = this.center;
        this.width = Math.max(this.width, title.document.width + 100);
        this.center = center;
        this.opacity = 1;
      })
    }
  }

  resolve() { super.resolve(true); }
  reject() { super.resolve(false); }

}

// new MultipleChoicePrompt({ label: 'hallo', choices: [1,2,3]}).openInWorld()

export class MultipleChoicePrompt extends AbstractPrompt {

  static get properties() {
    return {
      title: {
        derived: true,
        after: ['submorphs'],
        set(title) {
          this.getSubmorphNamed('title').value = title;
        }
      },
      choices: {
        after: ['submorphs'],
        derived: true,
        set(choices) {
          let choiceContainer;
          if (choiceContainer = this.getSubmorphNamed('choices'))
            choiceContainer.choices = choices;
        }
      },
      master: {
        initialize() {
          this.master = {
            auto: 'styleguide://SystemPrompts/prompts/multiple choice'
          }
        }
      }
    }
  }

  resolve(value) {
    super.resolve(value || this.getSubmorphNamed('choices').value);
  }

  build(props = {choices: ["No choice"]}) {
    let {label, choices} = props;
    let okButton = this.addNamed('ok button', { type: 'button' });
    let cancelButton = this.addNamed('cancel button', { type: 'button' });
    
    if (label) {
      let title = this.addNamed("promptTitle", {
        type: "text",
      });
      title.value = label;
    }

    const choicesContainer = this.addNamed('choices', {
      name: 'choices',
      type: RadioButtonGroup,
    });

    this.addNamed('button wrapper', { submorphs: [okButton, cancelButton]});
    
    okButton && connect(okButton, 'fire', this, 'resolve');
    cancelButton && connect(cancelButton, 'fire', this, 'reject');
    
    this.whenRendered().then(() => {
      choicesContainer.choices = choices;
    });
  }

  onKeyDown(evt) {
    if (/^[0-9]$/.test(evt.keyCombo)) {
      var n = Number(evt.keyCombo)-1;
      var btn = this.getSubmorphNamed("button " + n);
      if (btn) {
        btn.trigger();
        return evt.stop();
      }
    }
    return super.onKeyDown(evt);
  }

}

export class TextPrompt extends AbstractPrompt {

  static async example() {
    await $world.prompt("enter", {input: "a little longer text"});
    await $world.prompt("enter\nsomething", {input: "???"});
  }

  static get properties() {
    return {
      lineWrapping: { defaultValue: true },
      master: {
        initialize() {
          this.master = { auto: 'styleguide://SystemPrompts/prompts/text' }
        }
      }
    }
  }

  get maxWidth() { return this.env.world.visibleBounds().width - 20; }

  build({label, input, historyId, useLastInput}) {
    let title = this.addNamed('promptTitle', {
      type: "text"
    });
    title.value = label;

    var inputLine = this.addNamed('input', Text.makeInputLine({
      historyId,
      highlightWhenFocused: false,
    }));

    inputLine.viewState.fastScroll = false;
    inputLine.textString = input || '';
    
    if (historyId && useLastInput) {
      var lastInput = arr.last(inputLine.inputHistory.items);
      if (lastInput) inputLine.textString = lastInput;
    }

    this.width = Math.max(this.width, title.textBounds().width + 50);

    let okButton = this.addNamed('ok button', {type: "button", label: "OK" });
    let cancelButton = this.addNamed('cancel button', {type: "button", label: "CANCEL" });

    this.addNamed('button wrapper', {
      submorphs: [okButton, cancelButton]
    })

    connect(okButton, 'fire', this, 'resolve');
    connect(cancelButton, 'fire', this, 'reject');

    //this.initLayout();

    title.lineWrapping = this.lineWrapping;
    if (!this.lineWrapping) {
      this.opacity = 0;
      this.whenRendered().then(() => {
        let center = this.center;
        this.width = Math.max(350, title.document.width + 100);
        this.opacity = 1;
        this.center = center;
      })
    }
    
    inputLine.gotoDocumentEnd();
    inputLine.scrollCursorIntoView();
  }

  resolve() { super.resolve(this.getSubmorphNamed("input").acceptInput()); }

  initLayout() {
    // this.initLayout();
    if (this.layout) return;
    const label = this.getSubmorphNamed("promptTitle"),
          input = this.getSubmorphNamed("input");
    label.fit();

    this.whenRendered().then(() => {
      const goalWidth = Math.max(input.textBounds().width, label.textBounds().width) + 20;
      this.width = Math.min(this.maxWidth, goalWidth);
      this.opacity = 1;
    });

    const l = this.layout = new GridLayout({
      columns: [
        0, {paddingLeft: 5},
        1, {paddingLeft: 5, paddingRight: 2.5, fixed: 100},
        2, {paddingRight: 5, paddingLeft: 2.5, fixed: 100},
        3, {paddingRight: 5}
      ],
      rows: [
        0, {fixed: label.textBounds().height + 5, paddingBottom: 5},
        1, {fixed: input.height},
        2, {fixed: 35, paddingTop: 5, paddingBottom: 5},
      ],
      grid: [
        ["promptTitle", "promptTitle", "promptTitle", "promptTitle"],
        ["input", "input", "input", "input"],
        [null, "ok button", "cancel button", null]
      ]
    });
  }

  focus() { this.getSubmorphNamed("input").focus(); }
}

export class EditPrompt extends AbstractPrompt {

  static async example() {
    await $world.editPrompt("enter", {input: "$world.show()", mode: "js", evalEnvironment: {context: 23}});
    this.editorPlugin.evalEnvironment
  }

  static get properties() {
    return {
      extent: {defaultValue: pt(500, 300)},
      master: {
        initialize() {
          this.master = {
            auto: 'styleguide://SystemPrompts/prompts/edit'
          }
        }
      }
    };
  }

  get maxWidth() { return this.env.world.visibleBounds().width - 20; }

  build({label, input, historyId, useLastInput, mode, textStyle, evalEnvironment}) {
    let title = this.addNamed('promptTitle', {
      type: 'text', textString: label
    });

    if (!textStyle) textStyle = {};
    if (mode && !textStyle.fontFamily) textStyle.fontFamily = "Monaco, monospace";

    var inputEditor = this.addNamed('editor', { type: 'text' });

    inputEditor.textString = input || "";
    Object.assign(inputEditor, textStyle);

    inputEditor.changeEditorMode(mode).then(() => {
      if (evalEnvironment && inputEditor.editorPlugin)
        Object.assign(inputEditor.editorPlugin.evalEnvironment, evalEnvironment);
    });

    var inputWidth = inputEditor.textBounds().width + 50;
    // if the input string we pre-fill is wide than we try to make it fit
    if (inputWidth > this.width-25)
      this.width = Math.min(this.maxWidth, inputWidth+125);

    const okButton = this.addNamed('ok button', { type: "button"});
    const cancelButton = this.addNamed('cancel button', { type: "button"});

    this.addNamed('button wrapper', { submorphs: [ okButton, cancelButton ]});
    
    connect(okButton, 'fire', this, 'resolve');
    connect(cancelButton, 'fire', this, 'reject');

    inputEditor.gotoDocumentEnd();
    inputEditor.scrollCursorIntoView();
  }

  resolve(arg) {
    let content = this.getSubmorphNamed("editor").textString.trim();
    if (this.historyId) {
      let hist = InputLine.getHistory(this.historyId);
      hist.items = hist.items.filter(ea => ea !== content);
      hist.items.push(content);
      while (hist.items.length > hist.items.max) hist.items.shift();
      hist.index = hist.items.length;
      InputLine.setHistory(this.historyId, hist);
    }
    return super.resolve(content);
  }

  get keybindings() {
    return [
      {keys: {mac: "Meta-Enter|Meta-S", win: 'Ctrl-Enter|Ctrl-S'}, command: "resolve"},
      {keys: "Escape", command: "reject"},
      {keys: "Alt-P|Alt-Up", command: "history back"},
      {keys: "Alt-N|Alt-Down", command: "history forward"},
      {keys: "Alt-H", command: "browse history"},
    ];
  }

  get commands() {
    return super.commands.concat([
      {
        name: "history back",
        exec: (_, arg) => {
          if (this.historyId) {
            let hist = InputLine.getHistory(this.historyId), {items, index} = hist;
            hist.index = --index;
            if (index < 0) hist.index = index = items.length - 1;
            this.get("editor").undoManager.group();
            this.get("editor").textString = items[index];
            this.get("editor").undoManager.group();
          }
          return true;
        }
      },

      {
        name: "browse history",
        exec: async (_, arg) => {
          if (this.historyId) {
            let hist = InputLine.getHistory(this.historyId),
                {status, list, selections: [choice]} = await this.world().editListPrompt(
                  "input history " + this.historyId, hist.items, {requester: this});
            if (status !== "canceled") {
              hist.items = list;
              InputLine.setHistory(this.historyId, hist);
              if (choice) {
                hist.index = hist.items.indexOf(choice);
                this.get("editor").textString = choice;
              }
            }
          }
          return true;
        }
      },

      {
        name: "history forward",
        exec: (_, arg) => {
          if (this.historyId) {
            let hist = InputLine.getHistory(this.historyId), {items, index} = hist;
            hist.index = ++index;
            if (index >= items.length) hist.index = index = 0;
            this.get("editor").undoManager.group();
            this.get("editor").textString = items[index];
            this.get("editor").undoManager.group();
          }
          return true;
        }
      }
    ]);
  }

  focus() { this.getSubmorphNamed("editor").focus(); }
}

export class PasswordPrompt extends AbstractPrompt {

  static get properties() {
    return {
      maxWidth: {
        readOnly: true,
        get() {
          return 800;
        }
      },
      master: {
        initialize() {
          this.master = {
            auto: "styleguide://SystemPrompts/prompts/password"
          }
        }
      }
    }
  }

  build({label, placeholder}) {
    const title = this.addNamed("promptTitle", {
      type: "text", value: label,
      fixedHeight: true, // FIXME: this is a nasty vdom/text rendering bug
    });

    const passwordInput = this.addNamed("input", {
      type: PasswordInputLine,
      name: "input",
      placeholder: placeholder || "",
    });
      
    const okButton = this.addNamed("ok button", { type: "button", label: "OK" });
    const cancelButton = this.addNamed("cancel button", {type: "button", label: "CANCEL"});

    connect(okButton, 'fire', this, 'resolve');
    connect(cancelButton, 'fire', this, 'reject');

    this.addNamed("button wrapper", {
      submorphs: [okButton, cancelButton],
    });
  }

  resolve() { super.resolve(this.get("input").acceptInput()); }

  focus() {
    let i = this.get("input");
    i.whenRendered().then(() => i.focus());
  }
}

// new ListPrompt({ label: 'hallo', filterable: false, items: [1,2,3,4]}).openInWorld()

export class ListPrompt extends AbstractPrompt {
  
  static async example() {
    await $world.listPrompt("hello", [1,2,3,4], {multiSelect: true});
  }

  static get properties() {
    return {
      items: {
        derived: true,
        after: ['submorphs'],
        set(items) {
          if (this.submorphs.length > 0)
            this.getSubmorphNamed('prompt list').items = items || [];
        }
      },
      filterable: {},
      master: {
        after: ['filterable'],
        initialize() {
          this.master = {
            auto: this.getMaster()
          }
        }
      },
      preselect: {
        derived: true,
        after: ['items'],
        set(idx) {
          let list = this.getSubmorphNamed('prompt list');
          if (!list) return;
          list.selectedIndex = idx;
          list.scrollSelectionIntoView;
        }
      },
      onSelection: {
        derived: true,
        after: ['preselect', 'submorphs'],
        set(cb) {
          let list = this.getSubmorphNamed('prompt list');
          if (!list) return;
          connect(list, "selection", (sel) => cb(sel, this));
        }
      }
    }
  }

  onChange(change) {
    super.onChange(change);
    if (change.prop == 'extent' && this.layout && !this.layout.active) {
      let delta = change.value.subPt(change.prevValue);
      this.getSubmorphNamed('prompt list').height += delta.y;
    }
  }

  getMaster() {
    return this.filterable ? `styleguide://SystemPrompts/prompts/list` : `styleguide://SystemPrompts/prompts/edit list`
  }

  reset() {
    this.items = [];
  }

  build({label,
    listFontSize,
    listFontFamily,
    labelFontSize,
    labelFontFamily,
    filterable,
    padding,
    itemPadding,
    extent,
    multiSelect,
    historyId,
    useLastInput,
    fuzzy, filterFunction, sortFunction,
    actions, selectedAction, theme, items,
    onSelection
  }) {

    this.extent = extent || pt(500,400);
    labelFontFamily = labelFontFamily || "Helvetica Neue, Arial, sans-serif";
    labelFontSize = labelFontSize || 15;
    listFontFamily = listFontFamily || "Monaco, monospace";
    listFontSize = listFontSize || 12;

    let title = this.addNamed('promptTitle', {
      type: "text"
    });
    title.textString = label;

    let list =  this.addNamed('prompt list', {
      type: filterable ? FilterableList : List,
      multiSelect,
      historyId,
      useLastInput,
    });

    // this should be handled by the base master
    if (filterable) {
      this.get('list').master = false;
    } else {
      this.get('prompt list').master = false;
    }

    list.items = items;

    if (filterable && fuzzy) list.fuzzy = fuzzy;
    if (filterable && typeof filterFunction === "function")
      list.filterFunction = filterFunction;
    if (filterable && typeof sortFunction === "function")
      list.sortFunction = sortFunction;
    if (onSelection && typeof onSelection === "function")
      this.onSelection = onSelection;
    if (filterable && actions)
      list.actions = actions;
    if (filterable && selectedAction)
      list.selectedAction = selectedAction;

    let okButton = this.addNamed('ok button', {
      type: "button",
    });
    let cancelButton = this.addNamed('cancel button', {
      type: "button",
    });
    this.addNamed('button wrapper', { submorphs: [okButton, cancelButton]});
    connect(okButton, 'fire', this, 'resolve');
    connect(cancelButton, 'fire', this, 'reject');

    if (filterable) {
      connect(list, 'accepted', this, 'resolve');
      connect(list, 'canceled', this, 'reject');
      list.whenRendered().then(() => list.relayout());
    }
  }

  resolve(arg) {
    let list = this.getSubmorphNamed("prompt list");
    var answer = arg || list instanceof FilterableList ?
      list.acceptInput() :
      {selected: list.selections, status: "accepted", actions: "default"};
    return this.answer.resolve(answer);
  }

  reject() {
    return this.answer.resolve({
      prompt: this, selected: [],
      filtered: [], status: "canceled"
    });
  }

  focus() { this.getSubmorphNamed("prompt list").focus(); }

}

export class EditListPrompt extends ListPrompt {

  static async example() {
    await $world.editListPrompt("hello", [1,2,3,4], {multiSelect: true});
  }

  static get properties() {
    return {
      master: {
        initialize() {
          this.master = { auto: 'styleguide://SystemPrompts/prompts/edit list' }
        }
      }
    }
  }

  build(props) {
    super.build(props);

    this.getSubmorphNamed('prompt list').items = props.items;

    var addBtn = this.addNamed("add item button", {
        type: 'button',
        label: Icon.makeLabel("plus")
      }),
      rmBtn = this.addNamed("remove item button", {
        type: 'button',
        label: Icon.makeLabel("minus")
      });

    this.getSubmorphNamed('button wrapper').addMorph(addBtn);
    this.getSubmorphNamed('button wrapper').addMorph(rmBtn);

    connect(addBtn, 'fire', this, 'addItemToList');
    connect(rmBtn, 'fire', this, 'removeSelectedItemsFromList');
    
  }

  async removeSelectedItemsFromList() {
    var list = this.get("prompt list"),
        selectAfterwards = list.selectedItems.length != 1 ?
          -1 : list.selectedIndex === 0 ? 0 : list.selectedIndex-1;
    list.items = arr.withoutAll(list.items, list.selectedItems);
    if (selectAfterwards < 0) list.selection = null;
    else list.selectedIndex = selectAfterwards;
    list.focus();
  }

  async addItemToList() {
    var list = this.get("prompt list"),
        input = list.selection ? list.items[list.selectedIndex].string : "",
        toAdd = await this.world().prompt(
          "Input to add to the list", {
            historyId: this.historyId || "EditListPrompt-input-history",
            input});
    if (!toAdd) return;
    var list = this.get("list"),
        insertAt = list.selection ? list.selectedIndex+1 : list.items.length;
    list.addItemAt(toAdd, insertAt);
    list.focus();
    list.selectedIndex = insertAt;
  }

  get keybindings() {
    return super.keybindings.concat([
      {keys: {mac: "Meta-Enter", win: 'Ctrl-Enter'}, command: "resolve"},
      {keys: 'Ctrl-G', command: "deselect"},
      {keys: 'Shift-=|+', command: "add item to list"},
      {keys: 'Delete|-|Backspace', command: "remove item from list"},
    ]);
  }

  get commands() {
    return super.commands.concat([
      {
        name: "deselect",
        exec: () => { this.get("list").selection = null; return true; }
      },
      {
        name: "add item to list",
        exec: () => { this.addItemToList(); return true; }
      },
      {
        name: "remove item from list",
        exec: () => { this.removeSelectedItemsFromList(); return true; }
      }
    ]);
  }

  resolve() {
    var {values: list, selections} = this.get("prompt list");
    return this.answer.resolve({list, selections});
  }

  reject() { return this.answer.resolve({list: [], selections: [], status: "canceled"}); }
}
