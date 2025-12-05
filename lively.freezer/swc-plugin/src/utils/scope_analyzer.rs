use std::collections::{HashMap, HashSet};
use swc_core::ecma::ast::*;
use swc_core::ecma::visit::{Visit, VisitWith};

/// Analyzes variable scope and determines which variables are top-level
#[derive(Default)]
pub struct ScopeAnalyzer {
    /// Variables declared at the top level (module scope)
    pub top_level_vars: HashSet<Id>,

    /// Variables that should be excluded from capturing
    pub excluded_vars: HashSet<Id>,

    /// Current scope depth (0 = top level)
    depth: usize,

    /// Variables declared in nested scopes (function params, catch clauses, etc.)
    nested_vars: HashMap<Id, usize>,
}

impl ScopeAnalyzer {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn with_exclusions(excluded: HashSet<Id>) -> Self {
        Self {
            excluded_vars: excluded,
            ..Default::default()
        }
    }

    /// Check if a variable is at the top level and not excluded
    pub fn is_capturable(&self, id: &Id) -> bool {
        self.top_level_vars.contains(id)
            && !self.excluded_vars.contains(id)
            && !self.nested_vars.contains_key(id)
    }

    /// Check if we're at the top level
    fn is_top_level(&self) -> bool {
        self.depth == 0
    }

    /// Enter a new scope
    fn enter_scope(&mut self) {
        self.depth += 1;
    }

    /// Exit a scope
    fn exit_scope(&mut self) {
        self.depth -= 1;
        // Remove variables from this scope level
        self.nested_vars.retain(|_, depth| *depth < self.depth);
    }

    /// Add a variable to the current scope
    fn add_var(&mut self, id: Id) {
        if self.is_top_level() {
            self.top_level_vars.insert(id);
        } else {
            self.nested_vars.insert(id, self.depth);
        }
    }

    /// Add multiple variables from a pattern
    fn add_vars_from_pat(&mut self, pat: &Pat) {
        extract_ids_from_pat(pat).into_iter().for_each(|id| {
            self.add_var(id);
        });
    }
}

impl Visit for ScopeAnalyzer {
    fn visit_module(&mut self, module: &Module) {
        // Start at top level
        self.depth = 0;
        module.visit_children_with(self);
    }

    fn visit_var_decl(&mut self, decl: &VarDecl) {
        for declarator in &decl.decls {
            self.add_vars_from_pat(&declarator.name);
            if let Some(init) = &declarator.init {
                init.visit_with(self);
            }
        }
    }

    fn visit_fn_decl(&mut self, decl: &FnDecl) {
        // Function name is in the parent scope
        if self.is_top_level() {
            self.add_var(decl.ident.to_id());
        }

        // Function body is in a new scope
        self.enter_scope();
        decl.function.visit_with(self);
        self.exit_scope();
    }

    fn visit_fn_expr(&mut self, expr: &FnExpr) {
        self.enter_scope();
        if let Some(ident) = &expr.ident {
            self.add_var(ident.to_id());
        }
        expr.function.visit_with(self);
        self.exit_scope();
    }

    fn visit_arrow_expr(&mut self, expr: &ArrowExpr) {
        self.enter_scope();
        for param in &expr.params {
            self.add_vars_from_pat(param);
        }
        expr.body.visit_with(self);
        self.exit_scope();
    }

    fn visit_function(&mut self, func: &Function) {
        // Parameters are in the function scope
        for param in &func.params {
            self.add_vars_from_pat(&param.pat);
        }

        if let Some(body) = &func.body {
            body.visit_with(self);
        }
    }

    fn visit_class_decl(&mut self, decl: &ClassDecl) {
        if self.is_top_level() {
            self.add_var(decl.ident.to_id());
        }
        decl.class.visit_with(self);
    }

    fn visit_class_expr(&mut self, expr: &ClassExpr) {
        if let Some(ident) = &expr.ident {
            self.add_var(ident.to_id());
        }
        expr.class.visit_with(self);
    }

    fn visit_catch_clause(&mut self, clause: &CatchClause) {
        self.enter_scope();
        if let Some(param) = &clause.param {
            self.add_vars_from_pat(param);
        }
        clause.body.visit_with(self);
        self.exit_scope();
    }

    fn visit_block_stmt(&mut self, block: &BlockStmt) {
        // Block statements create a new scope for let/const
        let had_block_scope = !self.is_top_level();
        if had_block_scope {
            self.enter_scope();
        }
        block.visit_children_with(self);
        if had_block_scope {
            self.exit_scope();
        }
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

    // Import/export declarations
    fn visit_import_decl(&mut self, decl: &ImportDecl) {
        for spec in &decl.specifiers {
            let id = match spec {
                ImportSpecifier::Named(named) => named.local.to_id(),
                ImportSpecifier::Default(default) => default.local.to_id(),
                ImportSpecifier::Namespace(ns) => ns.local.to_id(),
            };
            self.add_var(id);
        }
    }
}

/// Extract all identifier IDs from a pattern
fn extract_ids_from_pat(pat: &Pat) -> Vec<Id> {
    let mut ids = Vec::new();
    extract_ids_recursive(pat, &mut ids);
    ids
}

fn extract_ids_recursive(pat: &Pat, ids: &mut Vec<Id>) {
    match pat {
        Pat::Ident(BindingIdent { id, .. }) => {
            ids.push(id.to_id());
        }
        Pat::Array(ArrayPat { elems, .. }) => {
            for elem in elems.iter().filter_map(|e| e.as_ref()) {
                extract_ids_recursive(elem, ids);
            }
        }
        Pat::Object(ObjectPat { props, .. }) => {
            for prop in props {
                match prop {
                    ObjectPatProp::KeyValue(kv) => {
                        extract_ids_recursive(&kv.value, ids);
                    }
                    ObjectPatProp::Assign(assign) => {
                        ids.push(assign.key.to_id());
                    }
                    ObjectPatProp::Rest(rest) => {
                        extract_ids_recursive(&rest.arg, ids);
                    }
                }
            }
        }
        Pat::Rest(RestPat { arg, .. }) => {
            extract_ids_recursive(arg, ids);
        }
        Pat::Assign(AssignPat { left, .. }) => {
            extract_ids_recursive(left, ids);
        }
        _ => {}
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use swc_core::ecma::parser::{parse_file_as_module, Syntax};
    use swc_core::common::{FileName, SourceMap, sync::Lrc};

    fn analyze_code(code: &str) -> ScopeAnalyzer {
        let cm = Lrc::new(SourceMap::default());
        let fm = cm.new_source_file(FileName::Anon, code.to_string());

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
}
