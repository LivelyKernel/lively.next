import { obj } from 'lively.lang';
import module from 'lively.modules/src/module.js';
import { ExpressionSerializer } from 'lively.serializer2';
import { connect } from 'lively.bindings';
import { morph } from 'lively.morphic';
import {
  MorphicAttachmentKind,
  MorphicOperationKind
} from 'lively.morphic/changes/index.js';
import { CompositeEditTransaction } from 'lively.morphic/undo.js';
import { getTextAttributesExpr, getValueExpr } from './helpers.js';
import {
  ClearPropertyOverride,
  SetOpaqueProperty,
  SetProperty
} from './reconciliation/commands.js';
import { componentImportBindingsFromExpression } from './reconciliation/import-bindings.js';
import { parseComponentSource } from './reconciliation/source-adapter.js';
import { serializeRuntimeComponentNode } from './reconciliation/runtime-node-serializer.js';
import {
  ComponentDocument,
  ComponentNode,
  findComponentLayoutModel,
  findComponentNode,
  findComponentParent,
  localNodeProvenance,
  sourceComponentReference
} from './reconciliation/component-document.js';
import {
  ComponentBridgeCommandKind,
  MorphicChangeSetAdapter
} from './reconciliation/morphic-change-set-adapter.js';
import {
  ShadowProjectionComparisonKind,
  compareShadowProjectionToCurrentSource,
  prepareShadowScalarProjection
} from './reconciliation/shadow-projection.js';
import {
  ComponentTransactionDirection,
  ComponentRuntimeCommitMode,
  ProjectionalComponentEditTransaction,
  applyPreparedComponentTransaction,
  commitPreparedComponentTransaction,
  prepareScalarComponentTransaction,
  preparedComponentTransactionFromShadowProjection
} from './reconciliation/component-transaction.js';
import {
  planDerivedComponentRenamePropagation,
  planDerivedComponentStructurePropagation
} from './reconciliation/derived-projector.js';
import {
  DerivedRuntimeStructureProjectionKind,
  projectCachedDerivedRuntimeStructure
} from './reconciliation/derived-runtime-projector.js';
import {
  DerivedTransactionDirection,
  PreparedDerivedPropagationTransaction,
  PreparedDerivedRuntimeChangeTransaction,
  PreparedDerivedRuntimeRenameTransaction,
  ProjectionalDerivedEditTransaction,
  ProjectionalDerivedRuntimeChangeEditTransaction,
  ProjectionalDerivedRuntimeEditTransaction,
  applyPreparedDerivedPropagation,
  applyPreparedDerivedRuntimeChanges,
  applyPreparedDerivedRuntimeRenames,
  validatePreparedDerivedPropagation,
  validatePreparedDerivedRuntimeChanges,
  validatePreparedDerivedRuntimeRenames
} from './reconciliation/derived-transaction.js';
import {
  PolicyCacheTransactionDirection,
  PreparedPolicyCachePropertyTransaction,
  PreparedPolicyCacheRenameTransaction,
  ProjectionalPolicyCacheEditTransaction,
  ProjectionalPolicyCachePropertyEditTransaction,
  applyPreparedPolicyCacheProperties,
  applyPreparedPolicyCacheRenames,
  validatePreparedPolicyCacheProperties,
  validatePreparedPolicyCacheRenames
} from './reconciliation/policy-cache-transaction.js';

const derivedExpressionSerializer = new ExpressionSerializer();
const moduleReconciliationStates = new WeakMap();

function moduleReconciliationStateFor (tracker) {
  const componentModule = tracker.componentModule;
  if (!componentModule || (typeof componentModule !== 'object' &&
                           typeof componentModule !== 'function')) return null;
  let state = moduleReconciliationStates.get(componentModule);
  if (!state) {
    state = { pending: null, completion: null };
    moduleReconciliationStates.set(componentModule, state);
  }
  return state;
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

function policySpecProperties (spec) {
  if (spec?.isPolicy) return spec.spec;
  if (spec?.COMMAND === 'add') return spec.props;
  return spec?.props || spec;
}

function projectionalPolicyTextAndAttributes (textAndAttributes) {
  return textAndAttributes.map(value => value?.isMorph
    ? { ...value.spec(), __isSpec__: true }
    : value);
}

function materializeProjectionalTextAndAttributes (textAndAttributes) {
  return textAndAttributes.map(value => {
    if (value?.__isSpec__) return morph(value);
    if (value?.isPolicy && typeof value.instantiate === 'function') {
      return value.instantiate();
    }
    if (value?.isMorph && typeof value.copy === 'function') return value.copy();
    return value;
  });
}

function projectionalTextValueMatches (current, expected) {
  if (!Array.isArray(current) || current.length !== expected.length) return false;
  return current.every((value, index) => {
    const expectedValue = expected[index];
    if (value?.isMorph && expectedValue?.__isSpec__) {
      const expectedSpec = { ...expectedValue };
      delete expectedSpec.__isSpec__;
      return obj.equals(value.spec(), expectedSpec);
    }
    if (value?.isMorph && expectedValue?.isMorph) {
      return obj.equals(value.spec(), expectedValue.spec());
    }
    return obj.equals(value, expectedValue);
  });
}

function isProjectionalExplicitValue (value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index++) {
      if (!(index in value) || !isProjectionalExplicitValue(value[index])) return false;
    }
    return true;
  }
  return !!value && Object.getPrototypeOf(value) === Object.prototype &&
    Object.values(value).every(isProjectionalExplicitValue);
}

export const ProjectionalCommandDiagnosticKind = Object.freeze({
  SOURCE_UNSUPPORTED: 'source-unsupported',
  TARGET_UNRESOLVED: 'target-unresolved',
  UNDO_UNAVAILABLE: 'undo-unavailable',
  PLANNING_FAILED: 'planning-failed'
});

export class ProjectionalReconciliationUnsupportedError extends Error {
  constructor (change, batch = null) {
    const diagnostics = [
      ...(batch?.diagnostics || []),
      ...(batch?.shadowProjection?.diagnostics || []),
      batch?.renameDiagnostic
    ].filter(Boolean);
    const reason = diagnostics.map(({ message, kind }) => message || kind).join('; ') ||
      'No projectional command committed the change';
    const message = `Projectional reconciliation does not support this change: ${reason}`;
    super(message);
    this.name = 'ProjectionalReconciliationUnsupportedError';
    this.message = message;
    this.change = change;
    this.batch = batch;
    this.diagnostics = Object.freeze(diagnostics);
  }
}

export const ProjectionalRenameDiagnosticKind = Object.freeze({
  DERIVED_DEPENDANTS: 'derived-dependants',
  OWNER_LAYOUT: 'owner-layout'
});

export const ProjectionalStructuralDiagnosticKind = Object.freeze({
  DERIVED_DEPENDANTS: 'derived-dependants'
});

const ProjectionalPolicyCacheProjectionKind = Object.freeze({
  RENAME: 'rename',
  PROPERTY: 'property'
});

function unsupportedProjectionalCommand (kind, message, details = {}) {
  return Object.freeze({
    committed: false,
    diagnostics: Object.freeze([Object.freeze({ kind, message, ...details })])
  });
}

export function componentChangeTrackerFor (morph) {
  for (let current = morph; current; current = current.owner) {
    const tracker = current._changeTracker;
    if (tracker && (typeof tracker.tracksMorph !== 'function' || tracker.tracksMorph(morph))) {
      return tracker;
    }
  }
  return null;
}

export function setMorphPropertyWithComponentCommand (options = {}) {
  const { target, property, value } = options;
  if (!target || typeof property !== 'string' || !property ||
      !Object.prototype.hasOwnProperty.call(options, 'value')) {
    throw new Error('Setting a morph property requires a target, property, and value');
  }
  const tracker = componentChangeTrackerFor(target);
  if (tracker) return tracker.setProperty(options);

  if (property in target) target[property] = value;
  else if (typeof target.setProperty === 'function') target.setProperty(property, value);
  else target[property] = value;
  return null;
}

/**
 * ComponentChangeTrackers listen for evals of the componet module
 * and then make sure the new master components replace the currently
 * visible ones seamlessly so direct manipulation does not happen on
 * abandoned master components any more.
 * They also listen for changes on the component morphs in case they
 * are open and reconcile the corresponding source code to reflect these changes.
 */
export class ComponentChangeTracker {
  constructor (aComponent, descriptor, S = System) {
    this.trackedComponent = aComponent;
    this.componentModuleId = aComponent[Symbol.for('lively-module-meta')].moduleId;
    this.componentModule = module(S, this.componentModuleId);
    this.componentDescriptor = descriptor;
    connect(aComponent, 'onSubmorphChange', this, 'processChangeInComponent', { garbageCollect: true });
    connect(aComponent, 'onChange', this, 'processChangeInComponent', { garbageCollect: true });
    this.committedChangeAdapter = new MorphicChangeSetAdapter({
      componentId: `${this.componentModuleId}::${aComponent.name}`,
      containsMorph: morph => this.tracksMorph(morph),
      ignoreOperation: (operation, context) =>
        this.ignoreCommittedTextOperation(operation, context)
    });
    this._committedChangeListener = (changeSet, context) =>
      this.processCommittedChangeSet(changeSet, context);
    aComponent.env.changeManager.addCommittedChangeListener(this._committedChangeListener);
    aComponent._changeTracker = this;
  }

  tracksMorph (morph) {
    return morph === this.trackedComponent || this.trackedComponent.isAncestorOf(morph);
  }

  ignoreCommittedTextOperation (operation, context) {
    const target = context.resolveMorph?.(operation.targetId);
    if (operation.kind === MorphicOperationKind.SET_MORPH_PROPERTY) {
      // TextMorph derives these implementation properties while installing
      // rich content. The semantic textAndAttributes operation owns the source
      // projection; explicit command callers can still set needsDocument.
      if (target?.isText &&
          ['document', 'textLayout', 'needsDocument'].includes(operation.property)) {
        return true;
      }
      // Auto-fitting text records its derived extent as a layout action for
      // static text and as a meta interaction for document-backed text. It may
      // be recomputed before undo, so projecting it as an independent exact
      // edit creates a stale extent precondition. Deliberate Text extent edits
      // have neither internal marker and must continue through reconciliation.
      if (target?.isText && operation.property === 'extent' &&
          (operation.metadata?.isLayoutAction ||
           operation.metadata?.metaInteraction)) return true;
      return operation.property === 'position' &&
        target?.owner?.isText &&
        target.owner.textAndAttributes?.includes(target);
    }
    if (operation.kind !== MorphicOperationKind.MOVE_MORPH || !target) return false;
    const owners = [operation.from.ownerId, operation.to.ownerId]
      .map(id => id && context.resolveMorph?.(id))
      .filter(Boolean);
    return owners.some(owner => owner.isText &&
      (owner.textAndAttributes?.includes(target) || target.owner === owner));
  }

  processCommittedChangeSet (changeSet, context) {
    const result = this.committedChangeAdapter.adapt(changeSet, context);
    if (!result.commands.length && !result.diagnostics.length) return result;
    const shadowProjection = this.prepareShadowProjection(result.commands, context);
    let batch = Object.freeze({
      changeSetId: changeSet.id,
      origin: changeSet.origin,
      commands: result.commands,
      diagnostics: result.diagnostics,
      shadowProjection
    });
    const derivedPropagation = this.prepareProjectionalDerivedRename(batch) ||
      this.prepareProjectionalDerivedStructure(batch, context);
    if (derivedPropagation) batch = Object.freeze({ ...batch, derivedPropagation });
    const policyCacheProjection = this.prepareProjectionalPolicyCacheProjection(batch, context);
    if (policyCacheProjection) batch = Object.freeze({ ...batch, policyCacheProjection });
    const renameDiagnostic = this.projectionalRenameDiagnostic(batch, context);
    if (renameDiagnostic) batch = Object.freeze({ ...batch, renameDiagnostic });
    const projectionalCommit = renameDiagnostic
      ? null
      : this.commitProjectionalBatch(batch, context);
    if (projectionalCommit) {
      batch = Object.freeze({ ...batch, projectionalCommit });
    } else {
      // No unsupported projection becomes authoritative. Reparse on the next
      // attempt instead of retaining a document this batch did not commit.
      this._projectionalDocument = null;
      this._projectionalSource = null;
    }
    this.shadowCommandBatches = (this.shadowCommandBatches || []).concat(batch).slice(-100);
    this.lastShadowCommandBatch = batch;
    this.scheduleShadowProjectionComparison(batch);
    this.onShadowComponentCommands?.(batch);
    return Object.freeze({
      ...result,
      shadowProjection,
      projectionalCommit: batch.projectionalCommit || null
    });
  }

  projectionallyOwnedLegacyChanges (batch, context) {
    const legacyChanges = context.legacyChanges || [];
    const command = batch.commands[0];
    if (batch.commands.length !== 1 ||
        command?.kind !== ComponentBridgeCommandKind.EDIT_TEXT) {
      return legacyChanges;
    }

    const undoManager = this.trackedComponent?.env?.undoManager;
    const recorded = undoManager?.undoInProgress?.recorder?.changes;
    const target = context.resolveMorph?.(command.sourceOperation.targetId);
    if (!Array.isArray(recorded) || !target) return legacyChanges;

    // Document-backed TextMorphs implement a textAndAttributes assignment via
    // replace(). The change engine records both the semantic property change
    // and a legacy MethodCallChange wrapper (plus the wrapper's derived leaf
    // changes). The component transaction must own all of them; retaining the
    // wrapper would apply the text inverse twice during undo.
    const replacementWrappers = recorded.filter(change =>
      change.target === target &&
      change.selector === 'replace' &&
      obj.equals(change.meta?.prevTextAndAttributes, command.previousValue));
    if (!replacementWrappers.length) return legacyChanges;

    const owned = new Set(legacyChanges);
    const includeChangeTree = change => {
      owned.add(change);
      change.changes?.forEach(includeChangeTree);
    };
    replacementWrappers.forEach(includeChangeTree);
    return recorded.filter(change => owned.has(change));
  }

  componentNodeIdForMorph (document, morph, bridgeCommand, context = {}) {
    if (!morph) return null;
    if (morph === this.trackedComponent) return document.root.id;
    const path = [];
    let current = morph;
    while (current && current !== this.trackedComponent) {
      path.unshift(current.name);
      if (current === morph && bridgeCommand.kind === ComponentBridgeCommandKind.REMOVE_NODE) {
        current = context.resolveMorph?.(bridgeCommand.parentId);
      } else if (current === morph && bridgeCommand.kind === ComponentBridgeCommandKind.MOVE_NODE) {
        current = context.resolveMorph?.(bridgeCommand.previousParentId);
      } else {
        current = current.owner;
      }
    }
    if (current !== this.trackedComponent) return null;
    if (bridgeCommand.kind === ComponentBridgeCommandKind.RENAME_NODE) {
      path[path.length - 1] = bridgeCommand.previousName;
    }
    let node = document.root;
    for (const name of path) {
      node = node.children.find(child => child.name === name);
      if (!node) return null;
    }
    return node.id;
  }

  projectionalRuntimeParentDocument (commands, context) {
    const parentPolicy = this.componentDescriptor?.stylePolicy?.parent;
    if (!parentPolicy) return null;
    const componentId = this.committedChangeAdapter.componentId;
    const childrenOf = owner => (owner?.submorphs || owner?.children || []).slice();
    const childrenBeforeCommand = owner => {
      const children = childrenOf(owner);
      for (const command of commands) {
        if (command.kind !== ComponentBridgeCommandKind.REMOVE_NODE ||
            command.parentId !== owner?.id) continue;
        const removed = context.resolveMorph?.(command.nodeId);
        if (removed && !children.includes(removed)) children.splice(command.index, 0, removed);
      }
      return children;
    };
    const runtimeNameBeforeCommands = morph => commands.find(command =>
      command.kind === ComponentBridgeCommandKind.RENAME_NODE &&
      command.nodeId === morph?.id
    )?.previousName || morph?.name;
    const nodeFromSpec = (spec, path, isRoot = false) => {
      const properties = spec?.COMMAND === 'add' ? spec.props : spec?.props || spec;
      const name = properties?.name || (isRoot ? 'parent' : null);
      if (typeof name !== 'string' || !name) return null;
      const children = (properties.submorphs || []).map((child, index) =>
        nodeFromSpec(child, [...path, `${index}:${child?.props?.name || child?.name || 'unnamed'}`])
      );
      if (children.some(child => !child)) return null;
      return new ComponentNode({
        id: isRoot
          ? `${componentId}:parent-root`
          : `${componentId}:parent:${path.map(encodeURIComponent).join('/')}`,
        name,
        provenance: localNodeProvenance(),
        children
      });
    };
    if (typeof parentPolicy.asBuildSpec === 'function') {
      try {
        const root = nodeFromSpec(parentPolicy.asBuildSpec(true), [], true);
        if (root) {
          return new ComponentDocument({
            componentId: `${componentId}:parent-policy`,
            moduleId: this.componentModuleId,
            exportName: `${this.componentDescriptor.componentName}ParentPolicy`,
            root
          });
        }
      } catch {
        return null;
      }
    }
    const nodeFromRuntime = (morph, path, isRoot = false) => new ComponentNode({
      id: isRoot
        ? `${componentId}:parent-root`
        : `${componentId}:inherited:${path.map(encodeURIComponent).join('/')}`,
      name: runtimeNameBeforeCommands(morph) ||
        (isRoot ? this.componentDescriptor.componentName : null),
      provenance: localNodeProvenance(),
      children: childrenBeforeCommand(morph).map(child => {
        const childName = runtimeNameBeforeCommands(child);
        return nodeFromRuntime(child, [...path, childName]);
      })
    });
    return new ComponentDocument({
      componentId: `${componentId}:parent-snapshot`,
      moduleId: this.componentModuleId,
      exportName: `${this.componentDescriptor.componentName}ParentSnapshot`,
      root: nodeFromRuntime(this.trackedComponent, [], true)
    });
  }

  projectionalComponentDocumentResolver (componentModule = this.componentModule) {
    const cache = new Map();
    const recorder = componentModule?.recorder ||
      componentModule?.env?.()?.recorder || {};
    return ({ expression }) => {
      if (cache.has(expression)) return cache.get(expression);
      if (!/^[A-Za-z_$][\w$]*$/.test(expression)) return null;
      const reference = recorder[expression];
      const policy = reference?.isComponentDescriptor
        ? reference.stylePolicy
        : reference?.isPolicy ? reference : null;
      if (!policy || typeof policy.asBuildSpec !== 'function') return null;
      const metaSymbol = Symbol.for('lively-module-meta');
      const meta = reference?.[metaSymbol] || policy[metaSymbol] || {};
      const resolvedModuleId = meta.moduleId || componentModule?.id || this.componentModuleId;
      const resolvedExportName = meta.exportedName || expression;
      const resolvedComponentId = `${resolvedModuleId}#${resolvedExportName}:resolved`;
      try {
        const nestedPartReference = spec => {
          const master = spec?.master?.isComponentDescriptor
            ? spec.master.stylePolicy
            : spec?.master;
          const policies = [
            master,
            master?._autoMaster,
            master?.parent,
            master?._parent
          ];
          const componentMeta = policies
            .map(policy => policy?.[metaSymbol])
            .find(candidate =>
              typeof candidate?.exportedName === 'string' &&
              candidate.exportedName &&
              Array.isArray(candidate.path) && candidate.path.length === 0);
          return componentMeta
            ? sourceComponentReference(componentMeta.exportedName)
            : null;
        };
        const nodeFromSpec = (spec, path = [], isRoot = false) => {
          const name = spec?.name || (isRoot ? resolvedExportName : null);
          if (typeof name !== 'string' || !name) {
            throw new Error(`Resolved component ${expression} contains an unnamed node`);
          }
          const id = isRoot
            ? `${resolvedComponentId}:root`
            : `${resolvedComponentId}:node:${path.map(segment =>
                encodeURIComponent(segment)).join('/')}`;
          return new ComponentNode({
            id,
            name,
            provenance: localNodeProvenance(),
            partComponent: isRoot ? null : nestedPartReference(spec),
            children: (spec?.submorphs || []).map((child, index) =>
              nodeFromSpec(child, [...path, `${index}:${child?.name || 'unnamed'}`]))
          });
        };
        const document = new ComponentDocument({
          componentId: resolvedComponentId,
          moduleId: resolvedModuleId,
          exportName: resolvedExportName,
          root: nodeFromSpec(policy.asBuildSpec(true), [], true)
        });
        cache.set(expression, document);
        return document;
      } catch (error) {
        cache.set(expression, null);
        return null;
      }
    };
  }

  projectionalDerivedDescriptors (descriptor) {
    const policy = descriptor?.stylePolicy || descriptor;
    const dependants = policy?._dependants;
    if (!dependants) return [];
    const descriptors = [];
    for (const expression of dependants) {
      const policyOrDescriptor = derivedExpressionSerializer.deserializeExpr(expression);
      const meta = policyOrDescriptor?.[Symbol.for('lively-module-meta')] || {};
      let derivedDescriptor = policyOrDescriptor;
      if (meta.path?.length > 0) {
        derivedDescriptor = module(
          this.componentDescriptor.System || System,
          meta.moduleId
        ).recorder?.[meta.exportedName];
      }
      if (derivedDescriptor?.isPolicy && meta.moduleId && meta.exportedName) {
        derivedDescriptor = module(
          this.componentDescriptor.System || System,
          meta.moduleId
        ).recorder?.[meta.exportedName] || derivedDescriptor;
      }
      if (!derivedDescriptor) {
        throw new Error('Could not resolve a registered derived component');
      }
      descriptors.push(derivedDescriptor);
    }
    return descriptors;
  }

  projectionalModuleForId (moduleId) {
    if (this.componentModule?.id === moduleId || this.componentModuleId === moduleId) {
      return this.componentModule;
    }
    return module(this.componentDescriptor.System || System, moduleId);
  }

  projectionalDerivedComponentDescription (descriptor, baseSourceAfter) {
    const meta = descriptor?.[Symbol.for('lively-module-meta')] ||
      descriptor?.stylePolicy?.[Symbol.for('lively-module-meta')] || {};
    const moduleId = meta.moduleId || descriptor?.moduleName;
    const exportName = meta.exportedName || descriptor?.componentName;
    const derivedModule = this.projectionalModuleForId(moduleId);
    return {
      source: derivedModule.id === this.componentModule.id
        ? baseSourceAfter
        : derivedModule._source,
      moduleId: derivedModule.id,
      exportName,
      componentId: `${derivedModule.id}#${exportName}:derived-projection`,
      resolveComponentDocument: this.projectionalComponentDocumentResolver(derivedModule)
    };
  }

  prepareProjectionalDerivedRename (batch) {
    const command = batch.commands[0];
    if (batch.commands.length !== 1 ||
        command?.kind !== ComponentBridgeCommandKind.RENAME_NODE ||
        !batch.shadowProjection?.supported ||
        !this.componentDescriptor?.stylePolicy?._dependants?.size) return null;
    try {
      const baseSourceAfter = batch.shadowProjection.sourceAfter;
      const propagation = planDerivedComponentRenamePropagation({
        root: this.componentDescriptor,
        beforeParentDocument: batch.shadowProjection.beforeDocument,
        afterParentDocument: batch.shadowProjection.document,
        nodeId: batch.shadowProjection.steps[0].componentCommand.nodeId,
        getDependants: descriptor => this.projectionalDerivedDescriptors(descriptor),
        describeComponent: descriptor =>
          this.projectionalDerivedComponentDescription(descriptor, baseSourceAfter)
      });
      if (!propagation.supported) return propagation;
      const runtimeRenames = [];
      for (const component of propagation.components) {
        const activeComponent = component.dependant?._cachedComponent;
        if (!activeComponent) continue;
        const path = componentNodeNamePath(component.projection.beforeDocument,
          batch.shadowProjection.steps[0].componentCommand.nodeId);
        if (!path) continue;
        let target = activeComponent;
        for (const name of path) {
          target = (target.submorphs || []).find(morph => morph.name === name);
          if (!target) break;
        }
        if (!target) continue;
        const beforeNode = findComponentNode(
          component.projection.beforeDocument,
          batch.shadowProjection.steps[0].componentCommand.nodeId
        );
        const afterNode = findComponentNode(
          component.projection.document,
          batch.shadowProjection.steps[0].componentCommand.nodeId
        );
        if (target.name !== beforeNode.name) {
          throw new Error(
            `Cached derived component ${component.exportName} changed while rename propagation was planned`
          );
        }
        runtimeRenames.push(Object.freeze({
          id: `${component.moduleId}#${component.exportName}:${beforeNode.id}`,
          beforeName: beforeNode.name,
          afterName: afterNode.name,
          target
        }));
      }
      return Object.freeze({
        ...propagation,
        runtimeRenames: Object.freeze(runtimeRenames)
      });
    } catch (error) {
      return Object.freeze({
        supported: false,
        components: Object.freeze([]),
        modules: Object.freeze([]),
        diagnostics: Object.freeze([Object.freeze({
          kind: ProjectionalRenameDiagnosticKind.DERIVED_DEPENDANTS,
          message: error.message,
          error
        })])
      });
    }
  }

  prepareProjectionalDerivedStructure (batch, context) {
    const command = batch.commands[0];
    if (batch.commands.length !== 1 ||
        ![
          ComponentBridgeCommandKind.INTRODUCE_NODE,
          ComponentBridgeCommandKind.REMOVE_NODE,
          ComponentBridgeCommandKind.MOVE_NODE
        ].includes(command?.kind) ||
        !batch.shadowProjection?.supported ||
        batch.shadowProjection.beforeDocument?.parentComponent ||
        !this.componentDescriptor?.stylePolicy?._dependants?.size) return null;
    try {
      const propagation = planDerivedComponentStructurePropagation({
        root: this.componentDescriptor,
        beforeParentDocument: batch.shadowProjection.beforeDocument,
        afterParentDocument: batch.shadowProjection.document,
        getDependants: descriptor => this.projectionalDerivedDescriptors(descriptor),
        describeComponent: descriptor => this.projectionalDerivedComponentDescription(
          descriptor,
          batch.shadowProjection.sourceAfter
        )
      });
      if (!propagation.supported) return propagation;
      const cachedComponents = propagation.components.filter(
        ({ dependant }) => dependant?._cachedComponent
      );
      let runtimeStructuralProjection = null;
      if (cachedComponents.length) {
        const nodeId = batch.shadowProjection.steps[0].componentCommand.nodeId;
        const projection = projectCachedDerivedRuntimeStructure({
          components: cachedComponents,
          nodeId,
          commandKind: command.kind === ComponentBridgeCommandKind.REMOVE_NODE
            ? DerivedRuntimeStructureProjectionKind.REMOVE
            : command.kind === ComponentBridgeCommandKind.MOVE_NODE
              ? DerivedRuntimeStructureProjectionKind.MOVE
              : DerivedRuntimeStructureProjectionKind.INTRODUCE,
          changeSetId: batch.changeSetId,
          sourceMorph: command.kind === ComponentBridgeCommandKind.INTRODUCE_NODE
            ? context.resolveMorph?.(command.nodeId)
            : null
        });
        if (projection) {
          const resolveMorph = id => projection.resolveMorph(id) || context.resolveMorph?.(id);
          runtimeStructuralProjection = Object.freeze({
            changeSet: projection.changeSet,
            inverseChangeSet: projection.inverseChangeSet,
            runtimeContext: this.runtimeProjectionContext({ ...context, resolveMorph })
          });
        }
      }
      return Object.freeze({
        ...propagation,
        runtimeRenames: Object.freeze([]),
        runtimeStructuralProjection
      });
    } catch (error) {
      return Object.freeze({
        supported: false,
        components: Object.freeze([]),
        modules: Object.freeze([]),
        diagnostics: Object.freeze([Object.freeze({
          kind: ProjectionalStructuralDiagnosticKind.DERIVED_DEPENDANTS,
          message: error.message,
          error
        })])
      });
    }
  }

  prepareShadowProjection (commands, context) {
    if (!this.componentModule || !this.componentDescriptor) return null;
    const projectionSequence = this._shadowProjectionCounter || 0;
    this._shadowProjectionCounter = projectionSequence + 1;
    return prepareShadowScalarProjection({
      source: this.currentModuleSource,
      moduleId: this.componentModuleId,
      exportName: this.componentDescriptor.componentName,
      componentId: this.committedChangeAdapter.componentId,
      bridgeCommands: commands,
      parentDocument: this.projectionalRuntimeParentDocument(commands, context),
      resolveComponentDocument: this.projectionalComponentDocumentResolver(),
      beforeDocument: this._projectionalSource === this.currentModuleSource
        ? this._projectionalDocument
        : null,
      projectionId: `shadow-${this.committedChangeAdapter.componentId}-${projectionSequence}`,
      resolveNodeId: (document, bridgeCommand) => this.componentNodeIdForMorph(
        document,
        context.resolveMorph?.(
          bridgeCommand.kind === ComponentBridgeCommandKind.INTRODUCE_NODE
            ? bridgeCommand.parentId
            : bridgeCommand.nodeId
        ),
        bridgeCommand,
        context
      ),
      resolveDestinationParentId: (document, bridgeCommand) =>
        this.componentNodeIdForMorph(
          document,
          context.resolveMorph?.(bridgeCommand.parentId),
          { kind: ComponentBridgeCommandKind.SET_PROPERTY },
          context
        ),
      runtimeNodeNameFor: bridgeCommand =>
        context.resolveMorph?.(bridgeCommand.nodeId)?.name,
      runtimeOrderingNameFor: bridgeCommand => {
        const morph = context.resolveMorph?.(bridgeCommand.nodeId);
        const parent = context.resolveMorph?.(bridgeCommand.parentId);
        const children = parent?.submorphs || parent?.children;
        if (!morph || !Array.isArray(children)) return undefined;
        const index = children.indexOf(morph);
        return index < 0 ? undefined : children[index + 1]?.name ?? null;
      },
      valueExpressionFor: bridgeCommand => bridgeCommand.kind === ComponentBridgeCommandKind.EDIT_TEXT
        ? getTextAttributesExpr(context.resolveMorph?.(bridgeCommand.nodeId))
        : getValueExpr(
            bridgeCommand.kind === ComponentBridgeCommandKind.SET_MASTER
              ? 'master'
              : bridgeCommand.property,
            bridgeCommand.value
          ),
      introducedNodeFor: ({
        document,
        parentId,
        index,
        bridgeCommand,
        partComponent,
        materializePartSubtree
      }) =>
        serializeRuntimeComponentNode({
          document,
          parentId,
          index,
          morph: context.resolveMorph?.(bridgeCommand.nodeId),
          partComponent,
          materializePartSubtree,
          allocateName: candidate =>
            this.componentDescriptor.ensureNoNameCollisionInDerived?.(candidate, true) ||
            candidate
        }),
      runtimeLayoutFor: spec => this.projectionalRuntimeLayoutFor(spec, context)
    });
  }

  projectionalRuntimeLayoutFor ({
    beforeDocument,
    semanticDelta,
    bridgeCommand
  }, context) {
    const ownerId = bridgeCommand.kind === ComponentBridgeCommandKind.RENAME_NODE
      ? findComponentParent(beforeDocument, semanticDelta.nodeId)?.id
      : bridgeCommand.kind === ComponentBridgeCommandKind.REMOVE_NODE
        ? semanticDelta.parentId
        : bridgeCommand.kind === ComponentBridgeCommandKind.MOVE_NODE &&
          semanticDelta.fromParentId !== semanticDelta.toParentId
          ? semanticDelta.fromParentId
          : null;
    if (!ownerId) return null;
    const layoutModel = findComponentLayoutModel(beforeDocument, ownerId);
    const runtimeOwnerId = bridgeCommand.kind === ComponentBridgeCommandKind.MOVE_NODE
      ? bridgeCommand.previousParentId
      : bridgeCommand.kind === ComponentBridgeCommandKind.REMOVE_NODE
        ? bridgeCommand.parentId
        : context.resolveMorph?.(bridgeCommand.nodeId)?.owner?.id;
    const runtimeOwner = context.resolveMorph?.(runtimeOwnerId);
    if (!runtimeOwner?.layout || typeof runtimeOwner.layout.copy !== 'function') return null;

    if (bridgeCommand.kind === ComponentBridgeCommandKind.RENAME_NODE) {
      const before = runtimeOwner.layout;
      const after = before.copy();
      if (typeof after.handleRenamingOf !== 'function') return null;
      after.handleRenamingOf(semanticDelta.before, semanticDelta.after);
      return Object.freeze({
        ownerId: runtimeOwner.id,
        before,
        after,
        applyWhenAdopting: true
      });
    }

    if (!layoutModel) return null;

    const policy = this.componentDescriptor?.stylePolicy;
    if (typeof policy?.getSubSpecFor !== 'function') return null;
    const sourceLayout = policy.getSubSpecFor(
      runtimeOwner === this.trackedComponent ? null : runtimeOwner
    )?.layout;
    if (!sourceLayout || typeof sourceLayout.copy !== 'function') return null;
    return Object.freeze({
      ownerId: runtimeOwner.id,
      before: sourceLayout.copy(),
      after: runtimeOwner.layout,
      applyWhenAdopting: false
    });
  }

  runtimeProjectionContext (context) {
    const childrenOf = owner => owner?.submorphs || owner?.children || [];
    const attachmentOf = morph => morph?.owner
      ? Object.freeze({
          kind: MorphicAttachmentKind.ATTACHED,
          ownerId: morph.owner.id,
          index: childrenOf(morph.owner).indexOf(morph)
        })
      : Object.freeze({ kind: MorphicAttachmentKind.DETACHED });
    return {
      resolveMorph: context.resolveMorph,
      readMorphProperty: (morph, property) => property in morph
        ? morph[property]
        : typeof morph.getProperty === 'function'
          ? morph.getProperty(property)
          : morph._morphicState?.[property],
      setMorphProperty: (morph, property, value) => {
        const apply = () => {
          if (property in morph) morph[property] = value;
          else if (typeof morph.setProperty === 'function') morph.setProperty(property, value);
          else morph[property] = value;
        };
        return typeof morph.withMetaDo === 'function'
          ? morph.withMetaDo({
              reconcileChanges: false,
              origin: 'runtime-projection',
              undoable: false
            }, apply)
          : apply();
      },
      validateMoveMorph: (morph, from) => {
        const current = attachmentOf(morph);
        if (current.kind !== from.kind ||
            current.ownerId !== from.ownerId || current.index !== from.index) {
          throw new Error(`Precondition failed for structural morph ${morph.id}`);
        }
      },
      moveMorph: (morph, from, to) => {
        const destination = to.kind === MorphicAttachmentKind.ATTACHED
          ? context.resolveMorph?.(to.ownerId)
          : null;
        const apply = () => {
          if (from.kind === MorphicAttachmentKind.ATTACHED) {
            if (typeof morph.remove === 'function') morph.remove();
            else {
              const owner = context.resolveMorph?.(from.ownerId);
              const children = childrenOf(owner);
              children.splice(children.indexOf(morph), 1);
              morph.owner = null;
            }
          }
          if (to.kind === MorphicAttachmentKind.ATTACHED) {
            if (typeof destination?.addMorphAt === 'function') {
              destination.addMorphAt(morph, to.index);
            } else {
              childrenOf(destination).splice(to.index, 0, morph);
              morph.owner = destination;
            }
          }
        };
        const metadataTarget = morph.owner || destination || morph;
        return typeof metadataTarget.withMetaDo === 'function'
          ? metadataTarget.withMetaDo({
              reconcileChanges: false,
              origin: 'runtime-projection',
              undoable: false
            }, apply)
          : apply();
      }
    };
  }

  projectionalTransactionAdapters (transaction, runtimeContext) {
    return {
      sourceStore: {
        read: () => this.currentModuleSource,
        write: source => {
          this.componentModule.setSource(source);
          this._projectionalSource = source;
        }
      },
      documentStore: {
        read: () => this._projectionalDocument || transaction.beforeDocument,
        write: nextDocument => { this._projectionalDocument = nextDocument; }
      },
      runtimeContext
    };
  }

  projectionalDocumentForCurrentSource () {
    if (this._projectionalSource === this.currentModuleSource &&
        this._projectionalDocument) {
      return Object.freeze({
        supported: true,
        document: this._projectionalDocument,
        diagnostics: Object.freeze([])
      });
    }
    return parseComponentSource({
      source: this.currentModuleSource,
      moduleId: this.componentModuleId,
      exportName: this.componentDescriptor.componentName,
      componentId: this.committedChangeAdapter.componentId
    });
  }

  resolveProjectionalCommandTarget (target) {
    if (!this.canRecordProjectionalEdit()) {
      return unsupportedProjectionalCommand(
        ProjectionalCommandDiagnosticKind.UNDO_UNAVAILABLE,
        'The component command cannot safely join the current undo transaction'
      );
    }

    const parsed = this.projectionalDocumentForCurrentSource();
    if (!parsed.supported) {
      return unsupportedProjectionalCommand(
        ProjectionalCommandDiagnosticKind.SOURCE_UNSUPPORTED,
        'The current component source cannot be represented projectionally',
        { sourceDiagnostics: parsed.diagnostics }
      );
    }
    const document = parsed.document;
    const nodeId = this.componentNodeIdForMorph(document, target, {
      kind: ComponentBridgeCommandKind.SET_PROPERTY
    });
    if (!nodeId || typeof target.id !== 'string' || !target.id) {
      return unsupportedProjectionalCommand(
        ProjectionalCommandDiagnosticKind.TARGET_UNRESOLVED,
        'The runtime morph cannot be resolved in the component document'
      );
    }
    return Object.freeze({ document, nodeId });
  }

  commitProjectionalScalarCommand ({
    document,
    command,
    target,
    nodeId,
    runtimeValueAfter,
    label
  }) {
    const runtimeContext = this.runtimeProjectionContext({
      resolveMorph: runtimeId => runtimeId === target.id ? target : null
    });
    const runtimeValueBefore = runtimeContext.readMorphProperty(
      target,
      command.property
    );
    const commandSequence = this._projectionalCommandCounter || 0;
    this._projectionalCommandCounter = commandSequence + 1;
    const planned = prepareScalarComponentTransaction({
      id: `component-command-${document.componentId}-${commandSequence}`,
      source: this.currentModuleSource,
      document,
      command,
      resolveRuntimeTargetId: semanticNodeId => semanticNodeId === nodeId
        ? target.id
        : null,
      resolveRuntimeValue: ({ phase }) => Object.freeze({
        available: true,
        value: phase === 'before' ? runtimeValueBefore : runtimeValueAfter
      })
    });
    if (!planned.supported) {
      return unsupportedProjectionalCommand(
        ProjectionalCommandDiagnosticKind.PLANNING_FAILED,
        `The ${command.kind} command could not be planned atomically`,
        { planningDiagnostics: planned.diagnostics }
      );
    }

    const transaction = planned.transaction;
    const adapters = this.projectionalTransactionAdapters(transaction, runtimeContext);
    const committed = commitPreparedComponentTransaction(transaction, adapters);
    const editTransaction = new ProjectionalComponentEditTransaction(
      transaction,
      adapters,
      {
        label,
        afterReplay: () => this.refreshAndTrackProjectionalDependants()
      }
    );
    this.recordProjectionalEditTransaction(editTransaction);
    this.refreshAndTrackProjectionalDependants();
    return Object.freeze({
      committed: true,
      diagnostics: Object.freeze([]),
      ...committed,
      editTransaction
    });
  }

  /**
   * Removes a local property override as an explicit component command.
   * The caller supplies the already-resolved inherited/default runtime value;
   * no runtime mutation should be performed before this method succeeds.
   * A non-committed result leaves source, document, runtime, and history intact.
   */
  clearPropertyOverride (options = {}) {
    const { target, property, effectiveValue } = options;
    if (!target || typeof property !== 'string' || !property ||
        !Object.prototype.hasOwnProperty.call(options, 'effectiveValue')) {
      throw new Error('Clearing a component property override requires a target, property, and effective value');
    }
    const resolution = this.resolveProjectionalCommandTarget(target);
    if (resolution.committed === false) return resolution;
    const { document, nodeId } = resolution;

    const command = ClearPropertyOverride({
      componentId: document.componentId,
      expectedRevision: document.revision,
      nodeId,
      property
    });
    return this.commitProjectionalScalarCommand({
      document,
      command,
      target,
      nodeId,
      runtimeValueAfter: effectiveValue,
      label: `clear component ${property} override`
    });
  }

  /**
   * Sets a property through an explicit or serializer-backed opaque component
   * command before mutating runtime. Unrepresentable values return a
   * non-committed result without mutating runtime.
   */
  setProperty (options = {}) {
    const { target, property, value } = options;
    if (!target || typeof property !== 'string' || !property ||
        !Object.prototype.hasOwnProperty.call(options, 'value')) {
      throw new Error('Setting a component property requires a target, property, and value');
    }
    const resolution = this.resolveProjectionalCommandTarget(target);
    if (resolution.committed === false) return resolution;
    const { document, nodeId } = resolution;
    const commandSpec = {
      componentId: document.componentId,
      expectedRevision: document.revision,
      nodeId,
      property
    };
    let command;
    try {
      command = isProjectionalExplicitValue(value)
        ? SetProperty({ ...commandSpec, value })
        : (() => {
            const expression = getValueExpr(property, value);
            return SetOpaqueProperty({
              ...commandSpec,
              expression: expression?.__expr__,
              requiredBindings: componentImportBindingsFromExpression(expression?.bindings || {})
            });
          })();
    } catch (error) {
      return unsupportedProjectionalCommand(
        ProjectionalCommandDiagnosticKind.PLANNING_FAILED,
        `The ${property} value could not be serialized for a component command`,
        { cause: error }
      );
    }
    return this.commitProjectionalScalarCommand({
      document,
      command,
      target,
      nodeId,
      runtimeValueAfter: value,
      label: `set component ${property}`
    });
  }

  commitProjectionalBatch (batch, context) {
    const ownedLegacyChanges = this.projectionallyOwnedLegacyChanges(batch, context);
    const isMultiScalarBatch = batch.commands.length > 1 &&
      batch.commands.every(command =>
        command.kind === ComponentBridgeCommandKind.SET_PROPERTY &&
        command.property !== 'layout') &&
      !batch.shadowProjection?.beforeDocument?.parentComponent &&
      !(this.componentDescriptor?.stylePolicy?._dependants?.size > 0) &&
      !batch.derivedPropagation &&
      !batch.policyCacheProjection;
    if (batch.diagnostics.length ||
        (!isMultiScalarBatch && (batch.commands.length !== 1 || ![
          ComponentBridgeCommandKind.SET_PROPERTY,
          ComponentBridgeCommandKind.SET_MASTER,
          ComponentBridgeCommandKind.EDIT_TEXT,
          ComponentBridgeCommandKind.RENAME_NODE,
          ComponentBridgeCommandKind.INTRODUCE_NODE,
          ComponentBridgeCommandKind.REMOVE_NODE,
          ComponentBridgeCommandKind.MOVE_NODE
        ].includes(batch.commands[0].kind))) ||
        context.legacyChanges?.length !== batch.commands.length ||
        !this.canRecordProjectionalEdit(ownedLegacyChanges) ||
        !batch.shadowProjection?.supported) return null;

    const transaction = preparedComponentTransactionFromShadowProjection({
      id: `${batch.changeSetId}:component`,
      shadowProjection: batch.shadowProjection
    });
    const adapters = this.projectionalTransactionAdapters(
      transaction,
      this.runtimeProjectionContext(context)
    );
    const textRefresh = batch.commands[0].kind === ComponentBridgeCommandKind.EDIT_TEXT
      ? Object.freeze({
          document: batch.shadowProjection.beforeDocument,
          nodeId: batch.shadowProjection.steps[0].componentCommand.nodeId
        })
      : null;
    const policyCachePlanCount = batch.policyCacheProjection?.renames?.length ||
      batch.policyCacheProjection?.changes?.length || 0;
    const componentEdit = new ProjectionalComponentEditTransaction(
      transaction,
      adapters,
      policyCachePlanCount
        ? {}
        : { afterReplay: () => this.refreshAndTrackProjectionalDependants() }
    );
    let policyCacheTransaction = null;
    let policyCacheStores = null;
    if (policyCachePlanCount) {
      policyCacheTransaction = batch.policyCacheProjection.kind ===
        ProjectionalPolicyCacheProjectionKind.RENAME
        ? new PreparedPolicyCacheRenameTransaction({
            id: `${batch.changeSetId}:policy-cache`,
            renames: batch.policyCacheProjection.renames
          })
        : new PreparedPolicyCachePropertyTransaction({
            id: `${batch.changeSetId}:policy-cache`,
            changes: batch.policyCacheProjection.changes
          });
      policyCacheStores = batch.policyCacheProjection.stores;
      if (policyCacheTransaction instanceof PreparedPolicyCacheRenameTransaction) {
        validatePreparedPolicyCacheRenames(
          policyCacheTransaction,
          policyCacheStores,
          PolicyCacheTransactionDirection.FORWARD
        );
      } else {
        validatePreparedPolicyCacheProperties(
          policyCacheTransaction,
          policyCacheStores,
          PolicyCacheTransactionDirection.FORWARD
        );
      }
    }
    const applyPolicyCache = direction => policyCacheTransaction instanceof
      PreparedPolicyCacheRenameTransaction
      ? applyPreparedPolicyCacheRenames(policyCacheTransaction, {
          stores: policyCacheStores,
          direction
        })
      : applyPreparedPolicyCacheProperties(policyCacheTransaction, {
          stores: policyCacheStores,
          direction
        });
    let derivedTransaction = null;
    let derivedStores = null;
    let derivedRuntimeTransaction = null;
    let derivedRuntimeStores = null;
    let derivedRuntimeChangeTransaction = null;
    let derivedRuntimeChangeContext = null;
    if (batch.derivedPropagation?.supported) {
      derivedTransaction = new PreparedDerivedPropagationTransaction({
        id: `${batch.changeSetId}:derived`,
        modules: batch.derivedPropagation.modules
      });
      derivedStores = new Map(derivedTransaction.modules.map(plan => {
        const derivedModule = this.projectionalModuleForId(plan.moduleId);
        const isBaseModule = derivedModule.id === this.componentModule.id;
        return [plan.moduleId, {
          read: () => {
            const source = derivedModule._source;
            // Before the base transaction commits, expose its already-validated
            // intermediate source to the derived preflight. Composite replay
            // always installs that intermediate source before this store writes.
            return isBaseModule && source === transaction.sourceBefore
              ? transaction.sourceAfter
              : source;
          },
          write: source => derivedModule.setSource(source)
        }];
      }));
      validatePreparedDerivedPropagation(
        derivedTransaction,
        derivedStores,
        DerivedTransactionDirection.FORWARD
      );
      derivedRuntimeTransaction = new PreparedDerivedRuntimeRenameTransaction({
        id: `${batch.changeSetId}:derived-runtime`,
        renames: batch.derivedPropagation.runtimeRenames || []
      });
      derivedRuntimeStores = new Map(derivedRuntimeTransaction.renames.map(rename => {
        const target = batch.derivedPropagation.runtimeRenames
          .find(candidate => candidate.id === rename.id).target;
        return [rename.id, {
          read: () => target.name,
          write: name => {
            const apply = () => { target.name = name; };
            return typeof target.withMetaDo === 'function'
              ? target.withMetaDo({
                  reconcileChanges: false,
                  origin: 'runtime-projection',
                  undoable: false
                }, apply)
              : apply();
          }
        }];
      }));
      validatePreparedDerivedRuntimeRenames(
        derivedRuntimeTransaction,
        derivedRuntimeStores,
        DerivedTransactionDirection.FORWARD
      );
      const structuralProjection = batch.derivedPropagation.runtimeStructuralProjection;
      if (structuralProjection) {
        derivedRuntimeChangeTransaction = new PreparedDerivedRuntimeChangeTransaction({
          id: `${batch.changeSetId}:derived-runtime-change`,
          changeSet: structuralProjection.changeSet,
          inverseChangeSet: structuralProjection.inverseChangeSet
        });
        derivedRuntimeChangeContext = structuralProjection.runtimeContext;
        validatePreparedDerivedRuntimeChanges(
          derivedRuntimeChangeTransaction,
          derivedRuntimeChangeContext,
          DerivedTransactionDirection.FORWARD
        );
      }
    }
    const committed = commitPreparedComponentTransaction(transaction, {
      ...adapters,
      runtimeCommitMode: ComponentRuntimeCommitMode.ADOPT_ALREADY_APPLIED
    });
    let derivedSourcesCommitted = false;
    let derivedRuntimeCommitted = false;
    let derivedRuntimeChangeCommitted = false;
    let policyCacheCommitted = false;
    try {
      if (derivedTransaction?.modules.length) {
        applyPreparedDerivedPropagation(derivedTransaction, { stores: derivedStores });
        derivedSourcesCommitted = true;
      }
      if (derivedRuntimeTransaction?.renames.length) {
        applyPreparedDerivedRuntimeRenames(derivedRuntimeTransaction, {
          stores: derivedRuntimeStores
        });
        derivedRuntimeCommitted = true;
      }
      if (derivedRuntimeChangeTransaction) {
        applyPreparedDerivedRuntimeChanges(derivedRuntimeChangeTransaction, {
          runtimeContext: derivedRuntimeChangeContext
        });
        derivedRuntimeChangeCommitted = true;
      }
      if (policyCacheTransaction) {
        applyPolicyCache(PolicyCacheTransactionDirection.FORWARD);
        policyCacheCommitted = true;
      }
    } catch (error) {
      const rollbackErrors = error.rollbackErrors?.slice() || [];
      if (policyCacheCommitted) {
        try {
          applyPolicyCache(PolicyCacheTransactionDirection.REVERSE);
        } catch (rollbackError) {
          rollbackErrors.push(rollbackError);
        }
      }
      if (derivedRuntimeChangeCommitted) {
        try {
          applyPreparedDerivedRuntimeChanges(derivedRuntimeChangeTransaction, {
            runtimeContext: derivedRuntimeChangeContext,
            direction: DerivedTransactionDirection.REVERSE
          });
        } catch (rollbackError) {
          rollbackErrors.push(rollbackError);
        }
      }
      if (derivedRuntimeCommitted) {
        try {
          applyPreparedDerivedRuntimeRenames(derivedRuntimeTransaction, {
            stores: derivedRuntimeStores,
            direction: DerivedTransactionDirection.REVERSE
          });
        } catch (rollbackError) {
          rollbackErrors.push(rollbackError);
        }
      }
      if (derivedSourcesCommitted) {
        try {
          applyPreparedDerivedPropagation(derivedTransaction, {
            stores: derivedStores,
            direction: DerivedTransactionDirection.REVERSE
          });
        } catch (rollbackError) {
          rollbackErrors.push(rollbackError);
        }
      }
      try {
        applyPreparedComponentTransaction(transaction, {
          ...adapters,
          runtimeCommitMode: ComponentRuntimeCommitMode.APPLY,
          direction: ComponentTransactionDirection.REVERSE
        });
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
      if (rollbackErrors.length) error.rollbackErrors = rollbackErrors;
      throw error;
    }
    const derivedEdit = derivedTransaction?.modules.length
      ? new ProjectionalDerivedEditTransaction(derivedTransaction, derivedStores)
      : null;
    const derivedRuntimeEdit = derivedRuntimeTransaction?.renames.length
      ? new ProjectionalDerivedRuntimeEditTransaction(
          derivedRuntimeTransaction,
          derivedRuntimeStores
        )
      : null;
    const derivedRuntimeChangeEdit = derivedRuntimeChangeTransaction
      ? new ProjectionalDerivedRuntimeChangeEditTransaction(
          derivedRuntimeChangeTransaction,
          derivedRuntimeChangeContext
        )
      : null;
    const policyCacheEdit = policyCacheTransaction
      ? policyCacheTransaction instanceof PreparedPolicyCacheRenameTransaction
        ? new ProjectionalPolicyCacheEditTransaction(
            policyCacheTransaction,
            policyCacheStores,
            { afterReplay: () => this.refreshAndTrackProjectionalDependants(textRefresh) }
          )
        : new ProjectionalPolicyCachePropertyEditTransaction(
            policyCacheTransaction,
            policyCacheStores,
            { afterReplay: () => this.refreshAndTrackProjectionalDependants(textRefresh) }
          )
      : null;
    const derivedEdits = [
      derivedEdit,
      derivedRuntimeEdit,
      derivedRuntimeChangeEdit,
      policyCacheEdit
    ].filter(Boolean);
    const editTransaction = derivedEdits.length
      ? new CompositeEditTransaction([componentEdit, ...derivedEdits], {
          label: 'component edit with derived propagation',
          metadata: { componentTransactionId: transaction.id }
        })
      : componentEdit;
    this.recordProjectionalEditTransaction(editTransaction, ownedLegacyChanges);
    this._projectionallyConsumedChanges ||= new WeakSet();
    ownedLegacyChanges.forEach(change => this._projectionallyConsumedChanges.add(change));
    this.refreshAndTrackProjectionalDependants(textRefresh);
    return Object.freeze({
      ...committed,
      derivedPropagation: batch.derivedPropagation || null,
      derivedTransaction,
      derivedRuntimeTransaction,
      derivedRuntimeChangeTransaction,
      policyCacheTransaction,
      editTransaction
    });
  }

  prepareProjectionalPolicyCacheProjection (batch, context) {
    return this.prepareProjectionalPolicyCacheRename(batch) ||
      this.prepareProjectionalPolicyCacheProperty(batch, context);
  }

  prepareProjectionalPolicyCacheProperty (batch, context) {
    const command = batch.commands[0];
    if (batch.commands.length !== 1 ||
        ![
          ComponentBridgeCommandKind.SET_PROPERTY,
          ComponentBridgeCommandKind.EDIT_TEXT,
          ComponentBridgeCommandKind.SET_MASTER
        ].includes(command?.kind) ||
        !batch.shadowProjection?.supported) return null;
    const policy = this.componentDescriptor?.stylePolicy;
    if (!policy?.spec) {
      return Object.freeze({
        kind: ProjectionalPolicyCacheProjectionKind.PROPERTY,
        supported: true,
        changes: Object.freeze([]),
        stores: new Map(),
        diagnostics: Object.freeze([])
      });
    }
    const componentCommand = batch.shadowProjection.steps[0].componentCommand;
    const property = command.kind === ComponentBridgeCommandKind.EDIT_TEXT
      ? 'textAndAttributes'
      : command.kind === ComponentBridgeCommandKind.SET_MASTER
        ? 'master'
        : command.property;
    const afterValue = command.kind === ComponentBridgeCommandKind.EDIT_TEXT
      ? projectionalPolicyTextAndAttributes(
          context.resolveMorph?.(command.nodeId)?.textAndAttributes || command.value
        )
      : command.value;
    const path = componentNodeNamePath(
      batch.shadowProjection.beforeDocument,
      componentCommand.nodeId
    );
    if (!path) {
      return Object.freeze({
        kind: ProjectionalPolicyCacheProjectionKind.PROPERTY,
        supported: true,
        changes: Object.freeze([]),
        stores: new Map(),
        diagnostics: Object.freeze([])
      });
    }
    let current = policy.spec;
    let missingIndex = -1;
    for (let index = 0; index < path.length; index++) {
      const properties = policySpecProperties(current);
      const next = (properties?.submorphs || []).find(spec =>
        policySpecProperties(spec)?.name === path[index]
      );
      if (!next) {
        missingIndex = index;
        break;
      }
      current = next;
    }
    if (missingIndex >= 0) {
      const ownerProperties = policySpecProperties(current);
      if (!ownerProperties) return null;
      let addition = { name: path[path.length - 1], [property]: afterValue };
      for (let index = path.length - 2; index >= missingIndex; index--) {
        addition = { name: path[index], submorphs: [addition] };
      }
      const beforeValue = ownerProperties.submorphs;
      const afterSubmorphs = [...(beforeValue || []), addition];
      const id = `${this.componentModuleId}#${this.componentDescriptor.componentName}:${componentCommand.nodeId}:${property}:recover`;
      return Object.freeze({
        kind: ProjectionalPolicyCacheProjectionKind.PROPERTY,
        supported: true,
        changes: Object.freeze([Object.freeze({
          id,
          property: 'submorphs',
          beforeValue,
          afterValue: afterSubmorphs
        })]),
        stores: new Map([[id, {
          read: () => ownerProperties.submorphs,
          write: value => {
            if (value === undefined) delete ownerProperties.submorphs;
            else ownerProperties.submorphs = value;
          }
        }]]),
        diagnostics: Object.freeze([])
      });
    }
    const subSpec = policySpecProperties(current);
    if (!subSpec) return null;
    const id = `${this.componentModuleId}#${this.componentDescriptor.componentName}:${componentCommand.nodeId}:${property}`;
    return Object.freeze({
      kind: ProjectionalPolicyCacheProjectionKind.PROPERTY,
      supported: true,
      changes: Object.freeze([Object.freeze({
        id,
        property,
        beforeValue: Object.prototype.hasOwnProperty.call(subSpec, property)
          ? subSpec[property]
          : undefined,
        afterValue
      })]),
      stores: new Map([[id, {
        read: () => subSpec[property],
        write: value => {
          if (value === undefined) delete subSpec[property];
          else subSpec[property] = value;
        }
      }]]),
      diagnostics: Object.freeze([])
    });
  }

  prepareProjectionalPolicyCacheRename (batch) {
    const command = batch.commands[0];
    if (batch.commands.length !== 1 ||
        command?.kind !== ComponentBridgeCommandKind.RENAME_NODE ||
        !batch.shadowProjection?.supported) return null;

    const entries = [{
      id: `${this.componentModuleId}#${this.componentDescriptor.componentName}`,
      descriptor: this.componentDescriptor,
      document: batch.shadowProjection.beforeDocument,
      required: true
    }];
    for (const component of batch.derivedPropagation?.components || []) {
      entries.push({
        id: `${component.moduleId}#${component.exportName}`,
        descriptor: component.dependant,
        document: component.projection.beforeDocument,
        required: component.projection.sourceBefore !== component.projection.sourceAfter
      });
    }

    const renames = [];
    const recoveries = [];
    const stores = new Map();
    const semanticNodeId = batch.shadowProjection.steps[0].componentCommand.nodeId;
    for (const { id, descriptor, document, required } of entries) {
      const policy = descriptor?.stylePolicy;
      // Some bridge integrations deliberately use a lightweight descriptor
      // without a materialized policy cache. In that case there is no fourth
      // transaction domain to synchronize.
      if (!policy?.spec) continue;
      const path = componentNodeNamePath(document, semanticNodeId);
      if (!path) continue;
      let current = policy.spec;
      let missingIndex = -1;
      for (let index = 0; index < path.length; index++) {
        const properties = policySpecProperties(current);
        const next = (properties?.submorphs || []).find(spec =>
          policySpecProperties(spec)?.name === path[index]
        );
        if (!next) {
          missingIndex = index;
          break;
        }
        current = next;
      }
      if (missingIndex >= 0) {
        // A derived component with no local source reference inherits the
        // already-updated parent policy and has no local cache entry to mutate.
        if (!required) continue;
        const ownerProperties = policySpecProperties(current);
        if (!ownerProperties) continue;
        let addition = { name: command.name };
        for (let index = path.length - 2; index >= missingIndex; index--) {
          addition = { name: path[index], submorphs: [addition] };
        }
        const beforeValue = ownerProperties.submorphs;
        const afterValue = [...(beforeValue || []), addition];
        const recoveryId = `${id}:recover:${path.slice(0, missingIndex).join('/')}`;
        recoveries.push(Object.freeze({
          id: recoveryId,
          property: 'submorphs',
          beforeValue,
          afterValue
        }));
        stores.set(recoveryId, {
          read: () => ownerProperties.submorphs,
          write: value => {
            if (value === undefined) delete ownerProperties.submorphs;
            else ownerProperties.submorphs = value;
          }
        });
        continue;
      }
      const subSpec = policySpecProperties(current);
      if (!subSpec) continue;
      if (subSpec.name !== command.previousName) {
        const recoveryId = `${id}:recover:name`;
        recoveries.push(Object.freeze({
          id: recoveryId,
          property: 'name',
          beforeValue: subSpec.name,
          afterValue: command.name
        }));
        stores.set(recoveryId, {
          read: () => subSpec.name,
          write: name => { subSpec.name = name; }
        });
        continue;
      }
      renames.push(Object.freeze({
        id,
        beforeName: command.previousName,
        afterName: command.name
      }));
      stores.set(id, {
        read: () => subSpec.name,
        write: name => { subSpec.name = name; }
      });
    }
    if (recoveries.length) {
      for (const rename of renames) {
        const renameStore = stores.get(rename.id);
        recoveries.push(Object.freeze({
          id: rename.id,
          property: 'name',
          beforeValue: rename.beforeName,
          afterValue: rename.afterName
        }));
        stores.set(rename.id, renameStore);
      }
      return Object.freeze({
        kind: ProjectionalPolicyCacheProjectionKind.PROPERTY,
        supported: true,
        changes: Object.freeze(recoveries),
        stores,
        diagnostics: Object.freeze([])
      });
    }
    return Object.freeze({
      kind: ProjectionalPolicyCacheProjectionKind.RENAME,
      supported: true,
      renames: Object.freeze(renames),
      stores,
      diagnostics: Object.freeze([])
    });
  }

  projectionalRenameDiagnostic (batch, context) {
    const command = batch.commands[0];
    if (batch.commands.length !== 1 ||
        command?.kind !== ComponentBridgeCommandKind.RENAME_NODE ||
        !batch.shadowProjection?.supported) return null;
    const target = context.resolveMorph?.(command.nodeId);
    const hasRuntimeLayoutProjection = batch.shadowProjection.steps?.[0]
      ?.runtimeProjection.changeSet.operations.some(operation =>
        operation.property === 'layout');
    const beforeDocument = batch.shadowProjection.beforeDocument;
    const semanticNodeId = batch.shadowProjection.steps?.[0]
      ?.componentCommand.nodeId;
    let ownerLayoutRequiresProjection = true;
    if (beforeDocument instanceof ComponentDocument && semanticNodeId) {
      const owner = findComponentParent(beforeDocument, semanticNodeId);
      const layoutModel = owner && findComponentLayoutModel(beforeDocument, owner.id);
      ownerLayoutRequiresProjection = !layoutModel || layoutModel.references.some(reference =>
        reference.targetId === semanticNodeId);
    }
    let kind = null;
    if (target?.owner?.layout && ownerLayoutRequiresProjection &&
        !hasRuntimeLayoutProjection) {
      kind = ProjectionalRenameDiagnosticKind.OWNER_LAYOUT;
    }
    return kind
      ? Object.freeze({
          kind,
          message: `Projectional rename cannot safely update the owner layout: ${kind}`
        })
      : null;
  }

  canRecordProjectionalEdit (legacyChanges = null) {
    const undoManager = this.trackedComponent?.env?.undoManager;
    if (!undoManager) return true;
    if (typeof undoManager.addTransaction !== 'function') return false;
    if (!undoManager.undoInProgress) return true;
    if (legacyChanges === null) return true;
    const recorded = undoManager.undoInProgress.recorder?.changes;
    return typeof undoManager.discardRecordedChanges === 'function' &&
      Array.isArray(recorded) &&
      legacyChanges.every(change => recorded.includes(change));
  }

  recordProjectionalEditTransaction (editTransaction, legacyChanges = null) {
    const undoManager = this.trackedComponent?.env?.undoManager;
    if (!undoManager) return editTransaction;
    if (undoManager.undoInProgress) {
      if (legacyChanges !== null) {
        const discarded = undoManager.discardRecordedChanges(legacyChanges);
        if (discarded !== legacyChanges.length) {
          throw new Error('Could not replace every recorded Morphic component change');
        }
      }
      undoManager.addTransaction(editTransaction, { joinActive: true });
    } else {
      undoManager.addTransaction(editTransaction);
    }
    return editTransaction;
  }

  refreshAndTrackProjectionalDependants (textRefresh = null) {
    const result = this.refreshProjectionalDependants(textRefresh);
    if (!result?.then) return result;
    const moduleState = moduleReconciliationStateFor(this);
    let pending;
    pending = Promise.resolve(result).finally(() => {
      if (this._pendingReconciliation === pending) this._pendingReconciliation = null;
      if (moduleState?.pending === pending) moduleState.pending = null;
    });
    pending.catch(() => {});
    this._pendingReconciliation = pending;
    this._finishPromise = pending;
    if (moduleState) {
      moduleState.pending = pending;
      moduleState.completion = pending;
    }
    return pending;
  }

  projectProjectionalTextIntoRuntime (root, textRefresh) {
    const path = componentNodeNamePath(textRefresh.document, textRefresh.nodeId);
    if (!path) return false;
    let target = root;
    for (const name of path) {
      target = (target.submorphs || []).find(candidate => candidate.name === name);
      if (!target) return false;
    }
    if (!target.isText) return false;
    const policy = root.master;
    const synthesized = policy?.synthesizeSubSpec?.(target.name, root, root);
    const expected = synthesized?.textAndAttributes || ['', null];
    if (projectionalTextValueMatches(target.textAndAttributes, expected)) return false;
    const textAndAttributes = materializeProjectionalTextAndAttributes(expected);
    const apply = () => { target.textAndAttributes = textAndAttributes; };
    if (typeof target.withMetaDo === 'function') {
      target.withMetaDo({
        reconcileChanges: false,
        origin: 'runtime-projection',
        undoable: false
      }, apply);
    } else apply();
    return true;
  }

  async refreshProjectionalDependants (textRefresh = null) {
    this.componentDescriptor.makeDirty();
    const refreshedRuntimes = new Set();
    if (textRefresh) {
      for (const dependant of this.componentDescriptor.getDependants()) {
        if (dependant === this.trackedComponent || refreshedRuntimes.has(dependant)) continue;
        this.projectProjectionalTextIntoRuntime(dependant, textRefresh);
        refreshedRuntimes.add(dependant);
      }
    } else this.componentDescriptor.refreshDependants();
    const pending = this.projectionalDerivedDescriptors(this.componentDescriptor);
    const visited = new Set([this.componentDescriptor]);
    while (pending.length) {
      const descriptor = pending.shift();
      if (!descriptor || visited.has(descriptor)) continue;
      visited.add(descriptor);
      const activeComponent = descriptor?._cachedComponent;
      if (activeComponent?.master && !refreshedRuntimes.has(activeComponent)) {
        if (textRefresh) {
          this.projectProjectionalTextIntoRuntime(activeComponent, textRefresh);
          refreshedRuntimes.add(activeComponent);
          pending.push(...this.projectionalDerivedDescriptors(descriptor));
          continue;
        }
        const apply = () => activeComponent.master.applyIfNeeded(true);
        const result = typeof activeComponent.withMetaDo === 'function'
          ? activeComponent.withMetaDo({
              reconcileChanges: false,
              origin: 'runtime-projection',
              undoable: false
            }, apply)
          : apply();
        await result;
      }
      pending.push(...this.projectionalDerivedDescriptors(descriptor));
    }
    return true;
  }

  scheduleShadowProjectionComparison (batch) {
    if (!batch.shadowProjection?.supported) return null;
    const comparisonPromise = Promise.resolve()
      .then(() => this.onceChangesProcessed())
      .then(() => compareShadowProjectionToCurrentSource(
        batch.shadowProjection,
        this.currentModuleSource
      ))
      .then(comparison => this.recordShadowProjectionComparison(batch, comparison))
      .catch(error => this.recordShadowProjectionComparison(batch, Object.freeze({
        kind: ShadowProjectionComparisonKind.PROJECTION_COMPARISON_FAILED,
        matches: false,
        diagnostics: Object.freeze([Object.freeze({
          message: error.message,
          error
        })])
      })));
    this._shadowComparisonPromise = comparisonPromise;
    return comparisonPromise;
  }

  recordShadowProjectionComparison (batch, comparison) {
    const record = Object.freeze({
      changeSetId: batch.changeSetId,
      origin: batch.origin,
      ...comparison
    });
    this.shadowProjectionComparisons = (this.shadowProjectionComparisons || [])
      .concat(record)
      .slice(-100);
    this.lastShadowProjectionComparison = record;
    this.onShadowProjectionComparison?.(record);
    return record;
  }

  dispose () {
    this.trackedComponent?.env.changeManager.removeCommittedChangeListener(
      this._committedChangeListener
    );
    if (this.trackedComponent?._changeTracker === this) {
      delete this.trackedComponent._changeTracker;
    }
  }

  /**
   * Returns the policy that is wrapped by the component descriptor.
   * @type { StylePolicy }
   */
  get componentPolicy () { return this.componentDescriptor.stylePolicy; }

  /**
   * The current source of the module object that manages
   * the source code this component is defined in.
   * @type { string }
   */
  get currentModuleSource () {
    return this.componentModule._source;
  }

  /**
   * Returns a promise that once resolves denotes that the
   * tracker is ready to reconcile changes with the module.
   * @returns { Promise<boolean> }
   */
  async whenReady () {
    await this.componentModule.source();
    return true;
  }

  /** .
   * When processing changes have to wait for the module system, since the writing of files
   * to the file system is asynchronous.
   * This method returns a promise that will resolve once all the changes that are being
   * processed by the tracker have been effective.
   * @returns { Promise<boolean> }
   */
  onceChangesProcessed () {
    return moduleReconciliationStateFor(this)?.completion ||
      this._finishPromise || Promise.resolve(true);
  }

  /**
   * Compares two trackers in order to check if they are equivalent.
   * @param { ComponentChangeTracker } otherTracker
   * @param { string } componentName - Name of the component to track.
   * @returns { boolean }
   */
  equals (otherTracker, componentName) {
    return this.componentModuleId === otherTracker.componentModuleId &&
           otherTracker.trackedComponent.name === componentName;
  }

  /**
   * Checks if a given morph's position is dictacted
   * by a layout. In those cases reconciling position
   * changes can be skipped.
   * @param { Morph } aMorph - The morph to check for.
   * @returns { boolean }
   */
  isPositionedByLayout (aMorph) {
    const l = aMorph.isLayoutable && aMorph.owner && aMorph.owner.layout;
    if (l?.name?.call() === 'Constraint') return false;
    if (aMorph.owner?.textAndAttributes?.includes(aMorph)) return true;
    return l && l.layoutableSubmorphs.includes(aMorph);
  }

  /**
   * Filter function that allows us to check if we need
   * to reconcile a particular change or not.
   * ChangeTrackers work on a whitelisting policy. That is, for a
   * change to even be considered, it needs have set the meta property
   * `reconcileChanges` to `true`.
   * @param { object } change - The change object to check
   * @returns { boolean }
   */
  ignoreChange (change) {
    if (this._projectionallyConsumedChanges?.has(change)) {
      return true;
    }
    if (!change.meta?.reconcileChanges) return true;
    if (change.prop === 'name') return false;
    if (change.prop?.startsWith('_')) return true;
    if (change.prop === 'position' && (change.target === this.trackedComponent || this.isPositionedByLayout(change.target))) return true;
    if (change.target?.isText && change.prop === 'extent' &&
        (change.meta?.isLayoutAction || change.meta?.metaInteraction)) return true;
    if (change.prop &&
        change.prop !== 'textAndAttributes' &&
        change.prop !== 'vertices' &&
        change.prop !== 'master' &&
        !change.target.styleProperties.includes(change.prop)) return true;
    if (change.target.epiMorph) return true;
    if (['addMorphAt', 'removeMorph'].includes(change.selector) &&
        change.args.some(m => m.epiMorph)) return true;
    if (!['addMorphAt', 'removeMorph'].includes(change.selector) && change.meta && change.meta.isLayoutAction) return true;
    if (change.selector === 'addMorphAt' && change.target.textAndAttributes?.includes(change.args[0])) return true;
    if (!change.selector &&
        change.prop !== 'layout' &&
        change.prop !== 'vertices' &&
        obj.equals(change.prevValue, change.value)) return true;
    return false;
  }

  /**
   * Given a change, returns wether or not we can delay the reconciliation
   * of that change to a later time. This can be beneficial, since we
   * sometimes want to avoid degrading performance when properties that
   * are expensive to reconcile are changed in quick succession.
   * @param { object } change - The change to check.
   * @returns { boolean }
   */
  // FIXME: should be investigated again when we look at performance optimizations!
  adjournChange (change) {
    const isReplaceChange = change.selector === 'replace';
    if (!isReplaceChange) return false;
    const insertsMorph = change.args[1].find(m => m?.isMorph);
    const removesMorph = change.undo.args[1].find(m => m?.isMorph);
    return !insertsMorph && !removesMorph;
  }

  /**
   * Called in response to changes in the component morph in order to reconcile
   * these changes in the source code as well as the currently initialized policy object.
   * @param { object } change - The change to reconcile.
   */
  processChangeInComponent (change) {
    if (this.ignoreChange(change)) return Promise.resolve(true);
    const moduleState = moduleReconciliationStateFor(this);
    const unsupported = new ProjectionalReconciliationUnsupportedError(
      change,
      this.lastShadowCommandBatch
    );
    this._finishPromise = Promise.reject(unsupported);
    this._finishPromise.catch(() => {});
    if (moduleState) moduleState.completion = this._finishPromise;
    return this._finishPromise;
  }
}
