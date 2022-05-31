import LivelyRollup, { customWarn } from '../bundler.js';
import { ROOT_ID } from '../util/helpers.js';
import { obj } from 'lively.lang';

/**
 * Checks wether or not a given module is an internal module
 * of the current JS runtime. Usually used within the node.js
 * context.
 * @param { string } id - The module name to check for.
 * @param { Resolver } resolver - The resolver that tells us the builtin modules.
 */
function isBuiltin (id, resolver) {
  return id.startsWith('node:') ||
         resolver.builtinModules.includes(id);
}

/**
 * Checks if the given module id belongs to some of the generated ones
 * from the commonjs transform plugin. Those we usually should ignore
 * when attempting to load or transform since they are not living in the filesystem.
 * @param { string } id - The module id.
 */
function isCommonJsModule (id) {
  return id.includes('?commonjs-external') ||
         id.includes('?commonjs-exports') ||
         id.includes('?commonjs-entry') ||
         id.includes('commonjsHelpers.js');
}

export function lively (args) {
  let globals, importMap, depsCode;
  const bundler = new LivelyRollup(args);
  const { map = {} } = args;
  return {
    name: 'rollup-plugin-lively',
    buildStart: () => bundler.buildStart(),
    resolveId: async (id, importer) => {
      if (isBuiltin(id, bundler.resolver)) return null;
      let res = await bundler.resolveId(map[id] || id, importer);
      return res;
    },
    resolveDynamicImport: async (node, importer) => {
      if (typeof node === 'string' && isBuiltin(node, bundler.resolver)) return null;
      let res = await bundler.resolveDynamicImport(node, importer);
      return res;
    },
    load: (id) => {
      if (id.startsWith('\0')) return null;
      if (isBuiltin(id, bundler.resolver) || isCommonJsModule(id)) return null;
      try {
        return bundler.load(id);
      } catch (err) {
        return null;
      }
    },
    transform: async (source, id) => {
      if (id.startsWith('\0')) return null;
      try {
        return await bundler.transform(source, id);
      } catch (err) {
        return null;
      }
    },
    async buildEnd () {
      ({ code: depsCode, globals, importMap } = await bundler.generateGlobals());
    },
    options (opts) {
      if (bundler.snapshot) {
        // since we are supposed to resolve from the snapshot, we set the input
        // to be the synthesized module.
        opts.input = ROOT_ID;
      }
      if (bundler.excludedModules.length > 0) {
        opts.shimMissingExports = true; // since we are asked to exclude some of the lively modules, we set this flag to true. Can we isolate this??
      }
      if (!opts.onwarn) opts.onwarn = (warning, warn) => { return customWarn(warning, warn); };
      return opts;
    },
    outputOptions (opts) {
      // remember depsCode and importMap for later when we arrive at generateBundle()
      if (opts.globals) {
        if (obj.isFunction(opts.globals)) {
          const origGetGlobal = opts.globals;
          opts.globals = (id) => globals[id] || origGetGlobal(id);
        } else {
          opts.globals = { ...opts.globals, ...globals };
        }
      }
      return opts;
    },
    renderDynamicImport: () => {
      bundler.hasDynamicImports = true; // set flag to handle dynamic imports
      return null; // render via default
    },
    async generateBundle (options, bundle, isWrite) {
      await bundler.generateBundle(this, bundle, depsCode, importMap, options);
    }
  };
}
