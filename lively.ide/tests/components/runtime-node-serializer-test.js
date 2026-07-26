/* global describe, it */
import { expect } from 'mocha-es6';
import { parseComponentSource } from '../../components/reconciliation/source-adapter.js';
import {
  ComponentNodeProvenanceKind,
  sourceComponentReference
} from '../../components/reconciliation/component-document.js';
import {
  RuntimeNodeSerializationDiagnosticKind,
  serializeRuntimeComponentNode
} from '../../components/reconciliation/runtime-node-serializer.js';

const moduleId = 'local://runtime-node-serializer/component.cp.js';
const componentId = `${moduleId}#Example`;

function document () {
  return parseComponentSource({
    source: `const Example = component({ name: 'root' });`,
    moduleId,
    exportName: 'Example',
    componentId
  }).document;
}

describe('projectional runtime node serializer', () => {
  it('serializes plain morph specs into semantic nodes with import requirements', () => {
    const fill = {
      __serialize__: () => ({
        __expr__: 'Color.green',
        bindings: { 'lively.graphics': ['Color'] }
      })
    };
    const componentDocument = document();
    const serialized = serializeRuntimeComponentNode({
      document: componentDocument,
      parentId: componentDocument.root.id,
      index: 0,
      morph: {
        spec: () => ({
          name: 'introduced',
          fill,
          submorphs: [{ name: 'nested', opacity: 0.5, submorphs: [] }]
        })
      }
    });

    expect(serialized.supported).to.be.true;
    expect(serialized.node.id).equals(`${componentId}:node:0`);
    expect(serialized.node.children[0].id).equals(`${componentId}:node:0.0`);
    expect(serialized.node.properties.fill.expression).equals('Color.green');
    expect(serialized.requiredBindings[0]).containSubset({
      moduleId: 'lively.graphics',
      imported: 'Color',
      local: 'Color'
    });
  });

  it('preserves source-located runtime types and their import requirements', () => {
    class TypedMorph {}
    TypedMorph[Symbol.for('lively-module-meta')] = {
      package: { name: 'local://widgets' },
      pathInPackage: 'typed-morph.js'
    };
    const componentDocument = document();
    const serialized = serializeRuntimeComponentNode({
      document: componentDocument,
      parentId: componentDocument.root.id,
      index: 0,
      morph: {
        spec: () => ({
          name: 'typed',
          type: TypedMorph,
          submorphs: []
        })
      }
    });

    expect(serialized.supported).to.be.true;
    expect(serialized.node.typeExpression).equals('TypedMorph');
    expect(serialized.requiredBindings[0]).containSubset({
      moduleId: 'local://widgets/typed-morph.js',
      imported: 'TypedMorph',
      local: 'TypedMorph'
    });
  });

  it('rejects source-less runtime types before producing a semantic node', () => {
    class SourceLessMorph {}
    SourceLessMorph[Symbol.for('lively-module-meta')] = null;
    const componentDocument = document();
    const serialized = serializeRuntimeComponentNode({
      document: componentDocument,
      parentId: componentDocument.root.id,
      index: 0,
      morph: {
        spec: () => ({
          name: 'unsupported',
          type: SourceLessMorph,
          submorphs: []
        })
      }
    });

    expect(serialized.supported).to.be.false;
    expect(serialized.node).equals(null);
    expect(serialized.diagnostics[0].kind)
      .equals(RuntimeNodeSerializationDiagnosticKind.UNSUPPORTED_TYPE);
  });

  it('preserves source component provenance for introduced parts', () => {
    class DerivedMorph {}
    const componentMeta = {
      exportedName: 'Button',
      moduleId: 'local://widgets/button.cp.js',
      path: []
    };
    const morph = {
      master: {
        _isOverridden: true,
        parent: { [Symbol.for('lively-module-meta')]: componentMeta },
        _originalSpec: { name: 'button', fill: 'red' },
        spec: {
          name: 'button',
          fill: 'red',
          opacity: 0.5,
          submorphs: [{ name: 'inherited label', opacity: 0.7 }]
        }
      },
      submorphs: [{ name: 'inherited label' }],
      spec: () => ({
        name: 'button',
        type: DerivedMorph,
        fill: 'red',
        opacity: 0.5,
        master: { cannotSerialize: () => {} },
        submorphs: [{ name: 'inherited label', opacity: 0.7, submorphs: [] }]
      })
    };
    const componentDocument = document();
    const serialized = serializeRuntimeComponentNode({
      document: componentDocument,
      parentId: componentDocument.root.id,
      index: 0,
      morph
    });

    expect(serialized.supported).to.be.true;
    expect(serialized.node.partComponent.expression).equals('Button');
    expect(serialized.node.typeExpression).equals(null);
    expect(serialized.node.properties.fill.value).equals('red');
    expect(serialized.node.properties).not.haveOwnProperty('opacity');
    expect(serialized.node.properties).not.haveOwnProperty('master');
    expect(serialized.node.children).to.have.length(1);
    expect(serialized.node.children[0].name).equals('inherited label');
    expect(serialized.node.children[0].properties).deep.equals({});
    expect(serialized.requiredBindings).containSubset([
      {
        moduleId: 'local://widgets/button.cp.js',
        imported: 'Button',
        local: 'Button'
      },
      {
        moduleId: 'lively.morphic',
        imported: 'part',
        local: 'part'
      }
    ]);
  });

  it('preserves nested add commands in overridden part specs', () => {
    const componentMeta = {
      exportedName: 'Button',
      moduleId: 'local://widgets/button.cp.js',
      path: []
    };
    const addedChild = {
      name: 'badge',
      spec: () => ({ name: 'badge', fill: 'red', submorphs: [] })
    };
    const morph = {
      master: {
        _isOverridden: true,
        parent: { [Symbol.for('lively-module-meta')]: componentMeta },
        _originalSpec: {
          name: 'button',
          submorphs: [{
            COMMAND: 'add',
            props: { name: 'badge', fill: 'red', __wasAddedToDerived__: true },
            before: null
          }]
        }
      },
      submorphs: [addedChild],
      spec: () => ({ name: 'button', submorphs: [{ name: 'badge', fill: 'red' }] })
    };
    const componentDocument = document();
    const serialized = serializeRuntimeComponentNode({
      document: componentDocument,
      parentId: componentDocument.root.id,
      index: 0,
      morph
    });

    expect(serialized.supported).to.be.true;
    expect(serialized.node.children).to.have.length(1);
    expect(serialized.node.children[0].name).equals('badge');
    expect(serialized.node.children[0].provenance.kind)
      .equals(ComponentNodeProvenanceKind.ADDED);
    expect(serialized.node.children[0].properties)
      .not.haveOwnProperty('__wasAddedToDerived__');
    expect(serialized.requiredBindings).containSubset([{
      moduleId: 'lively.morphic',
      imported: 'add',
      local: 'add'
    }]);
  });

  it('anchors an unqualified nested add before its following inherited sibling', () => {
    const componentMeta = {
      exportedName: 'Button',
      moduleId: 'local://widgets/button.cp.js',
      path: []
    };
    const addedChild = {
      name: 'badge',
      spec: () => ({ name: 'badge', fill: 'red', submorphs: [] })
    };
    const inheritedChild = {
      name: 'label',
      spec: () => ({ name: 'label', submorphs: [] })
    };
    const componentDocument = document();
    const serialized = serializeRuntimeComponentNode({
      document: componentDocument,
      parentId: componentDocument.root.id,
      index: 0,
      morph: {
        master: {
          _isOverridden: true,
          parent: { [Symbol.for('lively-module-meta')]: componentMeta },
          _originalSpec: {
            name: 'button',
            submorphs: [{
              COMMAND: 'add',
              props: { name: 'badge', fill: 'red', __wasAddedToDerived__: true },
              before: null
            }, { name: 'label' }]
          }
        },
        submorphs: [addedChild, inheritedChild],
        spec: () => ({
          name: 'button',
          submorphs: [
            { name: 'badge', fill: 'red' },
            { name: 'label' }
          ]
        })
      }
    });

    expect(serialized.supported).to.be.true;
    expect(serialized.node.children.map(({ name }) => name))
      .deep.equals(['badge', 'label']);
    expect(serialized.node.children[0].provenance.beforeId)
      .equals(serialized.node.children[1].id);
  });

  it('marks nested policy specs as inherited overrides when the part resolves', () => {
    const partMeta = {
      exportedName: 'Base',
      moduleId: 'local://widgets/base.cp.js',
      path: []
    };
    const nestedPolicy = {
      isPolicy: true,
      _originalSpec: { name: 'nested part', opacity: 0.5 },
      parent: {
        [Symbol.for('lively-module-meta')]: {
          exportedName: 'Leaf',
          moduleId: 'local://widgets/leaf.cp.js',
          path: []
        }
      }
    };
    const resolvedPart = document();
    const componentDocument = parseComponentSource({
      source: `const Example = component({ name: 'root' });`,
      moduleId,
      exportName: 'Example',
      componentId,
      resolveComponentDocument: ({ expression }) =>
        expression === 'Base' ? resolvedPart : null
    }).document;
    const serialized = serializeRuntimeComponentNode({
      document: componentDocument,
      parentId: componentDocument.root.id,
      index: 0,
      morph: {
        master: {
          parent: { [Symbol.for('lively-module-meta')]: partMeta },
          _originalSpec: {
            name: 'base part',
            submorphs: [nestedPolicy]
          }
        },
        submorphs: [{
          name: 'nested part',
          spec: () => ({ name: 'nested part', opacity: 0.5, submorphs: [] })
        }],
        spec: () => ({
          name: 'base part',
          submorphs: [{ name: 'nested part', opacity: 0.5, submorphs: [] }]
        })
      }
    });

    expect(serialized.supported).to.be.true;
    expect(serialized.node.children[0].provenance.kind)
      .equals(ComponentNodeProvenanceKind.INHERITED);
    expect(serialized.node.children[0].provenance.hasLocalOverrides).to.be.true;
    expect(serialized.node.children[0].partComponent).equals(null);
  });

  it('uses runtime child order when materializing a resolved part subtree', () => {
    const partMeta = {
      exportedName: 'Base',
      moduleId: 'local://widgets/base.cp.js',
      path: []
    };
    const resolvedPart = document();
    const componentDocument = parseComponentSource({
      source: `const Example = component({ name: 'root' });`,
      moduleId,
      exportName: 'Example',
      componentId,
      resolveComponentDocument: ({ expression }) =>
        expression === 'Base' ? resolvedPart : null
    }).document;
    const localAddition = {
      COMMAND: 'add',
      props: { name: 'local addition', opacity: 0.5 },
      before: 'base child'
    };
    const runtimeAddition = {
      name: 'local addition',
      spec: () => ({ name: 'local addition', opacity: 0.5, submorphs: [] })
    };
    const runtimeBaseChild = {
      name: 'base child',
      spec: () => ({ name: 'base child', submorphs: [] })
    };
    const serialized = serializeRuntimeComponentNode({
      document: componentDocument,
      parentId: componentDocument.root.id,
      index: 0,
      materializePartSubtree: true,
      morph: {
        master: {
          parent: { [Symbol.for('lively-module-meta')]: partMeta },
          _originalSpec: {
            name: 'base part',
            submorphs: [{ name: 'base child' }, localAddition]
          }
        },
        submorphs: [runtimeAddition, runtimeBaseChild],
        spec: () => ({
          name: 'base part',
          submorphs: [
            { name: 'local addition', opacity: 0.5, submorphs: [] },
            { name: 'base child', submorphs: [] }
          ]
        })
      }
    });

    expect(serialized.supported).to.be.true;
    expect(serialized.node.children.map(({ name }) => name))
      .deep.equals(['local addition', 'base child']);
    expect(serialized.node.children[0].provenance.kind)
      .equals(ComponentNodeProvenanceKind.ADDED);
    expect(serialized.node.children[1].provenance.kind)
      .equals(ComponentNodeProvenanceKind.INHERITED);
  });

  it('uses a semantic part fallback for inherited sub-policies', () => {
    const runtimeMaster = {
      parent: {
        [Symbol.for('lively-module-meta')]: {
          exportedName: 'Container',
          moduleId: 'local://widgets/container.cp.js',
          path: ['nested part']
        }
      }
    };
    runtimeMaster.self = runtimeMaster;
    const componentDocument = document();
    const serialized = serializeRuntimeComponentNode({
      document: componentDocument,
      parentId: componentDocument.root.id,
      index: 0,
      partComponent: sourceComponentReference('Leaf'),
      morph: {
        master: runtimeMaster,
        spec: () => ({ name: 'nested part', master: runtimeMaster, submorphs: [] })
      }
    });

    expect(serialized.supported).to.be.true;
    expect(serialized.node.partComponent.expression).equals('Leaf');
    expect(serialized.node.properties).not.haveOwnProperty('master');
  });

  it('recognizes the root auto policy behind an inherited part applicator', () => {
    const leafPolicy = {
      [Symbol.for('lively-module-meta')]: {
        exportedName: 'Leaf',
        moduleId: 'local://widgets/leaf.cp.js',
        path: []
      }
    };
    const runtimeMaster = {
      _autoMaster: leafPolicy,
      parent: {
        [Symbol.for('lively-module-meta')]: {
          exportedName: 'Container',
          moduleId: 'local://widgets/container.cp.js',
          path: ['nested part']
        }
      },
      _originalSpec: { name: 'nested part' }
    };
    const componentDocument = document();
    const serialized = serializeRuntimeComponentNode({
      document: componentDocument,
      parentId: componentDocument.root.id,
      index: 0,
      morph: {
        master: runtimeMaster,
        spec: () => ({ name: 'nested part', master: runtimeMaster, submorphs: [] })
      }
    });

    expect(serialized.supported).to.be.true;
    expect(serialized.node.partComponent.expression).equals('Leaf');
    expect(serialized.node.properties).not.haveOwnProperty('master');
  });

  it('recognizes the component parent behind an inherited nested policy', () => {
    const leafPolicy = {
      [Symbol.for('lively-module-meta')]: {
        exportedName: 'Leaf',
        moduleId: 'local://widgets/leaf.cp.js',
        path: []
      }
    };
    const nestedPolicy = {
      _parent: leafPolicy,
      get parent () { return this._parent; },
      [Symbol.for('lively-module-meta')]: {
        exportedName: 'Container',
        moduleId: 'local://widgets/container.cp.js',
        path: ['nested part']
      }
    };
    const runtimeMaster = {
      parent: nestedPolicy,
      _originalSpec: { name: 'nested part' }
    };
    const componentDocument = document();
    const serialized = serializeRuntimeComponentNode({
      document: componentDocument,
      parentId: componentDocument.root.id,
      index: 0,
      morph: {
        master: runtimeMaster,
        spec: () => ({ name: 'nested part', master: runtimeMaster, submorphs: [] })
      }
    });

    expect(serialized.supported).to.be.true;
    expect(serialized.node.partComponent.expression).equals('Leaf');
    expect(serialized.node.properties).not.haveOwnProperty('master');
  });

  it('prefers a direct part policy over an applicator auto policy', () => {
    const policyMeta = (exportedName, moduleId) => ({
      exportedName, moduleId, path: []
    });
    const componentDocument = document();
    const serialized = serializeRuntimeComponentNode({
      document: componentDocument,
      parentId: componentDocument.root.id,
      index: 0,
      morph: {
        master: {
          _autoMaster: {
            [Symbol.for('lively-module-meta')]: policyMeta(
              'WrongComponent', 'local://widgets/wrong.cp.js')
          },
          parent: {
            [Symbol.for('lively-module-meta')]: policyMeta(
              'ExpectedComponent', 'local://widgets/expected.cp.js')
          },
          _originalSpec: { name: 'introduced part' }
        },
        spec: () => ({ name: 'introduced part', submorphs: [] })
      }
    });

    expect(serialized.supported).to.be.true;
    expect(serialized.node.partComponent.expression).equals('ExpectedComponent');
    expect(serialized.requiredBindings).containSubset([{
      moduleId: 'local://widgets/expected.cp.js',
      imported: 'ExpectedComponent',
      local: 'ExpectedComponent'
    }]);
    expect(serialized.requiredBindings.some(({ imported }) =>
      imported === 'WrongComponent')).to.be.false;
  });

  it('allocates a free identity when inserting at an occupied source index', () => {
    const parsed = parseComponentSource({
      source: `const Example = component({
  name: 'root',
  submorphs: [{ name: 'existing' }]
});`,
      moduleId,
      exportName: 'Example',
      componentId
    }).document;
    const serialized = serializeRuntimeComponentNode({
      document: parsed,
      parentId: parsed.root.id,
      index: 0,
      morph: {
        spec: () => ({ name: 'introduced', submorphs: [] })
      }
    });

    expect(serialized.supported).to.be.true;
    expect(serialized.node.id).equals(`${componentId}:node:1`);
    expect(serialized.node.id).not.equals(parsed.root.children[0].id);
  });

  it('allocates a stable sibling name and reports the required runtime rename', () => {
    const parsed = parseComponentSource({
      source: `const Example = component({
  name: 'root',
  submorphs: [{ name: 'duplicate' }]
});`,
      moduleId,
      exportName: 'Example',
      componentId
    }).document;
    const serialized = serializeRuntimeComponentNode({
      document: parsed,
      parentId: parsed.root.id,
      index: 1,
      morph: {
        spec: () => ({ name: 'duplicate', submorphs: [] })
      }
    });

    expect(serialized.supported).to.be.true;
    expect(serialized.node.name).equals('duplicate_1');
    expect(serialized.runtimeRename).deep.equals({
      before: 'duplicate', after: 'duplicate_1'
    });
  });
});
