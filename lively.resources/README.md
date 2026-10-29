# lively.resources [![Build Status](https://travis-ci.org/LivelyKernel/lively.resources.svg?branch=master)](https://travis-ci.org/LivelyKernel/lively.resources)

Abstraction around file and collection like entities for HTTP (WevDAV-based),
node.js (fs), and lively-2-lively.

HTTP requests accept a caller `AbortSignal` and a per-request timeout in milliseconds:

```js
const controller = new AbortController();
const file = resource('https://example.com/data.json', {
  signal: controller.signal,
  timeout: 5000
});
await file.readJson();
// controller.abort() cancels an active read or upload.
```

Either cancellation or the timeout ends the request when both are supplied.
An omitted or `null` timeout leaves requests without a time limit. Other values
must be non-negative safe integers in milliseconds; invalid values reject with
the method and URL in the error, before starting a request.
These options follow resources derived with `join`, `parent`, `withQuery` and
`makeProxied`. Request errors identify the method and URL, retain their original
error as `cause`, and preserve `AbortError` or `TimeoutError` names.
