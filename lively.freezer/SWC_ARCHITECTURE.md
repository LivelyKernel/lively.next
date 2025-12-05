# SWC-Based Freezer Bundler Architecture

## Overview

This document outlines the architecture for a SWC-based implementation of the lively.next freezer bundler, replacing Babel transforms with custom Rust plugins for improved performance.

## Architecture Components

### 1. Rust Plugin Project (`lively-swc-plugin`)

**Location**: `lively.freezer/swc-plugin/`

**Structure**:
```
swc-plugin/
├── Cargo.toml
├── src/
│   ├── lib.rs                    # Plugin entry point
│   ├── transforms/
│   │   ├── mod.rs                # Transform module exports
│   │   ├── scope_capturing.rs    # Scope capturing transform
│   │   ├── class_transform.rs    # Class instrumentation
│   │   ├── component.rs          # Component descriptor wrapping
│   │   ├── namespace.rs          # Export/import namespace transform
│   │   ├── dynamic_import.rs     # Dynamic import rewriting
│   │   ├── systemjs.rs           # SystemJS register rewriting
│   │   └── export_split.rs       # Export variable declaration splitting
│   ├── utils/
│   │   ├── mod.rs
│   │   ├── ast_helpers.rs        # Common AST manipulation utilities
│   │   └── scope_analyzer.rs     # Scope analysis for variable tracking
│   └── config.rs                 # Plugin configuration types
```

**Key Dependencies**:
- `swc_core` (latest) - Core SWC functionality
- `swc_ecma_ast` - ECMAScript AST types
- `swc_ecma_visit` - AST visitor pattern
- `swc_ecma_utils` - AST utilities
- `serde` - Serialization for config

### 2. Node.js Integration Layer (`bundler-swc.js`)

**Location**: `lively.freezer/src/bundler-swc.js`

**Purpose**: Bridge between Node.js Rollup plugin and Rust SWC plugins

**Key Features**:
- Uses `@swc/core` for transform orchestration
- Configures and invokes Rust plugins
- Maintains backward compatibility with existing `LivelyRollup` API
- Handles sourcemap generation

### 3. Rollup Plugin (`plugins/rollup-swc.js`)

**Location**: `lively.freezer/src/plugins/rollup-swc.js`

**Purpose**: Rollup integration using SWC transforms instead of Babel

## Transform Implementation Details

### Transform 1: Scope Capturing (`scope_capturing.rs`)

**Purpose**: Rewrites top-level variables to be accessible via `__varRecorder__`

**Implementation Strategy**:
```rust
// Input AST
var x = 3;
x + 5;

// Output AST
__varRecorder__.x = 3;
__varRecorder__.x + 5;
```

**Key Operations**:
1. Identify top-level variable declarations (excluding function params, catch clauses)
2. Rewrite declarations: `var x = value` → `__varRecorder__.x = value`
3. Rewrite references: `x` → `__varRecorder__.x`
4. Handle destructuring patterns recursively
5. Apply `declarationWrapper` for resurrection builds
6. Exclude known globals and specified exclusions

**AST Visitor**:
- `visit_mut_var_decl()` - Transform variable declarations
- `visit_mut_ident()` - Transform references
- `visit_mut_fn_decl()` - Hoist and wrap function declarations
- `visit_mut_module_item()` - Handle exports

### Transform 2: Class Instrumentation (`class_transform.rs`)

**Purpose**: Transform ES6 classes for lively.next's property system

**Implementation Strategy**:
```rust
// Input
class MyClass extends Base {
  field = 1;
  method() { return super.method(); }
}

// Output
const MyClass = initializeES6ClassForLively(
  "MyClass",
  function() { /* constructor */ },
  Base,
  [ /* method descriptors */ ],
  { /* class metadata */ }
);
```

**Key Operations**:
1. Convert class declaration to function call
2. Generate constructor with lively hooks
3. Transform super calls to `_get()` helper pattern
4. Convert class fields to constructor assignments
5. Inject module metadata (path, package, version)

### Transform 3: Component Descriptor (`component.rs`)

**Purpose**: Wrap component definitions with metadata

**Implementation Strategy**:
```rust
// Input
const MyComp = component(...)

// Output
const MyComp = component.for(
  () => component(...),
  { module: "...", export: "MyComp", range: {...} },
  System,
  __varRecorder__,
  "MyComp"
)
```

**Key Operations**:
1. Detect `component()` call expressions assigned to variables
2. Wrap with `component.for()` call
3. Inject metadata: module path, export name, source range

### Transform 4: Namespace Transform (`namespace.rs`)

**Purpose**: Channel namespace imports through module recorder for resurrection builds

**Implementation Strategy**:
```rust
// Input
import * as foo from 'bar'

// Output
import * as foo_namespace from 'bar'
const foo = (lively.FreezerRuntime || lively.frozenModules).exportsOf("bar") || foo_namespace
```

**Key Operations**:
1. Rename namespace import to `{name}_namespace`
2. Add const declaration with fallback logic
3. Handle re-exports with Object.assign pattern

### Transform 5: Dynamic Import (`dynamic_import.rs`)

**Purpose**: Convert `System.import()` to native `import()`

**Implementation Strategy**:
```rust
// Input
System.import("./module.js")

// Output
import("./module.js")
```

**Key Operations**:
1. Detect `System.import()` call expressions
2. Replace with native `import()` expression
3. Preserve dynamic string expressions

### Transform 6: SystemJS Register Rewriting (`systemjs.rs`)

**Purpose**: Capture imported values in module setters

**Implementation Strategy**:
- Detect `System.register()` calls
- Rewrite setter function bodies to capture imports
- Maintain SystemJS module format compatibility

### Transform 7: Export Declaration Splitting (`export_split.rs`)

**Purpose**: Separate export statements from variable declarations

**Implementation Strategy**:
```rust
// Input
export var x = 1, y = 2;

// Output
var x = 1;
var y = 2;
export { x, y };
```

## Configuration

**Transform Options** (passed from Node.js):
```typescript
interface LivelyTransformConfig {
  captureObj: string;              // Default: "__varRecorder__"
  declarationWrapper?: string;     // For resurrection builds
  classToFunction?: {
    classHolder: string;
    functionNode: string;
    currentModuleAccessor: string;
  };
  exclude: string[];               // Globals to exclude
  captureImports: boolean;         // Whether to capture imports
  resurrection: boolean;           // Enable resurrection mode
  moduleId: string;                // Current module path
  packageName?: string;            // Package name for metadata
}
```

## Build Process

### Rust Plugin Build
```bash
cd swc-plugin
cargo build --release --target wasm32-wasi  # For Wasm plugin
# or
cargo build --release  # For native plugin
```

### Node.js Integration
```javascript
import { transformSync } from '@swc/core';

const result = transformSync(code, {
  plugin: (m) => [
    ['lively-swc-plugin', {
      captureObj: '__varRecorder__',
      exclude: ['console', 'window', ...],
      // ... other config
    }]
  ],
  jsc: {
    parser: {
      syntax: 'ecmascript',
      jsx: true,
      dynamicImport: true,
      // ...
    },
    target: 'es2015',
  },
  sourceMaps: true,
});
```

## Performance Expectations

**Expected Improvements**:
- **5-10x faster** transform phase compared to Babel
- **Lower memory usage** due to Rust's efficiency
- **Parallel processing** of multiple modules via SWC's architecture
- **Better caching** with SWC's built-in mechanisms

## Compatibility & Migration

### Backward Compatibility
- Maintain existing `LivelyRollup` API
- Support same configuration options
- Preserve sourcemap quality
- Keep output format identical

### Migration Path
1. Implement SWC bundler alongside existing Babel bundler
2. Add `--use-swc` flag to enable SWC mode
3. Test extensively with existing projects
4. Gradually deprecate Babel bundler
5. Make SWC the default

### Testing Strategy
- Unit tests for each Rust transform
- Integration tests with Rollup
- Comparison tests: SWC output vs Babel output
- Performance benchmarks
- Real-world project testing (lively.next core, user projects)

## Implementation Phases

### Phase 1: Project Setup ✓
- [x] Analyze existing bundler
- [x] Design architecture
- [ ] Set up Rust project structure
- [ ] Configure build tooling

### Phase 2: Core Transforms
- [ ] Implement scope capturing transform
- [ ] Implement class instrumentation transform
- [ ] Implement component descriptor transform
- [ ] Unit tests for core transforms

### Phase 3: Module Transforms
- [ ] Implement namespace transform
- [ ] Implement dynamic import transform
- [ ] Implement SystemJS register rewriting
- [ ] Implement export splitting
- [ ] Unit tests for module transforms

### Phase 4: Integration
- [ ] Create Node.js wrapper
- [ ] Implement Rollup plugin
- [ ] Add sourcemap support
- [ ] Integration tests

### Phase 5: Testing & Optimization
- [ ] Comparison tests with Babel output
- [ ] Performance benchmarks
- [ ] Real-world testing
- [ ] Documentation

### Phase 6: Deployment
- [ ] CLI flag integration
- [ ] Migration guide
- [ ] Release preparation

## Future Enhancements

- **Incremental Compilation**: Cache transformed modules
- **Watch Mode Optimization**: Fast rebuilds on file changes
- **Custom Sourcemap Format**: Optimized for lively.next debugging
- **WASI Plugin Distribution**: Easier cross-platform deployment
- **Parallel Bundling**: Transform multiple entry points concurrently
