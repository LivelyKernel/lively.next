"format esm";

import mocha from "mocha";
import chai from "chai";
import subset from "chai-subset";
import { arr } from "node_modules/lively.lang/index.js";

chai.use(subset);

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

export {
  loadTestFile,
  chai,
  mocha
};

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-


function test() {
  var m;
  var file1 = "http://localhost:9001/node_modules/lively.vm/tests/es6-test.js";
  var file2 = "http://localhost:9001/lively-mocha-tester/tests/test-test.js";
  var file3 = "http://localhost:9001/lively-mocha-tester/tests/test-test.js";

  loadTestFile(file2).then(_m => m=_m).catch(show.curry("%s"))
  loadTestFile(file3, null, m).then(show.curry("%o")).catch(show.curry("%s"))
  
  gatherTests(m.suite, 0);
}

function mochaForFile(fileName, optMocha) {
  chai.use(subset);

  return loadTestFile(fileName, null/*parent*/, optMocha);
}

function gatherTests(suite, depth) {
  return [{title: suite.title, fullTitle: suite.fullTitle(), depth: depth, type: "suite"}]
    .concat(suite.tests.map(ea => ({title: ea.title, fullTitle: ea.fullTitle(), type: "test", depth: depth})))
    .concat(arr.flatmap(suite.suites, suite => gatherTests(suite, depth + 1)))
}

function loadTestFile(file, parent, optMocha) {
  return System.normalize(file, parent).then((file) => {
    var GLOBAL = typeof window !== "undefined" ? window : global;
    System.delete(file);
    return prepareMocha(optMocha || new (mocha.constructor)({reporter: "spec"}), GLOBAL)
      .then(mocha => {
        mocha.suite.emit('pre-require', GLOBAL, file, mocha);
        return System.import(file)
          .then(imported => {
            mocha.suite.emit('require', imported, file, mocha)
            mocha.suite.emit('post-require', GLOBAL, file, mocha)
            return {
              mocha: mocha,
              file: file,
              tests: gatherTests(mocha.suite, 0)
            };
          })
      });
  })
}

function prepareMocha(mocha, GLOBAL) {
  mocha.suite.on('pre-require', function(context) {
    GLOBAL.afterEach = context.afterEach || context.teardown;
    GLOBAL.after = context.after || context.suiteTeardown;
    GLOBAL.beforeEach = context.beforeEach || context.setup;
    GLOBAL.before = context.before || context.suiteSetup;
    GLOBAL.describe = context.describe || context.suite;
    GLOBAL.it = context.it || context.test;
    GLOBAL.setup = context.setup || context.beforeEach;
    GLOBAL.suiteSetup = context.suiteSetup || context.before;
    GLOBAL.suiteTeardown = context.suiteTeardown || context.after;
    GLOBAL.suite = context.suite || context.describe;
    GLOBAL.teardown = context.teardown || context.afterEach;
    GLOBAL.test = context.test || context.it;
    GLOBAL.run = context.run;
  });
  mocha.ui("bdd");
  return Promise.resolve(mocha);
}
