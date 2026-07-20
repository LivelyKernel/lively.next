import {
  MorphicAttachmentKind,
  MorphicOperationKind
} from 'lively.morphic/changes/index.js';
import { MorphicChangeSet } from 'lively.morphic/changes/change-set.js';

export const ComponentBridgeCommandKind = Object.freeze({
  SET_PROPERTY: 'set-property',
  SET_MASTER: 'set-master',
  EDIT_TEXT: 'edit-text',
  RENAME_NODE: 'rename-node',
  INTRODUCE_NODE: 'introduce-node',
  REMOVE_NODE: 'remove-node',
  MOVE_NODE: 'move-node'
});

export const ComponentBridgeDiagnosticKind = Object.freeze({
  UNSUPPORTED_OPERATION: 'unsupported-operation',
  PROVENANCE_REQUIRED: 'provenance-required'
});

const projectionOrigins = new Set(['runtime-projection', 'source-projection']);

function setPropertyCommand (componentId, operation, origin) {
  if (operation.property === 'name') {
    return Object.freeze({
      kind: ComponentBridgeCommandKind.RENAME_NODE,
      componentId,
      expectedRevision: null,
      nodeId: operation.targetId,
      previousName: operation.before,
      name: operation.after,
      origin,
      sourceOperation: operation
    });
  }
  if (operation.property === 'textAndAttributes') {
    return Object.freeze({
      kind: ComponentBridgeCommandKind.EDIT_TEXT,
      componentId,
      expectedRevision: null,
      nodeId: operation.targetId,
      previousValue: operation.before,
      value: operation.after,
      origin,
      sourceOperation: operation
    });
  }
  if (operation.property === 'master') {
    return Object.freeze({
      kind: ComponentBridgeCommandKind.SET_MASTER,
      componentId,
      expectedRevision: null,
      nodeId: operation.targetId,
      previousValue: operation.before,
      value: operation.after,
      origin,
      sourceOperation: operation
    });
  }
  return Object.freeze({
    kind: ComponentBridgeCommandKind.SET_PROPERTY,
    componentId,
    expectedRevision: null,
    nodeId: operation.targetId,
    property: operation.property,
    previousValue: operation.before,
    value: operation.after,
    origin,
    sourceOperation: operation
  });
}

function moveCommand (componentId, operation, origin) {
  const { from, to } = operation;
  if (from.kind === MorphicAttachmentKind.DETACHED &&
      to.kind === MorphicAttachmentKind.ATTACHED) {
    return Object.freeze({
      kind: ComponentBridgeCommandKind.INTRODUCE_NODE,
      componentId,
      expectedRevision: null,
      nodeId: operation.morphId,
      parentId: to.ownerId,
      index: to.index,
      origin,
      sourceOperation: operation
    });
  }
  if (from.kind === MorphicAttachmentKind.ATTACHED &&
      to.kind === MorphicAttachmentKind.DETACHED) {
    return Object.freeze({
      kind: ComponentBridgeCommandKind.REMOVE_NODE,
      componentId,
      expectedRevision: null,
      nodeId: operation.morphId,
      parentId: from.ownerId,
      index: from.index,
      origin,
      sourceOperation: operation
    });
  }
  return Object.freeze({
    kind: ComponentBridgeCommandKind.MOVE_NODE,
    componentId,
    expectedRevision: null,
    nodeId: operation.morphId,
    previousParentId: from.ownerId,
    previousIndex: from.index,
    parentId: to.ownerId,
    index: to.index,
    origin,
    sourceOperation: operation
  });
}

function morphsFor (operation, context) {
  const ids = [operation.targetId];
  if (operation.kind === MorphicOperationKind.MOVE_MORPH) {
    if (operation.from.ownerId) ids.push(operation.from.ownerId);
    if (operation.to.ownerId) ids.push(operation.to.ownerId);
  }
  return ids.map(id => context.resolveMorph?.(id)).filter(Boolean);
}

export class MorphicChangeSetAdapter {
  constructor ({
    componentId,
    containsMorph = () => true,
    ignoreOperation = () => false
  }) {
    if (typeof componentId !== 'string' || !componentId) {
      throw new Error('MorphicChangeSetAdapter requires a componentId');
    }
    this.componentId = componentId;
    this.containsMorph = containsMorph;
    this.ignoreOperation = ignoreOperation;
  }

  adapt (changeSet, context = {}) {
    if (!(changeSet instanceof MorphicChangeSet)) {
      throw new Error('MorphicChangeSetAdapter can only adapt MorphicChangeSets');
    }
    if (projectionOrigins.has(changeSet.origin)) {
      return Object.freeze({
        commands: Object.freeze([]),
        diagnostics: Object.freeze([]),
        ignoredProjection: true
      });
    }

    const commands = [];
    const diagnostics = [];
    changeSet.operations.forEach(operation => {
      if (this.ignoreOperation(operation, context)) return;
      if (!morphsFor(operation, context).some(this.containsMorph)) return;
      if (operation.kind === MorphicOperationKind.SET_MORPH_PROPERTY) {
        commands.push(setPropertyCommand(this.componentId, operation, changeSet.origin));
        return;
      }
      if (operation.kind === MorphicOperationKind.MOVE_MORPH) {
        commands.push(moveCommand(this.componentId, operation, changeSet.origin));
        return;
      }
      diagnostics.push(Object.freeze({
        kind: ComponentBridgeDiagnosticKind.UNSUPPORTED_OPERATION,
        operationKind: operation.kind
      }));
    });

    return Object.freeze({
      commands: Object.freeze(commands),
      diagnostics: Object.freeze(diagnostics),
      ignoredProjection: false
    });
  }
}
