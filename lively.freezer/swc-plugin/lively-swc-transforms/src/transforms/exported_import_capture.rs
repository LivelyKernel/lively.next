use swc_common::{SyntaxContext, DUMMY_SP};
use swc_ecma_ast::*;
use swc_ecma_visit::{VisitMut, VisitMutWith};

use crate::utils::ast_helpers::*;

/// Post-scope-capture pass that inserts recorder captures for exported imports.
///
/// This is the Rust translation of Babel's `insertCapturesForExportedImports`.
/// It runs AFTER `ScopeCapturingTransform` and only for resurrection builds.
///
/// For rollup-based resurrection builds, module boundaries are erased, so
/// information about immediate exports must be captured into the recorder
/// so that deserialization can reconstruct the module's export map.
///
/// Transforms:
/// - `export { x as a } from '...'`
///   → `import { x as a } from '...'; export { a }; __rec.a = a;`
///   (for default exports, also adds `__rec.x = a;`)
///
/// - `export const x = ...`
///   → keeps original, adds `__rec.x = x;`
///
/// - `export { x, y as z }` (no source)
///   → keeps original, adds `__rec.x = x; __rec.y = y;` (local names as keys)
///
/// - `export * from '...'`
///   → keeps original, adds `import * as __captured_N__ from '...'; Object.assign(__rec, __captured_N__);`
pub struct ExportedImportCapturePass {
    /// Capture object name, e.g. "__varRecorder__"
    capture_obj: String,
    /// Counter for generating unique `__captured_N__` identifiers
    capture_id: usize,
}

impl ExportedImportCapturePass {
    pub fn new(capture_obj: String) -> Self {
        Self {
            capture_obj,
            capture_id: 0,
        }
    }

    /// Create `__rec.name = value` assignment statement
    fn create_capture_assign(&self, key: &str, value_ident: &str) -> ModuleItem {
        let member = create_member_expr(create_ident_expr(&self.capture_obj), key);
        let assign = create_assign_expr(
            expr_to_assign_target(member),
            Expr::Ident(Ident::new(
                value_ident.into(),
                DUMMY_SP,
                SyntaxContext::empty(),
            )),
        );
        ModuleItem::Stmt(Stmt::Expr(ExprStmt {
            span: DUMMY_SP,
            expr: Box::new(assign),
        }))
    }

    /// Process a single module item, returning one or more replacement items.
    fn transform_item(&mut self, item: ModuleItem) -> Vec<ModuleItem> {
        match item {
            ModuleItem::ModuleDecl(ModuleDecl::ExportNamed(export)) if export.src.is_some() => {
                // Case 1: `export { x as a } from '...'`
                self.transform_export_named_with_source(&export)
            }
            ModuleItem::ModuleDecl(ModuleDecl::ExportNamed(export))
                if !export.specifiers.is_empty()
                    && export.specifiers.iter().any(|s| matches!(s, ExportSpecifier::Named(_))) =>
            {
                // Case 3: `export { x, y as z }` (no source, no declaration)
                let original = ModuleItem::ModuleDecl(ModuleDecl::ExportNamed(export.clone()));
                self.transform_export_named_no_source(&export, original)
            }
            ModuleItem::ModuleDecl(ModuleDecl::ExportDecl(export_decl)) => {
                // Case 2: `export const x = ...` or `export function f() {}`
                let original = ModuleItem::ModuleDecl(ModuleDecl::ExportDecl(export_decl.clone()));
                self.transform_export_decl(&export_decl, original)
            }
            ModuleItem::ModuleDecl(ModuleDecl::ExportAll(export_all)) => {
                // Case 4: `export * from '...'`
                let original = ModuleItem::ModuleDecl(ModuleDecl::ExportAll(export_all.clone()));
                self.transform_export_all(&export_all, original)
            }
            other => vec![other],
        }
    }

    /// `export { x as a } from '...'`
    /// → `import { x as a } from '...'; export { a }; __rec.a = a;`
    fn transform_export_named_with_source(&self, export: &NamedExport) -> Vec<ModuleItem> {
        let src = export.src.as_ref().unwrap();
        let mut import_specs = Vec::new();
        let mut export_specs = Vec::new();
        let mut captures = Vec::new();

        for spec in &export.specifiers {
            if let ExportSpecifier::Named(named) = spec {
                let orig_name = match &named.orig {
                    ModuleExportName::Ident(id) => id.sym.to_string(),
                    ModuleExportName::Str(s) => s.value.to_string(),
                };
                let exported_name = match &named.exported {
                    Some(ModuleExportName::Ident(id)) => id.sym.to_string(),
                    Some(ModuleExportName::Str(s)) => s.value.to_string(),
                    None => orig_name.clone(),
                };

                // For `default` exports, use a safe local binding name since
                // `default` is a reserved keyword and can't be a local ident.
                // e.g. `export { a as default } from 'mod'`
                //    → `import { a } from 'mod'; export { a as default }; __rec.default = a;`
                // e.g. `export { default } from 'mod'`
                //    → `import { default as _default } from 'mod'; export { _default as default }; __rec.default = _default;`
                let local_name = if exported_name == "default" {
                    if orig_name == "default" {
                        "_default".to_string()
                    } else {
                        orig_name.clone()
                    }
                } else {
                    exported_name.clone()
                };

                // import { x as local } from '...'
                import_specs.push(ImportSpecifier::Named(ImportNamedSpecifier {
                    span: DUMMY_SP,
                    local: Ident::new(
                        local_name.as_str().into(),
                        DUMMY_SP,
                        SyntaxContext::empty(),
                    ),
                    imported: if orig_name == local_name {
                        None
                    } else {
                        Some(ModuleExportName::Ident(Ident::new(
                            orig_name.as_str().into(),
                            DUMMY_SP,
                            SyntaxContext::empty(),
                        )))
                    },
                    is_type_only: false,
                }));

                // export { local as exported }
                export_specs.push(ExportSpecifier::Named(ExportNamedSpecifier {
                    span: DUMMY_SP,
                    orig: ModuleExportName::Ident(Ident::new(
                        local_name.as_str().into(),
                        DUMMY_SP,
                        SyntaxContext::empty(),
                    )),
                    exported: if local_name == exported_name {
                        None
                    } else {
                        Some(ModuleExportName::Ident(Ident::new(
                            exported_name.as_str().into(),
                            DUMMY_SP,
                            SyntaxContext::empty(),
                        )))
                    },
                    is_type_only: false,
                }));

                // __rec.exported = local (e.g. __rec.default = a, or __rec.a = a)
                captures.push(self.create_capture_assign(&exported_name, &local_name));

                // For default exports: also __rec.importName = local
                if exported_name == "default" && orig_name != exported_name {
                    captures.push(self.create_capture_assign(&orig_name, &local_name));
                }
            }
        }

        let mut items = Vec::new();

        // import { x as a } from '...'
        items.push(ModuleItem::ModuleDecl(ModuleDecl::Import(ImportDecl {
            span: DUMMY_SP,
            specifiers: import_specs,
            src: Box::new(Str {
                span: DUMMY_SP,
                value: src.value.clone(),
                raw: None,
            }),
            type_only: false,
            with: None,
            phase: Default::default(),
        })));

        // export { a }
        items.push(ModuleItem::ModuleDecl(ModuleDecl::ExportNamed(
            NamedExport {
                span: DUMMY_SP,
                specifiers: export_specs,
                src: None,
                type_only: false,
                with: None,
            },
        )));

        // __rec.a = a; ...
        items.extend(captures);

        items
    }

    /// `export { x, y as z }` (no source)
    /// → keeps original, adds `__rec.x = x; __rec.y = y;` (local names as recorder keys)
    fn transform_export_named_no_source(
        &self,
        export: &NamedExport,
        original: ModuleItem,
    ) -> Vec<ModuleItem> {
        let mut items = vec![original];

        for spec in &export.specifiers {
            if let ExportSpecifier::Named(named) = spec {
                let local_name = match &named.orig {
                    ModuleExportName::Ident(id) => id.sym.to_string(),
                    ModuleExportName::Str(s) => s.value.to_string(),
                };
                let exported_name = match &named.exported {
                    Some(ModuleExportName::Ident(id)) => id.sym.to_string(),
                    Some(ModuleExportName::Str(s)) => s.value.to_string(),
                    None => local_name.clone(),
                };

                if exported_name == "default" {
                    // __rec.default = local
                    items.push(self.create_capture_assign(&exported_name, &local_name));
                    // also __rec.local = local if local != exported
                    if local_name != exported_name {
                        items.push(self.create_capture_assign(&local_name, &local_name));
                    }
                } else {
                    // __rec.local = local (Babel line 703 uses `imp` = local name)
                    items.push(self.create_capture_assign(&local_name, &local_name));
                }
            }
        }

        items
    }

    /// `export const x = ...` / `export function f() {}` / `export class C {}`
    /// → keeps original, adds `__rec.x = x;` for each declared name
    fn transform_export_decl(
        &self,
        export_decl: &ExportDecl,
        original: ModuleItem,
    ) -> Vec<ModuleItem> {
        let mut items = vec![original];

        match &export_decl.decl {
            Decl::Var(var_decl) => {
                for decl in &var_decl.decls {
                    let ids = extract_idents_from_pat(&decl.name);
                    for (sym, _ctxt) in ids {
                        let name = sym.to_string();
                        items.push(self.create_capture_assign(&name, &name));
                    }
                }
            }
            Decl::Fn(_) => {
                // Function declarations are already captured by the scope capture's
                // hoisted function captures (putFunctionDeclsInFront equivalent).
                // Adding a capture here would duplicate it.
            }
            Decl::Class(_) => {
                // Class declarations are already captured by the scope capture's
                // transform_module_item for ExportDecl. No duplicate needed.
            }
            _ => {}
        }

        items
    }

    /// `export * from '...'`
    /// → keeps original, adds `import * as __captured_N__ from '...'; Object.assign(__rec, __captured_N__);`
    fn transform_export_all(
        &mut self,
        export_all: &ExportAll,
        original: ModuleItem,
    ) -> Vec<ModuleItem> {
        self.capture_id += 1;
        let tmp_name = format!("__captured{}__", self.capture_id);

        let import_decl = ModuleItem::ModuleDecl(ModuleDecl::Import(ImportDecl {
            span: DUMMY_SP,
            specifiers: vec![ImportSpecifier::Namespace(ImportStarAsSpecifier {
                span: DUMMY_SP,
                local: Ident::new(tmp_name.as_str().into(), DUMMY_SP, SyntaxContext::empty()),
            })],
            src: Box::new(Str {
                span: DUMMY_SP,
                value: export_all.src.value.clone(),
                raw: None,
            }),
            type_only: false,
            with: None,
            phase: Default::default(),
        }));

        let object_assign = ModuleItem::Stmt(Stmt::Expr(ExprStmt {
            span: DUMMY_SP,
            expr: Box::new(create_call_expr(
                create_member_expr(create_ident_expr("Object"), "assign"),
                vec![
                    to_expr_or_spread(create_ident_expr(&self.capture_obj)),
                    to_expr_or_spread(create_ident_expr(&tmp_name)),
                ],
            )),
        }));

        vec![original, import_decl, object_assign]
    }
}

impl VisitMut for ExportedImportCapturePass {
    fn visit_mut_module(&mut self, module: &mut Module) {
        // Process each module body item, possibly expanding into multiple items.
        let old_body = std::mem::take(&mut module.body);
        let mut new_body = Vec::with_capacity(old_body.len());

        for item in old_body {
            let transformed = self.transform_item(item);
            new_body.extend(transformed);
        }

        module.body = new_body;

        // Continue visiting children (in case of nested modules, though unlikely)
        module.visit_mut_children_with(self);
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
        assert!(output.contains("import { x as a } from"), "output was: {}", output);
        assert!(output.contains("export { a }"), "output was: {}", output);
        assert!(output.contains("__varRecorder__.a = a"), "output was: {}", output);
    }

    #[test]
    fn test_export_named_with_source_same_name() {
        let output = transform_code(r#"export { x } from 'mod';"#);
        assert!(output.contains("import { x } from"), "output was: {}", output);
        assert!(output.contains("export { x }"), "output was: {}", output);
        assert!(output.contains("__varRecorder__.x = x"), "output was: {}", output);
    }

    #[test]
    fn test_export_named_no_source() {
        let output = transform_code(r#"const x = 1; const y = 2; export { x, y as z };"#);
        assert!(output.contains("export { x, y as z }"), "keeps original: {}", output);
        assert!(output.contains("__varRecorder__.x = x"), "captures x: {}", output);
        assert!(output.contains("__varRecorder__.y = y"), "captures y: {}", output);
    }

    #[test]
    fn test_export_const() {
        let output = transform_code(r#"export const x = 1;"#);
        assert!(output.contains("export const x = 1"), "keeps export: {}", output);
        assert!(output.contains("__varRecorder__.x = x"), "captures: {}", output);
    }

    #[test]
    fn test_export_all() {
        let output = transform_code(r#"export * from 'mod';"#);
        assert!(output.contains("export * from 'mod'"), "keeps original: {}", output);
        assert!(output.contains("import * as __captured"), "adds import: {}", output);
        assert!(output.contains("Object.assign(__varRecorder__"), "captures: {}", output);
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
