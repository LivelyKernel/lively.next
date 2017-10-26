/*global System*/
import { obj } from "lively.lang";

class EvalStrategy {

  async runEval(source, options) {
    return Promise.reject(`runEval(source, options) not yet implemented for ${this.constructor.name}`);
  }

  async keysOfObject(prefix, options) {
    return Promise.reject(`keysOfObject(prefix, options) not yet implemented for ${this.constructor.name}`);
  }

}

class SimpleEvalStrategy extends EvalStrategy {

  async runEval(source, options) {
    return Promise.resolve().then(() => {
      try {
        return Promise.resolve({value: eval(source)});
      } catch (err) {
        return {isError: true, value: err}
      }
    });
  }

  async keysOfObject(prefix, options) {
    // for dynamic object completions
    var result = await lively.vm.completions.getCompletions(
      code => this.runEval(code, options), prefix);
    return {completions: result.completions, prefix: result.startLetters};
  }

}

class LivelyVmEvalStrategy extends EvalStrategy {

  normalizeOptions(options) {
    if (!options.targetModule)
      throw new Error("runEval called but options.targetModule not specified!");

    return Object.assign({
      sourceURL: options.targetModule + "_doit_" + Date.now(),
    }, options);
  }

  async runEval(source, options) {
    options = this.normalizeOptions(options)
    var System = options.System || lively.modules.System;
    System.config({meta: {[options.targetModule]: {format: "esm"}}});
    return lively.vm.runEval(source, options);
  }

  async keysOfObject(prefix, options) {
    // for dynamic object completions
    var result = await lively.vm.completions.getCompletions(
      code => lively.vm.runEval(code, options), prefix);
    return {completions: result.completions, prefix: result.startLetters}
  }

}


export class RemoteEvalStrategy extends LivelyVmEvalStrategy {

  sourceForRemote(action, arg, options) {
    options = obj.dissoc(options, ["systemInterface", "System", "context"]);
    return `
(function() {
  var arg = ${JSON.stringify(arg)},
      options = ${JSON.stringify(options)};
  if (typeof lively === "undefined" || !lively.vm) {
    return Promise.resolve({
      isEvalResult: true,
      isError: true,
      value: 'lively.vm not available!'
    });
  }
  var hasSystem = typeof System !== "undefined"
  options.context = hasSystem
    ? System.global
    : typeof window !== "undefined"
        ? window
        : typeof global !== "undefined"
            ? global
            : typeof self !== "undefined" ? self : this;
  function evalFunction(source, options) {
    if (hasSystem) {
      var conf = {meta: {}}; conf.meta[options.targetModule] = {format: "esm"};
      System.config(conf);
    } else {
      options = Object.assign({topLevelVarRecorderName: "GLOBAL"}, options);
      delete options.targetModule;
    }
    return lively.vm.runEval(source, options);
  }
  function keysOfObjectFunction(prefix, options) {
    return lively.vm.completions.getCompletions(code => evalFunction(code, options), prefix)
      .then(result => ({isEvalResult: true, completions: result.completions, prefix: result.startLetters}));
  }
  return ${action === "eval" ? "evalFunction" : "keysOfObjectFunction"}(arg, options)
    .catch(err => ({isEvalResult: true, isError: true, value: String(err.stack || err)}));
})();
`;
  }

  async runEval(source, options) {
    return this.remoteEval(this.sourceForRemote("eval", source, options), options)
  }

  async keysOfObject(prefix, options) {
    return this.remoteEval(this.sourceForRemote("keysOfObject", prefix, options), options)
  }

  async remoteEval(source, options) {
    try {
      var result = await this.basicRemoteEval(source, options)
      return typeof result === "string" ? JSON.parse(result) : result;
    } catch (e) {
      return {isError: true, value: `Remote eval failed: ${result || e}`};
    }
  }

  async basicRemoteEval(source, options) {
    throw new Error("Not yet implemented");
  }

}


class HttpEvalStrategy extends RemoteEvalStrategy {

  static get defaultURL() { return "http://localhost:3000/lively" }

  constructor(url) {
    super();
    this.url = url || this.constructor.defaultURL;
  }

  normalizeOptions(options) {
    options = super.normalizeOptions(options);
    return Object.assign(
      {serverEvalURL: this.url},
      options,
      {context: null});
  }

  async basicRemoteEval(source, options) {
    options = this.normalizeOptions(options);
    var method = "basicRemoteEval_" + (System.get("@system-env").node ? "node" : "web");
    return await this[method]({method: "POST", body: source}, options.serverEvalURL);
  }

  async basicRemoteEval_web(payload, url) {
    let [domain] = url.match(/[^:]+:\/\/[^\/]+/) || [url],
        crossDomain = document.location.origin !== domain;

    if (crossDomain) { // use lively.server proxy plugin
      payload.headers = {
        ...payload.headers,
        'pragma': 'no-cache',
        'cache-control': 'no-cache',
        "x-lively-proxy-request": url
      }
      url = document.location.origin;
    }

    var res;
    try {
      res = await window.fetch(url, payload);
    } catch (e) {
      throw new Error(`Cannot reach server at ${url}: ${e.message}`)
    }

    if (!res.ok) {
      throw new Error(`Server at ${url}: ${res.statusText}`)
    }

    return res.text();
  }

  async basicRemoteEval_node(payload, url) {
    var urlParse = System._nodeRequire("url").parse,
        http = System._nodeRequire(url.startsWith("https:") ? "https" : "http"),
        opts = Object.assign({method: payload.method || "GET"}, urlParse(url));
    return new Promise((resolve, reject) => {
      var request = http.request(opts, res => {
        res.setEncoding('utf8');
        var data = "";
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => resolve(data));
        res.on('error', err => reject(err));
      })
      request.on('error', err => reject(err));
      request.end(payload.body)
    });
  }

}

class L2LEvalStrategy extends RemoteEvalStrategy {

  constructor(l2lClient, targetId) {
    super();
    this.l2lClient = l2lClient;
    this.targetId = targetId;
  }

  async basicRemoteEval(source, options) {
    let {l2lClient, targetId} = this,
        {data: evalResult} = await new Promise((resolve, reject) =>
          l2lClient.sendTo(targetId, "remote-eval", {source}, resolve));
    if (evalResult && evalResult.value && evalResult.value.isEvalResult)
      evalResult = evalResult.value;
    return evalResult;
  }

}


export {
  EvalStrategy,
  SimpleEvalStrategy,
  LivelyVmEvalStrategy,
  HttpEvalStrategy,
  L2LEvalStrategy
}
