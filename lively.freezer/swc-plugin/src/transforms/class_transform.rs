use swc_core::common::{Spanned, SyntaxContext, DUMMY_SP};
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
        let constructor = self.extract_constructor(class);

        // 2. Extract superclass
        let superclass = class
            .super_class
            .as_ref()
            .map(|s| *s.clone())
            .unwrap_or_else(|| create_ident_expr("Object"));

        // 3. Extract method descriptors
        let methods = self.extract_method_descriptors(class);

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
    fn extract_constructor(&self, class: &Class) -> Expr {
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
            self.transform_constructor_body(body, has_super, class)
        } else {
            // Default constructor
            self.create_default_constructor(has_super, class)
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
    fn transform_constructor_body(&self, body: BlockStmt, has_super: bool, class: &Class) -> BlockStmt {
        let mut stmts = Vec::new();

        // Add lively restoration check
        // if (this[Symbol.for('lively-instance-restorer')]) return this[Symbol.for('lively-instance-restorer')](this);
        let restorer_check = self.create_restorer_check();
        stmts.push(restorer_check);

        // Add original constructor statements
        stmts.extend(body.stmts);

        // Add class field initializations
        stmts.extend(self.extract_field_initializers(class));

        // Add initialization hook call
        // if (this[Symbol.for('lively-instance-initialize')]) this[Symbol.for('lively-instance-initialize')]();
        let init_hook = self.create_init_hook();
        stmts.push(init_hook);

        BlockStmt {
            span: DUMMY_SP,
            ctxt: SyntaxContext::empty(),
            stmts,
        }
    }

    /// Create default constructor
    fn create_default_constructor(&self, has_super: bool, class: &Class) -> BlockStmt {
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

        BlockStmt {
            span: DUMMY_SP,
            ctxt: SyntaxContext::empty(),
            stmts,
        }
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
    fn extract_method_descriptors(&self, class: &Class) -> Expr {
        let mut methods = Vec::new();

        for member in &class.body {
            match member {
                ClassMember::Method(method) => {
                    if let PropName::Ident(key) = &method.key {
                        if key.sym.as_ref() != "constructor" {
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
                                        function: method.function.clone(),
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
