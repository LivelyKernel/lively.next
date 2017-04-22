import { L2LEvalStrategy } from "lively.vm/lib/eval-strategies.js";
import { RemoteCoreInterface } from "./interface.js";

export class L2LCoreInterface extends RemoteCoreInterface {

  constructor(targetId, targetInfo) {
    super();
    this.targetId = targetId;
    this.targetInfo = targetInfo;
  }

  get name() { return `l2l ${this.targetId}`; }

  async runEval(source, options) {
    let {default: L2LClient} = await lively.modules.module("lively.2lively/client.js").load(),
        l2lClient = L2LClient.default();

    if (!l2lClient) {
      throw new Error("No lively.2lively default client available!");
    }

    let l2lEval = new L2LEvalStrategy(l2lClient, this.targetId);
    return l2lEval.runEval(source, options);
  }

}
