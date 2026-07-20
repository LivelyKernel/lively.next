import {
  addedNodeProvenance,
  ComponentDocument,
  ComponentNode,
  ComponentNodeProvenanceKind,
  ComponentPropertyKind,
  explicitProperty,
  findComponentNode,
  findComponentParent,
  inheritedNodeProvenance,
  localNodeProvenance,
  tilingLayoutModel
} from './component-document.js';
import {
  ClearPropertyOverride,
  ComponentCommandKind,
  ComponentMoveInheritanceTransitionKind,
  EditText,
  IntroduceNode,
  MoveNode,
  RemoveNode,
  RenameNode,
  RestoreInheritedNode,
  SetPropertyEntry,
  SuppressInheritedNode
} from './commands.js';
import { assertComponentDocument } from './invariants.js';

export const ComponentSemanticDeltaKind = Object.freeze({
  PROPERTY_SET: 'property-set',
  PROPERTY_CLEARED: 'property-cleared',
  NODE_RENAMED: 'node-renamed',
  NODE_INTRODUCED: 'node-introduced',
  NODE_MOVED: 'node-moved',
  NODE_REMOVED: 'node-removed',
  NODE_SUPPRESSED: 'node-suppressed',
  NODE_RESTORED: 'node-restored',
  TEXT_EDITED: 'text-edited'
});

export class ComponentCommandError extends Error {
  constructor (message, command) {
    super(message);
    this.name = 'ComponentCommandError';
    this.message = message;
    this.command = command;
  }
}

function replaceNode (node, nodeId, replacement) {
  if (node.id === nodeId) return replacement(node);
  let changed = false;
  const children = node.children.map(child => {
    const replaced = replaceNode(child, nodeId, replacement);
    if (replaced !== child) changed = true;
    return replaced;
  });
  return changed ? node.with({ children }) : node;
}

function insertChild (parent, child, beforeId, command) {
  let index = parent.children.length;
  if (beforeId !== null && beforeId !== undefined) {
    index = parent.children.findIndex(candidate => candidate.id === beforeId);
    if (index < 0) throw new ComponentCommandError(`Unknown ordering anchor ${beforeId}`, command);
  }
  const children = parent.children.slice();
  children.splice(index, 0, child);
  return parent.with({ children });
}

function runtimeVisible (node) {
  return node.provenance.kind !== ComponentNodeProvenanceKind.INHERITED ||
    !node.provenance.suppressed;
}

function runtimeIndexAt (parent, semanticIndex) {
  return parent.children.slice(0, semanticIndex).filter(runtimeVisible).length;
}

function removeNodeFromTree (root, nodeId) {
  let removed = null;
  const visit = node => {
    const index = node.children.findIndex(child => child.id === nodeId);
    if (index > -1) {
      const children = node.children.slice();
      removed = children.splice(index, 1)[0];
      return node.with({ children });
    }
    let changed = false;
    const children = node.children.map(child => {
      const next = visit(child);
      if (next !== child) changed = true;
      return next;
    });
    return changed ? node.with({ children }) : node;
  };
  return { root: visit(root), removed };
}

function descendantIds (node, ids = new Set()) {
  ids.add(node.id);
  node.children.forEach(child => descendantIds(child, ids));
  return ids;
}

function nextRevision (document) { return document.revision + 1; }

function semanticValuesEqual (left, right) {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length &&
      left.every((value, index) => semanticValuesEqual(value, right[index]));
  }
  if (left && right && Object.getPrototypeOf(left) === Object.prototype &&
      Object.getPrototypeOf(right) === Object.prototype) {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    return leftKeys.length === rightKeys.length &&
      leftKeys.every(key => Object.prototype.hasOwnProperty.call(right, key) &&
        semanticValuesEqual(left[key], right[key]));
  }
  return false;
}

function result (
  document,
  root,
  inverseCommand,
  semanticDelta,
  layoutModels = document.layoutModels
) {
  const nextDocument = new ComponentDocument({
    revision: nextRevision(document),
    componentId: document.componentId,
    moduleId: document.moduleId,
    exportName: document.exportName,
    parentComponent: document.parentComponent,
    root,
    layoutModels,
    sourceMetadata: document.sourceMetadata
  });
  assertComponentDocument(nextDocument);
  return Object.freeze({
    document: nextDocument,
    inverseCommand,
    semanticDelta: Object.freeze(semanticDelta),
    diagnostics: Object.freeze([])
  });
}

function withoutParentLayoutReference (document, parentId, nodeId) {
  const modelIndex = document.layoutModels.findIndex(model => model.ownerId === parentId);
  if (modelIndex < 0) {
    return Object.freeze({
      layoutModels: document.layoutModels,
      parentLayoutReference: null
    });
  }
  const model = document.layoutModels[modelIndex];
  const referenceIndex = model.references.findIndex(reference => reference.targetId === nodeId);
  if (referenceIndex < 0) {
    return Object.freeze({
      layoutModels: document.layoutModels,
      parentLayoutReference: null
    });
  }
  const references = model.references.slice();
  const [reference] = references.splice(referenceIndex, 1);
  const layoutModels = document.layoutModels.slice();
  layoutModels[modelIndex] = tilingLayoutModel({ ...model, references });
  return Object.freeze({
    layoutModels: Object.freeze(layoutModels),
    parentLayoutReference: Object.freeze({ index: referenceIndex, reference })
  });
}

function withParentLayoutReference (layoutModels, parentId, nodeId, state, command) {
  if (!state) return layoutModels;
  if (state.reference.targetId !== nodeId) {
    throw new ComponentCommandError(
      'Introduced layout references must target the introduced node',
      command
    );
  }
  const modelIndex = layoutModels.findIndex(model => model.ownerId === parentId);
  if (modelIndex < 0) {
    throw new ComponentCommandError(`Unknown parent layout model ${parentId}`, command);
  }
  const model = layoutModels[modelIndex];
  if (state.index > model.references.length ||
      model.references.some(reference => reference.targetId === nodeId)) {
    throw new ComponentCommandError('Invalid introduced layout-reference position', command);
  }
  const references = model.references.slice();
  references.splice(state.index, 0, state.reference);
  const updatedLayoutModels = layoutModels.slice();
  updatedLayoutModels[modelIndex] = tilingLayoutModel({ ...model, references });
  return Object.freeze(updatedLayoutModels);
}

function withSubtreeLayoutModels (layoutModels, states, command) {
  if (!states?.length) return layoutModels;
  const updatedLayoutModels = layoutModels.slice();
  const ownerIds = new Set(updatedLayoutModels.map(model => model.ownerId));
  for (const { index, model } of states) {
    if (index > updatedLayoutModels.length || ownerIds.has(model.ownerId)) {
      throw new ComponentCommandError('Invalid introduced subtree layout-model position', command);
    }
    updatedLayoutModels.splice(index, 0, model);
    ownerIds.add(model.ownerId);
  }
  return Object.freeze(updatedLayoutModels);
}

function requireNode (document, nodeId, command) {
  const node = findComponentNode(document, nodeId);
  if (!node) throw new ComponentCommandError(`Unknown component node ${nodeId}`, command);
  return node;
}

function reduceProperty (document, command, property = command.property, entry = command.entry) {
  const node = requireNode(document, command.nodeId, command);
  const previousEntry = node.properties[property];
  const properties = { ...node.properties, [property]: entry };
  const root = replaceNode(document.root, node.id, current => current.with({ properties }));
  const inverseCommand = previousEntry
    ? SetPropertyEntry({
        componentId: document.componentId,
        expectedRevision: nextRevision(document),
        nodeId: node.id,
        property,
        entry: previousEntry
      })
    : ClearPropertyOverride({
        componentId: document.componentId,
        expectedRevision: nextRevision(document),
        nodeId: node.id,
        property
      });
  return result(document, root, inverseCommand, {
    kind: ComponentSemanticDeltaKind.PROPERTY_SET,
    nodeId: node.id,
    property,
    before: previousEntry,
    after: entry,
    requiredBindings: command.requiredBindings || Object.freeze([])
  });
}

function reduceClearProperty (document, command) {
  const node = requireNode(document, command.nodeId, command);
  const previousEntry = node.properties[command.property];
  if (!previousEntry) {
    throw new ComponentCommandError(`No local override for ${node.id}.${command.property}`, command);
  }
  const properties = { ...node.properties };
  delete properties[command.property];
  const root = replaceNode(document.root, node.id, current => current.with({ properties }));
  return result(document, root, SetPropertyEntry({
    componentId: document.componentId,
    expectedRevision: nextRevision(document),
    nodeId: node.id,
    property: command.property,
    entry: previousEntry
  }), {
    kind: ComponentSemanticDeltaKind.PROPERTY_CLEARED,
    nodeId: node.id,
    property: command.property,
    before: previousEntry
  });
}

function reduceRename (document, command) {
  const node = requireNode(document, command.nodeId, command);
  const root = replaceNode(document.root, node.id, current => current.with({ name: command.name }));
  return result(document, root, RenameNode({
    componentId: document.componentId,
    expectedRevision: nextRevision(document),
    nodeId: node.id,
    name: node.name
  }), {
    kind: ComponentSemanticDeltaKind.NODE_RENAMED,
    nodeId: node.id,
    before: node.name,
    after: command.name
  });
}

function reduceIntroduce (document, command) {
  if (findComponentNode(document, command.node.id)) {
    throw new ComponentCommandError(`Duplicate component node ID ${command.node.id}`, command);
  }
  if (command.node.provenance.kind === ComponentNodeProvenanceKind.INHERITED) {
    throw new ComponentCommandError('Inherited nodes must be restored, not introduced', command);
  }
  const parent = requireNode(document, command.parentId, command);
  const index = command.beforeId === null || command.beforeId === undefined
    ? parent.children.length
    : parent.children.findIndex(child => child.id === command.beforeId);
  const runtimeIndex = command.runtimeIndex ?? runtimeIndexAt(parent, index);
  const root = replaceNode(document.root, parent.id, current =>
    insertChild(current, command.node, command.beforeId, command));
  const layoutModels = withParentLayoutReference(
    withSubtreeLayoutModels(document.layoutModels, command.subtreeLayoutModels, command),
    parent.id,
    command.node.id,
    command.parentLayoutReference,
    command
  );
  return result(document, root, RemoveNode({
    componentId: document.componentId,
    expectedRevision: nextRevision(document),
    nodeId: command.node.id,
    runtimeIndex
  }), {
    kind: ComponentSemanticDeltaKind.NODE_INTRODUCED,
    nodeId: command.node.id,
    parentId: parent.id,
    beforeId: command.beforeId ?? null,
    index,
    runtimeIndex,
    requiredBindings: command.requiredBindings
  }, layoutModels);
}

function reduceRemove (document, command) {
  const node = requireNode(document, command.nodeId, command);
  if (node === document.root) throw new ComponentCommandError('Cannot remove a component root', command);
  if (node.provenance.kind === ComponentNodeProvenanceKind.INHERITED) {
    throw new ComponentCommandError('Inherited nodes must be suppressed, not removed', command);
  }
  const parent = findComponentParent(document, node.id);
  const index = parent.children.indexOf(node);
  const runtimeIndex = command.runtimeIndex ?? runtimeIndexAt(parent, index);
  const beforeId = parent.children[index + 1]?.id ?? null;
  const rootWithOrderingAnchors = retargetAddedOrderingAnchors(
    document.root,
    parent.id,
    node.id,
    beforeId
  );
  const { root } = removeNodeFromTree(rootWithOrderingAnchors, node.id);
  const withoutReference = withoutParentLayoutReference(
    document,
    parent.id,
    node.id
  );
  const removedIds = descendantIds(node);
  const subtreeLayoutModels = withoutReference.layoutModels.flatMap((model, index) =>
    removedIds.has(model.ownerId) ? [{ index, model }] : []);
  const layoutModels = withoutReference.layoutModels
    .filter(model => !removedIds.has(model.ownerId));
  return result(document, root, IntroduceNode({
    componentId: document.componentId,
    expectedRevision: nextRevision(document),
    nodeId: node.id,
    parentId: parent.id,
    node,
    beforeId,
    runtimeIndex,
    ...(withoutReference.parentLayoutReference
      ? { parentLayoutReference: withoutReference.parentLayoutReference }
      : {}),
    ...(subtreeLayoutModels.length ? { subtreeLayoutModels } : {})
  }), {
    kind: ComponentSemanticDeltaKind.NODE_REMOVED,
    nodeId: node.id,
    parentId: parent.id,
    index,
    runtimeIndex
  }, layoutModels);
}

function retargetAddedOrderingAnchors (root, parentId, removedNodeId, beforeId) {
  return replaceNode(root, parentId, current =>
    current.with({
      children: current.children.map(child =>
        child.provenance.kind === ComponentNodeProvenanceKind.ADDED &&
        child.provenance.beforeId === removedNodeId
          ? child.with({ provenance: addedNodeProvenance({ beforeId }) })
          : child)
    }));
}

function reduceMove (document, command) {
  const node = requireNode(document, command.nodeId, command);
  if (node === document.root) throw new ComponentCommandError('Cannot move a component root', command);
  const oldParent = findComponentParent(document, node.id);
  const oldIndex = oldParent.children.indexOf(node);
  const runtimeFromIndex = command.runtimeFromIndex ?? runtimeIndexAt(oldParent, oldIndex);
  const oldBeforeId = oldParent.children[oldIndex + 1]?.id ?? null;
  const destination = requireNode(document, command.parentId, command);
  if (descendantIds(node).has(destination.id)) {
    throw new ComponentCommandError('Cannot move a node into its own subtree', command);
  }
  if (command.beforeId === node.id) {
    throw new ComponentCommandError('A node cannot be ordered before itself', command);
  }
  const crossesSourceOwnershipBoundary = oldParent.id !== destination.id;
  const orderingDependants = crossesSourceOwnershipBoundary
    ? oldParent.children.filter(child =>
        child.provenance.kind === ComponentNodeProvenanceKind.ADDED &&
        child.provenance.beforeId === node.id)
    : [];
  const inverseOrderingRestorations = new Map(orderingDependants.map(child => [
    child.id,
    {
      nodeId: child.id,
      beforeId: child.provenance.beforeId,
      beforeName: child.provenance.beforeName
    }
  ]));
  for (const restoration of command.orderingRestorations || []) {
    const restoredNode = requireNode(document, restoration.nodeId, command);
    if (restoredNode.provenance.kind !== ComponentNodeProvenanceKind.ADDED) {
      throw new ComponentCommandError('Only added-node ordering can be restored', command);
    }
    inverseOrderingRestorations.set(restoredNode.id, {
      nodeId: restoredNode.id,
      beforeId: restoredNode.provenance.beforeId,
      beforeName: restoredNode.provenance.beforeName
    });
  }
  if (command.inheritanceTransition?.kind ===
      ComponentMoveInheritanceTransitionKind.MATERIALIZE) {
    if (node.provenance.kind !== ComponentNodeProvenanceKind.INHERITED ||
        node.provenance.suppressed) {
      throw new ComponentCommandError('Only visible inherited nodes can be materialized', command);
    }
    const materializedNode = command.inheritanceTransition.node;
    if (materializedNode.provenance.kind === ComponentNodeProvenanceKind.INHERITED ||
        findComponentNode(document, materializedNode.id)) {
      throw new ComponentCommandError('Materialized inherited nodes require a new local identity', command);
    }
    const suppressed = node.with({
      provenance: inheritedNodeProvenance({ ...node.provenance, suppressed: true })
    });
    let root = replaceNode(document.root, node.id, () => suppressed);
    const destinationAfterSuppression = findComponentNode(
      new ComponentDocument({ ...document, root }),
      destination.id
    );
    root = replaceNode(root, destinationAfterSuppression.id, current =>
      insertChild(current, materializedNode, command.beforeId, command));
    const movedDocument = new ComponentDocument({ ...document, root });
    const destinationAfterMove = findComponentNode(movedDocument, destination.id);
    const toIndex = destinationAfterMove.children.findIndex(child =>
      child.id === materializedNode.id);
    const runtimeToIndex = command.runtimeToIndex ?? runtimeIndexAt(
      destinationAfterMove,
      toIndex
    );
    return result(document, root, MoveNode({
      componentId: document.componentId,
      expectedRevision: nextRevision(document),
      nodeId: materializedNode.id,
      parentId: oldParent.id,
      beforeId: oldBeforeId,
      runtimeFromIndex: runtimeToIndex,
      runtimeToIndex: runtimeFromIndex,
      inheritanceTransition: {
        kind: ComponentMoveInheritanceTransitionKind.RESTORE,
        inheritedNodeId: node.id
      }
    }), {
      kind: ComponentSemanticDeltaKind.NODE_MOVED,
      inheritanceTransition: ComponentMoveInheritanceTransitionKind.MATERIALIZE,
      inheritedNodeId: node.id,
      nodeId: materializedNode.id,
      fromParentId: oldParent.id,
      fromIndex: oldIndex,
      runtimeFromIndex,
      toParentId: destination.id,
      toIndex,
      runtimeToIndex,
      beforeId: command.beforeId ?? null,
      requiredBindings: command.inheritanceTransition.requiredBindings
    });
  }
  if (command.inheritanceTransition?.kind ===
      ComponentMoveInheritanceTransitionKind.RESTORE) {
    const inheritedNode = requireNode(
      document,
      command.inheritanceTransition.inheritedNodeId,
      command
    );
    if (node.provenance.kind === ComponentNodeProvenanceKind.INHERITED ||
        inheritedNode.provenance.kind !== ComponentNodeProvenanceKind.INHERITED ||
        !inheritedNode.provenance.suppressed || destination.id !== oldParent.id &&
        destination.id !== findComponentParent(document, inheritedNode.id)?.id) {
      throw new ComponentCommandError('Inherited restoration move has stale structure', command);
    }
    const materializedBeforeId = oldParent.children[oldIndex + 1]?.id ?? null;
    const removed = removeNodeFromTree(document.root, node.id);
    const root = replaceNode(removed.root, inheritedNode.id, current => current.with({
      provenance: inheritedNodeProvenance({ ...current.provenance, suppressed: false })
    }));
    const restoredParent = findComponentParent(
      new ComponentDocument({ ...document, root }),
      inheritedNode.id
    );
    const toIndex = restoredParent.children.findIndex(child => child.id === inheritedNode.id);
    const runtimeToIndex = command.runtimeToIndex ?? runtimeIndexAt(restoredParent, toIndex);
    return result(document, root, MoveNode({
      componentId: document.componentId,
      expectedRevision: nextRevision(document),
      nodeId: inheritedNode.id,
      parentId: oldParent.id,
      beforeId: materializedBeforeId,
      runtimeFromIndex: runtimeToIndex,
      runtimeToIndex: runtimeFromIndex,
      inheritanceTransition: {
        kind: ComponentMoveInheritanceTransitionKind.MATERIALIZE,
        node,
        requiredBindings: []
      }
    }), {
      kind: ComponentSemanticDeltaKind.NODE_MOVED,
      inheritanceTransition: ComponentMoveInheritanceTransitionKind.RESTORE,
      inheritedNodeId: inheritedNode.id,
      nodeId: node.id,
      fromParentId: oldParent.id,
      fromIndex: oldIndex,
      runtimeFromIndex,
      toParentId: restoredParent.id,
      toIndex,
      runtimeToIndex,
      beforeId: command.beforeId ?? null
    });
  }
  const rootWithOrderingAnchors = crossesSourceOwnershipBoundary
    ? retargetAddedOrderingAnchors(
        document.root,
        oldParent.id,
        node.id,
        oldBeforeId
      )
    : document.root;
  const removed = removeNodeFromTree(rootWithOrderingAnchors, node.id);
  const destinationAfterRemoval = findComponentNode(
    new ComponentDocument({ ...document, root: removed.root }),
    destination.id
  );
  const destinationRequiresAddition =
    (document.parentComponent && destination.id === document.root.id) ||
    destination.provenance.kind === ComponentNodeProvenanceKind.INHERITED ||
    !!destination.partComponent;
  let movedProvenance = command.provenance || node.provenance;
  if (!command.provenance && crossesSourceOwnershipBoundary) {
    movedProvenance = destinationRequiresAddition
      ? addedNodeProvenance()
      : localNodeProvenance();
  }
  if (movedProvenance.kind === ComponentNodeProvenanceKind.ADDED) {
    movedProvenance = addedNodeProvenance(command.orderingName
      ? { beforeName: command.orderingName }
      : { beforeId: command.beforeId ?? null });
  }
  const movedNode = node.with({ provenance: movedProvenance });
  let root = replaceNode(removed.root, destinationAfterRemoval.id, current =>
    insertChild(current, movedNode, command.beforeId, command));
  for (const restoration of command.orderingRestorations || []) {
    root = replaceNode(root, restoration.nodeId, current => current.with({
      provenance: addedNodeProvenance(restoration.beforeName
        ? { beforeName: restoration.beforeName }
        : { beforeId: restoration.beforeId })
    }));
  }
  const movedDocument = new ComponentDocument({ ...document, root });
  const destinationAfterMove = findComponentNode(movedDocument, destination.id);
  const toIndex = destinationAfterMove.children.findIndex(child => child.id === node.id);
  const runtimeToIndex = command.runtimeToIndex ?? runtimeIndexAt(destinationAfterMove, toIndex);
  let layoutModels = document.layoutModels;
  let parentLayoutReference = null;
  if (oldParent.id !== destination.id) {
    const withoutReference = withoutParentLayoutReference(
      document,
      oldParent.id,
      node.id
    );
    parentLayoutReference = withoutReference.parentLayoutReference;
    layoutModels = withParentLayoutReference(
      withoutReference.layoutModels,
      destination.id,
      node.id,
      command.parentLayoutReference,
      command
    );
  }
  return result(document, root, MoveNode({
    componentId: document.componentId,
    expectedRevision: nextRevision(document),
    nodeId: node.id,
    parentId: oldParent.id,
    beforeId: oldBeforeId,
    provenance: node.provenance,
    runtimeFromIndex: runtimeToIndex,
    runtimeToIndex: runtimeFromIndex,
    ...(node.provenance.beforeName
      ? { orderingName: node.provenance.beforeName }
      : {}),
    ...(inverseOrderingRestorations.size
      ? { orderingRestorations: [...inverseOrderingRestorations.values()] }
      : {}),
    ...(parentLayoutReference ? { parentLayoutReference } : {})
  }), {
    kind: ComponentSemanticDeltaKind.NODE_MOVED,
    nodeId: node.id,
    fromParentId: oldParent.id,
    fromIndex: oldIndex,
    runtimeFromIndex,
    toParentId: destination.id,
    toIndex,
    runtimeToIndex,
    beforeId: command.beforeId ?? null,
    orderingName: command.orderingName ?? null
  }, layoutModels);
}

function updateSuppression (document, command, suppressed) {
  const node = requireNode(document, command.nodeId, command);
  if (node.provenance.kind !== ComponentNodeProvenanceKind.INHERITED) {
    throw new ComponentCommandError('Only inherited nodes can be suppressed or restored', command);
  }
  const parent = findComponentParent(document, node.id);
  if (!parent) {
    throw new ComponentCommandError('The inherited component root cannot be suppressed or restored', command);
  }
  const nodeIndex = parent.children.indexOf(node);
  const runtimeIndex = parent.children.slice(0, nodeIndex).filter(child =>
    child.provenance.kind !== ComponentNodeProvenanceKind.INHERITED ||
    !child.provenance.suppressed).length;
  if (node.provenance.suppressed === suppressed) {
    throw new ComponentCommandError(
      `Inherited node ${node.id} is already ${suppressed ? 'suppressed' : 'restored'}`,
      command
    );
  }
  const provenance = inheritedNodeProvenance({
    ...node.provenance,
    suppressed
  });
  const root = replaceNode(document.root, node.id, current => current.with({ provenance }));
  const inverseCommand = suppressed
    ? RestoreInheritedNode({
        componentId: document.componentId,
        expectedRevision: nextRevision(document),
        nodeId: node.id,
        parentId: parent.id,
        beforeId: node.provenance.beforeId
      })
    : SuppressInheritedNode({
        componentId: document.componentId,
        expectedRevision: nextRevision(document),
        nodeId: node.id
      });
  return result(document, root, inverseCommand, {
    kind: suppressed
      ? ComponentSemanticDeltaKind.NODE_SUPPRESSED
      : ComponentSemanticDeltaKind.NODE_RESTORED,
    nodeId: node.id,
    parentId: parent.id,
    index: runtimeIndex
  });
}

function reduceText (document, command) {
  const node = requireNode(document, command.nodeId, command);
  const currentEntry = node.properties.textAndAttributes;
  if (currentEntry?.kind !== ComponentPropertyKind.EXPLICIT_VALUE) {
    throw new ComponentCommandError(`Text editing requires an explicit textAndAttributes value for ${node.id}`, command);
  }
  const currentText = currentEntry.value;
  if (!semanticValuesEqual(currentText, command.operation.before)) {
    throw new ComponentCommandError(`Text precondition failed for ${node.id}`, command);
  }
  const properties = {
    ...node.properties,
    textAndAttributes: explicitProperty(command.operation.after)
  };
  const root = replaceNode(document.root, node.id, current => current.with({ properties }));
  return result(document, root, EditText({
    componentId: document.componentId,
    expectedRevision: nextRevision(document),
    nodeId: node.id,
    operation: {
      kind: command.operation.kind,
      before: command.operation.after,
      after: command.operation.before
    }
  }), {
    kind: ComponentSemanticDeltaKind.TEXT_EDITED,
    nodeId: node.id,
    operation: command.operation
  });
}

export function reduceComponent (document, command) {
  assertComponentDocument(document);
  if (command.componentId !== document.componentId) {
    throw new ComponentCommandError('Command targets a different component', command);
  }
  if (command.expectedRevision !== document.revision) {
    throw new ComponentCommandError(
      `Expected component revision ${command.expectedRevision}, got ${document.revision}`,
      command
    );
  }
  switch (command.kind) {
    case ComponentCommandKind.SET_PROPERTY:
      return reduceProperty(document, command);
    case ComponentCommandKind.CLEAR_PROPERTY_OVERRIDE:
      return reduceClearProperty(document, command);
    case ComponentCommandKind.RENAME_NODE:
      return reduceRename(document, command);
    case ComponentCommandKind.INTRODUCE_NODE:
      return reduceIntroduce(document, command);
    case ComponentCommandKind.MOVE_NODE:
      return reduceMove(document, command);
    case ComponentCommandKind.REMOVE_NODE:
      return reduceRemove(document, command);
    case ComponentCommandKind.SUPPRESS_INHERITED_NODE:
      return updateSuppression(document, command, true);
    case ComponentCommandKind.RESTORE_INHERITED_NODE:
      return updateSuppression(document, command, false);
    case ComponentCommandKind.SET_MASTER:
      return reduceProperty(document, command, 'master', command.entry);
    case ComponentCommandKind.EDIT_TEXT:
      return reduceText(document, command);
    default:
      throw new ComponentCommandError(`Unsupported component command ${command.kind}`, command);
  }
}
