use crate::{
    config::{ClassToFunctionConfig, LivelyTransformConfig},
    LivelyTransformVisitor,
};
use std::panic::{catch_unwind, AssertUnwindSafe};
use swc_common::{sync::Lrc, FileName, Globals, Mark, SourceMap, SyntaxContext, GLOBALS};
use swc_ecma_ast::*;
use swc_ecma_parser::{parse_file_as_module, Syntax};
use swc_ecma_transforms_base::resolver;
use swc_ecma_visit::{Visit, VisitMutWith, VisitWith};

fn parse(source: &str) -> Program {
    let cm = Lrc::new(SourceMap::default());
    let file = cm.new_source_file(FileName::Anon.into(), source.to_string());
    Program::Module(
        parse_file_as_module(
            &file,
            Syntax::Es(Default::default()),
            Default::default(),
            None,
            &mut vec![],
        )
        .unwrap(),
    )
}

fn visitor() -> LivelyTransformVisitor {
    LivelyTransformVisitor::new(LivelyTransformConfig {
        class_to_function: Some(ClassToFunctionConfig {
            class_holder: "__varRecorder__".into(),
            function_node: "initializeES6ClassForLively".into(),
            current_module_accessor: "module.id".into(),
            source_accessor_name: None,
        }),
        ..Default::default()
    })
}

const PREPROCESSING: &str = "export const outer = 1, second = 2;
function read(local) { { let shadow = local; (() => shadow + outer)(); } return local; }
class Child extends Parent { call(local) { return read(local); } }
read(outer);";

#[test]
fn raw_full_visitor_leaves_every_syntax_context_empty() {
    GLOBALS.set(&Globals::new(), || {
        let mut program = parse(PREPROCESSING);
        program.visit_mut_with(&mut visitor());

        #[derive(Default)]
        struct Contexts(Vec<SyntaxContext>);
        impl Visit for Contexts {
            fn visit_syntax_context(&mut self, context: &SyntaxContext) {
                self.0.push(*context);
            }
        }
        let mut contexts = Contexts::default();
        program.visit_with(&mut contexts);
        assert!(!contexts.0.is_empty());
        assert!(contexts
            .0
            .iter()
            .all(|context| *context == SyntaxContext::empty()));
    });
}

#[test]
fn resolved_input_without_explicit_mode_is_rejected_before_mutation() {
    GLOBALS.set(&Globals::new(), || {
        let mut program = parse(PREPROCESSING);
        program.visit_mut_with(&mut resolver(Mark::new(), Mark::new(), false));
        let original = program.clone();
        let result = catch_unwind(AssertUnwindSafe(|| {
            program.visit_mut_with(&mut visitor());
        }));
        let error = result.expect_err("resolved input requires an explicit mode");
        let message = error
            .downcast_ref::<String>()
            .map(String::as_str)
            .or_else(|| error.downcast_ref::<&str>().copied())
            .unwrap_or("");
        assert!(message.contains("with_resolved_bindings"), "{message}");
        assert_eq!(
            program, original,
            "preflight must precede all preprocessing"
        );
    });
}

#[test]
fn host_mode_preserves_local_binding_ids_and_captures_module_references() {
    GLOBALS.set(&Globals::new(), || {
        let mut program = parse("var outer = 1; function read(local) {
            let shadow = local; { let outer = shadow; console.log(outer); }
            return () => local + outer;
        } read(2); outer;");
        let unresolved = Mark::new();
        program.visit_mut_with(&mut resolver(unresolved, Mark::new(), false));

        #[derive(Default)]
        struct Idents(Vec<Ident>);
        impl Visit for Idents {
            fn visit_ident(&mut self, ident: &Ident) {
                self.0.push(ident.clone());
            }
        }
        let mut original = Idents::default();
        program.visit_with(&mut original);
        let module_outer = original.0.iter().find(|ident| ident.sym.as_ref() == "outer").unwrap().to_id();
        let locals: Vec<_> = original.0.into_iter().filter(|ident| {
            matches!(ident.sym.as_ref(), "local" | "shadow")
                || ident.sym.as_ref() == "outer" && ident.to_id() != module_outer
        }).collect();
        assert!(!locals.is_empty());
        assert!(locals.iter().all(|ident| ident.ctxt != SyntaxContext::empty()));

        program.visit_mut_with(&mut visitor().with_resolved_bindings(unresolved));
        let mut transformed = Idents::default();
        program.visit_with(&mut transformed);
        for original in locals {
            assert!(transformed.0.iter().any(|ident| {
                ident.span == original.span && ident.to_id() == original.to_id()
            }), "local binding changed: {original:?}");
        }

        #[derive(Default)]
        struct Captures(usize);
        impl Visit for Captures {
            fn visit_member_expr(&mut self, member: &MemberExpr) {
                if matches!(&*member.obj, Expr::Ident(ident) if ident.sym.as_ref() == "__varRecorder__")
                    && matches!(&member.prop, MemberProp::Ident(ident) if ident.sym.as_ref() == "outer")
                {
                    self.0 += 1;
                }
                member.visit_children_with(self);
            }
        }
        let mut captures = Captures::default();
        program.visit_with(&mut captures);
        assert_eq!(captures.0, 3, "capture the initializer, closure read and module read");
    });
}
