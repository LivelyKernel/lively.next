import { MorphicAttachmentKind } from 'lively.morphic/changes/index.js';
import {
  ClearPropertyOverride,
  ComponentCommandKind,
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
import {
  ComponentNode,
  ComponentNodeProvenanceKind,
  ComponentPropertyKind,
  explicitProperty,
  findComponentLayoutModel,
  findComponentParent,
  localNodeProvenance
} from './component-document.js';
import {
  ComponentTransactionDirection,
  applyPreparedComponentTransaction,
  commitPreparedComponentTransaction,
  prepareScalarComponentTransaction
} from './component-transaction.js';
import { SeededRandom } from './fuzz-random.js';
import { reduceComponent } from './reducer.js';
import { parseComponentSource } from './source-adapter.js';
import {
  alignParsedDocumentIdentities,
  componentDocumentsSemanticallyEqual
} from './source-projector.js';
import {
  ComponentImportKind,
  componentImportBinding
} from './import-bindings.js';

export const DEFAULT_COMPONENT_PROJECTION_FUZZ_SEED = 0x51CA1A;

export const ComponentProjectionFuzzOperationKind = Object.freeze({
  SET_PROPERTY: 'set-property',
  SET_OPAQUE_PROPERTY: 'set-opaque-property',
  CLEAR_PROPERTY_OVERRIDE: 'clear-property-override',
  EDIT_TEXT: 'edit-text',
  SET_MASTER: 'set-master',
  RENAME_NODE: 'rename-node',
  INTRODUCE_FINAL_NODE: 'introduce-final-node',
  REMOVE_FINAL_NODE: 'remove-final-node',
  REORDER_NODE: 'reorder-node',
  REPARENT_NODE: 'reparent-node',
  SUPPRESS_INHERITED_NODE: 'suppress-inherited-node',
  RESTORE_INHERITED_NODE: 'restore-inherited-node',
  REJECT_STALE_COMMAND: 'reject-stale-command'
});

export const DEFAULT_COMPONENT_PROJECTION_FUZZ_OPERATIONS = Object.freeze(
  Object.values(ComponentProjectionFuzzOperationKind).filter(kind => ![
    ComponentProjectionFuzzOperationKind.SUPPRESS_INHERITED_NODE,
    ComponentProjectionFuzzOperationKind.RESTORE_INHERITED_NODE
  ].includes(kind))
);

export const defaultComponentProjectionFuzzSource = `
const Subject = component({
  name: 'projection subject',
  textAndAttributes: ['projection text', null],
  master: { mode: 'base', priority: 0 },
  opacity: 0.8,
  visible: true,
  tooltip: 'root',
  submorphs: [{
    name: 'first child',
    opacity: 0.5,
    fill: 'red'
  }, {
    name: 'second child',
    visible: false,
    data: { level: 1, enabled: true }
  }]
});

export { Subject };
`;

const FUZZ_PROPERTIES = Object.freeze([
  'opacity',
  'visible',
  'tooltip',
  'fill',
  'data',
  'padding'
]);

const DEFAULT_BASELINE_VALUES = Object.freeze({
  opacity: 1,
  visible: true,
  tooltip: null,
  fill: null,
  data: null,
  padding: 0
});

function cloneValue (value) {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (value && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, cloneValue(nested)])
    );
  }
  return value;
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

function valuesEqual (left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function assertFuzzInvariant (condition, message) {
  if (!condition) throw new Error(message);
}

function runtimeSnapshot (runtimeTargets, runtimeParents, runtimeChildren) {
  return Array.from(runtimeTargets.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([id, target]) => Object.freeze({
      id,
      state: cloneValue(target),
      parentId: runtimeParents.get(id),
      index: runtimeParents.get(id) === null
        ? null
        : runtimeChildren.get(runtimeParents.get(id)).indexOf(id)
    }));
}

export class ComponentProjectionFuzzError extends Error {
  constructor (message, details, cause) {
    super(`${message}\nseed: ${details.seed}\nstep: ${details.step}\noperation: ${details.operation}`);
    this.name = 'ComponentProjectionFuzzError';
    this.cause = cause;
    Object.assign(this, details);
  }
}

export class ComponentProjectionFuzzer {
  constructor ({
    source = defaultComponentProjectionFuzzSource,
    moduleId = 'local://component-projection-fuzz/subject.cp.js',
    exportName = 'Subject',
    componentId = `${moduleId}#${exportName}`,
    parentDocument = null,
    resolveComponentDocument = null,
    seed = DEFAULT_COMPONENT_PROJECTION_FUZZ_SEED,
    operations = DEFAULT_COMPONENT_PROJECTION_FUZZ_OPERATIONS,
    baselineValueFor = ({ property }) => cloneValue(DEFAULT_BASELINE_VALUES[property] ?? null)
  } = {}) {
    const parsed = parseComponentSource({
      source, moduleId, exportName, componentId, parentDocument, resolveComponentDocument
    });
    if (!parsed.supported) {
      throw new Error(`Component projection fuzz source is unsupported: ${JSON.stringify(parsed.diagnostics)}`);
    }
    if (typeof baselineValueFor !== 'function') {
      throw new Error('Component projection fuzzing requires a baseline value resolver');
    }
    const validOperations = new Set(Object.values(ComponentProjectionFuzzOperationKind));
    if (!operations.length || operations.some(operation => !validOperations.has(operation))) {
      throw new Error('Component projection fuzzing requires known operation kinds');
    }

    this.source = source;
    this.document = parsed.document;
    this.parentDocument = parentDocument;
    this.resolveComponentDocument = resolveComponentDocument;
    this.seed = seed;
    this.random = new SeededRandom(seed);
    this.operations = operations.slice();
    this.operationQueue = [];
    this.baselineValueFor = baselineValueFor;
    this.actions = [];
    this.nameCounter = 0;
    this.runtimeTargets = new Map();
    this.runtimeTargetIds = new WeakMap();
    this.runtimeParents = new Map();
    this.runtimeChildren = new Map();
    this.opaqueRuntimeValues = new Map();

    for (const node of allNodes(this.document)) {
      const target = { name: node.name };
      for (const property of FUZZ_PROPERTIES) {
        target[property] = this.baselineValue(node.id, property);
      }
      for (const [property, entry] of Object.entries(node.properties)) {
        target[property] = entry.kind === ComponentPropertyKind.EXPLICIT_VALUE
          ? cloneValue(entry.value)
          : this.baselineValue(node.id, property);
      }
      this.runtimeTargets.set(node.id, target);
      this.runtimeTargetIds.set(target, node.id);
      this.runtimeChildren.set(node.id, node.children
        .filter(child => child.provenance.kind !== ComponentNodeProvenanceKind.INHERITED ||
          !child.provenance.suppressed)
        .map(child => child.id));
    }
    const registerParents = (node, parentId = null) => {
      this.runtimeParents.set(node.id, parentId);
      node.children.forEach(child => registerParents(
        child,
        child.provenance.kind === ComponentNodeProvenanceKind.INHERITED &&
          child.provenance.suppressed
          ? null
          : node.id
      ));
    };
    registerParents(this.document.root);
  }

  baselineValue (nodeId, property) {
    return cloneValue(this.baselineValueFor({ nodeId, property, document: this.document }));
  }

  valueForProperty (property) {
    switch (property) {
      case 'opacity': return this.random.integer(0, 11) / 10;
      case 'visible': return this.random.boolean();
      case 'tooltip': return this.random.pick([null, '', `tip ${this.random.integer(0, 100)}`]);
      case 'fill': return this.random.pick(['red', 'green', 'blue', null]);
      case 'data': return {
        level: this.random.integer(-5, 20),
        enabled: this.random.boolean(),
        tags: [this.random.integer(0, 5), this.random.boolean()]
      };
      case 'padding': return [
        this.random.integer(0, 20),
        this.random.integer(0, 20),
        this.random.integer(0, 20),
        this.random.integer(0, 20)
      ];
    }
  }

  nextOperation () {
    if (!this.operationQueue.length) {
      this.operationQueue = this.random.shuffle(this.operations);
    }
    return this.operationQueue.shift();
  }

  commandSpec (node) {
    return {
      componentId: this.document.componentId,
      expectedRevision: this.document.revision,
      nodeId: node.id
    };
  }

  setPropertyAction () {
    const node = this.random.pick(allNodes(this.document));
    const property = this.random.pick(FUZZ_PROPERTIES);
    const value = this.valueForProperty(property);
    return {
      command: SetProperty({ ...this.commandSpec(node), property, value }),
      runtimeValue: cloneValue(value),
      action: { nodeId: node.id, property, value: cloneValue(value) }
    };
  }

  setOpaquePropertyAction () {
    const node = this.random.pick(allNodes(this.document));
    const property = this.random.pick(['opacity', 'padding', 'data']);
    const left = this.random.integer(-20, 20);
    const right = this.random.integer(-20, 20);
    const requiresImport = this.random.boolean();
    const local = this.random.pick(['fuzzMax', 'projectionMax']);
    const expression = requiresImport
      ? `${local}(${left}, ${right})`
      : `Math.max(${left}, ${right})`;
    const requiredBindings = requiresImport
      ? [componentImportBinding({
          kind: ComponentImportKind.NAMED,
          moduleId: 'local://component-projection-fuzz/value-helpers.js',
          imported: 'maxValue',
          local
        })]
      : [];
    return {
      command: SetOpaqueProperty({
        ...this.commandSpec(node),
        property,
        expression,
        requiredBindings
      }),
      runtimeValue: Math.max(left, right),
      action: {
        nodeId: node.id,
        property,
        expression,
        requiredBindings,
        runtimeValue: Math.max(left, right)
      }
    };
  }

  clearPropertyAction () {
    const candidates = allNodes(this.document).flatMap(node =>
      Object.keys(node.properties)
        .filter(property => property !== 'textAndAttributes')
        .map(property => ({ node, property }))
    );
    const candidate = this.random.pick(candidates);
    if (!candidate) return null;
    const { node, property } = candidate;
    return {
      command: ClearPropertyOverride({ ...this.commandSpec(node), property }),
      runtimeValue: this.baselineValue(node.id, property),
      action: { nodeId: node.id, property }
    };
  }

  editTextAction () {
    const candidates = allNodes(this.document).filter(node =>
      node.properties.textAndAttributes?.kind === ComponentPropertyKind.EXPLICIT_VALUE
    );
    const node = this.random.pick(candidates);
    if (!node) return null;
    const before = node.properties.textAndAttributes.value;
    const after = [
      `projection text ${this.random.integer(0, 1000)}`,
      this.random.boolean() ? null : { fontWeight: 'bold' }
    ];
    return {
      command: EditText({
        ...this.commandSpec(node),
        operation: {
          kind: ComponentTextEditKind.REPLACE_ALL,
          before,
          after
        }
      }),
      runtimeValue: cloneValue(after),
      action: { nodeId: node.id, before: cloneValue(before), after: cloneValue(after) }
    };
  }

  setMasterAction () {
    const node = this.random.pick(allNodes(this.document));
    const value = {
      mode: this.random.pick(['base', 'hover', 'active']),
      priority: this.random.integer(0, 10)
    };
    return {
      command: SetMaster({ ...this.commandSpec(node), value }),
      runtimeValue: cloneValue(value),
      action: { nodeId: node.id, value: cloneValue(value) }
    };
  }

  renameNodeAction () {
    const node = this.random.pick(allNodes(this.document));
    const suffix = this.random.pick(['', " 'quoted'", ' "double"', ' \\backslash']);
    const name = `projection node ${++this.nameCounter}${suffix}`;
    return {
      command: RenameNode({ ...this.commandSpec(node), name }),
      runtimeValue: name,
      action: { nodeId: node.id, name }
    };
  }

  removeFinalNodeAction () {
    const candidates = allNodes(this.document).flatMap(parent => {
      const node = parent.children[parent.children.length - 1];
      return node ? [{ parent, node }] : [];
    });
    const candidate = this.random.pick(candidates);
    if (!candidate) return null;
    return {
      command: RemoveNode(this.commandSpec(candidate.node)),
      action: { nodeId: candidate.node.id, parentId: candidate.parent.id }
    };
  }

  componentNodeForDetachedRuntime (nodeId) {
    const target = this.runtimeTargets.get(nodeId);
    if (!target) return null;
    const properties = Object.fromEntries(
      Object.entries(target)
        .filter(([property]) => property !== 'name')
        .map(([property, value]) => [property, explicitProperty(value)])
    );
    const children = (this.runtimeChildren.get(nodeId) || [])
      .map(childId => this.componentNodeForDetachedRuntime(childId));
    if (children.some(child => !child)) return null;
    return new ComponentNode({
      id: nodeId,
      name: target.name,
      provenance: localNodeProvenance(),
      properties,
      children
    });
  }

  introduceFinalNodeAction () {
    const parent = this.document.root;
    let nodeOrdinal = parent.children.length;
    let nodeId = `${this.document.componentId}:node:${nodeOrdinal}`;
    let target = this.runtimeTargets.get(nodeId);
    while (target && this.runtimeParents.get(nodeId) !== null) {
      nodeId = `${this.document.componentId}:node:${++nodeOrdinal}`;
      target = this.runtimeTargets.get(nodeId);
    }
    if (!target) {
      target = { name: `introduced fuzz node ${++this.nameCounter}` };
      for (const property of FUZZ_PROPERTIES) {
        target[property] = this.baselineValue(nodeId, property);
      }
      target.fill = this.valueForProperty('fill');
      this.runtimeTargets.set(nodeId, target);
      this.runtimeTargetIds.set(target, nodeId);
      this.runtimeParents.set(nodeId, null);
      this.runtimeChildren.set(nodeId, []);
    }
    const node = this.componentNodeForDetachedRuntime(nodeId);
    if (!node) return null;
    return {
      command: IntroduceNode({
        ...this.commandSpec(node),
        parentId: parent.id,
        beforeId: null,
        node
      }),
      action: { nodeId, parentId: parent.id, name: node.name }
    };
  }

  reorderNodeAction () {
    const parent = this.random.pick(
      allNodes(this.document).filter(node => node.children.length > 1)
    );
    if (!parent) return null;
    const fromIndex = this.random.integer(0, parent.children.length);
    const toIndex = this.random.pick(
      parent.children.map((_child, index) => index).filter(index => index !== fromIndex)
    );
    const node = parent.children[fromIndex];
    const siblings = parent.children.filter(child => child !== node);
    return {
      command: MoveNode({
        ...this.commandSpec(node),
        parentId: parent.id,
        beforeId: siblings[toIndex]?.id ?? null
      }),
      action: { nodeId: node.id, parentId: parent.id, fromIndex, toIndex }
    };
  }

  reparentNodeAction () {
    const nodes = allNodes(this.document);
    const candidates = nodes.slice(1).flatMap(node => {
      const previousParent = findComponentParent(this.document, node.id);
      const subtreeIds = new Set(allNodes({ root: node }).map(descendant => descendant.id));
      return nodes
        .filter(parent => parent !== previousParent && !subtreeIds.has(parent.id) &&
          !parent.children.some(child => child.name === node.name))
        .map(parent => ({ node, previousParent, parent }));
    });
    const candidate = this.random.pick(candidates);
    if (!candidate) return null;
    const { node, previousParent, parent } = candidate;
    const toIndex = this.random.integer(0, parent.children.length + 1);
    return {
      command: MoveNode({
        ...this.commandSpec(node),
        parentId: parent.id,
        beforeId: parent.children[toIndex]?.id ?? null
      }),
      action: {
        nodeId: node.id,
        previousParentId: previousParent.id,
        parentId: parent.id,
        toIndex
      }
    };
  }

  suppressInheritedNodeAction () {
    const node = this.random.pick(allNodes(this.document).filter(candidate =>
      candidate.provenance.kind === ComponentNodeProvenanceKind.INHERITED &&
      !candidate.provenance.suppressed));
    if (!node) return null;
    return {
      command: SuppressInheritedNode(this.commandSpec(node)),
      action: { nodeId: node.id }
    };
  }

  restoreInheritedNodeAction () {
    const node = this.random.pick(allNodes(this.document).filter(candidate =>
      candidate.provenance.kind === ComponentNodeProvenanceKind.INHERITED &&
      candidate.provenance.suppressed));
    if (!node) return null;
    const parent = findComponentParent(this.document, node.id);
    return {
      command: RestoreInheritedNode({
        ...this.commandSpec(node),
        parentId: parent.id,
        beforeId: node.provenance.beforeId
      }),
      action: { nodeId: node.id, parentId: parent.id }
    };
  }

  staleCommandAction () {
    const node = this.random.pick(allNodes(this.document));
    const property = this.random.pick(FUZZ_PROPERTIES);
    const command = SetProperty({
      ...this.commandSpec(node),
      expectedRevision: this.document.revision + 1,
      property,
      value: this.valueForProperty(property)
    });
    return { command, rejected: true, action: { nodeId: node.id, property } };
  }

  actionFor (operation) {
    switch (operation) {
      case ComponentProjectionFuzzOperationKind.SET_PROPERTY:
        return this.setPropertyAction();
      case ComponentProjectionFuzzOperationKind.SET_OPAQUE_PROPERTY:
        return this.setOpaquePropertyAction();
      case ComponentProjectionFuzzOperationKind.CLEAR_PROPERTY_OVERRIDE:
        return this.clearPropertyAction();
      case ComponentProjectionFuzzOperationKind.EDIT_TEXT:
        return this.editTextAction();
      case ComponentProjectionFuzzOperationKind.SET_MASTER:
        return this.setMasterAction();
      case ComponentProjectionFuzzOperationKind.RENAME_NODE:
        return this.renameNodeAction();
      case ComponentProjectionFuzzOperationKind.INTRODUCE_FINAL_NODE:
        return this.introduceFinalNodeAction();
      case ComponentProjectionFuzzOperationKind.REMOVE_FINAL_NODE:
        return this.removeFinalNodeAction();
      case ComponentProjectionFuzzOperationKind.REORDER_NODE:
        return this.reorderNodeAction();
      case ComponentProjectionFuzzOperationKind.REPARENT_NODE:
        return this.reparentNodeAction();
      case ComponentProjectionFuzzOperationKind.SUPPRESS_INHERITED_NODE:
        return this.suppressInheritedNodeAction();
      case ComponentProjectionFuzzOperationKind.RESTORE_INHERITED_NODE:
        return this.restoreInheritedNodeAction();
      case ComponentProjectionFuzzOperationKind.REJECT_STALE_COMMAND:
        return this.staleCommandAction();
    }
  }

  chooseAction () {
    const attempted = new Set();
    while (attempted.size < this.operations.length) {
      const operation = this.nextOperation();
      if (attempted.has(operation)) continue;
      attempted.add(operation);
      const selected = this.actionFor(operation);
      if (selected) return { operation, ...selected };
    }
    throw new Error('No component projection fuzz operation is currently applicable');
  }

  runtimeContext () {
    return {
      resolveMorph: nodeId => this.runtimeTargets.get(nodeId),
      readMorphProperty: (target, property) => target[property],
      setMorphProperty: (target, property, value) => { target[property] = cloneValue(value); },
      validateMoveMorph: (target, from) => {
        const nodeId = this.runtimeTargetIds.get(target);
        const parentId = this.runtimeParents.get(nodeId);
        if (from.kind === MorphicAttachmentKind.DETACHED) {
          assertFuzzInvariant(parentId === null, `Runtime node ${nodeId} is not detached`);
          return;
        }
        assertFuzzInvariant(parentId === from.ownerId, `Runtime parent diverged for ${nodeId}`);
        assertFuzzInvariant(
          this.runtimeChildren.get(parentId)[from.index] === nodeId,
          `Runtime index diverged for ${nodeId}`
        );
      },
      moveMorph: (target, from, to) => {
        const nodeId = this.runtimeTargetIds.get(target);
        if (from.kind === MorphicAttachmentKind.ATTACHED) {
          this.runtimeChildren.get(from.ownerId).splice(from.index, 1);
          this.runtimeParents.set(nodeId, null);
        }
        if (to.kind === MorphicAttachmentKind.ATTACHED) {
          this.runtimeChildren.get(to.ownerId).splice(to.index, 0, nodeId);
          this.runtimeParents.set(nodeId, to.ownerId);
        }
      }
    };
  }

  runtimeValueResolver (selected) {
    return ({ phase, nodeId, property }) => Object.freeze({
      available: true,
      value: phase === 'before'
        ? cloneValue(this.runtimeTargets.get(nodeId)?.[property])
        : cloneValue(selected.runtimeValue)
    });
  }

  adapters () {
    return {
      sourceStore: {
        read: () => this.source,
        write: source => { this.source = source; }
      },
      documentStore: {
        read: () => this.document,
        write: document => { this.document = document; }
      },
      runtimeContext: this.runtimeContext()
    };
  }

  assertProjectionAgreement () {
    const parsed = parseComponentSource({
      source: this.source,
      moduleId: this.document.moduleId,
      exportName: this.document.exportName,
      componentId: this.document.componentId,
      parentDocument: this.parentDocument,
      resolveComponentDocument: this.resolveComponentDocument
    });
    assertFuzzInvariant(parsed.supported, 'Projected source stopped parsing');
    assertFuzzInvariant(
      componentDocumentsSemanticallyEqual(
        alignParsedDocumentIdentities(parsed.document, this.document),
        this.document
      ),
      'Projected source diverged from the reducer document'
    );
    assertFuzzInvariant(
      this.runtimeParents.get(this.document.root.id) === null,
      'Runtime root unexpectedly acquired a parent'
    );
    for (const node of allNodes(this.document)) {
      const target = this.runtimeTargets.get(node.id);
      assertFuzzInvariant(target?.name === node.name, `Runtime name diverged for ${node.id}`);
      assertFuzzInvariant(
        valuesEqual(
          this.runtimeChildren.get(node.id),
          node.children
            .filter(child => child.provenance.kind !== ComponentNodeProvenanceKind.INHERITED ||
              !child.provenance.suppressed)
            .map(child => child.id)
        ),
        `Runtime child order diverged for ${node.id}`
      );
      node.children.forEach(child => {
        const expectedParentId = child.provenance.kind === ComponentNodeProvenanceKind.INHERITED &&
          child.provenance.suppressed
          ? null
          : node.id;
        assertFuzzInvariant(
          this.runtimeParents.get(child.id) === expectedParentId,
          `Runtime parent diverged for ${child.id}`
        );
      });
      const properties = new Set([
        ...FUZZ_PROPERTIES,
        ...Object.keys(target),
        ...Object.keys(node.properties)
      ]);
      properties.delete('name');
      for (const property of properties) {
        if (property === 'layout' && findComponentLayoutModel(this.document, node.id)) {
          continue;
        }
        const entry = node.properties[property];
        const key = `${node.id}:${property}`;
        const expected = entry?.kind === ComponentPropertyKind.EXPLICIT_VALUE
          ? entry.value
          : entry?.kind === ComponentPropertyKind.OPAQUE_EXPRESSION
            ? this.opaqueRuntimeValues.get(key)
            : this.baselineValue(node.id, property);
        assertFuzzInvariant(
          valuesEqual(target[property], expected),
          `Runtime value diverged for ${node.id}.${property}`
        );
      }
    }
  }

  performRejectedAction (selected) {
    const sourceBefore = this.source;
    const documentBefore = this.document;
    const runtimeBefore = runtimeSnapshot(
      this.runtimeTargets,
      this.runtimeParents,
      this.runtimeChildren
    );
    const planned = prepareScalarComponentTransaction({
      id: `fuzz-${this.seed}-${this.actions.length}`,
      source: this.source,
      document: this.document,
      command: selected.command,
      resolveRuntimeTargetId: nodeId => nodeId,
      resolveRuntimeValue: this.runtimeValueResolver(selected)
    });
    assertFuzzInvariant(!planned.supported, 'A stale component command was unexpectedly planned');
    assertFuzzInvariant(this.source === sourceBefore, 'Rejected planning changed source');
    assertFuzzInvariant(this.document === documentBefore, 'Rejected planning changed the document');
    assertFuzzInvariant(
      valuesEqual(runtimeSnapshot(
        this.runtimeTargets,
        this.runtimeParents,
        this.runtimeChildren
      ), runtimeBefore),
      'Rejected planning changed runtime state'
    );
  }

  performCommandAction (selected) {
    const sourceBefore = this.source;
    const documentBefore = this.document;
    const runtimeBefore = runtimeSnapshot(
      this.runtimeTargets,
      this.runtimeParents,
      this.runtimeChildren
    );
    const planned = prepareScalarComponentTransaction({
      id: `fuzz-${this.seed}-${this.actions.length}`,
      source: this.source,
      document: this.document,
      command: selected.command,
      resolveRuntimeTargetId: nodeId => nodeId,
      resolveRuntimeValue: this.runtimeValueResolver(selected)
    });
    assertFuzzInvariant(
      planned.supported,
      `Component command planning failed: ${JSON.stringify(planned.diagnostics)}`
    );

    const inverseReduction = reduceComponent(
      planned.transaction.document,
      planned.transaction.inverseCommand
    );
    assertFuzzInvariant(
      componentDocumentsSemanticallyEqual(inverseReduction.document, documentBefore),
      'A semantic command followed by its inverse did not restore the document'
    );

    commitPreparedComponentTransaction(planned.transaction, this.adapters());
    applyPreparedComponentTransaction(planned.transaction, {
      ...this.adapters(),
      direction: ComponentTransactionDirection.REVERSE
    });
    assertFuzzInvariant(this.source === sourceBefore, 'Transaction undo did not restore exact source');
    assertFuzzInvariant(this.document === documentBefore, 'Transaction undo did not restore the document snapshot');
    assertFuzzInvariant(
      valuesEqual(runtimeSnapshot(
        this.runtimeTargets,
        this.runtimeParents,
        this.runtimeChildren
      ), runtimeBefore),
      'Transaction undo did not restore runtime state'
    );
    applyPreparedComponentTransaction(planned.transaction, {
      ...this.adapters(),
      direction: ComponentTransactionDirection.FORWARD
    });

    const key = `${selected.command.nodeId}:${selected.command.property}`;
    if (selected.command.kind === ComponentCommandKind.SET_PROPERTY &&
        selected.command.entry.kind === ComponentPropertyKind.OPAQUE_EXPRESSION) {
      this.opaqueRuntimeValues.set(key, cloneValue(selected.runtimeValue));
    } else if (selected.command.property) {
      this.opaqueRuntimeValues.delete(key);
    }
    this.assertProjectionAgreement();
  }

  step () {
    const step = this.actions.length;
    let selected = { operation: 'select-operation', action: {} };
    try {
      selected = this.chooseAction();
      if (selected.rejected) this.performRejectedAction(selected);
      else this.performCommandAction(selected);
      const recorded = Object.freeze({
        step,
        operation: selected.operation,
        ...selected.action,
        revision: this.document.revision,
        sourceLength: this.source.length
      });
      this.actions.push(recorded);
      return recorded;
    } catch (error) {
      throw new ComponentProjectionFuzzError(
        `Component projection fuzzing failed: ${error.message}`,
        {
          seed: this.seed,
          step,
          operation: selected.operation,
          action: selected.action,
          actions: [...this.actions],
          source: this.source,
          layoutModels: this.document.layoutModels,
          layoutReferenceLocations: this.document.sourceMetadata.layoutReferenceLocations
        },
        error
      );
    }
  }

  run (steps = 100) {
    if (!Number.isInteger(steps) || steps < 0) {
      throw new Error(`Invalid component projection fuzz step count: ${steps}`);
    }
    while (this.actions.length < steps) this.step();
    return Object.freeze({
      seed: this.seed,
      steps,
      actions: Object.freeze(this.actions.slice()),
      source: this.source,
      document: this.document,
      runtime: Object.freeze(runtimeSnapshot(
        this.runtimeTargets,
        this.runtimeParents,
        this.runtimeChildren
      ))
    });
  }
}

export function runComponentProjectionFuzz (options = {}) {
  const { steps = 100, ...fuzzerOptions } = options;
  return new ComponentProjectionFuzzer(fuzzerOptions).run(steps);
}
