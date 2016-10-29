import { show, Morph, morph, Text } from "lively.morphic"
import { obj, arr, fun, promise } from "lively.lang"
import { pt, Rectangle, rect, Color } from "lively.graphics"
import { connect, signal, once } from "lively.bindings"
import { resource } from "lively.resources";

// this.world().openInWindow(new TextEditor).activate()

const editorCommands = [

{
  name: "focus url input",
  exec: fileBrowser => { fileBrowser.get("urlInput").focus(); return true; }
},

{
  name: "focus content text",
  exec: fileBrowser => { fileBrowser.get("contentText").focus(); return true; }
},

{
  name: "load file",
  exec: async fileBrowser => {
    fileBrowser.location = fileBrowser.get("urlInput").input;
    return true;
  }
},

{
  name: "save file",
  exec: async fileBrowser => {
    var f = fileBrowser.state.currentFile
    if (!f) {
      fileBrowser.setStatusMessage("No file selected");
      return true;
    }

    try {
      await f.write(fileBrowser.get("contentText").textString);
      fileBrowser.setStatusMessage(`${f.url} saved`, Color.green);
    } catch (e) {
      fileBrowser.showError(`Error writing ${f.url}: ${e.stack || e}`);
    }

    return true;
  }
},

{
  name: "remove file",
  exec: async fileBrowser => {
    var f = fileBrowser.state.currentFile
    if (!f) {
      fileBrowser.setStatusMessage("No file selected");
      return true;
    }

    try {
      if (await fileBrowser.world().confirm(`Really remove ${f.url}?`)) {
        await f.remove();
        fileBrowser.setStatusMessage(`${f.url} removed!`);
        fileBrowser.reload();
      } else {
        await fileBrowser.world().inform("delete file canceled");
      }
        
    } catch (e) {
      fileBrowser.showError(`Error writing ${f.url}: ${e.stack || e}`);
    }

    return true;
  }
},

];

export default class TextEditor extends Morph {

  static openURL(url) {
    return this.openInWindow({location: url})
  }

  static openInWindow(props) {
    var ed = new this(props);
    return ed.env.world.openInWindow(ed).activate();
  }

  constructor(props = {}) {
    var location = props.location;
    super({
      name: "text editor",
      fill: Color.white,
      border: {width: 1, color: Color.black},
      // clipMode: "auto",
      extent: pt(500,400),
      ...obj.dissoc(props, ["location"])
      });

    this.state = {
      currentFile: null
    }

    this.build();

    if (location) this.location = location;
  }

  build() {
    this.removeAllMorphs()

    this.submorphs = [
      Text.makeInputLine({name: "urlInput", historyId: "lively.morphic-text editor url"}),
      {name: "loadButton", type: "button", label: "reload"},
      {name: "saveButton", type: "button", label: "save"},
      {name: "removeButton", type: "button", label: "remove"},
      {
        name: "contentText", type: "text",
        fontFamily: "Inconsolata, monospace",
        lineWrapping: false,
        padding: Rectangle.inset(4,2), clipMode: "auto"
      }
    ]

    var [input, loadButton, saveButton, removeButton, contentText] = this.submorphs;
    connect(this, 'extent', this, 'relayout');
    connect(input, 'input', this, 'onUrlInputChanged');
    connect(loadButton, 'fire', this, 'execCommand', {converter: () => "load file"});
    connect(saveButton, 'fire', this, 'execCommand', {converter: () => "save file"});
    connect(removeButton, 'fire', this, 'execCommand', {converter: () => "remove file"});

    this.relayout();
  }

  get location() {
    return this.state.currentFile ? this.state.currentFile.url : null;
  }

  set location(val) {
    this.get("urlInput").input = val;
    this.get("urlInput").acceptInput();
  }

  reload() { this.location = this.location; }

  relayout() {
    var urlInput = this.get("urlInput"),
        loadButton = this.get("loadButton"),
        saveButton = this.get("saveButton"),
        removeButton = this.get("removeButton"),
        contentText = this.get("contentText");

    urlInput.width = contentText.width = this.width;
    urlInput.top = 0;
    urlInput.height = 20;
    var oneThird = this.width/3;
    loadButton.extent = saveButton.extent = removeButton.extent = pt(oneThird, 20);
    loadButton.topLeft = urlInput.bottomLeft;
    saveButton.topLeft = loadButton.topRight;
    removeButton.topLeft = saveButton.topRight;
    contentText.topLeft = loadButton.bottomLeft;
    contentText.height = this.height - loadButton.bottom;
  }

  onUrlInputChanged() {
    try {
      var loc = resource(this.get("urlInput").input);
    } catch (e) { this.showError(e); }
    return this.showFileContent(loc);
  }

  async showFileContent(resource) {
    try {
      var contentText = this.get("contentText");
      contentText.textString = await resource.read();
      contentText.gotoDocumentStart();
      contentText.scroll = pt(0.0,0.0);
      var win = this.getWindow();
      if (win) win.title = resource.name();
      this.state.currentFile = resource;
    } catch (e) { this.showError(e); }
  }

  focus() {
    this.get("contentText").focus();
  }

  get commands() {
    return editorCommands.concat(super.commands);
  }

  get keybindings() {
    return [
      {keys: {mac: "Meta-S", win: "Ctrl-S"}, command: "save file"},
      {keys: "Alt-Up", command: "focus url input"},
      {keys: "Alt-Down", command: "focus content text"}
    ].concat(super.keybindings);
  }
}
