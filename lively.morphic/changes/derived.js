import { SetMorphProperty, MoveMorph, ReplaceText, cloneSnapshotContainers } from './operations.js';
import { propertyEquals, readProperty, attachmentOf, attachmentsEqual } from './recovery.js';
import { composeTextOperations } from './text.js';
import { Anchor } from '../text/anchors.js';
import { Range } from '../text/range.js';
import { eqPosition, lessPosition } from '../text/position.js';

// Only numeric parent links survive the journal; history never retains recovery closures.
const derivations = new WeakMap();

/** Coalescing preserves causality only when both journals have the same parent links. */
export function sameDerivations (left, right) {
  const a = derivations.get(left); const b = derivations.get(right);
  return left.operations.every((_, index) => (a?.[index] ?? -1) === (b?.[index] ?? -1));
}

/** Retain the immutable parent indices when continuous scalar endpoints merge. */
export function copyDerivations (from, to) {
  const parents = derivations.get(from);
  if (parents) derivations.set(to, parents);
}

/** Convert transient recovery references into immutable operation indices for history. */
export function rememberDerivations (changeSet, entries) {
  const indices = new Map(entries.map((entry, index) => [entry, index]));
  const parents = entries.map(entry => {
    let parent = entry.derivedFrom;
    while (parent && !indices.has(parent)) parent = parent.derivedFrom;
    return parent ? indices.get(parent) : -1;
  });
  derivations.set(changeSet, Object.freeze(parents));
}

/** Group each source and its reactions without changing their recorded order. */
export function journalUnits (entries) {
  const nodes = new Map(entries.map((entry, order) => [entry, { entry, order, children: [] }]));
  const roots = [];
  for (const node of nodes.values()) {
    const parent = nodes.get(node.entry.derivedFrom);
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

/** Reconstruct source units from a captured change set's numeric parent links. */
export function changeSetUnits (changeSet) {
  const parents = derivations.get(changeSet) || [];
  const entries = changeSet.operations.map(operation => ({ operation }));
  entries.forEach((entry, index) => { entry.derivedFrom = entries[parents[index]]; });
  return journalUnits(entries);
}

/** Keep the original journal order, including reactions nested between sibling writes. */
function leaves (unit) {
  const nodes = node => [node, ...node.children.flatMap(nodes)];
  return nodes(unit).sort((a, b) => a.order - b.order).map(node => node.entry);
}
/** Repeated writes share one unit target. */
function keyOf (operation) { return `${operation.targetId}:${operation.kind}:${operation.property || ''}`; }
/** Restore a fresh snapshot value under the operation's captured policy. */
function materialized (operation, endpoint) {
  return operation.valueSemantics === 'snapshot'
    ? operation.materializeValue(cloneSnapshotContainers(operation[endpoint])) : operation[endpoint];
}

/** Preserve the existing per-edit anchor rules when a covering span is repaired. */
function replayAnchorTargets (target, operations, direction) {
  const anchors = target.anchors.map(anchor => {
    const copy = new Anchor(anchor.id, { ...anchor.position }, anchor.insertBehavior);
    return { anchor, copy };
  });
  const edits = direction === 'forward' ? operations : operations.slice().reverse().map(operation => operation.invert());
  for (const operation of edits) {
    if (operation.attributesOnly || eqPosition(operation.range.end, operation.insertedRange.end)) continue;
    const range = new Range(operation.range); const inserted = new Range(operation.insertedRange);
    const deleting = lessPosition(inserted.end, range.end);
    const [changed] = deleting ? range.subtract(inserted) : inserted.subtract(range);
    for (const { copy } of anchors) deleting ? copy.onDelete(changed) : copy.onInsert(changed);
  }
  return anchors;
}

/** A text unit reconciles all its ranges, including replay-created ranges, together. */
function textUnitTarget (entries, context, direction, recovering, replayOnly = false) {
  const operation = entries[0].operation;
  const target = context.resolveMorph(operation.targetId);
  const operations = entries.map(entry => recovering ? entry.appliedOperation : entry.operation).filter(Boolean);
  const composed = operations.length ? composeTextOperations(target, operations, direction === 'forward' ? 'before' : 'after') : null;
  const initialLength = target.textString.length;
  const size = value => value.reduce((sum, entry, index) => sum + (index % 2 ? 0 : typeof entry === 'string' ? entry.length : 1), 0);
  const delta = operations.reduce((sum, edit) => sum + size(edit.after) - size(edit.before), 0);
  const length = initialLength + (direction === 'forward' ? delta : -delta);
  const anchors = recovering ? null : replayAnchorTargets(target, operations, direction);
  const prefix = replayOnly ? [] : direction === 'forward' ? operations.slice().reverse().map(edit => edit.invert()) : operations;
  const repairFor = journal => {
    const replayed = journal.entries.filter(entry => entry.operation instanceof ReplaceText && entry.operation.targetId === target.id)
      .map(entry => entry.appliedOperation).filter(Boolean);
    const edits = [...prefix, ...replayed];
    return edits.length ? composeTextOperations(target, edits).invert() : null;
  };
  const restoreAnchors = () => {
    if (recovering) return entries[0].restoreAuxiliary();
    for (const { anchor, copy } of anchors) anchor._position = { ...copy.position };
    const selection = target._multiSelection || target.getProperty('selection');
    selection?.updateFromAnchors();
  };
  return {
    operation, composed, text: true, restoreAnchors,
    matches: journal => {
      const edit = repairFor(journal);
      return target.textString.length === length && (!edit || context.textMatches(target, edit, 'after'));
    },
    repair: (manager, journal) => {
      const edit = repairFor(journal);
      if (edit) manager._perform(manager._atomicFrame, edit);
    },
    verifyAnchors: () => recovering ? entries[0].restored()
      : anchors.every(({ anchor, copy }) => eqPosition(anchor.position, copy.position))
  };
}

/** One source invocation, one repair pass, then verification under captured policies. */
export function reconcileSourceUnit (manager, unit, context, direction, invoke, { recovering = false } = {}) {
  const original = leaves(unit);
  const targets = new Map();
  const textEntries = new Map();
  for (const entry of original) if (entry.operation instanceof ReplaceText) {
    const id = entry.operation.targetId;
    if (!textEntries.has(id)) textEntries.set(id, []);
    textEntries.get(id).push(entry);
  }
  for (const entries of textEntries.values()) targets.set(keyOf(entries[0].operation), textUnitTarget(entries, context, direction, recovering));
  for (const { operation } of original) {
    if (operation instanceof ReplaceText) continue;
    const key = keyOf(operation);
    // A repeated derived property has one first-before / last-after endpoint.
    if (!targets.has(key) || direction === 'forward') targets.set(key, {
      operation, endpoint: direction === 'forward' ? 'after' : 'before'
    });
  }
  const root = manager._atomicFrame.root;
  const previous = root.unitJournal;
  const journal = {
    entries: [],
    policyFor: operation => targets.get(keyOf(operation))?.operation
  };
  root.unitJournal = journal;
  let cursor = 0;
  const ingest = () => {
    for (; cursor < journal.entries.length; cursor++) {
      const { operation } = journal.entries[cursor];
      const key = keyOf(operation);
      // Extra replay-created properties return to their pre-unit values.
      if (!targets.has(key)) targets.set(key, operation instanceof ReplaceText
        ? textUnitTarget(journal.entries.filter(entry => entry.operation instanceof ReplaceText && keyOf(entry.operation) === key), context, 'reverse', true, true)
        : { operation, endpoint: 'before' });
    }
  };
  const matches = entry => {
    if (entry.text) return entry.matches(journal);
    const { operation, endpoint } = entry;
    if (recovering && operation === unit.entry.operation) return unit.entry.restored();
    const target = context.resolveMorph(operation.targetId);
    if (operation instanceof SetMorphProperty) {
      return propertyEquals(readProperty(context, target, operation.property), operation[endpoint], operation);
    }
    if (operation instanceof MoveMorph) return attachmentsEqual(attachmentOf(target), operation[endpoint]);
    return context.textMatches(target, operation, endpoint);
  };
  const repair = entry => {
    if (entry.text) return entry.repair(manager, journal);
    const { operation, endpoint } = entry;
    if (recovering && operation === unit.entry.operation) return invoke();
    const target = context.resolveMorph(operation.targetId);
    let edit;
    if (operation instanceof SetMorphProperty) {
      edit = new SetMorphProperty({
        ...operation, before: readProperty(context, target, operation.property), after: materialized(operation, endpoint)
      });
    } else if (operation instanceof MoveMorph) {
      edit = new MoveMorph({ morphId: operation.morphId, from: attachmentOf(target), to: operation[endpoint], metadata: operation.metadata });
    } else {
      // Partial document writes are restored by the pre-effect text recovery receipt.
      if (recovering && unit.entry.operation === operation) return;
      edit = endpoint === 'before' ? operation.invert() : operation;
    }
    manager._perform(manager._atomicFrame, edit);
  };
  const diagnostics = [];
  const diagnostic = (operation, error) => {
    if (!diagnostics.some(pair => pair.operation === operation)) diagnostics.push({ operation, error });
  };
  for (const entry of original) if (entry.observationError) diagnostic(entry.operation, entry.observationError);
  try {
    let restored = false;
    if (recovering) {
      try { restored = unit.entry.restored(); } catch (error) { diagnostic(unit.entry.operation, error); }
    }
    const source = targets.get(keyOf(unit.entry.operation));
    const replacement = source?.text && source.composed
      ? direction === 'forward' ? source.composed : source.composed.invert() : null;
    try { if (!restored) invoke(replacement); } catch (error) {
      if (!recovering) throw error;
      diagnostic(unit.entry.operation, error);
    }
    ingest();
    // Repair once; additional effects from repairs are journaled and verified below.
    for (const target of [...targets.values()]) {
      let matched = false;
      try { matched = matches(target); } catch (error) { diagnostic(target.operation, error); }
      try { if (!matched) repair(target); } catch (error) {
        if (!recovering) throw error;
        diagnostic(target.operation, error);
      }
      ingest();
    }
    for (const target of targets.values()) if (target.text) {
      try { target.restoreAnchors(); } catch (error) { diagnostic(target.operation, error); }
    }
    const offending = [];
    for (const target of targets.values()) {
      let restored = false;
      try { restored = matches(target) && (!target.text || target.verifyAnchors()); } catch (error) { diagnostic(target.operation, error); }
      if (!restored) offending.push(target.operation);
    }
    const keys = new Set(offending.map(keyOf));
    const reactionOperations = journal.entries.filter(entry => entry.derivedFrom && keys.has(keyOf(entry.operation)))
      .map(entry => entry.operation);
    const unreversedOperations = [...new Set([...offending, ...reactionOperations])];
    return {
      diagnostics,
      unreversedOperations,
      rollbackErrors: unreversedOperations.map(operation => {
        const pair = diagnostics.find(pair => pair.operation === operation);
        return { operation, error: pair ? pair.error : new Error('Source-unit reaction did not converge to its target') };
      })
    };
  } finally { root.unitJournal = previous; }
}
