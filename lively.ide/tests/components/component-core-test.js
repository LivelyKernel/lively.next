/* global describe, it */
import { expect } from 'mocha-es6';
import {
  ComponentDocument,
  ComponentNode,
  ComponentNodeProvenanceKind,
  ComponentPropertyKind,
  addedNodeProvenance,
  explicitProperty,
  findComponentNode,
  inheritedNodeProvenance,
  localNodeProvenance,
  resizePolicyLayoutReference,
  sourceComponentReference,
  tilingLayoutModel
} from '../../components/reconciliation/component-document.js';
import {
  ClearPropertyOverride,
  ComponentMoveInheritanceTransitionKind,
  ComponentTextEditKind,
  EditText,
  IntroduceNode,
  MoveNode,
  RemoveNode,
  RenameNode,
  SetOpaqueProperty,
  SetMaster,
  SetProperty,
  SuppressInheritedNode
} from '../../components/reconciliation/commands.js';
import {
  ComponentCommandError,
  ComponentSemanticDeltaKind,
  reduceComponent
} from '../../components/reconciliation/reducer.js';
import {
  ComponentDocumentInvariantError,
  assertComponentDocument
} from '../../components/reconciliation/invariants.js';
import {
  ComponentImportKind,
  componentImportBinding,
  componentImportBindingsFromExpression
} from '../../components/reconciliation/import-bindings.js';

function node (id, children = [], options = {}) {
  return new ComponentNode({
    id,
    name: options.name || id,
    provenance: options.provenance || localNodeProvenance(),
    properties: options.properties || {},
    partComponent: options.partComponent || null,
    children
  });
}

function documentWith (children = []) {
  return new ComponentDocument({
    componentId: 'component',
    moduleId: 'local://component.js',
    exportName: 'Component',
    root: node('root', children)
  });
}

function commandSpec (document, nodeId) {
  return {
    componentId: document.componentId,
    expectedRevision: document.revision,
    nodeId
  };
}

function captureError (callback) {
  try { callback(); } catch (error) { return error; }
  return null;
}

describe('projectional component semantic core', () => {
  it('builds immutable runtime-independent documents with explicit value variants', () => {
    const child = new ComponentNode({
      id: 'child',
      name: 'child',
      provenance: { kind: ComponentNodeProvenanceKind.ADDED },
      properties: {
        fill: {
          kind: ComponentPropertyKind.EXPLICIT_VALUE,
          value: { color: 'red' }
        },
        master: {
          kind: ComponentPropertyKind.OPAQUE_EXPRESSION,
          expression: 'MyMaster'
        }
      }
    });
    const document = documentWith([child]);

    expect(Object.isFrozen(document)).to.be.true;
    expect(Object.isFrozen(document.root.children)).to.be.true;
    expect(Object.isFrozen(child.provenance)).to.be.true;
    expect(Object.isFrozen(child.properties.fill)).to.be.true;
    expect(Object.isFrozen(child.properties.fill.value)).to.be.true;
    expect(child.properties.master.expression).equals('MyMaster');
    expect(assertComponentDocument(document)).equals(document);
  });

  it('sets and clears scalar overrides with exact inverse commands', () => {
    const original = documentWith([node('child')]);
    const set = reduceComponent(original, SetProperty({
      ...commandSpec(original, 'child'),
      property: 'fill',
      value: 'green'
    }));

    expect(set.document.revision).equals(1);
    expect(set.document.root.children[0].properties.fill.value).equals('green');
    expect(set.semanticDelta.kind).equals(ComponentSemanticDeltaKind.PROPERTY_SET);
    const restored = reduceComponent(set.document, set.inverseCommand);
    expect(restored.document.root).deep.equals(original.root);

    const opaque = reduceComponent(original, SetOpaqueProperty({
      ...commandSpec(original, 'child'),
      property: 'fill',
      expression: 'Color.rgb(1, 2, 3)'
    }));
    const cleared = reduceComponent(opaque.document, ClearPropertyOverride({
      ...commandSpec(opaque.document, 'child'),
      property: 'fill'
    }));
    expect(cleared.document.root).deep.equals(original.root);
  });

  it('validates and freezes opaque expression import requirements', () => {
    const original = documentWith([node('child')]);
    const bindings = componentImportBindingsFromExpression({
      'lively.graphics': [
        'Color',
        { exported: 'pt', local: 'point' }
      ]
    });
    const command = SetOpaqueProperty({
      ...commandSpec(original, 'child'),
      property: 'fill',
      expression: 'Color.rgb(1, 2, 3)',
      requiredBindings: bindings
    });
    const reduction = reduceComponent(original, command);

    expect(Object.isFrozen(command.requiredBindings)).to.be.true;
    expect(command.requiredBindings).deep.equals([
      componentImportBinding({
        kind: ComponentImportKind.NAMED,
        moduleId: 'lively.graphics',
        imported: 'Color',
        local: 'Color'
      }),
      componentImportBinding({
        kind: ComponentImportKind.NAMED,
        moduleId: 'lively.graphics',
        imported: 'pt',
        local: 'point'
      })
    ]);
    expect(reduction.semanticDelta.requiredBindings).equals(command.requiredBindings);
    expect(() => SetOpaqueProperty({
      ...commandSpec(original, 'child'),
      property: 'fill',
      expression: 'Color.red',
      requiredBindings: [
        componentImportBinding({
          kind: ComponentImportKind.NAMED,
          moduleId: 'first',
          imported: 'Color',
          local: 'Color'
        }),
        componentImportBinding({
          kind: ComponentImportKind.NAMED,
          moduleId: 'second',
          imported: 'Color',
          local: 'Color'
        })
      ]
    })).to.throw(/Conflicting component imports/);
  });

  it('models master changes with explicit expression dependencies and an exact inverse', () => {
    const original = documentWith([node('child', [], {
      properties: { master: explicitProperty({ mode: 'base' }) }
    })]);
    const requiredBindings = [componentImportBinding({
      kind: ComponentImportKind.NAMED,
      moduleId: 'local://masters.js',
      imported: 'HoverMaster',
      local: 'HoverMaster'
    })];
    const changed = reduceComponent(original, SetMaster({
      ...commandSpec(original, 'child'),
      expression: 'HoverMaster',
      requiredBindings
    }));

    expect(changed.document.root.children[0].properties.master.expression)
      .equals('HoverMaster');
    expect(changed.semanticDelta.requiredBindings).deep.equals(requiredBindings);
    const restored = reduceComponent(changed.document, changed.inverseCommand);
    expect(restored.document.root).deep.equals(original.root);
  });

  it('rejects stale revisions and leaves the original document untouched', () => {
    const original = documentWith([node('child')]);
    const error = captureError(() => reduceComponent(original, RenameNode({
      componentId: original.componentId,
      expectedRevision: 1,
      nodeId: 'child',
      name: 'renamed'
    })));

    expect(error).to.be.instanceOf(ComponentCommandError);
    expect(original.revision).equals(0);
    expect(original.root.children[0].name).equals('child');
  });

  it('enforces stable IDs and sibling naming invariants', () => {
    const original = documentWith([node('first'), node('second')]);
    const duplicateName = captureError(() => reduceComponent(original, RenameNode({
      ...commandSpec(original, 'second'),
      name: 'first'
    })));
    const duplicateId = captureError(() => reduceComponent(original, IntroduceNode({
      ...commandSpec(original, 'first'),
      parentId: 'root',
      node: node('first', [], { provenance: addedNodeProvenance() })
    })));

    expect(duplicateName).to.be.instanceOf(ComponentDocumentInvariantError);
    expect(duplicateId).to.be.instanceOf(ComponentCommandError);
  });

  it('introduces, moves, and removes nodes with inverse structural commands', () => {
    const original = documentWith([
      node('source', [node('moved', [], { provenance: addedNodeProvenance() })]),
      node('destination')
    ]);
    const moved = reduceComponent(original, MoveNode({
      ...commandSpec(original, 'moved'),
      parentId: 'destination',
      beforeId: null
    }));
    expect(moved.document.root.children[1].children[0].id).equals('moved');
    const moveRestored = reduceComponent(moved.document, moved.inverseCommand);
    expect(moveRestored.document.root).deep.equals(original.root);

    const introducedNode = node('introduced', [], { provenance: addedNodeProvenance() });
    const introduced = reduceComponent(original, IntroduceNode({
      ...commandSpec(original, introducedNode.id),
      parentId: 'destination',
      node: introducedNode,
      beforeId: null
    }));
    const introductionRestored = reduceComponent(introduced.document, introduced.inverseCommand);
    expect(introductionRestored.document.root).deep.equals(original.root);

    const removed = reduceComponent(original, RemoveNode({
      ...commandSpec(original, 'moved')
    }));
    const removalRestored = reduceComponent(removed.document, removed.inverseCommand);
    expect(removalRestored.document.root).deep.equals(original.root);
  });

  it('restores exact sibling order after same-parent moves', () => {
    const original = documentWith([
      node('first'),
      node('second'),
      node('third')
    ]);
    const movedToFront = reduceComponent(original, MoveNode({
      ...commandSpec(original, 'second'),
      parentId: 'root',
      beforeId: 'first'
    }));

    expect(movedToFront.document.root.children.map(child => child.id))
      .deep.equals(['second', 'first', 'third']);
    const frontMoveRestored = reduceComponent(
      movedToFront.document,
      movedToFront.inverseCommand
    );
    expect(frontMoveRestored.document.root).deep.equals(original.root);

    const movedToEnd = reduceComponent(original, MoveNode({
      ...commandSpec(original, 'first'),
      parentId: 'root',
      beforeId: null
    }));
    expect(movedToEnd.document.root.children.map(child => child.id))
      .deep.equals(['second', 'third', 'first']);
    const endMoveRestored = reduceComponent(
      movedToEnd.document,
      movedToEnd.inverseCommand
    );
    expect(endMoveRestored.document.root).deep.equals(original.root);
  });

  it('updates and restores added-node ordering anchors across parents', () => {
    const original = documentWith([
      node('source', [
        node('moved', [], { provenance: addedNodeProvenance({ beforeId: 'source-tail' }) }),
        node('source-tail')
      ]),
      node('destination', [node('destination-tail')], {
        partComponent: sourceComponentReference('Destination')
      })
    ]);
    const moved = reduceComponent(original, MoveNode({
      ...commandSpec(original, 'moved'),
      parentId: 'destination',
      beforeId: 'destination-tail'
    }));

    expect(findComponentNode(moved.document, 'moved').provenance.beforeId)
      .equals('destination-tail');
    const restored = reduceComponent(moved.document, moved.inverseCommand);
    expect(restored.document.root).deep.equals(original.root);
  });

  it('changes moved-node provenance at source ownership boundaries and restores it', () => {
    const original = documentWith([
      node('part', [
        node('moved', [], { provenance: addedNodeProvenance() })
      ], {
        provenance: addedNodeProvenance(),
        partComponent: sourceComponentReference('Card')
      }),
      node('plain addition', [], { provenance: addedNodeProvenance() })
    ]);
    const moved = reduceComponent(original, MoveNode({
      ...commandSpec(original, 'moved'),
      parentId: 'plain addition',
      beforeId: null
    }));

    expect(findComponentNode(moved.document, 'moved').provenance)
      .deep.equals(localNodeProvenance());
    const restored = reduceComponent(moved.document, moved.inverseCommand);
    expect(restored.document.root).deep.equals(original.root);
  });

  it('materializes and exactly restores an inherited cross-parent move', () => {
    const original = documentWith([
      node('part', [
        node('inherited', [], { provenance: inheritedNodeProvenance() })
      ], { partComponent: sourceComponentReference('Card') }),
      node('destination', [], { partComponent: sourceComponentReference('Destination') })
    ]);
    const materialized = node('materialized', [], {
      name: 'inherited',
      provenance: addedNodeProvenance()
    });
    const moved = reduceComponent(original, MoveNode({
      ...commandSpec(original, 'inherited'),
      parentId: 'destination',
      beforeId: null,
      runtimeFromIndex: 3,
      runtimeToIndex: 5,
      inheritanceTransition: {
        kind: ComponentMoveInheritanceTransitionKind.MATERIALIZE,
        node: materialized
      }
    }));

    expect(findComponentNode(moved.document, 'inherited').provenance.suppressed)
      .to.be.true;
    expect(findComponentNode(moved.document, 'materialized').name).equals('inherited');
    expect(moved.semanticDelta).containSubset({
      nodeId: 'materialized',
      inheritedNodeId: 'inherited',
      runtimeFromIndex: 3,
      runtimeToIndex: 5
    });
    const restored = reduceComponent(moved.document, moved.inverseCommand);
    expect(restored.document.root).deep.equals(original.root);
  });

  it('consolidates edits made while an inherited node was materialized', () => {
    const inherited = node('inherited', [], {
      provenance: inheritedNodeProvenance({ hasLocalOverrides: true }),
      properties: { borderWidth: explicitProperty(2) }
    });
    const original = documentWith([
      node('part', [inherited], {
        partComponent: sourceComponentReference('Card')
      }),
      node('destination')
    ]);
    const materialized = node('materialized', [], {
      name: 'inherited',
      provenance: addedNodeProvenance(),
      properties: {
        borderWidth: explicitProperty(2),
        opacity: explicitProperty(0.4)
      }
    });
    const moved = reduceComponent(original, MoveNode({
      ...commandSpec(original, inherited.id),
      parentId: 'destination',
      beforeId: null,
      inheritanceTransition: {
        kind: ComponentMoveInheritanceTransitionKind.MATERIALIZE,
        node: materialized
      }
    }));
    const restored = reduceComponent(moved.document, MoveNode({
      ...commandSpec(moved.document, materialized.id),
      parentId: 'part',
      beforeId: null,
      inheritanceTransition: {
        kind: ComponentMoveInheritanceTransitionKind.RESTORE,
        inheritedNodeId: inherited.id
      }
    }));

    expect(findComponentNode(restored.document, materialized.id)).equals(null);
    expect(findComponentNode(restored.document, inherited.id).properties)
      .deep.equals(materialized.properties);
    expect(restored.semanticDelta).containSubset({
      inheritanceTransition: ComponentMoveInheritanceTransitionKind.RESTORE,
      consolidated: true,
      consolidatedNodeId: inherited.id
    });
  });

  it('tracks runtime structural indices separately from suppressed semantic children', () => {
    const original = documentWith([
      node('hidden', [], {
        provenance: inheritedNodeProvenance({ suppressed: true })
      }),
      node('first'),
      node('second')
    ]);
    const introducedNode = node('introduced');
    const introduced = reduceComponent(original, IntroduceNode({
      ...commandSpec(original, introducedNode.id),
      parentId: 'root',
      node: introducedNode,
      beforeId: 'first'
    }));
    expect(introduced.semanticDelta).containSubset({ index: 1, runtimeIndex: 0 });

    const removed = reduceComponent(original, RemoveNode({
      ...commandSpec(original, 'first')
    }));
    expect(removed.semanticDelta).containSubset({ index: 1, runtimeIndex: 0 });

    const moved = reduceComponent(original, MoveNode({
      ...commandSpec(original, 'second'),
      parentId: 'root',
      beforeId: 'first'
    }));
    expect(moved.semanticDelta).containSubset({
      fromIndex: 2,
      runtimeFromIndex: 1,
      toIndex: 1,
      runtimeToIndex: 0
    });

    const observedIntroduction = reduceComponent(original, IntroduceNode({
      ...commandSpec(original, 'runtime-indexed'),
      parentId: 'root',
      node: node('runtime-indexed'),
      beforeId: null,
      runtimeIndex: 7
    }));
    expect(observedIntroduction.semanticDelta.runtimeIndex).equals(7);
    expect(observedIntroduction.inverseCommand.runtimeIndex).equals(7);

    const observedMove = reduceComponent(original, MoveNode({
      ...commandSpec(original, 'second'),
      parentId: 'root',
      beforeId: 'first',
      runtimeFromIndex: 6,
      runtimeToIndex: 4
    }));
    expect(observedMove.semanticDelta).containSubset({
      runtimeFromIndex: 6,
      runtimeToIndex: 4
    });
    expect(observedMove.inverseCommand).containSubset({
      runtimeFromIndex: 4,
      runtimeToIndex: 6
    });
  });

  it('removes and exactly restores semantic owner-layout references', () => {
    const original = new ComponentDocument({
      componentId: 'component',
      moduleId: 'local://component.js',
      exportName: 'Component',
      root: node('root', [node('first'), node('second')]),
      layoutModels: [tilingLayoutModel({
        ownerId: 'root',
        expressionTemplate: 'new TilingLayout({ resizePolicies: <component-resize-policies> })',
        references: [
          resizePolicyLayoutReference({
            targetId: 'first',
            expressionTemplate: '[<component-layout-target>, { width: "fill" }]'
          }),
          resizePolicyLayoutReference({
            targetId: 'second',
            expressionTemplate: '[<component-layout-target>, { width: "fixed" }]'
          })
        ]
      })]
    });
    const removed = reduceComponent(original, RemoveNode({
      ...commandSpec(original, 'first')
    }));

    expect(removed.document.layoutModels[0].references.map(({ targetId }) => targetId))
      .deep.equals(['second']);
    expect(removed.inverseCommand.parentLayoutReference).include({ index: 0 });
    const restored = reduceComponent(removed.document, removed.inverseCommand);
    expect(restored.document.root).deep.equals(original.root);
    expect(restored.document.layoutModels).deep.equals(original.layoutModels);
  });

  it('removes and restores layout models owned by descendants of a removed subtree', () => {
    const original = new ComponentDocument({
      componentId: 'component',
      moduleId: 'local://component.js',
      exportName: 'Component',
      root: node('root', [
        node('container', [node('layout-owner', [node('managed')])]),
        node('sibling')
      ]),
      layoutModels: [
        tilingLayoutModel({
          ownerId: 'root',
          expressionTemplate: 'new TilingLayout({ resizePolicies: <component-resize-policies> })',
          references: [
            resizePolicyLayoutReference({
              targetId: 'container',
              expressionTemplate: '[<component-layout-target>, { width: "fill" }]'
            }),
            resizePolicyLayoutReference({
              targetId: 'sibling',
              expressionTemplate: '[<component-layout-target>, { width: "fixed" }]'
            })
          ]
        }),
        tilingLayoutModel({
          ownerId: 'layout-owner',
          expressionTemplate: 'new TilingLayout({ resizePolicies: <component-resize-policies> })',
          references: [resizePolicyLayoutReference({
            targetId: 'managed',
            expressionTemplate: '[<component-layout-target>, { height: "fill" }]'
          })]
        })
      ]
    });
    const removed = reduceComponent(original, RemoveNode({
      ...commandSpec(original, 'container')
    }));

    expect(removed.document.layoutModels.map(({ ownerId }) => ownerId)).deep.equals(['root']);
    expect(removed.document.layoutModels[0].references.map(({ targetId }) => targetId))
      .deep.equals(['sibling']);
    expect(removed.inverseCommand.subtreeLayoutModels.map(({ index, model }) =>
      [index, model.ownerId])).deep.equals([[1, 'layout-owner']]);

    const restored = reduceComponent(removed.document, removed.inverseCommand);
    expect(restored.document.root).deep.equals(original.root);
    expect(restored.document.layoutModels).deep.equals(original.layoutModels);
  });

  it('moves layout-managed nodes and restores their former policy ownership', () => {
    const original = new ComponentDocument({
      componentId: 'component',
      moduleId: 'local://component.js',
      exportName: 'Component',
      root: node('root', [node('source', [node('moved')]), node('destination')]),
      layoutModels: [tilingLayoutModel({
        ownerId: 'source',
        expressionTemplate: 'new TilingLayout({ resizePolicies: <component-resize-policies> })',
        references: [resizePolicyLayoutReference({
          targetId: 'moved',
          expressionTemplate: '[<component-layout-target>, { width: "fill" }]'
        })]
      })]
    });
    const moved = reduceComponent(original, MoveNode({
      ...commandSpec(original, 'moved'),
      parentId: 'destination',
      beforeId: null
    }));

    expect(moved.document.layoutModels[0].references).deep.equals([]);
    expect(moved.inverseCommand.parentLayoutReference).include({ index: 0 });
    const restored = reduceComponent(moved.document, moved.inverseCommand);
    expect(restored.document.root).deep.equals(original.root);
    expect(restored.document.layoutModels).deep.equals(original.layoutModels);
  });

  it('prevents cyclic reparenting', () => {
    const original = documentWith([node('parent', [node('child')])]);
    const error = captureError(() => reduceComponent(original, MoveNode({
      ...commandSpec(original, 'parent'),
      parentId: 'child',
      beforeId: null
    })));

    expect(error).to.be.instanceOf(ComponentCommandError);
    expect(error.message).equals('Cannot move a node into its own subtree');
  });

  it('suppresses and restores inherited nodes without deleting their identity', () => {
    const inherited = node('inherited', [], {
      provenance: inheritedNodeProvenance()
    });
    const original = documentWith([inherited]);
    const suppressed = reduceComponent(original, SuppressInheritedNode({
      ...commandSpec(original, inherited.id)
    }));

    expect(suppressed.document.root.children[0].id).equals(inherited.id);
    expect(suppressed.document.root.children[0].provenance.suppressed).to.be.true;
    const restored = reduceComponent(suppressed.document, suppressed.inverseCommand);
    expect(restored.document.root).deep.equals(original.root);
  });

  it('models text replacement as a reversible semantic command', () => {
    const original = documentWith([node('text', [], {
      properties: { textAndAttributes: explicitProperty('before') }
    })]);
    const edited = reduceComponent(original, EditText({
      ...commandSpec(original, 'text'),
      operation: {
        kind: ComponentTextEditKind.REPLACE_ALL,
        before: 'before',
        after: 'after'
      }
    }));

    expect(edited.document.root.children[0].properties.textAndAttributes.value).equals('after');
    const restored = reduceComponent(edited.document, edited.inverseCommand);
    expect(restored.document.root).deep.equals(original.root);
  });
});
