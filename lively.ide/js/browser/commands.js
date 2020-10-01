import { arr } from "lively.lang";
import { extractTestDescriptors } from "mocha-es6/test-analysis.js";
import { loadTestModuleAndExtractTestState } from "mocha-es6";
import { Icon } from "lively.morphic";

function isTestModule(m, source) {
  return m && source.match(/import.*['"]mocha(-es6)?['"]/) && source.match(/it\(['"]/);
}

export default function browserCommands(browser) {
  var pList = browser.get("packageList"),
      mList = browser.get("moduleList"),
      codeEntityTree = browser.get("codeEntityTree"),
      editor = browser.get("sourceEditor"),
      world = browser.world();

  return [
    {name: "focus list with selection", exec: () =>
      focusList(codeEntityTree.selection ? codeEntityTree :
        mList.selection ? mList : pList)},
    {name: "focus code entities", exec: () => focusList(codeEntityTree)},
    {name: "focus package list", exec: () => focusList(pList)},
    {name: "focus module list", exec: () => focusList(mList)},
    {name: "focus source editor", exec: () => { editor.focus(); editor.show(); return true; }},

    {
      name: "resize editor panel",
      exec: () => {
        let {ui: {hresizer}} = browser,
            ratio = hresizer.getRelativeDivide(),
            newRatio = ratio > .39 ? .15 : .4;
        hresizer.divideRelativeToParent(newRatio);
        return true;
      }
    },

    {name: "browser history backward", exec: browser => { browser.historyBackward(); return true; }},
    {name: "browser history forward", exec: browser => { browser.historyForward(); return true; }},

    {name: "browser save", exec: browser => { return browser.save(); }},

    {
      name: "jump to codeentity",
      exec: async browser => {
        if (isTestModule(browser.selectedModule, browser.ui.sourceEditor.textString))
          return browser.execCommand("jump to test");

        var codeEntities = browser.ui.codeEntityTree.treeData.defs,
            currentIdx = codeEntities.indexOf(browser.ui.codeEntityTree.selection),
            items = codeEntities.map(def => {
              var {name, type, parent} = def;
              return {
                isListItem: true,
                label: [
                  `${parent ? parent.name + ">>" : ""}${name}`, null,
                  `${type}`, {fontSize: "70%", textStyleClasses: ["annotation"]}
                ],
                value: def
              };
            }),
            {selected: [choice]} = await browser.world().filterableListPrompt(
              "Select item", items,
              {
                preselect: currentIdx,
                requester: browser,
                historyId: "js-browser-codeentity-jump-hist"
              });
        if (choice) {
          browser.ui.sourceEditor.saveMark();
          browser.selectCodeEntity(choice);
        }
        return true;
      }
    },

    {
      name: "jump to test",
      exec: async browser => {
        let {selectedModule: m, ui: {sourceEditor}} = browser;
        if (!m) return true;

        let source = sourceEditor.textString,
            items = [], testsByFile = [],
            lines = source.split("\n"),
            {cursorPosition: {row: currentRow}} = sourceEditor,
            preselect = 0;

        await loadTestModuleAndExtractTestState(m.url, testsByFile);
        let tests = testsByFile[0].tests.filter(ea => ea.fullTitle);
        for (let i = 0; i < tests.length; i++) {
          let value = tests[i],
              {depth, fullTitle, title, type} = value,
              fnName = type === "suite" ? "describe" : "it",
              row = value.row = lines.findIndex(
                line => line.match(new RegExp(`${fnName}.*".*${title}.*"`)));
          if (row <= currentRow) preselect = i;
          items.push({
            isListItem: true,
            value,
            label: [
              `${"\u2002".repeat(depth-1)}${fullTitle}`, null,
              `line ${row} ${type}`, {fontSize: "70%", textStyleClasses: ["annotation"]}
            ]
          });
        }
        let {selected: [choice]} = await browser.world().filterableListPrompt(
          `tests of ${m.nameInPackage}`, items, {
            requester: browser,
            preselect
          });
        if (choice) {
          sourceEditor.saveMark();
          sourceEditor.cursorPosition = {row: choice.row, column: 0};
          sourceEditor.execCommand("goto line start");
          sourceEditor.centerRow(choice.row);
        }
        return true;
      }
    },

    {
      name: "browser history browse",
      exec: async browser => {
        var {left, right} = browser.state.history,
            current = arr.last(left),
            currentIdx = left.indexOf(current);

        var items = left.concat(right).map(loc => ({
          isListItem: true,
          string: loc.module ? loc.module.nameInPackage :
            loc.package ? loc.package.name || loc.package.address :
              "strange location",
          value: loc
        }));

        var {selected: [choice]} = await browser.world().filterableListPrompt(
          "Jumpt to location", items, {preselect: currentIdx, requester: browser });
        if (choice) {
          if (left.includes(choice)) {
            browser.state.history.left = left.slice(0, left.indexOf(choice) + 1);
            browser.state.history.right = left.slice(left.indexOf(choice) + 1).concat(right);
          } else if (right.includes(choice)) {
            browser.state.history.left = left.concat(right.slice(0, right.indexOf(choice) + 1));
            browser.state.history.right = right.slice(right.indexOf(choice) + 1);
          }
          if (current) {
            var {scroll, cursor} = browser.historyGetLocation();
            current.scroll = scroll; current.cursor = cursor;
          }
          await browser.historySetLocation(choice);
        }

        return true;
      }
    },

    {
      name: "open code search",
      exec: browser => browser.world().execCommand("open code search", {browser})
    },

    {
      name: "choose and browse package resources",
      exec: browser => browser.world().execCommand("choose and browse package resources", {browser})
    },
    
    {
      name: "choose and browse module",
      exec: browser => browser.world().execCommand("choose and browse module", {browser})
    },

    {
      name: "reload module",
      exec: async (_, opts = {hard: false}) => {
        let result = await browser.reloadModule(opts.hard);
        if (!result)
          return browser.world().inform("No module selected", {requester: browser});
        if (result instanceof Error)
          return browser.world().inform(result.message, {requester: browser});
        browser.setStatusMessage(`Reloaded ${result.name}`);
        return true;
      }
    },

    {
      name: "load or add module",
      exec: async (browser) => {
        var p = browser.selectedPackage,
            m = browser.selectedModule,
            system = browser.systemInterface;
        try {
          var mods = await system.interactivelyAddModule(browser, m ? m.name : p ? p.address : null);
        } catch(e) {
          e === "Canceled" ?
            browser.setStatusMessage(e) :
            browser.world().inform(`Error while trying to load modules:\n${e.stack || e}`, {requester: browser});
          return;
        }

        mods.forEach(({name, error}) =>
          error ? browser.showError(`Error while loading module ${name}: ${error.stack || error}`) :
            browser.setStatusMessage(`Module ${name} loaded`));
        await browser.updateModuleList(p);
        mods.length && browser.selectModuleNamed(mods[0].name);
        return true;
      }
    },

    {
      name: "remove module",
      exec: async (browser) => {
        var p = browser.selectedPackage,
            m = browser.selectedModule,
            system = browser.systemInterface;
        if (!p) return browser.world().inform("No package selected", {requester: browser});
        if (!m) return browser.world().inform("No module selected", {requester: browser});
        try {
          await system.interactivelyRemoveModule(browser, m.name || m.id);
        } catch(e) {
          e === "Canceled" ?
            browser.world().inform("Canceled module removal") :
            browser.showError(`Error while trying to load modules:\n${e.stack || e}`);
          return true;
        }

        await browser.updateModuleList(p);
        p && browser.selectPackageNamed(p.name);

        return true;
      }
    },

    {
      name: "add package",
      exec: async (browser) => {
        var what = await browser.world().multipleChoicePrompt(
          "Add Package",
          {requester: browser,
           choices: new Map([
             [[...Icon.textAttribute('cube'), ' Create New Package', {}], 'Create New Package'],
             [[...Icon.textAttribute('external-link-alt'), ' Load Existing Package', {}], 'Load Existing Package']
           ])
         });

        if (!what || what === "Cancel") {
          browser.world().inform("Canceled add package", {
            requester: browser, lineWrapping: false });
          return true;
        }

        var pkg;
        try {
          var system = browser.systemInterface;
          pkg = what === "Create New Package" ?
            await system.interactivelyCreatePackage(browser) :
            await system.interactivelyLoadPackage(
              browser, browser.selectedPackage ? browser.selectedPackage.address : null);
        } catch (e) {
          if (e === "Canceled") browser.world().inform("Canceled package creation", {
            requester: browser, lineWrapping: false
          });
          else throw e;
          return true;
        }

        await browser.selectPackageNamed(pkg.name);
        return true;
      }
    },

    {
      name: "remove package",
      exec: async (browser) => {
        var p = browser.selectedPackage;
        if (!p) { browser.world().inform("No package selected"); return true; }

        try {
          var pkg = await browser.systemInterface.interactivelyRemovePackage(browser, p.address);
        } catch (e) {
          if (e === "Canceled") browser.world().inform("Canceled package removel");
          else throw e;
          return true;
        }

        await browser.selectPackageNamed(null);

        return true;
      }
    },

    {
      name: "show imports and exports of package",
      exec: async browser => {
        var system = browser.systemInterface;
        var packages = await system.getPackages();

        var items = packages.map(ea => {
          return {
            isListItem: true,
            label: [
              `${ea.name}`, null,
              `${ea.url}`, {fontSize: "70%", textStyleClasses: ["annotation"]},
            ],
            value: ea
          };
        });

        var {selected} = await browser.world().filterableListPrompt("Choose package(s)", items, {
          multiselect: true, requester: browser,
          historyId: "lively.ide.js-browser-choose-package-for-showing-export-imports-hist"
        });

        await Promise.all(selected.map(ea => system.showExportsAndImportsOf(ea.url)));
        return true;
      }
    },

    {
      name: "open browse snippet",
      exec: browser =>
        browser.world().execCommand("open workspace",
          {content: browser.browseSnippetForSelection(), language: "javascript"})
    },

    {
      name: "open selected module in text editor",
      exec: (browser, opts = {/*module: null, codeEntity: null*/}) => {
        let m = opts.module || browser.selectedModule,
            c = opts.hasOwnProperty("codeEntity") ? opts.codeEntity : browser.selectedCodeEntity;
        if (!m) {
          browser.setStatusMessage("No module selected / specified");
          return true;
        }
        var lineNumber = c ? browser.ui.sourceEditor.indexToPosition(c.node.start).row : null,
            url = m.url;
        if (url.startsWith("file://")) url = url.replace("file://", ""); // FIXME
        return browser.world().execCommand("open file", {url, lineNumber});
      }
    },

    {
      name: "run all tests in package",
      exec: async browser => {
        var p = browser.selectedPackage;
        if (!p) return browser.world().inform("No package selected", {requester: browser});
        var results = await runTestsInPackage(browser, p.name);
        browser.focus();
        return results;
      }
    },

    {
      name: "run all tests in module",
      exec: async browser => {
        var m = browser.selectedModule;
        if (!m) return browser.world().inform("No module selected", {requester: browser});
        var results = await runTestsInModule(browser, m.name, null);
        browser.focus();
        return results;
      }
    },

    {
      name: "run tests at point",
      exec: async (browser) => {
        var m = browser.selectedModule;
        if (!m) return browser.world().inform("No module selected", {requester: browser});

        var ed = browser.get("sourceEditor"),
            testDescriptors = await extractTestDescriptors(
              ed.textString, ed.document.positionToIndex(ed.cursorPosition));

        if (!testDescriptors || !testDescriptors.length)
          return browser.world().inform(
            "No test at " + JSON.stringify(ed.cursorPosition),
            {requester: browser});

        var spec = {
          fullTitle: arr.pluck(testDescriptors, "title").join(" "),
          type: arr.last(testDescriptors).type,
          file: m.name
        };

        var results = await runTestsInModule(browser, m.name, spec);
        browser.focus();
        return results;
      }
    },

    {
      name: "run setup code of tests (before and beforeEach)",
      exec: async (browser, args = {what: "setup"}) => {

        var m = browser.selectedModule;
        if (!m) return browser.world().inform("No module selected", {requester: browser});


        var ed = browser.get("sourceEditor"),
            testDescriptors = await extractTestDescriptors(
              ed.textString, ed.document.positionToIndex(ed.cursorPosition));

        if (!testDescriptors || !testDescriptors.length)
          return browser.world().inform(
            "No test at " + JSON.stringify(ed.cursorPosition),
            {requester: browser});

        // the stringified body of all before(() => ...) or after(() => ...) calls
        var what = (args && args.what) || "setup", // or: teardown
            prop = what === "setup" ? "setupCalls" : "teardownCalls",
            nCalls = 0,
            beforeCode = arr.flatmap(testDescriptors, descr => {
              return descr[prop].map((beforeFn, i) => {
                nCalls++;
                return `await ((${lively.ast.stringify(beforeFn)})());`;
              });
            }).join("\n");

        try {
          await browser.systemInterface.runEval(beforeCode, {...ed.evalEnvironment});
          browser.setStatusMessage(`Executed ${nCalls} test ${what} functions`);
        } catch (e) {
          browser.showError(new Error(`Error when running ${what} calls of test:\n${e.stack}`));
        }

        return true;
      }
    },

    {
      name: "run teardown code of tests (after and afterEach)",
      exec: async (browser) =>
        browser.execCommand(
          "run setup code of tests (before and beforeEach)",
          {what: "teardown"})
    }
  ];


  function focusList(list) {
    list.scrollSelectionIntoView();
    list.update();
    list.show();
    list.focus();
    return list;
  }

  async function runTestsInModule(browser, moduleName, spec) {

    var runner = browser.get("test runner window");
    if (!runner)
      runner = await world.execCommand("open test runner");
    if (runner.minimized)
      runner.toggleMinimize();

    runner = runner.getWindow().targetMorph;

    if (runner.systemInterface != browser.systemInterface)
      runner.systemInterface = browser.systemInterface;

    return spec ?
      runner[spec.type === "suite" ? "runSuite" : "runTest"](spec.fullTitle):
      runner.runTestFile(moduleName);
  }

  async function runTestsInPackage(browser, packageURL) {

    var runner = browser.get("test runner window");
    if (!runner)
      runner = await world.execCommand("open test runner");
    if (runner.minimized)
      runner.toggleMinimize();

    runner = runner.getWindow().targetMorph;

    if (runner.systemInterface != browser.systemInterface)
      runner.systemInterface = browser.systemInterface;

    return runner.runTestsInPackage(packageURL);
  }

}