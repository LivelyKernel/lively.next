/* global describe, it, System */
import { expect } from 'mocha-es6';
import {
  ComponentDocument,
  ComponentLayoutKind,
  ComponentLayoutReferenceKind,
  ComponentNode,
  ComponentNodeProvenanceKind,
  ComponentPropertyKind,
  ComponentReferenceKind,
  localNodeProvenance
} from '../../components/reconciliation/component-document.js';
import {
  ComponentSourceDiagnosticKind,
  parseComponentSource
} from '../../components/reconciliation/source-adapter.js';
import { ComponentImportKind } from '../../components/reconciliation/import-bindings.js';

const moduleId = 'local://projectional-source-test/component.cp.js';

function parseSource (source, exportName = 'Example') {
  return parseComponentSource({ source, moduleId, exportName });
}

describe('projectional component source adapter', () => {
  it('parses simple component trees and preserves opaque expressions', () => {
    const source = `
import { component } from 'lively.morphic/components/core.js';
import { Color, pt as point } from 'lively.graphics';
import { Text } from 'lively.morphic';

export const Example = component({
  name: 'example',
  fill: Color.red,
  opacity: 0.5,
  reactsToPointer: true,
  padding: { top: 1, right: 2, bottom: 3, left: 4 },
  extent: point(100, 50),
  submorphs: [{
    type: Text,
    name: 'label',
    textString: 'hello',
    fontSize: 14
  }]
});`;
    const parsed = parseSource(source);
    const { document } = parsed;

    expect(parsed.supported).to.be.true;
    expect(document.componentId).equals(`${moduleId}#Example`);
    expect(document.root.id).equals(`${moduleId}#Example:root`);
    expect(document.root.properties.fill.kind)
      .equals(ComponentPropertyKind.OPAQUE_EXPRESSION);
    expect(document.root.properties.fill.expression).equals('Color.red');
    expect(document.root.properties.opacity.value).equals(0.5);
    expect(document.root.properties.padding.value)
      .deep.equals({ top: 1, right: 2, bottom: 3, left: 4 });
    expect(document.root.properties.extent.expression).equals('point(100, 50)');
    expect(document.root.children[0].name).equals('label');
    expect(document.root.children[0].typeExpression).equals('Text');
    expect(document.root.children[0].properties.textString.value).equals('hello');
    expect(document.sourceMetadata.importBindings).deep.include({
      kind: ComponentImportKind.NAMED,
      moduleId: 'lively.graphics',
      imported: 'pt',
      local: 'point'
    });
    const fillRange = document.sourceMetadata.propertyLocations[document.root.id].fill.value;
    expect(source.slice(fillRange.start, fillRange.end)).equals('Color.red');
  });

  it('keeps owners with generated submorphs projectionally editable', () => {
    const source = `const Example = component({
  name: 'example',
  submorphs: [{
    name: 'date array',
    layout: new TilingLayout({ spacing: 2 }),
    submorphs: arr.range(1, 41).map(i => part(DateDefault, {
      name: 'day ' + i
    }))
  }]
});`;
    const parsed = parseSource(source);
    const dateArray = parsed.document.root.children[0];
    const opaqueRange = parsed.document.sourceMetadata
      .opaqueSubmorphExpressions[dateArray.id];

    expect(parsed.supported).to.be.true;
    expect(dateArray.name).equals('date array');
    expect(dateArray.children).deep.equals([]);
    expect(parsed.diagnostics[0]).include({
      kind: ComponentSourceDiagnosticKind.OPAQUE_SUBMORPH_STRUCTURE,
      severity: 'warning',
      ownerId: dateArray.id
    });
    expect(source.slice(opaqueRange.start, opaqueRange.end))
      .equals(`arr.range(1, 41).map(i => part(DateDefault, {
      name: 'day ' + i
    }))`);
  });

  it('models static tiling-layout resize policies as stable node references', () => {
    const source = `const Example = component({
  name: 'example',
  layout: new TilingLayout({
    resizePolicies: [['label', { height: 'fixed', width: 'fill' }]]
  }),
  submorphs: [{ name: 'label' }, { name: 'icon' }]
});`;
    const { supported, document, diagnostics } = parseSource(source);
    const label = document.root.children[0];
    const [layoutModel] = document.layoutModels;
    const [reference] = layoutModel.references;
    const location = document.sourceMetadata
      .layoutReferenceLocations[document.root.id][label.id];

    expect(supported).to.be.true;
    expect(diagnostics).deep.equals([]);
    expect(layoutModel.kind).equals(ComponentLayoutKind.TILING);
    expect(layoutModel.ownerId).equals(document.root.id);
    expect(layoutModel.expressionTemplate).includes('<component-resize-policies>');
    expect(reference.kind).equals(ComponentLayoutReferenceKind.RESIZE_POLICY);
    expect(reference.targetId).equals(label.id);
    expect(reference.expressionTemplate).includes('<component-layout-target>');
    expect(source.slice(location.target.start, location.target.end)).equals("'label'");
    expect(source.slice(location.entry.start, location.entry.end))
      .equals("['label', { height: 'fixed', width: 'fill' }]");
  });

  it('keeps dynamic and unresolved tiling-layout references outside the semantic model', () => {
    const dynamic = parseSource(`const Example = component({
  name: 'example',
  layout: new TilingLayout({ resizePolicies: policies }),
  submorphs: [{ name: 'label' }]
});`);
    const unresolved = parseSource(`const Example = component({
  name: 'example',
  layout: new TilingLayout({ resizePolicies: [['missing', { width: 'fill' }]] }),
  submorphs: [{ name: 'label' }]
});`);

    expect(dynamic.supported).to.be.true;
    expect(dynamic.document.layoutModels).deep.equals([]);
    expect(dynamic.diagnostics.map(({ kind }) => kind))
      .deep.equals([ComponentSourceDiagnosticKind.UNMODELED_LAYOUT_REFERENCE]);
    expect(unresolved.supported).to.be.true;
    expect(unresolved.document.layoutModels).deep.equals([]);
    expect(unresolved.diagnostics[0]).include({
      kind: ComponentSourceDiagnosticKind.UNMODELED_LAYOUT_REFERENCE,
      targetName: 'missing'
    });
  });

  it('parses root-only derived overrides with an explicit parent reference', () => {
    const source = `const Example = component(BaseComponent, {
  name: 'derived',
  fill: Color.blue
});`;
    const { supported, document } = parseSource(source);

    expect(supported).to.be.true;
    expect(document.parentComponent.kind).equals(ComponentReferenceKind.SOURCE_EXPRESSION);
    expect(document.parentComponent.expression).equals('BaseComponent');
    expect(document.root.properties.fill.expression).equals('Color.blue');
  });

  it('merges resolved inherited nodes with derived without markers', () => {
    const parentDocument = new ComponentDocument({
      componentId: 'parent',
      moduleId: 'local://parent.cp.js',
      exportName: 'BaseComponent',
      root: new ComponentNode({
        id: 'parent-root', name: 'parent', provenance: localNodeProvenance(),
        children: [new ComponentNode({
          id: 'inherited-child', name: 'inherited child', provenance: localNodeProvenance()
        })]
      })
    });
    const source = `const Example = component(BaseComponent, {
  name: 'derived',
  submorphs: [without('inherited child')]
});`;
    const parsed = parseComponentSource({
      source, moduleId, exportName: 'Example', parentDocument
    });
    const inherited = parsed.document.root.children[0];

    expect(parsed.supported).to.be.true;
    expect(inherited.id).equals('inherited-child');
    expect(inherited.provenance.kind).equals(ComponentNodeProvenanceKind.INHERITED);
    expect(inherited.provenance.suppressed).to.be.true;
    const location = parsed.document.sourceMetadata.suppressionLocations[inherited.id];
    expect(source.slice(location.start, location.end)).equals("without('inherited child')");
  });

  it('rejects a supplied parent document for a different component expression', () => {
    const parentDocument = parseSource("const Base = component({ name: 'base' });", 'Base').document;
    const parsed = parseComponentSource({
      source: "const Example = component(Other, { name: 'example' });",
      moduleId, exportName: 'Example', parentDocument
    });
    expect(parsed.supported).to.be.false;
    expect(parsed.document).equals(null);
    expect(parsed.diagnostics[0].message).includes('Other');
    expect(parsed.diagnostics[0].message).includes('Base');
  });

  it('accepts a parent alias resolved to the supplied document identity', () => {
    const parentDocument = parseSource("const Base = component({ name: 'base' });", 'Base').document;
    const parsed = parseComponentSource({
      source: "const Example = component(Alias, { name: 'example' });",
      moduleId, exportName: 'Example', parentDocument,
      resolveComponentDocument: ({ expression }) => expression === 'Alias' ? parentDocument : null
    });
    expect(parsed.supported).to.be.true;
    expect(parsed.document.sourceMetadata.parentDocument).equals(parentDocument);
  });

  for (const [binding, expression] of [
    ["{ Base as Parent }", 'Parent'],
    ['* as parents', 'parents.Base']
  ]) {
    it(`F7 normalizes a package-style parent binding through ${expression}`, () => {
      const parentDocument = parseComponentSource({
        source: "const Base = component({ name: 'base', submorphs: [{ name: 'child' }] });",
        moduleId: System.decanonicalize('lively.components/buttons.cp.js'),
        exportName: 'Base'
      }).document;
      const normalizations = [];
      const parsed = parseComponentSource({
        source: `import ${binding} from 'lively.components/buttons.cp.js';
const Example = component(${expression}, { name: 'example' });`,
        moduleId, exportName: 'Example', parentDocument,
        resolveComponentDocument: () => null,
        normalizeModuleId: (id, from) => {
          normalizations.push([id, from]);
          return System.decanonicalize(id, from);
        }
      });
      expect(parsed.supported, JSON.stringify(parsed.diagnostics)).to.be.true;
      expect(parsed.document.root.children[0].name).equals('child');
      expect(normalizations).deep.includes(['lively.components/buttons.cp.js', moduleId]);
    });
  }

  it('F7 keeps a normalized different module or export distinct and the resolver authoritative', () => {
    const parentDocument = parseComponentSource({
      source: "const Base = component({ name: 'base' });",
      moduleId: System.decanonicalize('lively.components/buttons.cp.js'),
      exportName: 'Base'
    }).document;
    const normalizeModuleId = (id, from) => System.decanonicalize(id, from);
    for (const [specifier, imported] of [
      ['lively.components/inputs.cp.js', 'Base'],
      ['lively.components/buttons.cp.js', 'Other']
    ]) {
      const parsed = parseComponentSource({
        source: `import { ${imported} as Parent } from '${specifier}';
const Example = component(Parent, { name: 'example' });`,
        moduleId, exportName: 'Example', parentDocument, normalizeModuleId
      });
      expect(parsed.supported).to.be.false;
      expect(parsed.diagnostics[0].kind).equals(ComponentSourceDiagnosticKind.PARENT_COMPONENT_MISMATCH);
    }
    const resolvedOther = parseSource("const Other = component({ name: 'other' });", 'Other').document;
    let normalizationCalls = 0;
    const parsed = parseComponentSource({
      source: `import { Base } from 'lively.components/buttons.cp.js';
const Example = component(Base, { name: 'example' });`,
      moduleId, exportName: 'Example', parentDocument,
      resolveComponentDocument: () => resolvedOther,
      normalizeModuleId: () => { normalizationCalls++; throw new Error('Resolved identity takes precedence'); }
    });
    expect(parsed.supported).to.be.false;
    expect(parsed.diagnostics[0].kind).equals(ComponentSourceDiagnosticKind.PARENT_COMPONENT_MISMATCH);
    expect(normalizationCalls).equals(0);
  });

  it('rejects a supplied parent document from another module exporting the same name', () => {
    const parentDocument = parseSource("const Base = component({ name: 'base' });", 'Base').document;
    const parsed = parseComponentSource({
      source: "import { Base } from './other.cp.js'; const Example = component(Base, { name: 'example' });",
      moduleId, exportName: 'Example', parentDocument
    });
    expect(parsed.supported).to.be.false;
    expect(parsed.document).equals(null);
  });

  for (const [importSource, expression] of [
    ["import { Base as Alias } from './base.cp.js';", 'Alias'],
    ["import * as components from './base.cp.js';", 'components.Base']
  ]) {
    it(`verifies a relative parent binding through ${expression}`, () => {
      const parentDocument = parseComponentSource({
        source: "const Base = component({ name: 'base' });",
        moduleId: 'local://projectional-source-test/base.cp.js', exportName: 'Base'
      }).document;
      const parsed = parseComponentSource({
        source: `${importSource} const Example = component(${expression}, { name: 'example' });`,
        moduleId, exportName: 'Example', parentDocument
      });
      expect(parsed.supported).to.be.true;
    });
  }

  it('forces a fresh replacement to take its target name', () => {
    const parentDocument = new ComponentDocument({
      componentId: 'parent',
      moduleId: 'local://parent.cp.js',
      exportName: 'BaseComponent',
      root: new ComponentNode({
        id: 'parent-root', name: 'parent', provenance: localNodeProvenance(),
        children: [new ComponentNode({
          id: 'inherited-child', name: 'before', provenance: localNodeProvenance()
        })]
      })
    });
    const source = `const Example = component(BaseComponent, {
  name: 'derived',
  submorphs: [replace('before', { name: 'after', fill: 'red' })]
});`;
    const parsed = parseComponentSource({
      source, moduleId, exportName: 'Example', parentDocument
    });
    const inherited = parsed.document.root.children[0];

    expect(parsed.supported).to.be.true;
    expect(inherited.id).equals('inherited-child');
    expect(inherited.name).equals('before');
    expect(inherited.provenance.kind).equals(ComponentNodeProvenanceKind.INHERITED);
    expect(inherited.provenance.baseName).equals('before');
    expect(inherited.provenance.hasLocalOverrides).to.be.true;
    expect(inherited.properties.fill.value).equals('red');
    const location = parsed.document.sourceMetadata.nodeIdToAstLocation[inherited.id];
    expect(source.slice(location.start, location.end))
      .equals("replace('before', { name: 'after', fill: 'red' })");
  });

  for (const [kind, replacement, type, fill, children] of [
    ['plain', "{ name: 'different', fill: 'blue', submorphs: [{ name: 'fresh' }] }", null, 'blue', ['fresh']],
    ['typed', "{ type: Morph, name: 'different', fill: 'blue' }", 'Morph', 'blue', []],
    ['part', "part(Card, { name: 'different' })", 'Morph', 'green', ['part child']]
  ]) {
    it(`T10b models fresh ${kind} replacement state without the old Text subtree`, () => {
      const parentDocument = parseSource(`const Base = component({ name: 'base', submorphs: [{
        type: Text, name: 'label', fill: 'red', textString: 'old text', opacity: 0.2,
        position: pt(20, 30), rotation: 0.5, submorphs: [{ name: 'old child' }]
      }] });`, 'Base').document;
      const partDocument = parseSource(`const Card = component({ name: 'card', type: Morph,
        fill: 'green', submorphs: [{ name: 'part child' }] });`, 'Card').document;
      const parsed = parseComponentSource({
        source: `const Example = component(Base, { name: 'derived', submorphs: [replace('label', ${replacement})] });`,
        moduleId, exportName: 'Example', parentDocument,
        resolveComponentDocument: ({ expression }) => expression === 'Card' ? partDocument : null
      });
      expect(parsed.supported, JSON.stringify(parsed.diagnostics)).equals(true);
      const child = parsed.document.root.children[0];
      expect(child.name).equals('label');
      expect(child.typeExpression).equals(type);
      expect(child.properties.fill.value).equals(fill);
      expect(child.properties.textString).equals(undefined);
      expect(child.properties.opacity).equals(undefined);
      expect(child.properties.position.expression).equals('pt(20, 30)');
      expect(child.properties.rotation.value).equals(0.5);
      expect(child.children.map(node => node.name)).deep.equals(children);
      expect(parsed.document.sourceMetadata.inheritedPropertyEntries[child.id]?.textString).equals(undefined);
    });
  }

  it('T10b matches effective names and keeps unknown derived overrides dormant with a warning', () => {
    const base = parseSource("const Base = component({ name: 'base', submorphs: [{ name: 'label' }] });", 'Base').document;
    const first = parseComponentSource({
      source: "const D1 = component(Base, { name: 'first', submorphs: [replace('label', { name: 'ignored', fill: 'blue' })] });",
      moduleId, exportName: 'D1', parentDocument: base
    });
    expect(first.supported).equals(true);
    const valid = parseComponentSource({
      source: "const Example = component(D1, { name: 'second', submorphs: [{ name: 'label', opacity: 0.4 }] });",
      moduleId, exportName: 'Example', parentDocument: first.document
    });
    expect(valid.supported, JSON.stringify(valid.diagnostics)).equals(true);
    expect(valid.document.root.children).has.length(1);
    expect(valid.document.root.children[0].name).equals('label');
    expect(valid.document.root.children[0].provenance.suppressed).equals(false);
    expect(valid.document.root.children[0].properties.fill.value).equals('blue');
    const stale = parseComponentSource({
      source: "const Example = component(D1, { name: 'second', submorphs: [{ name: 'ignored', opacity: 0.4 }] });",
      moduleId, exportName: 'Example', parentDocument: first.document
    });
    expect(stale.supported, JSON.stringify(stale.diagnostics)).equals(true);
    expect(stale.document.root.children.map(child => child.name)).deep.equals(['label', 'ignored']);
    expect(stale.document.root.children[0].provenance.suppressed).equals(false);
    expect(stale.document.root.children[1].provenance.suppressed).equals(true);
    expect(stale.document.root.children[1].properties.opacity.value).equals(0.4);
    expect(stale.diagnostics).has.length(1);
    expect(stale.diagnostics[0]).include({
      kind: ComponentSourceDiagnosticKind.DORMANT_OVERRIDE,
      severity: 'warning',
      targetName: 'ignored'
    });
    expect(stale.diagnostics[0].message).includes('dormant');
  });

  it('merges nested derived overrides and additions into a resolved parent tree', () => {
    const parentDocument = new ComponentDocument({
      componentId: 'parent',
      moduleId: 'local://parent.cp.js',
      exportName: 'BaseComponent',
      root: new ComponentNode({
        id: 'parent-root', name: 'parent', provenance: localNodeProvenance(),
        children: [new ComponentNode({
          id: 'parent-group', name: 'group', provenance: localNodeProvenance(),
          children: [new ComponentNode({
            id: 'parent-label', name: 'label', provenance: localNodeProvenance()
          }), new ComponentNode({
            id: 'parent-body', name: 'body', provenance: localNodeProvenance()
          })]
        }), new ComponentNode({
          id: 'parent-existing', name: 'existing', provenance: localNodeProvenance()
        })]
      })
    });
    const cardDocument = new ComponentDocument({
      componentId: 'card',
      moduleId: 'local://card.cp.js',
      exportName: 'Card',
      root: new ComponentNode({
        id: 'card-root', name: 'card', provenance: localNodeProvenance()
      })
    });
    const source = `const Example = component(BaseComponent, {
  name: 'derived',
  submorphs: [{
    name: 'group',
    opacity: 0.5,
    submorphs: [without('label'), add({ name: 'badge' }, 'body')]
  }, add(part(Card), 'existing')]
});`;
    const parsed = parseComponentSource({
      source,
      moduleId,
      exportName: 'Example',
      parentDocument,
      resolveComponentDocument: ({ expression }) =>
        expression === 'Card' ? cardDocument : null
    });
    const [group, card, existing] = parsed.document.root.children;
    const [label, badge, body] = group.children;

    expect(parsed.supported).to.be.true;
    expect(group.id).equals('parent-group');
    expect(group.provenance.hasLocalOverrides).to.be.true;
    expect(group.properties.opacity.value).equals(0.5);
    expect(label.id).equals('parent-label');
    expect(label.provenance.suppressed).to.be.true;
    expect(badge.provenance.beforeId).equals(body.id);
    expect(card.name).equals('card');
    expect(card.provenance.kind).equals(ComponentNodeProvenanceKind.ADDED);
    expect(card.provenance.beforeId).equals(existing.id);
    expect(existing.id).equals('parent-existing');
  });

  it('uses deterministic source-path identities across equivalent parses', () => {
    const source = `const Example = component({
  name: 'example',
  submorphs: [{ name: 'first' }, { name: 'second' }]
});`;
    const first = parseSource(source).document;
    const second = parseSource(source).document;

    expect(first).deep.equals(second);
    expect(first.root.children.map(({ id }) => id)).deep.equals([
      `${moduleId}#Example:node:0`,
      `${moduleId}#Example:node:1`
    ]);
  });

  it('parses named part and add structures with semantic references and ordering anchors', () => {
    const source = `const Example = component({
  name: 'example',
  submorphs: [part(Card, {
    name: 'card',
    submorphs: [add({ name: 'badge' }, 'label'), { name: 'label' }]
  }), add(part(Button, { name: 'button' }), 'card')]
});`;
    const parsed = parseSource(source);
    const card = parsed.document.root.children.find(({ name }) => name === 'card');
    const button = parsed.document.root.children.find(({ name }) => name === 'button');
    const [badge, label] = card.children;

    expect(parsed.supported).to.be.true;
    expect(card.partComponent.expression).equals('Card');
    expect(card.provenance.kind).equals(ComponentNodeProvenanceKind.LOCAL);
    expect(button.partComponent.expression).equals('Button');
    expect(button.provenance.kind).equals(ComponentNodeProvenanceKind.ADDED);
    expect(button.provenance.beforeId).equals(card.id);
    expect(parsed.document.root.children.map(({ name }) => name))
      .deep.equals(['button', 'card']);
    expect(badge.provenance.kind).equals(ComponentNodeProvenanceKind.ADDED);
    expect(badge.provenance.beforeId).equals(label.id);
    const buttonLocation = parsed.document.sourceMetadata.nodeIdToAstLocation[button.id];
    expect(source.slice(buttonLocation.start, buttonLocation.end))
      .equals("add(part(Button, { name: 'button' }), 'card')");
    const buttonSpecLocation = parsed.document.sourceMetadata.nodeSpecLocations[button.id];
    expect(source.slice(buttonSpecLocation.start, buttonSpecLocation.end))
      .equals("{ name: 'button' }");
  });

  it('preserves static ordering anchors to unresolved inherited part children', () => {
    const parsed = parseSource(`const Example = component({
  name: 'example',
  submorphs: [part(Card, {
    name: 'card',
    submorphs: [
      add({ name: 'moved' }, 'inherited child'),
      add({ name: 'local addition' })
    ]
  })]
});`);
    const [moved, localAddition] = parsed.document.root.children[0].children;

    expect(parsed.supported).to.be.true;
    expect([moved.name, localAddition.name])
      .deep.equals(['moved', 'local addition']);
    expect(moved.provenance).containSubset({
      kind: ComponentNodeProvenanceKind.ADDED,
      beforeId: null,
      beforeName: 'inherited child'
    });
  });

  it('models named overrides in unresolved parts as inherited edit targets', () => {
    const parsed = parseSource(`const Example = component({
  name: 'example',
  submorphs: [part(Card, {
    name: 'card',
    submorphs: [{
      name: 'inherited child',
      submorphs: [add({ name: 'addition' })]
    }]
  })]
});`);
    const inherited = parsed.document.root.children[0].children[0];

    expect(parsed.supported).to.be.true;
    expect(inherited.provenance).containSubset({
      kind: ComponentNodeProvenanceKind.INHERITED,
      suppressed: false,
      hasLocalOverrides: true,
      baseName: 'inherited child'
    });
    expect(inherited.children[0].provenance.kind)
      .equals(ComponentNodeProvenanceKind.ADDED);
  });

  it('keeps nested named overrides in unresolved parts visible recursively', () => {
    const parsed = parseSource(`const Example = component({
  name: 'example',
  submorphs: [part(Card, {
    name: 'card',
    submorphs: [{
      name: 'inherited child',
      submorphs: [{ name: 'nested inherited child', opacity: 0.5 }]
    }]
  })]
});`);
    const inherited = parsed.document.root.children[0].children[0];
    const nestedInherited = inherited.children[0];

    expect(parsed.supported).to.be.true;
    expect(inherited.provenance).containSubset({
      kind: ComponentNodeProvenanceKind.INHERITED,
      suppressed: false,
      hasLocalOverrides: true
    });
    expect(nestedInherited.provenance).containSubset({
      kind: ComponentNodeProvenanceKind.INHERITED,
      suppressed: false,
      hasLocalOverrides: true,
      baseName: 'nested inherited child'
    });
    expect(nestedInherited.properties.opacity.value).equals(0.5);
  });

  it('resolves unnamed parts and nested structural overrides with instance-local identities', () => {
    const cardDocument = new ComponentDocument({
      componentId: 'card',
      moduleId: 'local://card.cp.js',
      exportName: 'Card',
      root: new ComponentNode({
        id: 'card-root', name: 'card', provenance: localNodeProvenance(),
        children: [new ComponentNode({
          id: 'card-label', name: 'label', provenance: localNodeProvenance(),
          children: [new ComponentNode({
            id: 'card-icon', name: 'icon', provenance: localNodeProvenance()
          })]
        }), new ComponentNode({
          id: 'card-body', name: 'body', provenance: localNodeProvenance()
        })]
      })
    });
    const source = `const Example = component({
  name: 'example',
  submorphs: [part(Card, {
    name: 'first card',
    submorphs: [{
      name: 'label',
      textString: 'overridden',
      submorphs: [without('icon'), add({ name: 'badge' })]
    }, add({ name: 'footer' }, 'body')]
  }), part(Card)]
});`;
    const parsed = parseComponentSource({
      source,
      moduleId,
      exportName: 'Example',
      resolveComponentDocument: ({ expression }) =>
        expression === 'Card' ? cardDocument : null
    });
    const [firstCard, secondCard] = parsed.document.root.children;
    const label = firstCard.children.find(({ name }) => name === 'label');
    const icon = label.children.find(({ name }) => name === 'icon');
    const badge = label.children.find(({ name }) => name === 'badge');

    expect(parsed.supported).to.be.true;
    expect(secondCard.name).equals('card');
    expect(firstCard.children.map(({ name }) => name))
      .deep.equals(['label', 'footer', 'body']);
    expect(label.provenance).deep.equals({
      kind: ComponentNodeProvenanceKind.INHERITED,
      suppressed: false,
      hasLocalOverrides: true,
      beforeId: null,
      baseName: 'label'
    });
    expect(label.properties.textString.value).equals('overridden');
    expect(icon.provenance.suppressed).to.be.true;
    expect(badge.provenance.kind).equals(ComponentNodeProvenanceKind.ADDED);
    expect(firstCard.children.find(({ name }) => name === 'footer').provenance.beforeId)
      .equals(firstCard.children.find(({ name }) => name === 'body').id);
    expect(firstCard.children[0].id).not.equals(secondCard.children[0].id);
    expect(new Set([
      firstCard.children[0].id,
      firstCard.children[1].id,
      firstCard.children[2].id,
      secondCard.children[0].id,
      secondCard.children[1].id
    ]).size).equals(5);
  });

  it('reports unresolved derived and unnamed part structures without partial documents', () => {
    const derived = parseSource(`const Example = component(Base, {
  name: 'derived',
  submorphs: [{ name: 'override' }]
});`);
    const unresolvedPart = parseSource(`const Example = component({
  name: 'example',
  submorphs: [part(Other)]
});`);

    expect(derived.supported).to.be.false;
    expect(derived.document).equals(null);
    expect(derived.diagnostics[0].kind)
      .equals(ComponentSourceDiagnosticKind.DERIVED_STRUCTURE_REQUIRES_PARENT);
    expect(unresolvedPart.supported).to.be.false;
    expect(unresolvedPart.document).equals(null);
    expect(unresolvedPart.diagnostics[0].kind)
      .equals(ComponentSourceDiagnosticKind.UNRESOLVED_PART_COMPONENT);
  });

  it('rejects unknown nested override targets and dynamic ordering anchors', () => {
    const partDocument = new ComponentDocument({
      componentId: 'part',
      moduleId: 'local://part.cp.js',
      exportName: 'Part',
      root: new ComponentNode({
        id: 'part-root', name: 'part', provenance: localNodeProvenance(),
        children: [new ComponentNode({
          id: 'known', name: 'known', provenance: localNodeProvenance()
        })]
      })
    });
    const unknownOverride = parseComponentSource({
      source: `const Example = component({
  submorphs: [part(Part, { name: 'instance', submorphs: [{ name: 'missing' }] })]
});`,
      moduleId,
      exportName: 'Example',
      resolveComponentDocument: () => partDocument
    });
    const dynamicAnchor = parseSource(`const Example = component({
  submorphs: [add({ name: 'addition' }, selectedAnchor), { name: 'target' }]
});`);

    expect(unknownOverride.supported).to.be.false;
    expect(unknownOverride.document).equals(null);
    expect(unknownOverride.diagnostics[0].kind)
      .equals(ComponentSourceDiagnosticKind.UNSUPPORTED_SUBMORPH_STRUCTURE);
    expect(dynamicAnchor.supported).to.be.false;
    expect(dynamicAnchor.document).equals(null);
    expect(dynamicAnchor.diagnostics[0].kind)
      .equals(ComponentSourceDiagnosticKind.INVALID_ORDERING_REFERENCE);
  });

  it('returns diagnostics for syntax errors and missing declarations', () => {
    const invalid = parseSource('const Example = component({');
    const missing = parseSource('const Different = component({ name: \'different\' });');

    expect(invalid.diagnostics[0].kind).equals(ComponentSourceDiagnosticKind.SYNTAX_ERROR);
    expect(missing.diagnostics[0].kind)
      .equals(ComponentSourceDiagnosticKind.COMPONENT_NOT_FOUND);
  });
});
