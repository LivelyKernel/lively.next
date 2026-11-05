use std::collections::HashSet;
use swc_common::{sync::Lrc, FileName, SourceMap as SwcSourceMap, SyntaxContext, DUMMY_SP};
use swc_ecma_ast::*;
use swc_ecma_parser::{parse_file_as_expr, Syntax};
use swc_ecma_visit::{Visit, VisitMut, VisitMutWith, VisitWith};

use crate::config::ClassToFunctionConfig;
use crate::utils::ast_helpers::*;
use crate::utils::scope_analyzer::ScopeAnalyzer;
use crate::utils::source_position::source_position;

fn create_this_expr() -> Expr {
    Expr::This(ThisExpr { span: DUMMY_SP })
}

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
    function_node: Expr,
    source_map: Option<Lrc<dyn swc_common::SourceMapper>>,
    top_level_bindings: HashSet<Id>,
    local_bindings: Vec<HashSet<Id>>,
    _module_id: String,
    _package_name: Option<String>,
    _package_version: Option<String>,
    default_class_counter: usize,
    /// Nested classes use a local class holder, while superclass subscriptions
    /// follow binding identity independently of the function depth.
    fn_depth: u32,
}

struct SuperRewriter {
    class_name: String,
    function_node: Expr,
    is_static: bool,
    saw_direct_super_call: bool,
}

fn parse_config_expr(source: &str) -> Expr {
    let cm = Lrc::new(SwcSourceMap::default());
    let fm = cm.new_source_file(FileName::Anon.into(), source.to_string());
    parse_file_as_expr(
        &fm,
        Syntax::Es(Default::default()),
        Default::default(),
        None,
        &mut vec![],
    )
    .map(|expr| *expr)
    .unwrap_or_else(|_| parse_expr_or_ident(source))
}

impl SuperRewriter {
    fn new(class_name: &str, function_node: &Expr, is_static: bool) -> Self {
        Self {
            class_name: class_name.to_string(),
            function_node: function_node.clone(),
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
        self.function_node.clone()
    }

    fn super_prop_expr(&self, prop: &SuperProp) -> Option<Expr> {
        match prop {
            SuperProp::Ident(ident) => Some(create_string_expr(ident.sym.as_ref())),
            SuperProp::Computed(computed) => Some(*computed.expr.clone()),
        }
    }

    fn private_name_to_ident_name(private_name: &PrivateName) -> IdentName {
        IdentName::new(format!("_{}", private_name.name.as_ref()).into(), DUMMY_SP)
    }

    fn replace_super_get(&self, prop: Expr) -> Expr {
        create_call_expr(
            create_member_expr(self.function_node_expr(), "_get"),
            vec![
                to_expr_or_spread(self.super_holder_expr()),
                to_expr_or_spread(prop),
                to_expr_or_spread(create_this_expr()),
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
                to_expr_or_spread(create_this_expr()),
            ],
        )
    }

    fn replace_super_method_call(&self, prop: Expr, args: Vec<ExprOrSpread>) -> Expr {
        let get_call = self.replace_super_get(prop);
        create_call_expr(create_member_expr(get_call, "call"), {
            let mut call_args = Vec::with_capacity(args.len() + 1);
            call_args.push(to_expr_or_spread(create_this_expr()));
            call_args.extend(args);
            call_args
        })
    }

    fn replace_direct_super_call(&mut self, args: Vec<ExprOrSpread>) -> Expr {
        self.saw_direct_super_call = true;
        // Legacy class transform routes direct super(...) through the lively
        // initializer symbol on the superclass chain.
        let init_symbol = create_call_expr(
            create_member_expr(create_ident_expr("Symbol"), "for"),
            vec![to_expr_or_spread(create_string_expr(
                "lively-instance-initialize",
            ))],
        );
        let get_call = create_call_expr(
            create_member_expr(self.function_node_expr(), "_get"),
            vec![
                to_expr_or_spread(self.super_holder_expr()),
                to_expr_or_spread(init_symbol),
                to_expr_or_spread(create_this_expr()),
            ],
        );
        let call_expr = create_call_expr(create_member_expr(get_call, "call"), {
            let mut call_args = Vec::with_capacity(args.len() + 1);
            call_args.push(to_expr_or_spread(create_this_expr()));
            call_args.extend(args);
            call_args
        });
        create_assign_expr(expr_to_assign_target(create_ident_expr("_this")), call_expr)
    }
}

impl VisitMut for SuperRewriter {
    fn visit_mut_expr(&mut self, expr: &mut Expr) {
        match expr {
            Expr::Call(call) => match &mut call.callee {
                Callee::Super(_) => {
                    let new_expr = self.replace_direct_super_call(call.args.clone());
                    *expr = new_expr;
                    expr.visit_mut_children_with(self);
                    return;
                }
                Callee::Expr(callee_expr) => {
                    if let Expr::SuperProp(super_prop) = &mut **callee_expr {
                        if let Some(prop_expr) = self.super_prop_expr(&super_prop.prop) {
                            let new_expr =
                                self.replace_super_method_call(prop_expr, call.args.clone());
                            *expr = new_expr;
                            expr.visit_mut_children_with(self);
                            return;
                        }
                    }
                }
                Callee::Import(_) => {}
            },
            Expr::SuperProp(super_prop) => {
                if let Some(prop_expr) = self.super_prop_expr(&super_prop.prop) {
                    *expr = self.replace_super_get(prop_expr);
                    expr.visit_mut_children_with(self);
                    return;
                }
            }
            Expr::Assign(assign) => {
                if let AssignTarget::Simple(SimpleAssignTarget::SuperProp(super_prop)) =
                    &assign.left
                {
                    if let Some(prop_expr) = self.super_prop_expr(&super_prop.prop) {
                        let new_expr = self.replace_super_set(prop_expr, *assign.right.clone());
                        *expr = new_expr;
                        expr.visit_mut_children_with(self);
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

    fn visit_mut_class(&mut self, _: &mut Class) {}

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
        let function_node = parse_config_expr(&config.function_node);
        Self {
            config,
            function_node,
            source_map: None,
            top_level_bindings: HashSet::new(),
            local_bindings: Vec::new(),
            _module_id: module_id,
            _package_name: package_name,
            _package_version: package_version,
            default_class_counter: 0,
            fn_depth: 0,
        }
    }

    pub fn with_source_map(mut self, source_map: Lrc<dyn swc_common::SourceMapper>) -> Self {
        self.source_map = Some(source_map);
        self
    }

    fn private_name_to_string(&self, private_name: &PrivateName) -> String {
        format!("_{}", private_name.name.as_ref())
    }

    fn source_position(&self, position: swc_common::BytePos) -> usize {
        self.source_map
            .as_ref()
            .map(|cm| source_position(cm.as_ref(), position))
            .unwrap_or_else(|| position.0.saturating_sub(1) as usize)
    }

    fn superclass_spec(&self, class: &Class) -> Expr {
        let Some(superclass) = &class.super_class else {
            return create_ident_expr("undefined");
        };
        if !self.config.current_module_accessor.is_empty() {
            if let Expr::Ident(ident) = &**superclass {
                let id = ident.to_id();
                if self.top_level_bindings.contains(&id)
                    && !self.local_bindings.iter().any(|scope| scope.contains(&id))
                {
                    return create_object_lit(vec![
                        create_prop("referencedAs", create_string_expr(ident.sym.as_ref())),
                        create_prop("value", *superclass.clone()),
                    ]);
                }
            }
        }
        *superclass.clone()
    }

    fn method_debug_name(
        &self,
        class_name: &str,
        key: &PropName,
        kind: MethodKind,
    ) -> Option<String> {
        match kind {
            MethodKind::Getter => return Some("get".to_owned()),
            MethodKind::Setter => return Some("set".to_owned()),
            MethodKind::Method => {}
        }
        let name = match key {
            PropName::Ident(key) => key.sym.to_string(),
            PropName::Str(key) => key.value.to_string(),
            PropName::Num(key) => key.value.to_string(),
            PropName::Computed(key) => match &*key.expr {
                Expr::Member(member) => match &member.prop {
                    MemberProp::Ident(key) => key.sym.to_string(),
                    _ => return None,
                },
                Expr::Call(call) => match call.args.first().map(|arg| &*arg.expr) {
                    Some(Expr::Lit(Lit::Str(key))) => key.value.to_string(),
                    _ => return None,
                },
                Expr::Ident(key) => key.sym.to_string(),
                Expr::Lit(Lit::Str(key)) => key.value.to_string(),
                _ => return None,
            },
            _ => return None,
        };
        let name: String = name
            .chars()
            .enumerate()
            .map(|(index, character)| {
                if character.is_ascii_alphabetic()
                    || character == '_'
                    || index > 0 && character.is_ascii_digit()
                {
                    character
                } else {
                    '_'
                }
            })
            .collect();
        Some(format!("{}_{}_", class_name, name))
    }

    /// Transform a class into an initializeES6ClassForLively call
    fn replace_class(
        &self,
        class_ident: Option<&Ident>,
        class: &Class,
        use_class_holder: bool,
        class_expression: bool,
    ) -> Expr {
        let class_name_for_methods = class_ident
            .map(|id| id.sym.as_ref())
            .unwrap_or("anonymous_class");

        // 1. Extract generic constructor template
        let constructor = self.constructor_template(class_ident, class);

        let superclass_spec = self.superclass_spec(class);
        let (instance_methods, class_methods) =
            self.class_member_descriptors(class_name_for_methods, class);
        let init_fn = self.function_node.clone();
        let class_holder_expr = if self.fn_depth == 0 {
            parse_config_expr(&self.config.class_holder)
        } else {
            create_object_lit(vec![])
        };
        let current_module_accessor = parse_config_expr(&self.config.current_module_accessor);

        let class_holder_ident = Ident::new(
            "__lively_classholder__".into(),
            DUMMY_SP,
            SyntaxContext::empty(),
        );
        let lively_class_ident =
            Ident::new("__lively_class__".into(), DUMMY_SP, SyntaxContext::empty());
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
                vec![to_expr_or_spread(create_member_expr(
                    class_ref.clone(),
                    "prototype",
                ))],
            )),
        });

        let mut source_loc_props = vec![
            create_prop(
                "start",
                Expr::Lit(Lit::Num(Number {
                    span: DUMMY_SP,
                    value: self.source_position(class.span.lo) as f64,
                    raw: None,
                })),
            ),
            create_prop(
                "end",
                Expr::Lit(Lit::Num(Number {
                    span: DUMMY_SP,
                    value: self.source_position(class.span.hi) as f64,
                    raw: None,
                })),
            ),
        ];
        if let Some(source_accessor_name) = &self.config.source_accessor_name {
            source_loc_props.push(create_prop(
                "moduleSource",
                parse_expr_or_ident(source_accessor_name),
            ));
        }
        let source_loc = create_object_lit(source_loc_props);

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

        let iife_fn = if class_expression {
            let Expr::Fn(function) = iife_fn else {
                unreachable!()
            };
            create_arrow_fn(
                function
                    .function
                    .params
                    .into_iter()
                    .map(|param| param.pat)
                    .collect(),
                BlockStmtOrExpr::BlockStmt(function.function.body.unwrap()),
            )
        } else {
            iife_fn
        };
        create_call_expr(iife_fn, vec![to_expr_or_spread(superclass_spec)])
    }

    /// Extract the constructor function from a class
    fn constructor_template(&self, class_ident: Option<&Ident>, class: &Class) -> Expr {
        // Legacy class transform always emits a generic constructor template
        // that dispatches to Symbol.for("lively-instance-initialize").
        let restorer_symbol = create_call_expr(
            create_member_expr(create_ident_expr("Symbol"), "for"),
            vec![to_expr_or_spread(create_string_expr(
                "lively-instance-restorer",
            ))],
        );
        let initialize_symbol = create_call_expr(
            create_member_expr(create_ident_expr("Symbol"), "for"),
            vec![to_expr_or_spread(create_string_expr(
                "lively-instance-initialize",
            ))],
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
                create_computed_member_expr(create_this_expr(), initialize_symbol),
                "apply",
            ),
            vec![
                to_expr_or_spread(create_this_expr()),
                to_expr_or_spread(create_ident_expr("arguments")),
            ],
        );

        let mut else_stmts = self.class_fields_initialization(class);
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
                        TsParamPropParam::Ident(binding_ident) => Pat::Ident(binding_ident.clone()),
                        TsParamPropParam::Assign(assign_pat) => Pat::Assign(assign_pat.clone()),
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

    fn constructor_initializer_descriptor(&self, class_name: &str, ctor: &Constructor) -> Expr {
        let mut body = ctor.body.clone().unwrap_or(BlockStmt {
            span: DUMMY_SP,
            ctxt: SyntaxContext::empty(),
            stmts: vec![],
        });
        // Legacy transform rewrites super accesses against the synthetic
        // `__lively_class__` binding created inside the class IIFE.
        let mut rewriter = SuperRewriter::new("__lively_class__", &self.function_node, false);
        body.visit_mut_with(&mut rewriter);
        Self::insert_this_return(&mut body, rewriter.saw_direct_super_call);

        let init_name = format!("{}_initialize_", class_name);
        let init_fn = Expr::Fn(FnExpr {
            ident: Some(Ident::new(
                init_name.into(),
                DUMMY_SP,
                SyntaxContext::empty(),
            )),
            function: Box::new(Function {
                params: {
                    let mut params = self.map_constructor_params(ctor);
                    params.visit_mut_with(&mut rewriter);
                    params
                },
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
                    vec![to_expr_or_spread(create_string_expr(
                        "lively-instance-initialize",
                    ))],
                ),
            ),
            create_prop("value", init_fn),
        ]);
        descriptor
    }

    /// Extract class field initializers
    fn class_fields_initialization(&self, class: &Class) -> Vec<Stmt> {
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
                        let member = create_member_expr(create_this_expr(), &field_name);
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
                    let member = create_member_expr(create_this_expr(), &field_name);
                    let assign = create_assign_expr(expr_to_assign_target(member), value);

                    stmts.push(Stmt::Expr(ExprStmt {
                        span: DUMMY_SP,
                        expr: Box::new(assign),
                    }));
                }
                _ => {}
            }
        }

        stmts.visit_mut_with(&mut SuperRewriter::new(
            "__lively_class__",
            &self.function_node,
            false,
        ));
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

    fn method_descriptor(&self, class_name: &str, member: &ClassMember) -> Option<(Expr, bool)> {
        let (key, function, kind, is_static) = match member {
            ClassMember::Constructor(constructor) => {
                return Some((
                    self.constructor_initializer_descriptor(class_name, constructor),
                    false,
                ))
            }
            ClassMember::Method(method) => (
                method.key.clone(),
                &method.function,
                method.kind,
                method.is_static,
            ),
            ClassMember::PrivateMethod(method) => (
                PropName::Ident(IdentName::new(
                    self.private_name_to_string(&method.key).into(),
                    DUMMY_SP,
                )),
                &method.function,
                method.kind,
                method.is_static,
            ),
            _ => return None,
        };
        let key_expr = self.method_key_expr(&key)?;
        let mut function = function.clone();
        function.visit_mut_with(&mut SuperRewriter::new(
            "__lively_class__",
            &self.function_node,
            is_static,
        ));
        let function = Expr::Fn(FnExpr {
            ident: self
                .method_debug_name(class_name, &key, kind)
                .map(|name| Ident::new(name.into(), DUMMY_SP, SyntaxContext::empty())),
            function,
        });
        let property = match kind {
            MethodKind::Method => "value",
            MethodKind::Getter => "get",
            MethodKind::Setter => "set",
        };
        Some((
            create_object_lit(vec![
                create_prop("key", key_expr),
                create_prop(property, function),
            ]),
            is_static,
        ))
    }

    // Mirror classMemberDescriptors: descriptors retain the original member order.
    fn class_member_descriptors(&self, class_name: &str, class: &Class) -> (Expr, Expr) {
        let mut instance_methods = Vec::new();
        let mut class_methods = vec![Some(to_expr_or_spread(
            self.create_lively_class_name_descriptor(class_name),
        ))];
        for member in &class.body {
            if let Some((descriptor, is_static)) = self.method_descriptor(class_name, member) {
                let descriptors = if is_static {
                    &mut class_methods
                } else {
                    &mut instance_methods
                };
                descriptors.push(Some(to_expr_or_spread(descriptor)));
            }
        }
        (
            if instance_methods.is_empty() {
                create_ident_expr("undefined")
            } else {
                create_array_lit(instance_methods)
            },
            if class_methods.is_empty() {
                create_ident_expr("undefined")
            } else {
                create_array_lit(class_methods)
            },
        )
    }

    fn insert_this_return(body: &mut BlockStmt, direct_super: bool) {
        if direct_super {
            body.stmts.insert(
                0,
                Stmt::Decl(create_var_decl(VarDeclKind::Var, "_this", None)),
            );
            body.stmts.push(Stmt::Return(ReturnStmt {
                span: DUMMY_SP,
                arg: Some(Box::new(create_ident_expr("_this"))),
            }));
        }
    }
}

fn function_var_bindings(body: &BlockStmt) -> HashSet<Id> {
    #[derive(Default)]
    struct Vars(HashSet<Id>);
    impl Visit for Vars {
        fn visit_var_decl(&mut self, declaration: &VarDecl) {
            if declaration.kind == VarDeclKind::Var {
                for item in &declaration.decls {
                    self.0.extend(extract_idents_from_pat(&item.name));
                }
            }
            declaration.visit_children_with(self);
        }
        fn visit_function(&mut self, _: &Function) {}
        fn visit_arrow_expr(&mut self, _: &ArrowExpr) {}
        fn visit_class(&mut self, _: &Class) {}
    }
    let mut variables = Vars::default();
    body.visit_with(&mut variables);
    variables.0
}

fn lexical_loop_bindings(declaration: &VarDecl) -> HashSet<Id> {
    if declaration.kind == VarDeclKind::Var {
        return HashSet::new();
    }
    declaration
        .decls
        .iter()
        .flat_map(|declarator| extract_idents_from_pat(&declarator.name))
        .collect()
}

impl VisitMut for ClassTransform {
    fn visit_mut_module(&mut self, module: &mut Module) {
        let mut analyzer = ScopeAnalyzer::new();
        module.visit_with(&mut analyzer);
        self.top_level_bindings = analyzer.top_level_vars;
        let mut new_body = Vec::with_capacity(module.body.len());
        for item in module.body.drain(..) {
            if let ModuleItem::ModuleDecl(ModuleDecl::ExportDefaultDecl(export_decl)) = item {
                if let DefaultDecl::Class(class_expr) = export_decl.decl {
                    let class_ident = class_expr.ident.clone().unwrap_or_else(|| {
                        let name = format!("__default_class_{}__", self.default_class_counter);
                        self.default_class_counter += 1;
                        Ident::new(name.as_str().into(), DUMMY_SP, SyntaxContext::empty())
                    });
                    let transformed =
                        self.replace_class(Some(&class_ident), &class_expr.class, true, false);
                    let decl = ModuleItem::Stmt(Stmt::Decl(Decl::Var(Box::new(VarDecl {
                        span: class_expr.class.span,
                        ctxt: SyntaxContext::empty(),
                        // Legacy class transform always lowers class declarations to `var`.
                        // This avoids TDZ crashes in cyclic module evaluation.
                        kind: VarDeclKind::Var,
                        declare: false,
                        decls: vec![VarDeclarator {
                            span: class_expr.class.span,
                            name: Pat::Ident(BindingIdent {
                                id: class_ident.clone(),
                                type_ann: None,
                            }),
                            init: Some(Box::new(transformed)),
                            definite: false,
                        }],
                    }))));
                    let export =
                        ModuleItem::ModuleDecl(ModuleDecl::ExportDefaultExpr(ExportDefaultExpr {
                            span: DUMMY_SP,
                            expr: Box::new(Expr::Ident(class_ident)),
                        }));
                    new_body.push(decl);
                    new_body.push(export);
                    continue;
                }
                new_body.push(ModuleItem::ModuleDecl(ModuleDecl::ExportDefaultDecl(
                    export_decl,
                )));
                continue;
            }
            new_body.push(item);
        }
        module.body = new_body;
        module.visit_mut_children_with(self);
    }

    fn visit_mut_function(&mut self, f: &mut Function) {
        let mut bindings: HashSet<Id> = f
            .params
            .iter()
            .flat_map(|param| extract_idents_from_pat(&param.pat))
            .collect();
        if let Some(body) = &f.body {
            bindings.extend(function_var_bindings(body));
        }
        self.local_bindings.push(bindings);
        self.fn_depth += 1;
        f.visit_mut_children_with(self);
        self.fn_depth -= 1;
        self.local_bindings.pop();
    }

    fn visit_mut_arrow_expr(&mut self, f: &mut ArrowExpr) {
        let mut bindings: HashSet<Id> = f.params.iter().flat_map(extract_idents_from_pat).collect();
        if let BlockStmtOrExpr::BlockStmt(body) = &*f.body {
            bindings.extend(function_var_bindings(body));
        }
        self.local_bindings.push(bindings);
        self.fn_depth += 1;
        f.visit_mut_children_with(self);
        self.fn_depth -= 1;
        self.local_bindings.pop();
    }

    fn visit_mut_fn_expr(&mut self, function: &mut FnExpr) {
        self.local_bindings
            .push(function.ident.iter().map(Ident::to_id).collect());
        function.visit_mut_children_with(self);
        self.local_bindings.pop();
    }

    fn visit_mut_block_stmt(&mut self, block: &mut BlockStmt) {
        let mut analyzer = ScopeAnalyzer::new();
        for statement in &block.stmts {
            statement.visit_with(&mut analyzer);
        }
        self.local_bindings.push(analyzer.top_level_vars);
        block.visit_mut_children_with(self);
        self.local_bindings.pop();
    }

    fn visit_mut_catch_clause(&mut self, clause: &mut CatchClause) {
        self.local_bindings.push(
            clause
                .param
                .iter()
                .flat_map(extract_idents_from_pat)
                .collect(),
        );
        clause.visit_mut_children_with(self);
        self.local_bindings.pop();
    }

    fn visit_mut_for_stmt(&mut self, statement: &mut ForStmt) {
        let bindings = match &statement.init {
            Some(VarDeclOrExpr::VarDecl(declaration)) => lexical_loop_bindings(declaration),
            _ => HashSet::new(),
        };
        self.local_bindings.push(bindings);
        statement.visit_mut_children_with(self);
        self.local_bindings.pop();
    }

    fn visit_mut_for_in_stmt(&mut self, statement: &mut ForInStmt) {
        let bindings = match &statement.left {
            ForHead::VarDecl(declaration) => lexical_loop_bindings(declaration),
            _ => HashSet::new(),
        };
        self.local_bindings.push(bindings);
        statement.visit_mut_children_with(self);
        self.local_bindings.pop();
    }

    fn visit_mut_for_of_stmt(&mut self, statement: &mut ForOfStmt) {
        let bindings = match &statement.left {
            ForHead::VarDecl(declaration) => lexical_loop_bindings(declaration),
            _ => HashSet::new(),
        };
        self.local_bindings.push(bindings);
        statement.visit_mut_children_with(self);
        self.local_bindings.pop();
    }

    fn visit_mut_var_declarator(&mut self, declaration: &mut VarDeclarator) {
        if let Some(initializer) = &mut declaration.init {
            if let Expr::Class(class) = &**initializer {
                **initializer = self.replace_class(class.ident.as_ref(), &class.class, false, true);
            }
        }
        declaration.visit_mut_children_with(self);
    }

    fn visit_mut_assign_expr(&mut self, assignment: &mut AssignExpr) {
        if let Expr::Class(class) = &*assignment.right {
            *assignment.right = self.replace_class(class.ident.as_ref(), &class.class, false, true);
        }
        assignment.visit_mut_children_with(self);
    }

    fn visit_mut_decl(&mut self, decl: &mut Decl) {
        if let Decl::Class(class_decl) = decl {
            let transformed =
                self.replace_class(Some(&class_decl.ident), &class_decl.class, true, false);
            *decl = Decl::Var(Box::new(VarDecl {
                span: class_decl.class.span,
                ctxt: SyntaxContext::empty(),
                kind: VarDeclKind::Var,
                declare: false,
                decls: vec![VarDeclarator {
                    span: class_decl.class.span,
                    name: Pat::Ident(BindingIdent {
                        id: class_decl.ident.clone(),
                        type_ann: None,
                    }),
                    init: Some(Box::new(transformed)),
                    definite: false,
                }],
            }));
            decl.visit_mut_children_with(self);
            return;
        }

        decl.visit_mut_children_with(self);
    }

    fn visit_mut_expr(&mut self, expr: &mut Expr) {
        if let Expr::Class(class_expr) = expr {
            let transformed = self.replace_class(
                class_expr.ident.as_ref(),
                &class_expr.class,
                class_expr.ident.is_some(),
                true,
            );
            *expr = transformed;
            expr.visit_mut_children_with(self);
            return;
        }
        expr.visit_mut_children_with(self);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use swc_common::{sync::Lrc, FileName, SourceMap};
    use swc_ecma_codegen::{text_writer::JsWriter, Config, Emitter};
    use swc_ecma_parser::{parse_file_as_module, Syntax};
    use swc_ecma_visit::VisitMutWith;

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

        let config = ClassToFunctionConfig {
            class_holder: "__varRecorder__".to_string(),
            function_node: "initializeES6ClassForLively".to_string(),
            current_module_accessor: "module.id".to_string(),
            source_accessor_name: None,
        };

        let mut transform = ClassTransform::new(
            config,
            "test/module.js".to_string(),
            Some("test-package".to_string()),
            Some("1.0.0".to_string()),
        )
        .with_source_map(cm.clone());

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
        assert!(
            output.contains("(r, g, b, a)"),
            "should preserve constructor params: {}",
            output
        );
        assert!(output.contains("this.r = r"), "body preserved: {}", output);
        assert!(output.contains("this.g = g"), "body preserved: {}", output);
        assert!(output.contains("this.b = b"), "body preserved: {}", output);
        assert!(output.contains("this.a = a"), "body preserved: {}", output);
    }

    #[test]
    fn test_preserves_constructor_params_with_super() {
        let output = transform_code(
            "class Child extends Parent { constructor(arg) { super(arg); this.arg = arg; } }",
        );
        assert!(
            output.contains("(arg)"),
            "should preserve constructor param: {}",
            output
        );
        assert!(
            output.contains("this.arg = arg"),
            "body preserved: {}",
            output
        );
    }

    #[test]
    fn test_default_subclass_constructor_inherits_super_initializer() {
        let output = transform_code("class Child extends Parent { method() {} }");
        assert!(
            !output.contains("Child_initialize_"),
            "subclasses without an explicit constructor should inherit the superclass initializer: {}",
            output
        );
        assert!(
            !output.contains("__super_initialize__.apply(this, arguments)"),
            "should not install a synthetic forwarding initializer: {}",
            output
        );
    }

    #[test]
    fn test_class_expression_self_reference_preserved() {
        let output = transform_code(
            "const X = class NodePath { static create(h, p) { return new NodePath(h, p); } };",
        );
        assert!(output.contains("var NodePath = function NodePath"));
        assert!(output.contains("new NodePath(h, p)"));
        assert!(!output.contains("new NodePath1(h, p)"));
    }
    #[test]
    fn member_descriptors_keep_source_order_and_debug_names() {
        let output = transform_code(
            "class C { m() {} constructor() {} get x() { return 1; } set x(value) {} n() {} }",
        );
        let method = output.find("key: \"m\"").unwrap();
        let constructor = output
            .find("key: Symbol.for(\"lively-instance-initialize\")")
            .unwrap();
        let last = output.find("key: \"n\"").unwrap();
        assert!(method < constructor && constructor < last, "{output}");
        for name in [
            "function C_m_",
            "function get",
            "function set",
            "function C_n_",
        ] {
            assert!(output.contains(name), "{name}: {output}");
        }
        assert!(transform_code("class C {}").contains("superclass, undefined,"));
    }

    #[test]
    fn replacements_rewrite_nested_super_arguments_and_assignment_values() {
        let output = transform_code("class C extends Base { constructor() { super(super.m()); } m() { return super.m(super.n()); } set x(value) { super.x = super.y; } }");
        assert!(!output.contains("super."), "{output}");
        assert!(!output.contains("super("), "{output}");
        assert!(output.matches("._get(").count() >= 5, "{output}");
    }

    #[test]
    fn fields_and_constructor_parameters_share_expression_rewriting() {
        let output = transform_code("class C extends Base { #x = 1; y = this.#x; z = super.m(); constructor(value = super.n()) { super(value); } }");
        assert!(!output.contains("#x"), "{output}");
        assert!(!output.contains("super."), "{output}");
        assert!(output.contains("this.y = this._x"), "{output}");
    }

    #[test]
    fn nested_classes_keep_their_own_super_context() {
        let output = transform_code("class Outer extends Base { make() { return class Inner extends Other { m() { return super.m(); } }; } }");
        assert!(!output.contains("class Inner"), "{output}");
        assert!(output.contains("function Inner_m_"), "{output}");
        assert_eq!(
            output
                .matches("initializeES6ClassForLively(__lively_class__,")
                .count(),
            2,
            "{output}"
        );
    }

    #[test]
    fn class_expressions_use_lexical_iifes_and_contextual_holders() {
        let output = transform_code(
            "keep(class Named { [this.key]() {} }); var Assigned = class Local {}; ",
        );
        assert!(output.contains("=>"), "{output}");
        assert!(output.contains("__lively_classholder__.Named"), "{output}");
        assert!(!output.contains("__lively_classholder__.Local"), "{output}");
    }

    #[test]
    fn superclass_subscriptions_follow_bindings_not_function_depth() {
        let output = transform_code("var Base; class Top extends Base {} function outer() { class C extends Base {} } function shadow(Base) { class D extends Base {} } class Unknown extends Missing {}");
        assert_eq!(
            output.matches("referencedAs: \"Base\"").count(),
            2,
            "{output}"
        );
        assert!(!output.contains("referencedAs: \"Missing\""), "{output}");
    }

    #[test]
    fn catch_and_lexical_loop_bindings_shadow_superclass_subscriptions() {
        for source in [
            "var Base; try {} catch (Base) { class C extends Base {} }",
            "var Base; for (let Base of values) { class C extends Base {} }",
            "var Base; for (let Base in values) { class C extends Base {} }",
            "var Base; for (let Base; condition;) { class C extends Base {} }",
        ] {
            let output = transform_code(source);
            assert!(!output.contains("referencedAs: \"Base\""), "{output}");
        }
        let output =
            transform_code("var Base; for (var Base of values) { class C extends Base {} }");
        assert!(output.contains("referencedAs: \"Base\""), "{output}");
    }

    #[test]
    fn class_metadata_uses_utf16_source_positions() {
        let output = transform_code("/* 😀 */ class C {}");
        assert!(output.contains("start: 9"), "{output}");
        assert!(output.contains("end: 19"), "{output}");
    }

    #[test]
    fn resolved_class_and_superclass_references_keep_binding_ids() {
        use swc_common::{Globals, Mark, GLOBALS};
        use swc_ecma_transforms_base::resolver;

        GLOBALS.set(&Globals::new(), || {
            let cm = Lrc::new(SourceMap::default());
            let fm = cm.new_source_file(
                FileName::Anon.into(),
                "var Base; class Outer extends Base { make() { return class Inner extends Outer { self() { return Inner; } }; } static self() { return Outer; } }".to_string(),
            );
            let mut module = parse_file_as_module(
                &fm,
                Syntax::Es(Default::default()),
                Default::default(),
                None,
                &mut vec![],
            )
            .unwrap();
            module.visit_mut_with(&mut resolver(Mark::new(), Mark::new(), false));

            #[derive(Default)]
            struct Idents(Vec<Ident>);
            impl Visit for Idents {
                fn visit_ident(&mut self, ident: &Ident) {
                    if matches!(ident.sym.as_ref(), "Base" | "Outer" | "Inner") {
                        self.0.push(ident.clone());
                    }
                }
            }
            let mut original = Idents::default();
            module.visit_with(&mut original);
            assert_eq!(original.0.len(), 7);
            assert!(original
                .0
                .iter()
                .all(|ident| ident.ctxt != SyntaxContext::empty()));

            module.visit_mut_with(&mut ClassTransform::new(
                ClassToFunctionConfig {
                    class_holder: "__varRecorder__".into(),
                    function_node: "initializeES6ClassForLively".into(),
                    current_module_accessor: "module.id".into(),
                    source_accessor_name: None,
                },
                "test/module.js".into(),
                None,
                None,
            ));

            let mut transformed = Idents::default();
            module.visit_with(&mut transformed);
            for original in original.0 {
                assert!(
                    transformed.0.iter().any(|ident| {
                        ident.span == original.span && ident.to_id() == original.to_id()
                    }),
                    "lost binding identity at {:?}: {:?}",
                    original.span,
                    original.to_id(),
                );
            }
        });
    }
}
