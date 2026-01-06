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
}

impl NamespaceTransform {
    pub fn new() -> Self {
        Self {
            additional_decls: Vec::new(),
        }
    }

    /// Create the fallback expression: (lively.FreezerRuntime || lively.frozenModules).exportsOf("bar") || foo_namespace
    fn create_namespace_fallback(&self, module_src: &str, namespace_name: &str) -> Expr {
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
            vec![to_expr_or_spread(create_string_expr(module_src))],
        );

        // || foo_namespace
        Expr::Bin(BinExpr {
            span: DUMMY_SP,
            op: BinaryOp::LogicalOr,
            left: Box::new(exports_of_call),
            right: Box::new(create_ident_expr(namespace_name)),
        })
    }
}

impl VisitMut for NamespaceTransform {
    fn visit_mut_module(&mut self, module: &mut Module) {
        // First pass: transform imports
        module.visit_mut_children_with(self);

        // Second pass: add additional declarations
        if !self.additional_decls.is_empty() {
            // Find where to insert (after imports)
            let mut insert_pos = 0;
            for (i, item) in module.body.iter().enumerate() {
                if matches!(item, ModuleItem::ModuleDecl(ModuleDecl::Import(_))) {
                    insert_pos = i + 1;
                }
            }

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
                let original_name = local.sym.to_string();
                let namespace_name = format!("{}_namespace", original_name);

                // Rename the import: import * as foo_namespace from 'bar'
                for spec in &mut import.specifiers {
                    if let ImportSpecifier::Namespace(ns) = spec {
                        ns.local = Ident::new(namespace_name.as_str().into(), DUMMY_SP, SyntaxContext::empty());
                        break;
                    }
                }

                // Create fallback const declaration
                let module_src: String = import.src.value.to_string();
                let fallback_expr = self.create_namespace_fallback(&module_src, &namespace_name);

                let const_decl = ModuleItem::Stmt(Stmt::Decl(create_const_decl(
                    &original_name,
                    Some(fallback_expr),
                )));

                self.additional_decls.push(const_decl);
            }
        }
    }

    fn visit_mut_export_all(&mut self, export: &mut ExportAll) {
        // Transform: export * from 'module'
        // into: import * as tmp from 'module'; Object.assign(recorder, tmp)

        // This is a simplified version; full implementation would need more context
        // to access the recorder object properly
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

        let mut transform = NamespaceTransform::new();
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
