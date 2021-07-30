/* global System */
import { arr, promise, obj, chain, fun } from 'lively.lang';
import { query, parse, acorn, walk } from 'lively.ast';
import { pt, Color } from 'lively.graphics';
import { addOrChangeCSSDeclaration } from 'lively.morphic/rendering/dom-helper.js';
import { HTMLMorph } from 'lively.morphic';
import { connect } from 'lively.bindings';
import EvalBackendChooser from './js/eval-backend-ui.js';

import { LoadingIndicator } from 'lively.components';
import JavaScriptEditorPlugin from './js/editor-plugin.js';
import { resource } from 'lively.resources/index.js';
import { es5Transpilation } from 'lively.source-transform';

let jsDiff;
(async function loadJsDiff () {
  jsDiff = await System.import('https://cdnjs.cloudflare.com/ajax/libs/jsdiff/3.0.0/diff.js');
})();

export async function findTestModulesInPackage (systemInterface, packageOrUrl) {
  const resources = await systemInterface.resourcesOfPackage(packageOrUrl);
  return Promise.all(
    resources.map(async ({ url }) => {
      if (!url.endsWith('.js')) return null;
      const source = await systemInterface.moduleRead(url); let parsed;
      try { parsed = parse(source); } catch (err) { return null; }
      const hasMochaImports = query.imports(query.scopes(parsed)).some(({ fromModule }) =>
        fromModule.includes('mocha-es6'));
      if (!hasMochaImports) return null;
      try { return testsFromSource(source).length ? url : null; } catch (e) { return null; }
    })).then(tests => tests.filter(Boolean));
}

export function testsFromSource (sourceOrAst) {
  // Traverses the ast and constructs the nested mocha suites and tests as a list like
  // [{fullTitle: "completion", node: {/*...*/}, type: "suite"},
  //  {fullTitle: "completion can compute properties and method completions of an object", node: {/*...*/}, type: "test"},
  //  {fullTitle: "completion finds inherited props", node: {/*...*/}, type: "test"},
  //  {fullTitle: "completion of resolved promise", node: {/*...*/}, type: "test"}]

  const testStack = []; const testsAndSuites = []; let parsed;

  try {
    parsed = typeof sourceOrAst === 'string' ? parse(sourceOrAst) : sourceOrAst;
  } catch (err) { return testsAndSuites; }

  walk.recursive(parsed, {}, {
    CallExpression: (node, state, c) => {
      if (node.callee.name && node.callee.name.match(/^(describe|it)$/) && node.arguments.length >= 2) {
        var spec = {
          title: node.arguments[0].value,
          type: node.callee.name.match(/describe/) ? 'suite' : 'test'
        };
        testStack.push(spec);
        const recorded = { fullTitle: arr.pluck(testStack, 'title').join(' '), type: spec.type, node: node };
        testsAndSuites.push(recorded);
      }
      walk.base.CallExpression(node, state, c);
      if (spec) testStack.pop();
    }
  }, ({ ...walk.base, SpreadProperty: function (node, st, c) {} }));

  return testsAndSuites;
}

export function testsFromMocha (mocha) {
  return _buildTestList(mocha.suite)
    .reduce((byFile, test) => {
      if (!test.file) return byFile;
      const found = byFile.find(ea => ea.file === test.file);
      if (found) found.tests.push(test);
      else byFile.push({ file: test.file, tests: [test] });
      return byFile;
    }, []);

  function _buildTestList (suite, parentFullTitle = '', depth = 0) {
    const suiteFullTitle = (parentFullTitle + ' ' + suite.title).trim();
    return [{
      parent: parentFullTitle,
      fullTitle: suiteFullTitle,
      title: suite.title,
      file: suite.file,
      depth,
      type: 'suite'
    }]
      .concat((suite.tests || []).map(({ title, file, type }) => ({
        state: '',
        duration: -1,
        parent: suiteFullTitle,
        fullTitle: (suiteFullTitle + ' ' + title).trim(),
        title,
        file,
        depth: depth,
        type
      })))
      .concat(...(suite.suites || []).map(suite =>
        _buildTestList(suite, suiteFullTitle, depth + 1)));
  }
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

const testRunnerCSS = `

.mocha-test-runner {
  font-family: IBM Plex Sans,Arial,sans-serif;
  font-size: 12px;
  line-height: 1.5em;
  height: 100%;
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
  margin-top: 0px;
}

.controls {
  pointer-events: auto;
  margin: 6px 6px;
}

.mocha-test-runner .row {
  white-space: wrap;
}

.mocha-test-runner .suites {
  pointer-events: auto;
  overflow-y: auto;
  overflow-x: hidden;
  height: calc(100% - 30px);
  text-overflow: ellipsis;
  white-space: nowrap;
  background: rgba(0,0,0,0.5);
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

.mocha-test-runner .run-button {
  color: rgb(30,30,30);
  border: rgb(150,150,150) 1px solid;
  font-size: 12px;
  border-radius: 5px;
  padding: 2px 8px;
  cursor: pointer;
}

.mocha-test-runner .run-button:active {
  background-color: rgb(200,200,200);
}

.row .run-button {
  font-size: 11px;
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
}`;

export default class TestRunner extends HTMLMorph {
  static async open (props) {
    const runner = new this({ extent: pt(500, 600), ...props }).openInWorld();
    return runner.world().openInWindow(
      runner, { title: 'test runner', name: 'test runner window' }
    ).activate();
  }

  static get properties () {
    return {
      showControls: {
        defaultValue: true,
        after: ['html', 'submorphs'],
        set (visible) {
          this.setProperty('showControls', visible);
          this.get('eval backend button').visible = visible;
          this.update();
        }
      },
      reactsToPointer: { defaultValue: false },
      fill: { defaultValue: Color.transparent },
      state: {},
      editorPlugin: {
        get () {
          return this.getProperty('editorPlugin') ||
              (this.editorPlugin = new JavaScriptEditorPlugin());
        }
      },
      name: { defaultValue: 'test runner' },
      systemInterface: {
        derived: true,
        after: ['editorPlugin', 'submorphs'],
        get () { return this.editorPlugin.systemInterface(); },
        set (systemInterface) {
          this.editorPlugin.setSystemInterface(systemInterface);
          this.get('eval backend button').updateFromTarget();
        }
      },
      cssDeclaration: {
        defaultValue: testRunnerCSS
      }
    };
  }

  constructor (props) {
    super(props);
    this.reset();
    connect(this, 'extent', this, 'relayout');
  }

  async onLoad () {
    // on deserialization
    await System.import('mocha-es6');
    await promise.waitFor(30000, () => !!$world);
    resource(document.URL).query().runAllTests && this.runAllTests();
    await this.whenRendered();
    this.update();
  }

  reset () {
    const win = this.getWindow();
    win && (win.extent = pt(500, 600));

    this.state = {
      grep: null,
      loadedTests: [],
      collapsedSuites: {}
    };

    this.addMorph(EvalBackendChooser.default.ensureEvalBackendDropdown(this, null));
    this.update();
  }

  relayout () {
    this.get('eval backend button').topRight = this.innerBounds().insetBy(5).topRight();
  }

  setEvalBackend (choice) {
    this.editorPlugin.setSystemInterfaceNamed(choice);
    this.get('eval backend button').setAndSelectBackend(this.systemInterface);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  findBrowserForFile (file) {
    const world = this.world();
    const browsers = world.getWindows()
      .map(win => win.targetMorph).filter(ea => ea.isBrowser);
    const browserWithFile = browsers.find(({ selectedModule }) =>
      selectedModule && selectedModule.url === file);
    return browserWithFile || world.execCommand('open browser', null);
  }

  async jumpToTest (test, file) {
    try {
      const browser = await this.findBrowserForFile(file);
      browser.getWindow().activate();
      await browser.searchForModuleAndSelect(file);
      let ed = browser.ui.sourceEditor;
      const tests = testsFromSource(ed.textString);
      const target = tests.find(ea => ea.fullTitle === test.fullTitle);
      if (!target) throw new Error(`Cannot find test ${test.fullTitle} in file ${file}`);

      // target = tests[1]
      ed.selection = ed.astNodeRange(target.node);
      ed.centerRow(ed.selection.start.row);
    } catch (err) { this.showError(err); }
  }

  showError (err) {
    this.world().logError(err);
  }

  removeTestFile (file) {
    const { loadedTests, collapsedSuites } = this.state;
    const loaded = loadedTests.find(ea => ea.file === file);
    if (loaded) {
      arr.remove(loadedTests, loaded);
      [file].concat(arr.pluck(loaded.tests, 'fullTitle')).forEach(name =>
        delete collapsedSuites[name]);
    }
    this.update();
  }

  async runAllTests () {
    const files = arr.pluck(this.state.loadedTests, 'file');
    try {
      for (const f of files) await this.runTestFile(f);
    } catch (e) { this.world().logError(e); }
  }

  async runSuite (suiteName) {
    const test = this.state.loadedTests.find(ea =>
      ea.tests.some(t => t.fullTitle === suiteName));
    if (!test) throw new Error('Cannot find test file for test ' + suiteName);

    const grep = new RegExp('^' + suiteName.replace(/\*/g, '\\*') + '.*');
    const existingUnchangedTests = test.tests.filter(ea => !ea.fullTitle.match(grep));
    await this.runTestFile(test.file, grep);

    // restore unchanged tests
    const newTest = this.state.loadedTests.find(ea => ea.file === test.file);
    if (newTest) {
      newTest.tests = newTest.tests.map(t =>
        t.fullTitle.match(grep)
          ? t
          : test.tests.find(prevT => prevT.fullTitle === t.fullTitle) || t);
      this.update();
    }

    await this.scrollIntoView(suiteName);
  }

  runTest (testName) { return this.runSuite(testName); }

  async runTestFile (file, grep, options) {
    System._testsRunning = true;
    try {
      if (!this.state.loadedTests) this.state.loadedTests = [];
      if (!this.state.loadedTests.some(ea => ea.file === file)) { this.state.loadedTests.push({ file, tests: [] }); }

      // make sure to run only one module!
      const recordIndex = this.state.loadedTests.findIndex(ea => ea.file === file);
      const result = await this.runTestFiles([file], grep, options);

      this.state.loadedTests[recordIndex] = result.find(ea => ea.file === file);

      this.update();

      return this.state.loadedTests[recordIndex];
    } finally {
      System._testsRunning = false;
    }
  }

  async runTestFiles (files, grep, options) {
    const testRecords = files.map(file => ({ file, tests: [] }));

    grep = grep || this.state.grep || /.*/;

    try {
      const result = await this.systemInterface.runMochaTests(
        grep, testRecords,
        () => this.update(),
        (err, when) => this.showError(`Error during ${when}: ${err}`));

      if (result && result.isError) { throw new Error(result.value.stack || result.value); }

      if (!result || !result.testsByFile) { throw new Error(`No test results when runnin tests of ${files}`); }

      return result.testsByFile;
    } catch (err) {
      this.showError(err);
      await this.update();
      throw err;
    }
  }

  async runTestsInPackage (packageURL) {
    const testModuleURLs = await findTestModulesInPackage(this.systemInterface, packageURL);
    const results = [];
    for (const url of testModuleURLs) { results.push(await this.runTestFile(url)); }
    return results;
  }

  // -=-=-=-=-
  // collapse
  // -=-=-=-=-

  collapseAll () {
    this.state.collapsedSuites = {};
    chain(this.state.loadedTests)
      .pluck('tests').flatten().filter(ea => ea.type === 'suite' && ea.fullTitle)
      .forEach(suite => this.state.collapsedSuites[suite.fullTitle] = true);
    arr.pluck(this.state.loadedTests, 'file')
      .forEach(f => this.state.collapsedSuites[f] = true);
    this.update();
  }

  collapseToggle () {
    const sel = Object.keys(this.state.collapsedSuites).length === 0
      ? 'collapseAll'
      : 'uncollapseAll';
    this[sel]();
  }

  uncollapseAll () {
    this.state.collapsedSuites = {};
    this.update();
  }

  // -=-=-=-=-=-=-=-
  // event handling
  // -=-=-=-=-=-=-=-

  onClickCollapseButton (evt, target, file) {
    const recursive = evt.shiftKey;
    const collapsed = this.state.collapsedSuites;
    const tests = this.state.loadedTests;

    if (target in collapsed) {
      delete collapsed[target];

      if (recursive) {
        if (file === target) {
          var testsOfFile = tests.find(ea => ea.file === file);
          if (testsOfFile) testsOfFile.tests.forEach(t => delete collapsed[t.fullTitle]);
        } else {
          Object.keys(collapsed).forEach(k => k.indexOf(target) === 0 && (delete collapsed[k]));
        }
      }
    } else {
      collapsed[target] = true;
      if (recursive) {
        var testsOfFile = tests.find(ea => ea.file === file);
        if (file === target) {
          if (testsOfFile) {
            testsOfFile.tests.forEach(t =>
              t.type === 'suite' && t.depth >= 1 && (collapsed[t.fullTitle] = true));
          }
        } else {
          if (testsOfFile) {
            testsOfFile.tests.forEach(t =>
              t.type === 'suite' && t.fullTitle.indexOf(target) === 0 && (collapsed[t.fullTitle] = true));
          }
        }
      }
    }

    this.update();
  }

  async onClickTest (evt, testTitle, file) {
    try {
      await this.jumpToTest({ fullTitle: testTitle }, file);
    } catch (err) {
      this.showError(err);
    }
  }

  onClickError (evt, testTitle, file) {
    const testsOfFile = this.state.loadedTests.find(ea => ea.file === file);
    const test = testsOfFile.tests.find(test => test.fullTitle === testTitle);
    const printed = this.stringifyExpectedAndActualOfError(test.error);

    if (printed && test.error.actual && test.error.expected) {
      this.world().execCommand('diff and open in window',
        { a: test.error.actual, b: test.error.expected, title: test.fullTitle });
    } else {
      const win = this.world().execCommand('open text window',
        { title: test.fullTitle, content: test.error + '\n' + test.error.stack });
      setTimeout(() => win.activate());
    }
  }

  async onClickFile (evt, file) {
    try {
      const browser = await this.findBrowserForFile(file);
      browser.getWindow().activate();
      await browser.searchForModuleAndSelect(file);
    } catch (err) { this.showError(err); }
  }

  onClickSuite (evt, suiteTitle, file) {
    this.onClickTest(evt, suiteTitle, file);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // rendering
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  update () {
    return new Promise((resolve, reject) => {
      fun.throttleNamed(
        this.id + '-update', 100,
        () => resolve(this.renderTests(this.state)))();
    });
  }

  get htmlRef () {
    // get a reference from plain html to this = test runner
    return `System.get(System.normalizeSync('lively.morphic')).MorphicEnv.default().world.getMorphWithId('${this.id}')`;
  }

  async renderTests (state) {
    const self = this;
    const collapsed = Object.keys(state.collapsedSuites);
    const tests = state.loadedTests || [];
    const runningTest = tests.find(test => test.state === 'running');
    const renderedFiles = [];

    for (const test of tests) {
      renderedFiles.push(
        (await this.renderFile(test.file, test.tests, collapsed)) +
            test.tests.slice(1/* except root suite */)
              .map(ea =>
                ea.type === 'test'
                  ? this.renderTest(ea, test.tests, test.file, collapsed)
                  : this.renderSuite(ea, test.tests, test.file, collapsed))
              .join('\n'));
    }

    this.html = `
       <div class="mocha-test-runner">
       <div class="controls" ${this.showControls ? '' : 'style="display: none;"'}>
         <input type="button" class="load-test-button run-button" value="load test" onmouseup="${this.htmlRef}.interactivelyloadTests()"></input>
         <input type="button" class="run-button" value="run all" onmouseup="${this.htmlRef}.runAllTests()"></input>
         <input type="button" class="collapse-button run-button" value="toggle collapse" onmouseup="${this.htmlRef}.collapseToggle()"></input>
         <span class="${runningTest ? '' : 'hidden'}">Running: ${runningTest && runningTest.title}</span>
       </div>
       <div class="suites">${renderedFiles.join('\n')}</div>
       <div>`;
  }

  renderTest (test, testsAndSuites, file, collapsed) {
    const id = test.fullTitle;
    const isCollapsed = collapsed.includes(file) || (collapsed || []).some(ea => id.indexOf(ea) === 0);
    const classes = ['test', test.state];
    const depthOffset = test.depth * 10 + 20;
    const title = test.title;

    return `<div class="row ${isCollapsed ? 'collapsed' : ''} ${classes.join(' ')}">
              <span
                class="${classes.join(' ')}"
                onmouseup="${this.htmlRef}.onClickTest(event, '${id}', '${file}', this);"
                id="${id}"
                style="margin-left: ${depthOffset}px;"
                >${title}</span>
              <span
                class="duration
                ${test.duration ? '' : 'hidden'}
                ${test.duration > 500 ? 'very-slow' : (test.duration > 100 ? 'slow' : '')}"
                >${test.duration}ms</span>
              <input
                type="button" class="run-button" value="run"
                onmouseup="${this.htmlRef}.runTest('${id}')"></input>
              <div
                onmouseup="${this.htmlRef}.onClickError(event, '${id}', '${file}', this);"
                class="error ${test.error ? '' : 'hidden'}"
                style="margin-left: ${depthOffset + 10}px;"
                >${this.renderError(test)}
              </div>
            </div>`;
  }

  renderSuite (suite, testsAndSuites, file, collapsed) {
    const id = suite.fullTitle;
    const myTests = testsAndSuites.filter(ea =>
      ea.type === 'test' && ea.fullTitle.indexOf(suite.fullTitle) === 0);
    const duration = arr.sum(arr.compact(myTests.map(ea => ea.duration)));
    const state = (myTests || []).some(t => t.state === 'failed')
      ? 'failed'
      : (myTests.every(t => t.state === 'succeeded') ? 'succeeded' : '');
    const classes = ['suite', state];
    const relatedCollapsed = collapsed.filter(ea => id.indexOf(ea) === 0);
    const parentCollapsed = collapsed.includes(file) || (relatedCollapsed || []).some(ea => ea.length < id.length);
    const collapseStart = !parentCollapsed && !!relatedCollapsed.length;
    const depthOffset = suite.depth * 10;
    const title = suite.fullTitle;

    return `<div class="row ${parentCollapsed ? 'collapsed' : ''} ${classes.join(' ')}">
              <span
                class="collapse-button ${collapseStart ? 'collapsed' : ''}"
                onmouseup="${this.htmlRef}.onClickCollapseButton(event, '${id}', '${file}', this);"
                style="margin-left: ${depthOffset}px;">${collapseStart ? '► ' : '▼ '}</span>
              <span
                class="${classes.join(' ')}"
                onmouseup="${this.htmlRef}.onClickSuite(event, '${id}', '${file}', this);"
                id="${id}">${title}</span>
              <span class="duration">${duration}ms</span>
              <input
                type="button" class="run-button" value="run"
                onmouseup="${this.htmlRef}.runSuite('${id}')"></input>
            </div>`;
  }

  async renderFile (file, testsAndSuites, collapsed) {
    const id = file;
    const myTests = testsAndSuites.filter(ea => ea.type === 'test');
    const duration = arr.sum(arr.compact(myTests.map(ea => ea.duration)));
    const state = (myTests || []).some(t => t.state === 'failed')
      ? 'failed'
      : (myTests.every(t => t.state === 'succeeded') ? 'succeeded' : '');
    const sys = this.systemInterface;
    const pack = await sys.getPackageForModule(id);
    const name = pack ? pack.name + '/' + sys.shortModuleName(id, pack) : id;
    const classes = ['test-file', state];
    const isCollapsed = collapsed.includes(id);

    return `<div class="row ${classes.join(' ')}">
              <span
                class="collapse-button ${isCollapsed ? 'collapsed' : ''}"
                onmouseup="${this.htmlRef}.onClickCollapseButton(event, '${id}', '${file}', this);">
                ${isCollapsed ? '► ' : '▼ '}</span>
              <h2 class="${classes.join(' ')}"
                  onmouseup="${this.htmlRef}.onClickFile(event, '${id}', this);"
               >${name}</h2>
              <span class="duration">${duration}ms</span>
              <input
                type="button" class="run-button" value="run"
                onmouseup="${this.htmlRef}.runTestFile('${id}')"></input>
              <i class="far fa-window-close remove-button"
                 onmouseup="${this.htmlRef}.removeTestFile('${id}')"></i>
            </div>`;
  }

  renderError (test) {
    if (!test.error) return '';

    const msg = test.error.message ? `<p>${test.error.message}</p>` : '';

    if (!test.error.actual || !test.error.expected) { return `${msg}<pre>${test.error.stack || test.error}</pre>`; }

    const printed = this.stringifyExpectedAndActualOfError(test.error);

    if (jsDiff && printed && printed.expected && printed.actual) {
      return `${msg}<p>diff + = actual, - = expected:</p><pre>${diffIt(printed.expected, printed.actual)}</pre>`;
    } else {
      return `${msg}<p>expected:</p><pre>${String(test.error.expected)}</pre><p>actual:</p><pre>${String(test.error.actual)}</pre>`;
    }

    function diffIt (a, b) {
      return jsDiff.diffLines(a, b).reduce((result, line) => {
        if (!line.added && !line.removed) { return arr.last(result) === '  ...' ? result : result.concat('  ...\n'); }
        if (line.added) return result.concat('+ ' + line.value.replace(/\n?$/, '\n'));
        if (line.removed) return result.concat('- ' + line.value.replace(/\n?$/, '\n'));
        return result.concat('???\n');
      }, []).join('');
    }
  }

  stringifyExpectedAndActualOfError (error) {
    return !error.expected || !error.actual
      ? null
      : {
          expected: tryPrint(error.expected),
          actual: tryPrint(error.actual)
        };

    function tryPrint (o) {
      if (typeof o === 'function') return String(o);
      if (typeof o === 'string') return o;
      try { return JSON.stringify(o, null, 2); } catch (e) {}
      try { return obj.inspect(o, { maxDepth: 3 }); } catch (e) {}
      return String(o);
    }
  }

  scrollIntoView (fullTitle) {
    const el = document.getElementById(fullTitle);
    if (el && el.scrollIntoViewIfNeeded) el.scrollIntoViewIfNeeded();
    else if (el && el.scrollIntoView) el.scrollIntoView();
    return Promise.resolve();
  }

  async interactivelyloadTests () {
    const sys = this.systemInterface;
    const packages = (await sys.getPackages())
      .map(({ name, url }) => {
        return { isListItem: true, string: name, value: { name, url } };
      });
    const { selected: [pkg] } = await $world.filterableListPrompt(
      'Choose package', packages, {
        requester: this,
        multiSelect: true,
        historyId: 'lively.morphic-test-runner-load-tests-pkg-hist'
      });

    // if (!pkg) return null

    const tests = await findTestModulesInPackage(sys, pkg.url);
    const testItems = tests.map(url => {
      const nameInPackage = url.slice(pkg.url.length);
      return {
        string: nameInPackage,
        value: { url, nameInPackage: url.slice(pkg.url.length) },
        isListItem: true
      };
    });
    const { selected } = await $world.filterableListPrompt('Load tests', testItems, {
      requester: this,
      multiSelect: true,
      historyId: 'lively.morphic-test-runner-load-tests-module-hist'
    });

    const i = LoadingIndicator.open('running tests');
    try {
      for (const { url, nameInPackage } of selected) {
        i.label = `Running ${nameInPackage}`;
        await this.runTestFile(url);
      }
    } finally { i.remove(); }
  }
}
