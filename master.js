import {
  serialize as serializePatch
} from "./vdom-serialized-patch-browserified.js";

import { diff, VNode, VText } from "./node_modules/virtual-dom/dist/virtual-dom.js";

import L2LClient from "lively.2lively/client.js";
import { promise, obj, tree } from "lively.lang";
import { inspect } from "lively.morphic";

import vdomAsJSON from "./node_modules/vdom-as-json/dist/vdom-as-json.js";

const debug = true,
      useOptimizedPatchFormat = true;

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
    properties = obj.dissoc(properties, ["morph-render-done-hook", "morph-after-render-hook", "animation"]);
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
    if (p && (p.hasOwnProperty("animation") || p.hasOwnProperty("morph-after-render-hook") || p.hasOwnProperty("morph-render-done-hook"))) {
      serializableNode = new VNode(serializableNode.tagName, obj.dissoc(p, ["morph-render-done-hook", "morph-after-render-hook", "animation"]), serializableNode.children, serializableNode.key, serializableNode.namespace)
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


  static invokeServices(selector, data, ackFn) {
    this.services[selector](null, {data}, ackFn);
  }

  static get services() {
    if (this._services) return this._services;
    return this._services = {
      async "lively.mirror.process-client-events": (_, {data: {events, masterId}}, ackFn) => {
        debug && console.log(`[lively.mirror master] receiving client events`);
        try {

          var master = Master.getInstance(masterId);
          if (!master) {
            var msg = `[lively.mirror.process-client-events] Trying to find master for id ${masterId} failed.`;
            $world.logError(new Error(msg));
            if (typeof ackFn === "function") ackFn({error: msg});
            return;
          }
          await master.dispatchEvents(events);
        } catch (e) { $world.logError(e); }

        if (typeof ackFn === "function") ackFn({status: "OK"});
      }
    }
  }



  static get instances() {
    if (!this._instances) this._instances = new Map();
    return this._instances;
  }

  static getInstance(id) {
    var instance = this.instances.get(id);
    if (!instance) {
      instance = this.createInstance(id);
      this.instances.set(id, instance);
    }
    return instance;
  }

  static removeInstance(id) {
    if (!this.instances) return
    var instance = this.instances.get(id);
    if (!instance) return;
    instance.disconnect();
    this.instances.delete(id)
  }

  static createInstance(id, targetMorph, channel, clientId) {
    var instance = this.instances.get(id);
    if (instance) instance.reset();
    instance = new this(id, targetMorph, channel, clientId);
    this.instances.set(id, instance);
    return instance;
  }

  constructor(id, targetMorph, channel, clientId = "__default__") {
    this.id = id;
    this.channel = channel;
    this.targetMorph = targetMorph;
    this.clientId = clientId;
    this.prevVdomNode = null;
    this.sendInProgress = false;
  }

  async l2lSetup(clientL2lId) {
    var l2lClient = L2LClient.default();
    this.channel = {
      send(selector, data) {
        return l2lClient.sendToAndWait(clientL2lId, selector, data);
      }
    }

    Master.installLively2LivelyServices();

    // 2b. let the client now who is its master! (for sending events)
    await l2lClient.sendToAndWait(clientL2lId,
      "lively.mirror.install-l2l-channel",
      {masterId: this.id, sender: l2lClient.id, id: this.clientId});
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
    // try { JSON.stringify(node); } catch (e) { throw new Error("Node cannot be serialized");  }
    node = vdomAsJSON.toJson(node);
    return this.channel.send("lively.mirror.render", {node, id});
  }

  sendViewPatch() {
    var patch = this.getVdomPatch(),
        id = this.clientId;
    // try { JSON.stringify(patch); } catch (e) { throw new Error("patch cannot be serialized"); }
    return this.channel.send("lively.mirror.render-patch", {useOptimizedPatchFormat, patch, id});
  }

  getVdomPatch() {
    var newNode = makeNodeSerializable(renderMorph(this.targetMorph)),
        rawPatch = diff(this.prevVdomNode, newNode),
        patch = useOptimizedPatchFormat ?
                  serializePatch(rawPatch) :
                  vdomAsJSON.toJson(rawPatch);
    this.prevVdomNode = newNode;
    return patch;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  dispatchEvents(events) {
    var doc = this.targetMorph.env.domEnv.document;
    events.map(ea => {
      var targetId = ea.target;
      if (typeof targetId === "string") ea.target = doc.getElementById(targetId);
      try {
        this.targetMorph.env.eventDispatcher.dispatchDOMEvent(ea);
      } catch (e) { throw e; }
    });
  }
}