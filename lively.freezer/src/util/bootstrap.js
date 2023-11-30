/* global System */
import { resource, unregisterExtension, registerExtension, loadViaScript } from 'lively.resources';
import { string, promise, obj } from 'lively.lang';
import * as modulePackage from 'lively.modules';
import { easings } from 'lively.morphic';
import { adoptObject } from 'lively.lang/object.js';
import { Color } from 'lively.graphics/color.js';

lively.modules = modulePackage; // temporary modules package used for bootstrapping

Object.defineProperty(lively, 'isInOfflineMode', {
  configurable: true,
  get () {
    const item = localStorage.getItem('LIVELY_OFFLINE_MODE');
    return item == true;
  }
});

const doBootstrap = true;
const askBeforeQuit = true;
const loc = document.location;
const query = resource(loc.href).query();
const extractedModules = {};

function polyfills () {
  const loads = [];
  if (!('PointerEvent' in window)) { loads.push(loadViaScript(resource(System.baseURL).join('/lively.next-node_modules/pepjs/dist/pep.js').url)); }
  if (!('fetch' in window)) { loads.push(loadViaScript('//cdnjs.cloudflare.com/ajax/libs/fetch/1.0.0/fetch.js')); }
  return Promise.all(loads);
}

function importPackageAndDo (packageURL, doFunc, li = null) {
  const name = packageURL.split('/').slice(-1)[0];
  if (li) li.label = `loading ${name}`;
  return lively.modules.importPackage(packageURL)
    .then(doFunc || function () {});
}

function extractEsmModules () {
  Object.keys(lively.FreezerRuntime.registry)
    .filter(k => k.startsWith('esm://'))
    .forEach(id => {
      extractedModules[id] = {
        ...lively.FreezerRuntime.registry[id].exports
      };
    });
}

function extractModules (packageName) {
  Object.keys(lively.FreezerRuntime.registry)
    .filter(k => k.startsWith(packageName))
    .forEach(id => {
      extractedModules[resource(System.baseURL).join(id).url] = {
        ...lively.FreezerRuntime.registry[id].exports
      };
    });
}

async function fastLoadPackages (progress) {
  // lively.lang
  const m = await System.import('lively.lang');
  extractModules('lively.lang');
  progress?.finishPackage({ packageName: 'lively.lang', frozen: true });
  delete m._prevLivelyGlobal;

  // lively.ast
  lively.ast = await System.import('lively.ast');
  extractModules('lively.ast');
  progress?.finishPackage({ packageName: 'lively.ast', frozen: true });

  // lively.source-transform
  lively.sourceTransform = await System.import('lively.source-transform');
  extractModules('lively.source-transform');
  progress?.finishPackage({ packageName: 'lively.source-transform', frozen: true });

  // lively.classes
  await System.import('lively.classes/object-classes.js');
  lively.classes = await System.import('lively.classes');
  extractModules('lively.class');
  progress?.finishPackage({ packageName: 'lively.classes', frozen: true });

  // lively.vm
  lively.vm = await System.import('lively.vm');
  extractModules('lively.vm');
  progress?.finishPackage({ packageName: 'lively.vm', frozen: true });

  // lively.modules is already fully imported due to the bootstrap, so no need to do that here
  extractModules('lively.modules');
  progress?.finishPackage({ packageName: 'lively.modules', frozen: true });

  // lively.storage
  await System.import('lively.storage');
  extractModules('lively.storage');
  progress?.finishPackage({ packageName: 'lively.storage', frozen: true });

  // lively.resources
  await System.import('lively.resources');
  extractModules('lively.resources');

  // lively.2lively
  await System.import('lively.2lively/client.js');
  await System.import('lively.2lively/index.js');
  extractModules('lively.2lively');

  // lively.serializer2
  await System.import('lively.serializer2');
  extractModules('lively.serializer2');

  // lively.ide
  await System.import('lively.ide/world.js');
  await System.import('lively.ide/editor-plugin.js');
  await System.import('lively.ide/js/editor-plugin.js');
  extractModules('lively.ide');

  // lively.shell
  await System.import('lively.shell/index.js');
  await System.import('lively.shell/client-command.js');
  await System.import('lively.shell/client-resource.js');
  extractModules('lively.shell');

  // lively.bindings
  await System.import('lively.bindings');
  extractModules('lively.bindings');

  // lively.components
  extractModules('lively.components');

  // lively.halos
  await System.import('lively.halos');
  extractModules('lively.halos');

  // lively-system-interface
  await System.import('lively-system-interface');
  extractModules('lively-system-interface');

  // lively.graphics
  await System.import('lively.graphics');
  extractModules('lively.graphics');

  // lively.morphic
  lively.morphic = await System.import('lively.morphic');
  extractModules('lively.morphic');
  progress?.finishPackage({ packageName: 'lively.morphic', frozen: true });

  // lively.project
  await System.import('lively.project');
  extractModules('lively.project');

  // lively.freezer
  await System.import('lively.freezer');
  extractModules('lively.freezer');

  // extract any esm modules that have been loaded on the go
  extractEsmModules();
}

let loads = 0;
function installFetchHook () {
  function logFetch (proceed, load) {
    loads++;
    return proceed(load);
  }
  window.__logFetch = logFetch;
  lively.modules.installHook('fetch', logFetch);
}

function logInfo (...info) {
  console.log('%c' + info[0], `color: white; background: ${Color.darkGray}; border-radius: 10px; padding: 1px 4px;`, ...info.slice(1));
}

function bootstrapLivelySystem (progress, fastLoad = query.fastLoad !== false || window.FORCE_FAST_LOAD) {
  lively.wasFastLoaded = fastLoad;
  // for loading an instrumented version of the packages comprising the lively.system
  return Promise.resolve()
    .then(async function () {
      // fixme: still expensive fetching of index.js files when registering each package on deserialization
      // fixme: freeze halos, components and lively.ide stuff to further speed up performance
      await progress?.whenRendered();
      // before resetting systemjs, load all frozen modules
      if (fastLoad) {
        const timeToLoadBundle = await promise.timeToRun(await fastLoadPackages(progress));
        logInfo('Loading bundles:', timeToLoadBundle + 'ms');
      }
    })
    .then(async function () {
      // setup system
      let ts = Date.now();
      const baseURL = window.SYSTEM_BASE_URL || document.location.origin; // usually the server is located at the origin, but this can be overridden via this window var
      const oldSystem = lively.FreezerRuntime.oldSystem = window.System;
      let initBaseURL = oldSystem.baseURL;
      if (initBaseURL.endsWith('/')) {
        initBaseURL = initBaseURL.slice(0, -1);
      }
      const packageCached = await resource(baseURL).join('package-registry.json').readJson();
      await loadViaScript(resource(baseURL).join('/lively.next-node_modules/@babel/standalone/babel.js').url);
      const migratedMeta = { ...oldSystem.meta };
      const System = lively.modules.getSystem('bootstrapped', { baseURL, meta: migratedMeta }); // the meta of the not yet loaded modules needs to be transformed into register
      $world.env.uninstallSystemChangeHandlers();
      lively.modules.changeSystem(System, true);
      $world.env.installSystemChangeHandlers();

      await loadViaScript(resource(baseURL).join('/lively.modules/systemjs-init.js').url);
      logInfo('Setup SystemJS:', Date.now() - ts + 'ms');

      // load packages
      ts = Date.now();
      System['__lively.modules__packageRegistry'] = lively.modules.PackageRegistry.fromJSON(System, packageCached);
      for (const mod in extractedModules) {
        const realignedId = mod.replace(initBaseURL, baseURL);
        System.set(realignedId, System.newModule(extractedModules[mod]));
        const m = lively.modules.module(realignedId);
        m._recorder = extractedModules[mod];
        // denote the exports
        m._frozenModule = true;
      }
      oldSystem.config({ baseURL }); // this system keeps lurking around inside lively.modules somehow, so this fixes that issue for the time being
      installFetchHook();
      logInfo('Load package info:', Date.now() - ts + 'ms');
    })
    .then(async function () {
      if (!fastLoad) {
        await importPackageAndDo(
          'lively.lang',
          function (m) {
            progress?.finishPackage({ packageName: 'lively.lang', loaded: true });
            delete m._prevLivelyGlobal;
          }
        );
        if (progress) progress.opacity = 1;
        await importPackageAndDo(
          'lively.ast',
          function (m) {
            progress?.finishPackage({ packageName: 'lively.ast', loaded: true });
            lively.ast = m;
          });
        await importPackageAndDo(
          'lively.source-transform',
          function (m) {
            progress?.finishPackage({ packageName: 'lively.source-transform', loaded: true });
            lively.sourceTransform = m;
          });
        await importPackageAndDo(
          'lively.classes',
          function (m) {
            progress?.finishPackage({ packageName: 'lively.classes', loaded: true });
            lively.classes = m;
          });
        await importPackageAndDo(
          'lively.vm',
          function (m) {
            progress?.finishPackage({ packageName: 'lively.vm', loaded: true });
            lively.vm = m;
          });
      }
    }).then(async function () {
      function afterImport (m) {
        lively.modules = m;
        lively.modules.unwrapModuleResolution();
        lively.modules.wrapModuleResolution();
        installFetchHook();
        const oldRegistry = System['__lively.modules__packageRegistry'];
        delete System['__lively.modules__packageRegistry'];
        const newRegistry = System['__lively.modules__packageRegistry'] = m.PackageRegistry.ofSystem(System);
        Object.assign(newRegistry, obj.select(oldRegistry, ['packageMap', 'individualPackageDirs', 'devPackageDirs', 'packageBaseDirs']));
        newRegistry.resetByURL();

        // All Module and Package objects that were instantiated
        // during bootstrapping still have the non instrumented
        // prototypes.
        // Since re-importing all of these affected packages with the
        // now fully instrumented module system would be too time consuming
        // it is faster to just walk through all module and package objects
        // and adopt each to use the instrumented version of the module and package class.

        // Note, that although the module and packacke classes themselves require the adjustemnt
        // the objects and classes of the packages *themselves* do not need that update. They
        // already went through the instrumentation, since that has also happened in the
        // static version of lively.modules that these came from.
        const loadedPackages = newRegistry.allPackages();
        const instrumentedPackageClass = lively.modules.module('lively.modules/src/packages/package.js').recorder.Package;
        loadedPackages
          .filter(pkg => !pkg.constructor[Symbol.for('lively-module-meta')])
          .forEach(pkg => {
            adoptObject(pkg, instrumentedPackageClass);
          });

        const loadedModules = Object.values(System['__lively.modules__loadedModules']);
        const instrumentedModuleInterface = lively.modules.module('lively.modules/src/module.js').recorder.ModuleInterface;
        loadedModules
          .filter(mod => !mod.constructor[Symbol.for('lively-module-meta')])
          .forEach(mod => {
            adoptObject(mod, instrumentedModuleInterface);
          });
      }
      let ts = Date.now();
      const modsToReload = [];
      let currMod;
      if (fastLoad) {
        System._scripting = lively.modules.scripting;
        if (fastLoad) {
          const newSystem = System;
          newSystem.loads = {};
          currMod = lively.modules.module('lively.modules');
          modsToReload.push(...await currMod.revive(false)); // this should also reload some of the bundles
          (await newSystem.import('lively.modules')).changeSystem(newSystem, true);
        }
      } else {
        await importPackageAndDo('lively.modules', afterImport);
      }
      logInfo('Loaded module system:', Date.now() - ts + 'ms');
      progress?.finishPackage({ packageName: 'lively.modules', loaded: true });
      if (fastLoad) {
        ts = Date.now();
        // revive the modules where the hashes differ from the ones on the bundle
        const R = lively.FreezerRuntime;
        const moduleHashes = await resource(System.baseURL).join('__JS_FILE_HASHES__').readJson();
        for (let modId in R.registry) {
          const modHash = R.registry[modId]?.recorder.__module_hash__;
          let key = modId;
          if (key.startsWith('esm://')) continue; // do not revive esm modules
          if (modHash !== moduleHashes['/' + key]) {
            console.log('reviving', modId);
            currMod = lively.modules.module(modId);
            try {
            	modsToReload.push(...await currMod.revive(false));
            } catch (err) {
	            console.log('failed reviving', modId);
            }
          }
        }
      }
      if (modsToReload.length > 0) currMod.updateBundledModules([...new Set(modsToReload)]).then(() => { logInfo('Revived changed modules:', Date.now() - ts + 'ms'); });
    })
    .then(async function () {
      if (!fastLoad) {
        return importPackageAndDo(
          'lively.storage',
          function (m) {
            progress?.finishPackage({ packageName: 'lively.storage', loaded: true });
            lively.storage = m;
          });
      }
    });
}

function fastPrepLivelySystem () {
  return Promise.resolve()
    .then(function () { return resource(System.baseURL).join('package-registry.json').readJson(); })
    .then(function (packageCached) {
      System['__lively.modules__packageRegistry'] = lively.modules.PackageRegistry.fromJSON(System, packageCached);
      return System;
    });
}

export async function bootstrap ({
  filePath, worldName, projectName, snapshot, commit, progress,
  fastLoad = query.fastLoad !== false || window.FORCE_FAST_LOAD,
  logError = (err) => console.log(err)
}) {
  try {
    await polyfills();
    const oldEnv = $world.env;
    doBootstrap ? await bootstrapLivelySystem(progress, fastLoad) : await fastPrepLivelySystem();
    await lively.modules.registerPackage('lively.2lively');
    if (askBeforeQuit) {
      window.addEventListener('beforeunload', function (evt) {
        const msg = 'Really?';
        evt.returnValue = msg;
        return msg;
      }, true);
    }

    let morphic;
    if (!fastLoad) {
      morphic = await lively.modules.importPackage('lively.morphic');
      progress?.finishPackage({ packageName: 'lively.morphic', loaded: true });
    } else {
      morphic = lively.morphic;
    }

    window.onresize = null;
    if (lively.isResurrectionBuild) {
      lively.frozenModules = lively.FreezerRuntime;
    }
    lively.FreezerRuntime = false;
    const landingPageUrl = document.location;
    try {
      const opts = {
        root: $world.env.renderer.bodyNode,
        verbose: true,
        localconfig: true,
        l2l: true,
        shell: true,
        moduleManager: lively.modules,
        onRenderStart: async () => {
          document.body.style.background = 'white';
          if (!fastLoad) {
            progress?.finishPackage({ packageName: 'world', loaded: true });
            if (progress) progress.opacity = 0;
            oldEnv.renderer.worldMorph.opacity = 0;
            oldEnv.renderer.renderStep();
            await oldEnv.renderer.clear();
            oldEnv.fontMetric.uninstall();
            oldEnv.eventDispatcher.uninstall();
          }
          $world.initializeStudio();
          $world.animate({ opacity: 1 });
        }
      };
      if (snapshot) {
        let World, loadMorphFromSnapshot, loadWorld;
        if (!snapshot.startsWith('http')) snapshot = resource(System.baseURL).join(snapshot).url;
        ({ World } = await lively.modules.module('lively.morphic/world.js').recorder);
        ({ loadWorld } = await lively.modules.module('lively.morphic/world-loading.js').recorder);
        ({ loadMorphFromSnapshot } = await lively.modules.module('lively.morphic/serialization.js').recorder);
        const m = await loadMorphFromSnapshot(await resource(snapshot).readJson());
        const w = await loadWorld(new World({ askForName: false, extent: $world.extent }), undefined, opts);
        w.addMorph(m);
        w.onWindowResize();
      } else if (commit) {
        await morphic.World.loadFromCommit(commit, undefined, {
          ...opts,
          browserURL: '/worlds/load?name=' + commit.name
        });
      } else if (worldName || projectName) {
        if (worldName === '__newWorld__' || projectName) {
          let LivelyWorld, loadWorld;
          if (fastLoad) {
            ({ LivelyWorld } = await lively.modules.module('lively.ide/world.js').recorder);
            ({ loadWorld } = await lively.modules.module('lively.morphic/world-loading.js').recorder);
          } else {
            ({ LivelyWorld } = await lively.modules.System.import('lively.ide/world.js'));
            ({ loadWorld } = await lively.modules.System.import('lively.morphic/world-loading.js'));
          }
          if (worldName) await loadWorld(new LivelyWorld({ openNewWorldPrompt: true }), undefined, opts);
          else if (projectName === '__newProject__') await loadWorld(new LivelyWorld({ openNewProjectPrompt: true }), undefined, opts);
          else await loadWorld(new LivelyWorld({ projectToBeOpened: projectName }), undefined, opts);
        } else {
          await morphic.World.loadFromDB(worldName, undefined, undefined, {
            ...opts,
            browserURL: '/worlds/load?name=' + worldName.replace(/\.json($|\?)/, '')
          });
        }
      } else if (filePath) {
        await morphic.World.loadFromResource(
          resource(System.baseURL).join(filePath),
          undefined, {
            ...opts,
            browserURL: '/worlds/load?file=' + filePath
          }
        );
      }
    } catch (err) {
      window.__loadError__ = err;
    }

    window.addEventListener('popstate', (event) => {
      if (document.location === landingPageUrl) { document.location.reload(); }
    });
  } catch (err) {
    if (err.originalErr) err = err.originalErr; // do not hide vital information!
    let printed = err.message;
    if (err.stack !== err.message) {
      printed += err.stack.includes(err.message) ? err.stack.replace(err.message, '\n') : err.stack;
    }
    logError(printed);
    throw err;
  }
}
