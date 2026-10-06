// Loaded in the background page's Node-enabled worker. Initialization starts
// with the first service request, while Chromium renders the dashboard.
const { createRequire } = require('node:module');
const { pathToFileURL } = require('node:url');

module.exports = function createNativeBackend (rootDir, { log = () => {}, onError = () => {} } = {}) {
  if (process.env.LIVELY_APP_SMOKE === '1') {
    const net = require('node:net');
    const path = require('node:path');
    const listen = net.Server.prototype.listen;
    net.Server.prototype.listen = function (endpoint, ...args) {
      if (typeof endpoint !== 'string' || !path.isAbsolute(endpoint) && !endpoint.startsWith('\\\\.\\pipe\\')) {
        throw new Error('Native desktop opened a TCP/HTTP listener');
      }
      return listen.call(this, endpoint, ...args);
    };
  }
  let ready, closing, shell, databases, storageReady;
  const pending = new Set();
  const clients = new Map();
  const sockets = new Set();
  let promptServer, promptEndpoint;
  const promptToken = require('node:crypto').randomBytes(24).toString('hex');

  async function startPrompts () {
    promptEndpoint = process.platform === 'win32'
      ? '\\\\.\\pipe\\lively-' + promptToken
      : require('node:path').join(require('node:os').tmpdir(), 'lively-' + process.pid + '-' + promptToken.slice(0, 8) + '.sock');
    promptServer = require('node:net').createServer(socket => {
      sockets.add(socket);
      socket.on('close', () => sockets.delete(socket));
      socket.on('error', () => socket.destroy());
      let text = '';
      socket.on('data', chunk => {
        text += chunk;
        if (text.length > 1024 * 1024) { socket.destroy(); return; }
        if (!text.includes('\n')) return;
        socket.removeAllListeners('data');
        try {
          const { token, message } = JSON.parse(text);
          if (token !== promptToken || !['ask for', 'open editor', 'changeWorkingDirectory'].includes(message?.action) || !clients.has(message.target)) {
            throw new Error('Invalid native prompt request');
          }
          clients.get(message.target)(JSON.stringify(message), answer => socket.end(answer + '\n'));
        } catch (err) { socket.end(JSON.stringify({ error: String(err) }) + '\n'); }
      });
    });
    await new Promise((resolve, reject) => { promptServer.once('error', reject); promptServer.listen(promptEndpoint, resolve); });
    if (process.platform !== 'win32') require('node:fs').chmodSync(promptEndpoint, 0o600);
  }
  function initializationFailed (err) {
    log('Native backend initialization failed: ' + (err.stack || err));
    onError(err);
    throw err;
  }

  function initialize () {
    return ready ||= (async () => {
      log('Native backend initializing');
      const require = createRequire(pathToFileURL(rootDir + '/lively.installer/install.js'));
      global.System = require('systemjs');
      System.set('@system-env', System.newModule({ node: true, browser: false, nw: false }));
      const { setupSystem } = await import(pathToFileURL(rootDir + '/lively.installer/install.js').href);
      const system = await setupSystem(rootDir, {
        name: 'desktop-backend', environment: { node: true, browser: false, nw: false }
      });
      log('Native package registry ready');
      const modules = await system.import('lively.modules');
      modules.changeSystem(system, true);
      modules.unwrapModuleResolution(system);
      modules.wrapModuleResolution(system);
      log('Native backend ready');
      return { system };
    })().catch(initializationFailed);
  }

  function initializeStorage (system) {
    return storageReady ||= (async () => {
      // Fail with the native loader's error before storage can fall back to memory.
      createRequire(pathToFileURL(rootDir + '/lively.storage/package.json'))('pouchdb');
      const storage = await system.import('lively.storage');
      databases = storage.Database.databases;
      // Never accept the generic storage layer's in-memory fallback here.
      const meta = storage.Database.ensureDB('internal__objectdb-meta');
      if (meta.pouchdb.adapter !== 'leveldb') throw new Error('Native desktop storage requires the persistent leveldb adapter');
      log('Native persistent storage ready');
      const { handleObjectDBRequest } = await system.import('lively.storage/objectdb-resource.js');
      return { ...storage, handleObjectDBRequest };
    })().catch(initializationFailed);
  }

  function run (operation) {
    if (closing) return Promise.reject(new Error('Native desktop backend is closing'));
    const request = initialize().then(operation);
    pending.add(request);
    return request.finally(() => pending.delete(request));
  }

  const backend = {
    initialize,
    async readFile (url) {
      const baseURL = pathToFileURL(rootDir + '/').href;
      if (url.split('?')[0] === baseURL + 'import-map.json') {
        await initialize();
        const { generateImportMap } = await import(pathToFileURL(rootDir + '/lively.server/plugins/lib-lookup.js').href);
        return JSON.stringify(await generateImportMap(new URL(url).searchParams.get('projectName')));
      }
      if (url === baseURL + 'package-registry.json') {
        const { system } = await initialize();
        return JSON.stringify(system.get('@lively-env').packageRegistry.toJSON());
      }
      if (url === baseURL + '__JS_FILE_HASHES__') {
        const { computeSourceHashes } = await import(pathToFileURL(rootDir + '/lively.server/source-hashes.js').href);
        return JSON.stringify(await computeSourceHashes(baseURL));
      }
      if (url === baseURL + 'compressed-sources') {
        return require('node:fs/promises').readFile(process.env.LIVELY_PREBUILT_LIBRARY_SNAPSHOT || rootDir + '/lively.server/.library-snapshot.tar.gz');
      }
      throw new Error('Unsupported native virtual file: ' + url);
    },
    evaluate (source) {
      return run(async () => {
        try { return JSON.stringify(await eval(source)); } catch (err) {
          return JSON.stringify({ isError: true, value: String(err.stack || err) });
        }
      });
    },
    send (message, receive) {
      return run(async ({ system }) => {
        shell ||= system.import('lively.shell/server-command.js').then(async ({ default: ServerCommand }) => {
          await startPrompts();
          const actions = {};
          ServerCommand.installLively2LivelyServices({ addService: (name, handler) => { actions[name] = handler; } });
          return { actions, ServerCommand };
        });
        const { actions } = await shell;
        const msg = JSON.parse(message);
        clients.set(msg.sender, receive);
        if (msg.action === 'lively.shell.spawn') {
          msg.data.env = { ...msg.data.env, LIVELY_NATIVE_PROMPT_ENDPOINT: promptEndpoint, LIVELY_NATIVE_PROMPT_TOKEN: promptToken };
        }
        if (!Object.hasOwn(actions, msg.action)) throw new Error('Unsupported native service: ' + msg.action);
        const tracker = {
          sendTo: (target, action, data) => clients.get(target)?.(JSON.stringify({ target, action, data }))
        };
        return new Promise((resolve, reject) => {
          Promise.resolve(actions[msg.action](tracker, msg, data => resolve(JSON.stringify({ data }))))
            .catch(reject);
        });
      });
    },
    disconnect (sender) { clients.delete(sender); },
    request (method, url, body) {
      return run(async ({ system }) => {
        const { handleObjectDBRequest, Database } = await initializeStorage(system);
        const result = await handleObjectDBRequest(method, url, body);
        if ([...Database.databases.values()].some(db => db.pouchdb.adapter !== 'leveldb')) {
          throw new Error('Native desktop storage requires persistent leveldb databases');
        }
        return result;
      });
    },
    close () {
      return closing ||= (async () => {
        await Promise.allSettled([...pending]);
        if (shell) {
          const initializedShell = await shell.catch(() => {});
          if (initializedShell) await Promise.allSettled(initializedShell.ServerCommand.commands.filter(cmd => cmd.isRunning()).map(cmd => cmd.kill()));
        }
        clients.clear();
        for (const socket of sockets) socket.destroy();
        if (promptServer) await new Promise(resolve => promptServer.close(resolve));
        if (!ready) return;
        const initialized = await ready.catch(() => {});
        if (!databases && initialized) {
          const storage = initialized.system.get(initialized.system.normalizeSync('lively.storage'));
          databases = storage?.Database.databases;
        }
        if (databases) await Promise.all([...databases.values()].map(db => db.close()));
      })();
    }
  };
  return backend;
};
