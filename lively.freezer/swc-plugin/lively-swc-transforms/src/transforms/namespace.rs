use crate::utils::{ast_helpers::*, scope_analyzer::ScopeAnalyzer};
use std::collections::{HashMap, HashSet};
use swc_common::{SyntaxContext, DUMMY_SP};
use swc_ecma_ast::*;
use swc_ecma_visit::{VisitMut, VisitWith};

/// Mirrors babel/transforms/namespace.js: imported namespaces, then reexports.
pub struct NamespaceTransform {
    resolved_imports: HashMap<String, String>,
    added_excludes: Vec<String>,
    used_names: HashSet<String>,
}

impl NamespaceTransform {
    pub fn new(resolved_imports: HashMap<String, String>, _capture_obj: String) -> Self {
        Self {
            resolved_imports,
            added_excludes: vec![],
            used_names: HashSet::new(),
        }
    }

    pub fn added_excludes(&self) -> &[String] {
        &self.added_excludes
    }

    fn unique_name(&mut self, hint: &str) -> String {
        let mut name = hint.to_owned();
        let mut suffix = 1;
        while self.used_names.contains(&name) {
            suffix += 1;
            let base = name
                .rfind('_')
                .filter(|i| {
                    !name[i + 1..].is_empty() && name[i + 1..].chars().all(|c| c.is_ascii_digit())
                })
                .map_or(name.as_str(), |i| &name[..i]);
            name = format!("{base}_{suffix}");
        }
        self.used_names.insert(name.clone());
        name
    }

    fn runtime_call(&self, method: &str, source: &str) -> Expr {
        let runtime = Expr::Bin(BinExpr {
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
        });
        let resolved = self
            .resolved_imports
            .get(source)
            .map_or(source, String::as_str);
        create_call_expr(
            create_member_expr(
                Expr::Paren(ParenExpr {
                    span: DUMMY_SP,
                    expr: Box::new(runtime),
                }),
                method,
            ),
            vec![to_expr_or_spread(create_string_expr(resolved))],
        )
    }

    fn fallback(&self, name: Ident, source: &str, namespace: Ident) -> ModuleItem {
        ModuleItem::Stmt(Stmt::Decl(create_var_decl_with_ident(
            VarDeclKind::Const,
            name,
            Some(Expr::Bin(BinExpr {
                span: DUMMY_SP,
                op: BinaryOp::LogicalOr,
                left: Box::new(self.runtime_call("exportsOf", source)),
                right: Box::new(Expr::Ident(namespace)),
            })),
        )))
    }

    fn namespace_import(
        name: Ident,
        source: &Str,
        attributes: Option<Box<ObjectLit>>,
    ) -> ModuleItem {
        ModuleItem::ModuleDecl(ModuleDecl::Import(ImportDecl {
            span: DUMMY_SP,
            specifiers: vec![ImportSpecifier::Namespace(ImportStarAsSpecifier {
                span: DUMMY_SP,
                local: name,
            })],
            src: Box::new(source.clone()),
            type_only: false,
            with: attributes,
            phase: Default::default(),
        }))
    }

    fn insert_declarations(module: &mut Module, declarations: Vec<ModuleItem>) {
        let index = module
            .body
            .iter()
            .position(|item| {
                !matches!(
                    item,
                    ModuleItem::ModuleDecl(ModuleDecl::Import(_) | ModuleDecl::ExportAll(_))
                )
            })
            .unwrap_or(module.body.len());
        module.body.splice(index..index, declarations);
    }
}

impl VisitMut for NamespaceTransform {
    fn visit_mut_module(&mut self, module: &mut Module) {
        let mut bindings = ScopeAnalyzer::new();
        module.visit_with(&mut bindings);
        self.used_names = bindings
            .top_level_vars
            .into_iter()
            .map(|(name, _)| name.to_string())
            .collect();
        self.added_excludes.clear();
        let mut imported_declarations = vec![];
        // Only original imports are processed. Reexport imports created below are final.
        for item in &mut module.body {
            let ModuleItem::ModuleDecl(ModuleDecl::Import(import)) = item else {
                continue;
            };
            if import.type_only {
                continue;
            }
            for specifier in &mut import.specifiers {
                if let ImportSpecifier::Namespace(namespace) = specifier {
                    let original = namespace.local.clone();
                    let alias = self.unique_name(&format!("{}_namespace", original.sym));
                    namespace.local = Ident::new(alias.clone().into(), DUMMY_SP, original.ctxt);
                    self.added_excludes.push(alias);
                    imported_declarations.push(self.fallback(
                        original,
                        &import.src.value,
                        namespace.local.clone(),
                    ));
                }
            }
        }
        Self::insert_declarations(module, imported_declarations);
        let mut declarations = vec![];
        let mut body = vec![];
        let mut counter = 0;
        for item in std::mem::take(&mut module.body) {
            if let ModuleItem::ModuleDecl(ModuleDecl::ExportNamed(export)) = &item {
                if !export.type_only && export.src.is_some() && export.specifiers.len() == 1 {
                    if let ExportSpecifier::Namespace(namespace) = &export.specifiers[0] {
                        let source = export.src.as_ref().unwrap();
                        let hint = match &namespace.name {
                            ModuleExportName::Ident(id)
                                if Ident::verify_symbol(&id.sym).is_ok() =>
                            {
                                id.sym.as_ref()
                            }
                            ModuleExportName::Str(value)
                                if Ident::verify_symbol(&value.value).is_ok() =>
                            {
                                value.value.as_ref()
                            }
                            _ => "namespace",
                        };
                        let local = self.unique_name(hint);
                        let alias = self.unique_name(&format!("{local}_namespace"));
                        let namespace_id =
                            Ident::new(alias.clone().into(), DUMMY_SP, SyntaxContext::empty());
                        let local_id = Ident::new(local.into(), DUMMY_SP, SyntaxContext::empty());
                        self.added_excludes.push(alias);
                        body.push(Self::namespace_import(
                            namespace_id.clone(),
                            source,
                            export.with.clone(),
                        ));
                        declarations.push(self.fallback(
                            local_id.clone(),
                            &source.value,
                            namespace_id,
                        ));
                        declarations.push(ModuleItem::ModuleDecl(ModuleDecl::ExportNamed(
                            NamedExport {
                                span: DUMMY_SP,
                                specifiers: vec![ExportSpecifier::Named(ExportNamedSpecifier {
                                    span: DUMMY_SP,
                                    orig: ModuleExportName::Ident(local_id),
                                    exported: Some(namespace.name.clone()),
                                    is_type_only: false,
                                })],
                                src: None,
                                type_only: false,
                                with: None,
                            },
                        )));
                        continue;
                    }
                }
            }
            if let ModuleItem::ModuleDecl(ModuleDecl::ExportAll(export)) = &item {
                if !export.type_only {
                    counter += 1;
                    let alias = self.unique_name(&format!("tmp_{counter}"));
                    let namespace_id =
                        Ident::new(alias.clone().into(), DUMMY_SP, SyntaxContext::empty());
                    self.added_excludes.push(alias.clone());
                    declarations.push(Self::namespace_import(
                        namespace_id,
                        &export.src,
                        export.with.clone(),
                    ));
                    declarations.push(ModuleItem::Stmt(Stmt::Expr(ExprStmt {
                        span: DUMMY_SP,
                        expr: Box::new(create_call_expr(
                            create_member_expr(create_ident_expr("Object"), "assign"),
                            vec![
                                to_expr_or_spread(
                                    self.runtime_call("recorderFor", &export.src.value),
                                ),
                                to_expr_or_spread(create_ident_expr(&alias)),
                            ],
                        )),
                    })));
                }
            }
            body.push(item);
        }
        module.body = body;
        Self::insert_declarations(module, declarations);
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

        let mut transform = NamespaceTransform::new(
            std::collections::HashMap::new(),
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
    fn test_namespace_transform() {
        let output = transform_code(r#"import * as foo from 'bar';"#);
        assert!(output.contains("foo_namespace"));
        assert!(output.contains("exportsOf"));
    }

    fn transform_code_with_resolved(
        code: &str,
        resolved: std::collections::HashMap<String, String>,
    ) -> (String, Vec<String>) {
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
        assert!(
            output.contains("utils_namespace"),
            "should create namespace import: {}",
            output
        );
        // Should have const utils = exportsOf(...) || utils_namespace
        assert!(
            output.contains("exportsOf"),
            "should have exportsOf call: {}",
            output
        );
        assert!(
            output.contains("const utils"),
            "should have const utils declaration: {}",
            output
        );
        // Should have export { utils }
        assert!(
            output.contains("export {"),
            "should have named export: {}",
            output
        );
        assert!(output.contains("utils"), "should export utils: {}", output);
        // utils_namespace should be in excludes
        assert!(
            excludes.contains(&"utils_namespace".to_string()),
            "utils_namespace should be excluded: {:?}",
            excludes
        );
    }

    #[test]
    fn test_named_namespace_reexport_with_resolved() {
        // When resolved_imports has a mapping, use the resolved ID in exportsOf
        let mut resolved = std::collections::HashMap::new();
        resolved.insert(
            "./utils.js".to_string(),
            "local://package/utils.js".to_string(),
        );
        let (output, _) =
            transform_code_with_resolved(r#"export * as utils from './utils.js';"#, resolved);
        assert!(
            output.contains("local://package/utils.js"),
            "should use resolved ID in exportsOf: {}",
            output
        );
    }

    #[test]
    fn test_unnamed_export_all_still_works() {
        // Unnamed export * from 'mod' should still work as before
        let (output, _) = transform_code_with_resolved(
            r#"export * from './utils.js';"#,
            std::collections::HashMap::new(),
        );
        assert!(
            output.contains("recorderFor"),
            "unnamed export * should use recorderFor: {}",
            output
        );
        assert!(
            output.contains("Object.assign"),
            "unnamed export * should use Object.assign: {}",
            output
        );
    }
}
