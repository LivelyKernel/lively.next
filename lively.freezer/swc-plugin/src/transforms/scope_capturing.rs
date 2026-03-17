use swc_core::common::{SyntaxContext, DUMMY_SP};
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
    _resurrection: bool,

    /// Current module id
    module_id: String,

    /// Optional current module accessor expression (legacy parity for import.meta).
    current_module_accessor: Option<String>,

    /// Top-level variables that should be captured
    capturable_vars: HashSet<Id>,

    /// Top-level imported bindings
    imported_vars: HashSet<Id>,

    /// Top-level function capture assignments that must run before body code
    hoisted_function_captures: Vec<ModuleItem>,

    /// Current depth (0 = module level, >0 = nested)
    depth: usize,

    /// Lexically declared variable names in nested scopes (for shadowing detection)
    scope_stack: Vec<ScopeFrame>,

    /// Names declared by the currently visited variable declaration chain.
    /// Needed for parity with legacy transform behavior: references inside a
    /// var-declarator initializer must resolve to local bindings declared in
    /// the same declaration list, not the recorder member.
    current_var_decl_stack: Vec<HashSet<String>>,
}

struct ScopeFrame {
    names: HashSet<String>,
    is_function_scope: bool,
}

impl ScopeCapturingTransform {
    pub fn new(
        capture_obj: String,
        declaration_wrapper: Option<String>,
        excluded: Vec<String>,
        capture_imports: bool,
        resurrection: bool,
        module_id: String,
        current_module_accessor: Option<String>,
    ) -> Self {
        Self {
            capture_obj,
            declaration_wrapper,
            excluded: excluded.into_iter().collect(),
            capture_imports,
            _resurrection: resurrection,
            module_id,
            current_module_accessor,
            capturable_vars: HashSet::new(),
            imported_vars: HashSet::new(),
            hoisted_function_captures: Vec::new(),
            depth: 0,
            scope_stack: vec![ScopeFrame {
                names: HashSet::new(),
                is_function_scope: true,
            }],
            current_var_decl_stack: Vec::new(),
        }
    }

    /// Check if an identifier should be captured
    fn should_capture(&self, id: &Id) -> bool {
        // Never rewrite identifiers that are shadowed in a nested lexical scope.
        // This keeps locals (params/vars/lets) untouched while still rewriting
        // references to captured top-level bindings in nested functions/blocks.
        if self
            .scope_stack
            .iter()
            .skip(1)
            .rev()
            .any(|scope| scope.names.contains(id.0.as_ref()))
        {
            return false;
        }

        // While walking a variable declaration initializer, do not rewrite
        // references to bindings declared by the same declaration statement.
        // Example:
        //   var xe = ..., Ue = get(xe)
        // must keep `xe` local here, matching legacy JS transform output.
        if self
            .current_var_decl_stack
            .iter()
            .rev()
            .any(|names| names.contains(id.0.as_ref()))
        {
            return false;
        }

        // Don't capture excluded variables
        if self.excluded.contains(id.0.as_ref()) {
            return false;
        }

        // Keep imported bindings as plain identifiers unless import capture is enabled.
        if !self.capture_imports && self.imported_vars.contains(id) {
            return false;
        }

        // Check if it's a capturable variable
        self.capturable_vars.contains(id)
    }

    /// Create a member expression to the capture object: __varRecorder__.name
    fn create_captured_member(&self, name: &str) -> Expr {
        create_member_expr(create_ident_expr(&self.capture_obj), name)
    }

    /// Wrap a declaration with the declaration wrapper if configured.
    /// Legacy wrapper signature: wrapper(name, kind, value, recorder[, meta])
    fn wrap_declaration(&self, name: &str, kind: &str, value: Expr) -> Expr {
        if let Some(ref wrapper) = self.declaration_wrapper {
            // declarationWrapper("name", "kind", value, __varRecorder__)
            create_call_expr(
                create_ident_expr(wrapper),
                vec![
                    to_expr_or_spread(create_string_expr(name)),
                    to_expr_or_spread(create_string_expr(kind)),
                    to_expr_or_spread(value),
                    to_expr_or_spread(create_ident_expr(&self.capture_obj)),
                ],
            )
        } else {
            value
        }
    }

    /// Check if a pattern includes any capturable identifiers
    fn should_capture_pattern(&self, pat: &Pat) -> bool {
        extract_idents_from_pat(pat)
            .into_iter()
            .any(|id| self.should_capture(&id))
    }

    /// Create a default initializer for an uninitialized binding
    fn create_default_init(&self, name: &str) -> Expr {
        Expr::Bin(BinExpr {
            span: DUMMY_SP,
            op: BinaryOp::LogicalOr,
            left: Box::new(self.create_captured_member(name)),
            right: Box::new(create_ident_expr("undefined")),
        })
    }

    /// Transform a pattern into statements assigning to the capture object
    fn transform_pattern_to_stmts(
        &self,
        pat: &Pat,
        init: Option<Box<Expr>>,
        declaration_kind: &str,
    ) -> Vec<Stmt> {
        let mut stmts = Vec::new();

        match pat {
            Pat::Ident(BindingIdent { id, .. }) => {
                if self.should_capture(&id.to_id()) {
                    let member = self.create_captured_member(id.sym.as_ref());
                    let init_expr = init.unwrap_or_else(|| Box::new(self.create_default_init(id.sym.as_ref())));
                    let value = self.wrap_declaration(id.sym.as_ref(), declaration_kind, *init_expr);
                    stmts.push(Stmt::Expr(ExprStmt {
                        span: DUMMY_SP,
                        expr: Box::new(create_assign_expr(
                            expr_to_assign_target(member),
                            value,
                        )),
                    }));
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
                    stmts.push(Stmt::Decl(create_var_decl(
                        VarDeclKind::Var,
                        &temp_name,
                        Some(*init_expr),
                    )));

                    // Then assign each element
                    for (i, elem) in elems.iter().enumerate() {
                        if let Some(elem_pat) = elem {
                            if let Pat::Rest(rest_pat) = elem_pat {
                                let slice_call = create_call_expr(
                                    create_member_expr(temp_ident.clone(), "slice"),
                                    vec![to_expr_or_spread(Expr::Lit(Lit::Num(Number {
                                        span: DUMMY_SP,
                                        value: i as f64,
                                        raw: None,
                                    })))],
                                );
                                let rest_stmts = self.transform_pattern_to_stmts(
                                    &rest_pat.arg,
                                    Some(Box::new(slice_call)),
                                    declaration_kind,
                                );
                                stmts.extend(rest_stmts);
                            } else {
                                let indexed = create_computed_member_expr(
                                    temp_ident.clone(),
                                    Expr::Lit(Lit::Num(Number {
                                        span: DUMMY_SP,
                                        value: i as f64,
                                        raw: None,
                                    })),
                                );
                                let elem_stmts = self
                                    .transform_pattern_to_stmts(
                                        elem_pat,
                                        Some(Box::new(indexed)),
                                        declaration_kind,
                                    );
                                stmts.extend(elem_stmts);
                            }
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
                    stmts.push(Stmt::Decl(create_var_decl(
                        VarDeclKind::Var,
                        &temp_name,
                        Some(*init_expr),
                    )));

                    let known_keys: Vec<String> = props
                        .iter()
                        .filter_map(|prop| match prop {
                            ObjectPatProp::KeyValue(kv) => match &kv.key {
                                PropName::Ident(id) => Some(id.sym.to_string()),
                                PropName::Str(s) => Some(s.value.to_string()),
                                _ => None,
                            },
                            ObjectPatProp::Assign(assign) => Some(assign.key.sym.to_string()),
                            ObjectPatProp::Rest(_) => None,
                        })
                        .collect();

                    // Then assign each property
                    for prop in props {
                        match prop {
                            ObjectPatProp::KeyValue(kv) => {
                                let key_name: String = match &kv.key {
                                    PropName::Ident(id) => (&*id.sym).to_owned(),
                                    PropName::Str(s) => s.value.to_string(),
                                    _ => continue,
                                };

                                let member = create_member_expr(temp_ident.clone(), &key_name);
                                let prop_stmts = self.transform_pattern_to_stmts(
                                    &kv.value,
                                    Some(Box::new(member)),
                                    declaration_kind,
                                );
                                stmts.extend(prop_stmts);
                            }
                            ObjectPatProp::Assign(assign) => {
                                let key_name = assign.key.sym.to_string();
                                let member = create_member_expr(temp_ident.clone(), &key_name);

                                if self.should_capture(&assign.key.to_id()) {
                                    let captured = self.create_captured_member(&key_name);
                                    let value = if let Some(ref default) = assign.value {
                                        // Handle default value: {a = 5} = obj
                                        // Keep parity with legacy transform:
                                        // value === undefined ? default : value
                                        Expr::Cond(CondExpr {
                                            span: DUMMY_SP,
                                            test: Box::new(Expr::Bin(BinExpr {
                                                span: DUMMY_SP,
                                                op: BinaryOp::EqEqEq,
                                                left: Box::new(member.clone()),
                                                right: Box::new(create_ident_expr("undefined")),
                                            })),
                                            cons: default.clone(),
                                            alt: Box::new(member),
                                        })
                                    } else {
                                        member
                                    };

                                    stmts.push(Stmt::Expr(ExprStmt {
                                        span: DUMMY_SP,
                                        expr: Box::new(create_assign_expr(
                                            expr_to_assign_target(captured),
                                            value,
                                        )),
                                    }));
                                }
                            }
                            ObjectPatProp::Rest(rest) => {
                                // Handle rest properties: {...rest}
                                // Legacy transform materializes a new object and copies unknown keys.
                                if let Pat::Ident(BindingIdent { id: rest_ident, .. }) = &*rest.arg {
                                    stmts.push(Stmt::Decl(create_var_decl(
                                        VarDeclKind::Var,
                                        rest_ident.sym.as_ref(),
                                        Some(create_object_lit(vec![])),
                                    )));

                                    if self.should_capture(&rest_ident.to_id()) {
                                        let captured =
                                            self.create_captured_member(rest_ident.sym.as_ref());
                                        stmts.push(Stmt::Expr(ExprStmt {
                                            span: DUMMY_SP,
                                            expr: Box::new(create_assign_expr(
                                                expr_to_assign_target(captured),
                                                Expr::Ident(rest_ident.clone()),
                                            )),
                                        }));
                                    }

                                    let key_ident = Ident::new(
                                        "__key".into(),
                                        DUMMY_SP,
                                        SyntaxContext::empty(),
                                    );
                                    let mut for_body_stmts: Vec<Stmt> = known_keys
                                        .iter()
                                        .map(|key| {
                                            Stmt::If(IfStmt {
                                                span: DUMMY_SP,
                                                test: Box::new(Expr::Bin(BinExpr {
                                                    span: DUMMY_SP,
                                                    op: BinaryOp::EqEqEq,
                                                    left: Box::new(Expr::Ident(key_ident.clone())),
                                                    right: Box::new(create_string_expr(key)),
                                                })),
                                                cons: Box::new(Stmt::Continue(ContinueStmt {
                                                    span: DUMMY_SP,
                                                    label: None,
                                                })),
                                                alt: None,
                                            })
                                        })
                                        .collect();

                                    let rest_member = create_computed_member_expr(
                                        Expr::Ident(rest_ident.clone()),
                                        Expr::Ident(key_ident.clone()),
                                    );
                                    let source_member = create_computed_member_expr(
                                        temp_ident.clone(),
                                        Expr::Ident(key_ident.clone()),
                                    );
                                    for_body_stmts.push(Stmt::Expr(ExprStmt {
                                        span: DUMMY_SP,
                                        expr: Box::new(create_assign_expr(
                                            expr_to_assign_target(rest_member),
                                            source_member,
                                        )),
                                    }));

                                    let for_in = Stmt::ForIn(ForInStmt {
                                        span: DUMMY_SP,
                                        left: ForHead::VarDecl(Box::new(VarDecl {
                                            span: DUMMY_SP,
                                            ctxt: SyntaxContext::empty(),
                                            kind: VarDeclKind::Var,
                                            declare: false,
                                            decls: vec![VarDeclarator {
                                                span: DUMMY_SP,
                                                name: Pat::Ident(BindingIdent {
                                                    id: key_ident,
                                                    type_ann: None,
                                                }),
                                                init: None,
                                                definite: false,
                                            }],
                                        })),
                                        right: Box::new(temp_ident.clone()),
                                        body: Box::new(Stmt::Block(BlockStmt {
                                            span: DUMMY_SP,
                                            ctxt: SyntaxContext::empty(),
                                            stmts: for_body_stmts,
                                        })),
                                    });

                                    let iife = Expr::Call(CallExpr {
                                        span: DUMMY_SP,
                                        ctxt: SyntaxContext::empty(),
                                        callee: Callee::Expr(Box::new(Expr::Fn(FnExpr {
                                            ident: None,
                                            function: Box::new(Function {
                                                params: vec![],
                                                decorators: vec![],
                                                span: DUMMY_SP,
                                                ctxt: SyntaxContext::empty(),
                                                body: Some(BlockStmt {
                                                    span: DUMMY_SP,
                                                    ctxt: SyntaxContext::empty(),
                                                    stmts: vec![for_in],
                                                }),
                                                is_generator: false,
                                                is_async: false,
                                                type_params: None,
                                                return_type: None,
                                            }),
                                        }))),
                                        args: vec![],
                                        type_args: None,
                                    });

                                    stmts.push(Stmt::Expr(ExprStmt {
                                        span: DUMMY_SP,
                                        expr: Box::new(iife),
                                    }));
                                } else {
                                    let rest_stmts = self.transform_pattern_to_stmts(
                                        &rest.arg,
                                        Some(Box::new(temp_ident.clone())),
                                        declaration_kind,
                                    );
                                    stmts.extend(rest_stmts);
                                }
                            }
                        }
                    }
                }
            }
            Pat::Rest(RestPat { arg, .. }) => {
                // Rest pattern in function params or arrays
                let rest_stmts = self.transform_pattern_to_stmts(arg, init, declaration_kind);
                stmts.extend(rest_stmts);
            }
            Pat::Assign(AssignPat { left, right, .. }) => {
                // Assignment pattern with default: x = 5
                if let Some(init_expr) = init {
                    let value = Expr::Cond(CondExpr {
                        span: DUMMY_SP,
                        test: Box::new(Expr::Bin(BinExpr {
                            span: DUMMY_SP,
                            op: BinaryOp::EqEqEq,
                            left: init_expr.clone(),
                            right: Box::new(create_ident_expr("undefined")),
                        })),
                        cons: right.clone(),
                        alt: init_expr,
                    });
                    let assign_stmts =
                        self.transform_pattern_to_stmts(left, Some(Box::new(value)), declaration_kind);
                    stmts.extend(assign_stmts);
                } else {
                    let assign_stmts =
                        self.transform_pattern_to_stmts(left, Some(right.clone()), declaration_kind);
                    stmts.extend(assign_stmts);
                }
            }
            _ => {}
        }

        stmts
    }

    /// Enter a new scope
    fn enter_scope(&mut self, is_function_scope: bool) {
        self.depth += 1;
        self.scope_stack.push(ScopeFrame {
            names: HashSet::new(),
            is_function_scope,
        });
    }

    fn declare_in_current_scope(&mut self, name: &str) {
        if let Some(scope) = self.scope_stack.last_mut() {
            scope.names.insert(name.to_string());
        }
    }

    fn declare_in_nearest_function_scope(&mut self, name: &str) {
        if let Some(scope) = self
            .scope_stack
            .iter_mut()
            .rev()
            .find(|scope| scope.is_function_scope)
        {
            scope.names.insert(name.to_string());
        }
    }

    fn declare_pattern_in_current_scope(&mut self, pat: &Pat) {
        for (sym, _) in extract_idents_from_pat(pat) {
            self.declare_in_current_scope(sym.as_ref());
        }
    }

    /// Build the recorder runtime expression:
    /// (lively.FreezerRuntime || lively.frozenModules)
    /// or, if `lively` is locally bound:
    /// (globalThis.lively.FreezerRuntime || globalThis.lively.frozenModules)
    fn recorder_runtime_expr(&self, has_local_lively_binding: bool) -> Expr {
        let lively_expr = if has_local_lively_binding {
            create_member_expr(create_ident_expr("globalThis"), "lively")
        } else {
            create_ident_expr("lively")
        };

        Expr::Bin(BinExpr {
            span: DUMMY_SP,
            op: BinaryOp::LogicalOr,
            left: Box::new(create_member_expr(lively_expr.clone(), "FreezerRuntime")),
            right: Box::new(create_member_expr(lively_expr, "frozenModules")),
        })
    }

    /// Build:
    /// const __varRecorder__ = (..runtime..).recorderFor("<moduleId>", __contextModule__);
    fn create_recorder_init_decl(&self, has_local_lively_binding: bool) -> ModuleItem {
        let recorder_call = create_call_expr(
            create_member_expr(self.recorder_runtime_expr(has_local_lively_binding), "recorderFor"),
            vec![
                to_expr_or_spread(create_string_expr(&self.module_id)),
                to_expr_or_spread(create_ident_expr("__contextModule__")),
            ],
        );

        ModuleItem::Stmt(Stmt::Decl(create_var_decl(
            VarDeclKind::Const,
            &self.capture_obj,
            Some(recorder_call),
        )))
    }

    /// Build import.meta replacement expression.
    /// Uses the module_id directly as the URL since it's known at bundle time.
    fn create_import_meta_expr(&self) -> Expr {
        let url_expr = if !self.module_id.is_empty() {
            create_string_expr(&self.module_id)
        } else if let Some(accessor) = &self.current_module_accessor {
            create_member_expr(parse_expr_or_ident(accessor), "id")
        } else {
            create_ident_expr(r#"eval("typeof _context !== 'undefined' ? _context : {}").id"#)
        };
        create_object_lit(vec![create_prop("url", url_expr)])
    }

    /// Build `__varRecorder__.name = ...` for a function declaration capture.
    fn create_function_capture_assignment(&self, fn_decl: &FnDecl) -> ModuleItem {
        let fn_name = fn_decl.ident.sym.to_string();
        let member = self.create_captured_member(&fn_name);
        let value = if self.declaration_wrapper.is_some() {
            self.wrap_declaration(
                &fn_name,
                "function",
                Expr::Fn(FnExpr {
                    ident: Some(fn_decl.ident.clone()),
                    function: fn_decl.function.clone(),
                }),
            )
        } else {
            Expr::Ident(fn_decl.ident.clone())
        };

        ModuleItem::Stmt(Stmt::Expr(ExprStmt {
            span: DUMMY_SP,
            expr: Box::new(create_assign_expr(expr_to_assign_target(member), value)),
        }))
    }

    /// Build `__varRecorder__.name = ...` for a class declaration capture.
    fn create_class_capture_assignment(&self, class_decl: &ClassDecl) -> ModuleItem {
        let class_name = class_decl.ident.sym.to_string();
        let member = self.create_captured_member(&class_name);
        let value = if self.declaration_wrapper.is_some() {
            self.wrap_declaration(
                &class_name,
                "class",
                Expr::Class(ClassExpr {
                    ident: Some(class_decl.ident.clone()),
                    class: class_decl.class.clone(),
                }),
            )
        } else {
            Expr::Ident(class_decl.ident.clone())
        };

        ModuleItem::Stmt(Stmt::Expr(ExprStmt {
            span: DUMMY_SP,
            expr: Box::new(create_assign_expr(expr_to_assign_target(member), value)),
        }))
    }

    /// Collect function captures that need to run before any top-level statements.
    fn collect_hoisted_function_capture(&mut self, item: &ModuleItem) {
        match item {
            ModuleItem::Stmt(Stmt::Decl(Decl::Fn(fn_decl))) => {
                if self.should_capture(&fn_decl.ident.to_id()) {
                    self.hoisted_function_captures
                        .push(self.create_function_capture_assignment(fn_decl));
                }
            }
            ModuleItem::ModuleDecl(ModuleDecl::ExportDecl(export_decl)) => {
                if let Decl::Fn(fn_decl) = &export_decl.decl {
                    if self.should_capture(&fn_decl.ident.to_id()) {
                        self.hoisted_function_captures
                            .push(self.create_function_capture_assignment(fn_decl));
                    }
                }
            }
            _ => {}
        }
    }

    /// Insert hoisted function capture assignments after imports and recorder init.
    fn insert_hoisted_function_captures(&self, module: &mut Module, inserted_recorder_init: bool) {
        if self.hoisted_function_captures.is_empty() {
            return;
        }

        let mut insert_idx = module
            .body
            .iter()
            .take_while(|item| matches!(item, ModuleItem::ModuleDecl(ModuleDecl::Import(_))))
            .count();

        if inserted_recorder_init {
            insert_idx += 1;
        }

        for (offset, item) in self.hoisted_function_captures.iter().cloned().enumerate() {
            module.body.insert(insert_idx + offset, item);
        }
    }

    /// Insert recorder initialization directly after static imports.
    fn insert_recorder_init(&self, module: &mut Module, has_local_lively_binding: bool) {
        let insert_idx = module
            .body
            .iter()
            .take_while(|item| matches!(item, ModuleItem::ModuleDecl(ModuleDecl::Import(_))))
            .count();
        module
            .body
            .insert(insert_idx, self.create_recorder_init_decl(has_local_lively_binding));
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

    /// Transform a module item at module level, allowing expansion into multiple items
    fn transform_module_item(&self, item: ModuleItem) -> Vec<ModuleItem> {
        match item {
            ModuleItem::Stmt(Stmt::Decl(Decl::Var(var_decl))) => {
                let mut items = Vec::new();

                for decl in &var_decl.decls {
                    let mut init = decl.init.clone();
                    if self.module_id.ends_with("lively.morphic/config.js") {
                        if let Some(init_expr) = &init {
                            if matches!(**init_expr, Expr::Object(_)) {
                                if let Pat::Ident(BindingIdent { id, .. }) = &decl.name {
                                    let recorder_member = self.create_captured_member(id.sym.as_ref());
                                    init = Some(Box::new(Expr::Bin(BinExpr {
                                        span: DUMMY_SP,
                                        op: BinaryOp::LogicalOr,
                                        left: Box::new(recorder_member),
                                        right: init_expr.clone(),
                                    })));
                                }
                            }
                        }
                    }
                    if self.should_capture_pattern(&decl.name) {
                        let declaration_kind = match var_decl.kind {
                            VarDeclKind::Var => "var",
                            VarDeclKind::Let => "let",
                            VarDeclKind::Const => "const",
                        };
                        let stmts =
                            self.transform_pattern_to_stmts(&decl.name, init.clone(), declaration_kind);
                        for stmt in stmts {
                            items.push(ModuleItem::Stmt(stmt));
                        }
                    } else {
                        let single_var = VarDecl {
                            span: var_decl.span,
                            ctxt: var_decl.ctxt,
                            kind: var_decl.kind,
                            declare: var_decl.declare,
                            decls: vec![VarDeclarator {
                                init,
                                ..decl.clone()
                            }],
                        };
                        items.push(ModuleItem::Stmt(Stmt::Decl(Decl::Var(Box::new(single_var)))));
                    }
                }

                items
            }
            ModuleItem::ModuleDecl(ModuleDecl::Import(import_decl)) => {
                if !self.capture_imports || import_decl.specifiers.is_empty() {
                    return vec![ModuleItem::ModuleDecl(ModuleDecl::Import(import_decl))];
                }
                let mut items = vec![ModuleItem::ModuleDecl(ModuleDecl::Import(import_decl.clone()))];
                for spec in &import_decl.specifiers {
                    let local = match spec {
                        ImportSpecifier::Named(named) => named.local.clone(),
                        ImportSpecifier::Default(def) => def.local.clone(),
                        ImportSpecifier::Namespace(ns) => ns.local.clone(),
                    };
                    let member = self.create_captured_member(local.sym.as_ref());
                    let assign = create_assign_expr(
                        expr_to_assign_target(member),
                        Expr::Ident(local),
                    );
                    items.push(ModuleItem::Stmt(Stmt::Expr(ExprStmt {
                        span: DUMMY_SP,
                        expr: Box::new(assign),
                    })));
                }
                items
            }
            ModuleItem::ModuleDecl(ModuleDecl::ExportNamed(export_decl)) => {
                if self.capture_imports && export_decl.src.is_some() {
                    let src = export_decl.src.as_ref().unwrap().value.to_string();
                    let mut import_specs = Vec::new();
                    let mut export_specs = Vec::new();
                    let mut assigns = Vec::new();

                    for spec in &export_decl.specifiers {
                        if let ExportSpecifier::Named(named) = spec {
                            let exported_name = match &named.exported {
                                Some(ModuleExportName::Ident(id)) => id.sym.to_string(),
                                Some(ModuleExportName::Str(s)) => s.value.to_string(),
                                None => match &named.orig {
                                    ModuleExportName::Ident(id) => id.sym.to_string(),
                                    ModuleExportName::Str(s) => s.value.to_string(),
                                },
                            };

                            let import_name = match &named.orig {
                                ModuleExportName::Ident(id) => id.sym.to_string(),
                                ModuleExportName::Str(s) => s.value.to_string(),
                            };

                            let local_name = if exported_name == "default" {
                                format!("__default_export_{}__", import_name)
                            } else {
                                exported_name.clone()
                            };

                            import_specs.push(ImportSpecifier::Named(ImportNamedSpecifier {
                                span: DUMMY_SP,
                                local: Ident::new(local_name.as_str().into(), DUMMY_SP, SyntaxContext::empty()),
                                imported: Some(ModuleExportName::Ident(Ident::new(import_name.as_str().into(), DUMMY_SP, SyntaxContext::empty()))),
                                is_type_only: false,
                            }));

                            export_specs.push(ExportSpecifier::Named(ExportNamedSpecifier {
                                span: DUMMY_SP,
                                orig: ModuleExportName::Ident(Ident::new(local_name.as_str().into(), DUMMY_SP, SyntaxContext::empty())),
                                exported: if exported_name == local_name { None } else {
                                    Some(ModuleExportName::Ident(Ident::new(exported_name.as_str().into(), DUMMY_SP, SyntaxContext::empty())))
                                },
                                is_type_only: false,
                            }));

                            let member = self.create_captured_member(&exported_name);
                            let assign = create_assign_expr(
                                expr_to_assign_target(member),
                                Expr::Ident(Ident::new(local_name.as_str().into(), DUMMY_SP, SyntaxContext::empty())),
                            );
                            assigns.push(ModuleItem::Stmt(Stmt::Expr(ExprStmt {
                                span: DUMMY_SP,
                                expr: Box::new(assign),
                            })));
                        }
                    }

                    let import_decl = ModuleItem::ModuleDecl(ModuleDecl::Import(ImportDecl {
                        span: DUMMY_SP,
                        specifiers: import_specs,
                        src: Box::new(Str { span: DUMMY_SP, value: src.clone().into(), raw: None }),
                        type_only: false,
                        with: None,
                        phase: Default::default(),
                    }));
                    let export_decl = ModuleItem::ModuleDecl(ModuleDecl::ExportNamed(NamedExport {
                        span: DUMMY_SP,
                        specifiers: export_specs,
                        src: None,
                        type_only: false,
                        with: None,
                    }));

                    let mut items = vec![import_decl, export_decl];
                    items.extend(assigns);
                    return items;
                }
                vec![ModuleItem::ModuleDecl(ModuleDecl::ExportNamed(export_decl))]
            }
            ModuleItem::ModuleDecl(ModuleDecl::ExportAll(export_all)) => {
                if self.capture_imports {
                    let src = export_all.src.value.to_string();
                    let tmp_name = format!("__captured_export_all_{}__", rand_id());
                    let import_decl = ModuleItem::ModuleDecl(ModuleDecl::Import(ImportDecl {
                        span: DUMMY_SP,
                        specifiers: vec![ImportSpecifier::Namespace(ImportStarAsSpecifier {
                            span: DUMMY_SP,
                            local: Ident::new(tmp_name.as_str().into(), DUMMY_SP, SyntaxContext::empty()),
                        })],
                        src: Box::new(Str { span: DUMMY_SP, value: src.into(), raw: None }),
                        type_only: false,
                        with: None,
                        phase: Default::default(),
                    }));
                    let assign = ModuleItem::Stmt(Stmt::Expr(ExprStmt {
                        span: DUMMY_SP,
                        expr: Box::new(create_call_expr(
                            create_member_expr(create_ident_expr("Object"), "assign"),
                            vec![
                                to_expr_or_spread(create_ident_expr(&self.capture_obj)),
                                to_expr_or_spread(create_ident_expr(&tmp_name)),
                            ],
                        )),
                    }));
                    return vec![
                        ModuleItem::ModuleDecl(ModuleDecl::ExportAll(export_all)),
                        import_decl,
                        assign,
                    ];
                }
                vec![ModuleItem::ModuleDecl(ModuleDecl::ExportAll(export_all))]
            }
            ModuleItem::ModuleDecl(ModuleDecl::ExportDecl(export_decl)) => {
                let mut items = vec![ModuleItem::ModuleDecl(ModuleDecl::ExportDecl(export_decl.clone()))];

                match &export_decl.decl {
                    Decl::Class(class_decl) => {
                        if self.should_capture(&class_decl.ident.to_id()) {
                            items.push(self.create_class_capture_assignment(class_decl));
                        }
                    }
                    Decl::Var(var_decl) => {
                        for decl in &var_decl.decls {
                            let ids = extract_idents_from_pat(&decl.name);
                            for (sym, ctxt) in ids {
                                let id = (sym.clone(), ctxt);
                                if !self.should_capture(&id) {
                                    continue;
                                }
                                let ident = Ident::new(sym, DUMMY_SP, ctxt);
                                let member = self.create_captured_member(ident.sym.as_ref());
                                let assign = create_assign_expr(
                                    expr_to_assign_target(member),
                                    Expr::Ident(ident),
                                );
                                items.push(ModuleItem::Stmt(Stmt::Expr(ExprStmt {
                                    span: DUMMY_SP,
                                    expr: Box::new(assign),
                                })));
                            }
                        }
                    }
                    _ => {}
                }

                items
            }
            ModuleItem::Stmt(Stmt::Decl(Decl::Fn(fn_decl))) => {
                vec![ModuleItem::Stmt(Stmt::Decl(Decl::Fn(fn_decl)))]
            }
            ModuleItem::Stmt(Stmt::Decl(Decl::Class(class_decl))) => {
                if self.should_capture(&class_decl.ident.to_id()) {
                    vec![
                        ModuleItem::Stmt(Stmt::Decl(Decl::Class(class_decl.clone()))),
                        self.create_class_capture_assignment(&class_decl),
                    ]
                } else {
                    vec![ModuleItem::Stmt(Stmt::Decl(Decl::Class(class_decl)))]
                }
            }
            other => vec![other],
        }
    }

    fn collect_declared_top_level_names(&self, module: &Module) -> HashSet<String> {
        let mut names = HashSet::new();
        for item in &module.body {
            match item {
                ModuleItem::Stmt(Stmt::Decl(Decl::Var(var_decl))) => {
                    for decl in &var_decl.decls {
                        for (sym, _) in extract_idents_from_pat(&decl.name) {
                            names.insert(sym.to_string());
                        }
                    }
                }
                ModuleItem::Stmt(Stmt::Decl(Decl::Fn(fn_decl))) => {
                    names.insert(fn_decl.ident.sym.to_string());
                }
                ModuleItem::Stmt(Stmt::Decl(Decl::Class(class_decl))) => {
                    names.insert(class_decl.ident.sym.to_string());
                }
                ModuleItem::ModuleDecl(ModuleDecl::Import(import_decl)) => {
                    for spec in &import_decl.specifiers {
                        match spec {
                            ImportSpecifier::Named(named) => {
                                names.insert(named.local.sym.to_string());
                            }
                            ImportSpecifier::Default(def) => {
                                names.insert(def.local.sym.to_string());
                            }
                            ImportSpecifier::Namespace(ns) => {
                                names.insert(ns.local.sym.to_string());
                            }
                        }
                    }
                }
                ModuleItem::ModuleDecl(ModuleDecl::ExportDecl(export_decl)) => match &export_decl.decl {
                    Decl::Var(var_decl) => {
                        for decl in &var_decl.decls {
                            for (sym, _) in extract_idents_from_pat(&decl.name) {
                                names.insert(sym.to_string());
                            }
                        }
                    }
                    Decl::Fn(fn_decl) => {
                        names.insert(fn_decl.ident.sym.to_string());
                    }
                    Decl::Class(class_decl) => {
                        names.insert(class_decl.ident.sym.to_string());
                    }
                    _ => {}
                },
                _ => {}
            }
        }
        names
    }

    /// JS parity: insert binding declarations for export specifiers whose locals
    /// were rewritten to recorder assignments (e.g. `export { oe as default }`).
    fn insert_declarations_for_exports(&self, module: &mut Module) {
        let mut declared = self.collect_declared_top_level_names(module);
        let mut new_body = Vec::with_capacity(module.body.len());

        for item in module.body.drain(..) {
            match &item {
                ModuleItem::ModuleDecl(ModuleDecl::ExportNamed(export_decl))
                    if export_decl.src.is_none() && !export_decl.specifiers.is_empty() =>
                {
                    for spec in &export_decl.specifiers {
                        let ExportSpecifier::Named(named) = spec else {
                            continue;
                        };
                        let ModuleExportName::Ident(local_ident) = &named.orig else {
                            continue;
                        };
                        let local_name = local_ident.sym.to_string();
                        if declared.contains(&local_name) {
                            continue;
                        }
                        let decl = ModuleItem::Stmt(Stmt::Decl(create_var_decl(
                            VarDeclKind::Var,
                            &local_name,
                            Some(self.create_captured_member(&local_name)),
                        )));
                        new_body.push(decl);
                        declared.insert(local_name);
                    }
                }
                ModuleItem::ModuleDecl(ModuleDecl::ExportDefaultExpr(export_default)) => {
                    if let Expr::Ident(local_ident) = &*export_default.expr {
                        let local_name = local_ident.sym.to_string();
                        if !declared.contains(&local_name) {
                            let decl = ModuleItem::Stmt(Stmt::Decl(create_var_decl(
                                VarDeclKind::Var,
                                &local_name,
                                Some(self.create_captured_member(&local_name)),
                            )));
                            new_body.push(decl);
                            declared.insert(local_name);
                        }
                    }
                }
                _ => {}
            }

            new_body.push(item);
        }

        module.body = new_body;
    }
}

impl VisitMut for ScopeCapturingTransform {
    fn visit_mut_module(&mut self, module: &mut Module) {
        // First pass: analyze scope to determine capturable variables
        let mut analyzer = ScopeAnalyzer::new();
        use swc_core::ecma::visit::VisitWith;
        module.visit_with(&mut analyzer);

        self.imported_vars.clear();
        for item in &module.body {
            if let ModuleItem::ModuleDecl(ModuleDecl::Import(import_decl)) = item {
                for spec in &import_decl.specifiers {
                    let id = match spec {
                        ImportSpecifier::Named(named) => named.local.to_id(),
                        ImportSpecifier::Default(def) => def.local.to_id(),
                        ImportSpecifier::Namespace(ns) => ns.local.to_id(),
                    };
                    self.imported_vars.insert(id);
                }
            }
        }

        let has_local_lively_binding = analyzer
            .top_level_vars
            .iter()
            .any(|id| id.0.as_ref() == "lively");
        let has_capture_obj_binding = analyzer
            .top_level_vars
            .iter()
            .any(|id| id.0.as_ref() == self.capture_obj.as_str());

        self.capturable_vars = analyzer
            .top_level_vars
            .into_iter()
            .filter(|id| !self.excluded.contains(id.0.as_ref()))
            .collect();

        // Second pass: transform the module
        self.depth = 0;
        self.hoisted_function_captures.clear();
        for item in &module.body {
            self.collect_hoisted_function_capture(item);
        }

        let mut new_body = Vec::with_capacity(module.body.len());
        for item in module.body.drain(..) {
            let mut transformed_items = self.transform_module_item(item);
            for transformed in &mut transformed_items {
                transformed.visit_mut_children_with(self);
            }
            new_body.extend(transformed_items);
        }
        module.body = new_body;
        self.insert_declarations_for_exports(module);

        // Ensure the capture object exists for generated __varRecorder__ references.
        let mut inserted_recorder_init = false;
        if !has_capture_obj_binding {
            self.insert_recorder_init(module, has_local_lively_binding);
            inserted_recorder_init = true;
        }

        self.insert_hoisted_function_captures(module, inserted_recorder_init);
    }

    fn visit_mut_module_item(&mut self, item: &mut ModuleItem) {
        if !self.is_module_level() {
            item.visit_mut_children_with(self);
            return;
        }

        item.visit_mut_children_with(self);
    }

    fn visit_mut_expr(&mut self, expr: &mut Expr) {
        // Transform identifier references to captured members
        match expr {
            Expr::Assign(assign) => {
                // Keep generated import-capture assignments intact:
                // __varRecorder__.x = x
                if let (
                    AssignTarget::Simple(SimpleAssignTarget::Member(MemberExpr {
                        obj,
                        prop: MemberProp::Ident(prop_ident),
                        ..
                    })),
                    Expr::Ident(right_ident),
                ) = (&assign.left, &*assign.right)
                {
                    if let Expr::Ident(obj_ident) = &**obj {
                        if obj_ident.sym.as_ref() == self.capture_obj && prop_ident.sym == right_ident.sym {
                            return;
                        }
                    }
                }
            }
            Expr::Ident(ident) => {
                if self.should_capture(&ident.to_id()) {
                    *expr = self.create_captured_member(ident.sym.as_ref());
                    return;
                }
            }
            Expr::MetaProp(MetaPropExpr {
                kind: MetaPropKind::ImportMeta,
                ..
            }) => {
                *expr = self.create_import_meta_expr();
                return;
            }
            _ => {}
        }

        expr.visit_mut_children_with(self);
    }

    fn visit_mut_assign_expr(&mut self, assign: &mut AssignExpr) {
        if let AssignTarget::Simple(SimpleAssignTarget::Ident(binding_ident)) = &assign.left {
            let id = binding_ident.id.to_id();
            if self.should_capture(&id) {
                let member = self.create_captured_member(binding_ident.id.sym.as_ref());
                assign.left = expr_to_assign_target(member);
            }
        }

        assign.visit_mut_children_with(self);
    }

    fn visit_mut_update_expr(&mut self, update: &mut UpdateExpr) {
        if let Expr::Ident(ident) = &*update.arg {
            if self.should_capture(&ident.to_id()) {
                update.arg = Box::new(self.create_captured_member(ident.sym.as_ref()));
            }
        }

        update.visit_mut_children_with(self);
    }

    fn visit_mut_prop(&mut self, prop: &mut Prop) {
        if let Prop::Shorthand(ident) = prop {
            if self.should_capture(&ident.to_id()) {
                let key = PropName::Ident(ident.clone().into());
                let value = Box::new(self.create_captured_member(ident.sym.as_ref()));
                *prop = Prop::KeyValue(KeyValueProp { key, value });
                return;
            }
        }

        prop.visit_mut_children_with(self);
    }

    // Scope tracking for nested functions/blocks
    fn visit_mut_function(&mut self, func: &mut Function) {
        self.enter_scope(true);
        for param in &func.params {
            self.declare_pattern_in_current_scope(&param.pat);
        }
        func.visit_mut_children_with(self);
        self.exit_scope();
    }

    fn visit_mut_arrow_expr(&mut self, arrow: &mut ArrowExpr) {
        self.enter_scope(true);
        for param in &arrow.params {
            self.declare_pattern_in_current_scope(param);
        }
        arrow.visit_mut_children_with(self);
        self.exit_scope();
    }

    fn visit_mut_block_stmt(&mut self, block: &mut BlockStmt) {
        self.enter_scope(false);
        block.visit_mut_children_with(self);
        self.exit_scope();
    }

    fn visit_mut_var_decl(&mut self, var_decl: &mut VarDecl) {
        let mut current_names = HashSet::new();
        for decl in &var_decl.decls {
            for (sym, _) in extract_idents_from_pat(&decl.name) {
                current_names.insert(sym.to_string());
            }
        }
        self.current_var_decl_stack.push(current_names);

        if self.depth > 0 {
            for decl in &var_decl.decls {
                if matches!(var_decl.kind, VarDeclKind::Var) {
                    for (sym, _) in extract_idents_from_pat(&decl.name) {
                        self.declare_in_nearest_function_scope(sym.as_ref());
                    }
                } else {
                    self.declare_pattern_in_current_scope(&decl.name);
                }
            }
        }
        var_decl.visit_mut_children_with(self);
        self.current_var_decl_stack.pop();
    }

    fn visit_mut_fn_expr(&mut self, fn_expr: &mut FnExpr) {
        self.enter_scope(true);
        if let Some(ident) = &fn_expr.ident {
            self.declare_in_current_scope(ident.sym.as_ref());
        }
        fn_expr.function.visit_mut_children_with(self);
        self.exit_scope();
    }

    fn visit_mut_fn_decl(&mut self, fn_decl: &mut FnDecl) {
        if self.depth > 0 {
            self.declare_in_current_scope(fn_decl.ident.sym.as_ref());
        }
        fn_decl.visit_mut_children_with(self);
    }

    fn visit_mut_class_decl(&mut self, class_decl: &mut ClassDecl) {
        if self.depth > 0 {
            self.declare_in_current_scope(class_decl.ident.sym.as_ref());
        }
        class_decl.visit_mut_children_with(self);
    }

    fn visit_mut_catch_clause(&mut self, catch: &mut CatchClause) {
        self.enter_scope(false);
        if let Some(param) = &catch.param {
            self.declare_pattern_in_current_scope(param);
        }
        catch.visit_mut_children_with(self);
        self.exit_scope();
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
            "test.js".to_string(),
            None,
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
    fn test_export_var_capture() {
        let output = transform_code("export const Color = 23;");
        assert!(output.contains("export const Color = 23;"));
        assert!(output.contains("__varRecorder__.Color = Color"));
    }

    #[test]
    fn test_excluded_var() {
        let output = transform_code("console.log('hello');");
        assert!(!output.contains("__varRecorder__.console"));
    }

    #[test]
    fn test_same_var_decl_initializer_uses_local_binding() {
        let output = transform_code("if (true) var xe = 1, Ue = xe + 1;");
        assert!(output.contains("xe + 1"));
        assert!(!output.contains("__varRecorder__.xe + 1"));
    }
}
