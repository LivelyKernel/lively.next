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

  record(morph, change) {
    if (!change.target) change.target = morph;
    if (!change.owner) change.owner = morph.owner;
    if (!change.type) change.type = "setter";
    if (change.hasOwnProperty("value")) morph._currentState[change.prop] = change.value;
    change.tags = arr.uniq(this.activeTags);
    this.changes.push(change);
    morph._rev = ++this.revision;
    morph.makeDirty();

    signalChange(change, morph);

    return change;
  }

  apply(morph, change) {
    // can be used from the outside, e.g. to replay changes
    var {target, type, prop, value, receiver, selector, args} = change;

    if (target !== morph)
      throw new Error(`change applied to ${morph} which is not the target of the change ${target}`);

    if (type === "setter") {
      morph.recordChange(change);
    } else if (type === "method-call") {
      receiver[selector].apply(receiver, args);
    } else {
      throw new Error(`Strange change of type ${type}, cannot apply it! ${obj.inspect(change, {maxDepth: 1})}`);
    }
  }

}


export class UndoManager {

  constructor() {
    this.undos = [];
    this.redos = [];
    this.undoInProgress = null;
  }

  undoStart(morph, name) {

  }

  undoStop(morph, name) {

  }

}