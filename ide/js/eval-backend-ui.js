/*global localStorage*/

import { pt, Point, Color, Rectangle } from "lively.graphics";
import { arr, obj } from "lively.lang";
import { connect, noUpdate } from "lively.bindings";
import { DropDownList, config } from "lively.morphic";
import L2LClient from "lively.2lively/client.js";

class EvalBackendList extends DropDownList {
  static get properties() {
    return {
      fontSize: {defaultValue: 10},
      extent: {defaultValue: pt(120, 20)},
      target: {},
      evalbackendChooser: {}
    }
  }

  setAndSelectBackend(backend) {
    if (!backend) backend = "local";
    if (typeof backend !== "string") backend = backend.name || "unknown backend"
    let chooser = this.evalbackendChooser;
    if (!chooser.backends.includes(backend))
      chooser.backends = [...chooser.backends, backend];
    this.selection = backend;
  }
}


export default class EvalBackendChooser {

  static get default() {
    return this._default || (this._default = new this());
  }

  get backends() {
    var stored = [];
    try {
      var stringified = localStorage["lively.morphic-ide/js/EvalBackendChooser-history"];
      stored = JSON.parse(stringified);
    } catch (e) {}
    return stored || [];
  }

  set backends(backends) {
      // localStorage["lively.morphic-ide/js/EvalBackendChooser-history"] =  JSON.stringify(["http://localhost:9011/eval"]);
    backends = backends.filter(ea => !!ea && ea !== "local" && ea !== "edit...");
    try {
      localStorage["lively.morphic-ide/js/EvalBackendChooser-history"] =  JSON.stringify(backends);
    } catch (e) {}
  }

  buildEvalBackendDropdownFor(morph) {
    var list = new EvalBackendList({
      evalbackendChooser: this,
      name: "eval backend list",
      target: morph
    });

    connect(list, 'selection', this, 'interactivelyChangeEvalBackend', {
      updater: function($upd, choice) { $upd(choice, this.sourceObj.target); }
    });

    // for updating the list items when list is opened:
    connect(list, 'activated', this, 'updateItemsOfEvalBackendDropdown', {
      updater: function($upd) { $upd(this.sourceObj, this.sourceObj.selection); }
    });
    return list;
  }

  ensureEvalBackendDropdown(morph, currentBackend) {
    var dropdown = morph.getSubmorphNamed("eval backend list");
    if (!dropdown) dropdown = this.buildEvalBackendDropdownFor(morph);
    this.updateItemsOfEvalBackendDropdown(dropdown, currentBackend)
    return dropdown;
  }

  async l2lEvalBackends() {
    // FIXME this is temporary... needs cleanup
    let l2lClient = L2LClient.forLivelyInBrowser(),
        {data: clients} = await new Promise((resolve, reject) =>
          l2lClient.sendTo(l2lClient.trackerId, "getClients", {}, resolve));
    clients = clients.filter(ea => ea[0] !== l2lClient.id)
    return clients.map(([id, {info = {}}]) => {
      let name = `l2l ${id.slice(0, 5)}${info ? " - " + info.type : ""}`;
      return {
        string: name,
        value: {id, info, type: "l2l", name},
        isListItem: true
      }
    })
  }

  async updateItemsOfEvalBackendDropdown(dropdown, currentBackend) {
    currentBackend = currentBackend || "local";
    if (typeof currentBackend !== "string" && !currentBackend.isListItem) {
      currentBackend = {
        isListItem: true,
        string: currentBackend.name || "unknown",
        value: currentBackend
      }
    }

    let l2lBackends = await this.l2lEvalBackends(),
        items = arr.uniqBy([
          "edit...", "local",
          currentBackend,
          ...this.backends,
          ...obj.values(config.remotes),
          ...l2lBackends
        ], (a, b) => {
          let valA = a.value || a;
          let valB = b.value || b;
          return valA == valB || obj.equals(valA, valB)
        });

    setTimeout(() => {
      noUpdate({sourceObj: dropdown, sourceAttribute: "selection"}, () => {
        dropdown.items = items;
        dropdown.selection = currentBackend;
        // dropdown.label = currentBackend;
      });
    }, 20);
  }

  async interactivelyChangeEvalBackend(choice, requester/*morph*/) {
    if (!requester) {
      console.warn(`Called EvalBackendChooser.interactivelyChangeEvalBackend without requester!`);
      return;
    }

    if (!choice) choice = "local";

    if (choice === "edit...") { // query user
      var {status, list, selections: [choice]} =
        await requester.world().editListPrompt("choose and edit eval backends",
          this.backends,
          {historyId: "js-eval-backend-history"});
      if ("canceled" === choice) {
        requester.setStatusMessage("Canceled");
        return;
      }
      this.backends = list;
    }

    choice = "local" === choice ? undefined : choice;

    // if (choice) this.backends = arr.uniq([choice, ...this.backends]);
    this.updateItemsOfEvalBackendDropdown(requester.getSubmorphNamed("eval backend list"), choice);

    let name = !choice ? "local" : typeof choice === "string" ? choice : choice.name
    requester.setStatusMessage(`Eval backend is now ${name}`);
    requester.setEvalBackend(choice);
    requester.focus();
  }

  activateEvalBackendCommand(requester) {
    return {
        name: "activate eval backend dropdown list",
        exec: () => {
          var list = requester.getSubmorphNamed("eval backend list");
          list.toggleList(); list.listMorph.focus();
          return true;
        }
      }
  }
}
