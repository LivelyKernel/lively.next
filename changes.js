import { arr, string } from "lively.lang";

function newKeyIn(obj, base = "_") {
  var i = 1, key;
  do {
    key = base + "-" + i++;
  } while (key in obj);
  return key;
}

function signalChange(changeManager, change, morph) {

  // if (!morph.isHand)
  //   console.log(`[change] ${morph._rev} ${change.target.id.slice(0,7)}.${change.prop} -> ${String(change.value).slice(0,100)}`);

  try {
    if (changeManager.changeListeners.length)
      changeManager.changeListeners.forEach(listener => listener(change));

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

  constructor(target, prop, value, meta) {
    this.target = target;
    this.prop = prop;
    this.value = value;
    this.prevValue = null;
    this.meta = meta;
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

  constructor(target, receiver, selector, args, prop, value, meta) {
    this.target = target;
    this.receiver = receiver;
    this.selector = selector;
    this.args = args;
    this.prop = prop;
    this.value = value;
    this.prevValue = null;
    this.meta = meta;
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


export class ChangeManager {

  constructor() {
    this.reset();
  }

  reset() {
    this.changes = [];
    this.revision = 0;

    this.changeListeners = [];
    this.changeRecordersPerMorph = new WeakMap();
    this.changeRecorders = {};
  }

  changesFor(morph) { return this.changes.filter(c => c.target === morph); }

  apply(change) { change.apply(); }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // interface for adding changes, used by morphs

  addValueChange(morph, prop, value, meta) {
    var change = new ValueChange(morph, prop, value, meta);
    return this._record(morph, change);
  }

  addMethodCallChange(morph, receiver, selector, args, prop, value, meta) {
    var change = new MethodCallChange(morph, receiver, selector, args, prop, value, meta);
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
    signalChange(this, change, morph);

    return change;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // listen for changes / record changes

  changesWhile(whileFn, optFilter) {
    var from = this.changes.length;
    whileFn();
    var changes = this.changes.slice(from, this.changes.length);
    return optFilter ? changes.filter(optFilter) : changes;
  }

  addChangeListener(listenFn) { arr.pushIfNotIncluded(this.changeListeners, listenFn); }
  removeChangeListener(listenFn) { arr.remove(this.changeListeners, listenFn); }

  startRecordingChanges(optFilter, optName = "") {
    // change recorder is a change listener that is identified by id

    // Recorder object to be used to record specific changes when they occur,
    // based on change listeners
    var id = newKeyIn(this.changeRecorders, optName + "__change_recorder_" + Date.now()),
        listener = optFilter ?
          change => optFilter(change) && recorder.changes.push(change) :
          change => recorder.changes.push(change),
        recorder = this.changeRecorders[id] = {id, filter: optFilter, changes: [], listener};

    this.addChangeListener(listener);

    return recorder;
  }

  stopChangeRecorder(id) {
    if (!(id in this.changeRecorders)) return [];
    var {changes, listener} = this.changeRecorders[id];
    delete this.changeRecorders[id];
    this.removeChangeListener(listener);
    return changes;
  }

  startMorphChangeRecorder(morph, optFilter) {
    var recorder = this.startRecordingChanges(optFilter, morph.id);

    // store recorder alongside morph for easy lookup and
    // to make it easy to just start / stop recordings
    // without having to manage listener storage and its lifetime

    var perMorph = this.changeRecordersPerMorph.get(morph);
    if (!perMorph) {
      perMorph = [];
      this.changeRecordersPerMorph.set(morph, perMorph);
    }
    perMorph.push(recorder.id);

    return recorder;
  }

  stopMorphChangeRecorder(morph, optId) {
    var perMorph = this.changeRecordersPerMorph.get(morph);
    if (!perMorph || !perMorph.length) {
      console.warn(`Cannot endMorphChangeRecorder for morph ${morph}: recorder not found`)
      return [];
    }

    var id = optId;
    if (!optId) id = perMorph.pop();
    else arr.remove(perMorph, id);

    return this.stopChangeRecorder(id);
  }

}
