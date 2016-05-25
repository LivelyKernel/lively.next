# lively.vm [![Build Status](https://travis-ci.org/LivelyKernel/lively.vm.svg)](https://travis-ci.org/LivelyKernel/lively.vm)

Controlled JavaScript code execution and instrumentation.

## interface

#### `lively.vm.runEval(sourceString, options)`

To evaluate an expression in the context of a module (to access and modify
its internal state) you can use the `runEval` method.

Example: If you have a module `a.js` with the source code

```js
var x = 23;
export x;
```

you can evaluate an expression like `x + 2` via
`lively.vm.runEval("x + 2", {targetModule: "a.js"})`.
This will return a promise that resolves to an `EvalResult` object. The eval
result will have a field `value` which is the actual return value of the last
expression evaluated. In this example it is the number 25.

Note: Since variable `x` is exported by `a.js` the evaluation will also
affect the exported value of the module. Dependent modules will automatically
have access to the new exported value x.

*Caveat in the current version*: When evaluating new exports (exports that
didn't exist when the module was first imported) you need to run
[`lively.modules.reloadModule`](https://github.com/LivelyKernel/lively.modules#reloadmodulemodulename-options)
to properly update dependent modules!

<!--
## Examples

```js
var state = {y: 2};
lively.vm.syncEval(
  "var x, y; (function() { x = y * 3; })();",
  {topLevelVarRecorder: state});
state.x // => 6
window.x // -> undefined, evalSync did not touch globals
```
-->

## LICENSE

[MIT](LICENSE)
