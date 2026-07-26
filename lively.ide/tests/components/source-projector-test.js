/* global describe, it */
import { expect } from 'mocha-es6';
import {
  ClearPropertyOverride,
  ComponentMoveInheritanceTransitionKind,
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
  ComponentDocument,
  ComponentNode,
  addedNodeProvenance,
  explicitProperty,
  inheritedNodeProvenance,
  localNodeProvenance,
  opaqueProperty,
  sourceComponentReference
} from '../../components/reconciliation/component-document.js';
import { parseComponentSource } from '../../components/reconciliation/source-adapter.js';
import {
  alignParsedDocumentIdentities,
  componentDocumentsSemanticallyEqual,
  projectComponentSource
} from '../../components/reconciliation/source-projector.js';
import {
  ComponentImportKind,
  componentImportBinding
} from '../../components/reconciliation/import-bindings.js';

const moduleId = 'local://projectional-source-test/component.cp.js';
const componentId = `${moduleId}#Example`;

function parsed (source) {
  return parseComponentSource({
    source,
    moduleId,
    exportName: 'Example',
    componentId
  }).document;
}

function reduce (document, commandFactory, spec) {
  return reduceComponent(document, commandFactory({
    componentId,
    expectedRevision: document.revision,
    ...spec
  }));
}

describe('projectional component source projector', () => {
  it('aligns stable identities locally when an unrelated subtree shape differs', () => {
    const expected = parsed(`const Example = component({
  name: 'example',
  submorphs: [
    { name: 'unresolved', submorphs: [{ name: 'known' }] },
    { name: 'ordered', submorphs: [{ name: 'first' }, { name: 'moved' }] }
  ]
});`);
    const reparsed = parsed(`const Example = component({
  name: 'example',
  submorphs: [
    { name: 'unresolved', submorphs: [{ name: 'known' }, { name: 'extra' }] },
    { name: 'ordered', submorphs: [{ name: 'moved' }, { name: 'first' }] }
  ]
});`);
    const aligned = alignParsedDocumentIdentities(reparsed, expected);
    const expectedMoved = expected.root.children[1].children[1];
    const alignedMoved = aligned.root.children[1].children[0];

    expect(alignedMoved.name).equals('moved');
    expect(alignedMoved.id).equals(expectedMoved.id);
  });

  it('treats property map insertion order as semantically irrelevant', () => {
    const first = parsed(`const Example = component({
  name: 'example',
  fill: 'red',
  opacity: 0.5
});`);
    const second = parsed(`const Example = component({
  opacity: 0.5,
  name: 'example',
  fill: 'red'
});`);

    expect(componentDocumentsSemanticallyEqual(first, second)).to.be.true;
  });

  it('replaces explicit and opaque property expressions', () => {
    const source = `const Example = component({
  name: 'example',
  fill: Color.red
});`;
    const document = parsed(source);
    const explicit = reduce(document, SetProperty, {
      nodeId: document.root.id,
      property: 'fill',
      value: 'green'
    });
    const explicitProjection = projectComponentSource({
      source,
      beforeDocument: document,
      reduction: explicit
    });

    expect(explicitProjection.supported).to.be.true;
    expect(explicitProjection.sourceAfter).includes('fill: "green"');

    const opaque = reduce(document, SetOpaqueProperty, {
      nodeId: document.root.id,
      property: 'fill',
      expression: 'Color.green'
    });
    const opaqueProjection = projectComponentSource({
      source,
      beforeDocument: document,
      reduction: opaque
    });
    expect(opaqueProjection.sourceAfter).includes('fill: Color.green');
  });

  it('canonicalizes a static opaque expression after source reparsing', () => {
    const source = `const Example = component({ name: 'example' });`;
    const document = parsed(source);
    const reduction = reduce(document, SetOpaqueProperty, {
      nodeId: document.root.id,
      property: 'borderWidth',
      expression: '0'
    });
    const projection = projectComponentSource({
      source,
      beforeDocument: document,
      reduction
    });

    expect(projection.supported, JSON.stringify(projection.diagnostics)).to.be.true;
    expect(projection.sourceAfter).includes('borderWidth: 0');
    expect(projection.projectedDocument.root.properties.borderWidth.value).equals(0);
    expect(projection.projectedDocument.root.properties.borderWidth.expression)
      .equals(undefined);
  });

  it('projects required imports together with opaque property expressions', () => {
    const source = `const Example = component({ fill: 'red' });`;
    const document = parsed(source);
    const reduction = reduce(document, SetOpaqueProperty, {
      nodeId: document.root.id,
      property: 'fill',
      expression: 'Color.green',
      requiredBindings: [componentImportBinding({
        kind: ComponentImportKind.NAMED,
        moduleId: 'lively.graphics',
        imported: 'Color',
        local: 'Color'
      })]
    });
    const projection = projectComponentSource({ source, beforeDocument: document, reduction });

    expect(projection.supported).to.be.true;
    expect(projection.sourceAfter).equals(`import { Color } from "lively.graphics";\n\nconst Example = component({ fill: Color.green });`);
    expect(projection.changes).length(2);
  });

  it('reuses package-root imports for equivalent submodule bindings', () => {
    const source = `import { Color } from 'lively.graphics';

const Example = component({ fill: 'red' });`;
    const document = parsed(source);
    const reduction = reduce(document, SetOpaqueProperty, {
      nodeId: document.root.id,
      property: 'fill',
      expression: 'Color.green',
      requiredBindings: [componentImportBinding({
        kind: ComponentImportKind.NAMED,
        moduleId: 'lively.graphics/color.js',
        imported: 'Color',
        local: 'Color'
      })]
    });
    const projection = projectComponentSource({ source, beforeDocument: document, reduction });

    expect(projection.supported).to.be.true;
    expect(projection.sourceAfter.match(/import \{ Color \}/g)).length(1);
    expect(projection.sourceAfter).includes('fill: Color.green');
  });

  it('projects master expressions and their imports as one source plan', () => {
    const source = `const Example = component({ master: null });`;
    const document = parsed(source);
    const reduction = reduce(document, SetMaster, {
      nodeId: document.root.id,
      expression: 'HoverMaster',
      requiredBindings: [componentImportBinding({
        kind: ComponentImportKind.NAMED,
        moduleId: 'local://masters.js',
        imported: 'HoverMaster',
        local: 'HoverMaster'
      })]
    });
    const projection = projectComponentSource({ source, beforeDocument: document, reduction });

    expect(projection.supported).to.be.true;
    expect(projection.sourceAfter).includes('import { HoverMaster } from "local://masters.js";');
    expect(projection.sourceAfter).includes('master: HoverMaster');
  });

  it('reuses matching aliased imports and rejects conflicting locals', () => {
    const aliasSource = `import { Color as Hue } from 'lively.graphics';\n\nconst Example = component({ fill: 'red' });`;
    const aliasDocument = parsed(aliasSource);
    const requiredBinding = componentImportBinding({
      kind: ComponentImportKind.NAMED,
      moduleId: 'lively.graphics',
      imported: 'Color',
      local: 'Hue'
    });
    const aliasReduction = reduce(aliasDocument, SetOpaqueProperty, {
      nodeId: aliasDocument.root.id,
      property: 'fill',
      expression: 'Hue.green',
      requiredBindings: [requiredBinding]
    });
    const aliasProjection = projectComponentSource({
      source: aliasSource,
      beforeDocument: aliasDocument,
      reduction: aliasReduction
    });

    expect(aliasProjection.supported).to.be.true;
    expect(aliasProjection.sourceAfter.match(/from 'lively.graphics'/g)).length(1);

    const conflictSource = `import { pt as Hue } from 'lively.graphics';\n\nconst Example = component({ fill: 'red' });`;
    const conflictDocument = parsed(conflictSource);
    const conflictReduction = reduce(conflictDocument, SetOpaqueProperty, {
      nodeId: conflictDocument.root.id,
      property: 'fill',
      expression: 'Hue.green',
      requiredBindings: [requiredBinding]
    });
    const conflictProjection = projectComponentSource({
      source: conflictSource,
      beforeDocument: conflictDocument,
      reduction: conflictReduction
    });

    expect(conflictProjection.supported).to.be.false;
    expect(conflictProjection.sourceAfter).equals(conflictSource);
    expect(conflictProjection.diagnostics[0].kind).equals('import-binding-conflict');
  });

  it('projects default and namespace imports after side-effect imports', () => {
    const source = `import 'initialize-theme';\n\nconst Example = component({ fill: 'red' });`;
    const document = parsed(source);
    const reduction = reduce(document, SetOpaqueProperty, {
      nodeId: document.root.id,
      property: 'fill',
      expression: 'Theme.color(Palette.green)',
      requiredBindings: [
        componentImportBinding({
          kind: ComponentImportKind.DEFAULT,
          moduleId: 'theme',
          local: 'Theme'
        }),
        componentImportBinding({
          kind: ComponentImportKind.NAMESPACE,
          moduleId: 'palette',
          local: 'Palette'
        })
      ]
    });
    const projection = projectComponentSource({ source, beforeDocument: document, reduction });

    expect(projection.supported).to.be.true;
    expect(projection.sourceAfter).includes(`import 'initialize-theme';\nimport Theme from "theme";\nimport * as Palette from "palette";`);
    expect(projection.sourceAfter).includes('fill: Theme.color(Palette.green)');
  });

  it('inserts properties before submorphs and reparses equivalent semantics', () => {
    const source = `const Example = component({
  name: 'example',
  submorphs: [{ name: 'child' }]
});`;
    const document = parsed(source);
    const reduction = reduce(document, SetProperty, {
      nodeId: document.root.id,
      property: 'opacity',
      value: 0.5
    });
    const projection = projectComponentSource({ source, beforeDocument: document, reduction });

    expect(projection.supported).to.be.true;
    expect(projection.sourceAfter).includes(`opacity: 0.5,
  submorphs`);
    expect(projection.projectedDocument.root).deep.equals(reduction.document.root);
  });

  it('projects into a part override without replacing its component reference', () => {
    const source = `const Example = component({
  name: 'example',
  submorphs: [part(Card, { name: 'card' })]
});`;
    const document = parsed(source);
    const partNode = document.root.children[0];
    const reduction = reduce(document, SetProperty, {
      nodeId: partNode.id,
      property: 'opacity',
      value: 0.5
    });
    const projection = projectComponentSource({ source, beforeDocument: document, reduction });

    expect(projection.supported).to.be.true;
    expect(projection.sourceAfter).includes(`part(Card, { name: 'card',
    opacity: 0.5 })`);
    expect(projection.projectedDocument.root.children[0].partComponent.expression)
      .equals('Card');
    expect(componentDocumentsSemanticallyEqual(
      projection.projectedDocument,
      reduction.document
    )).to.be.true;
  });

  it('projects a semantic full-text replacement without touching sibling properties', () => {
    const source = `const Example = component({
  name: 'label',
  textAndAttributes: ['before', null],
  fill: 'red'
});`;
    const document = parsed(source);
    const reduction = reduce(document, EditText, {
      nodeId: document.root.id,
      operation: {
        kind: ComponentTextEditKind.REPLACE_ALL,
        before: ['before', null],
        after: ['after', { fontWeight: 'bold' }]
      }
    });
    const projection = projectComponentSource({ source, beforeDocument: document, reduction });

    expect(projection.supported).to.be.true;
    expect(projection.sourceAfter).includes('textAndAttributes: ["after", { "fontWeight": "bold" }]');
    expect(projection.sourceAfter).includes("fill: 'red'");
  });

  it('inserts the first local text expression for an inherited effective value', () => {
    const source = `const Example = component({
  name: 'label',
  fill: 'red'
});`;
    const parsedDocument = parsed(source);
    const document = new ComponentDocument({
      revision: parsedDocument.revision,
      componentId: parsedDocument.componentId,
      moduleId: parsedDocument.moduleId,
      exportName: parsedDocument.exportName,
      parentComponent: parsedDocument.parentComponent,
      root: parsedDocument.root.with({
        properties: {
          ...parsedDocument.root.properties,
          textAndAttributes: explicitProperty(['before', null])
        }
      }),
      layoutModels: parsedDocument.layoutModels,
      sourceMetadata: parsedDocument.sourceMetadata
    });
    const reduction = reduce(document, EditText, {
      nodeId: document.root.id,
      operation: {
        kind: ComponentTextEditKind.REPLACE_ALL,
        before: ['before', null],
        after: ['after', { fontWeight: 'bold' }]
      }
    });
    const projection = projectComponentSource({ source, beforeDocument: document, reduction });

    expect(projection.supported).to.be.true;
    expect(projection.sourceAfter)
      .includes('textAndAttributes: ["after", { "fontWeight": "bold" }]');
    expect(projection.sourceAfter).includes("fill: 'red'");
  });

  it('keeps source locations aligned across growing and shrinking text edits', () => {
    const source = `const Example = component({
  name: 'label',
  textAndAttributes: ['before', null],
  fill: 'red'
});`;
    const document = parsed(source);
    const longerText = ['a considerably longer text value', { fontWeight: 'bold' }];
    const grown = projectComponentSource({
      source,
      beforeDocument: document,
      reduction: reduce(document, EditText, {
        nodeId: document.root.id,
        operation: {
          kind: ComponentTextEditKind.REPLACE_ALL,
          before: ['before', null],
          after: longerText
        }
      })
    });
    expect(grown.supported).to.be.true;
    expect(grown.projectedDocument.sourceMetadata.originalExpressions[document.root.id]
      .textAndAttributes).equals('["a considerably longer text value", { "fontWeight": "bold" }]');

    const recolored = projectComponentSource({
      source: grown.sourceAfter,
      beforeDocument: grown.projectedDocument,
      reduction: reduce(grown.projectedDocument, SetProperty, {
        nodeId: document.root.id,
        property: 'fill',
        value: 'blue'
      })
    });
    expect(recolored.supported).to.be.true;
    expect(recolored.sourceAfter).includes('fill: "blue"');

    const shrunk = projectComponentSource({
      source: recolored.sourceAfter,
      beforeDocument: recolored.projectedDocument,
      reduction: reduce(recolored.projectedDocument, EditText, {
        nodeId: document.root.id,
        operation: {
          kind: ComponentTextEditKind.REPLACE_ALL,
          before: longerText,
          after: ['short', null]
        }
      })
    });
    expect(shrunk.supported).to.be.true;
    expect(shrunk.sourceAfter).includes('textAndAttributes: ["short", null]');
    expect(shrunk.sourceAfter).includes('fill: "blue"');
  });

  it('clears overrides and renames nested nodes without disturbing structure', () => {
    const source = `const Example = component({
  name: 'example',
  fill: Color.red,
  submorphs: [{ name: 'child', opacity: 0.5 }]
});`;
    const document = parsed(source);
    const cleared = reduce(document, ClearPropertyOverride, {
      nodeId: document.root.id,
      property: 'fill'
    });
    const clearProjection = projectComponentSource({
      source,
      beforeDocument: document,
      reduction: cleared
    });
    expect(clearProjection.supported).to.be.true;
    expect(clearProjection.sourceAfter).not.includes('fill:');
    expect(clearProjection.sourceAfter).includes('submorphs:');

    const child = document.root.children[0];
    const renamed = reduce(document, RenameNode, {
      nodeId: child.id,
      name: 'renamed'
    });
    const renameProjection = projectComponentSource({
      source,
      beforeDocument: document,
      reduction: renamed
    });
    expect(renameProjection.supported).to.be.true;
    expect(renameProjection.sourceAfter).includes("name: 'example'");
    expect(renameProjection.sourceAfter).includes('name: "renamed"');
  });

  it('projects inherited renames through a stable replace selector', () => {
    const parentDocument = new ComponentDocument({
      componentId: 'parent',
      moduleId: 'local://parent.cp.js',
      exportName: 'Parent',
      root: new ComponentNode({
        id: 'parent-root', name: 'parent', provenance: localNodeProvenance(),
        children: [new ComponentNode({
          id: 'inherited-child', name: 'before', provenance: localNodeProvenance()
        })]
      })
    });
    const source = `const Example = component(Base, {
  name: 'derived',
  submorphs: [{ name: 'before', fill: 'red' }]
});`;
    const document = parseComponentSource({
      source, moduleId, exportName: 'Example', componentId, parentDocument
    }).document;
    const inherited = document.root.children[0];
    const renamed = reduce(document, RenameNode, {
      nodeId: inherited.id,
      name: 'after'
    });
    const projection = projectComponentSource({
      source, beforeDocument: document, reduction: renamed
    });

    expect(projection.supported).to.be.true;
    expect(projection.sourceAfter)
      .includes('import { replace } from "lively.morphic/components/core.js";');
    expect(projection.sourceAfter)
      .includes(`replace("before", { name: "after", fill: 'red' })`);
    expect(projection.projectedDocument.root.children[0].provenance.baseName)
      .equals('before');
    expect(componentDocumentsSemanticallyEqual(
      projection.projectedDocument,
      renamed.document
    )).to.be.true;

    const renamedAgain = reduce(projection.projectedDocument, RenameNode, {
      nodeId: inherited.id,
      name: 'after again'
    });
    const secondProjection = projectComponentSource({
      source: projection.sourceAfter,
      beforeDocument: projection.projectedDocument,
      reduction: renamedAgain
    });
    expect(secondProjection.supported).to.be.true;
    expect(secondProjection.sourceAfter.match(/replace\(/g)).length(1);
    expect(secondProjection.sourceAfter).includes('name: "after again"');
  });

  it('retargets added ordering anchors when renaming an inherited node', () => {
    const parentDocument = new ComponentDocument({
      componentId: 'parent',
      moduleId: 'local://parent.cp.js',
      exportName: 'Parent',
      root: new ComponentNode({
        id: 'parent-root', name: 'parent', provenance: localNodeProvenance(),
        children: [new ComponentNode({
          id: 'inherited-child', name: 'before', provenance: localNodeProvenance()
        })]
      })
    });
    const source = `const Example = component(Base, {
  name: 'derived',
  submorphs: [
    add({ name: 'inserted' }, 'before'),
    { name: 'before', fill: 'red' }
  ]
});`;
    const document = parseComponentSource({
      source, moduleId, exportName: 'Example', componentId, parentDocument
    }).document;
    const inherited = document.root.children.find(node => node.name === 'before');
    const reduction = reduce(document, RenameNode, {
      nodeId: inherited.id,
      name: 'after'
    });
    const projection = projectComponentSource({
      source,
      beforeDocument: document,
      reduction
    });

    expect(projection.supported, JSON.stringify(projection.diagnostics)).to.be.true;
    expect(projection.sourceAfter).includes(`add({ name: 'inserted' }, "after")`);
    expect(projection.sourceAfter)
      .includes(`replace("before", { name: "after", fill: 'red' })`);
    expect(projection.sourceAfter.indexOf('replace("before"'))
      .to.be.below(projection.sourceAfter.indexOf('add({ name: \'inserted\''));
    expect(componentDocumentsSemanticallyEqual(
      projection.projectedDocument,
      reduction.document
    )).to.be.true;
  });

  it('clears a sole trailing-comma property without leaving invalid syntax', () => {
    const source = 'const Example = component({ fill: Color.red, });';
    const document = parsed(source);
    const reduction = reduce(document, ClearPropertyOverride, {
      nodeId: document.root.id,
      property: 'fill'
    });
    const projection = projectComponentSource({ source, beforeDocument: document, reduction });

    expect(projection.supported).to.be.true;
    expect(projection.sourceAfter).equals('const Example = component({  });');
  });

  it('renames static owner-layout references together with their target node', () => {
    const source = `const Example = component({
  name: 'example',
  layout: new TilingLayout({
    resizePolicies: [['child', { height: 'fixed', width: 'fill' }]]
  }),
  submorphs: [{ name: 'child' }]
});`;
    const document = parsed(source);
    const child = document.root.children[0];
    const reduction = reduce(document, RenameNode, {
      nodeId: child.id,
      name: 'renamed child'
    });
    const projection = projectComponentSource({ source, beforeDocument: document, reduction });

    expect(projection.supported).to.be.true;
    expect(projection.changes).length(2);
    expect(projection.sourceAfter).includes("name: \"renamed child\"");
    expect(projection.sourceAfter)
      .includes("resizePolicies: [[\"renamed child\", { height: 'fixed', width: 'fill' }]]");
    expect(componentDocumentsSemanticallyEqual(
      projection.projectedDocument,
      reduction.document
    )).to.be.true;
  });

  it('renames a child under a non-referencing constraint layout', () => {
    const source = `const Example = component({
  name: 'example',
  layout: new ConstraintLayout({
    reactToSubmorphAnimations: false,
    submorphSettings: []
  }),
  submorphs: [add({ name: 'child' })]
});`;
    const document = parsed(source);
    const child = document.root.children[0];
    const reduction = reduce(document, RenameNode, {
      nodeId: child.id,
      name: 'renamed child'
    });
    const projection = projectComponentSource({ source, beforeDocument: document, reduction });

    expect(projection.supported, JSON.stringify(projection.diagnostics)).to.be.true;
    expect(projection.changes).length(1);
    expect(projection.sourceAfter).includes("name: \"renamed child\"");
    expect(componentDocumentsSemanticallyEqual(
      projection.projectedDocument,
      reduction.document
    )).to.be.true;
  });

  it('refreshes semantic layout models after replacing a layout expression', () => {
    const source = `const Example = component({
  name: 'example',
  layout: null,
  submorphs: [{ name: 'child' }]
});`;
    const document = parsed(source);
    const reduction = reduce(document, SetOpaqueProperty, {
      nodeId: document.root.id,
      property: 'layout',
      expression: `new TilingLayout({
    resizePolicies: [['child', { height: 'fixed', width: 'fill' }]]
  })`,
      requiredBindings: [componentImportBinding({
        kind: ComponentImportKind.NAMED,
        moduleId: 'lively.morphic/layout.js',
        imported: 'TilingLayout',
        local: 'TilingLayout'
      })]
    });
    const projection = projectComponentSource({ source, beforeDocument: document, reduction });

    expect(projection.supported).to.be.true;
    expect(projection.sourceAfter)
      .includes('import { TilingLayout } from "lively.morphic/layout.js";');
    expect(projection.projectedDocument.layoutModels).length(1);
    expect(projection.projectedDocument.layoutModels[0].ownerId)
      .equals(document.root.id);
    expect(projection.projectedDocument.layoutModels[0].references[0].targetId)
      .equals(document.root.children[0].id);
  });

  it('replaces an owner layout without rewriting its generated submorphs', () => {
    const source = `const Example = component({
  name: 'example',
  submorphs: [{
    name: 'date array',
    layout: new TilingLayout({ spacing: 2 }),
    submorphs: arr.range(1, 41).map(i => part(DateDefault, { name: 'day ' + i }))
  }]
});`;
    const parsedSource = parseComponentSource({
      source, moduleId, exportName: 'Example', componentId
    });
    const document = parsedSource.document;
    const dateArray = document.root.children[0];
    const reduction = reduce(document, SetOpaqueProperty, {
      nodeId: dateArray.id,
      property: 'layout',
      expression: 'new TilingLayout({ spacing: 7, wrapSubmorphs: true })'
    });
    const projection = projectComponentSource({ source, beforeDocument: document, reduction });

    expect(parsedSource.supported).to.be.true;
    expect(projection.supported, JSON.stringify(projection.diagnostics)).to.be.true;
    expect(projection.sourceAfter)
      .includes('layout: new TilingLayout({ spacing: 7, wrapSubmorphs: true })');
    expect(projection.sourceAfter)
      .includes("submorphs: arr.range(1, 41).map(i => part(DateDefault, { name: 'day ' + i }))");
  });

  it('rejects structural insertion into generated submorphs without changing source', () => {
    const source = `const Example = component({
  name: 'example',
  submorphs: [{
    name: 'date array',
    submorphs: makeDates()
  }]
});`;
    const document = parsed(source);
    const dateArray = document.root.children[0];
    const introduced = new ComponentNode({
      id: `${componentId}:generated-introduction`,
      name: 'introduced',
      provenance: localNodeProvenance()
    });
    const reduction = reduce(document, IntroduceNode, {
      parentId: dateArray.id,
      node: introduced,
      beforeId: null
    });
    const projection = projectComponentSource({ source, beforeDocument: document, reduction });

    expect(projection.supported).to.be.false;
    expect(projection.sourceAfter).equals(source);
  });

  it('rejects rename projection through an unmodeled owner layout', () => {
    const source = `const Example = component({
  name: 'example',
  layout: new TilingLayout({ resizePolicies: policies }),
  submorphs: [{ name: 'child' }]
});`;
    const document = parsed(source);
    const reduction = reduce(document, RenameNode, {
      nodeId: document.root.children[0].id,
      name: 'renamed child'
    });
    const projection = projectComponentSource({ source, beforeDocument: document, reduction });

    expect(projection.supported).to.be.false;
    expect(projection.sourceAfter).equals(source);
    expect(projection.diagnostics[0].kind).equals('missing-source-metadata');
  });

  it('treats an explicit null owner layout as non-reference-bearing', () => {
    const source = `const Example = component({
  name: 'example',
  layout: null,
  submorphs: [{ name: 'child' }]
});`;
    const document = parsed(source);
    const child = document.root.children[0];
    const renamed = reduce(document, RenameNode, {
      nodeId: child.id,
      name: 'renamed child'
    });
    const renameProjection = projectComponentSource({
      source,
      beforeDocument: document,
      reduction: renamed
    });

    expect(renameProjection.supported).to.be.true;
    expect(renameProjection.sourceAfter).includes('layout: null');
    expect(renameProjection.sourceAfter).includes('name: "renamed child"');

    const removed = reduce(renameProjection.projectedDocument, RemoveNode, {
      nodeId: child.id
    });
    const removalProjection = projectComponentSource({
      source: renameProjection.sourceAfter,
      beforeDocument: renameProjection.projectedDocument,
      reduction: removed
    });
    expect(removalProjection.supported).to.be.true;
    expect(removalProjection.sourceAfter).includes('layout: null');
    expect(removalProjection.sourceAfter).not.includes('renamed child');
  });

  it('treats a literal undefined owner layout as non-reference-bearing', () => {
    const source = `const Example = component({
  name: 'example',
  layout: undefined,
  submorphs: [{ name: 'child' }]
});`;
    const document = parsed(source);
    const child = document.root.children[0];
    const renamed = reduce(document, RenameNode, {
      nodeId: child.id,
      name: 'renamed child'
    });
    const renameProjection = projectComponentSource({
      source,
      beforeDocument: document,
      reduction: renamed
    });

    expect(renameProjection.supported).to.be.true;
    expect(renameProjection.sourceAfter).includes('layout: undefined');
    expect(renameProjection.sourceAfter).includes('name: "renamed child"');

    const removed = reduce(renameProjection.projectedDocument, RemoveNode, {
      nodeId: child.id
    });
    const removalProjection = projectComponentSource({
      source: renameProjection.sourceAfter,
      beforeDocument: renameProjection.projectedDocument,
      reduction: removed
    });
    expect(removalProjection.supported).to.be.true;
    expect(removalProjection.sourceAfter).includes('layout: undefined');
    expect(removalProjection.sourceAfter).not.includes('renamed child');
  });

  it('removes a final local child without changing surviving node identities', () => {
    const source = `const Example = component({
  name: 'example',
  submorphs: [
    { name: 'first' },
    { name: 'last' }
  ]
});`;
    const document = parsed(source);
    const last = document.root.children[1];
    const reduction = reduce(document, RemoveNode, { nodeId: last.id });
    const projection = projectComponentSource({ source, beforeDocument: document, reduction });

    expect(projection.supported).to.be.true;
    expect(projection.sourceAfter).includes("{ name: 'first' }");
    expect(projection.sourceAfter).not.includes("{ name: 'last' }");
    expect(componentDocumentsSemanticallyEqual(
      projection.projectedDocument,
      reduction.document
    )).to.be.true;
  });

  it('retargets a surviving add anchor when removing its referenced sibling', () => {
    const source = `const Example = component({
  name: 'example',
  submorphs: [
    add({ name: 'dependent' }, 'anchor'),
    { name: 'anchor' },
    { name: 'successor' }
  ]
});`;
    const document = parsed(source);
    const dependent = document.root.children.find(({ name }) => name === 'dependent');
    const anchor = document.root.children.find(({ name }) => name === 'anchor');
    const successor = document.root.children.find(({ name }) => name === 'successor');
    const reduction = reduce(document, RemoveNode, { nodeId: anchor.id });
    const reducedDependent = reduction.document.root.children.find(({ name }) =>
      name === 'dependent');
    const projection = projectComponentSource({ source, beforeDocument: document, reduction });

    expect(reducedDependent.provenance.beforeId).equals(successor.id);
    expect(projection.supported, JSON.stringify(projection.diagnostics)).to.be.true;
    expect(projection.sourceAfter)
      .includes('add({ name: \'dependent\' }, "successor")');
    expect(projection.sourceAfter).not.includes("name: 'anchor'");
    expect(componentDocumentsSemanticallyEqual(
      projection.projectedDocument,
      reduction.document
    )).to.be.true;
    expect(projection.projectedDocument.root.children[0].id).equals(dependent.id);
  });

  it('removes a local child and its static owner-layout resize policy atomically', () => {
    const source = `const Example = component({
  name: 'example',
  layout: new TilingLayout({
    resizePolicies: [
      ['first', { width: 'fixed' }],
      ['middle', { width: 'fill' }],
      ['last', { width: 'fixed' }]
    ]
  }),
  submorphs: [
    { name: 'first' },
    { name: 'middle' },
    { name: 'last' }
  ]
});`;
    const document = parsed(source);
    const middle = document.root.children[1];
    const reduction = reduce(document, RemoveNode, { nodeId: middle.id });
    const projection = projectComponentSource({ source, beforeDocument: document, reduction });

    expect(projection.supported).to.be.true;
    expect(projection.changes).length(2);
    expect(projection.sourceAfter).not.includes("['middle'");
    expect(projection.sourceAfter).not.includes("{ name: 'middle' }");
    expect(projection.sourceAfter).includes("['first', { width: 'fixed' }]");
    expect(projection.sourceAfter).includes("['last', { width: 'fixed' }]");
    expect(componentDocumentsSemanticallyEqual(
      projection.projectedDocument,
      reduction.document
    )).to.be.true;
  });

  it('removes the complete add-part expression rather than only its override object', () => {
    const source = `const Example = component({
  name: 'example',
  submorphs: [part(Card, { name: 'card' }), add(part(Button, { name: 'button' }), 'card')]
});`;
    const document = parsed(source);
    const addedPart = document.root.children.find(({ name }) => name === 'button');
    const reduction = reduce(document, RemoveNode, { nodeId: addedPart.id });
    const projection = projectComponentSource({ source, beforeDocument: document, reduction });

    expect(projection.supported).to.be.true;
    expect(projection.sourceAfter).includes("part(Card, { name: 'card' })");
    expect(projection.sourceAfter).not.includes('add(part(Button');
    expect(projection.sourceAfter).not.includes("'card')");
    expect(componentDocumentsSemanticallyEqual(
      projection.projectedDocument,
      reduction.document
    )).to.be.true;
  });

  it('rewrites add wrappers when a part crosses a plain-subtree ownership boundary', () => {
    const source = `const Example = component({
  name: 'example',
  submorphs: [
    add(part(Card, {
      name: 'card',
      submorphs: [add(part(Button, { name: 'button' }))]
    })),
    add({ name: 'plain addition' })
  ]
});`;
    const document = parsed(source);
    const card = document.root.children.find(({ name }) => name === 'card');
    const button = card.children.find(({ name }) => name === 'button');
    const plainAddition = document.root.children.find(({ name }) =>
      name === 'plain addition');
    const movedIntoPlain = reduce(document, MoveNode, {
      nodeId: button.id,
      parentId: plainAddition.id,
      beforeId: null
    });
    const plainProjection = projectComponentSource({
      source,
      beforeDocument: document,
      reduction: movedIntoPlain
    });

    expect(plainProjection.supported).to.be.true;
    expect(plainProjection.sourceAfter)
      .includes("submorphs: [part(Button, { name: 'button' })]");
    expect(plainProjection.sourceAfter)
      .not.includes("submorphs: [add(part(Button, { name: 'button' }))]");
    expect(componentDocumentsSemanticallyEqual(
      plainProjection.projectedDocument,
      movedIntoPlain.document
    )).to.be.true;

    const movedBackIntoPart = reduce(plainProjection.projectedDocument, MoveNode, {
      nodeId: button.id,
      parentId: card.id,
      beforeId: null
    });
    const partProjection = projectComponentSource({
      source: plainProjection.sourceAfter,
      beforeDocument: plainProjection.projectedDocument,
      reduction: movedBackIntoPart
    });

    expect(partProjection.supported).to.be.true;
    expect(partProjection.sourceAfter).includes(
      "submorphs: [add(part(Button, { name: 'button' }))]"
    );
    expect(componentDocumentsSemanticallyEqual(
      partProjection.projectedDocument,
      movedBackIntoPart.document
    )).to.be.true;
  });

  it('projects an inherited cross-parent move as suppression plus materialization', () => {
    const source = `const Example = component({
  name: 'example',
  submorphs: [
    part(Card, { name: 'card', submorphs: [{ name: 'inherited' }] }),
    part(Destination, { name: 'destination' })
  ]
});`;
    const document = parsed(source);
    const card = document.root.children[0];
    const destination = document.root.children[1];
    const inherited = card.children[0];
    const materialized = new ComponentNode({
      id: `${destination.id}.1`,
      name: inherited.name,
      provenance: addedNodeProvenance(),
      partComponent: sourceComponentReference('Leaf'),
      properties: {
        layout: opaqueProperty('new TilingLayout({ spacing: 7 })')
      }
    });
    const reduction = reduce(document, MoveNode, {
      nodeId: inherited.id,
      parentId: destination.id,
      beforeId: null,
      inheritanceTransition: {
        kind: ComponentMoveInheritanceTransitionKind.MATERIALIZE,
        node: materialized
      }
    });
    const projection = projectComponentSource({ source, beforeDocument: document, reduction });

    expect(reduction.semanticDelta.inheritanceTransition)
      .equals(ComponentMoveInheritanceTransitionKind.MATERIALIZE);
    expect(projection.supported, JSON.stringify(projection.diagnostics)).to.be.true;
    expect(projection.sourceAfter).includes('import { add } from "lively.morphic";');
    expect(projection.sourceAfter).includes('without("inherited")');
    expect(projection.sourceAfter)
      .includes('add(part(Leaf, { name: "inherited", layout: new TilingLayout({ spacing: 7 }) }))');
    expect(projection.projectedDocument.layoutModels.some(model =>
      model.ownerId === materialized.id &&
      model.expressionTemplate.includes('spacing: 7'))).to.be.true;
    expect(projection.projectedDocument.root).deep.equals(reduction.document.root);
  });

  it('preserves nested suppressions while materializing an inherited subtree', () => {
    const source = `const Example = component({
  name: 'example',
  submorphs: [
    part(Card, {
      name: 'card',
      submorphs: [{
        name: 'inherited',
        submorphs: [{
          name: 'nested',
          submorphs: [without('hidden')]
        }]
      }]
    }),
    part(Destination, { name: 'destination' })
  ]
});`;
    const document = parsed(source);
    const card = document.root.children[0];
    const destination = document.root.children[1];
    const inherited = card.children[0];
    const nested = inherited.children[0];
    const hidden = nested.children[0];
    const materialized = new ComponentNode({
      id: `${destination.id}.1`,
      name: inherited.name,
      provenance: addedNodeProvenance(),
      partComponent: sourceComponentReference('Leaf'),
      children: [new ComponentNode({
        id: `${destination.id}.1.0`,
        name: nested.name,
        provenance: nested.provenance,
        properties: nested.properties,
        children: [new ComponentNode({
          id: `${destination.id}.1.0.0`,
          name: hidden.name,
          provenance: inheritedNodeProvenance({
            ...hidden.provenance,
            baseName: hidden.name,
            hasLocalOverrides: true
          }),
          properties: {
            ...hidden.properties,
            borderWidth: explicitProperty(2)
          }
        })]
      })]
    });
    const reduction = reduce(document, MoveNode, {
      nodeId: inherited.id,
      parentId: destination.id,
      beforeId: null,
      inheritanceTransition: {
        kind: ComponentMoveInheritanceTransitionKind.MATERIALIZE,
        node: materialized
      }
    });
    const projection = projectComponentSource({
      source,
      beforeDocument: document,
      reduction
    });

    expect(projection.supported, JSON.stringify(projection.diagnostics)).to.be.true;
    expect(projection.sourceAfter).includes(
      'submorphs: [{ name: "hidden", borderWidth: 2 }, without("hidden")]'
    );
    expect(componentDocumentsSemanticallyEqual(
      projection.projectedDocument,
      reduction.document
    )).to.be.true;
  });

  it('appends a local node while preserving existing source-path identities', () => {
    const source = `const Example = component({
  name: 'example',
  submorphs: [{ name: 'first' }]
});`;
    const document = parsed(source);
    const introduced = new ComponentNode({
      id: `${componentId}:node:1`,
      name: 'introduced',
      provenance: localNodeProvenance(),
      properties: {
        fill: opaqueProperty('Color.green'),
        opacity: explicitProperty(0.5)
      }
    });
    const reduction = reduce(document, IntroduceNode, {
      parentId: document.root.id,
      node: introduced,
      beforeId: null,
      requiredBindings: [componentImportBinding({
        kind: ComponentImportKind.NAMED,
        moduleId: 'lively.graphics',
        imported: 'Color',
        local: 'Color'
      })]
    });
    const projection = projectComponentSource({ source, beforeDocument: document, reduction });

    expect(projection.supported).to.be.true;
    expect(projection.sourceAfter).includes('import { Color } from "lively.graphics";');
    expect(projection.sourceAfter).includes("{ name: 'first' }");
    expect(projection.sourceAfter)
      .includes('{ name: "introduced", fill: Color.green, opacity: 0.5 }');
    expect(componentDocumentsSemanticallyEqual(
      projection.projectedDocument,
      reduction.document
    )).to.be.true;
  });

  it('preserves quoted opaque rich text across an unrelated introduction', () => {
    const source = `const Example = component({
  name: 'example',
  textAndAttributes: [
    'rich \\'quoted\\' text',
    { fontWeight: 'normal' },
    morph({ name: 'embedded "double"', fill: Color.blue }),
    null
  ]
});`;
    const document = parsed(source);
    const introduced = new ComponentNode({
      id: `${componentId}:node:0`,
      name: 'introduced',
      provenance: localNodeProvenance()
    });
    const reduction = reduce(document, IntroduceNode, {
      parentId: document.root.id,
      node: introduced,
      beforeId: null
    });
    const projection = projectComponentSource({
      source,
      beforeDocument: document,
      reduction
    });

    expect(projection.supported, JSON.stringify(projection.diagnostics)).to.be.true;
    expect(projection.sourceAfter).includes("'rich \\'quoted\\' text'");
    expect(projection.sourceAfter).includes("'embedded \"double\"'");
    expect(projection.sourceAfter).includes('name: "introduced"');
  });

  it('projects a typed node introduction with its constructor import', () => {
    const source = `const Example = component({ name: 'example' });`;
    const document = parsed(source);
    const introduced = new ComponentNode({
      id: `${componentId}:node:0`,
      name: 'typed',
      typeExpression: 'TypedMorph',
      provenance: localNodeProvenance()
    });
    const reduction = reduce(document, IntroduceNode, {
      parentId: document.root.id,
      node: introduced,
      beforeId: null,
      requiredBindings: [componentImportBinding({
        kind: ComponentImportKind.NAMED,
        moduleId: 'local://widgets/typed-morph.js',
        imported: 'TypedMorph',
        local: 'TypedMorph'
      })]
    });
    const projection = projectComponentSource({ source, beforeDocument: document, reduction });

    expect(projection.supported).to.be.true;
    expect(projection.sourceAfter)
      .includes('import { TypedMorph } from "local://widgets/typed-morph.js";');
    expect(projection.sourceAfter).includes('{ name: "typed", type: TypedMorph }');
    expect(componentDocumentsSemanticallyEqual(
      projection.projectedDocument,
      reduction.document
    )).to.be.true;
  });

  it('projects a part introduction without flattening inherited structure', () => {
    const source = `const Example = component({ name: 'example' });`;
    const document = parsed(source);
    const introduced = new ComponentNode({
      id: `${componentId}:node:0`,
      name: 'button',
      partComponent: sourceComponentReference('Button'),
      provenance: localNodeProvenance(),
      properties: { fill: explicitProperty('red') }
    });
    const reduction = reduce(document, IntroduceNode, {
      parentId: document.root.id,
      node: introduced,
      beforeId: null,
      requiredBindings: [
        componentImportBinding({
          kind: ComponentImportKind.NAMED,
          moduleId: 'local://widgets/button.cp.js',
          imported: 'Button',
          local: 'Button'
        }),
        componentImportBinding({
          kind: ComponentImportKind.NAMED,
          moduleId: 'lively.morphic',
          imported: 'part',
          local: 'part'
        })
      ]
    });
    const projection = projectComponentSource({ source, beforeDocument: document, reduction });

    expect(projection.supported).to.be.true;
    expect(projection.sourceAfter)
      .includes('import { Button } from "local://widgets/button.cp.js";');
    expect(projection.sourceAfter).includes('import { part } from "lively.morphic";');
    expect(projection.sourceAfter)
      .includes('part(Button, { name: "button", fill: "red" })');
    expect(componentDocumentsSemanticallyEqual(
      projection.projectedDocument,
      reduction.document
    )).to.be.true;
  });

  it('serializes inherited nested parts as overrides inside an introduced part', () => {
    const baseDocument = new ComponentDocument({
      componentId: 'base',
      moduleId: 'local://widgets/base.cp.js',
      exportName: 'Base',
      root: new ComponentNode({
        id: 'base-root',
        name: 'base',
        provenance: localNodeProvenance(),
        children: [new ComponentNode({
          id: 'base-nested-part',
          name: 'nested part',
          provenance: localNodeProvenance(),
          partComponent: sourceComponentReference('Leaf')
        })]
      })
    });
    const source = `const Example = component({ name: 'example' });`;
    const document = parseComponentSource({
      source,
      moduleId,
      exportName: 'Example',
      componentId,
      resolveComponentDocument: ({ expression }) =>
        expression === 'Base' ? baseDocument : null
    }).document;
    const introduced = new ComponentNode({
      id: `${componentId}:node:0`,
      name: 'base part',
      partComponent: sourceComponentReference('Base'),
      provenance: localNodeProvenance(),
      children: [new ComponentNode({
        id: `${componentId}:node:0.0`,
        name: 'nested part',
        partComponent: sourceComponentReference('Leaf'),
        provenance: inheritedNodeProvenance({
          hasLocalOverrides: true,
          baseName: 'nested part'
        }),
        properties: { opacity: explicitProperty(0.5) }
      })]
    });
    const reduction = reduce(document, IntroduceNode, {
      parentId: document.root.id,
      node: introduced,
      beforeId: null,
      requiredBindings: [
        componentImportBinding({
          kind: ComponentImportKind.NAMED,
          moduleId: 'local://widgets/base.cp.js',
          imported: 'Base',
          local: 'Base'
        }),
        componentImportBinding({
          kind: ComponentImportKind.NAMED,
          moduleId: 'lively.morphic',
          imported: 'part',
          local: 'part'
        })
      ]
    });
    const projection = projectComponentSource({ source, beforeDocument: document, reduction });

    expect(projection.supported).to.be.true;
    expect(projection.sourceAfter)
      .includes('submorphs: [{ name: "nested part", opacity: 0.5 }]');
    expect(projection.sourceAfter).not.includes('part(Leaf');
    expect(componentDocumentsSemanticallyEqual(
      projection.projectedDocument,
      reduction.document
    )).to.be.true;
  });

  it('inserts a local node before an existing sibling without changing identities', () => {
    const source = `const Example = component({
  name: 'example',
  submorphs: [{ name: 'last' }]
});`;
    const document = parsed(source);
    const last = document.root.children[0];
    const introduced = new ComponentNode({
      id: `${componentId}:node:1`,
      name: 'introduced',
      provenance: localNodeProvenance()
    });
    const reduction = reduce(document, IntroduceNode, {
      parentId: document.root.id,
      node: introduced,
      beforeId: last.id
    });
    const projection = projectComponentSource({ source, beforeDocument: document, reduction });

    expect(projection.supported).to.be.true;
    expect(projection.sourceAfter.indexOf('introduced'))
      .below(projection.sourceAfter.indexOf('last'));
    expect(projection.projectedDocument.root.children.map(({ id }) => id))
      .deep.equals([introduced.id, last.id]);
    expect(componentDocumentsSemanticallyEqual(
      projection.projectedDocument,
      reduction.document
    )).to.be.true;
  });

  it('preserves the order of additions sharing an inherited ordering anchor', () => {
    const parentDocument = new ComponentDocument({
      componentId: 'parent',
      moduleId: 'local://parent.cp.js',
      exportName: 'Parent',
      root: new ComponentNode({
        id: 'parent-root',
        name: 'parent',
        provenance: localNodeProvenance(),
        children: [new ComponentNode({
          id: 'inherited-anchor',
          name: 'anchor',
          provenance: localNodeProvenance()
        })]
      })
    });
    const source = `const Example = component(Base, {
  name: 'derived',
  submorphs: [
    add({ name: 'first' }, 'anchor'),
    { name: 'anchor', fill: 'red' },
    add({ name: 'second' }, 'anchor')
  ]
});`;
    const document = parseComponentSource({
      source,
      moduleId,
      exportName: 'Example',
      componentId,
      parentDocument
    }).document;
    const anchor = document.root.children.find(node => node.name === 'anchor');
    const introduced = new ComponentNode({
      id: `${componentId}:introduced`,
      name: 'introduced',
      provenance: addedNodeProvenance({ beforeId: anchor.id })
    });
    const reduction = reduce(document, IntroduceNode, {
      parentId: document.root.id,
      node: introduced,
      beforeId: anchor.id
    });
    const projection = projectComponentSource({
      source,
      beforeDocument: document,
      reduction
    });

    expect(projection.supported, JSON.stringify(projection.diagnostics)).to.be.true;
    expect(projection.projectedDocument.root.children.map(node => node.name))
      .deep.equals(['first', 'second', 'introduced', 'anchor']);
    expect(componentDocumentsSemanticallyEqual(
      projection.projectedDocument,
      reduction.document
    )).to.be.true;
  });

  it('reorders local siblings while preserving identities and refreshed metadata', () => {
    const source = `const Example = component({
  name: 'example',
  submorphs: [
    { name: 'first', fill: 'red' },
    // Keep this positional comment during the source transform.
    { name: 'second', fill: 'green' },
    { name: 'third', fill: 'blue' }
  ]
});`;
    const document = parsed(source);
    const [first, second, third] = document.root.children;
    const reordered = reduce(document, MoveNode, {
      nodeId: third.id,
      parentId: document.root.id,
      beforeId: first.id
    });
    const reorderProjection = projectComponentSource({
      source,
      beforeDocument: document,
      reduction: reordered
    });

    expect(reorderProjection.supported).to.be.true;
    expect(reorderProjection.projectedDocument.root.children.map(({ id }) => id))
      .deep.equals([third.id, first.id, second.id]);
    expect(reorderProjection.sourceAfter.indexOf("name: 'third'"))
      .to.be.lessThan(reorderProjection.sourceAfter.indexOf("name: 'first'"));
    expect(reorderProjection.sourceAfter)
      .includes('// Keep this positional comment during the source transform.');

    const propertyReduction = reduce(reorderProjection.projectedDocument, SetProperty, {
      nodeId: third.id,
      property: 'fill',
      value: 'purple'
    });
    const propertyProjection = projectComponentSource({
      source: reorderProjection.sourceAfter,
      beforeDocument: reorderProjection.projectedDocument,
      reduction: propertyReduction
    });

    expect(propertyProjection.supported).to.be.true;
    expect(propertyProjection.sourceAfter).includes("name: 'third', fill: \"purple\"");
    expect(propertyProjection.sourceAfter).includes("name: 'first', fill: 'red'");
  });

  it('reparents a local subtree with stable identities and source expressions', () => {
    const source = `const Example = component({
  name: 'example',
  submorphs: [{
    name: 'source',
    submorphs: [{
      name: 'moved',
      fill: Color.red,
      submorphs: [{ name: 'nested' }]
    }]
  }, {
    name: 'destination',
    submorphs: [{ name: 'first' }, { name: 'last' }]
  }]
});`;
    const document = parsed(source);
    const [sourceParent, destination] = document.root.children;
    const moved = sourceParent.children[0];
    const nested = moved.children[0];
    const reduction = reduce(document, MoveNode, {
      nodeId: moved.id,
      parentId: destination.id,
      beforeId: destination.children[1].id
    });
    const projection = projectComponentSource({ source, beforeDocument: document, reduction });

    expect(projection.supported).to.be.true;
    expect(projection.changes).to.have.length(2);
    expect(projection.projectedDocument.root.children[0].children).deep.equals([]);
    expect(projection.projectedDocument.root.children[1].children.map(({ id }) => id))
      .deep.equals([destination.children[0].id, moved.id, destination.children[1].id]);
    expect(projection.projectedDocument.root.children[1].children[1].children[0].id)
      .equals(nested.id);
    expect(projection.sourceAfter).includes('fill: Color.red');

    const propertyReduction = reduce(projection.projectedDocument, SetProperty, {
      nodeId: moved.id,
      property: 'opacity',
      value: 0.5
    });
    const propertyProjection = projectComponentSource({
      source: projection.sourceAfter,
      beforeDocument: projection.projectedDocument,
      reduction: propertyReduction
    });
    expect(propertyProjection.supported).to.be.true;
    expect(propertyProjection.sourceAfter).includes('opacity: 0.5');
  });

  it('rewrites added-node ordering anchors when reparenting', () => {
    const source = `const Example = component({
  name: 'example',
  submorphs: [part(Source, {
    name: 'source',
    submorphs: [add({ name: 'moved' }, 'source tail'), { name: 'source tail' }]
  }), part(Destination, {
    name: 'destination',
    submorphs: [{ name: 'destination first' }, { name: 'destination tail' }]
  })]
});`;
    const document = parsed(source);
    const [sourceParent, destination] = document.root.children;
    const moved = sourceParent.children[0];
    const reduction = reduce(document, MoveNode, {
      nodeId: moved.id,
      parentId: destination.id,
      beforeId: destination.children[1].id
    });
    const projection = projectComponentSource({ source, beforeDocument: document, reduction });

    expect(projection.supported).to.be.true;
    expect(projection.sourceAfter).includes("add({ name: 'moved' }, \"destination tail\")");
    expect(projection.sourceAfter).not.includes("add({ name: 'moved' }, 'source tail')");
    expect(componentDocumentsSemanticallyEqual(
      projection.projectedDocument,
      reduction.document
    )).to.be.true;
  });

  it('retargets an old-scope ordering dependant when its anchor is reparented', () => {
    const source = `const Example = component({
  name: 'example',
  submorphs: [part(Source, {
    name: 'source',
    submorphs: [
      add({ name: 'dependent' }, 'moved'),
      add({ name: 'moved' }, 'source tail'),
      { name: 'source tail' }
    ]
  }), part(Destination, { name: 'destination' })]
});`;
    const document = parsed(source);
    const [sourceParent, destination] = document.root.children;
    const dependent = sourceParent.children.find(({ name }) => name === 'dependent');
    const moved = sourceParent.children.find(({ name }) => name === 'moved');
    const sourceTail = sourceParent.children.find(({ name }) => name === 'source tail');
    const reduction = reduce(document, MoveNode, {
      nodeId: moved.id,
      parentId: destination.id,
      beforeId: null
    });
    const projectedDependent = reduction.document.root.children[0].children
      .find(({ name }) => name === dependent.name);
    const projection = projectComponentSource({
      source,
      beforeDocument: document,
      reduction
    });

    expect(projectedDependent.provenance.beforeId).equals(sourceTail.id);
    expect(projection.supported, JSON.stringify(projection.diagnostics)).to.be.true;
    expect(projection.sourceAfter)
      .includes('add({ name: \'dependent\' }, "source tail")');
    expect(componentDocumentsSemanticallyEqual(
      projection.projectedDocument,
      reduction.document
    )).to.be.true;
    const restored = reduceComponent(reduction.document, reduction.inverseCommand);
    expect(restored.document.root).deep.equals(document.root);
  });

  it('rewrites an added-node ordering anchor when moving before an inherited sibling', () => {
    const source = `const Example = component({
  name: 'example',
  submorphs: [part(Card, {
    name: 'card',
    submorphs: [{ name: 'inherited' }, add({ name: 'moved' })]
  })]
});`;
    const document = parsed(source);
    const card = document.root.children[0];
    const inherited = card.children.find(({ name }) => name === 'inherited');
    const moved = card.children.find(({ name }) => name === 'moved');
    const reduction = reduce(document, MoveNode, {
      nodeId: moved.id,
      parentId: card.id,
      beforeId: inherited.id
    });
    const projection = projectComponentSource({ source, beforeDocument: document, reduction });

    expect(projection.supported).to.be.true;
    expect(projection.sourceAfter).includes('add({ name: \'moved\' }, "inherited")');
    expect(projection.projectedDocument.root.children[0].children.map(({ name }) => name))
      .deep.equals(['moved', 'inherited']);
    expect(componentDocumentsSemanticallyEqual(
      projection.projectedDocument,
      reduction.document
    )).to.be.true;
  });

  it('projects inherited suppression and restoration through without markers', () => {
    const parentDocument = new ComponentDocument({
      componentId: 'parent',
      moduleId: 'local://parent.cp.js',
      exportName: 'Parent',
      root: new ComponentNode({
        id: 'parent-root', name: 'parent', provenance: localNodeProvenance(),
        children: [new ComponentNode({
          id: 'inherited-child',
          name: 'inherited child',
          provenance: localNodeProvenance()
        })]
      })
    });
    const source = `const Example = component(Base, { name: 'derived' });`;
    const document = parseComponentSource({
      source, moduleId, exportName: 'Example', componentId, parentDocument
    }).document;
    const inherited = document.root.children[0];
    expect(inherited.provenance).deep.equals(inheritedNodeProvenance({
      baseName: 'inherited child'
    }));
    const suppressed = reduce(document, SuppressInheritedNode, { nodeId: inherited.id });
    const suppressionProjection = projectComponentSource({
      source, beforeDocument: document, reduction: suppressed
    });

    expect(suppressionProjection.supported).to.be.true;
    expect(suppressionProjection.sourceAfter)
      .includes('import { without } from "lively.morphic/components/core.js";');
    expect(suppressionProjection.sourceAfter).includes('without("inherited child")');
    expect(suppressionProjection.projectedDocument.root.children[0].provenance.suppressed)
      .to.be.true;

    const restored = reduce(
      suppressionProjection.projectedDocument,
      RestoreInheritedNode,
      {
        nodeId: inherited.id,
        parentId: suppressionProjection.projectedDocument.root.id,
        beforeId: null
      }
    );
    const restorationProjection = projectComponentSource({
      source: suppressionProjection.sourceAfter,
      beforeDocument: suppressionProjection.projectedDocument,
      reduction: restored
    });
    expect(restorationProjection.supported).to.be.true;
    expect(restorationProjection.sourceAfter).not.includes('without("inherited child")');
    expect(restorationProjection.projectedDocument.root.children[0].provenance.suppressed)
      .to.be.false;
  });

  it('consolidates duplicate without markers when restoring an inherited node', () => {
    const parentDocument = new ComponentDocument({
      componentId: 'parent',
      moduleId: 'local://parent.cp.js',
      exportName: 'Parent',
      root: new ComponentNode({
        id: 'parent-root',
        name: 'parent',
        provenance: localNodeProvenance(),
        children: [new ComponentNode({
          id: 'inherited-child',
          name: 'inherited child',
          provenance: localNodeProvenance()
        })]
      })
    });
    const source = `const Example = component(Base, {
  name: 'derived',
  submorphs: [
    without('inherited child'),
    without("inherited child")
  ]
});`;
    const document = parseComponentSource({
      source,
      moduleId,
      exportName: 'Example',
      componentId,
      parentDocument
    }).document;
    const inherited = document.root.children[0];
    expect(document.sourceMetadata.suppressionLocationLists[inherited.id])
      .to.have.length(2);
    const restored = reduce(document, RestoreInheritedNode, {
      nodeId: inherited.id,
      parentId: document.root.id,
      beforeId: null
    });
    const projection = projectComponentSource({
      source,
      beforeDocument: document,
      reduction: restored
    });

    expect(projection.supported, JSON.stringify(projection.diagnostics)).to.be.true;
    expect(projection.sourceAfter).not.match(/without\s*\(/);
    expect(projection.projectedDocument.root.children[0].provenance.suppressed)
      .to.be.false;
  });

  it('projects suppression inside a resolved part override and reparses its identities', () => {
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
        })]
      })
    });
    const source = `const Example = component({
  name: 'example',
  submorphs: [part(Card, {
    name: 'card',
    submorphs: [{ name: 'label', submorphs: [] }]
  })]
});`;
    const document = parseComponentSource({
      source,
      moduleId,
      exportName: 'Example',
      componentId,
      resolveComponentDocument: ({ expression }) =>
        expression === 'Card' ? cardDocument : null
    }).document;
    const label = document.root.children[0].children[0];
    const icon = label.children[0];
    const suppressed = reduce(document, SuppressInheritedNode, { nodeId: icon.id });
    const projection = projectComponentSource({
      source,
      beforeDocument: document,
      reduction: suppressed
    });

    expect(projection.supported).to.be.true;
    expect(projection.sourceAfter).includes('submorphs: [without("icon")]');
    expect(projection.projectedDocument.root.children[0].children[0].id).equals(label.id);
    expect(projection.projectedDocument.root.children[0].children[0].children[0].id)
      .equals(icon.id);
    expect(projection.projectedDocument.root.children[0].children[0].children[0]
      .provenance.suppressed).to.be.true;
    expect(componentDocumentsSemanticallyEqual(
      projection.projectedDocument,
      suppressed.document
    )).to.be.true;
  });

  it('reparents a local node and removes its former owner layout policy', () => {
    const source = `const Example = component({
  name: 'example',
  submorphs: [{
    name: 'source',
    layout: new TilingLayout({
      resizePolicies: [['moved', { width: 'fill' }]]
    }),
    submorphs: [{ name: 'moved' }]
  }, {
    name: 'destination'
  }]
});`;
    const document = parsed(source);
    const sourceNode = document.root.children[0];
    const destination = document.root.children[1];
    const movedNode = sourceNode.children[0];
    const reduction = reduce(document, MoveNode, {
      nodeId: movedNode.id,
      parentId: destination.id,
      beforeId: null
    });
    const projection = projectComponentSource({ source, beforeDocument: document, reduction });

    expect(projection.supported).to.be.true;
    expect(projection.changes).length(3);
    expect(projection.sourceAfter).includes('resizePolicies: []');
    expect(projection.sourceAfter).not.includes("['moved'");
    expect(componentDocumentsSemanticallyEqual(
      projection.projectedDocument,
      reduction.document
    )).to.be.true;
  });

  it('removes a sole child from a trailing-comma submorph list', () => {
    const source = `const Example = component({
  name: 'example',
  submorphs: [{ name: 'only' },]
});`;
    const document = parsed(source);
    const reduction = reduce(document, RemoveNode, {
      nodeId: document.root.children[0].id
    });
    const projection = projectComponentSource({ source, beforeDocument: document, reduction });

    expect(projection.supported).to.be.true;
    expect(projection.sourceAfter).includes('submorphs: []');
  });
});
