/* global global, process */
import System from 'systemjs';
import { resource } from "lively.resources";
import { arr } from "lively.lang";
import { query } from "lively.ast";
import * as modules from "lively.modules";
import { rollup } from 'rollup';
import commonjs from '@rollup/plugin-commonjs';
import { flatnResolve } from '../module-resolver.js';

const bundle = await rollup({
  input: './index.js',
  plugins: [
    {
      resolveId: async (id, parentURL) => {
        // directly use flatn to resolve this shit
        if (id.startsWith('node:'))
          return { id: id.replace('node:', ''), external: true };
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
