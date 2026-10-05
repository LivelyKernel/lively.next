# Embedded NW.js backend verification

The backend can run in NW.js's Node context with the merged Bun dependency layout. A separate Node backend process is unnecessary. Enabling Node-context ESM and passing the resolver flag through the app manifest resolves the bootstrap hurdle:

```json
{
  "node-main": "--experimental-import-meta-resolve desktop/start-server.cjs",
  "chromium-args": "--enable-features=NWESM --disable-raf-throttling --remote-debugging-port=9222"
}
```

`NODE_OPTIONS=--experimental-import-meta-resolve` did not enable parent-aware resolution in these NW.js probes. The documented `node-main` argument syntax did. The backend also needs an explicitly configured Node SystemJS environment; NW.js otherwise presents browser globals that influence loader detection.

## Results

Verified on Linux on 2026-10-05, against merged main `318685694` plus the resource/backend changes:

| Runtime | Embedded Node | Without `NWESM` | With both settings |
| --- | --- | --- | --- |
| Packaged NW.js 0.111.1 live build | 25.9.0 | Fatal Blink bootstrap crash | Persistent ObjectDB workflow passes |
| Official NW.js 0.117.0 | 26.7.0 | Same fatal Blink bootstrap crash | Persistent ObjectDB workflow passes |

The latest release was downloaded from the official distribution and verified against its published SHA-256 checksum. Updating NW.js alone does not fix the unflagged bootstrap crash. Node-context ESM has been available behind `NWESM` since 0.98.2.

The runnable check initializes the merged backend loader in the actual NW.js runtime, checks initialization deduplication, registers the native ObjectDB resource, commits a JSON snapshot, verifies argument isolation and missing-object behavior, awaits database closure, relaunches NW.js, and reads the snapshot back. It uses runtime and database paths containing spaces. Every opened database must use LevelDB; the test rejects attempts to open a TCP listener. Requests after shutdown must reject.

```sh
DISPLAY=:91 node lively.app/scripts/test-native-backend.mjs /path/to/nw
```

Use an NW.js executable without an adjacent application manifest, so it loads the test application. Supply the display available on the machine; the example uses an Xvfb display. Each run creates and removes its own application profile and persistent data.

The probe exposed three Lively compatibility issues, addressed in the implementation: parser dependencies suppressed by legacy Node `@empty` mappings, runtime decisions cached across different loaders, and filesystem URLs treated as undecoded paths. ObjectDB creation also now awaits its metadata write, and database closure returns its completion promise.

## Desktop integration

`LIVELY_DESKTOP_MODE=native` selects the embedded backend. HTTP remains the default, and `LIVELY_DESKTOP_MODE=http` explicitly selects rollback. Both modes use the same writable runtime root, ObjectDB directories and snapshots. Native initialization errors reject requests and appear in the interface and boot log; they never select memory storage or start an HTTP fallback automatically.

```sh
LIVELY_DESKTOP_MODE=native /path/to/bundle/launch.sh
```

The dashboard and loading screen load from packaged files. `inject-start.js` checks the real paths of these two entry pages before exposing the bridge. HTTP pages receive no native bridge. Native dispatch uses an ObjectDB operation whitelist and JSON value isolation. The frontend SystemJS loader retains browser semantics; backend modules have a separate Node SystemJS loader. Registry and file reads initialize the module runtime; persistent storage loads only when an ObjectDB operation needs it. Shell services also initialize on first use. Explicitly remote ObjectDB, evaluation and collaboration connections retain their network transports.

The saved HTTP origin in `local-endpoint.json`, plus the canonical desktop aliases at port 9011, identify legacy desktop-local connections. Other origins and ports remain remote. Constructor names and stored ObjectDB server URLs remain compatible. Image morphs resolve saved desktop-local HTTP asset URLs to packaged files in native mode. Newly saved images in both desktop modes use the existing serializer expression format relative to `System.baseURL`, so the same snapshots load their images after an HTTP port change, relaunch or HTTP/native switch. The packaged HTTP smoke check reserves the original port during relaunch to exercise this case.

### HTTP dependency inventory

| Existing dependency | Native desktop path |
| --- | --- |
| Dashboard/world/project HTTP routes | Packaged entry pages plus route query parameters; browser history and desktop navigation use the same helper. |
| ObjectDB `fetch` calls | `lively.resources` read/post operations; the native storage resource calls the existing `ObjectDBInterface`. |
| WebDAV source reads, writes and binary files | Existing backend filesystem resource, registered before bootstrap and retained when editing reloads default extensions. |
| Registry, import maps, source hashes, compressed sources | Virtual file resources reuse existing registry, import-map and hash generators and the packaged library snapshot. |
| SystemJS XHR for frozen scripts | Browser script loading for frozen chunks; a scoped filesystem loader for the CommonJS class runtime. |
| SWC WebAssembly `fetch` | Binary filesystem resource for local native assets; existing fetch/streaming path for browser deployments. |
| Backend `/eval` | Existing evaluation strategy calls the embedded backend for the selected local endpoint. |
| Local Socket.IO shell transport | Native L2L client reuses existing command services and streamed callbacks. |
| Askpass/editor command helpers | Authenticated Unix socket (mode 0600) or Windows named pipe; no TCP listener. |
| Project install/build commands | Existing Bun installer and generated build scripts through the native shell. Ordinary build/tool subprocesses remain available. |
| World-load telemetry | Skipped for the native desktop origin. |
| Explicit remote services | Existing HTTP/Socket.IO connections; no interception of arbitrary HTTP URLs. |

Chromium continues loading scripts, CSS, images and fonts itself. Native resource registration does not simulate HTTP or replace global fetch. The global Chromium file-access flag is unnecessary.

### Validation

The actual Linux package has been exercised with spaces in both its installation and data paths. The smoke harness covers dashboard listings, legacy project migration, dependency installation, component browsing, frozen module revival, repeated source saves, client/backend evaluation, module environment boundaries, world/image save/reopen/relaunch, legacy desktop-local image URLs, project creation/save/relaunch and generated project builds. Separate browser checks load packaged images, fonts, styles and workers directly from files. Native smoke mode rejects Node TCP listeners and detects renderer HTTP/WebSocket requests to the selected local backend. Clean native window closure must exit successfully before relaunch.

The standalone NW.js probe also checks stdout/stderr streaming, stdin, cancellation, exit status and an askpass callback through the authenticated local IPC endpoint. It verifies that registry-only startup and shutdown leave storage unloaded, and that databases opened through backend evaluation are closed even without an ObjectDB request. The bridge check rejects remote pages, untrusted files and nonlocal endpoint URLs.

```sh
node --experimental-import-meta-resolve mocha-es6/bin/mocha-es6.js \
  'lively.storage/tests/*-test.js' lively.resources/tests/resource-test.js lively.lang/tests/events-test.js
node --experimental-import-meta-resolve lively.modules/tests/native-system-live-test.mjs
node lively.freezer/tests/package-resolution-test.cjs
node lively.app/scripts/test-build-layout.mjs
DISPLAY=:91 node lively.app/scripts/test-native-backend.mjs /path/to/standalone/nw
DISPLAY=:91 node lively.app/scripts/smoke-desktop-bundle.mjs \
  --bundleDir=/path/to/bundle --platform=linux --mode=native
```

For an HTTP rollback check, pass the native run's printed data directory to the same harness with `--mode=http --dataDir=/path/to/data --checkSavedWorld=true`. The normal browser boot check also runs successfully with external HTTP blocked.

The storage/resource/events run passes 114 checks. SWC tests also execute both frozen and live transforms to verify that resource registrations survive re-execution and direct eval retains its lexical loader. This exposed and fixed self-initializers clearing recorder state and captured eval calls losing their local scope. The shared module evaluator also binds its loader explicitly, since async compilation can rename lexical variables; the shared Rust suites pass 180 transform checks and 15 browser compiler checks. Existing shell/evaluation and command-helper tests pass. Two focused browser serialization checks also pass, including native and HTTP desktop image URLs reopening against the current runtime base while remote image URLs remain unchanged. All 51 affected browser checks pass, including cloned-loader edits, definition callbacks, import updates, virtual modules and native ObjectDB dispatch. The Linux build workflow now runs native packaged smoke coverage and HTTP rollback on the native run's saved data alongside its HTTP checks. Chromium's existing DevTools endpoint remains available for debugging; application backend services do not use it.

The generated project build checks also exposed assumptions that only hold in a source checkout: CommonJS conversion of mounted Lively workspaces, class instrumentation resolving its generated runtime dependency from the project, and project CSS/assets being located beside the installed core packages. The freezer now uses the application source root for its ESM exclusion, resolves its own generated class runtime, and collects project assets from the transformed modules' actual project roots. The project bundle regression mounts workspaces separately and loads project CSS from a temporary runtime path containing spaces.

### Startup measurements and release gates

Use `--startupOnly=true` to measure launch to visible dashboard, backend readiness and usable new world without preceding editor/project work. World readiness requires the studio UI to be initialized and the world visible. Backend readiness comes from its boot-log timestamp; native storage initializes separately on first ObjectDB use. Each invocation starts a fresh process and then relaunches with the same profile, data and caches. Full workflow smoke timings include intervening editing and must not be used as world startup measurements. The harness also records the longest dashboard animation-frame interval while services initialize; boot logs identify runtime-root preparation, package registry, persistent storage and backend readiness separately.

The default-mode gate is at least 25% lower median dashboard time, no more than 10% regression in usable-world time, acceptable responsiveness during backend initialization, and matching persistence/workflow checks on Linux, macOS and Windows.

Linux x64 results on 2026-10-05, in seconds: median (minimum–maximum), three samples per row. HTTP and native measurements use the same SDK package built at `440f281d3` (based on `318685694`), before the subsequent saved-image compatibility fix, with the CI freezer configuration, NW.js 0.111.1, Bun 1.4.2 and identical seeded project contents. HTTP uses packaged Node 24.20.0; native uses NW.js's embedded Node 25.9.0. The separately packaged Bun-merge reference `d62a66be8` was measured earlier and is retained for context; acceptance comparisons use the current HTTP/native pair. Runs are serialized with mode order alternated. Fresh rows use empty profiles/data/cache directories; relaunch rows reuse those directories. The OS file cache is warm. These are Xvfb measurements on a shared development host with concurrent work, not release hardware.

| Package/mode | Profile/cache | Visible dashboard | Backend ready | Usable world | Longest dashboard frame |
| --- | --- | --- | --- | --- | --- |
| Bun merge / HTTP reference | Fresh | 19.37 (18.18–23.53) | 16.90 (15.84–20.70) | 30.36 (29.13–40.75) | 0.95 (0.90–1.23) |
| Bun merge / HTTP reference | Relaunch | 7.20 (6.55–9.50) | 4.69 (4.60–5.63) | 17.02 (15.23–21.65) | 1.40 (0.78–2.38) |
| Current / HTTP | Fresh | 19.24 (19.07–20.07) | 16.91 (16.90–17.87) | 30.34 (29.97–30.70) | 0.93 (0.92–0.98) |
| Current / HTTP | Relaunch | 7.16 (6.80–7.40) | 4.64 (4.59–4.66) | 16.48 (15.44–17.91) | 1.40 (0.90–1.63) |
| Current / native | Fresh | 4.19 (3.54–4.44) | 17.50 (17.39–18.20) | 25.32 (25.20–26.79) | 2.23 (2.17–2.93) |
| Current / native | Relaunch | 4.24 (4.15–4.45) | 6.43 (6.24–6.82) | 14.18 (13.57–14.23) | 2.40 (2.30–2.58) |

Against HTTP in the same package, median dashboard visibility improves by 78.2% fresh and 40.8% on relaunch; usable-world time improves by 16.6% and 14.0%. Backend initialization itself remains substantial. On relaunch, median boot-log times from Node-main entry are 0.39 seconds for runtime-root preparation, 2.64 seconds for registry readiness and 6.10 seconds for the complete module runtime. Initial package/module loading and later storage initialization remain the dominant work. Registry-only checks open no databases.

The timing thresholds pass for visibility and world readiness in this sample. The responsiveness gate remains open: two-second animation-frame gaps mean an early visible dashboard cannot be described as continuously interactive throughout initialization. Further isolation or reduction of synchronous module work needs validation before enabling native mode by default.

HTTP remains the default until the remaining platform and responsiveness gates pass. macOS and Windows packages have not been executed in this Linux environment. Browser storage moves from the HTTP origin to file pages in native mode: existing browser-local preferences and login selections are not migrated, while worlds and project files remain in the shared persistent backend. Validate that identity transition before changing the default.

## Upstream references

- [NW.js 0.98.2: Node-context ESM feature flags](https://nwjs.io/blog/v0.98.2/)
- [NW.js manifest: Node command-line arguments in `node-main`](https://docs.nwjs.io/References/Manifest%20Format/#node-main)
- [NW.js 0.117.0 release](https://nwjs.io/blog/v0.117.0/)
- [Node: the experimental parent argument to `import.meta.resolve`](https://nodejs.org/api/esm.html#importmetaresolvespecifier)
