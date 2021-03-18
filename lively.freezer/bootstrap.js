/* global System */
import { resource, loadViaScript } from 'lively.resources';
import { promise, string, obj } from 'lively.lang';
import * as modulePackage from 'lively.modules';
import { easings } from 'lively.morphic';
import { adoptObject } from 'lively.classes/runtime.js';
import { Color } from 'lively.graphics';

lively.modules = modulePackage; // temporary modules package used for bootstrapping

const loginDone = true; const doBootstrap = true; const askBeforeQuit = true; let worldLoaded = false;

export async function bootstrap ({ worldName, commit, loadingIndicator: li, progress, logError = (err) => console.log(err) }) {
  try {
    const loadConfig = JSON.parse(localStorage.getItem('lively.load-config') || '{}');
    progress.opacity = 0;
    progress.hasFixedPosition = true;
    progress.openInWorld();
    progress.bottomCenter = li.topCenter;
    await polyfills();
    const loads = 0;
    const oldEnv = $world.env;
    doBootstrap ? await bootstrapLivelySystem(li, progress, loadConfig) : await fastPrepLivelySystem(li);
    li.label = 'Loading lively.2lively...';
    await lively.modules.registerPackage('lively.2lively');
    if (askBeforeQuit) {
      window.addEventListener('beforeunload', function (evt) {
        const msg = 'Really?';
        evt.returnValue = msg;
        return msg;
      }, true);
    }

    let morphic;
    if (loadConfig['lively.morphic'] == 'dynamic') {
      li.label = 'Loading lively.morphic...';
      morphic = await lively.modules.importPackage('lively.morphic');
      progress.finishPackage({ packageName: 'lively.morphic', loaded: true });
    } else {
      morphic = lively.morphic;
    }

    li.label = 'Loading world...';
    window.onresize = null;
    window.loadCompiledFrozenPart = lively.modules.module('lively.morphic/partsbin.js')._recorder.loadPart;
    lively.FreezerRuntime = false;
    const landingPageUrl = document.location;
    try {
      const opts = {
        verbose: true,
        localconfig: true,
        l2l: true,
        shell: true
      };
      if (commit) {
        await morphic.World.loadFromCommit(commit, undefined, {
          ...opts,
          browserURL: '/worlds/load?name=' + commit.name
        });
      } else if (worldName) {
        await morphic.World.loadFromDB(worldName, undefined, undefined, {
          ...opts,
          browserURL: '/worlds/load?name=' + worldName.replace(/\.json($|\?)/, '')
        });
      }
    } catch (err) {

    }
    window.addEventListener('popstate', (event) => {
      if (document.location == landingPageUrl) { document.location.reload(); }
    });
    li.remove();
    worldLoaded = true;
    lively.modules.removeHook('fetch', 'logFetch');
    await oldEnv.renderer.worldMorph.whenRendered();
    if (loadConfig['lively.morphic'] == 'dynamic') {
      oldEnv.renderer.clear();
      oldEnv.fontMetric.uninstall();
      oldEnv.eventDispatcher.uninstall();
    }
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

function fastPrepLivelySystem (li) {
  return Promise.resolve()
    .then(function () { li.status = 'starting fast system preparation...'; })
    .then(function () { return resource(System.baseURL).join('package-registry.json').readJson(); })
    .then(function (packageCached) {
      System['__lively.modules__packageRegistry'] = lively.modules.PackageRegistry.fromJSON(System, packageCached);
      return System;
    })
    .then(function () { return loadViaScript('/lively.user/dist/lively.user-client.js'); });
}

let loads = 0;
function installFetchHook (li) {
  lively.modules.installHook('fetch', function logFetch (proceed, load) {
    loads++;
    li.status = `loading ${string.truncateLeft(load.name.replace(window.System.baseURL, ''), 25, '...')}`;
    li.progress = loads / (800 - 4 * Object.keys(extractedModules).length);
    li.center = $world.innerBounds().center();
    return proceed(load);
  });
}

const extractedModules = {};

function extractModules (packageName) {
  Object.keys(lively.FreezerRuntime.registry)
    .filter(k => k.startsWith(packageName))
    .forEach(id => {
      extractedModules[window.origin + '/' + id] = {
        ...lively.FreezerRuntime.registry[id].exports
      };
    });
}

async function loadComponents () {
  await System.import('lively.ide/world.js');
  await System.import('lively.ide/editor-plugin.js');
  await System.import('lively.ide/js/editor-plugin.js');
  await System.import('lively.shell/index.js');
  await System.import('lively.shell/client-command.js');
  await System.import('lively.shell/client-resource.js');
  await System.import('lively.bindings');
  extractModules('lively.bindings');
  extractModules('lively.shell');
  extractModules('lively.ide');
  extractModules('lively.components');
}

function bootstrapLivelySystem (li, progress, loadConfig) {
  // for loading an instrumented version of the packages comprising the lively.system
  return Promise.resolve()
    .then(function () { li.status = 'starting bootstrap process...'; })
    .then(async function () {
      // fixme: still expensive fetching of index.js files when registering each package on deserialization
      // fixme: freeze halos, components and lively.ide stuff to further speed up performance

      await progress.whenRendered();
      // before resetting systemjs, load all frozen modules
      if (loadConfig['lively.lang'] == 'frozen') {
        const m = await System.import('lively.lang');
        extractModules('lively.lang');
        progress.finishPackage({ packageName: 'lively.lang', frozen: true });
        delete m._prevLivelyGlobal;
      }
      if (loadConfig['lively.ast'] == 'frozen') {
        lively.ast = await System.import('lively.ast');
        extractModules('lively.ast');
        progress.finishPackage({ packageName: 'lively.ast', frozen: true });
      }
      if (loadConfig['lively.source-transform'] == 'frozen') {
        lively.sourceTransform = await System.import('lively.source-transform');
        extractModules('lively.source-transform');
        progress.finishPackage({ packageName: 'lively.source-transform', frozen: true });
      }
      if (loadConfig['lively.classes'] == 'frozen') {
        await System.import('lively.classes/object-classes.js');
        lively.classes = await System.import('lively.classes');
        extractModules('lively.class');
        progress.finishPackage({ packageName: 'lively.classes', frozen: true });
      }
      if (loadConfig['lively.vm'] == 'frozen') {
        lively.vm = await System.import('lively.vm');
        extractModules('lively.vm');
        progress.finishPackage({ packageName: 'lively.vm', frozen: true });
      }
      if (loadConfig['lively.modules'] == 'frozen') {
        // lively.modules is already fully imported due to the bootstrap, so no need to do that here
        await System.import('lively.modules');
        extractModules('lively.modules');
        progress.finishPackage({ packageName: 'lively.modules', frozen: true });
      }
      if (loadConfig['lively.user'] == 'frozen') {
        await System.import('lively.user');
        await System.import('lively.user/morphic/user-ui.js');
        extractModules('lively.user');
        progress.finishPackage({ packageName: 'lively.user', frozen: true });
      }
      if (loadConfig['lively.storage'] == 'frozen') {
        await System.import('lively.storage');
        extractModules('lively.storage');
        progress.finishPackage({ packageName: 'lively.storage', frozen: true });
      }
      if (loadConfig['lively.morphic'] == 'frozen') {
        await System.import('lively.resources');
        extractModules('lively.resources');
        await System.import('lively.2lively/client.js');
        await System.import('lively.2lively/index.js');
        extractModules('lively.2lively');
        await System.import('lively.serializer2');
        extractModules('lively.serializer2');
        await loadComponents();
        await System.import('lively.halos');
        extractModules('lively.halos');
        await System.import('lively-system-interface');
        extractModules('lively-system-interface');
        await System.import('lively.graphics/index.js');
        extractModules('lively.graphics');
        lively.morphic = await System.import('lively.morphic/index.js');
        extractModules('lively.morphic');
        progress.finishPackage({ packageName: 'lively.morphic', frozen: true });
      }
    })
    .then(async function () {
      const packageCached = await resource(System.baseURL).join('package-registry.json').readJson();
      await loadViaScript('/lively.next-node_modules/babel-standalone/babel.js');
      await loadViaScript('/lively.next-node_modules/systemjs/dist/system.src.js');
      window.System.config({ baseURL: document.location.origin });
      await loadViaScript('/lively.modules/systemjs-init.js');
      const System = lively.modules.getSystem('bootstrapped', { baseURL: document.location.origin });
      // System.debug = true;
      lively.modules.changeSystem(System, true);
      System['__lively.modules__packageRegistry'] = lively.modules.PackageRegistry.fromJSON(System, packageCached);
      for (const mod in extractedModules) {
        System.set(mod, System.newModule(extractedModules[mod]));
        const m = lively.modules.module(mod);
        m._recorder = extractedModules[mod];
        m._frozenModule = true;
      }
      installFetchHook(li);
    })
    .then(async function () {
      if (loadConfig['lively.lang'] == 'dynamic') {
        return importPackageAndDo(
          'lively.lang',
          function (m) {
            progress.finishPackage({ packageName: 'lively.lang', loaded: true });
            delete m._prevLivelyGlobal;
          },
          li
        );
      }
    }).then(async function () {
      progress.animate({ opacity: 1, easing: easings.outExpo, duration: 300 });
      if (loadConfig['lively.ast'] == 'dynamic') {
        return importPackageAndDo(
          'lively.ast',
          function (m) {
            progress.finishPackage({ packageName: 'lively.ast', loaded: true });
            lively.ast = m;
          },
          li);
      }
    }).then(async function () {
      if (loadConfig['lively.source-transform'] == 'dynamic') {
        return importPackageAndDo(
          'lively.source-transform',
          function (m) {
            progress.finishPackage({ packageName: 'lively.source-transform', loaded: true });
            lively.sourceTransform = m;
          }, li);
      }
    }).then(async function () {
      if (loadConfig['lively.classes'] == 'dynamic') {
        return importPackageAndDo(
          'lively.classes',
          function (m) {
            progress.finishPackage({ packageName: 'lively.classes', loaded: true });
            lively.classes = m;
          }, li);
      }
    }).then(async function () {
      if (loadConfig['lively.vm'] == 'dynamic') {
        return importPackageAndDo(
          'lively.vm',
          function (m) {
            progress.finishPackage({ packageName: 'lively.vm', loaded: true });
            lively.vm = m;
          }, li);
      }
    }).then(async function () {
      function afterImport (m) {
        lively.modules = m;
        lively.modules.unwrapModuleLoad();
        lively.modules.unwrapModuleResolution();
        lively.modules.wrapModuleLoad();
        lively.modules.wrapModuleResolution();
        installFetchHook(li);
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
      if (loadConfig['lively.modules'] == 'frozen') {
        System._scripting = lively.modules.scripting;
      } else {
        await importPackageAndDo('lively.modules', afterImport, li);
      }
      progress.finishPackage({ packageName: 'lively.modules', loaded: true });
    })
    .then(async function () {
      if (loadConfig['lively.user'] == 'dynamic') {
        return importPackageAndDo(
          'lively.user',
          function (m) {
            progress.finishPackage({ packageName: 'lively.user', loaded: true });
            lively.user = m;
          },
          li);
      }
    }).then(async function () {
      if (loadConfig['lively.storage'] == 'dynamic') {
        return importPackageAndDo(
          'lively.storage',
          function (m) {
            progress.finishPackage({ packageName: 'lively.storage', loaded: true });
            lively.storage = m;
          },
          li);
      }
    });
}

function importPackageAndDo (packageURL, doFunc, li) {
  const name = packageURL.split('/').slice(-1)[0];
  li.label = `loading ${name}`;
  return lively.modules.importPackage(packageURL)
    .then(doFunc || function () {});
}

function polyfills () {
  const loads = [];
  if (!('PointerEvent' in window)) { loads.push(loadViaScript(`${document.location.origin}/lively.next-node_modules/pepjs/dist/pep.js`)); }
  if (!('fetch' in window)) { loads.push(loadViaScript('//cdnjs.cloudflare.com/ajax/libs/fetch/1.0.0/fetch.js')); }
  return Promise.all(loads);
}
