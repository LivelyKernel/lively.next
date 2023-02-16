import * as Inspector from '../js/inspector/ui.cp.js';
import { string } from 'lively.lang';
import { Morph, Text } from 'lively.morphic';
import { pt, Color } from 'lively.graphics';
import { runCommand, defaultDirectory } from '../shell/shell-interface.js';

export const codeEvaluationCommands = [

  {
    name: 'doit',
    doc: 'Evaluates the selected code or the current line and report the result',
    exec: async function (morph, opts, count = 1) {
      // opts = {targetModule}
      morph.maybeSelectCommentOrLine();
      let result, err;
      try {
        opts = { ...opts, logDoit: true, inspect: true, inspectDepth: count };
        result = await morph.doEval(undefined, opts);
        err = result.error ? result.error : result.isError ? result.value : null;
      } catch (e) { err = e; }
      err
        ? morph.showError(err)
        : morph.setStatusMessage(string.truncate(result.value, 1000));
      return result;
    }
  },
  {
    name: 'blame selection',
    doc: 'Retrieves complete git blame information for the selected code.',
    exec: async function (morph) {
      const sel = morph.selection.selections[0];
      const rangeStart = sel.range.start.row + 1;
      const rangeEnd = sel.range.end.row + 1;
      if (!morph.editorPlugin.evalEnvironment.targetModule) {
        morph.showError('Error!');
        return;
      }
      let fileToBlame = morph.editorPlugin.evalEnvironment.targetModule;
      if (!fileToBlame.match(/http:/) && !fileToBlame.match(/file:/)) {
        morph.showError('Only available for files located in the file system.');
        return;
      }

      let baseDir = await defaultDirectory();
      baseDir = baseDir.replace('http://localhost:9011/', '').replace('/lively.server', '');
      fileToBlame = fileToBlame.replace('http://localhost:9011/', '').replace('file://', '');

      const command = `git blame --date=short -L ${rangeStart},${rangeEnd} ${fileToBlame} | while read hash others;
        do
          echo $(git log -1 --pretty=%s $hash) " -- " $others
        done`;

      let cmd = runCommand(command, { cwd: baseDir });
      await cmd.whenDone();
      let result = cmd.output;

      const text = new Text({
        textString: result,
        fixedWidth: true,
        fixedHeight: true,
        extent: pt(415, 300),
        name: 'Blame Info',
        fill: Color.white,
        clipMode: 'auto'
      });
      text.openInWindow();
    }
  },
  {
    name: 'blame line',
    doc: 'Retrieves git commit message and author name from the last time the line at which the cursor is positioned was changed.',
    exec: async function (morph) {
      const lineNumber = morph.cursorPosition.row + 1;
      if (!morph.editorPlugin.evalEnvironment.targetModule) {
        morph.showError('Error!');
        return;
      }
      let fileToBlame = morph.editorPlugin.evalEnvironment.targetModule;
      if (!fileToBlame.match(/http:/) && !fileToBlame.match(/file:/)) {
        morph.showError('Only available for files located in the file system.');
        return;
      }

      let baseDir = await defaultDirectory();
      baseDir = baseDir.replace('http://localhost:9011/', '').replace('/lively.server', '');
      fileToBlame = fileToBlame.replace('http://localhost:9011/', '').replace('file://', '');

      const command = 'git blame --date=short -L ' + lineNumber + ',' + lineNumber + ' --porcelain ' + fileToBlame;

      let cmd = runCommand(command, { cwd: baseDir });
      await cmd.whenDone();
      let result = cmd.output;

      let author = result.match(/author (.*)$/m)[1];
      let commitMessage = result.match(/summary (.*)$/m)[1];
      let date = result.match(/author-time (.*)$/m)[1];
      date = new Date(date * 1000).toDateString();

      if (author === 'Not Committed Yet') morph.setStatusMessage('Line not yet commited.');
      else morph.setStatusMessage(commitMessage + ' - ' + author + ' on ' + date);
    }
  },
  {
    name: 'eval all',
    doc: 'Evaluates the entire text contents',
    scrollCursorIntoView: false,
    exec: async function (morph, opts) {
      // opts = {targetModule}
      let result, err;
      try {
        result = await morph.doEval({ start: { row: 0, column: 0 }, end: morph.documentEndPosition }, { ...opts, logDoit: true });
        err = result.error ? result.error : result.isError ? result.value : null;
      } catch (e) { err = e; }
      err
        ? morph.showError(err)
        : morph.setStatusMessage(String(result.value));
      return result;
    }
  },

  {
    name: 'printit',
    doc: 'Evaluates selected code or the current line and inserts the result in a printed representation',
    exec: async function (morph, opts) {
      // opts = {targetModule}
      morph.maybeSelectCommentOrLine();
      let result, err;
      try {
        opts = { ...opts, asString: false, logDoit: true };
        result = await morph.doEval(undefined, opts);
        err = result.error ? result.error : result.isError ? result.value : null;
      } catch (e) { err = e; }
      morph.selection.collapseToEnd();
      // morph.insertTextAndSelect(err ? err.stack || String(err) : String(result.value));
      const isColor = result.value && result.value.isColor;
      if (isColor) {
        morph.selection.text = String(result.value);
        const embeddedMorph = new Morph({
          fill: Color.transparent,
          extent: pt(morph.fontSize + 2, morph.fontSize + 2),
          submorphs: [{
            fill: result.value,
            center: pt(morph.fontSize + 2, morph.fontSize + 2).scaleBy(0.5)
          }]
        });
        const { column, row } = morph.selection.start;
        morph.insertText([embeddedMorph, {}],
          morph.selection.start);
        morph.selection.start = { column: column, row };
        morph.focus();
        return result;
      }
      morph.insertTextAndSelect(
        err
          ? String(err) + (err.stack ? '\n' + err.stack : '')
          : String(result.value));
      morph.focus();
      return result;
    }
  },

  {
    name: 'editit',
    doc: 'Evaluates the expression and opens an object editor on the resulting object.',
    exec: async function (morph, opts) {
      morph.maybeSelectCommentOrLine();
      let result; let target = morph.textInRange(morph.selection);
      const evalEnvironment = morph.evalEnvironment || {};
      const jsPlugin = morph.pluginFind(p => p.isEditorPlugin && typeof p.runEval === 'function');
      if (!evalEnvironment.systemInterface) { evalEnvironment.systemInterface = jsPlugin.systemInterface(opts); }
      if (evalEnvironment.systemInterface.name === 'local') {
        try {
          // enhance the objet editor to track remote t
          result = await morph.doEval(undefined, opts);
          target = result.value;
        } catch (e) { }
      }
      morph.world().execCommand('open object editor', { target, evalEnvironment });
      return result;
    }
  },

  {
    name: 'inspectit',
    doc: 'Evaluates the expression and opens an inspector widget on the resulting object.',
    exec: async function (morph, opts) {
      morph.maybeSelectCommentOrLine();
      let result; let err; let target = morph.textInRange(morph.selection);
      const evalEnvironment = morph.evalEnvironment || {};
      const jsPlugin = morph.pluginFind(p => p.isEditorPlugin && typeof p.runEval === 'function');
      if (!evalEnvironment.systemInterface) evalEnvironment.systemInterface = jsPlugin.systemInterface(opts);
      if (evalEnvironment.systemInterface.name === 'local') {
        try {
          // enhance the objet editor to track remote t
          result = await morph.doEval(undefined, opts);
          err = result.error ? result.error : result.isError ? result.value : null;
          target = result.value;
        } catch (e) { err = e; }
        Inspector.openInWindow({ targetObject: err || target });
      } else {
        Inspector.openInWindow({ remoteTarget: { code: target, evalEnvironment } });
      }
      return result;
    }
  },

  {
    name: 'log it',
    doc: 'Evaluates the expression and `console.log`s the result.',
    exec: async function (morph, opts) {
      morph.maybeSelectCommentOrLine();
      let result;
      const evalEnvironment = morph.evalEnvironment || {};
      const jsPlugin = morph.pluginFind(p => p.isEditorPlugin && typeof p.runEval === 'function');
      if (!evalEnvironment.systemInterface) evalEnvironment.systemInterface = jsPlugin.systemInterface(opts);
      if (evalEnvironment.systemInterface.name === 'local') {
        result = await morph.doEval(undefined, opts);
      }
      console.log(result.value || result.error); // eslint-disable-line no-console
      return result;
    }
  },

  {
    name: 'print inspectit',
    doc: "Prints a representation of the object showing it's properties. The count argument defines how deep (recursively) objects will be printed.",
    handlesCount: true,
    exec: async function (morph, opts, count = 1) {
      morph.maybeSelectCommentOrLine();
      let result;
      try {
        opts = { ...opts, inspect: true, inspectDepth: count, logDoit: true };
        result = await morph.doEval(undefined, opts);
      } catch (e) { }
      morph.selection.collapseToEnd();
      morph.insertTextAndSelect(result.value);
      return result;
    }
  }
];
