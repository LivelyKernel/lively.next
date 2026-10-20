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
  const children = morph?.submorphs || morph?.children || [];
  return morph?.isText
    ? children.filter(child => !morph.textAndAttributes.includes(child))
    : children;
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

/** Copy only when the base subtree already represents all derived-local state. */
function isCopyableIntroducedSubtree (document, node) {
  return node.provenance.kind === ComponentNodeProvenanceKind.INHERITED &&
    !node.provenance.hasLocalOverrides && isRuntimeVisible(document, node.id) &&
    visibleChildren(document, node).every(child => isCopyableIntroducedSubtree(document, child));
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

/** Prepare a detached copy or synthesized subtree before any transaction writes. */
function introductionOperation (component, nodeId, runtimeMorphs, sourceMorph, synthesizeIntroducedMorph, runtimeRenames, restoredMorph) {
  const { beforeDocument, document: afterDocument } = component.projection;
  const root = component.dependant._cachedComponent;
  const node = findComponentNode(afterDocument, nodeId);
  const parent = node && findComponentParent(afterDocument, nodeId);
  const parentBefore = parent && findComponentNode(beforeDocument, parent.id);
  const owner = parentBefore && resolveRuntimeNode(root, beforeDocument, parentBefore.id);
  if (!node || !parent || !parentBefore || (root && !owner)) {
    throw new Error(
      `Cached derived component ${component.exportName} cannot resolve the introduced runtime owner`
    );
  }
  if (owner) assertRuntimeOwnerMatchesDocument(owner, beforeDocument, parentBefore);
  const copyable = !restoredMorph && isCopyableIntroducedSubtree(afterDocument, node);
  if (!restoredMorph && !copyable && !synthesizeIntroducedMorph) {
    throw new Error(`Cached derived runtime introduction for ${node.name} requires local synthesis`);
  }
  if (copyable && typeof sourceMorph?.copy !== 'function') {
    throw new Error(
      `Cached derived component ${component.exportName} cannot copy the introduced runtime node`
    );
  }
  const target = restoredMorph || (copyable
    ? sourceMorph.copy()
    : synthesizeIntroducedMorph(component, nodeId));
  if (!target || target === sourceMorph || target.owner) {
    throw new Error(
      `Cached derived component ${component.exportName} produced an invalid runtime copy`
    );
  }
  // Name allocation happens before the originating runtime rename is applied.
  target.name = node.name;
  const renameCopiedDescendants = (morph, node) => {
    const rename = runtimeRenames.find(rename => rename.nodeId === node.id);
    if (rename) {
      if (morph.name !== rename.before) throw new Error(`Copied runtime node has stale name ${morph.name}`);
      morph.name = rename.after;
    }
    visibleChildren(afterDocument, node).forEach((child, index) => {
      const runtimeChild = childrenOf(morph)[index];
      if (runtimeChild) renameCopiedDescendants(runtimeChild, child);
    });
  };
  if (copyable) renameCopiedDescendants(target, node);
  assertRuntimeSubtreeMatchesDocument(target, afterDocument, node);
  const index = visibleChildren(afterDocument, parent)
    .findIndex(({ id }) => id === nodeId);
  if (index < 0) {
    throw new Error(
      `Cached derived component ${component.exportName} cannot place the introduced runtime node`
    );
  }
  const projectedNames = (owner ? childrenOf(owner) : visibleChildren(beforeDocument, parentBefore))
    .map(({ name }) => name);
  projectedNames.splice(index, 0, target.name);
  assertNamesMatch(projectedNames, afterDocument, parent);
  rememberRuntimeMorph(runtimeMorphs, target);
  if (owner) rememberRuntimeMorph(runtimeMorphs, owner);
  return new MoveMorph({
    morphId: target.id,
    from: detachedMorph(),
    to: attachedMorph({ ownerId: owner?.id || `${afterDocument.componentId}:${parent.id}`, index }),
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
  sourceMorph = null,
  synthesizeIntroducedMorph = null,
  runtimeRenames = [],
  restoredMorphs = new Map()
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
  let runtimeMorphs = new Map();
  const operations = [];
  const bindings = new Map();
  for (const component of components) {
    if (!component?.dependant) continue;
    const beforeVisible = isRuntimeVisible(component.projection.beforeDocument, nodeId);
    const afterVisible = isRuntimeVisible(component.projection.document, nodeId);
    if (!beforeVisible && !afterVisible) continue;
    const root = component.dependant?._cachedComponent;
    // Retain an activated override's template even when its editor opens only before replay.
    if (!root && !(commandKind === DerivedRuntimeStructureProjectionKind.INTRODUCE &&
        !beforeVisible && afterVisible && synthesizeIntroducedMorph &&
        !isCopyableIntroducedSubtree(component.projection.document,
          findComponentNode(component.projection.document, nodeId)))) continue;
    const operation = !beforeVisible && afterVisible
      ? introductionOperation(component, nodeId, runtimeMorphs, sourceMorph, synthesizeIntroducedMorph,
          runtimeRenames, restoredMorphs.get(component.dependant))
      : afterVisible
        ? movementOperation(component, nodeId, runtimeMorphs)
        : removalOperation(component, nodeId, runtimeMorphs);
    if (operation) {
      operations.push(operation);
      const target = runtimeMorphs.get(operation.morphId);
      bindings.set(operation.morphId, {
        component, target, detachedTargets: new WeakMap(root ? [[root, target]] : [])
      });
    }
  }
  if (!operations.length) return null;
  const changeSet = new MorphicChangeSet({
    id: `${changeSetId}:derived-structure-runtime`,
    label: 'project inherited structure into cached derived components',
    origin: 'runtime-projection',
    undoable: false,
    operations
  });
  const inverseChangeSet = changeSet.invert({
    id: `${changeSet.id}:inverse`, origin: 'runtime-projection'
  });
  return Object.freeze({
    changeSet,
    inverseChangeSet,
    resolveMorph: id => runtimeMorphs.get(id),
    /** Resolve name paths against the current session and use its physical morph ids. */
    changeSetForReplay: recorded => {
      runtimeMorphs = new Map();
      const reverse = recorded === inverseChangeSet;
      const rebound = [];
      for (const operation of recorded.operations) {
        const { component, target: original, detachedTargets } = bindings.get(operation.morphId);
        const root = component.dependant._cachedComponent;
        if (!root) continue;
        const { beforeDocument, document: afterDocument } = component.projection;
        const fromDocument = reverse ? afterDocument : beforeDocument;
        const toDocument = reverse ? beforeDocument : afterDocument;
        let target;
        if (operation.from.kind === 'attached') {
          target = resolveRuntimeNode(root, fromDocument, nodeId);
        } else {
          target = detachedTargets.get(root);
          if (!target) target = original.copy();
        }
        if (!target) throw new Error(`Current derived editable cannot resolve ${nodeId}`);
        detachedTargets.set(root, target);
        rememberRuntimeMorph(runtimeMorphs, target);
        const attachment = (recordedAttachment, document) => {
          if (recordedAttachment.kind === 'detached') return detachedMorph();
          const parent = findComponentParent(document, nodeId);
          const owner = parent && resolveRuntimeNode(root, document, parent.id);
          if (!owner) throw new Error(`Current derived editable cannot resolve the owner of ${nodeId}`);
          rememberRuntimeMorph(runtimeMorphs, owner);
          return attachedMorph({ ownerId: owner.id, index: recordedAttachment.index });
        };
        rebound.push(new MoveMorph({
          morphId: target.id,
          from: attachment(operation.from, fromDocument),
          to: attachment(operation.to, toDocument),
          metadata: operation.metadata
        }));
      }
      return new MorphicChangeSet({ ...recorded, operations: rebound });
    }
  });
}
