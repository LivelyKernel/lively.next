/* global declare, it, describe, beforeEach, afterEach */
import { expect } from 'mocha-es6';

import { arr } from 'lively.lang';

describe('diff patching', () => {

  // var git = lively.ide.git.Interface;
  // function range(rangeString) {
  //   var match = rangeString
  //     .replace(/^Range:\s*/, "")
  //     .match(/\[([0-9]+)\/([0-9]+)\][^\[]*\[([0-9]+)\/([0-9]+)\]/);
  //   if (!match) throw new Error("Cannot parse range " + rangeString);
  //   return new (ace.require("ace/range").Range)(Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4]));
  // }

  // setUp: function($super, run) {
  //     var self = this;
  //     this.origFileStatus = git.fileStatus;
  //     this.fileStatus = [];
  //     this.onTearDown(function() { git.fileStatus = self.origFileStatus; });
  //     git.fileStatus = function(dir, options, thenDo) {
  //       if (typeof dir === "function") { thenDo = dir; }
  //       else if (typeof options === "function") { thenDo = options; }
  //       thenDo(null, self.fileStatus);
  //     };
  //
  //     this.patchString = "diff --git a/test.txt b/test.txt\n"
  //                      + "index e42fd89..581f1fd 100644\n"
  //                      + "--- a/test.txt\n"
  //                      + "+++ b/test.txt\n"
  //                      + "@@ -2,3 +2,3 @@\n"
  //                      + " a\n"
  //                      + "-b\n"
  //                      + "+c\n"
  //                      + " d\n"
  //                      + "@@ -2,3 +2,3 @@\n"
  //                      + " a\n"
  //                      + "-b\n"
  //                      + "+c\n"
  //                      + " d\n"
  //                      + "diff --git a/test2.txt b/test2.txt\n"
  //                      + "index e42fd89..581f1fd 100644\n"
  //                      + "--- a/test2.txt\n"
  //                      + "+++ b/test2.txt\n"
  //                      + "@@ -2,3 +2,3 @@\n"
  //                      + " a\n"
  //                      + "-b\n"
  //                      + "+c\n"
  //                      + " d\n"
  //                      + "diff --git a/test3.txt b/test3.txt\n"
  //                      + "index e42fd89..581f1fd 100644\n"
  //                      + "--- a/test3.txt\n"
  //                      + "+++ b/test3.txt\n"
  //                      + "@@ -2,3 +2,3 @@\n"
  //                      + " u\n"
  //                      + "-v\n"
  //                      + "+w\n"
  //                      + " x\n";
  //     this.editor = $world.addCodeEditor({
  //       content: this.patchString,
  //       textMode: "diff"
  //     });
  //
  //     this.editor.withAceDo(function(ed) {
  //       lively.lang.fun.waitFor(3000,
  //         function() { return !!ed.commands.commands["lively.ide.git.stageAll"]; },
  //         run);
  //     });
  //
  //     this.focusedMorph = lively.morphic.Morph.focusedMorph();
  // },

  // tearDown: function(whenDone) {
  //   this.editor.getWindow().remove();
  //   if (this.focusedMorph) this.focusedMorph.focus();
  // },

  // assertCommandsMatch: function(specs, commands) {
  //   if (specs.length !== commands.length) this.assert(false, lively.lang.string.format("Unequal number of epxected and real commands: %s vs %s"), specs.length, commands.length);
  //   specs.forEach(function(spec, i) {
  //     var cmd = commands[i];
  //     if (!cmd.command) this.assert(false, lively.lang.string.format("Command has no cmd property: %o"), cmd);
  //     if (Object.isFunction(spec)) spec.call(this, cmd, i);
  //     else {
  //       var match = cmd.command.match(spec);
  //       if (!match) this.assert(false, lively.lang.string.format("Command %s %s does not match %s", i, cmd.command, spec));
  //     }
  //   }, this);
  // },

  //   it("stage all", function() {
  //     var err, commands;
  //
  //     this.fileStatus = [
  //       {fileName: "test.txt", status: "unstaged", change: "modified"},
  //       {fileName: "test2.txt", status: "unstaged", change: "modified"},
  //       {fileName: "test3.txt", status: "staged", change: "modified"}];
  //
  //     this.editor.aceEditor.execCommand("lively.ide.git.stageAll", {
  //       dryRun: true,
  //       thenDo: function(_err, fileObjects, _commands) { err = _err; commands = _commands; }
  //     });
  //
  //     this.waitFor(function() { return !!err || !!commands; }, 10, function() {
  //       this.assertCommandsMatch([/git.*add -- test.txt\s+test2.txt\s*$/], commands);
  //       this.done();
  //     });
  //   });
  //
  //   it("unstage all", function() {
  //     var err, commands;
  //
  //     this.fileStatus = [
  //       {fileName: "test.txt", status: "staged", change: "modified"},
  //       {fileName: "test.txt", status: "unstaged", change: "modified"}];
  //
  //     this.editor.aceEditor.execCommand("lively.ide.git.unstageAll", {
  //       dryRun: true,
  //       thenDo: function(_err, fileObjects, _commands) { err = _err; commands = _commands; }
  //     });
  //
  //     this.waitFor(function() { return !!err || !!commands; }, 10, function() {
  //       this.assertCommandsMatch([/git.*reset -- test.txt\s*$/], commands);
  //       this.done();
  //     });
  //   });
  //
  //   it("discard all", function() {
  //     var err, commands;
  //
  //     this.fileStatus = [
  //       {fileName: "test.txt", status: "staged", change: "modified"},
  //       {fileName: "test2.txt", status: "unstaged", change: "modified"}];
  //
  //     this.editor.aceEditor.execCommand("lively.ide.git.discardAll", {
  //       dryRun: true,
  //       thenDo: function(_err, fileObjects, _commands) { err = _err; commands = _commands; }
  //     });
  //
  //     this.waitFor(function() { return !!err || !!commands; }, 10, function() {
  //       this.assertCommandsMatch([
  //       /git.*reset -- test.txt\s+test2.txt\s*$/,
  //       /git.*checkout -- test.txt\s+test2.txt\s*$/], commands);
  //       this.done();
  //     });
  //   });
  //
  //   it("discard all", function() {
  //     var err, commands;
  //
  //     this.fileStatus = [
  //       {fileName: "test.txt", status: "staged", change: "modified"},
  //       {fileName: "test2.txt", status: "unstaged", change: "modified"}];
  //
  //     this.editor.aceEditor.execCommand("lively.ide.git.discardAll", {
  //       dryRun: true,
  //       thenDo: function(_err, fileObjects, _commands) { err = _err; commands = _commands; }
  //     });
  //
  //     this.waitFor(function() { return !!err || !!commands; }, 10, function() {
  //       this.assertCommandsMatch([
  //       /git.*reset -- test.txt\s+test2.txt\s*$/,
  //       /git.*checkout -- test.txt\s+test2.txt\s*$/], commands);
  //       this.done();
  //     });
  //   });
  //
  //   it("apply patches", function() {
  //     var test = this, testData = [{
  //       exec: "stageSelection",
  //       selection: {start: {row: 6, column: 0}, end: {row: 7, column: 2}},
  //       expectedCommands: ["git apply --cached -"],
  //       expectedPatches: ["diff --git a/test.txt b/test.txt\n"
  //               + "--- a/test.txt\n"
  //               + "+++ b/test.txt\n"
  //               + "@@ -2,3 +2,3 @@\n"
  //               + " a\n"
  //               + "-b\n"
  //               + "+c\n"
  //               + " d\n"]
  //     }, {
  //       exec: "unstageSelection",
  //       selection: {end: {column: 2,row: 21},start: {column: 0,row: 11}},
  //       expectedCommands: ["git apply --reverse --cached -"],
  //       expectedPatches: ["diff --git a/test.txt b/test.txt\n"
  //               + "--- a/test.txt\n"
  //               + "+++ b/test.txt\n"
  //               + "@@ -2,3 +2,3 @@\n"
  //               + " a\n"
  //               + "-b\n"
  //               + "+c\n"
  //               + " d\n"
  //               + "\n"
  //               + "diff --git a/test2.txt b/test2.txt\n"
  //               + "--- a/test2.txt\n"
  //               + "+++ b/test2.txt\n"
  //               + "@@ -2,3 +2,3 @@\n"
  //               + " a\n"
  //               + "-b\n"
  //               + "+c\n"
  //               + " d\n"]
  //     },
  //     {
  //       exec: "discardSelection",
  //       selection: {start: {row: 6, column: 0}, end: {row: 7, column: 2}},
  //       expectedCommands: ["git apply --reverse --cached -", "git apply --reverse -"],
  //       expectedPatches: ["diff --git a/test.txt b/test.txt\n"
  //               + "--- a/test.txt\n"
  //               + "+++ b/test.txt\n"
  //               + "@@ -2,3 +2,3 @@\n"
  //               + " a\n"
  //               + "-b\n"
  //               + "+c\n"
  //               + " d\n",
  //               "diff --git a/test.txt b/test.txt\n"
  //               + "--- a/test.txt\n"
  //               + "+++ b/test.txt\n"
  //               + "@@ -2,3 +2,3 @@\n"
  //               + " a\n"
  //               + "-b\n"
  //               + "+c\n"
  //               + " d\n"]
  //     }
  //     ];
  //
  //     var done = false;
  //     lively.lang.arr.mapAsyncSeries(testData,
  //       function(data, _, n) {
  //       var err, commands;
  //
  //       .editor.setSelectionRangeAce(data.selection);
  //
  //       .editor.aceEditor.execCommand("lively.ide.git." + data.exec, {
  //         dryRun: true,
  //         thenDo: function(_err, fileObjects, _commands) { err = _err; commands = _commands; }
  //       });
  //
  //       .waitFor(function() { return !!err || !!commands; }, 10, function() {
  //         err && this.assert(false, String(err.stack));
  //         var expected = data.expectedCommands.map(function(_, i) {
  //         return function(cmd) {
  //           this.assertEquals(data.expectedCommands[i], cmd.command);
  //           this.assertEquals(data.expectedPatches[i], cmd.options.stdin);
  //         }
  //         })
  //         this.assertCommandsMatch(expected, commands);
  //         n(null);
  //       });
  //       }, function(err, results) { done = true; });
  //
  //     this.waitFor(function() { return !!done; }, 10, function() { this.done(); });
  //   });

});
