/*global System*/

function buildEvalOpts(morph, additionalOpts) {
  // FIXME, also in text/commands
  var env = {...morph.evalEnvironment, ...additionalOpts},
      {targetModule, context, format, remote} = env,
      context = context || morph,
      // targetModule = targetModule || "lively://lively.next-prototype_2016_08_23/" + morph.id,
      sourceURL = targetModule + "_doit_" + Date.now(),
      format = format || "esm";
  return {System, targetModule, format, context, sourceURL, remote};
}

export class DynamicJavaScriptCompleter {

  isValidPrefix(prefix) {
    return /\.[a-z0-9_]*$/i.test(prefix);
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
        _ = show(opts.targetModule),
        endpoint = opts.remote ? serverInterfaceFor(opts.remote) : localInterface,
        {completions, prefix} = await endpoint.dynamicCompletionsForPrefix(
                                  opts.targetModule, roughPrefix, opts),
        count = completions.reduce((sum, [_, completions]) => sum+completions.length, 0),
        priority = 2000,
        processed = completions.reduce((all, [protoName, completions], i) => {
          return all.concat(completions.map(ea =>
            ({info: protoName, completion: ea, prefix: prefix})))
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
