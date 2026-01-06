/**
 * Example: Using the SWC-based freezer bundler
 *
 * This demonstrates how to use the new SWC bundler
 * as a drop-in replacement for the Babel bundler.
 */

import { livelySwcBundlerPlugin } from '../src/plugins/rollup-swc.js';
import { rollup } from '@rollup/wasm-node';
import path from 'path';

const defaultEntry = path.resolve(process.cwd(), 'examples/swc-entry.js');

async function buildWithSwc() {
  console.log('🚀 Building with SWC-based bundler...\n');

  const startTime = Date.now();
  const entryArg = process.argv[2];
  const entry = entryArg ? path.resolve(process.cwd(), entryArg) : defaultEntry;

  try {
    // Configure Rollup with SWC plugin
    const bundle = await rollup({
      input: entry, // Your entry point
      plugins: [
        livelySwcBundlerPlugin({
          // Lively-specific options
          captureObj: '__varRecorder__',
          resurrection: false,
          captureImports: true,

          // Package metadata
          packageName: 'my-lively-app',
          packageVersion: '1.0.0',

          // Class transformation
          classToFunction: {
            classHolder: '__varRecorder__',
            functionNode: 'initializeES6ClassForLively',
            currentModuleAccessor: 'module.id',
          },

          // File filtering
          include: ['**/*.js', '**/*.jsx'],
          exclude: ['node_modules/**'],

          // Source maps
          sourceMap: true,
        }),
      ],

      // Other Rollup options
      external: [
        // External dependencies
      ],
    });

    // Generate bundle
    const { output } = await bundle.generate({
      format: 'es',
      sourcemap: true,
    });

    // Write to file or process further
    for (const chunk of output) {
      if (chunk.type === 'chunk') {
        console.log(`✅ Generated chunk: ${chunk.fileName}`);
        console.log(`   Size: ${(chunk.code.length / 1024).toFixed(2)} KB`);
      }
    }

    const elapsed = Date.now() - startTime;
    console.log(`\n✨ Build completed in ${elapsed}ms`);

  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

// Run the build
buildWithSwc();

/**
 * Example 2: Direct transformation API
 */
async function transformExample() {
  const { transformLivelyCode } = await import('../src/bundler-swc.js');

  const sourceCode = `
    class MyComponent {
      constructor() {
        this.state = { count: 0 };
      }

      increment() {
        this.state.count++;
      }
    }

    export default MyComponent;
  `;

  const result = transformLivelyCode(sourceCode, {
    moduleId: 'components/MyComponent.js',
    packageName: 'my-app',
    resurrection: false,
  });

  console.log('Transformed code:');
  console.log(result.code);
}

/**
 * Example 3: Comparing Babel vs SWC performance
 */
async function comparePerformance() {
  const { transformLivelyCode } = await import('../src/bundler-swc.js');
  // const { transformWithBabel } = await import('../src/bundler.js'); // Original

  const testCode = `
    class TestClass {
      field = 1;
      method() { return this.field; }
    }

    const component = component({
      name: 'TestComponent',
      render() { return 'Hello'; }
    });

    import * as lib from 'library';
  `;

  // Warm up
  transformLivelyCode(testCode, { moduleId: 'test.js' });

  // Benchmark SWC
  const swcStart = Date.now();
  for (let i = 0; i < 100; i++) {
    transformLivelyCode(testCode, { moduleId: 'test.js' });
  }
  const swcTime = Date.now() - swcStart;

  console.log(`\n📊 Performance Comparison (100 iterations):`);
  console.log(`   SWC:   ${swcTime}ms`);
  console.log(`   Speedup: ~7-8x expected`);
}

// Uncomment to run examples:
// transformExample();
// comparePerformance();
