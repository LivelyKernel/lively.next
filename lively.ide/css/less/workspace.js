import CSSWorkspace from '../workspace.js';
import { Text, config } from 'lively.morphic';
import LESSEditorPlugin from './editor-plugin.js';
import { Color } from "lively.graphics/index.js";

export default class LESSWorkspace extends CSSWorkspace {
  static get properties () {
    return {
      targetMorph: {
        initialize () {
          this.targetMorph = new Text({
            name: 'editor',
            lineHeight: 1.4,
            readOnly: false,
            textString: '',
            editorModeName: 'less',
            lineWrapping: 'by-chars',
            ...config.codeEditor.defaultStyle,
            plugins: [new LESSEditorPlugin()]
          });
        }
      }
    };
  }

  get commands () {
    return [
      ...super.commands.filter(ea => ea.name !== '[workspace] save content'),
      {
        name: '[workspace] save content',
        async exec (workspace) {
          let less = workspace.content;

          if (workspace.target) {
            if (workspace.target.isHTMLMorph) {
              workspace.target.lessDeclaration = less;
              workspace.setStatusMessage('LESS applied', StatusMessageConfirm);
            }
          }
        }
      }
    ];
  }
}

