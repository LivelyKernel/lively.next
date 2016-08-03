import { obj, arr } from "lively.lang";

function signalChange(change, morph) {

  // if (!morph.isHand)
  //   console.log(`[change] ${morph._rev} ${change.target.id.slice(0,7)}.${change.prop} -> ${String(change.value).slice(0,100)}`);

  try {
    morph.onChange(change);

    var owner = morph.owner;
    while (owner) {
      owner.onSubmorphChange(change, morph);
      owner = owner.owner;
    }
  } catch (err) {
    console.error(`Error signaling morph change: ${err.stack}`)
  }
}


class Change {
  apply() { throw new Error("Not yet implemented"); }
  reverseApply() { throw new Error("Not yet implemented"); }
}

export class ValueChange {
  
  get type() { return "setter" }

  constructor(target, prop, value, meta, tags = []) {
    this.target = target;
    this.prop = prop;
    this.value = value;
    this.prevValue = null;
    this.meta = meta;
    this.tags = tags;
  }

  apply() {
    var {target, prop, value} = this;
    target[prop] = value;
  }

  reverseApply() {
    var {target, prop, prevValue} = this;
    target[prop] = prevValue;
  }
}

export class MethodCallChange {
  
  get type() { return "method-call" }

  constructor(target, receiver, selector, args, prop, value, meta, tags = []) {
    this.target = target;
    this.receiver = receiver;
    this.selector = selector;
    this.args = args;
    this.prop = prop;
    this.value = value;
    this.prevValue = null;
    this.meta = meta;
    this.tags = tags;
  }

  apply() {
    var {target, receiver, selector, args} = this;
    receiver[selector].apply(receiver, args);
  }

  reverseApply() {
    var {target, prop, prevValue} = this;
    target[prop] = prevValue;
  }

}


export class ChangeRecorder {

  constructor() {
    this.reset();
  }

  reset() {
    this.changes = [];
    this.revision = 0;
    this.activeTags = [];
    this.taggings = {};
    this.taggingsPerMorph = new WeakMap();
  }

  changesFor(morph) {
    return this.changes.filter(c => c.target === morph);
  }

  changesWhile(whileFn) {
    var from = this.changes.length;
    whileFn();
    return this.changes.slice(from, this.changes.length);
  }

  tagWhile(morph, tags, whileFn) {
    var id = this.tagStart(morph, tags);
    try {
      return this.changesWhile(whileFn);
    } finally {
      this.tagEnd(morph, id);
    }
  }

  tagStart(morph, tags) {
    var baseId = "tagging__" + morph.id + "__" + Date.now(), id;
    var i = 1; do {
      id = baseId + "-" + i++;
    } while (id in this.taggings)

    this.taggings[id] = {tags, startRev: this.revision};
    var perMorph = this.taggingsPerMorph.get(morph);
    if (!perMorph) perMorph = [id]; else perMorph.push(id);
    this.taggingsPerMorph.set(morph, perMorph);
    this.activeTags.push(...tags);
    return id;
  }

  tagEnd(morph, optId) {
    var perMorph = this.taggingsPerMorph.get(morph);
    if (!perMorph || !perMorph.length) {
      console.warn(`Cannot tagEnd for morph ${morph}: tagging data not found`)
      return [];
    }

    var id = optId;
    if (!optId) id = perMorph.pop();
    else arr.remove(perMorph, id);


    if (!this.taggings[id]) return [];
    var {tags, startRev} = this.taggings[id];
    delete this.taggings[id];

    // efficiently remove tags belonging to this tagging, not don't remove duplicates!
    for (var i = this.activeTags.length - 1; i >= 0; i--) {
      var tagIdx = tags.findIndex(t => this.activeTags[i] === t);
      if (tagIdx !== -1) {
        this.activeTags.splice(i, 1);
        tags.splice(tagIdx, 1);
      }
      if (!tags.length) break;
    }

    return this.changes.slice(startRev);
  }

  recordValueChange(morph, prop, value, meta) {
    var change = new ValueChange(morph, prop, value, meta, arr.uniq(this.activeTags));
    return this._record(morph, change);
  }

  recordMethodCallChange(morph, receiver, selector, args, prop, value, meta) {
    var change = new MethodCallChange(morph, receiver, selector, args, prop, value, meta, arr.uniq(this.activeTags));
    return this._record(morph, change);
  }

  _record(morph, change) {
    // FIXME
    if (change.hasOwnProperty("value")) {
      change.prevValue = morph._currentState[change.prop];
      morph._currentState[change.prop] = change.value;
    }
    this.changes.push(change);
    morph._rev = ++this.revision;
    morph.makeDirty();
    signalChange(change, morph);
    return change;
  }

  apply(change) { change.apply(); }

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
    return this.undoInProgress = {
      id: morph.tagChangesStart([`undo-${name}`]),
      name, changes: []
    };
  }

  undoStop(morph, name) {
    if (!this.undoInProgress) return
    var {id, name, changes} = this.undoInProgress;
    this.undos.push(this.undoInProgress);
    delete this.undoInProgress
    changes.push(...morph.tagChangesEnd(id));
    return name;
  }

  undo() {
    var undo = this.undos.pop();
    if (!undo) return;
    
  }
}