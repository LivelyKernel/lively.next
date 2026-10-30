export { ensureComponentDescriptors } from './component.js';
export { transformDynamicImports } from './dynamic-import.js';
export { splitExportDeclarations, replaceExportedVarDeclarations } from './export-split.js';
export { replaceImportedNamespaces, replaceExportedNamespaces, transformNamespaces } from './namespace.js';
export { insertCapturesForImportAndExportDeclarations } from './exported-import-capture.js';
export { rewriteToRegisterModuleToCaptureSetters } from './systemjs.js';
export { rewriteToCaptureTopLevelVariables, getScopeFromPath } from './scope-capturing.js';
