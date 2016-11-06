/*global System*/
import { Rectangle, Color, pt, rect } from "lively.graphics";
import { arr, obj, promise } from "lively.lang";
import { List, FilterableList } from "./list.js"
import { Morph, Text, Label, GridLayout } from "./index.js";
import { connect, disconnectAll } from "lively.bindings";


export class AbstractPrompt extends Morph {

  constructor(props = {}) {
    super({
      fill: Color.black.withA(0.6), extent: pt(300,80), borderRadius: 5,
      dropShadow: true,
      ...obj.dissoc(props, ["label", "autoRemove"])});

    this.build(props);
    this.label = props.label || "no label";
    this.state = {
      answer: null,
      autoRemove: props.hasOwnProperty("autoRemove") ? props.autoRemove : true
    };
  }

  get isEpiMorph() { return true }

  get label() { return this.get("label").textString; }
  set label(label) {
    this.get("label").textString = label;
  }

  resolve(arg) { this.state.answer.resolve(arg); }
  reject(reason) { this.state.answer.resolve(undefined); }

  async activate() {
    this.focus();
    this.state.answer = promise.deferred();
    if (this.state.autoRemove)
      promise.finally(this.state.answer.promise, () => this.fadeOut(500));
    return this.state.answer.promise;
  }

  build() { throw new Error("Not yet implemented"); }
  applyLayout() { throw new Error("Not yet implemented"); }

  onKeyDown(evt) {
    switch (evt.keyCombo) {
      case 'Enter': this.resolve(); evt.stop(); break;
      case 'Escape': this.reject(); evt.stop(); break;
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

export class InformPrompt extends AbstractPrompt {

  build(props) {
    this.get("label") || this.addMorph({
        fontSize: 16, padding: Rectangle.inset(5), fontColor: Color.gray,
        fontSize: 14, fill: null, ...props,  name: "label", type: "text", textString: props.label, readOnly: true});
    this.get("ok button") || this.addMorph({name: "ok button", type: "button", label: "OK", ...this.okButtonStyle});
    connect(this.get("ok button"), 'fire', this, 'resolve');
    this.initLayout();
  }

  initLayout() {
     this.get("label").fit()
     this.width = this.get("label").width + 10;
     this.layout = new GridLayout({
        grid: [["label", "label", "label"],
               [null, "ok button", null]]
     });
     this.layout.col(2).paddingRight = 5;
     this.layout.col(1).fixed = 100;
     this.layout.col(0).paddingLeft = 5;
     this.layout.row(1).paddingBottom = 5;
     this.layout.row(1).fixed = 30;
  }

  onKeyDown(evt) {
    switch (evt.keyCombo) {
      case 'Escape': case 'Enter': this.resolve(); evt.stop(); break;
    }
  }

}


export class ConfirmPrompt extends AbstractPrompt {

  build(props) {
    this.get("label") || this.addMorph({fill: null, padding: Rectangle.inset(3), fontSize: 14, name: "label", type: "text", textString: props.label, readOnly: true, fontColor: Color.gray});
    this.get("ok button") || this.addMorph({
       name: "ok button", type: "button",
       label: "OK", ...this.okButtonStyle});
    this.get("cancel button") || this.addMorph({
        name: "cancel button", type: "button",
        label: "Cancel", ...this.cancelButtonStyle});
    connect(this.get("ok button"), 'fire', this, 'resolve');
    connect(this.get("cancel button"), 'fire', this, 'reject');
    this.initLayout();
  }

  resolve() { super.resolve(true); }
  reject() { super.resolve(false); }

  initLayout() {
     // fixme: layout should be able to let one morph
     //         define the overall width of the container
     this.get("label").fit()
     this.width = this.get("label").width + 10;
     this.layout = new GridLayout({
        grid: [["label", "label"],
               ["ok button", "cancel button"]]
     });
     this.layout.col(0).paddingLeft = 5;
     this.layout.col(0).paddingRight = 2.5;
     this.layout.col(0).adjustMin(100);
     this.layout.col(1).paddingRight = 5;
     this.layout.col(1).paddingLeft = 2.5;
     this.layout.col(1).adjustMin(100);
     this.layout.row(1).paddingBottom = 5;
     this.layout.row(1).fixed = 30;
  }
}

export class TextPrompt extends AbstractPrompt {

  build({input, historyId}) {
    this.get("label") || this.addMorph({
        fill: null, padding: Rectangle.inset(3), fontSize: 14, fontColor: Color.gray,
        name: "label", type: "text", textString: "", readOnly: true});

    this.get("input") || this.addMorph(Text.makeInputLine({
          historyId,
          name: "input", textString: input || "",
          borderWidth: 0, borderRadius: 20, fill: Color.gray.withA(0.8),
          fontColor: Color.gray.darker(), padding: rect(10,2,0,-2)
    }));

    this.get("ok button") || this.addMorph({name: "ok button", type: "button", label: "OK", ...this.okButtonStyle});
    this.get("cancel button") || this.addMorph({name: "cancel button", type: "button", label: "Cancel", ...this.cancelButtonStyle});
    connect(this.get("ok button"), 'fire', this, 'resolve');
    connect(this.get("cancel button"), 'fire', this, 'reject');
    this.get("input").gotoDocumentEnd();
    this.initLayout();
  }

  resolve() { super.resolve(this.get("input").acceptInput()); }

  initLayout() {
     this.layout = new GridLayout({
        grid: [["label", "label"],
               ["input", "input"],
               ["ok button", "cancel button"]]
     });
     this.layout.col(1).paddingRight = 5;
     this.layout.col(1).paddingLeft = 2.5;
     this.layout.col(0).paddingLeft = 5;
     this.layout.col(0).paddingRight = 2.5;
     this.layout.row(1).paddingBottom = 5;
     this.layout.row(2).paddingBottom = 5;
  }

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

  build({listFontSize,
         listFontFamily,
         labelFontSize,
         labelFontFamily,
         filterable,
         padding,
         itemPadding,
         extent,
         multiSelect,
         historyId}) {
    this.extent = extent || pt(500,400);
    var ListClass = filterable ? FilterableList : List;
    labelFontFamily = labelFontFamily || "Helvetica Neue, Arial, sans-serif";
    labelFontSize = labelFontSize || 15;
    listFontFamily = listFontFamily || "Inconsolata, monospace";
    listFontSize = listFontSize || labelFontSize;
    this.get("label") || this.addMorph({fill: null, padding: Rectangle.inset(3), name: "label", type: "text", textString: " ", readOnly: true, selectable: false, fontSize: labelFontSize, fontFamily: labelFontFamily, fontColor: Color.gray});
    this.get("list") || this.addMorph(new ListClass({historyId, borderWidth: 0, borderColor: Color.gray, name: "list", fontSize: listFontSize, fontFamily: listFontFamily, padding, itemPadding, multiSelect, theme: "dark"}));
    this.get("ok button") || this.addMorph({name: "ok button", type: "button", label: "Select", ...this.okButtonStyle});
    this.get("cancel button") || this.addMorph({name: "cancel button", type: "button", label: "Cancel", ...this.cancelButtonStyle});
    connect(this.get("ok button"), 'fire', this, 'resolve');
    connect(this.get("cancel button"), 'fire', this, 'reject');
    this.initLayout();
  }

  initLayout() {
     var l = this.layout = new GridLayout({
        grid: [["label", "label", "label"],
               ["list", "list", "list"],
               [null,"ok button", "cancel button"]]
     });

     l.row(0).fixed = 30;
     l.row(2).fixed = 30;
     l.row(2).paddingBottom = 5;
     l.col(0).paddingLeft = 5;
     l.col(1).fixed = 100;
     l.col(1).paddingRight = 5;
     l.row(1).paddingBottom = 10;
     l.col(2).fixed = 100;
     l.col(2).paddingRight = 5;
  }

  resolve() {
    var answer = this.get("list") instanceof FilterableList ?
      this.get("list").acceptInput() :
      {selected: this.get("list").selections, status: "accepted"};
    return this.state.answer.resolve(answer);
  }

  reject() { return this.state.answer.resolve({prompt: this, selected: [], filtered: [], status: "canceled"}); }

  focus() { this.get("list").focus(); }
}


export class EditListPrompt extends ListPrompt {

  build(props) {
    super.build(props);

    var addBtn = this.addMorph({
          name: "add item button", ...this.buttonStyle,
          label: Label.icon("plus", {fontSize: 12})
        }),
        rmBtn = this.addMorph({
          name: "remove item button",
          ...this.buttonStyle,
          label: Label.icon("minus", {fontSize: 12})
        });

    connect(addBtn, 'fire', this, 'addItemToList');
    connect(rmBtn, 'fire', this, 'removeSelectedItemsFromList');
  }

  initLayout() {
     var l = this.layout = new GridLayout({
        autoAssign: false,
        grid: [["label", "label", "label", "label", "label"],
               ["list", "list", "list", "list", "list"],
               ["add item button", "remove item button", null, "ok button", "cancel button"]]
     });

     l.row(0).fixed = 30;
     l.row(1).fixed = undefined
     l.row(2).fixed = 30;
     l.row(0).paddingTop = 5;
     l.row(0).paddingBottom = 5;
     l.row(1).paddingBottom = 2;
     l.row(2).paddingBottom = 5;
     l.col(0).paddingLeft = 5;
     l.col(0).paddingRight = 5;
     l.col(3).paddingRight = 5;
     l.col(4).paddingRight = 5;
     l.apply()
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
    var toAdd = await this.world().prompt(
      "Input to add to the list", {historyId: "EditListPrompt-input-history"});
    if (!toAdd) return;
    var list = this.get("list"),
        insertAt = list.selection ? list.selectedIndex+1 : list.items.length;
    list.addItemAt(toAdd, insertAt);
    list.focus();
  }

  onKeyDown(evt) {
    switch (evt.keyCombo) {
      case 'Ctrl-G': this.get("list").selection = null; evt.stop(); break;
      case 'Shift-=': case '+': this.addItemToList(); evt.stop(); break;
      case 'Delete': case 'Backspace': this.removeSelectedItemsFromList(); evt.stop(); break;
    }
    return super.onKeyDown(evt);
  }

  resolve() {
    return this.state.answer.resolve(this.get("list").values);
  }

  reject() { return this.state.answer.resolve(null); }
}
