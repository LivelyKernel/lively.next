import { HttpEvalStrategy } from "lively.vm/lib/eval-strategies.js";
import { RemoteCoreInterface } from "./interface.js";

export class HTTPCoreInterface extends RemoteCoreInterface {

  constructor(url) {
    super();
    this.currentEval = null;
    this.url = url;
    this.server = new HttpEvalStrategy(url);
  }

  get name() { return this.url; }

  get description() { return this.url.replace(/^https?:\/\//, ""); }

  runEval(source, options) {
    return this.server.runEval(source, options);
  }

}
