import { arr, obj, Path } from "lively.lang";
import { pt } from "lively.graphics";
import { parse, query, stringify } from "lively.ast";
import { resource } from "lively.resources";


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// interface
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

// await cleanupUnusedImports(that)

export async function cleanupUnusedImports(textMorph, opts = {query: true}) {

  var source = textMorph.textString;

  var modifications = modificationsToRemoveUnusedImports(source);
  if (!modifications || !modifications.changes.length) return "nothing to remove";

  var removed = modifications.removedImports
    .map(({name, from}) => `${name} from ${from}`).join("\n")

  var really = opts.query ?
    await textMorph.world().confirm(`Really remove these imports?\n${removed}`) :
    true;
  if (!really) return "canceled";

  textMorph.undoManager.group();
  for (let {replacement, start, end} of modifications.changes) {
    var range = {
      start: textMorph.indexToPosition(start),
      end: textMorph.indexToPosition(end)
    };
    textMorph.replace(range, replacement);
  }
  textMorph.undoManager.group();

  return "imports removed";
}


function modificationsToRemoveUnusedImports(source) {
  // returns {
  //   source: STRING,
  //   modifications: [{start: NUMBER, end: NUMBER, replacement: STRING}]
  //   removedImports: [{name: STRING, from: STRING}]
  // }

  var parsed = parse(source);

  // 1.get imports with specifiers
  var imports = arr.flatmap(parsed.body, ea => {
        if (ea.type !== "ImportDeclaration" || !ea.specifiers.length) return [];
        return ea.specifiers.map(spec => ({local: spec.local, importStmt: ea}));
      }),
      importIdentifiers = imports.map(ea => ea.local)

  // 2. get all var references of source without those included in the import
  // statments
  var scope = query.resolveReferences(query.scopes(parsed)),
      refsWithoutImports = Array.from(scope.resolvedRefMap.keys()).filter(ea =>
                              !importIdentifiers.includes(ea)),
      realRefs = arr.uniq(refsWithoutImports.map(ea => ea.name));

  // 3. figure out what imports need to be removed or changed
  var importsToChange = imports.filter(ea => !realRefs.includes(ea.local.name)),
      removedImports = importsToChange.map(ea =>
        ({name: ea.local.name, from: ea.importStmt.source.value})),
      affectedStmts = arr.uniq(importsToChange.map(ea => {
        var specToRemove = ea.importStmt.specifiers.find(spec => ea.local === spec.local);
        arr.remove(ea.importStmt.specifiers, specToRemove);
        return ea.importStmt;
      }));

  // 4. Compute the actual modifications to transform source and also new source itself
  var modifications = affectedStmts.slice().reverse().reduce((state, importStmt) => {
    var {source, changes} = state,
        {start, end, specifiers} = importStmt,
        pre = source.slice(0, start), post = source.slice(end),
        removed = source.slice(start, end),
        replacement = !specifiers.length ? "" : stringify(importStmt);

    if (replacement && replacement.includes("\n") && !removed.includes("\n"))
      replacement = replacement.replace(/\s+/g, " ");

    source = pre + replacement + post;
    changes = changes.concat({replacement, start, end});
   return {source, changes};
  }, {source, changes: []})

  return {...modifications, removedImports};
}


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-


export async function interactivelyInjectImportIntoText(textMorph, opts = {gotoImport: true}) {
// textMorph = that

  var {gotoImport} = opts,
      exports = await ExportLookup.run(System),
      choices = await ExportPrompt.run(textMorph.world(), exports);

  if (!choices.length) return null;

  var moduleId = textMorph.evalEnvironment.targetModule,
      jsPlugin = textMorph.pluginFind(p => p.isJSEditorPlugin),
      source, generated, standaloneImport, from, to, pos, ranges = [];

  console.assert(!!jsPlugin, "cannot find js plugin of text");

  textMorph.saveMark(); // so we can easily jump to where we were after insertion

  textMorph.undoManager.group();
  while (choices.length) {
    let choice = choices.shift();
    source = textMorph.textString,
    {generated, from, to, standaloneImport} = ImportInjector.run(System, moduleId, source, choice),
    pos = textMorph.indexToPosition(from);
    if (generated) ranges.push(textMorph.insertText(generated, pos));
    if (standaloneImport) {
      try { await jsPlugin.runEval(standaloneImport); }
      catch (e) { console.error(`Error when trying to import ${standaloneImport}: ${e.stack}`); }
    }
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
    var standaloneImport = this.generateImportStatement();
    var {imports, importsOfVar} = this.existingImportsOfFromModule();

    // already imported?
    if (importsOfVar.length) return {
      status: "not modified",
      newSource: this.intoModuleSource,
      generated: "",
      standaloneImport,
      from: importsOfVar[0].start, to: importsOfVar[0].end
    };

    // modify an existing import?
    if (imports.length) {
      var modified = this.modifyExistingImport(imports, standaloneImport);
      if (modified) return modified;
    }

    // prepend new import
    return this.insertNewImport(imports, standaloneImport);
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

  modifyExistingImport(imports, standaloneImport) {
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
        standaloneImport,
        from: pos, to: pos + generated.length
      }
    }

    var pos = normalSpecifier ? normalSpecifier.end : defaultSpecifier.end,
        generated = normalSpecifier ? `, ${impName}` : `, { ${impName} }`;

    return {
      status: "modified",
      newSource: `${src.slice(0, pos)}${generated}${src.slice(pos)}`,
      generated,
      standaloneImport,
      from: pos, to: pos + generated.length
    };

  }

  insertNewImport(importsOfFromModule, standaloneImport) {
    var pos = 0;
    if (importsOfFromModule && importsOfFromModule.length)
      pos = arr.last(importsOfFromModule).end;

    var src = this.intoModuleSource,
        pre = src.slice(0, pos),
        post = src.slice(pos),
        generated = standaloneImport;

    if (pre.length && !pre.endsWith("\n")) generated = "\n" + generated;
    if (post.length && !post.startsWith("\n")) generated += "\n";

    return {
      status: "modified",
      newSource: pre + generated + post,
      generated,
      standaloneImport,
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
