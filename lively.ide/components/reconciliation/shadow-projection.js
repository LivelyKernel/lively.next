import { MorphicChangeSet } from 'lively.morphic/changes/index.js';
import {
  addedNodeProvenance,
  ComponentDocument,
  ComponentNodeProvenanceKind,
  ComponentPropertyKind,
  findComponentNode,
  findComponentParent,
  inheritedNodeProvenance
} from './component-document.js';
import {
  ComponentMoveInheritanceTransitionKind,
  ComponentTextEditKind,
  EditText,
  IntroduceNode,
  MoveNode,
  RemoveNode,
  RenameNode,
  RestoreInheritedNode,
  SetMaster,
  SetOpaqueProperty,
  SetProperty,
  SuppressInheritedNode
} from './commands.js';
import { componentImportBindingsFromExpression } from './import-bindings.js';
import { ComponentBridgeCommandKind } from './morphic-change-set-adapter.js';
import { reduceComponent } from './reducer.js';
import { projectComponentRuntime } from './runtime-projector.js';
import { parseComponentSource } from './source-adapter.js';
import {
  componentDocumentsSemanticallyEqual,
  projectComponentSource
} from './source-projector.js';

export const ShadowProjectionDiagnosticKind = Object.freeze({
  SOURCE_UNAVAILABLE: 'source-unavailable',
  SOURCE_UNSUPPORTED: 'source-unsupported',
  COMMAND_UNSUPPORTED: 'command-unsupported',
  NODE_ID_UNRESOLVED: 'node-id-unresolved',
  VALUE_EXPRESSION_UNAVAILABLE: 'value-expression-unavailable',
  REDUCTION_FAILED: 'reduction-failed',
  SOURCE_PROJECTION_FAILED: 'source-projection-failed',
  RUNTIME_PROJECTION_FAILED: 'runtime-projection-failed'
});

export const ShadowProjectionComparisonKind = Object.freeze({
  MATCH: 'match',
  SEMANTIC_MISMATCH: 'semantic-mismatch',
  CURRENT_SOURCE_UNSUPPORTED: 'current-source-unsupported',
  PROJECTION_COMPARISON_FAILED: 'projection-comparison-failed'
});

function diagnostic (kind, message, details = {}) {
  return Object.freeze({ kind, message, ...details });
}

function runtimeVisibleChildren (parent, excludingNodeId = null) {
  return parent.children.filter(child =>
    child.id !== excludingNodeId &&
    (child.provenance.kind !== ComponentNodeProvenanceKind.INHERITED ||
     !child.provenance.suppressed));
}

function preserveMaterializedDescendantProvenance (serializedNode, semanticNode) {
  const semanticChildren = new Map(semanticNode.children.map(child => [child.name, child]));
  const serializedChildren = new Map(serializedNode.children.map(child => [child.name, child]));
  const candidateChildren = semanticNode.children.map((semanticChild, index) =>
    serializedChildren.get(semanticChild.name) || semanticChild.with({
      id: `${serializedNode.id}.${index}`,
      children: []
    }));
  for (const child of serializedNode.children) {
    if (!semanticChildren.has(child.name)) candidateChildren.push(child);
  }
  const children = candidateChildren.map(child => {
    const semanticChild = semanticChildren.get(child.name);
    if (!semanticChild) return child;
    let projected = preserveMaterializedDescendantProvenance(child, semanticChild);
    projected = projected.with({
      typeExpression: semanticChild.typeExpression || projected.typeExpression,
      properties: semanticChild.properties,
      partComponent: semanticChild.partComponent || projected.partComponent
    });
    if (semanticChild.provenance.kind === ComponentNodeProvenanceKind.ADDED) {
      const semanticBefore = semanticChild.provenance.beforeId &&
        semanticNode.children.find(candidate =>
          candidate.id === semanticChild.provenance.beforeId);
      const beforeName = semanticChild.provenance.beforeName || semanticBefore?.name || null;
      const projectedBefore = beforeName &&
        candidateChildren.find(candidate => candidate.name === beforeName);
      projected = projected.with({
        provenance: addedNodeProvenance(projectedBefore
          ? { beforeId: projectedBefore.id }
          : beforeName
            ? { beforeName }
          : {})
      });
    } else if (semanticChild.provenance.kind === ComponentNodeProvenanceKind.INHERITED) {
      projected = projected.with({
        provenance: inheritedNodeProvenance({
          ...semanticChild.provenance,
          hasLocalOverrides: true,
          beforeId: null
        })
      });
    }
    return projected;
  });
  return serializedNode.with({
    typeExpression: semanticNode.typeExpression || serializedNode.typeExpression,
    properties: semanticNode.properties,
    partComponent: semanticNode.partComponent || serializedNode.partComponent,
    children
  });
}

function isSemanticValue (value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index++) {
      if (!(index in value) || !isSemanticValue(value[index])) return false;
    }
    return true;
  }
  return !!value && Object.getPrototypeOf(value) === Object.prototype &&
    Object.values(value).every(isSemanticValue);
}

function componentCommandFor ({
  document,
  bridgeCommand,
  nodeId,
  destinationParentId,
  runtimeNodeNameFor,
  runtimeOrderingNameFor,
  valueExpressionFor,
  introducedNodeFor
}) {
  const commandSpec = {
    componentId: document.componentId,
    expectedRevision: document.revision,
    nodeId
  };
  if (bridgeCommand.kind === ComponentBridgeCommandKind.RENAME_NODE) {
    return { command: RenameNode({ ...commandSpec, name: bridgeCommand.name }), bindings: {} };
  }
  if (bridgeCommand.kind === ComponentBridgeCommandKind.EDIT_TEXT) {
    const entry = findComponentNode(document, nodeId)?.properties.textAndAttributes;
    if (isSemanticValue(bridgeCommand.value)) {
      if (entry?.kind !== ComponentPropertyKind.EXPLICIT_VALUE) {
        return {
          command: SetProperty({
            ...commandSpec,
            property: 'textAndAttributes',
            value: bridgeCommand.value
          }),
          bindings: {}
        };
      }
      return {
        command: EditText({
          ...commandSpec,
          operation: {
            kind: ComponentTextEditKind.REPLACE_ALL,
            before: entry.value,
            after: bridgeCommand.value
          }
        }),
        bindings: {}
      };
    }
    const expression = valueExpressionFor?.(bridgeCommand);
    const expressionSource = typeof expression === 'string' ? expression : expression?.__expr__;
    if (typeof expressionSource !== 'string' || !expressionSource.trim()) return false;
    return {
      command: SetOpaqueProperty({
        ...commandSpec,
        property: 'textAndAttributes',
        expression: expressionSource,
        requiredBindings: componentImportBindingsFromExpression(expression?.bindings || {})
      }),
      bindings: expression?.bindings || {}
    };
  }
  if (bridgeCommand.kind === ComponentBridgeCommandKind.SET_MASTER) {
    if (bridgeCommand.value === null) {
      return {
        command: SetMaster({ ...commandSpec, value: null }),
        bindings: {}
      };
    }
    if (bridgeCommand.value === undefined) return false;
    const expression = valueExpressionFor?.(bridgeCommand);
    const expressionSource = typeof expression === 'string' ? expression : expression?.__expr__;
    if (typeof expressionSource !== 'string' || !expressionSource.trim()) return false;
    return {
      command: SetMaster({
        ...commandSpec,
        expression: expressionSource,
        requiredBindings: componentImportBindingsFromExpression(expression?.bindings || {})
      }),
      bindings: expression?.bindings || {}
    };
  }
  if (bridgeCommand.kind === ComponentBridgeCommandKind.REMOVE_NODE) {
    const node = findComponentNode(document, nodeId);
    const parent = findComponentParent(document, nodeId);
    if (!node || !parent || typeof bridgeCommand.parentId !== 'string') return false;
    if (node.provenance.kind === ComponentNodeProvenanceKind.INHERITED) {
      if (node.provenance.suppressed) return false;
      return {
        command: SuppressInheritedNode(commandSpec),
        bindings: {},
        runtimeTargetIds: Object.freeze({ [parent.id]: bridgeCommand.parentId })
      };
    }
    return {
      command: RemoveNode({ ...commandSpec, runtimeIndex: bridgeCommand.index }),
      bindings: {},
      runtimeTargetIds: Object.freeze({ [parent.id]: bridgeCommand.parentId })
    };
  }
  if (bridgeCommand.kind === ComponentBridgeCommandKind.INTRODUCE_NODE) {
    const parent = findComponentNode(document, nodeId);
    const visibleChildren = parent && runtimeVisibleChildren(parent);
    if (!parent) return false;
    if (!Number.isInteger(bridgeCommand.index) || bridgeCommand.index < 0) return false;
    const runtimeNodeName = runtimeNodeNameFor?.(bridgeCommand);
    const suppressedNode = parent?.children.find(child =>
      child.name === runtimeNodeName &&
      child.provenance.kind === ComponentNodeProvenanceKind.INHERITED &&
      child.provenance.suppressed);
    if (suppressedNode) {
      return {
        command: RestoreInheritedNode({
          componentId: document.componentId,
          expectedRevision: document.revision,
          nodeId: suppressedNode.id,
          parentId: parent.id,
          beforeId: suppressedNode.provenance.beforeId
        }),
        bindings: {},
        runtimeTargetIds: Object.freeze({
          [parent.id]: bridgeCommand.parentId,
          [suppressedNode.id]: bridgeCommand.nodeId
        })
      };
    }
    const serialized = introducedNodeFor?.({
      document,
      parentId: parent.id,
      index: bridgeCommand.index,
      bridgeCommand
    });
    if (!serialized?.supported) {
      return { serializationFailure: serialized };
    }
    const runtimeOrderingName = runtimeOrderingNameFor?.(bridgeCommand);
    const runtimeOrderingNode = typeof runtimeOrderingName === 'string'
      ? parent.children.find(child => child.name === runtimeOrderingName)
      : null;
    const externalOrderingName = typeof runtimeOrderingName === 'string' && !runtimeOrderingNode
      ? runtimeOrderingName
      : null;
    const beforeId = runtimeOrderingName === null
      ? null
      : runtimeOrderingNode?.id ?? visibleChildren[bridgeCommand.index]?.id ?? null;
    const introducedNode = (document.parentComponent && parent.id === document.root.id) ||
      parent.provenance.kind === ComponentNodeProvenanceKind.INHERITED ||
      !!parent.partComponent
      ? serialized.node.with({
          provenance: addedNodeProvenance(externalOrderingName
            ? { beforeName: externalOrderingName }
            : { beforeId })
        })
      : serialized.node;
    return {
      command: IntroduceNode({
        componentId: document.componentId,
        expectedRevision: document.revision,
        parentId: parent.id,
        beforeId,
        node: introducedNode,
        runtimeIndex: bridgeCommand.index,
        requiredBindings: serialized.requiredBindings
      }),
      bindings: serialized.bindings,
      runtimeRename: serialized.runtimeRename,
      runtimeTargetIds: Object.freeze({
        [parent.id]: bridgeCommand.parentId,
        [introducedNode.id]: bridgeCommand.nodeId
      })
    };
  }
  if (bridgeCommand.kind === ComponentBridgeCommandKind.MOVE_NODE) {
    const node = findComponentNode(document, nodeId);
    const previousParent = findComponentParent(document, nodeId);
    const destinationParent = findComponentNode(document, destinationParentId);
    if (!node || !previousParent || !destinationParent ||
        !Number.isInteger(bridgeCommand.index) || bridgeCommand.index < 0) return false;
    const siblings = runtimeVisibleChildren(
      destinationParent,
      previousParent.id === destinationParent.id ? node.id : null
    );
    const runtimeOrderingName = runtimeOrderingNameFor?.(bridgeCommand);
    const runtimeOrderingNode = typeof runtimeOrderingName === 'string'
      ? siblings.find(child => child.name === runtimeOrderingName)
      : null;
    const externalOrderingName = typeof runtimeOrderingName === 'string' && !runtimeOrderingNode
      ? runtimeOrderingName
      : null;
    const beforeId = runtimeOrderingName === null
      ? null
      : runtimeOrderingNode?.id ?? siblings[bridgeCommand.index]?.id ?? null;
    if (node.provenance.kind === ComponentNodeProvenanceKind.INHERITED) {
      if (previousParent.id === destinationParent.id || node.provenance.suppressed) return false;
      const serialized = introducedNodeFor?.({
        document,
        parentId: destinationParent.id,
        index: bridgeCommand.index,
        bridgeCommand,
        partComponent: node.partComponent,
        materializePartSubtree: true
      });
      if (!serialized?.supported) return { serializationFailure: serialized };
      const serializedMaterialization = preserveMaterializedDescendantProvenance(
        serialized.node,
        node
      );
      const materializedNode = (document.parentComponent &&
        destinationParent.id === document.root.id) ||
        destinationParent.provenance.kind === ComponentNodeProvenanceKind.INHERITED ||
        !!destinationParent.partComponent
        ? serializedMaterialization.with({
            provenance: addedNodeProvenance(externalOrderingName
              ? { beforeName: externalOrderingName }
              : { beforeId })
          })
        : serializedMaterialization;
      return {
        command: MoveNode({
          ...commandSpec,
          parentId: destinationParent.id,
          beforeId,
          runtimeFromIndex: bridgeCommand.previousIndex,
          runtimeToIndex: bridgeCommand.index,
          inheritanceTransition: {
            kind: ComponentMoveInheritanceTransitionKind.MATERIALIZE,
            node: materializedNode,
            requiredBindings: serialized.requiredBindings
          }
        }),
        bindings: serialized.bindings,
        runtimeRename: serialized.runtimeRename,
        runtimeTargetIds: Object.freeze({
          [previousParent.id]: bridgeCommand.previousParentId,
          [destinationParent.id]: bridgeCommand.parentId,
          [materializedNode.id]: bridgeCommand.nodeId
        })
      };
    }
    return {
      command: MoveNode({
        ...commandSpec,
        parentId: destinationParent.id,
        beforeId,
        ...(externalOrderingName ? { orderingName: externalOrderingName } : {}),
        runtimeFromIndex: bridgeCommand.previousIndex,
        runtimeToIndex: bridgeCommand.index
      }),
      bindings: {},
      runtimeTargetIds: Object.freeze({
        [previousParent.id]: bridgeCommand.previousParentId,
        [destinationParent.id]: bridgeCommand.parentId
      })
    };
  }
  if (bridgeCommand.kind !== ComponentBridgeCommandKind.SET_PROPERTY) return null;
  if (isSemanticValue(bridgeCommand.value)) {
    return {
      command: SetProperty({
        ...commandSpec,
        property: bridgeCommand.property,
        value: bridgeCommand.value
      }),
      bindings: {}
    };
  }
  const expression = valueExpressionFor?.(bridgeCommand);
  const expressionSource = typeof expression === 'string' ? expression : expression?.__expr__;
  if (typeof expressionSource !== 'string' || !expressionSource.trim()) return false;
  return {
    command: SetOpaqueProperty({
      ...commandSpec,
      property: bridgeCommand.property,
      expression: expressionSource,
      requiredBindings: componentImportBindingsFromExpression(expression?.bindings || {})
    }),
    bindings: expression?.bindings || {}
  };
}

export function prepareShadowScalarProjection ({
  source,
  moduleId,
  exportName,
  componentId,
  bridgeCommands,
  parentDocument = null,
  resolveComponentDocument = null,
  beforeDocument = null,
  projectionId = 'shadow-component-projection',
  resolveNodeId = (_document, bridgeCommand) => bridgeCommand.nodeId,
  resolveDestinationParentId = () => null,
  runtimeNodeNameFor,
  runtimeOrderingNameFor,
  valueExpressionFor,
  introducedNodeFor,
  runtimeLayoutFor
}) {
  if (typeof source !== 'string') {
    return Object.freeze({
      supported: false,
      sourceBefore: source,
      sourceAfter: source,
      beforeDocument: null,
      document: null,
      steps: Object.freeze([]),
      runtimeChangeSet: null,
      inverseRuntimeChangeSet: null,
      requiredBindings: Object.freeze({}),
      diagnostics: Object.freeze([diagnostic(
        ShadowProjectionDiagnosticKind.SOURCE_UNAVAILABLE,
        'Component module source is unavailable'
      )])
    });
  }

  if (beforeDocument !== null && !(beforeDocument instanceof ComponentDocument)) {
    throw new Error('Shadow projection beforeDocument must be a ComponentDocument');
  }
  if (beforeDocument && (
    beforeDocument.moduleId !== moduleId ||
    beforeDocument.exportName !== exportName ||
    beforeDocument.componentId !== componentId
  )) {
    throw new Error('Shadow projection beforeDocument does not match the requested component');
  }
  const parsed = beforeDocument
    ? Object.freeze({ supported: true, document: beforeDocument, diagnostics: Object.freeze([]) })
    : parseComponentSource({
        source,
        moduleId,
        exportName,
        componentId,
        parentDocument,
        resolveComponentDocument
      });
  if (!parsed.supported) {
    return Object.freeze({
      supported: false,
      sourceBefore: source,
      sourceAfter: source,
      beforeDocument: null,
      document: null,
      steps: Object.freeze([]),
      runtimeChangeSet: null,
      inverseRuntimeChangeSet: null,
      requiredBindings: Object.freeze({}),
      diagnostics: Object.freeze([diagnostic(
        ShadowProjectionDiagnosticKind.SOURCE_UNSUPPORTED,
        'Component source is outside the projectional shadow subset',
        { sourceDiagnostics: parsed.diagnostics }
      )])
    });
  }

  const diagnostics = [];
  const steps = [];
  const requiredBindings = {};
  let currentDocument = parsed.document;
  let currentSource = source;
  for (const [commandIndex, bridgeCommand] of bridgeCommands.entries()) {
    const nodeId = resolveNodeId(currentDocument, bridgeCommand);
    const destinationParentId = bridgeCommand.kind === ComponentBridgeCommandKind.MOVE_NODE
      ? resolveDestinationParentId(currentDocument, bridgeCommand)
      : null;
    if (!nodeId) {
      diagnostics.push(diagnostic(
        ShadowProjectionDiagnosticKind.NODE_ID_UNRESOLVED,
        `Could not resolve runtime node ${bridgeCommand.nodeId} in the component document`,
        { bridgeCommand }
      ));
      break;
    }

    let translated;
    try {
      translated = componentCommandFor({
        document: currentDocument,
        bridgeCommand,
        nodeId,
        destinationParentId,
        runtimeNodeNameFor,
        runtimeOrderingNameFor,
        valueExpressionFor,
        introducedNodeFor
      });
    } catch (error) {
      diagnostics.push(diagnostic(
        ShadowProjectionDiagnosticKind.VALUE_EXPRESSION_UNAVAILABLE,
        error.message,
        { bridgeCommand }
      ));
      break;
    }
    if (translated === null) {
      diagnostics.push(diagnostic(
        ShadowProjectionDiagnosticKind.COMMAND_UNSUPPORTED,
        `Component shadow projection does not support ${bridgeCommand.kind}`,
        { bridgeCommand }
      ));
      break;
    }
    if (translated.serializationFailure) {
      const serializationDiagnostics = translated.serializationFailure.diagnostics || [];
      diagnostics.push(diagnostic(
        ShadowProjectionDiagnosticKind.VALUE_EXPRESSION_UNAVAILABLE,
        serializationDiagnostics[0]?.message ||
          `Runtime node ${bridgeCommand.nodeId} cannot be serialized projectionally`,
        { bridgeCommand, serializationDiagnostics }
      ));
      break;
    }
    if (translated === false) {
      diagnostics.push(diagnostic(
        ShadowProjectionDiagnosticKind.VALUE_EXPRESSION_UNAVAILABLE,
        bridgeCommand.kind === ComponentBridgeCommandKind.INTRODUCE_NODE
          ? `Runtime node ${bridgeCommand.nodeId} cannot be serialized projectionally`
          : `No source expression is available for ${nodeId}.${bridgeCommand.property}`,
        { bridgeCommand }
      ));
      break;
    }

    let reduction;
    try {
      reduction = reduceComponent(currentDocument, translated.command);
    } catch (error) {
      diagnostics.push(diagnostic(
        ShadowProjectionDiagnosticKind.REDUCTION_FAILED,
        error.message,
        { bridgeCommand, componentCommand: translated.command }
      ));
      break;
    }
    const sourceProjection = projectComponentSource({
      source: currentSource,
      beforeDocument: currentDocument,
      reduction
    });
    if (!sourceProjection.supported) {
      const sourceDiagnostics = sourceProjection.diagnostics || [];
      diagnostics.push(diagnostic(
        ShadowProjectionDiagnosticKind.SOURCE_PROJECTION_FAILED,
        sourceDiagnostics[0]?.message ||
          'The reduced command could not be projected back into source',
        { bridgeCommand, sourceDiagnostics }
      ));
      break;
    }
    const runtimeValues = bridgeCommand.kind === ComponentBridgeCommandKind.RENAME_NODE
      ? { before: bridgeCommand.previousName, after: bridgeCommand.name }
      : { before: bridgeCommand.previousValue, after: bridgeCommand.value };
    const runtimeProjection = projectComponentRuntime({
      beforeDocument: currentDocument,
      reduction,
      changeSetId: `${projectionId}:runtime:${commandIndex}`,
      resolveRuntimeTargetId: semanticNodeId =>
        translated.runtimeTargetIds?.[semanticNodeId] ||
        (semanticNodeId === nodeId ? bridgeCommand.nodeId : null),
      resolveRuntimeValue: ({ phase }) => Object.freeze({
        available: true,
        value: runtimeValues[phase]
      }),
      runtimeRename: translated.runtimeRename,
      resolveRuntimeLayout: spec => runtimeLayoutFor?.({
        ...spec,
        bridgeCommand,
        componentCommand: translated.command
      }) || null
    });
    if (!runtimeProjection.supported) {
      diagnostics.push(diagnostic(
        ShadowProjectionDiagnosticKind.RUNTIME_PROJECTION_FAILED,
        'The reduced command could not be projected into runtime operations',
        { bridgeCommand, runtimeDiagnostics: runtimeProjection.diagnostics }
      ));
      break;
    }
    Object.entries(translated.bindings).forEach(([bindingModuleId, bindings]) => {
      requiredBindings[bindingModuleId] = Array.from(new Set([
        ...(requiredBindings[bindingModuleId] || []),
        ...bindings
      ]));
    });
    steps.push(Object.freeze({
      bridgeCommand,
      componentCommand: translated.command,
      reduction,
      sourceProjection,
      runtimeProjection
    }));
    currentDocument = sourceProjection.projectedDocument;
    currentSource = sourceProjection.sourceAfter;
  }

  const supported = diagnostics.length === 0 && steps.length === bridgeCommands.length;
  const runtimeChangeSet = supported
    ? new MorphicChangeSet({
        id: `${projectionId}:runtime`,
        label: 'project component command batch',
        origin: 'runtime-projection',
        undoable: false,
        operations: steps.flatMap(step => step.runtimeProjection.changeSet.operations),
        metadata: {
          reconcileChanges: false,
          componentId,
          fromRevision: parsed.document.revision,
          toRevision: currentDocument.revision
        }
      })
    : null;
  const inverseRuntimeChangeSet = runtimeChangeSet?.invert({
    id: `${projectionId}:runtime:inverse`,
    origin: 'runtime-projection',
    metadata: { rollbackOf: runtimeChangeSet.id }
  }) || null;
  return Object.freeze({
    supported,
    sourceBefore: source,
    sourceAfter: currentSource,
    beforeDocument: parsed.document,
    document: currentDocument,
    steps: Object.freeze(steps),
    runtimeChangeSet,
    inverseRuntimeChangeSet,
    requiredBindings: Object.freeze(Object.fromEntries(
      Object.entries(requiredBindings).map(([bindingModuleId, bindings]) =>
        [bindingModuleId, Object.freeze(bindings)])
    )),
    diagnostics: Object.freeze(diagnostics)
  });
}

export function compareShadowProjectionToCurrentSource (shadowProjection, currentSource) {
  if (!shadowProjection?.supported || !shadowProjection.document) {
    throw new Error('Can only compare a supported shadow projection');
  }
  const { document } = shadowProjection;
  const parsedCurrent = parseComponentSource({
    source: currentSource,
    moduleId: document.moduleId,
    exportName: document.exportName,
    componentId: document.componentId
  });
  if (!parsedCurrent.supported) {
    return Object.freeze({
      kind: ShadowProjectionComparisonKind.CURRENT_SOURCE_UNSUPPORTED,
      matches: false,
      diagnostics: parsedCurrent.diagnostics
    });
  }
  const matches = componentDocumentsSemanticallyEqual(
    shadowProjection.document,
    parsedCurrent.document
  );
  return Object.freeze({
    kind: matches
      ? ShadowProjectionComparisonKind.MATCH
      : ShadowProjectionComparisonKind.SEMANTIC_MISMATCH,
    matches,
    diagnostics: Object.freeze([])
  });
}
