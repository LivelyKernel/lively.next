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
      keepPreviouslyDeclaredValues: true
    }, options);
  }

  async runEval(source, options) {
    options = this.normalizeOptions(options)
    var conf = {meta: {}}; conf.meta[options.targetModule] = {format: "esm"};
    lively.modules.System.config(conf);
    return lively.vm.runEval(source, options);
  }

  async keysOfObject(prefix, options) {
    // for dynamic object completions
    var result = await lively.vm.completions.getCompletions(
      code => lively.vm.runEval(code, options), prefix);
    return {completions: result.completions, prefix: result.startLetters}
  }

}

class HttpEvalStrategy extends LivelyVmEvalStrategy {

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

  sourceForServer(action, arg, options) {
    return `
(function() {
  var arg = ${JSON.stringify(arg)},
      options = ${JSON.stringify(options)};
  options.context = System.global;
  function evalFunction(source, options) {
    var conf = {meta: {}}; conf.meta[options.targetModule] = {format: "esm"};
    lively.modules.System.config(conf);
    return lively.vm.runEval(source, options);
  }
  function keysOfObjectFunction(prefix, options) {
    return lively.vm.completions.getCompletions(code => evalFunction(code, options), prefix)
      .then(result => ({completions: result.completions, prefix: result.startLetters}));
  }
  options.asString = ${action === "eval" ? "true" : "false"};
  return ${action === "eval" ? "evalFunction" : "keysOfObjectFunction"}(arg, options)
    .catch(err => ({isError: true, value: String(err.stack || err)}));
})();
`;
  }

  async sendRequest(payload, url) {
    var method = "sendRequest" + (System.get("@system-env").node ? "_node" : "_web");
    var content = await this[method](payload, url);
    try {
      return JSON.parse(content);
    } catch (e) {
      return {isError: true, value: `Server eval failed: ${content}`};
    }
  }

  async sendRequest_web(payload, url) {
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

  async sendRequest_node(payload, url) {
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

  async runEval(source, options) {
    options = this.normalizeOptions(options);
    var payLoad = {method: "POST", body: this.sourceForServer("eval", source, options)};
    return this.sendRequest(payLoad, options.serverEvalURL);
  }

  async keysOfObject(prefix, options) {
    options = this.normalizeOptions(options);
    var payLoad = {method: "POST", body: this.sourceForServer("keysOfObject", prefix, options)},
        result = await this.sendRequest(payLoad, options.serverEvalURL);
    if (result.isError) throw new Error(result.value);
    return result;
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
