# lively.lang [![Build Status](https://travis-ci.org/LivelyKernel/lively.lang.svg?branch=master)](https://travis-ci.org/LivelyKernel/lively.lang)

*What?* This project packages abstractions for JavaScript that proved to be useful in
the [Lively Web](http://lively-web.org) project. On first glance it might seem
to be just another underscore.js library but apart from extensions to existing
JavaScript objects and classes it also provides abstractions for asynchronous
code, new object representations, and functions for inspecting JavaScript
objects.

*Why?* Make it easy to reuse abstractions we found helpful in all kinds of
contexts. All features can be used in browser environments and in node.js.
Actually, one motivation for this library was to have unified interfaces across
JavaScript environments.

*How?* By default the library is non-invasive, i.e. no global objects are
modified. To use provided functions you can either

1. call them directly,
2. use underscore.js-like chain/value wrapping,
3. or install extension methods explicitly in global objects.

## Summary

Utility functions for default JavaScript objects:

- Array
- String
- Number
- Object
- Function
- Date

Abstractions usually not included by default in JavaScript runtimes:

- node.js-like event emitter interface (uses event module on node.js)
- Path (deep property access)
- Interval
- Grid
- Tree
- array projection
- Closure
- Messengers (generic interface for remote-messaging)
- Workers based on messengers

Please see the individual [doc files](doc/) for detailed information.

### [string.js](doc/string.md)

String utility methods for printing, parsing, and converting strings.



### [number.js](doc/number.md)


* Utility functions for JS Numbers.




### [object.js](doc/object.md)


* Utility functions that help to inspect, enumerate, and create JS objects




### [Path.js](doc/Path.md)

-=-=-=-=-=-=-=-=-=-=-=-=-=-
js object path accessor
-=-=-=-=-=-=-=-=-=-=-=-=-=-



### [array.js](doc/array.md)


* Methods to make working with arrays more convenient and collection-like
* abstractions for groups, intervals, grids.




### [array-projection.js](doc/array-projection.md)

Accessor to sub-ranges of arrays. This is used, for example, for rendering
 large lists or tables in which only a part of the items should be used for
 processing or rendering. An array projection provides convenient access and
 can apply operations to sub-ranges.



### [Group.js](doc/Group.md)

A Grouping is created by arr.groupBy and maps keys to Arrays.



### [graph.js](doc/graph.md)


Computation over graphs. Unless otherwise specified a graph is a simple JS
object whose properties are interpreted as nodes that refer to arrays whose
elements describe edges. Example:

```js
var testGraph = {
  "a": ["b", "c"],
  "b": ["c", "d", "e", "f"],
  "d": ["c", "f"],
  "e": ["a", "f"],
  "f": []
}
```




### [grid.js](doc/grid.md)

A grid is a two-dimaensional array, representing a table-like data



### [interval.js](doc/interval.md)

Intervals are arrays whose first two elements are numbers and the
 first element should be less or equal the second element, see
 [`interval.isInterval`](). This abstraction is useful when working with text
 ranges in rich text, for example.



### [tree.js](doc/tree.md)


* Methods for traversing and transforming tree structures.




### [function.js](doc/function.md)


* Abstractions around first class functions like augmenting and inspecting
* functions as well as to control function calls like dealing with asynchronous
* control flows.




### [closure.js](doc/closure.md)

A `Closure` is a representation of a JavaScript function that controls what
values are bound to out-of-scope variables. By default JavaScript has no
reflection capabilities over closed values in functions. When needing to
serialize execution or when behavior should become part of the state of a
system it is often necessary to have first-class control over this language
aspect.

Typically closures aren't created directly but with the help of [`asScriptOf`](#)

Example:
function func(a) { return a + b; }
var closureFunc = Closure.fromFunction(func, {b: 3}).recreateFunc();
closureFunc(4) // => 7
var closure = closureFunc.livelyClosure // => {
//   varMapping: { b: 3 },
//   originalFunc: function func(a) {/*...*/}
// }
closure.lookup("b") // => 3
closure.getFuncSource() // => "function func(a) { return a + b; }"



### [promise.js](doc/promise.md)


* Methods helping with promises (Promise/A+ model). Not a promise shim.




### [date.js](doc/date.md)


* Util functions to print and work with JS date objects.




### [messenger.js](doc/messenger.md)


* A pluggable interface to provide asynchronous, actor-like message
* communication between JavaScript systems. Provides a unified message protocol
* and send / receive methods.




### [events.js](doc/events.md)


* A simple node.js-like cross-platform event emitter implementation that can
* be used as a mixin. Emitters support the methods: `on(eventName, handlerFunc)`,
* `once(eventName, handlerFunc)`, `emit(eventName, eventData)`,
* `removeListener(eventName, handlerFunc)`, `removeAllListeners(eventName)`
* Example:
* var emitter = events.makeEmitter({});
* var log = [];
* emitter.on("test", function() { log.push("listener1"); });
* emitter.once("test", function() { log.push("listener2"); });
* emitter.emit("test");
* emitter.emit("test");
* log // => ["listener1","listener2","listener1"]
* emitter.removeAllListeners("test");
* emitter.emit("test");
* log // => is still ["listener1","listener2","listener1"]




### [worker.js](doc/worker.md)


* A platform-independent worker interface that will spawn new processes per
* worker (if the platform you use it on supports it).

<!---
## Usage
TODO

### Browsers
TODO

### node.js
TODO
--->

## License

[MIT License](LICENSE)

### methods throttle and debounce in function.js

adapted from Underscore.js 1.3.3
© 2009-2012 Jeremy Ashkenas, DocumentCloud Inc.
Underscore is distributed under the MIT license.

### dateFormat in date.js

Date Format 1.2.3
© 2007-2009 Steven Levithan <stevenlevithan.com>
MIT license
Includes enhancements by Scott Trenda <scott.trenda.net>
and Kris Kowal <cixar.com/~kris.kowal/>
