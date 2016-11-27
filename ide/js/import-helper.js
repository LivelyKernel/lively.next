import { arr, obj, Path } from "lively.lang";
import { pt } from "lively.graphics";
import { parse, stringify } from "lively.ast";
import { resource } from "lively.resources";


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// interface
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

export async function interactivelyInjectImportIntoText(textMorph, opts = {gotoImport: true}) {
// textMorph = that

  var {gotoImport} = opts,
      exports = await ExportLookup.run(System),
      choices = await ExportPrompt.run(textMorph.world(), exports);

  if (!choices.length) return null;

  var moduleId = textMorph.evalEnvironment.targetModule,
      source, generated, from, to, pos, ranges = [];

  textMorph.undoManager.group();
  while (choices.length) {
    let choice = choices.shift();
    source = textMorph.textString,
    {generated, from, to} = ImportInjector.run(System, moduleId, source, choice),
    pos = textMorph.indexToPosition(from);
    if (generated) ranges.push(textMorph.insertText(generated, pos));
  }
  textMorph.undoManager.group();

  if (gotoImport) {
    if (ranges.length) {
      textMorph.selection = arr.last(ranges);
      textMorph.scrollCursorIntoView();
    } else {
      textMorph.selection = {start: pos, end: textMorph.indexToPosition(to)};
      textMorph.scrollCursorIntoView();
    }    
  }

  return {ranges};
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// finding the exports available in currently loaded modules
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

class ExportLookup {

  static run(System) {
    return new this().systemExports(System);
  }

  async systemExports(System) {
    var exportsByModule = await this.rawExportsByModule(System);
    Object.keys(exportsByModule).forEach(id =>
      this.resolveExportsOfModule(System, id, exportsByModule))

    return arr.flatmap(Object.keys(exportsByModule),
      id => exportsByModule[id].resolvedExports || exportsByModule[id].rawExports)
  }

  async rawExportsByModule(System) {
    var livelyEnv = System.get("@lively-env") || {},
        mods = Object.keys(livelyEnv.loadedModules || {}),
        exportsByModule = {}

    await Promise.all(mods.map(async moduleId => {
      var mod = lively.modules.module(moduleId),
          pathInPackage = mod.pathInPackage().replace(/^\.\//, ""),
          p = mod.package(),
          isMain = p.main && pathInPackage === p.main,
          packageURL = p.url,
          packageName = p.name,
          packageVersion = p.version,
          result = {
            moduleId, isMain,
            pathInPackage, packageName, packageURL, packageVersion,
            exports: []
          }
      try { result.exports = await mod.exports(); } catch(e) { result.error = e;  }
      exportsByModule[moduleId] = {rawExports: result};
    }))

    return exportsByModule;
  }

  resolveExportsOfModule(System, moduleId, exportsByModule, locked = {}) {
    // takes the `rawExports` in `exportsByModule` that was produced by
    // `rawExportsByModule` and resolves all "* from" exports. Extends the
    // `rawExportsByModule` map woth a `resolvedExports` property

    // prevent endless recursion
    if (locked[moduleId]) return;
    locked[moduleId] = true;

    var data = exportsByModule[moduleId];
    if (!data || data.resolvedExports) return;

    var base = obj.select(data.rawExports, [
      "moduleId", "isMain", "packageName", "packageURL",
      "packageVersion", "pathInPackage"]);

    data.resolvedExports = arr.flatmap(data.rawExports.exports, ({type, exported, local, fromModule}) => {
      if (type !== "all") return [{...base, type, exported, local, fromModule}];

      // resolve "* from"
      var fromId = System.decanonicalize(fromModule, moduleId);
      this.resolveExportsOfModule(System, fromId, exportsByModule, locked);
      return (exportsByModule[fromId].resolvedExports || []).map(resolvedExport => {
        var {type, exported, local, fromModule: resolvedFromModule} = resolvedExport;
        return {...base, type, exported, local, fromModule: resolvedFromModule || fromModule};
      })
    });

    locked[moduleId] = false;
  }
}


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// choosing an export to import
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

class ExportPrompt {

  static run(world, exportData) { return new this().run(world, exportData); }

  async run(world, exportData) {
    var {selected: choices}  = await world.filterableListPrompt(
      "Select import", this.buildItems(exportData), {
        multiSelect: true,
        historyId: "lively.morphic/ide/js-interactively-import",
        extent: pt(800, 500)
      });
    return choices;
  }

  buildItems(exportData) {
    var string1MaxWidth = 0;
    return exportData.map(ea => {
      var {exportString, annotation} = this.buildItemString(ea);
      string1MaxWidth = Math.min(60, Math.max(string1MaxWidth, exportString.length))

      return {
        isListItem: true,
        value: ea,
        get string() {
          var string = exportString;
          string += " ".repeat(Math.max(1, string1MaxWidth - exportString.length));
          string += annotation;
          return string;
        }
      }
    })
  }

  buildItemString({type, exported, local, fromModule, pathInPackage, packageName, packageVersion}) {
    // like "var foo (from ./bar.js)        [project/foo.js]"
    var exportName = exported === "default" ?
      `${local} (default)` : exported;
    var exportString = `${type} ${exportName}`;
    if (fromModule) exportString += ` from ${fromModule}`

    var annotation = ` [${packageName}/${pathInPackage}`;
    if (packageVersion) annotation += ` ${packageVersion}`;
    annotation += "]";

    return {exportString, annotation}
  }

}


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// injecting the import into a module
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

export class ImportInjector {

  static run(System, intoModuleId, intoModuleSource, importData, optAst) {
    return new this(System, intoModuleId, intoModuleSource, importData, optAst).run();
  }

  constructor(System, intoModuleId, intoModuleSource, importData, optAst) {
    this.System = System
    this.intoModuleId = intoModuleId
    this.intoModuleSource = intoModuleSource
    this.fromModuleId = importData.moduleId;
    this.importData = importData
    this.parsed = optAst || parse(intoModuleSource);
  }

  run() {
    var {imports, importsOfVar} = this.existingImportsOfFromModule();

    // already imported?
    if (importsOfVar.length) return {
      status: "not modified",
      newSource: this.intoModuleSource,
      generated: "",
      from: importsOfVar[0].start, to: importsOfVar[0].end
    };

    // modify an existing import?
    if (imports.length) {
      var modified = this.modifyExistingImport(imports);
      if (modified) return modified;
    }

    // prepend new import
    return this.insertNewImport(imports);
  }

  generateImportStatement() {
    var {intoModuleId, fromModuleId, importData} = this,
        isDefault = importData.exported === "default",
        varName = isDefault ? importData.local : importData.exported,
        exportPath = fromModuleId;

    var {packageName, pathInPackage, isMain} = importData;
    if (isMain) exportPath = packageName;
    else {
      try {
        exportPath = resource(fromModuleId).relativePathFrom(resource(intoModuleId));
        if (!exportPath.startsWith(".")) exportPath = "./" + exportPath;
      } catch (e) {
        if (packageName && packageName !== "no group"  && pathInPackage)
          exportPath = packageName + "/" + pathInPackage;
      }
    }

    return isDefault ?
      `import ${varName} from "${exportPath}";` :
      `import { ${varName} } from "${exportPath}";`;
  }

  existingImportsOfFromModule() {
    var {System, fromModuleId, intoModuleId, importData: {exported: impName}, parsed} = this,
        isDefault = impName === "default",
        imports = parsed.body.filter(({type}) => type === "ImportDeclaration")

    var importsFromModule = imports.filter(ea => {
      if (!ea.source || typeof ea.source.value !== "string") return null;
      var sourceId = System.decanonicalize(ea.source.value, intoModuleId)
      return fromModuleId === sourceId;
    });

    var importsOfImportedVar = importsFromModule.filter(ea =>
        (ea.specifiers || []).some(iSpec =>
          isDefault ?
            iSpec.type === "ImportDefaultSpecifier" :
            Path("imported.name").get(iSpec) === impName));

    return {
      imports: importsFromModule,
      importsOfVar: importsOfImportedVar
    }
  }

  modifyExistingImport(imports) {
  // var imports = this.existingImportsOfFromModule().imports

    var specifiers = arr.flatmap(imports, ({specifiers}) => specifiers || [])
    if (!specifiers.length) return null;

    var [[defaultSpecifier], [normalSpecifier]] =
      arr.partition(specifiers, ({type}) => type === "ImportDefaultSpecifier");

      // defaultSpecifier = arr.partition(imports, ({type}) => type === "ImportDefaultSpecifier")[0][0]
      // normalSpecifier = arr.partition(imports, ({type}) => type === "ImportDefaultSpecifier")[1][0]

    var {intoModuleSource: src, importData: {exported: impName, local: defaultImpName}} = this,
        isDefault = impName === "default";

    // Since this method is only called with imports this should never happen:
    if (isDefault) console.assert(!!normalSpecifier, "no ImportSpecifier found")
    else console.assert(normalSpecifier || defaultSpecifier, "at least one kine of specifier is expected");

    if (isDefault) {
      var pos = src.slice(0, normalSpecifier.start).lastIndexOf("{")-1;
      if (pos < 0) return null;

      var generated = defaultImpName + ",",
          pre = src.slice(0, pos),
          post = src.slice(pos);

      if (!pre.endsWith(" ") || !pre.endsWith("\n")) generated = " " + generated;
      if (!post.startsWith(" ")) generated += " ";

      return {
        status: "modified",
        newSource: `${pre}${generated}${post}`,
        generated,
        from: pos, to: pos + generated.length
      }
    }

    var pos = normalSpecifier ? normalSpecifier.end : defaultSpecifier.end,
        generated = normalSpecifier ? `, ${impName}` : `, { ${impName} }`;

    return {
      status: "modified",
      newSource: `${src.slice(0, pos)}${generated}${src.slice(pos)}`,
      generated,
      from: pos, to: pos + generated.length
    };

  }

  insertNewImport(importsOfFromModule) {
    var pos = 0;
    if (importsOfFromModule && importsOfFromModule.length)
      pos = arr.last(importsOfFromModule).end;

    var src = this.intoModuleSource,
        pre = src.slice(0, pos),
        post = src.slice(pos),
        generated = this.generateImportStatement();

    if (pre.length && !pre.endsWith("\n")) generated = "\n" + generated;
    if (post.length && !post.startsWith("\n")) generated += "\n";

    return {
      status: "modified",
      newSource: pre + generated + post,
      generated,
      from: pos, to: pos + generated.length
    };
  }
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

// var exports = await ExportLookup.run(System)
// arr.uniq(exports.map(ea => ea.packageName)).join("")
// var choice = await ExportPrompt.run(this.world(), exports);
// choice
//
// ImportInjector.run(System, "http://foo/a.js", "class Foo {}", choice);
