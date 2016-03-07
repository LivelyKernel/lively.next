// Thx @ http://staxmanade.com/2015/09/browser-only-mochajs-tests-using-systemjs/

// This tells SystemJS to load the mocha library
// and allows us to interact with the library below.
import mocha from 'mocha';
import chai from "chai";
import subset from "chai-subset";
chai.use(subset);

var isNode = System.get("@system-env").node;
var GLOBAL = isNode ? global : window;

// This defines the list of test files we want to load and run tests against.
var mochaTestScripts = [
  './vm-test.js',
  "./completion-test.js",
  "./cjs-test.js",
  "./es6-test.js",
  "./bootstrap-test.js",

// tests/es6-in-node-test.js
// tests/es6-test.js
// tests/lively-compat-test.js

];

if (!GLOBAL.location) GLOBAL.location = {}

if (typeof document === "undefined")
  mocha.reporter("spec", {useColors: false})

// If you have a global or two that get exposed from your
// tests that is expected you can include them here
var allowedMochaGlobals = [
  "script*"/*jQuery*/,
  "z",/*for "only capture whitelisted globals"*/
  "obj1", "obj2",/*for completion tests*/
  "onerror",
  "__lv_rec__", "someModuleGlobal" /*cjs tests*/
]


if (typeof GLOBAL.initMochaPhantomJS === "function") GLOBAL.initMochaPhantomJS();

// Importing mocha with JSPM and ES6 doesn't expose the usual mocha GLOBALs.
mocha.suite.on('pre-require', function(context) {
  var exports = GLOBAL;

  exports.afterEach = context.afterEach || context.teardown;
  exports.after = context.after || context.suiteTeardown;
  exports.beforeEach = context.beforeEach || context.setup;
  exports.before = context.before || context.suiteSetup;
  exports.describe = context.describe || context.suite;
  exports.it = context.it || context.test;
  exports.setup = context.setup || context.beforeEach;
  exports.suiteSetup = context.suiteSetup || context.before;
  exports.suiteTeardown = context.suiteTeardown || context.after;
  exports.suite = context.suite || context.describe;
  exports.teardown = context.teardown || context.afterEach;
  exports.test = context.test || context.it;
  exports.run = context.run;

  // now use SystemJS to load all test files
  Promise
    .all(mochaTestScripts.map(function(testScript) {
      return System.import(testScript);
    })).then(function() {
      mocha.checkLeaks();
      mocha.globals(allowedMochaGlobals);
      mocha.run();
    }, function(err) {
      console.error("Error loading test modules");
      console.error(err);
    });

});

mocha.setup('bdd');
