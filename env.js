import { defaultDOMEnv } from "./rendering/dom-helper.js";
import { Renderer } from "./rendering/renderer.js";
import FontMetric from "./rendering/font-metric.js";
import { ChangeManager } from "./changes.js";
import { UndoManager } from "./undo.js";
import EventDispatcher from "./events/EventDispatcher.js";
import { subscribe, unsubscribe } from "lively.notifications";
import { requestAnimationFrameStacked, cancelAnimationFrameStacked } from "lively.lang/promise.js";


// MorphicEnv.reset();

export class MorphicEnv {

  static reset() {
    while (true) {
      var env = this.popDefault();
      if (!env) break;
      try { env.uninstall() }
      catch (err) { console.error(`Error uninstalling MorphicEnv: ${err.stack || err}`); }
    }
  }

  static default() {
    var {envs} = this;
    if (!envs.length) this.pushDefault(new this());
    return envs[envs.length-1];
  }

  static pushDefault(env) { this.envs.push(env); return env; }

  static popDefault() { return this.envs.pop(); }

  static get envs() { return this._envs || (this._envs = []); }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // initialize / release

  constructor(domEnv = defaultDOMEnv()) {
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

    if (typeof domEnv.then === "function") {
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

  isDefault() {
    return this.constructor.default() === this;
  }

  initWithDOMEnv(domEnv) {
    this.domEnv = domEnv;
    this.fontMetric = FontMetric.forDOMEnv(domEnv);
  }

  uninstallWorldRelated() {
    this.renderer && this.renderer.clear();
    this.eventDispatcher && this.eventDispatcher.uninstall();
    this.world && this.world.suspendSteppingAll();
  }

  uninstall() {
    if (this._waitForDOMEnv)
      return this._waitForDOMEnv.then(() => this.uninstall());

    this.deleteHistory();
    this.uninstallWorldRelated();
    if (this.fontMetric) {
      this.fontMetric.uninstall();
      this.fontMetric = null;
    }
    if (this.domEnv && this.whenRenderedTickingProcess) {
      cancelAnimationFrameStacked(this.whenRenderedTickingProcess);
      this.whenRenderedTickingProcess = null;
    }
    this.whenRenderedRequesters = new Map();
    this.domEnv && this.domEnv.destroy();
    this.initialized = false;
    return Promise.resolve();
  }

  setWorld(world) {
    if (this._waitForDOMEnv)
      return this._waitForDOMEnv.then(() => this.setWorld(world));
    return this.setWorldRenderedOn(world, this.domEnv.document.body);
  }

  setWorldRenderedOn(world, rootNode) {
    if (!world || !world.isWorld)
      throw new Error(`world object does not look like a morphic world`);

    if (this._waitForDOMEnv) {
      return this._waitForDOMEnv.then(() => this.setWorldRenderedOn(world, rootNode));
    }

    this.deleteHistory();
    this.uninstallWorldRelated();
    this.world = world;
    this.renderer = new Renderer(world, rootNode, this.domEnv);
    this.eventDispatcher = new EventDispatcher(this.domEnv.window, world).install(rootNode);
    world.resumeSteppingAll();
    if (this.isDefault()) this.domEnv.window.$world = world;
    world.focus();
    world.makeDirty();
    this.renderer.renderLater();

    return world.whenRendered().then(() => this);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // notification handling

  installSystemChangeHandlers() {
    if (this.systemChangeHandlers) return;

    var systemChangeHandlers = this.systemChangeHandlers = {};
    systemChangeHandlers["lively.modules/moduleloaded"] = [
      subscribe("lively.modules/moduleloaded", (evt) =>
        this.getTargetsFor("onModuleLoaded").forEach(ea => ea.onModuleLoaded(evt)))];
    systemChangeHandlers["lively.modules/modulechanged"] = [
      subscribe("lively.modules/modulechanged", (evt) =>
        this.getTargetsFor("onModuleChanged").forEach(ea => ea.onModuleChanged(evt)))];
    systemChangeHandlers["lively.partsbin/partpublished"] = [
      subscribe("lively.partsbin/partpublished", (evt) =>
        this.getTargetsFor("onPartPublished").forEach(ea => ea.onPartPublished(evt)))];
    systemChangeHandlers["lively.user/userchanged"] = [
      subscribe("lively.user/userchanged", (evt) =>
        this.getTargetsFor("onUserChanged").forEach(ea => ea.onUserChanged(evt)))];
  }

  uninstallSystemChangeHandlers() {
    var {systemChangeHandlers} = this;
    if (!systemChangeHandlers) return;
    this.systemChangeHandlers = null;
    Object.keys(systemChangeHandlers).forEach(name =>
      systemChangeHandlers[name].forEach(handler =>
        unsubscribe(name, handler)))
  }

  getTargetsFor(selector) {
    let world = this.world, targets = [];
    if (!world || !world.submorphs) return targets;
    if (typeof world[selector] === "function")
      targets.push(world);
    for (let morph of world.submorphs) {
      if (typeof morph[selector] === "function")
        targets.push(morph);
      if (morph.isWindow && morph.targetMorph
          && typeof morph.targetMorph[selector] === "function")
        targets.push(morph.targetMorph);
    }
    return targets;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // history

  deleteHistory() {
    var {changeManager, world, fontMetric} = this;
    changeManager && (changeManager.changes.length = 0);
    world && world.withAllSubmorphsDo(ea => ea.undoManager && ea.undoManager.reset());
    fontMetric && fontMetric.reset();
  }

  printStatus() {
    var {changeManager, world, fontMetric} = this,
        morphsWithUndo = 0, undoChanges = 0;
    world && world.withAllSubmorphsDo(ea => {
      if (!ea.undoManager) return;
      morphsWithUndo++;
      undoChanges += ea.undoManager.undos.length + ea.undoManager.redos.length
    });
    return `${changeManager.changes.length} changes recorded\n${morphsWithUndo} morphs with undos\n${undoChanges} undo changes`

  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // whenRendered updates

  updateWhenRenderedRequests() {
    let {whenRenderedRequesters} = this, nRequesters = 0;
    for (let [morph, requestState] of whenRenderedRequesters) {
      let {maxAttempts, currentAttempt, resolve, reject} = requestState;
      if (!morph._dirty && !morph._rendering) {
        whenRenderedRequesters.delete(morph);
        resolve(morph)
      } else if (++requestState.currentAttempt > maxAttempts) {
        whenRenderedRequesters.delete(morph);
        reject(new Error(`Failed to wait for whenRendered of ${morph} (tried ${maxAttempts}x)`));
      } else nRequesters++;
    }
    if (!nRequesters) this.whenRenderedTickingProcess = null;
    else this.whenRenderedTickingProcess = requestAnimationFrameStacked(
                                            () => this.updateWhenRenderedRequests());
  }


  whenRendered(morph, maxAttempts = 50) {
    let {whenRenderedRequesters, whenRenderedTickingProcess} = this,
        requestState = whenRenderedRequesters.get(morph);
    if (!requestState) {
      let resolve, reject, promise = new Promise((rs, rj) => { resolve = rs; reject = rj; })
      whenRenderedRequesters.set(morph, requestState = {
        maxAttempts,
        currentAttempt: 0,
        resolve,
        reject,
        promise
      });
    }
    if (!whenRenderedTickingProcess)
      this.whenRenderedTickingProcess = requestAnimationFrameStacked(
                                          () => this.updateWhenRenderedRequests());
    return requestState.promise;
  }

}