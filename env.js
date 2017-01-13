import { defaultDOMEnv } from "./rendering/dom-helper.js";
import { Renderer } from "./rendering/renderer.js";
import FontMetric from "./rendering/font-metric.js";
import { ChangeManager } from "./changes.js";
import { UndoManager } from "./undo.js";
import EventDispatcher from "./events/EventDispatcher.js";
import { subscribe, unsubscribe } from "lively.notifications";


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
    if (!this._envs || !this._envs.length) this.pushDefault(new this());
    return this._envs[this._envs.length-1];
  }

  static pushDefault(env) {
    if (!this._envs) this._envs = [];
    this._envs.push(env);
    return env;
  }

  static popDefault() {
    if (!this._envs) this._envs = [];
    return this._envs.pop();
  }

  constructor(domEnv = defaultDOMEnv()) {
    this.fontMetric = null;
    this.renderer = null;
    this.eventDispatcher = null;
    this.world = null;
    this.systemChangeHandlers = null;

    this.objPool = null;
    this.synchronizer = null;

    if (typeof domEnv.then === "function") {
      this._waitForDOMEnv = domEnv.then(env => {
        this._waitForDOMEnv = null;
        this.initWithDOMEnv(env);
      }).catch(err => console.error(`Error initializing MorphicEnv with dom env: ${err.stack}`));
    } else this.initWithDOMEnv(domEnv);

    this.changeManager = new ChangeManager();
    this.undoManager = new UndoManager();

    this.installSystemChangeHandlers();
  }

  initWithDOMEnv(domEnv) {
    this.domEnv = domEnv;
    this.fontMetric = FontMetric.forDOMEnv(domEnv);
  }

  uninstallWorldRelated() {
    this.renderer && this.renderer.clear();
    this.eventDispatcher && this.eventDispatcher.uninstall();
  }

  uninstall() {
    this.deleteHistory();
    this.uninstallWorldRelated();
    if (this.fontMetric) {
      this.fontMetric.uninstall();
      this.fontMetric = null;
    }
    this.domEnv && this.domEnv.destroy();
  }

  setWorld(world) {
    if (this._waitForDOMEnv) {
      return this._waitForDOMEnv.then(() => this.setWorld(world));
    }
    return this.setWorldRenderedOn(world, this.domEnv.document.body);
  }

  setWorldRenderedOn(world, rootNode) {
    if (this._waitForDOMEnv) {
      return this._waitForDOMEnv.then(() => this.setWorldRenderedOn(world, rootNode));
    }

    this.uninstallWorldRelated();
    this.world = world;
    this.renderer = new Renderer(world, rootNode, this.domEnv).startRenderWorldLoop();
    this.eventDispatcher = new EventDispatcher(this.domEnv.window, world).install(rootNode);
    world.makeDirty();

    return world.whenRendered().then(() => this);
  }

  installSystemChangeHandlers() {
    if (this.systemChangeHandlers) return;
    var handlers = this.systemChangeHandlers = {};
    handlers["lively.modules/moduleloaded"] = [
      subscribe("lively.modules/moduleloaded", (evt) =>
        this.getSystemChangeTargets().forEach(ea => ea.onModuleLoaded(evt)))];
    handlers["lively.modules/modulechanged"] = [
      subscribe("lively.modules/modulechanged", (evt) =>
        this.getSystemChangeTargets().forEach(ea => ea.onModuleChanged(evt)))];
  }
  
  uninstallSystemChangeHandlers() {
    if (!this.systemChangeHandlers) return;
    var handlers = this.systemChangeHandlers;
    this.systemChangeHandlers = null;
    Object.keys(handlers).forEach(name =>
      handlers[name].forEach(handler =>
        unsubscribe(name, handler)))
  }

  getSystemChangeTargets() {    
    var world = this.world, targets = [];
    if (!world) return targets;
    for (let win of world.getWindows()) {
      win.isBrowser && targets.push(win);
      win.targetMorph && win.targetMorph.isObjectEditor &&
        targets.push(win.targetMorph);
    }
    return targets;
  }

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

}