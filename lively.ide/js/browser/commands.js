import { arr } from 'lively.lang';
import { Icon } from 'lively.morphic';

function isTestModule (m, source) {
  return m && source.match(/import.*['"]mocha(-es6)?['"]/) && source.match(/it\(['"]/);
}

export default function browserCommands (browser) {
  const pList = browser.get('packageList');
  const mList = browser.get('moduleList');
  const codeEntityTree = browser.get('codeEntityTree');
  const editor = browser.get('sourceEditor');
  const world = browser.world();

  return [
    {
      name: 'focus list with selection',
      exec: () =>
        focusList(codeEntityTree.selection
          ? codeEntityTree
          : mList.selection ? mList : pList)
    },
    { name: 'focus code entities', exec: () => focusList(codeEntityTree) },
    { name: 'focus package list', exec: () => focusList(pList) },
    { name: 'focus module list', exec: () => focusList(mList) },
    { name: 'focus source editor', exec: () => { editor.focus(); editor.show(); return true; } },

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
        if (isTestModule(browser.selectedModule, browser.ui.sourceEditor.textString)) { return browser.execCommand('jump to test'); }

        const codeEntities = browser.ui.codeEntityTree.treeData.defs;
        const currentIdx = codeEntities.indexOf(browser.ui.codeEntityTree.selection);
        const items = codeEntities.map(def => {
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
          browser.ui.sourceEditor.saveMark();
          browser.selectCodeEntity(choice);
        }
        return true;
      }
    },

    {
      name: 'jump to test',
      exec: async browser => {
        const { selectedModule: m, ui: { sourceEditor } } = browser;
        if (!m) return true;

        const source = sourceEditor.textString;
        const items = []; const testsByFile = [];
        const lines = source.split('\n');
        const { cursorPosition: { row: currentRow } } = sourceEditor;
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
          sourceEditor.saveMark();
          sourceEditor.cursorPosition = { row: choice.row, column: 0 };
          sourceEditor.execCommand('goto line start');
          sourceEditor.centerRow(choice.row);
        }
        return true;
      }
    },

    {
      name: 'browser history browse',
      exec: async browser => {
        const { left, right } = browser.state.history;
        const current = arr.last(left);
        const currentIdx = left.indexOf(current);

        const items = left.concat(right).map(loc => ({
          isListItem: true,
          string: loc.module
            ? loc.module.nameInPackage
            : loc.package
              ? loc.package.name || loc.package.address
              : 'strange location',
          value: loc
        }));

        const { selected: [choice] } = await browser.world().filterableListPrompt(
          'Jumpt to location', items, { preselect: currentIdx, requester: browser });
        if (choice) {
          if (left.includes(choice)) {
            browser.state.history.left = left.slice(0, left.indexOf(choice) + 1);
            browser.state.history.right = left.slice(left.indexOf(choice) + 1).concat(right);
          } else if (right.includes(choice)) {
            browser.state.history.left = left.concat(right.slice(0, right.indexOf(choice) + 1));
            browser.state.history.right = right.slice(right.indexOf(choice) + 1);
          }
          if (current) {
            const { scroll, cursor } = browser.historyGetLocation();
            current.scroll = scroll; current.cursor = cursor;
          }
          await browser.historySetLocation(choice);
        }

        return true;
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
      exec: async (browser) => {
        const p = browser.selectedPackage;
        const m = browser.selectedModule;
        const system = browser.systemInterface;

        try {
          var mods = await system.interactivelyAddModule(browser, m ? m.name : p ? p.address : null);
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
      name: 'remove module',
      exec: async (browser) => {
        const p = browser.selectedPackage;
        const m = browser.selectedModule;
        const system = browser.systemInterface;
        if (!p) return browser.world().inform('No package selected', { requester: browser });
        if (!m) return browser.world().inform('No module selected', { requester: browser });
        try {
          await system.interactivelyRemoveModule(browser, m.name || m.id);
        } catch (e) {
          e === 'Canceled'
            ? browser.world().inform('Canceled module removal')
            : browser.showError(`Error while trying to load modules:\n${e.stack || e}`);
          return true;
        }

        await browser.updateModuleList(p);
        p && browser.selectPackageNamed(p.name);

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
            browser.world().inform('Canceled package creation', {
              requester: browser, lineWrapping: false
            });
          } else throw e;
          return true;
        }

        await browser.selectPackageNamed(pkg.name);
        return true;
      }
    },

    {
      name: 'remove package',
      exec: async (browser) => {
        const p = browser.selectedPackage;
        if (!p) { browser.world().inform('No package selected'); return true; }

        try {
          const pkg = await browser.systemInterface.interactivelyRemovePackage(browser, p.address);
        } catch (e) {
          if (e === 'Canceled') browser.world().inform('Canceled package removel');
          else throw e;
          return true;
        }

        await browser.selectPackageNamed(null);

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
              `${ea.url}`, { fontSize: '70%', textStyleClasses: ['annotation'] }
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
        const c = opts.hasOwnProperty('codeEntity') ? opts.codeEntity : browser.selectedCodeEntity;
        if (!m) {
          browser.setStatusMessage('No module selected / specified');
          return true;
        }
        const lineNumber = c ? browser.ui.sourceEditor.indexToPosition(c.node.start).row : null;
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
        const results = await runTestsInModule(browser, m.name, null);
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
        const beforeCode = arr.flatmap(testDescriptors, descr => {
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
    }
  ];

  function focusList (list) {
    list.scrollSelectionIntoView();
    list.update();
    list.show();
    list.focus();
    return list;
  }

  async function runTestsInModule (browser, moduleName, spec) {
    let runner = browser.get('test runner window');
    if (!runner) { runner = await world.execCommand('open test runner'); }
    if (runner.minimized) { runner.toggleMinimize(); }

    runner = runner.getWindow().targetMorph;

    if (runner.systemInterface != browser.systemInterface) { runner.systemInterface = browser.systemInterface; }

    return spec
      ? runner[spec.type === 'suite' ? 'runSuite' : 'runTest'](spec.fullTitle)
      : runner.runTestFile(moduleName);
  }

  async function runTestsInPackage (browser, packageURL) {
    let runner = browser.get('test runner window');
    if (!runner) { runner = await world.execCommand('open test runner'); }
    if (runner.minimized) { runner.toggleMinimize(); }

    runner = runner.getWindow().targetMorph;

    if (runner.systemInterface != browser.systemInterface) { runner.systemInterface = browser.systemInterface; }

    return runner.runTestsInPackage(packageURL);
  }
}
