import { defaultDOMEnv } from './rendering/dom-helper.js';
import { Renderer } from './rendering/renderer.js';
import FontMetric from './rendering/font-metric.js';
import { ChangeManager } from './changes.js';
import { UndoManager } from './undo.js';
import EventDispatcher from './events/EventDispatcher.js';
import { subscribe, unsubscribe } from 'lively.notifications';
import { clearStylePropertiesForClassesIn } from './helpers.js';

// MorphicEnv.reset();

export class MorphicEnv {
  static reset () {
    while (true) {
      const env = this.popDefault();
      if (!env) break;
      try { env.uninstall(); } catch (err) { console.error(`Error uninstalling MorphicEnv: ${err.stack || err}`); }
    }
  }

  static default () {
    const { envs } = this;
    if (!envs.length) this.pushDefault(new this());
    return envs[envs.length - 1];
  }

  static pushDefault (env) { this.envs.push(env); return env; }

  static popDefault () { return this.envs.pop(); }

  static get envs () { return this._envs || (this._envs = []); }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // initialize / release

  constructor (domEnv = defaultDOMEnv()) {
    this.initialized = false;
    this.fontMetric = null;
    this.renderer = null;
    this.eventDispatcher = null;
    this.world = null;
    this.systemChangeHandlers = null;

    this.objPool = null;
    this.synchronizer = null;

    this.changeManager = new ChangeManager();
    this.undoManager = new UndoManager();

    this.installSystemChangeHandlers();

    this.whenRenderedRequesters = new Map();
    this.whenRenderedTickingProcess = null;

    if (typeof domEnv.then === 'function') {
      this._waitForDOMEnv = domEnv.then(env => {
        this._waitForDOMEnv = null;
        this.initWithDOMEnv(env);
        this.initialized = true;
      }).catch(err => console.error(`Error initializing MorphicEnv with dom env: ${err.stack}`));
    } else {
      this.initWithDOMEnv(domEnv);
      this.initialized = true;
    }
  }

  isDefault () {
    return this.constructor.default() === this;
  }

  initWithDOMEnv (domEnv) {
    this.domEnv = domEnv;
    this.fontMetric = FontMetric.forDOMEnv(domEnv);
  }

  uninstallWorldRelated () {
    this.renderer && this.renderer.clear();
    this.eventDispatcher && this.eventDispatcher.uninstall();
    this.world && this.world.suspendSteppingAll();
  }

  uninstall () {
    if (this._waitForDOMEnv) { return this._waitForDOMEnv.then(() => this.uninstall()); }

    this.deleteHistory();
    this.uninstallWorldRelated();
    if (this.fontMetric) {
      this.fontMetric.uninstall();
      this.fontMetric = null;
    }
    if (this.domEnv && this.whenRenderedTickingProcess) {
      this.domEnv.window.cancelAnimationFrame(this.whenRenderedTickingProcess);
      this.whenRenderedTickingProcess = null;
    }
    this.whenRenderedRequesters = new Map();
    this.domEnv && this.domEnv.destroy();
    this.initialized = false;
    return Promise.resolve();
  }

  setWorld (world, rootNode = this.renderer ? this.renderer.rootNode : this.domEnv.document.body) {
    if (this._waitForDOMEnv) { return this._waitForDOMEnv.then(() => this.setWorld(world)); }
    return this.setWorldRenderedOn(world, rootNode);
  }

  setWorldRenderedOn (world, rootNode, domNode = null) {
    if (!world || !world.isWorld) { throw new Error('world object does not look like a morphic world'); }

    if (this._waitForDOMEnv) {
      return this._waitForDOMEnv.then(() => this.setWorldRenderedOn(world, rootNode, domNode));
    }

    this.deleteHistory();
    this.uninstallWorldRelated();
    this.world = world;
    this.renderer = new Renderer(world, rootNode, this.domEnv);
    this.renderer.domNode = domNode;
    this.eventDispatcher = new EventDispatcher(world.isEmbedded ? rootNode : this.domEnv.window, world).install(rootNode);

    world.resumeSteppingAll();

    if (this.isDefault()) this.domEnv.window.$world = world;
    if (!world.stealFocus) world.focus();
    world.makeDirty();
    this.renderer.renderLater();

    return world.whenRendered().then(() => this);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // notification handling

  installSystemChangeHandlers () {
    if (this.systemChangeHandlers) return;

    const systemChangeHandlers = this.systemChangeHandlers = {};
    systemChangeHandlers['lively.modules/moduleloaded'] = [
      subscribe('lively.modules/moduleloaded', (evt) =>
        this.getTargetsFor('onModuleLoaded').forEach(ea => ea.onModuleLoaded(evt)))];
    systemChangeHandlers['lively.modules/modulechanged'] = [
      subscribe('lively.modules/modulechanged', (evt) => {
        clearStylePropertiesForClassesIn(evt.module);
        this.getTargetsFor('onModuleChanged').forEach(ea => ea.onModuleChanged(evt));
      })];
    systemChangeHandlers['lively.user/userchanged'] = [
      subscribe('lively.user/userchanged', (evt) =>
        this.getTargetsFor('onUserChanged').forEach(ea => ea.onUserChanged(evt)))];
  }

  uninstallSystemChangeHandlers () {
    const { systemChangeHandlers } = this;
    if (!systemChangeHandlers) return;
    this.systemChangeHandlers = null;
    Object.keys(systemChangeHandlers).forEach(name =>
      systemChangeHandlers[name].forEach(handler =>
        unsubscribe(name, handler)));
  }

  getTargetsFor (selector) {
    const world = this.world; const targets = [];
    if (!world || !world.submorphs) return targets;
    if (typeof world[selector] === 'function') { targets.push(world); }
    for (const morph of world.submorphs) {
      if (typeof morph[selector] === 'function') { targets.push(morph); }
      if (morph.isWindow && morph.targetMorph &&
          typeof morph.targetMorph[selector] === 'function') { targets.push(morph.targetMorph); }
    }
    return targets;
  }

  cleanupCaches () {
    this.world.withAllSubmorphsDo(m => m._pathDependants = m._pathDependants.filter(m => m.world()));
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // history

  deleteHistory () {
    const { changeManager, world, fontMetric } = this;
    changeManager && (changeManager.changes.length = 0);
    world && world.withAllSubmorphsDo(ea => ea.undoManager && ea.undoManager.reset());
    fontMetric && fontMetric.reset();
  }

  printStatus () {
    const { changeManager, world } = this;
    let morphsWithUndo = 0; let undoChanges = 0;
    world && world.withAllSubmorphsDo(ea => {
      if (!ea.undoManager) return;
      morphsWithUndo++;
      undoChanges += ea.undoManager.undos.length + ea.undoManager.redos.length;
    });
    return `${changeManager.changes.length} changes recorded\n${morphsWithUndo} morphs with undos\n${undoChanges} undo changes`;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // whenRendered updates

  updateWhenRenderedRequests () {
    const { whenRenderedRequesters } = this; let nRequesters = 0;
    for (const [morph, requestState] of whenRenderedRequesters) {
      const { maxAttempts, resolve, reject } = requestState;
      if (!morph._dirty && !morph._rendering) {
        whenRenderedRequesters.delete(morph);
        resolve(morph);
      } else if (++requestState.currentAttempt > maxAttempts) {
        whenRenderedRequesters.delete(morph);
        reject(new Error(`Failed to wait for whenRendered of ${morph} (tried ${maxAttempts}x)`));
      } else nRequesters++;
    }
    if (!nRequesters) this.whenRenderedTickingProcess = null;
    else {
      this.whenRenderedTickingProcess = this.domEnv.window.requestAnimationFrame(
        () => this.updateWhenRenderedRequests());
    }
  }

  whenRendered (morph, maxAttempts = 50) {
    const { whenRenderedRequesters, whenRenderedTickingProcess } = this;
    let requestState = whenRenderedRequesters.get(morph);
    if (!requestState) {
      let resolve; let reject; const promise = new Promise((rs, rj) => { resolve = rs; reject = rj; });
      whenRenderedRequesters.set(morph, requestState = {
        maxAttempts,
        currentAttempt: 0,
        resolve,
        reject,
        promise
      });
    }
    if (!whenRenderedTickingProcess) {
      this.whenRenderedTickingProcess = this.domEnv.window.requestAnimationFrame(
        () => this.updateWhenRenderedRequests());
    }
    return requestState.promise;
  }
}
