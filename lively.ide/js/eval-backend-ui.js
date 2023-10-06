/* global localStorage */
import { pt, Rectangle, LinearGradient, Color } from 'lively.graphics';
import { arr, string } from 'lively.lang';
import { connect, signal } from 'lively.bindings';
import { config, TilingLayout, part, StyleSheet } from 'lively.morphic';
import L2LClient from 'lively.2lively/client.js';
import { serverInterfaceFor, localInterface, l2lInterfaceFor } from 'lively-system-interface';
import { Button, ButtonModel, DropDownList } from 'lively.components';
import { ButtonDefault, SystemButton } from 'lively.components/buttons.cp.js';

export class EvalBackendButtonModel extends ButtonModel {
  static get properties () {
    return {

      currentBackendName: {
        after: ['label'],
        defaultValue: 'local',
        set (name) {
          this.setProperty('currentBackendName', name);
          const backend = this.currentBackend;
          const descr = backend && backend.coreInterface && backend.coreInterface.description;
          const label = string.truncate(descr || name || 'local', 25);
          this.ui.label.textString = label;
        }
      },

      currentBackend: {
        derived: true,
        get () { return this.evalbackendChooser.backendWithName(this.currentBackendName); },
        set (backend) {
          this.currentBackendName = backend ? backend.name : 'local';
          if (this.view) signal(this.view, 'currentBackend');
        }
      },

      evalbackendChooser: {
        readOnly: true,
        derived: true,
        get () { return EvalBackendChooser.default; }
      },

      target: {},
      expose: {
        get () {
          return ['updateFromTarget', 'ensureSimilarBackend', 'target'];
        }
      }
    };
  }

  async trigger () {
    const backends = await this.evalbackendChooser.allEvalBackends();
    const { currentBackend } = this;
    let preselect = 1;
    const items = [
      'edit...',
      ...backends.map((ea, i) => {
        if (currentBackend === ea) preselect = i + 1;
        return {
          isListItem: true,
          label: [ea.coreInterface.description || ea.name, { fontSize: '90%' }],
          value: ea
        };
      })];

    let { selected: [sysInterface] } = await this.world().filterableListPrompt(
      'choose eval backend', items, {
        requester: this.target,
        preselect
      });

    if (sysInterface === 'edit...') {
      const { status, list, selections: [choice] } =
        await this.world().editListPrompt('choose and edit eval backends',
          this.evalbackendChooser.customBackends.map(ea => {
            return {
              isListItem: true,
              label: [ea.coreInterface.description || ea.name, { fontSize: '90%' }],
              value: ea
            };
          }), { historyId: 'js-eval-backend-history' });
      if (status === 'canceled') return;
      this.evalbackendChooser.customBackends = list;
      if (!choice) return;
      sysInterface = typeof choice === 'string'
        ? this.evalbackendChooser.backendWithName(choice)
        : choice;
    }

    this.currentBackend = sysInterface;
  }

  async ensureSimilarBackend () {
    if (!this.currentBackendName || !this.currentBackendName.startsWith('l2l')) return;

    // only for l2l connection
    const { currentBackend: { coreInterface: { targetId: id, peer } } } = this;
    const l2lBackends = await this.evalbackendChooser.l2lEvalBackends();

    if (l2lBackends.some(ea => ea.coreInterface.targetId === id)) return;

    let similar;
    if (peer && peer.type) {
      similar = l2lBackends.find(ea => {
        if (!ea.coreInterface.peer) return false;
        if (ea.coreInterface.peer.type !== peer.type) return false;
        if (peer.user && peer.user.name && ea.coreInterface.peer.user) { return ea.coreInterface.peer.user.name === peer.user.name; }
        return true;
      });
    }

    if (similar) {
      const focused = $world.focusedMorph;
      this.currentBackend = similar;
      focused && setTimeout(() => focused.focus(), 0);
    }
  }

  updateFromTarget () {
    this.currentBackend = this.target.systemInterface;
  }
}

export default class EvalBackendChooser {
  static get default () {
    return this._default || (this._default = new this());
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  get customBackends () {
    const stored = [];
    try {
      const stringified = localStorage['lively.morphic-ide/js/EvalBackendChooser-history'];
      const stored = stringified ? JSON.parse(stringified) : [];
      return stored.map(ea => ea.startsWith('http') ? serverInterfaceFor(ea) : null).filter(Boolean);
    } catch (e) {}
    return stored || [];
  }

  set customBackends (backends) {
    // localStorage["lively.morphic-ide/js/EvalBackendChooser-history"] =  JSON.stringify(["http://localhost:9011/eval"]);
    backends = backends.filter(ea => !!ea && ea !== 'local' && ea !== 'edit...');
    try {
      localStorage['lively.morphic-ide/js/EvalBackendChooser-history'] = JSON.stringify(backends);
    } catch (e) {}
  }

  backendWithName (name) {
    if (!name || name === 'local') return localInterface;
    if (name.startsWith('http')) return serverInterfaceFor(name);
    if (name.startsWith('l2l')) return l2lInterfaceFor(name.split(' ')[1]);
    return localInterface;
  }

  get httpEvalBackends () {
    return [serverInterfaceFor(config.remotes.server)];
  }

  async l2lEvalBackends () {
    const l2lClient = L2LClient.forLivelyInBrowser();
    let peers = await l2lClient.listPeers();

    peers = peers.filter(ea => ea.id !== l2lClient.id);

    return await Promise.all(peers.map(async ea => {
      // if (!info) info = {};
      // if (!info.known) {
      //   Promise.resolve().then(async () => {
      //     let source = `let isNode = typeof System !== "undefined"`
      //                + `  ? System.get("@system-env").node`
      //                + `  : typeof require !== "undefined" && typeof process !== "undefined"`
      //                + `      ? require("os").hostname()`
      //                + `      : String(document.location.href);`,
      //         {data: {value: location}} = await l2lClient.sendToAndWait(
      //                                       id, "remote-eval", {source});
      //     info.location = location;
      //     info.known = true;
      //   });
      // }
      return l2lInterfaceFor(ea.id, ea);
    }));
  }

  async allEvalBackends () {
    return arr.uniq([
      localInterface,
      ...this.customBackends,
      ...this.httpEvalBackends,
      ...await this.l2lEvalBackends()
    ]);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  buildEvalBackendDropdownFor (morph, btn) {
    btn = btn || part(SystemButton, {
      name: 'eval backend button',
      defaultViewModel: EvalBackendButtonModel,
      layout: new TilingLayout({ axisAlign: 'center', hugContentsHorizontally: true, padding: Rectangle.inset(5, 0, 5, 0) }),
      viewModel: { target: morph },
      height: 20,
      submorphs: [
        { name: 'label', fontSize: 11 }
      ]
    });
    setTimeout(() => btn.updateFromTarget(), 0);

    connect(btn, 'currentBackend', this, 'changeEvalBackend', {
      updater: function ($upd, choice) { $upd(choice, this.sourceObj.target); }
    });

    btn.startStepping(5000, 'ensureSimilarBackend');

    return btn;
  }

  ensureEvalBackendDropdown (morph, currentBackend) {
    let dropdown = morph.getSubmorphNamed('eval backend button');
    if (!dropdown) dropdown = this.buildEvalBackendDropdownFor(morph);
    return dropdown;
  }

  async changeEvalBackend (choice, requester/* morph */) {
    if (!requester) {
      console.warn('Called EvalBackendChooser.changeEvalBackend without requester!');
      return;
    }
    try {
      if (!choice) choice = localInterface;
      if (requester.systemInterface !== choice) {
        requester.setStatusMessage(`Eval backend is now ${choice.name}`);
        requester.setEvalBackend(choice);
      }
      requester.focus();
    } catch (err) {
      console.warn(`changeEvalBackend error: ${err}`);
    }
  }

  activateEvalBackendCommand (requester) {
    return {
      name: 'activate eval backend dropdown list',
      exec: () => {
        const btn = requester.getSubmorphNamed('eval backend button');
        btn && btn.trigger();
        return true;
      }
    };
  }
}
