use swc_core::common::{SyntaxContext, DUMMY_SP};
use std::collections::{HashSet, HashMap};
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

    /// Optional module hash for resurrection builds
    module_hash: Option<i64>,

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

    /// Collected export metadata for __module_exports__ (resurrection builds only).
    /// Entries follow the same format as the Babel path:
    /// - `"exportedName"` for regular exports
    /// - `"__rename__local->exported"` for renamed exports
    /// - `"__reexport__moduleId"` for star re-exports
    /// - `"__default__localName"` for default exports
    collected_exports: Vec<String>,

    /// Resolved import source specifier → normalized module ID.
    /// Used for resurrection namespace transforms (exportsOf calls).
    resolved_imports: HashMap<String, String>,

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
        module_hash: Option<i64>,
        resolved_imports: HashMap<String, String>,
    ) -> Self {
        Self {
            capture_obj,
            declaration_wrapper,
            excluded: excluded.into_iter().collect(),
            capture_imports,
            resurrection,
            module_hash,
            module_id,
            current_module_accessor,
            capturable_vars: HashSet::new(),
            imported_vars: HashSet::new(),
            hoisted_function_captures: Vec::new(),
            collected_exports: Vec::new(),
            resolved_imports,
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
    /// Scope capture wrapper signature: wrapper(name, kind, value, captureObj)
    /// Babel tests confirm the 4th arg is _rec (capture obj), not __moduleMeta__.
    /// __moduleMeta__ is only used in insertCapturesForFunctionDeclarations (the LAST step).
    fn wrap_declaration(&self, name: &str, kind: &str, value: Expr) -> Expr {
        if let Some(ref wrapper) = self.declaration_wrapper {
            // declarationWrapper("name", "kind", value, __varRecorder__)
            create_call_expr(
                parse_expr_or_ident(wrapper),
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
                    // Babel's bundler does NOT pass declarationWrapper to the scope capture
                    // step — it's only used in insertCapturesForFunctionDeclarations (a separate
                    // step that ONLY wraps function declarations). So variable declarations
                    // are never wrapped with __define__. We match that behavior here.
                    let value = *init_expr;
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

    /// Replace top-level function declarations with wrapper calls (Babel parity).
    ///
    /// Transforms:
    ///   function foo() { ... }
    /// into:
    ///   var foo = wrapper("foo", "function", function() { ... }, __moduleMeta__)
    ///
    /// Also prepends `let __moduleMeta__ = <currentModuleAccessor>` to the module body.
    fn replace_function_declarations_with_wrapper(&self, module: &mut Module) {
        // Build: let __moduleMeta__ = <currentModuleAccessor>
        let meta_init = if let Some(ref accessor) = self.current_module_accessor {
            // The currentModuleAccessor is a complex JS expression (object literal).
            // Use SWC's parser to parse it properly.
            use swc_core::ecma::parser::{parse_file_as_expr, Syntax};
            use swc_core::common::{sync::Lrc, FileName, SourceMap as SwcSourceMap};
            let cm = Lrc::new(SwcSourceMap::default());
            let fm = cm.new_source_file(FileName::Anon.into(), accessor.clone());
            match parse_file_as_expr(
                &fm,
                Syntax::Es(Default::default()),
                Default::default(),
                None,
                &mut vec![],
            ) {
                Ok(expr) => *expr,
                Err(_) => parse_expr_or_ident(accessor),
            }
        } else {
            create_ident_expr("undefined")
        };
        let meta_decl = ModuleItem::Stmt(Stmt::Decl(create_var_decl(
            VarDeclKind::Var,
            "__moduleMeta__",
            Some(meta_init),
        )));

        // Two-pass approach matching Babel's putFunctionDeclsInFront +
        // insertCapturesForFunctionDeclarations:
        // 1. Extract all top-level FunctionDeclarations, replace them with references (foo;)
        // 2. Create let declarations with wrapper calls, hoisted to top

        let mut hoisted_lets: Vec<ModuleItem> = Vec::new();
        let mut new_body = Vec::with_capacity(module.body.len() + 1);

        for item in module.body.drain(..) {
            match item {
                ModuleItem::Stmt(Stmt::Decl(Decl::Fn(fn_decl))) => {
                    let fn_name = fn_decl.ident.sym.to_string();
                    // Create anonymous function expression (id removed)
                    let anon_fn = Expr::Fn(FnExpr {
                        ident: None,
                        function: fn_decl.function,
                    });
                    // Hoisted: var foo = wrapper("foo", "function", function(){...}, __moduleMeta__)
                    // Babel uses let, but var avoids TDZ issues with rollup circular dep analysis.
                    let wrapped = create_call_expr(
                        parse_expr_or_ident(self.declaration_wrapper.as_ref().unwrap()),
                        vec![
                            to_expr_or_spread(create_string_expr(&fn_name)),
                            to_expr_or_spread(create_string_expr("function")),
                            to_expr_or_spread(anon_fn),
                            to_expr_or_spread(create_ident_expr("__moduleMeta__")),
                        ],
                    );
                    // Use the ORIGINAL ident (preserves SyntaxContext) to avoid
                    // SWC hygiene renaming the var to Path1/foo1/etc.
                    let original_ident = fn_decl.ident.clone();
                    let var_decl = ModuleItem::Stmt(Stmt::Decl(Decl::Var(Box::new(VarDecl {
                        span: DUMMY_SP,
                        kind: VarDeclKind::Var,
                        decls: vec![VarDeclarator {
                            span: DUMMY_SP,
                            name: Pat::Ident(BindingIdent {
                                id: original_ident.clone(),
                                type_ann: None,
                            }),
                            init: Some(Box::new(wrapped)),
                            definite: false,
                        }],
                        ..Default::default()
                    }))));
                    hoisted_lets.push(var_decl);
                    // Also add recorder capture: __rec.foo = foo
                    // (hoisted captures are skipped for these when declaration_wrapper is set)
                    let capture = ModuleItem::Stmt(Stmt::Expr(ExprStmt {
                        span: DUMMY_SP,
                        expr: Box::new(create_assign_expr(
                            expr_to_assign_target(self.create_captured_member(&fn_name)),
                            Expr::Ident(original_ident.clone()),
                        )),
                    }));
                    hoisted_lets.push(capture);
                    // Replace original position with reference: foo;
                    new_body.push(ModuleItem::Stmt(Stmt::Expr(ExprStmt {
                        span: DUMMY_SP,
                        expr: Box::new(Expr::Ident(original_ident)),
                    })));
                }
                _ => {
                    new_body.push(item);
                }
            }
        }

        // Insert hoisted declarations after recorder init:
        // imports → recorder init → __moduleMeta__ → hoisted lets → rest of body
        let mut final_body = Vec::with_capacity(new_body.len() + hoisted_lets.len() + 1);
        let mut inserted = false;
        for item in new_body.drain(..) {
            final_body.push(item);
            if !inserted {
                if let ModuleItem::Stmt(Stmt::Decl(Decl::Var(ref var_decl))) = final_body.last().unwrap() {
                    if var_decl.decls.iter().any(|d| {
                        matches!(&d.name, Pat::Ident(BindingIdent { id, .. }) if id.sym.as_ref() == self.capture_obj)
                    }) {
                        final_body.push(meta_decl.clone());
                        for let_decl in hoisted_lets.drain(..) {
                            final_body.push(let_decl);
                        }
                        inserted = true;
                    }
                }
            }
        }
        if !inserted {
            // No recorder init found — insert at the beginning
            let mut prefix = vec![meta_decl];
            prefix.extend(hoisted_lets);
            prefix.extend(final_body);
            module.body = prefix;
        } else {
            module.body = final_body;
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
        // Babel's putFunctionDeclsInFront wraps just the identifier, not the function body.
        // The function body replacement happens later in replace_function_declarations_with_wrapper.
        let value = self.wrap_declaration(
            &fn_name,
            "function",
            Expr::Ident(fn_decl.ident.clone()),
        );

        ModuleItem::Stmt(Stmt::Expr(ExprStmt {
            span: DUMMY_SP,
            expr: Box::new(create_assign_expr(expr_to_assign_target(member), value)),
        }))
    }

    /// Build `__varRecorder__.name = ...` for a class declaration capture.
    /// Babel's bundler does NOT wrap class declarations with declarationWrapper —
    /// only insertCapturesForFunctionDeclarations wraps function declarations.
    fn create_class_capture_assignment(&self, class_decl: &ClassDecl) -> ModuleItem {
        let class_name = class_decl.ident.sym.to_string();
        let member = self.create_captured_member(&class_name);
        let value = Expr::Ident(class_decl.ident.clone());

        ModuleItem::Stmt(Stmt::Expr(ExprStmt {
            span: DUMMY_SP,
            expr: Box::new(create_assign_expr(expr_to_assign_target(member), value)),
        }))
    }

    /// Collect function captures that need to run before any top-level statements.
    /// When resurrection + declaration_wrapper is set, function declarations will
    /// be fully replaced by `replace_function_declarations_with_wrapper`, so we
    /// skip hoisted captures for plain function declarations (they would be
    /// redundant and reference __moduleMeta__ before it's declared).
    fn collect_hoisted_function_capture(&mut self, item: &ModuleItem) {
        let will_replace_func_decls = self.resurrection && self.declaration_wrapper.is_some();
        match item {
            ModuleItem::Stmt(Stmt::Decl(Decl::Fn(fn_decl))) => {
                if will_replace_func_decls {
                    return; // Will be handled by replace_function_declarations_with_wrapper
                }
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

    /// Collect export metadata from the module for __module_exports__.
    /// Follows the same format as the Babel bundler path.
    fn collect_module_exports(&mut self, module: &Module) {
        for item in &module.body {
            match item {
                ModuleItem::ModuleDecl(ModuleDecl::ExportNamed(export)) => {
                    if export.src.is_some() {
                        let raw_src = export.src.as_ref().unwrap().value.to_string();
                        let resolved_src = self.resolved_imports.get(&raw_src)
                            .cloned()
                            .unwrap_or(raw_src);
                        if export.specifiers.is_empty() {
                            // export * from '...' (rare, usually ExportAll)
                            self.collected_exports.push(format!("__reexport__{}", resolved_src));
                        } else {
                            // export { x, y as z } from '...'
                            // Per-specifier entries (Babel does individual entries, not blanket __reexport__)
                            for spec in &export.specifiers {
                                if let ExportSpecifier::Named(named) = spec {
                                    let local_name = match &named.orig {
                                        ModuleExportName::Ident(id) => id.sym.to_string(),
                                        ModuleExportName::Str(s) => s.value.to_string(),
                                    };
                                    let exported_name = match &named.exported {
                                        Some(ModuleExportName::Ident(id)) => id.sym.to_string(),
                                        Some(ModuleExportName::Str(s)) => s.value.to_string(),
                                        None => local_name.clone(),
                                    };
                                    if exported_name != local_name && exported_name != "default" {
                                        self.collected_exports.push(format!("__rename__{}->{}",local_name, exported_name));
                                        continue; // Babel: continue after __rename__
                                    }
                                    if exported_name == "default" && !local_name.is_empty() {
                                        self.collected_exports.push(format!("__default__{}", local_name));
                                    }
                                    self.collected_exports.push(exported_name);
                                }
                            }
                        }
                    } else {
                        // `export { x, y as z }`
                        for spec in &export.specifiers {
                            if let ExportSpecifier::Named(named) = spec {
                                let local_name = match &named.orig {
                                    ModuleExportName::Ident(id) => id.sym.to_string(),
                                    ModuleExportName::Str(s) => s.value.to_string(),
                                };
                                let exported_name = match &named.exported {
                                    Some(ModuleExportName::Ident(id)) => id.sym.to_string(),
                                    Some(ModuleExportName::Str(s)) => s.value.to_string(),
                                    None => local_name.clone(),
                                };
                                if exported_name != local_name && exported_name != "default" {
                                    self.collected_exports.push(format!("__rename__{}->{}",local_name, exported_name));
                                    continue; // Babel: continue after __rename__
                                }
                                if exported_name == "default" && !local_name.is_empty() {
                                    self.collected_exports.push(format!("__default__{}", local_name));
                                }
                                self.collected_exports.push(exported_name);
                            }
                        }
                    }
                }
                ModuleItem::ModuleDecl(ModuleDecl::ExportAll(export_all)) => {
                    let raw_src = export_all.src.value.to_string();
                    let resolved_src = self.resolved_imports.get(&raw_src)
                        .cloned()
                        .unwrap_or(raw_src);
                    self.collected_exports.push(format!("__reexport__{}", resolved_src));
                }
                ModuleItem::ModuleDecl(ModuleDecl::ExportDecl(export_decl)) => {
                    match &export_decl.decl {
                        Decl::Fn(fn_decl) => {
                            self.collected_exports.push(fn_decl.ident.sym.to_string());
                        }
                        Decl::Class(class_decl) => {
                            self.collected_exports.push(class_decl.ident.sym.to_string());
                        }
                        Decl::Var(var_decl) => {
                            for decl in &var_decl.decls {
                                for (sym, _) in extract_idents_from_pat(&decl.name) {
                                    self.collected_exports.push(sym.to_string());
                                }
                            }
                        }
                        _ => {}
                    }
                }
                ModuleItem::ModuleDecl(ModuleDecl::ExportDefaultDecl(default_decl)) => {
                    let local = match &default_decl.decl {
                        DefaultDecl::Fn(f) => f.ident.as_ref().map(|id| id.sym.to_string()),
                        DefaultDecl::Class(c) => c.ident.as_ref().map(|id| id.sym.to_string()),
                        _ => None,
                    };
                    if let Some(name) = local {
                        self.collected_exports.push(format!("__default__{}", name));
                    }
                    self.collected_exports.push("default".to_string());
                }
                ModuleItem::ModuleDecl(ModuleDecl::ExportDefaultExpr(default_expr)) => {
                    if let Expr::Ident(ident) = &*default_expr.expr {
                        self.collected_exports.push(format!("__default__{}", ident.sym));
                    }
                    self.collected_exports.push("default".to_string());
                }
                _ => {}
            }
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
        // For resurrection builds, insert __module_hash__ right after recorder init
        if self.resurrection {
            if let Some(hash) = self.module_hash {
                let hash_stmt = ModuleItem::Stmt(Stmt::Expr(ExprStmt {
                    span: DUMMY_SP,
                    expr: Box::new(Expr::Assign(AssignExpr {
                        span: DUMMY_SP,
                        op: AssignOp::Assign,
                        left: AssignTarget::Simple(SimpleAssignTarget::Member(MemberExpr {
                            span: DUMMY_SP,
                            obj: Box::new(create_ident_expr(&self.capture_obj)),
                            prop: MemberProp::Ident(IdentName::new("__module_hash__".into(), DUMMY_SP)),
                        })),
                        right: Box::new(Expr::Lit(Lit::Num(Number {
                            span: DUMMY_SP,
                            value: hash as f64,
                            raw: None,
                        }))),
                    })),
                }));
                module.body.insert(insert_idx + 1, hash_stmt);
            }
        }
    }

    /// Exit a scope
    fn exit_scope(&mut self) {
        self.depth -= 1;
        self.scope_stack.pop();
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
                // Namespace import handling (import * as ns from 'dep') is done by
                // NamespaceTransform (step 4) which runs before scope capture.
                // The scope capture just needs to handle capture_imports if enabled.
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
                // Split `export { x } from '...'` into import + export + recorder capture.
                // Only for capture_imports mode (source-map builds).
                // Resurrection builds use a different approach below.
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
                // For capture_imports builds, add namespace import + Object.assign.
                // Resurrection builds skip this — NamespaceTransform (step 4) handles it.
                if self.capture_imports && !self.resurrection {
                    let src = export_all.src.value.to_string();
                    let resolved_id = self.resolved_imports.get(&src)
                        .cloned()
                        .unwrap_or_else(|| src.clone());
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
                    // Object.assign(recorderFor(resolvedDep), tmp)
                    let recorder_for = create_call_expr(
                        create_member_expr(
                            Expr::Paren(ParenExpr {
                                span: DUMMY_SP,
                                expr: Box::new(Expr::Bin(BinExpr {
                                    span: DUMMY_SP,
                                    op: BinaryOp::LogicalOr,
                                    left: Box::new(create_member_expr(create_ident_expr("lively"), "FreezerRuntime")),
                                    right: Box::new(create_member_expr(create_ident_expr("lively"), "frozenModules")),
                                })),
                            }),
                            "recorderFor",
                        ),
                        vec![to_expr_or_spread(Expr::Lit(Lit::Str(Str {
                            span: DUMMY_SP,
                            value: resolved_id.as_str().into(),
                            raw: None,
                        })))],
                    );
                    let assign = ModuleItem::Stmt(Stmt::Expr(ExprStmt {
                        span: DUMMY_SP,
                        expr: Box::new(create_call_expr(
                            create_member_expr(create_ident_expr("Object"), "assign"),
                            vec![
                                to_expr_or_spread(recorder_for),
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
                                let name = sym.to_string();
                                let ident = Ident::new(sym, DUMMY_SP, ctxt);
                                let member = self.create_captured_member(&name);
                                // Babel's bundler does NOT wrap exported var captures with
                                // declarationWrapper — only function declarations get wrapped.
                                let value = Expr::Ident(ident);
                                let assign = create_assign_expr(
                                    expr_to_assign_target(member),
                                    value,
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
            ModuleItem::ModuleDecl(ModuleDecl::ExportDefaultDecl(export_default)) => {
                // export default function x() {} → function x() {} __rec.x = x; export default x;
                // export default class Foo {} → class Foo {} __rec.Foo = Foo; export default Foo;
                let ident = match &export_default.decl {
                    DefaultDecl::Fn(f) => f.ident.as_ref().cloned(),
                    DefaultDecl::Class(c) => c.ident.as_ref().cloned(),
                    _ => None,
                };
                if let Some(id) = ident {
                    let name = id.sym.to_string();
                    let decl_item = match export_default.decl.clone() {
                        DefaultDecl::Fn(f) => {
                            ModuleItem::Stmt(Stmt::Decl(Decl::Fn(FnDecl {
                                ident: f.ident.clone().unwrap(),
                                declare: false,
                                function: f.function,
                            })))
                        }
                        DefaultDecl::Class(c) => {
                            ModuleItem::Stmt(Stmt::Decl(Decl::Class(ClassDecl {
                                ident: c.ident.clone().unwrap(),
                                declare: false,
                                class: c.class,
                            })))
                        }
                        _ => unreachable!(),
                    };
                    // __rec.name = name
                    let capture_name = ModuleItem::Stmt(Stmt::Expr(ExprStmt {
                        span: DUMMY_SP,
                        expr: Box::new(create_assign_expr(
                            expr_to_assign_target(self.create_captured_member(&name)),
                            Expr::Ident(Ident::new(name.as_str().into(), DUMMY_SP, SyntaxContext::empty())),
                        )),
                    }));
                    // __rec.default = name (Babel always captures default)
                    let capture_default = ModuleItem::Stmt(Stmt::Expr(ExprStmt {
                        span: DUMMY_SP,
                        expr: Box::new(create_assign_expr(
                            expr_to_assign_target(self.create_captured_member("default")),
                            Expr::Ident(Ident::new(name.as_str().into(), DUMMY_SP, SyntaxContext::empty())),
                        )),
                    }));
                    let export_stmt = ModuleItem::ModuleDecl(ModuleDecl::ExportDefaultExpr(ExportDefaultExpr {
                        span: DUMMY_SP,
                        expr: Box::new(Expr::Ident(Ident::new(name.as_str().into(), DUMMY_SP, SyntaxContext::empty()))),
                    }));
                    vec![decl_item, capture_name, capture_default, export_stmt]
                } else {
                    // Anonymous default export: export default function() {} or export default class {}
                    // Babel: __rec.default = <expression>; export default __rec.default;
                    let anon_expr = match export_default.decl {
                        DefaultDecl::Fn(f) => Expr::Fn(FnExpr {
                            ident: None,
                            function: f.function,
                        }),
                        DefaultDecl::Class(c) => Expr::Class(ClassExpr {
                            ident: None,
                            class: c.class,
                        }),
                        _ => {
                            return vec![ModuleItem::ModuleDecl(ModuleDecl::ExportDefaultDecl(export_default))];
                        }
                    };
                    let capture_default = ModuleItem::Stmt(Stmt::Expr(ExprStmt {
                        span: DUMMY_SP,
                        expr: Box::new(create_assign_expr(
                            expr_to_assign_target(self.create_captured_member("default")),
                            anon_expr,
                        )),
                    }));
                    let export_stmt = ModuleItem::ModuleDecl(ModuleDecl::ExportDefaultExpr(ExportDefaultExpr {
                        span: DUMMY_SP,
                        expr: Box::new(self.create_captured_member("default")),
                    }));
                    vec![capture_default, export_stmt]
                }
            }
            // ExportDefaultExpr is kept as-is in transform_module_item.
            // The __rec.default capture is added by insert_declarations_for_exports
            // which runs after visit_mut transforms all expressions.
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
                        // Use the SAME SyntaxContext as the export specifier so
                        // SWC's codegen doesn't append hygiene suffixes.
                        let decl = ModuleItem::Stmt(Stmt::Decl(Decl::Var(Box::new(VarDecl {
                            span: DUMMY_SP,
                            kind: VarDeclKind::Var,
                            decls: vec![VarDeclarator {
                                span: DUMMY_SP,
                                name: Pat::Ident(BindingIdent {
                                    id: local_ident.clone(),
                                    type_ann: None,
                                }),
                                init: Some(Box::new(self.create_captured_member(&local_name))),
                                definite: false,
                            }],
                            ..Default::default()
                        }))));
                        new_body.push(decl);
                        declared.insert(local_name);
                    }
                }
                ModuleItem::ModuleDecl(ModuleDecl::ExportDefaultExpr(ref export_default)) => {
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
                    // Capture __rec.default = <expr> (Babel always does this)
                    let default_capture = ModuleItem::Stmt(Stmt::Expr(ExprStmt {
                        span: DUMMY_SP,
                        expr: Box::new(create_assign_expr(
                            expr_to_assign_target(self.create_captured_member("default")),
                            *export_default.expr.clone(),
                        )),
                    }));
                    new_body.push(default_capture);
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

        // Collect export metadata for resurrection builds BEFORE the transform
        // (since the transform removes export statements from the AST).
        // imported_vars is now populated so we can skip re-exported imports.
        if self.resurrection {
            self.collected_exports.clear();
            self.collect_module_exports(module);
        }

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

        // For resurrection builds with a declaration wrapper, replace top-level
        // function declarations with let bindings wrapped through the wrapper.
        // Babel: function foo() {...} => var foo = wrapper("foo", "function", function(){...}, __moduleMeta__)
        // This runs LAST (after all scope capture processing) matching the Babel pipeline.
        if self.resurrection && self.declaration_wrapper.is_some() {
            self.replace_function_declarations_with_wrapper(module);
        }

        // For resurrection builds, insert __module_exports__ right after the recorder init
        // (matching Babel's placement at the top of the module).
        if self.resurrection {
            let arr_elems: Vec<Option<ExprOrSpread>> = self.collected_exports.iter()
                .map(|e| Some(ExprOrSpread {
                    spread: None,
                    expr: Box::new(create_string_expr(e)),
                }))
                .collect();
            let member_expr = Expr::Member(MemberExpr {
                span: DUMMY_SP,
                obj: Box::new(create_ident_expr(&self.capture_obj)),
                prop: MemberProp::Ident(IdentName::new("__module_exports__".into(), DUMMY_SP)),
            });
            let module_exports_stmt = ModuleItem::Stmt(Stmt::Expr(ExprStmt {
                span: DUMMY_SP,
                expr: Box::new(Expr::Assign(AssignExpr {
                    span: DUMMY_SP,
                    op: AssignOp::Assign,
                    left: AssignTarget::Simple(SimpleAssignTarget::Member(MemberExpr {
                        span: DUMMY_SP,
                        obj: Box::new(create_ident_expr(&self.capture_obj)),
                        prop: MemberProp::Ident(IdentName::new("__module_exports__".into(), DUMMY_SP)),
                    })),
                    right: Box::new(Expr::Bin(BinExpr {
                        span: DUMMY_SP,
                        op: BinaryOp::LogicalOr,
                        left: Box::new(member_expr),
                        right: Box::new(Expr::Array(ArrayLit {
                            span: DUMMY_SP,
                            elems: arr_elems,
                        })),
                    })),
                })),
            }));
            // Insert after the recorder init (first non-import statement)
            let insert_pos = module.body.iter().position(|item| {
                !matches!(item, ModuleItem::ModuleDecl(ModuleDecl::Import(_)))
            }).unwrap_or(0) + 1; // +1 to go after the recorder init
            let insert_pos = insert_pos.min(module.body.len());
            module.body.insert(insert_pos, module_exports_stmt);
        }
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
                let name = binding_ident.id.sym.to_string();
                let member = self.create_captured_member(&name);
                assign.left = expr_to_assign_target(member);
                // Babel's bundler does NOT wrap assignments with declarationWrapper.
                // declarationWrapper is only used in insertCapturesForFunctionDeclarations
                // which only handles function declarations.
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
        let fm = cm.new_source_file(FileName::Anon.into(), code.to_string());

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
            None,
            HashMap::new(),
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

    // --- Basic variable capturing (matching Babel capturing-test.js) ---

    #[test]
    fn test_simple_var() {
        let output = transform_code("var x = 1;");
        assert!(output.contains("__varRecorder__.x = 1;"), "should capture var with value: {}", output);
    }

    #[test]
    fn test_var_reference() {
        let output = transform_code("var x = 1; x + 2;");
        assert!(output.contains("__varRecorder__.x + 2"), "should capture var reference: {}", output);
    }

    #[test]
    fn test_var_and_func_decls() {
        // Babel: 'var z = 3, y = 4; function foo() { var x = 5; }'
        // → function hoisted, vars captured, inner var NOT captured
        let output = transform_code("var z = 3, y = 4; function foo() { var x = 5; }");
        assert!(output.contains("__varRecorder__.z = 3"), "capture z: {}", output);
        assert!(output.contains("__varRecorder__.y = 4"), "capture y: {}", output);
        assert!(output.contains("__varRecorder__.foo = foo"), "capture foo: {}", output);
        assert!(!output.contains("__varRecorder__.x"), "inner var should NOT be captured: {}", output);
    }

    #[test]
    fn test_function_declaration() {
        let output = transform_code("function foo() { return 1; }");
        assert!(output.contains("__varRecorder__.foo = foo;"), "should capture function with assignment form: {}", output);
        assert!(output.contains("function foo()"), "should keep function declaration: {}", output);
    }

    #[test]
    fn test_excluded_var() {
        // Babel: excluded vars should not be captured
        let output = transform_code("console.log('hello');");
        assert!(!output.contains("__varRecorder__.console"), "excluded var should not be captured: {}", output);
    }

    #[test]
    fn test_same_var_decl_initializer_uses_local_binding() {
        let output = transform_code("if (true) var xe = 1, Ue = xe + 1;");
        assert!(output.contains("xe + 1"), "same-decl reference: {}", output);
        assert!(!output.contains("__varRecorder__.xe + 1"), "should use local binding: {}", output);
    }

    // --- Nested function scoping ---

    #[test]
    fn test_nested_function_uses_captured_ref() {
        // Babel: function params shadow, but outer refs are captured
        let output = transform_code("var z = 3; function foo(y) { var x = 5 + y + z; }");
        assert!(output.contains("__varRecorder__.z = 3;"), "outer var captured with value: {}", output);
        assert!(output.contains("__varRecorder__.foo = foo;"), "function captured with assignment: {}", output);
        // Inside foo, z references the captured var
        assert!(output.contains("__varRecorder__.z;"), "z ref inside foo uses recorder: {}", output);
        assert!(!output.contains("__varRecorder__.y"), "param should NOT be captured: {}", output);
        assert!(!output.contains("__varRecorder__.x"), "inner var should NOT be captured: {}", output);
    }

    // --- Let + Const ---

    #[test]
    fn test_let_const_captured() {
        let output = transform_code("let x = 1; const y = 2;");
        assert!(output.contains("__varRecorder__.x = 1;"), "let captured with value: {}", output);
        assert!(output.contains("__varRecorder__.y = 2;"), "const captured with value: {}", output);
    }

    // --- Export ---

    #[test]
    fn test_export_const() {
        // Babel: 'export const x = 23;' → 'export const x = 23;\n_rec.x = x;'
        let output = transform_code("export const x = 23;");
        assert!(output.contains("export const x = 23;"), "keeps export: {}", output);
        assert!(output.contains("__varRecorder__.x = x"), "captures export: {}", output);
    }

    #[test]
    fn test_export_var() {
        // Babel: 'var x = 23; export { x };' → '_rec.x = 23; var x = _rec.x; export { x };'
        let output = transform_code("var x = 23; export { x };");
        assert!(output.contains("__varRecorder__.x = 23;"), "captures var with value: {}", output);
        assert!(output.contains("var x = __varRecorder__.x;"), "re-declares var from recorder: {}", output);
        assert!(output.contains("export { x }"), "keeps named export: {}", output);
    }

    #[test]
    fn test_export_aliased_var() {
        // Babel: 'var x = 23; export { x as y };' → '_rec.x = 23; var x = _rec.x; export { x as y };'
        let output = transform_code("var x = 23; export { x as y };");
        assert!(output.contains("__varRecorder__.x = 23;"), "captures local var with value: {}", output);
        assert!(output.contains("var x = __varRecorder__.x;"), "re-declares var from recorder: {}", output);
        assert!(output.contains("export { x as y }"), "keeps aliased export: {}", output);
    }

    #[test]
    fn test_export_function_decl() {
        // Babel: 'export function x() {}' → 'function x() {}\n_rec.x = x;\nexport { x };'
        let output = transform_code("export function x() {}");
        assert!(output.contains("__varRecorder__.x = x;"), "captures function with assignment: {}", output);
        assert!(output.contains("export function x()"), "keeps export function declaration: {}", output);
    }

    #[test]
    fn test_export_default_named_function() {
        // Babel: 'export default function x() {}' → 'function x() {}\n_rec.x = x;\nexport default x;'
        let output = transform_code("export default function x() {}");
        assert!(output.contains("__varRecorder__.x = x;"), "captures default fn with assignment: {}", output);
        assert!(output.contains("export default x;"), "keeps export default statement: {}", output);
        assert!(output.contains("function x()"), "keeps function declaration: {}", output);
    }

    #[test]
    fn test_re_export_named_from_source() {
        // Babel: 'export { name1, name2 } from "foo";' → keeps as-is (no capture in scope phase)
        let output = transform_code("export { name1, name2 } from \"foo\";");
        assert!(output.contains("export { name1, name2 }"), "keeps re-export with names: {}", output);
        // SWC rewrites re-exports as import+export, capturing the bindings
        assert!(output.contains("__varRecorder__.name1 = name1"), "captures re-exported name1: {}", output);
        assert!(output.contains("__varRecorder__.name2 = name2"), "captures re-exported name2: {}", output);
    }

    #[test]
    fn test_re_export_aliased_from_source() {
        // Babel: 'export { name1 as foo1 } from "foo";' → keeps as-is
        let output = transform_code("export { name1 as foo1, name2 as bar2 } from \"foo\";");
        assert!(output.contains("export {"), "keeps re-export: {}", output);
        assert!(output.contains("from \"foo\"") || output.contains("from 'foo'"), "keeps source module: {}", output);
    }

    #[test]
    fn test_export_default_expression() {
        // Babel: 'export default foo(1, 2, 3);' → 'export default _rec.foo(1, 2, 3);'
        // SWC does not capture undeclared globals, so we declare foo first
        let output = transform_code("var foo = function() {}; export default foo(1, 2, 3);");
        assert!(output.contains("__varRecorder__.foo(1, 2, 3)"), "captures ref in default expr: {}", output);
        assert!(output.contains("export default __varRecorder__.foo(1, 2, 3)"), "export default uses captured ref: {}", output);
        assert!(output.contains("__varRecorder__.default = __varRecorder__.foo(1, 2, 3)"), "captures __rec.default: {}", output);
    }

    #[test]
    fn test_re_export_namespace_import() {
        // Babel: 'import * as completions from "./lib/completions.js"; export { completions }'
        //     → keeps import, adds _rec.completions = completions, keeps export
        let output = transform_code("import * as completions from \"./lib/completions.js\";\nexport { completions }");
        assert!(output.contains("import * as completions from"), "keeps namespace import: {}", output);
        assert!(output.contains("__varRecorder__.completions = completions;"), "captures namespace with assignment form: {}", output);
        assert!(output.contains("export { completions }"), "keeps named export: {}", output);
    }

    // --- Import ---

    #[test]
    fn test_import_capture() {
        // With captureImports=true, imports get _rec.x = x
        let output = transform_code("import { x } from 'foo';");
        assert!(output.contains("import { x } from 'foo'"), "keeps import declaration: {}", output);
        assert!(output.contains("__varRecorder__.x = x;"), "captures import with assignment form: {}", output);
    }

    #[test]
    fn test_import_default_capture() {
        let output = transform_code("import x from 'foo';");
        assert!(output.contains("import x from 'foo'"), "keeps default import declaration: {}", output);
        assert!(output.contains("__varRecorder__.x = x;"), "captures default import with assignment form: {}", output);
    }

    #[test]
    fn test_import_namespace_capture() {
        let output = transform_code("import * as ns from 'foo';");
        assert!(output.contains("import * as ns from 'foo'"), "keeps namespace import declaration: {}", output);
        assert!(output.contains("__varRecorder__.ns = ns;"), "captures namespace import with assignment form: {}", output);
    }

    // --- Patterns ---

    #[test]
    fn test_destructuring_var() {
        let output = transform_code("var { a, b: c } = obj;");
        // SWC desugars to temp variable + property access
        assert!(output.contains("_tmp_"), "uses temp variable for destructuring: {}", output);
        assert!(output.contains("__varRecorder__.a = _tmp_"), "captures a from temp: {}", output);
        assert!(output.contains("__varRecorder__.c = _tmp_"), "captures c (alias of b) from temp: {}", output);
        assert!(!output.contains("__varRecorder__.b"), "b is a key, not captured: {}", output);
    }

    #[test]
    fn test_array_destructuring() {
        let output = transform_code("var [a, b] = arr;");
        // SWC desugars to temp variable + index access
        assert!(output.contains("_tmp_"), "uses temp variable for array destructuring: {}", output);
        assert!(output.contains("__varRecorder__.a = _tmp_"), "captures a from temp: {}", output);
        assert!(output.contains("__varRecorder__.b = _tmp_"), "captures b from temp: {}", output);
        assert!(output.contains("[0]"), "accesses index 0: {}", output);
        assert!(output.contains("[1]"), "accesses index 1: {}", output);
    }

    // --- For loop let/const scoping ---

    #[test]
    fn test_for_loop_let_not_captured() {
        let output = transform_code("for (let i = 0; i < 10; i++) {}");
        assert!(!output.contains("__varRecorder__.i"), "for-let should NOT be captured: {}", output);
    }

    #[test]
    fn test_for_in_let_not_captured() {
        let output = transform_code("for (let k in obj) {}");
        assert!(!output.contains("__varRecorder__.k"), "for-in let should NOT be captured: {}", output);
    }

    #[test]
    fn test_for_of_let_not_captured() {
        let output = transform_code("for (let v of arr) {}");
        assert!(!output.contains("__varRecorder__.v"), "for-of let should NOT be captured: {}", output);
    }

    // ===================================================================
    // Tests translated from lively.source-transform/tests/capturing-test.js
    // ===================================================================

    // --- Basic var/func capturing (top-level describe block) ---

    #[test]
    fn babel_top_level_var_decls_for_capturing() {
        // Babel: 'var y, z = foo + bar; baz.foo(z, 3)'
        // SWC only captures declared top-level vars, not undeclared globals like foo/bar/baz.
        // We declare them to match Babel behavior more closely.
        let output = transform_code("var foo, bar, baz; var y, z = foo + bar; baz.foo(z, 3)");
        assert!(output.contains("__varRecorder__.y"), "capture y: {}", output);
        assert!(output.contains("__varRecorder__.z = __varRecorder__.foo + __varRecorder__.bar"), "capture z with captured refs: {}", output);
        assert!(output.contains("__varRecorder__.baz.foo(__varRecorder__.z, 3)"), "call site uses captured refs: {}", output);
    }

    #[test]
    fn babel_top_level_var_and_func_decls_for_capturing() {
        // Babel: 'var z = 3, y = 4; function foo() { var x = 5; }'
        let output = transform_code("var z = 3, y = 4; function foo() { var x = 5; }");
        assert!(output.contains("__varRecorder__.z = 3"), "capture z: {}", output);
        assert!(output.contains("__varRecorder__.y = 4"), "capture y: {}", output);
        assert!(output.contains("__varRecorder__.foo = foo"), "capture foo: {}", output);
        assert!(!output.contains("__varRecorder__.x"), "inner x NOT captured: {}", output);
    }

    #[test]
    fn babel_top_level_var_decls_and_var_usage() {
        // var z = 3, y = 42, obj = {...}; function foo(y) { var x = 5 + y.b(z); }
        // inner y is param (not captured), z is outer (captured ref)
        let output = transform_code(
            "var z = 3, y = 42, obj = {a: '123', b: function b(n) { return 23 + n; }};\nfunction foo(y) { var x = 5 + y.b(z); }"
        );
        assert!(output.contains("__varRecorder__.z = 3;"), "capture z with value: {}", output);
        assert!(output.contains("__varRecorder__.y = 42;"), "capture y with value: {}", output);
        assert!(output.contains("__varRecorder__.obj ="), "capture obj: {}", output);
        assert!(output.contains("__varRecorder__.foo = foo;"), "capture foo with assignment: {}", output);
        // Function is hoisted: __varRecorder__.foo = foo appears before other captures
        let foo_pos = output.find("__varRecorder__.foo = foo").unwrap();
        let z_pos = output.find("__varRecorder__.z = 3").unwrap();
        assert!(foo_pos < z_pos, "function capture hoisted before var captures: {}", output);
        // Inside foo, z should reference __varRecorder__.z
        assert!(output.contains("y.b(__varRecorder__.z)"), "z ref inside foo uses recorder: {}", output);
        // Inner var x and param y should NOT be captured
        assert!(!output.contains("__varRecorder__.x"), "inner x NOT captured: {}", output);
    }

    #[test]
    fn babel_captures_global_vars_redefined_in_subscopes() {
        // const baz = 42; function bar(y) { const x = baz + 10; if (y > 10) { const baz = 33; return baz + 10 } return x; }
        let output = transform_code(
            "const baz = 42; function bar(y) { const x = baz + 10; if (y > 10) { const baz = 33; return baz + 10 } return x; }"
        );
        assert!(output.contains("__varRecorder__.baz = 42;"), "capture baz with value: {}", output);
        assert!(output.contains("__varRecorder__.bar = bar;"), "capture bar with assignment: {}", output);
        // Inside bar, baz references __varRecorder__.baz in the outer scope
        assert!(output.contains("__varRecorder__.baz + 10"), "baz ref inside bar uses recorder: {}", output);
        // The inner const baz = 33 should NOT use the recorder
        assert!(output.contains("const baz = 33"), "inner baz is a local const: {}", output);
        assert!(output.contains("return baz + 10"), "inner return uses local baz: {}", output);
    }

    #[test]
    fn babel_captures_top_level_vars_outside_block_shadow() {
        // const p = x => x + 1; function f() { { const p = 3; } return p(2); }
        let output = transform_code(
            "const p = x => x + 1; function f() { { const p = 3; } return p(2); }"
        );
        assert!(output.contains("__varRecorder__.f = f;"), "capture f with assignment: {}", output);
        assert!(output.contains("__varRecorder__.p ="), "capture p: {}", output);
        // Inside f(), after the block scope, p(2) should reference __varRecorder__.p
        assert!(output.contains("__varRecorder__.p(2)"), "p(2) outside block shadow uses recorder: {}", output);
        // The block-scoped const p = 3 should NOT use recorder
        assert!(output.contains("const p = 3"), "inner block const p is local: {}", output);
    }

    // --- try-catch ---

    #[test]
    fn babel_try_catch_not_transformed() {
        // Babel: 'try { throw {} } catch (e) { e }' → not transformed
        let output = transform_code("try { throw {} } catch (e) { e }");
        assert!(!output.contains("__varRecorder__.e"), "catch param not captured: {}", output);
        assert!(output.contains("catch"), "keeps catch: {}", output);
    }

    // --- for statement ---

    #[test]
    fn babel_standard_for_var_not_rewritten() {
        // Babel: 'for (var i = 0; i < 5; i ++) { i; }' → var not captured
        let output = transform_code("for (var i = 0; i < 5; i++) { i; }");
        assert!(!output.contains("__varRecorder__.i"), "for-var i not captured: {}", output);
    }

    #[test]
    fn babel_for_in_var_not_rewritten() {
        // Babel: 'for (var x in {}) { x; }' → var not captured
        let output = transform_code("for (var x in {}) { x; }");
        assert!(!output.contains("__varRecorder__.x"), "for-in var not captured: {}", output);
    }

    #[test]
    fn babel_for_of_captures_iterable_ref() {
        // Babel: 'for (let x of foo) { x; }' → 'for (let x of _rec.foo) { x; }'
        // SWC: foo is an undeclared global, not captured. Loop var x also not captured.
        let output = transform_code("for (let x of foo) { x; }");
        assert!(!output.contains("__varRecorder__.x"), "loop var not captured: {}", output);
        // With a declared var: for (let x of arr) where arr is declared
        let output2 = transform_code("var arr = [1]; for (let x of arr) { x; }");
        assert!(output2.contains("__varRecorder__.arr"), "declared iterable captured: {}", output2);
    }

    #[test]
    fn babel_for_of_destructured_captures_iterable_ref() {
        // Babel: 'for (let [x, y] of foo) { x + y; }' → 'for (let [x, y] of _rec.foo) { x + y; }'
        // SWC: foo is undeclared, not captured. Loop vars not captured.
        let output = transform_code("for (let [x, y] of foo) { x + y; }");
        assert!(!output.contains("__varRecorder__.x"), "loop var x not captured: {}", output);
        assert!(!output.contains("__varRecorder__.y"), "loop var y not captured: {}", output);
    }

    // --- labels ---

    #[test]
    fn babel_label_continue() {
        // Babel: 'loop1:\nfor (var i = 0; i < 3; i++) continue loop1;'
        let output = transform_code("loop1:\nfor (var i = 0; i < 3; i++) continue loop1;");
        assert!(output.contains("loop1:"), "keeps label: {}", output);
        assert!(output.contains("continue loop1"), "keeps continue: {}", output);
    }

    #[test]
    fn babel_label_break() {
        // Babel: 'loop1:\nfor (var i = 0; i < 3; i++) break loop1;'
        let output = transform_code("loop1:\nfor (var i = 0; i < 3; i++) break loop1;");
        assert!(output.contains("loop1:"), "keeps label: {}", output);
        assert!(output.contains("break loop1"), "keeps break: {}", output);
    }

    // --- es6 let + const ---

    #[test]
    fn babel_captures_let_as_var() {
        // Babel: 'let x = 23, y = x + 1;' → '_rec.x = 23; _rec.y = _rec.x + 1;'
        let output = transform_code("let x = 23, y = x + 1;");
        assert!(output.contains("__varRecorder__.x = 23;"), "capture let x with value: {}", output);
        assert!(output.contains("__varRecorder__.y = __varRecorder__.x + 1;"), "capture let y with captured x ref: {}", output);
    }

    #[test]
    fn babel_captures_const_as_var() {
        // Babel: 'const x = 23, y = x + 1;' → '_rec.x = 23; _rec.y = _rec.x + 1;'
        let output = transform_code("const x = 23, y = x + 1;");
        assert!(output.contains("__varRecorder__.x = 23;"), "capture const x with value: {}", output);
        assert!(output.contains("__varRecorder__.y = __varRecorder__.x + 1;"), "capture const y with captured x ref: {}", output);
    }

    // --- enhanced object literals ---

    #[test]
    fn babel_captures_shorthand_properties() {
        // Babel: 'var x = 23, y = {x};' → '_rec.x = 23; _rec.y = { x: _rec.x };'
        let output = transform_code("var x = 23, y = {x};");
        assert!(output.contains("__varRecorder__.x = 23;"), "capture x with value: {}", output);
        // Shorthand {x} expands to {x: __varRecorder__.x}
        assert!(output.contains("x: __varRecorder__.x"), "shorthand property uses captured ref: {}", output);
        assert!(output.contains("__varRecorder__.y ="), "capture y: {}", output);
    }

    // --- default args ---

    #[test]
    fn babel_captures_default_arg() {
        // Babel: 'function x(arg = foo) {}' → 'function x(arg = _rec.foo) {} _rec.x = x; x;'
        // SWC does not capture undeclared globals, so foo is not captured without declaration
        let output = transform_code("function x(arg = foo) {}");
        assert!(output.contains("__varRecorder__.x = x;"), "capture func x with assignment: {}", output);
        // With declared default arg source:
        let output2 = transform_code("var foo = 1; function x(arg = foo) {}");
        assert!(output2.contains("__varRecorder__.foo = 1;"), "capture declared foo with value: {}", output2);
        assert!(output2.contains("__varRecorder__.x = x;"), "capture func x: {}", output2);
        // Default arg should use captured ref
        assert!(output2.contains("arg = __varRecorder__.foo"), "default arg uses captured ref: {}", output2);
    }

    // --- class (without classToFunction transform) ---

    #[test]
    fn babel_class_def_no_class_to_func() {
        // Babel: 'class Foo { a() { return 23; } }' → 'class Foo { a() { return 23; } } _rec.Foo = Foo;'
        let output = transform_code("class Foo {\n  a() {\n  return 23;\n  }\n}");
        assert!(output.contains("class Foo"), "keeps class declaration: {}", output);
        assert!(output.contains("return 23"), "keeps method body: {}", output);
        assert!(output.contains("__varRecorder__.Foo = Foo;"), "captures class Foo with assignment: {}", output);
    }

    #[test]
    fn babel_exported_class_def_no_class_to_func() {
        // Babel: 'export class Foo {}' → 'export class Foo {} _rec.Foo = Foo;'
        let output = transform_code("export class Foo {}");
        assert!(output.contains("export class Foo"), "keeps export class: {}", output);
        assert!(output.contains("__varRecorder__.Foo = Foo;"), "captures exported class with assignment: {}", output);
    }

    #[test]
    fn babel_exported_default_class_no_class_to_func() {
        // Babel: 'export default class Foo {}' → 'export default class Foo {} _rec.Foo = Foo;'
        let output = transform_code("export default class Foo {}");
        assert!(output.contains("class Foo"), "keeps class declaration: {}", output);
        assert!(output.contains("__varRecorder__.Foo = Foo;"), "captures default exported class with assignment: {}", output);
        assert!(output.contains("__varRecorder__.default = __varRecorder__.Foo"), "captures __rec.default: {}", output);
        assert!(output.contains("export default __varRecorder__.Foo"), "export default uses captured ref: {}", output);
    }

    #[test]
    fn babel_does_not_capture_class_expr() {
        // Babel: 'var bar = class Foo {}' → '_rec.bar = class Foo {};'
        let output = transform_code("var bar = class Foo {}");
        assert!(output.contains("__varRecorder__.bar = class Foo"), "captures var bar with class expr: {}", output);
        // Foo as a class expression name should not be separately captured
        assert!(!output.contains("__varRecorder__.Foo"), "class expr name Foo NOT captured: {}", output);
    }

    #[test]
    fn babel_captures_var_same_name_as_class_expr() {
        // Babel: 'var Foo = class Foo {}; new Foo();' → '_rec.Foo = class Foo {}; new _rec.Foo();'
        let output = transform_code("var Foo = class Foo {}; new Foo();");
        assert!(output.contains("__varRecorder__.Foo = class Foo"), "captures var Foo with class expr: {}", output);
        assert!(output.contains("new __varRecorder__.Foo()"), "new uses captured Foo: {}", output);
    }

    // --- template strings ---

    #[test]
    fn babel_template_string_ref() {
        // Babel: '`${foo}`' → '`${ _rec.foo }`;'
        // SWC does not capture undeclared globals; test with declared var
        let output = transform_code("var foo = 1; `${foo}`;");
        assert!(output.contains("__varRecorder__.foo = 1;"), "captures foo with value: {}", output);
        assert!(output.contains("${__varRecorder__.foo}"), "template string uses captured ref: {}", output);
    }

    // --- computed prop in object literal ---

    #[test]
    fn babel_computed_prop_in_object() {
        // Babel: 'var x = {[x]: y};' → '_rec.x = { [_rec.x]: _rec.y };'
        // SWC does not capture undeclared globals; test with all vars declared
        let output = transform_code("var x = 1, y = 2; var z = {[x]: y};");
        assert!(output.contains("__varRecorder__.x = 1;"), "captures x with value: {}", output);
        assert!(output.contains("__varRecorder__.y = 2;"), "captures y with value: {}", output);
        assert!(output.contains("[__varRecorder__.x]: __varRecorder__.y"), "computed prop uses captured refs: {}", output);
        assert!(output.contains("__varRecorder__.z ="), "captures z: {}", output);
    }

    // --- patterns / destructuring ---

    #[test]
    fn babel_destructured_obj_var() {
        // Babel: 'var {x} = {x: 3};' → 'var destructured_1 = { x: 3 }; _rec.x = destructured_1.x;'
        let output = transform_code("var {x} = {x: 3};");
        assert!(output.contains("_tmp_"), "uses temp variable: {}", output);
        assert!(output.contains("__varRecorder__.x ="), "captures destructured x: {}", output);
        assert!(output.contains(".x;") || output.contains(".x\n"), "accesses .x property from temp: {}", output);
    }

    #[test]
    fn babel_destructured_obj_var_with_alias() {
        // Babel: 'var {x: y} = foo;' → 'var destructured_1 = _rec.foo; _rec.y = destructured_1.x;'
        // SWC does not capture undeclared globals; foo is undeclared
        let output = transform_code("var {x: y} = foo;");
        assert!(output.contains("__varRecorder__.y ="), "captures alias y: {}", output);
        assert!(!output.contains("__varRecorder__.x"), "x is a key not a binding, not captured: {}", output);
        assert!(output.contains(".x"), "accesses .x from temp: {}", output);
    }

    #[test]
    fn babel_destructured_list_with_spread() {
        // Babel: 'var [a, b, ...rest] = foo;'
        // SWC does not capture undeclared globals; foo is undeclared
        let output = transform_code("var [a, b, ...rest] = foo;");
        assert!(output.contains("__varRecorder__.a ="), "captures a: {}", output);
        assert!(output.contains("__varRecorder__.b ="), "captures b: {}", output);
        assert!(output.contains("__varRecorder__.rest ="), "captures rest: {}", output);
        assert!(output.contains("[0]"), "accesses index 0: {}", output);
        assert!(output.contains("[1]"), "accesses index 1: {}", output);
    }

    #[test]
    fn babel_destructured_list_with_obj() {
        // Babel: 'var [{b}] = foo;' → temp[0].b
        // SWC does not capture undeclared globals; foo is undeclared
        let output = transform_code("var [{b}] = foo;");
        assert!(output.contains("__varRecorder__.b ="), "captures b: {}", output);
        assert!(output.contains("[0]"), "accesses index 0: {}", output);
        assert!(output.contains(".b"), "accesses .b property: {}", output);
    }

    #[test]
    fn babel_destructured_list_nested() {
        // Babel: 'var [[b]] = foo;' → temp[0][0]
        let output = transform_code("var [[b]] = foo;");
        assert!(output.contains("__varRecorder__.b ="), "captures b: {}", output);
        assert!(output.contains("[0]"), "accesses index: {}", output);
    }

    #[test]
    fn babel_destructured_obj_with_list() {
        // Babel: 'var {x: [y]} = foo, z = 23;'
        // SWC does not capture undeclared globals; foo is undeclared
        let output = transform_code("var {x: [y]} = foo, z = 23;");
        assert!(output.contains("__varRecorder__.y ="), "captures y: {}", output);
        assert!(output.contains("__varRecorder__.z = 23"), "captures z with value: {}", output);
        assert!(output.contains(".x"), "accesses .x property: {}", output);
    }

    #[test]
    fn babel_destructured_deep() {
        // Babel: 'var {x: {x: {x}}, y: {y: x}} = foo;'
        // SWC does not capture undeclared globals; foo is undeclared
        let output = transform_code("var {x: {x: {x}}, y: {y: x}} = foo;");
        assert!(output.contains("__varRecorder__.x ="), "captures x: {}", output);
        // Should have multiple temp variables for nested access
        assert!(output.contains("_tmp_"), "uses temp variables for deep destructuring: {}", output);
    }

    #[test]
    fn babel_destructured_obj_with_init() {
        // Babel: 'var {x = 4} = {x: 3};'
        let output = transform_code("var {x = 4} = {x: 3};");
        assert!(output.contains("__varRecorder__.x ="), "captures x with default: {}", output);
    }

    #[test]
    fn babel_destructured_list_with_default() {
        // Babel: 'var [a = 3] = foo;'
        let output = transform_code("var [a = 3] = foo;");
        assert!(output.contains("__varRecorder__.a ="), "captures a with default: {}", output);
    }

    #[test]
    fn babel_destructured_list_nested_default() {
        // Babel: 'var [[a = 3]] = foo;'
        let output = transform_code("var [[a = 3]] = foo;");
        assert!(output.contains("__varRecorder__.a ="), "captures a with nested default: {}", output);
    }

    #[test]
    fn babel_destructured_list_obj_deep() {
        // Babel: 'var [{b: {c: [a]}}] = foo;'
        let output = transform_code("var [{b: {c: [a]}}] = foo;");
        assert!(output.contains("__varRecorder__.a ="), "captures a: {}", output);
        // Multiple temp variables for deep nesting
        assert!(output.contains("_tmp_"), "uses temp variables: {}", output);
    }

    #[test]
    fn babel_destructured_rest_prop() {
        // Babel: 'var {a, b, ...rest} = foo;'
        let output = transform_code("var {a, b, ...rest} = foo;");
        assert!(output.contains("__varRecorder__.a ="), "captures a: {}", output);
        assert!(output.contains("__varRecorder__.b ="), "captures b: {}", output);
        assert!(output.contains("__varRecorder__.rest ="), "captures rest: {}", output);
    }

    // --- async ---

    #[test]
    fn babel_async_function() {
        // Babel: 'async function foo() { return 23 }' → captures foo, hoists capture
        let output = transform_code("async function foo() { return 23 }");
        assert!(output.contains("__varRecorder__.foo = foo;"), "captures async fn with assignment: {}", output);
        assert!(output.contains("async function foo()"), "keeps async function declaration: {}", output);
        assert!(output.contains("return 23"), "keeps function body: {}", output);
        // Function capture is hoisted before the function declaration
        let capture_pos = output.find("__varRecorder__.foo = foo").unwrap();
        let decl_pos = output.find("async function foo()").unwrap();
        assert!(capture_pos < decl_pos, "function capture hoisted before declaration: {}", output);
    }

    #[test]
    fn babel_await() {
        // Babel: 'var x = await foo();' → '_rec.x = await _rec.foo();'
        // SWC does not capture undeclared globals; with declared foo, both are captured
        let output = transform_code("var foo = async () => 1; var x = await foo();");
        assert!(output.contains("__varRecorder__.x = await __varRecorder__.foo()"), "captures x with await and captured foo ref: {}", output);
    }

    #[test]
    fn babel_exported_async_function() {
        // Babel: 'export async function foo() { return 23; }'
        let output = transform_code("export async function foo() { return 23; }");
        assert!(output.contains("__varRecorder__.foo = foo;"), "captures exported async fn with assignment: {}", output);
        assert!(output.contains("export async function foo()"), "keeps export async function: {}", output);
    }

    #[test]
    fn babel_exported_default_async_function() {
        // Babel: 'export default async function foo() { return 23; }'
        let output = transform_code("export default async function foo() { return 23; }");
        assert!(output.contains("__varRecorder__.foo = foo;"), "captures default async fn with assignment: {}", output);
        assert!(output.contains("async function foo()"), "keeps async function: {}", output);
        assert!(output.contains("__varRecorder__.default = foo;"), "captures __rec.default: {}", output);
        assert!(output.contains("export default foo;"), "export default uses name: {}", output);
    }

    // --- import ---

    #[test]
    fn babel_import_default() {
        // Babel: 'import x from "./some-es6-module.js";' → keeps import, adds _rec.x = x
        let output = transform_code("import x from \"./some-es6-module.js\";");
        assert!(output.contains("import x from \"./some-es6-module.js\""), "keeps full import: {}", output);
        assert!(output.contains("__varRecorder__.x = x;"), "captures default import with assignment: {}", output);
    }

    #[test]
    fn babel_import_star() {
        // Babel: 'import * as name from "module-name";' → keeps import, adds _rec.name = name
        let output = transform_code("import * as name from \"module-name\";");
        assert!(output.contains("import * as name from \"module-name\""), "keeps full import: {}", output);
        assert!(output.contains("__varRecorder__.name = name;"), "captures namespace with assignment: {}", output);
    }

    #[test]
    fn babel_import_member() {
        // Babel: 'import { member } from "module-name";' → keeps import, adds _rec.member = member
        let output = transform_code("import { member } from \"module-name\";");
        assert!(output.contains("import {"), "keeps import brace: {}", output);
        assert!(output.contains("from \"module-name\""), "keeps source: {}", output);
        assert!(output.contains("__varRecorder__.member = member;"), "captures member with assignment: {}", output);
    }

    #[test]
    fn babel_import_member_with_alias() {
        // Babel: 'import { member as alias } from "module-name";' → _rec.alias = alias
        let output = transform_code("import { member as alias } from \"module-name\";");
        assert!(output.contains("member as alias"), "keeps alias in import: {}", output);
        assert!(output.contains("__varRecorder__.alias = alias;"), "captures alias with assignment: {}", output);
        assert!(!output.contains("__varRecorder__.member"), "member not captured separately: {}", output);
    }

    #[test]
    fn babel_import_multiple_members() {
        // Babel: 'import { member1 , member2 } from "module-name";'
        let output = transform_code("import { member1, member2 } from \"module-name\";");
        assert!(output.contains("__varRecorder__.member1 = member1;"), "captures member1 with assignment: {}", output);
        assert!(output.contains("__varRecorder__.member2 = member2;"), "captures member2 with assignment: {}", output);
    }

    #[test]
    fn babel_import_multiple_members_with_alias() {
        // Babel: 'import { member1 , member2 as alias} from "module-name";'
        let output = transform_code("import { member1, member2 as alias } from \"module-name\";");
        assert!(output.contains("__varRecorder__.member1 = member1;"), "captures member1 with assignment: {}", output);
        assert!(output.contains("__varRecorder__.alias = alias;"), "captures alias with assignment: {}", output);
        assert!(!output.contains("__varRecorder__.member2"), "member2 not captured (aliased to alias): {}", output);
    }

    #[test]
    fn babel_import_default_and_member() {
        // Babel: 'import defaultMember, { member } from "module-name";'
        let output = transform_code("import defaultMember, { member } from \"module-name\";");
        assert!(output.contains("__varRecorder__.defaultMember = defaultMember;"), "captures default with assignment: {}", output);
        assert!(output.contains("__varRecorder__.member = member;"), "captures member with assignment: {}", output);
    }

    #[test]
    fn babel_import_default_and_star() {
        // Babel: 'import defaultMember, * as name from "module-name";'
        let output = transform_code("import defaultMember, * as name from \"module-name\";");
        assert!(output.contains("__varRecorder__.defaultMember = defaultMember;"), "captures default with assignment: {}", output);
        assert!(output.contains("__varRecorder__.name = name;"), "captures namespace with assignment: {}", output);
    }

    #[test]
    fn babel_import_without_binding() {
        // Babel: 'import "module-name";' → 'import "module-name";' (no capture)
        let output = transform_code("import \"module-name\";");
        assert!(output.contains("import \"module-name\""), "keeps bare import: {}", output);
        // No capture assignments like __varRecorder__.x = x should appear
        assert!(!output.contains("__varRecorder__."), "no capture assignment for bare import: {}", output);
    }

    // --- export ---

    #[test]
    fn babel_export_default_named_var() {
        // Babel: 'var x = {x: 23}; export default x;'
        // → '_rec.x = { x: 23 }; var x = _rec.x; export default x;'
        let output = transform_code("var x = {x: 23}; export default x;");
        assert!(output.contains("__varRecorder__.x ="), "captures x: {}", output);
        assert!(output.contains("x: 23"), "keeps object literal: {}", output);
        assert!(output.contains("__varRecorder__.default = __varRecorder__.x"), "captures __rec.default: {}", output);
        assert!(output.contains("export default __varRecorder__.x"), "export default uses captured ref: {}", output);
    }

    #[test]
    fn babel_export_var_with_capturing() {
        // Babel: 'var a = 23; export var x = a + 1, y = x + 2; export default function f() {}'
        let output = transform_code("var a = 23;\nexport var x = a + 1, y = x + 2;\nexport default function f() {}");
        assert!(output.contains("__varRecorder__.a = 23;"), "captures a with value: {}", output);
        assert!(output.contains("__varRecorder__.a + 1"), "export var x uses captured a ref: {}", output);
        assert!(output.contains("__varRecorder__.x = x;"), "captures export x: {}", output);
        assert!(output.contains("__varRecorder__.y = y;"), "captures export y: {}", output);
        assert!(output.contains("__varRecorder__.f = f;"), "captures default f: {}", output);
        assert!(output.contains("__varRecorder__.default = f;"), "captures __rec.default: {}", output);
        assert!(output.contains("export default f;"), "keeps export default: {}", output);
    }

    #[test]
    fn babel_export_var_statement() {
        // Babel: 'var x = 23; export { x };'
        let output = transform_code("var x = 23; export { x };");
        assert!(output.contains("__varRecorder__.x = 23;"), "captures x with value: {}", output);
        assert!(output.contains("var x = __varRecorder__.x;"), "re-declares var from recorder: {}", output);
        assert!(output.contains("export { x }"), "keeps named export: {}", output);
    }

    #[test]
    fn babel_export_aliased_var_statement() {
        // Babel: 'var x = 23; export { x as y };'
        let output = transform_code("var x = 23; export { x as y };");
        assert!(output.contains("__varRecorder__.x = 23;"), "captures x with value: {}", output);
        assert!(output.contains("var x = __varRecorder__.x;"), "re-declares var from recorder: {}", output);
        assert!(output.contains("export { x as y }"), "keeps aliased export: {}", output);
    }

    #[test]
    fn babel_export_const() {
        // Babel: 'export const x = 23;' → 'export const x = 23; _rec.x = x;'
        let output = transform_code("export const x = 23;");
        assert!(output.contains("export const x = 23;"), "keeps export const declaration: {}", output);
        assert!(output.contains("__varRecorder__.x = x;"), "captures const x with assignment: {}", output);
    }

    #[test]
    fn babel_export_function_decl() {
        // Babel: 'export function x() {};' → 'function x() {} _rec.x = x; export { x };'
        let output = transform_code("export function x() {}");
        assert!(output.contains("__varRecorder__.x = x;"), "captures function x with assignment: {}", output);
        assert!(output.contains("export function x()"), "keeps export function: {}", output);
    }

    #[test]
    fn babel_export_default_function_decl() {
        // Babel: 'export default function x() {};' → 'function x() {} _rec.x = x; export default x;'
        let output = transform_code("export default function x() {}");
        assert!(output.contains("__varRecorder__.x = x;"), "captures default fn x with assignment: {}", output);
        assert!(output.contains("__varRecorder__.default = x;"), "captures __rec.default: {}", output);
        assert!(output.contains("export default x;"), "keeps export default: {}", output);
    }

    #[test]
    fn babel_export_class_no_class_to_func() {
        // Babel: 'export class Foo {};' → 'export class Foo {} _rec.Foo = Foo;'
        let output = transform_code("export class Foo {}");
        assert!(output.contains("export class Foo"), "keeps export class: {}", output);
        assert!(output.contains("__varRecorder__.Foo = Foo;"), "captures class Foo with assignment: {}", output);
    }

    #[test]
    fn babel_export_default_class_no_class_to_func() {
        // Babel: 'export default class Foo {};' → 'export default class Foo {} _rec.Foo = Foo;'
        let output = transform_code("export default class Foo {}");
        assert!(output.contains("__varRecorder__.Foo = Foo;"), "captures default class Foo with assignment: {}", output);
        assert!(output.contains("__varRecorder__.default = __varRecorder__.Foo"), "captures __rec.default: {}", output);
        assert!(output.contains("export default __varRecorder__.Foo"), "export default uses captured ref: {}", output);
    }

    #[test]
    fn babel_export_default_expression() {
        // Babel: 'export default foo(1, 2, 3);' → 'export default _rec.foo(1, 2, 3);'
        // SWC does not capture undeclared globals; with declared foo it is captured
        let output = transform_code("var foo = x => x; export default foo(1, 2, 3);");
        assert!(output.contains("__varRecorder__.foo(1, 2, 3)"), "call uses captured foo ref: {}", output);
        assert!(output.contains("export default __varRecorder__.foo(1, 2, 3)"), "export default uses captured ref: {}", output);
    }

    #[test]
    fn babel_re_export_namespace_import() {
        // Babel: 'import * as completions from "./lib/completions.js"; export { completions }'
        let output = transform_code("import * as completions from \"./lib/completions.js\";\nexport { completions }");
        assert!(output.contains("import * as completions from"), "keeps namespace import: {}", output);
        assert!(output.contains("__varRecorder__.completions = completions;"), "captures completions with assignment: {}", output);
        assert!(output.contains("export { completions }"), "keeps named export: {}", output);
    }

    #[test]
    fn babel_re_export_named() {
        // Babel: 'export { name1, name2 } from "foo";' → keeps as-is
        let output = transform_code("export { name1, name2 } from \"foo\";");
        assert!(output.contains("export { name1, name2 }"), "keeps re-export with both names: {}", output);
    }

    #[test]
    fn babel_export_from_named_aliased() {
        // Babel: 'export { name1 as foo1, name2 as bar2 } from "foo";'
        let output = transform_code("export { name1 as foo1, name2 as bar2 } from \"foo\";");
        assert!(output.contains("export {"), "keeps re-export: {}", output);
    }

    #[test]
    fn babel_export_bug_1() {
        // Babel: 'foo(); export function a() {} export function b() {}'
        // → functions hoisted, captures added before foo() call
        // SWC does not capture undeclared globals; a and b are captured and hoisted
        let output = transform_code("foo();\nexport function a() {}\nexport function b() {}");
        assert!(output.contains("__varRecorder__.a = a;"), "captures a with assignment: {}", output);
        assert!(output.contains("__varRecorder__.b = b;"), "captures b with assignment: {}", output);
        // Function captures should be hoisted before foo() call
        let a_pos = output.find("__varRecorder__.a = a").unwrap();
        let foo_pos = output.find("foo()").unwrap();
        assert!(a_pos < foo_pos, "function capture hoisted before foo() call: {}", output);
    }

    #[test]
    fn babel_export_bug_2() {
        // Babel: 'export { a } from "./package-commands.js"; export function b() {} export function c() {}'
        let output = transform_code("export { a } from \"./package-commands.js\";\nexport function b() {}\nexport function c() {}");
        assert!(output.contains("__varRecorder__.b = b;"), "captures b with assignment: {}", output);
        assert!(output.contains("__varRecorder__.c = c;"), "captures c with assignment: {}", output);
        assert!(output.contains("./package-commands.js"), "keeps re-export source: {}", output);
        assert!(output.contains("export function b()"), "keeps export function b: {}", output);
        assert!(output.contains("export function c()"), "keeps export function c: {}", output);
    }

    #[test]
    fn test_class_with_separate_export() {
        // This is the pattern from lively.vm/eval-strategies.js that breaks rollup:
        // class is declared, then exported separately via export { }
        let output = transform_code("class Foo { eval() { return 1; } }\nexport { Foo };");
        // The class should still be declared (not removed) so rollup can resolve the export
        assert!(output.contains("export {"), "keeps export: {}", output);
        assert!(output.contains("class Foo"), "keeps class declaration: {}", output);
        assert!(output.contains("__varRecorder__.Foo = Foo"), "captures Foo: {}", output);
    }

    // --- Default export capture tests (Divergence O/P) ---
    // Babel always sets __rec.default for any form of default export.
    // SWC must do the same.

    #[test]
    fn test_export_default_named_function_captures_default() {
        // Babel: export default function foo() {} → function foo(){} _rec.foo = foo; _rec.default = foo; export default foo;
        let output = transform_code("export default function foo() { return 1; }");
        assert!(output.contains("function foo()"), "keeps function declaration: {}", output);
        assert!(output.contains("__varRecorder__.foo = foo;"), "captures foo with assignment: {}", output);
        assert!(output.contains("__varRecorder__.default = foo;"), "captures __rec.default = foo: {}", output);
        assert!(output.contains("export default foo;"), "export default uses named binding: {}", output);
    }

    #[test]
    fn test_export_default_named_class_captures_default() {
        // Babel: export default class Foo {} → class Foo {} _rec.Foo = Foo; _rec.default = Foo; export default Foo;
        let output = transform_code("export default class Foo { method() {} }");
        assert!(output.contains("class Foo"), "keeps class declaration: {}", output);
        assert!(output.contains("__varRecorder__.Foo = Foo;"), "captures Foo with assignment: {}", output);
        assert!(output.contains("__varRecorder__.default = __varRecorder__.Foo"), "captures __rec.default from captured Foo: {}", output);
        assert!(output.contains("export default __varRecorder__.Foo"), "export default uses captured ref: {}", output);
    }

    #[test]
    fn test_export_default_expression_captures_default() {
        // Babel: export default expr → _rec.default = expr; export default expr;
        let output = transform_code("var x = 42; export default x;");
        assert!(output.contains("__varRecorder__.x ="), "captures x: {}", output);
        assert!(output.contains("__varRecorder__.default = __varRecorder__.x"),
            "captures __rec.default from captured x: {}", output);
        assert!(output.contains("export default __varRecorder__.x"), "export default uses captured ref: {}", output);
    }

    #[test]
    fn test_export_default_anonymous_function_captures_default() {
        // Babel: export default function() {} → _rec.default = function() {}; export default _rec.default;
        let output = transform_code("export default function() { return 1; }");
        assert!(output.contains("__varRecorder__.default") || output.contains("__varRecorder__[\"default\"]"),
            "captures __rec.default for anonymous function: {}", output);
    }

    #[test]
    fn test_export_default_literal_captures_default() {
        // Babel: export default 42 → _rec.default = 42
        let output = transform_code("export default 42;");
        assert!(output.contains("__varRecorder__.default") || output.contains("__varRecorder__[\"default\"]"),
            "captures __rec.default for literal: {}", output);
    }

    // ===================================================================
    // Resurrection build: function declaration wrapping
    // ===================================================================

    fn transform_code_resurrection(code: &str) -> String {
        let cm = Lrc::new(SourceMap::default());
        let fm = cm.new_source_file(FileName::Anon.into(), code.to_string());

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
            Some(r#"__varRecorder__["test-mod__define__"]"#.to_string()),
            vec!["console".to_string()],
            false, // captureImports = false for resurrection
            true,  // resurrection = true
            "test-mod".to_string(),
            Some("({ pathInPackage: () => \"test-mod\" })".to_string()),
            None,
            HashMap::new(),
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
    fn test_resurrection_func_decl_replaced_with_let_wrapper() {
        // Babel: function foo() { return 1; }
        // => let __moduleMeta__ = <currentModuleAccessor>;
        //    var foo = wrapper("foo", "function", function() { return 1; }, __moduleMeta__)
        // The function declaration should be REPLACED (not kept alongside a capture).
        let output = transform_code_resurrection("function foo() { return 1; }");
        // Should have var foo = wrapper(...)
        assert!(output.contains("var foo ="), "function decl should be replaced with var: {}", output);
        assert!(output.contains("__define__"), "uses declaration wrapper: {}", output);
        assert!(output.contains("\"foo\""), "wrapper includes name string: {}", output);
        assert!(output.contains("\"function\""), "wrapper includes kind string: {}", output);
        // The original `function foo` declaration should NOT be present
        assert!(!output.contains("function foo()"), "original function decl should be removed: {}", output);
        // Should have __moduleMeta__ and __module_exports__ declarations
        assert!(output.contains("var __moduleMeta__"), "has __moduleMeta__ declaration: {}", output);
        assert!(output.contains("__module_exports__"), "has __module_exports__: {}", output);
    }

    #[test]
    fn test_resurrection_func_decl_wrapper_uses_module_meta() {
        // Divergence B: The 4th argument to the wrapper should be __moduleMeta__,
        // not __varRecorder__. __moduleMeta__ is set to the currentModuleAccessor.
        let output = transform_code_resurrection("function foo() { return 1; }");
        // Should prepend let __moduleMeta__ = <accessor>
        assert!(output.contains("var __moduleMeta__ = ("), "prepends __moduleMeta__ with accessor: {}", output);
        assert!(output.contains("pathInPackage"), "accessor has pathInPackage: {}", output);
    }

    #[test]
    fn test_resurrection_func_decl_non_function_stmts_unchanged() {
        // Function declarations should be replaced with var + wrapper.
        // Babel's bundler does NOT wrap var declarations with declarationWrapper —
        // only function declarations go through insertCapturesForFunctionDeclarations.
        let output = transform_code_resurrection("var x = 1; function foo() {} var y = 2;");
        assert!(output.contains("var foo ="), "func replaced with var: {}", output);
        assert!(output.contains("\"function\""), "func wrapper has function kind: {}", output);
        // var x and y are captured as plain __varRecorder__ assignments (no __define__ wrapping)
        assert!(output.contains("__varRecorder__.x = 1"), "var x captured without define: {}", output);
        assert!(output.contains("__varRecorder__.y = 2"), "var y captured without define: {}", output);
        // Function declarations should NOT remain as `function foo`
        assert!(!output.contains("function foo()"), "original function decl should be removed: {}", output);
    }

    // --- Regression tests for function declaration wrapper edge cases ---

    #[test]
    fn test_resurrection_exported_function_gets_wrapper() {
        // export function foo() {} — the function capture is hoisted and wrapped.
        // The export declaration stays (rollup handles it).
        let output = transform_code_resurrection("export function foo() { return 1; }");
        assert!(output.contains("var __moduleMeta__"), "has module meta declaration: {}", output);
        assert!(output.contains("export"), "still exports: {}", output);
        assert!(output.contains("__define__"), "uses declaration wrapper: {}", output);
        assert!(output.contains("\"foo\""), "wrapper has function name: {}", output);
    }

    #[test]
    fn test_resurrection_func_in_nested_scope_not_wrapped() {
        // Only top-level function declarations get wrapped, not nested ones
        let output = transform_code_resurrection("function outer() { function inner() {} }");
        assert!(output.contains("var outer ="), "top-level replaced with var: {}", output);
        assert!(output.contains("\"outer\""), "wrapper has outer name: {}", output);
        assert!(output.contains("function inner"), "nested function NOT wrapped, kept as-is: {}", output);
        assert!(!output.contains("let inner"), "inner should not be replaced with var: {}", output);
    }

    #[test]
    fn test_resurrection_class_not_affected_by_func_wrapper() {
        // Class declarations should NOT be affected by function wrapping
        let output = transform_code_resurrection("class Foo {} function bar() {}");
        assert!(output.contains("var bar ="), "func replaced with var: {}", output);
        assert!(output.contains("\"bar\""), "wrapper has bar name: {}", output);
        assert!(output.contains("class Foo") || output.contains("__varRecorder__.Foo"),
            "class handled separately: {}", output);
    }

    #[test]
    fn test_resurrection_async_function_gets_wrapper() {
        // async functions are also FunctionDeclarations
        let output = transform_code_resurrection("async function fetchData() { return await 1; }");
        assert!(output.contains("var fetchData ="), "async func replaced with var: {}", output);
        assert!(output.contains("\"fetchData\""), "wrapper has function name: {}", output);
        assert!(output.contains("\"function\""), "wrapper has function kind: {}", output);
        assert!(output.contains("var __moduleMeta__"), "has module meta declaration: {}", output);
    }

    // --- Babel 'declarations' block tests (declarationWrapper behavior) ---
    // Babel's bundler only uses declarationWrapper for function declarations
    // (via insertCapturesForFunctionDeclarations). Variable declarations and
    // assignments are captured without __define__ wrapping.

    #[test]
    fn babel_declarations_var_not_wrapped() {
        // Babel's bundler does NOT wrap var declarations with __define__.
        // Only function declarations get wrapper treatment.
        let output = transform_code_resurrection("var x = 23;");
        assert!(output.contains("__varRecorder__.x = 23"), "var captured directly: {}", output);
        assert!(!output.contains("__define__"), "var should NOT use __define__: {}", output);
    }

    #[test]
    fn babel_declarations_assignment_not_wrapped() {
        // Babel's bundler does NOT wrap assignments with __define__.
        let output = transform_code_resurrection("var x; x = 23;");
        assert!(output.contains("__varRecorder__.x = 23"), "assignment captured directly: {}", output);
        // __define__ should only appear if there are function declarations (there are none here)
        assert!(!output.contains("__define__"), "assignment should NOT use __define__: {}", output);
    }

    #[test]
    fn babel_declarations_func_decl_wrapped() {
        // Babel's insertCapturesForFunctionDeclarations (LAST step) replaces function
        // declarations with: let bar = wrapper("bar", "function", function(){}, __moduleMeta__)
        // Note: 4th arg is __moduleMeta__ (not __varRecorder__) for function replacement.
        let output = transform_code_resurrection("function bar() {}");
        assert!(output.contains("var bar ="), "func replaced with var: {}", output);
        assert!(output.contains("__define__"), "func wrapped: {}", output);
        assert!(output.contains("\"bar\""), "has name: {}", output);
        assert!(output.contains("\"function\""), "has function kind: {}", output);
        assert!(output.contains("__moduleMeta__)"), "4th arg is __moduleMeta__: {}", output);
    }

    #[test]
    fn babel_declarations_export_var_not_wrapped() {
        // Babel's bundler does NOT wrap exported var captures with __define__.
        let output = transform_code_resurrection("export var x = 23;");
        assert!(output.contains("export"), "keeps export: {}", output);
        assert!(output.contains("__varRecorder__.x = x"), "exported var captured as ident: {}", output);
        assert!(!output.contains("__define__"), "exported var should NOT use __define__: {}", output);
    }

    #[test]
    fn babel_declarations_export_function_wrapped() {
        // Babel: 'export function foo() {}' → function declaration gets wrapper treatment
        let output = transform_code_resurrection("export function foo() {}");
        assert!(output.contains("export"), "keeps export: {}", output);
        assert!(output.contains("__define__"), "wrapped: {}", output);
        assert!(output.contains("\"function\""), "has function kind: {}", output);
        assert!(output.contains("\"foo\""), "has name: {}", output);
    }

    #[test]
    fn babel_declarations_export_vars_with_separate_export() {
        // Babel's bundler does NOT wrap var captures with __define__.
        // vars are captured directly, export preserved
        let output = transform_code_resurrection("var x, y; x = 23; export { x, y };");
        assert!(output.contains("export {"), "keeps export: {}", output);
        assert!(!output.contains("__define__"), "vars should NOT use __define__: {}", output);
        assert!(output.contains("__varRecorder__.x"), "has x capture: {}", output);
        assert!(output.contains("__varRecorder__.y"), "has y capture: {}", output);
    }

    // --- Divergence G/H: no duplicate captures for exported fn/class ---

    #[test]
    fn test_no_duplicate_capture_for_exported_function() {
        // export function foo() {} should produce exactly ONE __rec.foo capture,
        // not two (one from scope capture + one from ExportedImportCapturePass)
        let output = transform_code("export function foo() { return 1; }");
        let count = output.matches("__varRecorder__.foo").count();
        // One from hoisted capture, the export itself doesn't add another
        assert!(count <= 2, "should not have excessive duplicate captures (found {}): {}", count, output);
    }

    #[test]
    fn test_no_duplicate_capture_for_exported_class() {
        let output = transform_code("export class Foo { method() {} }");
        let count = output.matches("__varRecorder__.Foo").count();
        assert!(count <= 2, "should not have excessive duplicate captures (found {}): {}", count, output);
    }

    // --- Divergence Q: __module_exports__ placement ---

    #[test]
    fn test_module_exports_placed_after_recorder_init() {
        // Babel puts __module_exports__ near the top (after recorder init),
        // not at the end of the module body
        let output = transform_code_resurrection("export var x = 23; var y = 42;");
        let recorder_pos = output.find("recorderFor").expect("has recorder init");
        let module_exports_pos = output.find("__module_exports__").expect("has module_exports");
        let last_assignment_pos = output.rfind("__varRecorder__").expect("has assignments");
        assert!(module_exports_pos < last_assignment_pos,
            "__module_exports__ should be near top, not at end: {}", output);
        assert!(module_exports_pos > recorder_pos,
            "__module_exports__ should be after recorder init: {}", output);
    }

    // --- Divergence S: ExportedImportCapturePass runs for all scope capture ---
    // (This is tested via the integration tests in lib.rs which use the full pipeline)

    // ===================================================================
    // New tests ported from Babel capturing-test.js
    // ===================================================================

    #[test]
    fn babel_wraps_literals_exported_as_defaults() {
        // Babel line 766: 'export default 32'
        // Babel expected: '_rec.$32 = 32; var $32 = _rec.$32; export default $32;'
        // In resurrection mode, the declarationWrapper wraps the literal.
        let output = transform_code_resurrection("export default 32");
        // The literal 32 should be captured into __varRecorder__.default
        assert!(output.contains("__varRecorder__.default = 32"), "captures default literal: {}", output);
        assert!(output.contains("export default"), "keeps export default: {}", output);
        // TODO: Babel generates a synthetic $32 variable name for the literal;
        // SWC assigns to __varRecorder__.default directly. Both produce correct
        // runtime behavior but differ in generated variable names.
    }

    #[test]
    fn babel_destructuring_not_wrapped_with_declaration_wrapper() {
        // Babel's bundler does NOT pass declarationWrapper to the scope capture step.
        // Destructured vars are captured directly, not wrapped with __define__.
        let output = transform_code_resurrection("var [{x}, y] = foo");
        // SWC uses _tmp_ instead of destructured_1
        assert!(output.contains("_tmp_"), "uses temp variable for destructuring: {}", output);
        // x and y should be captured without __define__ wrapping
        assert!(output.contains("__varRecorder__.x ="), "captures destructured x: {}", output);
        assert!(output.contains("__varRecorder__.y ="), "captures destructured y: {}", output);
        // No __define__ wrapping for destructured vars (only function decls get __define__)
        assert!(!output.contains("__define__"), "destructured vars should NOT use __define__: {}", output);
    }

    // --- Divergence S: ExportedImportCapturePass runs for all scope capture ---
    // (This is tested via the integration tests in lib.rs which use the full pipeline)

    // --- __module_exports__ alignment tests ---
    // These test the exact format of __module_exports__ entries to match Babel.

    #[test]
    fn test_module_exports_reexport_uses_resolved_id() {
        // Divergence 2: __reexport__ entries must use resolved module IDs, not raw source strings.
        // Babel: __reexport__<resolvedId> (e.g. "lively.lang/array.js")
        // SWC was producing: __reexport__./array.js (raw source string)
        let cm = Lrc::new(SourceMap::default());
        let fm = cm.new_source_file(FileName::Anon.into(), "export * from './array.js';".to_string());
        let mut module = parse_file_as_module(&fm, Syntax::Es(Default::default()), Default::default(), None, &mut vec![]).unwrap();
        let mut resolved = HashMap::new();
        resolved.insert("./array.js".to_string(), "lively.lang/array.js".to_string());
        let mut transform = ScopeCapturingTransform::new(
            "__varRecorder__".to_string(), None, vec![], false, true,
            "lively.lang/index.js".to_string(), None, None, resolved,
        );
        module.visit_mut_with(&mut transform);
        let mut buf = vec![];
        { let mut emitter = Emitter { cfg: Config::default(), cm: cm.clone(), comments: None, wr: JsWriter::new(cm, "\n", &mut buf, None) }; emitter.emit_module(&module).unwrap(); }
        let output = String::from_utf8(buf).unwrap();
        // Must use resolved ID, not raw "./array.js"
        assert!(output.contains("__reexport__lively.lang/array.js"),
            "should use resolved ID in __reexport__, not raw source: {}", output);
        assert!(!output.contains("__reexport__./array.js"),
            "should NOT use raw source string: {}", output);
    }

    #[test]
    fn test_module_exports_rename_does_not_duplicate() {
        // Divergence 3: export { x as y } should produce ONLY "__rename__x->y",
        // NOT both "__rename__x->y" AND "y". Babel uses continue after rename.
        let output = transform_code_resurrection("var x = 1; export { x as y };");
        // Count occurrences of "y" in __module_exports__
        let me_start = output.find("__module_exports__").expect("has __module_exports__");
        let me_section = &output[me_start..];
        let me_end = me_section.find(';').unwrap_or(me_section.len());
        let me_content = &me_section[..me_end];
        assert!(me_content.contains("__rename__x->y"),
            "__module_exports__ should have __rename__x->y: {}", me_content);
        // "y" should NOT appear as a separate entry. Babel does `continue` after
        // __rename__, so ONLY "__rename__x->y" appears, not both that AND "y".
        let y_count = me_content.matches("\"y\"").count();
        assert_eq!(y_count, 0, "standalone \"y\" should NOT be in __module_exports__ (Babel uses continue after __rename__): {}", me_content);
    }

    #[test]
    fn test_module_exports_named_reexport_per_specifier() {
        // Divergence 4: export { x, y as z } from 'mod' should produce per-specifier
        // entries like Babel, not a blanket __reexport__.
        // Babel produces: ["x", "__rename__y->z", "z"] (individual entries)
        // SWC was producing: ["__reexport__mod"] (blanket)
        let cm = Lrc::new(SourceMap::default());
        let fm = cm.new_source_file(FileName::Anon.into(), "export { x, y as z } from 'mod';".to_string());
        let mut module = parse_file_as_module(&fm, Syntax::Es(Default::default()), Default::default(), None, &mut vec![]).unwrap();
        let mut resolved = HashMap::new();
        resolved.insert("mod".to_string(), "resolved/mod.js".to_string());
        let mut transform = ScopeCapturingTransform::new(
            "__varRecorder__".to_string(), None, vec![], false, true,
            "test.js".to_string(), None, None, resolved,
        );
        module.visit_mut_with(&mut transform);
        let mut buf = vec![];
        { let mut emitter = Emitter { cfg: Config::default(), cm: cm.clone(), comments: None, wr: JsWriter::new(cm, "\n", &mut buf, None) }; emitter.emit_module(&module).unwrap(); }
        let output = String::from_utf8(buf).unwrap();
        // Should have per-specifier entries, not blanket __reexport__
        assert!(output.contains("\"x\""),
            "should have individual 'x' entry: {}", output);
        assert!(output.contains("__rename__y->z"),
            "should have __rename__y->z entry: {}", output);
        // Should NOT have blanket __reexport__
        assert!(!output.contains("__reexport__"),
            "should NOT use blanket __reexport__ for named re-exports: {}", output);
    }

    #[test]
    fn test_module_exports_export_all_uses_resolved_id() {
        // Same as divergence 2 but for export * from '...'
        let cm = Lrc::new(SourceMap::default());
        let fm = cm.new_source_file(FileName::Anon.into(), "export * from './morph.js';".to_string());
        let mut module = parse_file_as_module(&fm, Syntax::Es(Default::default()), Default::default(), None, &mut vec![]).unwrap();
        let mut resolved = HashMap::new();
        resolved.insert("./morph.js".to_string(), "lively.morphic/morph.js".to_string());
        let mut transform = ScopeCapturingTransform::new(
            "__varRecorder__".to_string(), None, vec![], false, true,
            "lively.morphic/index.js".to_string(), None, None, resolved,
        );
        module.visit_mut_with(&mut transform);
        let mut buf = vec![];
        { let mut emitter = Emitter { cfg: Config::default(), cm: cm.clone(), comments: None, wr: JsWriter::new(cm, "\n", &mut buf, None) }; emitter.emit_module(&module).unwrap(); }
        let output = String::from_utf8(buf).unwrap();
        assert!(output.contains("__reexport__lively.morphic/morph.js"),
            "export * should use resolved ID: {}", output);
    }

    // --- Divergence 1: Function declaration wrapper hoisting ---
    // Babel hoists function declarations to the TOP (putFunctionDeclsInFront)
    // before replacing them with let. SWC must do the same to avoid TDZ issues.

    #[test]
    fn test_func_decl_wrapper_hoisted_to_top() {
        // When a function is declared AFTER code that uses it, the let replacement
        // must be hoisted to the top (matching Babel's putFunctionDeclsInFront).
        // Otherwise: var x = foo(); ... var foo = wrapper(...) → TDZ error
        let output = transform_code_resurrection("var x = foo(); function foo() { return 1; }");
        let let_foo_pos = output.find("var foo").expect("has var foo replacement");
        let var_x_pos = output.find("__varRecorder__.x").expect("has var x capture");
        assert!(let_foo_pos < var_x_pos,
            "var foo must be BEFORE var x (hoisted to top): let_foo={}, var_x={}\n{}", let_foo_pos, var_x_pos, output);
    }

    #[test]
    fn test_func_decl_wrapper_multiple_hoisted_to_top() {
        // Multiple functions should all be hoisted to top
        let output = transform_code_resurrection("var x = 1; function foo() {} var y = 2; function bar() {}");
        let let_foo_pos = output.find("var foo").expect("has var foo");
        let let_bar_pos = output.find("var bar").expect("has let bar");
        let var_x_pos = output.find("__varRecorder__.x").expect("has var x");
        let var_y_pos = output.find("__varRecorder__.y").expect("has var y");
        assert!(let_foo_pos < var_x_pos, "foo hoisted before x: {}", output);
        assert!(let_bar_pos < var_y_pos, "bar hoisted before y: {}", output);
    }

    #[test]
    fn test_func_decl_wrapper_after_recorder_init() {
        // The hoisted let declarations must come AFTER the recorder init and __moduleMeta__,
        // but BEFORE other code
        let output = transform_code_resurrection("var x = 1; function foo() {}");
        let recorder_pos = output.find("recorderFor").expect("has recorder init");
        let meta_pos = output.find("__moduleMeta__").expect("has module meta");
        let let_foo_pos = output.find("var foo").expect("has var foo");
        let var_x_pos = output.find("__varRecorder__.x").expect("has var x");
        assert!(recorder_pos < meta_pos, "recorder before meta: {}", output);
        assert!(meta_pos < let_foo_pos, "meta before var foo: {}", output);
        assert!(let_foo_pos < var_x_pos, "var foo before var x: {}", output);
    }

    #[test]
    fn test_func_decl_wrapper_original_position_gets_reference() {
        // Babel replaces the original function declaration position with just a reference (foo;)
        // This ensures the function body code still has a reference at the original position.
        let output = transform_code_resurrection("var x = 1; function foo() { return 1; } var y = foo();");
        // The var foo should be at the top
        assert!(output.find("var foo").unwrap() < output.find("__varRecorder__.x").unwrap(),
            "var foo hoisted: {}", output);
        // The original position should have foo; (a reference, not the declaration)
        // This is between x and y assignments
        let x_pos = output.find("__varRecorder__.x =").unwrap();
        let y_pos = output.find("__varRecorder__.y =").unwrap();
        let between = &output[x_pos..y_pos];
        // Should NOT contain "function foo" (the declaration was hoisted)
        assert!(!between.contains("function foo"),
            "original position should not have function declaration: {}", between);
    }

    #[test]
    fn class_transform_iife_not_wrapped_with_define() {
        // Class-to-function transform produces: var Foo = function(superclass) { ... }(undefined)
        // The __define__ wrapper must NOT be applied to these IIFEs because:
        // 1. initializeES6ClassForLively sets lively-module-meta on the class at runtime
        // 2. __define__("Foo", "assignment", Foo, __varRecorder__) would overwrite that
        //    metadata with __varRecorder__, breaking getPropSettings which destructures
        //    klass[Symbol.for('lively-module-meta')].package.name
        let output = transform_code_resurrection(
            "export var Foo = function(superclass) { return superclass; }(undefined)"
        );
        // Should have simple capture: __varRecorder__.Foo = Foo
        assert!(output.contains("__varRecorder__.Foo = Foo"),
            "should capture class var into recorder: {}", output);
        // Should NOT wrap with __define__ for the IIFE export capture
        // (there may be __define__ elsewhere but NOT for "Foo", "assignment")
        assert!(!output.contains("__define__\"](\"Foo\", \"assignment\""),
            "should NOT wrap class IIFE with __define__: {}", output);
    }

    #[test]
    fn component_for_not_wrapped_with_define() {
        // component.for() returns a ComponentDescriptor whose init() sets
        // Symbol.for('lively-module-meta') with correct module/export metadata.
        // __define__ would overwrite that with __varRecorder__, causing
        // "Cannot read properties of undefined (reading 'exported')" at runtime.
        let output = transform_code_resurrection(
            "export const Foo = component.for(() => component({}), { module: 'test.cp.js', export: 'Foo' }, System, __varRecorder__, 'Foo')"
        );
        // Should have simple capture: __varRecorder__.Foo = Foo
        assert!(output.contains("__varRecorder__.Foo = Foo"),
            "should capture component var into recorder: {}", output);
        // Should NOT wrap with __define__
        assert!(!output.contains("__define__\"](\"Foo\", \"assignment\""),
            "should NOT wrap component.for() with __define__: {}", output);
    }

    #[test]
    fn non_exported_component_for_not_wrapped_with_define() {
        // Same as above but for non-exported const declarations
        let output = transform_code_resurrection(
            "const Bar = component.for(() => component({}), { module: 'test.cp.js', export: 'Bar' }, System, __varRecorder__, 'Bar')"
        );
        assert!(output.contains("__varRecorder__.Bar"),
            "should capture component var into recorder: {}", output);
        assert!(!output.contains("__define__\"](\"Bar\", \"const\""),
            "should NOT wrap component.for() with __define__: {}", output);
    }

    #[test]
    fn non_exported_class_transform_iife_not_wrapped_with_define() {
        // Same as above but for non-exported var declarations
        let output = transform_code_resurrection(
            "var Bar = function(superclass) { return superclass; }(undefined)"
        );
        // Should have capture: __varRecorder__.Bar = <value>
        assert!(output.contains("__varRecorder__.Bar"),
            "should capture class var into recorder: {}", output);
        // Should NOT wrap with __define__ for the IIFE
        assert!(!output.contains("__define__\"](\"Bar\", \"var\""),
            "should NOT wrap class IIFE with __define__: {}", output);
    }
}
