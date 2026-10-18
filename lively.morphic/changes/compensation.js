import { SetMorphProperty, MoveMorph, ReplaceText } from './operations.js';
import { propertyEquals, readProperty, attachmentOf, attachmentsEqual } from './recovery.js';
import { composeTextOperations } from './text.js';
import { DomainEditOperation } from './domain-edit.js';

/** Numeric receipts disambiguate insertion/deletion's empty range endpoints. */
export function compensationTextLengths (changeSet, context) {
  const lengths = new Map();
  const size = value => value.reduce((sum, entry, index) => sum + (index % 2 ? 0 : typeof entry === 'string' ? entry.length : 1), 0);
  for (const operation of changeSet.operations) if (operation instanceof ReplaceText) {
    const id = operation.targetId;
    if (!lengths.has(id)) {
      const after = context.resolveMorph(id).textString.length;
      lengths.set(id, { before: after, after });
    }
    lengths.get(id).before -= size(operation.after) - size(operation.before);
  }
  return lengths;
}

/** Compare the first-before / last-after endpoints, never validate()'s target lookup. */
export function matchesCompensationEndpoint (changeSet, context, endpoint, textLengths) {
  const endpoints = new Map();
  const text = new Map();
  for (const operation of changeSet.operations) {
    if (operation instanceof ReplaceText) {
      if (!text.has(operation.targetId)) text.set(operation.targetId, []);
      text.get(operation.targetId).push(operation);
    } else {
      const key = operation instanceof DomainEditOperation ? operation.edit : `${operation.targetId}:${operation.kind}:${operation.property || ''}`;
      if (!endpoints.has(key) || endpoint === 'after') endpoints.set(key, operation);
    }
  }
  for (const operation of endpoints.values()) {
    if (operation instanceof DomainEditOperation) { if (!operation.matches(endpoint)) return false; else continue; }
    const target = context.resolveMorph(operation.targetId);
    if (!target) return false;
    if (operation instanceof SetMorphProperty) {
      if (!propertyEquals(readProperty(context, target, operation.property), operation[endpoint], operation)) return false;
    } else if (operation instanceof MoveMorph) {
      if (!attachmentsEqual(attachmentOf(target), operation[endpoint])) return false;
    } else return false;
  }
  for (const [id, operations] of text) {
    const target = context.resolveMorph(id);
    if (target.textString.length !== textLengths?.get(id)?.[endpoint]) return false;
    const composed = composeTextOperations(target, operations, endpoint);
    if (!context.textMatches(target, composed, endpoint)) return false;
  }
  return true;
}
