/* global System, self */
import { allPlugins } from 'lively.serializer2/plugins.js';
import { serialize, deserialize } from 'lively.serializer2';
import { obj, string, properties, worker, promise } from 'lively.lang';
import { subscribe } from 'lively.notifications';
import { module } from 'lively.modules';
import { config } from 'lively.morphic';
import { stringifyFunctionWithoutToplevelRecorder } from 'lively.source-transform';

!System.get('@system-env').worker &&
config.ide.workerEnabled &&
!System.get('@lively-worker') &&
startWorker();

async function startWorker () {
  System.set('@lively-worker', System.newModule(initWorker()));
  let res;
  do {
    await promise.delay(1000);
    const objectPackages = {};
    for (const key in System._loader.modules) {
      if (key.includes('local://') || key.includes('lively://')) {
        // fetch modules that are initialized dynamically and do not
        // yet adhere to a well defined module versioning convention
        objectPackages[key] = module(key)._source;
      }
    }
    res = await callService('ensureModules', {
      loadedModules: Object.keys(System._loader.modules).filter(url => !url.includes('@')),
      sources: objectPackages
    }, false);
  } while (res.error);
}

/*
  System.get('@lively-worker').close(() => {
    System.set('@lively-worker', System.newModule(initWorker()))
    // also synchronize modules of the worker
   });
*/
function initWorker () {
  const w = worker.create({
    workerId: '@lively-worker',
    scriptsToLoad: [
      'lively.next-node_modules/babel-standalone/babel.js',
      'lively.next-node_modules/systemjs/dist/system.src.js',
      'lively.modules/dist/lively.modules.js',
      'lively.ide/jsdom.worker.js'
      // 'lively.ide/worker-init.js'
    ].map(url => System.baseURL + url)
  });
  w.eval('(' + stringifyFunctionWithoutToplevelRecorder(async function () {
    await lively.lang.promise.waitFor(5000, () => self.initialized);
    await System.import('lively-system-interface');
    await System.import('lively.ide/service-worker.js');
    const { resource } = await System.import('lively.resources');
    const { module, registerPackage } = await System.import('lively.modules');
    async function coldImport (moduleId, source) {
      // cold import
      const rec = resource(moduleId);
      if (!await rec.exists() && rec.localBackend) {
        // fetch source from indexDB and store it inside db;
        if (!source) {
          source = (await System._livelyModulesTranslationCache
            .fetchStoredModuleSource(moduleId) || {}).source;
        }
        if (source) { await rec.write(source); } else {
          console.log('No source available for ', moduleId);
        }
      }
      try {
        if (moduleId.includes('/package.json')) { registerPackage(moduleId.replace('/package.json', '')); }
        await module(moduleId).source(); // no need for evaluation
      } catch (e) {

      }
    }
    self.messenger.addServices({
      ensureModules: async function (msg, messenger) {
        const { loadedModules, sources = {} } = msg.data;
        for (const moduleId of loadedModules) {
          if (!System._loader.modules[moduleId]) {
            await coldImport(moduleId, sources[moduleId]);
          }
        }
        messenger.answer(msg, true);
      },
      updateModule: async function (msg, messenger) {
        const { module } = await System.import('lively.modules');
        const { module: moduleId, newSource } = msg.data;
        if (!System._loader.modules[moduleId]) {
          await coldImport(moduleId, newSource);
          messenger.answer(msg, true);
        } else {
          await module(moduleId).changeSource(newSource);
          messenger.answer(msg, true);
        }
      },
      loadModule: async function (msg, messenger) {
        const { module: moduleId, source } = msg.data;
        if (!System._loader.modules[moduleId]) {
          await coldImport(moduleId, source);
        }
        messenger.answer(msg, true);
      },
      freezeSnapshot: async function (msg, messenger) {

      },
      exportsOfModules: async function (msg, messenger) {
        const { localInterface } = await System.import('lively-system-interface');
        const { deserialize } = await System.import('lively.serializer2');
        const {
          livelySystem = localInterface,
          excludedPackages = [],
          progress
        } = deserialize(msg.data);
        await lively.lang.promise.waitFor(5000, () => !self.loadingModules);
        messenger.answer(msg, await livelySystem.exportsOfModules({
          excludedPackages,
          progress: progress && progress.asWorkerEndpoint(msg)
        }));
      },
      doSearch: async function (msg, messenger) {
        const { deserialize } = await System.import('lively.serializer2');
        const { doSearch } = await System.import('lively.ide/code-search.cp.js');
        const {
          excludedModules, excludedPackages, livelySystem, searchTerm,
          includeUnloaded, caseSensitive, loadedPackages, progress
        } = deserialize(msg.data);
        const res = await doSearch(
          livelySystem, searchTerm, excludedModules, excludedPackages,
          includeUnloaded, caseSensitive, progress && progress.asWorkerEndpoint(msg));
        messenger.answer(msg, res);
      }
    });
  }) + ')()', () => {});

  subscribe('lively.modules/moduleloaded', async (evt) => {
    callService('loadModule', {
      module: evt.module,
      source: await module(evt.module).source()
    }, false);
  });
  subscribe('lively.modules/modulechanged', (evt) =>
    callService('updateModule', evt, false));

  return w;
}

export async function callService (service, args, objectsInArguments = true) {
  // many services require that the packages are properly mirrored inside the
  // worker:
  const preparedArgs = objectsInArguments ? prepareArguments(args) : args;
  const progressMonitor = detectProgressMonitor(args);
  return new Promise((resolve, reject) =>
    System.get('@lively-worker')
      .sendTo('@lively-worker', service, preparedArgs,
        (err, answer) => {
          if (progressMonitor && answer.expectMoreResponses) { progressMonitor.step(answer.data.stepName, answer.data.progress); } else { resolve(answer.data); }
        }));
}

function detectProgressMonitor (args) {
  if (args && args.isProgressMonitor) return args;
  if (obj.isObject(args)) return obj.values(args).find(arg => arg && arg.isProgressMonitor);
}

export class ProgressMonitor {
  constructor ({ id = string.newUUID(), handlers = {} } = {}) {
    this.id = id; // in order to be identifiable across workers and main thread
    this.handlers = handlers;
  }

  get isProgressMonitor () { return true; }

  step (stepName, progress) {
    for (const handlerName in this.handlers) { this.handlers[handlerName](stepName, progress); }
  }

  disconnectFromWorker () {
    System.get('@lively-worker').removeAllListeners(this.id);
  }

  asWorkerEndpoint (msg) {
    const pm = new WorkerProgressMonitor({ id: this.id });
    pm.workerMessageObj = msg;
    return pm;
  }
}

// fixme: handle case when executed on remote eval server

export class WorkerProgressMonitor extends ProgressMonitor {
  get isWorkerEndpoint () { return true; }

  step (stepName, progress) {
    self.messenger.answer(this.workerMessageObj, { stepName, progress }, true);
  }
}

function prepareArguments (args) {
  return serialize(args, {
    plugins: [{
      serializeObject: (realObj, isProperty, pool, serializedObjMap, path) => {
        if (obj.isRegExp(realObj)) {
          return pool.expressionSerializer.exprStringEncode({
            __expr__: String(realObj)
          });
        }
        if (obj.isFunction(realObj)) {
          return pool.expressionSerializer.exprStringEncode({
            __expr__: String(realObj).replace('function ', 'function ' + '_lambda_')
          });
        }
      }
    }, ...allPlugins]
  });
}
