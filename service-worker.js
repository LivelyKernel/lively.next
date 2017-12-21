/*global System, self*/
import { allPlugins } from "lively.serializer2/plugins.js";
import { serialize, deserialize } from "lively.serializer2";
import { obj, string, properties, worker, promise } from "lively.lang";
import { subscribe } from "lively.notifications/index.js";
import { module } from "lively.modules/index.js";
import { config } from "lively.morphic";

!System.get('@system-env').worker 
&& !System.get('@lively-worker') 
&& System.set('@lively-worker', System.newModule(initWorker()));

/* 
  System.get('@lively-worker').close(() => {
    System.set('@lively-worker', System.newModule(initWorker()))
    // also synchronize modules of the worker
   });
*/

function initWorker() {
  let w = worker.create({
    workerId: '@lively-worker',
    scriptsToLoad: [
      'lively.next-node_modules/babel-standalone/babel.js',
      'lively.next-node_modules/systemjs/dist/system.src.js',
      'lively.modules/dist/lively.modules.js',
      'lively.ide/jsdom.worker.js',
      'lively.ide/worker-init.js'
    ].map(url => System.baseURL + url)
  });
  w.eval("(" + String(async function() {
   await lively.lang.promise.waitFor(5000, () => self.initialized);
   await System.import('lively-system-interface');
   await System.import('lively.ide/service-worker.js');
   self.messenger.addServices({
     tokenizeDocument: async function(msg, messenger) {
       let {deserialize, serialize} = await System.import('lively.serializer2'),
           {tokenizeDocument} = await System.import('lively.ide/editor-modes.js'),
           {document, fromRow, toRow, validBeforePos} = deserialize(msg.data),
           {Text} = await System.import('lively.morphic/text/morph.js'),
           dummyText = new Text({textString: document});
       await dummyText.changeEditorMode('js');
       messenger.answer(msg, serialize(tokenizeDocument(dummyText.editorPlugin.mode, dummyText.document, fromRow, toRow, validBeforePos)));
     },
     updateModule: async function(msg, messenger) {
       let {module} = await System.import('lively.modules');
       let {module: moduleId, newSource} = msg.data;
       if (!System._loader.modules[moduleId]) {
          messenger.sendTo(
             messenger.id(), 'loadModule', 
            {module: moduleId, source: newSource},
            () => messenger.answer(msg, true))       
       } else {
          await module(moduleId).changeSource(newSource) 
          messenger.answer(msg, true);
       }
     },
     loadModule: async function(msg, messenger) {
       let {resource} = await System.import('lively.resources'),
           {module, loadedModules, registerPackage} = await System.import('lively.modules'),
           {module: moduleId, source} = msg.data;
       if (!loadedModules[moduleId]) {
          // cold import
          let rec = resource(moduleId);
          if (!await rec.exists() && rec.localBackend) {
            // fetch source from indexDB and store it inside db;
            if (!source)
               source = (await System._livelyModulesTranslationCache.fetchStoredModuleSource(moduleId) || {}).source;
            if (source)
              await rec.write(source);
            else {
              console.log('No source available for ', moduleId);
            }
          }
         try {
            if (moduleId.includes('/package.json'))
              registerPackage(moduleId.replace('/package.json', ''));
            await module(moduleId).source() // no need for evaluation              
         } catch(e) {
           
         }
       }
       messenger.answer(msg, true);
     },
     freezeSnapshot: async function(msg, messenger) {
       let { FreezerPart } = await System.import('lively.freezer/part.js'),
           {deserialize} = await System.import('lively.serializer2'),
           {resource} = await System.import('lively.resources'),
           {snapshot, path, progress} = deserialize(msg.data),
           frozenPart = await FreezerPart.fromSnapshot(JSON.parse(snapshot));
       messenger.answer(msg, await frozenPart.standalone({progress: progress && progress.asWorkerEndpoint(msg)}));
     },
     exportsOfModules: async function(msg, messenger) {
       let {localInterface} = await System.import('lively-system-interface'),
           {deserialize} = await System.import('lively.serializer2'),
           {livelySystem = localInterface, excludedPackages = [], progress} = deserialize(msg.data);
       messenger.answer(msg, await livelySystem.exportsOfModules({
         excludedPackages, progress: progress && progress.asWorkerEndpoint(msg)}))
     },
     doSearch: async function (msg, messenger) {
       let {deserialize} = await System.import('lively.serializer2'),
           {doSearch} = await System.import("lively.ide/code-search.js"),
           {excludedModules, excludedPackages, livelySystem, searchTerm,
            includeUnloaded, caseSensitive, loadedPackages, progress} = deserialize(msg.data),
           res = await doSearch(
           livelySystem, searchTerm, excludedModules, excludedPackages,
           includeUnloaded, caseSensitive, progress && progress.asWorkerEndpoint(msg));
         messenger.answer(msg, res);
     }
   })
  }).split('__lvVarRecorder.').join('') + ')()', () => {});

  subscribe("lively.modules/moduleloaded", async (evt) => {
      callService('loadModule', {
        module: evt.module, 
        source: await module(evt.module).source()
      }, false);
  });
  subscribe("lively.modules/modulechanged", (evt) => 
      callService('updateModule', evt, false));
  
  return w;
}


export async function callService(service, args, objectsInArguments = true) {
  // many services require that the packages are properly mirrored inside the
  // worker:
  let preparedArgs = objectsInArguments ? prepareArguments(args) : args,
      progressMonitor = detectProgressMonitor(args);
  return new Promise((resolve, reject) => 
    System.get('@lively-worker')
          .sendTo('@lively-worker', service, preparedArgs, 
                   (err, answer) => {
                      if (progressMonitor && answer.expectMoreResponses) 
                        progressMonitor.step(answer.data.stepName, answer.data.progress);
                      else
                        resolve(answer.data)}))
}

function detectProgressMonitor(args) {
  if (args && args.isProgressMonitor) return args;
  if (obj.isObject(args)) return Object.values(args).find(arg => arg && arg.isProgressMonitor);
}

export class ProgressMonitor {

  constructor({id = string.newUUID(), handlers = {}} = {}) {
    this.id = id; // in order to be identifiable across workers and main thread
    this.handlers = handlers;
  }

  get isProgressMonitor() { return true }

  step(stepName, progress) {
     for (let handlerName in this.handlers) 
       this.handlers[handlerName](stepName, progress);
  }

  disconnectFromWorker() {
    System.get('@lively-worker').removeAllListeners(this.id);
  }

  asWorkerEndpoint(msg) {
    let pm = new WorkerProgressMonitor({id: this.id});
    pm.workerMessageObj = msg;
    return pm;
  }
  
}

export class WorkerProgressMonitor extends ProgressMonitor {

  get isWorkerEndpoint() { return true }

  step(stepName, progress) {
    self.messenger.answer(this.workerMessageObj, {stepName, progress}, true);
  }
  
}

function prepareArguments(args) {
  return serialize(args, {
    plugins: [{
      serializeObject: (realObj, isProperty, pool, serializedObjMap, path) => {
           if (obj.isRegExp(realObj)) {
             return pool.expressionSerializer.exprStringEncode({
                __expr__: String(realObj)
             })
           }
           if (obj.isFunction(realObj)) {
             return pool.expressionSerializer.exprStringEncode({
                __expr__: String(realObj).replace('function ', 'function ' + '_lambda_')
             })
           }
       }}, ...allPlugins]
  });
}