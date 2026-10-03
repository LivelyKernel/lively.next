# lively.context [![Build Status](https://travis-ci.org/LivelyKernel/lively.context.svg)](https://travis-ci.org/LivelyKernel/lively.context)

Rewriting JavaScript code to introduce first-class contexts and tools to manipulate those contexts (at runtime)

## Debugger architecture

`run()` rewrites a selected function, records local scopes, the current AST node,
and computed expression results, and unwinds through `UnwindException` at a
rewritten `debugger` statement. `Continuation` reconstructs those frames and
resumes through the existing interpreter. The Lively world keeps running.

The rewriter already supplies locals, arguments, the receiver, execution position,
and intermediate results. A separately created function can retain **external
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
4. Click **Edit source**. Change `var amount = this.step;` to
   `var amount = Number(this.step);` in the Object Editor and save. Wait until the
   save finishes, then click **Increment** again. The existing object uses the new
   method; proceed to reach `2`.
5. While suspended, change `this.step` to `2`. **Restart Frame** reuses the captured
   AST and reinitializes its locals. Proceed and inspect the result. A saved method
   replacement affects the next invocation; restarting an existing frame currently
   keeps that frame's captured AST. This is a limitation to reproduce, not a claim
   that arbitrary edited source can already replace an active frame.
6. Add `decrement() { this.count -= 1; this.updateCount(); }` in the Object Editor.
   Evaluate `this.decrement()` in the suspended debugger workspace. Continue
   changing methods and state on the same counter, without recreating it.
7. Set `this.pause = false` when finished. Quit, relaunch, reopen the project via the
   dashboard, and check saved source. Runtime objects require a world save to persist.

Record the action, selected statement, expected count, actual count, and status error.
The debugger source pane displays captured source; the Object Editor saves methods.

## NW.js retained-environment experiment

Build with `LIVELY_APP_FUNCTION_SCOPES=1 FLAVOR=sdk` and launch with
`LIVELY_APP_FUNCTION_SCOPES=1`. This opt-in build adds NW.js's documented
`--nw-node-inspector` startup flag. The background Node context exposes:

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

NW.js inspector ownership remains an integration issue: without its startup flag,
Runtime posts stalled; combining the Node inspector with concurrent DevTools traffic
reproduced a renderer SIGSEGV. Isolated Runtime-only inspection succeeded. Do not
attach a second inspector during this experiment. This does not establish that the
debugger needs an external process. The experimental flag changes NW.js's DOM
inspector/console behavior, so ordinary builds keep it off while this bug is investigated.

Primary implementation and runtime guidance:
[V8 function scopes](https://github.com/v8/v8/blob/main/src/inspector/v8-debugger.cc),
[NW.js inspector option](https://docs.nwjs.io/References/Command%20Line%20Options/#--nw-node-inspector).
