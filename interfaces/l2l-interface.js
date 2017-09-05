import { L2LEvalStrategy } from "lively.vm/lib/eval-strategies.js";
import { RemoteCoreInterface } from "./interface.js";

export class L2LCoreInterface extends RemoteCoreInterface {

  constructor(targetId, peer) {
    super();
    this.targetId = targetId;
    this.peer = peer;
  }

  get name() { return `l2l ${this.targetId}`; }

  get description() {
    let {targetId, peer} = this,
        id = targetId.slice(0,5),
        name = `l2l ${id}`;
    if (peer) {
      let {location, type, user, world} = peer;
      if (type) name += `, ${type}`;
      if (location) name += `, ${location.replace(/^https?:\/\//, "")}${world ? "/" + world : ""}`;
      if (user) name += `, ${user.name}`;
    }
    return name;
  }

  get client() {
    let {default: L2LClient} = lively.modules.module("lively.2lively/client.js").get();
    return L2LClient.default();
  }

  async isConnected() {
    let {client, targetId} = this,
        {data: clients} = await client.sendToAndWait(client.trackerId, "getClients", {});
    return clients.some(([id]) => targetId === id);
  }

  async runEval(source, options) {
    let l2lClient = this.client;
    if (!l2lClient) {
      throw new Error("No lively.2lively default client available!");
    }

    let l2lEval = new L2LEvalStrategy(l2lClient, this.targetId);
    return l2lEval.runEval(source, options);
  }

}
