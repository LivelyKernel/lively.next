/* global process */
import { rollup } from '@rollup/wasm-node';
import jsonPlugin from '@rollup/plugin-json';
import util from 'node:util';
import fs from 'node:fs/promises';
import { lively } from 'lively.freezer/src/plugins/rollup.js';
import resolver from 'lively.freezer/src/resolvers/node.cjs';

const verbose = process.argv[2] === '--verbose';
const minify = !process.env.CI;
const sourceMap = !!process.env.DEBUG;

// Combine excluded modules from both builds to ensure compatibility
const commonExcludedModules = [
  'mocha-es6', 'chai', 'mocha', // references old lgtg that breaks the build
  'rollup', // has a dist file that cant be parsed by rollup
  'picomatch', 'path-is-absolute', 'fs.realpath', // from loading-screen build
  // other stuff that is only needed by rollup
  '@swc/core',
  '@rollup/plugin-json',
  '@rollup/plugin-commonjs',
  'rollup-plugin-polyfill-node',
  'babel-plugin-transform-es2015-modules-systemjs'
];

// Paint the existing desktop triangles while the frozen module graph loads.
const bootHtml = await fs.readFile(new URL('../../lively.app/desktop/boot.html', import.meta.url), 'utf8');
const loadingBackground = bootHtml.match(/<svg class="triangles"[\s\S]*?<\/svg>/)?.[0];
if (!loadingBackground) throw new Error('Desktop boot triangle background is missing');

const commonAutoRunConfig = {
  title: 'lively.next',
  load: loadingBackground,
  head: `
  <style>
    #loading-screen {
      position: fixed;
      inset: 0;
      z-index: -1;
      pointer-events: none;
      background: linear-gradient(135deg, #F1C40F, #F39C12);
    }
    #loading-screen svg { width: 100%; height: 100%; }
  </style>
  <script>
    if (!window.livelyNative) {
      for (const [id, href] of [['compressed', '/compressed-sources'], ['registry', '/package-registry.json']]) {
        const link = document.createElement('link');
        Object.assign(link, { rel: 'preload', id, href, as: 'fetch', crossOrigin: 'anonymous' });
        document.head.appendChild(link);
      }
    }
  </script>
  `
};

// Common plugins configuration
const commonPlugins = [
  jsonPlugin({ exclude: [/https\:\/\/jspm.dev\/.*\.json/, /esm\:\/\/cache\/.*\.json/] })
];

try {
  console.log('   Bundling landing-page + loading-screen...');

  // Single rollup build with multiple entry points
  // Rollup will automatically share module parsing, transformation, and resolution
  const build = await rollup({
    input: {
      'landing-page': './src/landing-page.cp.js',
      'loading-screen': './src/loading-screen.cp.js'
    },
    shimMissingExports: true,
    external: ['chai', 'mocha'],
    plugins: [
      lively({
        // Note: For multi-entry builds, autoRun config is used for HTML generation
        // but the rootModule synthesis is skipped (handled by rollup plugin)
        autoRun: commonAutoRunConfig,
        minify,
        verbose,
        sourceMap,
        useSwc: true,
        isResurrectionBuild: true,
        asBrowserModule: true,
        excludedModules: commonExcludedModules,
        resolver
      }),
      ...commonPlugins
    ]
  });

  console.log('   Writing outputs...');

  await fs.rm('landing-page', { recursive: true, force: true });
  await fs.rm('loading-screen', { recursive: true, force: true });

  // Write landing-page output
  await build.write({
    format: 'system',
    dir: 'landing-page',
    entryFileNames: '[name].js',
    chunkFileNames: '[name]-[hash].js',
    sourcemap: sourceMap ? 'inline' : false,
    globals: {
      chai: 'chai',
      mocha: 'mocha',
    },
  });
  console.log('   Landing page written to landing-page/');

  // Write loading-screen output
  await build.write({
    format: 'system',
    dir: 'loading-screen',
    entryFileNames: '[name].js',
    chunkFileNames: '[name]-[hash].js',
    sourcemap: sourceMap ? 'inline' : false,
    globals: {
      chai: 'chai',
      mocha: 'mocha',
    }
  });
  console.log('   Loading screen written to loading-screen/');

  // Post-process: Copy the correct index.html for each directory
  try {
    await fs.copyFile('landing-page/index-landing-page.html', 'landing-page/index.html');
  } catch (err) {
    console.warn('\x1b[33m   [!] Could not copy landing-page index.html: ' + err.message + '\x1b[0m');
  }

  try {
    await fs.copyFile('loading-screen/index-loading-screen.html', 'loading-screen/index.html');
  } catch (err) {
    console.warn('\x1b[33m   [!] Could not copy loading-screen index.html: ' + err.message + '\x1b[0m');
  }

  console.log('   Unified build complete');

} catch (err) {
  console.error('\x1b[31m   [ERROR] Freezer build failed:\x1b[0m');
  console.error('   ' + (err.message || err));
  if (err && typeof err === 'object') {
    const details = {
      name: err.name,
      code: err.code,
      id: err.id,
      plugin: err.plugin,
      pluginCode: err.pluginCode,
      hook: err.hook,
      loc: err.loc,
      frame: err.frame,
    };
    const filtered = Object.fromEntries(Object.entries(details).filter(([, v]) => v != null));
    if (Object.keys(filtered).length > 0) {
      console.error('   ' + util.inspect(filtered, { depth: 4, colors: true }));
    }
  }
  process.exit(1);
}
