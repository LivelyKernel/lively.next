/* global WeakMap */
import { arr, obj } from 'lively.lang';
import { signal } from 'lively.bindings';

function signalBindings (obj, name, change) {
  // optimized lively.bindings.signal
  let conns = obj.attributeConnections;
  if (!conns) return;
  conns = conns.slice();
  for (let i = 0; i < conns.length; i++) {
    if (conns[i].sourceAttrName === name) { conns[i].update(change); }
  }
}

function informMorph (changeManager, change, morph) {
  try {
    morph.onChange(change);
    signalBindings(morph, 'change', change);
    let owner = morph.owner;
    while (owner) {
      owner.onSubmorphChange(change, morph);
      owner = owner.owner;
    }
  } catch (err) {
    console.error(`Error in informMorph: ${err.stack}`);
  }
}

class Change {
  constructor (target) {
    this.target = target;
    this.group = null;
  }

  get type () { return 'abstract change'; }
  apply () { throw new Error('Not yet implemented'); }
  reverseApply () { throw new Error('Not yet implemented'); }
}

export class GroupChange extends Change {
  constructor (target) {
    super(target);
    this.changes = [];
  }

  consumesChanges () { return true; }

  addChange (c) {
    this.changes.push(c);
    c.group = this;
  }

  apply () {
    this.changes.slice().forEach(change => change.apply());
    return this;
  }

  reverseApply () {
    this.changes.slice().reverse().forEach(change => change.reverseApply());
    return this;
  }
}

export class ValueChange extends Change {
  get type () { return 'setter'; }

  constructor (target, prop, value, meta) {
    super(target);
    this.prop = prop;
    this.value = value;
    this.prevValue = null;
    this.meta = meta;
  }

  apply () {
    const { target, prop, value } = this;
    target[prop] = value;
  }

  reverseApply () {
    const { target, prop, prevValue } = this;
    target[prop] = prevValue;
  }
}

export class MethodCallChange extends GroupChange {
  get type () { return 'method-call'; }

  constructor (target, selector, args, undo, meta) {
    super(target);
    this.selector = selector;
    this.args = args;
    this.undo = undo;
    this.meta = meta;
  }

  apply () {
    const { target, selector, args } = this;
    target[selector].apply(target, args);
  }

  reverseApply () {
    if (!this.undo) return;
    if (typeof this.undo === 'function') this.undo();
    else {
      const { target, selector, args } = this.undo;
      target[selector].apply(target, args);
    }
  }
}

export class ChangeManager {
  constructor () {
    this.reset();
  }

  reset () {
    this.changes = [];
    this.changeRecordedListeners = [];
    this.revision = 0;

    this.changeRecordersPerMorph = new WeakMap();
    this.changeRecorders = {};

    this.changeGroupStack = [];
    this.defaultMeta = {};
    this.metaStack = [];
  }

  changesFor (morph) { return this.changes.filter(c => c.target === morph); }

  apply (target, change) { change.apply(); }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // interface for adding changes, used by morphs

  doWithValueChangeMeta (meta, morph, doFn) {
    this.defaultMeta = meta;
    this.metaStack.push(meta);
    let res;
    try {
      res = doFn(morph);
    } finally {
      this.metaStack.pop();
      this.defaultMeta = arr.last(this.metaStack) || {};
      return res;
    }
  }

  addValueChange (morph, prop, value, meta) {
    const change = new ValueChange(morph, prop, value, { ...this.defaultMeta, ...meta });
    return this._record(morph, change);
  }

  addMethodCallChangeDoing (spec, morph, doFn) {
    let { target, selector, args, undo } = spec;
    if (!undo) undo = () => console.warn(`No undo recorded for ${target}.${selector}`);
    const change = new MethodCallChange(target, selector, args, undo, this.defaultMeta);
    morph.groupChangesWhile(change, doFn);
    return change;
  }

  _record (morph, change) {
    // FIXME
    signal(this, 'changeRecorded', change);
    if (change.hasOwnProperty('value')) {
      change.prevValue = morph._morphicState[change.prop];
      morph._morphicState[change.prop] = change.value;
    }

    // FIXME
    // Hack for transitioning between the bundles loading screen and the live world with new rendering, morph creation, etc.
    if (!morph.renderingState) {
      morph.remove();
      return;
    }

    // This is a hack since Scrubbers otherwise get caught up in a loop
    // when trying to compare their document properties
    // which is circular
    if ( change.prevValue && change.prevValue.isDocument ||
      change.value && change.value.isDocument ||
      !obj.equals(change.prevValue,change.value)
      ) morph.makeDirty();

    const grouping = arr.last(this.changeGroupStack);
    if (grouping && grouping.consumesChanges()) {
      grouping.addChange(change);
    } else {
      this.changes.push(change);
      morph._rev = ++this.revision;
      this.informChangeListeners(change);
    }
    informMorph(this, change, morph);

    return change;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // group changes

  groupChangesWhile (targetMorph, groupChange, whileFn, record = true) {
    if (!groupChange) groupChange = new GroupChange(targetMorph);
    this.changeGroupStack.push(groupChange);
    try {
      whileFn();
      arr.remove(this.changeGroupStack, groupChange);
      return record ? this._record(targetMorph, groupChange) : groupChange;
    } catch (err) {
      arr.remove(this.changeGroupStack, groupChange);
      throw err;
    }
  }

  dontRecordChangesWhile (targetMorph, whileFn) {
    return this.groupChangesWhile(targetMorph, undefined, whileFn, false);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // listen for changes / record changes

  recordChangesWhile (whileFn, optFilter) {
    const from = this.changes.length;
    whileFn();
    const changes = this.changes.slice(from, this.changes.length);
    return optFilter ? changes.filter(optFilter) : changes;
  }

  addChangeListener (listenFn) {
    arr.pushIfNotIncluded(this.changeRecordedListeners, listenFn);
  }

  removeChangeListener (listenFn) {
    arr.remove(this.changeRecordedListeners, listenFn);
  }

  informChangeListeners (change) {
    // optimized version if lively.binings.signal
    this.changeRecordedListeners.forEach(fn => fn(change));
  }

  recordChangesStart (optFilter, optName = '') {
    // change recorder is a change listener that is identified by id

    // Recorder object to be used to record specific changes when they occur,
    // based on change listeners
    const id = obj.newKeyIn(this.changeRecorders, optName + '__change_recorder_' + Date.now());
    const listener = optFilter
      ? change => optFilter(change) && recorder.changes.push(change)
      : change => recorder.changes.push(change);
    let recorder = this.changeRecorders[id] = { id, filter: optFilter, changes: [], listener };

    this.addChangeListener(listener);

    return recorder;
  }

  recordChangesStop (id) {
    if (!(id in this.changeRecorders)) return [];
    const { changes, listener } = this.changeRecorders[id];
    delete this.changeRecorders[id];
    this.removeChangeListener(listener);
    return changes;
  }

  recordChangesStartForMorph (morph, optFilter) {
    const recorder = this.recordChangesStart(optFilter, morph.id);

    // store recorder alongside morph for easy lookup and
    // to make it easy to just start / stop recordings
    // without having to manage listener storage and its lifetime

    let perMorph = this.changeRecordersPerMorph.get(morph);
    if (!perMorph) {
      perMorph = [];
      this.changeRecordersPerMorph.set(morph, perMorph);
    }
    perMorph.push(recorder.id);

    return recorder;
  }

  recordChangesStopForMorph (morph, optId) {
    const perMorph = this.changeRecordersPerMorph.get(morph);
    if (!perMorph || !perMorph.length) {
      console.warn(`Cannot endMorphChangeRecorder for morph ${morph}: recorder not found`);
      return [];
    }

    let id = optId;
    if (!optId) id = perMorph.pop();
    else arr.remove(perMorph, id);

    return this.recordChangesStop(id);
  }
}
