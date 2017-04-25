import { arr, string } from "lively.lang";
import { show } from "../../index.js";
import { Range } from "../../text/range.js";
import Inspector from "./inspector.js";

function getEvalEnv(morph) {
  var plugin = morph.pluginFind(p => p.isJSEditorPlugin);
  return plugin ? plugin.evalEnvironment : null
}

function setEvalEnv(morph, newEnv) {
  var plugin = morph.pluginFind(p => p.isJSEditorPlugin);
  if (plugin) Object.assign(plugin.evalEnvironment, newEnv);
  return plugin.evalEnvironment;
}

function doEval(
  morph,
  range = morph.selection.isEmpty() ? morph.lineRange() : morph.selection.range,
  additionalOpts,
  code = morph.textInRange(range)
) {

  var jsPlugin = morph.pluginFind(p => p.isJSEditorPlugin);
  if (!jsPlugin)
    throw new Error(`doit not possible: cannot find js editor plugin of !${morph}`)
  return jsPlugin.runEval(code, additionalOpts);
}

function maybeSelectCommentOrLine(morph) {
  // Dan's famous selection behvior! Here it goes...
  /*   If you click to the right of '//' in the following...
  'wrong' // 'try this'.slice(4)  //should print 'this'
  'http://zork'.slice(7)          //should print 'zork'
  */
  // If click is in comment, just select that part
  var sel = morph.selection,
      {row, column} = sel.lead,
      text = morph.selectionOrLineString();

  if (!sel.isEmpty()) return;

  // text now equals the text of the current line, now look for JS comment
  var idx = text.indexOf('//');
  if (idx === -1                          // Didn't find '//' comment
      || column < idx                 // the click was before the comment
      || (idx>0 && (':"'+"'").indexOf(text[idx-1]) >=0)    // weird cases
      ) { morph.selectLine(row); return }

  // Select and return the text between the comment slashes and end of method
  sel.range = {start: {row, column: idx + 2}, end: {row, column: text.length}};
}



export var jsEditorCommands = [

  {
    name: "doit",
    doc: "Evaluates the selecte code or the current line and report the result",
    exec: async function(morph, opts, count = 1) {
      // opts = {targetModule}
      maybeSelectCommentOrLine(morph);
      var result, err;
      try {
        opts = {...opts, inspect: true, inspectDepth: count};
        result = await doEval(morph, undefined, opts);
        err = result.isError ? result.value : null;
      } catch (e) { err = e; }
      err ?
        morph.showError(err) :
        morph.setStatusMessage(result.value);
      return result;
    }
  },

  {
    name: "eval all",
    doc: "Evaluates the entire text contents",
    scrollCursorIntoView: false,
    exec: async function(morph, opts) {
      // opts = {targetModule}
      var result, err;
      try {
        result = await doEval(morph, {start: {row: 0, column: 0}, end: morph.documentEndPosition}, opts);
        err = result.isError ? result.value : null;
      } catch (e) { err = e; }
      err ?
        morph.showError(err) :
        morph.setStatusMessage(String(result.value));
      return result;
    }
  },

  {
    name: "printit",
    doc: "Evaluates selected code or the current line and inserts the result in a printed representation",
    exec: async function(morph, opts) {
      // opts = {targetModule}
      maybeSelectCommentOrLine(morph);
      var result, err;
      try {
        opts = {...opts, asString: true};
        result = await doEval(morph, undefined, opts);
        err = result.isError ? result.value : null;
      } catch (e) { err = e; }
      morph.selection.collapseToEnd();
      // morph.insertTextAndSelect(err ? err.stack || String(err) : String(result.value));
      morph.insertTextAndSelect(
        err ? String(err) + (err.stack ? "\n" + err.stack : "") :
        String(result.value));
      return result;
    }
  },

  {
    name: "inspectit",
    doc: "Evaluates the expression and opens an inspector widget on the resulting object.",
    exec: async function(morph, opts) {
      maybeSelectCommentOrLine(morph);
      var result, err;
      try {
        result = await doEval(morph, undefined, opts);
        err = result.isError ? result.value : null;
      } catch (e) { err = e; }
      Inspector.openInWindow({targetObject: err ? err : result.value});
      return result;
    }
  },

  {
    name: "print inspectit",
    doc: "Prints a representation of the object showing it's properties. The count argument defines how deep (recursively) objects will be printed.",
    handlesCount: true,
    exec: async function(morph, opts, count = 1) {
      maybeSelectCommentOrLine(morph);
      var result, err;
      try {
        opts = {...opts, inspect: true, inspectDepth: count};
        result = await doEval(morph, undefined, opts);
        err = result.isError ? result.value : null;
      } catch (e) { err = e; }
      morph.selection.collapseToEnd();
      morph.insertTextAndSelect(result.value);
      return result;
    }
  },

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
        varName = node.name
      }

      // this.pluginFind(p => p.isJSEditorPlugin).sanatizedJsEnv()
      var env = ed.pluginFind(p => p.isJSEditorPlugin).sanatizedJsEnv(),
          source = `lively.modules.module("${env.targetModule}").undefine("${varName}")`,
          result, err;

      try {
        result = await doEval(ed, null, env, source);
        err = result.isError ? result.value : null;
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
        text.setStatusMessage(reset ? "doitContext is now\n" + selected : "doitContext reset")
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
        await System.import("lively.morphic/ide/js/import-helper.js");
      var result = await interactivelyInjectImportIntoText(text, opts);
      if (!result) text.setStatusMessage("canceled");
      return result;
    }
  },

  {
    name: "[javascript] remove unused imports",
    exec: async (text, opts = {query: true}) => {
      var {cleanupUnusedImports} =
        await System.import("lively.morphic/ide/js/import-helper.js");
      var status = await cleanupUnusedImports(text, opts);
      text.setStatusMessage(status);
      return true
    }
  },

  {
    name: "[javascript] eslint report",
    exec: async text => {
      var { default: ESLinter } = await System.import("lively.morphic/ide/js/eslint/lively-interface.js")
      try { return ESLinter.reportOnMorph(text); } catch(e) { text.showError(e); }
    }
  },

  {
    name: "[javascript] eslint preview fixes",
    exec: async text => {
      var { default: ESLinter } = await System.import("lively.morphic/ide/js/eslint/lively-interface.js")
      try { return ESLinter.previewFixesOnMorph(text); } catch(e) { text.showError(e); }
    }
  },

  {
    name: "[javascript] auto format code",
    handlesCount: true,
    exec: async (text, opts, count) => {
      show(count);

      let margin = 7 * (text.width / 100),
          printWidth = count ? count : Math.floor(text.width / text.defaultCharExtent().width);

      opts = {
        printWidth,
        tabWidth: 2,
        bracketSpacing: false,
        ...opts
      };

      let module = lively.modules.module,
          prettier = await module("https://prettier.github.io/prettier/prettier.min.js").load({
            format: "global",
            instrument: false
          }),
          {findNodeByAstIndex} = await module("lively.ast/lib/acorn-extension.js").load(),
          {parse, printAst, withMozillaAstDo} = await module("lively.ast").load(),
          {nodesAt} = await module("lively.ast/lib/query.js").load(),
          format = prettier.format;
      prettifyRange(text);
      return true;

      function prettifyRange(textMorph, range = textMorph.selection.range) {
        var {start, end} = range,
            source = textMorph.textString,
            parsed = parse(source, {addAstIndex: true}),

            // find the ast nodes that are at start / end of the range
            startI = textMorph.positionToIndex(start),
            endI = textMorph.positionToIndex(end),
            commonNode = arr.intersect(nodesAt(startI, parsed), nodesAt(endI, parsed))
                          .reverse().find(ea => ea.body && ea.start < startI && ea.end < endI)
                      || parsed,
            statements = commonNode.body.body || commonNode.body,
            affectedNodes = arr.takeWhile(
                              arr.dropWhile(statements, ea => ea.start < startI),
                              ea => ea.end <= endI),
            startNode = affectedNodes[0] || arr.last(nodesAt(startI, parsed)),
            endNode = arr.last(affectedNodes) || arr.last(nodesAt(endI, parsed)),

            // prettier does throw away empty statements, make the ast indexes
            // fit so we can find start/end node in prettified source
            fixedStartAstIndex = startNode.astIndex,
            fixedEndAstIndex = endNode.astIndex,
            _ = withMozillaAstDo(parsed, {}, (next, node) => {
              if (node.type === "EmptyStatement") {
                if (node.astIndex < fixedStartAstIndex) {
                  fixedStartAstIndex--; fixedEndAstIndex--; }
                else if (node.astIndex < fixedEndAstIndex) {
                  fixedEndAstIndex--; }
              }
              next();
            }),

            prettySource = fixPrettified(format(source, opts)),
            prettyParsed = parse(prettySource, {addAstIndex: true}),

            // ...find the same ast nodes in the prettified source...
            prettyStartNode = findNodeByAstIndex(prettyParsed, fixedStartAstIndex),
            prettyEndNode = findNodeByAstIndex(prettyParsed, fixedEndAstIndex),

            // ...and go from those nodes to the start and and row in the orig source
            // text and prettified source text
            origStartRow = textMorph.indexToPosition(startNode.start).row,
            origEndRow = textMorph.indexToPosition(endNode.end).row,
            prettyLines = string.lines(prettySource),
            lineIndexComputer = string.lineIndexComputer(prettySource),
            prettyStartRow = lineIndexComputer(prettyStartNode.start),
            prettyEndRow = lineIndexComputer(prettyEndNode.end),

            // Now replace the lines designated by the selection range
            replacementLines = prettyLines.slice(prettyStartRow, prettyEndRow+1),
            replacementRange = {
              start: {column: 0, row: origStartRow},
              end: {column: 0, row: origEndRow + 1}
            };


        textMorph.undoManager.group()
        let newRange = textMorph.replace(replacementRange, replacementLines.join("\n") + "\n");
        textMorph.undoManager.group()
        textMorph.selection = newRange;
      }

      function fixPrettified(source) {
        // prettify has it's issues...
        return fixVarDeclIndentation(source);
      }

      function fixVarDeclIndentation(src, parsed) {
        // Example:
        // fixVarDeclIndentation("var foo = 23,\nbar;")
        //   => "var foo = 23,\n    bar;"

        if (!parsed) parsed = parse(src);

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
        }

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

var openPairs = {
  "{": "}",
  "[": "]",
  "(": ")",
  "\"": "\"",
  "'": "'",
  "`": "`",
}

var closePairs = {
  "}": "{",
  "]": "[",
  ")": "(",
   "\"": "\"",
  "'": "'",
  "`": "`",
}


export var insertStringWithBehaviorCommand = {
  name: "insertstring",
  exec: (morph, args = {string: null, undoGroup: false}) => {
    var string = args.string,
        sel = morph.selection,
        sels = sel.isMultiSelection ? sel.selections : [sel],
        offsetColumn = 0,
        isOpen = string in openPairs,
        isClose = string in closePairs;

    if (!isOpen && !isClose)
      return morph.execCommand("insertstring_default", args);

    var line = morph.getLine(sel.end.row),
        left = line[sel.end.column-1],
        right = line[sel.end.column];

    if (!sel.isEmpty()) {
      if (!isOpen)
        return morph.execCommand("insertstring_default", args);
      // we've selected something and are inserting an open pair => instead of
      // replacing the selection we insert the open part in front of it and
      // closing behind, then select everything
      var undo = morph.undoManager.ensureNewGroup(morph);
      morph.insertText(openPairs[string], sel.end);
      morph.insertText(string, sel.start);
      morph.undoManager.group(undo);
      sel.growRight(-1);
      return true;
    }

    // if input is closing part of a pair and we are in front of it then try
    // to find the matching opening pair part. If this can be found we do not
    // insert anything, just jump over the char
    if (right in closePairs && string === right) {
      var pos = morph.document.indexToPosition(morph.document.positionToIndex(sel.end)+1),
          matched = morph.findMatchingBackward(pos, "left", closePairs);
      if (matched) { sel.goRight(1); return true; }
    }

    // Normal close, not matching, just insert default
    if (isClose && !isOpen)
      return morph.execCommand("insertstring_default", args);

    // insert pair
    offsetColumn = 1;
    var undo = morph.undoManager.ensureNewGroup(morph);
    morph.insertText(string + openPairs[string]);
    morph.undoManager.group(undo);
    sel.goLeft(1);
    return true;
  }
}

export var deleteBackwardsWithBehavior = {
  name: "delete backwards",
  exec: function(morph) {
    if (morph.rejectsInput()) return false;
    var sel = morph.selection,
        line = morph.getLine(sel.end.row),
        left = line[sel.end.column-1],
        right = line[sel.end.column];
    if (sel.isEmpty() && left in openPairs && right === openPairs[left]) {
      sel.growRight(1); sel.growLeft(1);
    } else  if (sel.isEmpty()) sel.growLeft(1);
    sel.text = "";
    sel.collapse();
    if (morph.activeMark) morph.activeMark = null;
    return true;
  }
}
export var tabBehavior = {
  name: "tab - snippet expand or indent",
  handlesCount: true,
  scrollCursorIntoView: true,
  exec: function(morph, args, count) {
    if (!morph.selection.isEmpty()) {
      return morph.execCommand("[javascript] auto format code", args, count);
    }

    var snippet = morph.snippets.find(snippet => snippet.canExpand(morph));
    if (snippet) {
      snippet.expandAtCursor(morph);
      return true;
    }
    return morph.execCommand("insertstring", {string: morph.tab}, count);
  }
};

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
      }
      ed.scrollCursorIntoView()
      return true;
    }
  },

  {
    name: "selectSymbolReferenceOrDeclarationNext",
    readOnly: true,
    multiSelectAction: "single",
    exec: function(ed) { ed.execCommand('selectSymbolReferenceOrDeclaration', {direction: 'next'}); }
  },

  {
    name: "selectSymbolReferenceOrDeclarationPrev",
    readOnly: true,
    multiSelectAction: "single",
    exec: function(ed) { ed.execCommand('selectSymbolReferenceOrDeclaration', {direction: 'prev'}); }
  },

  {
    name: "selectSymbolReferenceOrDeclaration",
    readOnly: true,
    multiSelectAction: "single",
    exec: function(ed, args = {direction: null/*next,prev*/}) {
      // finds the name of the currently selected symbol and will use the JS
      // ast to select references and declarations whose name matches the symbol
      // in the current scope
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
      if (args.direction === 'next' || args.direction === 'prev') {
        if (currentRangeIdx === -1 && ranges.length) ranges = [ranges[0]];
        else {
          var nextIdx = currentRangeIdx + (args.direction === 'next' ? 1 : -1);
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

lively.modules.module("lively.morphic/ide/js/editor-plugin.js")
  .reload({reloadDeps: false, resetEnv: false});
