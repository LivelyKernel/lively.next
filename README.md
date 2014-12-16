# lively.vm [![Build Status](https://travis-ci.org/LivelyKernel/lively.vm.svg)](https://travis-ci.org/LivelyKernel/lively.vm)

Controlled JavaScript code execution and instrumentation.

## Examples

```js
var state = {y: 2};
lively.vm.syncEval(
  "var x, y; (function() { x = y * 3; })();",
  {topLevelVarRecorder: state});
state.x // => 6
window.x // -> undefined, evalSync did not touch globals
```