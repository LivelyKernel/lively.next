/* global describe, it */
import { expect } from 'mocha-es6';
import {
  IntroduceNode,
  MoveNode,
  RemoveNode,
  RenameNode
} from '../../components/reconciliation/commands.js';
import {
  ComponentDocument,
  ComponentNode,
  findComponentNode,
  localNodeProvenance
} from '../../components/reconciliation/component-document.js';
import {
  DerivedProjectionDiagnosticKind,
  planDerivedComponentRenamePropagation,
  projectDerivedComponentRename,
  projectDerivedComponentStructure
} from '../../components/reconciliation/derived-projector.js';
import {
  DerivedPropagationConflictError,
  PreparedDerivedPropagationTransaction,
  PreparedDerivedRuntimeRenameTransaction,
  ProjectionalDerivedEditTransaction,
  ProjectionalDerivedRuntimeEditTransaction,
  applyPreparedDerivedPropagation,
  applyPreparedDerivedRuntimeRenames
} from '../../components/reconciliation/derived-transaction.js';
import { reduceComponent } from '../../components/reconciliation/reducer.js';

function parentDocument () {
  return new ComponentDocument({
    componentId: 'parent',
    moduleId: 'local://derived-projection/parent.cp.js',
    exportName: 'Parent',
    root: new ComponentNode({
      id: 'parent-root', name: 'parent', provenance: localNodeProvenance(),
      children: [new ComponentNode({
        id: 'container', name: 'container', provenance: localNodeProvenance(),
        children: [new ComponentNode({
          id: 'target', name: 'target', provenance: localNodeProvenance()
        })]
      })]
    })
  });
}

function renamedParent (document, name = 'renamed target') {
  return reduceComponent(document, RenameNode({
    componentId: document.componentId,
    expectedRevision: document.revision,
    nodeId: 'target',
    name
  })).document;
}

describe('projectional derived component projector', () => {
  it('propagates rename selectors, suppressions, and ordering anchors', () => {
    const beforeParentDocument = parentDocument();
    const afterParentDocument = renamedParent(beforeParentDocument);
    const source = `const Derived = component(Parent, {
  name: 'derived',
  submorphs: [{
    name: 'container',
    submorphs: [
      { name: 'target', fill: 'red' },
      without('target'),
      add({ name: 'added' }, 'target')
    ]
  }]
});`;
    const projection = projectDerivedComponentRename({
      source,
      moduleId: 'local://derived-projection/derived.cp.js',
      exportName: 'Derived',
      beforeParentDocument,
      afterParentDocument,
      nodeId: 'target'
    });
    const target = findComponentNode(projection.document, 'target');
    const added = findComponentNode(
      projection.document,
      projection.document.root.children[0].children.find(({ name }) => name === 'added').id
    );

    expect(projection.supported).to.be.true;
    expect(projection.changes).to.have.length(3);
    expect(projection.sourceAfter.match(/renamed target/g)).to.have.length(3);
    expect(projection.sourceAfter).not.includes("'target'");
    expect(target.name).equals('renamed target');
    expect(target.provenance.suppressed).to.be.true;
    expect(added.provenance.beforeId).equals(target.id);
  });

  it('propagates inherited identity without editing a source that has no selector', () => {
    const beforeParentDocument = parentDocument();
    const afterParentDocument = renamedParent(beforeParentDocument);
    const source = `const Derived = component(Parent, { name: 'derived' });`;
    const projection = projectDerivedComponentRename({
      source,
      moduleId: 'local://derived-projection/derived.cp.js',
      exportName: 'Derived',
      beforeParentDocument,
      afterParentDocument,
      nodeId: 'target'
    });

    expect(projection.supported).to.be.true;
    expect(projection.sourceAfter).equals(source);
    expect(projection.changes).deep.equals([]);
    expect(findComponentNode(projection.document, 'target').name).equals('renamed target');
  });

  it('propagates renames through static derived owner-layout references', () => {
    const beforeParentDocument = parentDocument();
    const afterParentDocument = renamedParent(beforeParentDocument);
    const source = `const Derived = component(Parent, {
  name: 'derived',
  submorphs: [{
    name: 'container',
    layout: new TilingLayout({
      resizePolicies: [['target', { height: 'fixed', width: 'fill' }]]
    })
  }]
});`;
    const projection = projectDerivedComponentRename({
      source,
      moduleId: 'local://derived-projection/layout.cp.js',
      exportName: 'Derived',
      beforeParentDocument,
      afterParentDocument,
      nodeId: 'target'
    });

    expect(projection.supported).to.be.true;
    expect(projection.changes).length(1);
    expect(projection.sourceAfter)
      .includes("resizePolicies: [[\"renamed target\", { height: 'fixed', width: 'fill' }]]");
    expect(findComponentNode(projection.document, 'target').name).equals('renamed target');
  });

  it('rejects derived rename propagation through an unmodeled owner layout', () => {
    const beforeParentDocument = parentDocument();
    const afterParentDocument = renamedParent(beforeParentDocument);
    const source = `const Derived = component(Parent, {
  name: 'derived',
  submorphs: [{
    name: 'container',
    layout: new TilingLayout({ resizePolicies: policies })
  }]
});`;
    const projection = projectDerivedComponentRename({
      source,
      moduleId: 'local://derived-projection/dynamic-layout.cp.js',
      exportName: 'Derived',
      beforeParentDocument,
      afterParentDocument,
      nodeId: 'target'
    });

    expect(projection.supported).to.be.false;
    expect(projection.sourceAfter).equals(source);
    expect(projection.diagnostics[0].kind)
      .equals(DerivedProjectionDiagnosticKind.SOURCE_UNSUPPORTED);
  });

  it('rejects a propagation request without a matching parent transition', () => {
    const beforeParentDocument = parentDocument();
    const projection = projectDerivedComponentRename({
      source: `const Derived = component(Parent, { name: 'derived' });`,
      moduleId: 'local://derived-projection/derived.cp.js',
      exportName: 'Derived',
      beforeParentDocument,
      afterParentDocument: beforeParentDocument,
      nodeId: 'missing'
    });

    expect(projection.supported).to.be.false;
    expect(projection.diagnostics[0].kind)
      .equals(DerivedProjectionDiagnosticKind.INVALID_PARENT_TRANSITION);
  });

  it('inherits a parent introduction without rewriting compatible derived source', () => {
    const beforeParentDocument = parentDocument();
    const introduced = new ComponentNode({
      id: 'introduced',
      name: 'introduced',
      provenance: localNodeProvenance()
    });
    const afterParentDocument = reduceComponent(beforeParentDocument, IntroduceNode({
      componentId: beforeParentDocument.componentId,
      expectedRevision: beforeParentDocument.revision,
      nodeId: introduced.id,
      parentId: 'container',
      node: introduced,
      beforeId: null
    })).document;
    const source = `const Derived = component(Parent, { name: 'derived' });`;
    const projection = projectDerivedComponentStructure({
      source,
      moduleId: 'local://derived-projection/derived.cp.js',
      exportName: 'Derived',
      beforeParentDocument,
      afterParentDocument
    });

    expect(projection.supported).to.be.true;
    expect(projection.sourceAfter).equals(source);
    expect(findComponentNode(projection.document, introduced.id).name).equals('introduced');
  });

  it('inherits removals while retaining dormant derived override intent', () => {
    const beforeParentDocument = parentDocument();
    const afterParentDocument = reduceComponent(beforeParentDocument, RemoveNode({
      componentId: beforeParentDocument.componentId,
      expectedRevision: beforeParentDocument.revision,
      nodeId: 'target'
    })).document;
    const plain = projectDerivedComponentStructure({
      source: `const Derived = component(Parent, { name: 'derived' });`,
      moduleId: 'local://derived-projection/plain.cp.js',
      exportName: 'Derived',
      beforeParentDocument,
      afterParentDocument
    });
    const overridden = projectDerivedComponentStructure({
      source: `const Derived = component(Parent, {
  name: 'derived',
  submorphs: [{ name: 'container', submorphs: [{ name: 'target', fill: 'red' }] }]
});`,
      moduleId: 'local://derived-projection/overridden.cp.js',
      exportName: 'Derived',
      beforeParentDocument,
      afterParentDocument
    });

    expect(plain.supported).to.be.true;
    expect(findComponentNode(plain.document, 'target')).equals(null);
    const retained = findComponentNode(overridden.document, 'container:inherited:target');
    expect(overridden.supported).to.be.true;
    expect(overridden.sourceAfter).includes("name: 'target', fill: 'red'");
    expect(retained.provenance.suppressed).to.be.true;
    expect(retained.properties.fill.value).equals('red');
  });

  it('removes static derived layout policies for removed parent nodes', () => {
    const beforeParentDocument = parentDocument();
    const afterParentDocument = reduceComponent(beforeParentDocument, RemoveNode({
      componentId: beforeParentDocument.componentId,
      expectedRevision: beforeParentDocument.revision,
      nodeId: 'target'
    })).document;
    const source = `const Derived = component(Parent, {
  name: 'derived',
  submorphs: [{
    name: 'container',
    layout: new TilingLayout({
      resizePolicies: [['target', { height: 'fixed', width: 'fill' }]]
    })
  }]
});`;
    const projection = projectDerivedComponentStructure({
      source,
      moduleId: 'local://derived-projection/layout-removal.cp.js',
      exportName: 'Derived',
      beforeParentDocument,
      afterParentDocument
    });

    expect(projection.supported).to.be.true;
    expect(projection.changes).length(1);
    expect(projection.sourceAfter).includes('resizePolicies: []');
    expect(projection.sourceAfter).not.includes("'target'");
    expect(projection.document.layoutModels[0].references).deep.equals([]);
  });

  it('removes static derived layout policies when parent nodes move away', () => {
    const beforeParentDocument = parentDocument();
    const afterParentDocument = reduceComponent(beforeParentDocument, MoveNode({
      componentId: beforeParentDocument.componentId,
      expectedRevision: beforeParentDocument.revision,
      nodeId: 'target',
      parentId: 'parent-root',
      beforeId: null
    })).document;
    const source = `const Derived = component(Parent, {
  name: 'derived',
  submorphs: [{
    name: 'container',
    layout: new TilingLayout({
      resizePolicies: [['target', { height: 'fixed', width: 'fill' }]]
    })
  }]
});`;
    const projection = projectDerivedComponentStructure({
      source,
      moduleId: 'local://derived-projection/layout-move.cp.js',
      exportName: 'Derived',
      beforeParentDocument,
      afterParentDocument
    });

    expect(projection.supported).to.be.true;
    expect(projection.changes).length(1);
    expect(projection.sourceAfter).includes('resizePolicies: []');
    expect(findComponentNode(projection.document, 'target')).not.equals(null);
  });

  it('reactivates retained derived overrides when the parent node returns', () => {
    const beforeParentDocument = parentDocument();
    const removal = reduceComponent(beforeParentDocument, RemoveNode({
      componentId: beforeParentDocument.componentId,
      expectedRevision: beforeParentDocument.revision,
      nodeId: 'target'
    }));
    const restoredParentDocument = reduceComponent(
      removal.document,
      removal.inverseCommand
    ).document;
    const source = `const Derived = component(Parent, {
  name: 'derived',
  submorphs: [{ name: 'container', submorphs: [{ name: 'target', fill: 'red' }] }]
});`;
    const dormant = projectDerivedComponentStructure({
      source,
      moduleId: 'local://derived-projection/retained.cp.js',
      exportName: 'Derived',
      beforeParentDocument,
      afterParentDocument: removal.document
    });
    const restored = projectDerivedComponentStructure({
      source: dormant.sourceAfter,
      moduleId: 'local://derived-projection/retained.cp.js',
      exportName: 'Derived',
      beforeParentDocument: removal.document,
      afterParentDocument: restoredParentDocument
    });
    const target = findComponentNode(restored.document, 'target');

    expect(dormant.supported).to.be.true;
    expect(restored.supported).to.be.true;
    expect(target.provenance.suppressed).to.be.false;
    expect(target.properties.fill.value).equals('red');
  });

  it('clears a derived add ordering anchor removed by its parent', () => {
    const beforeParentDocument = parentDocument();
    const afterParentDocument = reduceComponent(beforeParentDocument, RemoveNode({
      componentId: beforeParentDocument.componentId,
      expectedRevision: beforeParentDocument.revision,
      nodeId: 'target'
    })).document;
    const source = `const Derived = component(Parent, {
  name: 'derived',
  submorphs: [{
    name: 'container',
    submorphs: [add({ name: 'added' }, 'target')]
  }]
});`;
    const projection = projectDerivedComponentStructure({
      source,
      moduleId: 'local://derived-projection/ordered.cp.js',
      exportName: 'Derived',
      beforeParentDocument,
      afterParentDocument
    });
    const added = projection.document?.root.children[0].children
      .find(({ name }) => name === 'added');

    expect(projection.supported).to.be.true;
    expect(projection.changes).to.have.length(1);
    expect(projection.sourceAfter).includes("add({ name: 'added' })");
    expect(projection.sourceAfter).not.includes("'target'");
    expect(added.provenance.beforeId).equals(null);
  });

  it('plans recursive propagation while composing components that share a module', () => {
    const beforeParentDocument = parentDocument();
    const afterParentDocument = renamedParent(beforeParentDocument);
    const child = { id: 'child' };
    const sibling = { id: 'sibling' };
    const grandchild = { id: 'grandchild' };
    const sharedSource = `const Child = component(Parent, {
  name: 'child', submorphs: [{ name: 'container', submorphs: [{ name: 'target' }] }]
});
const Sibling = component(Parent, {
  name: 'sibling', submorphs: [{ name: 'container', submorphs: [without('target')] }]
});`;
    const descriptions = new Map([
      [child, {
        source: sharedSource,
        moduleId: 'local://derived-projection/shared.cp.js',
        exportName: 'Child'
      }],
      [sibling, {
        source: sharedSource,
        moduleId: 'local://derived-projection/shared.cp.js',
        exportName: 'Sibling'
      }],
      [grandchild, {
        source: `const Grandchild = component(Child, {
  name: 'grandchild',
  submorphs: [{ name: 'container', submorphs: [add({ name: 'added' }, 'target')] }]
});`,
        moduleId: 'local://derived-projection/grandchild.cp.js',
        exportName: 'Grandchild'
      }]
    ]);
    const dependants = new Map([
      ['root', [child, sibling]],
      [child, [grandchild]],
      [sibling, []],
      [grandchild, []]
    ]);
    const plan = planDerivedComponentRenamePropagation({
      root: 'root',
      beforeParentDocument,
      afterParentDocument,
      nodeId: 'target',
      getDependants: descriptor => dependants.get(descriptor) || [],
      describeComponent: descriptor => descriptions.get(descriptor)
    });

    expect(plan.supported).to.be.true;
    expect(plan.components).to.have.length(3);
    expect(plan.modules).to.have.length(2);
    const sharedPlan = plan.modules.find(({ moduleId }) => moduleId.includes('shared'));
    expect(sharedPlan.sourceAfter.match(/renamed target/g)).to.have.length(2);
    const grandchildPlan = plan.modules.find(({ moduleId }) => moduleId.includes('grandchild'));
    expect(grandchildPlan.sourceAfter).includes('"renamed target"');
  });

  it('rejects a cyclic derivation graph without returning partial module writes', () => {
    const beforeParentDocument = parentDocument();
    const afterParentDocument = renamedParent(beforeParentDocument);
    const child = { id: 'child' };
    const descriptions = new Map([[child, {
      source: `const Child = component(Parent, { name: 'child' });`,
      moduleId: 'local://derived-projection/child.cp.js',
      exportName: 'Child'
    }]]);
    const plan = planDerivedComponentRenamePropagation({
      root: child,
      beforeParentDocument,
      afterParentDocument,
      nodeId: 'target',
      getDependants: () => [child],
      describeComponent: descriptor => descriptions.get(descriptor)
    });

    expect(plan.supported).to.be.false;
    expect(plan.modules).deep.equals([]);
    expect(plan.diagnostics[0].kind)
      .equals(DerivedProjectionDiagnosticKind.DEPENDENCY_GRAPH_INVALID);
  });

  it('commits and replays derived module sources as one reversible edit', () => {
    const values = new Map([['a', 'a0'], ['b', 'b0']]);
    const stores = new Map([...values.keys()].map(moduleId => [moduleId, {
      read: () => values.get(moduleId),
      write: source => values.set(moduleId, source)
    }]));
    const transaction = new PreparedDerivedPropagationTransaction({
      id: 'derived-1',
      modules: [
        { moduleId: 'a', sourceBefore: 'a0', sourceAfter: 'a1' },
        { moduleId: 'b', sourceBefore: 'b0', sourceAfter: 'b1' }
      ]
    });
    const edit = new ProjectionalDerivedEditTransaction(transaction, stores);

    applyPreparedDerivedPropagation(transaction, { stores });
    expect([...values.values()]).deep.equals(['a1', 'b1']);
    edit.reverseApply();
    expect([...values.values()]).deep.equals(['a0', 'b0']);
    edit.apply();
    expect([...values.values()]).deep.equals(['a1', 'b1']);
  });

  it('validates every derived source before writing any module', () => {
    const values = new Map([['a', 'a0'], ['b', 'stale']]);
    let writes = 0;
    const stores = new Map([...values.keys()].map(moduleId => [moduleId, {
      read: () => values.get(moduleId),
      write: source => { writes++; values.set(moduleId, source); }
    }]));
    const transaction = new PreparedDerivedPropagationTransaction({
      id: 'derived-conflict',
      modules: [
        { moduleId: 'a', sourceBefore: 'a0', sourceAfter: 'a1' },
        { moduleId: 'b', sourceBefore: 'b0', sourceAfter: 'b1' }
      ]
    });

    expect(() => applyPreparedDerivedPropagation(transaction, { stores }))
      .to.throw(DerivedPropagationConflictError);
    expect(writes).equals(0);
    expect(values.get('a')).equals('a0');
  });

  it('rolls back earlier derived modules when a later write fails', () => {
    const values = new Map([['a', 'a0'], ['b', 'b0']]);
    const stores = new Map([
      ['a', {
        read: () => values.get('a'),
        write: source => values.set('a', source)
      }],
      ['b', {
        read: () => values.get('b'),
        write: source => {
          if (source === 'b1') throw new Error('write failed');
          values.set('b', source);
        }
      }]
    ]);
    const transaction = new PreparedDerivedPropagationTransaction({
      id: 'derived-rollback',
      modules: [
        { moduleId: 'a', sourceBefore: 'a0', sourceAfter: 'a1' },
        { moduleId: 'b', sourceBefore: 'b0', sourceAfter: 'b1' }
      ]
    });

    expect(() => applyPreparedDerivedPropagation(transaction, { stores }))
      .to.throw('write failed');
    expect([...values.values()]).deep.equals(['a0', 'b0']);
  });

  it('commits and replays cached derived runtime renames', () => {
    const names = new Map([['child', 'before'], ['grandchild', 'before']]);
    const stores = new Map([...names.keys()].map(id => [id, {
      read: () => names.get(id),
      write: name => names.set(id, name)
    }]));
    const transaction = new PreparedDerivedRuntimeRenameTransaction({
      id: 'derived-runtime',
      renames: [...names.keys()].map(id => ({
        id,
        beforeName: 'before',
        afterName: 'after'
      }))
    });
    const edit = new ProjectionalDerivedRuntimeEditTransaction(transaction, stores);

    applyPreparedDerivedRuntimeRenames(transaction, { stores });
    expect([...names.values()]).deep.equals(['after', 'after']);
    edit.reverseApply();
    expect([...names.values()]).deep.equals(['before', 'before']);
    edit.apply();
    expect([...names.values()]).deep.equals(['after', 'after']);
  });
});
