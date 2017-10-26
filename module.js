import { resource } from "lively.resources";
import { isURL } from "lively.modules/src/url-helpers.js";
import { join, parent } from "lively.resources/src/helpers.js";
import { parse, stringify, transform, nodes, query } from "lively.ast";
import { findUniqJsName } from "./util.js";
import { arr, string } from "lively.lang";

function exportCall(exportName, id) {
  return stringify(
    nodes.exprStmt(
      nodes.funcCall(nodes.id("_export"), nodes.literal(exportName), id)))
}

export default class FreezerModule {

  constructor(name, _package, id) {
    this._id = id;
    this.name = name;
    this.package = _package;
    this.reset();
  }

  reset() {
    this._source = null;
    this.rawDependencies = null;
    this.rawExports = null;
    this.rawImports = null;
    this.parsed = null;
    this.scope = null;
    this.exports = [];
    this.dependencies = new Map();
    this.dependents = new Set();
  }

  addDependency(otherModule, importSpec) {
    this.dependencies.set(otherModule, importSpec);
    otherModule.addDependent(this);
    return otherModule;
  }

  addDependent(otherModule) { this.dependents.add(otherModule); }

  get id() {
    if (this._id) return this._id;
    if (this.package) return this.package.id + "/" + this.name;
    throw new Error(`id: Needs package or _id! (${this.name})`);
  }

  get qualifiedName() {
    if (this.package) return this.package.qualifiedName + "/" + this.name;
    if (this.id) return this.id;
    throw new Error(`qualifiedName: Needs package or id!`);
  }

  findUniqJsName(boundNames = []) {
    return findUniqJsName(this.qualifiedName, boundNames);
  }

  get isExcluded() {
    return !this.package || this.package.isExcluded;
  }

  get resource() {
    let {package: p} = this;
    if (this.package) return p ? p.resource.join(this.name) : resource(this.id);
  }

  async source() {
    return this._source || (this._source = await this.resource.read());
  }

  async parse() {
    if (this._parsed) return this;

    let parsed, scope, rawImports,
        exports = [], rawExports, source,
        dependencies = {};

    try {
      source = await this.source();
      parsed = parse(source, {addAstIndex: true});
      scope = query.scopes(parsed);
      rawImports = query.imports(scope);
      rawExports = query.exports(scope);
    } catch (err) { throw new Error(`Error parsing ${this.name}: ${err.stack}`); }

    for (let i of rawImports) {
      let {fromModule, imported, local, node} = i,
          dep = dependencies[fromModule] || (dependencies[fromModule] = {imports: []});
      dep.imports.push({imported, local, node});
    }

    for (let e of rawExports) {
      let {fromModule, imported, exported, local, node} = e;
      if (fromModule) {
        let dep = dependencies[fromModule] || (dependencies[fromModule] = {imports: []});
        dep.imports.push({imported, exported, node});
      }
      exports.push({exported, local});
    }

    this.rawDependencies = dependencies;
    this.parsed = parsed;
    this.scope = scope;
    this.exports = exports;
    this.rawExports = rawExports;
    this.rawImports = rawImports;

    return this;
  }

  async resolveImports(bundle) {
    // 1. try to resolve the "from" part of local imports
    // 2. find local var names for object capturing imports

    await this.parse();

    let {rawDependencies, scope, dependencies} = this;
        // boundNames = query.declarationsOfScope(scope).map(ea => ea.name);

    for (let localName in rawDependencies) {
      let {imports} = rawDependencies[localName],
          {module: otherModule, isPackageImport} = this.resolveImport(localName, bundle);
      this.addDependency(otherModule, {imports, localName, isPackageImport});
    }

    return this;
  }

  resolveImport(localName, bundle) {
    if (isURL(localName)) {
      return {
        module: bundle.findModuleWithId(localName)
             || bundle.addModule(new FreezerModule(localName, null, localName))
      };
    }

    if (localName.startsWith(".")) {
      if (!this.package) throw new Error("local module needs package!");
      let name = join(parent(this.name), localName);
      return {
        module: bundle.findModuleInPackageWithName(this.package, name)
             || bundle.addModule(new FreezerModule(name, this.package))
      };
    }

    let packageName = localName.includes("/") ?
                       localName.slice(0, localName.indexOf.includes("/")) :
                       localName,
        nameInPackage = localName.slice(packageName.length),
        packageSpec = bundle.findPackage(packageName),
        isPackageImport = !nameInPackage;

    // if (!packageSpec)
    //   throw new Error(`Cannot resolve package ${packageName}`);

    if (!packageSpec){
      return {
        isPackageImport,
        module: bundle.findModuleWithId(localName)
        || bundle.addModule(new FreezerModule(localName, null, localName))
      }
    }
    if (isPackageImport && packageSpec) {
      nameInPackage = packageSpec.main || (packageSpec.systemjs && packageSpec.systemjs.main) || "index.js"
    }

    return {
      isPackageImport,
      module: bundle.findModuleInPackageWithName(packageSpec, nameInPackage)
           || bundle.addModule(new FreezerModule(nameInPackage, packageSpec))
    };
  }


  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // transform
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  registerTranformsOfImports() {
    let topLevelIds = [], setters = [], qualifiedDependencyNames = [];
    for (let [depModule, {imports}] of this.dependencies) {
      // FIXME what if a toplevel var of `this` has the same name as the generated varName?
      let varName = depModule.findUniqJsName([]),
          setterStmts = [];
      qualifiedDependencyNames.push(depModule.qualifiedName);
      for (let i of imports) {
        let importedName = i.local || i.exported;
        setterStmts.push(nodes.exprStmt(nodes.assign(importedName, nodes.member(nodes.id(varName), i.imported))));
        topLevelIds.push(nodes.id(importedName));
      }
      setters.push(nodes.funcExpr({}, [nodes.id(varName)], ...setterStmts))
    }
    let topLevelDecl = topLevelIds.length ? {
      type: "VariableDeclaration",
      kind: "var",
      declarations: topLevelIds.map(ea => ({type: "VariableDeclarator", id: ea, init: null}))
    } : null;
    return {topLevelDecl, setters, qualifiedDependencyNames};
  }

  registerTranformsOfExports() {
    let exported = [];

    for (let node of this.parsed.body) {
      let {type, declaration, specifiers} = node;
      if (type !== "ExportNamedDeclaration" && type !== "ExportDefaultDeclaration")
        continue;

      let exportTransform = {node, replacementFunc: () => [], ids: []};
      exported.push(exportTransform);

      if (type === "ExportNamedDeclaration" && declaration) {

        switch (declaration.type) {

          case 'VariableDeclaration':
            exportTransform.replacementFunc = (node, source, wasChanged) => {
              source = source.replace(/^(\s*)export\s+/, "");
              let ids = query.helpers.declIds(node.declaration.declarations.map(ea => ea.id)),
                  exports = ids.map(id => exportCall(id.name, id)).join("\n")                  
              return source + "\n" + exports;
            }
            // for (let id of query.helpers.declIds(declaration.declarations.map(ea => ea.id)))
            //   exportTransform.ids.push({local: id, exported: id});
            break;

          case 'ClassDeclaration': case 'FunctionDeclaration':
            exportTransform.replacementFunc = (node, source, wasChanged) =>
                source.replace(/^(\s*)export\s+/, "") + "\n"
              + exportCall(node.declaration.id.name, node.declaration.id);
            break;
        }
        continue;
      }

      if (type === "ExportNamedDeclaration" && specifiers) {
        if (node.source) {
          for (let {local, exported} of specifiers)
            exportTransform.ids.push({local, exported});
        }
        continue;
      }

      if (type === "ExportDefaultDeclaration" && declaration) {
        let local;
        switch (declaration.type) {

          case 'Identifier':
            exportTransform.replacementFunc = (node, source, wasChanged) =>
              source.replace(/^export\s+default\s+/, "") + "\n" + exportCall("default", node.declaration);
            local = declaration;
            break;

          case 'ClassDeclaration': case 'FunctionDeclaration':
            exportTransform.replacementFunc = (node, source, wasChanged) =>
              source.replace(/^export\s+default\s+/, "") + exportCall("default", node.declaration.id);
            local = declaration.id;
            break;

          default:
            throw new Error(`Strange default export declaration: ${declaration.type}`);
        }

        continue;
      }
    }

    return exported;
  }
  
  transformToRegisterFormat(opts = {}) {
    let {runtimeGlobal = "System"} = opts,
        {topLevelDecl, setters, qualifiedDependencyNames} = this.registerTranformsOfImports(),
        exportTransformData = this.registerTranformsOfExports(),
        additionalExports = [],
        replaced = transform.replaceNodes([
          // remove import decls completely
          ...this.parsed.body.filter(ea => ea.type === "ImportDeclaration")
                                .map(target => ({target, replacementFunc: () => []})),

          // // remove exports
          ...exportTransformData.map(({node: target, replacementFunc, ids}) => {
            additionalExports.push(...ids.map(ea => exportCall(ea.exported.name, ea.exported)))
            return {target, replacementFunc}
          })
        ], this._source);

    return `${runtimeGlobal}.register("${this.qualifiedName}", `
         + `[${qualifiedDependencyNames.map(ea => `"${ea}"`).join(", ")}], `
         + `function(_export, _context) {\n`
         + `  "use strict";\n`
         + (topLevelDecl ? `  ${stringify(topLevelDecl)}\n` : "")
         + `  return {\n`
         + `    setters: [\n`
         + `${string.indent(setters.map(stringify).join(",\n"), "  ", 3)}\n`
         + `    ],\n`
         + `    execute: function() {\n`
         + `${string.indent(replaced.source.trim(), "  ", 3)}\n`
         + (additionalExports.length ? `${string.indent(additionalExports.join("\n"), "  ", 3)}\n` : "")
         + `    }\n`
         + `  }\n`
         + `});`
  }

}
