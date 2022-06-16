/* global process */
import { rollup } from 'rollup';
import jsonPlugin from '@rollup/plugin-json';
import { lively } from 'lively.freezer/src/plugins/rollup';
import resolver from 'lively.freezer/src/resolvers/node.cjs';

const build = await rollup({
  input: './install-with-node.js',
  external: ['flatn'], // we do not need to include flatn into the bundle, since that already exists prebuilt
  plugins: [
    lively({ // we just need this one to apply the source transform to our lively classes stuff as well as utilizing the flatn resolution mechanism encapsulated in the resolver.
      resolver,
      minify: false,
      includeLivelyAssets: false,
      captureModuleScope: false,
      asBrowserModule: false,
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
