/* global describe, it */
import { expect } from 'mocha-es6';
import {
  ComponentProjectionFuzzOperationKind,
  ComponentProjectionFuzzer,
  DEFAULT_COMPONENT_PROJECTION_FUZZ_OPERATIONS
} from '../../components/reconciliation/component-projection-fuzzer.js';
import { parseComponentSource } from '../../components/reconciliation/source-adapter.js';
import {
  ComponentDocument,
  ComponentNode,
  localNodeProvenance
} from '../../components/reconciliation/component-document.js';
import {
  alignParsedDocumentIdentities,
  componentDocumentsSemanticallyEqual
} from '../../components/reconciliation/source-projector.js';

function runFuzzer (seed, steps) {
  return runConfiguredFuzzer({ seed }, steps);
}

function runConfiguredFuzzer (options, steps) {
  try {
    return new ComponentProjectionFuzzer(options).run(steps);
  } catch (error) {
    throw new Error(JSON.stringify({
      message: error.message,
      cause: error.cause?.message,
      causeStack: error.cause?.stack,
      seed: error.seed ?? options.seed,
      step: error.step,
      operation: error.operation,
      action: error.action,
      actions: error.actions,
      source: error.source,
      layoutModels: error.layoutModels,
      layoutReferenceLocations: error.layoutReferenceLocations
    }, null, 2));
  }
}

describe('component projection fuzzer', function () {
  this.timeout(120000);

  it('replays deterministic semantic command sequences', () => {
    const first = runFuzzer('projection replay', 24);
    const second = runFuzzer('projection replay', 24);

    expect(first.actions).to.eql(second.actions);
    expect(first.source).to.equal(second.source);
    expect(first.runtime).to.eql(second.runtime);
    expect(componentDocumentsSemanticallyEqual(first.document, second.document)).to.be.true;
  });

  it('keeps reducer, source, runtime, inverse commands, and transaction replay aligned', () => {
    const seeds = [0x51CA1A, 0xC0FFEE, 0xBAD5EED, 0xDEC0DE];
    const coveredOperations = new Set();
    const operationCounts = new Map();

    for (const seed of seeds) {
      const result = runFuzzer(seed, 32);
      const reparsed = parseComponentSource({
        source: result.source,
        moduleId: result.document.moduleId,
        exportName: result.document.exportName,
        componentId: result.document.componentId
      });
      expect(reparsed.supported).to.be.true;
      expect(componentDocumentsSemanticallyEqual(
        alignParsedDocumentIdentities(reparsed.document, result.document),
        result.document
      )).to.be.true;
      result.actions.forEach(({ operation }) => {
        coveredOperations.add(operation);
        operationCounts.set(operation, (operationCounts.get(operation) || 0) + 1);
      });
    }

    for (const operation of DEFAULT_COMPONENT_PROJECTION_FUZZ_OPERATIONS) {
      expect(
        coveredOperations.has(operation),
        `expected semantic fuzz operation ${operation} to run`
      ).to.be.true;
    }
    expect(operationCounts.get(ComponentProjectionFuzzOperationKind.INTRODUCE_FINAL_NODE))
      .to.be.greaterThan(seeds.length);
    expect(operationCounts.get(ComponentProjectionFuzzOperationKind.REMOVE_FINAL_NODE))
      .to.be.greaterThan(seeds.length);
    expect(operationCounts.get(ComponentProjectionFuzzOperationKind.REORDER_NODE))
      .to.be.greaterThan(0);
    expect(operationCounts.get(ComponentProjectionFuzzOperationKind.REPARENT_NODE))
      .to.be.greaterThan(seeds.length);
  });

  it('sustains repeated cross-parent moves without losing subtree identity', () => {
    const seeds = ['reparent-a', 'reparent-b', 'reparent-c', 'reparent-d'];
    for (const seed of seeds) {
      const result = new ComponentProjectionFuzzer({
        seed,
        operations: [ComponentProjectionFuzzOperationKind.REPARENT_NODE]
      }).run(128);
      expect(result.actions).to.have.length(128);
      expect(result.actions.every(({ operation }) =>
        operation === ComponentProjectionFuzzOperationKind.REPARENT_NODE)).to.be.true;
    }
  });

  it('stress tests structural edits through nested modeled tiling layouts', () => {
    const source = `const Subject = component({
  name: 'layout subject',
  layout: new TilingLayout({
    resizePolicies: [
      ['first', { height: 'fixed', width: 'fill' }],
      ['group', { height: 'fill', width: 'fixed' }],
      ['last', { height: 'fixed', width: 'fixed' }]
    ]
  }),
  submorphs: [{
    name: 'first'
  }, {
    name: 'group',
    layout: new TilingLayout({
      resizePolicies: [
        ['nested first', { height: 'fill', width: 'fill' }],
        ['nested last', { height: 'fixed', width: 'fill' }]
      ]
    }),
    submorphs: [{ name: 'nested first' }, { name: 'nested last' }]
  }, {
    name: 'last'
  }]
});`;
    const operations = [
      ComponentProjectionFuzzOperationKind.RENAME_NODE,
      ComponentProjectionFuzzOperationKind.INTRODUCE_FINAL_NODE,
      ComponentProjectionFuzzOperationKind.REMOVE_FINAL_NODE,
      ComponentProjectionFuzzOperationKind.REORDER_NODE,
      ComponentProjectionFuzzOperationKind.REPARENT_NODE
    ];

    for (const seed of ['layout-structure-a', 'layout-structure-b', 'layout-structure-c']) {
      const result = runConfiguredFuzzer({ seed, source, operations }, 192);
      expect(result.actions).to.have.length(192);
      expect(new Set(result.actions.map(({ operation }) => operation)).size)
        .equals(operations.length);
    }
  });

  it('alternates inherited suppression and restoration without losing identity', () => {
    const parentDocument = new ComponentDocument({
      componentId: 'parent',
      moduleId: 'local://component-projection-fuzz/parent.cp.js',
      exportName: 'Parent',
      root: new ComponentNode({
        id: 'parent-root', name: 'parent', provenance: localNodeProvenance(),
        children: [new ComponentNode({
          id: 'inherited-first', name: 'inherited first', provenance: localNodeProvenance()
        }), new ComponentNode({
          id: 'inherited-second', name: 'inherited second', provenance: localNodeProvenance()
        })]
      })
    });
    const source = `const Subject = component(Parent, { name: 'derived subject' });`;
    const operations = [
      ComponentProjectionFuzzOperationKind.SUPPRESS_INHERITED_NODE,
      ComponentProjectionFuzzOperationKind.RESTORE_INHERITED_NODE
    ];

    for (const seed of ['inherited-a', 'inherited-b', 'inherited-c', 'inherited-d']) {
      const result = new ComponentProjectionFuzzer({
        seed, source, parentDocument, operations
      }).run(256);
      expect(result.actions).to.have.length(256);
      expect([...new Set(result.actions.map(({ operation }) => operation))].sort())
        .deep.equals(operations.slice().sort());
      expect(result.document.root.children.map(({ id }) => id))
        .deep.equals(['inherited-first', 'inherited-second']);
    }
  });

  it('fuzzes inherited visibility through resolved nested part overrides', () => {
    const partDocument = new ComponentDocument({
      componentId: 'part',
      moduleId: 'local://component-projection-fuzz/part.cp.js',
      exportName: 'Part',
      root: new ComponentNode({
        id: 'part-root', name: 'part', provenance: localNodeProvenance(),
        children: [new ComponentNode({
          id: 'part-label', name: 'label', provenance: localNodeProvenance(),
          children: [new ComponentNode({
            id: 'part-icon', name: 'icon', provenance: localNodeProvenance()
          })]
        })]
      })
    });
    const source = `const Subject = component({
  name: 'subject',
  submorphs: [part(Part, {
    name: 'part instance',
    submorphs: [{ name: 'label', submorphs: [] }]
  })]
});`;
    const operations = [
      ComponentProjectionFuzzOperationKind.SUPPRESS_INHERITED_NODE,
      ComponentProjectionFuzzOperationKind.RESTORE_INHERITED_NODE
    ];

    for (const seed of ['nested-part-a', 'nested-part-b']) {
      const result = new ComponentProjectionFuzzer({
        seed,
        source,
        operations,
        resolveComponentDocument: ({ expression }) =>
          expression === 'Part' ? partDocument : null
      }).run(256);
      expect(result.actions).to.have.length(256);
      expect(result.document.root.children[0].children[0].name).equals('label');
      expect(result.document.root.children[0].children[0].children[0].name).equals('icon');
    }
  });
});
