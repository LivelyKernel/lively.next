use swc_core::ecma::{
    ast::*,
    utils::quote_str,
};
use swc_core::common::{SyntaxContext, DUMMY_SP};

/// Create a member expression: obj.prop
pub fn create_member_expr(obj: Expr, prop: &str) -> Expr {
    Expr::Member(MemberExpr {
        span: Default::default(),
        obj: Box::new(obj),
        prop: MemberProp::Ident(IdentName::new(prop.into(), DUMMY_SP)),
    })
}

/// Create a member expression with computed property: obj[prop]
pub fn create_computed_member_expr(obj: Expr, prop: Expr) -> Expr {
    Expr::Member(MemberExpr {
        span: Default::default(),
        obj: Box::new(obj),
        prop: MemberProp::Computed(ComputedPropName {
            span: Default::default(),
            expr: Box::new(prop),
        }),
    })
}

/// Create an identifier expression
pub fn create_ident_expr(name: &str) -> Expr {
    Expr::Ident(Ident::new(name.into(), DUMMY_SP, SyntaxContext::empty()))
}

/// Compatibility helper for expression-valued config fields.
/// Without parser support in plugin builds, we preserve historical behavior:
/// emit the source string as an identifier-shaped expr node.
#[allow(dead_code)]
pub fn parse_expression(_source: &str) -> Option<Expr> {
    None
}

/// Parse-like helper that falls back to identifier emission.
pub fn parse_expr_or_ident(source: &str) -> Expr {
    create_ident_expr(source)
}

/// Create a string literal expression
pub fn create_string_expr(value: &str) -> Expr {
    Expr::Lit(Lit::Str(quote_str!(value)))
}

/// Create a call expression: callee(args...)
pub fn create_call_expr(callee: Expr, args: Vec<ExprOrSpread>) -> Expr {
    Expr::Call(CallExpr {
        span: Default::default(),
        ctxt: SyntaxContext::empty(),
        callee: Callee::Expr(Box::new(callee)),
        args,
        type_args: None,
    })
}

/// Create an arrow function: (params) => body
pub fn create_arrow_fn(params: Vec<Pat>, body: BlockStmtOrExpr) -> Expr {
    Expr::Arrow(ArrowExpr {
        span: Default::default(),
        ctxt: SyntaxContext::empty(),
        params,
        body: Box::new(body),
        is_async: false,
        is_generator: false,
        type_params: None,
        return_type: None,
    })
}

/// Create an object literal: { key: value, ... }
pub fn create_object_lit(props: Vec<PropOrSpread>) -> Expr {
    Expr::Object(ObjectLit {
        span: Default::default(),
        props,
    })
}

/// Create a property: key: value
pub fn create_prop(key: &str, value: Expr) -> PropOrSpread {
    PropOrSpread::Prop(Box::new(Prop::KeyValue(KeyValueProp {
        key: PropName::Ident(IdentName::new(key.into(), DUMMY_SP)),
        value: Box::new(value),
    })))
}

/// Create an array literal: [elements...]
pub fn create_array_lit(elements: Vec<Option<ExprOrSpread>>) -> Expr {
    Expr::Array(ArrayLit {
        span: Default::default(),
        elems: elements,
    })
}

/// Wrap an expression in ExprOrSpread
pub fn to_expr_or_spread(expr: Expr) -> ExprOrSpread {
    ExprOrSpread {
        spread: None,
        expr: Box::new(expr),
    }
}

/// Check if an identifier is in a specific context (e.g., function parameter)
#[allow(dead_code)]
pub fn is_binding_identifier(ident: &Ident, pat: &Pat) -> bool {
    match pat {
        Pat::Ident(BindingIdent { id, .. }) => id.sym == ident.sym,
        Pat::Array(ArrayPat { elems, .. }) => elems
            .iter()
            .filter_map(|e| e.as_ref())
            .any(|p| is_binding_identifier(ident, p)),
        Pat::Object(ObjectPat { props, .. }) => props.iter().any(|prop| match prop {
            ObjectPatProp::KeyValue(kv) => is_binding_identifier(ident, &kv.value),
            ObjectPatProp::Assign(assign) => assign.key.sym == ident.sym,
            ObjectPatProp::Rest(rest) => is_binding_identifier(ident, &rest.arg),
        }),
        Pat::Rest(RestPat { arg, .. }) => is_binding_identifier(ident, arg),
        Pat::Assign(AssignPat { left, .. }) => is_binding_identifier(ident, left),
        _ => false,
    }
}

/// Extract all identifiers from a pattern (for destructuring)
pub fn extract_idents_from_pat(pat: &Pat) -> Vec<Id> {
    let mut idents = Vec::new();
    extract_idents_recursive(pat, &mut idents);
    idents
}

fn extract_idents_recursive(pat: &Pat, idents: &mut Vec<Id>) {
    match pat {
        Pat::Ident(BindingIdent { id, .. }) => {
            idents.push(id.to_id());
        }
        Pat::Array(ArrayPat { elems, .. }) => {
            for elem in elems.iter().filter_map(|e| e.as_ref()) {
                extract_idents_recursive(elem, idents);
            }
        }
        Pat::Object(ObjectPat { props, .. }) => {
            for prop in props {
                match prop {
                    ObjectPatProp::KeyValue(kv) => {
                        extract_idents_recursive(&kv.value, idents);
                    }
                    ObjectPatProp::Assign(assign) => {
                        idents.push(assign.key.to_id());
                    }
                    ObjectPatProp::Rest(rest) => {
                        extract_idents_recursive(&rest.arg, idents);
                    }
                }
            }
        }
        Pat::Rest(RestPat { arg, .. }) => {
            extract_idents_recursive(arg, idents);
        }
        Pat::Assign(AssignPat { left, .. }) => {
            extract_idents_recursive(left, idents);
        }
        _ => {}
    }
}

/// Check if an expression is a specific identifier
pub fn is_ident_with_name(expr: &Expr, name: &str) -> bool {
    match expr {
        Expr::Ident(ident) => ident.sym.as_ref() == name,
        _ => false,
    }
}

/// Check if an expression is a member expression with specific object and property
pub fn is_member_expr_with_names(expr: &Expr, obj_name: &str, prop_name: &str) -> bool {
    match expr {
        Expr::Member(MemberExpr {
            obj,
            prop: MemberProp::Ident(prop),
            ..
        }) => is_ident_with_name(obj, obj_name) && prop.sym.as_ref() == prop_name,
        _ => false,
    }
}

/// Create a variable declaration: const/let/var ident = init
pub fn create_var_decl_with_ident(kind: VarDeclKind, ident: Ident, init: Option<Expr>) -> Decl {
    Decl::Var(Box::new(VarDecl {
        span: Default::default(),
        ctxt: SyntaxContext::empty(),
        kind,
        declare: false,
        decls: vec![VarDeclarator {
            span: Default::default(),
            name: Pat::Ident(BindingIdent {
                id: ident,
                type_ann: None,
            }),
            init: init.map(Box::new),
            definite: false,
        }],
    }))
}

/// Create a variable declaration: var/let/const name = init
pub fn create_var_decl(kind: VarDeclKind, name: &str, init: Option<Expr>) -> Decl {
    create_var_decl_with_ident(
        kind,
        Ident::new(name.into(), DUMMY_SP, SyntaxContext::empty()),
        init,
    )
}

/// Clone an identifier
#[allow(dead_code)]
pub fn clone_ident(ident: &Ident) -> Ident {
    Ident {
        span: ident.span,
        ctxt: ident.ctxt,
        sym: ident.sym.clone(),
        optional: ident.optional,
    }
}

/// Convert an Expr to an AssignTarget
pub fn expr_to_assign_target(expr: Expr) -> AssignTarget {
    match expr {
        Expr::Member(member) => AssignTarget::Simple(SimpleAssignTarget::Member(member)),
        Expr::Ident(ident) => AssignTarget::Simple(SimpleAssignTarget::Ident(BindingIdent {
            id: ident,
            type_ann: None,
        })),
        Expr::Paren(paren) => AssignTarget::Simple(SimpleAssignTarget::Paren(paren)),
        Expr::OptChain(opt_chain) => AssignTarget::Simple(SimpleAssignTarget::OptChain(opt_chain)),
        Expr::SuperProp(super_prop) => AssignTarget::Simple(SimpleAssignTarget::SuperProp(super_prop)),
        _ => panic!("Cannot convert {:?} to AssignTarget", expr),
    }
}

/// Create an assignment expression: left = right
pub fn create_assign_expr(left: AssignTarget, right: Expr) -> Expr {
    Expr::Assign(AssignExpr {
        span: Default::default(),
        op: AssignOp::Assign,
        left,
        right: Box::new(right),
    })
}

/// Create a sequence expression: (expr1, expr2, ...)
#[allow(dead_code)]
pub fn create_seq_expr(exprs: Vec<Box<Expr>>) -> Expr {
    Expr::Seq(SeqExpr {
        span: Default::default(),
        exprs,
    })
}

/// Create an IIFE: (function() { ... })()
#[allow(dead_code)]
pub fn create_iife(body: BlockStmt) -> Expr {
    let func = Expr::Fn(FnExpr {
        ident: None,
        function: Box::new(Function {
            params: vec![],
            decorators: vec![],
            span: Default::default(),
            ctxt: SyntaxContext::empty(),
            body: Some(body),
            is_generator: false,
            is_async: false,
            type_params: None,
            return_type: None,
        }),
    });

    create_call_expr(func, vec![])
}
