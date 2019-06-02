/*global System*/
import { arr, string } from "lively.lang";
import { show } from "lively.morphic";
import { Range } from "lively.morphic/text/range.js";

function getEvalEnv(morph) {
  var plugin = morph.pluginFind(p => p.isJSEditorPlugin);
  return plugin ? plugin.evalEnvironment : null;
}

function setEvalEnv(morph, newEnv) {
  var plugin = morph.pluginFind(p => p.isJSEditorPlugin);
  if (plugin) Object.assign(plugin.evalEnvironment, newEnv);
  return plugin.evalEnvironment;
}


export var jsEditorCommands = [

  {
    name: "undefine variable",
    doc: "Finds the variable at cursor position (or position passed) and undefines it in the module toplevel scope.",
    exec: async function(ed, env = {varName: null, position: null}) {
      var {varName, position} = env;

      if (!varName) {
        if (!position) position = ed.cursorPosition;
        var nav = ed.pluginInvokeFirst("getNavigator"),
            parsed = nav.ensureAST(ed),
            node = lively.ast.query.nodesAt(ed.positionToIndex(position), parsed)
              .reverse().find(ea => ea.type === "Identifier");
        if (!node) { ed.showError(new Error("no identifier found!")); return true; }
        varName = node.name;
      }

      // this.pluginFind(p => p.isJSEditorPlugin).sanatizedJsEnv()
      var env = ed.pluginFind(p => p.isJSEditorPlugin).sanatizedJsEnv(),
          source = `lively.modules.module("${env.targetModule}").undefine("${varName}")`,
          result, err;

      try {
        result = await ed.doEval(null, env, source);
        err = result.error ? result.error : result.isError ? result.value : null;
      } catch (e) { err = e; }

      err ?
        ed.showError(err) :
        ed.setStatusMessage(`${varName} undefined`);

      return true;
    }
  },

  {
    name: "change doitContext",
    exec: async text => {
      var [selected] = await text.world().execCommand("select morph", {
        prompt: "select morph for doitContext",
        justReturn: true,
        prependItems: ["reset"],
        filterFn: m => !m.isUsedAsEpiMorph()
      });
      if (selected) {
        var reset = selected === "reset";
        text.doitContext = reset ? null : selected;
        text.setStatusMessage(reset ? "doitContext is now\n" + selected : "doitContext reset");
      }
      return true;
    }
  },

  {
    name: "change eval backend",
    exec: async (text, opts = {backend: undefined}) => {
      var {backend} = opts;
      if (backend === undefined) {
        backend = await text.world().prompt(
          "choose eval backend", {historyId: "js-eval-backend-history"});
        if (!backend) {
          text.setStatusMessage("Canceled");
          return true;
        }
      }
      if (backend === "local") backend = null;
      text.setStatusMessage(`Eval backend is now ${backend || "local"}`);
      return setEvalEnv(text, {remote: backend});
    }
  },

  {
    name: "copy current module name to clipboard",
    exec: text => {
      var modName = text.evalEnvironment.targetModule;
      text.setStatusMessage(modName ? modName : "Cannot find module name");
      text.env.eventDispatcher.killRing.add(text);
      text.env.eventDispatcher.doCopy(modName);
      return true;
    }
  }

];


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

export var jsIdeCommands = [

  {
    name: "[javascript] list errors and warnings",
    exec: async text => {
      var markers = (text.markers || [])
        .filter(({type}) => type === "js-undeclared-var" || type === "js-syntax-error");
      if (!markers.length) {
        show("no warnings or errors");
        return true;
      }

      var items = markers.map(({range, type}) => {
            var string = `[${type.split("-").slice(1).join(" ")}] ${text.textInRange(range)}`;
            return {isListItem: true, string, value: range};
          }),
          {selected: [sel]} = await text
            .world()
            .filterableListPrompt("jump to warning or error", items);
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
    name: "[javascript] inject import",
    exec: async (text, opts = {gotoImport: false, insertImportAtCursor: true}) => {
      await lively.lang.promise.delay(0);
      var {interactivelyInjectImportIntoText} =
        await System.import("lively.ide/js/import-helper.js");
      var result = await interactivelyInjectImportIntoText(text, opts);
      if (!result) text.setStatusMessage("canceled");
      return result;
    }
  },

  {
    name: "[javascript] fix undeclared variables",
    exec: async (text, opts = {ignore: [], autoApplyIfSingleChoice: false}) => {
      let {interactivlyFixUndeclaredVariables} =
        await System.import("lively.ide/js/import-helper.js");
      let result = await interactivlyFixUndeclaredVariables(text, opts);
      text.focus();
      return result;
    }
  },

  {
    name: "[javascript] remove unused imports",
    exec: async (text, opts = {query: true}) => {
      var {cleanupUnusedImports} =
        await System.import("lively.ide/js/import-helper.js");
      var status = await cleanupUnusedImports(text, opts);
      text.setStatusMessage(status);
      return true;
    }
  },

  {
    name: "[javascript] eslint report",
    exec: async text => {
      var { default: ESLinter } = await System.import("lively.ide/js/eslint/lively-interface.js");
      try { return ESLinter.reportOnMorph(text); } catch(e) { text.showError(e); }
    }
  },

  {
    name: "[javascript] eslint preview fixes",
    exec: async text => {
      var { default: ESLinter } = await System.import("lively.ide/js/eslint/lively-interface.js");
      try { return ESLinter.previewFixesOnMorph(text); } catch(e) { text.showError(e); }
    }
  },

  {
    name: "[javascript] auto format code",
    handlesCount: true,
    exec: async (text, opts, count) => {
      let margin = 7 * (text.width / 100),
          printWidth = count ? count : Math.floor(text.width / text.defaultCharExtent().width);

      opts = {
        printWidth,
        tabWidth: 2,
        useTabs: false,
        bracketSpacing: false,
        ...opts
      };

      let module = lively.modules.module,
          prettierURL = System.normalizeSync("prettier", System.normalizeSync("lively.ide")),
          prettier = await module(prettierURL).load({format: "global", instrument: false}),
          {findNodeByAstIndex} = await module("lively.ast/lib/acorn-extension.js").load(),
          {parse, printAst, withMozillaAstDo} = await module("lively.ast").load(),
          {nodesAt} = await module("lively.ast/lib/query.js").load(),
          jsdiff = await System.import("jsdiff", System.decanonicalize("lively.morphic"));

      let range = text.selection.isEmpty() ? text.documentRange : text.selection.range,
          rangeStart = text.positionToIndex(range.start),
          rangeEnd = text.positionToIndex(range.end),
          formatted = prettier.format(text.textString, {
            ...opts,
            rangeStart,
            rangeEnd,
            parser: (text, parsers, options) =>
              parse(text, {allowReturnOutsideFunction: true})
          });

      text.undoManager.group();
      let diff = jsdiff.diffChars(text.textString, formatted);
      text.applyJsDiffPatch(diff);
      text.selection.text = fixPrettified(text.selection.text);
      text.undoManager.group();
      return true;

      function fixPrettified(source) {
        return fixVarDeclIndentation(source);
      }

      function fixVarDeclIndentation(src, parsed) {
        // Example:
        // fixVarDeclIndentation("var foo = 23,\nbar;")
        //   => "var foo = 23,\n    bar;"

        if (!parsed) parsed = parse(src, {allowReturnOutsideFunction: true});

        // visitor to find variable declarations
        let ranges = string.lineRanges(src),
            lines = src.split("\n"),
            actions = [],
            v = new lively.ast.BaseVisitor(),
            superVisitVariableDeclaration = v.visitVariableDeclaration;

        v.visitVariableDeclaration = (node, state, path) => {
          if (node.declarations.length > 1) {
            // whats the "indent" of the first var decl? offset from start of its line
            // to ident

            let firstRow = string.findLineWithIndexInLineRanges(ranges, node.start),
                firstIndent = node.declarations[0].start - ranges[firstRow][0];

            // for the following decls, compare their indent and emit delete or insert
            // action
            for (let i = 1; i < node.declarations.length; i++) {
              let decl = node.declarations[i],
                  row = string.findLineWithIndexInLineRanges(ranges, decl.start);
              if (firstRow === row) continue;
              let declIndent = lines[row].match(/\s*/)[0].length,
                  offset = firstIndent - declIndent;
              if (offset === 0) continue;
              // var decl bodies can be multi line, fix all of them
              let endRowOfDecl = string.findLineWithIndexInLineRanges(ranges, decl.end),
                  actionType = offset > 0 ? "insert" : "delete",
                  arg = offset > 0 ? " ".repeat(offset) : -offset;
              actions.push(
                ...arr.range(row, endRowOfDecl).map(row => [actionType, ranges[row][0], arg]));
            }
          }
          return superVisitVariableDeclaration.call(v, node, state, path);
        };

        // visit!
        v.accept(parsed, {}, []);

        // patch src
        for (let i = actions.length; i--; ) {
          let [action, index, arg] = actions[i];
          if (action === "insert") {
            src = src.slice(0, index) + arg + src.slice(index);
          } else if (action === "delete") {
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
function pToI(ed, pos) { return ed.positionToIndex(pos); }
function iToP(ed, pos) { return ed.indexToPosition(pos); }

export var astEditorCommands = [

  {
    name: "selectDefinition",
    readOnly: true,
    bindKey: "Alt-.",
    exec: function(ed, args) {
      var nav = ed.pluginInvokeFirst("getNavigator");
      if (!nav) return true;

      var found = nav.resolveIdentifierAt(ed, ed.cursorPosition);
      if (!found || !found.id) { show("No symbol identifier selected"); return true; }
      if (!found.decl) { show("Cannot find declaration of " + found.name); return true; }

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
    name: "selectSymbolReferenceOrDeclarationNext",
    readOnly: true,
    multiSelectAction: "single",
    exec: function(ed) { ed.execCommand("selectSymbolReferenceOrDeclaration", {direction: "next"}); }
  },

  {
    name: "selectSymbolReferenceOrDeclarationPrev",
    readOnly: true,
    multiSelectAction: "single",
    exec: function(ed) { ed.execCommand("selectSymbolReferenceOrDeclaration", {direction: "prev"}); }
  },

  {
    name: "selectSymbolReferenceOrDeclaration",
    doc: "Finds the name of the currently selected symbol and will use the JS ast to select references and declarations whose name matches the symbol in the current scope.",
    readOnly: true,
    multiSelectAction: "single",
    exec: function(ed, args = {direction: null/*next,prev*/}) {
      // 1. get the token / identifier info of what is currently selected

      var nav = ed.pluginInvokeFirst("getNavigator");
      if (!nav) return true;

      var found = nav.resolveIdentifierAt(ed, ed.cursorPosition);
      if (!found || !found.refs) { show("No symbol identifier selected"); return true; }

      // 3. map the AST ref / decl nodes to actual text ranges
      var sel = ed.selection,
          ranges = found.refs.map(({start, end}) => Range.fromPositions(iToP(ed, start), iToP(ed, end)))
            .concat(found.decl ?
              Range.fromPositions(iToP(ed, found.decl.start), iToP(ed, found.decl.end)): [])
            // .filter(range => !sel.ranges.some(otherRange => range.equals(otherRange)))
            .sort(Range.compare);

      if (!ranges.length) return true;

      // do we want to select all ranges or jsut the next/prev one?
      var currentRangeIdx = ranges.map(String).indexOf(String(sel.range));
      if (args.direction === "next" || args.direction === "prev") {
        if (currentRangeIdx === -1 && ranges.length) ranges = [ranges[0]];
        else {
          var nextIdx = currentRangeIdx + (args.direction === "next" ? 1 : -1);
          if (nextIdx < 0) nextIdx = ranges.length-1;
          else if (nextIdx >= ranges.length) nextIdx = 0;
          ranges = [ranges[nextIdx]];
        }
      } else { /*select all ranges*/ }

      // do the actual selection
      ranges.forEach(range => {
        var existing = sel.selections.findIndex(ea => ea.range.equals(range)),
            idx = sel.selections.length-1;
        existing > -1 ?
          arr.swap(sel.selections, existing, idx) :
          sel.addRange(range, false);
      });

      sel.mergeSelections();

      return true;
    }
  }

];

lively.modules.module("lively.ide/js/editor-plugin.js")
  .reload({reloadDeps: false, resetEnv: false});
