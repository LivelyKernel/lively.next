import { browserDOMEnvironment, createDOMEnvironment } from "./rendering/dom-helper.js";
import { Renderer } from "./rendering/renderer.js";
import FontMetric from "./rendering/font-metric.js";
import { EventDispatcher } from "./events.js";


export default class Environment {

  static default() {
    return this._default || (this._default = new this());
  }

  constructor(domEnv = browserDOMEnvironment()) {
    this.domEnv = domEnv;
    this.fontMetric = new FontMetric();
    this.fontMetric.install(domEnv.document, domEnv.document.body)

    this.renderer = null;
    this.eventDispatcher = null;
    this.world = null;
    
    this.objPool = null;
    this.synchronizer = null;
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
    return this.setWorldRenderedOn(world, this.domEnv.document.body);
  }

  setWorldRenderedOn(world, rootNode) {
    this.uninstallWorldRelated();
    this.world = world;
    this.renderer = new Renderer(world, rootNode, this.domEnv).startRenderWorldLoop();
    this.eventDispatcher = new EventDispatcher(this.domEnv.window, world).install();
    world.makeDirty();
  }

}