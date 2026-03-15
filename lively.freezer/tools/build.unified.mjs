/* global process */
import { rollup } from '@rollup/wasm-node';
import jsonPlugin from '@rollup/plugin-json';
import util from 'node:util';
import { lively } from 'lively.freezer/src/plugins/rollup';
import resolver from 'lively.freezer/src/resolvers/node.cjs';

const verbose = process.argv[2] === '--verbose';
const minify = !process.env.CI;
const sourceMap = !!process.env.DEBUG;

// Combine excluded modules from both builds to ensure compatibility
const commonExcludedModules = [
  'chai', 'mocha', // references old lgtg that breaks the build
  'rollup', // has a dist file that cant be parsed by rollup
  'picomatch', 'path-is-absolute', 'fs.realpath', // from loading-screen build
  // other stuff that is only needed by rollup
  '@swc/core',
  '@rollup/plugin-json',
  '@rollup/plugin-commonjs',
  'rollup-plugin-polyfill-node',
  'babel-plugin-transform-es2015-modules-systemjs'
];

const commonAutoRunConfig = {
  title: 'lively.next',
  head: `
  <link rel="preload" id="compressed" href="/compressed-sources" as="fetch" crossOrigin>
  <link rel="preload" id="registry" href="/package-registry.json" as="fetch" crossOrigin>
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
  const fs = await import('fs/promises');

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
