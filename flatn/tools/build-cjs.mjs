/* global global, process */
import { rollup } from '@rollup/wasm-node';
import commonjs from '@rollup/plugin-commonjs';
import { builtinModules } from 'node:module';
import { flatnResolve } from '../module-resolver.js';

try {
  const nodeBuiltins = new Set(
    builtinModules
      .flatMap(m => [m, m.startsWith('node:') ? m.slice(5) : `node:${m}`])
      .concat(['buffer', 'node:buffer'])
  );
  
  const bundle = await rollup({
    input: './index.js',
    plugins: [
      {
        resolveId: async (id, parentURL) => {
          // Keep Node builtins external for the cjs bundle to avoid
          // environment-dependent polyfill resolution via flatn package lookup.
          if (nodeBuiltins.has(id)) {
            return { id: id.startsWith('node:') ? id.slice(5) : id, external: true };
          }
          try {
            if (id.startsWith('lively.')) {
              return await flatnResolve(id, parentURL);
            }
            if (!id.startsWith('.')) 
              return await flatnResolve(id, parentURL);
          } catch (err) {
            return null; 
          }
        }
      },
      commonjs({
        ignoreDynamicRequires: true,
        exclude: [/node:.*/]
      })
    ]
  });
  
  await bundle.write({
    format: 'cjs',
    inlineDynamicImports: true,
    file: 'flatn-cjs.js'
  });

} catch (err) {
  console.log(err);
  process.exit(1);
}
