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

Newly compiled Lively modules record retained binding cells and original source spans
for runtime function literals. Closures created by the same factory share their cells.
Debugger assignments update the original native binding and sibling closures;
`const` and declaration timing retain JavaScript semantics. The source pane displays
the complete original module, with the selected closure highlighted in its factory.
The SWC module loader uses its existing Babel fallback for nested functions until
the WASM transform supplies the same retained binding cells and source metadata.

For older or uninstrumented functions, the NW.js reader reads requested bindings through a function's `[[Scopes]]`
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

### Ordinary execution

In a live client world, loading or saving a JavaScript module containing an actual
`debugger;` statement automatically enables interception for that module. Call its
functions and methods normally, including through buttons and callbacks. A reached
stop opens Lively Debugger and suspends the instrumented callers while the world
continues running. No tutorial helper or explicit `run()` call is required.
Interception applies to function bodies; bare statements in module initialization
are not captured. Enable interception before creating callback references: native
function references retained elsewhere before enabling cannot be replaced in place.
Computed class member keys are not yet intercepted.
Object-literal methods using `super` retain native execution until their home-object
binding is supplied; class `super` methods use the existing class-system lowering.

The System Browser's menu includes **Toggle module debugger interception**. This
temporarily enables or disables interception for the selected module. Enabling it
wraps current definitions without rerunning module initialization or saving source;
existing class instances keep their identity. Future source edits honor the setting.
You can also use `await module('your/package/file.js').setDebuggingEnabled(true)`
after importing `module` from `lively.modules`.

Only selected modules pay the rewriting cost. Functions are rewritten on first use
and their rewritten version is cached. Closure cells, original module locations,
the existing continuation/interpreter, awaits and managed generators are reused.
No native breakpoint or exception-pause service is involved.

Uninstrumented native callers are execution boundaries. An ordinary synchronous
call keeps its synchronous return value when it completes; a suspended call returns
a promise that resolves when the debugger completes the computation. Native code
that needs the eventual value must await it, or have its own module interception
enabled so its JavaScript callers are captured too. Closing a debugger abandons its
invocation and resolves that pending result to `undefined`.

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
4. Change `var amount = this.step;` to
   `var amount = Number(this.step);` in the debugger source pane and save the module
   with Ctrl-S (Command-S on macOS). Wait until the
   save finishes, then click **Increment** again. The existing object uses the new
   method; proceed to reach `2`.
5. While suspended, replace the saved increment with `Number(this.step) * 2`.
   **Restart Frame** resolves the current saved method on the same receiver and
   stops at its first statement. The source pane now shows the replacement method.
   Proceed to the rewritten debugger statement, inspect `amount`, then proceed
   again. Restart reexecutes earlier statements; it does not migrate an arbitrary
   old execution position into edited code.
6. Add `decrement() { this.count -= 1; this.updateCount(); }` in the debugger source pane and save.
   Evaluate `this.decrement()` in the suspended debugger workspace. Continue
   changing methods and state on the same counter, without recreating it.
7. Set `this.pause = false` when finished. Quit, relaunch, reopen the project via the
   dashboard, and check saved source. Runtime objects require a world save to persist.

Record the action, selected statement, expected count, actual count, and status error.
The debugger source pane displays the original module, saves it, and retains unsaved
drafts while changing frames. The Object Editor remains available through Edit Method.

### Generators and async iteration

Open the generator exercise from a workspace:

```js
const {openGeneratorWorkflow} = await System.import('lively.ide/js/debugger/examples/generator-workflow.js');
await openGeneratorWorkflow();
```

The debugger stops in `GeneratorLesson.lineTotals`, after its first await, while
`checkout` waits for the next async iterator result. Its source pane shows the
original class module. Evaluate `this.rate = 2; amount = this.rate * quantity` to
repair the first line, then Proceed. Repair `amount` again at the second stop and
Proceed to get `10`, with two visits and one cleanup. To evolve the implementation,
save future `yield` edits in the debugger and use Apply Saved Method; changes to
already executed statements require Restart Frame or a new checkout.

Generators retain an ordinary interpreter `Frame` between iterator requests.
`next(value)`, `throw(error)`, `return(value)`, `yield*`, async generators, and
`for await` use the existing continuation and await machinery. Suspension keeps
catch/finally and iterator cleanup dormant; completion, break, and errors execute
the appropriate cleanup. Managed generator frames and recorded array/string
cursors can be saved through the existing serializer. A pending external promise
still restores as an await checkpoint requiring its result.

### Order desk: a longer implementation session

Open the completed exercise in a JavaScript workspace:

```js
const { openOrderDesk } = await System.import('lively.ide/js/debugger/examples/order-desk.js');
openOrderDesk();
```

The example combines two cart lines, quantity/price validation, a VIP discount,
VAT, an asynchronous delivery quote, atomic inventory updates and undo. Checkout
pauses before pricing and again before committing. Its fixed-position timer shows
that the surrounding world remains active. Amounts are integer cents.

1. Click **Checkout**. Inspect `this.cart`, `this.stock` and `this.attempts` in the
   debugger eval space. Select an expression and use Do It or Print It.
2. Proceed to the second stop. Inspect
   `[receipt.subtotal, receipt.discount, receipt.tax, receipt.shipping, receipt.total]`:
   expect `[3850, 385, 693, 500, 4658]`. Inventory is still unchanged.
3. Step Over the debugger statement, Step Into `commitOrder`, then Step Out and
   Proceed. Expect stock `{tea: 1, cake: 2}`, one receipt, one attempt and one quote.
4. Click **Undo**, then Proceed. Expect stock `{tea: 3, cake: 5}` and no receipts.
5. Reset, click **Bad cart**, then Checkout and Proceed. The exception reports an
   invalid cake quantity. Evaluate `line.quantity = '3'` and Retry: the first
   line's subtotal is retained and the checkout attempt is not replayed.
6. Reset and start another checkout. Change the second cart line to
   `{sku: 'tea', quantity: '2', unit: 1250}`. Proceed twice. The combined quantity
   exceeds stock; the exception leaves all inventory and receipts unchanged.
7. While paused, edit the original module in the source pane and save with Ctrl-S
   (Command-S on macOS). Apply Saved Method installs future changes in the held
   frame. Editing completed code requires Restart Frame, which repeats its effects.

The earlier reel exposed failures in `for…of`, object spread, missing-method
errors, and Run to Cursor across awaits. These now have regression checks. The
example uses `for…of` and object spread directly; its acceptance check exercises
pricing, retries, async quotes, stock updates and undo. Print It uses Lively's
object formatter, including array brackets and nesting. A UI regression moves a
saved method by 250 lines and checks that its execution line remains visible.

### Runtime closure: inspect the original factory

```js
const { openRuntimeClosure } = await System.import('lively.ide/js/debugger/examples/runtime-closure.js');
await openRuntimeClosure();
```

The factory has already returned. Step Over to the `charge` call and Step Into.
The source pane shows `charge` at its original location inside `makeRuntimeCharge`,
including the rest of the module and syntax colors. Proceed to its debugger stop.
Evaluate `rate`, `amount`, and `ledger.visits`: expect `'2'`, `'23'`, and `1`.
Evaluate `rate = 2` and `amount = rate + quantity`. Select the caller and evaluate
`this.account.readRate()`: expect `2`, demonstrating native binding writeback.
Proceed: expect `6`, ledger total `5`, and one visit.

Save the world while the debugger is open, quit and reopen it. The interpreter
frames, program counters, computed effects, receiver, shared closure cells,
workspace variables and source drafts are part of the saved object graph.
Proceed resumes the saved computation without replaying completed statements.

If an await was saved before its operation completed, Proceed asks for its
result in the restored frame's scope. The checkpoint does not reissue the request.
A pending timer, socket or OS operation is not a persisted runtime handle.
Array and string iteration can be saved mid-loop; a still-active native iterator
without a serializable cursor rejects saving explicitly.

Saved module bindings and source drafts use package paths, so reopening on another
desktop server origin still resolves the current module. The packaged Linux x64
NW.js check saves the complete world with a repaired runtime closure and two frames,
quits, relaunches and opens the project through the dashboard in the same document.
The restored debugger is rendered, retains `scratch = 13` and its unsaved draft,
and resumes to `6` with ledger total `5` and one visit. Core and renderer regression
checks cover the tutorial failures and the shared world/style restoration fixes.

Regression checks: `lively.context/tests/tutorial-test.js`,
`lively.context/tests/persistence-test.js`,
`lively.ide/tests/js/debugger-runtime-closure-test.js`, and
`lively.ide/tests/js/debugger-order-desk-test.js`.

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
| Preserve lexical self in a block | `scopeLesson`; evaluate `self.call({}) === this` | The arrow block retains its home receiver even when called with a different receiver. |
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
| Inspect and repair a runtime closure | Run the runtime-closure lesson; change `rate` and inspect its sibling `readRate()` | Managed native closures share writable bindings and original module locations. Older uninstrumented closures use inspector snapshots. |
| Abort a computation | Close a debugger before its count assignment | No remaining statements execute; other computations remain interactive. Completed effects remain visible. |
| Preserve source, drafts and a suspended computation | Save the module in the debugger and save the world; quit and reopen via the dashboard | The debugger restores interpreter frames, scopes, workspace variables and drafts. Completed effects are retained. |

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
A saved pending await requires a supplied result after reopening; it does not
serialize pending OS operations or reconstruct arbitrary native promise callback stacks. Native code that was never rewritten still cannot expose
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
Managed closure cells, including those recorded by the module compiler, supply
writable shared state without that pause. Older uninstrumented native primitive
bindings remain snapshots; inspector access alone cannot turn them into writable
handles. Instrument their factory before creating a new closure.

This is not a claim of full current ECMAScript/ESM evaluation conformance. Module
loading stays with Lively's module system. The continuation interpreter supports
the constructs exercised above, including generators and async iteration. Native
stacks and OS handles are primitives; the debugger does not step into them or recreate
them when loading a saved world. Restart Frame intentionally
repeats earlier effects when edits change code that already executed.

Run `lively.context/tests/tutorial-test.js` with mocha-es6 for the executable core
acceptance cases. The packaged desktop debugger smoke also exercises actual UI
actions, the renderer inspector bridge, and dashboard/project persistence.
