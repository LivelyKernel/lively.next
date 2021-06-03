import { obj } from 'lively.lang';

let eslint = { verify () { return []; } };

(async function loadEslint () {
  // SystemJS tries to load it as cjs which fails, global works.
  // In order to configure that correctly the format statement needs to go into
  // a package config. I don't want to add this to lively.morphic as the js ide
  // package will be split off later anyway
  let eslintURL = System.decanonicalize('lively.ide/js/eslint/eslint-browserified.js');
  // lively.modules.module(eslintURL).unload();
  System.config({ meta: { [eslintURL]: { format: 'global' } } });
  ({ eslint } = await System.import(eslintURL));
})();

let indentRule = ['warn', 2, { VariableDeclarator: { var: 2, let: 2, const: 3 } }];

let baseConfig = {
  env: {
    browser: true,
    node: true,
    es6: true
  },
  parserOptions: {
    sourceType: 'module',
    ecmaVersion: '2017',
    ecmaFeatures: {
      experimentalObjectRestSpread: true
    }
  },
  globals: { $world: true }
};

let config = {
  ...baseConfig,
  extends: 'eslint:recommended',
  rules: {
    indent: indentRule,
    'linebreak-style': ['error', 'unix'],
    'no-unused-vars': ['warn'],
    quotes: ['warn', 'double'],
    semi: ['error', 'always'],
    'no-console': 'off'
  }
};

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

import { string, arr } from 'lively.lang';
import { serverInterfaceFor } from 'lively-system-interface';
import { resource } from 'lively.resources/index.js';

export default class ESLinter {
  static reportOnMorph (morph, options) { return new this().reportOnMorph(morph, options); }
  static fixMorph (textMorph, range, options) { return new this().fixMorph(textMorph, range, options); }
  static previewFixesOnMorph (textMorph, options) { return new this().previewFixesOnMorph(textMorph, options); }
  static runOnSource (source, options) { return new this().runOnSource(source, options); }

  get system () { return serverInterfaceFor(resource(document.location.origin).join('eval').url); }

  async withTempFileDo (doFn, nameHint) {
    let tmpDirPath = (await this.system.runEval("System._nodeRequire('os').tmpdir()",
      { targetModule: 'lively://eslint-helper' })).value;
    let tmpDir = await resource(tmpDirPath).join('eslint-helper/').ensureExistance();
    let filename = nameHint || `${string.newUUID().split('-')[0]}.js`;
    let file = tmpDir.join(filename);
    try {
      return await doFn(file);
    } finally { await file.remove(); }
  }

  runOnSource (source, options = {}) {
    let report = eslint.verify(source, config, obj.select(options, ['filename']));
    let fixed = options.fix ? this.fixUntilThereAreNoFixes(source, options) : null;

    let errCount = report.reduce((result, { severity }) => {
      result[severity === 2 ? 'nErrors' : 'nWarnings']++;
      return result;
    }, { nErrors: 0, nWarnings: 0 });

    return { fixed, report, ...errCount };
  }

  fixUntilThereAreNoFixes (source, options) {
    // fixing one issue can result in another fix being necessary later, e.g.
    // with indent changes. Run fixes in a loop until source doesn't change again.
    // Assumes eslint is convergent...

    options = obj.select(options, ['filename']);

    let counter = 0;
    while (true) {
      if (counter++ > 1000) throw new Error('eslint fixer runs in a loop');

      let report = eslint.verify(source, config, options);
      let foundFix = false; let fixConfig = { rules: {} };

      for (let i = report.length; i--;) {
        let { ruleId, fix } = report[i];
        if (!fix) continue;
        let { range: [start, end], text } = fix;
        foundFix = true;
        source = source.slice(0, start) + text + source.slice(end);
      }

      if (!foundFix) break;
    }

    return source;
  }

  showEslintReportFor (textMorph, { nErrors, nWarnings, report }) {
    if (nErrors == 0 && nWarnings == 0) return $world.inform('eslint found no issues');

    let items = report.map(ea => {
      let kind = ea.severity === 2 ? 'error' : 'warning';
      return {
        isListItem: true,
        string: `${ea.line} ${ea.message} (${kind} - ${ea.ruleId})`,
        value: ea
      };
    });

    return $world.filterableListPrompt(
      `eslint found ${nErrors} errors and ${nWarnings} warnings:`, items)
      .then(({ selected: [choice] }) => {
        if (!choice) return;
        let pos = { row: choice.line - 1, column: choice.column - 1 };
        // var end = that.indexToPosition(that.positionToIndex(start) + choice.source.length);
        textMorph.cursorPosition = pos;
        textMorph.flash({ start: { row: pos.row, column: 0 }, end: { row: pos.row + 1, column: 0 } });
        textMorph.centerRow();
      });
  }

  reportOnMorph (textMorph, options) {
    let eslintOutput = this.runOnSource(textMorph.textString, options);
    this.showEslintReportFor(textMorph, eslintOutput);
    return eslintOutput;
  }

  async previewFixesOnMorph (textMorph, options) {
    let { fixed } = await this.runOnSource(textMorph.textString, { ...options, fix: true });
    if (!fixed) return $world.inform('eslint did not apply fixes');
    $world.execCommand('diff and open in window', {
      title: 'eslint fixes for ' + textMorph,
      a: textMorph.textString,
      b: fixed,
      format: 'patch'
    });
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  async fixMorph (textMorph, range, options) {
    let { fixed } = await this.runOnSource(textMorph.textString, { ...options, fix: true });
    if (!fixed) return $world.inform('eslint did not apply fixes');
    return this.applyFixed(textMorph, fixed, range);
  }

  applyFixed (textMorph, fixedSource, range) {
    let replacedRange;
    textMorph.undoManager.group();
    textMorph.saveExcursion(() => {
      if (range) {
        let { start, end } = range;
        let fixedLines = string.lines(fixedSource).slice(start.row, end.row + 1);
        textMorph.replace({ start: { row: start.row, column: 0 }, end: { column: 0, row: end.row + 1 } }, fixedLines.join('\n') + '\n');
        replacedRange = { start, end: { column: arr.last(fixedLines).length, row: end.row } };
      } else {
        textMorph.textString = fixedSource;
        replacedRange = { start: { column: 0, row: 0 }, end: textMorph.documentEndPosition };
      }
    });
    textMorph.undoManager.group();
    return { replacedRange };
  }
}
