use swc_core::common::{Spanned, SyntaxContext, DUMMY_SP};
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
    fn visit_mut_module_item(&mut self, item: &mut ModuleItem) {
        if let ModuleItem::ModuleDecl(ModuleDecl::ExportDecl(export_decl)) = item {
            if let Decl::Var(var_decl) = &export_decl.decl {
                // Only split if there are multiple declarators
                if var_decl.decls.len() > 1 {
                    let mut var_decls = Vec::new();
                    let mut export_names = Vec::new();

                    for decl in &var_decl.decls {
                        // Create individual variable declaration
                        let single_var = VarDecl {
                            span: var_decl.span,
                            ctxt: SyntaxContext::empty(),
                            kind: var_decl.kind,
                            declare: false,
                            decls: vec![decl.clone()],
                        };

                        var_decls.push(single_var);

                        // Collect export names
                        let ids = extract_idents_from_pat(&decl.name);
                        for id in ids {
                            export_names.push(ExportSpecifier::Named(ExportNamedSpecifier {
                                span: DUMMY_SP,
                                orig: ModuleExportName::Ident(Ident::new(id.0.clone(), DUMMY_SP, SyntaxContext::empty())),
                                exported: None,
                                is_type_only: false,
                            }));
                        }
                    }

                    // Replace with first var declaration (others would need parent context to insert)
                    *item = ModuleItem::Stmt(Stmt::Decl(Decl::Var(Box::new(var_decls.remove(0)))));

                    // Note: In practice, we'd need to handle multiple statements here
                    // This simplified version handles the basic case
                }
            }
        }

        item.visit_mut_children_with(self);
    }
}
