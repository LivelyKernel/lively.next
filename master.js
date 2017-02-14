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
    // serializes an html morph...
    // currently we send over the entire HTML source...!

    // serializableNode = new VNode("DIV", {innerHTML: node.morph.domNode.innerHTML, ...node.properties}, node.children, node.key, node.namespace)
    // console.log(serializableNode)
    var {morph, morphVtree} = node;
    node = morphVtree || node.renderMorph();
    var {properties, tagName, children, key, namespace} = node;
    properties = obj.dissoc(properties, ["morph-after-render-hook", "animation"]);
    children = children ? children.slice() : [];
    serializableNode = new VNode(tagName, properties, children, key, namespace);
    className = "VirtualNode";

    if (children[0]) {
      var htmlNode = children[0],
          {properties, tagName, children, key, namespace} = htmlNode;
      serializableNode.children[0] = new VNode(tagName, {...properties}, children, key, namespace);
      serializableNode.children[0].properties.innerHTML = morph.html;
    }
  }

  if (className === "VirtualText") {
    // sending over the entire text content
  }
  
  if (className === "VirtualNode") {
    // removing hooks as those can't be JSONified
    var p = serializableNode.properties;
    if (p && (p.hasOwnProperty("animation") || p.hasOwnProperty("morph-after-render-hook"))) {
      serializableNode = new VNode(serializableNode.tagName, obj.dissoc(p, ["morph-after-render-hook", "animation"]), serializableNode.children, serializableNode.key, serializableNode.namespace)
    }

    if (serializableNode.children && serializableNode.children.length) {
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
    debug && console.log(`[lively.mirror master] services installed`);
  }

  static uninstallLively2LivelyServices(options = {}) {
    var {l2lClient} = options;
    l2lClient = l2lClient || L2LClient.default()
    Object.keys(this.services).forEach(name => l2lClient.removeService(name));
    debug && console.log(`[lively.mirror master] services uninstalled`);
  }

  static get services() {
    if (this._services) return this._services;
    return this._services = {
      "lively.mirror.process-client-events": (_, {data: {events, masterId}}, ackFn) => {
        debug && console.log(`[lively.mirror master] receiving client events`);
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
    return this.channel.send("lively.mirror.disconnect", {id});
  }

  sendInitialView() {
    var node = this.prevVdomNode = makeNodeSerializable(renderMorph(this.targetMorph)),
        id = this.clientId;
    return this.channel.send("lively.mirror.render", {node, id});
  }

  sendViewPatch() {
    var patch = this.getVdomPatch(),
        id = this.clientId;
    return this.channel.send("lively.mirror.render-patch", {patch, id});
  }

  getVdomPatch() {
    var newNode = makeNodeSerializable(renderMorph(this.targetMorph)),
        patch = serializePatch(diff(this.prevVdomNode, newNode));
    this.prevVdomNode = newNode;
    return patch;
  }

}