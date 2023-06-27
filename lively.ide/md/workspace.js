import { pt } from 'lively.graphics';
import { config, morph } from 'lively.morphic';
import { Window } from 'lively.components';

import MarkdownEditorPlugin from './editor-plugin.js';

export default class Workspace extends Window {
  static get properties () {
    return {

      title: { defaultValue: 'Markdown Workspace' },
      name: { defaultValue: 'md-workspace' },

      targetMorph: {
        initialize () {
          this.targetMorph = morph({
            type: 'text',
            name: 'editor',
            readOnly: false,
            lineWrapping: 'no-wrap',
            textString: '# Markdown code\n\n',
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
        initialize () { this.targetMorph.addPlugin(new MarkdownEditorPlugin()); },
        get () {
          return this.targetMorph.pluginFind(p => p.isMarkdownEditorPlugin) ||
              this.targetMorph.addPlugin(new MarkdownEditorPlugin());
        }
      }
    };
  }

  get keybindings () {
    return [];
  }

  get commands () {
    return [];
  }
}
