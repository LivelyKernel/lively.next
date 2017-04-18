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
      options = Object.assign({}, options);
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
        http = System._nodeRequire("http"),
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



function evalStrategy(morph) { return morph.state && morph.state.evalStrategy || new LivelyVmEvalStrategy(); }

function processEvalError(evalResult) {
  // produce a hopefully helpful string out of an error
  var {isError, value, warnings} = evalResult;
  console.assert(evalResult.isError, "processEvalError called with non-error eval result");
  var error = String(value),
      stack = value.stack,
      warning = warnings ? warnings.join("\n") : "";
  if (error.match(/syntaxerror/i) && warning.match(/syntaxerror/i)) {
    return warning + "\n\n" + error;
  }
  return stack || error;
}

var EvalableTextMorphTrait = {

  applyTo(obj, overrides = []) {
    var trait = this,
        dontCopy = ["applyTo"].concat(
                      lively.lang.arr.withoutAll(
                        lively.lang.properties.allProperties(obj), overrides));
    Object.keys(trait)
      .filter(key => !dontCopy.includes(key))
      .forEach(key => Object.defineProperty(obj, key, {configurable: true, get() { return trait[key]; }}));
    return obj;
  },

  async doit(printResult, editor, options) {
    try {
      options = Object.assign({
        inspect: !printResult,
        printDepth: this.printInspectMaxDepth,
        targetModule: this.moduleId(),
        context: this
      }, options);
      var result = await evalStrategy(this).runEval(this.getCodeForEval(), options),
          val = result.isError ? processEvalError(result) : result.value;
      if (printResult) {
        this.printObject(editor, val, false, this.getPrintItAsComment());
      } else {
        this[result.isError ? "showError" : "setStatusMessage"](val);
      }
      this.onDoitDone(result);
      return result;
    } catch (e) { this.showError(e); throw e; }
  },

  async printInspect(options) {
    options = options || {};
    var msgMorph = this._statusMorph,
        ed = await new Promise((resolve, reject) => this.withAceDo(resolve));

    if (msgMorph && msgMorph.world())
      return ed.execCommand('insertEvalResult');

    return this.doit(true, ed, {inspect: true, printDepth: options.depth || this.printInspectMaxDepth})
  },

  async evalSelection(printIt) {
    var options = {context: this, targetModule: this.moduleId(), asString: !!printIt},
        result = await evalStrategy(this).runEval(this.getCodeForEval(), options);
    if (printIt) this.insertAtCursor(result.value, true);
    return result;
  },

  async doListProtocol() {
    try {
      var m = lively.module("lively.ide.codeeditor.Completions");
      if (!m.isLoaded()) await m.load();
      var prefix = this.getCodeForCompletions(),
          completions = await evalStrategy(this).keysOfObject(
            prefix, {context: this, targetModule: this.moduleId()}),
          lister = new lively.ide.codeeditor.Completions.ProtocolLister(this);
      lister.openNarrower(completions);
      return lister;
    } catch (err) { this.showError(err); }
  },

  async doSave() {
    this.savedTextString = this.textString;
    if (this.getEvalOnSave()) {
      try {
        await lively.modules.moduleSourceChange(this.moduleId(), this.textString);
      } catch (e) { return this.showError(e); }
    }
    this.onSaveDone();
  },

  onDoitDone(result) {},
  onSaveDone() {},

  getAllCode()            { throw new Error(`getAllCode() not yet implemented for ${this.constructor.name}`); },
  getCodeForEval()        { throw new Error(`getCodeForEval() not yet implemented for ${this.constructor.name}`); },
  getCodeForCompletions() { throw new Error(`getCodeForCompletions() not yet implemented for ${this.constructor.name}`); },
  moduleId()              { throw new Error(`moduleId() not yet implemented for ${this.constructor.name}`); },
  printObject()           { throw new Error(`printObject() not yet implemented for ${this.constructor.name}`); },
  getPrintItAsComment()   { throw new Error(`getPrintItAsComment() not yet implemented for ${this.constructor.name}`); },
  insertAtCursor()        { throw new Error(`insertAtCursor() not yet implemented for ${this.constructor.name}`); },
  setStatusMessage()      { throw new Error(`setStatusMessage() not yet implemented for ${this.constructor.name}`); },
  setStatusMessage()      { throw new Error(`setStatusMessage() not yet implemented for ${this.constructor.name}`); },
  showError()             { throw new Error(`showError() not yet implemented for ${this.constructor.name}`); },

}

export {
  EvalStrategy,
  SimpleEvalStrategy,
  LivelyVmEvalStrategy,
  HttpEvalStrategy,
  EvalableTextMorphTrait
}
