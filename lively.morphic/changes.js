/* eslint-disable no-console */
/* global WeakMap */
import { arr, obj } from 'lively.lang';
import { signal } from 'lively.bindings';
import { MorphicChangeSet } from './changes/change-set.js';
import { MorphicReplayDirection } from './changes/manager.js';
import {
  MorphicAttachmentKind,
  MorphicValueSemantics,
  MoveMorph,
  SetMorphProperty,
  attachedMorph,
  detachedMorph
} from './changes/operations.js';

function isPromise (value) {
  return value && typeof value.then === 'function';
}

function leafChangesOf (change) {
  return change.changes?.length
    ? change.changes.flatMap(leafChangesOf)
    : [change];
}

function committedChangeContext (changes, committedChange = null) {
  const targets = new Map();
  changes.forEach(change => {
    const candidates = [
      change.target,
      change.morph,
      ...(change.owners || []),
      ...(change.args || []).filter(arg => arg?.isMorph)
    ];
    candidates.forEach(target => {
      while (target) {
        if (target.id) targets.set(target.id, target);
        target = target.owner;
      }
    });
  });
  return Object.freeze({
    legacyChanges: Object.freeze(changes.slice()),
    committedChange,
    resolveMorph: id => targets.get(id)
  });
}

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

  constructor (target, prop, value, meta, valuePolicy = {}) {
    super(target);
    const prevValue = target._morphicState[prop];
    this.prop = prop;
    this.value = value;
    this.prevValue = prevValue;
    this.meta = meta;
    this.operation = new SetMorphProperty({
      targetId: target.id,
      property: prop,
      before: prevValue,
      after: value,
      metadata: meta,
      ...valuePolicy
    });
  }

  operationContext () {
    const { target } = this;
    return {
      resolveMorph: id => id === target.id ? target : null,
      setMorphProperty: (resolvedTarget, property, value) => {
        if (property in resolvedTarget) resolvedTarget[property] = value;
        else resolvedTarget.setProperty(property, value);
      },
      // Legacy undo has no conflict handling. Preserve that behavior while
      // exposing exact preconditions to the transaction kernel.
      checkPreconditions: false
    };
  }

  applyOperation (operation, replayDirection) {
    const { target, meta } = this;
    const replayMeta = replayDirection
      ? {
          ...meta,
          originalOrigin: meta.origin,
          origin: replayDirection,
          replayDirection
        }
      : meta;
    return target.withMetaDo(replayMeta, () => operation.apply(this.operationContext()));
  }

  apply () {
    this.applyOperation(this.operation, MorphicReplayDirection.REDO);
  }

  reverseApply () {
    this.applyOperation(this.operation.invert(), MorphicReplayDirection.UNDO);
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
    target.withMetaDo({
      ...this.meta,
      originalOrigin: this.meta.origin,
      origin: MorphicReplayDirection.REDO,
      replayDirection: MorphicReplayDirection.REDO
    }, () => target[selector].apply(target, args));
  }

  reverseApply () {
    if (!this.undo) return;
    this.target.withMetaDo({
      ...this.meta,
      originalOrigin: this.meta.origin,
      origin: MorphicReplayDirection.UNDO,
      replayDirection: MorphicReplayDirection.UNDO
    }, () => {
      if (typeof this.undo === 'function') this.undo();
      else {
        const { target, selector, args } = this.undo;
        target[selector].apply(target, args);
      }
    });
  }
}

function morphAttachment (morph) {
  const owner = morph.owner;
  return owner
    ? attachedMorph({
        ownerId: owner.id,
        index: owner.submorphs.indexOf(morph),
        transform: morph.getTransform().copy()
      })
    : detachedMorph();
}

export class StructuralChange extends Change {
  get type () { return 'method-call'; }

  constructor ({ target, morph, selector, args, operation, owners, meta }) {
    super(target);
    this.morph = morph;
    this.selector = selector;
    this.args = args;
    this.operation = operation;
    this.owners = owners;
    this.meta = meta;
  }

  operationContext () {
    const { morph, owners } = this;
    const targets = new Map([[morph.id, morph]]);
    owners.forEach(owner => owner && targets.set(owner.id, owner));
    return {
      resolveMorph: id => targets.get(id),
      validateMoveMorph: (movedMorph, from, to) => {
        const actual = morphAttachment(movedMorph);
        if (actual.kind !== from.kind ||
            actual.ownerId !== from.ownerId ||
            actual.index !== from.index) {
          throw new Error(`Stale structural change for ${movedMorph.id}`);
        }
        if (to.kind === MorphicAttachmentKind.ATTACHED) {
          const owner = targets.get(to.ownerId);
          if (movedMorph === owner || movedMorph.isAncestorOf(owner)) {
            throw new Error('MoveMorph cannot create an ownership cycle');
          }
        }
      },
      moveMorph: (movedMorph, from, to) => {
        if (to.kind === MorphicAttachmentKind.DETACHED) {
          movedMorph.remove();
          return;
        }
        const owner = targets.get(to.ownerId);
        let insertionIndex = to.index;
        const currentIndex = owner.submorphs.indexOf(movedMorph);
        if (currentIndex > -1 && currentIndex < insertionIndex) insertionIndex++;
        owner.addMorphAt(movedMorph, insertionIndex);
        const transform = to.transform;
        if (transform && !obj.equals(movedMorph.getTransform(), transform)) {
          movedMorph.dontRecordChangesWhile(() => movedMorph.setTransform(transform.copy()));
        }
      }
    };
  }

  applyOperation (operation, replayDirection) {
    const replayMeta = {
      ...this.meta,
      originalOrigin: this.meta.origin,
      origin: replayDirection,
      replayDirection
    };
    return this.target.withMetaDo(replayMeta, () => operation.apply(this.operationContext()));
  }

  apply () { this.applyOperation(this.operation, MorphicReplayDirection.REDO); }
  reverseApply () {
    this.applyOperation(this.operation.invert(), MorphicReplayDirection.UNDO);
  }
}

export class ChangeManager {
  constructor () {
    this.reset();
  }

  reset () {
    this.changes = [];
    this.changeRecordedListeners = [];
    this.committedChangeListeners = [];
    this.revision = 0;
    this.commitCounter = 0;

    this.changeRecordersPerMorph = new WeakMap();
    this.changeRecorders = {};

    this.changeGroupStack = [];
    this.defaultMeta = {};
    this.metaStack = [];
    this.propertyValuePolicies = new Map();
  }

  changesFor (morph) { return this.changes.filter(c => c.target === morph); }

  apply (target, change) { change.apply(); }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // interface for adding changes, used by morphs

  doWithValueChangeMeta (meta, morph, doFn) {
    this.defaultMeta = { ...arr.last(this.metaStack), ...meta };
    this.metaStack.push(meta);
    let res;
    try {
      res = doFn(morph);
      if (isPromise(res)) {
        throw new Error('withMetaDo callbacks must be synchronous');
      }
    } finally {
      this.metaStack.pop();
      this.defaultMeta = arr.last(this.metaStack) || {};
    }
    return res;
  }

  addValueChange (morph, prop, value, meta) {
    const valuePolicy = this.propertyValuePolicies.get(prop) || {};
    const change = new ValueChange(
      morph,
      prop,
      value,
      { ...this.defaultMeta, ...meta },
      valuePolicy
    );
    return this._record(morph, change);
  }

  setPropertyValuePolicy (property, policy = {}) {
    if (typeof property !== 'string' || !property) {
      throw new Error('Property value policies require a property name');
    }
    if (!policy || typeof policy !== 'object') {
      throw new Error('Property value policies require a policy object');
    }
    if (policy.valueSemantics &&
        !Object.values(MorphicValueSemantics).includes(policy.valueSemantics)) {
      throw new Error(`Unknown morphic property value semantics: ${policy.valueSemantics}`);
    }
    this.propertyValuePolicies.set(property, Object.freeze({ ...policy }));
    return this;
  }

  removePropertyValuePolicy (property) {
    this.propertyValuePolicies.delete(property);
    return this;
  }

  addMethodCallChangeDoing (spec, morph, doFn) {
    let { target, selector, args, undo, meta = {} } = spec;
    if (!undo) undo = () => console.warn(`No undo recorded for ${target}.${selector}`);
    const change = new MethodCallChange(target, selector, args, undo, { ...this.defaultMeta, ...meta });
    morph.groupChangesWhile(change, doFn);
    return change;
  }

  addStructuralChangeDoing (spec, targetMorph, doFn) {
    const { morph, selector, args, meta = {} } = spec;
    const fromOwner = morph.owner;
    const from = morphAttachment(morph);
    this.dontRecordChangesWhile(targetMorph, doFn);
    const toOwner = morph.owner;
    const to = morphAttachment(morph);
    const changeMeta = { ...this.defaultMeta, ...meta };
    const operation = new MoveMorph({
      morphId: morph.id,
      from,
      to,
      metadata: changeMeta
    });
    const change = new StructuralChange({
      target: targetMorph,
      morph,
      selector,
      args,
      operation,
      owners: [fromOwner, toOwner],
      meta: changeMeta
    });
    return this._record(targetMorph, change);
  }

  _record (morph, change) {
    // FIXME
    signal(this, 'changeRecorded', change);
    if (change.hasOwnProperty('value')) {
      morph._morphicState[change.prop] = change.value;
    }

    const isDocumentChange = change.prevValue?.isDocument ||
     change.value?.isDocument ||
     change.selector === 'replace';
    const isUpdatingChange = !obj.equals(change.prevValue, change.value);
    // calling `makeDirty` on `Text` leads to a remeasure of the text.
    // In the case that we are just scrolling a statically rendered text, we do not need this.
    // Actually, it is harmful, since this will rehang our node, thus resetting the scroll position of the node
    // and resulting in an endless loop which shows visible jiggle of text.
    const isScrollChange = change.prop === 'scroll';
    const isStaticText = !morph.document;
    const skipRender = this.defaultMeta.skipRender;
    const scrollingStaticText = isStaticText && isScrollChange;

    if ((isDocumentChange || isUpdatingChange) && !scrollingStaticText && !skipRender) morph.makeDirty();

    const grouping = arr.last(this.changeGroupStack);
    if (grouping && grouping.consumesChanges()) {
      grouping.addChange(change);
    } else {
      this.changes.push(change);
      morph._rev = ++this.revision;
      this.informChangeListeners(change);
      this.informCommittedChangeListeners(change);
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

  addCommittedChangeListener (listenFn) {
    arr.pushIfNotIncluded(this.committedChangeListeners, listenFn);
    return listenFn;
  }

  removeCommittedChangeListener (listenFn) {
    arr.remove(this.committedChangeListeners, listenFn);
  }

  removeChangeListener (listenFn) {
    arr.remove(this.changeRecordedListeners, listenFn);
  }

  informChangeListeners (change) {
    // optimized version if lively.binings.signal
    this.changeRecordedListeners.forEach(fn => fn(change));
  }

  informCommittedChangeListeners (change) {
    const legacyChanges = leafChangesOf(change);
    const normalizedTextReplacement = change.selector === 'replace' &&
      change.target?.isText &&
      change.meta?.partOfTextAndAttributesAssignment !== true &&
      Array.isArray(change.meta?.prevTextAndAttributes);
    let operations = legacyChanges
      .map(legacyChange => legacyChange.operation)
      .filter(Boolean);
    if (normalizedTextReplacement) {
      operations = [new SetMorphProperty({
        targetId: change.target.id,
        property: 'textAndAttributes',
        before: change.meta.prevTextAndAttributes,
        after: change.target.textAndAttributes,
        metadata: {
          ...change.meta,
          acceptAlreadyApplied: true,
          textReplacement: true
        }
      })];
    }
    if (!operations.length) return null;
    const meta = { ...(change.meta || operations[0].metadata) };
    const changeSet = new MorphicChangeSet({
      id: `legacy-morphic-change-${this.commitCounter++}`,
      label: change.selector || change.prop || change.type,
      origin: meta.origin || 'user',
      undoable: meta.undoable !== false,
      operations,
      metadata: meta
    });
    const context = committedChangeContext(
      normalizedTextReplacement
        ? [change]
        : legacyChanges,
      change
    );
    this.committedChangeListeners.slice().forEach(listener => listener(changeSet, context));
    return changeSet;
  }

  recordChangesStart (optFilter, optName = '') {
    // change recorder is a change listener that is identified by id

    // Recorder object to be used to record specific changes when they occur,
    // based on change listeners
    const id = obj.newKeyIn(this.changeRecorders, optName + '__change_recorder_' + Date.now());
    const listener = optFilter
      ? change => optFilter(change) && recorder.changes.push(change) // eslint-disable-line no-use-before-define
      : change => recorder.changes.push(change); // eslint-disable-line no-use-before-define
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
