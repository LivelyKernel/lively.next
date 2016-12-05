import { arr, obj, Path } from "lively.lang";
import { pt, Color } from "lively.graphics";
import { fuzzyParse, query, stringify } from "lively.ast";
import { resource } from "lively.resources";


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// interface
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

// await cleanupUnusedImports(that)

export async function cleanupUnusedImports(textMorph, opts = {query: true}) {

  var source = textMorph.textString;

  var modifications = modificationsToRemoveUnusedImports(source);
  if (!modifications || !modifications.changes.length) return "nothing to remove";

  var removed = arr.flatten(
          modifications.removedImports
                .map(({name, from}) => [
                     [`${name}`, {fontWeight: "bold"}], [" from ", {}],
                     [`${from}\n`, {fontStyle: "italic"}]]), 1);

  var instructions = [[`Really remove these imports?\n\n`, {fontWeight: "bold", fontSize: 15}], 
                      ...removed]

  var really = opts.query ?
    await textMorph.world().confirm(instructions) :
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

  var parsed = fuzzyParse(source);

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


export async function interactivelyInjectImportIntoText(textMorph, opts) {
// textMorph = that

  var {gotoImport, insertImportAtCursor} = {
    gotoImport: true,
    insertImportAtCursor: false,
    ...opts
  }

  var jsPlugin = textMorph.pluginFind(p => p.isJSEditorPlugin);
  if (!jsPlugin)
     throw new Error(`cannot find js plugin of ${textMorph}`)

  // 1. Ask what to import + generate insertions
  var exports = await jsPlugin.systemInterface().exportsOfModules(),
      choices = await ExportPrompt.run(textMorph.world(), exports);

  if (!choices.length) return null;

  var moduleId = textMorph.evalEnvironment.targetModule,
      from, to, pos, importedVarNames = [], ranges = [];

  if (gotoImport)
    textMorph.saveMark(); // so we can easily jump to where we were after insertion

  textMorph.undoManager.group();

  // 2. Insert new import statements or extend existing
  while (choices.length) {
    let choice = choices.shift(),
        source = textMorph.textString;

    var {generated, from, to, standaloneImport, importedVarName} =
      ImportInjector.run(System, moduleId, source, choice),

    pos = textMorph.indexToPosition(from);

    if (generated) ranges.push(textMorph.insertText(generated, pos));
    if (importedVarName) importedVarNames.push(importedVarName);
    if (standaloneImport) {
      try { await jsPlugin.runEval(standaloneImport); }
      catch (e) { console.error(`Error when trying to import ${standaloneImport}: ${e.stack}`); }
    }
  }

  // 3. insert imported var names at cursor
  if (insertImportAtCursor) {
    let source = importedVarNames.join("\n");
    textMorph.selection.text = source;
    if (!gotoImport) textMorph.scrollCursorIntoView();
  }

  textMorph.undoManager.group();

  // 4. select changes in import statements
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
      return {
        isListItem: true,
        value: ea,
        ...this.buildLabel(ea),
      }
    });
  }

  buildLabel({type, exported, local, fromModule, pathInPackage, packageName, packageVersion}) {
    // like "var foo (from ./bar.js)        [project/foo.js]"
    var exportName = exported === "default" ?
      `${local} (default)` : exported;

    if (fromModule) var reexportString = ` rexported from ${fromModule}`

    var annotationString = ` [${packageName}/${pathInPackage}`;
    if (packageVersion) annotationString += ` ${packageVersion}`;
    annotationString += "]";

    var label = [
      [exportName, {}],
      [
      `${type} ${reexportString || ""} ${annotationString}`, {
        fontSize: "70%",
        textStyleClasses: ["truncated-text", "annotation"],
        // maxWidth: 300
      }]
    ]

    // var annotation =

    return {label}
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
    this.parsed = optAst || fuzzyParse(intoModuleSource);
  }

  run() {
    var {standaloneImport, importedVarName} = this.generateImportStatement();
    var {imports, importsOfFromModule, importsOfVar} = this.existingImportsOfFromModule();

    // already imported?
    if (importsOfVar.length) return {
      status: "not modified",
      newSource: this.intoModuleSource,
      generated: "",
      importedVarName: "",
      standaloneImport,
      from: importsOfVar[0].start, to: importsOfVar[0].end
    };

    // modify an existing import?
    if (importsOfFromModule.length) {
      var modified = this.modifyExistingImport(importsOfFromModule, standaloneImport);
      if (modified) return modified;
    }

    // prepend new import
    var lastImport = arr.last(imports),
        insertPos = lastImport ? lastImport.end : 0;
    return this.insertNewImport(importsOfFromModule, standaloneImport, importedVarName, insertPos);
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

    return {
      standaloneImport: isDefault ?
        `import ${varName} from "${exportPath}";` :
        `import { ${varName} } from "${exportPath}";`,
      importedVarName: varName
    }
  }

  existingImportsOfFromModule() {
    var {System, fromModuleId, intoModuleId, importData: {exported: impName}, parsed} = this,
        isDefault = impName === "default",
        imports = parsed.body.filter(({type}) => type === "ImportDeclaration")

    var importsOfFromModule = imports.filter(ea => {
      if (!ea.source || typeof ea.source.value !== "string") return null;
      var sourceId = System.decanonicalize(ea.source.value, intoModuleId)
      return fromModuleId === sourceId;
    });

    var importsOfImportedVar = importsOfFromModule.filter(ea =>
        (ea.specifiers || []).some(iSpec =>
          isDefault ?
            iSpec.type === "ImportDefaultSpecifier" :
            Path("imported.name").get(iSpec) === impName));

    return {
      imports, importsOfFromModule,
      importsOfVar: importsOfImportedVar
    }
  }

  modifyExistingImport(imports, standaloneImport) {
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
        importedVarName: defaultImpName,
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
      importedVarName: impName,
      from: pos, to: pos + generated.length
    };

  }

  insertNewImport(importsOfFromModule, standaloneImport, importedVarName, insertPos = 0) {
    if (importsOfFromModule && importsOfFromModule.length)
      insertPos = arr.last(importsOfFromModule).end;

    var src = this.intoModuleSource,
        pre = src.slice(0, insertPos),
        post = src.slice(insertPos),
        generated = standaloneImport;

    if (pre.length && !pre.endsWith("\n")) generated = "\n" + generated;
    if (post.length && !post.startsWith("\n")) generated += "\n";

    return {
      status: "modified",
      newSource: pre + generated + post,
      generated,
      standaloneImport,
      importedVarName,
      from: insertPos, to: insertPos + generated.length
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
