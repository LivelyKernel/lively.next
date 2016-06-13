/*global System,global*/

import * as modules from "lively.modules";
import mocha from "mocha";
import chai, { expect } from "chai";

export { loadTestFile, loadTestFiles, runTestFiles, chai, mocha, expect };

function ConsoleReporter(runner) {
  var passes = 0;
  var failures = 0;

  runner.on('pass', function(test) {
    passes++;
    console.log('pass: %s', test.fullTitle());
  });

  runner.on('fail', function(test, err) {
    failures++;
    console.log('fail: %s -- error: %s', test.fullTitle(), err.stack || err.message || err);
  });

  runner.on('end', function() {
    console.log('end: %d/%d', passes, passes + failures);
  });
}

function gatherTests(suite, depth) {
  return [{title: suite.title, fullTitle: suite.fullTitle(), depth: depth, type: "suite"}]
    .concat(suite.tests.map(ea => ({title: ea.title, fullTitle: ea.fullTitle(), type: "test", depth: depth})))
    .concat(suite.suites.reduce((tests, suite) => tests.concat(gatherTests(suite, depth + 1)), []));
}

async function loadTestFiles(files, options) {
  options = Object.assign({
    global: System.global,
    mocha: new (mocha.constructor)({reporter: options.reporter}),
    reporter: ConsoleReporter}, options);

  var testState = {mocha: options.mocha, files: [], tests: []};
  for (var file of files) {
    var _testState = await loadTestFile(file, options);
    testState.files.push(_testState.file);
    testState.tests = testState.tests.concat(_testState.tests);
  }

  return testState;
}

async function loadTestFile(file, options) {
  options = Object.assign({
    global: System.global,
    mocha: new (mocha.constructor)({reporter: options.reporter}),
    reporter: ConsoleReporter}, options);

  (options.logger || console).log("[mocha-es6] loading test module %s", file);
  var file = await System.normalize(file)
  System.delete(file);
  var m = options.mocha;
  prepareMocha(m, options.global);
  m.suite.emit('pre-require', options.global, file, m);
  var imported = await System.import(file)
  m.suite.emit('require', imported, file, m)
  m.suite.emit('post-require', options.global, file, m)
  return {mocha: m, file: file, tests: gatherTests(m.suite, 0)};
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
}

async function runTestFiles(files, options) {
  if (!options) options = {};

  if (options.package) {
    (options.logger || console).log("[mocha-es6] importing package %s", options.package);
    await lively.modules.importPackage(options.package);
    files = files.map(f =>
      f.match(/^(\/|[a-z-A-Z]:\\|[^:]+:\/\/)/) ?
        f : join(options.package, f))
  }

  var testState = await loadTestFiles(files, options),
      mocha = testState.mocha,
      grep = options.grep || mocha.options.grep || /.*/;

  mocha.grep(grep);
  options.invert && mocha.invert();

  (options.logger || console).log("[mocha-es6] start running tests");  
  try {
    return new Promise((resolve, reject) => mocha.run(failures => resolve(failures)))
  } catch (err) {
      (options.logger || console).log("[mocha-es6] error running tests!\n" + err.stack);  
      console.error(err);
      throw err;
  }
}

function join(pathA, pathB) {
  if (pathA[pathA.length] === "/") pathA = pathA.slice(0,-1);
  if (pathB[0] === "/") pathB = pathB.slice(1);
  return `${pathA}/${pathB}`;
}

async function test() {
  var file = "tests/eval-support-test.js";
  var file = "http://localhost:9001/node_modules/lively.ast/tests/eval-support-test.js";
  await runTestFiles([file], {package: "http://localhost:9001/node_modules/lively.ast"})
}
