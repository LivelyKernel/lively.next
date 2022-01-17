/* global TextDecoder */
import { Morph, Text, config } from 'lively.morphic';
import { num, promise } from 'lively.lang';
import { pt, Color } from 'lively.graphics';
import { connect, signal, once } from 'lively.bindings';
import { resource } from 'lively.resources';
import { guessTextModeName } from './editor-plugin.js';
import { StatusMessageConfirm, StatusMessageWarning } from 'lively.halos/components/messages.cp.js';

// this.world().openInWindow(new TextEditor).activate()

const editorCommands = [

  {
    name: 'focus url input',
    exec: fileBrowser => { fileBrowser.ui.urlInput.focus(); return true; }
  },

  {
    name: 'focus content text',
    exec: fileBrowser => { fileBrowser.ui.contentText.focus(); return true; }
  },

  {
    name: 'load file',
    exec: async fileBrowser => {
      fileBrowser.location = fileBrowser.ui.urlInput.input;
      return true;
    }
  },

  {
    name: 'save file',
    exec: async textEditor => {
      let action = textEditor.customSaveAction || textEditor.defaultSaveAction;
      try {
        let result = await action(textEditor);
        if (result.saved) {
          textEditor.setStatusMessage(result.message || 'saved', StatusMessageConfirm);
          signal(textEditor, 'contentSaved');
        } else textEditor.setStatusMessage(result.message || 'not saved');
      } catch (e) {
        textEditor.showError(`Error saving: ${e.stack || e}`);
      }
      return true;
    }
  },

  {
    name: 'remove file',
    exec: async textEditor => {
      let f = textEditor.locationResource;
      if (!f) {
        textEditor.setStatusMessage('No file selected');
        return true;
      }

      try {
        if (await textEditor.world().confirm(`Really remove ${f.url}?`)) {
          await f.remove();
          textEditor.setStatusMessage(`${f.url} removed!`);
          textEditor.reload();
        } else {
          await textEditor.world().inform('delete file canceled');
        }
      } catch (e) {
        textEditor.showError(`Error writing ${f.url}: ${e.stack || e}`);
      }

      return true;
    }
  }

];

export default class TextEditor extends Morph {
  static openURL (url, props) {
    return this.openInWindow({ location: url, ...props });
  }

  static openAsEDITOR (file, props) {
    // returns "saved" or "aborted"
    let editor = this.openURL(file, props);
    return new Promise((resolve, reject) => {
      once(editor, 'contentSaved', resolve, 'call', {
        updater: function ($upd) { $upd(null, 'saved'); this.sourceObj.close(); }
      });
      once(editor, 'closed', resolve, 'call', { updater: $upd => $upd(null, 'aborted') });
    });
  }

  static openInWindow (props) {
    let ed = new this(props);
    ed.env.world.openInWindow(ed).activate();
    return ed;
  }

  static get properties () {
    return {
      name: { defaultValue: 'text editor' },
      fill: { defaultValue: Color.white },
      border: { defaultValue: { width: 1, color: Color.black } },
      extent: { defaultValue: pt(700, 600) },

      historyId: { defaultValue: 'lively.morphic-text editor url' },

      submorphs: {
        after: ['historyId'],
        initialize (existing) {
          if (existing.length) return;
          this.submorphs = [
            Text.makeInputLine({ name: 'urlInput', historyId: this.historyId }),
            { name: 'loadButton', type: 'button', label: 'reload' },
            { name: 'saveButton', type: 'button', label: 'save' },
            { name: 'removeButton', type: 'button', label: 'remove' },
            {
              ...config.codeEditor.defaultStyle,
              name: 'contentText',
              type: 'text',
              lineWrapping: false
            }
          ];
          let { urlInput, loadButton, saveButton, removeButton } = this.ui;
          connect(this, 'extent', this, 'relayout');
          connect(urlInput, 'inputAccepted', this, 'location');
          connect(loadButton, 'fire', this, 'execCommand', { converter: () => 'load file' });
          connect(saveButton, 'fire', this, 'execCommand', { converter: () => 'save file' });
          connect(removeButton, 'fire', this, 'execCommand', { converter: () => 'remove file' });
        }
      },

      ui: {
        readOnly: true,
        derived: true,
        after: ['submorphs'],
        get () {
          let [urlInput, loadButton, saveButton, removeButton, contentText] = this.submorphs;
          return { urlInput, loadButton, saveButton, removeButton, contentText };
        }
      },

      location: {
        derived: true,
        after: ['submorphs'],

        get () { return this.ui.urlInput.input; },

        set (val) {
          let { url, lineNumber } = this.parseFileNameInput(val);
          let { contentText, urlInput } = this.ui;
          urlInput.input = val || '';
          urlInput.acceptInput();
          if (urlInput.isFocused()) contentText.focus();
          this.showFileContent(url);
          if (typeof lineNumber !== 'undefined') this.lineNumber = lineNumber;
        }
      },

      locationResource: {
        derived: true,
        after: ['location'],
        get () {
          let { url } = this.parseFileNameInput(this.location);
          return resource(url);
        },
        set (resource) { this.location = resource.url; }
      },

      lineNumber: {
        derived: true,
        after: ['location'],
        get () { return this.ui.contentText.cursorPosition.row; },
        set (val) {
          let row = Number(val);
          if (isNaN(row)) return;
          this.whenLoaded().then(() => {
            let ed = this.ui.contentText;
            ed.cursorPosition = { row, column: 0 };
            ed.centerRow(row);
          });
        }
      },

      customSaveAction: {
        // fn that gets text editor and returns {saved: BOOLEAN, message: STRING}
      },

      customLoadContentAction: {
        // fn that gets text editor and url returns content string
      }
    };
  }

  constructor (props) {
    super(props);
    this.relayout();
    this._loadPromise = null;
  }

  get isTextEditor () { return true; }

  reload () { this.location = this.location; }

  relayout () {
    let { urlInput, loadButton, saveButton, removeButton, contentText } = this.ui;

    urlInput.width = contentText.width = this.width;
    urlInput.top = 0;
    urlInput.height = 20;
    let oneThird = this.width / 3;
    loadButton.extent = saveButton.extent = removeButton.extent = pt(oneThird, 20);
    loadButton.topLeft = urlInput.bottomLeft;
    saveButton.topLeft = loadButton.topRight;
    removeButton.topLeft = saveButton.topRight;
    contentText.topLeft = loadButton.bottomLeft;
    contentText.height = this.height - loadButton.bottom;
  }

  async whenLoaded () {
    return this._loadPromise || Promise.resolve(this);
  }

  parseFileNameInput (input) {
    let url = input;
    let lineNumber;
    let colonIndex = input.lastIndexOf(':');

    if (colonIndex > -1 && input.slice(colonIndex + 1).match(/^[0-9]+$/)) {
      lineNumber = Number(input.slice(colonIndex + 1));
      url = input.slice(0, colonIndex);
    }

    return { lineNumber, url };
  }

  async showFileContent (url) {
    let deferred = promise.deferred();
    this._loadPromise = deferred.promise;
    try {
      let res, content;
      if (this.customLoadContentAction) {
        content = await this.customLoadContentAction(this, url);
      } else {
        res = resource(url);
        content = await res.read();
        if (content.constructor === ArrayBuffer) {
          content = new TextDecoder().decode(content);
        }
      }
      if (!content) content = '';
      await this.prepareEditorForFile(url, content);
      let win = this.getWindow();
      if (win) win.title = res ? res.name() : url;
      deferred.resolve(this);
    } catch (err) { this.showError(err); deferred.reject(err); }
    return this._loadPromise;
  }

  async prepareEditorForFile (url, content = '') {
    // FIXME
    if (typeof content === 'object') ({ content, url } = content);

    let ed = this.ui.contentText; let mode; let setupFn;

    if (content.length > 2 ** 19/* 0.5MB */) {
      this.setStatusMessage(`File content very big, ${num.humanReadableByteSize(content.length)}. Styling is disabled`, StatusMessageWarning);
    } else {
      mode = guessTextModeName(content, url);
    }

    try {
      let plugin = await ed.changeEditorMode(mode);
      if (setupFn) setupFn(ed, plugin);
    } catch (err) {
      console.warn(`Failed to set mode ${mode}: ${err}`);
      ed.changeEditorMode(null);
    }

    ed.textString = content;
    ed.gotoDocumentStart();
    ed.scroll = pt(0, 0);
  }

  async defaultSaveAction (textEditor) {
    let f = textEditor.locationResource;
    if (f) {
      await f.write(textEditor.ui.contentText.textString);
      return { saved: true };
    }
    return { saved: false, message: 'No file selected' };
  }

  focus () {
    this.ui.contentText.focus();
  }

  close () {
    let win = this.getWindow();
    win ? win.close() : this.remove();
  }

  onWindowClose () {
    signal(this, 'closed');
  }

  get commands () {
    return editorCommands.concat(super.commands);
  }

  get keybindings () {
    return [
      { keys: { mac: 'Meta-S', win: 'Ctrl-S' }, command: 'save file' },
      { keys: 'Alt-Up', command: 'focus url input' },
      { keys: 'Alt-Down', command: 'focus content text' }
    ].concat(super.keybindings);
  }
}
