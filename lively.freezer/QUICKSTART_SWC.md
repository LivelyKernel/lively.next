# Quick Start: SWC Freezer Bundler

Get the SWC-based freezer bundler running in 5 minutes.

## Prerequisites

```bash
# Check if you have Rust installed
rustc --version

# If not, install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Add WebAssembly target
rustup target add wasm32-wasip1
```

## Installation

```bash
# Navigate to the freezer directory
cd lively.next/lively.freezer

# Install Node.js dependencies (includes @swc/core)
npm install

# Build the Rust plugin (takes 2-3 minutes first time)
npm run build-swc-plugin
```

## Verify Installation

```bash
# Check if the plugin was built
ls -lh swc-plugin/target/wasm32-wasip1/release/lively_swc_plugin.wasm

# Should show a .wasm file (~2-5 MB)

# Run Rust tests
npm run test-swc-plugin
```

## Basic Usage

### Option 1: Transform a Single File

```javascript
import { transformLivelyCode } from './src/bundler-swc.js';

const code = `
class MyClass {
  method() { return 42; }
}
`;

const result = transformLivelyCode(code, {
  moduleId: 'my-module.js'
});

console.log(result.code);
```

### Option 2: Use with Rollup

```javascript
import { livelySwcPlugin } from './src/plugins/rollup-swc.js';
import { rollup } from '@rollup/wasm-node';

const bundle = await rollup({
  input: 'src/index.js',
  plugins: [livelySwcPlugin()]
});
```

### Option 3: Run Example

```bash
# Run the provided example
node examples/use-swc-bundler.js
```

## Troubleshooting

### "Cannot find module 'lively_swc_plugin.wasm'"

**Solution**: Build the plugin first
```bash
npm run build-swc-plugin
```

### "target 'wasm32-wasip1' may not be installed"

**Solution**: Install the Wasm target
```bash
rustup target add wasm32-wasip1
```

### "Using JavaScript fallback" warning

**Solution**: This means the Rust plugin isn't loaded. Rebuild:
```bash
npm run build-swc-plugin
# Verify the .wasm file exists
ls swc-plugin/target/wasm32-wasip1/release/*.wasm
```

### Build takes too long

**Solution**: Use dev build for faster iteration:
```bash
npm run build-swc-plugin-dev  # Faster, no optimizations
```

## Next Steps

1. **Read the full documentation**: [SWC_BUNDLER_README.md](./SWC_BUNDLER_README.md)
2. **Check the architecture**: [SWC_ARCHITECTURE.md](./SWC_ARCHITECTURE.md)
3. **Review implementation**: [SWC_IMPLEMENTATION_SUMMARY.md](./SWC_IMPLEMENTATION_SUMMARY.md)
4. **Try the examples**: [examples/use-swc-bundler.js](./examples/use-swc-bundler.js)

## Performance Check

Run this to see the performance difference:

```javascript
import { transformLivelyCode } from './src/bundler-swc.js';

const code = `
class Test {
  field = 1;
  method() { return this.field; }
}
`.repeat(100); // 100 classes

console.time('SWC Transform');
for (let i = 0; i < 10; i++) {
  transformLivelyCode(code, { moduleId: 'test.js' });
}
console.timeEnd('SWC Transform');

// Expected: 50-100ms (vs 500-800ms with Babel)
```

## Quick Commands

```bash
# Development build (faster)
npm run build-swc-plugin-dev

# Production build (optimized)
npm run build-swc-plugin

# Run tests
npm run test-swc-plugin

# Clean build
cd swc-plugin && cargo clean
```

## Need Help?

- Check [SWC_BUNDLER_README.md](./SWC_BUNDLER_README.md#troubleshooting) for detailed troubleshooting
- Look at [examples/](./examples/) for usage patterns
- Read the [implementation summary](./SWC_IMPLEMENTATION_SUMMARY.md) for architecture details

## Status

✅ Rust plugin implemented (7 transforms)
✅ Node.js wrapper ready
✅ Rollup plugin ready
✅ Documentation complete
⏳ Needs testing with real lively.next code
⏳ Needs integration with existing bundler

**Ready to test!** 🚀
