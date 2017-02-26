/*global System*/
import { Rectangle, Color, pt } from 'lively.graphics';
import { Morph, morph, Text, GridLayout } from 'lively.morphic';
import { arr, obj, promise } from "lively.lang";
import { List, FilterableList } from "./list.js"
import { PasswordInputLine } from "../text/input-line.js"
import { Icon } from "./icons.js"
import { connect } from 'lively.bindings';


export class AbstractPrompt extends Morph {

  constructor(props = {}) {
    super({
      fill: Color.black.withA(0.6), extent: pt(300,80), borderRadius: 5,
      dropShadow: true,
      ...obj.dissoc(props, ["label", "autoRemove", "commands", "keybindings"])});

    this.build(props);
    this.state = {
      answer: null,
      isActive: false,
      autoRemove: props.hasOwnProperty("autoRemove") ? props.autoRemove : true
    };

    if (props.commands) this.addCommands(props.commands);
    if (props.keybindings) this.addKeyBindings(props.keybindings);
  }

  get isEpiMorph() { return true }
  get isPrompt() { return true }

  get label() { return this.get("label").textString; }
  set label(label) {
    this.get("label").textString = label;
  }

  resolve(arg) { this.state.answer.resolve(arg); }
  reject(reason) { this.state.answer.resolve(undefined); }

  async activate() {
    this.focus();
    this.state.answer = promise.deferred();
    this.state.isActive = true;
    promise.finally(this.state.answer.promise, () => this.state.isActive = false);
    if (this.state.autoRemove)
      promise.finally(this.state.answer.promise, () => this.fadeOut(500));
    return this.state.answer.promise;
  }

  isActive() { return !!this.world() && this.state.isActive; }

  build() { throw new Error("Not yet implemented"); }
  applyLayout() { throw new Error("Not yet implemented"); }

  onKeyDown(evt) {
    switch (evt.keyCombo) {
      case 'Enter': this.resolve(); evt.stop(); break;
      case 'Escape': this.reject(); evt.stop(); break;
      default: return super.onKeyDown(evt);
    }
  }

  get buttonStyle() {
    return {
      type: "button",
      activeStyle: {
        borderWidth: 2,
        fill: Color.transparent,
        fontColor: Color.white,
        borderColor: Color.white,
        fontStyle: "bold",
        nativeCursor: "pointer"
      }
    }
  }

  get okButtonStyle() {
    return {
      activeStyle: {
        borderWidth: 2,
        fill: Color.transparent,
        borderColor: Color.green.lighter(),
        fontColor: Color.green.lighter(),
        fontStyle: "bold",
        nativeCursor: "pointer"
      }
    }
  }

  get cancelButtonStyle() {
    return {
      activeStyle: {
        borderWidth: 2,
        fill: Color.transparent,
        borderColor: Color.red.lighter(),
        fontColor: Color.red.lighter(),
        fontStyle: "bold",
        nativeCursor: "pointer"
      }
    }
  }

}

// $world.inform(lively.lang.arr.range(0,40).join("\n"))
export class InformPrompt extends AbstractPrompt {

  build(props = {}) {
    var {label} = props;
    this.addMorph({
      name: "label", type: "label", value: props.label,
      fill: null, padding: Rectangle.inset(3), fontSize: 14, fontColor: Color.gray
    });
    this.addMorph({
      name: "ok button", type: "button", label: "OK",
      ...this.okButtonStyle
    });
    connect(this.get("ok button"), 'fire', this, 'resolve');
    this.initLayout();
  }

  initLayout() {
     const label = this.get("label");
     label.fit();
     this.width = label.width + 10;
     this.height = label.height + 30;
     const l = this.layout = new GridLayout({
        columns: [
          0, {paddingLeft: 5},
          1, {fixed: 100},
          2, {paddingRight: 5}
        ],
        rows: [
          1, {paddingBottom: 5, fixed: 30},
        ],
        grid: [["label", "label", "label"],
               [null, "ok button", null]]
     });
  }

  onKeyDown(evt) {
    switch (evt.keyCombo) {
      case 'Escape': case 'Enter': this.resolve(); evt.stop(); break;
      default: return super.onKeyDown(evt);
    }
  }

}


export class ConfirmPrompt extends AbstractPrompt {

  build(props) {
    this.addMorph({
      name: "label", type: "label", value: props.label,
      fill: null, padding: Rectangle.inset(3), fontSize: 14, fontColor: Color.gray
    });
    this.addMorph({
      name: "ok button", type: "button",
      label: "OK", ...this.okButtonStyle
    });
    this.addMorph({
      name: "cancel button", type: "button",
      label: "Cancel", ...this.cancelButtonStyle
    });
    connect(this.get("ok button"), 'fire', this, 'resolve');
    connect(this.get("cancel button"), 'fire', this, 'reject');
    this.initLayout();
  }

  resolve() { super.resolve(true); }
  reject() { super.resolve(false); }

  initLayout() {
     // fixme: layout should be able to let one morph
     //         define the overall width of the container
     const label = this.get("label");
     label.fit();
     this.width = label.width + 10;
     this.height = label.height + 30;
     const l = this.layout = new GridLayout({
       columns: [
         0, {paddingLeft: 5},
         1, {paddingRight: 2.5, fixed: 60},
         2, {paddingLeft: 2.5, fixed: 60},
         3, {paddingRIght: 5}
       ], 
       rows: [
         1, {paddingBottom: 5, fixed: 30}
       ],
       grid: [["label", "label", "label", "label"],
              [null, "ok button", "cancel button", null]]
     });
  }
}


export class MultipleChoicePrompt extends AbstractPrompt {

  build(props = {choices: ["No choice"]}) {
    var {label, choices} = props;
    if (label)
      this.addMorph({
        name: "label", type: "label", value: label,
        fill: null, padding: Rectangle.inset(3),
        fontSize: 14, fontColor: Color.gray
      });

    choices.forEach((choice, i) => {
      var btn = this.addMorph({
        name: "button " + i, type: "button",
        padding: Rectangle.inset(10, 8),
        label: choice, ...this.okButtonStyle});
      btn.choice = choice;
      connect(btn, 'fire', this, 'resolve', {converter: function() { return this.sourceObj.choice; }});
    });

    this.initLayout();
  }

  initLayout() {
    // fixme: layout should be able to let one morph
    //         define the overall width of the container
    var label = this.get("label");
    label && label.fit();
    var buttons = this.submorphs.filter(({isButton}) => isButton);
    buttons.forEach(ea => ea.fit())

    this.width = Math.max(
      label ? label.width + 10 : 0,
      buttons.reduce((width, ea) => width + ea.width + 10, 0) + 20);

    const l = this.layout = new GridLayout({
       fitToCell: false,
       grid: label ?
               [arr.withN(buttons.length, "label"),
                buttons.map(({name}) => name)] :
               [buttons.map(({name}) => name)],
    });
    buttons.forEach((b, i) => {
      l.col(i).paddingLeft = 5;
      l.col(i).width = b.width;
      l.col(i).paddingRight = 5;
    })
    l.row(1).paddingBottom = 5;
  }

  onKeyDown(evt) {
    if (/^[0-9]$/.test(evt.keyCombo)) {
      var n = Number(evt.keyCombo)-1;
      var btn = this.get("button " + n);
      if (btn) {
        btn.trigger()
        return evt.stop();
      }
    }
    return super.onKeyDown(evt);
  }


}

export class TextPrompt extends AbstractPrompt {

  get maxWidth() { return this.env.world.visibleBounds().width - 20; }

  build({label, input, historyId, useLastInput}) {
    this.addMorph({
      fill: null, padding: Rectangle.inset(3), fontSize: 14, fontColor: Color.gray,
      name: "label", type: "label", value: label
    });

    var inputLine = this.addMorph(Text.makeInputLine({
      historyId,
      name: "input", textString: input || "",
      borderWidth: 0, borderRadius: 20, fill: Color.rgbHex("#DDD"),
      fontSize: 14, fontColor: Color.rgbHex("#666"), padding: Rectangle.inset(10,5)
    }));

    if (historyId && useLastInput) {
      var lastInput = arr.last(inputLine.inputHistory.items)
      if (lastInput) inputLine.textString = lastInput;
    }

    inputLine.gotoDocumentEnd();
    inputLine.scrollCursorIntoView();

    var inputWidth = inputLine.textBounds().width;
    // if the input string we pre-fill is wide than we try to make it fit
    if (inputWidth > this.width-25)
      this.width = Math.min(this.maxWidth, inputWidth+25);

    this.addMorph({name: "ok button", type: "button", label: "OK", ...this.okButtonStyle});
    this.addMorph({name: "cancel button", type: "button", label: "Cancel", ...this.cancelButtonStyle});

    connect(this.get("ok button"), 'fire', this, 'resolve');
    connect(this.get("cancel button"), 'fire', this, 'reject');

    this.initLayout();
  }

  resolve() { super.resolve(this.get("input").acceptInput()); }

  initLayout() {
    const label = this.get("label"), input = this.get("input");
    label.fit();
    var goalWidth = Math.max(input.textBounds().width+20, label.width);
    this.width = Math.min(this.maxWidth, goalWidth + 10);

    const l = this.layout = new GridLayout({
      columns: [
        0, {paddingLeft: 2.5},
        1, {fixed: 100},
        2, {paddingRight: 2.5, fixed: 100}
      ],
      rows: [
        2, {paddingTop: 2.5},
        2, {paddingBottom: 2.5}
      ],
      grid: [
        ["label", "label", "label"],
        ["input", "input", "input"],
        [null, "ok button", "cancel button"]
      ]
    });
  }

  focus() { this.get("input").focus(); }
}

export class PasswordPrompt extends AbstractPrompt {

  get maxWidth() { return 800; }

  build({label, placeholder}) {
    this.addMorph({
      fill: null, padding: Rectangle.inset(3), fontSize: 14, fontColor: Color.gray,
      name: "label", type: "label", value: label
    });

    var passwordInput = this.addMorph(new PasswordInputLine({
      name: "input", placeholder: placeholder || "", borderWidth: 0
    }));

    this.addMorph({name: "ok button", type: "button", label: "OK", ...this.okButtonStyle});
    this.addMorph({name: "cancel button", type: "button", label: "Cancel", ...this.cancelButtonStyle});

    connect(this.get("ok button"), 'fire', this, 'resolve');
    connect(this.get("cancel button"), 'fire', this, 'reject');

    this.layout = new GridLayout({
       rows: [
         1, {paddingBottom: 5},
         2, {paddingBottom: 5}
       ],
       columns: [
         0, {paddingLeft: 5, paddingRight: 2.5},
         1, {fixed: 100},
         2, {paddingLeft: 2.5, paddingRight: 5, fixed: 100}
       ],
       grid: [["label", "label", "label"],
              ["input", "input", "input"],
              [null,    "ok button", "cancel button"]]
     });
  }

  resolve() { super.resolve(this.get("input").acceptInput()); }

  focus() { this.get("input").focus(); }
}


export class ListPrompt extends AbstractPrompt {

  constructor(props = {}) {
    super(obj.dissoc(props, ["preselect", "items", "onSelection"]));
    this.get("list").items = props.items || [];
    if (typeof props.preselect === "number") {
      this.get("list").selectedIndex = props.preselect;
      this.get("list").scrollSelectionIntoView();
    }
    if (typeof props.onSelection === "function")
      connect(this.get("list"), "selection", props, "onSelection");
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
         fuzzy, filterFunction, sortFunction
   }) {

    this.extent = extent || pt(500,400);
    labelFontFamily = labelFontFamily || "Helvetica Neue, Arial, sans-serif";
    labelFontSize = labelFontSize || 15;
    listFontFamily = listFontFamily || "Inconsolata, monospace";
    listFontSize = listFontSize || labelFontSize;

    var labelProps = {
      name: "label", type: "label", value: label,
      fill: null, padding: Rectangle.inset(3),
      fontSize: labelFontSize, fontFamily: labelFontFamily, fontColor: Color.gray
    }

    this.addMorph(labelProps);

    var listProps = {
      name: "list", type: filterable ? FilterableList : List,
      multiSelect,
      historyId, useLastInput,
      borderWidth: 0, borderColor: Color.gray,
      fontSize: listFontSize, fontFamily: listFontFamily,
      padding, itemPadding, inputPadding: Rectangle.inset(10,2), theme: "dark"
    }

    if (filterable && fuzzy) listProps.fuzzy = fuzzy;
    if (filterable && typeof filterFunction === "function")
      listProps.filterFunction = filterFunction;
    if (filterable && typeof sortFunction === "function")
      listProps.sortFunction = sortFunction;
    this.addMorph(morph(listProps));

    this.addMorph({
      name: "ok button", type: "button", label: "Select",
      ...this.okButtonStyle
    });
    this.addMorph({
      name: "cancel button", type: "button", label: "Cancel",
      ...this.cancelButtonStyle
    });
    connect(this.get("ok button"), 'fire', this, 'resolve');
    connect(this.get("cancel button"), 'fire', this, 'reject');

    this.layout = new GridLayout({
       rows: [
         0, {fixed: 30},
         1, {paddingBottom: 10},
         2, {fixed: 30, paddingBottom: 5}
       ],
       columns: [
         0, {paddingLeft: 5},
         1, {fixed: 100, paddingRight: 5},
         2, {fixed: 100, paddingRight: 5}
       ],
       grid: [["label", "label", "label"],
              ["list", "list", "list"],
              [null,"ok button", "cancel button"]]
     });
  }

  resolve() {
    var answer = this.get("list") instanceof FilterableList ?
      this.get("list").acceptInput() :
      {selected: this.get("list").selections, status: "accepted"};
    return this.state.answer.resolve(answer);
  }

  reject() {
    return this.state.answer.resolve({
      prompt: this, selected: [],
      filtered: [], status: "canceled"
    });
  }

  focus() { this.get("list").focus(); }

}


export class EditListPrompt extends ListPrompt {

  build(props) {
    super.build(props);

    var addBtn = this.addMorph({
          name: "add item button", ...this.buttonStyle,
          label: Icon.makeLabel("plus", {fontSize: 12})
        }),
        rmBtn = this.addMorph({
          name: "remove item button",
          ...this.buttonStyle,
          label: Icon.makeLabel("minus", {fontSize: 12})
        });

    connect(addBtn, 'fire', this, 'addItemToList');
    connect(rmBtn, 'fire', this, 'removeSelectedItemsFromList');

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
        grid: [["label", "label", "label", "label", "label"],
               ["list", "list", "list", "list", "list"],
               ["add item button", "remove item button", null, "ok button", "cancel button"]]
     });
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

  onKeyDown(evt) {
    switch (evt.keyCombo) {
      case 'Ctrl-G': this.get("list").selection = null; evt.stop(); break;
      case 'Shift-=': case '+': this.addItemToList(); evt.stop(); break;
      case '-': case 'Delete': case 'Backspace': this.removeSelectedItemsFromList(); evt.stop(); break;
    }
    return super.onKeyDown(evt);
  }

  resolve() {
    var {values: list, selections} = this.get("list");
    return this.state.answer.resolve({list, selections});
  }

  reject() { return this.state.answer.resolve({list: [], selections: [], status: "canceled"}); }
}
