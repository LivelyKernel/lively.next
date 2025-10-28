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

// Combine excluded modules from both builds to ensure compatibility
const commonExcludedModules = [
  'chai', 'mocha', // references old lgtg that breaks the build
  'rollup', // has a dist file that cant be parsed by rollup
  'picomatch', 'path-is-absolute', 'fs.realpath', // from loading-screen build
  // other stuff that is only needed by rollup
  '@babel/preset-env',
  '@babel/plugin-syntax-import-meta',
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
  jsonPlugin({ exclude: [/https\:\/\/jspm.dev\/.*\.json/, /esm\:\/\/cache\/.*\.json/] }),
  babel({
    babelHelpers: 'bundled',
    presets: [
      [PresetEnv, {
        "targets": "> 3%, not dead"
      }]
    ]
  })
];

try {
  console.log('[lively.freezer] Starting unified build for landing-page and loading-screen...');

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
        isResurrectionBuild: true,
        asBrowserModule: true,
        excludedModules: commonExcludedModules,
        resolver
      }),
      ...commonPlugins
    ]
  });

  console.log('[lively.freezer] Build complete, writing outputs...');

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
  console.log('[lively.freezer] ✓ Landing page written to landing-page/');

  // Write loading-screen output
  // Note: We need a second write() call to output to a different directory
  // The build is already done, so this is just writing the same build to a different location
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
  console.log('[lively.freezer] ✓ Loading screen written to loading-screen/');

  // Post-process: Copy the correct index.html for each directory
  // The build generates index-landing-page.html and index-loading-screen.html
  // We copy the appropriate one to index.html in each directory
  const fs = await import('fs/promises');

  try {
    await fs.copyFile('landing-page/index-landing-page.html', 'landing-page/index.html');
    console.log('[lively.freezer] ✓ Set landing-page/index.html to load landing-page entry');
  } catch (err) {
    console.warn('[lively.freezer] ⚠ Could not copy landing-page index.html:', err.message);
  }

  try {
    await fs.copyFile('loading-screen/index-loading-screen.html', 'loading-screen/index.html');
    console.log('[lively.freezer] ✓ Set loading-screen/index.html to load loading-screen entry');
  } catch (err) {
    console.warn('[lively.freezer] ⚠ Could not copy loading-screen index.html:', err.message);
  }

  console.log('[lively.freezer] ✓ Unified build complete!');

} catch (err) {
  console.error('[lively.freezer] Build failed:');
  console.error(err);
  process.exit(1);
}
