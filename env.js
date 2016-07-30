import { defaultDOMEnv } from "./rendering/dom-helper.js";
import { Renderer } from "./rendering/renderer.js";
import FontMetric from "./rendering/font-metric.js";
import { EventDispatcher } from "./events.js";


export class MorphicEnv {

  static default() {
    if (!this._envs || !this._envs.length) this.pushDefault(new this());
    return this._envs[this._envs.length-1];
  }

  static pushDefault(env) {
    if (!this._envs) this._envs = [];
    this._envs.push(env);
    return env;
  }

  static popDefault(env) {
    if (!this._envs) this._envs = [];
    return this._envs.pop();
  }

  constructor(domEnv = defaultDOMEnv()) {
    if (typeof domEnv.then === "function") {
      this._waitForDOMEnv = domEnv.then(env => {
        this._waitForDOMEnv = null;
        this.initWithDOMEnv(env);
      }).catch(err => console.error(`Error initializing MorphicEnv with dom env: ${err.stack}`));
    } else this.initWithDOMEnv(domEnv);

    this.renderer = null;
    this.eventDispatcher = null;
    this.world = null;
    
    this.objPool = null;
    this.synchronizer = null;
  }

  initWithDOMEnv(domEnv) {
    this.domEnv = domEnv;
    this.fontMetric = new FontMetric();
    this.fontMetric.install(domEnv.document, domEnv.document.body)
  }

  uninstallWorldRelated() {
    this.renderer && this.renderer.clear();
    this.eventDispatcher && this.eventDispatcher.uninstall();
  }

  uninstall() {
    this.uninstallWorldRelated();
    this.fontMetric && this.fontMetric.uninstall();
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
    this.eventDispatcher = new EventDispatcher(this.domEnv.window, world).install();
    world.makeDirty();
    
    return world.whenRendered().then(() => this);
  }

}