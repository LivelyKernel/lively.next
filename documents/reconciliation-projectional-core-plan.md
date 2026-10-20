# Morphic Change Engine and Command-Driven Projectional Reconciliation

Status: implementation plan
Created: 2026-07-16

## Purpose

Repair the morphic change and undo infrastructure, then replace the mutation-driven component reconciler incrementally with a command-driven projectional core built on that reliable foundation. The source remains the persisted representation, while an immutable semantic document becomes authoritative during a component editing transaction.

The two efforts are intentionally connected but remain separate domains:

- the morphic change engine applies, rolls back, observes, and journals reliable runtime mutations;
- the component command engine expresses author intent and updates the semantic component document;
- the runtime projector applies component documents through the morphic change engine.

The current change manager, reconciler, undo manager, and fuzzers should serve as behavioral specifications during migration. Existing editing workflows must remain usable while operation and command families are moved to the new architecture one at a time.

## Target architecture

```text
                             Generic EditTransaction / Undo Journal
                                           │
                     ┌─────────────────────┴─────────────────────┐
                     │                                           │
             Morphic change engine                    Component command engine
          Operations and ChangeSets              Commands and ComponentDocument
                     │                                           │
         Ordinary runtime mutations                  ┌───────────┴───────────┐
                                                     │                       │
                                              Source projector       Runtime projector
                                                     │                       │
                                                     │              Morphic ChangeSet
                                                     └───────────┬───────────┘
                                                                 │
                                                      Atomic edit transaction
                                                     ┌───────────┴───────────┐
                                                     │                       │
                                               JavaScript source       Policies and morphs
```

The main boundaries are:

- `MorphicOperation`: one explicit and reversible runtime mutation.
- `MorphicChangeSet`: immutable ordered group of runtime operations.
- `EditTransaction`: generic undoable user action spanning one or more domains.
- `ComponentDocument`: immutable semantic representation of a component definition.
- `ComponentCommand`: explicit component-authoring intent.
- `reduce(document, command)`: pure semantic state transition.
- `SourceAdapter`: parses source into a document and produces formatting-preserving edits.
- `RuntimeProjector`: derives a morphic change set from a component document.
- `TransactionCoordinator`: validates and atomically commits source, document, and runtime changes.

The existing `stylePolicy.spec` becomes a runtime projection rather than a second mutable authority.

## Part I: Repair the morphic change foundation

### Phase 0: Define change semantics and invariants

Define the following concepts before changing implementation:

- `MorphicOperation`: one atomic runtime mutation with an exact inverse.
- `MorphicChangeSet`: an immutable, ordered group of operations.
- `EditTransaction`: a labeled and reversible user action containing morphic change sets or domain commands.
- `Projection`: mutations generated from authoritative state rather than new user intent.
- `Replay`: undo or redo execution that produces notifications without creating another history entry.

Every morphic operation should expose a closed kind and an interface such as:

```js
{
  kind,
  targetId,
  before,
  after,
  metadata,
  apply(context),
  invert()
}
```

Initial operation kinds:

- `SetMorphProperty`;
- `InsertMorph`;
- `RemoveMorph`;
- `MoveMorph`;
- `ReplaceText`;
- `CustomOperation`.

`CustomOperation` must require an explicit reversible handler. Arbitrary undo closures should be deprecated.

### Phase 1: Add characterization tests

Capture current behavior and known failures before replacing internals:

- scalar property undo and redo;
- sibling reordering;
- reparenting between owners;
- removal and restoration at the same index;
- nested method changes;
- metadata propagation;
- synchronous exceptions inside `withMetaDo`;
- asynchronous callbacks;
- replay without new undo entries;
- mutable property values;
- listener notification order;
- transaction rollback after a failed operation.

These tests define which behavior is intentional and which behavior must change.

### Phase 2: Implement atomic morphic change sets

Introduce an explicit transaction API behind the existing `ChangeManager` facade:

```js
changeManager.transaction({
  label: 'move morph',
  origin: 'direct-manipulation',
  undoable: true
}, transaction => {
  transaction.perform(operation);
});
```

Required guarantees:

1. Validate operations before application where possible.
2. Join nested operations into the active transaction.
3. Notify observers only after commit.
4. Reverse already-applied operations when an exception occurs.
5. Make committed change sets immutable.
6. Prevent replay from creating another history entry.
7. Include transaction ID, origin, and replay direction in notifications.

Keep `setProperty`, `addMethodCallChangeDoing`, `withMetaDo`, `undoStart`, and `undoStop` as compatibility facades while callers migrate.

### Phase 3: Fix property changes and metadata

Replace `ValueChange` internally with `SetMorphProperty`.

Required behavior:

- capture the actual previous and resulting values;
- restore operation metadata during replay;
- distinguish value semantics from reference semantics;
- provide property-specific snapshot hooks for mutable values;
- prevent in-place mutations from being presented as reliably reversible property changes.

Fix `withMetaDo` as an early, isolated correction:

- remove the `return` from `finally` so synchronous errors propagate;
- define it as synchronous and reject promise-returning callbacks;
- perform prompts and other asynchronous preparation before opening a mutation transaction;
- use an explicit transaction handle rather than an ambient metadata stack for asynchronous workflows.

This avoids unsafe metadata leakage or loss when asynchronous operations overlap.

### Phase 4: Replace structural method records

Refactor `addMorphAt` and `removeMorph` around one structural operation:

```js
MoveMorph({
  morphId,
  fromOwnerId,
  fromIndex,
  toOwnerId,
  toIndex,
  transformBefore,
  transformAfter
})
```

Define insertion as a move from no owner, removal as a move to no owner, sibling reordering as a move within one owner, and reparenting as a move between owners. Derive the inverse mechanically by swapping before and after state.

Nested implementation details must not be emitted as separate user-level changes. A reparent must be observed as one committed `MoveMorph`, not an intermediate removal followed by an addition.

### Phase 5: Generalize undo history

Make `UndoManager` store generic edit transactions:

```js
{
  label,
  apply(),
  reverseApply(),
  canMergeWith(other),
  merge(other)
}
```

It should support:

- morphic change-set entries;
- component command entries;
- text transactions;
- grouped mixed-domain transactions.

Undo and redo become transaction replay rather than new recording sessions. Existing grouping and debounce behavior can remain behind the generic interface.

## Part II: Introduce component semantics and projections

### Phase 6: Add origin-aware routing and the legacy bridge

Every committed transaction must identify its origin, for example:

```js
'user'
'component-command'
'runtime-projection'
'source-projection'
'undo'
'redo'
'layout'
'animation'
```

Runtime projection should use metadata such as:

```js
{
  origin: 'runtime-projection',
  reconcileChanges: false
}
```

This prevents projection feedback loops while allowing rendering and ordinary morph observers to react.

Change component tracking to consume committed change sets rather than every nested `onChange` and `onSubmorphChange` notification. During migration, add a legacy adapter:

```text
Committed MorphicChangeSet -> Legacy component adapter -> ComponentCommand
```

Initial mappings:

- `SetMorphProperty` to `SetProperty` or `RenameNode`;
- insertion to `IntroduceNode`;
- removal to `RemoveNode` or `SuppressInheritedNode`;
- structural movement to `MoveNode`;
- restoration to `RestoreInheritedNode`.

The adapter may consult component provenance to disambiguate inherited operations. It is a compatibility boundary, not the final entry point: component-aware tools should ultimately issue component commands directly.

### Phase 7: Define the semantic component model

Create a normalized, runtime-independent document model. It must not contain morph references, `PolicyApplicator` instances, parent pointers, or reconciliation flags.

Conceptually:

```js
ComponentDocument {
  revision,
  componentId,
  moduleId,
  exportName,
  parentComponent,
  root,
  sourceMetadata
}

ComponentNode {
  id,
  name,
  origin,
  typeExpression,
  properties,
  children
}
```

Each effective child needs explicit provenance:

- locally defined;
- added to a derived component;
- inherited from another definition;
- inherited but suppressed;
- inherited with local overrides;
- inherited with a local ordering constraint.

Property entries should distinguish:

- no local override;
- explicit local value;
- explicit opaque source expression.

This avoids using property absence, runtime equality, or `_originalSpec` as indirect evidence of author intent.

#### Foundational decision: identity

Names must stop being the in-memory identity. They can remain source-level selectors for compatibility, but commands and reducers should use stable node IDs.

Before structural operations are implemented, decide how identity persists:

- Initially, IDs may be stable for the lifetime of a parsed document and preserved through reducer operations.
- Investigate persistent IDs for reliable identity across reparses, rename, and reparent operations.
- If persistent IDs would pollute component syntax, maintain a source-node identity map and define exactly when identity may reset.

### Phase 8: Introduce the component command protocol

Add validated command factories or classes:

```js
SetProperty({ nodeId, property, value })
ClearPropertyOverride({ nodeId, property })
RenameNode({ nodeId, name })
IntroduceNode({ parentId, node, beforeId })
MoveNode({ nodeId, parentId, beforeId })
RemoveNode({ nodeId })
SuppressInheritedNode({ nodeId })
RestoreInheritedNode({ nodeId, parentId, beforeId })
SetMaster({ nodeId, masterExpression })
EditText({ nodeId, operation })
```

Every command should contain:

- the target component and expected document revision;
- stable node IDs;
- semantic values or opaque expressions;
- enough information to construct an inverse command;
- optional preconditions such as the expected parent or previous value.

Direct-manipulation tools should emit commands before mutating the morph tree. For legacy callers that currently mutate first, add a temporary adapter that converts the existing change notification into a command.

### Phase 9: Build the pure component reducer

Implement a reducer with an interface such as:

```js
const result = reduceComponent(document, command);
```

The result should contain:

```js
{
  document,
  inverseCommand,
  semanticDelta,
  diagnostics
}
```

Reducer invariants include:

- IDs are unique.
- Sibling names satisfy component naming rules.
- A node has exactly one parent.
- Ordering references point to existing siblings.
- An inherited node is either present or suppressed.
- Overrides only target known nodes and properties.
- Local and inherited provenance cannot be partially combined.
- Cyclic reparenting is impossible.

The reducer must not:

- access live morphs;
- parse or modify JavaScript;
- mutate policies;
- update editors;
- load modules.

The bulk of reconciliation semantics should live at this layer.

### Phase 10: Parse source into the document model

Create a source adapter around the existing AST helpers in `lively.ide/components/helpers.js`.

It should understand:

- ordinary morph specifications;
- `part(...)`;
- `add(...)`;
- `without(...)`;
- nested overrides;
- ordering anchors;
- component inheritance;
- aliased imports;
- master policies;
- opaque property expressions.

Keep source-node metadata separate from semantics:

```js
SourceMetadata {
  nodeIdToAstLocation,
  propertyLocations,
  formattingHints,
  importBindings,
  originalExpressions
}
```

Parsing should produce diagnostics for dynamic structures it cannot safely represent. During migration, those definitions can remain on the legacy reconciler.

Required round-trip invariant:

```text
parse(source) -> document -> projectSource(document) -> parse(result)
```

The two parsed documents must be semantically equivalent.

### Phase 11: Add the source projector

The source projector compares the previous and next documents and emits structural source edits. It must not know about morph change events.

Responsibilities:

- preserve unchanged expressions and formatting;
- create or remove `add`, `part`, and `without` constructs;
- update ordering selectors;
- manage imports and aliases;
- update descendant definitions affected by rename;
- validate all generated modules by reparsing them.

During the transition, proven patch helpers were reused from the old reconciler and moved behind semantic operations:

```js
sourceProjector.renameNode(before, after)
sourceProjector.moveNode(before, after)
```

The projector must never infer whether a node is inherited. That information comes from the document.

### Phase 12: Add the runtime projector

Convert a `ComponentDocument` into a prepared `MorphicChangeSet` that updates:

- style policies;
- cached component instances;
- derived active edit sessions.

Apply the change set through the repaired morphic change engine with `origin: 'runtime-projection'`. Start with a coarse projection, such as reapplying a policy or recreating the affected subtree, and optimize incrementally. Correctness takes priority over preserving targeted runtime mutations from the legacy reconciler.

The runtime projector may own compatibility markers temporarily, but the reducer must not depend on:

- `__wasAddedToDerived__`;
- `previouslyRemovedMorphs`;
- cached source expressions;
- removed-morph history.

Component undo should use inverse commands or document snapshots. The corresponding morphic change set is an application and rollback mechanism, not the authoritative component undo representation.

### Phase 13: Add cross-domain transaction coordination

A component command transaction should:

1. Verify the expected document revision.
2. Reduce the command into a candidate document.
3. Resolve affected derived documents.
4. Generate all source plans.
5. Parse and validate every resulting module.
6. Prepare the runtime projection as a morphic change set.
7. Commit source, document revisions, and the morphic change set as one edit transaction.
8. Roll everything back if any commit step fails.

If source planning fails, the live morph must not change. If runtime projection fails, source, documents, and runtime state must all be restored. This extends the existing source-only transaction planning around `planReconciliationChanges` to cover semantic documents and runtime state.

### Phase 14: Migrate component vertical slices

Migrate behavior by command family:

1. Scalar property set and clear.
2. Text changes.
3. Master changes.
4. Rename.
5. Local node introduction and removal.
6. Reordering.
7. Reparenting.
8. Inherited suppression and restoration.
9. Nested parts and structural overrides.
10. Propagation across derived components and modules.

For each family:

1. Translate existing events into commands.
2. Run the new planner in shadow mode.
3. Compare its projected result with the legacy result.
4. Cut over behind a feature flag.
5. Retain fallback for unsupported syntax.
6. Remove the corresponding legacy class after sustained test coverage.

Do not migrate structural operations until document identity and provenance are reliable and the morphic `MoveMorph` operation has passed its foundation gate.

### Phase 15: Add layered model-based fuzzing

Use two related fuzzers.

#### Morphic change-engine fuzzer

Generate property changes, insertions, removals, reorderings, reparentings, nested transactions, replay, and failures during application.

Check that:

- applying an operation followed by its inverse restores the exact tree;
- owner, child-index, and identity invariants hold;
- replay does not grow history;
- failed transactions restore state;
- notification ordering is deterministic;
- metadata and origin survive replay.

#### Component projection fuzzer

Evolve the current reconciliation fuzzer to generate semantic component commands rather than raw morph mutations.

After every step, compare:

- the reducer document;
- projected source parsed back into a document;
- the runtime policy;
- the instantiated morph tree.

Add metamorphic properties:

- a command followed by its inverse restores the original document;
- parsing after source projection is semantically equivalent;
- projection is idempotent;
- equivalent command sequences converge;
- failed commands leave all state unchanged;
- source and runtime projections agree after every step.

Also compare the runtime projector's morphic change-set inverse with the semantic inverse command. Keep the existing mutation-driven reconciliation fuzzer temporarily as an end-to-end compatibility test for the legacy adapter.

## Suggested code organization

```text
lively.morphic/changes/
  operations.js
  change-set.js
  transaction.js
  manager.js

lively.morphic/changes.js       # compatibility facade during migration
lively.morphic/undo.js          # generic EditTransaction journal

lively.ide/components/reconciliation/
  commands.js
  component-document.js
  reducer.js
  invariants.js
  source-adapter.js
  source-projector.js
  runtime-projector.js
  transaction.js
  morphic-change-set-adapter.js
```

`lively.morphic/changes.js` remains the generic Morphic event facade. The legacy
`lively.ide/components/reconciliation.js` reconciler was deleted after the
projectional cutover; unrelated component creation and removal commands now live
in `lively.ide/components/component-definition.js`.

## Initial implementation sequence

### Pull request 1: Change-manager characterization

- Add tests for property replay, metadata, error propagation, reorder, reparent, remove, nested changes, and listener ordering.
- Mark known-broken expectations explicitly.
- Do not change production behavior except to expose deterministic diagnostics where required by the tests.

### Pull request 2: Morphic transaction kernel

- Add immutable operations, morphic change sets, transaction IDs, origins, rollback, and replay mode behind the existing facade.
- Fix synchronous exception propagation and define synchronous metadata scope behavior.
- Move scalar properties onto `SetMorphProperty`.

### Pull request 3: Structural operations and undo journal

- Add exact `MoveMorph` semantics for insertion, removal, reorder, and reparent.
- Move `UndoManager` to generic edit transactions.
- Retain compatibility methods for existing callers.

### Pull request 4: Component transaction bridge

- Change component observation to consume committed change sets.
- Add origin-aware feedback suppression.
- Translate morphic operations into component commands in shadow mode.

### Pull request 5: Component architecture scaffolding

- Add component commands, `ComponentDocument`, validation, and the pure reducer interface.
- Parse simple component and property structures.
- Do not change production component reconciliation behavior.

### Pull request 6: Shadow-mode property projection

- Translate scalar property transactions into `SetProperty` and `ClearPropertyOverride` commands.
- Reduce against the parsed document.
- Generate projected source and a runtime morphic change set without applying them.
- Compare projected semantics with legacy output.

### Pull request 7: Property cutover

- Apply source and runtime projections for scalar property commands as one edit transaction.
- Keep a feature-flagged legacy fallback.
- Add inverse-command undo and cross-domain rollback tests.

### Subsequent pull requests

- Move command families through shadow mode and cutover in the order listed in Phase 14.
- Treat identity, rename, and structural movement as explicit milestone reviews rather than routine extensions.

## Completion criteria

The migration is complete when:

- committed morphic change sets are immutable, reversible, and atomic;
- reorder, reparent, insertion, and removal use exact structural operations;
- undo and redo replay transactions without creating new history;
- metadata, origin, errors, and rollback behave deterministically;
- component tracking consumes committed change sets rather than nested mutation effects;
- every supported direct manipulation starts as a semantic command;
- the reducer contains no runtime or source-editing dependencies;
- source and runtime are produced from the same component document;
- runtime projections are applied through morphic change sets;
- rename, move, remove, and restore do not depend on mutation history;
- `__wasAddedToDerived__` and removed-expression caches are unnecessary for correctness;
- both model-based fuzzers can run long sequences without divergence;
- source edits and direct manipulation can alternate without losing identity or overrides;
- legacy `MethodCallChange` inverses are no longer used for component correctness;
- the legacy reconciliation subclasses can be deleted.

The first practical milestone is the morphic foundation gate: scalar property changes, reorder, reparent, remove, undo, and redo all work deterministically through the new transaction engine. The first component milestone follows with `ComponentDocument`, the command protocol, and a shadow-mode `SetProperty` vertical slice.
