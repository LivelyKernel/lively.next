import Document from '../text/document.js';
import { Range } from '../text/range.js';
import { eqPosition, lessPosition, minPosition, maxPosition } from '../text/position.js';
import { joinTextAttributes } from '../text/attributes.js';
import { ReplaceText, SetMorphProperty, cloneSnapshotContainers, snapshotContainersEqual } from './operations.js';
import { attachmentOf, attachmentsEqual } from './recovery.js';

/** Compare merged runs, including the document's canonical empty run. */
function canonical (value) { return joinTextAttributes(value.length ? value : ['', null]); }
/** Preserve embedded identity while comparing captured attribute containers. */
function equalText (left, right) { return snapshotContainersEqual(canonical(left), canonical(right)); }
/** Attribute objects are not text content. */
function embeddedMorphs (value) { return value.filter((entry, index) => index % 2 === 0 && entry?.isMorph); }

const textRecoveries = new WeakMap();

/** Observe the edit's boundary before its notifications, including a partial primitive. */
function replaceDocument (target, operation) {
  const document = target.document;
  const recovery = textRecoveries.get(operation);
  const endLine = document.getLine(operation.range.end.row);
  const followingLine = endLine.nextLine();
  const suffixLength = endLine.stringSize - 1 - operation.range.end.column;
  let result;
  try {
    result = document.replace(new Range(operation.range), cloneSnapshotContainers(operation.after), target.debug && target.debugHelper(target.debug));
  } finally {
    if (recovery) {
      try {
        // The following line and suffix are outside this edit, not document-length deltas.
        const row = followingLine ? followingLine.row - 1 : document.endPosition.row;
        if (followingLine && document.getLine(followingLine.row) !== followingLine) throw new Error('Text edit lost its untouched boundary');
        const insertedRange = result ? result.inserted : {
          start: operation.range.start,
          end: { row, column: document.getLine(row).stringSize - 1 - suffixLength }
        };
        if (lessPosition(insertedRange.end, insertedRange.start)) throw new Error('Text edit crossed its untouched suffix');
        recovery.appliedOperation = new ReplaceText({
          ...operation, insertedRange, after: document.textAndAttributesInRange(insertedRange)
        });
      } catch (error) { recovery.observationError = error; }
    }
  }
}

/** Recovery closures are scoped to the invocation, never retained by its operation. */
export function releaseTextRecovery (operation) { textRecoveries.delete(operation); }

/** Translate a position at an edit boundary; covering spans include both boundary sides. */
function mapPosition (position, range, insertedRange, end = false) {
  if (lessPosition(position, range.start)) return { ...position };
  if (lessPosition(range.end, position) || eqPosition(position, range.end)) {
    return position.row === range.end.row
      ? { row: insertedRange.end.row, column: insertedRange.end.column + position.column - range.end.column }
      : { row: insertedRange.end.row + position.row - range.end.row, column: position.column };
  }
  return { ...(end ? insertedRange.end : insertedRange.start) };
}

/** Compose only the covering span, retaining the exact content of untouched gaps. */
export function composeTextOperations (target, operations, endpoint = 'after') {
  let range;
  for (let index = 0; index < operations.length; index++) {
    const operation = operations[index];
    let start = operation.range.start; let end = operation.range.end;
    for (let prior = index - 1; prior >= 0; prior--) {
      const edit = operations[prior];
      start = mapPosition(start, edit.insertedRange, edit.range);
      end = mapPosition(end, edit.insertedRange, edit.range, true);
    }
    range = range
      ? { start: minPosition(range.start, start), end: maxPosition(range.end, end) }
      : { start, end };
  }
  let insertedRange = range;
  for (const operation of operations) insertedRange = {
    start: minPosition(insertedRange.start, operation.range.start),
    end: mapPosition(maxPosition(insertedRange.end, operation.range.end), operation.range, operation.insertedRange, true)
  };
  const start = range.start;
  const local = position => ({ row: position.row - start.row, column: position.column - (position.row === start.row ? start.column : 0) });
  const document = Document.fromString('');
  document.textAndAttributes = cloneSnapshotContainers(textInRange(target, endpoint === 'after' ? insertedRange : range));
  const observed = document.textAndAttributes;
  const edits = endpoint === 'after' ? operations.slice().reverse().map(operation => operation.invert()) : operations;
  for (const operation of edits) {
    const localRange = { start: local(operation.range.start), end: local(operation.range.end) };
    if (!equalText(document.textAndAttributesInRange(localRange), operation.before)) {
      throw new Error(`Precondition failed composing text ${target.id}`);
    }
    document.replace(localRange, cloneSnapshotContainers(operation.after));
  }
  const attachments = new Map();
  for (const operation of operations) for (const entry of operation.embedded) {
    const previous = attachments.get(entry.morphId);
    attachments.set(entry.morphId, { ...entry, before: previous ? previous.before : entry.before });
  }
  return new ReplaceText({
    ...operations[0], range, insertedRange,
    before: endpoint === 'after' ? document.textAndAttributes : observed,
    after: endpoint === 'after' ? observed : document.textAndAttributes,
    embedded: [...attachments.values()],
    attributesOnly: operations.every(operation => operation.attributesOnly),
    fullAssignment: operations.some(operation => operation.fullAssignment)
  });
}

/** The insertion-range rule used by Text.computeTextRangeForChanges. */
export function insertedTextRange (start, textAndAttributes) {
  let row = start.row; let column = start.column;
  for (let i = 0; i < textAndAttributes.length; i += 2) {
    const lines = (typeof textAndAttributes[i] === 'string' ? textAndAttributes[i] : '\ufffd').split('\n');
    if (lines.length > 1) { row += lines.length - 1; column = 0; }
    column += lines[lines.length - 1].length;
  }
  return { start: { ...start }, end: { row, column } };
}

/** Prepare both text endpoints before touching the live document. */
export function prepareTextEdit (target, range, value, { extendTextAttributes = false, attributesOnly = false, fullAssignment = false, invalidateTextLayout = true, consistencyCheck = true, metadata = {} } = {}) {
  const document = target.document;
  if (document) range = { start: document.clipPositionToLines(range.start), end: document.clipPositionToLines(range.end) };
  const before = document ? target.textAndAttributesInRange(range) : target.textAndAttributes;
  let after = typeof value === 'string' ? [value, null] : Array.isArray(value) ? value : [String(value || ''), null];
  after = cloneSnapshotContainers(after);
  if (extendTextAttributes) {
    const attr = target.textAttributeAt({ row: range.start.row, column: Math.max(0, range.start.column - 1) });
    if (attr) for (let i = 1; i < after.length; i += 2) after[i] = { ...attr, ...after[i] };
  }
  const embedded = [...new Set([...embeddedMorphs(before), ...embeddedMorphs(after)])]
    .map(morph => ({ morphId: morph.id, before: attachmentOf(morph), after: null }));
  return new ReplaceText({
    targetId: target.id, range, insertedRange: insertedTextRange(range.start, after),
    before: canonical(before), after: canonical(after), embedded, attributesOnly, fullAssignment, invalidateTextLayout, consistencyCheck, metadata
  });
}

/** Retain exact external ownership roots before a text edit can detach them. */
export function enlistTextMorphs (manager, frame, target, operation) {
  manager._enlistAtomicMorph(frame, target);
  for (const morph of new Set([...embeddedMorphs(operation.before), ...embeddedMorphs(operation.after)])) {
    manager._enlistAtomicMorph(frame, morph);
    if (morph.owner) manager._enlistAtomicMorph(frame, morph.owner);
  }
}

/** Static labels have only a whole-value text boundary. */
function textInRange (target, range) {
  return target.document ? target.textAndAttributesInRange(range) : target.textAndAttributes;
}

/** Follow the same document, anchor, selection and layout routines as Text.replace. */
export function applyTextEdit (target, operation, context, { recovering = false } = {}) {
  if (!recovering && !equalText(textInRange(target, operation.range), operation.before)) {
    throw new Error(`Precondition failed for text ${target.id}`);
  }
  if (!recovering) for (const entry of operation.embedded) {
    if (!attachmentsEqual(attachmentOf(context.resolveMorph(entry.morphId)), entry.before)) {
      throw new Error(`Precondition failed for embedded morph ${entry.morphId}`);
    }
  }
  const after = cloneSnapshotContainers(operation.after);
  if (!target.document && after.some(entry => entry?.isMorph || entry?.doit)) target.needsDocument = true;
  if (!target.document) {
    target.setProperty('textAndAttributes', after);
    target.renderingState.needsFit = true;
    return;
  }
  const range = new Range(operation.range);
  const insertedRange = new Range(operation.insertedRange);
  replaceDocument(target, operation);
  if (operation.invalidateTextLayout) {
    target.invalidateTextLayout(false, false);
    target.textLayout.resetLineCharBoundsCacheOfRange(target, insertedRange);
  }
  if (!operation.attributesOnly) {
    if (!eqPosition(range.end, insertedRange.end)) {
      const deleting = lessPosition(insertedRange.end, range.end);
      const [changed] = deleting ? range.subtract(insertedRange) : insertedRange.subtract(range);
      target.anchors.forEach(anchor => deleting ? anchor.onDelete(changed) : anchor.onInsert(changed));
      if (target.selectable) {
        if (target._multiSelection) target._multiSelection.updateFromAnchors();
        else if (target.getProperty('selection')) target.selection.updateFromAnchors();
      }
    }
    target._updateEmbeddedMorphsDuringReplace(embeddedMorphs(after), insertedRange, after, operation.before);
  } else target.onAttributesChanged(range);
  for (const entry of operation.embedded.slice().sort((a, b) => (a.after?.index || 0) - (b.after?.index || 0))) {
    if (!entry.after) continue; // First application captures the actual setter/layout result.
    const morph = context.resolveMorph(entry.morphId);
    if (!attachmentsEqual(attachmentOf(morph), entry.after)) context.moveMorph(morph, attachmentOf(morph), entry.after);
  }
  if (operation.fullAssignment) target.setProperty('textAndAttributes', after);
  if (operation.consistencyCheck) target.consistencyCheck();
}

/** Exact typed text state for source-unit verification. */
export function textOperationMatches (target, operation, endpoint, context) {
  const range = endpoint === 'before' ? operation.range : operation.insertedRange;
  return equalText(textInRange(target, range), operation[endpoint]) && operation.embedded.every(entry =>
    !entry[endpoint] || attachmentsEqual(attachmentOf(context.resolveMorph(entry.morphId)), entry[endpoint]));
}

/** Recovery keeps transient anchors, never an unrelated full-document snapshot. */
export function captureTextRecovery (target, operation, context) {
  const document = target.document;
  const textLayout = target.textLayout;
  const needsDocument = target.needsDocument;
  const renderingState = target.renderingState;
  const upgrading = Object.getOwnPropertyDescriptor(target, '_isUpgrading');
  const length = document?.stringSize;
  const before = cloneSnapshotContainers(textInRange(target, operation.range), true);
  const anchors = target.anchors.map(anchor => ({ anchor, position: { ...anchor.position } }));
  const embeddedMap = Array.from(target.embeddedMorphMap, ([morph, entry]) => [morph, { ...entry }]);
  const selectionState = target.getProperty('selection');
  const selection = target._multiSelection || selectionState;
  const selections = (selection?.isMultiSelection ? selection.selections : [selection]).filter(Boolean)
    .map(value => ({ value, range: value.range.copy(), reverse: value._isReverse, goalColumn: value._goalColumn, goalX: value._goalX }));
  const attachments = operation.embedded.map(entry => {
    const morph = context.resolveMorph(entry.morphId);
    return { morph, before: attachmentOf(morph) };
  });
  const stateMatches = () => target.document === document && (!document || document.stringSize === length) &&
    equalText(textInRange(target, operation.range), before) &&
    attachments.every(({ morph, before }) => attachmentsEqual(attachmentOf(morph), before)) &&
    target.anchors.length === anchors.length && anchors.every(({ anchor, position }, index) =>
      target.anchors[index] === anchor && eqPosition(anchor.position, position)) &&
    target.embeddedMorphMap.size === embeddedMap.length && embeddedMap.every(([morph, entry]) => target.embeddedMorphMap.get(morph)?.anchor === entry.anchor) &&
    selections.every(({ value, range, reverse }) => value.range.equals(range) && value._isReverse === reverse);
  const recovery = {
    operation,
    appliedOperation: null,
    restored: stateMatches,
    restore: () => {
      const applied = recovery.appliedOperation;
      if (applied) applyTextEdit(target, applied.invert(), context);
      recovery.restoreAuxiliary();
    },
    restoreAuxiliary: () => {
      if (!document && target.document) {
        target.setProperty('document', document);
        target.setProperty('textLayout', textLayout);
        target.setProperty('needsDocument', needsDocument);
        target.setProperty('selection', selectionState);
        target.setProperty('renderingState', renderingState);
        if (upgrading) Object.defineProperty(target, '_isUpgrading', upgrading);
        else delete target._isUpgrading;
      }
      // Restore anchor identities, not new anchors created by the inverse replacement.
      target.anchors.splice(0, target.anchors.length, ...anchors.map(({ anchor }) => anchor));
      for (const { anchor, position } of anchors) anchor._position = { ...position };
      target.embeddedMorphMap.clear();
      for (const [morph, entry] of embeddedMap) target.embeddedMorphMap.set(morph, { ...entry });
      for (const { value, range, reverse, goalColumn, goalX } of selections) {
        value._range = range; value._isReverse = reverse; value._goalColumn = goalColumn; value._goalX = goalX;
      }
      for (const { morph, before } of attachments.slice().sort((a, b) => (a.before.index || 0) - (b.before.index || 0))) {
        if (!attachmentsEqual(attachmentOf(morph), before)) context.moveMorph(morph, attachmentOf(morph), before);
      }
    }
  };
  textRecoveries.set(operation, recovery);
  return recovery;
}

/** Full endpoints exist only while an interested committed consumer needs them. */
export function semanticTextOperations (operations, context) {
  const text = new Map();
  for (const operation of operations) {
    if (!(operation instanceof ReplaceText)) continue;
    let entry = text.get(operation.targetId);
    if (!entry) text.set(operation.targetId, (entry = []));
    entry.push(operation);
  }
  const views = new Map();
  for (const [id, edits] of text) {
    const after = context.resolveMorph(id).textAndAttributes;
    const document = Document.fromString('');
    document.textAndAttributes = cloneSnapshotContainers(after);
    for (const operation of edits.slice().reverse()) document.replace(operation.insertedRange, cloneSnapshotContainers(operation.before));
    const before = document.textAndAttributes;
    views.set(id, new SetMorphProperty({
      targetId: id, property: 'textAndAttributes', before, after,
      metadata: { ...edits[0].metadata, prevTextAndAttributes: before, acceptAlreadyApplied: true, textReplacement: true }
    }));
  }
  const emitted = new Set();
  return operations.flatMap(operation => {
    if (!(operation instanceof ReplaceText)) return [operation];
    if (emitted.has(operation.targetId)) return [];
    emitted.add(operation.targetId);
    return [views.get(operation.targetId)];
  });
}

/** Same insertion-range merge and inverse order used by computeTextRangeForChanges. */
export function textReplayFor (operations) {
  const ids = [...new Set(operations.filter(operation => operation instanceof ReplaceText).map(operation => operation.targetId))];
  return cloneSnapshotContainers(ids.map(targetId => {
    const edits = operations.filter(operation => operation instanceof ReplaceText && operation.targetId === targetId);
    const merged = ranges => ranges.slice(1).reduce((result, range) => result.merge(new Range(range)), new Range(ranges[0])).toLiteral();
    return { targetId, undoRange: merged(edits.slice().reverse().map(operation => operation.range)), redoRange: merged(edits.map(operation => operation.insertedRange)) };
  }), true);
}
