/* global global, babel */
import { parseFunction, parse, stringify, ReplaceVisitor, nodes } from 'lively.ast';
import { QueryReplaceManyVisitor } from 'lively.ast/lib/visitors.js';
import catchBinding from '@babel/plugin-syntax-import-meta';
import importMeta from '@babel/plugin-syntax-import-meta';

import * as capturing from './capturing.js';
import { topLevelDeclsAndRefs, queryNodes } from 'lively.ast/lib/query.js';
import { arr } from 'lively.lang';
export { capturing };

// fixme: this is a sort of bad placement

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
  if (typeof babel === 'undefined') { return source; }
  ensureOptionalCatchBinding();
  ensureImportMeta();
  const options = {
    sourceMap: undefined, // 'inline' || true || false
    inputSourceMap: undefined,
    babelrc: false,
    presets: [['es2015', { modules: false }]],
    plugins: [
      'transform-exponentiation-operator', 'transform-async-to-generator',
      'syntax-object-rest-spread', 'proposal-object-rest-spread',
      'proposal-optional-chaining'
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

export function ensureComponentDescriptors (translated, moduleName, recorderName) {
  // check first for top level decls
  translated = typeof translated == 'string' ? parse(translated) : translated;
  let { varDecls } = topLevelDeclsAndRefs(translated);
  varDecls = arr.compact(varDecls.map(m => m.declarations && m.declarations[0]));

  if (queryNodes(translated.body[0], `ExpressionStatement [  (/:expression CallExpression [
       (/:callee Identifier [ @name == 'component'])
     ])
   ]`).length > 0) {
    const node = translated.body[0];
    const spec = node.expression.arguments.map(n => stringify(n)).join(',');
    return parse(`component.for(() => component(${spec}), { module: "${moduleName}" })`);
  }
  return QueryReplaceManyVisitor.run(
    translated, `
         // VariableDeclarator [
              /:id Identifier [ @name ]
               && /:init CallExpression [
                   (/:callee Identifier [ @name == 'component'])
                 ]
              ]`,
    (node) => {
      const isCaptured = varDecls.includes(node);
      const componentRef = node.id.name;
      const spec = node.init.arguments.map(n => stringify(n)).join(',');
      // FIXME: the local name here is not nessecarily the export
      return parse(`const ${componentRef} = component.for(() => component(${spec}), { module: "${moduleName}", export: "${componentRef}", range: { start: ${node.start}, end: ${node.end}}}, System${ isCaptured ? ', ' + `${recorderName}, "${componentRef}"` : ''})`).body[0].declarations;
    });
}

export function replaceExportedVarDeclarations (translated, recorderName, moduleName) {
  translated = QueryReplaceManyVisitor.run(
    translated, `
         // ExportNamedDeclaration [
               /:declaration VariableDeclaration
            ]`,
    (exportNamedDeclaration) => {
      const variableDeclaration = exportNamedDeclaration.declaration;
      const exportedVariable = variableDeclaration.declarations?.[0];
      return [variableDeclaration, parse(`var ${exportedVariable.id.name}; export { ${exportedVariable.id.name} }`).body[1]];
    });

  if (moduleName.includes('lively.morphic/config.js')) {
    for (let i = 0; i < translated.body.length; i++) {
      const node = translated.body[i];
      if (node.type === 'VariableDeclaration' && node.declarations?.[0].init?.type === 'ObjectExpression') {
        const { id, init } = node.declarations[0];
        node.declarations[0].init = nodes.logical('||', parse(`${recorderName}.${id.name}`).body[0].expression, init);
      }
    }
  }

  return translated;
}

export async function replaceImportedNamespaces (translated, moduleName, bundler) {
  // namespace that are directly imported or getting re-exported need to be chanelled through the module recorder
  const namespaceVars = [];
  // such that the namespaces are getting correctly updated in case a module is getting revived

  translated = QueryReplaceManyVisitor.run(
    translated, `
         // ImportDeclaration [
               /:specifiers
                 ImportNamespaceSpecifier [
                   /:local Identifier
                 ]
             ]`,
    (importDecl) => {
      let dep = bundler.resolveId(importDecl.source.value, moduleName);
      let name = importDecl.specifiers[0]?.local?.name;
      if (name) {
        namespaceVars.push([name, dep]);
        importDecl.specifiers[0].local.name += '_namespace';
      }
      return importDecl;
    });

  // now we have to insert the the assignments of the tmp namespace imports to the initial names,
  // but filtered by the recorder object
  const insertFromIdx = translated.body.indexOf(translated.body.find(n => n.type !== 'ImportDeclaration'));
  for (let [namespaceVar, importedModule] of namespaceVars) {
    arr.pushAt(translated.body, parse(`const ${namespaceVar} = (lively.FreezerRuntime || lively.frozenModules).exportsOf("${bundler.normalizedId(await importedModule)}") || ${namespaceVar}_namespace;`).body[0], insertFromIdx);
  }
  return translated;
}
