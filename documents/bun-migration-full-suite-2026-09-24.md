# Full repository test run — 2026-09-24

This historical failing run is superseded by the [2026-09-30 fixes and verification](bun-migration-test-fixes-2026-09-30.md).

Worktree: `/home/user/projects/lively.next-bun`; branch: `replace-flatn-with-bun`.
Toolchain: Node 24.20.0, Bun 1.4.2, Rust 1.95.0. Browser package list comes from `scripts/test.sh`; each package uses the same browser-driven TestRunner with `fastLoad=false`, on isolated port 9021. It respects `wantsServerInterface`, so server packages execute through the Node backend. Node runs use each declared package test command plus standalone checks. Rust command: `cargo test --workspace --locked --no-fail-fast`.

**Result: not green.** All 28 canonical package suites were run: **1,910 passed, 7 failed, 31 skipped**. All 25 direct CLI package commands were attempted: **9 passed, 15 failed, 1 aborted** after a confirmed Mocha rejection-handler loop. All **11 standalone migration/desktop checks passed**. The Rust workspace completed with **176 passed and 1 failed**.

The seven canonical failures are six browser package-registry discovery/update/reload cases and the server Socket.IO test (`ioClient is not a function`). The registry discovery implementation currently requires Node's `_nodeRequire`, while these tests exercise it from the browser. CLI failures include missing `lively`/`document` globals, ESM/CommonJS pre-script incompatibilities, and assertion failures; they should not all be assumed to share one cause.

## Canonical repository TestRunner

| Package | Passed | Failed | Skipped | Load/run error |
|---|---:|---:|---:|---|
| lively.lang | 269 | 0 | 4 |  |
| lively.resources | 49 | 0 | 2 |  |
| lively.bindings | 53 | 0 | 13 |  |
| lively.notifications | 7 | 0 | 0 |  |
| lively.classes | 72 | 0 | 1 |  |
| lively.serializer2 | 50 | 0 | 0 |  |
| lively.storage | 73 | 0 | 0 |  |
| lively.ast | 134 | 0 | 0 |  |
| lively.source-transform | 222 | 0 | 0 |  |
| lively.vm | 52 | 0 | 4 |  |
| lively.modules | 154 | 6 | 0 |  |
| lively-system-interface | 1 | 0 | 0 |  |
| lively.graphics | 23 | 0 | 0 |  |
| lively.morphic | 516 | 0 | 4 |  |
| lively.components | 22 | 0 | 0 |  |
| lively.ide | 97 | 0 | 1 |  |
| lively.halos | 33 | 0 | 0 |  |
| lively.user | 0 | 0 | 0 |  |
| lively.2lively | 18 | 0 | 0 |  |
| lively.changesets | 13 | 0 | 1 |  |
| lively.git | 0 | 0 | 0 |  |
| lively.server | 9 | 1 | 0 |  |
| lively.shell | 15 | 0 | 0 |  |
| lively.collab | 22 | 0 | 1 |  |
| lively.traits | 1 | 0 | 0 |  |
| lively.freezer | 2 | 0 | 0 |  |
| lively.headless | 3 | 0 | 0 |  |
| lively.keyboard | 0 | 0 | 0 |  |

Canonical totals: 1910 passed, 7 failed, 31 skipped; 0 package load/run errors.

## Canonical runner failures

- **lively.modules** — package registry lookup from packageBaseDirs: expected null to contain subset { …(3) }
- **lively.modules** — package registry lookup find dependency of package: Target cannot be null or undefined.
- **lively.modules** — package registry lookup ignores invalid package versions when choosing latest: Cannot read properties of undefined (reading 'latest')
- **lively.modules** — package registry lookup resolve path: expected null to equal 'http://localhost:9021/lively.modules/…'
- **lively.modules** — package registry update of package in packageBaseDirs: Cannot read properties of undefined (reading 'updateConfig')
- **lively.modules** — package registry reload of package in packageCollectionDir: Cannot read properties of null (reading 'url')
- **lively.server** — lively.server has socket.io server: ioClient is not a function

## Node commands

| Suite/check | Exit | Timed out |
|---|---:|---|
| lively.lang | 2 |  |
| lively.bindings | 1 |  |
| lively.ast | 0 |  |
| lively.source-transform | 0 |  |
| lively.classes | 1 |  |
| lively.vm | 0 |  |
| lively.resources | 0 |  |
| lively.storage | 1 |  |
| lively.notifications | 0 |  |
| lively.modules | -15 |  |
| lively-system-interface | 0 |  |
| lively.serializer2 | 3 |  |
| lively.graphics | 0 |  |
| lively.morphic | 1 |  |
| lively.changesets | 1 |  |
| lively.shell | 1 |  |
| lively.server | 1 |  |
| lively.2lively | 1 |  |
| lively.halos | 1 |  |
| lively.components | 1 |  |
| lively.ide | 1 |  |
| lively.traits | 0 |  |
| lively.headless | 0 |  |
| lively.freezer | 1 |  |
| lively.collab | 1 |  |
| lively.freezer_tests_dynamic-system-import-test.mjs | 0 |  |
| lively.freezer_tests_project-bundle-test.mjs | 0 |  |
| lively.installer_tests_runtime-roots-test.mjs | 0 |  |
| lively.modules_tests_native-resolver-test.mjs | 0 |  |
| lively.modules_tests_native-system-live-test.mjs | 0 |  |
| lively.project_tests_package-install-test.mjs | 0 |  |
| lively.server_tests_browser-import-map-cache-test.mjs | 0 |  |
| lively.freezer_tests_minify-test.cjs | 0 |  |
| lively.freezer_tests_package-resolution-test.cjs | 0 |  |
| lively.app_scripts_test-build-layout.mjs | 0 |  |
| lively.app_scripts_test-windows-dependency-layout.mjs | 0 |  |

## Node failure details

- **lively.lang**: closure captures values -- error: AssertionError: expected NaN to equal 5; fun "before all" hook in "fun" -- error: ReferenceError: lively is not defined
- **lively.bindings**: converter source and target are bound when eval in toplevel context -- error: AssertionError: expected 3 to equal undefined
- **lively.classes**: ReferenceError: lively is not defined
- **lively.storage**: replication sync conflict -- error: AssertionError: expected [ { direction: 'push', …(4) }, …(2) ] to have the same members as [ { …(5) }, { id: 'world/foo', …(2) } ]
- **lively.modules**: Aborted after several minutes without progress; debugger stack confirms recursive Mocha Runner.unhandled / process.emit handlers. See modules-stall-stack.json.
- **lively.serializer2**: marshalling serialized expressions bindings via object import -- error: ReferenceError: lively is not defined; expression serializer deserialize evals expression with bindings -- error: ReferenceError: lively is not defined; expression serializer deserialize evals expression with alias bindings -- error: ReferenceError: lively is not defined
- **lively.morphic**: ReferenceError: lively is not defined
- **lively.changesets**: ReferenceError: document is not defined
- **lively.shell**: ReferenceError: require is not defined in ES module scope, you can use import instead
- **lively.server**: ReferenceError: require is not defined in ES module scope, you can use import instead
- **lively.2lively**: `ERR_REQUIRE_ASYNC_MODULE`: its pre-script uses `require()` on the lively.server ESM graph with top-level await.
- **lively.halos**: TypeError: fetch failed
- **lively.components**: ReferenceError: lively is not defined
- **lively.ide**: ReferenceError: lively is not defined
- **lively.freezer**: ReferenceError: lively is not defined
- **lively.collab**: TypeError: component.for is not a function

## Rust

176 passed, 1 failed: `tests::test_declaration_wrapper_uses_computed_member`. Its assertion expects a four-argument wrapper call; output includes additional source-position metadata. Rust source/manifests were not changed by the migration. No baseline comparison has been performed.

Detailed JSON results and per-command logs are in `/tmp/lively-full-suite-20260924/`. A nonzero Node exit may include a test bootstrap/load failure rather than a completed assertion run. Canonical runner and Node CLI counts overlap and must not be added as unique tests.

## Follow-up of the aborted module command

Fresh-process checks of the unfinished files completed: `search-test.js` reported 9 passing and 2 failures (including a failing before-each hook); `virtual-modules-test.js` passed 2/2. The search errors resolve a package directory to `file1.js`, then attempt to open `file1.js/index.js`. The original aggregate module command remains recorded as aborted; these checks do not turn it into a pass.

No production fixes or test-assertion changes were made for this run. Native Windows/macOS and NW.js GUI checks were not executed. The canonical test harness blocked requests to the user's original port 9011; none were attempted, so that isolation did not cause the recorded failures. The initially interrupted profile-switch attempt was discarded and the affected packages were rerun to completion; only completed results appear above.

The `lively.classes` CLI elapsed time in the raw log includes a deliberate pause of the driver while canonical tests used the same checkout. It is not the test's active duration.
