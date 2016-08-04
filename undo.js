// import { obj, arr, events } from "lively.lang";

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
    return this.undoInProgress = {
      id: morph.startRecordChanges(({target}) => morph === target || morph.isAncestorOf(target)),
      name, changes: []
    };
  }

  undoStop(morph, name) {
    if (!this.undoInProgress) return;
    if (this.redos.length) this.redos.length = 0;
    var {id, name, changes} = this.undoInProgress;
    this.undos.push(this.undoInProgress);
    delete this.undoInProgress
    changes.push(...morph.stopRecordChanges(id));
    return name;
  }

  undo() {
    var undo = this.undos.pop();
    if (!undo) return;
    undo.changes.slice().reverse().forEach(change => change.reverseApply());
    this.redos.unshift(undo);
  }

  redo() {
    var redo = this.redos.shift();
    if (!redo) return;
    redo.changes.slice().reverse().forEach(change => change.apply());
    this.undos.push(redo);
  }
}
