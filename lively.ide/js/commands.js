/* global System */
import { arr, promise } from 'lively.lang';
import { show } from 'lively.halos';
import { Range } from 'lively.morphic/text/range.js';
import { query } from 'lively.ast';

function setEvalEnv (morph, newEnv) {
  const plugin = morph.pluginFind(p => p.isJSEditorPlugin);
  if (plugin) Object.assign(plugin.evalEnvironment, newEnv);
  return plugin.evalEnvironment;
}

export const jsEditorCommands = [

  {
    name: 'undefine variable',
    doc: 'Finds the variable at cursor position (or position passed) and undefines it in the module toplevel scope.',
    exec: async function (ed, env = { varName: null, position: null }) {
      let { varName, position } = env;

      if (!varName) {
        if (!position) position = ed.cursorPosition;
        const nav = ed.pluginInvokeFirst('getNavigator');
        const parsed = nav.ensureAST(ed);
        const node = query.nodesAt(ed.positionToIndex(position), parsed)
          .reverse().find(ea => ea.type === 'Identifier');
        if (!node) { ed.showError(new Error('no identifier found!')); return true; }
        varName = node.name;
      }

      // this.pluginFind(p => p.isJSEditorPlugin).sanatizedJsEnv()
      env = ed.pluginFind(p => p.isJSEditorPlugin).sanatizedJsEnv();
      const source = `lively.modules.module("${env.targetModule}").undefine("${varName}")`;
      let result; let err;

      try {
        result = await ed.doEval(null, env, source);
        err = result.error ? result.error : result.isError ? result.value : null;
      } catch (e) { err = e; }

      err
        ? ed.showError(err)
        : ed.setStatusMessage(`${varName} undefined`);

      return true;
    }
  },

  {
    name: 'change doitContext',
    exec: async text => {
      const [selected] = await text.world().execCommand('select morph', {
        prompt: 'select morph for doitContext',
        justReturn: true,
        prependItems: ['reset'],
        filterFn: m => !m.isUsedAsEpiMorph()
      });
      if (selected) {
        const reset = selected === 'reset';
        text.doitContext = reset ? null : selected;
        text.setStatusMessage(reset ? 'doitContext is now\n' + selected : 'doitContext reset');
      }
      return true;
    }
  },

  {
    name: 'change eval backend',
    exec: async (text, opts = { backend: undefined }) => {
      let { backend } = opts;
      if (backend === undefined) {
        backend = await text.world().prompt(
          'choose eval backend', { historyId: 'js-eval-backend-history' });
        if (!backend) {
          text.setStatusMessage('Canceled');
          return true;
        }
      }
      if (backend === 'local') backend = null;
      text.setStatusMessage(`Eval backend is now ${backend || 'local'}`);
      return setEvalEnv(text, { remote: backend });
    }
  },

  {
    name: 'copy current module name to clipboard',
    exec: text => {
      const modName = text.evalEnvironment.targetModule;
      text.setStatusMessage(modName || 'Cannot find module name');
      text.env.eventDispatcher.killRing.add(text);
      text.env.eventDispatcher.doCopy(modName);
      return true;
    }
  }

];

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

export const jsIdeCommands = [

  {
    name: '[javascript] list errors and warnings',
    exec: async text => {
      const markers = (text.markers || [])
        .filter(({ type }) => type === 'js-undeclared-var' || type === 'js-syntax-error');
      if (!markers.length) {
        show('no warnings or errors');
        return true;
      }

      const items = markers.map(({ range, type }) => {
        const string = `[${type.split('-').slice(1).join(' ')}] ${text.textInRange(range)}`;
        return { isListItem: true, string, value: range };
      });
      const { selected: [sel] } = await text
        .world()
        .filterableListPrompt('jump to warning or error', items);
      // var {selected: [sel]} = await text
      //   .world()
      //   .filterableListPrompt("jump to warning or error", items);
      if (sel) {
        text.saveMark();
        text.selection = sel;
        text.centerRow(sel.start.row);
      }
      return true;
    }
  },

  {
    name: '[javascript] inject import',
    exec: async (text, opts = { gotoImport: false, insertImportAtCursor: true }) => {
      await promise.delay(0);
      const { interactivelyInjectImportIntoText } =
        await System.import('lively.ide/js/import-helper.js');
      const result = await interactivelyInjectImportIntoText(text, opts);
      if (!result) text.setStatusMessage('canceled');
      return result;
    }
  },

  {
    name: '[javascript] fix undeclared variables',
    exec: async (text, opts = { ignore: [], autoApplyIfSingleChoice: false, requester: text }) => {
      const { interactivlyFixUndeclaredVariables } =
        await System.import('lively.ide/js/import-helper.js');
      const result = await interactivlyFixUndeclaredVariables(text, opts);
      text.focus();
      return result;
    }
  },

  {
    name: '[javascript] remove unused imports',
    exec: async (text, opts = { query: true }) => {
      const { cleanupUnusedImports } =
        await System.import('lively.ide/js/import-helper.js');
      const status = await cleanupUnusedImports(text, opts);
      text.setStatusMessage(status);
      return true;
    }
  }

];

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// ast commands

// note: additional generic ast commands are in text/code-navigation-commands.js

// helper
function iToP (ed, pos) { return ed.indexToPosition(pos); }

export const astEditorCommands = [

  {
    name: 'selectDefinition',
    readOnly: true,
    bindKey: 'Alt-.',
    exec: function (ed, args) {
      const nav = ed.pluginInvokeFirst('getNavigator');
      if (!nav) return true;

      const found = nav.resolveIdentifierAt(ed, ed.cursorPosition);
      if (!found || !found.id) { show('No symbol identifier selected'); return true; }
      if (!found.decl) { show('Cannot find declaration of ' + found.name); return true; }

      ed.saveMark();

      ed.selection = {
        start: ed.indexToPosition(found.decl.start),
        end: ed.indexToPosition(found.decl.end)
      };
      ed.scrollCursorIntoView();
      return true;
    }
  },

  {
    name: 'selectSymbolReferenceOrDeclarationNext',
    readOnly: true,
    multiSelectAction: 'single',
    exec: function (ed) { ed.execCommand('selectSymbolReferenceOrDeclaration', { direction: 'next' }); }
  },

  {
    name: 'selectSymbolReferenceOrDeclarationPrev',
    readOnly: true,
    multiSelectAction: 'single',
    exec: function (ed) { ed.execCommand('selectSymbolReferenceOrDeclaration', { direction: 'prev' }); }
  },

  {
    name: 'selectSymbolReferenceOrDeclaration',
    doc: 'Finds the name of the currently selected symbol and will use the JS ast to select references and declarations whose name matches the symbol in the current scope.',
    readOnly: true,
    multiSelectAction: 'single',
    exec: function (ed, args = { direction: null/* next,prev */ }) {
      // 1. get the token / identifier info of what is currently selected

      const nav = ed.pluginInvokeFirst('getNavigator');
      if (!nav) return true;

      const found = nav.resolveIdentifierAt(ed, ed.cursorPosition);
      if (!found || !found.refs) { show('No symbol identifier selected'); return true; }

      // 3. map the AST ref / decl nodes to actual text ranges
      const sel = ed.selection;
      let ranges = found.refs.map(({ start, end }) => Range.fromPositions(iToP(ed, start), iToP(ed, end)))
        .concat(found.decl
          ? Range.fromPositions(iToP(ed, found.decl.start), iToP(ed, found.decl.end))
          : [])
        // .filter(range => !sel.ranges.some(otherRange => range.equals(otherRange)))
        .sort(Range.compare);

      if (!ranges.length) return true;

      // do we want to select all ranges or jsut the next/prev one?
      const currentRangeIdx = ranges.map(String).indexOf(String(sel.range));
      if (args.direction === 'next' || args.direction === 'prev') {
        if (currentRangeIdx === -1 && ranges.length) ranges = [ranges[0]];
        else {
          let nextIdx = currentRangeIdx + (args.direction === 'next' ? 1 : -1);
          if (nextIdx < 0) nextIdx = ranges.length - 1;
          else if (nextIdx >= ranges.length) nextIdx = 0;
          ranges = [ranges[nextIdx]];
        }
      } else { /* select all ranges */ }

      // do the actual selection
      ranges.forEach(range => {
        const existing = sel.selections.findIndex(ea => ea.range.equals(range));
        const idx = sel.selections.length - 1;
        existing > -1
          ? arr.swap(sel.selections, existing, idx)
          : sel.addRange(range, false);
      });

      sel.mergeSelections();

      return true;
    }
  }

];

if (lively.modules && !lively.FreezerRuntime) {
  const mod = lively.modules.module('lively.ide/js/editor-plugin.js');
  if (!mod._frozenModule) mod.reload({ reloadDeps: false, resetEnv: false });
}
