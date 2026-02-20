use swc_core::common::{SyntaxContext, DUMMY_SP};
use swc_core::ecma::{
    ast::*,
    visit::{VisitMut, VisitMutWith},
};

use crate::config::ClassToFunctionConfig;
use crate::utils::ast_helpers::*;

/// Transform ES6 classes to lively's class system
///
/// Transforms:
/// ```js
/// class MyClass extends Base {
///   field = 1;
///   method() { return super.method(); }
/// }
/// ```
/// into:
/// ```js
/// const MyClass = initializeES6ClassForLively(
///   "MyClass",
///   function() { /* constructor */ },
///   Base,
///   [ /* method descriptors */ ],
///   { /* class metadata */ }
/// );
/// ```
pub struct ClassTransform {
    config: ClassToFunctionConfig,
    module_id: String,
    package_name: Option<String>,
    package_version: Option<String>,
    default_class_counter: usize,
}

struct SuperRewriter {
    class_name: String,
    function_node: String,
    is_static: bool,
    saw_direct_super_call: bool,
}

impl SuperRewriter {
    fn new(class_name: &str, function_node: &str, is_static: bool) -> Self {
        Self {
            class_name: class_name.to_string(),
            function_node: function_node.to_string(),
            is_static,
            saw_direct_super_call: false,
        }
    }

    fn super_holder_expr(&self) -> Expr {
        let class_ident = create_ident_expr(&self.class_name);
        let target = if self.is_static {
            class_ident
        } else {
            create_member_expr(class_ident, "prototype")
        };
        create_call_expr(
            create_member_expr(create_ident_expr("Object"), "getPrototypeOf"),
            vec![to_expr_or_spread(target)],
        )
    }

    fn function_node_expr(&self) -> Expr {
        create_ident_expr(&self.function_node)
    }

    fn super_prop_expr(&self, prop: &SuperProp) -> Option<Expr> {
        match prop {
            SuperProp::Ident(ident) => Some(create_string_expr(ident.sym.as_ref())),
            SuperProp::Computed(computed) => Some(*computed.expr.clone()),
        }
    }

    fn private_name_to_ident_name(private_name: &PrivateName) -> IdentName {
        IdentName::new(
            format!("_{}", private_name.name.as_ref()).into(),
            DUMMY_SP,
        )
    }

    fn replace_super_get(&self, prop: Expr) -> Expr {
        create_call_expr(
            create_member_expr(self.function_node_expr(), "_get"),
            vec![
                to_expr_or_spread(self.super_holder_expr()),
                to_expr_or_spread(prop),
                to_expr_or_spread(create_ident_expr("this")),
            ],
        )
    }

    fn replace_super_set(&self, prop: Expr, value: Expr) -> Expr {
        create_call_expr(
            create_member_expr(self.function_node_expr(), "_set"),
            vec![
                to_expr_or_spread(self.super_holder_expr()),
                to_expr_or_spread(prop),
                to_expr_or_spread(value),
                to_expr_or_spread(create_ident_expr("this")),
            ],
        )
    }

    fn replace_super_method_call(&self, prop: Expr, args: Vec<ExprOrSpread>) -> Expr {
        let get_call = self.replace_super_get(prop);
        create_call_expr(
            create_member_expr(get_call, "call"),
            {
                let mut call_args = Vec::with_capacity(args.len() + 1);
                call_args.push(to_expr_or_spread(create_ident_expr("this")));
                call_args.extend(args);
                call_args
            },
        )
    }

    fn replace_direct_super_call(&mut self, args: Vec<ExprOrSpread>) -> Expr {
        self.saw_direct_super_call = true;
        // Legacy class transform routes direct super(...) through the lively
        // initializer symbol on the superclass chain.
        let init_symbol = create_call_expr(
            create_member_expr(create_ident_expr("Symbol"), "for"),
            vec![to_expr_or_spread(create_string_expr("lively-instance-initialize"))],
        );
        let get_call = create_call_expr(
            create_member_expr(self.function_node_expr(), "_get"),
            vec![
                to_expr_or_spread(self.super_holder_expr()),
                to_expr_or_spread(init_symbol),
                to_expr_or_spread(create_ident_expr("this")),
            ],
        );
        let call_expr = create_call_expr(create_member_expr(get_call, "call"), {
            let mut call_args = Vec::with_capacity(args.len() + 1);
            call_args.push(to_expr_or_spread(create_ident_expr("this")));
            call_args.extend(args);
            call_args
        });
        create_assign_expr(expr_to_assign_target(create_ident_expr("_this")), call_expr)
    }
}

impl VisitMut for SuperRewriter {
    fn visit_mut_expr(&mut self, expr: &mut Expr) {
        match expr {
            Expr::Call(call) => {
                match &mut call.callee {
                    Callee::Super(_) => {
                        let new_expr = self.replace_direct_super_call(call.args.clone());
                        *expr = new_expr;
                        return;
                    }
                    Callee::Expr(callee_expr) => {
                        if let Expr::SuperProp(super_prop) = &mut **callee_expr {
                            if let Some(prop_expr) = self.super_prop_expr(&super_prop.prop) {
                                let new_expr = self.replace_super_method_call(prop_expr, call.args.clone());
                                *expr = new_expr;
                                return;
                            }
                        }
                    }
                    Callee::Import(_) => {}
                }
            }
            Expr::SuperProp(super_prop) => {
                if let Some(prop_expr) = self.super_prop_expr(&super_prop.prop) {
                    *expr = self.replace_super_get(prop_expr);
                    return;
                }
            }
            Expr::Assign(assign) => {
                if let AssignTarget::Simple(SimpleAssignTarget::SuperProp(super_prop)) = &assign.left {
                    if let Some(prop_expr) = self.super_prop_expr(&super_prop.prop) {
                        let new_expr = self.replace_super_set(prop_expr, *assign.right.clone());
                        *expr = new_expr;
                        return;
                    }
                }
            }
            Expr::Member(member_expr) => {
                if let MemberProp::PrivateName(private_name) = &member_expr.prop {
                    member_expr.prop =
                        MemberProp::Ident(Self::private_name_to_ident_name(private_name));
                }
            }
            _ => {}
        }
        expr.visit_mut_children_with(self);
    }

    fn visit_mut_assign_expr(&mut self, assign: &mut AssignExpr) {
        if let AssignTarget::Simple(SimpleAssignTarget::Member(member_expr)) = &mut assign.left {
            if let MemberProp::PrivateName(private_name) = &member_expr.prop {
                member_expr.prop =
                    MemberProp::Ident(Self::private_name_to_ident_name(private_name));
            }
        }
        assign.visit_mut_children_with(self);
    }
}

impl ClassTransform {
    pub fn new(
        config: ClassToFunctionConfig,
        module_id: String,
        package_name: Option<String>,
        package_version: Option<String>,
    ) -> Self {
        Self {
            config,
            module_id,
            package_name,
            package_version,
            default_class_counter: 0,
        }
    }

    fn private_name_to_string(&self, private_name: &PrivateName) -> String {
        format!("_{}", private_name.name.as_ref())
    }

    /// Transform a class into an initializeES6ClassForLively call
    fn transform_class(&self, class_ident: Option<&Ident>, class: &Class, use_class_holder: bool) -> Expr {
        let class_name_for_methods = class_ident
            .map(|id| id.sym.as_ref())
            .unwrap_or("anonymous_class");

        // 1. Extract generic constructor template
        let constructor = self.extract_constructor(class_ident, class);

        // 2. Add `{ referencedAs, value }` spec for simple identifier superclasses
        let superclass_spec = match &class.super_class {
            Some(super_expr) => {
                if let Expr::Ident(super_ident) = &**super_expr {
                    create_object_lit(vec![
                        create_prop("referencedAs", create_string_expr(super_ident.sym.as_ref())),
                        create_prop("value", *super_expr.clone()),
                    ])
                } else {
                    *super_expr.clone()
                }
            }
            None => create_ident_expr("undefined"),
        };

        // 4. Extract method descriptors
        let (instance_methods, class_methods) =
            self.extract_method_descriptors(class_name_for_methods, class);

        let init_fn = parse_expr_or_ident(&self.config.function_node);
        let class_holder_expr = if use_class_holder {
            parse_expr_or_ident(&self.config.class_holder)
        } else {
            create_object_lit(vec![])
        };
        let current_module_accessor = parse_expr_or_ident(&self.config.current_module_accessor);

        let class_holder_ident = Ident::new("__lively_classholder__".into(), DUMMY_SP, SyntaxContext::empty());
        let lively_class_ident = Ident::new("__lively_class__".into(), DUMMY_SP, SyntaxContext::empty());
        let class_holder_ref = Expr::Ident(class_holder_ident.clone());
        let class_ref = Expr::Ident(lively_class_ident.clone());

        let class_init_stmts: Vec<Stmt> = if use_class_holder {
            let class_name = class_ident
                .map(|id| id.sym.as_ref())
                .expect("class holder mode requires named classes");
            let existing_class_check = Expr::Bin(BinExpr {
                span: DUMMY_SP,
                op: BinaryOp::LogicalAnd,
                left: Box::new(create_call_expr(
                    create_member_expr(class_holder_ref.clone(), "hasOwnProperty"),
                    vec![to_expr_or_spread(create_string_expr(class_name))],
                )),
                right: Box::new(Expr::Bin(BinExpr {
                    span: DUMMY_SP,
                    op: BinaryOp::EqEqEq,
                    left: Box::new(Expr::Unary(UnaryExpr {
                        span: DUMMY_SP,
                        op: UnaryOp::TypeOf,
                        arg: Box::new(create_member_expr(class_holder_ref.clone(), class_name)),
                    })),
                    right: Box::new(create_string_expr("function")),
                })),
            });
            let class_value_expr = Expr::Cond(CondExpr {
                span: DUMMY_SP,
                test: Box::new(existing_class_check),
                cons: Box::new(create_member_expr(class_holder_ref.clone(), class_name)),
                alt: Box::new(create_assign_expr(
                    expr_to_assign_target(create_member_expr(class_holder_ref.clone(), class_name)),
                    constructor,
                )),
            });
            vec![Stmt::Decl(create_var_decl_with_ident(
                VarDeclKind::Var,
                lively_class_ident.clone(),
                Some(class_value_expr),
            ))]
        } else if let Some(class_ident) = class_ident {
            let local_ident = class_ident.clone();
            vec![
                Stmt::Decl(create_var_decl_with_ident(
                    VarDeclKind::Var,
                    local_ident.clone(),
                    Some(constructor),
                )),
                Stmt::Decl(create_var_decl_with_ident(
                    VarDeclKind::Var,
                    lively_class_ident.clone(),
                    Some(Expr::Ident(local_ident)),
                )),
            ]
        } else {
            vec![Stmt::Decl(create_var_decl_with_ident(
                VarDeclKind::Var,
                lively_class_ident.clone(),
                Some(constructor),
            ))]
        };

        let freeze_guard = Expr::Bin(BinExpr {
            span: DUMMY_SP,
            op: BinaryOp::LogicalOr,
            left: Box::new(create_call_expr(
                create_member_expr(create_ident_expr("Object"), "isFrozen"),
                vec![to_expr_or_spread(class_holder_ref.clone())],
            )),
            right: Box::new(create_call_expr(
                create_member_expr(create_ident_expr("Object"), "isFrozen"),
                vec![to_expr_or_spread(create_member_expr(class_ref.clone(), "prototype"))],
            )),
        });

        let source_loc = create_object_lit(vec![
            create_prop(
                "start",
                Expr::Lit(Lit::Num(Number {
                    span: DUMMY_SP,
                    value: class.span.lo.0 as f64,
                    raw: None,
                })),
            ),
            create_prop(
                "end",
                Expr::Lit(Lit::Num(Number {
                    span: DUMMY_SP,
                    value: class.span.hi.0 as f64,
                    raw: None,
                })),
            ),
        ]);

        let initialize_call = create_call_expr(
            init_fn,
            vec![
                to_expr_or_spread(class_ref.clone()),
                to_expr_or_spread(create_ident_expr("superclass")),
                to_expr_or_spread(instance_methods),
                to_expr_or_spread(class_methods),
                to_expr_or_spread(if use_class_holder {
                    class_holder_ref.clone()
                } else {
                    create_ident_expr("null")
                }),
                to_expr_or_spread(current_module_accessor),
                to_expr_or_spread(source_loc),
            ],
        );

        let iife_fn = Expr::Fn(FnExpr {
            ident: None,
            function: Box::new(Function {
                params: vec![Param {
                    span: DUMMY_SP,
                    decorators: vec![],
                    pat: Pat::Ident(BindingIdent {
                        id: Ident::new("superclass".into(), DUMMY_SP, SyntaxContext::empty()),
                        type_ann: None,
                    }),
                }],
                decorators: vec![],
                span: DUMMY_SP,
                ctxt: SyntaxContext::empty(),
                body: Some(BlockStmt {
                    span: DUMMY_SP,
                    ctxt: SyntaxContext::empty(),
                    stmts: {
                        let mut stmts = vec![Stmt::Decl(create_var_decl_with_ident(
                            VarDeclKind::Var,
                            class_holder_ident,
                            Some(class_holder_expr),
                        ))];
                        stmts.extend(class_init_stmts);
                        stmts.push(Stmt::If(IfStmt {
                            span: DUMMY_SP,
                            test: Box::new(freeze_guard),
                            cons: Box::new(Stmt::Block(BlockStmt {
                                span: DUMMY_SP,
                                ctxt: SyntaxContext::empty(),
                                stmts: vec![Stmt::Return(ReturnStmt {
                                    span: DUMMY_SP,
                                    arg: Some(Box::new(class_ref.clone())),
                                })],
                            })),
                            alt: None,
                        }));
                        stmts.push(Stmt::Return(ReturnStmt {
                            span: DUMMY_SP,
                            arg: Some(Box::new(initialize_call)),
                        }));
                        stmts
                    },
                }),
                is_generator: false,
                is_async: false,
                type_params: None,
                return_type: None,
            }),
        });

        create_call_expr(iife_fn, vec![to_expr_or_spread(superclass_spec)])
    }

    /// Extract the constructor function from a class
    fn extract_constructor(&self, class_ident: Option<&Ident>, class: &Class) -> Expr {
        // Legacy class transform always emits a generic constructor template
        // that dispatches to Symbol.for("lively-instance-initialize").
        let restorer_symbol = create_call_expr(
            create_member_expr(create_ident_expr("Symbol"), "for"),
            vec![to_expr_or_spread(create_string_expr("lively-instance-restorer"))],
        );
        let initialize_symbol = create_call_expr(
            create_member_expr(create_ident_expr("Symbol"), "for"),
            vec![to_expr_or_spread(create_string_expr("lively-instance-initialize"))],
        );

        let first_arg_ident = Ident::new("__first_arg__".into(), DUMMY_SP, SyntaxContext::empty());
        let first_arg_ref = Expr::Ident(first_arg_ident.clone());
        let restorer_member = create_computed_member_expr(first_arg_ref.clone(), restorer_symbol);
        let restorer_check = Expr::Bin(BinExpr {
            span: DUMMY_SP,
            op: BinaryOp::LogicalAnd,
            left: Box::new(first_arg_ref),
            right: Box::new(restorer_member),
        });

        let init_call = create_call_expr(
            create_member_expr(
                create_computed_member_expr(create_ident_expr("this"), initialize_symbol),
                "apply",
            ),
            vec![
                to_expr_or_spread(create_ident_expr("this")),
                to_expr_or_spread(create_ident_expr("arguments")),
            ],
        );

        let mut else_stmts = self.extract_field_initializers(class);
        else_stmts.push(Stmt::Return(ReturnStmt {
            span: DUMMY_SP,
            arg: Some(Box::new(init_call)),
        }));

        let body = BlockStmt {
            span: DUMMY_SP,
            ctxt: SyntaxContext::empty(),
            stmts: vec![Stmt::If(IfStmt {
                span: DUMMY_SP,
                test: Box::new(restorer_check),
                cons: Box::new(Stmt::Block(BlockStmt {
                    span: DUMMY_SP,
                    ctxt: SyntaxContext::empty(),
                    stmts: vec![],
                })),
                alt: Some(Box::new(Stmt::Block(BlockStmt {
                    span: DUMMY_SP,
                    ctxt: SyntaxContext::empty(),
                    stmts: else_stmts,
                }))),
            })],
        };

        Expr::Fn(FnExpr {
            ident: class_ident.cloned(),
            function: Box::new(Function {
                params: vec![Param {
                    span: DUMMY_SP,
                    decorators: vec![],
                    pat: Pat::Ident(BindingIdent {
                        id: first_arg_ident,
                        type_ann: None,
                    }),
                }],
                decorators: vec![],
                span: DUMMY_SP,
                ctxt: SyntaxContext::empty(),
                body: Some(body),
                is_generator: false,
                is_async: false,
                type_params: None,
                return_type: None,
            }),
        })
    }

    fn map_constructor_params(&self, ctor: &Constructor) -> Vec<Param> {
        ctor.params
            .iter()
            .map(|param| match param {
                ParamOrTsParamProp::Param(param) => param.clone(),
                ParamOrTsParamProp::TsParamProp(ts_param_prop) => {
                    let pat = match &ts_param_prop.param {
                        TsParamPropParam::Ident(binding_ident) => {
                            Pat::Ident(binding_ident.clone())
                        }
                        TsParamPropParam::Assign(assign_pat) => {
                            Pat::Assign(assign_pat.clone())
                        }
                    };

                    Param {
                        span: DUMMY_SP,
                        decorators: vec![],
                        pat,
                    }
                }
            })
            .collect()
    }

    fn constructor_initializer_descriptor(&self, class_name: &str, class: &Class) -> Option<Option<ExprOrSpread>> {
        for member in &class.body {
            if let ClassMember::Constructor(ctor) = member {
                let mut body = ctor.body.clone().unwrap_or(BlockStmt {
                    span: DUMMY_SP,
                    ctxt: SyntaxContext::empty(),
                    stmts: vec![],
                });
                // Legacy transform rewrites super accesses against the synthetic
                // `__lively_class__` binding created inside the class IIFE.
                let mut rewriter = SuperRewriter::new("__lively_class__", &self.config.function_node, false);
                body.visit_mut_with(&mut rewriter);
                if rewriter.saw_direct_super_call {
                    body.stmts.insert(0, Stmt::Decl(create_var_decl(VarDeclKind::Var, "_this", None)));
                    body.stmts.push(Stmt::Return(ReturnStmt {
                        span: DUMMY_SP,
                        arg: Some(Box::new(create_ident_expr("_this"))),
                    }));
                }

                let init_name = format!("{}_initialize_", class_name);
                let init_fn = Expr::Fn(FnExpr {
                    ident: Some(Ident::new(init_name.into(), DUMMY_SP, SyntaxContext::empty())),
                    function: Box::new(Function {
                        params: self.map_constructor_params(ctor),
                        decorators: vec![],
                        span: DUMMY_SP,
                        ctxt: SyntaxContext::empty(),
                        body: Some(body),
                        is_generator: false,
                        is_async: false,
                        type_params: None,
                        return_type: None,
                    }),
                });

                let descriptor = create_object_lit(vec![
                    create_prop(
                        "key",
                        create_call_expr(
                            create_member_expr(create_ident_expr("Symbol"), "for"),
                            vec![to_expr_or_spread(create_string_expr("lively-instance-initialize"))],
                        ),
                    ),
                    create_prop("value", init_fn),
                ]);
                return Some(Some(to_expr_or_spread(descriptor)));
            }
        }
        None
    }

    /// Extract class field initializers
    fn extract_field_initializers(&self, class: &Class) -> Vec<Stmt> {
        let mut stmts = Vec::new();

        for member in &class.body {
            match member {
                ClassMember::ClassProp(prop) => {
                    if let PropName::Ident(key) = &prop.key {
                        let field_name = key.sym.to_string();

                        // this.fieldName = value (defaulting to null)
                        let value = prop
                            .value
                            .as_ref()
                            .map(|v| *v.clone())
                            .unwrap_or_else(|| create_ident_expr("null"));
                        let member = create_member_expr(create_ident_expr("this"), &field_name);
                        let assign = create_assign_expr(expr_to_assign_target(member), value);

                        stmts.push(Stmt::Expr(ExprStmt {
                            span: DUMMY_SP,
                            expr: Box::new(assign),
                        }));
                    }
                }
                ClassMember::PrivateProp(prop) => {
                    let field_name = self.private_name_to_string(&prop.key);
                    let value = prop
                        .value
                        .as_ref()
                        .map(|v| *v.clone())
                        .unwrap_or_else(|| create_ident_expr("null"));
                    let member = create_member_expr(create_ident_expr("this"), &field_name);
                    let assign = create_assign_expr(expr_to_assign_target(member), value);

                    stmts.push(Stmt::Expr(ExprStmt {
                        span: DUMMY_SP,
                        expr: Box::new(assign),
                    }));
                }
                _ => {}
            }
        }

        stmts
    }

    fn create_lively_class_name_descriptor(&self, class_name: &str) -> Expr {
        let getter = Expr::Fn(FnExpr {
            ident: Some(Ident::new("get".into(), DUMMY_SP, SyntaxContext::empty())),
            function: Box::new(Function {
                params: vec![],
                decorators: vec![],
                span: DUMMY_SP,
                ctxt: SyntaxContext::empty(),
                body: Some(BlockStmt {
                    span: DUMMY_SP,
                    ctxt: SyntaxContext::empty(),
                    stmts: vec![Stmt::Return(ReturnStmt {
                        span: DUMMY_SP,
                        arg: Some(Box::new(create_string_expr(class_name))),
                    })],
                }),
                is_generator: false,
                is_async: false,
                type_params: None,
                return_type: None,
            }),
        });
        create_object_lit(vec![
            create_prop(
                "key",
                create_call_expr(
                    create_member_expr(create_ident_expr("Symbol"), "for"),
                    vec![to_expr_or_spread(create_string_expr("__LivelyClassName__"))],
                ),
            ),
            create_prop("get", getter),
        ])
    }

    fn method_key_expr(&self, key: &PropName) -> Option<Expr> {
        match key {
            PropName::Ident(id) => Some(create_string_expr(id.sym.as_ref())),
            PropName::Str(s) => Some(Expr::Lit(Lit::Str(s.clone()))),
            PropName::Num(n) => Some(Expr::Lit(Lit::Num(n.clone()))),
            PropName::Computed(c) => Some(*c.expr.clone()),
            PropName::BigInt(_) => None,
        }
    }

    /// Extract method descriptors as [instanceMethods, classMethods]
    fn extract_method_descriptors(&self, class_name: &str, class: &Class) -> (Expr, Expr) {
        let mut instance_methods = Vec::new();
        if let Some(initializer) = self.constructor_initializer_descriptor(class_name, class) {
            instance_methods.push(initializer);
        }
        let mut class_methods = vec![Some(to_expr_or_spread(self.create_lively_class_name_descriptor(class_name)))];

        for member in &class.body {
            match member {
                ClassMember::Method(method) => {
                    if let PropName::Ident(key) = &method.key {
                        if key.sym.as_ref() == "constructor" {
                            continue;
                        }
                    }

                    if let Some(key_expr) = self.method_key_expr(&method.key) {
                        let mut function = method.function.clone();
                        let mut rewriter =
                            SuperRewriter::new("__lively_class__", &self.config.function_node, method.is_static);
                        function.visit_mut_with(&mut rewriter);

                        let mut props = vec![create_prop("key", key_expr)];
                        let fn_expr = Expr::Fn(FnExpr {
                            ident: None,
                            function,
                        });
                        match method.kind {
                            MethodKind::Method => props.push(create_prop("value", fn_expr)),
                            MethodKind::Getter => props.push(create_prop("get", fn_expr)),
                            MethodKind::Setter => props.push(create_prop("set", fn_expr)),
                        }

                        let descriptor = Some(to_expr_or_spread(create_object_lit(props)));
                        if method.is_static {
                            class_methods.push(descriptor);
                        } else {
                            instance_methods.push(descriptor);
                        }
                    }
                }
                ClassMember::PrivateMethod(method) => {
                    let key_expr = create_string_expr(&self.private_name_to_string(&method.key));
                    let mut function = method.function.clone();
                    let mut rewriter =
                        SuperRewriter::new("__lively_class__", &self.config.function_node, method.is_static);
                    function.visit_mut_with(&mut rewriter);

                    let fn_expr = Expr::Fn(FnExpr {
                        ident: None,
                        function,
                    });
                    let mut props = vec![create_prop("key", key_expr)];
                    match method.kind {
                        MethodKind::Method => props.push(create_prop("value", fn_expr)),
                        MethodKind::Getter => props.push(create_prop("get", fn_expr)),
                        MethodKind::Setter => props.push(create_prop("set", fn_expr)),
                    }

                    let descriptor = Some(to_expr_or_spread(create_object_lit(props)));
                    if method.is_static {
                        class_methods.push(descriptor);
                    } else {
                        instance_methods.push(descriptor);
                    }
                }
                _ => {}
            }
        }

        (create_array_lit(instance_methods), create_array_lit(class_methods))
    }
}

impl VisitMut for ClassTransform {
    fn visit_mut_module(&mut self, module: &mut Module) {
        let mut new_body = Vec::with_capacity(module.body.len());
        for item in module.body.drain(..) {
            if let ModuleItem::ModuleDecl(ModuleDecl::ExportDefaultDecl(export_decl)) = item {
                if let DefaultDecl::Class(class_expr) = export_decl.decl {
                    let class_ident = class_expr.ident.clone().unwrap_or_else(|| {
                        let name = format!("__default_class_{}__", self.default_class_counter);
                        self.default_class_counter += 1;
                        Ident::new(name.as_str().into(), DUMMY_SP, SyntaxContext::empty())
                    });
                    let transformed = self.transform_class(Some(&class_ident), &class_expr.class, true);
                    let decl = ModuleItem::Stmt(Stmt::Decl(Decl::Var(Box::new(VarDecl {
                        span: DUMMY_SP,
                        ctxt: SyntaxContext::empty(),
                        // Legacy class transform always lowers class declarations to `var`.
                        // This avoids TDZ crashes in cyclic module evaluation.
                        kind: VarDeclKind::Var,
                        declare: false,
                        decls: vec![VarDeclarator {
                            span: DUMMY_SP,
                            name: Pat::Ident(BindingIdent {
                                id: class_ident.clone(),
                                type_ann: None,
                            }),
                            init: Some(Box::new(transformed)),
                            definite: false,
                        }],
                    }))));
                    let export = ModuleItem::ModuleDecl(ModuleDecl::ExportDefaultExpr(ExportDefaultExpr {
                        span: DUMMY_SP,
                        expr: Box::new(Expr::Ident(class_ident)),
                    }));
                    new_body.push(decl);
                    new_body.push(export);
                    continue;
                }
                new_body.push(ModuleItem::ModuleDecl(ModuleDecl::ExportDefaultDecl(export_decl)));
                continue;
            }
            new_body.push(item);
        }
        module.body = new_body;
        module.visit_mut_children_with(self);
    }

    fn visit_mut_decl(&mut self, decl: &mut Decl) {
        if let Decl::Class(class_decl) = decl {
            let transformed = self.transform_class(Some(&class_decl.ident), &class_decl.class, true);

            // Replace with variable declaration
            *decl = create_var_decl_with_ident(
                // Keep parity with lively.classes/class-to-function-transform.js
                // (`result = n.varDecl(..., 'var')`).
                VarDeclKind::Var,
                class_decl.ident.clone(),
                Some(transformed),
            );
            return;
        }

        decl.visit_mut_children_with(self);
    }

    fn visit_mut_expr(&mut self, expr: &mut Expr) {
        if let Expr::Class(class_expr) = expr {
            let transformed = self.transform_class(class_expr.ident.as_ref(), &class_expr.class, false);
            *expr = transformed;
            return;
        }
        expr.visit_mut_children_with(self);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use swc_core::common::{sync::Lrc, FileName, SourceMap};
    use swc_core::ecma::codegen::{text_writer::JsWriter, Emitter, Config};
    use swc_core::ecma::parser::{parse_file_as_module, Syntax};
    use swc_core::ecma::visit::VisitMutWith;

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

        let config = ClassToFunctionConfig {
            class_holder: "__varRecorder__".to_string(),
            function_node: "initializeES6ClassForLively".to_string(),
            current_module_accessor: "module.id".to_string(),
        };

        let mut transform = ClassTransform::new(
            config,
            "test/module.js".to_string(),
            Some("test-package".to_string()),
            Some("1.0.0".to_string()),
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
    fn test_class_transformation() {
        let output = transform_code("class MyClass { method() { return 1; } }");
        assert!(output.contains("initializeES6ClassForLively"));
        assert!(output.contains("MyClass"));
    }

    #[test]
    fn test_preserves_constructor_params() {
        let output = transform_code("class Color { constructor(r, g, b, a) { this.r = r; this.g = g; this.b = b; this.a = a; } }");
        assert!(output.contains("function(r, g, b, a)"));
        assert!(output.contains("this.r = r"));
        assert!(output.contains("this.g = g"));
        assert!(output.contains("this.b = b"));
        assert!(output.contains("this.a = a"));
    }

    #[test]
    fn test_preserves_constructor_params_with_super() {
        let output = transform_code("class Child extends Parent { constructor(arg) { super(arg); this.arg = arg; } }");
        assert!(output.contains("function(arg)"));
        assert!(output.contains("_this = initializeES6ClassForLively._get"));
        assert!(output.contains("this.arg = arg"));
    }

    #[test]
    fn test_class_expression_self_reference_preserved() {
        let output = transform_code("const X = class NodePath { static create(h, p) { return new NodePath(h, p); } };");
        assert!(output.contains("var NodePath = function NodePath"));
        assert!(output.contains("new NodePath(h, p)"));
        assert!(!output.contains("new NodePath1(h, p)"));
    }
}
