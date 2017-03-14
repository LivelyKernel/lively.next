export default class ExpressionSerializer {

  constructor(opts) {
    var {prefix} = {
      prefix: "__lv_expr__",
      ...opts
    }
    this.prefix = prefix + ":";
  }

  isSerializedExpression(string) {
    return string.indexOf(this.prefix) === 0;
  }

  requiredModulesOf__expr__(__expr__) {
    if (!this.isSerializedExpression(__expr__)) return null;
    var {bindings} = this.exprStringDecode(__expr__);
    return bindings ? Object.keys(bindings) : null;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // encode / decode of serialized expressions
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  exprStringDecode(string) {
    // 1. read prefix
    // string = "_prefix:{foo}:package/foo.js:foo()"
    // => {expr: "foo()", bindings: {"package/foo.js": ["foo"]}}

    let idx = string.indexOf(":"),
        prefix = string.slice(0, idx),
        rest = string.slice(idx+1),
        bindings = {},
        hasBindings = false;

    // 2. bindings?
    while (rest && rest.startsWith("{") && (idx = rest.indexOf("}:")) >= 0) {
      hasBindings = true;
      let importedVars = rest.slice(1,idx);
      rest = rest.slice(idx+2); // skip }:
      idx = rest.indexOf(":"); // end of package
      let from = rest.slice(0, idx),
          imports = importedVars.split(",")
            .filter(ea => Boolean(ea.trim()))
            .map(ea => {
              if (!ea.includes(":")) return ea;
              let [exported, local] = ea.split(":");
              return {exported, local};
            })
      bindings[from] = imports;
      rest = rest.slice(idx+1); // skip :
    }

    return {__expr__: rest, bindings: hasBindings ? bindings : null};
  }

  exprStringEncode({__expr__, bindings}) {
    // {expr: "foo()", bindings: {"package/foo.js": ["foo"]}}
    // => "_prefix:{foo}:package/foo.js:foo()"

    var string = String(__expr__);
    if (bindings) {
      var keys = Object.keys(bindings);
      for (var i = 0; i < keys.length; i++) {
        var from = keys[i];
        string = `{${bindings[from].join(",")}}:${from}:${string}`
      }
    }
    return this.prefix + string
  }


  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // serialization
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  
  convert__expr__obj(obj) {
    // obj.__expr__ is encoded serialized expression *without* prefix
    console.assert("__expr__" in obj, "obj has no property __expr__");
    return this.prefix + obj.__expr__;
  }

  
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // deserialization
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  // note __boundValues__ becomes a dynamically scoped "variable" inside eval
  __eval__(__source__, __boundValues__) { return eval(__source__) }

  deserializeExpr(encoded) {
    if (!encoded.startsWith(this.prefix))
      throw new Error(`"${encoded}" is not a serialized expression, missing prefix "${this.prefix}"`);
    return this.deserializeExprObj(this.exprStringDecode(encoded));
  }

  deserializeExprObj({__expr__: source, bindings}) {

    let __boundValues__ = {};

    if (bindings) {
      let mods = bindings ? Object.keys(bindings) : [];

      // synchronously get modules specified in bindings object and pull out
      // the vars needed for evaluating source. Add those to __boundValues__
      for (let i = 0; i < mods.length; i++) {
        let modName = mods[i],
            vars = bindings[modName],
            exports = System.get(System.decanonicalize(modName));
        if (!exports)
          throw new Error(`[lively.serializer] expression eval: bindings specify to import ${modName} but this module is not loaded!`);

        for (let j = 0; j < vars.length; j++) {
          let varName = vars[j], local, exported;
          if (typeof varName === "string") {
            local = varName; exported = varName;
          } else if (typeof varName === "object") { // alias
            ({local, exported}) = varName;
          }
          __boundValues__[local] = exports[exported];
          source = `var ${local} = __boundValues__.${local};\n${source}`;
        }
      }
    }

    // evaluate
    return this.__eval__(source, __boundValues__);
  }

}