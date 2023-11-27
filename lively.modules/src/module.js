import { arr, obj, graph, string } from 'lively.lang';
import { parse, query } from 'lively.ast';
import { computeRequireMap } from './dependencies.js';
import { moduleSourceChange } from './change.js';
import { scheduleModuleExportsChange, runScheduledExportChanges } from './import-export.js';
import { livelySystemEnv } from './system.js';
import { Package } from './packages/package.js';
import { isURL } from './url-helpers.js';
import { emit, subscribe } from 'lively.notifications';
import { defaultClassToFunctionConverterName } from 'lively.vm';
import { runtime as classRuntime } from 'lively.classes';
import { ImportInjector, GlobalInjector, ImportRemover } from './import-modification.js';
import { _require, _resolve } from './nodejs.js';
import { classHolder } from './cycle-breaker.js';
import { regExpEscape } from 'lively.lang/string.js';

export const detectModuleFormat = (function () {
  const esmFormatCommentRegExp = /['"]format (esm|es6)['"];/;
  const cjsFormatCommentRegExp = /['"]format cjs['"];/;
  // Stolen from SystemJS
  const esmRegEx = /(^\s*|[}\);\n]\s*)(import\s+(['"]|(\*\s+as\s+)?[^"'\(\)\n;]+\s+from\s+['"]|\{)|export\s+\*\s+from\s+["']|export\s+(\{|default|function|class|var|const|let|async\s+function))/;

  return (source, metadata) => {
    if (metadata && metadata.format) {
      if (metadata.format === 'es6') metadata.forma === 'esm';
      return metadata.format;
    }

    if (esmFormatCommentRegExp.test(source.slice(0, 5000)) ||
     !cjsFormatCommentRegExp.test(source.slice(0, 5000)) && esmRegEx.test(source)) { return 'esm'; }

    if (cjsFormatCommentRegExp.test(source.slice(0, 5000))) { return 'cjs'; }

    return 'global';
  };
})();

export default function module (System, moduleName, parent) {
  const sysEnv = livelySystemEnv(System);
  const id = System.decanonicalize(moduleName, parent);
  return sysEnv.loadedModules[id] || (sysEnv.loadedModules[id] = new ModuleInterface(System, id)); // eslint-disable-line no-use-before-define
}

classHolder.module = module;

export function isModuleLoaded (System, name, isNormalized = false) {
  const sysEnv = livelySystemEnv(System);
  const id = isNormalized ? name : System.normalizeSync(name);
  return id in sysEnv.loadedModules;
}

function getImportersOfModule (System, rec) {
  return Object.values(System.loads)
    .filter(r => !r.key.endsWith('.json'))
    .map(r => Object.values(r.depMap).find(url => url === rec.key) && ModuleInterface.sanitizeRecord(r, System))
    .filter(Boolean);
}

export async function doesModuleExist (System, name, isNormalized = false) {
  const id = isNormalized ? name : System.normalizeSync(name);
  if (isModuleLoaded(System, id, true)) return true;
  const p = Package.forModuleId(System, id);
  return !p || p.name === 'no group'/* FIXME */
    ? System.resource(id).exists()
    : await p.hasResource(id);
}

const globalProps = { initialized: false, descriptors: {} };

// ModuleInterface is primarily used to provide an API that integrates the System
// loader state with lively.modules extensions.
// It does not hold any mutable state.
class ModuleInterface {
  constructor (System, id) {
    // We assume module ids to be a URL with a scheme

    if (!isURL(id) && !/^@/.test(id)) { throw new Error(`ModuleInterface constructor called with ${id} that does not seem to be a fully normalized module id.`); }
    this.System = System;
    this.id = id;

    // Under what variable name the recorder becomes available during module
    // execution and eval
    this.recorderName = '__lvVarRecorder';
    this.sourceAccessorName = '__lvOriginalCode';
    this._recorder = null;

    // cached values
    this._source = null;
    this._ast = null;
    this._scope = null;
    this._observersOfTopLevelState = [];

    this._evaluationsInProgress = 0;
    this._evalId = 1;

    this.createdAt = this.lastModifiedAt = new Date();

    subscribe('lively.modules/modulechanged', data => {
      if (data.module === this.id) this.reset();
    });
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // properties
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  // returns Promise<string>
  fullName () { return this.id; }
  shortName () { return this.package() ? `${this.package().name}/${this.pathInPackage()}` : this.fullName(); }
  get isModule () { return true; }

  source () {
    // returns Promise<string>

    // rk 2016-06-24:
    // We should consider using lively.resource here. Unfortunately
    // System.fetch (at least with the current systemjs release) will not work in
    // all cases b/c modules once loaded by the loaded get cached and System.fetch
    // returns "" in those cases
    //
    // cs 2016-08-06:
    // Changed implementation, so it uses System.resource to be consistent
    // with module loading

    if (this.id === '@empty') return Promise.resolve('');

    if (this._source) return Promise.resolve(this._source);

    return this.System.resource(this.id).read()
      .then(source => this._source = source);
  }

  setSource (source) {
    /* rms 3.1.17: There appear to be situations where the module system tries to
       set the source to the transformed form instead of the original ES6 format.
       I have not traced down the reason for this, but this check will prevent that
       a module's transformed source will be set to its original source by scanning
       the source string for the recorder and sourceAccessor variables.      */
    if (this.sourceAccessorName && this.recorderName &&
      source.includes('var ' + this.recorderName) && source.includes('var ' + this.sourceAccessorName)) { return; }
    if (this._source === source) return;
    this.reset();
    this._source = source;
  }

  async ast () {
    if (this._ast) return this._ast;
    return this._ast = parse(await this.source());
  }

  async scope () {
    if (this._scope) return this._scope;
    const ast = await this.ast();
    return this._scope = query.topLevelDeclsAndRefs(ast).scope;
  }

  async resolvedScope () {
    return this._scope = query.resolveReferences(await this.scope());
  }

  metadata () {
    const load = this.System.REGISTER_INTERNAL?.records ? this.System.REGISTER_INTERNAL.records[this.id] : null;
    return load ? load.metadata : null;
  }

  addMetadata (addedMeta) {
    const { System, id } = this;
    const oldMeta = this.metadata();
    const meta = oldMeta ? Object.assign(oldMeta, addedMeta) : addedMeta;
    System.config({ meta: { [id]: meta } });
    return System.meta[id];
  }

  format () {
    // assume esm by default
    const meta = this.metadata();
    if (meta && meta.load.format) return meta.load.format;
    if (this._source) return detectModuleFormat(this._source);
    return 'global';
  }

  setFormat (format) {
    // assume esm by default
    return this.addMetadata({ format });
  }

  reset () {
    this._source = null;
    this._ast = null;
    this._scope = null;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // loading
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  get () {
    // opts = {format, instrument}
    const { id, System } = this;
    return System.get(id);
  }

  async load (opts) {
    // opts = {format, instrument}
    const { id, System } = this;
    opts && this.addMetadata(opts);
    return System.get(id) || await System.import(id);
  }

  isLoaded () { return !!this.System.get(this.id); }

  unloadEnv () {
    this._recorder = null;
    this._observersOfTopLevelState = [];
    // FIXME this shouldn't be necessary anymore....
    delete livelySystemEnv(this.System).loadedModules[this.id];
  }

  unloadDeps (opts) {
    opts = obj.merge({ forgetDeps: true, forgetEnv: true }, opts);
    this.dependents().forEach(ea => {
      this.System.delete(ea.id);
      if (this.System.loads) delete this.System.loads[ea.id];
      if (opts.forgetEnv) ea.unloadEnv();
    });
  }

  async unload (opts) {
    opts = { reset: true, forgetDeps: true, forgetEnv: true, ...opts };
    const { System, id } = this;
    if (opts.reset) this.reset();
    if (opts.forgetDeps) this.unloadDeps(opts);
    this.System.delete(id);
    if (System.loads) {
      delete System.loads[id];
    }
    if (System.meta) { delete System.meta[id]; }
    if (opts.forgetEnv) { this.unloadEnv(); }

    const cache = System._livelyModulesTranslationCache;
    if (cache) await cache.deleteCachedData(id);

    emit('lively.modules/moduleunloaded', { module: this.id }, Date.now(), this.System);
  }

  async reload (opts) {
    opts = obj.merge({ reloadDeps: true, resetEnv: true }, opts);
    let toBeReloaded = [this];
    if (opts.reloadDeps) toBeReloaded = this.dependents().concat(toBeReloaded);
    await this.unload({ forgetDeps: opts.reloadDeps, forgetEnv: opts.resetEnv });
    await Promise.all(toBeReloaded.map(ea => ea.id !== this.id && ea.load()));
    await this.load();
  }

  getFrozenRecord () {
    // if we are not in fastLoad then return null;
    return typeof lively !== 'undefined' && lively.wasFastLoaded && (lively.FreezerRuntime || lively.frozenModules)?.registry[this.shortName()];
  }

  async refreshFrozenRecord (frozenRecord) {
    const livelyRecord = this.System.get('@lively-env').moduleEnv(this.id).recorder;
    const newEntries = obj.select(livelyRecord, arr.compact((await this.exports()).map(m => m.local)));
    // also inject the new values into the record in order to update the bundle

    Object.assign(frozenRecord.recorder, newEntries); // how do we preveny this from being overridden again?
  }

  async revive (autoReload = true) {
    if (!this._frozenModule) return []; // no need to do
    // prepare the already existing recorder obejct to contain the required callbacks
    // then just perform a plain reload
    await this.reload({ reloadDeps: false }); // this removes the module from the system for some reason
    const S = (lively.FreezerRuntime || lively.frozenModules).oldSystem;
    S.skipInstantiation = true;
    const frozenRecord = this.getFrozenRecord();
    await this.refreshFrozenRecord(frozenRecord);
    frozenRecord.isRevived = true;
    frozenRecord.recorder.__revived__ = true;
    // trigger the reload of the bundle for the snippet this recorder is located in
    // after that trigger the importer setters and then also reload these modules as well (within the bundle)
    // this process needs to be repeated for every time this module is updated, not just upon revival.
    if (autoReload) await this.updateBundledModules([frozenRecord.contextModule]);
    this._frozenModule = false;
    return [frozenRecord.contextModule];
  }

  async updateBundledModules (modulesToUpdate) {
    const { oldSystem: S, registry } = lively.FreezerRuntime || lively.frozenModules;
    for (let m of modulesToUpdate) {
      let mod = S['__lively.modules__loadedModules'][m];
      if (!mod) {
        S.delete(m);
        await S.import(m);
        mod = S['__lively.modules__loadedModules'][m] || module(S, m);
      }
      await mod.reload();
      S['__lively.modules__loadedModules'][m] = mod; // ensure module stays here even when the source and initialization are skipped.
    }
    // finally update the frozen records that require update
    for (let m in registry) {
      if (registry[m].updateRecord) {
        const realignedId = m.startsWith('esm://') ? m : string.joinPath(System.baseURL, m);
        const mod = module(this.System, realignedId);
        if (!mod._frozenModule) continue;
        this.System.set(realignedId, System.newModule(registry[m].exports));
        mod._recorder = registry[m].recorder;
      }
    }
  }

  async copyTo (newId) {
    const moduleRecord = this.System.get(this.id);
    const state = obj.select(this, [
      '_observersOfTopLevelState',
      '_scope',
      '_ast',
      '_source',
      '_recorder',
      'sourceAccessorName',
      'recorderName'
    ]);
    await this.System.resource(newId).write(await this.source());
    const {
      System,
      _recorder,
      _source,
      _ast,
      _scope,
      _observersOfTopLevelState
    } = this;
    const newM = module(System, newId);
    if (state._recorder) { state._recorder[newM.varDefinitionCallbackName] = state._recorder[this.varDefinitionCallbackName]; }
    Object.assign(newM, state);
    System.set(newId, System.newModule(moduleRecord));
    return newM;
  }

  async renameTo (newId, opts = {}) {
    const { unload = true, removeFile = true } = opts;
    const newM = await this.copyTo(newId);

    if (unload) { await this.unload({ reset: true, forgetDeps: false, forgetEnv: true }); }

    if (removeFile) { await this.System.resource(this.id).remove(); }

    return newM;
  }

  whenLoaded (cb) {
    if (this.isLoaded()) {
      try { cb(this); } catch (e) { console.error(e); }
      return;
    }
    livelySystemEnv(this.System).onLoadCallbacks.push(
      { moduleName: this.id, resolved: true, callback: cb });
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // change
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  changeSourceAction (changeFunc) {
    return Promise.resolve(this.source())
      .then(oldSource => changeFunc(oldSource))
      .then(newSource => this.changeSource(newSource));
  }

  changeSource (newSource, options) {
    options = { doSave: true, doEval: true, ...options };
    const { System, id } = this; const format = this.format(); let result;
    this.reset();
    this.lastModifiedAt = new Date();
    this.System._livelyModulesTranslationCache?.deleteCachedData(this.id);
    return Promise.all([
      options.doSave && this.System.resource(id).write(newSource),
      options.doEval && moduleSourceChange(
        System, id, newSource, format, options)
        .then(_result => result = _result)
        .then(async () => {
          const frozenRecord = this.getFrozenRecord();
          if (frozenRecord) {
            await this.refreshFrozenRecord(frozenRecord);
            await this.updateBundledModules([frozenRecord.contextModule]);
          }
        })
    ]).then(() => result);
  }

  addDependencyToModuleRecord (dependency, setter = function () {}) {
    // `dependency is another module, setter is the function that gets
    // triggered when a dependency's binding changes so that "this" module is updated
    const record = this.record();
    const dependencyRecord = dependency.record();

    if (record && dependencyRecord) {
      // 1. update the record so that when its dependencies change and cause a
      // re-execute, the correct code (new version) is run
      let depIndex; const hasDepenency = record.dependencies.some((ea, i) => {
        if (!ea) return; depIndex = i; return ea && ea.name === dependency.id;
      });
      if (!hasDepenency) {
        record.dependencies.push(dependencyRecord);
      } else if (dependencyRecord !== record.dependencies[depIndex] /* happens when a dep is reloaded */) { record.dependencies.splice(depIndex, 1, dependencyRecord); }

      // setters are for updating module bindings, the position of the record
      // in dependencies should be the same as the position of the setter for that
      // dependency...
      if (!hasDepenency || !record.setters[depIndex]) { record.setters[hasDepenency ? depIndex : record.dependencies.length - 1] = setter; }

      // 2. update records of dependencies, so that they know about this module as an importer
      let impIndex; const hasImporter = dependencyRecord.importers.some((imp, i) => {
        if (!imp) return; impIndex = i; return imp && imp.name === this.id;
      });
      if (!hasImporter) dependencyRecord.importers.push(record);
      else if (record !== dependencyRecord.importers[impIndex]) { dependencyRecord.importers.splice(impIndex, 1, record); }
    }
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // dependencies
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  dependents () {
    // which modules (module ids) are (in)directly import module with id
    // Let's say you have
    // module1: export var x = 23;
    // module2: import {x} from "module1.js"; export var y = x + 1;
    // module3: import {y} from "module2.js"; export var z = y + 1;
    // `dependents` gives you an answer what modules are "stale" when you
    // change module1 = module2 + module3
    return graph.hull(graph.invert(computeRequireMap(this.System)), this.id)
      .map(mid => module(this.System, mid));
  }

  requirements () {
    // which modules (module ids) are (in)directly required by module with id
    // Let's say you have
    // module1: export var x = 23;
    // module2: import {x} from "module1.js"; export var y = x + 1;
    // module3: import {y} from "module2.js"; export var z = y + 1;
    // `module("./module3").requirements()` will report ./module2 and ./module1
    return graph.hull(computeRequireMap(this.System), this.id)
      .map(mid => module(this.System, mid));
  }

  directRequirements () {
    const dependencies = (this.record() || {}).dependencies || [];
    return arr.pluck(dependencies.filter(Boolean), 'name').map(id => module(this.System, id));
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // module environment
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  isMochaTest () {
    if (!this._source) { return false; }
    const scope = this._scope || (this._scope = query.topLevelDeclsAndRefs(parse(this._source)).scope);
    const deps = query.imports(scope).map(imp => imp.fromModule);
    if (!deps.some(ea => ea.endsWith('mocha-es6') || ea.endsWith('mocha-es6/index.js'))) { return false; }
    return true;
  }

  // What variables to not transform during execution, i.e. what variables
  // should not be accessed as properties of recorder
  get dontTransform () {
    return [
      this.recorderName,
      this.sourceAccessorName,
      'global', 'self',
      '_moduleExport', '_moduleImport',
      'localStorage', // for Firefox, see fetch
      // doesn't like to be called as a method, i.e. __lvVarRecorder.fetch
      'prompt', 'alert', 'fetch', 'getComputedStyle',
      ...this.isMochaTest() ? [] : GlobalInjector.getGlobals(this._source)
    ].concat(query.knownGlobals);
  }

  // FIXME... better to make this read-only, currently needed for loading
  // global modules, from instrumentation.js
  set recorder (v) { return this._recorder = v; }

  get recorder () {
    if (this._recorder) return this._recorder;
    return this.prepareRecorder();
  }

  prepareRecorder () {
    const S = this.System; const self = this;
    const existingRecord = this.getFrozenRecord();
    // check if there is a existing frozen module entry

    if (!globalProps.initialized) {
      globalProps.initialized = true;
      for (const prop in S.global) {
        if (S.global.__lookupGetter__(prop) || prop === 'closed') {
          globalProps.descriptors[prop] = {
            value: undefined,
            configurable: true,
            writable: true
          };
        }
      }
    }

    const nodejsDescriptors = {};
    if (S.get('@system-env').node) {
      // support for require
      const require = _require.bind(null, this);
      require.resolve = _resolve.bind(null, this);
      nodejsDescriptors.require = { configurable: true, writable: true, value: require };
    }

    this._recorder = Object.create(S.global, {

      ...globalProps.descriptors,
      ...nodejsDescriptors,

      event: {
        configurable: true,
        writable: true,
        value: undefined
      },

      System: { configurable: true, writable: true, value: S },

      __currentLivelyModule: { value: self },

      [defaultClassToFunctionConverterName]: {
        configurable: true,
        writable: true,
        value: classRuntime.initializeClass
      },

      [this.varDefinitionCallbackName]: {
        value: (name, kind, value, recorder, meta) => {
          meta = meta || {};
          meta.kind = kind;
          return self.define(name, value, false/* signalChangeImmediately */, meta);
        }
      },

      _moduleExport: {
        value: (name, val) => {
          scheduleModuleExportsChange(S, self.id, name, val, true/* add export */);
        }
      },

      _moduleImport: {
        value: (depName, key) => {
          const depId = S.decanonicalize(depName, self.id);
          const depExports = S.get(depId);

          if (!depExports) {
            console.warn(`import of ${key} failed: ${depName} (tried as ${self.id}) is not loaded!`);
            return undefined;
          }

          self.addDependencyToModuleRecord(
            module(S, depId),
            // setter is only installed if there isn't a setter already. In
            // those cases we make sure that at least the module varRecorder gets
            // updated, which is good enough for "virtual modules"
            imports => Object.assign(self.recorder, imports));

          if (key === undefined) return depExports;

          if (!Object.hasOwnProperty.bind(depExports)(key)) { console.warn(`import from ${depExports}: Has no export ${key}!`); }

          return depExports[key];
        }
      }
    });

    if (existingRecord) {
      Object.assign(this._recorder, existingRecord.recorder);
    }
    return this._recorder;
  }

  get varDefinitionCallbackName () { return 'defVar_' + this.id; }

  define (varName, value, exportImmediately = true, meta) {
    // attaching source info to runtime objects

    const { System, id, recorder } = this;

    System.debug && console.log(`[lively.modules] ${this.shortName()} defines ${varName}`);

    const metaSym = Symbol.for('lively-object-meta');
    const moduleSym = Symbol.for('lively-module-meta');

    if (typeof value === 'function' && meta &&
     (meta.kind === 'function' || meta.kind === 'class')) {
      value[metaSym] = meta;
    }

    if (value && value[metaSym] && !value[moduleSym]) {
      const pathInPackage = this.pathInPackage();
      const p = this.package();
      value[moduleSym] = {
        package: p ? { name: p.name, version: p.version } : {},
        pathInPackage
      };
    }

    // storing local module state
    recorder[varName] = value;

    // exports update
    scheduleModuleExportsChange(
      System, id, varName, value, false/* force adding export */);

    // system event
    this.notifyTopLevelObservers(varName);

    // immediately update exports (recursivly) when flagged or when the module
    // is not currently executing. During module execution we wait until the
    // entire module is done to avoid triggering the expensive update process
    // multiple times
    // ...whether or not this is in accordance with an upcoming es6 module spec
    // I don't know...
    exportImmediately = exportImmediately || !this.isEvalutionInProgress();
    if (exportImmediately) { runScheduledExportChanges(System, id); }

    return value;
  }

  undefine (varName) { delete this.recorder[varName]; }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // observing top level state
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  subscribeToToplevelDefinitionChanges (func) {
    this._observersOfTopLevelState.push(func);
    return func;
  }

  notifyTopLevelObservers (key) {
    const ignored = [
      'createOrExtendES6ClassForLively',
      'lively.capturing-declaration-wrapper'];
    const rec = this.recorder;
    if (ignored.includes(key)) return;
    this._observersOfTopLevelState.forEach(fn => fn(key, rec[key]));
  }

  unsubscribeFromToplevelDefinitionChanges (funcOrName) {
    this._observersOfTopLevelState = typeof funcOrName === 'string'
      ? this._observersOfTopLevelState.filter(ea => ea.name !== funcOrName)
      : this._observersOfTopLevelState.filter(ea => ea !== funcOrName);
  }

  // evaluationStart/End are also compiled into instrumented module code so are
  // also activated during module executions
  evaluationStart () {
    this._evaluationsInProgress++;
  }

  evaluationEnd () {
    this._evaluationsInProgress--;
    runScheduledExportChanges(this.System, this.id);
  }

  nextEvalId () { return this._evalId++; }

  isEvalutionInProgress () {
    return this._evaluationsInProgress > 0;
  }

  env () { return this; }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // package related
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  package () {
    return Package.forModule(this.System, this);
  }

  pathInPackage () {
    const p = this.package();
    return p && this.id.indexOf(p.address) === 0
      ? this.id.slice(p.address.length).replace(/^\//, '')
      : this.id;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // imports and exports
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  async imports () { return query.imports(await this.scope()); }
  async exports () { return query.exports(await this.scope()); }

  async addImports (specs) {
    let source = await this.source();

    for (const spec of specs) {
      const fromModule = module(this.System, spec.from || spec.moduleId);
      const fromPackage = fromModule.package();
      const importData = {
        exported: spec.exported || spec.local,
        moduleId: fromModule.id,
        packageName: fromPackage.name,
        packageURL: fromPackage.url,
        pathInPackage: fromModule.pathInPackage()
      };
      const alias = spec.local;
      ({ newSource: source } = ImportInjector.run(
        this.System, this.id, this.package(), source, importData, alias));
    }

    await this.changeSource(source);
  }

  async addGlobalDeclaration (varNamesToDeclareAsGlobal) {
    const source = await this.source();
    const { status, newSource } = GlobalInjector.run(source, varNamesToDeclareAsGlobal);
    const changed = status === 'modified';
    if (changed) await this.changeSource(newSource);
    return changed;
  }

  async removeImports (specs) {
    if (!specs.length) return;
    const oldSource = await this.source();
    const { source, removedImports } = await ImportRemover.removeImports(oldSource, specs);
    await this.changeSource(source);
    removedImports.forEach(ea => delete this.recorder[ea.local]);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // bindings
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  async _localDeclForRefAt (pos) {
    const scope = await this.resolvedScope();
    const ref = query.refWithDeclAt(pos, scope);
    return ref && { decl: ref.decl, id: ref.declId, declModule: this };
  }

  async _localDeclForName (nameOfRef) {
    const scope = await this.resolvedScope(); let found;
    for (const ref of scope.resolvedRefMap.values()) {
      const { ref: { name } } = ref;
      if (nameOfRef === name) { found = ref; break; }
    }
    return found && { decl: found.decl, id: found.declId, declModule: this };
  }

  async _importForNSRefAt (pos) {
    // if pos points to "x" of a property "m.x" with an import * as "m"
    // then this returns [<importStmt>, <m>, "x"]
    const scope = await this.resolvedScope();
    const ast = scope.node;
    const nodes = query.nodesAtIndex(ast, pos);
    if (nodes.length < 2) return [null, null];
    const id = nodes[nodes.length - 1];
    const member = nodes[nodes.length - 2];

    if (id.type !== 'Identifier' ||
     member.type !== 'MemberExpression' ||
     member.computed ||
     member.object.type !== 'Identifier') { return [null, null]; }

    const { decl } = scope.resolvedRefMap.get(member.object) || {};

    if (!decl || decl.type !== 'ImportDeclaration') { return [null, null]; }

    const name = member.object.name;
    const spec = decl.specifiers.find(s => s.local.name === name);

    return spec.type !== 'ImportNamespaceSpecifier'
      ? [null, null]
      : [decl, spec.local, id.name];
  }

  async _resolveImportedDecl (decl) {
    if (!decl) return [];
    const { name } = decl.id;
    const imports = await this.imports();
    const im = imports.find(i => i.local === name);
    if (im) {
      const imM = module(this.System, im.fromModule, this.id);
      return [decl].concat(await imM.bindingPathForExport(im.imported));
    }
    return [decl];
  }

  async bindingPathFor (nameOfRef) {
    const decl = await this._localDeclForName(nameOfRef);
    if (decl) return await this._resolveImportedDecl(decl);
  }

  async bindingPathForExport (name) {
    await this.resolvedScope();
    const exports = await this.exports();
    const ex = exports.find(e => e.exported === name);
    if (ex.fromModule) {
      const imM = module(this.System, ex.fromModule, this.id);
      const decl = { decl: ex.node, id: ex.declId };
      decl.declModule = this;
      return [decl].concat(await imM.bindingPathForExport(ex.imported));
    } else {
      return this._resolveImportedDecl({
        decl: ex.decl,
        id: ex.declId,
        declModule: ex && ex.decl ? this : null
      });
    }
  }

  async bindingPathForRefAt (pos) {
    const decl = await this._localDeclForRefAt(pos);
    if (decl) return await this._resolveImportedDecl(decl);

    const [imDecl, id, name] = await this._importForNSRefAt(pos);
    if (!imDecl) return [];
    const imM = module(this.System, imDecl.source.value, this.id);
    return [{ decl: imDecl, declModule: this, id }].concat(await imM.bindingPathForExport(name));
  }

  async definitionForRefAt (pos) {
    const path = await this.bindingPathForRefAt(pos);
    return path.length < 1 ? null : path[path.length - 1].decl;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // module records
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  ensureRecord () {
    const S = this.System;
    const records = this.System.loads;
    if (records[this.id]) return records[this.id];
  }

  static sanitizeRecord (rec, System) {
    if (!rec) return;
    if (rec.name && rec.exports && rec.setters) return rec; // already sanitized
    rec.name = rec.key;
    if (!rec.hasOwnProperty('__lively_modules__')) { rec.__lively_modules__ = { evalOnlyExport: {} }; }
    if (!rec.hasOwnProperty('exports')) rec.exports = System.REGISTER_INTERNAL.records[rec.key]?.linkRecord?.moduleObj || {};
    if (!rec.hasOwnProperty('setters')) rec.setters = System.REGISTER_INTERNAL.records[rec.key]?.linkRecord?.setters || [];
    if (!rec.hasOwnProperty('importers')) {
      Object.defineProperty(rec, 'importers', {
        get: function () {
          return getImportersOfModule(System, rec);
        }
      });
    }
    if (!rec.hasOwnProperty('dependencies')) {
      Object.defineProperty(rec, 'dependencies', {
        get: function () {
          return rec.deps?.map(dep => ModuleInterface.sanitizeRecord(System.loads[rec.depMap[dep]], System)) || []; // also ensure that the record is present
        }
      });
    }
    return rec;
  }

  record () {
    const rec = this.System.loads?.[this.id];
    if (!rec) return null;
    ModuleInterface.sanitizeRecord(rec, this.System);
    return rec;
  }

  updateRecord (doFunc) {
    const record = this.record();
    if (!record) throw new Error(`es6 environment global of ${this.id}: module not loaded, cannot get export object!`);
    record.locked = true;
    try {
      return doFunc(record);
    } finally { record.locked = false; }
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // search
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  async search (searchStr, options) {
    options = { excludedModules: [], ...options };

    if (options.excludedModules.some(ex => {
      if (typeof ex === 'string') return ex === this.id;
      if (ex instanceof RegExp) return ex.test(this.id);
      if (typeof ex === 'function') return ex(this.id);
      return false;
    })) return [];

    const src = await this.source();
    let re;
    if (searchStr instanceof RegExp) {
      let flags = 'g'; // add 'g' flag
      if (searchStr.ignoreCase) flags += 'i';
      if (searchStr.multiline) flags += 'm';
      re = RegExp(searchStr.source, flags);
    } else {
      let flags = 'g';
      if (!options.caseSensitive) flags = flags + 'i';
      if (!options.regexMode) searchStr = regExpEscape(searchStr);
      re = RegExp(searchStr, flags);
    }

    let match; const res = [];
    while ((match = re.exec(src)) !== null) { res.push([match.index, match[0].length]); }

    for (let i = 0, j = 0, line = 1, lineStart = 0;
      i < src.length && j < res.length;
      i++) {
      if (src[i] === '\n') {
        line++;
        lineStart = i + 1;
      }
      const [idx, length] = res[j];
      if (i !== idx) continue;
      let lineEnd = src.slice(lineStart).indexOf('\n');
      if (lineEnd === -1) lineEnd = src.length;
      else lineEnd += lineStart;
      const p = this.package();
      res[j] = {
        moduleId: this.id,
        packageName: p ? p.name : undefined,
        pathInPackage: p ? this.pathInPackage() : this.id,
        isLoaded: this.isLoaded(),
        length,
        line,
        column: i - lineStart,
        lineString: (lineEnd - lineStart > 1000) ? `...${src.slice(i - 10, i + 100)}...` : src.slice(lineStart, lineEnd)
      };
      j++;
    }

    return res;
  }

  toString () { return `module(${this.id})`; }
}

// update pre-bootstrap modules
/*

var mods = System.get("@lively-env").loadedModules;
Object.keys(mods).forEach(id => {
  if (mods[id].constructor === ModuleInterface) return;
  mods[id] = Object.assign(new ModuleInterface(mods[id].System, mods[id].id), mods[id]);
});

*/
