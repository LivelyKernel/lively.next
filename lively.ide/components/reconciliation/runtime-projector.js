import {
  MoveMorph,
  MorphicChangeSet,
  SetMorphProperty,
  attachedMorph,
  detachedMorph
} from 'lively.morphic/changes/index.js';
import {
  ComponentDocument,
  ComponentPropertyKind,
  findComponentNode
} from './component-document.js';
import { ComponentSemanticDeltaKind } from './reducer.js';

export const ComponentRuntimeProjectionDiagnosticKind = Object.freeze({
  UNSUPPORTED_DELTA: 'unsupported-delta',
  RUNTIME_TARGET_UNRESOLVED: 'runtime-target-unresolved',
  RUNTIME_VALUE_UNAVAILABLE: 'runtime-value-unavailable'
});

function diagnostic (kind, message, details = {}) {
  return Object.freeze({ kind, message, ...details });
}

function unavailableValue () {
  return Object.freeze({ available: false });
}

function explicitEntryValue (entry) {
  return entry?.kind === ComponentPropertyKind.EXPLICIT_VALUE
    ? Object.freeze({ available: true, value: entry.value })
    : unavailableValue();
}

function resolvedRuntimeValue (resolveRuntimeValue, spec, fallbackEntry) {
  const resolved = resolveRuntimeValue?.(spec);
  if (resolved?.available) return Object.freeze({ available: true, value: resolved.value });
  return explicitEntryValue(fallbackEntry);
}

function unsupportedResult (diagnostics) {
  return Object.freeze({
    supported: false,
    changeSet: null,
    inverseChangeSet: null,
    diagnostics: Object.freeze(diagnostics)
  });
}

export function projectComponentRuntime ({
  beforeDocument,
  reduction,
  changeSetId,
  resolveRuntimeTargetId = nodeId => nodeId,
  resolveRuntimeValue,
  runtimeRename = null,
  resolveRuntimeLayout
}) {
  if (!(beforeDocument instanceof ComponentDocument)) {
    throw new Error('Runtime projection requires the previous ComponentDocument');
  }
  if (!(reduction?.document instanceof ComponentDocument)) {
    throw new Error('Runtime projection requires a component reduction result');
  }
  if (typeof changeSetId !== 'string' || !changeSetId) {
    throw new Error('Runtime projection requires a changeSetId');
  }

  const { semanticDelta } = reduction;
  const diagnostics = [];
  const layoutProjection = [
    ComponentSemanticDeltaKind.NODE_RENAMED,
    ComponentSemanticDeltaKind.NODE_REMOVED,
    ComponentSemanticDeltaKind.NODE_MOVED
  ].includes(semanticDelta.kind)
    ? resolveRuntimeLayout?.(Object.freeze({
        semanticDelta,
        beforeDocument,
        afterDocument: reduction.document
      })) || null
    : null;
  if (layoutProjection && (
    typeof layoutProjection.ownerId !== 'string' || !layoutProjection.ownerId ||
    !Object.prototype.hasOwnProperty.call(layoutProjection, 'before') ||
    !Object.prototype.hasOwnProperty.call(layoutProjection, 'after')
  )) {
    return unsupportedResult([diagnostic(
      ComponentRuntimeProjectionDiagnosticKind.RUNTIME_VALUE_UNAVAILABLE,
      'Runtime owner layout projection is incomplete',
      { nodeId: semanticDelta.nodeId }
    )]);
  }
  const withLayoutOperation = operation => {
    if (!layoutProjection) return [operation];
    return [operation, new SetMorphProperty({
      targetId: layoutProjection.ownerId,
      property: 'layout',
      before: layoutProjection.before,
      after: layoutProjection.after,
      metadata: {
        origin: 'runtime-projection',
        reconcileChanges: false,
        componentId: beforeDocument.componentId,
        fromRevision: beforeDocument.revision,
        toRevision: reduction.document.revision,
        semanticDeltaKind: semanticDelta.kind,
        applyWhenAdopting: layoutProjection.applyWhenAdopting === true
      }
    })];
  };
  const withRuntimeRename = operations => runtimeRename
    ? [new SetMorphProperty({
        targetId: resolveRuntimeTargetId(semanticDelta.nodeId),
        property: 'name',
        before: runtimeRename.before,
        after: runtimeRename.after,
        metadata: {
          origin: 'runtime-projection',
          reconcileChanges: false,
          componentId: beforeDocument.componentId,
          fromRevision: beforeDocument.revision,
          toRevision: reduction.document.revision,
          semanticDeltaKind: semanticDelta.kind,
          applyWhenAdopting: true
        }
      }), ...operations]
    : operations;
  const runtimeTargetId = resolveRuntimeTargetId(semanticDelta.nodeId);
  if (typeof runtimeTargetId !== 'string' || !runtimeTargetId) {
    diagnostics.push(diagnostic(
      ComponentRuntimeProjectionDiagnosticKind.RUNTIME_TARGET_UNRESOLVED,
      `No runtime target is available for component node ${semanticDelta.nodeId}`,
      { nodeId: semanticDelta.nodeId }
    ));
    return unsupportedResult(diagnostics);
  }

  if (semanticDelta.kind === ComponentSemanticDeltaKind.NODE_INTRODUCED) {
    const runtimeParentId = resolveRuntimeTargetId(semanticDelta.parentId);
    if (typeof runtimeParentId !== 'string' || !runtimeParentId) {
      return unsupportedResult([diagnostic(
        ComponentRuntimeProjectionDiagnosticKind.RUNTIME_TARGET_UNRESOLVED,
        `No runtime parent is available for component node ${semanticDelta.parentId}`,
        { nodeId: semanticDelta.parentId }
      )]);
    }
    const operation = new MoveMorph({
      morphId: runtimeTargetId,
      from: detachedMorph(),
      to: attachedMorph({
        ownerId: runtimeParentId,
        index: semanticDelta.runtimeIndex ?? semanticDelta.index
      }),
      metadata: {
        origin: 'runtime-projection',
        reconcileChanges: false,
        componentId: beforeDocument.componentId,
        fromRevision: beforeDocument.revision,
        toRevision: reduction.document.revision,
        semanticDeltaKind: semanticDelta.kind
      }
    });
    const changeSet = new MorphicChangeSet({
      id: changeSetId,
      label: 'project component node introduction',
      origin: 'runtime-projection',
      undoable: false,
      operations: withRuntimeRename(withLayoutOperation(operation)),
      metadata: operation.metadata
    });
    return Object.freeze({
      supported: true,
      changeSet,
      inverseChangeSet: changeSet.invert({
        id: `${changeSetId}:inverse`,
        origin: 'runtime-projection',
        metadata: { rollbackOf: changeSetId }
      }),
      diagnostics: Object.freeze([])
    });
  }

  if (semanticDelta.kind === ComponentSemanticDeltaKind.NODE_REMOVED) {
    const runtimeParentId = resolveRuntimeTargetId(semanticDelta.parentId);
    if (typeof runtimeParentId !== 'string' || !runtimeParentId) {
      return unsupportedResult([diagnostic(
        ComponentRuntimeProjectionDiagnosticKind.RUNTIME_TARGET_UNRESOLVED,
        `No runtime parent is available for component node ${semanticDelta.parentId}`,
        { nodeId: semanticDelta.parentId }
      )]);
    }
    const operation = new MoveMorph({
      morphId: runtimeTargetId,
      from: attachedMorph({
        ownerId: runtimeParentId,
        index: semanticDelta.runtimeIndex ?? semanticDelta.index
      }),
      to: detachedMorph(),
      metadata: {
        origin: 'runtime-projection',
        reconcileChanges: false,
        componentId: beforeDocument.componentId,
        fromRevision: beforeDocument.revision,
        toRevision: reduction.document.revision,
        semanticDeltaKind: semanticDelta.kind
      }
    });
    const changeSet = new MorphicChangeSet({
      id: changeSetId,
      label: 'project component node removal',
      origin: 'runtime-projection',
      undoable: false,
      operations: withLayoutOperation(operation),
      metadata: operation.metadata
    });
    return Object.freeze({
      supported: true,
      changeSet,
      inverseChangeSet: changeSet.invert({
        id: `${changeSetId}:inverse`,
        origin: 'runtime-projection',
        metadata: { rollbackOf: changeSetId }
      }),
      diagnostics: Object.freeze([])
    });
  }

  if (semanticDelta.kind === ComponentSemanticDeltaKind.NODE_SUPPRESSED ||
      semanticDelta.kind === ComponentSemanticDeltaKind.NODE_RESTORED) {
    const runtimeParentId = resolveRuntimeTargetId(semanticDelta.parentId);
    if (typeof runtimeParentId !== 'string' || !runtimeParentId) {
      return unsupportedResult([diagnostic(
        ComponentRuntimeProjectionDiagnosticKind.RUNTIME_TARGET_UNRESOLVED,
        `No runtime parent is available for inherited node ${semanticDelta.nodeId}`,
        { nodeId: semanticDelta.parentId }
      )]);
    }
    const suppressing = semanticDelta.kind === ComponentSemanticDeltaKind.NODE_SUPPRESSED;
    const attached = attachedMorph({ ownerId: runtimeParentId, index: semanticDelta.index });
    const operation = new MoveMorph({
      morphId: runtimeTargetId,
      from: suppressing ? attached : detachedMorph(),
      to: suppressing ? detachedMorph() : attached,
      metadata: {
        origin: 'runtime-projection',
        reconcileChanges: false,
        componentId: beforeDocument.componentId,
        fromRevision: beforeDocument.revision,
        toRevision: reduction.document.revision,
        semanticDeltaKind: semanticDelta.kind
      }
    });
    const changeSet = new MorphicChangeSet({
      id: changeSetId,
      label: suppressing
        ? 'project inherited component node suppression'
        : 'project inherited component node restoration',
      origin: 'runtime-projection',
      undoable: false,
      operations: withLayoutOperation(operation),
      metadata: operation.metadata
    });
    return Object.freeze({
      supported: true,
      changeSet,
      inverseChangeSet: changeSet.invert({
        id: `${changeSetId}:inverse`,
        origin: 'runtime-projection',
        metadata: { rollbackOf: changeSetId }
      }),
      diagnostics: Object.freeze([])
    });
  }

  if (semanticDelta.kind === ComponentSemanticDeltaKind.NODE_MOVED) {
    const runtimeFromParentId = resolveRuntimeTargetId(semanticDelta.fromParentId);
    const runtimeToParentId = resolveRuntimeTargetId(semanticDelta.toParentId);
    if (typeof runtimeFromParentId !== 'string' || !runtimeFromParentId ||
        typeof runtimeToParentId !== 'string' || !runtimeToParentId) {
      return unsupportedResult([diagnostic(
        ComponentRuntimeProjectionDiagnosticKind.RUNTIME_TARGET_UNRESOLVED,
        `No runtime parent is available for component node ${semanticDelta.nodeId}`,
        {
          fromParentId: semanticDelta.fromParentId,
          toParentId: semanticDelta.toParentId
        }
      )]);
    }
    const operation = new MoveMorph({
      morphId: runtimeTargetId,
      from: attachedMorph({
        ownerId: runtimeFromParentId,
        index: semanticDelta.runtimeFromIndex ?? semanticDelta.fromIndex
      }),
      to: attachedMorph({
        ownerId: runtimeToParentId,
        index: semanticDelta.runtimeToIndex ?? semanticDelta.toIndex
      }),
      metadata: {
        origin: 'runtime-projection',
        reconcileChanges: false,
        componentId: beforeDocument.componentId,
        fromRevision: beforeDocument.revision,
        toRevision: reduction.document.revision,
        semanticDeltaKind: semanticDelta.kind
      }
    });
    const changeSet = new MorphicChangeSet({
      id: changeSetId,
      label: 'project component node movement',
      origin: 'runtime-projection',
      undoable: false,
      operations: withRuntimeRename(withLayoutOperation(operation)),
      metadata: operation.metadata
    });
    return Object.freeze({
      supported: true,
      changeSet,
      inverseChangeSet: changeSet.invert({
        id: `${changeSetId}:inverse`,
        origin: 'runtime-projection',
        metadata: { rollbackOf: changeSetId }
      }),
      diagnostics: Object.freeze([])
    });
  }

  let property;
  let before;
  let after;
  if (semanticDelta.kind === ComponentSemanticDeltaKind.NODE_RENAMED) {
    property = 'name';
    before = Object.freeze({ available: true, value: semanticDelta.before });
    after = Object.freeze({ available: true, value: semanticDelta.after });
  } else if (
    semanticDelta.kind === ComponentSemanticDeltaKind.PROPERTY_SET ||
    semanticDelta.kind === ComponentSemanticDeltaKind.PROPERTY_CLEARED ||
    semanticDelta.kind === ComponentSemanticDeltaKind.TEXT_EDITED
  ) {
    property = semanticDelta.kind === ComponentSemanticDeltaKind.TEXT_EDITED
      ? 'textAndAttributes'
      : semanticDelta.property;
    const beforeNode = findComponentNode(beforeDocument, semanticDelta.nodeId);
    const afterNode = findComponentNode(reduction.document, semanticDelta.nodeId);
    const valueSpec = phase => Object.freeze({
      phase,
      nodeId: semanticDelta.nodeId,
      runtimeTargetId,
      property,
      semanticDelta,
      entry: phase === 'before'
        ? beforeNode?.properties[property]
        : afterNode?.properties[property]
    });
    before = resolvedRuntimeValue(
      resolveRuntimeValue,
      valueSpec('before'),
      beforeNode?.properties[property]
    );
    after = resolvedRuntimeValue(
      resolveRuntimeValue,
      valueSpec('after'),
      afterNode?.properties[property]
    );
  } else {
    diagnostics.push(diagnostic(
      ComponentRuntimeProjectionDiagnosticKind.UNSUPPORTED_DELTA,
      `Scalar runtime projection does not support ${semanticDelta.kind}`,
      { semanticDeltaKind: semanticDelta.kind }
    ));
    return unsupportedResult(diagnostics);
  }

  if (!before.available || !after.available) {
    const phases = [!before.available && 'before', !after.available && 'after'].filter(Boolean);
    diagnostics.push(diagnostic(
      ComponentRuntimeProjectionDiagnosticKind.RUNTIME_VALUE_UNAVAILABLE,
      `Runtime ${phases.join(' and ')} value unavailable for ${semanticDelta.nodeId}.${property}`,
      { nodeId: semanticDelta.nodeId, property, phases: Object.freeze(phases) }
    ));
    return unsupportedResult(diagnostics);
  }

  const operation = new SetMorphProperty({
    targetId: runtimeTargetId,
    property,
    before: before.value,
    after: after.value,
    metadata: {
      origin: 'runtime-projection',
      reconcileChanges: false,
      componentId: beforeDocument.componentId,
      fromRevision: beforeDocument.revision,
      toRevision: reduction.document.revision,
      semanticDeltaKind: semanticDelta.kind
    }
  });
  const changeSet = new MorphicChangeSet({
    id: changeSetId,
    label: `project component ${property}`,
    origin: 'runtime-projection',
    undoable: false,
    operations: withLayoutOperation(operation),
    metadata: {
      reconcileChanges: false,
      componentId: beforeDocument.componentId,
      fromRevision: beforeDocument.revision,
      toRevision: reduction.document.revision
    }
  });
  const inverseChangeSet = changeSet.invert({
    id: `${changeSetId}:inverse`,
    origin: 'runtime-projection',
    metadata: { rollbackOf: changeSetId }
  });
  return Object.freeze({
    supported: true,
    changeSet,
    inverseChangeSet,
    diagnostics: Object.freeze([])
  });
}
