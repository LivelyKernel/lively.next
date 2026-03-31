/**
 * SWC-based implementation of the lively.next freezer bundler
 *
 * This is a high-performance alternative to the Babel-based bundler,
 * using custom Rust SWC plugins for 5-10x faster transforms.
 */

import { transformSync, transform as transformAsync_, minify } from '@swc/core';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

/**
 * SWC-based transform pipeline for lively.next
 */
export class LivelySwcTransform {
  constructor (options = {}) {
    this.options = {
      captureObj: '__varRecorder__',
      exclude: [
        'console', 'window', 'document', 'global', 'process', 'Buffer',
        'System', '__contextModule__',
        'Object', 'Array', 'Function', 'String', 'Number', 'Boolean',
        'Symbol', 'Date', 'Math', 'JSON', 'Promise', 'RegExp', 'Error',
        'Map', 'Set', 'WeakMap', 'WeakSet', 'Proxy', 'Reflect',
        'undefined', 'NaN', 'Infinity'
      ],
      ...options
    };

    // Cache plugin path lookup
    const moduleDir = path.dirname(fileURLToPath(import.meta.url));
    const prebuiltPath = path.join(moduleDir, '../swc-plugin/lively_swc_plugin.wasm');
    const cargoPath = path.join(moduleDir, '../swc-plugin/target/wasm32-wasip1/release/lively_swc_plugin.wasm');
    this._pluginPath = existsSync(cargoPath) ? cargoPath : prebuiltPath;
    this._hasPlugin = existsSync(this._pluginPath);
  }

  /**
   * Build SWC config objects from transform options.
   * Shared between sync and async transform paths.
   */
  _buildSwcConfig (code, options = {}) {
    const {
      moduleId = 'unknown',
      packageName = null,
      packageVersion = null,
      currentModuleAccessor = null,
      resurrection = false,
      declarationWrapper = null,
      classToFunction = null,
      resolvedImports = {},
      captureImports = true,
      sourceMap = true,
      filename = 'unknown.js',
      moduleHash = null
    } = options;

    const swcConfig = {
      filename,
      sourceMaps: sourceMap,
      jsc: {
        parser: {
          syntax: 'ecmascript',
          jsx: true,
          dynamicImport: true,
          privateMethod: true,
          functionBind: true,
          exportDefaultFrom: true,
          exportNamespaceFrom: true,
          decorators: true,
          decoratorsBeforeExport: true,
          topLevelAwait: true,
          importMeta: true
        },
        target: 'es2015',
        loose: false,
        externalHelpers: false
      }
    };

    const classToFunctionConfig = classToFunction || null;

    const livelyConfig = {
      captureObj: this.options.captureObj,
      declarationWrapper,
      classToFunction: classToFunctionConfig,
      exclude: this.options.exclude,
      captureImports,
      resurrection,
      moduleId,
      currentModuleAccessor: currentModuleAccessor || classToFunctionConfig?.currentModuleAccessor || null,
      packageName,
      packageVersion,
      enableComponentTransform: true,
      enableNamespaceTransform: true,
      enableDynamicImportTransform: true,
      enableSystemjsTransform: false,
      enableExportSplit: true,
      resolvedImports,
      ...(moduleHash != null ? { moduleHash } : {})
    };

    const classRuntimeModule = resurrection ? 'livelyClassesRuntime.js' : 'lively.classes/runtime.js';
    const classRuntimeImport = `import { initializeClass as initializeES6ClassForLively } from "${classRuntimeModule}";\n`;
    const sourceForTransform = classToFunctionConfig &&
      !code.includes('initializeClass as initializeES6ClassForLively')
      ? classRuntimeImport + code
      : code;

    const swcOptions = {
      ...swcConfig,
      jsc: {
        ...swcConfig.jsc,
        ...(this._hasPlugin
          ? { experimental: { plugins: [[this._pluginPath, livelyConfig]] } }
          : {})
      }
    };

    return { swcConfig, swcOptions, livelyConfig, sourceForTransform };
  }

  /**
   * Process the raw SWC result into the final output.
   */
  _processResult (result, usedPlugin, livelyConfig) {
    const transformedCode = usedPlugin
      ? result.code
      : this.applyLivelyTransformsJs(result.code, livelyConfig);
    return { code: transformedCode, map: result.map };
  }

  /**
   * Transform code using SWC with lively plugins (synchronous).
   *
   * @param {string} code - Source code to transform
   * @param {object} options - Transform options
   * @returns {{ code: string, map?: string }}
   */
  transform (code, options = {}) {
    try {
      const { swcConfig, swcOptions, livelyConfig, sourceForTransform } =
        this._buildSwcConfig(code, options);

      let result;
      let usedPlugin = false;
      try {
        result = transformSync(sourceForTransform, swcOptions);
        usedPlugin = this._hasPlugin;
      } catch (error) {
        if (this._hasPlugin) {
          console.warn('\x1b[33m       [!] SWC Rust plugin failed, falling back to JS transforms: ' + error.message + '\x1b[0m');
          result = transformSync(sourceForTransform, swcConfig);
        } else {
          throw error;
        }
      }

      return this._processResult(result, usedPlugin, livelyConfig);
    } catch (error) {
      console.error('\x1b[31m       [ERROR] SWC transform: ' + error.message + '\x1b[0m');
      throw error;
    }
  }

  /**
   * Transform code using SWC with lively plugins (async).
   * Uses SWC's native napi thread pool — multiple concurrent calls
   * run in parallel across CPU cores.
   *
   * @param {string} code - Source code to transform
   * @param {object} options - Transform options
   * @returns {Promise<{ code: string, map?: string }>}
   */
  async transformAsync (code, options = {}) {
    try {
      const { swcConfig, swcOptions, livelyConfig, sourceForTransform } =
        this._buildSwcConfig(code, options);

      let result;
      let usedPlugin = false;
      try {
        result = await transformAsync_(sourceForTransform, swcOptions);
        usedPlugin = this._hasPlugin;
      } catch (error) {
        if (this._hasPlugin) {
          console.warn('\x1b[33m       [!] SWC Rust plugin failed, falling back to JS transforms: ' + error.message + '\x1b[0m');
          result = await transformAsync_(sourceForTransform, swcConfig);
        } else {
          throw error;
        }
      }

      return this._processResult(result, usedPlugin, livelyConfig);
    } catch (error) {
      console.error('\x1b[31m       [ERROR] SWC transform: ' + error.message + '\x1b[0m');
      throw error;
    }
  }

  /**
   * Lightweight transform that only rewrites System.import() → import().
   * Used for ROOT_ID modules and modules that don't need scope capture.
   * Runs the SWC plugin with all transforms disabled except DynamicImportTransform.
   *
   * @param {string} code - Source code
   * @param {object} [options]
   * @param {string} [options.filename]
   * @returns {{ code: string, map?: string }}
   */
  transformDynamicImportsOnly (code, options = {}) {
    const { filename = 'unknown.js' } = options;

    if (!this._hasPlugin) {
      return { code };
    }

    const livelyConfig = {
      captureObj: this.options.captureObj,
      exclude: this.options.exclude,
      captureImports: false,
      resurrection: false,
      moduleId: '',
      enableComponentTransform: false,
      enableNamespaceTransform: false,
      enableDynamicImportTransform: true,
      enableSystemjsTransform: false,
      enableExportSplit: false,
      enableScopeCapture: false
    };

    const result = transformSync(code, {
      filename,
      sourceMaps: false,
      jsc: {
        parser: {
          syntax: 'ecmascript',
          jsx: true,
          dynamicImport: true,
          topLevelAwait: true
        },
        target: 'es2015',
        experimental: {
          plugins: [[this._pluginPath, livelyConfig]]
        }
      }
    });

    return { code: result.code };
  }

  /**
   * Temporary JavaScript implementation of transforms
   * TODO: Remove once Rust plugin is compiled and integrated
   */
  applyLivelyTransformsJs (code, config) {
    console.warn('\x1b[33m       [!] Using JS fallback — Rust plugin not compiled. Run: cd swc-plugin && cargo build --release --target wasm32-wasip1\x1b[0m');
    return code;
  }

  /**
   * Get cache key for this transform configuration
   */
  getCacheKey (code, options) {
    const hash = createHash('md5');
    hash.update(code);
    hash.update(JSON.stringify(options));
    hash.update(JSON.stringify(this.options));
    return hash.digest('hex');
  }
}

/**
 * Factory function to create transform instance
 */
export function createLivelySwcTransform (options) {
  return new LivelySwcTransform(options);
}

/**
 * Standalone transform function for simple use cases
 */
export function transformLivelyCode (code, options = {}) {
  const transform = new LivelySwcTransform(options);
  return transform.transform(code, options);
}

/**
 * Minify code using SWC's native minifier.
 * Uses the async API so multiple chunks can be minified in parallel
 * across SWC's native thread pool.
 *
 * @param {string} code - Source code to minify
 * @returns {Promise<{code: string, map?: string}>}
 */
export async function swcMinify (code) {
  return minify(code, {
    compress: {
      defaults: false,
      dead_code: true,
      conditionals: true,
      comparisons: true,
      booleans: true,
      typeofs: true,
      if_return: true,
      join_vars: true,
      sequences: true,
      switches: true,
      negate_iife: true,
      properties: true,
      drop_debugger: true,
      loops: true
    },
    mangle: true,
    ecma: 2018
  });
}

export default LivelySwcTransform;
