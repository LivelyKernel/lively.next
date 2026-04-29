/* global process */
import { rollup } from '@rollup/wasm-node';
import jsonPlugin from '@rollup/plugin-json';
import { rm, writeFile } from 'node:fs/promises';
import { lively } from 'lively.freezer/src/plugins/rollup';
import resolver from 'lively.freezer/src/resolvers/node.cjs';

const verbose = true; // process.argv[2] === '--verbose';
const minify = !process.env.CI;
const sourceMap = !!process.env.DEBUG;
try {
  console.log('   Bundling loading-screen...');

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
        useSwc: true,
        isResurrectionBuild: true,
        asBrowserModule: true,
        excludedModules: [
          'mocha', 'chai', 'picomatch', // references old lgtg that breaks the build
          'path-is-absolute', 'fs.realpath', // has a dist file that cant be parsed by rollup
          '@babel/preset-env',
          '@babel/plugin-syntax-import-meta',
          '@rollup/plugin-json',
          '@rollup/plugin-commonjs',
          '@swc/core',
          'rollup-plugin-polyfill-node',
          'babel-plugin-transform-es2015-modules-systemjs'
        ],
        resolver
      }),
      jsonPlugin({ exclude: [/https\:\/\/jspm.dev\/.*\.json/, /esm\:\/\/cache\/.*\.json/] })
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
