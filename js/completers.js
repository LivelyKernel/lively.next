/*global System*/

function buildEvalOpts(morph, additionalOpts) {
  let p = morph.plugins.find(p => p.isJSEditorPlugin)
  return p.sanatizedJsEnv(additionalOpts);
}

export class ModuleTopLevelVarCompleter {

  async compute(textMorph, prefix) {

    let p = textMorph.pluginFind(p => p.isJSEditorPlugin),
        endpoint = p && p.systemInterface();

    if (!endpoint) return [];

    var opts = buildEvalOpts(textMorph),
        m = opts.targetModule, names

    if (endpoint.name !== "local") {
      var result = await endpoint.runEval(`
        var result, livelySystem = typeof System !== "undefined"
                      && System.get(System.decanonicalize("lively-system-interface"));
        if (livelySystem) {
          result = JSON.stringify(
            Object.getOwnPropertyNames(livelySystem.localInterface.getModule("${m}").recorder));
        } else {
          var G = typeof window !== "undefined" ?
            window : typeof global !== "undefined" ? global : this;
          result = JSON.stringify(Object.getOwnPropertyNames(G));
        }
        result;
      `, {targetModule: "lively://module-recorder-completer"})
      if (result.isError) return [];
      names = JSON.parse(result.value);

    } else {
      names = Object.getOwnPropertyNames(endpoint.getModule(m).recorder);
    }

    names = names.filter(
      ea => !ea.startsWith("defVar_") &&
        !["System", "__currentLivelyModule", "initializeES6ClassForLively",
          "_moduleExport", "_moduleImport"].includes(ea));

    var basePriority = 1100;
    return names.map(ea => ({priority: basePriority, completion: ea}));
  }

}

export class DynamicJavaScriptCompleter {

  isValidPrefix(prefix) {
    return /\.[a-z0-9_]*$/i.test(prefix);
  }

  isMethodCallCompletion(completion) {
    return completion.endsWith(")") && completion.indexOf("(") > 0;
  }

  isValidIdentifier(completion) {
    if (typeof completion !== "string") return false;
    // method call completion like foo(bar)
    if (this.isMethodCallCompletion(completion))
      completion = completion.slice(0, completion.indexOf("("));
    if (/^[a-z_\$][0-9a-z_\$]*$/i.test(completion)) return true;
    return false;
  }

  wrapInBrackets(completion) {
    var n = Number(completion);
    if (!isNaN(n) || completion.startsWith("Symbol.")) return `[${completion}]`;
    var trailing = "";
    if (this.isMethodCallCompletion(completion)) {
      trailing = completion.slice(completion.indexOf("("));
      completion = completion.slice(0, completion.indexOf("("));
    }
    return `["${completion.replace(/\"/g, '\\"')}"]${trailing}`;
  }

  async compute(textMorph) {
    let sel = textMorph.selection,
        roughPrefix = sel.isEmpty() ?
          textMorph.getLine(sel.lead.row).slice(0, sel.lead.column) : sel.text;

    if (!this.isValidPrefix(roughPrefix)) return [];

    let p = textMorph.pluginFind(p => p.isJSEditorPlugin),
        endpoint = p && p.systemInterface();

    if (!endpoint) return [];

    var opts = buildEvalOpts(textMorph),
      {
        isError,
        value: err,
        completions,
        prefix
      } = await endpoint.dynamicCompletionsForPrefix(opts.targetModule, roughPrefix, opts);

    if (isError) {
      console.warn(`javascript completer encountered error: ${err.stack || err}`)
      return [];
    }

    var count = completions.reduce((sum, [_, completions]) => sum+completions.length, 0),
        priority = 2000,
        processed = completions.reduce((all, [protoName, completions], i) =>
          all.concat(completions.map(ea => {
            var isValidIdentifier = this.isValidIdentifier(ea);
            return {
              info: protoName,
              completion: ea,
              prefix: isValidIdentifier ? prefix : "." + prefix,
              customInsertionFn: isValidIdentifier ? null :
                (complString, prefix, textMorph, {start, end}) => {
                  var before = {row: start.row, column: start.column-1},
                      range = textMorph.textInRange({start: before, end: start}) === "." ?
                        {start: before, end} : {start, end};
                  textMorph.replace(range, this.wrapInBrackets(ea));
                },
            }
          })), []);

    // assign priority:
    processed.forEach((ea,i) => Object.assign(ea, {priority: priority+processed.length-i}));
    return processed
  }

}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

const keywords = [
  "arguments",
  "boolean",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "eval",
  "export",
  "import",
  "extends",
  "false",
  "true",
  "finally",
  "instanceof",
  "static",
  "super",
  "this",
  "throw",
  "typeof",
  "while",
  "with",
  "yield",
  "await",

  "Array",
  "Date",
  "eval",
  "function",
  "hasOwnProperty",
  "Infinity",
  "isFinite",
  "isNaN",
  "isPrototypeOf",
  "length",
  "Math",
  "NaN",
  "name",
  "Number",
  "Object",
  "prototype",
  "String",
  "toString",
  "undefined",
  "valueOf",

  "alert",
  "assign",
  "clearInterval",
  "clearTimeout",
  "decodeURI",
  "decodeURIComponent",
  "document",
  "encodeURI",
  "encodeURIComponent",
  "escape",
  "navigator",
  "parseFloat",
  "parseInt",
  "setInterval",
  "setTimeout",
  "window",
  "document",
  "requestAnimationFrame",
  "cancelAnimationFrame",
]

export class JavaScriptKeywordCompleter {

  compute(textMorph, prefix) {
    return keywords.map(ea => ({completion: ea, priority: 0}))
  }

}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

export var completers = [
  new DynamicJavaScriptCompleter(),
  new JavaScriptKeywordCompleter(),
  new ModuleTopLevelVarCompleter()
]
