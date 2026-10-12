# lively.context [![Build Status](https://travis-ci.org/LivelyKernel/lively.context.svg)](https://travis-ci.org/LivelyKernel/lively.context)

Rewriting JavaScript code to introduce first-class contexts and tools to manipulate those contexts (at runtime)

## Debugger architecture

`run()` rewrites a selected function, records local scopes, the current AST node,
and computed expression results, and unwinds through `UnwindException` at a
rewritten `debugger` statement. `Continuation` reconstructs those frames and
resumes through the existing interpreter. The Lively world keeps running.

The rewriter already supplies locals, arguments, the receiver, execution position,
and intermediate results, including the conditional decisions needed to resume
inside a branch without reevaluating its condition. A separately created function can retain **external
closure bindings** that source recreation cannot recover. Supply those values in
`run(fn, registry, args, mapping)`. The mapping is now retained in reconstructed
scopes; `mapping.this` supplies the receiver. Nested rewritten functions continue
to use the existing closure/frame-state chain.

The NW.js experiment reads requested bindings through a function's `[[Scopes]]`
using only `Runtime` inspector commands. Objects retain identity. Primitive bindings
are captured values: assigning to either the returned map or V8's synthetic scope
representation does **not** update the original lexical binding. Assigning an
object's fields does affect the original object. Edits to recorded continuation
locals affect interpreter resume.

The external exception-pause service is disabled by default. It remains an explicit
legacy diagnostic (`LIVELY_APP_INSPECTOR_SERVICE=1`); it is unnecessary for retained
function environments. Arbitrary locals in unrewritten native callers are outside
this experiment. There is no replacement continuation or stepping engine.

## Live tutorial: evolve the same counter

Build the SDK desktop app on this branch. Open a local project through the dashboard,
open a JavaScript workspace, and evaluate:

```js
const { openLiveCounter } = await System.import('lively.ide/js/debugger/examples/live-counter.js');
openLiveCounter();
```

1. Click **Increment**. Its debug entry point calls the existing `run()` with the
   actual counter as receiver. The rewritten `debugger` statement suspends that
   computation and opens Lively Debugger. Move a window while it is suspended.
2. Evaluate `this.count`, `amount`, and `typeof amount` in the debugger workspace.
   Expect `0`, `'1'`, and `'string'`. The string step is an intentional bug.
3. Evaluate `amount = Number(amount)`, **Step Over**, then **Proceed**. Expect `1`.
   The repaired local belongs to the existing continuation's recorded scope.
   Step Over stops before the next statement without changing the count.
4. Click **Edit source**. Change `var amount = this.step;` to
   `var amount = Number(this.step);` in the Object Editor and save. Wait until the
   save finishes, then click **Increment** again. The existing object uses the new
   method; proceed to reach `2`.
5. While suspended, replace the saved increment with `Number(this.step) * 2`.
   **Restart Frame** resolves the current saved method on the same receiver and
   stops at its first statement. The source pane now shows the replacement method.
   Proceed to the rewritten debugger statement, inspect `amount`, then proceed
   again. Restart reexecutes earlier statements; it does not migrate an arbitrary
   old execution position into edited code.
6. Add `decrement() { this.count -= 1; this.updateCount(); }` in the Object Editor.
   Evaluate `this.decrement()` in the suspended debugger workspace. Continue
   changing methods and state on the same counter, without recreating it.
7. Set `this.pause = false` when finished. Quit, relaunch, reopen the project via the
   dashboard, and check saved source. Runtime objects require a world save to persist.

Record the action, selected statement, expected count, actual count, and status error.
The debugger source pane displays captured source; the Object Editor saves methods.

The packaged NW.js 0.111.1 tutorial verified local repair, receiver identity,
numeric conversion saved onto the same object, and adding/calling `decrement()`
while suspended. Saved methods affect subsequent invocations. The separate retained
environment experiment recovered exactly `step` and `marker`, preserved the marker's
identity, kept a renderer timer running during suspension, and resumed to `3` after
repairing `amount`. These results use the original continuation machinery.

The interpreter accepts the `let` and `const` declarations produced by the Object
Editor using the rewriter's existing function scope. Full block scope, temporal dead
zones, and const-write enforcement remain outside this legacy declaration model.
Restart preserves captured outer bindings and original arguments; introducing new
retained bindings still requires supplying their values in the mapping.

## NW.js retained-environment experiment

Build with `FLAVOR=sdk` and launch with `LIVELY_APP_FUNCTION_SCOPES=1`.
The background Node context uses NW.js's existing browser inspector transport and exposes:

```js
const values = await livelyDesktop.debugger.captureFunctionBindings(fn, ['step', 'marker']);
const { run } = await System.import('lively.context/lib/stackReification.js');
const continuation = run(fn, null, [], values);
```

The reader does not enable `Debugger`, set breakpoints, pause on exceptions, or use
call-frame handles. It disconnects after reading the requested retained bindings.
Run `node lively.app/tests/function-scopes-test.cjs` for the reader's native check.
`lively.app/tests/nw-function-scopes.cjs` runs the same integration in an actual
packaged renderer, using `lively.ast.query.findGlobalVarRefs` to identify the exact
missing bindings and the original `Continuation` to resume.

The original direct `node:inspector` experiment stalled without NW.js's startup
flag and reproduced a renderer SIGSEGV when combined with DOM inspector traffic.
The renderer bridge now uses Runtime commands through the existing CDP client,
leaves the DOM inspector enabled, and requires no special Node inspector flag.
Concurrent reader requests and a normal DevTools evaluation verified identity and
continuation resume in NW.js 0.111.1. The ordinary Node reader still uses
`node:inspector` for its native check. No external controller or native stack capture
is involved; the crash was an integration bug in attaching competing inspector backends.

Primary implementation and runtime guidance:
[V8 function scopes](https://github.com/v8/v8/blob/main/src/inspector/v8-debugger.cc),
[NW.js inspector option](https://docs.nwjs.io/References/Command%20Line%20Options/#--nw-node-inspector).
