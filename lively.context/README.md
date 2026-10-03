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

### Smalltalk-style acceptance session

Continue on the **same counter object**. The **Lessons** button selects an executable
scenario. Reset the count between scenarios. While any computation is suspended,
move its window and evaluate a workspace expression in another window. Closing a
debugger abandons its continuation; it does not replay or undo completed effects.

| Experience | Lesson and action | Expected result |
| --- | --- | --- |
| Inspect receiver, arguments, objects and locals | Increment; evaluate `this`, `arguments`, `amount` and `this.count` | Receiver identity and live object fields are preserved; local repair affects resume. |
| Keep workspace temporaries | Evaluate `let scratch = amount * 2; scratch`, then `scratch += 1` | The existing Lively recorder preserves the workspace binding across evaluations. |
| Inspect callers without changing execution | `nestedLesson`; Step Over to the call, Step Into, select its caller and Proceed | The child runs once and its result reaches the caller; inspecting a frame never discards another frame. |
| Step Into, Over and Out | `nestedLesson`; enter `double`, inspect `value`, Step Over, Step Out | Enter ordinary saved methods, stop before the next statement, and return to the pending caller with its result. |
| Change locals and captured block state | `scopeLesson`; evaluate `amount = 4` and `read()` | `read()` returns 4, the outer `amount` remains 1, and the counter becomes 4. |
| Enforce constant bindings | `scopeLesson`; evaluate `receiver = {}` then `receiver.count = 5` | Rebinding fails with TypeError; mutating the referenced counter succeeds. |
| Respect declaration timing | Add `let later = 3` after a debugger statement and evaluate `later` before proceeding | Reading before initialization throws ReferenceError; proceeding initializes it normally. |
| Retain each loop iteration's block | `loopLesson`; inspect `i` and `reads[0]()` at the conditional stop | Values are 1 and 0. Proceed returns `[0, 1, 2]` and sets the count to 3. |
| Conditional stops | Change `if (i === 1) debugger` in the Object Editor | Only the chosen iteration stops. A captured branch remains selected if its condition changes while suspended. |
| Run to a statement | Select the line containing the count assignment, then Run to Cursor | Earlier code runs; the selected statement has not executed when the debugger stops. |
| Repair a missing method | `missingMethodLesson`; inspect `exception`, then Edit Method and add `convertStep(value) { return Number(value); }` | Retry retries the failed call. The count becomes 1 and `this.lessonVisits` stays 1. |
| Return an alternative result | `nestedLesson`; Step Into `double`, then Return with expression `7` | The child is replaced by 7 and the caller uses it without running the rest of the child. |
| Save methods and continue at the current position | Increment; save a change to the count assignment after `debugger`, then Apply Saved Method | The new assignment runs with existing locals; completed statements are not replayed. |
| Reject unsafe position migration | Change an earlier initialization, then Apply Saved Method | The action explains that Restart Frame is required and leaves the old computation intact. |
| Restart with new source | Save an earlier edit and Restart Frame | The same receiver and original arguments enter the saved method from its first statement. Earlier effects will run again. |
| Handle exceptions and cleanup | Set `this.rejectLesson = true`, run `exceptionLesson`, and Proceed into its catch | The catch binding is available; cleanup stays dormant at stops and runs once on completion. |
| Await external work without freezing the world | `awaitLesson`; move a window during its timer, inspect `amount`, repair it and Proceed | The timer settles, the original frame stops after await, and the repaired value reaches the counter. |
| Inspect a foreign retained environment | Run the retained-environment experiment below, or use `runWithCapturedBindings(fn, null, [], mapping)` | Missing names are read from `[[Scopes]]`; objects retain identity. Imported primitive values remain snapshots of the original native environment. |
| Abort a computation | Close a debugger before its count assignment | No remaining statements execute; other computations remain interactive. Completed effects remain visible. |
| Preserve source and the image | Save in the Object Editor; save the world using the existing world/project controls; quit and reopen via the dashboard | Source persists. A world save is required for runtime objects; an unsaved suspended stack is not serialized as a resumable native stack. |

The toolbar's Edit Method opens the existing Object Editor for the selected
receiver. Apply Saved Method maps the old AST position and recorded expression
results to saved source only when executed code and arguments are unchanged.
Structural changes before the current position use Restart Frame. This preserves
the existing continuation rather than guessing a location in unrelated code.

`let`/`const` environments use the existing recorded scope chain, with shared cells
for shadowing, declaration timing and const assignment checks. Both rewritten
closures and interpreted frames access those same cells. Workspace scope selection
controls inspection; expression lookup retains lexical shadowing order.

`await` yields through `UnwindException` and resumes through `Continuation` after
the promise settles. Rejections remain inspectable and Return can supply a result.
This does not reconstruct arbitrary native promise callback stacks or serialize
pending OS operations. Native code that was never rewritten still cannot expose
arbitrary stack locals through retained function environments.

The packaged NW.js 0.111.1 tutorial verified local repair, receiver identity,
numeric conversion saved onto the same object, and adding/calling `decrement()`
while suspended. Saved methods affect subsequent invocations. The separate retained
environment experiment recovered exactly `step` and `marker`, preserved the marker's
identity, kept a renderer timer running during suspension, and resumed to `3` after
repairing `amount`. These results use the original continuation machinery.

Restart preserves captured outer bindings and original arguments; introducing new
retained bindings uses the Runtime reader in `runWithCapturedBindings` or Step Into.
The desktop app must be launched with `LIVELY_APP_FUNCTION_SCOPES=1` for this reader.

## NW.js retained-environment experiment

Build with `FLAVOR=sdk` and launch with `LIVELY_APP_FUNCTION_SCOPES=1`.
The background Node context uses NW.js's existing browser inspector transport and exposes:

```js
const values = await livelyDesktop.debugger.captureFunctionBindings(fn, ['step', 'marker']);
const { run } = await System.import('lively.context/lib/stackReification.js');
const continuation = run(fn, null, [], values);
```

`runWithCapturedBindings` identifies the names missing from the supplied mapping
and global environment before requesting inspector values. It is asynchronous;
await its result, which has the same result/continuation contract as `run()`.

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
is involved. The bridge avoids the reproduced competing-inspector integration;
the direct Node/Blink ownership crash remains an NW.js integration issue.

Primary implementation and runtime guidance:
[V8 function scopes](https://github.com/v8/v8/blob/main/src/inspector/v8-debugger.cc),
[NW.js inspector option](https://docs.nwjs.io/References/Command%20Line%20Options/#--nw-node-inspector).

Writing V8's synthetic scope object does not establish native lexical writeback.
The protocol's [setVariableValue](https://chromedevtools.github.io/devtools-protocol/tot/Debugger/#method-setVariableValue)
requires a paused call frame, and [V8 rejects it while execution is running](https://github.com/v8/v8/blob/main/src/inspector/v8-debugger-agent-impl.cc).
Managed rewritten closure cells supply writable shared state without that pause;
imported native primitive bindings cannot be treated as writable handles.

Run `lively.context/tests/tutorial-test.js` with mocha-es6 for the executable core
acceptance cases. The packaged desktop debugger smoke also exercises actual UI
actions, the renderer inspector bridge, and dashboard/project persistence.
