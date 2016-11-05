import { arr } from "lively.lang";
import { parse, stringify, capturing, transform, nodes } from "lively.ast";
import { initializeClass } from "./class-helpers.js";

var {id, literal, member, objectLiteral} = nodes;

export const defaultDeclarationWrapperName = "lively.capturing-declaration-wrapper",
             defaultClassToFunctionConverterName = "initializeES6ClassForLively";

export function evalCodeTransform(code, options) {
  // variable declaration and references in the the source code get
  // transformed so that they are bound to `varRecorderName` aren't local
  // state. THis makes it possible to capture eval results, e.g. for
  // inspection, watching and recording changes, workspace vars, and
  // incrementally evaluating var declarations and having values bound later.

  // 1. Allow evaluation of function expressions and object literals
  code = transform.transformSingleExpression(code);
  var parsed = parse(code);

  // transforming experimental ES features into accepted es6 form...
  parsed = transform.objectSpreadTransform(parsed);

  // 2. capture top level vars into topLevelVarRecorder "environment"

  if (options.topLevelVarRecorder) {

    // capture and wrap logic
    var blacklist = (options.dontTransform || []).concat(["arguments"]),
        undeclaredToTransform = !!options.recordGlobals ?
          null/*all*/ : arr.withoutAll(Object.keys(options.topLevelVarRecorder), blacklist),
        varRecorder = id(options.varRecorderName || '__lvVarRecorder'),
        es6ClassToFunctionOptions = undefined;

    if (options.declarationWrapperName || typeof options.declarationCallback === "function") {
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
        id(options.varRecorderName),
        literal(declarationWrapperName), true);

      if (options.declarationCallback)
        options.topLevelVarRecorder[declarationWrapperName] = options.declarationCallback;
    }

    var transformES6Classes = options.hasOwnProperty("transformES6Classes") ? options.transformES6Classes : true;
    if (transformES6Classes) {
      // Class declarations and expressions are converted into a function call
      // to `createOrExtendClass`, a helper that will produce (or extend an
      // existing) constructor function in a way that allows us to redefine
      // methods and properties of the class while keeping the class object
      // identical
      options.topLevelVarRecorder[defaultClassToFunctionConverterName] = initializeClass;
      es6ClassToFunctionOptions = {
        currentModuleAccessor: options.currentModuleAccessor,
        classHolder: varRecorder,
        functionNode: member(varRecorder, defaultClassToFunctionConverterName),
        declarationWrapper: options.declarationWrapper
      };
    }

    // 2.2 Here we call out to the actual code transformation that installs the
    parsed = capturing.rewriteToCaptureTopLevelVariables(
      parsed, varRecorder,
      {
        es6ImportFuncId: options.es6ImportFuncId,
        es6ExportFuncId: options.es6ExportFuncId,
        ignoreUndeclaredExcept: undeclaredToTransform,
        exclude: blacklist,
        declarationWrapper: options.declarationWrapper || undefined,
        classToFunction: es6ClassToFunctionOptions
     });
  }


  if (options.wrapInStartEndCall) {
    parsed = transform.wrapInStartEndCall(parsed, {
      startFuncNode: options.startFuncNode,
      endFuncNode: options.endFuncNode
    });
  }

  var result = stringify(parsed);

  if (options.sourceURL) result += "\n//# sourceURL=" + options.sourceURL.replace(/\s/g, "_");

  return result;
}

export function evalCodeTransformOfSystemRegisterSetters(code, options = {}) {
  if (!options.topLevelVarRecorder) return code;

  if (typeof options.declarationCallback === "function" || options.declarationWrapperName) {
    let declarationWrapperName = options.declarationWrapperName || defaultDeclarationWrapperName;
    options.declarationWrapper = member(
      id(options.varRecorderName),
      literal(declarationWrapperName), true);
    if (options.declarationCallback)
      options.topLevelVarRecorder[declarationWrapperName] = options.declarationCallback;
  }

  var parsed = parse(code),
      blacklist = (options.dontTransform || []).concat(["arguments"]),
        undeclaredToTransform = !!options.recordGlobals ?
          null/*all*/ : arr.withoutAll(Object.keys(options.topLevelVarRecorder), blacklist),
      result = capturing.rewriteToRegisterModuleToCaptureSetters(
        parsed, id(options.varRecorderName || '__lvVarRecorder'), {exclude: blacklist, ...options});
  return stringify(result);
}

function copyProperties(source, target, exceptions = []) {
  Object.getOwnPropertyNames(source).concat(Object.getOwnPropertySymbols(source))
    .forEach(name =>
      exceptions.indexOf(name) === -1
   && Object.defineProperty(target, name, Object.getOwnPropertyDescriptor(source, name)));
}
