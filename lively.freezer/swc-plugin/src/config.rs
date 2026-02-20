use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LivelyTransformConfig {
    /// The name of the object to capture variables to (default: "__varRecorder__")
    #[serde(default = "default_capture_obj")]
    pub capture_obj: String,

    /// Optional wrapper function for declarations in resurrection builds
    #[serde(default)]
    pub declaration_wrapper: Option<String>,

    /// Configuration for class-to-function transformation
    #[serde(default)]
    pub class_to_function: Option<ClassToFunctionConfig>,

    /// List of global identifiers to exclude from capturing
    #[serde(default)]
    pub exclude: Vec<String>,

    /// Whether to capture imports in the scope recorder
    #[serde(default = "default_true")]
    pub capture_imports: bool,

    /// Whether this is a resurrection build (enables special transforms)
    #[serde(default)]
    pub resurrection: bool,

    /// The current module ID/path
    #[serde(default)]
    pub module_id: String,

    /// Expression string used by legacy transforms as the current module accessor.
    #[serde(default)]
    pub current_module_accessor: Option<String>,

    /// Package name for class metadata
    #[serde(default)]
    pub package_name: Option<String>,

    /// Package version for class metadata
    #[serde(default)]
    pub package_version: Option<String>,

    /// Whether to enable component descriptor wrapping
    #[serde(default = "default_true")]
    pub enable_component_transform: bool,

    /// Whether to enable namespace transforms
    #[serde(default = "default_true")]
    pub enable_namespace_transform: bool,

    /// Whether to enable dynamic import transforms
    #[serde(default = "default_true")]
    pub enable_dynamic_import_transform: bool,

    /// Whether to enable SystemJS register rewriting
    #[serde(default)]
    pub enable_systemjs_transform: bool,

    /// Whether to split export variable declarations
    #[serde(default = "default_true")]
    pub enable_export_split: bool,

    /// Resolved import source -> normalized module id
    #[serde(default)]
    pub resolved_imports: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClassToFunctionConfig {
    /// The object that holds the class (e.g., "__varRecorder__")
    pub class_holder: String,

    /// The function name for initialization (e.g., "initializeES6ClassForLively")
    pub function_node: String,

    /// Expression to access current module metadata
    pub current_module_accessor: String,
}

impl Default for LivelyTransformConfig {
    fn default() -> Self {
        Self {
            capture_obj: default_capture_obj(),
            declaration_wrapper: None,
            class_to_function: None,
            exclude: vec![
                // Common globals
                "console".to_string(),
                "window".to_string(),
                "document".to_string(),
                "global".to_string(),
                "process".to_string(),
                "Buffer".to_string(),
                "System".to_string(),
                "__contextModule__".to_string(),
                // Standard built-ins
                "Object".to_string(),
                "Array".to_string(),
                "Function".to_string(),
                "String".to_string(),
                "Number".to_string(),
                "Boolean".to_string(),
                "Symbol".to_string(),
                "Date".to_string(),
                "Math".to_string(),
                "JSON".to_string(),
                "Promise".to_string(),
                "RegExp".to_string(),
                "Error".to_string(),
                "Map".to_string(),
                "Set".to_string(),
                "WeakMap".to_string(),
                "WeakSet".to_string(),
                "Proxy".to_string(),
                "Reflect".to_string(),
                "undefined".to_string(),
                "NaN".to_string(),
                "Infinity".to_string(),
            ],
            capture_imports: true,
            resurrection: false,
            module_id: String::new(),
            current_module_accessor: None,
            package_name: None,
            package_version: None,
            enable_component_transform: true,
            enable_namespace_transform: true,
            enable_dynamic_import_transform: true,
            enable_systemjs_transform: false,
            enable_export_split: true,
            resolved_imports: HashMap::new(),
        }
    }
}

fn default_capture_obj() -> String {
    "__varRecorder__".to_string()
}

fn default_true() -> bool {
    true
}

impl LivelyTransformConfig {
    /// Check if an identifier should be excluded from capturing
    pub fn is_excluded(&self, name: &str) -> bool {
        self.exclude.iter().any(|e| e == name)
    }
}
