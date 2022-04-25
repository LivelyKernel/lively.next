import LivelyRollup, { customWarn } from '../bundler.js';
import { ROOT_ID } from '../util/helpers.js';
import { obj } from 'lively.lang';

export function lively (args) {
  const bundler = new LivelyRollup(args);
  return {
    name: 'esbuild-plugin-lively',
    setup (build) {
      const opts = {}; // retrieve those from the build
      if (bundler.snapshot) {
      // since we are supposed to resolve from the snapshot, we set the input
      // to be the synthesized module.
        opts.input = ROOT_ID;
      }
      if (bundler.excludedModules.length > 0) {
        opts.shimMissingExports = true; // since we are asked to exclude some of the lively modules, we set this flag to true. Can we isolate this??
      }
      if (!opts.onwarn) opts.onwarn = (warning, warn) => { return customWarn(warning, warn); };

      // we cant really perform that step after the bundle....
      // if (opts.globals) {
      //   if (obj.isFunction(opts.globals)) {
      //     const origGetGlobal = opts.globals;
      //     opts.globals = (id) => globals[id] || origGetGlobal(id);
      //   } else {
      //     opts.globals = { ...opts.globals, ...globals };
      //   }
      // }

      build.onStart(() => bundler.buildStart());
      build.onResolve(({ importer, kind, path }) => { // fixme: the params are different here
        if (kind == 'dynamic-import') {
          bundler.hasDynamicImports = true; // fixme: handle that inside the bundler...
        }
        return kind == 'dynamic-import'
          ? bundler.resolveDynamicImport(null, importer)
          : bundler.resolveId(path, importer);
      });
      build.onLoad({ filter: /.js/ }, async ({ path }) => {
        // fixme: also apply the transform here
        const source = await bundler.load(path);
        return bundler.transform(source, path);
      });
      build.onEnd(async ({ bundle, options }) => {
        let depsCode, globals, importMap;
        ({ code: depsCode, globals, importMap } = await bundler.generateGlobals());
        await bundler.generateBundle(this, bundle, depsCode, importMap, options);
      });
    }
  };
}
