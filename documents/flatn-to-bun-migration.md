**Implementation plan: replace flatn with Bun**

Status: implemented on `replace-flatn-with-bun`; targeted Linux acceptance passed, but the full repository run on 2026-09-24 found failures. The migration is not ready to merge; see [the full-suite report](bun-migration-full-suite-2026-09-24.md). Native platform CI gates remain open. The sequence below records the approved design and its acceptance gates. Prepared on 2026-09-23 against the installer, module loader, freezer, and desktop packaging. The immediate browser-condition fix is tracked separately in [PR #1812](https://github.com/LivelyKernel/lively.next/pull/1812).

The goal is to remove flatn completely while preserving Lively's ability to locate, browse, instrument, and reload the exact module used by an importer. Bun will own installation and dependency locking. Node will continue to execute the server; Lively's SystemJS layer will continue to provide live programming. Replacing Node or SystemJS is not necessary to remove flatn and is outside this migration.

**Target behavior and decisions**

- Keep the current first-party package directories. Add a private root workspace manifest, an explicit isolated-linker configuration, and a committed `bun.lock`. Use `workspace:*` for dependencies between core workspace packages. Declare dependencies where they are used, rather than aggregating them into a synthetic root dependency list. Bun supports this layout through [workspaces](https://bun.com/docs/pm/workspaces).
- Pin the Bun version used by developers, CI, and release builds. Start validation with the versions from the diagnosed build, Bun 1.4.2 and Node 24.20.0; change them only as an explicit migration decision. Keep package installation under Bun and execution under Node. Do not use Bun runtime auto-install as a fallback.
- Preserve the installed graph, including distinct instances of the same package/version with different peer dependencies. Use package locations as instance identities; name/version remain display and search metadata. Bun's [isolated layout](https://bun.com/docs/pm/isolated-installs) supports Node through dependency links. Do not decode `.bun` directory names or flatten its store. Set `linker = "isolated"` explicitly; evaluate `hoist = false` in the initial proof, recognizing that root dependencies remain visible through ancestor lookup.
- Resolve ordinary package imports using the importer and the appropriate platform resolver. Preserve Lively-specific virtual modules, source transformations, and deliberate mappings, without reimplementing npm `exports`, `imports`, or semver selection.
- Keep JSPM for browser conversion during this migration, preserving hidden, dynamically generated import maps. Bun's lock does not govern JSPM's independent graph. Moving browser dependencies to locally transformed Bun-installed packages can be a later project; complete flatn removal must not depend on that larger conversion.
- Keep user projects separately installable with their own manifests and Bun locks. Core packages and registered sibling projects are explicit local links when used in the Lively environment. Opening an unrelated project must not rewrite the core lock or silently override every consumer of a package name. Preserve deliberate development replacement through a scoped link/override operation.

**Current responsibilities to replace**

| Responsibility | Current locations | Replacement |
| --- | --- | --- |
| Installation, gap filling, build scripts | `flatn/bun-install.js`, `flatn/index.js`, `flatn/build.js`, `lively.installer/install.js` | Bun workspaces and lifecycle scripts; retain only Lively-specific setup/build orchestration |
| Node CJS/ESM resolution | `flatn/resolver.cjs`, `flatn/resolver.mjs`, `flatn/bin/node` | Standard Node resolution over Bun's installed layout |
| Instrumented server imports | `lively.modules/src/system.js`, `lively.server/index.js` | Importer-aware native resolution supplied to Lively's loader |
| Package inventory and discovery | `lively.modules/src/packages/package-registry.js`, installer `setupSystem` | Installed package instances and actual dependency links; preserve registry introspection |
| Browser and freezer resolution | `lively.freezer/src/resolvers/node.cjs`, `lively.freezer/src/bundler.js`, `lively.server/plugins/lib-lookup.js` | Maintained browser-aware resolution and import-map handling |
| IDE installs and user projects | `lively.ide/js/browser/index.js`, `lively.project/project.js`, project build templates | Bun operations in the owning project, followed by registry/map refresh |
| Launch, tests, and shell tools | `install.sh`, `start-server.sh`, `scripts/`, `mocha-es6/`, `lively.shell/bin/` | Ordinary Node executables and local package binaries |
| Desktop installation and updates | `lively.app/scripts/build.mjs`, `lively.app/desktop/start-server.cjs`, `lively.app/desktop/updates.cjs` | Relocatable installed graph and standard resolution |

**1. Prove the resolution contract before changing the default installation**

Create a small test installation under a temporary directory with Bun workspaces. Exercise it using the supported Node version without flatn loaded. The fixture must include two incompatible versions of one dependency, two peer contexts for the same version, nested conditional exports, package `#imports`, scoped names, aliases, and a linked editable package. Include UUID-style Node/browser entry points from the build regression.

Prove this contract through Lively's loader as well as native Node:

```text
specifier + importing module + execution target + import/require mode
    -> canonical module URL, or a meaningful resolution error
```

For CommonJS, use `createRequire(importerURL).resolve(specifier)`. For ESM, prototype a small Node-side helper using `import.meta.resolve(specifier, importerURL)`. The explicit parent argument currently requires `--experimental-import-meta-resolve`; retain that standard Node flag consistently in launchers if this approach passes. The helper must run outside Node custom-loader hooks. Do not substitute CommonJS resolution for ESM resolution. These constraints follow the [Node API](https://nodejs.org/api/esm.html#importmetaresolvespecifier).

Pass that resolver into the existing System instance rather than introducing a package-manager abstraction or another loader hook. Check synchronous normalization, module format selection, and CJS/ESM interoperation. Keep Lively's relative-source conventions confined to Lively source loading. Validate that direct and linked imports of one editable module share identity and live updates, while intentionally distinct dependency instances remain distinct.

Exit gate: a runnable fixture demonstrates the contract and server-side live reload. Resolve any mismatch in synchronous loader integration or peer identity here, before bulk installer changes. If the native API cannot satisfy the actual loader calls, select and pin a maintained resolver based on this failing fixture rather than writing another export-condition parser.

**2. Establish the real workspace installation and bootstrap**

Add root `package.json`, `bunfig.toml`, and `bun.lock`. Derive the initial workspace list from `lively.installer/packages-config.json`, excluding flatn and generated/user directories. Retain non-install metadata such as `wantsServerInterface` in the existing configuration, but make the workspace manifest authoritative for package-manager membership. Avoid a broad glob that accidentally includes build outputs or user projects.

Audit core package manifests for undeclared direct dependencies that currently work through global lookup. Preserve legitimate incompatible ranges; do not select one aggregate version. Add actual build/test tools to their owning package or the root tooling dependencies. Avoid changing the root module type without auditing CommonJS scripts such as the eslint configuration.

Run Bun before importing `lively.installer`, since the installer itself imports workspace packages. Update `install.sh`, `install-with-node.js`, and `web-install.sh` to bootstrap through standard installed links. Remove the asset-cleanup action that currently removes the root `package.json`.

Replace flatn's dependency installation, retry fallback, gap filling, binary linking, and `BuildProcess`. Use Bun lifecycle support and explicitly account for packages requiring install scripts, including native dependencies and Git-sourced dependencies. Configure `trustedDependencies` from the actual build requirements; Bun's explicit list replaces its default list, so all required entries must be present. [Bun lifecycle documentation](https://bun.com/docs/pm/lifecycle)

Retain ordered Lively build steps for the class runtime, SWC plugin, assets, ObjectDB setup, and browser artifacts. Validate native modules under the Node executable that will load them. Treat NW.js and Puppeteer downloads as explicit platform assets with their existing version requirements; remove flatn-specific workarounds only after their replacements pass.

Exit gate: from an empty installation, Bun installs the workspace graph and required native dependencies; a second frozen install leaves the lock unchanged. Standard Node imports of the installer and its dependencies work without a flatn hook. The new path remains confined to the migration branch until subsequent phases make the whole application usable.

**3. Switch the server loader and package registry**

Wire the resolver proven in phase 1 into `lively.modules/src/system.js`, installer `setupSystem`, and server startup. Remove calls to flatn's import/export mapping helpers for standard packages. Preserve `@node/`, `@empty`, Lively mappings, instrumentation, and existing module loading behavior intentionally. A successful native resolution must not be interpreted a second time through the old package-map logic.

Change registry discovery to follow installed package links from core and registered project roots. Track visited real locations to handle cycles. Record package metadata and dependency relationships without using folder-name parsing or assuming `package.json` is an exported subpath. Browsing source/metadata is separate from importing a permitted package entry point.

Make the location-based registry able to retain multiple instances with the same name/version. Audit consumers of `packageMap[name].versions[version]`, including package browsing, project lists, rename/removal, dependency lookup, and serialization. Keep a convenient name/version search view, but use importer resolution to choose the actual dependency. Do not overwrite one peer instance with another.

Update registry seeds, caches, and `package-registry.json` serialization together. Invalidate on lock/manifest changes, link changes, registered project changes, and schema changes; preserve relative transport paths for packaged applications. Ensure paths containing spaces, URL escapes, and Windows drive letters round-trip correctly.

Exit gate: server startup, plugins, test runner, package inspection, and instrumented live updates work without `FLATN_*` or either flatn loader. The fixture and existing module/package tests pass, including distinct peer instances after a registry JSON round trip.

**4. Remove flatn from browser resolution and the freezer**

Replace `flatnResolve` in the freezer's Node resolver with a maintained target-aware resolver integrated into the existing Rollup pipeline. Evaluate `@rollup/plugin-node-resolve` first; configure browser resolution, import/require handling, and plugin ordering explicitly. Retain existing CommonJS/AMD conversion and intentional polyfills. Node's browser condition flag alone is insufficient because it does not remove Node conditions. See the [plugin's resolution options](https://github.com/rollup/plugins/tree/master/packages/node-resolve).

Remove `resolveViaImportMap` imports from flatn. Reuse a maintained import-map implementation already supplied by the installed tooling if compatible; otherwise select a small dedicated implementation. Verify scoped mappings, prefix mappings, and URL bases rather than copying flatn's partial helper into another package. Browser-side freezer operations must consume the same browser mappings; they cannot call a server filesystem resolver directly.

Preserve hidden, dynamically generated browser import maps in Git-ignored `.cachedImportMap.json` files. Reuse the existing JSPM generator and CDN fallback behavior. Generate missing caches during installation and serving, refresh them when dependency manifests change, and support explicit cache regeneration. These browser maps are cache artifacts, not committed locks; `bun.lock` governs the separately installed dependency graph. [JSPM generator documentation](https://jspm.org/docs/generator/)

Generated maps record selected URLs, not the availability or immutability of remote content. Materialize the browser module closure into the existing `esm_cache` for release/desktop artifacts; record and verify content hashes if claiming identical bytes across clean builds. Pinning URLs alone must not be reported as an offline or byte-for-byte guarantee. Include browser source maps and referenced assets needed by the application.

Replace hardcoded flat-layout assets in `lively.ide/worker-init.js`, `lively.ide/service-worker.js`, and `lively.freezer/src/util/bootstrap.js` with build-resolved asset URLs. Update `lib-lookup` and DAV exclusions. Existing saved content may contain old dependency URLs: measure that usage and provide narrowly scoped URL migration/aliases where needed, without reviving flatn resolution. New output must use the new paths.

Exit gate: loading screen, landing page, unified freezer, browser boot, workers, and a frozen user project pass from empty browser caches. The UUID regression selects the browser entry and no unintended `node:crypto` import reaches the browser. Packaged browser assets work without CDN access.

**5. Migrate project development and IDE package installation**

Replace the package browser's server-side `flatn.installPackage` operation with Bun invoked in the owning project directory. Persist dependency changes in that project's manifest and lock, then refresh its registry and browser map through the same update operations used by command-line development. Surface install failures; do not report success after silently skipping required builds. Use structured process arguments for user-supplied package specs.

Keep each `local_projects/<project>` independently lockable, with explicit local links for core/sibling packages used during live development. Prove the exact Bun link arrangement in the phase-1 fixture, including removal and relocation. Treat `lively.project`'s existing project dependency metadata as application metadata that must be reconciled with installed links; do not introduce a second npm version solver. Record the bound Lively revision separately from the external dependency lock.

For installing a package without an active project, use one explicit user-owned package root with its own manifest/lock and register it for inspection. It must not become an implicit global fallback for imports from unrelated projects. Migrate the contents of `custom-npm-modules` by recording their selected dependencies before reinstalling; preserve manually edited sources as local packages.

Update project creation, cloning/loading, build templates, and generated CI workflows. Adding/removing/linking a dependency must update the relevant registry and invalidate resolution caches. A declared development replacement must affect both native Node and instrumented loading consistently. Existing automatic global dev overrides should become explicit scoped operations, with a documented migration path.

Exit gate: create and clone a project, install two conflicting versions in separate projects, link a sibling project, edit/reload it, freeze the result, restart Lively, and reproduce each project's dependencies from its lock without changing the core lock.

**6. Migrate command-line tools and desktop distribution**

Update all launch/build/test commands: `start-server.sh`, `scripts/lively-next-env.sh`, `scripts/lively-next-flatn-env.sh`, `scripts/check-boot.sh`, `lively.classes/tools/`, `lively.freezer/tools/`, `lively.installer/build.sh`, `mocha-es6/bin/mocha-es6.js`, and `lively.shell/bin/`. Remove flatn PATH injection, environment variables, and loader flags. Remove the environment helper: discover workspace packages directly, put Node flags in entrypoints, and use Puppeteer configuration for its cache. Use installed local binaries and prevent commands from downloading missing tools implicitly. Audit direct flat-layout lookups such as `lively.ast/lib/acorn-extension.js` and the storage adapter build.

Update desktop build filters: `lively.app/scripts/build.mjs` currently excludes normal `node_modules` and copies `lively.next-node_modules`. Stage the required installed graph, workspace packages, and platform-native dependencies together. Preserve internal dependency links or materialize them in staging; never ship links pointing back to the developer checkout or global Bun cache. Start with a complete working closure before reintroducing size optimizations.

Remove flatn setup from desktop startup and updater resolution. Revisit `--preserve-symlinks` and `--preserve-symlinks-main` in the packaged launcher against the phase-1 identity contract. Update library snapshots, registry seeds, runtime cache keys, and platform asset installation. Bun should be needed for installation/development operations, not ordinary execution of an already packaged app. If desktop users can install packages, provision a pinned Bun executable for that operation explicitly.

Exit gate: supported Linux/macOS/Windows desktop builds launch after relocation, including paths with spaces. Test updater SDK loading, native modules, editable user projects, and offline startup. The application must work without the build checkout or its caches present.

**7. Make CI enforce reproducible installation**

Update daily, PR, and desktop workflows to pin the supported toolchain and run frozen installs. Require the committed lock to exist before invoking Bun; do not assume a frozen flag catches a missing file. Bun documents `bun install --frozen-lockfile` and its missing-lock behavior in the [install reference](https://bun.com/docs/pm/cli/install).

Key caches by OS/architecture, relevant native ABI, Bun version, lock contents, and install configuration. Prefer package download caches over reusing an unverified installed tree. Always perform the frozen install even on a cache hit. Move CI's ad hoc `npm install` tooling into declared, locked tooling dependencies or an explicitly separate locked tooling project.

Provide one warm-cache job and one genuinely fresh-cache job. The latter starts without `node_modules`, generated registry/module caches, or `esm_cache`, and uses private empty Bun and JSPM/XDG caches. `make clean` alone does not clear global JSPM metadata. Isolate this test from user data and shared caches.

Update `make clean` to remove generated installation/build state without deleting locks, local project sources, or user-owned package data. Dependency update commands remain distinct from reinstalling the committed graph. Pin or separately account for non-package inputs such as the Partsbin revision, downloaded browser/NW.js binaries, and the Rust toolchain; a Bun lock cannot make those inputs reproducible by itself.

Exit gate: warm and fresh jobs both install, build, and test successfully; neither changes a lock. A missing Bun lock or changed installed dependency manifest fails explicitly; missing browser maps are generated automatically. Browser generation retains the existing provider fallback; failed generation or caching must fail the install.

**8. Delete flatn and finish the transition**

Delete `flatn/`, its generated bundle, rebuild checks, dependency declarations in `lively.installer` and `mocha-es6`, and its entry in `packages-config.json`. Remove the aggregate Bun installer, package migration code, version-gap fallback, `.lv-npm-helper-info.json` handling, and obsolete flatn wrappers. Move the browser-condition regression to the replacement resolver coverage before removing the old test.

Search tracked code, manifests, generated scripts, CI, and docs for `flatn`, `FLATN_`, `flatn_package_dirs`, `lively.next-node_modules`, and the old collection layout. Remaining mentions must be historical documentation or explicitly bounded migration compatibility, never active resolution/install code. Update README/CONTRIBUTING, `.gitignore`, test instructions, build artifact checks, and project templates.

Provide an upgrade procedure: record custom dependencies/local edits, install from the new locks, regenerate caches and browser artifacts, verify startup, and then remove the old generated dependency tree. Do not erase edited dependency sources or projects as a side effect. Keep old persisted module URLs readable through the documented compatibility path where required.

Exit gate: delete or make the old flatn directory and dependency collection unavailable and rerun the supported install/start/build/test flows. No fallback may depend on either. The migration is complete only after this passes for server, browser, projects, and desktop.

**Delivery and rollback**

Use a dedicated migration branch based on main after the immediate build fix. Phase 1 can land independently. Keep phases 2–6 as reviewable commits/stacked PRs on that branch until the install-to-boot path is complete; do not switch main to a half-working package layout. CI work can be developed alongside those phases, with the deletion commit last. Do not ship a permanent dual package-manager mode.

Before cutover, retain a known-good release/commit and its generated assets for rollback. Roll back by switching to that release and reinstalling its graph, not by mixing flatn and Bun dependency trees. Preserve user project data across either direction.

The highest-risk gates are instrumented module identity, registry representation of peer instances, local project linking, and relocatable desktop packaging. The plan resolves those through small runnable checks before treating the migration as a broad mechanical replacement.

**Implementation notes (2026-09-23)**

The branch uses 32 explicit Bun workspaces, the isolated linker, Bun 1.4.2, and Node 24.20.0. Browser dependency maps are generated as hidden, untracked `.cachedImportMap.json` files; their module content is materialized into `esm_cache`. Partsbin has a pinned revision and seed lock; existing checkouts are left untouched. Mermaid is pinned to 10.9.5, the previously selected browser version, because newer JSPM output uses dynamic template-string imports that the generator does not trace.

The freezer uses `enhanced-resolve` because its resolution interface is synchronous outside Rollup hooks. Native server resolution uses Node's import/require APIs. Projects keep independent Bun locks and explicit local source links; the small linking step avoids Bun's globally registered `link:` protocol and preserves editable workspace identity.

Regression coverage includes conditional exports, importer-specific versions, peer-instance registry transport, canonical/symlink module identity, live re-exports, scoped browser maps, stale-lock rejection, cache-only existence checks, portable cache filenames, project freezing, and a separate writable desktop runtime root. Both daily and PR CI run the migration fixtures.

Local validation uses Linux. Native macOS/Windows execution and the NW.js GUI require their platform runners; a Node-side relocated desktop startup check does not replace those checks. GitHub workflows have been updated but have not been dispatched from this worktree.

**Local verification**

The pinned Linux toolchain passed the nine migration fixtures used by PR CI, package registry tests (35), live module change tests (17), capture transforms (108), Babel transforms (110), and ESM resource tests (6). A private empty-cache installation completed with unchanged locks and no untrusted lifecycle scripts. The unified browser build completed, and a fresh-profile world initialized with external HTTP blocked. The committed boot check now enforces this condition. A mixed-import regression covers both SWC and the legacy freezer pipeline.

The rebuilt browser TestRunner passed all 49 resource tests with external HTTP blocked. The final Linux desktop payload was moved to a path containing spaces and started with fresh data/cache directories. Its packaged Node, dependencies, and Chromium passed the committed offline boot check; a symlink containment audit and native SWC/updater loading also passed. No NW.js GUI session was exercised.

Worker-specific browser startup remains unverified: `config.ide.workerEnabled` is disabled by default, and forcing a reload after enabling it failed in recorder handling before worker creation (`defVar_…service-worker.js is not a function`). No worker source was changed for this check; the failure has not been compared against a baseline.

Native Windows/macOS execution, worker-specific browser checks, and warm/cold GitHub jobs remain required before release. Windows packaging now stages the target-native isolated dependency graph and browser on Windows, then restores recorded internal junctions on startup; native CI must validate the resulting archives and installer behavior.

**Test fixes and full-suite verification (2026-09-30)**

The canonical 28-package suite now passes: 1,917 passed, 0 failed, 31 skipped. The 18 Node-compatible package commands, all 11 standalone migration/desktop checks, and all 177 Rust tests also pass. The seven UI packages were verified in the canonical browser world rather than through direct Node commands. Shared fixes cover browser registry discovery, native ESM exports, importer mappings, live-loader tracing, and a single instrumented CLI runtime. Storage scheduling/order assertions and the stale Rust transform expectation were corrected. A frozen Bun install left the lock unchanged. Details and remaining platform gates are in the [test-fix report](bun-migration-test-fixes-2026-09-30.md).

**Final acceptance checklist**

- [x] Core and project installs have explicit locks and do not choose new versions during normal installation.
- [x] Native Node and instrumented server imports agree for the same importer/mode.
- [x] Conflicting versions and distinct peer contexts remain correctly isolated and inspectable.
- [x] Live editing preserves module identity through links, cache reloads, and restarts.
- [x] Browser mappings, assets, and freezer builds work with no flatn helpers.
- [ ] Worker-specific browser flows have been exercised.
- [ ] Required native dependencies build and load on supported platforms.
- [x] Project creation, cloning, dependency updates, local links, and freezing use Bun.
- [x] The Linux packaged server/browser payload relocates and boots offline without build-machine paths.
- [ ] Native macOS/Windows desktop artifacts and the NW.js GUI pass their platform gates.
- [ ] Warm and truly empty-cache CI runs pass with unchanged locks.
- [x] No runtime, installer, build, test, or updater requires flatn or its old directory layout.
