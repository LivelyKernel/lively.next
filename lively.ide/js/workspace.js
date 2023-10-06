/* global System */
import { arr } from 'lively.lang';
import { pt } from 'lively.graphics';
import { config, easings, Text } from 'lively.morphic';
import JavaScriptEditorPlugin from './editor-plugin.js';
import EvalBackendChooser from './eval-backend-ui.js';
import { resource } from 'lively.resources';
import { Window } from 'lively.components';
import DefaultTheme from '../themes/default.js';
import DarkTheme from '../themes/dark.js';
import { StatusMessageConfirm } from 'lively.halos/components/messages.cp.js';
import { InputLine } from 'lively.components/inputs.js';
import { connect } from 'lively.bindings';

export default class Workspace extends Window {
  static get properties () {
    return {
      extent: { defaultValue: pt(400, 300) },

      title: {
        initialize (val) {
          this.title = val || 'Workspace';
        }
      },

      targetMorph: {
        initialize () {
          this.targetMorph = new Text({
            name: 'editor',
            readOnly: false,
            textString: '// Enter and evaluate JavaScript code here',
            lineWrapping: 'by-chars',
            ...config.codeEditor.defaultStyle,
            plugins: [new JavaScriptEditorPlugin()]
          });
        }
      },

      content: {
        derived: true,
        after: ['targetMorph'],
        get () { return this.targetMorph.textString; },
        set (val) { if (val) this.targetMorph.textString = val; }
      },

      jsPlugin: {
        derived: true,
        readOnly: true,
        after: ['targetMorph'],
        get () { return this.targetMorph.pluginFind(p => p.isEditorPlugin); },
        initialize () {
          const ed = this.targetMorph;
          this.jsPlugin.evalEnvironment = {
            targetModule: 'lively://lively.next-workspace/' + ed.id,
            context: ed,
            format: 'esm'
          };
          const sys = this.jsPlugin.systemInterface();
          const btn = this.ui.contentsWrapper.addMorph(EvalBackendChooser.default.ensureEvalBackendDropdown(
            this, sys ? sys.name : 'local'));
          connect(btn, 'extent', this, 'relayoutWindowControls');
        }
      },

      systemInterface: {
        derived: true,
        after: ['jsPlugin'],
        get () { return this.jsPlugin.systemInterface(); },
        set (systemInterface) {
          this.jsPlugin.setSystemInterfaceNamed(systemInterface);
        }
      },

      file: {
        get () { const f = this.getProperty('file'); return f ? resource(f) : f; },
        set (file) {
          if (file && file.isResource) file = file.url;
          this.setProperty('file', file);
        }
      }
    };
  }

  async openWindowMenu () {
    const menuItems = [
      [
        'Change Window Title',
        async () => {
          const newTitle = await $world.prompt('Enter New Name', { input: this.title });
          if (newTitle) this.title = newTitle;
        }
      ],
      { isDivider: true },
      ['Set Workspace File...', () => this.execCommand('[workspace] query for file')],
      ...(await this.targetMorph.menuItems())
    ];
    this.targetMorph.world().openMenu(menuItems);
  }

  onLoad () {
    this.jsPlugin.requestHighlight();
  }

  async setEvalBackend (choice) {
    const duration = 1000;
    const easing = easings.outExpo;
    this.jsPlugin.setSystemInterfaceNamed(choice);
    let styleClasses, theme;
    if ((await this.jsPlugin.runEval("System.get('@system-env').node")).value) {
      styleClasses = [...this.styleClasses, 'node'];
      theme = DarkTheme.instance;
    } else {
      styleClasses = arr.without(this.styleClasses, 'node');
      theme = DefaultTheme.instance;
    }
    this.animate({ duration, easing, styleClasses });
    this.jsPlugin.theme = theme;
    this.getSubmorphNamed('editor').textString = this.getSubmorphNamed('editor').textString;
    await this.get('editor').animate({
      fill: this.jsPlugin.theme.background,
      duration,
      easing
    });
    this.jsPlugin.highlight();
  }

  relayoutWindowControls () {
    // deactivate here since all submorphs are present
    this.doNotAcceptDropsForThisAndSubmorphs();
    super.relayoutWindowControls();
    const list = this.getSubmorphNamed('eval backend button');
    const title = this.ui.windowTitle;
    if (list) {
      list.visible = !this.minimized;
      list.height = 21;
      const tr = this.innerBounds().topRight().addXY(-5, 2);
      this.minimized;
      if (tr.x - list.width < title.right + 3) {
        list.topLeft = tr.withX(title.right + 3);
      } else {
        list.topRight = tr;
      }
    }
  }

  get commands () {
    return [
      EvalBackendChooser.default.activateEvalBackendCommand(this),

      {
        name: '[workspace] query for file',
        async exec (workspace) {
          const historyId = 'lively.ide-workspace-file-hist';
          const { items: hist } = InputLine.getHistory(historyId);
          const f = await workspace.world().prompt(
            'Enter a file to save the workspace contents to',
            {
              input: workspace.file
                ? workspace.file.url
                : hist.length
                  ? arr.last(hist)
                  : resource(System.baseURL).join('workspace.js').url,
              requester: workspace,
              historyId
            });
          workspace.file = f;
          if (!f) {
            workspace.setStatusMessage('workspace file cleared');
            return;
          }
          workspace.setStatusMessage(`workspace saves content to ${workspace.file.url}`);
          if (await workspace.world().confirm(`Load content from ${f}?`, { requester: workspace })) { workspace.content = await workspace.file.read(); }
        }
      },

      {
        name: '[workspace] save content',
        async exec (workspace) {
          if (!workspace.file) {
            workspace.setStatusMessage('Cannot save: no workspace file set');
            return workspace;
          }
          try {
            await workspace.file.write(workspace.content);
          } catch (e) { workspace.showError(e); throw e; }
          workspace.setStatusMessage(`Saved to ${workspace.file.url}`, StatusMessageConfirm);
          return workspace;
        }
      }
    ].concat(super.commands);
  }

  get keybindings () {
    return super.keybindings.concat([
      { keys: 'Meta-Shift-L b a c k e n d', command: 'activate eval backend dropdown list' },
      { keys: 'Alt-L', command: '[workspace] query for file' },
      { keys: { mac: 'Command-S', win: 'Ctrl-S' }, command: '[workspace] save content' }
    ]);
  }
}
