/* global process */
import path from 'path';
import fs from 'fs';
import { rollup } from 'rollup';
import nodePolyfills from 'rollup-plugin-polyfill-node';
import jsonPlugin from '@rollup/plugin-json';
import commonjs from '@rollup/plugin-commonjs';
import amdtoes6 from '@buxlabs/amd-to-es6';
import es6tocjs from '@babel/plugin-transform-modules-commonjs';
import * as babel from '@babel/core';
import { lively } from 'lively.freezer/src/plugins/rollup';
import resolver from 'lively.freezer/src/resolvers/node.cjs';

const build = await rollup({
  input: './install-with-node.js',
  external: ['flatn'],
  plugins: [
    {
      name: 'system-require-handler',
      transform: (code, id) => {
	       return code.replaceAll(/\s(System|this)._nodeRequire\(/g, ' require(');
      }
    },
    {
      // source-map and related packages are written in AMD format
      // we transform this here to ESM in order to be properly consumed by rollup. 
      name: 'source-map-handler',
      transform: (code, id) => {
        if (id.includes('source-map') && code.includes('define')) {
          return babel.transform(amdtoes6(code), { plugins: [es6tocjs], babelrc: false }).code;
        }
        return null;
      }
    },
    {
      // hack that allows us to incorporate all of astq into the bundle
      // by adjusting the code of some of the files directly
      name: 'astq-handler',
      // fixme: add the onWrite hook to copy the grammar file
      transform: (code, id) => {
        if (id.includes('astq.js')) {
          return code.replace('module.exports = ASTQ', 'export default ASTQ'); 
        }
        if (id.includes('astq-version.js')) {
          return code.replace(/\$major/g, 2)
            .replace( /\$minor/g, 7)
            .replace( /\$micro/g, 5)
            .replace( /\$date/g, 20210107);
        }
      }
    },
    commonjs({
      sourceMap: false,
      defaultIsModuleExports: true,
      transformMixedEsModules: true,
      dynamicRequireRoot: path.dirname(process.env.PWD),
      dynamicRequireTargets: [
         resolver.resolveModuleId('babel-plugin-transform-es2015-modules-systemjs')
      ]
    }),
    lively({ // we just need this one to apply the source transform to our lively classes stuff as well as utilizing the flatn resolution mechanism encapsulated in the resolver.
      resolver,
      minify: false,
      includeLivelyAssets: false,
      captureModuleScope: false,
      compress: false, // this should be disabled by default on node.js      
      excludedModules: [
	      'mocha-es6', 'mocha', // references old lgtg that breaks the build
	      'rollup', // has a dist file that cant be parsed by rollup
	      'lively.morphic',
        'lively.components',
        'lively.ide' // contains code not required for this install script
      ],
      map: {
        astq: 'astq/src/astq.js' 
      }
    }),
    jsonPlugin(),
  ],
});

await build.write({
  inlineDynamicImports: true,
  file: './bin/install.cjs',
  format: 'cjs'
});

// copy the peg grammar
fs.copyFileSync(resolver.resolveModuleId('astq/src/astq-query-parse.pegjs'), './bin/astq-query-parse.pegjs');
