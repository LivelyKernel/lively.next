## function.js


* Abstractions around first class functions like augmenting and inspecting
* functions as well as to control function calls like dealing with asynchronous
* control flows.


- [Empty](#Empty)
- [K](#K)
- [Null](#Null)
- [False](#False)
- [True](#True)
- [queue](#queue)
  - [handleError](#queue-handleError)

#### <a name="Empty"></a>Empty()

`function() {}`

#### <a name="K"></a>K()

`function(arg) { return arg; }`

#### <a name="Null"></a>Null()

`function() { return null; }`

#### <a name="False"></a>False()

`function() { return false; }`

#### <a name="True"></a>True()

`function() { return true; }`

#### <a name="all"></a>all(object)

 Returns all property names of `object` that reference a function.
 

```js
var obj = {foo: 23, bar: function() { return 42; }};
all(obj) // => ["bar"]
```

#### <a name="own"></a>own(object)

 Returns all local (non-prototype) property names of `object` that
 reference a function.
 

```js
var obj1 = {foo: 23, bar: function() { return 42; }};
var obj2 = {baz: function() { return 43; }};
obj2.__proto__ = obj1
own(obj2) // => ["baz"]
/*vs.*/ all(obj2) // => ["baz","bar"]
```

#### <a name="argumentNames"></a>argumentNames(f)

 

```js
argumentNames(function(arg1, arg2) {}) // => ["arg1","arg2"]
argumentNames(function(/*var args*/) {}) // => []
```

#### <a name="argumentNames"></a>argumentNames(f)

 it's a class...

#### <a name="extractBody"></a>extractBody(func)

 superflous indent. Useful when you have to stringify code but not want
 to construct strings by hand.
 

```js
extractBody(function(arg) {
  var x = 34;
  alert(2 + arg);
}) => "var x = 34;\nalert(2 + arg);"
```

#### <a name="timeToRun"></a>timeToRun(func)

 returns synchronous runtime of calling `func` in ms
 

```js
timeToRun(function() { new WebResource("http://google.de").beSync().get() });
// => 278 (or something else...)
```

#### <a name="timeToRunN"></a>timeToRunN(func, n)

 Like `timeToRun` but calls function `n` times instead of once. Returns
 the average runtime of a call in ms.

#### <a name="delay"></a>delay(func, timeout)

 Delays calling `func` for `timeout` seconds(!).
 

```js
(function() { alert("Run in the future!"); }).delay(1);
```

#### <a name="throttle"></a>throttle(func, wait)

 Exec func at most once every wait ms even when called more often
 useful to calm down eagerly running updaters and such.
 

```js
var i = 0;
var throttled = throttle(function() { alert(++i + '-' + Date.now()) }, 500);
Array.range(0,100).forEach(function(n) { throttled() });
```

#### <a name="debounce"></a>debounce(wait, func, immediate)

 Call `func` after `wait` milliseconds elapsed since the last invocation.
 Unlike `throttle` an invocation will restart the wait period. This is
 useful if you have a stream of events that you want to wait for to finish
 and run a subsequent function afterwards. When you pass arguments to the
 debounced functions then the arguments from the last call will be use for
 the invocation.

 With `immediate` set to true, immediately call `func` but when called again during `wait` before
 wait ms are done nothing happens. E.g. to not exec a user invoked
 action twice accidentally.
 

```js
var start = Date.now();
var f = debounce(200, function(arg1) {
  alert("running after " + (Date.now()-start) + "ms with arg " + arg1);
});
f("call1");
delay(f.curry("call2"), 0.1);
delay(f.curry("call3"), 0.15);
// => Will eventually output: "running after 352ms with arg call3"
```

#### <a name="throttleNamed"></a>throttleNamed(name, wait, func)

 Like `throttle` but remembers the throttled function once created and
 repeated calls to `throttleNamed` with the identical name will use the same
 throttled function. This allows to throttle functions in a central place
 that might be called various times in different contexts without having to
 manually store the throttled function.

#### <a name="debounceNamed"></a>debounceNamed(name, wait, func, immediate)

 Like `debounce` but remembers the debounced function once created and
 repeated calls to `debounceNamed` with the identical name will use the same
 debounced function. This allows to debounce functions in a central place
 that might be called various times in different contexts without having to
 manually store the debounced function.

#### <a name="createQueue"></a>createQueue(id, workerFunc)

 A simple queue with an attached asynchronous `workerFunc` to process
 queued tasks. Calling `createQueue` will return an object with the
 following interface:
 ```js
 {
   push: function(task) {/**/},
   pushAll: function(tasks) {/**/},
   handleError: function(err) {}, // Overwrite to handle errors
   dran: function() {}, // Overwrite to react when the queue empties
 }
 

```js
var sum = 0;
var q = createQueue("example-queue", function(arg, thenDo) { sum += arg; thenDo(); });
q.pushAll([1,2,3]);
queues will be remembered by their name
createQueue("example-queue").push(4);
sum // => 6
```

#### <a name="createQueue"></a>createQueue(id, workerFunc)

 can be overwritten by a function

#### <a name="queue-handleError"></a>queue.handleError(err)

 can be overwritten

#### <a name="workerWithCallbackQueue"></a>workerWithCallbackQueue(id, workerFunc, optTimeout)

 This functions helps when you have a long running computation that
 multiple call sites (independent from each other) depend on. This
 function does the housekeeping to start the long running computation
 just once and returns an object that allows to schedule callbacks
 once the workerFunc is done.
 

```js
var worker = workerWithCallbackQueue("example",
  function slowFunction(thenDo) {
    var theAnswer = 42;
    setTimeout(function() { thenDo(null, theAnswer); });
  });
// all "call sites" depend on `slowFunction` but don't have to know about
// each other
worker.whenDone(function callsite1(err, theAnswer) { alert("callback1: " + theAnswer); })
worker.whenDone(function callsite2(err, theAnswer) { alert("callback2: " + theAnswer); })
workerWithCallbackQueue("example").whenDone(function callsite3(err, theAnswer) { alert("callback3: " + theAnswer); })
// => Will eventually show: callback1: 42, callback2: 42 and callback3: 42
```

#### <a name="composeAsync"></a>composeAsync()

 Composes functions that are asynchronous and expecting continuations to
 be called in node.js callback style (error is first argument, real
 arguments follow).
 A call like `composeAsync(f,g,h)(arg1, arg2)` has a flow of control like:
  `f(arg1, arg2, thenDo1)` -> `thenDo1(err, fResult)`
 -> `g(fResult, thenDo2)` -> `thenDo2(err, gResult)` ->
 -> `h(fResult, thenDo3)` -> `thenDo2(err, hResult)`
 

```js
composeAsync(
  function(a,b, thenDo) { thenDo(null, a+b); },
  function(x, thenDo) { thenDo(x*4); }
 )(3,2, function(err, result) { alert(result); });
```

#### <a name="compose"></a>compose()

 Composes synchronousefunctions:
 `compose(f,g,h)(arg1, arg2)` = `h(g(f(arg1, arg2)))`
 

```js
compose(
  function(a,b) { return a+b; },
  function(x) {return x*4}
)(3,2) // => 20
```

#### <a name="flip"></a>flip(f)

 Swaps the first two args
 

```js
flip(function(a, b, c) {
  return a + b + c; })(' World', 'Hello', '!') // => "Hello World!"
```

#### <a name="flip"></a>flip(f)

args

#### <a name="withNull"></a>withNull(func)

 returns a modified version of func that will have `null` always curried
 as first arg. Usful e.g. to make a nodejs-style callback work with a
 then-able:
 

```js
promise.then(withNull(cb)).catch(cb);
```

#### <a name="withNull"></a>withNull(func)

args

#### <a name="waitFor"></a>waitFor(timeoutMs, waitTesterFunc, thenDo)

 Wait for waitTesterFunc to return true, then run thenDo, passing
 failure/timout err as first parameter. A timout occurs after
 timeoutMs. During the wait period waitTesterFunc might be called
 multiple times.

#### <a name="waitForAll"></a>waitForAll(options, funcs, thenDo)

 Wait for multiple asynchronous functions. Once all have called the
 continuation, call `thenDo`.
 options can be: `{timeout: NUMBER}` (how long to wait in milliseconds).

#### <a name="curry"></a>curry(func, arg1, arg2, argN)

 Return a version of `func` with args applied.
 

```js
var add1 = (function(a, b) { return a + b; }).curry(1);
add1(3) // => 4
```

#### <a name="wrap"></a>wrap(func, wrapper)

 A `wrapper` is another function that is being called with the arguments
 of `func` and a proceed function that, when called, runs the originally
 wrapped function.
 

```js
function original(a, b) { return a+b }
var wrapped = wrap(original, function logWrapper(proceed, a, b) {
  alert("original called with " + a + "and " + b);
  return proceed(a, b);
})
wrapped(3,4) // => 7 and a message will pop up
```

#### <a name="getOriginal"></a>getOriginal(func)

 Get the original function that was augmented by `wrap`. `getOriginal`
 will traversed as many wrappers as necessary.

#### <a name="wrapperChain"></a>wrapperChain(method)

 Function wrappers used for wrapping, cop, and other method
 manipulations attach a property "originalFunction" to the wrapper. By
 convention this property references the wrapped method like wrapper
 -> cop wrapper -> real method.
 tThis method gives access to the linked list starting with the outmost
 wrapper.

#### <a name="replaceMethodForOneCall"></a>replaceMethodForOneCall(obj, methodName, replacement)

 Change an objects method for a single invocation.
 

```js
var obj = {foo: function() { return "foo"}};
lively.lang.replaceMethodForOneCall(obj, "foo", function() { return "bar"; });
obj.foo(); // => "bar"
obj.foo(); // => "foo"
```

#### <a name="once"></a>once(func)

 Ensure that `func` is only executed once. Multiple calls will not call
 `func` again but will return the original result.

#### <a name="either"></a>either()

 Accepts multiple functions and returns an array of wrapped
 functions. Those wrapped functions ensure that only one of the original
 function is run (the first on to be invoked).

 This is useful if you have multiple asynchronous choices of how the
 control flow might continue but want to ensure that a continuation
 is  only triggered once, like in a timeout situation:

 ```js
 function outerFunction(callback) {
   function timeoutAction() { callback(new Error('timeout!')); }
   function otherAction() { callback(null, "All OK"); }
   setTimeout(timeoutAction, 200);
   doSomethingAsync(otherAction);
 }
 ```

 To ensure that `callback` only runs once you would normally have to write boilerplate like this:

 ```js
 var ran = false;
 function timeoutAction() { if (ran) return; ran = true; callback(new Error('timeout!')); }
 function otherAction() { if (ran) return; ran = true; callback(null, "All OK"); }
 ```

 Since this can get tedious an error prone, especially if more than two choices are involved, `either` can be used like this:
 

```js
function outerFunction(callback) {
  var actions = either(
    function() { callback(new Error('timeout!')); },
    function() { callback(null, "All OK"); });
  setTimeout(actions[0], 200);
  doSomethingAsync(actions[1]);
}
```

#### <a name="eitherNamed"></a>eitherNamed(name, func)

 Works like [`either`](#) but usage does not require to wrap all
 functions at once:
 

```js
var log = "", name = "either-example-" + Date.now();
function a() { log += "aRun"; };
function b() { log += "bRun"; };
function c() { log += "cRun"; };
setTimeout(eitherNamed(name, a), 100);
setTimeout(eitherNamed(name, b), 40);
setTimeout(eitherNamed(name, c), 80);
setTimeout(function() { alert(log); /* => "bRun" */ }, 150);
```

#### <a name="fromString"></a>fromString(funcOrString)

 

```js
fromString("function() { return 3; }")() // => 3
```

#### <a name="asScript"></a>asScript(func, optVarMapping)

 Lifts `func` to become a `Closure`, that is that free variables referenced
 in `func` will be bound to the values of an object that can be passed in as
 the second parameter. Keys of this object are mapped to the free variables.

 Please see [`Closure`](#) for a more detailed explanation and examples.

#### <a name="asScriptOf"></a>asScriptOf(f, obj, optName, optMapping)

 Like `asScript` but makes `f` a method of `obj` as `optName` or the name
 of the function.

#### <a name="functionNames"></a>functionNames(klass)

 Treats passed function as class (constructor).
 

```js
var Klass1 = function() {}
Klass1.prototype.foo = function(a, b) { return a + b; };
Klass1.prototype.bar = function(a) { return this.foo(a, 3); };
Klass1.prototype.baz = 23;
functionNames(Klass1); // => ["bar","foo"]
```

#### <a name="logErrors"></a>logErrors(func, prefix)

,args

#### <a name="webkitStack"></a>webkitStack()

 this won't work in every browser