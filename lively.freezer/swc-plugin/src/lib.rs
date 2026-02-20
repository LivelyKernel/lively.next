use swc_core::ecma::{
    ast::Program,
    visit::VisitMutWith,
};
use swc_core::plugin::{plugin_transform, proxies::TransformPluginProgramMetadata};

mod config;
mod transforms;
mod utils;

use config::LivelyTransformConfig;
use transforms::*;

/// Main plugin entry point
#[plugin_transform]
pub fn process_transform(mut program: Program, metadata: TransformPluginProgramMetadata) -> Program {
    // Avoid binding conflicts with swc_core 9.x by not importing PluginDiagnosticsEmitter.
    let config = serde_json::from_str::<LivelyTransformConfig>(
        &metadata
            .get_transform_plugin_config()
            .expect("Failed to get plugin config"),
    )
    .unwrap_or_default();

    let mut visitor = LivelyTransformVisitor::new(config);
    program.visit_mut_with(&mut visitor);
    program
}

/// Main transform visitor that orchestrates all lively transforms
pub struct LivelyTransformVisitor {
    config: LivelyTransformConfig,
}

impl LivelyTransformVisitor {
    pub fn new(config: LivelyTransformConfig) -> Self {
        Self { config }
    }
}

impl swc_core::ecma::visit::VisitMut for LivelyTransformVisitor {
    fn visit_mut_program(&mut self, program: &mut Program) {
        // Apply transforms in the correct order:

        // 1. Split export variable declarations first (preprocessing)
        if self.config.enable_export_split {
            let mut export_split = ExportSplitTransform::new();
            program.visit_mut_with(&mut export_split);
        }

        // 2. Transform classes to functions
        if let Some(ref class_config) = self.config.class_to_function {
            let mut class_transform = ClassTransform::new(
                class_config.clone(),
                self.config.module_id.clone(),
                self.config.package_name.clone(),
                self.config.package_version.clone(),
            );
            program.visit_mut_with(&mut class_transform);
        }

        // 3. Wrap component descriptors
        if self.config.enable_component_transform {
            let mut component_transform = ComponentTransform::new(
                self.config.module_id.clone(),
                self.config.capture_obj.clone(),
                self.config.exclude.clone(),
            );
            program.visit_mut_with(&mut component_transform);
        }

        // 4. Transform namespace imports/exports (for resurrection builds)
        if self.config.enable_namespace_transform && self.config.resurrection {
            let mut namespace_transform = NamespaceTransform::new(self.config.resolved_imports.clone());
            program.visit_mut_with(&mut namespace_transform);
        }

        // 5. Transform dynamic imports
        if self.config.enable_dynamic_import_transform {
            let mut dynamic_import_transform = DynamicImportTransform::new();
            program.visit_mut_with(&mut dynamic_import_transform);
        }

        // 6. Rewrite SystemJS register calls (if enabled)
        if self.config.enable_systemjs_transform {
            let mut systemjs_transform = SystemJsTransform::new(
                self.config.capture_obj.clone(),
                self.config.declaration_wrapper.clone(),
                self.config.exclude.clone(),
            );
            program.visit_mut_with(&mut systemjs_transform);
        }

        // 7. Scope capturing transform (must be last as it wraps everything)
        let mut scope_transform = ScopeCapturingTransform::new(
            self.config.capture_obj.clone(),
            self.config.declaration_wrapper.clone(),
            self.config.exclude.clone(),
            self.config.capture_imports,
            self.config.resurrection,
            self.config.module_id.clone(),
            self.config.current_module_accessor.clone(),
        );
        program.visit_mut_with(&mut scope_transform);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use swc_core::common::{sync::Lrc, SourceMap, FileName};

    fn transform_code(code: &str, config: LivelyTransformConfig) -> String {
        let cm = Lrc::new(SourceMap::default());
        let fm = cm.new_source_file(FileName::Anon, code.to_string());

        // Parse the code
        use swc_core::ecma::parser::{parse_file_as_module, Syntax};
        let mut program = parse_file_as_module(
            &fm,
            Syntax::Es(Default::default()),
            Default::default(),
            None,
            &mut vec![],
        )
        .unwrap();

        // Transform
        let mut visitor = LivelyTransformVisitor::new(config);
        program.visit_mut_with(&mut visitor);

        // Generate code
        use swc_core::ecma::codegen::{text_writer::JsWriter, Emitter, Config};
        let mut buf = vec![];
        {
            let mut emitter = Emitter {
                cfg: Config::default(),
                cm: cm.clone(),
                comments: None,
                wr: JsWriter::new(cm, "\n", &mut buf, None),
            };

            emitter.emit_module(&swc_core::ecma::ast::Module::from(program)).unwrap();
        }

        String::from_utf8(buf).unwrap()
    }

    #[test]
    fn test_basic_var_capture() {
        let input = "var x = 1; x + 2;";
        let output = transform_code(input, LivelyTransformConfig::default());
        assert!(output.contains("__varRecorder__"));
    }

    #[test]
    fn test_export_class_is_captured_after_class_transform() {
        let mut config = LivelyTransformConfig::default();
        config.class_to_function = Some(crate::config::ClassToFunctionConfig {
            class_holder: "__varRecorder__".to_string(),
            function_node: "initializeES6ClassForLively".to_string(),
            current_module_accessor: "module.id".to_string(),
        });
        let input = "export class Color {}";
        let output = transform_code(input, config);
        assert!(output.contains("__varRecorder__.Color = Color"));
    }

    #[test]
    fn test_export_var_keeps_local_binding_after_capture() {
        let input = "export var rainbow = [1];";
        let output = transform_code(input, LivelyTransformConfig::default());
        assert!(output.contains("export { rainbow"));
        assert!(output.contains("var rainbow = __varRecorder__.rainbow"));
    }
}
