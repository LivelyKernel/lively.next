import {
  ComponentDocument,
  ComponentNodeProvenanceKind,
  findComponentLayoutModel,
  findComponentNode,
  findComponentParent
} from './component-document.js';
import { parseComponentSource } from './source-adapter.js';

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

function allNodes (document) {
  const nodes = [];
  const visit = node => {
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
  if (localParentLayout && !parentLayoutModel) {
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
  const nameLocation = parsedBefore.document.sourceMetadata
    .propertyLocations?.[nodeId]?.name?.value;
  if (nameLocation) {
    changes.push(Object.freeze({
      action: 'replace',
      start: nameLocation.start,
      end: nameLocation.end,
      text: JSON.stringify(afterParentNode.name)
    }));
  }
  if (layoutReferenceLocation) {
    changes.push(Object.freeze({
      action: 'replace',
      start: layoutReferenceLocation.start,
      end: layoutReferenceLocation.end,
      text: JSON.stringify(afterParentNode.name)
    }));
  }
  const suppressionLocation = parsedBefore.document.sourceMetadata
    .suppressionLocations?.[nodeId];
  if (suppressionLocation) {
    changes.push(Object.freeze({
      action: 'replace',
      start: suppressionLocation.start,
      end: suppressionLocation.end,
      text: `without(${JSON.stringify(afterParentNode.name)})`
    }));
  }
  for (const node of allNodes(parsedBefore.document)) {
    if (node.provenance.kind !== ComponentNodeProvenanceKind.ADDED ||
        node.provenance.beforeId !== nodeId) continue;
    const location = parsedBefore.document.sourceMetadata.orderingLocations?.[node.id];
    if (!location) continue;
    changes.push(Object.freeze({
      action: 'replace',
      start: location.start,
      end: location.end,
      text: JSON.stringify(afterParentNode.name)
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
  resolveComponentDocument = null
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
    !findComponentLayoutModel(parsedBefore.document, ownerId));
  if (unmodeledLayoutOwnerId) {
    return unsupportedResult(source, [diagnostic(
      DerivedProjectionDiagnosticKind.SOURCE_UNSUPPORTED,
      'Derived structural propagation cannot safely model owner layout references',
      { ownerId: unmodeledLayoutOwnerId }
    )], parsedBefore.document);
  }
  const afterIds = new Set(allNodes(afterParentDocument).map(({ id }) => id));
  const removedRootIds = new Set(allNodes(beforeParentDocument)
    .filter(node => !afterIds.has(node.id))
    .filter(node => {
      const parent = findComponentParent(beforeParentDocument, node.id);
      return parent && afterIds.has(parent.id);
    })
    .map(({ id }) => id));
  const hasRetainedRemovalIntent = [...removedRootIds].some(id =>
    parsedBefore.document.sourceMetadata.nodeIdToAstLocation?.[id] ||
    parsedBefore.document.sourceMetadata.suppressionLocations?.[id]);
  let changes = [];
  for (const model of parsedBefore.document.layoutModels) {
    if (!afterIds.has(model.ownerId)) continue;
    const afterOwner = findComponentNode(afterParentDocument, model.ownerId);
    for (let index = 0; index < model.references.length; index++) {
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
  if (!hasRetainedRemovalIntent && removedRootIds.size) {
    changes = [...changes, ...allNodes(parsedBefore.document)
      .filter(node => removedRootIds.has(node.provenance.beforeId))
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
  let parsedAfter = parseComponentSource({
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

function graphFailure (diagnostics, components = []) {
  return Object.freeze({
    supported: false,
    components: Object.freeze(components.slice()),
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
          `Could not propagate a rename into ${key}`,
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
  if (graphDiagnostic) return graphFailure([graphDiagnostic], components);
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
    projectComponent: projectionOptions => projectDerivedComponentRename({
      ...projectionOptions,
      nodeId: options.nodeId
    })
  });
}

export function planDerivedComponentStructurePropagation (options) {
  return planDerivedComponentPropagation({
    ...options,
    projectComponent: projectDerivedComponentStructure
  });
}
