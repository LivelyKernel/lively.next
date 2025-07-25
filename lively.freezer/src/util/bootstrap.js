/* eslint-disable no-console */
/* global System */
import { resource, loadViaScript } from 'lively.resources';
import { promise, obj, arr } from 'lively.lang';
import * as modulePackage from 'lively.modules';
import { adoptObject } from 'lively.lang/object.js';
import { Color } from 'lively.graphics/color.js';
import { install as installHook } from 'lively.modules/src/hooks.js';
import { updateBundledModules } from 'lively.modules/src/module.js';
import { Project } from 'lively.project/project.js';
import { pathForBrowserHistory } from 'lively.morphic/helpers.js';
import { installLinter } from 'lively.ide/js/linter.js';
import { setupBabelTranspiler } from 'lively.source-transform/babel/plugin.js'; 
import untar from 'esm://cache/js-untar';
import bowser from 'bowser';

if (bowser.safari) {
  let r = document.querySelector(':root');
  r.style.setProperty('--annotation-spacing', '0%');
}

lively.modules = modulePackage; // temporary modules package used for bootstrapping

Object.defineProperty(lively, 'isInOfflineMode', {
  configurable: true,
  get () {
    const item = localStorage.getItem('LIVELY_OFFLINE_MODE');
    return item == true; // eslint-disable-line eqeqeq
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
      extractedModules[id] = lively.FreezerRuntime.exportsOf(id);
    });
}

function extractModules (packageName) {
  Object.keys(lively.FreezerRuntime.registry)
    .filter(k => k.startsWith(packageName))
    .forEach(id => {
      extractedModules[resource(System.baseURL).join(id).url] = lively.FreezerRuntime.exportsOf(id);
    });
}

async function fastLoadPackages (progress) {
  progress?.showInfiniteProgress();
  // lively.lang
  const m = await System.import('lively.lang');
  extractModules('lively.lang');
  delete m._prevLivelyGlobal;

  // lively.ast
  lively.ast = await System.import('lively.ast');
  extractModules('lively.ast');

  // lively.source-transform
  lively.sourceTransform = await System.import('lively.source-transform');
  extractModules('lively.source-transform');

  // lively.classes
  await System.import('lively.classes/object-classes.js');
  lively.classes = await System.import('lively.classes');
  extractModules('lively.class');

  // lively.vm
  lively.vm = await System.import('lively.vm');
  extractModules('lively.vm');

  // lively.modules is already fully imported due to the bootstrap, so no need to do that here
  extractModules('lively.modules');

  // lively.storage
  await System.import('lively.storage');
  extractModules('lively.storage');

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

  // lively.project
  await System.import('lively.project');
  extractModules('lively.project');

  // lively.collab
  await System.import('lively.collab');
  extractModules('lively.collab');

  // lively.git
  await System.import('lively.git');
  extractModules('lively.git');

  // lively.freezer
  await System.import('lively.freezer');
  extractModules('lively.freezer');

  extractModules('lively.user');

  // extract any esm modules that have been loaded on the go
  extractEsmModules();
}

function installFetchHook () {
  function logFetch (proceed, load) {
    return proceed(load);
  }
  window.__logFetch = logFetch;
  lively.modules.installHook('fetch', logFetch);
}

function logInfo (...info) {
  console.log('%c' + info[0], `color: white; background: ${Color.darkGray}; border-radius: 10px; padding: 1px 4px;`, ...info.slice(1));
}

async function shallowReloadModulesIfNeeded (modulesToCheck, moduleHashes, R) {
  const modsToReload = [];
  for (let modId of modulesToCheck) {
    const modHash = R.registry[modId]?.recorder.__module_hash__;
    let key = modId;
    let currMod;
    if (key === '@empty') continue;
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
  return arr.uniq(modsToReload);
}

const baseURL = window.SYSTEM_BASE_URL || document.location.origin; // usually the server is located at the origin, but this can be overridden via this window var
function bootstrapLivelySystem (progress, fastLoad = query.fastLoad !== false || window.FORCE_FAST_LOAD) {
  lively.wasFastLoaded = fastLoad;
  // for loading an instrumented version of the packages comprising the lively.system
  return Promise.resolve()
    .then(async function () {
      // fixme: still expensive fetching of index.js files when registering each package on deserialization
      // fixme: freeze halos, components and lively.ide stuff to further speed up performance
      // before resetting systemjs, load all frozen modules
      if (fastLoad) {
        const timeToLoadBundle = await promise.timeToRun(await fastLoadPackages(progress));
        logInfo('Loading bundles:', timeToLoadBundle + 'ms');
      } else {
        lively.memory_esm = await untar(await resource(baseURL).join('compressed-sources').beBinary(true).read());
        lively.memory_esm = new Map(lively.memory_esm.map(ea => [ea.name, ea]));
      }
    })
    .then(async function () {
      // setup system
      let ts = Date.now();
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

      installLinter(System);
      setupBabelTranspiler(System);
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
          .filter(pkg => !pkg.constructor[Symbol.for('lively-object-meta')]?.moduleSource)
          .forEach(pkg => {
            adoptObject(pkg, instrumentedPackageClass);
          });

        const loadedModules = Object.values(System['__lively.modules__loadedModules']);
        const instrumentedModuleInterface = lively.modules.module('lively.modules/src/module.js').recorder.ModuleInterface;
        loadedModules
          .filter(mod => !mod.constructor[Symbol.for('lively-object-meta')]?.moduleSource)
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
        progress?.finishPackage({ packageName: 'lively.modules', loaded: true });
      }
      logInfo('Loaded module system:', Date.now() - ts + 'ms');

      const R = lively.FreezerRuntime;
      const moduleHashes = await resource(System.baseURL).join('__JS_FILE_HASHES__').readJson();
      if (fastLoad) {
        ts = Date.now();
        // revive the modules where the hashes differ from the ones on the bundle
        modsToReload.push(...await shallowReloadModulesIfNeeded(obj.keys(R.registry), moduleHashes, R));
      }
      if (modsToReload.length > 0) {
        updateBundledModules(System, arr.uniq(modsToReload))
          .then(() => { logInfo('Revived changed modules:', Date.now() - ts + 'ms'); })
          .then(() => {
          // finally wrap the import that re-triggers the revival in case new bundle parts come into play
            const S = R.oldSystem;
            installHook(S, 'import', async (proceed, args) => {
              const modsToReload = [];
              const keysBefore = obj.keys(R.registry);
              const mod = await proceed(args);
              const keysAfter = obj.keys(R.registry);
              if (keysBefore.length < keysAfter.length) {
                // detect modules to be reloaded
                const modulesToUpdate = arr.withoutAll(keysAfter, keysBefore).filter(id => !id.startsWith('esm://'));
                for (const mod of modulesToUpdate) {
                  System.set(System.decanonicalize(mod), System.newModule(R.exportsOf(mod)));
                  const m = lively.modules.module(mod);
                  m._recorder = R.registry[mod].recorder;
                  m._frozenModule = true;
                }
                updateBundledModules(S, await shallowReloadModulesIfNeeded(modulesToUpdate, moduleHashes, R));
              }
              return mod;
            });
          });
      }
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
    if (projectName && projectName !== '__newProject__') {
      if (!lively.isInOfflineMode) {
        Project.fetchInfoPreflight(projectName);
      }
    }
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
          document.body.style.background = 'black';
          // place the background into the new world
          // if we are not in fast load, we need to import
          // the landing-page module manually for the copy
          // to succeed.
          await eval('System.import(\'lively.freezer/src/loading-screen.cp.js\')');
          await eval('System.import(\'lively.freezer/src/landing-page.cp.js\')');
          $world.opacity = 1;

          if (!fastLoad) {
            progress?.finishPackage({ packageName: 'world', loaded: true });
            if (progress) progress.opacity = 0;
            oldEnv.renderer.worldMorph.opacity = 0;
            oldEnv.renderer.renderStep();
            await oldEnv.renderer.clear();
            oldEnv.fontMetric.uninstall();
            oldEnv.eventDispatcher.uninstall();
          }

          const bg = $world.addMorph(progress.get('background').copy());
          bg.fit();
          const fader = bg.addMorph({ fill: Color.black, opacity: 0, extent: bg.extent });
          await fader.animate({ opacity: 1, duration: 500 });
          $world.initializeStudio();
          bg.hasFixedPosition = true;
          bg.bringToFront();
          bg.fadeOut();
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
        if (window.history) {
          const path = pathForBrowserHistory(filePath).replaceAll('%2F', '/');
          window.history.pushState({}, 'lively.next', path);
        }
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
