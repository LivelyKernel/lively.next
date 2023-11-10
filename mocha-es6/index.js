/* global System,global */

import * as modules from 'lively.modules';
import { withMozillaAstDo } from 'lively.ast';
import mocha from 'mocha';
import chai from 'chai';

// FIXME: This is a temporary solution since we can not easily bundle mocha and chai into the frozen bundle because the esm builds are temporarily broken.
// For now we just inject them manually into the frozen bundle by setting the modules namespaces here:
const S = lively.frozenModules?.oldSystem;
if (S) {
  S.set('mocha', S.newModule({ ...mocha, default: mocha }));
  S.set('chai', S.newModule({ ...chai, default: chai }));
}

const { expect } = chai;

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// custom assertions
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

chai.Assertion.addChainableMethod('stringEquals', function (obj) {
  let expected = String(obj);
  let actual = String(this._obj);

  return this.assert(
    expected === actual,
    'expected ' + actual + ' to equal' + expected,
    'expected ' + actual + ' to not equal' + expected,
    expected, actual, true/* show diff */);
});

function lively_equals (_super) {
  return function (other) {
    if (this.__flags.deep) return _super.apply(this, arguments);
    else if (Array.isArray(this._obj) && arrayEquals(this._obj, other)) { /* do nothin' */ } else if (this._obj && typeof this._obj.equals === 'function' && this._obj.equals(other)) { /* do nothin' */ } else _super.apply(this, arguments);
  };

  function arrayEquals (array, otherArray) {
    let len = array.length;
    if (!otherArray || len !== otherArray.length) return false;

    for (let i = 0; i < len; i++) {
      if (Array.isArray(array[i])) {
        if (!arrayEquals(array[i], otherArray[i])) return false;
        continue;
      }
      if (array[i] && otherArray[i] &&
      typeof array[i].equals === 'function' &&
      typeof otherArray[i].equals === 'function') {
        if (!array[i].equals(otherArray[i])) return false;
        continue;
      }
      if (array[i] != otherArray[i]) return false;
    }
    return true;
  }
}

chai.Assertion.overwriteMethod('equal', lively_equals);
chai.Assertion.overwriteMethod('eq', lively_equals);
chai.Assertion.overwriteMethod('equals', lively_equals);

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// default reporter, logs to console
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

export { loadTestModuleAndExtractTestState, runTestFiles, chai, mocha, expect };

function ConsoleReporter (runner) {
  let passes = 0;
  let failures = 0;

  runner.on('pass', function (test) {
    passes++;
    console.log('pass: %s', test.fullTitle());
  });

  runner.on('fail', function (test, err) {
    failures++;
    console.log('fail: %s -- error: %s', test.fullTitle(), err.stack || err.message || err);
  });

  runner.on('end', function () {
    console.log('end: %d/%d', passes, passes + failures);
  });
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// test loading and running
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function gatherTests (suite, depth = 0) {
  return [{ title: suite.title, fullTitle: suite.fullTitle(), depth: depth, type: 'suite' }]
    .concat(suite.tests.map(ea => ({ title: ea.title, fullTitle: ea.fullTitle(), type: 'test', depth: depth })))
    .concat(suite.suites.reduce((tests, suite) => tests.concat(gatherTests(suite, depth + 1)), []));
}

function prepareMocha (mocha, GLOBAL) {
  mocha.suite.on('pre-require', context => {
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
  mocha.ui('bdd');
}

async function loadTestModuleAndExtractTestState (testModuleName, testsByFile = [], opts) {
  let mod = modules.module(testModuleName); let id = mod.id;

  await mod.reload({ reloadEnv: false, reloadDeps: false });

  mod = modules.module(id);
  let mocha = mod.recorder.mocha;

  if (!mocha) { throw new Error(`After importing mocha test ${id} no mocha object is present in module context!`); }

  let tests = gatherTests(mocha.suite);
  let prev = testsByFile.findIndex(ea => ea.file === id);

  if (prev > -1) testsByFile.splice(prev, 1, { file: id, tests });
  else testsByFile.push({ file: id, tests });

  return { mocha, testsByFile };
}

async function runTestFiles (files, options) {
  if (!options) options = {};

  if (options.package) {
    (options.logger || console).log('[mocha-es6] importing package %s', options.package);
    await lively.modules.importPackage(options.package);
    files = files.map(f =>
      f.match(/^(\/|[a-z-A-Z]:\\|[^:]+:\/\/)/)
        ? f
        : join(options.package, f));
  }

  (options.logger || console).log('[mocha-es6] start running tests');

  let failures = 0;
  for (let f of files) {
    let testState = await loadTestModuleAndExtractTestState(f);
    var { mocha, testsByFile } = testState;

    let grep = options.grep || mocha.options.grep || /.*/;

    mocha.grep(grep);
    options.invert && mocha.invert();

    try {
      failures += await new Promise((resolve, reject) => mocha.run(failures => resolve(failures)));
    } catch (err) {
      (options.logger || console).log('[mocha-es6] error running tests!\n' + err.stack);
      console.error(err);
      throw err;
    }
  }

  console.log(`Failures: ${failures}`);
  return failures;
}

function join (pathA, pathB) {
  if (pathA[pathA.length] === '/') pathA = pathA.slice(0, -1);
  if (pathB[0] === '/') pathB = pathB.slice(1);
  return `${pathA}/${pathB}`;
}

async function test () {
  var file = 'tests/eval-support-test.js';
  var file = 'http://localhost:9001/node_modules/lively.ast/tests/eval-support-test.js';
  await runTestFiles([file], { package: 'http://localhost:9001/node_modules/lively.ast' });
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// System loader extension
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

export function installSystemInstantiateHook () {
  let name = 'mochaEs6TestInstantiater';
  if (modules.isHookInstalled('instantiate', name)) return;
  modules.installHook('instantiate', async function mochaEs6TestInstantiater (proceed, load) {
    await proceed(load);
    System.REGISTER_INTERNAL.records[load.name].linkRecord.instantiatePromise.then(async (link) => {
      if (await isMochaTestLoad(load, link.linkRecord)) {
        installMochaEs6ModuleExecute(load, link.linkRecord);
      }
    });
  });
  console.log('[mocha-es6] System.instantiate hook installed to allow loading mocha tests');
}

export function uninstallSystemInstantiateHook () {
  modules.removeHook('instantiate', 'mochaEs6TestInstantiater');
}

export async function isMochaTestLoad (load, executable) {
  let deps = executable.dependencies || [];
  if (!deps.some(ea => ea.endsWith('mocha-es6') || ea.endsWith('mocha-es6/index.js'))) { return false; }

  let moduleName = load.name;
  // this is bad, get a hold of the source in another way
  let parsed = await modules.module(moduleName).ast();
  let stop = {};
  let isTest = false;

  withMozillaAstDo(parsed, {}, (next, node) => {
    if (node.type === 'CallExpression' &&
     node.callee.name && node.callee.name.match(/describe|it/) &&
     node.arguments[0].type === 'Literal') {
      isTest = true;
    } else next();
  });

  return isTest;
}

function installMochaEs6ModuleExecute (load, executable, options = {}) {
  // this is called from a System.instantiate hook to wrap the execution of the
  // test module body. This is needed b/c mocha expects globals to be present.
  // We can't just simply install those globally b/c the test context needs to be
  // bound into those functions and it is individual for each test module
  let origExecute = executable.execute;
  executable.execute = () => recordTestsWhile(load.name, origExecute);
}

function recordTestsWhile (file, whileFn, options = {}) {
  let module = modules.module(file);
  var options = {
    global: module.recorder || System.global,
    reporter: ConsoleReporter,
    ...options
  };
  let logger = options.logger || console;
  let _mocha = mocha || global.mocha;
  let _Mocha = _mocha.constructor || global.Mocha;
  let m = options.mocha || (options.mocha = new _Mocha({ reporter: options.reporter || ConsoleReporter }));

  module.define('mocha', m);

  // put mocha globals in place
  prepareMocha(m, options.global);
  m.suite.emit('pre-require', options.global, file, m);
  let result = whileFn();

  if (result && typeof result.then === 'function') {
    return Promise.resolve(result).then(() => {
      let imported = System.get(file);
      m.suite.emit('require', imported, file, m);
      m.suite.emit('post-require', options.global, file, m);
      logger.log('[mocha-es6] loaded test module %s with %s tests',
        file, gatherTests(m.suite).length);
    });
  }

  let imported = System.get(file);
  m.suite.emit('require', imported, file, m);
  m.suite.emit('post-require', options.global, file, m);
  logger.log('[mocha-es6] loaded test module %s with %s tests',
    file, gatherTests(m.suite).length);

  return result;
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// for the time being we are directly installing the System instantiate hook in
// here, i.e. when mocha-es6/index.js gets loaded the system is already prepared
// to run tests...!
// uninstallSystemInstantiateHook()
// System.instantiate = System.instantiate.originalFunction.originalFunction

installSystemInstantiateHook();
