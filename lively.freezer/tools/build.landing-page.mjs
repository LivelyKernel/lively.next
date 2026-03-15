/* global process */
import { rollup } from '@rollup/wasm-node';
import jsonPlugin from '@rollup/plugin-json';
import { babel } from '@rollup/plugin-babel';
import { lively } from 'lively.freezer/src/plugins/rollup';
import resolver from 'lively.freezer/src/resolvers/node.cjs';
import PresetEnv from '@babel/preset-env';

const verbose = process.argv[2] === '--verbose';
const minify = !process.env.CI;
const sourceMap = !!process.env.DEBUG;
try {
  console.log('   Bundling landing-page...');

  const build = await rollup({
    input: './src/landing-page.cp.js',
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
        minify,
        verbose,
        sourceMap,
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
        presets: [
        [PresetEnv,
        {
          "targets": "> 3%, not dead"
        }]
      ]
      })
     ]
  });

  await build.write({
    format: 'system',
    dir: 'landing-page',
    sourcemap: sourceMap ? 'inline' : false,
    globals: {
      chai: 'chai',
      mocha: 'mocha',
    },
  });

  console.log('   Landing page build complete');

} catch (err) {
  console.error('\x1b[31m   [ERROR] Landing page build failed:\x1b[0m');
  console.error('   ' + (err.message || err));
  process.exit(1);
}
