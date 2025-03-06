/* global process */
import { rollup } from 'rollup';
import jsonPlugin from '@rollup/plugin-json';
import { babel } from '@rollup/plugin-babel';
import { lively } from 'lively.freezer/src/plugins/rollup';
import resolver from 'lively.freezer/src/resolvers/node.cjs';
import PresetEnv from '@babel/preset-env';

const verbose = process.argv[2] === '--verbose';
const minify = !process.env.CI;
const sourceMap = true;
try {
  const build = await rollup({
    input: './src/loading-screen.cp.js',
    shimMissingExports: true,
    external: ['chai', 'mocha'],
    plugins: [
      lively({
        autoRun: {
          title: 'lively.next',
          head: `
  <link rel="preload" id="compressed" href="/compressed-sources" as="fetch" crossOrigin>
  <link rel="preload" id="registry" href="/package-registry.json" as="fetch" crossOrigin>
          `
        },
        sourceMap,
        minify,
        verbose,
        isResurrectionBuild: true,
        asBrowserModule: true,
        excludedModules: [
          'mocha', 'chai', 'picomatch', // references old lgtg that breaks the build
          'path-is-absolute', 'fs.realpath', 'rollup', // has a dist file that cant be parsed by rollup
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
    dir: 'loading-screen',
    sourcemap: sourceMap ? 'inline' : false,
    globals: {
      chai: 'chai',
      mocha: 'mocha',
    }
  });

} catch (err) {
  console.log(err);
  process.exit(1);
}
