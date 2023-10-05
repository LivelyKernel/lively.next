import { connect } from 'lively.bindings';
import { pt, Rectangle } from 'lively.graphics';
import { config, part } from 'lively.morphic';
import { Window } from 'lively.components';
import ShellEditorPlugin from './editor-plugin.js';
import Terminal from './terminal.js';
import { SystemButton } from 'lively.components/buttons.cp.js';

export default class Workspace extends Window {
  static get properties () {
    return {

      title: { defaultValue: 'Shell Workspace' },
      name: { defaultValue: 'shell-workspace' },

      targetMorph: {
        initialize () {
          this.targetMorph = {
            type: 'text',
            name: 'editor',
            readOnly: false,
            lineWrapping: 'no-wrap',
            textString: '// Enter and evaluate JavaScript code here',
            ...config.codeEditor.defaultStyle
            // plugins: [new ShellEditorPlugin()]
          };
        }
      },

      content: {
        derived: true,
        after: ['targetMorph'],
        get () { return this.targetMorph.textString; },
        set (content) { return this.targetMorph.textString = content; }
      },

      cwd: {
        derived: true,
        after: ['shellPlugin'],
        get () { return this.shellPlugin.cwd; },
        set (cwd) { return this.shellPlugin.cwd = cwd; }
      },

      extent: { defaultValue: pt(400, 300) },

      shellPlugin: {
        derived: true,
        readOnly: true,
        after: ['targetMorph'],
        get () {
          return this.targetMorph.pluginFind(p => p.isShellEditorPlugin) ||
              this.targetMorph.addPlugin(new ShellEditorPlugin());
        }
      }
    };
  }

  constructor (props) {
    super(props);
    const btn = this.addMorph(this.ensureCwdButton(this.shellPlugin.cwd));
    connect(this.shellPlugin, 'cwd', btn, 'label',
      { converter: cwd => lively.lang.string.truncateLeft(cwd, 50) });
  }

  onLoad (_, snapshot) {
    if (this._serializedState) {
      this.cwd = this._serializedState.cwd;
      delete this._serializedState;
    }
  }

  __additionally_serialize__ (snapshot, objRef, pool, addFn) {
    super.__additionally_serialize__(snapshot, objRef, pool, addFn);

    // remove unncessary state
    const ref = pool.ref(this.targetMorph);
    const props = ref.currentSnapshot.props;
    if (props.attributeConnections) props.attributeConnections.value = [];
    if (props.plugins) props.plugins.value = [];
    if (props.anchors) {
      props.anchors.value =
      ref.currentSnapshot.props.anchors.value.filter(({ id }) =>
        id.startsWith('selection-'));
    }
    if (props.savedMarks) props.savedMarks.value = [];

    // save essential state
    snapshot.props._serializedState = {
      verbatim: true,
      value: {
        cwd: this.cwd
      }
    };
  }

  ensureCwdButton (cwd) {
    let btn = this.getSubmorphNamed('changeCwdButton');
    if (btn) return btn;
    btn = part(SystemButton, {
      name: 'changeCwdButton',
      padding: Rectangle.inset(4, 2),
      extent: pt(60, 20),
      borderRadius: 3,
      submorphs: [
        { name: 'label', textAndAttributes: ['cwd...'] }
      ]
    });
    connect(btn, 'fire', this, 'execCommand', { converter: () => '[shell] change working directory' });
    return btn;
  }

  relayoutWindowControls () {
    super.relayoutWindowControls();
    const list = this.getSubmorphNamed('changeCwdButton');
    if (list) {
      const title = this.ui.windowTitle;
      list.topRight = this.innerBounds().topRight().addXY(-5, 2);
      if (list.left < title.right + 3) list.left = title.right + 3;
    }
  }

  get keybindings () {
    return [
      { keys: { mac: 'Meta-Shift-O', win: 'Ctrl-Shift-O' }, command: '[shell] open running command in terminal' }];
  }

  get commands () {
    return [
      {
        name: '[shell] change working directory',
        async exec (workspace) {
          await workspace.targetMorph.execCommand('[shell] change working directory');
          const [front, back] = workspace.title.split('-');
          workspace.title = workspace.shellPlugin.cwd
            ? `${front.trim()} - ${workspace.shellPlugin.cwd}`
            : `${front.trim()}`;
        }
      },

      {
        name: '[shell] open running command in terminal',
        exec (workspace) {
          const { command, cwd } = workspace.shellPlugin;
          if (!command) {
            workspace.setStatusMessage('No command running!');
            return true;
          }
          workspace.shellPlugin.command = null;
          workspace.shellPlugin.updateWindowTitle();
          return Terminal.forCommand(command, { cwd });
        }
      }
    ];
  }
}
