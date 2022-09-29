import { pt } from 'lively.graphics';
import { config, morph } from 'lively.morphic';
import { Window } from 'lively.components';

import SQLEditorPlugin from './editor-plugin.js';

export default class Workspace extends Window {
  static get properties () {
    return {

      title: { defaultValue: 'SQL Workspace' },
      name: { defaultValue: 'sql-workspace' },

      targetMorph: {
        initialize () {
          this.targetMorph = morph({
            type: 'text',
            name: 'editor',
            lineHeight: 1.4,
            readOnly: false,
            lineWrapping: false,
            textString: 'SELECT * FROM table;\n\n',
            ...config.codeEditor.defaultStyle
          });
        }
      },

      content: {
        derived: true,
        after: ['targetMorph'],
        get () { return this.targetMorph.textString; },
        set (content) { return this.targetMorph.textString = content; }
      },

      extent: { defaultValue: pt(400, 300) },

      mdPlugin: {
        derived: true,
        readOnly: true,
        after: ['targetMorph'],
        initialize () { this.targetMorph.addPlugin(new SQLEditorPlugin()); },
        get () {
          return this.targetMorph.pluginFind(p => p.isMarkdownEditorPlugin) ||
              this.targetMorph.addPlugin(new SQLEditorPlugin());
        }
      }
    };
  }

  get keybindings () { return []; }
  get commands () { return []; }
}
