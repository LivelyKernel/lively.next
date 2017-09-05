/*global localStorage*/
import { pt, LinearGradient, Point, Color, Rectangle } from "lively.graphics";
import { arr, obj, string } from "lively.lang";
import { connect, noUpdate } from "lively.bindings";
import { DropDownList, config, StyleSheet, Button } from "lively.morphic";
import L2LClient from "lively.2lively/client.js";
import { serverInterfaceFor, localInterface, l2lInterfaceFor } from "lively-system-interface";

export class EvalBackendButton extends Button {

  static get properties() {

    return {

      defaultActiveStyle: {
        defaultValue: {
          borderRadius: 4,
          borderColor: Color.rgb(204,204,204),
          fill: "linear-gradient(180deg,rgba(255,255,255,1) 0%,rgba(236,240,241,1) 100%)",
          fontColor: Color.rgb(64,64,64),
          nativeCursor: "pointer",
          fontSize: 10,
          fontFamily: "Sans-Serif",
        }
      },

      currentBackendName: {
        after: ["label"], defaultValue: "local",
        set(name) {
          this.setProperty("currentBackendName", name);
          let backend = this.currentBackend,
              descr = backend && backend.coreInterface && backend.coreInterface.description,
              label = string.truncate(descr || name || "local", 25);
          this.label = label;
        }
      },

      currentBackend: {
        derived: true,
        get() { return this.evalbackendChooser.backendWithName(this.currentBackendName); },
        set(backend) {
          this.currentBackendName = backend ? backend.name : "local";
        }
      },

      evalbackendChooser: {
        readOnly: true, derived: true,
        get() { return EvalBackendChooser.default; }
      },
      
      fontSize: {defaultValue: 10},
      extent: {defaultValue: pt(120, 20)},
      target: {}
    }
  }

  async trigger() {
    let backends = await this.evalbackendChooser.allEvalBackends(),
        {currentBackend} = this,
        preselect = 1,
        items = [
          "edit...",
          ...backends.map((ea, i) => {
            if (currentBackend === ea) preselect = i+1;
            return {
              isListItem: true,
              label: [ea.coreInterface.description || ea.name, {fontSize: "90%"}],
              value: ea
            };
          })];

    let {selected: [sysInterface]} = await this.world().filterableListPrompt(
      "choose eval backend", items, {
        requester: this.target,
        preselect
      });

    if (sysInterface === "edit...") {
      var {status, list, selections: [choice]} =
        await this.world().editListPrompt("choose and edit eval backends",
          this.evalbackendChooser.customBackends.map(ea => {
            return {
              isListItem: true,
              label: [ea.coreInterface.description || ea.name, {fontSize: "90%"}],
              value: ea
            };
          }), {historyId: "js-eval-backend-history"});
      if ("canceled" === status) return;
      this.evalbackendChooser.customBackends = list;
      if (!choice) return;
      sysInterface = typeof choice === "string"
        ? this.evalbackendChooser.backendWithName(choice)
        : choice;
    }
    
    this.currentBackend = sysInterface;
  }

  async ensureSimilarBackend() {
    if (!this.currentBackendName || !this.currentBackendName.startsWith("l2l")) return;

    // only for l2l connection
    let {currentBackend: {coreInterface: {targetId: id, peer}}} = this,
        l2lBackends = await this.evalbackendChooser.l2lEvalBackends();

    if (l2lBackends.some(ea => ea.coreInterface.targetId === id)) return;

    let similar;
    if (peer && peer.type) {
      similar = l2lBackends.find(ea => {
        if (!ea.coreInterface.peer) return false;
        if (ea.coreInterface.peer.type !== peer.type) return false;
        if (peer.user && peer.user.name && ea.coreInterface.peer.user)
          return ea.coreInterface.peer.user.name === peer.user.name;
        return true;
      });
    }

    if (similar) {
      let focused = $world.focusedMorph;
      this.currentBackend = similar;
      focused && setTimeout(() => focused.focus(), 0);
    }
  }

  updateFromTarget() {
    this.currentBackend = this.target.systemInterface;
  }
}


class EvalBackendList extends DropDownList {

  static get properties() {
    return {
      target: {},
      evalbackendChooser: {},
      styleSheets: {
        initialize() {
          this.styleSheets = new StyleSheet({
            ".DropDownList [name=dropDownList]": {
              fontSize: 12,
              fontFamily: "Helvetica Neue, Arial, sans-serif",
              fontColor: Color.black,
              borderWidth: 1,
              borderColor: Color.gray,
              fill: Color.white.withA(.8),
              dropShadow: true
            },
            ".EvalBackendList": {extent: pt(120, 20)},
            ".EvalBackendList [name=label]": {fontSize: 10},
            ".Button.activeStyle": {
              fill: new LinearGradient({
                stops: [
                  {offset: 0, color: Color.white},
                  {offset: 1, color: new Color.rgb(236, 240, 241)}
                ]
              })
            }
          });
        }
      }
    }
  }

  setAndSelectBackend(backend) {}
  async ensureSimilarBackend() {}
}


export default class EvalBackendChooser {

  static get default() {
    return this._default || (this._default = new this());
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  get customBackends() {
    var stored = [];
    try {
      let stringified = localStorage["lively.morphic-ide/js/EvalBackendChooser-history"],
          stored = JSON.parse(stringified);
      return stored.map(ea => ea.startsWith("http") ? serverInterfaceFor(ea) : null).filter(Boolean);
    } catch (e) {}
    return stored || [];
  }

  set customBackends(backends) {
      // localStorage["lively.morphic-ide/js/EvalBackendChooser-history"] =  JSON.stringify(["http://localhost:9011/eval"]);
    backends = backends.filter(ea => !!ea && ea !== "local" && ea !== "edit...");
    try {
      localStorage["lively.morphic-ide/js/EvalBackendChooser-history"] =  JSON.stringify(backends);
    } catch (e) {}
  }

  backendWithName(name) {
    if (!name || name === "local") return localInterface;
    if (name.startsWith("http")) return serverInterfaceFor(name);
    if (name.startsWith("l2l")) return l2lInterfaceFor(name.split(" ")[1]);
    return localInterface;
  }

  get httpEvalBackends() {
    return [serverInterfaceFor(config.remotes.server)];
  }

  async l2lEvalBackends() {
    let l2lClient = L2LClient.forLivelyInBrowser(),
        peers = await l2lClient.listPeers();

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

  async allEvalBackends() {
    return arr.uniq([
      localInterface,
      ...this.customBackends,
      ...this.httpEvalBackends,
      ...await this.l2lEvalBackends(),
    ]);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-  

  buildEvalBackendDropdownFor(morph) {
    var btn = new EvalBackendButton({
      name: "eval backend button",
      height: 20,
      target: morph,
    });
    setTimeout(() => btn.updateFromTarget(), 0);

    connect(btn, 'currentBackend', this, 'changeEvalBackend', {
      updater: function($upd, choice) { $upd(choice, this.sourceObj.target); }
    });


    btn.startStepping(5000, "ensureSimilarBackend");

    return btn;
  }

  ensureEvalBackendDropdown(morph, currentBackend) {
    var dropdown = morph.getSubmorphNamed("eval backend button");
    if (!dropdown) dropdown = this.buildEvalBackendDropdownFor(morph);
    return dropdown;
  }

  async changeEvalBackend(choice, requester/*morph*/) {
    if (!requester) {
      console.warn(`Called EvalBackendChooser.changeEvalBackend without requester!`);
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

  activateEvalBackendCommand(requester) {
    return {
        name: "activate eval backend dropdown list",
        exec: () => {
          var btn = requester.getSubmorphNamed("eval backend button");
          btn && btn.trigger();
          return true;
        }
      }
  }
}
