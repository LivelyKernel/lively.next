import { connect, disconnect } from "lively.bindings";
import { string } from "lively.lang";
import { show } from "lively.morphic";

import KeyHandler from "../events/KeyHandler.js";
import { Range } from "../text/range.js";

function addIndexToTextPos(textMorph, textPos, index) {
  return textMorph.indexToPosition(textMorph.positionToIndex(textPos) + index)
}

export class Snippet {

  constructor(opts = {trigger: null, expansion: ""}) {
    var {trigger, expansion} = opts;
    this.trigger = trigger;
    this.expansion = expansion;
    this.resetExpansionState();
  }

  get isTextSnippet() { return true }

  attach(textMorph) {
    if (!this.isExpanding) return;
    this.textMorph = textMorph;
    connect(this.textMorph, "selectionChange", this, "onCursorMove");
  }

  detach(textMorph) {
    if (!this.isExpanding) return;
    disconnect(textMorph, "selectionChange", this, "onCursorMove");
    this.textMorph = null;
  }

  onCursorMove() {
    var {startAnchor, endAnchor, isExpanding} = this.expansionState;
    if (!isExpanding) { this.resetExpansionState(); return; }

    var range = Range.fromPositions(startAnchor.position, endAnchor.position);
    if (!range.containsPosition(this.textMorph.cursorPosition))
      this.resetExpansionState();
  }

  resetExpansionState() {
    var m = this.textMorph;
    if (m) {
      var {marker, startAnchor, endAnchor, steps} = this.expansionState || {};
      if (startAnchor) m.removeAnchor(startAnchor);
      if (endAnchor) m.removeAnchor(endAnchor);
      if (marker) m.removeMarker(marker);
      steps.forEach(({anchor}) => m.removeAnchor(anchor))
    }

    this.expansionState = {stepIndex: -1, steps: [], isExpanding: false, startMarker: null, endMarker: null};

    m && m.removePlugin(this);
  }

  get isExpanding() { return this.expansionState.isExpanding; }

  createExpansionSteps(expansion) {
    var steps = [],
        matches = lively.lang.string.reMatches(expansion, /\$[0-9]+|\$\{[0-9]+:[^\}]*\}/g),
        offset = 0;

    matches.forEach(({start, end, match}) => {
      var n, prefill = "";
      if (match.startsWith("${")) {
        var [_, nString, _prefill] = match.match(/^\$\{([0-9]+):([^\}]*)\}/);
        n = Number(nString);
        prefill = _prefill;
      } else {
        n = Number(match.replace(/^\$/, ""))
      }
      expansion = expansion.slice(0, start-offset) + prefill + expansion.slice(end-offset);
      steps[n] = {index: start-offset, prefill, anchor: null};
      offset += end-start-prefill.length;
    });

    return {steps, expansion};
  }

  expandAtCursor(textMorph) {
    var m = textMorph, sel = m.selection,
        indent = m.cursorPosition.column,
        expansion = this.expansion;

    if (this.trigger)
      indent -= this.trigger.length;
    indent = Math.max(0, indent);

    if (indent) {
      var lines = string.lines(expansion);
      lines = [lines[0], ...lines.slice(1).map(line => string.indent(line, " ", indent))];
      expansion = lines.join("\n");
    }

    var {expansion, steps} = this.createExpansionSteps(expansion);

    if (this.trigger)
      sel.growLeft(this.trigger.length)

    sel.text = expansion;
    var {start, end} = sel;
    sel.collapseToEnd();

    if (!steps.length) return;

    var id = string.newUUID();

    // add anchors to expansion steps, this are the selection insertion points
    // the user can tab through. To keep their position where it was intended to
    // be even if stuff gets inserted before, use anchors
    steps.forEach((step, i) =>
      step.anchor = m.addAnchor({
        id: `snippet-step-${i}-` + id,
        ...addIndexToTextPos(m, start, step.index)}));

    var startAnchor = m.addAnchor({id: "snippet-start-" + id, ...start, insertBehavior: "stay"}),
        endAnchor = m.addAnchor({id: "snippet-end-" + id, ...end}),
        marker = m.addMarker({
          id: "snippet-marker-" + id,
          get range() { return {start: startAnchor.position, end: endAnchor.position}; },
          style: {
            "border-radius": "4px",
            "background-color": "rgba(30, 200, 140, 0.3)",
            "box-shadow": "0 0 4px rgba(30, 200, 140, 0.3)",
            "pointer-events": "none",
            "content": "fooooo"
          }
        });

    this.expansionState = {
      marker, startAnchor, endAnchor,
      stepIndex: 0, steps, isExpanding: true
    };

    m.addPlugin(this);

    this.nextStep();
  }

  nextStep() {
    var {steps, stepIndex, startAnchor, isExpanding} = this.expansionState,
        m = this.textMorph;
    if (!isExpanding || !m) return;
    var sel = m.selection;
    var {anchor: {position: stepPosition}, prefill} = steps[stepIndex];
    sel.lead = sel.anchor = stepPosition;
    sel.growRight(prefill.length)
    this.expansionState.stepIndex++;
    if (this.expansionState.stepIndex >= steps.length) {
      this.resetExpansionState();
      console.log(`[snippet] expansion of ${this.expansion} done`);
    }
  }

  canExpand(text, position = text.cursorPosition) {
    var triggerEnd = text.positionToIndex(text.cursorPosition),
        triggerStart = triggerEnd - this.trigger.length;
    return text.textString.slice(triggerStart, triggerEnd) === this.trigger;
  }

  tryTrigger(text, position = text.cursorPosition) {
    if (!this.canExpand(text, position = text.cursorPosition)) return false;
    this.expandAtCursor(text);
    return true;
  }

  getCommands(commands) {
    return commands.concat([
      {
        name: "[snippet] next expansion step",
        exec: (textMorph) => { this.nextStep(); return true; }
      },

      {
        name: "[snippet] cancel expansion",
        exec: (textMorph) => { this.resetExpansionState(); return true; }
      }
    ])
  }

  getKeyHandlers(handlers) {
    return handlers.concat(
            KeyHandler.withBindings([
              {keys: 'Tab', command: "[snippet] next expansion step"},
              {keys: 'Escape', command: "[snippet] cancel expansion"},
            ]));
  }
}