import { obj, arr, events, fun } from "lively.lang";

class Undo {

  constructor(name, targets = [], no = 0) {
    this.name = name;
    this.targets = targets;
    this.recorder = null;
    this.changes = null;
    this.timestamp = null;
    this.no = no;
  }

  recorded() { return !!this.changes; }
  isRecording() { return !!this.recorder; }

  startRecording() {
    if (this.recorded() || this.isRecording())
      throw new Error("Undo already recorded / recording");
    if (!this.targets.length)
      throw new Error("Undo has no target morphs");

    this.timestamp = Date.now();
    var morph = this.targets[0];
    this.recorder = morph.recordChangesStart(({target}) =>
      !target.isUsedAsEpiMorph() && this.targets.some(undoTarget =>
        undoTarget === target || undoTarget.isAncestorOf(target)));

    return this;
  }

  stopRecording() {
    var {name, recorder: {id, changes}, targets: [morph]} = this;
    this.changes = morph.recordChangesStop(id);
    this.targets = null;
    this.recorder = null;
  }

  apply() {
    if (!this.recorded())
      throw new Error("Cannot apply undo that has no changes recorded yet");
    this.changes.slice().forEach(change => change.apply());
    return this;
  }

  reverseApply() {
    if (!this.recorded())
      throw new Error("Cannot reverseApply undo that has no changes recorded yet");
    this.changes.slice().reverse().forEach(change => change.reverseApply());
    return this;
  }

  addTarget(t) { arr.pushIfNotIncluded(this.targets, t); }

  addUndos(undos) {
    undos = arr.sortBy(undos.concat(this).filter(ea => ea.recorded()), ({no}) => no);
    if (!undos.length) return;
    this.changes = arr.flatmap(undos, ({changes}) => changes);
    this.timestamp = undos[0].timestamp;
    this.no = undos[0].no;
    this.name = undos.map(({name}) => name).join("-");
  }
}


export class UndoManager {

  constructor() {
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
    }
  }

  group(prevUndo = null) {
    this.groupLaterCancel();

    // If prevUndo is given, merge prevUndo and all newer undos into a single undo group
    if (prevUndo && this.undos.includes(prevUndo))
      this.grouping.current = this.undos.slice(this.undos.indexOf(prevUndo))
        .concat(this.grouping.current)

    if (!this.grouping.current.length) return;

    var grouped = this.grouping.current.slice(1),
        undoGroup = this.grouping.current[0];
    undoGroup.addUndos(grouped);
    this.undos = arr.withoutAll(this.undos, grouped);
    this.grouping.current = [];
  }

  ensureNewGroup(morph, name = "new undo group") {
    // puts currently ongoing undos into a group then creates and returns a new group
    this.group();
    this.undoStart(morph, name);
    return this.undoStop();
  }

  groupLaterCancel() {
    var state = this.grouping;
    if (!state.debounce) return;
    state.debouncedCanceled = true;
    this.grouping = {current: state.current, debounce: null, debouncedCanceled: false};
  }

  groupLater(time) {
    var state = this.grouping;
    (state.debounce || (state.debounce = fun.debounce(time || state.debounceTime, () => {
      state.debounce = null;
      state.debouncedCanceled || this.group();
    })))();
  }

  undoStart(morph, name) {
    if (this.applyCount) return;
    if (this.undoInProgress) {
      console.warn(`There is already an undo recorded`)
      return;
    }
    return this.undoInProgress = new Undo(name, [morph], this.counter++).startRecording();
  }

  undoStop() {
    var undo = this.undoInProgress;
    if (!undo) return null;
    undo.stopRecording();
    this.undoInProgress = null;
    this.undos.push(undo);
    this.grouping.current.push(undo);
    if (this.redos.length) this.redos.length = 0;
    return undo;
  }

  undo() {
    this.undoStop();
    var undo = this.undos.pop();
    if (!undo) return;
    arr.remove(this.grouping.current, undo);
    this.redos.unshift(undo);
    this.applyCount++;
    try { undo.reverseApply(); }
    finally { this.applyCount--; }
    return undo;
  }

  redo() {
    this.undoStop();
    var redo = this.redos.shift();
    if (!redo) return;
    this.undos.push(redo);
    this.applyCount++;
    try { redo.apply(); }
    finally { this.applyCount--; }
    return redo;
  }
}
