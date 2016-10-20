/*global System*/

import { pt, Rectangle } from "lively.graphics"
import { chain, arr, obj, string } from "lively.lang";
import { eqPosition, lessPosition } from "./position.js"

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// FIXME move this stuff below into a JS related module
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
