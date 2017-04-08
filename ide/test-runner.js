import { arr, obj } from "lively.lang"
import { query, parse } from "lively.ast";
import { pt } from "lively.graphics";
import { addOrChangeCSSDeclaration } from "lively.morphic/rendering/dom-helper.js";
import { show } from "lively.morphic"
import { HTMLMorph } from "lively.morphic/html-morph.js"
import { connect } from "lively.bindings";
import EvalBackendChooser from "./js/eval-backend-ui.js";

import "mocha-es6";
import LoadingIndicator from "../components/loading-indicator.js";

var jsDiff;
(async function loadJsDiff() {
  jsDiff = await System.import("https://cdnjs.cloudflare.com/ajax/libs/jsdiff/3.0.0/diff.js");
})();

export async function findTestModulesInPackage(livelySystem, packageOrUrl) {
  var resources = await livelySystem.resourcesOfPackage(packageOrUrl)
  return Promise.all(
    resources.map(async ({url}) => {
      if (!url.endsWith(".js")) return null;
      var source = await livelySystem.moduleRead(url),
          hasMochaImports = query.imports(query.scopes(parse(source))).some(({fromModule}) =>
            fromModule.includes("mocha-es6"));
      if (!hasMochaImports) return null;
      try { return testsFromSource(source).length ? url : null; } catch (e) { return null; }
    })).then(tests => tests.filter(Boolean))
}

export function testsFromSource(sourceOrAst) {
  // Traverses the ast and constructs the nested mocha suites and tests as a list like
  // [{fullTitle: "completion", node: {/*...*/}, type: "suite"},
  //  {fullTitle: "completion can compute properties and method completions of an object", node: {/*...*/}, type: "test"},
  //  {fullTitle: "completion finds inherited props", node: {/*...*/}, type: "test"},
  //  {fullTitle: "completion of resolved promise", node: {/*...*/}, type: "test"}]

  var testStack = [], testsAndSuites = [],
      {parse} = System.get(System.decanonicalize("lively.ast")),
      ast = typeof sourceOrAst === "string" ? parse(sourceOrAst) : sourceOrAst;

  lively.ast.acorn.walk.recursive(ast, {}, {
    CallExpression: (node, state, c) => {
      if (node.callee.name && node.callee.name.match(/describe|it/) && node.arguments.length >= 2) {
        var spec = {
          title: node.arguments[0].value,
          type: node.callee.name.match(/describe/) ? "suite" : "test"
        }
        testStack.push(spec);
        var recorded = {fullTitle: arr.pluck(testStack, "title").join(" "), type: spec.type, node: node};
        testsAndSuites.push(recorded);
      }
      lively.ast.acorn.walk.base.CallExpression(node, state, c);
      if (spec) testStack.pop()
    }
  }, ({...lively.ast.acorn.walk.base, SpreadProperty: function (node, st, c) {}}));

  return testsAndSuites;
}

export function testsFromMocha(mocha) {

  return _buildTestList(mocha.suite)
    .reduce((byFile, test) => {
      if (!test.file) return byFile;
      var found = byFile.find(ea => ea.file === test.file);
      if (found) found.tests.push(test);
      else byFile.push({file: test.file, tests: [test]});
      return byFile;
    }, []);

  function _buildTestList(suite, parentFullTitle = "", depth = 0) {
    var suiteFullTitle = (parentFullTitle + " " + suite.title).trim();
    return [{
      parent: parentFullTitle,
      fullTitle: suiteFullTitle,
      title: suite.title,
      file: suite.file,
      depth, type: "suite"}]
    .concat((suite.tests || []).map(({title, file, type}) => ({
      state: "", duration: -1,
      parent: suiteFullTitle,
      fullTitle: (suiteFullTitle + " " + title).trim(),
      title, file, depth: depth, type})))
    .concat(...(suite.suites || []).map(suite =>
      _buildTestList(suite, suiteFullTitle, depth+1)));
  }
}


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-


const testRunnerCSS = `.mocha-test-runner {
  font-family: Arial,sans-serif;
  font-size: 12px;
  line-height: 1.5em;
}

.mocha-test-runner .controls input {
  display: inline;
}

.mocha-test-runner .row h2 {
  display: inline;
  margin: 2px 4px;
  font-size: small;
}

.mocha-test-runner .row.test-file {
  margin-top: 6px;
}

.mocha-test-runner .row {
  white-space: wrap;
}

.mocha-test-runner .suites {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mocha-test-runner .suite {
  font-weight: bold;
}

.mocha-test-runner .collapse-button {
  font-weight: bold;
}

.mocha-test-runner .collapse-button.collapsed {
  font-weight: bold;
}

.mocha-test-runner .row {
/*line-height: 2.2;*/
}

.mocha-test-runner .heading .run-button, .row .run-button, .row .remove-button {
  display: none;
}

.mocha-test-runner .heading:hover .run-button, .row:hover .run-button, .row:hover .remove-button {
  display: inline;
}

.mocha-test-runner .test-file, .suite, .test, .collapse-button {
  cursor: pointer;
}

.mocha-test-runner .suite, .test {
  padding: 2px;
/*outline: 1px red solid;*/
}

.mocha-test-runner .row.collapsed {
  display: none;
}

.mocha-test-runner .hidden {
  display: none;
}

.mocha-test-runner .suite .running::before, .test .running::before {
  content: "☛ ";
}

.mocha-test-runner .failed {
  background-color: red;
  color: white;
}

.mocha-test-runner .succeeded {
  background-color: #60d610;
  color: white;
}

.mocha-test-runner .duration {
  font-size: 80%;
}

.mocha-test-runner .duration.slow {
  color: yellow;
}

.mocha-test-runner .duration.very-slow {
  color: red;
}`


export default class TestRunner extends HTMLMorph {

  static async open(props) {
    var runner = new this({extent: pt(500,600), ...props}).openInWorld();
    return runner.world().openInWindow(
      runner, {title: "test runner", name: "test runner window"}
    ).activate();
  }

  constructor(props) {
    super({name: "test runner", clipMode: "auto", ...props});
    this.reset();
    connect(this, 'extent', this, 'relayout');
  }

  reset() {
    var win = this.getWindow();
    win && (win.extent = pt(500,600));

    this.addStyleClass("mocha-test-runner");
    addOrChangeCSSDeclaration("mocha-testrunner-css", testRunnerCSS);

    this.clipMode = "auto";

    this.state = {
      grep: null,
      loadedTests: [],
      collapsedSuites: {}
    }

    this.backend = null;

    this.addMorph(EvalBackendChooser.default.ensureEvalBackendDropdown(this, this.backend));
    this.update();
  }

  relayout() {
    this.get("eval backend list").topRight = this.innerBounds().topRight();
  }

  get backend() { return this.state.backend || "local"; }
  set backend(x) {
    this.state.backend = x;
    this.get("eval backend list") && (this.get("eval backend list").selection = x);
  }
  setEvalBackend(choice) { this.backend = choice; }

  async getLivelySystem() {
    var systemInterface = await System.import("lively-system-interface");
    return !this.backend || this.backend === "local" ?
      systemInterface.localInterface :
      systemInterface.serverInterfaceFor(this.backend);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  findBrowserForFile(file) {
    var world = this.world(),
        browsers = world.getWindows().filter(ea => ea.isBrowser),
        browserWithFile = browsers.find(({selectedModule}) =>
          selectedModule && selectedModule.name === file);
    return browserWithFile || world.execCommand("open browser");
  }

  async jumpToTest(test, file) {
    try {
      var browser = await this.findBrowserForFile(file);
      browser.activate();
      await browser.searchForModuleAndSelect(file);
      var ed = browser.get("sourceEditor");
      ed = ed.text || ed;

      var tests = testsFromSource(ed.textString),
          target = tests.find(ea => ea.fullTitle === test.fullTitle);
      if (!target) throw new Error(`Cannot find test ${test.fullTitle} in file ${file}`)

      ed.selection = ed.astNodeRange(target.node);
      ed.centerRow(ed.selection.start.row);
    } catch (err) { this.showError(err); }
  }

  showError(err) {
    this.world().logError(err);
  }

  removeTestFile(file) {
    var {loadedTests, collapsedSuites} = this.state,
        loaded = loadedTests.find(ea => ea.file === file);
    if (loaded) {
      arr.remove(loadedTests, loaded);
      [file].concat(arr.pluck(loaded.tests,"fullTitle")).forEach(name =>
        delete collapsedSuites[name]);
    }
    this.update();
  }

  async runAllTests() {
    var files = arr.pluck(this.state.loadedTests, "file");
    try {
      for (let f of files) await this.runTestFile(f);
    } catch (e) { this.world().logError(e); }
  }

  async runSuite(suiteName) {
    var test = this.state.loadedTests.find(ea =>
      ea.tests.some(t => t.fullTitle === suiteName));
    if (!test) throw new Error("Cannot find test file for test " + suiteName);

    var grep = new RegExp("^" + suiteName.replace(/\*/g, "\\*") + ".*"),
        existingUnchangedTests = test.tests.filter(ea => !ea.fullTitle.match(grep));
    await this.runTestFile(test.file, grep);

    // restore unchanged tests
    var newTest = this.state.loadedTests.find(ea => ea.file === test.file);
    if (newTest) {
      newTest.tests = newTest.tests.map(t =>
        t.fullTitle.match(grep) ?
        t :
        test.tests.find(prevT => prevT.fullTitle === t.fullTitle) || t);
      this.update();
    }

    await this.scrollIntoView(suiteName);
  }

  runTest(testName) { return this.runSuite(testName); }

  async runTestFile(file, grep, options) {
    if (!this.state.loadedTests) this.state.loadedTests = [];
    if (!this.state.loadedTests.some(ea => ea.file === file))
      this.state.loadedTests.push({file, tests: []});

    // make sure to run only one module!
    var recordIndex = this.state.loadedTests.findIndex(ea => ea.file === file),
        result = await this.runTestFiles([file], grep, options);

    this.state.loadedTests[recordIndex] = result.find(ea => ea.file === file);

    this.update();

    return this.state.loadedTests[recordIndex];
  }

  async runTestFiles(files, grep, options) {
    var testRecords = files.map(file => ({file, tests: []}));

    grep = grep || this.state.grep || /.*/;

    try {
      var livelySystem = await this.getLivelySystem(),
          result = await livelySystem.runMochaTests(
                    grep, testRecords,
                    () => this.update(),
                    (err, when) => this.showError(`Error during ${when}: ${err}`));

      if (result && result.isError)
        throw new Error(result.value.stack || result.value)

      if (!result || !result.testsByFile)
        throw new Error(`No test results when runnin tests of ${files}`);

      return result.testsByFile;
    } catch(err) {
      this.showError(err);
      await this.update();
      throw err;
    }
  }

  async runTestsInPackage(packageURL) {
    var testModuleURLs = await findTestModulesInPackage(await this.getLivelySystem(), packageURL),
        results = [];
    for (let url of testModuleURLs)
      results.push(await this.runTestFile(url))
    return results;
  }

  // -=-=-=-=-
  // collapse
  // -=-=-=-=-

  collapseAll() {
    this.state.collapsedSuites = {};
    lively.lang.chain(this.state.loadedTests)
      .pluck("tests").flatten().filter(ea => ea.type === "suite" && ea.fullTitle)
      .forEach(suite => this.state.collapsedSuites[suite.fullTitle] = true);
    arr.pluck(this.state.loadedTests, "file")
      .forEach(f => this.state.collapsedSuites[f] = true);
    this.update();
  }

  collapseToggle() {
     var sel = Object.keys(this.state.collapsedSuites).length === 0 ?
      "collapseAll" : "uncollapseAll"
     this[sel]();
  }

  uncollapseAll() {
    this.state.collapsedSuites = {};
    this.update();
  }


  // -=-=-=-=-=-=-=-
  // event handling
  // -=-=-=-=-=-=-=-

  onClickCollapseButton(evt, target, file) {
    var recursive = evt.shiftKey,
        collapsed = this.state.collapsedSuites,
        tests = this.state.loadedTests;

    if (target in collapsed) {
      delete collapsed[target];

      if (recursive) {
        if (file === target) {
          var testsOfFile = tests.find(ea => ea.file === file);
          if (testsOfFile) testsOfFile.tests.forEach(t => delete collapsed[t.fullTitle]);
        } else{
          Object.keys(collapsed).forEach(k => k.indexOf(target) === 0 && (delete collapsed[k]));
        }
      }

    } else {
      collapsed[target] = true;
      if (recursive) {
        var testsOfFile = tests.find(ea => ea.file === file);
        if (file === target) {
          if (testsOfFile) testsOfFile.tests.forEach(t =>
            t.type === "suite" && t.depth >= 1 && (collapsed[t.fullTitle] = true));
        } else {
          if (testsOfFile) testsOfFile.tests.forEach(t =>
            t.type === "suite" && t.fullTitle.indexOf(target) === 0 && (collapsed[t.fullTitle] = true))
        }
      }
    }

    this.update();
  }

  async onClickTest(evt, testTitle, file) {
    try {
      await this.jumpToTest({fullTitle: testTitle}, file);
    } catch (err) {
      this.showError(err);
    }
  }

  onClickError(evt, testTitle, file) {
    var testsOfFile = this.state.loadedTests.find(ea => ea.file === file),
        test = testsOfFile.tests.find(test => test.fullTitle === testTitle),
        printed = this.stringifyExpectedAndActualOfError(test.error);

    if (printed && test.error.actual && test.error.expected) {
      this.world().execCommand("diff and open in window",
        {a: test.error.actual, b: test.error.expected, title: test.fullTitle})
    } else {
      var win = this.world().execCommand("open text window",
        {title: test.fullTitle, content: test.error + "\n" + test.error.stack});
      setTimeout(() => win.activate());
    }
  }

  async onClickFile(evt, file) {
    try {
      var browser = await this.findBrowserForFile(file);
      browser.activate();
      await browser.searchForModuleAndSelect(file);
    } catch (err) { this.showError(err); }
  }

  onClickSuite(evt, suiteTitle, file) {
    this.onClickTest(evt, suiteTitle, file);
  }


  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // rendering
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  update() {
    return new Promise((resolve, reject) => {
      lively.lang.fun.throttleNamed(
        this.id + "-update", 100,
        () => resolve(this.renderTests(this.state)))();
    });
  }

  get htmlRef() {
    // get a reference from plain html to this = test runner
    return `System.get(System.normalizeSync('lively.morphic')).MorphicEnv.default().world.getMorphWithId('${this.id}')`;
  }

  renderTests(state) {
    var self = this,
        collapsed = Object.keys(state.collapsedSuites),
        tests = state.loadedTests || [],
        runningTest = tests.find(test => test.state === "running"),
        files = tests.map(test =>
          this.renderFile(test.file, test.tests, collapsed)
             + test.tests.slice(1/*except root suite*/)
               .map(ea =>
                 ea.type === "test" ?
                   this.renderTest(ea, test.tests, test.file, collapsed) :
                   this.renderSuite(ea, test.tests, test.file, collapsed))
               .join("\n"));

    this.html = `
       <div class="controls">
         <input type="button" class="load-test-button" value="load test" onmousedown="${this.htmlRef}.interactivelyloadTests()"></input>
         <input type="button" class="run-button" value="run all" onmousedown="${this.htmlRef}.runAllTests()"></input>
         <input type="button" class="collapse-button" value="toggle collapse" onmousedown="${this.htmlRef}.collapseToggle()"></input>
         <span class="${runningTest ? "" : "hidden"}">Running: ${runningTest && runningTest.title}</span>
       </div>
       <div class="suites">${files.join("\n")}</div>`;
  }

  renderTest(test, testsAndSuites, file, collapsed) {
    var id = test.fullTitle,
        isCollapsed = collapsed.includes(file) || (collapsed || []).some(ea => id.indexOf(ea) === 0),
        classes = ["test", test.state],
        depthOffset = test.depth * 10 + 20,
        title = test.title;

    return `<div class="row ${isCollapsed ? "collapsed" : ""} ${classes.join(" ")}">
              <span
                class="${classes.join(" ")}"
                onmousedown="${this.htmlRef}.onClickTest(event, '${id}', '${file}', this);"
                id="${id}"
                style="margin-left: ${depthOffset}px;"
                >${title}</span>
              <span
                class="duration
                ${test.duration ? "" : "hidden"}
                ${test.duration > 500 ? "very-slow" : (test.duration > 100 ? "slow" : "")}"
                >${test.duration}ms</span>
              <input
                type="button" class="run-button" value="run"
                onmousedown="${this.htmlRef}.runTest('${id}')"></input>
              <div
                onmousedown="${this.htmlRef}.onClickError(event, '${id}', '${file}', this);"
                class="error ${test.error ? "" : "hidden"}"
                style="margin-left: ${depthOffset+10}px;"
                >${this.renderError(test)}
              </div>
            </div>`
  }


  renderSuite(suite, testsAndSuites, file, collapsed) {
    var id = suite.fullTitle,
        myTests = testsAndSuites.filter(ea =>
          ea.type === "test" && ea.fullTitle.indexOf(suite.fullTitle) === 0),
        duration = arr.sum(arr.compact(myTests.map(ea => ea.duration))),
        state = (myTests||[]).some(t => t.state === "failed") ?
        "failed" : (myTests.every(t => t.state === "succeeded") ? "succeeded" : ""),
        classes = ["suite", state],
        relatedCollapsed = collapsed.filter(ea => id.indexOf(ea) === 0),
        parentCollapsed = collapsed.includes(file) || (relatedCollapsed||[]).some(ea => ea.length < id.length),
        collapseStart = !parentCollapsed && !!relatedCollapsed.length,
        depthOffset = suite.depth * 10,
        title = suite.fullTitle;

    return `<div class="row ${parentCollapsed ? "collapsed" : ""} ${classes.join(" ")}">
              <span
                class="collapse-button ${collapseStart ? "collapsed" : ""}"
                onmousedown="${this.htmlRef}.onClickCollapseButton(event, '${id}', '${file}', this);"
                style="margin-left: ${depthOffset}px;">${collapseStart ? "► " : "▼ "}</span>
              <span
                class="${classes.join(" ")}"
                onmousedown="${this.htmlRef}.onClickSuite(event, '${id}', '${file}', this);"
                id="${id}">${title}</span>
              <span class="duration">${duration}ms</span>
              <input
                type="button" class="run-button" value="run"
                onmousedown="${this.htmlRef}.runSuite('${id}')"></input>
            </div>`
  }

  renderFile(file, testsAndSuites, collapsed) {
    var id = file,
        myTests = testsAndSuites.filter(ea => ea.type === "test"),
        duration = arr.sum(arr.compact(myTests.map(ea => ea.duration))),
        state = (myTests||[]).some(t => t.state === "failed") ?
          "failed" : (myTests.every(t => t.state === "succeeded") ? "succeeded" : ""),
        mod = lively.modules.module(id),
        name = mod.package().name + "/" + mod.pathInPackage(),
        classes = ["test-file", state],
        isCollapsed = collapsed.includes(id);

    return `<div class="row ${classes.join(" ")}">
              <span
                class="collapse-button ${isCollapsed ? "collapsed" : ""}"
                onmousedown="${this.htmlRef}.onClickCollapseButton(event, '${id}', '${file}', this);">
                ${isCollapsed ? "► " : "▼ "}</span>
              <h2 class="${classes.join(" ")}"
                  onmousedown="${this.htmlRef}.onClickFile(event, '${id}', this);"
               >${name}</h2>
              <span class="duration">${duration}ms</span>
              <input
                type="button" class="run-button" value="run"
                onmousedown="${this.htmlRef}.runTestFile('${id}')"></input>
              <input
                type="button" class="remove-button" value="✗"
                onmousedown="${this.htmlRef}.removeTestFile('${id}')"></input>
            </div>`
  }

  renderError(test) {
    if (!test.error) return "";

    var msg = test.error.message ? `<p>${test.error.message}</p>` : "";

    if (!test.error.actual || !test.error.expected)
      return `${msg}<pre>${test.error.stack || test.error}</pre>`;

    var printed = this.stringifyExpectedAndActualOfError(test.error);

    if (jsDiff && printed && printed.expected && printed.actual) {
      return `${msg}<p>diff + = actual, - = expected:</p><pre>${diffIt(printed.expected, printed.actual)}</pre>`;
    } else {
      return `${msg}<p>expected:</p><pre>${String(test.error.expected)}</pre><p>actual:</p><pre>${String(test.error.actual)}</pre>`;
    }

    function diffIt(a, b) {
      return jsDiff.diffLines(a, b).reduce((result, line) => {
        if (!line.added && !line.removed)
          return arr.last(result) === "  ..." ? result : result.concat("  ...\n");
        if (line.added) return result.concat("+ " + line.value.replace(/\n?$/, "\n"));
        if (line.removed) return result.concat("- " + line.value.replace(/\n?$/, "\n"));
        return result.concat("???\n")
      }, []).join("")
    }

  }

  stringifyExpectedAndActualOfError(error) {
    return !error.expected || !error.actual ? null : {
      expected: tryPrint(error.expected),
      actual: tryPrint(error.actual)
    }

    function tryPrint(o) {
      if (typeof o === "function") return String(o);
      if (typeof o === "string") return o;
      try { return JSON.stringify(o, null, 2); } catch (e) {}
      try { return obj.inspect(o, {maxDepth: 3}); } catch (e) {}
      return String(o);
    }
  }

  scrollIntoView(fullTitle) {
    var el = document.getElementById(fullTitle);
    if (el && el.scrollIntoViewIfNeeded) el.scrollIntoViewIfNeeded();
    else if (el && el.scrollIntoView) el.scrollIntoView();
    return Promise.resolve();
  }

  async interactivelyloadTests() {
    let sys = await this.getLivelySystem(),
        packages = await sys.getPackages()
          .map(({name, url}) => {
            return {isListItem: true, string: name, value: {name, url}}; }),
        {selected: [pkg]} = await $world.filterableListPrompt(
          "Choose package", packages, {
            requester: this,
            multiSelect: true,
            historyId: "lively.morphic-test-runner-load-tests-pkg-hist"
          });

    // if (!pkg) return null

    let tests = await findTestModulesInPackage(sys, pkg.url),
        testItems = tests.map(url => {
          let nameInPackage = url.slice(pkg.url.length);
          return {
            string: nameInPackage,
            value: {url, nameInPackage: url.slice(pkg.url.length)},
            isListItem: true
          }
        }),
        {selected} = await $world.filterableListPrompt("Load tests", testItems, {
          requester: this,
          multiSelect: true,
          historyId: "lively.morphic-test-runner-load-tests-module-hist"
        });

    let i = LoadingIndicator.open("running tests");
    try {
      for (let {url, nameInPackage} of selected) {
        i.label = `Running ${nameInPackage}`
        await this.runTestFile(url);
      }
    } finally { i.remove(); }
  }
}




// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

// // changed at Sun Jun 26 2016 19:14:13 GMT-0700 (PDT) by robertkrahn
// this.addScript(function runTestsOfPackage(packageAddress) {
//   var ed = this.get("editor");
//   return Promise.resolve(this.systemInterface().getPackage(packageAddress)).then(p => {
//       if (!p) return Promise.reject(new Error("Cannot find package " + packageAddress));
//       return lively.lang.promise.chain(
//         p.modules.map(mod =>
//         () =>  mod.name.match(/\.js$/) && Promise.resolve(this.systemInterface().moduleRead(mod.name))
//                 .then(source => {
//                   var parsed = lively.ast.parse(source)
//                   var isMochaTest = parsed && parsed.body.some(stmt => lively.lookup("expression.callee.name", stmt) === "describe");
//                   // isMochaTest && show(mod.name)
//                   return isMochaTest ? this.runTest(mod.name): null
//                 })))
//     })
//     .catch(err => this.showError(err));
// });

