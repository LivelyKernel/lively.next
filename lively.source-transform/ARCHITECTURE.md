# JavaScript / Rust transform correspondence

Lively maintains handwritten, inspectable JavaScript transforms and native SWC
transforms with the same semantic responsibilities. Changes belong in the
corresponding pass on each side and in a shared parity fixture. Parsing, AST
construction, binding analysis and traversal use each frontend's existing APIs;
there is no generated implementation or intermediate object representation.

## Entry points and passes

`babel/plugin.js` owns Babel integration and evaluation setup. `capturing.js`
preserves the ESTree public API by reexporting its passes. The native plugin and
browser host both use `lively-swc-transforms/src/lib.rs`; the browser additionally
lowers ESM to System.register and applies the shared SystemJS pass afterward.

Rust paths below are relative to
`lively.freezer/swc-plugin/lively-swc-transforms/src/`.

| Responsibility | JavaScript implementation | Rust implementation |
| --- | --- | --- |
| Class conversion and super operations | `lively.classes/class-to-function-transform.js` (Babel and ESTree visitors) | `transforms/class_transform.rs` |
| Component descriptor wrapping | `babel/transforms/component.js` | `transforms/component.rs` |
| Export declaration preprocessing | `babel/transforms/export-split.js`; ESTree splitting in `transforms/export-split.js` | `transforms/export_split.rs` |
| Resurrection namespace imports and exports | `babel/transforms/namespace.js` | `transforms/namespace.rs` |
| Static System.import conversion | `babel/transforms/dynamic-import.js`, reused by freezer | `transforms/dynamic_import.rs` |
| Recorder declarations, references, patterns and function captures | `babel/transforms/scope-capturing.js` and `babel/helpers.js`; ESTree `transforms/scope-capturing.js` and `transforms/helpers.js` | `transforms/scope_capturing.rs` |
| Import/export bindings during scope capture | `babel/transforms/exported-import-capture.js`; ESTree scope pass | scope pass import/export helpers |
| Supplemental freezer export captures after scope rewriting | `transforms/exported-import-capture.js` | `transforms/exported_import_capture.rs` |
| System.register setters, namespace interop, recorder hoisting and deferred exports | `babel/transforms/systemjs.js`; ESTree `transforms/systemjs.js` | `transforms/systemjs.rs`, shared by both native hosts |
| Binding resolution | Babel scopes; ESTree `lively.ast` queries | `utils/scope_analyzer.rs` |
| Source ranges | Parser offsets (UTF-16) | `utils/source_position.rs` using the host SourceMapper |

`babel/transforms/index.js` exports the named passes for direct inspection.
Existing imports from `babel/plugin.js` and `capturing.js` continue to work.
Class transforms stay in `lively.classes`, which owns their runtime contract.

## Routine correspondence

These are the boundaries to follow when changing behavior, rather than a
requirement to reproduce Babel's or SWC's visitor machinery in the other language.

| JavaScript routine | Rust routine |
| --- | --- |
| `classFieldsInitialization` | `class_fields_initialization` |
| `constructorTemplate` | `constructor_template` |
| `methodDescriptor` / `classMemberDescriptors` | `method_descriptor` / `class_member_descriptors` |
| `superclassSpec` / `replaceClass` | `superclass_spec` / `replace_class` |
| `replaceSuperMethodCall`, getter/setter and direct-call helpers | corresponding super rewrites in the class visitor |
| `shouldDeclBeCaptured` / reference filtering | `should_decl_be_captured` / `should_ref_be_captured` |
| `transformPattern`, array/object helpers | `transform_pattern`, `transform_array_pattern`, `transform_object_pattern` |
| `captureAssignmentPattern` | `capture_assignment_pattern` |
| `normalizeImportedNamespace` | `normalize_imported_namespace` |

Class member descriptors preserve source order and method debug names. Class
expressions preserve lexical `this`; superclass tracking follows actual bindings.
Pattern declarations retain excluded leaves locally. Pattern assignments keep
native destructuring semantics and RHS identity, replacing captured targets
in place; wrapped targets use a setter so defaults/rest keep their evaluation
order. Uninitialized declarations preserve only an existing own recorder value,
including falsy values.

## Ordering and integration

The native visitor orders export preprocessing, classes, components, namespace
rewriting, dynamic imports, existing System.register rewriting, scope capture,
then supplemental export capture. Namespace-generated bindings are excluded from
capture. SystemJS rewriting of SWC-generated registrations runs after module
lowering, with resolver contexts preserved.

The JS evaluation and freezer drivers assemble the passes for their respective
tasks. Their frontend ordering is not mechanically identical: Babel establishes
reference identities before replacing classes, while SWC resolves bindings on
its typed AST. Export preprocessing must precede capture, namespace imports must
be processed before synthesized reexport imports, and supplemental export capture
must follow scope rewriting. The whole-pipeline fixtures check interactions that
isolated pass tests cannot establish.

Dynamic import rewriting resolves string/number literals, literal templates,
parentheses and constant `+` expressions. Other expressions retain their
System.import call. Freezer uses this same static resolver instead of evaluating
source during transpilation.

## Shared behavioral tests

`tests/parity/*.json` defines source, native-style configuration and observations
once. `tests/parity-test.mjs` runs the production JS routines and the native
visitor through the Cargo `parity` example. Class/scope cases use Babel, ESTree
and Rust; supplemental export cases use ESTree and Rust; whole-pipeline cases
use `livelyPreTranspile` and the complete native visitor. SystemJS cases also
exercise both JS frontends. Rust browser tests cover the post-module adapter.

Fixtures assert runtime values, wrappers, metadata and live updates. Simple
module rewrites additionally compare parsed ASTs, ignoring locations and print
formatting. Temporary names, meaningful identifiers and semantics are not
normalized away. Every emitted result must parse. Fixtures are ordinary trusted
test code; their `setup` and `evaluate` fields execute in a fresh function scope.

From the repository root, after the normal frozen Bun install:

```sh
bun run --cwd lively.source-transform test:node
bun run --cwd lively.source-transform test:parity
cargo test --locked --manifest-path lively.freezer/swc-plugin/Cargo.toml --workspace
```

Select suites with `node lively.source-transform/tests/parity-test.mjs classes
scope` and enable progress with `PARITY_TRACE=1`. This suite is a maintained
behavioral contract, not a proof of equivalence for every JavaScript program.
Add regressions to the shared fixtures when extending either implementation.
