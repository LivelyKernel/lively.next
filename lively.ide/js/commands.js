/* global System */
import { arr, promise, string } from 'lively.lang';
import { show } from 'lively.halos';
import { Range } from 'lively.morphic/text/range.js';
import { query, BaseVisitor } from 'lively.ast';

function getEvalEnv (morph) {
  const plugin = morph.pluginFind(p => p.isJSEditorPlugin);
  return plugin ? plugin.evalEnvironment : null;
}

function setEvalEnv (morph, newEnv) {
  const plugin = morph.pluginFind(p => p.isJSEditorPlugin);
  if (plugin) Object.assign(plugin.evalEnvironment, newEnv);
  return plugin.evalEnvironment;
}

export var jsEditorCommands = [

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
      var env = ed.pluginFind(p => p.isJSEditorPlugin).sanatizedJsEnv();
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

export var jsIdeCommands = [

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
  },

  {
    name: '[javascript] eslint report',
    exec: async text => {
      const { default: ESLinter } = await System.import('lively.ide/js/eslint/lively-interface.js');
      try { return ESLinter.reportOnMorph(text); } catch (e) { text.showError(e); }
    }
  },

  {
    name: '[javascript] eslint preview fixes',
    exec: async text => {
      const { default: ESLinter } = await System.import('lively.ide/js/eslint/lively-interface.js');
      try { return ESLinter.previewFixesOnMorph(text); } catch (e) { text.showError(e); }
    }
  },

  {
    name: '[javascript] auto format code',
    handlesCount: true,
    exec: async (text, opts, count) => {
      const margin = 7 * (text.width / 100);
      const printWidth = count || Math.floor(text.width / text.defaultCharExtent().width);

      opts = {
        printWidth,
        tabWidth: 2,
        useTabs: false,
        bracketSpacing: false,
        ...opts
      };

      const module = lively.modules.module;
      const prettierURL = System.normalizeSync('prettier/standalone.js');
      const prettier = await module(prettierURL).load({ format: 'global', instrument: false });
      const { findNodeByAstIndex } = await module('lively.ast/lib/acorn-extension.js').load();
      const { parse, printAst, withMozillaAstDo } = await module('lively.ast').load();
      const { nodesAt } = await module('lively.ast/lib/query.js').load();
      const jsdiff = await System.import('jsdiff', System.decanonicalize('lively.morphic'));

      const range = text.selection.isEmpty() ? text.documentRange : text.selection.range;
      const rangeStart = text.positionToIndex(range.start);
      const rangeEnd = text.positionToIndex(range.end);
      const formatted = prettier.format(text.textString, {
        ...opts,
        rangeStart,
        rangeEnd,
        parser: (text, parsers, options) =>
          parse(text, { allowReturnOutsideFunction: true })
      });

      text.undoManager.group();
      const diff = jsdiff.diffChars(text.textString, formatted);
      text.applyJsDiffPatch(diff);
      text.selection.text = fixPrettified(text.selection.text);
      text.undoManager.group();
      return true;

      function fixPrettified (source) {
        return fixVarDeclIndentation(source);
      }

      function fixVarDeclIndentation (src, parsed) {
        // Example:
        // fixVarDeclIndentation("var foo = 23,\nbar;")
        //   => "var foo = 23,\n    bar;"

        if (!parsed) parsed = parse(src, { allowReturnOutsideFunction: true });

        // visitor to find variable declarations
        const ranges = string.lineRanges(src);
        const lines = src.split('\n');
        const actions = [];
        const v = new BaseVisitor();
        const superVisitVariableDeclaration = v.visitVariableDeclaration;

        v.visitVariableDeclaration = (node, state, path) => {
          if (node.declarations.length > 1) {
            // whats the "indent" of the first var decl? offset from start of its line
            // to ident

            const firstRow = string.findLineWithIndexInLineRanges(ranges, node.start);
            const firstIndent = node.declarations[0].start - ranges[firstRow][0];

            // for the following decls, compare their indent and emit delete or insert
            // action
            for (let i = 1; i < node.declarations.length; i++) {
              const decl = node.declarations[i];
              const row = string.findLineWithIndexInLineRanges(ranges, decl.start);
              if (firstRow === row) continue;
              const declIndent = lines[row].match(/\s*/)[0].length;
              const offset = firstIndent - declIndent;
              if (offset === 0) continue;
              // var decl bodies can be multi line, fix all of them
              const endRowOfDecl = string.findLineWithIndexInLineRanges(ranges, decl.end);
              const actionType = offset > 0 ? 'insert' : 'delete';
              const arg = offset > 0 ? ' '.repeat(offset) : -offset;
              actions.push(
                ...arr.range(row, endRowOfDecl).map(row => [actionType, ranges[row][0], arg]));
            }
          }
          return superVisitVariableDeclaration.call(v, node, state, path);
        };

        // visit!
        v.accept(parsed, {}, []);

        // patch src
        for (let i = actions.length; i--;) {
          const [action, index, arg] = actions[i];
          if (action === 'insert') {
            src = src.slice(0, index) + arg + src.slice(index);
          } else if (action === 'delete') {
            src = src.slice(0, index) + src.slice(index + arg);
          }
        }

        return src;
      }
    }

  }

];

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// ast commands

// note: additional generic ast commands are in text/code-navigation-commands.js

// helper
function pToI (ed, pos) { return ed.positionToIndex(pos); }
function iToP (ed, pos) { return ed.indexToPosition(pos); }

export var astEditorCommands = [

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
          ? Range.fromPositions(iToP(ed, found.decl.start), iToP(ed, found.decl.end)) : [])
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

lively.modules && !lively.FreezerRuntime && lively.modules.module('lively.ide/js/editor-plugin.js')
  .reload({ reloadDeps: false, resetEnv: false });
