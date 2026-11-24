export const ComponentPropertyKind = Object.freeze({
  EXPLICIT_VALUE: 'explicit-value',
  OPAQUE_EXPRESSION: 'opaque-expression'
});

export const ComponentNodeProvenanceKind = Object.freeze({
  LOCAL: 'local',
  ADDED: 'added',
  INHERITED: 'inherited'
});

export const ComponentReferenceKind = Object.freeze({
  SOURCE_EXPRESSION: 'source-expression'
});

export const ComponentLayoutKind = Object.freeze({
  TILING: 'tiling'
});

export const ComponentLayoutReferenceKind = Object.freeze({
  RESIZE_POLICY: 'resize-policy'
});

function immutableValue (value) {
  if (Array.isArray(value)) return Object.freeze(value.map(immutableValue));
  if (value && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.freeze(Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, immutableValue(nested)])
    ));
  }
  return value;
}

export function explicitProperty (value) {
  return Object.freeze({
    kind: ComponentPropertyKind.EXPLICIT_VALUE,
    value: immutableValue(value)
  });
}

export function opaqueProperty (expression) {
  if (typeof expression !== 'string' || !expression.trim()) {
    throw new Error('Opaque component properties require a source expression');
  }
  return Object.freeze({
    kind: ComponentPropertyKind.OPAQUE_EXPRESSION,
    expression
  });
}

export function localNodeProvenance () {
  return Object.freeze({ kind: ComponentNodeProvenanceKind.LOCAL });
}

export function addedNodeProvenance ({ beforeId = null, beforeName = null } = {}) {
  if (beforeId !== null && (typeof beforeId !== 'string' || !beforeId)) {
    throw new Error('Added ordering references require a node ID');
  }
  if (beforeName !== null && (typeof beforeName !== 'string' || !beforeName)) {
    throw new Error('Added external ordering references require a node name');
  }
  if (beforeId !== null && beforeName !== null) {
    throw new Error('Added ordering references require either an ID or a name');
  }
  return Object.freeze({
    kind: ComponentNodeProvenanceKind.ADDED,
    beforeId,
    beforeName
  });
}

export function inheritedNodeProvenance ({
  suppressed = false,
  hasLocalOverrides = false,
  beforeId = null,
  baseName = null
} = {}) {
  if (beforeId !== null && (typeof beforeId !== 'string' || !beforeId)) {
    throw new Error('Inherited ordering references require a node ID');
  }
  if (baseName !== null && (typeof baseName !== 'string' || !baseName)) {
    throw new Error('Inherited base names must be non-empty strings');
  }
  return Object.freeze({
    kind: ComponentNodeProvenanceKind.INHERITED,
    suppressed: !!suppressed,
    hasLocalOverrides: !!hasLocalOverrides,
    beforeId,
    baseName
  });
}

export function sourceComponentReference (expression) {
  if (typeof expression !== 'string' || !expression.trim()) {
    throw new Error('Component references require a source expression');
  }
  return Object.freeze({
    kind: ComponentReferenceKind.SOURCE_EXPRESSION,
    expression
  });
}

export function resizePolicyLayoutReference ({ targetId, expressionTemplate }) {
  if (typeof targetId !== 'string' || !targetId) {
    throw new Error('Resize-policy layout references require a target node ID');
  }
  if (typeof expressionTemplate !== 'string' || !expressionTemplate.trim()) {
    throw new Error('Resize-policy layout references require an expression template');
  }
  return Object.freeze({
    kind: ComponentLayoutReferenceKind.RESIZE_POLICY,
    targetId,
    expressionTemplate
  });
}

export function tilingLayoutModel ({ ownerId, expressionTemplate, references = [] }) {
  if (typeof ownerId !== 'string' || !ownerId) {
    throw new Error('Component layout models require an owner node ID');
  }
  if (typeof expressionTemplate !== 'string' || !expressionTemplate.trim()) {
    throw new Error('Component layout models require an expression template');
  }
  if (!Array.isArray(references)) {
    throw new Error('Component layout model references must be an array');
  }
  return Object.freeze({
    kind: ComponentLayoutKind.TILING,
    ownerId,
    expressionTemplate,
    references: Object.freeze(references.map(reference => {
      if (reference?.kind !== ComponentLayoutReferenceKind.RESIZE_POLICY) {
        throw new Error('Invalid tiling-layout reference');
      }
      return resizePolicyLayoutReference(reference);
    }))
  });
}

function normalizeLayoutModel (model) {
  if (model?.kind === ComponentLayoutKind.TILING) return tilingLayoutModel(model);
  throw new Error('Invalid component layout model');
}

function normalizeParentComponent (parentComponent) {
  if (parentComponent === null) return null;
  if (parentComponent?.kind === ComponentReferenceKind.SOURCE_EXPRESSION) {
    return sourceComponentReference(parentComponent.expression);
  }
  throw new Error('Invalid parent component reference');
}

function normalizePropertyEntry (entry, property) {
  if (entry?.kind === ComponentPropertyKind.EXPLICIT_VALUE && 'value' in entry) {
    return explicitProperty(entry.value);
  }
  if (entry?.kind === ComponentPropertyKind.OPAQUE_EXPRESSION &&
      typeof entry.expression === 'string' && entry.expression.trim()) {
    return opaqueProperty(entry.expression);
  }
  throw new Error(`Invalid component property entry for ${property}`);
}

function normalizeProvenance (provenance) {
  if (provenance?.kind === ComponentNodeProvenanceKind.LOCAL) {
    return localNodeProvenance();
  }
  if (provenance?.kind === ComponentNodeProvenanceKind.ADDED &&
      (provenance.beforeId === undefined || provenance.beforeId === null ||
       typeof provenance.beforeId === 'string') &&
      (provenance.beforeName === undefined || provenance.beforeName === null ||
       typeof provenance.beforeName === 'string')) {
    return addedNodeProvenance({
      beforeId: provenance.beforeId || null,
      beforeName: provenance.beforeName || null
    });
  }
  if (provenance?.kind === ComponentNodeProvenanceKind.INHERITED &&
      typeof provenance.suppressed === 'boolean' &&
      typeof provenance.hasLocalOverrides === 'boolean' &&
      (provenance.beforeId === null || typeof provenance.beforeId === 'string') &&
      (provenance.baseName === undefined || provenance.baseName === null ||
       typeof provenance.baseName === 'string')) {
    return inheritedNodeProvenance(provenance);
  }
  throw new Error('Invalid component node provenance');
}

export class ComponentNode {
  constructor ({
    id,
    name,
    provenance = localNodeProvenance(),
    partComponent = null,
    typeExpression = null,
    properties = {},
    children = []
  }) {
    if (typeof id !== 'string' || !id) throw new Error('Component nodes require a stable ID');
    if (typeof name !== 'string' || !name) throw new Error('Component nodes require a name');
    if (typeExpression !== null && typeof typeExpression !== 'string') {
      throw new Error('Component node typeExpression must be a string or null');
    }
    const normalizedProvenance = normalizeProvenance(provenance);
    const normalizedPartComponent = normalizeParentComponent(partComponent);
    const normalizedProperties = Object.fromEntries(
      Object.entries(properties).map(([property, entry]) =>
        [property, normalizePropertyEntry(entry, property)])
    );
    if (children.some(child => !(child instanceof ComponentNode))) {
      throw new Error('Component node children must be ComponentNode instances');
    }
    this.id = id;
    this.name = name;
    this.provenance = normalizedProvenance;
    this.partComponent = normalizedPartComponent;
    this.typeExpression = typeExpression;
    this.properties = Object.freeze(normalizedProperties);
    this.children = Object.freeze(children.slice());
    Object.freeze(this);
  }

  with (changes) {
    return new ComponentNode({
      id: this.id,
      name: this.name,
      provenance: this.provenance,
      partComponent: this.partComponent,
      typeExpression: this.typeExpression,
      properties: this.properties,
      children: this.children,
      ...changes
    });
  }
}

export class ComponentDocument {
  constructor ({
    revision = 0,
    componentId,
    moduleId,
    exportName,
    parentComponent = null,
    root,
    layoutModels = [],
    sourceMetadata = {}
  }) {
    if (!Number.isInteger(revision) || revision < 0) {
      throw new Error('Component document revision must be a non-negative integer');
    }
    if (typeof componentId !== 'string' || !componentId) {
      throw new Error('Component documents require a componentId');
    }
    if (typeof moduleId !== 'string' || !moduleId) {
      throw new Error('Component documents require a moduleId');
    }
    if (typeof exportName !== 'string' || !exportName) {
      throw new Error('Component documents require an exportName');
    }
    if (!(root instanceof ComponentNode)) {
      throw new Error('Component documents require a root ComponentNode');
    }
    if (!Array.isArray(layoutModels)) {
      throw new Error('Component document layoutModels must be an array');
    }
    this.revision = revision;
    this.componentId = componentId;
    this.moduleId = moduleId;
    this.exportName = exportName;
    this.parentComponent = normalizeParentComponent(parentComponent);
    this.root = root;
    this.layoutModels = Object.freeze(layoutModels.map(normalizeLayoutModel));
    this.sourceMetadata = immutableValue(sourceMetadata);
    Object.freeze(this);
  }

  withRoot (root) {
    return new ComponentDocument({
      revision: this.revision + 1,
      componentId: this.componentId,
      moduleId: this.moduleId,
      exportName: this.exportName,
      parentComponent: this.parentComponent,
      root,
      layoutModels: this.layoutModels,
      sourceMetadata: this.sourceMetadata
    });
  }
}

export function findComponentLayoutModel (document, ownerId) {
  return document.layoutModels.find(model => model.ownerId === ownerId) || null;
}

export function findComponentNode (document, nodeId) {
  const visit = node => {
    if (node.id === nodeId) return node;
    for (const child of node.children) {
      const found = visit(child);
      if (found) return found;
    }
    return null;
  };
  return visit(document.root);
}

export function findComponentParent (document, nodeId) {
  const visit = node => {
    if (node.children.some(child => child.id === nodeId)) return node;
    for (const child of node.children) {
      const found = visit(child);
      if (found) return found;
    }
    return null;
  };
  return visit(document.root);
}
