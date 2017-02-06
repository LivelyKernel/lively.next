import { arr, string } from 'lively.lang';
import { pt } from 'lively.graphics';
import LoadingIndicator from "../../components/loading-indicator.js";
import { config } from "lively.morphic";
import { ImportInjector, ImportRemover } from "lively.modules/src/import-modification.js";
import module from "lively.modules/src/module.js";



export async function cleanupUnusedImports(textMorph, opts) {
  opts = {world: textMorph.world(), ...opts}

  var source = textMorph.textString,
      toRemove = await chooseUnusedImports(source, opts)

  if (!toRemove) return "canceled";
  if (!toRemove.changes || !toRemove.changes.length) return "nothing to remove"

  textMorph.undoManager.group();
  for (let {replacement, start, end} of toRemove.changes) {
    var range = {
      start: textMorph.indexToPosition(start),
      end: textMorph.indexToPosition(end)
    };
    textMorph.replace(range, replacement);
  }
  textMorph.undoManager.group();

  return "imports removed";
}


export async function chooseUnusedImports(source, opts) {
  opts = {world: $world, ...opts}

  var unused = ImportRemover.findUnusedImports(source);
  if (!unused || !unused.length) return null;

  var items = unused.map(ea => {
    var {local, from} = ea;
    var label = [
       [`${local}`, {fontWeight: "bold"}], [" from ", {}],
       [`${from}\n`, {fontStyle: "italic"}]]
     return {isListItem: true, label, value: ea};
  });

  var {list: importsToRemove} = await opts.world.editListPrompt(
    'Which imports should be removed?', items, {multiSelect: true});

  if (!importsToRemove || !importsToRemove.length) return [];

  return ImportRemover.removeImports(source, importsToRemove);
}


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-


export async function interactivelyChooseImports(livelySystem, opts) {
  opts = { System: System, world: $world, ...opts }

  // 1. gather all exorts
  var exports = await LoadingIndicator.runFn(
    () => livelySystem.exportsOfModules(
      {excludedPackages: config.ide.js.ignoredPackages}), "computing imports...");

  // 2. Ask what to import + generate insertions
  var choices = await ExportPrompt.run(opts.world, exports);
  return !choices.length ? null : choices;
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

  var choices = await interactivelyChooseImports(
    await jsPlugin.systemInterface(), {world: textMorph.world()});
  if (!choices) return null;

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
        extent: pt(800, 500),
        fuzzy: "value.exported",

        sortFunction: (parsedInput, item) => {
          // preioritize those completions that are close to the input
          var {exported, isMain} = item.value;
          var exported = (exported || "").toLowerCase();
          var base = isMain ? -1 : 0;
          parsedInput.lowercasedTokens.forEach(t => {
            if (exported.startsWith(t)) base -= 10;
            else if (exported.includes(t)) base -= 5;
          });
          return arr.sum(parsedInput.lowercasedTokens.map(token =>
            string.levenshtein(exported.toLowerCase(), token))) + base
        }

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
