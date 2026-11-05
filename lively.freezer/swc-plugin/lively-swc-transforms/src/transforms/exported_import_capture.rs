use crate::utils::{ast_helpers::*, scope_analyzer::ScopeAnalyzer};
use std::collections::HashSet;
use swc_common::{SyntaxContext, DUMMY_SP};
use swc_ecma_ast::*;
use swc_ecma_visit::{VisitMut, VisitWith};

/// Supplemental captures after scope rewriting; mirrors captureExportedImports
/// in babel/transforms/exported-import-capture.js and the ESTree freezer pass.
pub struct ExportedImportCapturePass {
    capture_obj: String,
    capture_id: usize,
    used_names: HashSet<String>,
}
impl ExportedImportCapturePass {
    pub fn new(capture_obj: String) -> Self {
        Self {
            capture_obj,
            capture_id: 0,
            used_names: HashSet::new(),
        }
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
    fn name(name: &ModuleExportName) -> String {
        match name {
            ModuleExportName::Ident(value) => value.sym.to_string(),
            ModuleExportName::Str(value) => value.value.to_string(),
        }
    }
    fn capture(&self, key: &str, value: &str) -> ModuleItem {
        let recorder = create_ident_expr(&self.capture_obj);
        let member = if Ident::verify_symbol(key).is_ok() || key == "default" {
            create_member_expr(recorder, key)
        } else {
            create_computed_member_expr(recorder, create_string_expr(key))
        };
        ModuleItem::Stmt(Stmt::Expr(ExprStmt {
            span: DUMMY_SP,
            expr: Box::new(create_assign_expr(
                expr_to_assign_target(member),
                create_ident_expr(value),
            )),
        }))
    }
    fn named_from_source(&mut self, export: NamedExport) -> Vec<ModuleItem> {
        let mut imports = vec![];
        let mut exports = vec![];
        let mut captures = vec![];
        for specifier in &export.specifiers {
            let (original, exported) = match specifier {
                ExportSpecifier::Named(value) => (
                    Some(value.orig.clone()),
                    value.exported.clone().unwrap_or_else(|| value.orig.clone()),
                ),
                ExportSpecifier::Namespace(value) => (None, value.name.clone()),
                _ => continue,
            };
            let exported_name = Self::name(&exported);
            let original_name = original.as_ref().map(Self::name);
            let hint = if exported_name == "default" {
                original_name
                    .as_deref()
                    .filter(|name| *name != "default")
                    .unwrap_or("_default")
            } else {
                exported_name.as_str()
            };
            let local = self.unique_name(if Ident::verify_symbol(hint).is_ok() {
                hint
            } else {
                "__reexport__"
            });
            let identifier = Ident::new(local.clone().into(), DUMMY_SP, SyntaxContext::empty());
            if let Some(original) = original {
                imports.push(ImportSpecifier::Named(ImportNamedSpecifier {
                    span: DUMMY_SP,
                    local: identifier.clone(),
                    imported: if matches!(&original,ModuleExportName::Ident(id) if id.sym.as_ref()==local) { None } else { Some(original) },
                    is_type_only: false,
                }));
            } else {
                imports.push(ImportSpecifier::Namespace(ImportStarAsSpecifier {
                    span: DUMMY_SP,
                    local: identifier.clone(),
                }));
            }
            exports.push(ExportSpecifier::Named(ExportNamedSpecifier {
                span: DUMMY_SP,
                orig: ModuleExportName::Ident(identifier),
                exported: if matches!(&exported,ModuleExportName::Ident(id) if id.sym.as_ref()==local) { None } else { Some(exported) },
                is_type_only: false,
            }));
            captures.push(self.capture(&exported_name, &local));
            if let Some(original) = original_name {
                if original == "default" && original != exported_name {
                    captures.push(self.capture("default", &local));
                } else if exported_name == "default" && original != exported_name {
                    captures.push(self.capture(&original, &local));
                }
            }
        }
        let mut result = vec![
            ModuleItem::ModuleDecl(ModuleDecl::Import(ImportDecl {
                span: DUMMY_SP,
                specifiers: imports,
                src: export.src.unwrap(),
                type_only: false,
                with: export.with,
                phase: Default::default(),
            })),
            ModuleItem::ModuleDecl(ModuleDecl::ExportNamed(NamedExport {
                span: DUMMY_SP,
                specifiers: exports,
                src: None,
                type_only: false,
                with: None,
            })),
        ];
        result.extend(captures);
        result
    }
    fn transform_item(&mut self, item: ModuleItem) -> Vec<ModuleItem> {
        match item {
            ModuleItem::ModuleDecl(ModuleDecl::ExportNamed(export))
                if export.src.is_some() && !export.type_only =>
            {
                self.named_from_source(export)
            }
            ModuleItem::ModuleDecl(ModuleDecl::ExportNamed(export))
                if export.src.is_none() && !export.type_only =>
            {
                let mut captures = vec![];
                for specifier in &export.specifiers {
                    if let ExportSpecifier::Named(value) = specifier {
                        let local = Self::name(&value.orig);
                        let exported = value
                            .exported
                            .as_ref()
                            .map(Self::name)
                            .unwrap_or_else(|| local.clone());
                        if exported == "default" {
                            captures.push(self.capture("default", &local));
                        }
                        if local != "default" {
                            captures.push(self.capture(&local, &local));
                        }
                    }
                }
                let mut result = vec![ModuleItem::ModuleDecl(ModuleDecl::ExportNamed(export))];
                result.extend(captures);
                result
            }
            ModuleItem::ModuleDecl(ModuleDecl::ExportDecl(export)) => {
                let mut captures = vec![];
                if let Decl::Var(declaration) = &export.decl {
                    for declarator in &declaration.decls {
                        for (name, _) in extract_idents_from_pat(&declarator.name) {
                            captures.push(self.capture(&name, &name));
                        }
                    }
                }
                let mut result = vec![ModuleItem::ModuleDecl(ModuleDecl::ExportDecl(export))];
                result.extend(captures);
                result
            }
            ModuleItem::ModuleDecl(ModuleDecl::ExportAll(export)) if !export.type_only => {
                self.capture_id += 1;
                let name = self.unique_name(&format!("__captured{}__", self.capture_id));
                let import = ModuleItem::ModuleDecl(ModuleDecl::Import(ImportDecl {
                    span: DUMMY_SP,
                    specifiers: vec![ImportSpecifier::Namespace(ImportStarAsSpecifier {
                        span: DUMMY_SP,
                        local: Ident::new(name.clone().into(), DUMMY_SP, SyntaxContext::empty()),
                    })],
                    src: export.src.clone(),
                    type_only: false,
                    with: export.with.clone(),
                    phase: Default::default(),
                }));
                let capture = ModuleItem::Stmt(Stmt::Expr(ExprStmt {
                    span: DUMMY_SP,
                    expr: Box::new(create_call_expr(
                        create_member_expr(create_ident_expr("Object"), "assign"),
                        vec![
                            to_expr_or_spread(create_ident_expr(&self.capture_obj)),
                            to_expr_or_spread(create_ident_expr(&name)),
                        ],
                    )),
                }));
                vec![
                    ModuleItem::ModuleDecl(ModuleDecl::ExportAll(export)),
                    import,
                    capture,
                ]
            }
            other => vec![other],
        }
    }
}
impl VisitMut for ExportedImportCapturePass {
    fn visit_mut_module(&mut self, module: &mut Module) {
        let mut bindings = ScopeAnalyzer::new();
        module.visit_with(&mut bindings);
        self.used_names = bindings
            .top_level_vars
            .into_iter()
            .map(|(name, _)| name.to_string())
            .collect();
        module.body = std::mem::take(&mut module.body)
            .into_iter()
            .flat_map(|item| self.transform_item(item))
            .collect();
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

        let mut pass = ExportedImportCapturePass::new("__varRecorder__".to_string());
        module.visit_mut_with(&mut pass);

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
    fn test_export_named_with_source() {
        let output = transform_code(r#"export { x as a } from 'mod';"#);
        // Should produce: import { x as a } from 'mod'; export { a }; __varRecorder__.a = a;
        assert!(
            output.contains("import { x as a } from"),
            "output was: {}",
            output
        );
        assert!(output.contains("export { a }"), "output was: {}", output);
        assert!(
            output.contains("__varRecorder__.a = a"),
            "output was: {}",
            output
        );
    }

    #[test]
    fn test_export_named_with_source_same_name() {
        let output = transform_code(r#"export { x } from 'mod';"#);
        assert!(
            output.contains("import { x } from"),
            "output was: {}",
            output
        );
        assert!(output.contains("export { x }"), "output was: {}", output);
        assert!(
            output.contains("__varRecorder__.x = x"),
            "output was: {}",
            output
        );
    }

    #[test]
    fn test_export_named_no_source() {
        let output = transform_code(r#"const x = 1; const y = 2; export { x, y as z };"#);
        assert!(
            output.contains("export { x, y as z }"),
            "keeps original: {}",
            output
        );
        assert!(
            output.contains("__varRecorder__.x = x"),
            "captures x: {}",
            output
        );
        assert!(
            output.contains("__varRecorder__.y = y"),
            "captures y: {}",
            output
        );
    }

    #[test]
    fn test_export_const() {
        let output = transform_code(r#"export const x = 1;"#);
        assert!(
            output.contains("export const x = 1"),
            "keeps export: {}",
            output
        );
        assert!(
            output.contains("__varRecorder__.x = x"),
            "captures: {}",
            output
        );
    }

    #[test]
    fn test_export_all() {
        let output = transform_code(r#"export * from 'mod';"#);
        assert!(
            output.contains("export * from 'mod'"),
            "keeps original: {}",
            output
        );
        assert!(
            output.contains("import * as __captured"),
            "adds import: {}",
            output
        );
        assert!(
            output.contains("Object.assign(__varRecorder__"),
            "captures: {}",
            output
        );
    }

    #[test]
    fn test_export_default_from_source() {
        let output = transform_code(r#"export { foo as default } from 'mod';"#);
        // Should capture both: __rec.default = default and __rec.foo = default
        // Wait - the exported name is "default", so the local binding becomes "default"
        // which is a keyword. The Babel code uses it literally. Let's verify the captures.
        assert!(output.contains("__varRecorder__.default"));
        assert!(output.contains("__varRecorder__.foo"));
    }
}
