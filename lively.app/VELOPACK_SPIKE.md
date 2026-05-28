# Velopack Spike

## Current Verdict

Velopack looks viable for the NW.js desktop bundle, but the integration should
be staged. The JavaScript SDK can load in an NW.js node-main process, and the
packaging model matches what we need: versioned installers/update packages,
static update feeds, GitHub release uploads, and delta updates.

The main blockers are not SDK compatibility. They are release layout, version
policy, mutable app data, and CI packaging.

## What Was Validated

- Official Velopack docs describe it as a cross-platform installer/update
  framework for Windows, macOS, and Linux.
- The JavaScript SDK is distributed as the `velopack` npm package. Current npm
  metadata showed `0.0.1589-ga2c5a97`.
- The initial implementation pins `velopack@0.0.1444-gc245055`, because that is
  the newest version found in both npm and the NuGet `vpk` CLI feed during the
  spike. The newer npm-only package would leave CI without a matching CLI.
- The SDK contains native `.node` addons for Linux, macOS, and Windows.
- A plain Node smoke test can `require("velopack")` and see both
  `VelopackApp` and `UpdateManager`.
- An NW.js smoke test with the local NW.js SDK `0.110.1` can also load the
  native SDK from the NW node-main context.
- Constructing `UpdateManager` outside a Velopack-installed app fails with the
  expected "application is not properly installed" error. That means the next
  validation step must use a real Velopack package/install layout.
- Linux packaging was validated locally after installing .NET 8.0.420 and
  `vpk 0.0.1444-gc245055`. `vpk pack` accepts the current Linux bundle with
  `--mainExe nw` and produces an AppImage plus release-feed files.
- After adding the per-user runtime root, the direct bundled server smoke
  reaches `Server ready` and stays running until the test timeout reaps it.
- The Linux AppImage smoke was validated with
  `APPIMAGE_EXTRACT_AND_RUN=1`, because this host does not provide FUSE for
  normal AppImage mounting. The packaged app reaches `Server ready`, loads the
  dashboard, and connects the renderer through L2L.

Useful upstream references:

- https://docs.velopack.io/
- https://docs.velopack.io/getting-started/javascript
- https://docs.velopack.io/packaging/overview
- https://docs.velopack.io/reference/js/Class.UpdateManager
- https://docs.velopack.io/reference/cli/content/vpk-linux

## Current Bundle Shape

The existing GitHub workflow builds raw archives:

- Linux: `dist/lively.next-linux-x64.tar.gz`
- Windows: `dist/lively.next-win-x64.zip`
- macOS: `dist/lively.next-osx-arm64.tar.gz`

The current generated bundle sizes are large:

- Linux x64: about 2.1 GB locally
- macOS arm64: about 1.9 GB locally

Current app entry points:

- Linux: `launch.sh` executes `nw "$BUNDLE_DIR"`
- macOS: `lively.next.app`
- Windows: `lively.next.exe`

Velopack needs a stable `--mainExe` value for each packaged platform. The
Linux case needs the most care because Velopack produces an AppImage and
expects the entry executable name, not a shell launcher path.

## Packaging Requirements

Velopack packaging is a second step after the normal app build:

```bash
vpk pack \
  --packId next.lively.app \
  --packVersion 0.1.0-nightly.123 \
  --packDir dist/lively.next-<platform>-<arch> \
  --mainExe <platform-entrypoint> \
  --packTitle lively.next \
  --outputDir dist/velopack/<platform>-<arch>
```

The real command should be validated per platform. Based on the current layout,
the likely candidates are:

- Linux: needs validation; probably `nw` if we make NW run the bundled package
  directly, or a small native/Node launcher if Velopack cannot use `launch.sh`.
- macOS: likely `lively.next.app`.
- Windows: `lively.next.exe`.

The implementation currently wires these defaults:

- Linux: `--packDir dist/lively.next-linux-x64 --mainExe nw`
- macOS: `--packDir dist/lively.next-osx-arm64/lively.next.app --mainExe nwjs`
- Windows: not packaged on CI yet, because `vpk pack` is platform-native and
  the current Windows bundle is cross-built on Linux.

The validated Linux test output was:

- `next.lively.app-nightly-linux-x64.AppImage`
- `next.lively.app-0.1.0-test.38-nightly-linux-x64-full.nupkg`
- `releases.nightly-linux-x64.json`
- `assets.nightly-linux-x64.json`
- `RELEASES-nightly-linux-x64`

Velopack versions must be semver2. Four-part versions are not supported. For
nightly builds, use a deterministic semver such as:

```text
0.1.0-nightly.<github-run-number>+<short-sha>
```

The package id should stay stable. `next.lively.app` matches the current macOS
bundle identifier.

## Runtime Architecture

Velopack startup code should run as early as possible in the main process:

```js
const { VelopackApp } = require("velopack");
VelopackApp.build().run();
```

For this app, the practical insertion point is `lively.app/desktop/start-server.cjs`
because it runs as NW.js `node-main` before the Lively server process is
started. That keeps the native Velopack addon out of browser/world code and
lets update hooks exit quickly before UI/server startup.

Update checks should be exposed through the desktop native bridge, not the old
in-world git version checker:

- background menu item: `Check for Updates...`
- optional startup check with no blocking UI
- progress reporting while downloading
- restart/apply confirmation once the update is ready
- a clear "not installed by Velopack" state for local dev/raw archive builds

The API shape can mirror Velopack's JS guide:

- `getVersion()`
- `checkForUpdates()`
- `downloadUpdate(updateInfo, onProgress)`
- `applyUpdate(updateInfo)`

## CI Integration Plan

1. Keep the current raw archives while Velopack is introduced.
2. Add .NET setup to `.github/workflows/build-desktop-app.yml`.
3. Install or run the Velopack CLI at the same version as the JS package.
4. After `node lively.app/scripts/build.mjs`, run `vpk pack` for the matrix
   platform.
5. Upload Velopack output as a separate artifact first.
6. Once validated, publish Velopack release assets and the
   `releases.<channel>.json` feed to GitHub Releases or static hosting.

## Data Layout Risk

Mutable app data must stay out of the bundle directory. Velopack updates replace
the installed app payload, and Linux AppImage payloads are read-only at runtime.

The implementation now creates a per-user `runtime-root` for bundled desktop
launches. The server runs with that directory as its `System.baseURL` and DAV
root. Immutable packages are symlinked from the installed app payload, while
mutable top-level directories live directly in the runtime root.

Candidates for per-user writable state:

- macOS: `~/Library/Application Support/lively.next`
- Windows: `%APPDATA%/lively.next`
- Linux: `${XDG_DATA_HOME:-~/.local/share}/lively.next`

The current bundle contains directories such as:

- `app/esm_cache`
- `app/local_projects`
- `app/custom-npm-modules`
- `app/snapshots`

Those are redirected to the runtime root in bundled mode. `lively.morphic` also
uses a package overlay: most package files are symlinked to the installed app,
but `lively.morphic/objectdb` is kept writable in the runtime root.

Linux validation output after the runtime-root and AppImage smoke fixes:

- `next.lively.app-nightly-linux-x64.AppImage` at about 647 MB
- `next.lively.app-0.1.0-test.38-nightly-linux-x64-full.nupkg` at about 645 MB
- `releases.nightly-linux-x64.json`
- `assets.nightly-linux-x64.json`
- `RELEASES-nightly-linux-x64`

Smoke validation:

- direct bundled server entry: `Server ready, loading lively...`, then timeout
  exit `124` after the server stayed up
- AppImage with `APPIMAGE_EXTRACT_AND_RUN=1`: `Server ready, loading lively...`
  followed by an L2L renderer connection, then timeout exit `124`

## Recommended Phases

1. Move mutable desktop-app state into per-user data directories, while keeping
   local development behavior unchanged.
2. Add Velopack packaging in CI for one platform and keep raw archives.
3. Add startup hook handling in `desktop/start-server.cjs`.
4. Add a native update-check API and menu item that can report "not a Velopack
   install" cleanly.
5. Validate download/apply/restart from a local/static update feed.
6. Expand to all platforms, signing, notarization, and published GitHub release
   feeds.

## Open Questions

- What should the final Linux distribution policy be now that `--mainExe nw`
  works for the AppImage?
- Should Linux be distributed only as Velopack AppImage, or should the raw
  `.tar.gz` remain a supported portable build?
- Which channel names should we use: `nightly`, `stable`, platform-specific
  defaults, or both channel plus platform?
- Do we want update checks to be manual-only initially, or a quiet startup
  check with no automatic install?
- How do Velopack deltas behave with a 2 GB NW.js/lively.next payload in CI and
  over GitHub Releases?
- When do we introduce macOS signing/notarization and Windows Authenticode
  signing?
