/* global System */
import { arr, string } from 'lively.lang';
import { pt } from 'lively.graphics';
import { LoadingIndicator } from 'lively.components';
import { config } from 'lively.morphic';
import { fuzzyParse, query } from 'lively.ast';
import { ImportInjector, GlobalInjector, ImportRemover } from 'lively.modules/src/import-modification.js';
import { callService, ProgressMonitor } from '../service-worker.js';

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// inject import or global decls into code
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

export function declareVarNamesAsGlobals (textMorph, varNames, opts) {
  const { recordUndo = true } = opts || {};
  const src = textMorph.textString;
  const parsed = textMorph.editorPlugin.parse();
  const { status, generated, from, to } = GlobalInjector.run(src, varNames, parsed);
  const pos = textMorph.indexToPosition(from); let range;
  if (status === 'not modified') return null;
  if (recordUndo) textMorph.undoManager.group();
  range = textMorph.insertText(generated, pos);
  if (recordUndo) textMorph.undoManager.group();
  return range;
}

export async function injectImportsIntoText (textMorph, imports, opts) {
  const { gotoImport, insertImportAtCursor, recordUndo, System: S } = {
    gotoImport: true,
    insertImportAtCursor: false,
    recordUndo: true,
    System,
    ...opts
  };
  const jsPlugin = textMorph.pluginFind(p => p.isJSEditorPlugin);

  if (!jsPlugin) { throw new Error(`cannot find js plugin of ${textMorph}`); }

  const moduleId = jsPlugin.evalEnvironment.targetModule;
  const intoPackage = await jsPlugin.systemInterface().getPackageForModule(moduleId);
  var from; var to; var pos; const importedVarNames = []; const ranges = [];

  if (gotoImport) { textMorph.saveMark(); } // so we can easily jump to where we were after insertion

  if (recordUndo) textMorph.undoManager.group();

  // 3. Insert new import statements or extend existing
  imports = imports.slice();
  while (imports.length) {
    const choice = imports.shift();
    const source = textMorph.textString;

    var { generated, from, to, standaloneImport, importedVarName } =
          ImportInjector.run(S, moduleId, intoPackage, source, choice);
    var pos = textMorph.indexToPosition(from);

    if (generated) ranges.push(textMorph.insertText(generated, pos));
    if (importedVarName) importedVarNames.push(importedVarName);
    if (standaloneImport) {
      try { await jsPlugin.runEval(standaloneImport); } catch (e) { console.error(`Error when trying to import ${standaloneImport}: ${e.stack}`); }
    }
  }

  // 4. insert imported var names at cursor
  if (insertImportAtCursor) {
    const source = importedVarNames.join('\n');
    const pos = textMorph.cursorPosition;
    const before = textMorph.getLine(pos.row).slice(0, pos.col);
    textMorph.selection.text = source;
    if (!gotoImport) {
      textMorph.scrollCursorIntoView();
      textMorph.focus();
    }
  }

  if (recordUndo) textMorph.undoManager.group();

  // 5. select changes in import statements
  if (gotoImport) {
    textMorph.selection = ranges.length
      ? arr.last(ranges)
      : { start: pos, end: textMorph.indexToPosition(to) };
    textMorph.scrollCursorIntoView();
    textMorph.focus();
  }

  return { ranges };
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// choosing an export to import
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

export async function interactivelyInjectImportIntoText (textMorph, opts) {
  const jsPlugin = textMorph.pluginFind(p => p.isJSEditorPlugin);
  if (!jsPlugin) { throw new Error(`cannot find js plugin of ${textMorph}`); }
  const choices = await interactivelyChooseImports(
    await jsPlugin.systemInterface(), {
      world: textMorph.world(), progress: opts.progress, requester: opts.requester
    });
  return choices ? injectImportsIntoText(textMorph, choices, opts) : null;
}

export async function interactivelyChooseImports (livelySystem, opts) {
  opts = { System: System, world: $world, ...opts };
  // 1. gather all exports
  const exports = await LoadingIndicator.runFn(
    (li) => {
      const progress = new ProgressMonitor({
        handlers: {
          searchProgress: (stepName, progress) => {
            li.progress = progress;
            li.label = stepName;
          }
        }
      });
      return config.ide.workerEnabled
        ? callService('exportsOfModules', {
          excludedPackages: config.ide.js.ignoredPackages,
          livelySystem,
          progress: new ProgressMonitor({
            handlers: {
              workerProgress: (stepName, progress) => {
                li.progress = progress;
                li.label = stepName;
              }
            }
          })
        })
        : livelySystem.exportsOfModules({
          excludedPackages: config.ide.js.ignoredPackages,
          progress
        });
    }, 'computing imports...');

  // 2. Ask what to import + generate insertions
  const choices = await ExportPrompt.run(opts.world, exports, opts.requester);
  return !choices.length ? null : choices;
}

function labelForExport (exportSpec) {
  const { type, exported, local, fromModule, pathInPackage, packageName, packageVersion } = exportSpec;
  const exportName = exported === 'default' ? `${local} (default)` : exported;

  if (fromModule) var reexportString = ` rexported from ${fromModule}`;

  let annotationString = ` [${packageName}/${pathInPackage}`;
  if (packageVersion) annotationString += ` ${packageVersion}`;
  annotationString += ']';

  return [
    exportName, {},
    `${type} ${reexportString || ''} ${annotationString}`, {
      fontSize: '70%',
      textStyleClasses: ['truncated-text', 'annotation']
    }
  ];
}

class ExportPrompt {
  static run (world, exportData, requester = world) {
    return new this().run(world, exportData, requester);
  }

  async run (world, exportData, requester = world) {
    const { selected: choices } = await world.filterableListPrompt(
      'Select import',
      exportData.map(ea => {
        return {
          isListItem: true,
          value: ea,
          label: labelForExport(ea)
        };
      }),
      {
        multiSelect: true,
        historyId: 'lively.ide/js-interactively-import',
        extent: pt(800, 500),
        fuzzy: 'value.exported',
        requester,
        sortFunction: (parsedInput, item) => {
          // preioritize those completions that are close to the input
          var { exported, isMain } = item.value;
          var exported = (exported || '').toLowerCase();
          let base = isMain ? -1 : 0;
          parsedInput.lowercasedTokens.forEach(t =>
            base -= exported.startsWith(t) ? 10 : exported.includes(t) ? 5 : 0);
          return arr.sum(parsedInput.lowercasedTokens.map(token =>
            string.levenshtein(exported.toLowerCase(), token))) + base;
        }
      });
    return choices;
  }
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// guide user through possible import declaration choices
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function ensureFullModuleIdOfFromModule (exported) {
  const { fromModule, packageURL } = exported;
  if (!fromModule) return null;
  if (!fromModule.startsWith('.')) return fromModule;
  const baseURL = packageURL || System.baseURL;
  return string.joinPath(baseURL, fromModule);
}

function matchingExportsForUndeclared (undeclaredVar, allExports, preferReExported = true) {
  // given an undeclared var ({name, start,end}), filters the list of
  // allExports to those exports that match the undeclared var.  Since re-exports
  // of the same object are possible, allows to suppress re-exports or original
  // exports to filter the list of choices further
  const matching = allExports.filter(ea => {
    const isDefault = ea.exported === 'default';
    const name = isDefault ? ea.local : ea.exported;
    return name === undeclaredVar.name;
  });
  const reExported = matching.filter(export1 => {
    if (export1.fromModule) return true;
    return !matching.some(export2 => {
      if (export1 === export2 || !export2.fromModule) return false;
      const fullFrom = ensureFullModuleIdOfFromModule(export2);
      return fullFrom === export1.moduleId;
    });
  });
  return preferReExported ? reExported : arr.withoutAll(matching, reExported);
}

export function undeclaredVariables (source, knownGlobals) {
  knownGlobals = knownGlobals || [];
  const parsed = fuzzyParse(source, { withComments: true });
  return query.findGlobalVarRefs(parsed, { jslintGlobalComment: true })
    .filter(ea => !knownGlobals.includes(ea.name));
}

export async function interactivlyFixUndeclaredVariables (textMorph, opts) {
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

  if (typeof sourceRetriever !== 'function') { sourceRetriever = () => textMorph.textString; }

  if (typeof highlightUndeclared !== 'function') {
    highlightUndeclared = undeclared => {
      const { start, end } = undeclared;
      const range = {
        start: textMorph.indexToPosition(start),
        end: textMorph.indexToPosition(end)
      };
      textMorph.selection = range;
      textMorph.centerRange(range);
    };
  }

  let allUndeclared;
  const changes = [];

  await updateUndeclared();
  if (!allUndeclared.length) return changes;
  ignore = ignore.slice();

  const jsPlugin = textMorph.pluginFind(p => p.isJSEditorPlugin);
  if (!jsPlugin) { throw new Error(`cannot find js plugin of ${textMorph}`); }

  const livelySystem = await jsPlugin.systemInterface();
  const exports = await livelySystem.exportsOfModules({ excludedPackages: config.ide.js.ignoredPackages });

  textMorph.collapseSelection();

  if (keepTextPosition) {
    var { scroll, cursorPosition } = textMorph;
    var anchor = textMorph.addAnchor({ ...cursorPosition, id: 'fix-undeclared-vars' });
  }

  let canceled = false;

  while (true) {
    await updateUndeclared(); if (!allUndeclared.length) break;

    const undeclared = allUndeclared[0];
    const { name } = undeclared;
    const imports = matchingExportsForUndeclared(undeclared, exports);
    const choices = ['ignore for now', 'declare as global'].concat(
      imports.map(ea => ({ isListItem: true, value: ea, label: labelForExport(ea) })));
    let choice;

    await highlightUndeclared(undeclared);
    if (autoApplyIfSingleChoice && imports.length === 1) {
      choice = imports[0];
    } else {
      // ask user
      ({ selected: [choice] } = await $world.filterableListPrompt(
        `Found undeclared variable ${name}.  How should it be handled?`,
        choices, { requester, theme: 'dark', preselect: choices.length > 2 ? 2 : 0 }));
      if (!choice) { canceled = true; break; }
    }

    if (choice === choices[0]) { ignore.push(name); continue; }

    // make global
    if (choice === choices[1]) {
      changes.push({ type: 'global', name });
      if (typeof sourceUpdater === 'function') {
        await sourceUpdater('global', [name]);
      } else {
        await declareVarNamesAsGlobals(textMorph, [name], { recordUndo: true, sourceUpdater });
      }
      continue;
    }

    // add import
    changes.push({ type: 'import', imported: choice });
    if (typeof sourceUpdater === 'function') {
      await sourceUpdater('import', [choice]);
    } else {
      await injectImportsIntoText(textMorph, [choice],
        { gotoImport: false, insertImportAtCursor: false, recordUndo: true });
    }
  }

  if (keepTextPosition) {
    textMorph.scroll = scroll;
    textMorph.cursorPosition = anchor.position;
    textMorph.removeAnchor(anchor);
  }

  return canceled ? null : changes;

  async function updateUndeclared () {
    return allUndeclared = undeclaredVariables(await sourceRetriever(), knownGlobals)
      .filter(ea => !ignore.includes(ea.name));
  }
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// import cleanup
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

export async function cleanupUnusedImports (textMorph, opts) {
  opts = { world: textMorph.world(), ...opts };

  const source = textMorph.textString;
  const toRemove = await chooseUnusedImports(source, opts);

  if (!toRemove) return 'canceled';
  if (!toRemove.changes || !toRemove.changes.length) return 'nothing to remove';

  textMorph.undoManager.group();
  for (const { replacement, start, end } of toRemove.changes) {
    const range = {
      start: textMorph.indexToPosition(start),
      end: textMorph.indexToPosition(end)
    };
    textMorph.replace(range, replacement);
  }
  textMorph.undoManager.group();

  return 'imports removed';
}

export async function chooseUnusedImports (source, opts) {
  opts = { world: $world, ...opts };

  const unused = ImportRemover.findUnusedImports(source);
  if (!unused || !unused.length) return null;

  const items = unused.map(ea => {
    const { local, from } = ea;
    const label = [
          `${local}`, { fontWeight: 'bold' },
          ' from ', {},
          `${from}\n`, { fontStyle: 'italic' }];
    return { isListItem: true, label, value: ea };
  });

  const { list: importsToRemove } = await opts.world.editListPrompt(
    'Which imports should be removed?', items, { multiSelect: true, requester: opts.requester });

  if (!importsToRemove || !importsToRemove.length) return [];

  return ImportRemover.removeImports(source, importsToRemove);
}
