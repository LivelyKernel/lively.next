use swc_common::{sync::Lrc, FileName, Globals, Mark, SourceMap, SyntaxContext, DUMMY_SP, GLOBALS};
use swc_ecma_ast::*;
use swc_ecma_codegen::{text_writer::JsWriter, Config as CodegenConfig, Emitter};
use swc_ecma_parser::{parse_file_as_module, EsSyntax, Syntax};
use swc_ecma_transforms_base::{fixer::fixer, hygiene::hygiene, resolver};
use swc_ecma_transforms_module::path::Resolver;
use swc_ecma_utils::contains_top_level_await;
use swc_ecma_visit::{VisitMut, VisitMutWith};
use wasm_bindgen::prelude::*;

use lively_swc_transforms::config::LivelyTransformConfig;
use lively_swc_transforms::utils::ast_helpers::*;
use lively_swc_transforms::LivelyTransformVisitor;

/// Transform JavaScript source code using lively.next's SWC transforms,
/// then wrap in System.register() format for SystemJS module loading.
///
/// # Arguments
/// * `source` - The JavaScript source code to transform
/// * `config_json` - JSON string matching `LivelyTransformConfig`
///
/// # Returns
/// JSON string: `{ "code": "...", "map": "..." }`
#[wasm_bindgen]
pub fn transform(source: &str, config_json: &str) -> Result<String, JsError> {
    let config: LivelyTransformConfig = serde_json::from_str(config_json)
        .map_err(|e| JsError::new(&format!("Invalid config: {}", e)))?;

    // SWC's SystemJS transform requires the GLOBALS thread-local
    GLOBALS.set(&Globals::default(), || transform_inner(source, config))
}

fn transform_inner(source: &str, config: LivelyTransformConfig) -> Result<String, JsError> {
    let cm = Lrc::new(SourceMap::default());
    let fm = cm.new_source_file(
        FileName::Custom(config.module_id.clone()).into(),
        source.to_string(),
    );

    let unresolved_mark = Mark::new();

    let module = parse_file_as_module(
        &fm,
        Syntax::Es(EsSyntax {
            jsx: false,
            decorators: true,
            ..Default::default()
        }),
        Default::default(),
        None,
        &mut vec![],
    )
    .map_err(|e| JsError::new(&format!("Parse error: {:?}", e)))?;

    let mut program = swc_ecma_ast::Program::Module(module);

    // Phase 1: Run lively transforms (scope capture, class-to-function, etc.)
    let capture_obj = config.capture_obj.clone();
    let module_id = config.module_id.clone();
    let declaration_wrapper = config.declaration_wrapper.clone();
    let excluded = config.exclude.clone();
    let has_scope_capture = config.enable_scope_capture;
    let mut visitor = LivelyTransformVisitor::new(config);
    program.visit_mut_with(&mut visitor);

    normalize_imported_exports(&mut program);

    // SystemJS export tracking uses binding IDs, not just identifier names.
    // Resolve scopes after Lively has introduced its generated bindings.
    let top_level_mark = Mark::new();
    resolver(unresolved_mark, top_level_mark, false).process(&mut program);
    let has_top_level_await = contains_top_level_await(&program);
    normalize_exported_updates(&mut program);

    // Phase 2: Wrap in System.register() for SystemJS module loading
    let mut systemjs_pass = swc_ecma_transforms_module::system_js(
        Resolver::Default,
        unresolved_mark,
        swc_ecma_transforms_module::system_js::Config {
            allow_top_level_this: true,
            ..Default::default()
        },
    );
    systemjs_pass.process(&mut program);

    // Phase 3: Post-process the System.register output to match Babel's
    // livelyPostTranspile (babel/plugin.js lines 1216-1327):
    //
    // (a) Remove "use strict" from factory (Babel removes it, line 1263)
    // (b) Move __lvVarRecorder init from execute() to the factory body
    // (c) Rewrite setters to capture imports to __lvVarRecorder (with defVar
    //     wrapper and normalizeImportedNamespace)
    // (d) Add evaluationStart/evaluationEnd hooks to execute() (line 1127/1130)
    remove_directives(&mut program);
    fix_async_execute(&mut program, has_top_level_await);
    if has_scope_capture {
        hoist_recorder_init(&mut program, &capture_obj);
        let recorder = Ident::new(
            capture_obj.clone().into(),
            DUMMY_SP,
            SyntaxContext::empty().apply_mark(top_level_mark),
        );
        rewrite_setters(
            &mut program,
            &recorder,
            declaration_wrapper.as_deref(),
            &excluded,
        );
        insert_evaluation_hooks(&mut program, &module_id);
    }
    // Note: we intentionally do NOT insert early _export({name: void 0}) calls
    // in the factory body. Babel's SystemJS transform doesn't do this either.
    // Early exports cause problems with circular deps (e.g. cycle-breaker.js
    // classHolder becomes void 0). SystemJS handles circular deps by returning
    // whatever exports have been set so far when a circular import is detected.

    // Keep generated bindings distinct from user names, then restore parentheses.
    hygiene().process(&mut program);
    fixer(None).process(&mut program);

    // Generate code + source map
    let mut src_buf = vec![];
    let mut src_map_buf = vec![];
    {
        let mut emitter = Emitter {
            cfg: CodegenConfig::default().with_ascii_only(false),
            cm: cm.clone(),
            comments: None,
            wr: JsWriter::new(cm.clone(), "\n", &mut src_buf, Some(&mut src_map_buf)),
        };
        emitter
            .emit_program(&program)
            .map_err(|e| JsError::new(&format!("Codegen error: {:?}", e)))?;
    }

    finish_output(cm, src_buf, src_map_buf)
}

/// SWC 6 omits exports for prefix updates and predicts every postfix update as +1.
/// Update a local copy, then assign the binding so SystemJS exports the actual value.
fn normalize_exported_updates(program: &mut Program) {
    let Program::Module(module) = program else {
        return;
    };
    let mut exported = std::collections::HashSet::new();
    for item in &module.body {
        match item {
            ModuleItem::ModuleDecl(ModuleDecl::ExportDecl(export)) => match &export.decl {
                Decl::Var(decl) => {
                    for declarator in &decl.decls {
                        exported.extend(extract_idents_from_pat(&declarator.name));
                    }
                }
                Decl::Fn(decl) => {
                    exported.insert(decl.ident.to_id());
                }
                Decl::Class(decl) => {
                    exported.insert(decl.ident.to_id());
                }
                _ => {}
            },
            ModuleItem::ModuleDecl(ModuleDecl::ExportNamed(export)) if export.src.is_none() => {
                for specifier in &export.specifiers {
                    if let ExportSpecifier::Named(specifier) = specifier {
                        if let ModuleExportName::Ident(ident) = &specifier.orig {
                            exported.insert(ident.to_id());
                        }
                    }
                }
            }
            _ => {}
        }
    }
    struct UpdateNormalizer {
        exported: std::collections::HashSet<Id>,
    }
    impl VisitMut for UpdateNormalizer {
        fn visit_mut_expr(&mut self, expr: &mut Expr) {
            expr.visit_mut_children_with(self);
            let Expr::Update(update) = expr else { return };
            let Expr::Ident(binding) = &*update.arg else {
                return;
            };
            if !self.exported.contains(&binding.to_id()) {
                return;
            }
            let value_name = format!("{}$livelyValue", binding.sym);
            let result_name = format!("{}$livelyResult", binding.sym);
            let body = BlockStmt {
                span: update.span,
                ctxt: Default::default(),
                stmts: vec![
                    Stmt::Decl(create_var_decl(
                        VarDeclKind::Const,
                        &result_name,
                        Some(Expr::Update(UpdateExpr {
                            arg: Box::new(create_ident_expr(&value_name)),
                            ..update.clone()
                        })),
                    )),
                    Stmt::Expr(ExprStmt {
                        span: update.span,
                        expr: Box::new(create_assign_expr(
                            expr_to_assign_target(Expr::Ident(binding.clone())),
                            create_ident_expr(&value_name),
                        )),
                    }),
                    Stmt::Return(ReturnStmt {
                        span: update.span,
                        arg: Some(Box::new(create_ident_expr(&result_name))),
                    }),
                ],
            };
            *expr = create_call_expr(
                create_arrow_fn(
                    vec![Pat::Ident(BindingIdent {
                        id: Ident::new(value_name.into(), DUMMY_SP, Default::default()),
                        type_ann: None,
                    })],
                    BlockStmtOrExpr::BlockStmt(body),
                ),
                vec![to_expr_or_spread(Expr::Ident(binding.clone()))],
            );
        }
    }
    module.visit_mut_with(&mut UpdateNormalizer { exported });
}

/// Extract statements from either Script or Module program.
fn get_stmts_mut(program: &mut Program) -> Vec<&mut Stmt> {
    match program {
        Program::Script(s) => s.body.iter_mut().collect(),
        Program::Module(m) => m
            .body
            .iter_mut()
            .filter_map(|item| {
                if let ModuleItem::Stmt(s) = item {
                    Some(s)
                } else {
                    None
                }
            })
            .collect(),
    }
}

/// Locate the generated System.register factory, excluding user functions.
fn register_body_mut(program: &mut Program) -> Option<&mut BlockStmt> {
    for stmt in get_stmts_mut(program) {
        let Stmt::Expr(ExprStmt { expr, .. }) = stmt else {
            continue;
        };
        let Expr::Call(call) = &mut **expr else {
            continue;
        };
        let Callee::Expr(callee) = &call.callee else {
            continue;
        };
        let Expr::Member(member) = &**callee else {
            continue;
        };
        if !matches!(&*member.obj, Expr::Ident(id) if id.sym == *"System")
            || !matches!(&member.prop, MemberProp::Ident(id) if id.sym == *"register")
        {
            continue;
        }
        let Expr::Fn(factory) = &mut *call.args.last_mut()?.expr else {
            continue;
        };
        return factory.function.body.as_mut();
    }
    None
}

fn execute_mut(body: &mut BlockStmt) -> Option<&mut Function> {
    let result = body.stmts.iter_mut().rev().find_map(|stmt| match stmt {
        Stmt::Return(ReturnStmt { arg: Some(arg), .. }) => Some(arg),
        _ => None,
    })?;
    let Expr::Object(object) = &mut **result else {
        return None;
    };
    object.props.iter_mut().find_map(|prop| {
        let PropOrSpread::Prop(prop) = prop else {
            return None;
        };
        let Prop::KeyValue(property) = &mut **prop else {
            return None;
        };
        if !matches!(&property.key, PropName::Ident(id) if id.sym == *"execute") {
            return None;
        }
        let Expr::Fn(function) = &mut *property.value else {
            return None;
        };
        Some(&mut *function.function)
    })
}

/// Match Babel's removal of module directives, preserving nested function directives.
fn remove_directives(program: &mut Program) {
    fn remove(body: &mut BlockStmt) {
        body.stmts.retain(|stmt| {
            !matches!(stmt, Stmt::Expr(ExprStmt { expr, .. })
                if matches!(&**expr, Expr::Lit(Lit::Str(s))
                    if s.value == *"use strict" || s.value == *"format esm"))
        });
    }
    if let Some(body) = register_body_mut(program) {
        remove(body);
        if let Some(body) = execute_mut(body).and_then(|function| function.body.as_mut()) {
            remove(body);
        }
    }
}

/// SWC 6 also marks modules async for awaits in function expressions or methods.
/// Only actual top-level await should make the generated execute function async.
fn fix_async_execute(program: &mut Program, has_top_level_await: bool) {
    if let Some(execute) = register_body_mut(program).and_then(execute_mut) {
        execute.is_async = has_top_level_await;
    }
}

/// SWC 6 loses local import exports or reverses their aliases. Re-export from
/// the original source so the dependency setter also propagates future updates.
fn normalize_imported_exports(program: &mut Program) {
    let Program::Module(module) = program else {
        return;
    };
    let mut imports = std::collections::HashMap::new();
    for item in &module.body {
        if let ModuleItem::ModuleDecl(ModuleDecl::Import(import)) = item {
            for specifier in &import.specifiers {
                let original = match specifier {
                    ImportSpecifier::Named(named) => Some(
                        named
                            .imported
                            .clone()
                            .unwrap_or_else(|| ModuleExportName::Ident(named.local.clone())),
                    ),
                    ImportSpecifier::Default(_) => Some(ModuleExportName::Ident(Ident::new(
                        "default".into(),
                        DUMMY_SP,
                        Default::default(),
                    ))),
                    ImportSpecifier::Namespace(_) => None,
                };
                imports.insert(
                    specifier.local().to_id(),
                    (import.src.clone(), original, import.with.clone()),
                );
            }
        }
    }
    let mut body = Vec::with_capacity(module.body.len());
    for item in module.body.drain(..) {
        let ModuleItem::ModuleDecl(ModuleDecl::ExportNamed(mut export)) = item else {
            body.push(item);
            continue;
        };
        if export.src.is_some() {
            body.push(ModuleItem::ModuleDecl(ModuleDecl::ExportNamed(export)));
            continue;
        }
        let mut remaining = Vec::new();
        for specifier in std::mem::take(&mut export.specifiers) {
            let imported = match &specifier {
                ExportSpecifier::Named(named) => match &named.orig {
                    ModuleExportName::Ident(local) => imports.get(&local.to_id()),
                    _ => None,
                },
                _ => None,
            };
            if let Some((source, original, attributes)) = imported {
                let ExportSpecifier::Named(named) = specifier else {
                    unreachable!()
                };
                let public_name = named.exported.unwrap_or(named.orig);
                let specifier = match original {
                    Some(original) => ExportSpecifier::Named(ExportNamedSpecifier {
                        span: named.span,
                        orig: original.clone(),
                        exported: Some(public_name),
                        is_type_only: named.is_type_only,
                    }),
                    None => ExportSpecifier::Namespace(ExportNamespaceSpecifier {
                        span: named.span,
                        name: public_name,
                    }),
                };
                let mut reexport = export.clone();
                reexport.src = Some(source.clone());
                reexport.with = attributes.clone();
                reexport.specifiers = vec![specifier];
                body.push(ModuleItem::ModuleDecl(ModuleDecl::ExportNamed(reexport)));
            } else {
                remaining.push(specifier);
            }
        }
        if !remaining.is_empty() {
            export.specifiers = remaining;
            body.push(ModuleItem::ModuleDecl(ModuleDecl::ExportNamed(export)));
        }
    }
    module.body = body;
}

/// Insert evaluationStart() at the beginning and evaluationEnd() at the end
/// of execute().  Matches Babel's livelyPreTranspile (lines 1127/1130).
///
/// Generates:
///   System.get("@lively-env").evaluationStart("moduleId");
///   ... original execute body ...
///   System.get("@lively-env").evaluationEnd("moduleId");
fn insert_evaluation_hooks(program: &mut Program, module_id: &str) {
    for stmt in get_stmts_mut(program) {
        let call = match stmt {
            Stmt::Expr(ExprStmt { expr, .. }) => match &mut **expr {
                Expr::Call(c) => c,
                _ => continue,
            },
            _ => continue,
        };
        if call.args.len() < 2 {
            continue;
        }
        let factory = match &mut *call.args[1].expr {
            Expr::Fn(f) => f,
            _ => continue,
        };
        let body = match &mut factory.function.body {
            Some(b) => b,
            None => continue,
        };

        // Find the return statement → execute property
        let return_stmt = body.stmts.iter_mut().rev().find_map(|s| {
            if let Stmt::Return(ret) = s {
                Some(ret)
            } else {
                None
            }
        });
        let return_stmt = match return_stmt {
            Some(r) => r,
            None => continue,
        };
        let return_obj = match &mut return_stmt.arg {
            Some(a) => match &mut **a {
                Expr::Object(o) => o,
                _ => continue,
            },
            None => continue,
        };

        // Find execute function
        for prop in &mut return_obj.props {
            if let PropOrSpread::Prop(p) = prop {
                if let Prop::KeyValue(kv) = &mut **p {
                    if let PropName::Ident(id) = &kv.key {
                        if id.sym.as_ref() == "execute" {
                            if let Expr::Fn(f) = &mut *kv.value {
                                if let Some(exec_body) = &mut f.function.body {
                                    let make_hook = |method: &str| -> Stmt {
                                        Stmt::Expr(ExprStmt {
                                            span: DUMMY_SP,
                                            expr: Box::new(Expr::Call(CallExpr {
                                                span: DUMMY_SP,
                                                ctxt: Default::default(),
                                                callee: Callee::Expr(Box::new(Expr::Member(
                                                    MemberExpr {
                                                        span: DUMMY_SP,
                                                        obj: Box::new(Expr::Call(CallExpr {
                                                            span: DUMMY_SP,
                                                            ctxt: Default::default(),
                                                            callee: Callee::Expr(Box::new(
                                                                Expr::Member(MemberExpr {
                                                                    span: DUMMY_SP,
                                                                    obj: Box::new(Expr::Ident(
                                                                        Ident::new(
                                                                            "System".into(),
                                                                            DUMMY_SP,
                                                                            Default::default(),
                                                                        ),
                                                                    )),
                                                                    prop: MemberProp::Ident(
                                                                        IdentName {
                                                                            span: DUMMY_SP,
                                                                            sym: "get".into(),
                                                                        },
                                                                    ),
                                                                }),
                                                            )),
                                                            args: vec![ExprOrSpread {
                                                                spread: None,
                                                                expr: Box::new(Expr::Lit(
                                                                    Lit::Str(Str {
                                                                        span: DUMMY_SP,
                                                                        value: "@lively-env".into(),
                                                                        raw: None,
                                                                    }),
                                                                )),
                                                            }],
                                                            type_args: None,
                                                        })),
                                                        prop: MemberProp::Ident(IdentName {
                                                            span: DUMMY_SP,
                                                            sym: method.into(),
                                                        }),
                                                    },
                                                ))),
                                                args: vec![ExprOrSpread {
                                                    spread: None,
                                                    expr: Box::new(Expr::Lit(Lit::Str(Str {
                                                        span: DUMMY_SP,
                                                        value: module_id.into(),
                                                        raw: None,
                                                    }))),
                                                }],
                                                type_args: None,
                                            })),
                                        })
                                    };
                                    exec_body.stmts.insert(0, make_hook("evaluationStart"));
                                    exec_body.stmts.push(make_hook("evaluationEnd"));
                                }
                            }
                        }
                    }
                }
            }
        }
        break;
    }
}

/// Move `__lvVarRecorder = System.get("@lively-env").moduleEnv(...).recorder`
/// from execute() to the factory body.  This matches what Babel's
/// livelyPostTranspile does (lines 1307-1310 of babel/plugin.js).
fn hoist_recorder_init(program: &mut Program, capture_obj: &str) {
    for stmt in get_stmts_mut(program) {
        let call = match stmt {
            Stmt::Expr(ExprStmt { expr, .. }) => match &mut **expr {
                Expr::Call(c) => c,
                _ => continue,
            },
            _ => continue,
        };

        if call.args.len() < 2 {
            continue;
        }
        let factory = match &mut *call.args[1].expr {
            Expr::Fn(f) => f,
            _ => continue,
        };
        let body = match &mut factory.function.body {
            Some(b) => b,
            None => continue,
        };

        // Find the return statement to get execute function
        let return_idx = body.stmts.iter().position(|s| matches!(s, Stmt::Return(_)));
        let return_idx = match return_idx {
            Some(i) => i,
            None => continue,
        };

        let execute_body = {
            let return_stmt = &body.stmts[return_idx];
            let ret_arg = match return_stmt {
                Stmt::Return(ReturnStmt { arg: Some(a), .. }) => a,
                _ => continue,
            };
            let obj = match &**ret_arg {
                Expr::Object(o) => o,
                _ => continue,
            };
            obj.props.iter().find_map(|prop| {
                if let PropOrSpread::Prop(p) = prop {
                    if let Prop::KeyValue(kv) = &**p {
                        if let PropName::Ident(id) = &kv.key {
                            if id.sym.as_ref() == "execute" {
                                // Get the function body
                                if let Expr::Fn(f) = &*kv.value {
                                    return f.function.body.as_ref().map(|b| b.stmts.clone());
                                }
                            }
                        }
                    }
                }
                None
            })
        };

        let execute_stmts = match execute_body {
            Some(s) => s,
            None => continue,
        };

        // Find the __lvVarRecorder = ... assignment in execute()
        // Pattern: __lvVarRecorder = System.get("@lively-env").moduleEnv(...).recorder
        // Note: SWC's system_js may combine assignments into comma expressions (Seq),
        // so we also check the first expression in a SeqExpr.
        let is_recorder_assign = |expr: &Expr| -> bool {
            if let Expr::Assign(AssignExpr { left, .. }) = expr {
                if let Some(SimpleAssignTarget::Ident(id)) = left.as_simple() {
                    return id.sym.as_ref() == capture_obj;
                }
            }
            false
        };
        let recorder_idx = execute_stmts.iter().position(|s| {
            if let Stmt::Expr(ExprStmt { expr, .. }) = s {
                if is_recorder_assign(expr) {
                    return true;
                }
                // Also check first expr in a comma expression
                if let Expr::Seq(seq) = &**expr {
                    if let Some(first) = seq.exprs.first() {
                        return is_recorder_assign(first);
                    }
                }
            }
            false
        });

        let recorder_idx = match recorder_idx {
            Some(i) => i,
            None => continue,
        };

        // Extract the recorder init. It may be a standalone Assign or the first
        // expr in a SeqExpr (comma expression).
        let orig_stmt = &execute_stmts[recorder_idx];
        let recorder_stmt = if let Stmt::Expr(ExprStmt { expr, .. }) = orig_stmt {
            if let Expr::Seq(seq) = &**expr {
                // Extract first expression as standalone statement
                if let Some(first) = seq.exprs.first() {
                    Stmt::Expr(ExprStmt {
                        span: DUMMY_SP,
                        expr: Box::new((**first).clone()),
                    })
                } else {
                    orig_stmt.clone()
                }
            } else {
                orig_stmt.clone()
            }
        } else {
            orig_stmt.clone()
        };

        // Now mutably access execute to remove/modify the statement
        let return_stmt = &mut body.stmts[return_idx];
        let ret_arg = match return_stmt {
            Stmt::Return(ReturnStmt { arg: Some(a), .. }) => a,
            _ => continue,
        };
        let obj = match &mut **ret_arg {
            Expr::Object(o) => o,
            _ => continue,
        };
        for prop in &mut obj.props {
            if let PropOrSpread::Prop(p) = prop {
                if let Prop::KeyValue(kv) = &mut **p {
                    if let PropName::Ident(id) = &kv.key {
                        if id.sym.as_ref() == "execute" {
                            if let Expr::Fn(f) = &mut *kv.value {
                                if let Some(b) = &mut f.function.body {
                                    // If it was a SeqExpr, remove the first sub-expression
                                    // (keep the rest as a SeqExpr or single expr)
                                    let stmt = &mut b.stmts[recorder_idx];
                                    if let Stmt::Expr(ExprStmt { expr, .. }) = stmt {
                                        if let Expr::Seq(seq) = &mut **expr {
                                            if seq.exprs.len() > 2 {
                                                seq.exprs.remove(0);
                                            } else if seq.exprs.len() == 2 {
                                                // Convert from Seq([a, b]) to just b
                                                let remaining = seq.exprs.remove(1);
                                                *expr = remaining;
                                            } else {
                                                b.stmts.remove(recorder_idx);
                                            }
                                        } else {
                                            b.stmts.remove(recorder_idx);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // Insert recorder init in factory body, before the return statement
        body.stmts.insert(return_idx, recorder_stmt);

        break;
    }
}

/// Rewrite setters to capture imports to __lvVarRecorder.
/// Matches Babel's livelyPostTranspile (lines 1267-1296 of babel/plugin.js).
///
/// Input setter:  `function(_dep) { X = _dep.X; }`
/// Output setter: `function(_dep = {}) { __lvVarRecorder.X = wrapper("X", "var", X = _dep.X, __lvVarRecorder); }`
///
/// Without wrapper: `function(_dep = {}) { __lvVarRecorder.X = X = _dep.X; }`
fn rewrite_setters(
    program: &mut Program,
    capture_obj: &Ident,
    declaration_wrapper: Option<&str>,
    excluded: &[String],
) {
    for stmt in get_stmts_mut(program) {
        let call = match stmt {
            Stmt::Expr(ExprStmt { expr, .. }) => match &mut **expr {
                Expr::Call(c) => c,
                _ => continue,
            },
            _ => continue,
        };

        if call.args.len() < 2 {
            continue;
        }
        let factory = match &mut *call.args[1].expr {
            Expr::Fn(f) => f,
            _ => continue,
        };
        let body = match &mut factory.function.body {
            Some(b) => b,
            None => continue,
        };

        // Find the return statement
        let return_stmt = body.stmts.iter_mut().rev().find_map(|s| {
            if let Stmt::Return(ret) = s {
                Some(ret)
            } else {
                None
            }
        });
        let return_stmt = match return_stmt {
            Some(r) => r,
            None => continue,
        };
        let return_obj = match &mut return_stmt.arg {
            Some(a) => match &mut **a {
                Expr::Object(o) => o,
                _ => continue,
            },
            None => continue,
        };

        // Find the setters property
        let setters_prop = return_obj.props.iter_mut().find_map(|prop| {
            if let PropOrSpread::Prop(p) = prop {
                if let Prop::KeyValue(kv) = &mut **p {
                    if let PropName::Ident(id) = &kv.key {
                        if id.sym.as_ref() == "setters" {
                            return Some(&mut kv.value);
                        }
                    }
                }
            }
            None
        });

        let setters_arr = match setters_prop {
            Some(v) => match &mut **v {
                Expr::Array(a) => a,
                _ => continue,
            },
            None => continue,
        };

        // Rewrite each setter function
        for elem in &mut setters_arr.elems {
            let setter_fn = match elem {
                Some(ExprOrSpread { expr, .. }) => match &mut **expr {
                    Expr::Fn(f) => f,
                    _ => continue,
                },
                _ => continue,
            };

            // Add default parameter: _dep → _dep = {}
            if let Some(param) = setter_fn.function.params.first_mut() {
                if let Pat::Ident(id) = &param.pat {
                    let id_clone = id.clone();
                    param.pat = Pat::Assign(AssignPat {
                        span: DUMMY_SP,
                        left: Box::new(Pat::Ident(id_clone)),
                        right: Box::new(Expr::Object(ObjectLit {
                            span: DUMMY_SP,
                            props: vec![],
                        })),
                    });
                }
            }

            // Rewrite each statement in the setter body
            let setter_body = match &mut setter_fn.function.body {
                Some(b) => b,
                None => continue,
            };

            let new_stmts: Vec<Stmt> = setter_body
                .stmts
                .drain(..)
                .map(|s| {
                    // Match: X = _dep.X  (ExpressionStatement with AssignmentExpression)
                    let expr_stmt = match &s {
                        Stmt::Expr(es) => es,
                        _ => return s,
                    };
                    let assign = match &*expr_stmt.expr {
                        Expr::Assign(a) => a,
                        _ => return s,
                    };
                    // LHS must be a simple identifier
                    let binding = match &assign.left {
                        AssignTarget::Simple(SimpleAssignTarget::Ident(id)) => id.id.clone(),
                        _ => return s,
                    };
                    let lhs_name = binding.sym.to_string();

                    // Skip excluded names
                    if excluded.contains(&lhs_name) {
                        return s;
                    }

                    // Keep the original assignment (always runs): X = _dep.X
                    let orig_stmt = s.clone();

                    // Build the recorder capture (guarded):
                    // if (typeof __rec !== "undefined") __rec.X = [defVar(..., X, __rec) | X]
                    let value_expr = Expr::Ident(binding);
                    let rhs = if let Some(wrapper) = declaration_wrapper {
                        Expr::Call(CallExpr {
                            span: DUMMY_SP,
                            ctxt: Default::default(),
                            callee: Callee::Expr(Box::new(Expr::Member(MemberExpr {
                                span: DUMMY_SP,
                                obj: Box::new(Expr::Ident(capture_obj.clone())),
                                prop: MemberProp::Computed(ComputedPropName {
                                    span: DUMMY_SP,
                                    expr: Box::new(Expr::Lit(Lit::Str(Str {
                                        span: DUMMY_SP,
                                        value: wrapper.into(),
                                        raw: None,
                                    }))),
                                }),
                            }))),
                            args: vec![
                                ExprOrSpread {
                                    spread: None,
                                    expr: Box::new(Expr::Lit(Lit::Str(Str {
                                        span: DUMMY_SP,
                                        value: lhs_name.as_str().into(),
                                        raw: None,
                                    }))),
                                },
                                ExprOrSpread {
                                    spread: None,
                                    expr: Box::new(Expr::Lit(Lit::Str(Str {
                                        span: DUMMY_SP,
                                        value: "var".into(),
                                        raw: None,
                                    }))),
                                },
                                ExprOrSpread {
                                    spread: None,
                                    expr: Box::new(value_expr),
                                },
                                ExprOrSpread {
                                    spread: None,
                                    expr: Box::new(Expr::Ident(capture_obj.clone())),
                                },
                            ],
                            type_args: None,
                        })
                    } else {
                        value_expr
                    };

                    let capture_assign = Expr::Assign(AssignExpr {
                        span: DUMMY_SP,
                        op: AssignOp::Assign,
                        left: AssignTarget::Simple(SimpleAssignTarget::Member(MemberExpr {
                            span: DUMMY_SP,
                            obj: Box::new(Expr::Ident(capture_obj.clone())),
                            prop: MemberProp::Ident(IdentName {
                                span: DUMMY_SP,
                                sym: lhs_name.as_str().into(),
                            }),
                        })),
                        right: Box::new(rhs),
                    });

                    // Two statements: 1) original assignment, 2) guarded recorder capture
                    // Return a block to hold both.
                    // We'll flatten this below since we need to return Vec<Stmt>.
                    // Actually, just return both statements — we'll collect into a Vec.
                    // For now, combine as: `X = _dep.X; if (typeof __rec !== "undefined") __rec.X = defVar("X", "var", X, __rec);`
                    // We can't return 2 stmts from a map that expects 1. Use a block:
                    Stmt::Block(BlockStmt {
                        span: DUMMY_SP,
                        ctxt: Default::default(),
                        stmts: vec![
                            orig_stmt,
                            Stmt::If(IfStmt {
                                span: DUMMY_SP,
                                test: Box::new(Expr::Bin(BinExpr {
                                    span: DUMMY_SP,
                                    op: BinaryOp::NotEqEq,
                                    left: Box::new(Expr::Unary(UnaryExpr {
                                        span: DUMMY_SP,
                                        op: UnaryOp::TypeOf,
                                        arg: Box::new(Expr::Ident(capture_obj.clone())),
                                    })),
                                    right: Box::new(Expr::Lit(Lit::Str(Str {
                                        span: DUMMY_SP,
                                        value: "undefined".into(),
                                        raw: None,
                                    }))),
                                })),
                                cons: Box::new(Stmt::Expr(ExprStmt {
                                    span: DUMMY_SP,
                                    expr: Box::new(capture_assign),
                                })),
                                alt: None,
                            }),
                        ],
                    })
                })
                .collect();

            setter_body.stmts = new_stmts;
        }

        break; // Only one System.register per module
    }
}

fn finish_output(
    cm: Lrc<SourceMap>,
    src_buf: Vec<u8>,
    src_map_buf: Vec<(swc_common::BytePos, swc_common::LineCol)>,
) -> Result<String, JsError> {
    let code =
        String::from_utf8(src_buf).map_err(|e| JsError::new(&format!("UTF-8 error: {}", e)))?;

    let mut src_map = vec![];
    cm.build_source_map_from(&src_map_buf, None)
        .to_writer(&mut src_map)
        .map_err(|e| JsError::new(&format!("Source map error: {}", e)))?;

    let map = String::from_utf8(src_map)
        .map_err(|e| JsError::new(&format!("Source map UTF-8 error: {}", e)))?;

    Ok(serde_json::json!({
        "code": code,
        "map": map,
    })
    .to_string())
}

/// Returns the version of the transforms library.
#[wasm_bindgen]
pub fn version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::process::Command;

    fn assert_module_runs(source: &str, capture: bool, assertions: &str) {
        let config = LivelyTransformConfig {
            module_id: "test.js".into(),
            enable_scope_capture: capture,
            enable_component_transform: false,
            enable_dynamic_import_transform: false,
            ..Default::default()
        };
        let result: serde_json::Value = serde_json::from_str(
            &transform(source, &serde_json::to_string(&config).unwrap()).unwrap(),
        )
        .unwrap();
        let code = result["code"].as_str().unwrap();
        let script = format!(
            r#"
const assert = require('node:assert/strict');
const exportsOfModule = {{}};
const recorder = {{}};
const __contextModule__ = {{ id: 'test.js' }};
const lively = {{ FreezerRuntime: {{ recorderFor: () => recorder }} }};
let execution;
let updateDependency;
const System = {{
    get: () => ({{ evaluationStart() {{}}, evaluationEnd() {{}} }}),
    register(dependencies, factory) {{
        const declaration = factory((name, value) => {{
            if (typeof name === 'object') Object.assign(exportsOfModule, name);
            else exportsOfModule[name] = value;
            return value;
        }}, __contextModule__);
        for (let i = 0; i < dependencies.length; i++) {{
            assert.equal(dependencies[i], 'dep');
            declaration.setters[i]({{ value: 3 }});
        }}
        updateDependency = dependency => declaration.setters.forEach(setter => setter(dependency));
        execution = declaration.execute();
    }}
}};
{code}
Promise.resolve(execution).then(async () => {{
    {assertions}
}}).catch(error => {{ console.error(error); process.exitCode = 1; }});
"#
        );
        let output = Command::new("node")
            .args(["-e", &script])
            .output()
            .expect("Node is required to execute the browser transform regression tests");
        assert!(
            output.status.success(),
            "Transformed module failed:\n{}\nGenerated code:\n{}",
            String::from_utf8_lossy(&output.stderr),
            code
        );
    }

    #[test]
    fn live_exports_update_inside_expressions() {
        assert_module_runs(
            "export let count = 0; export function next() { return Math.max(0, ++count); }",
            false,
            "assert.equal(exportsOfModule.next(), 1); assert.equal(exportsOfModule.count, 1);",
        );
    }

    #[test]
    fn shadowed_bindings_leave_module_exports_unchanged() {
        assert_module_runs(
            "export let count = 10; export function local(count) { return Math.max(0, ++count); }",
            false,
            "assert.equal(exportsOfModule.local(2), 3); assert.equal(exportsOfModule.count, 10);",
        );
    }

    #[test]
    fn top_level_await_and_user_execute_remain_async() {
        assert_module_runs(
            "export const answer = await Promise.resolve(42); export const worker = { execute: async function() { return await Promise.resolve(7); } };",
            false,
            "assert.equal(exportsOfModule.answer, 42); assert.equal(await exportsOfModule.worker.execute(), 7);",
        );
    }

    #[test]
    fn recorder_initialization_preserves_runtime_selection() {
        assert_module_runs(
            "var value = 3; export function get() { return value; }",
            true,
            "assert.equal(recorder.value, 3); assert.equal(exportsOfModule.get(), 3);",
        );
    }

    #[test]
    fn nested_async_methods_do_not_delay_module_execution() {
        assert_module_runs(
            "export const worker = { execute: async function() { return await Promise.resolve(7); } };",
            false,
            "assert.equal(execution, undefined); assert.equal(await exportsOfModule.worker.execute(), 7);",
        );
    }

    #[test]
    fn nested_function_strict_directives_are_preserved() {
        assert_module_runs(
            "export function strict() { 'use strict'; return this; }",
            false,
            "const strict = exportsOfModule.strict; assert.equal(strict(), undefined);",
        );
    }

    #[test]
    fn destructured_assignments_remain_valid() {
        assert_module_runs(
            "export let value; ({value} = {value: 3});",
            false,
            "assert.equal(exportsOfModule.value, 3);",
        );
    }

    #[test]
    fn exported_updates_preserve_numeric_conversion_and_return_values() {
        assert_module_runs(
            "export let count = '4'; export function next() { return count++; } export function previous() { return count--; } export function increment() { return ++count; } export function decrement() { return --count; }",
            false,
            "assert.equal(exportsOfModule.next(), 4); assert.equal(exportsOfModule.count, 5); assert.equal(exportsOfModule.previous(), 5); assert.equal(exportsOfModule.count, 4); assert.equal(exportsOfModule.increment(), 5); assert.equal(exportsOfModule.decrement(), 4); assert.equal(exportsOfModule.count, 4);",
        );
        assert_module_runs(
            "export let count = 4n; export function next() { return count++; } export function previous() { return --count; }",
            false,
            "assert.equal(exportsOfModule.next(), 4n); assert.equal(exportsOfModule.count, 5n); assert.equal(exportsOfModule.previous(), 4n); assert.equal(exportsOfModule.count, 4n);",
        );
    }

    #[test]
    fn generated_export_function_does_not_shadow_user_bindings() {
        assert_module_runs(
            "export function _export(value) { return value + 1; } export const answer = _export(3);",
            false,
            "assert.equal(exportsOfModule.answer, 4); assert.equal(exportsOfModule._export(4), 5);",
        );
    }

    #[test]
    fn imported_bindings_are_captured_by_setters() {
        assert_module_runs(
            "import { value } from 'dep'; export function get() { return value; }",
            true,
            "assert.equal(recorder.value, 3); assert.equal(exportsOfModule.get(), 3);",
        );
    }

    #[test]
    fn class_local_names_do_not_suppress_recorder_initialization() {
        assert_module_runs(
            "var value = 3; class Foo { method(lively) { return value; } } export function get() { return value; }",
            true,
            "assert.equal(recorder.value, 3); assert.equal(exportsOfModule.get(), 3);",
        );
        assert_module_runs(
            "var value = 3; const Foo = class lively {}; export function get() { return value; }",
            true,
            "assert.equal(recorder.value, 3); assert.equal(exportsOfModule.get(), 3);",
        );
    }

    #[test]
    fn imported_export_aliases_keep_their_binding_and_public_name() {
        assert_module_runs(
            "const value = 3; export { value as answer };",
            false,
            "assert.equal(exportsOfModule.answer, 3);",
        );
        assert_module_runs(
            "import { value } from 'dep'; export { value as answer };",
            false,
            "assert.equal(exportsOfModule.answer, 3); updateDependency({value: 7}); assert.equal(exportsOfModule.answer, 7);",
        );
        assert_module_runs(
            "import { value } from 'dep'; export { value as default };",
            false,
            "assert.equal(exportsOfModule.default, 3); updateDependency({value: 7}); assert.equal(exportsOfModule.default, 7);",
        );
        assert_module_runs(
            "import * as values from 'dep'; export { values as namespace };",
            false,
            "assert.equal(exportsOfModule.namespace.value, 3);",
        );
    }
}
