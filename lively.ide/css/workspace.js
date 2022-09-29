/* global System,DOMParser */
import { promise } from 'lively.lang';
import { Color, pt } from 'lively.graphics';
import { config, Text } from 'lively.morphic';
import EvalBackendChooser from '../js/eval-backend-ui.js';
import CSSEditorPlugin from './editor-plugin.js';
import { Window } from 'lively.components';
import { StatusMessageConfirm } from 'lively.halos/components/messages.cp.js';

// new Workspace({ target: this.get('spreadsheet morph')}).activate().openInWorld()

export default class Workspace extends Window {
  static get properties () {
    return {

      title: {
        initialize (val) { this.title = val || 'CSS Workspace'; }
      },

      extent: {
        defaultValue: pt(400, 300)
      },

      targetMorph: {
        initialize () {
          this.targetMorph = new Text({
            name: 'editor',
            lineHeight: 1.4,
            readOnly: false,
            textString: '',
            editorModeName: 'css',
            lineWrapping: 'by-chars',
            ...config.codeEditor.defaultStyle,
            plugins: [new CSSEditorPlugin()]
          });
        }
      },

      content: {
        derived: true,
        after: ['targetMorph'],
        get () { return this.targetMorph.textString; },
        set (val) { if (val) this.targetMorph.textString = val; }
      },

      target: {},

      cssPlugin: {
        derived: true,
        readOnly: true,
        get () { return this.targetMorph.editorPlugin; }
      }
    };
  }

  get isCSSWorkspace () { return true; }

  get keybindings () {
    return super.keybindings.concat([
      { keys: { mac: 'Command-S', win: 'Ctrl-S' }, command: '[workspace] save content' }
    ]);
  }

  get commands () {
    return [
      ...super.commands.filter(ea => ea.name !== '[workspace] save content'),
      {
        name: '[workspace] save content',
        async exec (workspace) {
          let css = workspace.content;

          if (workspace.target) {
            if (workspace.target.isHTMLMorph) {
              workspace.target.cssDeclaration = css;
              workspace.setStatusMessage('CSS applied', StatusMessageConfirm);
            }
          }

          // html = workspace.livelyfyHTML(html);
          // if (workspace.file) {
          //   try {
          //     await workspace.file.write(html);
          //   } catch (e) { workspace.showError(e); throw e; }
          //   workspace.setStatusMessage(
          //     `Saved to ${workspace.file.url}`, Color.green);
          //   await promise.delay(500);
          // }
          //
          // try {
          //   await workspace.saveDocumentHTML(html);
          //   workspace.setStatusMessage("HTML applied", Color.green);
          // } catch (err) { workspace.showError(err); }
          // return workspace;
        }
      }
    ];
  }
}
