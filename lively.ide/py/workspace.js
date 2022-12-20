import { pt, Point, Color, Rectangle } from 'lively.graphics';
import { config, morph } from 'lively.morphic';
import { Window } from 'lively.components';

export default class Workspace extends Window {
  static get properties () {
    return {

      title: { defaultValue: 'Python Workspace' },
      name: { defaultValue: 'python-workspace' },

      targetMorph: {
        initialize () {
          this.targetMorph = {
            type: 'text',
            name: 'editor',
            readOnly: false,
            lineWrapping: false,
            // textMode: "python",
            textString: '# Enter and evaluate Python code here',
            ...config.codeEditor.defaultStyle
          };
          // FIXME
          this.targetMorph.changeEditorMode('python');
        }
      },

      content: {
        derived: true,
        after: ['targetMorph'],
        get () { return this.targetMorph.textString; },
        set (content) { return this.targetMorph.textString = content; }
      },

      extent: { defaultValue: pt(400, 300) },

      pyPlugin: {
        derived: true,
        readOnly: true,
        after: ['targetMorph'],
        get () {
          return this.targetMorph.pluginFind(p => p.isPythonEditorPlugin);
        }
      }
    };
  }
}
