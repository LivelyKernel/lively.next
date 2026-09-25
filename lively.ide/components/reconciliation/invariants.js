import {
  ComponentDocument,
  ComponentNodeProvenanceKind
} from './component-document.js';

export const ComponentInvariantKind = Object.freeze({
  DUPLICATE_NODE_ID: 'duplicate-node-id',
  DUPLICATE_SIBLING_NAME: 'duplicate-sibling-name',
  INVALID_ORDERING_REFERENCE: 'invalid-ordering-reference',
  INVALID_ROOT_PROVENANCE: 'invalid-root-provenance'
});

export class ComponentDocumentInvariantError extends Error {
  constructor (diagnostics) {
    const message = diagnostics.map(diagnostic => diagnostic.message).join('; ');
    super(message);
    this.name = 'ComponentDocumentInvariantError';
    this.message = message;
    this.diagnostics = diagnostics;
  }
}

export function validateComponentDocument (document) {
  if (!(document instanceof ComponentDocument)) {
    throw new Error('Can only validate a ComponentDocument');
  }
  const diagnostics = [];
  const ids = new Set();
  const visit = (node, isRoot = false) => {
    if (ids.has(node.id)) {
      diagnostics.push(Object.freeze({
        kind: ComponentInvariantKind.DUPLICATE_NODE_ID,
        nodeId: node.id,
        message: `Duplicate component node ID: ${node.id}`
      }));
    }
    ids.add(node.id);
    if (isRoot && node.provenance.kind === ComponentNodeProvenanceKind.INHERITED) {
      diagnostics.push(Object.freeze({
        kind: ComponentInvariantKind.INVALID_ROOT_PROVENANCE,
        nodeId: node.id,
        message: 'A component root cannot be inherited'
      }));
    }

    const siblingNames = new Set();
    const siblingIds = new Set(node.children.map(child => child.id));
    node.children.forEach(child => {
      if (siblingNames.has(child.name)) {
        diagnostics.push(Object.freeze({
          kind: ComponentInvariantKind.DUPLICATE_SIBLING_NAME,
          nodeId: child.id,
          parentId: node.id,
          message: `Duplicate sibling name ${child.name} below ${node.id}`
        }));
      }
      siblingNames.add(child.name);
      const beforeId = child.provenance.beforeId;
      if (beforeId !== undefined && beforeId !== null &&
          (beforeId === child.id || !siblingIds.has(beforeId))) {
        diagnostics.push(Object.freeze({
          kind: ComponentInvariantKind.INVALID_ORDERING_REFERENCE,
          nodeId: child.id,
          beforeId,
          message: `Invalid ordering reference ${beforeId} on ${child.id}`
        }));
      }
      visit(child);
    });
  };
  visit(document.root, true);
  return Object.freeze(diagnostics);
}

export function assertComponentDocument (document) {
  const diagnostics = validateComponentDocument(document);
  if (diagnostics.length) throw new ComponentDocumentInvariantError(diagnostics);
  return document;
}
