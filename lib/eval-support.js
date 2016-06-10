import { arr } from "lively.lang";
import { parse } from "./parser.js";
import stringify from "./stringify.js";
import { rewriteToCaptureTopLevelVariables, rewriteToRegisterModuleToCaptureSetters } from "./capturing.js";
import { transformSingleExpression, wrapInStartEndCall } from "./transform.js";

export var defaultDeclarationWrapperName = "lively.capturing-declaration-wrapper";

export function evalCodeTransform(code, options) {
  // variable declaration and references in the the source code get
  // transformed so that they are bound to `varRecorderName` aren't local
  // state. THis makes it possible to capture eval results, e.g. for
  // inspection, watching and recording changes, workspace vars, and
  // incrementally evaluating var declarations and having values bound later.

  // 1. Allow evaluation of function expressions and object literals
  code = transformSingleExpression(code);

  var parsed = parse(code);

  // 2. capture top level vars into topLevelVarRecorder "environment"
  if (options.topLevelVarRecorder) {

    // 2.1 declare a function that should wrap all definitions, i.e. all var
    // decls, functions, classes etc that get captured will be wrapped in this
    // function. When using this with the option.keepPreviouslyDeclaredValues
    // we will use a wrapping function that keeps the identity of prevously
    // defined objects

    var declarationWrapperName = options.declarationWrapperName || defaultDeclarationWrapperName;
    if (options.keepPreviouslyDeclaredValues) {
      options.declarationWrapper = {
        type: "MemberExpression",
        object: {type: "Identifier", name: options.varRecorderName},
        property: {type: "Literal", value: declarationWrapperName},
        computed: true
      }
      options.topLevelVarRecorder[declarationWrapperName] = declarationWrapperForKeepingValues;
    }
    
    // 2.2 Here we call out to the actual code transformation that installs the
    // capture and wrap logic
    var blacklist = (options.dontTransform || []).concat(["arguments"]),
        undeclaredToTransform = !!options.recordGlobals ?
          null/*all*/ : arr.withoutAll(Object.keys(options.topLevelVarRecorder), blacklist);

    parsed = rewriteToCaptureTopLevelVariables(
      parsed,
      {name: options.varRecorderName || '__lvVarRecorder', type: "Identifier"},
      {
        es6ImportFuncId: options.es6ImportFuncId,
        es6ExportFuncId: options.es6ExportFuncId,
        ignoreUndeclaredExcept: undeclaredToTransform,
        exclude: blacklist,
        declarationWrapper: options.declarationWrapper || undefined
     });
  }

  if (options.wrapInStartEndCall) {
    parsed = wrapInStartEndCall(parsed, {
      startFuncNode: options.startFuncNode,
      endFuncNode: options.endFuncNode
    });
  }

  var result = stringify(parsed);

  if (options.sourceURL) result += "\n//# sourceURL=" + options.sourceURL.replace(/\s/g, "_");

  return result;
}

export function evalCodeTransformOfSystemRegisterSetters(code, options) {
  if (options.topLevelVarRecorder) {

    var parsed = parse(code),
        blacklist = (options.dontTransform || []).concat(["arguments"]),
          undeclaredToTransform = !!options.recordGlobals ?
            null/*all*/ : arr.withoutAll(Object.keys(options.topLevelVarRecorder), blacklist);

    var result = rewriteToRegisterModuleToCaptureSetters(parsed,
      {name: options.varRecorderName || '__lvVarRecorder', type: "Identifier"},
      {
        exclude: blacklist,
        declarationWrapper: options.declarationWrapper || undefined
     });
  }

  return result ? stringify(result) : code;
}

function copyProperties(source, target, exceptions = []) {
  Object.getOwnPropertyNames(source).concat(Object.getOwnPropertySymbols(source))
    .forEach(name =>
      exceptions.indexOf(name) === -1
   && Object.defineProperty(target, name, Object.getOwnPropertyDescriptor(source, name)));  
}

function declarationWrapperForKeepingValues(name, kind, value, recorder) {
  if (kind === "function") return value;

  if (kind === "class") {
    var existingClass = recorder[name];
    if (typeof existingClass === "function") {
      copyProperties(value, existingClass, ["name", "length", "prototype"]);
      copyProperties(value.prototype, existingClass.prototype);
      return existingClass;
    }
    return value;
  }

  if (!value || typeof value !== "object" || Array.isArray(value) || value.constructor === RegExp)
    return value;

  if (recorder.hasOwnProperty(name)) {
    copyProperties(value, recorder[name]);
    return recorder[name];
  }

  return value;
}
