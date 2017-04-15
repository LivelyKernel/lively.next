import { arr, string } from "lively.lang";
import EditorPlugin from "../editor-plugin.js";
import { pt } from "lively.graphics";
import { config } from "lively.morphic";
import { lessEqPosition } from "lively.morphic/text//position.js";

import DiffNavigator from "./navigator.js";
import DiffTokenizer from "./tokenizer.js";
import { FilePatch } from "./file-patch.js";

import { runCommand } from "lively.morphic/ide/shell/shell-interface.js"
import * as git from "lively.morphic/ide/shell/git.js"

// that.plugins = [new DiffEditorPlugin()]

export default class DiffEditorPlugin extends EditorPlugin {

  constructor(theme) {
    super(theme);
    this.tokenizer = new DiffTokenizer();
    this.tokens = [];
    this.patches = [];
  }

  get isDiffEditorPlugin() { return true }

  get cwd() {
    // a hack for now... get cwd for commands
    var o = this.textMorph.owner,
        inTerminal = o && o.constructor.name === "Terminal";
    if (inTerminal) return o.cwd;
    return null;
  }

  highlight() {
    let textMorph = this.textMorph;
    if (!this.theme || !textMorph || !textMorph.document) return;

    this.tokenize(textMorph.textString);
    textMorph.setTextAttributesWithSortedRanges(this.styledRanges());
  }

  tokenize(string) {
    let tokens = [], patches = []; 
    if (string) {
      try {
        ({tokens, patches} = this.tokenizer.tokenize(string));
      } catch (e) {}
    }
    this.tokens = tokens;
    this.patches = patches;
  }

  styledRanges(offsetRow = 0, indent = 0) {
    let attributes = [], tokens = this.tokens;
    for (let {type, start, end} of tokens) {
      if (offsetRow || indent) {
        {
          let {row, column} = start;
          row += offsetRow; //column += indent;
          start = {row, column};
        }
        {
          let {row, column} = end;
          row += offsetRow; //column += indent-;
          end = {row, column};
        }
      }
      if (tokens.type !== "default")
        attributes.push({start, end}, this.theme.styleCached(type));
    }
    return attributes;
  }

  getCommands(other) { return other.concat(commands); }

  getKeyBindings(other) {
    return other.concat([
      {command: "[patch] open file at cursor",    keys: "Alt-O"},
      {command: "[patch] show selected patch",    keys: "Alt-P"},
      {command: "[git] stage selection",          keys: "Alt-S"},
      {command: "[git] stage all",                keys: "Alt-Shift-S"},
      {command: "[git] unstage selection",        keys: "Alt-U"},
      {command: "[git] unstage all",              keys: "Alt-Shift-U"},
      {command: "[git] discard selection",        keys: "Alt-K"},
      {command: "[git] discard all",              keys: "Alt-Shift-K"},
      {command: "[git] apply selection",          keys: "Alt-A"},
      {command: "[git] reverse apply selection",  keys: "Alt-R"},
      {command: "[git] commit",                   keys: "Alt-C"},
      {command: "[git] update",                   keys: "Alt-G"}
    ]);
  }

  tokenAt(pos) {
    return this.tokens.find(({start,end}) => lessEqPosition(start, pos) && lessEqPosition(pos, end));
  }

  getNavigator() { return new DiffNavigator(); }

  getPatchesFromSelection(editor) {
    var patches = this.patches;
    if (!patches || !patches.length) return [];

    var nav = this.getNavigator(),
        range = editor.selection.range,
        startPatch = nav.findPatchAt(editor, range.start),
        endPatch = nav.findPatchAt(editor, range.end),
        from = patches.indexOf(startPatch),
        to = endPatch ? patches.indexOf(endPatch) : patches.length,
        modifiedPatchString = null,
        startLine = range.start.row,
        endLine = range.end.row,
        offset = startPatch ? startPatch.tokens[0].start.row : 0;

    return patches.slice(from, to+1).map((ea, i) => {
      var patchString = ea.createPatchStringFromRows(startLine-offset, endLine-offset);
      offset += ea.length();
      return patchString ? FilePatch.read(patchString) : null;
    }).filter(Boolean);
  }

  getPatchAtCursor(editor) {
    var pos = editor.cursorPosition,
        tok = this.tokenAt(pos);
    if (!tok || !tok.hasOwnProperty("patch")) return null;
    var patch = this.patches[tok.patch],
        hunk = tok.hasOwnProperty("hunk") ? patch.hunks[tok.hunk] : null;
    return {
      patch, hunk,
      cursorOffsetInHunk: hunk ? pos.row - hunk.tokens[0].start.row : 0
    }
  }

  getMenuItems(items) {
    var target = this.textMorph,
        hasSelection = !target.selection.isEmpty();

    items.push(...[
      {isDivider: true},
      {target, command: "[patch] open file at cursor"},
      {target, command: "[patch] show selected patch"},
      {target, command: "[git] apply selection"},
      {target, command: "[git] reverse apply selection"},
      {target, command: "[git] stage " + (hasSelection ? "selection" : "all")},
      {target, command: "[git] unstage "   + (hasSelection ? "selection" : "all")},
      {target, command: "[git] discard "   + (hasSelection ? "selection" : "all")},
      {target, command: "[git] stage " + (hasSelection ? "selection" : "all")},
      {target, command: "[git] update"},
      {target, command: "[git] commit"}
    ]);

    return items;
  }

}


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

var commands = [

  {
    name: "[patch] show selected patch",
    exec: function(ed) {
      var mode = ed.pluginFind(p => p.isDiffEditorPlugin),
          hasSelection = !ed.selection.isEmpty(),
          patches;

      if (!hasSelection) {
        var patchInfo = mode.getPatchAtCursor(ed);
        patches = patchInfo.patch ? [patchInfo.patch] : null;
      } else {
        patches = mode.getPatchesFromSelection(ed);
      }

      if (!patches || !patches.length) {
        ed.setStatusMessage("Cannot read patch");
      } else {
        var patchString = arr.invoke(patches, "createPatchString").join("\n");
      }

      ed.world().execCommand("open text window", {
        lineWrapping: false,
        plugins: [new DiffEditorPlugin],
        ...config.codeEditor.defaultStyle,
        title: "patches for " + arr.pluck(patches, "fileNameA").join(", "),
        content: patchString,
        extent: pt(700, 400)
      });

      return true;
    }
  },

  {
    name: "[patch] open file at cursor",
    exec: async function(ed) {
      var mode = ed.pluginFind(p => p.isDiffEditorPlugin),
          patchInfo = mode.getPatchAtCursor(ed);

      if (!patchInfo || !patchInfo.hunk) {
        ed.setStatusMessage("Cannot read patch");
        return true;
      }

      var lineNo = patchInfo.hunk.relativeOffsetToFileLine(patchInfo.cursorOffsetInHunk),
          filePath = patchInfo.hunk.fileNameB;

      if (!filePath.match(/^(\/|[a-z]:\\)/i)) { // not an absolute path
        var baseDir = mode.cwd || await ed.world().prompt("Enter base directory for file", {
          historyId: "lively.morphic-ide/diff-directory-for-file",
          useLastInput: true,
          input: document.location.origin
        });

        if (baseDir)
          filePath = string.joinPath(baseDir, filePath);
      }

      if (lineNo) filePath += ":" + lineNo;

      return ed.world().execCommand("open file", {url: filePath});
    }
  },

  {
    name: "[git] commit",
    exec: async function(ed, args) {
      var mode = ed.pluginFind(p => p.isDiffEditorPlugin);
      try {
        await git.commit({cwd: mode.cwd});
        ed.setStatusMessage("Commit successful");
      } catch (e) { ed.showError(e) }
      return true;
    }
  },

  {
    name: "[git] update",
    exec: async function(ed, args) {
      var input = await ed.world().prompt("git diff command",
        {useLastInput: true, input: "git diff", historyId: "codeeditor.modes.Diff.git-update"});

      if (!input) {
        ed.setStatusMessage("command canceled");
        return true;
      }


      var mode = ed.pluginFind(p => p.isDiffEditorPlugin),
          cmd = await runCommand(input, {cwd: mode.cwd});
      await cmd.whenDone();
      ed.saveExcursion(() => ed.textString = cmd.stdout);
      return true;
    }
  },

  {
    name: "[git] stage selection",
    exec: async function(ed, args) {
      var mode = ed.pluginFind(p => p.isDiffEditorPlugin);
      return await patchApplySelection(ed, "stage", {cwd: mode.cwd, ...args});
    }
  },

  {
    name: "[git] unstage selection",
    exec: async function(ed, args) {
      var mode = ed.pluginFind(p => p.isDiffEditorPlugin);
      return await patchApplySelection(ed, "unstage", {cwd: mode.cwd, ...args});
    }
  },

  {
    name: "[git] discard selection",
    exec: async function(ed, args) {
      var mode = ed.pluginFind(p => p.isDiffEditorPlugin);
      return await patchApplySelection(ed, "discard", {cwd: mode.cwd, ...args});
    }
  },

  {
    name: "[git] reverse apply selection",
    exec: async function(ed, args) {
      var mode = ed.pluginFind(p => p.isDiffEditorPlugin);
      return await patchApplySelection(ed, "reverseApply", {cwd: mode.cwd, ...args});
    }
  },

  {
    name: "[git] apply selection",
    exec: async function(ed, args) {
      var mode = ed.pluginFind(p => p.isDiffEditorPlugin);
      return await patchApplySelection(ed, "apply", {cwd: mode.cwd, ...args});
    }
  },

  {
    name: "[git] stage all",
    exec: async function(ed, args) {
      var mode = ed.pluginFind(p => p.isDiffEditorPlugin);
      return await stageOrUnstagedOrDiscardAll(ed, "stage", {cwd: mode.cwd, ...args});
    }
  },

  {
    name: "[git] unstage all",
    exec: async function(ed, args) {
      var mode = ed.pluginFind(p => p.isDiffEditorPlugin);
      return await stageOrUnstagedOrDiscardAll(ed, "unstage", {cwd: mode.cwd, ...args});
    }
  },

  {
    name: "[git] discard all",
    exec: async function(ed, args) {
      var mode = ed.pluginFind(p => p.isDiffEditorPlugin);
      return await stageOrUnstagedOrDiscardAll(ed, "discard", {cwd: mode.cwd, ...args});
    }
  }

];

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// git helpers
async function stageOrUnstagedOrDiscardAll(ed, action, options) {
  options = {dryRun: false, ...options};

  var mode = ed.pluginFind(p => p.isDiffEditorPlugin),
      files = arr.pluck(mode.patches,"fileNameA"),
      fos = await git.fileStatus(options.cwd, options),
      selectedFos = fos.filter(fo => files.includes(fo.fileName)),
      {commands, fileObjects} = await git.stageOrUnstageOrDiscardFiles(action, selectedFos, options);

  ed.setStatusMessage(string.capitalize(action) + "\n" + arr.pluck(fileObjects, "fileName").join("\n"));

  return {commands, fileObjects};
}

async function patchApplySelection(ed, action, options) {
  // action = "stage" || "unstage"
  options = {dryRun: false, ...options};
  var {commands, patches} = await git.applyPatchesFromEditor(action, ed, options);
  ed.setStatusMessage(string.capitalize(action) + "\n" + arr.invoke(patches, "createPatchString").join("\n"));
  return {commands, patches}
}
