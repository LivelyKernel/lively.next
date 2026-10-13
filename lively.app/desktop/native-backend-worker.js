// NW.js --enable-node-worker gives this Chromium worker its own Node context.
// Node builtins also need the web primitives present on the worker's global.
for (const name of ['Event', 'EventTarget', 'MessageEvent', 'CloseEvent', 'AbortController', 'AbortSignal',
  'ReadableStream', 'WritableStream', 'TransformStream', 'DOMException', 'Blob', 'File']) global[name] = self[name];
Object.assign(global, {
  TextDecoder: require('node:util').TextDecoder,
  TextEncoder: require('node:util').TextEncoder,
  URL: require('node:url').URL,
  URLSearchParams: require('node:url').URLSearchParams
});

let backend, nextReplyId = 0, active = 0, nodeTick;
// NW.js doesn't wake an idle Chromium worker for Node I/O. Browser tasks pump
// libuv; keep them running while requests or Node handles need the event loop.
// ponytail: active Node handles require polling until NW.js fixes wake delivery.
function wakeNode () {
  if (nodeTick) return;
  const tick = () => {
    nodeTick = undefined;
    if (active || process.getActiveResourcesInfo().length) nodeTick = self.setTimeout(tick, active ? 0 : 10);
  };
  nodeTick = self.setTimeout(tick, 0);
}
const replies = new Map();
const operations = {
  setup (rootDir, backendFile, env) {
    if (backend) throw new Error('Native backend worker is already configured');
    Object.assign(process.env, env);
    backend = require('node:module').createRequire(backendFile)(backendFile)(rootDir, {
      log: log => self.postMessage({ log }),
      onError: err => self.postMessage({ backendError: err.stack || String(err) })
    });
  },
  async initialize () { await backend.initialize(); },
  evaluate (source) { return backend.evaluate(source); },
  request (...args) { return backend.request(...args); },
  fileRead (url) { return backend.readFile(url); },
  send (message) {
    const sender = JSON.parse(message).sender;
    return backend.send(message, (event, reply) => {
      let replyId;
      if (reply) { replyId = ++nextReplyId; replies.set(replyId, { sender, reply }); }
      self.postMessage({ event, sender, replyId });
    });
  },
  reply (id, answer) {
    const entry = replies.get(id);
    replies.delete(id);
    entry?.reply(answer);
  },
  disconnect (sender) {
    backend.disconnect(sender);
    for (const [id, entry] of replies) if (entry.sender === sender) replies.delete(id);
  },
  async close () { await backend.close(); replies.clear(); }
};

self.onmessage = async ({ data: { id, method, args } }) => {
  active++;
  wakeNode();
  try {
    if (!Object.hasOwn(operations, method)) throw new Error('Unsupported native worker operation: ' + method);
    const result = await operations[method](...args);
    self.postMessage({ id, result });
  } catch (err) {
    self.postMessage({ id, error: { name: err.name, message: err.message, stack: err.stack, code: err.code } });
  } finally { active--; }
};
