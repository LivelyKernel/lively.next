import { getValueExpr } from '../helpers.js';
import { string } from 'lively.lang';
import {
  addedNodeProvenance,
  ComponentNode,
  ComponentNodeProvenanceKind,
  explicitProperty,
  findComponentNode,
  inheritedNodeProvenance,
  localNodeProvenance,
  opaqueProperty,
  sourceComponentReference
} from './component-document.js';
import { componentImportBindingsFromExpression } from './import-bindings.js';

export const RuntimeNodeSerializationDiagnosticKind = Object.freeze({
  INVALID_SPEC: 'invalid-spec',
  UNSUPPORTED_TYPE: 'unsupported-type',
  VALUE_UNSERIALIZABLE: 'value-unserializable',
  IDENTITY_UNAVAILABLE: 'identity-unavailable'
});

function diagnostic (kind, message, details = {}) {
  return Object.freeze({ kind, message, ...details });
}

function isExplicitValue (value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index++) {
      if (!(index in value) || !isExplicitValue(value[index])) return false;
    }
    return true;
  }
  return !!value && Object.getPrototypeOf(value) === Object.prototype &&
    Object.values(value).every(isExplicitValue);
}

const classNameSymbol = Symbol.for('__LivelyClassName__');
const moduleMetaSymbol = Symbol.for('lively-module-meta');

function runtimeTypeName (type) {
  if (typeof type !== 'function') return null;
  return type[classNameSymbol] || type.name || null;
}

function isDefaultMorphType (type) {
  if (type === undefined || type === null) return true;
  const name = typeof type === 'string'
    ? type
    : runtimeTypeName(type);
  return name === 'Morph';
}

function moduleIdFromClassMeta (meta) {
  const packageName = meta?.package?.name;
  const pathInPackage = meta?.pathInPackage;
  if (typeof packageName !== 'string' || !packageName ||
      typeof pathInPackage !== 'string' || !pathInPackage) return null;
  return `${packageName.replace(/\/$/, '')}/${pathInPackage.replace(/^\//, '')}`;
}

function runtimeTypeProjection (type, name) {
  if (isDefaultMorphType(type)) {
    return Object.freeze({ supported: true, expression: null, bindings: Object.freeze({}) });
  }
  const typeName = runtimeTypeName(type);
  const moduleId = moduleIdFromClassMeta(type?.[moduleMetaSymbol]);
  if (!typeName || !moduleId) {
    return Object.freeze({
      supported: false,
      diagnostic: diagnostic(
        RuntimeNodeSerializationDiagnosticKind.UNSUPPORTED_TYPE,
        `Introduced morph ${name} uses a constructor without source module metadata`,
        { name, typeName }
      )
    });
  }
  return Object.freeze({
    supported: true,
    expression: typeName,
    bindings: Object.freeze({ [moduleId]: Object.freeze([typeName]) })
  });
}

function runtimePartProjection (morph) {
  const master = morph?.master;
  const directParent = master?.parent;
  const directParentMeta = directParent?.[moduleMetaSymbol];
  const partPolicy = Array.isArray(directParentMeta?.path) &&
      directParentMeta.path.length === 0
    ? directParent
    : [
        master?._autoMaster,
        directParent?._autoMaster,
        directParent?.parent,
        directParent?._parent
      ]
        .find(policy => {
          const meta = policy?.[moduleMetaSymbol];
          return meta && Array.isArray(meta.path) && meta.path.length === 0;
        });
  const meta = partPolicy?.[moduleMetaSymbol];
  if (!meta ||
      typeof meta.exportedName !== 'string' || !meta.exportedName ||
      typeof meta.moduleId !== 'string' || !meta.moduleId ||
      !Array.isArray(meta.path) || meta.path.length !== 0) return null;
  return Object.freeze({
    reference: sourceComponentReference(meta.exportedName),
    bindings: Object.freeze({
      [meta.moduleId]: Object.freeze([meta.exportedName]),
      'lively.morphic': Object.freeze(['part'])
    })
  });
}

function runtimeMasterDescription (master) {
  const describe = policy => {
    const meta = policy?.[moduleMetaSymbol];
    return {
      type: policy?.constructor?.name || typeof policy,
      exportedName: meta?.exportedName || null,
      moduleId: meta?.moduleId || null,
      path: Array.isArray(meta?.path) ? meta.path : null
    };
  };
  return {
    master: describe(master),
    parent: describe(master?.parent),
    privateParent: describe(master?._parent),
    auto: describe(master?._autoMaster),
    parentAuto: describe(master?.parent?._autoMaster),
    parentPrivateParent: describe(master?.parent?._parent),
    grandparent: describe(master?.parent?.parent)
  };
}

function runtimePartOverrideSpec (morph, runtimeSpec, materializeInheritedChildren) {
  const overrideSpec = morph?.master?._originalSpec || morph?.master?.spec;
  if (!overrideSpec || typeof overrideSpec !== 'object' || Array.isArray(overrideSpec)) {
    const partSpec = { ...runtimeSpec };
    delete partSpec.master;
    return partSpec;
  }
  const localSubmorphs = Array.isArray(overrideSpec.submorphs)
    ? overrideSpec.submorphs
    : [];
  const localOverrides = localSubmorphs.map(localSpec => {
    const normalized = normalizedRuntimeSpec(localSpec);
    return normalized.added
      ? localSpec
      : { ...normalized.spec, __projectionalInheritedOverride__: true };
  });
  const submorphs = materializeInheritedChildren
    ? (morph?.submorphs || []).map(child => {
        const localSpec = localSubmorphs.find(spec =>
          normalizedRuntimeSpec(spec).spec?.name === child?.name);
        if (!localSpec) {
          return { name: child?.name, __projectionalInheritedOverride__: true };
        }
        const normalized = normalizedRuntimeSpec(localSpec);
        return normalized.added
          ? localSpec
          : { ...normalized.spec, __projectionalInheritedOverride__: true };
      })
    : localOverrides;
  return {
    ...overrideSpec,
    name: typeof overrideSpec.name === 'string' && overrideSpec.name
      ? overrideSpec.name
      : runtimeSpec.name,
    submorphs
  };
}

function normalizedRuntimeSpec (spec) {
  let added = false;
  let beforeName = null;
  while (spec && typeof spec === 'object') {
    if (spec.COMMAND === 'add') {
      added = true;
      beforeName = typeof spec.before === 'string' && spec.before ? spec.before : null;
      spec = spec.props;
      continue;
    }
    if (spec.isPolicy) {
      spec = spec._originalSpec || spec.spec;
      continue;
    }
    break;
  }
  return { spec, added, beforeName };
}

function runtimeChildForSpec (morph, childSpec, index) {
  const children = morph?.submorphs || [];
  const { spec } = normalizedRuntimeSpec(childSpec);
  const name = spec?.name;
  return children.find(child => child?.name === name) || children[index];
}

function mergeBindings (target, additions = {}) {
  for (const [moduleId, bindings] of Object.entries(additions)) {
    target[moduleId] = Array.from(new Set([...(target[moduleId] || []), ...bindings]));
  }
}

function childNodeId (document, parentId, index) {
  const candidateFor = candidateIndex => parentId === document.root.id
    ? `${document.componentId}:node:${candidateIndex}`
    : `${parentId}.${candidateIndex}`;
  let candidateIndex = index;
  let candidate = candidateFor(candidateIndex);
  while (findComponentNode(document, candidate)) {
    candidate = candidateFor(++candidateIndex);
  }
  return candidate;
}

function availableSiblingName (document, parentId, requestedName, allocateName) {
  const siblingNames = new Set(findComponentNode(document, parentId)?.children
    .map(child => child.name) || []);
  let candidate = requestedName;
  while (siblingNames.has(candidate)) candidate = string.incName(candidate);
  candidate = allocateName(candidate);
  if (typeof candidate !== 'string' || !candidate) {
    throw new Error('Introduced node name allocation requires a non-empty name');
  }
  while (siblingNames.has(candidate)) candidate = string.incName(candidate);
  return candidate;
}

function nodeFromSpec ({
  spec,
  morph,
  nodeId,
  bindings,
  diagnostics,
  resolveComponentDocument,
  partComponent = null,
  insidePartOverride = false,
  materializePartSubtree = false
}) {
  const normalized = normalizedRuntimeSpec(spec);
  spec = normalized.spec;
  if (!spec || typeof spec !== 'object' || Array.isArray(spec) ||
      typeof spec.name !== 'string' || !spec.name) {
    diagnostics.push(diagnostic(
      RuntimeNodeSerializationDiagnosticKind.INVALID_SPEC,
      'Introduced morph specs require a non-empty static name'
    ));
    return null;
  }
  if (normalized.added) mergeBindings(bindings, { 'lively.morphic': ['add'] });
  const partProjection = runtimePartProjection(morph) || (partComponent
    ? Object.freeze({
        reference: partComponent,
        bindings: Object.freeze({ 'lively.morphic': Object.freeze(['part']) })
      })
    : null);
  const projectsPartReference = !!partProjection &&
    (!insidePartOverride || normalized.added);
  const typeProjection = runtimeTypeProjection(spec.type, spec.name);
  if (!partProjection && !typeProjection.supported) {
    diagnostics.push(typeProjection.diagnostic);
    return null;
  }
  if (projectsPartReference) mergeBindings(bindings, partProjection.bindings);
  else if (!partProjection) mergeBindings(bindings, typeProjection.bindings);
  const resolvedPart = partProjection && resolveComponentDocument?.({
    expression: partProjection.reference.expression
  });
  spec = partProjection
    ? runtimePartOverrideSpec(morph, spec, materializePartSubtree || !resolvedPart)
    : spec;
  const submorphs = spec.submorphs === undefined ? [] : spec.submorphs;
  if (!Array.isArray(submorphs)) {
    diagnostics.push(diagnostic(
      RuntimeNodeSerializationDiagnosticKind.INVALID_SPEC,
      `Introduced morph ${spec.name} has invalid submorphs`
    ));
    return null;
  }

  const properties = {};
  for (const [property, value] of Object.entries(spec)) {
    if (['name', 'type', 'submorphs', '__wasAddedToDerived__',
      '__projectionalInheritedOverride__'].includes(property)) continue;
    if (isExplicitValue(value)) {
      properties[property] = explicitProperty(value);
      continue;
    }
    let expression;
    try {
      expression = getValueExpr(property, value);
    } catch (error) {
      diagnostics.push(diagnostic(
        RuntimeNodeSerializationDiagnosticKind.VALUE_UNSERIALIZABLE,
        `Cannot serialize introduced morph property ${spec.name}.${property}`,
        { property, error }
      ));
      return null;
    }
    if (typeof expression?.__expr__ !== 'string' || !expression.__expr__.trim()) {
      diagnostics.push(diagnostic(
        RuntimeNodeSerializationDiagnosticKind.VALUE_UNSERIALIZABLE,
        `Cannot serialize introduced morph property ${spec.name}.${property}` +
          (property === 'master'
            ? ` (${JSON.stringify(runtimeMasterDescription(morph?.master))})`
            : ''),
        { property }
      ));
      return null;
    }
    properties[property] = opaqueProperty(expression.__expr__);
    mergeBindings(bindings, expression.bindings);
  }

  const children = [];
  const provenance = normalized.added
    ? addedNodeProvenance({ beforeName: normalized.beforeName })
    : spec.__projectionalInheritedOverride__ || insidePartOverride
      ? inheritedNodeProvenance({
          hasLocalOverrides: true,
          baseName: spec.name
        })
      : localNodeProvenance();
  for (const [index, childSpec] of submorphs.entries()) {
    const childId = `${nodeId}.${index}`;
    const child = nodeFromSpec({
      spec: childSpec,
      morph: runtimeChildForSpec(morph, childSpec, index),
      nodeId: childId,
      bindings,
      diagnostics,
      resolveComponentDocument,
      materializePartSubtree,
      insidePartOverride: !!partProjection ||
        (insidePartOverride && provenance.kind !== ComponentNodeProvenanceKind.ADDED)
    });
    if (!child) return null;
    children.push(child);
  }
  if (partProjection || insidePartOverride) {
    for (let index = 0; index < children.length - 1; index++) {
      const child = children[index];
      if (child.provenance.kind !== ComponentNodeProvenanceKind.ADDED ||
          child.provenance.beforeId || child.provenance.beforeName) continue;
      children[index] = child.with({
        provenance: addedNodeProvenance({ beforeId: children[index + 1].id })
      });
    }
  }
  return new ComponentNode({
    id: nodeId,
    name: spec.name,
    provenance,
    partComponent: projectsPartReference
      ? partProjection.reference
      : null,
    typeExpression: partProjection ? null : typeProjection.expression,
    properties,
    children
  });
}

export function serializeRuntimeComponentNode ({
  document,
  parentId,
  index,
  morph,
  partComponent = null,
  materializePartSubtree = false,
  allocateName = name => name
}) {
  const nodeId = childNodeId(document, parentId, index);
  if (!nodeId) {
    return Object.freeze({
      supported: false,
      node: null,
      bindings: Object.freeze({}),
      requiredBindings: Object.freeze([]),
      diagnostics: Object.freeze([diagnostic(
        RuntimeNodeSerializationDiagnosticKind.IDENTITY_UNAVAILABLE,
        `Cannot allocate a source-path identity below ${parentId}`
      )])
    });
  }
  let spec;
  try {
    spec = morph?.spec?.();
  } catch (error) {
    return Object.freeze({
      supported: false,
      node: null,
      bindings: Object.freeze({}),
      requiredBindings: Object.freeze([]),
      diagnostics: Object.freeze([diagnostic(
        RuntimeNodeSerializationDiagnosticKind.INVALID_SPEC,
        'The introduced runtime morph could not produce a component spec',
        { error }
      )])
    });
  }
  const diagnostics = [];
  const bindings = {};
  let node = nodeFromSpec({
    spec,
    morph,
    nodeId,
    bindings,
    diagnostics,
    resolveComponentDocument: document.sourceMetadata.resolveComponentDocument,
    partComponent,
    materializePartSubtree
  });
  let runtimeRename = null;
  if (node) {
    const allocatedName = availableSiblingName(
      document,
      parentId,
      node.name,
      allocateName
    );
    if (allocatedName !== node.name) {
      runtimeRename = Object.freeze({ before: node.name, after: allocatedName });
      node = node.with({ name: allocatedName });
    }
  }
  const frozenBindings = Object.freeze(Object.fromEntries(
    Object.entries(bindings).map(([moduleId, names]) => [moduleId, Object.freeze(names)])
  ));
  return Object.freeze({
    supported: diagnostics.length === 0 && !!node,
    node,
    runtimeRename,
    bindings: frozenBindings,
    requiredBindings: Object.freeze(componentImportBindingsFromExpression(frozenBindings)),
    diagnostics: Object.freeze(diagnostics)
  });
}
