use swc_common::{SyntaxContext, DUMMY_SP};
use swc_ecma_ast::*;
use swc_ecma_visit::{VisitMut, VisitMutWith};

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

fn resolve_static_import_specifier(expr: &Expr) -> Option<String> {
    match expr {
        Expr::Lit(Lit::Str(s)) => Some(s.value.to_string()),
        Expr::Tpl(tpl) if tpl.exprs.is_empty() => {
            let mut result = String::new();
            for quasi in &tpl.quasis {
                let cooked = quasi.cooked.as_ref()?;
                result.push_str(&cooked.to_string());
            }
            Some(result)
        }
        Expr::Bin(BinExpr {
            op: BinaryOp::Add,
            left,
            right,
            ..
        }) => {
            let left = resolve_static_import_specifier(left)?;
            let right = resolve_static_import_specifier(right)?;
            Some(format!("{left}{right}"))
        }
        Expr::Paren(ParenExpr { expr, .. }) => resolve_static_import_specifier(expr),
        _ => None,
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
            if is_member_expr_with_names(callee_expr, "System", "import") && args.len() == 1 {
                let arg = &args[0];
                if arg.spread.is_none() {
                    if let Some(specifier) = resolve_static_import_specifier(&arg.expr) {
                        if !specifier.is_empty() {
                            // Mirror legacy behavior: only rewrite when we can resolve a concrete specifier.
                            *expr = Expr::Call(CallExpr {
                                span: Default::default(),
                                ctxt: SyntaxContext::empty(),
                                callee: Callee::Import(Import {
                                    span: Default::default(),
                                    phase: Default::default(),
                                }),
                                args: vec![ExprOrSpread {
                                    spread: None,
                                    expr: Box::new(Expr::Lit(Lit::Str(Str {
                                        span: DUMMY_SP,
                                        value: specifier.into(),
                                        raw: None,
                                    }))),
                                }],
                                type_args: None,
                            });
                            return;
                        }
                    }
                }
            }
        }

        expr.visit_mut_children_with(self);
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

    #[test]
    fn test_system_import_static_concat() {
        let output = transform_code(r#"System.import("./" + "module.js");"#);
        assert!(output.contains(r#"import("./module.js")"#));
        assert!(!output.contains("System.import"));
    }

    #[test]
    fn test_system_import_static_template() {
        let output = transform_code(r#"System.import(`./module.js`);"#);
        assert!(output.contains(r#"import("./module.js")"#));
        assert!(!output.contains("System.import"));
    }

    #[test]
    fn test_system_import_dynamic_identifier_is_not_rewritten() {
        let output = transform_code(
            r#"
const mod = "./module.js";
System.import(mod);
"#,
        );
        assert!(output.contains("System.import(mod)"));
        assert!(!output.contains("import(\"./module.js\")"));
    }

    #[test]
    fn test_system_import_dynamic_template_is_not_rewritten() {
        let output = transform_code(
            r#"
const name = "module";
System.import(`./${name}.js`);
"#,
        );
        assert!(output.contains("System.import"));
    }
}
