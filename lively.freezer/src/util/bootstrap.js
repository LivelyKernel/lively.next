/* global System */
import { resource, unregisterExtension, registerExtension, loadViaScript } from 'lively.resources';
import { string, obj } from 'lively.lang';
import * as modulePackage from 'lively.modules';
import { easings } from 'lively.morphic';
import { resourceExtension as partResourceExtension } from 'lively.morphic/partsbin.js';
import { adoptObject } from 'lively.lang/object.js';

lively.modules = modulePackage; // temporary modules package used for bootstrapping

const doBootstrap = true;
const askBeforeQuit = true;
const loc = document.location;
const query = resource(loc.href).query();
const fastLoad = query.fastLoad === true || window.FORCE_FAST_LOAD;
const extractedModules = {};

function polyfills () {
  const loads = [];
  if (!('PointerEvent' in window)) { loads.push(loadViaScript(resource(System.baseURL).join('/lively.next-node_modules/pepjs/dist/pep.js').url)); }
  if (!('fetch' in window)) { loads.push(loadViaScript('//cdnjs.cloudflare.com/ajax/libs/fetch/1.0.0/fetch.js')); }
  return Promise.all(loads);
}

function importPackageAndDo (packageURL, doFunc, li) {
  const name = packageURL.split('/').slice(-1)[0];
  li.label = `loading ${name}`;
  return lively.modules.importPackage(packageURL)
    .then(doFunc || function () {});
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

let loads = 0;
function installFetchHook (li) {
  function logFetch (proceed, load) {
    loads++;
    li.status = `loading ${string.truncateLeft(load.name.replace(window.System.baseURL, ''), 25, '...')}`;
    li.progress = loads / (800 - 4 * Object.keys(extractedModules).length);
    li.center = $world.innerBounds().center();
    return proceed(load);
  }
  window.__logFetch = logFetch;
  lively.modules.installHook('fetch', logFetch);
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
      if (loadConfig['lively.lang'] === 'frozen' || fastLoad) {
        const m = await System.import('lively.lang');
        extractModules('lively.lang');
        progress.finishPackage({ packageName: 'lively.lang', frozen: true });
        delete m._prevLivelyGlobal;
      }
      if (loadConfig['lively.ast'] === 'frozen' || fastLoad) {
        lively.ast = await System.import('lively.ast');
        extractModules('lively.ast');
        progress.finishPackage({ packageName: 'lively.ast', frozen: true });
      }
      if (loadConfig['lively.source-transform'] === 'frozen' || fastLoad) {
        lively.sourceTransform = await System.import('lively.source-transform');
        extractModules('lively.source-transform');
        progress.finishPackage({ packageName: 'lively.source-transform', frozen: true });
      }
      if (loadConfig['lively.classes'] === 'frozen' || fastLoad) {
        await System.import('lively.classes/object-classes.js');
        lively.classes = await System.import('lively.classes');
        extractModules('lively.class');
        progress.finishPackage({ packageName: 'lively.classes', frozen: true });
      }
      if (loadConfig['lively.vm'] === 'frozen' || fastLoad) {
        lively.vm = await System.import('lively.vm');
        extractModules('lively.vm');
        progress.finishPackage({ packageName: 'lively.vm', frozen: true });
      }
      if (loadConfig['lively.modules'] === 'frozen' || fastLoad) {
        // lively.modules is already fully imported due to the bootstrap, so no need to do that here
        await System.import('lively.modules');
        extractModules('lively.modules');
        progress.finishPackage({ packageName: 'lively.modules', frozen: true });
      }
      if (loadConfig['lively.user'] === 'frozen' || fastLoad) {
        await System.import('lively.user');
        await System.import('lively.user/morphic/user-ui.js');
        extractModules('lively.user');
        progress.finishPackage({ packageName: 'lively.user', frozen: true });
      }
      if (loadConfig['lively.storage'] === 'frozen' || fastLoad) {
        await System.import('lively.storage');
        extractModules('lively.storage');
        progress.finishPackage({ packageName: 'lively.storage', frozen: true });
      }
      if (loadConfig['lively.morphic'] === 'frozen' || fastLoad) {
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
      const baseURL = window.SYSTEM_BASE_URL || document.location.origin; // usually the server is located at the origin, but this can be overridden via this window var
      const oldSystem = window.System;
      let initBaseURL = oldSystem.baseURL;
      if (initBaseURL.endsWith('/')) {
        initBaseURL = initBaseURL.slice(0, -1);
      }
      const packageCached = await resource(baseURL).join('package-registry.json').readJson();
      await loadViaScript(resource(baseURL).join('/lively.next-node_modules/@babel/standalone/babel.js').url);
      await loadViaScript(resource(baseURL).join('/lively.next-node_modules/systemjs/dist/system.src.js').url);
      await loadViaScript(resource(baseURL).join('/lively.modules/systemjs-init.js').url);
      const System = lively.modules.getSystem('bootstrapped', { baseURL });
      lively.modules.changeSystem(System, true);
      System['__lively.modules__packageRegistry'] = lively.modules.PackageRegistry.fromJSON(System, packageCached);
      for (const mod in extractedModules) {
        const realignedId = mod.replace(initBaseURL, baseURL);
        System.set(realignedId, System.newModule(extractedModules[mod]));
        const m = lively.modules.module(realignedId);
        m._recorder = extractedModules[mod];
        m._frozenModule = true;
      }
      oldSystem.config({ baseURL }); // this system keeps lurking around inside lively.modules somehow, so this fixes that issue for the time being
      installFetchHook(li);
    })
    .then(async function () {
      if (loadConfig['lively.lang'] === 'dynamic' && !fastLoad) {
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
      progress.animate({ opacity: 1, easing: easings.outExpo });
      if (loadConfig['lively.ast'] === 'dynamic' && !fastLoad) {
        return importPackageAndDo(
          'lively.ast',
          function (m) {
            progress.finishPackage({ packageName: 'lively.ast', loaded: true });
            lively.ast = m;
          },
          li);
      }
    }).then(async function () {
      if (loadConfig['lively.source-transform'] === 'dynamic' && !fastLoad) {
        return importPackageAndDo(
          'lively.source-transform',
          function (m) {
            progress.finishPackage({ packageName: 'lively.source-transform', loaded: true });
            lively.sourceTransform = m;
          }, li);
      }
    }).then(async function () {
      if (loadConfig['lively.classes'] === 'dynamic' && !fastLoad) {
        return importPackageAndDo(
          'lively.classes',
          function (m) {
            progress.finishPackage({ packageName: 'lively.classes', loaded: true });
            lively.classes = m;
          }, li);
      }
    }).then(async function () {
      if (loadConfig['lively.vm'] === 'dynamic' && !fastLoad) {
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
      if (loadConfig['lively.modules'] === 'frozen' || fastLoad) {
        System._scripting = lively.modules.scripting;
      } else {
        await importPackageAndDo('lively.modules', afterImport, li);
      }
      progress.finishPackage({ packageName: 'lively.modules', loaded: true });
    })
    .then(async function () {
      if (loadConfig['lively.user'] === 'dynamic' && !fastLoad) {
        return importPackageAndDo(
          'lively.user',
          function (m) {
            progress.finishPackage({ packageName: 'lively.user', loaded: true });
            lively.user = m;
          },
          li);
      }
    }).then(async function () {
      if (loadConfig['lively.storage'] === 'dynamic' && !fastLoad) {
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

function fastPrepLivelySystem (li) {
  return Promise.resolve()
    .then(function () { li.status = 'starting fast system preparation...'; })
    .then(function () { return resource(System.baseURL).join('package-registry.json').readJson(); })
    .then(function (packageCached) {
      System['__lively.modules__packageRegistry'] = lively.modules.PackageRegistry.fromJSON(System, packageCached);
      return System;
    })
    .then(function () { return loadViaScript(resource(System.baseURL).join('/lively.user/dist/lively.user-client.js').url); });
}

export async function bootstrap ({ filePath, worldName, snapshot, commit, loadingIndicator: li, progress, logError = (err) => console.log(err) }) {
  try {
    const loadConfig = JSON.parse(localStorage.getItem('lively.load-config') || '{"lively.lang":"dynamic","lively.ast":"dynamic","lively.source-transform":"dynamic","lively.classes":"dynamic","lively.vm":"dynamic","lively.modules":"dynamic","lively.user":"dynamic","lively.storage":"dynamic","lively.morphic":"dynamic"}');
    li.center = progress.bottomCenter;
    await polyfills();
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
    if (loadConfig['lively.morphic'] === 'dynamic' && !fastLoad) {
      li.label = 'Loading lively.morphic...';
      morphic = await lively.modules.importPackage('lively.morphic');
      progress.finishPackage({ packageName: 'lively.morphic', loaded: true });
    } else {
      morphic = lively.morphic;
    }

    li.label = 'Loading world...';
    window.onresize = null;
    window.loadCompiledFrozenPart = lively.modules.module('lively.morphic/partsbin.js')._recorder.loadPart;
    unregisterExtension('part');
    registerExtension(partResourceExtension);
    unregisterExtension('styleguide');
    lively.FreezerRuntime = false;
    const landingPageUrl = document.location;
    window.worldLoadingIndicator = li;
    try {
      const opts = {
        root: $world.env.renderer.rootNode,
        verbose: true,
        localconfig: true,
        l2l: true,
        shell: true,
        moduleManager: lively.modules
      };
      if (snapshot) {
        let World, loadMorphFromSnapshot, loadWorld;
        if (!snapshot.startsWith('http')) snapshot = resource(System.baseURL).join(snapshot).url;
        ({ World } = await lively.modules.module('lively.morphic/world.js').recorder);
        ({ loadWorld } = await lively.modules.module('lively.morphic/world-loading.js').recorder);
        ({ loadMorphFromSnapshot } = await lively.modules.module('lively.morphic/serialization.js').recorder);
        const m = await loadMorphFromSnapshot(await resource(snapshot).readJson());
        const w = await loadWorld(new World({ showsUserFlap: false, extent: $world.extent }), undefined, opts);
        w.addMorph(m);
        w.onWindowResize();
      } else if (commit) {
        await morphic.World.loadFromCommit(commit, undefined, {
          ...opts,
          browserURL: '/worlds/load?name=' + commit.name
        });
      } else if (worldName) {
        if (worldName === '__newWorld__') {
          let LivelyWorld, loadWorld;
          if (Object.values(loadConfig).every(v => v === 'frozen') || fastLoad) {
            ({ LivelyWorld } = await lively.modules.module('lively.ide/world.js').recorder);
            ({ loadWorld } = await lively.modules.module('lively.morphic/world-loading.js').recorder);
          } else {
            ({ LivelyWorld } = await lively.modules.System.import('lively.ide/world.js'));
            ({ loadWorld } = await lively.modules.System.import('lively.morphic/world-loading.js'));
          }
          await loadWorld(new LivelyWorld({ openNewProjectPrompt: true }), undefined, opts);
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

    progress.finishPackage({ packageName: 'world', loaded: true });
    progress.fadeIntoBack();

    window.addEventListener('popstate', (event) => {
      if (document.location === landingPageUrl) { document.location.reload(); }
    });
    // lively.modules.removeHook('fetch', 'logFetch');
    // to this only once world has finished loading
    await $world.whenReady();
    li.remove();
    await oldEnv.renderer.worldMorph.whenRendered();
    if (loadConfig['lively.morphic'] === 'dynamic' && !fastLoad) {
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
