use swc_core::common::{Spanned, SyntaxContext, DUMMY_SP};
use swc_core::ecma::{
    ast::*,
    visit::{VisitMut, VisitMutWith},
};

use crate::utils::ast_helpers::is_member_expr_with_names;

/// Transform that converts System.import() to native import()
///
/// Transforms:
/// `System.import("./module.js")`
/// into:
/// `import("./module.js")`
pub struct DynamicImportTransform;

impl DynamicImportTransform {
    pub fn new() -> Self {
        Self
    }
}

impl VisitMut for DynamicImportTransform {
    fn visit_mut_expr(&mut self, expr: &mut Expr) {
        // Transform System.import(arg) to import(arg)
        if let Expr::Call(CallExpr {
            callee: Callee::Expr(callee_expr),
            args,
            ..
        }) = expr
        {
            if is_member_expr_with_names(callee_expr, "System", "import") && !args.is_empty() {
                // Replace with native import()
                *expr = Expr::Call(CallExpr {
                    span: Default::default(),
                    ctxt: SyntaxContext::empty(),
                    callee: Callee::Import(Import {
                        span: Default::default(),
                        phase: Default::default(),
                    }),
                    args: vec![args[0].clone()],
                    type_args: None,
                });
                return;
            }
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

        let mut transform = DynamicImportTransform::new();
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
    fn test_system_import() {
        let output = transform_code(r#"System.import("./module.js");"#);
        assert!(output.contains(r#"import("./module.js")"#));
        assert!(!output.contains("System.import"));
    }
}
