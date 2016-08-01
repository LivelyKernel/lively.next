import { obj } from "lively.lang";

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
    this.activeTagsCopy = [];
  }

  tagWhile(morph, tags, duringFn) {
    var idx = this.activeTags.length;
    this.activeTags.push(...tags);
    this.activeTagsCopy = this.activeTags.slice();
    try {
      return duringFn.call(morph);
    } finally {
      this.activeTags.splice(idx, this.activeTags.length-idx);
      this.activeTagsCopy = this.activeTags.slice();
      console.log(this.activeTagsCopy.join(" - "))
    }
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

}  changesFor(morph) {
    return this.changes.filter(c => c.target === morph);
  }

  changesWhile(whileFn) {
    var from = this.changes.length;
    whileFn();
    return this.changes.slice(from, this.changes.length);
  }
