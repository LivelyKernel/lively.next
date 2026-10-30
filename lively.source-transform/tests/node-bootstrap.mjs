// Node's ESM resolver does not consult flatn's CommonJS resolver.
import { registerHooks, createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const mochaRequire = createRequire(new URL('../../mocha-es6/package.json', import.meta.url));
const astRequire = createRequire(new URL('../../lively.ast/package.json', import.meta.url));
let resolving = false;
registerHooks({ resolve (specifier, context, nextResolve) {
  try { return nextResolve(specifier, context); } catch (error) {
    if (resolving || specifier.startsWith('.') || specifier.startsWith('/') || specifier.includes(':')) throw error;
    resolving = true;
    try {
      const resolved = createRequire(context.parentURL || import.meta.url).resolve(specifier);
      return nextResolve(pathToFileURL(resolved).href, context);
    } finally { resolving = false; }
  }
} });

// mocha-es6 and Lively packages also run in a browser with these namespaces.
globalThis.System ||= mochaRequire('systemjs');
globalThis.lively = {
  ...globalThis.lively,
  ast: await import('../../lively.ast/index.js'),
  lang: await import('../../lively.lang/index.js'),
  resources: await import('../../lively.resources/index.js')
};
astRequire('babel-regenerator-runtime');
globalThis.lively.modules = await import('../../lively.modules/index.js');
