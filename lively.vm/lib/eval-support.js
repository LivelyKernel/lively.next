import { arr, Path } from 'lively.lang';
import { parse, stringify, transform, query, nodes } from 'lively.ast';
import { capturing, es5Transpilation, ensureComponentDescriptors } from 'lively.source-transform';
import { getGlobal } from './util.js';

let { id, literal, member, objectLiteral } = nodes;

export const defaultDeclarationWrapperName = 'lively.capturing-declaration-wrapper';
export const defaultClassToFunctionConverterName = 'initializeES6ClassForLively';

function processInlineCodeTransformOptions (parsed, options) {
  if (!parsed.comments) return options;
  let livelyComment = parsed.comments.find(ea => ea.text.startsWith('lively.vm '));
  if (!livelyComment) return options;
  try {
    let inlineOptions = eval('({' + livelyComment.text.slice('lively.vm '.length) + '});');
    return Object.assign(options, inlineOptions);
  } catch (err) { return options; }
}

export function evalCodeTransform (code, options) {
  // variable declaration and references in the the source code get
  // transformed so that they are bound to `varRecorderName` aren't local
  // state. THis makes it possible to capture eval results, e.g. for
  // inspection, watching and recording changes, workspace vars, and
  // incrementally evaluating var declarations and having values bound later.

  // 1. Allow evaluation of function expressions and object literals
  code = transform.transformSingleExpression(code);
  let parsed = parse(code, { withComments: true });

  options = processInlineCodeTransformOptions(parsed, options);

  // A: Rewrite the component definitions to create component descriptors.
  let moduleName = false;
  if (options.declarationWrapperName?.includes(System.baseURL)) {
    moduleName = options.declarationWrapperName.split(System.baseURL)[1];
  }
  if (options.declarationWrapperName?.includes('lively-object-modules/')) {
    moduleName = options.declarationWrapperName.split('lively-object-modules/')[1];
    moduleName = `local://lively-object-modules/${moduleName}`;
  }

  if (options.declarationWrapperName?.includes('lively.next-workspace/')) {
    moduleName = options.declarationWrapperName.split('lively.next-workspace/')[1];
    moduleName = `lively://lively.next-workspace/${moduleName}`;
  }

  if (moduleName && moduleName.includes('local_projects/')) moduleName = moduleName.replace('local_projects/', '');
  if (moduleName) { parsed = ensureComponentDescriptors(parsed, moduleName, options.varRecorderName); }

  // 2. Annotate definitions with code location. This is being used by the
  // function-wrapper-source transform.
  let { classDecls, funcDecls, varDecls } = query.topLevelDeclsAndRefs(parsed);
  let annotation = {};

  if (options.hasOwnProperty('evalId')) annotation.evalId = options.evalId;
  if (options.sourceAccessorName) annotation.sourceAccessorName = options.sourceAccessorName;
  [...classDecls, ...funcDecls].forEach(node =>
    node['x-lively-object-meta'] = { ...annotation, start: node.start, end: node.end });
  varDecls.forEach(node =>
    node.declarations.forEach(decl =>
      decl['x-lively-object-meta'] = { ...annotation, start: decl.start, end: decl.end }));

  // transforming experimental ES features into accepted es6 form...
  parsed = transform.objectSpreadTransform(parsed);

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
    let undeclaredToTransform = options.recordGlobals
      ? null/* all */ : arr.withoutAll(Object.keys(options.topLevelVarRecorder), blacklist);
    let varRecorder = id(options.varRecorderName || '__lvVarRecorder');
    let es6ClassToFunctionOptions;

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

      options.declarationWrapper = member(
        id(options.varRecorderName || '__lvVarRecorder'),
        literal(declarationWrapperName), true);

      if (options.declarationCallback) { options.topLevelVarRecorder[declarationWrapperName] = options.declarationCallback; }
    }

    let transformES6Classes = options.hasOwnProperty('transformES6Classes')
      ? options.transformES6Classes
      : true;
    if (transformES6Classes) {
      // Class declarations and expressions are converted into a function call
      // to `createOrExtendClass`, a helper that will produce (or extend an
      // existing) constructor function in a way that allows us to redefine
      // methods and properties of the class while keeping the class object
      // identical
      es6ClassToFunctionOptions = {
        currentModuleAccessor: options.currentModuleAccessor,
        classHolder: varRecorder,
        functionNode: member(varRecorder, defaultClassToFunctionConverterName),
        declarationWrapper: options.declarationWrapper,
        evalId: options.evalId,
        sourceAccessorName: options.sourceAccessorName,
        transform: options.classTransform
      };
    }

    // 3.2 Here we call out to the actual code transformation that installs the captured top level vars
    parsed = capturing.rewriteToCaptureTopLevelVariables(
      parsed, varRecorder,
      {
        es6ImportFuncId: options.es6ImportFuncId,
        es6ExportFuncId: options.es6ExportFuncId,
        ignoreUndeclaredExcept: undeclaredToTransform,
        exclude: blacklist,
        declarationWrapper: options.declarationWrapper || undefined,
        classToFunction: es6ClassToFunctionOptions,
        evalId: options.evalId,
        sourceAccessorName: options.sourceAccessorName,
        keepTopLevelVarDecls: options.keepTopLevelVarDecls
      });
  }

  if (options.wrapInStartEndCall) {
    parsed = transform.wrapInStartEndCall(parsed, {
      startFuncNode: options.startFuncNode,
      endFuncNode: options.endFuncNode
    });
  }

  let result = stringify(parsed);

  if (options.jsx) result = es5Transpilation(result);

  if (options.sourceURL) result += '\n//# sourceURL=' + options.sourceURL.replace(/\s/g, '_');

  return result;
}

export function evalCodeTransformOfSystemRegisterSetters (code, options = {}) {
  if (!options.topLevelVarRecorder) return code;

  if (typeof options.declarationCallback === 'function' || options.declarationWrapperName) {
    let declarationWrapperName = options.declarationWrapperName || defaultDeclarationWrapperName;
    options.declarationWrapper = member(
      id(options.varRecorderName),
      literal(declarationWrapperName), true);
    if (options.declarationCallback) { options.topLevelVarRecorder[declarationWrapperName] = options.declarationCallback; }
  }

  let parsed = parse(code);
  let blacklist = (options.dontTransform || []).concat(['arguments']);
  let undeclaredToTransform = options.recordGlobals
    ? null/* all */ : arr.withoutAll(Object.keys(options.topLevelVarRecorder), blacklist);
  let result = capturing.rewriteToRegisterModuleToCaptureSetters(
    parsed, id(options.varRecorderName || '__lvVarRecorder'), { exclude: blacklist, ...options });
  return stringify(result);
}

function copyProperties (source, target, exceptions = []) {
  Object.getOwnPropertyNames(source).concat(Object.getOwnPropertySymbols(source))
    .forEach(name =>
      exceptions.indexOf(name) === -1 &&
   Object.defineProperty(target, name, Object.getOwnPropertyDescriptor(source, name)));
}
