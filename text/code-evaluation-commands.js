import Inspector from "../js/inspector.js";
import { string } from "lively.lang";

export var codeEvaluationCommands = [

  {
    name: "doit",
    doc: "Evaluates the selecte code or the current line and report the result",
    exec: async function(morph, opts, count = 1) {
      // opts = {targetModule}
      morph.maybeSelectCommentOrLine();
      var result, err;
      try {
        opts = {...opts, logDoit: true, inspect: true, inspectDepth: count};
        result = await morph.doEval(undefined, opts);
        err = result.error ? result.error : result.isError ? result.value : null;
      } catch (e) { err = e; }
      err ?
        morph.showError(err) :
        morph.setStatusMessage(string.truncate(result.value, 1000));
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
        result = await morph.doEval({start: {row: 0, column: 0}, end: morph.documentEndPosition}, {...opts, logDoit: true});
        err = result.error ? result.error : result.isError ? result.value : null;
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
      morph.maybeSelectCommentOrLine();
      var result, err;
      try {
        opts = {...opts, asString: true, logDoit: true};
        result = await morph.doEval(undefined, opts);
        err = result.error ? result.error : result.isError ? result.value : null;
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
      morph.maybeSelectCommentOrLine();
      var result, err;
      try {
        result = await morph.doEval(undefined, opts);
        err = result.error ? result.error : result.isError ? result.value : null;
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
      morph.maybeSelectCommentOrLine();
      var result, err;
      try {
        opts = {...opts, inspect: true, inspectDepth: count, logDoit: true};
        result = await morph.doEval(undefined, opts);
        err = result.error ? result.error : result.isError ? result.value : null;
      } catch (e) { err = e; }
      morph.selection.collapseToEnd();
      morph.insertTextAndSelect(result.value);
      return result;
    }
  },
]
