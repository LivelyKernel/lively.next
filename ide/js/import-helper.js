import { arr } from 'lively.lang';
import { pt } from 'lively.graphics';
import LoadingIndicator from "../../loading-indicator.js";
import { config } from "lively.morphic";
import { ImportInjector, ImportRemover } from "lively.modules/src/import-modification.js";


export async function cleanupUnusedImports(textMorph, opts = {query: true}) {
  var source = textMorph.textString,
      unused = ImportRemover.findUnusedImports(source);
  if (!unused || !unused.length) return "nothing to remove";

  var items = unused.map(ea => {
    var {local, from} = ea;
    var label = [
       [`${local}`, {fontWeight: "bold"}], [" from ", {}],
       [`${from}\n`, {fontStyle: "italic"}]]
     return {isListItem: true, label, value: ea};
  });

  var {list: importsToRemove} = await textMorph.world().editListPrompt(
    'Which imports should be removed?', items, {multiSelect: true});

  if (!importsToRemove.length) return "canceled";

  var modifications = ImportRemover.removeImports(source, importsToRemove);
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

  // 1. gather all exorts
  var exports = await LoadingIndicator.runFn(
    () => jsPlugin.systemInterface().exportsOfModules(
      {excludedPackages: config.ide.js.ignoredPackages}), "computing imports...");

  // 2. Ask what to import + generate insertions
  var choices = await ExportPrompt.run(textMorph.world(), exports);
  if (!choices.length) return null;

  var moduleId = textMorph.evalEnvironment.targetModule,
      intoPackage = await jsPlugin.systemInterface().getPackageForModule(moduleId),
      from, to, pos, importedVarNames = [], ranges = [];

  if (gotoImport)
    textMorph.saveMark(); // so we can easily jump to where we were after insertion

  textMorph.undoManager.group();

  // 3. Insert new import statements or extend existing
  while (choices.length) {
    let choice = choices.shift(),
        source = textMorph.textString;

    var {generated, from, to, standaloneImport, importedVarName} =
      ImportInjector.run(System, moduleId, intoPackage, source, choice),

    pos = textMorph.indexToPosition(from);

    if (generated) ranges.push(textMorph.insertText(generated, pos));
    if (importedVarName) importedVarNames.push(importedVarName);
    if (standaloneImport) {
      try { await jsPlugin.runEval(standaloneImport); }
      catch (e) { console.error(`Error when trying to import ${standaloneImport}: ${e.stack}`); }
    }
  }

  // 4. insert imported var names at cursor
  if (insertImportAtCursor) {
    let source = importedVarNames.join("\n"),
        pos = textMorph.cursorPosition,
        before = textMorph.getLine(pos.row).slice(0, pos.col);
    if (before.trim()) source = "\n" + source;
    textMorph.selection.text = source;
    if (!gotoImport) textMorph.scrollCursorIntoView();
  }

  textMorph.undoManager.group();

  // 5. select changes in import statements
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

    return {label}
  }

}
