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
        let symbol_for = create_call_expr(
            create_member_expr(create_ident_expr("Symbol"), "for"),
            vec![to_expr_or_spread(create_string_expr("lively-instance-initialize"))],
        );
        let get_call = self.replace_super_get(symbol_for);
        let call_expr = create_call_expr(
            create_member_expr(get_call, "call"),
            {
                let mut call_args = Vec::with_capacity(args.len() + 1);
                call_args.push(to_expr_or_spread(create_ident_expr("this")));
                call_args.extend(args);
                call_args
            },
        );
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
            _ => {}
        }
        expr.visit_mut_children_with(self);
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
        }
    }

    /// Transform a class into an initializeES6ClassForLively call
    fn transform_class(&self, class_name: &str, class: &Class) -> Expr {
        // 1. Extract constructor
        let constructor = self.extract_constructor(class_name, class);

        // 2. Extract superclass
        let superclass = class
            .super_class
            .as_ref()
            .map(|s| *s.clone())
            .unwrap_or_else(|| create_ident_expr("Object"));

        // 3. Extract method descriptors
        let methods = self.extract_method_descriptors(class_name, class);

        // 4. Create class metadata
        let metadata = self.create_class_metadata(class_name);

        // 5. Create initializeES6ClassForLively call
        let init_fn = create_member_expr(
            create_ident_expr(&self.config.class_holder),
            &self.config.function_node,
        );

        create_call_expr(
            init_fn,
            vec![
                to_expr_or_spread(create_string_expr(class_name)),
                to_expr_or_spread(constructor),
                to_expr_or_spread(superclass),
                to_expr_or_spread(methods),
                to_expr_or_spread(metadata),
            ],
        )
    }

    /// Extract the constructor function from a class
    fn extract_constructor(&self, class_name: &str, class: &Class) -> Expr {
        // Find the constructor
        let mut constructor_body = None;
        let mut has_super = false;

        for member in &class.body {
            if let ClassMember::Constructor(ctor) = member {
                constructor_body = ctor.body.clone();
                // Check if it has super() call
                has_super = class.super_class.is_some();
                break;
            }
        }

        // Create constructor function
        let body = if let Some(body) = constructor_body {
            self.transform_constructor_body(class_name, body, has_super, class)
        } else {
            // Default constructor
            self.create_default_constructor(class_name, has_super, class)
        };

        Expr::Fn(FnExpr {
            ident: None,
            function: Box::new(Function {
                params: vec![], // Simplified - would need to extract actual params
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

    /// Transform constructor body to include lively hooks
    fn transform_constructor_body(&self, class_name: &str, mut body: BlockStmt, _has_super: bool, class: &Class) -> BlockStmt {
        let mut rewriter = SuperRewriter::new(class_name, &self.config.function_node, false);
        body.visit_mut_with(&mut rewriter);
        let saw_direct_super_call = rewriter.saw_direct_super_call;

        let mut stmts = Vec::new();

        // Add lively restoration check
        // if (this[Symbol.for('lively-instance-restorer')]) return this[Symbol.for('lively-instance-restorer')](this);
        let restorer_check = self.create_restorer_check();
        stmts.push(restorer_check);

        if saw_direct_super_call {
            stmts.push(Stmt::Decl(create_var_decl(VarDeclKind::Var, "_this", None)));
        }

        // Add original constructor statements
        stmts.extend(body.stmts);

        // Add class field initializations
        stmts.extend(self.extract_field_initializers(class));

        // Add initialization hook call
        // if (this[Symbol.for('lively-instance-initialize')]) this[Symbol.for('lively-instance-initialize')]();
        let init_hook = self.create_init_hook();
        stmts.push(init_hook);

        if saw_direct_super_call {
            stmts.push(Stmt::Return(ReturnStmt {
                span: DUMMY_SP,
                arg: Some(Box::new(create_ident_expr("_this"))),
            }));
        }

        BlockStmt {
            span: DUMMY_SP,
            ctxt: SyntaxContext::empty(),
            stmts,
        }
    }

    /// Create default constructor
    fn create_default_constructor(&self, class_name: &str, has_super: bool, class: &Class) -> BlockStmt {
        let mut stmts = Vec::new();

        // Add restorer check
        stmts.push(self.create_restorer_check());

        // Add super() call if needed
        if has_super {
            // super(...arguments);
            let super_call = Stmt::Expr(ExprStmt {
                span: DUMMY_SP,
                expr: Box::new(Expr::Call(CallExpr {
                    span: DUMMY_SP,
                    ctxt: SyntaxContext::empty(),
                    callee: Callee::Super(Super { span: DUMMY_SP }),
                    args: vec![ExprOrSpread {
                        spread: Some(DUMMY_SP),
                        expr: Box::new(create_ident_expr("arguments")),
                    }],
                    type_args: None,
                })),
            });
            stmts.push(super_call);
        }

        // Add field initializers
        stmts.extend(self.extract_field_initializers(class));

        // Add initialization hook
        stmts.push(self.create_init_hook());

        let mut block = BlockStmt {
            span: DUMMY_SP,
            ctxt: SyntaxContext::empty(),
            stmts,
        };

        let mut rewriter = SuperRewriter::new(class_name, &self.config.function_node, false);
        block.visit_mut_with(&mut rewriter);
        if rewriter.saw_direct_super_call {
            block.stmts.insert(1, Stmt::Decl(create_var_decl(VarDeclKind::Var, "_this", None)));
            block.stmts.push(Stmt::Return(ReturnStmt {
                span: DUMMY_SP,
                arg: Some(Box::new(create_ident_expr("_this"))),
            }));
        }

        block
    }

    /// Create restorer check statement
    fn create_restorer_check(&self) -> Stmt {
        // if (this[Symbol.for('lively-instance-restorer')]) return this[Symbol.for('lively-instance-restorer')](this);
        let symbol_expr = create_call_expr(
            create_member_expr(create_ident_expr("Symbol"), "for"),
            vec![to_expr_or_spread(create_string_expr("lively-instance-restorer"))],
        );

        let member = create_computed_member_expr(create_ident_expr("this"), symbol_expr.clone());

        let call = create_call_expr(member.clone(), vec![to_expr_or_spread(create_ident_expr("this"))]);

        Stmt::If(IfStmt {
            span: DUMMY_SP,
            test: Box::new(member),
            cons: Box::new(Stmt::Return(ReturnStmt {
                span: DUMMY_SP,
                arg: Some(Box::new(call)),
            })),
            alt: None,
        })
    }

    /// Create initialization hook call
    fn create_init_hook(&self) -> Stmt {
        // if (this[Symbol.for('lively-instance-initialize')]) this[Symbol.for('lively-instance-initialize')]();
        let symbol_expr = create_call_expr(
            create_member_expr(create_ident_expr("Symbol"), "for"),
            vec![to_expr_or_spread(create_string_expr("lively-instance-initialize"))],
        );

        let member = create_computed_member_expr(create_ident_expr("this"), symbol_expr);
        let call = create_call_expr(member.clone(), vec![]);

        Stmt::If(IfStmt {
            span: DUMMY_SP,
            test: Box::new(member),
            cons: Box::new(Stmt::Expr(ExprStmt {
                span: DUMMY_SP,
                expr: Box::new(call),
            })),
            alt: None,
        })
    }

    /// Extract class field initializers
    fn extract_field_initializers(&self, class: &Class) -> Vec<Stmt> {
        let mut stmts = Vec::new();

        for member in &class.body {
            if let ClassMember::ClassProp(prop) = member {
                if let PropName::Ident(key) = &prop.key {
                    let field_name = key.sym.to_string();

                    // this.fieldName = value
                    if let Some(value) = &prop.value {
                        let member = create_member_expr(create_ident_expr("this"), &field_name);
                        let assign = create_assign_expr(
                            expr_to_assign_target(member),
                            *value.clone(),
                        );

                        stmts.push(Stmt::Expr(ExprStmt {
                            span: DUMMY_SP,
                            expr: Box::new(assign),
                        }));
                    }
                }
            }
        }

        stmts
    }

    /// Extract method descriptors as an array
    fn extract_method_descriptors(&self, class_name: &str, class: &Class) -> Expr {
        let mut methods = Vec::new();

        for member in &class.body {
            match member {
                ClassMember::Method(method) => {
                    if let PropName::Ident(key) = &method.key {
                        if key.sym.as_ref() != "constructor" {
                            let mut function = method.function.clone();
                            let mut rewriter = SuperRewriter::new(class_name, &self.config.function_node, method.is_static);
                            function.visit_mut_with(&mut rewriter);

                            // Create method descriptor: { name: "method", kind: "method", value: function() {...} }
                            let descriptor = create_object_lit(vec![
                                create_prop("name", create_string_expr(key.sym.as_ref())),
                                create_prop(
                                    "kind",
                                    create_string_expr(match method.kind {
                                        MethodKind::Method => "method",
                                        MethodKind::Getter => "getter",
                                        MethodKind::Setter => "setter",
                                    }),
                                ),
                                create_prop(
                                    "value",
                                    Expr::Fn(FnExpr {
                                        ident: None,
                                        function,
                                    }),
                                ),
                            ]);

                            methods.push(Some(to_expr_or_spread(descriptor)));
                        }
                    }
                }
                ClassMember::PrivateMethod(_) => {
                    // Handle private methods (simplified)
                }
                _ => {}
            }
        }

        create_array_lit(methods)
    }

    /// Create class metadata object
    fn create_class_metadata(&self, class_name: &str) -> Expr {
        let mut props = vec![
            create_prop("className", create_string_expr(class_name)),
            create_prop("module", create_string_expr(&self.module_id)),
        ];

        if let Some(ref pkg) = self.package_name {
            props.push(create_prop("package", create_string_expr(pkg)));
        }

        if let Some(ref version) = self.package_version {
            props.push(create_prop("version", create_string_expr(version)));
        }

        // Add module accessor
        props.push(create_prop(
            "currentModuleAccessor",
            create_string_expr(&self.config.current_module_accessor),
        ));

        create_object_lit(props)
    }
}

impl VisitMut for ClassTransform {
    fn visit_mut_decl(&mut self, decl: &mut Decl) {
        if let Decl::Class(class_decl) = decl {
            let class_name = class_decl.ident.sym.to_string();
            let transformed = self.transform_class(&class_name, &class_decl.class);

            // Replace with variable declaration
            *decl = create_const_decl(&class_name, Some(transformed));
            return;
        }

        decl.visit_mut_children_with(self);
    }

    fn visit_mut_class_expr(&mut self, expr: &mut ClassExpr) {
        // Handle class expressions
        // This is more complex as we'd need to handle anonymous classes
        expr.visit_mut_children_with(self);
    }

    fn visit_mut_expr(&mut self, expr: &mut Expr) {
        // Transform super.method() calls to _get(superProto, 'method', this).call(this, ...)
        // This is complex and would require additional context tracking
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
}
