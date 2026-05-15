/* global process */
import { rollup } from '@rollup/wasm-node';
import jsonPlugin from '@rollup/plugin-json';
import { babel } from '@rollup/plugin-babel';
import PresetEnv from '@babel/preset-env';
import { rm, writeFile } from 'node:fs/promises';
import { lively } from 'lively.freezer/src/plugins/rollup';
import resolver from 'lively.freezer/src/resolvers/node.cjs';

const verbose = true; // process.argv[2] === '--verbose';
const minify = !process.env.CI;
const sourceMap = !!process.env.DEBUG;

/*
 * GitHub Actions sets CI=true, so install.sh uses this single-entry loading
 * screen build instead of the unified Docker/dev build. Keep this list aligned
 * with build.unified.mjs: the resurrection bundle needs enough UI/runtime code
 * to hand off into a world, but parser packages, storage adapters, editor
 * tooling, and build-time Rollup/Babel/SWC plugins should stay outside the
 * initial browser bundle. Pulling those tools into the boot chunk reintroduced
 * Node-only assumptions such as path.posix during the changed-package test
 * world load.
 */
const loadingScreenExcludedModules = [
  'mocha', 'chai', 'picomatch', // references old lgtg that breaks the build
  'rollup', // has a dist file that cant be parsed by rollup
  'eslint', 'pouchdb', 'pouchdb-adapter-mem',
  'lively.git', 'lively.storage', 'libsodium', 'libsodium-wrappers',
  'parse5', 'entities',
  'markdown-it', 'markdown-it-checkbox', 'markdown-it-implicit-figures',
  'markdown-it-html5-media', 'markdown-it-attrs', 'js-beautify',
  'path-is-absolute', 'fs.realpath',
  '@babel/core',
  '@babel/code-frame',
  '@babel/generator',
  '@babel/helpers',
  '@babel/highlight',
  '@babel/parser',
  '@babel/preset-env',
  '@babel/plugin-syntax-import-meta',
  '@babel/plugin-transform-modules-systemjs',
  '@babel/helper-module-imports',
  '@babel/template',
  '@babel/traverse',
  '@swc/core',
  '@rollup/plugin-json',
  '@rollup/plugin-commonjs',
  'rollup-plugin-polyfill-node',
  'esm://ga.jspm.io/npm:@rollup/plugin-commonjs',
  'esm://ga.jspm.io/npm:@rollup/plugin-inject',
  'esm://ga.jspm.io/npm:rollup-plugin-polyfill-node',
  'babel-plugin-transform-es2015-modules-systemjs'
];

try {
  console.log('   Bundling loading-screen...');

  /*
   * Match the unified build's browser context. Rollup's default top-level
   * `this` handling is too Node-like for resurrection chunks that execute in a
   * page before the live module system has fully taken over.
   */
  const build = await rollup({
    context: 'globalThis',
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
        /*
         * Keep Babel as the reliable compatibility pass for CI's boot bundle.
         * The SWC freezer path can still be tested separately, but the hosted
         * runner uses this script to prove that a browser world can load before
         * package tests run, so it should use the same conservative path as the
         * already validated unified build.
         */
        isResurrectionBuild: true,
        asBrowserModule: true,
        excludedModules: loadingScreenExcludedModules,
        resolver
      }),
      jsonPlugin({ exclude: [/https\:\/\/jspm.dev\/.*\.json/, /esm\:\/\/cache\/.*\.json/] }),
      babel({
        babelHelpers: 'bundled',
        presets: [
          [PresetEnv, {
            targets: '> 3%, not dead'
          }]
        ]
      })
     ]
  });

  await rm('loading-screen', { recursive: true, force: true });

  const { output } = await build.write({
    format: 'system',
    dir: 'loading-screen',
    sourcemap: sourceMap ? 'inline' : false,
    globals: {
      chai: 'chai',
      mocha: 'mocha',
    }
  });

  await writeLoadingScreenCompatibilityEntry(output);

  console.log('   Loading screen build complete');

} catch (err) {
  console.error('\x1b[31m   [ERROR] Loading screen build failed:\x1b[0m');
  console.error('   ' + (err.message || err));
  process.exit(1);
}

function findRenderFrozenPartEntry (output) {
  const entry = output.find(chunk =>
    chunk.type === 'chunk' && chunk.exports && chunk.exports.includes('renderFrozenPart'));
  if (!entry) throw new Error('Could not find loading-screen renderFrozenPart entry chunk');
  return entry.fileName;
}

async function writeLoadingScreenCompatibilityEntry (output) {
  const entryFile = findRenderFrozenPartEntry(output);
  await writeFile('loading-screen/loading-screen.js', `BootstrapSystem._currentFile = "loading-screen.js";
BootstrapSystem.register(['./${entryFile}'], (function (exports) {
  return {
    setters: [function (module) {
      exports("renderFrozenPart", module.renderFrozenPart);
    }],
    execute: (function () {})
  };
}));
`);
}
