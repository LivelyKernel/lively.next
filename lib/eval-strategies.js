"format esm";

class EvalStrategy {

  runEval(source, options) {
    return Promise.reject(`runEval(source, options) not yet implemented for ${this.constructor.name}`);
  }

  keysOfObject(prefix, options) {
    return Promise.reject(`keysOfObject(prefix, options) not yet implemented for ${this.constructor.name}`);
  }

}

class SimpleEvalStrategy extends EvalStrategy {

  runEval(source, options) {
    return Promise.resolve().then(() => {
      try {
        return {value: eval(source)};
      } catch (err) {
        return {isError: true, value: err}
      }
    });
  }

  async keysOfObject(prefix, options) {
    // for dynamic object completions
    var result = await lively.vm.completions.getCompletions(
      code => this.runEval(code, options), prefix);
    return {completions: result.completions, prefix: result.startLetters}
  }

}

class LivelyVmEvalStrategy extends EvalStrategy {

  runEval(source, options) {
    // lively.modules.System.config({meta: {[options.targetModule]: {format: "esm"}}});
    if (!options.targetModule)
      return Promise.reject(new Error("runEval called but options.targetModule not specified!"));

    var conf = {meta: {}}; conf.meta[options.targetModule] = {format: "esm"};
    lively.modules.System.config(conf);
  
    options = lively.lang.obj.merge({
      sourceURL: options.targetModule + "_doit_" + Date.now(),
      keepPreviouslyDeclaredValues: true
    }, options);
  
    return lively.vm.runEval(source, options);
  }

  async keysOfObject(prefix, options) {
    // for dynamic object completions
    var result = await lively.vm.completions.getCompletions(
      code => lively.vm.runEval(code, options), prefix);
    return {completions: result.completions, prefix: result.startLetters}
  }

}

class HttpEvalStrategy extends EvalStrategy {

  static get defaultURL() { return "https://localhost:3000/eval" }

  constructor(url) {
    super();
    this.url = url || this.constructor.defaultURL;
  }

  normalizeOptions(options) {
    options = Object.assign(
      {serverEvalURL: this.url},
      options,
      {context: null});
  }

  runEvalSource(source, options) {
    var sourceForServer =
      `var source = ${JSON.stringify(source)}\n`
    + `var options = ${JSON.stringify(options)}\n`
    + `options.context = `
    + `${LivelyVmEvalStrategy.prototype.runEval}\n`
    + `runEval(source, options)\n`;
    return sourceForServer
    
  }

  async runEval(source, options) {
    options = this.normalizeOptions(options);
    try {
      var payLoad = {method: "POST", body: this.runEvalSource(source, options)},
          stringValue = await (await window.fetch(options.serverEvalURL, payLoad)).text();
      return JSON.parse(stringValue);
    } catch (e) {
      return {isError: true, value: String(e.stack || e)};
    }
  }

  async keysOfObject(prefix, options) {
    options = Object.assign({serverEvalURL: this.url || this.constructor.defaultURL}, options);
    var url = options.serverEvalURL,
        sourceForServer = `var prefix = ${JSON.stringify(prefix)};\n`
                        + `var options = ${JSON.stringify(options)};\n`
                        + `${LivelyVmEvalStrategy.prototype.keysOfObject}\n`
                        + `vmCompletions(prefix, options);\n`,
        stringValue = await (await window.fetch(url, {method: "POST", body: sourceForServer})).text(),
        result = JSON.parse(stringValue);
    if (result.isError) throw new Error(result.value);
    return result;
  }
}



function evalStrategy(morph) { return morph.state && morph.state.evalStrategy || new LivelyVmEvalStrategy(); }

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
      var result = await evalStrategy(this).runEval(this.getCodeForEval(), options);
      if (printResult) {
        this.printObject(editor, result.value, false, this.getPrintItAsComment());
      } else {
        this.setStatusMessage(result.value);
      }
      this.onDoitDone(result);
      return result;
    } catch (e) { this.showError(e); throw e; }
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
