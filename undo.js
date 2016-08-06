import { obj, arr, events } from "lively.lang";

class Undo {

  constructor(name, targets = []) {
    this.name = name;
    this.targets = targets;
    this.recorder = null;
    this.changes = null;
  }

  startRecording() {
    if (this.recorder) {
      throw new Error("Undo already recorded / recording");
    }
    if (!this.targets.length) {
      throw new Error("Undo has no target morphs");
    }
    var morph = this.targets[0];
    this.recorder = morph.recordChangesStart(({target}) =>
      !target.isUsedAsEpiMorph() && this.targets.some(undoTarget =>
        undoTarget === target || undoTarget.isAncestorOf(target)));
    return this;
  }

  stopRecording() {
    var {name, recorder: {id, changes}, targets: [morph]} = this;
    changes.push(...morph.recordChangesStop(id));
    this.changes = changes;
  }

  apply() {
    this.changes.slice().forEach(change => change.apply());
    return this;
  }

  reverseApply() {
    this.changes.slice().reverse().forEach(change => change.reverseApply());
    return this;
  }

  addTarget(t) { arr.pushIfNotIncluded(this.targets, t); }
}


export class UndoManager {

  constructor() {
    this.undos = [];
    this.redos = [];
    this.undoInProgress = null;
  }

  undoStart(morph, name) {
    if (this.undoInProgress) {
      console.warn(`There is already an undo recorded`)
      return;
    }
    return this.undoInProgress = new Undo(name, [morph]).startRecording();
  }

  undoStop() {
    var undo = this.undoInProgress;
    if (!undo) return null;
    undo.stopRecording();
    this.undoInProgress = null;
    this.undos.push(undo);
    if (this.redos.length) this.redos.length = 0;
    return undo;
  }

  undo() {
    var undo = this.undos.pop();
    if (!undo) return;
    this.redos.unshift(undo);
    return undo.reverseApply();
  }

  redo() {
    var redo = this.redos.shift();
    if (!redo) return;
    this.undos.push(redo);
    return redo.apply();
  }
}
