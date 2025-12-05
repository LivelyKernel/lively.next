# SWC API v47 Compilation Fixes Needed

## Summary
The code was written for an older SWC API. Version 47 has breaking changes. Here are all the fixes needed:

## 1. Missing Imports
Add to files that use these types:
```rust
use swc_core::common::{Spanned, SyntaxContext, DUMMY_SP};
```

**Files needing this:**
- `src/utils/ast_helpers.rs`
- `src/transforms/scope_capturing.rs`
- `src/transforms/class_transform.rs`
- `src/transforms/component.rs`
- `src/transforms/namespace.rs`
- `src/transforms/export_split.rs`
- `src/transforms/dynamic_import.rs`

## 2. PatOrExpr → AssignTarget
**Find and replace** `PatOrExpr` with `AssignTarget` everywhere.

**Files affected:**
- `src/utils/ast_helpers.rs` (line 219)
- `src/transforms/scope_capturing.rs` (lines 120, 136, 168, 208, 403, 426)
- `src/transforms/class_transform.rs` (line 246)

## 3. Ident::new() Now Requires 3 Arguments
**Old:** `Ident::new(sym, span)`
**New:** `Ident::new(sym, span, SyntaxContext::empty())`

**Files affected:**
- `src/transforms/scope_capturing.rs` (line 326)
- `src/transforms/export_split.rs` (line 48)

## 4. Add `ctxt` Field to Structs
Many AST structs now require a `ctxt: SyntaxContext` field.

### In ast_helpers.rs:
```rust
// CallExpr needs ctxt
CallExpr {
    span: Default::default(),
    ctxt: SyntaxContext::empty(),  // ADD THIS
    callee: ...,
    args: ...,
    type_args: None,
}

// ArrowExpr needs ctxt
ArrowExpr {
    span: Default::default(),
    ctxt: SyntaxContext::empty(),  // ADD THIS
    params: ...,
    body: ...,
    ...
}

// VarDecl needs ctxt
VarDecl {
    span: Default::default(),
    ctxt: SyntaxContext::empty(),  // ADD THIS
    kind: ...,
    declare: false,
    decls: ...,
}

// Ident needs ctxt
Ident {
    span: ident.span,
    ctxt: ident.ctxt,  // ADD THIS
    sym: ident.sym.clone(),
    optional: ident.optional,
}

// Function needs ctxt
Function {
    params: vec![],
    decorators: vec![],
    span: Default::default(),
    ctxt: SyntaxContext::empty(),  // ADD THIS
    body: Some(body),
    ...
}
```

### In class_transform.rs:
- `Function` at lines 112, 240
- `BlockStmt` at lines 145, 182
- `CallExpr` at line 163

### In dynamic_import.rs:
- `CallExpr` at line 33

### In export_split.rs:
- `VarDecl` at line 34

## 5. quote_ident!() Returns IdentName
**Old:** `quote_ident!(name)` returns `Ident`
**New:** `quote_ident!(name)` returns `IdentName`, needs `.into()`

**Files affected:**
- `src/utils/ast_helpers.rs` (lines 29, 182, 200)
- `src/transforms/namespace.rs` (line 107)

**Fix:** Either use `.into()` or replace with `Ident::new(name.into(), DUMMY_SP, SyntaxContext::empty())`

## 6. Wtf8Atom Doesn't Implement Display
**Old:** `value.to_string()`
**New:** `value.as_str().to_string()` or just `value.as_str()`

**Files affected:**
- `src/transforms/scope_capturing.rs` (line 178)
- `src/transforms/namespace.rs` (line 113)

## 7. Spanned Trait Not In Scope
**Error:** `no method named 'span' found`
**Fix:** Add `use swc_core::common::Spanned;`

**Files affected:**
- `src/transforms/component.rs` (line 95)

## 8. Remove Unused Import
**File:** `src/transforms/scope_capturing.rs`
```rust
use std::collections::{HashSet, HashMap}; // Remove HashMap
use std::collections::HashSet;  // Keep only this
```

**File:** `src/utils/ast_helpers.rs`
```rust
utils::{quote_ident, quote_str, ExprFactory}, // Remove ExprFactory
utils::{quote_ident, quote_str},  // Keep only these
```

---

## Quick Fix Script (If You Want to Apply All Fixes)

I can create a script or manually apply all these fixes. Would you like me to:

1. **Apply all fixes automatically** (~5 minutes, 30+ edits)
2. **Create a patch file** you can review and apply
3. **Provide step-by-step instructions** for you to fix manually
4. **Give up on Rust plugin** and use JavaScript-based SWC instead

Which would you prefer?
