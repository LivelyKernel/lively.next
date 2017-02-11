import {
  serialize as serializePatch
} from "./vdom-serialized-patch-browserified.js";

import { diff, VNode, VText } from "./node_modules/virtual-dom/dist/virtual-dom.js";

import L2LClient from "lively.2lively/client.js";
import { promise, obj, tree } from "lively.lang";
import { inspect } from "lively.morphic";

const debug = true;

function makeNodeSerializable(node) {
  var serializableNode = node,
      className = node.constructor.name;


  if (className === "CustomVNode") {
    serializableNode = new VNode("DIV", {innerHTML: node.morph.html}, node.children, node.key, node.namespace)
  } else if (className === "VirtualText") {

  } else if (className === "VirtualNode") {

    var p = node.properties;
    if (p && (p.hasOwnProperty("animation") || p.hasOwnProperty("morph-after-render-hook"))) {
      serializableNode = new VNode(node.tagName, obj.dissoc(p, ["morph-after-render-hook", "animation"]), node.children, node.key, node.namespace)
    }

    if (node.children && node.children.length) {
      if (serializableNode === node) serializableNode = new VNode(node.tagName, node.properties, node.children, node.key, node.namespace);
      serializableNode.children = serializableNode.children.map(ea => makeNodeSerializable(ea));
    }
  }

  return serializableNode;
}

function renderMorph(morph) {
  return morph.render(morph.env.renderer);
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
  }

  sendInitialView() {
    var node = this.prevVdomNode = makeNodeSerializable(renderMorph(this.targetMorph)),
        id = this.clientId;
    return this.channel.send("lively.morphic-mirror.render", {node, id});
  }

  sendViewPatch() {
    var patch = this.getVdomPatch(),
        id = this.clientId;
    return this.channel.send("lively.morphic-mirror.render-patch", {patch, id});
  }

  getVdomPatch() {
    var newNode = makeNodeSerializable(renderMorph(this.targetMorph)),
        patch = serializePatch(diff(this.prevVdomNode, newNode));
    this.prevVdomNode = newNode;
    return patch;
  }

}