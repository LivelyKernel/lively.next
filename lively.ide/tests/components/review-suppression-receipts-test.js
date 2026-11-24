/* global describe, it */
import { expect } from 'mocha-es6';
import { RestoreInheritedNode, SuppressInheritedNode } from '../../components/reconciliation/commands.js';
import { reduceComponent } from '../../components/reconciliation/reducer.js';
import { parseComponentSource } from '../../components/reconciliation/source-adapter.js';
import { alignParsedDocumentIdentities, componentDocumentsSemanticallyEqual, projectComponentSource } from '../../components/reconciliation/source-projector.js';

const moduleId = 'local://suppression-receipt.cp.js';
const base = parseComponentSource({ moduleId, exportName: 'Base',
  source: "const Base = component({ name: 'Base', submorphs: [{ name: 'label', submorphs: [{ name: 'icon' }] }] });" }).document;
const source = "const Derived = component(Base, { name: 'Derived', submorphs: [{ name: 'label', opacity: 0.5, submorphs: [{ name: 'icon', opacity: 0.8 }, add({ name: 'extra' })] }] });";

/** Exercise the ordinary reducer and source preflight together. */
function project (state, command) {
  const reduction = reduceComponent(state.document, command);
  const result = projectComponentSource({ source: state.source, beforeDocument: state.document, reduction });
  expect(result.supported, 'receipt: every projection must pass its semantic preflight: ' + JSON.stringify(result.diagnostics)).equals(true);
  return { source: result.sourceAfter, document: result.projectedDocument, inverse: reduction.inverseCommand };
}

/** Start from an inherited override with a local addition. */
function initial () {
  return { source, document: parseComponentSource({ source, moduleId, exportName: 'Derived', parentDocument: base }).document };
}

/** Select a command using the current revision and a stable node identity. */
function command (state, type, node) {
  return type({ componentId: state.document.componentId, expectedRevision: state.document.revision,
    nodeId: node.id, parentId: state.document.root.children[0].id, beforeId: null });
}

describe('projectional suppression recovery receipts', () => {
  it('keeps detached recovery outside source and restores the exact retained subtree', () => {
    const before = initial();
    const label = before.document.root.children[0];
    const hidden = project(before, command(before, SuppressInheritedNode, label));
    expect(hidden.source, 'receipt: suppression must discard the old source override').not.includes('opacity: 0.5');
    expect(hidden.source, 'receipt: suppression must discard descendant additions from source').not.includes("name: 'extra'");
    expect(hidden.document.root.children[0].children.map(node => node.name),
      'receipt: retain the detached children for exact runtime inverse replay').deep.equals(['icon', 'extra']);
    const restored = project(hidden, hidden.inverse);
    expect(componentDocumentsSemanticallyEqual(restored.document, before.document),
      'receipt: restoration must recover properties, addition and stable identities').equals(true);
    const tampered = parseComponentSource({ source: hidden.source.replace('without("label")', ''),
      moduleId, exportName: 'Derived', parentDocument: base });
    expect(componentDocumentsSemanticallyEqual(alignParsedDocumentIdentities(tampered.document, hidden.document), hidden.document),
      'receipt: an absent suppression marker must not satisfy the captured endpoint').equals(false);
    const conflicting = parseComponentSource({ source: hidden.source.replace('without("label")',
      '{ name: "label", opacity: 0.9 }, without("label")'), moduleId, exportName: 'Derived', parentDocument: base });
    expect(componentDocumentsSemanticallyEqual(alignParsedDocumentIdentities(conflicting.document, hidden.document), hidden.document),
      'receipt: a conflicting explicit override must not be hidden by the receipt').equals(false);
  });

  it('updates a nested receipt while its ancestor has no source override', () => {
    const before = initial();
    const icon = before.document.root.children[0].children[0];
    let state = project(before, command(before, SuppressInheritedNode, icon));
    state = project(state, command(state, SuppressInheritedNode, state.document.root.children[0]));
    expect(state.source, 'nested receipt: the ancestor override must be removed').not.includes('opacity: 0.5');
    const hiddenSource = state.source;
    state = project(state, command(state, RestoreInheritedNode, state.document.root.children[0].children[0]));
    expect(state.source, 'nested receipt: restoration inside a detached subtree needs no dormant source').equals(hiddenSource);
    const label = state.document.root.children[0];
    state = project(state, RestoreInheritedNode({ componentId: state.document.componentId,
      expectedRevision: state.document.revision, nodeId: label.id,
      parentId: state.document.root.id, beforeId: null }));
    expect(state.document.root.children[0].children[0].provenance.suppressed,
      'nested receipt: restoring the parent must preserve the latest child endpoint').equals(false);
    expect(state.source, 'nested receipt: old nested suppression must not return').not.includes('without("icon")');
  });
});
