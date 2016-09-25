import { arr, promise, obj } from "lively.lang"
import { Color, Rectangle, pt } from "lively.graphics"
import { addOrChangeCSSDeclaration } from "lively.morphic/rendering/dom-helper.js";
import { show } from "lively.morphic"
import { HTMLMorph } from "lively.morphic/html-morph.js"


export default class TestRunner extends HTMLMorph {
  
  static open(props) {
    var runner = new this({extent: pt(500,600), ...props});
    return runner.env.world.openInWindow(runner, {title: "test runner", name: "test runner window"}).activate();
  }

  constructor(props) {
    super({name: "test runner", clipMode: "auto", ...props});
    this.reset();
  }

  reset() {

    var win = this.getWindow();
    win && (win.extent = pt(500,600));

    this.addStyleClass("mocha-test-runner");
    this.ensureCSS();

    this.clipMode = "auto";

    this.state = {
      doNotSerialize: ["mocha", "loadedTests"],
      mocha: null,
      loadedTests: null,
      collapsedSuites: {}
    }

    this.update();

    // this.getWindow().openInWorld();
    // this.getWindow().copyToPartsBinWithUserRequest()
  }


  ensureCSS() {

    var css = `.mocha-test-runner {
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
  }`;

    addOrChangeCSSDeclaration("mocha-testrunner-css", css);
  }

  update() {
    return new Promise((resolve, reject) => {
      lively.lang.fun.throttleNamed(
        this.id + "-update", 100,
        () => resolve(this.renderTests(this.state)))();
    });
  }


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  async loadTestFile(file) {
    // var state = that.state
    // var file = "lively.morphic/tests/key-test.js";
    // await loadTestFile(file);

    var loadedTests = this.state.loadedTests || (this.state.loadedTests = []),
        tester = await System.import("mocha-es6/index.js"),
        {mocha, tests, file: url} = await tester.loadTestFile(file, {});

    var prev = loadedTests.findIndex(ea => ea.file === url);
    if (prev > -1) loadedTests.splice(prev, 1, {file: url, tests});
    else loadedTests.push({file: url, tests});
    this.state.mocha = mocha;
  }


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-


  renderTests(state) {

    var self = this,
        collapsed = Object.keys(state.collapsedSuites),
        tests = state.loadedTests || [], runningTest,
        // FIXEinputME
        ref = `System.get(System.normalizeSync('lively.morphic')).MorphicEnv.default().world.getMorphWithId('${this.id}')`;

    var files = tests.map(test =>
        renderFile(test.file, test.tests)
           + test.tests.slice(1/*except root suite*/)
             .map(ea =>ea.type === "test" ? renderTest(ea, test.tests, test.file) : renderSuite(ea, test.tests, test.file))
             .join("\n"));

    this.html = `
       <div class="controls">
         <input type="button" class="run-button" value="run all" onmousedown="${ref}.runAllTests()"></input>
         <input type="button" class="collapse-button" value="toggle collapse" onmousedown="${ref}.collapseToggle()"></input>
         <span class="${runningTest ? "" : "hidden"}">Running: ${runningTest &&runningTest.title}</span>
       </div>
       <div class="suites">${files.join("\n")}</div>`;

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    function renderTest(test, testsAndSuites, file) {
      var id = test.fullTitle, state = test.state;
      var isCollapsed = collapsed.includes(file) || collapsed.some(ea => id.indexOf(ea) === 0);
      var classes = ["test", state];
      var depthOffset = test.depth * 10 + 20,
          title = test.title;
      if (state === "running") runningTest = test;

      var renderedError = self.renderError(test);

      return `<div class="row ${isCollapsed ? "collapsed" : ""} ${classes.join(" ")}">
                <span
                  class="${classes.join(" ")}"
                  onmousedown="${ref}.onClickTest(event, '${id}', '${file}', this);"
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
                  onmousedown="${ref}.runTest('${id}')"></input>
                <div
                  onmousedown="${ref}.onClickError(event, '${id}', '${file}', this);"
                  class="error ${renderedError ? "" : "hidden"}"
                  style="margin-left: ${depthOffset+10}px;"
                  >${renderedError}
                </div>
              </div>`
    }


    function renderSuite(suite, testsAndSuites, file) {
      var id = suite.fullTitle,
          myTests = testsAndSuites.filter(ea => ea.type === "test" && ea.fullTitle.indexOf(suite.fullTitle) === 0),
          duration = arr.sum(arr.compact(myTests.map(ea => ea.duration))),
          state = myTests.some(t => t.state === "failed") ?
          "failed" : (myTests.every(t => t.state === "succeeded") ? "succeeded" : "")

      var classes = ["suite", state];

      var relatedCollapsed = collapsed.filter(ea => id.indexOf(ea) === 0);
      var parentCollapsed = collapsed.includes(file) || relatedCollapsed.some(ea => ea.length < id.length);
      var collapseStart = !parentCollapsed && !!relatedCollapsed.length;

      var depthOffset = suite.depth * 10,
          title = suite.fullTitle;
      return `<div class="row ${parentCollapsed ? "collapsed" : ""} ${classes.join(" ")}">
                <span
                  class="collapse-button ${collapseStart ? "collapsed" : ""}"
                  onmousedown="${ref}.onClickCollapseButton(event, '${id}', '${file}', this);"
                  style="margin-left: ${depthOffset}px;">${collapseStart ? "► " : "▼ "}</span>
                <span
                  class="${classes.join(" ")}"
                  onmousedown="${ref}.onClickSuite(event, '${id}', '${file}', this);"
                  id="${id}">${title}</span>
                <span class="duration">${duration}ms</span>
                <input
                  type="button" class="run-button" value="run"
                  onmousedown="${ref}.runSuite('${id}')"></input>
              </div>`
    }

    function renderFile(file, testsAndSuites) {
      var id = file,
          myTests = testsAndSuites.filter(ea => ea.type === "test"),
          duration = arr.sum(arr.compact(myTests.map(ea => ea.duration))),
          state = myTests.some(t => t.state === "failed") ?
          "failed" : (myTests.every(t => t.state === "succeeded") ? "succeeded" : "")

      var classes = ["test-file", state];

      var isCollapsed = collapsed.includes(id);

      return `<div class="row ${classes.join(" ")}">
                <span
                  class="collapse-button ${isCollapsed ? "collapsed" : ""}"
                  onmousedown="${ref}.onClickCollapseButton(event, '${id}', '${file}', this);">
                  ${isCollapsed ? "► " : "▼ "}</span>
                <h2 class="${classes.join(" ")}"
                    onmousedown="${ref}.onClickFile(event, '${id}', this);"
                 >${id}</h2>
                <span class="duration">${duration}ms</span>
                <input
                  type="button" class="run-button" value="run"
                  onmousedown="${ref}.runTestFile('${id}')"></input>
                <input
                  type="button" class="remove-button" value="✗"
                  onmousedown="${ref}.removeTestFile('${id}')"></input>
              </div>`
    }

  }





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


  async ensureMocha() {
    var tester = await System.import("mocha-es6/index.js")
    if (!this.state.mocha) this.state.mocha = tester.mocha;
    return tester;
  }


  findBrowserForFile(file) {
    var world = this.world(),
        browsers = world.getWindows().filter(ea => ea.isBrowser),
        browserWithFile = browsers.find(({selectedModule}) => selectedModule && selectedModule.name === file);
    return browserWithFile || world.execCommand("open browser");
  }

  async jumpToTest(test, file) {
    try {
      var browser = await this.findBrowserForFile(file);
      browser.activate();
      await browser.searchForModuleAndSelect(file);
      var ed = browser.get("sourceEditor");
      ed = ed.text || ed;

      var tests = this.testsFromSource(ed.textString),
          target = tests.find(ea => ea.fullTitle === test.fullTitle);
      if (!target) throw new Error(`Cannot find test ${test.fullTitle} in file ${file}`)

      ed.selection = ed.astNodeRange(target.node);
      ed.centerRow(ed.selection.start.row);
    } catch (err) { this.showError(err); }
  }

  onClickCollapseButton(evt, target, file) {

    var recursive = evt.shiftKey

    var collapsed = this.state.collapsedSuites;
    var tests = this.state.loadedTests;

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
          if (testsOfFile) testsOfFile.tests.forEach(t => t.type === "suite" && t.depth >= 1 && (collapsed[t.fullTitle] = true));
        } else{
          if (testsOfFile) testsOfFile.tests.forEach(t => t.type === "suite" && t.fullTitle.indexOf(target) === 0 && (collapsed[t.fullTitle] = true))
        }

      }
    }


    this.update();
  }


  onClickError(evt, testTitle, file) {
    // this.jumpToTest({fullTitle: testTitle}, file).catch(err => this.showError(err));
    var testsOfFile = this.state.loadedTests.find(ea => ea.file === file);
    var test = testsOfFile.tests.find(test => test.fullTitle === testTitle)

    var printed = this.stringifyExpectedAndActualOfError(test.error);

    if (printed && printed.actual && printed.expected)
      this.world().execCommand("diff and open in window",
        {textA: printed.actual, textB: printed.expected, title: test.fullTitle})
    else {
      var win = this.world().execCommand("open text window", {title: test.fullTitle, content: test.error + "\n" + test.error.stack});
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

  showError(err) {
    this.world().logError(err);
  }

  async onClickTest(evt, testTitle, file) {
    try {
      await this.jumpToTest({fullTitle: testTitle}, file);
    } catch (err) {
      this.showError(err);
    }
  }

  removeTestFile(file) {
    var loaded = this.state.loadedTests.find(ea => ea.file === file);
    if (loaded) {
      arr.remove(this.state.loadedTests, loaded);
      [file].concat(arr.pluck(loaded.tests,"fullTitle")).forEach(name =>
        delete this.state.collapsedSuites[name]);
    }
    this.update();
  }

  renderError(test) {

    if (!test.error) return "";

    var msg = test.error.message ? `<p>${test.error.message}</p>` : "";

    if (!test.error.actual || !test.error.expected)
      return `${msg}<pre>${test.error.stack || test.error}</pre>`;

    var printed = this.stringifyExpectedAndActualOfError(test.error);

    if (System.global.JsDiff && printed) {
      return `${msg}<p>diff + = actual, - = expected:</p><pre>${diffIt(printed.expected, printed.actual)}</pre>`;
    } else {
      return `${msg}<p>expected:</p><pre>${test.error.expected}</pre><p>actual:</p><pre>${test.error.actual}</pre>`;
    }

    function diffIt(a, b) {
      return JsDiff.diffLines(a, b).reduce((result, line) => {
        if (!line.added && !line.removed)
          return arr.last(result) === "  ..." ? result : result.concat("  ...\n");
        if (line.added) return result.concat("+ " + line.value.replace(/\n?$/, "\n"));
        if (line.removed) return result.concat("- " + line.value.replace(/\n?$/, "\n"));
        return result.concat("???\n")
      }, []).join("")
    }

  }


  runAllTests() {
    var files = arr.pluck(this.state.loadedTests, "file");
    lively.lang.promise.chain(files.map(f => () => this.runTestFile(f)))
  }

  runMocha(mocha) {
    var self = this;

  // this.runTestFile("http://localhost:9001/lively-mocha-tester/tests/test-test.js")

    return new Promise((resolve, reject) => {
        var files = arr.compact(mocha.suite.suites).map(({file}) => file),
          tests = lively.lang.chain(this.state.loadedTests)
            .filter(ea => files.includes(ea.file))
            .pluck("tests").flatten().value();

        if (!tests || !tests.length)
          return reject(new Error(`Trying to run tests of ${files.join(", ")} but cannot find them in loaded tests!`));

        mocha.reporter(function Reporter(runner) {
          // this.done = (failures) => show("done " + failures)
          // runner.on("suite", function (x) { show("suite %s", x) });
          // runner.on("pending", function (x) { show("pending %s", x) });

          runner.on("test", test => {
            try {
              var t = tests.find(ea => ea.fullTitle === test.fullTitle());
              t.state = "running";
              self.update();
            } catch (e) { self.showError("runner on test error: " + e.stack); }
          });

          // runner.on("test end", test => {
          //   try {
          //     var t = tests.tests.find(ea => ea.fullTitle === test.fullTitle();
          //     t.state = "finished";
          // self.update();
          //   } catch (e) { self.showError("error: " + e.stack); }
          // });

          runner.on("pass", test => {
            try {
              var t = tests.find(ea => ea.fullTitle === test.fullTitle());
              t.state = "succeeded";
              t.duration = test.duration;
              self.update();
            } catch (e) { self.showError("runner on pass error: " + e.stack); }
          });

          runner.on("fail", (test, error) => {
            try {
              var t = tests.find(ea => ea.fullTitle === test.fullTitle());
              if (t) attachErrorToTest(t, error, test.duration);
              else { // "test" is a hook...
                var parentTests = test.parent.tests.invoke("fullTitle")
                tests
                  .filter(ea => parentTests.includes(ea.fullTitle))
                  .forEach(ea => attachErrorToTest(ea, error, test.duration))
              }

              self.update();

              function attachErrorToTest(test, error, duration) {
                test.state = "failed";
                test.duration = test.duration;
                test.error = error;
              }

            } catch (e) { self.showError("runner on fail error: " + e.stack); }
          });

          // runner.on("start", test => { show("START %o", lively.printInspect(test ,1)) });
          // runner.on("end", test => { show("end %o", lively.printInspect(test ,1)) });

          // runner.on("hook end", function (x) { show("hook end %s", x) });
          // runner.on("suite end", function (x) { show("suite end %s", x) });
        });

        mocha.run(failures => resolve());
      });
  }

  async runSuite(suiteName) {
    // this.runSuite("test-test")
    // this.runSuite("evaluation runEval promise-rejects on error").catch(show.curry("%s"))
    // show(new RegExp("^" + suiteName + ".*"))
    // return this.runMocha(this.state.mocha.grep(new RegExp("^" + suiteName + ".*")));

    await this.scrollIntoView(suiteName);

    var test = this.state.loadedTests.find(ea => ea.tests.some(t => t.fullTitle === suiteName));
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


  runTest(testName) {
    return this.runSuite(testName);
  }

  async runTestFile(testFile, grep, options) {
    // var testFile = "http://localhost:9001/lively.modules/tests/eval-test.js";
    // this.runTestFile(testFile);

    try {
      await this.ensureMocha();
      await this.loadTestFile(testFile);
      this.update();
      grep = grep || this.state.mocha.options.grep || /.*/;
      await this.runMocha(this.state.mocha.grep(grep));
    } catch(err) {
      this.showError(err);
      throw err;
    }
  }

  scrollIntoView(fullTitle) {
    var el = document.getElementById(fullTitle);
    if (el && el.scrollIntoViewIfNeeded) el.scrollIntoViewIfNeeded();
    else if (el && el.scrollIntoView) el.scrollIntoView();
    return Promise.resolve();
  }

  stringifyExpectedAndActualOfError(error) {

    return !error.expected || !error.actual ? null : {
      expected: tryPrint(error.expected),
      actual: tryPrint(error.actual)
    }

    function tryPrint(o) {
      if (typeof o === "string") return o;
      try { return JSON.stringify(o, null, 2); } catch (e) {}
      try { return obj.inspect(o, {maxDepth: 3}); } catch (e) {}
      return String(o);
    }

  }


  testsFromSource(source) {
    // Traverses the ast and constructs the nested mocha suites and tests as a list like
    // [{fullTitle: "completion", node: {/*...*/}, type: "suite"},
    //  {fullTitle: "completion can compute properties and method completions of an object", node: {/*...*/}, type: "test"},
    //  {fullTitle: "completion finds inherited props", node: {/*...*/}, type: "test"},
    //  {fullTitle: "completion of resolved promise", node: {/*...*/}, type: "test"}]
  
    var testStack = [], testsAndSuites = [];

    var {parse} = System.get(System.decanonicalize("lively.ast")),
        ast = parse(source);

    lively.ast.acorn.walk.recursive(ast, {}, {
      CallExpression: (node, state, c) => {
        if (node.callee.name && node.callee.name.match(/describe|it/)) {
          var spec = {
            title: node.arguments[0].value,
            type: node.callee.name.match(/describe/) ? "suite" : "test"
          }
          testStack.push(spec);
          var recorded = {fullTitle: arr.pluck(testStack, "title").join(" "), type: spec.type, node: node};
          testsAndSuites.push(recorded);
        }
        lively.ast.acorn.walk.base.CallExpression(node, state, c);
        if (spec) {
          testStack.pop();
        }
      }
    }, ({...lively.ast.acorn.walk.base, SpreadProperty: function (node, st, c) {}}))

    return testsAndSuites;

    // lively.ast.withMozillaAstDo(ast, null, (next, node, context, depth, path) => {
    //   if (node.type === "CallExpression" && node.callee.name && node.callee.name.match(/describe|it/)) {
    //     var spec = {
    //       title: node.arguments[0].value,
    //       type: node.callee.name.match(/describe/) ? "suite" : "test"
    //     }
    //     testStack.push(spec);
    //     var recorded = {fullTitle: arr.pluck(testStack, "title").join(" "), type: spec.type, node: node};
    //     testsAndSuites.push(recorded);
    //   }
    //   next();
    //   if (spec) {
    //     testStack.pop();
    //   }
    // })
  }

  uncollapseAll() {
    this.state.collapsedSuites = {};
    this.update();
  }

}




// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-


// 
// // changed at Sun Jun 26 2016 19:14:13 GMT-0700 (PDT) by robertkrahn
// this.addScript(function runTest(moduleName, spec) {
// 
// 
//   return new Promise((resolve, reject) => {
//     var runner = this.get("mocha-test-runner");
//     if (!runner) {
//       runner = lively.PartsBin.getPart("mocha-test-runner", "PartsBin/lively.modules")
//       runner.openInWorldCenter();
//       runner.getWindow().bringToFront();
//       resolve(runner);
//     } else if (runner.isCollapsed && runner.isCollapsed()) {
//       runner.expand().then(() => resolve(runner));
//     } else resolve(runner);
//   })
//   .then(runner => {
//     if (runner.targetMorph) runner = runner.targetMorph;
//     // runner.getWindow().bringToFront();
//     // runner.getWindow().remove()
// 
//     return spec ?
//       runner[spec.type === "suite" ? "runSuite" : "runTest"](spec.fullTitle):
//       runner.runTestFile(moduleName);
//   });
// });
// 
// 

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

