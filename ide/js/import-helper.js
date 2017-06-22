/*global System*/
import { arr, string } from 'lively.lang';
import { pt } from 'lively.graphics';
import LoadingIndicator from "../../components/loading-indicator.js";
import { config } from "lively.morphic";
import { ImportInjector, GlobalInjector, ImportRemover } from "lively.modules/src/import-modification.js";
import module from "lively.modules/src/module.js";


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// inject import or global decls into code
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

export function declareVarNamesAsGlobals(textMorph, varNames, opts) {
  let {recordUndo = true} = opts || {},
      src = textMorph.textString,
      parsed = textMorph.editorPlugin.parse(),
      {status, generated, from, to} = GlobalInjector.run(src, varNames, parsed),
      pos = textMorph.indexToPosition(from), range;
  if (status === "not modified") return null;
  if (recordUndo) textMorph.undoManager.group();
  range = textMorph.insertText(generated, pos);
  if (recordUndo) textMorph.undoManager.group();
  return range;
}

export async function injectImportsIntoText(textMorph, imports, opts) {
  let {gotoImport, insertImportAtCursor, recordUndo, System: S} = {
        gotoImport: true,
        insertImportAtCursor: false,
        recordUndo: true,
        System,
        ...opts
      },
      jsPlugin = textMorph.pluginFind(p => p.isJSEditorPlugin);

  if (!jsPlugin)
     throw new Error(`cannot find js plugin of ${textMorph}`)

  var moduleId = jsPlugin.evalEnvironment.targetModule,
      intoPackage = await jsPlugin.systemInterface().getPackageForModule(moduleId),
      from, to, pos, importedVarNames = [], ranges = [];

  if (gotoImport)
    textMorph.saveMark(); // so we can easily jump to where we were after insertion

  if (recordUndo) textMorph.undoManager.group();

  // 3. Insert new import statements or extend existing
  imports = imports.slice();
  while (imports.length) {
    let choice = imports.shift(),
        source = textMorph.textString;

    var {generated, from, to, standaloneImport, importedVarName} =
          ImportInjector.run(S, moduleId, intoPackage, source, choice),
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

  if (recordUndo) textMorph.undoManager.group();

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

export async function interactivelyInjectImportIntoText(textMorph, opts) {
  var jsPlugin = textMorph.pluginFind(p => p.isJSEditorPlugin);
  if (!jsPlugin)
     throw new Error(`cannot find js plugin of ${textMorph}`)
  var choices = await interactivelyChooseImports(
    await jsPlugin.systemInterface(), {world: textMorph.world()});
  return choices ? injectImportsIntoText(textMorph, choices, opts) : null;
}


export async function interactivelyChooseImports(livelySystem, opts) {
  opts = {System: System, world: $world, ...opts}

  // 1. gather all exorts
  var exports = await LoadingIndicator.runFn(
    () => livelySystem.exportsOfModules(
      {excludedPackages: config.ide.js.ignoredPackages}), "computing imports...");

  // 2. Ask what to import + generate insertions
  var choices = await ExportPrompt.run(opts.world, exports);
  return !choices.length ? null : choices;
}

function labelForExport(exportSpec) {
  let {type, exported, local, fromModule, pathInPackage, packageName, packageVersion} = exportSpec,
      exportName = exported === "default" ? `${local} (default)` : exported;

  if (fromModule) var reexportString = ` rexported from ${fromModule}`

  var annotationString = ` [${packageName}/${pathInPackage}`;
  if (packageVersion) annotationString += ` ${packageVersion}`;
  annotationString += "]";

  return [
    exportName, {},
    `${type} ${reexportString || ""} ${annotationString}`, {
      fontSize: "70%",
      textStyleClasses: ["truncated-text", "annotation"],
      // maxWidth: 300
    }
  ];
}


class ExportPrompt {

  static run(world, exportData) { return new this().run(world, exportData); }

  async run(world, exportData) {

    var {selected: choices}  = await world.filterableListPrompt(
      "Select import",
      exportData.map(ea => {
        return {
          isListItem: true,
          value: ea,
          label: labelForExport(ea)
        }
      }),
      {
        multiSelect: true,
        historyId: "lively.morphic/ide/js-interactively-import",
        extent: pt(800, 500),
        fuzzy: "value.exported",

        sortFunction: (parsedInput, item) => {
          // preioritize those completions that are close to the input
          var {exported, isMain} = item.value,
              exported = (exported || "").toLowerCase(),
              base = isMain ? -1 : 0;
          parsedInput.lowercasedTokens.forEach(t =>
            base -= exported.startsWith(t) ? 10 : exported.includes(t) ? 5 : 0);
          return arr.sum(parsedInput.lowercasedTokens.map(token =>
            string.levenshtein(exported.toLowerCase(), token))) + base
        }
      });
    return choices;
  }

}


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// guide user through possible import declaration choices
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function ensureFullModuleIdOfFromModule(exported) {
  let {fromModule, packageURL} = exported;
  if (!fromModule) return null;
  if (!fromModule.startsWith(".")) return fromModule;
  let baseURL = packageURL || System.baseURL;
  return string.joinPath(baseURL, fromModule)
}

function matchingExportsForUndeclared(undeclaredVar, allExports, preferReExported = true) {
  // given an undeclared var ({name, start,end}), filters the list of
  // allExports to those exports that match the undeclared var.  Since re-exports
  // of the same object are possible, allows to suppress re-exports or original
  // exports to filter the lost of choices further
  let matching = allExports.filter(ea => {
    let isDefault = ea.exported === "default",
        name = isDefault ? ea.local : ea.exported;
    return name === undeclaredVar.name;
  });
  let reExported = matching.filter(export1 => {
    if (export1.fromModule) return true;
    return !matching.some(export2 => {
      if (export1 === export2 || !export2.fromModule) return false;
      let fullFrom = ensureFullModuleIdOfFromModule(export2);
      return fullFrom === export1.moduleId;
    });
  });
  return preferReExported ? reExported : arr.withoutAll(matching, reExported);
}

function undeclaredVariables(source, knownGlobals) {
  knownGlobals = knownGlobals || [];
  let parsed = lively.ast.fuzzyParse(source, {withComments: true});
  return lively.ast.query.findGlobalVarRefs(parsed, {jslintGlobalComment: true})
    .filter(ea => !knownGlobals.includes(ea.name));
}

export async function interactivlyFixUndeclaredVariables(textMorph, opts) {
  // step-by-step selects an undeclared var and asks the user what to do with it.
  // choices are ignore, declare as global (via /*global*/ comment) or add an import.
  //
  // opts = {
  //   ignore: ARRAY?,
  //   requester: MORPH?,
  //   sourceUpdater: FUNCTION?,
  //   autoApplyIfSingleChoice: BOOLEAN  default: false
  // }
  // `ignore` is a list of var names not to ask for.
  // if `autoApplyIfSingleChoice` is true will insert import without asking if
  // there is only one choice
  // if `sourceUpdater` is specified, it can be an async function that is called
  // with either "global", [varNameToMakeGlobal] or "import", [importSpec]
  // This is useful when simply modifying the textString of a morph is not the
  // action to take for declaring the import (e.g. when only showing a method and
  // the modification should be applied to the conataining module)

  let {
    sourceUpdater,
    sourceRetriever,
    highlightUndeclared,
    requester,
    keepTextPosition = true,
    ignore = [],
    autoApplyIfSingleChoice = false,
    knownGlobals = textMorph.evalEnvironment.knownGlobals || []
  } = opts || {};

  if (typeof sourceRetriever !== "function")
    sourceRetriever = () => textMorph.textString;

  if (typeof highlightUndeclared !== "function")
    highlightUndeclared = undeclared => {
      let {start, end} = undeclared,
          range = {
            start: textMorph.indexToPosition(start),
            end: textMorph.indexToPosition(end)};      
      textMorph.selection = range;
      textMorph.centerRange(range);
    };

  var allUndeclared = updateUndeclared(), changes = [];
  if (!allUndeclared.length) return changes;
  ignore = ignore.slice();

  var jsPlugin = textMorph.pluginFind(p => p.isJSEditorPlugin);
  if (!jsPlugin)
     throw new Error(`cannot find js plugin of ${textMorph}`)

  let livelySystem = await jsPlugin.systemInterface(),
      exports = await livelySystem.exportsOfModules({
        excludedPackages: config.ide.js.ignoredPackages});

  textMorph.collapseSelection()

  if (keepTextPosition) {
    var {scroll, cursorPosition} = textMorph,
        anchor = textMorph.addAnchor({...cursorPosition, id: "fix-undeclared-vars"});
  }

  while (true) {
    updateUndeclared(); if (!allUndeclared.length) break;

    let undeclared = allUndeclared[0],
        {name} = undeclared,
        imports = matchingExportsForUndeclared(undeclared, exports),
        choices = ["ignore for now", "declare as global"].concat(
          imports.map(ea => ({isListItem: true, value: ea, label: labelForExport(ea)}))),
        choice;

    highlightUndeclared(undeclared);
    if (autoApplyIfSingleChoice && imports.length === 1) {
      choice = imports[0];

    } else {
      // ask user
      ({selected: [choice]} = await $world.filterableListPrompt(
        `Found undeclared variable ${name}.  How should it be handled?`,
        choices, {requester, theme: "dark", preselect: choices.length > 2 ? 2 : 0}));
      if (!choice) break;
    }

    if (choice === choices[0]) { ignore.push(name); continue; }

    // make global
    if (choice === choices[1]) {
      changes.push({type: "global", name});
      if (typeof sourceUpdater === "function") {
        await sourceUpdater("global", [name]);
      } else {
        await declareVarNamesAsGlobals(textMorph, [name], {
          recordUndo: true, sourceUpdater});
      }
      continue;
    }

    // add import
    changes.push({type: "import", imported: choice});
    if (typeof sourceUpdater === "function") {
      await sourceUpdater("import", [choice]);
    } else {
      await injectImportsIntoText(textMorph, [choice],
        {gotoImport: false, insertImportAtCursor: false, recordUndo: true});
    }
  }

  if (keepTextPosition) {
    textMorph.scroll = scroll;
    textMorph.cursorPosition = anchor.position;
    textMorph.removeAnchor(anchor);
  }

  return changes;

  function updateUndeclared() {
    return allUndeclared = undeclaredVariables(sourceRetriever(), knownGlobals)
      .filter(ea => !ignore.includes(ea.name));
  }
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// import cleanup
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

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
    let {local, from} = ea,
        label = [
       `${local}`, {fontWeight: "bold"},
       " from ", {},
       `${from}\n`, {fontStyle: "italic"}]
     return {isListItem: true, label, value: ea};
  });

  var {list: importsToRemove} = await opts.world.editListPrompt(
    'Which imports should be removed?', items, {multiSelect: true});

  if (!importsToRemove || !importsToRemove.length) return [];

  return ImportRemover.removeImports(source, importsToRemove);
}
