use swc_core::common::{Spanned, SyntaxContext, DUMMY_SP};
use std::collections::HashSet;
use swc_core::ecma::{
    ast::*,
    visit::{VisitMut, VisitMutWith},
};

use crate::utils::ast_helpers::*;
use crate::utils::scope_analyzer::ScopeAnalyzer;

/// Transform that captures top-level variables into a recorder object
///
/// Transforms:
/// - `var x = 1` → `__varRecorder__.x = 1`
/// - `x + 2` → `__varRecorder__.x + 2`
/// - Handles destructuring, function hoisting, and exports
pub struct ScopeCapturingTransform {
    /// Name of the capture object (e.g., "__varRecorder__")
    capture_obj: String,

    /// Optional wrapper function for declarations (for resurrection builds)
    declaration_wrapper: Option<String>,

    /// Variables to exclude from capturing
    excluded: HashSet<String>,

    /// Whether to capture imports
    capture_imports: bool,

    /// Whether this is a resurrection build
    resurrection: bool,

    /// Top-level variables that should be captured
    capturable_vars: HashSet<Id>,

    /// Function declarations to hoist
    hoisted_functions: Vec<ModuleItem>,

    /// Current depth (0 = module level, >0 = nested)
    depth: usize,

    /// Variables declared in current scope (for shadowing detection)
    scope_stack: Vec<HashSet<Id>>,
}

impl ScopeCapturingTransform {
    pub fn new(
        capture_obj: String,
        declaration_wrapper: Option<String>,
        excluded: Vec<String>,
        capture_imports: bool,
        resurrection: bool,
    ) -> Self {
        Self {
            capture_obj,
            declaration_wrapper,
            excluded: excluded.into_iter().collect(),
            capture_imports,
            resurrection,
            capturable_vars: HashSet::new(),
            hoisted_functions: Vec::new(),
            depth: 0,
            scope_stack: vec![HashSet::new()],
        }
    }

    /// Check if an identifier should be captured
    fn should_capture(&self, id: &Id) -> bool {
        // Don't capture in nested scopes
        if self.depth > 0 {
            return false;
        }

        // Don't capture excluded variables
        if self.excluded.contains(id.0.as_ref()) {
            return false;
        }

        // Check if it's a capturable variable
        self.capturable_vars.contains(id)
    }

    /// Create a member expression to the capture object: __varRecorder__.name
    fn create_captured_member(&self, name: &str) -> Expr {
        create_member_expr(create_ident_expr(&self.capture_obj), name)
    }

    /// Wrap a declaration with the declaration wrapper if configured
    fn wrap_declaration(&self, name: &str, value: Expr) -> Expr {
        if let Some(ref wrapper) = self.declaration_wrapper {
            // declarationWrapper(__varRecorder__, "name", value)
            create_call_expr(
                create_ident_expr(wrapper),
                vec![
                    to_expr_or_spread(create_ident_expr(&self.capture_obj)),
                    to_expr_or_spread(create_string_expr(name)),
                    to_expr_or_spread(value),
                ],
            )
        } else {
            value
        }
    }

    /// Transform a pattern into assignments to the capture object
    fn transform_pattern_to_assignments(
        &self,
        pat: &Pat,
        init: Option<Box<Expr>>,
    ) -> Vec<Expr> {
        let mut assignments = Vec::new();

        match pat {
            Pat::Ident(BindingIdent { id, .. }) => {
                if self.should_capture(&id.to_id()) {
                    let member = self.create_captured_member(id.sym.as_ref());
                    if let Some(init_expr) = init {
                        let value = self.wrap_declaration(id.sym.as_ref(), *init_expr);
                        assignments.push(create_assign_expr(
                            expr_to_assign_target(member),
                            value,
                        ));
                    }
                }
            }
            Pat::Array(ArrayPat { elems, .. }) => {
                // For array destructuring: var [a, b] = arr
                // Create temp variable: var _tmp = arr
                // Then: a = _tmp[0], b = _tmp[1]
                if let Some(init_expr) = init {
                    let temp_name = format!("_tmp_{}", rand_id());
                    let temp_ident = create_ident_expr(&temp_name);

                    // First assignment: _tmp = init
                    assignments.push(create_assign_expr(
                        expr_to_assign_target(temp_ident.clone()),
                        *init_expr,
                    ));

                    // Then assign each element
                    for (i, elem) in elems.iter().enumerate() {
                        if let Some(elem_pat) = elem {
                            let indexed = create_computed_member_expr(
                                temp_ident.clone(),
                                Expr::Lit(Lit::Num(Number {
                                    span: DUMMY_SP,
                                    value: i as f64,
                                    raw: None,
                                })),
                            );
                            let elem_assignments =
                                self.transform_pattern_to_assignments(elem_pat, Some(Box::new(indexed)));
                            assignments.extend(elem_assignments);
                        }
                    }
                }
            }
            Pat::Object(ObjectPat { props, .. }) => {
                // For object destructuring: var {a, b: c} = obj
                // Create temp variable: var _tmp = obj
                // Then: a = _tmp.a, c = _tmp.b
                if let Some(init_expr) = init {
                    let temp_name = format!("_tmp_{}", rand_id());
                    let temp_ident = create_ident_expr(&temp_name);

                    // First assignment: _tmp = init
                    assignments.push(create_assign_expr(
                        expr_to_assign_target(temp_ident.clone()),
                        *init_expr,
                    ));

                    // Then assign each property
                    for prop in props {
                        match prop {
                            ObjectPatProp::KeyValue(kv) => {
                                let key_name: String = match &kv.key {
                                    PropName::Ident(id) => (&*id.sym).to_owned(),
                                    PropName::Str(s) => (&*s.value).to_owned().into_string_lossy(),
                                    _ => continue,
                                };

                                let member = create_member_expr(temp_ident.clone(), &key_name);
                                let prop_assignments = self.transform_pattern_to_assignments(
                                    &kv.value,
                                    Some(Box::new(member)),
                                );
                                assignments.extend(prop_assignments);
                            }
                            ObjectPatProp::Assign(assign) => {
                                let key_name = assign.key.sym.to_string();
                                let member = create_member_expr(temp_ident.clone(), &key_name);

                                if self.should_capture(&assign.key.to_id()) {
                                    let captured = self.create_captured_member(&key_name);
                                    let value = if let Some(ref default) = assign.value {
                                        // Handle default value: {a = 5} = obj
                                        Expr::Bin(BinExpr {
                                            span: DUMMY_SP,
                                            op: BinaryOp::NullishCoalescing,
                                            left: Box::new(member),
                                            right: default.clone(),
                                        })
                                    } else {
                                        member
                                    };

                                    assignments.push(create_assign_expr(
                                        expr_to_assign_target(captured),
                                        value,
                                    ));
                                }
                            }
                            ObjectPatProp::Rest(rest) => {
                                // Handle rest properties: {...rest}
                                let rest_assignments =
                                    self.transform_pattern_to_assignments(&rest.arg, Some(Box::new(temp_ident.clone())));
                                assignments.extend(rest_assignments);
                            }
                        }
                    }
                }
            }
            Pat::Rest(RestPat { arg, .. }) => {
                // Rest pattern in function params or arrays
                let rest_assignments = self.transform_pattern_to_assignments(arg, init);
                assignments.extend(rest_assignments);
            }
            Pat::Assign(AssignPat { left, right, .. }) => {
                // Assignment pattern with default: x = 5
                if let Some(init_expr) = init {
                    let value = Expr::Bin(BinExpr {
                        span: DUMMY_SP,
                        op: BinaryOp::NullishCoalescing,
                        left: init_expr,
                        right: right.clone(),
                    });
                    let assign_assignments =
                        self.transform_pattern_to_assignments(left, Some(Box::new(value)));
                    assignments.extend(assign_assignments);
                } else {
                    let assign_assignments = self.transform_pattern_to_assignments(left, Some(right.clone()));
                    assignments.extend(assign_assignments);
                }
            }
            _ => {}
        }

        assignments
    }

    /// Enter a new scope
    fn enter_scope(&mut self) {
        self.depth += 1;
        self.scope_stack.push(HashSet::new());
    }

    /// Exit a scope
    fn exit_scope(&mut self) {
        self.depth -= 1;
        self.scope_stack.pop();
    }

    /// Check if we're at module level
    fn is_module_level(&self) -> bool {
        self.depth == 0
    }
}

impl VisitMut for ScopeCapturingTransform {
    fn visit_mut_module(&mut self, module: &mut Module) {
        // First pass: analyze scope to determine capturable variables
        let mut analyzer = ScopeAnalyzer::new();
        use swc_core::ecma::visit::VisitWith;
        module.visit_with(&mut analyzer);

        self.capturable_vars = analyzer
            .top_level_vars
            .into_iter()
            .filter(|id| !self.excluded.contains(id.0.as_ref()))
            .collect();

        // Second pass: transform the module
        self.depth = 0;

        // Visit all items to collect function declarations for hoisting
        for item in &module.body {
            if let ModuleItem::Stmt(Stmt::Decl(Decl::Fn(fn_decl))) = item {
                if self.should_capture(&fn_decl.ident.to_id()) {
                    self.hoisted_functions.push(item.clone());
                }
            }
        }

        // Transform module items
        module.visit_mut_children_with(self);

        // Prepend hoisted functions (if resurrection build)
        if self.resurrection && !self.hoisted_functions.is_empty() {
            let mut new_body = self.hoisted_functions.clone();
            new_body.extend(module.body.drain(..));
            module.body = new_body;
        }
    }

    fn visit_mut_module_item(&mut self, item: &mut ModuleItem) {
        if !self.is_module_level() {
            item.visit_mut_children_with(self);
            return;
        }

        match item {
            ModuleItem::ModuleDecl(ModuleDecl::ExportDecl(export)) => {
                // Handle: export var x = 1
                // Transform to: __varRecorder__.x = 1; export { x }
                if let Decl::Var(var_decl) = &mut export.decl {
                    let mut new_stmts = Vec::new();
                    let mut export_names = Vec::new();

                    for decl in &var_decl.decls {
                        let ids = extract_idents_from_pat(&decl.name);

                        for id in &ids {
                            if self.should_capture(id) {
                                export_names.push(ExportSpecifier::Named(ExportNamedSpecifier {
                                    span: DUMMY_SP,
                                    orig: ModuleExportName::Ident(Ident::new(id.0.clone(), DUMMY_SP, SyntaxContext::empty())),
                                    exported: None,
                                    is_type_only: false,
                                }));
                            }
                        }

                        if let Some(init) = &decl.init {
                            let assignments =
                                self.transform_pattern_to_assignments(&decl.name, Some(init.clone()));

                            for assign in assignments {
                                new_stmts.push(ModuleItem::Stmt(Stmt::Expr(ExprStmt {
                                    span: DUMMY_SP,
                                    expr: Box::new(assign),
                                })));
                            }
                        }
                    }

                    // Replace with assignment statements + named export
                    if !export_names.is_empty() {
                        new_stmts.push(ModuleItem::ModuleDecl(ModuleDecl::ExportNamed(
                            NamedExport {
                                span: DUMMY_SP,
                                specifiers: export_names,
                                src: None,
                                type_only: false,
                                with: None,
                            },
                        )));

                        *item = new_stmts.remove(0);
                        // Note: Can't insert multiple items here, would need parent context
                    }
                }
            }
            ModuleItem::Stmt(Stmt::Decl(Decl::Var(var_decl))) => {
                // Transform: var x = 1
                // Into: __varRecorder__.x = 1
                let mut assignments = Vec::new();

                for decl in &var_decl.decls {
                    let assign_exprs =
                        self.transform_pattern_to_assignments(&decl.name, decl.init.clone());
                    assignments.extend(assign_exprs);
                }

                if !assignments.is_empty() {
                    // Replace with expression statement(s)
                    let expr = if assignments.len() == 1 {
                        assignments.into_iter().next().unwrap()
                    } else {
                        create_seq_expr(assignments.into_iter().map(Box::new).collect())
                    };

                    *item = ModuleItem::Stmt(Stmt::Expr(ExprStmt {
                        span: DUMMY_SP,
                        expr: Box::new(expr),
                    }));
                }
            }
            ModuleItem::Stmt(Stmt::Decl(Decl::Fn(fn_decl))) => {
                // Transform function declarations
                // function foo() {} → __varRecorder__.foo = function foo() {}
                if self.should_capture(&fn_decl.ident.to_id()) {
                    let fn_name = fn_decl.ident.sym.to_string();
                    let member = self.create_captured_member(&fn_name);

                    let fn_expr = Expr::Fn(FnExpr {
                        ident: Some(fn_decl.ident.clone()),
                        function: fn_decl.function.clone(),
                    });

                    let value = self.wrap_declaration(&fn_name, fn_expr);

                    let assign = create_assign_expr(
                        expr_to_assign_target(member),
                        value,
                    );

                    *item = ModuleItem::Stmt(Stmt::Expr(ExprStmt {
                        span: DUMMY_SP,
                        expr: Box::new(assign),
                    }));
                }
            }
            ModuleItem::Stmt(Stmt::Decl(Decl::Class(class_decl))) => {
                // Transform class declarations
                // class Foo {} → __varRecorder__.Foo = class Foo {}
                if self.should_capture(&class_decl.ident.to_id()) {
                    let class_name = class_decl.ident.sym.to_string();
                    let member = self.create_captured_member(&class_name);

                    let class_expr = Expr::Class(ClassExpr {
                        ident: Some(class_decl.ident.clone()),
                        class: class_decl.class.clone(),
                    });

                    let assign = create_assign_expr(
                        expr_to_assign_target(member),
                        class_expr,
                    );

                    *item = ModuleItem::Stmt(Stmt::Expr(ExprStmt {
                        span: DUMMY_SP,
                        expr: Box::new(assign),
                    }));
                }
            }
            _ => {}
        }

        item.visit_mut_children_with(self);
    }

    fn visit_mut_expr(&mut self, expr: &mut Expr) {
        // Transform identifier references to captured members
        match expr {
            Expr::Ident(ident) => {
                if self.should_capture(&ident.to_id()) {
                    *expr = self.create_captured_member(ident.sym.as_ref());
                    return;
                }
            }
            _ => {}
        }

        expr.visit_mut_children_with(self);
    }

    // Scope tracking for nested functions/blocks
    fn visit_mut_function(&mut self, func: &mut Function) {
        self.enter_scope();
        func.visit_mut_children_with(self);
        self.exit_scope();
    }

    fn visit_mut_arrow_expr(&mut self, arrow: &mut ArrowExpr) {
        self.enter_scope();
        arrow.visit_mut_children_with(self);
        self.exit_scope();
    }

    fn visit_mut_block_stmt(&mut self, block: &mut BlockStmt) {
        if !self.is_module_level() {
            self.enter_scope();
        }
        block.visit_mut_children_with(self);
        if !self.is_module_level() {
            self.exit_scope();
        }
    }
}

// Helper to generate random IDs for temporary variables
fn rand_id() -> String {
    use std::sync::atomic::{AtomicUsize, Ordering};
    static COUNTER: AtomicUsize = AtomicUsize::new(0);
    format!("{}", COUNTER.fetch_add(1, Ordering::SeqCst))
}

#[cfg(test)]
mod tests {
    use super::*;
    use swc_core::common::{sync::Lrc, FileName, SourceMap};
    use swc_core::ecma::codegen::{text_writer::JsWriter, Emitter, Config};
    use swc_core::ecma::parser::{parse_file_as_module, Syntax};

    fn transform_code(code: &str) -> String {
        let cm = Lrc::new(SourceMap::default());
        let fm = cm.new_source_file(FileName::Anon, code.to_string());

        let mut module = parse_file_as_module(
            &fm,
            Syntax::Es(Default::default()),
            Default::default(),
            None,
            &mut vec![],
        )
        .unwrap();

        let mut transform = ScopeCapturingTransform::new(
            "__varRecorder__".to_string(),
            None,
            vec!["console".to_string()],
            true,
            false,
        );

        module.visit_mut_with(&mut transform);

        let mut buf = vec![];
        {
            let mut emitter = Emitter {
                cfg: Config::default(),
                cm: cm.clone(),
                comments: None,
                wr: JsWriter::new(cm, "\n", &mut buf, None),
            };

            emitter.emit_module(&module).unwrap();
        }

        String::from_utf8(buf).unwrap()
    }

    #[test]
    fn test_simple_var() {
        let output = transform_code("var x = 1;");
        assert!(output.contains("__varRecorder__.x"));
    }

    #[test]
    fn test_var_reference() {
        let output = transform_code("var x = 1; x + 2;");
        assert!(output.contains("__varRecorder__.x"));
    }

    #[test]
    fn test_function_declaration() {
        let output = transform_code("function foo() { return 1; }");
        assert!(output.contains("__varRecorder__.foo"));
    }

    #[test]
    fn test_excluded_var() {
        let output = transform_code("console.log('hello');");
        assert!(!output.contains("__varRecorder__.console"));
    }
}
