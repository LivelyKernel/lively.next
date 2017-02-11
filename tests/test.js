/*global describe, it, beforeEach, afterEach*/
import { expect } from "mocha-es6";
import { string } from "lively.lang";
import Client from "../client.js";


import {
  h, create as createElement, diff, patch
} from "../node_modules/virtual-dom/dist/virtual-dom.js";

import {
  serialize as serializePatch, patch as patchSerialized
} from "lively.morphic-mirror/vdom-serialized-patch-browserified.js";
import { Morph, morph } from "lively.morphic";
import { pt } from "lively.graphics";
import Master from "../master.js";

function serializedH(/*args*/) {
  return JSON.parse(JSON.stringify(h.apply(null, arguments)));
}

var client, master;

// Array.from(Client.instances.keys())

describe("lively.mirror test", () => {

  beforeEach(() => {
    var clientId = `mirror-client-${string.newUUID()}`,
        clientRootNode = document.createElement("div");
    client = Client.createInstance(clientId, null, clientRootNode);
  });

  afterEach(() => {
    Client.removeInstance(client.id);
  });

  describe("client only", () => {

    it("creates client node", () => {
      expect(client.rootNode.innerHTML).match(/disconnected/);
      var node = serializedH("div.foo", {});
      Client.invokeServices("lively.morphic-mirror.render", {id: client.id, node});
      expect(client.rootNode.innerHTML).match(/div class="foo"/);
    });

    it("updates client node", () => {
      var node = serializedH("div.foo");
      Client.invokeServices("lively.morphic-mirror.render", {id: client.id, node});
      var patch = serializePatch(diff(h("div.foo"), h("div.foo.bar")));
      Client.invokeServices("lively.morphic-mirror.render-patch", {id: client.id, patch});
      expect(client.rootNode.innerHTML).match(/div class="foo bar"/);
    });

  });

  describe("client and master", () => {
  
    beforeEach(() => {
      var masterChannel = {send(selector, data) { return Client.invokeServices(selector, data); }};
      master = new Master(morph({extent: pt(20,30)}), masterChannel, client.id);
    });

    it("initializes and updates client from master", async () => {
      await master.sendUpdate();
      expect(client.rootNode.innerHTML).match(/width: 20px/);
      expect(client.rootNode.innerHTML).match(/height: 30px/);
      await master.sendUpdate();
      expect(client.rootNode.innerHTML).match(/height: 30px/);
      master.targetMorph.extent = pt(20, 40);
      await master.sendUpdate();
      expect(client.rootNode.innerHTML).match(/height: 40px/);
    });

    it("mirrors html morph", async () => {
      master.targetMorph.addMorph({type: "html", html: "<h1>test<\/h1>"});
      await master.sendUpdate();
      expect(client.rootNode.innerHTML).match(/<h1>test<\/h1>/);
    });
    
    it("mirrors and updates html morph", async () => {
      master.targetMorph.addMorph({type: "html", html: "<h1>test<\/h1>"});
      await master.sendUpdate();
      master.targetMorph.submorphs[0].html = "<h1>test2<\/h1>";
      await master.sendUpdate();
      expect(client.rootNode.innerHTML).match(/<h1>test2<\/h1>/);
    });

  });

});