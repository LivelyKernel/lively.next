use swc_core::common::DUMMY_SP;
use swc_core::ecma::{
    ast::*,
    visit::{VisitMut, VisitMutWith},
};
use crate::utils::ast_helpers::extract_idents_from_pat;

/// Transform that splits export variable declarations
///
/// Transforms:
/// `export var x = 1, y = 2;`
/// into:
/// `var x = 1; var y = 2; export { x, y };`
pub struct ExportSplitTransform;

impl ExportSplitTransform {
    pub fn new() -> Self {
        Self
    }
}

impl VisitMut for ExportSplitTransform {
    fn visit_mut_module(&mut self, module: &mut Module) {
        let mut new_body = Vec::with_capacity(module.body.len());

        for mut item in module.body.drain(..) {
            if let ModuleItem::ModuleDecl(ModuleDecl::ExportDecl(export_decl)) = &item {
                if let Decl::Var(var_decl) = &export_decl.decl {
                    let mut export_names = Vec::new();
                    let mut split_items = Vec::new();

                    for decl in &var_decl.decls {
                        let single_var = VarDecl {
                            span: var_decl.span,
                            ctxt: var_decl.ctxt,
                            kind: var_decl.kind,
                            declare: var_decl.declare,
                            decls: vec![decl.clone()],
                        };

                        split_items.push(ModuleItem::Stmt(Stmt::Decl(Decl::Var(Box::new(single_var)))));

                        let ids = extract_idents_from_pat(&decl.name);
                        for (sym, ctxt) in ids {
                            export_names.push(ExportSpecifier::Named(ExportNamedSpecifier {
                                span: DUMMY_SP,
                                orig: ModuleExportName::Ident(Ident::new(sym, DUMMY_SP, ctxt)),
                                exported: None,
                                is_type_only: false,
                            }));
                        }
                    }

                    if !export_names.is_empty() {
                        split_items.push(ModuleItem::ModuleDecl(ModuleDecl::ExportNamed(
                            NamedExport {
                                span: DUMMY_SP,
                                specifiers: export_names,
                                src: None,
                                type_only: false,
                                with: None,
                            },
                        )));
                    }

                    for mut split_item in split_items {
                        split_item.visit_mut_children_with(self);
                        new_body.push(split_item);
                    }
                    continue;
                }
            }

            item.visit_mut_children_with(self);
            new_body.push(item);
        }

        module.body = new_body;
    }

    fn visit_mut_module_item(&mut self, item: &mut ModuleItem) {
        item.visit_mut_children_with(self);
    }
}
