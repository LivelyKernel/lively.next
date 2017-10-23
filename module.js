import { resource } from "lively.resources";
import { parse, stringify, transform, nodes, query } from "lively.ast";
import { findUniqJsName } from "./util.js";
import { arr } from "lively.lang";

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

  async prepareBundling(bundle) {
    // 1. try to resolve the "from" part of local imports
    // 2. find local var names for object capturing imports

    await this.parse();

    let {rawDependencies, scope, dependencies} = this;
        // boundNames = query.declarationsOfScope(scope).map(ea => ea.name);

    for (let localName in rawDependencies) {
      let {imports} = rawDependencies[localName];

      let {
        module: otherModule,
        isExternal, isPackageImport
      } = bundle.resolveModuleImport(this, localName);

      this.addDependency(otherModule, {imports, localName, isExternal, isPackageImport});
    }

    return this
  }


  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // transform
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  computeImportReplacements() {
    let replacements = [], locals = [], moduleJSIdentifiers = [];
    for (let [depModule, {imports}] of this.dependencies) {
      let varName = depModule.findUniqJsName(moduleJSIdentifiers);
      moduleJSIdentifiers.push(varName);
      locals.push(varName);
      for (let imported of imports) {
        let {refs, decls} = query.findReferencesAndDeclsInScope(query.scopes(this.parsed), imported.local);
        for (let ref of refs) {
          replacements.push({
            target: ref,
            replacementFunc: (node, source, wasChanged) =>
              [nodes.member(nodes.id(varName), ref.name)]
          });
        }
      }
    }
    return {locals, replacements};
  }

  exportTransformSpecs() {
    let exported = [];

    for (let node of this.parsed.body) {
      let {type, declaration, specifiers} = node;
      if (type !== "ExportNamedDeclaration" && type !== "ExportDefaultDeclaration")
        continue;

      let exportTransform = {node, replacementFunc: () => [], ids: []};
      exported.push(exportTransform);

      if (type === "ExportNamedDeclaration" && declaration) {
        // exportTransform.replacementFunc = (node, source, wasChanged) => [node.declaration];
        exportTransform.replacementFunc = (node, source, wasChanged) =>
          source.replace(/^(\s*)export\s+/, (_, indent) => indent);
        switch (declaration.type) {
          case 'VariableDeclaration':
            for (let id of query.helpers.declIds(declaration.declarations.map(ea => ea.id))) {
              exportTransform.ids.push({local: id, exported: id});
            }
            break;
          case 'ClassDeclaration': case 'FunctionDeclaration':
            exportTransform.ids.push({local: declaration.id, exported: declaration.id});
            break;
        }
        continue;
      }

      if (type === "ExportNamedDeclaration" && specifiers) {
        for (let {local, exported} of specifiers)
          exportTransform.ids.push({local, exported});
        continue;
      }

      if (type === "ExportDefaultDeclaration" && declaration) {
        exportTransform.replacementFunc = (node, source, wasChanged) =>
          source.replace(/^(\s*)export\s+default\s+/, (_, indent) => indent);
        let local;
        switch (declaration.type) {
          case 'Identifier': local = declaration; break;
          case 'ClassDeclaration': case 'FunctionDeclaration': local = declaration.id; break;
          default:
            throw new Error(`Strange default export declaration: ${declaration.type}`);
        }
        exportTransform.ids.push({local, exported: {type: "Identifier", name: "default"}});
        continue;
      }
    }

    return exported;
  }

  transformToModuleFunction() {
    let {replacements: importReplacements, locals: imported} = this.computeImportReplacements(),
        exportTransformData = this.exportTransformSpecs();

    let replaced = transform.replaceNodes([

          // replace references of imported objects with import transform var names
          ...importReplacements,

          // remove import decls completely
          ...this.parsed.body.filter(ea => ea.type === "ImportDeclaration")
                                .map(target => ({target, replacementFunc: () => []})),

          // remove exports
          ...exportTransformData.map(({node: target, replacementFunc}) => ({target, replacementFunc}))
        ], this._source);

    let exportGetters = arr.flatmap(exportTransformData, ({ids}) =>
      ids.map(({local, exported}) =>
        nodes.exprStmt(
          nodes.funcCall(
            nodes.member("__exports__", "__defineGetter__"),
            nodes.literal(exported.name),
            nodes.funcExpr({arrow: true, expression: true}, [], local)))));

    return `function ${this.findUniqJsName([])}(__imports__, __exports__) {\n`
         + `${exportGetters.map(stringify).join("\n")}`
         + `${replaced.source}\n`
         + `\n}`;
  }

}