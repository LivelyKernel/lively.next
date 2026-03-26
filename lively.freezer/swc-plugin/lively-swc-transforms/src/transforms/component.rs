use swc_common::{Spanned, DUMMY_SP};
use swc_ecma_ast::*;
use swc_ecma_visit::{VisitMut, VisitMutWith};
use crate::utils::ast_helpers::*;

/// Transform that wraps component definitions with metadata
///
/// Transforms:
/// `const MyComp = component(...)`
/// into:
/// `const MyComp = component.for(() => component(...), {module: "...", export: "MyComp", range: {...}}, System, __varRecorder__, "MyComp")`
pub struct ComponentTransform {
    module_id: String,
    capture_obj: String,
    excluded: Vec<String>,
    depth: usize,
}

impl ComponentTransform {
    pub fn new(module_id: String, capture_obj: String, excluded: Vec<String>) -> Self {
        Self {
            module_id,
            capture_obj,
            excluded,
            depth: 0,
        }
    }

    /// Check if an expression is a call to `component(...)`
    fn is_component_call(&self, expr: &Expr) -> bool {
        match expr {
            Expr::Call(CallExpr {
                callee: Callee::Expr(callee),
                ..
            }) => is_ident_with_name(callee, "component"),
            _ => false,
        }
    }

    /// Wrap a component call with component.for(...)
    fn wrap_component_call(&self, component_call: Expr, export_name: &str, span: swc_common::Span) -> Expr {
        // Create: () => component(...)
        let arrow_fn = create_arrow_fn(
            vec![],
            BlockStmtOrExpr::Expr(Box::new(component_call)),
        );

        // Create metadata object: { module: "...", export: "MyComp", range: { start: X, end: Y } }
        let metadata = create_object_lit(vec![
            create_prop("module", create_string_expr(&self.module_id)),
            create_prop("export", create_string_expr(export_name)),
            create_prop(
                "range",
                create_object_lit(vec![
                    create_prop(
                        "start",
                        Expr::Lit(Lit::Num(Number {
                            span: DUMMY_SP,
                            value: span.lo.0 as f64,
                            raw: None,
                        })),
                    ),
                    create_prop(
                        "end",
                        Expr::Lit(Lit::Num(Number {
                            span: DUMMY_SP,
                            value: span.hi.0 as f64,
                            raw: None,
                        })),
                    ),
                ]),
            ),
        ]);

        // Create: component.for(arrowFn, metadata, System, __varRecorder__, "MyComp")
        let mut args = vec![
            to_expr_or_spread(arrow_fn),
            to_expr_or_spread(metadata),
            to_expr_or_spread(create_ident_expr("System")),
        ];

        if !self.excluded.contains(&export_name.to_string()) {
            args.push(to_expr_or_spread(create_ident_expr(&self.capture_obj)));
            args.push(to_expr_or_spread(create_string_expr(export_name)));
        }

        create_call_expr(
            create_member_expr(create_ident_expr("component"), "for"),
            args,
        )
    }
}

impl VisitMut for ComponentTransform {
    fn visit_mut_module(&mut self, module: &mut Module) {
        self.depth = 0;
        module.visit_mut_children_with(self);
    }

    fn visit_mut_function(&mut self, func: &mut Function) {
        self.depth += 1;
        func.visit_mut_children_with(self);
        self.depth -= 1;
    }

    fn visit_mut_arrow_expr(&mut self, arrow: &mut ArrowExpr) {
        self.depth += 1;
        arrow.visit_mut_children_with(self);
        self.depth -= 1;
    }

    fn visit_mut_block_stmt(&mut self, block: &mut BlockStmt) {
        if self.depth > 0 {
            self.depth += 1;
            block.visit_mut_children_with(self);
            self.depth -= 1;
            return;
        }
        block.visit_mut_children_with(self);
    }

    fn visit_mut_expr_stmt(&mut self, stmt: &mut ExprStmt) {
        if self.depth > 0 {
            stmt.visit_mut_children_with(self);
            return;
        }
        if self.is_component_call(&stmt.expr) {
            let metadata = create_object_lit(vec![
                create_prop("module", create_string_expr(&self.module_id)),
            ]);
            let arrow_fn = create_arrow_fn(
                vec![],
                BlockStmtOrExpr::Expr(stmt.expr.clone()),
            );
            *stmt = ExprStmt {
                span: stmt.span,
                expr: Box::new(create_call_expr(
                    create_member_expr(create_ident_expr("component"), "for"),
                    vec![
                        to_expr_or_spread(arrow_fn),
                        to_expr_or_spread(metadata),
                    ],
                )),
            };
            return;
        }

        stmt.visit_mut_children_with(self);
    }

    fn visit_mut_var_declarator(&mut self, declarator: &mut VarDeclarator) {
        if self.depth > 0 {
            declarator.visit_mut_children_with(self);
            return;
        }
        // Check if this is: const MyComp = component(...)
        if let Pat::Ident(BindingIdent { id, .. }) = &declarator.name {
            if let Some(init) = &mut declarator.init {
                if self.is_component_call(init) {
                    let export_name = id.sym.to_string();
                    let span = init.span();
                    *init = Box::new(self.wrap_component_call(*init.clone(), &export_name, span));
                    return;
                }
            }
        }

        declarator.visit_mut_children_with(self);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use swc_common::{sync::Lrc, FileName, SourceMap};
    use swc_ecma_codegen::{text_writer::JsWriter, Emitter, Config};
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

        let mut transform = ComponentTransform::new(
            "test/module.js".to_string(),
            "__varRecorder__".to_string(),
            vec![],
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
    fn test_component_wrapping() {
        let output = transform_code("const MyComp = component({});");
        assert!(output.contains("component.for"));
        assert!(output.contains("MyComp"));
    }
}
