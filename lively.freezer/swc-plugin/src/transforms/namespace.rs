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
    /// The capture object name (e.g., "__varRecorder__")
    capture_obj: String,
    /// Synthetic identifiers created by this transform that should be
    /// excluded from the subsequent scope capture pass.
    added_excludes: Vec<String>,
}

impl NamespaceTransform {
    pub fn new(resolved_imports: std::collections::HashMap<String, String>, capture_obj: String) -> Self {
        Self {
            additional_decls: Vec::new(),
            resolved_imports,
            capture_obj,
            added_excludes: Vec::new(),
        }
    }

    /// Returns identifiers created by this transform that the scope capture
    /// should exclude (e.g., `foo_namespace`, `__captured_namespace_0__`).
    pub fn added_excludes(&self) -> &[String] {
        &self.added_excludes
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
        // Pre-pass: transform `export * as name from 'mod'` (NamedExport with
        // Namespace specifier) into:
        //   import * as name_namespace from 'mod'
        //   const name = exportsOf("mod") || name_namespace
        //   export { name }
        let mut new_body = Vec::with_capacity(module.body.len());
        for item in module.body.drain(..) {
            if let ModuleItem::ModuleDecl(ModuleDecl::ExportNamed(ref named)) = item {
                if let Some(ref src) = named.src {
                    // Check for a single Namespace specifier
                    if named.specifiers.len() == 1 {
                        if let ExportSpecifier::Namespace(ref ns_spec) = named.specifiers[0] {
                            let name = match &ns_spec.name {
                                ModuleExportName::Ident(id) => id.sym.to_string(),
                                ModuleExportName::Str(s) => s.value.to_string(),
                            };
                            let module_src = src.value.to_string();
                            let ns_name = format!("{}_namespace", name);
                            self.added_excludes.push(ns_name.clone());

                            let ns_ident = Ident::new(
                                ns_name.as_str().into(),
                                DUMMY_SP,
                                SyntaxContext::empty(),
                            );

                            // import * as name_namespace from 'mod'
                            let import_decl = ModuleItem::ModuleDecl(ModuleDecl::Import(ImportDecl {
                                span: DUMMY_SP,
                                specifiers: vec![ImportSpecifier::Namespace(ImportStarAsSpecifier {
                                    span: DUMMY_SP,
                                    local: ns_ident.clone(),
                                })],
                                src: Box::new(Str {
                                    span: DUMMY_SP,
                                    value: module_src.clone().into(),
                                    raw: None,
                                }),
                                type_only: false,
                                with: None,
                                phase: Default::default(),
                            }));
                            new_body.push(import_decl);

                            // const name = exportsOf("resolved") || name_namespace
                            let fallback_expr = self.create_namespace_fallback(&module_src, &ns_ident);
                            let name_ident = Ident::new(
                                name.as_str().into(),
                                DUMMY_SP,
                                SyntaxContext::empty(),
                            );
                            let const_decl = ModuleItem::Stmt(Stmt::Decl(create_var_decl_with_ident(
                                VarDeclKind::Const,
                                name_ident.clone(),
                                Some(fallback_expr),
                            )));
                            self.additional_decls.push(const_decl);

                            // export { name }
                            let export_named = ModuleItem::ModuleDecl(ModuleDecl::ExportNamed(NamedExport {
                                span: DUMMY_SP,
                                specifiers: vec![ExportSpecifier::Named(ExportNamedSpecifier {
                                    span: DUMMY_SP,
                                    orig: ModuleExportName::Ident(name_ident),
                                    exported: None,
                                    is_type_only: false,
                                })],
                                src: None,
                                type_only: false,
                                with: None,
                            }));
                            self.additional_decls.push(export_named);

                            continue; // skip the original export * as name from 'mod'
                        }
                    }
                }
            }
            new_body.push(item);
        }
        module.body = new_body;

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
                let ns_name = format!("{}_namespace", original_name);
                self.added_excludes.push(ns_name);
                for spec in &mut import.specifiers {
                    if let ImportSpecifier::Namespace(ns) = spec {
                        ns.local = namespace_ident.clone();
                        break;
                    }
                }

                // Create fallback const declaration:
                // const Inspector = exportsOf("dep") || Inspector_namespace
                // The scope capture will then capture this as __rec.Inspector = ...
                // The _namespace var is excluded from capture (via added_excludes).
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
        self.added_excludes.push(tmp_name.clone());
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
        let fm = cm.new_source_file(FileName::Anon.into(), code.to_string());

        let mut module = parse_file_as_module(
            &fm,
            Syntax::Es(Default::default()),
            Default::default(),
            None,
            &mut vec![],
        )
        .unwrap();

        let mut transform = NamespaceTransform::new(std::collections::HashMap::new(), "__varRecorder__".to_string());
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

    fn transform_code_with_resolved(code: &str, resolved: std::collections::HashMap<String, String>) -> (String, Vec<String>) {
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

        let mut transform = NamespaceTransform::new(resolved, "__varRecorder__".to_string());
        module.visit_mut_with(&mut transform);
        let excludes = transform.added_excludes().to_vec();

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

        (String::from_utf8(buf).unwrap(), excludes)
    }

    #[test]
    fn test_named_namespace_reexport() {
        // export * as name from 'mod' should be transformed to:
        //   import * as name_namespace from 'mod'
        //   const name = exportsOf("mod") || name_namespace
        //   export { name }
        let (output, excludes) = transform_code_with_resolved(
            r#"export * as utils from './utils.js';"#,
            std::collections::HashMap::new(),
        );
        // Should have import * as utils_namespace
        assert!(output.contains("utils_namespace"), "should create namespace import: {}", output);
        // Should have const utils = exportsOf(...) || utils_namespace
        assert!(output.contains("exportsOf"), "should have exportsOf call: {}", output);
        assert!(output.contains("const utils"), "should have const utils declaration: {}", output);
        // Should have export { utils }
        assert!(output.contains("export {"), "should have named export: {}", output);
        assert!(output.contains("utils"), "should export utils: {}", output);
        // utils_namespace should be in excludes
        assert!(excludes.contains(&"utils_namespace".to_string()), "utils_namespace should be excluded: {:?}", excludes);
    }

    #[test]
    fn test_named_namespace_reexport_with_resolved() {
        // When resolved_imports has a mapping, use the resolved ID in exportsOf
        let mut resolved = std::collections::HashMap::new();
        resolved.insert("./utils.js".to_string(), "local://package/utils.js".to_string());
        let (output, _) = transform_code_with_resolved(
            r#"export * as utils from './utils.js';"#,
            resolved,
        );
        assert!(output.contains("local://package/utils.js"), "should use resolved ID in exportsOf: {}", output);
    }

    #[test]
    fn test_unnamed_export_all_still_works() {
        // Unnamed export * from 'mod' should still work as before
        let (output, _) = transform_code_with_resolved(
            r#"export * from './utils.js';"#,
            std::collections::HashMap::new(),
        );
        assert!(output.contains("recorderFor"), "unnamed export * should use recorderFor: {}", output);
        assert!(output.contains("Object.assign"), "unnamed export * should use Object.assign: {}", output);
    }
}
