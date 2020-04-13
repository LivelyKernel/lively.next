/*global global, babel*/
import * as capturing from "./capturing.js";
export { capturing };
import { parseFunction, stringify, ReplaceVisitor } from "lively.ast";
import transformJSX from "babel-plugin-transform-jsx";

// fixme: this is a sort of bad placement
typeof babel !== 'undefined' && !babel.availablePlugins['transform-jsx'] && !(lively || global.lively).FreezerRuntime && babel.registerPlugin('transform-jsx', transformJSX.default);

export function stringifyFunctionWithoutToplevelRecorder(
  funcOrSourceOrAst,
  varRecorderName = "__lvVarRecorder"
) {
  // stringifyFunctionWithoutToplevelRecorder((x) => hello + x)
  // => x => hello + x
  // instead of String((x) => hello + x) // => x => __lvVarRecorder.hello + x
  // when run in toplevel scope
  if (typeof funcOrSourceOrAst === "function")
    funcOrSourceOrAst = String(funcOrSourceOrAst);

  if (lively.FreezerRuntime) {
    // rms 6.11.18: We currently try to not load lively.ast within the freezer context since it increases the payload
    //     of the core dependencies quite substantially. In turn perform a less sophisticated but mostly working
    //     find and replace of the recorder    
    return funcOrSourceOrAst.split(varRecorderName + '.').join('');
  }
  
  var parsed = typeof funcOrSourceOrAst === "string" ?
        parseFunction(funcOrSourceOrAst) : funcOrSourceOrAst,
      replaced = ReplaceVisitor.run(parsed, (node) => {
        var isVarRecorderMember = node.type === "MemberExpression"
                               && node.object.type === "Identifier"
                               && node.object.name === varRecorderName;
        return isVarRecorderMember ? node.property : node;
      });
  return stringify(replaced);
}

export function es5Transpilation(source) {
  
    if (typeof babel === 'undefined') {
      console.warn('[lively.freezer] Skipped async/await transpilation because babel not loaded.');
      return source;
    }
    let options = {
      sourceMap: undefined, // 'inline' || true || false
      inputSourceMap: undefined,
      babelrc: false,
      presets: [["es2015", {"modules": false}]],
      plugins: [
        'transform-exponentiation-operator', 'transform-async-to-generator',
        "syntax-object-rest-spread", "transform-object-rest-spread",
        ['transform-jsx', { "module": 'lively.ide/jsx/generator.js'}]
      ],
      code: true,
      ast: false
    };
    var sourceForBabel = source,
        transpiled = babel.transform(sourceForBabel, options).code;
    transpiled = transpiled.replace(/\}\)\.call\(undefined\);$/, "}).call(this)");
    if (transpiled.startsWith('(function') && transpiled.endsWith(');')) transpiled = transpiled.slice(1, -2);
    return transpiled;
}
