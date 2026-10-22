import {
  addedNodeProvenance,
  ComponentLayoutKind,
  ComponentLayoutReferenceKind,
  ComponentNode,
  ComponentNodeProvenanceKind,
  ComponentPropertyKind,
  explicitProperty,
  localNodeProvenance,
  opaqueProperty,
  resizePolicyLayoutReference,
  tilingLayoutModel
} from './component-document.js';
import { normalizeComponentImportBindings } from './import-bindings.js';

export const ComponentCommandKind = Object.freeze({
  SET_PROPERTY: 'set-property',
  CLEAR_PROPERTY_OVERRIDE: 'clear-property-override',
  RENAME_NODE: 'rename-node',
  INTRODUCE_NODE: 'introduce-node',
  MOVE_NODE: 'move-node',
  REMOVE_NODE: 'remove-node',
  SUPPRESS_INHERITED_NODE: 'suppress-inherited-node',
  RESTORE_INHERITED_NODE: 'restore-inherited-node',
  SET_MASTER: 'set-master',
  EDIT_TEXT: 'edit-text'
});

export const ComponentTextEditKind = Object.freeze({
  REPLACE_ALL: 'replace-all'
});

export const ComponentMoveInheritanceTransitionKind = Object.freeze({
  MATERIALIZE: 'materialize-inherited',
  RESTORE: 'restore-inherited'
});

const commandKinds = new Set(Object.values(ComponentCommandKind));

function validateId (id, name) {
  if (typeof id !== 'string' || !id) throw new Error(`${name} requires a stable node ID`);
}

function validateOptionalId (id, name) {
  if (id !== null && id !== undefined) validateId(id, name);
}

function validateOptionalName (value, name) {
  if (value !== null && value !== undefined &&
      (typeof value !== 'string' || !value)) {
    throw new Error(`${name} requires a non-empty ordering name`);
  }
}

function validateOptionalIndex (value, name) {
  if (value !== null && value !== undefined &&
      (!Number.isInteger(value) || value < 0)) {
    throw new Error(`${name} requires a non-negative runtime index`);
  }
}

function normalizeParentLayoutReference (state, commandName) {
  if (state === null || state === undefined) return null;
  if (!Number.isInteger(state.index) || state.index < 0 ||
      state.reference?.kind !== ComponentLayoutReferenceKind.RESIZE_POLICY) {
    throw new Error(`${commandName} parentLayoutReference is invalid`);
  }
  return Object.freeze({
    index: state.index,
    reference: resizePolicyLayoutReference(state.reference)
  });
}

function normalizeSubtreeLayoutModels (states, node) {
  if (states === null || states === undefined) return Object.freeze([]);
  if (!Array.isArray(states)) {
    throw new Error('IntroduceNode subtreeLayoutModels must be an array');
  }
  const subtreeIds = new Set();
  const visit = current => {
    subtreeIds.add(current.id);
    current.children.forEach(visit);
  };
  visit(node);
  const ownerIds = new Set();
  let previousIndex = -1;
  return Object.freeze(states.map(state => {
    if (!Number.isInteger(state?.index) || state.index < 0 ||
        state.index <= previousIndex || state.model?.kind !== ComponentLayoutKind.TILING) {
      throw new Error('IntroduceNode subtreeLayoutModels contains invalid state');
    }
    const model = tilingLayoutModel(state.model);
    if (!subtreeIds.has(model.ownerId) || ownerIds.has(model.ownerId) ||
        model.references.some(reference => !subtreeIds.has(reference.targetId))) {
      throw new Error('IntroduceNode subtreeLayoutModels must belong to the introduced subtree');
    }
    ownerIds.add(model.ownerId);
    previousIndex = state.index;
    return Object.freeze({ index: state.index, model });
  }));
}

function command ({ kind, componentId, expectedRevision, nodeId, ...details }) {
  if (!commandKinds.has(kind)) throw new Error(`Unknown component command kind: ${kind}`);
  validateId(componentId, 'Component commands');
  validateId(nodeId, kind);
  if (!Number.isInteger(expectedRevision) || expectedRevision < 0) {
    throw new Error('Component commands require a non-negative expected revision');
  }
  return Object.freeze({ kind, componentId, expectedRevision, nodeId, ...details });
}

export function SetPropertyEntry ({
  componentId, expectedRevision, nodeId, property, entry, requiredBindings = []
}) {
  if (typeof property !== 'string' || !property) {
    throw new Error('SetProperty requires a property name');
  }
  const validExplicit = entry?.kind === ComponentPropertyKind.EXPLICIT_VALUE &&
    Object.prototype.hasOwnProperty.call(entry, 'value');
  const validOpaque = entry?.kind === ComponentPropertyKind.OPAQUE_EXPRESSION &&
    typeof entry.expression === 'string' && !!entry.expression.trim();
  if (!validExplicit && !validOpaque) {
    throw new Error('SetProperty requires an explicit or opaque property entry');
  }
  const normalizedBindings = normalizeComponentImportBindings(requiredBindings);
  if (validExplicit && normalizedBindings.length) {
    throw new Error('Explicit component properties cannot require imports');
  }
  return command({
    kind: ComponentCommandKind.SET_PROPERTY,
    componentId,
    expectedRevision,
    nodeId,
    property,
    entry,
    ...(validOpaque ? { requiredBindings: normalizedBindings } : {})
  });
}

export function SetProperty (spec) {
  return SetPropertyEntry({ ...spec, entry: explicitProperty(spec.value) });
}

export function SetOpaqueProperty (spec) {
  return SetPropertyEntry({
    ...spec,
    entry: opaqueProperty(spec.expression),
    requiredBindings: spec.requiredBindings
  });
}

export function ClearPropertyOverride (spec) {
  if (typeof spec.property !== 'string' || !spec.property) {
    throw new Error('ClearPropertyOverride requires a property name');
  }
  return command({ kind: ComponentCommandKind.CLEAR_PROPERTY_OVERRIDE, ...spec });
}

export function RenameNode (spec) {
  if (typeof spec.name !== 'string' || !spec.name) throw new Error('RenameNode requires a name');
  return command({ kind: ComponentCommandKind.RENAME_NODE, ...spec });
}

export function IntroduceNode (spec) {
  if (!(spec.node instanceof ComponentNode)) throw new Error('IntroduceNode requires a ComponentNode');
  validateId(spec.parentId, 'IntroduceNode');
  validateOptionalId(spec.beforeId, 'IntroduceNode');
  validateOptionalIndex(spec.runtimeIndex, 'IntroduceNode');
  if (spec.nodeId !== undefined && spec.nodeId !== spec.node.id) {
    throw new Error('IntroduceNode nodeId must match the introduced node');
  }
  const requiredBindings = normalizeComponentImportBindings(spec.requiredBindings || []);
  const parentLayoutReference = normalizeParentLayoutReference(
    spec.parentLayoutReference,
    'IntroduceNode'
  );
  const subtreeLayoutModels = normalizeSubtreeLayoutModels(
    spec.subtreeLayoutModels,
    spec.node
  );
  return command({
    kind: ComponentCommandKind.INTRODUCE_NODE,
    ...spec,
    requiredBindings,
    ...(parentLayoutReference ? { parentLayoutReference } : {}),
    ...(subtreeLayoutModels.length ? { subtreeLayoutModels } : {}),
    nodeId: spec.node.id
  });
}

export function MoveNode (spec) {
  validateId(spec.parentId, 'MoveNode');
  validateOptionalId(spec.beforeId, 'MoveNode');
  validateOptionalName(spec.orderingName, 'MoveNode');
  validateOptionalIndex(spec.runtimeFromIndex, 'MoveNode runtimeFromIndex');
  validateOptionalIndex(spec.runtimeToIndex, 'MoveNode runtimeToIndex');
  const orderingRestorations = Object.freeze((spec.orderingRestorations || []).map(entry => {
    validateId(entry?.nodeId, 'MoveNode ordering restoration');
    validateOptionalId(entry.beforeId, 'MoveNode ordering restoration');
    validateOptionalName(entry.beforeName, 'MoveNode ordering restoration');
    if (entry.beforeId && entry.beforeName) {
      throw new Error('MoveNode ordering restoration cannot use both beforeId and beforeName');
    }
    return Object.freeze({
      nodeId: entry.nodeId,
      beforeId: entry.beforeId || null,
      beforeName: entry.beforeName || null
    });
  }));
  const parentLayoutReference = normalizeParentLayoutReference(
    spec.parentLayoutReference,
    'MoveNode'
  );
  if (parentLayoutReference && parentLayoutReference.reference.targetId !== spec.nodeId) {
    throw new Error('MoveNode parentLayoutReference must target the moved node');
  }
  let provenance = null;
  if (spec.provenance !== undefined) {
    if (spec.provenance?.kind === ComponentNodeProvenanceKind.LOCAL) {
      provenance = localNodeProvenance();
    } else if (spec.provenance?.kind === ComponentNodeProvenanceKind.ADDED) {
      provenance = addedNodeProvenance(spec.provenance);
    } else {
      throw new Error('MoveNode provenance must be local or added');
    }
  }
  let inheritanceTransition = null;
  if (spec.inheritanceTransition !== undefined) {
    const transition = spec.inheritanceTransition;
    if (transition?.kind === ComponentMoveInheritanceTransitionKind.MATERIALIZE &&
        transition.node instanceof ComponentNode) {
      inheritanceTransition = Object.freeze({
        kind: transition.kind,
        node: transition.node,
        requiredBindings: normalizeComponentImportBindings(
          transition.requiredBindings || []
        )
      });
    } else if (transition?.kind === ComponentMoveInheritanceTransitionKind.RESTORE) {
      validateId(transition.inheritedNodeId, 'MoveNode inherited restoration');
      inheritanceTransition = Object.freeze({
        kind: transition.kind,
        inheritedNodeId: transition.inheritedNodeId
      });
    } else {
      throw new Error('MoveNode inheritanceTransition is invalid');
    }
  }
  return command({
    kind: ComponentCommandKind.MOVE_NODE,
    ...spec,
    ...(provenance ? { provenance } : {}),
    ...(inheritanceTransition ? { inheritanceTransition } : {}),
    ...(parentLayoutReference ? { parentLayoutReference } : {}),
    ...(orderingRestorations.length ? { orderingRestorations } : {})
  });
}

export function RemoveNode (spec) {
  validateOptionalIndex(spec.runtimeIndex, 'RemoveNode');
  return command({ kind: ComponentCommandKind.REMOVE_NODE, ...spec });
}

export function SuppressInheritedNode (spec) {
  return command({ kind: ComponentCommandKind.SUPPRESS_INHERITED_NODE, ...spec });
}

export function RestoreInheritedNode (spec) {
  validateId(spec.parentId, 'RestoreInheritedNode');
  validateOptionalId(spec.beforeId, 'RestoreInheritedNode');
  return command({ kind: ComponentCommandKind.RESTORE_INHERITED_NODE, ...spec });
}

export function SetMaster (spec) {
  const hasExpression = Object.prototype.hasOwnProperty.call(spec, 'expression');
  const hasValue = Object.prototype.hasOwnProperty.call(spec, 'value');
  if (hasExpression === hasValue) {
    throw new Error('SetMaster requires exactly one of value or expression');
  }
  const requiredBindings = normalizeComponentImportBindings(spec.requiredBindings);
  if (hasValue && requiredBindings.length) {
    throw new Error('Explicit component masters cannot require imports');
  }
  return command({
    kind: ComponentCommandKind.SET_MASTER,
    ...spec,
    entry: hasExpression
      ? opaqueProperty(spec.expression)
      : explicitProperty(spec.value),
    ...(hasExpression ? { requiredBindings } : {})
  });
}

export function EditText (spec) {
  if (spec.operation?.kind !== ComponentTextEditKind.REPLACE_ALL ||
      !('before' in spec.operation) || !('after' in spec.operation)) {
    throw new Error('EditText requires a replace-all operation with before and after values');
  }
  return command({
    kind: ComponentCommandKind.EDIT_TEXT,
    ...spec,
    operation: Object.freeze({
      kind: ComponentTextEditKind.REPLACE_ALL,
      before: explicitProperty(spec.operation.before).value,
      after: explicitProperty(spec.operation.after).value
    })
  });
}
