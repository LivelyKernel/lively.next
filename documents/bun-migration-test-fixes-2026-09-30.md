# Test fixes after the Bun migration — 2026-09-30

Worktree: `/home/user/projects/lively.next-bun`; branch: `replace-flatn-with-bun`.
Toolchain: Node 24.20.0, Bun 1.4.2, Rust 1.95.0.

The canonical repository suite is green: **1,917 passed, 0 failed, 31 skipped** across all 28 packages in `scripts/test.sh`. This supersedes the failing [2026-09-24 run](bun-migration-full-suite-2026-09-24.md).

## Causes and fixes

- Browser package discovery had been replaced by a Node-only filesystem scan. Restore discovery through the existing resource/DAV API, including scoped packages and Bun store entries.
- Native ESM namespaces were wrapped as CommonJS defaults. Preserve real ESM default/named exports and load asynchronous ESM through native import; CommonJS keeps Node's importer-specific dependency context.
- The CLI combined native and instrumented copies of Lively's module/class runtime. Bootstrap tests through one instrumented graph and establish the expected Lively globals from that graph.
- Cloned SystemJS loaders lost tracing, breaking class/default-export updates and dependency records. Enable tracing when preparing each live loader. Preserve explicit maps and custom package directory entries. Fresh loaders now return an empty dependency map before their first import, and the search regression awaits unloading.
- Export inspection assumed an optional translation cache existed, preventing superclass discovery when caching was disabled. Fall back to source export inspection; object-class tests now explicitly disable caching.
- Node's Yoga entry was mapped to a browser CDN module. Use the installed package on Node and retain the locked browser URL in browsers. Prefer Node's native fetch in the resource loader.
- Each test file left Mocha process error listeners behind, causing the rejection-handler loop. Dispose the returned runner after each file. Ignore source files with no runnable Mocha suite and remove obsolete native preloads.
- Storage tests assumed directory order and a fixed concurrent replication event sequence. Assert directory members and the exact outgoing changes, while allowing the concurrent pull. The Rust failure was a stale expected transform string; production Rust code did not change.

The native live-loader fixture now covers synchronous/asynchronous ESM default and named exports, explicit absolute/relative maps, custom package entries, and live class edits in a cloned loader. Existing importer/peer identity and linked live-export checks remain enabled.

## Validation

| Check | Result |
| --- | --- |
| Canonical browser/TestRunner package list | 28 packages; 1,917 passed, 0 failed, 31 skipped |
| Node-compatible declared package test commands | 18 commands passed; no timeouts |
| Standalone migration/desktop checks | 11 passed |
| Rust `cargo test --workspace --locked --no-fail-fast` | 177 passed; 0 failed |
| `bun install --frozen-lockfile --ignore-scripts` | No changes |
| `git diff --check` | Passed |

The seven UI packages (`lively.morphic`, `lively.changesets`, `lively.halos`, `lively.components`, `lively.ide`, `lively.freezer`, `lively.collab`) passed through the canonical browser runner. Their earlier direct Node invocations lacked the browser world, DOM, or IndexedDB and are **not** counted as passing Node commands. No fake browser globals or undeclared jsdom dependency were added.

Bun lock SHA-256 remained `8b524577b6783367a2e6a85ea36946dd12581bd6dfa4457d0edcaee926280236`.

After the complete run, a restarted server and fresh Chrome profiles with `fastLoad=false&noModuleCache=true` rechecked modules (160), classes (72), server (10), and morphic (516): **758 passed, 0 failed, 5 skipped**. The final class/module runs include the optional-cache and empty-loader fixes. The class object-package regression disables translation caching explicitly. A final Node rerun of classes, modules, source-transform, and the native live-loader fixture also passed.

Browser diagnostics are separate from test results. The two unhandled module-unload errors are resolved; the final module/class rechecks have no page errors. Morphic still emits four background `promise.js` timeout messages, exactly matching the previous 2026-09-24 run, while all 516 assertions pass. Their cause has not been compared against the pre-migration branch. The language tests also deliberately trigger error events. These diagnostics are retained in the raw JSON rather than reported as a clean browser console.

The browser harness used `fastLoad=false`, honored `wantsServerInterface`, and blocked requests to the original server on port 9011. Tests ran against the isolated worktree server on port 9021. Raw harnesses, per-package results, CLI logs, Rust output, and frozen-install output are in `/tmp/lively-fixes-20260930/`.

## Canonical package results

| Package | Passed | Failed | Skipped |
| --- | ---: | ---: | ---: |
| lively.modules | 160 | 0 | 0 |
| lively.server | 10 | 0 | 0 |
| lively.lang | 269 | 0 | 4 |
| lively.resources | 49 | 0 | 2 |
| lively.bindings | 53 | 0 | 13 |
| lively.notifications | 7 | 0 | 0 |
| lively.classes | 72 | 0 | 1 |
| lively.serializer2 | 50 | 0 | 0 |
| lively.storage | 73 | 0 | 0 |
| lively.ast | 134 | 0 | 0 |
| lively.source-transform | 222 | 0 | 0 |
| lively.vm | 52 | 0 | 4 |
| lively-system-interface | 1 | 0 | 0 |
| lively.graphics | 23 | 0 | 0 |
| lively.morphic | 516 | 0 | 4 |
| lively.components | 22 | 0 | 0 |
| lively.ide | 97 | 0 | 1 |
| lively.halos | 33 | 0 | 0 |
| lively.user | 0 | 0 | 0 |
| lively.2lively | 18 | 0 | 0 |
| lively.changesets | 13 | 0 | 1 |
| lively.git | 0 | 0 | 0 |
| lively.shell | 15 | 0 | 0 |
| lively.collab | 22 | 0 | 1 |
| lively.traits | 1 | 0 | 0 |
| lively.freezer | 2 | 0 | 0 |
| lively.headless | 3 | 0 | 0 |
| lively.keyboard | 0 | 0 | 0 |

These local checks do not complete the migration's remaining release gates: native macOS/Windows and NW.js GUI execution, worker-specific startup, and warm/cold GitHub jobs remain unverified. See the [migration plan](flatn-to-bun-migration.md).
