/*global System*/

function buildEvalOpts(morph, additionalOpts) {
  // FIXME, also in text/commands
  var env = {...morph.evalEnvironment, ...additionalOpts},
      {targetModule, context, format, remote} = env,
      context = context || morph,
      // targetModule = targetModule || "lively://lively.next-prototype_2016_08_23/" + morph.id,
      sourceURL = targetModule + "_doit_" + Date.now(),
      format = format || "esm";
  return remote ?
    {targetModule, format, sourceURL, remote} : 
    {System, targetModule, format, context, sourceURL}
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
    if (!isNaN(n)) return `[${completion}]`;
    var trailing = "";
    if (this.isMethodCallCompletion(completion)) {
      trailing = completion.slice(completion.indexOf("("));
      completion = completion.slice(0, completion.indexOf("("));
    }
    return `["${completion.replace(/\"/g, '\\"')}"]${trailing}`;
  }

  async compute(textMorph) {
    let sel = textMorph.selection,
        roughPrefix = sel.isEmpty() ? textMorph.getLine(sel.lead.row).slice(0, sel.lead.column) : sel.text;

    if (!this.isValidPrefix(roughPrefix)) return [];

    // FIXME this should got into a seperate JavaScript support module where
    // the dependency can be properly declared
    var {serverInterfaceFor, localInterface} = System.get(
      System.decanonicalize("lively-system-interface"))

    if (!serverInterfaceFor || !localInterface) return [];

    var opts = buildEvalOpts(textMorph),
        endpoint = opts.remote ? serverInterfaceFor(opts.remote) : localInterface,
        {isError, value: err, completions, prefix} = await endpoint.dynamicCompletionsForPrefix(
                                                      opts.targetModule, roughPrefix, opts);

    if (isError) {
      console.warn(`javascript completer encountered error: ${err.stack || err}`)
      return [];
    }

    var count = completions.reduce((sum, [_, completions]) => sum+completions.length, 0),
        priority = 2000,
        processed = completions.reduce((all, [protoName, completions], i) => {
          return all.concat(completions.map(ea => ({
            info: protoName,
            completion: ea,
            customInsertionFn: this.isValidIdentifier(ea) ? null :
              (complString, prefix, textMorph, {start, end}) => {
                var before = {row: start.row, column: start.column-1},
                    range = textMorph.textInRange({start: before, end: start}) === "." ?
                      {start: before, end} : {start, end};
                textMorph.replace(range, this.wrapInBrackets(ea));
              },
            prefix: this.isValidIdentifier(ea) ? prefix : "." + prefix
          })))
        }, []);

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
  new JavaScriptKeywordCompleter()
]
