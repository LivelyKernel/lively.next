/*global localStorage*/

import { pt, Point, Color, Rectangle } from "lively.graphics";
import { arr } from "lively.lang";
import { connect, noUpdate } from "lively.bindings";
import { DropDownList } from "lively.morphic";

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

  constructor() {
    this._backends = [];
  }

  get backends() {
    var stored = [];
    try {
      var stringified = localStorage["lively.morphic-ide/js/EvalBackendChooser-history"];
      stored = JSON.parse(stringified);
    } catch (e) {}
    return this._backends = arr.uniq([...(this._backends || []), ...(stored || [])]);
  }

  set backends(backends) {
      // localStorage["lively.morphic-ide/js/EvalBackendChooser-history"] =  JSON.stringify(["http://localhost:9011/eval"]);
    backends = backends.filter(ea => !!ea && ea !== "local" && ea !== "edit...");
    this._backends = backends;
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

  updateItemsOfEvalBackendDropdown(dropdown, currentBackend) {
    currentBackend = currentBackend || "local";
    var items = arr.uniq(["edit...", "local", currentBackend, ...this.backends]);
    setTimeout(() => {
      noUpdate({sourceObj: dropdown, sourceAttribute: "selection"}, () => {
        dropdown.items = items;
        dropdown.selection = currentBackend;
        dropdown.label = currentBackend;
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

    if (choice) this.backends = arr.uniq([choice, ...this.backends]);
    this.updateItemsOfEvalBackendDropdown(requester.getSubmorphNamed("eval backend list"), choice);

    requester.setStatusMessage(`Eval backend is now ${choice || "local"}`);
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
