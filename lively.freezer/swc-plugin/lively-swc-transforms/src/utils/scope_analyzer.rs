use std::collections::HashSet;
use swc_ecma_ast::*;
use swc_ecma_visit::{Visit, VisitWith};

use crate::utils::ast_helpers::extract_idents_from_pat;

/// Collect module bindings, excluding declarations in nested scopes.
#[derive(Default)]
pub struct ScopeAnalyzer {
    pub top_level_vars: HashSet<Id>,
    pub excluded_vars: HashSet<Id>,
    depth: usize,
}

impl ScopeAnalyzer {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn with_exclusions(excluded_vars: HashSet<Id>) -> Self {
        Self {
            excluded_vars,
            ..Default::default()
        }
    }

    pub fn is_capturable(&self, id: &Id) -> bool {
        self.top_level_vars.contains(id) && !self.excluded_vars.contains(id)
    }

    fn enter_scope(&mut self) {
        self.depth += 1;
    }

    fn exit_scope(&mut self) {
        self.depth -= 1;
    }

    fn add_var(&mut self, id: Id) {
        if self.depth == 0 {
            self.top_level_vars.insert(id);
        }
    }
}

impl Visit for ScopeAnalyzer {
    fn visit_module(&mut self, module: &Module) {
        self.depth = 0;
        self.top_level_vars.clear();
        module.visit_children_with(self);
    }

    fn visit_var_decl(&mut self, decl: &VarDecl) {
        for declarator in &decl.decls {
            for id in extract_idents_from_pat(&declarator.name) {
                self.add_var(id);
            }
            if let Some(init) = &declarator.init {
                init.visit_with(self);
            }
        }
    }

    fn visit_fn_decl(&mut self, decl: &FnDecl) {
        self.add_var(decl.ident.to_id());
    }

    // Function bodies, parameters, and expression names cannot declare module bindings.
    fn visit_fn_expr(&mut self, _: &FnExpr) {}
    fn visit_arrow_expr(&mut self, _: &ArrowExpr) {}
    fn visit_function(&mut self, _: &Function) {}

    fn visit_class_decl(&mut self, decl: &ClassDecl) {
        self.add_var(decl.ident.to_id());
        decl.class.visit_with(self);
    }

    fn visit_class_expr(&mut self, expr: &ClassExpr) {
        // A named class expression's name belongs to the class, not the module.
        expr.class.visit_with(self);
    }

    fn visit_export_default_decl(&mut self, export: &ExportDefaultDecl) {
        // Default class declarations are represented as ClassExpr nodes.
        // ScopeCapturingTransform handles default functions separately.
        if let DefaultDecl::Class(class) = &export.decl {
            if let Some(ident) = &class.ident {
                self.add_var(ident.to_id());
            }
            class.class.visit_with(self);
        }
    }

    fn visit_catch_clause(&mut self, clause: &CatchClause) {
        self.enter_scope();
        clause.body.visit_with(self);
        self.exit_scope();
    }

    fn visit_block_stmt(&mut self, block: &BlockStmt) {
        self.enter_scope();
        block.visit_children_with(self);
        self.exit_scope();
    }

    fn visit_for_stmt(&mut self, stmt: &ForStmt) {
        self.enter_scope();
        stmt.visit_children_with(self);
        self.exit_scope();
    }

    fn visit_for_in_stmt(&mut self, stmt: &ForInStmt) {
        self.enter_scope();
        stmt.visit_children_with(self);
        self.exit_scope();
    }

    fn visit_for_of_stmt(&mut self, stmt: &ForOfStmt) {
        self.enter_scope();
        stmt.visit_children_with(self);
        self.exit_scope();
    }

    fn visit_import_decl(&mut self, decl: &ImportDecl) {
        for spec in &decl.specifiers {
            self.add_var(spec.local().to_id());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use swc_common::{sync::Lrc, FileName, SourceMap};
    use swc_ecma_parser::{parse_file_as_module, Syntax};

    fn analyze_code(code: &str) -> ScopeAnalyzer {
        let cm = Lrc::new(SourceMap::default());
        let fm = cm.new_source_file(FileName::Anon.into(), code.to_string());

        let module = parse_file_as_module(
            &fm,
            Syntax::Es(Default::default()),
            Default::default(),
            None,
            &mut vec![],
        )
        .unwrap();

        let mut analyzer = ScopeAnalyzer::new();
        module.visit_with(&mut analyzer);
        analyzer
    }

    #[test]
    fn test_top_level_vars() {
        let analyzer = analyze_code("var x = 1; let y = 2; const z = 3;");
        assert!(analyzer.top_level_vars.len() == 3);
    }

    #[test]
    fn test_function_params_not_captured() {
        let analyzer = analyze_code("function foo(x) { return x; }");
        // Only 'foo' should be captured, not 'x'
        assert!(analyzer.top_level_vars.len() == 1);
    }

    #[test]
    fn test_nested_vars() {
        let analyzer = analyze_code("var x = 1; function foo() { var y = 2; }");
        assert!(analyzer.top_level_vars.len() == 2); // x and foo
        assert!(analyzer.is_capturable(&("x".into(), Default::default())));
    }

    #[test]
    fn class_and_function_expression_names_are_local() {
        let analyzer = analyze_code(
            "class Foo { method(lively) {} } const C = class Local {}; const f = function named() {};",
        );
        let names: HashSet<_> = analyzer
            .top_level_vars
            .iter()
            .map(|id| id.0.as_ref())
            .collect();
        assert_eq!(names, HashSet::from(["Foo", "C", "f"]));
    }
}
