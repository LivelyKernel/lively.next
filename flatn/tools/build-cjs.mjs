/* global global, process */
import { rollup } from '@rollup/wasm-node';
import commonjs from '@rollup/plugin-commonjs';
import { builtinModules } from 'node:module';
import { flatnResolve } from '../module-resolver.js';

try {
  /*
   * The generated CJS file is used directly by Node and is also translated by
   * SystemJS during browser boot. Keep core modules external so the Node path
   * keeps using Node's own implementations, while flatn/package.json maps the
   * browser-safe Buffer polyfill back to the "buffer" package for SystemJS.
   * Without that package-level map a restored dependency cache can resolve
   * buffer to the empty Node placeholder and fail at Buffer.isBuffer during the
   * world-load proof.
   */
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
