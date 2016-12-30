import { string, arr } from "lively.lang";
import { runCommand } from "lively.morphic/ide/shell/shell-interface.js";
import { serverInterfaceFor } from "lively-system-interface";
import { resource } from "lively.resources/index.js";

// var x = await ESLinter.runOnSource("var x = 23,\n y = 2;")
// var x = await ESLinter.reportOnMorph(that, {fix: false})
// var x = await ESLinter.reportOnMorph(that, {fix: true})
// await new ESLinter().showEslintReportFor(that, x.report)
// x.report
// x.fixed

// $world.execCommand("diff and open in window", {a: that.textString, b: x.fixed, format: "patch"})
// $world.execCommand("diff and open in window", {a: that.textString, b: x.fixed, format: "patch"})


export default class ESLinter {

  static reportOnMorph(morph, options) { return new this().reportOnMorph(morph, options); }
  static fixMorph(textMorph, range, options) { return new this().fixMorph(textMorph, range, options); }
  static previewFixesOnMorph(textMorph, options) { return new this().previewFixesOnMorph(textMorph, options); }
  static runOnSource(source, options) { return new this().runOnSource(source, options); }

  get system() { return serverInterfaceFor(resource(document.location.origin).join("eval").url); }

  async withTempFileDo(doFn, nameHint) {
    var tmpDirPath = (await this.system.runEval("System._nodeRequire('os').tmpdir()",
        {targetModule: "lively://eslint-helper"})).value,
    tmpDir = await resource(tmpDirPath).join("eslint-helper/").ensureExistance(),
    filename = nameHint || `${string.newUUID().split("-")[0]}.js`,
    file = tmpDir.join(filename);
    try {
      return await doFn(file);
    } finally { await file.remove(); }
  }
  
  async runOnSource(source, options = {}) {
    
    var fix = options.fix ? "--fix" : "",
        fixed, report;

    await this.withTempFileDo(async file => {
      await file.write(source);
      var out = (await runCommand(`eslint ${fix} --format json ${file.url}`).whenDone()).output;
      report = JSON.parse(out);
      fixed = fix ? await file.read() : null;
    });

    if (fixed === source) fixed = null;

    return {fixed, report};
  }

  applyFixed(textMorph, fixedSource, range) {
    var replacedRange;
    textMorph.undoManager.group();
    textMorph.saveExcursion(() => {
      if (range) {
        var {start, end} = range;
        var fixedLines = string.lines(fixedSource).slice(start.row, end.row+1);
        textMorph.replace({start: {row: start.row, column: 0}, end: {column: 0, row: end.row + 1}}, fixedLines.join("\n") + "\n");
        replacedRange = {start, end: {column: arr.last(fixedLines).length, row: end.row}};
      } else {
        textMorph.textString = fixedSource;
        replacedRange = {start: {column: 0, row: 0}, end: textMorph.documentEndPosition};
      }
    })
    textMorph.undoManager.group();
    return {replacedRange};
  }
  
  async showEslintReportFor(textMorph, report, fixedSource) {
    var nErrors = report[0].errorCount;
    var nWarnings = report[0].messages.length - nErrors;
    if (nErrors == 0 && nWarnings == 0) return $world.inform("eslint found no issues");

    var items = report[0].messages.map(ea => {
      var kind = ea.severity === 2 ? "error" : "warning";
      return {
        isListItem: true,
        string: `${ea.line} ${ea.message} (${kind} - ${ea.ruleId})`,
        value: ea
      }
    })

    var {selected: [choice]} = await $world.filterableListPrompt(`eslint found ${nErrors} errors and ${nWarnings} warnings:`, items)
    if (!choice) return;

    var pos = {row: choice.line-1, column: choice.column-1};
    // var end = that.indexToPosition(that.positionToIndex(start) + choice.source.length);
    textMorph.cursorPosition = pos;
    textMorph.flash({start: {row: pos.row, column: 0}, end: {row: pos.row+1, column: 0}})
    textMorph.centerRow();

  }

  async reportOnMorph(textMorph, options) {
    var {fixed, report} = await this.runOnSource(textMorph.textString, options);
    await this.showEslintReportFor(textMorph, report, fixed);
    return {fixed, report};
  }

  async previewFixesOnMorph(textMorph, options) {
    var {fixed, report} = await this.runOnSource(textMorph.textString, {...options, fix: true});
    if (!fixed) return $world.inform("eslint did not apply fixes");
    $world.execCommand("diff and open in window", {
      title: "eslint fixes for " + textMorph,
      a: textMorph.textString,
      b: fixed,
      format: "patch"
    })
  }

  async fixMorph(textMorph, range, options) {
    var {fixed, report} = await this.runOnSource(textMorph.textString, {...options, fix: true});
    if (!fixed) return $world.inform("eslint did not apply fixes");
    return this.applyFixed(textMorph, fixed, range);
  }

}
