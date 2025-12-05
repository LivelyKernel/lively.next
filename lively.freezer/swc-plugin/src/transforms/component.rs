use swc_core::common::{Spanned, SyntaxContext, DUMMY_SP};
use swc_core::ecma::{
    ast::*,
    visit::{VisitMut, VisitMutWith},
};
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
}

impl ComponentTransform {
    pub fn new(module_id: String, capture_obj: String) -> Self {
        Self {
            module_id,
            capture_obj,
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
    fn wrap_component_call(&self, component_call: Expr, export_name: &str, span: swc_core::common::Span) -> Expr {
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
        create_call_expr(
            create_member_expr(create_ident_expr("component"), "for"),
            vec![
                to_expr_or_spread(arrow_fn),
                to_expr_or_spread(metadata),
                to_expr_or_spread(create_ident_expr("System")),
                to_expr_or_spread(create_ident_expr(&self.capture_obj)),
                to_expr_or_spread(create_string_expr(export_name)),
            ],
        )
    }
}

impl VisitMut for ComponentTransform {
    fn visit_mut_var_declarator(&mut self, declarator: &mut VarDeclarator) {
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

        let mut transform = ComponentTransform::new(
            "test/module.js".to_string(),
            "__varRecorder__".to_string(),
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
