use crate::utils::ast_helpers::*;
use std::collections::{HashMap, HashSet};
use std::sync::LazyLock;
use swc_common::{sync::Lrc, FileName, SourceMap, Span, DUMMY_SP};
use swc_ecma_ast::*;
use swc_ecma_parser::{parse_file_as_expr, Syntax};
use swc_ecma_visit::{VisitMut, VisitMutWith};

fn template(source: &str) -> Expr {
    let cm = Lrc::new(SourceMap::default());
    let file = cm.new_source_file(FileName::Anon.into(), source.to_owned());
    let mut expression = *parse_file_as_expr(
        &file,
        Syntax::Es(Default::default()),
        Default::default(),
        None,
        &mut vec![],
    )
    .expect("valid handwritten SystemJS helper");
    struct ClearSpans;
    impl VisitMut for ClearSpans {
        fn visit_mut_span(&mut self, span: &mut Span) {
            *span = DUMMY_SP;
        }
    }
    expression.visit_mut_with(&mut ClearSpans);
    expression
}

/// Mirrors normalizeImportedNamespace in babel/transforms/systemjs.js.
pub fn normalize_imported_namespace(value: Expr) -> Expr {
    static NORMALIZER: LazyLock<Expr> = LazyLock::new(|| {
        template(
            r#"__modNS => {
        if (!__modNS || !__modNS.__useDefault || !__modNS.default || typeof __modNS.default !== "object" && typeof __modNS.default !== "function") return __modNS;
        var __modDefault = __modNS.default;
        var __normalizedNS = Object.create(__modNS);
        for (var __modKey of Object.getOwnPropertyNames(__modDefault)) {
            if (__modKey === "default" || __modKey === "__useDefault" || __modKey === "__esModule") continue;
            if (__modKey in __normalizedNS) continue;
            __normalizedNS[__modKey] = __modDefault[__modKey];
        }
        return __normalizedNS;
    }"#,
        )
    });
    create_call_expr(NORMALIZER.clone(), vec![to_expr_or_spread(value)])
}

fn schedule_export_helper(module_id: &str) -> Stmt {
    static HELPER: LazyLock<Expr> = LazyLock::new(|| {
        template(
            r#"function __livelyScheduleExport(name, value) {
        if (SystemJS.get(__livelyModuleId)) {
            var pendingExports = SystemJS.get("@lively-env").pendingExportChanges[__livelyModuleId] || (SystemJS.get("@lively-env").pendingExportChanges[__livelyModuleId] = {});
            pendingExports[name] = value;
        }
    }"#,
        )
    });
    struct ModuleId<'a>(&'a str);
    impl VisitMut for ModuleId<'_> {
        fn visit_mut_expr(&mut self, expression: &mut Expr) {
            if is_ident_with_name(expression, "__livelyModuleId") {
                *expression = create_string_expr(self.0);
            } else {
                expression.visit_mut_children_with(self);
            }
        }
    }
    let mut helper = HELPER.clone();
    helper.visit_mut_with(&mut ModuleId(module_id));
    let Expr::Fn(function) = helper else {
        unreachable!()
    };
    Stmt::Decl(Decl::Fn(FnDecl {
        ident: function.ident.unwrap(),
        declare: false,
        function: function.function,
    }))
}

/// Shared precompiled-register and browser post-SystemJS policy.
/// The pass mirrors babel/transforms/systemjs.js; AST traversal remains native.
pub struct SystemJsTransform {
    capture_obj: String,
    declaration_wrapper: Option<String>,
    excluded: HashSet<String>,
    module_id: String,
    source_accessor_name: Option<String>,
    capture_imports: bool,
    recorder_ident: Option<Ident>,
    renamed_exports: HashMap<String, String>,
}

impl SystemJsTransform {
    pub fn new(
        capture_obj: String,
        declaration_wrapper: Option<String>,
        excluded: Vec<String>,
    ) -> Self {
        Self {
            capture_obj,
            declaration_wrapper,
            excluded: excluded.into_iter().collect(),
            module_id: String::new(),
            source_accessor_name: None,
            capture_imports: true,
            recorder_ident: None,
            renamed_exports: HashMap::new(),
        }
    }
    pub fn with_module_id(mut self, module_id: String) -> Self {
        self.module_id = module_id;
        self
    }
    pub fn with_source_accessor_name(mut self, name: Option<String>) -> Self {
        self.source_accessor_name = name;
        self
    }
    pub fn with_capture_imports(mut self, enabled: bool) -> Self {
        self.capture_imports = enabled;
        self
    }

    pub fn with_recorder_ident(mut self, ident: Ident) -> Self {
        self.recorder_ident = Some(ident);
        self
    }
    pub fn with_renamed_exports(mut self, exports: HashMap<String, String>) -> Self {
        self.renamed_exports = exports;
        self
    }

    fn is_system_register_call(call: &CallExpr) -> bool {
        let Callee::Expr(callee) = &call.callee else {
            return false;
        };
        is_member_expr_with_names(callee, "System", "register")
            || is_member_expr_with_names(callee, "SystemJS", "register")
    }
    fn property_name(key: &PropName) -> Option<&str> {
        match key {
            PropName::Ident(value) => Some(&value.sym),
            PropName::Str(value) => Some(&value.value),
            _ => None,
        }
    }
    fn function_body(expression: &mut Expr) -> Option<&mut BlockStmt> {
        match expression {
            Expr::Fn(value) => value.function.body.as_mut(),
            Expr::Arrow(value) => match &mut *value.body {
                BlockStmtOrExpr::BlockStmt(body) => Some(body),
                _ => None,
            },
            _ => None,
        }
    }
    fn execute_body(property: &mut Prop) -> Option<&mut BlockStmt> {
        match property {
            Prop::KeyValue(value) if Self::property_name(&value.key) == Some("execute") => {
                Self::function_body(&mut value.value)
            }
            Prop::Method(value) if Self::property_name(&value.key) == Some("execute") => {
                value.function.body.as_mut()
            }
            _ => None,
        }
    }
    fn wrap_setter_assignment(&self, name: &str, assignment: Expr) -> Expr {
        if let Some(wrapper) = &self.declaration_wrapper {
            let mut arguments = vec![
                to_expr_or_spread(create_string_expr(name)),
                to_expr_or_spread(create_string_expr("var")),
                to_expr_or_spread(assignment),
                to_expr_or_spread(create_ident_expr(&self.capture_obj)),
            ];
            if let Some(local) = self.renamed_exports.get(name) {
                arguments.push(to_expr_or_spread(create_object_lit(vec![create_prop(
                    "exportConflict",
                    create_string_expr(local),
                )])));
            }
            create_call_expr(
                create_declaration_wrapper_callee(&self.capture_obj, wrapper),
                arguments,
            )
        } else {
            assignment
        }
    }
    fn rewrite_setter_body(&self, body: &mut BlockStmt, exports: &HashMap<String, Vec<String>>) {
        let mut statements = vec![];
        for statement in std::mem::take(&mut body.stmts) {
            let Stmt::Expr(ExprStmt { ref expr, .. }) = statement else {
                statements.push(statement);
                continue;
            };
            let Expr::Assign(assignment) = &**expr else {
                statements.push(statement);
                continue;
            };
            let AssignTarget::Simple(SimpleAssignTarget::Ident(binding)) = &assignment.left else {
                statements.push(statement);
                continue;
            };
            let name = binding.id.sym.to_string();
            if self.excluded.contains(&name) {
                statements.push(statement);
                continue;
            }
            let mut normalized = assignment.clone();
            normalized.right = Box::new(normalize_imported_namespace(*normalized.right));
            let rhs = self.wrap_setter_assignment(&name, Expr::Assign(normalized));
            statements.push(Stmt::Expr(ExprStmt {
                span: DUMMY_SP,
                expr: Box::new(create_assign_expr(
                    expr_to_assign_target(create_member_expr(
                        create_ident_expr(&self.capture_obj),
                        &name,
                    )),
                    rhs,
                )),
            }));
            for exported in exports.get(&name).into_iter().flatten() {
                statements.push(Stmt::Expr(ExprStmt {
                    span: DUMMY_SP,
                    expr: Box::new(create_call_expr(
                        create_ident_expr("__livelyScheduleExport"),
                        vec![
                            to_expr_or_spread(create_string_expr(exported)),
                            to_expr_or_spread(create_ident_expr(&name)),
                        ],
                    )),
                }));
            }
        }
        body.stmts = statements;
    }
    fn rewrite_setter(&self, expression: &mut Expr, exports: &HashMap<String, Vec<String>>) {
        fn default_parameter(pattern: &mut Pat) {
            if !matches!(pattern, Pat::Assign(_)) {
                *pattern = Pat::Assign(AssignPat {
                    span: DUMMY_SP,
                    left: Box::new(pattern.clone()),
                    right: Box::new(create_object_lit(vec![])),
                });
            }
        }
        match expression {
            Expr::Fn(value) => {
                if let Some(parameter) = value.function.params.first_mut() {
                    default_parameter(&mut parameter.pat);
                }
            }
            Expr::Arrow(value) => {
                if let Some(parameter) = value.params.first_mut() {
                    default_parameter(parameter);
                }
            }
            _ => return,
        }
        if self.capture_imports {
            if let Some(body) = Self::function_body(expression) {
                self.rewrite_setter_body(body, exports);
            }
        }
    }
    fn extract_initializer(body: &mut BlockStmt, name: &str) -> Option<Stmt> {
        // SWC may retain a one-element comma expression until its final fixer.
        for statement in &mut body.stmts {
            if let Stmt::Expr(ExprStmt { expr, .. }) = statement {
                if let Expr::Seq(sequence) = &mut **expr {
                    if sequence.exprs.len() == 1 {
                        *expr = sequence.exprs.remove(0);
                    }
                }
            }
        }

        for statement in &mut body.stmts {
            if let Stmt::Expr(ExprStmt { expr, .. }) = statement {
                if let Expr::Seq(sequence) = &mut **expr {
                    let matches=sequence.exprs.first().is_some_and(|expr| matches!(&**expr,Expr::Assign(value) if matches!(&value.left,AssignTarget::Simple(SimpleAssignTarget::Ident(binding)) if binding.id.sym.as_ref()==name)));
                    if matches && sequence.exprs.len() > 1 {
                        let initializer = sequence.exprs.remove(0);
                        if sequence.exprs.len() == 1 {
                            *expr = sequence.exprs.remove(0);
                        }
                        return Some(Stmt::Expr(ExprStmt {
                            span: DUMMY_SP,
                            expr: initializer,
                        }));
                    }
                }
            }
        }
        let assignment=body.stmts.iter().position(|statement| matches!(statement,Stmt::Expr(ExprStmt {expr,..}) if matches!(&**expr,Expr::Assign(value) if matches!(&value.left,AssignTarget::Simple(SimpleAssignTarget::Ident(binding)) if binding.id.sym.as_ref()==name))));
        let declaration = || {
            body.stmts.iter().position(|statement| matches!(statement,Stmt::Decl(Decl::Var(value)) if value.decls.first().is_some_and(|value|matches!(&value.name,Pat::Ident(binding) if binding.id.sym.as_ref()==name))))
        };
        assignment
            .or_else(declaration)
            .map(|index| body.stmts.remove(index))
    }
    fn rewrite_register(&self, call: &mut CallExpr) {
        if call.args.len() < 2 {
            return;
        }
        let factory = &mut call.args.last_mut().unwrap().expr;
        let export_name = match &**factory {
            Expr::Fn(value) => value.function.params.first().and_then(|p| {
                if let Pat::Ident(id) = &p.pat {
                    Some(id.id.sym.to_string())
                } else {
                    None
                }
            }),
            Expr::Arrow(value) => value.params.first().and_then(|p| {
                if let Pat::Ident(id) = p {
                    Some(id.id.sym.to_string())
                } else {
                    None
                }
            }),
            _ => None,
        };
        let Some(body) = Self::function_body(factory) else {
            return;
        };
        body.stmts.retain(|statement| !matches!(statement,Stmt::Expr(ExprStmt{expr,..}) if matches!(&**expr,Expr::Lit(Lit::Str(value)) if value.value.as_ref()=="use strict")));
        let Some(return_index) = body
            .stmts
            .iter()
            .rposition(|s| matches!(s, Stmt::Return(_)))
        else {
            return;
        };
        let Stmt::Return(ReturnStmt {
            arg: Some(argument),
            ..
        }) = &mut body.stmts[return_index]
        else {
            return;
        };
        let Expr::Object(object) = &mut **argument else {
            return;
        };
        let mut exports = HashMap::<String, Vec<String>>::new();
        if self.capture_imports {
            for property in &mut object.props {
                let PropOrSpread::Prop(property) = property else {
                    continue;
                };
                let Some(execute) = Self::execute_body(property) else {
                    continue;
                };
                for statement in &execute.stmts {
                    let Stmt::Expr(ExprStmt { expr, .. }) = statement else {
                        continue;
                    };
                    let Expr::Call(value) = &**expr else {
                        continue;
                    };
                    if !matches!(&value.callee,Callee::Expr(callee) if matches!(&**callee,Expr::Ident(id) if Some(id.sym.as_ref())==export_name.as_deref()))
                    {
                        continue;
                    }
                    if let (
                        Some(ExprOrSpread { expr: name, .. }),
                        Some(ExprOrSpread { expr: local, .. }),
                    ) = (value.args.first(), value.args.get(1))
                    {
                        if let (Expr::Lit(Lit::Str(name)), Expr::Ident(local)) = (&**name, &**local)
                        {
                            exports
                                .entry(local.sym.to_string())
                                .or_default()
                                .push(name.value.to_string());
                        }
                    }
                }
            }
        }
        let mut inserted = if exports.is_empty() {
            vec![]
        } else {
            vec![schedule_export_helper(&self.module_id)]
        };
        for property in &mut object.props {
            let PropOrSpread::Prop(property) = property else {
                continue;
            };
            if let Prop::KeyValue(value) = &mut **property {
                if Self::property_name(&value.key) == Some("setters") {
                    if let Expr::Array(array) = &mut *value.value {
                        for element in array.elems.iter_mut().flatten() {
                            self.rewrite_setter(&mut element.expr, &exports);
                        }
                    }
                }
            }
            if let Some(execute) = Self::execute_body(property) {
                for name in
                    std::iter::once(&self.capture_obj).chain(self.source_accessor_name.iter())
                {
                    if let Some(initializer) = Self::extract_initializer(execute, name) {
                        inserted.insert(0, initializer);
                    }
                }
            }
        }
        body.stmts
            .splice(return_index.min(1)..return_index.min(1), inserted);
        if let Some(recorder) = &self.recorder_ident {
            struct RecorderContext<'a>(&'a Ident);
            impl VisitMut for RecorderContext<'_> {
                fn visit_mut_ident(&mut self, ident: &mut Ident) {
                    if ident.sym == self.0.sym && ident.ctxt == Default::default() {
                        ident.ctxt = self.0.ctxt;
                    }
                }
            }
            body.visit_mut_with(&mut RecorderContext(recorder));
        }
    }
}
impl VisitMut for SystemJsTransform {
    fn visit_mut_call_expr(&mut self, call: &mut CallExpr) {
        if Self::is_system_register_call(call) {
            self.rewrite_register(call);
        } else {
            call.visit_mut_children_with(self);
        }
    }
    fn visit_mut_module(&mut self, module: &mut Module) {
        module.body.retain(|item|!matches!(item,ModuleItem::Stmt(Stmt::Expr(ExprStmt{expr,..})) if matches!(&**expr,Expr::Lit(Lit::Str(value)) if value.value.as_ref()=="format esm")));
        module.visit_mut_children_with(self);
    }
    fn visit_mut_script(&mut self, script: &mut Script) {
        script.body.retain(|statement|!matches!(statement,Stmt::Expr(ExprStmt{expr,..}) if matches!(&**expr,Expr::Lit(Lit::Str(value)) if value.value.as_ref()=="format esm")));
        script.visit_mut_children_with(self);
    }
}
