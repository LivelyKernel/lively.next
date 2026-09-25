/* global describe, it */
import { expect } from 'mocha-es6';
import {
  MoveMorph,
  SetMorphProperty,
  attachedMorph,
  detachedMorph
} from 'lively.morphic/changes/index.js';
import { MorphicChangeSet } from 'lively.morphic/changes/change-set.js';
import { UndoManager } from 'lively.morphic/undo.js';
import {
  ComponentChangeTracker,
  ProjectionalReconciliationUnsupportedError,
  ProjectionalCommandDiagnosticKind,
  ProjectionalRenameDiagnosticKind,
  componentChangeTrackerFor,
  setMorphPropertyWithComponentCommand
} from '../../components/change-tracker.js';
import {
  ComponentTransactionState,
  ProjectionalComponentEditTransaction
} from '../../components/reconciliation/component-transaction.js';
import {
  ComponentBridgeCommandKind,
  MorphicChangeSetAdapter
} from '../../components/reconciliation/morphic-change-set-adapter.js';
import {
  ComponentDocument,
  ComponentNode,
  addedNodeProvenance,
  inheritedNodeProvenance,
  localNodeProvenance,
  opaqueProperty,
  sourceComponentReference,
  tilingLayoutModel
} from '../../components/reconciliation/component-document.js';
import {
  ComponentMoveInheritanceTransitionKind
} from '../../components/reconciliation/commands.js';
import { prepareShadowScalarProjection } from '../../components/reconciliation/shadow-projection.js';

function changeSet (operationOrOperations, origin = 'direct-manipulation') {
  const operations = Array.isArray(operationOrOperations)
    ? operationOrOperations
    : [operationOrOperations];
  return new MorphicChangeSet({
    id: `change-${operations.map(({ kind }) => kind).join('-')}`,
    origin,
    operations
  });
}

function adapterFor (...ids) {
  const targets = new Map(ids.map(id => [id, { id }]));
  return {
    adapter: new MorphicChangeSetAdapter({
      componentId: 'module::Component',
      containsMorph: morph => targets.has(morph.id)
    }),
    context: { resolveMorph: id => targets.get(id) }
  };
}

class RuntimeTilingLayoutState {
  constructor (resizePolicies = []) {
    this.config = {
      resizePolicies: resizePolicies.map(([name, policy]) => [name, { ...policy }])
    };
    this.implicitPolicies = new Map();
  }

  copy () {
    const copy = new RuntimeTilingLayoutState(this.config.resizePolicies);
    copy.implicitPolicies = new Map(this.implicitPolicies);
    return copy;
  }

  handleRenamingOf (before, after) {
    this.config.resizePolicies = this.config.resizePolicies.map(([name, policy]) =>
      [name === before ? after : name, policy]);
  }

  onSubmorphAdded (morph) {
    if (!this.config.resizePolicies.some(([name]) => name === morph.name)) {
      this.implicitPolicies.set(morph, { width: 'fixed', height: 'fixed' });
    }
  }

  onSubmorphRemoved (morph) {
    this.implicitPolicies.delete(morph);
    this.config.resizePolicies = this.config.resizePolicies
      .filter(([name]) => name !== morph.name);
  }

  resizePolicyFor (morph) {
    return this.config.resizePolicies.find(([name]) => name === morph.name)?.[1] ||
      this.implicitPolicies.get(morph) || null;
  }
}

function installLayoutAwareMorphOperations (owner) {
  owner.addMorphAt = function (morph, index) {
    this.submorphs.splice(index, 0, morph);
    morph.owner = this;
    this.layout?.onSubmorphAdded(morph);
  };
  owner.removeMorph = function (morph) {
    const index = this.submorphs.indexOf(morph);
    if (index < 0) return;
    this.submorphs.splice(index, 1);
    morph.owner = null;
    this.layout?.onSubmorphRemoved(morph);
  };
}

function installRemovableMorphOperation (morph) {
  morph.remove = function () {
    this.owner?.removeMorph(this);
  };
}

describe('projectional reconciliation bridge', () => {
  it('maps runtime insertion indices past suppressed inherited children', () => {
    const moduleId = 'local://runtime-index/component.cp.js';
    const componentId = `${moduleId}#Example`;
    const parentDocument = new ComponentDocument({
      componentId: 'local://runtime-index/base.cp.js#Base',
      moduleId: 'local://runtime-index/base.cp.js',
      exportName: 'Base',
      root: new ComponentNode({
        id: 'base-root',
        name: 'base',
        provenance: localNodeProvenance(),
        children: [
          new ComponentNode({
            id: 'hidden-child', name: 'hidden', provenance: localNodeProvenance()
          }),
          new ComponentNode({
            id: 'visible-child', name: 'visible', provenance: localNodeProvenance()
          })
        ]
      })
    });
    const source = `import { without } from 'lively.morphic';
const Example = component(Base, {
  name: 'example',
  submorphs: [without('hidden'), { name: 'visible' }]
});`;
    const introduced = new ComponentNode({
      id: 'introduced-semantic',
      name: 'introduced',
      provenance: localNodeProvenance()
    });
    const projection = prepareShadowScalarProjection({
      source,
      moduleId,
      exportName: 'Example',
      componentId,
      parentDocument,
      bridgeCommands: [{
        kind: ComponentBridgeCommandKind.INTRODUCE_NODE,
        componentId,
        nodeId: 'runtime-introduced',
        parentId: 'runtime-root',
        index: 0
      }],
      resolveNodeId: document => document.root.id,
      runtimeNodeNameFor: () => 'introduced',
      introducedNodeFor: () => ({
        supported: true,
        node: introduced,
        bindings: {},
        requiredBindings: []
      })
    });

    expect(projection.supported, JSON.stringify(projection.diagnostics)).to.be.true;
    expect(projection.steps[0].componentCommand.beforeId).equals('visible-child');
    expect(projection.sourceAfter).matches(/import\s*\{[^}]*\badd\b[^}]*\}\s*from ['"]lively\.morphic['"]/);
    expect(projection.sourceAfter).includes('add({ name: "introduced" }, "visible")');
  });

  it('preserves added descendants when materializing an inherited move', () => {
    const moduleId = 'local://materialized-descendant/component.cp.js';
    const componentId = `${moduleId}#Example`;
    const parentDocument = new ComponentDocument({
      componentId: 'parent',
      moduleId: 'local://materialized-descendant/parent.cp.js',
      exportName: 'Parent',
      root: new ComponentNode({
        id: 'parent-root',
        name: 'parent',
        provenance: localNodeProvenance(),
        children: [new ComponentNode({
          id: 'parent-mover',
          name: 'mover',
          provenance: localNodeProvenance(),
          children: [new ComponentNode({
            id: 'parent-base-child',
            name: 'base child',
            provenance: localNodeProvenance()
          })]
        }), new ComponentNode({
          id: 'parent-destination',
          name: 'destination',
          provenance: localNodeProvenance()
        })]
      })
    });
    const source = `import { add, part, TilingLayout, without } from 'lively.morphic';
import { Text } from 'lively.morphic/text/morph.js';
import { Leaf } from 'local://materialized-descendant/leaf.cp.js';
const Example = component(Parent, {
  name: 'example',
  submorphs: [
    { name: 'mover', layout: new TilingLayout({ spacing: 9 }), submorphs: [add({
      name: 'local child',
      type: Text,
      textString: 'kept',
      submorphs: [{ name: 'nested local child' }]
    }, 'base child')] },
    { name: 'destination' }
  ]
});`;
    const projection = prepareShadowScalarProjection({
      source,
      moduleId,
      exportName: 'Example',
      componentId,
      parentDocument,
      bridgeCommands: [{
        kind: ComponentBridgeCommandKind.MOVE_NODE,
        componentId,
        nodeId: 'runtime-mover',
        previousParentId: 'runtime-root',
        previousIndex: 0,
        parentId: 'runtime-destination',
        index: 0
      }],
      resolveNodeId: document => document.root.children[0].id,
      resolveDestinationParentId: document => document.root.children[1].id,
      runtimeOrderingNameFor: () => null,
      introducedNodeFor: () => ({
        supported: true,
        node: new ComponentNode({
          id: 'materialized-mover',
          name: 'mover',
          provenance: localNodeProvenance(),
          partComponent: sourceComponentReference('Leaf'),
          children: [new ComponentNode({
            id: 'materialized-local-child',
            name: 'local child',
            provenance: inheritedNodeProvenance({ baseName: 'local child' })
          }), new ComponentNode({
            id: 'materialized-base-child',
            name: 'base child',
            provenance: inheritedNodeProvenance({ baseName: 'base child' })
          })]
        }),
        bindings: {},
        requiredBindings: []
      })
    });

    expect(projection.supported, JSON.stringify(projection.diagnostics)).to.be.true;
    expect(projection.sourceAfter).includes('without("mover")');
    expect(projection.sourceAfter).includes('add(part(Leaf, { name: "mover"');
    expect(projection.sourceAfter)
      .includes('layout: new TilingLayout({ spacing: 9 })');
    expect(projection.document.root.children[1].children[0]
      .properties.layout.expression).equals('new TilingLayout({ spacing: 9 })');
    expect(projection.sourceAfter)
      .includes('add({ name: "local child", type: Text, textString: "kept", submorphs: [{ name: "nested local child" }] }, "base child")');
    expect(projection.document.root.children[1].children[0].children[0]
      .provenance.kind).equals(addedNodeProvenance().kind);
    expect(projection.document.root.children[1].children[0].children[1]
      .provenance.baseName).equals('base child');
  });

  it('consolidates a materialized node when it returns to its suppressed inherited slot', () => {
    const moduleId = 'local://materialized-restoration/component.cp.js';
    const componentId = `${moduleId}#Example`;
    const parentDocument = new ComponentDocument({
      componentId: 'parent',
      moduleId: 'local://materialized-restoration/parent.cp.js',
      exportName: 'Parent',
      root: new ComponentNode({
        id: 'parent-root',
        name: 'parent',
        provenance: localNodeProvenance(),
        children: [new ComponentNode({
          id: 'parent-container',
          name: 'container',
          provenance: localNodeProvenance(),
          children: [new ComponentNode({
            id: 'parent-child',
            name: 'child',
            provenance: localNodeProvenance()
          })]
        })]
      })
    });
    const source = `import { add, without } from 'lively.morphic';
const Example = component(Parent, {
  name: 'example',
  submorphs: [{
    name: 'container',
    submorphs: [{ name: 'child', borderWidth: 2 }, without('child')]
  }, add({ name: 'child', borderWidth: 2, opacity: 0.4 })]
});`;
    const projection = prepareShadowScalarProjection({
      source,
      moduleId,
      exportName: 'Example',
      componentId,
      parentDocument,
      bridgeCommands: [{
        kind: ComponentBridgeCommandKind.MOVE_NODE,
        componentId,
        nodeId: 'runtime-child',
        previousParentId: 'runtime-root',
        previousIndex: 1,
        parentId: 'runtime-container',
        index: 0
      }],
      resolveNodeId: document => document.root.children.find(
        child => child.name === 'child'
      ).id,
      resolveDestinationParentId: document => document.root.children.find(
        child => child.name === 'container'
      ).id,
      runtimeOrderingNameFor: () => null
    });

    expect(projection.supported, JSON.stringify(projection.diagnostics)).to.be.true;
    expect(projection.steps[0].componentCommand.inheritanceTransition.kind)
      .equals(ComponentMoveInheritanceTransitionKind.RESTORE);
    expect(projection.sourceAfter).not.includes('without(');
    expect(projection.sourceAfter).not.includes('add(');
    expect(projection.sourceAfter).includes('opacity: 0.4');
    expect(projection.document.root.children).to.have.length(1);
    expect(projection.document.root.children[0].children).to.have.length(1);
  });

  it('maps property and rename operations into shadow component commands', () => {
    const { adapter, context } = adapterFor('target');
    const property = adapter.adapt(changeSet(new SetMorphProperty({
      targetId: 'target', property: 'fill', before: 'red', after: 'green'
    })), context);
    const rename = adapter.adapt(changeSet(new SetMorphProperty({
      targetId: 'target', property: 'name', before: 'before', after: 'after'
    })), context);
    const text = adapter.adapt(changeSet(new SetMorphProperty({
      targetId: 'target',
      property: 'textAndAttributes',
      before: ['before', null],
      after: ['after', null]
    })), context);
    const master = adapter.adapt(changeSet(new SetMorphProperty({
      targetId: 'target', property: 'master', before: null, after: { mode: 'hover' }
    })), context);

    expect(property.commands[0]).containSubset({
      kind: ComponentBridgeCommandKind.SET_PROPERTY,
      componentId: 'module::Component',
      nodeId: 'target',
      property: 'fill',
      previousValue: 'red',
      value: 'green',
      origin: 'direct-manipulation'
    });
    expect(rename.commands[0]).containSubset({
      kind: ComponentBridgeCommandKind.RENAME_NODE,
      previousName: 'before',
      name: 'after'
    });
    expect(text.commands[0]).containSubset({
      kind: ComponentBridgeCommandKind.EDIT_TEXT,
      previousValue: ['before', null],
      value: ['after', null]
    });
    expect(master.commands[0]).containSubset({
      kind: ComponentBridgeCommandKind.SET_MASTER,
      previousValue: null,
      value: { mode: 'hover' }
    });
  });

  it('maps insertion, removal, and movement into structural bridge commands', () => {
    const { adapter, context } = adapterFor('node', 'source', 'destination');
    const insertion = adapter.adapt(changeSet(new MoveMorph({
      morphId: 'node',
      from: detachedMorph(),
      to: attachedMorph({ ownerId: 'destination', index: 0 })
    })), context);
    const removal = adapter.adapt(changeSet(new MoveMorph({
      morphId: 'node',
      from: attachedMorph({ ownerId: 'source', index: 1 }),
      to: detachedMorph()
    })), context);
    const movement = adapter.adapt(changeSet(new MoveMorph({
      morphId: 'node',
      from: attachedMorph({ ownerId: 'source', index: 1 }),
      to: attachedMorph({ ownerId: 'destination', index: 0 })
    })), context);

    expect(insertion.commands[0].kind).equals(ComponentBridgeCommandKind.INTRODUCE_NODE);
    expect(removal.commands[0].kind).equals(ComponentBridgeCommandKind.REMOVE_NODE);
    expect(movement.commands[0]).containSubset({
      kind: ComponentBridgeCommandKind.MOVE_NODE,
      previousParentId: 'source',
      previousIndex: 1,
      parentId: 'destination',
      index: 0
    });
    expect(movement.diagnostics).deep.equals([]);
  });

  it('suppresses source and runtime projection feedback', () => {
    const { adapter, context } = adapterFor('target');
    const operation = new SetMorphProperty({
      targetId: 'target', property: 'fill', before: 'red', after: 'green'
    });

    const runtime = adapter.adapt(changeSet(operation, 'runtime-projection'), context);
    const source = adapter.adapt(changeSet(operation, 'source-projection'), context);

    expect(runtime.ignoredProjection).to.be.true;
    expect(source.ignoredProjection).to.be.true;
    expect(runtime.commands).deep.equals([]);
    expect(source.commands).deep.equals([]);
  });

  it('lets trackers suppress TextMorph-internal operations before bridging', () => {
    const targets = new Map([['text', { id: 'text' }]]);
    const adapter = new MorphicChangeSetAdapter({
      componentId: 'module::Component',
      containsMorph: () => true,
      ignoreOperation: operation => operation.property === 'document'
    });
    const result = adapter.adapt(changeSet([
      new SetMorphProperty({
        targetId: 'text', property: 'document', before: null, after: {}
      }),
      new SetMorphProperty({
        targetId: 'text', property: 'textAndAttributes',
        before: ['', null], after: ['project me', null]
      })
    ]), { resolveMorph: id => targets.get(id) });

    expect(result.commands).to.have.length(1);
    expect(result.commands[0]).containSubset({
      kind: ComponentBridgeCommandKind.EDIT_TEXT,
      nodeId: 'text',
      value: ['project me', null]
    });
  });

  it('suppresses auto-fit Text extent without suppressing a deliberate resize', () => {
    const text = {
      id: 'text', isText: true, owner: null, epiMorph: false,
      styleProperties: ['extent']
    };
    const tracker = Object.create(ComponentChangeTracker.prototype);
    tracker.committedChangeAdapter = new MorphicChangeSetAdapter({
      componentId: 'module::Component',
      containsMorph: () => true,
      ignoreOperation: (operation, context) =>
        tracker.ignoreCommittedTextOperation(operation, context)
    });
    const result = tracker.committedChangeAdapter.adapt(changeSet([
      new SetMorphProperty({
        targetId: text.id,
        property: 'extent',
        before: { x: 10, y: 10 },
        after: { x: 20, y: 20 },
        metadata: { isLayoutAction: true }
      }),
      new SetMorphProperty({
        targetId: text.id,
        property: 'extent',
        before: { x: 20, y: 20 },
        after: { x: 30, y: 30 },
        metadata: { metaInteraction: true }
      }),
      new SetMorphProperty({
        targetId: text.id,
        property: 'extent',
        before: { x: 30, y: 30 },
        after: { x: 40, y: 40 }
      })
    ]), { resolveMorph: id => id === text.id ? text : null });

    expect(result.commands).to.have.length(1);
    expect(result.commands[0]).containSubset({
      kind: ComponentBridgeCommandKind.SET_PROPERTY,
      nodeId: text.id,
      property: 'extent',
      value: { x: 40, y: 40 }
    });
    tracker.trackedComponent = {};
    expect(tracker.ignoreChange({
      target: text,
      prop: 'extent',
      prevValue: { x: 10, y: 10 },
      value: { x: 20, y: 20 },
      meta: { reconcileChanges: true, metaInteraction: true }
    })).to.be.true;
    expect(tracker.ignoreChange({
      target: text,
      prop: 'extent',
      prevValue: { x: 20, y: 20 },
      value: { x: 40, y: 40 },
      meta: { reconcileChanges: true }
    })).to.be.false;
  });

  it('suppresses geometry derived inside a grouped layout gesture', () => {
    const tracker = Object.create(ComponentChangeTracker.prototype);
    const layoutOperation = new SetMorphProperty({
      targetId: 'owner',
      property: 'layout',
      before: null,
      after: {}
    });
    const extentOperation = new SetMorphProperty({
      targetId: 'child',
      property: 'extent',
      before: { x: 10, y: 10 },
      after: { x: 20, y: 20 }
    });
    const layoutChange = { prop: 'layout', operation: layoutOperation };
    const extentChange = { prop: 'extent', operation: extentOperation };
    const context = {
      committedChange: { changes: [layoutChange, extentChange] },
      legacyChanges: [layoutChange, extentChange],
      resolveMorph: () => ({ id: 'child' })
    };

    expect(tracker.ignoreCommittedTextOperation(extentOperation, context)).to.be.true;
    expect(tracker.ignoreCommittedTextOperation(layoutOperation, context)).to.be.false;
    expect(tracker.projectionalLegacyChangeCount(context)).equals(1);
  });

  it('does not turn runtime projection writes into local policy overrides', () => {
    const tracker = Object.create(ComponentChangeTracker.prototype);
    let writeMeta;
    const target = {
      id: 'target',
      fill: 'red',
      withMetaDo (meta, callback) {
        writeMeta = meta;
        return callback();
      }
    };
    const runtime = tracker.runtimeProjectionContext({
      resolveMorph: id => id === target.id ? target : null
    });

    runtime.setMorphProperty(target, 'fill', 'green');

    expect(target.fill).equals('green');
    expect(writeMeta).containSubset({
      origin: 'runtime-projection',
      reconcileChanges: false,
      doNotOverride: true
    });
  });

  it('accepts value-equivalent runtime state after a source refresh', () => {
    class Value {
      constructor (number) { this.number = number; }
      equals (other) { return other?.number === this.number; }
    }
    const target = { id: 'target', origin: new Value(3) };
    const tracker = Object.create(ComponentChangeTracker.prototype);
    const runtime = tracker.runtimeProjectionContext({
      resolveMorph: id => id === target.id ? target : null
    });

    new SetMorphProperty({
      targetId: target.id,
      property: 'origin',
      before: new Value(3),
      after: new Value(4)
    }).apply(runtime);

    expect(target.origin.number).equals(4);
  });

  it('lets the component tracker retain bounded shadow batches without reconciling them', () => {
    const { adapter, context } = adapterFor('target');
    const tracker = Object.create(ComponentChangeTracker.prototype);
    tracker.committedChangeAdapter = adapter;
    const observed = [];
    tracker.onShadowComponentCommands = batch => observed.push(batch);
    const committed = changeSet(new SetMorphProperty({
      targetId: 'target', property: 'fill', before: 'red', after: 'green'
    }));

    const result = tracker.processCommittedChangeSet(committed, context);

    expect(result.commands).to.have.length(1);
    expect(observed).deep.equals([tracker.lastShadowCommandBatch]);
    expect(tracker.shadowCommandBatches).deep.equals([tracker.lastShadowCommandBatch]);
  });

  it('resolves nested part provenance from component policy metadata', () => {
    const metaSymbol = Symbol.for('lively-module-meta');
    const leafPolicy = {
      [metaSymbol]: {
        moduleId: 'local://components/base.cp.js',
        exportedName: 'Leaf',
        path: []
      }
    };
    const nestedPolicy = {
      _parent: leafPolicy,
      get parent () { return this._parent; },
      [metaSymbol]: {
        moduleId: 'local://components/base.cp.js',
        exportedName: 'Base',
        path: ['nested part']
      }
    };
    const basePolicy = {
      asBuildSpec: () => ({
        name: 'base',
        submorphs: [{ name: 'nested part', master: nestedPolicy }]
      }),
      [metaSymbol]: {
        moduleId: 'local://components/base.cp.js',
        exportedName: 'Base',
        path: []
      }
    };
    const tracker = Object.create(ComponentChangeTracker.prototype);
    tracker.componentModuleId = 'local://components/subject.cp.js';
    tracker.componentDescriptor = { componentName: 'Subject' };
    const resolver = tracker.projectionalComponentDocumentResolver({
      id: 'local://components/subject.cp.js',
      recorder: {
        Base: {
          isComponentDescriptor: true,
          stylePolicy: basePolicy,
          [metaSymbol]: basePolicy[metaSymbol]
        }
      }
    });

    const resolved = resolver({ expression: 'Base' });

    expect(resolved.root.children[0].partComponent.expression).equals('Leaf');
  });

  it('prepares scalar source projections without applying them', () => {
    const source = `const Example = component({
  name: 'example',
  submorphs: [{ name: 'target', fill: 'red' }]
});`;
    const root = { id: 'runtime-root', name: 'example', owner: null };
    const target = { id: 'target', name: 'target', owner: root };
    const tracker = Object.create(ComponentChangeTracker.prototype);
    tracker.trackedComponent = root;
    tracker.componentModuleId = 'local://shadow-projection/component.cp.js';
    tracker.componentModule = { _source: source };
    tracker.componentDescriptor = { componentName: 'Example' };
    tracker.committedChangeAdapter = new MorphicChangeSetAdapter({
      componentId: 'local://shadow-projection/component.cp.js::Example',
      containsMorph: () => true
    });
    const committed = changeSet(new SetMorphProperty({
      targetId: 'target', property: 'fill', before: 'red', after: 'green'
    }));

    const result = tracker.processCommittedChangeSet(committed, {
      resolveMorph: id => id === target.id ? target : id === root.id ? root : null
    });

    expect(result.shadowProjection.supported).to.be.true;
    expect(result.shadowProjection.sourceAfter).includes('fill: "green"');
    expect(result.shadowProjection.steps[0].runtimeProjection.changeSet.operations[0])
      .containSubset({
        targetId: target.id,
        property: 'fill',
        before: 'red',
        after: 'green'
      });
    expect(result.shadowProjection.steps[0].runtimeProjection.changeSet.origin)
      .equals('runtime-projection');
    expect(result.shadowProjection.runtimeChangeSet.operations).to.have.length(1);
    expect(result.shadowProjection.inverseRuntimeChangeSet.operations[0])
      .containSubset({ before: 'green', after: 'red' });
    expect(tracker.componentModule._source).equals(source);
    expect(tracker.lastShadowCommandBatch.shadowProjection)
      .equals(result.shadowProjection);
  });

  it('resolves renamed runtime morphs through their pre-change source names', () => {
    const source = `const Example = component({
  name: 'example',
  submorphs: [{ name: 'before' }]
});`;
    const root = { id: 'runtime-root', name: 'example', owner: null };
    const target = { id: 'target', name: 'after', owner: root };
    const tracker = Object.create(ComponentChangeTracker.prototype);
    tracker.trackedComponent = root;
    tracker.componentModuleId = 'local://shadow-projection/component.cp.js';
    tracker.componentModule = { _source: source };
    tracker.componentDescriptor = { componentName: 'Example' };
    tracker.committedChangeAdapter = new MorphicChangeSetAdapter({
      componentId: 'local://shadow-projection/component.cp.js::Example',
      containsMorph: () => true
    });
    const committed = changeSet(new SetMorphProperty({
      targetId: 'target', property: 'name', before: 'before', after: 'after'
    }));

    const result = tracker.processCommittedChangeSet(committed, {
      resolveMorph: id => id === target.id ? target : id === root.id ? root : null
    });

    expect(result.shadowProjection.supported).to.be.true;
    expect(result.shadowProjection.sourceAfter).includes('name: "after"');
    expect(tracker.componentModule._source).equals(source);
  });

  it('projects sequential commands against refreshed semantic source metadata', () => {
    const source = `const Example = component({
  name: 'example',
  submorphs: [{ name: 'before', fill: 'red' }]
});`;
    const root = { id: 'runtime-root', name: 'example', owner: null };
    const target = { id: 'target', name: 'after', owner: root };
    const tracker = Object.create(ComponentChangeTracker.prototype);
    tracker.trackedComponent = root;
    tracker.componentModuleId = 'local://shadow-projection/component.cp.js';
    tracker.componentModule = { _source: source };
    tracker.componentDescriptor = { componentName: 'Example' };
    tracker.committedChangeAdapter = new MorphicChangeSetAdapter({
      componentId: 'local://shadow-projection/component.cp.js::Example',
      containsMorph: () => true
    });
    const committed = changeSet([
      new SetMorphProperty({
        targetId: 'target', property: 'name', before: 'before', after: 'after'
      }),
      new SetMorphProperty({
        targetId: 'target', property: 'fill', before: 'red', after: 'green'
      })
    ]);

    const result = tracker.processCommittedChangeSet(committed, {
      resolveMorph: id => id === target.id ? target : id === root.id ? root : null
    });

    expect(result.shadowProjection.supported).to.be.true;
    expect(result.shadowProjection.steps).to.have.length(2);
    expect(result.shadowProjection.runtimeChangeSet.operations).to.have.length(2);
    expect(result.shadowProjection.inverseRuntimeChangeSet.operations.map(operation =>
      operation.property)).deep.equals(['fill', 'name']);
    expect(result.shadowProjection.document.revision).equals(2);
    expect(result.shadowProjection.sourceAfter).includes('name: "after"');
    expect(result.shadowProjection.sourceAfter).includes('fill: "green"');
    expect(tracker.componentModule._source).equals(source);
  });

  it('reports unsupported changes without mutating source', async () => {
    const tracker = Object.create(ComponentChangeTracker.prototype);
    tracker.trackedComponent = { epiMorph: false };
    tracker.componentModule = {};
    tracker.lastShadowCommandBatch = Object.freeze({
      diagnostics: Object.freeze([Object.freeze({
        kind: 'unsupported-test-change',
        message: 'projection required'
      })])
    });
    const change = {
      target: tracker.trackedComponent,
      selector: 'unsupportedProjectionalChange',
      args: [],
      meta: { reconcileChanges: true }
    };

    let processingError;
    let completionError;
    try {
      await tracker.processChangeInComponent(change);
    } catch (error) {
      processingError = error;
    }
    try {
      await tracker.onceChangesProcessed();
    } catch (error) {
      completionError = error;
    }

    expect(processingError).to.be.instanceOf(ProjectionalReconciliationUnsupportedError);
    expect(processingError.change).equals(change);
    expect(processingError.message).includes('projection required');
    expect(completionError).equals(processingError);
  });

  it('records semantic comparisons after projectional commit completes', async () => {
    const source = `const Example = component({
  name: 'example',
  fill: 'red'
});`;
    const root = { id: 'runtime-root', name: 'example', owner: null };
    const tracker = Object.create(ComponentChangeTracker.prototype);
    tracker.trackedComponent = root;
    tracker.componentModuleId = 'local://shadow-projection/component.cp.js';
    tracker.componentModule = { _source: source };
    tracker.componentDescriptor = { componentName: 'Example' };
    tracker.committedChangeAdapter = new MorphicChangeSetAdapter({
      componentId: 'local://shadow-projection/component.cp.js::Example',
      containsMorph: () => true
    });
    let finishProjectionalCommit;
    tracker._finishPromise = new Promise(resolve => { finishProjectionalCommit = resolve; });
    const committed = changeSet(new SetMorphProperty({
      targetId: root.id, property: 'fill', before: 'red', after: 'green'
    }));

    const result = tracker.processCommittedChangeSet(committed, {
      resolveMorph: id => id === root.id ? root : null
    });
    tracker.componentModule._source = result.shadowProjection.sourceAfter;
    finishProjectionalCommit();
    const comparison = await tracker._shadowComparisonPromise;

    expect(comparison.matches).to.be.true;
    expect(tracker.lastShadowProjectionComparison).equals(comparison);
    expect(tracker.shadowProjectionComparisons).deep.equals([comparison]);
  });

  it('cuts scalar properties over by adopting the direct runtime change atomically', () => {
    const source = `const Example = component({
  name: 'example',
  fill: 'red'
});`;
    let fill = 'green';
    let runtimeWrites = 0;
    const root = { id: 'runtime-root', name: 'example', owner: null };
    Object.defineProperty(root, 'fill', {
      configurable: true,
      enumerable: true,
      get: () => fill,
      set: value => { runtimeWrites++; fill = value; }
    });
    const descriptorCalls = [];
    const tracker = Object.create(ComponentChangeTracker.prototype);
    tracker.trackedComponent = root;
    tracker.componentModuleId = 'local://scalar-cutover/component.cp.js';
    tracker.componentModule = {
      _source: source,
      setSource (nextSource) { this._source = nextSource; }
    };
    tracker.componentDescriptor = {
      componentName: 'Example',
      makeDirty: () => descriptorCalls.push('dirty'),
      refreshDependants: () => descriptorCalls.push('refresh')
    };
    tracker.committedChangeAdapter = new MorphicChangeSetAdapter({
      componentId: 'local://scalar-cutover/component.cp.js::Example',
      containsMorph: () => true
    });
    tracker.scheduleShadowProjectionComparison = () => null;
    const recordedChange = { meta: { reconcileChanges: true } };
    const journalCalls = [];
    root.env = {
      undoManager: {
        undoInProgress: { recorder: { changes: [recordedChange] } },
        discardRecordedChanges: changes => {
          journalCalls.push(['discard', changes]);
          return changes.length;
        },
        addTransaction: (transaction, options) => {
          journalCalls.push(['add', transaction, options]);
          return transaction;
        }
      }
    };
    const committed = changeSet(new SetMorphProperty({
      targetId: root.id, property: 'fill', before: 'red', after: 'green'
    }));

    const result = tracker.processCommittedChangeSet(committed, {
      legacyChanges: [recordedChange],
      resolveMorph: id => id === root.id ? root : null
    });

    expect(result.shadowProjection.supported).to.be.true;
    expect(result.projectionalCommit)
      .equals(tracker.lastShadowCommandBatch.projectionalCommit);
    expect(result.projectionalCommit.editTransaction)
      .to.be.instanceOf(ProjectionalComponentEditTransaction);
    expect(tracker.lastShadowCommandBatch.projectionalCommit.state)
      .equals(ComponentTransactionState.COMMITTED);
    expect(tracker.componentModule._source).includes('fill: "green"');
    expect(tracker._projectionalDocument.revision).equals(1);
    expect(fill).equals('green');
    expect(runtimeWrites).equals(0);
    expect(descriptorCalls).deep.equals(['dirty', 'refresh']);
    expect(journalCalls[0]).deep.equals(['discard', [recordedChange]]);
    expect(journalCalls[1][0]).equals('add');
    expect(journalCalls[1][2]).deep.equals({ joinActive: true });
    expect(tracker.ignoreChange(recordedChange)).to.be.true;
    expect(tracker.ignoreChange(recordedChange)).to.be.true;
  });

  it('resolves imported component descriptors for nested scalar cutover', () => {
    const source = `const Example = component({
  name: 'root',
  submorphs: [part(Card, {
    name: 'card instance',
    submorphs: [{ name: 'label', fill: 'red' }]
  })]
});`;
    const root = {
      id: 'runtime-root', name: 'root', owner: null,
      env: { undoManager: new UndoManager() }
    };
    const card = { id: 'runtime-card', name: 'card instance', owner: root };
    let fill = 'green';
    let runtimeWrites = 0;
    const label = { id: 'runtime-label', name: 'label', owner: card };
    Object.defineProperty(label, 'fill', {
      configurable: true,
      enumerable: true,
      get: () => fill,
      set: value => { runtimeWrites++; fill = value; }
    });
    root.submorphs = [card];
    card.submorphs = [label];
    label.submorphs = [];
    const cardDescriptor = {
      isComponentDescriptor: true,
      stylePolicy: {
        asBuildSpec: () => ({
          name: 'card',
          submorphs: [{ name: 'label', submorphs: [{ name: 'icon' }] }]
        })
      }
    };
    cardDescriptor[Symbol.for('lively-module-meta')] = {
      moduleId: 'local://nested-cutover/card.cp.js',
      exportedName: 'Card'
    };
    const tracker = Object.create(ComponentChangeTracker.prototype);
    tracker.trackedComponent = root;
    tracker.componentModuleId = 'local://nested-cutover/component.cp.js';
    tracker.componentModule = {
      _source: source,
      recorder: { Card: cardDescriptor },
      setSource (nextSource) { this._source = nextSource; }
    };
    tracker.componentDescriptor = {
      componentName: 'Example',
      stylePolicy: { _dependants: new Set() },
      makeDirty: () => {},
      refreshDependants: () => {}
    };
    tracker.committedChangeAdapter = new MorphicChangeSetAdapter({
      componentId: 'local://nested-cutover/component.cp.js::Example',
      containsMorph: () => true
    });
    tracker.scheduleShadowProjectionComparison = () => null;
    const resolveMorph = id => id === root.id
      ? root
      : id === card.id ? card : id === label.id ? label : null;

    const result = tracker.processCommittedChangeSet(changeSet(new SetMorphProperty({
      targetId: label.id,
      property: 'fill',
      before: 'red',
      after: 'green'
    })), {
      legacyChanges: [{}],
      resolveMorph
    });

    expect(result.projectionalCommit).not.equals(null);
    expect(tracker.componentModule._source).includes('fill: "green"');
    expect(tracker._projectionalDocument.root.children[0].children[0].name)
      .equals('label');
    expect(tracker._projectionalDocument.root.children[0].children[0].children[0].name)
      .equals('icon');
    expect(fill).equals('green');
    expect(runtimeWrites).equals(0);

    root.env.undoManager.undo();
    expect(tracker.componentModule._source).equals(source);
    expect(fill).equals('red');

    root.env.undoManager.redo();
    expect(tracker.componentModule._source).includes('fill: "green"');
    expect(fill).equals('green');
  });

  it('cuts nested inherited removal over through a resolved part descriptor', () => {
    const source = `const Example = component({
  name: 'root',
  submorphs: [part(Card, {
    name: 'card instance',
    submorphs: [{ name: 'label', submorphs: [] }]
  })]
});`;
    const root = {
      id: 'runtime-root', name: 'root', owner: null,
      env: { undoManager: new UndoManager() }
    };
    const card = { id: 'runtime-card', name: 'card instance', owner: root };
    const label = { id: 'runtime-label', name: 'label', owner: card, submorphs: [] };
    const icon = { id: 'runtime-icon', name: 'icon', owner: null, submorphs: [] };
    root.submorphs = [card];
    card.submorphs = [label];
    const cardDescriptor = {
      isComponentDescriptor: true,
      stylePolicy: {
        asBuildSpec: () => ({
          name: 'card',
          submorphs: [{ name: 'label', submorphs: [{ name: 'icon' }] }]
        })
      }
    };
    cardDescriptor[Symbol.for('lively-module-meta')] = {
      moduleId: 'local://nested-removal/card.cp.js',
      exportedName: 'Card'
    };
    const tracker = Object.create(ComponentChangeTracker.prototype);
    tracker.trackedComponent = root;
    tracker.componentModuleId = 'local://nested-removal/component.cp.js';
    tracker.componentModule = {
      _source: source,
      recorder: { Card: cardDescriptor },
      setSource (nextSource) { this._source = nextSource; }
    };
    tracker.componentDescriptor = {
      componentName: 'Example',
      stylePolicy: { _dependants: new Set() },
      makeDirty: () => {},
      refreshDependants: () => {}
    };
    tracker.committedChangeAdapter = new MorphicChangeSetAdapter({
      componentId: 'local://nested-removal/component.cp.js::Example',
      containsMorph: () => true
    });
    tracker.scheduleShadowProjectionComparison = () => null;
    const resolveMorph = id => id === root.id
      ? root
      : id === card.id ? card : id === label.id ? label : id === icon.id ? icon : null;

    const result = tracker.processCommittedChangeSet(changeSet(new MoveMorph({
      morphId: icon.id,
      from: attachedMorph({ ownerId: label.id, index: 0 }),
      to: detachedMorph()
    })), {
      legacyChanges: [{}],
      resolveMorph
    });

    expect(result.projectionalCommit).not.equals(null);
    expect(tracker.componentModule._source).includes('without("icon")');
    expect(label.submorphs).deep.equals([]);
    expect(icon.owner).equals(null);

    root.env.undoManager.undo();
    expect(tracker.componentModule._source).equals(source);
    expect(label.submorphs).deep.equals([icon]);
    expect(icon.owner).equals(label);

    root.env.undoManager.redo();
    expect(tracker.componentModule._source).includes('without("icon")');
    expect(label.submorphs).deep.equals([]);
    expect(icon.owner).equals(null);
  });

  it('cuts an eligible local child rename over with exact undo and redo', () => {
    const source = `const Example = component({
  name: 'root',
  submorphs: [{ name: 'before' }]
});`;
    const root = {
      id: 'runtime-root', name: 'root', owner: null,
      env: { undoManager: new UndoManager() }
    };
    const child = { id: 'runtime-child', name: 'after', owner: root };
    root.submorphs = [child];
    const tracker = Object.create(ComponentChangeTracker.prototype);
    tracker.trackedComponent = root;
    tracker.componentModuleId = 'local://rename-cutover/component.cp.js';
    tracker.componentModule = {
      _source: source,
      setSource (nextSource) { this._source = nextSource; }
    };
    const policySpec = {
      name: 'root',
      submorphs: [{ name: 'before' }]
    };
    tracker.componentDescriptor = {
      componentName: 'Example',
      stylePolicy: { spec: policySpec, _dependants: new Set() },
      makeDirty: () => {},
      refreshDependants: () => {}
    };
    tracker.committedChangeAdapter = new MorphicChangeSetAdapter({
      componentId: 'local://rename-cutover/component.cp.js::Example',
      containsMorph: () => true
    });
    tracker.scheduleShadowProjectionComparison = () => null;

    const result = tracker.processCommittedChangeSet(changeSet(new SetMorphProperty({
      targetId: child.id,
      property: 'name',
      before: 'before',
      after: 'after'
    })), {
      legacyChanges: [{}],
      resolveMorph: id => id === child.id ? child : id === root.id ? root : null
    });

    expect(result.projectionalCommit).not.equals(null);
    expect(tracker.lastShadowCommandBatch).not.haveOwnProperty('renameDiagnostic');
    expect(tracker.componentModule._source).includes('name: "after"');
    expect(child.name).equals('after');
    expect(policySpec.submorphs[0].name).equals('after');

    root.env.undoManager.undo();
    expect(tracker.componentModule._source).equals(source);
    expect(child.name).equals('before');
    expect(policySpec.submorphs[0].name).equals('before');

    root.env.undoManager.redo();
    expect(tracker.componentModule._source).includes('name: "after"');
    expect(child.name).equals('after');
    expect(policySpec.submorphs[0].name).equals('after');
  });

  it('cuts modeled owner-layout renames over with exact runtime undo and redo', () => {
    class LayoutState {
      constructor (resizePolicies) {
        this.config = { resizePolicies };
      }

      copy () {
        return new LayoutState(this.config.resizePolicies.map(([name, policy]) =>
          [name, { ...policy }]));
      }

      handleRenamingOf (before, after) {
        this.config.resizePolicies = this.config.resizePolicies.map(([name, policy]) =>
          [name === before ? after : name, policy]);
      }
    }

    const source = `const Example = component({
  name: 'root',
  layout: new TilingLayout({
    resizePolicies: [['before', { height: 'fixed', width: 'fill' }]]
  }),
  submorphs: [{ name: 'before' }]
});`;
    const root = {
      id: 'runtime-root', name: 'root', owner: null,
      layout: new LayoutState([['before', { height: 'fixed', width: 'fill' }]]),
      env: { undoManager: new UndoManager() }
    };
    const child = { id: 'runtime-child', name: 'after', owner: root };
    root.submorphs = [child];
    let refreshCount = 0;
    const tracker = Object.create(ComponentChangeTracker.prototype);
    tracker.trackedComponent = root;
    tracker.componentModuleId = 'local://layout-rename-cutover/component.cp.js';
    tracker.componentModule = {
      _source: source,
      setSource (nextSource) { this._source = nextSource; }
    };
    tracker.componentDescriptor = {
      componentName: 'Example',
      stylePolicy: {
        spec: {
          name: 'root',
          layout: new LayoutState([
            ['before', { height: 'fixed', width: 'fill' }]
          ]),
          submorphs: []
        },
        _dependants: new Set()
      },
      makeDirty: () => {},
      refreshDependants: () => { refreshCount++; }
    };
    tracker.committedChangeAdapter = new MorphicChangeSetAdapter({
      componentId: 'local://layout-rename-cutover/component.cp.js::Example',
      containsMorph: () => true
    });
    tracker.scheduleShadowProjectionComparison = () => null;
    const resolveMorph = id => id === child.id ? child : id === root.id ? root : null;

    const result = tracker.processCommittedChangeSet(changeSet(new SetMorphProperty({
      targetId: child.id,
      property: 'name',
      before: 'before',
      after: 'after'
    })), { legacyChanges: [{}], resolveMorph });

    expect(result.projectionalCommit).not.equals(null);
    expect(tracker.lastShadowCommandBatch).not.haveOwnProperty('renameDiagnostic');
    expect(tracker.componentModule._source).includes('["after",');
    expect(root.layout.config.resizePolicies[0][0]).equals('after');
    expect(tracker.componentDescriptor.stylePolicy.spec.layout
      .config.resizePolicies[0][0]).equals('after');
    expect(tracker.componentDescriptor.stylePolicy.spec.submorphs)
      .deep.equals([{ name: 'after' }]);
    expect(refreshCount).equals(0);

    root.env.undoManager.undo();
    expect(tracker.componentModule._source).equals(source);
    expect(child.name).equals('before');
    expect(root.layout.config.resizePolicies[0][0]).equals('before');
    expect(tracker.componentDescriptor.stylePolicy.spec.layout
      .config.resizePolicies[0][0]).equals('before');
    expect(tracker.componentDescriptor.stylePolicy.spec.submorphs).deep.equals([]);
    expect(refreshCount).equals(0);

    root.env.undoManager.redo();
    expect(tracker.componentModule._source).includes('["after",');
    expect(child.name).equals('after');
    expect(root.layout.config.resizePolicies[0][0]).equals('after');
    expect(tracker.componentDescriptor.stylePolicy.spec.layout
      .config.resizePolicies[0][0]).equals('after');
    expect(tracker.componentDescriptor.stylePolicy.spec.submorphs)
      .deep.equals([{ name: 'after' }]);
    expect(refreshCount).equals(0);
  });

  it('repairs an unresolved materialized policy path transactionally during rename', () => {
    const source = `const Example = component({
  name: 'root',
  submorphs: [{ name: 'before' }]
});`;
    const root = {
      id: 'runtime-root', name: 'root', owner: null,
      env: { undoManager: new UndoManager() }
    };
    const child = { id: 'runtime-child', name: 'after', owner: root };
    root.submorphs = [child];
    const tracker = Object.create(ComponentChangeTracker.prototype);
    tracker.trackedComponent = root;
    tracker.componentModuleId = 'local://policy-cache-recovery/component.cp.js';
    tracker.componentModule = {
      _source: source,
      setSource (nextSource) { this._source = nextSource; }
    };
    tracker.componentDescriptor = {
      componentName: 'Example',
      stylePolicy: {
        spec: { name: 'root', submorphs: [{ name: 'different' }] },
        _dependants: new Set()
      },
      makeDirty: () => {},
      refreshDependants: () => {}
    };
    tracker.committedChangeAdapter = new MorphicChangeSetAdapter({
      componentId: 'local://policy-cache-recovery/component.cp.js::Example',
      containsMorph: () => true
    });
    tracker.scheduleShadowProjectionComparison = () => null;

    const result = tracker.processCommittedChangeSet(changeSet(new SetMorphProperty({
      targetId: child.id,
      property: 'name',
      before: 'before',
      after: 'after'
    })), {
      legacyChanges: [{}],
      resolveMorph: id => id === child.id ? child : id === root.id ? root : null
    });

    expect(result.projectionalCommit).not.equals(null);
    expect(tracker.lastShadowCommandBatch).not.haveOwnProperty('renameDiagnostic');
    expect(tracker.componentModule._source).includes('name: "after"');
    expect(tracker.componentDescriptor.stylePolicy.spec.submorphs.map(({ name }) => name))
      .deep.equals(['different', 'after']);

    root.env.undoManager.undo();
    expect(tracker.componentModule._source).equals(source);
    expect(child.name).equals('before');
    expect(tracker.componentDescriptor.stylePolicy.spec.submorphs.map(({ name }) => name))
      .deep.equals(['different']);

    root.env.undoManager.redo();
    expect(tracker.componentModule._source).includes('name: "after"');
    expect(child.name).equals('after');
    expect(tracker.componentDescriptor.stylePolicy.spec.submorphs.map(({ name }) => name))
      .deep.equals(['different', 'after']);
  });

  it('repairs an unresolved materialized policy path transactionally during scalar edits', () => {
    const source = `const Example = component({
  name: 'root',
  submorphs: [{ name: 'child', fill: 'red' }]
});`;
    const root = {
      id: 'runtime-root', name: 'root', owner: null,
      env: { undoManager: new UndoManager() }
    };
    const child = { id: 'runtime-child', name: 'child', fill: 'green', owner: root };
    root.submorphs = [child];
    const tracker = Object.create(ComponentChangeTracker.prototype);
    tracker.trackedComponent = root;
    tracker.componentModuleId = 'local://policy-cache-property-recovery/component.cp.js';
    tracker.componentModule = {
      _source: source,
      setSource (nextSource) { this._source = nextSource; }
    };
    tracker.componentDescriptor = {
      componentName: 'Example',
      stylePolicy: {
        spec: { name: 'root', submorphs: [{ name: 'different' }] },
        _dependants: new Set()
      },
      makeDirty: () => {},
      refreshDependants: () => {}
    };
    tracker.committedChangeAdapter = new MorphicChangeSetAdapter({
      componentId: 'local://policy-cache-property-recovery/component.cp.js::Example',
      containsMorph: () => true
    });
    tracker.scheduleShadowProjectionComparison = () => null;

    const result = tracker.processCommittedChangeSet(changeSet(new SetMorphProperty({
      targetId: child.id,
      property: 'fill',
      before: 'red',
      after: 'green'
    })), {
      legacyChanges: [{}],
      resolveMorph: id => id === child.id ? child : id === root.id ? root : null
    });

    expect(result.projectionalCommit).not.equals(null);
    expect(tracker.componentModule._source).includes('fill: "green"');
    expect(tracker.componentDescriptor.stylePolicy.spec.submorphs)
      .deep.equals([{ name: 'different' }, { name: 'child', fill: 'green' }]);

    root.env.undoManager.undo();
    expect(tracker.componentModule._source).equals(source);
    expect(child.fill).equals('red');
    expect(tracker.componentDescriptor.stylePolicy.spec.submorphs)
      .deep.equals([{ name: 'different' }]);

    root.env.undoManager.redo();
    expect(child.fill).equals('green');
    expect(tracker.componentDescriptor.stylePolicy.spec.submorphs)
      .deep.equals([{ name: 'different' }, { name: 'child', fill: 'green' }]);
  });

  it('commits the base rename when a registered dependant is unresolvable', () => {
    const source = `const Example = component({
  name: 'root',
  submorphs: [{ name: 'before' }]
});`;
    const root = {
      id: 'runtime-root', name: 'root', owner: null,
      env: { undoManager: new UndoManager() }
    };
    const child = { id: 'runtime-child', name: 'after', owner: root };
    root.submorphs = [child];
    const tracker = Object.create(ComponentChangeTracker.prototype);
    tracker.trackedComponent = root;
    tracker.componentModuleId = 'local://rename-cutover/component.cp.js';
    tracker.componentModule = {
      _source: source,
      setSource (nextSource) { this._source = nextSource; }
    };
    tracker.componentDescriptor = {
      componentName: 'Example',
      stylePolicy: { _dependants: new Set(['derived-policy']) },
      makeDirty: () => {},
      refreshDependants: () => {}
    };
    tracker.committedChangeAdapter = new MorphicChangeSetAdapter({
      componentId: 'local://rename-cutover/component.cp.js::Example',
      containsMorph: () => true
    });
    tracker.scheduleShadowProjectionComparison = () => null;

    const result = tracker.processCommittedChangeSet(changeSet(new SetMorphProperty({
      targetId: child.id,
      property: 'name',
      before: 'before',
      after: 'after'
    })), {
      legacyChanges: [{}],
      resolveMorph: id => id === child.id ? child : id === root.id ? root : null
    });

    expect(result.projectionalCommit).not.equals(null);
    expect(tracker.lastShadowCommandBatch).not.haveOwnProperty('renameDiagnostic');
    expect(tracker.componentModule._source).includes('name: "after"');

    root.env.undoManager.undo();
    expect(tracker.componentModule._source).equals(source);
    expect(child.name).equals('before');

    root.env.undoManager.redo();
    expect(tracker.componentModule._source).includes('name: "after"');
    expect(child.name).equals('after');
  });

  it('commits a local rename and its derived module propagation with exact undo and redo', () => {
    const source = `const Example = component({
  name: 'root',
  submorphs: [{ name: 'before' }]
});`;
    const derivedSource = `const Derived = component(Example, {
  name: 'derived',
  submorphs: [{ name: 'before', fill: 'red' }]
});`;
    const derivedSourceAfter = derivedSource.replace("name: 'before'", 'name: "after"');
    const root = {
      id: 'runtime-root', name: 'root', owner: null,
      env: { undoManager: new UndoManager() }
    };
    const child = { id: 'runtime-child', name: 'after', owner: root };
    const derivedChild = { id: 'derived-runtime-child', name: 'before' };
    root.submorphs = [child];
    const baseModule = {
      id: 'local://rename-cutover/component.cp.js',
      _source: source,
      setSource (nextSource) { this._source = nextSource; }
    };
    const derivedModule = {
      id: 'local://rename-cutover/derived.cp.js',
      _source: derivedSource,
      setSource (nextSource) { this._source = nextSource; }
    };
    const modules = new Map([
      [baseModule.id, baseModule],
      [derivedModule.id, derivedModule]
    ]);
    const tracker = Object.create(ComponentChangeTracker.prototype);
    tracker.trackedComponent = root;
    tracker.componentModuleId = baseModule.id;
    tracker.componentModule = baseModule;
    tracker.componentDescriptor = {
      componentName: 'Example',
      stylePolicy: { _dependants: new Set(['derived-policy']) },
      makeDirty: () => {},
      refreshDependants: () => {}
    };
    tracker.projectionalModuleForId = moduleId => modules.get(moduleId);
    tracker.prepareProjectionalDerivedRename = () => Object.freeze({
      supported: true,
      components: Object.freeze([]),
      modules: Object.freeze([Object.freeze({
        moduleId: derivedModule.id,
        sourceBefore: derivedSource,
        sourceAfter: derivedSourceAfter
      })]),
      runtimeRenames: Object.freeze([Object.freeze({
        id: `${derivedModule.id}#Derived:target`,
        beforeName: 'before',
        afterName: 'after',
        target: derivedChild
      })]),
      diagnostics: Object.freeze([])
    });
    tracker.committedChangeAdapter = new MorphicChangeSetAdapter({
      componentId: 'local://rename-cutover/component.cp.js::Example',
      containsMorph: () => true
    });
    tracker.scheduleShadowProjectionComparison = () => null;

    const result = tracker.processCommittedChangeSet(changeSet(new SetMorphProperty({
      targetId: child.id,
      property: 'name',
      before: 'before',
      after: 'after'
    })), {
      legacyChanges: [{}],
      resolveMorph: id => id === child.id ? child : id === root.id ? root : null
    });

    expect(result.projectionalCommit).not.equals(null);
    expect(tracker.lastShadowCommandBatch).not.haveOwnProperty('renameDiagnostic');
    expect(baseModule._source).includes('name: "after"');
    expect(derivedModule._source).equals(derivedSourceAfter);
    expect(derivedChild.name).equals('after');

    root.env.undoManager.undo();
    expect(baseModule._source).equals(source);
    expect(derivedModule._source).equals(derivedSource);
    expect(child.name).equals('before');
    expect(derivedChild.name).equals('before');

    root.env.undoManager.redo();
    expect(baseModule._source).includes('name: "after"');
    expect(derivedModule._source).equals(derivedSourceAfter);
    expect(child.name).equals('after');
    expect(derivedChild.name).equals('after');
  });

  it('allows derived-document renames while retaining owner-layout guards', () => {
    const target = { id: 'runtime-child', owner: { layout: null } };
    const tracker = Object.create(ComponentChangeTracker.prototype);
    tracker.trackedComponent = { id: 'runtime-root' };
    tracker.componentDescriptor = { stylePolicy: { _dependants: new Set() } };
    const batch = parentComponent => ({
      commands: [{ kind: ComponentBridgeCommandKind.RENAME_NODE, nodeId: target.id }],
      shadowProjection: {
        supported: true,
        beforeDocument: { parentComponent }
      }
    });
    const context = { resolveMorph: () => target };

    expect(tracker.projectionalRenameDiagnostic(batch({ expression: 'Base' }), context))
      .equals(null);

    target.owner.layout = {};
    expect(tracker.projectionalRenameDiagnostic(batch(null), context).kind)
      .equals(ProjectionalRenameDiagnosticKind.OWNER_LAYOUT);
  });

  it('allows a rename under a modeled layout that does not reference the target', () => {
    const target = { id: 'runtime-child', owner: { layout: {} } };
    const beforeDocument = new ComponentDocument({
      componentId: 'component',
      moduleId: 'local://modeled-layout-rename/component.cp.js',
      exportName: 'Example',
      root: new ComponentNode({
        id: 'root',
        name: 'root',
        provenance: localNodeProvenance(),
        children: [new ComponentNode({
          id: 'child',
          name: 'before',
          provenance: localNodeProvenance()
        })]
      }),
      layoutModels: [tilingLayoutModel({
        ownerId: 'root',
        expressionTemplate: 'new TilingLayout({ spacing: 2 })',
        references: []
      })]
    });
    const tracker = Object.create(ComponentChangeTracker.prototype);
    const batch = {
      commands: [{ kind: ComponentBridgeCommandKind.RENAME_NODE, nodeId: target.id }],
      shadowProjection: {
        supported: true,
        beforeDocument,
        steps: [{
          componentCommand: { nodeId: 'child' },
          runtimeProjection: { changeSet: { operations: [] } }
        }]
      }
    };

    expect(tracker.projectionalRenameDiagnostic(batch, {
      resolveMorph: () => target
    })).equals(null);
  });

  it('allows a rename under a non-referencing constraint layout', () => {
    const target = { id: 'runtime-child', owner: { layout: {} } };
    const beforeDocument = new ComponentDocument({
      componentId: 'component',
      moduleId: 'local://constraint-layout-rename/component.cp.js',
      exportName: 'Example',
      root: new ComponentNode({
        id: 'root',
        name: 'root',
        provenance: localNodeProvenance(),
        properties: {
          layout: opaqueProperty(
            'new ConstraintLayout({ submorphSettings: [] })'
          )
        },
        children: [new ComponentNode({
          id: 'child',
          name: 'before',
          provenance: localNodeProvenance()
        })]
      })
    });
    const tracker = Object.create(ComponentChangeTracker.prototype);
    const batch = {
      commands: [{ kind: ComponentBridgeCommandKind.RENAME_NODE, nodeId: target.id }],
      shadowProjection: {
        supported: true,
        beforeDocument,
        steps: [{
          componentCommand: { nodeId: 'child' },
          runtimeProjection: { changeSet: { operations: [] } }
        }]
      }
    };

    expect(tracker.projectionalRenameDiagnostic(batch, {
      resolveMorph: () => target
    })).equals(null);
  });

  it('cuts a direct derived scalar edit over across source, runtime, and policy cache', () => {
    const source = `const Derived = component(Base, {
  name: 'derived',
  fill: 'red'
});`;
    let fill = 'green';
    let runtimeWrites = 0;
    const root = {
      id: 'runtime-root', name: 'derived', owner: null,
      env: { undoManager: new UndoManager() }
    };
    Object.defineProperty(root, 'fill', {
      configurable: true,
      enumerable: true,
      get: () => fill,
      set: value => { runtimeWrites++; fill = value; }
    });
    root.submorphs = [];
    const tracker = Object.create(ComponentChangeTracker.prototype);
    tracker.trackedComponent = root;
    tracker.componentModuleId = 'local://derived-scalar-cutover/component.cp.js';
    tracker.componentModule = {
      _source: source,
      setSource (nextSource) { this._source = nextSource; }
    };
    tracker.componentDescriptor = {
      componentName: 'Derived',
      stylePolicy: {
        parent: { isPolicy: true },
        spec: { name: 'derived', fill: 'red' },
        _dependants: new Set()
      },
      makeDirty: () => {},
      refreshDependants: () => {}
    };
    tracker.committedChangeAdapter = new MorphicChangeSetAdapter({
      componentId: 'local://derived-scalar-cutover/component.cp.js::Derived',
      containsMorph: () => true
    });
    tracker.scheduleShadowProjectionComparison = () => null;

    const result = tracker.processCommittedChangeSet(changeSet(new SetMorphProperty({
      targetId: root.id,
      property: 'fill',
      before: 'red',
      after: 'green'
    })), {
      legacyChanges: [{}],
      resolveMorph: id => id === root.id ? root : null
    });

    expect(result.projectionalCommit).not.equals(null);
    expect(tracker.componentModule._source).includes('fill: "green"');
    expect(fill).equals('green');
    expect(runtimeWrites).equals(0);
    expect(tracker.componentDescriptor.stylePolicy.spec.fill).equals('green');

    root.env.undoManager.undo();
    expect(tracker.componentModule._source).equals(source);
    expect(fill).equals('red');
    expect(tracker.componentDescriptor.stylePolicy.spec.fill).equals('red');

    root.env.undoManager.redo();
    expect(tracker.componentModule._source).includes('fill: "green"');
    expect(fill).equals('green');
    expect(tracker.componentDescriptor.stylePolicy.spec.fill).equals('green');
  });

  it('cuts a direct derived master edit over across source, runtime, and policy cache', () => {
    class SerializableMaster {
      getConfigAsExpression () {
        return {
          __expr__: 'HoverMaster',
          bindings: { 'local://masters.js': ['HoverMaster'] }
        };
      }
    }
    class SerializableBaseMaster {
      getConfigAsExpression () {
        return { __expr__: 'BaseMaster', bindings: {} };
      }
    }
    const previousMaster = new SerializableBaseMaster();
    const nextMaster = new SerializableMaster();
    const source = `const Derived = component(Base, {
  name: 'derived',
  master: BaseMaster
});`;
    const root = {
      id: 'runtime-root', name: 'derived', master: nextMaster, owner: null,
      submorphs: [], env: { undoManager: new UndoManager() }
    };
    const tracker = Object.create(ComponentChangeTracker.prototype);
    tracker.trackedComponent = root;
    tracker.componentModuleId = 'local://derived-master-cutover/component.cp.js';
    tracker.componentModule = {
      _source: source,
      setSource (nextSource) { this._source = nextSource; }
    };
    tracker.componentDescriptor = {
      componentName: 'Derived',
      stylePolicy: {
        parent: {
          isPolicy: true,
          asBuildSpec: () => ({ name: 'base', submorphs: [] })
        },
        spec: { name: 'derived', master: previousMaster },
        _dependants: new Set()
      },
      makeDirty: () => {},
      refreshDependants: () => {}
    };
    tracker.committedChangeAdapter = new MorphicChangeSetAdapter({
      componentId: 'local://derived-master-cutover/component.cp.js::Derived',
      containsMorph: () => true
    });
    tracker.scheduleShadowProjectionComparison = () => null;

    const result = tracker.processCommittedChangeSet(changeSet(new SetMorphProperty({
      targetId: root.id,
      property: 'master',
      before: previousMaster,
      after: nextMaster
    })), {
      legacyChanges: [{}],
      resolveMorph: id => id === root.id ? root : null
    });

    expect(result.projectionalCommit).not.equals(null);
    expect(tracker.componentModule._source)
      .includes('import { HoverMaster } from "local://masters.js";');
    expect(tracker.componentModule._source).includes('master: HoverMaster');
    expect(root.master, 'runtime after commit').equals(nextMaster);
    expect(tracker.componentDescriptor.stylePolicy.spec.master, 'policy after commit')
      .equals(nextMaster);

    root.env.undoManager.undo();
    expect(tracker.componentModule._source).equals(source);
    expect(root.master, 'runtime after undo').equals(previousMaster);
    expect(tracker.componentDescriptor.stylePolicy.spec.master, 'policy after undo')
      .equals(previousMaster);

    root.env.undoManager.redo();
    expect(tracker.componentModule._source).includes('master: HoverMaster');
    expect(root.master, 'runtime after redo').equals(nextMaster);
    expect(tracker.componentDescriptor.stylePolicy.spec.master, 'policy after redo')
      .equals(nextMaster);
  });

  it('cuts a direct derived layout replacement over with refreshed layout semantics', () => {
    class SerializableLayout {
      __serialize__ () {
        return {
          __expr__: `new TilingLayout({
  resizePolicies: [['child', { height: 'fixed', width: 'fill' }]]
})`,
          bindings: { 'lively.morphic': ['TilingLayout'] }
        };
      }
    }
    const nextLayout = new SerializableLayout();
    const source = `const Derived = component(Base, {
  name: 'derived',
  layout: null
});`;
    const root = {
      id: 'runtime-root', name: 'derived', layout: nextLayout, owner: null,
      env: { undoManager: new UndoManager() }
    };
    const child = {
      id: 'runtime-child', name: 'child', owner: root, submorphs: []
    };
    root.submorphs = [child];
    const tracker = Object.create(ComponentChangeTracker.prototype);
    tracker.trackedComponent = root;
    tracker.componentModuleId = 'local://derived-layout-cutover/component.cp.js';
    tracker.componentModule = {
      _source: source,
      setSource (nextSource) { this._source = nextSource; }
    };
    tracker.componentDescriptor = {
      componentName: 'Derived',
      stylePolicy: {
        parent: {
          isPolicy: true,
          asBuildSpec: () => ({
            name: 'base',
            submorphs: [{ name: 'child' }]
          })
        },
        spec: { name: 'derived', layout: null },
        _dependants: new Set()
      },
      makeDirty: () => {},
      refreshDependants: () => {}
    };
    tracker.committedChangeAdapter = new MorphicChangeSetAdapter({
      componentId: 'local://derived-layout-cutover/component.cp.js::Derived',
      containsMorph: () => true
    });
    tracker.scheduleShadowProjectionComparison = () => null;

    const result = tracker.processCommittedChangeSet(changeSet(new SetMorphProperty({
      targetId: root.id,
      property: 'layout',
      before: null,
      after: nextLayout
    })), {
      legacyChanges: [{}],
      resolveMorph: id => id === root.id ? root : id === child.id ? child : null
    });

    expect(result.projectionalCommit,
      JSON.stringify(result.shadowProjection?.diagnostics || [])).not.equals(null);
    expect(tracker.componentModule._source)
      .includes('import { TilingLayout } from "lively.morphic";');
    expect(tracker.componentModule._source).includes("resizePolicies: [['child'");
    expect(tracker._projectionalDocument.layoutModels).length(1);
    expect(root.layout).equals(nextLayout);
    expect(tracker.componentDescriptor.stylePolicy.spec.layout).equals(nextLayout);

    root.env.undoManager.undo();
    expect(tracker.componentModule._source).equals(source);
    expect(root.layout).equals(null);
    expect(tracker.componentDescriptor.stylePolicy.spec.layout).equals(null);

    root.env.undoManager.redo();
    expect(tracker.componentModule._source).includes("resizePolicies: [['child'");
    expect(root.layout).equals(nextLayout);
    expect(tracker.componentDescriptor.stylePolicy.spec.layout).equals(nextLayout);
  });

  it('cuts a directly added derived child rename over using the actual parent policy', () => {
    const source = `const Derived = component(Base, {
  name: 'derived',
  submorphs: [add({ name: 'before', fill: 'red' })]
});`;
    const root = {
      id: 'runtime-root', name: 'derived', owner: null,
      env: { undoManager: new UndoManager() }
    };
    const child = {
      id: 'runtime-child', name: 'after', fill: 'red', owner: root,
      submorphs: []
    };
    root.submorphs = [child];
    const policyChild = { name: 'before', fill: 'red' };
    const tracker = Object.create(ComponentChangeTracker.prototype);
    tracker.trackedComponent = root;
    tracker.componentModuleId = 'local://derived-rename-cutover/component.cp.js';
    tracker.componentModule = {
      _source: source,
      setSource (nextSource) { this._source = nextSource; }
    };
    tracker.componentDescriptor = {
      componentName: 'Derived',
      stylePolicy: {
        parent: {
          isPolicy: true,
          asBuildSpec: () => ({ name: 'base', submorphs: [] })
        },
        spec: {
          name: 'derived',
          submorphs: [{ COMMAND: 'add', props: policyChild }]
        },
        _dependants: new Set()
      },
      makeDirty: () => {},
      refreshDependants: () => {}
    };
    tracker.committedChangeAdapter = new MorphicChangeSetAdapter({
      componentId: 'local://derived-rename-cutover/component.cp.js::Derived',
      containsMorph: () => true
    });
    tracker.scheduleShadowProjectionComparison = () => null;
    const resolveMorph = id => id === root.id ? root : id === child.id ? child : null;

    const result = tracker.processCommittedChangeSet(changeSet(new SetMorphProperty({
      targetId: child.id,
      property: 'name',
      before: 'before',
      after: 'after'
    })), {
      legacyChanges: [{}],
      resolveMorph
    });

    expect(result.projectionalCommit).not.equals(null);
    expect(tracker.lastShadowCommandBatch).not.haveOwnProperty('renameDiagnostic');
    expect(tracker.componentModule._source).includes('name: "after"');
    expect(child.name).equals('after');
    expect(policyChild.name).equals('after');

    root.env.undoManager.undo();
    expect(tracker.componentModule._source).equals(source);
    expect(child.name).equals('before');
    expect(policyChild.name).equals('before');

    root.env.undoManager.redo();
    expect(tracker.componentModule._source).includes('name: "after"');
    expect(child.name).equals('after');
    expect(policyChild.name).equals('after');
  });

  it('cuts an inherited derived child rename over through replace selectors', () => {
    const source = `const Derived = component(Base, {
  name: 'derived',
  submorphs: [{ name: 'before', fill: 'red' }]
});`;
    const root = {
      id: 'runtime-root', name: 'derived', owner: null,
      env: { undoManager: new UndoManager() }
    };
    const child = {
      id: 'runtime-child', name: 'after', fill: 'red', owner: root,
      submorphs: []
    };
    root.submorphs = [child];
    const policyChild = { name: 'before', fill: 'red' };
    const tracker = Object.create(ComponentChangeTracker.prototype);
    tracker.trackedComponent = root;
    tracker.componentModuleId = 'local://derived-inherited-rename/component.cp.js';
    tracker.componentModule = {
      _source: source,
      setSource (nextSource) { this._source = nextSource; }
    };
    tracker.componentDescriptor = {
      componentName: 'Derived',
      stylePolicy: {
        parent: {
          isPolicy: true,
          asBuildSpec: () => ({
            name: 'base',
            submorphs: [{ name: 'before' }]
          })
        },
        spec: {
          name: 'derived',
          submorphs: [policyChild]
        },
        _dependants: new Set()
      },
      makeDirty: () => {},
      refreshDependants: () => {}
    };
    tracker.committedChangeAdapter = new MorphicChangeSetAdapter({
      componentId: 'local://derived-inherited-rename/component.cp.js::Derived',
      containsMorph: () => true
    });
    tracker.scheduleShadowProjectionComparison = () => null;
    const resolveMorph = id => id === root.id ? root : id === child.id ? child : null;

    const result = tracker.processCommittedChangeSet(changeSet(new SetMorphProperty({
      targetId: child.id,
      property: 'name',
      before: 'before',
      after: 'after'
    })), {
      legacyChanges: [{}],
      resolveMorph
    });

    expect(result.projectionalCommit).not.equals(null);
    expect(tracker.lastShadowCommandBatch).not.haveOwnProperty('renameDiagnostic');
    expect(tracker.componentModule._source)
      .includes('import { replace } from "lively.morphic/components/core.js";');
    expect(tracker.componentModule._source)
      .includes(`replace("before", { name: "after", fill: 'red' })`);
    expect(child.name).equals('after');
    expect(policyChild.name).equals('after');

    root.env.undoManager.undo();
    expect(tracker.componentModule._source).equals(source);
    expect(child.name).equals('before');
    expect(policyChild.name).equals('before');

    root.env.undoManager.redo();
    expect(tracker.componentModule._source)
      .includes(`replace("before", { name: "after", fill: 'red' })`);
    expect(child.name).equals('after');
    expect(policyChild.name).equals('after');
  });

  it('cuts a direct derived introduction over as an explicit add', () => {
    const source = `const Derived = component(Base, {
  name: 'derived',
  submorphs: []
});`;
    const root = {
      id: 'runtime-root', name: 'derived', owner: null,
      env: { undoManager: new UndoManager() }
    };
    const introduced = {
      id: 'runtime-introduced', name: 'introduced', fill: 'green', owner: root,
      spec: () => ({ name: 'introduced', fill: 'green', submorphs: [] })
    };
    root.submorphs = [introduced];
    const tracker = Object.create(ComponentChangeTracker.prototype);
    tracker.trackedComponent = root;
    tracker.componentModuleId = 'local://derived-introduction-cutover/component.cp.js';
    tracker.componentModule = {
      _source: source,
      setSource (nextSource) { this._source = nextSource; }
    };
    tracker.componentDescriptor = {
      componentName: 'Derived',
      stylePolicy: {
        parent: {
          isPolicy: true,
          asBuildSpec: () => ({ name: 'base', submorphs: [] })
        },
        _dependants: new Set()
      },
      makeDirty: () => {},
      refreshDependants: () => {}
    };
    tracker.committedChangeAdapter = new MorphicChangeSetAdapter({
      componentId: 'local://derived-introduction-cutover/component.cp.js::Derived',
      containsMorph: () => true
    });
    tracker.scheduleShadowProjectionComparison = () => null;
    const resolveMorph = id => id === root.id
      ? root
      : id === introduced.id ? introduced : null;

    const result = tracker.processCommittedChangeSet(changeSet(new MoveMorph({
      morphId: introduced.id,
      from: detachedMorph(),
      to: attachedMorph({ ownerId: root.id, index: 0 })
    })), {
      legacyChanges: [{}],
      resolveMorph
    });

    expect(result.projectionalCommit).not.equals(null);
    expect(tracker.componentModule._source)
      .includes('add({ name: "introduced", fill: "green" })');
    expect(root.submorphs).deep.equals([introduced]);

    root.env.undoManager.undo();
    expect(tracker.componentModule._source).equals(source);
    expect(root.submorphs).deep.equals([]);

    root.env.undoManager.redo();
    expect(tracker.componentModule._source)
      .includes('add({ name: "introduced", fill: "green" })');
    expect(root.submorphs).deep.equals([introduced]);
  });

  it('cuts removal of a directly added derived child over exactly', () => {
    const source = `const Derived = component(Base, {
  name: 'derived',
  submorphs: [add({ name: 'removed', fill: 'red' })]
});`;
    const root = {
      id: 'runtime-root', name: 'derived', owner: null,
      submorphs: [], env: { undoManager: new UndoManager() }
    };
    const removed = {
      id: 'runtime-removed', name: 'removed', fill: 'red', owner: null,
      submorphs: []
    };
    const tracker = Object.create(ComponentChangeTracker.prototype);
    tracker.trackedComponent = root;
    tracker.componentModuleId = 'local://derived-removal-cutover/component.cp.js';
    tracker.componentModule = {
      _source: source,
      setSource (nextSource) { this._source = nextSource; }
    };
    tracker.componentDescriptor = {
      componentName: 'Derived',
      stylePolicy: {
        parent: {
          isPolicy: true,
          asBuildSpec: () => ({ name: 'base', submorphs: [] })
        },
        _dependants: new Set()
      },
      makeDirty: () => {},
      refreshDependants: () => {}
    };
    tracker.committedChangeAdapter = new MorphicChangeSetAdapter({
      componentId: 'local://derived-removal-cutover/component.cp.js::Derived',
      containsMorph: () => true
    });
    tracker.scheduleShadowProjectionComparison = () => null;
    const resolveMorph = id => id === root.id ? root : id === removed.id ? removed : null;

    const result = tracker.processCommittedChangeSet(changeSet(new MoveMorph({
      morphId: removed.id,
      from: attachedMorph({ ownerId: root.id, index: 0 }),
      to: detachedMorph()
    })), {
      legacyChanges: [{}],
      resolveMorph
    });

    expect(result.projectionalCommit).not.equals(null);
    expect(tracker.componentModule._source).not.includes('name: \'removed\'');
    expect(root.submorphs).deep.equals([]);

    root.env.undoManager.undo();
    expect(tracker.componentModule._source).equals(source);
    expect(root.submorphs).deep.equals([removed]);
    expect(removed.owner).equals(root);

    root.env.undoManager.redo();
    expect(tracker.componentModule._source).not.includes('name: \'removed\'');
    expect(root.submorphs).deep.equals([]);
    expect(removed.owner).equals(null);
  });

  it('cuts an eligible final local child removal over with exact undo and redo', () => {
    const source = `const Example = component({
  name: 'root',
  submorphs: [
    { name: 'first' },
    { name: 'removed' }
  ]
});`;
    const root = {
      id: 'runtime-root', name: 'root', owner: null,
      env: { undoManager: new UndoManager() }
    };
    const first = { id: 'runtime-first', name: 'first', owner: root };
    const removed = { id: 'runtime-removed', name: 'removed', owner: null };
    const derivedRoot = { id: 'derived-runtime-root', name: 'derived', owner: null };
    const derivedRemoved = {
      id: 'derived-runtime-removed', name: 'removed', owner: derivedRoot
    };
    root.submorphs = [first];
    derivedRoot.submorphs = [derivedRemoved];
    const tracker = Object.create(ComponentChangeTracker.prototype);
    tracker.trackedComponent = root;
    tracker.componentModuleId = 'local://removal-cutover/component.cp.js';
    tracker.componentModule = {
      _source: source,
      setSource (nextSource) { this._source = nextSource; }
    };
    tracker.componentDescriptor = {
      componentName: 'Example',
      stylePolicy: { _dependants: new Set(['derived-policy']) },
      makeDirty: () => {},
      refreshDependants: () => {}
    };
    tracker.committedChangeAdapter = new MorphicChangeSetAdapter({
      componentId: 'local://removal-cutover/component.cp.js::Example',
      containsMorph: () => true
    });
    tracker.scheduleShadowProjectionComparison = () => null;
    const resolveMorph = id => id === root.id
      ? root
      : id === first.id ? first : id === removed.id ? removed : null;
    const resolveDerivedMorph = id => id === derivedRoot.id
      ? derivedRoot
      : id === derivedRemoved.id ? derivedRemoved : resolveMorph(id);
    const derivedChangeSet = new MorphicChangeSet({
      id: 'derived-removal-runtime',
      origin: 'runtime-projection',
      undoable: false,
      operations: [new MoveMorph({
        morphId: derivedRemoved.id,
        from: attachedMorph({ ownerId: derivedRoot.id, index: 0 }),
        to: detachedMorph()
      })]
    });
    tracker.prepareProjectionalDerivedStructure = () => Object.freeze({
      supported: true,
      components: Object.freeze([]),
      modules: Object.freeze([]),
      runtimeRenames: Object.freeze([]),
      runtimeStructuralProjection: Object.freeze({
        changeSet: derivedChangeSet,
        inverseChangeSet: derivedChangeSet.invert({ id: 'derived-removal-runtime:inverse' }),
        runtimeContext: tracker.runtimeProjectionContext({
          resolveMorph: resolveDerivedMorph
        })
      }),
      diagnostics: Object.freeze([])
    });

    const result = tracker.processCommittedChangeSet(changeSet(new MoveMorph({
      morphId: removed.id,
      from: attachedMorph({ ownerId: root.id, index: 1 }),
      to: detachedMorph()
    })), {
      legacyChanges: [{}],
      resolveMorph
    });

    expect(result.projectionalCommit).not.equals(null);
    expect(tracker.componentModule._source).includes("{ name: 'first' }");
    expect(tracker.componentModule._source).not.includes("{ name: 'removed' }");
    expect(root.submorphs).deep.equals([first]);
    expect(removed.owner).equals(null);
    expect(derivedRoot.submorphs).deep.equals([]);
    expect(derivedRemoved.owner).equals(null);

    root.env.undoManager.undo();
    expect(tracker.componentModule._source).equals(source);
    expect(root.submorphs).deep.equals([first, removed]);
    expect(removed.owner).equals(root);
    expect(derivedRoot.submorphs).deep.equals([derivedRemoved]);
    expect(derivedRemoved.owner).equals(derivedRoot);

    root.env.undoManager.redo();
    expect(tracker.componentModule._source).not.includes("{ name: 'removed' }");
    expect(root.submorphs).deep.equals([first]);
    expect(removed.owner).equals(null);
    expect(derivedRoot.submorphs).deep.equals([]);
    expect(derivedRemoved.owner).equals(null);
  });

  it('cuts a modeled tiling-layout removal over with exact runtime undo and redo', () => {
    const source = `const Example = component({
  name: 'root',
  layout: new TilingLayout({
    resizePolicies: [
      ['first', { height: 'fixed', width: 'fill' }],
      ['removed', { height: 'fill', width: 'fixed' }]
    ]
  }),
  submorphs: [{ name: 'first' }, { name: 'removed' }]
});`;
    const beforeLayout = new RuntimeTilingLayoutState([
      ['first', { height: 'fixed', width: 'fill' }],
      ['removed', { height: 'fill', width: 'fixed' }]
    ]);
    const root = {
      id: 'runtime-root', name: 'root', owner: null,
      layout: new RuntimeTilingLayoutState([
        ['first', { height: 'fixed', width: 'fill' }]
      ]),
      env: { undoManager: new UndoManager() }
    };
    const first = { id: 'runtime-first', name: 'first', owner: root };
    const removed = { id: 'runtime-removed', name: 'removed', owner: null };
    root.submorphs = [first];
    installLayoutAwareMorphOperations(root);
    installRemovableMorphOperation(removed);
    const tracker = Object.create(ComponentChangeTracker.prototype);
    tracker.trackedComponent = root;
    tracker.componentModuleId = 'local://layout-removal-cutover/component.cp.js';
    tracker.componentModule = {
      _source: source,
      setSource (nextSource) { this._source = nextSource; }
    };
    tracker.componentDescriptor = {
      componentName: 'Example',
      stylePolicy: {
        _dependants: new Set(),
        spec: { layout: beforeLayout }
      },
      makeDirty: () => {},
      refreshDependants: () => {}
    };
    tracker.committedChangeAdapter = new MorphicChangeSetAdapter({
      componentId: 'local://layout-removal-cutover/component.cp.js::Example',
      containsMorph: () => true
    });
    tracker.scheduleShadowProjectionComparison = () => null;
    const targets = new Map([root, first, removed].map(morph => [morph.id, morph]));

    const result = tracker.processCommittedChangeSet(changeSet(new MoveMorph({
      morphId: removed.id,
      from: attachedMorph({ ownerId: root.id, index: 1 }),
      to: detachedMorph()
    })), {
      legacyChanges: [{}],
      resolveMorph: id => targets.get(id)
    });

    expect(result.projectionalCommit).not.equals(null);
    expect(tracker.componentModule._source).not.includes("['removed',");
    expect(tracker.componentModule._source).not.includes("name: 'removed'");
    expect(root.layout.config.resizePolicies.map(([name]) => name)).deep.equals(['first']);

    root.env.undoManager.undo();
    expect(tracker.componentModule._source).equals(source);
    expect(root.submorphs).deep.equals([first, removed]);
    expect(root.layout.config.resizePolicies.map(([name]) => name))
      .deep.equals(['first', 'removed']);

    root.env.undoManager.redo();
    expect(root.submorphs).deep.equals([first]);
    expect(removed.owner).equals(null);
    expect(root.layout.config.resizePolicies.map(([name]) => name)).deep.equals(['first']);
  });

  it('cuts over removal before a surviving source-path sibling', () => {
    const source = `const Example = component({
  name: 'root',
  submorphs: [
    { name: 'removed' },
    { name: 'last' }
  ]
});`;
    const root = { id: 'runtime-root', name: 'root', owner: null };
    const removed = { id: 'runtime-removed', name: 'removed', owner: null };
    const last = { id: 'runtime-last', name: 'last', owner: root };
    root.submorphs = [last];
    const tracker = Object.create(ComponentChangeTracker.prototype);
    tracker.trackedComponent = root;
    tracker.componentModuleId = 'local://removal-cutover/component.cp.js';
    tracker.componentModule = {
      _source: source,
      setSource (nextSource) { this._source = nextSource; }
    };
    tracker.componentDescriptor = {
      componentName: 'Example',
      stylePolicy: { _dependants: new Set() }
    };
    tracker.committedChangeAdapter = new MorphicChangeSetAdapter({
      componentId: 'local://removal-cutover/component.cp.js::Example',
      containsMorph: () => true
    });
    tracker.scheduleShadowProjectionComparison = () => null;
    const resolveMorph = id => id === root.id
      ? root
      : id === removed.id ? removed : id === last.id ? last : null;

    const result = tracker.processCommittedChangeSet(changeSet(new MoveMorph({
      morphId: removed.id,
      from: attachedMorph({ ownerId: root.id, index: 0 }),
      to: detachedMorph()
    })), {
      legacyChanges: [{}],
      resolveMorph
    });

    expect(result.projectionalCommit).not.equals(null);
    expect(tracker.componentModule._source).not.includes("name: 'removed'");
    expect(tracker.componentModule._source).includes("name: 'last'");
    expect(tracker._projectionalDocument.root.children[0].id)
      .equals(`${tracker.committedChangeAdapter.componentId}:node:1`);
  });

  it('restores a directly removed child when structural source commit fails', () => {
    const source = `const Example = component({
  name: 'root',
  submorphs: [{ name: 'removed' }]
});`;
    const root = { id: 'runtime-root', name: 'root', owner: null, submorphs: [] };
    const removed = { id: 'runtime-removed', name: 'removed', owner: null };
    const sourceError = new Error('structural source cutover failed');
    const tracker = Object.create(ComponentChangeTracker.prototype);
    tracker.trackedComponent = root;
    tracker.componentModuleId = 'local://removal-cutover/component.cp.js';
    tracker.componentModule = {
      _source: source,
      setSource (nextSource) {
        if (nextSource !== source) throw sourceError;
        this._source = nextSource;
      }
    };
    tracker.componentDescriptor = {
      componentName: 'Example',
      stylePolicy: { _dependants: new Set() },
      makeDirty: () => {},
      refreshDependants: () => {}
    };
    tracker.committedChangeAdapter = new MorphicChangeSetAdapter({
      componentId: 'local://removal-cutover/component.cp.js::Example',
      containsMorph: () => true
    });
    tracker.scheduleShadowProjectionComparison = () => null;
    const resolveMorph = id => id === root.id
      ? root
      : id === removed.id ? removed : null;

    let error;
    try {
      tracker.processCommittedChangeSet(changeSet(new MoveMorph({
        morphId: removed.id,
        from: attachedMorph({ ownerId: root.id, index: 0 }),
        to: detachedMorph()
      })), {
        legacyChanges: [{}],
        resolveMorph
      });
    } catch (caughtError) {
      error = caughtError;
    }

    expect(error).equals(sourceError);
    expect(tracker.componentModule._source).equals(source);
    expect(root.submorphs).deep.equals([removed]);
    expect(removed.owner).equals(root);
  });

  it('cuts inherited removal over as suppression with exact undo and redo', () => {
    const source = `const Example = component(Base, { name: 'derived' });`;
    const root = {
      id: 'runtime-root', name: 'derived', owner: null, submorphs: [],
      env: { undoManager: new UndoManager() }
    };
    const inherited = {
      id: 'runtime-inherited', name: 'inherited child', owner: null, submorphs: []
    };
    const tracker = Object.create(ComponentChangeTracker.prototype);
    tracker.trackedComponent = root;
    tracker.componentModuleId = 'local://inherited-cutover/component.cp.js';
    tracker.componentModule = {
      _source: source,
      setSource (nextSource) { this._source = nextSource; }
    };
    tracker.componentDescriptor = {
      componentName: 'Example',
      stylePolicy: { parent: {}, _dependants: new Set() },
      makeDirty: () => {},
      refreshDependants: () => {}
    };
    tracker.committedChangeAdapter = new MorphicChangeSetAdapter({
      componentId: 'local://inherited-cutover/component.cp.js::Example',
      containsMorph: () => true
    });
    tracker.scheduleShadowProjectionComparison = () => null;
    const targets = new Map([root, inherited].map(morph => [morph.id, morph]));

    const result = tracker.processCommittedChangeSet(changeSet(new MoveMorph({
      morphId: inherited.id,
      from: attachedMorph({ ownerId: root.id, index: 0 }),
      to: detachedMorph()
    })), {
      legacyChanges: [{}],
      resolveMorph: id => targets.get(id)
    });

    expect(result.projectionalCommit).not.equals(null);
    expect(tracker.componentModule._source).includes('without("inherited child")');
    expect(root.submorphs).deep.equals([]);
    expect(inherited.owner).equals(null);

    root.env.undoManager.undo();
    expect(tracker.componentModule._source).equals(source);
    expect(root.submorphs).deep.equals([inherited]);
    expect(inherited.owner).equals(root);

    root.env.undoManager.redo();
    expect(tracker.componentModule._source).includes('without("inherited child")');
    expect(root.submorphs).deep.equals([]);
    expect(inherited.owner).equals(null);
  });

  it('cuts inherited reintroduction over as restoration with exact undo and redo', () => {
    const source = `import { without } from 'lively.morphic/components/core.js';

const Example = component(Base, {
  name: 'derived',
  submorphs: [without('inherited child')]
});`;
    const root = {
      id: 'runtime-root', name: 'derived', owner: null,
      env: { undoManager: new UndoManager() }
    };
    const inherited = {
      id: 'runtime-inherited', name: 'inherited child', owner: root, submorphs: []
    };
    root.submorphs = [inherited];
    const tracker = Object.create(ComponentChangeTracker.prototype);
    tracker.trackedComponent = root;
    tracker.componentModuleId = 'local://inherited-cutover/component.cp.js';
    tracker.componentModule = {
      _source: source,
      setSource (nextSource) { this._source = nextSource; }
    };
    tracker.componentDescriptor = {
      componentName: 'Example',
      stylePolicy: { parent: {}, _dependants: new Set() },
      makeDirty: () => {},
      refreshDependants: () => {}
    };
    tracker.committedChangeAdapter = new MorphicChangeSetAdapter({
      componentId: 'local://inherited-cutover/component.cp.js::Example',
      containsMorph: () => true
    });
    tracker.scheduleShadowProjectionComparison = () => null;
    const targets = new Map([root, inherited].map(morph => [morph.id, morph]));

    const result = tracker.processCommittedChangeSet(changeSet(new MoveMorph({
      morphId: inherited.id,
      from: detachedMorph(),
      to: attachedMorph({ ownerId: root.id, index: 0 })
    })), {
      legacyChanges: [{}],
      resolveMorph: id => targets.get(id)
    });

    expect(result.projectionalCommit).not.equals(null);
    expect(tracker.componentModule._source).not.includes("without('inherited child')");
    expect(root.submorphs).deep.equals([inherited]);

    root.env.undoManager.undo();
    expect(tracker.componentModule._source).equals(source);
    expect(root.submorphs).deep.equals([]);
    expect(inherited.owner).equals(null);

    root.env.undoManager.redo();
    expect(tracker.componentModule._source).not.includes("without('inherited child')");
    expect(root.submorphs).deep.equals([inherited]);
    expect(inherited.owner).equals(root);
  });

  it('restores an inherited node when suppression source commit fails', () => {
    const source = `const Example = component(Base, { name: 'derived' });`;
    const root = { id: 'runtime-root', name: 'derived', owner: null, submorphs: [] };
    const inherited = {
      id: 'runtime-inherited', name: 'inherited child', owner: null, submorphs: []
    };
    const sourceError = new Error('inherited suppression source cutover failed');
    const tracker = Object.create(ComponentChangeTracker.prototype);
    tracker.trackedComponent = root;
    tracker.componentModuleId = 'local://inherited-cutover/component.cp.js';
    tracker.componentModule = {
      _source: source,
      setSource (nextSource) {
        if (nextSource !== source) throw sourceError;
        this._source = nextSource;
      }
    };
    tracker.componentDescriptor = {
      componentName: 'Example',
      stylePolicy: { parent: {}, _dependants: new Set() },
      makeDirty: () => {},
      refreshDependants: () => {}
    };
    tracker.committedChangeAdapter = new MorphicChangeSetAdapter({
      componentId: 'local://inherited-cutover/component.cp.js::Example',
      containsMorph: () => true
    });
    tracker.scheduleShadowProjectionComparison = () => null;
    const targets = new Map([root, inherited].map(morph => [morph.id, morph]));

    let error;
    try {
      tracker.processCommittedChangeSet(changeSet(new MoveMorph({
        morphId: inherited.id,
        from: attachedMorph({ ownerId: root.id, index: 0 }),
        to: detachedMorph()
      })), {
        legacyChanges: [{}],
        resolveMorph: id => targets.get(id)
      });
    } catch (caughtError) {
      error = caughtError;
    }

    expect(error).equals(sourceError);
    expect(tracker.componentModule._source).equals(source);
    expect(root.submorphs).deep.equals([inherited]);
    expect(inherited.owner).equals(root);
  });

  it('cuts an eligible local sibling reorder over with exact undo and redo', () => {
    const source = `const Example = component({
  name: 'root',
  submorphs: [
    { name: 'first' },
    { name: 'second' },
    { name: 'third' }
  ]
});`;
    const root = {
      id: 'runtime-root', name: 'root', owner: null,
      env: { undoManager: new UndoManager() }
    };
    const first = { id: 'runtime-first', name: 'first', owner: root };
    const second = { id: 'runtime-second', name: 'second', owner: root };
    const third = { id: 'runtime-third', name: 'third', owner: root };
    root.submorphs = [third, first, second];
    const tracker = Object.create(ComponentChangeTracker.prototype);
    tracker.trackedComponent = root;
    tracker.componentModuleId = 'local://reorder-cutover/component.cp.js';
    tracker.componentModule = {
      _source: source,
      setSource (nextSource) { this._source = nextSource; }
    };
    tracker.componentDescriptor = {
      componentName: 'Example',
      stylePolicy: { _dependants: new Set() },
      makeDirty: () => {},
      refreshDependants: () => {}
    };
    tracker.committedChangeAdapter = new MorphicChangeSetAdapter({
      componentId: 'local://reorder-cutover/component.cp.js::Example',
      containsMorph: () => true
    });
    tracker.scheduleShadowProjectionComparison = () => null;
    const targets = new Map([root, first, second, third].map(morph => [morph.id, morph]));

    const result = tracker.processCommittedChangeSet(changeSet(new MoveMorph({
      morphId: third.id,
      from: attachedMorph({ ownerId: root.id, index: 2 }),
      to: attachedMorph({ ownerId: root.id, index: 0 })
    })), {
      legacyChanges: [{}],
      resolveMorph: id => targets.get(id)
    });

    expect(result.projectionalCommit).not.equals(null);
    expect(tracker.componentModule._source.indexOf("name: 'third'"))
      .to.be.lessThan(tracker.componentModule._source.indexOf("name: 'first'"));
    expect(root.submorphs).deep.equals([third, first, second]);

    root.env.undoManager.undo();
    expect(tracker.componentModule._source).equals(source);
    expect(root.submorphs).deep.equals([first, second, third]);

    root.env.undoManager.redo();
    expect(root.submorphs).deep.equals([third, first, second]);
  });

  it('cuts an eligible local reparent over with exact undo and redo', () => {
    const source = `const Example = component({
  name: 'root',
  submorphs: [{
    name: 'source',
    submorphs: [{ name: 'moved' }]
  }, {
    name: 'destination'
  }]
});`;
    const root = {
      id: 'runtime-root', name: 'root', owner: null,
      env: { undoManager: new UndoManager() }
    };
    const sourceParent = {
      id: 'runtime-source', name: 'source', owner: root, submorphs: []
    };
    const destination = {
      id: 'runtime-destination', name: 'destination', owner: root, submorphs: []
    };
    const moved = { id: 'runtime-moved', name: 'moved', owner: destination };
    destination.submorphs = [moved];
    root.submorphs = [sourceParent, destination];
    const tracker = Object.create(ComponentChangeTracker.prototype);
    tracker.trackedComponent = root;
    tracker.componentModuleId = 'local://reparent-cutover/component.cp.js';
    tracker.componentModule = {
      _source: source,
      setSource (nextSource) { this._source = nextSource; }
    };
    tracker.componentDescriptor = {
      componentName: 'Example',
      stylePolicy: { _dependants: new Set() },
      makeDirty: () => {},
      refreshDependants: () => {}
    };
    tracker.committedChangeAdapter = new MorphicChangeSetAdapter({
      componentId: 'local://reparent-cutover/component.cp.js::Example',
      containsMorph: () => true
    });
    tracker.scheduleShadowProjectionComparison = () => null;
    const targets = new Map([root, sourceParent, destination, moved]
      .map(morph => [morph.id, morph]));

    const result = tracker.processCommittedChangeSet(changeSet(new MoveMorph({
      morphId: moved.id,
      from: attachedMorph({ ownerId: sourceParent.id, index: 0 }),
      to: attachedMorph({ ownerId: destination.id, index: 0 })
    })), {
      legacyChanges: [{}],
      resolveMorph: id => targets.get(id)
    });

    expect(result.projectionalCommit).not.equals(null);
    expect(tracker._projectionalDocument.root.children[0].children).deep.equals([]);
    expect(tracker._projectionalDocument.root.children[1].children.map(({ name }) => name))
      .deep.equals(['moved']);
    expect(sourceParent.submorphs).deep.equals([]);
    expect(destination.submorphs).deep.equals([moved]);

    root.env.undoManager.undo();
    expect(tracker.componentModule._source).equals(source);
    expect(sourceParent.submorphs).deep.equals([moved]);
    expect(destination.submorphs).deep.equals([]);
    expect(moved.owner).equals(sourceParent);

    root.env.undoManager.redo();
    expect(sourceParent.submorphs).deep.equals([]);
    expect(destination.submorphs).deep.equals([moved]);
    expect(moved.owner).equals(destination);
  });

  it('cuts a reparent out of a modeled tiling layout over with exact undo and redo', () => {
    const source = `const Example = component({
  name: 'root',
  submorphs: [{
    name: 'source',
    layout: new TilingLayout({
      resizePolicies: [
        ['keeper', { height: 'fixed', width: 'fill' }],
        ['moved', { height: 'fill', width: 'fixed' }]
      ]
    }),
    submorphs: [{ name: 'keeper' }, { name: 'moved' }]
  }, {
    name: 'destination'
  }]
});`;
    const root = {
      id: 'runtime-root', name: 'root', owner: null,
      env: { undoManager: new UndoManager() }
    };
    const beforeLayout = new RuntimeTilingLayoutState([
      ['keeper', { height: 'fixed', width: 'fill' }],
      ['moved', { height: 'fill', width: 'fixed' }]
    ]);
    const sourceParent = {
      id: 'runtime-source', name: 'source', owner: root,
      layout: new RuntimeTilingLayoutState([
        ['keeper', { height: 'fixed', width: 'fill' }]
      ])
    };
    const destination = {
      id: 'runtime-destination', name: 'destination', owner: root, layout: null
    };
    const keeper = { id: 'runtime-keeper', name: 'keeper', owner: sourceParent };
    const moved = { id: 'runtime-moved', name: 'moved', owner: destination };
    root.submorphs = [sourceParent, destination];
    sourceParent.submorphs = [keeper];
    destination.submorphs = [moved];
    installLayoutAwareMorphOperations(sourceParent);
    installLayoutAwareMorphOperations(destination);
    installRemovableMorphOperation(moved);
    const tracker = Object.create(ComponentChangeTracker.prototype);
    tracker.trackedComponent = root;
    tracker.componentModuleId = 'local://layout-reparent-cutover/component.cp.js';
    tracker.componentModule = {
      _source: source,
      setSource (nextSource) { this._source = nextSource; }
    };
    tracker.componentDescriptor = {
      componentName: 'Example',
      stylePolicy: {
        _dependants: new Set(),
        getSubSpecAt: path => path.join('/') === 'source'
          ? { layout: beforeLayout }
          : null
      },
      makeDirty: () => {},
      refreshDependants: () => {}
    };
    tracker.committedChangeAdapter = new MorphicChangeSetAdapter({
      componentId: 'local://layout-reparent-cutover/component.cp.js::Example',
      containsMorph: () => true
    });
    tracker.scheduleShadowProjectionComparison = () => null;
    const targets = new Map([root, sourceParent, destination, keeper, moved]
      .map(morph => [morph.id, morph]));

    const result = tracker.processCommittedChangeSet(changeSet(new MoveMorph({
      morphId: moved.id,
      from: attachedMorph({ ownerId: sourceParent.id, index: 1 }),
      to: attachedMorph({ ownerId: destination.id, index: 0 })
    })), {
      legacyChanges: [{}],
      resolveMorph: id => targets.get(id)
    });

    expect(result.projectionalCommit).not.equals(null);
    expect(tracker.componentModule._source).not.includes("['moved',");
    expect(sourceParent.layout.config.resizePolicies.map(([name]) => name))
      .deep.equals(['keeper']);

    root.env.undoManager.undo();
    expect(tracker.componentModule._source).equals(source);
    expect(sourceParent.submorphs).deep.equals([keeper, moved]);
    expect(destination.submorphs).deep.equals([]);
    expect(sourceParent.layout.config.resizePolicies.map(([name]) => name))
      .deep.equals(['keeper', 'moved']);

    root.env.undoManager.redo();
    expect(sourceParent.submorphs).deep.equals([keeper]);
    expect(destination.submorphs).deep.equals([moved]);
    expect(moved.owner).equals(destination);
    expect(sourceParent.layout.config.resizePolicies.map(([name]) => name))
      .deep.equals(['keeper']);
  });

  it('cuts over reparenting through a runtime-only owner layout', () => {
    const root = { id: 'runtime-root', name: 'root', owner: null };
    const sourceParent = {
      id: 'runtime-source', name: 'source', owner: root, submorphs: []
    };
    const destination = {
      id: 'runtime-destination', name: 'destination', owner: root,
      submorphs: [], layout: {}
    };
    const moved = { id: 'runtime-moved', name: 'moved', owner: destination };
    destination.submorphs = [moved];
    root.submorphs = [sourceParent, destination];
    const source = `const Example = component({
  name: 'root',
  submorphs: [{
    name: 'source',
    submorphs: [{ name: 'moved' }]
  }, { name: 'destination' }]
});`;
    const tracker = Object.create(ComponentChangeTracker.prototype);
    tracker.trackedComponent = root;
    tracker.componentModuleId = 'local://reparent-layout/component.cp.js';
    tracker.componentModule = {
      _source: source,
      setSource (nextSource) { this._source = nextSource; }
    };
    tracker.componentDescriptor = {
      componentName: 'Example', stylePolicy: { _dependants: new Set() },
      makeDirty: () => {},
      refreshDependants: () => {}
    };
    tracker.committedChangeAdapter = new MorphicChangeSetAdapter({
      componentId: 'local://reparent-layout/component.cp.js::Example',
      containsMorph: () => true
    });
    tracker.scheduleShadowProjectionComparison = () => null;
    const targets = new Map([root, sourceParent, destination, moved]
      .map(morph => [morph.id, morph]));

    const result = tracker.processCommittedChangeSet(changeSet(new MoveMorph({
      morphId: moved.id,
      from: attachedMorph({ ownerId: sourceParent.id, index: 0 }),
      to: attachedMorph({ ownerId: destination.id, index: 0 })
    })), {
      legacyChanges: [{}],
      resolveMorph: id => targets.get(id)
    });

    expect(result.projectionalCommit).not.equals(null);
    expect(tracker.componentModule._source).not.equals(source);
    expect(tracker.componentModule._source.indexOf("name: 'moved'"))
      .above(tracker.componentModule._source.indexOf("name: 'destination'"));
  });

  it('restores the old owner when reparent source commit fails', () => {
    const source = `const Example = component({
  name: 'root',
  submorphs: [{
    name: 'source',
    submorphs: [{ name: 'moved' }]
  }, { name: 'destination' }]
});`;
    const root = { id: 'runtime-root', name: 'root', owner: null };
    const sourceParent = {
      id: 'runtime-source', name: 'source', owner: root, submorphs: []
    };
    const destination = {
      id: 'runtime-destination', name: 'destination', owner: root, submorphs: []
    };
    const moved = { id: 'runtime-moved', name: 'moved', owner: destination };
    destination.submorphs = [moved];
    root.submorphs = [sourceParent, destination];
    const sourceError = new Error('reparent source cutover failed');
    const tracker = Object.create(ComponentChangeTracker.prototype);
    tracker.trackedComponent = root;
    tracker.componentModuleId = 'local://reparent-cutover/component.cp.js';
    tracker.componentModule = {
      _source: source,
      setSource (nextSource) {
        if (nextSource !== source) throw sourceError;
        this._source = nextSource;
      }
    };
    tracker.componentDescriptor = {
      componentName: 'Example',
      stylePolicy: { _dependants: new Set() },
      makeDirty: () => {},
      refreshDependants: () => {}
    };
    tracker.committedChangeAdapter = new MorphicChangeSetAdapter({
      componentId: 'local://reparent-cutover/component.cp.js::Example',
      containsMorph: () => true
    });
    tracker.scheduleShadowProjectionComparison = () => null;
    const targets = new Map([root, sourceParent, destination, moved]
      .map(morph => [morph.id, morph]));

    let error;
    try {
      tracker.processCommittedChangeSet(changeSet(new MoveMorph({
        morphId: moved.id,
        from: attachedMorph({ ownerId: sourceParent.id, index: 0 }),
        to: attachedMorph({ ownerId: destination.id, index: 0 })
      })), {
        legacyChanges: [{}],
        resolveMorph: id => targets.get(id)
      });
    } catch (caughtError) {
      error = caughtError;
    }

    expect(error).equals(sourceError);
    expect(tracker.componentModule._source).equals(source);
    expect(sourceParent.submorphs).deep.equals([moved]);
    expect(destination.submorphs).deep.equals([]);
    expect(moved.owner).equals(sourceParent);
  });

  it('restores the old sibling order when reorder source commit fails', () => {
    const source = `const Example = component({
  name: 'root',
  submorphs: [{ name: 'first' }, { name: 'second' }]
});`;
    const root = { id: 'runtime-root', name: 'root', owner: null };
    const first = { id: 'runtime-first', name: 'first', owner: root };
    const second = { id: 'runtime-second', name: 'second', owner: root };
    root.submorphs = [second, first];
    const sourceError = new Error('reorder source cutover failed');
    const tracker = Object.create(ComponentChangeTracker.prototype);
    tracker.trackedComponent = root;
    tracker.componentModuleId = 'local://reorder-cutover/component.cp.js';
    tracker.componentModule = {
      _source: source,
      setSource (nextSource) {
        if (nextSource !== source) throw sourceError;
        this._source = nextSource;
      }
    };
    tracker.componentDescriptor = {
      componentName: 'Example',
      stylePolicy: { _dependants: new Set() },
      makeDirty: () => {},
      refreshDependants: () => {}
    };
    tracker.committedChangeAdapter = new MorphicChangeSetAdapter({
      componentId: 'local://reorder-cutover/component.cp.js::Example',
      containsMorph: () => true
    });
    tracker.scheduleShadowProjectionComparison = () => null;
    const targets = new Map([root, first, second].map(morph => [morph.id, morph]));

    let error;
    try {
      tracker.processCommittedChangeSet(changeSet(new MoveMorph({
        morphId: second.id,
        from: attachedMorph({ ownerId: root.id, index: 1 }),
        to: attachedMorph({ ownerId: root.id, index: 0 })
      })), {
        legacyChanges: [{}],
        resolveMorph: id => targets.get(id)
      });
    } catch (caughtError) {
      error = caughtError;
    }

    expect(error).equals(sourceError);
    expect(tracker.componentModule._source).equals(source);
    expect(root.submorphs).deep.equals([first, second]);
  });

  it('cuts an eligible appended plain morph introduction over with exact undo and redo', () => {
    const source = `const Example = component({
  name: 'root',
  submorphs: [{ name: 'first' }]
});`;
    const root = {
      id: 'runtime-root', name: 'root', owner: null,
      env: { undoManager: new UndoManager() }
    };
    const first = { id: 'runtime-first', name: 'first', owner: root };
    const introduced = {
      id: 'runtime-introduced',
      name: 'introduced',
      fill: 'green',
      owner: root,
      spec: () => ({ name: 'introduced', fill: 'green', submorphs: [] })
    };
    root.submorphs = [first, introduced];
    const tracker = Object.create(ComponentChangeTracker.prototype);
    tracker.trackedComponent = root;
    tracker.componentModuleId = 'local://introduction-cutover/component.cp.js';
    tracker.componentModule = {
      _source: source,
      setSource (nextSource) { this._source = nextSource; }
    };
    tracker.componentDescriptor = {
      componentName: 'Example',
      stylePolicy: { _dependants: new Set() },
      makeDirty: () => {},
      refreshDependants: () => {}
    };
    tracker.committedChangeAdapter = new MorphicChangeSetAdapter({
      componentId: 'local://introduction-cutover/component.cp.js::Example',
      containsMorph: () => true
    });
    tracker.scheduleShadowProjectionComparison = () => null;
    const resolveMorph = id => id === root.id
      ? root
      : id === first.id ? first : id === introduced.id ? introduced : null;

    const result = tracker.processCommittedChangeSet(changeSet(new MoveMorph({
      morphId: introduced.id,
      from: detachedMorph(),
      to: attachedMorph({ ownerId: root.id, index: 1 })
    })), {
      legacyChanges: [{}],
      resolveMorph
    });

    expect(result.projectionalCommit).not.equals(null);
    expect(tracker.componentModule._source)
      .includes('{ name: "introduced", fill: "green" }');
    expect(root.submorphs).deep.equals([first, introduced]);

    root.env.undoManager.undo();
    expect(tracker.componentModule._source).equals(source);
    expect(root.submorphs).deep.equals([first]);
    expect(introduced.owner).equals(null);

    root.env.undoManager.redo();
    expect(tracker.componentModule._source)
      .includes('{ name: "introduced", fill: "green" }');
    expect(root.submorphs).deep.equals([first, introduced]);
    expect(introduced.owner).equals(root);
  });

  it('cuts a source-located typed morph introduction over with its import', () => {
    class TypedMorph {}
    TypedMorph[Symbol.for('lively-module-meta')] = {
      package: { name: 'local://widgets' },
      pathInPackage: 'typed-morph.js'
    };
    const source = `const Example = component({
  name: 'root',
  submorphs: []
});`;
    const root = {
      id: 'runtime-root', name: 'root', owner: null,
      env: { undoManager: new UndoManager() }
    };
    const introduced = {
      id: 'runtime-typed', name: 'typed', owner: root,
      spec: () => ({ name: 'typed', type: TypedMorph, submorphs: [] })
    };
    root.submorphs = [introduced];
    const tracker = Object.create(ComponentChangeTracker.prototype);
    tracker.trackedComponent = root;
    tracker.componentModuleId = 'local://typed-introduction-cutover/component.cp.js';
    tracker.componentModule = {
      _source: source,
      setSource (nextSource) { this._source = nextSource; }
    };
    tracker.componentDescriptor = {
      componentName: 'Example',
      stylePolicy: { _dependants: new Set() },
      makeDirty: () => {},
      refreshDependants: () => {}
    };
    tracker.committedChangeAdapter = new MorphicChangeSetAdapter({
      componentId: 'local://typed-introduction-cutover/component.cp.js::Example',
      containsMorph: () => true
    });
    tracker.scheduleShadowProjectionComparison = () => null;
    const resolveMorph = id => id === root.id
      ? root
      : id === introduced.id ? introduced : null;

    const result = tracker.processCommittedChangeSet(changeSet(new MoveMorph({
      morphId: introduced.id,
      from: detachedMorph(),
      to: attachedMorph({ ownerId: root.id, index: 0 })
    })), {
      legacyChanges: [{}],
      resolveMorph
    });

    expect(result.projectionalCommit).not.equals(null);
    expect(tracker.componentModule._source)
      .includes('import { TypedMorph } from "local://widgets/typed-morph.js";');
    expect(tracker.componentModule._source)
      .includes('{ name: "typed", type: TypedMorph }');

    root.env.undoManager.undo();
    expect(tracker.componentModule._source).equals(source);
    expect(root.submorphs).deep.equals([]);

    root.env.undoManager.redo();
    expect(tracker.componentModule._source)
      .includes('{ name: "typed", type: TypedMorph }');
    expect(root.submorphs).deep.equals([introduced]);
  });

  it('cuts a source-located part introduction over without flattening its base', () => {
    class DerivedMorph {}
    const source = `const Example = component({
  name: 'root',
  submorphs: []
});`;
    const root = {
      id: 'runtime-root', name: 'root', owner: null,
      env: { undoManager: new UndoManager() }
    };
    const inherited = { id: 'runtime-inherited', name: 'inherited', owner: null };
    const introduced = {
      id: 'runtime-part', name: 'button', owner: root,
      submorphs: [inherited],
      master: {
        _originalSpec: { name: 'button', opacity: 0.5 },
        parent: {
          [Symbol.for('lively-module-meta')]: {
            exportedName: 'Button',
            moduleId: 'local://widgets/button.cp.js',
            path: []
          }
        }
      },
      spec: () => ({
        name: 'button',
        type: DerivedMorph,
        opacity: 0.5,
        fill: 'inherited-fill',
        submorphs: [{ name: 'inherited', submorphs: [] }]
      })
    };
    inherited.owner = introduced;
    root.submorphs = [introduced];
    const tracker = Object.create(ComponentChangeTracker.prototype);
    tracker.trackedComponent = root;
    tracker.componentModuleId = 'local://part-introduction-cutover/component.cp.js';
    tracker.componentModule = {
      _source: source,
      setSource (nextSource) { this._source = nextSource; }
    };
    tracker.componentDescriptor = {
      componentName: 'Example',
      stylePolicy: { _dependants: new Set() },
      makeDirty: () => {},
      refreshDependants: () => {}
    };
    tracker.committedChangeAdapter = new MorphicChangeSetAdapter({
      componentId: 'local://part-introduction-cutover/component.cp.js::Example',
      containsMorph: () => true
    });
    tracker.scheduleShadowProjectionComparison = () => null;
    const resolveMorph = id => id === root.id
      ? root
      : id === introduced.id ? introduced : id === inherited.id ? inherited : null;

    const result = tracker.processCommittedChangeSet(changeSet(new MoveMorph({
      morphId: introduced.id,
      from: detachedMorph(),
      to: attachedMorph({ ownerId: root.id, index: 0 })
    })), {
      legacyChanges: [{}],
      resolveMorph
    });

    expect(result.projectionalCommit).not.equals(null);
    expect(tracker.componentModule._source)
      .includes('import { Button } from "local://widgets/button.cp.js";');
    expect(tracker.componentModule._source).includes('import { part } from "lively.morphic";');
    expect(tracker.componentModule._source)
      .includes('part(Button, { name: "button", opacity: 0.5, submorphs: [{ name: "inherited" }] })');
    expect(tracker.componentModule._source).not.includes('inherited-fill');
    expect(tracker.componentModule._source).includes('name: "inherited"');

    root.env.undoManager.undo();
    expect(tracker.componentModule._source).equals(source);
    expect(root.submorphs).deep.equals([]);

    root.env.undoManager.redo();
    expect(tracker.componentModule._source)
      .includes('part(Button, { name: "button", opacity: 0.5, submorphs: [{ name: "inherited" }] })');
    expect(root.submorphs).deep.equals([introduced]);
  });

  it('cuts an appended introduction into a modeled tiling layout over', () => {
    const source = `const Example = component({
  name: 'root',
  layout: new TilingLayout({
    resizePolicies: [['first', { height: 'fixed', width: 'fill' }]]
  }),
  submorphs: [{ name: 'first' }]
});`;
    const root = {
      id: 'runtime-root', name: 'root', owner: null,
      layout: new RuntimeTilingLayoutState([
        ['first', { height: 'fixed', width: 'fill' }]
      ]),
      env: { undoManager: new UndoManager() }
    };
    const first = { id: 'runtime-first', name: 'first', owner: root };
    const introduced = {
      id: 'runtime-introduced', name: 'introduced', owner: root,
      spec: () => ({ name: 'introduced', fill: 'green', submorphs: [] })
    };
    root.submorphs = [first, introduced];
    installLayoutAwareMorphOperations(root);
    installRemovableMorphOperation(introduced);
    root.layout.onSubmorphAdded(introduced);
    const tracker = Object.create(ComponentChangeTracker.prototype);
    tracker.trackedComponent = root;
    tracker.componentModuleId = 'local://layout-introduction-cutover/component.cp.js';
    tracker.componentModule = {
      _source: source,
      setSource (nextSource) { this._source = nextSource; }
    };
    tracker.componentDescriptor = {
      componentName: 'Example',
      stylePolicy: { _dependants: new Set() },
      makeDirty: () => {},
      refreshDependants: () => {}
    };
    tracker.committedChangeAdapter = new MorphicChangeSetAdapter({
      componentId: 'local://layout-introduction-cutover/component.cp.js::Example',
      containsMorph: () => true
    });
    tracker.scheduleShadowProjectionComparison = () => null;
    const targets = new Map([root, first, introduced].map(morph => [morph.id, morph]));

    const result = tracker.processCommittedChangeSet(changeSet(new MoveMorph({
      morphId: introduced.id,
      from: detachedMorph(),
      to: attachedMorph({ ownerId: root.id, index: 1 })
    })), {
      legacyChanges: [{}],
      resolveMorph: id => targets.get(id)
    });

    expect(result.projectionalCommit).not.equals(null);
    expect(tracker.componentModule._source)
      .includes('{ name: "introduced", fill: "green" }');
    expect(tracker.componentModule._source)
      .includes("resizePolicies: [['first', { height: 'fixed', width: 'fill' }]]");
    expect(root.layout.resizePolicyFor(introduced))
      .deep.equals({ width: 'fixed', height: 'fixed' });

    root.env.undoManager.undo();
    expect(tracker.componentModule._source).equals(source);
    expect(root.submorphs).deep.equals([first]);
    expect(root.layout.resizePolicyFor(introduced)).equals(null);

    root.env.undoManager.redo();
    expect(root.submorphs).deep.equals([first, introduced]);
    expect(root.layout.resizePolicyFor(introduced))
      .deep.equals({ width: 'fixed', height: 'fixed' });
  });

  it('cuts over introduction before an existing sibling', () => {
    const source = `const Example = component({
  name: 'root',
  submorphs: [{ name: 'last' }]
});`;
    const root = { id: 'runtime-root', name: 'root', owner: null };
    const introduced = {
      id: 'runtime-introduced', name: 'introduced', owner: root,
      spec: () => ({ name: 'introduced', submorphs: [] })
    };
    const last = { id: 'runtime-last', name: 'last', owner: root };
    root.submorphs = [introduced, last];
    const tracker = Object.create(ComponentChangeTracker.prototype);
    tracker.trackedComponent = root;
    tracker.componentModuleId = 'local://introduction-cutover/component.cp.js';
    tracker.componentModule = {
      _source: source,
      setSource (nextSource) { this._source = nextSource; }
    };
    tracker.componentDescriptor = {
      componentName: 'Example',
      stylePolicy: { _dependants: new Set() }
    };
    tracker.committedChangeAdapter = new MorphicChangeSetAdapter({
      componentId: 'local://introduction-cutover/component.cp.js::Example',
      containsMorph: () => true
    });
    tracker.scheduleShadowProjectionComparison = () => null;
    const resolveMorph = id => id === root.id
      ? root
      : id === introduced.id ? introduced : id === last.id ? last : null;

    const result = tracker.processCommittedChangeSet(changeSet(new MoveMorph({
      morphId: introduced.id,
      from: detachedMorph(),
      to: attachedMorph({ ownerId: root.id, index: 0 })
    })), {
      legacyChanges: [{}],
      resolveMorph
    });

    expect(result.projectionalCommit).not.equals(null);
    expect(tracker.componentModule._source.indexOf('introduced'))
      .below(tracker.componentModule._source.indexOf('last'));
    expect(tracker._projectionalDocument.root.children.map(({ name }) => name))
      .deep.equals(['introduced', 'last']);
  });

  it('detaches a directly introduced child when structural source commit fails', () => {
    const source = `const Example = component({ name: 'root' });`;
    const root = { id: 'runtime-root', name: 'root', owner: null };
    const introduced = {
      id: 'runtime-introduced', name: 'introduced', owner: root,
      spec: () => ({ name: 'introduced', submorphs: [] })
    };
    root.submorphs = [introduced];
    const sourceError = new Error('introduction source cutover failed');
    const tracker = Object.create(ComponentChangeTracker.prototype);
    tracker.trackedComponent = root;
    tracker.componentModuleId = 'local://introduction-cutover/component.cp.js';
    tracker.componentModule = {
      _source: source,
      setSource (nextSource) {
        if (nextSource !== source) throw sourceError;
        this._source = nextSource;
      }
    };
    tracker.componentDescriptor = {
      componentName: 'Example',
      stylePolicy: { _dependants: new Set() },
      makeDirty: () => {},
      refreshDependants: () => {}
    };
    tracker.committedChangeAdapter = new MorphicChangeSetAdapter({
      componentId: 'local://introduction-cutover/component.cp.js::Example',
      containsMorph: () => true
    });
    tracker.scheduleShadowProjectionComparison = () => null;
    const resolveMorph = id => id === root.id
      ? root
      : id === introduced.id ? introduced : null;

    let error;
    try {
      tracker.processCommittedChangeSet(changeSet(new MoveMorph({
        morphId: introduced.id,
        from: detachedMorph(),
        to: attachedMorph({ ownerId: root.id, index: 0 })
      })), {
        legacyChanges: [{}],
        resolveMorph
      });
    } catch (caughtError) {
      error = caughtError;
    }

    expect(error).equals(sourceError);
    expect(tracker.componentModule._source).equals(source);
    expect(root.submorphs).deep.equals([]);
    expect(introduced.owner).equals(null);
  });

  it('cuts static full-text replacement over as an explicit text command', () => {
    const source = `const Example = component({
  name: 'label',
  textAndAttributes: ['before', null]
});`;
    const before = ['before', null];
    const after = ['after', { fontWeight: 'bold' }];
    const root = {
      id: 'runtime-root', name: 'label', textAndAttributes: after, owner: null,
      env: { undoManager: new UndoManager() }
    };
    const tracker = Object.create(ComponentChangeTracker.prototype);
    tracker.trackedComponent = root;
    tracker.componentModuleId = 'local://text-cutover/component.cp.js';
    tracker.componentModule = {
      _source: source,
      setSource (nextSource) { this._source = nextSource; }
    };
    const policySpec = { name: 'label', textAndAttributes: before };
    tracker.componentDescriptor = {
      componentName: 'Example',
      stylePolicy: { spec: policySpec },
      makeDirty: () => {},
      refreshDependants: () => {}
    };
    tracker.committedChangeAdapter = new MorphicChangeSetAdapter({
      componentId: 'local://text-cutover/component.cp.js::Example',
      containsMorph: () => true
    });
    tracker.scheduleShadowProjectionComparison = () => null;
    const result = tracker.processCommittedChangeSet(changeSet(new SetMorphProperty({
      targetId: root.id,
      property: 'textAndAttributes',
      before,
      after
    })), {
      legacyChanges: [{}],
      resolveMorph: id => id === root.id ? root : null
    });

    expect(result.commands[0].kind).equals(ComponentBridgeCommandKind.EDIT_TEXT);
    expect(result.projectionalCommit).not.equals(null);
    expect(tracker.componentModule._source)
      .includes('textAndAttributes: ["after", { "fontWeight": "bold" }]');
    expect(root.textAndAttributes).equals(after);
    expect(policySpec.textAndAttributes).equals(after);

    root.env.undoManager.undo();
    expect(tracker.componentModule._source).equals(source);
    expect(root.textAndAttributes).deep.equals(before);
    expect(policySpec.textAndAttributes).equals(before);

    root.env.undoManager.redo();
    expect(tracker.componentModule._source)
      .includes('textAndAttributes: ["after", { "fontWeight": "bold" }]');
    expect(root.textAndAttributes).deep.equals(after);
    expect(policySpec.textAndAttributes).equals(after);
  });

  it('rejects rich text values outside the static semantic subset', () => {
    class RuntimeTextAttribute {}
    const source = `const Example = component({ textAndAttributes: ['before', null] });`;
    const root = {
      id: 'runtime-root',
      name: 'label',
      textAndAttributes: ['after', new RuntimeTextAttribute()],
      owner: null
    };
    const tracker = Object.create(ComponentChangeTracker.prototype);
    tracker.trackedComponent = root;
    tracker.componentModuleId = 'local://text-cutover/component.cp.js';
    tracker.componentModule = {
      _source: source,
      setSource (nextSource) { this._source = nextSource; }
    };
    tracker.componentDescriptor = { componentName: 'Example' };
    tracker.committedChangeAdapter = new MorphicChangeSetAdapter({
      componentId: 'local://text-cutover/component.cp.js::Example',
      containsMorph: () => true
    });
    tracker.scheduleShadowProjectionComparison = () => null;

    const result = tracker.processCommittedChangeSet(changeSet(new SetMorphProperty({
      targetId: root.id,
      property: 'textAndAttributes',
      before: ['before', null],
      after: root.textAndAttributes
    })), {
      legacyChanges: [{}],
      resolveMorph: id => id === root.id ? root : null
    });

    expect(result.shadowProjection.supported).to.be.false;
    expect(result.projectionalCommit).equals(null);
    expect(tracker.componentModule._source).equals(source);
  });

  it('cuts serializable master changes over with imports and exact undo and redo', () => {
    class SerializableMaster {
      getConfigAsExpression () {
        return {
          __expr__: 'HoverMaster',
          bindings: { 'local://masters.js': ['HoverMaster'] }
        };
      }
    }
    const source = `const Example = component({ master: null });`;
    const nextMaster = new SerializableMaster();
    const root = {
      id: 'runtime-root', name: 'example', master: nextMaster, owner: null,
      env: { undoManager: new UndoManager() }
    };
    const tracker = Object.create(ComponentChangeTracker.prototype);
    tracker.trackedComponent = root;
    tracker.componentModuleId = 'local://master-cutover/component.cp.js';
    tracker.componentModule = {
      _source: source,
      setSource (nextSource) { this._source = nextSource; }
    };
    tracker.componentDescriptor = {
      componentName: 'Example',
      makeDirty: () => {},
      refreshDependants: () => {}
    };
    tracker.committedChangeAdapter = new MorphicChangeSetAdapter({
      componentId: 'local://master-cutover/component.cp.js::Example',
      containsMorph: () => true
    });
    tracker.scheduleShadowProjectionComparison = () => null;

    const result = tracker.processCommittedChangeSet(changeSet(new SetMorphProperty({
      targetId: root.id,
      property: 'master',
      before: null,
      after: nextMaster
    })), {
      legacyChanges: [{}],
      resolveMorph: id => id === root.id ? root : null
    });

    expect(result.commands[0].kind).equals(ComponentBridgeCommandKind.SET_MASTER);
    expect(result.projectionalCommit,
      JSON.stringify(result.shadowProjection?.diagnostics || []))
      .not.equals(null);
    expect(tracker.componentModule._source)
      .includes('import { HoverMaster } from "local://masters.js";');
    expect(tracker.componentModule._source).includes('master: HoverMaster');
    expect(root.master).equals(nextMaster);

    root.env.undoManager.undo();
    expect(tracker.componentModule._source).equals(source);
    expect(root.master).equals(null);

    root.env.undoManager.redo();
    expect(tracker.componentModule._source).includes('master: HoverMaster');
    expect(root.master).equals(nextMaster);
  });

  it('cuts over a direct master change that clears the local policy', () => {
    const previousMaster = { getConfigAsExpression: () => ({ __expr__: 'BaseMaster', bindings: {} }) };
    const source = `const Example = component({ master: BaseMaster });`;
    const root = { id: 'runtime-root', name: 'example', master: null, owner: null };
    const tracker = Object.create(ComponentChangeTracker.prototype);
    tracker.trackedComponent = root;
    tracker.componentModuleId = 'local://master-cutover/component.cp.js';
    tracker.componentModule = {
      _source: source,
      setSource (nextSource) { this._source = nextSource; }
    };
    tracker.componentDescriptor = { componentName: 'Example' };
    tracker.committedChangeAdapter = new MorphicChangeSetAdapter({
      componentId: 'local://master-cutover/component.cp.js::Example',
      containsMorph: () => true
    });
    tracker.scheduleShadowProjectionComparison = () => null;

    const result = tracker.processCommittedChangeSet(changeSet(new SetMorphProperty({
      targetId: root.id,
      property: 'master',
      before: previousMaster,
      after: null
    })), {
      legacyChanges: [{}],
      resolveMorph: id => id === root.id ? root : null
    });

    expect(result.shadowProjection.supported).to.be.true;
    expect(result.projectionalCommit).not.equals(null);
    expect(tracker.componentModule._source).includes('master: null');
  });

  it('keeps semantic document revisions monotonic across scalar cutover edits', () => {
    const source = `const Example = component({
  name: 'example',
  fill: 'red'
});`;
    const root = { id: 'runtime-root', name: 'example', fill: 'green', owner: null };
    const tracker = Object.create(ComponentChangeTracker.prototype);
    tracker.trackedComponent = root;
    tracker.componentModuleId = 'local://scalar-cutover/component.cp.js';
    tracker.componentModule = {
      _source: source,
      setSource (nextSource) { this._source = nextSource; }
    };
    tracker.componentDescriptor = {
      componentName: 'Example',
      makeDirty: () => {},
      refreshDependants: () => {}
    };
    tracker.committedChangeAdapter = new MorphicChangeSetAdapter({
      componentId: 'local://scalar-cutover/component.cp.js::Example',
      containsMorph: () => true
    });
    tracker.scheduleShadowProjectionComparison = () => null;
    const context = {
      legacyChanges: [{}],
      resolveMorph: id => id === root.id ? root : null
    };

    tracker.processCommittedChangeSet(changeSet(new SetMorphProperty({
      targetId: root.id, property: 'fill', before: 'red', after: 'green'
    })), context);
    root.fill = 'blue';
    context.legacyChanges = [{}];
    tracker.processCommittedChangeSet(changeSet(new SetMorphProperty({
      targetId: root.id, property: 'fill', before: 'green', after: 'blue'
    })), context);

    expect(tracker._projectionalDocument.revision).equals(2);
    expect(tracker.componentModule._source).includes('fill: "blue"');
    expect(root.fill).equals('blue');
  });

  it('cuts a scalar property batch over as one exact undoable transaction', () => {
    const source = `const Example = component({
  name: 'example',
  fill: 'red',
  opacity: 0.5
});`;
    const root = {
      id: 'runtime-root',
      name: 'example',
      fill: 'green',
      opacity: 0.8,
      owner: null,
      env: { undoManager: new UndoManager() }
    };
    const tracker = Object.create(ComponentChangeTracker.prototype);
    tracker.trackedComponent = root;
    tracker.componentModuleId = 'local://batch-cutover/component.cp.js';
    tracker.componentModule = {
      _source: source,
      setSource (nextSource) { this._source = nextSource; }
    };
    tracker.componentDescriptor = {
      componentName: 'Example',
      makeDirty: () => {},
      refreshDependants: () => {}
    };
    tracker.committedChangeAdapter = new MorphicChangeSetAdapter({
      componentId: 'local://batch-cutover/component.cp.js::Example',
      containsMorph: () => true
    });
    tracker.scheduleShadowProjectionComparison = () => null;

    const result = tracker.processCommittedChangeSet(changeSet([
      new SetMorphProperty({
        targetId: root.id,
        property: 'fill',
        before: 'red',
        after: 'green'
      }),
      new SetMorphProperty({
        targetId: root.id,
        property: 'opacity',
        before: 0.5,
        after: 0.8
      })
    ]), {
      legacyChanges: [{}, {}],
      resolveMorph: id => id === root.id ? root : null
    });

    expect(result.projectionalCommit).not.equals(null);
    expect(result.projectionalCommit.transaction.commands).length(2);
    expect(tracker.componentModule._source).includes('fill: "green"');
    expect(tracker.componentModule._source).includes('opacity: 0.8');

    root.env.undoManager.undo();
    expect(tracker.componentModule._source).equals(source);
    expect(root.fill).equals('red');
    expect(root.opacity).equals(0.5);

    root.env.undoManager.redo();
    expect(tracker.componentModule._source).includes('fill: "green"');
    expect(root.fill).equals('green');
    expect(root.opacity).equals(0.8);
  });

  it('clears an override from explicit semantic intent before mutating runtime', () => {
    const source = `const Example = component({
  name: 'example',
  fill: 'red'
});`;
    const root = { id: 'runtime-root', name: 'example', fill: 'red', owner: null };
    const undoManager = new UndoManager();
    root.env = { undoManager };
    const descriptorCalls = [];
    const tracker = Object.create(ComponentChangeTracker.prototype);
    tracker.trackedComponent = root;
    tracker.componentModuleId = 'local://explicit-clear/component.cp.js';
    tracker.componentModule = {
      _source: source,
      setSource (nextSource) { this._source = nextSource; }
    };
    tracker.componentDescriptor = {
      componentName: 'Example',
      makeDirty: () => descriptorCalls.push('dirty'),
      refreshDependants: () => descriptorCalls.push('refresh')
    };
    tracker.committedChangeAdapter = new MorphicChangeSetAdapter({
      componentId: 'local://explicit-clear/component.cp.js::Example',
      containsMorph: () => true
    });

    const result = tracker.clearPropertyOverride({
      target: root,
      property: 'fill',
      effectiveValue: 'inherited-blue'
    });

    expect(result.committed).to.be.true;
    expect(result.editTransaction).to.be.instanceOf(ProjectionalComponentEditTransaction);
    expect(tracker.componentModule._source).not.includes('fill:');
    expect(tracker._projectionalDocument.root.properties).not.haveOwnProperty('fill');
    expect(root.fill).equals('inherited-blue');
    expect(undoManager.undos).to.have.length(1);
    expect(undoManager.undos[0]).equals(result.editTransaction);

    undoManager.undo();
    expect(tracker.componentModule._source).equals(source);
    expect(tracker._projectionalDocument.root.properties.fill.value).equals('red');
    expect(root.fill).equals('red');

    undoManager.redo();
    expect(tracker.componentModule._source).not.includes('fill:');
    expect(tracker._projectionalDocument.root.properties).not.haveOwnProperty('fill');
    expect(root.fill).equals('inherited-blue');
    expect(descriptorCalls).deep.equals([
      'dirty', 'refresh',
      'dirty', 'refresh',
      'dirty', 'refresh'
    ]);
  });

  it('sets a semantic property from explicit intent with exact undo and redo', () => {
    const source = `const Example = component({ name: 'example' });`;
    const root = {
      id: 'runtime-root',
      name: 'example',
      visible: true,
      owner: null,
      env: { undoManager: new UndoManager() }
    };
    const tracker = Object.create(ComponentChangeTracker.prototype);
    tracker.trackedComponent = root;
    tracker.componentModuleId = 'local://explicit-set/component.cp.js';
    tracker.componentModule = {
      _source: source,
      setSource (nextSource) { this._source = nextSource; }
    };
    tracker.componentDescriptor = {
      componentName: 'Example',
      makeDirty: () => {},
      refreshDependants: () => {}
    };
    tracker.committedChangeAdapter = new MorphicChangeSetAdapter({
      componentId: 'local://explicit-set/component.cp.js::Example'
    });

    const result = tracker.setProperty({
      target: root,
      property: 'visible',
      value: false
    });

    expect(result.committed).to.be.true;
    expect(tracker.componentModule._source).includes('visible: false');
    expect(tracker._projectionalDocument.root.properties.visible.value).to.be.false;
    expect(root.visible).to.be.false;

    root.env.undoManager.undo();
    expect(tracker.componentModule._source).equals(source);
    expect(tracker._projectionalDocument.root.properties).not.haveOwnProperty('visible');
    expect(root.visible).to.be.true;

    root.env.undoManager.redo();
    expect(tracker.componentModule._source).includes('visible: false');
    expect(root.visible).to.be.false;
  });

  it('rejects an explicit property before mutation when its value is not serializable', () => {
    class RuntimeOnlyValue {}
    const source = `const Example = component({ name: 'example' });`;
    const previous = new RuntimeOnlyValue();
    const next = new RuntimeOnlyValue();
    const root = {
      id: 'runtime-root', name: 'example', customStyle: previous, owner: null
    };
    const tracker = Object.create(ComponentChangeTracker.prototype);
    tracker.trackedComponent = root;
    tracker.componentModuleId = 'local://explicit-set/component.cp.js';
    tracker.componentModule = {
      _source: source,
      setSource (nextSource) { this._source = nextSource; }
    };
    tracker.componentDescriptor = {
      componentName: 'Example',
      makeDirty: () => {},
      refreshDependants: () => {}
    };
    tracker.committedChangeAdapter = new MorphicChangeSetAdapter({
      componentId: 'local://explicit-set/component.cp.js::Example'
    });

    const result = tracker.setProperty({
      target: root,
      property: 'customStyle',
      value: next
    });

    expect(result.committed).to.be.false;
    expect(result.diagnostics[0].kind)
      .equals(ProjectionalCommandDiagnosticKind.PLANNING_FAILED);
    expect(tracker.componentModule._source).equals(source);
    expect(root.customStyle).equals(previous);
  });

  it('sets a serializer-backed property with its import and exact undo and redo', () => {
    class SerializableColor {
      constructor (name) { this.name = name; }
      __serialize__ () {
        return {
          __expr__: `Color.${this.name}`,
          bindings: { 'lively.graphics': ['Color'] }
        };
      }
    }
    const source = `const Example = component({ fill: 'red' });`;
    const previous = new SerializableColor('red');
    const next = new SerializableColor('green');
    const root = {
      id: 'runtime-root', name: 'example', fill: previous, owner: null,
      env: { undoManager: new UndoManager() }
    };
    const tracker = Object.create(ComponentChangeTracker.prototype);
    tracker.trackedComponent = root;
    tracker.componentModuleId = 'local://opaque-set/component.cp.js';
    tracker.componentModule = {
      _source: source,
      setSource (nextSource) { this._source = nextSource; }
    };
    tracker.componentDescriptor = {
      componentName: 'Example',
      makeDirty: () => {},
      refreshDependants: () => {}
    };
    tracker.committedChangeAdapter = new MorphicChangeSetAdapter({
      componentId: 'local://opaque-set/component.cp.js::Example'
    });

    const result = tracker.setProperty({ target: root, property: 'fill', value: next });

    expect(result.committed).to.be.true;
    expect(tracker.componentModule._source).includes('import { Color } from "lively.graphics";');
    expect(tracker.componentModule._source).includes('fill: Color.green');
    expect(root.fill).equals(next);

    root.env.undoManager.undo();
    expect(tracker.componentModule._source).equals(source);
    expect(root.fill).equals(previous);

    root.env.undoManager.redo();
    expect(tracker.componentModule._source).includes('fill: Color.green');
    expect(root.fill).equals(next);
  });

  it('finds the nearest component tracker for an edited descendant', () => {
    const tracker = {
      tracksMorph: morph => morph.name === 'child'
    };
    const root = { name: 'root', owner: null, _changeTracker: tracker };
    const child = { name: 'child', owner: root };

    expect(componentChangeTrackerFor(child)).equals(tracker);
    expect(componentChangeTrackerFor({ name: 'detached', owner: null })).equals(null);
  });

  it('uses explicit component intent when available and otherwise performs ordinary mutation', () => {
    const projectionalTarget = {
      owner: null,
      visible: true,
      _changeTracker: {
        tracksMorph: () => true,
        setProperty: options => Object.freeze({ committed: true, options })
      },
      withMetaDo: () => { throw new Error('must not mutate before a committed command'); }
    };
    const committed = setMorphPropertyWithComponentCommand({
      target: projectionalTarget,
      property: 'visible',
      value: false
    });

    expect(committed.committed).to.be.true;
    expect(projectionalTarget.visible).to.be.true;

    const metadata = [];
    const untrackedTarget = {
      owner: null,
      visible: true,
      withMetaDo: (meta, callback) => {
        metadata.push(meta);
        callback();
      }
    };
    const directMutationResult = setMorphPropertyWithComponentCommand({
      target: untrackedTarget,
      property: 'visible',
      value: false
    });

    expect(directMutationResult).equals(null);
    expect(untrackedTarget.visible).to.be.false;
    expect(metadata).deep.equals([]);
  });

  it('joins an explicit clear command into an active undo while replacing recorded Morphic changes', () => {
    const source = `const Example = component({ fill: 'red' });`;
    const journalCalls = [];
    const root = {
      id: 'runtime-root',
      name: 'example',
      fill: 'red',
      owner: null,
      env: {
        undoManager: {
          undoInProgress: {},
          addTransaction: (transaction, options) => {
            journalCalls.push([transaction, options]);
            return transaction;
          }
        }
      }
    };
    const tracker = Object.create(ComponentChangeTracker.prototype);
    tracker.trackedComponent = root;
    tracker.componentModuleId = 'local://explicit-clear/component.cp.js';
    tracker.componentModule = {
      _source: source,
      setSource (nextSource) { this._source = nextSource; }
    };
    tracker.componentDescriptor = {
      componentName: 'Example',
      makeDirty: () => {},
      refreshDependants: () => {}
    };
    tracker.committedChangeAdapter = new MorphicChangeSetAdapter({
      componentId: 'local://explicit-clear/component.cp.js::Example'
    });

    const result = tracker.clearPropertyOverride({
      target: root,
      property: 'fill',
      effectiveValue: null
    });

    expect(result.committed).to.be.true;
    expect(journalCalls).to.have.length(1);
    expect(journalCalls[0][0]).equals(result.editTransaction);
    expect(journalCalls[0][1]).deep.equals({ joinActive: true });
  });

  it('leaves every domain unchanged when an explicit clear is unsupported', () => {
    const source = `const Example = component({ name: 'example' });`;
    const root = {
      id: 'runtime-root', name: 'example', fill: 'inherited-blue', owner: null
    };
    const tracker = Object.create(ComponentChangeTracker.prototype);
    tracker.trackedComponent = root;
    tracker.componentModuleId = 'local://explicit-clear/component.cp.js';
    tracker.componentModule = {
      _source: source,
      setSource (nextSource) { this._source = nextSource; }
    };
    tracker.componentDescriptor = {
      componentName: 'Example',
      makeDirty: () => {},
      refreshDependants: () => {}
    };
    tracker.committedChangeAdapter = new MorphicChangeSetAdapter({
      componentId: 'local://explicit-clear/component.cp.js::Example'
    });

    const result = tracker.clearPropertyOverride({
      target: root,
      property: 'fill',
      effectiveValue: null
    });

    expect(result.committed).to.be.false;
    expect(result.diagnostics[0].kind)
      .equals(ProjectionalCommandDiagnosticKind.PLANNING_FAILED);
    expect(tracker.componentModule._source).equals(source);
    expect(root.fill).equals('inherited-blue');
    expect(tracker._projectionalDocument).equals(undefined);
  });

  it('leaves runtime and history unchanged when an explicit clear cannot commit source', () => {
    const source = `const Example = component({ fill: 'red' });`;
    const sourceError = new Error('explicit clear source failed');
    const undoManager = new UndoManager();
    const root = {
      id: 'runtime-root',
      name: 'example',
      fill: 'red',
      owner: null,
      env: { undoManager }
    };
    const tracker = Object.create(ComponentChangeTracker.prototype);
    tracker.trackedComponent = root;
    tracker.componentModuleId = 'local://explicit-clear/component.cp.js';
    tracker.componentModule = {
      _source: source,
      setSource (nextSource) {
        if (nextSource !== source) throw sourceError;
        this._source = nextSource;
      }
    };
    tracker.componentDescriptor = {
      componentName: 'Example',
      makeDirty: () => {},
      refreshDependants: () => {}
    };
    tracker.committedChangeAdapter = new MorphicChangeSetAdapter({
      componentId: 'local://explicit-clear/component.cp.js::Example'
    });

    let error;
    try {
      tracker.clearPropertyOverride({
        target: root,
        property: 'fill',
        effectiveValue: 'inherited-blue'
      });
    } catch (caughtError) {
      error = caughtError;
    }

    expect(error).equals(sourceError);
    expect(tracker.componentModule._source).equals(source);
    expect(root.fill).equals('red');
    expect(undoManager.undos).to.have.length(0);
    expect(tracker._projectionalDocument).equals(undefined);
  });

  it('cuts a root component rename over with exact undo and redo', () => {
    const source = `const Example = component({ name: 'before' });`;
    const root = {
      id: 'runtime-root', name: 'after', owner: null,
      env: { undoManager: new UndoManager() }
    };
    const tracker = Object.create(ComponentChangeTracker.prototype);
    tracker.trackedComponent = root;
    tracker.componentModuleId = 'local://scalar-cutover/component.cp.js';
    tracker.componentModule = {
      _source: source,
      setSource (nextSource) { this._source = nextSource; }
    };
    tracker.componentDescriptor = {
      componentName: 'Example',
      stylePolicy: { spec: { name: 'before' }, _dependants: new Set() },
      makeDirty: () => {},
      refreshDependants: () => {}
    };
    tracker.committedChangeAdapter = new MorphicChangeSetAdapter({
      componentId: 'local://scalar-cutover/component.cp.js::Example',
      containsMorph: () => true
    });
    tracker.scheduleShadowProjectionComparison = () => null;
    const recordedChange = { meta: { reconcileChanges: true } };

    const result = tracker.processCommittedChangeSet(changeSet(new SetMorphProperty({
      targetId: root.id, property: 'name', before: 'before', after: 'after'
    })), {
      legacyChanges: [recordedChange],
      resolveMorph: id => id === root.id ? root : null
    });

    expect(result.projectionalCommit).not.equals(null);
    expect(tracker.lastShadowCommandBatch).not.haveOwnProperty('renameDiagnostic');
    expect(tracker.componentModule._source).includes('name: "after"');
    expect(root.name).equals('after');
    expect(tracker.componentDescriptor.stylePolicy.spec.name).equals('after');

    root.env.undoManager.undo();
    expect(tracker.componentModule._source).equals(source);
    expect(root.name).equals('before');
    expect(tracker.componentDescriptor.stylePolicy.spec.name).equals('before');

    root.env.undoManager.redo();
    expect(tracker.componentModule._source).includes('name: "after"');
    expect(root.name).equals('after');
    expect(tracker.componentDescriptor.stylePolicy.spec.name).equals('after');
  });

  it('commits scalar cutover together with required source imports', () => {
    const source = `const Example = component({ fill: Color.red });`;
    const runtimeValue = {
      __serialize__: () => ({
        __expr__: 'Color.green',
        bindings: { 'lively.graphics': ['Color'] }
      })
    };
    const root = {
      id: 'runtime-root', name: 'example', fill: runtimeValue, owner: null
    };
    const tracker = Object.create(ComponentChangeTracker.prototype);
    tracker.trackedComponent = root;
    tracker.componentModuleId = 'local://scalar-cutover/component.cp.js';
    tracker.componentModule = {
      _source: source,
      setSource (nextSource) { this._source = nextSource; }
    };
    tracker.componentDescriptor = {
      componentName: 'Example',
      makeDirty: () => {},
      refreshDependants: () => {}
    };
    tracker.committedChangeAdapter = new MorphicChangeSetAdapter({
      componentId: 'local://scalar-cutover/component.cp.js::Example',
      containsMorph: () => true
    });
    tracker.scheduleShadowProjectionComparison = () => null;

    const result = tracker.processCommittedChangeSet(changeSet(new SetMorphProperty({
      targetId: root.id,
      property: 'fill',
      before: { color: 'red' },
      after: runtimeValue
    })), {
      legacyChanges: [{}],
      resolveMorph: id => id === root.id ? root : null
    });

    expect(result.shadowProjection.supported).to.be.true;
    expect(result.shadowProjection.requiredBindings)
      .deep.equals({ 'lively.graphics': ['Color'] });
    expect(result.projectionalCommit).not.equals(null);
    expect(tracker.componentModule._source).includes('import { Color } from "lively.graphics";');
    expect(tracker.componentModule._source).includes('fill: Color.green');
    expect(tracker._projectionallyConsumedChanges).to.be.instanceOf(WeakSet);
  });

  it('rolls direct runtime state back when scalar cutover source commit fails', () => {
    const source = `const Example = component({ fill: 'red' });`;
    const root = { id: 'runtime-root', name: 'example', fill: 'green', owner: null };
    const sourceError = new Error('source cutover failed');
    const tracker = Object.create(ComponentChangeTracker.prototype);
    tracker.trackedComponent = root;
    tracker.componentModuleId = 'local://scalar-cutover/component.cp.js';
    tracker.componentModule = {
      _source: source,
      setSource (nextSource) {
        if (nextSource !== source) throw sourceError;
        this._source = nextSource;
      }
    };
    tracker.componentDescriptor = {
      componentName: 'Example',
      makeDirty: () => {},
      refreshDependants: () => {}
    };
    tracker.committedChangeAdapter = new MorphicChangeSetAdapter({
      componentId: 'local://scalar-cutover/component.cp.js::Example',
      containsMorph: () => true
    });
    tracker.scheduleShadowProjectionComparison = () => null;
    const committed = changeSet(new SetMorphProperty({
      targetId: root.id, property: 'fill', before: 'red', after: 'green'
    }));

    let error;
    try {
      tracker.processCommittedChangeSet(committed, {
        legacyChanges: [{}],
        resolveMorph: id => id === root.id ? root : null
      });
    } catch (caughtError) {
      error = caughtError;
    }

    expect(error).equals(sourceError);
    expect(tracker.componentModule._source).equals(source);
    expect(root.fill).equals('red');
  });

  it('releases the committed change listener when a tracker is disposed', () => {
    const removed = [];
    const tracker = Object.create(ComponentChangeTracker.prototype);
    tracker._committedChangeListener = () => {};
    tracker.trackedComponent = {
      env: {
        changeManager: {
          removeCommittedChangeListener: listener => removed.push(listener)
        }
      },
      _changeTracker: tracker
    };

    tracker.dispose();

    expect(removed).deep.equals([tracker._committedChangeListener]);
    expect(tracker.trackedComponent).not.haveOwnProperty('_changeTracker');
  });
});
