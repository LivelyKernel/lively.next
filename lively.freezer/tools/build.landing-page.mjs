/* global process */
import { rollup } from 'rollup';
import jsonPlugin from '@rollup/plugin-json';
import { babel } from '@rollup/plugin-babel';
import { lively } from 'lively.freezer/src/plugins/rollup';
import resolver from 'lively.freezer/src/resolvers/node.cjs';
import PresetEnv from '@babel/preset-env';

const minify = !process.env.CI;

const build = await rollup({
  input: './src/landing-page.cp.js',
  shimMissingExports: true,
  external: ['chai', 'mocha'],
  plugins: [
    lively({
      autoRun: {
        title: 'lively.next',
      },
      minify,
      isResurrectionBuild: true,
      asBrowserModule: true,
      excludedModules: [
        'chai','mocha', // references old lgtg that breaks the build
        'rollup', // has a dist file that cant be parsed by rollup
        // other stuff that is only needed by rollup
        '@babel/preset-env',
        '@babel/plugin-syntax-import-meta',
        '@rollup/plugin-json', 
        '@rollup/plugin-commonjs',
        'rollup-plugin-polyfill-node',
        'babel-plugin-transform-es2015-modules-systemjs'
      ],
      resolver
    }),
    jsonPlugin({ exclude: [/https\:\/\/jspm.dev\/.*\.json/, /esm\:\/\/cache\/.*\.json/]}),
    babel({
     babelHelpers: 'bundled', 
     presets: [PresetEnv]
    })
   ]
});

await build.write({
  format: 'system',
  dir: 'landing-page',
  globals: {
    chai: 'chai',
    mocha: 'mocha',
  },
});
