/*global WeakMap*/
import { arr, string } from "lively.lang";

function newKeyIn(obj, base = "_") {
  var i = 1, key;
  do {
    key = base + "-" + i++;
  } while (key in obj);
  return key;
}

function signalBindings(morph, name, value) {
  // optimized lively.bindings.signal
  var conns = morph.attributeConnections;
  if (!conns) return
  conns = conns.slice();
  for (var i = 0; i < conns.length; i++)
    if (conns[i].sourceAttrName === name)
      conns[i].update(value)
}

function informMorph(changeManager, change, morph) {
  try {
    morph.onChange(change);
    signalBindings(morph, "change", change);
    var owner = morph.owner;
    while (owner) {
      owner.onSubmorphChange(change, morph);
      owner = owner.owner;
    }
  } catch (err) {
    console.error(`Error in informMorph: ${err.stack}`)
  }
}

function informListeners(changeManager, change) {
  try {
    if (changeManager.changeListeners.length)
      changeManager.changeListeners.forEach(listener => listener(change));
  } catch (err) {
    console.error(`Error in informListeners: ${err.stack}`)
  }
}


class Change {
  constructor(target) {
    this.target = target;
    this.group = null;
  }
  get type() { return "abstract change" }
  apply() { throw new Error("Not yet implemented"); }
  reverseApply() { throw new Error("Not yet implemented"); }
}

export class GroupChange extends Change {
  constructor(target) {
    this.target = target;
    this.changes = [];
  }

  consumesChanges() { return true }

  addChange(c) {
    this.changes.push(c);
    c.group = this;
  }

  apply() {
    this.changes.slice().forEach(change => change.apply());
    return this;
  }

  reverseApply() {
    this.changes.slice().reverse().forEach(change => change.reverseApply());
    return this;
  }
}

export class ValueChange extends Change {

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

export class MethodCallChange extends GroupChange {

  get type() { return "method-call" }

  constructor(target, selector, args, undo) {
    this.changes = [];
    this.target = target;
    this.selector = selector;
    this.args = args;
    this.undo = undo;
  }

  apply() {
    var {target, selector, args} = this;
    target[selector].apply(target, args);
  }

  reverseApply() {
    if (!this.undo) return;
    if (typeof this.undo === "function") this.undo();
    else {
      var {target, selector, args} = this.undo;
      target[selector].apply(target, args);
    }
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

    this.changeGroupStack = [];
  }

  changesFor(morph) { return this.changes.filter(c => c.target === morph); }

  apply(change) { change.apply(); }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // interface for adding changes, used by morphs

  addValueChange(morph, prop, value, meta) {
    var change = new ValueChange(morph, prop, value, meta);
    return this._record(morph, change);
  }

  addMethodCallChangeDoing(spec, morph, doFn) {
    var {target, selector, args, undo} = spec;
    if (!undo) undo = () => console.warn(`No undo recorded for ${target}.${selector}`);
    var change = new MethodCallChange(target, selector, args, undo);
    morph.groupChangesWhile(change, doFn);
    return change;
  }

  _record(morph, change) {
    // FIXME
    if (change.hasOwnProperty("value")) {
      change.prevValue = morph._currentState[change.prop];
      morph._currentState[change.prop] = change.value;
    }

    morph.makeDirty();

    var grouping = arr.last(this.changeGroupStack);
    if (grouping && grouping.consumesChanges()) {
      grouping.addChange(change);
    } else {
      this.changes.push(change);
      morph._rev = ++this.revision;
      informListeners(this, change)
    }
    informMorph(this, change, morph);

    return change;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // group changes

  groupChangesWhile(targetMorph, groupChange = new GroupChange(targetMorph), whileFn) {
    this.changeGroupStack.push(groupChange);
    try {
      whileFn();
      arr.remove(this.changeGroupStack, groupChange);
      return this._record(targetMorph, groupChange);
    } catch (err) {
      arr.remove(this.changeGroupStack, groupChange);
      throw err;
    }
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // listen for changes / record changes

  recordChangesWhile(whileFn, optFilter) {
    var from = this.changes.length;
    whileFn();
    var changes = this.changes.slice(from, this.changes.length);
    return optFilter ? changes.filter(optFilter) : changes;
  }

  addChangeListener(listenFn) { arr.pushIfNotIncluded(this.changeListeners, listenFn); }
  removeChangeListener(listenFn) { arr.remove(this.changeListeners, listenFn); }

  recordChangesStart(optFilter, optName = "") {
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

  recordChangesStop(id) {
    if (!(id in this.changeRecorders)) return [];
    var {changes, listener} = this.changeRecorders[id];
    delete this.changeRecorders[id];
    this.removeChangeListener(listener);
    return changes;
  }

  recordChangesStartForMorph(morph, optFilter) {
    var recorder = this.recordChangesStart(optFilter, morph.id);

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

  recordChangesStopForMorph(morph, optId) {
    var perMorph = this.changeRecordersPerMorph.get(morph);
    if (!perMorph || !perMorph.length) {
      console.warn(`Cannot endMorphChangeRecorder for morph ${morph}: recorder not found`)
      return [];
    }

    var id = optId;
    if (!optId) id = perMorph.pop();
    else arr.remove(perMorph, id);

    return this.recordChangesStop(id);
  }

}
