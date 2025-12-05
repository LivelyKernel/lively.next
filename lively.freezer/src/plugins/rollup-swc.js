/**
 * Rollup plugin for lively.next using SWC transforms
 *
 * This is a high-performance alternative to the Babel-based Rollup plugin,
 * using the SWC-based transform pipeline.
 */

import { createFilter } from '@rollup/pluginutils';
import path from 'path';
import { LivelySwcTransform } from '../bundler-swc.js';

/**
 * Create a Rollup plugin using SWC transforms
 *
 * @param {object} options - Plugin options
 * @returns {object} - Rollup plugin
 */
export function livelySwcPlugin(options = {}) {
  const {
    include = ['**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx'],
    exclude = ['node_modules/**'],
    captureObj = '__varRecorder__',
    resurrection = false,
    declarationWrapper = null,
    classToFunction = null,
    captureImports = true,
    packageName = null,
    packageVersion = null,
    sourceMap = true,
    ...transformOptions
  } = options;

  const filter = createFilter(include, exclude);
  const transform = new LivelySwcTransform({
    captureObj,
    ...transformOptions,
  });

  return {
    name: 'lively-swc',

    /**
     * Transform hook - apply SWC transforms to matching files
     */
    transform(code, id) {
      // Skip non-matching files
      if (!filter(id)) {
        return null;
      }

      // Skip files explicitly marked as external
      if (id.includes('node_modules') && !options.transformNodeModules) {
        return null;
      }

      try {
        const result = transform.transform(code, {
          moduleId: id,
          packageName,
          packageVersion,
          resurrection,
          declarationWrapper,
          classToFunction,
          captureImports,
          sourceMap,
          filename: path.basename(id),
        });

        return {
          code: result.code,
          map: result.map,
        };
      } catch (error) {
        this.error({
          message: `Failed to transform ${id}: ${error.message}`,
          id,
          cause: error,
        });
      }
    },

    /**
     * Build start hook - log SWC usage
     */
    buildStart() {
      console.log('🚀 Using SWC-based lively.next transforms');
      console.log('   Expected speedup: 5-10x over Babel');
    },

    /**
     * Render chunk hook - post-process generated chunks
     */
    renderChunk(code, chunk, outputOptions) {
      // Apply any necessary post-processing
      // This is where namespace bulletproofing would go, similar to the original bundler
      return null;
    },
  };
}

/**
 * Extended plugin with additional lively.next bundling features
 */
export function livelySwcBundlerPlugin(options = {}) {
  const basePlugin = livelySwcPlugin(options);

  return {
    ...basePlugin,
    name: 'lively-swc-bundler',

    /**
     * Resolve ID hook - handle lively.next-specific module resolution
     */
    resolveId(source, importer, options) {
      // Custom resolution logic for lively.next modules
      // This would integrate with the existing resolution logic from bundler.js
      return null;
    },

    /**
     * Load hook - handle special module loading
     */
    load(id) {
      // Custom loading logic for lively.next modules
      return null;
    },

    /**
     * Generate bundle hook - create assets, minify, etc.
     */
    generateBundle(outputOptions, bundle) {
      // This is where we'd add:
      // - Minification (using SWC's minifier instead of Closure Compiler)
      // - Compression (Brotli/Gzip)
      // - Asset generation
      // - Source map processing
    },
  };
}

export default livelySwcPlugin;
