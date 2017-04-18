import { L2LEvalStrategy } from "lively.vm/lib/eval-strategies.js";
import { RemoteCoreInterface } from "./interface.js";
import L2LClient from "lively.2lively/client.js";

export class L2LCoreInterface extends RemoteCoreInterface {

  constructor(targetId, targetInfo) {
    super();
    this.targetId = targetId;
    this.targetInfo = targetInfo;
  }

  get name() { return `l2l ${this.targetId}`; }

  runEval(source, options) {
    let l2lClient = L2LClient.forLivelyInBrowser(),
        l2lEval = new L2LEvalStrategy(l2lClient, this.targetId);
    return l2lEval.runEval(source, options);
  }

}
