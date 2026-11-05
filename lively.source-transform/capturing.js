// Public entry points; semantic passes live beside their Rust counterparts.
export { rewriteToCaptureTopLevelVariables, insertCapturesForFunctionDeclarations } from './transforms/scope-capturing.js';
export { rewriteToRegisterModuleToCaptureSetters } from './transforms/systemjs.js';
export { insertCapturesForExportedImports } from './transforms/exported-import-capture.js';
