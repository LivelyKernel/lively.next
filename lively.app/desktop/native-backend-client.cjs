// The worker belongs to NW.js's persistent background page, not the dashboard.
const { pathToFileURL } = require('node:url');

module.exports = function createNativeBackendClient (rootDir, { createWorker, log = () => {}, onError = () => {} }) {
  let worker, started, ready, files, closing, failure;
  let nextId = 0;
  const pending = new Map();
  const requests = new Set();
  const clients = new Map();

  function failed (err) {
    if (failure) return;
    failure = err;
    for (const { reject } of pending.values()) reject(err);
    pending.clear();
    clients.clear();
    onError(err);
  }

  function post (method, args) {
    if (failure) return Promise.reject(failure);
    return new Promise((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, { resolve, reject });
      try { worker.postMessage({ id, method, args }); } catch (err) {
        pending.delete(id);
        reject(err);
      }
    });
  }

  function start () {
    return started ||= (async () => {
      worker = await createWorker();
      worker.onerror = event => {
        event.preventDefault();
        failed(new Error('Native backend worker failed: ' + event.message));
      };
      worker.onmessage = ({ data }) => {
        if (data.log) { log(data.log); return; }
        if (data.backendError) { onError(new Error(data.backendError)); return; }
        if (data.event) {
          clients.get(data.sender)?.(data.event, data.replyId === undefined ? undefined
            : answer => post('reply', [data.replyId, answer]).catch(onError));
          return;
        }
        const request = pending.get(data.id);
        if (!request) return;
        pending.delete(data.id);
        if (data.error) request.reject(Object.assign(new Error(data.error.message), data.error));
        else request.resolve(data.result);
      };
      await post('setup', [rootDir, require('node:path').join(__dirname, 'native-backend.cjs'), { ...process.env }]);
    })().catch(err => { failed(err); throw err; });
  }

  function call (method, args = []) {
    if (closing) return Promise.reject(new Error('Native desktop backend is closing'));
    const request = start().then(() => post(method, args));
    requests.add(request);
    return request.finally(() => requests.delete(request));
  }

  return {
    initialize () { return ready ||= call('initialize'); },
    fileExtension () {
      return files ||= (async () => {
        const { resourceExtension } = await import(pathToFileURL(rootDir + '/lively.resources/src/fs-resource.js').href);
        const baseURL = pathToFileURL(rootDir + '/').href;
        const virtualFiles = ['package-registry.json', '__JS_FILE_HASHES__', 'compressed-sources', 'import-map.json'];
        const isVirtual = url => url.startsWith(baseURL) && virtualFiles.includes(url.slice(baseURL.length).split('?')[0]);
        class DesktopFileResource extends resourceExtension.resourceClass {
          newResource (url) { return new this.constructor(url, this); }
          async exists () {
            if (virtualFiles.slice(0, 3).some(name => this.url === baseURL + name)) return true;
            return super.exists();
          }
          async read () {
            if (!isVirtual(this.url)) return super.read();
            const result = await call('fileRead', [this.url]);
            return typeof result === 'string' ? result : Buffer.from(result.buffer, result.byteOffset, result.byteLength);
          }
        }
        return { ...resourceExtension, resourceClass: DesktopFileResource };
      })();
    },
    evaluate (source) { return call('evaluate', [source]); },
    request (method, url, body) { return call('request', [method, url, body]); },
    send (message, receive) {
      if (closing || failure) return call('send', [message]);
      try { clients.set(JSON.parse(message).sender, receive); } catch (err) { return Promise.reject(err); }
      return call('send', [message]);
    },
    disconnect (sender) {
      clients.delete(sender);
      if (started && !closing) call('disconnect', [sender]).catch(onError);
    },
    close () {
      return closing ||= (async () => {
        await Promise.allSettled([...requests]);
        if (!started) return;
        await started;
        await post('close', []);
        clients.clear();
        worker.terminate();
      })();
    }
  };
};
