//! Native half of the shared JS/Rust parity suite. Reads a JSON batch on stdin.
use std::io::{self, Read};

use lively_swc_transforms::{
    config::LivelyTransformConfig, transforms::ExportedImportCapturePass, LivelyTransformVisitor,
};
use serde::Deserialize;
use swc_common::{sync::Lrc, FileName, SourceMap};
use swc_ecma_ast::{Pass, Program};
use swc_ecma_codegen::{text_writer::JsWriter, Emitter};
use swc_ecma_parser::{parse_file_as_module, Syntax};
use swc_ecma_transforms_base::fixer::fixer;
use swc_ecma_visit::VisitMutWith;

#[derive(Deserialize)]
struct Case {
    name: String,
    source: String,
    config: LivelyTransformConfig,
    #[serde(default)]
    pass: String,
}

fn transform(case: &Case) -> Result<String, String> {
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
    if case.pass == "exported-import-capture" {
        program.visit_mut_with(&mut ExportedImportCapturePass::new(
            case.config.capture_obj.clone(),
        ));
    } else {
        program.visit_mut_with(
            &mut LivelyTransformVisitor::new(case.config.clone()).with_source_map(cm.clone()),
        );
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
}

fn main() {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).unwrap();
    let cases: Vec<Case> = serde_json::from_str(&input).expect("parity fixture batch");
    let results: Vec<_> = cases
        .iter()
        .map(|case| match transform(case) {
            Ok(code) => serde_json::json!({ "name": case.name, "code": code }),
            Err(error) => serde_json::json!({ "name": case.name, "error": error }),
        })
        .collect();
    println!("{}", serde_json::to_string(&results).unwrap());
}
