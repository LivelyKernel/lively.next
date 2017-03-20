import { show, Morph, morph, Text, config } from "lively.morphic"
import { obj, arr, num, fun, promise } from "lively.lang"
import { pt, Rectangle, rect, Color } from "lively.graphics"
import { connect, signal, once } from "lively.bindings"
import { resource } from "lively.resources";

// this.world().openInWindow(new TextEditor).activate()

const editorCommands = [

  {
    name: "focus url input",
    exec: fileBrowser => { fileBrowser.ui.urlInput.focus(); return true; }
  },

  {
    name: "focus content text",
    exec: fileBrowser => { fileBrowser.ui.contentText.focus(); return true; }
  },

  {
    name: "load file",
    exec: async fileBrowser => {
      fileBrowser.location = fileBrowser.ui.urlInput.input;
      return true;
    }
  },

  {
    name: "save file",
    exec: async textEditor => {
      let f = textEditor.locationResource;
      if (!f) {
        textEditor.setStatusMessage("No file selected");
        return true;
      }

      try {
        await f.write(textEditor.ui.contentText.textString);
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
    exec: async textEditor => {
      let f = textEditor.location
      if (!f) {
        textEditor.setStatusMessage("No file selected");
        return true;
      }

      try {
        if (await textEditor.world().confirm(`Really remove ${f.url}?`)) {
          await f.remove();
          textEditor.setStatusMessage(`${f.url} removed!`);
          textEditor.reload();
        } else {
          await textEditor.world().inform("delete file canceled");
        }

      } catch (e) {
        textEditor.showError(`Error writing ${f.url}: ${e.stack || e}`);
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

  static get properties() {
    return {
      name: {defaultValue: "text editor"},
      fill: {defaultValue: Color.white},
      border: {defaultValue: {width: 1, color: Color.black}},
      extent: {defaultValue: pt(700,600)},

      submorphs: {
        initialize() {
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
          var {urlInput, loadButton, saveButton, removeButton, contentText} = this.ui;
          connect(this, 'extent', this, 'relayout');
          connect(urlInput, 'inputAccepted', this, 'location');
          connect(loadButton, 'fire', this, 'execCommand', {converter: () => "load file"});
          connect(saveButton, 'fire', this, 'execCommand', {converter: () => "save file"});
          connect(removeButton, 'fire', this, 'execCommand', {converter: () => "remove file"});
          connect(contentText, 'doSave', this, 'execCommand', {converter: () => "save file"});
        }
      },

      ui: {
        readOnly: true, derived: true, after: ["submorphs"],
        get() {
          var [urlInput, loadButton, saveButton, removeButton, contentText] = this.submorphs;
          return {urlInput, loadButton, saveButton, removeButton, contentText};
        }
      },

      location: {
        derived: true, after: ["submorphs"],

        get() { return this.ui.urlInput.input; },

        set(val) {
          let {url, lineNumber} = this.parseFileNameInput(val),
              {contentText, urlInput} = this.ui;
          urlInput.input = val || "";
          urlInput.acceptInput();
          if (urlInput.isFocused()) contentText.focus();
          this.showFileContent(resource(url));
          if (typeof lineNumber !== "undefined") this.lineNumber = lineNumber;
        }
      },

      locationResource: {
        derived: true, after: ["location"],
        get() {
          let {url} = this.parseFileNameInput(this.location);
          return resource(url);
        },
        set(resource) { this.location = resource.url; }
      },

      lineNumber: {
        derived: true, after: ["location"],
        get() { return this.ui.contentText.cursorPosition.row; },
        set(val) {
          var row = Number(val);
          if (isNaN(row)) return;
          this.whenLoaded().then(() => {
            var ed = this.ui.contentText;
            ed.cursorPosition = {row, column: 0};
            ed.centerRow(row);
          })
        }
      }
    }
  }

  constructor(props) {
    super(props);
    this.relayout();
    this._loadPromise = null;
  }

  reload() { this.location = this.location; }

  relayout() {
    var {urlInput, loadButton, saveButton, removeButton, contentText} = this.ui;

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
    return this._loadPromise || Promise.resolve(this);
  }

  parseFileNameInput(input) {
    let url = input,
        lineNumber = undefined,
        colonIndex = input.lastIndexOf(":");

    if (colonIndex > -1 && input.slice(colonIndex+1).match(/^[0-9]+$/)) {
      lineNumber = Number(input.slice(colonIndex+1));
      url = input.slice(0, colonIndex);
    }

    return {lineNumber, url}
  }

  async showFileContent(resource) {
    var deferred = promise.deferred();
    this._loadPromise = deferred.promise;
    try {
      var content = await resource.read();
      await this.prepareEditorForFile(resource, content);
      var win = this.getWindow();
      if (win) win.title = resource.name();
      deferred.resolve(this);
    } catch (e) { this.showError(e); deferred.reject(e); }
    return this._loadPromise;
  }

  async prepareEditorForFile(resource, content = "") {
    var ed = this.ui.contentText;

    var {_editorPlugin: editorPlugin} = this;
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
          var { JavaScriptEditorPlugin } = await System.import("lively.morphic/ide/js/editor-plugin.js");
          editorPlugin = new JavaScriptEditorPlugin(config.codeEditor.defaultTheme);
          editorPlugin.evalEnvironment = {
            get targetModule() { return url; },
            context: ed,
            get format() { return lively.modules.module(this.targetModule).format() || "global"; }
          }
          break;

        case 'json':
          var { JSONEditorPlugin } = await System.import("lively.morphic/ide/json/editor-plugin.js");
          editorPlugin = new JSONEditorPlugin(config.codeEditor.defaultTheme);
          break;

        case 'md':
          var { MarkdownEditorPlugin } = await System.import("lively.morphic/ide/md/editor-plugin.js");
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
    this._editorPlugin = editorPlugin;

    ed.textString = content
    ed.gotoDocumentStart();
    ed.scroll = pt(0,0);
  }

  focus() {
    this.ui.contentText.focus();
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
