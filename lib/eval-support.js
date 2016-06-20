import { arr } from "lively.lang";
import { parse, stringify, capturing, transform, nodes } from "lively.ast";
import { createOrExtend as createOrExtendClass } from "./class-helpers.js";

var {id, literal, member, objectLiteral} = nodes;

export const defaultDeclarationWrapperName = "lively.capturing-declaration-wrapper",
             defaultClassToFunctionConverterName = "createOrExtendES6ClassForLively"

export function evalCodeTransform(code, options) {
  // variable declaration and references in the the source code get
  // transformed so that they are bound to `varRecorderName` aren't local
  // state. THis makes it possible to capture eval results, e.g. for
  // inspection, watching and recording changes, workspace vars, and
  // incrementally evaluating var declarations and having values bound later.

  // 1. Allow evaluation of function expressions and object literals
  code = transform.transformSingleExpression(code);
  var parsed = parse(code);

  // 2. capture top level vars into topLevelVarRecorder "environment"

  if (options.topLevelVarRecorder) {


    // capture and wrap logic
    var blacklist = (options.dontTransform || []).concat(["arguments"]),
        undeclaredToTransform = !!options.recordGlobals ?
          null/*all*/ : arr.withoutAll(Object.keys(options.topLevelVarRecorder), blacklist),
        varRecorder = id(options.varRecorderName || '__lvVarRecorder'),
        es6ClassToFunctionOptions = undefined,
        declarationWrapperName = options.declarationWrapperName || defaultDeclarationWrapperName;

    if (options.keepPreviouslyDeclaredValues) {
      // 2.1 declare a function that should wrap all definitions, i.e. all var
      // decls, functions, classes etc that get captured will be wrapped in this
      // function. When using this with the option.keepPreviouslyDeclaredValues
      // we will use a wrapping function that keeps the identity of prevously
      // defined objects
      options.declarationWrapper = member(
        id(options.varRecorderName),
        literal(declarationWrapperName), true);
      options.topLevelVarRecorder[declarationWrapperName] = declarationWrapperForKeepingValues;

      // Class declarations and expressions are converted into a function call
      // to `createOrExtendClass`, a helper that will produce (or extend an
      // existing) constructor function in a way that allows us to redefine
      // methods and properties of the class while keeping the class object
      // identical
      options.topLevelVarRecorder[defaultClassToFunctionConverterName] = createOrExtendClass;
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

export function evalCodeTransformOfSystemRegisterSetters(code, options) {
  if (!options.topLevelVarRecorder) return code;

  var parsed = parse(code),
      blacklist = (options.dontTransform || []).concat(["arguments"]),
        undeclaredToTransform = !!options.recordGlobals ?
          null/*all*/ : arr.withoutAll(Object.keys(options.topLevelVarRecorder), blacklist),
      result = capturing.rewriteToRegisterModuleToCaptureSetters(
        parsed, id(options.varRecorderName || '__lvVarRecorder'), {exclude: blacklist});

  return stringify(result);
}

function copyProperties(source, target, exceptions = []) {
  Object.getOwnPropertyNames(source).concat(Object.getOwnPropertySymbols(source))
    .forEach(name =>
      exceptions.indexOf(name) === -1
   && Object.defineProperty(target, name, Object.getOwnPropertyDescriptor(source, name)));
}

function declarationWrapperForKeepingValues(name, kind, value, recorder) {
  // show(`declaring ${name}, a ${kind}, value ${value}`);

  if (kind === "function") return value;
  if (kind === "class") {
    recorder[name] = value;
    return value;
  }

  // if (!value || typeof value !== "object" || Array.isArray(value) || value.constructor === RegExp)
  //   return value;

  // if (recorder.hasOwnProperty(name) && typeof recorder[name] === "object") {
  //   if (Object.isFrozen(recorder[name])) return value;
  //   try {
  //     copyProperties(value, recorder[name]);
  //     return recorder[name];
  //   } catch (e) {
  //     console.error(`declarationWrapperForKeepingValues: could not copy properties for object ${name}, won't keep identity of previously defined object!`)
  //     return value;
  //   }
  // }

  return value;
}
