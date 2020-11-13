import { connect, disconnect } from 'lively.bindings';
import { string } from 'lively.lang';
import KeyHandler from 'lively.morphic/events/KeyHandler.js';
import { Range } from 'lively.morphic/text/range.js';

function addIndexToTextPos (textMorph, textPos, index) {
  return textMorph.indexToPosition(textMorph.positionToIndex(textPos) + index);
}

export class Snippet {
  constructor (opts = { trigger: null, expansion: '' }) {
    const { trigger, expansion } = opts;
    this.trigger = trigger;
    this.expansion = expansion;
    this.resetExpansionState();
  }

  get isTextSnippet () { return true; }

  attach (textMorph) {
    if (!this.isExpanding) return;
    this.textMorph = textMorph;
    connect(this.textMorph, 'selectionChange', this, 'onCursorMove');
  }

  detach (textMorph) {
    if (!this.isExpanding) return;
    disconnect(textMorph, 'selectionChange', this, 'onCursorMove');
    this.textMorph = null;
  }

  onCursorMove () {
    const { startAnchor, endAnchor, isExpanding } = this.expansionState;
    if (!isExpanding) { this.resetExpansionState(); return; }

    const range = Range.fromPositions(startAnchor.position, endAnchor.position);
    if (!range.containsPosition(this.textMorph.cursorPosition)) { this.resetExpansionState(); }
  }

  resetExpansionState () {
    const m = this.textMorph;
    if (m) {
      const { marker, startAnchor, endAnchor, steps } = this.expansionState || {};
      if (startAnchor) m.removeAnchor(startAnchor);
      if (endAnchor) m.removeAnchor(endAnchor);
      if (marker) m.removeMarker(marker);
      steps.forEach(({ anchor }) => m.removeAnchor(anchor));
    }

    this.expansionState = { stepIndex: -1, steps: [], isExpanding: false, startMarker: null, endMarker: null };

    m && m.removePlugin(this);
  }

  get isExpanding () { return this.expansionState.isExpanding; }

  createExpansionSteps (expansion) {
    const steps = [];
    const matches = string.reMatches(expansion, /\$[0-9]+|\$\{[0-9]+:[^\}]*\}/g);
    let offset = 0;

    matches.forEach(({ start, end, match }) => {
      let n; let prefill = '';
      if (match.startsWith('${')) {
        const [_, nString, _prefill] = match.match(/^\$\{([0-9]+):([^\}]*)\}/);
        n = Number(nString);
        prefill = _prefill;
      } else {
        n = Number(match.replace(/^\$/, ''));
      }
      expansion = expansion.slice(0, start - offset) + prefill + expansion.slice(end - offset);
      steps[n] = { index: start - offset, prefill, anchor: null };
      offset += end - start - prefill.length;
    });

    return { steps, expansion };
  }

  expandAtCursor (textMorph) {
    const m = textMorph; const sel = m.selection;
    let indent = m.cursorPosition.column;
    var expansion = this.expansion;

    if (this.trigger) { indent -= this.trigger.length; }
    indent = Math.max(0, indent);

    if (indent) {
      let lines = string.lines(expansion);
      lines = [lines[0], ...lines.slice(1).map(line => string.indent(line, ' ', indent))];
      expansion = lines.join('\n');
    }

    var { expansion, steps } = this.createExpansionSteps(expansion);

    if (this.trigger) { sel.growLeft(this.trigger.length); }

    sel.text = expansion;
    const { start, end } = sel;
    sel.collapseToEnd();

    if (!steps.length) return;

    const id = string.newUUID();

    // add anchors to expansion steps, this are the selection insertion points
    // the user can tab through. To keep their position where it was intended to
    // be even if stuff gets inserted before, use anchors
    steps.forEach((step, i) =>
      step.anchor = m.addAnchor({
        id: `snippet-step-${i}-` + id,
        ...addIndexToTextPos(m, start, step.index)
      }));

    const startAnchor = m.addAnchor({ id: 'snippet-start-' + id, ...start, insertBehavior: 'stay' });
    const endAnchor = m.addAnchor({ id: 'snippet-end-' + id, ...end });
    const marker = m.addMarker({
      id: 'snippet-marker-' + id,
      get range () { return { start: startAnchor.position, end: endAnchor.position }; },
      style: {
        'border-radius': '4px',
        'background-color': 'rgba(30, 200, 140, 0.3)',
        'box-shadow': '0 0 4px rgba(30, 200, 140, 0.3)',
        'pointer-events': 'none',
        content: 'fooooo'
      }
    });

    this.expansionState = {
      marker,
      startAnchor,
      endAnchor,
      stepIndex: 0,
      steps,
      isExpanding: true
    };

    m.addPlugin(this);

    this.nextStep();
  }

  nextStep () {
    const { steps, stepIndex, startAnchor, isExpanding } = this.expansionState;
    const m = this.textMorph;
    if (!isExpanding || !m) return;
    const sel = m.selection;
    const { anchor: { position: stepPosition }, prefill } = steps[stepIndex];
    sel.lead = sel.anchor = stepPosition;
    sel.growRight(prefill.length);
    this.expansionState.stepIndex++;
    if (this.expansionState.stepIndex >= steps.length) {
      this.resetExpansionState();
      console.log(`[snippet] expansion of ${this.expansion} done`);
    }
  }

  canExpand (text, position = text.cursorPosition) {
    const triggerEnd = text.positionToIndex(text.cursorPosition);
    const triggerStart = triggerEnd - this.trigger.length;
    return text.textString.slice(triggerStart, triggerEnd) === this.trigger;
  }

  tryTrigger (text, position = text.cursorPosition) {
    if (!this.canExpand(text, position = text.cursorPosition)) return false;
    this.expandAtCursor(text);
    return true;
  }

  getCommands (commands) {
    return commands.concat([
      {
        name: '[snippet] next expansion step',
        exec: (textMorph) => { this.nextStep(); return true; }
      },

      {
        name: '[snippet] cancel expansion',
        exec: (textMorph) => { this.resetExpansionState(); return true; }
      }
    ]);
  }

  getKeyHandlers (handlers) {
    return handlers.concat(
      KeyHandler.withBindings([
        { keys: 'Tab', command: '[snippet] next expansion step' },
        { keys: 'Escape', command: '[snippet] cancel expansion' }
      ]));
  }
}

export const snippetCommands = [{
  name: 'get snippets',
  exec: (textMorph) => {
    return textMorph.pluginCollect('getSnippets', []);
  }
}];
