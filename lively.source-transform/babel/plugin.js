import { rewriteToCaptureTopLevelVariables, getScopeFromPath } from './transforms/scope-capturing.js';
export { rewriteToCaptureTopLevelVariables, getScopeFromPath } from './transforms/scope-capturing.js';
import { varDecl } from './helpers.js';
import { ensureComponentDescriptors } from './transforms/component.js';
export { ensureComponentDescriptors } from './transforms/component.js';
export { replaceExportedVarDeclarations } from './transforms/export-split.js';
export { replaceExportedNamespaces, replaceImportedNamespaces } from './transforms/namespace.js';
import { rewriteToRegisterModuleToCaptureSetters } from './transforms/systemjs.js';
import { babel, t, cjsDefault, isBrowserSystem, isNodeSystem } from './ast.js';
/* global require,global */
import _systemjsTransform from '@babel/plugin-transform-modules-systemjs';
import _dynamicImport from '@babel/plugin-proposal-dynamic-import';
import { arr, Path } from 'lively.lang';
import { query } from 'lively.ast';
import { topLevelFuncDecls } from 'lively.ast/lib/visitors.js';
import { classToFunctionTransformBabel } from 'lively.classes';
import { getGlobal } from 'lively.vm/lib/util.js';

const systemjsTransform = cjsDefault(_systemjsTransform, 'visitor', '@babel/plugin-transform-modules-systemjs');
const dynamicImport = cjsDefault(_dynamicImport, 'visitor', '@babel/plugin-proposal-dynamic-import');

export function babel_parse (source) {
  return babel.parse(source).program.body;
}

export const defaultDeclarationWrapperName = 'lively.capturing-declaration-wrapper';
export const defaultClassToFunctionConverter = t.Identifier('initializeES6ClassForLively');

export const babelNodes = {
  member: t.MemberExpression,
  property: t.ObjectProperty,
  property: (kind, key, val) => t.ObjectProperty(key, val),
  varDecl,
  parse: src => babel.parse(src).program,
  assign: t.AssignmentExpression,
  assignPattern: t.AssignmentPattern,
  id: t.Identifier,
  block: t.BlockStatement,
  literal: (v) => typeof v === 'string' ? t.StringLiteral(v) : t.NumericLiteral(v),
  forInStmt: t.ForInStatement,
  continueStmt: t.ContinueStatement,
  objectLiteral: t.ObjectExpression,
  objectProperty: t.ObjectProperty,
  declareVariable: t.DeclareVariable,
  logicalExpr: t.LogicalExpression,
  exportNamedDeclaration: t.ExportNamedDeclaration,
  exportSpecifier: t.ExportSpecifier,
  ifStmt: t.IfStatement,
  funcExpr: t.FunctionExpression,
  arrowFuncExpr: t.ArrowFunctionExpression,
  sqncExpr: t.SequenceExpression,
  exprStmt: t.ExpressionStatement,
  unaryExpr: t.UnaryExpression,
  conditional: t.ConditionalExpression,
  binaryExpr: t.BinaryExpression,
  funcCall: t.CallExpression,
  arrayExpr: t.ArrayExpression,
  returnStmt: t.ReturnStatement,
  exportDefaultDecl: t.ExportDefaultDeclaration
};

function processInlineCodeTransformOptions (path, options) {
  if (!path.node.comments) return options;
  let livelyComment = path.node.comments.map(ea => ea.value).find(v => v?.startsWith('lively.vm '));
  if (!livelyComment) return options;
  try {
    let inlineOptions = eval('({' + livelyComment.slice('lively.vm '.length) + '});');
    return Object.assign(options, inlineOptions);
  } catch (err) { return options; }
}

function wrapInStartEndCall (path, options, parsed) {
  // Wraps a piece of code into two function calls: One before the first
  // statement and one after the last. Also wraps the entire thing into a try /
  // catch block. The end call gets the result of the last statement (if it is
  // something that returns a value, i.e. an expression) passed as the second
  // argument. If an error occurs the end function is called with an error as
  // first parameter
  // Why? This allows to easily track execution of code, especially for
  // asynchronus / await code!
  // Example:
  // stringify(wrapInStartEndCall("var y = x + 23; y"))
  // // generates code
  // try {
  //     __start_execution();
  //     __lvVarRecorder.y = x + 23;
  //     return __end_execution(null, __lvVarRecorder.y);
  // } catch (err) {
  //     return __end_execution(err, undefined);
  // }

  const outerBody = [];
  const isProgram = parsed.type === 'Program';
  const funcDecls = topLevelFuncDecls(parsed);
  let startFuncNode = options.startFuncNode || t.Identifier('__start_execution');
  let endFuncNode = options.endFuncNode || t.Identifier('__end_execution');
  if (typeof startFuncNode == 'string') startFuncNode = babel.parse(startFuncNode).program.body[0].expression;
  if (typeof endFuncNode == 'string') endFuncNode = babel.parse(endFuncNode).program.body[0].expression;

  // 1. Hoist func decls outside the actual eval start - end code. The async /
  // generator transforms require this!
  funcDecls.forEach(({ node, path }) => {
    Path(path).set(parsed, t.ExpressionStatement(node.id));
    outerBody.push(node);
  });

  // 2. add start-eval call
  path.pushContainer('body', t.ExpressionStatement(t.CallExpression(startFuncNode, [])));

  // 3. if last statement is an expression, transform it so we can pass it to
  // the end-eval call, replacing the original expression. If it's a
  // non-expression we record undefined as the eval result
  const last = arr.last(path.get('body'));
  if (last.node.type === 'ExpressionStatement') {
    last.remove();
    path.pushContainer('body', t.ExpressionStatement(t.CallExpression(endFuncNode, [t.Identifier('null'), last.expression])));
  } else if (last.node.type === 'VariableDeclaration' && arr.last(last.node.declarations).id.type === 'Identifier') {
    path.pushContainer('body', t.ExpressionStatement(t.CallExpression(endFuncNode, [t.Identifier('null'), arr.last(last.declarations).id])));
  } else {
    path.pushContainer('body', t.ExpressionStatement(t.CallExpression(endFuncNode, [t.Identifier('null'), t.Identifier('undefined')])));
  }

  // 4. Wrap that stuff in a try stmt
  outerBody.push(
    t.TryStatement(
      t.BlockStatement(path.node.body),
      t.CatchClause(t.Identifier('err'), null,
        t.BlockStatement([t.ExpressionStatement(t.CallExpression(endFuncNode, [t.Identifierd('err'), t.Identifier('undefined')]))])
      )));

  path.replaceWith(isProgram ? t.Program(outerBody) : t.BlockStatement(outerBody));
}

function getExportDecls (scope) {
  return [...new Set(Object.values(scope.bindings).map(m => m.referencePaths.filter(m => m.parentPath.parentPath?.type.match(/ExportNamedDeclaration|ExportDefaultDeclaration/))).flat().map(m => m.parent))];
}

function evalCodeTransform (path, state, options) {
  // A: Rewrite the component definitions to create component descriptors.
  let { moduleName } = options;
  const renamedExports = {};
  if (state.opts.module) state.opts.module._renamedExports = renamedExports;

  getExportDecls(path.scope)
    .filter(stmt => stmt.local?.name !== stmt.exported?.name)
    .forEach(stmt => renamedExports[stmt.exported.name] = stmt.local?.name || stmt.imported?.name);

  let annotation = {};

  processInlineCodeTransformOptions(path, options);

  if ((moduleName && moduleName.endsWith('cp.js') || options.wrapInStartEndCall) && state.file.code) {
    ensureComponentDescriptors(path, moduleName, options);
  }

  // 2. Annotate definitions with code location. This is being used by the
  // function-wrapper-source transform.
  options.scope = getScopeFromPath(path);

  if (Object.hasOwn(options, 'evalId')) annotation.evalId = options.evalId;
  if (options.sourceAccessorName) annotation.sourceAccessorName = options.sourceAccessorName;
  if (options.addSourceMeta !== false) {
    [...options.scope.classDecls, ...options.scope.funcDecls].forEach(({ node }) => {
      node['x-lively-object-meta'] = { ...annotation, start: node.start, end: node.end };
      if (Object.hasOwn(renamedExports,node.id.name)) { node['x-lively-object-meta'] = { exportConflict: renamedExports[node.id.name] }; }
    });
    options.scope.refs.forEach(ref => {
      if (Object.hasOwn(renamedExports,ref.name)) { ref['x-lively-object-meta'] = { exportConflict: renamedExports[ref.name] }; }
    });
    options.scope.varDecls.forEach(({ node }) =>
      node.declarations.forEach(decl => {
        decl['x-lively-object-meta'] = { ...annotation, start: decl.start, end: decl.end };
        if (Object.hasOwn(renamedExports,decl.id.name)) {
          decl['x-lively-object-meta'].exportConflict = renamedExports[decl.id.name];
        }
      }));
  }

  // 3. capture top level vars into topLevelVarRecorder "environment"

  if (!options.topLevelVarRecorder && options.topLevelVarRecorderName) {
    let G = getGlobal();
    if (options.topLevelVarRecorderName === 'GLOBAL') { // "magic"
      options.topLevelVarRecorder = getGlobal();
    } else {
      options.topLevelVarRecorder = Path(options.topLevelVarRecorderName).get(G);
    }
  }

  if (options.topLevelVarRecorder) {
    // capture and wrap logic
    let blacklist = (options.dontTransform || []).concat(['arguments']);
    let undeclaredToTransform = options.recordGlobals ? null/* all */ : arr.withoutAll(Object.keys(options.topLevelVarRecorder), blacklist);
    let varRecorder = t.Identifier(options.varRecorderName || '__lvVarRecorder');
    let es6ClassToFunctionOptions = null;

    if (options.declarationWrapperName || typeof options.declarationCallback === 'function') {
      // 2.1 declare a function that wraps all definitions, i.e. all var
      // decls, functions, classes etc that get captured will be wrapped in this
      // function. This allows to define some behavior that is run whenever
      // variables get initialized or changed as well as transform values.
      // The parameters passed are:
      //   name, kind, value, recorder
      // Note that the return value of declarationCallback is used as the
      // actual value in the code being executed. This allows to transform the
      // value as necessary but also means that declarationCallback needs to
      // return sth meaningful!
      let declarationWrapperName = options.declarationWrapperName || defaultDeclarationWrapperName;

      options.declarationWrapper = t.MemberExpression(
        t.Identifier(options.varRecorderName || '__lvVarRecorder'),
        t.StringLiteral(declarationWrapperName), true);

      if (options.declarationCallback) { options.topLevelVarRecorder[declarationWrapperName] = options.declarationCallback; }
    }

    let transformES6Classes = Object.hasOwn(options, 'transformES6Classes')
      ? options.transformES6Classes
      : true;
    if (transformES6Classes) {
      // Class declarations and expressions are converted into a function call
      // to `createOrExtendClass`, a helper that will produce (or extend an
      // existing) constructor function in a way that allows us to redefine
      // methods and properties of the class while keeping the class object
      // identical
      const scope = {
        decls: [],
        resolvedRefMap: new Map()
      };
      Object.values(path.scope.bindings).map(binding => {
        let decl = binding.path.node;
        if (decl.type === 'ImportSpecifier' || decl.type === 'ImportDefaultSpecifier') decl = binding.path.parent;
        scope.decls.push([decl, binding.identifier]); // this data format is just weird af?
        binding.referencePaths.forEach(ref => {
          scope.resolvedRefMap.set(ref.node, { decl, declId: binding.identifier, ref });
        });
      });
      es6ClassToFunctionOptions = {
        currentModuleAccessor: options.currentModuleAccessor,
        classHolder: varRecorder,
        functionNode: t.MemberExpression(varRecorder, defaultClassToFunctionConverter),
        declarationWrapper: options.declarationWrapper,
        evalId: options.evalId,
        sourceAccessorName: options.sourceAccessorName,
        scope,
        nodes: babelNodes,
        ...options.classToFunction,
        transform: (parsed, options) => {
          classToFunctionTransformBabel(path, state, options);
        }
      };
    }

    // 3.2 Here we call out to the actual code transformation that installs the captured top level vars
    rewriteToCaptureTopLevelVariables(
      path,
      // FIXME: this weird remapping should be removed, completely unnessecary
      {
        footer: options.footer,
        header: options.header,
        topLevel: options.topLevel,
        scope: options.scope,
        es6ImportFuncId: options.es6ImportFuncId,
        es6ExportFuncId: options.es6ExportFuncId,
        ignoreUndeclaredExcept: undeclaredToTransform,
        exclude: blacklist,
        captureObj: varRecorder,
        declarationWrapper: options.declarationWrapper || undefined,
        classToFunction: es6ClassToFunctionOptions,
        evalId: options.evalId,
        sourceAccessorName: options.sourceAccessorName,
        keepTopLevelVarDecls: options.keepTopLevelVarDecls
      });
  }

  if (options.wrapInStartEndCall) {
    wrapInStartEndCall(path, {
      startFuncNode: options.startFuncNode,
      endFuncNode: options.endFuncNode
    }, state.parsed);
  }

  if (options.sourceURL) {
    t.addComment(path.node, 'trailing', '# sourceURL=' + options.sourceURL.replace(/\s/g, '_'));
  }
}

function isMochaTest (scope) {
  return !!Object.values(scope.bindings).filter(binding => binding.path.type === 'ImportSpecifier').map(binding => binding.path.parentPath).find(binding => binding.get('source.extra.rawValue').node?.match(/(mocha-es6|mocha-es6\/index\.js)$/));
}

export function livelyPreTranspile (api, options) {
  let isGlobal = true;

  if (options.module) {
    const { module } = options;
    let {
      sourceAccessorName,
      recorder,
      recorderName,
      varDefinitionCallbackName,
      embedOriginalCode = true
    } = module;

    isGlobal = recorderName === 'System.global';

    sourceAccessorName = embedOriginalCode ? sourceAccessorName : undefined;

    options = {
      ...options,
      moduleName: module.shortName(),
      topLevelVarRecorder: recorder,
      varRecorderName: recorderName,
      sourceAccessorName,
      dontTransform: [
        'global', 'self',
        '_moduleExport', '_moduleImport',
        'localStorage', // for Firefox, doesn't like to be called as a method, same as fetch, i.e. __lvVarRecorder.fetch
        module.recorderName, module.sourceAccessorName,
        'prompt', 'alert', 'fetch', 'getComputedStyle'
      ].concat(query.knownGlobals),
      recordGlobals: true,
      declarationWrapperName: varDefinitionCallbackName,
      evalId: module.nextEvalId(),
      currentModuleAccessor: t.CallExpression(
        t.MemberExpression(
          t.CallExpression(
            t.MemberExpression(t.MemberExpression(t.Identifier(recorderName), t.Identifier('System')), t.Identifier('get')),
            [t.StringLiteral('@lively-env')]),
          t.Identifier('moduleEnv')),
        [t.StringLiteral(module.id)])
    };

    options.header = (options.header || '') + (options.debug ? `console.log("[lively.modules] executing module ${module.id}");\n` : '');
    options.footer = options.footer || '';
    if (isGlobal) {
    // FIXME how to update exports in that case?
      delete options.declarationWrapperName;
    }
  }

  return {
    visitor: {
      Program (path, state) {
        if (!isGlobal) {
          const { module, sourceAccessorName, varRecorderName } = options;
          options.header += `SystemJS.get("@lively-env").evaluationStart("${module.id}");\n` +
            `var ${varRecorderName} = SystemJS.get("@lively-env").moduleEnv("${module.id}").recorder;\n` +
            (sourceAccessorName ? `\nvar ${sourceAccessorName} = ${JSON.stringify(state.file.code)};\n` : '');
          options.footer += `\nSystemJS.get("@lively-env").evaluationEnd("${module.id}");`;
          // also check for the mocha test!
          if (!isMochaTest(path.scope)) options.dontTransform?.push(...Object.keys(path.scope.globals));
        }

        evalCodeTransform(path, state, options);
      }
    }
  };
}

export function livelyPostTranspile (api, options) {
  if (options.module) {
    const { module } = options;
    const captureObj = t.Identifier(module.recorderName);
    options = {
      captureObj,
      moduleId: module.id,
      topLevelVarRecorder: module.recorder,
      dontTransform: module.dontTransform,
      declarationWrapper: t.MemberExpression(
        captureObj,
        t.StringLiteral(module.varDefinitionCallbackName), true)
    };
  }

  return {
    visitor: {
      Program: {
        exit (path, state) {
          if (!options.topLevelVarRecorder) {
            path.stop();
            return;
          }

          let blacklist = (options.dontTransform || []).concat(['arguments']);
          rewriteToRegisterModuleToCaptureSetters(path, state, { exclude: blacklist, ...options });
        }
      }
    }
  };
}

export function livelyModuleLoadTranspile (api, options) {
  return {
    visitor: {
      CallExpression (path) {
        if (path.get('callee.property').node?.name === 'register' &&
           path.get('callee.object.name').node === 'System') {
          options.depNames.push(...path.node.arguments[0].elements.map(ea => ea.value));
          const declareFuncNode = path.node.arguments[1];
          const body = path.parentPath;
          // maybe need to be all wrapped in expression statements?
          body.replaceWithMultiple([
            varDecl('SystemJS', t.Identifier('System')),
            varDecl('__moduleName', t.StringLiteral(options.module.fullName())),
            t.ExpressionStatement(declareFuncNode)
          ]);
          t.addComment(body.node, 'trailing', '# sourceURL=' + options.module.fullName());

          path.stop(); // do not proceed with anything
        }
      }
    }
  };
}

class BabelTranspiler {
  constructor (System, moduleId, env) {
    this.System = System;
    this.moduleId = moduleId;
    this.env = env;
  }

  transpileDoit (source) {
    // wrap in async function so we can use await top-level
    let System = this.System;
    var source = '(async function(__rec) {\n' + source.replace(/(\/\/# sourceURL=.+)$|$/, '\n}).call(this);\n$1'); // eslint-disable-line no-var
    let opts = System.babelOptions || {};
    let needsBabel = (opts.plugins && opts.plugins.length) || (opts.presets && opts.presets.length);
    return needsBabel
      ? babel.transform(source, opts).code
      : source;
  }

  transpileModule (source, options) {
    let System = this.System;
    let opts = Object.assign({}, System.babelOptions);
    opts.sourceFileName = options.module?.id;
    opts.sourceType = 'module';
    opts.plugins = opts.plugins
      ? opts.plugins.slice()
      : [
          [livelyPreTranspile, options],
          dynamicImport,
          systemjsTransform,
          // choose either one
          options.esmLoad ? [livelyModuleLoadTranspile, options] : [livelyPostTranspile, options]
        ];
    return babel.transform(source, opts);
  }
}

// setupBabelTranspiler(System)
export function setupBabelTranspiler (System) {
  const useNodeRequire = isNodeSystem(System) && (!!System._nodeRequire || typeof require !== 'undefined');
  if (useNodeRequire) {
    System._nodeRequire ||= eval('require'); // hack to enable dynamic requires in bundles
  } else if (isBrowserSystem(System)) {
    delete System._nodeRequire;
  }
  if (useNodeRequire && typeof global !== 'undefined') {
    global.__webpack_require__ = global.__non_webpack_require__ = System._nodeRequire;
  }

  System.global = isBrowserSystem(System)
    ? (typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : globalThis)
    : (typeof global === 'undefined' ? globalThis : global);
  System.trace = true; // in order to harvest more metadata for lively.modules
  if (System._nodeRequire) {
    const Module = System._nodeRequire('module');
    // wrap _load() such that it attaches the __esModule flag to each imported native module
    // this ensures the interoperability to 0.21 SystemJS
    const origLoad = Module._load;
    // this also overrides native requires, which is not what we want really
    Module._load = (...args) => {
      let exports = origLoad(...args);
      const isCoreModule = Module.isBuiltin(args[0]);
      if (isCoreModule && !args[1].loaded && !exports.prototype) {
        const newExports = Object.create(exports.prototype || {});
        for (const key in Object.getOwnPropertyDescriptors(exports)) {
          newExports[key] = exports[key];
        }
        if (!newExports.default) newExports.default = newExports;
        newExports.__esModule = true;
        return newExports;
      }
      return exports;
    };
  }

  function translate (load, opts) {
    const { code, map } = new BabelTranspiler(this, load.name, {}).transpileModule(load.source, { ...opts, module: load.metadata.module });
    load.metadata.sourceMap = map;
    return code;
  }
  System.set('lively.transpiler.babel', System.newModule({ default: BabelTranspiler, translate }));
  System._loader.transpilerPromise = Promise.resolve({ translate });
  System.translate = async (load, opts) => await translate.bind(System)(load, opts);
  System.config({
    transpiler: 'lively.transpiler.babel',
    babelOptions: {
      sourceMaps: true,
      compact: false, // for some reason, the compact options messes up the source maps on a per module basis
      comments: false,
      presets: []
    }
  });
}
