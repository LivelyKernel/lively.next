/*global System*/

import { pt, Rectangle } from "lively.graphics"
import { chain, arr, obj, string } from "lively.lang";
import { eqPosition, lessPosition } from "../../text/position.js"

function doEval(morph, range = morph.selection.isEmpty() ? morph.lineRange() : morph.selection.range, env) {
  var evalStrategies = System.get(System.decanonicalize("lively.vm/lib/eval-strategies.js")),
      evalStrategy = evalStrategies && new evalStrategies.LivelyVmEvalStrategy();;
  if (!evalStrategy)
    throw new Error("doit not possible: lively.vm eval-strategies not available!")

  if (!env) env = morph.evalEnvironment || {}; // FIXME!
  var {targetModule, context} = env,
      code = morph.textInRange(range),
      context = context || morph,
      targetModule = targetModule || "lively://lively.next-prototype_2016_08_23/" + morph.id,
      sourceURL = targetModule + "_doit_" + Date.now(),
      opts = {System, targetModule, context, sourceURL};
  return evalStrategy.runEval(code, opts);
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
  sel.range = {start: {row, column: idx+2}, end: {row, column: text.length}};
}


var printEvalResult = (function() {
  var maxColLength = 300,
      itSym = typeof Symbol !== "undefined" && Symbol.iterator;
  return function(result, maxDepth) {
    var err = result instanceof Error ? result : result.isError ? result.value : null;
    return err ?
      String(err) + (err.stack ? "\n" + err.stack : "") :
      printInspect(result.value, maxDepth);
  }

  function printIterable(val, ignore) {
    var isIterable = typeof val !== "string"
                  && !Array.isArray(val)
                  && itSym && typeof val[itSym] === "function";
    if (!isIterable) return ignore;
    var hasEntries = typeof val.entries === "function",
        it = hasEntries ? val.entries() : val[itSym](),
        values = [],
        open = hasEntries ? "{" : "[", close = hasEntries ? "}" : "]",
        name = val.constructor && val.constructor.name || "Iterable";
    for (var i = 0, next; i < maxColLength; i++) {
      next = it.next();
      if (next.done) break;
      values.push(next.value);
    }
    var printed = values.map(ea => hasEntries ?
        `${printInspect(ea[0], 1)}: ${printInspect(ea[1], 1)}` :
        printInspect(ea, 2)).join(", ");
    return `${name}(${open}${printed}${close})`;
  }

  function inspectPrinter(val, ignore) {
    if (!val) return ignore;
    if (val.isMorph) return String(val);
    if (val instanceof Promise) return "Promise()";
    if (val instanceof Node) return String(val);
    if (typeof ImageData !== "undefined" && val instanceof ImageData) return String(val);
    var length = val.length || val.byteLength;
    if (length !== undefined && length > maxColLength && val.slice) {
      var printed = typeof val === "string" || val.byteLength ?
                      String(val.slice(0, maxColLength)) :
                      val.slice(0,maxColLength).map(string.print);
      return "[" + printed + ",...]";
    }
    var iterablePrinted = printIterable(val, ignore);
    if (iterablePrinted !== ignore) return iterablePrinted;
    return ignore;
  }

  function printInspect(object, maxDepth) {
    if (typeof maxDepth === "object")
      maxDepth = maxDepth.maxDepth || 2;

    if (!object) return String(object);
    if (typeof object === "string") return '"' + (object.length > maxColLength ? (object.slice(0,maxColLength) + "...") : String(object)) + '"';
    if (object instanceof Error) return object.stack || String(object);
    if (!obj.isObject(object)) return String(object);
    var inspected = obj.inspect(object, {customPrinter: inspectPrinter, maxDepth, printFunctionSource: true});
    // return inspected;
    return inspected === "{}" ? String(object) : inspected;
  }

})();

export var jsEditorCommands = [

  {
    name: "doit",
    doc: "Evaluates the selecte code or the current line and report the result",
    exec: async function(morph, opts, count = 1) {
      // opts = {targetModule}
      maybeSelectCommentOrLine(morph);
      var result, err;
      try {
        result = await doEval(morph, undefined, opts);
        err = result.isError ? result.value : null;
      } catch (e) { err = e; }
      err ?
        morph.world().logError(err) :
        morph.world().setStatusMessage(printEvalResult(result, count));
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
        morph.world().logError(err) :
        morph.world().setStatusMessage(String(result.value));
      return result;
    }
  },

  {
    name: "printit",
    doc: "Evaluates the selecte code or the current line and insert the result in a printed representation",
    exec: async function(morph, opts) {
      // opts = {targetModule}
      maybeSelectCommentOrLine(morph);
      var result, err;
      try {
        result = await doEval(morph, undefined, opts);
        err = result.isError ? result.value : null;
      } catch (e) { err = e; }
      morph.selection.collapseToEnd();
      // morph.insertTextAndSelect(err ? err.stack || String(err) : String(result.value));
      morph.insertTextAndSelect(err ? String(err) + (err.stack ? "\n" + err.stack : "") : String(result.value));
      return result;
    }
  },

  {
    name: "inspectit",
    doc: "...",
    handlesCount: true,
    exec: async function(morph, opts, count = 1) {
      // opts = {targetModule}
      maybeSelectCommentOrLine(morph);
      var result, err;
      try {
        result = await doEval(morph, undefined, opts);
        err = result.isError ? result.value : null;
      } catch (e) { err = e; }
      morph.selection.collapseToEnd();
      // morph.insertTextAndSelect(err ? err.stack || String(err) : obj.inspect(result.value, {maxDepth: count}));
      morph.insertTextAndSelect(printEvalResult(result, count));
      return result;
    }
  },

  {
    name: "toggle comment",
    exec: function(morph) {

      var doc = morph.document,
          sel = morph.selection;

      if (!sel.isEmpty() && sel.end.column === 0)
        sel.growRight(-1);

      var startRow = sel.start.row,
          lines = doc.lines.slice(sel.start.row, sel.end.row+1),
          isCommented = lines.every(line => line.trim() && line.match(/^\s*(\/\/|$)/));

      morph.undoManager.group();
      if (isCommented) {
        lines.forEach((line, i) => {
          var match = line.match(/^(\s*)(\/\/\s?)(.*)/);
          if (match) {
            var [_, before, comment, after] = match,
                range = {
                  start: {row: startRow+i, column: before.length},
                  end: {row: startRow+i, column: before.length+comment.length}
                };
            morph.deleteText(range);
          }
        });

      } else {
        var minSpace = lines.reduce((minSpace, line, i) =>
              !line.trim() && (!sel.isEmpty() || sel.start.row !== sel.end.row) ?
                minSpace :
                Math.min(minSpace, line.match(/^\s*/)[0].length), Infinity),
            minSpace = minSpace === Infinity ? 0 : minSpace;
        lines.forEach((line, i) => {
          var [_, space, rest] = line.match(/^(\s*)(.*)/);
          morph.insertText(`// `, {row: startRow+i, column: minSpace});
        });
      }
      morph.undoManager.group();

      return true;
    }
  },

  {
    name: "toggle block comment",
    exec: function(morph) {
      var existing = blockCommentInRangeOrPos();

      morph.undoManager.group();
      if (existing) {
        var {start, end} = existing;
        morph.deleteText({start: {row: end.row, column: end.column-2}, end});
        morph.deleteText({start, end: {row: start.row, column: start.column+2}});

      } else {
        morph.insertText(`/*`, morph.selection.start);
        morph.insertText(`*/`, morph.selection.end);
        var select = !morph.selection.isEmpty();
        morph.selection.growLeft(2);
        if (!select) morph.selection.collapse();
      }

      morph.undoManager.group();

      return true;


      // FIXME use JS tokens for this thing...
      function blockCommentInRangeOrPos() {
        // blockCommentInRangeOrPos()

        if (!morph.selection.isEmpty()) {
          var selText = morph.selection.text;
          return selText.slice(0,2) === "/*" && selText.slice(-2) === "*/" ?
            morph.selection.range : null;
        }

        var pos = morph.cursorPosition;

        var startLeft = morph.search("/*", {start: pos, backwards: true});
        if (!startLeft) return null;
        var endLeft = morph.search("*/", {start: pos, backwards: true});
        // /*....*/ ... <|>
        if (endLeft && lessPosition(startLeft, endLeft)) return null;

        var endRight = morph.search("*/", {start: pos});
        if (!endRight) return null;
        var startRight = morph.search("/*", {start: pos});
        // <|> ... /*....*/
        if (startRight && lessPosition(startRight, endRight)) return null;

        return {start: startLeft.range.start, end: endRight.range.end};
      }
    }
  },

  {
    name: "comment box",
    exec: function(morph, _, count) {

      var undo = morph.undoManager.ensureNewGroup(morph, "comment box");

      if (morph.selection.isEmpty()) {
        morph.insertText("-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-");
        // undo = undo || arr.last(morph.undoManager.undos);
        morph.execCommand("toggle comment");
        morph.undoManager.group(undo);
        return true;
      }

      var range = morph.selection.range,
          lines = morph.withSelectedLinesDo(line => line),
          indent = arr.min([range.start.column].concat(
            chain(lines).map(function(line) { return line.match(/^\s*/); })
              .flatten().compact().pluck('length').value())),
          length = arr.max(lines.map(ea => ea.length)) - indent,
          fence = Array(Math.ceil(length / 2) + 1).join('-=') + '-';

      // comment range
      // morph.toggleCommentLines();
      morph.collapseSelection();

      // insert upper fence
      morph.cursorPosition = {row: range.start.row, column: 0}
      if (count)
        morph.insertText(string.indent("-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-" + '\n', ' ', indent));
      else
        morph.insertText(string.indent(fence + '\n', ' ', indent));
      morph.selection.goUp();
      morph.execCommand("toggle comment");
      // insert fence below
      morph.cursorPosition = {row: range.end.row+2, column: 0};

      morph.insertText(string.indent(fence + '\n', ' ', indent));

      morph.selection.goUp();
      // morph.selection.gotoLineEnd();
      morph.execCommand("toggle comment");

      // select it all
      morph.selection.range = {start: {row: range.start.row, column: 0}, end: morph.cursorPosition};
      morph.undoManager.group(undo);

      return true;
    },
    multiSelectAction: "forEach",
    handlesCount: true
  }

];


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

export var jsIdeCommands = [
  {
    name: "[javascript] list errors and warnings",
    exec: async text => {
      var markers = (text.markers || []).filter(({type}) => type === "js-undeclared-var" || type === "js-syntax-error");
      if (!markers.length) { show("no warnings or errors"); return true; }

      var items = markers.map(({range, type}) => {
                    var string = `[${type.split("-").slice(1).join(" ")}] ${text.textInRange(range)}`
                    return {isListItem: true, string, value: range}
                  }),
          {selected: [sel]} = await text.world().filterableListPrompt("jump to warning or error", items);
          // var {selected: [sel]} = await text.world().filterableListPrompt("jump to warning or error", items);
      if (sel) {
        text.saveMark();
        text.selection = sel;
        text.centerRow(sel.start.row);
      }
      return true;
    }
  }
];

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

var openPairs = {
  "{": "}",
  "[": "]",
  "(": ")",
  "<": ">",
  "\"": "\"",
  "'": "'",
  "`": "`",
}

var closePairs = {
  "}": "{",
  "]": "[",
  ")": "(",
  ">": "<",
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
      sel.growLeft(1);
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
    morph.execCommand("insertstring_default", {...args, string: string + openPairs[string]})
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
    return true;
  }
}



// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// ast commands

import { once } from "lively.bindings"

// helper
function pToI(ed, pos) { return ed.positionToIndex(pos); }
function iToP(ed, pos) { return ed.indexToPosition(pos); }

function execCodeNavigator(sel) {
  return function(ed, args, count) {
    var nav = ed.pluginInvoke("getNavigator");
    if (!nav) return false;
    ed.saveMark();
    var count = (count || 1);
    for (var i = 0; i < count; i++) { nav[sel](ed, args); }
    return true;
  }
}

export var astEditorCommands = [

{
  name: 'forwardSexp',
  bindKey: 'Ctrl-Alt-f|Ctrl-Alt-Right',
  exec: execCodeNavigator('forwardSexp'),
  multiSelectAction: 'forEach',
  readOnly: true
},

{
  name: 'backwardSexp',
  bindKey: 'Ctrl-Alt-b|Ctrl-Alt-Left',
  exec: execCodeNavigator('backwardSexp'),
  multiSelectAction: 'forEach',
  readOnly: true
},

{
  name: 'backwardUpSexp',
  bindKey: 'Ctrl-Alt-u|Ctrl-Alt-Up',
  exec: execCodeNavigator('backwardUpSexp'),
  multiSelectAction: 'forEach',
  readOnly: true
},

{ 
  name: 'forwardDownSexp',
  bindKey: 'Ctrl-Alt-d|Ctrl-Alt-Down',
  exec: execCodeNavigator('forwardDownSexp'),
  multiSelectAction: 'forEach',
  readOnly: true
},

{
  name: 'markDefun',
  bindKey: 'Ctrl-Alt-h',
  exec: execCodeNavigator('markDefun'),
  multiSelectAction: 'forEach',
  readOnly: true
},

{
  name: 'expandRegion',
  bindKey: {win: 'Shift-Ctrl-E|Ctrl-Shift-Space', mac: 'Shift-Command-Space|Ctrl-Shift-Space'},
  exec: function(ed, args) {
    args = args || {};
    var expander = ed.pluginInvoke("getNavigator");
    if (!expander) return true;

    // if we get start/end position indexes to expand to handed in then we do
    // that
    var newState;
    var start = args.start, end = args.end;
    if (typeof start === "number" && typeof end === "number") {
      var state = ensureExpandState();
      newState = {range: [start, end], prev: ensureExpandState()}

    } else {
      // ... otherwise we leave it to the code navigator...
      var ast = expander.ensureAST(ed.textString);
      if (!ast) return;

      var newState = expander.expandRegion(ed, ed.textString, ast, ensureExpandState());
    }

    if (newState && newState.range) {
      ed.selection = {
        start: iToP(ed, newState.range[0]),
        end: iToP(ed, newState.range[1])};
      ed.$expandRegionState = newState;
    }

    once(ed, "selectionChange", () => ed.$expandRegionState = null, "call");

    return true;
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-      

    function ensureExpandState() {
      var state = ed.$expandRegionState;
      var pos = pToI(ed, ed.cursorPosition);
      if (state
        // has cursor moved? invalidate expansion state
       && (state.range  [0] === pos || state.range[1] === pos)) 
         return state;

      var range = ed.selection.range;
      return ed.$expandRegionState = {
        range: [pToI(ed, range.start), pToI(ed, range.end)]
      };
    }
  },
  multiSelectAction: 'forEach',
  readOnly: true
},

{
  name: 'contractRegion',
  bindKey: {win: 'Shift-Ctrl-S|Ctrl-Alt-Space', mac: 'Ctrl-Command-space|Ctrl-Alt-Space'},
  exec: function(ed) {
    if (ed.selection.isEmpty()) return true;
    var expander = ed.pluginInvoke("getNavigator");
    if (!expander) return true;

    var ast = expander.ensureAST(ed.textString);
    if (!ast) return true;

    var state = ed.$expandRegionState;
    if (!state) return true;

    var newState = expander.contractRegion(ed, ed.textString, ast, state);
    if (newState && newState.range) {
      ed.selection = {
        start: iToP(ed, newState.range[0]),
        end: iToP(ed, newState.range[1])};
      ed.$expandRegionState = newState;
    }

    once(ed, "selectionChange", () => ed.$expandRegionState = null, "call");
    return true;
  },
  multiSelectAction: 'forEach',
  readOnly: true
}

];



lively.modules.module("lively.morphic/ide/js/editor-plugin.js").reload({reloadDeps: false, resetEnv: false})