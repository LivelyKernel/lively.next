import {
  MoveMorph,
  MorphicChangeSet,
  attachedMorph,
  detachedMorph
} from 'lively.morphic/changes/index.js';
import {
  ComponentNodeProvenanceKind,
  findComponentNode,
  findComponentParent
} from './component-document.js';

export const DerivedRuntimeStructureProjectionKind = Object.freeze({
  INTRODUCE: 'introduce',
  REMOVE: 'remove',
  MOVE: 'move'
});

function childrenOf (morph) {
  return morph?.submorphs || morph?.children || [];
}

function componentNodeNamePath (document, nodeId) {
  const visit = (node, path) => {
    if (node.id === nodeId) return path;
    for (const child of node.children) {
      const found = visit(child, path.concat(child.name));
      if (found) return found;
    }
    return null;
  };
  return visit(document.root, []);
}

function isSuppressed (node) {
  return node.provenance.kind === ComponentNodeProvenanceKind.INHERITED &&
    node.provenance.suppressed;
}

function isRuntimeVisible (document, nodeId) {
  let node = findComponentNode(document, nodeId);
  if (!node) return false;
  while (node) {
    if (isSuppressed(node)) return false;
    node = findComponentParent(document, node.id);
  }
  return true;
}

function visibleChildren (document, parent) {
  return parent.children.filter(child => isRuntimeVisible(document, child.id));
}

function resolveRuntimeNode (root, document, nodeId) {
  const path = componentNodeNamePath(document, nodeId);
  if (!path) return null;
  let target = root;
  for (const name of path) {
    target = childrenOf(target).find(morph => morph.name === name);
    if (!target) return null;
  }
  return target;
}

function assertRuntimeOwnerMatchesDocument (owner, document, parent) {
  const actualNames = childrenOf(owner).map(({ name }) => name);
  const expectedNames = visibleChildren(document, parent).map(({ name }) => name);
  if (actualNames.length !== expectedNames.length ||
      actualNames.some((name, index) => name !== expectedNames[index])) {
    throw new Error(`Cached derived runtime owner ${parent.name} has stale children`);
  }
}

function assertNamesMatch (actualNames, document, parent) {
  const expectedNames = visibleChildren(document, parent).map(({ name }) => name);
  if (actualNames.length !== expectedNames.length ||
      actualNames.some((name, index) => name !== expectedNames[index])) {
    throw new Error(`Cached derived runtime transition for ${parent.name} is incomplete`);
  }
}

function rememberRuntimeMorph (runtimeMorphs, morph) {
  if (typeof morph?.id !== 'string' || !morph.id) {
    throw new Error('Cached derived runtime nodes require stable morph ids');
  }
  const existing = runtimeMorphs.get(morph.id);
  if (existing && existing !== morph) {
    throw new Error(`Cached derived runtime morph id ${morph.id} is ambiguous`);
  }
  runtimeMorphs.set(morph.id, morph);
}

function assertCopyableIntroducedSubtree (document, node) {
  if (node.provenance.kind !== ComponentNodeProvenanceKind.INHERITED ||
      node.provenance.hasLocalOverrides || !isRuntimeVisible(document, node.id)) {
    throw new Error(
      `Cached derived runtime introduction for ${node.name} requires local synthesis`
    );
  }
  node.children.forEach(child => assertCopyableIntroducedSubtree(document, child));
}

function assertRuntimeSubtreeMatchesDocument (runtimeMorph, document, node) {
  if (runtimeMorph?.name !== node.name) {
    throw new Error(`Copied runtime node does not match introduced node ${node.name}`);
  }
  const runtimeChildren = childrenOf(runtimeMorph);
  const documentChildren = visibleChildren(document, node);
  if (runtimeChildren.length !== documentChildren.length) {
    throw new Error(`Copied runtime subtree for ${node.name} has stale children`);
  }
  runtimeChildren.forEach((child, index) => {
    assertRuntimeSubtreeMatchesDocument(child, document, documentChildren[index]);
  });
}

function operationMetadata (component) {
  return {
    origin: 'runtime-projection',
    reconcileChanges: false,
    componentId: component.projection.document.componentId
  };
}

function introductionOperation (component, nodeId, runtimeMorphs, sourceMorph) {
  const { beforeDocument, document: afterDocument } = component.projection;
  const root = component.dependant._cachedComponent;
  const node = findComponentNode(afterDocument, nodeId);
  const parent = node && findComponentParent(afterDocument, nodeId);
  const parentBefore = parent && findComponentNode(beforeDocument, parent.id);
  const owner = parentBefore && resolveRuntimeNode(root, beforeDocument, parentBefore.id);
  if (!node || !parent || !parentBefore || !owner) {
    throw new Error(
      `Cached derived component ${component.exportName} cannot resolve the introduced runtime owner`
    );
  }
  assertRuntimeOwnerMatchesDocument(owner, beforeDocument, parentBefore);
  assertCopyableIntroducedSubtree(afterDocument, node);
  if (!sourceMorph || typeof sourceMorph.copy !== 'function') {
    throw new Error(
      `Cached derived component ${component.exportName} cannot copy the introduced runtime node`
    );
  }
  const target = sourceMorph.copy();
  if (!target || target === sourceMorph || target.owner) {
    throw new Error(
      `Cached derived component ${component.exportName} produced an invalid runtime copy`
    );
  }
  assertRuntimeSubtreeMatchesDocument(target, afterDocument, node);
  const index = visibleChildren(afterDocument, parent)
    .findIndex(({ id }) => id === nodeId);
  if (index < 0) {
    throw new Error(
      `Cached derived component ${component.exportName} cannot place the introduced runtime node`
    );
  }
  const projectedNames = childrenOf(owner).map(({ name }) => name);
  projectedNames.splice(index, 0, target.name);
  assertNamesMatch(projectedNames, afterDocument, parent);
  rememberRuntimeMorph(runtimeMorphs, target);
  rememberRuntimeMorph(runtimeMorphs, owner);
  return new MoveMorph({
    morphId: target.id,
    from: detachedMorph(),
    to: attachedMorph({ ownerId: owner.id, index }),
    metadata: operationMetadata(component)
  });
}

function removalOperation (component, nodeId, runtimeMorphs) {
  const { beforeDocument, document: afterDocument } = component.projection;
  const root = component.dependant._cachedComponent;
  const target = resolveRuntimeNode(root, beforeDocument, nodeId);
  const parent = findComponentParent(beforeDocument, nodeId);
  const owner = parent && resolveRuntimeNode(root, beforeDocument, parent.id);
  if (!target || !parent || !owner || target.owner !== owner) {
    throw new Error(
      `Cached derived component ${component.exportName} is missing the removed runtime node`
    );
  }
  assertRuntimeOwnerMatchesDocument(owner, beforeDocument, parent);
  const index = childrenOf(owner).indexOf(target);
  if (index < 0) {
    throw new Error(
      `Cached derived component ${component.exportName} has stale runtime structure`
    );
  }
  const projectedNames = childrenOf(owner).map(({ name }) => name);
  projectedNames.splice(index, 1);
  const afterParent = findComponentNode(afterDocument, parent.id);
  if (!afterParent) {
    throw new Error(
      `Cached derived component ${component.exportName} also removes the runtime owner`
    );
  }
  assertNamesMatch(projectedNames, afterDocument, afterParent);
  rememberRuntimeMorph(runtimeMorphs, target);
  rememberRuntimeMorph(runtimeMorphs, owner);
  return new MoveMorph({
    morphId: target.id,
    from: attachedMorph({ ownerId: owner.id, index }),
    to: detachedMorph(),
    metadata: operationMetadata(component)
  });
}

function movementOperation (component, nodeId, runtimeMorphs) {
  const { beforeDocument, document: afterDocument } = component.projection;
  const root = component.dependant._cachedComponent;
  const beforeParent = findComponentParent(beforeDocument, nodeId);
  const afterParent = findComponentParent(afterDocument, nodeId);
  const destinationParentBefore = afterParent &&
    findComponentNode(beforeDocument, afterParent.id);
  const target = resolveRuntimeNode(root, beforeDocument, nodeId);
  const sourceOwner = beforeParent &&
    resolveRuntimeNode(root, beforeDocument, beforeParent.id);
  const destinationOwner = afterParent &&
    resolveRuntimeNode(root, beforeDocument, afterParent.id);
  if (!target || !beforeParent || !afterParent || !destinationParentBefore ||
      !sourceOwner || !destinationOwner ||
      target.owner !== sourceOwner) {
    throw new Error(
      `Cached derived component ${component.exportName} cannot resolve the moved runtime node`
    );
  }
  assertRuntimeOwnerMatchesDocument(sourceOwner, beforeDocument, beforeParent);
  if (destinationOwner !== sourceOwner) {
    assertRuntimeOwnerMatchesDocument(
      destinationOwner,
      beforeDocument,
      destinationParentBefore
    );
  }
  const fromIndex = childrenOf(sourceOwner).indexOf(target);
  const toIndex = visibleChildren(afterDocument, afterParent)
    .findIndex(({ id }) => id === nodeId);
  if (fromIndex < 0 || toIndex < 0) {
    throw new Error(
      `Cached derived component ${component.exportName} has stale runtime ordering`
    );
  }
  const sourceNames = childrenOf(sourceOwner).map(({ name }) => name);
  const [targetName] = sourceNames.splice(fromIndex, 1);
  if (sourceOwner === destinationOwner) {
    sourceNames.splice(toIndex, 0, targetName);
    assertNamesMatch(sourceNames, afterDocument, afterParent);
  } else {
    const destinationNames = childrenOf(destinationOwner).map(({ name }) => name);
    destinationNames.splice(toIndex, 0, targetName);
    const sourceParentAfter = findComponentNode(afterDocument, beforeParent.id);
    if (!sourceParentAfter) {
      throw new Error(
        `Cached derived component ${component.exportName} also removes the source owner`
      );
    }
    assertNamesMatch(sourceNames, afterDocument, sourceParentAfter);
    assertNamesMatch(destinationNames, afterDocument, afterParent);
  }
  if (sourceOwner === destinationOwner && fromIndex === toIndex) return null;
  rememberRuntimeMorph(runtimeMorphs, target);
  rememberRuntimeMorph(runtimeMorphs, sourceOwner);
  rememberRuntimeMorph(runtimeMorphs, destinationOwner);
  return new MoveMorph({
    morphId: target.id,
    from: attachedMorph({ ownerId: sourceOwner.id, index: fromIndex }),
    to: attachedMorph({ ownerId: destinationOwner.id, index: toIndex }),
    metadata: operationMetadata(component)
  });
}

export function projectCachedDerivedRuntimeStructure ({
  components,
  nodeId,
  commandKind,
  changeSetId,
  sourceMorph = null
}) {
  if (!Array.isArray(components)) {
    throw new Error('Cached derived runtime projection requires component plans');
  }
  if (![
    DerivedRuntimeStructureProjectionKind.INTRODUCE,
    DerivedRuntimeStructureProjectionKind.REMOVE,
    DerivedRuntimeStructureProjectionKind.MOVE
  ]
    .includes(commandKind)) {
    throw new Error(`Unsupported cached derived runtime structure command: ${commandKind}`);
  }
  const runtimeMorphs = new Map();
  const operations = [];
  for (const component of components) {
    if (!component?.dependant?._cachedComponent) continue;
    const beforeVisible = isRuntimeVisible(component.projection.beforeDocument, nodeId);
    const afterVisible = isRuntimeVisible(component.projection.document, nodeId);
    if (!beforeVisible && !afterVisible) continue;
    const operation = !beforeVisible && afterVisible
      ? introductionOperation(component, nodeId, runtimeMorphs, sourceMorph)
      : afterVisible
        ? movementOperation(component, nodeId, runtimeMorphs)
        : removalOperation(component, nodeId, runtimeMorphs);
    if (operation) operations.push(operation);
  }
  if (!operations.length) return null;
  const changeSet = new MorphicChangeSet({
    id: `${changeSetId}:derived-structure-runtime`,
    label: 'project inherited structure into cached derived components',
    origin: 'runtime-projection',
    undoable: false,
    operations
  });
  return Object.freeze({
    changeSet,
    inverseChangeSet: changeSet.invert({
      id: `${changeSet.id}:inverse`,
      origin: 'runtime-projection'
    }),
    resolveMorph: id => runtimeMorphs.get(id)
  });
}
