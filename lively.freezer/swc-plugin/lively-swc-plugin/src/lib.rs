use swc_core::ecma::{ast::Program, visit::VisitMutWith};
use swc_core::plugin::{plugin_transform, proxies::TransformPluginProgramMetadata};

use lively_swc_transforms::config::LivelyTransformConfig;
use lively_swc_transforms::LivelyTransformVisitor;

/// SWC plugin entry point — thin wrapper around shared transform library.
#[plugin_transform]
pub fn process_transform(
    mut program: Program,
    metadata: TransformPluginProgramMetadata,
) -> Program {
    let config = serde_json::from_str::<LivelyTransformConfig>(
        &metadata
            .get_transform_plugin_config()
            .expect("Failed to get plugin config"),
    )
    .unwrap_or_default();

    let mut visitor = LivelyTransformVisitor::new(config)
        .with_source_map(swc_core::common::sync::Lrc::new(metadata.source_map));
    program.visit_mut_with(&mut visitor);
    program
}
