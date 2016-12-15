import { show, Morph, morph, Text, config } from "lively.morphic"
import { obj, arr, num, fun, promise } from "lively.lang"
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
  exec: async textEditor => {
    var f = textEditor.state.currentFile
    if (!f) {
      textEditor.setStatusMessage("No file selected");
      return true;
    }

    try {
      await f.write(textEditor.get("contentText").textString);
      textEditor.setStatusMessage(`${f.url} saved`, Color.green);
      signal(textEditor, "contentSaved");
    } catch (e) {
      textEditor.showError(`Error writing ${f.url}: ${e.stack || e}`);
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

  static openURL(url, props) {
    return this.openInWindow({location: url, ...props})
  }

  static openAsEDITOR(file, props) {
    // returns "saved" or "aborted"
    var editor = this.openURL(file, props);
    return new Promise((resolve, reject) => {
      once(editor, 'contentSaved', resolve, 'call', {
        updater: function($upd) { $upd(null, "saved"); this.sourceObj.close(); }
      });
      once(editor, 'closed', resolve, 'call', {updater: $upd => $upd(null, "aborted")});
    })
  }

  static openInWindow(props) {
    var ed = new this(props);
    ed.env.world.openInWindow(ed).activate();
    return ed;
  }

  constructor(props = {}) {
    var location = props.location;
    super({
      name: "text editor",
      fill: Color.white,
      border: {width: 1, color: Color.black},
      // clipMode: "auto",
      extent: pt(700,600),
      ...obj.dissoc(props, ["location"])
      });

    this.state = {
      currentFile: null,
      loadPromise: null
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
        ...config.codeEditor.defaultStyle,
        name: "contentText", type: "text",
        lineWrapping: false
      }
    ]

    var [input, loadButton, saveButton, removeButton, contentText] = this.submorphs;
    connect(this, 'extent', this, 'relayout');
    connect(input, 'input', this, 'location');
    connect(loadButton, 'fire', this, 'execCommand', {converter: () => "load file"});
    connect(saveButton, 'fire', this, 'execCommand', {converter: () => "save file"});
    connect(removeButton, 'fire', this, 'execCommand', {converter: () => "remove file"});

    this.relayout();
  }

  get location() {
    return this.state.currentFile ? this.state.currentFile.url : null;
  }

  set location(val) {
    var url = val,
        lineNumber = null,
        colonIndex = val.lastIndexOf(":");

    if (colonIndex > -1 && val.slice(colonIndex+1).match(/^[0-9]+$/)) {
      lineNumber = Number(val.slice(colonIndex+1));
      url = val.slice(0, colonIndex);
    }

    this.get("urlInput").input = val || "";
    this.get("urlInput").acceptInput();
    if (this.get("urlInput").isFocused())
      this.get("contentText").focus();
    this.showFileContent(resource(url));
    if (lineNumber) this.lineNumber = lineNumber;
  }

  get lineNumber() {
    return this.getSubmorphNamed("contentText").cursorPosition.row;
  }

  set lineNumber(val) {
    var row = Number(val);
    if (isNaN(row)) return;
    this.whenLoaded().then(() => {

      var ed = this.getSubmorphNamed("contentText");
      ed.cursorPosition = {row, column: 0};
      ed.centerRow(row);
    })
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

  async whenLoaded() {
    if (!this.state) await promise.waitFor(1000, () => this.state);
    return this.state.loadPromise || Promise.resolve(this);
  }

  async showFileContent(resource) {
    var deferred = promise.deferred();
    this.state.loadPromise = deferred.promise;
    try {
      this.state.currentFile = resource;
      var content = await resource.read();
      await this.prepareEditorForFile(resource, content);
      var win = this.getWindow();
      if (win) win.title = resource.name();
      deferred.resolve(this);
    } catch (e) { this.showError(e); deferred.reject(e); }
    return this.state.loadPromise;
  }

  async prepareEditorForFile(resource, content = "") {
    var ed = this.get("contentText");

    var {editorPlugin} = this.state;
    if (editorPlugin) ed.removePlugin(editorPlugin);
    editorPlugin = null;

    var url = (resource || {}).url,
        fileType = "plain text";

    if (content.length > 2**20/*1MB*/) {
      this.setStatusMessage(`File content very big, ${num.humanReadableByteSize(content.length)}. Styling is disabled`);

    } else if (url) {

      var [_, ext] = url.match(/\.([^\.\s]+)$/) || [];

      // FIXME
      switch (ext) {

        case 'js':
          var { JavaScriptEditorPlugin } = await System.import("lively.morphic/ide/js/editor-plugin.js")
          editorPlugin = new JavaScriptEditorPlugin(config.codeEditor.defaultTheme);
          editorPlugin.evalEnvironment = {
            get targetModule() { return url; },
            context: ed,
            get format() { return lively.modules.module(this.targetModule).format() || "global"; }
          }
          break;

        case 'json':
          var { JSONEditorPlugin } = await System.import("lively.morphic/ide/json/editor-plugin.js")
          editorPlugin = new JSONEditorPlugin(config.codeEditor.defaultTheme);
          break;

        case 'md':
          var { MarkdownEditorPlugin } = await System.import("lively.morphic/ide/md/editor-plugin.js")
          editorPlugin = new MarkdownEditorPlugin(config.codeEditor.defaultTheme);
          break;

        case 'sh':
          var { ShellEditorPlugin } = await System.import("lively.morphic/ide/shell/editor-plugin.js");
          editorPlugin = new ShellEditorPlugin(config.codeEditor.defaultTheme);
          break;

        default:
          fileType = "plain text";
      }
    }

    if (editorPlugin) ed.addPlugin(editorPlugin);
    this.state.editorPlugin = editorPlugin;

    ed.textString = content
    ed.gotoDocumentStart();
    ed.scroll = pt(0,0);
  }

  focus() {
    this.get("contentText").focus();
  }

  close() {
    var win = this.getWindow();
    win ? win.close() : this.remove();
  }

  onWindowClose() {
    signal(this, "closed");
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
