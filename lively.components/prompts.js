/*global System*/
import { Rectangle, rect, Color, pt } from 'lively.graphics';
import { morph, VerticalLayout, Morph, StyleSheet, Text, GridLayout,
  Icon, HorizontalLayout, InputLine, PasswordInputLine } from 'lively.morphic';
import { arr, obj, promise } from "lively.lang";
import { connect } from 'lively.bindings';

import { List, FilterableList } from './list.js';

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
      answer: {defaultValue: null, derived: true},
      label: {
        derived: true,
        after: ['submorphs'],
        get() { return this.getSubmorphNamed("promptTitle").value; },
        set(label) { this.getSubmorphNamed("promptTitle").value = label; } 
      },
      styleSheets: {
        initialize() {
          this.styleSheets = new StyleSheet({
            "[name=promptTitle]": {
              fontWeight: 'bold',
              textAlign: 'center',
              fill: null, 
              padding: Rectangle.inset(3),
              fontSize: 14, 
              fontColor: Color.gray,
              fixedHeight: true,
              clipMode: 'visible'
            },
            ".Button": {borderRadius: 15},
            ".Button.standard": {
              borderWidth: 2,
              fill: Color.transparent,
              borderColor: Color.white,
              nativeCursor: "pointer"
            },
            ".Button.cancel": {
              borderWidth: 2,
              fill: Color.transparent,
              borderColor: Color.red.lighter(),
              fontStyle: "bold",
              nativeCursor: "pointer"
            },
            ".Button.ok": {
              borderWidth: 2,
              fill: Color.transparent,
              borderColor: Color.green.lighter(),
              fontStyle: "bold",
              nativeCursor: "pointer"
            },
            ".Button.standard [name=label]": {
              fontStyle: "bold",
              fontColor: Color.white
            },
            ".List": {
              fill: Color.transparent,
            },
            ".Button.cancel [name=label]": {
              fontColor: Color.red.lighter(),
              fontStyle: "bold"
            },
            ".Button.ok [name=label]": {
              fontColor: Color.green.lighter(),
              fontStyle: "bold"
            }
          });
        }
      }
    };
  }

  constructor(props = {}) {
    super(obj.dissoc(props, ["label", "commands", "keybindings"]));
    this.build(props);
    if (props.commands) this.addCommands(props.commands);
    if (props.keybindings) this.addKeyBindings(props.keybindings);
  }

  get isEpiMorph() { return true; }
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
    return this.getSubmorphNamed(name) || this.addMorph({ ...spec, name });
  }

}

// $world.inform(lively.lang.arr.range(0,40).join("\n"))
export class InformPrompt extends AbstractPrompt {

  static get properties() {
    return {
      lineWrapping: { defaultValue: true },
    }
  }

  build(props = {}) {
    var {label} = props;
    let title = this.addNamed('promptTitle', { type: "label"});
    let okButton = this.addNamed('ok button', {
      styleClasses: ['ok'], type: "button", label: "OK",
    });
    title.value = label;
    connect(okButton, 'fire', this, 'resolve');
    if (!this.layout) this.initLayout();
    title.lineWrapping = props.lineWrapping;
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

  initLayout() {
    const label = this.getSubmorphNamed("promptTitle");
    label.fit();
    this.height = label.height + 30;
    this.get('ok button').extent = pt(100,25);
    this.layout = new VerticalLayout({
      align: "center", spacing: 5
    });
    this.whenRendered().then(() => this.layout.apply())
  }

  get keybindings() {
    return super.keybindings.concat([
      {keys: "Escape", command: "resolve"},
    ]);
  }

}

export class ConfirmPrompt extends AbstractPrompt {

  static get properties() {
    return {
      lineWrapping: { defaultValue: true }
    }
  }

  build(props) {
    let title = this.addNamed('promptTitle', {
      type: "label"
    });
    title.value = props.label;
    
    let okButton = this.addNamed('ok button', {
      styleClasses: ['ok'],
      type: "button",
      label: "OK"
    });
    let cancelButton = this.addNamed('cancel button', {
      styleClasses: ['cancel'],
      type: "button",
      label: "Cancel"
    });
    connect(okButton, 'fire', this, 'resolve');
    connect(cancelButton, 'fire', this, 'reject');
    
    this.initLayout();
    
    title.lineWrapping = this.lineWrapping;
    if (!this.lineWrapping) {
      this.opacity = 0;
      this.whenRendered().then(() => {
        let center = this.center;
        this.width = Math.max(this.width, title.document.width + 100);
        this.center = center;
        this.opacity = 1;
      })
    }
  }

  resolve() { super.resolve(true); }
  reject() { super.resolve(false); }

  initLayout() {
    if (this.layout) return;
    const label = this.getSubmorphNamed("promptTitle");
    this.opacity = 0;
    this.whenRendered().then(() => {
      this.width = Math.max(125, label.textBounds().width) + 10;
      this.layout = new GridLayout({
        columns: [
          0, {paddingLeft: 5},
          1, {paddingRight: 2.5, fixed: 60},
          2, {paddingLeft: 2.5, fixed: 60},
          3, {paddingRight: 5}
        ],
        rows: [
          0, {fixed: label.textBounds().height + 10},
          1, {paddingBottom: 5, fixed: 30}
        ],
        grid: [["promptTitle", "promptTitle", "promptTitle", "promptTitle"],
          [null, "ok button", "cancel button", null]]
      });
      this.height = label.textBounds().height + 40;
      this.opacity = 1;
    })
  }
}


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
      }
    }
  }

  resolve(value) {
    super.resolve(value || this.getSubmorphNamed('choices').value);
  }

  build(props = {choices: ["No choice"]}) {
    let {label, choices} = props;
    let okButton = this.getSubmorphNamed('ok button');
    let cancelButton = this.getSubmorphNamed('cancel button');
    
    if (label) {
      let title = this.addNamed("promptTitle", {
        type: "label",
      });
      title.value = label;
    }

    if (this.getSubmorphsByStyleClassName('RadioButtonGroup').length == 0) {
      let choicesContainer = this.addMorph({
        name: 'choices',
        fill: Color.transparent,
        layout: new VerticalLayout({spacing: 5, 
                                    resizeSubmorphs: true,
                                    direction: 'centered'})
      });
  
      choices.forEach((choice, i) => {
        var btn = choicesContainer.addMorph({
          name: "button " + i, type: "button",
          styleClasses: ['standard'],
          padding: Rectangle.inset(10, 8),
          label: choice});
        btn.choice = choice;
        connect(btn, 'fire', this, 'resolve', {converter: function() { return this.sourceObj.choice; }});
      });
    }
    if (!this.layout) this.initLayout();
    
    okButton && connect(okButton, 'fire', this, 'resolve');
    cancelButton && connect(cancelButton, 'fire', this, 'reject');
    
    let choiceMorphs = this.getSubmorphsByStyleClassName('RadioButton');
    this.opacity = 0;
    this.whenRendered().then(() => {
      let originalCenter = this.center;
      this.width = arr.max([this.width, ...choiceMorphs.map(m => m.bounds().width + 70)]);
      this.align(this.center, originalCenter);
      this.opacity = 1;
    })
  }

  initLayout() {
    // fixme: layout should be able to let one morph
    //         define the overall width of the container
    var label = this.getSubmorphNamed("promptTitle"),
        choices = this.get('choices');
    label && label.fit();
    var buttons = choices.submorphs.filter(({isButton}) => isButton);
    buttons.forEach(ea => ea.fit());

    this.layout = new GridLayout({
      fitToCell: true,
      columns: [0, {paddingLeft: 5, paddingRight: 5}],
      rows: label ? [0, {height: 20, fixed: true},
        1, {paddingBottom: 10}] : [0, {paddingBottom: 10}],
      grid: label ?
        [["promptTitle"],
          ['choices']] :
        [['choices']],
    });

    this.width = Math.max(
      label ? label.width : 0,
      choices.bounds().width);

    this.height = choices.bounds().height + label.height;
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
      lineWrapping: { defaultValue: true }
    }
  }

  get maxWidth() { return this.env.world.visibleBounds().width - 20; }

  build({label, input, historyId, useLastInput}) {
    let title = this.addNamed('promptTitle', {
      type: "label"
    });
    title.value = label;

    var inputLine = this.getSubmorphNamed('input') || Text.makeInputLine({
      historyId,
      highlightWhenFocused: false,
      name: "input",
      borderWidth: 0, borderRadius: 20, fill: Color.rgbHex("#DDD"),
      fontSize: 14, fontColor: Color.rgbHex("#666"),
      padding: Rectangle.inset(5,5), fixedHeight: false
    });

    inputLine.viewState.fastScroll = false;
    inputLine.textString = input || '';
    
    if (historyId && useLastInput) {
      var lastInput = arr.last(inputLine.inputHistory.items);
      if (lastInput) inputLine.textString = lastInput;
    }

    var inputWidth = inputLine.textBounds().width;
    // if the input string we pre-fill is wide than we try to make it fit
    if (inputWidth > this.width-25)
      this.width = Math.min(this.maxWidth, inputWidth+25);

    let okButton = this.addNamed('ok button', {type: "button", label: "OK", styleClasses: ['ok']});
    let cancelButton = this.addNamed('cancel button', {type: "button", label: "Cancel", styleClasses: ['cancel']});

    connect(okButton, 'fire', this, 'resolve');
    connect(cancelButton, 'fire', this, 'reject');

    this.initLayout();

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
    };
  }

  get maxWidth() { return this.env.world.visibleBounds().width - 20; }

  build({label, input, historyId, useLastInput, mode, textStyle, evalEnvironment}) {
    let title = this.getSubmorphNamed('promptTitle') || this.addMorph({
      fill: null, padding: Rectangle.inset(3), fontSize: 14, fontColor: Color.gray,
      name: "promptTitle", type: "label", value: label
    });

    if (!textStyle) textStyle = {};
    if (mode && !textStyle.fontFamily) textStyle.fontFamily = "Monaco, monospace";

    var inputEditor = this.getSubmorphNamed('editor') || this.addMorph(new Text({
      name: "editor",
      clipMode: "auto",
      borderWidth: 0, borderRadius: 5, fill: Color.white,
      fontSize: 12, fontColor: Color.rgbHex("#666"),
      padding: Rectangle.inset(8,4), fixedHeight: false,
    }));

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

    if (!this.getSubmorphNamed('ok button'))
      this.addMorph({name: "ok button", type: "button", label: "OK", styleClasses: ['ok']});
    if (!this.getSubmorphNamed('cancel button'))
      this.addMorph({name: "cancel button", type: "button", label: "Cancel", styleClasses: ['cancel']});

    connect(this.getSubmorphNamed("ok button"), 'fire', this, 'resolve');
    connect(this.getSubmorphNamed("cancel button"), 'fire', this, 'reject');
    

    this.whenRendered().then(() => this.initLayout());

    inputEditor.gotoDocumentEnd();
    inputEditor.scrollCursorIntoView();
  }

  initLayout() {
    // this.initLayout();
    if (this.layout) return;
    const label = this.getSubmorphNamed("promptTitle"),
          editor = this.getSubmorphNamed("editor");
    label.fit();

    const minWidth = Math.max(editor.textBounds().width+20, label.width);
    if (this.width < minWidth)
      this.width = Math.min(this.maxWidth, minWidth + 20);

    const l = this.layout = new GridLayout({
      columns: [
        0, {paddingLeft: 4},
        1, {fixed: 100, paddingRight: 2.5},
        2, {paddingLeft: 2.5, paddingRight: 4, fixed: 100}
      ],
      rows: [
        0, {fixed: label.height, paddingBottom: 2.5},
        2, {paddingTop: 5, paddingBottom: 5, fixed: 35},
      ],
      grid: [
        ["promptTitle", "promptTitle", "promptTitle"],
        ["editor", "editor", "editor"],
        [null, "ok button", "cancel button"]
      ]
    });
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

  get maxWidth() { return 800; }

  build({label, placeholder}) {
    let title = this.getSubmorphNamed('promptTitle') || this.addMorph({
      name: "promptTitle", type: "label", value: label
    });

    var passwordInput = this.getSubmorphNamed('input') || this.addMorph(new PasswordInputLine({
      fontSize: 20, name: "input", borderRadius: 20, 
      fill: Color.rgbHex("#DDD"),
      padding: rect(5,10,2,-2),
      placeholder: placeholder || "", borderWidth: 0
    }));

    if (!this.getSubmorphNamed('ok button'))
      this.addMorph({name: "ok button", type: "button", label: "OK", styleClasses: ['ok']});
    if (!this.getSubmorphNamed('cancel button'))
      this.addMorph({name: "cancel button", type: "button", label: "Cancel", styleClasses: ['cancel']});

    connect(this.get("ok button"), 'fire', this, 'resolve');
    connect(this.get("cancel button"), 'fire', this, 'reject');

    if (!this.layout) {
      this.layout = new GridLayout({
        rows: [
          0, {fixed: 25},
          1, {paddingBottom: 5},
          2, {paddingBottom: 5}
        ],
        columns: [
          0, {height: 20, paddingLeft: 5, paddingRight: 2.5, min: 50},
          //1, {fixed: 100},
          1, {paddingLeft: 2.5, paddingRight: 5, min: 50}
        ],
        grid: [["promptTitle", "promptTitle"],
          ["input", "input"],
          ["ok button", "cancel button"]]
      });
    }
  }

  resolve() { super.resolve(this.get("input").acceptInput()); }

  focus() {
    let i = this.get("input");
    i.whenRendered().then(() => i.focus());
  }
}

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
            this.getSubmorphNamed('list').items = items || [];
        }
      },
      preselect: {
        derived: true,
        after: ['items'],
        set(idx) {
          if (this.submorphs.length == 0) return;
          let list = this.getSubmorphNamed('list');
          list.selectedIndex = idx;
          list.scrollSelectionIntoView;
        }
      },
      onSelection: {
        derived: true,
        after: ['preselect'],
        set(cb) {
          connect(this.getSubmorphNamed('list'), "selection", () => cb(this));
        }
      }
    }
  }

  onChange(change) {
    super.onChange(change);
    if (change.prop == 'extent' && this.layout && !this.layout.active) {
      let delta = change.value.subPt(change.prevValue);
      this.getSubmorphNamed('list').height += delta.y;
    }
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
    actions, selectedAction, theme, items
  }) {

    this.extent = extent || pt(500,400);
    labelFontFamily = labelFontFamily || "Helvetica Neue, Arial, sans-serif";
    labelFontSize = labelFontSize || 15;
    listFontFamily = listFontFamily || "Monaco, monospace";
    listFontSize = listFontSize || 12;

    let title = this.addNamed('promptTitle', {
      type: "label"
    });
    title.value = label;

    let list =  this.addNamed('list', {
      type: filterable ? FilterableList : List,
      multiSelect,
      historyId, useLastInput,
      borderWidth: 0, borderColor: Color.gray,
      fontSize: listFontSize, fontFamily: listFontFamily,
      padding, itemPadding, inputPadding: Rectangle.inset(10,2),
      theme: 'dark'
    });

    list.items = items;

    if (filterable && fuzzy) list.fuzzy = fuzzy;
    if (filterable && typeof filterFunction === "function")
      list.filterFunction = filterFunction;
    if (filterable && typeof sortFunction === "function")
      list.sortFunction = sortFunction;
    if (filterable && actions)
      list.actions = actions;
    if (filterable && selectedAction)
      list.selectedAction = selectedAction;

    let okButton = this.addNamed('ok button', {
      type: "button", label: "Select",
      styleClasses: ['ok']
    });
    let cancelButton = this.addNamed('cancel button', {
      type: "button", label: "Cancel",
      styleClasses: ['cancel']
    });
    connect(okButton, 'fire', this, 'resolve');
    connect(cancelButton, 'fire', this, 'reject');

    if (!this.layout) {
      this.layout = new GridLayout({
        rows: [
          0, {fixed: 25},
          1, {paddingBottom: 10},
          2, {fixed: 30, paddingBottom: 5}
        ],
        columns: [
          0, {paddingLeft: 5},
          1, {fixed: 100, paddingRight: 5},
          2, {fixed: 100, paddingRight: 5}
        ],
        grid: [
          ["promptTitle", "promptTitle", "promptTitle"],
          ["list", "list", "list"],
          [null,"ok button", "cancel button"]
        ]
      }); 
    }

    if (filterable) {
      connect(list, 'accepted', this, 'resolve');
      connect(list, 'canceled', this, 'reject');
    }
  }

  resolve(arg) {
    let list = this.getSubmorphNamed("list");
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

  focus() { this.getSubmorphNamed("list").focus(); }

}


export class EditListPrompt extends ListPrompt {

  static async example() {
    await $world.editListPrompt("hello", [1,2,3,4], {multiSelect: true});
  }

  build(props) {
    super.build(props);

    this.getSubmorphNamed('list').items = props.items;

    var addBtn = this.addNamed("add item button", {
          type: 'button',
          styleClasses: ['standard'],
          label: Icon.makeLabel("plus", {fontSize: 12})
        }),
        rmBtn = this.addNamed("remove item button", {
          styleClasses: ['standard'],
          type: 'button',
          label: Icon.makeLabel("minus", {fontSize: 12})
        });

    connect(addBtn, 'fire', this, 'addItemToList');
    connect(rmBtn, 'fire', this, 'removeSelectedItemsFromList');

    if (!this.layout) {
      this.layout = new GridLayout({
        autoAssign: false,
        columns: [
          0, {paddingLeft: 5, paddingRight: 5},
          3, {paddingRight: 5},
          4, {paddingRight: 5}
        ],
        rows: [
          0, {fixed: 30, paddingTop: 5, paddingBottom: 5},
          1, {paddingBottom: 2},
          2, {fixed: 30, paddingBottom: 5}
        ],
        grid: [["promptTitle", "promptTitle", "promptTitle", "promptTitle", "promptTitle"],
          ["list", "list", "list", "list", "list"],
          ["add item button", "remove item button", null, "ok button", "cancel button"]]
      });
    }
    
  }

  async removeSelectedItemsFromList() {
    var list = this.get("list"),
        selectAfterwards = list.selectedItems.length != 1 ?
          -1 : list.selectedIndex === 0 ? 0 : list.selectedIndex-1;
    list.items = arr.withoutAll(list.items, list.selectedItems);
    if (selectAfterwards < 0) list.selection = null;
    else list.selectedIndex = selectAfterwards;
    list.focus();
  }

  async addItemToList() {
    var list = this.get("list"),
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
    var {values: list, selections} = this.get("list");
    return this.answer.resolve({list, selections});
  }

  reject() { return this.answer.resolve({list: [], selections: [], status: "canceled"}); }
}
