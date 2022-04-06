/* global global, babel */
import { parseFunction, parse, stringify, ReplaceVisitor } from 'lively.ast';
import { QueryReplaceManyVisitor } from 'lively.ast/lib/visitors.js';
import transformJSX from 'babel-plugin-transform-jsx';
import catchBinding from 'babel-catch-binding';
import importMeta from 'babel-import-meta';

import * as capturing from './capturing.js';
export { capturing };

// fixme: this is a sort of bad placement

function ensureJSXPlugin () {
  if (!transformJSX) return;
  typeof babel !== 'undefined' && !babel.availablePlugins['transform-jsx'] && !(lively || global.lively).FreezerRuntime && babel.registerPlugin('transform-jsx', transformJSX.default);
}

function ensureOptionalCatchBinding () {
  if (!catchBinding) return;
  typeof babel !== 'undefined' && !babel.availablePlugins['optional-catch-binding'] && !(lively || global.lively).FreezerRuntime && babel.registerPlugin('optional-catch-binding', catchBinding.default);
}

function ensureImportMeta () {
  if (!importMeta) return;
  typeof babel !== 'undefined' && !babel.availablePlugins['syntax-import-meta'] && !(lively || global.lively).FreezerRuntime && babel.registerPlugin('syntax-import-meta', importMeta.default);
}

export function stringifyFunctionWithoutToplevelRecorder (
  funcOrSourceOrAst,
  varRecorderName = '__lvVarRecorder'
) {
  ensureJSXPlugin();
  // stringifyFunctionWithoutToplevelRecorder((x) => hello + x)
  // => x => hello + x
  // instead of String((x) => hello + x) // => x => __lvVarRecorder.hello + x
  // when run in toplevel scope
  if (typeof funcOrSourceOrAst === 'function') { funcOrSourceOrAst = String(funcOrSourceOrAst); }

  if (lively.FreezerRuntime) {
    // rms 6.11.18: We currently try to not load lively.ast within the freezer context since it increases the payload
    //     of the core dependencies quite substantially. In turn perform a less sophisticated but mostly working
    //     find and replace of the recorder
    return funcOrSourceOrAst.split(varRecorderName + '.').join('');
  }

  if (typeof funcOrSourceOrAst === 'string' && funcOrSourceOrAst.endsWith(';')) {
    funcOrSourceOrAst = funcOrSourceOrAst.slice(0, -1);
  }

  const parsed = typeof funcOrSourceOrAst === 'string'
    ? parseFunction(funcOrSourceOrAst)
    : funcOrSourceOrAst;
  const replaced = ReplaceVisitor.run(parsed, (node) => {
    const isVarRecorderMember = node.type === 'MemberExpression' &&
                               node.object.type === 'Identifier' &&
                               node.object.name === varRecorderName;
    return isVarRecorderMember ? node.property : node;
  });
  return stringify(replaced);
}

export function es5Transpilation (source) {
  if (typeof babel === 'undefined') {
    console.warn('[lively.freezer] Skipped async/await transpilation because babel not loaded.');
    return source;
  }
  ensureJSXPlugin();
  ensureOptionalCatchBinding();
  ensureImportMeta();
  const options = {
    sourceMap: undefined, // 'inline' || true || false
    inputSourceMap: undefined,
    babelrc: false,
    presets: [['es2015', { modules: false }]],
    plugins: [
      'transform-exponentiation-operator', 'transform-async-to-generator',
      'syntax-object-rest-spread', 'transform-object-rest-spread'
      // 'syntax-import-meta', 'optional-catch-binding',
      // ['transform-jsx', { "module": 'lively.ide/jsx/generator.js'}]
    ],
    code: true,
    ast: false
  };

  // System.babelOptions.plugins.push('optional-catch-binding')

  const sourceForBabel = source;
  let transpiled = babel.transform(sourceForBabel, options).code;
  transpiled = transpiled.replace(/\}\)\.call\(undefined\);$/, '}).call(this)');
  if (transpiled.startsWith('(function') && transpiled.endsWith(');')) transpiled = transpiled.slice(1, -2);
  return transpiled;
}

export function ensureModuleMetaForComponentDefinition (translated, moduleName, recorderName) {
  return QueryReplaceManyVisitor.run(
    typeof translated == 'string' ? parse(translated) : translated, `
         // ExpressionStatement [
              /:expression AssignmentExpression [
                  /:left MemberExpression [
                    /:property Identifier [ @name ]
                  ]
               && /:right CallExpression [
                     (/:callee MemberExpression [
                           /:property Identifier [ @name == 'component' ]
                        && /:object Identifier [ @name == '${recorderName}' ]
                       ])
                     ||
                     (/:arguments "*" [
                       CallExpression [
                        /:callee MemberExpression [
                           /:property Identifier [ @name == 'component' ]
                        && /:object Identifier [ @name == '${recorderName}' ]
                          ]
                       ]
                     ])
                   ]
                ]
              ]`,
    (node) => {
      const exp = node.expression;
      return [exp, ...parse(`${stringify(exp.left)}[Symbol.for('lively-module-meta')] = { module: "${moduleName}", export: "${exp.left.property.name}"};`).body];
    });
}

export function ensureComponentDescriptors (translated, moduleName) {
  return QueryReplaceManyVisitor.run(
    typeof translated == 'string' ? parse(translated) : translated, `
         // VariableDeclarator [
              /:id Identifier [ @name ]
               && /:init CallExpression [
                   (/:callee Identifier [ @name == 'component'])
                 ]
              ]`,
    (node) => {
      const componentRef = node.id.name;
      // replace the expression with ComponentDescriptor...
      return parse(`const ${componentRef} = component.for(() => component(${node.init.arguments.map(n => stringify(n)).join(',')}), { module: "${moduleName}", export: "${componentRef}"}, ${componentRef})`).body[0].declarations;
    });
}
