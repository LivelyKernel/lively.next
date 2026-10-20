import {
  ComponentDocument,
  ComponentNodeProvenanceKind,
  findComponentLayoutModel,
  findComponentNode,
  findComponentParent
} from './component-document.js';
import {
  layoutPropertyCannotReferenceChildren,
  parseComponentSource
} from './source-adapter.js';
import {
  insertMovedNodeChange,
  pruneEmptyOverrideChanges,
  suppressionRemovalChange
} from './source-projector.js';

export const DerivedProjectionDiagnosticKind = Object.freeze({
  INVALID_PARENT_TRANSITION: 'invalid-parent-transition',
  DEPENDENCY_GRAPH_INVALID: 'dependency-graph-invalid',
  SOURCE_UNSUPPORTED: 'source-unsupported',
  PROJECTED_SOURCE_INVALID: 'projected-source-invalid'
});

function diagnostic (kind, message, details = {}) {
  return Object.freeze({ kind, message, ...details });
}

function unsupportedResult (source, diagnostics, beforeDocument = null) {
  return Object.freeze({
    supported: false,
    sourceBefore: source,
    sourceAfter: source,
    beforeDocument,
    document: null,
    changes: Object.freeze([]),
    diagnostics: Object.freeze(diagnostics)
  });
}

/** Enumerate document nodes, optionally excluding suppressed subtrees. */
function allNodes (document, visibleOnly = false) {
  const nodes = [];
  const visit = node => {
    if (visibleOnly && node.provenance.suppressed) return;
    nodes.push(node);
    node.children.forEach(visit);
  };
  visit(document.root);
  return nodes;
}

function applyChanges (source, changes) {
  return changes
    .slice()
    .sort((left, right) => right.start - left.start)
    .reduce((updated, change) =>
      `${updated.slice(0, change.start)}${change.text}${updated.slice(change.end)}`, source);
}

function removeLayoutReferenceChange (document, model, referenceIndex) {
  const locations = model.references.map(reference => document.sourceMetadata
    .layoutReferenceLocations?.[model.ownerId]?.[reference.targetId]?.entry);
  if (locations.some(location => !location)) return null;
  const location = locations[referenceIndex];
  const previous = locations[referenceIndex - 1];
  const next = locations[referenceIndex + 1];
  return Object.freeze({
    action: 'remove',
    start: next ? location.start : previous ? previous.end : location.start,
    end: next ? next.start : location.end,
    text: ''
  });
}

export function projectDerivedComponentRename ({
  source,
  moduleId,
  exportName,
  componentId = `${moduleId}#${exportName}`,
  beforeParentDocument,
  afterParentDocument,
  nodeId,
  resolveComponentDocument = null
}) {
  if (typeof source !== 'string') throw new Error('Derived rename projection requires source');
  if (!(beforeParentDocument instanceof ComponentDocument) ||
      !(afterParentDocument instanceof ComponentDocument)) {
    throw new Error('Derived rename projection requires parent documents before and after');
  }
  const beforeParentNode = findComponentNode(beforeParentDocument, nodeId);
  const afterParentNode = findComponentNode(afterParentDocument, nodeId);
  if (!beforeParentNode || !afterParentNode || beforeParentNode.name === afterParentNode.name) {
    return unsupportedResult(source, [diagnostic(
      DerivedProjectionDiagnosticKind.INVALID_PARENT_TRANSITION,
      `Parent rename transition is unavailable for ${nodeId}`,
      { nodeId }
    )]);
  }

  const parsedBefore = parseComponentSource({
    source,
    moduleId,
    exportName,
    componentId,
    parentDocument: beforeParentDocument,
    resolveComponentDocument
  });
  if (!parsedBefore.supported || !parsedBefore.document.parentComponent) {
    return unsupportedResult(source, [diagnostic(
      DerivedProjectionDiagnosticKind.SOURCE_UNSUPPORTED,
      'Derived component source could not be modeled before propagation',
      { sourceDiagnostics: parsedBefore.diagnostics }
    )]);
  }
  const parentNode = findComponentParent(parsedBefore.document, nodeId);
  const localParentLayout = parentNode &&
    parsedBefore.document.sourceMetadata.propertyLocations?.[parentNode.id]?.layout;
  const parentLayoutModel = parentNode &&
    findComponentLayoutModel(parsedBefore.document, parentNode.id);
  if (localParentLayout && !parentLayoutModel &&
      !layoutPropertyCannotReferenceChildren(parentNode.properties.layout)) {
    return unsupportedResult(source, [diagnostic(
      DerivedProjectionDiagnosticKind.SOURCE_UNSUPPORTED,
      'Derived rename propagation cannot safely model owner layout references',
      { nodeId }
    )], parsedBefore.document);
  }
  const layoutReference = parentLayoutModel?.references.find(
    reference => reference.targetId === nodeId
  );
  const layoutReferenceLocation = layoutReference && parsedBefore.document.sourceMetadata
    .layoutReferenceLocations?.[parentNode.id]?.[nodeId]?.target;
  if (layoutReference && !layoutReferenceLocation) {
    return unsupportedResult(source, [diagnostic(
      DerivedProjectionDiagnosticKind.SOURCE_UNSUPPORTED,
      'Derived rename propagation has no source location for an owner layout reference',
      { nodeId }
    )], parsedBefore.document);
  }

  const changes = [];
  const metadata = parsedBefore.document.sourceMetadata;
  const replacementSelector = metadata.replacementSelectorLocations?.[nodeId];
  const ownName = metadata.propertyLocations?.[nodeId]?.name?.value;
  const nameLocation = replacementSelector || ownName;
  const beforeName = findComponentNode(parsedBefore.document, nodeId)?.name;
  const effectiveName = afterParentNode.name;
  if (nameLocation) {
    changes.push(Object.freeze({
      action: 'replace',
      start: nameLocation.start,
      end: nameLocation.end,
      text: JSON.stringify(afterParentNode.name)
    }));
  }
  if (layoutReferenceLocation && effectiveName !== beforeName) {
    changes.push(Object.freeze({
      action: 'replace',
      start: layoutReferenceLocation.start,
      end: layoutReferenceLocation.end,
      text: JSON.stringify(effectiveName)
    }));
  }
  const suppressionLocations = parsedBefore.document.sourceMetadata
    .suppressionLocationLists?.[nodeId] ||
    [parsedBefore.document.sourceMetadata.suppressionLocations?.[nodeId]].filter(Boolean);
  for (const suppressionLocation of suppressionLocations) {
    changes.push(Object.freeze({
      action: 'replace',
      start: suppressionLocation.start,
      end: suppressionLocation.end,
      text: `without(${JSON.stringify(afterParentNode.name)})`
    }));
  }
  for (const node of allNodes(parsedBefore.document)) {
    if (node.provenance.kind !== ComponentNodeProvenanceKind.ADDED ||
        node.provenance.beforeId !== nodeId || effectiveName === beforeName) continue;
    const location = parsedBefore.document.sourceMetadata.orderingLocations?.[node.id];
    if (!location) continue;
    changes.push(Object.freeze({
      action: 'replace',
      start: location.start,
      end: location.end,
      text: JSON.stringify(effectiveName)
    }));
  }

  const sourceAfter = applyChanges(source, changes);
  const parsedAfter = parseComponentSource({
    source: sourceAfter,
    moduleId,
    exportName,
    componentId,
    parentDocument: afterParentDocument,
    resolveComponentDocument
  });
  if (!parsedAfter.supported) {
    return unsupportedResult(source, [diagnostic(
      DerivedProjectionDiagnosticKind.PROJECTED_SOURCE_INVALID,
      'Derived component source stopped modeling after rename propagation',
      { sourceDiagnostics: parsedAfter.diagnostics }
    )], parsedBefore.document);
  }

  return Object.freeze({
    supported: true,
    sourceBefore: source,
    sourceAfter,
    beforeDocument: parsedBefore.document,
    document: parsedAfter.document,
    changes: Object.freeze(changes),
    diagnostics: Object.freeze([])
  });
}

export function projectDerivedComponentStructure ({
  source,
  moduleId,
  exportName,
  componentId = `${moduleId}#${exportName}`,
  beforeParentDocument,
  afterParentDocument,
  resolveComponentDocument = null,
  restoredOverride = null,
  introducedNodeId = null
}) {
  if (typeof source !== 'string') throw new Error('Derived structure projection requires source');
  if (!(beforeParentDocument instanceof ComponentDocument) ||
      !(afterParentDocument instanceof ComponentDocument)) {
    throw new Error('Derived structure projection requires parent documents before and after');
  }
  if (beforeParentDocument === afterParentDocument) {
    return unsupportedResult(source, [diagnostic(
      DerivedProjectionDiagnosticKind.INVALID_PARENT_TRANSITION,
      'Parent structural transition is unavailable'
    )]);
  }
  const parsedBefore = parseComponentSource({
    source,
    moduleId,
    exportName,
    componentId,
    parentDocument: beforeParentDocument,
    resolveComponentDocument
  });
  if (!parsedBefore.supported || !parsedBefore.document.parentComponent) {
    return unsupportedResult(source, [diagnostic(
      DerivedProjectionDiagnosticKind.SOURCE_UNSUPPORTED,
      'Derived component source could not be modeled before structural propagation',
      { sourceDiagnostics: parsedBefore.diagnostics }
    )]);
  }
  const localLayoutOwnerIds = Object.entries(
    parsedBefore.document.sourceMetadata.propertyLocations || {}
  ).filter(([, locations]) => locations.layout).map(([ownerId]) => ownerId);
  const unmodeledLayoutOwnerId = localLayoutOwnerIds.find(ownerId =>
    !findComponentLayoutModel(parsedBefore.document, ownerId) &&
    !layoutPropertyCannotReferenceChildren(
      findComponentNode(parsedBefore.document, ownerId).properties.layout));
  if (unmodeledLayoutOwnerId) {
    return unsupportedResult(source, [diagnostic(
      DerivedProjectionDiagnosticKind.SOURCE_UNSUPPORTED,
      'Derived structural propagation cannot safely model owner layout references',
      { ownerId: unmodeledLayoutOwnerId }
    )], parsedBefore.document);
  }
  const afterIds = new Set(allNodes(afterParentDocument, true).map(({ id }) => id));
  const removedRootIds = new Set(allNodes(beforeParentDocument, true)
    .filter(node => !afterIds.has(node.id))
    .filter(node => {
      const parent = findComponentParent(beforeParentDocument, node.id);
      return parent && afterIds.has(parent.id);
    })
    .map(({ id }) => id));
  const movedRootIds = allNodes(beforeParentDocument, true).filter(node => {
    const beforeOwner = findComponentParent(beforeParentDocument, node.id);
    const afterOwner = findComponentParent(afterParentDocument, node.id);
    return afterIds.has(node.id) && beforeOwner && afterOwner && beforeOwner.id !== afterOwner.id;
  }).map(node => node.id);
  let changes = [];
  for (const model of parsedBefore.document.layoutModels) {
    if (!afterIds.has(model.ownerId)) continue;
    const beforeOwner = findComponentNode(beforeParentDocument, model.ownerId);
    const afterOwner = findComponentNode(afterParentDocument, model.ownerId);
    for (let index = 0; index < model.references.length; index++) {
      // Local additions belong to the derived override and move with it.
      if (!beforeOwner?.children.some(child => child.id === model.references[index].targetId)) continue;
      if (afterOwner?.children.some(child =>
        child.id === model.references[index].targetId)) continue;
      const change = removeLayoutReferenceChange(parsedBefore.document, model, index);
      if (!change) {
        return unsupportedResult(source, [diagnostic(
          DerivedProjectionDiagnosticKind.SOURCE_UNSUPPORTED,
          'Derived structural propagation has no source location for a layout reference',
          { ownerId: model.ownerId, nodeId: model.references[index].targetId }
        )], parsedBefore.document);
      }
      changes.push(change);
    }
  }
  if (removedRootIds.size || movedRootIds.length) {
    changes = [...changes, ...allNodes(parsedBefore.document)
      .filter(node => {
        const anchor = node.provenance.beforeId;
        return removedRootIds.has(anchor) || movedRootIds.includes(anchor);
      })
      .map(node => parsedBefore.document.sourceMetadata.orderingLocations?.[node.id])
      .filter(Boolean)
      .map(location => {
        let start = location.start;
        while (start > 0 && /\s/.test(source[start - 1])) start--;
        if (source[start - 1] === ',') start--;
        return Object.freeze({
          action: 'remove',
          start,
          end: location.end,
          text: ''
        });
      })];
  }
  let sourceAfter = applyChanges(source, changes);
  const parseWithParent = parentDocument => parseComponentSource({
    source: sourceAfter, moduleId, exportName, componentId, parentDocument, resolveComponentDocument
  });
  let current = parseWithParent(beforeParentDocument);
  const relocations = [];
  // Reparse each removal so adjacent entries and pruned paths cannot overlap.
  for (const id of [...removedRootIds, ...movedRootIds]) {
    if (!current.supported) break;
    const metadata = current.document.sourceMetadata;
    const location = metadata.nodeIdToAstLocation?.[id];
    const suppressions = metadata.suppressionLocationLists?.[id] || [];
    if (movedRootIds.includes(id)) {
      relocations.push({ id, entries: [location, ...suppressions].filter(Boolean)
        .map(range => sourceAfter.slice(range.start, range.end)) });
    }
    while (current.supported) {
      const locations = current.document.sourceMetadata;
      const entry = locations.nodeIdToAstLocation?.[id] || locations.suppressionLocations?.[id];
      if (!entry) break;
      const removal = suppressionRemovalChange(sourceAfter, entry);
      const removals = pruneEmptyOverrideChanges(sourceAfter, current.document, [removal], new Set());
      sourceAfter = applyChanges(sourceAfter, removals);
      current = parseWithParent(beforeParentDocument);
    }
  }
  if (current.supported) current = parseWithParent(afterParentDocument);
  for (const { id, entries } of relocations) {
    for (const entry of entries) {
      if (!current.supported) break;
      const owner = findComponentParent(current.document, id);
      const index = owner?.children.findIndex(child => child.id === id);
      const insertion = owner && insertMovedNodeChange(sourceAfter, current.document, owner.id, index, entry);
      if (!insertion) {
        return unsupportedResult(source, [diagnostic(
          DerivedProjectionDiagnosticKind.SOURCE_UNSUPPORTED,
          'Derived override cannot be relocated to the new owner', { nodeId: id }
        )], parsedBefore.document);
      }
      sourceAfter = applyChanges(sourceAfter, [insertion]);
      current = parseWithParent(afterParentDocument);
    }
  }
  if (current.supported && restoredOverride) {
    const restored = restoredOverrideSource(restoredOverride, afterParentDocument,
      introducedNodeId, resolveComponentDocument);
    if (restored) {
      const owner = findComponentParent(current.document, introducedNodeId);
      const insertion = owner && insertMovedNodeChange(sourceAfter, current.document,
        owner.id, owner.children.findIndex(node => node.id === introducedNodeId), restored);
      if (!insertion) return unsupportedResult(source, [diagnostic(
        DerivedProjectionDiagnosticKind.SOURCE_UNSUPPORTED,
        'Removed derived override cannot be restored at its new position'
      )], parsedBefore.document);
      sourceAfter = applyChanges(sourceAfter, [insertion]);
      current = parseWithParent(afterParentDocument);
    }
  }
  if (sourceAfter !== applyChanges(source, changes)) {
    const range = parsedBefore.document.sourceMetadata.componentRange;
    const end = range.end + sourceAfter.length - source.length;
    changes = [Object.freeze({ action: 'replace', start: range.start, end: range.end,
      text: sourceAfter.slice(range.start, end) })];
  }
  const parsedAfter = current;
  if (!parsedAfter.supported) {
    return unsupportedResult(source, [diagnostic(
      DerivedProjectionDiagnosticKind.PROJECTED_SOURCE_INVALID,
      'Derived source is incompatible with the parent structural transition',
      { sourceDiagnostics: parsedAfter.diagnostics }
    )], parsedBefore.document);
  }
  return Object.freeze({
    supported: true,
    sourceBefore: source,
    sourceAfter,
    beforeDocument: parsedBefore.document,
    document: parsedAfter.document,
    changes: Object.freeze(changes),
    diagnostics: Object.freeze([])
  });
}

/** Reconcile the retained override against surviving descendants before reinserting it. */
function restoredOverrideSource (retained, afterParent, nodeId, resolveComponentDocument) {
  const { projection, parentDocument, nodeId: oldId } = retained;
  const oldNode = findComponentNode(parentDocument, oldId);
  const newNode = findComponentNode(afterParent, nodeId);
  if (!oldNode || !newNode) throw new Error('Removed override has no matching parent subtree');
  const remap = (node, old) => node.with({
    id: old?.id || node.id,
    children: node.children.map(child => remap(child,
      old?.children.find(candidate => candidate.name === child.name)))
  });
  const replace = node => node.id === oldId
    ? remap(newNode, oldNode).with({ name: oldNode.name })
    : node.with({ children: node.children.map(replace) });
  const parent = new ComponentDocument({ ...parentDocument, root: replace(parentDocument.root) });
  const pruned = projectDerivedComponentStructure({
    source: projection.sourceBefore,
    moduleId: projection.beforeDocument.moduleId,
    exportName: projection.beforeDocument.exportName,
    componentId: projection.beforeDocument.componentId,
    beforeParentDocument: parentDocument,
    afterParentDocument: parent,
    resolveComponentDocument
  });
  if (!pruned.supported) throw new Error('Removed derived override could not be reconciled');
  let source = pruned.sourceAfter;
  let document = pruned.document;
  if (oldNode.name !== newNode.name) {
    const renamedParent = new ComponentDocument({ ...parent,
      root: (function rename (node) {
        return node.id === oldId ? node.with({ name: newNode.name })
          : node.with({ children: node.children.map(rename) });
      })(parent.root) });
    const renamed = projectDerivedComponentRename({ source, moduleId: document.moduleId,
      exportName: document.exportName, componentId: document.componentId,
      beforeParentDocument: parent, afterParentDocument: renamedParent,
      nodeId: oldId, resolveComponentDocument });
    if (!renamed.supported) throw new Error('Removed derived override could not be renamed');
    source = renamed.sourceAfter;
    document = renamed.document;
  }
  const location = document.sourceMetadata.nodeIdToAstLocation?.[oldId];
  return location ? source.slice(location.start, location.end) : null;
}

/** A rejected graph must never expose a partially planned component list to cache consumers. */
function graphFailure (diagnostics) {
  return Object.freeze({
    supported: false,
    components: Object.freeze([]),
    modules: Object.freeze([]),
    diagnostics: Object.freeze(diagnostics)
  });
}

/**
 * Plans rename propagation through a component-derivation graph without
 * mutating descriptors, modules, documents, or runtime instances.
 *
 * `describeComponent` supplies source and identity for a dependant. Sources
 * are threaded per module so multiple component definitions in one module do
 * not overwrite one another's projected changes.
 */
function planDerivedComponentPropagation ({
  root,
  beforeParentDocument,
  afterParentDocument,
  getDependants,
  describeComponent,
  projectComponent
}) {
  if (typeof getDependants !== 'function' || typeof describeComponent !== 'function' ||
      typeof projectComponent !== 'function') {
    throw new Error('Derived propagation planning requires graph accessors');
  }
  const components = [];
  const moduleSources = new Map();
  const visited = new Set();
  const visiting = new Set();

  const visit = (parent, beforeDocument, afterDocument) => {
    const dependants = getDependants(parent);
    if (!Array.isArray(dependants)) {
      return diagnostic(
        DerivedProjectionDiagnosticKind.DEPENDENCY_GRAPH_INVALID,
        'Derived component dependants must be returned as an array'
      );
    }
    for (const dependant of dependants) {
      let description;
      try {
        description = describeComponent(dependant);
      } catch (error) {
        return diagnostic(
          DerivedProjectionDiagnosticKind.DEPENDENCY_GRAPH_INVALID,
          error.message,
          { error }
        );
      }
      const { moduleId, exportName } = description || {};
      if (typeof moduleId !== 'string' || !moduleId ||
          typeof exportName !== 'string' || !exportName ||
          typeof description.source !== 'string') {
        return diagnostic(
          DerivedProjectionDiagnosticKind.DEPENDENCY_GRAPH_INVALID,
          'A derived component is missing source identity'
        );
      }
      const key = `${moduleId}#${exportName}`;
      if (visiting.has(key)) {
        return diagnostic(
          DerivedProjectionDiagnosticKind.DEPENDENCY_GRAPH_INVALID,
          `Component derivation cycle detected at ${key}`,
          { moduleId, exportName }
        );
      }
      if (visited.has(key)) continue;
      visiting.add(key);

      const moduleSource = moduleSources.get(moduleId);
      const source = moduleSource?.sourceAfter ?? description.source;
      if (moduleSource && description.source !== moduleSource.sourceBefore) {
        return diagnostic(
          DerivedProjectionDiagnosticKind.DEPENDENCY_GRAPH_INVALID,
          `Derived components disagree about the source snapshot for ${moduleId}`,
          { moduleId, exportName }
        );
      }
      const projection = projectComponent({
        ...description,
        source,
        beforeParentDocument: beforeDocument,
        afterParentDocument: afterDocument
      });
      if (!projection.supported) {
        return diagnostic(
          DerivedProjectionDiagnosticKind.SOURCE_UNSUPPORTED,
          `Could not propagate the component edit into ${key}`,
          { moduleId, exportName, sourceDiagnostics: projection.diagnostics }
        );
      }

      moduleSources.set(moduleId, {
        moduleId,
        sourceBefore: moduleSource?.sourceBefore ?? description.source,
        sourceAfter: projection.sourceAfter
      });
      components.push(Object.freeze({
        dependant,
        moduleId,
        exportName,
        projection
      }));
      const nestedDiagnostic = visit(
        dependant,
        projection.beforeDocument,
        projection.document
      );
      if (nestedDiagnostic) return nestedDiagnostic;
      visiting.delete(key);
      visited.add(key);
    }
    return null;
  };

  const graphDiagnostic = visit(root, beforeParentDocument, afterParentDocument);
  if (graphDiagnostic) return graphFailure([graphDiagnostic]);
  return Object.freeze({
    supported: true,
    components: Object.freeze(components),
    modules: Object.freeze([...moduleSources.values()].map(plan => Object.freeze(plan))),
    diagnostics: Object.freeze([])
  });
}

export function planDerivedComponentRenamePropagation (options) {
  return planDerivedComponentPropagation({
    ...options,
    projectComponent: projectionOptions => {
      const before = findComponentNode(projectionOptions.beforeParentDocument, options.nodeId);
      const after = findComponentNode(projectionOptions.afterParentDocument, options.nodeId);
      // A named replacement can shield its own dependants from the base rename.
      return before && after && before.name === after.name
        ? projectDerivedComponentStructure(projectionOptions)
        : projectDerivedComponentRename({ ...projectionOptions, nodeId: options.nodeId });
    }
  });
}

export function planDerivedComponentStructurePropagation (options) {
  return planDerivedComponentPropagation({
    ...options,
    projectComponent: projectionOptions => projectDerivedComponentStructure({
      ...projectionOptions,
      introducedNodeId: options.introducedNodeId,
      restoredOverride: options.restoredOverrides?.get(projectionOptions.exportName + '\n' + projectionOptions.moduleId)
    })
  });
}
