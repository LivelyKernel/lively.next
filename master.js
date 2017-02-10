import {
  serialize as serializePatch
} from "./vdom-serialized-patch-browserified.js";

import { diff } from "./node_modules/virtual-dom/dist/virtual-dom.js";

import L2LClient from "lively.2lively/client.js";
import { promise } from "lively.lang";

const debug = true;

function renderMorph(morph) {
  var node = morph.render(morph.env.renderer)
  lively.lang.tree.postwalk(node,
    n => {
      if (n.properties) {
        if (n.properties.hasOwnProperty("animation")) delete n.properties.animation;
        if (n.properties.hasOwnProperty("morph-after-render-hook")) delete n.properties["morph-after-render-hook"];
      }
    },
    n => n.children);
  return node;
}

export default class Master {

  static installLively2LivelyServices(options = {}) {
    var {l2lClient} = options;
    l2lClient = l2lClient || L2LClient.default();
    Object.keys(this.services).forEach(name =>
      l2lClient.addService(name,
        async (tracker, msg, ackFn) => this.services[name](tracker, msg, ackFn)));
    debug && console.log(`[lively.morphic-mirror master] services installed`);
  }

  static uninstallLively2LivelyServices(options = {}) {
    var {l2lClient} = options;
    l2lClient = l2lClient || L2LClient.default()
    Object.keys(this.services).forEach(name => l2lClient.removeService(name));
    debug && console.log(`[lively.morphic-mirror master] services uninstalled`);
  }

  static get services() {
    if (this._services) return this._services;
    return this._services = {
      "lively.morphic-mirror.process-client-events": (_, {data: {events, masterId}}, ackFn) => {
        debug && console.log(`[lively.morphic-mirror master] receiving client events`);
        try {
          events.map(ea => {
            var targetId = ea.target;
            if (typeof targetId === "string") ea.target = document.getElementById(targetId);
            try {
              $world.env.eventDispatcher.dispatchDOMEvent(ea);
            } catch (e) {
              console.log(targetId);
              throw e;
            }
          })
        } catch (e) { $world.logError(e); }
        if (typeof ackFn === "function") ackFn({status: "OK"});
      }
    }
  }

  // constructor(l2lTargetId, targetMorph) {
  //   this.l2lTargetId = l2lTargetId;
  //   this.targetMorph = targetMorph;
  //   this.prevVdomNode = null;
  // }

  constructor(targetMorph, channel, clientId = "__default__") {
    this.channel = channel;
    this.targetMorph = targetMorph;
    this.clientId = clientId;
    this.prevVdomNode = null;
    this.sendInProgress = false;
  }

  sendUpdate() {
    if (this.sendInProgress) return;
    this.sendInProgress = true;
    return promise.finally(
      this.prevVdomNode ?
        this.sendViewPatch() :
        this.sendInitialView(),
      () => this.sendInProgress = false);
  }

  async disconnect() {
    var id = this.clientId;
    return this.channel.send("lively.morphic-mirror.disconnect", {id});

    // var l2lClient = L2LClient.default();
    // return l2lClient.sendToAndWait(this.l2lTargetId, "lively.morphic-mirror.disconnect", {})
  }

  sendInitialView() {
    var node = this.getVdomNode(),
        id = this.clientId;
    return this.channel.send("lively.morphic-mirror.render", {node, id});

    // var l2lClient = L2LClient.default();
    // return l2lClient.sendToAndWait(this.l2lTargetId, "lively.morphic-mirror.render", {node})
  }

  sendViewPatch() {
    var patch = this.getVdomPatch(),
        id = this.clientId;
    return this.channel.send("lively.morphic-mirror.render-patch", {patch, id});
    // var l2lClient = L2LClient.default();
    // return l2lClient.sendToAndWait(this.l2lTargetId, "lively.morphic-mirror.render-patch", {patch})
  }

  getVdomNode() {
    return this.prevVdomNode = renderMorph(this.targetMorph);
  }

  getVdomPatch() {
    var newNode = renderMorph(this.targetMorph),
        patch = serializePatch(diff(this.prevVdomNode, newNode));
    this.prevVdomNode = newNode;
    return patch;
  }

}