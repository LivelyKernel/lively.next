use swc_core::common::{SyntaxContext, DUMMY_SP};
use swc_core::ecma::{
    ast::*,
    visit::{VisitMut, VisitMutWith},
};

use crate::utils::ast_helpers::*;

/// Transform that channels namespace imports through the module recorder
///
/// For resurrection builds, transforms:
/// `import * as foo from 'bar'`
/// into:
/// `import * as foo_namespace from 'bar'`
/// `const foo = (lively.FreezerRuntime || lively.frozenModules).exportsOf("bar") || foo_namespace`
pub struct NamespaceTransform {
    /// Transformed namespace imports to add after the module
    additional_decls: Vec<ModuleItem>,
    resolved_imports: std::collections::HashMap<String, String>,
}

impl NamespaceTransform {
    pub fn new(resolved_imports: std::collections::HashMap<String, String>) -> Self {
        Self {
            additional_decls: Vec::new(),
            resolved_imports,
        }
    }

    /// Create the fallback expression: (lively.FreezerRuntime || lively.frozenModules).exportsOf("bar") || foo_namespace
    fn create_namespace_fallback(&self, module_src: &str, namespace_ident: &Ident) -> Expr {
        let resolved = self
            .resolved_imports
            .get(module_src)
            .map(|s| s.as_str())
            .unwrap_or(module_src);
        // (lively.FreezerRuntime || lively.frozenModules)
        let lively_runtime = Expr::Paren(ParenExpr {
            span: DUMMY_SP,
            expr: Box::new(Expr::Bin(BinExpr {
                span: DUMMY_SP,
                op: BinaryOp::LogicalOr,
                left: Box::new(create_member_expr(
                    create_ident_expr("lively"),
                    "FreezerRuntime",
                )),
                right: Box::new(create_member_expr(
                    create_ident_expr("lively"),
                    "frozenModules",
                )),
            })),
        });

        // .exportsOf("bar")
        let exports_of_call = create_call_expr(
            create_member_expr(lively_runtime, "exportsOf"),
            vec![to_expr_or_spread(create_string_expr(resolved))],
        );

        // || foo_namespace
        Expr::Bin(BinExpr {
            span: DUMMY_SP,
            op: BinaryOp::LogicalOr,
            left: Box::new(exports_of_call),
            right: Box::new(Expr::Ident(namespace_ident.clone())),
        })
    }
}

impl VisitMut for NamespaceTransform {
    fn visit_mut_module(&mut self, module: &mut Module) {
        // First pass: transform imports
        module.visit_mut_children_with(self);

        // Second pass: add additional declarations
        if !self.additional_decls.is_empty() {
            // JS parity: insert before the first statement that is neither
            // ImportDeclaration nor ExportAllDeclaration.
            let insert_pos = module
                .body
                .iter()
                .position(|item| {
                    !matches!(
                        item,
                        ModuleItem::ModuleDecl(ModuleDecl::Import(_))
                            | ModuleItem::ModuleDecl(ModuleDecl::ExportAll(_))
                    )
                })
                .unwrap_or(module.body.len());

            // Insert additional declarations
            for decl in self.additional_decls.drain(..).rev() {
                module.body.insert(insert_pos, decl);
            }
        }
    }

    fn visit_mut_import_decl(&mut self, import: &mut ImportDecl) {
        let mut has_namespace = false;
        let mut namespace_local = None;

        // Check if this import has a namespace specifier
        for spec in &import.specifiers {
            if let ImportSpecifier::Namespace(ns) = spec {
                has_namespace = true;
                namespace_local = Some(ns.local.clone());
                break;
            }
        }

        if has_namespace {
            if let Some(local) = namespace_local {
                let original_ident = local;
                let original_name = original_ident.sym.to_string();
                let namespace_ident = Ident::new(
                    format!("{}_namespace", original_name).as_str().into(),
                    DUMMY_SP,
                    original_ident.ctxt,
                );

                // Rename the import: import * as foo_namespace from 'bar'
                for spec in &mut import.specifiers {
                    if let ImportSpecifier::Namespace(ns) = spec {
                        ns.local = namespace_ident.clone();
                        break;
                    }
                }

                // Create fallback const declaration
                let module_src: String = import.src.value.to_string();
                let fallback_expr = self.create_namespace_fallback(&module_src, &namespace_ident);

                let const_decl = ModuleItem::Stmt(Stmt::Decl(create_var_decl_with_ident(
                    VarDeclKind::Const,
                    original_ident,
                    Some(fallback_expr),
                )));

                self.additional_decls.push(const_decl);
            }
        }
    }

    fn visit_mut_export_all(&mut self, export: &mut ExportAll) {
        let module_src: String = export.src.value.to_string();
        let resolved = self
            .resolved_imports
            .get(&module_src)
            .cloned()
            .unwrap_or(module_src.clone());
        let tmp_name = format!("__captured_namespace_{}__", self.additional_decls.len());
        let import_decl = ModuleItem::ModuleDecl(ModuleDecl::Import(ImportDecl {
            span: DUMMY_SP,
            specifiers: vec![ImportSpecifier::Namespace(ImportStarAsSpecifier {
                span: DUMMY_SP,
                local: Ident::new(tmp_name.as_str().into(), DUMMY_SP, SyntaxContext::empty()),
            })],
            src: Box::new(Str {
                span: DUMMY_SP,
                value: module_src.into(),
                raw: None,
            }),
            type_only: false,
            with: None,
            phase: Default::default(),
        }));

        let recorder_expr = Expr::Call(CallExpr {
            span: DUMMY_SP,
            ctxt: SyntaxContext::empty(),
            callee: Callee::Expr(Box::new(create_member_expr(
                Expr::Paren(ParenExpr {
                    span: DUMMY_SP,
                    expr: Box::new(Expr::Bin(BinExpr {
                        span: DUMMY_SP,
                        op: BinaryOp::LogicalOr,
                        left: Box::new(create_member_expr(
                            create_ident_expr("lively"),
                            "FreezerRuntime",
                        )),
                        right: Box::new(create_member_expr(
                            create_ident_expr("lively"),
                            "frozenModules",
                        )),
                    })),
                }),
                "recorderFor",
            ))),
            args: vec![
                to_expr_or_spread(create_string_expr(&resolved)),
                to_expr_or_spread(create_ident_expr("__contextModule__")),
            ],
            type_args: None,
        });

        let assign_stmt = ModuleItem::Stmt(Stmt::Expr(ExprStmt {
            span: DUMMY_SP,
            expr: Box::new(create_call_expr(
                create_member_expr(create_ident_expr("Object"), "assign"),
                vec![
                    to_expr_or_spread(recorder_expr),
                    to_expr_or_spread(create_ident_expr(&tmp_name)),
                ],
            )),
        }));

        self.additional_decls.push(import_decl);
        self.additional_decls.push(assign_stmt);
        export.visit_mut_children_with(self);
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

        let mut transform = NamespaceTransform::new(std::collections::HashMap::new());
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
    fn test_namespace_transform() {
        let output = transform_code(r#"import * as foo from 'bar';"#);
        assert!(output.contains("foo_namespace"));
        assert!(output.contains("exportsOf"));
    }
}
