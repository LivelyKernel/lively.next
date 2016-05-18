/*global System,global*/

import mocha from "mocha";
import chai, { expect } from "chai";

export { loadTestFile, loadTestFiles, runTestFiles, chai, mocha, expect };

function ConsoleReporter(runner) {
  var passes = 0;
  var failures = 0;

  runner.on('pass', function(test){
    passes++;
    console.log('pass: %s', test.fullTitle());
  });

  runner.on('fail', function(test, err){
    failures++;
    console.log('fail: %s -- error: %s', test.fullTitle(), err.stack || err.message || err);
  });

  runner.on('end', function(){
    console.log('end: %d/%d', passes, passes + failures);
  });
}

function mochaForFile(fileName, optMocha) {
  return loadTestFile(fileName, null/*parent*/, optMocha);
}

function gatherTests(suite, depth) {
  return [{title: suite.title, fullTitle: suite.fullTitle(), depth: depth, type: "suite"}]
    .concat(suite.tests.map(ea => ({title: ea.title, fullTitle: ea.fullTitle(), type: "test", depth: depth})))
    .concat(suite.suites.reduce((tests, suite) => tests.concat(gatherTests(suite, depth + 1)), []));
}

function loadTestFiles(files, optMocha, optGLOBAL, reporter) {
  var m = optMocha || new (mocha.constructor)({reporter: reporter || ConsoleReporter}),
      testState = {mocha: m, files: [], tests: []};
  return files.reduce((nextP, f) =>
    nextP
      .then(() => loadTestFile(f, null, m, optGLOBAL)
      .then(_testState => {
        testState.files.push(_testState.file);
        testState.tests = testState.tests.concat(_testState.tests);
        return testState;
      })), Promise.resolve());
}

function loadTestFile(file, parent, optMocha, optGLOBAL, reporter) {
  var GLOBAL = optGLOBAL || (typeof window !== "undefined" ? window : global);
  return System.normalize(file, parent)
    .then((file) => {
      System.delete(file);
      // if (System.__lively_vm__) delete System.__lively_vm__.loadedModules[file]
    })
    .then(() =>
      prepareMocha(optMocha || new (mocha.constructor)({reporter: reporter || ConsoleReporter}), GLOBAL)
        .then(mocha => {
          mocha.suite.emit('pre-require', GLOBAL, file, mocha);
          return System.import(file)
            .then(imported => {
              mocha.suite.emit('require', imported, file, mocha)
              mocha.suite.emit('post-require', GLOBAL, file, mocha)
              return {mocha: mocha, file: file, tests: gatherTests(mocha.suite, 0)};
            })
        }));
}

function prepareMocha(mocha, GLOBAL) {
  mocha.suite.on('pre-require', context => {
    GLOBAL.afterEach     = context.afterEach     || context.teardown;
    GLOBAL.after         = context.after         || context.suiteTeardown;
    GLOBAL.beforeEach    = context.beforeEach    || context.setup;
    GLOBAL.before        = context.before        || context.suiteSetup;
    GLOBAL.describe      = context.describe      || context.suite;
    GLOBAL.it            = context.it            || context.test;
    GLOBAL.setup         = context.setup         || context.beforeEach;
    GLOBAL.suiteSetup    = context.suiteSetup    || context.before;
    GLOBAL.suiteTeardown = context.suiteTeardown || context.after;
    GLOBAL.suite         = context.suite         || context.describe;
    GLOBAL.teardown      = context.teardown      || context.afterEach;
    GLOBAL.test          = context.test          || context.it;
    GLOBAL.run           = context.run;
  });
  mocha.ui("bdd");
  return Promise.resolve(mocha);
}

function runTestFiles(files, options) {
  if (!options) options = {};
  return loadTestFiles(files, options.mocha, options.global, options.reporter)
    .then(testState => new Promise((resolve, reject) => {
      var mocha = testState.mocha;
      if (options.grep) mocha = mocha.grep(options.grep);
      return mocha.run(failures => resolve(failures));
    }));
}

// runTestFiles(["http://localhost:9001/lively.ast-es6/tests/capturing-test.js"], {}).catch(show.curry("%s")).then(show.curry("%s"))