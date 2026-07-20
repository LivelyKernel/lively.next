/* global describe, it */
import { expect } from 'mocha-es6';
import { RenameNode, SetProperty } from '../../components/reconciliation/commands.js';
import {
  ComponentRuntimeCommitMode,
  ComponentTransactionDirection,
  ComponentTransactionConflictError,
  ComponentTransactionPlanningDiagnosticKind,
  ComponentTransactionRollbackError,
  ComponentTransactionState,
  ProjectionalComponentEditTransaction,
  applyPreparedComponentTransaction,
  commitPreparedComponentTransaction,
  prepareScalarComponentTransaction
} from '../../components/reconciliation/component-transaction.js';
import { parseComponentSource } from '../../components/reconciliation/source-adapter.js';
import {
  PreparedPolicyCachePropertyTransaction,
  PreparedPolicyCacheRenameTransaction,
  ProjectionalPolicyCachePropertyEditTransaction,
  ProjectionalPolicyCacheEditTransaction,
  applyPreparedPolicyCacheProperties,
  applyPreparedPolicyCacheRenames
} from '../../components/reconciliation/policy-cache-transaction.js';

const moduleId = 'local://projectional-transaction-test/component.cp.js';
const componentId = `${moduleId}#Example`;
const source = `const Example = component({
  name: 'example',
  fill: 'red'
});`;

function parsedDocument () {
  return parseComponentSource({
    source,
    moduleId,
    exportName: 'Example',
    componentId
  }).document;
}

function commandFor (document, value = 'green') {
  return SetProperty({
    componentId,
    expectedRevision: document.revision,
    nodeId: document.root.id,
    property: 'fill',
    value
  });
}

function prepare (document, options = {}) {
  return prepareScalarComponentTransaction({
    id: 'component-transaction',
    source,
    document,
    command: commandFor(document),
    resolveRuntimeTargetId: () => 'runtime-root',
    ...options
  });
}

function storesFor (state, options = {}) {
  return {
    sourceStore: {
      read: () => state.source,
      write: value => { state.source = value; },
      ...options.sourceStore
    },
    documentStore: {
      read: () => state.document,
      write: value => { state.document = value; },
      ...options.documentStore
    },
    runtimeContext: {
      resolveMorph: id => id === state.runtime.id ? state.runtime : null,
      setMorphProperty: (morph, property, value) => { morph[property] = value; },
      ...options.runtimeContext
    }
  };
}

function captureError (callback) {
  try {
    callback();
  } catch (error) {
    return error;
  }
  throw new Error('Expected callback to fail');
}

describe('projectional component transaction coordinator', () => {
  it('prepares and atomically commits source, document, and runtime state', () => {
    const document = parsedDocument();
    const preparation = prepare(document);
    const state = {
      source,
      document,
      runtime: { id: 'runtime-root', fill: 'red' }
    };

    expect(preparation.supported).to.be.true;
    expect(state.source).equals(source);
    expect(state.document).equals(document);
    expect(state.runtime.fill).equals('red');

    const result = commitPreparedComponentTransaction(
      preparation.transaction,
      storesFor(state)
    );

    expect(result.state).equals(ComponentTransactionState.COMMITTED);
    expect(state.source).includes('fill: "green"');
    expect(state.document).equals(preparation.transaction.document);
    expect(state.document.revision).equals(1);
    expect(state.runtime.fill).equals('green');
  });

  it('leaves every domain untouched when source planning fails', () => {
    const document = parsedDocument();
    const preparation = prepareScalarComponentTransaction({
      id: 'unsupported-source-transaction',
      source,
      document,
      command: commandFor(document, () => 'not serializable'),
      resolveRuntimeTargetId: () => 'runtime-root'
    });

    expect(preparation.supported).to.be.false;
    expect(preparation.transaction).equals(null);
    expect(preparation.diagnostics[0].kind)
      .equals(ComponentTransactionPlanningDiagnosticKind.SOURCE_PROJECTION_FAILED);
  });

  it('rejects stale document revisions during planning', () => {
    const document = parsedDocument();
    const staleCommand = SetProperty({
      componentId,
      expectedRevision: document.revision + 1,
      nodeId: document.root.id,
      property: 'fill',
      value: 'green'
    });
    const preparation = prepareScalarComponentTransaction({
      id: 'stale-document-transaction',
      source,
      document,
      command: staleCommand,
      resolveRuntimeTargetId: () => 'runtime-root'
    });

    expect(preparation.supported).to.be.false;
    expect(preparation.transaction).equals(null);
    expect(preparation.diagnostics[0].kind)
      .equals(ComponentTransactionPlanningDiagnosticKind.REDUCTION_FAILED);
    expect(preparation.diagnostics[0].message).includes('revision');
  });

  it('detects stale source before mutating the document or runtime', () => {
    const document = parsedDocument();
    const preparation = prepare(document);
    const state = {
      source: `${source}\n// concurrent edit`,
      document,
      runtime: { id: 'runtime-root', fill: 'red' }
    };

    const error = captureError(() => commitPreparedComponentTransaction(
      preparation.transaction,
      storesFor(state)
    ));

    expect(error).to.be.instanceOf(ComponentTransactionConflictError);
    expect(state.document).equals(document);
    expect(state.runtime.fill).equals('red');
  });

  it('validates runtime preconditions before committing source or document state', () => {
    const document = parsedDocument();
    const preparation = prepare(document);
    const state = {
      source,
      document,
      runtime: { id: 'runtime-root', fill: 'blue' }
    };

    const error = captureError(() => commitPreparedComponentTransaction(
      preparation.transaction,
      storesFor(state)
    ));

    expect(error.message).includes('Precondition failed');
    expect(state.source).equals(source);
    expect(state.document).equals(document);
    expect(state.runtime.fill).equals('blue');
  });

  it('restores source and document state when runtime projection fails', () => {
    const document = parsedDocument();
    const preparation = prepare(document);
    const state = {
      source,
      document,
      runtime: { id: 'runtime-root', fill: 'red' }
    };
    const runtimeError = new Error('runtime commit failed');
    const stores = storesFor(state, {
      runtimeContext: {
        setMorphProperty: () => { throw runtimeError; }
      }
    });

    const error = captureError(() => commitPreparedComponentTransaction(
      preparation.transaction,
      stores
    ));

    expect(error).equals(runtimeError);
    expect(state.source).equals(source);
    expect(state.document).equals(document);
    expect(state.runtime.fill).equals('red');
  });

  it('adopts an already-applied runtime change without applying it twice', () => {
    const document = parsedDocument();
    const preparation = prepare(document);
    const state = {
      source,
      document,
      runtime: { id: 'runtime-root', fill: 'green' }
    };
    let runtimeWrites = 0;
    const stores = storesFor(state, {
      runtimeContext: {
        setMorphProperty: (morph, property, value) => {
          runtimeWrites++;
          morph[property] = value;
        }
      }
    });

    const result = commitPreparedComponentTransaction(
      preparation.transaction,
      {
        ...stores,
        runtimeCommitMode: ComponentRuntimeCommitMode.ADOPT_ALREADY_APPLIED
      }
    );

    expect(result.runtimeCommitMode)
      .equals(ComponentRuntimeCommitMode.ADOPT_ALREADY_APPLIED);
    expect(runtimeWrites).equals(0);
    expect(state.source).includes('fill: "green"');
    expect(state.document).equals(preparation.transaction.document);
    expect(state.runtime.fill).equals('green');
  });

  it('applies marked supplemental runtime changes while adopting direct mutations', () => {
    class LayoutState {}
    const layoutSource = `const Example = component({
  name: 'example',
  layout: new TilingLayout({ resizePolicies: [['child', { width: 'fill' }]] }),
  submorphs: [{ name: 'child' }]
});`;
    const document = parseComponentSource({
      source: layoutSource,
      moduleId,
      exportName: 'Example',
      componentId
    }).document;
    const child = document.root.children[0];
    const beforeLayout = new LayoutState();
    const afterLayout = new LayoutState();
    const preparation = prepareScalarComponentTransaction({
      id: 'layout-adoption',
      source: layoutSource,
      document,
      command: RenameNode({
        componentId,
        expectedRevision: document.revision,
        nodeId: child.id,
        name: 'renamed'
      }),
      resolveRuntimeTargetId: id => id === child.id
        ? 'runtime-child'
        : id === document.root.id ? 'runtime-root' : null,
      resolveRuntimeLayout: () => ({
        ownerId: 'runtime-root',
        before: beforeLayout,
        after: afterLayout,
        applyWhenAdopting: true
      })
    });
    const runtimeRoot = { id: 'runtime-root', layout: beforeLayout };
    const runtimeChild = { id: 'runtime-child', name: 'renamed', owner: runtimeRoot };
    const state = { source: layoutSource, document };
    let layoutWrites = 0;
    const result = commitPreparedComponentTransaction(preparation.transaction, {
      sourceStore: {
        read: () => state.source,
        write: value => { state.source = value; }
      },
      documentStore: {
        read: () => state.document,
        write: value => { state.document = value; }
      },
      runtimeContext: {
        resolveMorph: id => id === runtimeRoot.id
          ? runtimeRoot
          : id === runtimeChild.id ? runtimeChild : null,
        setMorphProperty: (morph, property, value) => {
          if (property === 'layout') layoutWrites++;
          morph[property] = value;
        }
      },
      runtimeCommitMode: ComponentRuntimeCommitMode.ADOPT_ALREADY_APPLIED
    });

    expect(result.runtimeCommitMode)
      .equals(ComponentRuntimeCommitMode.ADOPT_ALREADY_APPLIED);
    expect(layoutWrites).equals(1);
    expect(runtimeRoot.layout).equals(afterLayout);
    expect(runtimeChild.name).equals('renamed');
  });

  it('reverses an adopted runtime change if a later domain cannot commit', () => {
    const document = parsedDocument();
    const preparation = prepare(document);
    const state = {
      source,
      document,
      runtime: { id: 'runtime-root', fill: 'green' }
    };
    const sourceError = new Error('source commit failed');
    const stores = storesFor(state, {
      sourceStore: {
        write: value => {
          state.source = value;
          if (value !== source) throw sourceError;
        }
      }
    });

    const error = captureError(() => commitPreparedComponentTransaction(
      preparation.transaction,
      {
        ...stores,
        runtimeCommitMode: ComponentRuntimeCommitMode.ADOPT_ALREADY_APPLIED
      }
    ));

    expect(error).equals(sourceError);
    expect(state.source).equals(source);
    expect(state.document).equals(document);
    expect(state.runtime.fill).equals('red');
  });

  it('replays a prepared component transaction backward and forward', () => {
    const document = parsedDocument();
    const preparation = prepare(document);
    const state = {
      source,
      document,
      runtime: { id: 'runtime-root', fill: 'red' }
    };
    const adapters = storesFor(state);
    commitPreparedComponentTransaction(preparation.transaction, adapters);
    const editTransaction = new ProjectionalComponentEditTransaction(
      preparation.transaction,
      adapters
    );

    editTransaction.reverseApply();
    expect(state.source).equals(source);
    expect(state.document).equals(document);
    expect(state.runtime.fill).equals('red');

    editTransaction.apply();
    expect(state.source).includes('fill: "green"');
    expect(state.document).equals(preparation.transaction.document);
    expect(state.runtime.fill).equals('green');
  });

  it('compensates reverse source and document writes if runtime undo fails', () => {
    const document = parsedDocument();
    const preparation = prepare(document);
    const state = {
      source,
      document,
      runtime: { id: 'runtime-root', fill: 'red' }
    };
    let failRuntime = false;
    const adapters = storesFor(state, {
      runtimeContext: {
        setMorphProperty: (morph, property, value) => {
          if (failRuntime) throw new Error('runtime undo failed');
          morph[property] = value;
        }
      }
    });
    commitPreparedComponentTransaction(preparation.transaction, adapters);
    failRuntime = true;

    const error = captureError(() => applyPreparedComponentTransaction(
      preparation.transaction,
      { ...adapters, direction: ComponentTransactionDirection.REVERSE }
    ));

    expect(error.message).equals('runtime undo failed');
    expect(state.source).includes('fill: "green"');
    expect(state.document).equals(preparation.transaction.document);
    expect(state.runtime.fill).equals('green');
  });

  it('reports incomplete compensation when a rollback store fails', () => {
    const document = parsedDocument();
    const preparation = prepare(document);
    const state = {
      source,
      document,
      runtime: { id: 'runtime-root', fill: 'red' }
    };
    const runtimeError = new Error('runtime commit failed');
    const rollbackError = new Error('source rollback failed');
    let sourceWrites = 0;
    const stores = storesFor(state, {
      sourceStore: {
        write: value => {
          sourceWrites++;
          if (sourceWrites === 2) throw rollbackError;
          state.source = value;
        }
      },
      runtimeContext: {
        setMorphProperty: () => { throw runtimeError; }
      }
    });

    const error = captureError(() => commitPreparedComponentTransaction(
      preparation.transaction,
      stores
    ));

    expect(error).to.be.instanceOf(ComponentTransactionRollbackError);
    expect(error.cause).equals(runtimeError);
    expect(error.rollbackErrors).deep.equals([rollbackError]);
    expect(state.document).equals(document);
    expect(state.source).not.equals(source);
  });
});

describe('projectional policy cache transaction', () => {
  it('replays cached policy property values by identity', () => {
    const before = ['before', null];
    const after = ['after', { fontWeight: 'bold' }];
    const transaction = new PreparedPolicyCachePropertyTransaction({
      id: 'policy-text',
      changes: [{
        id: 'Example#text',
        property: 'textAndAttributes',
        beforeValue: before,
        afterValue: after
      }]
    });
    const state = { value: before };
    const stores = new Map([['Example#text', {
      read: () => state.value,
      write: value => { state.value = value; }
    }]]);

    applyPreparedPolicyCacheProperties(transaction, { stores });
    const edit = new ProjectionalPolicyCachePropertyEditTransaction(transaction, stores);
    expect(state.value).equals(after);

    edit.reverseApply();
    expect(state.value).equals(before);

    edit.apply();
    expect(state.value).equals(after);
  });

  it('replays cached policy renames exactly backward and forward', () => {
    const transaction = new PreparedPolicyCacheRenameTransaction({
      id: 'policy-rename',
      renames: [{ id: 'Example#child', beforeName: 'before', afterName: 'after' }]
    });
    const state = { name: 'before' };
    const stores = new Map([['Example#child', {
      read: () => state.name,
      write: name => { state.name = name; }
    }]]);

    applyPreparedPolicyCacheRenames(transaction, { stores });
    const edit = new ProjectionalPolicyCacheEditTransaction(transaction, stores);
    expect(state.name).equals('after');

    edit.reverseApply();
    expect(state.name).equals('before');

    edit.apply();
    expect(state.name).equals('after');
  });

  it('compensates earlier policy writes when a later cache write fails', () => {
    const transaction = new PreparedPolicyCacheRenameTransaction({
      id: 'policy-rename-failure',
      renames: [
        { id: 'base', beforeName: 'before', afterName: 'after' },
        { id: 'derived', beforeName: 'before', afterName: 'after' }
      ]
    });
    const state = { base: 'before', derived: 'before' };
    const stores = new Map([
      ['base', {
        read: () => state.base,
        write: name => { state.base = name; }
      }],
      ['derived', {
        read: () => state.derived,
        write: name => {
          if (name === 'after') throw new Error('derived cache failed');
          state.derived = name;
        }
      }]
    ]);

    const error = captureError(() => applyPreparedPolicyCacheRenames(transaction, { stores }));

    expect(error.message).equals('derived cache failed');
    expect(state).deep.equals({ base: 'before', derived: 'before' });
  });
});
