/* global System,DOMParser */
import { promise } from 'lively.lang';
import { Color } from 'lively.graphics';
import { config, Text } from 'lively.morphic';
import EvalBackendChooser from '../js/eval-backend-ui.js';
import HTMLEditorPlugin from './editor-plugin.js';
import JSWorkspace from '../js/workspace.js';
import { StatusMessageConfirm } from 'lively.halos/components/messages.cp.js';

// new Workspace().activate()

export default class Workspace extends JSWorkspace {
  static get properties () {
    return {

      title: {
        initialize (val) { this.title = val || 'HTML Workspace'; }
      },

      targetMorph: {
        initialize () {
          this.targetMorph = new Text({
            name: 'editor',
            lineHeight: 1.4,
            readOnly: false,
            textString: '<h1>test</h1>',
            editorModeName: 'html',
            lineWrapping: 'by-chars',
            ...config.codeEditor.defaultStyle,
            plugins: [new HTMLEditorPlugin()]
          });
        }
      },

      target: {},

      htmlPlugin: {
        derived: true,
        readOnly: true,
        get () { return this.targetMorph.editorPlugin; }
      },

      jsPlugin: {
        derived: true,
        readOnly: true,
        get () { return this.htmlPlugin; },
        initialize () { /* overwrite */ }
      },

      evalbackendButton: {
        derived: true,
        readOnly: true,
        after: ['targetMorph'],
        get () { this.getSubmorphNamed('eval backend button'); },
        initialize () {
          this.addMorph(EvalBackendChooser.default.ensureEvalBackendDropdown(this, 'local'));
        }
      }
    };
  }

  get isHTMLWorkspace () { return true; }

  parse (html) {
    return new DOMParser().parseFromString(html, 'text/html');
  }

  async loadDocumentHTML () {
    let html = await this.runEval('document.documentElement.innerHTML');
    this.targetMorph.textString = html;
  }

  livelyfyHTML (html) {
    // injects lively script
    let scripts = Array.from(this.parse(html).querySelectorAll('script'));
    if (!scripts.some(ea => ea.src.includes('livelify-web.js'))) {
      let script = '<script src="/livelify-web.js"></script>';
      let bodyEnd = html.indexOf('</body>');
      if (bodyEnd > -1) {
        html = html.slice(0, bodyEnd) + script + html.slice(bodyEnd);
      } else { html += script; }
    }
    return html;
  }

  async saveDocumentHTML (html) {
    if (this.htmlPlugin.systemInterface().name !== 'local') { await this.runEval(`document.documentElement.innerHTML = ${JSON.stringify(html)}`); }
  }

  async runEval (source) {
    let result = await this.htmlPlugin.runEval(source, {
      targetModule: 'lively://lively.next-html-workspace/' + this.id,
      format: 'esm'
    });
    if (result.isError || result.error) {
      throw new Error(result.value || result.isError || result.error);
    }
    return result.value;
  }

  get commands () {
    return [
      ...super.commands.filter(ea => ea.name !== '[workspace] save content'),
      {
        name: '[workspace] save content',
        async exec (workspace) {
          let html = workspace.content;

          if (workspace.target) {
            if (workspace.target.isIFrameMorph) {
              workspace.targetMorph.execCommand('[HTML] render in iframe', { iframe: workspace.target.isIFrameMorph });
            } else if (workspace.target.isHTMLMorph) {
              workspace.target.html = html;
            }
          }

          html = workspace.livelyfyHTML(html);
          if (workspace.file) {
            try {
              await workspace.file.write(html);
            } catch (e) { workspace.showError(e); throw e; }
            workspace.setStatusMessage(
              `Saved to ${workspace.file.url}`, StatusMessageConfirm);
            await promise.delay(500);
          }

          try {
            await workspace.saveDocumentHTML(html);
            workspace.setStatusMessage('HTML applied', StatusMessageConfirm);
          } catch (err) { workspace.showError(err); }
          return workspace;
        }
      }
    ];
  }
}
