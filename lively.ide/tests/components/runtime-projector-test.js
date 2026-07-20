/* global describe, it */
import { expect } from 'mocha-es6';
import {
  ComponentDocument,
  ComponentNode,
  explicitProperty,
  inheritedNodeProvenance,
  localNodeProvenance,
  opaqueProperty
} from '../../components/reconciliation/component-document.js';
import {
  ClearPropertyOverride,
  ComponentTextEditKind,
  EditText,
  IntroduceNode,
  MoveNode,
  RemoveNode,
  RenameNode,
  RestoreInheritedNode,
  SetOpaqueProperty,
  SetMaster,
  SetProperty,
  SuppressInheritedNode
} from '../../components/reconciliation/commands.js';
import { reduceComponent } from '../../components/reconciliation/reducer.js';
import {
  ComponentRuntimeProjectionDiagnosticKind,
  projectComponentRuntime
} from '../../components/reconciliation/runtime-projector.js';
import {
  DerivedRuntimeStructureProjectionKind,
  projectCachedDerivedRuntimeStructure
} from '../../components/reconciliation/derived-runtime-projector.js';

function documentWith (properties = {}) {
  return new ComponentDocument({
    componentId: 'component',
    moduleId: 'local://component.js',
    exportName: 'Component',
    root: new ComponentNode({
      id: 'root',
      name: 'root',
      provenance: localNodeProvenance(),
      properties
    })
  });
}

function reduce (document, commandFactory, spec) {
  return reduceComponent(document, commandFactory({
    componentId: document.componentId,
    expectedRevision: document.revision,
    nodeId: document.root.id,
    ...spec
  }));
}

function project (document, reduction, options = {}) {
  return projectComponentRuntime({
    beforeDocument: document,
    reduction,
    changeSetId: 'runtime-projection',
    resolveRuntimeTargetId: () => 'runtime-root',
    ...options
  });
}

function derivedStructureDocument ({
  moved = false,
  removed = false,
  targetHasOverrides = false
} = {}) {
  const parentNodeProvenance = (hasLocalOverrides = false) => inheritedNodeProvenance({
    suppressed: false,
    hasLocalOverrides
  });
  const target = removed
    ? []
    : [new ComponentNode({
        id: 'target',
        name: 'target',
        provenance: parentNodeProvenance(targetHasOverrides)
      })];
  const existing = new ComponentNode({
    id: 'existing', name: 'existing', provenance: parentNodeProvenance()
  });
  return new ComponentDocument({
    componentId: 'derived',
    moduleId: 'local://derived-projection/derived.cp.js',
    exportName: 'Derived',
    parentComponent: { kind: 'source-expression', expression: 'Parent' },
    root: new ComponentNode({
      id: 'derived-root', name: 'derived', provenance: localNodeProvenance(),
      children: [
        new ComponentNode({
          id: 'left', name: 'left', provenance: parentNodeProvenance(),
          children: moved ? [] : target
        }),
        new ComponentNode({
          id: 'right', name: 'right', provenance: parentNodeProvenance(),
          children: moved ? [existing, ...target] : [existing]
        })
      ]
    })
  });
}

function derivedRuntimeStructure () {
  const root = { id: 'derived-runtime-root', name: 'derived', owner: null };
  const left = { id: 'derived-runtime-left', name: 'left', owner: root };
  const right = { id: 'derived-runtime-right', name: 'right', owner: root };
  const target = { id: 'derived-runtime-target', name: 'target', owner: left };
  const existing = { id: 'derived-runtime-existing', name: 'existing', owner: right };
  root.submorphs = [left, right];
  left.submorphs = [target];
  right.submorphs = [existing];
  return { root, left, right, target };
}

function derivedComponentPlan (beforeDocument, afterDocument, runtime) {
  return {
    dependant: { _cachedComponent: runtime.root },
    moduleId: beforeDocument.moduleId,
    exportName: beforeDocument.exportName,
    projection: { beforeDocument, document: afterDocument }
  };
}

describe('projectional component runtime projector', () => {
  it('prepares exact reversible property change sets without applying them', () => {
    const document = documentWith({ fill: explicitProperty('red') });
    const reduction = reduce(document, SetProperty, { property: 'fill', value: 'green' });
    const projection = project(document, reduction);
    const runtime = { id: 'runtime-root', fill: 'red' };
    const context = {
      resolveMorph: id => id === runtime.id ? runtime : null,
      setMorphProperty: (morph, property, value) => { morph[property] = value; }
    };

    expect(projection.supported).to.be.true;
    expect(projection.changeSet.origin).equals('runtime-projection');
    expect(projection.changeSet.undoable).to.be.false;
    expect(projection.changeSet.operations[0]).containSubset({
      targetId: runtime.id,
      property: 'fill',
      before: 'red',
      after: 'green'
    });
    expect(runtime.fill).equals('red');
    projection.changeSet.apply(context);
    expect(runtime.fill).equals('green');
    projection.inverseChangeSet.apply(context);
    expect(runtime.fill).equals('red');
  });

  it('snapshots resolved runtime values for opaque expressions', () => {
    const beforeValue = { color: 'red' };
    const afterValue = { color: 'green' };
    const document = documentWith({ fill: opaqueProperty('Color.red') });
    const reduction = reduce(document, SetOpaqueProperty, {
      property: 'fill',
      expression: 'Color.green'
    });
    const projection = project(document, reduction, {
      resolveRuntimeValue: ({ phase }) => ({
        available: true,
        value: phase === 'before' ? beforeValue : afterValue
      })
    });

    expect(projection.supported).to.be.true;
    const operation = projection.changeSet.operations[0];
    const inverse = projection.inverseChangeSet.operations[0];
    expect(operation.before).deep.equals(beforeValue);
    expect(operation.after).deep.equals(afterValue);
    expect(operation.before).not.equals(beforeValue);
    expect(operation.after).not.equals(afterValue);
    expect(inverse.before).deep.equals(afterValue);
    expect(inverse.after).deep.equals(beforeValue);

    beforeValue.color = 'mutated-before';
    afterValue.color = 'mutated-after';
    expect(operation.before).deep.equals({ color: 'red' });
    expect(operation.after).deep.equals({ color: 'green' });

    const runtime = { id: 'runtime-root', fill: { color: 'red' } };
    const context = { resolveMorph: id => id === runtime.id ? runtime : null };
    projection.changeSet.apply(context);
    expect(runtime.fill).deep.equals({ color: 'green' });
    expect(runtime.fill).not.equals(operation.after);
  });

  it('projects semantic text replacements as reversible morphic property changes', () => {
    const before = ['before', null];
    const after = ['after', { fontWeight: 'bold' }];
    const document = documentWith({ textAndAttributes: explicitProperty(before) });
    const reduction = reduce(document, EditText, {
      operation: { kind: ComponentTextEditKind.REPLACE_ALL, before, after }
    });
    const projection = project(document, reduction);

    expect(projection.supported).to.be.true;
    expect(projection.changeSet.operations[0]).containSubset({
      property: 'textAndAttributes',
      before,
      after
    });
  });

  it('projects master changes through the same reversible runtime boundary', () => {
    const before = { mode: 'base' };
    const after = { mode: 'hover' };
    const document = documentWith({ master: explicitProperty(before) });
    const reduction = reduce(document, SetMaster, { value: after });
    const projection = project(document, reduction);

    expect(projection.supported).to.be.true;
    expect(projection.changeSet.operations[0]).containSubset({
      property: 'master',
      before,
      after
    });
  });

  it('requires an effective runtime value when clearing an override', () => {
    const document = documentWith({ opacity: explicitProperty(0.5) });
    const reduction = reduce(document, ClearPropertyOverride, { property: 'opacity' });
    const unsupported = project(document, reduction);
    const supported = project(document, reduction, {
      resolveRuntimeValue: ({ phase }) => ({
        available: true,
        value: phase === 'before' ? 0.5 : 1
      })
    });

    expect(unsupported.supported).to.be.false;
    expect(unsupported.diagnostics[0].kind)
      .equals(ComponentRuntimeProjectionDiagnosticKind.RUNTIME_VALUE_UNAVAILABLE);
    expect(supported.changeSet.operations[0].after).equals(1);
  });

  it('projects rename deltas without runtime value evaluation', () => {
    const document = documentWith();
    const reduction = reduce(document, RenameNode, { name: 'renamed' });
    const projection = project(document, reduction);

    expect(projection.changeSet.operations[0]).containSubset({
      property: 'name',
      before: 'root',
      after: 'renamed'
    });
  });

  it('projects owner-layout synchronization as an exact rename companion', () => {
    const document = documentWith();
    const reduction = reduce(document, RenameNode, { name: 'renamed' });
    const beforeLayout = Object.create({ isLayout: true });
    const afterLayout = Object.create({ isLayout: true });
    const projection = project(document, reduction, {
      resolveRuntimeLayout: () => ({
        ownerId: 'runtime-owner',
        before: beforeLayout,
        after: afterLayout,
        applyWhenAdopting: true
      })
    });

    expect(projection.supported).to.be.true;
    expect(projection.changeSet.operations).length(2);
    expect(projection.changeSet.operations[1]).containSubset({
      targetId: 'runtime-owner',
      property: 'layout',
      before: beforeLayout,
      after: afterLayout,
      metadata: { applyWhenAdopting: true }
    });
    expect(projection.inverseChangeSet.operations[0]).containSubset({
      property: 'layout',
      before: afterLayout,
      after: beforeLayout
    });
  });

  it('projects node removal as an exact reversible attachment change', () => {
    const child = new ComponentNode({
      id: 'child',
      name: 'child',
      provenance: localNodeProvenance()
    });
    const document = new ComponentDocument({
      componentId: 'component',
      moduleId: 'local://component.js',
      exportName: 'Component',
      root: new ComponentNode({
        id: 'root',
        name: 'root',
        provenance: localNodeProvenance(),
        children: [child]
      })
    });
    const reduction = reduceComponent(document, RemoveNode({
      componentId: document.componentId,
      expectedRevision: document.revision,
      nodeId: child.id
    }));
    const projection = projectComponentRuntime({
      beforeDocument: document,
      reduction,
      changeSetId: 'runtime-removal',
      resolveRuntimeTargetId: id => id === child.id
        ? 'runtime-child'
        : id === document.root.id ? 'runtime-root' : null
    });
    const root = { id: 'runtime-root', submorphs: [] };
    const runtimeChild = { id: 'runtime-child', owner: root };
    root.submorphs.push(runtimeChild);
    const resolveMorph = id => id === root.id
      ? root
      : id === runtimeChild.id ? runtimeChild : null;
    const context = {
      resolveMorph,
      validateMoveMorph: (morph, from) => {
        expect(morph.owner?.id || null).equals(from.ownerId || null);
      },
      moveMorph: (morph, from, to) => {
        if (from.ownerId) {
          resolveMorph(from.ownerId).submorphs.splice(from.index, 1);
          morph.owner = null;
        }
        if (to.ownerId) {
          const owner = resolveMorph(to.ownerId);
          owner.submorphs.splice(to.index, 0, morph);
          morph.owner = owner;
        }
      }
    };

    expect(projection.supported).to.be.true;
    expect(projection.changeSet.operations[0]).containSubset({
      morphId: runtimeChild.id,
      from: { ownerId: root.id, index: 0 }
    });
    projection.changeSet.apply(context);
    expect(root.submorphs).deep.equals([]);
    expect(runtimeChild.owner).equals(null);
    projection.inverseChangeSet.apply(context);
    expect(root.submorphs).deep.equals([runtimeChild]);
    expect(runtimeChild.owner).equals(root);
  });

  it('projects append-only introduction as an exact reversible attachment change', () => {
    const document = documentWith();
    const child = new ComponentNode({
      id: 'child',
      name: 'child',
      provenance: localNodeProvenance()
    });
    const reduction = reduceComponent(document, IntroduceNode({
      componentId: document.componentId,
      expectedRevision: document.revision,
      parentId: document.root.id,
      node: child,
      beforeId: null
    }));
    const projection = projectComponentRuntime({
      beforeDocument: document,
      reduction,
      changeSetId: 'runtime-introduction',
      resolveRuntimeTargetId: id => id === child.id
        ? 'runtime-child'
        : id === document.root.id ? 'runtime-root' : null
    });
    const root = { id: 'runtime-root', submorphs: [] };
    const runtimeChild = { id: 'runtime-child', owner: null };
    const resolveMorph = id => id === root.id
      ? root
      : id === runtimeChild.id ? runtimeChild : null;
    const context = {
      resolveMorph,
      moveMorph: (morph, from, to) => {
        if (from.ownerId) {
          resolveMorph(from.ownerId).submorphs.splice(from.index, 1);
          morph.owner = null;
        }
        if (to.ownerId) {
          const owner = resolveMorph(to.ownerId);
          owner.submorphs.splice(to.index, 0, morph);
          morph.owner = owner;
        }
      }
    };

    expect(projection.supported).to.be.true;
    expect(projection.changeSet.operations[0]).containSubset({
      morphId: runtimeChild.id,
      to: { ownerId: root.id, index: 0 }
    });
    projection.changeSet.apply(context);
    expect(root.submorphs).deep.equals([runtimeChild]);
    expect(runtimeChild.owner).equals(root);
    projection.inverseChangeSet.apply(context);
    expect(root.submorphs).deep.equals([]);
    expect(runtimeChild.owner).equals(null);
  });

  it('projects sibling reordering as an exact reversible attachment change', () => {
    const children = ['first', 'second', 'third'].map(name => new ComponentNode({
      id: name,
      name,
      provenance: localNodeProvenance()
    }));
    const document = new ComponentDocument({
      componentId: 'component',
      moduleId: 'local://component.js',
      exportName: 'Component',
      root: new ComponentNode({
        id: 'root',
        name: 'root',
        provenance: localNodeProvenance(),
        children
      })
    });
    const reduction = reduceComponent(document, MoveNode({
      componentId: document.componentId,
      expectedRevision: document.revision,
      nodeId: 'third',
      parentId: 'root',
      beforeId: 'first'
    }));
    const projection = projectComponentRuntime({
      beforeDocument: document,
      reduction,
      changeSetId: 'runtime-reorder',
      resolveRuntimeTargetId: id => `runtime-${id}`
    });
    const root = { id: 'runtime-root' };
    const runtimeChildren = children.map(({ id }) => ({ id: `runtime-${id}`, owner: root }));
    root.submorphs = runtimeChildren.slice();
    const targets = new Map([[root.id, root], ...runtimeChildren.map(child => [child.id, child])]);
    const context = {
      resolveMorph: id => targets.get(id),
      moveMorph: (morph, from, to) => {
        targets.get(from.ownerId).submorphs.splice(from.index, 1);
        const owner = targets.get(to.ownerId);
        owner.submorphs.splice(to.index, 0, morph);
        morph.owner = owner;
      }
    };

    expect(projection.supported).to.be.true;
    expect(projection.changeSet.operations[0]).containSubset({
      morphId: 'runtime-third',
      from: { ownerId: root.id, index: 2 },
      to: { ownerId: root.id, index: 0 }
    });
    projection.changeSet.apply(context);
    expect(root.submorphs.map(({ id }) => id))
      .deep.equals(['runtime-third', 'runtime-first', 'runtime-second']);
    projection.inverseChangeSet.apply(context);
    expect(root.submorphs.map(({ id }) => id))
      .deep.equals(['runtime-first', 'runtime-second', 'runtime-third']);
  });

  it('projects reparenting and its collision rename as exact reversible changes', () => {
    const moved = new ComponentNode({
      id: 'moved', name: 'moved', provenance: localNodeProvenance()
    });
    const sourceParent = new ComponentNode({
      id: 'source', name: 'source', provenance: localNodeProvenance(), children: [moved]
    });
    const destination = new ComponentNode({
      id: 'destination', name: 'destination', provenance: localNodeProvenance()
    });
    const document = new ComponentDocument({
      componentId: 'component',
      moduleId: 'local://component.js',
      exportName: 'Component',
      root: new ComponentNode({
        id: 'root', name: 'root', provenance: localNodeProvenance(),
        children: [sourceParent, destination]
      })
    });
    const reduction = reduceComponent(document, MoveNode({
      componentId: document.componentId,
      expectedRevision: document.revision,
      nodeId: moved.id,
      parentId: destination.id,
      beforeId: null
    }));
    const projection = projectComponentRuntime({
      beforeDocument: document,
      reduction,
      changeSetId: 'runtime-reparent',
      resolveRuntimeTargetId: id => `runtime-${id}`,
      runtimeRename: { before: 'moved', after: 'moved_1' }
    });
    const root = { id: 'runtime-root' };
    const runtimeSource = { id: 'runtime-source', owner: root };
    const runtimeDestination = { id: 'runtime-destination', owner: root };
    const runtimeMoved = { id: 'runtime-moved', name: 'moved', owner: runtimeSource };
    root.submorphs = [runtimeSource, runtimeDestination];
    runtimeSource.submorphs = [runtimeMoved];
    runtimeDestination.submorphs = [];
    const targets = new Map([root, runtimeSource, runtimeDestination, runtimeMoved]
      .map(target => [target.id, target]));
    const context = {
      resolveMorph: id => targets.get(id),
      moveMorph: (morph, from, to) => {
        targets.get(from.ownerId).submorphs.splice(from.index, 1);
        const owner = targets.get(to.ownerId);
        owner.submorphs.splice(to.index, 0, morph);
        morph.owner = owner;
      }
    };

    expect(projection.supported).to.be.true;
    projection.changeSet.apply(context);
    expect(runtimeSource.submorphs).deep.equals([]);
    expect(runtimeDestination.submorphs).deep.equals([runtimeMoved]);
    expect(runtimeMoved.owner).equals(runtimeDestination);
    expect(runtimeMoved.name).equals('moved_1');
    projection.inverseChangeSet.apply(context);
    expect(runtimeSource.submorphs).deep.equals([runtimeMoved]);
    expect(runtimeDestination.submorphs).deep.equals([]);
    expect(runtimeMoved.owner).equals(runtimeSource);
    expect(runtimeMoved.name).equals('moved');
  });

  it('projects inherited suppression and restoration as inverse attachments', () => {
    const inherited = new ComponentNode({
      id: 'inherited', name: 'inherited', provenance: inheritedNodeProvenance()
    });
    const document = new ComponentDocument({
      componentId: 'component', moduleId: 'local://component.js', exportName: 'Component',
      root: new ComponentNode({
        id: 'root', name: 'root', provenance: localNodeProvenance(), children: [inherited]
      })
    });
    const suppressed = reduceComponent(document, SuppressInheritedNode({
      componentId: document.componentId,
      expectedRevision: document.revision,
      nodeId: inherited.id
    }));
    const projection = projectComponentRuntime({
      beforeDocument: document,
      reduction: suppressed,
      changeSetId: 'runtime-suppression',
      resolveRuntimeTargetId: id => `runtime-${id}`
    });

    expect(projection.supported).to.be.true;
    expect(projection.changeSet.operations[0]).containSubset({
      morphId: 'runtime-inherited',
      from: { ownerId: 'runtime-root', index: 0 },
      to: { kind: 'detached' }
    });

    const restored = reduceComponent(suppressed.document, RestoreInheritedNode({
      componentId: document.componentId,
      expectedRevision: suppressed.document.revision,
      nodeId: inherited.id,
      parentId: document.root.id,
      beforeId: null
    }));
    const restoration = projectComponentRuntime({
      beforeDocument: suppressed.document,
      reduction: restored,
      changeSetId: 'runtime-restoration',
      resolveRuntimeTargetId: id => `runtime-${id}`
    });
    expect(restoration.changeSet.operations[0]).containSubset({
      morphId: 'runtime-inherited',
      from: { kind: 'detached' },
      to: { ownerId: 'runtime-root', index: 0 }
    });
  });

  it('projects cached derived moves as exact reversible runtime changes', () => {
    const beforeDocument = derivedStructureDocument();
    const afterDocument = derivedStructureDocument({ moved: true });
    const runtime = derivedRuntimeStructure();
    const projection = projectCachedDerivedRuntimeStructure({
      components: [derivedComponentPlan(beforeDocument, afterDocument, runtime)],
      nodeId: 'target',
      commandKind: DerivedRuntimeStructureProjectionKind.MOVE,
      changeSetId: 'derived-move'
    });
    const operation = projection.changeSet.operations[0];

    expect(operation.morphId).equals(runtime.target.id);
    expect(operation.from.ownerId).equals(runtime.left.id);
    expect(operation.from.index).equals(0);
    expect(operation.to.ownerId).equals(runtime.right.id);
    expect(operation.to.index).equals(1);
    expect(projection.inverseChangeSet.operations[0].from).deep.equals(operation.to);
    expect(projection.inverseChangeSet.operations[0].to).deep.equals(operation.from);
    expect(projection.resolveMorph(runtime.target.id)).equals(runtime.target);
  });

  it('projects cached derived removals from the exact runtime owner and index', () => {
    const beforeDocument = derivedStructureDocument();
    const afterDocument = derivedStructureDocument({ removed: true });
    const runtime = derivedRuntimeStructure();
    const projection = projectCachedDerivedRuntimeStructure({
      components: [derivedComponentPlan(beforeDocument, afterDocument, runtime)],
      nodeId: 'target',
      commandKind: DerivedRuntimeStructureProjectionKind.REMOVE,
      changeSetId: 'derived-removal'
    });
    const operation = projection.changeSet.operations[0];

    expect(operation.morphId).equals(runtime.target.id);
    expect(operation.from.ownerId).equals(runtime.left.id);
    expect(operation.from.index).equals(0);
    expect(operation.to.kind).equals('detached');
  });

  it('projects plain cached derived introductions from an exact runtime copy', () => {
    const beforeDocument = derivedStructureDocument({ removed: true });
    const afterDocument = derivedStructureDocument();
    const runtime = derivedRuntimeStructure();
    runtime.left.submorphs = [];
    runtime.target.owner = null;
    const copiedTarget = {
      id: 'derived-runtime-target-copy',
      name: 'target',
      owner: null,
      submorphs: []
    };
    const sourceMorph = {
      id: 'base-runtime-target',
      name: 'target',
      owner: { id: 'base-runtime-left' },
      submorphs: [],
      copy: () => copiedTarget
    };
    const projection = projectCachedDerivedRuntimeStructure({
      components: [derivedComponentPlan(beforeDocument, afterDocument, runtime)],
      nodeId: 'target',
      commandKind: DerivedRuntimeStructureProjectionKind.INTRODUCE,
      changeSetId: 'derived-introduction',
      sourceMorph
    });
    const operation = projection.changeSet.operations[0];

    expect(operation.morphId).equals(copiedTarget.id);
    expect(operation.from.kind).equals('detached');
    expect(operation.to.ownerId).equals(runtime.left.id);
    expect(operation.to.index).equals(0);
    expect(projection.resolveMorph(copiedTarget.id)).equals(copiedTarget);
    expect(projection.inverseChangeSet.operations[0].from).deep.equals(operation.to);
    expect(projection.inverseChangeSet.operations[0].to).deep.equals(operation.from);
  });

  it('rejects copy-based introductions that require derived-local synthesis', () => {
    const beforeDocument = derivedStructureDocument({ removed: true });
    const afterDocument = derivedStructureDocument({ targetHasOverrides: true });
    const runtime = derivedRuntimeStructure();
    runtime.left.submorphs = [];
    const sourceMorph = {
      id: 'base-runtime-target',
      name: 'target',
      owner: { id: 'base-runtime-left' },
      submorphs: [],
      copy: () => ({
        id: 'derived-runtime-target-copy',
        name: 'target',
        owner: null,
        submorphs: []
      })
    };

    expect(() => projectCachedDerivedRuntimeStructure({
      components: [derivedComponentPlan(beforeDocument, afterDocument, runtime)],
      nodeId: 'target',
      commandKind: DerivedRuntimeStructureProjectionKind.INTRODUCE,
      changeSetId: 'derived-overridden-introduction',
      sourceMorph
    })).to.throw('requires local synthesis');
  });
});
