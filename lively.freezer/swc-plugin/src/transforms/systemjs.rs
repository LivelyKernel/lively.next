use std::collections::HashSet;
use swc_core::common::DUMMY_SP;
use swc_core::ecma::{
    ast::*,
    visit::{VisitMut, VisitMutWith},
};
use crate::utils::ast_helpers::*;

/// Transform that rewrites SystemJS register calls to capture setters
///
/// For resurrection builds, captures imported values in module setters
pub struct SystemJsTransform {
    capture_obj: String,
    declaration_wrapper: Option<String>,
    excluded: HashSet<String>,
}

impl SystemJsTransform {
    pub fn new(capture_obj: String, declaration_wrapper: Option<String>, excluded: Vec<String>) -> Self {
        Self {
            capture_obj,
            declaration_wrapper,
            excluded: excluded.into_iter().collect(),
        }
    }

    fn is_system_register_call(call: &CallExpr) -> bool {
        let Callee::Expr(callee) = &call.callee else {
            return false;
        };
        let Expr::Member(MemberExpr { obj, prop, .. }) = &**callee else {
            return false;
        };
        let (Expr::Ident(obj_ident), MemberProp::Ident(prop_ident)) = (&**obj, prop) else {
            return false;
        };
        obj_ident.sym.as_ref() == "System" && prop_ident.sym.as_ref() == "register"
    }

    fn prop_name_matches(key: &PropName, name: &str) -> bool {
        match key {
            PropName::Ident(id) => id.sym.as_ref() == name,
            PropName::Str(s) => s.value.as_ref() == name,
            _ => false,
        }
    }

    fn get_block_body_mut<'a>(&self, expr: &'a mut Expr) -> Option<&'a mut BlockStmt> {
        match expr {
            Expr::Fn(FnExpr { function, .. }) => function.body.as_mut(),
            Expr::Arrow(ArrowExpr { body, .. }) => match &mut **body {
                BlockStmtOrExpr::BlockStmt(block) => Some(block),
                BlockStmtOrExpr::Expr(_) => None,
            },
            _ => None,
        }
    }

    fn capture_member(&self, name: &str) -> Expr {
        create_member_expr(create_ident_expr(&self.capture_obj), name)
    }

    fn wrap_setter_assignment(&self, name: &str, assignment_expr: Expr) -> Expr {
        if let Some(wrapper) = &self.declaration_wrapper {
            create_call_expr(
                create_ident_expr(wrapper),
                vec![
                    to_expr_or_spread(create_string_expr(name)),
                    to_expr_or_spread(create_string_expr("var")),
                    to_expr_or_spread(assignment_expr),
                    to_expr_or_spread(create_ident_expr(&self.capture_obj)),
                ],
            )
        } else {
            assignment_expr
        }
    }

    fn rewrite_setter_body(&self, body: &mut BlockStmt) {
        // setter(arg = {}) { a = arg.x } -> setter(arg = {}) { __rec.a = (a = arg.x) }
        for stmt in &mut body.stmts {
            let replacement = match stmt {
                Stmt::Expr(ExprStmt { expr, .. }) => match &**expr {
                    Expr::Assign(assign) if assign.op == AssignOp::Assign => {
                        let AssignTarget::Simple(SimpleAssignTarget::Ident(binding_ident)) = &assign.left else {
                            continue;
                        };
                        let var_name = binding_ident.id.sym.to_string();
                        if self.excluded.contains(&var_name) {
                            continue;
                        }
                        let rhs = self.wrap_setter_assignment(&var_name, Expr::Assign(assign.clone()));
                        Some(Stmt::Expr(ExprStmt {
                            span: DUMMY_SP,
                            expr: Box::new(create_assign_expr(
                                expr_to_assign_target(self.capture_member(&var_name)),
                                rhs,
                            )),
                        }))
                    }
                    _ => None,
                },
                _ => None,
            };
            if let Some(new_stmt) = replacement {
                *stmt = new_stmt;
            }
        }
    }

    fn rewrite_setter_function_expr(&self, setter_expr: &mut Expr) {
        match setter_expr {
            Expr::Fn(FnExpr { function, .. }) => {
                if let Some(param) = function.params.first_mut() {
                    let original = param.pat.clone();
                    param.pat = Pat::Assign(AssignPat {
                        span: DUMMY_SP,
                        left: Box::new(original),
                        right: Box::new(create_object_lit(vec![])),
                    });
                }
                if let Some(body) = function.body.as_mut() {
                    self.rewrite_setter_body(body);
                }
            }
            Expr::Arrow(arrow) => {
                if let Some(first) = arrow.params.first_mut() {
                    let original = first.clone();
                    *first = Pat::Assign(AssignPat {
                        span: DUMMY_SP,
                        left: Box::new(original),
                        right: Box::new(create_object_lit(vec![])),
                    });
                }
                if let BlockStmtOrExpr::BlockStmt(body) = &mut *arrow.body {
                    self.rewrite_setter_body(body);
                }
            }
            _ => {}
        }
    }

    fn extract_capture_init_stmt(&self, execute_body: &mut BlockStmt) -> Option<Stmt> {
        let idx = execute_body.stmts.iter().position(|stmt| match stmt {
            Stmt::Expr(ExprStmt { expr, .. }) => {
                if let Expr::Assign(assign) = &**expr {
                    if let AssignTarget::Simple(SimpleAssignTarget::Ident(binding_ident)) = &assign.left {
                        return binding_ident.id.sym.as_ref() == self.capture_obj;
                    }
                }
                false
            }
            Stmt::Decl(Decl::Var(var_decl)) => {
                if let Some(first) = var_decl.decls.first() {
                    if let Pat::Ident(BindingIdent { id, .. }) = &first.name {
                        return id.sym.as_ref() == self.capture_obj;
                    }
                }
                false
            }
            _ => false,
        })?;
        Some(execute_body.stmts.remove(idx))
    }

    fn rewrite_system_register_call(&self, call: &mut CallExpr) {
        if call.args.len() < 2 {
            return;
        }

        let declare_callee = &mut call.args[1].expr;
        let declare_body = match &mut **declare_callee {
            Expr::Fn(FnExpr { function, .. }) => function.body.as_mut(),
            Expr::Arrow(arrow) => match &mut *arrow.body {
                BlockStmtOrExpr::BlockStmt(block) => Some(block),
                BlockStmtOrExpr::Expr(_) => None,
            },
            _ => None,
        };
        let Some(declare_body) = declare_body else {
            return;
        };

        let Some(return_idx) = declare_body
            .stmts
            .iter()
            .rposition(|stmt| matches!(stmt, Stmt::Return(_)))
        else {
            return;
        };
        let Some(return_stmt) = declare_body.stmts.get_mut(return_idx) else {
            return;
        };
        let Stmt::Return(ReturnStmt { arg: Some(ret_arg), .. }) = return_stmt else {
            return;
        };
        let Expr::Object(ret_obj) = &mut **ret_arg else {
            return;
        };

        let mut capture_init_stmt: Option<Stmt> = None;

        for prop in &mut ret_obj.props {
            let PropOrSpread::Prop(prop) = prop else {
                continue;
            };
            let Prop::KeyValue(KeyValueProp { key, value }) = &mut **prop else {
                continue;
            };

            if Self::prop_name_matches(key, "setters") {
                let Expr::Array(ArrayLit { elems, .. }) = &mut **value else {
                    continue;
                };
                for elem in elems.iter_mut().filter_map(|elem| elem.as_mut()) {
                    self.rewrite_setter_function_expr(&mut elem.expr);
                }
                continue;
            }

            if Self::prop_name_matches(key, "execute") {
                let Some(execute_body) = self.get_block_body_mut(value) else {
                    continue;
                };
                if capture_init_stmt.is_none() {
                    capture_init_stmt = self.extract_capture_init_stmt(execute_body);
                }
            }
        }

        if let Some(init_stmt) = capture_init_stmt {
            declare_body.stmts.insert(return_idx, init_stmt);
        }
    }
}

impl VisitMut for SystemJsTransform {
    fn visit_mut_call_expr(&mut self, call: &mut CallExpr) {
        if Self::is_system_register_call(call) {
            self.rewrite_system_register_call(call);
        }

        call.visit_mut_children_with(self);
    }
}
