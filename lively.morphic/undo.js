import { obj, arr, events, fun } from 'lively.lang';

class Undo {
  constructor (name, targets = [], no = 0) {
    this.name = name;
    this.targets = targets;
    this.recorder = null;
    this.changes = null;
    this.timestamp = null;
    this.no = no;
  }

  recorded () { return !!this.changes; }
  isRecording () { return !!this.recorder; }

  startRecording (filterFn) {
    if (this.recorded() || this.isRecording()) { throw new Error('Undo already recorded / recording'); }
    if (!this.targets.length) { throw new Error('Undo has no target morphs'); }

    this.timestamp = Date.now();
    const morph = this.targets[0];

    this.recorder = morph.recordChangesStart(change => {
      const { target } = change;
      if (target.isUsedAsEpiMorph()) return false;
      if (!this.targets.some(undoTarget =>
        undoTarget === target || undoTarget.isAncestorOf(target))) return false;
      if (typeof filterFn === 'function') return filterFn(change);
      return true;
    });

    return this;
  }

  stopRecording () {
    const { name, recorder: { id, changes }, targets: [morph] } = this;
    this.changes = morph.recordChangesStop(id);
    this.targets = null;
    this.recorder = null;
  }

  apply () {
    if (!this.recorded()) { throw new Error('Cannot apply undo that has no changes recorded yet'); }
    this.changes.slice().forEach(change => change.apply());
    return this;
  }

  reverseApply () {
    if (!this.recorded()) { throw new Error('Cannot reverseApply undo that has no changes recorded yet'); }
    this.changes.slice().reverse().forEach(change => change.reverseApply());
    return this;
  }

  addTarget (t) { arr.pushIfNotIncluded(this.targets, t); }

  addUndos (undos) {
    undos = arr.sortBy(undos.concat(this).filter(ea => ea.recorded()), ({ no }) => no);
    if (!undos.length) return;
    this.changes = arr.flatmap(undos, ({ changes }) => changes);
    this.timestamp = undos[0].timestamp;
    this.no = undos[0].no;
    this.name = undos.map(({ name }) => name).join('-');
  }

  toString () {
    const { name, changes, no } = this;
    const isRecording = this.isRecording();
    const changesString = !changes.length
      ? 'no changes'
      : '\n  ' + changes.map(({ selector, args, prop, value, target }) =>
        selector
          ? `${target}.${selector}(${args.map(printArg)})`
          : `${target}.${prop} = ${printArg(value)}`).join('\n  ');
    return `Undo(${no}:${name} ${isRecording ? 'RECORDING ' : ''}${changesString})`;
  }
}

function printArg (x) {
  // short print
  return obj.inspect(x, { maxDepth: 1 }).replace(/\n/g, '').replace(/\s+/g, ' ');
}

export class UndoManager {
  constructor (optFilter) {
    this.reset();
    this.filter = optFilter;
  }

  reset () {
    this.undos = [];
    this.redos = [];
    this.undoInProgress = null;
    this.applyCount = 0;
    this.counter = 0;
    this.grouping = {
      current: [],
      debounce: null,
      debouncedCanceled: false,
      debounceTime: 31
    };
  }

  group (prevUndo = null) {
    this.groupLaterCancel();

    // If prevUndo is given, merge prevUndo and all newer undos into a single undo group
    if (prevUndo && this.undos.includes(prevUndo)) {
      this.grouping.current = arr.uniq(this.undos.slice(this.undos.indexOf(prevUndo))
        .concat(this.grouping.current));
    }

    if (!this.grouping.current.length) return;

    const grouped = this.grouping.current.slice(1);
    const undoGroup = this.grouping.current[0];
    undoGroup.addUndos(grouped);
    this.undos = arr.withoutAll(this.undos, grouped);
    this.grouping.current = [];
  }

  ensureNewGroup (morph, name = 'new undo group') {
    // puts currently ongoing undos into a group then creates and returns a new group
    this.group();
    this.undoStart(morph, name);
    return this.undoStop();
  }

  groupLaterCancel () {
    const state = this.grouping;
    if (!state.debounce) return;
    state.debouncedCanceled = true;
    this.grouping = { ...state, debounce: null, debouncedCanceled: false };
  }

  groupLater (time) {
    const state = this.grouping;
    (state.debounce || (state.debounce = fun.debounce(time || state.debounceTime, () => {
      state.debounce = null;
      state.debouncedCanceled || this.group();
    })))();
  }

  undoStart (morph, name) {
    if (this.applyCount) return;
    if (this.undoInProgress) {
      console.warn('There is already an undo recorded');
      return;
    }
    return this.undoInProgress = new Undo(name, [morph], this.counter++).startRecording(this.filter);
  }

  undoStop () {
    const undo = this.undoInProgress;
    if (!undo) return null;
    undo.stopRecording();
    this.undoInProgress = null;
    this.undos.push(undo);
    this.grouping.current.push(undo);
    if (this.redos.length) this.redos.length = 0;
    return undo;
  }

  removeLatestUndo () {
    this.undoStop();
    const undo = this.undos.pop();
    arr.remove(this.grouping.current, undo);
    return undo;
  }

  undo () {
    const undo = this.removeLatestUndo();
    if (!undo) return;
    arr.remove(this.grouping.current, undo);
    this.redos.unshift(undo);
    this.applyCount++;
    try { undo.reverseApply(); } finally { this.applyCount--; }
    return undo;
  }

  redo () {
    this.undoStop();
    const redo = this.redos.shift();
    if (!redo) return;
    this.undos.push(redo);
    this.applyCount++;
    try { redo.apply(); } finally { this.applyCount--; }
    return redo;
  }

  toString () {
    const undosPrinted = this.undos.length === 0
      ? ''
      : `\n  ${this.undos.length > 20 ? '...\n  ' : ''}${this.undos.slice(-20).join('\n  ')}`;
    const undoInProgress = !!this.undoInProgress;
    return `UndoManager(${this.undos.length} undos, ${this.redos.length} redos, ${undoInProgress ? ', UNDO IN PROGRESS' : ''}${undosPrinted})`;
  }
}
