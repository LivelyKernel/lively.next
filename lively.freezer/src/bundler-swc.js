/**
 * SWC-based implementation of the lively.next freezer bundler
 *
 * This is a high-performance alternative to the Babel-based bundler,
 * using custom Rust SWC plugins for 5-10x faster transforms.
 */

import { transformSync } from '@swc/core';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

/**
 * SWC-based transform pipeline for lively.next
 */
export class LivelySwcTransform {
  constructor(options = {}) {
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
  }

  /**
   * Transform code using SWC with lively plugins
   *
   * @param {string} code - Source code to transform
   * @param {object} options - Transform options
   * @returns {object} - Transformed code and sourcemap
   */
  transform(code, options = {}) {
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
      } = options;

    try {
      // Build SWC configuration
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
            importMeta: true,
          },
          target: 'es2015',
          loose: false,
          externalHelpers: false,
        },
      };

      let classToFunctionConfig = null;
      if (classToFunction === undefined) {
        classToFunctionConfig = {
          classHolder: this.options.captureObj,
          functionNode: 'initializeES6ClassForLively',
          currentModuleAccessor: 'module.id',
        };
      } else if (classToFunction === false || classToFunction === null) {
        classToFunctionConfig = null;
      } else {
        classToFunctionConfig = classToFunction;
      }

      // Configure lively transform plugin
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
      };

      // Legacy pipeline prepends this import when class instrumentation is enabled.
      // Keep SWC behavior aligned so `_get/_set` helpers have a bound identifier and
      // recorder capture can wire `initializeES6ClassForLively` correctly.
      const classRuntimeModule = resurrection ? 'livelyClassesRuntime.js' : 'lively.classes/runtime.js';
      const classRuntimeImport = `import { initializeClass as initializeES6ClassForLively } from "${classRuntimeModule}";\n`;
      const sourceForTransform = classToFunctionConfig &&
        !code.includes('initializeClass as initializeES6ClassForLively')
        ? classRuntimeImport + code
        : code;

      // Check if we have the Rust plugin available
      const moduleDir = path.dirname(fileURLToPath(import.meta.url));
      const pluginPath = path.join(moduleDir, '../swc-plugin/target/wasm32-wasip1/release/lively_swc_plugin.wasm');
      const hasPlugin = existsSync(pluginPath);

      const swcOptions = {
        ...swcConfig,
        jsc: {
          ...swcConfig.jsc,
          ...(hasPlugin
            ? {
              experimental: {
                plugins: [[pluginPath, livelyConfig]],
              },
            }
            : {}),
        },
      };

      let result;
      let usedPlugin = false;
      try {
        result = transformSync(sourceForTransform, swcOptions);
        usedPlugin = hasPlugin;
      } catch (error) {
        if (hasPlugin) {
          console.warn('⚠️  Failed to load SWC Rust plugin, falling back to JS transforms:', error.message);
          result = transformSync(sourceForTransform, swcConfig);
        } else {
          throw error;
        }
      }

      // For now, apply post-processing transforms in JavaScript
      // This is a temporary solution until the Rust plugin is fully integrated
      const transformedCode = usedPlugin
        ? result.code
        : this.applyLivelyTransformsJs(result.code, livelyConfig);

      return {
        code: transformedCode,
        map: result.map,
      };
    } catch (error) {
      console.error('SWC Transform Error:', error);
      throw error;
    }
  }

  /**
   * Temporary JavaScript implementation of transforms
   * TODO: Remove once Rust plugin is compiled and integrated
   */
  applyLivelyTransformsJs(code, config) {
    // This is a placeholder that would apply the transforms in JavaScript
    // In production, this would be handled entirely by the Rust plugin

    // For now, just return the code as-is
    // The full implementation would require babel/lively.ast transforms
    console.warn('⚠️  Using JavaScript fallback - Rust plugin not yet compiled');
    console.warn('   Run: cd swc-plugin && cargo build --release --target wasm32-wasip1');

    return code;
  }

  /**
   * Get cache key for this transform configuration
   */
  getCacheKey(code, options) {
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
export function createLivelySwcTransform(options) {
  return new LivelySwcTransform(options);
}

/**
 * Standalone transform function for simple use cases
 */
export function transformLivelyCode(code, options = {}) {
  const transform = new LivelySwcTransform(options);
  return transform.transform(code, options);
}

export default LivelySwcTransform;
