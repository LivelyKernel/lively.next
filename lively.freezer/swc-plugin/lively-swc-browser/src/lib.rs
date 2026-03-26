use std::collections::HashSet;
use wasm_bindgen::prelude::*;
use swc_common::{sync::Lrc, FileName, SourceMap, Mark, GLOBALS, Globals, DUMMY_SP};
use swc_ecma_parser::{parse_file_as_module, Syntax, EsSyntax};
use swc_ecma_codegen::{text_writer::JsWriter, Emitter, Config as CodegenConfig};
use swc_ecma_ast::*;
use swc_ecma_visit::{VisitMut, VisitMutWith, Visit, VisitWith};
use swc_ecma_transforms_module::path::Resolver;

use lively_swc_transforms::config::LivelyTransformConfig;
use lively_swc_transforms::LivelyTransformVisitor;

/// Transform JavaScript source code using lively.next's SWC transforms,
/// then wrap in System.register() format for SystemJS module loading.
///
/// # Arguments
/// * `source` - The JavaScript source code to transform
/// * `config_json` - JSON string matching `LivelyTransformConfig`
///
/// # Returns
/// JSON string: `{ "code": "...", "map": "..." }`
#[wasm_bindgen]
pub fn transform(source: &str, config_json: &str) -> Result<String, JsError> {
    let config: LivelyTransformConfig = serde_json::from_str(config_json)
        .map_err(|e| JsError::new(&format!("Invalid config: {}", e)))?;

    // SWC's SystemJS transform requires the GLOBALS thread-local
    GLOBALS.set(&Globals::default(), || transform_inner(source, config))
}

fn transform_inner(source: &str, config: LivelyTransformConfig) -> Result<String, JsError> {
    let cm = Lrc::new(SourceMap::default());
    let fm = cm.new_source_file(
        FileName::Custom(config.module_id.clone()).into(),
        source.to_string(),
    );

    let unresolved_mark = Mark::new();

    let module = parse_file_as_module(
        &fm,
        Syntax::Es(EsSyntax {
            jsx: false,
            decorators: true,
            ..Default::default()
        }),
        Default::default(),
        None,
        &mut vec![],
    )
    .map_err(|e| JsError::new(&format!("Parse error: {:?}", e)))?;

    let mut program = swc_ecma_ast::Program::Module(module);

    // Phase 1: Run lively transforms (scope capture, class-to-function, etc.)
    let capture_obj = config.capture_obj.clone();
    let module_id = config.module_id.clone();
    let declaration_wrapper = config.declaration_wrapper.clone();
    let excluded: Vec<String> = config.exclude.iter().cloned().collect();
    let has_scope_capture = config.enable_scope_capture;
    let mut visitor = LivelyTransformVisitor::new(config);
    program.visit_mut_with(&mut visitor);

    // Phase 1 desugars `export { Y as a }` → `var __export_a__ = Y; export { __export_a__ as a }`.
    // system_js hoists `__export_a__` (no collision) and keeps `a` as export name.
    // No stripping/restoration needed — the alias stays for correct import resolution.
    let export_aliases = std::collections::HashMap::<String, String>::new();

    // Phase 2: Wrap in System.register() for SystemJS module loading
    let mut systemjs_pass = swc_ecma_transforms_module::system_js(
        Resolver::Default,
        unresolved_mark,
        swc_ecma_transforms_module::system_js::Config {
            allow_top_level_this: true,
            ..Default::default()
        },
    );
    systemjs_pass.process(&mut program);

    // Phase 3: Post-process the System.register output to match Babel's
    // livelyPostTranspile (babel/plugin.js lines 1216-1327):
    //
    // (a) Remove "use strict" from factory (Babel removes it, line 1263)
    // (b) Move __lvVarRecorder init from execute() to the factory body
    // (c) Rewrite setters to capture imports to __lvVarRecorder (with defVar
    //     wrapper and normalizeImportedNamespace)
    // (d) Insert early _export({name: void 0, ...}) in the factory
    // (e) Add evaluationStart/evaluationEnd hooks to execute() (line 1127/1130)
    remove_directives(&mut program);
    fix_async_execute(&mut program);
    fix_destructured_assignments(&mut program);
    fix_default_keyword_exports(&mut program);
    fix_shadowed_export_calls(&mut program);
    fix_nested_fn_export_calls(&mut program);
    if !export_aliases.is_empty() {
        restore_export_aliases(&mut program, &export_aliases);
    }
    if has_scope_capture {
        hoist_recorder_init(&mut program, &capture_obj);
        rewrite_setters(&mut program, &capture_obj, declaration_wrapper.as_deref(), &excluded);
        insert_evaluation_hooks(&mut program, &module_id);
    }
    // Note: we intentionally do NOT insert early _export({name: void 0}) calls
    // in the factory body. Babel's SystemJS transform doesn't do this either.
    // Early exports cause problems with circular deps (e.g. cycle-breaker.js
    // classHolder becomes void 0). SystemJS handles circular deps by returning
    // whatever exports have been set so far when a circular import is detected.

    let module = match &program {
        swc_ecma_ast::Program::Module(m) => m,
        swc_ecma_ast::Program::Script(s) => {
            // SystemJS transform may convert Module to Script
            // Emit as script in that case
            let mut src_buf = vec![];
            let mut src_map_buf = vec![];
            {
                let mut emitter = Emitter {
                    cfg: CodegenConfig::default().with_ascii_only(false),
                    cm: cm.clone(),
                    comments: None,
                    wr: JsWriter::new(cm.clone(), "\n", &mut src_buf, Some(&mut src_map_buf)),
                };
                emitter.emit_script(s)
                    .map_err(|e| JsError::new(&format!("Codegen error: {:?}", e)))?;
            }
            return finish_output(cm, src_buf, src_map_buf);
        }
    };

    // Generate code + source map
    let mut src_buf = vec![];
    let mut src_map_buf = vec![];
    {
        let mut emitter = Emitter {
            cfg: CodegenConfig::default().with_ascii_only(false),
            cm: cm.clone(),
            comments: None,
            wr: JsWriter::new(cm.clone(), "\n", &mut src_buf, Some(&mut src_map_buf)),
        };
        emitter.emit_module(module)
            .map_err(|e| JsError::new(&format!("Codegen error: {:?}", e)))?;
    }

    finish_output(cm, src_buf, src_map_buf)
}

/// Extract statements from either Script or Module program.
fn get_stmts_mut(program: &mut Program) -> Vec<&mut Stmt> {
    match program {
        Program::Script(s) => s.body.iter_mut().collect(),
        Program::Module(m) => m.body.iter_mut().filter_map(|item| {
            if let ModuleItem::Stmt(s) = item { Some(s) } else { None }
        }).collect(),
    }
}

/// Rename local variables in nested functions that shadow exported module-level
/// bindings.  SWC's system_js incorrectly wraps shadowed locals with _export(),
/// corrupting expressions like `o--` → `_export("bisectLeft", +o + 1)`.
///
/// Strategy: collect all exported binding names, then visit nested scopes.
/// When a local declaration shadows an export name, rename the local and all
/// its references within that scope.
/// Strip export aliases: `export { Y as a }` → `export { Y }`.
/// Returns mapping: original_name → alias (e.g. "Y" → "a").
/// system_js will hoist the original name (Y) instead of the alias (a),
/// avoiding collisions with single-letter locals in minified code.
fn strip_export_aliases(program: &mut Program) -> std::collections::HashMap<String, String> {
    use std::collections::HashMap;
    let mut aliases: HashMap<String, String> = HashMap::new();

    let module = match program {
        Program::Module(m) => m,
        _ => return aliases,
    };

    for item in &mut module.body {
        if let ModuleItem::ModuleDecl(ModuleDecl::ExportNamed(named)) = item {
            if named.src.is_some() { continue; } // re-exports keep aliases
            for spec in &mut named.specifiers {
                if let ExportSpecifier::Named(n) = spec {
                    if let Some(exported) = &n.exported {
                        let orig = match &n.orig {
                            ModuleExportName::Ident(id) => id.sym.to_string(),
                            ModuleExportName::Str(s) => s.value.to_string(),
                        };
                        let alias = match exported {
                            ModuleExportName::Ident(id) => id.sym.to_string(),
                            ModuleExportName::Str(s) => s.value.to_string(),
                        };
                        if orig != alias {
                            aliases.insert(orig.clone(), alias);
                            // Remove the alias: `export { Y as a }` → `export { Y }`
                            n.exported = None;
                        }
                    }
                }
            }
        }
    }
    aliases
}

/// Restore export aliases in _export() calls after system_js.
/// system_js generates `_export("Y", ...)` (using the original name).
/// We rewrite to `_export("a", ...)` (using the alias).
fn restore_export_aliases(program: &mut Program, aliases: &std::collections::HashMap<String, String>) {
    struct AliasRestorer<'a> {
        aliases: &'a std::collections::HashMap<String, String>,
    }
    impl VisitMut for AliasRestorer<'_> {
        fn visit_mut_call_expr(&mut self, call: &mut CallExpr) {
            if let Callee::Expr(callee) = &call.callee {
                if let Expr::Ident(id) = &**callee {
                    if id.sym.as_ref() == "_export" && !call.args.is_empty() {
                        // Check first arg: string literal with original name
                        if let Expr::Lit(Lit::Str(s)) = &*call.args[0].expr {
                            if let Some(alias) = self.aliases.get(s.value.as_ref()) {
                                call.args[0].expr = Box::new(Expr::Lit(Lit::Str(Str {
                                    span: DUMMY_SP,
                                    value: alias.as_str().into(),
                                    raw: None,
                                })));
                            }
                        }
                        // Also handle bulk _export({Y: ..., he: ...}) → _export({a: ..., b: ...})
                        if call.args.len() == 1 {
                            if let Expr::Object(obj) = &mut *call.args[0].expr {
                                for prop in &mut obj.props {
                                    if let PropOrSpread::Prop(p) = prop {
                                        if let Prop::KeyValue(kv) = &mut **p {
                                            let key_name = match &kv.key {
                                                PropName::Ident(id) => Some(id.sym.to_string()),
                                                PropName::Str(s) => Some(s.value.to_string()),
                                                _ => None,
                                            };
                                            if let Some(name) = key_name {
                                                if let Some(alias) = self.aliases.get(&name) {
                                                    kv.key = PropName::Str(Str {
                                                        span: DUMMY_SP,
                                                        value: alias.as_str().into(),
                                                        raw: None,
                                                    });
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            call.visit_mut_children_with(self);
        }
    }
    program.visit_mut_with(&mut AliasRestorer { aliases });
}

fn rename_shadowed_exports(program: &mut Program) {
    use std::collections::HashSet;

    // Step 1: Collect module-level exported binding names
    let module = match program {
        Program::Module(m) => m,
        _ => return,
    };

    let mut exported_names: HashSet<String> = HashSet::new();

    // Collect names from `export { name }`, `export const name`, `export function name`, etc.
    for item in &module.body {
        match item {
            ModuleItem::ModuleDecl(ModuleDecl::ExportNamed(named)) if named.src.is_none() => {
                for spec in &named.specifiers {
                    if let ExportSpecifier::Named(n) = spec {
                        let name = match &n.orig {
                            ModuleExportName::Ident(id) => id.sym.to_string(),
                            ModuleExportName::Str(s) => s.value.to_string(),
                        };
                        exported_names.insert(name);
                    }
                }
            }
            ModuleItem::ModuleDecl(ModuleDecl::ExportDecl(decl)) => {
                match &decl.decl {
                    Decl::Var(var) => {
                        for d in &var.decls {
                            if let Pat::Ident(id) = &d.name {
                                exported_names.insert(id.sym.to_string());
                            }
                        }
                    }
                    Decl::Fn(f) => { exported_names.insert(f.ident.sym.to_string()); }
                    Decl::Class(c) => { exported_names.insert(c.ident.sym.to_string()); }
                    _ => {}
                }
            }
            ModuleItem::ModuleDecl(ModuleDecl::ExportDefaultDecl(_)) => {
                exported_names.insert("default".to_string());
            }
            _ => {}
        }
    }

    if exported_names.is_empty() { return; }

    // Step 2: Collect (sym, ctxt) pairs for all shadowed local declarations
    //         in nested scopes, then rename all matching identifiers.
    use std::collections::HashMap;
    use swc_common::SyntaxContext;

    struct ShadowCollector {
        exported: HashSet<String>,
        depth: u32,
        renames: HashMap<(String, SyntaxContext), String>,
        counter: u32,
    }

    impl ShadowCollector {
        fn check_binding(&mut self, id: &Ident) {
            if self.depth == 0 { return; }
            let name = id.sym.to_string();
            if self.exported.contains(&name) {
                let key = (name.clone(), id.ctxt);
                if !self.renames.contains_key(&key) {
                    self.renames.insert(key, format!("__shadow_{}_{}", name, self.counter));
                    self.counter += 1;
                }
            }
        }
        fn check_pat(&mut self, pat: &Pat) {
            match pat {
                Pat::Ident(id) => self.check_binding(&id.id),
                Pat::Object(obj) => {
                    for prop in &obj.props {
                        match prop {
                            ObjectPatProp::Assign(a) => {
                                // `{ x }` shorthand — x is both key and binding
                                let id = Ident::new(a.key.sym.clone(), a.key.span, a.key.ctxt);
                                self.check_binding(&id);
                            }
                            ObjectPatProp::KeyValue(kv) => self.check_pat(&kv.value),
                            ObjectPatProp::Rest(r) => self.check_pat(&r.arg),
                        }
                    }
                }
                Pat::Array(arr) => {
                    for elem in arr.elems.iter().flatten() { self.check_pat(elem); }
                }
                Pat::Rest(r) => self.check_pat(&r.arg),
                Pat::Assign(a) => self.check_pat(&a.left),
                _ => {}
            }
        }
    }

    impl Visit for ShadowCollector {
        fn visit_function(&mut self, f: &Function) {
            self.depth += 1;
            for p in &f.params { self.check_pat(&p.pat); }
            f.visit_children_with(self);
            self.depth -= 1;
        }
        fn visit_arrow_expr(&mut self, f: &ArrowExpr) {
            self.depth += 1;
            for p in &f.params { self.check_pat(p); }
            f.visit_children_with(self);
            self.depth -= 1;
        }
        fn visit_var_decl(&mut self, decl: &VarDecl) {
            if self.depth > 0 {
                for d in &decl.decls { self.check_pat(&d.name); }
            }
            decl.visit_children_with(self);
        }
        fn visit_catch_clause(&mut self, c: &CatchClause) {
            self.depth += 1;
            if let Some(p) = &c.param { self.check_pat(p); }
            c.visit_children_with(self);
            self.depth -= 1;
        }
        fn visit_for_in_stmt(&mut self, f: &ForInStmt) {
            if self.depth > 0 {
                if let ForHead::VarDecl(d) = &f.left {
                    for dd in &d.decls { self.check_pat(&dd.name); }
                }
                if let ForHead::Pat(p) = &f.left { self.check_pat(p); }
            }
            f.visit_children_with(self);
        }
        fn visit_for_of_stmt(&mut self, f: &ForOfStmt) {
            if self.depth > 0 {
                if let ForHead::VarDecl(d) = &f.left {
                    for dd in &d.decls { self.check_pat(&dd.name); }
                }
                if let ForHead::Pat(p) = &f.left { self.check_pat(p); }
            }
            f.visit_children_with(self);
        }
    }

    let mut collector = ShadowCollector {
        exported: exported_names,
        depth: 0,
        renames: HashMap::new(),
        counter: 0,
    };
    module.visit_with(&mut collector);

    if collector.renames.is_empty() { return; }

    // Step 3: For each function that declares a local shadow, rename all
    // identifiers matching the shadowed name WITHIN that function body only.
    // This is precise: a function that uses `c` (module-level export) but
    // doesn't declare its own `c` won't have `c` renamed.
    let names_to_rename: HashSet<String> = collector.renames.keys()
        .map(|(name, _)| name.clone())
        .collect();

    struct FunctionShadowRenamer {
        exported_names: HashSet<String>,
    }

    impl FunctionShadowRenamer {
        /// Check if this function body declares any of the exported names.
        /// Returns the set of names that are locally declared.
        fn find_local_shadows_in_params_and_body(
            &self, params: &[Pat], body: &Option<BlockStmt>
        ) -> HashSet<String> {
            let mut shadows = HashSet::new();
            for p in params {
                self.collect_pat_names(p, &mut shadows);
            }
            if let Some(body) = body {
                for stmt in &body.stmts {
                    self.collect_decl_names(stmt, &mut shadows);
                }
            }
            shadows.retain(|n| self.exported_names.contains(n));
            shadows
        }

        fn collect_pat_names(&self, pat: &Pat, names: &mut HashSet<String>) {
            match pat {
                Pat::Ident(id) => { names.insert(id.sym.to_string()); }
                Pat::Object(obj) => {
                    for prop in &obj.props {
                        match prop {
                            ObjectPatProp::Assign(a) => { names.insert(a.key.sym.to_string()); }
                            ObjectPatProp::KeyValue(kv) => self.collect_pat_names(&kv.value, names),
                            ObjectPatProp::Rest(r) => self.collect_pat_names(&r.arg, names),
                        }
                    }
                }
                Pat::Array(arr) => { for e in arr.elems.iter().flatten() { self.collect_pat_names(e, names); } }
                Pat::Rest(r) => self.collect_pat_names(&r.arg, names),
                Pat::Assign(a) => self.collect_pat_names(&a.left, names),
                _ => {}
            }
        }

        fn collect_decl_names(&self, stmt: &Stmt, names: &mut HashSet<String>) {
            if let Stmt::Decl(Decl::Var(var)) = stmt {
                for d in &var.decls { self.collect_pat_names(&d.name, names); }
            }
            // Also check for-in/for-of
            if let Stmt::ForIn(f) = stmt {
                if let ForHead::VarDecl(d) = &f.left {
                    for dd in &d.decls { self.collect_pat_names(&dd.name, names); }
                }
            }
            if let Stmt::ForOf(f) = stmt {
                if let ForHead::VarDecl(d) = &f.left {
                    for dd in &d.decls { self.collect_pat_names(&dd.name, names); }
                }
            }
        }

        fn rename_idents_in_block(names: &HashSet<String>, block: &mut BlockStmt) {
            struct InnerRenamer<'a> { names: &'a HashSet<String> }
            impl InnerRenamer<'_> {
                /// Check if a function declares any of the names we're renaming.
                /// If so, that function has its own shadow and will be handled
                /// by FunctionShadowRenamer separately — we should NOT rename
                /// those names inside it.  If the function doesn't redeclare any
                /// of our names, we DO descend (it's a closure using the outer var).
                fn declares_any_shadow(&self, params: &[Pat], body: &Option<BlockStmt>) -> HashSet<String> {
                    let mut declared = HashSet::new();
                    for p in params {
                        Self::collect_pat_names(p, &mut declared);
                    }
                    if let Some(body) = body {
                        for stmt in &body.stmts {
                            if let Stmt::Decl(Decl::Var(var)) = stmt {
                                for d in &var.decls { Self::collect_pat_names(&d.name, &mut declared); }
                            }
                        }
                    }
                    declared.retain(|n| self.names.contains(n));
                    declared
                }
                fn collect_pat_names(pat: &Pat, names: &mut HashSet<String>) {
                    match pat {
                        Pat::Ident(id) => { names.insert(id.sym.to_string()); }
                        Pat::Object(obj) => { for p in &obj.props { match p {
                            ObjectPatProp::Assign(a) => { names.insert(a.key.sym.to_string()); }
                            ObjectPatProp::KeyValue(kv) => Self::collect_pat_names(&kv.value, names),
                            ObjectPatProp::Rest(r) => Self::collect_pat_names(&r.arg, names),
                        }}}
                        Pat::Array(arr) => { for e in arr.elems.iter().flatten() { Self::collect_pat_names(e, names); } }
                        Pat::Rest(r) => Self::collect_pat_names(&r.arg, names),
                        Pat::Assign(a) => Self::collect_pat_names(&a.left, names),
                        _ => {}
                    }
                }
            }
            impl VisitMut for InnerRenamer<'_> {
                fn visit_mut_ident(&mut self, id: &mut Ident) {
                    if self.names.contains(id.sym.as_ref()) {
                        id.sym = format!("__shadow_{}", id.sym).into();
                    }
                }
                fn visit_mut_binding_ident(&mut self, id: &mut BindingIdent) {
                    if self.names.contains(id.id.sym.as_ref()) {
                        id.id.sym = format!("__shadow_{}", id.id.sym).into();
                    }
                }
                fn visit_mut_function(&mut self, f: &mut Function) {
                    let param_pats: Vec<Pat> = f.params.iter().map(|p| p.pat.clone()).collect();
                    let redeclared = self.declares_any_shadow(&param_pats, &f.body);
                    if redeclared.is_empty() {
                        // No redeclaration — descend normally (closure uses outer var)
                        f.visit_mut_children_with(self);
                    } else {
                        // This function redeclares some names — create a reduced
                        // renamer that excludes the redeclared names
                        let remaining: HashSet<String> = self.names.iter()
                            .filter(|n| !redeclared.contains(*n))
                            .cloned().collect();
                        if !remaining.is_empty() {
                            f.visit_mut_children_with(&mut InnerRenamer { names: &remaining });
                        }
                        // Don't rename the redeclared names here — they'll be
                        // handled by FunctionShadowRenamer on a separate pass
                    }
                }
                fn visit_mut_arrow_expr(&mut self, f: &mut ArrowExpr) {
                    // Arrows always descend (they can't redeclare with var hoisting)
                    f.visit_mut_children_with(self);
                }
            }
            block.visit_mut_with(&mut InnerRenamer { names });
        }
    }

    impl VisitMut for FunctionShadowRenamer {
        fn visit_mut_function(&mut self, f: &mut Function) {
            // First recurse into nested functions
            f.visit_mut_children_with(self);

            // Then check if THIS function shadows any exports
            let param_pats: Vec<Pat> = f.params.iter().map(|p| p.pat.clone()).collect();
            let shadows = self.find_local_shadows_in_params_and_body(
                &param_pats, &f.body
            );
            if !shadows.is_empty() {
                // Rename params
                for p in &mut f.params {
                    struct PR<'a> { names: &'a HashSet<String> }
                    impl VisitMut for PR<'_> {
                        fn visit_mut_ident(&mut self, id: &mut Ident) {
                            if self.names.contains(id.sym.as_ref()) {
                                id.sym = format!("__shadow_{}", id.sym).into();
                            }
                        }
                        fn visit_mut_binding_ident(&mut self, id: &mut BindingIdent) {
                            if self.names.contains(id.id.sym.as_ref()) {
                                id.id.sym = format!("__shadow_{}", id.id.sym).into();
                            }
                        }
                    }
                    p.pat.visit_mut_with(&mut PR { names: &shadows });
                }
                // Rename in body (but NOT in nested functions)
                if let Some(body) = &mut f.body {
                    Self::rename_idents_in_block(&shadows, body);
                }
            }
        }

        fn visit_mut_arrow_expr(&mut self, f: &mut ArrowExpr) {
            f.visit_mut_children_with(self);
            let shadows = {
                let mut s = HashSet::new();
                for p in &f.params {
                    let fsr = FunctionShadowRenamer { exported_names: self.exported_names.clone() };
                    fsr.collect_pat_names(p, &mut s);
                }
                // Check body for var decls
                if let BlockStmtOrExpr::BlockStmt(body) = &*f.body {
                    let fsr = FunctionShadowRenamer { exported_names: self.exported_names.clone() };
                    for stmt in &body.stmts { fsr.collect_decl_names(stmt, &mut s); }
                }
                s.retain(|n| self.exported_names.contains(n));
                s
            };
            if !shadows.is_empty() {
                for p in &mut f.params {
                    struct PR<'a> { names: &'a HashSet<String> }
                    impl VisitMut for PR<'_> {
                        fn visit_mut_ident(&mut self, id: &mut Ident) {
                            if self.names.contains(id.sym.as_ref()) { id.sym = format!("__shadow_{}", id.sym).into(); }
                        }
                        fn visit_mut_binding_ident(&mut self, id: &mut BindingIdent) {
                            if self.names.contains(id.id.sym.as_ref()) { id.id.sym = format!("__shadow_{}", id.id.sym).into(); }
                        }
                    }
                    p.visit_mut_with(&mut PR { names: &shadows });
                }
                if let BlockStmtOrExpr::BlockStmt(body) = &mut *f.body {
                    Self::rename_idents_in_block(&shadows, body);
                }
            }
        }
    }

    program.visit_mut_with(&mut FunctionShadowRenamer { exported_names: names_to_rename });
}

/// Remove "use strict" and "format esm" directives.
/// Babel's livelyPostTranspile removes "use strict" (line 1263) and
/// "format esm" (line 1264 of babel/plugin.js).
fn remove_directives(program: &mut Program) {
    fn is_removable_directive(s: &Stmt) -> bool {
        if let Stmt::Expr(ExprStmt { expr, .. }) = s {
            if let Expr::Lit(Lit::Str(str_lit)) = &**expr {
                let v = str_lit.value.as_ref();
                return v == "use strict" || v == "format esm";
            }
        }
        false
    }

    // Remove from entire program (catches directives in factory body AND execute body)
    struct DirectiveRemover;
    impl VisitMut for DirectiveRemover {
        fn visit_mut_block_stmt(&mut self, block: &mut BlockStmt) {
            block.stmts.retain(|s| !is_removable_directive(s));
            block.visit_mut_children_with(self);
        }
    }
    program.visit_mut_with(&mut DirectiveRemover);

    // Also remove from factory body top level (outside blocks)
    for stmt in get_stmts_mut(program) {
        let call = match stmt {
            Stmt::Expr(ExprStmt { expr, .. }) => match &mut **expr {
                Expr::Call(c) => c,
                _ => continue,
            },
            _ => continue,
        };
        if call.args.len() < 2 { continue; }
        let factory = match &mut *call.args[1].expr {
            Expr::Fn(f) => f,
            _ => continue,
        };
        let body = match &mut factory.function.body {
            Some(b) => b,
            None => continue,
        };
        body.stmts.retain(|s| {
            if let Stmt::Expr(ExprStmt { expr, .. }) = s {
                if let Expr::Lit(Lit::Str(str_lit)) = &**expr {
                    let v = str_lit.value.as_ref();
                    if v == "use strict" || v == "format esm" {
                        return false;
                    }
                }
            }
            true
        });
        break;
    }
}

/// Fix destructured assignments in execute() that SWC's system_js emits
/// without parentheses: `{ a, b } = obj` → `({ a, b } = obj)`.
/// Without parens, `{` is parsed as a block statement → SyntaxError.
///
/// Walks into the execute function body and wraps any AssignExpr whose LHS
/// is an ObjectPat in a ParenExpr.
/// Remove `async` from the execute function.
/// SWC's system_js incorrectly sets execute to `async function()` when the
/// module body contains `await` inside async methods (not top-level await).
/// Babel's SystemJS transform correctly keeps execute synchronous.
/// An async execute delays _export() calls, breaking circular dep resolution.
fn fix_async_execute(program: &mut Program) {
    struct AsyncFixer;
    impl VisitMut for AsyncFixer {
        fn visit_mut_prop(&mut self, prop: &mut Prop) {
            if let Prop::KeyValue(kv) = prop {
                if let PropName::Ident(id) = &kv.key {
                    if id.sym.as_ref() == "execute" {
                        if let Expr::Fn(f) = &mut *kv.value {
                            f.function.is_async = false;
                        }
                    }
                }
            }
            prop.visit_mut_children_with(self);
        }
    }
    program.visit_mut_with(&mut AsyncFixer);
}

fn fix_destructured_assignments(program: &mut Program) {
    fn is_obj_destructure(expr: &Expr) -> bool {
        matches!(expr,
            Expr::Assign(AssignExpr { left: AssignTarget::Pat(AssignTargetPat::Object(_)), .. })
        )
    }

    fn wrap_in_paren(target: &mut Box<Expr>) {
        let inner = std::mem::replace(&mut **target, Expr::Invalid(Invalid { span: DUMMY_SP }));
        **target = Expr::Paren(ParenExpr { span: DUMMY_SP, expr: Box::new(inner) });
    }

    struct Fixer;
    impl VisitMut for Fixer {
        fn visit_mut_seq_expr(&mut self, seq: &mut SeqExpr) {
            seq.visit_mut_children_with(self);
            for expr in &mut seq.exprs {
                if is_obj_destructure(expr) {
                    wrap_in_paren(expr);
                }
            }
        }
        fn visit_mut_expr_stmt(&mut self, stmt: &mut ExprStmt) {
            stmt.visit_mut_children_with(self);
            if is_obj_destructure(&stmt.expr) {
                wrap_in_paren(&mut stmt.expr);
            }
        }
    }
    program.visit_mut_with(&mut Fixer);
}

/// Fix `_export("localName", default)` → `_export("default", localName)`.
///
/// SWC's system_js emits `default` as a bare identifier for
/// `export { x as default }`, but `default` is a reserved keyword.
/// The correct SystemJS output should be `_export("default", x)`.
fn fix_default_keyword_exports(program: &mut Program) {
    struct DefaultExportFixer;
    impl VisitMut for DefaultExportFixer {
        fn visit_mut_call_expr(&mut self, call: &mut CallExpr) {
            // Match: _export("someName", default)
            if let Callee::Expr(callee) = &call.callee {
                if let Expr::Ident(id) = &**callee {
                    if id.sym.as_ref() == "_export" && call.args.len() == 2 {
                        // Check if second arg is an Ident named "default"
                        let is_default = matches!(&*call.args[1].expr, Expr::Ident(id) if id.sym.as_ref() == "default");
                        if is_default {
                            // Get the first arg string value (the local name)
                            if let Expr::Lit(Lit::Str(s)) = &*call.args[0].expr {
                                let local_name = s.value.to_string();
                                // Swap: _export("default", localName)
                                call.args[0].expr = Box::new(Expr::Lit(Lit::Str(Str {
                                    span: DUMMY_SP,
                                    value: "default".into(),
                                    raw: None,
                                })));
                                call.args[1].expr = Box::new(Expr::Ident(Ident::new(
                                    local_name.into(), DUMMY_SP, Default::default(),
                                )));
                            }
                        }
                    }
                }
            }
            call.visit_mut_children_with(self);
        }
    }
    program.visit_mut_with(&mut DefaultExportFixer);
}

/// Fix SWC system_js variable shadowing bug: when a local variable in a
/// nested function shadows an exported module-level variable, system_js
/// incorrectly wraps the local usage with `_export("name", value)`.
///
/// Valid `_export` calls only appear as:
///   1. Standalone: `_export("name", value);`
///   2. In a comma sequence: `x = _dep.x, _export("name", x);`
///   3. As RHS of assignment: `_export("name", x = value)`
///
/// Invalid (shadowing bug): `_export("name", value)` nested inside binary
/// ops, function args, object literals, etc. We replace these with just
/// the `value` argument, removing the spurious _export wrapper.
fn fix_shadowed_export_calls(program: &mut Program) {
    struct ShadowFixer {
        /// Track depth: 0 = inside SeqExpr/ExprStmt (valid), >0 = nested (invalid)
        nested_expr_depth: u32,
    }

    fn is_export_call(expr: &Expr) -> bool {
        if let Expr::Call(call) = expr {
            if let Callee::Expr(callee) = &call.callee {
                if let Expr::Ident(id) = &**callee {
                    return id.sym.as_ref() == "_export" && call.args.len() >= 2;
                }
            }
        }
        false
    }

    fn extract_export_value(expr: &mut Expr) -> Option<Box<Expr>> {
        if let Expr::Call(call) = expr {
            if call.args.len() >= 2 {
                return Some(call.args[1].expr.clone());
            }
        }
        None
    }

    impl VisitMut for ShadowFixer {
        // At the ExprStmt level, _export calls in SeqExpr are valid.
        // We DON'T increment depth for these.
        fn visit_mut_expr_stmt(&mut self, stmt: &mut ExprStmt) {
            // Don't increment depth for the statement's own expression
            // (it might be a SeqExpr containing valid _export calls)
            match &mut *stmt.expr {
                Expr::Seq(seq) => {
                    // Each element of a top-level SeqExpr is a valid position
                    for expr in &mut seq.exprs {
                        if !is_export_call(expr) {
                            self.nested_expr_depth += 1;
                            expr.visit_mut_with(self);
                            self.nested_expr_depth -= 1;
                        }
                    }
                }
                _ => {
                    if !is_export_call(&stmt.expr) {
                        stmt.expr.visit_mut_with(self);
                    }
                }
            }
        }

        fn visit_mut_expr(&mut self, expr: &mut Expr) {
            if self.nested_expr_depth > 0 && is_export_call(expr) {
                // Replace _export("name", value) with (value) — parens preserve
                // the grouping that the _export() call provided.
                if let Some(value) = extract_export_value(expr) {
                    *expr = Expr::Paren(ParenExpr {
                        span: DUMMY_SP,
                        expr: value,
                    });
                    return;
                }
            }

            // For non-statement expressions, increment depth before recursing
            self.nested_expr_depth += 1;
            expr.visit_mut_children_with(self);
            self.nested_expr_depth -= 1;
        }

        // Reset depth for function bodies — they're new scopes
        fn visit_mut_function(&mut self, f: &mut Function) {
            let saved = self.nested_expr_depth;
            self.nested_expr_depth = 0;
            f.visit_mut_children_with(self);
            self.nested_expr_depth = saved;
        }

        fn visit_mut_arrow_expr(&mut self, f: &mut ArrowExpr) {
            let saved = self.nested_expr_depth;
            self.nested_expr_depth = 0;
            f.visit_mut_children_with(self);
            self.nested_expr_depth = saved;
        }
    }

    program.visit_mut_with(&mut ShadowFixer { nested_expr_depth: 0 });
}

/// Remove spurious `_export()` calls inside nested functions where the exported
/// name is shadowed by a local `let`/`const` declaration.
///
/// SWC's system_js transform wraps ALL assignments to export-named variables
/// with `_export()`, even inside nested functions where a local `let`/`const`
/// shadows the exported binding. For example:
///
///   export function sum(array) {
///     let sum = 0;                    // local binding, shadows export
///     for (...) { sum += array[i]; }  // SWC wraps: _export("sum", sum += ...)
///   }
///
/// This fix detects `_export("X", expr)` inside functions where `X` is declared
/// as `let`/`const` in that function's scope, and unwraps to just `expr`.
fn fix_nested_fn_export_calls(program: &mut Program) {
    use swc_ecma_visit::Visit;

    struct LetConstCollector {
        names: HashSet<String>,
    }
    impl Visit for LetConstCollector {
        fn visit_var_decl(&mut self, decl: &VarDecl) {
            if matches!(decl.kind, VarDeclKind::Let | VarDeclKind::Const) {
                for d in &decl.decls {
                    collect_pat_names(&d.name, &mut self.names);
                }
            }
        }
        // Don't descend into nested functions
        fn visit_function(&mut self, _: &Function) {}
        fn visit_arrow_expr(&mut self, _: &ArrowExpr) {}
    }

    fn collect_pat_names(pat: &Pat, names: &mut HashSet<String>) {
        match pat {
            Pat::Ident(id) => { names.insert(id.id.sym.to_string()); }
            Pat::Array(arr) => {
                for elem in arr.elems.iter().flatten() {
                    collect_pat_names(elem, names);
                }
            }
            Pat::Object(obj) => {
                for prop in &obj.props {
                    match prop {
                        ObjectPatProp::Assign(a) => { names.insert(a.key.sym.to_string()); }
                        ObjectPatProp::KeyValue(kv) => collect_pat_names(&kv.value, names),
                        ObjectPatProp::Rest(r) => collect_pat_names(&r.arg, names),
                    }
                }
            }
            Pat::Rest(r) => collect_pat_names(&r.arg, names),
            Pat::Assign(a) => collect_pat_names(&a.left, names),
            _ => {}
        }
    }

    fn is_export_call_with_name<'a>(expr: &'a Expr) -> Option<&'a str> {
        if let Expr::Call(call) = expr {
            if let Callee::Expr(callee) = &call.callee {
                if let Expr::Ident(id) = &**callee {
                    if id.sym.as_ref() == "_export" && call.args.len() >= 2 {
                        if let Expr::Lit(Lit::Str(s)) = &*call.args[0].expr {
                            return Some(s.value.as_ref());
                        }
                    }
                }
            }
        }
        None
    }

    struct NestedExportFixer {
        /// Stack of let/const names per function scope
        scope_stack: Vec<HashSet<String>>,
    }

    impl VisitMut for NestedExportFixer {
        fn visit_mut_function(&mut self, f: &mut Function) {
            // Collect let/const names in this function body (not nested)
            let mut collector = LetConstCollector { names: HashSet::new() };
            if let Some(body) = &f.body {
                for stmt in &body.stmts {
                    stmt.visit_with(&mut collector);
                }
            }
            // Also add params as local names
            for param in &f.params {
                collect_pat_names(&param.pat, &mut collector.names);
            }
            self.scope_stack.push(collector.names);
            f.visit_mut_children_with(self);
            self.scope_stack.pop();
        }

        fn visit_mut_arrow_expr(&mut self, f: &mut ArrowExpr) {
            let mut names = HashSet::new();
            for param in &f.params {
                collect_pat_names(param, &mut names);
            }
            // Collect let/const from arrow body if block
            if let BlockStmtOrExpr::BlockStmt(block) = &*f.body {
                let mut collector = LetConstCollector { names: HashSet::new() };
                for stmt in &block.stmts {
                    stmt.visit_with(&mut collector);
                }
                names.extend(collector.names);
            }
            self.scope_stack.push(names);
            f.visit_mut_children_with(self);
            self.scope_stack.pop();
        }

        fn visit_mut_expr(&mut self, expr: &mut Expr) {
            // Only fix inside nested functions (scope_stack has at least 2 entries:
            // the System.register factory and the nested function)
            if self.scope_stack.len() >= 2 {
                if let Some(name) = is_export_call_with_name(expr) {
                    // Check if name is declared as let/const in any enclosing function
                    // (except the outermost factory scope)
                    let is_shadowed = self.scope_stack.iter()
                        .skip(1) // skip factory scope
                        .any(|scope| scope.contains(name));
                    if is_shadowed {
                        // Unwrap _export("name", value) → value
                        if let Expr::Call(call) = expr {
                            if call.args.len() >= 2 {
                                let value = call.args.remove(1).expr;
                                *expr = *value;
                                // Continue visiting the unwrapped expression
                                expr.visit_mut_with(self);
                                return;
                            }
                        }
                    }
                }
            }
            expr.visit_mut_children_with(self);
        }
    }

    program.visit_mut_with(&mut NestedExportFixer {
        scope_stack: vec![],
    });
}

/// Insert evaluationStart() at the beginning and evaluationEnd() at the end
/// of execute().  Matches Babel's livelyPreTranspile (lines 1127/1130).
///
/// Generates:
///   System.get("@lively-env").evaluationStart("moduleId");
///   ... original execute body ...
///   System.get("@lively-env").evaluationEnd("moduleId");
fn insert_evaluation_hooks(program: &mut Program, module_id: &str) {
    for stmt in get_stmts_mut(program) {
        let call = match stmt {
            Stmt::Expr(ExprStmt { expr, .. }) => match &mut **expr {
                Expr::Call(c) => c,
                _ => continue,
            },
            _ => continue,
        };
        if call.args.len() < 2 { continue; }
        let factory = match &mut *call.args[1].expr {
            Expr::Fn(f) => f,
            _ => continue,
        };
        let body = match &mut factory.function.body {
            Some(b) => b,
            None => continue,
        };

        // Find the return statement → execute property
        let return_stmt = body.stmts.iter_mut().rev().find_map(|s| {
            if let Stmt::Return(ret) = s { Some(ret) } else { None }
        });
        let return_stmt = match return_stmt {
            Some(r) => r,
            None => continue,
        };
        let return_obj = match &mut return_stmt.arg {
            Some(a) => match &mut **a {
                Expr::Object(o) => o,
                _ => continue,
            },
            None => continue,
        };

        // Find execute function
        for prop in &mut return_obj.props {
            if let PropOrSpread::Prop(p) = prop {
                if let Prop::KeyValue(kv) = &mut **p {
                    if let PropName::Ident(id) = &kv.key {
                        if id.sym.as_ref() == "execute" {
                            if let Expr::Fn(f) = &mut *kv.value {
                                if let Some(exec_body) = &mut f.function.body {
                                    let make_hook = |method: &str| -> Stmt {
                                        Stmt::Expr(ExprStmt {
                                            span: DUMMY_SP,
                                            expr: Box::new(Expr::Call(CallExpr {
                                                span: DUMMY_SP,
                                                ctxt: Default::default(),
                                                callee: Callee::Expr(Box::new(Expr::Member(MemberExpr {
                                                    span: DUMMY_SP,
                                                    obj: Box::new(Expr::Call(CallExpr {
                                                        span: DUMMY_SP,
                                                        ctxt: Default::default(),
                                                        callee: Callee::Expr(Box::new(Expr::Member(MemberExpr {
                                                            span: DUMMY_SP,
                                                            obj: Box::new(Expr::Ident(Ident::new(
                                                                "System".into(), DUMMY_SP, Default::default(),
                                                            ))),
                                                            prop: MemberProp::Ident(IdentName {
                                                                span: DUMMY_SP, sym: "get".into(),
                                                            }),
                                                        }))),
                                                        args: vec![ExprOrSpread {
                                                            spread: None,
                                                            expr: Box::new(Expr::Lit(Lit::Str(Str {
                                                                span: DUMMY_SP, value: "@lively-env".into(), raw: None,
                                                            }))),
                                                        }],
                                                        type_args: None,
                                                    })),
                                                    prop: MemberProp::Ident(IdentName {
                                                        span: DUMMY_SP, sym: method.into(),
                                                    }),
                                                }))),
                                                args: vec![ExprOrSpread {
                                                    spread: None,
                                                    expr: Box::new(Expr::Lit(Lit::Str(Str {
                                                        span: DUMMY_SP, value: module_id.into(), raw: None,
                                                    }))),
                                                }],
                                                type_args: None,
                                            })),
                                        })
                                    };
                                    exec_body.stmts.insert(0, make_hook("evaluationStart"));
                                    exec_body.stmts.push(make_hook("evaluationEnd"));
                                }
                            }
                        }
                    }
                }
            }
        }
        break;
    }
}

/// Move `__lvVarRecorder = System.get("@lively-env").moduleEnv(...).recorder`
/// from execute() to the factory body.  This matches what Babel's
/// livelyPostTranspile does (lines 1307-1310 of babel/plugin.js).
fn hoist_recorder_init(program: &mut Program, capture_obj: &str) {
    for stmt in get_stmts_mut(program) {
        let call = match stmt {
            Stmt::Expr(ExprStmt { expr, .. }) => match &mut **expr {
                Expr::Call(c) => c,
                _ => continue,
            },
            _ => continue,
        };

        if call.args.len() < 2 { continue; }
        let factory = match &mut *call.args[1].expr {
            Expr::Fn(f) => f,
            _ => continue,
        };
        let body = match &mut factory.function.body {
            Some(b) => b,
            None => continue,
        };

        // Find the return statement to get execute function
        let return_idx = body.stmts.iter().position(|s| matches!(s, Stmt::Return(_)));
        let return_idx = match return_idx {
            Some(i) => i,
            None => continue,
        };

        let execute_body = {
            let return_stmt = &body.stmts[return_idx];
            let ret_arg = match return_stmt {
                Stmt::Return(ReturnStmt { arg: Some(a), .. }) => a,
                _ => continue,
            };
            let obj = match &**ret_arg {
                Expr::Object(o) => o,
                _ => continue,
            };
            obj.props.iter().find_map(|prop| {
                if let PropOrSpread::Prop(p) = prop {
                    if let Prop::KeyValue(kv) = &**p {
                        if let PropName::Ident(id) = &kv.key {
                            if id.sym.as_ref() == "execute" {
                                // Get the function body
                                if let Expr::Fn(f) = &*kv.value {
                                    return f.function.body.as_ref().map(|b| b.stmts.clone());
                                }
                            }
                        }
                    }
                }
                None
            })
        };

        let execute_stmts = match execute_body {
            Some(s) => s,
            None => continue,
        };

        // Find the __lvVarRecorder = ... assignment in execute()
        // Pattern: __lvVarRecorder = System.get("@lively-env").moduleEnv(...).recorder
        // Note: SWC's system_js may combine assignments into comma expressions (Seq),
        // so we also check the first expression in a SeqExpr.
        let is_recorder_assign = |expr: &Expr| -> bool {
            if let Expr::Assign(AssignExpr { left, .. }) = expr {
                if let Some(SimpleAssignTarget::Ident(id)) = left.as_simple() {
                    return id.sym.as_ref() == capture_obj;
                }
            }
            false
        };
        let recorder_idx = execute_stmts.iter().position(|s| {
            if let Stmt::Expr(ExprStmt { expr, .. }) = s {
                if is_recorder_assign(expr) { return true; }
                // Also check first expr in a comma expression
                if let Expr::Seq(seq) = &**expr {
                    if let Some(first) = seq.exprs.first() {
                        return is_recorder_assign(first);
                    }
                }
            }
            false
        });

        let recorder_idx = match recorder_idx {
            Some(i) => i,
            None => continue,
        };

        // Extract the recorder init. It may be a standalone Assign or the first
        // expr in a SeqExpr (comma expression).
        let orig_stmt = &execute_stmts[recorder_idx];
        let recorder_stmt = if let Stmt::Expr(ExprStmt { expr, .. }) = orig_stmt {
            if let Expr::Seq(seq) = &**expr {
                // Extract first expression as standalone statement
                if let Some(first) = seq.exprs.first() {
                    Stmt::Expr(ExprStmt {
                        span: DUMMY_SP,
                        expr: Box::new((**first).clone()),
                    })
                } else {
                    orig_stmt.clone()
                }
            } else {
                orig_stmt.clone()
            }
        } else {
            orig_stmt.clone()
        };

        // Now mutably access execute to remove/modify the statement
        let return_stmt = &mut body.stmts[return_idx];
        let ret_arg = match return_stmt {
            Stmt::Return(ReturnStmt { arg: Some(a), .. }) => a,
            _ => continue,
        };
        let obj = match &mut **ret_arg {
            Expr::Object(o) => o,
            _ => continue,
        };
        for prop in &mut obj.props {
            if let PropOrSpread::Prop(p) = prop {
                if let Prop::KeyValue(kv) = &mut **p {
                    if let PropName::Ident(id) = &kv.key {
                        if id.sym.as_ref() == "execute" {
                            if let Expr::Fn(f) = &mut *kv.value {
                                if let Some(b) = &mut f.function.body {
                                    // If it was a SeqExpr, remove the first sub-expression
                                    // (keep the rest as a SeqExpr or single expr)
                                    let stmt = &mut b.stmts[recorder_idx];
                                    if let Stmt::Expr(ExprStmt { expr, .. }) = stmt {
                                        if let Expr::Seq(seq) = &mut **expr {
                                            if seq.exprs.len() > 2 {
                                                seq.exprs.remove(0);
                                            } else if seq.exprs.len() == 2 {
                                                // Convert from Seq([a, b]) to just b
                                                let remaining = seq.exprs.remove(1);
                                                *expr = remaining;
                                            } else {
                                                b.stmts.remove(recorder_idx);
                                            }
                                        } else {
                                            b.stmts.remove(recorder_idx);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // Insert recorder init in factory body, before the return statement
        body.stmts.insert(return_idx, recorder_stmt);

        break;
    }
}

/// Rewrite setters to capture imports to __lvVarRecorder.
/// Matches Babel's livelyPostTranspile (lines 1267-1296 of babel/plugin.js).
///
/// Input setter:  `function(_dep) { X = _dep.X; }`
/// Output setter: `function(_dep = {}) { __lvVarRecorder.X = wrapper("X", "var", X = _dep.X, __lvVarRecorder); }`
///
/// Without wrapper: `function(_dep = {}) { __lvVarRecorder.X = X = _dep.X; }`
fn rewrite_setters(program: &mut Program, capture_obj: &str, declaration_wrapper: Option<&str>, excluded: &[String]) {
    for stmt in get_stmts_mut(program) {
        let call = match stmt {
            Stmt::Expr(ExprStmt { expr, .. }) => match &mut **expr {
                Expr::Call(c) => c,
                _ => continue,
            },
            _ => continue,
        };

        if call.args.len() < 2 { continue; }
        let factory = match &mut *call.args[1].expr {
            Expr::Fn(f) => f,
            _ => continue,
        };
        let body = match &mut factory.function.body {
            Some(b) => b,
            None => continue,
        };

        // Find the return statement
        let return_stmt = body.stmts.iter_mut().rev().find_map(|s| {
            if let Stmt::Return(ret) = s { Some(ret) } else { None }
        });
        let return_stmt = match return_stmt {
            Some(r) => r,
            None => continue,
        };
        let return_obj = match &mut return_stmt.arg {
            Some(a) => match &mut **a {
                Expr::Object(o) => o,
                _ => continue,
            },
            None => continue,
        };

        // Find the setters property
        let setters_prop = return_obj.props.iter_mut().find_map(|prop| {
            if let PropOrSpread::Prop(p) = prop {
                if let Prop::KeyValue(kv) = &mut **p {
                    if let PropName::Ident(id) = &kv.key {
                        if id.sym.as_ref() == "setters" {
                            return Some(&mut kv.value);
                        }
                    }
                }
            }
            None
        });

        let setters_arr = match setters_prop {
            Some(v) => match &mut **v {
                Expr::Array(a) => a,
                _ => continue,
            },
            None => continue,
        };

        // Rewrite each setter function
        for elem in &mut setters_arr.elems {
            let setter_fn = match elem {
                Some(ExprOrSpread { expr, .. }) => match &mut **expr {
                    Expr::Fn(f) => f,
                    _ => continue,
                },
                _ => continue,
            };

            // Add default parameter: _dep → _dep = {}
            if let Some(param) = setter_fn.function.params.first_mut() {
                if let Pat::Ident(id) = &param.pat {
                    let id_clone = id.clone();
                    param.pat = Pat::Assign(AssignPat {
                        span: DUMMY_SP,
                        left: Box::new(Pat::Ident(id_clone)),
                        right: Box::new(Expr::Object(ObjectLit {
                            span: DUMMY_SP,
                            props: vec![],
                        })),
                    });
                }
            }

            // Rewrite each statement in the setter body
            let setter_body = match &mut setter_fn.function.body {
                Some(b) => b,
                None => continue,
            };

            let new_stmts: Vec<Stmt> = setter_body.stmts.drain(..).map(|s| {
                // Match: X = _dep.X  (ExpressionStatement with AssignmentExpression)
                let expr_stmt = match &s {
                    Stmt::Expr(es) => es,
                    _ => return s,
                };
                let assign = match &*expr_stmt.expr {
                    Expr::Assign(a) => a,
                    _ => return s,
                };
                // LHS must be a simple identifier
                let lhs_name = match &assign.left {
                    AssignTarget::Simple(SimpleAssignTarget::Ident(id)) => {
                        id.sym.to_string()
                    }
                    _ => return s,
                };

                // Skip excluded names
                if excluded.contains(&lhs_name) {
                    return s;
                }

                // Build: capture_obj.X = [wrapper(...) | X = _dep.X]
                let capture_member = Expr::Member(MemberExpr {
                    span: DUMMY_SP,
                    obj: Box::new(Expr::Ident(Ident::new(
                        capture_obj.into(), DUMMY_SP, Default::default(),
                    ))),
                    prop: MemberProp::Ident(IdentName {
                        span: DUMMY_SP,
                        sym: lhs_name.as_str().into(),
                    }),
                });

                // Keep the original assignment (always runs): X = _dep.X
                let orig_stmt = s.clone();

                // Build the recorder capture (guarded):
                // if (typeof __rec !== "undefined") __rec.X = [defVar(..., X, __rec) | X]
                let value_expr = Expr::Ident(Ident::new(
                    lhs_name.as_str().into(), DUMMY_SP, Default::default(),
                ));
                let rhs = if let Some(wrapper) = declaration_wrapper {
                    Expr::Call(CallExpr {
                        span: DUMMY_SP,
                        ctxt: Default::default(),
                        callee: Callee::Expr(Box::new(Expr::Member(MemberExpr {
                            span: DUMMY_SP,
                            obj: Box::new(Expr::Ident(Ident::new(
                                capture_obj.into(), DUMMY_SP, Default::default(),
                            ))),
                            prop: MemberProp::Computed(ComputedPropName {
                                span: DUMMY_SP,
                                expr: Box::new(Expr::Lit(Lit::Str(Str {
                                    span: DUMMY_SP,
                                    value: wrapper.into(),
                                    raw: None,
                                }))),
                            }),
                        }))),
                        args: vec![
                            ExprOrSpread { spread: None, expr: Box::new(Expr::Lit(Lit::Str(Str {
                                span: DUMMY_SP, value: lhs_name.as_str().into(), raw: None,
                            })))},
                            ExprOrSpread { spread: None, expr: Box::new(Expr::Lit(Lit::Str(Str {
                                span: DUMMY_SP, value: "var".into(), raw: None,
                            })))},
                            ExprOrSpread { spread: None, expr: Box::new(value_expr) },
                            ExprOrSpread { spread: None, expr: Box::new(Expr::Ident(Ident::new(
                                capture_obj.into(), DUMMY_SP, Default::default(),
                            )))},
                        ],
                        type_args: None,
                    })
                } else {
                    value_expr
                };

                let capture_assign = Expr::Assign(AssignExpr {
                    span: DUMMY_SP,
                    op: AssignOp::Assign,
                    left: AssignTarget::Simple(SimpleAssignTarget::Member(MemberExpr {
                        span: DUMMY_SP,
                        obj: Box::new(Expr::Ident(Ident::new(
                            capture_obj.into(), DUMMY_SP, Default::default(),
                        ))),
                        prop: MemberProp::Ident(IdentName {
                            span: DUMMY_SP,
                            sym: lhs_name.as_str().into(),
                        }),
                    })),
                    right: Box::new(rhs),
                });

                // Two statements: 1) original assignment, 2) guarded recorder capture
                // Return a block to hold both.
                // We'll flatten this below since we need to return Vec<Stmt>.
                // Actually, just return both statements — we'll collect into a Vec.
                // For now, combine as: `X = _dep.X; if (typeof __rec !== "undefined") __rec.X = defVar("X", "var", X, __rec);`
                // We can't return 2 stmts from a map that expects 1. Use a block:
                Stmt::Block(BlockStmt {
                    span: DUMMY_SP,
                    ctxt: Default::default(),
                    stmts: vec![
                        orig_stmt,
                        Stmt::If(IfStmt {
                            span: DUMMY_SP,
                            test: Box::new(Expr::Bin(BinExpr {
                                span: DUMMY_SP,
                                op: BinaryOp::NotEqEq,
                                left: Box::new(Expr::Unary(UnaryExpr {
                                    span: DUMMY_SP,
                                    op: UnaryOp::TypeOf,
                                    arg: Box::new(Expr::Ident(Ident::new(
                                        capture_obj.into(), DUMMY_SP, Default::default(),
                                    ))),
                                })),
                                right: Box::new(Expr::Lit(Lit::Str(Str {
                                    span: DUMMY_SP,
                                    value: "undefined".into(),
                                    raw: None,
                                }))),
                            })),
                            cons: Box::new(Stmt::Expr(ExprStmt {
                                span: DUMMY_SP,
                                expr: Box::new(capture_assign),
                            })),
                            alt: None,
                        }),
                    ],
                })
            }).collect();

            setter_body.stmts = new_stmts;
        }

        break; // Only one System.register per module
    }
}

/// Collect all _export("name", ...) call names from an AST subtree.
struct ExportNameCollector {
    names: Vec<String>,
}

impl Visit for ExportNameCollector {
    fn visit_call_expr(&mut self, call: &CallExpr) {
        // Match _export("name", ...)
        if let Callee::Expr(callee) = &call.callee {
            if let Expr::Ident(id) = &**callee {
                if id.sym.as_ref() == "_export" {
                    if let Some(first_arg) = call.args.first() {
                        if let Expr::Lit(Lit::Str(s)) = &*first_arg.expr {
                            let name = s.value.to_string();
                            if !self.names.contains(&name) {
                                self.names.push(name);
                            }
                        }
                    }
                }
            }
        }
        // Continue visiting children
        call.visit_children_with(self);
    }
}

/// Walk the System.register output and insert `_export({name: void 0, ...})`
/// in the factory body before `return { setters, execute }`.
fn insert_early_exports(program: &mut Program) {
    // Find the System.register(..., function(_export, _context) { ... }) call
    for stmt in get_stmts_mut(program) {
        let call = match stmt {
            Stmt::Expr(ExprStmt { expr, .. }) => match &mut **expr {
                Expr::Call(c) => c,
                _ => continue,
            },
            _ => continue,
        };

        // The second argument is the factory function
        if call.args.len() < 2 { continue; }
        let factory = match &mut *call.args[1].expr {
            Expr::Fn(f) => f,
            _ => continue,
        };
        let body = match &mut factory.function.body {
            Some(b) => b,
            None => continue,
        };

        // Find the execute function inside `return { setters: [...], execute: fn }`
        // The return statement is typically the last statement in the factory body.
        let return_stmt = body.stmts.iter().rev().find_map(|s| {
            if let Stmt::Return(ret) = s {
                ret.arg.as_ref()
            } else {
                None
            }
        });

        let return_obj = match return_stmt {
            Some(expr) => match &**expr {
                Expr::Object(obj) => obj,
                _ => continue,
            },
            None => continue,
        };

        // Find the execute property
        let execute_fn = return_obj.props.iter().find_map(|prop| {
            if let PropOrSpread::Prop(p) = prop {
                if let Prop::KeyValue(kv) = &**p {
                    if let PropName::Ident(id) = &kv.key {
                        if id.sym.as_ref() == "execute" {
                            return Some(&kv.value);
                        }
                    }
                }
            }
            None
        });

        let execute_fn = match execute_fn {
            Some(f) => f,
            None => continue,
        };

        // Collect _export("name", ...) calls from inside execute
        let mut collector = ExportNameCollector { names: vec![] };
        execute_fn.visit_with(&mut collector);

        if collector.names.is_empty() { continue; }

        // Build: _export({"name1": void 0, "name2": void 0, ...})
        let props: Vec<PropOrSpread> = collector.names.iter().map(|name| {
            PropOrSpread::Prop(Box::new(Prop::KeyValue(KeyValueProp {
                key: PropName::Str(Str {
                    span: DUMMY_SP,
                    value: name.as_str().into(),
                    raw: None,
                }),
                value: Box::new(Expr::Unary(UnaryExpr {
                    span: DUMMY_SP,
                    op: UnaryOp::Void,
                    arg: Box::new(Expr::Lit(Lit::Num(Number {
                        span: DUMMY_SP,
                        value: 0.0,
                        raw: None,
                    }))),
                })),
            })))
        }).collect();

        let bulk_export = Stmt::Expr(ExprStmt {
            span: DUMMY_SP,
            expr: Box::new(Expr::Call(CallExpr {
                span: DUMMY_SP,
                ctxt: Default::default(),
                callee: Callee::Expr(Box::new(Expr::Ident(Ident::new(
                    "_export".into(), DUMMY_SP, Default::default(),
                )))),
                args: vec![ExprOrSpread {
                    spread: None,
                    expr: Box::new(Expr::Object(ObjectLit {
                        span: DUMMY_SP,
                        props,
                    })),
                }],
                type_args: None,
            })),
        });

        // Insert before the last statement (the return) in the factory body
        let insert_pos = body.stmts.len().saturating_sub(1);
        body.stmts.insert(insert_pos, bulk_export);

        break; // Only one System.register per module
    }
}

fn finish_output(cm: Lrc<SourceMap>, src_buf: Vec<u8>, src_map_buf: Vec<(swc_common::BytePos, swc_common::LineCol)>) -> Result<String, JsError> {
    let code = String::from_utf8(src_buf)
        .map_err(|e| JsError::new(&format!("UTF-8 error: {}", e)))?;

    let mut src_map = vec![];
    cm.build_source_map_from(&src_map_buf, None)
        .to_writer(&mut src_map)
        .map_err(|e| JsError::new(&format!("Source map error: {}", e)))?;

    let map = String::from_utf8(src_map)
        .map_err(|e| JsError::new(&format!("Source map UTF-8 error: {}", e)))?;

    Ok(serde_json::json!({
        "code": code,
        "map": map,
    }).to_string())
}

/// Returns the version of the transforms library.
#[wasm_bindgen]
pub fn version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}
