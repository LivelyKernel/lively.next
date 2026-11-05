//! Native half of the shared JS/Rust parity suite. Reads a JSON batch on stdin.
use std::io::{self, Read};

use lively_swc_transforms::{
    config::LivelyTransformConfig, transforms::ExportedImportCapturePass, LivelyTransformVisitor,
};
use serde::Deserialize;
use swc_common::{sync::Lrc, FileName, Globals, Mark, SourceMap, GLOBALS};
use swc_ecma_ast::{Pass, Program};
use swc_ecma_codegen::{text_writer::JsWriter, Emitter};
use swc_ecma_parser::{parse_file_as_module, Syntax};
use swc_ecma_transforms_base::{fixer::fixer, resolver};
use swc_ecma_visit::VisitMutWith;

#[derive(Deserialize)]
struct Case {
    name: String,
    source: String,
    config: LivelyTransformConfig,
    #[serde(default)]
    pass: String,
}

fn transform(case: &Case, pre_resolved: bool) -> Result<String, String> {
    GLOBALS.set(&Globals::default(), || {
        let cm: Lrc<SourceMap> = Default::default();
        let file = cm.new_source_file(
            FileName::Custom(case.name.clone()).into(),
            case.source.clone(),
        );
        let mut errors = vec![];
        let module = parse_file_as_module(
            &file,
            Syntax::Es(Default::default()),
            Default::default(),
            None,
            &mut errors,
        )
        .map_err(|error| format!("{error:?}"))?;
        if !errors.is_empty() {
            return Err(format!("{errors:?}"));
        }
        let mut program = Program::Module(module);
        let host_unresolved_mark = if pre_resolved {
            let unresolved_mark = Mark::new();
            resolver(unresolved_mark, Mark::new(), false).process(&mut program);
            Some(unresolved_mark)
        } else {
            None
        };
        if case.pass == "exported-import-capture" {
            program.visit_mut_with(&mut ExportedImportCapturePass::new(
                case.config.capture_obj.clone(),
            ));
        } else {
            let mut visitor =
                LivelyTransformVisitor::new(case.config.clone()).with_source_map(cm.clone());
            if let Some(unresolved_mark) = host_unresolved_mark {
                visitor = visitor.with_resolved_bindings(unresolved_mark);
            }
            program.visit_mut_with(&mut visitor);
        }
        // Production hosts run SWC's fixer before emission as well.
        fixer(None).process(&mut program);
        let mut output = vec![];
        Emitter {
            cfg: Default::default(),
            cm: cm.clone(),
            comments: None,
            wr: JsWriter::new(cm, "\n", &mut output, None),
        }
        .emit_program(&program)
        .map_err(|error| error.to_string())?;
        String::from_utf8(output).map_err(|error| error.to_string())
    })
}

fn main() {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).unwrap();
    let cases: Vec<Case> = serde_json::from_str(&input).expect("parity fixture batch");
    let trace = std::env::var_os("PARITY_TRACE").is_some();
    let results: Vec<_> = cases
        .iter()
        .map(|case| {
            let mut result = serde_json::json!({ "name": case.name });
            if trace {
                eprintln!("{} [rust]", case.name);
            }
            match transform(case, false) {
                Ok(code) => result["code"] = serde_json::json!(code),
                Err(error) => result["error"] = serde_json::json!(error),
            }
            if trace {
                eprintln!("{} [rustResolved]", case.name);
            }
            match transform(case, true) {
                Ok(code) => result["resolvedCode"] = serde_json::json!(code),
                Err(error) => result["resolvedError"] = serde_json::json!(error),
            }
            result
        })
        .collect();
    println!("{}", serde_json::to_string(&results).unwrap());
}
