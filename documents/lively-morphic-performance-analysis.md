# lively.morphic performance improvements

Implemented on `lively-morphic-performance-analysis`, rebased onto `main` at `d62a66be8`. The original measurement baseline was Bun commit `b84a98f05`; the three relevant morphic files are identical in the merged commit. All six optimizations from the original analysis are implemented using existing Lively traversal, layout, rendering, and test APIs. These target CPU traversal, layout, and scheduling; GPU layer promotion, CSS filters, and native animation behavior are unchanged. No dependencies were added.

## Changes

| Optimization | Result and preserved behavior |
| --- | --- |
| Snapshot children during layout traversal | [applyLayoutIfNeeded ()](../lively.morphic/morph.js#L2558) reads `submorphs` once after container layout. A container with C children previously copied its C-element list 2C + 1 times. The snapshot includes container layout additions and visits each captured child even if sibling callbacks reorder the hierarchy. Text's public getter remains in use. |
| Linear renderer queue construction | [renderStep ()](../lively.morphic/rendering/renderer.js#L132) appends dirty/measurement entries, then reverses both lists once. Styling and measurement retain reverse preorder; structural removal-before-addition ordering and animation order remain unchanged. |
| Single renderer collection array | Existing `tree.prewalk` collects the current tree in preorder without building and copying a result array at every ancestor. The public mapped `withAllSubmorphsDo` API remains unchanged. Both traversals remain recursive. |
| Batch queued grid measurements | Each eligible grid synchronizes once per measurement pass, with a fresh Set for the second pass. Every queued morph still receives its intervening styling revisit. Other layout types retain per-morph measurement, direct grid calls remain independent, and nested grids keep their existing synchronization path. |
| Stop settled render bursts | [renderLater ()](../lively.morphic/rendering/renderer.js#L111) schedules a tail frame only while render work remains. The existing retry cap and frame-request coalescing remain; requests made during a render retain their budget. Errors still get bounded retries. |
| Reuse tiling sibling metadata | [addSubmorphCSS (morph, style)](../lively.morphic/layout.js#L958) builds sibling/index maps once per layout and styling pass. All-submorph z-index stays separate from layoutable order, with custom ordering, filtering, visibility, and the first occurrence of duplicate morphs preserved. |

The renderer returns pending work by inspecting the **current** tree after rendering, including children added after initial collection. Its predicate includes rendering, structural, CSS measurement, animation, text fitting, master styling, and applicable JavaScript layout flags. CSS layouts' persistent apply-request flags and document Text's persistent remeasurement flag do not prolong an otherwise settled burst.

Tiling metadata exists only during `renderStep`. Existing layout change callbacks invalidate it, the renderer resets it before measurement-driven restyling, and `finally` discards it even on errors. Calls outside a render pass recompute order, avoiding a persistent cache contract.

## Hardware GPU frame-rate comparison

The implemented changes show **no improvement in the native GPU animation scenarios**. The earlier synthetic CPU timings do not establish a GPU rendering improvement.

Measured on 2026-10-03 with an NVIDIA GeForce RTX 2080 Ti, driver 580.95.05, Chrome 124.0.6367.91, ANGLE/OpenGL, at 1280 × 900 with device scale 1. GPU compositing and GPU rasterization are enabled and asserted; SwiftShader and software renderers are rejected. Each version/trial uses a fresh Chrome process, with baseline/optimized order alternating across three trials. Each scene warms up for 1.5 seconds and samples for six seconds. There is no CPU throttling. Graphics clocks are 300 MHz in the plain-layer and panning samples, and 1200 MHz in the blur samples, for both versions.

These are **hardware-backed headless compositor FPS**, not a physical monitor measurement or JavaScript requestAnimationFrame cadence. FPS counts `Display::FrameDisplayed` events between explicit trace markers. Independently deduplicated renderer `PipelineReporter` presentation reports must agree within five frames. Baseline requests substitute the exact three modified files from `b84a98f05`; runtime assertions verify all four relevant optimized methods are absent/present in the corresponding version.

| Scenario | Baseline FPS, median (range) | Optimized FPS, median (range) | GPU utilization, baseline → optimized |
| --- | ---: | ---: | ---: |
| 1,000 GPU-promoted morphs, native translation/rotation | 58.8 (58.2–59.0) | 58.5 (58.2–59.6) | 11.0% → 11.2% |
| 300 GPU-promoted morphs, opacity and 8px blur, native translation/rotation | 27.0 (26.3–27.5) | 26.5 (26.0–26.5) | 43.4% → 41.3% |
| Pan a GPU-promoted container with 5,000 morphs through model changes | 7.1 (7.1–7.1) | 12.6 (12.5–12.6) | 1.4% → 2.5% |

The native scenes use existing `renderOnGPU` and `Morph.animate` capabilities. Chrome confirms 1,000/300 active transform animation layers and identical content-layer counts of 1,021/321 in both versions. Both native scenes record **zero Lively render steps and zero raster tasks** during all samples. Their content stays cached while Chrome performs the animations. Median FPS changes are −0.6% and −1.8%; the small differences do not demonstrate a benefit. The blurred scene still drops many frames in both versions, making the graphics/compositor path a useful target for further investigation.

Panning improves approximately **78%**, while the mean Lively render-step time falls from 77.4ms to 7.6ms. This is a CPU update improvement feeding a GPU-promoted container; it does not establish reduced GPU execution cost. GPU utilization rises as more updated frames reach the compositor.

NVIDIA utilization samples are taken every 500ms and describe the shared device, including any other applications. They are not per-application execution timings. This Chrome build emits no completed device timer-query intervals during these steady native compositor samples. GPU-process CPU task durations must not be interpreted as hardware GPU execution time; [Chromium's GPU tracer distinguishes service traces from device timer queries](https://chromium.googlesource.com/experimental/chromium/src/+/HEAD/gpu/command_buffer/service/gpu_tracer.cc).

The fixture uses a fresh DOM environment/iframe and the normal empty-world bootstrap UI. Bootstrap stepping and Lively rendering are suspended, while its visible footer retains 12 native opacity animations. This adds the same background layers in both versions. All 18 samples complete, independent presentation-count checks pass, and there are no assertion failures. Each browser records two bootstrap/metadata 404 console messages separately from benchmark results.

Reproduce with a local source server on port 9013:

```bash
./start-server.sh 9013
# In another terminal:
node scripts/bench-lively-morphic-fps.cjs d62a66be8 http://localhost:9013 3 6000
```

Use Node 24.20.0 and the matching Bun dependencies/assets. The script uses the installed `lively.headless` Puppeteer and existing Chrome; it adds no dependencies. `DISPLAY`/`XAUTHORITY` can override the local defaults (`:1` and `/run/user/1000/gdm/Xauthority`). The GPU launch flags select ANGLE GL/X11, ignore the browser GPU blocklist, and enable GPU rasterization identically in both versions. The benchmark closes its browser processes; stop the source server when finished. Set `PUPPETEER_CACHE_DIR` when reusing an existing Chrome cache.

The runnable [GPU benchmark](../scripts/bench-lively-morphic-fps.cjs) writes raw results to `/tmp/lively-morphic-gpu-results.json` and traces to `/tmp/lively-morphic-gpu-results-traces`. The optional fifth argument changes the output location. Raw local traces are not committed. Each trace opens in Chrome DevTools/Perfetto. JavaScript syntax, ESLint with the repository's documentation-only rule disabled, and `git diff --check` pass. The final parser is checked against all 18 recorded traces.

## Reproduce the CPU checks

```bash
node scripts/bench-lively-morphic-analysis.mjs
```

Use the branch's supported Node 24.20.0. The optional first argument selects a different Git baseline; the default is the merged Bun commit `d62a66be8`. The benchmark extracts the baseline methods with `git show` and compares them to the worktree implementation using Node's built-in timing/assertion APIs and existing `lively.lang` helpers.

CPU timings were recorded on 2026-10-03 on Linux x64, Node v24.20.0: three warmup calls, then the median of seven batches of three calls. The count and ordering assertions also pass after the rebase onto `main`.

| Synthetic scenario | Baseline ms/call | Implemented ms/call |
| --- | ---: | ---: |
| layout 1000 children | 0.794 | 0.027 |
| layout 5000 children | 18.924 | 0.073 |
| layout 10000 children | 58.568 | 0.030 |
| traversal chain 100 nodes | 0.024 | 0.015 |
| traversal chain 1000 nodes | 1.111 | 0.063 |
| renderer control 1000 dirty and measured morphs | 0.352 | 0.273 |
| renderer control 5000 dirty and measured morphs | 3.046 | 1.149 |
| renderer control 10000 dirty and measured morphs | 10.984 | 1.692 |
| grid 100 measured morphs/cells | 0.161 | 0.077 |
| grid 1000 measured morphs/cells | 7.307 | 0.373 |
| tiling CSS 100 siblings (precomputed layoutable list) | 0.055 | 0.060 |
| tiling CSS 1000 siblings (precomputed layoutable list) | 1.496 | 0.312 |

Deterministic checks establish:

- A dirty parent with 10,000 children takes **1 child-list snapshot**, previously 20,001.
- A grid with 1,000 queued measurements and 1,000 cells performs **2,000 cell updates** across two passes, previously 2,000,000.
- Tiling CSS for 1,000 siblings obtains **2 lists**, previously 2,000, in the fixture with a precomputed layoutable list.
- A coalesced, already settled default render burst takes **1 step**, previously 11.
- Styling, measurements, removals, CSS layout changes, and animations produce identical synthetic callback traces.

These timings omit DOM, painting, real layout callbacks, signals, and text measurement. The tiling benchmark also omits layoutable-list filtering/sorting and resize-policy scans. Small scenes can pay more cache setup overhead; these numbers describe the isolated paths and are **not frame-rate predictions**.

## Regression validation

The existing full browser suite covers rendering, CSS/JavaScript layouts, components, text fitting and rendering, embedded morphs, serialization, scrolling, reparenting, and animation behavior. The focused [performance regressions](../lively.morphic/tests/performance-test.js) additionally cover hierarchy mutation during layout, ordering, grid batching, render convergence and budgets, late rendering flags, cache invalidation, and cleanup after errors. A real DOM scene checks that moving a plain morph settles in one frame and that nested CSS grids retain model/DOM geometry after resize.

Fresh browser validation after the rebase onto `main` (`d62a66be8`) on 2026-10-04 (local source tests, not packaged desktop or CI tests):

| Check | Passed | Failed | Skipped |
| --- | ---: | ---: | ---: |
| Full `lively.morphic` browser suite, including 13 new regressions | 529 | 0 | 4 |
| `lively.components` browser suite | 22 | 0 | 0 |
| `lively.halos` browser suite | 33 | 0 | 0 |

All 13 performance regressions pass in the fresh full-suite run; the earlier focused run also passes independently. The CPU benchmark's order/count assertions, JavaScript syntax checks, and `git diff --check` pass. ESLint passes on the four changed/new JavaScript files with the repository's documentation-only requirement disabled (`jsdoc/require-jsdoc: off`); it reports no diagnostics.

Fresh post-rebase results are in `/tmp/lively-morphic-main-browser-results/`, with the run log at `/tmp/lively-morphic-main-browser-check.log`; CPU benchmark output is `/tmp/lively-morphic-main-cpu-benchmark.json`. These are local artifacts, not committed files. The GPU measurements above retain their 2026-10-03 provenance; the full GPU timing experiment was not rerun for the rebase.

Tests initialize the primary pointer through normal Puppeteer mouse movement, then run through the existing browser TestRunner against the source server on port 9013 with `fastLoad=false&noModuleCache=true`; requests to the original port 9011 are blocked. Dependency installation uses Bun 1.4.2 with the frozen lockfile and local cache. Generated import maps, browser assets, and installed dependencies are ignored runtime artifacts.

A control against unmodified `main` confirms that the seven simulated text-mouse tests require an initialized pointer hand: they fail in an untouched headless world and pass after normal mouse movement. This is test setup; no event-dispatch implementation was changed.

The morphic suite emits four background `promise.js` timeout diagnostics, matching those recorded by the Bun branch's previous validation. Browser fallback/metadata requests also produce 404 diagnostics. These are recorded separately from assertions; this report does not claim an error-free console.

## Further profiling

For GPU rendering, start with the blurred native-motion scene: investigate effect render passes, layer memory, and overdraw while preserving visual output. Reuse the existing `renderOnGPU`, native animation, and property-to-DOM mapping paths. The hardware comparison establishes a baseline for this work; the six implemented CPU optimizations leave that graphics workload unchanged.

For real end-to-end timing, capture browser main-thread time, allocations/GC, render-step count, and layout events while resizing wide containers, restyling component trees, and resizing populated grids containing text. Repeat with reparenting, hide/show, animation, and long editable Text with embedded morphs to check visual output and scrolling.

The initial analysis also noted full `document.lines` flattening during some text invalidations. That remains a separate profiling lead; existing line/range caches and virtualization should be reused if it becomes a measured bottleneck.
