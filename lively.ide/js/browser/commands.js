import { arr, obj } from 'lively.lang';
import { Icon } from 'lively.morphic';
import { interactivelyFreezeModule } from 'lively.freezer';

function isMarkdown (m) {
  return m.type === 'md';
}

export default function browserCommands (browser) {
  const world = browser.world();

  async function runTestsInModule (browser, moduleName, spec) {
    let runner = browser.get('test runner window');
    if (!runner) { runner = await world.execCommand('open test runner'); }
    if (runner.minimized) { runner.toggleMinimize(); }
    runner.bringToFront();
    runner = runner.getWindow().targetMorph;

    if (runner.systemInterface !== browser.systemInterface) { runner.systemInterface = browser.systemInterface; }

    return spec
      ? runner[spec.type === 'suite' ? 'runSuite' : 'runTest'](spec.fullTitle)
      : runner.runTestFile(moduleName);
  }

  async function runTestsInPackage (browser, packageURL) {
    let runner = browser.get('test runner window');
    if (!runner) { runner = await world.execCommand('open test runner'); }
    if (runner.minimized) { runner.toggleMinimize(); }

    runner = runner.getWindow().targetMorph;

    if (runner.systemInterface !== browser.systemInterface) { runner.systemInterface = browser.systemInterface; }

    return runner.runTestsInPackage(packageURL);
  }

  return [
    {
      name: 'focus list with selection',
      exec: () => browser.focusColumnView()
    },
    {
      name: 'open new tab',
      exec: async () => {
        if (browser.hasUnsavedChanges()) {
          const proceed = await browser.warnForUnsavedChanges();
          if (!proceed) return;
        }
        browser.ui.tabs.addTab('New Browser Tab');
      }
    },
    { name: 'focus source editor', exec: () => { browser.focusSourceEditor(); return true; } },

    {
      name: 'resize editor panel',
      exec: () => {
        const { ui: { hresizer } } = browser;
        const ratio = hresizer.getRelativeDivide();
        const newRatio = ratio > 0.39 ? 0.15 : 0.4;
        hresizer.divideRelativeToParent(newRatio);
        return true;
      }
    },

    { name: 'browser history backward', exec: browser => { browser.historyBackward(); return true; } },
    { name: 'browser history forward', exec: browser => { browser.historyForward(); return true; } },

    { name: 'browser save', exec: browser => { return browser.save(); } },

    {
      name: 'jump to codeentity',
      exec: async browser => {
        const { editorPlugin: { textMorph: ed } } = browser;
        if (browser.isTestModule(ed.textString)) { return browser.execCommand('jump to test'); }
        if (isMarkdown(browser.selectedModule)) {
          return ed.execCommand('[markdown] goto heading');
        }

        const codeEntities = browser.renderedCodeEntities();
        const currentIdx = codeEntities.map(m => m.name).indexOf(browser.selectedCodeEntity && browser.selectedCodeEntity.name);
        const items = codeEntities.map((def) => {
          const { name, type, parent } = def;
          return {
            isListItem: true,
            label: [
                  `${parent ? parent.name + '>>' : ''}${name}`, null,
                  `${type}`, { fontSize: '70%', textStyleClasses: ['annotation'] }
            ],
            value: def
          };
        });
        const { selected: [choice] } = await browser.world().filterableListPrompt(
          'Select item', items,
          {
            preselect: currentIdx,
            requester: browser,
            historyId: 'js-browser-codeentity-jump-hist'
          });
        if (choice) {
          ed.saveMark();
          browser.selectCodeEntity(choice);
        }
        return true;
      }
    },

    {
      name: 'jump to test',
      exec: async browser => {
        const { selectedModule: m, editorPlugin: { textMorph: ed } } = browser;
        if (!m) return true;

        const source = ed.textString;
        const items = []; const testsByFile = [];
        const lines = source.split('\n');
        const { cursorPosition: { row: currentRow } } = ed;
        let preselect = 0;

        const { loadTestModuleAndExtractTestState } = await System.import('mocha-es6');

        await loadTestModuleAndExtractTestState(m.url, testsByFile);
        const tests = testsByFile[0].tests.filter(ea => ea.fullTitle);
        for (let i = 0; i < tests.length; i++) {
          const value = tests[i];
          const { depth, fullTitle, title, type } = value;
          const fnName = type === 'suite' ? 'describe' : 'it';
          const row = value.row = lines.findIndex(
            line => line.match(new RegExp(`${fnName}.*".*${title}.*"`)));
          if (row <= currentRow) preselect = i;
          items.push({
            isListItem: true,
            value,
            label: [
              `${'\u2002'.repeat(depth - 1)}${fullTitle}`, null,
              `line ${row} ${type}`, { fontSize: '70%', textStyleClasses: ['annotation'] }
            ]
          });
        }
        const { selected: [choice] } = await browser.world().filterableListPrompt(
          `tests of ${m.nameInPackage}`, items, {
            requester: browser,
            preselect
          });
        if (choice) {
          ed.saveMark();
          ed.cursorPosition = { row: choice.row, column: 0 };
          ed.execCommand('goto line start');
          ed.centerRow(choice.row);
        }
        return true;
      }
    },

    {
      name: 'browser history browse',
      exec: browser => {
        return browser.interactivelyBrowseHistory();
      }
    },

    {
      name: 'open code search',
      exec: browser => browser.world().execCommand('open code search', { browser })
    },

    {
      name: 'choose and browse package resources',
      exec: browser => browser.world().execCommand('choose and browse package resources', { browser })
    },

    {
      name: 'choose and browse module',
      exec: browser => browser.world().execCommand('choose and browse module', { browser })
    },

    {
      name: 'reload module',
      exec: async (_, opts = { hard: false }) => {
        const result = await browser.reloadModule(opts.hard);
        if (!result) { return browser.world().inform('No module selected', { requester: browser }); }
        if (result instanceof Error) { return browser.world().inform(result.message, { requester: browser }); }
        browser.setStatusMessage(`Reloaded ${result.name}`);
        return true;
      }
    },

    {
      name: 'load or add module',
      exec: async (browser, opts = {}) => {
        const p = browser.selectedPackage;
        const m = browser.selectedModule;
        const system = browser.systemInterface;
        let mods;
        try {
          mods = await system.interactivelyAddModule(browser, m ? m.name : p ? p.address : null);
        } catch (e) {
          e === 'Canceled'
            ? browser.setStatusMessage(e)
            : browser.world().inform(`Error while trying to load modules:\n${e.stack || e}`, { requester: browser });
          return;
        }

        mods.forEach(({ name, error }) =>
          error
            ? browser.showError(`Error while loading module ${name}: ${error.stack || error}`)
            : browser.setStatusMessage(`Module ${name} loaded`));
        await browser.updateModuleList(p);
        mods.length && browser.selectModuleNamed(mods[0].name);
        return true;
      }
    },

    {
      name: 'create new folder',
      exec: async (browser, opts = {}) => {
        const { dir } = opts;
        return await browser.interactivelyCreateNewFolder(dir);
      }
    },

    {
      name: 'create new module',
      exec: async (browser, opts = {}) => {
        const { dir, type } = opts;
        return await browser.interactivelyAddNewModule(dir, type);
      }
    },

    {
      name: 'remove selected entity',
      exec: (browser, opts = {}) => {
        const { dir } = opts;
        return browser.interactivelyRemoveSelectedItem(dir);
      }
    },

    {
      name: 'remove module',
      exec: async (browser, opts = {}) => {
        const p = browser.selectedPackage;
        const m = opts.mod || browser.selectedModule;
        const system = browser.systemInterface;
        if (!p) return browser.world().inform('No package selected', { requester: browser });
        if (!m) return browser.world().inform('No module selected', { requester: browser });
        try {
          await system.interactivelyRemoveModule(browser, m.url || m.name || m.id);
        } catch (e) {
          if (e !== 'Canceled') browser.showError(`Error while trying to load modules:\n${e.stack || e}`);
          return true;
        }

        await browser.updateModuleList(m);

        return true;
      }
    },

    {
      name: 'add package',
      exec: async (browser) => {
        const what = await browser.world().multipleChoicePrompt(
          'Add Package',
          {
            requester: browser,
            choices: new Map([
              [[...Icon.textAttribute('cube'), ' Create New Package', {}], 'Create New Package'],
              [[...Icon.textAttribute('external-link-alt'), ' Load Existing Package', {}], 'Load Existing Package']
            ])
          });

        if (!what || what === 'Cancel') {
          return true;
        }

        let pkg;
        try {
          const system = browser.systemInterface;
          pkg = what === 'Create New Package'
            ? await system.interactivelyCreatePackage(browser)
            : await system.interactivelyLoadPackage(
              browser, browser.selectedPackage ? browser.selectedPackage.address : null);
        } catch (e) {
          if (e === 'Canceled') {

          } else throw e;
          return true;
        }

        await browser.selectPackageNamed(pkg.name, true);
        return true;
      }
    },

    {
      name: 'remove package',
      exec: async (browser) => {
        const p = browser.selectedPackage;
        if (!p) { browser.world().inform('No package selected', { requester: browser }); return true; }

        try {
          await browser.systemInterface.interactivelyRemovePackage(browser, p.address);
        } catch (e) {
          if (e !== 'Canceled') throw e;
          return true;
        }

        await browser.selectPackageNamed(null, true);

        return true;
      }
    },

    {
      name: 'show imports and exports of package',
      exec: async browser => {
        const system = browser.systemInterface;
        const packages = await system.getPackages();

        const items = packages.map(ea => {
          return {
            isListItem: true,
            label: [
              `${ea.name}`, null,
              `${ea.url}`, { paddingLeft: '5px', fontSize: '70%', textStyleClasses: ['annotation'] }
            ],
            value: ea
          };
        });

        const { selected } = await browser.world().filterableListPrompt('Choose package(s)', items, {
          multiselect: true,
          requester: browser,
          historyId: 'lively.ide.js-browser-choose-package-for-showing-export-imports-hist'
        });

        await Promise.all(selected.map(ea => system.showExportsAndImportsOf(ea.url)));
        return true;
      }
    },

    {
      name: 'open browse snippet',
      exec: browser =>
        browser.world().execCommand('open workspace',
          { content: browser.browseSnippetForSelection(), language: 'javascript' })
    },

    {
      name: 'open selected module in text editor',
      exec: (browser, opts = {/* module: null, codeEntity: null */}) => {
        const m = opts.module || browser.selectedModule;
        let c = opts.hasOwnProperty('codeEntity') ? opts.codeEntity : browser.selectedCodeEntity;
        if (obj.isArray(c)) c = c[0];
        if (!m) {
          browser.world().inform('No module selected / specified!', { requester: browser, autoWidth: true });
          return true;
        }
        const lineNumber = c ? browser.editorPlugin.textMorph.indexToPosition(c.node.start).row : null;
        let url = m.url;
        if (url.startsWith('file://')) url = url.replace('file://', ''); // FIXME
        return browser.world().execCommand('open file', { url, lineNumber });
      }
    },

    {
      name: 'run all tests in package',
      exec: async browser => {
        const p = browser.selectedPackage;
        if (!p) return browser.world().inform('No package selected', { requester: browser });
        const results = await runTestsInPackage(browser, p.name);
        browser.focus();
        return results;
      }
    },

    {
      name: 'run all tests in module',
      exec: async browser => {
        const m = browser.selectedModule;
        if (!m) return browser.world().inform('No module selected', { requester: browser });
        const results = await runTestsInModule(browser, m.url, null);
        browser.focus();
        return results;
      }
    },

    {
      name: 'run tests at point',
      exec: async (browser) => {
        const m = browser.selectedModule;
        if (!m) return browser.world().inform('No module selected', { requester: browser });

        const ed = browser.get('sourceEditor');
        const { extractTestDescriptors } = await System.import('mocha-es6/test-analysis.js');
        const testDescriptors = await extractTestDescriptors(
          ed.textString, ed.document.positionToIndex(ed.cursorPosition));

        if (!testDescriptors || !testDescriptors.length) {
          return browser.world().inform(
            'No test at ' + JSON.stringify(ed.cursorPosition),
            { requester: browser });
        }

        const spec = {
          fullTitle: arr.pluck(testDescriptors, 'title').join(' '),
          type: arr.last(testDescriptors).type,
          file: m.name
        };

        const results = await runTestsInModule(browser, m.name, spec);
        browser.focus();
        return results;
      }
    },

    {
      name: 'run setup code of tests (before and beforeEach)',
      exec: async (browser, args = { what: 'setup' }) => {
        const m = browser.selectedModule;
        if (!m) return browser.world().inform('No module selected', { requester: browser });

        const ed = browser.get('sourceEditor');
        const { extractTestDescriptors } = await System.import('mocha-es6/test-analysis.js');
        const testDescriptors = await extractTestDescriptors(
          ed.textString, ed.document.positionToIndex(ed.cursorPosition));

        if (!testDescriptors || !testDescriptors.length) {
          return browser.world().inform(
            'No test at ' + JSON.stringify(ed.cursorPosition),
            { requester: browser });
        }

        // the stringified body of all before(() => ...) or after(() => ...) calls
        const what = (args && args.what) || 'setup'; // or: teardown
        const prop = what === 'setup' ? 'setupCalls' : 'teardownCalls';
        let nCalls = 0;
        const beforeCode = testDescriptors.flatMap(descr => {
          return descr[prop].map((beforeFn, i) => {
            nCalls++;
            return `await ((${lively.ast.stringify(beforeFn)})());`;
          });
        }).join('\n');

        try {
          await browser.systemInterface.runEval(beforeCode, { ...ed.evalEnvironment });
          browser.setStatusMessage(`Executed ${nCalls} test ${what} functions`);
        } catch (e) {
          browser.showError(new Error(`Error when running ${what} calls of test:\n${e.stack}`));
        }

        return true;
      }
    },

    {
      name: 'run teardown code of tests (after and afterEach)',
      exec: async (browser) =>
        browser.execCommand(
          'run setup code of tests (before and beforeEach)',
          { what: 'teardown' })
    },

    {
      name: 'freeze selected module',
      doc: 'Enters the freeze prompt which allows the user to configure and execute a build for the currently selected module. The resulting bundle will execute the specified main() method in the current module and pass the default world object as a parameter. This allows us to bundle apps in lively without snapshots.',
      exec: async (browser) => {
        interactivelyFreezeModule(browser.selectedModule.url, browser);
      }
    }
  ];
}
