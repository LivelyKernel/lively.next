pub mod config;
pub mod transforms;
pub mod utils;

use config::LivelyTransformConfig;
use swc_ecma_visit::VisitMutWith;
use transforms::*;

/// Main transform visitor that orchestrates all lively transforms.
/// Shared between the SWC plugin (wasm32-wasip1) and the browser WASM module.
pub struct LivelyTransformVisitor {
    config: LivelyTransformConfig,
}

impl LivelyTransformVisitor {
    pub fn new(config: LivelyTransformConfig) -> Self {
        Self { config }
    }
}

impl swc_ecma_visit::VisitMut for LivelyTransformVisitor {
    fn visit_mut_program(&mut self, program: &mut swc_ecma_ast::Program) {
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
        // Runs BEFORE scope capture so the generated const/assignments get captured.
        // Collects synthetic identifiers to exclude from scope capture.
        let mut namespace_excludes = Vec::new();
        if self.config.enable_namespace_transform && self.config.resurrection {
            let mut namespace_transform = NamespaceTransform::new(self.config.resolved_imports.clone(), self.config.capture_obj.clone());
            program.visit_mut_with(&mut namespace_transform);
            namespace_excludes.extend(namespace_transform.added_excludes().iter().cloned());
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
        if self.config.enable_scope_capture {
            let mut exclude = self.config.exclude.clone();
            exclude.extend(namespace_excludes);
            let mut scope_transform = ScopeCapturingTransform::new(
                self.config.capture_obj.clone(),
                self.config.declaration_wrapper.clone(),
                exclude,
                self.config.capture_imports,
                self.config.resurrection,
                self.config.module_id.clone(),
                self.config.current_module_accessor.clone(),
                self.config.module_hash,
                self.config.resolved_imports.clone(),
            );
            program.visit_mut_with(&mut scope_transform);
        }

        // 8. Capture exported imports (after scope capture).
        // Babel runs insertCapturesForExportedImports for all captureModuleScope builds.
        if self.config.enable_scope_capture {
            let mut exported_import_capture = ExportedImportCapturePass::new(
                self.config.capture_obj.clone(),
            );
            program.visit_mut_with(&mut exported_import_capture);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use swc_common::{sync::Lrc, SourceMap, FileName};

    fn transform_code(code: &str, config: LivelyTransformConfig) -> String {
        let cm = Lrc::new(SourceMap::default());
        let fm = cm.new_source_file(FileName::Anon.into(), code.to_string());

        use swc_ecma_parser::{parse_file_as_module, Syntax};
        let module = parse_file_as_module(
            &fm,
            Syntax::Es(Default::default()),
            Default::default(),
            None,
            &mut vec![],
        )
        .unwrap();

        let mut program = swc_ecma_ast::Program::Module(module);
        let mut visitor = LivelyTransformVisitor::new(config);
        program.visit_mut_with(&mut visitor);

        let module = match &program {
            swc_ecma_ast::Program::Module(m) => m,
            _ => panic!("Expected module"),
        };

        use swc_ecma_codegen::{text_writer::JsWriter, Emitter, Config};
        let mut buf = vec![];
        {
            let mut emitter = Emitter {
                cfg: Config::default(),
                cm: cm.clone(),
                comments: None,
                wr: JsWriter::new(cm, "\n", &mut buf, None),
            };
            emitter.emit_module(module).unwrap();
        }

        String::from_utf8(buf).unwrap()
    }

    #[test]
    fn test_basic_var_capture() {
        let input = "var x = 1; x + 2;";
        let output = transform_code(input, LivelyTransformConfig::default());
        assert!(output.contains("__varRecorder__"), "actual output:\n{}", output);
    }

    #[test]
    fn test_export_class_is_captured_after_class_transform() {
        let mut config = LivelyTransformConfig::default();
        config.class_to_function = Some(config::ClassToFunctionConfig {
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

    fn config_with_class_to_function() -> LivelyTransformConfig {
        let mut config = LivelyTransformConfig::default();
        config.class_to_function = Some(crate::config::ClassToFunctionConfig {
            class_holder: "__varRecorder__".to_string(),
            function_node: "initializeES6ClassForLively".to_string(),
            current_module_accessor: "module.id".to_string(),
        });
        config
    }

    fn config_resurrection_with_class_to_function() -> LivelyTransformConfig {
        let mut config = config_with_class_to_function();
        config.resurrection = true;
        config.module_id = "test-module.js".to_string();
        config.module_hash = Some(12345);
        config.capture_imports = false; // bundler sets this to false for non-sourceMap
        config
    }

    // --- Tests for class-to-function + scope capture + export interaction ---
    // These reproduce the eval-strategies.js failure where rollup says
    // "Exported variable X is not defined" because the scope capture removes
    // the var declaration that class-to-function created.

    #[test]
    fn test_class_with_separate_export_after_class_to_function() {
        // Pattern: class declared, then exported separately.
        // class-to-function converts to var, scope capture must keep the var.
        let input = "class Foo { eval() { return 1; } }\nexport { Foo };";
        let output = transform_code(input, config_with_class_to_function());
        // Foo must still be declared (as var) so rollup can resolve export { Foo }
        assert!(output.contains("export {"), "keeps export statement: {}", output);
        assert!(
            output.contains("var Foo") || output.contains("let Foo") || output.contains("const Foo"),
            "Foo must have a local declaration for rollup: {}", output
        );
    }

    #[test]
    fn test_multiple_classes_with_separate_export_after_class_to_function() {
        // Pattern from eval-strategies.js: multiple classes, exported together
        let input = r#"
class EvalStrategy { eval() {} }
class SimpleEvalStrategy extends EvalStrategy { eval() {} }
export { EvalStrategy, SimpleEvalStrategy };
"#;
        let output = transform_code(input, config_with_class_to_function());
        assert!(output.contains("export {"), "keeps export: {}", output);
        // Both names must be locally declared
        assert!(
            output.contains("var EvalStrategy") || output.contains("EvalStrategy ="),
            "EvalStrategy must be declared: {}", output
        );
        assert!(
            output.contains("var SimpleEvalStrategy") || output.contains("SimpleEvalStrategy ="),
            "SimpleEvalStrategy must be declared: {}", output
        );
    }

    #[test]
    fn test_var_with_separate_export_after_scope_capture() {
        // Same pattern but with var instead of class
        let input = "var x = 23;\nexport { x };";
        let output = transform_code(input, LivelyTransformConfig::default());
        assert!(output.contains("export {"), "keeps export: {}", output);
        // x must be declared locally (var x = __varRecorder__.x)
        assert!(output.contains("var x"), "x must be declared: {}", output);
    }

    #[test]
    fn test_function_with_separate_export_after_scope_capture() {
        // Function declaration + separate export
        let input = "function foo() { return 1; }\nexport { foo };";
        let output = transform_code(input, LivelyTransformConfig::default());
        assert!(output.contains("export {"), "keeps export: {}", output);
        // foo must be declared (function declaration survives)
        assert!(output.contains("function foo"), "foo must be declared: {}", output);
    }

    #[test]
    fn test_exported_class_retains_declaration_for_rollup() {
        // export class Foo {} — direct export. class-to-function converts to var.
        // The var must survive scope capture for rollup.
        let input = "export class Foo { method() {} }";
        let output = transform_code(input, config_with_class_to_function());
        // Must have either export { Foo } or export var Foo
        assert!(
            output.contains("export") && output.contains("Foo"),
            "Foo must be exported: {}", output
        );
    }

    // --- Resurrection build tests (exact bundler config) ---

    #[test]
    fn test_resurrection_class_with_separate_export() {
        // This is the exact pattern that fails in the bundler for eval-strategies.js
        let input = "class Foo { eval() { return 1; } }\nexport { Foo };";
        let output = transform_code(input, config_resurrection_with_class_to_function());
        assert!(output.contains("export {"), "keeps export: {}", output);
        assert!(
            output.contains("var Foo") || output.contains("let Foo") || output.contains("const Foo") || output.contains("class Foo"),
            "Foo must have a local declaration for rollup: {}", output
        );
    }

    #[test]
    fn test_resurrection_multiple_classes_with_separate_export() {
        let input = r#"
class EvalStrategy { eval() {} }
class SimpleEvalStrategy extends EvalStrategy { eval() {} }
export { EvalStrategy, SimpleEvalStrategy };
"#;
        let output = transform_code(input, config_resurrection_with_class_to_function());
        assert!(output.contains("export {"), "keeps export: {}", output);
        assert!(
            output.contains("var EvalStrategy") || output.contains("EvalStrategy ="),
            "EvalStrategy declared: {}", output
        );
        assert!(
            output.contains("var SimpleEvalStrategy") || output.contains("SimpleEvalStrategy ="),
            "SimpleEvalStrategy declared: {}", output
        );
    }

    #[test]
    fn test_resurrection_export_from_keeps_exports() {
        // export { x } from '...' should survive all transforms
        let input = r#"export { name1, name2 } from "foo";"#;
        let output = transform_code(input, config_resurrection_with_class_to_function());
        // The names should be importable after transform
        assert!(output.contains("name1"), "name1 present: {}", output);
        assert!(output.contains("name2"), "name2 present: {}", output);
    }

    #[test]
    fn test_resurrection_export_default_from() {
        let input = r#"export { default } from "foo";"#;
        let output = transform_code(input, config_resurrection_with_class_to_function());
        assert!(output.contains("default"), "default present: {}", output);
    }

    // --- Full pipeline: function declaration wrapping (Divergence 1) ---

    fn config_resurrection_with_wrapper() -> LivelyTransformConfig {
        let mut config = config_resurrection_with_class_to_function();
        config.declaration_wrapper = Some(r#"__varRecorder__["test-module.js__define__"]"#.to_string());
        config.current_module_accessor = Some(r#"({ pathInPackage: () => "test-module.js" })"#.to_string());
        config
    }

    #[test]
    fn test_full_pipeline_resurrection_func_decl_wrapping() {
        let input = "function greet() { return 'hello'; }";
        let output = transform_code(input, config_resurrection_with_wrapper());
        // Function declaration should be replaced with var + wrapper
        assert!(output.contains("var greet"), "func replaced with var: {}", output);
        assert!(!output.contains("function greet()"), "original func decl removed: {}", output);
        // Wrapper should use __moduleMeta__
        assert!(output.contains("__moduleMeta__"), "wrapper uses __moduleMeta__: {}", output);
        // __moduleMeta__ should be declared
        assert!(output.contains("var __moduleMeta__"), "moduleMeta declared: {}", output);
        // Wrapper should be a computed member expression
        assert!(output.contains(r#"__define__"#), "wrapper is recorder define method: {}", output);
    }

    // --- Full pipeline: named namespace re-export (Divergence 2) ---

    #[test]
    fn test_full_pipeline_named_namespace_reexport() {
        let input = r#"export * as utils from './utils.js';"#;
        let output = transform_code(input, config_resurrection_with_class_to_function());
        // Should transform into import + const + export
        assert!(output.contains("utils_namespace"), "creates namespace import: {}", output);
        assert!(output.contains("exportsOf"), "creates exportsOf fallback: {}", output);
        assert!(output.contains("export {"), "creates named export: {}", output);
    }

    #[test]
    fn test_full_pipeline_unnamed_export_all_unchanged() {
        let input = r#"export * from './utils.js';"#;
        let output = transform_code(input, config_resurrection_with_class_to_function());
        // Unnamed export * should still use recorderFor + Object.assign pattern
        assert!(output.contains("recorderFor"), "uses recorderFor: {}", output);
        assert!(output.contains("Object.assign"), "uses Object.assign: {}", output);
    }

    // --- Divergence S: ExportedImportCapturePass runs for all scope capture ---

    #[test]
    fn test_non_resurrection_export_from_gets_capture() {
        // ExportedImportCapturePass should run even without resurrection=true
        // when scope capture is enabled. This ensures export { x } from '...'
        // gets recorder captures in all modes.
        let input = r#"export { name1, name2 } from "foo";"#;
        let output = transform_code(input, LivelyTransformConfig::default());
        // Should have import + captures from ExportedImportCapturePass
        assert!(output.contains("__varRecorder__.name1") || output.contains("__varRecorder__.name2"),
            "non-resurrection export-from should get captures: {}", output);
    }

    #[test]
    fn test_declaration_wrapper_uses_computed_member() {
        // With declaration_wrapper set, function declarations get wrapped with the wrapper
        // as a direct function call, passing (name, kind, value, captureObj) as args.
        // Variable declarations do NOT get __define__ wrapping.
        let mut config = LivelyTransformConfig::default();
        config.capture_obj = "__lvVarRecorder".to_string();
        config.declaration_wrapper = Some("defVar_http://localhost:9011/test.js".to_string());
        config.module_id = "http://localhost:9011/test.js".to_string();
        let input = "function createLivelyLangObject() { return 1; }";
        let output = transform_code(input, config);
        // Function declarations are wrapped: wrapper("name", "function", ident, captureObj)
        assert!(
            output.contains(r#"defVar_http://localhost:9011/test.js("createLivelyLangObject", "function", createLivelyLangObject, __lvVarRecorder)"#),
            "Expected declaration wrapper call with __lvVarRecorder as 4th arg but got:\n{}",
            output
        );
        // The capture assignment should use the wrapper result
        assert!(
            output.contains("__lvVarRecorder.createLivelyLangObject ="),
            "Expected recorder capture assignment but got:\n{}",
            output
        );
    }
}
