import {
  ComponentDocument,
  ComponentNode,
  ComponentNodeProvenanceKind,
  ComponentPropertyKind,
  findComponentLayoutModel,
  findComponentNode,
  findComponentParent
} from './component-document.js';
import { ComponentSemanticDeltaKind } from './reducer.js';
import { ComponentMoveInheritanceTransitionKind } from './commands.js';
import { parseComponentSource } from './source-adapter.js';
import {
  ComponentImportKind,
  componentImportBinding
} from './import-bindings.js';
import { parse } from 'lively.ast';

export const ComponentSourceProjectionDiagnosticKind = Object.freeze({
  UNSUPPORTED_DELTA: 'unsupported-delta',
  MISSING_SOURCE_METADATA: 'missing-source-metadata',
  UNSUPPORTED_EXPLICIT_VALUE: 'unsupported-explicit-value',
  IMPORT_BINDING_CONFLICT: 'import-binding-conflict',
  PROJECTED_SOURCE_INVALID: 'projected-source-invalid',
  PROJECTED_SEMANTICS_MISMATCH: 'projected-semantics-mismatch'
});

function diagnostic (kind, message, details = {}) {
  return Object.freeze({ kind, message, ...details });
}

function explicitValueSource (value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Object.is(value, -0) ? '-0' : String(value);
  }
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index++) {
      if (!(index in value)) return null;
    }
    const values = value.map(explicitValueSource);
    if (values.every(source => source !== null)) return `[${values.join(', ')}]`;
    return null;
  }
  if (value && Object.getPrototypeOf(value) === Object.prototype) {
    const entries = Object.entries(value).map(([key, nested]) => {
      const nestedSource = explicitValueSource(nested);
      return nestedSource === null ? null : `${JSON.stringify(key)}: ${nestedSource}`;
    });
    if (entries.every(Boolean)) return `{ ${entries.join(', ')} }`;
  }
  return null;
}

function propertyEntrySource (entry) {
  if (entry?.kind === ComponentPropertyKind.OPAQUE_EXPRESSION) return entry.expression;
  if (entry?.kind === ComponentPropertyKind.EXPLICIT_VALUE) {
    return explicitValueSource(entry.value);
  }
  return null;
}

function propertyKeySource (property) {
  return /^[A-Za-z_$][\w$]*$/.test(property) ? property : JSON.stringify(property);
}

function componentNodeSource (node, document, insidePartOverride = false) {
  const entries = [`name: ${JSON.stringify(node.name)}`];
  if (node.typeExpression) entries.push(`type: ${node.typeExpression}`);
  for (const [property, entry] of Object.entries(node.properties)) {
    const valueSource = propertyEntrySource(entry);
    if (typeof valueSource !== 'string') return null;
    entries.push(`${propertyKeySource(property)}: ${valueSource}`);
  }
  if (node.children.length) {
    const childSources = node.children.map(child => {
      const childSource = componentNodeSource(child, document, !!node.partComponent);
      if (childSource === null) return null;
      return child.provenance.kind === ComponentNodeProvenanceKind.INHERITED &&
        child.provenance.suppressed
        ? `${childSource}, without(${JSON.stringify(child.name)})`
        : childSource;
    });
    if (childSources.some(source => source === null)) return null;
    entries.push(`submorphs: [${childSources.join(', ')}]`);
  }
  const specification = `{ ${entries.join(', ')} }`;
  const nodeSource = node.partComponent &&
      (!insidePartOverride ||
        node.provenance.kind === ComponentNodeProvenanceKind.ADDED)
    ? `part(${node.partComponent.expression}, ${specification})`
    : specification;
  if (node.provenance.kind !== ComponentNodeProvenanceKind.ADDED) return nodeSource;
  const before = node.provenance.beforeId && findComponentNode(document, node.provenance.beforeId);
  const beforeName = node.provenance.beforeName || before?.name || null;
  return `add(${nodeSource}${beforeName ? `, ${JSON.stringify(beforeName)}` : ''})`;
}

function indentationAt (source, index) {
  const lineStart = source.lastIndexOf('\n', index - 1) + 1;
  return source.slice(lineStart, index).match(/^[ \t]*/)[0];
}

function orderedPropertyLocations (document, nodeId) {
  return Object.entries(document.sourceMetadata.propertyLocations?.[nodeId] || {})
    .map(([property, location]) => ({ property, ...location }))
    .sort((left, right) => left.start - right.start);
}

function insertPropertyChange (source, document, nodeId, property, valueSource) {
  const nodeLocation = document.sourceMetadata.nodeSpecLocations?.[nodeId] ||
    document.sourceMetadata.nodeIdToAstLocation?.[nodeId];
  if (!nodeLocation) return null;
  const locations = orderedPropertyLocations(document, nodeId);
  const parentIndent = indentationAt(source, nodeLocation.start);
  const firstPropertyLineStart = locations.length
    ? source.lastIndexOf('\n', locations[0].start - 1) + 1
    : null;
  const firstPropertyStartsLine = locations.length &&
    !source.slice(firstPropertyLineStart, locations[0].start).trim();
  const propertyIndent = locations.length
    ? firstPropertyStartsLine
      ? indentationAt(source, locations[0].start)
      : `${parentIndent}  `
    : `${parentIndent}  `;
  const propertySource = `${propertyKeySource(property)}: ${valueSource}`;
  const submorphs = locations.find(location => location.property === 'submorphs');
  if (submorphs) {
    return Object.freeze({
      action: 'insert',
      start: submorphs.start,
      end: submorphs.start,
      text: `${propertySource},\n${propertyIndent}`
    });
  }
  const lastProperty = locations[locations.length - 1];
  if (lastProperty) {
    return Object.freeze({
      action: 'insert',
      start: lastProperty.end,
      end: lastProperty.end,
      text: `,\n${propertyIndent}${propertySource}`
    });
  }
  return Object.freeze({
    action: 'insert',
    start: nodeLocation.start + 1,
    end: nodeLocation.start + 1,
    text: `\n${propertyIndent}${propertySource}\n${parentIndent}`
  });
}

function removePropertyChange (source, document, nodeId, property) {
  const locations = orderedPropertyLocations(document, nodeId);
  const index = locations.findIndex(location => location.property === property);
  if (index < 0) return null;
  const location = locations[index];
  const previous = locations[index - 1];
  const next = locations[index + 1];
  if (next) {
    return Object.freeze({
      action: 'remove',
      start: location.start,
      end: next.start,
      text: ''
    });
  }
  if (previous) {
    return Object.freeze({
      action: 'remove',
      start: previous.end,
      end: location.end,
      text: ''
    });
  }
  let end = location.end;
  while (source[end] === ' ' || source[end] === '\t') end++;
  if (source[end] === ',') end++;
  return Object.freeze({
    action: 'remove',
    start: location.start,
    end,
    text: ''
  });
}

function removeNodeChange (source, document, nodeId, parentId) {
  const parent = findComponentNode(document, parentId);
  const location = document.sourceMetadata.nodeIdToAstLocation?.[nodeId];
  if (!parent || !location) return null;
  const sourceOrderedLocations = parent.children
    .map(child => document.sourceMetadata.nodeIdToAstLocation?.[child.id])
    .filter(Boolean)
    .sort((left, right) => left.start - right.start);
  const index = sourceOrderedLocations.findIndex(candidate =>
    candidate.start === location.start && candidate.end === location.end);
  if (index < 0) return null;
  const previousLocation = sourceOrderedLocations[index - 1];
  const nextLocation = sourceOrderedLocations[index + 1];
  if (nextLocation) {
    return Object.freeze({
      action: 'remove',
      start: location.start,
      end: nextLocation.start,
      text: ''
    });
  }
  if (previousLocation) {
    return Object.freeze({
      action: 'remove',
      start: previousLocation.end,
      end: location.end,
      text: ''
    });
  }
  let end = location.end;
  while (source[end] === ' ' || source[end] === '\t' || source[end] === '\n') end++;
  if (source[end] === ',') end++;
  return Object.freeze({
    action: 'remove',
    start: location.start,
    end,
    text: ''
  });
}

function introduceNodeChange (source, document, parentId, nodeSource) {
  const parent = findComponentNode(document, parentId);
  if (!parent) return null;
  if (document.sourceMetadata.opaqueSubmorphExpressions?.[parentId]) return null;
  const submorphsLocation = document.sourceMetadata
    .propertyLocations?.[parentId]?.submorphs?.value;
  if (!submorphsLocation) {
    return insertPropertyChange(source, document, parentId, 'submorphs', `[${nodeSource}]`);
  }
  return Object.freeze({
    action: 'insert',
    start: submorphsLocation.end - 1,
    end: submorphsLocation.end - 1,
    text: `${parent.children.length ? ', ' : ''}${nodeSource}`
  });
}

function insertMovedNodeChange (source, document, parentId, index, nodeSource) {
  const parent = findComponentNode(document, parentId);
  if (!parent || !Number.isInteger(index) || index < 0 || index > parent.children.length) {
    return null;
  }
  if (index === parent.children.length) {
    return introduceNodeChange(source, document, parentId, nodeSource);
  }
  const targetLocation = document.sourceMetadata
    .nodeIdToAstLocation?.[parent.children[index].id];
  if (!targetLocation) return null;
  return Object.freeze({
    action: 'insert',
    start: targetLocation.start,
    end: targetLocation.start,
    text: `${nodeSource}, `
  });
}

function movedNodeSource (source, beforeDocument, afterDocument, nodeId) {
  const nodeLocation = beforeDocument.sourceMetadata.nodeIdToAstLocation?.[nodeId];
  const beforeNode = findComponentNode(beforeDocument, nodeId);
  const node = findComponentNode(afterDocument, nodeId);
  if (!nodeLocation || !beforeNode || !node) return null;
  let nodeSource = source.slice(nodeLocation.start, nodeLocation.end);
  const wasAdded = beforeNode.provenance.kind === ComponentNodeProvenanceKind.ADDED;
  const isAdded = node.provenance.kind === ComponentNodeProvenanceKind.ADDED;
  if (wasAdded && !isAdded) {
    try {
      const expression = parse(nodeSource).body?.[0]?.expression;
      if (!helperCallExpression(expression, 'add') || !expression.arguments[0]) return null;
      return nodeSource.slice(expression.arguments[0].start, expression.arguments[0].end);
    } catch (error) {
      return null;
    }
  }
  if (!wasAdded && isAdded) {
    const before = node.provenance.beforeId && findComponentNode(afterDocument, node.provenance.beforeId);
    const beforeName = node.provenance.beforeName || before?.name || null;
    return `add(${nodeSource}${beforeName ? `, ${JSON.stringify(beforeName)}` : ''})`;
  }
  if (!isAdded) return nodeSource;

  const orderingLocation = beforeDocument.sourceMetadata.orderingLocations?.[nodeId];
  const before = node.provenance.beforeId && findComponentNode(afterDocument, node.provenance.beforeId);
  const beforeName = node.provenance.beforeName || before?.name || null;
  const orderingSource = beforeName ? JSON.stringify(beforeName) : null;
  if (orderingLocation) {
    const orderingStart = orderingLocation.start - nodeLocation.start;
    const orderingEnd = orderingLocation.end - nodeLocation.start;
    if (orderingStart < 0 || orderingEnd > nodeSource.length) return null;
    if (orderingSource) {
      return nodeSource.slice(0, orderingStart) + orderingSource + nodeSource.slice(orderingEnd);
    }
    const delimiter = nodeSource.lastIndexOf(',', orderingStart);
    if (delimiter < 0) return null;
    return nodeSource.slice(0, delimiter) + nodeSource.slice(orderingEnd);
  }
  if (!orderingSource) return nodeSource;
  const callEnd = nodeSource.lastIndexOf(')');
  if (callEnd < 0) return null;
  return `${nodeSource.slice(0, callEnd)}, ${orderingSource}${nodeSource.slice(callEnd)}`;
}

function orderingRewriteChange (source, beforeDocument, afterDocument, nodeId) {
  const location = beforeDocument.sourceMetadata.nodeIdToAstLocation?.[nodeId];
  const text = movedNodeSource(source, beforeDocument, afterDocument, nodeId);
  if (!location || typeof text !== 'string') return null;
  return Object.freeze({
    action: 'replace',
    start: location.start,
    end: location.end,
    text
  });
}

function helperCallExpression (node, name) {
  return node?.type === 'CallExpression' &&
    node.callee?.type === 'Identifier' && node.callee.name === name;
}

function reparentNodeChanges (source, beforeDocument, afterDocument, semanticDelta) {
  const nodeLocation = beforeDocument.sourceMetadata
    .nodeIdToAstLocation?.[semanticDelta.nodeId];
  if (!nodeLocation) return null;
  const nodeSource = movedNodeSource(
    source,
    beforeDocument,
    afterDocument,
    semanticDelta.nodeId
  );
  if (nodeSource === null) return null;
  const removal = removeNodeChange(
    source,
    beforeDocument,
    semanticDelta.nodeId,
    semanticDelta.fromParentId
  );
  const insertion = insertMovedNodeChange(
    source,
    beforeDocument,
    semanticDelta.toParentId,
    semanticDelta.toIndex,
    nodeSource
  );
  const previousParent = findComponentNode(beforeDocument, semanticDelta.fromParentId);
  const orderingChanges = previousParent?.children
    .filter(child =>
      child.provenance.kind === ComponentNodeProvenanceKind.ADDED &&
      child.provenance.beforeId === semanticDelta.nodeId)
    .map(child => orderingRewriteChange(
      source,
      beforeDocument,
      afterDocument,
      child.id
    )) || [];
  return removal && insertion && orderingChanges.every(Boolean)
    ? [removal, insertion, ...orderingChanges]
    : null;
}

function suppressInheritedNodeChange (source, document, semanticDelta) {
  const node = findComponentNode(document, semanticDelta.nodeId);
  const parentId = semanticDelta.parentId;
  if (document.sourceMetadata.opaqueSubmorphExpressions?.[parentId]) return null;
  const arrayLocation = document.sourceMetadata
    .propertyLocations?.[parentId]?.submorphs?.value;
  const callSource = `without(${JSON.stringify(node?.name)})`;
  if (!node) return null;
  if (!arrayLocation) {
    return insertPropertyChange(source, document, parentId, 'submorphs', `[${callSource}]`);
  }
  const contents = source.slice(arrayLocation.start + 1, arrayLocation.end - 1);
  return Object.freeze({
    action: 'insert',
    start: arrayLocation.end - 1,
    end: arrayLocation.end - 1,
    text: `${contents.trim() ? ', ' : ''}${callSource}`
  });
}

function restoreInheritedNodeChange (source, document, semanticDelta) {
  const location = document.sourceMetadata.suppressionLocations?.[semanticDelta.nodeId];
  if (!location) return null;
  let end = location.end;
  while (/\s/.test(source[end] || '')) end++;
  if (source[end] === ',') {
    end++;
    return Object.freeze({ action: 'remove', start: location.start, end, text: '' });
  }
  let start = location.start;
  while (start > 0 && /\s/.test(source[start - 1])) start--;
  if (source[start - 1] === ',') start--;
  return Object.freeze({ action: 'remove', start, end: location.end, text: '' });
}

function reorderNodeChange (source, beforeDocument, afterDocument, parentId, movedNodeId) {
  const parentBefore = findComponentNode(beforeDocument, parentId);
  const parentAfter = findComponentNode(afterDocument, parentId);
  const arrayLocation = beforeDocument.sourceMetadata
    .propertyLocations?.[parentId]?.submorphs?.value;
  if (!parentBefore || !parentAfter || !arrayLocation ||
      parentBefore.children.length !== parentAfter.children.length) return null;
  const locations = parentBefore.children.map(child =>
    beforeDocument.sourceMetadata.nodeIdToAstLocation?.[child.id]);
  if (locations.some(location => !location)) return null;
  let text = source.slice(arrayLocation.start, locations[0].start);
  for (let index = 0; index < parentAfter.children.length; index++) {
    const child = parentAfter.children[index];
    const location = beforeDocument.sourceMetadata.nodeIdToAstLocation?.[child.id];
    if (!location) return null;
    const childSource = child.id === movedNodeId
      ? movedNodeSource(source, beforeDocument, afterDocument, child.id)
      : source.slice(location.start, location.end);
    if (childSource === null) return null;
    text += childSource;
    text += source.slice(
      locations[index].end,
      locations[index + 1]?.start ?? arrayLocation.end
    );
  }
  return Object.freeze({
    action: 'replace',
    start: arrayLocation.start,
    end: arrayLocation.end,
    text
  });
}

function renameLayoutReferenceChanges (document, nodeId, name) {
  const owner = findComponentParent(document, nodeId);
  const layoutLocation = owner && document.sourceMetadata
    .propertyLocations?.[owner.id]?.layout;
  if (!layoutLocation) return Object.freeze([]);
  const model = findComponentLayoutModel(document, owner.id);
  if (!model) {
    const layoutEntry = owner.properties.layout;
    return layoutEntryCannotReferenceChildren(layoutEntry)
      ? Object.freeze([])
      : null;
  }
  const reference = model.references.find(candidate => candidate.targetId === nodeId);
  if (!reference) return Object.freeze([]);
  const location = document.sourceMetadata
    .layoutReferenceLocations?.[owner.id]?.[nodeId]?.target;
  if (!location) return null;
  return Object.freeze([Object.freeze({
    action: 'replace',
    start: location.start,
    end: location.end,
    text: JSON.stringify(name)
  })]);
}

function removeLayoutReferenceChanges (document, nodeId) {
  const owner = findComponentParent(document, nodeId);
  const layoutLocation = owner && document.sourceMetadata
    .propertyLocations?.[owner.id]?.layout;
  if (!layoutLocation) return Object.freeze([]);
  const model = findComponentLayoutModel(document, owner.id);
  if (!model) {
    const layoutEntry = owner.properties.layout;
    return layoutEntryCannotReferenceChildren(layoutEntry)
      ? Object.freeze([])
      : null;
  }
  const referenceIndex = model.references.findIndex(reference =>
    reference.targetId === nodeId);
  if (referenceIndex < 0) return Object.freeze([]);
  const locations = model.references.map(reference => document.sourceMetadata
    .layoutReferenceLocations?.[owner.id]?.[reference.targetId]?.entry);
  if (locations.some(location => !location)) return null;
  const location = locations[referenceIndex];
  const previous = locations[referenceIndex - 1];
  const next = locations[referenceIndex + 1];
  return Object.freeze([Object.freeze({
    action: 'remove',
    start: next ? location.start : previous ? previous.end : location.start,
    end: next ? next.start : location.end,
    text: ''
  })]);
}

function layoutEntryCannotReferenceChildren (layoutEntry) {
  return (
    layoutEntry?.kind === ComponentPropertyKind.EXPLICIT_VALUE &&
    layoutEntry.value === null
  ) || (
    layoutEntry?.kind === ComponentPropertyKind.OPAQUE_EXPRESSION &&
    layoutEntry.expression.trim() === 'undefined'
  );
}

function applyChange (source, change) {
  return source.slice(0, change.start) + change.text + source.slice(change.end);
}

function applyChanges (source, changes) {
  return changes
    .slice()
    .sort((left, right) => right.start - left.start)
    .reduce((updated, change) => applyChange(updated, change), source);
}

function inheritedRenameChange (source, document, node, nameChange) {
  const baseName = node.provenance.baseName || node.name;
  if (node.name !== baseName) return nameChange;
  const nodeLocation = document.sourceMetadata.nodeIdToAstLocation?.[node.id];
  if (!nodeLocation || nameChange.start < nodeLocation.start ||
      nameChange.end > nodeLocation.end) return null;
  const nodeSource = source.slice(nodeLocation.start, nodeLocation.end);
  if (/^replace\s*\(/.test(nodeSource)) return nameChange;
  const renamedNodeSource = applyChange(nodeSource, {
    ...nameChange,
    start: nameChange.start - nodeLocation.start,
    end: nameChange.end - nodeLocation.start
  });
  return Object.freeze({
    action: 'replace',
    start: nodeLocation.start,
    end: nodeLocation.end,
    text: `replace(${JSON.stringify(baseName)}, ${renamedNodeSource})`
  });
}

function canonicalImportModuleId (moduleId) {
  const [packageName] = moduleId.split('/');
  if (packageName.startsWith('lively.')) return packageName;
  return moduleId.replace(/\/index\.js$/, '');
}

function sameImportBinding (left, right) {
  return left.kind === right.kind &&
    canonicalImportModuleId(left.moduleId) === canonicalImportModuleId(right.moduleId) &&
    left.imported === right.imported && left.local === right.local;
}

function importStatementSource (binding) {
  const moduleSource = JSON.stringify(binding.moduleId);
  if (binding.kind === ComponentImportKind.DEFAULT) {
    return `import ${binding.local} from ${moduleSource};`;
  }
  if (binding.kind === ComponentImportKind.NAMESPACE) {
    return `import * as ${binding.local} from ${moduleSource};`;
  }
  const imported = binding.imported === binding.local
    ? binding.imported
    : `${binding.imported} as ${binding.local}`;
  return `import { ${imported} } from ${moduleSource};`;
}

function importChangesFor (source, document, requiredBindings, diagnostics) {
  if (!requiredBindings?.length) return [];
  const existingBindings = document.sourceMetadata.importBindings || [];
  const missing = [];
  for (const required of requiredBindings) {
    if (existingBindings.some(existing => sameImportBinding(existing, required))) continue;
    const conflict = existingBindings.find(existing => existing.local === required.local);
    if (conflict) {
      diagnostics.push(diagnostic(
        ComponentSourceProjectionDiagnosticKind.IMPORT_BINDING_CONFLICT,
        `Local binding ${required.local} is already imported from ${conflict.moduleId}`,
        { requiredBinding: required, existingBinding: conflict }
      ));
      continue;
    }
    missing.push(required);
  }
  if (diagnostics.length || !missing.length) return [];
  const insertionIndex = document.sourceMetadata.importInsertionIndex;
  if (!Number.isInteger(insertionIndex) || insertionIndex < 0 || insertionIndex > source.length) {
    diagnostics.push(diagnostic(
      ComponentSourceProjectionDiagnosticKind.MISSING_SOURCE_METADATA,
      'The component document has no valid import insertion location'
    ));
    return [];
  }
  const statements = missing.map(importStatementSource).join('\n');
  const text = document.sourceMetadata.importDeclarationCount > 0
    ? `\n${statements}`
    : `${statements}\n\n`;
  return [Object.freeze({
    action: 'insert',
    start: insertionIndex,
    end: insertionIndex,
    text
  })];
}

function canonicalSemanticValue (value) {
  if (Array.isArray(value)) return value.map(canonicalSemanticValue);
  if (value && Object.getPrototypeOf(value) === Object.prototype) {
    if (value.kind === ComponentPropertyKind.OPAQUE_EXPRESSION) {
      return {
        kind: value.kind,
        expression: canonicalOpaqueExpression(value.expression)
      };
    }
    return Object.fromEntries(Object.keys(value).sort().map(key =>
      [key, canonicalSemanticValue(value[key])]
    ));
  }
  return value;
}

function canonicalOpaqueExpression (expression) {
  try {
    const expressionNode = parse(`(${expression})`).body[0].expression;
    const canonicalNode = value => {
      if (Array.isArray(value)) return value.map(canonicalNode);
      if (!value || typeof value !== 'object') return value;
      return Object.fromEntries(Object.keys(value)
        .filter(key =>
          !['start', 'end', 'loc'].includes(key) &&
          !(key === 'raw' && value.type === 'Literal'))
        .sort()
        .map(key => [key, canonicalNode(value[key])]));
    };
    return canonicalNode(expressionNode);
  } catch {
    return expression.trim();
  }
}

function semanticNodeSnapshot (node, modeledLayoutOwners) {
  return {
    id: node.id,
    name: node.name,
    provenance: canonicalSemanticValue(node.provenance),
    partComponent: canonicalSemanticValue(node.partComponent),
    typeExpression: node.typeExpression,
    properties: Object.fromEntries(Object.keys(node.properties).sort()
      .filter(property => property !== 'layout' || !modeledLayoutOwners.has(node.id))
      .map(property => [property, canonicalSemanticValue(node.properties[property])])),
    children: node.children.map(child => semanticNodeSnapshot(child, modeledLayoutOwners))
  };
}

function semanticSnapshotValue (document) {
  const modeledLayoutOwners = new Set(document.layoutModels.map(model => model.ownerId));
  return {
    componentId: document.componentId,
    moduleId: document.moduleId,
    exportName: document.exportName,
    parentComponent: canonicalSemanticValue(document.parentComponent),
    layoutModels: canonicalSemanticValue(document.layoutModels),
    root: semanticNodeSnapshot(document.root, modeledLayoutOwners)
  };
}

function semanticSnapshot (document) {
  return JSON.stringify(semanticSnapshotValue(document));
}

function documentWithProjectedPropertyEntry (
  document,
  projectedDocument,
  nodeId,
  property
) {
  const projectedNode = findComponentNode(projectedDocument, nodeId);
  if (!projectedNode) return document;
  const projectedEntry = projectedNode.properties[property];
  const replaceEntry = node => {
    if (node.id === nodeId) {
      const properties = { ...node.properties };
      if (projectedEntry === undefined) delete properties[property];
      else properties[property] = projectedEntry;
      return node.with({ properties });
    }
    return node.with({ children: node.children.map(replaceEntry) });
  };
  return new ComponentDocument({
    revision: document.revision,
    componentId: document.componentId,
    moduleId: document.moduleId,
    exportName: document.exportName,
    parentComponent: document.parentComponent,
    root: replaceEntry(document.root),
    layoutModels: document.layoutModels,
    sourceMetadata: document.sourceMetadata
  });
}

function firstSemanticDifference (left, right, path = []) {
  if (Object.is(left, right)) return null;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
      return { path, left, right };
    }
    for (let index = 0; index < left.length; index++) {
      const difference = firstSemanticDifference(left[index], right[index], [...path, index]);
      if (difference) return difference;
    }
    return null;
  }
  if (left && right && typeof left === 'object' && typeof right === 'object') {
    const keys = Array.from(new Set([...Object.keys(left), ...Object.keys(right)])).sort();
    for (const key of keys) {
      const difference = firstSemanticDifference(left[key], right[key], [...path, key]);
      if (difference) return difference;
    }
    return null;
  }
  return { path, left, right };
}

function semanticDifferenceMessage (actual, expected) {
  const actualSnapshot = semanticSnapshotValue(actual);
  const expectedSnapshot = semanticSnapshotValue(expected);
  const difference = firstSemanticDifference(actualSnapshot, expectedSnapshot);
  if (!difference) return 'unknown semantic difference';
  const printable = value => {
    const printed = JSON.stringify(value) ?? String(value);
    return printed.length > 160 ? `${printed.slice(0, 157)}...` : printed;
  };
  let context = '';
  if (difference.path[difference.path.length - 1] === 'id') {
    const nodePath = difference.path.slice(0, -1);
    const valueAt = (root, path) => path.reduce((value, key) => value?.[key], root);
    const actualNode = valueAt(actualSnapshot, nodePath);
    const expectedNode = valueAt(expectedSnapshot, nodePath);
    context = ` (nodes ${printable({
      name: actualNode?.name,
      children: actualNode?.children?.map(child => child.name)
    })}, expected ${printable({
      name: expectedNode?.name,
      children: expectedNode?.children?.map(child => child.name)
    })})`;
  }
  return `${difference.path.join('.')} is ${printable(difference.left)}, expected ${printable(difference.right)}${context}`;
}

export function alignParsedDocumentIdentities (parsedDocument, expectedDocument) {
  const idMap = new Map();
  const alignNode = (parsedNode, expectedNode) => {
    if (parsedNode.name !== expectedNode.name) return null;
    const expectedByName = new Map(expectedNode.children.map(child => [child.name, child]));
    const children = [];
    idMap.set(parsedNode.id, expectedNode.id);
    for (const parsedChild of parsedNode.children) {
      const expectedChild = expectedByName.get(parsedChild.name);
      children.push(expectedChild
        ? alignNode(parsedChild, expectedChild) || parsedChild
        : parsedChild);
    }
    return new ComponentNode({
      id: expectedNode.id,
      name: parsedNode.name,
      provenance: parsedNode.provenance,
      partComponent: parsedNode.partComponent,
      typeExpression: parsedNode.typeExpression,
      properties: parsedNode.properties,
      children
    });
  };
  const initiallyAlignedRoot = alignNode(parsedDocument.root, expectedDocument.root);
  if (!initiallyAlignedRoot) return parsedDocument;
  const remapOrderingReferences = node => new ComponentNode({
    id: node.id,
    name: node.name,
    provenance: node.provenance.beforeId
      ? { ...node.provenance, beforeId: idMap.get(node.provenance.beforeId) || node.provenance.beforeId }
      : node.provenance,
    partComponent: node.partComponent,
    typeExpression: node.typeExpression,
    properties: node.properties,
    children: node.children.map(remapOrderingReferences)
  });
  const root = remapOrderingReferences(initiallyAlignedRoot);
  const remapNodeRecords = records => Object.freeze(Object.fromEntries(
    Object.entries(records || {}).map(([nodeId, value]) => [idMap.get(nodeId) || nodeId, value])
  ));
  return new ComponentDocument({
    revision: parsedDocument.revision,
    componentId: parsedDocument.componentId,
    moduleId: parsedDocument.moduleId,
    exportName: parsedDocument.exportName,
    parentComponent: parsedDocument.parentComponent,
    root,
    layoutModels: parsedDocument.layoutModels.map(model => ({
      ...model,
      ownerId: idMap.get(model.ownerId) || model.ownerId,
      references: model.references.map(reference => ({
        ...reference,
        targetId: idMap.get(reference.targetId) || reference.targetId
      }))
    })),
    sourceMetadata: {
      ...parsedDocument.sourceMetadata,
      nodeIdToAstLocation: remapNodeRecords(
        parsedDocument.sourceMetadata.nodeIdToAstLocation
      ),
      nodeSpecLocations: remapNodeRecords(
        parsedDocument.sourceMetadata.nodeSpecLocations
      ),
      propertyLocations: remapNodeRecords(
        parsedDocument.sourceMetadata.propertyLocations
      ),
      originalExpressions: remapNodeRecords(
        parsedDocument.sourceMetadata.originalExpressions
      ),
      suppressionLocations: remapNodeRecords(
        parsedDocument.sourceMetadata.suppressionLocations
      ),
      orderingLocations: remapNodeRecords(
        parsedDocument.sourceMetadata.orderingLocations
      ),
      layoutReferenceLocations: Object.freeze(Object.fromEntries(
        Object.entries(parsedDocument.sourceMetadata.layoutReferenceLocations || {})
          .map(([ownerId, locations]) => [
            idMap.get(ownerId) || ownerId,
            Object.freeze(Object.fromEntries(Object.entries(locations).map(
              ([targetId, location]) => [idMap.get(targetId) || targetId, location]
            )))
          ])
      ))
    }
  });
}

export function componentDocumentsSemanticallyEqual (left, right) {
  return left instanceof ComponentDocument && right instanceof ComponentDocument &&
    semanticSnapshot(left) === semanticSnapshot(right);
}

function documentWithRevision (document, revision) {
  return new ComponentDocument({
    revision,
    componentId: document.componentId,
    moduleId: document.moduleId,
    exportName: document.exportName,
    parentComponent: document.parentComponent,
    root: document.root,
    layoutModels: document.layoutModels,
    sourceMetadata: document.sourceMetadata
  });
}

function documentWithLayoutModels (document, layoutModels) {
  return new ComponentDocument({
    revision: document.revision,
    componentId: document.componentId,
    moduleId: document.moduleId,
    exportName: document.exportName,
    parentComponent: document.parentComponent,
    root: document.root,
    layoutModels,
    sourceMetadata: document.sourceMetadata
  });
}

function relocatedRange (range, replacedRange, delta) {
  if (!range) return range;
  if (range.end <= replacedRange.start) return range;
  if (range.start >= replacedRange.end) {
    return Object.freeze({ start: range.start + delta, end: range.end + delta });
  }
  if (range.start <= replacedRange.start && range.end >= replacedRange.end) {
    return Object.freeze({ start: range.start, end: range.end + delta });
  }
  return null;
}

function relocatedRangeRecord (record, replacedRange, delta) {
  const relocated = {};
  for (const [key, range] of Object.entries(record || {})) {
    const nextRange = relocatedRange(range, replacedRange, delta);
    if (!nextRange) return null;
    relocated[key] = nextRange;
  }
  return relocated;
}

function incrementallyProjectedTextDocument ({
  beforeDocument,
  reduction,
  change,
  valueSource
}) {
  const { semanticDelta } = reduction;
  const isTextReplacement = semanticDelta.kind === ComponentSemanticDeltaKind.TEXT_EDITED ||
    (semanticDelta.kind === ComponentSemanticDeltaKind.PROPERTY_SET &&
     semanticDelta.property === 'textAndAttributes');
  if (!isTextReplacement || change?.action !== 'replace') return null;
  const replacedRange = { start: change.start, end: change.end };
  const delta = valueSource.length - (change.end - change.start);
  const metadata = beforeDocument.sourceMetadata;
  const componentRange = relocatedRange(metadata.componentRange, replacedRange, delta);
  const declarationRange = relocatedRange(metadata.declarationRange, replacedRange, delta);
  const specRange = relocatedRange(metadata.specRange, replacedRange, delta);
  const nodeIdToAstLocation = relocatedRangeRecord(
    metadata.nodeIdToAstLocation,
    replacedRange,
    delta
  );
  const nodeSpecLocations = relocatedRangeRecord(
    metadata.nodeSpecLocations,
    replacedRange,
    delta
  );
  const suppressionLocations = relocatedRangeRecord(
    metadata.suppressionLocations,
    replacedRange,
    delta
  );
  const orderingLocations = relocatedRangeRecord(
    metadata.orderingLocations,
    replacedRange,
    delta
  );
  if (!componentRange || !declarationRange || !specRange ||
      !nodeIdToAstLocation || !nodeSpecLocations ||
      !suppressionLocations || !orderingLocations) return null;

  const propertyLocations = {};
  for (const [nodeId, properties] of Object.entries(metadata.propertyLocations || {})) {
    propertyLocations[nodeId] = {};
    for (const [property, location] of Object.entries(properties)) {
      const outer = relocatedRange(location, replacedRange, delta);
      const value = relocatedRange(location.value, replacedRange, delta);
      if (!outer || !value) return null;
      propertyLocations[nodeId][property] = { ...outer, value };
    }
  }

  const layoutReferenceLocations = {};
  for (const [ownerId, references] of Object.entries(metadata.layoutReferenceLocations || {})) {
    layoutReferenceLocations[ownerId] = {};
    for (const [targetId, location] of Object.entries(references)) {
      const target = relocatedRange(location.target, replacedRange, delta);
      const entry = relocatedRange(location.entry, replacedRange, delta);
      if (!target || !entry) return null;
      layoutReferenceLocations[ownerId][targetId] = { ...location, target, entry };
    }
  }

  const importInsertionIndex = metadata.importInsertionIndex >= replacedRange.end
    ? metadata.importInsertionIndex + delta
    : metadata.importInsertionIndex;
  if (importInsertionIndex > replacedRange.start &&
      importInsertionIndex < replacedRange.end) return null;
  const originalExpressions = Object.fromEntries(Object.entries(
    metadata.originalExpressions || {}
  ).map(([nodeId, properties]) => [nodeId, { ...properties }]));
  originalExpressions[semanticDelta.nodeId] = {
    ...originalExpressions[semanticDelta.nodeId],
    textAndAttributes: valueSource
  };
  return new ComponentDocument({
    revision: reduction.document.revision,
    componentId: reduction.document.componentId,
    moduleId: reduction.document.moduleId,
    exportName: reduction.document.exportName,
    parentComponent: reduction.document.parentComponent,
    root: reduction.document.root,
    layoutModels: reduction.document.layoutModels,
    sourceMetadata: {
      ...metadata,
      componentRange,
      declarationRange,
      specRange,
      nodeIdToAstLocation,
      nodeSpecLocations,
      propertyLocations,
      originalExpressions,
      suppressionLocations,
      orderingLocations,
      layoutReferenceLocations,
      importInsertionIndex
    }
  });
}

export function projectComponentSource ({ source, beforeDocument, reduction }) {
  if (typeof source !== 'string') throw new Error('Source projection requires source text');
  if (!(beforeDocument instanceof ComponentDocument)) {
    throw new Error('Source projection requires the previous ComponentDocument');
  }
  if (!(reduction?.document instanceof ComponentDocument)) {
    throw new Error('Source projection requires a component reduction result');
  }

  const { semanticDelta } = reduction;
  const diagnostics = [];
  let change = null;
  let structuralChanges = null;
  let requiredBindings = semanticDelta.requiredBindings || [];
  if (semanticDelta.kind === ComponentSemanticDeltaKind.PROPERTY_SET) {
    const entry = reduction.document.root &&
      findNodeEntry(reduction.document.root, semanticDelta.nodeId, semanticDelta.property);
    const valueSource = propertyEntrySource(entry);
    if (typeof valueSource !== 'string') {
      diagnostics.push(diagnostic(
        ComponentSourceProjectionDiagnosticKind.UNSUPPORTED_EXPLICIT_VALUE,
        `Cannot serialize ${semanticDelta.nodeId}.${semanticDelta.property}`
      ));
    } else {
      const location = beforeDocument.sourceMetadata
        .propertyLocations?.[semanticDelta.nodeId]?.[semanticDelta.property]?.value;
      change = location
        ? Object.freeze({
            action: 'replace',
            start: location.start,
            end: location.end,
            text: valueSource
          })
        : insertPropertyChange(
            source,
            beforeDocument,
            semanticDelta.nodeId,
            semanticDelta.property,
            valueSource
          );
    }
  } else if (semanticDelta.kind === ComponentSemanticDeltaKind.PROPERTY_CLEARED) {
    change = removePropertyChange(
      source,
      beforeDocument,
      semanticDelta.nodeId,
      semanticDelta.property
    );
  } else if (semanticDelta.kind === ComponentSemanticDeltaKind.NODE_RENAMED) {
    const node = findComponentNode(beforeDocument, semanticDelta.nodeId);
    const nameLocation = beforeDocument.sourceMetadata
      .propertyLocations?.[semanticDelta.nodeId]?.name?.value;
    let nameChange = nameLocation
      ? Object.freeze({
          action: 'replace',
          start: nameLocation.start,
          end: nameLocation.end,
          text: JSON.stringify(semanticDelta.after)
        })
      : insertPropertyChange(
          source,
          beforeDocument,
          semanticDelta.nodeId,
          'name',
          JSON.stringify(semanticDelta.after)
      );
    const requiresInheritedReplacement =
      node?.provenance.kind === ComponentNodeProvenanceKind.INHERITED &&
      semanticDelta.after !== (node.provenance.baseName || node.name);
    if (nameChange && requiresInheritedReplacement) {
      nameChange = inheritedRenameChange(source, beforeDocument, node, nameChange);
      requiredBindings = [...requiredBindings, componentImportBinding({
        kind: ComponentImportKind.NAMED,
        moduleId: 'lively.morphic/components/core.js',
        imported: 'replace',
        local: 'replace'
      })];
    }
    const layoutChanges = renameLayoutReferenceChanges(
      beforeDocument,
      semanticDelta.nodeId,
      semanticDelta.after
    );
    if (!nameChange) {
      diagnostics.push(diagnostic(
        ComponentSourceProjectionDiagnosticKind.MISSING_SOURCE_METADATA,
        `The renamed node ${semanticDelta.nodeId} has no writable source location`
      ));
    } else if (layoutChanges === null) {
      diagnostics.push(diagnostic(
        ComponentSourceProjectionDiagnosticKind.MISSING_SOURCE_METADATA,
        `The owner layout for ${semanticDelta.nodeId} cannot be projected safely`
      ));
    } else {
      structuralChanges = [nameChange, ...layoutChanges];
    }
  } else if (semanticDelta.kind === ComponentSemanticDeltaKind.TEXT_EDITED) {
    const entry = findNodeEntry(
      reduction.document.root,
      semanticDelta.nodeId,
      'textAndAttributes'
    );
    const valueSource = propertyEntrySource(entry);
    const location = beforeDocument.sourceMetadata
      .propertyLocations?.[semanticDelta.nodeId]?.textAndAttributes?.value;
    if (typeof valueSource !== 'string') {
      diagnostics.push(diagnostic(
        ComponentSourceProjectionDiagnosticKind.UNSUPPORTED_EXPLICIT_VALUE,
        `Cannot serialize ${semanticDelta.nodeId}.textAndAttributes`
      ));
    } else if (location) {
      change = Object.freeze({
        action: 'replace',
        start: location.start,
        end: location.end,
        text: valueSource
      });
    } else {
      change = insertPropertyChange(
        source,
        beforeDocument,
        semanticDelta.nodeId,
        'textAndAttributes',
        valueSource
      );
    }
  } else if (semanticDelta.kind === ComponentSemanticDeltaKind.NODE_MOVED) {
    if (semanticDelta.inheritanceTransition ===
        ComponentMoveInheritanceTransitionKind.MATERIALIZE) {
      const materializedNode = findComponentNode(
        reduction.document,
        semanticDelta.nodeId
      );
      const suppression = suppressInheritedNodeChange(source, beforeDocument, {
        nodeId: semanticDelta.inheritedNodeId,
        parentId: semanticDelta.fromParentId
      });
      const nodeSource = materializedNode && componentNodeSource(
        materializedNode,
        reduction.document
      );
      const introduction = typeof nodeSource === 'string' && insertMovedNodeChange(
        source,
        beforeDocument,
        semanticDelta.toParentId,
        semanticDelta.toIndex,
        nodeSource
      );
      const layoutChanges = removeLayoutReferenceChanges(
        beforeDocument,
        semanticDelta.inheritedNodeId
      );
      if (!suppression || !introduction || layoutChanges === null) {
        diagnostics.push(diagnostic(
          ComponentSourceProjectionDiagnosticKind.MISSING_SOURCE_METADATA,
          `The inherited move ${semanticDelta.inheritedNodeId} cannot be materialized in source`
        ));
      } else {
        structuralChanges = [suppression, introduction, ...layoutChanges];
        requiredBindings = [...requiredBindings, componentImportBinding({
          kind: ComponentImportKind.NAMED,
          moduleId: 'lively.morphic/components/core.js',
          imported: 'without',
          local: 'without'
        }), componentImportBinding({
          kind: ComponentImportKind.NAMED,
          moduleId: 'lively.morphic',
          imported: 'add',
          local: 'add'
        })];
      }
    } else if (semanticDelta.inheritanceTransition ===
               ComponentMoveInheritanceTransitionKind.RESTORE) {
      const removal = removeNodeChange(
        source,
        beforeDocument,
        semanticDelta.nodeId,
        semanticDelta.fromParentId
      );
      const restoration = restoreInheritedNodeChange(source, beforeDocument, {
        nodeId: semanticDelta.inheritedNodeId
      });
      if (!removal || !restoration) {
        diagnostics.push(diagnostic(
          ComponentSourceProjectionDiagnosticKind.MISSING_SOURCE_METADATA,
          `The inherited move ${semanticDelta.inheritedNodeId} cannot be restored in source`
        ));
      } else {
        structuralChanges = [removal, restoration];
      }
    } else if (semanticDelta.fromParentId !== semanticDelta.toParentId) {
      const reparentChanges = reparentNodeChanges(
        source,
        beforeDocument,
        reduction.document,
        semanticDelta
      );
      const layoutChanges = removeLayoutReferenceChanges(
        beforeDocument,
        semanticDelta.nodeId
      );
      if (!reparentChanges) {
        diagnostics.push(diagnostic(
          ComponentSourceProjectionDiagnosticKind.MISSING_SOURCE_METADATA,
          `The moved node ${semanticDelta.nodeId} has no writable source locations`
        ));
      } else if (layoutChanges === null) {
        diagnostics.push(diagnostic(
          ComponentSourceProjectionDiagnosticKind.MISSING_SOURCE_METADATA,
          `The former owner layout for ${semanticDelta.nodeId} cannot be projected safely`
        ));
      } else {
        structuralChanges = [...reparentChanges, ...layoutChanges];
      }
    } else {
      change = reorderNodeChange(
        source,
        beforeDocument,
        reduction.document,
        semanticDelta.fromParentId,
        semanticDelta.nodeId
      );
    }
  } else if (semanticDelta.kind === ComponentSemanticDeltaKind.NODE_INTRODUCED) {
    const node = findComponentNode(reduction.document, semanticDelta.nodeId);
    const nodeSource = node && componentNodeSource(node, reduction.document);
    if (typeof nodeSource !== 'string') {
      diagnostics.push(diagnostic(
        ComponentSourceProjectionDiagnosticKind.UNSUPPORTED_EXPLICIT_VALUE,
        `Cannot serialize introduced component node ${semanticDelta.nodeId}`
      ));
    } else {
      change = insertMovedNodeChange(
        source,
        beforeDocument,
        semanticDelta.parentId,
        semanticDelta.index,
        nodeSource
      );
    }
  } else if (semanticDelta.kind === ComponentSemanticDeltaKind.NODE_REMOVED) {
    const removedNode = findComponentNode(beforeDocument, semanticDelta.nodeId);
    const formerParent = removedNode && findComponentParent(
      beforeDocument,
      semanticDelta.nodeId
    );
    const orderingDependants = formerParent?.children.filter(child =>
      child.provenance.kind === ComponentNodeProvenanceKind.ADDED &&
      child.provenance.beforeId === semanticDelta.nodeId) || [];
    const nodeChange = removeNodeChange(
      source,
      beforeDocument,
      semanticDelta.nodeId,
      semanticDelta.parentId
    );
    const layoutChanges = removeLayoutReferenceChanges(
      beforeDocument,
      semanticDelta.nodeId
    );
    const orderingChanges = orderingDependants.map(child =>
      orderingRewriteChange(
        source,
        beforeDocument,
        reduction.document,
        child.id
      ));
    if (!nodeChange) {
      diagnostics.push(diagnostic(
        ComponentSourceProjectionDiagnosticKind.MISSING_SOURCE_METADATA,
        `The removed node ${semanticDelta.nodeId} has no writable source location`
      ));
    } else if (layoutChanges === null || orderingChanges.some(change => !change)) {
      diagnostics.push(diagnostic(
        ComponentSourceProjectionDiagnosticKind.MISSING_SOURCE_METADATA,
        `The owner layout or ordering dependants for ${semanticDelta.nodeId} cannot be projected safely`
      ));
    } else {
      structuralChanges = [nodeChange, ...orderingChanges, ...layoutChanges];
    }
  } else if (semanticDelta.kind === ComponentSemanticDeltaKind.NODE_SUPPRESSED) {
    change = suppressInheritedNodeChange(source, beforeDocument, semanticDelta);
  } else if (semanticDelta.kind === ComponentSemanticDeltaKind.NODE_RESTORED) {
    change = restoreInheritedNodeChange(source, beforeDocument, semanticDelta);
  } else {
    diagnostics.push(diagnostic(
      ComponentSourceProjectionDiagnosticKind.UNSUPPORTED_DELTA,
      `Component source projection does not support ${semanticDelta.kind}`,
      { semanticDeltaKind: semanticDelta.kind }
    ));
  }

  if (!change && !structuralChanges && !diagnostics.length) {
    diagnostics.push(diagnostic(
      ComponentSourceProjectionDiagnosticKind.MISSING_SOURCE_METADATA,
      'The semantic change has no matching source location'
    ));
  }
  if (semanticDelta.kind === ComponentSemanticDeltaKind.NODE_SUPPRESSED) {
    requiredBindings = [...requiredBindings, componentImportBinding({
      kind: ComponentImportKind.NAMED,
      moduleId: 'lively.morphic/components/core.js',
      imported: 'without',
      local: 'without'
    })];
  }
  const importChanges = diagnostics.length
    ? []
    : importChangesFor(
        source,
        beforeDocument,
        requiredBindings,
        diagnostics
      );
  if (diagnostics.length) {
    return Object.freeze({
      supported: false,
      sourceBefore: source,
      sourceAfter: source,
      changes: Object.freeze([]),
      projectedDocument: null,
      diagnostics: Object.freeze(diagnostics)
    });
  }

  const changes = [...(structuralChanges || [change]), ...importChanges];
  const sourceAfter = applyChanges(source, changes);
  const textEntry = findNodeEntry(
    reduction.document.root,
    semanticDelta.nodeId,
    'textAndAttributes'
  );
  const textValueSource = propertyEntrySource(textEntry);
  if (!importChanges.length && typeof textValueSource === 'string') {
    if (textEntry?.kind === ComponentPropertyKind.OPAQUE_EXPRESSION) {
      try {
        parse(`(${textValueSource})`);
      } catch (error) {
        diagnostics.push(diagnostic(
          ComponentSourceProjectionDiagnosticKind.PROJECTED_SOURCE_INVALID,
          'Projected text expression could not be parsed',
          { error }
        ));
      }
    }
    const projectedDocument = diagnostics.length
      ? null
      : incrementallyProjectedTextDocument({
          beforeDocument,
          reduction,
          change,
          valueSource: textValueSource
        });
    if (projectedDocument) {
      return Object.freeze({
        supported: true,
        sourceBefore: source,
        sourceAfter,
        changes: Object.freeze(changes),
        projectedDocument,
        diagnostics: Object.freeze([])
      });
    }
  }
  const reparsed = parseComponentSource({
    source: sourceAfter,
    moduleId: beforeDocument.moduleId,
    exportName: beforeDocument.exportName,
    componentId: beforeDocument.componentId,
    parentDocument: beforeDocument.sourceMetadata.parentDocument || null,
    resolveComponentDocument: beforeDocument.sourceMetadata.resolveComponentDocument || null
  });
  const alignedDocument = reparsed.supported
    ? alignParsedDocumentIdentities(reparsed.document, reduction.document)
    : null;
  const refreshesLayoutModels =
    ([
      ComponentSemanticDeltaKind.PROPERTY_SET,
      ComponentSemanticDeltaKind.PROPERTY_CLEARED
    ].includes(semanticDelta.kind) && semanticDelta.property === 'layout') ||
    [
      ComponentSemanticDeltaKind.NODE_INTRODUCED,
      ComponentSemanticDeltaKind.NODE_MOVED
    ].includes(semanticDelta.kind);
  let expectedDocument = refreshesLayoutModels && alignedDocument
    ? documentWithLayoutModels(reduction.document, alignedDocument.layoutModels)
    : reduction.document;
  if (semanticDelta.kind === ComponentSemanticDeltaKind.PROPERTY_SET &&
      alignedDocument) {
    expectedDocument = documentWithProjectedPropertyEntry(
      expectedDocument,
      alignedDocument,
      semanticDelta.nodeId,
      semanticDelta.property
    );
  }
  if (!reparsed.supported) {
    const sourceMessage = reparsed.diagnostics?.[0]?.message;
    diagnostics.push(diagnostic(
      ComponentSourceProjectionDiagnosticKind.PROJECTED_SOURCE_INVALID,
      `Projected component source could not be parsed${sourceMessage ? `: ${sourceMessage}` : ''}`,
      { sourceDiagnostics: reparsed.diagnostics }
    ));
  } else if (!componentDocumentsSemanticallyEqual(alignedDocument, expectedDocument)) {
    diagnostics.push(diagnostic(
      ComponentSourceProjectionDiagnosticKind.PROJECTED_SEMANTICS_MISMATCH,
      `Projected source does not represent the reduced component document: ${
        semanticDifferenceMessage(alignedDocument, expectedDocument)}`
    ));
  }

  return Object.freeze({
    supported: diagnostics.length === 0,
    sourceBefore: source,
    sourceAfter,
    changes: Object.freeze(changes),
    projectedDocument: diagnostics.length
      ? null
      : documentWithRevision(alignedDocument, reduction.document.revision),
    diagnostics: Object.freeze(diagnostics)
  });
}

function findNodeEntry (node, nodeId, property) {
  if (node.id === nodeId) return node.properties[property];
  for (const child of node.children) {
    const entry = findNodeEntry(child, nodeId, property);
    if (entry !== undefined) return entry;
  }
  return undefined;
}
