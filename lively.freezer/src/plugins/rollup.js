import LivelyRollup, { customWarn } from '../bundler.js';
import { ROOT_ID } from '../util/helpers.js';
import { obj } from 'lively.lang';

export function lively (args) {
  let globals, importMap, depsCode;
  const bundler = new LivelyRollup(args);
  return {
    name: 'rollup-plugin-lively',
    buildStart: () => bundler.buildStart(),
    resolveId: (id, importer) => {
      return bundler.resolveId(id, importer);
    },
    resolveDynamicImport: (node, importer) => {
      return bundler.resolveDynamicImport(node, importer);
    },
    load: (id) => {
      return bundler.load(id);
    },
    transform: async (source, id) => { return bundler.transform(source, id); },
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
