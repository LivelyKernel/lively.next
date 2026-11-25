# lively.context [![Build Status](https://travis-ci.org/LivelyKernel/lively.context.svg)](https://travis-ci.org/LivelyKernel/lively.context)

Rewriting JavaScript code to introduce first-class contexts and tools to manipulate those contexts (at runtime)

## The Lively debugger

`run(fn, registry, args, mapping)` (`lib/stackReification.js`) executes a rewritten
version of `fn` natively. The rewritten code records scopes, the current AST node and
computed expression results; a `debugger` statement or an exception unwinds through
`UnwindException`, and `Continuation.fromUnwindException` turns the recorded state into
interpreter `Frame`s. A `Continuation` continues in the AST interpreter (`lib/interpreter.js`):
`resume()`, `stepOver()`, `stepInto()`, `stepOut()`, `runToLine(line)`, `returnFrom(value)`,
`restartFrame()` and `applySavedMethod()` take an optional `{frame}` and return a suspended
`Continuation`, the completion value, or a Promise of either. `mapping` supplies closure
bindings (`mapping.this` the receiver); `runWithCapturedBindings` supplies the missing ones
itself. The debugger window (`lively.ide/js/debugger/ui.cp.js`,
`openForContinuation(continuation, world, {onComplete, onCancel})`) shows the stack, the scopes,
the original module source and a workspace, while the world keeps running.

### Interception

- In the IDE, `System.debuggerInterception` is `true` unless it is set before studio
  initialization. A module loaded or saved with an actual `debugger;` statement is then
  intercepted: calling its functions normally, from buttons or callbacks, stops at the
  statement and opens the debugger. Exceptions propagate as usual.
- The System Browser's module menu entry **Toggle module debugger interception**, or
  `await module('my-project/file.js').setDebuggingEnabled(true)` (`module` from
  `lively.modules`), enables interception explicitly. It wraps the current definitions without
  rerunning the module, and also opens the debugger on uncaught exceptions while the module is
  on the captured stack.
- Interception applies to function bodies, not to module top-level statements. References to
  native functions taken before interception was enabled stay native. Computed class member
  keys are not intercepted. A function whose syntax the rewriter does not support runs natively
  and warns once.

A native, uninstrumented caller is the boundary of a captured computation. A call that
completes keeps its synchronous result; a call that stops returns a promise of the result the
debugger eventually completes with. Closing the debugger abandons the computation and resolves
that promise to `undefined`; closed during a running Proceed, the debugger still delivers a
completion and cancels only a new stop.

### Retained runtime closures

Intercepted modules record live binding cells and original source locations for their
function literals: debugger assignments update the native binding and every sibling closure,
`const` and declaration timing keep JavaScript semantics, and the source pane shows a closure
inside its factory. Saving those closures in world snapshots is opt-in per module: set
`module(id).retainRuntimeClosures = true` before loading or reloading it. The module then also
records cells without interception. This costs compilation time (a module with nested
functions compiles with Babel instead of SWC), closure creation time and memory, and every
snapshot contains the captured values; enable it only for modules whose captured state should
be saved. Enabling it affects closures created after the reload.

### Desktop scope reader

The lively.next desktop app reads the bindings of a native closure that has no retained cells:
`await livelyDesktop.debugger.captureFunctionBindings(fn, names)` evaluates CDP `Runtime`
commands on the function's `[[Scopes]]` and returns an object of the page realm.
`runWithCapturedBindings` and Step Into use it for missing bindings. Objects keep their
identity; primitives are copies, so assigning them does not change the native binding.
`LIVELY_APP_FUNCTION_SCOPES=0` disables the reader. The app manifest's `chromium-args` request
`--remote-debugging-port=0`: NW.js serves its inspector on a free port and writes the port to
`DevToolsActivePort` in its user data directory (`--user-data-dir`, the parent of
`nw.App.dataPath`), where the reader and other inspector clients find it. NW.js writes this file
only for port 0, and the manifest's port overrides a `--remote-debugging-port` launch flag.
Without the file the reader waits up to 5 s for it, then connects to `LIVELY_APP_CDP_PORT`
(default 9222).

### Limits

- Resuming adds microtasks, so the interleaving with unrelated promise chains can differ from
  native execution; the effects of each chain keep their order.
- Rewritten async functions are ordinary `Function`s: they have no `AsyncFunction` tag or
  constructor.
- A world saved while an `await` is pending restores it as a checkpoint without its operation:
  Proceed asks for the awaited result.
- Timers, sockets and OS handles are not saved. Array and string iteration can be saved
  mid-loop; saving an active native iterator without a serializable cursor fails. The debugger
  does not step into native code.
- Restart Frame repeats the effects of the statements it runs again. Apply Saved Method
  continues in saved source only if the executed code and the arguments are unchanged.

### Tests

With a running server (`./start-server.sh`), `node --dns-result-order ipv4first scripts/test.js
lively.context` runs the core suites in a browser world; the UI suites are
`lively.ide/tests/js/debugger-*-test.js` (`scripts/test.js lively.ide`) and the module loader
suites `lively.modules/tests/debugger-*`. In Node, `npm test` in `lively.context` runs the core
suites, and `node lively.app/scripts/test-function-scopes.mjs` the desktop scope reader.

## Tutorial: evolve a running counter

Open a JavaScript workspace and evaluate:

```js
const { openLiveCounter } = await System.import('lively.ide/js/debugger/examples/live-counter.js');
openLiveCounter();
```

1. Click **Increment**. The computation stops at `if (this.pause) debugger;` and the debugger
   opens; other windows stay interactive.
2. In the debugger workspace (F2), evaluate `this.count`, `amount` and `typeof amount`: `0`,
   `'1'` and `'string'`. The string step is the bug.
3. Evaluate `amount = Number(amount)`, **Step Over**, then **Proceed**: the count is `1`.
4. Click **Increment**, change `var amount = this.step;` to `var amount = Number(this.step);`
   in the source pane, save with Ctrl-S (Command-S on macOS) and close the debugger, which
   abandons the suspended call. Click **Increment** again: the same counter runs the saved
   method; Proceed to `2`.
5. Click **Increment** and save `var amount = Number(this.step) * 2;`. **Apply Saved Method**
   refuses because the changed statement already ran; **Restart Frame** reenters the saved
   method on the same receiver at its first statement. Proceed to the `debugger` statement,
   where `amount` is `2`, and Proceed again: the count is `4`.
6. Click **Increment**, add `decrement () { this.count -= 1; this.updateCount(); }` to the
   class in the source pane and save. Evaluate `this.decrement()` in the workspace (`3`),
   then Proceed (`5`).
7. Click **Increment**, evaluate `this.pause = false` and Proceed: further increments run
   without stopping.

**Lessons** runs further scenarios on the same counter:

| Lesson | Action | Result |
| --- | --- | --- |
| `scopeLesson` | Evaluate `amount = 4`, `read()`, `self.call({}) === this`, `receiver = {}` | `read()` is `4` and the outer `amount` stays `1`; the arrow keeps its receiver; assigning the constant throws a TypeError. |
| `scopeLesson` | Evaluate `let scratch = amount * 2`, then `scratch += 1` | Workspace declarations persist across evaluations. |
| `loopLesson` | Inspect `i` and `reads[0]()`, Proceed | `1` and `0`; the result is `[0, 1, 2]`. |
| `nestedLesson` | Step Over, Step Into `double`, inspect `value`, Step Out | The caller receives the result of the single call. |
| `nestedLesson` | Step Into `double`, **Return** `7` | The caller continues with `7`. |
| `missingMethodLesson` | Inspect `exception`; **Edit Method** adds `convertStep(value) { return Number(value); }`; **Retry** | The failed call runs again; `this.lessonVisits` stays `1`. |
| `awaitLesson` | Move a window during the timer; repair `amount`; Proceed | The frame stops after the await; the repair reaches the count. |
| `exceptionLesson` | Set `this.rejectLesson = true`, Proceed into the catch | The catch binding is visible; `finally` runs once on completion. |
| any | Select a line, **Run to Cursor** | The earlier statements run; the selected one has not. |
| any | Save an edit after the current statement, **Apply Saved Method** | The edit runs with the existing locals; an edit before it requires Restart Frame. |

Closing a debugger abandons its computation; completed effects remain.

## Tutorial: repair a runtime closure

```js
const { openRuntimeClosure } = await System.import('lively.ide/js/debugger/examples/runtime-closure.js');
await openRuntimeClosure();
```

The factory `makeRuntimeCharge` has returned before the debugger stops in `checkout`. Step Over
to the `charge` call and Step Into it: the source pane shows `charge` inside the factory of the
complete module. Proceed to its `debugger` statement and evaluate `rate`, `amount` and
`ledger.visits`: `'2'`, `'23'` and `1`. Evaluate `rate = 2` and `amount = rate + quantity`,
select the caller frame and evaluate `this.account.readRate()`: `2`, because the closure shares
the native binding. Proceed: the result is `6`, the ledger total `5`.

Saving the world while the debugger is open saves the frames, program counters, computed
results, receiver, shared closure cells, workspace variables and unsaved source drafts.
Reopened, also from another origin of the desktop server, Proceed continues the saved
computation without repeating completed statements.
