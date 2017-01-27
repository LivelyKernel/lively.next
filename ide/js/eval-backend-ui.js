/*global localStorage*/

import { pt, Point, Color, Rectangle } from "lively.graphics";
import { arr } from "lively.lang";
import { connect, noUpdate } from "lively.bindings";
import { DropDownList } from "lively.morphic/components/list.js";

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
      var stringified = localStorage.getItem("lively.morphic-ide/js/EvalBackendChooser-history");
      stored = JSON.parse(stringified);
    } catch (e) {}
    return this._backends = arr.uniq([...(this._backends || []), ...(stored || [])]);
  }

  set backends(backends) {
    backends = backends.filter(ea => !!ea && ea !== "local" && ea !== "edit...");
    this._backends = backends;
    try {
      localStorage.setItem("lively.morphic-ide/js/EvalBackendChooser-history", JSON.stringify(backends));
    } catch (e) {}
  }

  buildEvalBackendDropdownFor(morph) {
    var list = new DropDownList({
      fontSize: 10,
      name: "eval backend list",
      extent: pt(120, 20)
    });
    list.requesterId = morph.id;

    connect(list, 'selection', this, 'interactivelyChangeEvalBackend', {
      updater: function($upd, choice) {
        var requester = this.sourceObj.world().getMorphWithId(this.sourceObj.requesterId);
        $upd(choice, requester);
      }
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
    var items = arr.uniq(["edit...", "local", ...this.backends]);
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

  setBackendOfCodeEditorMorph(editorMorph, backend) {
    var plugin = editorMorph.pluginFind(p => p.isJSEditorPlugin);
    if (plugin) plugin.evalEnvironment.remote = backend;
  }

  activateEvalBackendCommand(requester) {
    return {
        name: "activate eval backend dropdown list",
        exec: () => {
          var list = requester.getSubmorphNamed("eval backend list");
          list.toggleList(); list.list.focus();
          return true;
        }
      }
  }
}
